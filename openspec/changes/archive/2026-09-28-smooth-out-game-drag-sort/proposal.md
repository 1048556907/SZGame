# Proposal

## Why

游戏卡片拖拽排序虽然已功能可用，但交互体验存在明显不平滑：
1. **松手后闪烁**：handleDragEnd 等待 IPC 写入 + refresh 才更新本地状态，DragOverlay 的 dropAnimation 设为 `null` 导致浮层立即消失，原位置卡片"啪"一下跳回——整个过程肉眼可见地卡顿/闪烁。
2. **拖拽启动不准**：PointerSensor `distance: 4` 太小（和 GameCard hover translateY(-3px) 几乎同量级），用户在 hover 后想拖拽时有一段混乱感。
3. **让位动画不流畅**：dnd-kit 默认 transition 参数未显式调优，碰撞检测用 `closestCenter` 在 4 列网格中精度一般。
4. **视觉反馈单薄**：拖拽中的卡片只有 `opacity: 0.3`，没有 scale / 阴影强化，DragOverlay 没有 drop 回弹动画。

"平滑拖拽"是用户对拖拽排序最敏感的体验指标——从可用到好用必须跨过这一步。

## What Changes

- **乐观更新**：handleDragEnd 先更新本地 games state（UI 立即重排），后台异步写 DB，成功则 refresh 确认，失败则回滚
- **丰富拖拽态视觉反馈**：原位置卡片 opacity:0 + scale(0.95)，DragOverlay 增加 `whileDragging` scale:1.05 + boxShadow 强化 + dropAnimation（回弹动画）
- **调优 PointerSensor**：`distance: 8` + `tolerance: 5`，和卡片 hover 位移解耦，避免启动混乱
- **调优 collision detection**：从 `closestCenter` 改为 `closestCorners`（网格更精确）；可选激活 `useDroppable` 自定义放置指示
- **显式 transition 参数**：给 SortableGameCard 传入 duration / easing，统一 dnd-kit 和 GameCard 的过渡曲线
- **清除 isDragging 时 `transition: 'none'` 的硬切**：改用更优雅的退出过渡

## Capabilities

### New Capabilities

_（无）_

### Modified Capabilities
- `game-box`: Requirement "游戏卡片拖拽排序" 需新增**平滑体验**相关 scenario（乐观更新、过渡动画、视觉反馈丰富度、松手回弹）

## Impact

- **文件**：`src/components/GameGrid.tsx`（主要：handleDragEnd 乐观更新 + 视觉反馈 + sensor/transition 调优）
- **无后端 / schema 变更**（纯前端实现优化）
- **无新依赖**（dnd-kit 已有全部所需）
