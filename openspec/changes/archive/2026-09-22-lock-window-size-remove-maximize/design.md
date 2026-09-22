# Design: lock-window-size-remove-maximize

## D1 — BrowserWindow 尺寸锁定

```js
const win = new BrowserWindow({
  width: 1200,
  height: 780,
  resizable: false,      // 禁止边缘拖拽拉伸
  maximizable: false,    // 禁用系统级最大化
  minimizable: true,     // 保留最小化（设托盘/任务栏）
})
```

不再需要 minWidth/minHeight（resizable:false 下无效）。

## D2 — 标题栏 UI

去除最大化按钮 div，只保留 — (最小化) + ✕ (关闭)。
