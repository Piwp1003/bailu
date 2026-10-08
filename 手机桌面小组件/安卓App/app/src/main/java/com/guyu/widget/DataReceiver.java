package com.guyu.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 谷雨 / 白露 发广播 com.guyu.widget.UPDATE，extra「data」是一段 JSON：{app, pkg, at, theme, cards:[{k, ico, n, lines:[]}]} */
public class DataReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String data = intent.getStringExtra("data");
        if (data == null || data.length() == 0) return;
        Store.saveData(context, data);
        CardWidget.updateAll(context);
    }
}
