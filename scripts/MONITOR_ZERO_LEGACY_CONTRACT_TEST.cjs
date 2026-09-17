const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const expect=(ok,msg)=>{if(!ok)throw new Error(msg)};

const required=[
 'src/types/monitor.ts',
 'src/utils/monitorColorResolver.ts',
 'src/engine/MonitorRefreshEngine.ts',
 'src/adapters/MonitorStorageAdapter.ts',
 'src/context/MonitorContext.tsx',
 'src/components/monitor/MiniMonitorContainer.tsx',
 'src/components/monitor/TemplateCard.tsx',
 'src/components/monitor/TemplateEditorModal.tsx',
 'src/components/monitor/PulseLight.tsx',
];
for(const file of required)expect(exists(file),`missing ${file}`);

const types=read('src/types/monitor.ts');
for(const token of [
 "'NORMAL' | 'MINI'",
 "'SINGLE_ROW' | 'DUAL_ROW' | 'LIST' | 'MINI_CARD' | 'GRID'",
 'normalLayout: WindowRect','miniLayout: WindowRect','isMinimized: boolean',
 'normalConfig: TemplateModeConfig','miniConfig: TemplateModeConfig','colorConfig: Record<string, MonitorColorConfig>',
 'portfolioSummary:','etfSummaries:','rawQuotes:'
])expect(types.includes(token),`monitor type contract missing: ${token}`);

const resolver=read('src/utils/monitorColorResolver.ts');
for(const token of ['resolveMonitorColor','PROFIT_LOSS','MARKET_QUOTE','GENERAL_TEXT','LIMIT_UP','LIMIT_DOWN'])expect(resolver.includes(token),`resolver contract missing: ${token}`);

const engine=read('src/engine/MonitorRefreshEngine.ts');
for(const token of ['class MonitorRefreshEngine','REFRESHING','SUCCESS','ERROR','PAUSED','subscribeSnapshot','subscribeStatus'])expect(engine.includes(token),`refresh engine contract missing: ${token}`);
expect(!engine.includes('setInterval(() => this.tick()'), 'refresh engine must not use overlapping setInterval ticks');

const storage=read('src/adapters/MonitorStorageAdapter.ts');
expect(storage.includes('monitor_settings_v3'),'storage key must be monitor_settings_v3');

const mini=read('src/components/monitor/MiniMonitorContainer.tsx');
for(const token of ['SINGLE_ROW','DUAL_ROW','LIST','MINI_CARD','GRID','onDoubleClick','stopPropagation'])expect(mini.includes(token),`mini monitor contract missing: ${token}`);
expect(!mini.includes('transform: scale'), 'mini monitor must not use transform: scale');

const card=read('src/components/monitor/TemplateCard.tsx');
expect(card.includes('300'),'short press threshold contract missing');
expect(card.includes('500'),'long press threshold contract missing');

const templates=read('src/v3/monitorTemplates.ts');
expect(templates.includes('normalConfig')&&templates.includes('miniConfig'),'templates must expose dual mode configs');

const overlay=read('src/services/floatingOverlay.ts');
expect(overlay.includes('normalLayout')&&overlay.includes('miniLayout')&&overlay.includes('isMinimized'),'overlay payload must carry isolated layouts');

console.log('MONITOR_ZERO_LEGACY_CONTRACT_TEST PASS');
