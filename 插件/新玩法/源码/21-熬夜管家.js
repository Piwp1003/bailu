/* 🌙 熬夜管家：过了你定的睡觉时间还在玩，TA 会来催你——先温柔、再严肃、最后「我陪你一起躺下」；第二天早上还会说你；每周有一份熬夜小报告 */
if (window.__gyxNight) return; window.__gyxNight = 1;
X.feat('gyxNight', { n: '🌙 熬夜管家', desc: '过了睡觉时间还在玩，TA 会来催你睡觉' });
const S = X.store('night');
let D = { cfg: { bed: '00:30', who: '', gap: 20, strict: 2 }, log: {}, nag: {} };   // log[day]={last: 最晚还醒着的时间(分钟，跨零点算 24+)}
let lastAct = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => addEventListener(e, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
const mins = hm => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0); };
// 「夜里」的分钟数：凌晨算到 24 点以后（01:00 → 25*60）
const nightMin = d => { const m = d.getHours() * 60 + d.getMinutes(); return m < 12 * 60 ? m + 24 * 60 : m; };
const bedMin = () => { const b = mins(D.cfg.bed); return b < 12 * 60 ? b + 24 * 60 : b; };
const nightKey = d => { const x = new Date(d); if (x.getHours() < 12) x.setDate(x.getDate() - 1); return X.day(x); };
function who() { return X.char(D.cfg.who) || X.cur(); }
async function nag(c, level, late) {
    const lines = [['还不睡呀？', '已经很晚啦，放下手机好不好', '乖，该睡觉了'], ['我数到三，你放下手机', '再不睡我要生气了', '说好早睡的呢'], ['我陪你一起躺下，闭眼，不许偷看手机了', '好了，我把灯关了，晚安', '你不睡我也不睡了，陪你耗着']];
    if (X.bailu()) { X.say(c, X.cards(['熬夜', '晚安'], c, 1)[0] || X.pick(lines[Math.min(2, level)])); return; }
    const tone = ['温柔地提醒', '认真一点地催（有点生气但心疼）', '软下来，说要陪她一起躺下、哄她睡'][Math.min(2, level)];
    await X.reach(c, `现在已经 ${new Date().toTimeString().slice(0, 5)} 了，比她说好的睡觉时间（${D.cfg.bed}）晚了 ${late} 分钟，她还在玩手机。这是今晚你第 ${level + 1} 次催她，${tone}`);
}
async function tick() {
    if (!X.on('gyxNight')) return;
    const now = new Date(), nm = nightMin(now), k = nightKey(now);
    const active = Date.now() - lastAct < 5 * 60000 && !document.hidden;
    if (active && nm >= 21 * 60) { const L = D.log[k] = D.log[k] || {}; if (!L.last || nm > L.last) { L.last = nm; await S.set('d', D); } }
    if (!active || nm < bedMin()) return;
    const c = who(); if (!c) return; if (X.auto(c) && !X.on('gyxNight.auto')) return;
    const N = D.nag[k] = D.nag[k] || { n: 0, at: 0 };
    if (N.n >= Math.max(1, +D.cfg.strict + 1) || Date.now() - N.at < (+D.cfg.gap || 20) * 60000) return;
    N.at = Date.now(); const lv = N.n++; await S.set('d', D);
    await nag(c, lv, nm - bedMin());
}
// 早上：昨晚熬夜了，TA 说你两句
async function morning() {
    if (!X.on('gyxNight')) return; const h = new Date().getHours(); if (h < 6 || h > 12) return;
    const y = new Date(); y.setDate(y.getDate() - 1); const k = X.day(y), L = D.log[k];
    if (!L || !L.last || L.last < bedMin() + 30 || L.said) return;
    L.said = 1; await S.set('d', D); const c = who(); if (!c) return;
    const t = `${String(Math.floor(L.last / 60) % 24).padStart(2, '0')}:${String(L.last % 60).padStart(2, '0')}`;
    if (X.bailu()) X.say(c, X.cards(['熬夜', '早安'], c, 1)[0] || '昨晚又熬夜了吧？今天中午补个觉。');
    else await X.reach(c, `她昨晚一直到 ${t} 才睡（说好 ${D.cfg.bed} 睡的）。早上见到她，按你的性格说说她（心疼、念叨、或者罚她今晚早睡）`);
}
function week() { const out = []; for (let i = 7; i >= 1; i--) { const d = new Date(); d.setDate(d.getDate() - i); const L = D.log[X.day(d)]; out.push({ d, last: L && L.last }); } return out; }
const fmt = m => m ? `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '—';
window.gyxNightOpen = function () {
    const W = week(), late = W.filter(x => x.last && x.last > bedMin()).length, bm = bedMin();
    X.panel('gyxNtOv', '🌙 熬夜管家', `<div class="gyx-row">谁来管你：<select class="gyx-who" onchange="gyxNightCfg('who',this.value)"><option value="">最近聊天的人</option>${X.chars().map(c => `<option value="${X.esc(c.id)}"${String(c.id) === String(D.cfg.who) ? ' selected' : ''}>${X.esc(X.name(c))}</option>`).join('')}</select></div>
        <div class="gyx-row">几点该睡：<input type="time" class="gyx-who" value="${D.cfg.bed}" onchange="gyxNightCfg('bed',this.value)"> · 每隔 <input class="gyx-who" type="number" min="1" value="${D.cfg.gap}" style="width:60px" onchange="gyxNightCfg('gap',+this.value)"> 分钟催一次 · 最多 <input class="gyx-who" type="number" min="0" value="${+D.cfg.strict + 1}" style="width:60px" onchange="gyxNightCfg('strict',+this.value-1)"> 次</div>
        <div class="gyx-tip">过了睡觉时间你还在谷雨里点来点去，TA 就会来催。第二天早上，如果你熬得很晚，TA 也会说你。</div>
        <div class="nt-rep"><b>这周 ${late} 天熬夜</b><div class="nt-bars">${W.map(x => { const h = x.last ? Math.max(6, Math.min(100, (x.last - 21 * 60) / (8 * 60) * 100)) : 4; return `<div><i style="height:${h}%;background:${x.last && x.last > bm ? '#ff7a8a' : '#8fb8ff'}"></i><span>${'日一二三四五六'[x.d.getDay()]}</span><em>${fmt(x.last)}</em></div>`; }).join('')}</div><div class="gyx-tip">柱子越高睡得越晚；红色＝超过了你定的时间</div></div>`, 'dark');
};
window.gyxNightCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxNightTest = async () => { const c = who(); await nag(c, 0, 30); };
window.gyxNightData = () => D;
X.action({ key: 'gyx_night', label: '催她早点睡（她还在熬夜）', hint: '已经过了她的睡觉时间', need: () => { const nm = nightMin(new Date()); return nm >= bedMin() && Date.now() - lastAct < 5 * 60000; }, run: async c => { await nag(c, 0, nightMin(new Date()) - bedMin()); return '催你去睡觉'; } }, 'gyxNight');
X.ctx(() => { const nm = nightMin(new Date()); if (nm < bedMin()) return ''; return `【熬夜】现在已经过了她说好的睡觉时间（${D.cfg.bed}），她还没睡。你会惦记着让她早点去睡。`; }, 'gyxNight');
X.today(() => { const y = new Date(); y.setDate(y.getDate() - 1); const L = D.log[X.day(y)]; const rows = [{ t: D.cfg.bed, x: '今晚该睡的时间', go: 'gyxNightOpen()' }]; if (L && L.last) rows.push({ t: fmt(L.last), x: L.last > bedMin() ? '<b>昨晚熬夜了</b>' : '昨晚按时睡了 👍', go: 'gyxNightOpen()' }); return { title: '🌙 睡觉', rows }; }, 'gyxNight');
X.css('gyxNtCss', `#gyxNtOv .gyx-box{background:linear-gradient(170deg,#1d2140,#2d2350);color:#eef}#gyxNtOv .gyx-hd{background:rgba(29,33,64,.9)}#gyxNtOv .gyx-tip{color:#aab}#gyxNtOv .gyx-who{background:#2b2f55;color:#fff;border-color:#454a7a}
.nt-rep{margin-top:12px;padding:14px;border-radius:18px;background:rgba(255,255,255,.06)}.nt-bars{display:flex;gap:8px;height:140px;align-items:flex-end;margin:10px 0}.nt-bars div{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;font-size:11px}.nt-bars i{width:70%;border-radius:6px 6px 2px 2px}.nt-bars span{margin-top:4px}.nt-bars em{font-style:normal;color:#99a;font-size:10px}`);
X.mini({ id: 'gyxNight', icon: '🌙', title: '熬夜管家', desc: '过了睡觉时间还在玩，TA 会来催你；还有每周熬夜报告', onOpen: () => window.gyxNightOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ bed: '00:30', who: '', gap: 20, strict: 2 }, D.cfg || {}); D.log = D.log || {}; D.nag = D.nag || {}; setInterval(tick, 60000); setTimeout(morning, 20000); setInterval(morning, 30 * 60000); })();
