# Tasks

## Implementation

- [x] **main.ts — resolveUserDataDir() 增加 `{exe}/szgame.db` legacy 来源检测**
  - ✓ legacySources 数组 `[exeDir/szgame.db, APPDATA/szgame.db]` 按优先级
  - ✓ 遍历，第一个存在的 legacy → copyFileSync 到 portableDB

- [x] **build.ps1 — 修复中文乱码**
  - ✓ 脚本开头 `[Console]::OutputEncoding = UTF8` + `chcp 65001`
  - ✓ 中文/emoji 字面量 → ASCII `[OK]` `[FAIL]`（因为 PowerShell 5.1 读 UTF-8 无 BOM 脚本默认按 GBK 解码）
  - ✓ `$ErrorActionPreference = "Continue"`（tsc/vite stderr 警告不阻断）

- [x] **tsc 0 errors** + **vite build**
  - ✓ `npx tsc --noEmit && npx vite build` → exit 0
  - ✓ dist-electron/main.js 包含 legacySources + for...of 遍历搬移 + DATA_DIR=resolveUserDataDir

- [x] **electron-builder** → `release/SZGame Setup 0.1.0.exe`
  - ✓ build.ps1 全流程 exit=0
  - ✓ 产物 84MB

- [ ] **Install 验证**（用户手动）
  - Kill 旧版 SZGame
  - 运行 `release\SZGame Setup 0.1.0.exe` NSIS 安装器
  - 覆盖安装到 `D:\game\SZGame\`（或新位置）
  - 启动新 exe → 看 `D:\game\SZGame\data\szgame.db` 是否被搬移
  - schema version = 2，needs_admin 列存在
  - 编辑游戏 → 勾选管理员 → 保存 → 启动 → 弹 UAC

- [x] **build.ps1 编码验证**
  - ✓ 全流程输出：`[OK]` 绿色，`[FAIL]` 红色，无乱码，exit=0

## 关键认知记录

**前两次修改"未达到预期"的真相**：
- 用户注册表 UninstallString 确认安装在 `D:\game\SZGame\`
- 该版本 app.asar 构建时间 **2026-09-22 21:12:32** —— 远早于我们两次修改（9/23 提交）
- **用户根本没装新版 exe！**

**legacy DB 多来源问题**：
- 旧版 DATA_DIR="" 导致 DB 落在 `{exe}/szgame.db`（如 D:\game\SZGame\szgame.db）
- 之前 fix-data-dir-wiring-and-runas 只查 APPDATA，漏了 exe 同级这个来源
- 新 build 的 legacySources 数组现在两个都查，优先 exe 同级

**构建教训**：
- 单独跑 `electron-builder --win` 用的是上次 vite build 的产物
- 改了 electron/main.ts 后**必须先 `vite build`**
- **`npm run build` = `tsc && vite build && electron-builder`**（完整流程）

**build.ps1 编码教训**：
- PowerShell 5.1 读 UTF-8 无 BOM 脚本文件时默认按 cp 936 GBK 解码
- 即使运行时设了 `[Console]::OutputEncoding = UTF8`，脚本内的字符串字面量已经被 GBK 误解码了
- 解决方案：把所有非 ASCII 字面量替换成 ASCII（注释写英文，emoji 换 `[OK]/[FAIL]`）
