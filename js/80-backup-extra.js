/* ============================================================
   💾 备份补全：插件和小盒子的数据也一起备份
   ------------------------------------------------------------
   以前「导出备份」只打包主存档（myTwitterAppData）。可是音乐盒、地图、关系账本、
   钱包……这些小盒子，还有所有新玩法插件（星图、小屋、成就、每日一问、合照……），
   都各自存在浏览器里单独的小数据库里，备份里没有它们——换手机、清缓存就全没了。

   这里做三件事：
   1. 导出备份时，把这些小数据库和 localStorage 里的设置一起塞进备份文件（字段 __gyExtra）；
   2. 导入恢复时，把 __gyExtra 写回各自的小数据库，然后问一句要不要刷新；
   3. 设置 → 数据里多两个按钮：只导出 / 只导入「插件和小盒子的数据」（不动主存档）。

   动图视频的大库（guyuLiveMedia）不在这里打包——44-live-media 已经会把用到的那些带上。
   ============================================================ */
(function () {
    if (window.__gyBackupExtra) return; window.__gyBackupExtra = true;
    const SKIP_DB = new Set(['guyuLiveMedia']);
    const MAIN_KEY = 'myTwitterAppData';
    // 白露的库名前面都加了 bailu_（js/00-bailu-shim，为了和谷雨放在同一个网址下也不打架）：备份里存去掉前缀的名字，两边都能互相导
    const PFX = (() => { try { return typeof localforage !== 'undefined' && localforage.config && localforage.config().name === 'bailu_localforage' ? 'bailu_' : ''; } catch (e) { return ''; } })();
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const blobTo = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(b); });
    // 值里有 Blob / File 的，转成 dataURL 才能放进 JSON
    async function enc(v, depth) {
        if (v instanceof Blob) return { __gyBlob: await blobTo(v), type: v.type };
        if (!v || typeof v !== 'object' || (depth || 0) > 12) return v;
        if (Array.isArray(v)) { const o = []; for (const x of v) o.push(await enc(x, (depth || 0) + 1)); return o; }
        if (v instanceof Date) return v;
        const o = {}; for (const k of Object.keys(v)) o[k] = await enc(v[k], (depth || 0) + 1); return o;
    }
    function dec(v) {
        if (!v || typeof v !== 'object') return v;
        if (v.__gyBlob && typeof v.__gyBlob === 'string') { try { const [h, b] = v.__gyBlob.split(','), bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: v.type || (h.match(/data:([^;]+)/) || [])[1] || '' }); } catch (e) { return null; } }
        if (Array.isArray(v)) return v.map(dec);
        const o = {}; Object.keys(v).forEach(k => o[k] = dec(v[k])); return o;
    }
    async function dbNames() {   // 返回真实库名（带前缀的）
        const S = new Set();
        try { if (indexedDB.databases) (await indexedDB.databases()).forEach(d => d && d.name && S.add(d.name)); } catch (e) {}
        (window.__gyStoreNames || []).forEach(x => S.add(PFX + x[0]));
        (window.__gyxStoreNames || []).forEach(n => S.add(PFX + n));
        S.add(PFX + 'localforage');
        return [...S].filter(n => PFX ? n.startsWith(PFX) : !n.startsWith('bailu_')).filter(n => !SKIP_DB.has(n.slice(PFX.length)));
    }
    function readDb(name) {
        return new Promise(res => {
            let req; try { req = indexedDB.open(name); } catch (e) { return res(null); }
            req.onupgradeneeded = () => { try { req.transaction.abort(); } catch (e) {} };   // 不存在的库别顺手建出来
            req.onerror = () => res(null);
            req.onsuccess = () => {
                const db = req.result, stores = [...db.objectStoreNames], out = {};
                if (!stores.length) { db.close(); return res(null); }
                let left = stores.length;
                stores.forEach(st => {
                    const data = {}; out[st] = data;
                    try {
                        const cur = db.transaction(st, 'readonly').objectStore(st).openCursor();
                        cur.onsuccess = e => { const c = e.target.result; if (c) { if (!(name === PFX + 'localforage' && c.key === MAIN_KEY)) data[String(c.key)] = c.value; c.continue(); } else if (--left === 0) { db.close(); res(out); } };
                        cur.onerror = () => { if (--left === 0) { db.close(); res(out); } };
                    } catch (e) { if (--left === 0) { db.close(); res(out); } }
                });
            };
        });
    }
    async function collect() {
        const idb = {}; let n = 0;
        for (const name of await dbNames()) {
            const d = await readDb(name); if (!d) continue;
            const nm = name.slice(PFX.length); for (const st of Object.keys(d)) { if (st === 'local-forage-detect-blob-support') continue; const ks = Object.keys(d[st]); if (!ks.length) continue; (idb[nm] = idb[nm] || {})[st] = {}; for (const k of ks) { idb[nm][st][k] = await enc(d[st][k]); n++; } }
        }
        const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || (!PFX && k.indexOf('bailu:') === 0)) continue;   /* 白露那边 localStorage 已经被套了一层，只列得出自己的键 */ ls[k] = localStorage.getItem(k); } } catch (e) {}
        return { v: 1, at: Date.now(), idb, ls, n };
    }
    async function restore(ex) {
        if (!ex || typeof localforage === 'undefined') return 0; let n = 0;
        for (const name of Object.keys(ex.idb || {})) for (const st of Object.keys(ex.idb[name])) {
            const lf = name === 'localforage' && st === 'keyvaluepairs' ? localforage : localforage.createInstance({ name, storeName: st });
            for (const k of Object.keys(ex.idb[name][st])) { if (name === 'localforage' && k === MAIN_KEY) continue; try { await lf.setItem(k, dec(ex.idb[name][st][k])); n++; } catch (e) { console.warn('[备份补全] 写回失败', name, st, k, e); } }
        }
        Object.keys(ex.ls || {}).forEach(k => { try { localStorage.setItem(k, ex.ls[k]); n++; } catch (e) {} });
        return n;
    }
    window.gyBackupExtraCollect = collect;
    window.gyBackupExtraRestore = restore;

    // 1) 导出：把 __gyExtra 挂进这一次的存档快照（只在导出那一下，平时自动存档不会带它）
    function wrapSnap() {
        const f = window.getFullDataSnapshot; if (typeof f !== 'function' || f.__gyExtra) return;
        const w = function () { const d = f.apply(this, arguments); if (window.__gyExtraPending && d && typeof d === 'object') d.__gyExtra = window.__gyExtraPending; return d; };
        w.__gyExtra = true; window.getFullDataSnapshot = w; try { getFullDataSnapshot = w; } catch (e) {}
    }
    function wrapExport() {
        const f = window.exportData; if (typeof f !== 'function' || f.__gyExtra) return;
        const w = async function () {
            let ex = null; try { ex = await collect(); } catch (e) { console.warn('[备份补全] 收集失败，照常导出主存档', e); }
            window.__gyExtraPending = ex;
            try { return await f.apply(this, arguments); }
            finally { window.__gyExtraPending = null; if (ex) toast('💾 备份里也带上了插件和小盒子的数据', `${Object.keys(ex.idb).length} 个小数据库 · ${ex.n} 条`); }
        };
        w.__gyExtra = true; window.exportData = w; try { exportData = w; } catch (e) {}
    }
    // 2) 导入恢复：主存档写进去以后，把 __gyExtra 拿出来写回各自的库，再从主存档里删掉（不然每次自动存档都背着它）
    let importing = false;
    function wrapImport() {
        const f = window.importData; if (typeof f !== 'function' || f.__gyExtra) return;
        const w = function () { importing = true; setTimeout(() => { importing = false; }, 120000); return f.apply(this, arguments); };
        w.__gyExtra = true; window.importData = w; try { importData = w; } catch (e) {}
    }
    function wrapLoad() {
        const f = window.loadAllData; if (typeof f !== 'function' || f.__gyExtra) return;
        const w = async function () {
            const r = await f.apply(this, arguments);
            if (importing) {
                importing = false;
                try {
                    const rec = await localforage.getItem(MAIN_KEY);
                    if (rec && rec.__gyExtra) {
                        const ex = rec.__gyExtra; delete rec.__gyExtra; await localforage.setItem(MAIN_KEY, rec);
                        const n = await restore(ex);
                        setTimeout(async () => { const ask = typeof appConfirm === 'function' ? appConfirm : m => Promise.resolve(confirm(m)); if (await ask(`插件和小盒子的数据也恢复好了（${n} 条）。\n刷新一下它们才会用上恢复的数据，现在刷新吗？`)) (window.refreshAppPage || (() => location.reload()))(); }, 600);
                    }
                } catch (e) { console.warn('[备份补全] 恢复插件数据失败', e); }
            }
            return r;
        };
        w.__gyExtra = true; window.loadAllData = w; try { loadAllData = w; } catch (e) {}
    }
    const wrapAll = () => { wrapSnap(); wrapExport(); wrapImport(); wrapLoad(); };
    wrapAll(); setInterval(wrapAll, 4000);   // 别的模块后来又包了一层的话，重新包在最外面

    // 3) 只导出 / 只导入「插件和小盒子的数据」
    window.gyExtraExport = async function () {
        const ex = await collect();
        saveTextFileForApp(`插件和小盒子数据_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ __gyExtraOnly: 1, __gyExtra: ex }), 'application/json');
        toast('💾 导出好了', `${Object.keys(ex.idb).length} 个小数据库 · ${ex.n} 条`);
    };
    window.gyExtraImport = function (ev) {
        const f = ev && ev.target && ev.target.files && ev.target.files[0]; if (ev && ev.target) ev.target.value = ''; if (!f) return;
        const fr = new FileReader();
        fr.onload = async () => {
            let d; try { d = JSON.parse(fr.result); } catch (e) { alert('不是合法的 JSON 文件'); return; }
            const ex = d && (d.__gyExtra || (d.idb ? d : null)); if (!ex || !ex.idb) { alert('这个文件里没有插件和小盒子的数据（是不是选成了别的文件？）'); return; }
            const n = await restore(ex);
            const ask = typeof appConfirm === 'function' ? appConfirm : m => Promise.resolve(confirm(m));
            if (await ask(`恢复了 ${n} 条插件和小盒子的数据。刷新一下才会用上，现在刷新吗？`)) (window.refreshAppPage || (() => location.reload()))();
        };
        fr.readAsText(f, 'UTF-8');
    };
    function mount() {
        const btn = document.querySelector('#setPanel-data button[onclick="exportData()"]'); if (!btn || document.getElementById('gyExtraRow')) return;
        const box = btn.closest('.input-group'); if (!box) return;
        box.insertAdjacentHTML('beforeend', `<div id="gyExtraRow" style="margin-top:10px;"><div class="form-hint" style="margin:0 0 8px;">上面的「导出备份」现在会把插件（星图、小屋、成就、每日一问……）和小盒子（音乐盒、地图、钱包……）的数据也一起带上。只想单独搬这部分的话用下面两个：</div><div style="display:flex; gap:10px; flex-wrap:wrap;"><button class="btn-secondary" style="margin-top:0;" onclick="gyExtraExport()">🧩 只导出插件和小盒子的数据</button><button class="btn-secondary" style="margin-top:0; color:#536471; border-color:#536471;" onclick="openFilePickerForApp('gyExtraImportInput')">🧩 只导入这部分</button><input type="file" id="gyExtraImportInput" accept="*/*" style="display:none;" onchange="gyExtraImport(event)"></div></div>`);
    }
    mount(); setInterval(mount, 3000);

    /* ============================================================
       📦 分模块备份（v210）：导出 / 导入时自己勾要哪几块
       - 导出：只打包勾选的模块；勾了「API 与模型」会提醒文件里有密钥
       - 导入：分模块备份、完整备份（导出备份那个文件）、只有插件数据的文件都认；
              列出文件里有哪些模块，勾哪几块就只覆盖哪几块，其余保持现在的样子
       ============================================================ */
    const MODS = [
        { id: 'api', n: '🔑 API 与模型', d: '接口地址、密钥、模型、采样参数、云同步', secret: true,
          keys: ['myApiUrl', 'myApiKey', 'myModel', 'subApiUrl', 'subApiKey', 'subModel', 'vecApiUrl', 'vecApiKey', 'lastWorkingModel', 'lastWorkingSubModel', 'embeddingModel', 'samplerTemperature', 'samplerTopP', 'samplerFrequencyPenalty', 'samplerPresencePenalty', 'samplerTopK', 'samplerMaxTokens', 'cloudSyncEnabled', 'cloudWorkerUrl', 'cloudAuthToken', 'ntfyTopic'] },
        { id: 'chars', n: '👥 角色与人设', d: '角色卡（含头像、日记信件、心声）、分组、关系网、你的人设、表情包；不含聊天记录',
          keys: ['myCharacters', 'characterGroups', 'factionColors', 'charRelationships', 'relationshipTypePresets', 'statusTypes', 'npcIdentities', 'currentUser', 'userPersonas', 'charUserPersona', 'factionUserPersona', 'globalEmoticons'],
          count: d => (d.myCharacters || []).length + ' 个角色' },
        { id: 'chats', n: '💬 聊天记录', d: '私聊、群聊、置顶、挂起的消息、聊天变量（带上用到的动图视频）',
          keys: ['globalChats', 'groupChats', 'pinnedSessionIds', 'aliveHeld', 'chatVariables', 'mvuStats'],
          count: d => Object.keys(d.globalChats || {}).length + ' 段聊天 · ' + Object.values(d.globalChats || {}).reduce((a, x) => a + ((x || []).length || 0), 0) + ' 条' },
        { id: 'memory', n: '🧠 记忆', d: '聊天总结、资料库、回忆相册、小剧场、角色之间的来往',
          keys: ['memoryEntries', 'dataBank', 'memoryAlbum', 'globalTheaterLogs', 'gyPeerLog'] },
        { id: 'feed', n: '🐦 推文与社区', d: '推文、匿名区、小报、热搜、论坛',
          keys: ['globalPosts', 'anonPosts', 'tabloidPosts', 'tabloidAccount', 'trendingTags', 'forumThreads'],
          count: d => (d.globalPosts || []).length + ' 条推文' },
        { id: 'writing', n: '📖 日记与小说', d: '你的日记、小说、剧情工作台', keys: ['globalUserDiaries', 'globalNovels', 'storySessions'] },
        { id: 'world', n: '🌍 世界书 · 正则 · 预设', d: '世界书和分类、正则脚本、AI 预设、思考格式',
          keys: ['worldbooks', 'worldbookCategories', 'regexScripts', 'aiPresets', 'reasoningFormats'],
          count: d => (d.worldbooks || []).length + ' 本世界书 · ' + (d.regexScripts || []).length + ' 条正则' },
        { id: 'plugins', n: '🔌 插件列表', d: '装了哪些插件（插件自己记的数据在下面那项）', keys: ['plugins'], count: d => (d.plugins || []).length + ' 个插件' },
        { id: 'settings', n: '⚙️ 设置与外观', d: '开关、字数、主题、背景、皮肤、各种小设置（上面没列到的都在这）', keys: null },
        { id: 'extra', n: '🧩 插件和小盒子的数据', d: '星图、小屋、成就、每日一问……音乐盒、地图、钱包、关系账本等各自的小数据库', extra: true }
    ];
    const listed = new Set(MODS.reduce((a, m) => a.concat(m.keys || []), []));
    const keysOf = (m, d) => m.keys ? m.keys.filter(k => k in d) : Object.keys(d).filter(k => !listed.has(k) && !/^__gy(Extra|LiveMedia|Modular)$/.test(k));
    const dayStr = () => new Date().toISOString().slice(0, 10);
    const APPN = () => window.GY_APP_NAME || '谷雨';
    async function liveFor(data) {   // 聊天里用到的动图视频
        try {
            const used = new Set((JSON.stringify(data).match(/gylive:[A-Za-z0-9]+/g) || []).map(x => x.slice(7)));
            if (!used.size) return null;
            const all = await readDb(PFX + 'guyuLiveMedia'); if (!all) return null;
            const out = {};
            for (const st of Object.keys(all)) for (const k of Object.keys(all[st])) if (used.has(k)) { (out[st] = out[st] || {})[k] = await enc(all[st][k]); }
            return Object.keys(out).length ? out : null;
        } catch (e) { return null; }
    }
    function ov(html) {
        let o = document.getElementById('gyModOv');
        if (!o) { o = document.createElement('div'); o.id = 'gyModOv'; o.onclick = e => { if (e.target === o) o.remove(); }; document.body.appendChild(o); }
        o.innerHTML = `<div class="gymod-box">${html}</div>`; return o;
    }
    const css = document.createElement('style');
    css.textContent = `#gyModOv{position:fixed;inset:0;z-index:100060;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
.gymod-box{width:min(460px,100%);max-height:86vh;overflow:auto;background:#fff;color:#222;border-radius:20px;padding:16px 18px;box-shadow:0 18px 50px rgba(0,0,0,.25)}
.gymod-box h3{margin:0 0 4px;font-size:17px}.gymod-tip{font-size:12px;color:#8b98a5;line-height:1.6;margin:4px 0 10px}
.gymod-it{display:flex;gap:10px;align-items:flex-start;padding:9px 4px;border-bottom:1px solid #f2f2f4;cursor:pointer}.gymod-it input{margin-top:3px}
.gymod-it b{font-size:14px}.gymod-it em{display:block;font-style:normal;font-size:12px;color:#8b98a5;line-height:1.5}.gymod-it span{font-size:11.5px;color:#1d9bf0;margin-left:6px}
.gymod-warn{font-size:12px;color:#c0392b;background:#fff1f0;border-radius:10px;padding:8px 10px;margin:8px 0;display:none}
.gymod-row{display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}.gymod-row button{border:none;border-radius:999px;padding:8px 16px;font-size:14px;cursor:pointer;background:#f0f2f5}.gymod-row button.ok{background:#1d9bf0;color:#fff}
.gymod-all{font-size:12.5px;color:#1d9bf0;cursor:pointer}`;
    document.head.appendChild(css);
    const picked = () => [...document.querySelectorAll('#gyModOv input[data-m]:checked')].map(x => x.dataset.m);
    window.gyModWarn = () => { const w = document.getElementById('gyModWarn'); if (!w) return; const p = picked(); const msg = [];
        if (p.includes('api')) msg.push('勾了「API 与模型」：文件里有你的 API 密钥，别发给别人、别传到公开的地方。');
        if (w.dataset.mode === 'in' && (p.includes('chars') !== p.includes('chats')) && document.querySelector('#gyModOv input[data-m="chars"]') && document.querySelector('#gyModOv input[data-m="chats"]')) msg.push('角色和聊天记录最好一起勾：只换其中一个，聊天可能对不上角色。');
        w.style.display = msg.length ? 'block' : 'none'; w.innerHTML = msg.join('<br>'); };
    window.gyModAll = v => { document.querySelectorAll('#gyModOv input[data-m]').forEach(x => x.checked = v); window.gyModWarn(); };
    function listHtml(mods, d, checkedFn) {
        return mods.map(m => `<label class="gymod-it"><input type="checkbox" data-m="${m.id}" ${checkedFn(m) ? 'checked' : ''} onchange="gyModWarn()"><div><b>${m.n}</b>${m.count && d ? `<span>${esc(m.count(d))}</span>` : ''}<em>${m.d}</em></div></label>`).join('');
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---- 导出 ----
    window.gyModExportOpen = function () {
        let d = {}; try { d = getFullDataSnapshot(); } catch (e) {}
        ov(`<h3>📦 分模块导出</h3><div class="gymod-tip">勾要带走的部分。导入时还能再挑一次。<span class="gymod-all" onclick="gyModAll(true)">全选</span> · <span class="gymod-all" onclick="gyModAll(false)">全不选</span></div>
            ${listHtml(MODS, d, m => m.id !== 'api')}
            <div class="gymod-warn" id="gyModWarn" data-mode="out"></div>
            <div class="gymod-row"><button onclick="document.getElementById('gyModOv').remove()">取消</button><button class="ok" onclick="gyModExportGo()">导出</button></div>`);
        window.gyModWarn();
    };
    window.gyModExportGo = async function (ids) {
        ids = ids || picked(); if (!ids.length) { alert('至少勾一项'); return; }
        const snap = getFullDataSnapshot(), out = { __gyModular: 1, v: 1, at: Date.now(), app: APPN(), mods: ids, data: {} };
        MODS.forEach(m => { if (!ids.includes(m.id) || m.extra) return; keysOf(m, snap).forEach(k => { out.data[k] = snap[k]; }); });
        let ex = null;
        if (ids.includes('extra')) { try { ex = await collect(); } catch (e) {} }
        if (ids.includes('chats')) { const lv = await liveFor(out.data); if (lv) { ex = ex || { v: 1, at: Date.now(), idb: {}, ls: {}, n: 0 }; ex.idb.guyuLiveMedia = lv; } }
        if (ex) out.__gyExtra = ex;
        const name = `${APPN()}分模块备份_${MODS.filter(m => ids.includes(m.id)).map(m => m.n.replace(/^\S+\s/, '').replace(/[ ·\/]/g, '')).join('+').slice(0, 40)}_${dayStr()}.json`;
        saveTextFileForApp(name, JSON.stringify(out), 'application/json');
        const o = document.getElementById('gyModOv'); if (o) o.remove();
        toast('📦 导出好了', ids.length + ' 个模块' + (ids.includes('api') ? ' · 里面有 API 密钥，别外传' : ''));
        return out;
    };

    // ---- 导入 ----
    let PENDING = null;
    window.gyModImportPick = function () {
        let inp = document.getElementById('gyModImportInput');
        if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'gyModImportInput'; inp.accept = '*/*'; inp.style.display = 'none'; inp.onchange = e => window.gyModImportFile(e); document.body.appendChild(inp); }
        if (typeof openFilePickerForApp === 'function') openFilePickerForApp('gyModImportInput'); else inp.click();
    };
    window.gyModImportFile = function (ev) {
        const f = ev && ev.target && ev.target.files && ev.target.files[0]; if (ev && ev.target) ev.target.value = ''; if (!f) return;
        const fr = new FileReader();
        fr.onload = () => { let d; try { d = JSON.parse(fr.result); } catch (e) { alert('不是合法的 JSON 文件'); return; } window.gyModImportOpen(d); };
        fr.readAsText(f, 'UTF-8');
    };
    window.gyModImportOpen = function (file) {
        if (!file || typeof file !== 'object') { alert('这个文件认不出来'); return; }
        let data, ex = null, kind;
        if (file.__gyModular) { data = file.data || {}; ex = file.__gyExtra || null; kind = '分模块备份（' + (file.app || '') + ' ' + new Date(file.at || Date.now()).toLocaleDateString() + '）'; }
        else if (file.__gyExtraOnly) { data = {}; ex = file.__gyExtra; kind = '插件和小盒子的数据'; }
        else { data = Object.assign({}, file); ex = data.__gyExtra || null; delete data.__gyExtra; kind = '完整备份'; }
        const has = MODS.filter(m => m.extra ? !!(ex && Object.keys(ex.idb || {}).some(n => n !== 'guyuLiveMedia')) : keysOf(m, data).length > 0);
        if (!has.length) { alert('这个文件里没有能导入的内容'); return; }
        PENDING = { data, ex };
        ov(`<h3>📦 分模块导入</h3><div class="gymod-tip">认出来是：<b>${esc(kind)}</b>。勾哪几块就只覆盖哪几块，没勾的保持现在的样子。<span class="gymod-all" onclick="gyModAll(true)">全选</span> · <span class="gymod-all" onclick="gyModAll(false)">全不选</span></div>
            ${listHtml(has, data, m => m.id !== 'api' || !myApiKey)}
            <div class="gymod-warn" id="gyModWarn" data-mode="in"></div>
            <div class="gymod-tip">⚠️ 覆盖是整块换掉（比如勾了「角色与人设」，现在的角色列表会换成文件里的）。不放心的话先用上面「导出备份」存一份现在的。</div>
            <div class="gymod-row"><button onclick="document.getElementById('gyModOv').remove()">取消</button><button class="ok" onclick="gyModImportGo()">覆盖勾选的</button></div>`);
        window.gyModWarn();
        return has.map(m => m.id);
    };
    window.gyModImportGo = async function (ids, opts) {
        ids = ids || picked(); if (!PENDING || !ids.length) { alert('至少勾一项'); return; }
        const { data, ex } = PENDING; let nKeys = 0, nExtra = 0;
        const cur = getFullDataSnapshot();
        delete cur.__gyExtra;
        MODS.forEach(m => { if (!ids.includes(m.id) || m.extra) return; keysOf(m, data).forEach(k => { cur[k] = data[k]; nKeys++; }); });
        try {
            if (nKeys) {
                const go = async () => { await localforage.setItem(MAIN_KEY, cur); await loadAllData(); };   // 跟「导入恢复」同一条路：写进主存档，再用同一套加载逻辑读回来
                if (typeof gyHoldSaves === 'function') await gyHoldSaves(go); else await go();
                try { await saveAllData({ immediate: true }); } catch (e) {}
            }
            if (ex) {
                const part = { idb: {}, ls: {} };
                Object.keys(ex.idb || {}).forEach(n => { if (n === 'guyuLiveMedia' ? ids.includes('chats') : ids.includes('extra')) part.idb[n] = ex.idb[n]; });
                if (ids.includes('extra')) part.ls = ex.ls || {};
                nExtra = await restore(part);
            }
        } catch (e) { alert('导入出错了：' + (e.message || e)); return; }
        PENDING = null;
        const o = document.getElementById('gyModOv'); if (o) o.remove();
        try { gyCloseAllOverlays(); } catch (e) {}
        try { updateUserMiniProfile(); updateGlobalBgStyles(); applyGlobalCSS(); updateCharSelects(); } catch (e) {}
        if (opts && opts.noAsk) return { nKeys, nExtra };
        const ask = typeof appConfirm === 'function' ? appConfirm : m => Promise.resolve(confirm(m));
        if (await ask(`导入好了：${ids.length} 个模块${nExtra ? '，插件和小盒子数据 ' + nExtra + ' 条' : ''}。\n刷新一下所有功能才会用上新数据，现在刷新吗？`)) (window.refreshAppPage || (() => location.reload()))();
        return { nKeys, nExtra };
    };
    window.gyModList = () => MODS.map(m => ({ id: m.id, n: m.n }));
    function mount2() {
        const row = document.getElementById('gyExtraRow'); if (!row || document.getElementById('gyModRow')) return;
        row.insertAdjacentHTML('afterend', `<div id="gyModRow" style="margin-top:10px;"><div class="form-hint" style="margin:0 0 8px;">📦 分模块：自己勾要哪几块（API、角色、聊天、记忆、推文、世界书、设置……）。导入时也能只挑其中几块覆盖，完整备份文件也认。</div><div style="display:flex; gap:10px; flex-wrap:wrap;"><button class="btn-secondary" style="margin-top:0;" onclick="gyModExportOpen()">📦 分模块导出</button><button class="btn-secondary" style="margin-top:0; color:#536471; border-color:#536471;" onclick="gyModImportPick()">📦 分模块导入</button></div></div>`);
    }
    mount2(); setInterval(mount2, 3000);
})();
