/* ============================================================
   js/68 —— 🔤 自定义字体（全站）
   ------------------------------------------------------------
   入口：设置 → 外观 →「🔤 自定义字体」（插在「🔠 字号」那一块下面）。

   两种加法：
     · 上传字体文件：ttf / otf / woff / woff2，多大都行，不设上限。
       文件原样存进 IndexedDB（localforage 的 guyuFonts 库），**不进存档**——
       一个中文字体动辄十几 MB，塞进存档每次保存都会卡。
     · 粘贴链接：
         - 直接指向字体文件的链接（.ttf/.woff2…，或 data:font/… ）→ 用 FontFace 加载
         - CSS 样式表链接（Google Fonts、各种字体 CDN 的 @import 地址）→ 插一个 <link>，
           字体名先试着把 CSS 抓下来自动认（@font-face 里的 font-family），
           抓不到（跨域）就请你自己填。
         也可以直接粘 `@import url(...)` 或 `<link href="...">` 整句，会自己把地址抠出来。

   怎么生效：在 <html> 上挂 class="gy-ufont" + 变量 --gy-user-font，
   再用一条高优先级规则把 body / 按钮 / 输入框 / 下拉框 的字体换掉，
   顺手把全站的 --gy-font 也指过去（手机模式、相册等用 var(--gy-font) 的地方跟着变）。
   等宽字体（代码块）不动。

   对外：
     window.gyUserFont()   → 当前用的字体名（没设就是 ''）
     window 上的 'gy:font' 事件 → 每次换字体/恢复默认都会发，手机模式可以听这个
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyCustomFontLoaded) return;
    window.__gyCustomFontLoaded = true;

    const LSK = 'gyUserFontsV1';            // { list:[{id,name,family,kind,url?,css?}], current:id }
    const FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    const store = (typeof localforage !== 'undefined' && localforage.createInstance)
        ? localforage.createInstance({ name: 'guyuFonts', storeName: 'fonts' }) : null;

    let S = { list: [], current: '' };
    try { const o = JSON.parse(localStorage.getItem(LSK) || 'null'); if (o && Array.isArray(o.list)) S = { list: o.list, current: o.current || '' }; } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🔤 字体', m, null, null, false); else console.info(m); } catch (e) {} };
    const alertBox = m => { try { if (typeof appAlert === 'function') appAlert(m); else alert(m); } catch (e) {} };
    const ask = async (msg, def) => { try { if (typeof appPrompt === 'function') return await appPrompt(msg, def); } catch (e) {} return prompt(msg, def); };
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const newId = () => 'uf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    // 字体名放进 CSS 里要加引号；名字里本身的引号/反斜杠转义掉
    const cssFamily = f => '"' + String(f).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const byId = id => S.list.find(f => f.id === id) || null;

    /* ---------- 加载：把一条记录变成浏览器认得的字体 ---------- */
    const LOADED = Object.create(null);    // id → Promise<boolean>
    const BLOBURL = Object.create(null);   // id → objectURL（上传的文件）
    function loadFont(f) {
        if (!f) return Promise.resolve(false);
        if (LOADED[f.id]) return LOADED[f.id];
        LOADED[f.id] = (async () => {
            try {
                if (f.kind === 'css') {
                    if (!document.getElementById('gyUfLink_' + f.id)) {
                        const l = document.createElement('link');
                        l.rel = 'stylesheet'; l.href = f.url; l.id = 'gyUfLink_' + f.id;
                        document.head.appendChild(l);
                    }
                    return true;
                }
                let src;
                if (f.kind === 'file') {
                    if (!store) return false;
                    const rec = await store.getItem(f.id);
                    if (!rec || !rec.blob) return false;
                    // 用 ArrayBuffer 直接喂 FontFace，比 blob: 地址稳（有的 WebView 不认 blob 字体地址）
                    try { src = await rec.blob.arrayBuffer(); } catch (e) { src = null; }
                    if (!src) { BLOBURL[f.id] = BLOBURL[f.id] || URL.createObjectURL(rec.blob); src = 'url(' + JSON.stringify(BLOBURL[f.id]) + ')'; }
                } else {
                    src = 'url(' + JSON.stringify(f.url) + ')';
                }
                const ff = new FontFace(f.family, src);
                await ff.load();
                document.fonts.add(ff);
                return true;
            } catch (e) {
                console.warn('[自定义字体] 加载失败', f.name, e);
                delete LOADED[f.id];   // 失败了下次还能再试（比如网络恢复了）
                return false;
            }
        })();
        return LOADED[f.id];
    }

    /* ---------- 生效 / 恢复默认 ---------- */
    function apply() {
        const f = byId(S.current);
        const root = document.documentElement;
        if (f) {
            root.style.setProperty('--gy-user-font', cssFamily(f.family));
            root.classList.add('gy-ufont');
            loadFont(f).then(ok => { if (!ok && S.current === f.id) toast('「' + f.name + '」没加载出来，暂时用默认字体显示'); });
        } else {
            root.style.removeProperty('--gy-user-font');
            root.classList.remove('gy-ufont');
        }
        try { window.dispatchEvent(new CustomEvent('gy:font', { detail: { family: f ? f.family : '', name: f ? f.name : '' } })); } catch (e) {}
        renderUI();
    }
    window.gyUserFont = function () { const f = byId(S.current); return f ? f.family : ''; };
    window.gyUserFontUse = function (id) { S.current = byId(id) ? id : ''; saveCfg(); apply(); };
    window.gyUserFontReset = function () { S.current = ''; saveCfg(); apply(); toast('已恢复默认字体'); };
    window.gyUserFontRemove = async function (id) {
        const f = byId(id); if (!f) return;
        let ok = true;
        try { if (typeof appConfirm === 'function') ok = await appConfirm('删掉字体「' + f.name + '」？'); else ok = confirm('删掉字体「' + f.name + '」？'); } catch (e) {}
        if (!ok) return;
        S.list = S.list.filter(x => x.id !== id);
        if (S.current === id) S.current = '';
        saveCfg();
        try { if (store && f.kind === 'file') await store.removeItem(id); } catch (e) {}
        const l = document.getElementById('gyUfLink_' + id); if (l) l.remove();
        if (BLOBURL[id]) { try { URL.revokeObjectURL(BLOBURL[id]); } catch (e) {} delete BLOBURL[id]; }
        delete LOADED[id];
        apply();
    };
    window.gyUserFontRename = async function (id) {
        const f = byId(id); if (!f) return;
        const n = await ask('给这个字体起个名字（只是列表里显示用）', f.name);
        if (n == null || !String(n).trim()) return;
        f.name = String(n).trim(); saveCfg(); renderUI();
    };

    /* ---------- 添加：上传文件 ---------- */
    async function addFiles(files) {
        if (!files || !files.length) return;
        if (!store) { alertBox('这个浏览器不支持本地字体库（IndexedDB），可以改用「粘贴链接」。'); return; }
        let last = '';
        for (const file of Array.from(files)) {
            const id = newId();
            const name = String(file.name || '字体').replace(/\.(ttf|otf|woff2?|ttc)$/i, '');
            // 内部字体名用编号，避免跟系统里同名字体撞车（撞了浏览器可能用系统那个）
            const rec = { id, name, family: 'GyUF ' + id, kind: 'file', bytes: file.size || 0 };
            try {
                await store.setItem(id, { blob: file, name: file.name, type: file.type || '', bytes: file.size || 0 });
            } catch (e) { alertBox('字体「' + name + '」存不进本地库：' + (e && e.message || e)); continue; }
            S.list.push(rec); saveCfg();
            const ok = await loadFont(rec);
            if (!ok) toast('「' + name + '」存好了，但浏览器没认出来这个字体文件，可能格式不对');
            last = id;
        }
        if (last) { S.current = last; saveCfg(); apply(); toast('已换上新字体'); }
    }
    window.gyUserFontUpload = function (input) { const fs = input && input.files; addFiles(fs).finally(() => { try { input.value = ''; } catch (e) {} }); };

    /* ---------- 添加：粘贴链接 ---------- */
    // 从一段粘贴内容里把真正的地址抠出来：支持裸链接 / @import url(...) / <link href=...>
    function extractUrl(raw) {
        const s = String(raw || '').trim();
        let m = s.match(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?/i);
        if (m) return m[1];
        m = s.match(/href\s*=\s*['"]([^'"]+)['"]/i);
        if (m) return m[1].replace(/&amp;/g, '&');
        m = s.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
        if (m) return m[1];
        return s;
    }
    function guessKind(url) {
        if (/^data:(font\/|application\/(x-)?font|application\/octet-stream|application\/vnd\.ms-fontobject)/i.test(url)) return 'font';
        if (/^data:text\/css/i.test(url)) return 'css';
        const path = url.split(/[?#]/)[0];
        if (/\.(ttf|otf|woff2?|ttc)$/i.test(path)) return 'font';
        if (/\.css$/i.test(path) || /fonts\.googleapis\.com|fonts\.loli\.net|fonts\.font\.im|\/css2?\b/i.test(url)) return 'css';
        return '';
    }
    // CSS 里第一个 @font-face 的 font-family
    function familyFromCss(text) {
        const m = String(text || '').match(/@font-face\s*{[^}]*?font-family\s*:\s*(['"]?)([^;'"}]+)\1/i);
        return m ? m[2].trim() : '';
    }
    async function fetchText(url) {
        try {
            if (/^data:/i.test(url)) {
                const r = await fetch(url); return await r.text();
            }
            const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const t = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) {} }, 12000);
            const r = await fetch(url, { signal: ctl ? ctl.signal : undefined });
            clearTimeout(t);
            if (!r.ok) return '';
            const ct = r.headers.get('content-type') || '';
            if (/font|octet-stream/i.test(ct)) return '\u0000FONT';
            return await r.text();
        } catch (e) { return ''; }
    }
    async function addLink(raw, familyHint) {
        const url = extractUrl(raw);
        if (!url) { alertBox('先粘贴一个字体链接'); return false; }
        let kind = guessKind(url);
        let cssText = '';
        if (kind !== 'font') {
            cssText = await fetchText(url);
            if (cssText === '\u0000FONT') { kind = 'font'; cssText = ''; }
            else if (!kind) kind = /@font-face/i.test(cssText) ? 'css' : '';
        }
        if (!kind) {
            // 认不出来：先当字体文件试一下，不行再当 CSS
            try { const ff = new FontFace('GyUF probe', 'url(' + JSON.stringify(url) + ')'); await ff.load(); kind = 'font'; }
            catch (e) { kind = 'css'; }
        }
        const id = newId();
        let rec;
        if (kind === 'font') {
            const base = decodeURIComponent((url.split(/[?#]/)[0].split('/').pop() || '').replace(/\.(ttf|otf|woff2?|ttc)$/i, '')) || '链接字体';
            rec = { id, name: (familyHint || '').trim() || (/^data:/i.test(url) ? '粘贴的字体' : base), family: 'GyUF ' + id, kind: 'font', url };
        } else {
            let fam = (familyHint || '').trim() || familyFromCss(cssText);
            if (!fam) {
                // Google Fonts 的地址里就写着字体名：family=Noto+Serif+SC:wght@400
                const gm = url.match(/[?&]family=([^&:]+)/);
                if (gm) fam = decodeURIComponent(gm[1].replace(/\+/g, ' '));
            }
            if (!fam) {
                fam = await ask('这个 CSS 读不到内容（可能跨域），请填它里面的字体名称（font-family，比如 LXGW WenKai）', '');
                if (fam == null || !String(fam).trim()) return false;
                fam = String(fam).trim();
            }
            rec = { id, name: fam, family: fam, kind: 'css', url };
        }
        S.list.push(rec); saveCfg();
        const ok = await loadFont(rec);
        if (!ok) { S.list = S.list.filter(x => x.id !== id); saveCfg(); alertBox('这个链接加载不出字体。检查一下地址对不对、能不能直接打开。'); renderUI(); return false; }
        S.current = id; saveCfg(); apply();
        toast('已换上「' + rec.name + '」');
        return true;
    }
    window.gyUserFontAddLink = async function () {
        const a = document.getElementById('gyUfUrl'), b = document.getElementById('gyUfFam');
        const ok = await addLink(a ? a.value : '', b ? b.value : '');
        if (ok) { if (a) a.value = ''; if (b) b.value = ''; }
    };
    window.gyUserFontPreviewText = function (v) {
        try { localStorage.setItem('gyUserFontPreview', v); } catch (e) {}
        document.querySelectorAll('.gy-uf-pv').forEach(el => { el.textContent = v || PREVIEW_DEFAULT; });
    };
    const PREVIEW_DEFAULT = '白露时节，春风拂面。The quick brown fox 0123';
    const previewText = () => { try { return localStorage.getItem('gyUserFontPreview') || PREVIEW_DEFAULT; } catch (e) { return PREVIEW_DEFAULT; } };

    /* ---------- 设置页 UI ---------- */
    function blockHtml() {
        return `
            <label style="font-size:16px;">🔤 自定义字体</label>
            <div class="form-hint" style="margin-bottom:8px;">
                换<b>全站</b>的字体。可以<b>上传字体文件</b>（ttf / otf / woff / woff2，不限大小，存在本机、不进存档），
                或者<b>粘贴链接</b>：字体文件地址直接用；CSS 地址（比如 Google Fonts 那种）会自动认字体名，认不出来就请你填。
            </div>
            <input type="file" id="gyUfFile" accept=".ttf,.otf,.woff,.woff2,.ttc,font/*,application/font-woff,application/x-font-ttf,application/octet-stream" multiple style="display:none;" onchange="gyUserFontUpload(this)">
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <button type="button" class="btn-edit-small" style="margin:0;" onclick="document.getElementById('gyUfFile').click()">📁 上传字体文件</button>
                <button type="button" class="btn-edit-small" style="margin:0;" onclick="gyUserFontReset()">恢复默认字体</button>
            </div>
            <input type="text" id="gyUfUrl" placeholder="粘贴字体链接 / CSS 链接 / @import 整句" style="width:100%; box-sizing:border-box; margin-bottom:6px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <input type="text" id="gyUfFam" placeholder="字体名称（可不填，CSS 会自动识别）" style="flex:1; min-width:160px; box-sizing:border-box;">
                <button type="button" class="btn-edit-small" style="margin:0;" onclick="gyUserFontAddLink()">＋ 添加链接</button>
            </div>
            <label style="margin-top:10px;">预览文字</label>
            <input type="text" id="gyUfPvInput" value="${esc(previewText())}" style="width:100%; box-sizing:border-box;" oninput="gyUserFontPreviewText(this.value)">
            <div id="gyUfList" style="margin-top:8px;"></div>`;
    }
    function renderUI() {
        const box = document.getElementById('gyUfList');
        if (!box) return;
        const pv = esc(previewText());
        const cur = S.current;
        const def = `<div class="gy-uf-row${!cur ? ' on' : ''}">
                <div class="gy-uf-head"><b>默认字体</b>${!cur ? '<span class="gy-uf-tag">使用中</span>' : `<button type="button" class="btn-edit-small" onclick="gyUserFontReset()">用这个</button>`}</div>
                <div class="gy-uf-pv" style="font-family:${esc(FALLBACK)};">${pv}</div></div>`;
        const rows = S.list.map(f => {
            const on = f.id === cur;
            const kindLabel = f.kind === 'file' ? '上传' : (f.kind === 'css' ? 'CSS 链接' : '字体链接');
            loadFont(f);   // 列表里的预览也要能显示出来
            return `<div class="gy-uf-row${on ? ' on' : ''}">
                <div class="gy-uf-head"><b>${esc(f.name)}</b><span class="gy-uf-kind">${kindLabel}</span>
                    ${on ? '<span class="gy-uf-tag">使用中</span>' : `<button type="button" class="btn-edit-small" onclick="gyUserFontUse('${esc(f.id)}')">用这个</button>`}
                    <button type="button" class="btn-edit-small" onclick="gyUserFontRename('${esc(f.id)}')">改名</button>
                    <button type="button" class="btn-edit-small" style="color:#f91880; border-color:#f91880;" onclick="gyUserFontRemove('${esc(f.id)}')">删除</button></div>
                <div class="gy-uf-pv" style="font-family:${esc(cssFamily(f.family))}, ${esc(FALLBACK)};">${pv}</div></div>`;
        }).join('');
        box.innerHTML = def + rows;
    }
    function ensureBlock() {
        if (document.getElementById('gyUfBlock')) { renderUI(); return; }
        const panel = document.getElementById('setPanel-appearance');
        if (!panel) return;
        const wrap = document.createElement('div');
        wrap.id = 'gyUfBlock';
        wrap.className = 'input-group';
        wrap.style.cssText = 'margin-bottom:15px;';
        wrap.innerHTML = blockHtml();
        // 放在「🔠 字号」那一块下面：字号和字体挨着找最顺手；找不到就放最前面
        const fs = document.getElementById('gyFsRange');
        const anchor = fs && fs.closest('.input-group');
        if (anchor && anchor.parentNode === panel) panel.insertBefore(wrap, anchor.nextSibling);
        else panel.insertBefore(wrap, panel.firstChild);
        renderUI();
    }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyUf) {
        window.openSettingsPanel = function (k) {
            const r = op0.apply(this, arguments);
            if (k === 'appearance') { try { ensureBlock(); } catch (e) {} }
            return r;
        };
        // 别的模块给 openSettingsPanel 挂的标记也带上，免得它们以为自己的包装被冲掉又包一层
        Object.keys(op0).forEach(k => { try { window.openSettingsPanel[k] = op0[k]; } catch (e) {} });
        window.openSettingsPanel.__gyUf = true;
    }

    /* ---------- 样式 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gyUserFontCss';
        // html.gy-ufont 打头 + !important：压过各处写死的 font-family（包括 inline 的 font-family:inherit 链条）。
        // --gy-font 也一起改，body.gywx（微信风）在 body 上重定义了它，所以 body 上也要覆盖一次。
        st.textContent =
            'html.gy-ufont, html.gy-ufont body, html.gy-ufont body.gywx { --gy-font: var(--gy-user-font), ' + FALLBACK + ' !important; }' +
            'html.gy-ufont body, html.gy-ufont body button, html.gy-ufont body input, html.gy-ufont body textarea, html.gy-ufont body select, html.gy-ufont body optgroup' +
            ' { font-family: var(--gy-user-font), ' + FALLBACK + ' !important; }' +
            '#gyUfList .gy-uf-row{padding:8px 10px;border:1px solid rgba(29,155,240,.25);border-radius:10px;margin-bottom:8px;}' +
            '#gyUfList .gy-uf-row.on{border-color:#1d9bf0;background:rgba(29,155,240,.06);}' +
            '#gyUfList .gy-uf-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:14px;}' +
            '#gyUfList .gy-uf-head b{margin-right:auto;word-break:break-all;}' +
            '#gyUfList .gy-uf-head .btn-edit-small{margin:0;padding:3px 8px;font-size:12px;}' +
            '#gyUfList .gy-uf-kind{font-size:11px;color:#8b98a5;}' +
            '#gyUfList .gy-uf-tag{font-size:11px;color:#fff;background:#1d9bf0;border-radius:999px;padding:2px 8px;}' +
            /* 预览是 div，不在上面那条全站规则的选择器里，所以它 inline 写的 font-family 能生效——各显示各的字体 */
            '#gyUfList .gy-uf-pv{font-size:18px;margin-top:6px;line-height:1.5;word-break:break-word;}';
        document.head.appendChild(st);
    } catch (e) {}

    /* ---------- 起飞：刷新之后接着用上次的字体 ---------- */
    // 变量和 class 立刻挂上（CSS 链接字体几乎能做到不闪），上传的文件要等 IndexedDB 读出来
    try { apply(); } catch (e) {}
    function boot() { try { ensureBlock(); } catch (e) {} }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

    console.info('[自定义字体] 已加载。入口：设置 → 外观 →「🔤 自定义字体」');
})();
