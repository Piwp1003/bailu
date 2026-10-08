/* 🏅 我们的成就：你们之间的里程碑会自动解锁徽章——第一句晚安、聊满 100 天、连续 7 天说早安、第一次被你哄好、一起走满 10 公里……还有一些隐藏成就，解锁了才知道是什么。每个徽章都记着是哪天、因为哪句话 */
if (window.__gyxBadge) return; window.__gyxBadge = 1;
X.feat('gyxBadge', { n: '🏅 我们的成就', desc: '里程碑自动解锁徽章，还有隐藏成就' });
const S = X.store('badge');
let D = { got: {}, cust: {} };   // got[cid][id] = {at, why}；cust[cid]：你（或 TA）改过的、加的成就
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side && m.timestamp);
const dk = t => X.day(new Date(t));
function streak(days) { const s = [...new Set(days)].sort(); let best = 0, cur = 0, prev = null; s.forEach(d => { const t = new Date(d + 'T12:00').getTime(); cur = prev && t - prev < 1.5 * 864e5 ? cur + 1 : 1; prev = t; best = Math.max(best, cur); }); return best; }
function stats(c) {
    const cid = String(c.id), L = H(cid), me = L.filter(m => m.sender === 'me'), ta = L.filter(m => m.sender !== 'me'), tx = m => X.plain(m.text);
    const first = (arr, re) => arr.find(m => re.test(tx(m)));
    const dd = L.map(m => dk(m.timestamp));
    const g = (f, d) => { try { return f(); } catch (e) { return d; } };
    return { cid, L, me, ta, first, tx, days: new Set(dd).size, span: L.length ? (Date.now() - L[0].timestamp) / 864e5 : 0, talkStreak: streak(dd), morning: streak(me.filter(m => /早安|早呀|早上好|^早$/.test(tx(m))).map(m => dk(m.timestamp))), night: L.filter(m => { const h = new Date(m.timestamp).getHours(); return h >= 2 && h < 5; }).length,
        walk: g(() => window.gyxWalkData().walks.filter(x => x.cid === cid).reduce((a, x) => a + x.dist, 0), 0), duo: g(() => window.gyxDuoData().pics.filter(x => x.cid === cid).length, 0), coax: g(() => window.gyxCoaxData().log.filter(x => x.cid === cid).length, 0), makeup: g(() => window.gyxMakeupData().log.filter(x => x.cid === cid).length, 0),
        promise: g(() => window.gyxPromiseData().list.filter(x => x.cid === cid && x.done === true).length, 0), quiz: g(() => window.gyxQuizData().log.filter(x => x.cid === cid && x.ok).length, 0), hunt: g(() => window.gyxHuntData().log.filter(x => x.cid === cid).length, 0), quest: g(() => window.gyxQuestData().log.filter(x => x.cid === cid).length, 0),
        daily: g(() => Object.values(window.gyxDailyData().days[cid] || {}).filter(x => x.me).length, 0), codes: g(() => (window.gyxCodeData().codes[cid] || []).length, 0), oa: g(() => window.gyxOAData().list.filter(x => x.cid === cid && x.res).length, 0), song: g(() => window.gyxSongData().list.filter(x => x.cid === cid).length, 0), bottle: g(() => window.gyxBottleData().out.filter(x => x.reply).length, 0) };
}
// [id, 图标, 名字, 说明, 判断(s) → 理由或 false, 隐藏?]
const A = [
    ['hello', '👋', '初次见面', '你们说了第一句话', s => s.L.length ? '第一句：「' + s.tx(s.L[0]).slice(0, 20) + '」' : false],
    ['gn', '🌙', '第一句晚安', '第一次互道晚安', s => { const m = s.first(s.L, /晚安/); return m ? `${dk(m.timestamp)}：「${s.tx(m).slice(0, 20)}」` : false; }],
    ['miss', '💭', '想你了', 'TA 第一次说想你', s => { const m = s.first(s.ta, /想你/); return m ? `「${s.tx(m).slice(0, 24)}」` : false; }],
    ['love', '❤️', '说出口了', '第一次有人说「爱你 / 喜欢你」', s => { const m = s.first(s.L, /爱你|喜欢你/); return m ? `${m.sender === 'me' ? '你先说的' : 'TA 先说的'}：「${s.tx(m).slice(0, 24)}」` : false; }],
    ['m100', '💬', '一百句', '一起说了 100 句话', s => s.L.length >= 100 && '已经 ' + s.L.length + ' 句'],
    ['m1000', '📚', '一千句', '一起说了 1000 句话', s => s.L.length >= 1000 && '已经 ' + s.L.length + ' 句'],
    ['m5000', '🏛️', '话痨情侣', '一起说了 5000 句话', s => s.L.length >= 5000 && '已经 ' + s.L.length + ' 句'],
    ['d7', '🌱', '第一周', '认识满 7 天', s => s.span >= 7 && '认识 ' + Math.floor(s.span) + ' 天'],
    ['d30', '🌿', '满月', '认识满 30 天', s => s.span >= 30 && '认识 ' + Math.floor(s.span) + ' 天'],
    ['d100', '🌳', '一百天', '认识满 100 天', s => s.span >= 100 && '认识 ' + Math.floor(s.span) + ' 天'],
    ['d365', '🎂', '一周年', '认识满一年', s => s.span >= 365 && '认识 ' + Math.floor(s.span) + ' 天'],
    ['s7', '🔥', '七天不断', '连续 7 天都聊了天', s => s.talkStreak >= 7 && '最长连续 ' + s.talkStreak + ' 天'],
    ['s30', '☄️', '一个月不断', '连续 30 天都聊了天', s => s.talkStreak >= 30 && '最长连续 ' + s.talkStreak + ' 天'],
    ['morning7', '☀️', '早安打卡', '连续 7 天说早安', s => s.morning >= 7 && '连续 ' + s.morning + ' 天'],
    ['owl', '🦉', '夜猫子', '凌晨 2~5 点还在聊（10 句以上）', s => s.night >= 10 && s.night + ' 句', 1],
    ['walk10', '🚶', '一起走了十公里', '散步累计 10 公里', s => s.walk >= 10000 && (s.walk / 1000).toFixed(1) + ' 公里'],
    ['duo', '📸', '第一张合照', '一起拍了合照', s => s.duo >= 1 && s.duo + ' 张'],
    ['coax', '🥺', '哄好你了', '第一次把 TA 哄好', s => s.coax >= 1 && '哄好 ' + s.coax + ' 次'],
    ['makeup', '🤙', '吵架又和好', '第一次吵架后和好', s => s.makeup >= 1 && '和好过 ' + s.makeup + ' 次'],
    ['promise5', '🤞', '说到做到', '完成 5 个小约定', s => s.promise >= 5 && s.promise + ' 个'],
    ['quiz10', '💞', '心有灵犀', '默契问答答对 10 题', s => s.quiz >= 10 && s.quiz + ' 题'],
    ['hunt', '🗺️', '寻宝猎人', '解开一场寻宝', s => s.hunt >= 1 && s.hunt + ' 次'],
    ['quest3', '🧭', '冒险家', '打通 3 场文字冒险', s => s.quest >= 3 && s.quest + ' 场'],
    ['daily30', '🌅', '三十问', '每日一问答满 30 天', s => s.daily >= 30 && s.daily + ' 天'],
    ['oa10', '🧾', '审批达人', '处理了 10 份恋爱报告', s => s.oa >= 10 && s.oa + ' 份', 1],
    ['song', '🎵', '专属情歌', 'TA 为你写了一首歌', s => s.song >= 1 && s.song + ' 首'],
    ['sorry', '🙇', '先低头的人', '你先说了「对不起」', s => { const m = s.first(s.me, /对不起|我错了/); return m ? `「${s.tx(m).slice(0, 20)}」` : false; }, 1],
    ['haha', '😂', '笑到停不下来', '有人发了「哈哈哈哈哈哈」（6 个以上）', s => { const m = s.first(s.L, /哈{6,}/); return m ? dk(m.timestamp) : false; }, 1],
    ['bb', '👶', '宝宝', 'TA 第一次叫你「宝宝」', s => { const m = s.first(s.ta, /宝宝/); return m ? `「${s.tx(m).slice(0, 20)}」` : false; }, 1],
    ['rain', '☔', '雨天的话', '下雨天你们聊过天', s => { const m = s.first(s.L, /下雨|雨好大|淋雨/); return m ? dk(m.timestamp) : false; }, 1],
    ['bottle', '🍾', '被陌生人温柔以待', '你的漂流瓶收到了回信', s => s.bottle >= 1 && s.bottle + ' 封', 1]
];
// ✏️ 自定义（每个 TA 一套）：内置的能改名字 / 图标 / 说明、能关掉；能自己加新的；也能交给 TA 来设
// cust[cid] = { ov: { 内置id: {ico, n, d, off} }, add: [{id, ico, n, d, type, kw, who, num, hid, by:'me'|'ta', at}] }
const TYPES = { kw: '聊天里第一次出现某句话', kwN: '某句话说满 N 次', msgs: '一起说满 N 句', days: '认识满 N 天', streak: '连续聊满 N 天', manual: '没有条件：你点亮，或者 TA 觉得到了替你们点亮' };
const WHO = { any: '谁说都算', me: '你说', ta: 'TA 说' };
const custOf = cid => { const C = (D.cust[String(cid)] = D.cust[String(cid)] || {}); C.ov = C.ov || {}; C.add = C.add || []; return C; };
const reOf = kw => { const L = String(kw || '').split(/[|｜/、,，]/).map(x => x.trim()).filter(Boolean).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return new RegExp(L.length ? L.join('|') : '(?!)'); };
function condOf(x) {
    return s => {
        const n = Math.max(1, +x.num || 1), pool = x.who === 'me' ? s.me : x.who === 'ta' ? s.ta : s.L, re = reOf(x.kw);
        if (x.type === 'kw') { const m = s.first(pool, re); return m ? `${dk(m.timestamp)}：「${s.tx(m).slice(0, 24)}」` : false; }
        if (x.type === 'kwN') { const k = pool.filter(m => re.test(s.tx(m))).length; return k >= n && `说了 ${k} 次`; }
        if (x.type === 'msgs') return s.L.length >= n && '已经 ' + s.L.length + ' 句';
        if (x.type === 'days') return s.span >= n && '认识 ' + Math.floor(s.span) + ' 天';
        if (x.type === 'streak') return s.talkStreak >= n && '最长连续 ' + s.talkStreak + ' 天';
        return false;
    };
}
// 这个 TA 现在生效的成就表：[id, 图标, 名字, 说明, 判断, 隐藏?, 谁定的]
function all(cid) {
    const C = custOf(cid);
    return A.filter(a => !(C.ov[a[0]] || {}).off).map(a => { const o = C.ov[a[0]] || {}; return [a[0], o.ico || a[1], o.n || a[2], o.d || a[3], a[4], a[5], 'sys']; })
        .concat(C.add.map(x => [x.id, x.ico || '⭐', x.n, x.d || TYPES[x.type] || '', condOf(x), x.hid ? 1 : 0, x.by || 'me']));
}
const findA = (cid, k) => all(cid).find(a => a[0] === k) || A.find(a => a[0] === k);
async function check(c, quiet) {
    const cid = String(c.id), G = (D.got[cid] = D.got[cid] || {}), s = stats(c), fresh = [];
    for (const [id, ico, n, d, f] of all(cid)) { if (G[id]) continue; let r = false; try { r = f(s); } catch (e) {} if (r) { G[id] = { at: Date.now(), why: String(r) }; fresh.push([ico, n]); } }
    if (fresh.length) { await S.set('d', D); if (!quiet && X.on('gyxBadge')) X.notify(c, `🏅 ${X.v('解锁新成就', '获得徽章', '叮——成就达成')}：${fresh.map(x => x[0] + ' ' + x[1]).join('、')}`, '和 ' + X.name(c), () => window.gyxBadgeOpen(cid)); }
    return fresh;
}
async function tick() { if (!X.on('gyxBadge')) return; for (const c of X.chars()) await check(c, D.first !== true ? true : false); if (D.first !== true) { D.first = true; await S.set('d', D); } }
window.gyxBadgeCheck = async cid => { const c = X.char(cid) || X.cur(); const r = await check(c, true); window.gyxBadgeOpen(c.id); return r; };
window.gyxBadgeData = () => D;
window.gyxBadgeAll = cid => all(cid).map(a => ({ id: a[0], ico: a[1], n: a[2], d: a[3], hid: !!a[5], by: a[6] }));
let TAB = 'wall';
window.gyxBadgeTab = (cid, t) => { TAB = t; window.gyxBadgeOpen(cid); };
window.gyxBadgeOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), G = D.got[cid] || {}, L = all(cid), n = L.filter(a => G[a[0]]).length;
    const tabs = `<div class="gyx-row">${X.whoSel(cid, 'gyxBadgeOpen')}<span class="gyx-chip${TAB === 'wall' ? ' on' : ''}" onclick="gyxBadgeTab('${cid}','wall')">徽章墙</span><span class="gyx-chip${TAB === 'edit' ? ' on' : ''}" onclick="gyxBadgeTab('${cid}','edit')">✏️ 自定义</span></div>`;
    if (TAB === 'edit') return X.panel('gyxBgOv', '🏅 我们的成就', tabs + editHtml(c));
    X.panel('gyxBgOv', '🏅 我们的成就', `${tabs}<div class="gyx-row"><span class="gyx-tip">${n} / ${L.length}</span><span class="gyx-chip" onclick="gyxBadgeCheck('${cid}')">刷新</span></div>
        <div class="bg-bar"><i style="width:${Math.round(n / Math.max(1, L.length) * 100)}%"></i></div>
        <div class="bg-grid">${L.map(([id, ico, nm, d, , hid, by]) => { const g = G[id]; return `<div class="bg-it${g ? ' on' : ''}" title="${g ? X.esc(g.why) : ''}"><span>${g || !hid ? X.esc(ico) : '❔'}</span><b>${g || !hid ? X.esc(nm) : '隐藏成就'}</b><em>${g ? new Date(g.at).toLocaleDateString() + '<br>' + X.esc(g.why) : hid ? '解锁了才知道' : X.esc(d)}</em>${by === 'ta' ? `<i class="bg-by">${X.esc(X.name(c))} 设的</i>` : by === 'me' ? '<i class="bg-by">你设的</i>' : ''}${!g && by !== 'sys' && (custOf(cid).add.find(x => x.id === id) || {}).type === 'manual' ? `<i class="bg-lt" onclick="gyxBadgeLight('${cid}','${id}')">点亮</i>` : ''}</div>`; }).join('')}</div>`);
};
function editHtml(c) {
    const cid = String(c.id), C = custOf(cid), E = X.esc;
    const sel = (o, v, on) => `<select class="gyx-who" onchange="${on}">${Object.entries(o).map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
    const row = x => `<div class="gyx-card bg-ed"><div class="gyx-row"><input class="gyx-who" style="width:52px;text-align:center" value="${E(x.ico || '⭐')}" onchange="gyxBadgeEdit('${cid}','${x.id}','ico',this.value)"><input class="gyx-who" style="flex:1" value="${E(x.n)}" onchange="gyxBadgeEdit('${cid}','${x.id}','n',this.value)">${x.by === 'ta' ? `<span class="gyx-tip">${E(X.name(c))} 设的</span>` : ''}<i class="bg-x" onclick="gyxBadgeDel('${cid}','${x.id}')">删</i></div>
        <input class="gyx-in" placeholder="说明（可空）" value="${E(x.d || '')}" onchange="gyxBadgeEdit('${cid}','${x.id}','d',this.value)">
        <div class="gyx-row">${sel(TYPES, x.type, `gyxBadgeEdit('${cid}','${x.id}','type',this.value)`)}${/^kw/.test(x.type) ? `<input class="gyx-who" style="flex:1;min-width:90px" placeholder="哪句话（几个用 / 隔开）" value="${E(x.kw || '')}" onchange="gyxBadgeEdit('${cid}','${x.id}','kw',this.value)">${sel(WHO, x.who || 'any', `gyxBadgeEdit('${cid}','${x.id}','who',this.value)`)}` : ''}${x.type !== 'kw' && x.type !== 'manual' ? `<input class="gyx-who" type="number" min="1" style="width:80px" value="${+x.num || 1}" onchange="gyxBadgeEdit('${cid}','${x.id}','num',this.value)">` : ''}<label class="gyx-tip"><input type="checkbox" ${x.hid ? 'checked' : ''} onchange="gyxBadgeEdit('${cid}','${x.id}','hid',this.checked)"> 隐藏</label></div></div>`;
    return `<div class="gyx-tip">每个 TA 一套。内置的可以改名字、换图标、关掉；也可以自己加，条件从下面几种里挑。</div>
        <div class="gyx-row"><button class="gyx-btn" onclick="this.disabled=true;this.textContent='${E(X.name(c))} 在想…';gyxBadgeTaSet('${cid}')">🪄 让 ${E(X.name(c))} 来设几个</button><button class="gyx-btn lite" onclick="gyxBadgeAdd('${cid}')">＋ 自己加一个</button></div>
        ${C.add.length ? `<div class="lv-h" style="font-weight:700;margin:12px 0 4px">加的成就（${C.add.length}）</div>${C.add.map(row).join('')}` : ''}
        <details class="gyx-tip" style="margin-top:10px"><summary>内置的 ${A.length} 个（改名字 / 图标 / 关掉）</summary>${A.map(a => { const o = C.ov[a[0]] || {}; return `<div class="gyx-row bg-sys${o.off ? ' off' : ''}"><input class="gyx-who" style="width:48px;text-align:center" value="${E(o.ico || a[1])}" onchange="gyxBadgeOv('${cid}','${a[0]}','ico',this.value)"><input class="gyx-who" style="flex:1" value="${E(o.n || a[2])}" onchange="gyxBadgeOv('${cid}','${a[0]}','n',this.value)"><label><input type="checkbox" ${o.off ? '' : 'checked'} onchange="gyxBadgeOv('${cid}','${a[0]}','off',!this.checked)"> 用</label></div>`; }).join('')}
        <div class="gyx-row"><span class="gyx-chip" onclick="gyxBadgeOvReset('${cid}')">内置的全部恢复原样</span></div></details>`;
}
const keepScroll = cid => { const b = document.querySelector('#gyxBgOv .gyx-box') || document.querySelector('#gyHubOv .gyhb-box') || document.querySelector('#gyHubOv .gyp-box'); const t = b ? b.scrollTop : 0; window.gyxBadgeOpen(cid); if (b) b.scrollTop = t; };
window.gyxBadgeAdd = async (cid, x) => { const C = custOf(cid); const it = Object.assign({ id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), ico: '⭐', n: '新的成就', d: '', type: 'kw', kw: '', who: 'any', num: 1, hid: false, by: 'me', at: Date.now() }, x || {}); C.add.unshift(it); await S.set('d', D); if (!x) { TAB = 'edit'; keepScroll(cid); } return it; };
window.gyxBadgeEdit = async (cid, id, k, v) => { const it = custOf(cid).add.find(x => x.id === id); if (!it) return; it[k] = k === 'num' ? Math.max(1, +v || 1) : k === 'hid' ? !!v : String(v).slice(0, k === 'd' ? 60 : 30); await S.set('d', D); if (k === 'type') keepScroll(cid); };
window.gyxBadgeDel = async (cid, id) => { const C = custOf(cid); C.add = C.add.filter(x => x.id !== id); delete (D.got[String(cid)] || {})[id]; await S.set('d', D); keepScroll(cid); };
window.gyxBadgeOv = async (cid, id, k, v) => { const C = custOf(cid); const o = (C.ov[id] = C.ov[id] || {}); if (k === 'off') o.off = !!v; else o[k] = String(v).slice(0, 30); await S.set('d', D); if (k === 'off') keepScroll(cid); };
window.gyxBadgeOvReset = async cid => { custOf(cid).ov = {}; await S.set('d', D); keepScroll(cid); };
window.gyxBadgeLight = async (cid, id, why, by) => { const G = (D.got[String(cid)] = D.got[String(cid)] || {}); if (G[id]) return false; G[id] = { at: Date.now(), why: String(why || (by === 'ta' ? X.name(X.char(cid)) + ' 替你们点亮的' : '你点亮的')).slice(0, 60) }; await S.set('d', D); if (document.getElementById('gyxBgOv')) keepScroll(cid); return true; };
// 🪄 让 TA 来设：按 TA 的人设和你们聊过的事，想几个只属于你们的成就
async function taSet(c, n) {
    n = n || 4; const cid = String(c.id), have = all(cid).map(a => a[2]).join('、');
    let L = null;
    if (!X.bailu()) { const j = X.json(await X.ask(`${X.who(c)}\n你们有一面「成就墙」，记着你们之间的里程碑。已经有的：${have}。\n最近聊天：\n${X.recent(c, 30)}\n\n用你的口吻、按你的性格，再想 ${n} 个只属于你们俩的成就（别跟已有的重复），可以带点只有你们懂的梗。每个成就选一种条件：\nkw＝聊天里第一次出现某句话；kwN＝某句话说满 num 次；msgs＝一起说满 num 句；days＝认识满 num 天；streak＝连续聊满 num 天；manual＝没法自动判断的（比如「第一次一起看日出」），由你觉得到了再点亮。\nwho：any / me（她说）/ ta（你说）。hid：要不要做成隐藏成就。\n只输出 JSON：{"list":[{"ico":"一个 emoji","n":"名字（2~8字）","d":"一句说明","type":"kw","kw":"关键词","who":"any","num":1,"hid":false}]}`)); L = j && Array.isArray(j.list) ? j.list : null; }
    if (!L || !L.length) { const nm = X.name(c); L = X.pick([[{ ico: '🌙', n: '晚安收藏家', d: nm + '说满 30 次晚安', type: 'kwN', kw: '晚安', who: 'ta', num: 30 }, { ico: '🍜', n: '饭搭子', d: '聊到「一起吃」', type: 'kw', kw: '一起吃', who: 'any' }, { ico: '🌅', n: '一起看日出', d: '真的一起看了一次日出', type: 'manual', hid: true }], [{ ico: '🫶', n: '嘴硬心软', d: nm + '第一次说「才没有」', type: 'kw', kw: '才没有', who: 'ta', hid: true }, { ico: '📮', n: '五百句', d: '一起说满 500 句', type: 'msgs', num: 500 }, { ico: '🎡', n: '一起去游乐园', d: '约好的游乐园真去了', type: 'manual' }]]); }
    const out = [];
    for (const x of L.slice(0, n)) { if (!x || !x.n || !TYPES[x.type]) continue; out.push(await window.gyxBadgeAdd(cid, { ico: X.plain(x.ico || '⭐').slice(0, 4) || '⭐', n: X.plain(x.n).slice(0, 14), d: X.plain(x.d || '').slice(0, 40), type: x.type, kw: X.plain(x.kw || '').slice(0, 24), who: WHO[x.who] ? x.who : 'any', num: Math.max(1, +x.num || 1), hid: !!x.hid, by: 'ta' })); }
    return out;
}
window.gyxBadgeTaSet = async (cid, n) => { const c = X.char(cid) || X.cur(); if (!c) return []; const r = await taSet(c, n); X.toast(r.length ? X.v(`${X.name(c)} 设了 ${r.length} 个新成就`, '新成就挂上墙了', `${X.name(c)} 想了 ${r.length} 个`) : '这次没想出来', r.map(x => x.n).join('、')); await check(c, true); TAB = 'edit'; if (document.getElementById('gyxBgOv')) keepScroll(c.id); return r; };
X.ctx(id => { const G = D.got[String(id)] || {}; const L = Object.entries(G).filter(([, g]) => Date.now() - g.at < 864e5); const man = custOf(id).add.filter(x => x.type === 'manual' && !G[x.id]); let s = L.length ? `【你们刚解锁的成就】${L.map(([k]) => (findA(id, k) || [])[2]).filter(Boolean).join('、')}。` : ''; if (man.length) s += `${s ? '\n' : ''}【你们还没点亮的成就（真发生了才算）】${man.slice(0, 5).map(x => x.n + (x.d ? '：' + x.d : '')).join('；')}。`; return s; }, 'gyxBadge');
X.action({ key: 'gyx_badge', label: '跟她炫耀你们刚解锁的成就', hint: '我们的成就', need: c => Object.values(D.got[String(c.id)] || {}).some(g => Date.now() - g.at < 864e5 && !g.told),
    run: async c => { const e = Object.entries(D.got[String(c.id)]).find(([, g]) => Date.now() - g.at < 864e5 && !g.told); e[1].told = Date.now(); await S.set('d', D); const a = findA(c.id, e[0]); if (!a) return null; return (await X.reach(c, `你们刚解锁了一个成就「${a[1]} ${a[2]}」（${a[3]}，${e[1].why}）。跟她炫耀一下 / 感慨一下`)) ? '解锁了成就：' + a[2] : null; } }, 'gyxBadge');
X.action({ key: 'gyx_badge_new', label: '偷偷给你们的成就墙加一个新成就', hint: '只属于你们俩的里程碑，可以带点只有你们懂的梗', need: c => !custOf(c.id).add.some(x => x.by === 'ta' && Date.now() - x.at < 7 * 864e5),
    run: async c => { const r = await taSet(c, 1); if (!r.length) return null; await X.reach(c, `你刚在你们的成就墙上加了一个新成就「${r[0].ico} ${r[0].n}」（${r[0].d || TYPES[r[0].type]}）。跟她说一声，或者卖个关子${r[0].hid ? '（是隐藏成就，别说破）' : ''}`); return '加了一个新成就：' + r[0].n; } }, 'gyxBadge');
X.action({ key: 'gyx_badge_light', label: '替你们点亮一个「真发生了」的成就', hint: '比如约好的事真的做到了', need: c => !X.bailu() && custOf(c.id).add.some(x => x.type === 'manual' && !(D.got[String(c.id)] || {})[x.id]),
    run: async c => { const cid = String(c.id), man = custOf(cid).add.filter(x => x.type === 'manual' && !(D.got[cid] || {})[x.id]); const j = X.json(await X.ask(`${X.who(c)}\n你们还没点亮的成就：\n${man.map(x => x.id + '｜' + x.n + '｜' + (x.d || '')).join('\n')}\n最近聊天：\n${X.recent(c, 30)}\n\n只根据聊天里**真的发生了**的事判断：哪一个已经达成了？没有就写 null。只输出 JSON：{"id":"成就 id 或 null","why":"哪句话说明它达成了（20 字以内）"}`)); const x = j && man.find(m => m.id === j.id); if (!x) return null; await window.gyxBadgeLight(cid, x.id, j.why, 'ta'); await X.reach(c, `你替你们点亮了成就「${x.ico} ${x.n}」，因为${j.why || '它真的发生了'}。跟她说一声`); return '点亮了成就：' + x.n; } }, 'gyxBadge');
X.today(() => { const rows = []; X.chars().forEach(c => { Object.entries(D.got[String(c.id)] || {}).filter(([, g]) => X.day(new Date(g.at)) === X.day()).forEach(([k]) => { const a = findA(c.id, k); if (a) rows.push({ t: a[1], x: X.esc(a[2]) + ' · ' + X.esc(X.name(c)), go: `gyxBadgeOpen('${c.id}')` }); }); custOf(c.id).add.filter(x => x.by === 'ta' && X.day(new Date(x.at)) === X.day()).forEach(x => rows.push({ t: '🪄', x: `${X.esc(X.name(c))} 设了新成就「${X.esc(x.hid ? '？？？' : x.n)}」`, go: `gyxBadgeOpen('${c.id}')` })); }); return { title: '🏅 成就', rows }; }, 'gyxBadge');
X.widget('gyxBadgeW', { n: '我们的成就', sizes: ['s', 'm'], tap: () => window.gyxBadgeOpen(), r: w => { const c = X.cur(), G = c ? D.got[String(c.id)] || {} : {}, last = Object.entries(G).sort((a, b) => b[1].at - a[1].at)[0], a = last && c && findA(c.id, last[0]); return X.gw(w, a ? X.esc(a[1]) : '🏅', '我们的成就', [Object.keys(G).length + ' / ' + (c ? all(c.id).length : A.length), a ? '最新：' + X.esc(a[2]) : '']); } }, 'gyxBadge');
X.mem({ k: 'gyxBadge', ico: '🏅', n: '我们的成就', d: '解锁的成就和当时的那句话', items: c => Object.entries(D.got[String(c.id)] || {}).map(([k, g]) => Object.assign(g, { k, cid: String(c.id) })), text: x => (((findA(x.cid, x.k) || [])[2]) || x.k) + '：' + x.why, edit: (x, v) => { x.why = v.replace(/^[^：]*：/, ''); }, del: (c, i) => { const G = D.got[String(c.id)] || {}; delete G[Object.keys(G)[i]]; }, meta: x => new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxBadge');
X.mem({ k: 'gyxBadgeCust', ico: '✏️', n: '自己加的成就', d: '你和 TA 设的成就（名字能改，删了就没了）', items: c => custOf(c.id).add, text: x => x.n, edit: (x, v) => { x.n = String(v).slice(0, 14); }, del: (c, i) => { custOf(c.id).add.splice(i, 1); }, meta: x => (x.by === 'ta' ? 'TA 设的' : '你设的') + ' · ' + (TYPES[x.type] || ''), save: () => S.set('d', D) }, 'gyxBadge');
X.css('gyxBgCss', `.bg-bar{height:8px;border-radius:6px;background:#f0f0f2;overflow:hidden;margin:4px 0 10px}.bg-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd36b,#ff8fab)}.bg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}.bg-it{position:relative;border-radius:16px;background:#f5f5f7;padding:10px 8px;text-align:center;filter:grayscale(1);opacity:.55}.bg-it.on{filter:none;opacity:1;background:linear-gradient(160deg,#fff8e6,#ffeef4);box-shadow:0 2px 8px rgba(255,180,120,.25)}.bg-it span{font-size:30px;display:block}.bg-it b{display:block;font-size:13px;margin:4px 0 2px}.bg-it em{font-style:normal;font-size:11px;color:#999;display:block;line-height:1.4;word-break:break-all}
.bg-by{display:block;font-style:normal;font-size:10px;color:#c58aa0;margin-top:4px}.bg-lt{display:inline-block;margin-top:6px;font-style:normal;font-size:11.5px;padding:3px 10px;border-radius:999px;background:#1d1d1f;color:#fff;cursor:pointer;filter:none}.bg-it:has(.bg-lt){filter:none;opacity:.8}
.bg-ed .gyx-row{margin:6px 0}.bg-ed select,.bg-ed input{max-width:100%;min-width:0}.bg-ed select{flex:1 1 150px}.bg-x{font-style:normal;font-size:12px;color:#c33;cursor:pointer;padding:4px 6px}.bg-sys{margin:4px 0}.bg-sys.off input[type=text],.bg-sys.off .gyx-who{opacity:.45}`);
X.mini({ id: 'gyxBadge', icon: '🏅', title: '我们的成就', desc: '里程碑自动解锁徽章；能自己加、能让 TA 来设', cat: '回忆', onOpen: () => window.gyxBadgeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.got = D.got || {}; D.cust = D.cust || {}; setTimeout(tick, 25000); setInterval(tick, 120000); })();
