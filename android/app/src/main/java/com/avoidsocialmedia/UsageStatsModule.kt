package com.avoidsocialmedia

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import com.avoidsocialmedia.analytics.DailyAnalyticsStore
import com.avoidsocialmedia.services.WatchdogService
import com.avoidsocialmedia.usage.UsageEventsCalculator
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class UsageStatsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "UsageStatsModule"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val packageManager = reactContext.packageManager
      val launchIntent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }
      val launchablePackageNames = packageManager
        .queryIntentActivities(launchIntent, 0)
        .map { it.activityInfo.packageName }
        .toSet()

      val apps = packageManager
        .getInstalledApplications(PackageManager.GET_META_DATA)
        .filter { appInfo ->
          launchablePackageNames.contains(appInfo.packageName) &&
            appInfo.packageName != reactContext.packageName
        }
        .map { appInfo ->
          InstalledAppSummary(
            packageName = appInfo.packageName,
            appName = packageManager.getApplicationLabel(appInfo).toString(),
            isSystemApp = appInfo.flags and ApplicationInfo.FLAG_SYSTEM != 0,
            icon = getAppIconBase64(packageManager, appInfo)
          )
        }
        .distinctBy { it.packageName }
        .sortedWith(compareBy<InstalledAppSummary> { it.isSystemApp }.thenBy { it.appName.lowercase() })

      val response = Arguments.createArray()
      apps.forEach { app ->
        response.pushMap(Arguments.createMap().apply {
          putString("packageName", app.packageName)
          putString("appName", app.appName)
          putBoolean("isSystemApp", app.isSystemApp)
          putString("icon", app.icon)
        })
      }

      promise.resolve(response)
    } catch (error: Exception) {
      promise.reject("INSTALLED_APPS_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun hasUsageAccess(promise: Promise) {
    try {
      promise.resolve(hasUsageStatsPermission())
    } catch (error: Exception) {
      promise.reject("USAGE_ACCESS_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
      } else {
        promise.resolve(true)
      }
    } catch (error: Exception) {
      promise.reject("OVERLAY_PERMISSION_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun hasNotificationPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val status = reactContext.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
        promise.resolve(status == PackageManager.PERMISSION_GRANTED)
      } else {
        promise.resolve(true)
      }
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_PERMISSION_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun requestUsageAccessPermission(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      startSettingsActivity(intent, Settings.ACTION_USAGE_ACCESS_SETTINGS)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("USAGE_ACCESS_REQUEST_FAILED", error)
    }
  }

  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${reactContext.packageName}")
        ).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        startSettingsActivity(intent, Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("OVERLAY_PERMISSION_REQUEST_FAILED", error)
    }
  }

  @ReactMethod
  fun startWatchdogService(promise: Promise) {
    try {
      WatchdogService.start(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WATCHDOG_START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopWatchdogService(promise: Promise) {
    try {
      WatchdogService.stop(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WATCHDOG_STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun getWatchdogDebugInfo(promise: Promise) {
    try {
      val preferences =
        reactContext.getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
      promise.resolve(preferences.getString("watchdogDebugInfo", null))
    } catch (error: Exception) {
      promise.reject("WATCHDOG_DEBUG_READ_FAILED", error)
    }
  }

  // NSR - For testing purposes only - Comment out before production build
  @ReactMethod
  fun resetWatchdogCompoundTime(promise: Promise) {
    if (!hasUsageStatsPermission()) {
      promise.reject("USAGE_ACCESS_NOT_GRANTED", "Usage access permission is not granted.")
      return
    }

    try {
      val preferences =
        reactContext.getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
      val selectedPackages = packageNamesToSet(preferences.getString("selectedPackageNames", "[]"))
      val usageByPackage = calculateUsageByPackage(selectedPackages)
      val baselineJson = JSONObject()
      usageByPackage.forEach { (packageName, usageMs) ->
        baselineJson.put(packageName, usageMs)
      }

      val nextResetVersion = preferences.getInt("watchdogUsageResetVersion", 0) + 1
      preferences.edit()
        .putString("watchdogUsageResetBaselines", baselineJson.toString())
        .putInt("watchdogUsageResetVersion", nextResetVersion)
        .putString("watchdogStateDate", todayKey())
        .putBoolean("watchdogHasHitLimit", false)
        .putInt("watchdogEscalationLevel", 0)
        .remove("watchdogDebugInfo")
        .apply()

      WatchdogService.start(reactContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("WATCHDOG_COMPOUND_RESET_FAILED", error)
    }
  }

  // NSR - For testing purposes only - Comment out before production build
  @ReactMethod
  fun seedAnalyticsTestData(promise: Promise) {
    try {
      val preferences =
        reactContext.getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
      val globalLimitMinutes = preferences.getInt("globalDailyLimit", 30).coerceAtLeast(15)
      DailyAnalyticsStore.seedAnalyticsTestData(reactContext, globalLimitMinutes)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("ANALYTICS_TEST_DATA_SEED_FAILED", error)
    }
  }

  @ReactMethod
  fun getTodayUsageStats(promise: Promise) {
    if (!hasUsageStatsPermission()) {
      promise.reject("USAGE_ACCESS_NOT_GRANTED", "Usage access permission is not granted.")
      return
    }

    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val endTime = System.currentTimeMillis()
      val startTime = UsageEventsCalculator.localStartOfDayMs()
      val usageByPackage = UsageEventsCalculator.calculateUsageByEvents(
        usageStatsManager,
        null,
        startTime,
        endTime,
      )

      val packageManager = reactContext.packageManager
      val mergedStats = usageByPackage
        .filterValues { it > 0L }
        .map { (packageName, totalTimeMs) ->
          UsageSummary(
            packageName = packageName,
            appName = getAppName(packageManager, packageName),
            totalTimeMs = totalTimeMs,
            lastTimeUsedMs = endTime,
          )
        }
        .sortedByDescending { it.totalTimeMs }

      val preferences =
        reactContext.getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
      val selectedPackages = packageNamesToSet(preferences.getString("selectedPackageNames", "[]"))
      val globalLimitMinutes = preferences.getInt("globalDailyLimit", 30).coerceAtLeast(15)
      val selectedUsageByPackage = mergedStats
        .filter { selectedPackages.contains(it.packageName) }
        .associate { it.packageName to it.totalTimeMs }

      DailyAnalyticsStore.updateUsageSnapshot(
        reactContext,
        selectedUsageByPackage,
        globalLimitMinutes,
      )

      val response = Arguments.createArray()
      mergedStats.forEach { summary ->
        response.pushMap(Arguments.createMap().apply {
          putString("packageName", summary.packageName)
          putString("appName", summary.appName)
          putDouble("totalTimeMs", summary.totalTimeMs.toDouble())
          putDouble("lastTimeUsedMs", summary.lastTimeUsedMs.toDouble())
        })
      }

      promise.resolve(response)
    } catch (error: Exception) {
      promise.reject("USAGE_STATS_READ_FAILED", error)
    }
  }

  private fun hasUsageStatsPermission(): Boolean {
    val appOpsManager = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOpsManager.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      reactContext.packageName,
    )

    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun startSettingsActivity(intent: Intent, fallbackAction: String) {
    val packageManager = reactContext.packageManager
    val resolvedIntent = if (intent.resolveActivity(packageManager) != null) {
      intent
    } else {
      Intent(fallbackAction).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
    }

    reactContext.startActivity(resolvedIntent)
  }

  private fun getAppName(packageManager: PackageManager, packageName: String): String {
    return try {
      val appInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(appInfo).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      packageName
    }
  }

  private fun packageNamesToSet(value: String?) = mutableSetOf<String>().apply {
    val jsonArray = JSONArray(value ?: "[]")

    for (index in 0 until jsonArray.length()) {
      add(jsonArray.getString(index))
    }
  }

  // NSR - For testing purposes only - Comment out before production build
  private fun calculateUsageByPackage(packageNames: Set<String>): Map<String, Long> {
    if (packageNames.isEmpty()) return emptyMap()

    val usageStatsManager =
      reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val endTime = System.currentTimeMillis()
    val startTime = UsageEventsCalculator.localStartOfDayMs()

    return UsageEventsCalculator.calculateUsageByEvents(
      usageStatsManager,
      packageNames,
      startTime,
      endTime,
    )
      .filterValues { it > 0L }
  }

  private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  private fun getAppIconBase64(packageManager: PackageManager, appInfo: ApplicationInfo): String? {
    return try {
      val drawable = packageManager.getApplicationIcon(appInfo)
      val bitmap = drawableToBitmap(drawable)
      val outputStream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
      Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
      null
    }
  }

  private fun drawableToBitmap(drawable: Drawable): Bitmap {
    if (drawable is BitmapDrawable) {
      return drawable.bitmap
    }
    val bitmap = Bitmap.createBitmap(
      drawable.intrinsicWidth.coerceAtLeast(1),
      drawable.intrinsicHeight.coerceAtLeast(1),
      Bitmap.Config.ARGB_8888
    )
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)
    return bitmap
  }

  private data class UsageSummary(
    val packageName: String,
    val appName: String,
    val totalTimeMs: Long,
    val lastTimeUsedMs: Long,
  )

  private data class InstalledAppSummary(
    val packageName: String,
    val appName: String,
    val isSystemApp: Boolean,
    val icon: String?,
  )
}
