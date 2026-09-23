# Tasks

## Implementation

- [ ] **main.ts — 修复 resolveUserDataDir() 函数体**
  - 增加 `portableDB` / `legacyDB` 路径常量
  - 提取 `tryMakeDir(dir): boolean` 辅助函数（mkdirSync + writeFileSync 测试，返回 boolean 不 throw）
  - 三步逻辑：① try portable dir ② if writable → check legacy DB copy ③ else fallback APPDATA
  - 日志增强：`[app] using portable data dir: ... (migrated from legacy)` / `[app] fallback to APPDATA`

- [ ] **main.ts — app.whenReady() 开头插入 `DATA_DIR = resolveUserDataDir()`**
  - 这一行 commit 62a98ab 漏了，导致 DATA_DIR 永远是空串
  - 插在 `const coversDir = path.join(userDataDir, 'covers')` 之前

- [ ] **tsc 0 errors**
  - `npx tsc --noEmit`

- [ ] **Build + commit + push**
  - `npx electron-builder --win`（先 Kill SZGame/Electron 进程）
  - commit message: `fix: wire DATA_DIR assignment + legacy APPDATA DB 搬移到便携目录`

## Verification（需要用户操作）

- [ ] 安装新 exe → 启动 → 查看日志有 `[app] using portable data dir: ...` 或 `migrated legacy DB`
- [ ] 便携目录下 szgame.db 存在 → 包含原 APPDATA 的所有 7 个游戏
- [ ] DB 有 needs_admin 列（`SELECT needs_admin FROM games LIMIT 1` 不报错）
- [ ] 启动"风灵月影管理器"（用户已有游戏之一）→ 勾选"以管理员运行"保存 → 启动 → 弹 UAC
- [ ] 不需要 admin 的游戏 → 不弹 UAC，直接启动
- [ ] fallback 场景：如果便携目录不可写（如 exe 在 Program Files）→ 用 APPDATA DB，迁移也跑通
