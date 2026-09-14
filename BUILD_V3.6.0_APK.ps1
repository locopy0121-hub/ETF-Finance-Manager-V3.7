$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Write-Host "ETF Finance Manager V3.6.0 NATIVE - COMPLETE APK" -ForegroundColor Cyan

powershell -ExecutionPolicy Bypass -File .\CHECK_V3.6.0_BEFORE_BUILD.ps1
if ($LASTEXITCODE -ne 0) { throw "V3.6.0 preflight failed" }

Write-Host "Submitting Android preview APK to EAS Build..." -ForegroundColor Yellow
$eas = Get-Command eas -ErrorAction SilentlyContinue
if ($eas) {
  & $eas.Source build --platform android --profile preview
} else {
  npx --yes eas-cli@23.2.0 build --platform android --profile preview
}
if ($LASTEXITCODE -ne 0) { throw "EAS Build failed" }
Write-Host "V3.6.0 APK build submitted/completed." -ForegroundColor Green
