# Spec Delta

## Purpose

应用自动更新能力——检测 Gitee Releases 上是否存在比当前版本更高的 semver tag，下载对应的 NSIS 安装包，支持用户手动确认更新或全自动强制更新，并在安装完成后自动重新拉起应用。

## ADDED Requirements

### Requirement: 启动时自动检查新版本

生产环境下应用启动后 SHALL 自动向 Gitee Releases API 发起版本检测请求。应用 SHALL 遍历所有非 prerelease 的 release，取 semver 版本号最高的 tag 作为最新远端版本。若远端版本号大于本地版本号，SHALL 进入更新流程；若远端版本号不高于本地版本号或检测失败（网络异常、API 错误），SHALL 静默跳过，不打扰用户。开发环境（非 packaged）SHALL 完全跳过自动检查。

#### Scenario: 启动时有新版本

- **WHEN** 用户启动应用，Gitee Releases API 返回存在 tag 高于本地版本（如本地 v0.1.1，远端 v0.2.0），且远端 release 的 assets 中存在 .exe 文件
- **THEN** 应用 SHALL 识别出有更新可用，并根据强制更新设置决定后续行为

#### Scenario: 启动时已是最新版本

- **WHEN** 用户启动应用，Gitee Releases API 返回的所有 release tag 均不高于本地版本号
- **THEN** 应用 SHALL 静默完成启动，不展示任何更新提示

#### Scenario: 启动时检测网络异常

- **WHEN** 用户启动应用，请求 Gitee Releases API 超时或返回非 2xx 状态码
- **THEN** 应用 SHALL 静默跳过更新检查，不展示任何错误提示，正常完成启动流程

#### Scenario: 远端 release 没有 .exe 资源

- **WHEN** 用户启动应用，Gitee Releases API 返回了更高版本的 release，但该 release 的 assets 列表中没有 .exe 文件
- **THEN** 应用 SHALL 视为无可下载更新，静默跳过

#### Scenario: 开发环境跳过自动检查

- **WHEN** 应用以非 packaged 模式运行（dev 模式）
- **THEN** 应用 SHALL 完全跳过启动时的更新检查

### Requirement: 非强制更新的用户提示

当检测到新版本且强制更新开关为关闭时，应用 SHALL 通过 IPC 事件通知渲染进程。渲染进程 SHALL 展示极简更新提示弹窗，显示当前版本号和最新版本号，不展示 release 说明。弹窗 SHALL 提供"立即更新"和"稍后再说"两个操作。

#### Scenario: 弹出更新提示

- **WHEN** 应用检测到新版本且强制更新开关关闭
- **THEN** 渲染进程 SHALL 弹出提示，内容包含当前版本号和最新版本号（格式：当前 v0.1.1 → 最新 v0.2.0），以及"立即更新""稍后再说"两个按钮

#### Scenario: 用户选择稍后再说

- **WHEN** 用户在更新提示弹窗中点击"稍后再说"
- **THEN** 弹窗 SHALL 关闭，本次更新流程终止。本次会话内不再重复弹出提示

#### Scenario: 用户选择立即更新

- **WHEN** 用户在更新提示弹窗中点击"立即更新"
- **THEN** 应用 SHALL 进入下载流程，弹窗切换为下载进度展示状态

### Requirement: 强制更新模式

当强制更新开关开启时，应用启动检测到新版本后 SHALL 自动触发下载，无需用户交互。下载完成后 SHALL 自动退出应用、运行 NSIS 静默安装（`/S` 参数）。安装完成后 NSIS SHALL 自动重新拉起应用。

#### Scenario: 强制更新全自动流程

- **WHEN** 应用启动检测到新版本且强制更新开关开启
- **THEN** 应用 SHALL 自动开始下载 .exe 安装包到临时目录，下载完成后自动退出，运行 NSIS 静默安装，安装完成后自动重新启动应用

#### Scenario: 强制更新下载失败

- **WHEN** 强制更新下载过程中网络中断或写入失败
- **THEN** 应用 SHALL 保留在当前版本继续运行，展示下载失败提示（Toast），且 SHALL NOT 反复重试

### Requirement: 更新包下载

应用 SHALL 使用 HTTP 流式下载 NSIS 安装包到系统临时目录（`os.tmpdir()`）。下载过程中 SHALL 通过 IPC 事件向渲染进程推送下载进度（已下载字节数 / 总字节数）。下载完成后 SHALL 校验文件大小是否与 `Content-Length` 一致。

#### Scenario: 下载成功

- **WHEN** 应用开始下载更新包，网络正常
- **THEN** 下载过程中 SHALL 持续推送进度事件，下载完成后文件完整写入临时目录，文件大小与远端 Content-Length 一致

#### Scenario: 下载进度推送

- **WHEN** 应用正在下载更新包
- **THEN** 渲染进程 SHALL 能通过订阅进度事件实时更新进度条显示

### Requirement: 手动检查更新

用户在设置页面点击"检查更新"按钮时，应用 SHALL 立即执行一次版本检测。若有新版本，SHALL 走非强制更新的提示弹窗流程；若无新版本，SHALL 展示 Toast 提示"当前已是最新版本"。手动检查 SHALL 不受自动检查开关限制（始终可执行），但 SHALL 遵守强制更新开关的后续行为。

#### Scenario: 手动检查有新版本

- **WHEN** 用户在设置页点击"检查更新"，且远端有更高版本
- **THEN** SHALL 弹出非强制更新提示弹窗

#### Scenario: 手动检查已是最新

- **WHEN** 用户在设置页点击"检查更新"，且远端版本不高于本地
- **THEN** SHALL 展示 Toast 提示"当前已是最新版本"

#### Scenario: 手动检查时强制更新已开启

- **WHEN** 用户在设置页点击"检查更新"，远端有新版本，且强制更新开关已开启
- **THEN** SHALL 直接进入强制更新下载流程，不弹提示窗

### Requirement: 安装完成后自动重启

NSIS 静默安装完成后 SHALL 自动重新拉起 SZGame 应用，用户回到应用主界面。

#### Scenario: 安装后自动重启

- **WHEN** NSIS 静默安装完成
- **THEN** SZGame SHALL 自动重新启动，无需用户手动点击快捷方式
