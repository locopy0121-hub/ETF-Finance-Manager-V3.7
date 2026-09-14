$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "ETF Finance Manager V3.4.2 - Issue 1+2 FINAL APK" -ForegroundColor Cyan
if (-not (Test-Path ".\node_modules\.bin\expo.cmd")) {
  Write-Host "[1/4] npm install" -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else { Write-Host "[1/4] node_modules ready" -ForegroundColor DarkGray }
Write-Host "[2/4] Final preflight" -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File .\CHECK_BEFORE_BUILD.ps1
if ($LASTEXITCODE -ne 0) { throw "Preflight failed" }
Write-Host "[3/4] Expo dependency check" -ForegroundColor Yellow
.\node_modules\.bin\expo.cmd install --check
if ($LASTEXITCODE -ne 0) { throw "expo install --check failed" }
Write-Host "[4/4] EAS preview APK build" -ForegroundColor Yellow
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) { & $eas.Source build -p android --profile preview } else { npx --yes eas-cli@23.2.0 build -p android --profile preview }
if ($LASTEXITCODE -ne 0) { throw "EAS APK build failed" }
Write-Host "V3.4.2 APK build submitted/completed." -ForegroundColor Green
