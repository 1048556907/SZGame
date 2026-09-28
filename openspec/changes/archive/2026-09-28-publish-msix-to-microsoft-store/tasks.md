# Tasks

> ⚠️ **关键修正：** electron-builder v25/v26 只支持 `appx` target，无顶层 `msix` 键。
> electron.build/docs 超前于 npm 发布。AppX 和 MSIX 共享 makeappx.exe 底层打包工具，
> Microsoft Store 仍接受 `.appx` 格式上传。配置已从 `msix` 调整为 `appx`。

## 1. package.json AppX 构建配置

- [x] 1.1 修改 `build.win.target` 从 `["nsis"]` 改为 `["nsis", "appx"]`；v26.17.0 构建验证两种 target 都产出
- [x] 1.2 保留 legacy `toolsets.winCodeSign: "0.0.0"`（v26 默认值），winCodeSign 2.6.0 工具集已在缓存中可用
- [x] 1.3 在顶层 `build` 下新增 `appx` 配置块，包含 Partner Center 身份：identityName=`10DFD687.SZGame`、publisher=`CN=BDA47175-C8A4-48DB-A24B-A36B178DC7F8`、publisherDisplayName=`博学浮生`、displayName=`SZGame`、capabilities=`["runFullTrust"]`、minVersion=`10.0.17763.0`、artifactName=`SZGame-${version}.${ext}`

## 2. AppX Tile 图标资源

- [x] 2.1 创建 `build/appx/` 目录，确认目录存在
- [x] 2.2 用 PowerShell System.Drawing 从 `images/logo.png` 生成 4 张 tile 图标：StoreLogo.png 50×50、Square44x44Logo.png 44×44、Square150x150Logo.png 150×150、Wide310x150Logo.png 310×150；验证 4 个文件非零字节
- [x] 2.3 AppX 构建 manifest 验证：makeappx unpack 解包后 AppxManifest.xml 中 Properties.Logo、VisualElements 图标路径全部指向 build/appx/ 下的自定义图标，无默认占位图标

## 3. AppX 环境检测 — updater.ts 适配

- [x] 3.1 在 `electron/updater.ts` 中新增 `isMsixInstalled()` 辅助函数：读取 `app.getAppPath()/../Package.appxmanifest` 是否存在来判断（AppX 包也使用此文件名）；非 packaged 模式返回 false
- [x] 3.2 在 `startAutoUpdateFlow` 的 `if (!app.isPackaged) return` 之后追加 `if (isMsixInstalled()) { console.info('[updater] MSIX/AppX installation detected, skipping self-update'); return }` 分支；TypeScript 编译零错误

## 4. 构建验证与集成检查

- [x] 4.1 运行完整构建：NSIS `.exe`（93MB）+ AppX `.appx`（128MB）全部成功产出至 `release2/`（旧 release 目录文件锁问题，换输出目录绕过）
- [x] 4.2 AppX manifest 精确验证：Identity Name=`10DFD687.SZGame` ✅、Publisher=`CN=BDA47175-C8A4-48DB-A24B-A36B178DC7F8` ✅、Properties.PublisherDisplayName=`博学浮生` ✅、Capabilities 含 `runFullTrust` ✅、MinVersion=`10.0.17763.0` ✅
- [x] 4.3 运行 `openspec validate --all` 确认所有 spec 和 change 状态有效，无校验错误（6 项全绿，change/publish-msix-to-microsoft-store 通过）
- [x] 4.4 创建 Git commit：45b7755 `build: add AppX target for Microsoft Store compatibility`，11 files changed，推送至 origin/main
