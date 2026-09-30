/* ===========================================================================
   js/27 —— 🧩 小功能全部改成页面
   ---------------------------------------------------------------------------
   以前这些东西（音乐盒、行程与天气、关系账本、八卦网、随身物、日子、此刻、
   一起阅读、表情）都是**全屏盖上来的弹窗**。弹窗有三个毛病：
     · 手机上顶不住，内容一多就只能在一个 82vh 的小盒子里滚
     · 没有返回栈——点开一个再点开另一个，退出来不知道退到哪
     · 顶栏标题、手机返回键、侧边栏高亮全都不认识它，等于"游离在 app 之外"

   改法上有两条路：一是把 9 个模块的渲染全部重写成页面（改动量巨大，
   每个模块的 render 都绑着自己那个 modal 的 id），二是**把弹窗的壳当页面用**。
   这里选了后者，跟「日常」把小剧场搬进 tab 是同一个套路：

     打开时  → 切到 #view-feature-page，调模块自己的 open()（它照常渲染），
              然后把那个 modal 节点**搬进页面容器**，加一个 .gy-as-page，
              用 CSS 把 position:fixed / 半透明黑底 / 圆角 / 最大高度全部中和掉
     离开时  → 调模块自己的 close()，把节点原样搬回 document.body

   模块里一个 id、一个事件、一个渲染函数都不用动。模块自己的「关闭」按钮
   会被改写成「返回小功能」，离开时再改回去。
   =========================================================================== */
(function () {
    if (window.__gyFeaturePagesLoaded) return;
    window.__gyFeaturePagesLoaded = true;

    // id 要跟 registerMiniFeature 的 id 一致；entry 是模块塞进设置目录页的那个按钮的 id
    // （js/08 的认领逻辑会照着这个名单把它们丢掉，免得小功能页里一个功能出现两遍）
    const PAGES = [
        { id: 'music',    icon: '🎵', title: '音乐盒',     entry: 'gymSetEntry',
          desc: '本地歌 / 直链都能放，选个角色一起听，TA 会顺着歌说话',
          // ⚠️ 一定要先 gymShow()：收起播放器（gymHide）之后 #gymRoot 是 display:none，
          //    只开管理页的话播放器再也放不出来了——以前设置目录里那个入口就是 gymShow()+gymOpenMgr()，
          //    v102 改成页面时漏掉了前半句，于是"收起之后就再也打不开"。
          modal: 'gymMgr',    open: () => { if (window.gymShow) window.gymShow(); if (window.gymOpenMgr) window.gymOpenMgr(); }, onClose: () => window.gymCloseMgr && window.gymCloseMgr(), closeAttr: 'gymCloseMgr(' },
        { id: 'map',      icon: '🗺️', title: '行程与天气', entry: 'gymapSetEntry',
          desc: '角色现在在哪、那边什么天气，能约出去，也能挂个悬浮窗',
          modal: 'gymapModal', open: () => window.gymapOpen && window.gymapOpen(), onClose: () => window.gymapClose && window.gymapClose(), closeAttr: 'gymapClose(' },
        { id: 'relations',icon: '💞', title: '关系账本',   entry: 'gyrelSetEntry',
          desc: '你和 TA 之间发生过什么，一笔一笔记着，好感不是凭空来的',
          modal: 'gyrelModal', open: () => window.gyrelOpen && window.gyrelOpen(), onClose: () => window.gyrelClose && window.gyrelClose(), closeAttr: 'gyrelClose(' },
        { id: 'gossip',   icon: '🕸️', title: '八卦网',     entry: 'gygsSetEntry',
          desc: '话在角色之间传，传着传着就变样了',
          modal: 'gygsModal',  open: () => window.gygsOpen && window.gygsOpen(), onClose: () => window.gygsClose && window.gygsClose(), closeAttr: 'gygsClose(' },
        { id: 'kit',      icon: '🎒', title: '随身物',     entry: 'gykitSetEntry',
          desc: '角色身上真的有东西，而且那些东西有来历',
          modal: 'gykitModal', open: () => window.gykitOpen && window.gykitOpen(), onClose: () => window.gykitClose && window.gykitClose(), closeAttr: 'gykitClose(' },
        { id: 'days',     icon: '📅', title: '日子',       entry: 'gydaySetEntry',
          desc: '认识第几天、纪念日、快到的日子，都在这儿',
          modal: 'gydayModal', open: () => window.gydayOpen && window.gydayOpen(), onClose: () => window.gydayClose && window.gydayClose(), closeAttr: 'gydayClose(' },
        { id: 'now',      icon: '🌐', title: '此刻',       entry: 'gynowSetEntry',
          desc: '所有人现在在做什么，一屏看完；顺带看这个月花了多少',
          modal: 'gynowModal', open: () => window.gynowOpen && window.gynowOpen(), onClose: () => window.gynowClose && window.gynowClose(), closeAttr: 'gynowClose(' },
        { id: 'reading_together', icon: '📖', title: '一起阅读',
          desc: '导入 txt / docx / pdf / epub，选个角色一起读，TA 会在原文旁边写评论',
          modal: 'rtOverlay',  open: () => window.rtOpenOverlay && window.rtOpenOverlay(), onClose: () => window.rtCloseOverlay && window.rtCloseOverlay() },
        { id: 'emoticon', icon: '🖼️', title: '表情包 / 图片库',
          desc: '本地上传或贴链接，写上含义之后角色会自己挑着用',
          modal: 'emoticonManagerModal',
          open: () => { if (typeof renderEmoticonManagerGallery === 'function') renderEmoticonManagerGallery(); },
          onClose: () => { if (typeof closeModal === 'function') closeModal('emoticonManagerModal'); },
          closeAttr: "closeModal('emoticonManagerModal')" }
    ];
    // 给 js/08 的认领逻辑看：这些设置目录条目直接丢掉，别再搬进小功能页
    window.GY_MINI_TAKEOVER = new Set(PAGES.map(p => p.entry).filter(Boolean));

    const CSS = `
    #view-feature-page{padding:0;}
    .gyfp-top{display:flex;align-items:center;gap:12px;padding:12px 16px;
        border-bottom:1px solid rgba(128,128,128,.18);position:sticky;top:0;z-index:20;
        background:var(--gy-page-bg,rgba(255,255,255,.94));backdrop-filter:blur(8px);}
    .gyfp-back{border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;
        border-radius:999px;padding:5px 13px;font-size:13px;cursor:pointer;white-space:nowrap;}
    .gyfp-back:hover{border-color:#1d9bf0;color:#1d9bf0;}
    .gyfp-title{font-size:17px;font-weight:800;}
    .gyfp-body{padding:0 0 90px;}

    /* 把"全屏弹窗"就地当页面用：定位、黑底、圆角、最大高度全部中和掉 */
    #gyfpBody > .gy-as-page{position:static!important;inset:auto!important;top:auto!important;
        left:auto!important;right:auto!important;bottom:auto!important;
        background:transparent!important;padding:0!important;margin:0!important;
        z-index:auto!important;display:block!important;width:100%!important;height:auto!important;
        max-height:none!important;overflow:visible!important;backdrop-filter:none!important;}
    #gyfpBody > .gy-as-page > *{max-width:none!important;width:100%!important;
        max-height:none!important;height:auto!important;border-radius:0!important;
        box-shadow:none!important;margin:0!important;border-left:none!important;border-right:none!important;}
    /* 一起阅读自带关闭键，页面模式下用上面的返回键就够了 */
    #gyfpBody #rtCloseBtn{display:none!important;}
    /* 模块自己那一行"🗺️ 行程与天气 [关闭]"跟页面顶栏是重复的，页面模式下收掉。
       只收这几个明确的标题行 class，不做通用匹配——表情那个弹窗第一个孩子是 <h2>，
       按"第一个孩子"去收会把整块内容一起收没。 */
    #gyfpBody .gym-mgr-hd, #gyfpBody .gymap-hd, #gyfpBody .gyrel-hd,
    #gyfpBody .gygs-hd, #gyfpBody .gykit-hd, #gyfpBody .gyday-hd,
    #gyfpBody .gynow-hd{display:none!important;}
    #gyfpBody .modal-box > h2:first-child{display:none!important;}
    @media(max-width:600px){.gyfp-top{padding:10px 12px;}.gyfp-title{font-size:16px;}.gyfp-body{padding-bottom:110px;}}
    `;

    let current = null;          // 当前搬进页面的那个 def
    let prevDisplay = '';        // 搬走之前那个 modal 的行内 display，还回去时要一模一样
    const restoreAttrs = [];     // [[el, 原 onclick 字符串]]

    function mountView() {
        if (document.getElementById('view-feature-page')) return;
        const st = document.createElement('style'); st.id = 'gyfpStyle'; st.textContent = CSS;
        document.head.appendChild(st);
        const host = document.querySelector('.main-content') || document.body;
        const v = document.createElement('div');
        v.id = 'view-feature-page';
        v.style.display = 'none';
        v.innerHTML = `
            <div class="gyfp-top">
                <button type="button" class="gyfp-back" onclick="gyFeatureBack()">‹ 小功能</button>
                <div class="gyfp-title" id="gyfpTitle">🧩</div>
            </div>
            <div class="gyfp-body" id="gyfpBody"></div>`;
        host.appendChild(v);
    }

    // 把模块自己的「关闭」按钮改写成「返回小功能」。
    // 不改的话它只会把 .on 摘掉，而 .gy-as-page 的 display:block!important 又把它顶回来，
    // 表现就是"点关闭没反应"——比不能关更让人火大。
    function hijackCloseButtons(root, def) {
        if (!def.closeAttr) return;
        root.querySelectorAll('[onclick]').forEach(el => {
            const oc = el.getAttribute('onclick') || '';
            if (oc.indexOf(def.closeAttr) < 0) return;
            restoreAttrs.push([el, oc]);
            el.setAttribute('onclick', 'gyFeatureBack()');
        });
    }
    function releaseCloseButtons() {
        restoreAttrs.forEach(([el, oc]) => { try { el.setAttribute('onclick', oc); } catch (e) {} });
        restoreAttrs.length = 0;
    }

    // 把当前这一页搬回 document.body，恢复成原来的弹窗
    function restore() {
        if (!current) return;
        const def = current;
        current = null;
        releaseCloseButtons();
        try {
            const el = document.getElementById(def.modal);
            if (el) {
                el.classList.remove('gy-as-page');
                if (el.parentElement !== document.body) document.body.appendChild(el);
                el.classList.remove('on');
                // ⚠️ 这里以前写死 style.display='none'，行内样式压过了 `.on{display:flex}`，
                //    结果从页面退出来之后，老的弹窗入口（gymapOpen 之类）就再也打不开了——
                //    类加上了、样式被行内的 none 顶掉。改成还原成搬走之前那个值。
                el.style.display = prevDisplay;
            }
        } catch (e) {}
        // 模块自己的 close 里常有"清定时器 / 清编辑态"的收尾，一定要调。
        // ⚠️ 别再想着从 closeAttr 那个字符串里"推"出函数名——表情那一条的 onclick 是
        //    closeModal('emoticonManagerModal')，推出来会变成不带参数的 closeModal()，
        //    等于把上一个弹窗关错了。每条都显式写 onClose。
        try { if (typeof def.onClose === 'function') def.onClose(); } catch (e) {}
    }
    window.gyFeatureRestore = restore;

    window.gyOpenFeaturePage = function (id) {
        const def = PAGES.find(p => p.id === id);
        if (!def) return;
        mountView();
        if (current && current.id !== id) restore();

        const title = document.getElementById('gyfpTitle');
        if (title) title.innerText = def.icon + ' ' + def.title;
        try { if (typeof mobileViewTitles !== 'undefined') mobileViewTitles.featurePage = def.title; } catch (e) {}
        if (typeof switchMainView === 'function') switchMainView('featurePage');

        // 先让模块按它自己的方式打开+渲染（大多数 render 里都有
        // `if (!box.classList.contains('on')) return;` 这道闸，不走 open() 就是一片空白）
        try { def.open(); } catch (e) { console.warn('[小功能页] ' + def.title + ' 打开出错：', e); }

        setTimeout(() => {
            const el = document.getElementById(def.modal);
            const body = document.getElementById('gyfpBody');
            if (!el || !body) return;
            prevDisplay = el.style.display || '';
            el.classList.add('on', 'gy-as-page');
            el.style.display = '';
            if (el.parentElement !== body) { body.innerHTML = ''; body.appendChild(el); }
            hijackCloseButtons(el, def);
            current = def;
        }, 30);
    };

    window.gyFeatureBack = function () {
        restore();
        if (typeof switchMainView === 'function') switchMainView('miniHub');
    };

    // 核心切到这一页时的回调（js/07 的 featurePage 分支里调）
    window.gyFeatureOnEnterView = function () { /* 内容是 open() 里现搬进来的，这里不用重画 */ };

    // 从这一页离开（点侧边栏、按返回键……）时把节点还回去，
    // 否则下次谁再调 gymapOpen() 会发现弹窗还卡在那个已经隐藏的页面里，怎么点都不出来。
    (function hookLeave() {
        const sw0 = window.switchMainView;
        if (typeof sw0 !== 'function' || sw0.__gyfpLeave) return;
        window.switchMainView = function (viewId) {
            if (viewId !== 'featurePage' && current) restore();
            return sw0.apply(this, arguments);
        };
        window.switchMainView.__gyfpLeave = true;
    })();

    // 注册进「🧩 小功能」
    function registerAll() {
        if (typeof registerMiniFeature !== 'function') return;
        PAGES.forEach(p => registerMiniFeature({
            id: p.id, icon: p.icon, title: p.title, desc: p.desc,
            onOpen: () => window.gyOpenFeaturePage(p.id)
        }));
    }

    function init() {
        mountView();
        registerAll();
        // 模块是异步挂条目的，晚一点再注册一次，保证顺序不影响结果
        setTimeout(registerAll, 1200);
        setTimeout(() => { try { if (typeof harvestMiniFeatureEntries === 'function') harvestMiniFeatureEntries(); } catch (e) {} }, 1400);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
