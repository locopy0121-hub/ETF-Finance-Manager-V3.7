from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Expected source not found in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# 1) Persist the extra market-state colors on the existing monitor field style.
replace_once(
    'src/v3/monitoring.ts',
    "export type MonitorFieldStyle={visible:boolean;order:number;fixed:boolean;fontScale:number;fontWeight:'normal'|'bold';textColor:string;backgroundColor:string;backgroundOpacity:number;align:'left'|'center'|'right';verticalAlign:'top'|'center'|'bottom';padding:number;radius:number;effect:'none'|'shadow'|'glow'|'outline';effectStrength:number;profitLossColor:boolean;positiveColor:string;negativeColor:string;neutralColor:string;};",
    "export type MonitorFieldStyle={visible:boolean;order:number;fixed:boolean;fontScale:number;fontWeight:'normal'|'bold';textColor:string;backgroundColor:string;backgroundOpacity:number;align:'left'|'center'|'right';verticalAlign:'top'|'center'|'bottom';padding:number;radius:number;effect:'none'|'shadow'|'glow'|'outline';effectStrength:number;profitLossColor:boolean;positiveColor:string;negativeColor:string;neutralColor:string;limitUpTextColor?:string;limitUpBackgroundColor?:string;limitDownTextColor?:string;limitDownBackgroundColor?:string;};",
)

# 2) Keep all controls inside the existing 即時行情 field editor; do not add another section or route.
replace_once(
    'src/v3/MonitorFieldEditor.tsx',
    "const PNL=new Set<MonitorField>(['premium','change','changePct','instantPnl','instantRoi','todayPnl','todayPnlPct']);",
    "const PNL=new Set<MonitorField>(['price','premium','change','changePct','instantPnl','instantRoi','todayPnl','todayPnlPct']);",
)
replace_once(
    'src/v3/MonitorFieldEditor.tsx',
    "const base=(order=1):MonitorFieldStyle=>({visible:true,order,fixed:false,fontScale:100,fontWeight:'bold',textColor:'#FFFFFF',backgroundColor:'#00000000',backgroundOpacity:0,align:'center',verticalAlign:'center',padding:4,radius:4,effect:'none',effectStrength:35,profitLossColor:true,positiveColor:'#E54A45',negativeColor:'#12A875',neutralColor:'#8E9BAE'});",
    "const base=(order=1,field?:MonitorField):MonitorFieldStyle=>({visible:true,order,fixed:false,fontScale:100,fontWeight:'bold',textColor:'#FFFFFF',backgroundColor:'#00000000',backgroundOpacity:0,align:'center',verticalAlign:'center',padding:4,radius:4,effect:'none',effectStrength:35,profitLossColor:true,positiveColor:'#E54A45',negativeColor:'#12A875',neutralColor:field==='price'?'#F4D35E':'#8E9BAE',limitUpTextColor:'#FFFFFF',limitUpBackgroundColor:'#E54A45',limitDownTextColor:'#FFFFFF',limitDownBackgroundColor:'#12A875'});",
)
replace_once(
    'src/v3/MonitorFieldEditor.tsx',
    "const insets=useSafeAreaInsets();const initial=useMemo(()=>({...base(style?.order??1),...style,positiveColor:style?.positiveColor??positive,negativeColor:style?.negativeColor??negative}),[field,style,positive,negative]);",
    "const insets=useSafeAreaInsets();const initial=useMemo(()=>{const defaults=base(style?.order??1,field);const legacyFlat=field==='price'&&style?.neutralColor==='#8E9BAE';return {...defaults,...style,positiveColor:style?.positiveColor??positive,negativeColor:style?.negativeColor??negative,neutralColor:legacyFlat?defaults.neutralColor:(style?.neutralColor??defaults.neutralColor),limitUpTextColor:style?.limitUpTextColor??defaults.limitUpTextColor,limitUpBackgroundColor:style?.limitUpBackgroundColor??defaults.limitUpBackgroundColor,limitDownTextColor:style?.limitDownTextColor??defaults.limitDownTextColor,limitDownBackgroundColor:style?.limitDownBackgroundColor??defaults.limitDownBackgroundColor}},[field,style,positive,negative]);",
)
old_editor = """ {pnl?<><View style={s.setting}><Text style={s.label}>損益色</Text><Switch value={d.profitLossColor!==false} onValueChange={v=>patch({profitLossColor:v})}/></View>{d.profitLossColor!==false?<><ColorPalettePicker label=\"正值 / 上漲色\" value={d.positiveColor} onChange={v=>patch({positiveColor:v})}/><ColorPalettePicker label=\"負值 / 下跌色\" value={d.negativeColor} onChange={v=>patch({negativeColor:v})}/><ColorPalettePicker label=\"持平色\" value={d.neutralColor} onChange={v=>patch({neutralColor:v})}/></>:null}</>:null}
"""
new_editor = """ {pnl?<><View style={s.setting}><Text style={s.label}>{field==='price'?'市場行情色':'損益色'}</Text><Switch value={d.profitLossColor!==false} onValueChange={v=>patch({profitLossColor:v})}/></View>{d.profitLossColor!==false?<><ColorPalettePicker label=\"正值 / 上漲色\" value={d.positiveColor} onChange={v=>patch({positiveColor:v})}/><ColorPalettePicker label=\"負值 / 下跌色\" value={d.negativeColor} onChange={v=>patch({negativeColor:v})}/><ColorPalettePicker label=\"持平色\" value={d.neutralColor} onChange={v=>patch({neutralColor:v})}/>{field==='price'?<><ColorPalettePicker label=\"漲停文字顏色\" value={d.limitUpTextColor??'#FFFFFF'} onChange={v=>patch({limitUpTextColor:v})}/><ColorPalettePicker label=\"漲停背景顏色\" value={d.limitUpBackgroundColor??'#E54A45'} onChange={v=>patch({limitUpBackgroundColor:v})}/><ColorPalettePicker label=\"跌停文字顏色\" value={d.limitDownTextColor??'#FFFFFF'} onChange={v=>patch({limitDownTextColor:v})}/><ColorPalettePicker label=\"跌停背景顏色\" value={d.limitDownBackgroundColor??'#12A875'} onChange={v=>patch({limitDownBackgroundColor:v})}/></>:null}</>:null}</>:null}
"""
replace_once('src/v3/MonitorFieldEditor.tsx', old_editor, new_editor)
replace_once(
    'src/v3/MonitorFieldEditor.tsx',
    "onPress={()=>setD({...base(d.order),positiveColor:positive,negativeColor:negative})}",
    "onPress={()=>setD({...base(d.order,field),positiveColor:positive,negativeColor:negative})}",
)

# 3) Carry TWSE official previous-close / limit prices in the shared quote snapshot.
replace_once(
    'src/services/twse.ts',
    "  previousClose?: number;\n  open?: number;",
    "  previousClose?: number;\n  limitUp?: number;\n  limitDown?: number;\n  open?: number;",
)
replace_once(
    'src/services/twse.ts',
    "      previousClose: toNumber(raw?.y),\n      open: toNumber(raw?.o),",
    "      previousClose: toNumber(raw?.y),\n      limitUp: toNumber(raw?.u),\n      limitDown: toNumber(raw?.w),\n      open: toNumber(raw?.o),",
)

# 4) Forward the same market limits into the native monitor payload.
replace_once(
    'src/services/floatingOverlay.ts',
    "volume:Number(q.volume??0),pureCost:0,",
    "volume:Number(q.volume??0),limitUp:Number(q.limitUp??0),limitDown:Number(q.limitDown??0),pureCost:0,",
)
replace_once(
    'src/services/floatingOverlay.ts',
    "open:Number(hm.open??0),high:Number(hm.high??0),low:Number(hm.low??0),volume:Number(hm.volume??0),",
    "open:Number(hm.open??0),high:Number(hm.high??0),low:Number(hm.low??0),volume:Number(hm.volume??0),limitUp:Number(q.limitUp??0),limitDown:Number(q.limitDown??0),",
)

# 5) Native monitor: market-color rendering plus off-screen batch refresh / atomic commit.
kpath='modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt'
k=read(kpath)
if 'private fun priceMarketState' not in k:
    start=k.index('  private fun styledFieldText(')
    end=k.index('\n  private fun renderTableOverlay()',start)
    replacement=r'''  private fun priceMarketState(key:String,pos:JSONObject):String? {
    if(key!="price")return null
    val price=pos.optDouble("price",Double.NaN)
    if(!price.isFinite())return null
    val limitUp=pos.optDouble("limitUp",Double.NaN)
    val limitDown=pos.optDouble("limitDown",Double.NaN)
    if(limitUp.isFinite()&&limitUp>0&&abs(price-limitUp)<0.0001)return "limitUp"
    if(limitDown.isFinite()&&limitDown>0&&abs(price-limitDown)<0.0001)return "limitDown"
    return null
  }

  private fun styledFieldText(value:String,key:String,size:Float=10f,bold:Boolean=false,fallbackColor:Int=Color.WHITE,pnlValue:Double?=null,maxLines:Int=1,marketState:String?=null):TextView {
    val style=fieldStyle(key)
    val globalScale=payload.optDouble("fontScale",1.0).toFloat().coerceIn(.7f,1.8f)
    val localScale=(style.optDouble("fontScale",100.0)/100.0).toFloat().coerceIn(.6f,2.2f)
    val useMarketColor=style.optBoolean("profitLossColor",key=="price")
    var color=parseColor(style.optString("textColor",""),fallbackColor)
    if(useMarketColor&&pnlValue!=null){
      val rawNeutral=style.optString("neutralColor","")
      val neutralDefault=if(key=="price"&&(rawNeutral.isBlank()||rawNeutral.equals("#8E9BAE",true)))"#F4D35E" else if(rawNeutral.isNotBlank())rawNeutral else payload.optString("neutral","#94A3B8")
      color=when{pnlValue>0->parseColor(style.optString("positiveColor",payload.optString("positive","#E54A45")),fallbackColor);pnlValue<0->parseColor(style.optString("negativeColor",payload.optString("negative","#12A875")),fallbackColor);else->parseColor(neutralDefault,fallbackColor)}
    }
    if(key=="price"&&useMarketColor&&marketState=="limitUp")color=parseColor(style.optString("limitUpTextColor","#FFFFFF"),Color.WHITE)
    if(key=="price"&&useMarketColor&&marketState=="limitDown")color=parseColor(style.optString("limitDownTextColor","#FFFFFF"),Color.WHITE)
    val align=style.optString("align","center")
    val vertical=style.optString("verticalAlign","center")
    val hGravity=when(align){"left"->Gravity.START;"right"->Gravity.END;else->Gravity.CENTER_HORIZONTAL}
    val vGravity=when(vertical){"top"->Gravity.TOP;"bottom"->Gravity.BOTTOM;else->Gravity.CENTER_VERTICAL}
    val pad=dp(style.optInt("padding",4).coerceIn(0,30))
    val effect=style.optString("effect","none")
    val strength=style.optInt("effectStrength",35).coerceIn(0,100)
    return TextView(this).apply{
      text=value;textSize=size*globalScale*localScale;setTextColor(color);gravity=hGravity or vGravity;setPadding(pad,pad/2,pad,pad/2);this.maxLines=maxLines
      if(style.optString("fontWeight",if(bold)"bold" else "normal")=="bold"||bold)setTypeface(typeface,android.graphics.Typeface.BOLD)
      val marketBg=when{key=="price"&&useMarketColor&&marketState=="limitUp"->style.optString("limitUpBackgroundColor","#E54A45");key=="price"&&useMarketColor&&marketState=="limitDown"->style.optString("limitDownBackgroundColor","#12A875");else->null}
      val bgOpacity=if(marketBg!=null)100 else style.optInt("backgroundOpacity",0).coerceIn(0,100)
      val bgRaw=marketBg?:style.optString("backgroundColor","#00000000")
      if(bgOpacity>0||effect=="outline")background=GradientDrawable().apply{cornerRadius=dp(style.optInt("radius",4).coerceIn(0,30)).toFloat();setColor(withAlpha(parseColor(bgRaw,Color.TRANSPARENT),(255*bgOpacity/100.0).toInt()));if(effect=="outline")setStroke(dp(max(1,strength/35)),withAlpha(color,220))}
      when(effect){"shadow"->setShadowLayer(max(1f,strength/10f),dp(1).toFloat(),dp(1).toFloat(),Color.BLACK);"glow"->setShadowLayer(max(1f,strength/7f),0f,0f,color)}
    }
  }
'''
    k=k[:start]+replacement+k[end:]

old_table='fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"change","changePct","premium"->if(key=="premium")pos.optDouble("premium",0.0) else pos.optDouble("change",0.0);else->null}'
new_table='fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"price","change","changePct","premium"->if(key=="premium")pos.optDouble("premium",0.0) else pos.optDouble("change",0.0);else->null}'
if old_table in k:k=k.replace(old_table,new_table,1)
elif new_table not in k:raise SystemExit('table pnlFor source not found')

old_puzzle='fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"change","changePct"->pos.optDouble("change",0.0);"premium"->pos.optDouble("premium",0.0);else->null}'
new_puzzle='fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"price","change","changePct"->pos.optDouble("change",0.0);"premium"->pos.optDouble("premium",0.0);else->null}'
if old_puzzle in k:k=k.replace(old_puzzle,new_puzzle,1)
elif new_puzzle not in k:raise SystemExit('puzzle pnlFor source not found')

old_row='styledFieldText(valueFor(k,pos),k,9f,k=="symbol",fallbackColor(k,pos),pnlFor(k,pos)),LinearLayout.LayoutParams(0,rowHeight,1f))'
new_row='styledFieldText(valueFor(k,pos),k,9f,k=="symbol",fallbackColor(k,pos),pnlFor(k,pos),1,priceMarketState(k,pos)),LinearLayout.LayoutParams(0,rowHeight,1f))'
if old_row in k:k=k.replace(old_row,new_row,1)
elif new_row not in k:raise SystemExit('table row renderer source not found')

old_puzzle_row='styledFieldText(valueFor(field,pos),field,9f,true,fallback,pv,1),LinearLayout.LayoutParams(0,dp(24),1.15f))'
new_puzzle_row='styledFieldText(valueFor(field,pos),field,9f,true,fallback,pv,1,priceMarketState(field,pos)),LinearLayout.LayoutParams(0,dp(24),1.15f))'
if old_puzzle_row in k:k=k.replace(old_puzzle_row,new_puzzle_row,1)
elif new_puzzle_row not in k:raise SystemExit('puzzle row renderer source not found')

refresh_start=k.index('  private fun refreshQuotesInBackground() {')
refresh_end=k.index('\n  private fun num(s: String?): Double?',refresh_start)
new_refresh=r'''  private fun refreshQuotesInBackground() {
    val basePayload=payload
    val positions=basePayload.optJSONArray("positions")?:return
    if(positions.length()==0)return
    io.execute{
      try{
        val symbols=(0 until positions.length()).mapNotNull{positions.optJSONObject(it)?.optString("symbol")}.filter{it.isNotBlank()}
        if(symbols.isEmpty())return@execute
        val channels=symbols.joinToString("|"){"tse_${it}.tw"}
        val url="https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${URLEncoder.encode(channels,"UTF-8")}&json=1&delay=0&_=${System.currentTimeMillis()}"
        val conn=(URL(url).openConnection() as HttpURLConnection).apply{requestMethod="GET";connectTimeout=8000;readTimeout=8000;setRequestProperty("Accept","application/json,text/plain,*/*")}
        val body=conn.inputStream.bufferedReader().use{it.readText()};conn.disconnect()
        val arr=JSONObject(body).optJSONArray("msgArray")?:throw IllegalStateException("TWSE no quote array")
        val map=HashMap<String,JSONObject>();for(i in 0 until arr.length()){val q=arr.optJSONObject(i)?:continue;val symbol=q.optString("c");if(symbol.isNotBlank())map[symbol]=q}
        if(map.isEmpty())throw IllegalStateException("TWSE no valid quote")

        val nextPositions = JSONArray(positions.toString())
        var instant=basePayload.optDouble("instantPnl",0.0)
        var todayTotal=basePayload.optDouble("todayPnl",0.0)
        var marketValue=basePayload.optDouble("marketValue",0.0)
        for(i in 0 until nextPositions.length()){
          val pos=nextPositions.optJSONObject(i)?:continue
          val q=map[pos.optString("symbol")]
          val oldPrice=pos.optDouble("price",0.0)
          val oldPrevious=pos.optDouble("previousClose",oldPrice)
          val previous=(q?.let{num(it.optString("y"))}?:oldPrevious).takeIf{it>0}?:oldPrice
          val price=(q?.let{num(it.optString("z"))}?:q?.let{num(it.optString("y"))}?:oldPrice.takeIf{it>0}?:previous)
          val shares=pos.optDouble("shares",0.0)
          val pureCost=pos.optDouble("pureCost",0.0)
          val oldMarket=pos.optDouble("marketValue",oldPrice*shares)
          val oldPnl=pos.optDouble("instantPnl",oldMarket-pureCost)
          val oldToday=pos.optDouble("todayPnl",(oldPrice-oldPrevious)*shares)
          val nextMarket=price*shares
          val nextPnl=nextMarket-pureCost
          val nextToday=(price-previous)*shares
          pos.put("price",price);pos.put("previousClose",previous);pos.put("marketValue",nextMarket);pos.put("instantPnl",nextPnl);pos.put("instantRoi",if(pureCost>0)nextPnl/pureCost*100.0 else 0.0);pos.put("todayPnl",nextToday);pos.put("todayPnlPct",if(previous*shares>0)nextToday/(previous*shares)*100.0 else 0.0);pos.put("change",price-previous);pos.put("changePct",if(previous>0)(price/previous-1.0)*100.0 else 0.0)
          pos.put("open",q?.let{num(it.optString("o"))}?:pos.optDouble("open",0.0));pos.put("high",q?.let{num(it.optString("h"))}?:pos.optDouble("high",0.0));pos.put("low",q?.let{num(it.optString("l"))}?:pos.optDouble("low",0.0));pos.put("volume",q?.let{num(it.optString("v"))}?:pos.optDouble("volume",0.0));pos.put("limitUp",q?.let{num(it.optString("u"))}?:pos.optDouble("limitUp",0.0));pos.put("limitDown",q?.let{num(it.optString("w"))}?:pos.optDouble("limitDown",0.0))
          instant+=nextPnl-oldPnl;todayTotal+=nextToday-oldToday;marketValue+=nextMarket-oldMarket
        }
        val cashBalance=basePayload.optDouble("cashBalance",0.0)
        val nextUpdatedAt=SimpleDateFormat("HH:mm:ss",Locale.TAIWAN).format(Date())
        handler.post{
          if(payload===basePayload){
            basePayload.put("positions", nextPositions)
            basePayload.put("instantPnl",instant);basePayload.put("todayPnl",todayTotal);basePayload.put("marketValue",marketValue);basePayload.put("totalAssets",marketValue+cashBalance);basePayload.put("updatedAt",nextUpdatedAt);basePayload.put("healthy",true)
            getSharedPreferences(PREF,MODE_PRIVATE).edit().putString(PREF_PAYLOAD,basePayload.toString()).apply();updateOverlayText()
          }
        }
      }catch(_:Throwable){handler.post{if(payload===basePayload){basePayload.put("healthy",false);updateOverlayText()}}}
    }
  }
'''
k=k[:refresh_start]+new_refresh+k[refresh_end:]
write(kpath,k)

print('Applied V3.7.4 market quote/editor fix')
