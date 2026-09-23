# Tasks

## Implementation

- [x] **main.ts — 修复 resolveUserDataDir() 函数体**
  - ✓ dev 模式 guard（`!app.isPackaged` 直接返回 APPDATA）
  - ✓ portable DB 检测 + legacy APPDATA DB `copyFileSync` 搬移
  - ✓ 便携目录不可写 fallback APPDATA
  - ✓ 日志增强 `[app] using portable data dir` / `migrated legacy DB` / `fallback`

- [x] **main.ts — app.whenReady() 开头插入 `DATA_DIR = resolveUserDataDir()`**
  - ✓ 这一行 commit 62a98ab 漏了，导致 DATA_DIR 永远是空串

- [x] **tsc 0 errors**
  - ✓ `npx tsc --noEmit` → exit 0

- [x] **Build + commit + push**
  - ✓ 关键：**必须先 `vite build` 再 `electron-builder`**（electron-builder 不会重新构建 dist-electron）
  - ✓ commit `7840145` → push main → Gitee

## Verification（已自动验证）

- [x] 新 exe 启动 → 便携目录 `release/win-unpacked/data/` 自动创建
- [x] portable DB = 9.9 MB（完整 legacy DB 内容）
- [x] schema version = 2（迁移跑了）
- [x] needs_admin 列 PRESENT ✓
- [x] 7 个游戏完整保留
- [x] 项目根没误建空 DB（CWD 相对路径问题修复）

## Verification（需要用户操作）

- [ ] 安装新 exe（`release/SZGame Setup 0.1.0.exe`）→ 启动 → 确认数据完整
- [ ] 启动"风灵月影管理器"（#237）→ 勾选"以管理员运行"保存 → 启动 → 弹 UAC → 点"是" → 管理员启动
- [ ] 其他 6 个不勾选 admin 的游戏 → 不弹 UAC，直接启动
- [ ] 如果便携目录不可写（如安装到 Program Files）→ 确认 fallback 到 APPDATA 也正常
