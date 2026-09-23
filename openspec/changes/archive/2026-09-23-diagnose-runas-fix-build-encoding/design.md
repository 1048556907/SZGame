# Design

## 诊断真相（已确认）

```
用户注册表: SZGame 0.1.0  installed at D:\game\SZGame\
app.asar 构建时间: 2026-09-22 21:12:32
                          ↑ 远早于我们两次修改（commit 86e4a5a 7840145，9/23）
                          
用户实际跑的是旧版！没有 resolveUserDataDir()、没有 DATA_DIR 赋值、
没有 SCHEMA_VERSION=2 迁移、没有 launcher.ts EncodedCommand、没有 needs_admin 列
→ RunAs 永远不触发 —— 不是代码 bug，是用户根本没装新版
```

额外发现：
- 用户 legacy DB 在 `{exe}/szgame.db`（旧版 DATA_DIR="" 相对路径遗留），不是 APPDATA
- 新 build 的 legacy copy 逻辑**只查 APPDATA**，没覆盖这个来源
- `D:\game\SZGame\data\` 不存在 —— 便携模式从未生效

## 修复方案

### Fix 1: resolveUserDataDir 扩展 legacy 检测来源

当前只从 APPDATA 搬：
```typescript
const legacyDB = path.join(app.getPath('userData'), 'szgame.db')
```

需增加 `{exe}/szgame.db` 来源（旧版 DATA_DIR="" 遗留的同级 DB）：
```typescript
const legacySources = [
  path.join(exeDir, 'szgame.db'),    // 旧版 DATA_DIR="" 同级遗留
  path.join(app.getPath('userData'), 'szgame.db'),  // 62a98ab 之前的 APPDATA 位置
]
for (const src of legacySources) {
  if (!fs.existsSync(portableDB) && fs.existsSync(src) && src !== portableDB) {
    fs.copyFileSync(src, portableDB)
    console.info('[app] migrated legacy DB:', src, '→', portableDB)
    break
  }
}
```

**两个 legacy 来源的优先级**：exe 同级 > APPDATA（exe 同级的 DB 是用户在旧版实际使用的那个）。

### Fix 2: build.ps1 中文乱码

**根因**：PowerShell 5.1 默认 cp 936 (GBK)，脚本 UTF-8 无 BOM → Write-Host 中文被 GBK 错误解码。

**修复**：build.ps1 开头加两行：
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8  # 影响 Write-Host
chcp 65001 > $null                                         # 影响子进程输出（如 tsc/vite）
```

这样 PowerShell 5.1 和 7 都用 UTF-8 显示中文。文件保持 UTF-8 无 BOM（避免 git diff 干扰）。

### Fix 3: 引导用户安装新版 + 勾选开关

**这不是代码改动，是用户操作指引**：
1. Kill 旧版 SZGame（如果在跑）
2. 运行 `release\SZGame Setup 0.1.0.exe` NSIS 安装器
3. 安装到 `D:\game\SZGame\` 覆盖（或新位置都可以）
4. 启动新 exe —— 会自动：
   - 创建 `{exe}/data/` 便携目录
   - 检测 `{exe}/szgame.db` legacy → copy 到 `{exe}/data/szgame.db`
   - 启动 initDatabase → schema version 迁移 → needs_admin 列补齐
5. 编辑游戏 → 勾选"以管理员运行" → 保存
6. 启动该游戏 → 弹 UAC

## 修改范围

| 文件 | 改动 | 类型 |
|------|------|------|
| `electron/main.ts` resolveUserDataDir() | legacy DB 检测增加 exe 同级来源 | 代码 |
| `scripts/build.ps1` | 开头加 UTF-8 编码声明 | 工具 |
| `openspec/changes/diagnose-runas-fix-build-encoding/` | 本 change 的 artifacts | 规划 |

**launcher.ts / db.ts / main.ts launcher handler** —— 上两次修改已正确，本次不动。

## 验证点

| # | 验证 | 通过标准 |
|---|------|---------|
| 1 | 新版本 NSIS 安装到 D:\game\SZGame\ | exe 能启动 |
| 2 | portable data 目录创建 | `D:\game\SZGame\data\szgame.db` 存在 |
| 3 | legacy DB 从 `D:\game\SZGame\szgame.db` 搬移 | portable DB 包含全部 8 个游戏 |
| 4 | needs_admin 列存在 | schema version = 2 |
| 5 | 游戏编辑界面"以管理员运行"开关可勾 | 保存后 DB needs_admin=1 |
| 6 | 启动弹 UAC | PowerShell RunAs exit=0 |
| 7 | build.ps1 中文正常显示 | "Kill Electron" / "tsc: 0 errors" / emoji 正常 |
