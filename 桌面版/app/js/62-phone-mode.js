/* ===========================================================================
   js/62 —— 📱 小手机模式（设置里一键切换，数据还是同一份）
   ---------------------------------------------------------------------------
   打开后整个白露变成一台手机（简约手绘风）：
   · 桌面：状态栏（时间/信号/电量）、时钟小组件、「最近在聊」小组件、一格格 App 图标、底下 Dock
   · 点图标 = 打开白露原来那个功能，就在这台手机的屏幕里显示；顶上「‹ 标题」、底下那条小横杠都回桌面
   · 电脑上：屏幕正中一台手机；手机上：整屏就是这台手机
   · 壁纸可以换（「壁纸」那个图标），存在本机，不进存档

   跟微信模式互斥（开一个另一个自动关）。所有样式都挂在 body.gyphm 上，关掉就原样回来，
   平时的白露一条不改。开关存在 localStorage('gyPhoneMode')。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPmLoaded) return;
    window.__gyPmLoaded = true;

    const KEY = 'gyPhoneMode';
    const S = { app: false, view: null, title: '', wall: null, sheet: false };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const groups = () => (typeof groupChats !== 'undefined' && Array.isArray(groupChats)) ? groupChats : [];
    const sessOf = id => groups().find(g => String(g.id) === String(id)) || chars().find(c => String(c.id) === String(id));
    const av = (x, n) => { try { return x && x.members ? getGroupAvatarHTML(x, n) : getAvatarHTML(x, n); } catch (e) { return ''; } };
    const isOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
    const isDesk = () => window.innerWidth > 900;
    const pad = n => String(n).padStart(2, '0');
    const store = (() => { try { return localforage.createInstance({ name: 'gyPhoneMode', storeName: 'wall' }); } catch (e) { return null; } })();

    /* ---------------- 手绘线稿图标 ---------------- */
    const P = {
        chat: '<path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
        home: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
        diary: '<path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z"/><path d="M5 18a2 2 0 0 1 2-2h11M9 8h6M9 11h4"/>',
        forum: '<path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 20h18M12 3l9 5H3z"/>',
        mask: '<path d="M4 6c3 1 13 1 16 0 0 7-3 12-8 12S4 13 4 6z"/><path d="M8 11c1-.8 2-.8 3 0M13 11c1-.8 2-.8 3 0M10 15c1.2.8 2.8.8 4 0"/>',
        theater: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M10 9l5 2.5-5 2.5z"/><path d="M8 20h8"/>',
        cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17h.01M12 17h.01"/>',
        today: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9.5 15.5l1.8 1.5 3.2-3.5"/>',
        music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
        film: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17M8 6l-1.5 4M13 6l-1.5 4M18 6l-1.5 4"/>',
        book: '<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5c-3-.5-6 0-8 1.5z"/><path d="M12 6v14.5"/>',
        bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
        map: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
        web: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13.5 0 16M12 4c-2.5 2.5-2.5 13.5 0 16"/>',
        puzzle: '<path d="M5 9h3a2 2 0 1 1 4 0h3v3a2 2 0 1 0 0 4v3H5v-3a2 2 0 1 0 0-4z"/>',
        people: '<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.3"/><path d="M3.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M14.5 14.5c2.8-.6 5.2 1 6 4.5"/>',
        bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M6 18l1.8-1.8M16.2 7.8L18 6"/>',
        image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4 3.5 3 2.5-2 3.5 3"/>',
        brain: '<path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.5A3 3 0 0 0 9 19h1V5zM15 5a3 3 0 0 1 3 3 3 3 0 0 1 1 5.5A3 3 0 0 1 15 19h-1V5z"/>',
        gossip: '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="M6.3 7.2l4.2 3.6M17.7 7.2l-4.2 3.6M6.3 16.8l4.2-3.6M17.7 16.8l-4.2-3.6"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2"/>',
        apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
        wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M15.5 14.5h2"/>',
        kit: '<path d="M6 9h12l-1 11H7z"/><path d="M9 9a3 3 0 0 1 6 0M4 9h16"/>',
        cake: '<path d="M5 12h14v8H5z"/><path d="M5 15c2 1 3-1 5 0s3-1 5 0 3-1 4 0M12 12V8M12 5.5v.01"/>',
        heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
        smile: '<circle cx="12" cy="12" r="8"/><path d="M9 10h.01M15 10h.01M8.5 14c1.8 2 5.2 2 7 0"/>',
        brush: '<path d="M14.5 4.5l5 5-7.5 7.5-5-5z"/><path d="M7 12.5c-2 0-3.5 1.5-3.5 3.5 0 1.7-.5 3-1 3.5 3 0 7-.5 7-4.5"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
        wifi: '<path d="M4 9.5a12 12 0 0 1 16 0M7 12.8a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0"/><path d="M12 19h.01"/>'
    };
    const svg = (k, sw) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.7}" stroke-linecap="round" stroke-linejoin="round">${P[k] || ''}</svg>`;

    // 所有 App：[key, 名字, 图标, 底色, 打开方式]。哪些摆在桌面、哪页、Dock 放哪几个，都在 js/63 的桌面布局里（能自己改）
    const APPS = [
        ['chat', '聊天', 'chat', '#dcefe0', { view: 'chat' }],
        ['home', '推特', 'home', '#e1e9fa', { view: 'home' }],
        ['diary', '信件日记', 'diary', '#fbe6d6', { view: 'diary' }],
        ['theater', 'TA们', 'theater', '#efe5fa', { view: 'theater' }],
        ['today', '今天', 'today', '#fff1c2', { today: 1 }],
        ['calendar', '日历', 'cal', '#fde8e8', { fn: 'gyPmCalendar', native: true }],
        ['forum', '论坛', 'forum', '#e5eef0', { view: 'novel' }],
        ['anon', '匿名区', 'mask', '#ececec', { view: 'anonForum' }],
        ['gossip', '八卦网', 'gossip', '#fbe1e8', { feature: 'gossip' }],
        ['music', '音乐', 'music', '#fde0e0', { feature: 'music' }],
        ['film', '电影', 'film', '#e0e6f5', { view: 'watchTogether' }],
        ['book', '阅读', 'book', '#f3ecd9', { feature: 'reading_together' }],
        ['mall', '购物', 'bag', '#ffe6cc', { view: 'mall' }],
        ['map', '地图', 'map', '#dff1ea', { feature: 'map' }],
        ['mini', '小功能', 'puzzle', '#e8f3d8', { view: 'miniHub' }],
        ['chars', '角色', 'people', '#e6e3f7', { view: 'characterCenter' }],
        ['mem', '记忆', 'brain', '#f7e3ef', { view: 'memoryHub' }],
        ['photos', '相册', 'image', '#e3f0f7', { fn: 'gyGalleryOpen' }],
        ['wallet', '账单', 'wallet', '#e9f1dc', { fn: 'gyBillOpen', args: ['me'] }],
        ['kit', '随身物', 'kit', '#f4e9dc', { feature: 'kit' }],
        ['days', '日子', 'cake', '#fde8ee', { feature: 'days' }],
        ['rel', '关系账本', 'heart', '#fbe3e3', { feature: 'relations' }],
        ['now', '此刻', 'web', '#e2eef7', { feature: 'now' }],
        ['emo', '表情', 'smile', '#fff4d6', { feature: 'emoticon' }],
        ['notif', '通知', 'bell', '#fff1c2', { view: 'notifications' }],
        ['set', '设置', 'gear', '#ececec', { view: 'settings' }],
        ['beauty', '美化', 'brush', '#f1e6fa', { sheet: 'beauty' }],
        ['lockscr', '锁屏', 'lock', '#e9e9eb', { fn: 'gyPmLockNow' }]
    ];

    /* ---------------- 样式 ---------------- */
    const HAND = '"LXGW WenKai","霞鹜文楷","KaiTi","STKaiti","楷体",serif';
    const CSS = `
/* ===== 小手机：iOS / ins 风（黑白灰、白卡、柔阴影、胶囊按钮）。颜色都走变量，深色外观只换变量 ===== */
body.gyphm{--pm-bg:#f2f2f4;--pm-card:#ffffff;--pm-text:#111111;--pm-sub:#8e8e93;--pm-hair:rgba(0,0,0,.08);--pm-fill:#f2f2f4;--pm-glass:rgba(255,255,255,.72);--pm-shadow:0 10px 28px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.05);--pm-ic-bg:#ffffff;--pm-ic-fg:#111111;--pm-accent:#111111;--pm-accent-fg:#ffffff;--pm-red:#ff3b30;--pm-font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif;--pm-num:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue","PingFang SC",sans-serif}
body.gyphm.pm-dark{--pm-bg:#0b0b0c;--pm-card:#1c1c1e;--pm-text:#f5f5f7;--pm-sub:#8e8e93;--pm-hair:rgba(255,255,255,.1);--pm-fill:#2c2c2e;--pm-glass:rgba(40,40,42,.72);--pm-shadow:0 10px 28px rgba(0,0,0,.4);--pm-ic-bg:#1c1c1e;--pm-ic-fg:#f5f5f7;--pm-accent:#f5f5f7;--pm-accent-fg:#111}
#gyPm,#gyPmBar,#gyPmHome,#gyPmInd,#gyPmSheet{display:none;font-family:var(--pm-font);color:var(--pm-text);-webkit-font-smoothing:antialiased}
body.gyphm #gyPm{display:block}
/* 电脑：屏幕中间一台 iPhone */
#gyPm{position:fixed;inset:0;z-index:1990;pointer-events:none}
#gyPm .pm-bg{position:absolute;inset:0;background:#ebebee;background-image:radial-gradient(rgba(0,0,0,.035) 1px,transparent 1.3px),radial-gradient(circle at 20% 10%,#fff 0,transparent 45%),radial-gradient(circle at 85% 90%,#f7f7f9 0,transparent 40%);background-size:22px 22px,100% 100%,100% 100%;pointer-events:auto}
body.pm-dark #gyPm .pm-bg{background-color:#151516;background-image:radial-gradient(rgba(255,255,255,.04) 1px,transparent 1.3px);background-size:22px 22px}
#gyPm .pm-frame{position:absolute;left:var(--pm-fl);top:var(--pm-ft);width:var(--pm-fw);height:var(--pm-fh);border-radius:56px;background:#161617;box-shadow:0 0 0 1.5px #3a3a3c inset,0 40px 90px rgba(0,0,0,.22),0 12px 30px rgba(0,0,0,.14);pointer-events:auto}
#gyPm .pm-btn{position:absolute;width:3px;border-radius:2px;background:#2c2c2e}
#gyPm .pm-btn.a{left:-3px;top:130px;height:30px}#gyPm .pm-btn.b{left:-3px;top:178px;height:58px}#gyPm .pm-btn.c{right:-3px;top:196px;height:86px}
#gyPm .pm-cap{position:absolute;left:50%;transform:translateX(-50%);bottom:-30px;font-size:12px;letter-spacing:3px;color:#a1a1a6;white-space:nowrap;text-transform:uppercase}
body.gyphm-mob #gyPm .pm-bg,body.gyphm-mob #gyPm .pm-frame{display:none}
/* 屏幕 */
#gyPmHome{position:fixed;left:var(--pm-sl);top:var(--pm-st);width:var(--pm-sw);height:var(--pm-sh);z-index:1995;border-radius:var(--pm-sr);overflow:hidden;background:var(--pm-bg);background-size:cover;background-position:center}
body.gyphm #gyPmHome{display:flex;flex-direction:column}
body.gyphm.gyphm-app #gyPmHome{display:none}
/* 状态栏 */
.pm-sb{height:50px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:4px 30px 0 34px;font-size:15px;font-weight:600;color:var(--pm-text);position:relative;letter-spacing:.2px;font-family:var(--pm-num)}
.pm-sb .r{display:flex;align-items:center;gap:6px}
.pm-sb svg{width:17px;height:17px}
.pm-sig{display:flex;align-items:flex-end;gap:1.6px;height:11px}.pm-sig i{width:3px;border-radius:1px;background:currentColor;display:block}
.pm-bat{min-width:26px;height:13px;border-radius:4px;background:currentColor;position:relative;display:flex;align-items:center;justify-content:center;padding:0 3px;box-sizing:border-box}
.pm-bat::after{content:"";position:absolute;right:-3px;top:4px;width:1.5px;height:5px;border-radius:0 1px 1px 0;background:currentColor;opacity:.5}
.pm-bat b{font-size:9.5px;font-weight:700;color:var(--pm-bg);line-height:1}
.pm-bat.low{background:var(--pm-red)}
.pm-bat.saver{background:#ffcc00}.pm-bat.saver b{color:#111}
.pm-isl{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:108px;height:31px;border-radius:17px;background:#000}
body.gyphm-mob .pm-isl{display:none}
body.gyphm-mob .pm-sb{padding-top:env(safe-area-inset-top);height:calc(46px + env(safe-area-inset-top))}
#gyPmHome.has-wall .pm-sb{color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.25)}
#gyPmHome.has-wall .pm-sb .pm-bat b{color:#333}
/* 小组件卡片（共用） */
.pm-w{background:var(--pm-card);border-radius:24px;padding:14px 16px;margin-bottom:14px;box-shadow:var(--pm-shadow);color:var(--pm-text)}
.pm-clock{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
.pm-clock .t{font-family:var(--pm-num);font-size:56px;font-weight:200;line-height:.95;letter-spacing:-1px}
.pm-clock .d{text-align:right;font-size:13px;line-height:1.5;color:var(--pm-sub);font-weight:500}
.pm-clock .d b{display:block;font-size:17px;color:var(--pm-text);font-weight:600}
.pm-note{margin-top:12px;padding-top:10px;border-top:.5px solid var(--pm-hair);font-size:13px;display:flex;align-items:center;gap:7px;color:var(--pm-sub)}
.pm-note .dot{width:7px;height:7px;border-radius:50%;background:var(--pm-red);flex-shrink:0}
.pm-last{display:flex;align-items:center;gap:12px;cursor:pointer}
.pm-last .av{width:46px;height:46px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;box-shadow:0 0 0 .5px var(--pm-hair)}
.pm-last .av>*{width:100%!important;height:100%!important;border-radius:50%!important;border:none!important;box-shadow:none!important;margin:0!important}
.pm-last .m{flex:1;min-width:0}
.pm-last .n{font-size:16px;font-weight:600}
.pm-last .p{font-size:13px;color:var(--pm-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.pm-last .k{font-size:11.5px;color:var(--pm-sub);flex-shrink:0;align-self:flex-start;margin-top:4px}
/* 图标 */
.pm-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 8px;padding:4px 0 8px}
.pm-app{display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}
.pm-ic{width:60px;height:60px;border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--pm-ic-fg);background:var(--pm-ic-bg)!important;box-shadow:var(--pm-shadow);transition:transform .15s}
.pm-app:active .pm-ic{transform:scale(.9)}
.pm-ic svg{width:28px;height:28px}
.pm-lb{font-size:11.5px;color:var(--pm-text);white-space:nowrap;font-weight:500;letter-spacing:.2px}
#gyPmHome.has-wall .pm-page .pm-lb{color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.pm-badge{position:absolute;top:-6px;right:calc(50% - 38px);min-width:20px;height:20px;border-radius:10px;background:var(--pm-red);color:#fff;font-size:11.5px;font-weight:600;line-height:20px;text-align:center;padding:0 6px;box-sizing:border-box;font-family:var(--pm-num)}
.pm-dock{flex-shrink:0;margin:0 12px 12px;padding:12px 8px;border-radius:32px;background:var(--pm-glass);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);display:grid;grid-template-columns:repeat(4,1fr);box-shadow:0 0 0 .5px var(--pm-hair)}
.pm-dock .pm-lb{display:none}
.pm-dock .pm-ic{box-shadow:0 2px 8px rgba(0,0,0,.06)}
body.gyphm-mob .pm-dock{margin-bottom:calc(12px + env(safe-area-inset-bottom))}
.pm-pg{display:flex;justify-content:center;gap:7px;margin:2px 0 8px}.pm-pg i{width:6px;height:6px;border-radius:50%;background:var(--pm-text);opacity:.2}.pm-pg i.on{opacity:.85}
/* 打开 App 之后：顶栏 */
#gyPmBar{position:fixed;left:var(--pm-sl);top:var(--pm-st);width:var(--pm-sw);z-index:2003;background:var(--pm-glass);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);border-bottom:.5px solid var(--pm-hair);border-radius:var(--pm-sr) var(--pm-sr) 0 0;overflow:hidden}
body.gyphm.gyphm-app #gyPmBar{display:block}
#gyPmBar .nav{height:44px;display:flex;align-items:center;justify-content:center;position:relative;font-size:17px;font-weight:600}
#gyPmBar .nav .t{max-width:62%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gyPmBar .nav .l{position:absolute;left:4px;top:0;bottom:0;display:flex;align-items:center;gap:0;padding:0 8px;cursor:pointer;font-size:16px;font-weight:400;color:var(--pm-text)}
#gyPmBar .nav .l svg{width:24px;height:24px}
#gyPmBar .nav .r{position:absolute;right:8px;top:0;bottom:0;display:flex;align-items:center;padding:0 8px;cursor:pointer;color:var(--pm-text);opacity:.85}
#gyPmBar .nav .r svg{width:21px;height:21px}
/* 小窗：App 缩成一个能拖的小窗口浮在桌面上，里面照样能点 */
body.gyphm.gyphm-float #gyPmHome{display:flex!important}
body.gyphm.gyphm-float #gyPmInd,body.gyphm.gyphm-float .fab-btn{display:none!important}
body.gyphm-mob.gyphm-float .main-content{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;overflow-y:auto!important;z-index:2002!important;background:var(--pm-card)!important}
body.gyphm.gyphm-float #gyPmBar,body.gyphm.gyphm-float .main-content,body.gyphm.gyphm-float #gyPmApp{transition:transform .38s cubic-bezier(.2,.85,.25,1)}
body.gyphm.gyphm-float.pm-fl-drag #gyPmBar,body.gyphm.gyphm-float.pm-fl-drag .main-content,body.gyphm.gyphm-float.pm-fl-drag #gyPmApp{transition:none}
#gyPmFloat{display:none;position:fixed;z-index:2006;pointer-events:none}
body.gyphm-float #gyPmFloat{display:block}
#gyPmFloat .fr{position:absolute;inset:0;border-radius:18px;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 18px 40px rgba(0,0,0,.28)}
#gyPmFloat .gb{position:absolute;left:0;right:0;top:-30px;height:28px;display:flex;align-items:center;justify-content:space-between;pointer-events:auto;cursor:grab;touch-action:none;padding:0 4px}
#gyPmFloat .gb i{font-style:normal;width:26px;height:26px;border-radius:50%;background:rgba(30,30,32,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer}
#gyPmFloat .gb b{width:44px;height:5px;border-radius:3px;background:rgba(60,60,67,.55)}
#gyPmBar .nav .l.home .hm{width:30px;height:30px;border-radius:9px;background:var(--pm-fill);display:flex;align-items:center;justify-content:center}
#gyPmBar .nav .l.home svg{width:17px;height:17px}
body.gyphm-mob #gyPmBar{border-radius:0}
#gyPmInd{position:fixed;left:var(--pm-sl);width:var(--pm-sw);top:calc(var(--pm-st) + var(--pm-sh) - 22px);height:22px;z-index:2004;cursor:pointer;align-items:center;justify-content:center;pointer-events:none}
#gyPmInd i{pointer-events:auto;cursor:pointer}
#gyPmInd i{box-sizing:content-box;display:block;width:134px;height:5px;padding:8px 0;background-clip:content-box;border-radius:3px;background-color:var(--pm-text);opacity:.85}
body.gyphm-desk.gyphm-app #gyPmInd{display:flex}
/* 白露原来的页面塞进屏幕 */
body.gyphm .sidebar-left,body.gyphm .sidebar-right,body.gyphm .mobile-bottom-nav,body.gyphm .mobile-topbar{display:none!important}
body.gyphm-desk #mainLayoutContainer{display:block!important;max-width:none!important;margin:0!important}
body.gyphm-desk .main-content{position:fixed!important;left:var(--pm-sl)!important;top:calc(var(--pm-st) + var(--pm-top))!important;width:var(--pm-sw)!important;max-width:none!important;height:calc(var(--pm-sh) - var(--pm-top))!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;z-index:2002!important;border:none!important;padding:0!important;margin:0!important;background:var(--pm-card)!important;border-radius:0 0 var(--pm-sr) var(--pm-sr)}
body.gyphm-desk #view-chat .chat-input-area{padding-bottom:26px!important}
body.gyphm-desk #view-chat,body.gyphm-desk #view-worldbook{height:100%!important;position:relative!important;top:auto!important;bottom:auto!important}
body.gyphm-mob .main-content{padding-top:calc(62px + env(safe-area-inset-top))!important;padding-bottom:0!important}
body.gyphm-mob #view-chat,body.gyphm-mob #view-worldbook{top:calc(62px + env(safe-area-inset-top))!important;bottom:0!important}
body.gyphm .main-content .header-title:has(> .back-btn){display:none!important}
body.gyphm:not(.gyphm-app) .main-content{visibility:hidden!important}
body.gyphm-desk .fab-btn{position:fixed!important;left:calc(var(--pm-sl) + var(--pm-sw) - 74px)!important;right:auto!important;top:calc(var(--pm-st) + var(--pm-sh) - 100px)!important;bottom:auto!important;z-index:2003!important}
body.gyphm:not(.gyphm-app) .fab-btn{display:none!important}
/* 原生 App（日历之类）的画布：跟白露的页面放在同一块地方 */
#gyPmApp{display:none;position:fixed;left:var(--pm-sl);top:calc(var(--pm-st) + var(--pm-top));width:var(--pm-sw);height:calc(var(--pm-sh) - var(--pm-top));z-index:2002;overflow-y:auto;background:var(--pm-bg);border-radius:0 0 var(--pm-sr) var(--pm-sr);font-family:var(--pm-font);color:var(--pm-text);box-sizing:border-box;padding-bottom:28px}
body.gyphm.gyphm-app #gyPmApp.on{display:block}
body.gyphm.gyphm-native .main-content{visibility:hidden!important}
body.gyphm-mob #gyPmApp{top:calc(62px + env(safe-area-inset-top));height:calc(100% - 62px - env(safe-area-inset-top))}
/* 聊天页自己那条「‹ 名字」跟上面的顶栏重复了：收起来（返回交给顶栏） */
body.gyphm #gyChatHead{display:none!important}
/* 手机上也有底下那条小横杠（回桌面） */
body.gyphm-mob.gyphm-app #gyPmInd{display:flex;position:fixed;top:auto;bottom:0;left:0;width:100%;height:calc(22px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
body.gyphm-mob .main-content{padding-bottom:26px!important}
body.gyphm-mob #view-chat{bottom:calc(20px + env(safe-area-inset-bottom))!important}
/* 弹窗：电脑上关进手机屏幕里，不再盖满整个窗口 */
body.gyphm-desk .modal-overlay{left:var(--pm-sl)!important;top:var(--pm-st)!important;width:var(--pm-sw)!important;height:var(--pm-sh)!important;border-radius:var(--pm-sr);overflow:hidden;backdrop-filter:blur(6px)}
body.gyphm-desk .modal-overlay .modal-box,body.gyphm-desk .modal-overlay .modal-content{max-width:calc(var(--pm-sw) - 24px)!important;max-height:calc(var(--pm-sh) - 80px)!important;overflow-y:auto}
body.gyphm-desk .toast-container{top:calc(var(--pm-st) + 50px)!important;max-width:calc(var(--pm-sw) - 20px)}
/* 📱 手机上不显示「时间 · 信号 · 电量」那一行（手机自己有），只留一条细细的、能往下拉出通知中心的把手 */
body.gyphm-mob #gyPmHome .pm-sb,body.gyphm-mob #gyPmBar .pm-sb,body.gyphm-mob .pm-lock .pm-sb,body.gyphm-mob #gyPmNC .nc-sb{height:calc(18px + env(safe-area-inset-top))!important;padding:env(safe-area-inset-top) 0 0!important;justify-content:center}
body.gyphm-mob .pm-sb>*:not(.pm-ncgrab),body.gyphm-mob #gyPmNC .nc-sb>*{display:none!important}
body.gyphm-mob .pm-ncgrab{position:static!important;transform:none!important;width:90px!important;height:18px!important}
/* 🔔 通知中心 */
#gyPmNC{display:none;position:fixed;left:var(--pm-sl);top:var(--pm-st);width:var(--pm-sw);height:var(--pm-sh);z-index:2012;border-radius:var(--pm-sr);overflow:hidden;background:rgba(242,242,244,.8);backdrop-filter:blur(30px) saturate(1.6);-webkit-backdrop-filter:blur(30px) saturate(1.6);transform:translateY(-100%);transition:transform .32s cubic-bezier(.2,.85,.25,1);font-family:var(--pm-font);color:var(--pm-text)}
body.pm-dark #gyPmNC{background:rgba(20,20,22,.8)}
body.gyphm #gyPmNC.on,body.gyphm #gyPmNC.drag{display:block}
#gyPmNC.on{transform:none}
#gyPmNC.drag{transition:none}
#gyPmNC .nc-in{height:100%;display:flex;flex-direction:column}
#gyPmNC .nc-sb .pm-isl{display:none}
#gyPmNC .nc-sb{height:50px;display:flex;align-items:center;justify-content:space-between;padding:4px 30px 0 34px;font-size:15px;font-weight:600;font-family:var(--pm-num)}
#gyPmNC .nc-sb .r{display:flex;align-items:center;gap:6px}#gyPmNC .nc-sb svg{width:17px;height:17px}
body.gyphm-mob #gyPmNC .nc-sb{padding-top:env(safe-area-inset-top);height:calc(46px + env(safe-area-inset-top))}
#gyPmNC .nc-top{text-align:center;padding:8px 0 14px}
#gyPmNC .nc-d{font-size:16px;font-weight:600;opacity:.8}
#gyPmNC .nc-t{font-family:var(--pm-num);font-size:64px;font-weight:600;letter-spacing:-1.5px;line-height:1.05}
#gyPmNC .nc-bar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px 8px}
#gyPmNC .nc-bar b{font-size:20px;font-weight:700}
#gyPmNC .nc-bar span{display:flex;gap:8px}
#gyPmNC .nc-bar i svg{width:14px;height:14px;vertical-align:-2px}
#gyPmNC .nc-bar i{font-style:normal;font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--pm-glass);cursor:pointer;box-shadow:0 0 0 .5px var(--pm-hair)}
#gyPmNC .nc-list{flex:1;overflow-y:auto;padding:0 12px 10px;overscroll-behavior:contain}
#gyPmNC .nc-h{font-size:12px;font-weight:600;color:var(--pm-sub);margin:10px 6px 6px;letter-spacing:.5px}
#gyPmNC .nc-n{display:flex;gap:11px;align-items:flex-start;background:var(--pm-glass);border-radius:18px;padding:11px 13px;margin-bottom:8px;cursor:pointer;box-shadow:0 0 0 .5px var(--pm-hair),0 4px 14px rgba(0,0,0,.05)}
#gyPmNC .nc-n:active{transform:scale(.98)}
#gyPmNC .nc-n .ic{width:34px;height:34px;border-radius:9px;background:var(--pm-card);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.08)}
#gyPmNC .nc-n .ic svg{width:19px;height:19px}
#gyPmNC .nc-n .tx{min-width:0;flex:1}
#gyPmNC .nc-n .hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
#gyPmNC .nc-n b{display:block;font-size:14px;font-weight:600;line-height:1.45;word-break:break-word}
#gyPmNC .nc-n em{font-style:normal;font-size:11px;color:var(--pm-sub);flex-shrink:0}
#gyPmNC .nc-n p{margin:3px 0 0;font-size:13.5px;line-height:1.55;color:var(--pm-text);opacity:.85;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
#gyPmNC .nc-empty{text-align:center;color:var(--pm-sub);font-size:14px;padding:50px 0}
#gyPmNC .nc-grab{touch-action:none;height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;padding-bottom:env(safe-area-inset-bottom)}
#gyPmNC .nc-grab i{width:134px;height:5px;border-radius:3px;background:var(--pm-text);opacity:.8}
/* 状态栏可以拉：浏览器别抢这个手势；整页也别触发下拉刷新 */
body.gyphm #gyPmHome .pm-sb,body.gyphm #gyPmBar .pm-sb{touch-action:none;cursor:grab}
html:has(body.gyphm),body.gyphm{overscroll-behavior-y:none}
/* 手机上状态栏下面那颗小横条：不用拉，点它也能打开通知 */
.pm-ncgrab{display:none}
body.gyphm-mob .pm-ncgrab{display:flex;position:absolute;left:50%;transform:translateX(-50%);bottom:-2px;width:60px;height:14px;align-items:center;justify-content:center;cursor:pointer;touch-action:none;z-index:3}
body.gyphm-mob .pm-ncgrab i{width:36px;height:4px;border-radius:2px;background:currentColor;opacity:.25}
/* 底部抽屉（iOS sheet） */
#gyPmSheet{position:fixed;left:var(--pm-sl);width:var(--pm-sw);top:var(--pm-st);height:var(--pm-sh);z-index:2010;border-radius:var(--pm-sr);overflow:hidden;background:rgba(0,0,0,.28);align-items:flex-end}
body.gyphm #gyPmSheet.on{display:flex}
#gyPmSheet .box{width:100%;background:var(--pm-bg);border-radius:26px 26px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.12);animation:pmSheetUp .28s cubic-bezier(.2,.8,.2,1)}
#gyPmSheet .box::before{content:"";display:block;width:38px;height:5px;border-radius:3px;background:var(--pm-sub);opacity:.4;margin:0 auto 12px}
@keyframes pmSheetUp{from{transform:translateY(40%);opacity:.4}}
#gyPmSheet .box.still{animation:none}
#gyPmSheet h4{margin:0 0 14px;font-size:17px;font-weight:600;text-align:center;color:var(--pm-text)}
#gyPmSheet .it{display:block;width:100%;padding:13px;margin-bottom:9px;border:none;border-radius:14px;background:var(--pm-card);font-size:15.5px;cursor:pointer;color:var(--pm-text);text-align:center;box-shadow:0 0 0 .5px var(--pm-hair);font-family:inherit;box-sizing:border-box}
#gyPmSheet .it.pri{background:var(--pm-accent);color:var(--pm-accent-fg);font-weight:600}
#gyPmSheet .it.muted{background:transparent;box-shadow:none;color:var(--pm-sub)}
#gyPmSheet .sw{display:flex;gap:10px;justify-content:center;margin-bottom:14px}
#gyPmSheet .sw span{width:36px;height:36px;border-radius:50%;cursor:pointer;box-shadow:0 0 0 .5px rgba(0,0,0,.15),0 2px 6px rgba(0,0,0,.08)}
/* 设置首页那条开关 */
#gyPmSetEntry .set-entry-ico{background:#111;color:#fff;border-radius:9px;display:inline-flex;align-items:center;justify-content:center}
#gyPmSetEntry .set-entry-ico svg{width:18px;height:18px}
.gypm-sw{width:51px;height:31px;border-radius:16px;background:#e9e9eb;position:relative;flex-shrink:0;transition:background .2s}
.gypm-sw::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.06);transition:left .2s}
.gypm-sw.on{background:#111}.gypm-sw.on::after{left:22px}

/* ===== 屏幕里的白露页面：ins 风黑白（只在小手机模式里） ===== */
body.gyphm{--gy-accent:#111111;--gy-accent-2:#000;--gy-accent-rgb:17,17,17;--gy-accent-fg:#fff;--gy-accent-soft:rgba(0,0,0,.05);--gy-accent-line:rgba(0,0,0,.12)}
body.gyphm.pm-dark{--gy-accent:#f5f5f7;--gy-accent-rgb:245,245,247;--gy-accent-fg:#111}
body.gyphm .main-content{color:var(--pm-text);font-family:var(--pm-font)}
body.gyphm [style*="color:#1d9bf0"],body.gyphm [style*="color: #1d9bf0"]{color:var(--pm-text)!important}
body.gyphm [style*="background:#1d9bf0"],body.gyphm [style*="background: #1d9bf0"],body.gyphm [style*="background-color:#1d9bf0"]{background:var(--pm-accent)!important;color:var(--pm-accent-fg)!important}
body.gyphm [style*="solid #1d9bf0"]{border-color:var(--pm-hair)!important}
body.gyphm [style*="rgba(29,155,240"],body.gyphm [style*="rgba(29, 155, 240"]{background-color:var(--pm-fill)!important}
body.gyphm .btn-post,body.gyphm .btn-primary{background:var(--pm-accent)!important;color:var(--pm-accent-fg)!important;border:none!important;border-radius:999px!important;box-shadow:none!important;font-weight:600!important}
body.gyphm .btn-edit-small,body.gyphm .btn-secondary,body.gyphm .follow-btn{background:var(--pm-card)!important;color:var(--pm-text)!important;border:none!important;border-radius:999px!important;box-shadow:0 0 0 .5px var(--pm-hair),0 2px 8px rgba(0,0,0,.05)!important}
body.gyphm .btn-cancel{background:var(--pm-fill)!important;color:var(--pm-text)!important;border:none!important;border-radius:999px!important}
body.gyphm .set-entry{background:var(--pm-card)!important;border:none!important;border-radius:18px!important;box-shadow:var(--pm-shadow)!important}
body.gyphm .set-entry-title{color:var(--pm-text)!important;font-weight:600!important}
body.gyphm .set-entry-desc,body.gyphm .set-entry-arrow{color:var(--pm-sub)!important}
body.gyphm .info-card,body.gyphm .memory-card,body.gyphm .up-panel{background:var(--pm-card)!important;border:none!important;border-radius:18px!important;box-shadow:var(--pm-shadow)!important}
body.gyphm .input-group input:not([type=checkbox]):not([type=radio]),body.gyphm .input-group select,body.gyphm .input-group textarea{background:var(--pm-fill)!important;border:none!important;border-radius:12px!important;color:var(--pm-text)!important}
body.gyphm input[type=checkbox],body.gyphm input[type=radio],body.gyphm input[type=range]{accent-color:#111}
body.gyphm .tab.active,body.gyphm .gy-tab.active{color:var(--pm-text)!important}
body.gyphm .tab.active::after{background:var(--pm-text)!important}
body.gyphm .post-placeholder{border-bottom:.5px solid var(--pm-hair)!important}
body.gyphm .post-name{color:var(--pm-text)!important}
body.gyphm .modal-box,body.gyphm .modal-content{border-radius:22px!important;border:none!important}
body.gyphm .fab-btn{background:var(--pm-accent)!important;color:var(--pm-accent-fg)!important;box-shadow:0 8px 20px rgba(0,0,0,.2)!important}
/* 聊天：像 ins / iMessage 黑白那种 */
body.gyphm #view-chat{background:var(--pm-card)!important}
body.gyphm #view-chat .chat-bubble{border-radius:20px!important;border:none!important;box-shadow:none!important;font-size:15px}
body.gyphm #view-chat .chat-bubble.me{background:var(--pm-accent)!important;color:var(--pm-accent-fg)!important}
body.gyphm #view-chat .chat-bubble.other{background:var(--pm-fill)!important;color:var(--pm-text)!important}
body.gyphm #view-chat .chat-input-area{background:var(--pm-card)!important;border-top:.5px solid var(--pm-hair)!important}
body.gyphm #view-chat .chat-input-row input{background:var(--pm-fill)!important;border:none!important;border-radius:999px!important;box-shadow:none!important;color:var(--pm-text)!important}
body.gyphm #chatSendBtn{background:var(--pm-accent)!important;color:var(--pm-accent-fg)!important;border:none!important;border-radius:999px!important}
body.gyphm #view-chat .chat-more{background:var(--pm-fill)!important;border:none!important;border-radius:50%!important;color:var(--pm-text)!important}
body.gyphm #chatTopBar{background:transparent!important}
body.gyphm .chat-list-row{border-radius:18px!important;margin:6px 10px!important;background:var(--pm-card)!important;box-shadow:var(--pm-shadow)!important;border:none!important}
body.gyphm .chat-char-row{background:transparent!important;border:none!important}
body.gyphm #gyChatHead{background:transparent!important;border-bottom:.5px solid var(--pm-hair)!important}

`;

    /* ---------------- 尺寸：电脑上是一台手机，手机上是整屏 ---------------- */
    function layout() {
        const on = document.body.classList.contains('gyphm');
        document.body.classList.toggle('gyphm-desk', on && isDesk());
        document.body.classList.toggle('gyphm-mob', on && !isDesk());
        const st = document.documentElement.style;
        if (isDesk()) {
            const fw = 402, fh = Math.min(860, window.innerHeight - 70);
            const fl = Math.round((window.innerWidth - fw) / 2), ft = Math.max(14, Math.round((window.innerHeight - fh) / 2) - 12);
            st.setProperty('--pm-fl', fl + 'px'); st.setProperty('--pm-ft', ft + 'px');
            st.setProperty('--pm-fw', fw + 'px'); st.setProperty('--pm-fh', fh + 'px');
            const b = 11;   // 屏幕跟外框之间那圈黑边
            st.setProperty('--pm-sl', (fl + b) + 'px'); st.setProperty('--pm-st', (ft + b) + 'px');
            st.setProperty('--pm-sw', (fw - b * 2) + 'px'); st.setProperty('--pm-sh', (fh - b * 2) + 'px');
            st.setProperty('--pm-sr', '45px'); st.setProperty('--pm-top', '94px');
        } else {
            st.setProperty('--pm-sl', '0px'); st.setProperty('--pm-st', '0px');
            st.setProperty('--pm-sw', '100vw'); st.setProperty('--pm-sh', (window.innerHeight) + 'px');
            st.setProperty('--pm-sr', '0px'); st.setProperty('--pm-top', '62px');
        }
    }

    function mount() {
        if (!document.getElementById('gyPmCss')) { const s = document.createElement('style'); s.id = 'gyPmCss'; s.textContent = CSS; document.head.appendChild(s); }
        const add = (id, html, tag) => { if (document.getElementById(id)) return; const d = document.createElement(tag || 'div'); d.id = id; d.innerHTML = html; document.body.appendChild(d); };
        add('gyPm', `<div class="pm-bg"></div><div class="pm-frame"><i class="pm-btn a"></i><i class="pm-btn b"></i><i class="pm-btn c"></i><div class="pm-cap">bailu · phone</div></div>`);
        add('gyPmHome', '');
        add('gyPmBar', `<div class="pm-sb" id="gyPmSb2"></div><div class="nav"><span class="l" onclick="gyPmBack()">${svg('back', 2.2)}</span><span class="t" id="gyPmT"></span><span class="r" onclick="gyPmFloat(true)" title="小窗"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3"/><rect x="11.5" y="11" width="7" height="6" rx="1.6" fill="currentColor" stroke="none"/></svg></span></div>`);
        add('gyPmApp', '');
        add('gyPmNC', '');
        add('gyPmInd', '<i></i>');
        const ind = document.getElementById('gyPmInd'); if (ind) { ind.title = '回桌面'; ind.onclick = () => window.gyPmHome(); }
        add('gyPmSheet', '');
        const sh = document.getElementById('gyPmSheet'); if (sh && !sh.__b) { sh.__b = 1; sh.addEventListener('click', e => { if (e.target === sh) closeSheet(); }); }
    }

    /* ---------------- 状态栏 ---------------- */
    // 电量：浏览器给得出来就用真的（电脑 / 手机的真实电量），给不出来就按时间编一个
    let BAT = null;
    try { if (navigator.getBattery) navigator.getBattery().then(b => { const up = () => { BAT = { lv: Math.round(b.level * 100), ch: b.charging }; }; up(); b.addEventListener('levelchange', up); b.addEventListener('chargingchange', up); }).catch(() => {}); } catch (e) {}
    window.gyPmBattery = () => BAT;
    function sbHtml() {
        const d = new Date();
        const bat = BAT ? BAT.lv : 60 + (d.getHours() * 7 + d.getMinutes()) % 38;
        return `<span>${pad(d.getHours())}:${pad(d.getMinutes())}</span><i class="pm-isl"></i>
            <span class="pm-ncgrab" title="通知"><i></i></span><span class="r"><span class="pm-sig"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8.5px"></i><i style="height:11px"></i></span>${svg('wifi', 2.2)}<span class="pm-bat${bat <= 20 && !(BAT && BAT.ch) ? ' low' : ''}${window.gyPmSaverOn && window.gyPmSaverOn() ? ' saver' : ''}"><b>${bat}</b></span></span>`;
    }
    function tickSb() {
        const a = document.querySelector('#gyPmHome .pm-sb'), b = document.getElementById('gyPmSb2');
        const h = sbHtml(); if (a) a.innerHTML = h; if (b) b.innerHTML = h;
    }

    /* ---------------- 桌面 ---------------- */
    function unread() {
        let n = 0;
        try { [...groups(), ...chars()].forEach(x => { if (typeof chatHasUnread === 'function' && chatHasUnread(x.id)) n++; }); } catch (e) {}
        return n;
    }
    function lastChat() {
        let best = null;
        [...groups(), ...chars()].forEach(x => {
            const msgs = (typeof globalChats !== 'undefined' && globalChats[x.id]) || [];
            for (let i = msgs.length - 1; i >= 0; i--) {
                const m = msgs[i]; if (!m || m.sender === 'system') continue;
                if (!best || (m.timestamp || 0) > (best.m.timestamp || 0)) best = { x, m };
                break;
            }
        });
        return best;
    }
    function plain(t, cid) {
        let s = String(t || '');
        try { if (typeof gyExtractChatStatus === 'function') s = gyExtractChatStatus(s, cid).rest || s; } catch (e) {}
        return s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
    // 桌面怎么画在 js/63（能加小组件、换图标、拖着排、分好几页）
    function renderHome() { try { if (typeof window.gyPmHomeRender === 'function') window.gyPmHomeRender(); } catch (e) { console.warn('[小手机] 桌面画不出来：', e); } }

    /* ---------------- 打开 App ---------------- */
    const appOf = k => APPS.find(a => a[0] === k);
    function setTitle(t) { S.title = t || ''; const el = document.getElementById('gyPmT'); if (el) el.textContent = S.title; }
    function viewTitle(v) {
        if (v === 'chat') {
            let sid = null; try { sid = currentChatSessionId; } catch (e) {}
            const s = sid != null && !(typeof chatListShowingList !== 'undefined' && chatListShowingList) ? sessOf(sid) : null;
            return s ? (s.remark || s.name) : '聊天';
        }
        try { if (typeof mobileViewTitles !== 'undefined' && mobileViewTitles[v]) return mobileViewTitles[v]; } catch (e) {}
        return '';
    }
    function enterApp() {
        document.body.classList.add('gyphm-app');
        tickSb();
    }
    /* ---- 像真的 App 一样：自己的返回栈；在最外层没有返回键，回桌面靠底下那条小横杠 ---- */
    S.stack = []; S.nav = false; S.native = null;
    const chatOpen = () => { const a = document.getElementById('chatInputArea'); return S.view === 'chat' && !!a && a.style.display !== 'none'; };
    function canBack() {
        if (S.native) return !!(S.native.back && S.native.back.can && S.native.back.can());
        if (chatOpen()) return true;
        return S.stack.length > 1;
    }
    function syncNav() {
        const l = document.querySelector('#gyPmBar .nav .l'); if (!l) return;
        // 能往回退就是「‹」；已经在最外层就换成回桌面的小方格——任何时候顶上都有出口
        const b = canBack();
        l.style.visibility = 'visible';
        l.classList.remove('home');
        l.innerHTML = svg('back', 2.2);   // 一直是「‹」：能往回退就退一层，已经在最外层就回桌面
        l.title = b ? '返回' : '回桌面';
        if (!S.native && S.view === 'chat') setTitle(viewTitle('chat'));
    }
    window.gyPmBack = function () {
        if (S.native) { if (S.native.back && S.native.back.can && S.native.back.can()) S.native.back.go(); else window.gyPmHome(); syncNav(); return; }
        if (chatOpen()) { try { if (typeof window.gyChatBack === 'function') window.gyChatBack(); else if (typeof backToContactList === 'function') backToContactList(); } catch (e) {} setTimeout(syncNav, 30); return; }
        if (S.stack.length > 1) {
            S.stack.pop(); const prev = S.stack[S.stack.length - 1];
            S.nav = true; try { switchMainView(prev.v, prev.p); } catch (e) {} S.nav = false;
            setTitle(prev.t || viewTitle(prev.v)); syncNav(); return;
        }
        window.gyPmHome();
    };
    // 打开的那一下：从图标的位置放大出来
    // 打开的那一下：动画可以在「美化 → 打开 App 的方式」里选
    const FX = {
        zoom: [[{ transform: 'scale(.12)', opacity: 0, borderRadius: '40px' }, { transform: 'none', opacity: 1 }], 340, 'cubic-bezier(.2,.85,.25,1)', 'icon'],
        slide: [[{ transform: 'translateY(100%)' }, { transform: 'none' }], 380, 'cubic-bezier(.2,.85,.25,1)', 'screen'],
        push: [[{ transform: 'translateX(100%)', boxShadow: '-12px 0 30px rgba(0,0,0,.12)' }, { transform: 'none', boxShadow: 'none' }], 360, 'cubic-bezier(.25,.8,.3,1)', 'screen'],
        fade: [[{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], 260, 'ease-out', 'center'],
        pop: [[{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1.03)', offset: .7 }, { transform: 'none' }], 420, 'cubic-bezier(.3,1.3,.5,1)', 'center'],
        flip: [[{ opacity: 0, transform: 'perspective(1200px) rotateY(-80deg)' }, { opacity: 1, transform: 'perspective(1200px) rotateY(0)' }], 480, 'cubic-bezier(.2,.8,.25,1)', 'center'],
        card: [[{ opacity: 0, transform: 'translateY(60px) scale(.92)', borderRadius: '28px' }, { opacity: 1, transform: 'none' }], 380, 'cubic-bezier(.2,.85,.25,1)', 'center'],
        none: null
    };
    window.__gyPmFX = FX;
    function zoomFrom(key, fxName) {
        try {
            const fx = FX[fxName || (typeof window.gyPmOpenFx === 'function' ? window.gyPmOpenFx() : 'zoom')] || FX.zoom;
            if (!fx || !Element.prototype.animate) return;
            let cx, cy;
            const ic = document.querySelector(`#gyPmHome [data-pmapp="${key}"] .pm-ic`);
            if (fx[3] === 'icon' && ic && ic.offsetParent !== null) { const r = ic.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
            else { const r = scrRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
            requestAnimationFrame(() => {
                ['gyPmBar', 'gyPmApp'].map(id => document.getElementById(id)).concat([document.querySelector('.main-content')]).forEach(el => {
                    if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
                    const b = el.getBoundingClientRect(); if (!b.width) return;
                    el.style.transformOrigin = fx[3] === 'screen' ? '' : `${cx - b.left}px ${cy - b.top}px`;
                    el.animate(fx[0], { duration: fx[1], easing: fx[2] });
                });
            });
        } catch (e) {}
    }
    window.gyPmPreviewFx = function (name) { enterApp(); zoomFrom('set', name); setTimeout(() => { if (!S.app && !S.native && S.stack.length === 0) window.gyPmHome(); }, 900); };

    /* ---------------- 🪟 小窗：App 缩成小窗口浮在桌面上，可以拖，里面照样能点 ---------------- */
    const F = { on: false, x: 0, y: 0, s: .42 };
    const flEls = () => ['gyPmBar', 'gyPmApp'].map(id => document.getElementById(id)).concat([document.querySelector('.main-content')]).filter(el => el && getComputedStyle(el).display !== 'none');
    function scrRect() {
        const r = document.documentElement.style, n = k => parseFloat(r.getPropertyValue(k));
        const sl = n('--pm-sl') || 0, st = n('--pm-st') || 0, sw = n('--pm-sw') || 0, sh = n('--pm-sh') || 0;
        return { left: isDesk() ? sl : 0, top: isDesk() ? st : 0, width: isDesk() ? sw : innerWidth, height: isDesk() ? sh : innerHeight };
    }
    function flApply() {
        const r = scrRect(), w = r.width * F.s, h = r.height * F.s;
        F.x = Math.max(r.left + 6, Math.min(r.left + r.width - w - 6, F.x)); F.y = Math.max(r.top + 40, Math.min(r.top + r.height - h - 10, F.y));
        flEls().forEach(el => { el.style.transform = `translate(${F.x - r.left}px,${F.y - r.top}px) scale(${F.s})`; });
        const fl = document.getElementById('gyPmFloat');
        if (fl) Object.assign(fl.style, { left: F.x + 'px', top: F.y + 'px', width: w + 'px', height: h + 'px' });
    }
    function flClear() {
        flEls().concat([document.querySelector('.main-content')]).forEach(el => { if (el) { el.style.transform = ''; el.style.transformOrigin = ''; } });
    }
    window.gyPmFloat = function (on, instant) {
        if (!document.body.classList.contains('gyphm')) return;
        if (on) {
            if (!document.body.classList.contains('gyphm-app') || F.on) return;
            closeSheet();
            let fl = document.getElementById('gyPmFloat');
            if (!fl) {
                fl = document.createElement('div'); fl.id = 'gyPmFloat';
                fl.innerHTML = '<div class="fr"></div><div class="gb"><i data-fl="max" title="放大">⤢</i><b></b><i data-fl="x" title="关掉">✕</i></div>';
                document.body.appendChild(fl); flBind(fl);
            }
            const r = scrRect();
            flEls().forEach(el => { const b = el.getBoundingClientRect(); el.style.transformOrigin = `${r.left - b.left}px ${r.top - b.top}px`; el.style.transform = 'none'; });
            F.on = true; document.body.classList.add('gyphm-float');
            void document.body.offsetWidth;
            F.x = r.left + r.width * (1 - F.s) - 12; F.y = r.top + r.height * (1 - F.s) - 118;
            flApply(); renderHome();
            return;
        }
        if (!F.on) return;
        F.on = false;
        const done = () => { document.body.classList.remove('gyphm-float', 'pm-fl-drag'); flClear(); };
        if (instant) { done(); return; }
        flEls().forEach(el => { el.style.transform = 'none'; });
        setTimeout(done, 390);
    };
    window.gyPmFloatOn = () => F.on;
    function flBind(fl) {
        const gb = fl.querySelector('.gb'); let d = null;
        gb.addEventListener('pointerdown', e => { if (e.target.closest('[data-fl]')) return; d = { x: e.clientX - F.x, y: e.clientY - F.y, id: e.pointerId }; document.body.classList.add('pm-fl-drag'); try { gb.setPointerCapture(e.pointerId); } catch (er) {} });
        gb.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; F.x = e.clientX - d.x; F.y = e.clientY - d.y; flApply(); });
        const up = () => { if (!d) return; d = null; document.body.classList.remove('pm-fl-drag'); const r = scrRect(), w = r.width * F.s; F.x = (F.x + w / 2 < r.left + r.width / 2) ? r.left + 12 : r.left + r.width - w - 12; flApply(); };
        gb.addEventListener('pointerup', up); gb.addEventListener('pointercancel', up);
        gb.addEventListener('click', e => { const b = e.target.closest('[data-fl]'); if (!b) return; if (b.dataset.fl === 'max') window.gyPmFloat(false); else { window.gyPmFloat(false, true); window.gyPmHome(); } });
        gb.addEventListener('dblclick', () => window.gyPmFloat(false));
    }
    function closeNative() { const n = document.getElementById('gyPmApp'); if (n) { n.innerHTML = ''; n.classList.remove('on'); } S.native = null; document.body.classList.remove('gyphm-native'); }
    // 小手机自己的「原生 App」（日历这种）：盖在屏幕里，跟白露的页面一样有顶栏和返回
    window.gyPmNative = function (title, html, opts) {
        const n = document.getElementById('gyPmApp'); if (!n) return null;
        if (F.on) window.gyPmFloat(false, true);
        enterApp(); document.body.classList.add('gyphm-native');
        S.native = { back: opts && opts.back };
        n.innerHTML = html; n.classList.add('on'); n.scrollTop = 0;
        setTitle(title); syncNav();
        return n;
    };
    window.gyPmOpen = function (key) {
        const a = appOf(key); if (!a) return;
        const j = a[4];
        if (F.on && !j.sheet && !(j.fn && !j.native)) window.gyPmFloat(false, true);   // 开别的 App：小窗先收起来
        if (j.sheet) { if (typeof window.gyPmBeauty === 'function') window.gyPmBeauty(); return; }
        // 弹窗类（相册、账单）：直接盖在桌面上，不用进 App
        if (j.fn && !j.native) { try { window[j.fn].apply(null, j.args || []); } catch (e) { console.warn('[小手机] 打开失败：', e); } return; }
        closeNative();
        if (j.native) { try { window[j.fn].apply(null, j.args || []); } catch (e) { console.warn('[小手机] 打开失败：', e); } zoomFrom(key); return; }
        enterApp(); setTitle(a[1]); S.stack = []; S.app = key;
        S.nav = true;
        try {
            if (j.today) {
                if (typeof window.gyTodaySet === 'function' && !(window.gyTodayRead && window.gyTodayRead().on)) window.gyTodaySet(true);
                if (typeof window.gyTodayRender === 'function') window.gyTodayRender();
                if (typeof openMobileTrendsView === 'function') openMobileTrendsView();
                S.view = 'today';
            } else if (j.feature && typeof gyOpenFeaturePage === 'function') gyOpenFeaturePage(j.feature);
            else if (j.view === 'chat') {
                switchMainView('chat');
                // 聊天 App 从联系人那一层开始（跟真的打开一个 App 一样，不直接掉进上次那个人）
                if (chatOpen()) { try { if (typeof window.gyChatBack === 'function') window.gyChatBack(); } catch (e) {} }
            }
            else if (j.view) switchMainView(j.view, j.param);
        } catch (e) { console.warn('[小手机] 打开失败：', e); }
        S.nav = false;
        const t = j.today ? '今天' : (j.feature ? a[1] : (viewTitle(S.view) || a[1]));
        setTitle(t); S.stack = [{ v: j.today ? 'today' : (j.feature ? 'featurePage' : S.view), p: j.param, t }];
        syncNav();
        try { document.querySelector('.main-content').scrollTop = 0; } catch (e) {}
        zoomFrom(key);
    };
    window.gyPmOpenChat = function (id) {
        if (F.on) window.gyPmFloat(false, true);
        closeNative(); enterApp();
        S.nav = true;
        try { switchMainView('chat'); switchChatSession(String(id)); } catch (e) {}
        S.nav = false;
        S.stack = [{ v: 'chat', t: '聊天' }];
        const s = sessOf(id); setTitle(s ? (s.remark || s.name) : '聊天'); syncNav();
        zoomFrom('chat');
    };
    window.gyPmHome = function () {
        if (F.on) window.gyPmFloat(false, true);
        closeSheet(); closeNative();
        const was = document.body.classList.contains('gyphm-app');
        document.body.classList.remove('gyphm-app');
        S.stack = [];
        renderHome();
        if (was) { try { const h = document.getElementById('gyPmHome'); h.animate([{ transform: 'scale(1.08)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.85,.25,1)' }); } catch (e) {} }
    };
    window.gyPmSyncNav = syncNav;

    function closeSheet() { const sh = document.getElementById('gyPmSheet'); if (sh) sh.classList.remove('on'); }
    window.gyPmCloseSheet = closeSheet;
    window.gyPmSheet = function (html) {
        const sh = document.getElementById('gyPmSheet'); if (!sh) return null;
        const again = sh.classList.contains('on');   // 已经开着（比如点了个选项又重画）就别再从底下弹一次
        sh.innerHTML = `<div class="box${again ? ' still' : ''}">${html}</div>`; sh.classList.add('on'); return sh;
    };

    /* ---------------- 🔔 通知中心：从顶上的状态栏往下拉（或点一下状态栏）----------------
       手机上为了不跟系统的下拉 / 浏览器的下拉刷新打架：
       · 只认从「小手机自己的状态栏」开始的下拉（它在系统状态栏下面，不在屏幕最顶上那条边）
       · 状态栏上关掉浏览器自己的手势（touch-action:none），整页也关掉下拉刷新（overscroll-behavior）
       · 还可以直接点一下状态栏，或者点状态栏下面那颗小横条，不用拉也能打开 */
    const NCI = { chat: 'chat', post: 'home', diary: 'diary', letter: 'diary', theater: 'theater', mall: 'bag', music: 'music', film: 'film', today: 'today', profile: 'people', forum: 'forum', anon: 'mask' };
    function ncIcon(n) {
        const j = n.jump || {};
        let k = 'bell';
        if (j.chat != null || n.chatCharId) k = 'chat';
        else if (n.postId || j.view === 'home' || j.view === 'postDetail') k = 'home';
        else if (j.diary != null || j.view === 'diary') k = 'diary';
        else if (j.view && NCI[j.view]) k = NCI[j.view];
        else if (j.view === 'novel') k = 'forum'; else if (j.view === 'anonForum') k = 'mask';
        else if (j.feature === 'music') k = 'music'; else if (j.today) k = 'today';
        else if (j.fn && /phone/i.test(j.fn)) k = 'chat';
        return svg(k, 1.8);
    }
    // 通知里只写了「谁做了什么」，这里把具体内容也带出来：聊天就是那句话、推文就是那条推文……
    function ncDetail(n) {
        try {
            const j = n.jump || {};
            const cid = n.chatCharId != null ? n.chatCharId : (j.chat != null ? j.chat : null);
            if (cid != null) {
                const msgs = (typeof globalChats !== 'undefined' && globalChats[cid]) || [];
                for (let k = msgs.length - 1; k >= 0; k--) { const m = msgs[k]; if (m && m.sender !== 'system' && m.sender !== 'me') return plain(m.text || (m.img || m.image ? '[图片]' : ''), cid).slice(0, 200); }
            }
            const pid = n.postId || (j.view === 'postDetail' ? j.param : null);
            if (pid) { const p = (typeof globalPosts !== 'undefined' ? globalPosts : []).find(x => String(x.id) === String(pid)); if (p) return plain(p.text, p.char && p.char.id).slice(0, 200); }
            if (n.desc) return String(n.desc).replace(/<[^>]+>/g, '').slice(0, 200);
        } catch (e) {}
        return '';
    }
    function ncHtml() {
        const d = new Date();
        try { if (typeof window.gyNotifEnsureIds === 'function') window.gyNotifEnsureIds(); } catch (e) {}
        let list = []; try { list = (typeof globalNotifications !== 'undefined' ? globalNotifications : []).slice(0, 60); } catch (e) {}
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        const card = (n, i) => { const det = ncDetail(n); return `<div class="nc-n" data-nid="${esc(String(n.id || ''))}" onclick="gyPmNCGo('${String(n.id || '').replace(/[^\w-]/g, '')}')"><span class="ic">${ncIcon(n)}</span><div class="tx"><div class="hd"><b>${esc(String(n.text || '').replace(/<[^>]+>/g, ''))}</b><em>${(() => { try { return timeAgo(n.timestamp); } catch (e) { return ''; } })()}</em></div>${det ? `<p>${esc(det)}</p>` : ''}</div></div>`; };
        const tod = [], old = [];
        list.forEach((n, i) => ((n.timestamp || 0) >= today0.getTime() ? tod : old).push(card(n, i)));
        return `<div class="nc-in">
            <div class="nc-sb">${sbHtml()}</div>
            <div class="nc-bar"><b>通知中心</b><span><i onclick="gyPmNCAll()">全部</i><i onclick="gyPmNCRead()">已读</i><i onclick="gyPmNC(false);gyPmLockNow()" title="锁屏">${svg('lock', 2)}</i></span></div>
            <div class="nc-list">${list.length ? (tod.length ? `<div class="nc-h">今天</div>${tod.join('')}` : '') + (old.length ? `<div class="nc-h">更早</div>${old.join('')}` : '') : '<div class="nc-empty">没有新通知</div>'}</div>
            <div class="nc-grab" onclick="gyPmNC(false)"><i></i></div></div>`;
    }
    window.gyPmNC = function (open) {
        const nc = document.getElementById('gyPmNC'); if (!nc) return;
        if (open === false) { nc.classList.remove('on', 'drag'); nc.style.transform = ''; return; }
        nc.innerHTML = ncHtml(); nc.classList.remove('drag'); nc.style.transform = ''; nc.classList.add('on');
        try { unreadNotifs = 0; if (typeof updateNotifBadge === 'function') updateNotifBadge(); } catch (e) {}
    };
    // 按通知 id 找（不再按列表下标——通知中心开着时又来一条，下标全错位，点了跳到别人那儿去）。
    // 老调用传数字下标也还认。
    window.gyPmNCGo = function (key) {
        let n = null;
        try {
            const all = (typeof globalNotifications !== 'undefined' ? globalNotifications : []);
            if (typeof key === 'number') n = all[key];
            else n = (typeof window.gyNotifFind === 'function') ? window.gyNotifFind(key) : all.find(x => x && String(x.id) === String(key));
        } catch (e) {}
        window.gyPmNC(false);
        closeNative(); enterApp(); S.stack = [];
        try {
            if (!n) switchMainView('notifications');
            else if (typeof window.gyOpenNotif === 'function') window.gyOpenNotif(n);
            else if (n.jump && typeof window.gyJump === 'function') window.gyJump(n.jump);
            else if (n.chatCharId) { switchMainView('chat'); switchChatSession(String(n.chatCharId)); }
            else if (n.postId) switchMainView('postDetail', n.postId);
            else if (n.feature && typeof gyOpenFeaturePage === 'function') gyOpenFeaturePage(n.feature);
            else if (n.view) switchMainView(n.view, n.param);
            else switchMainView('notifications');
        } catch (e) {}
        setTimeout(syncNav, 80);
    };
    window.gyPmNCAll = function () { window.gyPmNC(false); closeNative(); enterApp(); S.stack = []; try { switchMainView('notifications'); } catch (e) {} setTitle('通知'); syncNav(); };
    window.gyPmNCRead = function () { try { unreadNotifs = 0; if (typeof updateNotifBadge === 'function') updateNotifBadge(); } catch (e) {} window.gyPmNC(true); renderHome(); };
    // 拉的手势：状态栏按下 → 往下拉，通知中心跟着手指下来；松手拉过一小段就打开，没拉够就缩回去；只点了一下也打开
    function ncGesture() {
        const D = { on: false, y: 0, t: 0, dy: 0, id: null };
        const H = () => (document.getElementById('gyPmNC') || {}).offsetHeight || 700;
        document.addEventListener('pointerdown', e => {
            if (!window.gyPmIsOn()) return;
            const sb = e.target.closest('#gyPmHome .pm-sb, #gyPmBar .pm-sb, .pm-ncgrab');
            if (!sb || e.target.closest('.pm-lock') || document.body.classList.contains('gyphm-edit')) return;
            D.on = true; D.y = e.clientY; D.t = Date.now(); D.dy = 0; D.id = e.pointerId;
            const nc = document.getElementById('gyPmNC'); nc.innerHTML = ncHtml(); nc.classList.add('drag');
            nc.style.transform = `translateY(-100%)`;
            try { sb.setPointerCapture(e.pointerId); } catch (er) {}
            e.preventDefault();
        }, true);
        document.addEventListener('pointermove', e => {
            if (!D.on || e.pointerId !== D.id) return;
            D.dy = Math.max(0, e.clientY - D.y);
            const nc = document.getElementById('gyPmNC'); if (nc) nc.style.transform = `translateY(${Math.min(0, -H() + D.dy)}px)`;
        }, true);
        const end = e => {
            if (!D.on || (e && e.pointerId !== D.id)) return;
            D.on = false;
            const tap = D.dy < 6 && Date.now() - D.t < 400;
            if (tap || D.dy > 60) window.gyPmNC(true); else window.gyPmNC(false);
        };
        document.addEventListener('pointerup', end, true);
        document.addEventListener('pointercancel', end, true);
        // 在通知中心里往上划：跟着手指往上收；划过一小段就收回去（在列表里的话，要列表已经滚到底才算）
        const U = { on: false, y: 0, dy: 0, moved: false, id: null };
        document.addEventListener('pointerdown', e => {
            const nc = e.target.closest && e.target.closest('#gyPmNC.on'); if (!nc) return;
            const list = e.target.closest('.nc-list');
            if (list && list.scrollTop + list.clientHeight < list.scrollHeight - 2) return;
            U.on = true; U.y = e.clientY; U.dy = 0; U.moved = false; U.id = e.pointerId;
        }, true);
        document.addEventListener('pointermove', e => {
            if (!U.on || e.pointerId !== U.id) return;
            U.dy = Math.min(0, e.clientY - U.y);
            if (U.dy < -8) { U.moved = true; const nc = document.getElementById('gyPmNC'); nc.classList.add('drag'); nc.style.transform = `translateY(${U.dy}px)`; }
        }, true);
        const upEnd = e => {
            if (!U.on || (e && e.pointerId !== U.id)) return;
            U.on = false; const nc = document.getElementById('gyPmNC'); if (!nc) return;
            nc.classList.remove('drag');
            if (U.moved) {
                if (U.dy < -70) window.gyPmNC(false); else nc.style.transform = '';
                // 划动之后别再当成点了一条通知
                const stop = ev => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', stop, true); };
                document.addEventListener('click', stop, true); setTimeout(() => document.removeEventListener('click', stop, true), 60);
            }
        };
        document.addEventListener('pointerup', upEnd, true);
        document.addEventListener('pointercancel', upEnd, true);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('#gyPmNC.on')) { e.stopImmediatePropagation(); window.gyPmNC(false); } }, true);
    }

    // 给 js/63（桌面）用的一些小工具
    window.__gyPm = { S, APPS, svg, tickSb: () => tickSb(), esc, av, chars, groups, sessOf, unread, lastChat, plain, sbHtml, pad, store, isDesk, closeSheet, enterApp: () => enterApp(), setTitle: t => setTitle(t) };

    /* ---------------- 开关 ---------------- */
    function paintEntry() { const sw = document.querySelector('#gyPmSetEntry .gypm-sw'); if (sw) sw.classList.toggle('on', isOn()); }
    window.gyPmSet = function (on, quiet) {
        on = !!on;
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
        if (on && typeof window.gyWxIsOn === 'function' && window.gyWxIsOn()) { try { window.gyWxSet(false, true); } catch (e) {} }
        mount();
        document.body.classList.toggle('gyphm', on);
        document.body.classList.remove('gyphm-app');
        layout();
        try { if (on) { if (window.gymWxCollapse) window.gymWxCollapse(); } else if (window.gymWxRestore && !(window.gyWxIsOn && window.gyWxIsOn())) window.gymWxRestore(); } catch (e) {}
        if (on) { if (window.gyPmLockNow) window.gyPmLockNow(); else renderHome(); } else { closeSheet(); if (window.gyPmEdit) window.gyPmEdit(false); ['gyphm-desk', 'gyphm-mob'].forEach(c => document.body.classList.remove(c)); }
        paintEntry();
        if (!quiet && typeof showToast === 'function') { try { showToast('', on ? '📱 已切到小手机模式' : '🌾 已切回白露', on ? '点图标打开，底下小横杠回桌面' : '', null, null, false); } catch (e) {} }
    };
    window.gyPmIsOn = () => document.body.classList.contains('gyphm');

    function addEntry() {
        if (document.getElementById('gyPmSetEntry')) return;
        const anchor = document.querySelector('.set-entry[onclick*="openSettingsPanel(\'appearance\')"]');
        if (!anchor) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.id = 'gyPmSetEntry'; b.setAttribute('data-core', '1');
        b.innerHTML = `<span class="set-entry-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg></span>
            <span class="set-entry-main"><span class="set-entry-title">小手机模式</span><span class="set-entry-desc">整个白露变成一台手机：桌面、图标、小组件，点图标进功能（跟微信模式二选一）</span></span>
            <span class="gypm-sw"></span>`;
        b.onclick = () => window.gyPmSet(!isOn());
        anchor.parentNode.insertBefore(b, anchor);
        paintEntry();
    }

    /* ---------------- 跟着白露走 ---------------- */
    function hooks() {
        const wrap = (name, after) => {
            const f = window[name];
            if (typeof f !== 'function' || f.__gyPm) return;
            const w = function () { const r = f.apply(this, arguments); try { after.apply(null, arguments); } catch (e) {} return r; };
            w.__gyPm = true; window[name] = w;
        };
        wrap('switchMainView', (v, prm) => {
            S.view = v;
            if (v === 'settings') setTimeout(() => { addEntry(); paintEntry(); }, 0);
            if (!window.gyPmIsOn()) return;
            // 从通知 / 弹窗里跳到别的页面：直接进 App 状态，不然新页面被桌面挡着
            if (window.__gyPmReady && !document.body.classList.contains('gyphm-app')) { enterApp(); S.stack = []; }
            if (S.native) closeNative();
            const t = viewTitle(v); if (t && v !== 'featurePage') setTitle(t);
            // 在 App 里又点进了别的页面（主页点头像进资料、设置点进某一页……）：记一层，顶上出现「‹」
            if (!S.nav) { const top = S.stack[S.stack.length - 1]; if (!top || top.v !== v || String(top.p) !== String(prm)) S.stack.push({ v, p: prm, t: (v === 'featurePage' ? S.title : t) }); }
            syncNav();
        });
        wrap('switchChatSession', id => { if (window.gyPmIsOn()) { const s = sessOf(id); if (s) setTitle(s.remark || s.name); syncNav(); } });
        wrap('backToContactList', () => { if (window.gyPmIsOn()) { setTitle('聊天'); syncNav(); } });
        wrap('gyChatBack', () => { if (window.gyPmIsOn()) setTimeout(syncNav, 20); });
        wrap('renderChatCharList', () => { if (window.gyPmIsOn() && !document.body.classList.contains('gyphm-app') && !document.body.classList.contains('gyphm-edit')) renderHome(); });
    }

    async function boot() {
        mount(); hooks(); addEntry();
        try { if (typeof window.gyPmHomeLoad === 'function') await window.gyPmHomeLoad(); } catch (e) {}
        if (isOn()) {
            if (typeof window.gyWxIsOn === 'function' && window.gyWxIsOn()) { try { window.gyWxSet(false, true); } catch (e) {} }
            document.body.classList.add('gyphm'); layout(); if (window.gyPmLockNow) window.gyPmLockNow(); else renderHome();
            try { if (window.gymWxCollapse) window.gymWxCollapse(); } catch (e) {}
        }
        ncGesture();
        setTimeout(() => { window.__gyPmReady = true; }, 2500);
        // 电脑上按 Esc：跟点左上角一样（有上一层回上一层，没有就回桌面）
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !window.gyPmIsOn() || !document.body.classList.contains('gyphm-app')) return;
            if ([...document.querySelectorAll('.modal-overlay')].some(m => getComputedStyle(m).display !== 'none')) return;
            window.gyPmBack();
        });
        let rt = null;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.gyPmIsOn()) { layout(); if (!document.body.classList.contains('gyphm-app') && !document.body.classList.contains('gyphm-edit')) renderHome(); } }, 120); });
        setInterval(() => {
            if (!window.gyPmIsOn()) return;
            tickSb();
            if (!document.body.classList.contains('gyphm-app') && !document.body.classList.contains('gyphm-edit')) renderHome();
        }, 30000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
