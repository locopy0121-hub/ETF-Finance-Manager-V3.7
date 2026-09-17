package com.etfpilot.floatingbot

import android.content.Context
import org.json.JSONObject

internal data class MonitorRect(val x:Int,val y:Int,val width:Int,val height:Int)

internal class FloatingMonitorLayoutStore(private val context:Context) {
  companion object {
    private const val PREF="floating_investment_bot"
    private const val MODE="layout_is_minimized"
    private const val NORMAL_X="normal_x"
    private const val NORMAL_Y="normal_y"
    private const val NORMAL_W="normal_w"
    private const val NORMAL_H="normal_h"
    private const val MINI_X="mini_x"
    private const val MINI_Y="mini_y"
    private const val MINI_W="mini_w"
    private const val MINI_H="mini_h"
  }
  private val prefs get()=context.getSharedPreferences(PREF,Context.MODE_PRIVATE)
  fun isMinimized()=prefs.getBoolean(MODE,false)
  fun setMinimized(value:Boolean)=prefs.edit().putBoolean(MODE,value).apply()

  fun normal(defaultX:Int=18,defaultY:Int=180,defaultW:Int=390,defaultH:Int=240)=MonitorRect(
    prefs.getInt(NORMAL_X,prefs.getInt("x",defaultX)),prefs.getInt(NORMAL_Y,prefs.getInt("y",defaultY)),
    prefs.getInt(NORMAL_W,prefs.getInt("w",defaultW)).coerceAtLeast(120),prefs.getInt(NORMAL_H,prefs.getInt("h",defaultH)).coerceAtLeast(48))

  fun mini(defaultX:Int=18,defaultY:Int=180,defaultW:Int=180,defaultH:Int=72)=MonitorRect(
    prefs.getInt(MINI_X,defaultX),prefs.getInt(MINI_Y,defaultY),prefs.getInt(MINI_W,defaultW).coerceAtLeast(96),prefs.getInt(MINI_H,defaultH).coerceAtLeast(40))

  fun active()=if(isMinimized())mini() else normal()

  fun saveActive(rect:MonitorRect){if(isMinimized())saveMini(rect) else saveNormal(rect)}
  fun saveNormal(rect:MonitorRect){prefs.edit().putInt(NORMAL_X,rect.x).putInt(NORMAL_Y,rect.y).putInt(NORMAL_W,rect.width).putInt(NORMAL_H,rect.height).apply()}
  fun saveMini(rect:MonitorRect){prefs.edit().putInt(MINI_X,rect.x).putInt(MINI_Y,rect.y).putInt(MINI_W,rect.width).putInt(MINI_H,rect.height).apply()}

  /** Payload may refresh many times while a native Mini window is active. It may update
   * the two stored rectangles, but must never force the active mode back to NORMAL. */
  fun applyPayload(payload:JSONObject){
    payload.optJSONObject("normalLayout")?.let{saveNormal(fromJson(it,normal()))}
    payload.optJSONObject("miniLayout")?.let{saveMini(fromJson(it,mini()))}
  }

  fun restoreNormal():MonitorRect{setMinimized(false);return normal()}
  fun minimize():MonitorRect{setMinimized(true);return mini()}

  fun snapshotJson()=JSONObject().apply{
    put("isMinimized",isMinimized())
    put("normalLayout",toJson(normal()))
    put("miniLayout",toJson(mini()))
    val a=active();put("width",a.width);put("height",a.height)
  }.toString()

  private fun fromJson(raw:JSONObject,fallback:MonitorRect)=MonitorRect(raw.optInt("x",fallback.x),raw.optInt("y",fallback.y),raw.optInt("width",fallback.width),raw.optInt("height",fallback.height))
  private fun toJson(r:MonitorRect)=JSONObject().put("x",r.x).put("y",r.y).put("width",r.width).put("height",r.height)
}
