/* ===========================================================================
   js/65 —— 🧠 记忆总览：把后来加的那些「TA 记住的事」也收进来，每一条都能改、能删
   ---------------------------------------------------------------------------
   记忆总览原来只管：聊天总结、推文记忆、群聊总结、向量记忆、记忆条目、资料库、变量。
   后来各个功能里 TA 也会记事，但散在各处、看不到也改不了。这里在每个角色的记忆总览最下面
   加一块「其它记忆」，一条一条列出来，直接改字、或者删掉：
     · 🎭 小剧场记忆（跟别的角色之间发生过的事，总结后的那段）
     · 📅 日程记忆（过去几天做了什么，总结后的那段）
     · 🎵 一起听歌的记忆 · 🎬 一起看电影的记忆
     · 👣 偷翻过你的日记（翻了哪篇、记住了什么、留下的痕迹）
     · 🎲 最近碰上的事（随机事件）
     · 🕘 过往签名
   改完离开输入框就自动存；删掉就真的没了（会先问一句）。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyMemExtraLoaded) return;
    window.__gyMemExtraLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const charOf = id => (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => String(c.id) === String(id));
    const cur = () => { try { return currentMemoryHubTargetId; } catch (e) { return null; } };
    const when = t => { try { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch (e) { return ''; } };
    const saveAll = () => { try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} };
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const ask = async q => { try { if (typeof appConfirm === 'function') return await appConfirm(q); } catch (e) {} return confirm(q); };

    // 一段文字的记忆（整段改 / 清空）
    const TEXTS = [
        { k: 'theaterMemory', ico: '🎭', n: '小剧场记忆', d: '跟别的角色之间发生过的事，攒够几条后总结成的这一段', get: c => c.theaterMemory || '', set: (c, v) => { c.theaterMemory = v; } },
        { k: 'scheduleMemory', ico: '📅', n: '日程记忆', d: '过去几天做了什么，总结后的这一段', get: c => c.scheduleMemory || '', set: (c, v) => { c.scheduleMemory = v; } },
        { k: 'music', ico: '🎵', n: '一起听歌的记忆', d: '一起听完歌存下来的那句话', get: c => (typeof window.gymMemGet === 'function' ? window.gymMemGet(c.id) : ''), set: (c, v) => { if (typeof window.gymMemSet === 'function') window.gymMemSet(c.id, v); }, own: true },
        { k: 'film', ico: '🎬', n: '一起看电影的记忆', d: '一起看完片子存下来的那句话', get: c => (typeof window.fbMemGet === 'function' ? window.fbMemGet(c.id) : ''), set: (c, v) => { if (typeof window.fbMemSet === 'function') window.fbMemSet(c.id, v); }, own: true }
    ];
    // 一条一条的记忆（每条改 / 删）
    const LISTS = [
        { k: 'diaryPeeks', ico: '👣', n: '偷翻过你的日记', d: 'TA 记得自己翻过、记住了什么；被你问起会按人设应对',
          items: c => c.diaryPeeks || [], text: x => x.remember || '', meta: x => `《${x.title || '无题'}》· ${when(x.at)}${x.trace ? ' · 痕迹：' + x.trace : ''}`,
          edit: (x, v) => { x.remember = v; }, del: (c, i) => { const x = c.diaryPeeks.splice(i, 1)[0]; try { (typeof globalUserDiaries !== 'undefined' ? globalUserDiaries : []).forEach(d => { if (d.id === x.entryId && Array.isArray(d.secretPeeks)) d.secretPeeks = d.secretPeeks.filter(p => String(p.charId) !== String(c.id)); }); } catch (e) {} } },
        { k: 'lifeEvents', ico: '🎲', n: '最近碰上的事', d: '随机事件 / 生活里的意外，TA 做决定时会想起来',
          items: c => c.lifeEvents || [], text: x => x.t || '', meta: x => when(x.at), edit: (x, v) => { x.t = v; }, del: (c, i) => { c.lifeEvents.splice(i, 1); } },
        { k: 'bioHistory', ico: '🕘', n: '过往签名', d: 'TA 以前用过的签名',
          items: c => c.bioHistory || [], text: x => x.bio || '', meta: x => when(x.at), edit: (x, v) => { x.bio = v; }, del: (c, i) => { c.bioHistory.splice(i, 1); } }
    ];

    function html(c) {
        const texts = TEXTS.map(t => {
            const v = t.get(c) || '';
            return `<div class="gyme-sec"><div class="gyme-h">${t.ico} ${t.n}<em>${t.d}</em></div>
                ${v ? `<textarea class="gyme-ta" rows="3" data-t="${t.k}" onchange="gyMemExSetText('${t.k}',this.value)">${esc(v)}</textarea>
                <div class="gyme-ops"><button type="button" class="btn-edit-small" onclick="gyMemExSetText('${t.k}','',1)">🗑️ 清空这段</button></div>`
                : '<div class="gyme-none">还没有</div>'}</div>`;
        }).join('');
        const lists = LISTS.map(L => {
            const it = L.items(c);
            return `<div class="gyme-sec"><div class="gyme-h">${L.ico} ${L.n}<em>${L.d}</em></div>
                ${it.length ? it.map((x, i) => `<div class="gyme-row"><textarea class="gyme-ta s" rows="2" onchange="gyMemExEdit('${L.k}',${i},this.value)">${esc(L.text(x))}</textarea>
                    <div class="gyme-meta"><span>${esc(L.meta(x))}</span><button type="button" class="btn-edit-small" onclick="gyMemExDel('${L.k}',${i})">🗑️ 删掉</button></div></div>`).join('')
                : '<div class="gyme-none">还没有</div>'}</div>`;
        }).join('');
        return `<div class="gyme-title">🧩 其它记忆 <span>各个功能里 TA 记下的事。改完点别处就存；删了就真没了</span></div>${texts}${lists}`;
    }
    function paint() {
        const box = document.getElementById('memoryHubContent'); if (!box) return;
        let el = document.getElementById('gyMemExtra');
        const id = cur(), c = id != null && !String(id).startsWith('g_') ? charOf(id) : null;
        if (!c) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'gyMemExtra'; box.appendChild(el); }
        el.innerHTML = html(c);
    }
    window.gyMemExRender = paint;

    window.gyMemExSetText = async function (k, v, clear) {
        const c = charOf(cur()); const t = TEXTS.find(x => x.k === k); if (!c || !t) return;
        if (clear && !(await ask(`把「${t.n}」这段清空？清了 TA 就不记得了。`))) return;
        t.set(c, String(v || '').trim());
        if (!t.own) saveAll();
        toast(clear ? '🗑️ 清掉了' : '✅ 改好了', `${c.name} 的「${t.n}」`);
        if (clear) paint();
    };
    window.gyMemExEdit = function (k, i, v) {
        const c = charOf(cur()); const L = LISTS.find(x => x.k === k); if (!c || !L) return;
        const x = L.items(c)[i]; if (!x) return;
        v = String(v || '').trim(); if (!v) { window.gyMemExDel(k, i); return; }
        L.edit(x, v); saveAll(); toast('✅ 改好了', `${c.name} 的「${L.n}」`);
    };
    window.gyMemExDel = async function (k, i) {
        const c = charOf(cur()); const L = LISTS.find(x => x.k === k); if (!c || !L) return;
        if (!(await ask(`删掉这一条「${L.n}」？删了 TA 就不记得了。`))) return;
        L.del(c, i); saveAll(); paint(); toast('🗑️ 删掉了');
    };

    // 「记忆条目」原来只能删不能改：每条后面加一颗「改」，点了就地改标题和内容
    window.gyMemEntryEdit = function (sid, idx) {
        const list = (typeof getMemoryEntries === 'function') ? getMemoryEntries(sid) : null; const e = list && list[idx]; if (!e) return;
        const box = document.querySelectorAll('#memoryEntriesList > div')[idx]; if (!box) return;
        box.innerHTML = `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">
            <input type="text" value="${esc(e.title || '')}" placeholder="标题" id="gymeT${idx}" style="font-size:13px;">
            <textarea rows="3" id="gymeC${idx}" style="font-size:12.5px;">${esc(e.content || '')}</textarea>
            <div style="display:flex;gap:6px;justify-content:flex-end;"><button type="button" class="btn-edit-small" onclick="renderMemoryEntriesList('${sid}')">算了</button>
            <button type="button" class="btn-edit-small" onclick="gyMemEntrySave('${sid}',${idx})">保存</button></div></div>`;
    };
    window.gyMemEntrySave = function (sid, idx) {
        const list = getMemoryEntries(sid); const e = list[idx]; if (!e) return;
        const c = (document.getElementById('gymeC' + idx) || {}).value; if (!String(c || '').trim()) { toast('内容不能空着', '不想要了就点「删除」'); return; }
        e.title = ((document.getElementById('gymeT' + idx) || {}).value || '').trim(); e.content = String(c).trim();
        saveAll(); renderMemoryEntriesList(sid); toast('✅ 改好了');
    };
    function hookEntries() {
        const f = window.renderMemoryEntriesList;
        if (typeof f !== 'function' || f.__gyme) return;
        const w = function (sid) {
            const r = f.apply(this, arguments);
            try {
                document.querySelectorAll('#memoryEntriesList > div').forEach((row, idx) => {
                    const del = [...row.querySelectorAll('span')].find(x => x.textContent.trim() === '删除');
                    if (del && !row.querySelector('.gyme-edit')) del.insertAdjacentHTML('beforebegin', `<span class="gyme-edit" style="cursor:pointer;flex-shrink:0;opacity:.75;" onclick="gyMemEntryEdit('${sid}',${idx})">改</span>`);
                });
            } catch (e) {}
            return r;
        };
        w.__gyme = true; window.renderMemoryEntriesList = w;
    }

    function hook() {
        hookEntries();
        const f = window.renderMemoryHubContent;
        if (typeof f !== 'function' || f.__gyme) return false;
        const w = function () { const r = f.apply(this, arguments); try { paint(); } catch (e) {} return r; };
        w.__gyme = true; window.renderMemoryHubContent = w;
        return true;
    }
    const CSS = `
#gyMemExtra{margin-top:18px;padding-top:14px;border-top:1px solid var(--gy-border,#eff3f4)}
#gyMemExtra .gyme-title{font-size:16px;font-weight:700;margin-bottom:10px}
#gyMemExtra .gyme-title span{display:block;font-size:12px;font-weight:400;opacity:.6;margin-top:2px}
#gyMemExtra .gyme-sec{margin-bottom:14px}
#gyMemExtra .gyme-h{font-size:14px;font-weight:600;margin-bottom:6px}
#gyMemExtra .gyme-h em{font-style:normal;font-weight:400;font-size:11.5px;opacity:.55;margin-left:6px}
#gyMemExtra .gyme-ta{width:100%;box-sizing:border-box;font-size:13px;line-height:1.6;border-radius:8px;padding:8px 10px;resize:vertical}
#gyMemExtra .gyme-ta.s{min-height:44px}
#gyMemExtra .gyme-row{margin-bottom:8px}
#gyMemExtra .gyme-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;opacity:.75;margin-top:3px}
#gyMemExtra .gyme-ops{text-align:right;margin-top:4px}
#gyMemExtra .gyme-none{font-size:12px;opacity:.5}
`;
    function boot() {
        if (!document.getElementById('gyMemExCss')) { const s = document.createElement('style'); s.id = 'gyMemExCss'; s.textContent = CSS; document.head.appendChild(s); }
        if (!hook()) { let n = 0; const iv = setInterval(() => { if (hook() || ++n > 40) clearInterval(iv); }, 250); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
