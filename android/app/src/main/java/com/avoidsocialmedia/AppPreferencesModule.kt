package com.avoidsocialmedia

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import org.json.JSONArray

class AppPreferencesModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppPreferencesModule"

  @ReactMethod
  fun getPreferences(promise: Promise) {
    try {
      val preferences = getSharedPreferences()
      val response = Arguments.createMap().apply {
        putString("themePreference", preferences.getString("themePreference", "system"))
        putString("language", preferences.getString("language", "en"))
        putString("dailyLimitSettings", preferences.getString("dailyLimitSettings", "{}"))
        putString("voiceNotes", preferences.getString("voiceNotes", "{}"))
        putString("voiceNoteDurations", preferences.getString("voiceNoteDurations", "{}"))
        putInt("globalDailyLimit", preferences.getInt("globalDailyLimit", 0))
        putBoolean("hasCompletedOnboarding", preferences.getBoolean("hasCompletedOnboarding", false))
        putArray(
          "selectedPackageNames",
          packageNamesToArray(preferences.getString("selectedPackageNames", "[]")),
        )
      }

      promise.resolve(response)
    } catch (error: Exception) {
      promise.reject("PREFERENCES_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun setThemePreference(themePreference: String, promise: Promise) {
    saveString("themePreference", themePreference, promise)
  }

  @ReactMethod
  fun setLanguage(language: String, promise: Promise) {
    saveString("language", language, promise)
  }

  @ReactMethod
  fun setSelectedPackageNames(packageNames: ReadableArray, promise: Promise) {
    try {
      val jsonArray = JSONArray()

      for (index in 0 until packageNames.size()) {
        packageNames.getString(index)?.let { jsonArray.put(it) }
      }

      getSharedPreferences()
        .edit()
        .putString("selectedPackageNames", jsonArray.toString())
        .apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PREFERENCES_WRITE_FAILED", error)
    }
  }

  @ReactMethod
  fun setDailyLimitSettings(settingsJson: String, promise: Promise) {
    saveString("dailyLimitSettings", settingsJson, promise)
  }

  @ReactMethod
  fun setVoiceNotes(voiceNotesJson: String, promise: Promise) {
    saveString("voiceNotes", voiceNotesJson, promise)
  }

  @ReactMethod
  fun setVoiceNoteDurations(durationsJson: String, promise: Promise) {
    saveString("voiceNoteDurations", durationsJson, promise)
  }

  @ReactMethod
  fun setGlobalDailyLimit(limitMinutes: Int, promise: Promise) {
    try {
      getSharedPreferences().edit().putInt("globalDailyLimit", limitMinutes).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PREFERENCES_WRITE_FAILED", error)
    }
  }

  @ReactMethod
  fun setHasCompletedOnboarding(completed: Boolean, promise: Promise) {
    try {
      getSharedPreferences().edit().putBoolean("hasCompletedOnboarding", completed).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PREFERENCES_WRITE_FAILED", error)
    }
  }

  private fun saveString(key: String, value: String, promise: Promise) {
    try {
      getSharedPreferences().edit().putString(key, value).apply()
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("PREFERENCES_WRITE_FAILED", error)
    }
  }

  private fun getSharedPreferences() =
    reactContext.getSharedPreferences("avoid_social_media_preferences", 0)

  private fun packageNamesToArray(value: String?) = Arguments.createArray().apply {
    val jsonArray = JSONArray(value ?: "[]")

    for (index in 0 until jsonArray.length()) {
      pushString(jsonArray.getString(index))
    }
  }
}
