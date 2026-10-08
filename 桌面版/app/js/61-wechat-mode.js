/* ===========================================================================
   js/61 —— 💬 微信模式（设置里一键切换，数据还是同一份）
   ---------------------------------------------------------------------------
   开关只放在「设置」首页那一条（💬 微信模式），切过去以后：

   🖥️ 电脑端 —— 照电脑版微信（4.x 新版）排：
      · 最左一条窄侧栏：头像 / 聊天 / 通讯录 / 朋友圈 / 小程序（各个功能）……最底下 ≡ 菜单（通知、设置、切回白露）
      · 第二栏：搜索框 + ＋（发起群聊）+ 会话列表（选中的那条是微信绿）；通讯录 / 小程序时换成对应列表
      · 右边一大块：聊天就用白露原来的聊天页，换成电脑微信的样子（白底、TA 浅灰我绿、名字靠左、
        输入框在下、功能键收在左下、「发送」在右下）；通讯录点人 → 右边出资料卡；什么都没选 → 灰底一个大 logo
      · 朋友圈：跟电脑微信一样弹一个单独的窄窗口

   📱 手机端 —— 照手机微信排：
      · 顶上标题 + ⊕，搜索条，底下四个标签 微信 / 通讯录 / 发现 / 我
      · 点进聊天或任何功能：顶上换成微信那条「‹  标题  ···」，‹ 回到微信；白露自己的顶栏/底栏都收起来
      · 聊天页：灰底、我绿 TA 白、方头像

   不改任何数据、不动原有界面逻辑；关掉就原样回来。开关存在 localStorage('gyWxMode')。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyWxLoaded) return;
    window.__gyWxLoaded = true;

    const KEY = 'gyWxMode';
    const S = { tab: 'chats', sub: null, pane: 'welcome', card: null, q: '', view: null };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const groups = () => (typeof groupChats !== 'undefined' && Array.isArray(groupChats)) ? groupChats : [];
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const sessOf = id => groups().find(g => String(g.id) === String(id)) || charOf(id);
    const av = (x, n) => { try { return x && x.members ? getGroupAvatarHTML(x, n) : getAvatarHTML(x, n); } catch (e) { return ''; } };
    const ago = t => { try { return t ? timeAgo(t) : ''; } catch (e) { return ''; } };
    const isOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
    const isDesk = () => window.innerWidth > 900;
    const me = () => (typeof currentUser !== 'undefined' ? currentUser : { name: '我' });
    const curSid = () => { try { return currentChatSessionId == null ? null : String(currentChatSessionId); } catch (e) { return null; } };

    /* ---------------- 图标（线稿，跟着颜色走） ---------------- */
    const I = {
        chat: '<svg viewBox="0 0 24 24"><path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.4 1.3 4.6 3.3 6L5.6 20l3.6-1.9c.9.2 1.8.4 2.8.4 5.1 0 9-3.5 9-7.8S17.1 3 12 3z"/></svg>',
        contacts: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
        discover: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
        me: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/><path d="M9 8h6" opacity="0"/></svg>',
        moments: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v6M21 12h-6M12 21v-6M3 12h6M5.6 5.6l4.3 4.3M18.4 5.6l-4.3 4.3M18.4 18.4l-4.3-4.3M5.6 18.4l4.3-4.3"/></svg>',
        apps: '<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/></svg>',
        today: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
        theater: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
        menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
        plus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
        search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
        back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
        more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
        camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
        close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        logo: '<svg viewBox="0 0 64 64"><path d="M25 10C13.4 10 4 17.8 4 27.4c0 5.4 3 10.2 7.6 13.4L10 46l6.1-3.2c2.8.9 5.8 1.4 8.9 1.4.6 0 1.1 0 1.7-.1-.4-1.4-.6-2.9-.6-4.4C26.1 30.6 34.9 23 45.7 23c.6 0 1.2 0 1.8.1C45.6 15.6 36.2 10 25 10z"/><path d="M60 39.6C60 31.5 52.1 25 42.4 25s-17.6 6.5-17.6 14.6 7.9 14.6 17.6 14.6c2.3 0 4.5-.4 6.6-1.1L54 56l-1.3-4.4c4.4-2.7 7.3-7 7.3-12z"/></svg>'
    };

    /* ---------------- 样式 ---------------- */
    const CSS = `
#gyWx{position:fixed;z-index:2000;display:none;font-family:-apple-system,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;color:#191919;-webkit-font-smoothing:antialiased}
#gyWx svg,#gyWxBar svg,#gyWxPane svg,#gyWxMo svg,#gyWxMenu svg,#gyWxTodayX svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
body.gywx #gyWx{display:flex}
#gyWx .wx-av,#gyWxPane .wx-av,#gyWxMo .wx-av{position:relative;flex-shrink:0;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff}
#gyWx .wx-av>*:not(.wx-red),#gyWxPane .wx-av>*,#gyWxMo .wx-av>*{border-radius:6px!important;width:100%!important;height:100%!important;margin:0!important;border:none!important;box-shadow:none!important}
.wx-red{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#fa5151;color:#fff;font-size:10px;line-height:16px;text-align:center;padding:0 4px;z-index:2;font-style:normal}
.wx-red.dot{min-width:9px;width:9px;height:9px;padding:0;top:-3px;right:-3px}
.wx-empty{text-align:center;color:#b2b2b2;font-size:14px;padding:60px 20px}
/* 通用：一格一格的白条 */
.wx-row{display:flex;align-items:center;gap:14px;padding:0 16px;height:56px;background:#fff;cursor:pointer;font-size:16px;position:relative}
.wx-row:active{background:#ececec}
.wx-row+.wx-row::before{content:"";position:absolute;top:0;left:54px;right:0;border-top:1px solid #efefef}
.wx-row .ic{width:24px;text-align:center;font-size:21px;line-height:1}
.wx-row .t{flex:1} .wx-row .ar{color:#c4c4c4;font-size:20px}
.wx-gap{height:8px}

/* =================== 📱 手机 =================== */
body.gywx-mob #gyWx{inset:0;background:#ededed;flex-direction:column}
body.gywx-mob.gywx-away #gyWx{display:none}
body.gywx-mob #gyWx .wx-desk{display:none}
body.gywx-desk #gyWx .wx-mob{display:none!important}
#gyWx .wx-top{height:calc(48px + env(safe-area-inset-top));padding-top:env(safe-area-inset-top);flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative;font-size:17px;font-weight:600;background:#ededed}
#gyWx .wx-top .wx-l,#gyWx .wx-top .wx-r{position:absolute;bottom:0;height:48px;display:flex;align-items:center;gap:18px;padding:0 14px;font-size:16px;font-weight:400;cursor:pointer;color:#191919}
#gyWx .wx-top .wx-l{left:0} #gyWx .wx-top .wx-r{right:0}
#gyWx .wx-top.clear{position:absolute;top:0;left:0;right:0;z-index:3;background:transparent;color:#fff}
#gyWx .wx-top.clear .wx-l,#gyWx .wx-top.clear .wx-r{color:#fff}
#gyWx .wx-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;position:relative}
#gyWx .wx-srch{padding:0 8px 8px;background:#ededed}
#gyWx .wx-srch label{display:flex;align-items:center;justify-content:center;gap:6px;height:36px;border-radius:6px;background:#fff;color:#b2b2b2;font-size:15px}
#gyWx .wx-srch svg{width:17px;height:17px}
#gyWx .wx-srch input{border:none;outline:none;background:transparent;font-size:15px;color:#191919;width:100%;text-align:center;padding:0;box-shadow:none}
#gyWx .wx-srch input:focus{text-align:left}
#gyWx .wx-tabs{flex-shrink:0;display:flex;background:#f7f7f7;border-top:1px solid #dcdcdc;padding-bottom:env(safe-area-inset-bottom)}
#gyWx .wx-tab{flex:1;height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10.5px;color:#191919;cursor:pointer;position:relative;gap:3px}
#gyWx .wx-tab svg{width:26px;height:26px;stroke-width:1.5}
#gyWx .wx-tab.on{color:#07c160} #gyWx .wx-tab.on svg{fill:#07c160;stroke:#07c160}
#gyWx .wx-tab .wx-red{top:4px;right:auto;left:calc(50% + 6px)}
/* 会话 */
#gyWx .wx-cell{display:flex;align-items:center;gap:12px;padding:0 16px;height:72px;background:#fff;cursor:pointer;position:relative}
#gyWx .wx-cell:active{background:#ececec}
#gyWx .wx-cell+.wx-cell::before{content:"";position:absolute;top:0;left:76px;right:0;border-top:1px solid #efefef}
#gyWx .wx-cell.pin{background:#f7f7f7}
#gyWx .wx-cell .wx-av{width:48px;height:48px}
#gyWx .wx-mid{flex:1;min-width:0}
#gyWx .wx-n{font-size:16.5px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
#gyWx .wx-n b{font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gyWx .wx-n i{font-style:normal;font-size:11.5px;color:#b2b2b2;flex-shrink:0}
#gyWx .wx-p{font-size:13.5px;color:#a3a3a3;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gyWx .wx-hd{font-size:13px;color:#7f7f7f;padding:6px 16px;background:#ededed}
#gyWx .wx-cont{height:56px} #gyWx .wx-cont .wx-av{width:40px;height:40px}
#gyWx .wx-cont+.wx-cont::before{left:68px}
#gyWx .wx-ico{width:40px;height:40px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff}
#gyWx .wx-ico svg{width:24px;height:24px}
/* 我 */
#gyWx .wx-mehead{display:flex;align-items:center;gap:18px;padding:calc(40px + env(safe-area-inset-top)) 24px 36px;background:#fff;cursor:pointer}
#gyWx .wx-mehead .wx-av{width:64px;height:64px;border-radius:8px}
#gyWx .wx-mehead .nm{font-size:22px;font-weight:600}
#gyWx .wx-mehead .id{font-size:14px;color:#7f7f7f;margin-top:8px}
/* 资料卡（手机） */
#gyWx .wx-card,.wx-pcard{background:#fff;padding:20px 24px 26px;display:flex;gap:18px;align-items:flex-start}
#gyWx .wx-card .wx-av{width:64px;height:64px;border-radius:8px}
.wx-cname{font-size:21px;font-weight:600}
.wx-cmeta{font-size:13.5px;color:#7f7f7f;margin-top:6px;line-height:1.6}
.wx-cbtn{display:flex;align-items:center;justify-content:center;gap:8px;height:56px;background:#fff;color:#576b95;font-size:16.5px;font-weight:500;cursor:pointer;position:relative}
.wx-cbtn+.wx-cbtn::before{content:"";position:absolute;top:0;left:16px;right:0;border-top:1px solid #efefef}
.wx-cbtn svg{width:20px;height:20px}
/* 朋友圈 */
.wx-cover{height:300px;background:linear-gradient(160deg,#9cc3b3,#4f7f69);background-size:cover;background-position:center;position:relative;margin-bottom:40px}
.wx-cover .who{position:absolute;right:16px;bottom:-22px;display:flex;align-items:flex-end;gap:14px;color:#fff;font-weight:600;font-size:17px}
.wx-cover .who .wx-av{width:70px;height:70px;border-radius:8px}
.wx-cover .who b{margin-bottom:30px;text-shadow:0 1px 3px rgba(0,0,0,.35)}
.wx-mo{background:#fff;padding:14px 16px 12px;display:flex;gap:10px}
.wx-mo+.wx-mo{border-top:1px solid #efefef}
.wx-mo .wx-av{width:42px;height:42px}
.wx-mo .who{color:#576b95;font-size:15.5px;font-weight:600}
.wx-mo .tx{font-size:15.5px;margin-top:4px;word-break:break-word;line-height:1.5;color:#191919}
.wx-mo img{max-width:62%;max-height:240px;border-radius:2px;margin-top:8px;display:block}
.wx-mo .tm{font-size:12.5px;color:#b2b2b2;margin-top:8px;display:flex;justify-content:space-between;align-items:center}
.wx-mo .tm span{background:#f7f7f7;color:#576b95;border-radius:3px;padding:0 7px;font-weight:700;letter-spacing:1px}
.wx-mo .cm{background:#f7f7f7;margin-top:6px;padding:5px 8px;font-size:14px;line-height:1.65;border-radius:3px;color:#191919;position:relative}
.wx-mo .cm::before{content:"";position:absolute;top:-6px;left:12px;border:6px solid transparent;border-top:0;border-bottom-color:#f7f7f7}
.wx-mo .cm span{color:#576b95;font-weight:500}
/* 通讯录右边的字母索引 */
#gyWxIdx{position:absolute;right:2px;transform:translateY(-50%);z-index:5;display:flex;flex-direction:column;align-items:center;padding:4px 2px;touch-action:none;user-select:none;-webkit-user-select:none}
#gyWxIdx i{font-style:normal;font-size:10.5px;line-height:15.5px;width:16px;text-align:center;color:#555;cursor:pointer;border-radius:50%;font-weight:500}
#gyWxIdx i:not(.has){color:#b0b0b0}
#gyWxIdx i.on{background:#07c160;color:#fff}
#gyWxIdx .pop{position:absolute;right:30px;width:52px;height:52px;margin-top:-26px;border-radius:50% 50% 0 50%;transform:rotate(-45deg);background:#c9c9c9;display:none;align-items:center;justify-content:center;font-size:0}
#gyWxIdx .pop.on{display:flex}
#gyWxIdx .pop::after{content:attr(data-k);font-size:24px;color:#fff;transform:rotate(45deg)}
/* 资料页 */
.wx-prof{background:#ededed;min-height:100%}
.wx-prof .wx-card{padding-top:26px}
.wx-prow{display:flex;align-items:center;gap:12px;background:#fff;padding:14px 16px;cursor:pointer;border-top:1px solid #efefef}
.wx-prow:active{background:#ececec}
.wx-prow>div:first-child{flex:1;min-width:0}.wx-prow b{font-size:16.5px;font-weight:500;color:#191919;flex-shrink:0}
.wx-prow span{display:block;font-size:13.5px;color:#9a9a9a;margin-top:4px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wx-prow em{font-style:normal;color:#c4c4c4;font-size:20px}
.wx-prow.mo{border-top:none}.wx-prow.mo b{width:64px}
.wx-prow .th{flex:1;display:flex;gap:6px;min-width:0}
.wx-prow .th i{width:54px;height:54px;flex-shrink:0;background:#f2f2f2 center/cover;border-radius:2px;font-style:normal;font-size:10px;color:#666;padding:4px;box-sizing:border-box;overflow:hidden;line-height:1.35}
.wx-prow .th .none{font-size:14px;color:#b2b2b2}
.wx-cbtn.sub{color:#8a8a8a;font-size:14.5px;height:48px}
#gyWxPane .wx-pcw{padding:0;max-width:520px;margin:0 auto;background:#ededed;min-height:100%}
#gyWxPane .wx-pcw .wx-card{background:#fff;padding:30px 28px 26px;display:flex;gap:18px}
#gyWxPane .wx-pcw .wx-card .wx-av{width:64px;height:64px;border-radius:8px}
/* 朋友圈：点「··」出来的赞 / 评论 */
.wx-mo .tm{position:relative}.wx-mo .tm .more{cursor:pointer}
.wx-moact{position:absolute;right:34px;bottom:-6px;display:flex;background:#4c4c4c;border-radius:4px;overflow:hidden;z-index:3;animation:wxAct .15s ease-out}
.wx-moact span{color:#fff;font-size:14px;padding:8px 16px;cursor:pointer;white-space:nowrap}
.wx-moact span+span{border-left:1px solid #3a3a3a}
@keyframes wxAct{from{opacity:0;transform:translateX(12px)}}
.wx-mo .lk{background:#f7f7f7;margin-top:6px;padding:5px 8px;font-size:13.5px;color:#576b95;border-radius:3px}
.wx-mo .wx-av,.wx-mo .who{cursor:pointer}
/* 相册 */
.wx-cover.al{margin-bottom:12px}
.al-bio{text-align:right;color:#8a8a8a;font-size:13.5px;padding:18px 16px 18px 110px;min-height:10px;background:#fff}
.al-pin{display:flex;gap:16px;align-items:center;padding:16px;background:#fff;border-bottom:1px solid #efefef}
.al-pin b{font-size:22px;font-weight:600;width:70px;flex-shrink:0}
.al-pin .g{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;flex:1;max-width:220px}.al-pin .g i{aspect-ratio:1;background:#eee center/cover}
.al-list{background:#fff;padding:6px 0 30px;min-height:60vh}
.al-y{font-size:22px;font-weight:600;padding:18px 16px 6px}
.al-d{display:flex;gap:14px;padding:12px 16px}
.al-d .dl{width:74px;flex-shrink:0;line-height:1}
.al-d .dl b{font-size:28px;font-weight:700;color:#191919}.al-d .dl b.w{font-size:24px}
.al-d .dl small{font-size:13px;font-weight:600;margin-left:2px}
.al-d .its{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.al-i{display:flex;gap:10px;cursor:pointer;min-width:0}
.al-i .ph{width:88px;height:88px;flex-shrink:0;background:#f2f2f2 center/cover}
.al-i span{font-size:15px;line-height:1.5;color:#191919;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
.al-i.tx{background:#f3f3f3;padding:8px 10px}.al-i.tx span{-webkit-line-clamp:4}
.al-i.cam{width:88px;height:88px;background:#f3f3f3;align-items:center;justify-content:center;color:#c2c2c2}.al-i.cam svg{width:34px;height:34px}

/* 📱 点进去以后：顶上那条「‹ 标题 ···」 */
#gyWxBar{display:none;position:fixed;top:0;left:0;right:0;z-index:2001;height:calc(52px + var(--app-safe-top, env(safe-area-inset-top, 0px)));padding-top:var(--app-safe-top, env(safe-area-inset-top, 0px));background:#ededed;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:#191919;box-sizing:border-box;border-bottom:1px solid #e0e0e0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
body.gywx-mob.gywx-away #gyWxBar{display:flex}
#gyWxBar .t{max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gyWxBar .l,#gyWxBar .r{position:absolute;bottom:0;height:52px;display:flex;align-items:center;padding:0 10px;cursor:pointer}
#gyWxBar .l{left:0;gap:0;font-weight:400;font-size:16px} #gyWxBar .r{right:4px}
body.gywx-mob .mobile-bottom-nav{display:none!important}
body.gywx-mob .main-content{padding-bottom:env(safe-area-inset-bottom,0px)!important}
body.gywx-mob #view-chat{bottom:0!important}
body.gywx-mob #gyChatHead{display:none!important}
/* 顶上已经有「‹ 标题」了，页面自己那条「← 标题」就不再重复 */
body.gywx-mob .main-content .header-title:has(> .back-btn){display:none!important}
body.gywx-mob .mobile-topbar{visibility:hidden}
body.gywx-mob:not(.gywx-away){overflow:hidden}

/* 两端通用：聊天页换成微信的样子 */
body.gywx #chatTopBar,body.gywx #chatCharRow,body.gywx #chatListVertical{display:none!important}
body.gywx #view-chat .chat-bubble{border-radius:5px!important;box-shadow:none!important;border:none!important;overflow:visible!important;position:relative;color:#191919!important;font-size:15.5px}
body.gywx #view-chat .chat-bubble.me{background:#95ec69!important}
body.gywx #view-chat .chat-bubble.me::before,body.gywx #view-chat .chat-bubble.other::before{content:"";position:absolute;top:12px;width:9px;height:9px;transform:rotate(45deg);border-radius:1px}
body.gywx #view-chat .chat-bubble.me::before{right:-4px;background:inherit}
body.gywx #view-chat .chat-bubble.other::before{left:-4px}
body.gywx #view-chat .avatar{border-radius:5px!important;border:none!important}
body.gywx #view-chat .chat-msg-time{display:none!important}
body.gywx #chatSendBtn{background:#07c160!important;border-color:#07c160!important;color:#fff!important;box-shadow:none!important}
body.gywx #chatSendBtn:hover{background:#06ad56!important}
body.gywx-mob #view-chat{background:#ededed!important}
body.gywx-mob #view-chat .chat-bubble.other,body.gywx-mob #view-chat .chat-bubble.other::before{background:#fff!important}
body.gywx-mob #view-chat .chat-input-area{background:#f7f7f7!important;border-top:1px solid #dcdcdc!important}
body.gywx-mob #view-chat .chat-input-row input{background:#fff!important;border:none!important;border-radius:5px!important;box-shadow:none!important}
body.gywx-mob #chatSendBtn{border-radius:5px!important;padding:6px 14px!important;font-size:15px!important}

/* =================== 🖥️ 电脑 =================== */
body.gywx-desk #gyWx{top:0;left:0;bottom:0;width:336px;flex-direction:row;background:#f7f7f7;border-right:1px solid #e3e3e3}
body.gywx-desk .sidebar-left,body.gywx-desk .sidebar-right{display:none!important}
body.gywx-desk #mainLayoutContainer{margin-left:336px!important;max-width:none!important;justify-content:stretch!important}
body.gywx-desk .main-content{width:auto!important;flex:1 1 auto!important;border:none!important;max-width:none!important}
body.gywx-desk #mainLayoutContainer{background:#f5f5f5}
body.gywx-desk:not(.gywx-inchat) .main-content{max-width:min(100%, calc(var(--gy-main-w, 600px) + 160px))!important;margin:0 auto!important;background:#fff;border-left:1px solid #ececec!important;border-right:1px solid #ececec!important}
/* 电脑：「今天」面板从右边滑出来（白露右栏里那块，别的卡片先收着） */
body.gywx-desk.gywx-today .sidebar-right{display:block!important;position:fixed!important;top:0;right:0;bottom:0;width:380px!important;max-width:92vw;padding:48px 14px 20px!important;z-index:2100;background:#fff;box-shadow:-6px 0 30px rgba(0,0,0,.14);overflow-y:auto;overscroll-behavior:contain}
body.gywx-desk.gywx-today .sidebar-right-content{position:static!important}
body.gywx-desk.gywx-today .sidebar-right-content>*:not(#gyToday){display:none!important}
#gyWxTodayX{display:none;position:fixed;top:10px;right:14px;z-index:2101;width:32px;height:32px;border-radius:6px;align-items:center;justify-content:center;cursor:pointer;color:#5c5c5c;background:#f2f2f2;font-family:sans-serif}
#gyWxTodayX:hover{background:#e6e6e6}
#gyWxTodayX svg{width:18px!important;height:18px!important}
.wx-mo .tx details,.wx-mo .tx .gy-chat-status{max-width:100%;box-sizing:border-box;margin-top:8px}
.wx-mo .tx img{max-width:100%}
#gyWxTodayT{display:none;position:fixed;top:14px;right:320px;z-index:2101;font-size:16px;font-weight:600;color:#191919;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
body.gywx-desk.gywx-today #gyWxTodayX,body.gywx-desk.gywx-today #gyWxTodayT{display:flex}
#gyWx .wx-side{width:60px;flex-shrink:0;background:rgba(233,233,233,.92);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;padding:34px 0 16px;gap:6px;border-right:1px solid #e0e0e0}
#gyWx .wx-side .wx-av{width:36px;height:36px;margin-bottom:18px;cursor:pointer}
#gyWx .wx-si{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#5c5c5c;cursor:pointer;position:relative}
#gyWx .wx-si:hover{background:rgba(0,0,0,.06)}
#gyWx .wx-si.on,#gyWx .wx-si.hot{color:#07c160} #gyWx .wx-si.on svg{fill:#07c160;stroke:#07c160}
#gyWx .wx-si svg{width:25px;height:25px;stroke-width:1.6}
#gyWx .wx-si .wx-red{top:2px;right:2px}
#gyWx .wx-si[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:46px;top:50%;transform:translateY(-50%);background:#333;color:#fff;font-size:12px;padding:3px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:5}
#gyWx .wx-list{flex:1;min-width:0;display:flex;flex-direction:column;background:#f7f7f7}
#gyWx .wx-lhead{height:64px;flex-shrink:0;display:flex;align-items:flex-end;gap:8px;padding:0 12px 12px}
#gyWx .wx-lhead label{flex:1;display:flex;align-items:center;gap:5px;height:28px;border-radius:5px;background:#e8e8e8;padding:0 8px;color:#9b9b9b}
#gyWx .wx-lhead label svg{width:15px;height:15px}
#gyWx .wx-lhead input{border:none;outline:none;background:transparent;font-size:12.5px;width:100%;padding:0;color:#191919;box-shadow:none}
#gyWx .wx-lhead .add{width:28px;height:28px;border-radius:5px;background:#e8e8e8;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#5c5c5c}
#gyWx .wx-lhead .add:hover{background:#dcdcdc}
#gyWx .wx-lhead .add svg{width:17px;height:17px}
#gyWx .wx-lbody{flex:1;overflow-y:auto}
#gyWx .wx-list .wx-cell{height:66px;padding:0 12px;background:transparent;gap:10px}
#gyWx .wx-list .wx-cell+.wx-cell::before{display:none}
#gyWx .wx-list .wx-cell:hover{background:#eaeaea}
#gyWx .wx-list .wx-cell.pin{background:#efefef}
#gyWx .wx-list .wx-cell.sel{background:#07c160;color:#fff}
#gyWx .wx-list .wx-cell.sel .wx-n i,#gyWx .wx-list .wx-cell.sel .wx-p{color:rgba(255,255,255,.8)}
#gyWx .wx-list .wx-cell .wx-av{width:40px;height:40px;border-radius:5px}
#gyWx .wx-list .wx-n{font-size:14px} #gyWx .wx-list .wx-p{font-size:12px;margin-top:5px}
#gyWx .wx-list .wx-hd{background:transparent;font-size:12px;padding:12px 14px 4px}
#gyWx .wx-list .wx-cont{height:56px}
#gyWx .wx-list .wx-ico{width:36px;height:36px}
#gyWxPane{display:none;position:fixed;top:0;right:0;bottom:0;left:336px;z-index:1990;background:#f5f5f5;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#191919;overflow-y:auto}
body.gywx-desk.gywx-pane #gyWxPane{display:block}
#gyWxPane .welcome{height:100%;display:flex;align-items:center;justify-content:center;color:#dcdcdc}
#gyWxPane .welcome svg{width:110px;height:110px;fill:#e3e3e3;stroke:none}
#gyWxPane .pc{max-width:420px;margin:0 auto;padding:90px 0 40px}
#gyWxPane .pc-top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:26px;border-bottom:1px solid #e3e3e3}
#gyWxPane .pc-top .wx-av{width:64px;height:64px;border-radius:6px}
#gyWxPane .pc-f{display:flex;padding:14px 0;font-size:14px;border-bottom:1px solid #e3e3e3;gap:20px;line-height:1.6}
#gyWxPane .pc-f span:first-child{color:#9b9b9b;width:70px;flex-shrink:0}
#gyWxPane .pc-btns{display:flex;justify-content:center;gap:44px;padding-top:34px}
#gyWxPane .pc-btn{display:flex;flex-direction:column;align-items:center;gap:8px;color:#576b95;font-size:13px;cursor:pointer}
#gyWxPane .pc-btn svg{width:28px;height:28px}
/* 电脑：聊天页 → 电脑版微信 */
body.gywx-desk #view-chat{background:#fff!important;height:100vh!important}
body.gywx-desk #view-chat .chat-bubble.other{background:#f2f2f2!important}
body.gywx-desk #view-chat .chat-bubble.other::before{background:inherit}
body.gywx-desk #gyChatHead{background:#fff!important;border-bottom:1px solid #ececec!important;padding:0 24px!important;height:60px;display:flex!important;align-items:center;justify-content:flex-start!important}
body.gywx-desk #gyChatHead .gych-back{display:none!important}
body.gywx-desk #gyChatHead .gych-mid{justify-content:flex-start!important;padding:0!important;gap:6px}
body.gywx-desk #gyChatHead .gych-name{color:#191919!important;font-size:16px!important;font-weight:500!important}
body.gywx-desk #gyChatHead .gych-sub{color:#191919!important;font-size:16px!important}
body.gywx-desk #view-chat .chat-messages{padding:16px 28px!important}
body.gywx-desk #view-chat .chat-input-area{background:#fff!important;border-top:1px solid #ececec!important;padding:10px 20px 14px!important}
body.gywx-desk #view-chat .chat-input-row{display:grid!important;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;gap:8px 10px;align-items:center}
body.gywx-desk #view-chat .chat-in-wrap{grid-column:1 / -1;grid-row:1}
body.gywx-desk #view-chat .chat-more-wrap{grid-column:1;grid-row:2}
body.gywx-desk #chatSendBtn{grid-column:3;grid-row:2;border-radius:4px!important;padding:6px 22px!important;font-size:14px!important}
body.gywx-desk #view-chat .chat-input-row input{border:none!important;background:#fff!important;box-shadow:none!important;min-height:64px;font-size:14.5px!important;padding:4px 36px 4px 2px!important;border-radius:0!important}
body.gywx-desk #view-chat .chat-more{background:transparent!important;border:none!important;color:#5c5c5c!important}
/* 电脑：朋友圈窗口 + ≡ 菜单 */
#gyWxMo{position:fixed;top:4vh;left:50%;transform:translateX(-50%);width:460px;max-width:94vw;height:92vh;z-index:2600;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.28);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#191919}
#gyWxMo .mo-bar{position:absolute;top:0;left:0;right:0;height:40px;display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:0 8px;z-index:3;color:#fff}
#gyWxMo .mo-bar span{width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:4px}
#gyWxMo .mo-bar span:hover{background:rgba(0,0,0,.2)}
#gyWxMo .mo-bar svg{width:18px;height:18px}
#gyWxMo .mo-body{flex:1;overflow-y:auto}
#gyWxMenu{position:fixed;left:64px;bottom:16px;z-index:2601;background:#fff;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.18);padding:6px 0;min-width:150px;font-size:14px;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#191919}
#gyWxMenu div{padding:9px 18px;cursor:pointer;display:flex;justify-content:space-between;gap:10px}
#gyWxMenu div:hover{background:#f2f2f2}
#gyWxMenu .sep{height:1px;padding:0;background:#ececec;margin:4px 0}
/* 微信模式里不要悬浮的 ＋：发推文在朋友圈右上角的相机 */
body.gywx .fab-btn{display:none!important}
/* 设置首页那条开关 */
#gyWxSetEntry .set-entry-ico{background:#07c160;color:#fff;border-radius:8px;display:inline-flex;align-items:center;justify-content:center}
#gyWxSetEntry .set-entry-ico svg{width:20px;height:20px;fill:#fff;stroke:none}
.gywx-sw{width:46px;height:28px;border-radius:14px;background:#e5e5e5;position:relative;flex-shrink:0;transition:background .2s}
.gywx-sw::after{content:"";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s}
.gywx-sw.on{background:#07c160} .gywx-sw.on::after{left:20px}
`;
    function injectCss() {
        if (document.getElementById('gyWxCss')) return;
        const s = document.createElement('style'); s.id = 'gyWxCss'; s.textContent = CSS; document.head.appendChild(s);
    }

    /* ---------------- 壳 ---------------- */
    function mount() {
        injectCss();
        if (!document.getElementById('gyWx')) {
            const d = document.createElement('div'); d.id = 'gyWx';
            d.innerHTML = `<div class="wx-side wx-desk" id="gyWxSide"></div><div class="wx-list wx-desk" id="gyWxList"></div>
                <div class="wx-top wx-mob" id="gyWxTop"></div><div class="wx-body wx-mob" id="gyWxBody"></div><div class="wx-tabs wx-mob" id="gyWxTabs"></div>`;
            document.body.appendChild(d);
        }
        if (!document.getElementById('gyWxPane')) { const p = document.createElement('div'); p.id = 'gyWxPane'; document.body.appendChild(p); }
        if (!document.getElementById('gyWxBar')) {
            const b = document.createElement('div'); b.id = 'gyWxBar';
            b.innerHTML = `<span class="l" onclick="gyWxHome()">${I.back}</span><span class="t" id="gyWxBarT"></span><span class="r" id="gyWxBarR">${I.more}</span>`;
            document.body.appendChild(b);
        }
    }
    function layoutClass() {
        const on = document.body.classList.contains('gywx');
        document.body.classList.toggle('gywx-desk', on && isDesk());
        document.body.classList.toggle('gywx-mob', on && !isDesk());
        document.body.classList.toggle('gywx-pane', on && isDesk() && !!S.pane);
        document.body.classList.toggle('gywx-inchat', on && S.view === 'chat' && !S.pane);
        if (!(on && isDesk())) document.body.classList.remove('gywx-today');
    }

    function unreadCount() {
        let n = 0;
        try { [...groups(), ...chars()].forEach(x => { if (typeof chatHasUnread === 'function' && chatHasUnread(x.id)) n++; }); } catch (e) {}
        return n;
    }
    const redBadge = n => n ? `<i class="wx-red">${n > 99 ? '99+' : n}</i>` : '';

    /* ---------------- 状态栏：跟推文/聊天里同一套认法和渲染 ---------------- */
    function splitStatus(text, charId) {
        try { if (typeof gyExtractChatStatus === 'function') return gyExtractChatStatus(String(text || ''), charId); } catch (e) {}
        return { rest: String(text || ''), seg: '', rows: [] };
    }
    // 一句话预览：去掉状态栏、标签、换行
    function plainOf(text, charId) {
        const st = splitStatus(text, charId);
        return String(st.rest || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
    // 正文 + 可折叠的状态栏（朋友圈用）
    function richOf(text, charId, key) {
        const st = splitStatus(text, charId);
        let body = '';
        try { body = typeof formatPostText === 'function' ? formatPostText(st.rest, charId) : esc(st.rest).replace(/\n/g, '<br>'); }
        catch (e) { body = esc(st.rest).replace(/\n/g, '<br>'); }
        let stat = '';
        try { if (st.seg && typeof gyChatStatusBlockHtml === 'function') stat = gyChatStatusBlockHtml(st, charId, 0, false, key); } catch (e) {}
        return body + stat;
    }

    /* ---------------- 共用的内容片段 ---------------- */
    function sessionItems() {
        let items = [];
        try { items = sortChatListItems(getChatListItems()); } catch (e) { items = [...groups(), ...chars()].map(x => ({ id: x.id, raw: x })); }
        const q = S.q.trim().toLowerCase();
        if (q) items = items.filter(it => String(it.raw.name || '').toLowerCase().includes(q) || String(it.raw.remark || '').toLowerCase().includes(q));
        return items;
    }
    function previewOf(x) {
        const msgs = (typeof globalChats !== 'undefined' && globalChats[x.id]) || [];
        // 系统提示（认识第几天、撤回提示……）不当「最后一句」，往前找一句真正说的话
        let last = null;
        for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i] && msgs[i].sender !== 'system') { last = msgs[i]; break; } }
        if (!last) last = msgs[msgs.length - 1];
        if (!last) return { pv: '', at: 0 };
        const t = last.text ? plainOf(last.text, x.members ? last.sender : x.id) : (last.img || last.image ? '[图片]' : '');
        let pv;
        if (last.sender === 'me') pv = (x.members ? '我：' : '') + t;
        else if (last.sender === 'system') pv = t;
        else if (x.members) { const s = charOf(last.sender); pv = (s ? s.name : '') + '：' + t; }
        else pv = t;
        return { pv: pv.slice(0, 60), at: last.timestamp };
    }
    function chatCells(desk) {
        const items = sessionItems();
        if (!items.length) return `<div class="wx-empty">${S.q ? '没有找到' : '还没有聊天'}</div>`;
        const pinned = id => { try { return pinnedSessionIds.some(p => p == id); } catch (e) { return false; } };
        const sel = desk && S.view === 'chat' && !S.pane ? curSid() : null;
        return items.map(it => {
            const x = it.raw, p = previewOf(x);
            let red = false; try { red = chatHasUnread(x.id); } catch (e) {}
            return `<div class="wx-cell ${pinned(x.id) ? 'pin' : ''} ${sel != null && String(x.id) === sel ? 'sel' : ''}" data-wxchat="${esc(x.id)}" onclick="gyWxOpenChat('${esc(x.id)}')">
                <div class="wx-av">${av(x, 48)}${red ? '<i class="wx-red dot"></i>' : ''}</div>
                <div class="wx-mid"><div class="wx-n"><b>${esc(x.remark || x.name)}${x.members ? `（${(x.members || []).length + 1}）` : ''}</b><i>${esc(ago(p.at))}</i></div>
                <div class="wx-p">${esc(p.pv)}</div></div></div>`;
        }).join('');
    }
    /* 🔤 首字母：按拼音排（浏览器自带的中文拼音排序，不用额外的字典）；英文按字母；别的归到 # */
    const LET = 'ABCDEFGHJKLMNOPQRSTWXYZ'.split(''), LZH = '阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥仨他屲夕丫帀'.split('');
    let zhColl = null; try { zhColl = new Intl.Collator('zh-Hans-CN-u-co-pinyin'); } catch (e) { try { zhColl = new Intl.Collator('zh'); } catch (er) {} }
    const cmpZh = (a, b) => zhColl ? zhColl.compare(a, b) : String(a).localeCompare(String(b), 'zh');
    function initialOf(name) {
        const ch = String(name || '').trim().replace(/^[\s\p{P}\p{S}]+/u, '').charAt(0);
        if (!ch) return '#';
        if (/[a-z]/i.test(ch)) return ch.toUpperCase();
        if (!/[㐀-鿿]/.test(ch) || !zhColl) return '#';
        for (let i = LET.length - 1; i >= 0; i--) if (cmpZh(ch, LZH[i]) >= 0) return LET[i];
        return '#';
    }
    window.gyWxInitial = initialOf;
    const starred = id => { try { return pinnedSessionIds.some(p => String(p) === String(id)); } catch (e) { return false; } };
    function contactCells() {
        const nm = c => String(c.remark || c.name || '');
        const cs = chars().slice().sort((a, b) => cmpZh(nm(a), nm(b)));
        const q = S.q.trim().toLowerCase();
        const list = q ? cs.filter(c => String(c.name || '').toLowerCase().includes(q) || String(c.remark || '').toLowerCase().includes(q)) : cs;
        const ico = (bg, svg) => `<div class="wx-ico" style="background:${bg}">${svg}</div>`;
        let h = q ? '' : `<div class="wx-cell wx-cont" onclick="gyWxGo({view:'characterCenter'})">${ico('#fa9d3b', I.contacts)}<div class="wx-mid"><div class="wx-n"><b>新的朋友</b></div></div></div>
            <div class="wx-cell wx-cont" onclick="gyWxGo({view:'charRelations'})">${ico('#07c160', I.apps)}<div class="wx-mid"><div class="wx-n"><b>关系网</b></div></div></div>
            <div class="wx-cell wx-cont" onclick="gyWxGo({view:'factionOverview'})">${ico('#2782d7', I.discover)}<div class="wx-mid"><div class="wx-n"><b>势力</b></div></div></div>`;
        const gs = groups().filter(g => !q || String(g.name || '').toLowerCase().includes(q));
        if (gs.length) h += `<div class="wx-hd">群聊</div>` + gs.map(g => `<div class="wx-cell wx-cont" onclick="gyWxOpenChat('${esc(g.id)}')"><div class="wx-av">${av(g, 40)}</div><div class="wx-mid"><div class="wx-n"><b>${esc(g.name)}</b></div></div></div>`).join('');
        const cell = c => `<div class="wx-cell wx-cont ${S.card != null && String(S.card) === String(c.id) && isDesk() ? 'sel' : ''}" data-wxcontact="${esc(c.id)}" onclick="gyWxCard('${esc(c.id)}')"><div class="wx-av">${av(c, 40)}</div><div class="wx-mid"><div class="wx-n"><b>${esc(nm(c))}</b></div></div></div>`;
        if (!list.length) return h + `<div class="wx-empty">${q ? '没有找到' : '还没有联系人'}</div>`;
        // 星标朋友（置顶的聊天）排最前，然后按首字母分段
        const stars = q ? [] : list.filter(c => starred(c.id));
        if (stars.length) h += `<div class="wx-hd" data-wxl="☆">星标朋友</div>` + stars.map(cell).join('');
        const by = {};
        list.forEach(c => { const k = initialOf(nm(c)); (by[k] = by[k] || []).push(c); });
        const keys = Object.keys(by).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));
        h += keys.map(k => `<div class="wx-hd" data-wxl="${k}">${k}</div>` + by[k].map(cell).join('')).join('');
        return h + (q ? '' : `<div class="wx-hd" style="text-align:center;padding:18px;background:transparent">${cs.length} 个朋友</div>`);
    }
    // 右边那一竖排字母：点 / 按住滑，跳到那一段
    function paintIndex() {
        const box = document.getElementById('gyWxCells'), old = document.getElementById('gyWxIdx');
        const show = box && S.tab === 'contacts' && !S.sub && !S.q.trim() && document.body.classList.contains('gywx');
        if (!show) { if (old) old.remove(); return; }
        // 真正在滚的那一层（电脑上是列表那一栏，手机上是整个页面体）：往上找第一个能滚的
        let scroller = box;
        while (scroller && scroller !== document.body) { const cs = getComputedStyle(scroller); if (/(auto|scroll)/.test(cs.overflowY) && scroller.scrollHeight > scroller.clientHeight + 2) break; scroller = scroller.parentElement; }
        if (!scroller || scroller === document.body) scroller = isDesk() ? box : (document.getElementById('gyWxBody') || box);
        const host = scroller && scroller.parentElement; if (!host) return;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        const have = new Set([...box.querySelectorAll('[data-wxl]')].map(e => e.dataset.wxl));
        const keys = ['↑', ...(have.has('☆') ? ['☆'] : []), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
        let idx = old;
        if (!idx || idx.parentElement !== host) { if (idx) idx.remove(); idx = document.createElement('div'); idx.id = 'gyWxIdx'; host.appendChild(idx); bindIndex(idx); }
        idx.innerHTML = keys.map(k => `<i data-k="${k}" class="${k === '↑' || have.has(k) ? 'has' : ''}">${k}</i>`).join('') + '<b class="pop"></b>';
        idx.__scroller = scroller; idx.__box = box;
        const hr = host.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
        idx.style.top = (sr.top - hr.top + sr.height / 2) + 'px';
    }
    function bindIndex(idx) {
        let down = false;
        const go = (x, y) => {
            const el = document.elementFromPoint(x, y), i = el && el.closest && el.closest('#gyWxIdx i'); if (!i) return;
            const k = i.dataset.k, sc = idx.__scroller, box = idx.__box; if (!sc || !box) return;
            const pop = idx.querySelector('.pop');
            if (k === '↑') { sc.scrollTop = 0; pop.classList.remove('on'); return; }
            // 没有这个字母开头的人：跳到它后面最近的那一段（跟微信一样）
            const all = [...box.querySelectorAll('[data-wxl]')];
            const order = ['☆', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];
            const target = all.find(e => e.dataset.wxl === k) || all.find(e => order.indexOf(e.dataset.wxl) > order.indexOf(k)) || all[all.length - 1];
            if (target) sc.scrollTop += target.getBoundingClientRect().top - sc.getBoundingClientRect().top;
            pop.dataset.k = k; pop.style.top = (i.offsetTop + i.offsetHeight / 2) + 'px'; pop.classList.add('on');
            idx.querySelectorAll('i').forEach(x => x.classList.toggle('on', x === i));
        };
        idx.addEventListener('pointerdown', e => { down = true; e.preventDefault(); try { idx.setPointerCapture(e.pointerId); } catch (er) {} go(e.clientX, e.clientY); });
        idx.addEventListener('pointermove', e => { if (down) go(e.clientX, e.clientY); });
        const up = () => { down = false; setTimeout(() => { const p = idx.querySelector('.pop'); if (p) p.classList.remove('on'); idx.querySelectorAll('i.on').forEach(x => x.classList.remove('on')); }, 350); };
        idx.addEventListener('pointerup', up); idx.addEventListener('pointercancel', up);
    }

    // 发现（手机） / 小程序（电脑）
    const FEATS = [
        [['🎬', 'TA们在做什么', "gyWxGo({view:'theater'})"], ['📅', '今天', "gyWxGo({today:'1'})"]],
        [['🏠', '主页', "gyWxGo({view:'home'})"], ['🏛️', '论坛', "gyWxGo({view:'novel'})"], ['🎭', '匿名区', "gyWxGo({view:'anonForum'})"], ['📰', '营销号', "gyWxGo({view:'tabloid'})"]],
        [['🎵', '音乐', "gyWxGo({feature:'music'})"], ['🎞️', '一起看电影', "gyWxGo({view:'watchTogether'})"], ['📖', '一起阅读', "gyWxGo({feature:'reading_together'})"]],
        [['🛍️', '购物 / 外卖', "gyWxGo({view:'mall'})"], ['🗺️', '行程与天气', "gyWxGo({feature:'map'})"], ['🕸️', '八卦网', "gyWxGo({feature:'gossip'})"]],
        [['🧩', '小功能', "gyWxGo({view:'miniHub'})"], ['🌿', '日常', "gyWxGo({view:'grapevine'})"]]
    ];
    const rows = list => list.map(([i, t, fn]) => `<div class="wx-row" onclick="${fn}"><span class="ic">${i}</span><span class="t">${t}</span><span class="ar">›</span></div>`).join('');

    /* 朋友圈：推文 + TA 们之间发的朋友圈 */
    function collectMoments() {
        const out = [];
        try {
            (typeof globalPosts !== 'undefined' ? globalPosts : []).forEach(p => {
                if (!p || !p.char || p.isStory) return;
                const who = p.char.id === 'me' || p.char.id == null ? me() : (charOf(p.char.id) || p.char);
                const cm = (p.replies || []).slice(0, 8).map(r => ({ by: (r.char && r.char.name) || r.name || r.author || '', t: r.text || r.content || '' })).filter(r => r.t);
                const likes = (p.likedBy || []).map(x => x === 'me' ? me().name : ((charOf(x) || {}).name || '')).filter(Boolean);
                out.push({ who, cid: p.char.id, pid: p.id, t: p.text || '', img: p.mediaUrl, at: p.timestamp, cm, likes });
            });
        } catch (e) {}
        try {
            if (typeof window.gyPeerMoments === 'function') chars().forEach(c => {
                (window.gyPeerMoments(c.id) || []).forEach(m => {
                    if (String(m.by || '') !== String(c.name)) return;
                    out.push({ who: c, cid: c.id, t: m.t, at: m.at, cm: (m.cm || []).map(x => ({ by: x.by, t: x.t })) });
                });
            });
        } catch (e) {}
        return out.filter(m => m.t || m.img).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 80);
    }
    function momentsHtml() {
        const u = me(), list = collectMoments();
        const img = s => (typeof s === 'string' && /^(data:image|https?:|blob:)/.test(s)) ? `<img src="${esc(s)}" loading="lazy">` : '';
        const cover = (u.bgImg && typeof u.bgImg === 'string') ? ` style="background-image:url('${esc(u.bgImg)}')"` : '';
        return `<div class="wx-cover"${cover}><div class="who" onclick="gyWxAlbum('me')" style="cursor:pointer"><b>${esc(u.name)}</b><div class="wx-av">${av(u, 70)}</div></div></div>` +
            (list.length ? list.map((m, i) => `<div class="wx-mo"><div class="wx-av" onclick="gyWxAlbum('${esc(m.cid == null ? 'me' : m.cid)}')">${av(m.who, 42)}</div><div class="wx-mid" style="flex:1;min-width:0">
                <div class="who" onclick="gyWxAlbum('${esc(m.cid == null ? 'me' : m.cid)}')">${esc(m.who && (m.who.remark || m.who.name))}</div><div class="tx">${richOf(m.t, m.cid, 'wxm' + i)}</div>${img(m.img)}
                <div class="tm">${esc(ago(m.at))}${m.pid != null ? `<span class="more" onclick="gyWxMoAct(this,'${esc(m.pid)}')">··</span>` : '<span>··</span>'}</div>
                ${m.likes && m.likes.length ? `<div class="lk">♡ ${esc(m.likes.join('，'))}</div>` : ''}
                ${m.cm && m.cm.length ? `<div class="cm">${m.cm.map(x => `<div><span>${esc(x.by)}</span>：${esc(plainOf(x.t))}</div>`).join('')}</div>` : ''}
            </div></div>`).join('') : `<div class="wx-empty">朋友圈还空着</div>`);
    }

    /* =================== 📱 手机渲染 =================== */
    const MTABS = [['chats', 'chat', '微信'], ['contacts', 'contacts', '通讯录'], ['discover', 'discover', '发现'], ['me', 'me', '我']];
    function renderMob() {
        const top = document.getElementById('gyWxTop'), body = document.getElementById('gyWxBody'), tabs = document.getElementById('gyWxTabs');
        if (!top || !body || !tabs) return;
        const un = unreadCount();
        tabs.style.display = S.sub ? 'none' : '';
        tabs.innerHTML = MTABS.map(([k, ic, t]) => `<div class="wx-tab ${S.tab === k ? 'on' : ''}" data-wxtab="${k}" onclick="gyWxTab('${k}')">${I[ic]}${t}${k === 'chats' ? redBadge(un) : ''}</div>`).join('');
        top.className = 'wx-top wx-mob'; top.style.display = ''; top.style.background = '';
        const srch = `<div class="wx-srch"><label>${I.search}<input id="gyWxQ" placeholder="搜索" value="${esc(S.q)}" oninput="gyWxSearch(this.value)"></label></div>`;
        let title = '', l = '', r = '', html = '';
        if (S.sub && String(S.sub).indexOf('album:') === 0) {
            const aid = String(S.sub).slice(6);
            top.className = 'wx-top wx-mob clear';
            l = `<span class="wx-l" onclick="gyWxSub(${S.tab === 'contacts' && aid !== 'me' ? `'${esc(aid)}'` : (S.tab === 'discover' ? "'moments'" : 'null')})">${I.back}</span>`;
            r = aid === 'me' ? `<span class="wx-r" title="发朋友圈" onclick="gyWxCompose()">${I.camera}</span>` : '';
            top.innerHTML = l + '<span></span>' + r; body.innerHTML = albumHtml(aid); syncIdx(); return;
        }
        if (S.tab === 'chats') {
            title = '微信' + (un ? `(${un})` : '');
            r = `<span class="wx-r"><span onclick="gyWxGo({fn:'openCreateGroupModal'},1)" title="发起群聊">${I.plus}</span></span>`;
            html = srch + `<div id="gyWxCells">${chatCells(false)}</div>`;
        } else if (S.tab === 'contacts') {
            if (S.sub) { l = `<span class="wx-l" onclick="gyWxSub(null)">${I.back}</span>`; top.style.background = '#fff'; html = cardHtmlMob(S.sub); }
            else { title = '通讯录'; html = srch + `<div id="gyWxCells">${contactCells()}</div>`; }
        } else if (S.tab === 'discover') {
            if (S.sub === 'moments') {
                top.className = 'wx-top wx-mob clear';
                l = `<span class="wx-l" onclick="gyWxSub(null)">${I.back}</span>`; r = `<span class="wx-r" title="发朋友圈" onclick="gyWxCompose()">${I.camera}</span>`;
                html = momentsHtml();
            } else {
                title = '发现';
                html = `<div class="wx-row" onclick="gyWxSub('moments')"><span class="ic">🌐</span><span class="t">朋友圈</span><span class="ar">›</span></div>`
                    + FEATS.map(g => `<div class="wx-gap"></div>` + rows(g)).join('');
            }
        } else { top.style.display = 'none'; html = meHtmlMob(); }
        top.innerHTML = l + `<span>${esc(title)}</span>` + r;
        body.innerHTML = html;
        syncIdx();
    }
    function syncIdx() { try { paintIndex(); } catch (e) {} }
    function cardHtmlMob(id) { return profileHtml(id); }
    /* 👤 资料页：头像、名字、微信号 → 朋友资料 → 朋友圈（最近几张）→ 发消息 / 音视频通话 */
    function profileHtml(id) {
        const c = charOf(id);
        if (!c) return `<div class="wx-empty">找不到这个人了</div>`;
        const items = albumItems(c.id).slice(0, 12);
        const thumbs = items.filter(m => m.img).slice(0, 4);
        const tiles = (thumbs.length ? thumbs : items.slice(0, 4)).map(m => m.img ? `<i style="background-image:url('${esc(m.img)}')"></i>` : `<i class="tx">${esc(plainOf(m.t).slice(0, 16))}</i>`).join('');
        const sub = [c.remark ? '备注：' + c.remark : '', c.group ? '分组：' + c.group : '', c.bio ? '签名：' + c.bio : ''].filter(Boolean).join('　');
        return `<div class="wx-prof">
            <div class="wx-card"><div class="wx-av">${av(c, 64)}</div><div class="wx-mid">
                <div class="wx-cname">${esc(c.remark || c.name)}</div>
                <div class="wx-cmeta">${c.remark ? `昵称：${esc(c.name)}<br>` : ''}微信号：${esc(String(c.handle || '').replace(/^@/, '') || c.id)}${c.location ? `<br>地区：${esc(c.location)}` : ''}</div></div></div>
            <div class="wx-prow" onclick="gyWxGo({fn:'openFormForEdit',args:['${esc(c.id)}']},1)"><div><b>朋友资料</b><span>${esc(sub || '改备注、签名、人设、头像……')}</span></div><em>›</em></div>
            <div class="wx-gap"></div>
            <div class="wx-prow mo" onclick="gyWxAlbum('${esc(c.id)}')"><b>朋友圈</b><div class="th">${tiles || '<span class="none">还没发过</span>'}</div><em>›</em></div>
            <div class="wx-gap"></div>
            <div class="wx-cbtn" onclick="gyWxOpenChat('${esc(c.id)}')">${I.chat}发消息</div>
            ${typeof window.gyCallStart === 'function' ? `<div class="wx-cbtn" onclick="gyWxGo({fn:'gyCallStart',args:['${esc(c.id)}']})">📞 音视频通话</div>` : ''}
            ${typeof window.gyPhoneOpen === 'function' ? `<div class="wx-cbtn" onclick="gyWxGo({fn:'gyPhoneOpen',args:['${esc(c.id)}']})">📱 看看 TA 的手机</div>` : ''}
            <div class="wx-cbtn sub" onclick="gyWxGo({view:'profile',param:'${esc(c.id)}'})">打开 TA 的主页</div>
        </div>`;
    }
    /* 🖼 相册（点头像 / 资料页的朋友圈进来）：封面、签名，按天排的一条条 */
    function albumItems(id) {
        const isMe = String(id) === 'me', out = [];
        try {
            (typeof globalPosts !== 'undefined' ? globalPosts : []).forEach(p => {
                if (!p || !p.char || p.isStory) return;
                const pid = p.char.id == null ? 'me' : String(p.char.id);
                if (isMe ? pid !== 'me' : pid !== String(id)) return;
                out.push({ pid: p.id, t: p.text || '', img: (typeof p.mediaUrl === 'string' && /^(data:image|https?:|blob:|gylive:)/.test(p.mediaUrl)) ? p.mediaUrl : '', at: p.timestamp || 0, pinned: !!p.pinned });
            });
        } catch (e) {}
        try {
            const c = isMe ? null : charOf(id);
            if (c && typeof window.gyPeerMoments === 'function') (window.gyPeerMoments(c.id) || []).forEach(m => { if (String(m.by || '') === String(c.name)) out.push({ t: m.t, at: m.at, img: '' }); });
        } catch (e) {}
        return out.filter(m => m.t || m.img).sort((a, b) => (b.at || 0) - (a.at || 0));
    }
    function albumHtml(id) {
        const isMe = String(id) === 'me', who = isMe ? me() : charOf(id);
        if (!who) return `<div class="wx-empty">找不到这个人了</div>`;
        const items = albumItems(id), now = new Date();
        const dkey = t => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
        const today = dkey(now), yest = dkey(Date.now() - 864e5);
        const groupsD = []; items.forEach(m => { const k = dkey(m.at); const g = groupsD[groupsD.length - 1]; if (g && g.k === k) g.list.push(m); else groupsD.push({ k, at: m.at, list: [m] }); });
        if (isMe && (!groupsD.length || groupsD[0].k !== today)) groupsD.unshift({ k: today, at: Date.now(), list: [] });
        let lastY = now.getFullYear();
        const dayLabel = g => { if (g.k === today) return '<b class="w">今天</b>'; if (g.k === yest) return '<b class="w">昨天</b>'; const d = new Date(g.at); return `<b>${d.getDate()}</b><small>${d.getMonth() + 1}月</small>`; };
        const item = m => {
            const go = m.pid != null ? `onclick="gyWxGo({view:'postDetail',param:'${esc(m.pid)}'})"` : '';
            return m.img ? `<div class="al-i" ${go}><i class="ph" style="background-image:url('${esc(m.img)}')"></i><span>${esc(plainOf(m.t).slice(0, 60))}</span></div>`
                : `<div class="al-i tx" ${go}><span>${esc(plainOf(m.t).slice(0, 80))}</span></div>`;
        };
        const rowsH = groupsD.map(g => {
            const y = new Date(g.at).getFullYear();
            const yh = y !== lastY ? `<div class="al-y">${y}年</div>` : ''; lastY = y;
            const cam = isMe && g.k === today ? `<div class="al-i cam" onclick="gyWxCompose()">${I.camera}</div>` : '';
            return yh + `<div class="al-d"><div class="dl">${dayLabel(g)}</div><div class="its">${cam}${g.list.map(item).join('')}</div></div>`;
        }).join('');
        const pins = items.filter(m => m.pinned && m.img).slice(0, 9);
        const cover = (who.bgImg && typeof who.bgImg === 'string') ? ` style="background-image:url('${esc(who.bgImg)}')"` : '';
        return `<div class="wx-cover al"${cover}><div class="who"><b>${esc(isMe ? who.name : (who.remark || who.name))}</b><div class="wx-av">${av(who, 70)}</div></div></div>
            <div class="al-bio">${esc(who.bio || '')}</div>
            ${pins.length ? `<div class="al-pin"><b>置顶</b><div class="g">${pins.map(m => `<i style="background-image:url('${esc(m.img)}')"></i>`).join('')}</div></div>` : ''}
            <div class="al-list">${rowsH || '<div class="wx-empty">还没有发过朋友圈</div>'}</div>`;
    }
    window.gyWxAlbum = function (id) {
        closeFloat();
        if (!isDesk()) { S.sub = 'album:' + id; render(); try { document.getElementById('gyWxBody').scrollTop = 0; } catch (e) {} return; }
        const m = document.createElement('div'); m.id = 'gyWxMo';
        m.innerHTML = `<div class="mo-bar">${String(id) === 'me' ? `<span title="发朋友圈" onclick="gyWxCompose()">${I.camera}</span>` : ''}<span title="朋友圈" onclick="gyWxMoments()">↩</span><span title="关闭" onclick="document.getElementById('gyWxMo').remove()">${I.close}</span></div><div class="mo-body">${albumHtml(id)}</div>`;
        document.body.appendChild(m);
    };
    // 朋友圈里点「··」：赞 / 评论
    window.gyWxMoAct = function (el, pid) {
        const old = document.querySelector('.wx-moact'); if (old) { const same = old.dataset.pid === String(pid); old.remove(); if (same) return; }
        const p = (typeof globalPosts !== 'undefined' ? globalPosts : []).find(x => String(x.id) === String(pid)); if (!p) return;
        const d = document.createElement('div'); d.className = 'wx-moact'; d.dataset.pid = String(pid);
        d.innerHTML = `<span onclick="gyWxMoLike('${esc(pid)}')">♡ ${p.userLiked ? '取消' : '赞'}</span><span onclick="gyWxGo({view:'postDetail',param:'${esc(pid)}'})">💬 评论</span>`;
        el.parentElement.appendChild(d);
    };
    window.gyWxMoLike = function (pid) {
        try { if (typeof toggleMainPostLike === 'function') toggleMainPostLike(String(pid), null); if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        const b = document.querySelector('#gyWxMo .mo-body'); if (b) b.innerHTML = momentsHtml(); else render();
    };
    function meHtmlMob() {
        const u = me();
        let n = 0; try { n = unreadNotifs || 0; } catch (e) {}
        return `<div class="wx-mehead" onclick="gyWxGo({view:'profile',param:'me'})"><div class="wx-av">${av(u, 64)}</div><div class="wx-mid">
                <div class="nm">${esc(u.name)}</div><div class="id">微信号：${esc(String(u.handle || '').replace(/^@/, ''))}</div></div><span style="color:#c4c4c4;font-size:20px">›</span></div>
            <div class="wx-gap"></div>` +
            rows([['🔔', '通知' + (n ? `（${n}）` : ''), "gyWxGo({view:'notifications'})"]]) +
            `<div class="wx-gap"></div>` +
            rows([['✉️', '信件与日记', "gyWxGo({view:'diary'})"], ['🎒', '收藏（随身物）', "gyWxGo({fn:'gykitOpen'},1)"], ['🌐', '朋友圈', "gyWxTab('discover');gyWxSub('moments')"], ['🖼️', '我的朋友圈（相册）', "gyWxAlbum('me')"], ['😊', '表情', "gyWxGo({feature:'emoticon'})"]]) +
            `<div class="wx-gap"></div>` + rows([['⚙️', '设置', "gyWxGo({view:'settings'})"]]);
    }

    /* =================== 🖥️ 电脑渲染 =================== */
    function renderDesk() {
        const side = document.getElementById('gyWxSide'), list = document.getElementById('gyWxList'), pane = document.getElementById('gyWxPane');
        if (!side || !list || !pane) return;
        const un = unreadCount();
        let nn = 0; try { nn = unreadNotifs || 0; } catch (e) {}
        const si = (k, ic, tip, fn, badge) => `<div class="wx-si ${S.tab === k || (k === 'today' && document.body.classList.contains('gywx-today')) ? 'on' : ''}" data-wxtab="${k}" data-tip="${tip}" onclick="${fn}">${I[ic]}${badge || ''}</div>`;
        side.innerHTML = `<div class="wx-av" onclick="gyWxGo({view:'profile',param:'me'})" title="${esc(me().name)}">${av(me(), 36)}</div>`
            + si('chats', 'chat', '聊天', "gyWxTab('chats')", redBadge(un))
            + si('contacts', 'contacts', '通讯录', "gyWxTab('contacts')")
            + si('moments', 'moments', '朋友圈', 'gyWxMoments()')
            + si('theater', 'theater', 'TA们在做什么', "gyWxGo({view:'theater'})")
            + si('today', 'today', '今天', 'gyWxToday()')
            + si('apps', 'apps', '小程序', "gyWxTab('apps')")
            + `<div style="flex:1"></div>`
            + si('menu', 'menu', '更多', 'gyWxMenu(event)', nn ? '<i class="wx-red dot"></i>' : '');
        let head = `<div class="wx-lhead"><label>${I.search}<input id="gyWxQ" placeholder="搜索" value="${esc(S.q)}" oninput="gyWxSearch(this.value)"></label>`;
        if (S.tab === 'chats') head += `<span class="add" title="发起群聊" onclick="openCreateGroupModal()">${I.close.replace('M6 6l12 12M18 6L6 18', 'M12 5v14M5 12h14')}</span>`;
        head += `</div>`;
        let body = '';
        if (S.tab === 'chats') body = chatCells(true);
        else if (S.tab === 'contacts') body = contactCells();
        else body = FEATS.map(g => `<div class="wx-hd"></div>` + g.map(([i, t, fn]) => `<div class="wx-cell wx-cont" onclick="${fn}"><div class="wx-ico" style="background:#fff;font-size:20px;color:#191919">${i}</div><div class="wx-mid"><div class="wx-n"><b>${t}</b></div></div></div>`).join('')).join('');
        list.innerHTML = head + `<div class="wx-lbody" id="gyWxCells">${body}</div>`;
        setTimeout(() => { try { paintIndex(); } catch (e) {} }, 0);
        // 右边
        if (S.pane === 'card') pane.innerHTML = cardHtmlDesk(S.card);
        else if (S.pane) pane.innerHTML = `<div class="welcome">${I.logo}</div>`;
        layoutClass();
    }
    function cardHtmlDesk(id) {
        if (!charOf(id)) return `<div class="welcome">${I.logo}</div>`;
        return `<div class="pc wx-pcw">${profileHtml(id)}</div>`;
    }

    function render() {
        if (!document.body.classList.contains('gywx')) return;
        layoutClass();
        if (isDesk()) renderDesk(); else renderMob();
        syncBar();
    }

    /* 📱 点进去以后顶上那条的标题 */
    function syncBar() {
        const t = document.getElementById('gyWxBarT'); if (!t) return;
        let title = '';
        if (S.view === 'chat') { const s = sessOf(curSid()); title = s ? (s.remark || s.name) + (s.members ? `(${s.members.length + 1})` : '') : '聊天'; }
        else {
            try { title = (typeof mobileViewTitles !== 'undefined' && mobileViewTitles[S.view]) || ''; } catch (e) {}
            if (!title) { const m = document.getElementById('mtbCenterTitle'); title = m ? m.textContent : ''; }
        }
        t.textContent = title || '';
        const r = document.getElementById('gyWxBarR');
        if (r) r.onclick = () => {
            if (S.view === 'chat') {
                const s = sessOf(curSid()); if (!s) return;
                try { if (s.members) { if (typeof openChatOptions === 'function') openChatOptions(s.id); } else switchMainView('profile', s.id); } catch (e) {}
            } else if (typeof toggleDrawer === 'function') toggleDrawer();
        };
    }

    /* ---------------- 对外 ---------------- */
    window.gyWxTab = function (k) {
        S.tab = k; S.sub = null; S.q = '';
        if (isDesk()) { if (k === 'contacts') { S.pane = S.card ? 'card' : 'welcome'; } else if (k === 'chats' && !(S.view === 'chat' && curSid())) S.pane = 'welcome'; }
        render();
        try { document.getElementById('gyWxBody').scrollTop = 0; } catch (e) {}
    };
    window.gyWxState = () => ({ sub: S.sub, tab: S.tab, pane: S.pane });   // 给 js/73「返回」用
    window.gyWxSub = function (s) { S.sub = s; render(); try { document.getElementById('gyWxBody').scrollTop = 0; } catch (e) {} };
    window.gyWxSearch = function (v) {
        S.q = String(v || '');
        const box = document.getElementById('gyWxCells'); if (!box) return;
        box.innerHTML = S.tab === 'contacts' ? contactCells() : chatCells(isDesk());
        try { paintIndex(); } catch (e) {}
    };
    window.gyWxCard = function (id) {
        if (isDesk()) { S.card = id; S.pane = 'card'; render(); }
        else window.gyWxSub(String(id));
    };
    window.gyWxOpenChat = function (id) {
        S.tab = 'chats'; S.sub = null; S.pane = null; S.q = '';
        window.gyWxGo({ chat: String(id) });
    };
    // 去白露的某个页面 / 功能。modal=1：弹窗类（不用把壳收起来，弹窗本来就盖在上面）
    window.gyWxGo = function (j, modal) {
        closeFloat();
        if (j && j.today && isDesk()) { window.gyWxToday(true, j.today !== '1' ? j.today : null); return; }
        if (!modal) {
            if (isDesk()) S.pane = null;
            else document.body.classList.add('gywx-away');
        }
        try {
            if (j && j.fn && !j.args && typeof window[j.fn] === 'function') window[j.fn]();
            else if (typeof window.gyJump === 'function') window.gyJump(j);
        } catch (e) { console.warn('[微信模式] 打开失败：', e); }
        layoutClass();
        setTimeout(render, 90);
    };
    window.gyWxHome = function () {
        document.body.classList.remove('gywx-away');
        render();
    };
    window.gyWxMoments = function () {
        closeFloat();
        if (!isDesk()) { S.tab = 'discover'; window.gyWxSub('moments'); return; }
        const m = document.createElement('div'); m.id = 'gyWxMo';
        m.innerHTML = `<div class="mo-bar"><span title="发朋友圈" onclick="gyWxCompose()">${I.camera}</span><span title="刷新" onclick="gyWxMoments()">↻</span><span title="关闭" onclick="document.getElementById('gyWxMo').remove()">${I.close}</span></div><div class="mo-body">${momentsHtml()}</div>`;
        document.body.appendChild(m);
    };
    // 🗓️ 电脑上的「今天」：右边滑出来；手机上走白露原来那页（底栏第二个按钮那页）
    window.gyWxToday = function (force, anchor) {
        closeFloat();
        const openIt = force === true || !document.body.classList.contains('gywx-today');
        try { if (openIt && typeof window.gyTodaySet === 'function' && !(window.gyTodayRead && window.gyTodayRead().on)) window.gyTodaySet(true); } catch (e) {}
        try { if (openIt && typeof window.gyTodayRender === 'function') window.gyTodayRender(); } catch (e) {}
        if (!document.getElementById('gyWxTodayX')) {
            const x = document.createElement('div'); x.id = 'gyWxTodayX'; x.title = '关上'; x.innerHTML = I.close; x.onclick = () => window.gyWxToday(false);
            const t = document.createElement('div'); t.id = 'gyWxTodayT'; t.textContent = '今天';
            document.body.appendChild(t); document.body.appendChild(x);
        }
        document.body.classList.toggle('gywx-today', openIt);
        if (openIt && anchor) setTimeout(() => { try { const el = document.querySelector(`#gyToday [data-rh="${anchor}"]`); if (el) { el.open = true; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } catch (e) {} }, 150);
        render();
    };

    // 📷 发朋友圈（=发推文）：用白露原来的发帖弹窗，不要那颗悬浮的 ＋
    window.gyWxCompose = function () {
        closeFloat();
        try { if (typeof pendingQuotePostId !== 'undefined') pendingQuotePostId = null; } catch (e) {}
        try { if (typeof renderQuotePreviewInModal === 'function') renderQuotePreviewInModal(); } catch (e) {}
        try { openModal('postCreateModal'); } catch (e) {}
    };
    window.gyWxMenu = function (ev) {
        if (ev) ev.stopPropagation();
        const had = document.getElementById('gyWxMenu'); closeFloat(); if (had) return;
        let n = 0; try { n = unreadNotifs || 0; } catch (e) {}
        const m = document.createElement('div'); m.id = 'gyWxMenu';
        m.innerHTML = `<div onclick="gyWxGo({view:'notifications'})"><span>通知</span>${n ? `<span style="color:#fa5151">${n}</span>` : ''}</div>
            <div onclick="gyWxGo({view:'diary'})">信件与日记</div><div onclick="gyWxGo({view:'memoryHub'})">记忆总览</div>
            <div class="sep"></div><div onclick="gyWxGo({view:'settings'})">设置</div><div data-wxback onclick="gyWxSet(false)">切回白露</div>`;
        document.body.appendChild(m);
        setTimeout(() => document.addEventListener('click', closeMenuOnce, { once: true }), 0);
    };
    function closeMenuOnce() { const m = document.getElementById('gyWxMenu'); if (m) m.remove(); }
    function closeFloat() { ['gyWxMenu', 'gyWxMo'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); }

    window.gyWxSet = function (on, quiet) {
        on = !!on;
        try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
        // 跟小手机模式二选一
        if (on && typeof window.gyPmIsOn === 'function' && window.gyPmIsOn()) { try { window.gyPmSet(false, true); } catch (e) {} }
        mount(); closeFloat();
        document.body.classList.toggle('gywx', on);
        document.body.classList.remove('gywx-away');
        try { if (on) { if (window.gymWxCollapse) window.gymWxCollapse(); } else if (window.gymWxRestore) window.gymWxRestore(); } catch (e) {}
        if (on) {
            S.tab = 'chats'; S.sub = null; S.q = ''; S.pane = 'welcome'; S.card = null;
            render();
        } else {
            ['gywx-desk', 'gywx-mob', 'gywx-pane'].forEach(c => document.body.classList.remove(c));
        }
        paintEntry();
        if (!quiet && typeof showToast === 'function') { try { showToast('', on ? '💬 已切到微信模式' : '🌾 已切回白露', on ? '数据还是同一份，设置里随时切回来' : '', null, null, false); } catch (e) {} }
    };
    window.gyWxIsOn = () => document.body.classList.contains('gywx');
    window.gyWxRefresh = function () {
        if (!window.gyWxIsOn()) return;
        if (isDesk() || !document.body.classList.contains('gywx-away')) {
            // 正在搜索框里打字就别整块重画（会把光标弄丢）
            const q = document.getElementById('gyWxQ');
            if (q && document.activeElement === q) return;
            render();
        } else syncBar();
    };

    /* ---------------- 入口：设置首页一条（带开关） ---------------- */
    function paintEntry() {
        const sw = document.querySelector('#gyWxSetEntry .gywx-sw'); if (sw) sw.classList.toggle('on', isOn());
    }
    function addEntry() {
        if (document.getElementById('gyWxSetEntry')) return;
        const anchor = document.querySelector('.set-entry[onclick*="openSettingsPanel(\'appearance\')"]');
        if (!anchor) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.id = 'gyWxSetEntry'; b.setAttribute('data-core', '1');
        b.innerHTML = `<span class="set-entry-ico">${I.logo}</span>
            <span class="set-entry-main"><span class="set-entry-title">微信模式</span><span class="set-entry-desc">电脑上像电脑版微信，手机上像手机微信，数据还是同一份</span></span>
            <span class="gywx-sw"></span>`;
        b.onclick = () => window.gyWxSet(!isOn());
        anchor.parentNode.insertBefore(b, anchor);
        paintEntry();
    }

    /* ---------------- 跟着白露走：切页面 / 切会话 / 聊天页的返回键 ---------------- */
    function hooks() {
        const wrap = (name, after) => {
            const f = window[name];
            if (typeof f !== 'function' || f.__gyWx) return;
            const w = function () { const r = f.apply(this, arguments); try { after.apply(null, arguments); } catch (e) {} return r; };
            w.__gyWx = true; window[name] = w;
        };
        wrap('switchMainView', v => { S.view = v;
            // 不管从哪儿切了页面（弹窗里的按钮、通知、TA 的手机……），手机上壳都得让开，不然新页面被盖在下面
            if (window.gyWxIsOn() && !isDesk() && window.__gyWxReady && !document.body.classList.contains('gywx-away')) document.body.classList.add('gywx-away'); if (v === 'settings') setTimeout(addEntry, 0); if (window.gyWxIsOn()) { if (isDesk() && v !== 'chat' && S.pane) S.pane = null; setTimeout(window.gyWxRefresh, 30); } });
        wrap('switchChatSession', () => { S.view = 'chat'; if (window.gyWxIsOn()) setTimeout(window.gyWxRefresh, 30); });
        wrap('renderChatCharList', () => { if (window.gyWxIsOn()) window.gyWxRefresh(); });
        // 通知里点「今天」的某张卡：电脑微信模式下右栏是收着的，改成从右边滑出来
        if (typeof window.gyJump === 'function' && !window.gyJump.__gyWx) {
            const f = window.gyJump;
            const w = function (j) { if (j && j.today && window.gyWxIsOn() && isDesk()) { window.gyWxToday(true, j.today); return; } return f.apply(this, arguments); };
            w.__gyWx = true; window.gyJump = w;
        }
        // 手机上聊天页自带的「‹」：微信模式里退回微信
        if (typeof window.gyChatBack === 'function' && !window.gyChatBack.__gyWx) {
            const f = window.gyChatBack;
            const w = function () { if (window.gyWxIsOn() && !isDesk()) { window.gyWxHome(); return; } return f.apply(this, arguments); };
            w.__gyWx = true; window.gyChatBack = w;
        }
    }

    function boot() {
        mount(); hooks(); addEntry();
        try {
            const v = [...document.querySelectorAll('[id^="view-"]')].find(e => e.style.display !== 'none' && e.offsetParent !== null);
            if (v) S.view = { 'view-chat': 'chat', 'view-home': 'home', 'view-settings': 'settings' }[v.id] || S.view;
        } catch (e) {}
        if (isOn()) { document.body.classList.add('gywx'); render(); }
        setTimeout(() => { window.__gyWxReady = true; }, 2500);
        let rt = null;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.gyWxIsOn()) { closeFloat(); render(); } }, 150); });
        setInterval(() => { try { window.gyWxRefresh(); } catch (e) {} }, 30000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
