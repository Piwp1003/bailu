/* 🐷 一起存钱罐：为一个共同的目标一起攒（一起去看海、买一只猫、一次旅行……）——你存一笔、TA 也会存一笔，每笔都能写一句话；攒满那天一起庆祝 */
if (window.__gyxJar) return; window.__gyxJar = 1;
X.feat('gyxJar', { n: '🐷 一起存钱罐', desc: '为一个共同目标一起攒钱，TA 也会存' });
const S = X.store('jar');
let D = { jars: [], cfg: { per: 15 } };   // {id, name, goal, cid, logs:[{by, amt, note, at}], done}
const sum = j => j.logs.reduce((a, l) => a + (+l.amt || 0), 0);
async function taSave(c, j) {
    j = j || D.jars.find(x => !x.done && x.cid === String(c.id)); if (!j) return null;
    const left = j.goal - sum(j), amt = Math.max(1, Math.min(left, Math.round(X.rnd(.02, .12) * j.goal / 10) * 10 || 20));
    let note;
    if (X.bailu()) note = X.cards(['存钱', '聊天'], c, 1)[0] || '又攒了一点，离「' + j.name + '」更近了';
    else note = X.plain(await X.ask(`${X.who(c)}\n你们在一起攒钱「${j.name}」（目标 ¥${j.goal}，已经攒了 ¥${sum(j)}）。你刚往存钱罐里放了 ¥${amt}（可能是省下的奶茶钱、加班费、卖了点东西……），写一句放钱时留的话（20 字以内）。只输出这句话。`) || '又攒了一点');
    j.logs.push({ by: String(c.id), amt, note, at: Date.now() });
    if (sum(j) >= j.goal) j.done = Date.now();
    await S.set('d', D);
    X.say(c, `🐷 往「${j.name}」里存了 ¥${amt}：${note}`);
    if (j.done) { X.notify(c, `🎉 「${j.name}」攒满了！`, '一起去实现吧', 'gyxJarOpen'); X.reach(c, `你们一起攒的「${j.name}」攒满了（¥${j.goal}）！开心地告诉她，商量什么时候去实现`); }
    return { amt, note };
}
window.gyxJarTaSave = (id, jid) => taSave(X.char(id) || X.cur(), D.jars.find(x => x.id === jid));
window.gyxJarOpen = function () {
    X.panel('gyxJrOv', '🐷 一起存钱罐', `${D.jars.map(j => { const s = sum(j), p = Math.min(1, s / j.goal); return `<div class="jr-it${j.done ? ' done' : ''}"><div class="jr-pig"><div class="jr-fill" style="height:${p * 100}%"></div><span>🐷</span></div><div class="jr-m"><b>${X.esc(j.name)}</b><span>和 ${X.esc(X.name(X.char(j.cid)))} · ¥${s} / ¥${j.goal}${j.done ? ' · 🎉 攒满了' : ''}</span><div class="jr-bar"><i style="width:${p * 100}%"></i></div>
        ${j.done ? '' : `<div class="gyx-row"><input id="gyxJrA${j.id}" class="gyx-who" type="number" placeholder="金额" style="width:90px"><input id="gyxJrN${j.id}" class="gyx-who" placeholder="留一句话" style="flex:1"><button class="gyx-btn" onclick="gyxJarPut('${j.id}')">存</button></div>`}
        <div class="jr-logs">${j.logs.slice().reverse().slice(0, 12).map(l => `<div><em>${l.by === 'me' ? '我' : X.esc(X.name(X.char(l.by)))}</em> +¥${l.amt} <span>${X.esc(l.note || '')}</span></div>`).join('')}</div></div></div>`; }).join('') || '<div class="gyx-tip">还没有存钱罐。定一个你们想一起实现的事吧。</div>'}
        <div class="gyx-card"><div class="gyx-tip">新的存钱罐</div><div class="gyx-row"><input id="gyxJrName" class="gyx-who" placeholder="比如：一起去看海" style="flex:2"><input id="gyxJrGoal" class="gyx-who" type="number" placeholder="目标金额" style="flex:1"></div><div class="gyx-row">和谁：${X.whoSel((X.cur() || {}).id, 'gyxJarWho')}<button class="gyx-btn" onclick="gyxJarNew()">开一个</button></div></div>
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyxJarCfg(+this.value)">% 的可能存一笔；自主模式的 TA 自己决定。（都是你们俩之间的「虚拟」存钱罐）</div>`);
    window.GYX_JAR_WHO = window.GYX_JAR_WHO || String((X.cur() || {}).id || '');
};
window.GYX_JAR_WHO = '';
window.gyxJarWho = v => { window.GYX_JAR_WHO = v; };
window.gyxJarNew = async () => { const n = ((document.getElementById('gyxJrName') || {}).value || '').trim(), g = +((document.getElementById('gyxJrGoal') || {}).value || 0); if (!n || !g) { X.toast(X.v('名字和金额都要填', '还差一点')); return; } const j = { id: 'jr' + Date.now(), name: n, goal: g, cid: window.GYX_JAR_WHO || String((X.cur() || {}).id || ''), logs: [] }; D.jars.unshift(j); await S.set('d', D); window.gyxJarOpen(); X.reach(X.char(j.cid), `她开了一个存钱罐，想和你一起攒 ¥${g} 去「${n}」，说说你的想法`); return j; };
window.gyxJarPut = async id => { const j = D.jars.find(x => x.id === id); const a = +((document.getElementById('gyxJrA' + id) || {}).value || 0); if (!j || !a) return; j.logs.push({ by: 'me', amt: a, note: ((document.getElementById('gyxJrN' + id) || {}).value || '').trim(), at: Date.now() }); if (sum(j) >= j.goal) j.done = Date.now(); await S.set('d', D); window.gyxJarOpen(); const c = X.char(j.cid); if (j.done) X.reach(c, `你们一起攒的「${j.name}」攒满了！是她存进了最后一笔。开心地和她商量什么时候去`); else if (Math.random() < .5) X.reach(c, `她刚往你们的存钱罐「${j.name}」里存了 ¥${a}（现在 ¥${sum(j)}/¥${j.goal}），回应她一下`); };
window.gyxJarCfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyxJarData = () => D;
async function tick() { if (!X.on('gyxJar')) return; const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D); for (const j of D.jars.filter(x => !x.done)) { const c = X.char(j.cid); if (!c || X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) await taSave(c, j); } }
X.action({ key: 'gyx_jar', label: '往你们一起攒钱的存钱罐里存一笔', hint: '为了你们共同的目标', need: c => D.jars.some(x => !x.done && x.cid === String(c.id)), run: async c => { const r = await taSave(c); return r ? `往存钱罐里存了 ¥${r.amt}` : null; } }, 'gyxJar');
X.ctx(id => { const L = D.jars.filter(j => j.cid === String(id)); return L.length ? '【你们的存钱罐】' + L.map(j => `「${j.name}」¥${sum(j)}/¥${j.goal}${j.done ? '（攒满了）' : ''}`).join('；') : ''; }, 'gyxJar');
X.today(() => ({ title: '🐷 存钱罐', rows: D.jars.filter(j => !j.done).map(j => ({ t: Math.round(sum(j) / j.goal * 100) + '%', x: `${X.esc(j.name)} · ¥${sum(j)}/¥${j.goal}`, go: 'gyxJarOpen()' })) }), 'gyxJar');
X.css('gyxJrCss', `.jr-it{display:flex;gap:12px;padding:12px;border-radius:18px;background:#fff6f8;margin:8px 0}.jr-it.done{background:#f0fff4}.jr-pig{position:relative;width:64px;height:64px;border-radius:50%;background:#ffe0e8;overflow:hidden;flex-shrink:0}.jr-fill{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(0deg,#ffb86b,#ffd97a);transition:height .6s}.jr-pig span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:34px}
.jr-m{flex:1;min-width:0}.jr-m b{font-size:16px}.jr-m>span{display:block;font-size:12.5px;color:#999}.jr-bar{height:6px;border-radius:3px;background:#f2e3e8;margin:6px 0}.jr-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#ff9ab5,#ffb86b)}.jr-logs{font-size:12.5px;line-height:1.8;max-height:120px;overflow:auto}.jr-logs em{font-style:normal;color:#ff5c8a}.jr-logs span{color:#888}`);
X.mini({ id: 'gyxJar', icon: '🐷', title: '一起存钱罐', desc: '为一个共同目标一起攒，你存一笔 TA 也存一笔，攒满一起庆祝', onOpen: () => window.gyxJarOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.jars = D.jars || []; D.cfg = Object.assign({ per: 15 }, D.cfg || {}); setTimeout(tick, 50000); setInterval(tick, 30 * 60000); })();
