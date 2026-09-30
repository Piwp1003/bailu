/* 🌙 TA 的梦：早上 TA 会跟你讲昨晚梦到了什么（从最近聊的事里长出来的），还有一本梦的本子 */
if (window.__gyxDream) return; window.__gyxDream = 1;
X.feat('gyxDream', { n: '🌙 TA 的梦', desc: '早上 TA 会讲昨晚梦到什么，还有一本梦的本子' });
const S = X.store('dream');
let D = { list: [], done: {}, cfg: { auto: true, p: 60 } };   // p：每天早上做梦并告诉你的概率
const MOODS = ['甜', '奇怪', '有点吓人', '好笑', '怀念', '难过', '荒诞', '温柔'];
async function dream(c) {
    if (X.bailu()) {
        const t = X.cards(['梦', '日记', '聊天'], c, 3).join('');
        return { title: '昨晚的梦', mood: X.pick(MOODS), text: t || '梦到你了，醒来就忘了细节，只记得你在笑。', tell: X.cards(['梦', '聊天'], c, 1)[0] || '我昨晚梦到你了。' };
    }
    const r = await X.ask(`${X.who(c)}\n最近你们的聊天：\n${X.recent(c, 20) || '（没什么）'}\n\n你昨晚做了一个梦。梦要像真的梦：从最近聊过的事、白天见过的东西里长出来，但会变形、跳跃、不讲逻辑（场景突然切换、人物身份错位、明明知道很怪却觉得理所当然）。她可能出现在梦里，也可能没有。\n写两样东西：\n1. 梦本身（120~300 字，第一人称，像刚醒来写在本子上的，零碎一点）\n2. 早上你会怎么跟她提起这个梦（一两句，口语，按你的性格）\n只输出 JSON：{"title":"给这个梦起个名字","mood":"这个梦的感觉（一两个字）","text":"梦的内容","tell":"跟她说的话"}`);
    const j = X.json(r);
    if (j && j.text) return j;
    return r ? { title: '昨晚的梦', mood: '奇怪', text: X.plain(r), tell: '我昨晚做了个好奇怪的梦……' } : null;
}
async function tell(c, force) {
    c = c || X.cur(); if (!c) return null;
    const d = await dream(c); if (!d) return null;
    const it = { id: 'dr' + Date.now(), cid: String(c.id), at: Date.now(), title: d.title || '昨晚的梦', mood: d.mood || '', text: d.text || '', tell: d.tell || '' };
    D.list.unshift(it); D.done[String(c.id) + ':' + X.day()] = 1; await S.set('d', D);
    X.say(c, it.tell || '我昨晚梦到你了。');
    X.say(c, `🌙 【梦】${it.title}\n${it.text}`, { type: undefined, gyxDream: it.id });
    X.notify(c, `🌙 ${X.name(c)} 跟你讲了昨晚的梦：${it.title}`, '', 'gyxDreamOpen');
    return it;
}
window.gyxDreamTell = tell;
// 早上（5~12 点）第一次打开：按概率，TA 来讲梦
async function tick() { if (!X.on('gyxDream')) return;
    if (!D.cfg.auto) return;
    const h = new Date().getHours(); if (h < 5 || h >= 12) return;
    for (const c of X.chars()) {
        const k = String(c.id) + ':' + X.day(); if (D.done[k]) continue;
        D.done[k] = 1; await S.set('d', D);
        if (X.auto(c)) continue;   // 自主模式的角色自己决定讲不讲（在 TA 的行动菜单里）
        if (Math.random() * 100 < (+D.cfg.p || 0)) { await tell(c); break; }
    }
}
X.action({ key: 'gyx_dream', label: '跟对方讲昨晚做的梦', hint: '早上想起昨晚的梦', need: c => { const h = new Date().getHours(); return h >= 5 && h < 14 && !D.list.some(d => d.cid === String(c.id) && X.day(new Date(d.at)) === X.day()); }, run: async c => (await tell(c)) ? '跟你讲了昨晚的梦' : null }, 'gyxDream');
window.gyxDreamOpen = function (who) {
    const c = X.char(who) || X.cur(); const cid = c ? String(c.id) : '';
    const L = D.list.filter(d => !cid || d.cid === cid);
    X.panel('gyxDrOv', '🌙 梦的本子', `<div class="gyx-row">${X.whoSel(cid, 'gyxDreamOpen')}<button class="gyx-btn" onclick="this.disabled=true;this.textContent='TA 在回想……';gyxDreamTell(GYX.char('${cid}')).then(()=>gyxDreamOpen('${cid}'))">让 TA 讲一个梦</button></div>
        <div class="gyx-row"><label><input type="checkbox" ${D.cfg.auto ? 'checked' : ''} onchange="gyxDreamCfg('auto',this.checked)"> 早上 TA 会主动讲（默认模式的角色按概率</label><input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.p}" style="width:70px" onchange="gyxDreamCfg('p',+this.value)">%；自主模式的 TA 自己决定）</div>
        <div class="dr-list">${L.length ? L.map(d => `<div class="dr-it"><div class="dr-h"><b>${X.esc(d.title)}</b><em>${X.esc(d.mood)}</em><span>${new Date(d.at).toLocaleDateString()}</span></div><p class="gyx-hand">${X.esc(d.text).replace(/\n/g, '<br>')}</p></div>`).join('') : '<div class="gyx-tip">还没有梦。</div>'}</div>`, 'dark');
};
window.gyxDreamCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
X.css('gyxDrCss', `
#gyxDrOv .gyx-box{background:linear-gradient(175deg,#141a33,#27204a 60%,#3b2a55);color:#ecebff}#gyxDrOv .gyx-hd{background:rgba(20,26,51,.85)}#gyxDrOv .gyx-tip{color:#a9a8d6}#gyxDrOv .gyx-btn{background:#ecebff;color:#141a33}#gyxDrOv .gyx-who{background:#2a2750;color:#fff;border-color:#443f77}
.dr-it{position:relative;margin:12px 0;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
.dr-it::before{content:"☾";position:absolute;right:14px;top:10px;opacity:.25;font-size:22px}
.dr-h{display:flex;gap:8px;align-items:baseline}.dr-h em{font-style:normal;font-size:12px;padding:1px 8px;border-radius:999px;background:rgba(185,166,255,.2);color:#d6ccff}.dr-h span{margin-left:auto;font-size:11.5px;color:#a9a8d6}
.dr-it p{font-size:17px;line-height:1.9;margin:8px 0 0;color:#f3f1ff}
`);
X.today(() => ({ title: '🌙 TA 的梦', rows: D.list.filter(d => X.day(new Date(d.at)) === X.day()).map(d => ({ t: X.name(X.char(d.cid)), x: '梦到了「' + X.esc(d.title) + '」', go: `gyxDreamOpen('${d.cid}')` })) }), 'gyxDream');
X.mini({ id: 'gyxDream', icon: '🌙', title: 'TA 的梦', desc: '早上 TA 会讲昨晚梦到什么，还有一本梦的本子', onOpen: () => window.gyxDreamOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.cfg = Object.assign({ auto: true, p: 60 }, D.cfg || {}); D.list = D.list || []; D.done = D.done || {}; const go = () => { if (!window.__guyuBooted) return setTimeout(go, 1000); setTimeout(tick, 20000); }; go(); setInterval(tick, 10 * 60000); })();
