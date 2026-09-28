# Proposal

## Why

GameGrid 硬编码按 `created_at` + `name` 排序，后端已有 `sort_order` 字段但完全未被使用；项目已包含 dnd-kit 依赖且 Sidebar / GroupManager 已有完整拖拽实现。补齐游戏卡片拖拽排序是既有能力的自然延伸。

初始方案设计了 `global_order`（全部视图）和 `sort_order`（per-group）双字段并行，但用户否决了跨分组移动语义。经简化决策：**global_order 成为唯一真相源**，分组视图自然继承"全部"视图的顺序（同一张游戏卡片只有一个 global_order 值，WHERE group_id 过滤后保留相对顺序）。

## What Changes

- **DB schema v2 → v3**：新增 `games.global_order INTEGER NOT NULL DEFAULT 0`，迁移用 ROW_NUMBER 回填保留用户已有排序
- **后端 API 简化**：`reorderGames(items)` 只写 global_order；`listGames` 统一 `ORDER BY global_order ASC`；`createGame` 只分配 global_order
- **GameGrid 接入 dnd-kit**：DndContext + DragOverlay + restrictToWindowEdges + rectSortingStrategy；global_order 为唯一排序键
- **handleDragEnd 统一全局重排**：可视子集 arrayMove → 重建完整列表（保留其他分组位置）→ 全部重编号 global_order = 0..N-1 → 调 gamesReorder

## Capabilities

### New Capabilities
- `game-grid-sort`: 游戏卡片网格的展示排序规则与拖拽排序交互

## Impact

- **文件**：`electron/db.ts`, `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`, `src/components/GameGrid.tsx`
- **新依赖**：`@dnd-kit/modifiers`（提供 restrictToWindowEdges）
- **版本**：SCHEMA_VERSION 2→3；package.json 版本随构建自动 bump
