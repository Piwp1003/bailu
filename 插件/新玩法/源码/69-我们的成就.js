/* 🏅 我们的成就：你们之间的里程碑会自动解锁徽章——第一句晚安、聊满 100 天、连续 7 天说早安、第一次被你哄好、一起走满 10 公里……还有一些隐藏成就，解锁了才知道是什么。每个徽章都记着是哪天、因为哪句话 */
if (window.__gyxBadge) return; window.__gyxBadge = 1;
X.feat('gyxBadge', { n: '🏅 我们的成就', desc: '里程碑自动解锁徽章，还有隐藏成就' });
const S = X.store('badge');
let D = { got: {} };   // got[cid][id] = {at, why}
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
    ['code3', '🔐', '秘密语言', '有了 3 个暗号', s => s.codes >= 3 && s.codes + ' 个'],
    ['oa10', '🧾', '审批达人', '处理了 10 份恋爱报告', s => s.oa >= 10 && s.oa + ' 份', 1],
    ['song', '🎵', '专属情歌', 'TA 为你写了一首歌', s => s.song >= 1 && s.song + ' 首'],
    ['sorry', '🙇', '先低头的人', '你先说了「对不起」', s => { const m = s.first(s.me, /对不起|我错了/); return m ? `「${s.tx(m).slice(0, 20)}」` : false; }, 1],
    ['haha', '😂', '笑到停不下来', '有人发了「哈哈哈哈哈哈」（6 个以上）', s => { const m = s.first(s.L, /哈{6,}/); return m ? dk(m.timestamp) : false; }, 1],
    ['bb', '👶', '宝宝', 'TA 第一次叫你「宝宝」', s => { const m = s.first(s.ta, /宝宝/); return m ? `「${s.tx(m).slice(0, 20)}」` : false; }, 1],
    ['rain', '☔', '雨天的话', '下雨天你们聊过天', s => { const m = s.first(s.L, /下雨|雨好大|淋雨/); return m ? dk(m.timestamp) : false; }, 1],
    ['bottle', '🍾', '被陌生人温柔以待', '你的漂流瓶收到了回信', s => s.bottle >= 1 && s.bottle + ' 封', 1]
];
async function check(c, quiet) {
    const cid = String(c.id), G = (D.got[cid] = D.got[cid] || {}), s = stats(c), fresh = [];
    for (const [id, ico, n, d, f] of A) { if (G[id]) continue; let r = false; try { r = f(s); } catch (e) {} if (r) { G[id] = { at: Date.now(), why: String(r) }; fresh.push([ico, n]); } }
    if (fresh.length) { await S.set('d', D); if (!quiet && X.on('gyxBadge')) X.notify(c, `🏅 ${X.v('解锁新成就', '获得徽章', '叮——成就达成')}：${fresh.map(x => x[0] + ' ' + x[1]).join('、')}`, '和 ' + X.name(c), () => window.gyxBadgeOpen(cid)); }
    return fresh;
}
async function tick() { if (!X.on('gyxBadge')) return; for (const c of X.chars()) await check(c, D.first !== true ? true : false); if (D.first !== true) { D.first = true; await S.set('d', D); } }
window.gyxBadgeCheck = async cid => { const c = X.char(cid) || X.cur(); const r = await check(c, true); window.gyxBadgeOpen(c.id); return r; };
window.gyxBadgeData = () => D;
window.gyxBadgeOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), G = D.got[cid] || {}, n = Object.keys(G).length;
    X.panel('gyxBgOv', '🏅 我们的成就', `<div class="gyx-row">${X.whoSel(cid, 'gyxBadgeOpen')}<span class="gyx-tip">${n} / ${A.length}</span><span class="gyx-chip" onclick="gyxBadgeCheck('${cid}')">刷新</span></div>
        <div class="bg-bar"><i style="width:${Math.round(n / A.length * 100)}%"></i></div>
        <div class="bg-grid">${A.map(([id, ico, nm, d, , hid]) => { const g = G[id]; return `<div class="bg-it${g ? ' on' : ''}" title="${g ? X.esc(g.why) : ''}"><span>${g || !hid ? ico : '❔'}</span><b>${g || !hid ? nm : '隐藏成就'}</b><em>${g ? new Date(g.at).toLocaleDateString() + '<br>' + X.esc(g.why) : hid ? '解锁了才知道' : d}</em></div>`; }).join('')}</div>`);
};
X.ctx(id => { const G = D.got[String(id)] || {}; const L = Object.entries(G).filter(([, g]) => Date.now() - g.at < 864e5); if (!L.length) return ''; return `【你们刚解锁的成就】${L.map(([k]) => (A.find(a => a[0] === k) || [])[2]).filter(Boolean).join('、')}。`; }, 'gyxBadge');
X.action({ key: 'gyx_badge', label: '跟她炫耀你们刚解锁的成就', hint: '我们的成就', need: c => Object.values(D.got[String(c.id)] || {}).some(g => Date.now() - g.at < 864e5 && !g.told),
    run: async c => { const e = Object.entries(D.got[String(c.id)]).find(([, g]) => Date.now() - g.at < 864e5 && !g.told); e[1].told = Date.now(); await S.set('d', D); const a = A.find(x => x[0] === e[0]); return (await X.reach(c, `你们刚解锁了一个成就「${a[1]} ${a[2]}」（${a[3]}，${e[1].why}）。跟她炫耀一下 / 感慨一下`)) ? '解锁了成就：' + a[2] : null; } }, 'gyxBadge');
X.today(() => { const rows = []; X.chars().forEach(c => Object.entries(D.got[String(c.id)] || {}).filter(([, g]) => X.day(new Date(g.at)) === X.day()).forEach(([k]) => { const a = A.find(x => x[0] === k); if (a) rows.push({ t: a[1], x: a[2] + ' · ' + X.esc(X.name(c)), go: `gyxBadgeOpen('${c.id}')` }); })); return { title: '🏅 新成就', rows }; }, 'gyxBadge');
X.widget('gyxBadgeW', { n: '我们的成就', sizes: ['s', 'm'], tap: () => window.gyxBadgeOpen(), r: w => { const c = X.cur(), G = c ? D.got[String(c.id)] || {} : {}, last = Object.entries(G).sort((a, b) => b[1].at - a[1].at)[0], a = last && A.find(x => x[0] === last[0]); return X.gw(w, a ? a[1] : '🏅', '我们的成就', [Object.keys(G).length + ' / ' + A.length, a ? '最新：' + a[2] : '']); } }, 'gyxBadge');
X.mem({ k: 'gyxBadge', ico: '🏅', n: '我们的成就', d: '解锁的成就和当时的那句话', items: c => Object.entries(D.got[String(c.id)] || {}).map(([k, g]) => Object.assign(g, { k })), text: x => ((A.find(a => a[0] === x.k) || [])[2] || x.k) + '：' + x.why, edit: (x, v) => { x.why = v.replace(/^[^：]*：/, ''); }, del: (c, i) => { const G = D.got[String(c.id)] || {}; delete G[Object.keys(G)[i]]; }, meta: x => new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxBadge');
X.css('gyxBgCss', `.bg-bar{height:8px;border-radius:6px;background:#f0f0f2;overflow:hidden;margin:4px 0 10px}.bg-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd36b,#ff8fab)}.bg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}.bg-it{border-radius:16px;background:#f5f5f7;padding:10px 8px;text-align:center;filter:grayscale(1);opacity:.55}.bg-it.on{filter:none;opacity:1;background:linear-gradient(160deg,#fff8e6,#ffeef4);box-shadow:0 2px 8px rgba(255,180,120,.25)}.bg-it span{font-size:30px;display:block}.bg-it b{display:block;font-size:13px;margin:4px 0 2px}.bg-it em{font-style:normal;font-size:11px;color:#999;display:block;line-height:1.4;word-break:break-all}`);
X.mini({ id: 'gyxBadge', icon: '🏅', title: '我们的成就', desc: '里程碑自动解锁徽章', cat: '回忆', onOpen: () => window.gyxBadgeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.got = D.got || {}; setTimeout(tick, 25000); setInterval(tick, 120000); })();
