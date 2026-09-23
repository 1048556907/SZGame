# Tasks

## Implementation

- [ ] **db.ts — 加 schema version + 集中迁移**
  - 定义 `SCHEMA_VERSION = 2`
  - `initDatabase()` 里读 `db.schema.version` settings，低于 2 时调用 `runMigrations(from, 2)`
  - `runMigrations('1', '2')` → `ensureColumn('games', 'needs_admin', 'INTEGER NOT NULL DEFAULT 0')`
  - 完成后 `setSetting('db.schema.version', '2')`

- [ ] **launcher.ts — needsAdmin 分支全重写（编码安全 + 日志）**
  - needsAdmin=true 分支内：
    - 构建 PowerShell 命令用 `-EncodedCommand` + UTF-16 LE Base64 编码
    - `spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', base64], { detached, stdio: ['ignore','pipe','pipe'] })`
    - `stderr` pipe 记录错误；`on('close', code => { if(code!==0) console.error(...) })`
    - `.unref()` 保持非阻塞
  - bat 类型 needsAdmin 同样改造

- [ ] **main.ts launcher handler — 防御性 needs_admin 判断**
  - `const needsAdmin = (g.needs_admin === 1 || g.needs_admin === true)` —— 兼容 0/1/true/false/undefined/null

## Verification

- [ ] 安装**新版 exe** 后启动，确认旧 DB 自动迁移（启动时不报错）
- [ ] 在 DB 手动检查 games 表有 needs_admin 列（DEFAULT 0）
- [ ] 新增一个游戏 → 勾选"以管理员身份运行"开关 → 保存
- [ ] 启动该游戏 → Windows 弹 UAC 确认框 → 点"是" → 游戏以管理员权限启动
- [ ] 启动该游戏 → Windows 弹 UAC → 点"否" → PowerShell exit code ≠ 0，控制台/日志可见错误信息，游戏不启动（SZGame 本身不死）
- [ ] 不需要 admin 的游戏启动 → 不弹 UAC，直接 spawn
- [ ] tsc 0 errors
