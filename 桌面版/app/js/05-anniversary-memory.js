// ===== 用户纪念日管理函数 =====
function renderUserAnniversaryList() {
    const container = document.getElementById('userAnniversaryList');
    if(!container) return;
    if(!currentUser.customAnniversaries || currentUser.customAnniversaries.length === 0) {
        container.innerHTML = '<span style="color:#8b98a5; font-size:12px;">还没有添加纪念日</span>';
        return;
    }
    container.innerHTML = currentUser.customAnniversaries.map((ann, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px; background:white; border:1px solid #eff3f4; border-radius:4px;">
            <span style="font-size:12px;">📅 ${ann.date} - ${ann.label}</span>
            <span onclick="deleteUserAnniversary(${idx})" style="cursor:pointer; color:#f91880; margin-left:8px; font-weight:bold;">×</span>
        </div>
    `).join('');
}

function addUserAnniversary() {
    const dateElem = document.getElementById('newUserAnniversaryDate');
    const labelElem = document.getElementById('newUserAnniversaryLabel');
    const date = dateElem ? dateElem.value.trim() : '';
    const label = labelElem ? labelElem.value.trim() : '';

    if(!date || !label) {
        alert('请输入日期和纪念日描述');
        return;
    }

    if(!currentUser.customAnniversaries) currentUser.customAnniversaries = [];
    if(currentUser.customAnniversaries.some(a => a.date === date && a.label === label)) {
        alert('这个纪念日已经存在了');
        return;
    }

    currentUser.customAnniversaries.push({ date, label });
    if(dateElem) dateElem.value = '';
    if(labelElem) labelElem.value = '';
    saveAllData();
    renderUserAnniversaryList();
}

function deleteUserAnniversary(idx) {
    if(!currentUser.customAnniversaries) return;
    currentUser.customAnniversaries.splice(idx, 1);
    saveAllData();
    renderUserAnniversaryList();
}


// ===================== 角色专属：纪念日 + 回忆相册（日历图标）=====================
let currentCalendarCharId = null; // 当前打开的纪念日弹窗对应的角色，供添加/删除纪念日直接使用，避免猜测
function openCharCalendarModal(charId) {
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    currentCalendarCharId = char.id;
    document.getElementById('charCalendarTitle').innerText = `📅 ${char.name} 的日历`;
    document.getElementById('charAnniversaryNoteText').style.display = 'none';
    document.getElementById('charAnniversaryNoteText').innerText = '';

    // 渲染真正的纪念日列表（含手动添加的纪念日 + AI记忆推断的纪念日），而不是只显示一句"认识天数"
    renderCharCalendarModalContent(char.id);
    // 月历 + 待办：默认停在今天
    gyCalYear = new Date().getFullYear();
    gyCalMonth = new Date().getMonth();
    gyCalSelected = gyDateKey(new Date());
    gyCalRange = 'month';
    setCalendarRange('month');   // 顺带把上面那排按钮的高亮也复位
    closeCalendarAddBox();
    renderCharTodoList();

    openModal('charCalendarModal');
}

// ===================== 📅 月历 =====================
// 数据全是现成的，以前只是没地方看：
//   · 日程   —— char.schedule（今天）+ char.scheduleHistory（自动归档的前几天）
//   · 纪念日 —— char.anniversaries（原来的纪念日功能，直接融合进来，按"每年同月同日"复现）
//   · 待办   —— char.todos（这一版新加的）
let gyCalYear = new Date().getFullYear();
let gyCalMonth = new Date().getMonth();
let gyCalSelected = null;

function gyDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function gyCalChar() {
    return myCharacters.find(c => c.id == currentCalendarCharId) || null;
}
// 这一天有哪些东西。key 是 'yyyy-mm-dd'。
function gyCalDayData(char, key) {
    const out = { schedules: [], anniversaries: [], todos: [] };
    if (!char) return out;
    // 日程：归档的 + 今天这份
    (char.scheduleHistory || []).forEach(h => {
        if (h && h.at && gyDateKey(new Date(h.at)) === key) out.schedules.push({ at: h.at, text: h.text });
    });
    if (char.schedule && char.schedule.text && char.schedule.generatedAt
        && gyDateKey(new Date(char.schedule.generatedAt)) === key
        && !out.schedules.some(s => s.at === char.schedule.generatedAt)) {
        out.schedules.push({ at: char.schedule.generatedAt, text: char.schedule.text, isToday: true });
    }
    // 纪念日：按"每年同一个月日"算，这样周年当天也会亮起来
    const md = key.slice(5);
    (char.anniversaries || []).forEach(a => {
        if (!a || !a.date) return;
        if (a.date === key) out.anniversaries.push({ ...a, years: 0 });
        else if (String(a.date).slice(5) === md && String(a.date) < key) {
            const years = parseInt(key.slice(0, 4)) - parseInt(String(a.date).slice(0, 4));
            if (years > 0) out.anniversaries.push({ ...a, years });
        }
    });
    // 🎂 生日和你自己记的纪念日以前**只存着、不显示**：日历上一片空白，
    //    角色也不知道。现在统一并进来，跟角色自己的纪念日一样按"每年同月同日"亮。
    const yearly = (dateStr, label, tag) => {
        if (!dateStr) return;
        const ds = String(dateStr);
        if (ds.slice(5) !== md) return;
        const y0 = parseInt(ds.slice(0, 4));
        const years = (isNaN(y0) || y0 <= 0) ? 0 : parseInt(key.slice(0, 4)) - y0;
        out.anniversaries.push({ date: ds, event: label, years: years > 0 ? years : 0, auto: tag });
    };
    yearly(char.birthdate, char.name + '生日', 'char-birthday');
    if (typeof currentUser !== 'undefined' && currentUser) {
        yearly(currentUser.birthdate, (currentUser.name || '我') + '生日', 'user-birthday');
        (currentUser.customAnniversaries || []).forEach(a2 => {
            if (a2 && a2.date) yearly(a2.date, a2.label || '纪念日', 'user-anniv');
        });
    }
    (char.todos || []).forEach(t => { if (t && t.date === key) out.todos.push(t); });
    // 🟢 这天的每一次状态（聊天状态栏 + "此刻在做什么"）
    out.statuses = [];
    (char.statusLog || []).forEach((st, i) => { if (st && st.at && gyDateKey(new Date(st.at)) === key) out.statuses.push(Object.assign({ __i: i }, st)); });
    return out;
}

// 🗓️ 「认识第几天」全 app 只能有一个算法
// —— 以前有两套：日历页从"用户手记的相识日 / createTime"算，
//    checkAndAnnounceAnniversary 却从"聊天记录第一条的时间戳"算。
//    结果同一天日历显示第 100 天、角色嘴里说第 30 天（实测过）。
//    而且从聊天记录算的那套，用户一清聊天记录天数就归零。
//    现在统一走这里。优先级：用户手记的相识日 > createTime > 首条聊天 > id 里的时间戳。
function annBaseInfo(char) {
    if (!char) return null;
    let baseTs = null, label = '我们相识', from = '';
    const meet = (char.anniversaries || []).find(a => a && a.event &&
        /相识|认识|相遇|见面|初见|在一起|确定关系/.test(a.event));
    if (meet && meet.date) { baseTs = new Date(meet.date + 'T00:00:00').getTime(); label = meet.event; from = '手记'; }
    if (!baseTs && char.createTime) { baseTs = char.createTime; from = 'createTime'; }
    if (!baseTs) {
        const h = (typeof globalChats !== 'undefined' && globalChats[char.id]) || null;
        if (h && h.length && h[0].timestamp) { baseTs = h[0].timestamp; from = '首条聊天'; }
    }
    if (!baseTs && !isNaN(char.id) && String(char.id).length >= 13) { baseTs = parseInt(char.id); from = 'id'; }
    if (!baseTs) { baseTs = Date.now(); from = '兜底'; }

    const b = new Date(baseTs); b.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    let days = Math.floor((t.getTime() - b.getTime()) / 86400000) + 1;   // 认识当天算第 1 天
    if (days < 1) days = 1;
    return { baseTs: b.getTime(), label, days, from, dateStr: gyDateKey(b) };
}

// 🗓️ 今天该惦记的日子 —— 用户在日历里手记的纪念日，以前角色一个字都看不到。
//    只放"今天"这一天的，不会把整张表倒进 prompt。
function getAnniversaryAwarenessPrompt(char) {
    try {
        // 📅「日子」内置之后（js/25）它也读 char.anniversaries，而且做得更全——
        //    带周年数、还会提前几天开始惦记、外加节气时令。两边都注入的话
        //    prompt 里会出现两段几乎一样的【今天是什么日子】。让位给它。
        if (typeof window.__gyDaysCtxFor === 'function') return '';
        if (typeof aliveSettings !== 'undefined' && aliveSettings.knowAnniv === false) return '';
        if (typeof enableAnniversary !== 'undefined' && !enableAnniversary) return '';
        if (!char) return '';
        const key = gyDateKey(new Date());
        const d = gyCalDayData(char, key);
        const lines = [];
        (d.anniversaries || []).forEach(a => {
            lines.push('· ' + a.event + (a.years ? `（${a.years} 周年）` : '（就是今天）'));
        });
        const info = annBaseInfo(char);
        let head = '';
        if (info && info.from === '手记') head = `今天是${info.label}的第 ${info.days} 天。\n`;
        if (!lines.length && !head) return '';
        return `\n\n【🗓️ 今天是个什么日子】\n${head}${lines.join('\n')}\n`
            + `这些是对方记在日历上的。你心里清楚就行——要不要提、怎么提，看你的人设和你俩现在的关系；`
            + `不是那种会把日子挂嘴边的人，就别提。千万别变成播报。\n`;
    } catch (e) { return ''; }
}

let gyCalRange = 'month';   // 'day' | 'week' | 'month' | 'year'

function setCalendarRange(r) {
    gyCalRange = r;
    document.querySelectorAll('#charCalendarRange button').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-range') === r);
    });
    // 切到日/周视图时，把"当前月"对齐到选中的那天，否则翻页会莫名其妙跳月
    if ((r === 'day' || r === 'week') && gyCalSelected) {
        const d = new Date(gyCalSelected + 'T00:00:00');
        if (!isNaN(d)) { gyCalYear = d.getFullYear(); gyCalMonth = d.getMonth(); }
    }
    renderCharCalendarGrid();
}

// 上一格/下一格：翻的东西跟当前视图有关（日视图翻一天，周视图翻一周，月/年各自翻月和年）
function charCalendarShiftMonth(delta) {
    if (delta === 0) {
        const n = new Date();
        gyCalYear = n.getFullYear(); gyCalMonth = n.getMonth(); gyCalSelected = gyDateKey(n);
        renderCharCalendarGrid();
        return;
    }
    if (gyCalRange === 'day' || gyCalRange === 'week') {
        const step = gyCalRange === 'day' ? 1 : 7;
        const base = gyCalSelected ? new Date(gyCalSelected + 'T00:00:00') : new Date();
        base.setDate(base.getDate() + delta * step);
        gyCalSelected = gyDateKey(base);
        gyCalYear = base.getFullYear(); gyCalMonth = base.getMonth();
    } else if (gyCalRange === 'year') {
        gyCalYear += delta;
    } else {
        gyCalMonth += delta;
        if (gyCalMonth < 0) { gyCalMonth = 11; gyCalYear--; }
        if (gyCalMonth > 11) { gyCalMonth = 0; gyCalYear++; }
    }
    renderCharCalendarGrid();
}
function charCalendarPickDay(key) {
    gyCalSelected = key;
    renderCharCalendarGrid();
}

// 把某一天的东西压成"一行一条"的事件列表，格子里直接显示（这才是系统日历的样子，
// 原来只画三个小圆点，等于把信息全藏起来了，还得点进去才知道是什么）
function gyCalDayEvents(char, key) {
    const d = gyCalDayData(char, key);
    const evs = [];
    d.anniversaries.forEach(a => evs.push({ cls: 'gy-dot-ann', text: a.event + (a.years ? ` · ${a.years}周年` : '') }));
    d.schedules.forEach(sc => {
        // 日程是一整天的多行文本，格子里放不下，取前几行的"时间 + 事"当摘要
        String(sc.text).split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 4)
            .forEach(line => evs.push({ cls: 'gy-dot-sch', text: line }));
    });
    d.todos.forEach(t => evs.push({ cls: 'gy-dot-todo', text: t.text, done: !!t.done }));
    return evs;
}

function renderCharCalendarGrid() {
    const grid = document.getElementById('charCalendarGrid');
    const label = document.getElementById('charCalendarMonthLabel');
    const weekBar = document.getElementById('charCalendarWeekBar');
    if (!grid || !label) return;
    const char = gyCalChar();
    const todayKey = gyDateKey(new Date());
    const esc = s2 => (typeof escapeHtml === 'function') ? escapeHtml(s2 || '') : String(s2 || '');
    grid.className = 'gy-cal-grid';
    if (weekBar) weekBar.style.display = '';

    // ---------- 年视图：12 个小月份，点一个跳进那个月 ----------
    if (gyCalRange === 'year') {
        label.innerText = `${gyCalYear} 年`;
        if (weekBar) weekBar.style.display = 'none';
        grid.classList.add('year-mode');
        let html = '';
        for (let m = 0; m < 12; m++) {
            const days = new Date(gyCalYear, m + 1, 0).getDate();
            let n = 0, kinds = { sch: 0, ann: 0, todo: 0 };
            for (let d = 1; d <= days; d++) {
                const k = `${gyCalYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dd = gyCalDayData(char, k);
                if (dd.schedules.length) { kinds.sch++; n++; }
                if (dd.anniversaries.length) { kinds.ann++; n++; }
                if (dd.todos.length) { kinds.todo++; n++; }
            }
            const dots = (kinds.sch ? '<i class="gy-dot gy-dot-sch"></i>' : '')
                       + (kinds.ann ? '<i class="gy-dot gy-dot-ann"></i>' : '')
                       + (kinds.todo ? '<i class="gy-dot gy-dot-todo"></i>' : '');
            html += `<div class="gy-cal-mini" onclick="gyCalJumpMonth(${m})">
                <div class="gy-cal-mini-name">${m + 1} 月</div>
                <div class="gy-cal-mini-count">${n ? n + ' 项' : '—'}</div>
                <div class="gy-cal-mini-dots">${dots}</div></div>`;
        }
        grid.innerHTML = html;
        renderCharCalendarDayDetail();
        return;
    }

    // ---------- 日 / 周视图：一天一段，全文列出来，不省略 ----------
    if (gyCalRange === 'day' || gyCalRange === 'week') {
        if (weekBar) weekBar.style.display = 'none';
        grid.classList.add('list-mode');
        const base = gyCalSelected ? new Date(gyCalSelected + 'T00:00:00') : new Date();
        let days = [];
        if (gyCalRange === 'day') days = [new Date(base)];
        else {
            const start = new Date(base); start.setDate(start.getDate() - start.getDay());   // 从周日起
            for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); }
        }
        label.innerText = gyCalRange === 'day'
            ? `${gyDateKey(days[0])}`
            : `${gyDateKey(days[0])} ～ ${gyDateKey(days[6])}`;
        const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        grid.innerHTML = days.map(d => {
            const k = gyDateKey(d);
            const evs = gyCalDayEvents(char, k);
            return `<div class="gy-cal-daybox${k === gyCalSelected ? ' selected' : ''}" onclick="charCalendarPickDay('${k}')">
                <div class="gy-cal-daybox-title">${k} ${wk[d.getDay()]}${k === todayKey ? '<span class="gy-cal-today-tag">今天</span>' : ''}</div>
                ${evs.length
                    ? evs.map(e => `<div class="gy-cal-ev${e.done ? ' done' : ''}"><i class="gy-dot ${e.cls}"></i>${esc(e.text)}</div>`).join('')
                    : '<div class="gy-cal-daybox-empty">这天没有记录</div>'}
            </div>`;
        }).join('');
        renderCharCalendarDayDetail();
        return;
    }

    // ---------- 月视图：格子里直接列出当天的事 ----------
    label.innerText = `${gyCalYear} 年 ${gyCalMonth + 1} 月`;
    const first = new Date(gyCalYear, gyCalMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(gyCalYear, gyCalMonth + 1, 0).getDate();
    const maxLines = (window.innerWidth <= 900) ? 1 : 3;   // 手机格子矮，只显示一条

    let cells = '';
    for (let i = 0; i < startPad; i++) cells += `<div class="gy-cal-cell other-month"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${gyCalYear}-${String(gyCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const evs = gyCalDayEvents(char, key);
        const shown = evs.slice(0, maxLines).map(e =>
            `<div class="gy-cal-ev${e.done ? ' done' : ''}" title="${esc(e.text)}"><i class="gy-dot ${e.cls}"></i>${esc(e.text)}</div>`).join('');
        const more = evs.length > maxLines ? `<div class="gy-cal-more">还有 ${evs.length - maxLines} 项</div>` : '';
        const cls = ['gy-cal-cell'];
        if (key === todayKey) cls.push('today');
        if (key === gyCalSelected) cls.push('selected');
        cells += `<div class="${cls.join(' ')}" onclick="charCalendarPickDay('${key}')">
            <span class="gy-cal-daynum">${d}</span>${shown}${more}</div>`;
    }
    // 补满最后一行，不然最后几格没有边框看着缺一块
    const total = startPad + daysInMonth;
    for (let i = total; i % 7 !== 0; i++) cells += `<div class="gy-cal-cell other-month"></div>`;
    grid.innerHTML = cells;
    renderCharCalendarDayDetail();
}
function gyCalJumpMonth(m) {
    gyCalMonth = m;
    setCalendarRange('month');
}

// 选中那天的详情：日程全文 + 纪念日 + 待办。格子里只放得下摘要，完整内容看这里。
function renderCharCalendarDayDetail() {
    const box = document.getElementById('charCalendarDayDetail');
    if (!box) return;
    const char = gyCalChar();
    if (!char || !gyCalSelected) { box.innerHTML = ''; return; }
    const data = gyCalDayData(char, gyCalSelected);
    const esc = s2 => (typeof escapeHtml === 'function') ? escapeHtml(s2 || '') : String(s2 || '');
    let html = `<div style="font-size:14px; font-weight:bold; color:#0f1419; margin-bottom:6px;">${gyCalSelected}</div>`;

    if (data.anniversaries.length) {
        html += `<div class="gy-cal-sec ann"><h5>💗 纪念日</h5>` + data.anniversaries.map(a =>
            `<div>${esc(a.event)}${a.years ? `　<span style="color:#8b98a5;">· ${a.years} 周年</span>` : ''}</div>`).join('') + `</div>`;
    }
    if (data.schedules.length) {
        html += `<div class="gy-cal-sec"><h5>🗓️ 当天日程${data.schedules.some(x => x.isToday) ? '（当前生效的这一份）' : ''}</h5>`
            + data.schedules.map(x => `<pre>${esc(x.text)}</pre>`).join('<hr style="border:none;border-top:1px dashed #cfd9de;margin:6px 0;">') + `</div>`;
    }
    if (data.statuses && data.statuses.length) {
        const hm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
        html += `<div class="gy-cal-sec gy-cal-status"><h5>🟢 这天的状态（${data.statuses.length} 次）</h5>` + data.statuses.slice().reverse().map(st => {
            let sum = st.activity || '';
            if (!sum && st.seg && typeof gyExtractChatStatus === 'function') {
                const ex = gyExtractChatStatus(st.seg, char.id);
                const pick = (ex.rows || []).filter(r => !/时间|日期|date|time/i.test(r.k)).slice(0, 2).map(r => r.v).join(' · ');
                sum = pick || '状态栏';
            }
            return `<details class="gy-stcard" data-i="${st.__i}" ontoggle="gyCalStatusOpen(this)">
                <summary><span class="gy-stcard-t">${hm(st.at)}</span><span class="gy-stcard-s">${esc(String(sum).slice(0, 60))}</span><span class="gy-stcard-k">${st.src === 'chat' ? '状态栏' : (esc(st.label || '') || '状态')}</span></summary>
                <div class="gy-stcard-b"></div></details>`;
        }).join('') + `</div>`;
    }
    if (data.todos.length) {
        html += `<div class="gy-cal-sec todo"><h5>✅ 这天的待办</h5>` + data.todos.map(t =>
            `<div${t.done ? ' style="text-decoration:line-through;color:#8b98a5;"' : ''}>${esc(t.text)}</div>`).join('') + `</div>`;
    }
    if (!data.anniversaries.length && !data.schedules.length && !data.todos.length && !(data.statuses && data.statuses.length)) {
        const future = gyCalSelected > gyDateKey(new Date());
        html += `<div style="color:#8b98a5; font-size:12px; padding:8px 0;">${future ? '这天还没到，也还没安排什么。' : '这天没有留下日程/纪念日/待办。日程是每天自动更新时才归档的，更早的日子可能没有记录。'}</div>`;
    }
    box.innerHTML = html;
}

// 点开一张状态卡才画里面的内容（角色卡自带的状态栏一张就是一整页 HTML，一天几十张全画出来会卡）
function gyCalStatusOpen(det) {
    try {
        if (!det.open || det.__done) return;
        det.__done = true;
        const char = gyCalChar(); if (!char) return;
        const st = (char.statusLog || [])[parseInt(det.dataset.i)];
        const b = det.querySelector('.gy-stcard-b'); if (!b || !st) return;
        const esc = s2 => (typeof escapeHtml === 'function') ? escapeHtml(s2 || '') : String(s2 || '');
        let h = '';
        if (st.activity) h += `<div class="gy-stcard-act">在做：${esc(st.activity)}${st.label ? `　<span>${esc(st.label)}</span>` : ''}</div>`;
        if (st.seg && typeof gyExtractChatStatus === 'function') {
            const ex = gyExtractChatStatus(st.seg, char.id);
            h += (typeof gyChatStatusBlockHtml === 'function') ? gyChatStatusBlockHtml(ex, char.id, undefined, true, 'cal' + st.at) : `<pre>${esc(st.seg)}</pre>`;
        }
        b.innerHTML = h || '<div style="color:#8b98a5;">（没有更多内容）</div>';
    } catch (e) {}
}

// ---------- ＋添加：日程 / 纪念日 / 待办，加在选中的那一天 ----------
function openCalendarAddBox() {
    const box = document.getElementById('charCalendarAddBox');
    if (!box) return;
    box.style.display = 'block';
    const dateEl = document.getElementById('calAddDate');
    if (dateEl) dateEl.value = gyCalSelected || gyDateKey(new Date());
    const textEl = document.getElementById('calAddText');
    if (textEl) { textEl.value = ''; textEl.focus(); }
}
function closeCalendarAddBox() {
    const box = document.getElementById('charCalendarAddBox');
    if (box) box.style.display = 'none';
}
function submitCalendarAdd() {
    const char = gyCalChar();
    if (!char) return (typeof appAlert === 'function' ? appAlert('没找到当前角色。') : alert('没找到当前角色'));
    const type = document.getElementById('calAddType')?.value || 'todo';
    const date = document.getElementById('calAddDate')?.value || '';
    const text = (document.getElementById('calAddText')?.value || '').trim();
    if (!text) return (typeof appAlert === 'function' ? appAlert('先写点内容。') : alert('先写点内容。'));

    if (type === 'todo') {
        getCharTodos(char).push({
            id: 'todo_' + Date.now() + Math.floor(Math.random() * 1000),
            text, date: date || null, done: false, createdAt: Date.now(), doneAt: null, source: 'user'
        });
    } else if (type === 'anniversary') {
        if (!date) return (typeof appAlert === 'function' ? appAlert('纪念日要选一个日期。') : alert('纪念日要选一个日期。'));
        if (!Array.isArray(char.anniversaries)) char.anniversaries = [];
        char.anniversaries.push({ id: 'anniv_' + Date.now(), date, event: text });
    } else {
        if (!date) return (typeof appAlert === 'function' ? appAlert('日程要选一个日期。') : alert('日程要选一个日期。'));
        // 手动加的日程直接写进归档里（跟自动归档同一个结构），这样月历和"生活轨迹总结"都能读到。
        // 选的是今天的话，同时也更新"当前生效的那份日程"，不然角色自己还不知道。
        if (!Array.isArray(char.scheduleHistory)) char.scheduleHistory = [];
        const at = new Date(date + 'T12:00:00').getTime();
        const day = new Date(at).toDateString();
        const exist = char.scheduleHistory.find(h => h && h.day === day);
        if (exist) exist.text = (exist.text ? exist.text + '\n' : '') + text;
        else char.scheduleHistory.push({ day, at, text });
        char.scheduleHistory.sort((a, b) => (a.at || 0) - (b.at || 0));
        if (date === gyDateKey(new Date())) {
            char.schedule = { text: (char.schedule && char.schedule.text ? char.schedule.text + '\n' : '') + text, generatedAt: Date.now() };
        }
    }
    if (typeof saveAllData === 'function') saveAllData();
    gyCalSelected = date || gyCalSelected;
    closeCalendarAddBox();
    renderCharCalendarGrid();
    renderCharTodoList();
}

// ===================== ✅ 待办清单 =====================
// 跟日程是两回事：日程是"今天几点做什么"，一天一换；待办是"还没办的事"，跨天存在、办完才消失。
// 日期可以留空——"不定哪天，但一直记着"这类事（答应过的、惦记着的）才是待办的主力。
// 以后角色"自己决定要做什么"的时候，这份清单就是它的依据（比如桂花糕买到了 → 发条推文）。
function getCharTodos(char) {
    if (!char) return [];
    if (!Array.isArray(char.todos)) char.todos = [];
    return char.todos;
}
function addCharTodo() {
    const char = gyCalChar();
    if (!char) return (typeof appAlert === 'function' ? appAlert('没找到当前角色，重新打开一下资料页。') : alert('没找到当前角色'));
    const textEl = document.getElementById('newTodoText');
    const dateEl = document.getElementById('newTodoDate');
    const text = (textEl?.value || '').trim();
    if (!text) return (typeof appAlert === 'function' ? appAlert('先写一下要办什么事。') : alert('先写一下要办什么事。'));
    getCharTodos(char).push({
        id: 'todo_' + Date.now() + Math.floor(Math.random() * 1000),
        text, date: (dateEl?.value || '') || null,
        done: false, createdAt: Date.now(), doneAt: null, source: 'user'
    });
    if (textEl) textEl.value = '';
    if (dateEl) dateEl.value = '';
    if (typeof saveAllData === 'function') saveAllData();
    renderCharTodoList();
    renderCharCalendarGrid();
}
function toggleCharTodo(id, done) {
    const char = gyCalChar(); if (!char) return;
    const t = getCharTodos(char).find(x => x.id === id); if (!t) return;
    t.done = !!done; t.doneAt = done ? Date.now() : null;
    if (typeof saveAllData === 'function') saveAllData();
    renderCharTodoList();
}
async function deleteCharTodo(id) {
    const char = gyCalChar(); if (!char) return;
    const t = getCharTodos(char).find(x => x.id === id);
    if (t && typeof appConfirm === 'function' && !(await appConfirm(`删掉这条待办？\n\n${t.text}`))) return;
    char.todos = getCharTodos(char).filter(x => x.id !== id);
    if (typeof saveAllData === 'function') saveAllData();
    renderCharTodoList();
    renderCharCalendarGrid();
}
function renderCharTodoList() {
    const box = document.getElementById('charTodoList');
    if (!box) return;
    const char = gyCalChar();
    const list = getCharTodos(char).slice().sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;       // 没办的排前面
        const ad = a.date || '9999-99-99', bd = b.date || '9999-99-99';
        if (ad !== bd) return ad < bd ? -1 : 1;                   // 有日期的按日期，没日期的垫底
        return (a.createdAt || 0) - (b.createdAt || 0);
    });
    if (list.length === 0) { box.innerHTML = `<div style="font-size:12px; color:#8b98a5;">还没有待办。</div>`; return; }
    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s || '') : String(s || '');
    const todayKey = gyDateKey(new Date());
    box.innerHTML = list.map(t => {
        const overdue = !t.done && t.date && t.date < todayKey;
        const meta = [
            t.date ? (overdue ? `<span style="color:#f91880;">${t.date} · 已过期</span>` : t.date) : '不定哪天',
            t.source === 'ai' ? '角色自己记下的' : ''
        ].filter(Boolean).join(' · ');
        return `<div class="gy-todo-row${t.done ? ' done' : ''}" data-todo-id="${t.id}">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleCharTodo('${t.id}', this.checked)">
            <div class="gy-todo-main" ondblclick="startEditCharTodo('${t.id}')" title="双击可以改">
                <div class="gy-todo-text">${esc(t.text)}</div>
                <div class="gy-todo-meta">${meta}</div>
            </div>
            <span class="gy-todo-del" onclick="deleteCharTodo('${t.id}')">×</span>
        </div>`;
    }).join('');
}

// ✏️ 双击改一条待办：就地把这一行换成输入框，回车保存 / Esc 取消 / 点别处也保存。
// 不做弹窗是因为待办改起来通常只是顺手挪个日期、改两个字，弹窗反而重。
function startEditCharTodo(id) {
    const char = gyCalChar(); if (!char) return;
    const t = getCharTodos(char).find(x => x.id === id); if (!t) return;
    const row = document.querySelector(`.gy-todo-row[data-todo-id="${id}"] .gy-todo-main`);
    if (!row || row.dataset.editing === '1') return;
    row.dataset.editing = '1';
    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s || '') : String(s || '');
    row.innerHTML = `<div class="gy-todo-edit">
        <input type="text" class="gy-todo-edit-text" value="${esc(t.text)}">
        <input type="date" class="gy-todo-edit-date" value="${t.date || ''}">
        <button type="button" onclick="commitEditCharTodo('${id}')">保存</button>
        <button type="button" class="cancel" onclick="renderCharTodoList()">取消</button>
        <div class="gy-todo-edit-hint">回车保存，Esc 取消。日期留空 ＝ 不定哪天。</div>
    </div>`;
    const textEl = row.querySelector('.gy-todo-edit-text');
    const dateEl = row.querySelector('.gy-todo-edit-date');
    if (textEl) {
        textEl.focus();
        textEl.setSelectionRange(textEl.value.length, textEl.value.length);
        textEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); commitEditCharTodo(id); }
            else if (e.key === 'Escape') { e.preventDefault(); renderCharTodoList(); }
        });
    }
    if (dateEl) dateEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitEditCharTodo(id); }
        else if (e.key === 'Escape') { e.preventDefault(); renderCharTodoList(); }
    });
}
function commitEditCharTodo(id) {
    const char = gyCalChar(); if (!char) return;
    const t = getCharTodos(char).find(x => x.id === id); if (!t) return renderCharTodoList();
    const row = document.querySelector(`.gy-todo-row[data-todo-id="${id}"] .gy-todo-main`);
    if (!row) return renderCharTodoList();
    const text = (row.querySelector('.gy-todo-edit-text')?.value || '').trim();
    const date = (row.querySelector('.gy-todo-edit-date')?.value || '') || null;
    // 内容清空 ＝ 用户想删掉这条，但删是不可逆的，所以问一句而不是直接删
    if (!text) { renderCharTodoList(); return; }
    t.text = text;
    t.date = date;
    t.editedAt = Date.now();
    if (typeof saveAllData === 'function') saveAllData();
    renderCharTodoList();
    if (typeof renderCharCalendarGrid === 'function') renderCharCalendarGrid();
}

// 🤖 让角色自己写待办：结合人设 + 今天的日程 + 你们最近的聊天 + TA 最近发的推文 + 已有的待办，
// 让 TA 自己想几件"还惦记着没办"的事。除了跟你有关的，也允许写纯属 TA 自己的兴趣（练琴、追的剧、
// 想去的店），因为一个人的待办本来就不会全是关于另一个人的——全是的话反而假。
// regenerate=true：只换掉"TA 自己记下的、还没办完的"，你手写的和已经打勾的一律保留。
async function generateCharTodosAI(regenerate) {
    const char = gyCalChar();
    if (!char) return (typeof appAlert === 'function' ? appAlert('没找到当前角色，重新打开一下资料页。') : alert('没找到当前角色'));
    if (typeof getApiConfig !== 'function') return;
    const api = getApiConfig(true);
    if (!api.key) return (typeof appAlert === 'function' ? appAlert('请先在设置里配置 API Key。') : alert('请先配置 API Key'));
    if (generateCharTodosAI._busy) return;

    const btns = Array.from(document.querySelectorAll('.gy-todo-aibtn'));
    const olds = btns.map(b => b.innerText);
    generateCharTodosAI._busy = true;
    btns.forEach(b => { b.disabled = true; });
    if (btns[0]) btns[0].innerText = '正在想…';

    try {
        const all = getCharTodos(char);
        // 重新生成时先把"AI 写的、还没办完的"挑出来待删——但要等生成成功了再真删，
        // 不然请求失败就白白把原来的清单弄没了。
        const keep = regenerate ? all.filter(t => t.done || t.source !== 'ai') : all.slice();
        const existingText = keep.map(t => t.text).filter(Boolean);

        const recentChat = (typeof getRecentChatContext === 'function') ? (getRecentChatContext(char.id) || '') : '';
        const recentPosts = (typeof getCharRecentPosts === 'function')
            ? getCharRecentPosts(char.id, 8).map(p => p.text).join('\n') : '';
        const scheduleText = (char.schedule && char.schedule.text) ? char.schedule.text : '';
        const doneRecently = all.filter(t => t.done).slice(-6).map(t => t.text);
        const todayKey = gyDateKey(new Date());

        const ask = `现在的真实时间：${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}（今天是 ${todayKey}）。

请以你自己的身份，列出你现在"还惦记着、但还没办"的事，也就是你的待办清单。

【今天的日程】：
${scheduleText || '（还没安排）'}

【你最近发过的动态】：
${recentPosts || '（暂无）'}

【你和${(typeof userDisplayName === 'function') ? userDisplayName(char) : '用户'}最近的聊天】：
${recentChat || '（暂无）'}

【清单上已经有的（不要重复，也不要换个说法再写一遍）】：
${existingText.length ? existingText.map(t => '· ' + t).join('\n') : '（空）'}

【你最近已经办完的（说明这些别再写了）】：
${doneRecently.length ? doneRecently.map(t => '· ' + t).join('\n') : '（暂无）'}

要求：
1. 写 3～5 条，每条 20 字以内，就是一句"要做的事"，不要解释、不要加编号。
2. 必须真的像你会惦记的事：跟你的身份、职业、生活习惯、正在进行的剧情对得上。
3. 不要全是关于${(typeof userDisplayName === 'function') ? userDisplayName(char) : '用户'}的——一个人的待办本来就有一多半是自己的事（工作上的、爱好上的、身体上的、想买想吃想去的）。请至少有一半是纯属你自己的事。
4. 允许写只有你才会在意的小事，越具体越好（"把左手第三根弦换掉"好过"练琴"）。
5. date 字段：明确有日子的才填 YYYY-MM-DD（比如日程里提到的、约好的），大部分应该留空字符串——"不定哪天但一直记着"才是待办的常态。
6. 已经在日程里今天就会做完的事不要写进待办（那是日程不是待办）。

请严格只返回 JSON 数组，不要用 \`\`\` 包裹，不要写任何别的话：
[{"text":"要做的事","date":""}]`;

        const messages = buildStructuredMessages(buildBasePrompt(char, true, recentChat), [], ask);
        const data = await callChatCompletionAPI(api, messages);
        let raw = (data.choices?.[0]?.message?.content || '').trim();
        raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

        // 同样走统一入口：模型带思考过程 / 带 ``` 围栏 / 前后多说了两句，都能兜住
        let arr = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('返回的内容看不懂，没能解析成清单');

        // 生成成功了，这时候才动原来的数据
        if (regenerate) char.todos = keep;
        const list = getCharTodos(char);
        const seen = new Set(list.map(t => String(t.text || '').trim()));
        let added = 0;
        arr.slice(0, 6).forEach((it, i) => {
            const text = String((it && (it.text || it.title)) || '').trim().replace(/^[\d.、·\-\s]+/, '');
            if (!text || seen.has(text)) return;
            seen.add(text);
            const d = String((it && it.date) || '').trim();
            list.push({
                id: 'todo_' + Date.now() + '_' + i + Math.floor(Math.random() * 1000),
                text: text.slice(0, 60),
                date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
                done: false, createdAt: Date.now(), doneAt: null, source: 'ai'
            });
            added++;
        });
        if (typeof saveAllData === 'function') saveAllData();
        renderCharTodoList();
        if (typeof renderCharCalendarGrid === 'function') renderCharCalendarGrid();
        if (typeof showToast === 'function') {
            showToast((typeof getAvatarHTML === 'function') ? getAvatarHTML(char, 40) : '',
                regenerate ? '重新写了一份' : 'TA 记下了几件事',
                `${char.name} 往待办清单里加了 ${added} 条。`, null, null, false);
        }
    } catch (e) {
        console.error('生成待办失败：', e);
        if (typeof appAlert === 'function') appAlert('这次没生成出来：' + (e.message || e));
    } finally {
        generateCharTodosAI._busy = false;
        btns.forEach((b, i) => { b.disabled = false; b.innerText = olds[i]; });
    }
}

// 自动补待办：日程更新完、或者角色自主行动时调用。
// 只有在"没剩几条没办的"时候才补，不然会越堆越多；而且走开关，关了就一次 API 都不调。
async function autoTopUpCharTodos(char, opts) {
    if (!char) return false;
    if (typeof isAutoOn === 'function' && !isAutoOn('autoTodoGen')) return false;
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
    if (!api || !api.key) return false;
    const list = Array.isArray(char.todos) ? char.todos : [];
    const openCount = list.filter(t => t && !t.done).length;
    const threshold = (opts && typeof opts.threshold === 'number') ? opts.threshold : 2;
    if (openCount > threshold) return false;
    // 一天最多自动补一次，避免定时器每转一圈就来一发
    const todayKey = gyDateKey(new Date());
    if (char.lastTodoAutoGenDay === todayKey && !(opts && opts.force)) return false;
    char.lastTodoAutoGenDay = todayKey;
    try {
        await generateCharTodosForChar(char, false);
        return true;
    } catch (e) { console.error('自动补待办失败：', e); return false; }
}

// generateCharTodosAI 是"资料页上点按钮"的版本（要读当前打开的是谁、要动按钮状态）；
// 这个是纯数据版，给定时器和自主行动用，不碰任何界面元素。
async function generateCharTodosForChar(char, regenerate) {
    if (!char) return 0;
    const api = getApiConfig(true);
    if (!api.key) return 0;
    const all = Array.isArray(char.todos) ? char.todos : (char.todos = []);
    const keep = regenerate ? all.filter(t => t.done || t.source !== 'ai') : all.slice();
    const existingText = keep.map(t => t.text).filter(Boolean);
    const recentChat = (typeof getRecentChatContext === 'function') ? (getRecentChatContext(char.id) || '') : '';
    const recentPosts = (typeof getCharRecentPosts === 'function')
        ? getCharRecentPosts(char.id, 6).map(p => p.text).join('\n') : '';
    const scheduleText = (char.schedule && char.schedule.text) ? char.schedule.text : '';
    const who = (typeof userDisplayName === 'function') ? userDisplayName(char) : '用户';

    const ask = `现在的真实时间：${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}。
请以你自己的身份，列出你现在"还惦记着、但还没办"的事（待办清单）。

【今天的日程】：\n${scheduleText || '（还没安排）'}
【你最近发过的动态】：\n${recentPosts || '（暂无）'}
【你和${who}最近的聊天】：\n${recentChat || '（暂无）'}
【已经有的，别重复】：\n${existingText.length ? existingText.map(t => '· ' + t).join('\n') : '（空）'}

要求：写 2～4 条，每条 20 字以内；必须符合你的身份和当前剧情；至少一半是纯属你自己的事（工作、爱好、身体、想买想吃想去的），不要全围着${who}转；越具体越好。date 只有明确有日子的才填 YYYY-MM-DD，其余留空字符串。
严格只返回 JSON 数组，不要用 \`\`\` 包裹：[{"text":"要做的事","date":""}]`;

    const messages = buildStructuredMessages(buildBasePrompt(char, true, recentChat), [], ask);
    const data = await callChatCompletionAPI(api, messages);
    let raw = (data.choices?.[0]?.message?.content || '').trim();
    raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let arr = (typeof parseModelJson === 'function') ? parseModelJson(raw) : null;
    if (!Array.isArray(arr)) return 0;
    if (regenerate) char.todos = keep;
    const list = Array.isArray(char.todos) ? char.todos : (char.todos = []);
    const seen = new Set(list.map(t => String(t.text || '').trim()));
    let added = 0;
    arr.slice(0, 4).forEach((it, i) => {
        const text = String((it && (it.text || it.title)) || '').trim().replace(/^[\d.、·\-\s]+/, '');
        if (!text || seen.has(text)) return;
        seen.add(text);
        const d = String((it && it.date) || '').trim();
        list.push({
            id: 'todo_' + Date.now() + '_a' + i + Math.floor(Math.random() * 1000),
            text: text.slice(0, 60),
            date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
            done: false, createdAt: Date.now(), doneAt: null, source: 'ai'
        });
        added++;
    });
    if (added && typeof saveAllData === 'function') saveAllData();
    return added;
}

async function generateCharAnniversaryNote() {
    const charId = currentProfileId;
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    const api = getApiConfig(true); if (!api.key) return alert('请先在设置中配置 API 密钥！');

    const btn = document.getElementById('charAnniversaryNoteBtn');
    btn.disabled = true; btn.innerText = '生成中...';

    const history = globalChats[charId];
    const daysSince = history && history.length > 0 ? Math.floor((Date.now() - history[0].timestamp) / 86400000) : 0;
    const memories = memoryAlbum.filter(m => m.charId == charId).slice(0, 8).map(m => m.text).join('\n---\n');

    const prompt = `你是"${char.name}"，人设：${char.persona}。
你和用户已经认识 ${daysSince} 天了。
以下是你们之间被收藏下来的一些高光回忆片段：
${memories || '（暂时还没有被收藏的回忆）'}

请以你自己的口吻，写一段简短的纪念寄语给用户（不超过100字），可以回顾一下这段时间，也可以只是很自然地表达你此刻的心情，要符合你的人设和语气，不要写成正式的贺卡文案，就像你会亲口对用户说的话一样。直接输出内容，不要加引号或多余说明。`;

    try {
        const data = await sendChatRequest(api, prompt);
        if (data.error) throw new Error(data.error.message);
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('生成内容为空');
        const noteEl = document.getElementById('charAnniversaryNoteText');
        noteEl.innerText = text; noteEl.style.display = 'block';
    } catch (e) { alert('生成失败：' + e.message); }
    btn.disabled = false; btn.innerText = '✨ 生成一段纪念寄语';
}

// ---------- 聊天联系人：排序/筛选/置顶 通用工具 ----------
function getLastMsgTime(sessionId) {
    const msgs = globalChats[sessionId];
    if (!msgs || msgs.length === 0) return 0;
    return msgs[msgs.length - 1].timestamp || 0;
}
function chatHasUnread(sessionId) {
    const msgs = globalChats[sessionId];
    return !!(msgs && msgs.some(m => m.sender !== 'me' && m.sender !== 'system' && (!m.readBy || !m.readBy.includes('me'))));
}
function getChatListItems() {
    return [...groupChats, ...myCharacters].map(x => ({
        id: x.id, name: x.name, raw: x, isGroup: !!x.members,
        group: x.members ? null : (x.group || null), // 群聊没有分组概念，统一按"未分组"处理
    }));
}
function sortChatListItems(items) {
    const isPinnedId = (id) => pinnedSessionIds.some(pid => pid == id);
    const pinned = items.filter(it => isPinnedId(it.id));
    const unpinned = items.filter(it => !isPinnedId(it.id));
    function cmp(a, b) {
        const aU = chatHasUnread(a.id), bU = chatHasUnread(b.id);
        if (aU !== bU) return aU ? -1 : 1;
        return getLastMsgTime(b.id) - getLastMsgTime(a.id);
    }
    pinned.sort(cmp); unpinned.sort(cmp);
    return [...pinned, ...unpinned];
}
function toggleChatPin(id) {
    const idx = pinnedSessionIds.findIndex(pid => pid == id);
    if (idx >= 0) pinnedSessionIds.splice(idx, 1); else pinnedSessionIds.push(id);
    saveAllData();
    renderChatCharList();
}
function toggleChatListViewMode() {
    chatListViewMode = chatListViewMode === 'row' ? 'list' : 'row';
    if (chatListViewMode === 'list') chatListShowingList = true;
    saveAllData();
    renderChatCharList();
}
function backToContactList() {
    chatListShowingList = true;
    renderChatCharList();
}

// ---------- 主入口：根据当前视图模式分派渲染 ----------
function renderChatCharList() {
    const toggleBtn = document.getElementById('chatListViewToggleBtn');
    if (toggleBtn) toggleBtn.textContent = chatListViewMode === 'row' ? '☰ 列表' : '▦ 头像条';

    const rowContainer = document.getElementById('chatCharRow');
    const listContainer = document.getElementById('chatListVertical');
    const backBtn = document.getElementById('chatListBackBtn');
    const topBar = document.getElementById('chatTopBar');
    const messagesArea = document.getElementById('chatMessagesArea');
    const inputArea = document.getElementById('chatInputArea');
    // 进到具体某个聊天里之后，顶上那一行（← 联系人列表 / ▦ 头像条 / ＋）整条藏掉。
    // 返回用左上角的 ‹ 就够了，顶着一排按钮占地方也不好看。
    const inOneChat = (chatListViewMode !== 'row') && !chatListShowingList;
    if (topBar) topBar.style.display = inOneChat ? 'none' : 'flex';

    if (chatListViewMode === 'row') {
        // 头像条模式：联系人条和聊天内容一直同时显示，跟以前一样
        if (rowContainer) rowContainer.style.display = 'flex';
        if (listContainer) listContainer.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (messagesArea) messagesArea.style.display = 'flex';
        renderChatCharRow();
    } else {
        // 竖排列表模式：列表和聊天内容二选一显示，点进某个联系人才看到聊天界面
        if (rowContainer) rowContainer.style.display = 'none';
        if (chatListShowingList) {
            if (listContainer) listContainer.style.display = 'flex';
            if (backBtn) backBtn.style.display = 'none';
            if (messagesArea) messagesArea.style.display = 'none';
            if (inputArea) inputArea.style.display = 'none';
            renderChatCharListVertical();
        } else {
            if (listContainer) listContainer.style.display = 'none';
            if (backBtn) backBtn.style.display = 'inline-block';
            if (messagesArea) messagesArea.style.display = 'flex';
            // inputArea 的显示由 switchChatSession 自己控制，这里不用管
        }
    }
}

// ---------- 视图一：横向头像条（原有样式，加了排序/筛选/置顶）----------
function renderChatCharRow() {
    const container = document.getElementById('chatCharRow');
    if (!container) return;
    let html = '';
    const items = sortChatListItems(getChatListItems());
    items.forEach(it => {
        const x = it.raw;
        let hasUnread = chatHasUnread(x.id);
        let unreadHtml = hasUnread ? `<div style="position:absolute; top:-2px; right:-2px; width:14px; height:14px; background:#f91880; border-radius:50%; border:2px solid white; z-index:2;"></div>` : '';
        let branchHtml = x.branchedFrom ? `<div style="position:absolute; bottom:-2px; left:-2px; font-size:12px; z-index:2;" title="分支自：${x.branchedFromName || '未知'}">🌳</div>` : '';
        const isGroupItem = !!x.members;
        // 👇这里加入了手机长按的支持；置顶操作收纳进右键/长按菜单，头像上不再显示图钉图标
        html += `<div class="chat-char-item ${currentChatSessionId == x.id ? 'active' : ''}" onclick="switchChatSession('${x.id}')">
            <div style="position:relative; display:inline-block;" ${isGroupItem ? `oncontextmenu="showGroupAvatarContextMenu(event, '${x.id}')" ontouchstart="groupAvatarTouchStart(event, '${x.id}')" ontouchend="groupAvatarTouchEnd(event)" ontouchmove="groupAvatarTouchEnd(event)"` : `oncontextmenu="showAvatarContextMenu(event, '${x.id}')" ontouchstart="avatarTouchStart(event, '${x.id}')" ontouchend="avatarTouchEnd(event)" ontouchmove="avatarTouchEnd(event)"`}>${x.members ? getGroupAvatarHTML(x, 50) : getAvatarHTML(x, 50)}${unreadHtml}${branchHtml}</div>
            <div class="chat-char-name" style="font-size:12px; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${x.name}</div>
        </div>`;
    });
    container.innerHTML = html;
}

// ---------- 视图二：竖排列表（头像+名字+最后消息预览+时间+未读点+置顶按钮）----------
function renderChatCharListVertical() {
    const container = document.getElementById('chatListVertical');
    if (!container) return;
    let html = '';
    const items = sortChatListItems(getChatListItems());
    items.forEach(it => {
        const x = it.raw;
        const isPinned = pinnedSessionIds.some(pid => pid == x.id);
        const hasUnread = chatHasUnread(x.id);
        const msgs = globalChats[x.id] || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        let previewText = '暂无消息';
        if (lastMsg) {
            if (lastMsg.sender === 'system') previewText = lastMsg.text;
            else if (lastMsg.sender === 'me') previewText = `我：${lastMsg.text}`;
            else {
                const senderChar = myCharacters.find(c => c.id == lastMsg.sender);
                previewText = x.members ? `${senderChar ? senderChar.name : '未知'}：${lastMsg.text}` : lastMsg.text;
            }
            previewText = String(previewText).replace(/\n/g, ' ').slice(0, 30);
        }
        const timeText = lastMsg ? timeAgo(lastMsg.timestamp) : '';
        const isGroupItem = !!x.members;
        // 置顶操作收纳进右键/长按菜单，行内不再显示图钉图标；长按沿用和头像条模式一样的手机端支持
        const ctxAttrs = isGroupItem
            ? `oncontextmenu="showGroupAvatarContextMenu(event, '${x.id}')" ontouchstart="groupAvatarTouchStart(event, '${x.id}')" ontouchend="groupAvatarTouchEnd(event)" ontouchmove="groupAvatarTouchEnd(event)"`
            : `oncontextmenu="showAvatarContextMenu(event, '${x.id}')" ontouchstart="avatarTouchStart(event, '${x.id}')" ontouchend="avatarTouchEnd(event)" ontouchmove="avatarTouchEnd(event)"`;
        html += `<div class="chat-list-row ${currentChatSessionId == x.id ? 'active' : ''} ${isPinned ? 'pinned' : ''}" onclick="switchChatSession('${x.id}')" ${ctxAttrs}>
            <div style="position:relative; flex-shrink:0;">${x.members ? getGroupAvatarHTML(x, 44) : getAvatarHTML(x, 44)}${hasUnread ? '<div class="chat-list-unread-dot"></div>' : ''}</div>
            <div class="chat-list-info">
                <div class="chat-list-top-row"><span class="chat-list-name">${isPinned ? '📌 ' : ''}${escapeHtml(x.name)}</span><span class="chat-list-time">${timeText}</span></div>
                <div class="chat-list-preview">${escapeHtml(previewText)}</div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function updateGroupSpeakOrder() {
    const g = groupChats.find(g => g.id === currentSummaryCharId);
    if (!g) return;
    g.speakOrder = document.getElementById('groupSpeakOrderSelect').value;
    saveAllData();
}

function exportChatTxt() {
    if(!currentSummaryCharId) return; let session = globalChats[currentSummaryCharId] || []; if(session.length === 0) return alert("当前聊天记录为空！");
    let txt = session.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender === 'me' ? currentUser.name : (m.sender === 'system' ? '系统' : (myCharacters.find(c=>c.id==m.sender)?.name || m.sender))}: ${m.text}`).join('\n');
    saveTextFileForApp(`chat_${currentSummaryCharId}.txt`, txt, 'text/plain');
}

function importChatTxt(event) {
    let file = event.target.files[0]; if(!file) return; let reader = new FileReader();
    reader.onload = function(e) {
        let lines = e.target.result.split('\n'); if(!globalChats[currentSummaryCharId]) globalChats[currentSummaryCharId] = [];
        let session = globalChats[currentSummaryCharId], nameMap = { [currentUser.name]: 'me', '用户': 'me', '我': 'me', '系统': 'system', 'system': 'system' };
        myCharacters.forEach(c => { nameMap[c.name] = c.id; });
        lines.forEach(line => {
            let match = line.trim().match(/^\[(.*?)\]\s*(.*?):\s*(.*)$/);
            if(match) { let senderId = nameMap[match[2].trim()] || 'system'; session.push({ sender: senderId, text: senderId === 'system' && match[2].trim() !== '系统' ? `${match[2]}: ${match[3]}` : match[3].trim(), timestamp: new Date(match[1]).getTime() || Date.now(), readBy: [] }); } 
            else if(line.trim()) { session.push({ sender: 'system', text: line.trim(), timestamp: Date.now() }); }
        });
        saveAllData(); if (currentChatSessionId === currentSummaryCharId) renderChatMessages(); alert("TXT导入成功！"); closeModal('chatTxtModal'); document.getElementById('importTxtInput').value = '';
    };
    reader.readAsText(file);
}

// ST的 send_date 常见是"April 26, 2026 6:06am"这种人写的格式（月份全称+逗号+12小时制，am/pm前面没有空格），
// 浏览器原生 Date.parse 认不出这种没空格的写法会直接返回NaN——实测在 am/pm 前面补一个空格就能正常解析了，
// 所以第一次解析失败时，再补个空格重试一次；两次都失败就说明格式实在太特殊，返回NaN让调用方自己兜底成当前时间。
function tryParseSendDate(str) {
    let parsed = Date.parse(str);
    if (!isNaN(parsed)) return parsed;
    const spaced = str.replace(/(\d)(am|pm)\b/i, '$1 $2');
    parsed = Date.parse(spaced);
    return isNaN(parsed) ? NaN : parsed;
}
// 导入 SillyTavern 的原生聊天记录文件(.jsonl)：这是ST每个角色单独的聊天日志格式，逐行都是一个独立JSON对象——
// 第一行是"头信息"(user_name/character_name/chat_metadata)，从第二行起才是一条条真正的消息。
// 消息行格式：{name, is_user, is_system(可选), send_date, mes, extra:{display_text?}, swipe_id?, swipes?}。
// 因为这个按钮是从"某个角色"的聊天选项弹窗里点开的，天然知道要导入到哪个角色身上，不用再额外选一次角色。
function importChatJsonl(event) {
    const file = event.target.files[0]; if (!file) return;
    const cleanReasoning = document.getElementById('jsonlImportCleanReasoning') ? document.getElementById('jsonlImportCleanReasoning').checked : true;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const rawLines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean);
            if (rawLines.length === 0) { alert('这个文件是空的，没有可以导入的内容。'); return; }

            // 第一行是头信息，不是消息——按ST的真实格式判断：包含 user_name / character_name / chat_metadata 这几个字段之一
            // 就当作头信息跳过；万一格式不标准（比如手动拼过的文件）导致第一行判断不出来，就干脆整份当消息处理，
            // 后面逐行解析失败的行会自动跳过，不会导致整个导入失败。
            let startIdx = 0;
            try {
                const first = JSON.parse(rawLines[0]);
                if (first && (first.user_name !== undefined || first.character_name !== undefined || first.chat_metadata !== undefined)) startIdx = 1;
            } catch (e2) { /* 第一行解析不了就当成普通消息处理，不跳过 */ }

            if (!globalChats[currentSummaryCharId]) globalChats[currentSummaryCharId] = [];
            const session = globalChats[currentSummaryCharId];
            let importedCount = 0, skippedCount = 0;

            for (let i = startIdx; i < rawLines.length; i++) {
                let msg;
                try { msg = JSON.parse(rawLines[i]); } catch (e3) { skippedCount++; continue; }
                if (!msg || typeof msg !== 'object') { skippedCount++; continue; }
                let text = (msg.extra && msg.extra.display_text) || msg.mes;
                // 用跟直播生成同一套"前缀/后缀可配置"规则处理（设置里的思维链格式列表+显示模式），
                // 而不是导入单独写死一套逻辑——这样以后加新格式/改折叠还是删除，两边行为自动保持一致。
                if (cleanReasoning && !msg.is_user && !msg.is_system) text = processReasoningInText(text);
                // 同理，导入的历史记录里如果带着MVU变量补丁块（状态栏那套），也要按当前会话的规则剥离+应用一次，
                // 不然老聊天记录导入进来照样是一堆裸JSON糊在气泡里。
                let mvuSnapshot = null;
                if (!msg.is_user && !msg.is_system) {
                    const mvuResult = processMvuPatchInText(text, currentSummaryCharId);
                    text = mvuResult.cleanText;
                    mvuSnapshot = mvuResult.snapshot;
                }
                if (!text) { skippedCount++; continue; } // 没有正文内容的行（比如只有系统元数据）没有导入的意义

                let sender;
                if (msg.is_system) sender = 'system';
                else if (msg.is_user) sender = 'me';
                else sender = currentSummaryCharId; // 非用户、非系统消息，一律算这个角色说的（ST的单角色聊天文件本来就是这么对应的）

                // send_date 这个字段在ST里格式很不统一：可能是"April 26, 2026 6:06am"这种人类可读格式，
                // 也可能是ISO字符串，甚至有些是数字形式的Unix毫秒时间戳——这里都试一遍，都解析不出来就用当前时间兜底。
                let timestamp = Date.now();
                if (typeof msg.send_date === 'number' && !isNaN(msg.send_date)) {
                    timestamp = msg.send_date;
                } else if (typeof msg.send_date === 'string' && msg.send_date.trim()) {
                    const parsed = tryParseSendDate(msg.send_date);
                    if (!isNaN(parsed)) timestamp = parsed;
                }

                session.push({ sender, text, timestamp, readBy: [], mvuSnapshot });
                importedCount++;
            }

            saveAllData();
            if (currentChatSessionId === currentSummaryCharId) renderChatMessages();
            alert(`SillyTavern聊天记录导入完成！\n成功导入 ${importedCount} 条消息${skippedCount > 0 ? `，跳过了 ${skippedCount} 条无法识别的行` : ''}。`);
            closeModal('chatTxtModal');
            document.getElementById('importJsonlInput').value = '';
        } catch (err) {
            console.error('导入jsonl聊天记录失败：', err);
            alert('导入失败：' + err.message + '\n请确认这是SillyTavern导出的.jsonl聊天文件。');
        }
    };
    reader.readAsText(file);
}

function getRecentChatContext(charId) {
    let session = globalChats[charId] || [];
    return session.slice(-chatHistoryTurns).filter(m => m.sender !== 'system').map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.sender === 'me' ? "用户" : "你"}: ${m.text}`).join('\n');
}

// 🆕 给"AI自己主动引用一条最近说过的话"用：把最近几条消息编个号列出来，AI在这一轮回复时可以用编号
// 点名要引用哪条（不管是用户说的还是它自己之前说的）。消息本身一直没有稳定的id字段（手动"引用回复"
// 功能也是靠临时抓取当前这条消息的{name,text}快照实现的，不依赖id），这里用同样的思路：编号只在
// 这一次生成的prompt里临时有效，AI选完号，代码从同一份list数组里按下标精确取出对应的{name,text}。
function buildQuotableRecentMessages(sessionId, char, isGroup) {
    // 💰 这里原来取最近 12 条。但这 12 条**在同一个请求里已经作为独立的 user/assistant 轮次发过一遍了**，
    // 在任务指令里再列一遍等于把聊天历史整份复制了一份，纯浪费（实测占单条聊天请求的 5~10%）。
    // 引用功能真正会用到的基本只有最近几句，取 5 条足够，编号也更短、模型更不容易选错。
    const msgs = (globalChats[sessionId] || []).slice(-5).filter(m => m.sender !== 'system' && m.text && m.text.trim());
    const list = msgs.map(m => ({
        name: m.sender === 'me' ? currentUser.name : (isGroup ? (myCharacters.find(c => c.id == m.sender)?.name || '未知') : char.name),
        text: m.text
    }));
    if (list.length === 0) return { promptText: '', list: [] };
    const linesText = list.map((m, i) => `${i + 1}. ${m.name}: ${m.text.slice(0, 60)}`).join('\n');
    const promptText = `\n【可引用的最近消息（可选功能，大部分时候不需要用）】：如果这一轮你想明确引用/回应最近说过的某一句话（不管是对方说的还是你自己之前说的），可以在其中一条回复的text最前面加上 [QUOTE:编号]（编号对照下面列表），没有特别想引用的就完全不要加这个标记：\n${linesText}\n`;
    return { promptText, list };
}


function switchChatSession(id) {
    currentChatSessionId = id.toString();
    chatListShowingList = false;
    renderChatCharList();
    const chatInput = document.getElementById('chatInputArea');
    if(chatInput) chatInput.style.display = 'flex';
    try { gyPaintReplyBtn(); } catch (e) {}   // 🖐️ 换个人聊，「回复」上攒着几句也跟着换
    // 防御：开场白相关逻辑（角色数据/插件/宏都可能出岔子）如果在这里抛错，之前会导致下面的
    // renderChatMessages()整个都不执行——表现出来就是"新聊天开场白不显示"，其实是连聊天界面都没刷新。
    // 分开try/catch，保证不管开场白那边出不出错，聊天消息区始终会尝试渲染。
    try { sendFirstMessageIfNeeded(id.toString()); } catch (e) { console.error('生成开场白时出错，已跳过：', e); }
    try { renderChatMessages(); } catch (e) { console.error('渲染聊天消息时出错：', e); }
    checkAndAnnounceAnniversary(id.toString());
    refreshLifeStateOnChatEnter(id.toString());
    renderChatPluginActionsBar();
    refreshMiniGameIconBadge();

    // 修复：取消了原先的强制自动生成日程，现在完全由用户通过长按头像来手动生成
}

// 首次打开和某个角色的聊天（没有任何历史消息）时，如果设置了开场白，就自动发出来当第一条消息。
// 🐛 之前踩过两版坑：
// 1）多开场白时弹选择框——曾经因为触发时机在"跳转进聊天界面"之前，视觉上像是"点联系人没反应，只弹了个选择框"；
// 2）为了避开1，改成不管几个候选都直接用第一个——结果撞上不少酒馆卡的常见写法：first_mes本身写的是一份
//    "开场白目录/索引"（列出所有分支剧情的标题+简介，本身不是真的开场白正文，要靠用户从"候选开场白"里手动挑一个
//    真正的开场白），直接把这份索引当正文发出去，看起来就是"点开开场白还是一大段文字糊一脸"。
// 现在 switchChatSession 里已经先做了 currentChatSessionId赋值+renderChatCharList()把界面切到聊天页，
// 之后才会调用这个函数——也就是"跳转"这一步已经完成了，所以多候选时弹选择框不会再有当年"看起来没跳转"的问题，
// 可以放心恢复成"有多个候选就弹出来给用户挑"，避免盲目挑到像目录索引这种其实不该被直接使用的候选。
function sendFirstMessageIfNeeded(sessionId) {
    if (sessionId.startsWith('g_')) return; // 群聊不适用
    const char = myCharacters.find(c => c.id == sessionId);
    if (!char) return;
    if (globalChats[sessionId] && globalChats[sessionId].length > 0) return; // 已经聊过了就不重复发
    const options = getGreetingOptions(char);
    if (options.length === 0) return;
    // 💡 不管候选开场白有几个，统一弹出选择框——里面会带一张"不使用开场白"的卡片，
    // 用户可以自己决定要不要用、用哪个，不再对"只有一个候选"的情况静默自动帮用户选定。
    showGreetingPicker(sessionId);
}

// 汇总一个角色所有能用的开场白：自己填的开场白 + 角色卡带的候选开场白，去重后返回
function getGreetingOptions(char) {
    let options = [];
    try {
        if (char && typeof char.firstMessage === 'string' && char.firstMessage.trim()) options.push(char.firstMessage.trim());
        // 同一段开场白在 first_mes 和候选里各放一份（空格/换行略有不同）的卡很常见——按"去掉空白后一样"去重
        const keyOf = t => String(t).replace(/\s+/g, '');
        const seen = new Set(options.map(keyOf));
        if (char && Array.isArray(char.alternateGreetings)) {
            char.alternateGreetings.forEach(g => {
                if (typeof g !== 'string' || !g.trim()) return;
                const k = keyOf(g); if (seen.has(k)) return;
                seen.add(k); options.push(g.trim());
            });
        }
    } catch (e) { console.error('读取开场白候选列表时出错：', e); }
    return options;
}

function applyGreetingAsFirstMessage(sessionId, greetingText) {
    const char = myCharacters.find(c => c.id == sessionId);
    if (!char) return;
    // 选好了具体是哪个候选之后，正文里就不需要再带 <!-- title -->/<!-- desc --> 这两行元数据注释了
    // （那是给挑选界面看的标签，不是真的开场白正文），发到聊天里/存进存档前先去掉，不然每次都得看着这两行注释。
    const meta = parseGreetingMeta(greetingText);
    let text = meta ? meta.body : greetingText;
    try { text = applyMacros(text, char); } catch (e) { console.error('开场白宏替换出错，改用原文：', e); }
    // 开场白是角色卡作者直接写死在卡里的文本，不是AI临场生成的，但同样可能带着正则脚本要处理的占位符语法，
    // 甚至（真实遇到过）作者直接把一份"状态栏JSON补丁"的示例文本焊在了开场白里——这些跟AI回复走的是两条
    // 不同的代码路径，之前只处理了AI回复那一条，开场白这边一直漏着，导致原始JSON会原样糊出来。
    text = applyRegexScripts(text, 'ai_output', char.id);
    const mvuResult = processMvuPatchInText(text, sessionId);
    text = mvuResult.cleanText;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text, timestamp: Date.now(), readBy: [], mvuSnapshot: mvuResult.snapshot });
    saveAllData();
    if (currentChatSessionId === sessionId) { try { renderChatMessages(); } catch (e) { console.error('渲染聊天消息时出错：', e); } }
}

// 统一的"重新开始聊天"入口（长按头像触发）：先问要不要保留现在这段对话——
// 保留的话会自动克隆一个角色副本把旧聊天记录存进去，当前角色再清空重新开始；
// 不保留就直接清空。无论角色有几个开场白（0个/1个/多个）都能用这个入口重新开始。
async function restartChatWithGreeting(charId) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;
    const hasHistory = globalChats[charId] && globalChats[charId].length > 0;

    if (hasHistory) {
        // 💡 修复：修改提示文案与逻辑，改为将旧对话收纳进历史记录
        const keepOld = await appConfirm(`要保留现在和${char.name}的这段对话吗？\n【确定】= 将旧对话收拢归档到历史记录中（可在右键菜单查看），当前清空重新开始\n【取消】= 直接彻底清空重新开始（旧记录会丢失）`);
        if (keepOld) {
            if (!char.archivedChats) char.archivedChats = [];
            char.archivedChats.push({
                id: Date.now(),
                timeStr: new Date().toLocaleString('zh-CN'),
                messages: JSON.parse(JSON.stringify(globalChats[charId]))
            });
            saveAllData();
        }
        globalChats[charId] = [];
    }

    const options = getGreetingOptions(char);
    if (options.length === 0) {
        saveAllData();
        if (currentChatSessionId === charId) renderChatMessages();
        else switchChatSession(charId);
        alert(hasHistory ? '已经清空并重新开始了（这个角色没有设置开场白，你可以先开口打个招呼）。' : '这个角色没有设置开场白，直接开口聊就行～');
    } else {
        // 💡 不管候选开场白有几个，统一走"先跳转过去→弹出选择框（含"不使用开场白"选项）"这条路径，
        // 不再对"只有一个候选"的情况自动帮用户选定——用户始终能自己决定要不要用、用哪个开场白。
        // 🐛 修复：这里之前漏了"如果当前不在这个角色的聊天里，先跳转过去"这一步
        // （options.length === 1 的分支上面就有这一句，多开场白这条分支却漏掉了）。
        // 不加这句的话，从别的角色的聊天页/联系人列表右键"重新开始聊天"选中一个有多开场白的角色时，
        // 选完开场白后画面还留在原来那个角色的聊天里，看起来就像"点了开场白但没跳转过去"。
        if (currentChatSessionId !== charId) {
            // switchChatSession 内部的 sendFirstMessageIfNeeded 会检测到"没有历史记录+多个候选开场白"
            // 并自动弹出选择框，这里不用再手动调一次 showGreetingPicker，不然会连续弹两次（虽然内容一样、无害，但没必要）。
            switchChatSession(charId);
        } else {
            showGreetingPicker(charId);
        }
    }
}

// 不少酒馆卡的候选开场白正文最前面会带 <!-- title: xxx --> / <!-- desc: xxx --> 这种HTML注释当"元数据标题/简介"
// （这正是这次踩坑的角色卡的写法——它的first_mes本身是把所有候选开场白的title/desc汇总成一份"目录页"）。
// 挑选框如果直接把带注释语法的原始正文糊一脸，用户还是得从一堆"<!-- title: -->"里自己找有用信息——
// 这里识别到就单独抽出来做成"标题+简介"展示，正文只留一段简短预览；没有这种注释头的普通开场白就还是老样子全文预览。
function parseGreetingMeta(text) {
    const m = text.match(/^\s*<!--\s*title:\s*([\s\S]*?)\s*-->\s*(?:\r?\n)?\s*<!--\s*desc:\s*([\s\S]*?)\s*-->\s*(?:\r?\n)?([\s\S]*)$/i);
    if (!m) return null;
    return { title: m[1].trim(), desc: m[2].trim(), body: m[3].trim() };
}

// 有些角色卡的 firstMessage 本身写的不是真开场白，而是一份"目录页/索引页"
// （标题带"目录"，正文是 <greetings>0. xxx\n1. xxx...</greetings> 这种编号列表，
// 真正能用的正文其实都在 alternateGreetings 里）。这种候选选中了就是一整段索引文字糊脸上，
// 所以挑选框里要能认出它、单独标红提醒，并且排在候选列表最后面，避免用户顺手点了第一张卡就中招。
//
// 🆕 第三条判据（覆盖面最广的一条）：看**渲染出来的成品页面**是不是一份"开场白导航"。
// 起因是实测 27 张卡 478 条开场白时发现的：靠标签名穷举根本追不完——江执写 <CardIntro>、
// 蔚野写 <播客开场白>、霍司爵写 <card_info>、沉沦法则写 <encounter>，每个作者一个写法，
// 上面那两条判据只认得出 2 条，剩下的目录页全部漏网、还顶在候选列表第一个。
//
// 但这类页面有一个跨卡片通用的行为特征：它的每一个可点条目都调
// setChatMessages([{message_id:0, swipe_id:N}]) 跳到第 N 条开场白。
// 干扰项是——几乎每张卡的**正式**开场白底部也都挂了一个"回到首页"按钮，调的是同一个接口。
// 区别在于：回到首页的目标恒定是第 0 条（目录页自己），而目录页会指向一堆**别的**编号
// （厉承修 1~17、闻述 1~40），或者干脆是个变量（江执 parseInt(data-index)、谢云霄 sid）。
// 所以判据写成：把所有 swipe_id:0 剔掉之后还剩任何一个 swipe_id 目标 → 这是目录页。
function hasGreetingNavTargets(html) {
    if (!html || typeof html !== 'string') return false;
    if (html.indexOf('setChatMessages') === -1) return false;
    // 只剔掉写死的 0（回到首页），变量/表达式/非 0 的字面量都留下
    const rest = html.replace(/swipe_id\s*:\s*0\s*(?=[,}\)\s])/g, '');
    return /swipe_id\s*:/.test(rest);
}
function isMenuLikeGreeting(text, charId) {
    if (!text) return false;
    const meta = parseGreetingMeta(text);
    const title = meta ? meta.title : (text.match(/^\s*<!--\s*title:\s*([\s\S]*?)\s*-->/i) || [])[1] || '';
    const body = meta ? meta.body : text;
    if (/目录|索引/.test(title)) return true;
    if (/<greetings>[\s\S]*<\/greetings>/i.test(body)) return true;
    // 拿不到 charId 就没法跑角色专属的显示正则，只能退回上面两条纯文本判据（保持老行为，不会更差）
    if (charId === null || charId === undefined || charId === '') return false;
    if (typeof applyDisplayOnlyRegex !== 'function') return false;
    try { return hasGreetingNavTargets(applyDisplayOnlyRegex(text, charId, 0)); }
    catch (e) { return false; }
}

// 把"候选开场白列表"渲染成挑选框里的卡片列表——聊天和续写两处挑选框长得一样、复用同一份渲染逻辑，
// labelFn(idx, item) 可以给每张卡片加一个额外的前缀标签（比如续写模式下要标出"这是哪个角色的开场白"）。
// 注意：这里的 idx 是渲染出来卡片的顺序，点击时会通过 onclick 里的 idx 去 window.__greetingPickerOptions 找原始数据，
// 所以排序（把目录页类选项放最后）必须在传进来之前就排好，这个函数本身只管渲染、不做排序。
//
// opts.menuAsEntry：目录页当"正式入口"看待（续写工作台用）。续写那边点开目录页是真的能用的——
// 挑选框会把它整页渲染出来、点里面的场景卡就直接开局，所以那里不该再红字警告"请谨慎选择"，
// 反过来要标成推荐入口。聊天/小说那边渲染不了这一页（聊天气泡是纯文本），维持原来的红字警告。
// opts.charId：跑角色专属显示正则用，没有就退回纯文本判据。
function renderGreetingOptionCards(options, labelFn, opts) {
    opts = opts || {};
    return options.map((item, idx) => {
        const g = typeof item === 'string' ? item : item.text;
        const meta = parseGreetingMeta(g);
        const cid = (typeof item === 'object' && item && item.charId !== undefined) ? item.charId : opts.charId;
        const isMenu = isMenuLikeGreeting(g, cid);
        const asEntry = isMenu && !!opts.menuAsEntry;
        const esc = s => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const bodyForPreview = meta ? meta.body : g;
        const preview = bodyForPreview.length > 200 ? bodyForPreview.slice(0, 200) + '……' : bodyForPreview;
        const extraLabel = labelFn ? labelFn(idx, item) : '';
        const warnHtml = !isMenu ? ''
            : (asEntry
                ? `<div style="font-size:12px; font-weight:bold; color:#1d9bf0; margin-bottom:2px;">📖 作者做的开场目录页 · 点进去挑分支</div>`
                : `<div style="font-size:12px; font-weight:bold; color:#e0245e; margin-bottom:2px;">⚠️ 疑似目录/索引页，可能不是正式开场白，请谨慎选择</div>`);
        const titleColor = (isMenu && !asEntry) ? '#e0245e' : '#1d9bf0';
        const headerHtml = meta
            ? `<div style="font-size:14px; font-weight:bold; color:${titleColor}; margin-bottom:2px;">${extraLabel}${esc(meta.title) || `候选 ${idx + 1}`}</div>${meta.desc ? `<div style="font-size:12px; color:#536471; margin-bottom:6px;">${esc(meta.desc)}</div>` : ''}`
            : `${extraLabel ? `<div style="font-size:12px; font-weight:bold; color:${titleColor}; margin-bottom:2px;">${extraLabel}</div>` : ''}`;
        return `
        <div class="wb-card" style="min-width:0; max-width:none; width:100%; cursor:pointer; margin-bottom:8px; ${isMenu ? (asEntry ? 'border:1px solid #1d9bf0;' : 'border:1px solid #e0245e;') : ''}" onclick="selectGreeting(${idx})">
            ${warnHtml}
            ${headerHtml}
            <div style="font-size:13px; color:#0f1419; white-space:pre-wrap; max-height:${meta ? '80px' : '150px'}; overflow-y:auto;">${esc(preview)}</div>
        </div>`;
    }).join('');
}

// 把候选开场白列表按"目录页排哪边"重排，其余选项保持原有相对顺序（稳定排序）。
// item 可能是字符串，也可能是 {text, charId, ...} 结构（续写/小说模式）。
//   · menuFirst=false（聊天/小说，默认）：目录页排最后。这两处渲染不了作者做的那一页
//     （聊天气泡是纯文本，小说是把开场白当一章正文插进去），选中目录页只会得到一坨裸标记，
//     所以要把它挪开、别顶在第一张卡被顺手点中。
//   · menuFirst=true（续写工作台）：目录页排最前，当成正式入口。那边点开它是真能用的。
function sortGreetingOptions(options, opts) {
    opts = opts || {};
    const getText = item => typeof item === 'string' ? item : item.text;
    const getCid = item => (typeof item === 'object' && item && item.charId !== undefined) ? item.charId : opts.charId;
    const first = !!opts.menuFirst;
    return options.map((item, idx) => ({ item, idx, isMenu: isMenuLikeGreeting(getText(item), getCid(item)) }))
        .sort((a, b) => (a.isMenu === b.isMenu) ? (a.idx - b.idx) : ((a.isMenu ? 1 : -1) * (first ? -1 : 1)))
        .map(x => x.item);
}
// 老名字保留：调用点不少，而且语义就是"目录页排最后"，直接转发过去
function sortGreetingOptionsMenuLast(options, charId) {
    return sortGreetingOptions(options, { menuFirst: false, charId });
}

// ===== 🎲 随机生成开场白 =====
// 三个场景共用一个入口，但**按各自的格式**生成，不是一份文案套三处：
//   chat        → 微信式的第一条消息（短、口语、直接开口，不写旁白）
//   storyStudio → 互动续写的第一轮（场景+人物状态，末尾留出让用户接话的余地）
//   novelOutline→ 小说第一章的开篇段落（叙述体，篇幅更长）
// 生成时走 buildBasePrompt，所以人设/世界书/预设/关系网这些都会带上，
// 不是凭空编一个跟角色无关的开头。
function getRandomGreetingSpec(mode, char) {
    const base = {
        chat: {
            label: '聊天开场白',
            rule: `写一条${char ? char.name : '这个角色'}主动发给${userDisplayName()}的**第一条聊天消息**。
要求：像真人发微信那样，口语、简短（不超过${typeof chatWordLimit !== 'undefined' ? chatWordLimit : 50}字）；
直接开口说话，不要写场景旁白、不要写"（他推开门）"这类描写以外的舞台说明；
内容要贴合人设和你们当前的关系，不要写成客服式的问候。`
        },
        storyStudio: {
            label: '续写开场',
            rule: `写一段**互动续写的开场**：先用两三句话把场景、时间、${char ? char.name : '角色'}此刻在做什么交代清楚，
再落到一句人物的动作或台词上，把话头留给${userDisplayName()}接。
要求：叙述体，200字以内，有画面感，结尾是开放的（不要把事情写完）。`
        },
        novelOutline: {
            label: '小说开篇',
            rule: `写一段**小说的开篇**：叙述体，400字以内，交代时间地点与${char ? char.name : '主角'}的处境，
建立起可以往下写的氛围和悬念。不要写成大纲或提要，直接就是正文第一段。`
        }
    };
    return base[mode] || base.chat;
}

async function generateRandomGreeting() {
    const mode = window.__greetingPickerMode || 'chat';
    if (!myApiKey) return alert('请先在【设置】里配置主 API Key，随机开场白需要调用 AI 生成。');

    // 找出这次要以谁的身份生成
    let char = null;
    if (mode === 'chat') char = myCharacters.find(c => c.id == window.__greetingPickerCharId);
    else if (mode === 'storyStudio') char = (window.__ssGreetChars || [])[Math.floor(Math.random() * (window.__ssGreetChars || []).length)] || null;
    else {
        const sel = Array.from(document.querySelectorAll('.novel-char-check:checked')).map(cb => cb.value).filter(v => v !== 'me');
        char = myCharacters.find(c => c.id == sel[Math.floor(Math.random() * sel.length)]) || null;
    }
    if (!char) return alert('没有找到可用的角色，先选一个角色再生成。');

    const btn = document.getElementById('randomGreetingBtn');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = `🎲 正在为「${escapeHtml(char.name)}」生成…`; btn.style.pointerEvents = 'none'; btn.style.opacity = '0.7'; }

    try {
        const spec = getRandomGreetingSpec(mode, char);
        // 已有的开场白一并给它看，明确要求"别跟这些重样"——不然多点几次会一直给同一个味道
        const existing = (typeof getGreetingOptions === 'function' ? getGreetingOptions(char) : [])
            .map(g => (typeof g === 'string' ? g : g.text) || '').filter(Boolean).slice(0, 6)
            .map((g, i) => `${i + 1}. ${g.replace(/<[^>]+>/g, '').slice(0, 80)}`).join('\n');

        const prompt = `${buildBasePrompt(char, true, '')}

【任务】${spec.rule}

${existing ? `【这个角色已有的开场白（只是让你避开，不要模仿它们的写法和切入点）】\n${existing}\n` : ''}
【输出要求】只输出开场白正文本身，不要任何前言、解释、标题、引号包裹，也不要输出"好的，这是……"之类的话。`;

        const data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, prompt);
        if (data.error) throw new Error(data.error.message || '生成失败');
        let text = (data.choices?.[0]?.message?.content || '').trim();
        text = extractAfterFinalMarker(text).trim();
        if (typeof processReasoningInText === 'function') {
            const r = processReasoningInText(text);
            text = (typeof r === 'string') ? r : (r && r.text) || text;
        }
        text = text.replace(/^["'“”「『]+|["'“”」』]+$/g, '').trim(); // 模型爱把整段用引号裹起来
        if (!text) throw new Error('生成结果是空的');

        closeModal('greetingPickerModal');
        if (mode === 'chat') {
            const charId = window.__greetingPickerCharId;
            applyGreetingAsFirstMessage(charId, text);
            if (currentChatSessionId !== charId) switchChatSession(charId);
        } else if (mode === 'storyStudio') {
            if (typeof applySsGreeting === 'function') applySsGreeting({ charId: char.id, text });
        } else {
            // 一键生成模式：跟选中已有开场白一样，丢进预览区走"保留/重新生成/放弃"
            const novel = globalNovels.find(n => n.id === currentEditingNovelId);
            const chapterNum = (novel && novel.chapters ? novel.chapters.length : 0) + 1;
            tempNovelChapter = { id: 'c_' + Date.now(), index: chapterNum, content: text, timestamp: Date.now() };
            const tempArea = document.getElementById('novelTempArea'), tempContentEl = document.getElementById('novelTempContent');
            if (tempContentEl) tempContentEl.value = text;
            if (tempArea) { tempArea.style.display = 'block'; tempArea.scrollIntoView({ behavior: 'smooth' }); }
        }
    } catch (e) {
        console.error('[随机开场白] 生成失败：', e);
        alert('随机开场白生成失败：' + (e.message || e) + '\n\n可以再试一次，或者直接从上面的候选里挑一个。');
    } finally {
        if (btn) { btn.innerHTML = old; btn.style.pointerEvents = ''; btn.style.opacity = ''; }
    }
}
