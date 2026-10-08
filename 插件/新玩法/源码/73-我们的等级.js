/* 📈 我们的等级：你们一起做的每件事都会涨经验——聊天、散步、合照、哄好 TA、答每日一问、通关寻宝……攒够了就升级、解锁新称号，每升 5 级 TA 还会送一份礼物。经验从哪来的一项项都列着 */
if (window.__gyxLevel) return; window.__gyxLevel = 1;
X.feat('gyxLevel', { n: '📈 我们的等级', desc: '一起做的每件事都涨经验，升级解锁称号和礼物，把所有玩法串起来' });
const S = X.store('level');
let D = { lv: {}, log: [], cust: {} };   // cust[cid]：你（或 TA）改过的称号、经验权重、升级快慢、礼物   // lv[cid] = 上次看到的等级；log = [{cid, lv, at, title, gift}]
const TITLES0 = [[1, '刚认识'], [3, '有点熟了'], [5, '聊得来'], [8, '偷偷心动'], [12, '暧昧期'], [16, '正式交往'], [20, '甜蜜期'], [25, '形影不离'], [30, '老夫老妻预备役'], [36, '灵魂伴侣'], [42, '命中注定'], [50, '宇宙级恋人'], [60, '传说中的那一对']];
// ✏️ 自定义（每个 TA 一套）：称号、每样事情值多少经验（也能关掉）、升级快慢、几级送一次礼物、礼物有哪些、自己加的经验来源（某句话说一次加多少）
const GIFTS0 = ['抱抱券', '任性一次券', '陪聊到天亮券', '撒娇券', '免罚券'];
const CURVES = { fast: ['快', 60, 25], normal: ['正常', 100, 40], slow: ['慢', 150, 60] };
const custOf = cid => { const C = (D.cust[String(cid)] = D.cust[String(cid)] || {}); C.w = C.w || {}; C.off = C.off || {}; C.extra = C.extra || []; return C; };
const TITLES = cid => { const t = cid != null && custOf(cid).titles; return Array.isArray(t) && t.length ? t.slice().sort((a, b) => a[0] - b[0]) : TITLES0; };
const titleOf = (lv, cid) => { const L = TITLES(cid).filter(t => lv >= t[0]); return (L.pop() || TITLES(cid)[0] || [1, ''])[1]; };
const need = (lv, cid) => { const k = CURVES[cid != null && custOf(cid).curve] || CURVES.normal; return k[1] + k[2] * (lv - 1); };   // 从 lv 升到 lv+1 要多少经验
function levelOf(exp, cid) { let lv = 1, left = exp; while (left >= need(lv, cid)) { left -= need(lv, cid); lv++; } return { lv, cur: left, next: need(lv, cid) }; }
const giftEvery = cid => Math.max(1, +custOf(cid).every || 5), giftsOf = cid => { const g = custOf(cid).gifts; return Array.isArray(g) && g.length ? g : GIFTS0; };
const g = (f, d) => { try { const v = f(); return isFinite(v) ? v : d; } catch (e) { return d; } };
function sources(c) {
    const cid = String(c.id), L = ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side), days = new Set(L.filter(m => m.timestamp).map(m => X.day(new Date(m.timestamp)))).size;
    const arr = (f) => g(() => f().length, 0);
    return [
        ['💬', '说过的话', L.length, 1], ['📅', '聊天的天数', days, 15],
        ['🚶', '一起散步（公里）', g(() => window.gyxWalkData().walks.filter(x => x.cid === cid).reduce((a, x) => a + x.dist, 0) / 1000, 0), 20], ['📸', '合照', arr(() => window.gyxDuoData().pics.filter(x => x.cid === cid)), 30],
        ['🥺', '哄好 TA', arr(() => window.gyxCoaxData().log.filter(x => x.cid === cid)), 60], ['🤙', '吵架又和好', arr(() => window.gyxMakeupData().log.filter(x => x.cid === cid)), 60],
        ['🤞', '做到的约定', arr(() => window.gyxPromiseData().list.filter(x => x.cid === cid && x.done === true)), 20], ['💞', '答对的默契题', arr(() => window.gyxQuizData().log.filter(x => x.cid === cid && x.ok)), 10],
        ['🌅', '每日一问', g(() => Object.values(window.gyxDailyData().days[cid] || {}).filter(x => x.me).length, 0), 15], ['🕯️', '睡前三件好事', g(() => Object.values(window.gyxGoodData().days[cid] || {}).filter(x => x.me).length, 0), 15],
        ['🗺️', '通关寻宝', arr(() => window.gyxHuntData().log.filter(x => x.cid === cid)), 100], ['🧭', '打通冒险', arr(() => window.gyxQuestData().log.filter(x => x.cid === cid)), 80],
        ['🏃', '一起运动', arr(() => window.gyxCoachData().log.filter(x => x.cid === cid)), 25], ['🎵', 'TA 写的歌', arr(() => window.gyxSongData().list.filter(x => x.cid === cid)), 50],
        ['🧾', '审批单', arr(() => window.gyxOAData().list.filter(x => x.cid === cid && x.res)), 10],
        ['📋', '问卷', arr(() => window.gyxSurveyData().res.filter(x => x.cid === cid)), 20], ['🎟️', '兑换过的券', arr(() => window.gyxCouponData().list.filter(x => x.cid === cid && x.used)), 15],
        ['🏅', '解锁的成就', g(() => Object.keys(window.gyxBadgeData().got[cid] || {}).length, 0), 40], ['🍁', '捡到的小东西', g(() => Object.values(window.gyxDropData().got[cid] || {}).reduce((a, x) => a + x.n, 0), 0), 5],
        ['🎨', '表情包', arr(() => window.gyxMemeData().list.filter(x => x.cid === cid)), 10], ['📼', '磁带', g(() => window.gyxTapeData ? window.gyxTapeData().tapes.filter(x => x.cid === cid).length : 0, 0), 20]
    ].concat(custOf(cid).extra.map(x => { const re = (() => { const L = String(x.kw || '').split(/[|｜/、,，]/).map(t => t.trim()).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return new RegExp(L.length ? L.join('|') : '(?!)'); })(); return [x.ico || '✨', x.n || ('说「' + x.kw + '」'), L.filter(m => (x.who === 'me' ? m.sender === 'me' : x.who === 'ta' ? m.sender !== 'me' : true) && re.test(X.plain(m.text))).length, +x.w || 1, x.id]; }))
     .map(([ico, n, v, w, id]) => { const C = custOf(cid), ww = id ? w : (C.w[n] != null ? +C.w[n] : w); return { ico, n, v: Math.floor(v * 10) / 10, w: ww, w0: w, id, off: !id && !!C.off[n], exp: !id && C.off[n] ? 0 : Math.floor(v * ww) }; });
}
const expOf = c => sources(c).reduce((a, s) => a + s.exp, 0);
async function check(c, quiet) {
    const cid = String(c.id), L = levelOf(expOf(c), cid), was = D.lv[cid];
    if (was == null || quiet) { D.lv[cid] = L.lv; await S.set('d', D); return null; }
    if (L.lv <= was) return null;
    D.lv[cid] = L.lv; const title = titleOf(L.lv, cid), titleNew = titleOf(was, cid) !== title, gift = Math.floor(L.lv / giftEvery(cid)) > Math.floor(was / giftEvery(cid));
    let giftName = '';
    if (gift) { giftName = X.pick(giftsOf(cid)); try { window.gyxCouponData().list.unshift({ id: 'cp' + Date.now().toString(36), cid, from: 'ta', name: giftName, desc: `Lv.${L.lv} 的升级礼物`, at: Date.now(), used: null }); } catch (e) { giftName = ''; } }
    D.log.unshift({ cid, lv: L.lv, from: was, at: Date.now(), title: titleNew ? title : '', gift: giftName }); await S.set('d', D);
    X.notify(c, `📈 ${X.v('升级啦', '叮——等级提升', '你们又近了一点')}：Lv.${L.lv}${titleNew ? ' · 「' + title + '」' : ''}`, giftName ? `TA 送了你一张「${giftName}」` : '和 ' + X.name(c), () => window.gyxLevelOpen(cid));
    return D.log[0];
}
async function tick() { if (!X.on('gyxLevel')) return; for (const c of X.chars()) await check(c); }
window.gyxLevelCheck = async cid => { const c = X.char(cid) || X.cur(); return check(c); };
window.gyxLevelData = () => D;
window.gyxLevelInfo = cid => { const c = X.char(cid) || X.cur(); const e = expOf(c), L = levelOf(e, c.id); return Object.assign({ exp: e, title: titleOf(L.lv, c.id) }, L); };
let TAB = 'lv';
window.gyxLevelTab = (cid, t) => { TAB = t; window.gyxLevelOpen(cid); };
window.gyxLevelOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), S2 = sources(c), e = S2.reduce((a, s) => a + s.exp, 0), L = levelOf(e, cid), pct = Math.round(L.cur / L.next * 100), ge = giftEvery(cid);
    const tabs = `<div class="gyx-row">${X.whoSel(cid, 'gyxLevelOpen')}<span class="gyx-chip${TAB === 'lv' ? ' on' : ''}" onclick="gyxLevelTab('${cid}','lv')">等级</span><span class="gyx-chip${TAB === 'edit' ? ' on' : ''}" onclick="gyxLevelTab('${cid}','edit')">✏️ 自定义</span></div>`;
    if (TAB === 'edit') return X.panel('gyxLvOv', '📈 我们的等级', tabs + editHtml(c, S2));
    X.panel('gyxLvOv', '📈 我们的等级', `${tabs}
        <div class="lv-hero"><div class="lv-ring" style="--p:${pct}"><b>Lv.${L.lv}</b></div><div><div class="lv-t">「${X.esc(titleOf(L.lv, cid))}」</div><div class="gyx-tip">${X.esc(X.name(c))} & ${X.esc(X.me(c))} · 总经验 ${e}</div><div class="lv-bar"><i style="width:${pct}%"></i></div><div class="gyx-tip">再 ${L.next - L.cur} 经验升到 Lv.${L.lv + 1}${Math.floor((L.lv + 1) / ge) > Math.floor(L.lv / ge) ? ' · 🎁 有礼物' : ''}</div></div></div>
        <div class="lv-h">经验从哪来</div><div class="lv-src">${S2.filter(s => s.v > 0 && !s.off).sort((a, b) => b.exp - a.exp).map(s => `<div><span>${X.esc(s.ico)} ${X.esc(s.n)}</span><em>${s.v} × ${s.w}</em><b>+${s.exp}</b></div>`).join('') || '<div class="gyx-tip">一起做点什么吧</div>'}</div>
        <div class="lv-h">称号${custOf(cid).by === 'ta' ? `<span class="gyx-tip" style="font-weight:400;margin-left:6px">${X.esc(X.name(c))} 起的</span>` : ''}</div><div class="lv-tt">${TITLES(cid).map(([l, t]) => `<span class="${L.lv >= l ? 'on' : ''}">Lv.${l} ${L.lv >= l ? X.esc(t) : '？？？'}</span>`).join('')}</div>
        ${D.log.filter(x => x.cid === cid).length ? `<div class="lv-h">升级记录</div>${D.log.filter(x => x.cid === cid).slice(0, 12).map(x => `<div class="gyx-tip">${new Date(x.at).toLocaleDateString()} · Lv.${x.from} → Lv.${x.lv}${x.title ? ' · 解锁「' + X.esc(x.title) + '」' : ''}${x.gift ? ' · 🎁 ' + X.esc(x.gift) : ''}</div>`).join('')}` : ''}`);
};
function editHtml(c, S2) {
    const cid = String(c.id), C = custOf(cid), E = X.esc;
    return `<div class="gyx-tip">每个 TA 一套。改了以后等级会按新的规矩重新算，已经得到的礼物不会收回。</div>
        <div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='${E(X.name(c))} 在想…';gyxLevelTaSet('${cid}')">🪄 让 ${E(X.name(c))} 来起称号和礼物</button><span class="gyx-chip" onclick="gyxLevelReset('${cid}')">全部恢复默认</span></div>
        <div class="lv-h">称号（第几级解锁什么）</div>
        ${TITLES(cid).map(([l, t], i) => `<div class="gyx-row lv-er"><span>Lv.</span><input class="gyx-who" type="number" min="1" style="width:66px" value="${l}" onchange="gyxLevelTitle('${cid}',${i},'lv',this.value)"><input class="gyx-who" style="flex:1" value="${E(t)}" onchange="gyxLevelTitle('${cid}',${i},'t',this.value)"><i class="lv-x" onclick="gyxLevelTitle('${cid}',${i},'del')">删</i></div>`).join('')}
        <div class="gyx-row"><span class="gyx-chip" onclick="gyxLevelTitle('${cid}',-1,'add')">＋ 加一个称号</span></div>
        <div class="lv-h">升级快慢 · 礼物</div>
        <div class="gyx-row">${Object.entries(CURVES).map(([k, v]) => `<span class="gyx-chip${(C.curve || 'normal') === k ? ' on' : ''}" onclick="gyxLevelCfg('${cid}','curve','${k}')">${v[0]}</span>`).join('')}<span class="gyx-tip">每 <input class="gyx-who" type="number" min="1" style="width:56px" value="${giftEvery(cid)}" onchange="gyxLevelCfg('${cid}','every',this.value)"> 级送一次礼物</span></div>
        <input class="gyx-in" placeholder="礼物有哪些，用 / 隔开" value="${E(giftsOf(cid).join(' / '))}" onchange="gyxLevelCfg('${cid}','gifts',this.value)">
        <div class="lv-h">每样事值多少经验（0＝不算）</div>
        <div class="lv-src lv-w">${S2.filter(s => !s.id).map(s => `<div><span>${E(s.ico)} ${E(s.n)}</span><em>${s.v}</em><input class="gyx-who" type="number" min="0" style="width:64px" value="${s.off ? 0 : s.w}" onchange="gyxLevelW('${cid}','${E(s.n)}',this.value)"></div>`).join('')}</div>
        <div class="lv-h">自己加的经验来源（聊天里说一次某句话就加经验）</div>
        ${C.extra.map(x => `<div class="gyx-row lv-er"><input class="gyx-who" style="width:46px;text-align:center" value="${E(x.ico || '✨')}" onchange="gyxLevelEx('${cid}','${x.id}','ico',this.value)"><input class="gyx-who" style="flex:1;min-width:80px" placeholder="哪句话（几个用 / 隔开）" value="${E(x.kw || '')}" onchange="gyxLevelEx('${cid}','${x.id}','kw',this.value)"><select class="gyx-who" onchange="gyxLevelEx('${cid}','${x.id}','who',this.value)">${[['any', '谁说都算'], ['me', '你说'], ['ta', 'TA 说']].map(([k, t]) => `<option value="${k}"${(x.who || 'any') === k ? ' selected' : ''}>${t}</option>`).join('')}</select><span class="gyx-tip">+</span><input class="gyx-who" type="number" min="1" style="width:56px" value="${+x.w || 1}" onchange="gyxLevelEx('${cid}','${x.id}','w',this.value)"><i class="lv-x" onclick="gyxLevelEx('${cid}','${x.id}','del')">删</i></div>`).join('')}
        <div class="gyx-row"><span class="gyx-chip" onclick="gyxLevelEx('${cid}','','add')">＋ 加一个</span></div>`;
}
const keepScroll = cid => { const b = document.querySelector('#gyxLvOv .gyx-box') || document.querySelector('#gyHubOv .gyhb-box') || document.querySelector('#gyHubOv .gyp-box'); const t = b ? b.scrollTop : 0; window.gyxLevelOpen(cid); if (b) b.scrollTop = t; };
const saveRe = async (cid, redraw) => { await S.set('d', D); if (redraw !== false) keepScroll(cid); };
window.gyxLevelTitle = async (cid, i, k, v) => { const C = custOf(cid); C.titles = TITLES(cid).map(x => x.slice()); if (k === 'add') { const last = C.titles[C.titles.length - 1] || [0]; C.titles.push([last[0] + 5, '新的称号']); } else if (k === 'del') { if (C.titles.length > 1) C.titles.splice(i, 1); } else if (C.titles[i]) { if (k === 'lv') C.titles[i][0] = Math.max(1, +v || 1); else C.titles[i][1] = String(v).slice(0, 16); } C.titles.sort((a, b) => a[0] - b[0]); await saveRe(cid, k !== 't'); };
window.gyxLevelCfg = async (cid, k, v) => { const C = custOf(cid); if (k === 'gifts') C.gifts = String(v).split(/[\/／、,，]/).map(x => x.trim()).filter(Boolean).slice(0, 20); else if (k === 'every') C.every = Math.max(1, +v || 5); else C[k] = v; await saveRe(cid, k === 'curve'); };
window.gyxLevelW = async (cid, n, v) => { const C = custOf(cid); v = Math.max(0, +v || 0); if (v === 0) { C.off[n] = true; delete C.w[n]; } else { delete C.off[n]; C.w[n] = v; } await saveRe(cid, false); };
window.gyxLevelEx = async (cid, id, k, v) => { const C = custOf(cid); if (k === 'add') C.extra.push({ id: 'x' + Date.now().toString(36), ico: '✨', kw: '晚安', who: 'any', w: 2, by: 'me', at: Date.now() }); else if (k === 'del') C.extra = C.extra.filter(x => x.id !== id); else { const x = C.extra.find(y => y.id === id); if (x) x[k] = k === 'w' ? Math.max(1, +v || 1) : String(v).slice(0, 24); } await saveRe(cid, k === 'add' || k === 'del'); };
window.gyxLevelReset = async cid => { delete D.cust[String(cid)]; await saveRe(cid); };
// 🪄 让 TA 来设：一套称号（TA 的口吻）、几样礼物，再加一两个只有你们才有的经验来源
async function taSet(c) {
    const cid = String(c.id); let j = null;
    if (!X.bailu()) j = X.json(await X.ask(`${X.who(c)}\n你们有一个「恋爱等级」，一起做的事会涨经验、升级解锁称号，每隔几级你送她一份礼物。\n最近聊天：\n${X.recent(c, 24)}\n\n用你的口吻、按你的性格，重新起一套称号（10~13 个，从刚认识到很久很久以后，按等级从低到高，可以带只有你们懂的梗），再想 5 样升级时你会送她的礼物（券、承诺、小事都行），再想 1~2 个只属于你们的经验来源（聊天里说一次某句话就涨经验）。\n只输出 JSON：{"titles":[[1,"称号"],[3,"称号"]],"gifts":["礼物"],"extra":[{"ico":"emoji","kw":"那句话","who":"any|me|ta","w":2}]}`));
    if (!j || !Array.isArray(j.titles) || j.titles.length < 3) { const nm = X.name(c); j = { titles: [[1, '路过的陌生人'], [3, '会回消息的人'], [6, nm + '的熟人'], [10, '偷偷在意'], [15, '心照不宣'], [20, '官宣'], [26, '离不开'], [33, '家里人'], [40, '下辈子也约好了']], gifts: ['早安电话券', '陪你散步券', '不准生气券', '听你说完券', '一首歌'], extra: [{ ico: '🌙', kw: '晚安', who: 'any', w: 2 }] }; }
    const C = custOf(cid);
    C.titles = j.titles.filter(t => Array.isArray(t) && +t[0] >= 1 && t[1]).map(t => [Math.floor(+t[0]), X.plain(t[1]).slice(0, 16)]).sort((a, b) => a[0] - b[0]).slice(0, 20); if (C.titles[0] && C.titles[0][0] !== 1) C.titles[0][0] = 1;
    if (Array.isArray(j.gifts) && j.gifts.length) C.gifts = j.gifts.map(g => X.plain(g).slice(0, 14)).filter(Boolean).slice(0, 10);
    if (Array.isArray(j.extra)) j.extra.slice(0, 2).forEach(x => { if (x && x.kw) C.extra.push({ id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), ico: X.plain(x.ico || '✨').slice(0, 4), kw: X.plain(x.kw).slice(0, 20), who: ['any', 'me', 'ta'].includes(x.who) ? x.who : 'any', w: Math.max(1, Math.min(20, +x.w || 2)), by: 'ta', at: Date.now() }); });
    C.by = 'ta'; C.taAt = Date.now(); await S.set('d', D); return C;
}
window.gyxLevelTaSet = async cid => { const c = X.char(cid) || X.cur(); if (!c) return null; const C = await taSet(c); X.toast(X.v(`${X.name(c)} 起好了一套称号`, '新称号挂上了', `${X.name(c)} 想了 ${C.titles.length} 个称号`), C.titles.slice(0, 3).map(t => t[1]).join(' → ') + '…'); TAB = 'lv'; if (document.getElementById('gyxLvOv')) keepScroll(c.id); return C; };
X.ctx(id => { const c = X.char(id); if (!c) return ''; const L = levelOf(expOf(c), id); const up = D.log.find(x => x.cid === String(id) && Date.now() - x.at < 864e5); return `【你们的等级】Lv.${L.lv}「${titleOf(L.lv, id)}」。${up ? `今天刚升到 Lv.${up.lv}${up.gift ? '，你送了她一张「' + up.gift + '」' : ''}。` : ''}`; }, 'gyxLevel');
X.action({ key: 'gyx_level', label: '跟她说你们升级了', hint: '我们的等级', need: c => D.log.some(x => x.cid === String(c.id) && Date.now() - x.at < 864e5 && !x.told),
    run: async c => { const x = D.log.find(y => y.cid === String(c.id) && !y.told); x.told = Date.now(); await S.set('d', D); return (await X.reach(c, `你们刚升到 Lv.${x.lv}${x.title ? '，解锁了称号「' + x.title + '」' : ''}${x.gift ? '，你送了她一张「' + x.gift + '」' : ''}。跟她说说`)) ? '升级啦 Lv.' + x.lv : null; } }, 'gyxLevel');
X.action({ key: 'gyx_level_set', label: '给你们的恋爱等级重新起一套称号', hint: '用你的口吻，从刚认识到很久以后', need: c => { const C = custOf(c.id); return !C.taAt || Date.now() - C.taAt > 30 * 864e5; },
    run: async c => { const C = await taSet(c); const L = levelOf(expOf(c), c.id); await X.reach(c, `你刚给你们的恋爱等级重新起了一套称号，你们现在 Lv.${L.lv}，叫「${titleOf(L.lv, c.id)}」；升级时你会送她：${(C.gifts || []).slice(0, 3).join('、')}……跟她说一声，可以卖个关子不说全`); return '重新起了一套称号'; } }, 'gyxLevel');
X.today(() => { const rows = D.log.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: 'Lv.' + x.lv, x: X.esc(X.name(X.char(x.cid))) + (x.title ? ' · ' + X.esc(x.title) : ''), go: `gyxLevelOpen('${x.cid}')` })); const c = X.cur(); if (!rows.length && c) { const L = levelOf(expOf(c), c.id); rows.push({ t: 'Lv.' + L.lv, x: X.esc(titleOf(L.lv, c.id)) + ' · ' + Math.round(L.cur / L.next * 100) + '%', go: `gyxLevelOpen('${c.id}')` }); } return { title: '📈 我们的等级', rows }; }, 'gyxLevel');
X.widget('gyxLevelW', { n: '我们的等级', sizes: ['s', 'm'], tap: () => window.gyxLevelOpen(), r: w => { const c = X.cur(); if (!c) return X.gw(w, '📈', '我们的等级', []); const L = levelOf(expOf(c), c.id); return X.gw(w, '📈', 'Lv.' + L.lv, ['「' + X.esc(titleOf(L.lv, c.id)) + '」', Math.round(L.cur / L.next * 100) + '% → Lv.' + (L.lv + 1)]); } }, 'gyxLevel');
X.memArr({ k: 'gyxLevel', ico: '📈', n: '我们的等级', d: '升级记录（经验是从各个玩法里算出来的，删记录不影响等级）', arr: () => D.log, text: x => `Lv.${x.from}→Lv.${x.lv}${x.title ? ' 「' + x.title + '」' : ''}${x.gift ? ' 🎁' + x.gift : ''}`, edit: () => {}, meta: x => new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxLevel');
X.mem({ k: 'gyxLevelTitles', ico: '🏷️', n: '我们的等级·称号', d: '这个 TA 的称号（改了就是改这一级叫什么）', items: c => TITLES(c.id).map((t, i) => ({ i, t, cid: String(c.id) })), text: x => 'Lv.' + x.t[0] + ' ' + x.t[1], edit: (x, v) => { const C = custOf(x.cid); C.titles = TITLES(x.cid).map(y => y.slice()); C.titles[x.i][1] = String(v).replace(/^Lv\.\d+\s*/, '').slice(0, 16); }, del: (c, i) => { const C = custOf(c.id); C.titles = TITLES(c.id).map(y => y.slice()); if (C.titles.length > 1) C.titles.splice(i, 1); }, meta: x => custOf(x.cid).by === 'ta' ? 'TA 起的' : custOf(x.cid).titles ? '你改过' : '默认', save: () => S.set('d', D) }, 'gyxLevel');
X.css('gyxLvCss', `.lv-er{margin:4px 0}.lv-er select,.lv-er input{min-width:0;max-width:100%}.lv-x{font-style:normal;font-size:12px;color:#c33;cursor:pointer;padding:4px 6px}.lv-w input{justify-self:end}.lv-w>div{grid-template-columns:1fr auto auto!important}.lv-hero{display:flex;gap:16px;align-items:center;padding:12px;border-radius:20px;background:linear-gradient(135deg,#fff3e6,#ffe9f2)}.lv-ring{width:96px;height:96px;flex:none;border-radius:50%;background:conic-gradient(#ff7aa2 calc(var(--p)*1%),#f1e4e9 0);display:flex;align-items:center;justify-content:center;position:relative}.lv-ring:before{content:'';position:absolute;inset:9px;border-radius:50%;background:#fff8f3}.lv-ring b{position:relative;font-size:22px;color:#d0456f}.lv-t{font-size:20px;font-weight:800;color:#a63c5c}.lv-bar{height:8px;border-radius:6px;background:#f3dfe6;overflow:hidden;margin:6px 0 2px}.lv-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb37a,#ff7aa2)}.lv-h{font-weight:700;margin:14px 0 6px}.lv-src>div{display:flex;gap:8px;align-items:baseline;padding:5px 2px;border-bottom:1px dashed #eee;font-size:13.5px}.lv-src span{flex:1}.lv-src em{font-style:normal;font-size:11.5px;color:#aaa}.lv-src b{color:#d0456f;min-width:52px;text-align:right}.lv-tt{display:flex;flex-wrap:wrap;gap:6px}.lv-tt span{font-size:12px;padding:4px 9px;border-radius:10px;background:#f2f2f4;color:#aaa}.lv-tt span.on{background:#ffe3ec;color:#b03a63}`);
X.mini({ id: 'gyxLevel', icon: '📈', title: '我们的等级', desc: '一起做的事都涨经验，升级解锁称号；称号、经验、礼物都能自己改，也能让 TA 来起', cat: '回忆', onOpen: () => window.gyxLevelOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.lv = D.lv || {}; D.log = D.log || []; D.cust = D.cust || {}; setTimeout(async () => { for (const c of X.chars()) if (D.lv[String(c.id)] == null) await check(c, true); }, 20000); setInterval(tick, 90000); })();
