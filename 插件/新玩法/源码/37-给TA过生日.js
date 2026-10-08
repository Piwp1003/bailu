/* 🎂 给 TA 过生日：原来都是 TA 记着你的生日，这次换你给 TA 办——倒数、准备清单（蛋糕、礼物、布置、惊喜、贺卡），TA 生日前会不经意透露想要什么；当天开派对：点蜡烛、对着麦克风吹（或者点一下），TA 看到你准备的一切会有反应。生日用的是角色资料里原来的生日 */
if (window.__gyxBday) return; window.__gyxBday = 1;
X.feat('gyxBday', { n: '🎂 给 TA 过生日', desc: '你给 TA 办生日：准备清单、TA 透露心愿、当天吹蜡烛开派对' });
const S = X.store('bday');
let D = { plans: {}, hints: {}, log: [] };   // plans[cid] = {year, cake, gift, deco, surprise, card, party}; hints[cid+year]=[t]; log:{cid, year, at, say}
const ITEMS = [['cake', '🎂 蛋糕', '什么口味、几层、上面写什么'], ['gift', '🎁 礼物', '送什么'], ['deco', '🎈 布置', '气球？灯串？在哪儿过'], ['surprise', '✨ 惊喜', '有什么小惊喜'], ['card', '💌 贺卡', '写给 TA 的话']];
function bdOf(c) {
    const b = String((c && c.birthdate) || '').trim(); const m = b.match(/(\d{1,2})[-./月](\d{1,2})日?$/); if (!m) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0); let d = new Date(t.getFullYear(), +m[1] - 1, +m[2]); if (d < t) d = new Date(t.getFullYear() + 1, +m[1] - 1, +m[2]);
    return { d, left: Math.round((d - t) / 86400000), year: d.getFullYear(), md: (+m[1]) + ' 月 ' + (+m[2]) + ' 日' };
}
const planOf = (cid, y) => { const p = D.plans[cid]; return p && p.year === y ? p : (D.plans[cid] = { year: y }); };
window.gyxBdaySet = async function (cid, k, v) { const c = X.char(cid), b = bdOf(c); if (!b) return; planOf(String(cid), b.year)[k] = v; await S.set('d', D); };
window.gyxBdayDate = async function (cid, v) { const c = X.char(cid); if (!c || !v) return; c.birthdate = v; try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} X.toast(X.v('记下了', '好，TA 的生日记住了'), '也写进了角色资料'); window.gyxBdayOpen(cid); };
async function hint(c) {
    const b = bdOf(c); if (!b) return null; const k = c.id + ':' + b.year; D.hints[k] = D.hints[k] || [];
    let t; if (X.bailu()) t = X.cards(['生日', '想要', '聊天'], c, 1)[0] || '最近好想要一个……算了没什么';
    else t = X.plain(await X.ask(`${X.who(c)}\n再过 ${b.left} 天是你的生日，你知道她可能在偷偷准备。不经意地透露一点你想要的（按你的性格：别扭的绕弯子、直接的就直说、或者说「你在我就够了」但又补一句具体的）。20~60 字，像平常聊天顺口说的。只输出这句话。`) || '最近好想要一个……算了没什么');
    D.hints[k].push(t); await S.set('d', D); X.say(c, t); return t;
}
window.gyxBdayHint = id => hint(X.char(id) || X.cur());
window.gyxBdayParty = function (cid) {
    const c = X.char(cid) || X.cur(); if (!c) return; const b = bdOf(c), p = b ? planOf(String(c.id), b.year) : {};
    const ov = document.createElement('div'); ov.id = 'gyxBdOv'; const n = 5;
    let av = ''; try { av = getAvatarHTML(c, 64); } catch (e) {}
    ov.innerHTML = `<div class="bd-x" onclick="gyxBdayClose()">✕</div><div class="bd-st"><div class="bd-who">${av}<b>${X.esc(X.name(c))}，生日快乐</b>${p.deco ? `<em>${X.esc(p.deco)}</em>` : ''}</div>
        <div class="bd-cake"><div class="bd-cd">${Array.from({ length: n }, () => '<i><b></b></i>').join('')}</div><div class="bd-t3"></div><div class="bd-t2">${X.esc((p.cake || '').slice(0, 10))}</div><div class="bd-t1"></div></div>
        <div class="bd-tip">${X.v('先许个愿，再吹蜡烛', '对着麦克风吹一下（或者点蛋糕）', '一起吹蜡烛')}</div><button class="gyx-btn lite" onclick="gyxBdayMic()">🎤 用麦克风吹</button><div class="bd-say gyx-hand" id="gyxBdSay"></div></div>`;
    document.body.appendChild(ov); ov.querySelector('.bd-cake').onclick = () => window.gyxBdayBlow(c.id);
};
let MIC = null;
window.gyxBdayMic = async function () {
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(); ac.createMediaStreamSource(st).connect(an); const a = new Uint8Array(an.fftSize); MIC = { st, ac };
        const loop = () => { if (!MIC) return; an.getByteTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v - 128)); if (m > 60) { const o = document.querySelector('#gyxBdOv .bd-cake'); if (o) o.click(); return; } requestAnimationFrame(loop); }; loop();
        X.toast(X.v('对着麦克风吹', '用力吹一口气'));
    } catch (e) { X.toast(X.v('麦克风用不了', '没拿到麦克风'), '点一下蛋糕也能吹'); }
};
const stopMic = () => { if (MIC) { try { MIC.st.getTracks().forEach(t => t.stop()); MIC.ac.close(); } catch (e) {} MIC = null; } };
window.gyxBdayBlow = async function (cid) {
    const ov = document.getElementById('gyxBdOv'); if (!ov || ov.classList.contains('out')) return; ov.classList.add('out'); stopMic();
    let s = ''; for (let i = 0; i < 50; i++) s += `<i style="left:${X.rnd(0, 100)}%;background:${X.pick(['#ff5c8a', '#ffd166', '#5ab0ff', '#7cc38a', '#b9a6ff'])};animation-delay:${X.rnd(0, .8)}s;animation-duration:${X.rnd(2, 4)}s"></i>`; ov.insertAdjacentHTML('beforeend', `<div class="bd-conf">${s}</div>`);
    const c = X.char(cid), b = bdOf(c), p = b ? planOf(String(c.id), b.year) : {}, el = document.getElementById('gyxBdSay'); el.textContent = '……';
    const prep = ITEMS.filter(([k]) => p[k]).map(([k, n]) => n.replace(/^\S+\s/, '') + '：' + p[k]).join('；');
    let say; if (X.bailu()) say = X.cards(['生日', '感谢', '聊天'], c, 2).join('\n') || '谢谢你，这是我过得最好的生日。';
    else say = X.plain(await X.ask(`${X.who(c)}\n今天是你的生日，她给你办了生日：${prep || '她陪你吹了蜡烛'}。你刚吹完蜡烛。说说你此刻的感受和对她说的话（看到她准备的每样东西的反应，按你的性格，60~160 字）。只输出这段话。`) || '谢谢你，这是我过得最好的生日。');
    el.textContent = say; X.speak(c, say); p.party = Date.now(); D.log.unshift({ cid: String(c.id), year: b ? b.year : new Date().getFullYear(), at: Date.now(), say }); await S.set('d', D);
    X.say(c, '🎂 ' + say); return say;
};
window.gyxBdayClose = () => { stopMic(); X.stopSpeak(); const o = document.getElementById('gyxBdOv'); if (o) o.remove(); };
window.gyxBdayOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), b = bdOf(c);
    if (!b) { X.panel('gyxBdPl', '🎂 给 TA 过生日', `<div class="gyx-row">${X.whoSel(cid, 'gyxBdayOpen')}</div><div class="gyx-tip">${X.esc(X.name(c))} 的资料里还没写生日。</div><div class="gyx-row">TA 的生日：<input type="date" class="gyx-who" onchange="gyxBdayDate('${cid}',this.value)"></div>`); return; }
    const p = planOf(cid, b.year), H = D.hints[cid + ':' + b.year] || [], ok = ITEMS.filter(([k]) => p[k]).length;
    X.panel('gyxBdPl', '🎂 给 TA 过生日', `<div class="gyx-row">${X.whoSel(cid, 'gyxBdayOpen')}</div>
        <div class="bd-cnt"><span>${X.esc(X.name(c))} 的生日 · ${b.md}</span><b>${b.left === 0 ? '就是今天' : b.left}</b><span>${b.left === 0 ? '🎉' : '天后'} · 准备了 ${ok}/${ITEMS.length}</span></div>
        ${b.left === 0 ? `<div class="gyx-row"><button class="gyx-btn" onclick="document.getElementById('gyxBdPl').remove();gyxBdayParty('${cid}')">🕯️ 开派对</button></div>` : ''}
        ${H.length ? `<div class="gyx-card"><div class="gyx-tip">TA 最近不经意说过的</div>${H.map(t => `<div class="bd-h">「${X.esc(t)}」</div>`).join('')}</div>` : ''}
        ${ITEMS.map(([k, n, ph]) => `<div class="bd-it"><b>${n}</b>${k === 'card' ? `<textarea class="gyx-in" rows="3" placeholder="${ph}" onchange="gyxBdaySet('${cid}','${k}',this.value)">${X.esc(p[k] || '')}</textarea>` : `<input class="gyx-in" placeholder="${ph}" value="${X.esc(p[k] || '')}" onchange="gyxBdaySet('${cid}','${k}',this.value)">`}</div>`).join('')}
        <div class="gyx-tip">TA 不会看到这份清单（除非你自己说），当天派对上才知道你准备了什么。生日日期跟着角色资料走。</div>
        ${D.log.filter(l => l.cid === cid).map(l => `<div class="gyx-tip">${l.year} 年的生日：「${X.esc(l.say.slice(0, 40))}…」</div>`).join('')}`);
};
window.gyxBdayData = () => D;
X.action({ key: 'gyx_bday_hint', label: '快过生日了，不经意透露一点想要的', hint: '你的生日快到了', need: c => { const b = bdOf(c); return !!(b && b.left > 0 && b.left <= 14 && (D.hints[c.id + ':' + b.year] || []).length < 3); }, run: async c => (await hint(c)) ? '透露了一点生日心愿' : null }, 'gyxBday');
async function tick() { if (!X.on('gyxBday')) return; const k = X.day(); if (D.last === k) return; D.last = k; await S.set('d', D); for (const c of X.chars()) { if (X.auto(c)) continue; const b = bdOf(c); if (!b) continue; if (b.left > 0 && b.left <= 14 && (D.hints[c.id + ':' + b.year] || []).length < 3 && Math.random() < 0.3) await hint(c); if (b.left === 0) X.notify(c, X.v(`今天是 ${X.name(c)} 的生日`, `${X.name(c)} 今天生日`), '去开派对', 'gyxBdayOpen'); } }
X.ctx(id => { const c = X.char(id), b = bdOf(c); if (!b || b.left > 14) return ''; const p = D.plans[String(id)]; return b.left === 0 ? (p && p.party && X.day(new Date(p.party)) === X.day() ? '【今天是你的生日】她刚给你办了生日派对，你很开心。' : '【今天是你的生日】') : `【你的生日】${b.left} 天后是你的生日。`; }, 'gyxBday');
X.today(() => ({ title: '🎂 TA 的生日', rows: X.chars().map(c => ({ c, b: bdOf(c) })).filter(x => x.b && x.b.left <= 30).map(({ c, b }) => ({ t: b.left === 0 ? '今天' : b.left + ' 天后', x: `${X.esc(X.name(c))} 的生日 · 准备了 ${ITEMS.filter(([k]) => planOf(String(c.id), b.year)[k]).length}/${ITEMS.length}`, go: `gyxBdayOpen('${c.id}')` })) }), 'gyxBday');
X.widget('gyxBdayW', { n: 'TA 的生日', sizes: ['s', 'm'], tap: () => { const x = X.chars().map(c => ({ c, b: bdOf(c) })).filter(x => x.b).sort((a, b) => a.b.left - b.b.left)[0]; window.gyxBdayOpen(x && x.c.id); }, r: w => { const x = X.chars().map(c => ({ c, b: bdOf(c) })).filter(x => x.b).sort((a, b) => a.b.left - b.b.left)[0]; if (!x) return X.gw(w, '🎂', 'TA 的生日', ['记下 TA 的生日']); return X.gw(w, '🎂', 'TA 的生日', [x.b.left === 0 ? '<b>就是今天</b>' : x.b.left + ' 天后', X.esc(X.name(x.c)) + ' · ' + x.b.md]); } }, 'gyxBday');
X.css('gyxBdCss', `.bd-cnt{text-align:center;padding:16px;border-radius:20px;background:linear-gradient(135deg,#ffe3ec,#fff4d6);margin:8px 0}.bd-cnt b{display:block;font-size:48px;color:#ff5c8a;line-height:1.1}.bd-cnt span{font-size:13px;color:#a0707e}.bd-it{margin:8px 0}.bd-it b{display:block;font-size:14px;margin-bottom:4px}.bd-h{font-size:14px;color:#8e4ec6;padding:3px 0}
#gyxBdOv{position:fixed;inset:0;z-index:100008;background:radial-gradient(circle at 50% 40%,#3b2340,#120a14);display:flex;justify-content:center;align-items:center;overflow:hidden;color:#fff}.bd-x{position:fixed;right:18px;top:14px;font-size:20px;cursor:pointer;opacity:.7;z-index:3}
.bd-st{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(420px,92vw);position:relative;z-index:2}.bd-who{display:flex;flex-direction:column;align-items:center;gap:6px}.bd-who b{font-size:22px}.bd-who em{font-style:normal;font-size:13px;opacity:.7}
.bd-cake{position:relative;width:220px;cursor:pointer;display:flex;flex-direction:column;align-items:center}.bd-cd{display:flex;gap:16px;height:70px;align-items:flex-end}.bd-cd i{position:relative;width:8px;height:40px;background:repeating-linear-gradient(45deg,#fff,#fff 4px,#ff9ab5 4px,#ff9ab5 8px);border-radius:2px}.bd-cd i b{position:absolute;left:50%;bottom:100%;width:12px;height:20px;margin-left:-6px;border-radius:50% 50% 40% 40%;background:radial-gradient(circle at 50% 70%,#fff6a8,#ffb03b 60%,transparent 70%);animation:bdF .3s infinite alternate;box-shadow:0 0 20px #ffb03b}
#gyxBdOv.out .bd-cd i b{animation:bdOut .5s forwards}@keyframes bdF{to{transform:scaleY(1.15) translateX(1px)}}@keyframes bdOut{to{opacity:0;transform:translateY(-20px) scale(.3)}}
.bd-t3{width:120px;height:34px;background:#fff0f5;border-radius:8px 8px 0 0}.bd-t2{width:170px;height:44px;background:#ffc2d6;display:flex;align-items:center;justify-content:center;font-size:13px;color:#a0204e}.bd-t1{width:220px;height:50px;background:#ff8fb1;border-radius:0 0 12px 12px}
.bd-tip{font-size:13px;opacity:.75;letter-spacing:.1em}#gyxBdOv.out .bd-tip,#gyxBdOv.out .bd-st>.gyx-btn{display:none}.bd-say{font-size:20px;line-height:1.8;background:rgba(255,255,255,.1);padding:14px 16px;border-radius:16px;min-height:0;white-space:pre-wrap}.bd-say:empty{display:none}
.bd-conf i{position:absolute;top:-20px;width:8px;height:14px;border-radius:2px;animation:bdC linear forwards}@keyframes bdC{to{transform:translateY(110vh) rotate(720deg)}}`);
X.mini({ id: 'gyxBday', icon: '🎂', title: '给 TA 过生日', desc: '你给 TA 办生日：清单、TA 透露心愿、当天吹蜡烛开派对', onOpen: () => window.gyxBdayOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.plans = D.plans || {}; D.hints = D.hints || {}; D.log = D.log || []; setTimeout(tick, 50000); setInterval(tick, 60 * 60000); })();
X.memArr({ k: 'gyxBday', ico: '🎂', n: '你给 TA 过的生日', d: 'TA 吹完蜡烛说的话', arr: () => D.log, text: x => x.say, field: 'say', meta: x => x.year + ' 年', save: () => S.set('d', D) }, 'gyxBday');
