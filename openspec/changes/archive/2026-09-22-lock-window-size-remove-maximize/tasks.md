# Tasks: lock-window-size-remove-maximize

## TG1 — Electron 窗口锁定

### T1.1: BrowserWindow 加 resizable:false + maximizable:false
- 去掉 minWidth/minHeight

## TG2 — 标题栏去除最大化按钮

### T2.1: 删除 App.tsx 中最大化按钮 div (L140-143)
- 只保留最小化 + 关闭
