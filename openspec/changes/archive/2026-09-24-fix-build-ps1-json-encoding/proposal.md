# Proposal

## Why

`scripts/build.ps1` 第 47、50 行使用 `Get-Content "package.json" | ConvertFrom-Json` 读取版本号。脚本开头虽然设置了 `[Console]::OutputEncoding` 和 `chcp 65001`，但这些只影响控制台输出编码，不影响 `Get-Content` 读取文件时使用的编码。PowerShell 5.1 的 `Get-Content` 默认使用系统 legacy 编码（中文 Windows 为 CP 936 / GBK），而 `package.json` 是 UTF-8 编码，中文字段（description）被损坏后 `ConvertFrom-Json` 解析失败，导致构建脚本中断。

## What Changes

修复 `scripts/build.ps1` 中两处 `Get-Content "package.json"` 调用，显式指定 UTF-8 编码读取。

## Capabilities

### New Capabilities

无。纯工具脚本修复，不引入新的业务 capability。

### Modified Capabilities

无。不改变任何已定义 capability 的外部行为。
