# Proposal

## Why

package.json 的 `win.target` 已从 `["nsis"]` 改为 `["nsis", "appx"]`（change publish-msix-to-microsoft-store），`scripts/build.ps1` 需要适配：Step 6 构建命令、Step 2 清理逻辑、Step 7 产物验证都只覆盖 NSIS。现在脚本宣称"成功"但实际上 AppX 可能缺失，没有 fail-fast 保护。

## What Changes

- Step 6 electron-builder 命令显式指定 `--win nsis appx`（当前 `--win` 虽然也能工作，但显式声明更清晰）
- Step 7 产物验证增加 `.appx` 检查，AppX 缺失时和 NSIS 缺失同等处理（fail-fast）
- Step 2 Clean 不变（`release` 目录整体删除已覆盖）
- 构建输出中增加 AppX 体积展示，便于一眼确认产物大小合理

## Capabilities

无运行时行为变化，`skip_specs: true`。

## Impact

- 受影响文件：`scripts/build.ps1`（单文件修改）
- 不影响运行时代码、不影响 NSIS 构建行为、不影响 updater 逻辑
- 零依赖升级（electron-builder 26.17.0 已在前序 change 中升级）
