package com.guyu.widget;

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** 打开这个 App 本身：看看收到了什么、怎么把小组件放到桌面上。 */
public class MainActivity extends Activity {
    @Override
    protected void onResume() {
        super.onResume();
        List<Store.Card> cards = Store.cards(this);
        StringBuilder s = new StringBuilder();
        s.append("🌸 谷雨小组件\n\n");
        if (cards.isEmpty()) {
            s.append("还没收到谷雨 / 白露的数据。\n\n1. 打开谷雨（或白露），导入「📲 手机桌面小组件」插件\n2. 在里面点「现在同步」\n3. 回到桌面，长按空白处 → 小组件 → 找到「谷雨小组件」拖出来\n");
        } else {
            long at = cards.get(0).at;
            s.append("收到 ").append(cards.size()).append(" 张卡片");
            if (at > 0) s.append("，最近一次同步：").append(new SimpleDateFormat("M月d日 HH:mm", Locale.CHINA).format(new Date(at)));
            s.append("\n\n");
            for (Store.Card k : cards) {
                s.append(k.ico).append("  ").append(k.title).append("\n");
                for (String l : k.lines) if (l != null && l.length() > 0) s.append("      ").append(l).append("\n");
            }
            s.append("\n放到桌面：长按桌面空白处 → 小组件 → 「谷雨小组件」。\n想换显示哪张：长按桌面上的小组件 → 设置 / 重新配置。\n一个小组件可以选固定一张，也可以每半小时轮播。点一下会打开谷雨并跳到对应的功能。");
        }
        TextView t = new TextView(this);
        t.setText(s.toString());
        t.setTextSize(15);
        t.setLineSpacing(0, 1.3f);
        int p = (int) (20 * getResources().getDisplayMetrics().density);
        t.setPadding(p, p * 2, p, p);
        ScrollView sv = new ScrollView(this);
        sv.addView(t);
        setContentView(sv);
    }
}
