$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "V3.5.0 Preview OTA - runtime 3.5.0 only" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File .\CHECK_BEFORE_BUILD.ps1
if ($LASTEXITCODE -ne 0) { throw "Preflight failed" }
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) { & $eas.Source update --branch preview --environment preview --platform android --message "V3.5.0 compatible JS/UI update" } else { npx --yes eas-cli@23.2.0 update --branch preview --environment preview --platform android --message "V3.5.0 compatible JS/UI update" }
if ($LASTEXITCODE -ne 0) { throw "OTA failed" }
