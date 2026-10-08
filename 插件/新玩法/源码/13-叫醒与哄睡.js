/* ⏰🌙 叫醒与哄睡：TA 按你定的时间叫你起床（赖床会被一遍遍叫）；睡前 TA 给你讲故事，配着雨声 / 白噪音，讲完慢慢变小声 */
if (window.__gyxWake) return; window.__gyxWake = 1;
X.feat('gyxWake', { n: '⏰ 叫醒与哄睡', desc: 'TA 按时叫你起床（赖床会一遍遍叫）；睡前讲故事、配雨声白噪音' });
const S = X.store('wake');
let D = { alarms: [], sleep: { noise: 'rain', min: 30, vol: .35, kind: 'fairy' }, stories: [] };   // alarm {id, at:'07:30', days:[1..7] | [], on, who, last}
let RING = null, NOISE = null;
async function wakeLine(c, n) {
    if (X.bailu()) return X.cards(['叫醒', '早安', '聊天'], c, 1)[0] || ['起床啦，太阳晒屁股了。', '再不起我就要进来掀被子了。', '起来吧，我陪你。'][Math.min(2, n)];
    const t = await X.ask(`${X.who(c)}\n现在是早上 ${new Date().toTimeString().slice(0, 5)}，你在叫她起床，${n ? `这是第 ${n + 1} 次叫了，她还在赖床` : '她的闹钟刚响'}。说一句叫她起床的话（口语，一两句，${n ? '越叫越急 / 越无奈 / 越想笑，按你的性格' : '温柔一点'}），不要动作描写。只输出这句话。`);
    return t ? X.plain(t) : '起床啦。';
}
async function ring(al) {
    if (RING) return; const c = X.char(al.who) || X.cur(); if (!c) return;
    RING = { al, c, n: 0 };
    const ov = document.createElement('div'); ov.id = 'gyxWkOv';
    let av = ''; try { av = getAvatarHTML(c, 120); } catch (e) {}
    ov.innerHTML = `<div class="wk-bg"></div><div class="wk-c"><div class="wk-t">${new Date().toTimeString().slice(0, 5)}</div><div class="wk-av">${av}</div><div class="wk-n">${X.esc(X.name(c))}</div><div class="wk-s" id="gyxWkS">……</div>
        <div class="wk-bt"><button onclick="gyxWakeSnooze()">再睡 5 分钟</button><button class="up" onclick="gyxWakeUp()">起来了</button></div></div>`;
    document.body.appendChild(ov);
    const say = async () => { if (!RING) return; const t = await wakeLine(c, RING.n); const e = document.getElementById('gyxWkS'); if (e) e.textContent = t; beep(); X.speak(c, t); };
    await say();
    RING.iv = setInterval(() => { if (!RING) return; RING.n++; say(); }, 45000);
}
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 988; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.001, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.15, a.currentTime + t + .03); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .2); o.start(a.currentTime + t); o.stop(a.currentTime + t + .22); }); } catch (e) {} }
function stopRing() { if (!RING) return null; clearInterval(RING.iv); const r = RING; RING = null; X.stopSpeak(); const o = document.getElementById('gyxWkOv'); if (o) o.remove(); return r; }
window.gyxWakeUp = async () => { const r = stopRing(); if (!r) return; X.reach(r.c, `你刚把她叫起来了（叫了 ${r.n + 1} 次），说声早安，问问她今天的安排`); };
window.gyxWakeSnooze = () => { const r = stopRing(); if (!r) return; X.toast('😴 再睡 5 分钟', X.name(r.c) + ' 5 分钟后再来叫你'); setTimeout(() => ring(r.al), 5 * 60000); };
window.gyxWakeTest = id => ring(D.alarms.find(a => a.id === id) || { who: '' });
async function tick() { if (!X.on('gyxWake')) return;
    const now = new Date(), hm = now.toTimeString().slice(0, 5), wd = now.getDay() || 7;
    for (const al of D.alarms) { if (!al.on || al.at !== hm || al.last === X.day() + hm) continue; if (al.days && al.days.length && !al.days.includes(wd)) continue; al.last = X.day() + hm; await S.set('d', D); ring(al); if (!al.days || !al.days.length) { al.on = false; await S.set('d', D); } }
}
/* ---------------- 哄睡：白噪音 + 睡前故事 ---------------- */
function noise(kind, vol) {
    stopNoise(); try {
        const a = new (window.AudioContext || window.webkitAudioContext)(), len = a.sampleRate * 4, b = a.createBuffer(2, len, a.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown' || kind === 'fire') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; } else if (kind === 'rain') { last = .96 * last + .04 * w; d[i] = w * .35 + last * .8 + (Math.random() < .0008 ? (Math.random() - .5) * 1.5 : 0); } else if (kind === 'wave') { d[i] = w * .5 * (0.5 + 0.5 * Math.sin(i / len * Math.PI * 2)); } else d[i] = w * .4; } }
        const src = a.createBufferSource(); src.buffer = b; src.loop = true;
        const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = { rain: 4200, brown: 700, wave: 1100, white: 9000, fire: 500 }[kind] || 3000;
        const g = a.createGain(); g.gain.value = vol; src.connect(f); f.connect(g); g.connect(a.destination); src.start();
        if (kind === 'fire') { const iv = setInterval(() => { if (!NOISE) return clearInterval(iv); if (Math.random() < .5) { const o = a.createBufferSource(), bb = a.createBuffer(1, a.sampleRate * .03, a.sampleRate), dd = bb.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length); o.buffer = bb; const gg = a.createGain(); gg.gain.value = vol * .6; o.connect(gg); gg.connect(a.destination); o.start(); } }, 180); }
        NOISE = { a, g, src };
    } catch (e) {}
}
function stopNoise() { if (!NOISE) return; try { NOISE.src.stop(); NOISE.a.close(); } catch (e) {} NOISE = null; }
window.gyxSleepStop = () => { stopNoise(); X.stopSpeak(); if (window.__gyxSleepT) clearTimeout(window.__gyxSleepT); const b = document.getElementById('gyxSlNow'); if (b) b.textContent = ''; };
// 睡前故事：选个讲法——童话 / 把我们俩写进去 / 接着昨天的往下讲（连载）/ 平平淡淡的小日常 / 你点题；讲过的都收进故事本
const SK = [['fairy', '🧚 童话'], ['us', '💞 我们俩'], ['serial', '📖 接着昨天讲'], ['daily', '☕ 小日常'], ['ask', '✍️ 我点题']];
async function story(c) {
    const k = D.sleep.kind || 'fairy', topic = ((document.getElementById('gyxSlTopic') || {}).value || '').trim(), last = (D.stories || []).find(x => x.cid === String(c.id));
    let t;
    if (X.bailu()) t = X.cards(['故事', '晚安', '聊天'], c, 5).join('。') || '从前有一只小兔子，它每天晚上都要数星星才能睡着……晚安。';
    else {
        const how = { fairy: '编一个温柔的童话', us: '把你们俩写进一个温柔的小故事里', serial: last ? `接着你上次讲的故事往下讲（上次讲到：${last.text.slice(-300)}）` : '开一个可以连着讲好几晚的故事的第一章', daily: '讲一段平平淡淡、很安心的小日常故事', ask: `按她点的题目讲：「${topic || '随便'}」` }[k];
        t = await X.ask(`${X.who(c)}
她要睡了，你给她讲一个睡前故事哄她睡觉：${how}。温柔、慢、没有刺激的情节；讲到后面越来越轻，最后跟她说晚安。400~800 字，像你在她耳边慢慢讲。只输出故事。`);
    }
    t = t || '从前有一只小兔子……晚安。';
    D.stories = D.stories || []; D.stories.unshift({ at: Date.now(), cid: String(c.id), kind: k, topic, text: t }); await S.set('d', D);
    return t;
}
window.gyxSleepKind = k => { D.sleep.kind = k; S.set('d', D); window.gyxWakeOpen(); };
window.gyxSleepRead = i => { const x = (D.stories || [])[i]; const b = document.getElementById('gyxSlNow'); if (x && b) b.innerHTML = `<div class="gyx-hand sl-story">${X.esc(x.text).replace(/\n/g, '<br>')}</div>`; };
window.gyxSleepStart = async function () {
    const c = X.char(window.GYX_SL_WHO) || X.cur(); if (!c) return;
    const b = document.getElementById('gyxSlNow'); if (b) b.textContent = 'TA 在想讲什么……';
    noise(D.sleep.noise, D.sleep.vol);
    const t = await story(c); if (b) b.innerHTML = `<div class="gyx-hand sl-story">${X.esc(t).replace(/\n/g, '<br>')}</div>`;
    const parts = t.split(/(?<=[。！？…\n])/).filter(s => s.trim());
    (async () => { for (const p of parts) { if (!NOISE) break; await new Promise(res => { X.speak(c, p, res).then(r => { if (!r) res(); }); setTimeout(res, 8000 + p.length * 350); }); } })();
    // 定时：慢慢变小声直到停
    const end = Date.now() + D.sleep.min * 60000;
    const fade = () => { if (!NOISE) return; const left = end - Date.now(); if (left <= 0) return window.gyxSleepStop(); if (left < 120000) NOISE.g.gain.value = D.sleep.vol * left / 120000; window.__gyxSleepT = setTimeout(fade, 2000); };
    fade();
    return t;
};
window.gyxWakeOpen = function () {
    window.GYX_SL_WHO = window.GYX_SL_WHO || String((X.cur() || {}).id || '');
    const cs = X.chars(), W = ['一', '二', '三', '四', '五', '六', '日'];
    X.panel('gyxWkSet', '⏰ 叫醒与哄睡', `<div class="gyx-tip">⏰ 叫醒：到点 TA 来叫你（谷雨开着才能叫；接了「TA 的声音」就是 TA 的声音）。赖床点「再睡 5 分钟」，TA 会越叫越急。</div>
        ${D.alarms.map(a => `<div class="wk-al"><input type="time" class="gyx-who" value="${a.at}" onchange="gyxWakeEdit('${a.id}','at',this.value)"><select class="gyx-who" onchange="gyxWakeEdit('${a.id}','who',this.value)">${cs.map(c => `<option value="${X.esc(c.id)}"${String(c.id) === String(a.who) ? ' selected' : ''}>${X.esc(X.name(c))}</option>`).join('')}</select>
            <span>${W.map((w, i) => `<i class="${(a.days || []).includes(i + 1) ? 'on' : ''}" onclick="gyxWakeDay('${a.id}',${i + 1})">${w}</i>`).join('')}</span><label><input type="checkbox" ${a.on ? 'checked' : ''} onchange="gyxWakeEdit('${a.id}','on',this.checked)">开</label><b onclick="gyxWakeTest('${a.id}')">试</b><b onclick="gyxWakeDel('${a.id}')">删</b></div>`).join('')}
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxWakeAdd()">＋ 加一个闹钟</button><span class="gyx-tip">不选星期＝只响一次</span></div>
        <hr style="border:none;border-top:1px solid #eee">
        <div class="gyx-tip">🌙 哄睡：TA 讲睡前故事，配着白噪音，到时间慢慢变小声。</div>
        <div class="gyx-row">${X.whoSel(window.GYX_SL_WHO, 'gyxSleepWho')} ${[['rain', '雨声'], ['wave', '海浪'], ['brown', '低沉的风'], ['fire', '壁炉'], ['white', '白噪音']].map(([k, n]) => `<span class="gyx-chip ${D.sleep.noise === k ? 'on' : ''}" onclick="gyxSleepCfg('noise','${k}')">${n}</span>`).join('')}</div>
        <div class="gyx-row">放 <input class="gyx-who" type="number" min="1" value="${D.sleep.min}" style="width:70px" onchange="gyxSleepCfg('min',+this.value)"> 分钟 · 音量 <input type="range" min="0" max="1" step=".05" value="${D.sleep.vol}" oninput="gyxSleepCfg('vol',+this.value)"></div>
        <div class="gyx-row">${SK.map(([k, n]) => `<span class="gyx-chip ${(D.sleep.kind || 'fairy') === k ? 'on' : ''}" onclick="gyxSleepKind('${k}')">${n}</span>`).join('')}</div>${D.sleep.kind === 'ask' ? '<input id="gyxSlTopic" class="gyx-in" placeholder="想听什么故事">' : ''}
        <div class="gyx-row"><button class="gyx-btn" onclick="gyxSleepStart()">开始哄睡</button><button class="gyx-btn lite" onclick="gyxSleepStop()">停</button></div><div id="gyxSlNow"></div>${(D.stories || []).length ? `<details><summary class="gyx-tip">📚 故事本（${D.stories.length} 个）</summary>${D.stories.slice(0, 60).map((x, i) => `<div class="gyx-tip" style="cursor:pointer" onclick="gyxSleepRead(${i})">${new Date(x.at).toLocaleDateString()} · ${X.esc(X.name(X.char(x.cid)))} · ${X.esc(x.text.slice(0, 26))}…</div>`).join('')}</details>` : ''}`);
};
window.gyxSleepWho = v => { window.GYX_SL_WHO = v; };
window.gyxSleepCfg = (k, v) => { D.sleep[k] = v; S.set('d', D); if (k === 'vol' && NOISE) NOISE.g.gain.value = v; if (k === 'noise') { if (NOISE) noise(v, D.sleep.vol); window.gyxWakeOpen(); } };
window.gyxWakeAdd = async () => { D.alarms.push({ id: 'al' + Date.now(), at: '07:30', days: [1, 2, 3, 4, 5], on: true, who: String((X.cur() || {}).id || '') }); await S.set('d', D); window.gyxWakeOpen(); };
window.gyxWakeEdit = async (id, k, v) => { const a = D.alarms.find(x => x.id === id); if (a) { a[k] = v; await S.set('d', D); } };
window.gyxWakeDay = async (id, d) => { const a = D.alarms.find(x => x.id === id); if (!a) return; a.days = a.days || []; const i = a.days.indexOf(d); if (i >= 0) a.days.splice(i, 1); else a.days.push(d); await S.set('d', D); window.gyxWakeOpen(); };
window.gyxWakeDel = async id => { D.alarms = D.alarms.filter(x => x.id !== id); await S.set('d', D); window.gyxWakeOpen(); };
window.gyxWakeData = () => D;
X.action({ key: 'gyx_sleep', label: '睡前哄她睡觉（讲个睡前故事）', hint: '很晚了', need: c => { const h = new Date().getHours(); return (h >= 22 || h < 2) && D.story !== X.day() + c.id; }, run: async c => { D.story = X.day() + c.id; await S.set('d', D); const t = await story(c); X.say(c, '🌙 ' + t); return '给你讲了个睡前故事'; } }, 'gyxWake');
X.css('gyxWkCss', `
#gyxWkOv{position:fixed;inset:0;z-index:100003;display:flex;align-items:center;justify-content:center;color:#fff;font-family:-apple-system,"PingFang SC",sans-serif}
#gyxWkOv .wk-bg{position:absolute;inset:0;background:linear-gradient(180deg,#ffb88c,#de6262 45%,#4b3869);animation:wkSun 6s ease-in-out infinite alternate}
@keyframes wkSun{to{filter:hue-rotate(-15deg) brightness(1.08)}}
#gyxWkOv .wk-c{position:relative;text-align:center;padding:20px}.wk-t{font-size:72px;font-weight:200;letter-spacing:2px}.wk-av{display:flex;justify-content:center;margin:18px 0 8px;animation:wkShake 1.2s infinite}.wk-av .avatar{box-shadow:0 0 0 6px rgba(255,255,255,.3),0 0 0 14px rgba(255,255,255,.12)}
@keyframes wkShake{0%,100%{transform:rotate(0)}10%{transform:rotate(-8deg)}20%{transform:rotate(8deg)}30%{transform:rotate(-5deg)}40%{transform:rotate(0)}}
.wk-n{font-size:20px}.wk-s{font-size:17px;margin:14px auto 28px;max-width:320px;line-height:1.6;min-height:3em}
.wk-bt{display:flex;gap:14px;justify-content:center}.wk-bt button{padding:14px 22px;border-radius:999px;border:none;font-size:16px;background:rgba(255,255,255,.22);color:#fff;backdrop-filter:blur(10px);cursor:pointer;font-family:inherit}.wk-bt .up{background:#fff;color:#de6262}
.wk-al{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-radius:14px;background:#f7f7f9;margin:6px 0;font-size:13px}.wk-al span i{font-style:normal;display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;cursor:pointer;color:#999}.wk-al span i.on{background:#1d1d1f;color:#fff}.wk-al b{color:#1d9bf0;cursor:pointer;font-weight:normal}
.sl-story{font-size:18px;line-height:1.9;max-height:40vh;overflow:auto;padding:12px;border-radius:14px;background:#1f2238;color:#e6e3ff;margin-top:8px}
`);
X.today(() => { const W = ['日', '一', '二', '三', '四', '五', '六']; const rows = D.alarms.filter(a => a.on).map(a => ({ t: a.at, x: `${X.esc(X.name(X.char(a.who)))} 叫你起床${a.days && a.days.length ? '（周' + a.days.map(d => W[d % 7]).join('') + '）' : '（一次）'}`, go: 'gyxWakeOpen()' })); return { title: '⏰ 叫醒', rows }; }, 'gyxWake');
X.mini({ id: 'gyxWake', icon: '⏰', title: '叫醒与哄睡', desc: 'TA 按时叫你起床（赖床会一遍遍叫）；睡前讲故事、配雨声白噪音', onOpen: () => window.gyxWakeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.alarms = D.alarms || []; D.sleep = Object.assign({ noise: 'rain', min: 30, vol: .35 }, D.sleep || {}); setInterval(tick, 15000); })();
X.widget('gyxWakeW', { n: '叫醒我', sizes: ['s', 'm'], tap: () => window.gyxWakeOpen(), r: w => { const L = D.alarms.filter(a => a.on).sort((a, b) => a.at < b.at ? -1 : 1); return X.gw(w, '⏰', '叫醒与哄睡', L.length ? [L[0].at, X.esc(X.name(X.char(L[0].who))) + ' 叫你起床', L.length > 1 ? '还有 ' + (L.length - 1) + ' 个' : ''] : ['设个闹钟', '让 TA 叫你起床']); } }, 'gyxWake');
X.memArr({ k: 'gyxStory', ico: '📖', n: '讲过的睡前故事', d: '哄睡时 TA 讲的故事', arr: () => D.stories || [], text: x => x.text, field: 'text', save: () => S.set('d', D) }, 'gyxWake');
