# Design: fix-rounded-corners

## D1 — 窗口圆角正确裁剪链

**必须满足的链条**：`BrowserWindow transparent:true + DWM roundedCorners → 最顶层透明 → overflow:hidden 裁剪 → 内容层实色背景`

```
Electron Window (transparent:true, roundedCorners:true)
    ↓ DWM 给窗口级圆角
html, body, #root {
  border-radius: 12px;       ← 跟 .app 同半径
  overflow: hidden;          ← 必须！不然圆角不裁剪子元素
  background: transparent;   ← 关键！transparent 窗口才看得见 DWM 圆角
}
    ↓ 圆角裁剪链完成
.app {
  background: var(--surface-0);  ← 实色背景放这里
  border-radius: 12px;           ← 冗余但不害
  overflow: hidden;               ← 冗余但不害
}
```

**之前为什么没生效**：body 有 `background: var(--surface-0)` 实色背景填满了整个窗口（100% 高宽），`.app` 的 border-radius 被 body 背景覆盖，因为 `.app` 不是 body 的唯一子元素且 body 没有 overflow:hidden。

## D2 — 滚动条真正药丸形

**问题**：`::-webkit-scrollbar-thumb { border-radius: 9999px }` 在某些 Electron 版本/Chromium 渲染管线中被忽略，thumb 显示成矩形。

**方案**：`::-webkit-scrollbar` 增加 `padding` + track 有圆角 + thumb 有足够 border-radius

```css
*::-webkit-scrollbar {
  width: 10px;
  padding: 2px;             ← 把 track 变窄
}
*::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.03);
  border-radius: 9999px;
}
*::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.15);
  border-radius: 9999px;
}
```

**备选**：如果还不生效，换成更粗的 radius + 更细的 scrollbar 宽度（thumb 越细 9999px 越接近正圆/药丸）。

## D3 — 文件影响

| File | Action |
|------|--------|
| `src/styles/globals.css` | html/body/#root 裁剪链 + scrollbar 药丸 |
