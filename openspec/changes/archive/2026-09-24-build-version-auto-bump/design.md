# Design

## Context

See proposal.md - Why. 当前 `scripts/build.ps1` 执行前需手动改 `package.json` version 以同步 NSIS 产物名。`nsis.artifactName` 已配置为 `SZGame Setup ${version}.${ext}`，electron-builder 自动读 package.json version，所以只需 bump package.json 即可。

## Goals / Non-Goals

**Goals:**
- 在 build.ps1 里自动 patch 自增 package.json version
- 构建日志中清晰打印版本变化（old → new）
- 构建成功（exit code 0）时 bump 生效，构建失败时版本不变

**Non-Goals:**
- 不做 major / minor 的自动 bump（按需手动 `npm version major|minor`）
- 不做构建后自动 commit version bump（留给用户自主决定）
- 不回滚 package.json — 简单可靠，失败了重跑即可

## Decisions

### 决策 1：版本 bump 命令

**选择**：`npm version patch --no-git-tag-version`

**备选**：PowerShell 手动解析 package.json 正则替换 —— 不采用，npm version 是官方工具，语义清晰，还会同步更新 `package-lock.json`（如果存在）。

### 决策 2：插入位置

**选择**：Step 2 Clean 之后、Step 3 TypeScript 之前

理由：Clean 清掉 dist 产物后才改版本，electron-builder 拿到的 package.json version 已经是新值，NSIS 产物名自然带上新号。

### 决策 3：无回滚

**选择**：不在构建失败时恢复原 version

理由：PowerShell try/catch 做文件回滚增加复杂度，失败了重跑即可（npm version 幂等：patch → patch 会继续 bump）。如果用户想保留某个 version，手动改回去即可。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 构建后 package.json 变脏 | 可接受——commit 时决定是否包含 version bump |
| `npm version patch` 改了 package-lock.json（如果有） | 一并接受，lock 版本跟着 bump |
| 连续多次手动 patch（不用 build.ps1）导致跳号 | 非问题，patch 自增本身不要求连续 |
