# Design

## Context

See proposal.md — "Why" section 列出了 4 个不平滑的具体问题：松手闪烁、启动混乱、让位卡、反馈单薄。

当前 GameGrid.tsx 关键实现：
- `PointerSensor({ distance: 4 })` — 与 GameCard hover `translateY(-3px)` 几乎同量级
- `collisionDetection={closestCenter}` — 中心点碰撞在 4 列网格里精度一般
- `DragOverlay dropAnimation={null}` — 无回弹
- `isDragging ? 'none' : '...'` — GameCard transition 硬切
- `handleDragEnd` 先 await IPC 再 refresh — 乐观更新未做

dnd-kit 已有全部所需能力（PointerSensor.tolerance、modifiers、CSS.Transition、whileDragging、closestCorners），本次无需新依赖。

## Goals / Non-Goals

**Goals:**
- 乐观更新：handleDragEnd 先 setState，后台 IPC 写 DB
- 丰富拖拽视觉反馈：原位置淡出 + 缩放，DragOverlay scale + shadow + dropAnimation
- 调优 sensor / collision / transition 参数到流畅区间

**Non-Goals:**
- 不引入新依赖（dnd-kit utilities 已够用）
- 不改 global_order / reorderGames 后端逻辑
- 不做跨分组拖拽

## Decisions

### Decision 1: 乐观更新 + 回滚

```ts
const handleDragEnd = async (event) => {
  // 1. 计算新顺序（当前逻辑保留）
  const { fullList, items } = computeReordered(...)

  // 2. 乐观更新 —— 先把新 global_order 灌进本地 games state
  const oldGamesRef = gamesRef.current  // 保留快照
  setGames(prev => {
    const updated = new Map(items.map(i => [i.id, i.global_order]))
    return prev.map(g => updated.has(g.id) ? { ...g, global_order: updated.get(g.id)! } : g)
  })

  // 3. 异步写 DB
  try {
    await gamesReorder(items)
    onRefresh?.()  // 确认同步
  } catch {
    // 回滚
    setGames(oldGamesRef.current)
    toast.showError('排序保存失败')
  }
}
```

**为什么不用 dnd-kit 内置 transient 状态？** dnd-kit 的 SortableContext 在拖拽过程中内部维护 transient 位置，但松手后立即清空并回退到 prop 驱动的 items 顺序——这个"回退"就是闪烁的来源。在我们有后端持久化的场景下，自己管状态更可控。

### Decision 2: PointerSensor 调优

```ts
useSensor(PointerSensor, {
  activationConstraint: { distance: 8, tolerance: 5 }
})
```

**distance: 8** — 与 GameCard hover `translateY(-3px)` 拉开量级差，用户 hover 后再想拖拽时不会先出现混乱位移。
**tolerance: 5** — 允许 5px 内轻微抖动不触发 activation，手持笔/触摸屏更友好。

### Decision 3: Collision Detection 切换

`closestCenter` → `closestCorners`

4 列网格中，卡片有宽高，corners 距离比 center 距离更精确判断"卡片 A 覆盖了卡片 B 的哪个角"，让位决策更自然。`closestCorners` 是 dnd-kit 推荐的网格场景默认值。

### Decision 4: 过渡时长与 Easing 统一

```tsx
// SortableGameCard —— 显式传入 transition
const style = {
  transition: CSS.Transition.toString({
    duration: 200,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)'  // ease-out-quart
  })
}

// DragOverlay dropAnimation
<DragOverlay
  dropAnimation={{
    duration: 250,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    sideEffects: 'all'
  }}
>
```

**统一 200ms ease-out-quart**（dnd-kit 默认 250ms linear）：让位动画是被动动作，200ms 足够肉眼感知且不拖沓。ease-out 让动画起速快、收尾慢，自然。

### Decision 5: 拖拽态视觉反馈增强

```tsx
// SortableGameCard 原位置
opacity: isDragging ? 0.0 : 1,  // 硬切 0 不如淡出 0.3，但我们已有 transition，让过渡完成
// —— 改为 opacity: isDragging ? 0.3 : 1 + transition 200ms，由 dnd-kit transition 驱动淡出

// DragOverlay 浮层
<div style={{
  transform: `scale(1.05) rotate(-1deg)`,
  boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  borderRadius: 16
}}>
```

原位置 opacity 不降到 0.3 以下（保持 ghost 卡片位置感），浮层 scale + 轻微 rotate + 强阴影强化"被抓起"的感知。

## Risks / Trade-offs

- **[乐观更新 + 回滚]** → 需要 games 的 setter 能更新全局 state（通过 props 或 App 层暴露 setter），如果当前 GameGrid 只有 onRefresh callback 没有 setGames prop，需要在 App.tsx 多传一个 prop
- **[closestCorners]** → 在 4 列网格中比 closestCenter 略严格，用户极快横向扫过时可能不触发让位，但影响极小且可通过调小 activationConstraint 补偿
- **[distance: 8]** → 对鼠标用户影响不大；触摸屏用户可能希望更小，可后续加条件（PointerEvent.pointerType）
