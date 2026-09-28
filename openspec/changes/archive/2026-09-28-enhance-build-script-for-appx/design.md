# Design

## Context

See proposal.md — Why。约束：

- `scripts/build.ps1` 是当前 CI/CD（Gitee Actions）和本地发布流程的唯一入口
- package.json 的 `build.win.target` 已设为 `["nsis", "appx"]`，`npx electron-builder --win` 会自动同时构建两种格式
- AppX 产物命名由 `build.appx.artifactName: "SZGame-${version}.${ext}"` 控制，产出为 `SZGame-X.Y.Z.appx`
- NSIS 产物命名为 `SZGame Setup X.Y.Z.exe`（含空格，需 -like 通配）

## Goals / Non-Goals

**Goals:**
- build.ps1 显式声明构建两种 target，不再依赖 package.json 的隐式默认
- 产物验证 fail-fast：NSIS 或 AppX 任一缺失 → 脚本 exit 1
- 两种产物都打印文件名 + 体积（MB）

**Non-Goals:**
- 不修改 package.json（build 配置已就绪）
- 不新增参数开关（不需要单独构建某一种格式的场景）
- 不签名 AppX（Store 自动重签名，本地构建不需要）
- 不输出到不同目录（都在 `release/` 根下）

## Decisions

**D1: Step 6 命令改显式 target 列表**

`npx electron-builder --win nsis appx` 替代 `npx electron-builder --win`。

Rationale: 当前 `--win` 虽然能工作，但依赖 package.json 的 target 配置。显式声明让脚本意图自文档化，避免未来有人改了 package.json target 列表但忘了同步脚本。

Alternatives considered:
- 保持 `--win` 不变：隐式依赖好是坏？好（DRY）也是坏（脚本不自解释）。选择显式。

**D2: Step 7 产物验证分两阶段**

```
Phase 1: NSIS 验证（Get-ChildItem -Filter *.exe | Where-Object Name -notlike "__uninstaller*"）
Phase 2: AppX 验证（Get-ChildItem -Filter *.appx）
任一为空 → Fail() → exit 1
```

Rationale: 用两个独立变量分别存路径，各自校验，避免 NSIS 找到但 AppX 没找到时脚本"假成功"。

## Risks / Trade-offs

- [AppX 体积异常大（>200MB）] → 不自动拦截，仅打印体积供人肉判断。误报比漏报更糟。
- [未来 electron-builder 新增 msix target] → 那时再加 msix 验证点。当前只处理 appx。
