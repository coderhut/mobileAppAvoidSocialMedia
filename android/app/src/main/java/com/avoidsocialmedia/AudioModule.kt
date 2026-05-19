package com.avoidsocialmedia

import android.media.MediaRecorder
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class AudioModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var mediaRecorder: MediaRecorder? = null
  private var mediaPlayer: MediaPlayer? = null

  override fun getName(): String = "AudioModule"

  @ReactMethod
  fun startRecording(path: String, promise: Promise) {
    try {
      mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        MediaRecorder(reactContext)
      } else {
        @Suppress("DEPRECATION")
        MediaRecorder()
      }

      mediaRecorder?.apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioEncodingBitRate(128000)
        setAudioSamplingRate(44100)
        setOutputFile(path)
        prepare()
        start()
      }
      promise.resolve(path)
    } catch (e: Exception) {
      Log.e("AudioModule", "Failed to start recording", e)
      promise.reject("RECORDING_START_FAILED", e)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    try {
      mediaRecorder?.apply {
        try {
          stop()
        } catch (e: Exception) {
          // If stop is called too early, it can throw an IllegalStateException
          Log.w("AudioModule", "Stop recording called too early", e)
        }
        release()
      }
      mediaRecorder = null
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e("AudioModule", "Failed to stop recording", e)
      promise.reject("RECORDING_STOP_FAILED", e)
    }
  }

  @ReactMethod
  fun startPlayer(path: String, promise: Promise) {
    try {
      stopPlayerInternal()
      mediaPlayer = MediaPlayer().apply {
        setDataSource(reactContext, Uri.fromFile(File(path)))
        prepare()
        start()
        setOnCompletionListener {
          stopPlayerInternal()
        }
      }
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e("AudioModule", "Failed to start player", e)
      promise.reject("PLAYER_START_FAILED", e)
    }
  }

  @ReactMethod
  fun stopPlayer(promise: Promise) {
    stopPlayerInternal()
    promise.resolve(null)
  }

  private fun stopPlayerInternal() {
    try {
      mediaPlayer?.let {
        if (it.isPlaying) {
          it.stop()
        }
        it.release()
      }
      mediaPlayer = null
    } catch (e: Exception) {
      Log.e("AudioModule", "Error stopping player", e)
    }
  }
}
