from pathlib import Path

p = Path('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt')
text = p.read_text(encoding='utf-8')
anchor = '  private fun refreshQuotesInBackground() {'
if anchor not in text:
    raise SystemExit('FIX_V373_NATIVE_HELPERS: refresh anchor missing')

if '  private fun signed2(v:Double):String=' not in text:
    helpers = r'''  private fun signed2(v:Double):String=(if(v>0)"+" else if(v<0)"-" else "")+String.format(Locale.US,"%.2f",abs(v))

  private fun selectedMetricLines(): MutableList<String> {
    val fields=payload.optJSONArray("fields")?:JSONArray().put("instantPnl").put("todayPnl").put("updatedAt")
    val positions=payload.optJSONArray("positions")?:JSONArray()
    val focus=if(positions.length()>0)positions.optJSONObject(rotateIndex%positions.length()) else null
    val lines=mutableListOf<String>()
    fun posMoney(key:String)=money(focus?.optDouble(key,0.0)?:0.0)
    fun posPrice(key:String)=(focus?.optDouble(key,0.0)?:0.0).fmt2()
    for(i in 0 until fields.length()){
      when(val key=fields.optString(i)){
        "symbol"->lines.add("代號 ${focus?.optString("symbol","--")?:"--"}")
        "name"->lines.add("名稱 ${focus?.optString("name","--")?:"--"}")
        "price"->lines.add("行情 ${posPrice("price")}")
        "nav"->lines.add("NAV ${posPrice("nav")}")
        "premium"->lines.add("折溢價 ${signed2(focus?.optDouble("premium",0.0)?:0.0)}%")
        "change"->lines.add("漲跌 ${signed2(focus?.optDouble("change",0.0)?:0.0)}")
        "changePct"->lines.add("漲跌幅 ${signed2(focus?.optDouble("changePct",0.0)?:0.0)}%")
        "shares"->lines.add("持有 ${posMoney("shares")}")
        "marketValue"->lines.add("市值 ${if(focus!=null)posMoney("marketValue") else money(payload.optDouble("marketValue",0.0))}")
        "pureCost"->lines.add("純成本 ${posMoney("pureCost")}")
        "instantPnl"->lines.add("即時 ${if(focus!=null)signedMoney(focus.optDouble("instantPnl",0.0)) else signedMoney(payload.optDouble("instantPnl",0.0))}")
        "instantRoi"->lines.add("庫存報酬 ${signed2(focus?.optDouble("instantRoi",0.0)?:0.0)}%")
        "todayPnl"->lines.add("今日 ${if(focus!=null)signedMoney(focus.optDouble("todayPnl",0.0)) else signedMoney(payload.optDouble("todayPnl",0.0))}")
        "todayPnlPct"->lines.add("今日報酬 ${signed2(focus?.optDouble("todayPnlPct",0.0)?:0.0)}%")
        "previousClose"->lines.add("昨收 ${posPrice("previousClose")}")
        "open"->lines.add("開盤 ${posPrice("open")}")
        "high"->lines.add("最高 ${posPrice("high")}")
        "low"->lines.add("最低 ${posPrice("low")}")
        "volume"->lines.add("成交量 ${posMoney("volume")}")
        "updatedAt"->lines.add("更新 ${payload.optString("updatedAt","--:--:--")}")
        "totalAssets"->lines.add("總資產 ${money(payload.optDouble("totalAssets",0.0))}")
        "dividend"->{
          val symbol=payload.optString("dividendSymbol","")
          lines.add(if(symbol.isNotBlank())"股息 $symbol ${payload.optString("dividendDate","--")} ${money(payload.optDouble("dividendAmount",0.0))}" else "目前無待發放配息")
        }
      }
    }
    if(lines.isEmpty())lines.add("即時 ${signedMoney(payload.optDouble("instantPnl",0.0))}")
    return lines
  }

  private fun renderText():String {
    val mode=payload.optString("mode","bubble")
    val pnl=payload.optDouble("instantPnl",0.0)
    val today=payload.optDouble("todayPnl",0.0)
    val state=payload.optString("marketState","--")
    val updated=payload.optString("updatedAt","--:--:--")
    val positions=payload.optJSONArray("positions")?:JSONArray()
    val focus=if(positions.length()>0)positions.optJSONObject(rotateIndex%positions.length()) else null
    val lamp=if(payload.optBoolean("healthy",true))"●" else "◉"
    val selected=selectedMetricLines()
    val picked=selected[rotateIndex%selected.size]
    return when(mode){
      "ticker","strip","transparent"->"$lamp  $picked"
      "mini"->"投資快覽   $lamp\n${selected.take(4).joinToString("\n")}"
      "chat"->"✦ AI 投資助手\n點一下開啟 AI 對話\n$picked"
      "focus"->if(focus!=null)"${focus.optString("symbol")} ${focus.optString("name")}\n行情 ${focus.optDouble("price").fmt2()}\n即時 ${signedMoney(focus.optDouble("instantPnl"))}\n今日 ${signedMoney(focus.optDouble("todayPnl"))}\n$lamp $updated" else "尚無持倉"
      "market"->"市場狀態   $lamp\n$state\n${selected.take(2).joinToString("\n")}"
      "multi"->"ETF 即時監控   $lamp\n${selected.take(5).joinToString("\n")}"
      "dividend"->{val symbol=payload.optString("dividendSymbol","");if(symbol.isNotBlank())"股息提醒\n$symbol ${payload.optString("dividendDate","--")}\n${money(payload.optDouble("dividendAmount",0.0))}\n$lamp $updated" else "股息提醒\n目前無待發放配息\n$lamp $updated"}
      "switcher"->"即時監控器   $lamp\n$picked\n即時 ${signedMoney(pnl)} · 今日 ${signedMoney(today)}"
      else->selected.take(5).joinToString("\n")
    }
  }

'''
    text = text.replace(anchor, helpers + anchor, 1)
    p.write_text(text, encoding='utf-8')
    print('FIX_V373_NATIVE_HELPERS: restored signed2/renderText helpers')
else:
    print('FIX_V373_NATIVE_HELPERS: helpers already present')
