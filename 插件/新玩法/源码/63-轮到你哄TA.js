/* 🥺 轮到你哄TA：TA 也会有倒霉的一天——被老板骂了、东西丢了、莫名其妙就是不开心。这次换你哄 TA：你在聊天里说的每句话都会让 TA 的心情条慢慢回来（敷衍的话不算），哄好了 TA 会记着你的好 */
if (window.__gyxCoax) return; window.__gyxCoax = 1;
X.feat('gyxCoax', { n: '🥺 轮到你哄TA', desc: 'TA 也会低落，换你来哄，心情条跟着你的话慢慢回来' });
const S = X.store('coax');
let D = { on: {}, log: [], cfg: { per: 4 } };   // on[cid] = {why, mood(0~100), at, seen, steps:[{t, d, at}]}; log = [{cid, why, at, end, n, thanks}]
const WHY = ['今天被领导当众说了一顿', '出门忘带伞，淋成了落汤鸡', '最喜欢的杯子摔碎了', '排了一小时队，轮到自己卖完了', '熬夜做的东西被说不行', '莫名其妙就是不开心', '和朋友闹了点别扭', '感冒了，头好晕', '手机摔了，屏幕裂了', '梦到你不理我了，醒来还难受', '加班到很晚，饭都没吃', '被人误会了又解释不清'];
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side);
const GOOD = [[/抱抱|抱一下|抱紧|抱你/, 18], [/亲亲|亲一下|么么|mua/i, 14], [/心疼|辛苦了|委屈你了|难为你了/, 20], [/我在|陪着你|有我|我陪你/, 18], [/爱你|喜欢你|最喜欢/, 15], [/不哭|乖|摸摸|揉揉/, 12], [/没关系|不是你的错|你已经很棒|你很棒|做得很好/, 22], [/请你|给你买|带你去|奶茶|好吃的|甜品/, 14], [/讲讲|怎么了|发生什么|跟我说/, 10], [/[🥺🤗😘❤️💕🫶]/u, 6]];
const BAD = /^(哦|嗯|好吧|行吧|随便|然后呢|哦哦|知道了|那又怎样)$/;
async function score(c, st, text) {
    const t = X.plain(text); if (!t) return 0;
    if (!X.bailu()) { const j = X.json(await X.ask(`${X.who(c)}\n你今天很低落（${st.why}），现在心情 ${st.mood}/100。她刚对你说：「${t}」\n这句话能让你好受多少？真诚、具体、懂你的话加得多；敷衍、讲道理、说教的不加甚至减。\n只输出 JSON：{"d":-10到30的整数}`)); if (j && isFinite(+j.d)) return Math.max(-10, Math.min(30, Math.round(+j.d))); }
    if (BAD.test(t)) return -5; let d = 2; GOOD.forEach(([re, v]) => { if (re.test(t)) d += v; }); if (t.length > 20) d += 4; return Math.min(30, d);
}
async function start(c, why) {
    const cid = String(c.id); if (D.on[cid]) return D.on[cid];
    let r = why; if (!r && !X.bailu()) r = X.plain(await X.ask(`${X.who(c)}\n今天你遇到了一件倒霉 / 难过的事。按你的身份和生活想一件具体的（一句话，20 字以内，别太严重）。只输出这件事。`) || '');
    r = (r || X.pick(WHY)).slice(0, 40);
    D.on[cid] = { why: r, mood: 15 + Math.floor(Math.random() * 20), at: Date.now(), seen: H(cid).length, steps: [] }; await S.set('d', D); return D.on[cid];
}
async function done(c, st) {
    const cid = String(c.id); delete D.on[cid];
    let t = X.bailu() ? null : await X.ask(`${X.who(c)}\n你今天因为「${st.why}」很低落，她哄了你 ${st.steps.length} 句，你现在好了。真心谢谢她，说一两句（可以有点不好意思）。`);
    t = X.plain(t || X.pick(X.cards(['情话', '撒娇'], c, 2).concat(['……好了，被你哄好了。谢谢你，真的。', '有你在，好像什么都没那么糟了。', '哼，看在你这么努力的份上，原谅这个世界了。'])));
    D.log.unshift({ cid, why: st.why, at: st.at, end: Date.now(), n: st.steps.length, thanks: t }); await S.set('d', D);
    X.say(c, t); X.notify(c, `🥺 ${X.esc(X.name(c))} ${X.v('被你哄好了', '心情回来了', '不难过了')}`, st.why, () => window.gyxCoaxOpen(cid));
}
let BUSY = null;
function watch() { if (BUSY) return BUSY; BUSY = watch0().finally(() => { BUSY = null; }); return BUSY; }
async function watch0() {
    if (!X.on('gyxCoax')) return;
    for (const cid of Object.keys(D.on)) {
        const st = D.on[cid], c = X.char(cid); if (!c) { delete D.on[cid]; continue; } const L = H(cid); if (L.length <= st.seen) { st.seen = L.length; continue; }
        const fresh = L.slice(st.seen).filter(m => m.sender === 'me'); st.seen = L.length;
        for (const m of fresh) { const d = await score(c, st, m.text); st.mood = Math.max(0, Math.min(100, st.mood + d)); st.steps.push({ t: X.plain(m.text).slice(0, 60), d, at: Date.now() }); }
        await S.set('d', D); if (document.getElementById('gyxCoaxOv')) window.gyxCoaxOpen(cid);
        if (st.mood >= 100) await done(c, st);
    }
}
window.gyxCoaxStart = async (cid, why) => { const c = X.char(cid) || X.cur(); if (!c) return null; const st = await start(c, why); if (!X.bailu()) await X.reach(c, `你今天很低落：${st.why}。来找她，但别直说「快哄我」——可以闷闷的、可以嘴硬说没事，让她察觉到`); else X.say(c, X.pick(['……今天好倒霉。', '没事。就是有点累。', '唉。', `${st.why}……算了不说了。`])); window.gyxCoaxOpen(c.id); return st; };
window.gyxCoaxSay = async cid => { const inp = document.getElementById('gyxCoaxIn'), t = (inp && inp.value || '').trim(); if (!t) return; inp.value = ''; const sid = String(cid); globalChats[sid] = globalChats[sid] || []; globalChats[sid].push({ sender: 'me', text: t, timestamp: Date.now(), readBy: [] }); try { saveAllData(); if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages(); } catch (e) {} await watch(); await watch(); const st = D.on[sid], c = X.char(sid); if (st && c) { const r = X.bailu() ? X.pick(st.mood > 60 ? ['……嗯。好一点了。', '你再说一句。', '哼，继续。'] : ['嗯……', '还是有点难受。', '你抱抱我好不好。', '……']) : X.plain(await X.ask(`${X.who(c)}\n你今天很低落（${st.why}），心情 ${st.mood}/100，她在哄你，刚说：「${t}」。按现在的心情回一句（心情越高越软）。`) || '嗯……'); X.say(c, r); } };
window.gyxCoaxData = () => D;
window.gyxCoaxOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), st = D.on[cid], L = D.log.filter(x => x.cid === cid);
    X.panel('gyxCoaxOv', '🥺 轮到你哄 TA', `<div class="gyx-row">${X.whoSel(cid, 'gyxCoaxOpen')}</div>
        ${st ? `<div class="gyx-card"><b>${X.esc(X.name(c))} 今天不开心</b><div class="gyx-tip">${X.esc(st.why)}</div><div class="cx-bar"><i style="width:${st.mood}%"></i><span>${st.mood}/100</span></div>
            <div class="gyx-tip">${st.mood < 30 ? X.v('还很低落……', '闷闷的，不太想说话', '眼眶还红着') : st.mood < 70 ? X.v('好一点了，再哄哄', '嘴角松动了一点', '开始愿意说话了') : X.v('快好了！', '已经在偷偷笑了', '就差一句了')}</div>
            ${st.steps.slice(-6).reverse().map(x => `<div class="cx-st"><span>${X.esc(x.t)}</span><b class="${x.d > 0 ? 'up' : 'dn'}">${x.d > 0 ? '+' : ''}${x.d}</b></div>`).join('')}
            <div class="gyx-row"><input id="gyxCoaxIn" class="gyx-in" style="flex:1" placeholder="哄哄 TA…（在聊天里说也算）" onkeydown="if(event.key==='Enter')gyxCoaxSay('${cid}')"><button class="gyx-btn" onclick="gyxCoaxSay('${cid}')">说</button></div></div>`
        : `<div class="gyx-tip">${X.v('TA 现在挺好的。', '今天 TA 心情还不错。', '暂时不用哄～')}TA 有时候会自己低落，你也可以问问 TA 今天怎么了。</div><button class="gyx-btn lite" onclick="this.disabled=true;gyxCoaxStart('${cid}')">TA 今天好像不太开心？</button>`}
        <div style="font-weight:700;margin:12px 0 4px">哄好过的</div>${L.slice(0, 15).map(x => `<div class="gyx-card"><div class="gyx-tip">${new Date(x.at).toLocaleDateString()} · ${X.esc(x.why)} · 哄了 ${x.n} 句</div>${X.esc(x.thanks)}</div>`).join('') || '<div class="gyx-tip">还没哄过</div>'}`);
};
X.ctx(id => { const st = D.on[String(id)]; if (st) return `【你今天很低落】因为：${st.why}。现在心情 ${st.mood}/100（越低越难受）。她在哄你——按这个心情说话：低的时候闷闷的、简短，慢慢被她哄软；敷衍的话不领情。`; const x = D.log.find(l => l.cid === String(id)); return x && Date.now() - x.end < 2 * 864e5 ? `【前阵子你因为「${x.why}」低落，她把你哄好了】你记得她的好。` : ''; }, 'gyxCoax');
X.action({ key: 'gyx_coax', label: '今天有点低落，想让她哄哄', hint: 'TA 也会有倒霉的一天', need: c => !D.on[String(c.id)] && !D.log.some(x => x.cid === String(c.id) && Date.now() - x.end < (+D.cfg.per || 4) * 864e5),
    run: async c => { const st = await start(c, ''); return (await X.reach(c, `你今天很低落：${st.why}。来找她，闷闷的，别直接说「哄我」`)) ? '今天有点低落' : null; } }, 'gyxCoax');
X.today(() => ({ title: '🥺 哄 TA', rows: Object.keys(D.on).map(cid => ({ t: D.on[cid].mood + '/100', x: X.esc(X.name(X.char(cid))) + ' 不开心：' + X.esc(D.on[cid].why.slice(0, 14)), go: `gyxCoaxOpen('${cid}')` })).concat(D.log.filter(x => X.day(new Date(x.end)) === X.day()).map(x => ({ t: '哄好了', x: X.esc(X.name(X.char(x.cid))), go: `gyxCoaxOpen('${x.cid}')` }))) }), 'gyxCoax');
X.widget('gyxCoaxW', { n: '哄 TA', sizes: ['s', 'm'], tap: () => window.gyxCoaxOpen(), r: w => { const c = X.cur(), st = c && D.on[String(c.id)]; return X.gw(w, st ? '🥺' : '😊', st ? X.name(c) + ' 不开心' : '哄 TA', st ? ['心情 ' + st.mood + '/100', X.esc(st.why)] : ['哄好过 ' + D.log.length + ' 次']); } }, 'gyxCoax');
X.memArr({ k: 'gyxCoax', ico: '🥺', n: '哄 TA', d: 'TA 低落过的事、你哄好 TA 后 TA 说的话', arr: () => D.log, text: x => x.why + '｜' + x.thanks, edit: (x, v) => { const [a, b] = v.split('｜'); x.why = a; if (b != null) x.thanks = b; }, meta: x => new Date(x.at).toLocaleDateString() + ' · 哄了 ' + x.n + ' 句', save: () => S.set('d', D) }, 'gyxCoax');
X.css('gyxCoaxCss', `.cx-bar{position:relative;height:16px;border-radius:10px;background:#eee;overflow:hidden;margin:10px 0 4px}.cx-bar i{display:block;height:100%;background:linear-gradient(90deg,#9db4ff,#ff9ac1);transition:width .6s}.cx-bar span{position:absolute;right:8px;top:0;font-size:11px;line-height:16px;color:#555}.cx-st{display:flex;gap:8px;font-size:13px;padding:4px 0;border-bottom:1px dashed #eee}.cx-st span{flex:1;color:#555}.cx-st b.up{color:#e0567a}.cx-st b.dn{color:#999}`);
X.mini({ id: 'gyxCoax', icon: '🥺', title: '轮到你哄TA', desc: 'TA 低落的时候换你哄', cat: '陪伴', onOpen: () => window.gyxCoaxOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.on = D.on || {}; D.log = D.log || []; D.cfg = Object.assign({ per: 4 }, D.cfg || {}); setInterval(watch, 2500); })();
