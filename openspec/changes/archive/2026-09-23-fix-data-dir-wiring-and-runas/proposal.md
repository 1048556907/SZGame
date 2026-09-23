# Proposal

## Why

用户报告"以管理员身份运行"开关勾选后启动游戏并未弹 UAC 提权提示。经 Node 进程内对实际 DB 运行诊断脚本，发现**根因不在 launcher.ts 的 PowerShell RunAs 逻辑（它已经能正确 exit=0），而在更上游：

1. **DATA_DIR 从未被赋值**（primary）—— commit `62a98ab` 引入便携模式时添加了 `resolveUserDataDir()` 函数和 `let DATA_DIR = ""` 变量，并把所有 `app.getPath('userData')` 调用替换成 `DATA_DIR`，但**漏掉了在 `app.whenReady()` 中执行 `DATA_DIR = resolveUserDataDir()`**。结果是 DATA_DIR 永远是空串 `""`，`initDatabase("")` → `path.join("", "szgame.db")` → 相对路径 → DB 落在了进程 CWD（exe 目录或终端路径），而不是 EXE 同级的 `./data/` 或 APPDATA。新 exe 启动时拿到的是一个空的新 DB，而用户真实的 `%APPDATA%/SZGame/szgame.db`（10MB、7 个真实游戏、v1 schema）从未被触达 —— 之前设计的 `SCHEMA_VERSION=2` 迁移自然也没跑在正确的 DB 上。

2. 因迁移没在真实 DB 上执行 → `games` 表没有 `needs_admin` 列 → `getGame()` 返回 `undefined` → `Boolean(undefined)` = `false` → RunAs 分支永远不进。

此外还需要做一件事：当迁移跑完之后，要**处理已在 APPDATA 的旧 DB**（用户 7 个游戏数据不能丢）—— 要么新 exe 能找到并复用旧 DB，要么迁移时把旧 DB 里的 games 搬过来。

## What Changes

- 在 `app.whenReady()` 最前面加一行 `DATA_DIR = resolveUserDataDir()`，把 62a98ab 漏掉的赋值补上
- 启动时额外检查：如果**便携目录（exe_dir/data/）不存在**但**APPDATA 下存在旧 szgame.db**，则把 APPDATA 的整个 DB **拷贝**到便携目录（或直接 fallback 到 APPDATA 作为 DATA_DIR），确保用户数据不丢失
- 在启动日志里打印 `[app] dataDir=... (source=portable|fallback|legacy-migrated)` 以便后续排查
- launcher.ts / db.ts / main.ts 的 RunAs 修复已经在上一 change 合入并推送到 master（commit 86e4a5a），**本次 change 不需要再改那三处** —— 它们已经能正确工作，只是因为 DATA_DIR 空串导致迁移没跑在对的 DB 上

## Capabilities

### New Capabilities

（本次为 bug fix + 数据迁移，没有新增行为规格；设置了 `skip_specs: true`）

### Modified Capabilities

无

## Impact

| 文件 | 改动 |
|------|------|
| `electron/main.ts` | `app.whenReady()` 开头插入 `DATA_DIR = resolveUserDataDir()`；增加 legacy DB 检测/搬移逻辑；启动日志增强 |
| （launcher.ts / db.ts / main.ts launcher handler —— 已在上一 change 修完，本次不动） | — |

**数据安全**：legacy DB 搬移必须是 **copy（而非 move）**，且只在便携目录 DB 为空/不存在时执行，避免覆盖新数据。
