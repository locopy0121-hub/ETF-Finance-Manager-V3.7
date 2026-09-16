from pathlib import Path


def patch(path, old, new, count=1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'PATCH TARGET NOT FOUND: {path}: {old[:160]}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')

# Model: custom data-frame width and explicit registry-only module role.
patch('src/v3/model.ts',
      "export type V3FieldConfig={span:V3CardSpan;height:V3FieldHeight;customHeight?:number;label:V3TextConfig;value:V3TextConfig;labelValueGap?:number;backgroundOpacity:number;backgroundColor?:string;borderColor?:string;radius:number;padding:number;paddingTop?:number;paddingRight?:number;paddingBottom?:number;paddingLeft?:number;effect?:V3FieldEffect;effectStrength?:number};",
      "export type V3FieldConfig={span:V3CardSpan;height:V3FieldHeight;customHeight?:number;customWidth?:number;label:V3TextConfig;value:V3TextConfig;labelValueGap?:number;backgroundOpacity:number;backgroundColor?:string;borderColor?:string;radius:number;padding:number;paddingTop?:number;paddingRight?:number;paddingBottom?:number;paddingLeft?:number;effect?:V3FieldEffect;effectStrength?:number};")
patch('src/v3/model.ts', "role?:'summary'|'listTemplate'|'normal';", "role?:'summary'|'listTemplate'|'normal'|'module';")

old_layouts = """  dashboard:{columns:6,cards:[hero,card('dashboard-core-2','資產與現金',homeCards[1]??[],0,3,3,2),card('dashboard-core-3','損益與股息',homeCards[2]??[],3,3,3,2)]},
  ledger:{columns:6,cards:[card('ledger-summary','智慧記帳摘要',pageFields.ledger??[],0,0,6,2)]},
  portfolio:{columns:6,cards:[{...card('portfolio-summary','庫存摘要',pageFields.portfolio??[],0,0,6,2),role:'summary'},{...card('portfolio-list','庫存清單模板',pageFields.portfolio??[],0,2,6,2),role:'listTemplate'}]},"""
new_layouts = """  dashboard:{columns:6,cards:[hero,card('dashboard-core-2','資產與現金',homeCards[1]??[],0,3,3,2),card('dashboard-core-3','損益與股息',homeCards[2]??[],3,3,3,2),{...card('dashboard-market','市場總覽｜熱門 ETF',[],0,5,6,2),role:'module'},{...card('dashboard-watchlist','ETF 搜尋 / 自選管理',[],0,7,6,2),role:'module'},{...card('dashboard-pnl-history','累積損益紀錄',[],0,9,6,2),role:'module'},{...card('dashboard-daily-pnl','每日損益紀錄',[],0,11,6,2),role:'module'},{...card('dashboard-wealth','資產成長｜投入 vs 資產',[],0,13,6,2),role:'module'},{...card('dashboard-allocation','資產配置',[],0,15,6,2),role:'module'}]},
  ledger:{columns:6,cards:[card('ledger-summary','智慧記帳摘要',pageFields.ledger??[],0,0,6,2)]},
  portfolio:{columns:6,cards:[{...card('portfolio-summary','庫存摘要',pageFields.portfolio??[],0,0,6,2),role:'summary'},{...card('portfolio-list','庫存清單模板',pageFields.portfolio??[],0,2,6,2),role:'listTemplate'},{...card('portfolio-contribution','損益貢獻排行',[],0,4,6,2),role:'module'},{...card('portfolio-recent','最近交易 / 股息',[],0,6,6,2),role:'module'},{...card('portfolio-allocation','ETF 市值配置',[],0,8,6,2),role:'module'}]},"""
patch('src/v3/model.ts', old_layouts, new_layouts)

# Existing user migration: append missing registered system modules without erasing custom layouts.
patch('src/v3/storage.ts', 'const SCHEMA=13;', 'const SCHEMA=14;')
marker = """ const pageLayouts=JSON.parse(JSON.stringify(rawLayouts));
 for(const layout of Object.values(pageLayouts) as any[]){"""
replacement = """ const pageLayouts=JSON.parse(JSON.stringify(rawLayouts));
 const requiredLayouts=makeDefaultPageLayouts(home,pageCardFields);
 for(const pageKey of Object.keys(requiredLayouts) as Array<keyof typeof requiredLayouts>){
  const target=(pageLayouts as any)[pageKey];const required=(requiredLayouts as any)[pageKey];
  if(!target){(pageLayouts as any)[pageKey]=JSON.parse(JSON.stringify(required));continue;}
  target.cards=Array.isArray(target.cards)?target.cards:[];
  const ids=new Set(target.cards.map((c:any)=>c.id));
  for(const requiredCard of required.cards??[])if(!ids.has(requiredCard.id))target.cards.push(JSON.parse(JSON.stringify(requiredCard)));
 }
 for(const layout of Object.values(pageLayouts) as any[]){"""
patch('src/v3/storage.ts', marker, replacement)

# Flow layout: custom pixel width, clamped against real measured parent width.
patch('src/ui/FlowLayout.tsx',
      "export function FlowItem({span=12,gap,minWidth=72,children,style}:{span?:V3CardSpan;gap?:number;minWidth?:number;children:React.ReactNode;style?:ViewStyle}){",
      "export function FlowItem({span=12,gap,minWidth=72,customWidth,children,style}:{span?:V3CardSpan;gap?:number;minWidth?:number;customWidth?:number;children:React.ReactNode;style?:ViewStyle}){")
patch('src/ui/FlowLayout.tsx',
      " const target=flowItemWidth(span,available,effectiveGap);\n return <View style={[{width:Math.min(available,Math.max(minWidth,target)),maxWidth:'100%',flexGrow:span===12?1:0},style]}>{children}</View>;",
      " const target=customWidth&&customWidth>0?Math.min(available,customWidth):flowItemWidth(span,available,effectiveGap);\n return <View style={[{width:Math.min(available,Math.max(Math.min(minWidth,available),target)),maxWidth:'100%',flexGrow:span===12&&!customWidth?1:0},style]}>{children}</View>;")

# Designer hierarchy labels, width editing, and one-level-back save behavior.
patch('src/v3/GlobalCardDesigner.tsx', '<Text style={styles.floatTitle}>資料方塊設定｜{label}</Text>', '<Text style={styles.floatTitle}>【資料框】資料方塊設定｜{label}</Text>')
patch('src/v3/GlobalCardDesigner.tsx',
      "</View><Text style={styles.label}>高度</Text><View style={styles.segmentRow}>{heights.map",
      "</View><Text style={styles.label}>欄寬</Text><Text style={styles.miniMuted}>0 = 跟隨上方比例；也可像高度一樣微調實際資料框寬度。</Text><Step value={Number(local.customWidth)||0} min={0} max={420} step={4} onChange={v=>setLocal({...local,customWidth:v||undefined})}/><Text style={styles.label}>高度</Text><View style={styles.segmentRow}>{heights.map")
patch('src/v3/GlobalCardDesigner.tsx',
      '<Text style={styles.title}>單卡設計器</Text><Text style={styles.sub}>點選任一資料方塊開啟浮動設定；支援整列 / 3/4 / 2/3 / 1/2 / 1/3 / 1/4 與獨立高度。</Text>',
      '<Text style={styles.title}>【卡片框架】單卡設計器</Text><Text style={styles.sub}>目前層級：卡片框架 → 資料框。點選資料框後進下一層；支援比例、自訂欄寬與獨立高度。</Text>')
patch('src/v3/GlobalCardDesigner.tsx', 'style={[styles.innerBlock,{width:spanWidth(cfg.span),minHeight:fieldHeight(cfg)', 'style={[styles.innerBlock,{width:cfg.customWidth&&cfg.customWidth>0?Math.min(420,cfg.customWidth):spanWidth(cfg.span),minHeight:fieldHeight(cfg)')
patch('src/v3/GlobalCardDesigner.tsx', '<Text style={styles.innerMeta}>{spanLabel(cfg.span)} · {hLabel(cfg.height)} · 名稱/數值分離</Text>', '<Text style={styles.innerMeta}>資料框 · {cfg.customWidth&&cfg.customWidth>0?`${cfg.customWidth}px`:spanLabel(cfg.span)} · {hLabel(cfg.height)} · 名稱/數值分離</Text>')
patch('src/v3/GlobalCardDesigner.tsx',
      '<Text style={styles.title}>全局卡片版面設計器</Text><Text style={styles.sub}>卡片本體使用格線；單卡內資料方塊改為 12 格比例 + 個別高度 + 浮動設定。</Text>',
      '<Text style={styles.title}>【頁面框架】全局卡片版面設計器</Text><Text style={styles.sub}>目前層級：頁面框架 → 卡片框架 → 資料框；每層儲存只回上一層。單卡內支援比例、自訂欄寬與個別高度。</Text>')
patch('src/v3/GlobalCardDesigner.tsx', "<Text style={styles.canvasMeta}>{card.kind==='system'?'系統卡':card.kind==='chart'?'圖表方塊':card.kind==='mixed'?'數據＋圖表':'自訂卡'} · {card.fields.length} 欄位</Text>", "<Text style={styles.canvasMeta}>框架 · {card.kind==='system'?'系統卡':card.kind==='chart'?'圖表方塊':card.kind==='mixed'?'數據＋圖表':'自訂卡'} · {card.fields.length} 欄位</Text>")
patch('src/v3/GlobalCardDesigner.tsx', '}},[visible,layouts,entryTarget?.page,entryTarget?.cardId]);', '}},[visible,entryTarget?.page,entryTarget?.cardId]);')
old_nested = """onSave={c=>{if(!editingKey)return;const next={...configs,[editingKey]:c};setConfigs(next);const spans=Object.fromEntries(fields.map(k=>[k,(next[k]??defaultField()).span])) as Record<string,V3CardSpan>;onApply({fields:[...fields],fieldSpans:spans,fieldConfigs:next});}} onClose={()=>setEditingKey(null)}"""
new_nested = """onSave={c=>{if(!editingKey)return;const next={...configs,[editingKey]:c};setConfigs(next);}} onClose={()=>setEditingKey(null)}"""
patch('src/v3/GlobalCardDesigner.tsx', old_nested, new_nested)

# Runtime: honor custom width, register real visible modules, and avoid duplicate registry-only rendering.
patch('src/v3/screens.tsx', 'width:widthOverride??spanWidth(cfg.span),...hs,', "width:widthOverride??(cfg.customWidth&&cfg.customWidth>0?cfg.customWidth:spanWidth(cfg.span)),maxWidth:'100%',...hs,")
patch('src/v3/screens.tsx', '<FlowItem key={k} span={template.fieldConfigs?.[k]?.span??template.fieldSpans?.[k]??6}>', '<FlowItem key={k} span={template.fieldConfigs?.[k]?.span??template.fieldSpans?.[k]??6} customWidth={template.fieldConfigs?.[k]?.customWidth}>')
patch('src/v3/screens.tsx', "filter(c=>!c.hidden&&c.role!=='listTemplate')", "filter(c=>!c.hidden&&c.role!=='listTemplate'&&c.role!=='module')")

old_card = """function Card({children,style,editTarget}:{children:React.ReactNode;style?:any;editTarget?:FrameEditorTarget}){const p=theme();const editor=useContext(EditorCtx);const wrap=(body:React.ReactNode)=>editTarget&&p?.globalEditMode?<Pressable onLongPress={()=>editor?.openFrame(editTarget)} delayLongPress={360}>{body}</Pressable>:body;const base=[s.card,p&&{borderRadius:p.cardRadius,backgroundColor:`rgba(22,31,48,${Math.max(.35,Math.min(1,p.cardOpacity/100))})`},style];"""
new_card = """function Card({children,style,editTarget}:{children:React.ReactNode;style?:any;editTarget?:FrameEditorTarget}){const p=theme();const editor=useContext(EditorCtx);const registered=editTarget?p?.pageLayouts?.[editTarget.page]?.cards?.find(c=>c.id===editTarget.cardId):undefined;if(registered?.hidden)return null;const wrap=(body:React.ReactNode)=>editTarget&&p?.globalEditMode?<Pressable onLongPress={()=>editor?.openFrame(editTarget)} delayLongPress={360}>{body}</Pressable>:body;const registeredStyle=registered?{borderRadius:registered.style.radius,backgroundColor:`rgba(22,31,48,${Math.max(.2,Math.min(1,registered.style.backgroundOpacity/100))})`,padding:registered.style.padding}:undefined;const base=[s.card,p&&{borderRadius:p.cardRadius,backgroundColor:`rgba(22,31,48,${Math.max(.35,Math.min(1,p.cardOpacity/100))})`},registeredStyle,p?.globalEditMode&&editTarget?{borderWidth:1.5,borderColor:p.accentColor}:undefined,style];"""
patch('src/v3/screens.tsx', old_card, new_card)

patch('src/v3/screens.tsx', '<Card><SectionTitle title="市場總覽｜熱門 ETF"', '<Card editTarget={{page:\'dashboard\',cardId:\'dashboard-market\'}}><SectionTitle title="市場總覽｜熱門 ETF"')
patch('src/v3/screens.tsx', '<Card><SectionTitle title="ETF 搜尋 / 自選管理"', '<Card editTarget={{page:\'dashboard\',cardId:\'dashboard-watchlist\'}}><SectionTitle title="ETF 搜尋 / 自選管理"')
patch('src/v3/screens.tsx', '<TouchableOpacity onPress={()=>setPnlOpen(true)}><Card><SectionTitle title="累積損益紀錄"', '<TouchableOpacity onPress={()=>setPnlOpen(true)}><Card editTarget={{page:\'dashboard\',cardId:\'dashboard-pnl-history\'}}><SectionTitle title="累積損益紀錄"')
patch('src/v3/screens.tsx', 'function DailyPnLHistory({snapshots,prefs,holdings}:{snapshots:DailySnapshot[];prefs:V3Preferences;holdings:Holding[]})', 'function DailyPnLHistory({snapshots,prefs,holdings,editTarget}:{snapshots:DailySnapshot[];prefs:V3Preferences;holdings:Holding[];editTarget?:FrameEditorTarget})')
patch('src/v3/screens.tsx', 'if(!snapshots.length)return <Card><SectionTitle title="每日損益紀錄"', 'if(!snapshots.length)return <Card editTarget={editTarget}><SectionTitle title="每日損益紀錄"')
patch('src/v3/screens.tsx', 'return <Card><SectionTitle title="每日損益紀錄" right={`${rows.length} 日`}/>', 'return <Card editTarget={editTarget}><SectionTitle title="每日損益紀錄" right={`${rows.length} 日`}/>')
patch('src/v3/screens.tsx', '<DailyPnLHistory snapshots={dailySnapshots} prefs={prefs} holdings={common.holdings}/>', '<DailyPnLHistory snapshots={dailySnapshots} prefs={prefs} holdings={common.holdings} editTarget={{page:\'dashboard\',cardId:\'dashboard-daily-pnl\'}}/>')
patch('src/v3/screens.tsx', '<Card><SectionTitle title="資產成長｜投入 vs 資產"', '<Card editTarget={{page:\'dashboard\',cardId:\'dashboard-wealth\'}}><SectionTitle title="資產成長｜投入 vs 資產"')
patch('src/v3/screens.tsx', '<Card><SectionTitle title="資產配置" right={`${holdings.length} 檔 ETF`}/>', '<Card editTarget={{page:\'dashboard\',cardId:\'dashboard-allocation\'}}><SectionTitle title="資產配置" right={`${holdings.length} 檔 ETF`}/>')

patch('src/v3/screens.tsx', '<Card><SectionTitle title="整體庫存總覽"', '<Card editTarget={{page:\'portfolio\',cardId:\'portfolio-summary\'}}><SectionTitle title="整體庫存總覽"')
patch('src/v3/screens.tsx', '</Card><Card><SectionTitle title="損益貢獻排行"', '</Card><Card editTarget={{page:\'portfolio\',cardId:\'portfolio-contribution\'}}><SectionTitle title="損益貢獻排行"')
patch('src/v3/screens.tsx', '</Card><Card><SectionTitle title="最近交易 / 股息"', '</Card><Card editTarget={{page:\'portfolio\',cardId:\'portfolio-recent\'}}><SectionTitle title="最近交易 / 股息"')
patch('src/v3/screens.tsx', '<Card><SectionTitle title="ETF 市值配置"', '<Card editTarget={{page:\'portfolio\',cardId:\'portfolio-allocation\'}}><SectionTitle title="ETF 市值配置"')

Path('scripts/V370_EDITOR_GOGO_AUDIT.cjs').write_text("""const fs=require('fs');
const model=fs.readFileSync('src/v3/model.ts','utf8'),storage=fs.readFileSync('src/v3/storage.ts','utf8'),designer=fs.readFileSync('src/v3/GlobalCardDesigner.tsx','utf8'),screens=fs.readFileSync('src/v3/screens.tsx','utf8'),flow=fs.readFileSync('src/ui/FlowLayout.tsx','utf8');
const must=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exit(1)}console.log('PASS:',msg)};
must(model.includes('customWidth?:number'),'custom data-frame width');
const ids=['dashboard-core-1','dashboard-core-2','dashboard-core-3','dashboard-market','dashboard-watchlist','dashboard-pnl-history','dashboard-daily-pnl','dashboard-wealth','dashboard-allocation'];ids.forEach(id=>must(model.includes(`'${id}'`),`dashboard ${id}`));must(ids.length===9,'dashboard has 9 registered modules');
['portfolio-summary','portfolio-list','portfolio-contribution','portfolio-recent','portfolio-allocation'].forEach(id=>must(model.includes(`'${id}'`),`portfolio ${id}`));
must(storage.includes('const SCHEMA=14;')&&storage.includes('requiredLayouts=makeDefaultPageLayouts'),'existing-state registry migration');
must(designer.includes('【資料框】')&&designer.includes('【卡片框架】')&&designer.includes('【頁面框架】'),'component hierarchy labels');
must(designer.includes('customWidth:v||undefined'),'custom width editor control');
must(flow.includes('customWidth?:number'),'FlowItem custom width');
must(screens.includes("c.role!=='module'"),'module registry does not duplicate rendering');
must(screens.includes("cardId:'dashboard-market'")&&screens.includes("cardId:'portfolio-contribution'"),'runtime modules linked to registered frames');
console.log('V3.7 editor/module GOGO audit complete.');\n""", encoding='utf-8')
print('V3.7 targeted editor/module fixes applied.')
