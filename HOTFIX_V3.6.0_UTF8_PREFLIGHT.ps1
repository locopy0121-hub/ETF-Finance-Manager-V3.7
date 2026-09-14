$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$checkPath = Join-Path $root "CHECK_V3.6.0_BEFORE_BUILD.ps1"
$otaPath = Join-Path $root "OTA_V3.6.0_PREVIEW.ps1"
if (-not (Test-Path -LiteralPath $checkPath)) {
  throw "Run this hotfix from the V3.6.0 app folder (same folder as CHECK_V3.6.0_BEFORE_BUILD.ps1)."
}

function Patch-Utf8JsonRead([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $anchor = '$env:EAS_NO_VCS = "1"'
  if ($text -notmatch 'Set-Location -LiteralPath \$PSScriptRoot') {
    $text = $text.Replace($anchor, $anchor + "`r`n" + 'Set-Location -LiteralPath $PSScriptRoot')
  }
  $text = $text.Replace('$app = Get-Content .\app.json -Raw | ConvertFrom-Json', '$app = Get-Content -LiteralPath (Join-Path $PSScriptRoot "app.json") -Raw -Encoding UTF8 | ConvertFrom-Json')
  $text = $text.Replace('$pkg = Get-Content .\package.json -Raw | ConvertFrom-Json', '$pkg = Get-Content -LiteralPath (Join-Path $PSScriptRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json')
  Set-Content -LiteralPath $path -Value $text -Encoding UTF8
  Write-Host "Patched UTF-8 JSON reading: $([System.IO.Path]::GetFileName($path))" -ForegroundColor Green
}

Patch-Utf8JsonRead $checkPath
Patch-Utf8JsonRead $otaPath

$app = Get-Content -LiteralPath (Join-Path $root "app.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if ($app.expo.version -ne "3.6.0") { throw "app.json parsed, but version is not 3.6.0" }
if ($app.expo.runtimeVersion -ne "3.6.0") { throw "app.json parsed, but runtimeVersion is not 3.6.0" }
Write-Host "UTF-8 preflight hotfix PASS - app.json parsed as V3.6.0" -ForegroundColor Cyan
