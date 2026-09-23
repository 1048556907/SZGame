# Tasks

## Implementation

- [ ] **main.ts — resolveUserDataDir() 增加 `{exe}/szgame.db` legacy 来源检测**
  - 新增 `legacySources = [exeDir/szgame.db, APPDATA/szgame.db]` 数组
  - `for ... of` 遍历，找到第一个存在的 legacy → copyFileSync 到 portableDB
  - 两个来源都不存在 → 不搬（全新安装场景）

- [ ] **build.ps1 — 修复中文乱码**
  - 脚本开头（$ErrorActionPreference 后）加：
    ```powershell
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    chcp 65001 > $null
    ```

- [ ] **tsc 0 errors** + **vite build**（**必须先 vite build 再 electron-builder**）
  - `npx tsc --noEmit && npx vite build`
  - 确认 dist-electron/main.js 包含新的 legacySources 逻辑

- [ ] **electron-builder** → `release/SZGame Setup 0.1.0.exe`

- [ ] **Install 验证**（用户手动）
  - Kill 旧版 SZGame
  - 运行新 Setup 安装到 `D:\game\SZGame\`（覆盖旧版位置）
  - 启动新 exe
  - 验证 portable data 目录创建 + legacy DB 搬移 + needs_admin 列
  - 编辑游戏 → 勾选管理员 → 保存 → 启动 → 弹 UAC

- [ ] **build.ps1 编码验证**
  - `./scripts/build.ps1` 运行
  - 所有中文标题、错误消息、emoji 正常显示（无 `?` 或乱码）

## 关键认知记录

**前两次修改"未达到预期"的真相**：
- 用户实际安装在 `D:\game\SZGame\`（注册表 UninstallString 确认）
- 该版本 app.asar 构建时间 **2026-09-22 21:12:32** —— 远早于我们两次修改（9/23 提交）
- **用户根本没装新版 exe！** —— 旧版既没有 DATA_DIR 赋值，也没有迁移代码，也没有 EncodedCommand RunAs

**教训**：每次声称修复后，必须确保用户**安装了最新 Setup exe**，而不是只构建完就以为用户在用了。

**构建教训**：单独跑 `electron-builder --win` 用的是上次 vite build 的产物。改了 electron/main.ts 后**必须先 `vite build`**，否则 asar 里是旧代码。
