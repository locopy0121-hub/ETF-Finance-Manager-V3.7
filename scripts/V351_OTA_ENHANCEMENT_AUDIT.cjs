const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=JSON.parse(read('app.json')).expo;
const pkg=JSON.parse(read('package.json'));
const screens=read('src/v3/screens.tsx');
const main=read('App.tsx');
const monitoring=read('src/v3/monitoring.ts');
const checks=[
 ['package version 3.5.1',pkg.version==='3.5.1'],
 ['app version 3.5.1',app.version==='3.5.1'],
 ['runtime stays 3.5.0',app.runtimeVersion==='3.5.0'],
 ['versionCode stays 36',app.android?.versionCode===36],
 ['monitor openApp migration disabled',/if\(merged\.tapAction==='openApp'\)merged\.tapAction='none'/.test(monitoring)],
 ['no top content customize bar',!main.includes('styles.customizeBar')],
 ['page title customize control',screens.includes('pageCustomizeButton')&&screens.includes('自訂模式')],
 ['settings horizontal major nav',screens.includes('settingsMajorNav')&&screens.includes('settingsMajorItem')],
 ['settings child text nav',screens.includes('settingsMinorNav')&&screens.includes('settingsMinorItem')],
 ['keyboard insets enabled',screens.includes('automaticallyAdjustKeyboardInsets')],
 ['portfolio overview',screens.includes('整體庫存總覽')],
 ['portfolio contribution ranking',screens.includes('損益貢獻排行')],
 ['market overview',screens.includes('市場總覽｜熱門 ETF')],
 ['ETF search panel',screens.includes('ETF 搜尋 / 篩選')],
 ['risk indicators',screens.includes('風險指標｜TWSE 歷史行情')],
 ['no duplicated OTA label',!screens.includes('${APP_DISPLAY_VERSION} OTA')],
 ['v351 ota launcher exists',fs.existsSync(path.join(root,'OTA_V3.5.1_PREVIEW.ps1'))],
];
let pass=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} - ${name}`);if(ok)pass++;}
console.log(`V3.5.1 OTA audit ${pass}/${checks.length}`);if(pass!==checks.length)process.exit(1);
