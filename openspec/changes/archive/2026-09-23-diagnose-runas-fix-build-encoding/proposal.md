# Proposal

## Why

用户反馈前两次修改（RunAs 编码修复 + DATA_DIR 赋值）**均未达到预期** —— "以管理员身份运行"开关打开后启动游戏依然不弹 UAC。另外 `scripts/build.ps1` 在命令行构建时中文输出乱码。

两次修改**代码层面已验证正确**（win-unpacked 版启动后 portable DB 9.9MB、schema version 2、needs_admin 列存在），但**用户实际运行场景仍未生效**。需要系统性诊断用户实际安装的 exe 版本、DB 位置、needs_admin 勾选状态、启动流程的每个环节，找出断点。

同时 PowerShell 5.1 默认代码页 cp 936 (GBK)，`build.ps1` 保存为 UTF-8 无 BOM，被 GBK 错误解码导致 Write-Host 里的中文（标题/错误消息/emoji 前缀）显示乱码。

## What Changes

### 诊断优先级（第一阶段 —— 必做）
- **用户实际跑的 exe 版本**：是旧 APPDATA 版还是新便携版？便携目录在哪里？
- **needs_admin 列是否存在** + **用户是否真的在新版里勾选过开关**（迁移列默认值 0）
- **启动日志追踪**：启动游戏时 main.ts launcher handler 里的 needsAdmin 实际值、launcher.ts 里 spawnRunAs 是否被调用、PowerShell exit code
- **确认用户使用的是哪个 exe**：win-unpacked/（开发目录）、NSIS 安装版（%LOCALAPPDATA%/Programs/SZGame/）、还是 APPDATA 旧版？

### 修复项
- **build.ps1 中文乱码**：脚本开头加 `chcp 65001 > $null` + `[Console]::OutputEncoding = [Text.Encoding]::UTF8`
- **RunAs 端到端修复**：基于诊断结果，修复剩余断点（可能是用户勾选保存流程、可能是 exe 位置差异、可能是其他问题）
- **db.ts needs_admin 默认值**：迁移时如果该列全是 0，可以在前端给用户一个"批量标记管理员游戏"的引导（如果诊断发现用户确实勾选过但没保存）

### 修改文件
| 文件 | 改动类型 |
|------|---------|
| `scripts/build.ps1` | 修复中文乱码（编码声明） |
| `electron/launcher.ts` / `db.ts` / `main.ts` | 基于诊断结果的 RunAs 二次修复 |
| 诊断脚本（临时） | 读取用户实际 DB + 版本号 |

## Capabilities

### New Capabilities

（`skip_specs: true` —— bug fix + 工具脚本修复，不引入新行为规格）

### Modified Capabilities

无

## Impact

- **向后兼容**：不改变 DB schema，不引入 breaking change
- **构建流程**：build.ps1 修复后 PowerShell 5.1/7 都能正常显示中文
- **数据安全**：不移动/覆盖用户数据，诊断只读
