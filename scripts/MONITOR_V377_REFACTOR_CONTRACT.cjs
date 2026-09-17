const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const checks=[];
const expect=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw new Error(`FAIL: ${name}`)};

const types=read('src/types/monitor.ts');
expect('dual layout contract',types.includes('normalLayout: WindowRect')&&types.includes('miniLayout: WindowRect')&&types.includes('isMinimized: boolean'));
expect('five mini layouts',/SINGLE_ROW/.test(types)&&/DUAL_ROW/.test(types)&&/LIST/.test(types)&&/MINI_CARD/.test(types)&&/GRID/.test(types));
expect('pulse states',/IDLE/.test(types)&&/REFRESHING/.test(types)&&/SUCCESS/.test(types)&&/ERROR/.test(types)&&/PAUSED/.test(types));
expect('template dual configs',types.includes('normalConfig: TemplateModeConfig')&&types.includes('miniConfig: TemplateModeConfig'));

const resolver=read('src/utils/monitorColorResolver.ts');
expect('single color resolver exported',resolver.includes('export const resolveMonitorColor'));
expect('general text cannot inherit pnl',resolver.includes("targetType === 'GENERAL_TEXT'"));
expect('market quote limit colors',resolver.includes("case 'LIMIT_UP'")&&resolver.includes("case 'LIMIT_DOWN'"));

const engine=read('src/engine/MonitorRefreshEngine.ts');
expect('single-flight refresh guard',engine.includes('inFlight'));
expect('pause state',engine.includes("setStatus('PAUSED')"));
expect('immutable snapshot',engine.includes('Object.freeze'));
expect('interval reschedule',engine.includes('setIntervalSeconds'));

const storage=read('src/adapters/MonitorStorageAdapter.ts');
expect('monitor storage v3 key',storage.includes('monitor_settings_v3'));
expect('monitor settings persistence',storage.includes('normalLayout')&&storage.includes('miniLayout')&&storage.includes('templateOverrides'));

const templates=read('src/v3/monitorTemplates.ts');
expect('templates carry normal and mini config',templates.includes('normalConfig')&&templates.includes('miniConfig'));
expect('template reset helper',templates.includes('resetMonitorTemplateToDefault'));

const overlay=read('src/services/floatingOverlay.ts');
expect('overlay payload carries dual layouts',overlay.includes('normalLayout')&&overlay.includes('miniLayout')&&overlay.includes('isMinimized'));
expect('overlay payload carries mini config',overlay.includes('miniConfig'));
expect('overlay payload carries color target metadata',overlay.includes('colorTargets'));

const nativeModule=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotModule.kt');
expect('native snapshot exposes normal mini layouts',nativeModule.includes('normalLayout')&&nativeModule.includes('miniLayout')&&nativeModule.includes('isMinimized'));

console.log(`PASS ${checks.length} monitor refactor contracts`);
