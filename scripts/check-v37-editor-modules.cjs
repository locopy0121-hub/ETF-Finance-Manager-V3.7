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
expect(storage.includes('const SCHEMA=14;'),'storage schema migrated to 14');
expect(storage.includes('requiredLayouts=makeDefaultPageLayouts'),'stored layouts merge newly required modules');
expect(designer.includes('【資料框】'),'deepest editor identifies data-frame level');
expect(designer.includes('【卡片框架】'),'card editor identifies card-frame level');
expect(designer.includes('【頁面框架】'),'page editor identifies page-frame level');
expect(designer.includes('customWidth'),'card editor exposes custom width');
expect(designer.includes('setConfigs(next);'),'deep data-frame save updates parent draft before returning');
expect(flow.includes('customWidth'),'runtime FlowItem supports custom width');
expect(screens.includes("c.role!=='module'"),'registered runtime modules are not duplicated by generic deck');
for(const id of ['dashboard-market','dashboard-watchlist','dashboard-pnl-history','dashboard-daily-pnl','dashboard-wealth','dashboard-allocation','portfolio-contribution','portfolio-recent','portfolio-allocation']) expect(screens.includes(`cardId:'${id}'`),`runtime module links to editor target ${id}`);

// Regression: FlowItem is the only owner of a nested data-frame width. The inner block must fill that cell.
expect(screens.includes('customWidth={template.fieldConfigs?.[k]?.customWidth}><RenderFieldBlock')&&screens.includes('widthOverride="100%"'),'nested data frame fills FlowItem instead of applying span/custom width a second time');
// Regression: portfolio summary keeps amount and percentage as independent data cells.
expect(!screens.includes("`${money(portfolioSummary.todayPnl)} · ${pct(portfolioSummary.todayPnlPct)}`"),'portfolio today PnL no longer concatenates percentage into amount');
expect(!screens.includes("`${money(portfolioSummary.totalPnl)} · ${pct(portfolioSummary.totalRoi)}`"),'portfolio total PnL no longer concatenates percentage into amount');
expect(screens.includes('<Metric label="今日損益率"')&&screens.includes('<Metric label="總報酬率"'),'portfolio summary exposes separate PnL percentage cells');

if(process.exitCode) process.exit(process.exitCode);
console.log('V3.7 editor/module GOGO audit complete.');
