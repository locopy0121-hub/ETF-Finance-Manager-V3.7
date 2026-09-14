$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "V3.5.1 Preview OTA - UI + Portfolio + Research enhancement" -ForegroundColor Cyan
Write-Host "Requires V3.5.0 FIX1 APK / runtime 3.5.0" -ForegroundColor DarkCyan
if (-not (Test-Path .\node_modules)) { npm install }
powershell -ExecutionPolicy Bypass -File .\CHECK_BEFORE_OTA_V3.5.1.ps1
if ($LASTEXITCODE -ne 0) { throw "Preflight failed" }
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) { & $eas.Source update --branch preview --environment preview --platform android --message "V3.5.1 OTA settings + portfolio + ETF research enhancement" } else { npx --yes eas-cli@23.2.0 update --branch preview --environment preview --platform android --message "V3.5.1 OTA settings + portfolio + ETF research enhancement" }
if ($LASTEXITCODE -ne 0) { throw "OTA failed" }
