package com.guyu.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.LinearLayout;
import java.util.ArrayList;
import java.util.List;

/** 放小组件 / 长按「重新设置」时弹出来：选这个小组件显示哪张卡片。 */
public class ConfigActivity extends Activity {
    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setResult(RESULT_CANCELED);
        Bundle ex = getIntent().getExtras();
        if (ex != null) widgetId = ex.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        final List<Store.Card> cards = Store.cards(this);
        final List<String> ids = new ArrayList<>();
        List<String> names = new ArrayList<>();
        ids.add("__rotate"); names.add("🔄 每半小时换一张（轮播）");
        boolean many = false; String first = null;
        for (Store.Card k : cards) { if (first == null) first = k.app; else if (!first.equals(k.app)) many = true; }
        for (Store.Card k : cards) { ids.add(k.id()); names.add(k.ico + "  " + k.title + (many ? "  · " + k.app : "")); }

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = (int) (16 * getResources().getDisplayMetrics().density);
        box.setPadding(p, p, p, p / 2);
        TextView tip = new TextView(this);
        tip.setText(cards.isEmpty() ? "还没收到数据：先打开谷雨或白露，在「📲 手机桌面小组件」里点「现在同步」。先选轮播，有数据了会自动显示。" : "这个小组件显示哪张？");
        tip.setTextSize(15);
        tip.setPadding(0, 0, 0, p / 2);
        box.addView(tip);
        ListView list = new ListView(this);
        list.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, names));
        list.setOnItemClickListener((parent, view, pos, id) -> {
            Store.setChoice(this, widgetId, ids.get(pos));
            CardWidget.render(this, AppWidgetManager.getInstance(this), widgetId);
            Intent r = new Intent();
            r.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
            setResult(RESULT_OK, r);
            finish();
        });
        box.addView(list);
        setContentView(box);
    }
}
