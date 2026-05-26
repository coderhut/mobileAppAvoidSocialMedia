package com.avoidsocialmedia.analytics

import android.content.Context
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object DailyAnalyticsStore {
  private const val PREFERENCES_NAME = "avoid_social_media_preferences"
  private const val ANALYTICS_KEY = "dailyAnalytics"

  fun updateUsageSnapshot(
    context: Context,
    usageByPackage: Map<String, Long>,
    dailyLimitMinutes: Int,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    val totalTrackedMs = usageByPackage.values.sum()
    val analytics = readAnalytics(context)
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val dateKey = formatDate(nowMs)
    val day = daily.optJSONObject(dateKey) ?: createDay(dateKey)
    val previousLimitHits = day.optInt("limitHits", 0)
    val previousVoiceNoteInterventions = day.optInt("voiceNoteInterventions", 0)

    day.put("date", dateKey)
    day.put("totalTrackedMs", totalTrackedMs)
    day.put("perAppUsageMs", JSONObject().apply {
      usageByPackage.forEach { (packageName, usageMs) ->
        put(packageName, usageMs)
      }
    })
    day.put("limitHits", previousLimitHits)
    day.put("voiceNoteInterventions", previousVoiceNoteInterventions)
    day.put("dailyLimitMinutes", dailyLimitMinutes)
    day.put(
      "stayedUnderDailyLimit",
      dailyLimitMinutes <= 0 || totalTrackedMs < dailyLimitMinutes * 60000L,
    )
    day.put("lastUpdatedAt", nowMs)

    daily.put(dateKey, day)
    analytics.put("daily", daily)
    rebuildDerivedAnalytics(analytics, nowMs)
    saveAnalytics(context, analytics)
  }

  fun recordVoiceNoteIntervention(
    context: Context,
    level: Int,
    packageName: String?,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    val analytics = readAnalytics(context)
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val dateKey = formatDate(nowMs)
    val day = daily.optJSONObject(dateKey) ?: createDay(dateKey)

    day.put("voiceNoteInterventions", day.optInt("voiceNoteInterventions", 0) + 1)
    day.put("lastInterventionLevel", level)
    packageName?.let { day.put("lastInterventionPackage", it) }
    day.put("lastUpdatedAt", nowMs)

    daily.put(dateKey, day)
    analytics.put("daily", daily)
    rebuildDerivedAnalytics(analytics, nowMs)
    saveAnalytics(context, analytics)
  }

  fun recordLimitHit(
    context: Context,
    packageName: String?,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    val analytics = readAnalytics(context)
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val dateKey = formatDate(nowMs)
    val day = daily.optJSONObject(dateKey) ?: createDay(dateKey)

    day.put("limitHits", day.optInt("limitHits", 0) + 1)
    packageName?.let { day.put("lastLimitHitPackage", it) }
    day.put("lastUpdatedAt", nowMs)

    daily.put(dateKey, day)
    analytics.put("daily", daily)
    rebuildDerivedAnalytics(analytics, nowMs)
    saveAnalytics(context, analytics)
  }

  private fun readAnalytics(context: Context): JSONObject {
    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val rawAnalytics = preferences.getString(ANALYTICS_KEY, null)
    return try {
      if (rawAnalytics.isNullOrBlank()) JSONObject() else JSONObject(rawAnalytics)
    } catch (_: Exception) {
      JSONObject()
    }
  }

  private fun saveAnalytics(context: Context, analytics: JSONObject) {
    analytics.put("lastUpdatedAt", System.currentTimeMillis())
    context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(ANALYTICS_KEY, analytics.toString())
      .apply()
  }

  private fun createDay(dateKey: String) = JSONObject().apply {
    put("date", dateKey)
    put("totalTrackedMs", 0L)
    put("perAppUsageMs", JSONObject())
    put("limitHits", 0)
    put("voiceNoteInterventions", 0)
    put("dailyLimitMinutes", 0)
    put("stayedUnderDailyLimit", true)
  }

  private fun rebuildDerivedAnalytics(analytics: JSONObject, nowMs: Long) {
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val dates = daily.keys().asSequence().toList().sorted()
    val weekly = mutableMapOf<String, MutableList<JSONObject>>()
    val monthly = mutableMapOf<String, MutableList<JSONObject>>()
    var bestDay: JSONObject? = null
    var worstDay: JSONObject? = null
    var currentStreak = 0
    var longestStreak = 0
    var runningStreak = 0

    dates.forEach { dateKey ->
      val day = daily.optJSONObject(dateKey) ?: return@forEach
      weekly.getOrPut(formatWeekKey(dateKey)) { mutableListOf() }.add(day)
      monthly.getOrPut(dateKey.substring(0, 7)) { mutableListOf() }.add(day)

      if (bestDay == null || day.optLong("totalTrackedMs") < bestDay!!.optLong("totalTrackedMs")) {
        bestDay = cloneDaySummary(day)
      }
      if (worstDay == null || day.optLong("totalTrackedMs") > worstDay!!.optLong("totalTrackedMs")) {
        worstDay = cloneDaySummary(day)
      }

      if (day.optBoolean("stayedUnderDailyLimit", true)) {
        runningStreak += 1
        longestStreak = maxOf(longestStreak, runningStreak)
      } else {
        runningStreak = 0
      }
    }

    val todayKey = formatDate(nowMs)
    var dateCursor = parseDate(todayKey)
    while (dateCursor != null) {
      val day = daily.optJSONObject(formatDate(dateCursor.time)) ?: break
      if (!day.optBoolean("stayedUnderDailyLimit", true)) break
      currentStreak += 1
      dateCursor = Calendar.getInstance().apply {
        time = dateCursor
        add(Calendar.DAY_OF_YEAR, -1)
      }.time
    }

    analytics.put("weeklySummaries", buildSummaryObject(weekly))
    analytics.put("monthlySummaries", buildSummaryObject(monthly))
    bestDay?.let { analytics.put("bestUsageDay", it) }
    worstDay?.let { analytics.put("worstUsageDay", it) }
    analytics.put("currentStreak", currentStreak)
    analytics.put("longestStreak", longestStreak)
  }

  private fun buildSummaryObject(groups: Map<String, List<JSONObject>>) = JSONObject().apply {
    groups.forEach { (key, days) ->
      put(key, JSONObject().apply {
        put("totalTrackedMs", days.sumOf { it.optLong("totalTrackedMs", 0L) })
        put("limitHits", days.sumOf { it.optInt("limitHits", 0) })
        put("voiceNoteInterventions", days.sumOf { it.optInt("voiceNoteInterventions", 0) })
        put("daysTracked", days.size)
        put("daysUnderLimit", days.count { it.optBoolean("stayedUnderDailyLimit", true) })
      })
    }
  }

  private fun cloneDaySummary(day: JSONObject) = JSONObject().apply {
    put("date", day.optString("date"))
    put("totalTrackedMs", day.optLong("totalTrackedMs", 0L))
    put("limitHits", day.optInt("limitHits", 0))
    put("voiceNoteInterventions", day.optInt("voiceNoteInterventions", 0))
    put("stayedUnderDailyLimit", day.optBoolean("stayedUnderDailyLimit", true))
  }

  private fun formatDate(timestampMs: Long): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(timestampMs))

  private fun parseDate(dateKey: String): Date? =
    try {
      SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(dateKey)
    } catch (_: Exception) {
      null
    }

  private fun formatWeekKey(dateKey: String): String {
    val date = parseDate(dateKey) ?: return dateKey
    val calendar = Calendar.getInstance().apply {
      firstDayOfWeek = Calendar.MONDAY
      minimalDaysInFirstWeek = 4
      time = date
    }
    val year = calendar.get(Calendar.YEAR)
    val week = calendar.get(Calendar.WEEK_OF_YEAR).toString().padStart(2, '0')
    return "$year-W$week"
  }
}
