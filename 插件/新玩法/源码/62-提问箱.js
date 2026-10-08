/* 📮 提问箱：TA 有一个公开的提问箱——你可以署名问，也可以匿名问（TA 不知道是你，会像回陌生人那样答，说不定会聊到你）。别的角色和路人也会往里投问题，TA 隔一阵子统一回答，回答都挂在 TA 的提问箱主页上 */
if (window.__gyxAskBox) return; window.__gyxAskBox = 1;
X.feat('gyxAskBox', { n: '📮 提问箱', desc: '给 TA 投提问（可匿名），TA 隔一阵子统一回答，别人也会来问' });
const S = X.store('askbox');
let D = { qs: [], cfg: { min: 10, max: 120, crowd: true } };   // [{id, cid, from:'me'|'anon'|'npc'|角色id, q, at, due, a, aat}]
const NPC_Q = ['你理想型是什么样的？', '最近在听什么歌？', '有喜欢的人吗？', '你会做饭吗？', '一个人的时候都在干嘛？', '最难忘的一次约会？', '你哭过吗，为什么？', '如果可以重来，你想改变什么？', '你觉得自己是个什么样的人？', '有什么一直想做但没做的事？', '你吃醋的时候是什么样？', '最近一次心动是什么时候？', '你相信一见钟情吗？', '最喜欢的季节？为什么？', '你会怎么哄生气的人？', '你的口头禅是什么？', '对你很重要的一个人是谁？', '你害怕什么？', '你睡前会想什么？', '可以说一个你的小秘密吗？'];
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const label = x => x.from === 'me' ? X.me(X.char(x.cid)) : x.from === 'anon' ? '匿名' : x.from === 'npc' ? '路人' : X.name(X.char(x.from));
async function answer(x) {
    const c = X.char(x.cid); if (!c) return;
    const who = x.from === 'me' ? '她（你喜欢的人）署名问你的' : x.from === 'anon' ? '一个匿名的人问的（你不知道是谁）' : x.from === 'npc' ? '一个路人问的' : `${label(x)} 问的`;
    let a = X.bailu() ? null : await X.ask(`${X.who(c)}\n你在自己公开的提问箱里回答问题（大家都看得到）。这个问题是${who}：\n「${x.q}」\n按你的性格回答（公开回答，30~120 字；${x.from === 'anon' ? '你不知道提问的是她，可以聊到她，也可以不聊' : ''}）。只输出回答。`);
    x.a = X.plain(a || X.pick(X.cards(['提问箱', '聊天'], c, 2).concat(['这个嘛……不告诉你。', '好问题，下次再答（跑）', '有，而且她可能正在看。', '嗯……认真想了想，还是想说：现在挺好的。']))); x.aat = Date.now(); await S.set('d', D);
    if (x.from === 'me' || x.from === 'anon') X.notify(c, `📮 ${X.esc(X.name(c))} ${X.v('回答了你的提问', '在提问箱里回你了', '回了一个问题——是你问的那个')}`, x.q, () => window.gyxAskBoxOpen(x.cid));
}
function crowd(c) { const cid = String(c.id); if (!D.cfg.crowd || D.qs.filter(x => x.cid === cid && !x.a).length > 3) return; const others = X.chars().filter(o => String(o.id) !== cid); const from = others.length && Math.random() < .4 ? String(X.pick(others).id) : 'npc'; const used = new Set(D.qs.filter(x => x.cid === cid).map(x => x.q)); const q = X.pick(NPC_Q.filter(t => !used.has(t)).concat([X.pick(NPC_Q)])); D.qs.unshift({ id: 'aq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), cid, from, q, at: Date.now(), due: Date.now() + rnd(+D.cfg.min || 10, +D.cfg.max || 120) * 60000 }); }
async function tick() { if (!X.on('gyxAskBox')) return; for (const x of D.qs) if (!x.a && x.due <= Date.now()) await answer(x); if (Math.random() < .08) { const c = X.pick(X.chars()); if (c) { crowd(c); await S.set('d', D); } } }
window.gyxAskBoxTick = tick;
window.gyxAskBoxSend = async cid => { const q = ((document.getElementById('gyxAbQ') || {}).value || '').trim(), anon = !!(document.getElementById('gyxAbA') || {}).checked; if (!q) return; D.qs.unshift({ id: 'aq' + Date.now().toString(36), cid: String(cid), from: anon ? 'anon' : 'me', q, at: Date.now(), due: Date.now() + rnd(+D.cfg.min || 10, +D.cfg.max || 120) * 60000 }); await S.set('d', D); X.toast('📮 ' + X.v('投进去了', '问题放进箱子了', '咚——掉进去了'), anon ? 'TA 不知道是你问的' : '等 TA 回答'); window.gyxAskBoxOpen(cid); };
window.gyxAskBoxNow = async cid => { for (const x of D.qs.filter(y => y.cid === String(cid) && !y.a)) await answer(x); window.gyxAskBoxOpen(cid); };
window.gyxAskBoxDel = async id => { const x = D.qs.find(y => y.id === id); D.qs = D.qs.filter(y => y.id !== id); await S.set('d', D); window.gyxAskBoxOpen(x && x.cid); };
window.gyxAskBoxCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxAskBoxData = () => D;
window.gyxAskBoxOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.qs.filter(x => x.cid === cid), wait = L.filter(x => !x.a);
    X.panel('gyxAbOv', `📮 ${X.esc(X.name(c))} 的提问箱`, `<div class="gyx-row">${X.whoSel(cid, 'gyxAskBoxOpen')}${wait.length ? `<span class="gyx-tip">${wait.length} 个问题等 TA 回答</span><button class="gyx-btn lite" onclick="this.disabled=true;gyxAskBoxNow('${cid}')">催 TA 现在答</button>` : ''}</div>
        <div class="gyx-card"><textarea id="gyxAbQ" class="gyx-in" rows="2" placeholder="${X.v('想问 TA 什么？', '问一个平时不好意思问的问题', '投一个问题进去')}"></textarea><div class="gyx-row"><label class="gyx-tip"><input id="gyxAbA" type="checkbox"> 匿名（TA 不知道是你）</label><button class="gyx-btn" style="margin-left:auto" onclick="gyxAskBoxSend('${cid}')">投进去</button></div></div>
        ${L.filter(x => x.a).map(x => `<div class="ab-it"><div class="ab-q"><em>${X.esc(label(x))}${x.from === 'anon' ? '（其实是你）' : ''}</em>${X.esc(x.q)}</div><div class="ab-a">${X.esc(x.a)}</div><span>${new Date(x.aat).toLocaleString()} <i onclick="gyxAskBoxDel('${x.id}')">删</i></span></div>`).join('') || '<div class="gyx-tip">提问箱还是空的</div>'}
        <div class="gyx-row gyx-tip">TA 隔 <input class="gyx-who" type="number" min="0" value="${D.cfg.min}" style="width:50px" onchange="gyxAskBoxCfg('min',+this.value)">~<input class="gyx-who" type="number" min="0" value="${D.cfg.max}" style="width:56px" onchange="gyxAskBoxCfg('max',+this.value)"> 分钟回答 · <label><input type="checkbox" ${D.cfg.crowd ? 'checked' : ''} onchange="gyxAskBoxCfg('crowd',this.checked)"> 别人也会来问</label></div>`);
};
X.ctx(id => { const L = D.qs.filter(x => x.cid === String(id) && x.a).slice(0, 4); return L.length ? `【你在提问箱里公开回答过】${L.map(x => `「${x.q}」→${x.a.slice(0, 40)}`).join('；')}` : ''; }, 'gyxAskBox');
X.action({ key: 'gyx_askbox', label: '去提问箱回答几个问题', hint: '你的提问箱', need: c => D.qs.some(x => x.cid === String(c.id) && !x.a), run: async c => { const L = D.qs.filter(x => x.cid === String(c.id) && !x.a).slice(0, 3); for (const x of L) await answer(x); return '回答了 ' + L.length + ' 个提问'; } }, 'gyxAskBox');
X.today(() => ({ title: '📮 提问箱', rows: D.qs.filter(x => x.a && X.day(new Date(x.aat)) === X.day()).slice(0, 5).map(x => ({ t: label(x), x: X.esc(x.q.slice(0, 20)), go: `gyxAskBoxOpen('${x.cid}')` })) }), 'gyxAskBox');
X.widget('gyxAskBoxW', { n: '提问箱', sizes: ['s', 'm'], tap: () => window.gyxAskBoxOpen(), r: w => { const x = D.qs.find(y => y.a); return X.gw(w, '📮', '提问箱', x ? ['Q：' + X.esc(x.q.slice(0, 16)), 'A：' + X.esc(x.a.slice(0, 26))] : ['问 TA 一个问题']); } }, 'gyxAskBox');
X.memArr({ k: 'gyxAskBox', ico: '📮', n: '提问箱', d: '问题和 TA 的公开回答', arr: () => D.qs, text: x => x.q + ' → ' + (x.a || '（还没答）'), edit: (x, v) => { const [q, a] = v.split(' → '); x.q = q; if (a != null && a !== '（还没答）') x.a = a; }, meta: x => label(x) + ' 问 · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxAskBox');
X.css('gyxAbCss', `.ab-it{padding:10px 4px;border-bottom:1px solid #f2f2f4}.ab-q{background:#f7f7f9;border-radius:14px;padding:9px 12px;font-size:14px}.ab-q em{display:block;font-style:normal;font-size:11.5px;color:#999}.ab-a{padding:8px 12px 2px;font-size:14.5px;line-height:1.7}.ab-it>span{font-size:11px;color:#bbb;padding-left:12px}.ab-it i{font-style:normal;cursor:pointer;margin-left:6px}`);
X.mini({ id: 'gyxAskBox', icon: '📮', title: '提问箱', desc: '给 TA 投提问（可匿名），TA 公开回答', cat: '陪伴', onOpen: () => window.gyxAskBoxOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.qs = D.qs || []; D.cfg = Object.assign({ min: 10, max: 120, crowd: true }, D.cfg || {}); setTimeout(tick, 20000); setInterval(tick, 60000); })();
