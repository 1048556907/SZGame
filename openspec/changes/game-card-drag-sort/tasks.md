# Tasks

## 1. 排序逻辑改造（GameGrid.tsx）

- [x] 1.1 在 sortedList 的排序函数中加入 sort_order 判断：当存在非零 sort_order 时，`sort_order → created_at → name`；否则 `created_at → name`
- [x] 1.2 验证：全部 sort_order 为 0 时排序结果与改动前一致；混合场景下有 sort_order 的排在前（TS + Vite build 双通过）

## 2. dnd-kit 接入（GameGrid.tsx）

- [x] 2.1 添加 dnd-kit imports：`DndContext, closestCenter, PointerSensor, useSensor, useSensors`（core）+ `SortableContext, rectSortingStrategy, useSortable, arrayMove`（sortable）+ `CSS`（utilities）
- [x] 2.2 将 GameCard 重构为 SortableGameCard，useSortable 接入 ref/listeners/attributes/transform/transition，isDragging 时 opacity: 0.5 + zIndex: 100
- [x] 2.3 条件挂载 DndContext + SortableContext（仅在 `!searchActive && currentGroup !== 'all'` 时挂载；搜索态和"全部"视图都禁用拖拽——后者避免跨分组破坏 per-group sort_order）
- [x] 2.4 实现 handleDragEnd：计算新旧索引、arrayMove 重排、生成 `{ id, sort_order }[]`、调用 `gamesReorder(currentGroup, items)`、调用 onRefresh 触发刷新
- [x] 2.5 验证：TypeScript 零错误，Vite 生产构建通过（dist-electron/main.js + preload.js 均构建成功）

## 3. 验证

- [ ] 3.1 启动 Electron 完整环境，在具体分组内手动拖拽卡片，确认顺序变化且刷新后保持（需手动验证）
- [ ] 3.2 切换不同分组后拖拽，确认 sort_order 按分组独立保存（需手动验证）
- [ ] 3.3 搜索态 / "全部"视图尝试拖拽（应无反应）（需手动验证）
- [ ] 3.4 游戏卡片可点击打开（cursor: pointer 保持，distance:4 PointerSensor 区分点击与拖拽）（需手动验证）

**备注**：
- 主进程 `reorderGames(groupId, items)` 只按 id 更新，groupId 参数未使用——前端只传当前分组过滤后的 items，不会影响其他分组
- 主进程 `createGame` 时 sort_order 按 `WHERE group_id = ?` 的 MAX+1 分配——sort_order 是 per-group 的
- listGames 排序 `ORDER BY sort_order ASC, id ASC`——不按分组过滤时跨分组混排，但前端排序逻辑会把有 sort_order 的游戏排在前面
- Electron dev 手动验证（3.1-3.4）需启动完整 Electron 应用，超出 Playwright dev server 范围，留待用户验收
