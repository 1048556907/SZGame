# Proposal

## Why

用户反馈"以管理员身份运行"开关打开后，游戏启动时提权未生效。诊断发现**两个根因叠加**：
1. 用户运行的是旧版 EXE，DB 迁移 `ensureColumn('games', 'needs_admin', 'INTEGER NOT NULL DEFAULT 0')` 尚未执行 —— 旧 DB 的 games 表根本没有 needs_admin 列
2. 即使列存在，launcher.ts 的 `spawn(..., { stdio: 'ignore' })` 吞掉了 PowerShell 全部错误输出，导致 PowerShell 命令失败时我们完全没有诊断信息

## What Changes

- **修复 DB 迁移路径**：确保 `initDatabase()` 中的 `ensureColumn` 调用在旧版 DB 上正确执行，给所有现有 games 表补齐 `needs_admin` 列（DEFAULT 0）
- **修复 launcher.ts needsAdmin 分支的健壮性**：
  - 把 `stdio: 'ignore'` 改为 pipe PowerShell stderr/stdout 并 log（但不返回给 UI，保持 detached）
  - 处理中文路径和含单引号路径的 PowerShell 编码问题（当前内联 `-Command` 模式对非 ASCII 路径不安全）
  - UAC 被用户拒绝时捕获并返回 `success: false, message: 'UAC 已取消'`
- **给 launcher:launch handler 加防御性 fallback**：`needs_admin` 为 undefined/null/非 0/1 时默认当作 false（不要让 undefined 传到 launcher.ts）
- **加迁移版本号标记**：在 settings 表写入 `db.schema.version`，从 1 升级到 2，未来迁移更明确

## Capabilities

`skip_specs: true` —— 本次是 bug fix + 迁移加固，没有新的 spec-level 行为变化。管理员开关功能的 UI/UX 行为已经在上一个 change 定义了，本次只修复实现和迁移。

## Impact

- `electron/db.ts` —— 加 db.schema.version 标记、ensureColumn 防御性检查
- `electron/launcher.ts` —— needsAdmin 分支重写：spawn stdio pipe + 错误捕获 + 路径编码安全
- `electron/main.ts` —— launcher handler 对 needs_admin 做防御性判断
- **无新增 npm 依赖**（继续用 Node 内置 spawn）
- **Breaking**：无。所有旧 DB 启动时自动迁移，所有现有游戏默认 needs_admin=0（普通权限）
