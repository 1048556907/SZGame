# Proposal

## Why

当前 SZGame 同时存在两套标题栏：上方红框内是 Electron 原生窗口边框（标题栏 + — □ ✕ 窗口控制按钮），下方深色顶栏是 React 中已实现的 `.titlebar` div（LOGO + SZGame + — □ ✕）。两者重复且视觉层次混乱，与设计稿中"简约大气、蓝色点缀"的标题栏风格冲突。去掉原生边框，让设计稿中的标题栏成为唯一窗口控制入口，是还原设计意图的必要修正。

## What Changes

- **Electron 主进程**：`BrowserWindow` 构造参数加 `frame: false`，移除原生边框
- **Electron preload**：新增窗口控制 IPC：`win:minimize`、`win:toggle-maximize`、`win:close`、`win:is-maximized`，替换当前 titlebar 按钮里直接调用 `hideToTray()` 和 `quit()` 的临时逻辑
- **React 标题栏**：接通真实窗口控制，最大化状态监听后切换按钮图标（□ / ❐）
- **CSS 拖拽区域**：标题栏 div 加 `-webkit-app-region: drag`，按钮区域加 `no-drag`，实现原生拖拽体验
- **无边框阴影 / 边界**：Windows 下 frameless 窗口无默认阴影，通过 CSS box-shadow + 1px border 模拟，保证视觉完整性
- **设置行为兼容**：最小化 / 关闭的托盘行为逻辑保持不变（由主进程的 `minimize` / `close` 事件拦截负责），仅触发路径从原生按钮改为 React 按钮 → IPC → 主进程

## Capabilities

### New Capabilities
- `frameless-window`: 去除 Electron 原生窗口边框，以 React 实现的自定义标题栏作为唯一窗口控制入口，包含拖拽移动、最小化、最大化切换、关闭等完整窗口行为。

### Modified Capabilities
（无 — 现有 specs 均处于 in-flight change 中，无已发布 capability 受影响）

## Impact

| 层 | 文件 | 改动类型 |
|----|------|----------|
| Electron main | `electron/main.ts` | BrowserWindow 选项 `frame: false` + IPC handler（minimize / toggle-maximize / close / is-maximized）+ 监听 maximize/unmaximize 广播 |
| Electron preload | `electron/preload.ts` | contextBridge 新增 `windowControls` API |
| React 入口类型 | `src/index.d.ts`（或复用 preload 类型） | WindowControls interface |
| React 组件 | `src/App.tsx` | titlebar 按钮接通 IPC；useEffect 监听 maximize/unmaximize；`hideToTray` / `quit` 调用保留 |
| CSS | `src/styles/globals.css` | `.titlebar` 加 drag / no-drag 区域；frameless 窗口阴影；无边框最小尺寸时的边缘处理 |
| 无副作用 | `openspec/changes/game-box-initial/*` | 不修改；其 specs 已包含标题栏描述但未落地 |
