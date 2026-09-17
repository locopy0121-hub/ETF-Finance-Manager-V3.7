const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const checks=[];
const expect=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw new Error(`FAIL: ${name}`)};

const types=read('src/types/monitor.ts');
expect('dual layout contract',types.includes('normalLayout:WindowRect')||types.includes('normalLayout: WindowRect'));
expect('mini layout contract',types.includes('miniLayout:WindowRect')||types.includes('miniLayout: WindowRect'));
expect('minimized contract',types.includes('isMinimized:boolean')||types.includes('isMinimized: boolean'));
expect('five mini layouts',/SINGLE_ROW/.test(types)&&/DUAL_ROW/.test(types)&&/LIST/.test(types)&&/MINI_CARD/.test(types)&&/GRID/.test(types));
expect('pulse states',/IDLE/.test(types)&&/REFRESHING/.test(types)&&/SUCCESS/.test(types)&&/ERROR/.test(types)&&/PAUSED/.test(types));
expect('template dual configs',types.includes('normalConfig:TemplateModeConfig')&&types.includes('miniConfig:TemplateModeConfig'));

const resolver=read('src/utils/monitorColorResolver.ts');
expect('single color resolver exported',resolver.includes('export const resolveMonitorColor'));
expect('general text cannot inherit pnl',resolver.includes("targetType==='GENERAL_TEXT'"));
expect('market quote limit colors',resolver.includes("case 'LIMIT_UP'")&&resolver.includes("case 'LIMIT_DOWN'"));
expect('field target classification',resolver.includes('monitorColorTargetForField'));

const engine=read('src/engine/MonitorRefreshEngine.ts');
expect('single-flight refresh guard',engine.includes('inFlight'));
expect('pause state',engine.includes("setStatus('PAUSED')"));
expect('immutable snapshot',engine.includes('Object.freeze'));
expect('interval reschedule',engine.includes('setIntervalSeconds'));

const context=read('src/context/MonitorContext.tsx');
expect('shared snapshot context',context.includes('MonitorProvider')&&context.includes('useMonitorSnapshot'));
expect('pulse shares refresh engine',context.includes('monitorRefreshEngine'));

const storage=read('src/adapters/MonitorStorageAdapter.ts');
expect('monitor storage v3 key',storage.includes('monitor_settings_v3'));
expect('monitor settings persistence',storage.includes('normalLayout')&&storage.includes('miniLayout')&&storage.includes('templateOverrides'));

const templates=read('src/v3/monitorTemplates.ts');
expect('templates carry normal and mini config',templates.includes('normalConfig')&&templates.includes('miniConfig'));
expect('template reset helper',templates.includes('resetMonitorTemplateToDefault'));
expect('all 12 shared templates present',(templates.match(/tpl\('/g)||[]).length===12);

const screens=read('src/v3/screensBase.tsx');
expect('template long press editor',screens.includes('delayLongPress={500}')&&screens.includes('onLongPress={()=>setMonitorTemplateEdit(t.id)}'));
expect('mini settings expose five layouts',screens.includes('Mini 縮小模式')&&screens.includes("layoutType:'SINGLE_ROW'")&&screens.includes("layoutType:'GRID'"));
expect('mini independent size controls',screens.includes('Mini 寬度')&&screens.includes('Mini 高度'));

const fieldEditor=read('src/v3/MonitorFieldEditor.tsx');
expect('all monitor fields expose color source',fieldEditor.includes('顏色來源')&&fieldEditor.includes('跟隨主題一般色')&&fieldEditor.includes('自訂顏色'));
expect('semantic fields expose pnl theme color',fieldEditor.includes('跟隨主題損益色'));
const monitoring=read('src/v3/monitoring.ts');
expect('field style persists color mode',monitoring.includes("colorMode?:'CUSTOM'|'THEME_GENERAL'|'THEME_PROFIT_LOSS'"));

const overlay=read('src/services/floatingOverlay.ts');
expect('overlay payload carries dual layouts',overlay.includes('normalLayout')&&overlay.includes('miniLayout')&&overlay.includes('isMinimized'));
expect('overlay payload carries mini config',overlay.includes('miniConfig'));
expect('overlay payload carries color target metadata',overlay.includes('colorTargets'));

const nativeModule=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotModule.kt');
expect('native snapshot exposes normal mini layouts',nativeModule.includes('normalLayout')&&nativeModule.includes('miniLayout')&&nativeModule.includes('isMinimized'));
const nativeService=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt');
expect('native mini has independent renderer',nativeService.includes('renderMiniOverlay()'));
expect('native refresh is single flight',nativeService.includes('refreshInFlight'));
expect('native pulse supports paused success error',nativeService.includes('"PAUSED"')&&nativeService.includes('"SUCCESS"')&&nativeService.includes('"ERROR"'));
expect('native double tap restores isolated normal layout',nativeService.includes('restoreNormal()')&&nativeService.includes('store.minimize()'));
expect('native renderer reads semantic color targets',nativeService.includes('colorTargets')&&nativeService.includes('THEME_PROFIT_LOSS')&&nativeService.includes('GENERAL_TEXT'));
const nativeStore=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingMonitorLayoutStore.kt');
expect('native drag resize stores active layout only',nativeStore.includes('fun saveActive'));
expect('native payload cannot overwrite active mode',!nativeStore.match(/applyPayload[\s\S]{0,500}setMinimized\(/));

console.log(`PASS ${checks.length} monitor refactor contracts`);
