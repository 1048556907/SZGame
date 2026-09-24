# Proposal

## Why

SZGame 当前没有自动更新能力。用户发布新版本到 Gitee Releases 后，现有用户只能手动去仓库页面下载安装，体验割裂。新增自动更新可让应用在后台静默检测并拉取最新版本，提升维护效率和用户体验。

## What Changes

- 新增主进程模块 `electron/updater.ts`，实现 Gitee Releases API 调用、semver 版本比较、HTTP 流式下载 NSIS 安装包、spawn 静默安装
- 应用启动时（仅生产环境）自动检查 Gitee 上是否有更高 semver tag
- 非强制更新：检测到新版本后通知 Renderer，弹出极简提示（当前版本→最新版本），用户可选择"立即更新"或"稍后再说"
- 强制更新（开关）：启动后自动下载最新 NSIS 安装包到临时目录，下载完成后自动退出应用、静默覆盖安装，安装完成后自动重新拉起 App
- 设置页面新增"自动更新"区块，包含：启用自动检查开关、强制更新开关、手动"检查更新"按钮
- 新增 IPC 通道：`updater:check`（手动检查）、`updater:on-available`（事件）、`updater:on-progress`（事件）、`updater:install`（触发安装）

## Capabilities

### New Capabilities
- `app-update`: 应用自动更新能力——版本检测、下载、静默安装、强制更新模式，以及与 Gitee Releases API 的对接

### Modified Capabilities
- `settings`: 设置页面新增自动更新相关配置项（启用自动检查开关、强制更新开关、手动检查更新按钮）

## Impact

- **主进程**：`main.ts` 新增启动时检查逻辑、updater 相关 IPC handler；新增 `electron/updater.ts` 模块
- **预加载**：`preload.ts` 新增 updater 相关 invoke 和事件订阅
- **渲染进程**：新增 `UpdateDialog.tsx` 更新提示弹窗；`Settings.tsx` 加更新设置区块；`App.tsx` 订阅更新事件
- **类型定义**：`types/index.ts` 的 `electronAPI` 扩展
- **数据库**：`db.ts` 的 DEFAULT_SETTINGS_SQL 追加两个默认 setting key
- **无新依赖**：使用 Node 原生 `https` + `fs` 实现下载，不引入 electron-updater / electron-dl
- **NSIS 安装参数**：依赖 electron-builder 默认 NSIS 配置，使用 `/S` 静默参数覆盖安装
