const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const COUNT = 10;
const launcherIntent = () => ({
  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
});

function withAlternateIcons(config) {
  config = withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return cfg;
    const activities = app.activity || [];
    const main = activities.find(a => String(a.$?.['android:name'] || '').endsWith('MainActivity'));
    if (main && Array.isArray(main['intent-filter'])) {
      main['intent-filter'] = main['intent-filter'].filter(f => {
        const actions = (f.action || []).map(x => x.$?.['android:name']);
        const cats = (f.category || []).map(x => x.$?.['android:name']);
        return !(actions.includes('android.intent.action.MAIN') && cats.includes('android.intent.category.LAUNCHER'));
      });
    }
    if (main) {
      const metas = main['meta-data'] || [];
      main['meta-data'] = [...metas.filter(m => m.$?.['android:name'] !== 'android.app.shortcuts'), { $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } }];
    }
    const existing = (app['activity-alias'] || []).filter(a => !String(a.$?.['android:name'] || '').match(/\.Icon\d\d$/));
    const aliases = Array.from({ length: COUNT }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return {
        $: {
          'android:name': `.Icon${n}`,
          'android:enabled': i === 0 ? 'true' : 'false',
          'android:exported': 'true',
          'android:icon': `@drawable/etf_icon_${n}`,
          'android:targetActivity': '.MainActivity',
          'android:label': 'ETF財務管家',
        },
        'intent-filter': [launcherIntent()],
        'meta-data': [{ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } }],
      };
    });
    app['activity-alias'] = [...existing, ...aliases];
    return cfg;
  });

  config = withDangerousMod(config, ['android', async cfg => {
    const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable-nodpi');
    fs.mkdirSync(res, { recursive: true });
    for (let i = 1; i <= COUNT; i++) {
      const n = String(i).padStart(2, '0');
      const src = path.join(cfg.modRequest.projectRoot, 'assets', 'app-icons', `icon-${n}.png`);
      const dst = path.join(res, `etf_icon_${n}.png`);
      if (!fs.existsSync(src)) throw new Error(`Missing alternate icon: ${src}`);
      fs.copyFileSync(src, dst);
    }
    const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(xmlDir, { recursive: true });
    const pkg = cfg.android?.package || cfg.modRequest.projectName || 'com.etfpilot.twselive';
    const shortcuts = `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n  <shortcut android:shortcutId="add_buy" android:enabled="true" android:icon="@drawable/etf_icon_01" android:shortcutShortLabel="@string/v360_shortcut_add_buy"><intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="etffinance://ledger" /></shortcut>\n  <shortcut android:shortcutId="monitor" android:enabled="true" android:icon="@drawable/etf_icon_02" android:shortcutShortLabel="@string/v360_shortcut_monitor"><intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="etffinance://settings" /></shortcut>\n  <shortcut android:shortcutId="today_pnl" android:enabled="true" android:icon="@drawable/etf_icon_04" android:shortcutShortLabel="@string/v360_shortcut_today_pnl"><intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="etffinance://dashboard" /></shortcut>\n  <shortcut android:shortcutId="dividend" android:enabled="true" android:icon="@drawable/etf_icon_08" android:shortcutShortLabel="@string/v360_shortcut_dividend"><intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="etffinance://dividend" /></shortcut>\n  <shortcut android:shortcutId="ai" android:enabled="true" android:icon="@drawable/etf_icon_07" android:shortcutShortLabel="@string/v360_shortcut_ai"><intent android:action="android.intent.action.VIEW" android:targetPackage="${pkg}" android:targetClass="${pkg}.MainActivity" android:data="etffinance://ai" /></shortcut>\n</shortcuts>`;
    fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), shortcuts);
    const valuesDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'values');
    fs.mkdirSync(valuesDir, { recursive: true });
    fs.writeFileSync(path.join(valuesDir, 'v360_shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="v360_shortcut_add_buy">新增買進</string>\n  <string name="v360_shortcut_monitor">浮動監視器</string>\n  <string name="v360_shortcut_today_pnl">今日損益</string>\n  <string name="v360_shortcut_dividend">股息日曆</string>\n  <string name="v360_shortcut_ai">AI 助理</string>\n</resources>`);
    return cfg;
  }]);
  return config;
}
module.exports = withAlternateIcons;
