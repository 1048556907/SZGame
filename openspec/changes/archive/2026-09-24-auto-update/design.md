# Design

## Context

SZGame 是一个 Electron + React 桌面应用，SQLite (sql.js) 存储设置。版本号来自 `package.json`，构建产物为 electron-builder 的 NSIS 安装包，发布到 Gitee Releases。现有无任何更新机制。settings 表使用简单 key/value 结构存储配置项。

## Goals / Non-Goals

**Goals:**
- 应用启动后自动检测 Gitee Releases 上是否有更高 semver tag
- 支持两种更新模式：用户手动确认（默认）和全自动强制更新
- 下载完整 NSIS .exe 到临时目录，用 `/S` 静默参数覆盖安装
- 安装完成后自动重启 App
- 全程零新 npm 依赖（用 Node 原生 https + fs 实现）

**Non-Goals:**
- 增量更新 / diff 包
- 签名校验
- 更新渠道（stable/beta/canary）预留但本期不实现
- electron-updater 或 electron-dl 集成
- 版本回滚

## Decisions

### D1: 自实现 vs electron-updater

**选择：自实现**

理由：
- 发布源是 Gitee Releases，electron-updater 的 Gitee 支持不是一等公民，需要额外配置 latest.yml 元数据文件
- URL 格式非常固定（`...releases/download/{tag}/SZGame%20Setup%20{tag}.exe`），自己拼完全可控
- 目标是零新依赖，自实现用 Node 原生 `https` + `fs.createWriteStream` 完全够用
- 下载 + spawn NSIS `/S` 的流程链很短

备选方案：electron-updater —— 成熟但引入额外依赖，且需要为 Gitee 配置非标准元数据，维护成本高。

### D2: 版本检测逻辑

遍历 Gitee Releases API 返回的全部 release，跳过 `prerelease: true` 的条目，从每个 `tag_name` 中解析语义化版本号，取最高值。使用简单的 `major.minor.patch` 数字比较（按点分割后逐段比较），不引入 semver 库。

备选方案：只看 API 返回列表的第一个（最新创建）—— 风险是 tag 创建时间不一定和版本号一致。

### D3: 下载源确认

Gitee Releases API 返回的 `assets[]` 里直接有 `.exe` 的 `browser_download_url`，直接从中匹配文件后缀为 `.exe` 的那个。不额外发 HEAD 请求探测 URL 是否 404。

### D4: 强制更新时 NSIS 覆盖后重启

NSIS 默认行为：覆盖安装完成后会自动拉起安装后的可执行文件。但需确认 electron-builder 生成的 NSIS 是否正确设置了 `runAfterFinish`。

**mitigation**：若 NSIS 不自动重启，spawn 时额外传参数让安装完后由外部 PowerShell 监控进程退出再拉起。但优先依赖 NSIS 默认行为。

### D5: 下载临时目录

使用 `os.tmpdir()` 作为下载路径（Windows 下为 `%TEMP%`）。文件名为 `SZGame-{version}.exe`。安装完成后文件留在临时目录，下次系统清理自然删除。

### D6: IPC 通道设计

```
主进程 → 渲染进程（事件）：
  update:available    { remoteTag: "0.2.0" }     // 发现新版本，等用户抉择（非强制）
  update:progress     { bytes, total }           // 下载进度
  update:installed     null                      // 强制更新安装完成前通知（即将退出）

渲染进程 → 主进程（invoke）：
  updater:check       () → { hasUpdate, remoteTag, localVersion }   // 手动检查
  updater:install      () → 触发强制更新下载+安装链
```

### D7: 设置 key

```
app.update.auto.check = "true"     // 是否启用启动时自动检查
app.update.force      = "false"    // 是否强制更新
```

DEFAULT_SETTINGS_SQL 追加 INSERT OR IGNORE。

## Risks / Trade-offs

**R1: NSIS 静默安装时旧进程文件被占用**
→ NSIS `/S` 参数会自动处理被占用的文件（标记重启后替换），不需要手动 unlock。但保险起见仍建议先 quit 再 spawn 安装。

**R2: Gitee API 限流**
→ 只在启动时调用一次，对个人发布仓库完全没压力。但如果用户网络异常导致每次启动都重试，可考虑加重试间隔（本期不加，静默失败即可）。

**R3: 下载大文件占用内存**
→ 使用流式写入 `fs.createWriteStream`，全程内存友好。

**R4: 强制更新下载中途断电/崩溃**
→ 下次启动 Gitee release tag 未变，会重新下载整个 .exe。无断点续传，但个人用户网络场景下全量下载可接受。

**R5: dev 模式下误触发生产环境 API**
→ 在所有更新逻辑入口加 `if (!app.isPackaged) return` 守卫。

## Module Design

```
electron/updater.ts
  ├─ checkForUpdate(): Promise<{ hasUpdate: boolean; remoteTag?: string; localVersion: string }>
  │    ├─ fetchReleasesFromGitee()
  │    ├─ findLatestSemverTag(releases)
  │    └─ compare(remoteTag, localVersion)
  │
  ├─ download(url, dest, onProgress): Promise<string>
  │    └─ https.get → createWriteStream → pipe → 校验文件大小
  │
  ├─ install(exePath): Promise<void>
  │    └─ spawn(exePath, ['/S'])   (NSIS 静默安装)
  │
  └─ startAutoUpdateFlow(): Promise<void>
       ├─ checkForUpdate()
       ├─ 查 DB app.update.force
       ├─ force=true → download → install → app.quit()
       └─ force=false → mainWindow.webContents.send('update:available', {remoteTag})

electron/main.ts (diff)
  ├─ import { startAutoUpdateFlow } from './updater'
  ├─ app.whenReady() 末尾加 await startAutoUpdateFlow()（isPackaged 守卫）
  ├─ ipcMain.handle('updater:check', ...)
  └─ ipcMain.handle('updater:install', ...)

electron/preload.ts (diff)
  ├─ updaterCheck: () => ipcRenderer.invoke('updater:check')
  ├─ updaterInstall: () => ipcRenderer.invoke('updater:install')
  └─ onUpdateAvailable: (cb) => { ... on 'update:available' ... }

src/components/UpdateDialog.tsx (new)
  └─ 极简弹窗：当前版本 → 最新版本，立即更新 / 稍后再说

src/components/Settings.tsx (diff)
  └─ 加"自动更新"区块（2 开关 + 手动按钮）

src/App.tsx (diff)
  └─ 订阅 update:available → 弹 UpdateDialog
```
