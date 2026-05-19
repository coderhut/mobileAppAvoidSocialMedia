package com.avoidsocialmedia

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.avoidsocialmedia.services.WatchdogService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

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
  fun requestOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${reactContext.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
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
  fun getTodayUsageStats(promise: Promise) {
    if (!hasUsageStatsPermission()) {
      promise.reject("USAGE_ACCESS_NOT_GRANTED", "Usage access permission is not granted.")
      return
    }

    try {
      val usageStatsManager =
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val endTime = System.currentTimeMillis()
      val startTime = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }.timeInMillis

      val stats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startTime,
        endTime,
      )

      val packageManager = reactContext.packageManager
      val mergedStats = stats
        .filter { it.totalTimeInForeground > 0 }
        .groupBy { it.packageName }
        .map { (packageName, packageStats) ->
          UsageSummary(
            packageName = packageName,
            appName = getAppName(packageManager, packageName),
            totalTimeMs = packageStats.sumOf { it.totalTimeInForeground },
            lastTimeUsedMs = packageStats.maxOf { it.lastTimeUsed },
          )
        }
        .sortedByDescending { it.totalTimeMs }

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

  private fun getAppName(packageManager: PackageManager, packageName: String): String {
    return try {
      val appInfo = packageManager.getApplicationInfo(packageName, 0)
      packageManager.getApplicationLabel(appInfo).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      packageName
    }
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
  )
}
