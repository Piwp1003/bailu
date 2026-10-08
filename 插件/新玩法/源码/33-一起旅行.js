/* ✈️ 一起旅行：和 TA 一起计划一趟好几天的旅行——定目的地和日子，TA 帮你排每天的行程、列要带的东西；出发那几天 TA 每天陪你走，到了地方会说话；回来还有一份旅行手账（原来的「约出去」只能去一个地点，这个是整趟旅行） */
if (window.__gyxTrip) return; window.__gyxTrip = 1;
X.feat('gyxTrip', { n: '✈️ 一起旅行', desc: '计划好几天的旅行，TA 排行程、出发后每天陪你' });
const S = X.store('trip');
let D = { trips: [] };   // {id, cid, to, start, days, plan:[{d, title, items:[{t, what}]}], pack:[{t, ok}], notes:[{d, by, t, at}], said:{}, at}
const dk = d => X.day(d);
const pd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const dayIdx = (t, now) => { const n = new Date(now || Date.now()); n.setHours(0, 0, 0, 0); return Math.round((n - pd(t.start)) / 86400000); };   // 0 = 第一天
const state = t => { const i = dayIdx(t); return i < 0 ? 'before' : i < t.days ? 'on' : 'after'; };
async function plan(c, t) {
    if (X.bailu()) {
        const A = ['睡到自然醒，找家早餐店', '去当地最有名的地方走走', '逛一条老街', '吃当地的小吃', '找个地方看日落', '晚上散步回酒店', '去一家咖啡馆坐坐', '逛菜市场', '去博物馆', '买点小纪念品'];
        t.plan = Array.from({ length: t.days }, (_, i) => ({ d: i + 1, title: i === 0 ? '出发 & 到达' : i === t.days - 1 ? '最后一天 & 回家' : '第 ' + (i + 1) + ' 天', items: [['09:00', X.pick(A)], ['13:00', X.pick(A)], ['18:00', X.pick(A)]].map(([a, b]) => ({ t: a, what: b })) }));
        t.pack = ['身份证', '充电器', '换洗衣服', '牙刷', '雨伞', '常用药'].map(x => ({ t: x, ok: false }));
        t.hi = X.cards(['旅行', '聊天'], c, 1)[0] || '好期待和你一起去。';
        return t;
    }
    const j = X.json(await X.ask(`${X.who(c)}\n你们要一起去「${t.to}」旅行 ${t.days} 天，${t.start} 出发。${t.want ? '她想：' + t.want + '。' : ''}\n最近聊天：\n${X.recent(c, 8)}\n\n按你的性格帮你们排行程（每天 3~5 项，具体到地方/吃什么，别太赶），再列一张要带的东西清单（按目的地和季节），最后用你的口吻说一句对这趟旅行的期待。\n只输出 JSON：{"plan":[{"d":1,"title":"这天的主题","items":[{"t":"09:00","what":"做什么"}]}],"pack":["要带的"],"hi":"一句话"}`));
    t.plan = (j && Array.isArray(j.plan) ? j.plan : []).slice(0, t.days).map((p, i) => ({ d: i + 1, title: String(p.title || '第 ' + (i + 1) + ' 天'), items: (p.items || []).map(x => ({ t: String(x.t || ''), what: String(x.what || '') })) }));
    while (t.plan.length < t.days) t.plan.push({ d: t.plan.length + 1, title: '自由活动', items: [] });
    t.pack = (j && j.pack || ['身份证', '充电器', '换洗衣服']).map(x => ({ t: String(x), ok: false }));
    t.hi = (j && j.hi) || '好期待和你一起去。';
    return t;
}
window.gyxTripNew = async function (o) {
    o = o || {}; const g = id => ((document.getElementById(id) || {}).value || '').trim();
    const to = o.to || g('gyxTpTo'), start = o.start || g('gyxTpSt'), days = +(o.days || g('gyxTpDy') || 3), want = o.want != null ? o.want : g('gyxTpWt');
    const c = X.char(o.cid || window.GYX_TRIP_WHO) || X.cur(); if (!c) return null;
    if (!to || !start) { X.toast(X.v('目的地和出发日子都要填', '还差一点', '去哪儿？哪天走？')); return null; }
    const btn = document.getElementById('gyxTpGo'); if (btn) { btn.disabled = true; btn.textContent = X.v('TA 在排行程……', 'TA 在翻攻略……'); }
    const t = await plan(c, { id: 'tp' + Date.now(), cid: String(c.id), to, start, days: Math.max(1, days), want, notes: [], said: {}, at: Date.now() });
    D.trips.unshift(t); await S.set('d', D);
    X.say(c, `✈️ ${t.hi}`);
    window.gyxTripOpen(t.id); return t;
};
window.gyxTripPack = async (id, i) => { const t = D.trips.find(x => x.id === id); if (!t) return; t.pack[i].ok = !t.pack[i].ok; await S.set('d', D); };
window.gyxTripNote = async id => { const t = D.trips.find(x => x.id === id), v = ((document.getElementById('gyxTpN') || {}).value || '').trim(); if (!t || !v) return; const d = Math.min(t.days, Math.max(1, dayIdx(t) + 1)); t.notes.push({ d, by: 'me', t: v, at: Date.now() }); await S.set('d', D); const c = X.char(t.cid); if (c) X.reach(c, `你们正在「${t.to}」旅行（第 ${d} 天），她在旅行手账里写了：「${v}」，回应她`); window.gyxTripOpen(id); };
window.gyxTripDel = async id => { D.trips = D.trips.filter(x => x.id !== id); await S.set('d', D); window.gyxTripOpen(); };
window.GYX_TRIP_WHO = '';
window.gyxTripWho = v => { window.GYX_TRIP_WHO = v; };
window.gyxTripOpen = function (id) {
    const t = id && D.trips.find(x => x.id === id);
    if (!t) {
        window.GYX_TRIP_WHO = String((X.cur() || {}).id || '');
        const tm = new Date(Date.now() + 7 * 86400000);
        X.panel('gyxTpOv', '✈️ 一起旅行', `${D.trips.map(x => `<div class="tp-it" onclick="gyxTripOpen('${x.id}')"><b>${X.esc(x.to)}</b><span>${x.start} · ${x.days} 天 · 和 ${X.esc(X.name(X.char(x.cid)))}</span><em>${{ before: (-dayIdx(x)) + ' 天后出发', on: '旅行中 · 第 ' + (dayIdx(x) + 1) + ' 天', after: '回来了' }[state(x)]}</em></div>`).join('') || '<div class="gyx-tip">还没有旅行。想和 TA 去哪儿？</div>'}
            <div class="gyx-card"><div class="gyx-tip">计划一趟新旅行</div><div class="gyx-row"><input id="gyxTpTo" class="gyx-who" placeholder="去哪儿（比如：大理）" style="flex:2"><input id="gyxTpDy" class="gyx-who" type="number" min="1" value="3" style="width:64px"> 天</div>
            <div class="gyx-row">出发：<input id="gyxTpSt" class="gyx-who" type="date" value="${dk(tm)}"> 和谁：${X.whoSel(window.GYX_TRIP_WHO, 'gyxTripWho')}</div><input id="gyxTpWt" class="gyx-in" placeholder="想怎么玩（可空）：比如想看海、想吃好吃的、别太累"><div class="gyx-row"><button id="gyxTpGo" class="gyx-btn" onclick="gyxTripNew()">让 TA 排行程</button></div></div>`);
        return;
    }
    const st = state(t), cur = dayIdx(t);
    X.panel('gyxTpOv', '✈️ ' + X.esc(t.to), `<div class="tp-hd"><b>${X.esc(t.to)}</b><span>${t.start} 出发 · ${t.days} 天 · 和 ${X.esc(X.name(X.char(t.cid)))}</span><em>${{ before: '还有 ' + (-cur) + ' 天出发', on: '旅行中 · 第 ' + (cur + 1) + ' 天', after: '旅行结束啦' }[st]}</em></div>
        ${t.plan.map((p, i) => `<div class="tp-day${st === 'on' && i === cur ? ' now' : ''}"><div class="tp-dn">Day ${p.d}<small>${dk(new Date(pd(t.start).getTime() + i * 86400000)).slice(5)}</small></div><div><b>${X.esc(p.title)}</b>${p.items.map(x => `<p><i>${X.esc(x.t)}</i>${X.esc(x.what)}</p>`).join('')}${t.notes.filter(n => n.d === p.d).map(n => `<p class="tp-n">${n.by === 'me' ? '我' : X.esc(X.name(X.char(n.by)))}：${X.esc(n.t)}</p>`).join('')}</div></div>`).join('')}
        <div class="gyx-card"><div class="gyx-tip">要带的东西</div>${t.pack.map((x, i) => `<label class="tp-pk"><input type="checkbox" ${x.ok ? 'checked' : ''} onchange="gyxTripPack('${t.id}',${i})"> ${X.esc(x.t)}</label>`).join('')}</div>
        ${st !== 'before' ? `<div class="gyx-row"><input id="gyxTpN" class="gyx-in" style="flex:1" placeholder="在旅行手账里写一句"><button class="gyx-btn" onclick="gyxTripNote('${t.id}')">写下</button></div>` : ''}
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxTripOpen()">← 所有旅行</button><button class="gyx-btn lite" onclick="gyxTripDel('${t.id}')">删掉这趟</button></div>`);
};
window.gyxTripData = () => D;
// 旅行前三天、出发那几天每天，TA 会来说话
async function daily(c, t) {
    const st = state(t), i = dayIdx(t), k = st + ':' + X.day();
    if (t.said[k]) return null; t.said[k] = 1; await S.set('d', D);
    if (st === 'before' && -i <= 3) return X.reach(c, `再过 ${-i} 天你们就要去「${t.to}」旅行了，提醒她收拾东西（清单里还有 ${t.pack.filter(x => !x.ok).length} 样没勾）、说说你的期待`);
    if (st === 'on') { const p = t.plan[i] || {}, txt = `你们正在「${t.to}」旅行，今天是第 ${i + 1} 天「${p.title || ''}」，安排是：${(p.items || []).map(x => x.t + ' ' + x.what).join('；')}。像真的和她在一起旅行那样跟她说话（今天去哪、看到什么、你的感受）`; const r = await X.reach(c, txt); if (r) t.notes.push({ d: i + 1, by: String(c.id), t: X.v('今天也很开心', '想把今天记下来', '和你一起真好'), at: Date.now() }); await S.set('d', D); return r; }
    if (st === 'after' && i === t.days) return X.reach(c, `你们刚从「${t.to}」旅行回来，回味一下这趟旅行最难忘的瞬间`);
    return null;
}
async function tick() { if (!X.on('gyxTrip')) return; const h = new Date().getHours(); if (h < 8 || h > 22) return; for (const t of D.trips) { const c = X.char(t.cid); if (!c || X.auto(c)) continue; await daily(c, t); } }
X.action({ key: 'gyx_trip', label: '聊聊你们计划的旅行 / 旅行中陪她 / 提议一起去旅行', hint: '想和她出去走走', need: () => true,
    run: async c => { const t = D.trips.find(x => x.cid === String(c.id) && state(x) !== 'after'); if (t) return (await daily(c, t)) ? '聊了聊你们的旅行' : null; return (await X.reach(c, '你突然很想和她一起去旅行，说说你想去哪、为什么（她可以在「一起旅行」里定下来）')) ? '想和你去旅行' : null; } }, 'gyxTrip');
X.ctx(id => { const t = D.trips.find(x => x.cid === String(id) && state(x) !== 'after') || D.trips.find(x => x.cid === String(id)); if (!t) return ''; const st = state(t), i = dayIdx(t); return `【你们的旅行】去「${t.to}」${t.days} 天，${t.start} 出发。` + (st === 'before' ? `还有 ${-i} 天出发。` : st === 'on' ? `现在正在旅行，第 ${i + 1} 天：${(t.plan[i] || {}).title || ''}。` : '已经回来了。'); }, 'gyxTrip');
X.today(() => ({ title: '✈️ 旅行', rows: D.trips.filter(t => state(t) !== 'after').map(t => { const st = state(t), i = dayIdx(t); return { t: st === 'on' ? 'Day ' + (i + 1) : (-i) + ' 天后', x: st === 'on' ? `${X.esc(t.to)}：${X.esc((t.plan[i] || {}).title || '')}` : `和 ${X.esc(X.name(X.char(t.cid)))} 去${X.esc(t.to)}`, go: `gyxTripOpen('${t.id}')` }; }) }), 'gyxTrip');
X.widget('gyxTripW', { n: '一起旅行', sizes: ['s', 'm'], tap: () => { const t = D.trips.find(x => state(x) !== 'after'); window.gyxTripOpen(t && t.id); }, r: w => { const t = D.trips.find(x => state(x) !== 'after'); if (!t) return X.gw(w, '✈️', '一起旅行', ['想去哪儿？']); const st = state(t), i = dayIdx(t); return X.gw(w, '✈️', '一起旅行', [st === 'on' ? '第 ' + (i + 1) + ' 天' : (-i) + ' 天后出发', X.esc(t.to), st === 'on' ? X.esc((t.plan[i] || {}).title || '') : '']); } }, 'gyxTrip');
X.css('gyxTpCss', `.tp-it{padding:12px 14px;border-radius:16px;background:#f0f7ff;margin:8px 0;cursor:pointer}.tp-it b{font-size:17px}.tp-it span{display:block;font-size:12.5px;color:#888}.tp-it em{font-style:normal;font-size:12.5px;color:#3a86ff}
.tp-hd{padding:16px;border-radius:20px;background:linear-gradient(135deg,#a0c4ff,#caffbf);margin-bottom:8px}.tp-hd b{font-size:24px;display:block}.tp-hd span{font-size:13px;color:#335}.tp-hd em{display:block;font-style:normal;margin-top:4px;font-weight:600;color:#1d3557}
.tp-day{display:flex;gap:12px;padding:10px 4px;border-bottom:1px dashed #e6e6ea}.tp-day.now{background:#fffbe6;border-radius:12px}.tp-dn{width:54px;flex-shrink:0;font-weight:700;color:#3a86ff;font-size:14px}.tp-dn small{display:block;font-weight:normal;color:#aaa;font-size:11px}.tp-day b{font-size:15px}.tp-day p{margin:4px 0;font-size:13.5px}.tp-day p i{font-style:normal;color:#999;margin-right:8px;font-size:12px}.tp-day p.tp-n{color:#8e4ec6}
.tp-pk{display:inline-block;margin:4px 10px 4px 0;font-size:13.5px}`);
X.mini({ id: 'gyxTrip', icon: '✈️', title: '一起旅行', desc: '计划好几天的旅行：TA 排行程、列清单，出发后每天陪你', onOpen: () => window.gyxTripOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.trips = D.trips || []; setTimeout(tick, 40000); setInterval(tick, 30 * 60000); })();
X.memArr({ k: 'gyxTrip', ico: '✈️', n: '一起去的旅行', d: '目的地（行程在旅行里看）', arr: () => D.trips, text: x => x.to, field: 'to', meta: x => x.start + ' · ' + x.days + ' 天 · 手账 ' + (x.notes || []).length + ' 条', save: () => S.set('d', D) }, 'gyxTrip');
