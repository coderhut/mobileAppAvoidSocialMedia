package com.avoidsocialmedia.usage

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import java.util.Calendar

object UsageEventsCalculator {
  private const val LOOKBACK_WINDOW_MS = 24 * 60 * 60 * 1000L

  fun localStartOfDayMs(): Long =
    Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis

  fun calculateUsageByEvents(
    usageStatsManager: UsageStatsManager,
    packageNames: Set<String>?,
    startTime: Long,
    endTime: Long,
  ): Map<String, Long> {
    val usageByPackage = mutableMapOf<String, Long>()
    val foregroundStartByPackage = mutableMapOf<String, Long>()
    val events = usageStatsManager.queryEvents(startTime - LOOKBACK_WINDOW_MS, endTime)
    val event = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (packageNames != null && !packageNames.contains(packageName)) continue

      when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND -> {
          foregroundStartByPackage[packageName] = event.timeStamp
        }
        UsageEvents.Event.MOVE_TO_BACKGROUND -> {
          val foregroundStart = foregroundStartByPackage.remove(packageName) ?: continue
          val usageStart = maxOf(foregroundStart, startTime)
          val usageEnd = minOf(event.timeStamp, endTime)
          if (usageEnd > usageStart) {
            usageByPackage[packageName] =
              (usageByPackage[packageName] ?: 0L) + (usageEnd - usageStart)
          }
        }
      }
    }

    foregroundStartByPackage.forEach { (packageName, foregroundStart) ->
      val usageStart = maxOf(foregroundStart, startTime)
      if (endTime > usageStart) {
        usageByPackage[packageName] =
          (usageByPackage[packageName] ?: 0L) + (endTime - usageStart)
      }
    }

    return usageByPackage
  }

  fun getActiveForegroundPackage(
    usageStatsManager: UsageStatsManager,
    startTime: Long,
    endTime: Long,
  ): String? {
    val events = usageStatsManager.queryEvents(startTime - LOOKBACK_WINDOW_MS, endTime)
    val event = UsageEvents.Event()
    var lastForeground: String? = null

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.MOVE_TO_FOREGROUND -> lastForeground = event.packageName
        UsageEvents.Event.MOVE_TO_BACKGROUND -> {
          if (lastForeground == event.packageName) lastForeground = null
        }
      }
    }

    return lastForeground
  }
}
