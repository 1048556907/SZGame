# steam-cover-polish

## Why
Steam storesearch 接口默认 10s 超时过短（实际网络波动或 CDN 慢时导致"请求超时"），且前端仍有 "RAWG" 旧文案残留，与 Steam 商店方案不一致。

## What Changes
- HTTP 请求超时从 10s 提升到 25s，并支持 ABORT 信号
- 清理所有残留的 "RAWG" 字样（loading 提示、注释）
- 同步更新 UI 加载状态文字

## Capabilities
- `skip_specs: true`（纯实现级调整，无 spec 行为变化）

## Impact
- `electron/remote-cover.ts` —— timeout 常量 + Agent keepAlive + 清理 RAWG 注释
- `src/components/CoverPickerModal.tsx` —— loading 提示文字
