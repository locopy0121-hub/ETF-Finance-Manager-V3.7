$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Set-Location -LiteralPath $PSScriptRoot
Write-Host "ETF Finance Manager V3.6.0 - Preview OTA" -ForegroundColor Cyan
Write-Host "Use this ONLY after a V3.6.0 runtime APK is installed." -ForegroundColor Yellow

$app = Get-Content -LiteralPath (Join-Path $PSScriptRoot "app.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if ($app.expo.runtimeVersion -ne "3.6.0") { throw "runtimeVersion must stay 3.6.0 for this OTA" }
npm run check:v360
if ($LASTEXITCODE -ne 0) { throw "V3.6.0 OTA preflight failed" }

$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) {
  & $eas.Source update --branch preview --environment preview --platform android --message "V3.6.0 post-native preview update"
} else {
  npx --yes eas-cli@23.2.0 update --branch preview --environment preview --platform android --message "V3.6.0 post-native preview update"
}
if ($LASTEXITCODE -ne 0) { throw "EAS Update failed" }

