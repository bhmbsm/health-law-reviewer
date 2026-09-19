package kr.capstone.healthlaw

import android.content.Context
import org.json.JSONObject

object WidgetState {
  fun save(context: Context, data: JSONObject) {
    context.getSharedPreferences("widget", Context.MODE_PRIVATE).edit()
      .putString("nickname", data.optString("nickname", "심사관"))
      .putInt("streak", data.optInt("streak", 0))
      .putInt("todaySolved", data.optInt("todaySolved", 0))
      .putString("lastStudyDate", data.optString("lastStudyDate", ""))
      .apply()
  }
}
