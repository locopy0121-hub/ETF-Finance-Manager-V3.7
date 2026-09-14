const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('App.tsx'), screens=read('src/v3/screens.tsx'), model=read('src/v3/model.ts'), engine=read('src/v3/engine.ts'), ai=read('src/v3/AiAssistantModal.tsx'), widget=read('src/widgets/ProfitWidget.tsx'), quotes=read('src/services/useTwseQuotes.ts'), twse=read('src/services/twse.ts'), charts=read('src/v3/ChartEngine2.tsx'), designer=read('src/v3/GlobalCardDesigner.tsx'), overlay=read('src/services/floatingOverlay.ts'), bot=read('src/v3/FloatingInvestmentBot.tsx'), history=read('src/services/twseHistory.ts'), manifest=read('modules/floating-investment-bot/android/src/main/AndroidManifest.xml'), nativeModule=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotModule.kt'), nativeService=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt');
const checks=[];const ok=(name,cond)=>{if(!cond)throw new Error('FAIL: '+name);checks.push(name)};
// #1 AI keyboard avoidance + clear + font
ok('#1 AI keyboard avoidance',/KeyboardAvoidingView/.test(ai)&&/keyboardShouldPersistTaps="handled"/.test(ai)&&/scrollToEnd/.test(ai));
ok('#1 AI clear confirmation',/清除 AI 對話/.test(ai)&&/setRows\(\[\]\)/.test(ai));
// #2 dividend cutoff snapshot
ok('#2 dividend cutoff',/const cutoff=event\.lastBuyDate\|\|previousTradingDay\(event\.exDate\)/.test(app)&&/sharesOnDate\(event\.symbol,cutoff/.test(app));
ok('#2 TWSE official holiday-aware last buy day',/previousTwseTradingDay/.test(read('src/services/twseDividends.ts'))&&/holidaySchedule/.test(read('src/services/twseDividends.ts')));
// #3 focus settings
ok('#3 holding focus settings',/持倉焦點設定/.test(screens)&&/holdingFocusSort/.test(model)&&/holdingFocusMax/.test(model));
// #4 ticker list -> target
ok('#4 ticker list routing',/跑馬燈資訊列表/.test(app)&&/setTab\(item\.target\)/.test(app));
// #5/#14 loss color settings
ok('#5 special theme P&L color',/一般損益數值套用主題損益顏色/.test(screens)&&/followThemeProfitLossColors/.test(model));
ok('#14 per-value color mode',/數值顏色模式/.test(designer)&&/跟隨損益色/.test(designer)&&/V3ValueColorMode/.test(model));
// #6 cumulative pnl details
ok('#6 cumulative P&L total',/CumulativePnlModal/.test(screens)&&/累積損益 TOTAL/.test(screens)&&/realizedCashPnl/.test(screens));
// #7 fill layout
ok('#7 mixed-card fill layout',/belowKeys/.test(screens)&&/sideKeys/.test(screens)&&/MasonryDeck/.test(screens));
// #8 Widget all/single, responsive, bottom status
ok('#8 Widget all/single ETF',/selectedSymbols\.length===1/.test(widget)&&/metricHoldings=selectedSymbols\.length\?selected:holdings/.test(widget));
ok('#8 Widget responsive tiers',/const medium=/.test(widget)&&/const veryLarge=/.test(widget)&&/maxRows=/.test(widget));
ok('#8 Widget bottom status',/updatedAt/.test(widget)&&/lamp=/.test(widget)&&/<FlexWidget style=\{\{flexGrow:1\}\}\/>/.test(widget)&&/更新時間 \${timeText}/.test(widget));
// #9 canonical instant pnl includes buy fee
ok('#9 canonical instant P&L',/const pnl=cashPnl/.test(engine)&&/currentCashBasis=currentTradeCost\+currentAllocatedBuyFees/.test(engine));
ok('#9 today P&L separate',/todayPnl=\(price-prev\)\*h\.shares/.test(engine));
// #10 app + cross-app bot
ok('#10 10 in-app BOT modes',/bubble/.test(bot)&&/ticker/.test(bot)&&/transparent/.test(bot)&&/switcher/.test(bot)&&/PanResponder/.test(bot));
ok('#10 BOT configuration',/BOT 大小/.test(screens)&&/BOT 透明度/.test(screens)&&/輪播速度/.test(screens)&&/BOT 指定 ETF/.test(screens));
ok('#10 Android overlay permission',/SYSTEM_ALERT_WINDOW/.test(manifest)&&/FOREGROUND_SERVICE_SPECIAL_USE/.test(manifest)&&/TYPE_APPLICATION_OVERLAY/.test(nativeService));
ok('#10 Native drag/snap/persist',/MotionEvent\.ACTION_MOVE/.test(nativeService)&&/PREF_X/.test(nativeService)&&/screenW - p\.width/.test(nativeService));
ok('#10 Native background TWSE refresh',/mis\.twse\.com\.tw/.test(nativeService)&&/refreshSeconds/.test(nativeService)&&/cashBasis/.test(nativeService));
ok('#10 Expo native module registration',/Name\("FloatingInvestmentBot"\)/.test(nativeModule)&&/FloatingInvestmentBotService\.start/.test(nativeModule)&&/requireOptionalNativeModule/.test(overlay));
// #11 quote resiliency
ok('#11 quote abort timeout',/AbortController/.test(twse)&&/8000/.test(twse));
ok('#11 quote backoff',/\[2000,5000,10000,20000,30000\]/.test(quotes)&&/nextAllowedAt/.test(quotes)&&/refreshing\.current/.test(quotes));
ok('#11 preserve last snapshot',/quotes:\{\.\.\.prev\.quotes,\.\.\.quotes\}/.test(quotes));
// #12 chart engine
const types=['line','area','bar','positiveBar','multiLine','pie','donut','stackedBar','candlestick','volume','pnlTrend','progress','heatmap','waterfall','radar','scatter'];
ok('#12 16 chart types model',types.every(t=>model.includes(`'${t}'`)));
ok('#12 16 chart renderers',types.every(t=>charts.includes(`case'${t}'`)));
ok('#12 TWSE historical OHLCV',/STOCK_DAY/.test(history)&&/fetchTwseOhlcvHistory/.test(charts)&&/history=/.test(charts));
ok('#12 chart visual controls',/圖表配色/.test(designer)&&/線條粗細/.test(designer)&&/填色透明度/.test(designer)&&/顯示圖例/.test(designer));
// #13 broker decimal
ok('#13 broker decimal input',/DecimalSettingField/.test(screens)&&/keyboardType="decimal-pad"/.test(screens)&&/placeholder="0\.65"/.test(screens)&&/折扣係數/.test(screens));
ok('#2 post-cutoff trades become zero eligible',/if\(!rows\.length\)return 0/.test(read('src/v3/engine.ts')));
ok('#10 BOT selected fields are rendered',/selectedMetrics/.test(read('src/v3/FloatingInvestmentBot.tsx'))&&/selectedMetricLines/.test(read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt')));
ok('#12 chart smart recommendation',/recommendedChartType/.test(read('src/v3/GlobalCardDesigner.tsx'))&&/智慧推薦/.test(read('src/v3/GlobalCardDesigner.tsx')));
ok('#14 fallback P&L values use theme colors',/parseDisplayNumber/.test(screens)&&/valueColor=/.test(screens));
ok('V3.4 native runtime baseline',/\"runtimeVersion\"\s*:\s*\"3\.4\.0\"/.test(read('app.json'))&&/\"versionCode\"\s*:\s*33/.test(read('app.json')));
ok('Expo local module autolinking directory',/nativeModulesDir/.test(read('package.json'))&&/\.\/modules/.test(read('package.json')));
ok('Build and OTA launchers present',fs.existsSync(path.join(root,'BUILD_V3.4.0_APK.ps1'))&&fs.existsSync(path.join(root,'OTA_V3.4.0_PREVIEW.ps1')));
console.log(`V340_ALL14_AUDIT: PASS (${checks.length} checks)`);checks.forEach((x,i)=>console.log(`${String(i+1).padStart(2,'0')}. ${x}`));
