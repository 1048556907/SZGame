# Tasks

## 1. 后端 schema 改造

- [x] 1.1 `SCHEMA_VERSION` 2 → 3，SCHEMA_SQL 新增 `global_order INTEGER NOT NULL DEFAULT 0` 列
- [x] 1.2 `runMigrations` 新增 v2→v3：ensureColumn + ROW_NUMBER 回填（按 group_id, sort_order, id）
- [x] 1.3 `listGames` 移除 sortBy 参数，统一 `ORDER BY global_order ASC, id ASC`
- [x] 1.4 `reorderGames` 签名简化为 `(items: { id, global_order }[])`，只写 global_order
- [x] 1.5 `createGame` 只分配 global_order（全局 MAX+1），sort_order 固定 0
- [x] 1.6 main.ts / preload.ts IPC 签名同步简化

## 2. 前端 GameGrid 改造

- [x] 2.1 排序统一用 global_order，移除 isAllView 分支
- [x] 2.2 DndContext + DragOverlay + restrictToWindowEdges 接入
- [x] 2.3 handleDragEnd：可视子集 arrayMove → 重建完整列表（保留非子集位置）→ 全部重编号
- [x] 2.4 isDragging prop 禁用 GameCard hover transform 避免嵌套 transform 冲突

## 3. 验证（用户手动）

- [x] 3.1 全部视图拖拽 → 刷新/切换分组保持顺序
- [x] 3.2 分组视图拖拽 → 只有同组游戏位置改变，其他分组不动
- [x] 3.3 搜索态不可拖拽
- [x] 3.4 新建游戏自动排末尾
- [x] 3.5 重启应用保持顺序

## 4. OpenSpec 收尾

- [x] 4.1 更新 design.md / spec.md 反映最终设计
- [x] 4.2 归档本 change
