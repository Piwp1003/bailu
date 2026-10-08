/* 🗣️ 口头禅互相传染：聊久了会越来越像——TA 会慢慢学会你常说的词（「救命」「好嘛」「🥺」……），你也会被 TA 带跑。这里能看到你的口头禅、TA 从你这学会了哪些、你从 TA 那学会了哪些，还有是哪天第一次说的 */
if (window.__gyxEcho) return; window.__gyxEcho = 1;
X.feat('gyxEcho', { n: '🗣️ 口头禅互相传染', desc: 'TA 慢慢学会你的口头禅，你也会被 TA 带跑，记下第一次说的那天' });
const S = X.store('echo');
let D = { got: {}, cfg: { level: 50, min: 3 } };   // got[cid] = [{id, w, dir:'ta'|'me', at, quote}]  dir=ta：TA 学会了你的；me：你学会了 TA 的
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side && m.timestamp);
const STOP = /^(我|你|他|她|它|的|了|是|在|就|也|都|和|吗|吧|呢|啊|好|不|这|那|有|没|要|会|去|来|说|看|想|一个|什么|怎么|这个|那个|然后|就是|还是|可以|知道|没有|今天|现在|一下|我们|你们|不是|因为|所以|但是|如果)$/;
// 把一条消息切成「小片段」：标点 / 空格分开、1~6 个字；表情和颜文字单独算
function bits(t) { t = X.plain(t); const out = []; (t.match(/[\u{1F300}-\u{1FAFF}☀-➿]|[（(][^（()）]{1,10}[)）]|[哈嘿嘻呜]{2,}|[~～]+/gu) || []).forEach(x => out.push(x.replace(/[~～]+/, '～'))); t.split(/[\s，。！？!?,.、…~～：:；;“”"'（）()【】\[\]\u{1F300}-\u{1FAFF}☀-➿]+/u).forEach(s => { if (s.length >= 1 && s.length <= 6 && /[一-龥a-zA-Z]/.test(s) && !STOP.test(s)) out.push(s); }); return out; }
function freq(L) { const f = {}; L.forEach(m => [...new Set(bits(m.text))].forEach(b => f[b] = (f[b] || 0) + 1)); return f; }
function profile(cid) {
    const all = H(cid), me = all.filter(m => m.sender === 'me'), ta = all.filter(m => m.sender !== 'me');
    const fm = freq(me), ft = freq(ta), min = Math.max(2, +D.cfg.min || 3);
    const mine = Object.entries(fm).filter(([w, n]) => n >= min && (ft[w] || 0) * me.length <= n * ta.length * .9 + 1e-9).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const his = Object.entries(ft).filter(([w, n]) => n >= min && (fm[w] || 0) * ta.length <= n * me.length * .9 + 1e-9).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return { mine, his, me, ta };
}
// 找「第一次说」：她的口头禅在 TA 嘴里第一次出现（在她说过 min 次之后），反过来也一样
function scan(c) {
    const cid = String(c.id), P = profile(cid), G = (D.got[cid] = D.got[cid] || []), all = H(cid), min = Math.max(2, +D.cfg.min || 3); let n = 0;
    const find = (w, fromMe) => { let cnt = 0; for (const m of all) { const mine = m.sender === 'me'; if (mine === fromMe) { if (bits(m.text).includes(w)) cnt++; } else if (cnt >= min && bits(m.text).includes(w)) return m; } return null; };
    P.mine.forEach(([w]) => { if (G.some(x => x.w === w && x.dir === 'ta')) return; const m = find(w, true); if (m) { G.push({ id: 'ec' + Date.now().toString(36) + n, w, dir: 'ta', at: m.timestamp, quote: X.plain(m.text).slice(0, 60) }); n++; } });
    P.his.forEach(([w]) => { if (G.some(x => x.w === w && x.dir === 'me')) return; const m = find(w, false); if (m) { G.push({ id: 'ec' + Date.now().toString(36) + 'm' + n, w, dir: 'me', at: m.timestamp, quote: X.plain(m.text).slice(0, 60) }); n++; } });
    G.sort((a, b) => b.at - a.at); return n;
}
// 白露：没有模型，就把她的口头禅变成 TA 专属的「字词」字卡（传染度越高放得越多）
function bailuTeach(c) {
    if (!window.bailuCards || !Array.isArray(window.bailuCards.cards)) return 0; const P = profile(String(c.id)), k = Math.round(P.mine.length * (+D.cfg.level || 0) / 100); let n = 0;
    P.mine.slice(0, k).forEach(([w]) => { const L = window.bailuCards.cards; if (L.some(x => x.t === w && (x.chars || []).includes(c.name))) return; L.push({ id: 'kecho' + Date.now().toString(36) + n, t: w, kinds: ['字词'], chars: [c.name], echo: 1 }); n++; });
    if (n) try { window.bailuCards.save(); } catch (e) {} return n;
}
async function tick() { if (!X.on('gyxEcho')) return; let n = 0; for (const c of X.chars()) { n += scan(c); if (X.bailu()) bailuTeach(c); } if (n) await S.set('d', D); }
window.gyxEchoScan = async cid => { const c = X.char(cid) || X.cur(); if (!c) return 0; const n = scan(c); if (X.bailu()) bailuTeach(c); await S.set('d', D); window.gyxEchoOpen(c.id); return n; };
window.gyxEchoDel = async (cid, id) => { D.got[cid] = (D.got[cid] || []).filter(x => x.id !== id); await S.set('d', D); window.gyxEchoOpen(cid); };
window.gyxEchoCfg = (k, v) => { D.cfg[k] = v; S.set('d', D); };
window.gyxEchoData = () => D;
window.gyxEchoOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), P = profile(cid), G = D.got[cid] || [];
    const chip = ([w, n]) => `<span class="gyx-chip">${X.esc(w)} <i style="font-style:normal;color:#aaa">×${n}</i></span>`;
    const got = dir => G.filter(x => x.dir === dir).map(x => `<div class="ec-it"><b>${X.esc(x.w)}</b><span>${new Date(x.at).toLocaleDateString()} 第一次说：「${X.esc(x.quote)}」</span><i onclick="gyxEchoDel('${cid}','${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没有</div>';
    X.panel('gyxEchoOv', '🗣️ 口头禅互相传染', `<div class="gyx-row">${X.whoSel(cid, 'gyxEchoOpen')}<button class="gyx-btn lite" onclick="gyxEchoScan('${cid}')">重新数一遍</button></div>
        <div class="ec-h">你的口头禅</div><div>${P.mine.map(chip).join('') || '<span class="gyx-tip">再多聊一会儿才数得出来</span>'}</div>
        <div class="ec-h">${X.esc(X.name(c))} 的口头禅</div><div>${P.his.map(chip).join('') || '<span class="gyx-tip">还数不出来</span>'}</div>
        <div class="ec-h">💬 ${X.esc(X.name(c))} 从你这学会的</div>${got('ta')}
        <div class="ec-h">💬 你从 ${X.esc(X.name(c))} 那学会的</div>${got('me')}
        <div class="gyx-row gyx-tip">传染度 <input type="range" min="0" max="100" value="${D.cfg.level}" onchange="gyxEchoCfg('level',+this.value)" style="flex:1"> · 说过 <input class="gyx-who" type="number" min="2" value="${D.cfg.min}" style="width:50px" onchange="gyxEchoCfg('min',+this.value)"> 次才算口头禅</div>
        <div class="gyx-tip">${X.bailu() ? '白露：你的口头禅会变成 TA 专属的「字词」字卡（传染度越高放得越多），TA 回你时就会用上。' : '传染度越高，TA 越会不自觉地用你的说法。'}</div>`);
};
X.ctx(id => { const lv = +D.cfg.level || 0; if (!lv) return ''; const P = profile(String(id)); if (!P.mine.length) return ''; const k = Math.max(1, Math.round(P.mine.length * lv / 100)); return `【她的口头禅】${P.mine.slice(0, k).map(x => '「' + x[0] + '」').join('')}。你们聊久了，你会不自觉地被她传染，偶尔用上一两个（${lv >= 70 ? '已经很像她了' : lv >= 35 ? '自然地、偶尔' : '很偶尔'}），别刻意。`; }, 'gyxEcho');
X.action({ key: 'gyx_echo', label: '说着说着用了她的口头禅，自己发现了', hint: '被她传染了', need: c => profile(String(c.id)).mine.length > 0,
    run: async c => { const w = X.pick(profile(String(c.id)).mine.slice(0, 5))[0]; return (await X.reach(c, `你发现自己最近老说「${w}」——这是她的口头禅，被她传染了。用上这个词说句话，然后自己发现了，跟她说「都怪你」之类的`)) ? '被你传染了口头禅' : null; } }, 'gyxEcho');
X.today(() => { const rows = []; X.chars().forEach(c => (D.got[String(c.id)] || []).filter(x => X.day(new Date(x.at)) === X.day()).forEach(x => rows.push({ t: x.dir === 'ta' ? 'TA 学会' : '你学会', x: '「' + X.esc(x.w) + '」', go: `gyxEchoOpen('${c.id}')` }))); return { title: '🗣️ 口头禅传染', rows }; }, 'gyxEcho');
X.widget('gyxEchoW', { n: '口头禅传染', sizes: ['s', 'm'], tap: () => window.gyxEchoOpen(), r: w => { const c = X.cur(), G = c ? D.got[String(c.id)] || [] : [], t = G.filter(x => x.dir === 'ta'); return X.gw(w, '🗣️', '口头禅传染', t.length ? ['TA 学会 ' + t.length + ' 个', '最近：「' + X.esc(t[0].w) + '」'] : ['还没被传染']); } }, 'gyxEcho');
X.mem({ k: 'gyxEcho', ico: '🗣️', n: '口头禅传染', d: '谁从谁那学会了哪个词、第一次说是哪天', items: c => D.got[String(c.id)] || [], text: x => x.w, edit: (x, v) => { x.w = v; }, del: (c, i) => { (D.got[String(c.id)] || []).splice(i, 1); }, meta: x => (x.dir === 'ta' ? 'TA 学会的' : '你学会的') + ' · ' + new Date(x.at).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxEcho');
X.css('gyxEchoCss', `.ec-h{font-weight:700;margin:12px 0 6px;font-size:14px}.ec-it{display:flex;gap:8px;align-items:baseline;padding:6px 2px;border-bottom:1px solid #f3f3f3;font-size:13.5px}.ec-it b{flex:none}.ec-it span{flex:1;color:#888;font-size:12px}.ec-it i{font-style:normal;font-size:11px;color:#aaa;cursor:pointer}`);
X.mini({ id: 'gyxEcho', icon: '🗣️', title: '口头禅互相传染', desc: 'TA 学会了你哪些词，你学会了 TA 哪些', cat: '回忆', onOpen: () => window.gyxEchoOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.got = D.got || {}; D.cfg = Object.assign({ level: 50, min: 3 }, D.cfg || {}); setTimeout(tick, 30000); setInterval(tick, 300000); })();
