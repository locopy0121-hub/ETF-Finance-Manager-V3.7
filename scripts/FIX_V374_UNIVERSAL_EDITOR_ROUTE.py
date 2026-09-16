from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing target: {label}')
    return text.replace(old, new, 1)

# ---- GlobalCardDesigner: route frame / label / value through canonical UniversalEditor ----
p=Path('src/v3/GlobalCardDesigner.tsx')
s=p.read_text(encoding='utf-8')
s=replace_once(s,
"import ColorPalettePicker from '../components/ColorPalettePicker';",
"import ColorPalettePicker from '../components/ColorPalettePicker';\nimport { UniversalEditor } from '../ui/UniversalEditor';\nimport { defaultAdvancedConfig, defaultDataConfig, defaultSizeConfig, defaultTextStyle, withUniversalDefaults, type UniversalEditorNode } from '../ui/editorSchema';",
'import universal editor')

anchor="const fieldHeight=(c:V3FieldConfig)=>c.height==='auto'?74:c.height==='custom'?clamp(Number(c.customHeight)||86,48,260):58+(Number(c.height)-1)*32;"
helpers=r'''

type FieldEditTarget='frame'|'label'|'value';
export const fieldUniversalNodeId=(cardId:string,key:string,target:FieldEditTarget)=>`card:${cardId}:field:${key}:${target}`;
const spanToRatio=(span:V3CardSpan):'1'|'3/4'|'2/3'|'1/2'|'1/3'|'1/4'=>span===12?'1':span===9?'3/4':span===8?'2/3':span===6?'1/2':span===4?'1/3':'1/4';
const ratioToSpan=(ratio:string):V3CardSpan=>ratio==='1'?12:ratio==='3/4'?9:ratio==='2/3'?8:ratio==='1/2'?6:ratio==='1/3'?4:3;
const protectedFieldAdvanced=()=>{const a=defaultAdvancedConfig();return {...a,capabilities:{...a.capabilities,dataBinding:false},readonly:false}};
function fieldUniversalBaseNode(cardId:string,key:string,target:FieldEditTarget,label:string,cfg:V3FieldConfig):UniversalEditorNode{
 const id=fieldUniversalNodeId(cardId,key,target);const data={...defaultDataConfig(),source:'custom' as const,fieldBinding:key};const advanced=protectedFieldAdvanced();
 if(target==='frame')return withUniversalDefaults({id,kind:'card',systemName:`${label} 資料框`,text:{...defaultTextStyle(),visible:true},backgroundColorMode:cfg.backgroundColor?'fixed':'theme',backgroundColor:cfg.backgroundColor,borderColorMode:cfg.borderColor?'fixed':'theme',borderColor:cfg.borderColor,size:{...defaultSizeConfig(),widthMode:cfg.customWidth&&cfg.customWidth>0?'fixed':'ratio',widthRatio:spanToRatio(cfg.span),width:cfg.customWidth,autoHeight:cfg.height==='auto',height:cfg.height==='custom'?cfg.customHeight:undefined,minHeight:48,maxHeight:320,radius:cfg.radius},data,advanced:{...advanced,capabilities:{...advanced.capabilities,textStyle:false,dataBinding:false}},effects:[]});
 const legacy=target==='label'?cfg.label:cfg.value;const base=target==='label'?11:16;const fs=Math.max(8,base*(legacy.fontScale??100)/100);const mode=legacy.colorMode==='custom'?'fixed':legacy.colorMode==='profitLoss'?'profitLoss':'theme';
 return withUniversalDefaults({id,kind:target==='label'?'label':'value',systemName:`${label} ${target==='label'?'Label':'Value'}`,text:{...defaultTextStyle(),visible:legacy.visible,fontSize:fs,fontWeight:legacy.fontWeight,colorMode:mode,color:legacy.color,align:legacy.align,verticalAlign:legacy.verticalAlign,lineHeight:Math.max(8,fs*(legacy.lineHeightScale??125)/100)},data,advanced:{...advanced,capabilities:{...advanced.capabilities,dataBinding:false}},effects:[]});
}
function mergeFieldUniversalNode(base:UniversalEditorNode,saved?:UniversalEditorNode){if(!saved)return base;const advanced=base.advanced!;return withUniversalDefaults({...base,...saved,id:base.id,kind:base.kind,systemName:base.systemName,data:base.data,advanced:{...advanced,...saved.advanced,capabilities:{...advanced.capabilities,...saved.advanced?.capabilities,dataBinding:false}}});}
function applyUniversalToFieldConfig(cfg:V3FieldConfig,target:FieldEditTarget,node:UniversalEditorNode):V3FieldConfig{
 const n:V3FieldConfig=JSON.parse(JSON.stringify(cfg));
 if(target==='frame'){
  const z=node.size!;if(z.widthMode==='fixed'){n.customWidth=Math.max(40,Number(z.width)||120)}else{n.customWidth=undefined;if(z.widthMode==='fill')n.span=12;else if(z.widthMode==='ratio')n.span=ratioToSpan(z.widthRatio)}
  n.height=z.autoHeight?'auto':'custom';if(!z.autoHeight)n.customHeight=Math.max(48,Number(z.height)||86);n.radius=Math.max(0,Math.min(200,z.radius));n.backgroundColor=(node.backgroundColorMode==='fixed'||node.backgroundColorMode==='auto')?node.backgroundColor:undefined;n.borderColor=(node.borderColorMode==='fixed'||node.borderColorMode==='auto')?node.borderColor:undefined;return n;
 }
 const t=node.text!;const base=target==='label'?11:16;const legacy=target==='label'?n.label:n.value;legacy.visible=t.visible;legacy.fontScale=clamp(Math.round(t.fontSize/base*100),60,300);legacy.fontWeight=(t.fontWeight??'800') as any;legacy.align=t.align;legacy.verticalAlign=t.verticalAlign;legacy.lineHeightScale=clamp(Math.round((t.lineHeight/Math.max(1,t.fontSize))*100),80,300);if(t.colorMode==='fixed'||t.colorMode==='auto'){legacy.colorMode='custom';legacy.color=t.color}else if(t.colorMode==='profitLoss'){legacy.colorMode='profitLoss';legacy.color=undefined}else{legacy.colorMode='theme';legacy.color=undefined}return n;
}
'''
s=replace_once(s,anchor,anchor+helpers,'insert field universal helpers')

old_sig="function CardDetailEditor({visible,card,choices,previewValues,onApply,onClose}:{visible:boolean;card:V3PageCard|null;choices:DesignerChoice[];previewValues?:Record<string,string>;onApply:(patch:Partial<V3PageCard>)=>void;onClose:()=>void}){"
new_sig="function CardDetailEditor({visible,card,choices,previewValues,onApply,onClose,editorNodes={},onEditorNodesChange}:{visible:boolean;card:V3PageCard|null;choices:DesignerChoice[];previewValues?:Record<string,string>;onApply:(patch:Partial<V3PageCard>)=>void;onClose:()=>void;editorNodes?:Record<string,UniversalEditorNode>;onEditorNodesChange?:(nodes:Record<string,UniversalEditorNode>)=>void}){"
s=replace_once(s,old_sig,new_sig,'CardDetailEditor signature')
s=replace_once(s,"const [editingKey,setEditingKey]=useState<string|null>(null);","const [universalEdit,setUniversalEdit]=useState<{key:string;target:FieldEditTarget;node:UniversalEditorNode}|null>(null);",'editing state')
s=replace_once(s,"setEditingKey(null)}},[visible,card]);","setUniversalEdit(null)}},[visible,card]);",'reset editing state')

old_line="const labels=Object.fromEntries(choices.map(c=>[c.key,c.label])); const applyFramework=(span:V3CardSpan)=>setConfigs(cur=>Object.fromEntries(fields.map(k=>[k,{...(cur[k]??defaultField(span,style.align)),span}])) as Record<string,V3FieldConfig>); const toggle=(key:string)=>setFields(cur=>cur.includes(key)?cur.filter(x=>x!==key):[...cur,key]); const move=(index:number,delta:number)=>setFields(cur=>{const to=clamp(index+delta,0,cur.length-1);if(index===to)return cur;const n=[...cur];const [x]=n.splice(index,1);n.splice(to,0,x);return n});"
new_line="const labels=Object.fromEntries(choices.map(c=>[c.key,c.label])); const applyFramework=(span:V3CardSpan)=>setConfigs(cur=>Object.fromEntries(fields.map(k=>[k,{...(cur[k]??defaultField(span,style.align)),span}])) as Record<string,V3FieldConfig>); const toggle=(key:string)=>setFields(cur=>cur.includes(key)?cur.filter(x=>x!==key):[...cur,key]); const move=(index:number,delta:number)=>setFields(cur=>{const to=clamp(index+delta,0,cur.length-1);if(index===to)return cur;const n=[...cur];const [x]=n.splice(index,1);n.splice(to,0,x);return n}); const openUniversalTarget=(key:string,target:FieldEditTarget)=>{const cfg=configs[key]??defaultField();const base=fieldUniversalBaseNode(card.id,key,target,labels[key]??key,cfg);const node=mergeFieldUniversalNode(base,editorNodes[fieldUniversalNodeId(card.id,key,target)]);setUniversalEdit({key,target,node})}; const saveUniversalTarget=(node:UniversalEditorNode)=>{if(!universalEdit)return;const current=configs[universalEdit.key]??defaultField();setConfigs({...configs,[universalEdit.key]:applyUniversalToFieldConfig(current,universalEdit.target,node)});onEditorNodesChange?.({...editorNodes,[node.id]:node});setUniversalEdit(null)};"
s=replace_once(s,old_line,new_line,'editor route helpers')

s=replace_once(s,"<Text style={styles.help}>點資料方塊本體＝個別設定；← → 只做精準排序。</Text>","<Text style={styles.help}>點資料框＝Universal Editor；點名稱 Label／數值 Value 可分別進入同一套 Universal Editor。← → 只做精準排序。</Text>",'help text')
s=replace_once(s,"onPress={()=>setEditingKey(key)} style={[styles.innerBlock", "onPress={()=>openUniversalTarget(key,'frame')} style={[styles.innerBlock",'frame route')
s=replace_once(s,"<Text style={styles.innerLabel} numberOfLines={2}>{labels[key]??key}</Text>","<TouchableOpacity onPress={()=>openUniversalTarget(key,'label')}><Text style={styles.innerLabel} numberOfLines={2}>{labels[key]??key}</Text></TouchableOpacity>",'label route')
s=replace_once(s,"<Text style={{color:'#FFFFFF',fontSize:13,fontWeight:'900',marginTop:5}} numberOfLines={2}>{previewValues?.[key]??'—'}</Text>","<TouchableOpacity onPress={()=>openUniversalTarget(key,'value')}><Text style={{color:'#FFFFFF',fontSize:13,fontWeight:'900',marginTop:5}} numberOfLines={2}>{previewValues?.[key]??'—'}</Text></TouchableOpacity>",'value route')

legacy_modal=re.compile(r"<FieldConfigModal visible=\{!!editingKey\}.*?onClose=\{\(\)=>setEditingKey\(null\)\}/>",re.S)
replacement="{universalEdit?<UniversalEditor visible={!!universalEdit} node={universalEdit.node} onClose={()=>setUniversalEdit(null)} onSave={saveUniversalTarget} onReset={()=>{const cfg=configs[universalEdit.key]??defaultField();saveUniversalTarget(fieldUniversalBaseNode(card.id,universalEdit.key,universalEdit.target,labels[universalEdit.key]??universalEdit.key,cfg))}}/>:null}"
s,n=legacy_modal.subn(replacement,s,count=1)
if n!=1: raise SystemExit('missing target: legacy FieldConfigModal route')

old_global="export function GlobalCardDesigner({visible,layouts,choicesByPage,previewValuesByPage,onSave,onClose,entryTarget,directMode=false,presets=[],onPresetsChange}:{visible:boolean;layouts:V3PageLayouts;choicesByPage:Record<PageFieldKey,DesignerChoice[]>;previewValuesByPage?:Partial<Record<PageFieldKey,Record<string,string>>>;onSave:(layouts:V3PageLayouts)=>void;onClose:()=>void;entryTarget?:{page:PageFieldKey;cardId:string};directMode?:boolean;presets?:V3EditorPreset[];onPresetsChange?:(presets:V3EditorPreset[])=>void}){"
new_global="export function GlobalCardDesigner({visible,layouts,choicesByPage,previewValuesByPage,onSave,onClose,entryTarget,directMode=false,presets=[],onPresetsChange,editorNodes={},onEditorNodesChange}:{visible:boolean;layouts:V3PageLayouts;choicesByPage:Record<PageFieldKey,DesignerChoice[]>;previewValuesByPage?:Partial<Record<PageFieldKey,Record<string,string>>>;onSave:(layouts:V3PageLayouts)=>void;onClose:()=>void;entryTarget?:{page:PageFieldKey;cardId:string};directMode?:boolean;presets?:V3EditorPreset[];onPresetsChange?:(presets:V3EditorPreset[])=>void;editorNodes?:Record<string,UniversalEditorNode>;onEditorNodesChange?:(nodes:Record<string,UniversalEditorNode>)=>void}){"
s=replace_once(s,old_global,new_global,'GlobalCardDesigner props')
old_call="<CardDetailEditor visible={detailOpen} card={selected??null} choices={choicesByPage[page]} previewValues={previewValuesByPage?.[page]} onApply={patch=>selected&&persistCard(selected.id,patch)} onClose={()=>{setDetailOpen(false);if(directMode)onClose()}}/>"
new_call="<CardDetailEditor visible={detailOpen} card={selected??null} choices={choicesByPage[page]} previewValues={previewValuesByPage?.[page]} editorNodes={editorNodes} onEditorNodesChange={onEditorNodesChange} onApply={patch=>selected&&persistCard(selected.id,patch)} onClose={()=>{setDetailOpen(false);if(directMode)onClose()}}/>"
s=replace_once(s,old_call,new_call,'CardDetailEditor props')
p.write_text(s,encoding='utf-8')

# ---- screens: share editorNodes store + render frame/label/value through same universal nodes ----
p=Path('src/v3/screens.tsx')
s=p.read_text(encoding='utf-8')
old_gcd="<GlobalCardDesigner visible={!!frameTarget} layouts={prefs.pageLayouts} previewValuesByPage={editorPreviewValues} choicesByPage={Object.fromEntries((Object.keys(pageLabels) as PageFieldKey[]).map(k=>[k,pageFieldChoices[k].filter(([key])=>fieldAllowed(prefs,key)).map(([key,label])=>({key,label}))])) as any} entryTarget={frameTarget??undefined} directMode presets={prefs.editorPresets} onPresetsChange={editorPresets=>onPreferencesChange?.({editorPresets})} onSave={pageLayouts=>onPreferencesChange?.({pageLayouts})} onClose={()=>setFrameTarget(null)}/>"
new_gcd="<GlobalCardDesigner visible={!!frameTarget} layouts={prefs.pageLayouts} previewValuesByPage={editorPreviewValues} choicesByPage={Object.fromEntries((Object.keys(pageLabels) as PageFieldKey[]).map(k=>[k,pageFieldChoices[k].filter(([key])=>fieldAllowed(prefs,key)).map(([key,label])=>({key,label}))])) as any} entryTarget={frameTarget??undefined} directMode presets={prefs.editorPresets} editorNodes={prefs.editorNodes??{}} onEditorNodesChange={onEditorNodesChange} onPresetsChange={editorPresets=>onPreferencesChange?.({editorPresets})} onSave={pageLayouts=>onPreferencesChange?.({pageLayouts})} onClose={()=>setFrameTarget(null)}/>"
s=replace_once(s,old_gcd,new_gcd,'share editor nodes')

start=s.index('function RenderFieldBlock(')
end=s.index('function CumulativePnlModal(',start)
new_render=r'''const fieldUniversalNodeId=(cardId:string,key:string,target:'frame'|'label'|'value')=>`card:${cardId}:field:${key}:${target}`;
function RenderFieldBlock({card,k,label,value,prefs,colored=false,raw=0,renderScale=1,widthOverride}:{card:V3PageCard;k:string;label:string;value:string;prefs:V3Preferences;colored?:boolean;raw?:number;renderScale?:number;widthOverride?:ViewStyle['width']}){
 const cfg=defaultRenderField(card,k);const editor=useContext(EditorCtx);const palette={positive:prefs.positiveColor,negative:prefs.negativeColor,neutral:prefs.secondaryTextColor};
 const pt=cfg.paddingTop??cfg.padding??8,pr=cfg.paddingRight??cfg.padding??8,pb=cfg.paddingBottom??cfg.padding??8,pl=cfg.paddingLeft??cfg.padding??8;const legacyLf=fieldFont(11,card,cfg.label,renderScale),legacyVf=fieldFont(16,card,cfg.value,renderScale);const legacyLh=fieldLineHeight(legacyLf,cfg.label),legacyVh=fieldLineHeight(legacyVf,cfg.value);
 const frameId=fieldUniversalNodeId(card.id,k,'frame'),labelId=fieldUniversalNodeId(card.id,k,'label'),valueId=fieldUniversalNodeId(card.id,k,'value');
 const frameBase=withUniversalDefaults({id:frameId,kind:'card',systemName:`${label} 資料框`,text:{...defaultTextStyle(),visible:true},backgroundColorMode:cfg.backgroundColor?'fixed':'theme',backgroundColor:cfg.backgroundColor,borderColorMode:cfg.borderColor?'fixed':'theme',borderColor:cfg.borderColor,effects:[]});
 const labelMode=cfg.label.colorMode==='custom'?'fixed':cfg.label.colorMode==='profitLoss'?'profitLoss':'theme';const valueMode=cfg.value.colorMode==='custom'?'fixed':cfg.value.colorMode==='profitLoss'?'profitLoss':'theme';
 const labelBase=withUniversalDefaults({id:labelId,kind:'label',systemName:`${label} Label`,text:{...defaultTextStyle(),visible:cfg.label.visible,fontSize:legacyLf,fontWeight:cfg.label.fontWeight,colorMode:labelMode,color:cfg.label.color,align:cfg.label.align,verticalAlign:cfg.label.verticalAlign,lineHeight:legacyLh},effects:[]});
 const valueBase=withUniversalDefaults({id:valueId,kind:'value',systemName:`${label} Value`,text:{...defaultTextStyle(),visible:cfg.value.visible,fontSize:legacyVf,fontWeight:cfg.value.fontWeight,colorMode:valueMode,color:cfg.value.color,align:cfg.value.align,verticalAlign:cfg.value.verticalAlign,lineHeight:legacyVh},effects:[]});
 const frameNode=normalizeEditorNodeForRender(frameBase,editor?.nodes[frameId]);const labelNode=normalizeEditorNodeForRender(labelBase,editor?.nodes[labelId]);const valueNode=normalizeEditorNodeForRender(valueBase,editor?.nodes[valueId]);
 const frameAnim=useEffectAnimation(frameNode),labelAnim=useEffectAnimation(labelNode),valueAnim=useEffectAnimation(valueNode);const lt=labelNode.text!,vt=valueNode.text!;const lh=lt.lineHeight||legacyLh,vh=vt.lineHeight||legacyVh,gap=cfg.labelValueGap??6;const sameTop=lt.visible&&vt.visible&&lt.verticalAlign==='top'&&vt.verticalAlign==='top',sameBottom=lt.visible&&vt.visible&&lt.verticalAlign==='bottom'&&vt.verticalAlign==='bottom';const valueOffset=sameTop?lh+gap:0,labelOffset=sameBottom?vh+gap:0;
 const h=blockHeight(cfg,card,renderScale);const hs=cfg.height==='auto'?{minHeight:h}:{height:Math.max(h,blockHeight(cfg,card,renderScale)),minHeight:Math.max(h,blockHeight(cfg,card,renderScale))};const lines=renderScale<.9?1:2;const legacyValueColor=valueColorFor(k,prefs,cfg,raw,colored);const labelColor=resolveColor(lt.colorMode,lt.color,cfg.label.color||prefs.secondaryTextColor,raw,palette);const valueColor=resolveColor(vt.colorMode,vt.color,legacyValueColor,raw,palette);const frameBg=resolveColor(frameNode.backgroundColorMode??'theme',frameNode.backgroundColor,cfg.backgroundColor||`rgba(255,255,255,${Math.max(0,Math.min(.22,cfg.backgroundOpacity/100))})`,raw,palette);const frameBorder=resolveColor(frameNode.borderColorMode??'theme',frameNode.borderColor,cfg.borderColor||'rgba(255,255,255,.08)',raw,palette);const radius=frameNode.size?.radius??cfg.radius;
 return <Animated.View style={[{width:widthOverride??(cfg.customWidth&&cfg.customWidth>0?cfg.customWidth:spanWidth(cfg.span)),maxWidth:'100%',...hs,borderRadius:radius,borderWidth:1,borderColor:frameBorder,backgroundColor:frameBg,position:'relative',overflow:'visible'},effectsStyle(frameNode.effects,frameBorder),frameAnim]}>{lt.visible?<Animated.Text numberOfLines={lines} ellipsizeMode="tail" style={[s.muted,{position:'absolute',left:pl,right:pr},textStyleFor(lt,labelColor),effectsStyle(labelNode.effects,labelColor),vPos(lt.verticalAlign,lh,pt,pb,labelOffset),labelAnim]}>{label}</Animated.Text>:null}{vt.visible?<Animated.Text numberOfLines={lines} ellipsizeMode="tail" style={[s.lineValue,{position:'absolute',left:pl,right:pr},textStyleFor(vt,valueColor),effectsStyle(valueNode.effects,valueColor),vPos(vt.verticalAlign,vh,pt,pb,valueOffset),valueAnim]}>{value}</Animated.Text>:null}</Animated.View>
}
'''
s=s[:start]+new_render+s[end:]
p.write_text(s,encoding='utf-8')

# ---- UniversalEditor capability guard: finance bindings stay read-only ----
p=Path('src/ui/UniversalEditor.tsx')
s=p.read_text(encoding='utf-8')
old="group==='資料'?<DataControls value={data} onChange={data=>patch({data})}/>:group==='互動'?"
new="group==='資料'?(advanced.capabilities.dataBinding===false?<Text style={s.hint}>金融資料綁定由欄位 ID 保護；編輯器只控制顯示與外觀，不修改金融公式或資料來源。</Text>:<DataControls value={data} onChange={data=>patch({data})}/>):group==='互動'?"
s=replace_once(s,old,new,'data binding capability guard')
p.write_text(s,encoding='utf-8')

print('V3.7.4 Universal Editor route patch applied')
