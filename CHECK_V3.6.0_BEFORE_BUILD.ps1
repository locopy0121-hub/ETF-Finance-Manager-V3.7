$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Set-Location -LiteralPath $PSScriptRoot
Write-Host "ETF Finance Manager V3.6.0 NATIVE - Preflight" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm not found" }

$app = Get-Content -LiteralPath (Join-Path $PSScriptRoot "app.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$pkg = Get-Content -LiteralPath (Join-Path $PSScriptRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if ($app.expo.version -ne "3.6.0") { throw "app.json version must be 3.6.0" }
if ($app.expo.runtimeVersion -ne "3.6.0") { throw "runtimeVersion must be 3.6.0" }
if ($app.expo.android.versionCode -ne 37) { throw "Android versionCode must be 37" }
if ($pkg.version -ne "3.6.0") { throw "package.json version must be 3.6.0" }

if (-not (Test-Path .\node_modules\typescript\bin\tsc)) {
  Write-Host "[1/7] node_modules missing/incomplete - npm install" -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} else { Write-Host "[1/7] dependencies ready" -ForegroundColor Green }

Write-Host "[2/7] V3.6.0 native audit" -ForegroundColor Yellow
npm run audit:v360
if ($LASTEXITCODE -ne 0) { throw "V3.6.0 audit failed" }
node scripts/FINANCE_ENGINE_V342_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Finance regression failed" }
node scripts/FORMULA_ENGINE_V342_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Formula regression failed" }
node scripts/V340_FIX1_REGRESSION_AUDIT.cjs
if ($LASTEXITCODE -ne 0) { throw "UI regression audit failed" }
node scripts/DIVIDEND_CUTOFF_TEST.cjs
if ($LASTEXITCODE -ne 0) { throw "Dividend cutoff test failed" }

Write-Host "[3/7] TypeScript" -ForegroundColor Yellow
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed" }

Write-Host "[4/7] Expo dependency check" -ForegroundColor Yellow
npx expo install --check
if ($LASTEXITCODE -ne 0) { throw "Expo dependency check failed" }

Write-Host "[5/7] Expo prebuild Android (validates config plugins/native wiring)" -ForegroundColor Yellow
npx expo prebuild --platform android --clean --no-install
if ($LASTEXITCODE -ne 0) { throw "Expo prebuild failed" }

Write-Host "[6/7] Generated app + local native module checks" -ForegroundColor Yellow
$appManifestPath = Join-Path $PSScriptRoot "android\app\src\main\AndroidManifest.xml"
$moduleManifestPath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\AndroidManifest.xml"
$moduleConfigPath = Join-Path $PSScriptRoot "modules\floating-investment-bot\expo-module.config.json"
$receiverSourcePath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\java\com\etfpilot\floatingbot\FloatingMonitorScheduleReceiver.kt"
$serviceSourcePath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\java\com\etfpilot\floatingbot\FloatingInvestmentBotService.kt"

$appManifest = Get-Content -LiteralPath $appManifestPath -Raw -Encoding UTF8
if ($appManifest -notmatch "Icon01") { throw "Alternate App Icon aliases not generated" }
if (-not (Test-Path .\android\app\src\main\res\xml\shortcuts.xml)) { throw "Launcher shortcuts.xml missing" }
if (-not (Test-Path .\android\app\src\main\res\drawable-nodpi\etf_icon_10.png)) { throw "10th alternate icon missing from native resources" }

# Receiver/service are declared by the local Android library module and are merged into the
# final APK by Gradle. They are not expected in android/app/src/main/AndroidManifest.xml
# immediately after expo prebuild.
if (-not (Test-Path -LiteralPath $moduleManifestPath)) { throw "Floating monitor local module manifest missing" }
$moduleManifest = Get-Content -LiteralPath $moduleManifestPath -Raw -Encoding UTF8
if ($moduleManifest -notmatch "FloatingMonitorScheduleReceiver") { throw "Floating monitor schedule receiver missing from local module manifest" }
if ($moduleManifest -notmatch "FloatingInvestmentBotService") { throw "Floating monitor native service missing from local module manifest" }
if ($moduleManifest -notmatch "android.intent.action.BOOT_COMPLETED") { throw "Floating monitor boot restore intent missing" }
if ($moduleManifest -notmatch "android.permission.RECEIVE_BOOT_COMPLETED") { throw "Floating monitor boot permission missing" }
if (-not (Test-Path -LiteralPath $receiverSourcePath)) { throw "Floating monitor schedule receiver Kotlin source missing" }
if (-not (Test-Path -LiteralPath $serviceSourcePath)) { throw "Floating monitor service Kotlin source missing" }
if (-not (Test-Path -LiteralPath $moduleConfigPath)) { throw "Floating monitor Expo module config missing" }

$moduleConfig = Get-Content -LiteralPath $moduleConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($moduleConfig.android.modules -notcontains "com.etfpilot.floatingbot.FloatingInvestmentBotModule") { throw "Floating monitor Expo module registration missing" }
if ($pkg.expo.autolinking.nativeModulesDir -ne "./modules") { throw "Expo local module autolinking must target ./modules" }

$settingsGradlePath = Join-Path $PSScriptRoot "android\settings.gradle"
if (-not (Test-Path -LiteralPath $settingsGradlePath)) { throw "Generated android/settings.gradle missing" }
$settingsGradle = Get-Content -LiteralPath $settingsGradlePath -Raw -Encoding UTF8
if ($settingsGradle -notmatch "useExpoModules") { throw "Generated Android project is not configured for Expo module autolinking" }
Write-Host "[7/7] Preflight PASS" -ForegroundColor Green
Write-Host "V3.6.0 runtime=3.6.0 versionCode=37 ready for EAS preview APK." -ForegroundColor Green


