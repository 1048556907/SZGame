# Proposal

## Why

frameless window 实施时为了提供视觉边界（FRM-5）在 `.app` 加了一条 `box-shadow: 0 0 0 1px rgba(255,255,255,0.06)`，但该边框颜色选的是白色半透明，在深色主题上呈现为浅灰色边线，与蓝色点缀主题冲突；同时侧边栏滚动条未做自定义，系统默认浅灰色滚动条与深色背景不融合。两处视觉瑕疵都源自 FRM-5 当时的快速实现，需要打磨。

## What Changes

- **窗口边线框颜色修正**：`.app` 的 `0 0 0 1px rgba(255,255,255,0.06)` 改为融入主题的深色色调（如 `rgba(0,0,0,0.5)` 或 `--border-strong`），或移除纯靠 drop shadow 做边界感
- **侧边栏滚动条自定义**：给 `.sidebar` 加 `::-webkit-scrollbar` / `scrollbar-width` 自定义样式，与 `.content` 现有滚动条统一成深色版本
- **Firefox 兼容**：加 `scrollbar-width: thin` + `scrollbar-color`（Firefox）

## Capabilities

（纯 CSS 视觉 polish，零 spec-level behavior change；`.openspec.yaml` 已设置 `skip_specs: true`）

## Impact

| 层 | 改动 |
|----|------|
| CSS | `src/styles/globals.css`：`.app` box-shadow + `.sidebar` scrollbar |
| 无副作用 | 不修改任何 TS/JS、IPC、DB、specs |
