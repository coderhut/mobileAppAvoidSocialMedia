package com.avoidsocialmedia.services

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.CountDownTimer
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.avoidsocialmedia.R

class InterventionOverlay(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: View? = null
    private var countDownTimer: CountDownTimer? = null

    fun show(level: Int, appName: String, onDismiss: () -> Unit) {
        if (overlayView != null) return

        val layoutParams = WindowManager.LayoutParams().apply {
            width = WindowManager.LayoutParams.MATCH_PARENT
            height = WindowManager.LayoutParams.MATCH_PARENT
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_FULLSCREEN
            format = PixelFormat.TRANSLUCENT
            gravity = Gravity.CENTER
        }

        val inflater = LayoutInflater.from(context)
        overlayView = inflater.inflate(R.layout.intervention_overlay, null)

        overlayView?.let { view ->
            val title = view.findViewById<TextView>(R.id.overlay_title)
            val message = view.findViewById<TextView>(R.id.overlay_message)
            val btnClose = view.findViewById<Button>(R.id.btn_close_app)
            val btnIgnore = view.findViewById<TextView>(R.id.btn_ignore)

            title.text = when(level) {
                1 -> "GENTLE REMINDER"
                2 -> "FIRM WARNING"
                else -> "URGENT INTERVENTION"
            }

            message.text = "Stop using $appName. You recorded this note to help you stay focused. Listen carefully."

            btnClose.setOnClickListener {
                stopTimer()
                onDismiss()
                val startMain = Intent(Intent.ACTION_MAIN)
                startMain.addCategory(Intent.CATEGORY_HOME)
                startMain.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(startMain)
                hide()
            }

            btnIgnore.isEnabled = false
            btnIgnore.alpha = 0.5f
            
            countDownTimer = object : CountDownTimer(5000, 1000) {
                override fun onTick(millisUntilFinished: Long) {
                    val seconds = (millisUntilFinished / 1000) + 1
                    btnIgnore.text = "Wait $seconds seconds..."
                }

                override fun onFinish() {
                    btnIgnore.isEnabled = true
                    btnIgnore.alpha = 1.0f
                    btnIgnore.text = "Dismiss Overlay"
                }
            }.start()

            btnIgnore.setOnClickListener {
                stopTimer()
                onDismiss()
                hide()
            }

            windowManager.addView(view, layoutParams)
        }
    }

    private fun stopTimer() {
        countDownTimer?.cancel()
        countDownTimer = null
    }

    fun hide() {
        stopTimer()
        overlayView?.let {
            windowManager.removeView(it)
            overlayView = null
        }
    }
}
