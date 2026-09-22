# Design: window-edge-and-scrollbar-theme

## D1 — 窗口边线框处理

**决策：移除 1px 纯色描边，改用加深 drop shadow 做边界感**

```css
.app {
  box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.4);
}
```

**理由**：
- 原 `0 0 0 1px rgba(255,255,255,0.06)` 是"纯色描边"，在深色背景上视觉突出成浅灰边框
- 新方案用两层 shadow：①主阴影做 elevation ②极细 1px 黑色半透明 shadow 做边界提示
- 在 Windows 浅色桌面背景上（如白色/浅蓝色），drop shadow 自动成边界，不会出现"深底上的白线"问题
- 如果用户仍觉得边界不够，备选方案：`border: 1px solid rgba(255,255,255,0.04)`——更淡更融入

## D2 — 滚动条范围

**决策：全局自定义滚动条，覆盖所有可滚动区域**

```css
/* WebKit 内核（Chrome / Edge / Electron） */
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }

/* Firefox 兼容 */
* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
*:hover { scrollbar-color: rgba(255,255,255,0.16) transparent; }
```

**理由**：
- 覆盖 `.sidebar`、`.content`、`.tb-search-box input` 内滚动、任何未来新增区域
- 用选择器优先级 `*::-webkit-scrollbar` 一次性搞定，不用给每个元素单独加
- 颜色 `rgba(255,255,255,0.08)` 比原 `.content` 的 `var(--surface-3)` 更接近主题边框色，hover 状态加深到 `0.16` 可交互

## D3 — 保持现有滚动条变量兼容

原 `.content::-webkit-scrollbar` 定义可以移除或保留（全局 `*` 选择器优先级更低，但都能用）。为简洁，保留 `.content` 局部定义，加一条全局覆盖规则，保证侧边栏等其他区域也生效。

## D4 — 文件影响矩阵

| File | Change |
|------|--------|
| `src/styles/globals.css` | `.app` box-shadow 改色；新增全局 scrollbar 规则 |
