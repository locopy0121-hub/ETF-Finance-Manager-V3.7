package com.etfpilot.floatingbot

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.util.Calendar

class FloatingMonitorScheduleReceiver : BroadcastReceiver() {
  companion object {
    private const val ACTION_CHECK = "com.etfpilot.floatingbot.SCHEDULE_CHECK"
    private const val PREF = "floating_investment_bot"
    private const val PREF_PAYLOAD = "payload"
    private const val REQUEST = 3600

    private fun minutes(hm:String):Int {
      val p=hm.split(":")
      return ((p.getOrNull(0)?.toIntOrNull()?:0).coerceIn(0,23))*60+((p.getOrNull(1)?.toIntOrNull()?:0).coerceIn(0,59))
    }
    fun scheduleAllows(payload:JSONObject, at:Long=System.currentTimeMillis()):Boolean {
      if(!payload.optBoolean("enabled",true)) return false
      val sc=payload.optJSONObject("schedule")?:return true
      if(!sc.optBoolean("enabled",false)||sc.optString("mode","manual")=="manual") return true
      val cal=Calendar.getInstance().apply{timeInMillis=at}
      val jsDay=cal.get(Calendar.DAY_OF_WEEK)-1
      val days=sc.optJSONArray("days")
      if(days!=null&&days.length()>0){var ok=false;for(i in 0 until days.length())if(days.optInt(i)==jsDay){ok=true;break};if(!ok)return false}
      val now=cal.get(Calendar.HOUR_OF_DAY)*60+cal.get(Calendar.MINUTE);val a=minutes(sc.optString("start","08:30"));val b=minutes(sc.optString("end","14:00"))
      return if(a<=b) now>=a&&now<b else now>=a||now<b
    }
    fun scheduleNext(context:Context,payload:JSONObject){
      val sc=payload.optJSONObject("schedule")?:return
      if(!sc.optBoolean("enabled",false)||sc.optString("mode","manual")=="manual")return
      val am=context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent=Intent(context,FloatingMonitorScheduleReceiver::class.java).setAction(ACTION_CHECK)
      val pi=PendingIntent.getBroadcast(context,REQUEST,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val now=System.currentTimeMillis();val current=scheduleAllows(payload,now);var next=0L
      // Minute-level search covers cross-midnight and selected weekdays without fragile boundary arithmetic.
      for(i in 1..(8*24*60)){val ts=now+i*60_000L;if(scheduleAllows(payload,ts)!=current){next=ts;break}}
      if(next>0){if(Build.VERSION.SDK_INT>=23)am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next,pi)else am.set(AlarmManager.RTC_WAKEUP,next,pi)}
    }
  }

  override fun onReceive(context:Context,intent:Intent?){
    val raw=context.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString(PREF_PAYLOAD,null)?:return
    val payload=try{JSONObject(raw)}catch(_:Throwable){return}
    if(scheduleAllows(payload)&&Settings.canDrawOverlays(context))FloatingInvestmentBotService.start(context,payload.toString()) else FloatingInvestmentBotService.stop(context)
    scheduleNext(context,payload)
  }
}
