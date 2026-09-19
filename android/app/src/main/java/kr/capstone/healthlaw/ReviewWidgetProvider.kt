package kr.capstone.healthlaw

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import java.time.LocalDate

class ReviewWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { update(context, manager, it) } }
  companion object {
    fun refresh(context: Context) { val m=AppWidgetManager.getInstance(context); val c=ComponentName(context, ReviewWidgetProvider::class.java); m.getAppWidgetIds(c).forEach { update(context,m,it) } }
    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val p=context.getSharedPreferences("widget", Context.MODE_PRIVATE)
      val last=p.getString("lastStudyDate", "") ?: ""
      val gap=try { LocalDate.now().toEpochDay()-LocalDate.parse(last).toEpochDay() } catch (_:Exception){ 99 }
      val (face,message)=when { gap==0 -> Pair("😊", "오늘도 판결을 기다리고 있어요!"); gap==1L -> Pair("😐", "오늘의 5문항이 아직 남았어요."); else -> Pair("😣", "심사관님, 너무 오래 비우셨어요…") }
      val v=RemoteViews(context.packageName, R.layout.widget_review)
      v.setTextViewText(R.id.widget_face, face)
      v.setTextViewText(R.id.widget_title, "${p.getString("nickname","심사관")}의 심사실")
      v.setTextViewText(R.id.widget_status, "🔥 ${p.getInt("streak",0)}일 연속 · 오늘 ${p.getInt("todaySolved",0)}/5건")
      v.setTextViewText(R.id.widget_message, message)
      val i=Intent(context, MainActivity::class.java); val pi=PendingIntent.getActivity(context,0,i,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      v.setOnClickPendingIntent(R.id.widget_root, pi); manager.updateAppWidget(id,v)
    }
  }
}
