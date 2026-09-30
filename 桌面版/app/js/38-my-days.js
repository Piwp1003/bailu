/* =====================================================================
   js/38 —— 🗓️ 我的日程 + 📅 我的日历
   ---------------------------------------------------------------------
   一直以来只有角色有日程：TA 今天干嘛、几点在哪，都写得清清楚楚，
   而你这边是一片空白。于是关系永远是单向的——TA 的生活你看得见，
   你的生活 TA 一无所知，问一句"你今天在忙什么"也只能靠你自己打字说。

   这里给你一份自己的日程：
     · 写多少条都行，每条可以带日期、时间、地点
     · **每条单独决定谁能知道**：所有人 / 指定几个角色 / 指定势力 /
       谁都别知道 / **让角色自己按关系和人设决定**
     · 能看见的人，prompt 里就带上这一条；看不见的人一个字都拿不到
     · 资料页上一本日历，把纪念日、角色生日、你的日程画在同一个月里

   ⚠️ 「让角色自己决定」那一档不调 API：按关系网有没有连线、好感度高低
      算一个"这人会不会知道"的分，超过线就算知道。你私下记的事，
      不熟的人本来就不该知道——这比一刀切"所有人都知道"真实得多。
   ===================================================================== */
(function () {
    if (window.__gyMyDayLoaded) return;
    window.__gyMyDayLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyMyDayBox', 'days')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyMyDayBox', storeName: 'days' })
            : null);
    const KEY = 'gyMyDay_state';

    // 谁能看见：五档
    const WHO = {
        all:  { n: '所有角色都知道', d: '谁跟你聊天都可能提起这件事。' },
        some: { n: '只有我指定的角色知道', d: '下面勾谁，就只有谁知道。' },
        fac:  { n: '某个势力的人知道', d: '同一个势力里的人都知道，其他人不知道。' },
        rel:  { n: '让角色自己按关系和人设决定', d: '不调 API：关系网上有没有连线、好感度到哪一步，算出"这人会不会听说"。跟你亲近的先知道，不熟的根本不该知道。' },
        none: { n: '谁都别知道', d: '只画在你自己的日历上，一个字都不进 prompt。' }
    };

    let S = {
        items: [],       // [{id, date:'YYYY-MM-DD', time, text, place, who:'all|some|fac|rel|none', chars:[], fac:'', at}]
        inject: 4,       // 最多注入几条
        past: 2,         // 往前看几天（昨天前天也算"最近在忙的"）
        ahead: 7,        // 往后看几天
        relLine: 30      // rel 模式的分数线
    };

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s))
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const uid = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : true;
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🗓️ 我的日程', m, null, null, false); } catch (e) {} };

    const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const today = () => key(new Date());
    function dayOff(k) {                 // 这一天离今天几天（负=过去）
        const a = new Date(k + 'T00:00:00'), b = new Date(today() + 'T00:00:00');
        return Math.round((a - b) / 86400000);
    }
    const whenTxt = n => n === 0 ? '今天' : n === 1 ? '明天' : n === 2 ? '后天'
        : n === -1 ? '昨天' : n === -2 ? '前天' : n > 0 ? `还有 ${n} 天` : `${-n} 天前`;

    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) {} }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!Array.isArray(S.items)) S.items = [];
    }
    window.gyMyDayAll = () => S.items.slice();

    /* ---------- 这一条，某个角色知不知道 ---------- */
    function knows(it, charId) {
        if (!it || !charId) return false;
        const id = String(charId);
        switch (it.who) {
            case 'none': return false;
            case 'all':  return true;
            case 'some': return (it.chars || []).map(String).indexOf(id) >= 0;
            case 'fac': {
                const c = charOf(id); if (!c || !it.fac) return false;
                try { if (typeof charInFaction === 'function') return !!charInFaction(c, it.fac); } catch (e) {}
                return String(c.group || '') === String(it.fac);
            }
            case 'rel':  return relScore(id) >= (Number(S.relLine) || 30);
            default:     return false;
        }
    }
    /* 「让角色自己决定」那一档背后的分。不调 API，全是现成的数据：
       关系网上跟你连了线 + 好感度 + 聊得多不多。 */
    function relScore(charId) {
        let sc = 0;
        try {
            if (window.gyRel && typeof window.gyRel.score === 'function') sc += Number(window.gyRel.score(charId)) || 0;
        } catch (e) {}
        try {
            const has = (typeof charRelationships !== 'undefined' ? charRelationships : [])
                .some(r => r && ((String(r.fromId) === String(charId) && String(r.toId) === 'me')
                              || (String(r.toId) === String(charId) && String(r.fromId) === 'me')));
            if (has) sc += 25;
        } catch (e) {}
        try {
            const n = ((typeof globalChats !== 'undefined' && globalChats[String(charId)]) || []).length;
            sc += Math.min(20, Math.floor(n / 20));
        } catch (e) {}
        return sc;
    }
    window.gyMyDayKnows = (itemId, charId) => {
        const it = S.items.find(x => x.id === itemId);
        return it ? knows(it, charId) : false;
    };
    // 这一条现在有几个人知道（页面上直接标出来，不用猜）
    function knowCount(it) {
        return chars().filter(c => knows(it, c.id)).length;
    }

    /* ---------- 注入 ---------- */
    window.__gyMyDayCtxFor = function (charId) {
        try {
            if (!on('myDayOn')) return '';
            const past = -Math.abs(Number(S.past) || 0), ahead = Math.abs(Number(S.ahead) || 7);
            const mine = S.items
                .filter(it => knows(it, charId))
                .map(it => ({ it, n: dayOff(it.date) }))
                .filter(x => x.n >= past && x.n <= ahead)
                .sort((a, b) => Math.abs(a.n) - Math.abs(b.n))
                .slice(0, Math.max(0, Math.round(gyNum(S.inject, 4))));
            if (!mine.length) return '';
            const uname = (typeof userDisplayName === 'function') ? userDisplayName(charOf(charId)) : '对方';
            return `\n【${uname}这几天的安排（你是知道的）】\n`
                + mine.map(x => `· ${whenTxt(x.n)}${x.it.time ? ' ' + x.it.time : ''}　${x.it.text}${x.it.place ? '（在' + x.it.place + '）' : ''}`).join('\n')
                + `\n这些是你**本来就知道**的事，不是刚被告知的——别写成"我刚听说"。`
                + `聊到相关的时候可以自然提起（关心一句、吐槽一句、约在那之后），没聊到就别硬往外倒。\n`;
        } catch (e) { return ''; }
    };

    /* ---------- 增删改 ---------- */
    window.gyMyDayAdd = async function () {
        const g = id => document.getElementById(id);
        const date = (g('gymdDate') || {}).value || '';
        const text = ((g('gymdText') || {}).value || '').trim();
        if (!date || !text) { toast('日期和内容都要填'); return; }
        const who = (g('gymdWho') || {}).value || 'all';
        const it = {
            id: uid(), date, text: text,   // 不限字数
            time: ((g('gymdTime') || {}).value || '').trim(),
            place: ((g('gymdPlace') || {}).value || '').trim(),
            who, chars: [], fac: '', at: Date.now()
        };
        if (who === 'some') it.chars = Array.from(document.querySelectorAll('.gymd-ck:checked')).map(x => x.value);
        if (who === 'fac') it.fac = (g('gymdFac') || {}).value || '';
        S.items.push(it);
        await save();
        ['gymdText', 'gymdTime', 'gymdPlace'].forEach(k => { const e = g(k); if (e) e.value = ''; });
        render();
        toast('记下了：' + it.text);
    };
    window.gyMyDayDel = async function (id) {
        S.items = S.items.filter(x => x.id !== id);
        await save(); render();
    };
    window.gyMyDayWho = async function (id, v) {
        const it = S.items.find(x => x.id === id); if (!it) return;
        it.who = v;
        if (v !== 'some') it.chars = [];
        if (v !== 'fac') it.fac = '';
        await save(); render();
    };
    window.gyMyDayPickChar = async function (id, cid, yes) {
        const it = S.items.find(x => x.id === id); if (!it) return;
        it.chars = (it.chars || []).filter(x => String(x) !== String(cid));
        if (yes) it.chars.push(String(cid));
        await save(); render();
    };
    window.gyMyDayFac = async function (id, v) {
        const it = S.items.find(x => x.id === id); if (!it) return;
        it.fac = v; await save(); render();
    };
    window.gyMyDaySet = async function (k, v) { S[k] = parseInt(v) || 0; await save(); };
    window.gyMyDayWhoNew = function () { render(); };   // 新建那一行换了"谁能看到"，重画表单

    /* ---------- 我的日程页 ---------- */
    function itemRow(it) {
        const n = dayOff(it.date);
        const w = WHO[it.who] || WHO.all;
        const cnt = knowCount(it);
        return `<div class="gymd-row${n === 0 ? ' today' : ''}">
          <div class="gymd-when"><b>${esc(whenTxt(n))}</b><span>${esc(it.date)}${it.time ? ' ' + esc(it.time) : ''}</span></div>
          <div class="gymd-main">
            <div class="gymd-t">${esc(it.text)}${it.place ? `<em>在${esc(it.place)}</em>` : ''}</div>
            <div class="gymd-who">
              <select onchange="gyMyDayWho('${it.id}', this.value)">
                ${Object.keys(WHO).map(k => `<option value="${k}"${it.who === k ? ' selected' : ''}>${WHO[k].n}</option>`).join('')}
              </select>
              <span class="gymd-cnt">${it.who === 'none' ? '谁都不知道' : cnt ? `${cnt} 个人知道` : '现在没人知道'}</span>
            </div>
            ${it.who === 'some' ? `<div class="gymd-picks">${chars().map(c => `
              <label><input type="checkbox" ${(it.chars || []).map(String).indexOf(String(c.id)) >= 0 ? 'checked' : ''}
                onchange="gyMyDayPickChar('${it.id}','${c.id}', this.checked)">${esc(c.name)}</label>`).join('')}</div>` : ''}
            ${it.who === 'fac' ? `<div class="gymd-picks"><select onchange="gyMyDayFac('${it.id}', this.value)">
                <option value="">选一个势力</option>
                ${((typeof characterGroups !== 'undefined' ? characterGroups : []) || []).map(g => `<option value="${esc(g)}"${it.fac === g ? ' selected' : ''}>${esc(g)}</option>`).join('')}
              </select></div>` : ''}
            ${it.who === 'rel' ? `<div class="gymd-hint">按关系算的：${chars().filter(c => knows(it, c.id)).map(c => esc(c.name)).join('、') || '暂时没人够得着这条线'}</div>` : ''}
          </div>
          <span class="gymd-del" onclick="gyMyDayDel('${it.id}')">删</span>
        </div>`;
    }
    function render() {
        const box = document.getElementById('gymdBody');
        if (!box) return;
        const list = S.items.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const newWho = (document.getElementById('gymdWho') || {}).value || 'all';
        box.innerHTML = `
          <div class="form-hint">
            角色一直有日程，你没有——所以"你今天在忙什么"永远得你自己打字说。
            在这儿记一条，<b>你指定的人就真的知道</b>，聊天时会自然提起。<br>
            <span style="color:#8b98a5;">每条单独决定谁能知道。选「谁都别知道」的只画在你自己的日历上，一个字都不进 prompt。</span>
          </div>
          <div class="gymd-new">
            <div class="gymd-new-row">
              <input type="date" id="gymdDate" value="${today()}">
              <input type="text" id="gymdTime" placeholder="几点（可不填）">
              <input type="text" id="gymdPlace" placeholder="在哪（可不填）">
            </div>
            <input type="text" id="gymdText" placeholder="要做什么，例：下午去医院复查">
            <div class="gymd-new-row">
              <select id="gymdWho" onchange="gyMyDayWhoNew()">
                ${Object.keys(WHO).map(k => `<option value="${k}"${newWho === k ? ' selected' : ''}>${WHO[k].n}</option>`).join('')}
              </select>
              <button type="button" class="btn-primary" style="margin:0;padding:7px 16px;" onclick="gyMyDayAdd()">＋ 记下来</button>
            </div>
            <div class="gymd-hint">${esc((WHO[newWho] || WHO.all).d)}</div>
            ${newWho === 'some' ? `<div class="gymd-picks">${chars().map(c => `
              <label><input type="checkbox" class="gymd-ck" value="${c.id}">${esc(c.name)}</label>`).join('') || '还没有角色'}</div>` : ''}
            ${newWho === 'fac' ? `<div class="gymd-picks"><select id="gymdFac">
                ${((typeof characterGroups !== 'undefined' ? characterGroups : []) || []).map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('') || '<option value="">还没有势力</option>'}
              </select></div>` : ''}
          </div>
          <div class="gymd-list">${list.length ? list.map(itemRow).join('')
            : '<div class="gymd-hint" style="padding:18px 0;text-align:center;">还没记过。上面写一条试试。</div>'}</div>
          <div class="gymd-nums">
            <label>最多注入 <input type="number" min="1" value="${Number(S.inject) || 4}" onchange="gyMyDaySet('inject', this.value)"> 条</label>
            <label>往前看 <input type="number" min="0" value="${Number(S.past) || 0}" onchange="gyMyDaySet('past', this.value)"> 天</label>
            <label>往后看 <input type="number" min="1" value="${Number(S.ahead) || 7}" onchange="gyMyDaySet('ahead', this.value)"> 天</label>
            <label>「自己决定」的分数线 <input type="number" value="${Number(S.relLine) || 30}" onchange="gyMyDaySet('relLine', this.value)"></label>
          </div>`;
    }
    window.gyMyDayRender = render;

    /* ---------- 我的日历 ---------- */
    let calY = new Date().getFullYear(), calM = new Date().getMonth(), calSel = null;
    window.gyMyCalMove = function (d) {
        calM += d;
        if (calM < 0) { calM = 11; calY--; }
        if (calM > 11) { calM = 0; calY++; }
        calSel = null; renderCal();
    };
    window.gyMyCalPick = function (k) { calSel = (calSel === k) ? null : k; renderCal(); };
    // 这一天有什么：我的日程 + 我记的纪念日（按年复现）+ 角色生日
    function dayData(k) {
        const out = { mine: [], anniv: [], birth: [] };
        const md = k.slice(5);
        S.items.forEach(it => { if (it.date === k) out.mine.push(it); });
        try {
            ((currentUser && currentUser.customAnniversaries) || []).forEach(a => {
                if (String(a.date || '').slice(5) === md) out.anniv.push(a.label || '纪念日');
            });
        } catch (e) {}
        try {
            chars().forEach(c => {
                if (c.birthdate && String(c.birthdate).slice(5, 10) === md) out.birth.push(c.name);
                (c.anniversaries || []).forEach(a => {
                    if (String(a.date || '').slice(5) === md) out.anniv.push(`${c.name}：${a.label || '纪念日'}`);
                });
            });
        } catch (e) {}
        return out;
    }
    // 只读：某一天有什么（小手机的「日历」App 用）
    window.gyMyCalDay = k => dayData(k);
    function renderCal() {
        const box = document.getElementById('gymcBody');
        if (!box) return;
        const first = new Date(calY, calM, 1);
        const pad = first.getDay();
        const days = new Date(calY, calM + 1, 0).getDate();
        const tk = today();
        let cells = '';
        for (let i = 0; i < pad; i++) cells += '<div class="gymc-cell empty"></div>';
        for (let d = 1; d <= days; d++) {
            const k = calY + '-' + String(calM + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            const dd = dayData(k);
            const dots = [dd.mine.length ? '<i class="mine"></i>' : '', dd.anniv.length ? '<i class="ann"></i>' : '',
                          dd.birth.length ? '<i class="bir"></i>' : ''].join('');
            cells += `<div class="gymc-cell${k === tk ? ' today' : ''}${calSel === k ? ' on' : ''}" onclick="gyMyCalPick('${k}')">
                <b>${d}</b><div class="gymc-dots">${dots}</div></div>`;
        }
        const sel = calSel ? dayData(calSel) : null;
        box.innerHTML = `
          <div class="gymc-hd">
            <span onclick="gyMyCalMove(-1)">‹</span>
            <b>${calY} 年 ${calM + 1} 月</b>
            <span onclick="gyMyCalMove(1)">›</span>
          </div>
          <div class="gymc-week">${['日','一','二','三','四','五','六'].map(x => `<span>${x}</span>`).join('')}</div>
          <div class="gymc-grid">${cells}</div>
          <div class="gymc-legend"><i class="mine"></i>我的日程　<i class="ann"></i>纪念日　<i class="bir"></i>生日</div>
          ${sel ? `<div class="gymc-day">
            <div class="gymc-day-hd">${esc(calSel)}${calSel === tk ? '（今天）' : ''}</div>
            ${sel.mine.map(it => `<div class="gymc-li">🗓️ ${it.time ? esc(it.time) + '　' : ''}${esc(it.text)}
                <em>${esc((WHO[it.who] || WHO.all).n)}</em></div>`).join('')}
            ${sel.anniv.map(a => `<div class="gymc-li">💗 ${esc(a)}</div>`).join('')}
            ${sel.birth.map(b => `<div class="gymc-li">🎂 ${esc(b)} 的生日</div>`).join('')}
            ${(!sel.mine.length && !sel.anniv.length && !sel.birth.length)
              ? '<div class="gymd-hint">这一天什么都没有。</div>' : ''}
            <div style="margin-top:8px;"><button type="button" class="btn-edit-small"
              onclick="openUserPanel('myday'); setTimeout(()=>{const e=document.getElementById('gymdDate'); if(e) e.value='${calSel}';},120);">
              ＋ 在这一天记一条</button></div>
          </div>` : '<div class="gymd-hint" style="padding:10px 2px;">点一天看那天有什么。</div>'}`;
    }
    window.gyMyCalRender = renderCal;

    /* ---------- 挂进"我的资料" ---------- */
    const PANEL = `
      <div class="up-back" id="upBack-myday"></div>
      <div id="gymdBody"></div>`;
    const PANEL_CAL = `<div id="gymcBody"></div>`;

    const CSS = `
    .gymd-new{border:1px dashed var(--gy-line,#cfd9de);border-radius:12px;padding:12px;margin:10px 0 14px;}
    .gymd-new-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
    .gymd-new-row>*{flex:1;min-width:110px;}
    .gymd-new input[type=text],.gymd-new input[type=date],.gymd-new select{
        width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--gy-line,#cfd9de);
        border-radius:9px;background:transparent;color:inherit;font-size:13px;font-family:inherit;margin-bottom:8px;}
    .gymd-hint{font-size:11.5px;color:#8b98a5;line-height:1.75;}
    .gymd-picks{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
    .gymd-picks label{display:flex;align-items:center;gap:4px;font-size:12.5px;cursor:pointer;}
    .gymd-picks select{padding:6px 9px;border:1px solid var(--gy-line,#cfd9de);border-radius:8px;background:transparent;color:inherit;}
    .gymd-list{display:flex;flex-direction:column;gap:8px;}
    .gymd-row{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--gy-line,#cfd9de);border-radius:12px;}
    .gymd-row.today{border-color:var(--gy-accent);background:rgba(var(--gy-accent-rgb),.06);}
    .gymd-when{width:74px;flex-shrink:0;}
    .gymd-when b{display:block;font-size:13px;}
    .gymd-when span{font-size:10.5px;color:#8b98a5;}
    .gymd-main{flex:1;min-width:0;}
    .gymd-t{font-size:13.5px;font-weight:600;line-height:1.6;}
    .gymd-t em{font-style:normal;font-size:11.5px;color:#8b98a5;margin-left:6px;}
    .gymd-who{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;}
    .gymd-who select{padding:4px 8px;border:1px solid var(--gy-line,#cfd9de);border-radius:8px;
        background:transparent;color:inherit;font-size:12px;font-family:inherit;}
    .gymd-cnt{font-size:11px;color:#8b98a5;}
    .gymd-del{color:var(--gy-bad,#f4212e);font-size:12px;cursor:pointer;flex-shrink:0;}
    .gymd-nums{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;padding-top:12px;
        border-top:1px dashed var(--gy-line,#cfd9de);font-size:12px;color:#8b98a5;}
    .gymd-nums input{width:56px;padding:4px 6px;border:1px solid var(--gy-line,#cfd9de);
        border-radius:6px;background:transparent;color:inherit;margin:0 3px;}
    /* 日历 */
    .gymc-hd{display:flex;align-items:center;justify-content:space-between;padding:6px 2px 10px;font-size:15px;}
    .gymc-hd span{cursor:pointer;padding:2px 12px;color:var(--gy-accent);font-size:19px;user-select:none;}
    .gymc-week{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;color:#8b98a5;padding-bottom:4px;}
    .gymc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
    .gymc-cell{aspect-ratio:1;border-radius:9px;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:3px;cursor:pointer;font-size:13px;border:1px solid transparent;}
    .gymc-cell.empty{cursor:default;}
    .gymc-cell:not(.empty):hover{background:rgba(128,128,128,.1);}
    .gymc-cell.today{border-color:var(--gy-accent);font-weight:700;color:var(--gy-accent);}
    .gymc-cell.on{background:rgba(var(--gy-accent-rgb),.16);}
    .gymc-dots{display:flex;gap:3px;height:5px;}
    .gymc-dots i,.gymc-legend i{width:5px;height:5px;border-radius:50%;display:inline-block;}
    .gymc-legend i{margin-right:3px;}
    .gymc-dots i.mine,.gymc-legend i.mine{background:var(--gy-accent);}
    .gymc-dots i.ann,.gymc-legend i.ann{background:var(--gy-bad,#f91880);}
    .gymc-dots i.bir,.gymc-legend i.bir{background:var(--gy-warn,#ffad1f);}
    .gymc-legend{font-size:11px;color:#8b98a5;padding:10px 2px 0;}
    .gymc-day{margin-top:10px;padding:10px 12px;border:1px solid var(--gy-line,#cfd9de);border-radius:12px;}
    .gymc-day-hd{font-size:13px;font-weight:700;margin-bottom:6px;}
    .gymc-li{font-size:12.5px;line-height:1.9;display:flex;gap:8px;align-items:baseline;}
    .gymc-li em{font-style:normal;font-size:10.5px;color:#8b98a5;margin-left:auto;white-space:nowrap;}
    `;

    function mount() {
        if (document.getElementById('upPanel-myday')) return true;
        const host = document.getElementById('upPanel-anniv');
        if (!host || !host.parentNode) return false;
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

        const p1 = document.createElement('div');
        p1.className = 'up-panel'; p1.id = 'upPanel-myday'; p1.style.display = 'none';
        p1.innerHTML = PANEL;
        host.parentNode.insertBefore(p1, host.nextSibling);

        const p2 = document.createElement('div');
        p2.className = 'up-panel'; p2.id = 'upPanel-mycal'; p2.style.display = 'none';
        p2.innerHTML = PANEL_CAL;
        host.parentNode.insertBefore(p2, p1.nextSibling);

        try {
            if (typeof GY_USER_PANELS !== 'undefined') {
                GY_USER_PANELS.myday = '🗓️ 我的日程';
                GY_USER_PANELS.mycal = '📅 我的日历';
            }
        } catch (e) {}

        // 索引页上插两颗，就放在「我的纪念日」后面
        try {
            const idx = document.getElementById('upIndex');
            if (idx && !document.getElementById('upEntryMyday')) {
                let after = null;
                idx.querySelectorAll('.up-entry, button, [onclick]').forEach(b => {
                    if ((b.getAttribute('onclick') || '').indexOf("'anniv'") >= 0) after = b;
                });
                const mk = (id, key2, ico, t, d) => {
                    const b = document.createElement(after ? after.tagName : 'button');
                    b.type = 'button'; b.className = after ? after.className : 'set-entry';
                    b.id = id; b.setAttribute('onclick', `openUserPanel('${key2}')`);
                    b.innerHTML = `<span class="set-entry-ico">${ico}</span>
                        <span class="set-entry-main"><span class="set-entry-title">${t}</span>
                        <span class="set-entry-desc">${d}</span></span><span class="set-entry-arrow">›</span>`;
                    return b;
                };
                const b1 = mk('upEntryMyday', 'myday', '🗓️', '我的日程', '我这几天在忙什么，每条单独决定谁能知道');
                const b2 = mk('upEntryMycal', 'mycal', '📅', '我的日历', '纪念日、角色生日、我的日程画在同一个月里');
                if (after) { after.parentNode.insertBefore(b1, after.nextSibling); b1.parentNode.insertBefore(b2, b1.nextSibling); }
                else { idx.appendChild(b1); idx.appendChild(b2); }
            }
        } catch (e) {}

        // 进这两页才画
        try {
            const prev = window.openUserPanel;
            if (window.openUserPanel instanceof Function && !prev.__gymdPatched) {
                const w = function (k) {
                    const r = prev.apply(this, arguments);
                    try { if (k === 'myday') render(); if (k === 'mycal') renderCal(); } catch (e) {}
                    return r;
                };
                w.__gymdPatched = true;
                window.openUserPanel = w;
            }
        } catch (e) {}
        return true;
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            const defs = [
                { key: 'myDayOn', label: '角色知道你这几天的安排',
                  desc: '你在「我的资料 → 🗓️ 我的日程」里记的那些事，会进 prompt——但**只进你指定的人**的 prompt。每条可以选：所有人知道 / 只有指定的几个 / 某个势力 / 让角色按关系和人设自己决定 / 谁都别知道。关掉这一项就一条都不注入，日历照常能看。',
                  cost: '一次 API 都不调（只是把你写的东西接进本来就要发的 prompt）', group: '记忆',
                  where: '我的资料 → 🗓️ 我的日程' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) {}
    }
    // 注册进注入链（js/06 的 GY_BOX_CTX）
    function hookCtx() {
        try {
            if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX)
                && !GY_BOX_CTX.some(x => x[0] === '__gyMyDayCtxFor'))
                GY_BOX_CTX.push(['__gyMyDayCtxFor', '我的日程']);
        } catch (e) {}
    }

    (async function init() {
        addSwitches();
        hookCtx();
        await load();
        if (!mount()) setTimeout(mount, 1200);
        setTimeout(() => { hookCtx(); mount(); }, 2500);
    })();
})();
