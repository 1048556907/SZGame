# Tasks

## 1. Step 6 — electron-builder 命令显式化 (Design D1)

- [ ] 1.1 修改 `scripts/build.ps1` 第 66 行标题 `"electron-builder NSIS"` 为 `"electron-builder NSIS + AppX"`，验证标题反映双 target
- [ ] 1.2 修改第 68 行 `npx electron-builder --win` 为 `npx electron-builder --win nsis appx`，验证命令显式声明两种 target

## 2. Step 7 — AppX 产物验证 (Design D2)

- [ ] 2.1 在现有 NSIS 验证块之后追加 AppX 验证：`$appx = Get-ChildItem "release" -Filter "*.appx"` + `if (-not $appx) { Fail "No .appx found in release/" }`，验证 AppX 缺失时脚本 exit 1
- [ ] 2.2 AppX 找到后打印体积（MB）：`$mb = [math]::Round($appx.Length / 1MB, 2); Done "$($appx.Name)  ($mb MB)"`，验证输出与 NSIS 格式一致

## 3. 集成验证

- [ ] 3.1 完整运行 `.\scripts\build.ps1`，验证 Step 6 标题正确、release/ 下同时产出 `.exe` + `.appx`、两者体积都打印、脚本 exit 0
- [ ] 3.2 用 `openspec validate --all` 确认 change 有效无校验错误
- [ ] 3.3 创建 Git commit 并推送，message 描述 build.ps1 AppX 适配
