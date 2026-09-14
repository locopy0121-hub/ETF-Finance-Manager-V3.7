$ErrorActionPreference = "Stop"
$env:EAS_NO_VCS = "1"
Write-Host "ETF Finance Manager V3.2.0 - Prepare Native Tools" -ForegroundColor Cyan
$localExpo = Join-Path $PSScriptRoot "node_modules\.bin\expo.cmd"
if (-not (Test-Path -LiteralPath $localExpo)) { throw "Local Expo CLI was not found. Run npm install first." }
$packages = @(
  "expo-notifications","expo-background-task","expo-task-manager","expo-file-system","expo-sharing","expo-secure-store","expo-updates",
  "expo-image-picker","@react-native-community/datetimepicker","@react-native-async-storage/async-storage","@react-native-community/netinfo",
  "react-native-svg","react-native-safe-area-context","expo-document-picker","expo-local-authentication","expo-clipboard","expo-application","expo-device","expo-intent-launcher","expo-sqlite","expo-print"
)
Write-Host "Installing Expo SDK compatible native packages..." -ForegroundColor Yellow
& $localExpo install @packages
if ($LASTEXITCODE -ne 0) { throw "Expo native package installation failed with exit code $LASTEXITCODE" }
Write-Host "Native package installation completed." -ForegroundColor Green
Write-Host "V3 OCR feature is intentionally removed." -ForegroundColor DarkGray
