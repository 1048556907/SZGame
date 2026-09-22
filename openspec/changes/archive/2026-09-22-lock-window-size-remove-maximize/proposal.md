# Proposal

## Why

软件需要固定窗口尺寸，不允许用户拉伸边框或最大化。最大化按钮从标题栏去除，main.ts BrowserWindow 设 resizable:false + maximizable:false。

## What Changes

- `electron/main.ts`：BrowserWindow 去掉 minWidth/minHeight，加 resizable:false, maximizable:false
- `src/App.tsx`：标题栏去除最大化按钮（□/❐）

## Capabilities

skip_specs: true

## Impact

- electron/main.ts
- src/App.tsx
