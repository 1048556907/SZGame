# Design

## Context

See proposal.md — Why. 技术背景：

- **关键发现：** electron-builder v25/v26 只支持 `appx` target，无顶层 `msix` 配置键。electron.build/docs 超前于 npm 发布。AppX 和 MSIX 共享 makeappx.exe 底层打包工具，Microsoft Store 仍接受 `.appx` 格式。配置已从 `msix` 调整为 `appx`。
- electron-builder 26.17.0（从 25.1.7 升级）
- Windows SDK 10.0.26100.0 已安装（含 makeappx.exe / makepri.exe）
- 当前构建：`npm run build` = `tsc && vite build && electron-builder`，同时输出 NSIS + AppX
- 自建 updater（electron/updater.ts）通过 Gitee Releases 拉取 `.exe` 静默安装，AppX 上此路径不可用
- Partner Center 包身份已确认，配置值硬编码在 package.json 中

## Goals / Non-Goals

**Goals:**
- 单次 `npm run build` 同时产出 NSIS `.exe` 和 MSIX `.msix` + `.msixupload`
- MSIX 版本通过 Store 审核（identityName / publisher 精确匹配 Partner Center）
- MSIX 环境下自建 updater 自动跳过，不与 Store 更新冲突
- NSIS 构建产物和行为零回归

**Non-Goals:**
- 不在本次变更中实现 MSIX 包的 sideloading 自签名测试流程（本地安装验证属于 apply 阶段的手工步骤）
- 不为 NSIS 路径引入代码签名证书（超出本次范围，另行解决）
- 不修改自建 updater 的核心逻辑（Gitee API 轮询、下载、静默安装），仅增加 MSIX 检测入口

## Decisions

### D1: package.json 中的 MSIX 配置结构

**选择：** 在顶层 `build` 下新增 `msix` 和 `toolsets` 键，`win.target` 改为数组。

```json
"build": {
  "win": {
    "target": ["nsis", "msix"],
    "icon": "images/logo.png"
  },
  "toolsets": {
    "winCodeSign": "1.1.0"
  },
  "msix": {
    "identityName": "10DFD687.SZGame",
    "publisher": "CN=BDA47175-C8A4-48DB-A24B-A36B178DC7F8",
    "publisherDisplayName": "博学浮生",
    "displayName": "SZGame",
    "capabilities": ["runFullTrust"],
    "minVersion": "10.0.17763.0",
    "createMsixupload": true,
    "artifactName": "SZGame-${version}.${ext}"
  }
}
```

**替代方案：** 用 `--msix` 单独构建命令（放弃） — 破坏现有 `npm run build` 的单一入口体验。

**关键细节：**
- `winCodeSign: "1.1.0"` — electron-builder 文档明确指出 legacy `0.0.0` 不含 MSIX 所需 SDK，必须显式升级
- `runFullTrust` — Electron 桌面应用必需的 MSIX capability，允许完全信任执行
- `minVersion: "10.0.17763.0"` — Win10 1809 是 Store MSIX 提交的最低门槛
- `createMsixupload: true` — 直接产出 `.msixupload`（Store 上传专用格式，内含 `.appxsym` 符号文件）
- 不含 `languages`、`maxVersionTested`、`backgroundColor` — 用默认值足够

### D2: MSIX Tile 图标资源

**选择：** 从 `images/logo.png`（已存在的应用图标）用 Node.js Sharp 库按尺寸缩放生成 4 张必需图标。

**文件清单：**

| 目标文件 | 尺寸 | 用途 |
|---------|------|------|
| `build/appx/StoreLogo.png` | 50×50 | Store 列表图标 |
| `build/appx/Square44x44Logo.png` | 44×44 | 开始菜单小图标 |
| `build/appx/Square150x150Logo.png` | 150×150 | 开始菜单主图标 |
| `build/appx/Wide310x150Logo.png` | 310×150 | 磁贴宽图标 |

**替代方案：**
- 手工用在线工具缩放（放弃） — 不可自动化、不可复现
- 用 electron-builder 默认占位图标（放弃） — 质量差、Store 审核可能不通过

**实现：** 在 `package.json` 的 `scripts` 中增加 `build:tiles`，用 Sharp（devDependency）从 logo.png 批量生成。或直接在 electron-builder 构建前通过一个内联 node 脚本完成。

### D3: MSIX 环境检测（updater.ts）

**选择：** 在 `startAutoUpdateFlow` 入口检查 `app.isPackaged` 之后，追加 MSIX 包特征检测。

**检测方法（按可靠性排序）：**

```
方法 A: 检查 app.getAppPath() 是否以 "WindowsApps" 或 PFN 路径开头
  MSIX 安装路径: C:\Program Files\WindowsApps\10DFD687.SZGame_my19qp5k4dp9e\
  NSIS 安装路径: C:\Users\<user>\AppData\Local\Programs\SZGame\

方法 B: 尝试读取 Package.appxmanifest
  MSIX 包根目录存在此文件，NSIS 不存在

方法 C: 检查 Electron app 模块的 hidden 方法或 package.json 的 msix 标记
```

**最终选择：方法 B（读取 Package.appxmanifest）** — 最可靠、最无副作用、不依赖路径格式。

```typescript
// electron/updater.ts — 在 startAutoUpdateFlow 顶部追加
function isMsixInstalled(): boolean {
  if (!app.isPackaged) return false
  try {
    const manifest = path.join(app.getAppPath(), '..', 'Package.appxmanifest')
    return fs.existsSync(manifest)
  } catch {
    return false
  }
}

export async function startAutoUpdateFlow(mainWindow: BrowserWindow | null): Promise<void> {
  if (!app.isPackaged) return
  if (isMsixInstalled()) {
    console.info('[updater] MSIX installation detected, skipping self-update (Store manages updates)')
    return
  }
  // ... 原有逻辑不变
}
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| electron-builder MSIX target 是 beta，版本升级可能引入 manifest 变化 | 构建失败或 Store 上传被拒 | pin 住 electron-builder 版本（已在 package.json 锁定 25.1.7）；升级后重新跑一次 MSIX 构建验证 |
| `runFullTrust` capability 在 Store 审核时被要求额外说明 | 审核延迟 | Partner Center 提交时在 Notes 中说明 Electron 桌面壳需要完全信任权限来管理本地游戏库和文件系统 |
| MSIX 安装路径下 `app.getAppPath()` 行为与 NSIS 不一致 | 自建 updater 或其他模块的路径逻辑出错 | 本次仅在 updater.ts 入口检测，MSIX 环境下 updater 完全跳过；其他模块在 apply 阶段测试验证 |
| `minVersion` 设为 10.0.17763.0 意味着不支持 Win10 1809 之前的版本 | 极小（Win10 1809 是 2018 年发布） | 保持此值，Store 提交后根据实际兼容性数据再调整 |
| `toolsets.winCodeSign: "1.1.0"` 下载额外 SDK 工具 | 首次构建会慢一些、下载量约 50MB | 一次性下载，缓存到 electron-builder 的 toolsets 目录，后续构建复用 |

## Migration Plan

```
开发机上:
  1. npm install (如果加了 sharp 作为 devDependency)
  2. 生成 MSIX tile 图标 (build/appx/*.png)
  3. npm run build
     → 产出 NSIS .exe + MSIX .msix + .msixbundle + .msixupload
  4. 本地安装测试（开发者模式启用 + add-appxpackage）
  5. 启动 app，验证 MSIX 下 updater 自动跳过
  6. 在 Partner Center 上传 .msixupload
  7. Store 自动重签名 → 审核 → 上架

回滚:
  - MSIX 有问题不影响 NSIS 渠道，npm run build 始终同时产出两种格式
  - Partner Center 可以暂停 MSIX 分发，保留 Win32 入口
```

## Open Questions

- 无。所有技术决策已在 Decisions 中确定并写入。
