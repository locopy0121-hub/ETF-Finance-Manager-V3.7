$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$target = Join-Path $PSScriptRoot "CHECK_V3.6.0_BEFORE_BUILD.ps1"
if (-not (Test-Path $target)) { throw "CHECK_V3.6.0_BEFORE_BUILD.ps1 not found in this folder" }

$text = Get-Content -LiteralPath $target -Raw -Encoding UTF8
$old = @'
Write-Host "[6/7] Generated native manifest checks" -ForegroundColor Yellow
$manifest = Get-Content .\android\app\src\main\AndroidManifest.xml -Raw
if ($manifest -notmatch "Icon01") { throw "Alternate App Icon aliases not generated" }
if ($manifest -notmatch "FloatingMonitorScheduleReceiver") { throw "Floating monitor schedule receiver missing" }
if ($manifest -notmatch "FloatingInvestmentBotService") { throw "Floating monitor native service missing" }
if (-not (Test-Path .\android\app\src\main\res\xml\shortcuts.xml)) { throw "Launcher shortcuts.xml missing" }
if (-not (Test-Path .\android\app\src\main\res\drawable-nodpi\etf_icon_10.png)) { throw "10th alternate icon missing from native resources" }
'@
$new = @'
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

# Receiver/service declarations from an Android library module are merged by Gradle later.
if (-not (Test-Path $moduleManifestPath)) { throw "Floating monitor local module manifest missing" }
$moduleManifest = Get-Content -LiteralPath $moduleManifestPath -Raw -Encoding UTF8
if ($moduleManifest -notmatch "FloatingMonitorScheduleReceiver") { throw "Floating monitor schedule receiver missing from local module manifest" }
if ($moduleManifest -notmatch "FloatingInvestmentBotService") { throw "Floating monitor native service missing from local module manifest" }
if ($moduleManifest -notmatch "android.intent.action.BOOT_COMPLETED") { throw "Floating monitor boot restore intent missing" }
if ($moduleManifest -notmatch "android.permission.RECEIVE_BOOT_COMPLETED") { throw "Floating monitor boot permission missing" }
if (-not (Test-Path $receiverSourcePath)) { throw "Floating monitor schedule receiver Kotlin source missing" }
if (-not (Test-Path $serviceSourcePath)) { throw "Floating monitor service Kotlin source missing" }
if (-not (Test-Path $moduleConfigPath)) { throw "Floating monitor Expo module config missing" }
$moduleConfig = Get-Content -LiteralPath $moduleConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($moduleConfig.android.modules -notcontains "com.etfpilot.floatingbot.FloatingInvestmentBotModule") { throw "Floating monitor Expo module registration missing" }
if ($pkg.expo.autolinking.nativeModulesDir -ne "./modules") { throw "Expo local module autolinking must target ./modules" }
$settingsGradle = Get-Content -LiteralPath (Join-Path $PSScriptRoot "android\settings.gradle") -Raw -Encoding UTF8
if ($settingsGradle -notmatch "useExpoModules") { throw "Generated Android project is not configured for Expo module autolinking" }
'@

if ($text.Contains($new)) {
  Write-Host "FIX3 native manifest preflight is already installed." -ForegroundColor Green
} elseif ($text.Contains($old)) {
  Copy-Item -LiteralPath $target -Destination "$target.fix3.bak" -Force
  $text = $text.Replace($old, $new)
  Set-Content -LiteralPath $target -Value $text -Encoding UTF8
  Write-Host "Patched V3.6.0 native manifest preflight." -ForegroundColor Green
} else {
  throw "Expected old preflight block was not found. Do not patch an unknown version."
}

# Validate the actual source declarations now; no Gradle build is needed for this hotfix check.
$moduleManifestPath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\AndroidManifest.xml"
$moduleManifest = Get-Content -LiteralPath $moduleManifestPath -Raw -Encoding UTF8
if ($moduleManifest -notmatch "FloatingMonitorScheduleReceiver") { throw "Receiver declaration still missing" }
if ($moduleManifest -notmatch "FloatingInvestmentBotService") { throw "Service declaration still missing" }
if ($moduleManifest -notmatch "BOOT_COMPLETED") { throw "BOOT_COMPLETED declaration still missing" }
Write-Host "FIX3 source verification PASS. Re-run BUILD_V3.6.0_APK.ps1." -ForegroundColor Cyan
