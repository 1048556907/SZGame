# Proposal

## Why

SZGame 项目目前缺少 README.md，外部访问仓库的用户无法快速了解项目是什么、有哪些功能、如何运行和构建。随着功能逐步完善（游戏盒子核心、分组管理、自动更新、设置面板），需要一份结构化的使用说明来帮助新用户和开发者上手。

## What Changes

- 新增项目根目录 `README.md`，包含以下章节：
  - 项目简介（SZGame 是什么、技术栈）
  - 功能特性（分组管理、游戏启动、封面管理、拖拽排序、搜索、系统托盘、自动更新等）
  - 界面截图（引用 `doc/01首页.png` ~ `doc/04设置.png` 四张截图）
  - 快速开始（开发环境运行 `npm run dev` / `npm run electron:dev`）
  - 构建发布（`npm run build` 生成 NSIS 安装包）
  - 目录结构概览
  - License
- 无任何源代码行为变更

## Capabilities

### New Capabilities

（无，纯文档变更）

### Modified Capabilities

（无，纯文档变更）

> ⚠️ 本次变更为纯文档编写，无 spec 级别的行为改变，已在 `.openspec.yaml` 中设置 `skip_specs: true`。

## Impact

- **新增文件**：`README.md`（项目根目录）
- **引用文件**：`doc/01首页.png`、`doc/02详情.png`、`doc/03收藏夹.png`、`doc/04设置.png`
- **无代码变更**：不修改任何 `src/`、`electron/` 下的源码
- **无依赖变更**：不修改 `package.json`、`vite.config.ts` 等配置
