package com.guyu.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** 桌面小卡片：显示一张选好的卡片，或者每半小时轮播一张。点一下打开谷雨 / 白露并跳到对应功能。 */
public class CardWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(context, mgr, id);
    }

    @Override
    public void onDeleted(Context context, int[] ids) {
        for (int id : ids) Store.forget(context, id);
    }

    static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(context, CardWidget.class));
        for (int id : ids) render(context, mgr, id);
    }

    static void render(Context context, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_card);
        List<Store.Card> cards = Store.cards(context);
        Store.Card card = null;
        String want = Store.choice(context, id);
        if (!cards.isEmpty()) {
            if (!"__rotate".equals(want)) for (Store.Card k : cards) if (k.id().equals(want)) { card = k; break; }
            if (card == null) {
                long slot = System.currentTimeMillis() / (30L * 60 * 1000);
                card = cards.get((int) ((slot + id) % cards.size()));
            }
        }
        if (card == null) {
            v.setTextViewText(R.id.ico, "🌸");
            v.setTextViewText(R.id.title, "谷雨小组件");
            v.setTextViewText(R.id.line1, "还没有数据");
            v.setTextViewText(R.id.line2, "打开谷雨或白露，在「手机桌面小组件」里点一下同步");
            v.setTextViewText(R.id.line3, "");
            v.setTextViewText(R.id.time, "");
            Intent self = new Intent(context, MainActivity.class);
            self.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            v.setOnClickPendingIntent(R.id.root, pending(context, id, self));
            mgr.updateAppWidget(id, v);
            return;
        }
        v.setTextViewText(R.id.ico, card.ico);
        v.setTextViewText(R.id.title, card.title);
        v.setTextViewText(R.id.line1, card.lines.size() > 0 ? card.lines.get(0) : "");
        v.setTextViewText(R.id.line2, card.lines.size() > 1 ? card.lines.get(1) : "");
        v.setTextViewText(R.id.line3, card.lines.size() > 2 ? card.lines.get(2) : "");
        String t = card.at > 0 ? new SimpleDateFormat("HH:mm", Locale.CHINA).format(new Date(card.at)) + " 同步" : "";
        v.setTextViewText(R.id.time, t);
        applyTheme(v, card.theme);

        Intent open = null;
        if (card.pkg != null && card.pkg.length() > 0) open = context.getPackageManager().getLaunchIntentForPackage(card.pkg);
        if (open == null) open = new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        open.putExtra("gyx_open", card.key);
        open.putExtra("arguments", "{\"gyx_open\":\"" + card.key.replace("\"", "") + "\"}");
        v.setOnClickPendingIntent(R.id.root, pending(context, id, open));
        mgr.updateAppWidget(id, v);
    }

    private static PendingIntent pending(Context context, int id, Intent intent) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, id, intent, flags);
    }

    private static void applyTheme(RemoteViews v, String theme) {
        int bg = R.drawable.bg_light, main = Color.parseColor("#1D1D1F"), sub = Color.parseColor("#6E6E73");
        if ("dark".equals(theme)) { bg = R.drawable.bg_dark; main = Color.parseColor("#F5F5F7"); sub = Color.parseColor("#A1A1A6"); }
        else if ("pink".equals(theme)) { bg = R.drawable.bg_pink; main = Color.parseColor("#7A2948"); sub = Color.parseColor("#B0647F"); }
        else if ("cream".equals(theme)) { bg = R.drawable.bg_cream; main = Color.parseColor("#4A3A28"); sub = Color.parseColor("#8A7660"); }
        else if ("sky".equals(theme)) { bg = R.drawable.bg_sky; main = Color.parseColor("#1F3A5F"); sub = Color.parseColor("#5B7699"); }
        v.setInt(R.id.root, "setBackgroundResource", bg);
        v.setTextColor(R.id.title, main);
        v.setTextColor(R.id.line1, main);
        v.setTextColor(R.id.line2, sub);
        v.setTextColor(R.id.line3, sub);
    }
}
