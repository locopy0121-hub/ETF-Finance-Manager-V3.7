$ErrorActionPreference = "Stop"
$target = Join-Path $PSScriptRoot "src\v3\screens.tsx"
if (-not (Test-Path -LiteralPath $target)) { throw "Missing src\v3\screens.tsx" }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$text = [System.IO.File]::ReadAllText($target, [System.Text.Encoding]::UTF8)
if ($text -notmatch "ViewStyle") {
  $text = $text.Replace("import { Alert, Animated, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';", "import { Alert, Animated, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';`nimport type { ViewStyle } from 'react-native';")
}
$text = $text.Replace("const spanWidth=(span:V3CardSpan=6)=>", "const spanWidth=(span:V3CardSpan=6):ViewStyle['width']=>")
$text = $text.Replace("positive?:boolean;width?:string", "positive?:boolean;width?:ViewStyle['width']")
$text = $text.Replace("value:string;width?:string", "value:string;width?:ViewStyle['width']")
[System.IO.File]::WriteAllText($target, $text, $utf8)
Write-Host "V3.2 card width TypeScript fix applied." -ForegroundColor Green
