const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const expect=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exitCode=1}else console.log('PASS:',msg)};

const model=read('src/v3/model.ts');
const storage=read('src/v3/storage.ts');
const designer=read('src/v3/GlobalCardDesigner.tsx');
const flow=read('src/ui/FlowLayout.tsx');
const screens=read('src/v3/screens.tsx');

expect(model.includes('customWidth?:number'),'data frame supports custom width');
expect(model.includes("role?:'summary'|'listTemplate'|'normal'|'module'"),'page cards support registered runtime modules');
for(const id of ['dashboard-core-1','dashboard-core-2','dashboard-core-3','dashboard-market','dashboard-watchlist','dashboard-pnl-history','dashboard-daily-pnl','dashboard-wealth','dashboard-allocation']) expect(model.includes(`'${id}'`),`dashboard registry contains ${id}`);
for(const id of ['portfolio-summary','portfolio-list','portfolio-contribution','portfolio-recent','portfolio-allocation']) expect(model.includes(`'${id}'`),`portfolio registry contains ${id}`);
const schemaMatch=storage.match(/const SCHEMA=(\d+);/);expect(schemaMatch&&Number(schemaMatch[1])>=16,'storage schema migrated to 16 or newer');
expect(storage.includes('requiredLayouts=makeDefaultPageLayouts'),'stored layouts merge newly required modules');
expect(designer.includes('【資料框】'),'deepest editor identifies data-frame level');
expect(designer.includes('【卡片框架】'),'card editor identifies card-frame level');
expect(designer.includes('【頁面框架】'),'page editor identifies page-frame level');
expect(designer.includes('customWidth'),'card editor exposes custom width');
expect(designer.includes('saveUniversalTarget')&&designer.includes('applyUniversalToFieldConfig')&&designer.includes('onEditorNodesChange?.({...editorNodes,[node.id]:node})'),'deep data-frame save updates parent draft and canonical editor node store before returning');
expect(flow.includes('customWidth'),'runtime FlowItem supports custom width');
expect(screens.includes("c.role!=='module'"),'registered runtime modules are not duplicated by generic deck');
for(const id of ['dashboard-market','dashboard-watchlist','dashboard-pnl-history','dashboard-daily-pnl','dashboard-wealth','dashboard-allocation','portfolio-contribution','portfolio-recent','portfolio-allocation']) expect(screens.includes(`cardId:'${id}'`),`runtime module links to editor target ${id}`);

// Regression: FlowItem is the only owner of a nested data-frame width. The inner block must fill that cell.
expect(screens.includes('customWidth={template.fieldConfigs?.[k]?.customWidth}><RenderFieldBlock')&&screens.includes('widthOverride="100%"'),'nested data frame fills FlowItem instead of applying span/custom width a second time');
// Regression: portfolio summary keeps amount and percentage as independent data cells.
expect(!screens.includes("`${money(portfolioSummary.todayPnl)} · ${pct(portfolioSummary.todayPnlPct)}`"),'portfolio today PnL no longer concatenates percentage into amount');
expect(!screens.includes("`${money(portfolioSummary.totalPnl)} · ${pct(portfolioSummary.totalRoi)}`"),'portfolio total PnL no longer concatenates percentage into amount');
expect(screens.includes('<Metric label="今日損益率"')&&screens.includes('<Metric label="總報酬率"'),'portfolio summary exposes separate PnL percentage cells');

const universal=read('src/ui/UniversalEditor.tsx');
const monitor=read('src/v3/monitoring.ts');
const monitorEditor=read('src/v3/MonitorFieldEditor.tsx');
const overlay=read('src/services/floatingOverlay.ts');
const nativeModule=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotModule.kt');
expect(universal.includes('ColorPalettePicker')&&!universal.includes('固定文字色 #RRGGBB'),'Universal Editor color editing uses palette instead of manual HEX input');
expect(universal.includes('FloatingEditorPreview')&&universal.includes('目前資料：{node.systemName}'),'movable live preview uses current node data');
expect(designer.includes('previewValuesByPage')&&designer.includes("previewValue??'—'"),'card/data-frame preview receives live current values');
expect(screens.includes('scope="daily-history"')&&screens.includes('scope="dividend-event"'),'blank Mini regression isolated from stale legacy editor-node ids');
expect(screens.includes('daily-pnl:${h.symbol}:amount')&&screens.includes('daily-pnl:${h.symbol}:rate'),'daily ETF PnL amount and rate are editable nodes');
expect(monitor.includes('fixed:boolean')&&monitorEditor.includes('固定此功能項目 📌'),'monitor items support pinned position');
expect(screens.includes('監視器即時預覽')&&screens.includes('監視器寬度 ${mp.width}px'),'monitor settings exposes live data preview and outer-frame width');
expect(overlay.includes('getFloatingOverlayLayoutSize')&&overlay.includes('setFloatingOverlayLayoutSize')&&nativeModule.includes('getLayoutSnapshot')&&nativeModule.includes('setLayoutSize'),'desktop monitor resize and settings size use bidirectional native sync');

if(process.exitCode) process.exit(process.exitCode);
console.log('V3.7 editor/module GOGO audit complete.');
