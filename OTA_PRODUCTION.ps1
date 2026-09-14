param([string]$Message = "V3.4.1 COMPLETE 1-10 FINAL Production OTA")
$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "Production OTA requires a V3.4.1 runtime APK/App baseline." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "CHECK_BEFORE_BUILD.ps1")
if ($LASTEXITCODE -ne 0) { throw "Preflight failed; Production OTA aborted" }
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($null -ne $eas) {
  & $eas.Source update --branch production --environment production --platform android --message $Message
} else {
  npx --yes eas-cli@23.2.0 update --branch production --environment production --platform android --message $Message
}
if ($LASTEXITCODE -ne 0) { throw "Production OTA publish failed" }
Write-Host "V3.4.1 production OTA published." -ForegroundColor Green
