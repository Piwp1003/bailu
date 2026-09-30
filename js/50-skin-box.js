/* ============================================================
   js/50 —— 🎨 皮肤盒子
   ------------------------------------------------------------
   开关：设置 → 外观 →「🎨 皮肤盒子」，**默认开**。
   关掉就一个节点都不建，「全局界面自定义 (CSS)」还是原来那个光秃秃的输入框。

   起因：换一次皮肤就要去翻 .css 文件、全选、复制、粘贴、保存，
   换回来再来一遍。这一块把这件事收成**存一次，以后点一下就换**。

   它做什么：
     · 把现在框里的 CSS **存成一张皮肤**，自己起名字
     · 也可以直接**选一个 .css 文件存进来**，不用打开文件复制粘贴
     · 列表里点哪张就换成哪张，顶上那条「原样」是不用皮肤
     · 改名、删除、把框里改过的内容**回存到当前这张**
     · 🧩 小功能里也放了一个入口，不进设置也能一键换

   存在哪：皮肤列表存在浏览器本地（localStorage），
   同时**跟着存档走**——导出存档时自动带上，换设备导入就还在。

   不碰项目原来的东西：不改 applyGlobalCSS、不改保存设置那条逻辑，
   换皮肤走的就是项目自己的 globalCustomCSS + applyGlobalCSS()。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_skinbox_cfg';
    const LSL = 'gy_skinbox_list';
    const LSA = 'gy_skinbox_active';

    const S = { on: true };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    let LIST = [];
    try { LIST = JSON.parse(localStorage.getItem(LSL) || '[]') || []; } catch (e) { LIST = []; }
    if (!Array.isArray(LIST)) LIST = [];
    let ACTIVE = '';
    try { ACTIVE = localStorage.getItem(LSA) || ''; } catch (e) {}

    const saveList = () => {
        try { localStorage.setItem(LSL, JSON.stringify(LIST)); } catch (e) {
            alert('皮肤没存下——浏览器本地空间满了。删掉几张旧的再试。');
        }
        try { localStorage.setItem(LSA, ACTIVE || ''); } catch (e) {}
    };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const newId = () => 'sk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const kb = n => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');

    function toast(t) {
        // showToast 的签名是 (头像, 标题, 正文, …)，只传一个参数的话标题那一格会写成 undefined
        try { if (typeof showToast === 'function') return showToast('', '🎨 皮肤', t, null, null, false); } catch (e) {}
        try { console.info('[皮肤盒子] ' + t); } catch (e) {}
    }

    /* ---------- 当前框里 / 当前生效的 CSS ---------- */
    function curCss() {
        const ta = document.getElementById('globalCSSInput');
        if (ta && typeof ta.value === 'string' && ta.value.trim()) return ta.value;
        try { if (typeof globalCustomCSS === 'string') return globalCustomCSS; } catch (e) {}
        return '';
    }

    /* ---------- 换皮肤：走项目自己那条路 ---------- */
    function applyCss(css) {
        try { (0, eval)('globalCustomCSS = ' + JSON.stringify(String(css || ''))); } catch (e) {}
        try { const ta = document.getElementById('globalCSSInput'); if (ta) ta.value = String(css || ''); } catch (e) {}
        try { if (typeof applyGlobalCSS === 'function') applyGlobalCSS(); } catch (e) {}
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    }

    // ⚠️ 这几个是**点了就执行**的，不受开关管（开关只管这一块显不显示）
    window.gySkinUse = function (id) {
        if (!id) { ACTIVE = ''; applyCss(''); saveList(); render(); toast('已换回原样'); return; }
        const sk = LIST.find(x => x.id === id);
        if (!sk) return;
        ACTIVE = id; applyCss(sk.css); saveList(); render();
        toast('已换成「' + sk.name + '」');
    };

    // 打包成 exe（Electron）之后原生 prompt() 是死的——用项目自己的输入框（js/12 的 appPrompt）
    const ask = (msg, dft) => (typeof appPrompt === 'function') ? appPrompt(msg, dft) : Promise.resolve(window.prompt(msg, dft));
    window.gySkinSaveNew = async function (presetCss, presetName) {
        const css = (typeof presetCss === 'string' && presetCss) ? presetCss : curCss();
        if (!String(css).trim()) return alert('框里是空的，没东西可存。\n先把 CSS 贴进上面那个框，或者用下面的「选个 .css 文件」。');
        let name = presetName;
        if (!name) name = await ask('给这张皮肤起个名字：', '我的皮肤 ' + (LIST.length + 1));
        if (name === null) return;
        name = String(name).trim() || ('皮肤 ' + (LIST.length + 1));
        const sk = { id: newId(), name, css: String(css), at: Date.now() };
        LIST.push(sk); ACTIVE = sk.id; saveList();
        // 存完顺手套上——从文件存进来的那条尤其需要，不然存了却看不见效果
        applyCss(sk.css); render();
        toast('存好了：' + name);
    };

    window.gySkinRename = async function (id) {
        const sk = LIST.find(x => x.id === id); if (!sk) return;
        const n = await ask('改个名字：', sk.name);
        if (n === null) return;
        sk.name = String(n).trim() || sk.name;
        saveList(); render();
    };

    window.gySkinDelete = function (id) {
        const sk = LIST.find(x => x.id === id); if (!sk) return;
        if (!confirm('删掉「' + sk.name + '」？\n（只删这张存下来的皮肤，不影响现在界面的样子）')) return;
        LIST = LIST.filter(x => x.id !== id);
        if (ACTIVE === id) ACTIVE = '';
        saveList(); render();
        toast('删掉了：' + sk.name);
    };

    // 在框里改了几行，想把改动**回存到当前这张**
    window.gySkinUpdate = function () {
        const sk = LIST.find(x => x.id === ACTIVE);
        if (!sk) return alert('现在没有在用哪一张皮肤。\n先点一张，或者用「存成新皮肤」。');
        const css = curCss();
        if (!confirm('把上面框里的内容存回「' + sk.name + '」？\n（原来那份会被盖掉）')) return;
        sk.css = String(css); sk.at = Date.now();
        saveList(); applyCss(sk.css); render();
        toast('「' + sk.name + '」已更新');
    };

    // 选一个 .css 文件直接存进来——省掉打开文件复制粘贴那一趟
    window.gySkinPickFile = function (input) {
        const f = input && input.files && input.files[0];
        input.value = '';
        if (!f) return;
        // 皮肤文件不设大小上限（以前超过 2MB 就不收）
        const fr = new FileReader();
        fr.onload = () => {
            const css = String(fr.result || '');
            if (!css.trim()) return alert('这个文件是空的。');
            const nm = String(f.name || '').replace(/\.css$/i, '') || '导入的皮肤';
            window.gySkinSaveNew(css, nm);
        };
        fr.onerror = () => alert('这个文件读不出来。');
        fr.readAsText(f, 'utf-8');
    };

    // 把某一张存成 .css 文件拿出去
    window.gySkinExport = function (id) {
        const sk = LIST.find(x => x.id === id); if (!sk) return;
        try {
            if (typeof saveTextFileForApp === 'function') return saveTextFileForApp(sk.name + '.css', sk.css, 'text/css');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([sk.css], { type: 'text/css' }));
            a.download = sk.name + '.css'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        } catch (e) { alert('导出失败：' + e); }
    };

    /* ---------- 设置里那一块 ---------- */
    function rowsHtml(compact) {
        const cur = curCss();
        const rows = [`
            <div class="gysk-row${ACTIVE ? '' : ' on'}" onclick="gySkinUse('')">
                <span class="gysk-dot"></span>
                <span class="gysk-nm">原样（不用皮肤）</span>
                <span class="gysk-sz">${ACTIVE ? '' : '正在用'}</span>
            </div>`];
        LIST.forEach(sk => {
            const on = sk.id === ACTIVE;
            rows.push(`
            <div class="gysk-row${on ? ' on' : ''}" onclick="gySkinUse('${sk.id}')">
                <span class="gysk-dot"></span>
                <span class="gysk-nm">${esc(sk.name)}</span>
                <span class="gysk-sz">${on ? '正在用' : kb((sk.css || '').length)}</span>
                ${compact ? '' : `<span class="gysk-ops">
                    <button type="button" onclick="event.stopPropagation(); gySkinRename('${sk.id}')">改名</button>
                    <button type="button" onclick="event.stopPropagation(); gySkinExport('${sk.id}')">导出</button>
                    <button type="button" onclick="event.stopPropagation(); gySkinDelete('${sk.id}')">删除</button>
                </span>`}
            </div>`);
        });
        if (!LIST.length) rows.push(`<div class="gysk-empty">还没存过皮肤。把 CSS 贴进上面那个框，点「存成新皮肤」；
            或者直接选一个 .css 文件存进来。</div>`);
        if (!compact && ACTIVE && cur && (LIST.find(x => x.id === ACTIVE) || {}).css !== cur) {
            rows.push(`<div class="gysk-diff">⚠️ 上面框里的内容跟「${esc((LIST.find(x => x.id === ACTIVE) || {}).name || '')}」存下来的那份不一样了——
                想留下这些改动就点「存回当前皮肤」。</div>`);
        }
        return rows.join('');
    }

    function render() {
        const host = document.getElementById('gySkinBox');
        if (!host) return;
        if (!S.on) { host.innerHTML = ''; host.style.display = 'none'; return; }
        host.style.display = '';
        host.innerHTML = `
            <div class="gysk-list">${rowsHtml(false)}</div>
            <div class="gysk-bar">
                <button type="button" class="gysk-b main" onclick="gySkinSaveNew()">＋ 把框里的 CSS 存成新皮肤</button>
                <button type="button" class="gysk-b" onclick="gySkinUpdate()">存回当前皮肤</button>
                <label class="gysk-b file">选个 .css 文件存进来
                    <input type="file" accept=".css,text/css" onchange="gySkinPickFile(this)" style="display:none;">
                </label>
            </div>`;
    }
    window.gySkinRender = render;

    window.gySkinBoxSet = function (on) {
        S.on = !!on; saveCfg(); render();
        try { if (!S.on) closeModal(); } catch (e) {}
    };
    window.gySkinBoxRead = () => ({ on: S.on, count: LIST.length, active: ACTIVE });

    /* ---------- 🧩 小功能里的快捷入口：不进设置也能换 ---------- */
    const MID = 'gySkinModal';
    function closeModal() { const m = document.getElementById(MID); if (m) m.remove(); }
    window.gySkinQuick = function () {
        closeModal();
        const m = document.createElement('div');
        m.id = MID; m.className = 'modal-overlay'; m.style.display = 'flex'; m.style.zIndex = '3200';
        m.innerHTML = `
            <div class="modal-box" style="width:380px; max-width:92vw;">
                <h2 style="margin-top:0;">🎨 换个皮肤</h2>
                <div class="gysk-list">${rowsHtml(true)}</div>
                <div style="font-size:12px; opacity:.6; margin-top:10px; line-height:1.7;">
                    点一下就换，换完立刻生效。存皮肤、改名、删除在
                    设置 → 外观与主题 →「🎨 皮肤盒子」。
                </div>
                <div style="text-align:right; margin-top:14px;">
                    <button type="button" class="btn-cancel" onclick="gySkinCloseQuick()">关闭</button>
                </div>
            </div>`;
        m.addEventListener('click', ev => { if (ev.target === m) closeModal(); });
        document.body.appendChild(m);
    };
    window.gySkinCloseQuick = closeModal;

    // 点完立刻把弹窗里的"正在用"也刷新
    const use0 = window.gySkinUse;
    window.gySkinUse = function (id) {
        const r = use0.apply(this, arguments);
        try {
            const m = document.getElementById(MID);
            if (m) m.querySelector('.gysk-list').innerHTML = rowsHtml(true);
        } catch (e) {}
        return r;
    };

    try {
        if (typeof registerMiniFeature === 'function') {
            registerMiniFeature({
                id: 'gySkinBox', icon: '🎨', title: '皮肤',
                desc: '存好的界面皮肤，点一下就换',
                onOpen: () => window.gySkinQuick()
            });
        }
    } catch (e) {}

    /* ---------- 跟着存档走 ---------- */
    const snap0 = window.getFullDataSnapshot;
    if (snap0 && snap0.call && !snap0.__gySkin) {
        window.getFullDataSnapshot = function () {
            const d = snap0.apply(this, arguments);
            try { if (d && LIST.length) { d.__gySkins = LIST; d.__gySkinActive = ACTIVE || ''; } } catch (e) {}
            return d;
        };
        window.getFullDataSnapshot.__gySkin = true;
    }
    async function absorb() {
        let rec = null;
        try { rec = await localforage.getItem('myTwitterAppData'); } catch (e) { return; }
        if (!rec || !Array.isArray(rec.__gySkins)) return;
        // 存档里的大图是引用（增量保存），换回原图再用
        try { if (typeof window.gyResolveImgRefs === 'function') await window.gyResolveImgRefs(rec.__gySkins); } catch (e) {}
        let n = 0;
        rec.__gySkins.forEach(sk => {
            if (!sk || !sk.id || LIST.find(x => x.id === sk.id)) return;
            LIST.push(sk); n++;
        });
        if (!ACTIVE && rec.__gySkinActive) ACTIVE = rec.__gySkinActive;
        if (n) { saveList(); render(); toast('从存档里带回了 ' + n + ' 张皮肤'); }
    }
    const load0 = window.loadAllData;
    if (load0 && load0.call && !load0.__gySkin) {
        window.loadAllData = async function () {
            const r = await load0.apply(this, arguments);
            try { await absorb(); } catch (e) {}
            try { render(); } catch (e) {}
            return r;
        };
        window.loadAllData.__gySkin = true;
    }

    /* ---------- 进设置那一页时刷新 ---------- */
    function fillUI() {
        try { const el = document.getElementById('gySkinBoxOn'); if (el) el.checked = !!S.on; } catch (e) {}
        render();
    }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gySkin) {
        window.openSettingsPanel = function (k) {
            const r = op0.apply(this, arguments);
            if (k === 'appearance') setTimeout(fillUI, 60);
            return r;
        };
        window.openSettingsPanel.__gySkin = true;
    }

    /* ---------- 样式：跟着项目主题变量走 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gySkinBoxCss';
        st.textContent = `
#gySkinBox .gysk-list { display:flex; flex-direction:column; gap:6px; }
#gySkinModal .gysk-list { display:flex; flex-direction:column; gap:6px; max-height:52vh; overflow:auto; }
.gysk-row { display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer;
            border:1px solid var(--gy-line, #cfd9de); border-radius:10px; font-size:14px;
            transition:background-color .15s, border-color .15s; }
.gysk-row:hover { background:rgba(var(--gy-accent-rgb, 29,155,240), .07); }
.gysk-row.on { border-color:var(--gy-accent, #1d9bf0); background:rgba(var(--gy-accent-rgb, 29,155,240), .09); }
.gysk-dot { width:10px; height:10px; border-radius:50%; flex:0 0 10px;
            border:2px solid var(--gy-line, #cfd9de); box-sizing:border-box; }
.gysk-row.on .gysk-dot { border-color:var(--gy-accent, #1d9bf0); background:var(--gy-accent, #1d9bf0); }
.gysk-nm { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gysk-sz { flex:0 0 auto; font-size:12px; opacity:.55; }
.gysk-ops { flex:0 0 auto; display:flex; gap:6px; }
.gysk-ops button { font-size:12px; padding:4px 9px; border-radius:7px; cursor:pointer;
                   border:1px solid var(--gy-line, #cfd9de); background:transparent; color:inherit; }
.gysk-ops button:hover { border-color:var(--gy-accent, #1d9bf0); color:var(--gy-accent, #1d9bf0); }
.gysk-empty { font-size:13px; opacity:.6; line-height:1.8; padding:10px 2px; }
.gysk-diff { font-size:12.5px; line-height:1.7; padding:8px 10px; margin-top:2px;
             border-radius:8px; background:rgba(var(--gy-warn-rgb, 255,212,0), .16); }
.gysk-bar { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.gysk-b { font-size:13px; padding:8px 14px; border-radius:9px; cursor:pointer;
          border:1px solid var(--gy-line, #cfd9de); background:transparent; color:inherit; }
.gysk-b:hover { border-color:var(--gy-accent, #1d9bf0); color:var(--gy-accent, #1d9bf0); }
.gysk-b.main { border-color:var(--gy-accent, #1d9bf0); color:var(--gy-accent, #1d9bf0); font-weight:600; }
/* 它是个 <label>（里头藏着 file input），不压一下会被设置页的 .input-group label 染成蓝色粗体 */
.gysk-b.file { display:inline-flex; align-items:center; color:inherit; font-weight:400; font-size:13px; margin:0; }
.gysk-b.file:hover { color:var(--gy-accent, #1d9bf0); }
`;
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { fillUI(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1000);
    else window.addEventListener('load', () => setTimeout(boot, 1000));

    console.info('[皮肤盒子] 已加载。设置 → 外观 →「🎨 皮肤盒子」，或 🧩 小功能 →「🎨 皮肤」');
})();
