from pathlib import Path
import json,re

ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text(encoding='utf-8')
def write(p,s): (ROOT/p).write_text(s,encoding='utf-8')
def rep(p,old,new,count=1):
    s=read(p)
    if old not in s: raise SystemExit(f'MISSING TARGET in {p}: {old[:140]!r}')
    if count is not None and s.count(old)<count: raise SystemExit(f'COUNT TARGET in {p}')
    s=s.replace(old,new,count if count is not None else -1)
    write(p,s)

def regex_rep(p,pattern,repl,count=1,flags=0):
    s=read(p); n=re.subn(pattern,repl,s,count=count,flags=flags)
    if n[1]!=count: raise SystemExit(f'REGEX TARGET {p}: expected {count}, got {n[1]} for {pattern[:100]}')
    write(p,n[0])

def replace_function(p,start_marker,next_marker,new_func):
    s=read(p); start=s.find(start_marker)
    if start<0: raise SystemExit(f'FUNCTION START missing {p}: {start_marker}')
    end=s.find(next_marker,start+len(start_marker))
    if end<0: raise SystemExit(f'FUNCTION END missing {p}: {next_marker}')
    write(p,s[:start]+new_func+'\n\n'+s[end:])

# 1) Finance: signed cash is part of total assets; negative cash must not disappear.
rep('src/v3/engine.ts',' const totalAssets=marketValue+Math.max(0,Number(cashBalance)||0);',' const totalAssets=marketValue+(Number.isFinite(Number(cashBalance))?Number(cashBalance):0);')

# 2) Overlay payload: template/default composition + canonical cash-aware finance snapshot.
rep('src/services/floatingOverlay.ts',
" const fields:MonitorField[]=[...(profile?.fields?.length?profile.fields:template.fields)];",
" const fields:MonitorField[]=[...(profile?.fieldsCustomized===true&&profile?.fields?.length?profile.fields:template.fields)];")
rep('src/services/floatingOverlay.ts',
"  mode:template.columns>1?'puzzle':'table',displayMode:profile?.displayMode??'holdingList',template:template.id,title:profile?.title??'即時監控器'",
"  mode:template.nativeMode,displayMode:profile?.displayMode??'holdingList',template:template.id,templateFields:template.fields,title:profile?.title??'即時監控器'")
rep('src/services/floatingOverlay.ts',
"  instantPnl:m.totalPnl,todayPnl:m.todayPnl,totalAssets:m.totalAssets,marketValue:m.marketValue,totalCost:m.currentTradeCost,totalRoi:m.totalRoi,",
"  instantPnl:m.priceUnrealizedPnl,todayPnl:m.todayPnl,totalAssets:m.totalAssets,marketValue:m.marketValue,cashBalance:m.cashBalance,totalCost:m.currentTradeCost,totalRoi:m.currentTradeCost>0?m.priceUnrealizedPnl/m.currentTradeCost*100:0,")

# 3) Storage recovery: migrate blank scoped Mini editor nodes once, keep all other editor customizations.
rep('src/v3/storage.ts','const SCHEMA=15;','const SCHEMA=16;')
rep('src/v3/storage.ts',
" const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);",
" const migratedEditorNodes=(pp.editorNodes&&typeof pp.editorNodes==='object')?{...pp.editorNodes}:{};\n if(sourceSchema<16){for(const id of Object.keys(migratedEditorNodes))if(id.startsWith('metric:daily-history:')||id.startsWith('metric:dividend-event:'))delete migratedEditorNodes[id];}\n const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);")
rep('src/v3/storage.ts',
"editorNodes:{...defaultRegisteredNodes(),...(pp.editorNodes&&typeof pp.editorNodes==='object'?pp.editorNodes:{})}",
"editorNodes:{...defaultRegisteredNodes(),...migratedEditorNodes}")

# 4) Screens: explicit monitor target router + safe legacy node normalization.
rep('src/v3/screens.tsx',
"import type { MonitorField, MonitorProfile } from './monitoring';",
"import type { MonitorDisplayMode, MonitorField, MonitorProfile } from './monitoring';")
rep('src/v3/screens.tsx',
"import { MONITOR_TEMPLATES } from './monitorTemplates';",
"import { MONITOR_TEMPLATES, monitorTemplate, templateDefaultFields } from './monitorTemplates';")
rep('src/v3/screens.tsx',
"import { defaultTextStyle,displayNameOf,effectsStyle,resolveColor,textStyleFor,type EditableUiKind,type UniversalEditorNode } from '../ui/editorSchema';",
"import { defaultTextStyle,displayNameOf,effectsStyle,resolveColor,textStyleFor,withUniversalDefaults,type EditableUiKind,type UniversalEditorNode } from '../ui/editorSchema';")

old_default="const defaultNode=(id:string,kind:EditableUiKind,name:string,style?:Partial<ReturnType<typeof defaultTextStyle>>):UniversalEditorNode=>({id,kind,systemName:name,text:{...defaultTextStyle(),...style},backgroundColorMode:'theme',borderColorMode:'theme',effects:[]});"
new_default=old_default+"\nfunction normalizeEditorNodeForRender(base:UniversalEditorNode,saved?:UniversalEditorNode):UniversalEditorNode{return withUniversalDefaults({...base,...(saved??{}),text:{...base.text,...(saved?.text??{})},effects:Array.isArray(saved?.effects)?saved.effects:base.effects});}"
rep('src/v3/screens.tsx',old_default,new_default)
old_use="function useEditorNode(id:string,kind:EditableUiKind,systemName:string,style?:any){const editor=useContext(EditorCtx);const flat=StyleSheet.flatten(style)||{};const base=defaultNode(id,kind,systemName,{fontSize:Number(flat.fontSize)||14,fontWeight:flat.fontWeight||'700'});return {editor,node:{...base,...editor?.nodes[id],text:{...base.text,...editor?.nodes[id]?.text}} as UniversalEditorNode}}"
new_use="function useEditorNode(id:string,kind:EditableUiKind,systemName:string,style?:any){const editor=useContext(EditorCtx);const flat=StyleSheet.flatten(style)||{};const base=defaultNode(id,kind,systemName,{fontSize:Number(flat.fontSize)||14,fontWeight:flat.fontWeight||'700'});return {editor,node:normalizeEditorNodeForRender(base,editor?.nodes[id])}}"
rep('src/v3/screens.tsx',old_use,new_use)

choice_line="function Choice({active,label,onPress}:{active:boolean;label:string;onPress:()=>void}){const p=theme();const id=label.replace(/\\s/g,'-');return <TouchableOpacity onPress={onPress} style={[s.choice,active&&s.choiceActive,active&&{borderColor:p?.accentColor??'#d4af37'}]}><EditableText id={`button:${id}:label`} kind=\"button\" systemName={label} style={[s.choiceText,{color:p?.secondaryTextColor??'rgba(255,255,255,.55)'},active&&{color:p?.accentColor??'#f3d675'}]}/></TouchableOpacity>}"
monitor_helpers=choice_line+"\nfunction MonitorChoice({active,label,onPress}:{active:boolean;label:string;onPress:()=>void}){const p=theme();return <TouchableOpacity onPress={onPress} style={[s.choice,active&&s.choiceActive,active&&{borderColor:p?.accentColor??'#d4af37'}]}><Text style={[s.choiceText,{color:p?.secondaryTextColor??'rgba(255,255,255,.55)'},active&&{color:p?.accentColor??'#f3d675'}]}>{label}</Text></TouchableOpacity>}\nfunction MonitorFieldPicker({choices,selected,onToggle,onEdit}:{choices:Array<[MonitorField,string]>;selected:MonitorField[];onToggle:(key:MonitorField)=>void;onEdit:(key:MonitorField)=>void}){return <View style={s.wrapRow}>{choices.map(([key,label])=><View key={key} style={{flexDirection:'row',alignItems:'center',gap:4}}><MonitorChoice active={selected.includes(key)} label={label} onPress={()=>onToggle(key)}/>{selected.includes(key)?<TouchableOpacity style={s.monitorEditBtn} onPress={()=>onEdit(key)}><Text style={s.monitorEditText}>✎</Text></TouchableOpacity>:null}</View>)}</View>}"
rep('src/v3/screens.tsx',choice_line,monitor_helpers)

settings_marker='export function SettingsModal('
template_editor="""function MonitorTemplateEditor({visible,templateId,profile,labels,values,prefs,onClose,onApply,onEditField}:{visible:boolean;templateId:MonitorDisplayMode|null;profile:MonitorProfile;labels:Record<string,string>;values:Record<string,string>;prefs:V3Preferences;onClose:()=>void;onApply:(fields:MonitorField[])=>void;onEditField:(field:MonitorField)=>void}){if(!templateId)return null;const template=monitorTemplate(templateId);const previewProfile:MonitorProfile={...profile,displayMode:template.id,fields:[...template.fields],fieldsCustomized:false};return <Modal visible={visible} transparent animationType=\"slide\" onRequestClose={onClose}><View style={s.modalBackdrop}><View style={[s.sheet,{maxHeight:'90%',padding:16}]}><SectionTitle title=\"模板內容與組合項目\" right={template.name}/><Text style={s.note}>這裡編輯的是桌面即時監控器的組合式模板外皮與內容，不是設定頁按鈕。模板負責組合；每一個資料項目仍可獨立進入單項編輯。</Text><ScrollView contentContainerStyle={{paddingBottom:12}}><MonitorLivePreview profile={previewProfile} ordered={template.fields} labels={labels} values={values} prefs={prefs}/><Text style={[s.settingLabel,{marginTop:12}]}>模板組合項目</Text>{template.fields.map((key,index)=><View key={key} style={s.monitorOrderRow}><Text style={s.monitorOrderIndex}>{index+1}</Text><View style={{flex:1}}><Text style={s.monitorOrderLabel}>{labels[key]??key}</Text><Text style={s.muted}>{values[key]??'—'}</Text></View><TouchableOpacity style={s.monitorEditBtn} onPress={()=>onEditField(key)}><Text style={s.monitorEditText}>✎ 單項編輯</Text></TouchableOpacity></View>)}</ScrollView><TouchableOpacity style={s.primary} onPress={()=>onApply(templateDefaultFields(template.id))}><Text style={s.primaryText}>✓ 套用此模板組合</Text></TouchableOpacity><TouchableOpacity style={s.secondary} onPress={onClose}><Text style={s.secondaryText}>返回監視器設定</Text></TouchableOpacity></View></View></Modal>}\n\n"""
s=read('src/v3/screens.tsx')
idx=s.find(settings_marker)
if idx<0: raise SystemExit('SettingsModal marker missing')
if 'function MonitorTemplateEditor' not in s:
    s=s[:idx]+template_editor+s[idx:]
    write('src/v3/screens.tsx',s)

rep('src/v3/screens.tsx',
"const [monitorFieldEdit,setMonitorFieldEdit]=useState<MonitorField|null>(null);",
"const [monitorFieldEdit,setMonitorFieldEdit]=useState<MonitorField|null>(null); const [monitorTemplateEdit,setMonitorTemplateEdit]=useState<MonitorDisplayMode|null>(null);")
rep('src/v3/screens.tsx',
"const editing=!!(designerOpen||layoutEditor||monitorFieldEdit);",
"const editing=!!(designerOpen||layoutEditor||monitorFieldEdit||monitorTemplateEdit);")
rep('src/v3/screens.tsx',
"[designerOpen,layoutEditor,monitorFieldEdit,prefs.immersiveEditor]",
"[designerOpen,layoutEditor,monitorFieldEdit,monitorTemplateEdit,prefs.immersiveEditor]")

old_templates="<SettingRow label=\"共用模板（12 種）\"><View style={s.wrapRow}>{MONITOR_TEMPLATES.map(t=><Choice key={t.id} active={mp.displayMode===t.id} label={t.name} onPress={()=>patchMonitor({displayMode:t.id})}/>)}</View></SettingRow>"
new_templates="<SettingRow label=\"共用模板（12 種）\"><View style={s.wrapRow}>{MONITOR_TEMPLATES.map(t=><MonitorChoice key={t.id} active={mp.displayMode===t.id} label={t.name} onPress={()=>{patchMonitor({displayMode:t.id,fields:templateDefaultFields(t.id),fieldsCustomized:false});setMonitorTemplateEdit(t.id)}}/>)}</View></SettingRow>"
rep('src/v3/screens.tsx',old_templates,new_templates)

# Any manual ordering/selection/editing becomes a custom composition while retaining template surface/styles.
s=read('src/v3/screens.tsx')
s=s.replace("patchMonitor({fields:next,fieldStyles:","patchMonitor({fields:next,fieldsCustomized:true,fieldStyles:")
old_picker="<SettingRow label=\"新增 / 移除顯示項目\"><FieldPicker choices={monitorFields} selected={mp.fields} onToggle={k=>{const key=k as MonitorField;patchMonitor({fields:mp.fields.includes(key)?mp.fields.filter(x=>x!==key):[...mp.fields,key]})}}/></SettingRow>"
new_picker="<SettingRow label=\"新增 / 移除顯示項目\"><MonitorFieldPicker choices={monitorFields} selected={mp.fields} onToggle={key=>patchMonitor({fields:mp.fields.includes(key)?mp.fields.filter(x=>x!==key):[...mp.fields,key],fieldsCustomized:true})} onEdit={key=>setMonitorFieldEdit(key)}/></SettingRow>"
if old_picker not in s: raise SystemExit('monitor field picker target missing')
s=s.replace(old_picker,new_picker,1)
old_field_editor="<MonitorFieldEditor visible={!!monitorFieldEdit} field={monitorFieldEdit} style={monitorFieldEdit?mp.fieldStyles?.[monitorFieldEdit]:undefined} orderMax={Math.max(1,mp.fields.length)} positive={prefs.positiveColor} negative={prefs.negativeColor} sampleValue={monitorFieldEdit?monitorSample[monitorFieldEdit]:undefined} onClose={()=>setMonitorFieldEdit(null)} onSave={cfg=>{if(!monitorFieldEdit)return;const target=Math.max(1,Math.min(mp.fields.length,cfg.order));const list=ordered.filter(x=>x!==monitorFieldEdit);list.splice(target-1,0,monitorFieldEdit);patchMonitor({fields:list,fieldStyles:{...mp.fieldStyles,...Object.fromEntries(list.map((k,i)=>[k,{...(mp.fieldStyles?.[k]??{}),...(k===monitorFieldEdit?cfg:{}),order:i+1}]))} as any});setMonitorFieldEdit(null)}}/>"
new_field_editor="<MonitorTemplateEditor visible={!!monitorTemplateEdit} templateId={monitorTemplateEdit} profile={mp} labels={monitorLabels} values={monitorSample} prefs={prefs} onClose={()=>setMonitorTemplateEdit(null)} onApply={fields=>{patchMonitor({fields,fieldsCustomized:false});setMonitorTemplateEdit(null)}} onEditField={key=>{setMonitorTemplateEdit(null);setMonitorFieldEdit(key)}}/><MonitorFieldEditor visible={!!monitorFieldEdit} field={monitorFieldEdit} style={monitorFieldEdit?mp.fieldStyles?.[monitorFieldEdit]:undefined} orderMax={Math.max(1,mp.fields.length)} positive={prefs.positiveColor} negative={prefs.negativeColor} sampleValue={monitorFieldEdit?monitorSample[monitorFieldEdit]:undefined} onClose={()=>setMonitorFieldEdit(null)} onSave={cfg=>{if(!monitorFieldEdit)return;const target=Math.max(1,Math.min(mp.fields.length,cfg.order));const list=ordered.filter(x=>x!==monitorFieldEdit);list.splice(target-1,0,monitorFieldEdit);patchMonitor({fields:list,fieldsCustomized:true,fieldStyles:{...mp.fieldStyles,...Object.fromEntries(list.map((k,i)=>[k,{...(mp.fieldStyles?.[k]??{}),...(k===monitorFieldEdit?cfg:{}),order:i+1}]))} as any});setMonitorFieldEdit(null)}}/>"
if old_field_editor not in s: raise SystemExit('monitor field editor target missing')
s=s.replace(old_field_editor,new_field_editor,1)
write('src/v3/screens.tsx',s)

# 5) Native Overlay: strip size, cash-aware totals, dynamic puzzle composition.
rep('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt',
'      "transparent" -> 180 to 54\n      else -> 94 to 66',
'      "transparent" -> 180 to 54\n      "strip" -> 238 to 58\n      else -> 94 to 66')
rep('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt',
'        payload.put("instantPnl", instant)\n        payload.put("todayPnl", todayTotal)\n        payload.put("totalAssets", totalAssets)\n        payload.put("marketValue", totalAssets)',
'        val cashBalance = payload.optDouble("cashBalance", 0.0)\n        payload.put("instantPnl", instant)\n        payload.put("todayPnl", todayTotal)\n        payload.put("totalAssets", totalAssets + cashBalance)\n        payload.put("marketValue", totalAssets)')

new_puzzle=r'''  private fun renderPuzzleOverlay() {
    val host=root?:return;host.removeAllViews();host.setPadding(dp(7),dp(6),dp(7),dp(6))
    val positive=parseColor(payload.optString("positive","#E54A45"),Color.rgb(229,74,69));val negative=parseColor(payload.optString("negative","#12A875"),Color.rgb(18,168,117));val neutral=parseColor(payload.optString("neutral","#94A3B8"),Color.LTGRAY);val accent=parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN);val textColor=parseColor(payload.optString("textColor","#FFFFFF"),Color.WHITE)
    fun plain(v:String,sz:Float=10f,bold:Boolean=false,c:Int=Color.WHITE)=TextView(this).apply{text=v;textSize=sz*payload.optDouble("fontScale",1.0).toFloat();setTextColor(c);setPadding(dp(5),dp(3),dp(5),dp(3));if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);maxLines=2}
    val header=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};header.addView(plain(payload.optString("title","即時監控器"),12f,true,accent),LinearLayout.LayoutParams(0,dp(30),1f));if(payload.optBoolean("showBreathingLight",true))header.addView(plain("● ${payload.optString("statusTitle","市場狀態")}",8f,false,neutral),LinearLayout.LayoutParams(dp(92),dp(30)));val minimize=plain("—",13f,true,neutral).apply{setOnClickListener{toggleFavoriteSize()}};header.addView(minimize,LinearLayout.LayoutParams(dp(30),dp(30)));val close=plain("✕",12f,true,neutral).apply{setOnClickListener{root?.visibility=View.GONE}};header.addView(close,LinearLayout.LayoutParams(dp(30),dp(30)));host.addView(header)
    val rawFields=payload.optJSONArray("fields") ?: payload.optJSONArray("templateFields") ?: JSONArray().put("symbol").put("price").put("instantPnl")
    val fields=mutableListOf<String>();for(i in 0 until rawFields.length()){val k=rawFields.optString(i);if(fieldStyle(k).optBoolean("visible",true))fields.add(k)}
    val labels=mapOf("symbol" to "代號","name" to "名稱","price" to "即時行情","change" to "漲跌","changePct" to "漲跌幅","shares" to "持有股數","marketValue" to "市值","pureCost" to "純成本","instantPnl" to "庫存損益","instantRoi" to "庫存報酬率","todayPnl" to "今日損益","todayPnlPct" to "今日損益率","previousClose" to "昨收","open" to "開盤","high" to "最高","low" to "最低","volume" to "成交量","nav" to "NAV","premium" to "折溢價","updatedAt" to "更新時間","totalAssets" to "總資產","dividend" to "股息事件").mapValues{(k,v)->uiName("overlay:field:$k",v)}
    val summaryKeys=setOf("totalAssets","marketValue","instantPnl","todayPnl","updatedAt","dividend")
    fun summaryValue(key:String):String=when(key){"totalAssets"->money(payload.optDouble("totalAssets",0.0));"marketValue"->money(payload.optDouble("marketValue",0.0));"instantPnl"->signedMoney(payload.optDouble("instantPnl",0.0));"todayPnl"->signedMoney(payload.optDouble("todayPnl",0.0));"updatedAt"->payload.optString("updatedAt","--:--:--");"dividend"->if(payload.optString("dividendSymbol").isNotBlank())"${payload.optString("dividendSymbol")} ${payload.optString("dividendDate","--")} ${money(payload.optDouble("dividendAmount",0.0))}" else "目前無待發放配息";else->"—"}
    fun summaryPnl(key:String):Double?=when(key){"instantPnl"->payload.optDouble("instantPnl",0.0);"todayPnl"->payload.optDouble("todayPnl",0.0);else->null}
    fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"change","changePct"->pos.optDouble("change",0.0);"premium"->pos.optDouble("premium",0.0);else->null}
    fun valueFor(key:String,pos:JSONObject):String=when(key){"symbol"->pos.optString("symbol","--");"name"->pos.optString("name","--");"price"->pos.optDouble("price",0.0).fmt2();"change"->signed2(pos.optDouble("change",0.0));"changePct"->signed2(pos.optDouble("changePct",0.0))+"%";"shares"->money(pos.optDouble("shares",0.0));"marketValue"->money(pos.optDouble("marketValue",0.0));"pureCost"->money(pos.optDouble("pureCost",0.0));"instantPnl"->signedMoney(pos.optDouble("instantPnl",0.0));"instantRoi"->signed2(pos.optDouble("instantRoi",0.0))+"%";"todayPnl"->signedMoney(pos.optDouble("todayPnl",0.0));"todayPnlPct"->signed2(pos.optDouble("todayPnlPct",0.0))+"%";"previousClose"->pos.optDouble("previousClose",0.0).fmt2();"open"->pos.optDouble("open",0.0).fmt2();"high"->pos.optDouble("high",0.0).fmt2();"low"->pos.optDouble("low",0.0).fmt2();"volume"->money(pos.optDouble("volume",0.0));"nav"->pos.optDouble("nav",0.0).fmt2();"premium"->signed2(pos.optDouble("premium",0.0))+"%";"updatedAt"->payload.optString("updatedAt","--:--:--");else->"—"}
    val widthDp=((params?.width?:dp(390))/resources.displayMetrics.density).toInt();val columns=if(widthDp>=470)3 else if(widthDp>=300)2 else 1;val grid=GridLayout(this).apply{columnCount=columns;rowCount=GridLayout.UNDEFINED;useDefaultMargins=true}
    fun addBox(key:String,title:String,value:String,pnlValue:Double?){val st=fieldStyle(key);val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;val pad=dp(st.optInt("padding",8));setPadding(pad,pad/2,pad,pad/2);background=GradientDrawable().apply{cornerRadius=dp(st.optInt("radius",10)).toFloat();val op=st.optInt("backgroundOpacity",16).coerceIn(0,100);setColor(withAlpha(parseColor(st.optString("backgroundColor","#FFFFFF"),Color.WHITE),(255*op/100.0).toInt()));setStroke(dp(if(st.optString("effect","none")=="outline")2 else 1),Color.argb(55,255,255,255))}};box.addView(styledFieldText(title,key,8f,true,neutral,null,2));val fallback=if(pnlValue==null)textColor else if(pnlValue>0)positive else if(pnlValue<0)negative else neutral;box.addView(styledFieldText(value,key,14f,true,fallback,pnlValue,2));val lp=GridLayout.LayoutParams().apply{width=0;height=android.view.ViewGroup.LayoutParams.WRAP_CONTENT;columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);setMargins(dp(2),dp(2),dp(2),dp(2))};grid.addView(box,lp)}
    for(key in fields.filter{summaryKeys.contains(it)})addBox(key,labels[key]?:key,summaryValue(key),summaryPnl(key))
    val positionFields=fields.filter{!summaryKeys.contains(it)}
    val rows=payload.optJSONArray("positions")?:JSONArray();val maxCards=min(rows.length(),payload.optInt("rows",6).coerceIn(1,12))
    for(i in 0 until maxCards){val pos=rows.optJSONObject(i)?:continue;if(positionFields.isEmpty())break;val key=positionFields.first();val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(8),dp(5),dp(8),dp(5));background=GradientDrawable().apply{cornerRadius=dp(fieldStyle(key).optInt("radius",10)).toFloat();setColor(Color.argb(38,255,255,255));setStroke(dp(1),Color.argb(45,255,255,255))}};for(field in positionFields){val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};row.addView(plain(labels[field]?:field,8f,false,neutral),LinearLayout.LayoutParams(0,dp(24),1f));val pv=pnlFor(field,pos);val fallback=if(pv==null)textColor else if(pv>0)positive else if(pv<0)negative else neutral;row.addView(styledFieldText(valueFor(field,pos),field,9f,true,fallback,pv,1),LinearLayout.LayoutParams(0,dp(24),1.15f));box.addView(row)};val lp=GridLayout.LayoutParams().apply{width=0;height=android.view.ViewGroup.LayoutParams.WRAP_CONTENT;columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);setMargins(dp(2),dp(2),dp(2),dp(2))};grid.addView(box,lp)}
    host.addView(grid,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));val locked=payload.optBoolean("locked",false);val footer=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};footer.addView(plain(if(locked)"🔒 桌面版面已鎖定" else "🔓 編輯中｜可拖移 · 右下角縮放",8f,false,neutral),LinearLayout.LayoutParams(0,dp(28),1f));if(!locked){val grip=plain("↘",16f,true,accent);footer.addView(grip,LinearLayout.LayoutParams(dp(36),dp(30)));installResizeTouch(grip)};host.addView(footer)
  }'''
replace_function('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt','  private fun renderPuzzleOverlay() {','  private fun refreshQuotesInBackground()',new_puzzle)

# 6) Version chain.
ver='src/v3/version.ts'; write(ver,"export const APP_SEMVER='3.7.3';\nexport const APP_BUILD=41;\nexport const APP_DISPLAY_VERSION=`V${APP_SEMVER}`;\nexport const APP_VERSION_LABEL=APP_DISPLAY_VERSION;\n")
app_path=ROOT/'app.json'; app=json.loads(app_path.read_text(encoding='utf-8')); expo=app['expo']; expo['name']='ETF財務管家 V3.7.3';expo['version']='3.7.3';expo['runtimeVersion']='3.7.3';expo['android']['versionCode']=41;expo['ios']['buildNumber']='41';app_path.write_text(json.dumps(app,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
regex_rep('android/app/build.gradle',r'versionCode\s+40','versionCode 41')
regex_rep('android/app/build.gradle',r'versionName\s+["\']3\.7\.2["\']','versionName "3.7.3"')
regex_rep('android/app/src/main/res/values/strings.xml',r'<string name="app_name">[^<]*</string>','<string name="app_name">ETF財務管家 V3.7.3 NATIVE</string>')
regex_rep('android/app/src/main/res/values/strings.xml',r'<string name="expo_runtime_version">[^<]*</string>','<string name="expo_runtime_version">3.7.3</string>')

print('APPLY_GOGO_V373: production patch applied')
