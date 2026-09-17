package com.etfpilot.floatingbot

import android.content.Context
import org.json.JSONObject

data class MonitorRect(val x:Int,val y:Int,val width:Int,val height:Int)

enum class MonitorLayoutMode { NORMAL, MINI }

class MonitorLayoutStore(context:Context) {
  companion object {
    const val PREF="floating_investment_bot"
    private const val NORMAL_X="normal_x"
    private const val NORMAL_Y="normal_y"
    private const val NORMAL_W="normal_w"
    private const val NORMAL_H="normal_h"
    private const val MINI_X="mini_x"
    private const val MINI_Y="mini_y"
    private const val MINI_W="mini_w"
    private const val MINI_H="mini_h"
    private const val IS_MINIMIZED="is_minimized"
    private const val INITIALIZED="dual_layout_initialized_v3"
  }

  private val prefs=context.getSharedPreferences(PREF,Context.MODE_PRIVATE)

  fun initialize(payload:JSONObject) {
    if(prefs.getBoolean(INITIALIZED,false))return
    val normal=rectFromPayload(payload.optJSONObject("normalLayout"),MonitorRect(18,180,390,240))
    val mini=rectFromPayload(payload.optJSONObject("miniLayout"),MonitorRect(18,180,220,88))
    prefs.edit()
      .putInt(NORMAL_X,normal.x).putInt(NORMAL_Y,normal.y).putInt(NORMAL_W,normal.width).putInt(NORMAL_H,normal.height)
      .putInt(MINI_X,mini.x).putInt(MINI_Y,mini.y).putInt(MINI_W,mini.width).putInt(MINI_H,mini.height)
      .putBoolean(IS_MINIMIZED,payload.optBoolean("isMinimized",false))
      .putBoolean(INITIALIZED,true).apply()
  }

  fun isMinimized():Boolean=prefs.getBoolean(IS_MINIMIZED,false)
  fun mode():MonitorLayoutMode=if(isMinimized())MonitorLayoutMode.MINI else MonitorLayoutMode.NORMAL
  fun setMinimized(value:Boolean){prefs.edit().putBoolean(IS_MINIMIZED,value).apply()}

  fun normalLayout():MonitorRect=MonitorRect(
    prefs.getInt(NORMAL_X,18),prefs.getInt(NORMAL_Y,180),
    prefs.getInt(NORMAL_W,390).coerceAtLeast(120),prefs.getInt(NORMAL_H,240).coerceAtLeast(48)
  )
  fun miniLayout():MonitorRect=MonitorRect(
    prefs.getInt(MINI_X,18),prefs.getInt(MINI_Y,180),
    prefs.getInt(MINI_W,220).coerceAtLeast(72),prefs.getInt(MINI_H,88).coerceAtLeast(36)
  )
  fun activeLayout():MonitorRect=if(isMinimized())miniLayout() else normalLayout()

  fun saveCurrentLayout(rect:MonitorRect){ save(mode(),rect) }
  fun save(mode:MonitorLayoutMode,rect:MonitorRect){
    val e=prefs.edit()
    if(mode==MonitorLayoutMode.NORMAL)e.putInt(NORMAL_X,rect.x).putInt(NORMAL_Y,rect.y).putInt(NORMAL_W,rect.width).putInt(NORMAL_H,rect.height)
    else e.putInt(MINI_X,rect.x).putInt(MINI_Y,rect.y).putInt(MINI_W,rect.width).putInt(MINI_H,rect.height)
    e.apply()
  }

  fun minimize():MonitorRect { setMinimized(true);return miniLayout() }
  fun restoreNormalLayout():MonitorRect { setMinimized(false);return normalLayout() }

  fun snapshot():JSONObject=JSONObject().apply{
    put("normalLayout",toJson(normalLayout()));put("miniLayout",toJson(miniLayout()));put("isMinimized",isMinimized())
    val active=activeLayout();put("x",active.x);put("y",active.y);put("width",active.width);put("height",active.height)
  }

  private fun rectFromPayload(obj:JSONObject?,fallback:MonitorRect)=MonitorRect(
    obj?.optInt("x",fallback.x)?:fallback.x,obj?.optInt("y",fallback.y)?:fallback.y,
    (obj?.optInt("width",fallback.width)?:fallback.width).coerceAtLeast(48),
    (obj?.optInt("height",fallback.height)?:fallback.height).coerceAtLeast(36)
  )
  private fun toJson(r:MonitorRect)=JSONObject().apply{put("x",r.x);put("y",r.y);put("width",r.width);put("height",r.height)}
}
