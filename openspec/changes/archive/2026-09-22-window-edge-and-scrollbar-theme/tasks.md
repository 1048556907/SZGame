# Tasks: window-edge-and-scrollbar-theme

## TG1 — 窗口边线框修正

### T1.1: 替换 .app 的 box-shadow
- **File**: `src/styles/globals.css`, `.app` selector (L64)
- **Before**: `box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.7);`
- **After**: 移除 `0 0 0 1px ...` 那条纯色描边，加深 drop shadow 提供边界感
- **Verify**: 窗口四周不再出现浅灰边线框，边界感仍可辨认（通过 drop shadow）

### T1.2 (备选): 如果纯 shadow 不够
- 加 `border: 1px solid rgba(255,255,255,0.04);`（比原 0.06 更淡更融入主题）
- 或改为 `rgba(0,0,0,0.5)`（深色边框在深色背景上几乎看不见）

## TG2 — 全局滚动条样式

### T2.1: 新增 WebKit 内核全局滚动条规则
- **File**: `src/styles/globals.css`, 放在现有 `.content::-webkit-scrollbar` 规则附近
- **Add**: `*::-webkit-scrollbar { width: 6px; height: 6px; }` + `track { background: transparent }` + `thumb { background: rgba(255,255,255,0.08); border-radius: 3px }` + `thumb:hover { background: rgba(255,255,255,0.16) }`
- **Verify**: 侧边栏右侧滚动条与 `.content` 滚动条视觉统一，深色细条

### T2.2: Firefox scrollbar 兼容
- **File**: 同文件，紧接 WebKit 规则
- **Add**: `* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }`

### T2.3: 可选 — 保持侧边栏与内容区滚动条统一宽度/颜色
- 把原 `.content::-webkit-scrollbar { width: 8px }` 统一到全局 `6px`（更细更精致）
- 或保留 8px 不动（设计稿风格）

## TG3 — 验证

### T3.1: Dev build 视觉检查
- **Cmd**: `npm run dev`
- **检查点**:
  - [ ] 窗口边缘浅灰边线框消失
  - [ ] 侧边栏滚动条变深色细条
  - [ ] 内容区滚动条不变（或同步变细）
  - [ ] 滚动条 hover 状态加深

### T3.2: Production build 验证
- **Cmd**: `npx tsc && npx vite build`
- **检查点**: 构建无错误
