# Proposal

## Why

`frameless-window-titlebar` 实施后窗口圆角未生效。排查根因：transparent:true 窗口设置了实色 backgroundColor 覆盖 DWM 圆角区域；body 有实色背景填满 100% 覆盖 .app 裁剪；滚动条 border-radius 在 Electron Chromium 渲染层被忽略。

## What Changes

- **窗口圆角**：main.ts 去掉 backgroundColor，css html/body/#root 加裁剪链，.app 加实色背景
- **滚动条圆角**：改为朴素方案（track 有淡色 + thumb border-radius:5px + 无 transparent border hack）

## Capabilities

skip_specs: true

## Impact

- `electron/main.ts`：删除 backgroundColor
- `src/styles/globals.css`：html/body/#root 裁剪链 + .app 实色背景 + 滚动条
