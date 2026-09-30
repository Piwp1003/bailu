/* ============================================================
   js/55 —— 角色卡的几样补充
   ------------------------------------------------------------
   ① 聊天里显示卡片自带的小界面：卡里写好的「手机消息 / 小红书 / 朋友圈 / 转账 / 语音」这类正则，
      以前聊天气泡是纯文字，全都显示不出来。现在 TA 的回复里一出现这种格式，就按卡片的设计画在气泡下面。
      只认**绑在这个角色身上**的正则（全局的不碰），状态栏那几条还是走状态栏折叠框。
   ② （开场白选择：项目里本来就有——第一次打开聊天时会弹出来让你挑，这里不重复做）
   ③ 卡片里的网络图片存到本地：导入时顺手把正则里引用的外网图片下载下来换成本地的，
      没网、图床挂了也照样显示。下不下来的（对方不让跨站拿）原样留着，不影响别的。
   ④ 正则管理页按角色分组，没有归属（对所有人生效）的单独标出来，每条都能直接改归属。
   ⑤ 重复导入提醒：已经有同名角色时先问一声。（在 js/13 里调用 gyCardDupCheck）
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyCardExtras) return;
    window.__gyCardExtras = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];
    const scopedTo = (rs, charId) => Array.isArray(rs.charScope) && rs.charScope.length && rs.charScope.map(String).includes(String(charId));

    /* ================= ① 聊天里的卡片小界面 ================= */
    const reCache = new Map();
    function reOf(rs) {
        const key = rs.id + '|' + rs.find + '|' + (rs.flags || '');
        if (reCache.has(key)) return reCache.get(key);
        let re = null;
        try {
            if (rs.isRegex === false) {
                re = new RegExp(String(rs.find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            } else {
                const lit = (typeof parseRegexLiteral === 'function') ? parseRegexLiteral(rs.find) : { pattern: rs.find, flags: '' };
                let fl = String(rs.flags || lit.flags || '');
                if (fl.indexOf('g') === -1) fl += 'g';
                re = new RegExp(lit.pattern, fl);
            }
        } catch (e) { re = null; }
        reCache.set(key, re);
        return re;
    }
    window.gyChatWidgetSplit = function (text, charId, depth) {
        const out = { rest: text, html: '' };
        try {
            if (!text || typeof text !== 'string' || typeof regexScripts === 'undefined') return out;
            if (typeof isAutoOn === 'function' && !isAutoOn('chatCardWidgets')) return out;
            const list = regexScripts.filter(rs => rs && rs.enabled !== false && rs.promptOnly !== true && rs.target !== 'user_input'
                && scopedTo(rs, charId) && !/状态|status/i.test(rs.name || '') && rs.find);
            if (!list.length) return out;
            const hits = [];
            list.forEach(rs => {
                const re = reOf(rs); if (!re) return;
                re.lastIndex = 0;
                let m, guard = 0;
                while ((m = re.exec(text)) && guard++ < 50) {
                    if (!m[0]) { re.lastIndex++; continue; }
                    if (m[0].length < 4) continue;
                    if (hits.some(h => m.index < h.end && m.index + m[0].length > h.start)) continue;
                    hits.push({ start: m.index, end: m.index + m[0].length, seg: m[0] });
                }
            });
            if (!hits.length) return out;
            hits.sort((a, b) => a.start - b.start);
            // 挨着的几段合成一块一起画（比如连着好几条手机消息）
            const blocks = [];
            hits.forEach(h => {
                const last = blocks[blocks.length - 1];
                if (last && !text.slice(last.end, h.start).trim()) { last.end = h.end; last.seg = text.slice(last.start, h.end); }
                else blocks.push(Object.assign({}, h));
            });
            let rest = text, html = '';
            const used = [];
            blocks.forEach(b => {
                let h = (typeof renderMarkdownLite === 'function') ? renderMarkdownLite(b.seg, charId, depth, { statusContext: 'chat' }) : '';
                if (typeof namespaceInjectedIds === 'function') h = namespaceInjectedIds(h, 'cw' + b.start + '_' + (depth || 0));
                // 渲染完跟原文一样（正则没真的把它变成界面）就还给正文
                if (!h || h.indexOf(b.seg.slice(0, 12)) !== -1) { return; }
                // 只是被包成了代码块（卡片靠酒馆插件脚本才能画出来的那种）——这里画不出来，还给正文
                const bare = h.replace(/<\/?(pre|code|br|p|span)[^>]*>/gi, '');
                if (!/<[a-z][^>]*>/i.test(bare)) { return; }
                html += `<div class="gy-chat-widget" onclick="event.stopPropagation()">${h}</div>`;
                used.push(b);
            });
            // 只把真的画出来的那几段从正文里拿掉，画不出来的留在正文里
            used.slice().reverse().forEach(b => { rest = rest.slice(0, b.start) + rest.slice(b.end); });
            if (!html) return out;
            out.rest = rest.replace(/\n{3,}/g, '\n\n').trim();
            out.html = html;
        } catch (e) { console.warn('[卡片小界面] 跳过：', e); }
        return out;
    };

    /* ================= ③ 卡片里的网络图片存到本地 ================= */
    const IMG_RE = /https?:\/\/[^\s"'()<>\\]+?\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?[^\s"'()<>\\]*)?(?=["'()\s<>\\]|$)/gi;
    const blobToData = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
    async function fetchData(url) {
        const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
        const t = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) {} }, 10000);
        try {
            const r = await fetch(url, { signal: ctl ? ctl.signal : undefined, mode: 'cors' });
            if (!r.ok) return null;
            const b = await r.blob();
            // 不再按大小拒收（以前超过 1.5MB 的图就不存本地）；只看是不是图片
            if (!b || !/^image\//.test(b.type || 'image/')) return null;
            return await blobToData(b);
        } catch (e) { return null; } finally { clearTimeout(t); }
    }
    // 返回 { ok, fail }
    window.gyLocalizeRegexAssets = async function (ids, quiet) {
        const res = { ok: 0, fail: 0 };
        try {
            if (typeof regexScripts === 'undefined') return res;
            const list = regexScripts.filter(rs => rs && (!ids || ids.map(String).includes(String(rs.id))) && typeof rs.replace === 'string');
            const urls = new Set();
            list.forEach(rs => { (rs.replace.match(IMG_RE) || []).forEach(u => urls.add(u)); });
            if (!urls.size) return res;
            if (!quiet) try { showToast('', '🖼️ 卡片图片', `正在把 ${urls.size} 张网络图片存到本地…`, null, null, false); } catch (e) {}
            const map = {};
            for (const u of urls) { const d = await fetchData(u); if (d) { map[u] = d; res.ok++; } else res.fail++; }
            if (res.ok) {
                list.forEach(rs => { Object.keys(map).forEach(u => { if (rs.replace.indexOf(u) !== -1) rs.replace = rs.replace.split(u).join(map[u]); }); });
                if (typeof saveAllData === 'function') saveAllData();
                if (typeof renderRegexScriptsList === 'function') try { renderRegexScriptsList(); } catch (e) {}
            }
            if (!quiet) try { showToast('', '🖼️ 卡片图片', `存好 ${res.ok} 张${res.fail ? `，${res.fail} 张对方不让下载（还是用网络地址）` : ''}`, null, null, false); } catch (e) {}
        } catch (e) { console.warn('[卡片图片] 出错：', e); }
        return res;
    };

    /* ================= ④ 正则管理页按角色分组 ================= */
    function hookRegexList() {
        const o = window.renderRegexScriptsList;
        if (typeof o !== 'function' || o.__gyGroup) return;
        const w = function () {
            const r = o.apply(this, arguments);
            try { groupRegexList(); } catch (e) { console.warn(e); }
            return r;
        };
        w.__gyGroup = true;
        window.renderRegexScriptsList = w;
        try { renderRegexScriptsList = w; } catch (e) {}
    }
    function groupRegexList() {
        const box = document.getElementById('regexScriptsList');
        if (!box || typeof regexScripts === 'undefined' || !regexScripts.length) return;
        const rows = Array.from(box.children);
        if (rows.length !== regexScripts.length) return;
        const nameOf = id => { const c = chars().find(x => String(x.id) === String(id)); return c ? c.name : '（已删除的角色）'; };
        const groups = new Map();
        regexScripts.forEach((rs, i) => {
            const sc = Array.isArray(rs.charScope) ? rs.charScope : [];
            const k = sc.length ? sc.map(String).sort().join(',') : '__all';
            if (!groups.has(k)) groups.set(k, { label: sc.length ? sc.map(nameOf).join(' / ') : '', items: [] });
            groups.get(k).items.push({ rs, row: rows[i] });
        });
        const frag = document.createDocumentFragment();
        const keys = Array.from(groups.keys()).sort((a, b) => (a === '__all') - (b === '__all'));
        keys.forEach(k => {
            const g = groups.get(k);
            const sec = document.createElement('div');
            sec.className = 'gy-rx-sec' + (k === '__all' ? ' all' : '');
            sec.innerHTML = k === '__all'
                ? `<div class="gy-rx-hd">🌐 没有归属 · 对所有角色都生效 <span>${g.items.length} 条</span></div>
                   <div class="gy-rx-warn">角色卡带来的正则放在这里，会套到别的角色身上（样式串、状态栏串）。用每条右边的下拉框把它指给对应的角色。</div>`
                : `<div class="gy-rx-hd">🎭 ${esc(g.label)} <span>${g.items.length} 条</span></div>`;
            g.items.forEach(({ rs, row }) => {
                const sel = document.createElement('select');
                sel.className = 'gy-rx-own';
                sel.title = '这条正则归谁';
                const cur = (Array.isArray(rs.charScope) && rs.charScope.length === 1) ? String(rs.charScope[0]) : (Array.isArray(rs.charScope) && rs.charScope.length > 1 ? '__multi' : '');
                sel.innerHTML = `<option value="">所有角色</option>${cur === '__multi' ? '<option value="__multi" selected>（好几个角色）</option>' : ''}` +
                    chars().map(c => `<option value="${esc(c.id)}"${String(c.id) === cur ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
                sel.addEventListener('change', () => {
                    if (sel.value === '__multi') return;
                    rs.charScope = sel.value ? [chars().find(c => String(c.id) === sel.value).id] : [];
                    if (typeof saveAllData === 'function') saveAllData();
                    renderRegexScriptsList();
                });
                const del = row.lastElementChild;
                row.insertBefore(sel, del);
                sec.appendChild(row);
            });
            frag.appendChild(sec);
        });
        const tools = document.createElement('div');
        tools.className = 'gy-rx-tools';
        tools.innerHTML = `<button type="button" class="btn-edit-small" onclick="gyLocalizeRegexAssets()">🖼️ 把正则里的网络图片存到本地</button>`;
        box.innerHTML = '';
        box.appendChild(tools);
        box.appendChild(frag);
    }
    hookRegexList(); setTimeout(hookRegexList, 1500);

    /* ================= ⑤ 重复导入 ================= */
    window.gyCardDupCheck = async function (names) {
        try {
            const have = chars().map(c => String(c.name || '').trim());
            const dup = (names || []).map(n => String(n || '').trim()).filter(n => n && have.includes(n));
            if (!dup.length) return true;
            const ask = (typeof appConfirm === 'function') ? appConfirm : (m => Promise.resolve(confirm(m)));
            return await ask(`已经有叫「${dup.join('」「')}」的角色了。\n\n再导一次会多出一个同名角色，世界书和正则也会再导一份。\n确定还要导入吗？`);
        } catch (e) { return true; }
    };

    /* ================= 开关 ================= */
    function regSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return false;
            if (!AUTO_FEATURE_DEFS.some(d => d.key === 'chatCardWidgets')) AUTO_FEATURE_DEFS.push({
                key: 'chatCardWidgets', label: '聊天里显示卡片小界面',
                desc: '角色卡里写好的手机消息、小红书、朋友圈、转账、语音这类格式，TA 在聊天里用到时按卡片的设计画出来。只用绑在这个角色身上的正则。',
                cost: '不花调用', group: '聊天', where: '聊天气泡下面'
            });
            return true;
        } catch (e) { return true; }
    }
    if (!regSwitches()) setTimeout(regSwitches, 1200);

    /* ================= 样式 ================= */
    try {
        const st = document.createElement('style');
        st.textContent = `
.gy-chat-widget{margin-top:6px;width:min(480px,78vw);max-width:100%;border-radius:12px;overflow:hidden;}
.gy-chat-widget iframe{width:100%;}
.gy-rx-tools{margin-bottom:8px;}
.gy-rx-sec{margin:10px 0 14px;display:flex;flex-direction:column;gap:6px;}
.gy-rx-hd{font-size:13.5px;font-weight:700;display:flex;gap:8px;align-items:baseline;padding-bottom:4px;border-bottom:2px solid var(--gy-accent,#1d9bf0);}
.gy-rx-hd span{font-size:11.5px;font-weight:400;opacity:.55;}
.gy-rx-sec.all .gy-rx-hd{border-color:#f4a100;}
.gy-rx-warn{font-size:12px;line-height:1.6;color:#b07500;background:rgba(244,161,0,.1);border-radius:8px;padding:6px 10px;}
.gy-rx-own{width:auto;max-width:120px;font-size:12px;padding:3px 6px;flex-shrink:0;}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
