# Tasks

## Implementation

- [x] **db.ts — 加 schema version + 集中迁移**
  - 定义 `SCHEMA_VERSION = 2`
  - `initDatabase()` 里读 `db.schema.version` settings，低于 2 时调用 `runMigrations(from, 2)`
  - `runMigrations('1', '2')` → `ensureColumn('groups', 'icon_image', 'TEXT')` + `ensureColumn('games', 'needs_admin', 'INTEGER NOT NULL DEFAULT 0')`
  - 完成后 `setSetting('db.schema.version', '2')`

- [x] **launcher.ts — needsAdmin 分支全重写（编码安全 + 日志）**
  - 新增 `spawnRunAs(psCmd)` helper：
    - `Buffer.from(psCmd, 'utf16le').toString('base64')` 编码 → `powershell.exe -EncodedCommand`
    - `stdio: ['ignore', 'pipe', 'pipe']` 捕获 stderr/stdout
    - `on('close', code => { if(code!==0) console.error(...) })`
    - `on('error')` 也记日志
  - needsAdmin 分支（exe + bat）全部改用 spawnRunAs

- [x] **main.ts launcher handler — 防御性 needs_admin 判断**
  - `const needsAdmin = Boolean(g.needs_admin)` —— 兼容 DB INTEGER 1/0、迁移前 undefined

## Verification（需要用户操作）

- [ ] 安装**新版 exe** 后启动，确认旧 DB 自动迁移（启动时不报错）
- [ ] 在 DB 手动检查 games 表有 needs_admin 列（DEFAULT 0）
- [ ] 新增一个游戏 → 勾选"以管理员身份运行"开关 → 保存
- [ ] 启动该游戏 → Windows 弹 UAC 确认框 → 点"是" → 游戏以管理员权限启动
- [ ] 启动该游戏 → Windows 弹 UAC → 点"否" → PowerShell exit code ≠ 0，控制台/日志可见错误信息，游戏不启动（SZGame 本身不死）
- [ ] 不需要 admin 的游戏启动 → 不弹 UAC，直接 spawn
- [x] tsc 0 errors
