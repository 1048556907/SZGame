# cover-preview-broken

## Why
远程封面下载到本地后，在 GameForm 中通过 `<img src="szgame://covers/xxx.jpg">` 回显时显示碎裂图标。根因是自定义协议 `szgame` 未注册为 privileged —— Electron 32 要求非标准协议必须显式声明 `secure + supportFetchAPI + bypassCSP` 才能在 `<img>` / `<link>` 中加载。

## What Changes
- 在 electron/main.ts 最开头（app.whenReady 之前）加 `protocol.registerSchemesAsPrivileged([{ scheme: 'szgame', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: false, stream: true } }])`
- 保留现有 `protocol.handle('szgame', ...)` 实现不变（已经返回 Response + Content-Type）

## Capabilities
- `skip_specs: true`（纯运行时初始化顺序修复）

## Impact
- `electron/main.ts` — app 启动最前加一行 `registerSchemesAsPrivileged`
