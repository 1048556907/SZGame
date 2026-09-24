# Tasks

## 1. 修复 build.ps1 编码问题

- [x] 1.1 修改 `scripts/build.ps1` 第 47 行：`Get-Content "package.json"` → `Get-Content "package.json" -Encoding utf8`
- [x] 1.2 修改 `scripts/build.ps1` 第 50 行：同上

## 2. 验证

- [x] 2.1 验证：用 GBK 强行解码 package.json 复现用户乱码（"SZGame 鈥?鏈湴..."）；加 `-Encoding utf8` 后正确解码为 "SZGame — 本地游戏与程序管理盒子"，无 `ConvertFrom-Json` 异常
- [x] 2.2 version bump 逻辑未变，修复只影响版本号读取编码，不影响 npm version patch 流程
