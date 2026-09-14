const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const checks=[
 ['watchlist persisted separately',/watchlistSymbols:string\[\]/.test(read('src/v3/model.ts'))],
 ['watchlist excluded from finance engine',!read('src/v3/engine.ts').includes('watchlistSymbols')],
 ['six flow widths',/12:1,9:\.75,8:2\/3,6:\.5,4:1\/3,3:\.25/.test(read('src/ui/FlowLayout.tsx'))],
 ['keyboard aware shared scroll',read('src/ui/KeyboardAware.tsx').includes('automaticallyAdjustKeyboardInsets')],
 ['universal editor mounted',read('src/v3/screens.tsx').includes('<UniversalEditor visible')],
 ['universal editor persisted',read('App.tsx').includes('onEditorNodesChange')],
 ['flow layout rendered',read('src/v3/screens.tsx').includes('<FlowLayout')&&read('src/v3/screens.tsx').includes('<FlowItem')],
 ['keyboard aware rendered',(read('src/v3/screens.tsx').match(/<KeyboardAwareScrollView/g)||[]).length>=3],
 ['effects stack has 10+ effects',(read('src/ui/editorSchema.ts').match(/\|'/g)||[]).length>=10],
 ['effects controls are stackable',read('src/ui/UniversalEditor.tsx').includes('moveEffect')&&read('src/ui/UniversalEditor.tsx').includes('EffectEditor')],
 ['native monitor scrolls',read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt').includes('val scroll=ScrollView')],
 ['watchlist supports drag ordering',read('src/v3/screens.tsx').includes('WatchDragHandle')],
 ['cross-renderer registry',read('src/ui/universalRegistry.ts').includes('widget:root:title')&&read('src/ui/universalRegistry.ts').includes('overlay:field:')&&read('src/ui/universalRegistry.ts').includes('legacy:')],
 ['widget consumes universal nodes',read('src/widgets/ProfitWidget.tsx').includes('rendererNode(extras.universalNodes')],
 ['overlay consumes universal nodes',read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt').includes('private fun uiNode')],
 ['advanced effects renderer',read('src/ui/EffectSurface.tsx').includes("effect.kind==='gradient'")&&read('src/ui/EffectSurface.tsx').includes("effect.kind==='innerGlow'")&&read('src/ui/EffectSurface.tsx').includes("effect.kind==='shimmer'")],
 ['editor size controls',read('src/ui/UniversalEditor.tsx').includes('SizeControls')&&read('src/ui/UniversalEditor.tsx').includes('寬度比例')&&read('src/ui/UniversalEditor.tsx').includes('最大高度')],
 ['editor data controls',read('src/ui/UniversalEditor.tsx').includes('DataControls')&&read('src/ui/UniversalEditor.tsx').includes('Field binding')&&read('src/ui/UniversalEditor.tsx').includes('損益判定來源')],
 ['editor interaction controls',read('src/ui/UniversalEditor.tsx').includes('InteractionControls')&&read('src/ui/UniversalEditor.tsx').includes('doubleTap')&&read('src/ui/UniversalEditor.tsx').includes('導航目標')],
 ['editor advanced controls',read('src/ui/UniversalEditor.tsx').includes('AdvancedControls')&&read('src/ui/UniversalEditor.tsx').includes('Conditional visibility')&&read('src/ui/UniversalEditor.tsx').includes('Object capability flags')],
 ['single extended editor schema',read('src/ui/editorSchema.ts').includes('UniversalSizeConfig')&&read('src/ui/editorSchema.ts').includes('UniversalDataConfig')&&read('src/ui/editorSchema.ts').includes('UniversalInteractionConfig')&&read('src/ui/editorSchema.ts').includes('UniversalAdvancedConfig')],
 ['generated inventory has no gaps',(()=>{const x=JSON.parse(read('docs/generated/ui-literal-inventory.json'));return x.records.length>0&&x.records.every(r=>r.classification==='universal-editor'||r.classification==='system-fixed')})()],
 ['12 monitor templates',(read('src/v3/monitorTemplates.ts').match(/\{id:/g)||[]).length>=12],
 ['immersive navigation bridge',read('App.tsx').includes('setImmersiveEditor(true)')],
 ['safe area bottom edge',read('App.tsx').includes("edges={['top','left','right','bottom']}" )],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1);
