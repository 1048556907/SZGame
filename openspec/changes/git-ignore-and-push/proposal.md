# Proposal

## Why

SZGame 项目已完成首个迭代交付（Electron + React + SQLite，frameless window + 生产构建通过）。当前工作区没有 `.gitignore` 文件，`git status` 显示 `node_modules/`、`dist/`、`dist-electron/`、`release/`、`.trae/` 等构建产物和临时文件全部处于 untracked 状态；同时 git 远程仓库尚未配置。需要补齐 `.gitignore` 规范、配置 origin 远程，并执行首次提交推送到 Gitee `https://gitee.com/sinszer/SZGame.git`，建立项目版本管理基线。

## What Changes

- **新建 `.gitignore`**：覆盖 Node/Vite/Electron/Windows/VS Code 全场景
- **配置 git remote**：`origin → https://gitee.com/sinszer/SZGame.git`
- **首次提交推送**：`git add .` → conventional commit message → `git push -u origin <default-branch>`

## Capabilities

（纯工程配置，零 spec-level behavior change；`.openspec.yaml` 已设置 `skip_specs: true`）

## Impact

| 层 | 改动 |
|----|------|
| 文件系统 | 新建 `.gitignore` |
| Git | `git remote add origin` + commit + push |
| 无副作用 | 不修改任何源代码、specs、design、config |
