# Proposal

## Why

当前游戏卡片列表（GameGrid）完全忽略后端已有的 `sort_order` 字段，硬按创建时间倒序 + 名称拼音正序渲染。用户在 UI 上无法调整游戏展示顺序。项目依赖已包含 `@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`，分组列表（Sidebar、GroupManager）已有完整的 dnd-kit 拖拽排序实现作为模式参考，后端也暴露了 `gamesReorder(groupId, items)` API。游戏卡片补齐拖拽排序是既有能力的自然延伸。

## What Changes

- **GameGrid 接入 dnd-kit**：在游戏卡片网格外层添加 `DndContext` + `SortableContext`，每个卡片用 `useSortable` 包裹（参考 GroupManager.tsx L96-111 / L213 的分组拖拽模式）
- **排序优先级反转**：`sort_order` 升序作为第一排序键；仅当 `sort_order` 全部为 0 或并列时，才 fallback 到 `created_at` + `name` 的次级排序
- **拖拽持久化**：`handleDragEnd` 计算新旧位置、生成 `{ id, sort_order }[]` 调用 `gamesReorder(currentGroup, items)`（currentGroup 为 `'all'` 时传 `null`）
- **拖拽视觉反馈**：拖拽中的卡片提高 z-index、降低 opacity、加 transform（与 GroupManager 的 draggable 卡片一致）

## Capabilities

### New Capabilities
- `game-grid-sort`: 游戏卡片网格的展示排序规则与拖拽排序交互

### Modified Capabilities
_（无现有 spec 需要修改）_

## Impact

- **文件**：
  - `src/components/GameGrid.tsx`（主要改动：接入 dnd-kit、重写排序逻辑、GameCard → SortableGameCard）
- **无 API / 依赖变更**（dnd-kit 已在 package.json 中）
- **需要确认**：数据库中现有游戏的 `sort_order` 全部为 0 或 NULL 时，首次加载走 fallback 排序；首次拖拽后所有游戏获得有效 sort_order
