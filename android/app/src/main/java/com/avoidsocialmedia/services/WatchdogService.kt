package com.avoidsocialmedia.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.avoidsocialmedia.BuildConfig
import com.avoidsocialmedia.R
import com.avoidsocialmedia.analytics.DailyAnalyticsStore
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt
import kotlin.random.Random

class WatchdogService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false
    private val pollingIntervalMs = 15000L // 15 seconds for more responsive session detection
    private val minimumDailyLimitMinutes = 15
    private val urgentRepeatIntervalMs = 5 * 60 * 1000L
    private lateinit var voiceNotePlayer: VoiceNotePlayer
    private lateinit var interventionOverlay: InterventionOverlay
    private var debugOverlay: DebugOverlay? = null  // non-null only in DEBUG builds

    // State Machine
    private var currentForegroundPackage: String? = null
    private var isUserInMonitoredApp = false
    private var sessionStartTimeMs: Long = 0
    private var lastInterventionTimeMs: Long = 0
    private var currentEscalationLevel = 0 // 0 = none, 1 = gentle, 2 = firm, 3 = urgent
    private var hasHitDailyLimitInitially = false
    private var stateDateKey = todayKey()
    private var watchdogUsageResetVersion = 0

    companion object {
        const val CHANNEL_ID = "WatchdogServiceChannel"
        const val NOTIFICATION_ID = 1001
        
        fun start(context: Context) {
            val intent = Intent(context, WatchdogService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, WatchdogService::class.java)
            context.stopService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        voiceNotePlayer = VoiceNotePlayer(this)
        interventionOverlay = InterventionOverlay(this)
        if (BuildConfig.DEBUG) {
            debugOverlay = DebugOverlay(this)
        }
        createNotificationChannel()
        restorePersistedState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification("Monitoring usage...")
        startForeground(NOTIFICATION_ID, notification)
        
        if (!isRunning) {
            isRunning = true
            startPolling()
        }
        
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        debugOverlay?.hide()
        isRunning = false
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun startPolling() {
        handler.post(object : Runnable {
            override fun run() {
                if (!isRunning) return
                
                checkUsage()
                handler.postDelayed(this, pollingIntervalMs)
            }
        })
    }

    private fun checkUsage() {
        resetDailyStateIfNeeded()

        val prefs = getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
        handleUsageResetIfNeeded(prefs.getInt("watchdogUsageResetVersion", 0))

        val selectedPackageJson = prefs.getString("selectedPackageNames", "[]") ?: "[]"
        val savedGlobalLimitMinutes = prefs.getInt("globalDailyLimit", 30) // Default 30 — JS state defaults to 30 but may not persist to SharedPreferences until user interacts
        val globalLimitMinutes = savedGlobalLimitMinutes.coerceAtLeast(minimumDailyLimitMinutes)
        val voiceNotesJson = prefs.getString("voiceNotes", "{}") ?: "{}"
        // Note: no early return for limit == 0 — coerceAtLeast guarantees at least 15 min

        val selectedPackages = mutableSetOf<String>()
        val jsonArray = JSONArray(selectedPackageJson)
        for (i in 0 until jsonArray.length()) {
            selectedPackages.add(jsonArray.getString(i))
        }

        if (selectedPackages.isEmpty()) {
            Log.d("Watchdog", "No packages selected for tracking — skipping poll")
            return
        }

        // 1. Detect if user is in a monitored app
        val activePackage = getActiveForegroundPackage()
        currentForegroundPackage = activePackage
        val wasInMonitoredApp = isUserInMonitoredApp
        isUserInMonitoredApp = selectedPackages.contains(activePackage)

        // 2. Handle Session Start/End
        if (isUserInMonitoredApp && !wasInMonitoredApp) {
            // Started a new session
            sessionStartTimeMs = System.currentTimeMillis()
            currentEscalationLevel = 0
            Log.d("Watchdog", "Session START: $activePackage | limit=${globalLimitMinutes}m | hasHitLimit=$hasHitDailyLimitInitially")
        } else if (!isUserInMonitoredApp && wasInMonitoredApp) {
            // Left the distracting app
            voiceNotePlayer.stop()
            interventionOverlay.hide()
            debugOverlay?.hide()
            if (currentEscalationLevel > 0 && !hasHitDailyLimitInitially) {
                hasHitDailyLimitInitially = true
            }
            currentEscalationLevel = 0
            sessionStartTimeMs = 0
            persistEscalationState()
            Log.d("Watchdog", "Monitored session ended")
        }

        // 3. Calculate Daily Progress
        val usageByPackage = calculateUsageByPackage(selectedPackages)
        val totalUsageMs = usageByPackage.values.sum()
        val totalUsageMinutes = (totalUsageMs / 60000).toInt()
        DailyAnalyticsStore.updateUsageSnapshot(this, usageByPackage, globalLimitMinutes)

        // 4. Escalation Logic
        val overLimit = totalUsageMinutes >= globalLimitMinutes
        Log.d("Watchdog", "Poll: pkg=$activePackage inApp=$isUserInMonitoredApp usage=${totalUsageMinutes}m limit=${globalLimitMinutes}m overLimit=$overLimit lvl=$currentEscalationLevel")
        if (overLimit) {
            handleEscalation(totalUsageMinutes, globalLimitMinutes, voiceNotesJson)
            updateNotification("Limit reached: ${totalUsageMinutes}/${globalLimitMinutes} min")
        } else {
            hasHitDailyLimitInitially = false
            updateNotification("Usage: ${totalUsageMinutes}/${globalLimitMinutes} min")
        }

        // Debug HUD overlay — persists on-screen while user is in a tracked app (DEBUG only)
        if (isUserInMonitoredApp) {
            debugOverlay?.showOrUpdate(buildDebugHudText(totalUsageMs, globalLimitMinutes))
        }

        saveWatchdogDebugInfo(totalUsageMs, globalLimitMinutes)
    }

    private fun handleEscalation(currentMin: Int, limitMin: Int, voiceNotesJson: String) {
        val currentTime = System.currentTimeMillis()
        if (isUserInMonitoredApp && sessionStartTimeMs == 0L) {
            sessionStartTimeMs = currentTime
        }
        val sessionElapsedMin = (currentTime - sessionStartTimeMs) / 60000

        // Determine Level
        val targetLevel = when {
            !hasHitDailyLimitInitially -> {
                // Scenario 1: First breakthrough
                when {
                    currentMin >= limitMin + 8 -> 3 // 38 mins total
                    currentMin >= limitMin + 5 -> 2 // 35 mins total
                    else -> 1 // 30 mins total
                }
            }
            else -> {
                // Scenario 2: Subsequent re-entry
                val thresholds = getReEntryThresholds(limitMin)
                when {
                    sessionElapsedMin >= thresholds.levelThreeMinutes -> 3
                    sessionElapsedMin >= thresholds.levelTwoMinutes -> 2
                    sessionElapsedMin >= thresholds.levelOneMinutes -> 1
                    else -> 0
                }
            }
        }

        if (targetLevel > currentEscalationLevel && isUserInMonitoredApp) {
            if (!hasHitDailyLimitInitially && currentEscalationLevel == 0) {
                DailyAnalyticsStore.recordLimitHit(this, currentForegroundPackage)
            }
            currentEscalationLevel = targetLevel
            persistEscalationState()
            if (triggerVoiceNote(targetLevel, voiceNotesJson)) {
                lastInterventionTimeMs = currentTime
            }
        } else if (
            currentEscalationLevel >= 3 &&
            isUserInMonitoredApp &&
            currentTime - lastInterventionTimeMs >= urgentRepeatIntervalMs
        ) {
            if (triggerVoiceNote(3, voiceNotesJson)) {
                lastInterventionTimeMs = currentTime
            }
        }
    }

    private fun triggerVoiceNote(level: Int, voiceNotesJson: String): Boolean {
        return try {
            // Always show overlay — intervention must appear even if no voice note is recorded
            voiceNotePlayer.stop()
            interventionOverlay.replace(level, currentForegroundPackage) {
                voiceNotePlayer.stop()
            }
            // Play audio best-effort — a missing recording should never block the overlay
            tryPlayVoiceNote(level, voiceNotesJson)
            DailyAnalyticsStore.recordVoiceNoteIntervention(this, level, currentForegroundPackage)
            Log.d("Watchdog", "Intervention triggered at Level $level for $currentForegroundPackage")
            true
        } catch (e: Exception) {
            Log.e("Watchdog", "Failed to trigger intervention", e)
            false
        }
    }

    private fun getActiveForegroundPackage(): String? {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val endTime = System.currentTimeMillis()
        val startTime = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        return try {
            // queryEvents is reliable: lastTimeUsed is updated when an app goes to BACKGROUND,
            // not when it enters foreground — so maxByOrNull{lastTimeUsed} returns the wrong app.
            // Replaying MOVE_TO_FOREGROUND / MOVE_TO_BACKGROUND events gives the correct answer.
            val events = usageStatsManager.queryEvents(startTime, endTime)
            var lastForeground: String? = null
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND -> lastForeground = event.packageName
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        if (lastForeground == event.packageName) lastForeground = null
                    }
                }
            }
            lastForeground
        } catch (e: Exception) {
            Log.e("Watchdog", "queryEvents failed — falling back to queryUsageStats", e)
            val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, endTime - 60_000, endTime)
            stats?.maxByOrNull { it.lastTimeUsed }?.packageName
        }
    }

    private fun calculateUsageByPackage(packageNames: Set<String>): Map<String, Long> {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
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
            endTime
        )

        val baselines = readUsageResetBaselines()

        return stats
            .filter { it.totalTimeInForeground > 0 && packageNames.contains(it.packageName) }
            .groupBy { it.packageName }
            .mapValues { (packageName, packageStats) ->
                val rawUsageMs = packageStats.sumOf { it.totalTimeInForeground }
                (rawUsageMs - (baselines[packageName] ?: 0L)).coerceAtLeast(0L)
            }
    }

    private fun resetDailyStateIfNeeded() {
        val nextDateKey = todayKey()
        if (nextDateKey == stateDateKey) return

        stateDateKey = nextDateKey
        hasHitDailyLimitInitially = false
        currentEscalationLevel = 0
        sessionStartTimeMs = if (isUserInMonitoredApp) System.currentTimeMillis() else 0
        lastInterventionTimeMs = 0
        getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
            .edit()
            .remove("watchdogUsageResetBaselines")
            .apply()
        persistEscalationState()
        Log.d("Watchdog", "Daily watchdog state reset for $stateDateKey")
    }

    // NSR - For testing purposes only - Comment out before production build
    private fun handleUsageResetIfNeeded(nextResetVersion: Int) {
        if (nextResetVersion == watchdogUsageResetVersion) return

        watchdogUsageResetVersion = nextResetVersion
        hasHitDailyLimitInitially = false
        currentEscalationLevel = 0
        lastInterventionTimeMs = 0
        sessionStartTimeMs = if (isUserInMonitoredApp) System.currentTimeMillis() else 0
        voiceNotePlayer.stop()
        interventionOverlay.hide()
        persistEscalationState()
        Log.d("Watchdog", "Compound usage reset applied: version=$watchdogUsageResetVersion")
    }

    private fun todayKey(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun getReEntryThresholds(limitMin: Int): ReEntryThresholds {
        val levelOne = (limitMin * 0.33).roundToInt().coerceIn(1, 20)
        val proportionalLevelTwo = (limitMin * 0.50).toInt().coerceAtMost(30)
        val levelTwo = maxOf(levelOne + 5, proportionalLevelTwo).coerceAtMost(30)
        val proportionalLevelThree = (limitMin * 0.60).toInt().coerceAtMost(36)
        val levelThree = maxOf(levelTwo + 3, proportionalLevelThree).coerceAtMost(36)

        return ReEntryThresholds(levelOne, levelTwo, levelThree)
    }

    // ── Persistence (survives OS-level service restarts within the same day) ──────────────────

    private fun restorePersistedState() {
        val prefs = getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
        val savedDate = prefs.getString("watchdogStateDate", null)
        if (savedDate == todayKey()) {
            hasHitDailyLimitInitially = prefs.getBoolean("watchdogHasHitLimit", false)
            currentEscalationLevel = prefs.getInt("watchdogEscalationLevel", 0)
            watchdogUsageResetVersion = prefs.getInt("watchdogUsageResetVersion", 0)
            Log.d("Watchdog", "Restored: hasHitLimit=$hasHitDailyLimitInitially level=$currentEscalationLevel")
        } else {
            Log.d("Watchdog", "No persisted state for today — starting fresh")
        }
    }

    private fun persistEscalationState() {
        getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
            .edit()
            .putString("watchdogStateDate", todayKey())
            .putBoolean("watchdogHasHitLimit", hasHitDailyLimitInitially)
            .putInt("watchdogEscalationLevel", currentEscalationLevel)
            .apply()
    }

    // ── Voice note player (separated from overlay so missing recordings never block alerts) ────

    // NSR - For testing purposes only - Comment out before production build
    private fun readUsageResetBaselines(): Map<String, Long> {
        val value = getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
            .getString("watchdogUsageResetBaselines", "{}") ?: "{}"

        return try {
            val json = JSONObject(value)
            val baselines = mutableMapOf<String, Long>()
            val keys = json.keys()
            while (keys.hasNext()) {
                val packageName = keys.next()
                baselines[packageName] = json.optLong(packageName, 0L)
            }
            baselines
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun tryPlayVoiceNote(level: Int, voiceNotesJson: String) {
        try {
            val json = JSONObject(voiceNotesJson)
            val levelData = json.opt(level.toString()) ?: return

            val availablePaths = mutableListOf<String>()
            if (levelData is JSONArray) {
                for (i in 0 until levelData.length()) availablePaths.add(levelData.getString(i))
            } else if (levelData is JSONObject) {
                val keys = levelData.keys()
                while (keys.hasNext()) availablePaths.add(levelData.getString(keys.next()))
            }

            if (availablePaths.isEmpty()) {
                Log.d("Watchdog", "No voice note for Level $level — overlay shown without audio")
                return
            }

            val filePath = availablePaths[Random.nextInt(availablePaths.size)]
            Log.d("Watchdog", "Playing Level $level note: $filePath")
            voiceNotePlayer.play(filePath) { /* note finished */ }
        } catch (e: Exception) {
            Log.e("Watchdog", "Failed to play voice note", e)
        }
    }

    // ── Debug info (written to SharedPreferences, read by WatchdogDebugScreen) ────────────────

    private fun saveWatchdogDebugInfo(totalUsageMs: Long, limitMin: Int) {
        val currentTime = System.currentTimeMillis()
        val sessionElapsedMs =
            if (isUserInMonitoredApp && sessionStartTimeMs > 0L) currentTime - sessionStartTimeMs else 0L
        val totalUsageMin = (totalUsageMs / 60000).toInt()

        val scenario = when {
            !isUserInMonitoredApp && totalUsageMin < limitMin -> "Under limit"
            !isUserInMonitoredApp -> "Over limit \u2014 not in app"
            !hasHitDailyLimitInitially -> "Scenario 1: First breach"
            else -> "Scenario 2: Re-entry"
        }

        val rows = JSONArray().apply {
            if (!isUserInMonitoredApp) {
                listOf("Level 1", "Level 2", "Level 3", "Repeat L3").forEach { level ->
                    put(createDebugRow(level, "N/A", "Not in tracked app", "N/A"))
                }
            } else if (!hasHitDailyLimitInitially) {
                put(createDebugRow("Level 1", "$limitMin min total", remainingOrFired(limitMin * 60000L - totalUsageMs, currentEscalationLevel >= 1), statusForLevel(1)))
                put(createDebugRow("Level 2", "${limitMin + 5} min total", remainingOrFired((limitMin + 5) * 60000L - totalUsageMs, currentEscalationLevel >= 2), statusForLevel(2)))
                put(createDebugRow("Level 3", "${limitMin + 8} min total", remainingOrFired((limitMin + 8) * 60000L - totalUsageMs, currentEscalationLevel >= 3), statusForLevel(3)))
                put(createDebugRow("Repeat L3", "Every 5 min after L3", if (currentEscalationLevel >= 3) formatRemainingMs(urgentRepeatIntervalMs - (currentTime - lastInterventionTimeMs)) else "After L3 fires", if (currentEscalationLevel >= 3) "Active" else "Pending"))
            } else {
                val thresholds = getReEntryThresholds(limitMin)
                put(createDebugRow("Level 1", "+${thresholds.levelOneMinutes} min session", remainingOrFired(thresholds.levelOneMinutes * 60000L - sessionElapsedMs, currentEscalationLevel >= 1), statusForLevel(1)))
                put(createDebugRow("Level 2", "+${thresholds.levelTwoMinutes} min session", remainingOrFired(thresholds.levelTwoMinutes * 60000L - sessionElapsedMs, currentEscalationLevel >= 2), statusForLevel(2)))
                put(createDebugRow("Level 3", "+${thresholds.levelThreeMinutes} min session", remainingOrFired(thresholds.levelThreeMinutes * 60000L - sessionElapsedMs, currentEscalationLevel >= 3), statusForLevel(3)))
                put(createDebugRow("Repeat L3", "Every 5 min after L3", if (currentEscalationLevel >= 3) formatRemainingMs(urgentRepeatIntervalMs - (currentTime - lastInterventionTimeMs)) else "After L3 fires", if (currentEscalationLevel >= 3) "Active" else "Pending"))
            }
        }

        val debugInfo = JSONObject().apply {
            put("scenario", scenario)
            put("isInMonitoredApp", isUserInMonitoredApp)
            put("activePackage", currentForegroundPackage ?: JSONObject.NULL)
            put("totalUsageMs", totalUsageMs)
            put("sessionElapsedMs", sessionElapsedMs)
            put("currentEscalationLevel", currentEscalationLevel)
            put("rows", rows)
            put("updatedAt", currentTime)
        }

        getSharedPreferences("avoid_social_media_preferences", Context.MODE_PRIVATE)
            .edit()
            .putString("watchdogDebugInfo", debugInfo.toString())
            .apply()
    }

    private fun createDebugRow(level: String, firesAt: String, timeRemaining: String, status: String) =
        JSONObject().apply {
            put("level", level)
            put("firesAt", firesAt)
            put("timeRemaining", timeRemaining)
            put("status", status)
        }

    private fun remainingOrFired(remainingMs: Long, alreadyFired: Boolean): String =
        if (alreadyFired || remainingMs <= 0L) "Fired" else formatRemainingMs(remainingMs)

    private fun statusForLevel(level: Int): String = when {
        currentEscalationLevel > level -> "Already fired"
        currentEscalationLevel == level -> "Active"
        else -> "Pending"
    }

    private fun formatRemainingMs(milliseconds: Long): String {
        val s = (milliseconds.coerceAtLeast(0L) + 999L) / 1000L
        return "${s / 60} min ${(s % 60).toString().padStart(2, '0')} sec"
    }

    // ── Debug HUD helpers ──────────────────────────────────────────────────────────────────

    /**
     * Builds the multi-line string shown in the top-left debug HUD while in a tracked app.
     * Format:
     *   WDG | 43/30m | L3-urgent
     *   Re-entry | Next: 2:35
     */
    private fun buildDebugHudText(totalUsageMs: Long, limitMin: Int): String {
        val totalUsageMin = (totalUsageMs / 60000).toInt()
        val levelLabel = when (currentEscalationLevel) {
            1 -> "L1-gentle"
            2 -> "L2-firm"
            3 -> "L3-urgent"
            else -> "L0-none"
        }
        val scenarioLabel = if (!hasHitDailyLimitInitially) "First Breach" else "Re-entry"
        val nextMs = computeNextInterventionMs(totalUsageMs, limitMin)
        val nextFormatted = if (nextMs <= 0L) {
            "NOW"
        } else {
            val totalSec = (nextMs / 1000L).coerceAtLeast(0L)
            "${totalSec / 60}:${(totalSec % 60).toString().padStart(2, '0')}"
        }
        return "WDG | ${totalUsageMin}/${limitMin}m | $levelLabel\n$scenarioLabel | Next: $nextFormatted"
    }

    /**
     * Returns milliseconds until the next intervention fires.
     * For Scenario 1 (first breach): based on cumulative daily usage.
     * For Scenario 2 (re-entry): based on current session elapsed time.
     * For Repeat L3: based on time since last intervention.
     */
    private fun computeNextInterventionMs(totalUsageMs: Long, limitMin: Int): Long {
        val currentTime = System.currentTimeMillis()
        val sessionElapsedMs =
            if (sessionStartTimeMs > 0L) (currentTime - sessionStartTimeMs) else 0L

        return if (!hasHitDailyLimitInitially) {
            // Scenario 1: level gates are total usage milestones
            when (currentEscalationLevel) {
                0 -> limitMin * 60000L - totalUsageMs
                1 -> (limitMin + 5) * 60000L - totalUsageMs
                2 -> (limitMin + 8) * 60000L - totalUsageMs
                else -> { // L3 fired, waiting for Repeat L3
                    if (lastInterventionTimeMs > 0L)
                        urgentRepeatIntervalMs - (currentTime - lastInterventionTimeMs)
                    else urgentRepeatIntervalMs
                }
            }
        } else {
            // Scenario 2: level gates are session-elapsed-time milestones
            val thresholds = getReEntryThresholds(limitMin)
            when (currentEscalationLevel) {
                0 -> thresholds.levelOneMinutes * 60000L - sessionElapsedMs
                1 -> thresholds.levelTwoMinutes * 60000L - sessionElapsedMs
                2 -> thresholds.levelThreeMinutes * 60000L - sessionElapsedMs
                else -> { // L3 fired, waiting for Repeat L3
                    if (lastInterventionTimeMs > 0L)
                        urgentRepeatIntervalMs - (currentTime - lastInterventionTimeMs)
                    else urgentRepeatIntervalMs
                }
            }
        }.coerceAtLeast(0L)
    }

    private fun repeatLevelThreeMinutesRemaining(): Int {
        if (lastInterventionTimeMs == 0L) return 0

        val remainingMs = urgentRepeatIntervalMs - (System.currentTimeMillis() - lastInterventionTimeMs)
        return ((remainingMs + 59999) / 60000).toInt()
    }

    private fun createNotification(content: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Avoid Social Media")
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(content: String) {
        val notification = createNotification(content)
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Usage Watchdog Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private data class ReEntryThresholds(
        val levelOneMinutes: Int,
        val levelTwoMinutes: Int,
        val levelThreeMinutes: Int,
    )
}
