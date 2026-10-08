package com.guyu.widget;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** 存谷雨 / 白露推过来的数据，以及每个桌面小组件选的是哪张卡片。 */
final class Store {
    private Store() {}
    static SharedPreferences sp(Context c) { return c.getSharedPreferences("guyu_widget", Context.MODE_PRIVATE); }

    /** 收到一次推送：按来源（谷雨 / 白露）分开存，互不覆盖。 */
    static void saveData(Context c, String json) {
        try {
            JSONObject d = new JSONObject(json);
            String app = d.optString("app", "谷雨");
            JSONObject all = all(c);
            d.put("recv", System.currentTimeMillis());
            all.put(app, d);
            sp(c).edit().putString("all", all.toString()).apply();
        } catch (Exception ignored) {}
    }

    static JSONObject all(Context c) {
        try { return new JSONObject(sp(c).getString("all", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    /** 一张卡片：来自哪个 App + 卡片内容。 */
    static final class Card {
        String app, pkg, key, ico, title, theme;
        List<String> lines = new ArrayList<>();
        long at;
        String id() { return app + "|" + key; }
    }

    static List<Card> cards(Context c) {
        List<Card> out = new ArrayList<>();
        JSONObject all = all(c);
        Iterator<String> it = all.keys();
        while (it.hasNext()) {
            String app = it.next();
            JSONObject d = all.optJSONObject(app);
            if (d == null) continue;
            JSONArray arr = d.optJSONArray("cards");
            if (arr == null) continue;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null) continue;
                Card k = new Card();
                k.app = app; k.pkg = d.optString("pkg", ""); k.at = d.optLong("at", 0); k.theme = d.optString("theme", "light");
                k.key = o.optString("k"); k.ico = o.optString("ico", "🌸"); k.title = o.optString("n", app);
                JSONArray ls = o.optJSONArray("lines");
                if (ls != null) for (int j = 0; j < ls.length() && j < 3; j++) k.lines.add(ls.optString(j));
                out.add(k);
            }
        }
        return out;
    }

    static void setChoice(Context c, int widgetId, String cardId) { sp(c).edit().putString("w" + widgetId, cardId).apply(); }
    static String choice(Context c, int widgetId) { return sp(c).getString("w" + widgetId, "__rotate"); }
    static void forget(Context c, int widgetId) { sp(c).edit().remove("w" + widgetId).apply(); }
}
