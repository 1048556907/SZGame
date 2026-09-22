# SZGame 生产构建脚本
# 用法: .\scripts\build.ps1
# 需要: Node.js + npm / PowerShell 7

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Step($title) {
  Write-Host ""
  Write-Host "==== $title ====" -ForegroundColor Cyan
}

function Done($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  ❌ $msg" -ForegroundColor Red; exit 1 }

# ── 1. 杀进程 ──────────────────────────────────────────────────
Step "Kill Electron/SZGame processes"
$procs = Get-Process | Where-Object {
  $_.ProcessName -like "*SZGame*" -or
  ($_.ProcessName -like "*electron*" -and $_.Path -like "*SZGame*")
}
if ($procs) {
  $procs | Stop-Process -Force
  Start-Sleep -Milliseconds 500
  Done "Killed $($procs.Count) process(es)"
} else {
  Done "No running Electron/SZGame process"
}

# ── 2. 清理 ──────────────────────────────────────────────────────
Step "Clean artifacts"
foreach ($dir in @("dist", "dist-electron", "release")) {
  if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
}
Done "Cleaned dist, dist-electron, release"

# ── 3. TypeScript 类型检查 ──────────────────────────────────────
Step "TypeScript type check"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { Fail "tsc failed" }
Done "tsc: 0 errors"

# ── 4. Vite 构建 ─────────────────────────────────────────────────
Step "Vite build"
npx vite build
if ($LASTEXITCODE -ne 0) { Fail "vite build failed" }
Done "vite build ok"

# ── 5. electron-builder ──────────────────────────────────────────
Step "electron-builder NSIS"
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { Fail "electron-builder failed" }
Done "electron-builder ok"

# ── 6. 产物校验 ──────────────────────────────────────────────────
Step "Artifacts"
$setup = Get-ChildItem "release" -Filter "*.exe" | Where-Object { $_.Name -notlike "__uninstaller*" }
if (-not $setup) { Fail "No .exe found in release/" }
$setup | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 2)
  Done "$($_.Name)  ($mb MB)"
}

Write-Host ""
Write-Host "🎉 Build complete!" -ForegroundColor Yellow
