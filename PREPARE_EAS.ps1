$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot
Write-Host "ETF Finance Manager V3.3.9 - EAS Setup" -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath ".\node_modules")) { npm install; if ($LASTEXITCODE -ne 0) { throw "npm install failed" } }
npx --yes eas-cli@23.2.0 whoami
if ($LASTEXITCODE -ne 0) { Write-Host "Please run: npx eas-cli@23.2.0 login" -ForegroundColor Yellow; exit 1 }
npx --yes eas-cli@23.2.0 project:info
