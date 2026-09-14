from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')

def rep(path: str, old: str, new: str, label: str) -> None:
    text = read(path)
    if new in text:
        print('SKIP', label)
        return
    if old not in text:
        raise RuntimeError(f'Missing pattern {label} in {path}')
    write(path, text.replace(old, new, 1))
    print('PATCH', label)

def regex_rep(path: str, pattern: str, new: str, label: str, flags: int = 0) -> None:
    text = read(path)
    if new in text:
        print('SKIP', label)
        return
    changed, count = re.subn(pattern, lambda _m: new, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'Missing regex {label} in {path}')
    write(path, changed)
    print('PATCH', label)

# Version identity. V3.7 upgrades V3.6 while keeping the production package.
app_path = ROOT / 'app.json'
app = json.loads(app_path.read_text(encoding='utf-8'))
app['expo']['name'] = 'ETF財務管家 V3.7.0 NATIVE'
app['expo']['version'] = '3.7.0'
app['expo']['runtimeVersion'] = '3.7.0'
app['expo']['android']['versionCode'] = 38
app['expo']['ios']['buildNumber'] = '38'
app_path.write_text(json.dumps(app, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '3.7.0'
pkg['scripts']['audit:v370'] = 'node scripts/V370_UPGRADE_AUDIT.cjs'
pkg['scripts']['check:v370'] = 'node scripts/V370_UPGRADE_AUDIT.cjs && node scripts/FINANCE_ENGINE_V342_TEST.cjs && node scripts/FORMULA_ENGINE_V342_TEST.cjs && node scripts/V340_FIX1_REGRESSION_AUDIT.cjs && node scripts/DIVIDEND_CUTOFF_TEST.cjs && tsc --noEmit'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock['version'] = '3.7.0'
if '' in lock.get('packages', {}):
    lock['packages']['']['version'] = '3.7.0'
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

rep('src/v3/version.ts',
    "export const APP_DISPLAY_VERSION = 'V3.6.0 NATIVE · COMPLETE';\nexport const APP_SEMVER='3.6.0';\nexport const OTA_RUNTIME_VERSION='3.6.0';",
    "export const APP_DISPLAY_VERSION = 'V3.7.0 NATIVE · COMPLETE';\nexport const APP_SEMVER='3.7.0';\nexport const OTA_RUNTIME_VERSION='3.7.0';",
    'version constants')
rep('android/app/build.gradle', '        versionCode 37\n        versionName "3.6.0"', '        versionCode 38\n        versionName "3.7.0"', 'native Android version')
rep('android/app/src/main/res/values/strings.xml',
    '<string name="app_name">ETF財務管家 V3.6.0 NATIVE</string>\n  <string name="expo_runtime_version">3.6.0</string>',
    '<string name="app_name">ETF財務管家 V3.7.0 NATIVE</string>\n  <string name="expo_runtime_version">3.7.0</string>',
    'native labels')

# Model: global edit mode, reusable configurations, and card data-frame gap.
rep('src/v3/model.ts',
    "export type V3PageCard={id:string;title:string;kind:'system'|'custom'|'chart'|'mixed';role?:'summary'|'listTemplate'|'normal';fields:string[];fieldSpans?:Record<string,V3CardSpan>;fieldConfigs?:Record<string,V3FieldConfig>;chartConfig?:V3ChartConfig;x:number;y:number;w:number;h:number;hidden:boolean;style:V3CardStyle};\nexport type V3PageLayout={columns:5|6;cards:V3PageCard[]};\nexport type V3PageLayouts=Record<PageFieldKey,V3PageLayout>;",
    "export type V3PageCard={id:string;title:string;kind:'system'|'custom'|'chart'|'mixed';role?:'summary'|'listTemplate'|'normal';fields:string[];fieldSpans?:Record<string,V3CardSpan>;fieldConfigs?:Record<string,V3FieldConfig>;fieldGap?:number;chartConfig?:V3ChartConfig;x:number;y:number;w:number;h:number;hidden:boolean;style:V3CardStyle};\nexport type V3PageLayout={columns:5|6;cards:V3PageCard[]};\nexport type V3PageLayouts=Record<PageFieldKey,V3PageLayout>;\nexport type V3EditorPreset={id:string;name:string;page:PageFieldKey;cardId:string;card:V3PageCard;savedAt:number};",
    'editor preset model')
rep('src/v3/model.ts', '  immersiveEditor:boolean;\n  customThemes: CustomThemeSlot[];', '  immersiveEditor:boolean;\n  globalEditMode:boolean;\n  editorPresets:V3EditorPreset[];\n  customThemes: CustomThemeSlot[];', 'preferences editor fields')
rep('src/v3/model.ts', '  immersiveEditor:true,\n  customThemes:[],', '  immersiveEditor:true,\n  globalEditMode:false,\n  editorPresets:[],\n  customThemes:[],', 'editor defaults')

# Storage: repair only obviously degenerate legacy portfolio list layouts.
rep('src/v3/storage.ts', 'const SCHEMA=12;', 'const SCHEMA=13;', 'schema 13')
rep('src/v3/storage.ts', '   card.fieldConfigs=card.fieldConfigs??{};', '   card.fieldConfigs=card.fieldConfigs??{};\n   card.fieldGap=Math.max(0,Math.min(32,Number(card.fieldGap??7)));', 'normalize field gap')
rep('src/v3/storage.ts',
    " if(portfolio&&!portfolio.cards?.some((c:any)=>c.role==='listTemplate'||c.id==='portfolio-list')){\n  const src=portfolio.cards?.find((c:any)=>c.id==='portfolio-summary')??portfolio.cards?.[0];\n  if(src){const clone=JSON.parse(JSON.stringify(src));clone.id='portfolio-list';clone.title='庫存清單模板';clone.role='listTemplate';clone.y=(src.y??0)+(src.h??2);portfolio.cards.push(clone);}\n }",
    " if(portfolio&&!portfolio.cards?.some((c:any)=>c.role==='listTemplate'||c.id==='portfolio-list')){\n  const src=portfolio.cards?.find((c:any)=>c.id==='portfolio-summary')??portfolio.cards?.[0];\n  if(src){const clone=JSON.parse(JSON.stringify(src));clone.id='portfolio-list';clone.title='庫存清單模板';clone.role='listTemplate';clone.y=(src.y??0)+(src.h??2);portfolio.cards.push(clone);}\n }\n const portfolioList=portfolio?.cards?.find((c:any)=>c.role==='listTemplate'||c.id==='portfolio-list');\n if(portfolioList&&sourceSchema<13){\n  const spans=(portfolioList.fields??[]).map((k:string)=>Number(portfolioList.fieldConfigs?.[k]?.span??portfolioList.fieldSpans?.[k]??6));\n  const full=spans.filter((v:number)=>v===12).length;\n  if(spans.length>=4&&full>=Math.ceil(spans.length*.6)){\n   for(const key of portfolioList.fields??[]){\n    const cfg=portfolioList.fieldConfigs?.[key]??{};\n    if(Number(cfg.span??portfolioList.fieldSpans?.[key]??6)===12){portfolioList.fieldConfigs[key]={...cfg,span:6};portfolioList.fieldSpans[key]=6;}\n   }\n  }\n }",
    'portfolio legacy layout repair')
rep('src/v3/storage.ts',
    "editorNodes:{...defaultRegisteredNodes(),...(pp.editorNodes&&typeof pp.editorNodes==='object'?pp.editorNodes:{})},holdingFocusSort:",
    "globalEditMode:Boolean(pp.globalEditMode??false),editorPresets:Array.isArray(pp.editorPresets)?pp.editorPresets.slice(-30):[],editorNodes:{...defaultRegisteredNodes(),...(pp.editorNodes&&typeof pp.editorNodes==='object'?pp.editorNodes:{})},holdingFocusSort:",
    'persist editor mode and presets')

# Screens: keep the existing Universal Editor; add a global gate and direct frame editing.
rep('src/v3/screens.tsx',
    'type EditorRuntime={nodes:Record<string,UniversalEditorNode>;open:(node:UniversalEditorNode)=>void};',
    'type FrameEditorTarget={page:PageFieldKey;cardId:string};\ntype EditorRuntime={nodes:Record<string,UniversalEditorNode>;globalEditMode:boolean;open:(node:UniversalEditorNode)=>void;openFrame:(target:FrameEditorTarget)=>void};',
    'editor runtime')
rep('src/v3/screens.tsx',
    'export function V3ThemeProvider({prefs,onEditorNodesChange,children}:{prefs:V3Preferences;onEditorNodesChange?:(nodes:Record<string,UniversalEditorNode>)=>void;children:React.ReactNode}){',
    'export function V3ThemeProvider({prefs,onEditorNodesChange,onPreferencesChange,children}:{prefs:V3Preferences;onEditorNodesChange?:(nodes:Record<string,UniversalEditorNode>)=>void;onPreferencesChange?:(patch:Partial<V3Preferences>)=>void;children:React.ReactNode}){',
    'provider preferences callback')
rep('src/v3/screens.tsx',
    'const[clipboard,setClipboard]=useState<UniversalEditorNode|null>(null);',
    'const[clipboard,setClipboard]=useState<UniversalEditorNode|null>(null);const[frameTarget,setFrameTarget]=useState<FrameEditorTarget|null>(null);',
    'provider frame target')
rep('src/v3/screens.tsx',
    '<EditorCtx.Provider value={{nodes:prefs.editorNodes??{},open:setEditing}}>',
    '<EditorCtx.Provider value={{nodes:prefs.editorNodes??{},globalEditMode:prefs.globalEditMode,open:setEditing,openFrame:setFrameTarget}}>',
    'provider editor runtime')
rep('src/v3/screens.tsx',
    'onApplyScope={apply}/>:null}</EditorCtx.Provider>',
    "onApplyScope={apply}/>:null}<GlobalCardDesigner visible={!!frameTarget} layouts={prefs.pageLayouts} choicesByPage={Object.fromEntries((Object.keys(pageLabels) as PageFieldKey[]).map(k=>[k,pageFieldChoices[k].filter(([key])=>fieldAllowed(prefs,key)).map(([key,label])=>({key,label}))])) as any} entryTarget={frameTarget??undefined} directMode presets={prefs.editorPresets} onPresetsChange={editorPresets=>onPreferencesChange?.({editorPresets})} onSave={pageLayouts=>onPreferencesChange?.({pageLayouts})} onClose={()=>setFrameTarget(null)}/></EditorCtx.Provider>",
    'provider direct card editor')
rep('src/v3/screens.tsx',
    'onLongPress={()=>editor?.open(node)} accessibilityHint="長按開啟統一編輯器"',
    'onLongPress={p?.globalEditMode?()=>editor?.open(node):undefined} accessibilityHint={p?.globalEditMode?"長按開啟統一編輯器":undefined}',
    'gate text long press')
rep('src/v3/screens.tsx',
    'function Card({children,style}:{children:React.ReactNode;style?:any}){const p=theme();',
    'function Card({children,style,editTarget}:{children:React.ReactNode;style?:any;editTarget?:FrameEditorTarget}){const p=theme();const editor=useContext(EditorCtx);const wrap=(body:React.ReactNode)=>editTarget&&p?.globalEditMode?<Pressable onLongPress={()=>editor?.openFrame(editTarget)} delayLongPress={360}>{body}</Pressable>:body;',
    'editable card signature')
rep('src/v3/screens.tsx',
    'if(p?.cardBackgroundImageUri)return <View style={[base,{padding:0}]}>',
    'if(p?.cardBackgroundImageUri)return wrap(<View style={[base,{padding:0}]}>',
    'editable image card opening')
rep('src/v3/screens.tsx',
    '{children}</ImageBackground></View>;return <View style={base}>{children}</View>}',
    '{children}</ImageBackground></View>);return wrap(<View style={base}>{children}</View>)}',
    'editable card return')
rep('src/v3/screens.tsx',
    " {section==='cards'?<><Card><SectionTitle title=\"各頁自訂模式\" right=\"ON 解鎖 / OFF 鎖定\"/>",
    " {section==='cards'?<><Card><SectionTitle title=\"全局修改模式\" right={prefs.globalEditMode?'ON':'OFF'}/><ToggleSetting label=\"開啟全局修改模式\" value={prefs.globalEditMode} onChange={v=>onChange({globalEditMode:v})}/><Text style={s.note}>開啟後回到各頁：長按框架直接開啟框架編輯視窗；長按標題、名稱、數值會開啟既有 Universal Editor。儲存後回到原畫面，不跳回設定首頁。</Text></Card><Card><SectionTitle title=\"各頁自訂模式\" right=\"ON 解鎖 / OFF 鎖定\"/>",
    'settings global edit switch')

# Homepage market list: compact by default, expandable on demand.
rep('src/v3/screens.tsx',
    " const [marketFilter,setMarketFilter]=useState<'all'|'watchlist'|'held'|'popular'>('all');",
    " const [marketFilter,setMarketFilter]=useState<'all'|'watchlist'|'held'|'popular'>('all');\n const [marketExpanded,setMarketExpanded]=useState(false);",
    'market expanded state')
rep('src/v3/screens.tsx',
    ' const selected=common.prefs.watchlistSymbols??[];',
    ' const visibleRanked=marketExpanded?ranked.slice(0,5):ranked.slice(0,3);\n const visibleResults=query.trim()?results:(marketExpanded?results:results.slice(0,5));\n const selected=common.prefs.watchlistSymbols??[];',
    'market compact lists')
rep('src/v3/screens.tsx', 'ranked.slice(0,5).map((x,i)=>', 'visibleRanked.map((x,i)=>', 'market ranking compact')
rep('src/v3/screens.tsx', '{results.length?results.map(x=>', '{visibleResults.length?visibleResults.map(x=>', 'market candidates compact')
rep('src/v3/screens.tsx',
    '</View></Card>\n </>;\n}\n\nfunction EtfRiskResearch',
    "</View>{!query.trim()&&results.length>5?<TouchableOpacity style={s.secondary} onPress={()=>setMarketExpanded(v=>!v)}><Text style={s.secondaryText}>{marketExpanded?'收合市場列表':'展開市場列表'} · {results.length} 檔</Text></TouchableOpacity>:null}</Card>\n </>;\n}\n\nfunction EtfRiskResearch",
    'market expand collapse button')

# Long-press frame editing for page cards and the portfolio shared list template.
regex_rep('src/v3/screens.tsx', r'return <Card key=\{card\.id\} style=', 'return <Card key={card.id} editTarget={{page,cardId:card.id}} style=', 'page card long press')
rep('src/v3/screens.tsx',
    "<View style={{flexDirection:'row',flexWrap:'wrap',gap:7,flex:1,width:'100%'}}>",
    "<View style={{flexDirection:'row',flexWrap:'wrap',gap:card.fieldGap??7,flex:1,width:'100%'}}>",
    'card field gap')
rep('src/v3/screens.tsx', 'if(template&&prefs){return <FlowLayout>{fields.map(k=>', 'if(template&&prefs){return <FlowLayout gap={template.fieldGap??7}>{fields.map(k=>', 'template field gap')
rep('src/v3/screens.tsx', "return <Card key={h.symbol} style={s.portCard}>", "return <Card key={h.symbol} editTarget={{page:'portfolio',cardId:'portfolio-list'}} style={s.portCard}>", 'portfolio frame long press')

# Existing GlobalCardDesigner is extended, not replaced.
rep('src/v3/GlobalCardDesigner.tsx',
    "V3VerticalAlign, V3ChartConfig } from './model';",
    "V3VerticalAlign, V3ChartConfig, V3EditorPreset } from './model';",
    'designer preset import')
rep('src/v3/GlobalCardDesigner.tsx',
    "const [fields,setFields]=useState<string[]>([]); const [configs,setConfigs]=useState<Record<string,V3FieldConfig>>({});",
    "const [fields,setFields]=useState<string[]>([]); const [fieldGap,setFieldGap]=useState(7); const [configs,setConfigs]=useState<Record<string,V3FieldConfig>>({});",
    'designer field gap state')
rep('src/v3/GlobalCardDesigner.tsx',
    'setFields([...card.fields]);const c:Record<string,V3FieldConfig>={};',
    'setFields([...card.fields]);setFieldGap(card.fieldGap??7);const c:Record<string,V3FieldConfig>={};',
    'designer load field gap')
rep('src/v3/GlobalCardDesigner.tsx',
    ' const labels=Object.fromEntries(choices.map(c=>[c.key,c.label])); const toggle=',
    " const labels=Object.fromEntries(choices.map(c=>[c.key,c.label])); const applyFramework=(span:V3CardSpan)=>setConfigs(cur=>Object.fromEntries(fields.map(k=>[k,{...(cur[k]??defaultField(span,style.align)),span}])) as Record<string,V3FieldConfig>); const toggle=",
    'framework helper')
rep('src/v3/GlobalCardDesigner.tsx',
    '<Text style={styles.label}>卡片內容資料方塊排版</Text><Text style={styles.help}>',
    '<Text style={styles.label}>資料框架快速排版</Text><View style={styles.toolbar}><TouchableOpacity style={styles.tool} onPress={()=>applyFramework(12)}><Text style={styles.toolText}>1 欄</Text></TouchableOpacity><TouchableOpacity style={styles.tool} onPress={()=>applyFramework(6)}><Text style={styles.toolText}>2 欄</Text></TouchableOpacity><TouchableOpacity style={styles.tool} onPress={()=>applyFramework(4)}><Text style={styles.toolText}>3 欄</Text></TouchableOpacity><TouchableOpacity style={styles.tool} onPress={()=>applyFramework(3)}><Text style={styles.toolText}>4 欄</Text></TouchableOpacity></View><Text style={styles.smallLabel}>資料框間距</Text><Step value={fieldGap} min={0} max={32} step={1} onChange={setFieldGap}/><Text style={styles.label}>卡片內容資料方塊排版</Text><Text style={styles.help}>',
    'framework controls')
rep('src/v3/GlobalCardDesigner.tsx',
    "onApply({title:title||'未命名卡片',fields,fieldSpans:spans,fieldConfigs:clean,style,chartConfig:",
    "onApply({title:title||'未命名卡片',fields,fieldSpans:spans,fieldConfigs:clean,fieldGap,style,chartConfig:",
    'save field gap')
rep('src/v3/GlobalCardDesigner.tsx',
    'export function GlobalCardDesigner({visible,layouts,choicesByPage,onSave,onClose}:{visible:boolean;layouts:V3PageLayouts;choicesByPage:Record<PageFieldKey,DesignerChoice[]>;onSave:(layouts:V3PageLayouts)=>void;onClose:()=>void}){',
    'export function GlobalCardDesigner({visible,layouts,choicesByPage,onSave,onClose,entryTarget,directMode=false,presets=[],onPresetsChange}:{visible:boolean;layouts:V3PageLayouts;choicesByPage:Record<PageFieldKey,DesignerChoice[]>;onSave:(layouts:V3PageLayouts)=>void;onClose:()=>void;entryTarget?:{page:PageFieldKey;cardId:string};directMode?:boolean;presets?:V3EditorPreset[];onPresetsChange?:(presets:V3EditorPreset[])=>void}){',
    'designer direct props')
rep('src/v3/GlobalCardDesigner.tsx',
    "const [page,setPage]=useState<PageFieldKey>('dashboard'); const [selectedId,setSelectedId]",
    "const [page,setPage]=useState<PageFieldKey>('dashboard'); const [loadedPreset,setLoadedPreset]=useState<V3EditorPreset|null>(null); const [selectedId,setSelectedId]",
    'designer preset state')
rep('src/v3/GlobalCardDesigner.tsx',
    "useEffect(()=>{if(visible){setLocal(JSON.parse(JSON.stringify(layouts)));setPage('dashboard');setHistory([]);setFuture([]);setSelectedId(layouts.dashboard.cards[0]?.id??'');setDragging(false);setDetailOpen(false)}},[visible,layouts]);",
    "useEffect(()=>{if(visible){const targetPage=entryTarget?.page??'dashboard';const targetId=entryTarget?.cardId??layouts[targetPage].cards[0]?.id??'';setLocal(JSON.parse(JSON.stringify(layouts)));setPage(targetPage);setHistory([]);setFuture([]);setSelectedId(targetId);setLoadedPreset(null);setDragging(false);setDetailOpen(Boolean(entryTarget))}},[visible,layouts,entryTarget?.page,entryTarget?.cardId]);",
    'direct target startup')
rep('src/v3/GlobalCardDesigner.tsx',
    'const persistCard=(id:string,patch:Partial<V3PageCard>)=>{',
    "const pagePresets=presets.filter(p=>p.page===page); const savePreset=()=>{if(!selected||!onPresetsChange)return;const preset:V3EditorPreset={id:'preset-'+Date.now(),name:pageNames[page]+'｜'+selected.title+'｜'+new Date().toLocaleString('zh-TW'),page,cardId:selected.id,card:JSON.parse(JSON.stringify(selected)),savedAt:Date.now()};onPresetsChange([...presets.slice(-29),preset]);setLoadedPreset(preset)}; const persistCard=(id:string,patch:Partial<V3PageCard>)=>{",
    'preset save action')
rep('src/v3/GlobalCardDesigner.tsx',
    'const moveCard=(id:string,x:number,y:number)=>patchCard(id,{x,y});',
    "const writePreset=()=>{if(!selected||!loadedPreset)return;const patch=JSON.parse(JSON.stringify(loadedPreset.card)) as V3PageCard;delete (patch as any).id;persistCard(selected.id,patch)}; const moveCard=(id:string,x:number,y:number)=>patchCard(id,{x,y});",
    'preset write action')
rep('src/v3/GlobalCardDesigner.tsx',
    '<TouchableOpacity style={styles.bigGear} onPress={()=>setDetailOpen(true)}><Text style={styles.bigGearText}>⚙ 開啟單卡資料 / 內容排版 / 外觀設定</Text></TouchableOpacity><Text style={styles.label}>卡片本體快速尺寸</Text>',
    '<TouchableOpacity style={styles.bigGear} onPress={()=>setDetailOpen(true)}><Text style={styles.bigGearText}>⚙ 開啟單卡資料 / 內容排版 / 外觀設定</Text></TouchableOpacity><Text style={styles.label}>配置儲存 / 讀取 / 寫入</Text><View style={styles.row}><TouchableOpacity style={styles.secondary} onPress={savePreset}><Text style={styles.secondaryText}>儲存目前配置</Text></TouchableOpacity><TouchableOpacity style={[styles.secondary,!loadedPreset&&{opacity:.45}]} disabled={!loadedPreset} onPress={writePreset}><Text style={styles.secondaryText}>寫入目前卡片</Text></TouchableOpacity></View>{pagePresets.slice().reverse().slice(0,5).map(p=><View key={p.id} style={styles.panelHead}><Text style={[styles.miniMuted,{flex:1}]} numberOfLines={1}>{p.name}</Text><TouchableOpacity style={styles.micro} onPress={()=>setLoadedPreset(p)}><Text style={styles.microText}>讀取</Text></TouchableOpacity></View>)}{loadedPreset?<Text style={styles.miniMuted}>已讀取：{loadedPreset.name}；按「寫入目前卡片」才會套用。</Text>:null}<Text style={styles.label}>卡片本體快速尺寸</Text>',
    'preset UI')
rep('src/v3/GlobalCardDesigner.tsx',
    'onApply={patch=>selected&&persistCard(selected.id,patch)} onClose={()=>setDetailOpen(false)}/>',
    'onApply={patch=>selected&&persistCard(selected.id,patch)} onClose={()=>{setDetailOpen(false);if(directMode)onClose()}}/>',
    'direct mode return origin')

# Root persists direct editor changes while the current screen remains mounted.
rep('App.tsx',
    '<V3ThemeProvider prefs={p} onEditorNodesChange={editorNodes=>patch(s=>({...s,preferences:{...s.preferences,editorNodes}}))}>',
    '<V3ThemeProvider prefs={p} onEditorNodesChange={editorNodes=>patch(s=>({...s,preferences:{...s.preferences,editorNodes}}))} onPreferencesChange={prefPatch=>patch(s=>({...s,preferences:{...s.preferences,...prefPatch}}))}>',
    'root preference persistence')

print('V3.7 upgrade patch complete.')
