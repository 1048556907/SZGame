# Proposal

## Why

当前 NSIS 覆盖安装（更新）或卸载时，默认删除整个 `$INSTDIR`。而 SZGame 的便携模式将 `szgame.db` 放在 `{exeDir}/data/` 下——正好在 `$INSTDIR/data/` 里。用户执行更新后所有游戏配置、分组、cover 引用等数据会被清空。

## What Changes

- 在 `package.json` 的 `build.nsis` 配置中增加自定义 NSIS 脚本入口（`include` 或自定义 `script`）
- 新增 `scripts/installer.nsh`（或类似名称），覆盖 NSIS 的卸载/升级钩子，在删除文件时跳过 `data/` 目录
- 保持 `resolveUserDataDir()` 便携模式逻辑不变（不强制改 APPDATA）

## Capabilities

**skip_specs: true** — 这是纯构建层修复，不改变应用运行时的外部可观察行为。数据目录路径、读写时机、持久化语义都不变；变的是 NSIS 安装器"不删 data/"的内部实现细节。

## Impact

| 区域 | 影响 |
|------|------|
| `package.json` | build.nsis 增加自定义 script 或 include |
| 新增文件 | `scripts/installer.nsh` — NSIS 脚本 |
| `electron/main.ts` | **无改动**（保持便携模式） |
| `electron/db.ts` | **无改动** |
| electron-builder 版本 | 当前 25.1.8 支持 NSIS 自定义脚本入口 |

## NSIS 保护方案要点

electron-builder NSIS 支持自定义脚本 `nsis.script`（完整覆盖）或 `nsis.include`（追加到默认脚本）。采用 `include` 方式最小侵入：

- 覆盖 `Section "Uninstall"` 中的文件删除逻辑，在删除前检查 `$INSTDIR/data/`，存在则跳过
- 覆盖升级流程中的旧版本文件清理逻辑
- 关键：**升级场景**（同产品名同安装目录）和**卸载场景**都要保护 data/
