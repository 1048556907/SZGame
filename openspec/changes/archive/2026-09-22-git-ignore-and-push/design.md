# Design: git-ignore-and-push

## D1 — .gitignore 覆盖范围

按类别分组，遵循 Node.js + Electron + Windows 项目惯例：

| Section | 忽略项 | 说明 |
|---------|--------|------|
| **Node.js** | `node_modules/`, `npm-debug.log*`, `yarn-debug.log*`, `pnpm-debug.log*` | 依赖目录 + 包管理器日志 |
| **Vite 构建** | `dist/`, `dist-ssr/`, `dist-electron/` | 渲染进程 + Electron 主/预加载构建产物 |
| **Electron Builder** | `release/`, `out/`, `.cache/`, `*.blockmap` | NSIS 安装包 + unpacked 目录 + electron-builder 缓存 |
| **SQLite / 本地数据库** | `*.db`, `*.db-journal`, `*.db-shm`, `*.db-wal` | sql.js 在 userDataDir 生成的 SQLite 文件 |
| **Electron userData** | `covers/`, `%APPDATA%/szgame/`（已被 db 忽略覆盖） | 封面图存储目录（不在 repo 内） |
| **React / TS 缓存** | `.vite/`, `.turbo/`, `*.tsbuildinfo` | Vite dev cache + TS incremental |
| **Trae / IDE** | `.trae/`, `.vscode/`, `.idea/`, `*.suo`, `*.user` | IDE 工作区配置 |
| **OS** | `Thumbs.db`, `Desktop.ini`, `$RECYCLE.BIN/`, `.DS_Store` | Windows / macOS 系统垃圾 |
| **环境变量** | `.env`, `.env.local`, `.env.*.local` | 包含敏感信息的 env 文件 |
| **测试覆盖率** | `coverage/`, `.nyc_output/` | Jest / nyc 报告 |

**不忽略**（需要进 repo）：
- `design/mockup.html` — 高保真设计稿
- `images/*` — logo 和图标素材
- `package-lock.json` — 依赖锁文件
- `openspec/` — 规格驱动文档（除 archive 外全进 repo）
- `electron/`、`src/`、`vite.config.ts`、`tsconfig*.json` — 源码

## D2 — Git remote 配置

```bash
git remote add origin https://gitee.com/sinszer/SZGame.git
```

默认分支用 `main`（现代惯例）。如果 remote 上已存在 `master`，push 时显式指定。

## D3 — Commit message

```
chore: initial commit - SZGame v0.1.0-alpha

- Electron + React + TypeScript + Vite 脚手架
- sql.js SQLite (groups / games / settings tables)
- 游戏盒子卡片网格 + 分组管理 + 设置页
- 自定义 frameless 标题栏（frame: false + IPC）
- @dnd-kit 拖拽排序 + debounce 搜索
- NSIS 安装包 84MB
```

符合 conventional commit 规范（`chore:` 类型，scope 省略，subject 简洁）。

## D4 — Push 步骤

```bash
git add .gitignore .
git commit -m "chore: initial commit"
git branch -M main
git push -u origin main
```

如果 remote 上已有内容（README 等），首次 push 可能需要 `--force-with-lease` 或 `pull --rebase`。因 remote 是新项目，默认直接 push 即可。

## D5 — 潜在陷阱

| 风险 | 缓解 |
|------|------|
| `node_modules/` 已被 untracked 缓存 — 加了 .gitignore 后仍会显示 | 不需要处理。首次 `git add .` 会自动跳过被忽略文件；`git status` 不再显示 |
| remote 认证失败（Gitee 首次推送可能弹窗） | 需要用户确认凭据。如果 HTTPS 需要用户名/密码，Gitee 推荐用个人访问令牌代替密码 |
| `openspec/changes/archive/` 已归档的旧 change | 在 repo 内，需要进 archive。默认不忽略 |
