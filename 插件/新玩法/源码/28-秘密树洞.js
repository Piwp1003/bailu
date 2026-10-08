/* 🌳 秘密树洞：把秘密说给 TA 听，TA 会认真回应、替你守着（你也能决定 TA 以后记不记得）；TA 也有自己的秘密，你们聊得越久，TA 就会慢慢告诉你一个 */
if (window.__gyxSecret) return; window.__gyxSecret = 1;
X.feat('gyxSecret', { n: '🌳 秘密树洞', desc: '说给 TA 的秘密；TA 的秘密会慢慢告诉你' });
const S = X.store('secret');
let D = { mine: [], ta: {}, cfg: { every: 5 } };   // mine:{id,cid,t,reply,remember,at}; ta[cid]={list:[{t,at}], next}
const chatDays = cid => { const H = (typeof globalChats !== 'undefined' && globalChats[cid]) || []; return new Set(H.filter(m => m.timestamp).map(m => X.day(new Date(m.timestamp)))).size; };
async function reply(c, t) {
    if (X.bailu()) return X.cards(['秘密', '安慰', '聊天'], c, 2).join('\n') || '我听到了。我会替你守着。';
    return X.plain(await X.ask(`${X.who(c)}\n她在树洞里告诉了你一个秘密：「${t}」。认真回应她（不评判、不说教；可以心疼、可以说你也有过类似的、可以只是安静地陪着），最后答应她替她守着。60~160 字。只输出回应。`) || '我听到了，我会一直替你守着。');
}
async function taSecret(c) {
    const cid = String(c.id), T = D.ta[cid] = D.ta[cid] || { list: [] };
    let t;
    if (X.bailu()) t = X.cards(['秘密', '日记', '聊天'], c, 2).join('') || '其实我第一次见你的时候，就偷偷记住了你的样子。';
    else t = X.plain(await X.ask(`${X.who(c)}\n最近的聊天：\n${X.recent(c, 16)}\n你之前告诉过她的秘密：${T.list.map(x => x.t).join('；') || '（还没有）'}\n\n你们已经很亲近了，你决定告诉她一个你从没说过的秘密（关于你自己、你的过去、或者关于她——比如你偷偷做过的事、一个小小的心结、一个没说出口的心意）。要符合你的人设，别和之前说过的重复。用你的口吻说出来，80~200 字。只输出你说的话。`) || '其实……我一直想跟你说，你来之前，我很少这么期待一个人。');
    T.list.push({ t, at: Date.now() }); T.next = chatDays(cid) + Math.max(1, +D.cfg.every || 5); await S.set('d', D);
    X.notify(c, `🌳 ${X.name(c)} 想告诉你一个秘密`, '去树洞里看', 'gyxSecretOpen');
    await X.reach(c, `你刚在树洞里告诉了她一个秘密：「${t.slice(0, 200)}」。现在在聊天里轻轻提一句（比如「我在树洞里给你留了点东西」），别把秘密原样再说一遍`);
    return t;
}
window.gyxSecretTa = id => taSecret(X.char(id) || X.cur());
window.gyxSecretOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), T = D.ta[cid] || { list: [] };
    const days = chatDays(cid), next = T.next || Math.max(1, +D.cfg.every || 5), left = Math.max(0, next - days);
    X.panel('gyxScOv', '🌳 秘密树洞', `<div class="gyx-row">${X.whoSel(cid, 'gyxSecretOpen')}</div>
        <div class="sc-hole"><textarea id="gyxScT" class="gyx-in" rows="3" placeholder="说给 ${X.esc(X.name(c))} 听……这里只有你们两个"></textarea><div class="gyx-row"><label><input id="gyxScR" type="checkbox" checked> 让 TA 以后记得这件事</label><button class="gyx-btn" style="margin-left:auto" onclick="gyxSecretTell('${cid}')">放进树洞</button></div></div>
        <div class="gyx-tip">🔒 ${X.esc(X.name(c))} 的秘密：${T.list.length ? `已经告诉你 ${T.list.length} 个` : '还没有告诉过你'}${left ? `，再聊 ${left} 天，TA 可能会再告诉你一个` : '，TA 随时可能告诉你下一个'}</div>
        ${T.list.map((s, i) => `<div class="sc-it ta"><b>🔓 秘密 ${i + 1}</b><p class="gyx-hand">${X.esc(s.t)}</p><em>${new Date(s.at).toLocaleDateString()}</em></div>`).join('')}
        ${D.mine.filter(s => s.cid === cid).reverse().map(s => `<div class="sc-it"><b>你说的</b><p>${X.esc(s.t)}</p><div class="sc-rep">${X.esc(X.name(c))}：${X.esc(s.reply || '……')}</div><em>${new Date(s.at).toLocaleDateString()} · ${s.remember ? 'TA 记着' : 'TA 听完就忘了'} <span onclick="gyxSecretForget('${s.id}')">${s.remember ? '让 TA 忘掉' : ''}</span></em></div>`).join('')}
        <div class="gyx-row gyx-tip">每聊满 <input class="gyx-who" type="number" min="1" value="${D.cfg.every}" style="width:60px" onchange="gyxSecretCfg(+this.value)"> 天，TA 会告诉你一个新秘密（自主模式的 TA 自己决定什么时候说）。</div>`, 'dark');
};
window.gyxSecretTell = async function (cid) {
    const c = X.char(cid), t = ((document.getElementById('gyxScT') || {}).value || '').trim(); if (!c || !t) return;
    const it = { id: 'sc' + Date.now(), cid, t, remember: !!(document.getElementById('gyxScR') || {}).checked, at: Date.now() };
    D.mine.push(it); await S.set('d', D); window.gyxSecretOpen(cid);
    it.reply = await reply(c, t); await S.set('d', D); window.gyxSecretOpen(cid); return it;
};
window.gyxSecretForget = async id => { const s = D.mine.find(x => x.id === id); if (s) { s.remember = false; await S.set('d', D); window.gyxSecretOpen(s.cid); } };
window.gyxSecretCfg = v => { D.cfg.every = v; S.set('d', D); };
window.gyxSecretData = () => D;
async function tick() { if (!X.on('gyxSecret')) return; for (const c of X.chars()) { if (X.auto(c)) continue; const cid = String(c.id), T = D.ta[cid] || {}, next = T.next || Math.max(1, +D.cfg.every || 5); if (chatDays(cid) >= next && Math.random() < .3) { await taSecret(c); break; } } }
X.action({ key: 'gyx_secret', label: '告诉她一个你从没说过的秘密', hint: '你们已经很亲近了', need: c => { const T = D.ta[String(c.id)] || {}; return chatDays(String(c.id)) >= (T.next || 2); }, run: async c => (await taSecret(c)) ? '告诉了你一个秘密' : null }, 'gyxSecret');
X.ctx(id => { const L = D.mine.filter(s => s.cid === String(id) && s.remember); const T = (D.ta[String(id)] || {}).list || []; let t = ''; if (L.length) t += `【她告诉过你的秘密（替她守着，别随便提，更别说给别人）】${L.slice(-6).map(s => s.t).join('；')}。`; if (T.length) t += `【你告诉过她的秘密】${T.map(s => s.t.slice(0, 60)).join('；')}。`; return t; }, 'gyxSecret');
X.today(() => ({ title: '🌳 树洞', rows: Object.entries(D.ta).flatMap(([cid, T]) => (T.list || []).filter(s => X.day(new Date(s.at)) === X.day()).map(() => ({ t: '🔓', x: `${X.esc(X.name(X.char(cid)))} 今天告诉了你一个秘密`, go: `gyxSecretOpen('${cid}')` }))) }), 'gyxSecret');
X.css('gyxScCss', `#gyxScOv .gyx-box{background:linear-gradient(175deg,#1f2a22,#2b3a2e);color:#e8f2e6}#gyxScOv .gyx-hd{background:rgba(31,42,34,.9)}#gyxScOv .gyx-tip{color:#a9bba6}#gyxScOv .gyx-in,#gyxScOv .gyx-who{background:#2f4033;color:#fff;border-color:#4a5e4d}#gyxScOv .gyx-btn{background:#e8f2e6;color:#1f2a22}
.sc-hole{padding:12px;border-radius:18px;background:rgba(0,0,0,.25);margin:8px 0}.sc-it{padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.06);margin:8px 0}.sc-it.ta{background:rgba(255,220,150,.1)}.sc-it b{font-size:13px;color:#cfe3c9}.sc-it p{margin:6px 0;font-size:15px;line-height:1.7}.sc-it.ta p{font-size:18px}.sc-rep{font-size:14px;color:#d6c9ff;line-height:1.7}.sc-it em{font-style:normal;font-size:11.5px;color:#90a38c}.sc-it em span{color:#ff9aa2;cursor:pointer;margin-left:6px}`);
X.mini({ id: 'gyxSecret', icon: '🌳', title: '秘密树洞', desc: '说给 TA 的秘密 TA 会守着；TA 的秘密会慢慢告诉你', onOpen: () => window.gyxSecretOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.mine = D.mine || []; D.ta = D.ta || {}; D.cfg = Object.assign({ every: 5 }, D.cfg || {}); setTimeout(tick, 40000); setInterval(tick, 60 * 60000); })();
X.widget('gyxSecretW', { n: '秘密树洞', sizes: ['s', 'm'], tap: () => window.gyxSecretOpen(), r: w => { const t = Object.values(D.ta).reduce((a, T) => a + (T.list || []).length, 0); return X.gw(w, '🌳', '秘密树洞', [D.mine.length + ' 个秘密', 'TA 告诉你 ' + t + ' 个']); } }, 'gyxSecret');
X.memArr({ k: 'gyxSecret', ico: '🌳', n: '你告诉 TA 的秘密', d: 'TA 替你守着', arr: () => D.mine, text: x => x.t, field: 't', meta: x => new Date(x.at).toLocaleDateString() + (x.remember === false ? ' · 让 TA 忘了' : ''), save: () => S.set('d', D) }, 'gyxSecret');
X.mem({ k: 'gyxSecretTa', ico: '🔓', n: 'TA 告诉你的秘密', d: '', items: c => ((D.ta[String(c.id)] || {}).list || []), text: x => x.t, meta: x => new Date(x.at).toLocaleDateString(), edit: (x, v) => { x.t = v; }, del: (c, i) => { const T = D.ta[String(c.id)]; if (T && T.list) T.list.splice(i, 1); }, save: () => S.set('d', D) }, 'gyxSecret');
