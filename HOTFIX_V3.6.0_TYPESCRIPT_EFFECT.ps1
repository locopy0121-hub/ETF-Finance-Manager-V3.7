$ErrorActionPreference = 'Stop'
Write-Host 'ETF Finance Manager V3.6.0 - TypeScript Effect Cleanup Hotfix' -ForegroundColor Cyan

$target = Join-Path $PSScriptRoot 'src\v3\screens.tsx'
if (-not (Test-Path $target)) { throw "Cannot find $target" }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
$old = 'return()=>setImmersiveEditor(false)},[designerOpen,layoutEditor,monitorFieldEdit,prefs.immersiveEditor]);'
$new = 'return()=>{setImmersiveEditor(false);}},[designerOpen,layoutEditor,monitorFieldEdit,prefs.immersiveEditor]);'

if ($text.Contains($new)) {
  Write-Host 'Patch already applied.' -ForegroundColor Yellow
} elseif ($text.Contains($old)) {
  $text = $text.Replace($old, $new)
  [System.IO.File]::WriteAllText($target, $text, $utf8NoBom)
  Write-Host 'Patched useEffect cleanup to return void.' -ForegroundColor Green
} else {
  throw 'Target useEffect pattern not found. Stop to avoid patching the wrong source.'
}

Write-Host 'Running TypeScript verification...' -ForegroundColor Cyan
& npx.cmd tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript still has errors; paste the new error output into ChatGPT.' }

Write-Host 'TypeScript PASS. You can rerun BUILD_V3.6.0_APK.ps1.' -ForegroundColor Green
