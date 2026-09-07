package com.example.shiksharthi_student

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Enable OS hardware screenshot & screen-recording lock natively
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
