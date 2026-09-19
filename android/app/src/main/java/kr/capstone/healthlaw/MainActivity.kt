package kr.capstone.healthlaw

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
  @SuppressLint("SetJavaScriptEnabled") override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val web = WebView(this)
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.webViewClient = WebViewClient()
    web.addJavascriptInterface(WidgetBridge(this), "AndroidWidget")
    web.loadUrl("https://health-law-reviewer.vercel.app")
    setContentView(web)
  }
}

class WidgetBridge(private val activity: MainActivity) {
  @JavascriptInterface fun updateWidget(payload: String) {
    try { WidgetState.save(activity, JSONObject(payload)); ReviewWidgetProvider.refresh(activity) } catch (_: Exception) { }
  }
}
