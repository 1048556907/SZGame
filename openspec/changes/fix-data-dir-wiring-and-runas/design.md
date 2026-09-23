# Design

## Problem Analysis

**Primary Root Cause: `DATA_DIR` was never assigned**

```
commit 62a98ab "DB放EXE同级./data/便携模式"
  ├─ 新增 resolveUserDataDir() 函数
  ├─ 新增 let DATA_DIR = ""
  ├─ 把所有 app.getPath('userData') 替换成 DATA_DIR  (✓ 做了)
  └─ DATA_DIR = resolveUserDataDir()                 (✗ 漏了！)
```

DATA_DIR 永远是 `""` → `path.join("", "szgame.db")` → 相对路径 → DB 位置等于进程 CWD：
- NSIS 安装版从资源管理器双击启动 → CWD 通常是 `C:\Windows\System32`（或 exe 目录）
- dev 模式从终端启动 → CWD = 项目根目录
- **用户真实 DB 一直在 APPDATA**（62a98ab 之前的版本用 `app.getPath('userData')`）

**Result**:
| 位置 | 状态 | 谁在用 |
|------|------|--------|
| `%APPDATA%/SZGame/szgame.db` | 9.9MB, 7 游戏, **v1 schema（无 needs_admin）** | 旧 exe / 用户以为在用的 |
| `release/win-unpacked/szgame.db` | 0.03MB, 1 测试游戏, schema v2 | 新 exe（因为 CWD=exe 目录） |
| `./szgame.db`（项目根） | 0.03MB, 1 测试游戏, schema v2 | dev 模式运行 |

迁移逻辑（schema version = 2）**本身正确已跑通** —— 只是跑在了错误的 DB 上。

## Solution

### Fix 1: Wire DATA_DIR in app.whenReady()

```typescript
// electron/main.ts — app.whenReady() 开头
app.whenReady().then(async () => {
  DATA_DIR = resolveUserDataDir()    // ← 这一行 commit 62a98ab 漏了
  const userDataDir = DATA_DIR
  // ... 后续不变
})
```

### Fix 2: Legacy DB detection & migration

因为 62a98ab 之前的用户真实 DB 都在 `%APPDATA%/SZGame/szgame.db`，而新的便携模式目标是 `{exe_dir}/data/szgame.db`，需要处理两种情况：

```typescript
function resolveUserDataDir(): string {
  const exeDir = path.dirname(process.execPath)
  const portableDir = path.join(exeDir, 'data')
  const portableDB = path.join(portableDir, 'szgame.db')
  const legacyDB = path.join(app.getPath('userData'), 'szgame.db')

  // Step 1: 尝试写便携目录
  const writable = tryMakeDir(portableDir)

  if (writable) {
    // Step 2: 便携目录可写 → 检查 legacy DB 是否需要搬
    if (!fs.existsSync(portableDB) && fs.existsSync(legacyDB)) {
      // 便携目录是空的且 APPDATA 有旧 DB → COPY 过去（保留 legacy 以防万一）
      fs.copyFileSync(legacyDB, portableDB)
      console.info('[app] migrated legacy DB from APPDATA to portable')
    }
    console.info('[app] using portable data dir:', portableDir)
    return portableDir
  } else {
    // Step 3: 便携目录不可写 → fallback 到 APPDATA
    console.warn('[app] portable dir not writable, fallback to:', app.getPath('userData'))
    return app.getPath('userData')
  }
}
```

**设计决策**：
- **COPY 而非 MOVE** —— legacy DB 保留在 APPDATA 以防回退，用户手动清理
- **只在便携 DB 不存在时搬** —— 如果便携目录已有 DB（比如 dev 跑过），不覆盖
- **便携目录优先** —— 这是 62a98ab 的原始意图，保持一致
- **NSIS 安装到 `%LOCALAPPDATA%/Programs/SZGame/` 是用户可写的** —— 便携模式能生效
- **便携目录不可写 fallback** —— 兼容以 root/管理员安装到 Program Files 的极端情况

### Fix 3: initDatabase 兼容 legacy DB 路径

如果 fallback 到 APPDATA（legacy DB 路径），那 initDatabase 会直接在那个 DB 上跑 schema 迁移（needs_admin, icon_image 列）。因为 `SCHEMA_VERSION=2` 的迁移逻辑已经正确，不需要额外处理 —— 只是**现在终于跑在了对的 DB 上**。

### What's NOT changed

以下文件在上一 change（fix-admin-launch-and-db-migration，commit 86e4a5a）中已经正确修复，本次**不动**：

| 文件 | 已修内容 |
|------|---------|
| `launcher.ts` | `-EncodedCommand` + Base64 + stdio:pipe + exit code 日志 |
| `db.ts` | `SCHEMA_VERSION=2` + `runMigrations()` 集中迁移 |
| `main.ts` launcher handler | `Boolean(g.needs_admin)` 防御性判断 |

## Verification Plan

1. **新 exe 启动** → 日志 `[app] dataDir=...` 应显示便携目录或 fallback
2. **旧 APPDATA DB 存在** → 首次启动看到 `[app] migrated legacy DB` 日志
3. **迁移后便携 DB** → 包含原 APPDATA 的所有 7 个游戏 + needs_admin 列
4. **勾选"以管理员运行"保存 → 启动** → 弹 UAC → 点"是" → 管理员启动游戏
5. **nsis 安装到新目录** → 便携模式生效（{exe}/data/szgame.db）
6. **以管理员身份启动（exe 在 Program Files）** → fallback 到 APPDATA
