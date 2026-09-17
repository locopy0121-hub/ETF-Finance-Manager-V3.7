package com.etfpilot.floatingbot

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

class FloatingInvestmentBotService : Service() {
  companion object {
    private const val ACTION_START = "com.etfpilot.floatingbot.START"
    private const val ACTION_UPDATE = "com.etfpilot.floatingbot.UPDATE"
    private const val ACTION_STOP = "com.etfpilot.floatingbot.STOP"
    private const val EXTRA_PAYLOAD = "payload"
    private const val PREF_PAYLOAD = "payload"
    private const val CHANNEL = "floating_investment_bot"
    private const val NOTIFICATION_ID = 3400

    fun start(context: Context, payload: String) {
      ContextCompat.startForegroundService(context, Intent(context, FloatingInvestmentBotService::class.java).setAction(ACTION_START).putExtra(EXTRA_PAYLOAD, payload))
    }
    fun update(context: Context, payload: String) {
      ContextCompat.startForegroundService(context, Intent(context, FloatingInvestmentBotService::class.java).setAction(ACTION_UPDATE).putExtra(EXTRA_PAYLOAD, payload))
    }
    fun stop(context: Context) { context.stopService(Intent(context, FloatingInvestmentBotService::class.java).setAction(ACTION_STOP)) }
  }

  private lateinit var wm: WindowManager
  private lateinit var layoutStore: MonitorLayoutStore
  private var root: LinearLayout? = null
  private var params: WindowManager.LayoutParams? = null
  private val handler = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()
  private var payload = JSONObject()
  private var destroyed = false
  private var refreshInFlight = false
  private var pulseStatus = "PAUSED"
  private var lastTapAt = 0L

  private val refreshRunnable = object : Runnable {
    override fun run() {
      if (destroyed) return
      val sec = payload.optDouble("refreshSeconds", 5.0)
      if (sec <= 0.0) { setPulseStatus("PAUSED"); return }
      refreshSnapshot()
    }
  }

  override fun onCreate() {
    super.onCreate()
    wm = getSystemService(WINDOW_SERVICE) as WindowManager
    layoutStore = MonitorLayoutStore(this)
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
    val raw = intent?.getStringExtra(EXTRA_PAYLOAD)
      ?: getSharedPreferences(MonitorLayoutStore.PREF, MODE_PRIVATE).getString(PREF_PAYLOAD, null)
      ?: "{}"
    payload = try { JSONObject(raw) } catch (_: Throwable) { JSONObject() }
    layoutStore.initialize(payload)
    getSharedPreferences(MonitorLayoutStore.PREF, MODE_PRIVATE).edit().putString(PREF_PAYLOAD, payload.toString()).apply()
    FloatingMonitorScheduleReceiver.scheduleNext(this, payload)
    if (!FloatingMonitorScheduleReceiver.scheduleAllows(payload)) { stopSelf(); return START_NOT_STICKY }
    if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY }

    ensureOverlay()
    renderOverlay()
    startAsForeground()
    handler.removeCallbacks(refreshRunnable)
    handler.post(refreshRunnable)
    return START_STICKY
  }

  override fun onDestroy() {
    destroyed = true
    handler.removeCallbacksAndMessages(null)
    io.shutdownNow()
    root?.let { try { wm.removeView(it) } catch (_: Throwable) {} }
    root = null
    super.onDestroy()
  }
  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL, "ETF 即時監控器", NotificationManager.IMPORTANCE_LOW).apply {
          description = "跨 App 顯示使用者啟用的即時 ETF 投資資訊"
        }
      )
    }
  }

  private fun startAsForeground() {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pi = launch?.let { android.app.PendingIntent.getActivity(this, 0, it, android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE) }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
      .setContentTitle("ETF財務管家 · 即時監控器").setContentText("即時監控器運作中").setOngoing(true).also { if (pi != null) it.setContentIntent(pi) }.build()
    if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    else startForeground(NOTIFICATION_ID, notification)
  }

  private fun ensureOverlay() {
    val rect = layoutStore.activeLayout()
    val p = params
    if (root != null && p != null) { applyRect(rect); return }
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    params = WindowManager.LayoutParams(
      dp(rect.width), dp(rect.height), type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START; x = dp(rect.x); y = dp(rect.y) }
    root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_VERTICAL; elevation = dp(10).toFloat() }
    installWindowTouch(root!!)
    wm.addView(root, params)
  }

  private fun applyRect(rect: MonitorRect) {
    val p = params ?: return
    p.x = dp(rect.x); p.y = dp(rect.y); p.width = dp(rect.width); p.height = dp(rect.height)
    try { wm.updateViewLayout(root, p) } catch (_: Throwable) {}
  }

  private fun currentRect(): MonitorRect {
    val p = params ?: return layoutStore.activeLayout()
    return MonitorRect(pxToDp(p.x), pxToDp(p.y), pxToDp(p.width), pxToDp(if (p.height > 0) p.height else root?.height ?: dp(48)))
  }

  private fun installWindowTouch(view: View) {
    var downX=0f;var downY=0f;var startX=0;var startY=0;var moved=false
    view.setOnTouchListener { _, event ->
      val p=params?:return@setOnTouchListener false
      if(payload.optBoolean("locked",false))return@setOnTouchListener true
      when(event.actionMasked){
        MotionEvent.ACTION_DOWN->{downX=event.rawX;downY=event.rawY;startX=p.x;startY=p.y;moved=false;true}
        MotionEvent.ACTION_MOVE->{
          val dx=(event.rawX-downX).toInt();val dy=(event.rawY-downY).toInt();if(abs(dx)>dp(3)||abs(dy)>dp(3))moved=true
          p.x=max(0,startX+dx);p.y=max(dp(24),startY+dy);try{wm.updateViewLayout(root,p)}catch(_:Throwable){};true
        }
        MotionEvent.ACTION_UP->{
          if(moved){
            if(payload.optBoolean("snap",true)){val sw=resources.displayMetrics.widthPixels;p.x=if(p.x+p.width/2<sw/2)0 else max(0,sw-p.width)}
            layoutStore.saveCurrentLayout(currentRect())
          }else{
            val now=System.currentTimeMillis();val doubleTap=now-lastTapAt<380;lastTapAt=now
            if(doubleTap&&layoutStore.isMinimized())restoreNormalLayout()
          }
          true
        }
        else->false
      }
    }
  }

  private fun installResizeTouch(view: View) {
    var downX=0f;var downY=0f;var startW=0;var startH=0
    view.setOnTouchListener { _,event ->
      val p=params?:return@setOnTouchListener false
      if(payload.optBoolean("locked",false))return@setOnTouchListener true
      when(event.actionMasked){
        MotionEvent.ACTION_DOWN->{downX=event.rawX;downY=event.rawY;startW=p.width;startH=p.height;true}
        MotionEvent.ACTION_MOVE->{
          val mini=layoutStore.isMinimized();val minW=dp(if(mini)72 else payload.optInt("minWidth",120));val minH=dp(if(mini)36 else payload.optInt("minHeight",48))
          val maxW=resources.displayMetrics.widthPixels;val maxH=(resources.displayMetrics.heightPixels*payload.optDouble("maxHeightRatio",.72)).toInt()
          var w=(startW+(event.rawX-downX)).toInt().coerceIn(minW,maxW);var h=(startH+(event.rawY-downY)).toInt().coerceIn(minH,maxH)
          val grid=dp(payload.optInt("gridSnap",8).coerceIn(1,32));if(grid>1){w=max(minW,(w/grid)*grid);h=max(minH,(h/grid)*grid)}
          p.width=w;p.height=h;try{wm.updateViewLayout(root,p)}catch(_:Throwable){};renderOverlay();true
        }
        MotionEvent.ACTION_UP->{layoutStore.saveCurrentLayout(currentRect());if(payload.optBoolean("haptics",true))view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK);true}
        else->false
      }
    }
  }

  private fun minimizeLayout(){ layoutStore.save(MonitorLayoutMode.NORMAL,currentRect());applyRect(layoutStore.minimize());renderOverlay() }
  private fun restoreNormalLayout(){ layoutStore.save(MonitorLayoutMode.MINI,currentRect());applyRect(layoutStore.restoreNormalLayout());renderOverlay() }

  private fun activeConfig(): JSONObject {
    val key=if(layoutStore.isMinimized())"miniConfig" else "normalConfig"
    return payload.optJSONObject(key) ?: payload.optJSONObject("modeConfig") ?: JSONObject()
  }

  private fun renderOverlay() {
    val host=root?:return
    host.removeAllViews()
    val config=activeConfig();val opacity=config.optDouble("opacity",payload.optDouble("opacity",.92)).coerceIn(.15,1.0)
    val bgColor=parseColor(config.optString("backgroundColor",payload.optString("background","#08111F")),Color.rgb(8,17,31))
    val border=parseColor(config.optString("borderColor",payload.optString("borderColor","#3AC7FF")),Color.CYAN)
    host.background=GradientDrawable().apply{cornerRadius=dp(config.optInt("borderRadius",payload.optInt("radius",16))).toFloat();setColor(withAlpha(bgColor,(245*opacity).toInt()));setStroke(dp(config.optInt("borderWidth",1).coerceIn(0,8)),border)}
    host.setPadding(dp(6),dp(5),dp(6),dp(5))

    if(!layoutStore.isMinimized())host.addView(normalHeader())
    else host.addView(miniStatusBar())

    val body=ScrollView(this).apply{isFillViewport=true;addView(buildResponsiveContent(config))}
    host.addView(body,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,0,1f))

    if(!payload.optBoolean("locked",false)){
      val footer=LinearLayout(this).apply{gravity=Gravity.END or Gravity.CENTER_VERTICAL}
      val grip=textView("↘",14f,parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN),true).apply{isClickable=true}
      footer.addView(grip,LinearLayout.LayoutParams(dp(32),dp(28)));installResizeTouch(grip)
      host.addView(footer,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,dp(28)))
    }
  }

  private fun normalHeader():View{
    val accent=parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN)
    val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
    row.addView(textView(payload.optString("title","即時監控器"),12f,accent,true),LinearLayout.LayoutParams(0,dp(30),1f))
    row.addView(pulseView(),LinearLayout.LayoutParams(dp(82),dp(30)))
    row.addView(textView("—",14f,Color.LTGRAY,true).apply{isClickable=true;setOnClickListener{minimizeLayout()}},LinearLayout.LayoutParams(dp(34),dp(30)))
    row.addView(textView("✕",12f,Color.LTGRAY,true).apply{isClickable=true;setOnClickListener{stopSelf()}},LinearLayout.LayoutParams(dp(34),dp(30)))
    return row
  }

  private fun miniStatusBar():View{
    val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL}
    row.addView(pulseView(),LinearLayout.LayoutParams(dp(28),dp(22)))
    row.addView(textView("雙擊還原",7f,Color.LTGRAY,false),LinearLayout.LayoutParams(0,dp(22),1f))
    return row
  }

  private fun pulseView():TextView{
    val c=when(pulseStatus){"REFRESHING"->parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN);"SUCCESS"->Color.rgb(32,201,151);"ERROR"->Color.rgb(245,158,11);else->Color.GRAY}
    return textView(if(pulseStatus=="REFRESHING")"● 更新" else "●",8f,c,true)
  }

  private fun buildResponsiveContent(config:JSONObject):View{
    val layoutType=config.optString("layoutType",if(layoutStore.isMinimized())"SINGLE_ROW" else "LIST")
    val fields=activeFields(config)
    val positions=payload.optJSONArray("positions")?:JSONArray()
    val values=mutableListOf<Triple<String,String,Pair<Double?,JSONObject?>>>()
    if(positions.length()>0){
      val maxRows=if(layoutStore.isMinimized())1 else min(positions.length(),payload.optInt("rows",6).coerceIn(1,30))
      for(i in 0 until maxRows){val pos=positions.optJSONObject(i)?:continue;for(field in fields)values.add(Triple(field,fieldValue(field,pos),Pair(fieldNumber(field,pos),pos)))}
    }else for(field in fields)values.add(Triple(field,fieldValue(field,null),Pair(fieldNumber(field,null),null)))
    if(values.isEmpty())values.add(Triple("updatedAt",payload.optString("updatedAt","--:--:--"),Pair(null,null)))

    val widthDp=currentRect().width
    val columns=when(layoutType){
      "SINGLE_ROW"->max(1,values.size)
      "DUAL_ROW"->max(1,ceil(values.size/2.0).toInt())
      "LIST"->1
      "MINI_CARD"->min(2,max(1,widthDp/92))
      "GRID"->min(5,max(1,widthDp/108))
      else->1
    }
    val grid=GridLayout(this).apply{columnCount=columns;rowCount=GridLayout.UNDEFINED;useDefaultMargins=false}
    val font=config.optDouble("fontSize",if(layoutStore.isMinimized())10.0 else 12.0).toFloat().coerceIn(6f,28f)
    val spacing=config.optInt("itemSpacing",4).coerceIn(0,24)
    for((field,value,meta) in values){
      val tile=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(spacing),dp(max(1,spacing/2)),dp(spacing),dp(max(1,spacing/2)))}
      if(!layoutStore.isMinimized())tile.addView(textView(fieldLabel(field),max(7f,font-3f),Color.LTGRAY,false))
      tile.addView(textView(value,font,resolveFieldColor(field,meta.first,meta.second),true))
      val lp=GridLayout.LayoutParams().apply{width=0;height=GridLayout.LayoutParams.WRAP_CONTENT;columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);setMargins(dp(1),dp(1),dp(1),dp(1))}
      grid.addView(tile,lp)
    }
    return grid
  }

  private fun activeFields(config:JSONObject):List<String>{
    val raw=config.optJSONArray("displayFields")?:payload.optJSONArray("fields")?:JSONArray().put("symbol").put("price").put("todayPnl")
    val order=config.optJSONArray("fieldOrder")
    val available=(0 until raw.length()).map{raw.optString(it)}.filter{it.isNotBlank()}
    val ordered=if(order!=null)(0 until order.length()).map{order.optString(it)}.filter{available.contains(it)}+available.filterNot{f->(0 until order.length()).any{order.optString(it)==f}} else available
    return ordered.distinct().take(config.optInt("maxDisplayCount",ordered.size).coerceIn(1,30))
  }

  private fun fieldLabel(key:String)=mapOf(
    "symbol" to "代號","name" to "名稱","price" to "即時行情","change" to "漲跌","changePct" to "漲跌幅","shares" to "持有股數","marketValue" to "即時市值","pureCost" to "純成本","instantPnl" to "庫存即時損益","instantRoi" to "庫存報酬率","todayPnl" to "今日損益","todayPnlPct" to "今日損益率","previousClose" to "昨收","open" to "開盤","high" to "最高","low" to "最低","volume" to "成交量","nav" to "NAV","premium" to "折溢價","updatedAt" to "更新時間","totalAssets" to "總資產","dividend" to "股息提醒"
  )[key]?:key

  private fun fieldValue(key:String,pos:JSONObject?):String=when(key){
    "symbol"->pos?.optString("symbol","--")?:"--";"name"->pos?.optString("name","--")?:"--";"price","previousClose","open","high","low","nav"->String.format(Locale.US,"%.2f",fieldNumber(key,pos)?:0.0)
    "change"->signed2(fieldNumber(key,pos)?:0.0);"changePct","premium","instantRoi","todayPnlPct"->signed2(fieldNumber(key,pos)?:0.0)+"%"
    "shares","marketValue","pureCost","volume","totalAssets"->money(fieldNumber(key,pos)?:0.0);"instantPnl","todayPnl"->signedMoney(fieldNumber(key,pos)?:0.0)
    "updatedAt"->payload.optString("updatedAt","--:--:--")
    "dividend"->if(payload.optString("dividendSymbol").isNotBlank())"${payload.optString("dividendSymbol")} ${payload.optString("dividendDate","--")}" else "—"
    else->"—"
  }

  private fun fieldNumber(key:String,pos:JSONObject?):Double?=when(key){
    "price","previousClose","open","high","low","nav","change","changePct","premium","shares","marketValue","pureCost","volume","instantPnl","instantRoi","todayPnl","todayPnlPct"->pos?.optDouble(key,0.0)
    "totalAssets"->payload.optDouble("totalAssets",0.0)
    else->null
  }

  private fun resolveFieldColor(field:String,value:Double?,pos:JSONObject?):Int{
    val text=parseColor(payload.optString("textColor","#FFFFFF"),Color.WHITE);val gain=parseColor(payload.optString("positive","#E54A45"),Color.RED);val loss=parseColor(payload.optString("negative","#12A875"),Color.GREEN);val neutral=parseColor(payload.optString("neutral","#F4D35E"),Color.YELLOW)
    if(field in setOf("instantPnl","instantRoi","todayPnl","todayPnlPct")){val v=value?:0.0;return if(v>0)gain else if(v<0)loss else neutral}
    if(field in setOf("price","change","changePct","premium")){
      val v=if(field=="price"){val price=pos?.optDouble("price",0.0)?:0.0;val up=pos?.optDouble("limitUp",0.0)?:0.0;val down=pos?.optDouble("limitDown",0.0)?:0.0;if(up>0&&abs(price-up)<.0001)return gain;if(down>0&&abs(price-down)<.0001)return loss;price-(pos?.optDouble("previousClose",price)?:price)}else value?:0.0
      return if(v>0)gain else if(v<0)loss else neutral
    }
    return text
  }

  private fun textView(value:String,size:Float,color:Int,bold:Boolean)=TextView(this).apply{
    text=value;textSize=size;setTextColor(color);gravity=Gravity.CENTER_VERTICAL;maxLines=2
    if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD)
  }

  private fun setPulseStatus(status:String){pulseStatus=status;handler.post{if(!destroyed)renderOverlay()}}
  private fun scheduleNextRefresh(){
    handler.removeCallbacks(refreshRunnable);if(destroyed)return
    val sec=payload.optDouble("refreshSeconds",5.0);if(sec<=0){setPulseStatus("PAUSED");return}
    handler.postDelayed(refreshRunnable,max(1000L,(sec*1000.0).toLong()))
  }

  private fun refreshSnapshot(){
    if(refreshInFlight){scheduleNextRefresh();return}
    val positions=payload.optJSONArray("positions")
    if(positions==null||positions.length()==0){setPulseStatus("SUCCESS");scheduleNextRefresh();return}
    refreshInFlight=true;setPulseStatus("REFRESHING");val basePayload=payload
    io.execute{
      try{
        val symbols=(0 until positions.length()).mapNotNull{positions.optJSONObject(it)?.optString("symbol")}.filter{it.isNotBlank()}
        if(symbols.isEmpty())throw IllegalStateException("no symbols")
        val channels=symbols.joinToString("|"){"tse_${it}.tw"}
        val url="https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${URLEncoder.encode(channels,"UTF-8")}&json=1&delay=0&_=${System.currentTimeMillis()}"
        val conn=(URL(url).openConnection() as HttpURLConnection).apply{requestMethod="GET";connectTimeout=8000;readTimeout=8000;setRequestProperty("Accept","application/json,text/plain,*/*")}
        val body=conn.inputStream.bufferedReader().use{it.readText()};conn.disconnect()
        val arr=JSONObject(body).optJSONArray("msgArray")?:throw IllegalStateException("TWSE no quote array")
        val map=HashMap<String,JSONObject>();for(i in 0 until arr.length()){val q=arr.optJSONObject(i)?:continue;val symbol=q.optString("c");if(symbol.isNotBlank())map[symbol]=q}
        if(map.isEmpty())throw IllegalStateException("TWSE no valid quote")
        val nextPositions=JSONArray(positions.toString());var instant=basePayload.optDouble("instantPnl",0.0);var todayTotal=basePayload.optDouble("todayPnl",0.0);var marketValue=basePayload.optDouble("marketValue",0.0)
        for(i in 0 until nextPositions.length()){
          val pos=nextPositions.optJSONObject(i)?:continue;val q=map[pos.optString("symbol")];val oldPrice=pos.optDouble("price",0.0);val oldPrevious=pos.optDouble("previousClose",oldPrice)
          val previous=(q?.let{num(it.optString("y"))}?:oldPrevious).takeIf{it>0}?:oldPrice;val price=(q?.let{num(it.optString("z"))}?:q?.let{num(it.optString("y"))}?:oldPrice.takeIf{it>0}?:previous)
          val shares=pos.optDouble("shares",0.0);val pureCost=pos.optDouble("pureCost",0.0);val oldMarket=pos.optDouble("marketValue",oldPrice*shares);val oldPnl=pos.optDouble("instantPnl",oldMarket-pureCost);val oldToday=pos.optDouble("todayPnl",(oldPrice-oldPrevious)*shares)
          val nextMarket=price*shares;val nextPnl=nextMarket-pureCost;val nextToday=(price-previous)*shares
          pos.put("price",price).put("previousClose",previous).put("marketValue",nextMarket).put("instantPnl",nextPnl).put("instantRoi",if(pureCost>0)nextPnl/pureCost*100 else 0.0).put("todayPnl",nextToday).put("todayPnlPct",if(previous*shares>0)nextToday/(previous*shares)*100 else 0.0).put("change",price-previous).put("changePct",if(previous>0)(price/previous-1)*100 else 0.0)
          pos.put("open",q?.let{num(it.optString("o"))}?:pos.optDouble("open",0.0)).put("high",q?.let{num(it.optString("h"))}?:pos.optDouble("high",0.0)).put("low",q?.let{num(it.optString("l"))}?:pos.optDouble("low",0.0)).put("volume",q?.let{num(it.optString("v"))}?:pos.optDouble("volume",0.0)).put("limitUp",q?.let{num(it.optString("u"))}?:pos.optDouble("limitUp",0.0)).put("limitDown",q?.let{num(it.optString("w"))}?:pos.optDouble("limitDown",0.0))
          instant+=nextPnl-oldPnl;todayTotal+=nextToday-oldToday;marketValue+=nextMarket-oldMarket
        }
        val updated=SimpleDateFormat("HH:mm:ss",Locale.TAIWAN).format(Date());val cash=basePayload.optDouble("cashBalance",0.0)
        handler.post{if(payload===basePayload){payload.put("positions",nextPositions).put("instantPnl",instant).put("todayPnl",todayTotal).put("marketValue",marketValue).put("totalAssets",marketValue+cash).put("updatedAt",updated).put("healthy",true);getSharedPreferences(MonitorLayoutStore.PREF,MODE_PRIVATE).edit().putString(PREF_PAYLOAD,payload.toString()).apply();refreshInFlight=false;setPulseStatus("SUCCESS");scheduleNextRefresh()}}
      }catch(_:Throwable){handler.post{if(payload===basePayload){payload.put("healthy",false);refreshInFlight=false;setPulseStatus("ERROR");scheduleNextRefresh()}}}
    }
  }

  private fun num(s:String?):Double?=if(s.isNullOrBlank()||s=="-")null else s.replace(",","").toDoubleOrNull()?.takeIf{it>0}
  private fun money(v:Double):String{val mode=payload.optString("moneyMode","smart");val digits=if(mode=="custom")payload.optInt("customMoneyDigits",2) else payload.optInt("moneyDigits",2);return NumberFormat.getNumberInstance(Locale.TAIWAN).apply{maximumFractionDigits=digits.coerceIn(0,8);minimumFractionDigits=if(mode=="smart")0 else digits.coerceIn(0,8)}.format(v)}
  private fun signedMoney(v:Double)=(if(v>0)"+" else if(v<0)"-" else "")+money(abs(v))
  private fun signed2(v:Double)=(if(v>0)"+" else if(v<0)"-" else "")+String.format(Locale.US,"%.2f",abs(v))
  private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
  private fun pxToDp(v:Int)=(v/resources.displayMetrics.density).toInt()
  private fun parseColor(s:String,fallback:Int)=try{Color.parseColor(s)}catch(_:Throwable){fallback}
  private fun withAlpha(color:Int,a:Int)=Color.argb(a.coerceIn(0,255),Color.red(color),Color.green(color),Color.blue(color))
}
