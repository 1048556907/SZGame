# Tasks

## 1. CSS 变量更新（globals.css）

- [x] 1.1 在 `:root` 中新增 `--titlebar-bg: #0a0f16` 变量（插入 `--sidebar-bg` 声明之后）；将 `--sidebar-bg` 旧值 `#080c12` 改为 `#141d2b`；验证：`:root` 块中同时出现 `--titlebar-bg: #0a0f16` 和 `--sidebar-bg: #141d2b`
- [x] 1.2 将 `--surface-0` 改为 `#1a2536`、`--surface-1` 改为 `#212d41`、`--surface-2` 改为 `#2a384f`、`--surface-3` 改为 `#344560`；验证：`:root` 块中四个 surface 值全部匹配 design.md 规定
- [x] 1.3 将 `--border` 改为 `rgba(255,255,255,0.08)`、`--border-strong` 改为 `rgba(255,255,255,0.15)`；验证：`:root` 块中 border opacity 已提升

## 2. 选择器引用修正

- [x] 2.1 将 `.titlebar { background: var(--sidebar-bg); }`（L107）改为 `var(--titlebar-bg)`；验证：全局搜索 `\.titlebar.*var\(--titlebar-bg\)` 有且仅有一处匹配，且无 `.titlebar` 残留对 `--sidebar-bg` 的引用

## 3. 视觉验证

- [x] 3.1 启动开发服务器 `npm run dev`，确认三层色阶视觉分离：标题栏最暗、侧边栏居中、主内容区最亮，三者边界清晰可辨
- [x] 3.2 验证文本可读性：页面标题、菜单项、卡片文字、placeholder 在新背景上无糊化或过暗现象，无任何文字因对比度不足而不可辨认
