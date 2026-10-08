/* 📈 我们的等级：你们一起做的每件事都会涨经验——聊天、散步、合照、哄好 TA、答每日一问、通关寻宝……攒够了就升级、解锁新称号，每升 5 级 TA 还会送一份礼物。经验从哪来的一项项都列着 */
if (window.__gyxLevel) return; window.__gyxLevel = 1;
X.feat('gyxLevel', { n: '📈 我们的等级', desc: '一起做的每件事都涨经验，升级解锁称号和礼物，把所有玩法串起来' });
const S = X.store('level');
let D = { lv: {}, log: [] };   // lv[cid] = 上次看到的等级；log = [{cid, lv, at, title, gift}]
const TITLES = [[1, '刚认识'], [3, '有点熟了'], [5, '聊得来'], [8, '偷偷心动'], [12, '暧昧期'], [16, '正式交往'], [20, '甜蜜期'], [25, '形影不离'], [30, '老夫老妻预备役'], [36, '灵魂伴侣'], [42, '命中注定'], [50, '宇宙级恋人'], [60, '传说中的那一对']];
const titleOf = lv => TITLES.filter(t => lv >= t[0]).pop()[1];
const need = lv => 100 + 40 * (lv - 1);   // 从 lv 升到 lv+1 要多少经验
function levelOf(exp) { let lv = 1, left = exp; while (left >= need(lv)) { left -= need(lv); lv++; } return { lv, cur: left, next: need(lv) }; }
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
        ['🔐', '暗号', g(() => (window.gyxCodeData().codes[cid] || []).length, 0), 20], ['🧾', '审批单', arr(() => window.gyxOAData().list.filter(x => x.cid === cid && x.res)), 10],
        ['📋', '问卷', arr(() => window.gyxSurveyData().res.filter(x => x.cid === cid)), 20], ['🎟️', '兑换过的券', arr(() => window.gyxCouponData().list.filter(x => x.cid === cid && x.used)), 15],
        ['🏅', '解锁的成就', g(() => Object.keys(window.gyxBadgeData().got[cid] || {}).length, 0), 40], ['🍁', '捡到的小东西', g(() => Object.values(window.gyxDropData().got[cid] || {}).reduce((a, x) => a + x.n, 0), 0), 5],
        ['🎨', '表情包', arr(() => window.gyxMemeData().list.filter(x => x.cid === cid)), 10], ['📼', '磁带', g(() => window.gyxTapeData ? window.gyxTapeData().tapes.filter(x => x.cid === cid).length : 0, 0), 20]
    ].map(([ico, n, v, w]) => ({ ico, n, v: Math.floor(v * 10) / 10, w, exp: Math.floor(v * w) }));
}
const expOf = c => sources(c).reduce((a, s) => a + s.exp, 0);
async function check(c, quiet) {
    const cid = String(c.id), L = levelOf(expOf(c)), was = D.lv[cid];
    if (was == null || quiet) { D.lv[cid] = L.lv; await S.set('d', D); return null; }
    if (L.lv <= was) return null;
    D.lv[cid] = L.lv; const title = titleOf(L.lv), titleNew = titleOf(was) !== title, gift = Math.floor(L.lv / 5) > Math.floor(was / 5);
    let giftName = '';
    if (gift) { giftName = X.pick(['抱抱券', '任性一次券', '陪聊到天亮券', '撒娇券', '免罚券']); try { window.gyxCouponData().list.unshift({ id: 'cp' + Date.now().toString(36), cid, from: 'ta', name: giftName, desc: `Lv.${L.lv} 的升级礼物`, at: Date.now(), used: null }); } catch (e) { giftName = ''; } }
    D.log.unshift({ cid, lv: L.lv, from: was, at: Date.now(), title: titleNew ? title : '', gift: giftName }); await S.set('d', D);
    X.notify(c, `📈 ${X.v('升级啦', '叮——等级提升', '你们又近了一点')}：Lv.${L.lv}${titleNew ? ' · 「' + title + '」' : ''}`, giftName ? `TA 送了你一张「${giftName}」` : '和 ' + X.name(c), () => window.gyxLevelOpen(cid));
    return D.log[0];
}
async function tick() { if (!X.on('gyxLevel')) return; for (const c of X.chars()) await check(c); }
window.gyxLevelCheck = async cid => { const c = X.char(cid) || X.cur(); return check(c); };
window.gyxLevelData = () => D;
window.gyxLevelInfo = cid => { const c = X.char(cid) || X.cur(); const e = expOf(c), L = levelOf(e); return Object.assign({ exp: e, title: titleOf(L.lv) }, L); };
window.gyxLevelOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), S2 = sources(c), e = S2.reduce((a, s) => a + s.exp, 0), L = levelOf(e), pct = Math.round(L.cur / L.next * 100);
    X.panel('gyxLvOv', '📈 我们的等级', `<div class="gyx-row">${X.whoSel(cid, 'gyxLevelOpen')}</div>
        <div class="lv-hero"><div class="lv-ring" style="--p:${pct}"><b>Lv.${L.lv}</b></div><div><div class="lv-t">「${titleOf(L.lv)}」</div><div class="gyx-tip">${X.esc(X.name(c))} & ${X.esc(X.me(c))} · 总经验 ${e}</div><div class="lv-bar"><i style="width:${pct}%"></i></div><div class="gyx-tip">再 ${L.next - L.cur} 经验升到 Lv.${L.lv + 1}${Math.floor((L.lv + 1) / 5) > Math.floor(L.lv / 5) ? ' · 🎁 有礼物' : ''}</div></div></div>
        <div class="lv-h">经验从哪来</div><div class="lv-src">${S2.filter(s => s.v > 0).sort((a, b) => b.exp - a.exp).map(s => `<div><span>${s.ico} ${s.n}</span><em>${s.v} × ${s.w}</em><b>+${s.exp}</b></div>`).join('') || '<div class="gyx-tip">一起做点什么吧</div>'}</div>
        <div class="lv-h">称号</div><div class="lv-tt">${TITLES.map(([l, t]) => `<span class="${L.lv >= l ? 'on' : ''}">Lv.${l} ${L.lv >= l ? t : '？？？'}</span>`).join('')}</div>
        ${D.log.filter(x => x.cid === cid).length ? `<div class="lv-h">升级记录</div>${D.log.filter(x => x.cid === cid).slice(0, 12).map(x => `<div class="gyx-tip">${new Date(x.at).toLocaleDateString()} · Lv.${x.from} → Lv.${x.lv}${x.title ? ' · 解锁「' + X.esc(x.title) + '」' : ''}${x.gift ? ' · 🎁 ' + X.esc(x.gift) : ''}</div>`).join('')}` : ''}`);
};
X.ctx(id => { const c = X.char(id); if (!c) return ''; const L = levelOf(expOf(c)); const up = D.log.find(x => x.cid === String(id) && Date.now() - x.at < 864e5); return `【你们的等级】Lv.${L.lv}「${titleOf(L.lv)}」。${up ? `今天刚升到 Lv.${up.lv}${up.gift ? '，你送了她一张「' + up.gift + '」' : ''}。` : ''}`; }, 'gyxLevel');
X.action({ key: 'gyx_level', label: '跟她说你们升级了', hint: '我们的等级', need: c => D.log.some(x => x.cid === String(c.id) && Date.now() - x.at < 864e5 && !x.told),
    run: async c => { const x = D.log.find(y => y.cid === String(c.id) && !y.told); x.told = Date.now(); await S.set('d', D); return (await X.reach(c, `你们刚升到 Lv.${x.lv}${x.title ? '，解锁了称号「' + x.title + '」' : ''}${x.gift ? '，你送了她一张「' + x.gift + '」' : ''}。跟她说说`)) ? '升级啦 Lv.' + x.lv : null; } }, 'gyxLevel');
X.today(() => { const rows = D.log.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: 'Lv.' + x.lv, x: X.esc(X.name(X.char(x.cid))) + (x.title ? ' · ' + X.esc(x.title) : ''), go: `gyxLevelOpen('${x.cid}')` })); const c = X.cur(); if (!rows.length && c) { const L = levelOf(expOf(c)); rows.push({ t: 'Lv.' + L.lv, x: titleOf(L.lv) + ' · ' + Math.round(L.cur / L.next * 100) + '%', go: `gyxLevelOpen('${c.id}')` }); } return { title: '📈 我们的等级', rows }; }, 'gyxLevel');
X.widget('gyxLevelW', { n: '我们的等级', sizes: ['s', 'm'], tap: () => window.gyxLevelOpen(), r: w => { const c = X.cur(); if (!c) return X.gw(w, '📈', '我们的等级', []); const L = levelOf(expOf(c)); return X.gw(w, '📈', 'Lv.' + L.lv, ['「' + titleOf(L.lv) + '」', Math.round(L.cur / L.next * 100) + '% → Lv.' + (L.lv + 1)]); } }, 'gyxLevel');
X.memArr({ k: 'gyxLevel', ico: '📈', n: '我们的等级', d: '升级记录（经验是从各个玩法里算出来的，删记录不影响等级）', arr: () => D.log, text: x => `Lv.${x.from}→Lv.${x.lv}${x.title ? ' 「' + x.title + '」' : ''}${x.gift ? ' 🎁' + x.gift : ''}`, edit: () => {}, meta: x => new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxLevel');
X.css('gyxLvCss', `.lv-hero{display:flex;gap:16px;align-items:center;padding:12px;border-radius:20px;background:linear-gradient(135deg,#fff3e6,#ffe9f2)}.lv-ring{width:96px;height:96px;flex:none;border-radius:50%;background:conic-gradient(#ff7aa2 calc(var(--p)*1%),#f1e4e9 0);display:flex;align-items:center;justify-content:center;position:relative}.lv-ring:before{content:'';position:absolute;inset:9px;border-radius:50%;background:#fff8f3}.lv-ring b{position:relative;font-size:22px;color:#d0456f}.lv-t{font-size:20px;font-weight:800;color:#a63c5c}.lv-bar{height:8px;border-radius:6px;background:#f3dfe6;overflow:hidden;margin:6px 0 2px}.lv-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb37a,#ff7aa2)}.lv-h{font-weight:700;margin:14px 0 6px}.lv-src>div{display:flex;gap:8px;align-items:baseline;padding:5px 2px;border-bottom:1px dashed #eee;font-size:13.5px}.lv-src span{flex:1}.lv-src em{font-style:normal;font-size:11.5px;color:#aaa}.lv-src b{color:#d0456f;min-width:52px;text-align:right}.lv-tt{display:flex;flex-wrap:wrap;gap:6px}.lv-tt span{font-size:12px;padding:4px 9px;border-radius:10px;background:#f2f2f4;color:#aaa}.lv-tt span.on{background:#ffe3ec;color:#b03a63}`);
X.mini({ id: 'gyxLevel', icon: '📈', title: '我们的等级', desc: '一起做的事都涨经验，升级解锁称号', cat: '回忆', onOpen: () => window.gyxLevelOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.lv = D.lv || {}; D.log = D.log || []; setTimeout(async () => { for (const c of X.chars()) if (D.lv[String(c.id)] == null) await check(c, true); }, 20000); setInterval(tick, 90000); })();
