# Tasks

## 1. CSS 变量回调（globals.css）

- [x] 1.1 将 `:root` 中 `--titlebar-bg` 改为 `#0a0e14`、`--sidebar-bg` 改为 `#0f151f`、`--surface-0` 改为 `#141c28`；验证：`:root` 中三者值与 design.md Decision 1 一致
- [x] 1.2 将 `--surface-1` 改为 `#192130`、`--surface-2` 改为 `#212b3d`、`--surface-3` 改为 `#2a374c`；验证：`:root` 中四档 surface 值全部匹配
- [x] 1.3 将 `--border` 改为 `rgba(255,255,255,0.07)`、`--border-strong` 改为 `rgba(255,255,255,0.13)`；验证：border opacity 已回调

## 2. Overlay 圆角修复

- [x] 2.1 UpdateDialog.tsx L42-46 遮罩层：加入 `borderRadius: 12` 和 `overflow: 'hidden'`；验证：该 div 的 style 中存在 borderRadius 和 overflow
- [x] 2.2 CoverPickerModal.tsx L175 内层遮罩：加入 `borderRadius: 8` 和 `overflow: 'hidden'`；验证同上（实施前先确认上下文确为 overlay）

## 3. 视觉验证

- [x] 3.1 启动 dev server，Playwright 截图确认：三层色调比 v2 暗但仍可区分，整体不晃眼、协调递进
- [x] 3.2 Overlay 圆角修复：UpdateDialog.tsx L45 加 `borderRadius: 12, overflow: 'hidden'`；CoverPickerModal.tsx L177 加 `borderRadius: 8, overflow: 'hidden'`（与同类 overlay 模式一致：App.tsx L28、Lightbox.tsx L32、GameDrawer.tsx L44、GameForm.tsx L157 均使用 `borderRadius: 12` 作为窗口级遮罩，卡片级 loading overlay 用 8px 更贴合卡片圆角）
