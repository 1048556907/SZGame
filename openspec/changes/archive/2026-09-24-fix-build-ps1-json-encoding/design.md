# Design

## Context

`scripts/build.ps1:47,50` 读取 `package.json` 时使用 `Get-Content` 默认编码。PowerShell 5.1 在中文 Windows 上默认 CP 936（GBK），而文件是 UTF-8，导致中文字段损坏、`ConvertFrom-Json` 失败。

## Goals

- 修复两处 `Get-Content` 调用，使用 UTF-8 编码读取 `package.json`
- 保持脚本其他部分不变

## Non-Goals

- 不升级到 PowerShell 7（自带 `-Encoding utf8` 默认值不同）
- 不重构构建脚本的版本 bump 流程（仍然用 npm version）

## Decision

**用 `Get-Content -Encoding utf8` 显式指定编码**

PowerShell 5.1 的 `-Encoding utf8` 使用 BOM 模式读取，能正确识别 UTF-8 无 BOM 文件（`package.json` 通常是无 BOM UTF-8）。

两个调用点：
```powershell
# 旧（损坏）
Get-Content "package.json" | ConvertFrom-Json

# 新（修复）
Get-Content "package.json" -Encoding utf8 | ConvertFrom-Json
```

## Risks / Trade-offs

- PowerShell 5.1 的 `Encoding utf8` 语义是 "UTF-8 with BOM"，但实际读取时无论文件有无 BOM 都能正确解码，无风险
- 更彻底的替代方案：`[System.IO.File]::ReadAllText("package.json", [System.Text.Encoding]::UTF8)` 不依赖 PowerShell 编码层，但更冗长且风格上偏离脚本现有代码

## Migration Plan

1. 修改 `scripts/build.ps1` 第 47、50 行，加 `-Encoding utf8`
2. 本地执行 `.\scripts\build.ps1` 验证不再报 `ConvertFrom-Json` 异常
3. 重新打开后能看到正确版本号
