const fs=require('fs');
const patch=(file,fn)=>{const before=fs.readFileSync(file,'utf8');const after=fn(before);if(after===before)throw new Error(`No changes applied to ${file}`);fs.writeFileSync(file,after);console.log(`patched ${file}`)};
const replace=(src,needle,repl,label)=>{if(!src.includes(needle))throw new Error(`Missing patch anchor: ${label}`);return src.replace(needle,repl)};

patch('src/v3/monitoring.ts',src=>replace(src,
"effect:'none'|'shadow'|'glow'|'outline';effectStrength:number;profitLossColor:boolean;",
"effect:'none'|'shadow'|'glow'|'outline';effectStrength:number;colorMode?:'CUSTOM'|'THEME_GENERAL'|'THEME_PROFIT_LOSS';profitLossColor:boolean;",
'field style color mode'));

patch('src/v3/MonitorFieldEditor.tsx',src=>{
 src=replace(src,
"effect:'none',effectStrength:35,profitLossColor:true,positiveColor",
"effect:'none',effectStrength:35,colorMode:PNL.has(field as MonitorField)?'THEME_PROFIT_LOSS':'THEME_GENERAL',profitLossColor:PNL.has(field as MonitorField),positiveColor",
'editor default color mode');
 src=replace(src,
` <ColorPalettePicker label="文字顏色" value={d.textColor} onChange={v=>patch({textColor:v})}/><ColorPalettePicker label="背景底色" value={d.backgroundColor} onChange={v=>patch({backgroundColor:v})}/>` ,
` <View style={s.setting}><Text style={s.label}>顏色來源</Text><Choices value={d.colorMode??(pnl?'THEME_PROFIT_LOSS':'THEME_GENERAL')} items={pnl?[["CUSTOM","自訂顏色"],["THEME_GENERAL","跟隨主題一般色"],["THEME_PROFIT_LOSS","跟隨主題損益色"]]:[["CUSTOM","自訂顏色"],["THEME_GENERAL","跟隨主題一般色"]]} onChange={v=>patch({colorMode:v,profitLossColor:v==='THEME_PROFIT_LOSS'})}/></View>\n {d.colorMode==='CUSTOM'?<ColorPalettePicker label="文字顏色" value={d.textColor} onChange={v=>patch({textColor:v})}/>:null}<ColorPalettePicker label="背景底色" value={d.backgroundColor} onChange={v=>patch({backgroundColor:v})}/>`,'editor color source');
 src=replace(src,
` {pnl?<><View style={s.setting}><Text style={s.label}>{field==='price'?'市場行情色':'損益色'}</Text><Switch value={d.profitLossColor!==false} onValueChange={v=>patch({profitLossColor:v})}/></View>{d.profitLossColor!==false?<>`,
` {pnl&&d.colorMode==='THEME_PROFIT_LOSS'?<>`,'semantic color controls');
 src=replace(src,`</>:null}</>:null}\n <View style={s.setting}><Text style={s.label}>水平對齊</Text>`,`</>:null}\n <View style={s.setting}><Text style={s.label}>水平對齊</Text>`,'semantic color close');
 src=replace(src,
`color:pnl&&d.profitLossColor?d.positiveColor:d.textColor`,
`color:d.colorMode==='THEME_PROFIT_LOSS'&&pnl?d.positiveColor:d.colorMode==='THEME_GENERAL'?'#FFFFFF':d.textColor`,'preview semantic color');
 return src;
});

patch('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt',src=>{
 const old=`    val useMarketColor=style.optBoolean("profitLossColor",key=="price")\n    var color=parseColor(style.optString("textColor",""),fallbackColor)\n    if(useMarketColor&&pnlValue!=null){`;
 const repl=`    val targetType=payload.optJSONObject("colorTargets")?.optString(key,"GENERAL_TEXT")?:"GENERAL_TEXT"\n    val config=payload.optJSONObject("colorSettings")?.optJSONObject(key)\n    val configuredMode=config?.optString("mode","")?.takeIf{it.isNotBlank()} ?: style.optString("colorMode",if(style.optBoolean("profitLossColor",false))"THEME_PROFIT_LOSS" else "THEME_GENERAL")\n    val useMarketColor=configuredMode=="THEME_PROFIT_LOSS"&&targetType!="GENERAL_TEXT"\n    var color=when(configuredMode){\n      "CUSTOM"->parseColor(config?.optString("customColor",style.optString("textColor",""))?:style.optString("textColor",""),fallbackColor)\n      "THEME_GENERAL"->fallbackColor\n      else->parseColor(style.optString("textColor",""),fallbackColor)\n    }\n    if(useMarketColor&&pnlValue!=null){`;
 src=replace(src,old,repl,'native semantic color mode');
 return src;
});
