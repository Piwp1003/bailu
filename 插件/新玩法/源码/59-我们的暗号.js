/* 🔐 我们的暗号：和 TA 约几个只有你们懂的暗号——比如说「月亮」就是「我想你了」、发「🍵」就是「今天好累，哄我」。你一说暗号，TA 就照约好的那样回；TA 也会偷偷用暗号跟你说话，还会提议新的暗号 */
if (window.__gyxCode) return; window.__gyxCode = 1;
X.feat('gyxCode', { n: '🔐 我们的暗号', desc: '约好只有你们懂的暗号，你说了 TA 照约定回，TA 也会偷偷用' });
const S = X.store('code');
let D = { codes: {}, log: [], seen: {} };   // codes[cid] = [{id, w, mean, react, by, at, n}]; log = [{cid, w, who, at}]
const listOf = cid => (D.codes[String(cid)] = D.codes[String(cid)] || []);
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system');
const IDEAS = [['月亮', '我想你了'], ['🍵', '今天好累，哄哄我'], ['下雨了', '心情不好，需要抱抱'], ['三个点', '我在偷偷想你'], ['晚风', '晚安，我爱你'], ['小熊', '我想要抱抱'], ['🌙🌙', '早点睡，别熬夜'], ['橘子汽水', '今天发生了开心的事'], ['打卡', '我到家了，平安'], ['向日葵', '我今天很想见你']];
const hit = (t, w) => String(t || '').includes(w);
function lastHit(cid) { const L = H(cid), m = L[L.length - 1]; if (!m || m.sender !== 'me' || Date.now() - (m.timestamp || 0) > 10 * 60000) return null; const c = listOf(cid).find(x => hit(X.plain(m.text) || m.text, x.w)); return c ? { c, m } : null; }
async function watch() {
    if (!X.on('gyxCode')) return;
    for (const ch of X.chars()) {
        const cid = String(ch.id), L = H(cid), n = L.length; if (D.seen[cid] == null) { D.seen[cid] = n; continue; } if (n <= D.seen[cid]) { D.seen[cid] = n; continue; }
        const fresh = L.slice(D.seen[cid]); D.seen[cid] = n;
        for (const m of fresh) { if (m.gyxCode) continue; const own = m.sender === 'me'; const c = listOf(cid).find(x => hit(m.text, x.w)); if (!c) continue; c.n = (c.n || 0) + 1; D.log.unshift({ cid, w: c.w, who: own ? 'me' : 'ta', at: Date.now() }); if (D.log.length > 300) D.log.length = 300;
            if (own && X.bailu()) setTimeout(() => X.say(ch, c.react || X.pick(X.cards(['暗号', '情话'], ch, 2).concat([`收到暗号「${c.w}」。${c.mean}——我懂。`, `「${c.w}」……我知道的。我也是。`])), { gyxCode: 1 }), 1600); }
        await S.set('d', D);
    }
}
window.gyxCodeAdd = async cid => { const w = ((document.getElementById('gyxCdW') || {}).value || '').trim(), mean = ((document.getElementById('gyxCdM') || {}).value || '').trim(), react = ((document.getElementById('gyxCdR') || {}).value || '').trim(); if (!w || !mean) { X.toast('🔐 暗号和意思都要写', ''); return; } if (listOf(cid).some(x => x.w === w)) { X.toast('🔐 这个暗号已经有了', ''); return; } listOf(cid).unshift({ id: 'cd' + Date.now().toString(36), w, mean, react, by: 'me', at: Date.now(), n: 0 }); await S.set('d', D); window.gyxCodeOpen(cid); };
window.gyxCodeDel = async (cid, id) => { D.codes[cid] = listOf(cid).filter(x => x.id !== id); await S.set('d', D); window.gyxCodeOpen(cid); };
window.gyxCodeSet = async (cid, id, k, v) => { const x = listOf(cid).find(y => y.id === id); if (x) { x[k] = v; await S.set('d', D); } };
async function invent(c) {
    let j = X.bailu() ? null : X.json(await X.ask(`${X.who(c)}\n你想和她约一个只有你们俩懂的暗号。已经有的：${listOf(c.id).map(x => x.w + '=' + x.mean).join('；') || '（还没有）'}\n最近的聊天：\n${X.recent(c, 12)}\n想一个新的（最好和你们之间的事有关，短，说出来别人听不懂）。\n只输出 JSON：{"w":"暗号（1~6 个字或一个 emoji）","mean":"意思","say":"你提议时说的话"}`));
    if (!j || !j.w) { const free = IDEAS.filter(x => !listOf(c.id).some(y => y.w === x[0])); const [w, mean] = free.length ? X.pick(free) : [X.pick(['小船', '星光', '糖', '风铃']) + Math.floor(Math.random() * 99), '我在想你']; j = { w, mean, say: `以后你说「${w}」，就是「${mean}」的意思。只有我们知道。` }; }
    if (listOf(c.id).some(x => x.w === j.w)) return null;
    const it = { id: 'cd' + Date.now().toString(36), w: String(j.w).slice(0, 8), mean: String(j.mean).slice(0, 40), react: '', by: 'ta', at: Date.now(), n: 0 }; listOf(c.id).unshift(it); await S.set('d', D); it.say = j.say; return it;
}
window.gyxCodeInvent = async cid => { const c = X.char(cid) || X.cur(); const it = await invent(c); if (it) X.say(c, `🔐 ${X.plain(it.say || '')}`); window.gyxCodeOpen(c.id); return it; };
window.gyxCodeData = () => D;
window.gyxCodeOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = listOf(cid);
    X.panel('gyxCdOv', '🔐 我们的暗号', `<div class="gyx-row">${X.whoSel(cid, 'gyxCodeOpen')}<button class="gyx-btn lite" onclick="this.disabled=true;gyxCodeInvent('${cid}')">让 TA 想一个</button></div>
        <div class="gyx-tip">${X.v('只有你们俩懂的话。', '别人看见了也不知道是什么意思。', '说出暗号，TA 就懂。')}在聊天里说出暗号，TA 会照约好的意思回你。</div>
        ${L.map(x => `<div class="cd-it"><b contenteditable="true" onblur="gyxCodeSet('${cid}','${x.id}','w',this.innerText.trim())">${X.esc(x.w)}</b><span>＝ <i contenteditable="true" onblur="gyxCodeSet('${cid}','${x.id}','mean',this.innerText.trim())">${X.esc(x.mean)}</i>${x.react ? `<em>TA 回：${X.esc(x.react)}</em>` : ''}<em>${x.by === 'ta' ? 'TA 提议的' : '你定的'} · 用过 ${x.n || 0} 次</em></span><a onclick="gyxCodeDel('${cid}','${x.id}')">删</a></div>`).join('') || '<div class="gyx-tip">还没有暗号</div>'}
        <div class="gyx-card"><input id="gyxCdW" class="gyx-in" placeholder="暗号（比如：月亮 / 🍵 / 三个点）"><input id="gyxCdM" class="gyx-in" style="margin-top:6px" placeholder="意思（比如：我想你了）"><input id="gyxCdR" class="gyx-in" style="margin-top:6px" placeholder="想让 TA 怎么回（可空，空着 TA 自己发挥）"><div class="gyx-row"><button class="gyx-btn" onclick="gyxCodeAdd('${cid}')">约好了</button></div></div>`);
};
X.ctx(id => { const L = listOf(id); if (!L.length) return ''; const h = lastHit(String(id)); return `【你们的暗号（只有你们懂）】${L.map(x => `「${x.w}」＝${x.mean}`).join('；')}。${h ? `她刚刚说了暗号「${h.c.w}」——意思是「${h.c.mean}」。按你们的约定回应她${h.c.react ? '（约好的回法：' + h.c.react + '）' : ''}，可以也用暗号回，别把意思直白说破。` : '偶尔你也可以偷偷用暗号跟她说话。'}`; }, 'gyxCode');
X.action({ key: 'gyx_code', label: '偷偷用暗号跟她说句话', hint: '只有你们懂', need: c => listOf(c.id).length > 0,
    run: async c => { const x = X.pick(listOf(c.id)); x.n = (x.n || 0) + 1; D.log.unshift({ cid: String(c.id), w: x.w, who: 'ta', at: Date.now() }); await S.set('d', D); if (X.bailu()) { X.say(c, x.w); return '用暗号说了「' + x.w + '」'; } return (await X.reach(c, `你想跟她说「${x.mean}」，但用你们的暗号「${x.w}」来说（别解释意思）`)) ? '用暗号说了句话' : null; } }, 'gyxCode');
X.action({ key: 'gyx_code_new', label: '跟她约一个新暗号', hint: '只有你们懂的话', need: c => listOf(c.id).length < 8 && !listOf(c.id).some(x => x.by === 'ta' && Date.now() - x.at < 7 * 864e5),
    run: async c => { const it = await invent(c); if (!it) return null; X.say(c, `🔐 ${X.plain(it.say || '')}`); return '约了个新暗号'; } }, 'gyxCode');
X.today(() => { const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()); return { title: '🔐 暗号', rows: L.slice(0, 5).map(x => ({ t: x.who === 'me' ? '你说' : 'TA 说', x: '「' + X.esc(x.w) + '」', go: `gyxCodeOpen('${x.cid}')` })) }; }, 'gyxCode');
X.widget('gyxCodeW', { n: '我们的暗号', sizes: ['s', 'm'], tap: () => window.gyxCodeOpen(), r: w => { const c = X.cur(), L = c ? listOf(c.id) : []; return X.gw(w, '🔐', '我们的暗号', L.length ? [L.length + ' 个暗号', '「' + X.esc(X.pick(L).w) + '」'] : ['约一个？']); } }, 'gyxCode');
X.mem({ k: 'gyxCode', ico: '🔐', n: '我们的暗号', d: '暗号和意思（暗号＝意思）', items: c => listOf(c.id), text: x => x.w + '＝' + x.mean, edit: (x, v) => { const [a, b] = v.split(/＝|=/); x.w = (a || '').trim(); if (b != null) x.mean = b.trim(); }, del: (c, i) => { listOf(c.id).splice(i, 1); }, meta: x => (x.by === 'ta' ? 'TA 提议' : '你定的') + ' · 用过 ' + (x.n || 0) + ' 次', save: () => S.set('d', D) }, 'gyxCode');
X.css('gyxCdCss', `.cd-it{display:flex;gap:10px;align-items:center;padding:9px 4px;border-bottom:1px solid #f2f2f4}.cd-it b{font-size:18px;min-width:56px;outline:none}.cd-it span{flex:1;font-size:14px}.cd-it span i{font-style:normal;outline:none}.cd-it em{display:block;font-style:normal;font-size:11.5px;color:#999}.cd-it a{font-size:12px;color:#aaa;cursor:pointer}`);
X.mini({ id: 'gyxCode', icon: '🔐', title: '我们的暗号', desc: '只有你们懂的暗号', cat: '陪伴', onOpen: () => window.gyxCodeOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.codes = D.codes || {}; D.log = D.log || []; D.seen = D.seen || {}; setInterval(watch, 1200); })();
