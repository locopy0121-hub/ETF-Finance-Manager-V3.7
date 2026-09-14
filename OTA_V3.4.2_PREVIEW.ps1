$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "V3.4.2 Preview OTA - runtime 3.4.2 only" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File .\CHECK_BEFORE_BUILD.ps1
if ($LASTEXITCODE -ne 0) { throw "Preflight failed" }
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) { & $eas.Source update --branch preview --environment preview --platform android --message "V3.4.2 issue1+2" } else { npx --yes eas-cli@23.2.0 update --branch preview --environment preview --platform android --message "V3.4.2 issue1+2" }
if ($LASTEXITCODE -ne 0) { throw "OTA failed" }
