# Tasks: git-ignore-and-push

## TG1 — 创建 .gitignore

### T1.1: 写入完整 .gitignore
- **File**: 项目根目录 `.gitignore`（新建）
- **覆盖范围**: Node/Vite/Electron Builder/SQLite/OS/IDE/env/coverage（详见 design.md D1）
- **Verify**: `git status --short` 不再显示 node_modules、dist、release、.trae 等

### T1.2: 验证 git status 干净度
- **Cmd**: `git status --short`
- **期望**: 只显示需要进 repo 的文件（源码、配置、openspec、design、images、AGENTS.md、constitution.md）

## TG2 — Git Remote + Commit + Push

### T2.1: 配置 origin 远程
- **Cmd**: `git remote add origin https://gitee.com/sinszer/SZGame.git`
- **Verify**: `git remote -v` 显示 origin fetch/push 指向该 URL

### T2.2: 首次 add + commit
- **Cmd**: `git add .gitignore .`
- **Cmd**: `git commit -m "chore: initial commit - SZGame v0.1.0-alpha"`
- **Verify**: `git log --oneline -1` 显示该 commit

### T2.3: 推送到 Gitee
- **Cmd**: `git branch -M main`
- **Cmd**: `git push -u origin main`
- **Verify**: Gitee 仓库页面刷新可见所有文件

## TG3 — 后推验证

### T3.1: 在 Gitee 仓库确认忽略生效
- **检查**: Gitee 文件列表中无 `node_modules/`、无 `dist/`、无 `release/`、无 `*.db`
- **检查**: 源码（`electron/`、`src/`）、配置（`vite.config.ts`、`tsconfig*.json`）、文档（`AGENTS.md`、`openspec/`）全部可见
