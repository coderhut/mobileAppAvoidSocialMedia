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
  private const val DAILY_RETENTION_DAYS = 90

  fun initializeAfterOnboarding(
    context: Context,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    val todayKey = formatDate(nowMs)
    val analytics = readAnalytics(context)

    initializeStreakDefaults(analytics, todayKey)
    analytics.put("daily", analytics.optJSONObject("daily") ?: JSONObject())
    analytics.put("weeklySummaries", analytics.optJSONObject("weeklySummaries") ?: JSONObject())
    analytics.put("monthlySummaries", analytics.optJSONObject("monthlySummaries") ?: JSONObject())

    saveAnalytics(context, analytics)
  }

  // NSR - For testing purposes only - Comment out before production build
  fun seedAnalyticsTestData(
    context: Context,
    dailyLimitMinutes: Int,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    val limitMinutes = dailyLimitMinutes.coerceAtLeast(15)
    val daily = JSONObject()
    val allGeneratedDays = mutableListOf<JSONObject>()
    val todayCalendar = Calendar.getInstance().apply {
      time = Date(nowMs)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    for (daysAgo in 99 downTo 0) {
      val dateMs = Calendar.getInstance().apply {
        time = todayCalendar.time
        add(Calendar.DAY_OF_YEAR, -daysAgo)
      }.timeInMillis
      val dateKey = formatDate(dateMs)
      val patternIndex = 99 - daysAgo
      val usageMinutes = when {
        patternIndex == 4 -> 6
        patternIndex == 12 -> limitMinutes + 85
        patternIndex % 9 == 0 -> limitMinutes + 28
        patternIndex % 6 == 0 -> limitMinutes + 10
        patternIndex % 5 == 0 -> 0
        else -> (8 + (patternIndex * 7 % limitMinutes)).coerceAtMost(limitMinutes - 1)
      }
      val totalTrackedMs = usageMinutes * 60000L
      val stayedUnderLimit = totalTrackedMs < limitMinutes * 60000L
      val interventions = if (stayedUnderLimit || totalTrackedMs == 0L) 0 else (patternIndex % 3) + 1
      val day = createDay(dateKey).apply {
        put("totalTrackedMs", totalTrackedMs)
        put("perAppUsageMs", JSONObject().apply {
          put("com.instagram.android", (totalTrackedMs * 0.58).toLong())
          put("com.google.android.youtube", (totalTrackedMs * 0.42).toLong())
        })
        put("limitHits", if (stayedUnderLimit || totalTrackedMs == 0L) 0 else 1)
        put("voiceNoteInterventions", interventions)
        put("dailyLimitMinutes", limitMinutes)
        put("stayedUnderDailyLimit", stayedUnderLimit)
        put("lastUpdatedAt", dateMs)
        if (interventions > 0) {
          put("lastInterventionLevel", minOf(3, interventions))
          put(
            "lastInterventionPackage",
            if (patternIndex % 4 == 0) "com.google.android.youtube" else "com.instagram.android",
          )
        }
      }

      allGeneratedDays.add(day)
      if (daysAgo < DAILY_RETENTION_DAYS) {
        daily.put(dateKey, day)
      }
    }

    val analytics = JSONObject().apply {
      put("daily", daily)
      put("weeklySummaries", buildSummaryObject(groupDaysFromList(allGeneratedDays) { formatWeekKey(it) }))
      put("monthlySummaries", buildSummaryObject(groupDaysFromList(allGeneratedDays) { it.substring(0, 7) }))
      put("currentStreak", calculateCurrentStreak(allGeneratedDays))
      put("longestStreak", calculateLongestStreak(allGeneratedDays))
      put("lastStreakUpdateDate", formatDate(nowMs))
    }

    preserveBestAndWorstUsageDays(analytics, listToDailyObject(allGeneratedDays))
    saveAnalytics(context, analytics)
  }

  fun updateUsageSnapshot(
    context: Context,
    usageByPackage: Map<String, Long>,
    dailyLimitMinutes: Int,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    if (!hasCompletedOnboarding(context)) return

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
    rebuildDerivedAnalytics(context, analytics, nowMs)
    saveAnalytics(context, analytics)
  }

  fun recordVoiceNoteIntervention(
    context: Context,
    level: Int,
    packageName: String?,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    if (!hasCompletedOnboarding(context)) return

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
    rebuildDerivedAnalytics(context, analytics, nowMs)
    saveAnalytics(context, analytics)
  }

  fun recordLimitHit(
    context: Context,
    packageName: String?,
    nowMs: Long = System.currentTimeMillis(),
  ) {
    if (!hasCompletedOnboarding(context)) return

    val analytics = readAnalytics(context)
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val dateKey = formatDate(nowMs)
    val day = daily.optJSONObject(dateKey) ?: createDay(dateKey)

    day.put("limitHits", day.optInt("limitHits", 0) + 1)
    packageName?.let { day.put("lastLimitHitPackage", it) }
    day.put("lastUpdatedAt", nowMs)

    daily.put(dateKey, day)
    analytics.put("daily", daily)
    rebuildDerivedAnalytics(context, analytics, nowMs)
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

  private fun hasCompletedOnboarding(context: Context): Boolean =
    context
      .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getBoolean("hasCompletedOnboarding", false)

  private fun onboardingCompletedDate(context: Context, todayKey: String): String {
    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val existingDate = preferences.getString("onboardingCompletedDate", null)
    if (!existingDate.isNullOrBlank()) return existingDate

    preferences.edit().putString("onboardingCompletedDate", todayKey).apply()
    return todayKey
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

  private fun rebuildDerivedAnalytics(context: Context, analytics: JSONObject, nowMs: Long) {
    val daily = analytics.optJSONObject("daily") ?: JSONObject()
    val todayKey = formatDate(nowMs)
    val onboardingDate = onboardingCompletedDate(context, todayKey)

    initializeStreakDefaults(analytics, todayKey)
    processMissedStreakDays(analytics, daily, onboardingDate, todayKey)
    updateCurrentDayStreak(analytics, daily, todayKey)

    val rebuiltWeekly = buildSummaryObject(groupDays(daily) { formatWeekKey(it) })
    val rebuiltMonthly = buildSummaryObject(groupDays(daily) { it.substring(0, 7) })
    analytics.put("weeklySummaries", mergeSummaries(analytics.optJSONObject("weeklySummaries"), rebuiltWeekly))
    analytics.put("monthlySummaries", mergeSummaries(analytics.optJSONObject("monthlySummaries"), rebuiltMonthly))

    // Preserve all-time records before pruning retained daily entries.
    preserveBestAndWorstUsageDays(analytics, daily)
    analytics.put(
      "longestStreak",
      maxOf(analytics.optInt("longestStreak", 0), analytics.optInt("currentStreak", 0)),
    )

    pruneOldDailyEntries(daily, nowMs)
    analytics.put("daily", daily)
  }

  private fun initializeStreakDefaults(analytics: JSONObject, todayKey: String) {
    if (!analytics.has("currentStreak")) analytics.put("currentStreak", 0)
    if (!analytics.has("longestStreak")) analytics.put("longestStreak", 0)
    if (analytics.optString("lastStreakUpdateDate", "").isBlank()) {
      analytics.put("lastStreakUpdateDate", todayKey)
    }
  }

  private fun processMissedStreakDays(
    analytics: JSONObject,
    daily: JSONObject,
    onboardingDate: String,
    todayKey: String,
  ) {
    val lastStreakUpdateDate = analytics.optString("lastStreakUpdateDate", todayKey)
    if (lastStreakUpdateDate == todayKey) return

    var cursor = addDays(lastStreakUpdateDate, 1)
    while (cursor != null && cursor < todayKey) {
      if (cursor >= onboardingDate) {
        applyStreakResult(analytics, daily.optJSONObject(cursor)?.optBoolean("stayedUnderDailyLimit", true) ?: true)
      }
      cursor = addDays(cursor, 1)
    }
  }

  private fun updateCurrentDayStreak(analytics: JSONObject, daily: JSONObject, todayKey: String) {
    val today = daily.optJSONObject(todayKey) ?: return
    val stayedUnderLimit = today.optBoolean("stayedUnderDailyLimit", true)
    val lastStreakUpdateDate = analytics.optString("lastStreakUpdateDate", "")

    if (lastStreakUpdateDate != todayKey) {
      applyStreakResult(analytics, stayedUnderLimit)
      analytics.put("lastStreakUpdateDate", todayKey)
      return
    }

    if (!stayedUnderLimit && analytics.optInt("currentStreak", 0) != 0) {
      analytics.put("currentStreak", 0)
      analytics.put("lastStreakUpdateDate", todayKey)
    }
  }

  private fun applyStreakResult(analytics: JSONObject, stayedUnderLimit: Boolean) {
    if (stayedUnderLimit) {
      val nextStreak = analytics.optInt("currentStreak", 0) + 1
      analytics.put("currentStreak", nextStreak)
      analytics.put("longestStreak", maxOf(analytics.optInt("longestStreak", 0), nextStreak))
    } else {
      analytics.put("currentStreak", 0)
    }
  }

  private fun groupDays(
    daily: JSONObject,
    keyForDate: (String) -> String,
  ): Map<String, List<JSONObject>> {
    val groups = mutableMapOf<String, MutableList<JSONObject>>()
    daily.keys().asSequence().toList().sorted().forEach { dateKey ->
      val day = daily.optJSONObject(dateKey) ?: return@forEach
      groups.getOrPut(keyForDate(dateKey)) { mutableListOf() }.add(day)
    }
    return groups
  }

  // NSR - For testing purposes only - Comment out before production build
  private fun groupDaysFromList(
    days: List<JSONObject>,
    keyForDate: (String) -> String,
  ): Map<String, List<JSONObject>> {
    val groups = mutableMapOf<String, MutableList<JSONObject>>()
    days.forEach { day ->
      val dateKey = day.optString("date")
      if (dateKey.isNotBlank()) {
        groups.getOrPut(keyForDate(dateKey)) { mutableListOf() }.add(day)
      }
    }
    return groups
  }

  private fun buildSummaryObject(groups: Map<String, List<JSONObject>>) = JSONObject().apply {
    groups.forEach { (key, days) ->
      put(key, JSONObject().apply {
        put("totalTrackedMs", days.sumOf { it.optLong("totalTrackedMs", 0L) })
        put("limitHits", days.sumOf { it.optInt("limitHits", 0) })
        put("voiceNoteInterventions", days.sumOf { it.optInt("voiceNoteInterventions", 0) })
        put("daysTracked", days.size)
        put("daysUnderLimit", days.count { it.optBoolean("stayedUnderDailyLimit", true) })
        put("perAppInterventionCounts", buildPerAppInterventionCounts(days))
      })
    }
  }

  private fun buildPerAppInterventionCounts(days: List<JSONObject>) = JSONObject().apply {
    days.forEach { day ->
      val packageName = day.optString("lastInterventionPackage", "")
      val interventions = day.optInt("voiceNoteInterventions", 0)
      if (packageName.isNotBlank() && interventions > 0) {
        // Daily records only store the last intervention package, so this is a daily-level approximation.
        put(packageName, optInt(packageName, 0) + interventions)
      }
    }
  }

  private fun mergeSummaries(existing: JSONObject?, rebuilt: JSONObject): JSONObject {
    val merged = JSONObject(existing?.toString() ?: "{}")
    rebuilt.keys().forEach { key ->
      val rebuiltSummary = rebuilt.optJSONObject(key) ?: return@forEach
      val existingSummary = merged.optJSONObject(key)

      if (
        existingSummary == null ||
        rebuiltSummary.optInt("daysTracked", 0) >= existingSummary.optInt("daysTracked", 0)
      ) {
        merged.put(key, rebuiltSummary)
      }
    }
    return merged
  }

  private fun preserveBestAndWorstUsageDays(analytics: JSONObject, daily: JSONObject) {
    var bestDay = analytics.optJSONObject("bestUsageDay")
    var worstDay = analytics.optJSONObject("worstUsageDay")

    daily.keys().asSequence().toList().forEach { dateKey ->
      val day = daily.optJSONObject(dateKey) ?: return@forEach
      val totalTrackedMs = day.optLong("totalTrackedMs", 0L)

      if (
        totalTrackedMs > 0L &&
        (bestDay == null || totalTrackedMs < bestDay!!.optLong("totalTrackedMs", Long.MAX_VALUE))
      ) {
        bestDay = cloneDaySummary(day)
      }

      if (worstDay == null || totalTrackedMs > worstDay!!.optLong("totalTrackedMs", Long.MIN_VALUE)) {
        worstDay = cloneDaySummary(day)
      }
    }

    bestDay?.let { analytics.put("bestUsageDay", it) }
    worstDay?.let { analytics.put("worstUsageDay", it) }
  }

  private fun cloneDaySummary(day: JSONObject) = JSONObject().apply {
    put("date", day.optString("date"))
    put("totalTrackedMs", day.optLong("totalTrackedMs", 0L))
    put("limitHits", day.optInt("limitHits", 0))
    put("voiceNoteInterventions", day.optInt("voiceNoteInterventions", 0))
    put("stayedUnderDailyLimit", day.optBoolean("stayedUnderDailyLimit", true))
    put("dailyLimitMinutes", day.optInt("dailyLimitMinutes", 0))
  }

  // NSR - For testing purposes only - Comment out before production build
  private fun listToDailyObject(days: List<JSONObject>) = JSONObject().apply {
    days.forEach { day ->
      val dateKey = day.optString("date")
      if (dateKey.isNotBlank()) {
        put(dateKey, day)
      }
    }
  }

  // NSR - For testing purposes only - Comment out before production build
  private fun calculateCurrentStreak(days: List<JSONObject>): Int {
    var streak = 0
    days.asReversed().forEach { day ->
      if (day.optBoolean("stayedUnderDailyLimit", true)) {
        streak += 1
      } else {
        return streak
      }
    }
    return streak
  }

  // NSR - For testing purposes only - Comment out before production build
  private fun calculateLongestStreak(days: List<JSONObject>): Int {
    var current = 0
    var longest = 0
    days.forEach { day ->
      if (day.optBoolean("stayedUnderDailyLimit", true)) {
        current += 1
        longest = maxOf(longest, current)
      } else {
        current = 0
      }
    }
    return longest
  }

  // Pruning must never erase all-time records such as bestUsageDay, worstUsageDay, or longestStreak.
  private fun pruneOldDailyEntries(daily: JSONObject, nowMs: Long) {
    val cutoffDate = Calendar.getInstance().apply {
      time = Date(nowMs)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      add(Calendar.DAY_OF_YEAR, -(DAILY_RETENTION_DAYS - 1))
    }.time
    val cutoffKey = formatDate(cutoffDate.time)

    daily.keys().asSequence().toList().forEach { dateKey ->
      if (dateKey < cutoffKey) {
        daily.remove(dateKey)
      }
    }
  }

  private fun formatDate(timestampMs: Long): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(timestampMs))

  private fun parseDate(dateKey: String): Date? =
    try {
      SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(dateKey)
    } catch (_: Exception) {
      null
    }

  private fun addDays(dateKey: String, days: Int): String? {
    val date = parseDate(dateKey) ?: return null
    return formatDate(
      Calendar.getInstance().apply {
        time = date
        add(Calendar.DAY_OF_YEAR, days)
      }.time.time,
    )
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
