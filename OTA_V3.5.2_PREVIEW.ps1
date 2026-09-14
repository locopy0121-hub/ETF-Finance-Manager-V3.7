$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Write-Host "ETF財務管家 V3.5.2 OTA - Global Editor 2.0 / Monitor 2.0" -ForegroundColor Cyan
npm run check:v352
if ($LASTEXITCODE -ne 0) { throw "V3.5.2 preflight failed" }
npx eas update --branch preview --message "V3.5.2 Global Editor 2.0 + Floating Monitor 2.0 + Settings Layout + AI BOT cleanup"
