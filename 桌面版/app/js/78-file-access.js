/* ===========================================================================
   js/78 —— 📂 手机文件：选文件选不到 + 直接读写手机里的一个文件夹
   ---------------------------------------------------------------------------
   ① 选文件选不到：网页放在 GitHub Pages 这类地方、用手机浏览器打开时，上传框写了
      accept=".json,.txt" 的话，安卓会把很多 json / txt 当成「不认识的类型」灰掉，点不了。
      这里在点开选择框的那一下，给只写了扩展名的 accept 补一个「什么都能选」，
      选进来之后各功能自己会判断格式。图片 / 音频 / 视频那种不动。（有开关）
   ② 直接读写手机里的文件夹：用浏览器的「文件夹访问」（安卓 Chrome 132 起、电脑 Chrome / Edge 支持；
      iPhone 的 Safari 目前不支持）。连上一个文件夹之后：
        · 一键把完整备份存进去（也可以每天自动存一份）
        · 直接从这个文件夹里挑备份恢复
        · 白露：从文件夹里导入字卡（txt / json / csv）
      浏览器规定每次重新打开网页后，第一次读写要你点一下「允许」。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyFileAccess) return; window.__gyFileAccess = true;
    const isB = () => !!window.bailuCards;
    const K = 'gyFileCfg';
    const cfg = () => { try { return Object.assign({ anyType: true, autoBak: false, keep: 7 }, JSON.parse(localStorage.getItem(K) || '{}')); } catch (e) { return { anyType: true, autoBak: false, keep: 7 }; } };
    const setCfg = (k, v) => { const c = cfg(); c[k] = v; try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) {} };
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) { try { alert(a + (b ? '\n' + b : '')); } catch (e2) {} } };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- ① 选文件：补 accept ---------- */
    document.addEventListener('click', e => {
        const i = e.target;
        if (!i || i.tagName !== 'INPUT' || i.type !== 'file' || !cfg().anyType) return;
        const a = (i.getAttribute('accept') || '').trim();
        if (!a || /\*\/\*/.test(a)) return;
        if (/^(image|audio|video)\/\*(\s*,\s*(image|audio|video)\/\*)*$/i.test(a)) return;   // 纯图片/音视频不用动
        i.setAttribute('data-gy-acc', a); i.setAttribute('accept', a + ',*/*');
    }, true);

    /* ---------- ② 文件夹 ---------- */
    const can = () => typeof window.showDirectoryPicker === 'function';
    // 文件夹的「钥匙」存进 IndexedDB（只能存这里），下次打开还认得
    function idb() { return new Promise((res, rej) => { const r = indexedDB.open('gyFolder', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
    async function hGet() { try { const db = await idb(); return await new Promise(res => { const t = db.transaction('h').objectStore('h').get('dir'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }
    async function hSet(h) { try { const db = await idb(); await new Promise(res => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(h, 'dir'); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
    async function hDel() { try { const db = await idb(); await new Promise(res => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').delete('dir'); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
    let DIR = null;
    async function dir(ask) {
        if (!DIR) DIR = await hGet(); if (!DIR) return null;
        try {
            const o = { mode: 'readwrite' };
            if ((await DIR.queryPermission(o)) === 'granted') return DIR;
            if (ask && (await DIR.requestPermission(o)) === 'granted') return DIR;
        } catch (e) {}
        return null;
    }
    window.gyFolderConnect = async function () {
        if (!can()) { toast('这个浏览器不支持直接读写文件夹', '安卓请用 Chrome（132 以上），电脑用 Chrome / Edge；iPhone 的 Safari 暂时不行，可以用「导出 / 导入」'); return null; }
        try { DIR = await window.showDirectoryPicker({ id: isB() ? 'bailu' : 'guyu', mode: 'readwrite' }); await hSet(DIR); toast('连上了：' + DIR.name, '以后备份可以直接存进这个文件夹'); paint(); return DIR; }
        catch (e) { if (e && e.name !== 'AbortError') toast('没连上', String(e.message || e)); return null; }
    };
    window.gyFolderForget = async () => { DIR = null; await hDel(); paint(); };
    const appName = () => isB() ? '白露' : '谷雨';
    const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
    async function writeFile(d, name, text) { const fh = await d.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); }
    async function listFiles(d, re) { const out = []; for await (const [n, h] of d.entries()) { if (h.kind === 'file' && (!re || re.test(n))) { try { const f = await h.getFile(); out.push({ n, h, t: f.lastModified, size: f.size }); } catch (e) { out.push({ n, h, t: 0, size: 0 }); } } } return out.sort((a, b) => b.t - a.t); }
    window.gyFolderBackup = async function (silent) {
        const d = await dir(!silent); if (!d) { if (!silent) toast('文件夹还没连上 / 没允许', '先点「连接文件夹」，或者点「允许」'); return null; }
        if (typeof getFullDataSnapshot !== 'function') return null;
        const name = `${appName()}备份-${stamp()}.json`;
        try {
            let data = getFullDataSnapshot();
            try { if (isB() && window.bailuCards) data = Object.assign({}, data, { __bailuCards: { cards: window.bailuCards.cards, groups: window.bailuCards.groups, cfg: window.bailuCards.cfg, charCfg: window.bailuCards.charCfg } }); } catch (e) {}
            await writeFile(d, name, JSON.stringify(data));
            setCfg('last', Date.now());
            // 只留最近几份
            const keep = Math.max(1, +cfg().keep || 7), L = await listFiles(d, new RegExp('^' + appName() + '备份-.*\\.json$'));
            if (d.removeEntry) for (const x of L.slice(keep)) { try { await d.removeEntry(x.n); } catch (e) {} }
            if (!silent) toast('备份存好了', d.name + ' / ' + name);
            paint(); return name;
        } catch (e) { if (!silent) toast('没存上', String(e.message || e)); return null; }
    };
    window.gyFolderRestore = async function (fileName) {
        const d = await dir(true); if (!d) return toast('文件夹还没连上 / 没允许');
        try {
            const fh = await d.getFileHandle(fileName), text = await (await fh.getFile()).text(), data = JSON.parse(text);
            if (!confirm(`用「${fileName}」恢复？现在的数据会被它整个换掉。`)) return;
            const cards = data.__bailuCards; delete data.__bailuCards;
            await localforage.setItem('myTwitterAppData', data);
            if (cards && window.bailuCards && window.bailuCards.store) { try { await window.bailuCards.store.setItem('lib', cards); } catch (e) {} }
            toast('恢复好了', '马上重新加载'); setTimeout(() => location.reload(), 800);
        } catch (e) { toast('恢复失败', String(e.message || e)); }
    };
    // 白露：从文件夹里导入字卡
    window.gyFolderImportCards = async function (fileName) {
        const d = await dir(true); if (!d) return toast('文件夹还没连上 / 没允许');
        if (typeof window.bailuUpload !== 'function') return toast('字卡库还没加载好');
        try { const fh = await d.getFileHandle(fileName), f = await fh.getFile(); await window.bailuUpload({ files: [f], value: '' }); toast('导入了', fileName); }
        catch (e) { toast('导入失败', String(e.message || e)); }
    };
    let LIST = [];
    async function paint() {
        const box = document.getElementById('gyFolderBox'); if (!box) return;
        const h = DIR || await hGet(), ok = h ? await dir(false) : null, c = cfg();
        if (ok) { try { LIST = await listFiles(ok, /\.(json|txt|csv|md)$/i); } catch (e) { LIST = []; } }
        box.innerHTML = `<div class="gyf-tip">${can() ? '' : '<b style="color:#e0245e">这个浏览器不支持直接读写文件夹</b>（安卓请用 Chrome 132 以上，电脑用 Chrome / Edge；iPhone Safari 暂不支持）。下面「选文件选不到」的修复照样有用。<br>'}
            连一个手机里的文件夹，备份直接存进去、也能直接从里面恢复${isB() ? '、导入字卡' : ''}。每次重新打开网页后第一次用要点一下「允许」。</div>
            <div class="gyf-row">${h ? `<b>📂 ${esc(h.name)}</b> ${ok ? '<span class="ok">可以读写</span>' : '<span>需要允许</span> <button onclick="gyFolderAllow()">允许</button>'} <button onclick="gyFolderConnect()">换一个</button> <button onclick="gyFolderForget()">断开</button>` : `<button class="main" onclick="gyFolderConnect()">连接文件夹</button>`}</div>
            ${ok ? `<div class="gyf-row"><button class="main" onclick="gyFolderBackup()">现在存一份备份</button><label><input type="checkbox" ${c.autoBak ? 'checked' : ''} onchange="gyFolderSet('autoBak',this.checked)"> 每天自动存一份</label> 只留最近 <input type="number" min="1" value="${c.keep}" style="width:54px" onchange="gyFolderSet('keep',+this.value)"> 份${c.last ? ` · 上次 ${new Date(c.last).toLocaleString()}` : ''}</div>
            <div class="gyf-list">${LIST.map(x => `<div><span>${esc(x.n)}</span><em>${x.t ? new Date(x.t).toLocaleString() : ''}</em>${/\.json$/i.test(x.n) && /备份/.test(x.n) ? `<button onclick="gyFolderRestore('${esc(x.n)}')">用它恢复</button>` : ''}${isB() && !/备份/.test(x.n) ? `<button onclick="gyFolderImportCards('${esc(x.n)}')">导入成字卡</button>` : ''}</div>`).join('') || '<div class="gyf-tip">文件夹里还没有 json / txt / csv 文件</div>'}</div>` : ''}
            <label class="gyf-row"><input type="checkbox" ${c.anyType ? 'checked' : ''} onchange="gyFolderSet('anyType',this.checked)"> 手机上「选文件选不到 / 灰色点不了」的修复（推荐开着）</label>`;
    }
    window.gyFolderAllow = async () => { await dir(true); paint(); };
    window.gyFolderSet = (k, v) => { setCfg(k, v); paint(); };
    window.gyFolderOpen = function () {
        let m = document.getElementById('gyFolderModal');
        if (!m) { m = document.createElement('div'); m.id = 'gyFolderModal'; m.innerHTML = `<div class="gyf-card"><div class="gyf-hd"><b>📂 手机文件夹</b><span onclick="document.getElementById('gyFolderModal').remove()">✕</span></div><div id="gyFolderBox"></div></div>`; m.addEventListener('click', e => { if (e.target === m) m.remove(); }); document.body.appendChild(m); }
        paint();
    };
    // 每天自动存一份（只在已经允许过的情况下，不会弹窗）
    setInterval(async () => { const c = cfg(); if (!c.autoBak) return; if (c.last && Date.now() - c.last < 20 * 3600000) return; if (await dir(false)) window.gyFolderBackup(true); }, 10 * 60000);
    const css = document.createElement('style'); css.textContent = `#gyFolderModal{position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}.gyf-card{background:#fff;color:#1d1d1f;border-radius:20px;width:min(520px,94vw);max-height:86vh;overflow:auto;padding:16px 18px}.gyf-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.gyf-hd span{cursor:pointer;color:#999;font-size:18px}
.gyf-tip{font-size:12.5px;color:#888;line-height:1.7;margin:6px 0}.gyf-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;font-size:13.5px}.gyf-row button,.gyf-list button{padding:6px 12px;border-radius:12px;border:1px solid #e3e3e6;background:#f5f5f7;cursor:pointer;font-family:inherit}.gyf-row button.main{background:#1d1d1f;color:#fff;border:none}.gyf-row .ok{color:#2a9d8f}
.gyf-list>div{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f2f2f2;font-size:13px}.gyf-list span{flex:1;word-break:break-all}.gyf-list em{font-style:normal;color:#aaa;font-size:11.5px}`;
    document.head.appendChild(css);
    const reg = () => { try { if (typeof registerMiniFeature === 'function') { registerMiniFeature({ id: 'folder', icon: '📂', title: '手机文件夹', desc: '备份直接存进手机里的文件夹、从里面恢复' + (isB() ? '、导入字卡' : '') + '；也修好了「选文件选不到」', onOpen: () => window.gyFolderOpen(), cat: 'set' }); return true; } } catch (e) {} return false; };
    if (!reg()) { let n = 0; const iv = setInterval(() => { if (reg() || ++n > 40) clearInterval(iv); }, 500); }
})();
