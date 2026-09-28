# Design

## Context

- **初始状态**：GameGrid.tsx 忽略 `sort_order`，硬编码按 `created_at` + `name` 排序；dnd-kit 依赖已在 package.json；Sidebar / GroupManager 已有完整拖拽实现模式
- **中间状态**：引入 `global_order` 字段作为"全部"视图独立排序，`sort_order` 保留为 per-group 字段 → 用户否决跨分组移动语义
- **最终方案**：`global_order` 成为唯一真相源，所有视图（全部 / 具体分组 / 搜索结果）统一按它排序；`sort_order` 列保留 schema 兼容但不再读写

## Goals / Non-Goals

**Goals:**
- 游戏卡片网格支持拖拽排序，global_order 持久化
- global_order 成为唯一真相源：任何视图（全部 / 分组 / 搜索）统一按它排序
- 分组视图自动继承"全部"视图的顺序（因为同一张游戏卡片只有一个 global_order 值）
- 分组视图拖拽只改变同组游戏在全部列表中的相对位置，其他分组不动
- DndContext + DragOverlay + restrictToWindowEdges 提供流畅的拖拽体验

**Non-Goals:**
- 不支持跨分组拖拽（不改变 game.group_id）
- 不实现拖拽手柄（直接拖整张卡片）
- 不读写 `sort_order` 字段（保留列仅为老 DB schema 兼容）

## Decisions

### Decision 1: global_order 作为唯一真相源

```
所有视图 ORDER BY global_order ASC, id ASC
```

- `listGames` 不再根据视图切换排序字段，统一用 global_order
- `reorderGames` 签名简化为 `(items: { id: number; global_order: number }[])`，只写 global_order
- `createGame` 只分配 global_order（全局 MAX+1），sort_order 固定为 0
- 分组视图自动继承"全部"视图的顺序：因为同一张游戏只有一个 global_order，WHERE group_id = ? 过滤后自然保留原顺序

### Decision 2: dnd-kit 接入（4 列网格）

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

- 网格 4 列 → `rectSortingStrategy`（不是 `verticalListSortingStrategy`）
- PointerSensor distance:4 → 防误触点击
- `restrictToWindowEdges` → 无边框圆角窗口内拖拽不超出边界
- DragOverlay + activeGame 态 → 原位置 opacity:0.3 + 浮层完整卡片（scale:1.02）

### Decision 3: handleDragEnd 统一全局重排

```ts
const handleDragEnd = async (event) => {
  // 1. 在可视列表（可能是过滤后的分组视图）里确定拖拽位置
  const oldIndex = sortedList.findIndex(g => g.id === active.id)
  const newIndex = sortedList.findIndex(g => g.id === over.id)

  // 2. 对可视子集做 arrayMove → 得到子集的新顺序
  const reorderedSubset = arrayMove(sortedList, oldIndex, newIndex)
  const subsetIds = new Set(sortedList.map(g => g.id))

  // 3. 重建完整列表：按原 global_order 排列，把子集元素按新顺序放回原位
  const fullList = [...games].sort((a, b) => (a.global_order ?? 0) - (b.global_order ?? 0))
  const positions: number[] = []
  for (let i = 0; i < fullList.length; i++)
    if (subsetIds.has(fullList[i].id)) positions.push(i)
  for (let i = 0; i < positions.length; i++)
    fullList[positions[i]] = reorderedSubset[i]

  // 4. 给完整列表重新编号 global_order = 0..N-1
  const items = fullList.map((g, i) => ({ id: g.id, global_order: i }))
  await window.electronAPI.gamesReorder(items)
}
```

关键设计：
- **分组视图拖拽**只改变同组游戏的相对位置，其他分组的 global_order 保持不变（因为 subset 外的 fullList 元素不动）
- **全部视图拖拽**等同于对完整列表做 arrayMove，效果正确
- **搜索视图禁用拖拽**（dragEnabled = !searchActive）

### Decision 4: DB schema 迁移 v2 → v3

```sql
ALTER TABLE games ADD COLUMN global_order INTEGER NOT NULL DEFAULT 0;
UPDATE games SET global_order = (
  SELECT seq FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY group_id, sort_order, id) - 1 AS seq
    FROM games
  ) WHERE id = games.id
);
```

- 先补列，再回填（ROW_NUMBER over group_id, sort_order, id 保留用户已有分组内排序习惯）

## Risks / Trade-offs

- **[sort_order 列闲置]** → 保留 schema 兼容，完全不读写；如果未来确实需要 per-group 独立排序，可以再加回来
- **[拖拽给完整列表重排]** → 应用层全部重排（几十条游戏）开销可忽略，但比只更新 moved 游戏更健壮，避免了"只给子集编号导致和其他分组冲突"的 bug
- **[global_order 为 0 的 fallback]** → listGames 用 `ORDER BY global_order ASC, id ASC`，前端 hasGlobalOrder 判断为 false 时回退到 `created_at → name`
