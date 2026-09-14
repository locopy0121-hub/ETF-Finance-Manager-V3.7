$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$target = Join-Path $PSScriptRoot "CHECK_V3.6.0_BEFORE_BUILD.ps1"
if (-not (Test-Path -LiteralPath $target)) {
  throw "CHECK_V3.6.0_BEFORE_BUILD.ps1 not found. Put this hotfix in the V3.6.0 app folder."
}

$text = Get-Content -LiteralPath $target -Raw -Encoding UTF8

# FIX3 V2 is intentionally marker-based rather than exact-text based.
# This tolerates CRLF/LF differences and the earlier UTF-8 / TypeScript hotfixes.
if ($text -match 'Generated app \+ local native module checks') {
  Write-Host "Native manifest preflight FIX3 V2 is already installed." -ForegroundColor Green
} else {
  $pattern = '(?ms)^Write-Host "\[6/7\][^\r\n]*".*?(?=^Write-Host "\[7/7\])'
  $match = [regex]::Match($text, $pattern)
  if (-not $match.Success) {
    throw "Could not locate the [6/7] preflight section between the [6/7] and [7/7] markers. No files were changed."
  }

  $newBlock = @'
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

'@

  Copy-Item -LiteralPath $target -Destination "$target.fix3v2.bak" -Force
  $patched = $text.Substring(0, $match.Index) + $newBlock + $text.Substring($match.Index + $match.Length)
  Set-Content -LiteralPath $target -Value $patched -Encoding UTF8
  Write-Host "Patched [6/7] native manifest validation using marker-based replacement." -ForegroundColor Green
}

# Validate the declarations that caused the original false-negative before asking for another full build.
$moduleManifestPath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\AndroidManifest.xml"
$moduleConfigPath = Join-Path $PSScriptRoot "modules\floating-investment-bot\expo-module.config.json"
$receiverSourcePath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\java\com\etfpilot\floatingbot\FloatingMonitorScheduleReceiver.kt"
$serviceSourcePath = Join-Path $PSScriptRoot "modules\floating-investment-bot\android\src\main\java\com\etfpilot\floatingbot\FloatingInvestmentBotService.kt"

if (-not (Test-Path -LiteralPath $moduleManifestPath)) { throw "Local module manifest is missing" }
$moduleManifest = Get-Content -LiteralPath $moduleManifestPath -Raw -Encoding UTF8
if ($moduleManifest -notmatch "FloatingMonitorScheduleReceiver") { throw "Receiver declaration is genuinely missing from the local module manifest" }
if ($moduleManifest -notmatch "FloatingInvestmentBotService") { throw "Service declaration is genuinely missing from the local module manifest" }
if ($moduleManifest -notmatch "BOOT_COMPLETED") { throw "BOOT_COMPLETED declaration is genuinely missing" }
if (-not (Test-Path -LiteralPath $receiverSourcePath)) { throw "Receiver Kotlin source is genuinely missing" }
if (-not (Test-Path -LiteralPath $serviceSourcePath)) { throw "Service Kotlin source is genuinely missing" }
if (-not (Test-Path -LiteralPath $moduleConfigPath)) { throw "Expo module config is genuinely missing" }

Write-Host "FIX3 V2 source verification PASS." -ForegroundColor Cyan
Write-Host "Now re-run: powershell -ExecutionPolicy Bypass -File .\BUILD_V3.6.0_APK.ps1" -ForegroundColor Cyan
