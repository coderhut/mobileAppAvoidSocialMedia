package com.avoidsocialmedia.services

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.avoidsocialmedia.R

/**
 * A tiny persistent HUD overlay shown only while the user is inside a tracked app.
 * Visible in DEBUG builds only. Touch-transparent — does not intercept any input.
 * Positioned at the top-left corner, below the status bar.
 *
 * Shows: current usage / limit, escalation level, and countdown to next intervention.
 */
class DebugOverlay(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private var overlayView: View? = null
    private var textView: TextView? = null

    /** Show the overlay if not already visible, or update its text if already showing. */
    fun showOrUpdate(text: String) {
        mainHandler.post {
            if (overlayView != null) {
                textView?.text = text
            } else {
                showOnMainThread(text)
            }
        }
    }

    /** Hide and remove the overlay. */
    fun hide() {
        mainHandler.post { removeCurrentView() }
    }

    private fun showOnMainThread(text: String) {
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
            // FLAG_NOT_FOCUSABLE + FLAG_NOT_TOUCHABLE = completely transparent to input
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).also {
            it.gravity = Gravity.TOP or Gravity.START
            it.x = 12   // px from left edge
            it.y = 90   // px from top — clears status bar and gives breathing room
        }

        overlayView = LayoutInflater.from(context).inflate(R.layout.debug_overlay, null)
        textView = overlayView?.findViewById(R.id.debug_text)
        textView?.text = text

        try {
            windowManager.addView(overlayView, params)
        } catch (e: Exception) {
            Log.e("DebugOverlay", "Failed to show debug overlay", e)
            overlayView = null
            textView = null
        }
    }

    private fun removeCurrentView() {
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {
                Log.w("DebugOverlay", "Already detached", e)
            } finally {
                overlayView = null
                textView = null
            }
        }
    }
}
