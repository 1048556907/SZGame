# Design

## Context

- **现状**：GameGrid.tsx 有 `games` prop 和 `sort_order` 字段但排序硬编码为 `created_at` + `name`，忽略了 `sort_order`
- **dnd-kit 依赖已就绪**：`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities` 均已在 package.json 中
- **模式参考**：GroupManager.tsx L96-111 / L213 和 Sidebar.tsx L42-101 已有完整的 dnd-kit 拖拽实现（DndContext + SortableContext + useSortable + PointerSensor + arrayMove），GameGrid 直接复用相同模式
- **后端 API**：`gamesReorder(groupId, items: { id, sort_order }[])` 已存在（`gamesReorder(null, items)` 处理"全部"视图）

## Goals / Non-Goals

**Goals:**
- 游戏卡片网格支持拖拽排序，sort_order 持久化
- sort_order 成为最高优先级排序键
- 无 sort_order 数据时 fallback 到旧行为（created_at + name）
- 与 GroupManager 相同的 dnd-kit 模式和视觉反馈

**Non-Goals:**
- 不支持跨分组拖拽（GameGrid 是单分组或"全部"视图，跨分组逻辑复杂）
- 不实现拖拽手柄（直接拖整张卡片，与 GroupManager 一致）
- 不改变 `gamesReorder` API 或数据库 schema

## Decisions

### Decision 1: 排序优先级

```
sort_order 升序 → created_at 倒序 → name 拼音正序
```

- 当 sort_order 全部为 0 或并列时，退化为 `created_at → name` 的次级排序
- 判断逻辑：`const hasSortOrder = list.some(g => g.sort_order !== 0 && g.sort_order !== null)`
  - 若 `hasSortOrder` 为 true：按 sort_order 升序；sort_order 相同则按 created_at + name
  - 若为 false：完全走旧的 created_at + name 逻辑

### Decision 2: dnd-kit 接入方式

复用 GroupManager 模式：

```tsx
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  arrayMove, SortableContext, rectSortingStrategy, useSortable
} from '@dnd-kit/core/sortable'
```

注意：卡片网格是 4 列 grid，不是垂直列表——dnd-kit 需要用 `rectSortingStrategy` 而非 `verticalListSortingStrategy`。

### Decision 3: SortableGameCard 包装

将现有 GameCard 包装为 SortableGameCard，添加：
- `useSortable({ id: game.id })` 获取 `setNodeRef, listeners, attributes, transform, transition, isDragging`
- 拖拽时：`isDragging` → opacity: 0.6, zIndex: 1000, transform: scale(1.02)
- 拖拽中其他卡片自动让位（dnd-kit 内置）

### Decision 4: handleDragEnd 流程

```ts
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) return
  // 注意：sortedList 已按当前分组过滤，index 是当前分组内位置
  const oldIndex = sortedList.findIndex(g => g.id === active.id)
  const newIndex = sortedList.findIndex(g => g.id === over.id)
  if (oldIndex < 0 || newIndex < 0) return

  const reordered = arrayMove(sortedList, oldIndex, newIndex)
  // 重新计算 sort_order：用 reordered 在原 games 数组位置对应
  // 更简单：直接用 reordered 的索引作为新 sort_order
  const items = reordered.map((g, i) => ({ id: g.id, sort_order: i }))
  const groupId = currentGroup === 'all' ? null : currentGroup
  await window.electronAPI?.gamesReorder(groupId, items)
  // 触发刷新
}
```

关键：拖拽排序只在非搜索态启用（搜索结果不应排序）。

## Risks / Trade-offs

- **[当前游戏 sort_order 全为 0]** → 首次拖拽会将当前分组内所有游戏重新标记 sort_order = 0..N-1，后续进入就按 sort_order 走了
- **["全部"视图]** → 跨分组拖拽不支持；在"全部"视图排序等于给每个分组内的游戏重排（gamesReorder 传 null 时的行为需要在主进程确认——如果主进程要求 group_id，则遍历每个分组分别调用）
- **[搜索态拖拽]** → 不允许，`DndContext` 只在非搜索态挂载（参考 Sidebar 的条件挂载模式）
