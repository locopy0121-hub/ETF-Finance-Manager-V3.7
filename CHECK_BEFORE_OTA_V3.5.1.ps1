$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
$env:EAS_PROJECT_ROOT = $PSScriptRoot
Set-Location -LiteralPath $PSScriptRoot

Write-Host "ETF Finance Manager V3.5.1 OTA - Preflight (runtime 3.5.0)" -ForegroundColor Cyan
$required = @(
  "package.json","app.json","eas.json","App.tsx",
  "src\v3\screens.tsx","src\v3\etfResearch.ts","src\v3\monitoring.ts","src\services\twseHistory.ts",
  "scripts\V351_OTA_ENHANCEMENT_AUDIT.cjs","scripts\FINANCE_ENGINE_V342_TEST.cjs","scripts\FORMULA_ENGINE_V342_TEST.cjs",
  "scripts\V340_FIX1_REGRESSION_AUDIT.cjs","scripts\DIVIDEND_CUTOFF_TEST.cjs"
)
foreach ($f in $required) { if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $f))) { throw "Missing required file: $f" } }
$app = Get-Content -LiteralPath ".\app.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$pkg = Get-Content -LiteralPath ".\package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
if ($app.expo.version -ne "3.5.1") { throw "app.json version must be 3.5.1" }
if ($app.expo.runtimeVersion -ne "3.5.0") { throw "runtimeVersion must stay 3.5.0 for OTA compatibility" }
if ([int]$app.expo.android.versionCode -ne 36) { throw "OTA must not change Android versionCode 36" }
if ($pkg.version -ne "3.5.1") { throw "package.json version must be 3.5.1" }

Write-Host "[1/7] V3.5.1 OTA enhancement audit" -ForegroundColor Yellow
node .\scripts\V351_OTA_ENHANCEMENT_AUDIT.cjs
if ($LASTEXITCODE -ne 0) { throw "V3.5.1 audit failed" }
Write-Host "[2/7] Finance Engine 2.0 contract" -ForegroundColor Yellow
node .\scripts\FINANCE_ENGINE_V342_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Finance Engine test failed" }
Write-Host "[3/7] Formula Engine contract" -ForegroundColor Yellow
node .\scripts\FORMULA_ENGINE_V342_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Formula Engine test failed" }
Write-Host "[4/7] V3.4.0 FIX1 regression guard" -ForegroundColor Yellow
node .\scripts\V340_FIX1_REGRESSION_AUDIT.cjs
if ($LASTEXITCODE -ne 0) { throw "V340 regression audit failed" }
Write-Host "[5/7] Dividend cutoff regression" -ForegroundColor Yellow
node .\scripts\DIVIDEND_CUTOFF_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Dividend cutoff test failed" }

$localTsc = Join-Path $PSScriptRoot "node_modules\.bin\tsc.cmd"
$localExpo = Join-Path $PSScriptRoot "node_modules\.bin\expo.cmd"
if (-not (Test-Path $localTsc)) { throw "Local TypeScript compiler not found. Run npm install first." }
if (-not (Test-Path $localExpo)) { throw "Local Expo CLI not found. Run npm install first." }
Write-Host "[6/7] TypeScript semantic check" -ForegroundColor Yellow
& $localTsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript validation failed" }
Write-Host "[7/7] Expo Android Metro/Hermes export" -ForegroundColor Yellow
$dist = Join-Path $PSScriptRoot "dist-v351-ota-preflight"
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
& $localExpo export --platform android --output-dir $dist
if ($LASTEXITCODE -ne 0) { throw "Android export failed" }
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
Write-Host "OTA PREFLIGHT PASS - V3.5.1 / runtime 3.5.0" -ForegroundColor Green
