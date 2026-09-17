package com.etfpilot.floatingbot

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingInvestmentBotModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FloatingInvestmentBot")

    Function("hasOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }
    Function("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@Function false
      context.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    }
    Function("start") { payload: String -> val context=appContext.reactContext?:return@Function false;FloatingInvestmentBotService.start(context,payload);true }
    Function("update") { payload: String -> val context=appContext.reactContext?:return@Function false;FloatingInvestmentBotService.update(context,payload);true }
    Function("stop") { val context=appContext.reactContext?:return@Function false;FloatingInvestmentBotService.stop(context);true }

    Function("getLayoutSnapshot") {
      val context=appContext.reactContext?:return@Function "{}"
      MonitorLayoutStore(context).snapshot().toString()
    }
    Function("setLayoutSize") { width:Int,height:Int ->
      val context=appContext.reactContext?:return@Function false
      val store=MonitorLayoutStore(context);val current=store.activeLayout()
      store.saveCurrentLayout(current.copy(width=width.coerceAtLeast(if(store.isMinimized())72 else 120),height=height.coerceAtLeast(if(store.isMinimized())36 else 48)))
      true
    }
    Function("setLayoutRect") { mode:String,x:Int,y:Int,width:Int,height:Int ->
      val context=appContext.reactContext?:return@Function false
      val store=MonitorLayoutStore(context);val target=if(mode.equals("MINI",true))MonitorLayoutMode.MINI else MonitorLayoutMode.NORMAL
      store.save(target,MonitorRect(x.coerceAtLeast(0),y.coerceAtLeast(0),width.coerceAtLeast(if(target==MonitorLayoutMode.MINI)72 else 120),height.coerceAtLeast(if(target==MonitorLayoutMode.MINI)36 else 48)))
      true
    }
    Function("setMinimized") { minimized:Boolean ->
      val context=appContext.reactContext?:return@Function false
      MonitorLayoutStore(context).setMinimized(minimized);true
    }

    Function("setImmersiveEditor") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        val window = activity.window
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          window.insetsController?.let { controller ->
            if (enabled) { controller.hide(WindowInsets.Type.navigationBars());controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE }
            else controller.show(WindowInsets.Type.navigationBars())
          }
        } else {
          @Suppress("DEPRECATION")
          window.decorView.systemUiVisibility = if (enabled) View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE else View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
      }
      true
    }

    Function("getCurrentAppIcon") {
      val context = appContext.reactContext ?: return@Function "icon-01"
      context.getSharedPreferences("app_icon_center", 0).getString("current", "icon-01") ?: "icon-01"
    }
    Function("setAppIcon") { key: String ->
      val context = appContext.reactContext ?: return@Function false
      val index = key.removePrefix("icon-").toIntOrNull()?.coerceIn(1, 10) ?: return@Function false
      val pm = context.packageManager
      val selectedName = "${context.packageName}.Icon${index.toString().padStart(2, '0')}"
      pm.setComponentEnabledSetting(ComponentName(context, selectedName), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      for (i in 1..10) if (i != index) pm.setComponentEnabledSetting(ComponentName(context, "${context.packageName}.Icon${i.toString().padStart(2, '0')}"), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      context.getSharedPreferences("app_icon_center", 0).edit().putString("current", "icon-${index.toString().padStart(2, '0')}").apply();true
    }
  }
}
