# Tasks

## 1. App.tsx — 传递 setGames 支持乐观更新

- [x] 1.1 给 GameGrid 新增 `onUpdateGames?: (updater: (prev: Game[]) => Game[]) => void` prop，透传 App.tsx 的 `setGames` 函数（useState updater 形式，支持函数式更新）
- [x] 1.2 修改 GameGrid interface（GameGridProps）加入该 prop，默认 fallback 为 `onRefresh?.()`（没有 onUpdateGames 时退化为原来的等待模式）
- [x] 1.3 验证：TS 零错误

## 2. GameGrid.tsx — 乐观更新 + 回滚

- [x] 2.1 handleDragEnd 计算完 `fullList` 和 `items` 后，先调用 `onUpdateGames(prev => prev.map(g => ...))` 把新 global_order 灌入本地 state，然后异步 await `gamesReorder`；失败时用 `onRefresh` 回滚 + toast 报错
- [x] 2.2 保留原有 handleDragEnd 计算逻辑（子集 arrayMove → 重建完整列表 → 重新编号），只在 IO 部分改为乐观更新
- [x] 2.3 验证：TS 零错误，vite build 通过

## 3. GameGrid.tsx — Sensor / Collision / Transition 调优

- [x] 3.1 PointerSensor: `distance: 4` → `distance: 8, tolerance: 5`
- [x] 3.2 collisionDetection: `closestCenter` → `closestCorners`
- [x] 3.3 DragOverlay: `dropAnimation: { duration: 250, easing: EASING }`（不再 null）
- [x] 3.4 SortableGameCard: 显式传入 `transition: CSS.Transition.toString({ property: 'transform', duration: 200, easing: EASING })`，不再只用 dnd-kit 默认值
- [x] 3.5 移除 `GameCard transition: isDragging ? 'none' : '...'` 的硬切逻辑，改为 `border-color 120ms linear, background 120ms linear` 只淡出让过渡曲线保持连贯
- [x] 3.6 验证：TS 零错误，vite + electron build 均通过

## 4. GameGrid.tsx — 拖拽态视觉反馈增强

- [x] 4.1 DragOverlay 浮层: `transform: scale(1.05) rotate(-1deg)` + `boxShadow: 0 24px 64px rgba(0,0,0,0.7)` + `borderRadius: 16`
- [x] 4.2 SortableGameCard 原位置: `opacity: isDragging ? 0.3 : 1` 保持（ghost 占位感），加 `scale: isDragging ? 0.97 : 1` 轻微缩小强化"被抓起"感知
- [x] 4.3 验证：TS 零错误

## 5. 手动验证 & 整体测试

- [ ] 5.1 启动 Electron，验证乐观更新：拖拽 → 立即重排 → 无闪烁 → 松手后不跳回
- [ ] 5.2 验证 dropAnimation 回弹：松手到浮层消失应有 250ms 左右的回弹过渡
- [ ] 5.3 验证让位动画流畅：拖拽中跨越其他卡片时，让位不卡、不硬切
- [ ] 5.4 验证启动平滑：hover 后立即拖拽无混乱位移（distance: 8 生效）
- [ ] 5.5 验证 refresh 保持：拖拽后切视图 / 重启应用顺序保持
- [x] 5.6 验证 Electron build 产物体积无异常变化
