/* ============================================================
   js/40 —— 侧边栏合并：几个本来就是一回事的页面，合成一个入口
   ------------------------------------------------------------
   侧边栏原来 19 项，从上翻到下要找半天，而里面有好几组其实是同一件事的两面：
     · 世界书 / 插件 / 预设 —— 都是"配一次就放着"的原料，平时根本不进
     · 我们的故事 / 续写   —— 一个存稿一个写稿
   现在各自合成一个入口，进去之后**页面顶上多一条小标签栏**在组内切换。
   ⚠️ 故意不动那几个页面本身：view-worldbook / view-plugins / view-presets /
      view-novel / view-story-studio 的结构、函数、id 全都原样保留，
      这里只是在它们头上挂一条标签栏、并且接管侧边栏那一项的高亮。
      这样万一哪天想拆回去，把这个文件删掉就行，一行业务代码都不用改。
   ============================================================ */
(function () {
    'use strict';

    const GROUPS = [
        {
            // 设定库这一组没有自己的侧边栏行了（它在「更多」菜单里），
            // 所以在这三页里高亮的是「更多」那一行——不然侧边栏上什么都不亮，不知道自己在哪
            id: 'setup', nav: 'nav-more',
            tabs: [
                { view: 'worldbook',   label: '📖 世界书', go: () => { switchMainView('worldbook'); if (typeof renderWorldbookCards === 'function') renderWorldbookCards(); } },
                { view: 'plugins',     label: '🔌 插件',   go: () => switchMainView('plugins') },
                { view: 'presets',     label: '🧩 预设',   go: () => switchMainView('presets') }
            ]
        },
        {
            id: 'story', nav: 'nav-novel',
            tabs: [
                { view: 'novel',       label: '📚 我们的故事', go: () => switchMainView('novel') },
                { view: 'storyStudio', label: '✍️ 续写',      go: () => switchMainView('storyStudio') }
            ]
        }
    ];
    // viewId（switchMainView 用的那个名字）→ 真正的 DOM 容器 id
    const VIEW_EL = {
        worldbook: 'view-worldbook', plugins: 'view-plugins', presets: 'view-presets',
        novel: 'view-novel', storyStudio: 'view-story-studio'
    };

    function groupOf(viewId) {
        return GROUPS.find(g => g.tabs.some(t => t.view === viewId)) || null;
    }

    function paint(viewId) {
        // 先把所有标签栏摘掉，免得切走之后还挂在那儿
        document.querySelectorAll('.gynavg-tabs').forEach(el => el.remove());
        const g = groupOf(viewId);
        if (!g) return;
        const host = document.getElementById(VIEW_EL[viewId]);
        if (!host) return;

        const bar = document.createElement('div');
        bar.className = 'gynavg-tabs';
        bar.innerHTML = g.tabs.map((t, i) =>
            `<button class="gynavg-tab${t.view === viewId ? ' on' : ''}" data-g="${g.id}" data-i="${i}">${t.label}</button>`
        ).join('');
        bar.addEventListener('click', e => {
            const b = e.target.closest('.gynavg-tab'); if (!b) return;
            const grp = GROUPS.find(x => x.id === b.dataset.g); if (!grp) return;
            const tab = grp.tabs[Number(b.dataset.i)]; if (!tab) return;
            try { tab.go(); } catch (err) { console.warn('[侧边栏分组] 切换出错：', err); }
        });

        /* 挂在哪儿：**优先挂进这一页自己的滚动区里**，当它的第一行。
           ⚠️ 原来是挂在标题栏后面、并且自己也写了 position:sticky;top:0。
           可页面的 .header-title 同样是 sticky;top:0，z-index 还比它大（10 vs 5），
           于是两条贴在同一个位置、标签栏整条被压在标题栏底下——
           页面上只剩一条白带子，看着就是"上面的切换栏不见了"。
           窄窗口下必现（那时候整页是滚着的，标题栏一直钉在顶上）。
           挂进滚动区里就彻底没这个问题：它跟着内容走，谁也盖不住它。 */
        const scroller = [...host.children].find(el => {
            const o = getComputedStyle(el).overflowY;
            return (o === 'auto' || o === 'scroll') && el.clientHeight > 40;
        });
        if (scroller) {
            scroller.insertAdjacentElement('afterbegin', bar);
            /* 这一页的 .header-title 是 sticky 的、z-index 10，而滚动区的顶边在它**底下**：
               窄窗口下滚动区最上面那几十像素本来就压在标题栏后面。
               所以挂进去还不够，还得量一量差了多少、把自己让开——
               不让的话标签栏整条藏在标题栏后面，看着就是"切换栏不见了"。 */
            try {
                const hd0 = host.querySelector('.header-title');
                if (hd0) {
                    const need = Math.round(hd0.getBoundingClientRect().bottom - bar.getBoundingClientRect().top);
                    if (need > 0) bar.style.marginTop = need + 'px';
                }
            } catch (e) {}
        } else {
            const hd = host.querySelector('.header-title');
            if (hd && hd.parentNode === host) hd.insertAdjacentElement('afterend', bar);
            else host.insertAdjacentElement('afterbegin', bar);
        }

        // 侧边栏那一项的高亮：组里任何一页都算这一项亮着
        const nav = document.getElementById(g.nav);
        if (nav) nav.className = 'nav-item active';
    }

    // 接管 switchMainView：原函数照跑，跑完再画标签栏。
    // 不改 js/07 一个字——那个函数又长又多分支，动它风险远大于在外面包一层。
    function hook() {
        if (typeof window.switchMainView !== 'function' || window.switchMainView.__gyNavG) return false;
        const orig = window.switchMainView;
        const wrapped = function (viewId) {
            const r = orig.apply(this, arguments);
            try { paint(viewId); } catch (e) { console.warn('[侧边栏分组] 画标签栏出错：', e); }
            return r;
        };
        wrapped.__gyNavG = true;
        window.switchMainView = wrapped;
        return true;
    }

    // 「日常」「关系网」搬进小功能：都是"想起来才看一眼"的东西，占着侧边栏一行不值当。
    function hookMini() {
        if (typeof registerMiniFeature !== 'function') return;
        registerMiniFeature({
            id: 'grapevine', icon: '📰', title: '日常',
            desc: '营销号、Ta们在做什么、八卦网三合一——背着你发生的事都在这儿',
            onOpen: () => { if (typeof switchMainView === 'function') switchMainView('grapevine'); }
        });
        registerMiniFeature({
            id: 'factionNetwork', icon: '🕸️', title: '关系网',
            desc: '谁跟谁什么关系，一张图看完——势力、羁绊、亲疏都画在上面',
            onOpen: () => { if (typeof switchMainView === 'function') switchMainView('factionNetwork'); }
        });
    }

    /* ---------- 「更多」菜单 ----------
       配置类的东西（设定库、记忆总览）不值得天天占一行，但塞进小功能页又得点两次才到。
       X 的做法是一个「更多」弹出菜单：行数省了，东西还是一次点击就能到。这里照抄这个思路。
       MORE 是个数组，以后想往里加只要 push 一条，不用动侧边栏。 */
    const MORE = [
        { icon: '📖', label: '设定库', sub: '世界书 / 插件 / 预设',
          go: () => { switchMainView('worldbook'); if (typeof renderWorldbookCards === 'function') renderWorldbookCards(); } },
        { icon: '🧠', label: '记忆总览', sub: '各类记忆、自动总结、向量记忆',
          go: () => switchMainView('memoryHub') },
        { icon: '🔄', label: '刷新', sub: '导入插件后不用大退 App',
          go: () => { if (typeof refreshAppPage === 'function') refreshAppPage(); } }
    ];
    window.gyMoreMenu = function (ev) {
        if (ev) { ev.stopPropagation(); ev.preventDefault(); }
        const old = document.getElementById('gyMoreMenu');
        if (old) { old.remove(); return; }   // 再点一次就收起来
        const anchor = document.getElementById('nav-more');
        const m = document.createElement('div');
        m.id = 'gyMoreMenu'; m.className = 'gy-more-menu';
        m.innerHTML = MORE.map((x, i) =>
            `<button type="button" class="gy-more-it" data-i="${i}">
                <span class="gy-more-ic">${x.icon}</span>
                <span><b>${x.label}</b><em>${x.sub}</em></span>
             </button>`).join('');
        m.addEventListener('click', e => {
            const b = e.target.closest('.gy-more-it'); if (!b) return;
            const it = MORE[Number(b.dataset.i)];
            m.remove();
            if (it) { try { it.go(); } catch (err) { console.warn('[更多] 打开出错：', err); } }
        });
        document.body.appendChild(m);
        // 贴着「更多」那一行弹出来；地方不够就往上翻
        if (anchor) {
            const r = anchor.getBoundingClientRect();
            const h = m.getBoundingClientRect().height;
            // 往上弹：菜单底边贴着「更多」这一行的底边。
            // 往下弹的话会正好盖住底下的「设置」——那一项是常用的，不该被菜单挡住。
            m.style.left = Math.round(r.left + 8) + 'px';
            m.style.top = Math.round(Math.max(12, Math.min(r.bottom - h, window.innerHeight - h - 12))) + 'px';
        }
        setTimeout(() => {
            document.addEventListener('click', function off(e) {
                if (m.contains(e.target)) return;
                m.remove(); document.removeEventListener('click', off);
            });
        }, 0);
    };

    const CSS = `
    /* ⚠️ 这里原来写的是 position:sticky;top:0;z-index:5。
       可页面自己的 .header-title 也是 sticky;top:0，而且 z-index:10 ——
       两个都往同一个 top:0 上贴，标签栏就整条被标题栏盖在底下，
       页面上只剩一条白带子，看着就是"切换栏没了"。（窄窗口下必现。）
       它本来就在滚动区外面、不会被滚走，根本不需要 sticky，去掉即可。 */
    .gynavg-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:10px 20px;
        border-bottom:1px solid var(--gy-border,#eff3f4);position:relative;z-index:4;
        background:var(--gy-bg,#fff);flex-shrink:0;}
    .gynavg-tab{border:1px solid var(--gy-border,#dfe4e8);background:transparent;
        color:var(--gy-sub,#536471);font-size:13px;padding:5px 14px;border-radius:999px;
        cursor:pointer;line-height:1.6;transition:.15s;}
    .gynavg-tab:hover{border-color:#1d9bf0;color:#1d9bf0;}
    .gynavg-tab.on{background:#1d9bf0;border-color:#1d9bf0;color:#fff;font-weight:600;}
    @media (max-width:700px){ .gynavg-tabs{padding:8px 12px;} .gynavg-tab{padding:4px 11px;font-size:12px;} }

    /* logo 那一行：左边 logo，右边一颗小刷新（原来刷新占着整整一行导航） */
    .gy-logo-row{display:flex;align-items:center;justify-content:space-between;gap:6px;}
    .gy-mini-icon{background:transparent;border:none;cursor:pointer;padding:7px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;transition:background-color .2s;flex-shrink:0;}
    .gy-mini-icon:hover{background-color:rgba(var(--gy-accent-rgb),.12);}

    /* 「更多」弹出菜单 */
    .gy-more-menu{position:fixed;z-index:9999;min-width:232px;padding:6px;border-radius:14px;
        background:var(--gy-bg,#fff);border:1px solid var(--gy-border,#eff3f4);
        box-shadow:0 8px 28px rgba(0,0,0,.16);}
    .gy-more-it{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;
        background:transparent;border-radius:10px;cursor:pointer;text-align:left;color:inherit;font:inherit;}
    .gy-more-it:hover{background:rgba(var(--gy-accent-rgb),.1);}
    .gy-more-ic{font-size:18px;flex-shrink:0;}
    .gy-more-it b{display:block;font-size:14px;font-weight:600;line-height:1.5;}
    .gy-more-it em{display:block;font-size:11px;font-style:normal;opacity:.6;line-height:1.5;}`;

    function init() {
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
        hook();
        hookMini();
        // 有些模块是延迟注册的，隔一会儿再补一次（注册表自己会按 id 去重）
        setTimeout(() => { hook(); hookMini(); }, 1200);
        setTimeout(() => { hook(); hookMini(); }, 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.gyNavGroupPaint = paint;   // 给测试用
})();

/* ============================================================
   🎨 示例样式库 —— 全局界面自定义(CSS) 那一栏底下
   ------------------------------------------------------------
   原来那儿只有一个"选择器速查表"：告诉你有哪些类名，但不告诉你**该写什么**。
   知道 .chat-bubble.other 这个名字，跟知道怎么把气泡改成毛玻璃，是两件事。
   这里把常用的改法整理成一条条可以直接用的片段，点一下就追加进输入框，
   再照着数值自己调。全部用的是这个 app 里真实存在的类名，贴进去就生效。
   ============================================================ */
(function () {
    'use strict';

    const RECIPES = [
        { g: '聊天气泡', items: [
            { t: '对方气泡换个颜色', c: `.chat-bubble.other {\n    background: #7b6cf6 !important;\n    color: #fff !important;\n}` },
            { t: '我的气泡换个颜色', c: `.chat-bubble.me {\n    background: #fff4e6 !important;\n    color: #3d2b1f !important;\n    border-color: #f0d9bd !important;\n}` },
            { t: '气泡改成毛玻璃', c: `.chat-bubble {\n    backdrop-filter: blur(10px);\n    background: rgba(255,255,255,.55) !important;\n    border: 1px solid rgba(255,255,255,.7) !important;\n}` },
            { t: '气泡圆角更圆 / 更方', c: `.chat-bubble {\n    border-radius: 18px !important;   /* 想更方就改成 6px */\n}` },
            { t: '气泡加阴影', c: `.chat-bubble {\n    box-shadow: 0 2px 10px rgba(0,0,0,.08) !important;\n}` },
            { t: '聊天字大一点', c: `.chat-bubble {\n    font-size: 16px !important;\n    line-height: 1.75 !important;\n}` },
            { t: '气泡窄一点（不要占满屏）', c: `.chat-bubble {\n    max-width: 62% !important;\n}` }
        ]},
        { g: '整体配色 / 字体', items: [
            { t: '换主题色（蓝色改成别的）', c: `:root {\n    --gy-accent: #e0719c;\n    --gy-accent-rgb: 224,113,156;\n}` },
            { t: '整个 App 换字体', c: `body, .chat-bubble, .post-body {\n    font-family: "霞鹜文楷", "LXGW WenKai", serif !important;\n}` },
            { t: '全局字号放大', c: `body {\n    font-size: 16px !important;\n}` },
            { t: '整页加背景图', c: `body {\n    background-image: url("图片直链地址") !important;\n    background-size: cover !important;\n    background-attachment: fixed !important;\n}` },
            { t: '背景图上给内容加一层半透明底', c: `.main-content {\n    background: rgba(255,255,255,.82) !important;\n    backdrop-filter: blur(2px);\n}` }
        ]},
        { g: '侧边栏', items: [
            { t: '侧边栏字小一点', c: `.nav-item {\n    font-size: 17px !important;\n}\n.nav-icon {\n    width: 22px !important;\n    height: 22px !important;\n}` },
            { t: '行距更紧凑（一屏塞更多）', c: `.nav-item {\n    padding: 8px 18px 8px 8px !important;\n    margin: 1px 0 !important;\n}` },
            { t: '当前页高亮加个底色', c: `.nav-item.active {\n    background: rgba(var(--gy-accent-rgb), .12) !important;\n}` },
            { t: '藏掉 logo', c: `.logo img {\n    display: none !important;\n}` },
            { t: '侧边栏换个底色', c: `.sidebar-left {\n    background: #fbf7f2 !important;\n}` }
        ]},
        { g: '推文 / 时间线', items: [
            { t: '推文之间加间距', c: `.post-body {\n    padding: 16px 18px !important;\n}` },
            { t: '推文正文字号', c: `.post-content {\n    font-size: 16px !important;\n    line-height: 1.8 !important;\n}` },
            { t: '头像改成方的', c: `.avatar {\n    border-radius: 12px !important;\n}` },
            { t: '藏掉推文底下那排数据', c: `.post-footer {\n    display: none !important;\n}` }
        ]},
        { g: '页面骨架', items: [
            { t: '正文区更窄（宽屏看着不散）', c: `.main-content {\n    max-width: 680px !important;\n    margin: 0 auto !important;\n}` },
            { t: '页面标题栏加毛玻璃', c: `.header-title {\n    backdrop-filter: blur(12px);\n    background: rgba(255,255,255,.72) !important;\n}` },
            { t: '藏掉右边那一栏', c: `.sidebar-right {\n    display: none !important;\n}` },
            { t: '滚动条细一点', c: `::-webkit-scrollbar {\n    width: 6px;\n    height: 6px;\n}\n::-webkit-scrollbar-thumb {\n    background: rgba(0,0,0,.18);\n    border-radius: 999px;\n}` }
        ]},
        { g: '按钮 / 输入框', items: [
            { t: '主按钮换色', c: `.btn-post {\n    background: #2f3640 !important;\n    color: #fff !important;\n}` },
            { t: '输入框圆角加大', c: `input, textarea, select {\n    border-radius: 12px !important;\n}` },
            { t: '输入框聚焦时描边', c: `input:focus, textarea:focus {\n    border-color: var(--gy-accent) !important;\n    box-shadow: 0 0 0 3px rgba(var(--gy-accent-rgb), .15) !important;\n}` }
        ]},
        { g: '动效 / 小花样', items: [
            { t: '所有东西淡入', c: `.post-body, .chat-bubble {\n    animation: gyFadeIn .35s ease;\n}\n@keyframes gyFadeIn {\n    from { opacity: 0; transform: translateY(6px); }\n    to   { opacity: 1; transform: none; }\n}` },
            { t: '鼠标移上去轻微放大', c: `.nav-item, .btn-post {\n    transition: transform .15s ease;\n}\n.nav-item:hover, .btn-post:hover {\n    transform: scale(1.03);\n}` },
            { t: '关掉所有动画（晕动症友好）', c: `* {\n    animation: none !important;\n    transition: none !important;\n}` }
        ]}
    ];

    window.gyCssEgRender = function () {
        const box = document.getElementById('gyCssEg');
        if (!box) return;
        const kw = (document.getElementById('gyCssEgSearch') || {}).value || '';
        const k = kw.trim().toLowerCase();
        let html = '';
        RECIPES.forEach((grp, gi) => {
            const hit = grp.items.filter((it, ii) =>
                !k || grp.g.toLowerCase().includes(k) || it.t.toLowerCase().includes(k) || it.c.toLowerCase().includes(k));
            if (!hit.length) return;
            html += `<div class="gy-css-grp"><div class="gy-css-grp-hd">${grp.g}</div><div class="gy-cssEg-line">`;
            hit.forEach(it => {
                const i = grp.items.indexOf(it);
                html += `<button type="button" class="gy-cssEg" data-g="${gi}" data-i="${i}" title="点一下加进上面的输入框">${it.t}</button>`;
            });
            html += `</div></div>`;
        });
        box.innerHTML = html || '<div style="color:#8b98a5;font-size:13px;padding:12px 2px;">没有匹配的示例。</div>';
    };

    window.gyCssEgPick = function (gi, ii) {
        const it = RECIPES[gi] && RECIPES[gi].items[ii];
        const ta = document.getElementById('globalCSSInput');
        if (!it || !ta) return;
        ta.value = (ta.value && !ta.value.endsWith('\n') ? ta.value + '\n\n' : ta.value) + `/* ${it.t} */\n${it.c}\n`;
        ta.focus();
        try { ta.setSelectionRange(ta.value.length, ta.value.length); ta.scrollTop = ta.scrollHeight; } catch (e) {}
        if (typeof showToast === 'function') showToast('', '已加进 CSS 框', it.t + '（记得点最底下的保存）', null, null, false);
    };

    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('.gy-cssEg');
        if (b) window.gyCssEgPick(Number(b.dataset.g), Number(b.dataset.i));
    });

    const EGCSS = `
    .gy-cssEg-line{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px;}
    .gy-cssEg{border:1px solid var(--gy-border,#cfd9de);background:transparent;color:inherit;
        font-size:12.5px;padding:5px 11px;border-radius:999px;cursor:pointer;line-height:1.6;transition:.15s;}
    .gy-cssEg:hover{border-color:#1d9bf0;color:#1d9bf0;background:rgba(29,155,240,.06);}`;
    const st = document.createElement('style'); st.textContent = EGCSS;
    (document.head || document.documentElement).appendChild(st);
})();
