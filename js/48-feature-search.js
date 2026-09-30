/* ============================================================
   js/48 —— 全站搜索里也能搜「功能」，点一下直接跳过去
   ------------------------------------------------------------
   开关：设置 → 外观 →「🔎 搜索里也搜功能」，**默认开**。

   起因：这个 app 的功能已经多到自己都找不着了——想用一个东西，
   得先想起来它在侧边栏、在设置的哪一页、还是在「🧩 小功能」里。
   现在在搜索结果最上面加一块「功能」：搜到了就直接点，点了就跳过去。

   索引是**现场从页面里扫出来的**，不是手写清单，所以永远不会跟界面对不上：
     · 侧边栏那些 .nav-item（主页 / 聊天 / 故事 / 小功能 …）
     · 设置目录里的 .set-entry（核心那几项）
     · 「🧩 小功能」里注册的 GY_MINI_FEATURES，加上从目录页认领过来的插件条目
     · 自动化开关表 AUTO_FEATURE_DEFS（搜到就跳到 设置 → 自动化那一页）
   点一下就照它原本的 onclick 跑一遍——所以不管那个功能怎么打开的，这儿都能打开。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_featsearch_cfg';
    const S = { on: true };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const ID = 'gyFeatHits';
    let ACTS = [];                     // 点击时要跑的动作，按下标存

    /* ---------- 扫出全部功能 ---------- */
    function index() {
        const out = [];
        const add = (icon, title, desc, where, run) => {
            if (!title) return;
            const t = String(title).trim();
            if (!t || out.some(x => x.title === t)) return;
            out.push({ icon: icon || '🧩', title: t, desc: String(desc || '').trim(), where: where || '', run });
        };
        // ① 侧边栏
        try {
            document.querySelectorAll('.sidebar-left .nav-item').forEach(el => {
                const t = (el.innerText || '').trim().split('\n')[0];
                if (!t) return;
                add('📍', t, '', '侧边栏', () => { try { el.click(); } catch (e) {} });
            });
        } catch (e) {}
        // ② 设置目录里剩下的核心条目
        try {
            document.querySelectorAll('#setIndex .set-entry').forEach(el => {
                const ttl = el.querySelector('.set-entry-title');
                const d = el.querySelector('.set-entry-desc');
                add((el.querySelector('.set-entry-ico') || {}).innerText, ttl && ttl.innerText, d && d.innerText,
                    '设置', () => { try { if (typeof switchMainView === 'function') switchMainView('settings'); setTimeout(() => el.click(), 120); } catch (e) {} });
            });
        } catch (e) {}
        // ③ 小功能（内置注册的）
        try {
            (typeof GY_MINI_FEATURES !== 'undefined' ? GY_MINI_FEATURES : []).forEach(f => {
                add(f.icon, f.title || f.id, f.desc, '🧩 小功能',
                    () => { try { if (typeof gyOpenMiniFeature === 'function') gyOpenMiniFeature(f.id); } catch (e) {} });
            });
        } catch (e) {}
        // ④ 从设置目录认领到小功能页的那些（多半是插件）
        try {
            (typeof GY_ADOPTED_ENTRIES !== 'undefined' ? GY_ADOPTED_ENTRIES : []).forEach(el => {
                const ttl = el.querySelector && el.querySelector('.set-entry-title');
                const d = el.querySelector && el.querySelector('.set-entry-desc');
                add((el.querySelector && (el.querySelector('.set-entry-ico') || {}).innerText) || '🔌',
                    (ttl && ttl.innerText) || (el.innerText || '').trim(), d && d.innerText, '🧩 小功能',
                    () => { try { el.click(); } catch (e) {} });
            });
        } catch (e) {}
        // ⑤ 自动化开关（搜到就带你去那一页）
        try {
            (typeof AUTO_FEATURE_DEFS !== 'undefined' ? AUTO_FEATURE_DEFS : []).forEach(f => {
                add('🎚️', f.label, f.desc, f.where || '设置 → 自动化',
                    () => { try { if (typeof switchMainView === 'function') switchMainView('settings');
                                  setTimeout(() => { if (typeof openSettingsPanel === 'function') openSettingsPanel('auto'); }, 120); } catch (e) {} });
            });
        } catch (e) {}
        return out;
    }

    /* ---------- 找 ---------- */
    function hit(q) {
        const k = String(q || '').trim().toLowerCase();
        if (!k) return [];
        const all = index();
        const score = f => {
            const t = f.title.toLowerCase(), d = (f.desc || '').toLowerCase();
            if (t === k) return 100;
            if (t.indexOf(k) >= 0) return 80 - t.length;     // 越短越像"就是它"
            if (d.indexOf(k) >= 0) return 40;
            return 0;
        };
        return all.map(f => ({ f, s: score(f) })).filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s).slice(0, 8).map(x => x.f);
    }

    /* ---------- 画在搜索结果最上面 ---------- */
    function render(q) {
        const host = document.getElementById('searchFeedSection');
        const old = document.getElementById(ID);
        if (old) old.remove();
        if (!S.on || !host) return;
        const list = hit(q);
        if (!list.length) return;
        ACTS = list.map(f => f.run);
        const box = document.createElement('div');
        box.id = ID; box.className = 'gyfs-box';
        box.innerHTML = `<div class="gyfs-h">功能 · ${list.length} 个</div>` +
            list.map((f, i) => `<button type="button" class="gyfs-row" data-i="${i}">
                <span class="gyfs-ico">${esc(f.icon)}</span>
                <span class="gyfs-main"><span class="gyfs-t">${esc(f.title)}</span>
                ${f.desc ? `<span class="gyfs-d">${esc(f.desc).slice(0, 60)}</span>` : ''}</span>
                <span class="gyfs-w">${esc(f.where)}</span><span class="gyfs-go">›</span>
            </button>`).join('');
        host.insertBefore(box, host.firstChild);
        box.addEventListener('click', ev => {
            const r = ev.target.closest('.gyfs-row'); if (!r) return;
            const fn = ACTS[Number(r.dataset.i)];
            if (typeof fn === 'function') fn();
        });
    }
    window.gyFeatSearchRender = render;

    // 搜索页一画出来就跟着画一块
    const sw0 = window.switchMainView;
    if (sw0 && sw0.call && !sw0.__gyFeatSearch) {
        window.switchMainView = function (v, param) {
            const r = sw0.apply(this, arguments);
            if (v === 'search') { try { setTimeout(() => render(param), 30); } catch (e) {} }
            return r;
        };
        window.switchMainView.__gyFeatSearch = true;
    }

    window.gyFeatSearchSet = function (on) {
        S.on = !!on; save();
        const old = document.getElementById(ID);
        if (!S.on && old) old.remove();
    };
    window.gyFeatSearchRead = () => ({ on: S.on });
    function fillUI() { try { const el = document.getElementById('gyFeatSearchOn'); if (el) el.checked = !!S.on; } catch (e) {} }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyFeatSearch) {
        window.openSettingsPanel = function (k) { const r = op0.apply(this, arguments); if (k === 'appearance') setTimeout(fillUI, 60); return r; };
        window.openSettingsPanel.__gyFeatSearch = true;
    }

    try {
        const st = document.createElement('style');
        st.id = 'gyFeatSearchCss';
        st.textContent = `
#${ID}.gyfs-box { border-bottom: 8px solid rgba(128,128,128,.10); padding: 6px 0 10px; }
#${ID} .gyfs-h { font-size: 12px; opacity: .55; padding: 10px 16px 6px; }
#${ID} .gyfs-row { display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 11px 16px; border: 0; background: none; cursor: pointer; text-align: left;
    color: inherit; font-size: 14px; font-family: inherit; }
#${ID} .gyfs-row:hover { background: rgba(var(--gy-accent-rgb, 29,155,240), .08); }
#${ID} .gyfs-ico { flex: 0 0 auto; font-size: 17px; }
#${ID} .gyfs-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
#${ID} .gyfs-t { font-weight: 600; }
#${ID} .gyfs-d { font-size: 12px; opacity: .55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${ID} .gyfs-w { flex: 0 0 auto; font-size: 11px; opacity: .45; }
#${ID} .gyfs-go { flex: 0 0 auto; opacity: .35; }
`;
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { fillUI(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1200);
    else window.addEventListener('load', () => setTimeout(boot, 1200));

    console.info('[搜功能] 已加载。搜索结果最上面会多一块「功能」，点了直接跳过去（默认开）');
})();
