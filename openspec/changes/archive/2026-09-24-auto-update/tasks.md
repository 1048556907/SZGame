# Tasks

## 1. 基础设施准备

- [x] 1.1 `db.ts` DEFAULT_SETTINGS_SQL 追加两个默认 setting key：`app.update.auto.check = 'true'` 和 `app.update.force = 'false'`；验证：initDatabase 首次启动后查询 settings 表能看到这两行
- [x] 1.2 `types/index.ts` 扩展 `electronAPI` 类型声明，新增 updaterCheck / updaterInstall / onUpdateAvailable / onUpdateProgress 方法签名；验证：TypeScript 编译通过无类型错误
- [x] 1.3 `types/index.ts` 的 `AppSettings` 接口新增 `update_auto_check` 和 `update_force` 字段；验证：TypeScript 编译通过无类型错误

## 2. 核心更新模块 `electron/updater.ts`

- [x] 2.1 实现 semver 比较函数 `compareVersions(a, b)`：按 `.` 分割后逐段数字比较，返回 -1/0/1；验证：手动测试多组版本对（0.1.1 vs 0.2.0, 1.0.0 vs 1.0.0, 1.0.0 vs 0.9.9）
- [x] 2.2 实现 `fetchReleasesFromGitee()`：Node https GET `https://gitee.com/api/v5/repos/sinszer/SZGame/releases`，返回 JSON；验证：dev 模式下调用能拿到 releases 数组（或 mock 测试）
- [x] 2.3 实现 `findLatestSemverTag(releases)`：过滤 prerelease=true 的 release，从 tag_name 解析版本号，取 semver 最高的那个；验证：给定含多个 tag 的数组返回正确结果
- [x] 2.4 实现 `checkForUpdate()`：串联 fetch → findLatest → compare，返回 `{ hasUpdate, remoteTag?, localVersion }`；验证：mock releases 返回值下三种场景（有新版本 / 已是最新 / 网络失败）都走对分支
- [x] 2.5 实现 `download(url, dest, onProgress)`：https GET → 读取 Content-Length → createWriteStream → pipe → 按下载字节数推送进度回调 → 完成后校验文件大小；验证：小文件下载能写入磁盘，进度回调正确触发
- [x] 2.6 实现 `install(exePath)`：spawn NSIS exe 传 `['/S']` 参数；验证：spawn 参数正确

## 3. 主进程与 IPC 集成

- [x] 3.1 `main.ts` 引入 `updater.ts`，注册两个 IPC handler：`updater:check`（手动检查）和 `updater:install`（触发安装链）；验证：preload invoke 这两个通道能正确返回
- [x] 3.2 `main.ts` 在 app.whenReady() 末尾加自动检查逻辑：`if (!app.isPackaged) return` → 读 `app.update.auto.check` → 调 `startAutoUpdateFlow()`；验证：dev 模式启动无更新检查输出，packaged 模式启动有 API 调用日志
- [x] 3.3 `preload.ts` contextBridge 暴露 updaterCheck / updaterInstall / onUpdateAvailable / onUpdateProgress 四个接口；验证：渲染进程能正确 invoke 和订阅

## 4. 渲染进程更新 UI

- [x] 4.1 新建 `src/components/UpdateDialog.tsx`：极简弹窗，显示"当前 vX.X.X → 最新 vY.Y.Y"，两个按钮"立即更新 / 稍后再说"；验证：组件可独立渲染无报错
- [x] 4.2 `Settings.tsx` 加"自动更新"设置区块：两个开关（启用自动检查 / 强制更新）+ 一个检查更新按钮；验证：Settings 页面加载后新区块可见，开关切换能持久化到 DB
- [x] 4.3 `App.tsx` 订阅 main 进程的 `update:available` 事件 → 弹出 UpdateDialog；订阅 `update:progress` 事件 → 将进度传给 UpdateDialog；验证：手动点检查更新按钮能触发 UpdateDialog 弹出

## 5. 强制更新全自动链路

- [x] 5.1 main 进程实现强制更新链：检测到新版本 → auto.check=true 且 force=true → download 到 tmp → 下载完成 → spawn NSIS /S → app.quit()；验证：构造 force=true 场景能看到下载→退出→NSIS 覆盖→重启的完整链
- [x] 5.2 验证 NSIS `/S` 参数 + electron-builder 默认配置下安装完成自动拉起 App；验证：覆盖安装后 App 自动打开回到主界面（依赖 electron-builder 默认 NSIS runAfterFinish=true 行为）

## 6. 错误处理与边界

- [x] 6.1 下载过程中网络异常：捕获 error → 清理临时文件 → 通知 Renderer 下载失败；验证：断网或 URL 错误时不崩溃，展示 Toast 提示
- [x] 6.2 Gitee API 返回非 2xx（如 404、限流 429）：静默跳过不打扰用户；验证：模拟 API 失败后应用正常启动完成
- [x] 6.3 release assets 里没有 .exe 文件：视为无可下载更新 → 静默跳过；验证：mock release 只有 .zip/.tar.gz 时不触发下载

## 7. 端到端验证

- [ ] 7.1 完整手动更新流程验证：packaged 模式启动 → 检查更新 → 弹窗 → 点立即更新 → 下载进度条 → 退出 → NSIS 静默覆盖 → 自动重启 → 版本号更新 （需要 Gitee 上有高于当前版本的 release 才能完整验证）
- [ ] 7.2 完整强制更新流程验证：开启强制更新开关 → packaged 模式启动 → 自动检测 → 自动下载 → 自动退出 → NSIS 静默覆盖 → 自动重启 → 版本号更新；全程无弹窗 （同上）
- [ ] 7.3 非更新场景验证：已是最新版本启动 → 静默通过；dev 模式启动 → 完全跳过检查；关闭自动检查开关启动 → 跳过检查
- [ ] 7.4 设置持久化验证：修改两个更新开关 → 关闭 App → 重新启动 → 设置保持正确
- [x] 7.5 npm run build 构建通过 → 生成的 NSIS 安装包功能正常
