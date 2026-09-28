# Proposal

## Why

当前 SZGame 仅以 NSIS `.exe` 安装器形式发布到 Microsoft Store。审核失败报告（Policy 10.2.9）指出，所有 PE 文件必须由 Microsoft Trusted Root Program 中的 CA 签发的代码签名证书签名。项目无签名证书、NSIS 构建流程不包含签名步骤，短期内购置 OV/EV 证书成本高且无长期维护计划。

MSIX 是 Microsoft Store 官方推荐的上架路径：Store 在审核通过后自动用 Microsoft 证书重新签名 MSIX 包，开发者无需购买或管理代码签名证书，同时还能获得 Windows 10S 兼容性、包完整性校验等额外福利。

本次变更通过 electron-builder 的 MSIX target 同时产出 NSIS 和 MSIX 两种格式，解决 Store 上架卡壳问题，同时保持官网/Gitee 的 NSIS 分发渠道不受影响。

## What Changes

- **package.json** 新增 `msix` 构建配置块，包含 Partner Center 分配的包身份信息（identityName、publisher、publisherDisplayName、displayName、capabilities、minVersion、createMsixupload）
- **package.json** 的 `win.target` 从 `["nsis"]` 改为 `["nsis", "msix"]`，同时产出两种安装格式
- **package.json** 新增 `toolsets.winCodeSign: "1.1.0"`（MSIX 需要现代 Windows SDK 工具集）
- **build/appx/** 新建目录，放置 4 张 MSIX tile 图标资源（从 `images/logo.png` 按尺寸缩放生成）
- **electron/updater.ts** 的 `startAutoUpdateFlow` 新增 MSIX 环境检测：MSIX 安装由 Store 管更新，跳过自建 updater

**不涉及：**
- NSIS 构建流程完全不变，自建 updater 对 NSIS 用户继续正常工作
- 无新增 npm 依赖、无数据库变更、无前端 UI 变更

## Capabilities

> 本变更为纯工程配置变更，无业务能力新增或修改。`.openspec.yaml` 已设置 `skip_specs: true`，跳过 spec 制品生成。

## Impact

| 受影响文件 | 变更类型 |
|-----------|---------|
| `package.json` | 新增 `msix`、`toolsets` 配置块；修改 `win.target` |
| `build/appx/*.png` | **新增** 4 张 MSIX tile 图标（StoreLogo、Square44x44、Square150x150、Wide310x150） |
| `electron/updater.ts` | `startAutoUpdateFlow` 增加 MSIX 环境检测分支 |
| `openspec/changes/publish-msix-to-microsoft-store/*` | **新增** OpenSpec 变更制品 |

Partner Center 包身份信息（配置时固定值）：

| 字段 | 值 |
|------|---|
| identityName | `10DFD687.SZGame` |
| publisher | `CN=BDA47175-C8A4-48DB-A24B-A36B178DC7F8` |
| publisherDisplayName | `博学浮生` |
| Store ID | `9P69FQ3P1WLT` |

外部依赖：已检测到 Windows SDK 10.0.26100.0（含 makeappx.exe），electron-builder 25.1.7（支持 MSIX target），均满足构建要求。
