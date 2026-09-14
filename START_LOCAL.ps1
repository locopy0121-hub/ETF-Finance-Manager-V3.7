$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Set-Location -LiteralPath $PSScriptRoot
Write-Host "ETF Finance Manager V3.4.1 - Local JS/UI Test" -ForegroundColor Cyan
Write-Host "Native Floating BOT / Android Widget must be validated with Preview APK." -ForegroundColor Yellow
if (-not (Test-Path -LiteralPath ".\node_modules")) {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}
& (Join-Path $PSScriptRoot "node_modules\.bin\expo.cmd") start -c
