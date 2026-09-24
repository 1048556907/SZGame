# Proposal

## Why

每次执行 `scripts/build.ps1` 构建时，package.json 的 version 和 NSIS 产物文件名（`SZGame Setup 0.1.0.exe`）需要手动同步自增 patch 号，容易遗忘或出错。将版本自增自动化，可以保证每次构建产物都有唯一的版本号标识。

## What Changes

- **build.ps1 新增步骤**：在 TypeScript / Vite 编译之前执行 `npm version patch --no-git-tag-version`，自动将 package.json version 从 `0.1.0` bump 到 `0.1.1`
- **可选参数**：支持 `--major` / `--minor` / `--patch` / `--skip-bump` 覆盖默认的 patch 行为（可在 design 阶段决定是否实现）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

（无 — 纯工具链改动，无 spec 级行为变更）

## Impact

| 文件 | 改动 |
|------|------|
| `scripts/build.ps1` | 新增 version bump step（在 Step 2 Clean 之后、Step 3 TypeScript 之前） |
| `package.json` | 每次构建后 version 字段被自动 patch 自增（文件会在构建过程中被修改） |

**Skip Specs**: true（通过 `.openspec.yaml` 设置）
