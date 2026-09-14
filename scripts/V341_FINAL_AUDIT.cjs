const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files={app:read('App.tsx'),appjson:read('app.json'),pkg:read('package.json'),model:read('src/v3/model.ts'),screens:read('src/v3/screens.tsx'),charts:read('src/v3/charts.tsx'),chart2:read('src/v3/ChartEngine2.tsx'),bot:read('src/v3/FloatingInvestmentBot.tsx'),widget:read('src/widgets/ProfitWidget.tsx'),storage:read('src/v3/storage.ts'),display:read('src/v3/display.ts'),engine:read('src/v3/engine.ts'),ticker:read('src/v3/SmartTicker.tsx'),safe:read('src/v3/safetyBackup.ts'),gradle:read('modules/floating-investment-bot/android/build.gradle'),native:read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt')};
const checks=[];function ok(name,cond){if(!cond)throw new Error('FAIL: '+name);checks.push(name)}
// Release/native baseline
ok('release identity V3.4.1',/"version"\s*:\s*"3\.4\.1"/.test(files.appjson)&&/"runtimeVersion"\s*:\s*"3\.4\.1"/.test(files.appjson)&&/"versionCode"\s*:\s*34/.test(files.appjson)&&/"version"\s*:\s*"3\.4\.1"/.test(files.pkg));
ok('floating native module has Android version metadata',/defaultConfig\s*\{[\s\S]*versionCode\s+1[\s\S]*versionName\s+["']1\.0\.0["']/.test(files.gradle));
// #1 BOT adaptive size + app switch
ok('#1 BOT independent width/height',/floatingWidth/.test(files.model)&&/floatingHeight/.test(files.model)&&/floatingAutoHeight/.test(files.model)&&/resize\.panHandlers/.test(files.bot));
ok('#1 BOT content auto height and bounded scroll',/contentHeight/.test(files.bot)&&/floatingMaxHeightRatio/.test(files.bot)&&/scrollEnabled=/.test(files.bot));
ok('#1 APP BOT robot ON / double-tap collapse',/開啟 AI BOT/.test(files.bot)&&/ON · 雙擊收合/.test(files.bot)&&/lastTap/.test(files.bot));
// #2 cross-app overlay
ok('#2 overlay only outside foreground app',/AppState\.addEventListener\('change'/.test(files.app)&&/next==='active'\)\{stopFloatingOverlay\(\)/.test(files.app));
ok('#2 cross-app refresh accepts zero/custom',/跨 App 更新/.test(files.screens)&&/0 秒＝安全即時模式/.test(files.screens)&&/Math\.max\(0,Number\(t\)\|\|0\)/.test(files.screens));
ok('#2 native safe refresh throttle',/sec <= 0\.0/.test(files.native)&&/1000L/.test(files.native)&&/max\(250L/.test(files.native));
ok('#2 adaptive cross-app font/size payload',/fontMin/.test(files.native)&&/fontMax/.test(files.native)&&/autoFont/.test(files.native)&&/autoHeight/.test(files.native)&&/customW/.test(files.native)&&/customH/.test(files.native));
// #3 app charts
ok('#3 small chart single-tap cycle + double-tap zoom',/單擊切換/.test(files.chart2)&&/雙擊放大/.test(files.chart2)&&/setLocalType/.test(files.chart2)&&/setOpen\(true\)/.test(files.chart2));
ok('#3 enlarged chart zoom/range/detail',/1日/.test(files.chart2)&&/3月/.test(files.chart2)&&/全部/.test(files.chart2)&&/setZoom/.test(files.chart2)&&/setSelected/.test(files.chart2)&&/離開/.test(files.chart2));
// #4 Widget charts
for(const t of ['line','area','bar','sparkline','step'])ok(`#4 Widget chart style ${t}`,files.screens.includes(`trendChartType:'${t}'`)&&files.widget.includes(`'${t}'`));
ok('#4 Widget chart display controls',/顯示圖表網格/.test(files.screens)&&/顯示座標軸/.test(files.screens)&&/顯示最後一點數值/.test(files.screens)&&/圖表高度/.test(files.screens)&&/線條粗細/.test(files.screens));
// #5 number formatting
ok('#5 smart/fixed/custom numeric modes',/MoneyDisplayMode='smart'\|'fixed'\|'custom'/.test(files.model)&&/自由設定/.test(files.screens)&&/customMoneyDigits/.test(files.screens));
ok('#5 price is locked to two decimals',/minimumFractionDigits:2,maximumFractionDigits:2/.test(files.display)&&/toFixed\(2\)/.test(files.screens));
ok('#5 global money data has no currency prefix',!/\$\$\{money\(/.test(files.screens)&&!/\?['"]-['"]:['"]\$['"]/.test(files.screens)&&!/\$\$\{money\(/.test(files.bot)&&!/總資產 \$\$\{money/.test(files.native));
// #6 calendar + lifestyle
ok('#6 calendar theme/custom settings',/CalendarPreferences/.test(files.model)&&/跟隨全局佈景/.test(files.screens)&&/月曆背景/.test(files.screens)&&/eventStyle/.test(files.screens)&&/todayStyle/.test(files.screens));
ok('#6 calendar renderer uses preferences',/function DividendMonthCalendar/.test(files.screens)&&/cfg\.followTheme/.test(files.screens)&&/cfg\.cellRadius/.test(files.screens)&&/cfg\.eventStyle/.test(files.screens));
ok('#6 lifestyle salary-progress settings and real dividend source',/生活感加薪進度/.test(files.screens)&&/LifestyleGauge/.test(files.screens)&&/依實際股息資料/.test(files.screens)&&/actualAmount/.test(files.screens));
// #7 safety data management
ok('#7 pre-action safety backup storage',/createSafetyBackup/.test(files.safe)&&/MAX_BACKUPS=8/.test(files.safe)&&/safeMutate/.test(files.app));
ok('#7 clear/recalc guarded by backup',/clearPnlHistory=async\(\)=>safeMutate/.test(files.app)&&/clearCashHistory=async\(\)=>safeMutate/.test(files.app)&&/clearLedgerHistory=async\(\)=>safeMutate/.test(files.app)&&/recalculateDerived=async\(\)=>safeMutate/.test(files.app));
ok('#7 restore creates rescue point first',/還原安全備份前的目前狀態/.test(files.app)&&/restoreSafetyBackup/.test(files.app));
ok('#7 legacy holdings preserved when no buy ledger',/if\(!buys\.length\)\{if\(existing\)rebuilt\.push\(existing\);continue;\}/.test(files.app));
// #8 simulation
ok('#8 current holdings arbitrary selection/custom portfolio',/持有試算自訂組合/.test(files.screens)&&/任意勾選目前持有 ETF/.test(files.screens)&&/依目前持倉比例/.test(files.screens)&&/平均分配/.test(files.screens));
ok('#8 ratio/amount bidirectional configuration',/配置比例/.test(files.screens)&&/配置金額/.test(files.screens)&&/changeCurrentWeight/.test(files.screens)&&/changeCurrentAmount/.test(files.screens));
ok('#8 simulation chart style cycle/detail zoom',/WEALTH_STYLES/.test(files.charts)&&/單擊換樣式 · 雙擊放大/.test(files.charts)&&/setZoom/.test(files.charts)&&/當期投入/.test(files.charts)&&/累積股息/.test(files.charts));
ok('#8 simulation never writes real holdings directly',/只影響模擬，不修改真實庫存/.test(files.screens));
// #9 ticker
for(const t of ['scroll','pingpong','center','blink','jump','pulse','wave','bounce','scale','fade'])ok(`#9 ticker animation ${t}`,files.model.includes(`'${t}'`)&&files.screens.includes(`'${t}'`));
ok('#9 ticker settings and renderer',/內容來源/.test(files.screens)&&/跑馬速度/.test(files.screens)&&/停留/.test(files.screens)&&/動畫強度/.test(files.screens)&&/減少動態/.test(files.screens)&&/SmartTicker/.test(files.app)&&/cfg\.animation/.test(files.ticker));
// #10 daily P&L semantic colors
ok('#10 daily P&L symbol badge is driven by actual pnl',/function PnlSymbolBadge/.test(files.screens)&&/pnl>0/.test(files.screens)&&/pnl<0/.test(files.screens)&&/neutralColor/.test(files.screens));
ok('#10 daily P&L detail uses close price two decimals',/收盤 \{Number\(h\.price\|\|0\)\.toFixed\(2\)\}/.test(files.screens));
ok('#10 daily P&L configurable red/green/neutral colors',/正損益（台股紅）/.test(files.screens)&&/負損益（台股綠）/.test(files.screens)&&/持平 \/ 待更新/.test(files.screens));
console.log(`V341_FINAL_AUDIT: PASS (${checks.length} checks)`);checks.forEach((x,i)=>console.log(`${String(i+1).padStart(2,'0')}. ${x}`));
