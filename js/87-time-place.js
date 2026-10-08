/* ============================================================
   🌏 时间与所在地（v213，接着 js/86「感知真实时间」）
   ------------------------------------------------------------
   时间有三种：
     · 真实时间（默认）：跟现实走；
     · 不感知（js/86）：TA 不知道现实里几点几号；
     · 自定义时间：从你定的那一刻开始往后走（比如剧情里的 1998 年夏天晚上九点），也可以「停在这一刻」不走。
       发给模型的内容里，所有「现在」附近的日期时间（一年以内的）统一换算成自定义的时间，星期几跟着重算；
       聊天记录里「3小时前」这种相对时间照常有（自定义时间也是一分一秒往后走的）。
   所在地：
     · 你在哪、什么时区；每个 TA 在哪、什么时区（不填＝跟你一样）。
     · 时区不一样、或者你勾了「异地」：TA 按自己那边的白天黑夜过日子，知道你那边几点；不默认能见面，见面得有安排。
     · 不感知时间时只说在哪，不说几点。
   这一页：设置 → 聊天 → 🕰️ 那一行旁边的「时间与所在地」，或者小功能里的「🌏 时间与所在地」。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyTimePlace) return;
    window.__gyTimePlace = true;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charById = id => chars().find(c => String(c.id) === String(id));
    const senseOn = () => typeof window.gyTimeSenseOn === 'function' ? window.gyTimeSenseOn() : true;
    const save = () => { try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} };

    // ---------- 设置（跟着备份走：localStorage 会一起进备份文件） ----------
    const KEY = 'gyTimeCfg';
    let C = { custom: { on: false, start: '', setAt: 0, frozen: false }, user: { place: '', tz: '' }, log: [] };
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v) C = Object.assign(C, v, { custom: Object.assign(C.custom, v.custom || {}), user: Object.assign(C.user, v.user || {}) }); } catch (e) {}
    C.log = Array.isArray(C.log) ? C.log : [];
    const store = () => { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) {} };
    const devTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'; } catch (e) { return 'Asia/Shanghai'; } })();
    // 你在哪个城市 / 时区：只存一份，在 🗺️ 行程与天气（js/23）里（天气也跟着它）。没有那个模块时才用这里自己的
    const MAP = () => (typeof window.gymapUser === 'function' ? window.gymapUser() : null);
    const uPlace = () => { const m = MAP(); return String((m && m.city) || C.user.place || '').split('（')[0].trim(); };
    const uTz = () => { const m = MAP(); return (m && m.tz) || C.user.tz || ''; };
    const userTz = () => uTz() || devTz;
    // 老数据搬过去：这里原来填过的城市 / 时区，行程与天气那边还空着就搬过去，搬完这边清空
    function moveToMap() {
        if (!MAP() || (!C.user.place && !C.user.tz)) return;
        const m = MAP();
        if (C.user.place && !m.city && typeof window.gymapSetUserCityText === 'function') window.gymapSetUserCityText(C.user.place);
        if (C.user.tz && !m.tz && typeof window.gymapSetUserTz === 'function') window.gymapSetUserTz(C.user.tz);
        C.user = { place: '', tz: '' }; C.moved = Date.now(); store();
    }
    const placeOf = c => (c && c.timePlace) || {};
    const charTz = c => placeOf(c).tz || userTz();
    const distant = c => { const p = placeOf(c); if (p.distant != null) return !!p.distant; return !!(p.tz && p.tz !== userTz()) || !!(p.place && uPlace() && p.place.trim() !== uPlace()); };

    // ---------- 现在（自定义时间会往后走） ----------
    const customOn = () => senseOn() && C.custom.on && !!C.custom.start && !isNaN(new Date(C.custom.start).getTime());
    function nowMs() {
        if (!customOn()) return Date.now();
        const s = new Date(C.custom.start).getTime();
        return C.custom.frozen ? s : s + Math.max(0, Date.now() - (C.custom.setAt || Date.now()));
    }
    window.gyTimeNow = () => new Date(nowMs());
    window.gyTimeMode = () => !senseOn() ? 'off' : customOn() ? 'custom' : 'real';
    // 某个时区里的墙上时间（拿来显示和写进 prompt）
    function wall(ms, tz) {
        try {
            const p = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
            const g = t => (p.find(x => x.type === t) || {}).value || '';
            return { s: `${g('year')}-${g('month')}-${g('day')} ${g('weekday')} ${g('hour')}:${g('minute')}`, h: +g('hour'), hm: `${g('hour')}:${g('minute')}`, wd: g('weekday') };
        } catch (e) { const d = new Date(ms); return { s: d.toLocaleString('zh-CN', { hour12: false }), h: d.getHours(), hm: d.toTimeString().slice(0, 5), wd: '' }; }
    }
    // 自定义时间以「你这边」为准；TA 那边按两个时区的差换算
    const tzOff = (tz, ms) => { try { const d = new Date(ms); const a = new Date(d.toLocaleString('en-US', { timeZone: tz })); const b = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' })); return a - b; } catch (e) { return 0; } };
    function wallFor(tz) {
        const n = nowMs();
        if (!customOn()) return wall(n, tz);
        // 自定义的「现在」是你那边的墙上时间：先换成 UTC，再换到对方时区
        const local = new Date(n); const wallUser = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes());
        return wall(wallUser - tzOff(userTz(), n), tz);
    }
    const part = h => h < 5 ? '深夜' : h < 9 ? '早上' : h < 12 ? '上午' : h < 14 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜';
    const tzName = tz => (TZS.find(x => x[0] === tz) || [tz, tz])[1];
    const TZS = [['Asia/Shanghai', '北京 / 上海'], ['Asia/Hong_Kong', '香港'], ['Asia/Taipei', '台北'], ['Asia/Tokyo', '东京'], ['Asia/Seoul', '首尔'], ['Asia/Singapore', '新加坡'], ['Asia/Bangkok', '曼谷'], ['Asia/Kolkata', '印度'], ['Asia/Dubai', '迪拜'], ['Europe/Moscow', '莫斯科'], ['Europe/London', '伦敦'], ['Europe/Paris', '巴黎'], ['Europe/Berlin', '柏林'], ['America/New_York', '纽约'], ['America/Chicago', '芝加哥'], ['America/Los_Angeles', '洛杉矶'], ['America/Vancouver', '温哥华'], ['America/Sao_Paulo', '圣保罗'], ['Australia/Sydney', '悉尼'], ['Pacific/Auckland', '奥克兰'], ['UTC', 'UTC']];

    // ---------- 自定义时间：发出去之前把「现在」附近的日期时间换成自定义的 ----------
    const WD = '日一二三四五六';
    const DT_RE = /(\d{4})([\/\-年.])(\d{1,2})([\/\-月.])(\d{1,2})(日|号)?(\s*[（(]?(?:星期|周)[一二三四五六日天][)）]?)?(?:(\s*)(\d{1,2}):(\d{2})(?::(\d{2}))?)?(\s*[（(]?(?:星期|周)[一二三四五六日天][)）]?)?/g;
    const PROT = /\u2066([^\u2069\u2066]*)\u2069/g;
    function shiftText(s, off) {
        if (typeof s !== 'string' || !s) return s;
        if (!off) return s.replace(PROT, '$1');
        const keep = []; s = s.replace(PROT, (m0, a) => { keep.push(a); return '\u2066' + (keep.length - 1) + '\u2069'; });
        return shiftCore(s, off).replace(PROT, (m0, i) => keep[+i]);
    }
    function shiftCore(s, off) {
        const real = Date.now();
        return s.replace(DT_RE, (m0, y, s1, mo, s2, d, dz, wk1, sp, hh, mm, ss, wk2) => {
            const t = new Date(+y, +mo - 1, +d, hh != null ? +hh : 12, mm != null ? +mm : 0, ss != null ? +ss : 0).getTime();
            if (isNaN(t) || Math.abs(t - real) > 400 * 864e5) return m0;     // 离现在一年多的（生日、设定里的年份）不动
            const n = new Date(t + off);
            const p2 = (v, w) => String(v).padStart(w.length, '0');
            const fixWk = w => w ? w.replace(/[一二三四五六日天]/, WD[n.getDay()]) : '';
            let out = `${n.getFullYear()}${s1}${p2(n.getMonth() + 1, mo)}${s2}${p2(n.getDate(), d)}${dz || ''}${fixWk(wk1)}`;
            if (hh != null) out += `${sp || ''}${p2(n.getHours(), hh)}:${p2(n.getMinutes(), mm)}${ss != null ? ':' + p2(n.getSeconds(), ss) : ''}`;
            return out + fixWk(wk2);
        }).replace(/(现在是|今天是)\s*(星期|周)([一二三四五六日天])(?![\d])/g, (m0, a, b) => `${a}${b}${WD[new Date(real + off).getDay()]}`);
    }
    function shiftContent(c, off) {
        if (typeof c === 'string') return shiftText(c, off);
        if (Array.isArray(c)) return c.map(m => {
            if (!m || typeof m !== 'object') return m;
            if (typeof m.content === 'string') return Object.assign({}, m, { content: shiftText(m.content, off) });
            if (Array.isArray(m.content)) return Object.assign({}, m, { content: m.content.map(p => p && p.type === 'text' ? Object.assign({}, p, { text: shiftText(p.text, off) }) : p) });
            return m;
        });
        return c;
    }
    // 差值按整分钟算：各功能写进去的「现在」大多只精确到分钟，秒数会让换算出来的时间差一分钟
    const offMin = () => { const r = Date.now(); return Math.floor(nowMs() / 60000) * 60000 - Math.floor(r / 60000) * 60000; };
    window.gyTimeShift = (c) => customOn() ? shiftContent(c, offMin()) : c;

    // ---------- 每个 TA：各自在哪、那边几点 ----------
    const NUDGE = {};
    window.__gyTimePlaceCtxFor = function (id) {
        const c = charById(id); const out = [];
        if (NUDGE[String(id)]) out.push(`【这次主动找她的由头】${NUDGE[String(id)]}`);
        if (!c) return out.join('\n');
        const p = placeOf(c), up = uPlace(), far = distant(c);
        if (!p.place && !p.tz && !up && !uTz() && !customOn()) return out.join('\n');
        const me = p.place || (far ? '' : up) || '', her = up || '';
        if (!senseOn()) {
            if (me || her) out.push(`【你们各自在哪】${me ? '你在' + me : ''}${me && her ? '，' : ''}${her ? '她在' + her : ''}。${far ? '你们异地，不默认能见面；要见面得先有安排（车票、航班、请假），见面是件事。' : ''}`);
            return out.join('\n');
        }
        // 只精确到「几点多」：这段在系统提示词中间，按分钟变会让后面整段的输入缓存每分钟失效一次
        const co = t => `\u2066${t.s.slice(0, 10)} ${t.wd} ${t.h}点多\u2069`;   // 两头的隐形记号：已经是换算好的时间，发出去前别再换一次
        const tA = wallFor(charTz(c)), tB = wallFor(userTz());
        let s = `【你们各自在哪、那边几点${customOn() ? '（剧情里定的时间）' : ''}】`;
        if (far || charTz(c) !== userTz()) {
            s += `你在${me || tzName(charTz(c))}，你那边现在是 ${co(tA)}（${part(tA.h)}）；她在${her || tzName(userTz())}，她那边是 ${co(tB)}（${part(tB.h)}）。按你那边的白天黑夜过日子，跟她说话时心里知道她那边几点（她那边深夜就别指望她秒回，她刚起床你这边可能已经下午）。`;
            if (far) s += '你们异地，不默认能见面；要见面得先有安排（车票、航班、请假），见面是件事。';
        } else {
            s += `${me || her ? `你们都在${me || her}，` : ''}现在是 ${co(tA)}（${part(tA.h)}）。`;
        }
        out.push(s);
        return out.join('\n');
    };
    try { if (typeof GY_BOX_CTX !== 'undefined' && !GY_BOX_CTX.some(x => x[0] === '__gyTimePlaceCtxFor')) GY_BOX_CTX.push(['__gyTimePlaceCtxFor', '时间与所在地']); } catch (e) {}

    // ---------- 发出去之前：自定义时间换算 ----------
    function hookRewrite() {
        const rw = window.gyTaRewrite; if (rw && rw.__gyTimePlace) return;
        const base = typeof rw === 'function' ? rw : (c => c);
        const w = function () { const c = base.apply(this, arguments); return shiftContent(c, customOn() ? offMin() : 0); };
        if (typeof rw === 'function') Object.keys(rw).forEach(k => { try { w[k] = rw[k]; } catch (e) {} });
        w.__gyTimePlace = true; window.gyTaRewrite = w;
    }

    // ---------- 页面 ----------
    function logIt(t) { C.log.unshift({ id: 'tp' + Date.now().toString(36), at: Date.now(), t: String(t).slice(0, 80) }); C.log = C.log.slice(0, 60); store(); }
    window.gyTimeSetMode = function (m) {
        const was = window.gyTimeMode();
        if (m === 'off') { if (typeof window.gyTimeSenseSet === 'function') window.gyTimeSenseSet(false); C.custom.on = false; }
        else {
            if (!senseOn() && typeof window.gyTimeSenseSet === 'function') window.gyTimeSenseSet(true);
            C.custom.on = m === 'custom';
            if (C.custom.on && !C.custom.start) { const d = new Date(); d.setSeconds(0, 0); C.custom.start = toLocalInput(d); C.custom.setAt = Date.now(); }
        }
        store(); if (was !== window.gyTimeMode()) logIt({ real: '换成真实时间', off: '换成不感知时间', custom: '换成自定义时间' }[window.gyTimeMode()]);
        const say = { real: ['🕰️ 跟着现实时间走', 'TA 知道现在几点'], off: ['🌫️ 不感知时间', '时间只跟着剧情走'], custom: ['📅 用你定的时间', '从那一刻开始往后走'] }[window.gyTimeMode()];
        toast(say[0], say[1]); window.gyTimePlaceOpen(true);
    };
    const toLocalInput = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    window.gyTimeSetCustom = function (v) { if (!v) return; C.custom.start = v; C.custom.setAt = Date.now(); store(); logIt('自定义时间定在 ' + v.replace('T', ' ')); window.gyTimePlaceOpen(true); };
    window.gyTimeFreeze = function (v) {
        if (v && !C.custom.frozen) { C.custom.start = toLocalInput(new Date(nowMs())); }
        if (!v && C.custom.frozen) { C.custom.setAt = Date.now(); }
        C.custom.frozen = !!v; store(); window.gyTimePlaceOpen(true);
    };
    window.gyTimeUser = function (k, v) {
        v = String(v || '').trim();
        if (k === 'tz' && typeof window.gymapSetUserTz === 'function') window.gymapSetUserTz(v);
        else if (k === 'place' && typeof window.gymapSetUserCityText === 'function') window.gymapSetUserCityText(v);
        else { C.user[k] = v; store(); }
        logIt(k === 'tz' ? '你的时区改成 ' + tzName(v || devTz) : '你在 ' + (v || '（没填）')); rerender();
    };
    // 改完重画：在行程与天气的「两地」里改的就重画那一页，在这一页改的就重画这一页
    function rerender() { const mm = document.getElementById('gymapModal'); if (mm && mm.classList.contains('on') && document.getElementById('gymapTab-place') && /on/.test(document.getElementById('gymapTab-place').className)) { try { window.gymapTab('place'); } catch (e) {} } if (document.getElementById('gyTimePlaceOv')) window.gyTimePlaceOpen(true); }
    window.gyTimeChar = function (cid, k, v) {
        const c = charById(cid); if (!c) return; c.timePlace = Object.assign({}, c.timePlace || {});
        if (k === 'distant') c.timePlace.distant = v === '' ? null : v === '1'; else c.timePlace[k] = String(v || '').trim();
        save(); logIt(`${c.name}：${k === 'tz' ? '时区 ' + tzName(v || userTz()) : k === 'place' ? '在 ' + (v || '（没填）') : v === '1' ? '跟你异地' : v === '0' ? '跟你同城' : '异地自动判断'}`); rerender();
    };
    const tzSel = (val, on, def) => `<select class="gytp-in" onchange="${on}">${[['', def]].concat(TZS).map(([v, n]) => `<option value="${esc(v)}"${v === (val || '') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    // 「你的时区 + 每个 TA 在哪」——画在 🗺️ 行程与天气的「🌏 两地」里（你的城市那边自己画）
    window.gyTimePlaceHtml = function () {
        const m = window.gyTimeMode(), tU = wallFor(userTz());
        return `<div class="gytp gytp-inmap"><div class="gytp-sec">你的时区</div><div class="gytp-card"><div class="gytp-row">${tzSel(uTz(), "gyTimeUser('tz',this.value)", '跟手机一样（' + tzName(devTz) + '）')}</div>${m !== 'off' ? `<div class="gytp-tip">你这边现在：${esc(tU.s)}</div>` : ''}${typeof window.gymapUser !== 'function' ? `<div class="gytp-row"><input class="gytp-in" placeholder="城市（比如 上海）" value="${esc(uPlace())}" onchange="gyTimeUser('place',this.value)"></div>` : ''}</div>
            <div class="gytp-sec">每个 TA 在哪 <span class="gytp-tip">不填＝跟你一样</span></div>
            ${chars().map(c => { const p = placeOf(c), t = wallFor(charTz(c)), far = distant(c); return `<div class="gytp-card"><div class="gytp-name">${esc(c.name)} ${far ? '<i class="gytp-far">异地</i>' : ''}${m !== 'off' && (far || charTz(c) !== userTz()) ? `<em>那边 ${esc(t.hm)} · ${part(t.h)}</em>` : ''}</div>
                <div class="gytp-row"><input class="gytp-in" placeholder="城市" value="${esc(p.place || '')}" onchange="gyTimeChar('${esc(c.id)}','place',this.value)">${tzSel(p.tz, `gyTimeChar('${esc(c.id)}','tz',this.value)`, '时区：跟你一样')}
                <select class="gytp-in" onchange="gyTimeChar('${esc(c.id)}','distant',this.value)"><option value=""${p.distant == null ? ' selected' : ''}>异地：自动判断</option><option value="1"${p.distant === true ? ' selected' : ''}>跟你异地</option><option value="0"${p.distant === false ? ' selected' : ''}>跟你同城</option></select></div></div>`; }).join('') || '<div class="gytp-tip">还没有角色。</div>'}
            <div class="gytp-tip" style="margin-top:10px">时区不一样或者标了异地：TA 按自己那边的白天黑夜过，知道你那边几点；不默认能见面。</div></div>`;
    };
    window.gyTimePlaceOpen = function (keep) {
        let ov = document.getElementById('gyTimePlaceOv'); const st = ov ? ov.querySelector('.gytp-box').scrollTop : 0;
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyTimePlaceOv'; ov.className = 'gytp-ov'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
        const m = window.gyTimeMode(), tU = wallFor(userTz());
        const mb = (k, ico, t, d) => `<div class="gytp-mode${m === k ? ' on' : ''}" onclick="gyTimeSetMode('${k}')"><b>${ico} ${t}</b><span>${d}</span></div>`;
        ov.innerHTML = `<div class="gytp-box"><div class="gytp-hd"><b>🕐 时间感知</b><span class="gytp-x" onclick="document.getElementById('gyTimePlaceOv').remove()">✕</span></div>
            <div class="gytp-sec">TA 怎么感知时间</div>
            <div class="gytp-modes">${mb('real', '🕰️', '真实时间', '跟现实走，TA 知道现在几点、隔了多久')}${mb('off', '🌫️', '不感知', '不知道现实里几点几号，时间只跟着剧情走')}${mb('custom', '📅', '自定义时间', '从你定的一刻开始往后走（剧情里的某一天）')}</div>
            ${m === 'custom' ? `<div class="gytp-card"><div class="gytp-row"><span>从</span><input class="gytp-in" type="datetime-local" value="${esc(C.custom.frozen ? C.custom.start : toLocalInput(new Date(nowMs())))}" onchange="gyTimeSetCustom(this.value)"><span>开始</span></div>
                <label class="gytp-row"><input type="checkbox" ${C.custom.frozen ? 'checked' : ''} onchange="gyTimeFreeze(this.checked)"> 停在这一刻（不往后走）</label>
                <div class="gytp-tip">现在剧情里是 <b>${esc(tU.s)}</b>。发给 TA 的内容里，「现在」附近的日期时间都会换成这个；一年以前的日期（生日、设定里的年份）不动。</div></div>` : ''}
            ${m === 'off' ? `<div class="gytp-card gytp-tip">TA 不会看到现在几点、几号，聊天记录也不带「3 小时前」。下面填的所在地照样告诉 TA（只说在哪，不说几点）。</div>` : ''}
            <div class="gytp-sec">你们各自在哪</div>
            ${typeof window.gymapOpenTab === 'function' ? `<div class="gytp-card"><div class="gytp-tip" style="margin:0">你在 <b>${esc(uPlace() || '（还没填）')}</b>${uTz() ? '（' + esc(tzName(uTz())) + '）' : ''}${chars().filter(c => placeOf(c).place || placeOf(c).tz || distant(c)).map(c => `　·　${esc(c.name)} 在 <b>${esc(placeOf(c).place || tzName(charTz(c)))}</b>${distant(c) ? '（异地）' : ''}`).join('')}</div>
            <div class="gytp-row" style="margin-top:8px"><button type="button" class="gytp-go" onclick="document.getElementById('gyTimePlaceOv').remove();gymapOpenTab('place')">在 🗺️ 行程与天气 →「🌏 两地」里改 ›</button></div>
            <div class="gytp-tip">城市、时区、异地都跟天气放在一起了，只存一份。</div></div>` : window.gyTimePlaceHtml()}</div>`;
        if (keep) ov.querySelector('.gytp-box').scrollTop = st;
    };

    // ---------- 设置里的入口 / 小功能 ----------
    function mount() {
        const row = document.getElementById('gyTimeSenseRow');
        if (row && !document.getElementById('gyTimePlaceBtn')) { const a = document.createElement('a'); a.id = 'gyTimePlaceBtn'; a.textContent = '🕐 时间感知 ›'; a.style.cssText = 'margin-left:auto;font-size:13px;color:#1d9bf0;cursor:pointer;white-space:nowrap;'; a.onclick = () => window.gyTimePlaceOpen(); row.appendChild(a); }
        try { if (typeof registerMiniFeature === 'function' && !(typeof GY_MINI_FEATURES !== 'undefined' && GY_MINI_FEATURES.some(f => f.id === 'timePlace'))) registerMiniFeature({ id: 'timePlace', icon: '🕐', title: '时间感知', desc: 'TA 感知真实时间 / 不感知 / 用剧情里定的时间（你们各自在哪个城市、异地时差，在行程与天气的「两地」里）', onOpen: () => window.gyTimePlaceOpen() }); } catch (e) {}
    }

    // ---------- 自主行动：异地的 TA 说说自己那边 ----------
    try {
        if (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && !GY_AUTONOMY_ACTIONS.some(a => a.key === 'time_far_hello')) GY_AUTONOMY_ACTIONS.push({
            key: 'time_far_hello', label: '跟她说说自己那边（异地）', hint: '你那边的天色、刚做完的事；顺便惦记一下她那边几点',
            need: c => senseOn() && distant(c),
            run: async c => {
                if (typeof sendProactiveChatMessage !== 'function') return null;
                const tA = wallFor(charTz(c)), tB = wallFor(userTz());
                NUDGE[String(c.id)] = `你们异地。你这边是${part(tA.h)}（${tA.hm}），她那边是${part(tB.h)}（${tB.hm}）。随手跟她说说你这边此刻的样子（天色、刚做完的事、窗外），顺便惦记一下她那边——别报时，像真人那样带出来`;
                try { await sendProactiveChatMessage(c); logIt(`${c.name} 跟你说了说那边（${tA.hm}）`); return '跟她说了说自己那边'; } catch (e) { return null; } finally { delete NUDGE[String(c.id)]; }
            }
        });
    } catch (e) {}

    // ---------- 今天 / 小组件 / 记忆总览 ----------
    function todayHtml() {
        const L = chars().filter(c => distant(c) || placeOf(c).tz);
        const m = window.gyTimeMode();
        if (!L.length && m === 'real') return '';
        const head = m === 'custom' ? `<div class="gyt-row"><span class="gyt-t">📅 剧情时间</span><span class="gyt-x">${esc(wallFor(userTz()).s)}</span></div>` : m === 'off' ? `<div class="gyt-row"><span class="gyt-t">🌫️ 时间</span><span class="gyt-x">TA 不感知现实时间</span></div>` : '';
        return `<div class="gyt-sec gytp-tsec"><h4>🌏 时间与所在地</h4>${head}${L.slice(0, 4).map(c => { const t = wallFor(charTz(c)); return `<div class="gyt-row click" onclick="gyTimePlaceOpen()"><span class="gyt-t">${esc(c.name)}</span><span class="gyt-x">${esc(placeOf(c).place || tzName(charTz(c)))}${m !== 'off' ? ' · ' + esc(t.hm) + ' ' + part(t.h) : ''}</span></div>`; }).join('')}</div>`;
    }
    function paintToday() { ['gyToday', 'gyTodayM'].forEach(id => { const b = document.getElementById(id); if (!b) return; b.querySelectorAll('.gytp-tsec').forEach(n => n.remove()); const h = todayHtml(); if (h) b.insertAdjacentHTML('beforeend', h); }); }
    function hookToday() {
        const f = window.gyTodayRender; if (typeof f !== 'function' || f.__gyTimePlace) return;
        const w = function () { const r = f.apply(this, arguments); try { paintToday(); } catch (e) {} return r; };
        Object.keys(f).forEach(k => { try { w[k] = f[k]; } catch (e) {} }); w.__gyTimePlace = true; window.gyTodayRender = w;
    }
    function regWidget() {
        const W = window.__gyPmW; if (!W || !W.WD) return false; if (W.WD.gyTimePlaceW) return true;
        W.WD.gyTimePlaceW = { n: '两地时间', sizes: ['s', 'm'], tap: () => window.gyTimePlaceOpen(),
            r: w => {
                const c = charById(window.currentChatSessionId) || chars().find(distant) || chars()[0]; const m = window.gyTimeMode();
                if (m === 'off') return w.size === 's' ? `<div class="gytp-w s"><b>🌫️</b><em>不感知时间</em></div>` : `<div class="gytp-w m"><div class="h"><b>🌏</b><span>${c ? esc(c.name) : 'TA'}</span></div><em>${c ? esc(placeOf(c).place || '跟你一样') : ''} · 不感知时间</em></div>`;
                const tB = wallFor(userTz()), tA = c ? wallFor(charTz(c)) : tB;
                if (w.size === 's') return `<div class="gytp-w s"><b>${m === 'custom' ? '📅' : '🌏'}</b><em>${esc(tA.hm)}</em></div>`;
                return `<div class="gytp-w m"><div class="h"><b>${m === 'custom' ? '📅' : '🌏'}</b><span>两地时间</span></div><div class="two"><div><i>你</i><strong>${esc(tB.hm)}</strong><small>${esc(uPlace() || tzName(userTz()))}</small></div><div><i>${c ? esc(c.name) : 'TA'}</i><strong>${esc(tA.hm)}</strong><small>${c ? esc(placeOf(c).place || tzName(charTz(c))) : ''}</small></div></div></div>`;
            } };
        return true;
    }
    function regMem() {
        if (typeof window.gyMemExAdd !== 'function') return false;
        window.gyMemExAdd({ k: 'gyTimePlace', ico: '🌏', n: '时间与所在地', d: 'TA 在哪个城市（改这里就是改 TA 在哪）', on: () => true,
            items: c => { const p = placeOf(c); return p.place || p.tz || p.distant != null ? [Object.assign({ __c: c }, p)] : []; },
            text: x => x.place || '', edit: (x, v) => { const c = x.__c; c.timePlace = Object.assign({}, c.timePlace || {}, { place: String(v || '').trim() }); },
            del: c => { delete c.timePlace; },
            meta: x => (x.tz ? '时区 ' + tzName(x.tz) : '时区跟你一样') + (x.distant === true ? ' · 异地' : x.distant === false ? ' · 同城' : ''), save });
        return true;
    }

    const css = document.createElement('style'); css.id = 'gyTimePlaceCss';
    css.textContent = `.gytp-ov{position:fixed;inset:0;z-index:100040;background:rgba(0,0,0,.32);display:flex;align-items:center;justify-content:center;padding:14px}
.gytp-box{background:#fff;color:#1d1d1f;border-radius:20px;width:min(580px,100%);max-height:92vh;overflow:auto;padding:0 18px 18px;box-sizing:border-box;box-shadow:0 24px 60px rgba(0,0,0,.2)}
.gytp-hd{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px 0 10px;background:rgba(255,255,255,.94);font-size:17px}.gytp-x{cursor:pointer;color:#999;padding:2px 6px}
.gytp-sec{font-size:13px;font-weight:700;color:#536471;margin:14px 0 6px}
.gytp-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}@media(max-width:520px){.gytp-modes{grid-template-columns:1fr}}
.gytp-mode{border:1.5px solid rgba(0,0,0,.08);border-radius:14px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px}.gytp-mode span{font-size:12px;color:#7b8794;line-height:1.5}
.gytp-mode.on{border-color:var(--gy-accent,#1d9bf0);background:rgba(var(--gy-accent-rgb,29,155,240),.06)}
.gytp-card{border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:10px 12px;margin-top:8px}
.gytp-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0;font-size:13px}
.gytp-in{flex:1;min-width:120px;padding:7px 10px;border-radius:10px;border:1px solid rgba(0,0,0,.12)!important;background:#fff;font-size:13px}
.gytp-tip{font-size:12px;color:#7b8794;line-height:1.6;margin-top:4px}.gytp-name{font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px}.gytp-name em{font-style:normal;font-weight:400;font-size:12px;color:#7b8794;margin-left:auto}
.gytp-go{padding:8px 14px;border-radius:12px;border:none;background:#1d1d1f;color:#fff;cursor:pointer;font-family:inherit;font-size:13px}.gytp-inmap .gytp-sec:first-child{margin-top:4px}
.gytp-far{font-style:normal;font-size:11px;padding:1px 8px;border-radius:9px;background:#fff0f5;color:#d63384;font-weight:500}
body.dark-theme .gytp-box{background:#16181c;color:#e7e9ea}body.dark-theme .gytp-hd{background:rgba(22,24,28,.94)}body.dark-theme .gytp-in{background:#0d0f12;color:#e7e9ea}
.gytp-w{height:100%;display:flex;flex-direction:column;justify-content:center;padding:10px;box-sizing:border-box}.gytp-w.s{align-items:center;gap:4px}.gytp-w.s b{font-size:24px}.gytp-w.s em{font-style:normal;font-size:13px;font-weight:700}
.gytp-w.m .h{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.8}.gytp-w.m em{font-style:normal;font-size:13px;margin-top:6px}
.gytp-w .two{display:flex;gap:10px;margin-top:6px}.gytp-w .two>div{flex:1;display:flex;flex-direction:column}.gytp-w .two i{font-style:normal;font-size:11px;opacity:.7}.gytp-w .two strong{font-size:20px}.gytp-w .two small{font-size:10.5px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
    (document.head || document.documentElement).appendChild(css);

    let memOk = false, wOk = false;
    function tick() { hookRewrite(); hookToday(); mount(); moveToMap(); if (!memOk) memOk = regMem(); if (!wOk) wOk = regWidget(); }
    tick(); setInterval(tick, 3000);
})();
