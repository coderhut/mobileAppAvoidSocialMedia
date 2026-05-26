package com.avoidsocialmedia.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.widget.Toast
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

    // State Machine
    private var currentForegroundPackage: String? = null
    private var isUserInMonitoredApp = false
    private var sessionStartTimeMs: Long = 0
    private var lastInterventionTimeMs: Long = 0
    private var currentEscalationLevel = 0 // 0 = none, 1 = gentle, 2 = firm, 3 = urgent
    private var hasHitDailyLimitInitially = false
    private var stateDateKey = todayKey()

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
        createNotificationChannel()
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
        val selectedPackageJson = prefs.getString("selectedPackageNames", "[]") ?: "[]"
        val savedGlobalLimitMinutes = prefs.getInt("globalDailyLimit", 0)
        val globalLimitMinutes = savedGlobalLimitMinutes.coerceAtLeast(minimumDailyLimitMinutes)
        val voiceNotesJson = prefs.getString("voiceNotes", "{}") ?: "{}"
        
        if (savedGlobalLimitMinutes <= 0) return

        val selectedPackages = mutableSetOf<String>()
        val jsonArray = JSONArray(selectedPackageJson)
        for (i in 0 until jsonArray.length()) {
            selectedPackages.add(jsonArray.getString(i))
        }

        if (selectedPackages.isEmpty()) return

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
            Log.d("Watchdog", "New monitored session started: $activePackage")
        } else if (!isUserInMonitoredApp && wasInMonitoredApp) {
            // Left the distracting app
            voiceNotePlayer.stop()
            interventionOverlay.hide()
            sessionStartTimeMs = 0
            Log.d("Watchdog", "Monitored session ended")
        }

        // 3. Calculate Daily Progress
        val usageByPackage = calculateUsageByPackage(selectedPackages)
        val totalUsageMs = usageByPackage.values.sum()
        val totalUsageMinutes = (totalUsageMs / 60000).toInt()
        DailyAnalyticsStore.updateUsageSnapshot(this, usageByPackage, globalLimitMinutes)

        // 4. Escalation Logic
        if (totalUsageMinutes >= globalLimitMinutes) {
            handleEscalation(totalUsageMinutes, globalLimitMinutes, voiceNotesJson)
            updateNotification("Limit reached: $totalUsageMinutes/$globalLimitMinutes min")
        } else {
            hasHitDailyLimitInitially = false
            updateNotification("Usage: $totalUsageMinutes/$globalLimitMinutes min")
        }

        // Test Toast - Only in Debug builds
        if (BuildConfig.DEBUG) {
            val nextVNMin = getNextVNInMinutes(totalUsageMinutes, globalLimitMinutes)
            if (nextVNMin > 0 && isUserInMonitoredApp) {
                Toast.makeText(this, "Next VN in $nextVNMin minutes", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun getNextVNInMinutes(currentMin: Int, limitMin: Int): Int {
        return if (!hasHitDailyLimitInitially) {
            when (currentEscalationLevel) {
                0 -> limitMin - currentMin
                1 -> (limitMin + 5) - currentMin
                2 -> (limitMin + 8) - currentMin
                else -> 0
            }
        } else {
            val sessionElapsedMin = ((System.currentTimeMillis() - sessionStartTimeMs) / 60000).toInt()
            val thresholds = getReEntryThresholds(limitMin)
            when (currentEscalationLevel) {
                0 -> thresholds.levelOneMinutes - sessionElapsedMin
                1 -> thresholds.levelTwoMinutes - sessionElapsedMin
                2 -> thresholds.levelThreeMinutes - sessionElapsedMin
                else -> repeatLevelThreeMinutesRemaining()
            }
        }.coerceAtLeast(0)
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
            currentEscalationLevel = targetLevel
            if (!hasHitDailyLimitInitially) {
                hasHitDailyLimitInitially = true
                DailyAnalyticsStore.recordLimitHit(this, currentForegroundPackage)
            }
            
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
        try {
            val json = JSONObject(voiceNotesJson)
            val levelData = json.opt(level.toString()) ?: return false
            
            val availablePaths = mutableListOf<String>()
            
            if (levelData is JSONArray) {
                for (i in 0 until levelData.length()) {
                    availablePaths.add(levelData.getString(i))
                }
            } else if (levelData is JSONObject) {
                val keys = levelData.keys()
                while (keys.hasNext()) {
                    availablePaths.add(levelData.getString(keys.next()))
                }
            }

            if (availablePaths.isEmpty()) return false

            // Pick a random note from the level
            val randomIndex = Random.nextInt(availablePaths.size)
            val filePath = availablePaths[randomIndex]

            Log.d("Watchdog", "Playing Level $level note: $filePath")
            
            voiceNotePlayer.stop()
            interventionOverlay.replace(level, currentForegroundPackage) {
                voiceNotePlayer.stop()
            }
            voiceNotePlayer.play(filePath) {
                // Note finished
            }
            DailyAnalyticsStore.recordVoiceNoteIntervention(this, level, currentForegroundPackage)
            return true
        } catch (e: Exception) {
            Log.e("Watchdog", "Failed to trigger voice note", e)
            return false
        }
    }

    private fun getActiveForegroundPackage(): String? {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val time = System.currentTimeMillis()
        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, time - 1000 * 60, time)
        
        return stats?.maxByOrNull { it.lastTimeUsed }?.packageName
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

        return stats
            .filter { it.totalTimeInForeground > 0 && packageNames.contains(it.packageName) }
            .groupBy { it.packageName }
            .mapValues { (_, packageStats) -> packageStats.sumOf { it.totalTimeInForeground } }
    }

    private fun resetDailyStateIfNeeded() {
        val nextDateKey = todayKey()
        if (nextDateKey == stateDateKey) return

        stateDateKey = nextDateKey
        hasHitDailyLimitInitially = false
        currentEscalationLevel = 0
        sessionStartTimeMs = if (isUserInMonitoredApp) System.currentTimeMillis() else 0
        lastInterventionTimeMs = 0
        Log.d("Watchdog", "Daily watchdog state reset for $stateDateKey")
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
