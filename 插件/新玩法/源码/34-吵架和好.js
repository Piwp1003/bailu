/* 🌧️ 吵架和好：吵架了可以「挂起」——冷战有计时，TA 会按自己的性格来哄你（或者嘴硬一阵再来）、写道歉信；你也能递一张和好卡；最后来一个「拉钩和好」的小仪式，记进你们的吵架档案（原来只有吵完情绪会延续，这里把和好这件事做出来） */
if (window.__gyxMakeup) return; window.__gyxMakeup = 1;
X.feat('gyxMakeup', { n: '🌧️ 吵架和好', desc: '冷战计时、TA 来哄你写道歉信、和好卡、拉钩和好仪式' });
const S = X.store('makeup');
let D = { on: {}, log: [], cfg: { first: 'auto', minH: 0.5 } };   // on[cid] = {at, why, by:'me'|'ta', steps:[{by, kind, t, at}], tries}; log: 和好过的 {cid, at, end, why, how}
const dur = ms => { const m = Math.round(ms / 60000); return m < 60 ? m + ' 分钟' : m < 1440 ? Math.round(m / 60) + ' 小时' : Math.round(m / 1440) + ' 天'; };
async function coax(c, f) {
    const kind = f.tries >= 2 ? 'letter' : 'coax';
    let t;
    if (X.bailu()) t = X.cards(kind === 'letter' ? ['道歉', '信', '哄'] : ['哄', '道歉', '聊天'], c, kind === 'letter' ? 3 : 1).join('\n') || '对不起，是我不好。';
    else t = X.plain(await X.ask(`${X.who(c)}\n你们吵架了${f.why ? '（因为：' + f.why + '）' : ''}，已经冷战 ${dur(Date.now() - f.at)}。之前你已经来哄过 ${f.tries} 次${f.steps.length ? '，最近的来回：' + f.steps.slice(-4).map(s => (s.by === 'me' ? '她' : '你') + '：' + s.t).join(' / ') : ''}。\n最近聊天：\n${X.recent(c, 10)}\n\n${kind === 'letter' ? '写一封道歉信（100~250 字）：真诚说清楚你哪里做得不好、你怎么想的、以后会怎样，按你的性格写，别套话。' : '按你的性格来哄她一次（30~80 字）：可能是认错、撒娇、嘴硬但关心、递台阶……别说教。'}只输出内容。`) || '对不起，是我不好。');
    f.steps.push({ by: String(c.id), kind, t, at: Date.now() }); f.tries++; await S.set('d', D);
    X.say(c, kind === 'letter' ? '💌 ' + t : t);
    if (kind === 'letter') X.notify(c, X.v(`${X.name(c)} 给你写了一封道歉信`, `${X.name(c)} 塞过来一封信`), '去看看', 'gyxMakeupOpen');
    return { kind, t };
}
window.gyxMakeupStart = async function (why, cid, by) {
    const c = X.char(cid) || X.cur(); if (!c) return null; why = why != null ? why : ((document.getElementById('gyxMkWhy') || {}).value || '').trim();
    D.on[String(c.id)] = { at: Date.now(), why, by: by || 'me', steps: [], tries: 0 }; await S.set('d', D);
    X.toast(X.v('先冷静一下也好', '记下了，别憋着', '抱抱自己'), X.v('TA 会来找你的', '想和好了随时点「和好」'));
    window.gyxMakeupOpen(c.id); return D.on[String(c.id)];
};
window.gyxMakeupCoax = id => { const c = X.char(id) || X.cur(), f = c && D.on[String(c.id)]; return f ? coax(c, f).then(r => { window.gyxMakeupOpen(c.id); return r; }) : null; };
window.gyxMakeupCard = async function (id) {
    const c = X.char(id) || X.cur(), f = c && D.on[String(c.id)]; if (!f) return; const t = ((document.getElementById('gyxMkCard') || {}).value || '').trim() || X.pick(['我不想跟你吵了', '我们和好吧', '其实我也有不对', '抱一下就不生气了']);
    f.steps.push({ by: 'me', kind: 'card', t, at: Date.now() }); await S.set('d', D);
    X.reach(c, `你们在冷战，她递过来一张和好卡：「${t}」。按你的性格回应（接住她的台阶、也说说你的心里话）`); window.gyxMakeupOpen(c.id);
};
// 拉钩和好：长按两根小拇指勾在一起
window.gyxMakeupPinky = function (id) {
    const c = X.char(id) || X.cur(); if (!c || !D.on[String(c.id)]) return;
    const ov = document.createElement('div'); ov.id = 'gyxMkPk';
    ov.innerHTML = `<div class="mk-pk"><div class="mk-h l">🤙</div><div class="mk-h r">🤙</div></div><div class="mk-t">${X.v('按住不放，拉钩', '按住，我们拉个钩', '长按 3 秒，和好')}</div><div class="mk-bar"><i></i></div>`;
    document.body.appendChild(ov);
    let t0 = 0, raf = 0; const bar = ov.querySelector('.mk-bar i');
    const step = () => { const p = Math.min(1, (Date.now() - t0) / 3000); bar.style.width = p * 100 + '%'; ov.style.setProperty('--p', p); if (p >= 1) return done(); raf = requestAnimationFrame(step); };
    const down = e => { e.preventDefault(); t0 = Date.now(); ov.classList.add('hold'); raf = requestAnimationFrame(step); };
    const up = () => { if (!ov.classList.contains('ok')) { cancelAnimationFrame(raf); ov.classList.remove('hold'); bar.style.width = '0'; } };
    const done = async () => { ov.classList.add('ok'); ov.querySelector('.mk-t').textContent = X.v('拉钩了，不许再生气', '和好啦', '说好了，以后好好说'); setTimeout(() => ov.remove(), 1800); await window.gyxMakeupEnd(c.id, '拉钩'); };
    ov.addEventListener('pointerdown', down); ov.addEventListener('pointerup', up); ov.addEventListener('pointerleave', up);
};
window.gyxMakeupEnd = async function (id, how) {
    const cid = String(id), f = D.on[cid]; if (!f) return null; delete D.on[cid];
    const it = { cid, at: f.at, end: Date.now(), why: f.why, how: how || '和好', n: f.steps.length }; D.log.unshift(it); await S.set('d', D);
    const c = X.char(cid); if (c) X.reach(c, `你们刚刚${how === '拉钩' ? '拉钩' : ''}和好了（冷战了 ${dur(it.end - it.at)}${f.why ? '，因为' + f.why : ''}）。说点和好之后的话，可以撒个娇、说说以后`);
    if (document.getElementById('gyxMkOv')) window.gyxMakeupOpen(cid); return it;
};
window.gyxMakeupOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), f = D.on[cid];
    X.panel('gyxMkOv', f ? '🌧️ 冷战中' : '🌤️ 吵架和好', `<div class="gyx-row">${X.whoSel(cid, 'gyxMakeupOpen')}</div>
        ${f ? `<div class="mk-cold"><b>${dur(Date.now() - f.at)}</b><span>和 ${X.esc(X.name(c))} 冷战中${f.why ? ' · ' + X.esc(f.why) : ''}</span></div>
        <div class="mk-steps">${f.steps.map(s => `<div class="mk-s ${s.by === 'me' ? 'me' : ''} ${s.kind}">${s.kind === 'letter' ? '<em>💌 道歉信</em>' : s.kind === 'card' ? '<em>🃏 和好卡</em>' : ''}<p class="${s.kind === 'letter' ? 'gyx-hand' : ''}">${X.esc(s.t).replace(/\n/g, '<br>')}</p></div>`).join('') || `<div class="gyx-tip">${X.esc(X.name(c))} 还没来哄你……</div>`}</div>
        <div class="gyx-row"><input id="gyxMkCard" class="gyx-in" style="flex:1" placeholder="递一张和好卡（可空，随机一句）"><button class="gyx-btn lite" onclick="gyxMakeupCard('${cid}')">递过去</button></div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="this.disabled=true;gyxMakeupCoax('${cid}')">让 TA 来哄我</button><button class="gyx-btn" onclick="gyxMakeupPinky('${cid}')">🤙 拉钩和好</button><button class="gyx-btn lite" onclick="gyxMakeupEnd('${cid}','直接和好')">直接和好</button></div>`
        : `<div class="gyx-tip">吵架了就在这里记一下：TA 会知道你们在冷战，按自己的性格来哄你（嘴硬的会嘴硬一阵）。</div><div class="gyx-row"><input id="gyxMkWhy" class="gyx-in" style="flex:1" placeholder="因为什么（可空）"><button class="gyx-btn" onclick="gyxMakeupStart(null,'${cid}')">我们吵架了</button></div>`}
        <div class="gyx-row gyx-tip">TA 多久来哄一次：冷战超过 <input class="gyx-who" type="number" min="0" step="0.5" value="${D.cfg.minH}" style="width:60px" onchange="gyxMakeupCfg(+this.value)"> 小时（默认模式按这个来，自主模式 TA 自己决定）</div>
        ${D.log.filter(l => l.cid === cid).length ? '<div class="gyx-tip">吵架档案</div>' + D.log.filter(l => l.cid === cid).slice(0, 20).map(l => `<div class="mk-log"><b>${new Date(l.at).toLocaleDateString()}</b> ${X.esc(l.why || '没说为什么')} · 冷战 ${dur(l.end - l.at)} · ${X.esc(l.how)}</div>`).join('') : ''}`);
};
window.gyxMakeupCfg = v => { D.cfg.minH = v; S.set('d', D); };
window.gyxMakeupData = () => D;
async function tick() {
    if (!X.on('gyxMakeup')) return;
    for (const [cid, f] of Object.entries(D.on)) {
        const c = X.char(cid); if (!c || X.auto(c)) continue;
        const last = f.steps.length ? f.steps[f.steps.length - 1].at : f.at;
        if (Date.now() - last >= (+D.cfg.minH || 0) * 3600000 * (1 + f.tries)) await coax(c, f);
    }
}
X.action({ key: 'gyx_makeup', label: '你们在冷战——去哄她 / 写道歉信 / 递台阶', hint: '你们吵架了还没和好', need: c => !!D.on[String(c.id)], run: async c => { const r = await coax(c, D.on[String(c.id)]); return r ? (r.kind === 'letter' ? '写了一封道歉信' : '来哄你了') : null; } }, 'gyxMakeup');
X.ctx(id => { const f = D.on[String(id)]; if (f) return `【你们在冷战】${dur(Date.now() - f.at)}前吵架了${f.why ? '（因为' + f.why + '）' : ''}，还没和好。你来哄过 ${f.tries} 次。说话要带着这个状态（按你的性格：愧疚、嘴硬、想和好……）。`; const l = D.log.find(x => x.cid === String(id)); return l && Date.now() - l.end < 86400000 ? '【刚和好】你们今天刚和好，说话温柔一点。' : ''; }, 'gyxMakeup');
X.today(() => ({ title: '🌧️ 吵架和好', rows: Object.entries(D.on).map(([cid, f]) => ({ t: dur(Date.now() - f.at), x: `<b>和 ${X.esc(X.name(X.char(cid)))} 冷战中</b>`, go: `gyxMakeupOpen('${cid}')` })).concat(D.log.filter(l => X.day(new Date(l.end)) === X.day()).map(l => ({ t: '🤙', x: `今天和 ${X.esc(X.name(X.char(l.cid)))} 和好了`, go: `gyxMakeupOpen('${l.cid}')` }))) }), 'gyxMakeup');
X.widget('gyxMakeupW', { n: '吵架和好', sizes: ['s', 'm'], tap: () => window.gyxMakeupOpen(), r: w => { const E = Object.entries(D.on); if (E.length) return X.gw(w, '🌧️', '冷战中', [dur(Date.now() - E[0][1].at), '和 ' + X.esc(X.name(X.char(E[0][0]))), '点一下去和好']); return X.gw(w, '🌤️', '吵架和好', [D.log.length ? '和好过 ' + D.log.length + ' 次' : '一直好好的', D.log[0] ? '上次 ' + new Date(D.log[0].end).toLocaleDateString() : '']); } }, 'gyxMakeup');
X.css('gyxMkCss', `.mk-cold{text-align:center;padding:16px;border-radius:20px;background:linear-gradient(160deg,#cfd8e3,#eef2f7);margin:8px 0}.mk-cold b{display:block;font-size:34px;color:#4a5a70}.mk-cold span{font-size:13px;color:#667}
.mk-steps{display:flex;flex-direction:column;gap:8px;margin:10px 0}.mk-s{max-width:85%;padding:10px 12px;border-radius:16px;background:#f2f2f4;font-size:14px}.mk-s.me{align-self:flex-end;background:#ffe3ec}.mk-s.letter{max-width:100%;background:#fffdf6;border:1px solid #f0e6cc}.mk-s.letter p{font-size:18px;line-height:1.8}.mk-s em{font-style:normal;font-size:12px;color:#999}.mk-s p{margin:2px 0}
.mk-log{font-size:12.5px;color:#777;padding:4px 0;border-bottom:1px solid #f4f4f4}
#gyxMkPk{position:fixed;inset:0;z-index:100008;background:rgba(255,240,245,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;user-select:none;touch-action:none}
.mk-pk{position:relative;width:240px;height:120px}.mk-h{position:absolute;top:20px;font-size:72px;transition:transform .2s}.mk-h.l{left:calc(10px + var(--p,0) * 50px)}.mk-h.r{right:calc(10px + var(--p,0) * 50px);transform:scaleX(-1)}
.mk-t{font-size:16px;color:#c05}.mk-bar{width:200px;height:6px;border-radius:3px;background:#fde}.mk-bar i{display:block;height:100%;width:0;border-radius:3px;background:#ff5c8a}
#gyxMkPk.ok .mk-pk{animation:mkB .6s 2}@keyframes mkB{50%{transform:scale(1.15)}}`);
X.mini({ id: 'gyxMakeup', icon: '🌧️', title: '吵架和好', desc: '冷战计时、TA 来哄你、道歉信、和好卡、拉钩和好', onOpen: () => window.gyxMakeupOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.on = D.on || {}; D.log = D.log || []; D.cfg = Object.assign({ first: 'auto', minH: 0.5 }, D.cfg || {}); setInterval(tick, 10 * 60000); setTimeout(tick, 30000); })();
X.memArr({ k: 'gyxMakeup', ico: '🌧️', n: '吵架档案', d: '吵过什么、怎么和好的', arr: () => D.log, text: x => x.why || '（没说为什么）', field: 'why', meta: x => new Date(x.at).toLocaleDateString() + ' · ' + x.how, save: () => S.set('d', D) }, 'gyxMakeup');
