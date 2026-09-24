# Tasks

## 1. build.ps1 新增版本自增步骤

- [x] 1.1 在 build.ps1 Step 2 "Clean artifacts" 之后、Step 3 "TypeScript type check" 之前插入 Step "Bump version"：读取当前 version → `npm version patch --no-git-tag-version` → 打印 old → new — 已实现；npm version patch 单独测试通过（0.1.0→0.1.1，exit code 0）
- [x] 1.2 bump 失败时 fail fast（npm exit code ≠ 0 → Fail 退出），不让后续步骤在错误版本上继续 — 已实现；`if ($LASTEXITCODE -ne 0) { Fail "npm version patch failed" }`

## 2. 验证

- [ ] 2.1 完整跑一次 build.ps1，确认：(a) bump 日志输出 old→new (b) package.json version 已自增 (c) release/ 下的 NSIS exe 文件名含新版本号 (d) git diff 里 package.json 只有 version 字段变化 — 待用户执行 `.\scripts\build.ps1`
