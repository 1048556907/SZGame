# Design

## 1. 根因分析

```
用户勾选 needs_admin=true → 点启动游戏
    ↓
main.ts launcher handler: getGame() → g.needs_admin
    ↓
【路径 A: 用户没装最新 exe】
旧 DB 没有 needs_admin 列 → getGame() SQL SELECT * → GameRow 没有 needs_admin 字段
→ g.needs_admin = undefined → undefined === 1 = false
→ 永远不进 RunAs 分支 ❌

【路径 B: 用户装了最新 exe 但命令失败】
spawn(powershell, ['-Command', psCmd], { stdio: 'ignore' })
→ PowerShell 因为编码/引号/UAC拒绝等原因失败
→ stdio:'ignore' 把 stderr 全吞了
→ launcher 返回 success:true（以为 spawn 成功就是启动成功）
→ UI 显示"启动成功"但游戏没出来 ❌
```

## 2. DB 迁移加固

**当前 ensureColumn 已经在 initDatabase 里了**，正常会执行。但有一个更根本的防御：

```sql
PRAGMA table_info(games)  -- 检查列是否存在
```

改成更健壮的迁移方案 —— 给每次 DB schema 升级加版本号：

```typescript
const SCHEMA_VERSION = 2  // 从 1 升到 2

// initDatabase 里
const version = getSetting('db.schema.version') ?? '1'
if (version < SCHEMA_VERSION) {
  runMigrations(version, SCHEMA_VERSION)
  setSetting('db.schema.version', String(SCHEMA_VERSION))
}

function runMigrations(from: string, to: string) {
  const v = Number(from)
  if (v < 2) {
    ensureColumn('games', 'needs_admin', 'INTEGER NOT NULL DEFAULT 0')
  }
}
```

这样未来加列不再散落，迁移集中管理。

## 3. launcher.ts needsAdmin 分支重写

### 3.1 路径编码安全

PowerShell `-Command` 参数默认按系统代码页（中文 Windows 是 GBK/936）解析。如果游戏路径有中文字符：

```
'C:\游戏\艾尔登法环\elden ring.exe'  ← 中文路径
```

PowerShell GBK 解析会把 UTF-8 字符串里的某些字节变成乱码，导致路径找不到。

**解决方案**：不用内联 `-Command`，改用 `-EncodedCommand` + UTF-16 LE Base64 编码：

```typescript
const psCmd = `Start-Process -FilePath '${launchPath}' -Verb RunAs -Wait:$false -WindowStyle Hidden`
const utf16 = Buffer.from(psCmd, 'utf16le')
const base64 = utf16.toString('base64')
spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', base64], ...)
```

PowerShell 收到的 `-EncodedCommand` 是 Base64 → 解 Base64 → UTF-16 LE → 原命令。**完全绕过系统代码页，对中文/日文/emoji 路径都安全。**

### 3.2 spawn stdio 改为 pipe + 日志（但不阻塞）

```typescript
if (needsAdmin) {
  const child = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', base64], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  let stderr = ''
  child.stderr?.on('data', d => { stderr += d.toString('utf-8') })
  child.on('close', code => {
    if (code !== 0) {
      console.error('[launcher] RunAs PowerShell failed code=' + code + ': ' + stderr)
      // 可以考虑写一个 settings.log 让用户能看到
    }
  })
  child.unref()
  // 注意：spawn 只创建子进程，不等待它完成 —— 返回 success:true
  // UAC 是否被批准，PowerShell 是否真的启动了游戏，launcher 没法实时知道
  // 只能事后从 PowerShell exit code 推断（但用户拒绝 UAC 时 PowerShell exit=1）
}
```

### 3.3 UAC 被拒绝的检测

当用户点 UAC "否"：
- PowerShell `-Verb RunAs` exit code = 1
- stderr 有 `The operation was canceled by the user` 或类似内容
- 我们在 `child.on('close')` 里拿到 code != 0，记日志

但 launcher.ts 是**同步返回**的（spawn 是非阻塞的），所以：
- 返回值里没法告诉 UI "UAC 被拒了"
- 最佳做法：IPC handler 里可以给游戏启动加一个超时检测

**简化做法（本次先不上复杂超时检测）**：日志 + 让用户自己看游戏启动了没。如果失败了，下次用户还是点启动 → PowerShell 会再次弹 UAC（用户批准就行）。

### 3.4 main.ts handler 防御性处理

```typescript
const needsAdmin = (g.needs_admin === 1 || g.needs_admin === true)
// 兼容 DB 里 needs_admin 是 1/0 / true/false / undefined
```

## 4. 改动清单

| 文件 | 改什么 |
|------|--------|
| `electron/db.ts` | 加 SCHEMA_VERSION=2 + runMigrations() 集中管理 ensureColumn；ensureColumn('games', 'needs_admin') 现在由迁移调用 |
| `electron/launcher.ts` | needsAdmin 分支用 `-EncodedCommand` + UTF-16 LE Base64 编码；stdio: pipe 但 detached: true；on('close') 记 PowerShell exit code |
| `electron/main.ts` | launcher handler 对 needs_admin 做防御判断 |

## 5. 不做的事

- **不**做超时检测（启动后等 PowerShell exit 再返回 —— 会阻塞主进程）
- **不**改 SZGame 自己的 UAC 级别（方案 C 保持：SZGame 普通权限，按需触发 UAC）
- **不**加 npm 依赖（Node Buffer + PowerShell 都是内置/系统）
- **不**做 UI 提示 UAC 结果（本次先日志）
