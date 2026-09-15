from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt'
s=p.read_text(encoding='utf-8')
start=s.find('  private fun renderTableOverlay() {')
end=s.find('  private fun renderPuzzleOverlay() {',start+1)
if start<0 or end<0: raise SystemExit('table/puzzle renderer boundaries missing')
table=s[start:end]

old_labels='"updatedAt" to "更新").mapValues{(k,v)->uiName("overlay:field:$k",v)}'
new_labels='"updatedAt" to "更新","totalAssets" to "總資產","dividend" to "股息事件").mapValues{(k,v)->uiName("overlay:field:$k",v)}'
if old_labels not in table: raise SystemExit('table labels target missing')
table=table.replace(old_labels,new_labels,1)

block_start=table.find('    val widthDp=((params?.width ?: dp(390))')
block_end=table.find('    val sum=LinearLayout(this)',block_start)
if block_start<0 or block_end<0: raise SystemExit('table field layout block missing')
new_block='''    fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"change","changePct","premium"->if(key=="premium")pos.optDouble("premium",0.0) else pos.optDouble("change",0.0);else->null}
    fun fallbackColor(key:String,pos:JSONObject):Int{val v=pnlFor(key,pos);return if(v==null)textColor else if(v>0)positive else if(v<0)negative else neutral}
    fun dividendText():String=if(payload.optString("dividendSymbol").isNotBlank()) "${payload.optString("dividendSymbol")} ${payload.optString("dividendDate","--")} ${money(payload.optDouble("dividendAmount",0.0))}" else "目前無待發放配息"
    fun valueFor(key:String,pos:JSONObject):String=when(key){"symbol"->pos.optString("symbol","--");"name"->pos.optString("name","--");"price"->pos.optDouble("price",0.0).fmt2();"change"->signed2(pos.optDouble("change",0.0));"changePct"->signed2(pos.optDouble("changePct",0.0))+"%";"shares"->money(pos.optDouble("shares",0.0));"marketValue"->money(pos.optDouble("marketValue",0.0));"pureCost"->money(pos.optDouble("pureCost",0.0));"instantPnl"->signedMoney(pos.optDouble("instantPnl",0.0));"instantRoi"->signed2(pos.optDouble("instantRoi",0.0))+"%";"todayPnl"->signedMoney(pos.optDouble("todayPnl",0.0));"todayPnlPct"->signed2(pos.optDouble("todayPnlPct",0.0))+"%";"previousClose"->pos.optDouble("previousClose",0.0).fmt2();"open"->pos.optDouble("open",0.0).fmt2();"high"->pos.optDouble("high",0.0).fmt2();"low"->pos.optDouble("low",0.0).fmt2();"volume"->money(pos.optDouble("volume",0.0));"nav"->pos.optDouble("nav",0.0).fmt2();"premium"->signed2(pos.optDouble("premium",0.0))+"%";"updatedAt"->payload.optString("updatedAt","--:--:--");"totalAssets"->money(payload.optDouble("totalAssets",0.0));"dividend"->dividendText();else->"—"}
    val widthDp=((params?.width ?: dp(390))/resources.displayMetrics.density).toInt();val ph=params?.height?:dp(240);val heightDp=if(ph>0)(ph/resources.displayMetrics.density).toInt() else payload.optInt("height",240);val fluid=payload.optString("resizeMode","fluid")=="fluid";val adaptiveCols=if(fluid)max(2,min(8,widthDp/92))else min(8,max(1,fields.size));val columnCount=min(fields.size,adaptiveCols)
    val groups=if(fields.isEmpty()) emptyList() else fields.chunked(max(1,columnCount));val density=payload.optString("density","auto");val rowHeight=if(density=="compact")dp(24) else dp(30);val availableContent=dp(max(48,min(heightDp-112,(resources.displayMetrics.heightPixels/resources.displayMetrics.density*payload.optDouble("maxHeightRatio",.72)).toInt()-112)));val chunkHeight=if(groups.isEmpty())availableContent else max(dp(48),availableContent/max(1,groups.size))
    for(group in groups){val titleRow=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL};for(k in group)titleRow.addView(styledFieldText(labels[k]?:k,k,8f,true,neutral,null),LinearLayout.LayoutParams(0,dp(27),1f));host.addView(titleRow);val rowHost=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};val n=min(maxRows,rows.length());for(r in 0 until n){val pos=rows.optJSONObject(r)?:continue;val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL};for(k in group)row.addView(styledFieldText(valueFor(k,pos),k,9f,k=="symbol",fallbackColor(k,pos),pnlFor(k,pos)),LinearLayout.LayoutParams(0,rowHeight,1f));rowHost.addView(row)};val scroll=ScrollView(this).apply{isFillViewport=false;addView(rowHost)};host.addView(scroll,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,chunkHeight))}
'''
table=table[:block_start]+new_block+table[block_end:]
s=s[:start]+table+s[end:]
p.write_text(s,encoding='utf-8')
print('FIX_V373_TABLE_FIELDS: applied')
