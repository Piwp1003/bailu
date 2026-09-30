/* ============================================================
   js/51 —— 💭 思维链收纳盒
   ------------------------------------------------------------
   总开关：设置 → 思维链识别与处理 →「💭 思维链收纳盒」，也可以在收纳盒顶上直接开关。**默认关**。

   关着：跟以前一模一样，各处照旧把思维链剥掉扔掉。
   开着：各处照旧剥掉（正文、状态栏、JSON 解析一律不受影响），
         但剥下来的那段收进这里，按"哪个功能 / 什么时候 / 哪个模型"记好。
         · 🧩 小功能 →「💭 思维链收纳盒」：全部记录，按功能筛选、搜索、复制、删除
         · 聊天气泡上方时间旁边一个很小的 💭：点开就是这一轮的思考

   捕获在 js/01（gyCollectReasoning / gyVaultCapture），这里只管存和看。
   存在单独的 IndexedDB 库（gyReasoningVault），不进主存档——
   思考文字又多又长，塞进主存档会拖慢每一次 saveAllData 和云同步。
   全部保留，不自动删；要清就在收纳盒里手动清。
   ============================================================ */
(function () {
    'use strict';

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let store = null;
    try {
        if (typeof localforage !== 'undefined' && localforage.createInstance)
            store = localforage.createInstance({ name: 'gyReasoningVault', storeName: 'entries' });
    } catch (e) { store = null; }

    // 记录的 id 里直接带着 取件码|时间|功能名，这样列表、筛选、气泡上的 💭 都只读 keys()，
    // 不用把几千条思考正文全读出来。
    const SEP = '|';
    const mkId = (rec) => [rec.key || 'x', rec.t, encodeURIComponent(rec.feature || '其它'), Math.random().toString(36).slice(2, 7)].join(SEP);
    const parseId = (id) => { const p = String(id).split(SEP); return { id, key: p[0] === 'x' ? '' : p[0], t: +p[1] || 0, feature: decodeURIComponent(p[2] || '%E5%85%B6%E5%AE%83') }; };

    let IDS = [];                 // 全部记录的 id（新的在前）
    const KEYS = new Set();       // 有思考的取件码，给气泡上的 💭 用
    let ready = false;
    const recent = [];            // 最近收进来的文字指纹，防同一段被两条路径各收一次

    async function loadIndex() {
        if (!store) { ready = true; return; }
        try {
            const ks = await store.keys();
            const metas = ks.map(parseId).sort((a, b) => b.t - a.t);
            IDS = metas.map(m => m.id);
            metas.forEach(m => { if (m.key) KEYS.add(m.key); });
        } catch (e) { console.warn('[思维链收纳盒] 读索引失败：', e); }
        ready = true;
        // js/51 加载前就收到的，补存进去
        const pend = window.__gyVaultPending || [];
        window.__gyVaultPending = [];
        for (const r of pend) await sink(r);
        refreshChatSoon();
    }

    let chatTimer = null;
    function refreshChatSoon() {
        clearTimeout(chatTimer);
        chatTimer = setTimeout(() => {
            try {
                const v = document.getElementById('view-chat');
                if (v && v.style.display !== 'none' && typeof renderChatMessages === 'function') renderChatMessages();
            } catch (e) {}
        }, 400);
    }

    async function sink(rec) {
        try {
            if (!rec || !rec.text || !rec.text.trim()) return;
            if (!ready) { (window.__gyVaultPending = window.__gyVaultPending || []).push(rec); return; }
            const fp = rec.text.length + ':' + rec.text.slice(0, 80) + rec.text.slice(-80);
            const now = Date.now();
            while (recent.length && now - recent[0].t > 60000) recent.shift();
            const dup = recent.find(r => r.fp === fp);
            if (dup) {
                // 同一段已经收过了；这次如果带着取件码而上次没有，就补一条轻量关联，让气泡的 💭 能找到它
                if (rec.key && rec.key !== dup.key) { dup.key = rec.key; } else return;
            }
            recent.push({ t: now, fp, key: rec.key || '' });
            const id = mkId(rec);
            if (store) await store.setItem(id, rec);
            IDS.unshift(id);
            if (rec.key) { KEYS.add(rec.key); refreshChatSoon(); }
            const m = document.getElementById(MID);
            if (m && !m.__keyMode) { m.__dirty = true; const b = m.querySelector('.gyrv-new'); if (b) b.style.display = ''; }
        } catch (e) { console.warn('[思维链收纳盒] 存入失败（不影响正常使用）：', e); }
    }
    window.gyReasoningVaultSink = sink;

    /* ---------- 聊天气泡上的 💭 ---------- */
    window.gyVaultChipHtml = function (key) {
        try {
            if (typeof reasoningVaultOn === 'undefined' || !reasoningVaultOn) return '';
            if (!key || !KEYS.has(key)) return '';
            return `<div class="gyrv-chip" title="看这一轮的思考" onclick="event.stopPropagation(); gyVaultOpenKey('${esc(key)}')">💭 看 TA 这一轮在想什么</div>`;
        } catch (e) { return ''; }
    };

    /* ---------- 开关 ---------- */
    window.gyVaultSetOn = function (on) {
        reasoningVaultOn = !!on;
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        const t = document.getElementById('reasoningVaultToggle'); if (t) t.checked = reasoningVaultOn;
        const m = document.getElementById(MID); if (m) { const x = m.querySelector('.gyrv-sw input'); if (x) x.checked = reasoningVaultOn; }
        refreshChatSoon();
    };

    /* ---------- 收纳盒弹窗 ---------- */
    const MID = 'gyReasoningVaultModal';
    const PAGE = 30;
    function close() { const m = document.getElementById(MID); if (m) m.remove(); }
    window.gyVaultClose = close;

    const fmtTime = (t) => {
        const d = new Date(t), p = n => String(n).padStart(2, '0');
        return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
    };

    function entryHtml(meta, rec, open) {
        if (!rec) return '';
        const sub = [rec.model, rec.via].filter(Boolean).map(esc).join(' · ');
        const preview = esc(rec.text.replace(/\s+/g, ' ').slice(0, 60));
        return `<details class="gyrv-item" data-id="${esc(meta.id)}"${open ? ' open' : ''}>
            <summary><span class="gyrv-tag">${esc(meta.feature)}</span><span class="gyrv-time">${fmtTime(meta.t)}</span>
                <span class="gyrv-pv">${preview}</span></summary>
            <div class="gyrv-meta">${sub}${sub ? ' · ' : ''}${rec.text.length} 字
                <span class="gyrv-ops"><button type="button" onclick="gyVaultCopy(this)">复制</button><button type="button" onclick="gyVaultDel(this)">删除</button></span></div>
            <div class="gyrv-body">${esc(rec.text)}</div>
        </details>`;
    }

    async function getRec(id) { try { return store ? await store.getItem(id) : null; } catch (e) { return null; } }

    function filtered(m) {
        const f = m.__feat || '';
        return f ? IDS.filter(id => parseId(id).feature === f) : IDS.slice();
    }

    async function renderList(m, reset) {
        const box = m.querySelector('.gyrv-list');
        if (reset) { m.__shown = 0; box.innerHTML = ''; }
        const q = (m.__q || '').trim().toLowerCase();
        const ids = filtered(m);
        let html = '', added = 0;
        while (m.__shown < ids.length && added < PAGE) {
            const id = ids[m.__shown++];
            const rec = await getRec(id);
            if (!rec) continue;
            if (q && !(rec.text.toLowerCase().includes(q) || (rec.feature || '').toLowerCase().includes(q))) continue;
            html += entryHtml(parseId(id), rec, false); added++;
        }
        box.insertAdjacentHTML('beforeend', html);
        const more = m.querySelector('.gyrv-more');
        if (more) more.style.display = m.__shown < ids.length ? '' : 'none';
        if (!box.children.length) box.innerHTML = `<div class="gyrv-empty">${IDS.length ? '没有符合条件的记录。' :
            (reasoningVaultOn ? '还没收到思考内容。等角色下一次回复就有了——前提是你用的模型/预设会输出思考。' :
                '收纳盒现在是关着的。打开上面的开关，之后各功能剥下来的思考都会收到这里。')}</div>`;
        const cnt = m.querySelector('.gyrv-count'); if (cnt) cnt.textContent = `共 ${IDS.length} 条`;
        const nb = m.querySelector('.gyrv-new'); if (nb) nb.style.display = 'none';
    }

    function featureOptions() {
        const seen = new Map();
        IDS.forEach(id => { const f = parseId(id).feature; seen.set(f, (seen.get(f) || 0) + 1); });
        return [...seen.entries()].sort((a, b) => b[1] - a[1])
            .map(([f, n]) => `<option value="${esc(f)}">${esc(f)}（${n}）</option>`).join('');
    }

    function shell(title, inner) {
        close();
        const m = document.createElement('div');
        m.id = MID; m.className = 'modal-overlay'; m.style.display = 'flex'; m.style.zIndex = '3200';
        m.innerHTML = `<div class="modal-box gyrv-box"><h2 style="margin-top:0;">${title}</h2>${inner}
            <div style="text-align:right; margin-top:12px;"><button type="button" class="btn-cancel" onclick="gyVaultClose()">关闭</button></div></div>`;
        m.addEventListener('click', ev => { if (ev.target === m) close(); });
        document.body.appendChild(m);
        return m;
    }

    function diagHtml() {
        let L = window.__gyVaultDiag;
        try { if (!L) L = JSON.parse(localStorage.getItem('gy_vault_diag') || '[]'); } catch (e) { L = []; }
        if (!L || !L.length) return `<div class="gyrv-empty">${reasoningVaultOn ? '开关打开之后还没有请求过。让角色回一条消息再来看。' : '收纳盒关着，不记录。'}</div>`;
        return `<div class="gyrv-diag-tip">"认出思考 0 段"＝模型这次没把思考发回来（很多模型/中转默认不返回思考，或者预设没让它想），这种时候收纳盒里就是空的。
            "状态栏：没有"＝这次回复里没找到状态栏那一截。把这里截图发我，我能看出卡在哪。</div>` + L.map(d => `
            <div class="gyrv-diag-i">
              <div class="gyrv-diag-h"><b>${esc(d.f)}</b><span>${fmtTime(d.t)}</span><span>${esc(d.m)}</span><span>${esc(d.via)}</span></div>
              <div class="gyrv-diag-tags"><i class="${d.n ? 'ok' : 'no'}">认出思考 ${d.n} 段</i><i class="${d.st ? 'ok' : 'no'}">状态栏：${d.st ? '有' : '没有'}</i><i>共 ${d.len} 字</i></div>
              <pre>${esc(d.head)}${d.tail ? '\n……\n' + esc(d.tail) : ''}</pre>
            </div>`).join('');
    }
    window.gyVaultOpen = async function () {
        if (!ready) await new Promise(r => { const iv = setInterval(() => { if (ready) { clearInterval(iv); r(); } }, 100); });
        const m = shell('💭 思维链收纳盒', `
            <div class="gyrv-top">
                <label class="gyrv-sw"><input type="checkbox" ${reasoningVaultOn ? 'checked' : ''} onchange="gyVaultSetOn(this.checked)"> 收纳思维链</label>
                <span class="gyrv-count"></span>
            </div>
            <div class="gyrv-hint">开着时，所有功能剥下来的思考都存在这里，正文照旧干净。聊天气泡下面的「💭 看 TA 这一轮在想什么」可以直接看那一轮。全部保留，不会自动删。</div>
            <div class="gyrv-bar">
                <select class="gyrv-feat" onchange="gyVaultFilter(this.value)"><option value="">全部功能</option>${featureOptions()}</select>
                <input class="gyrv-q" type="search" placeholder="搜思考内容…" oninput="gyVaultSearch(this.value)">
            </div>
            <button type="button" class="gyrv-new" style="display:none" onclick="gyVaultRefresh()">有新记录，点这里刷新</button>
            <div class="gyrv-list"></div>
            <button type="button" class="gyrv-more" style="display:none" onclick="gyVaultMore()">再加载 ${PAGE} 条</button>
            <details class="gyrv-diag"><summary>🩺 体检：最近几次模型到底回了什么</summary><div class="gyrv-diag-body">${diagHtml()}</div></details>
            <div class="gyrv-foot"><button type="button" class="gyrv-danger" onclick="gyVaultClearAll()">清空全部记录</button></div>`);
        m.__feat = ''; m.__q = '';
        await renderList(m, true);
    };

    window.gyVaultOpenKey = async function (key) {
        const ids = IDS.filter(id => parseId(id).key === key);
        const m = shell('💭 这一轮的思考', `<div class="gyrv-list"></div>
            <div class="gyrv-foot" style="text-align:left;"><button type="button" onclick="gyVaultOpen()">打开整个收纳盒</button></div>`);
        m.__keyMode = true;
        const box = m.querySelector('.gyrv-list');
        let html = '';
        for (const id of ids) html += entryHtml(parseId(id), await getRec(id), true);
        box.innerHTML = html || '<div class="gyrv-empty">这一轮的思考找不到了（可能已经被删掉）。</div>';
    };

    window.gyVaultFilter = function (f) { const m = document.getElementById(MID); if (!m) return; m.__feat = f; renderList(m, true); };
    let qTimer = null;
    window.gyVaultSearch = function (q) {
        clearTimeout(qTimer);
        qTimer = setTimeout(() => { const m = document.getElementById(MID); if (!m) return; m.__q = q; renderList(m, true); }, 250);
    };
    window.gyVaultMore = function () { const m = document.getElementById(MID); if (m) renderList(m, false); };
    window.gyVaultRefresh = function () {
        const m = document.getElementById(MID); if (!m) return;
        const sel = m.querySelector('.gyrv-feat');
        if (sel) { const v = sel.value; sel.innerHTML = `<option value="">全部功能</option>${featureOptions()}`; sel.value = v; }
        renderList(m, true);
    };

    window.gyVaultCopy = async function (btn) {
        const it = btn.closest('.gyrv-item'); if (!it) return;
        const rec = await getRec(it.dataset.id); if (!rec) return;
        try { await navigator.clipboard.writeText(rec.text); btn.textContent = '已复制'; }
        catch (e) {
            const ta = document.createElement('textarea'); ta.value = rec.text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); btn.textContent = '已复制'; } catch (e2) { btn.textContent = '复制失败'; }
            ta.remove();
        }
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
    };
    window.gyVaultDel = async function (btn) {
        const it = btn.closest('.gyrv-item'); if (!it) return;
        const id = it.dataset.id;
        try { if (store) await store.removeItem(id); } catch (e) {}
        IDS = IDS.filter(x => x !== id);
        const k = parseId(id).key;
        if (k && !IDS.some(x => parseId(x).key === k)) KEYS.delete(k);
        it.remove();
        const m = document.getElementById(MID); const cnt = m && m.querySelector('.gyrv-count'); if (cnt) cnt.textContent = `共 ${IDS.length} 条`;
        refreshChatSoon();
    };
    window.gyVaultClearAll = async function () {
        if (!IDS.length) return;
        if (!confirm(`确定清空全部 ${IDS.length} 条思维链记录？清了就找不回来了。`)) return;
        try { if (store) await store.clear(); } catch (e) {}
        IDS = []; KEYS.clear();
        const m = document.getElementById(MID); if (m) renderList(m, true);
        refreshChatSoon();
    };

    /* ---------- 样式（不占 style.css，跟着模块走）---------- */
    const css = `
.gyrv-chip { display:inline-flex !important; align-items:center; gap:4px; margin:4px 0 2px; padding:3px 10px; font-size:11.5px; line-height:1.4;
  border-radius:999px; cursor:pointer; user-select:none; color:var(--gy-accent,#1d9bf0); background:rgba(29,155,240,.08);
  border:1px solid rgba(29,155,240,.25); opacity:.85; transition:opacity .15s, background .15s; visibility:visible !important; }
.gyrv-chip:hover, .gyrv-chip:active { opacity:1; background:rgba(29,155,240,.16); }
.gyrv-diag{margin-top:12px;border:1px dashed rgba(139,152,165,.5);border-radius:10px;padding:6px 10px;}
.gyrv-diag summary{cursor:pointer;font-size:13px;font-weight:600;}
.gyrv-diag-tip{font-size:12px;opacity:.65;line-height:1.7;margin:6px 0;}
.gyrv-diag-i{border-top:1px solid rgba(139,152,165,.2);padding:8px 0;}
.gyrv-diag-h{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;}
.gyrv-diag-h span{opacity:.55;}
.gyrv-diag-tags{display:flex;gap:6px;margin:4px 0;flex-wrap:wrap;}
.gyrv-diag-tags i{font-style:normal;font-size:11.5px;padding:1px 8px;border-radius:99px;background:rgba(139,152,165,.15);}
.gyrv-diag-tags i.ok{background:rgba(0,186,124,.15);color:#00a36c;}
.gyrv-diag-tags i.no{background:rgba(249,24,128,.12);color:#e0245e;}
.gyrv-diag-i pre{margin:0;white-space:pre-wrap;word-break:break-all;font-size:11.5px;max-height:160px;overflow:auto;background:rgba(139,152,165,.08);padding:6px 8px;border-radius:6px;}
.gyrv-box { width:560px; max-width:94vw; max-height:88vh; display:flex; flex-direction:column; }
.gyrv-top { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:14px; }
.gyrv-sw { display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; }
.gyrv-count { font-size:12px; color:#8b98a5; }
.gyrv-hint { font-size:12px; color:#8b98a5; line-height:1.7; margin:6px 0 10px; }
.gyrv-bar { display:flex; gap:6px; margin-bottom:8px; }
.gyrv-bar select, .gyrv-bar input { padding:6px 8px; border:1px solid rgba(139,152,165,.4); border-radius:6px; font-size:13px; background:transparent; color:inherit; min-width:0; }
.gyrv-bar input { flex:1; }
.gyrv-list { overflow-y:auto; flex:1; min-height:80px; display:flex; flex-direction:column; gap:6px; }
.gyrv-item { border:1px dashed rgba(139,152,165,.4); border-radius:8px; background:rgba(139,152,165,.06); }
.gyrv-item summary { padding:7px 10px; font-size:12px; color:#8b98a5; cursor:pointer; list-style:none; display:flex; gap:8px; align-items:center; min-width:0; }
.gyrv-item summary::-webkit-details-marker { display:none; }
.gyrv-tag { flex:none; padding:1px 7px; border-radius:10px; background:rgba(29,155,240,.12); color:#1d9bf0; }
.gyrv-time { flex:none; }
.gyrv-pv { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.8; min-width:0; }
.gyrv-item[open] .gyrv-pv { display:none; }
.gyrv-meta { font-size:11px; color:#8b98a5; padding:0 10px 4px; display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; }
.gyrv-ops button, .gyrv-foot button, .gyrv-more, .gyrv-new { font-size:12px; padding:3px 10px; border-radius:6px; border:1px solid rgba(139,152,165,.4); background:transparent; color:inherit; cursor:pointer; margin-left:4px; }
.gyrv-body { padding:8px 10px; border-top:1px dashed rgba(139,152,165,.3); font-size:12px; line-height:1.65; color:#8b98a5; white-space:pre-wrap; word-break:break-word; max-height:340px; overflow-y:auto; font-family:monospace; }
.gyrv-more, .gyrv-new { margin:8px auto 0; display:block; }
.gyrv-new { margin:0 auto 8px; color:#1d9bf0; border-color:#1d9bf0; }
.gyrv-empty { font-size:13px; color:#8b98a5; text-align:center; padding:24px 10px; line-height:1.7; }
.gyrv-foot { text-align:right; margin-top:10px; }
.gyrv-danger { color:#f4212e !important; border-color:rgba(244,33,46,.4) !important; }
body.dark-theme .gyrv-item { background:rgba(139,152,165,.1); border-color:rgba(139,152,165,.3); }
.gyrv-inline { margin:0 0 6px; font-size:12px; color:#8b98a5; }
.gyrv-inline summary { display:inline-block; cursor:pointer; list-style:none; opacity:.45; filter:grayscale(1); user-select:none; }
.gyrv-inline summary::-webkit-details-marker { display:none; }
.gyrv-inline[open] summary, .gyrv-inline summary:hover { opacity:1; filter:none; }
.gyrv-inline-body { margin-top:4px; padding:8px 10px; border:1px dashed rgba(139,152,165,.4); border-radius:8px; background:rgba(139,152,165,.06); white-space:pre-wrap; line-height:1.65; max-height:260px; overflow-y:auto; }
.gy-chat-status { display:block !important; visibility:visible !important; margin-top:4px; max-width:260px; font-size:12px; color:#8b98a5; border:1px dashed rgba(139,152,165,.35); border-radius:10px; background:rgba(139,152,165,.06); }
.gy-chat-status summary { padding:4px 10px; cursor:pointer; list-style:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; user-select:none; }
.gy-chat-status summary::-webkit-details-marker { display:none; }
.gy-chat-status-body { padding:4px 10px 8px; border-top:1px dashed rgba(139,152,165,.3); display:flex; flex-direction:column; gap:3px; }
.gy-cs-row { display:flex; gap:6px; line-height:1.55; }
.gy-chat-status.with-card { max-width:none; width:min(480px, 78vw); }
.gy-cal-status .gy-stcard { border:1px solid rgba(139,152,165,.25); border-radius:10px; margin:6px 0; background:rgba(139,152,165,.05); overflow:hidden; }
.gy-stcard summary { list-style:none; cursor:pointer; display:flex; align-items:center; gap:8px; padding:8px 10px; font-size:13px; }
.gy-stcard summary::-webkit-details-marker { display:none; }
.gy-stcard-t { flex:none; font-variant-numeric:tabular-nums; color:var(--gy-accent,#1d9bf0); font-weight:600; }
.gy-stcard-s { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gy-stcard-k { flex:none; font-size:11px; color:#8b98a5; border:1px solid rgba(139,152,165,.35); border-radius:999px; padding:0 7px; }
.gy-stcard[open] summary { border-bottom:1px dashed rgba(139,152,165,.3); }
.gy-stcard-b { padding:8px 10px; font-size:12.5px; }
.gy-stcard-b .gy-chat-status { max-width:none; width:100%; margin:0; border:none; background:none; }
.gy-stcard-b .gy-chat-status > summary { display:none; }
.gy-stcard-act { margin-bottom:6px; color:#536471; }
.gy-stcard-act span { font-size:11px; color:#8b98a5; }
.gy-chat-status-card { padding:6px; border-top:1px dashed rgba(139,152,165,.3); overflow-x:auto; color:initial; font-size:14px; }
.gy-chat-status-card iframe { max-width:100%; }
.gy-cs-row b { flex:none; color:#536471; font-weight:600; }
body.dark-theme .gy-cs-row b { color:#c4cfd6; }
`;
    try { const st = document.createElement('style'); st.id = 'gyReasoningVaultCss'; st.textContent = css; document.head.appendChild(st); } catch (e) {}

    /* ---------- 🧩 小功能入口 ---------- */
    try {
        if (typeof registerMiniFeature === 'function') {
            registerMiniFeature({
                id: 'gyReasoningVault', icon: '💭', title: '思维链收纳盒',
                desc: '打开后，各功能剥掉的思考过程都收在这里，正文不受影响',
                onOpen: () => window.gyVaultOpen()
            });
        }
    } catch (e) {}

    loadIndex();
})();
