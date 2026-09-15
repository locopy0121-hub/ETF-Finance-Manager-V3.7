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
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }

    Function("start") { payload: String ->
      val context = appContext.reactContext ?: return@Function false
      FloatingInvestmentBotService.start(context, payload)
      true
    }

    Function("update") { payload: String ->
      val context = appContext.reactContext ?: return@Function false
      FloatingInvestmentBotService.update(context, payload)
      true
    }

    Function("stop") {
      val context = appContext.reactContext ?: return@Function false
      FloatingInvestmentBotService.stop(context)
      true
    }

    Function("getLayoutSnapshot") {
      val context = appContext.reactContext ?: return@Function "{}"
      val prefs = context.getSharedPreferences("floating_investment_bot", 0)
      val width = prefs.getInt("w", 0)
      val height = prefs.getInt("h", 0)
      "{\"width\":$width,\"height\":$height}"
    }

    Function("setLayoutSize") { width: Int, height: Int ->
      val context = appContext.reactContext ?: return@Function false
      context.getSharedPreferences("floating_investment_bot", 0).edit()
        .putInt("w", width.coerceAtLeast(120))
        .putInt("h", height.coerceAtLeast(48))
        .apply()
      true
    }

    Function("setImmersiveEditor") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@Function false
      activity.runOnUiThread {
        val window = activity.window
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          window.insetsController?.let { controller ->
            if (enabled) {
              controller.hide(WindowInsets.Type.navigationBars())
              controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else controller.show(WindowInsets.Type.navigationBars())
          }
        } else {
          @Suppress("DEPRECATION")
          window.decorView.systemUiVisibility = if (enabled) {
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
              View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
              View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
              View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          } else View.SYSTEM_UI_FLAG_LAYOUT_STABLE
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
      // Enable the destination first so the launcher always has at least one valid entry.
      val selectedName = "${context.packageName}.Icon${index.toString().padStart(2, '0')}"
      pm.setComponentEnabledSetting(ComponentName(context, selectedName), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      for (i in 1..10) {
        if (i == index) continue
        val name = "${context.packageName}.Icon${i.toString().padStart(2, '0')}"
        pm.setComponentEnabledSetting(ComponentName(context, name), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      }
      context.getSharedPreferences("app_icon_center", 0).edit().putString("current", "icon-${index.toString().padStart(2, '0')}").apply()
      true
    }
  }
}
