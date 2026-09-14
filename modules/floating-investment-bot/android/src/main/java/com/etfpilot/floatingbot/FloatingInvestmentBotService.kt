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
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ScrollView
import android.widget.GridLayout
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
import kotlin.math.max
import kotlin.math.min

class FloatingInvestmentBotService : Service() {
  companion object {
    private const val ACTION_START = "com.etfpilot.floatingbot.START"
    private const val ACTION_UPDATE = "com.etfpilot.floatingbot.UPDATE"
    private const val ACTION_STOP = "com.etfpilot.floatingbot.STOP"
    private const val EXTRA_PAYLOAD = "payload"
    private const val PREF = "floating_investment_bot"
    private const val PREF_PAYLOAD = "payload"
    private const val PREF_X = "x"
    private const val PREF_Y = "y"
    private const val PREF_W = "w"
    private const val PREF_H = "h"
    private const val CHANNEL = "floating_investment_bot"
    private const val NOTIFICATION_ID = 3400

    fun start(context: Context, payload: String) {
      val i = Intent(context, FloatingInvestmentBotService::class.java)
        .setAction(ACTION_START).putExtra(EXTRA_PAYLOAD, payload)
      ContextCompat.startForegroundService(context, i)
    }

    fun update(context: Context, payload: String) {
      val i = Intent(context, FloatingInvestmentBotService::class.java)
        .setAction(ACTION_UPDATE).putExtra(EXTRA_PAYLOAD, payload)
      ContextCompat.startForegroundService(context, i)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, FloatingInvestmentBotService::class.java).setAction(ACTION_STOP))
    }
  }

  private lateinit var wm: WindowManager
  private var root: LinearLayout? = null
  private var text: TextView? = null
  private var params: WindowManager.LayoutParams? = null
  private val handler = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()
  private var payload = JSONObject()
  private var rotateIndex = 0
  private var destroyed = false

  private val refreshRunnable = object : Runnable {
    override fun run() {
      if (destroyed) return
      refreshQuotesInBackground()
      val sec = payload.optDouble("refreshSeconds", 5.0)
      val delay = if (sec <= 0.0) 1000L else max(250L, (sec * 1000.0).toLong())
      handler.postDelayed(this, delay)
    }
  }

  private val rotateRunnable = object : Runnable {
    override fun run() {
      if (destroyed) return
      rotateIndex++
      updateOverlayText()
      handler.postDelayed(this, max(500L, (payload.optDouble("rotateSeconds", 4.0) * 1000.0).toLong()))
    }
  }

  override fun onCreate() {
    super.onCreate()
    wm = getSystemService(WINDOW_SERVICE) as WindowManager
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    val raw = intent?.getStringExtra(EXTRA_PAYLOAD)
      ?: getSharedPreferences(PREF, MODE_PRIVATE).getString(PREF_PAYLOAD, null)
      ?: "{}"
    payload = try { JSONObject(raw) } catch (_: Throwable) { JSONObject() }
    getSharedPreferences(PREF, MODE_PRIVATE).edit().putString(PREF_PAYLOAD, payload.toString()).apply()
    FloatingMonitorScheduleReceiver.scheduleNext(this, payload)
    if (!FloatingMonitorScheduleReceiver.scheduleAllows(payload)) { stopSelf(); return START_NOT_STICKY }

    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    ensureOverlay()
    updateOverlayText()
    startAsForeground()
    handler.removeCallbacks(refreshRunnable)
    handler.removeCallbacks(rotateRunnable)
    handler.post(refreshRunnable)
    handler.post(rotateRunnable)
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
      val nm = getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(NotificationChannel(
        CHANNEL, "ETF 即時監控器", NotificationManager.IMPORTANCE_LOW
      ).apply { description = "跨 App 顯示使用者啟用的即時 ETF 投資資訊" })
    }
  }

  private fun notification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pi = if (launch != null) android.app.PendingIntent.getActivity(
      this, 0, launch,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    ) else null
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    b.setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
      .setContentTitle("ETF財務管家 · 即時監控器")
      .setContentText("正在跨 App 顯示即時損益與 ETF 資訊")
      .setOngoing(true)
    if (pi != null) b.setContentIntent(pi)
    return b.build()
  }

  private fun startAsForeground() {
    val n = notification()
    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, n)
    }
  }

  private fun ensureOverlay() {
    val scale = payload.optDouble("scale", 1.0).coerceIn(.7, 1.5)
    val mode = payload.optString("mode", "bubble")
    val preset = modeSize(mode, scale)
    val saved = getSharedPreferences(PREF, MODE_PRIVATE)
    val customW = payload.optDouble("width", 0.0)
    val customH = payload.optDouble("height", 0.0)
    val savedW = saved.getInt(PREF_W, 0)
    val savedH = saved.getInt(PREF_H, 0)
    val size = Pair(if (savedW > 0) savedW else if (customW > 0) customW.toInt() else preset.first, if (savedH > 0) savedH else if (customH > 0) customH.toInt() else preset.second)
    val p = params
    if (root != null && p != null) {
      p.width = dp(size.first)
      p.height = if (payload.optBoolean("autoHeight", true)) WindowManager.LayoutParams.WRAP_CONTENT else dp(size.second)
      try { wm.updateViewLayout(root, p) } catch (_: Throwable) {}
      return
    }

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

    val prefs = getSharedPreferences(PREF, MODE_PRIVATE)
    params = WindowManager.LayoutParams(
      dp(size.first), if (payload.optBoolean("autoHeight", true)) WindowManager.LayoutParams.WRAP_CONTENT else dp(size.second), type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = prefs.getInt(PREF_X, dp(18))
      y = prefs.getInt(PREF_Y, dp(180))
    }

    root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(10), dp(7), dp(10), dp(7))
      elevation = dp(10).toFloat()
    }
    text = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = (11f * payload.optDouble("fontScale", 1.0).toFloat()).coerceIn(8f, 20f)
      maxLines = 7
      setLineSpacing(0f, 1.05f)
    }
    root!!.addView(text, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT, if (payload.optBoolean("autoHeight", true)) LinearLayout.LayoutParams.WRAP_CONTENT else LinearLayout.LayoutParams.MATCH_PARENT
    ))
    installTouch(root!!)
    wm.addView(root, params)
  }

  private fun installTouch(view: View) {
    var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var moved = false; var lastTapAt = 0L
    view.setOnTouchListener { _, ev ->
      val p = params ?: return@setOnTouchListener false
      if (payload.optBoolean("locked", false)) {
        // Locked monitor consumes touches but never launches the host app.
        // Opening the app must be an explicit toolbar/action-button operation.
        return@setOnTouchListener true
      }
      when (ev.actionMasked) {
        MotionEvent.ACTION_DOWN -> { downX=ev.rawX;downY=ev.rawY;startX=p.x;startY=p.y;moved=false;true }
        MotionEvent.ACTION_MOVE -> { val dx=(ev.rawX-downX).toInt();val dy=(ev.rawY-downY).toInt();if(abs(dx)>dp(3)||abs(dy)>dp(3))moved=true;p.x=max(0,startX+dx);p.y=max(dp(24),startY+dy);try{wm.updateViewLayout(root,p)}catch(_:Throwable){};true }
        MotionEvent.ACTION_UP -> {
          if (moved) {
            if (payload.optBoolean("snap",true)) { val sw=resources.displayMetrics.widthPixels; p.x=if(p.x+p.width/2<sw/2)0 else max(0,sw-p.width) }
            val dock=payload.optString("dockMode","edge"); if(dock=="peek") { val sw=resources.displayMetrics.widthPixels; val peek=dp(28); p.x=if(p.x<sw/2)-max(0,p.width-peek) else max(0,sw-peek) }
            try{wm.updateViewLayout(root,p)}catch(_:Throwable){}; getSharedPreferences(PREF,MODE_PRIVATE).edit().putInt(PREF_X,p.x).putInt(PREF_Y,p.y).apply()
          } else {
            val now=System.currentTimeMillis(); val doubleTap=now-lastTapAt<420; lastTapAt=now
            if(doubleTap && payload.optBoolean("doubleTapLayout",true)) toggleFavoriteSize()
            // Single tap intentionally does nothing: touching the monitor must never jump back to the app.
          }; true
        }
        else -> false
      }
    }
  }

  private fun installResizeTouch(view: View) {
    var downX=0f;var downY=0f;var startW=0;var startH=0
    view.setOnTouchListener { _,ev ->
      val p=params?:return@setOnTouchListener false
      if (payload.optBoolean("locked", false)) return@setOnTouchListener true
      when(ev.actionMasked){
        MotionEvent.ACTION_DOWN->{downX=ev.rawX;downY=ev.rawY;startW=p.width;startH=if(p.height>0)p.height else root?.height?:dp(120);true}
        MotionEvent.ACTION_MOVE->{
          val minW=dp(payload.optInt("minWidth",120));val minH=dp(payload.optInt("minHeight",48));val maxW=resources.displayMetrics.widthPixels;val maxH=(resources.displayMetrics.heightPixels*payload.optDouble("maxHeightRatio",.72)).toInt()
          var nw=(startW+(ev.rawX-downX)).toInt().coerceIn(minW,maxW);var nh=(startH+(ev.rawY-downY)).toInt().coerceIn(minH,maxH)
          val grid=dp(payload.optInt("gridSnap",8).coerceIn(1,32)); if(grid>1){nw=max(minW,(nw/grid)*grid);nh=max(minH,(nh/grid)*grid)}
          p.width=nw;p.height=nh;try{wm.updateViewLayout(root,p)}catch(_:Throwable){};true
        }
        MotionEvent.ACTION_UP->{getSharedPreferences(PREF,MODE_PRIVATE).edit().putInt(PREF_W,(p.width/resources.displayMetrics.density).toInt()).putInt(PREF_H,(p.height/resources.displayMetrics.density).toInt()).apply();if(payload.optBoolean("haptics",true))view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK);true}
        else->false
      }
    }
  }

  private fun toggleFavoriteSize(){
    val p=params?:return;val minW=dp(max(120,payload.optInt("minWidth",120)));val minH=dp(max(48,payload.optInt("minHeight",48)));val expanded=p.width>minW*2
    if(expanded){p.width=minW;p.height=minH}else{p.width=min(resources.displayMetrics.widthPixels-dp(16),dp(payload.optInt("width",390)));p.height=min((resources.displayMetrics.heightPixels*.72).toInt(),dp(payload.optInt("height",240)))}
    try{wm.updateViewLayout(root,p)}catch(_:Throwable){}
  }

  private fun launchApp() {
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      startActivity(it)
    }
  }

  private fun modeSize(mode: String, scale: Double): Pair<Int, Int> {
    val base = when (mode) {
      "ticker" -> 238 to 50
      "mini" -> 220 to 128
      "chat" -> 194 to 76
      "focus" -> 206 to 112
      "market" -> 218 to 100
      "multi" -> 222 to 148
      "dividend" -> 220 to 104
      "switcher" -> 228 to 116
      "transparent" -> 180 to 54
      else -> 94 to 66
    }
    return (base.first * scale).toInt() to (base.second * scale).toInt()
  }

  private fun updateOverlayText() {
    ensureOverlay()
    val opacity = payload.optDouble("opacity", .92).coerceIn(.25, 1.0)
    val accent = parseColor(payload.optString("accent", "#D4AF37"), Color.rgb(212, 175, 55))
    val bgColor = parseColor(payload.optString("background", "#08111F"), Color.rgb(8,17,31))
    val border = parseColor(payload.optString("borderColor", "#3AC7FF"), accent)
    val radius = payload.optInt("radius", 16).coerceIn(0, 36)
    val bgAlpha = if (payload.optString("mode") == "transparent") (70 * opacity).toInt() else (235 * opacity).toInt()
    val bg = GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(radius).toFloat()
      setColor(withAlpha(bgColor, bgAlpha.coerceIn(30,245)))
      setStroke(dp(1), withAlpha(border, 190))
    }
    root?.background = bg
    if (payload.optString("mode", "bubble") == "table") { renderTableOverlay(); return }
    if (payload.optString("mode", "bubble") == "puzzle") { renderPuzzleOverlay(); return }
    if (text?.parent == null) {
      root?.removeAllViews()
      root?.addView(text, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    val minFont = payload.optDouble("fontMin", 8.0).toFloat().coerceIn(6f, 24f)
    val maxFont = payload.optDouble("fontMax", 22.0).toFloat().coerceIn(minFont, 32f)
    val adaptive = if (payload.optBoolean("autoFont", true)) ((params?.width ?: dp(238)).toFloat() / dp(238).toFloat()).coerceIn(.72f, 1.35f) else 1f
    text?.textSize = (11f * payload.optDouble("fontScale", 1.0).toFloat() * adaptive).coerceIn(minFont, maxFont)
    text?.maxHeight = (resources.displayMetrics.heightPixels * payload.optDouble("maxHeightRatio", .72).coerceIn(.35, .9)).toInt()
    text?.maxLines = if (payload.optBoolean("autoHeight", true)) 14 else 7
    val positive = parseColor(payload.optString("positive", "#E54A45"), Color.rgb(229,74,69))
    val negative = parseColor(payload.optString("negative", "#12A875"), Color.rgb(18,168,117))
    val pnl = payload.optDouble("instantPnl", 0.0)
    val mode = payload.optString("mode", "bubble")
    text?.setTextColor(if (mode == "chat" || mode == "switcher") accent else if (pnl > 0) positive else if (pnl < 0) negative else Color.WHITE)
    text?.text = renderText()
  }

  private fun fieldStyle(key:String):JSONObject = payload.optJSONObject("fieldStyles")?.optJSONObject(key) ?: JSONObject()
  private fun uiNode(id:String):JSONObject = payload.optJSONObject("uiNodes")?.optJSONObject(id) ?: JSONObject()
  private fun uiName(id:String,fallback:String):String { val n=uiNode(id);if(n.optJSONObject("text")?.optBoolean("visible",true)==false)return "";return n.optString("displayName",n.optString("systemName",fallback)).ifBlank{fallback} }
  private fun uiEffects(id:String):JSONArray = uiNode(id).optJSONArray("effects") ?: JSONArray()
  private fun activeEffect(id:String,vararg kinds:String):JSONObject? { val a=uiEffects(id);for(i in 0 until a.length()){val e=a.optJSONObject(i)?:continue;if(e.optBoolean("enabled",true)&&kinds.contains(e.optString("kind")))return e};return null }
  private fun uiColor(id:String,slot:String,theme:Int,pnl:Double):Int { val n=uiNode(id);val text=n.optJSONObject("text")?:JSONObject();val mode=if(slot=="text")text.optString("colorMode","theme")else n.optString(slot+"ColorMode","theme");val fixed=if(slot=="text")text.optString("color","")else n.optString(slot+"Color","");val positive=parseColor(payload.optString("positive","#E54A45"),Color.RED);val negative=parseColor(payload.optString("negative","#12A875"),Color.GREEN);val neutral=parseColor(payload.optString("neutral","#94A3B8"),Color.GRAY);return when(mode){"fixed"->parseColor(fixed,theme);"profitLoss"->if(pnl>0)positive else if(pnl<0)negative else neutral;"auto"->if(fixed.isNotBlank())parseColor(fixed,theme) else theme;else->theme} }

  private fun styledFieldText(value:String,key:String,size:Float=10f,bold:Boolean=false,fallbackColor:Int=Color.WHITE,pnlValue:Double?=null,maxLines:Int=1):TextView {
    val style=fieldStyle(key)
    val globalScale=payload.optDouble("fontScale",1.0).toFloat().coerceIn(.7f,1.8f)
    val localScale=(style.optDouble("fontScale",100.0)/100.0).toFloat().coerceIn(.6f,2.2f)
    var color=parseColor(style.optString("textColor",""),fallbackColor)
    if(style.optBoolean("profitLossColor",false) && pnlValue!=null){
      color=when{pnlValue>0->parseColor(style.optString("positiveColor",payload.optString("positive","#E54A45")),fallbackColor);pnlValue<0->parseColor(style.optString("negativeColor",payload.optString("negative","#12A875")),fallbackColor);else->parseColor(style.optString("neutralColor",payload.optString("neutral","#94A3B8")),fallbackColor)}
    }
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
      val bgOpacity=style.optInt("backgroundOpacity",0).coerceIn(0,100)
      val bgRaw=style.optString("backgroundColor","#00000000")
      if(bgOpacity>0||effect=="outline") background=GradientDrawable().apply{cornerRadius=dp(style.optInt("radius",4).coerceIn(0,30)).toFloat();setColor(withAlpha(parseColor(bgRaw,Color.TRANSPARENT),(255*bgOpacity/100.0).toInt()));if(effect=="outline")setStroke(dp(max(1,strength/35)),withAlpha(color,220))}
      when(effect){"shadow"->setShadowLayer(max(1f,strength/10f),dp(1).toFloat(),dp(1).toFloat(),Color.BLACK);"glow"->setShadowLayer(max(1f,strength/7f),0f,0f,color)}
    }
  }

  private fun renderTableOverlay() {
    val host=root ?: return; host.removeAllViews(); host.setPadding(dp(8),dp(6),dp(8),dp(6))
    val positive=parseColor(payload.optString("positive","#E54A45"),Color.rgb(229,74,69));val negative=parseColor(payload.optString("negative","#12A875"),Color.rgb(18,168,117));val neutral=parseColor(payload.optString("neutral","#94A3B8"),Color.LTGRAY);val textColor=parseColor(payload.optString("textColor","#FFFFFF"),Color.WHITE);val accent=parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN)
    fun plain(v:String,sz:Float=10f,bold:Boolean=false,c:Int=textColor)=TextView(this).apply{text=v;textSize=sz*payload.optDouble("fontScale",1.0).toFloat();setTextColor(c);gravity=Gravity.CENTER_VERTICAL;setPadding(dp(4),dp(2),dp(4),dp(2));if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);maxLines=1}
    val totalPnl=payload.optDouble("instantPnl",0.0);val rootId="overlay:root:title";val gradient=activeEffect(rootId,"gradient");val highlight=activeEffect(rootId,"innerGlow","innerShadow","shimmer","sweep");if(gradient!=null){val start=uiColor(rootId,"background",parseColor(payload.optString("background","#08111F"),Color.DKGRAY),totalPnl);val end=parseColor(gradient.optString("color","#3AC7FF"),accent);host.background=GradientDrawable(when(gradient.optString("direction","right")){"left"->GradientDrawable.Orientation.RIGHT_LEFT;"up"->GradientDrawable.Orientation.BOTTOM_TOP;"down"->GradientDrawable.Orientation.TOP_BOTTOM;else->GradientDrawable.Orientation.LEFT_RIGHT},intArrayOf(start,end)).apply{cornerRadius=dp(payload.optInt("radius",16)).toFloat();setStroke(dp(max(1,(highlight?.optInt("range",4)?:4)/4)),parseColor(highlight?.optString("color","")?:"",uiColor(rootId,"border",accent,totalPnl)))}}else if(highlight!=null){host.background=GradientDrawable().apply{cornerRadius=dp(payload.optInt("radius",16)).toFloat();setColor(uiColor(rootId,"background",parseColor(payload.optString("background","#08111F"),Color.DKGRAY),totalPnl));setStroke(dp(max(1,highlight.optInt("range",4)/4)),parseColor(highlight.optString("color",""),uiColor(rootId,"border",accent,totalPnl)))}};val header=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};header.addView(plain(uiName(rootId,payload.optString("title","即時監控器")),13f,true,uiColor(rootId,"text",accent,totalPnl)),LinearLayout.LayoutParams(0,dp(30),1.2f));val healthy=payload.optBoolean("healthy",true);if(payload.optBoolean("showBreathingLight",true))header.addView(plain("${if(healthy)"●" else "◉"} ${uiName("overlay:status:title",payload.optString("statusTitle","市場狀態"))} ${payload.optString("marketState","--")}",9f,true,uiColor("overlay:status:title","text",if(healthy)Color.rgb(32,201,151) else Color.rgb(245,158,11),totalPnl)),LinearLayout.LayoutParams(0,dp(30),1f));val minimize=plain("—",13f,true,neutral).apply{setOnClickListener{toggleFavoriteSize()}};header.addView(minimize,LinearLayout.LayoutParams(dp(30),dp(30)));val close=plain("✕",12f,true,neutral).apply{setOnClickListener{root?.visibility=View.GONE}};header.addView(close,LinearLayout.LayoutParams(dp(30),dp(30)));host.addView(header)
    val rawFields=payload.optJSONArray("fields") ?: JSONArray().put("symbol").put("price").put("instantPnl")
    val fields=mutableListOf<String>();for(i in 0 until rawFields.length()){val k=rawFields.optString(i);if(fieldStyle(k).optBoolean("visible",true))fields.add(k)}
    val rows=payload.optJSONArray("positions") ?: JSONArray(); val maxRows=payload.optInt("rows",6).coerceIn(1,30)
    val labels=mapOf("symbol" to "代號","name" to "名稱","price" to "即時行情","change" to "漲跌","changePct" to "漲跌幅","shares" to "持有股數","marketValue" to "即時市值","pureCost" to "純成本","instantPnl" to "庫存即時損益","instantRoi" to "庫存報酬率","todayPnl" to "今日損益","todayPnlPct" to "今日損益率","previousClose" to "昨收","open" to "開盤","high" to "最高","low" to "最低","volume" to "成交量","nav" to "NAV","premium" to "折溢價","updatedAt" to "更新").mapValues{(k,v)->uiName("overlay:field:$k",v)}
    val widthDp=((params?.width ?: dp(390))/resources.displayMetrics.density).toInt();val ph=params?.height?:dp(240);val heightDp=if(ph>0)(ph/resources.displayMetrics.density).toInt() else payload.optInt("height",240);val fluid=payload.optString("resizeMode","fluid")=="fluid";val adaptiveCols=if(fluid)max(2,min(8,widthDp/92))else min(8,max(1,fields.size));val columnCount=min(fields.size,adaptiveCols)
    val titleRow=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL};for(i in 0 until columnCount){val k=fields[i];titleRow.addView(styledFieldText(labels[k]?:k,k,8f,true,neutral,null),LinearLayout.LayoutParams(0,dp(27),1f))};host.addView(titleRow)
    fun pnlFor(key:String,pos:JSONObject):Double?=when(key){"instantPnl","instantRoi"->pos.optDouble("instantPnl",0.0);"todayPnl","todayPnlPct"->pos.optDouble("todayPnl",0.0);"change","changePct","premium"->if(key=="premium")pos.optDouble("premium",0.0) else pos.optDouble("change",0.0);else->null}
    fun fallbackColor(key:String,pos:JSONObject):Int{val v=pnlFor(key,pos);return if(v==null)textColor else if(v>0)positive else if(v<0)negative else neutral}
    fun valueFor(key:String,pos:JSONObject):String=when(key){"symbol"->pos.optString("symbol","--");"name"->pos.optString("name","--");"price"->pos.optDouble("price",0.0).fmt2();"change"->signed2(pos.optDouble("change",0.0));"changePct"->signed2(pos.optDouble("changePct",0.0))+"%";"shares"->money(pos.optDouble("shares",0.0));"marketValue"->money(pos.optDouble("marketValue",0.0));"pureCost"->money(pos.optDouble("pureCost",0.0));"instantPnl"->signedMoney(pos.optDouble("instantPnl",0.0));"instantRoi"->signed2(pos.optDouble("instantRoi",0.0))+"%";"todayPnl"->signedMoney(pos.optDouble("todayPnl",0.0));"todayPnlPct"->signed2(pos.optDouble("todayPnlPct",0.0))+"%";"previousClose"->pos.optDouble("previousClose",0.0).fmt2();"open"->pos.optDouble("open",0.0).fmt2();"high"->pos.optDouble("high",0.0).fmt2();"low"->pos.optDouble("low",0.0).fmt2();"volume"->money(pos.optDouble("volume",0.0));"nav"->pos.optDouble("nav",0.0).fmt2();"premium"->signed2(pos.optDouble("premium",0.0))+"%";"updatedAt"->payload.optString("updatedAt","--:--:--");else->"—"}
    val density=payload.optString("density","auto");val rowHeight=if(density=="compact")dp(24) else dp(30);val rowHost=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};val n=min(maxRows,rows.length());for(r in 0 until n){val pos=rows.optJSONObject(r)?:continue;val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL};for(c in 0 until columnCount){val k=fields[c];row.addView(styledFieldText(valueFor(k,pos),k,9f,k=="symbol",fallbackColor(k,pos),pnlFor(k,pos)),LinearLayout.LayoutParams(0,rowHeight,1f))};rowHost.addView(row)};val scroll=ScrollView(this).apply{isFillViewport=false;addView(rowHost)};val maxContent=dp(max(48,min(heightDp-112,(resources.displayMetrics.heightPixels/resources.displayMetrics.density*payload.optDouble("maxHeightRatio",.72)).toInt()-112)));host.addView(scroll,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,maxContent))
    val sum=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(0,dp(4),0,0)};sum.addView(plain("${uiName("overlay:summary:cost","總成本")} ${money(payload.optDouble("totalCost",0.0))}",8f,true),LinearLayout.LayoutParams(0,dp(26),1f));sum.addView(plain("${uiName("overlay:summary:value","總市值")} ${money(payload.optDouble("marketValue",0.0))}",8f,true),LinearLayout.LayoutParams(0,dp(26),1f));val pnl=payload.optDouble("instantPnl",0.0);sum.addView(plain("${uiName("overlay:summary:pnl","損益")} ${signedMoney(pnl)}",8f,true,uiColor("overlay:summary:pnl","text",if(pnl>0)positive else if(pnl<0)negative else neutral,pnl)),LinearLayout.LayoutParams(0,dp(26),1f));host.addView(sum)
    val locked=payload.optBoolean("locked",false);val footer=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};footer.addView(plain(if(locked)"🔒 桌面版面已鎖定　更新 ${payload.optString("updatedAt","--:--:--")}" else "🔓 可拖移/縮放　TWSE ${payload.optString("updatedAt","--:--:--")}",8f,false,neutral),LinearLayout.LayoutParams(0,dp(28),1f));if(!locked){val grip=plain("↘",16f,true,accent);footer.addView(grip,LinearLayout.LayoutParams(dp(36),dp(30)));installResizeTouch(grip)};host.addView(footer)
  }

  private fun renderPuzzleOverlay() {
    val host=root?:return;host.removeAllViews();host.setPadding(dp(7),dp(6),dp(7),dp(6));val positive=parseColor(payload.optString("positive","#E54A45"),Color.rgb(229,74,69));val negative=parseColor(payload.optString("negative","#12A875"),Color.rgb(18,168,117));val neutral=parseColor(payload.optString("neutral","#94A3B8"),Color.LTGRAY);val accent=parseColor(payload.optString("accent","#3AC7FF"),Color.CYAN)
    fun plain(v:String,sz:Float=10f,bold:Boolean=false,c:Int=Color.WHITE)=TextView(this).apply{text=v;textSize=sz*payload.optDouble("fontScale",1.0).toFloat();setTextColor(c);setPadding(dp(5),dp(3),dp(5),dp(3));if(bold)setTypeface(typeface,android.graphics.Typeface.BOLD);maxLines=2}
    val header=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};header.addView(plain(payload.optString("title","即時監控器"),12f,true,accent),LinearLayout.LayoutParams(0,dp(30),1f));if(payload.optBoolean("showBreathingLight",true))header.addView(plain("● ${payload.optString("statusTitle","市場狀態")}",8f,false,neutral),LinearLayout.LayoutParams(dp(92),dp(30)));val minimize=plain("—",13f,true,neutral).apply{setOnClickListener{toggleFavoriteSize()}};header.addView(minimize,LinearLayout.LayoutParams(dp(30),dp(30)));val close=plain("✕",12f,true,neutral).apply{setOnClickListener{root?.visibility=View.GONE}};header.addView(close,LinearLayout.LayoutParams(dp(30),dp(30)));host.addView(header)
    val widthDp=((params?.width?:dp(390))/resources.displayMetrics.density).toInt();val ph=params?.height?:dp(240);val heightDp=if(ph>0)(ph/resources.displayMetrics.density).toInt()else payload.optInt("height",240);val columns=if(widthDp>=330)2 else 1;val grid=GridLayout(this).apply{columnCount=columns;rowCount=GridLayout.UNDEFINED;useDefaultMargins=true}
    fun card(title:String,value:String,sub:String,key:String,color:Int,pnlValue:Double?){val st=fieldStyle(key);if(!st.optBoolean("visible",true))return;val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;val pad=dp(st.optInt("padding",8));setPadding(pad,pad/2,pad,pad/2);background=GradientDrawable().apply{cornerRadius=dp(st.optInt("radius",10)).toFloat();val op=st.optInt("backgroundOpacity",16).coerceIn(0,100);setColor(withAlpha(parseColor(st.optString("backgroundColor","#FFFFFF"),Color.WHITE),(255*op/100.0).toInt()));setStroke(dp(if(st.optString("effect","none")=="outline")2 else 1),Color.argb(55,255,255,255))}};box.addView(styledFieldText(title,key,8f,true,neutral,null,2));box.addView(styledFieldText(value,key,15f,true,color,pnlValue,2));if(heightDp>150)box.addView(styledFieldText(sub,key,8f,false,neutral,pnlValue,2));val lp=GridLayout.LayoutParams().apply{width=0;height=android.view.ViewGroup.LayoutParams.WRAP_CONTENT;columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);setMargins(dp(2),dp(2),dp(2),dp(2))};grid.addView(box,lp)}
    val total=payload.optDouble("instantPnl",0.0);card("庫存即時損益",signedMoney(total),"今日 ${signedMoney(payload.optDouble("todayPnl",0.0))}","instantPnl",if(total>0)positive else if(total<0)negative else neutral,total)
    val rows=payload.optJSONArray("positions")?:JSONArray();val maxCards=min(rows.length(),payload.optInt("rows",6).coerceIn(1,12));for(i in 0 until maxCards){val q=rows.optJSONObject(i)?:continue;val ch=q.optDouble("changePct",0.0);val pnl=q.optDouble("instantPnl",0.0);val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(8),dp(6),dp(8),dp(6));background=GradientDrawable().apply{cornerRadius=dp(10).toFloat();setColor(Color.argb(42,255,255,255));setStroke(dp(1),Color.argb(45,255,255,255))}};box.addView(styledFieldText(q.optString("symbol","ETF"),"symbol",9f,true,neutral,null));box.addView(styledFieldText(q.optDouble("price",0.0).fmt2(),"price",15f,true,Color.WHITE,ch));val subRow=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};subRow.addView(styledFieldText("${signed2(ch)}%","changePct",8f,false,neutral,ch,1),LinearLayout.LayoutParams(0,dp(24),1f));subRow.addView(styledFieldText("損益 ${signedMoney(pnl)}","instantPnl",8f,false,neutral,pnl,1),LinearLayout.LayoutParams(0,dp(24),1.2f));box.addView(subRow);val lp=GridLayout.LayoutParams().apply{width=0;height=android.view.ViewGroup.LayoutParams.WRAP_CONTENT;columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);setMargins(dp(2),dp(2),dp(2),dp(2))};grid.addView(box,lp)}
    host.addView(grid,LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,LinearLayout.LayoutParams.WRAP_CONTENT));val locked=payload.optBoolean("locked",false);val footer=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL};footer.addView(plain(if(locked)"🔒 桌面版面已鎖定" else "🔓 編輯中｜可拖移 · 右下角縮放",8f,false,neutral),LinearLayout.LayoutParams(0,dp(28),1f));if(!locked){val grip=plain("↘",16f,true,accent);footer.addView(grip,LinearLayout.LayoutParams(dp(36),dp(30)));installResizeTouch(grip)};host.addView(footer)
  }

  private fun signed2(v:Double):String=(if(v>0)"+" else if(v<0)"-" else "")+String.format(Locale.US,"%.2f",abs(v))

  private fun selectedMetricLines(): MutableList<String> {
    val fields = payload.optJSONArray("fields") ?: JSONArray().put("instantPnl").put("todayPnl").put("updatedAt")
    val lines = mutableListOf<String>()
    for (i in 0 until fields.length()) {
      when (fields.optString(i)) {
        "instantPnl" -> lines.add("即時 ${signedMoney(payload.optDouble("instantPnl", 0.0))}")
        "todayPnl" -> lines.add("今日 ${signedMoney(payload.optDouble("todayPnl", 0.0))}")
        "totalAssets" -> lines.add("總資產 ${money(payload.optDouble("totalAssets", 0.0))}")
        "marketValue" -> lines.add("持股市值 ${money(payload.optDouble("marketValue", 0.0))}")
        "dividend" -> lines.add(if (payload.optString("dividendSymbol").isNotBlank()) "${payload.optString("dividendSymbol")} 配息 ${payload.optString("dividendDate", "--")}" else "目前無待發放配息")
        "updatedAt" -> lines.add("更新 ${payload.optString("updatedAt", "--:--")}")
      }
    }
    if (lines.isEmpty()) lines.add("即時 ${signedMoney(payload.optDouble("instantPnl", 0.0))}")
    return lines
  }

  private fun renderText(): String {
    val mode = payload.optString("mode", "bubble")
    val pnl = payload.optDouble("instantPnl", 0.0)
    val today = payload.optDouble("todayPnl", 0.0)
    val state = payload.optString("marketState", "--")
    val updated = payload.optString("updatedAt", "--:--")
    val positions = payload.optJSONArray("positions") ?: JSONArray()
    val focus = if (positions.length() > 0) positions.optJSONObject(rotateIndex % positions.length()) else null
    val lamp = if (payload.optBoolean("healthy", true)) "●" else "◉"
    val selected = selectedMetricLines()
    val picked = selected[rotateIndex % selected.size]
    return when (mode) {
      "ticker" -> "$lamp  $picked"
      "mini" -> "投資快覽   $lamp\n${selected.take(4).joinToString("\n")}" 
      "chat" -> "✦ AI 投資助手\n點一下開啟 AI 對話\n$picked"
      "focus" -> if (focus != null) "${focus.optString("symbol")} ${focus.optString("name")}\n行情 ${focus.optDouble("price").fmt2()}\n即時 ${signedMoney(focus.optDouble("instantPnl"))}\n今日 ${signedMoney(focus.optDouble("todayPnl"))}\n$lamp $updated" else "尚無持倉"
      "market" -> "市場狀態   $lamp\n$state\n${selected.take(2).joinToString("\n")}" 
      "multi" -> buildString { append("持倉即時損益  $lamp"); val n=min(4,positions.length()); for(i in 0 until n){val q=positions.optJSONObject(i)?:continue;append("\n${q.optString("symbol")}  ${signedMoney(q.optDouble("instantPnl"))}")}; if(selected.any{it.startsWith("更新")})append("\n更新 $updated") }
      "dividend" -> "下一筆配息\n${payload.optString("dividendSymbol", "--")}  ${payload.optString("dividendDate", "--")}\n預估 ${money(payload.optDouble("dividendAmount", 0.0))}\n$lamp $updated"
      "switcher" -> "即時監控器模式切換\n點一下輪換樣式\n$picked\n$lamp $updated"
      "transparent" -> "$lamp  $picked"
      else -> "✦ ${picked.substringBefore(' ')}\n${picked.substringAfter(' ', picked)}\n$lamp"
    }
  }
  private fun refreshQuotesInBackground() {
    val positions = payload.optJSONArray("positions") ?: return
    if (positions.length() == 0) return
    io.execute {
      try {
        val symbols = (0 until positions.length()).mapNotNull { positions.optJSONObject(it)?.optString("symbol") }.filter { it.isNotBlank() }
        if (symbols.isEmpty()) return@execute
        val channels = symbols.joinToString("|") { "tse_${it}.tw" }
        val url = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${URLEncoder.encode(channels, "UTF-8")}&json=1&delay=0&_=${System.currentTimeMillis()}"
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
          setRequestProperty("Accept", "application/json,text/plain,*/*")
        }
        val body = conn.inputStream.bufferedReader().use { it.readText() }
        conn.disconnect()
        val arr = JSONObject(body).optJSONArray("msgArray") ?: return@execute
        val map = HashMap<String, JSONObject>()
        for (i in 0 until arr.length()) {
          val q = arr.optJSONObject(i) ?: continue
          map[q.optString("c")] = q
        }
        var instant = 0.0; var todayTotal = 0.0; var totalAssets = 0.0
        for (i in 0 until positions.length()) {
          val pos = positions.optJSONObject(i) ?: continue
          val q = map[pos.optString("symbol")] ?: continue
          val previous = num(q.optString("y")) ?: pos.optDouble("previousClose", pos.optDouble("price", 0.0))
          val price = num(q.optString("z")) ?: previous
          val shares = pos.optDouble("shares", 0.0)
          val pureCost = pos.optDouble("pureCost", 0.0)
          val p = price * shares - pureCost
          val td = (price - previous) * shares
          pos.put("price", price); pos.put("previousClose", previous); pos.put("marketValue", price*shares); pos.put("instantPnl", p); pos.put("instantRoi", if(pureCost>0) p/pureCost*100.0 else 0.0); pos.put("todayPnl", td); pos.put("todayPnlPct", if(previous*shares>0) td/(previous*shares)*100.0 else 0.0); pos.put("change",price-previous); pos.put("changePct",if(previous>0)(price/previous-1.0)*100.0 else 0.0); pos.put("open",num(q.optString("o"))?:pos.optDouble("open",0.0)); pos.put("high",num(q.optString("h"))?:pos.optDouble("high",0.0)); pos.put("low",num(q.optString("l"))?:pos.optDouble("low",0.0)); pos.put("volume",num(q.optString("v"))?:pos.optDouble("volume",0.0))
          instant += p; todayTotal += td; totalAssets += price * shares
        }
        payload.put("instantPnl", instant)
        payload.put("todayPnl", todayTotal)
        payload.put("totalAssets", totalAssets)
        payload.put("marketValue", totalAssets)
        payload.put("updatedAt", SimpleDateFormat("HH:mm:ss", Locale.TAIWAN).format(Date()))
        payload.put("healthy", true)
        getSharedPreferences(PREF, MODE_PRIVATE).edit().putString(PREF_PAYLOAD, payload.toString()).apply()
        handler.post { updateOverlayText() }
      } catch (_: Throwable) {
        payload.put("healthy", false)
        handler.post { updateOverlayText() }
      }
    }
  }

  private fun num(s: String?): Double? {
    if (s.isNullOrBlank() || s == "-") return null
    return s.replace(",", "").toDoubleOrNull()?.takeIf { it > 0 }
  }

  private fun money(v: Double): String {
    val mode = payload.optString("moneyMode", "smart")
    val digits = if (mode == "custom") payload.optInt("customMoneyDigits", 2) else payload.optInt("moneyDigits", 2)
    return NumberFormat.getNumberInstance(Locale.TAIWAN).apply {
      maximumFractionDigits = digits.coerceIn(0, 8)
      minimumFractionDigits = if (mode == "smart") 0 else digits.coerceIn(0, 8)
    }.format(v)
  }
  private fun signedMoney(v: Double): String = (if (v > 0) "+" else if (v < 0) "-" else "") + money(abs(v))
  private fun Double.fmt2(): String = String.format(Locale.US, "%.2f", this)
  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
  private fun parseColor(s: String, fallback: Int): Int = try { Color.parseColor(s) } catch (_: Throwable) { fallback }
  private fun withAlpha(color: Int, a: Int): Int = Color.argb(a.coerceIn(0,255), Color.red(color), Color.green(color), Color.blue(color))
}
