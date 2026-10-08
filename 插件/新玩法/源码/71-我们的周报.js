/* 🗞️ 我们的周报：每周一早上，TA 给你们俩出一份小报纸——头版大新闻、本周金句、聊天数据、TA 的专栏、下周「心情天气预报」，角落里还有小广告（没兑换的券、没做的约定）。往期都能翻 */
if (window.__gyxWeekly) return; window.__gyxWeekly = 1;
X.feat('gyxWeekly', { n: '🗞️ 我们的周报', desc: '每周一 TA 出一份你们俩的小报纸：头版、金句、数据、专栏、天气预报' });
const S = X.store('weekly');
let D = { issues: [] };   // [{id, cid, wk, from, to, no, head, lead, col, fc, quotes:[], st:{}, ads:[], at}]
const H = cid => ((typeof globalChats !== 'undefined' && globalChats[cid]) || []).filter(m => m && m.sender !== 'system' && !m.side && m.timestamp && X.plain(m.text));
const monday = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const md = t => { const d = new Date(t); return (d.getMonth() + 1) + '.' + d.getDate(); };
const WX = ['☀️ 晴', '🌤️ 晴转多云', '⛅ 多云', '🌦️ 小雨转晴', '🌈 雨后彩虹', '🌙 晴朗的夜', '💗 局部地区有粉色泡泡', '🍬 甜度超标'];
function gather(cid, from, to) {
    const L = H(cid).filter(m => m.timestamp >= from && m.timestamp < to), me = L.filter(m => m.sender === 'me'), hr = Array(24).fill(0), day = {};
    L.forEach(m => { const d = new Date(m.timestamp); hr[d.getHours()]++; day[X.day(d)] = (day[X.day(d)] || 0) + 1; });
    const sc = m => { const t = X.plain(m.text); return Math.min(t.length, 50) / 10 + (/想你|喜欢|爱|笑死|哈哈|晚安|抱|对不起|谢谢/.test(t) ? 3 : 0) + Math.random(); };
    const seenQ = new Set(); const quotes = L.filter(m => !m.gyx).sort((a, b) => sc(b) - sc(a)).filter(m => { const k = X.plain(m.text); if (seenQ.has(k)) return false; seenQ.add(k); return true; }).slice(0, 3).map(m => ({ who: m.sender === 'me' ? 'me' : 'ta', t: X.plain(m.text).slice(0, 60), at: m.timestamp }));
    const sum = []; try { const c = X.char(cid); String(c.chatSummary || '').split('\n').forEach(l => { const m = l.match(/^\[([^\]]+)\]\s*(.+)/); if (!m) return; const t = new Date(m[1].replace(/\s*[上下]午/, ' ')).getTime(); if (t >= from && t < to) sum.push(m[2].replace(/【[^】]*】/g, '').slice(0, 120)); }); } catch (e) {}
    const big = Object.entries(day).sort((a, b) => b[1] - a[1])[0];
    return { L, st: { n: L.length, me: me.length, ta: L.length - me.length, days: Object.keys(day).length, hour: hr.indexOf(Math.max(...hr)), big: big ? big[0].slice(5) + '（' + big[1] + ' 句）' : '—', gn: L.filter(m => /晚安/.test(X.plain(m.text))).length, miss: L.filter(m => /想你/.test(X.plain(m.text))).length, haha: L.filter(m => /哈哈/.test(X.plain(m.text))).length }, quotes, sum };
}
function ads(cid) { const A = []; try { window.gyxCouponData().list.filter(x => x.cid === cid && x.from === 'ta' && !x.used).slice(0, 2).forEach(x => A.push(`【好消息】您有一张「${x.name}」尚未兑换，随时可用，永久有效。`)); } catch (e) {} try { window.gyxPromiseData().list.filter(x => x.cid === cid && x.done === null).slice(0, 2).forEach(x => A.push(`【寻人启事】约好的「${x.what}」还没做，看到请速与对方联系。`)); } catch (e) {} if (!A.length) A.push(X.pick(['【招聘】诚招抱抱一名，要求：只要你。待遇：我。', '【失物招领】本周丢失「心」一颗，疑似被你捡走，不用还了。', '【广告】晚安服务 24 小时在线，无需预约。'])); return A; }
async function make(c, from, to) {
    const cid = String(c.id), g = gather(cid, from, to); if (!g.L.length) return null;
    let j = null;
    if (!X.bailu()) j = X.json(await X.ask(`${X.who(c)}\n你在给你们俩编一份小报纸《我们的周报》（${md(from)}～${md(to - 1)}）。\n本周数据：一共 ${g.st.n} 句（她 ${g.st.me} 句、你 ${g.st.ta} 句），聊了 ${g.st.days} 天，说了 ${g.st.gn} 次晚安、${g.st.miss} 次想你。\n本周的事：\n${g.sum.join('\n') || '（没有总结）'}\n本周聊天节选：\n${g.L.slice(-30).map(m => (m.sender === 'me' ? '她：' : '你：') + X.plain(m.text).slice(0, 60)).join('\n')}\n用小报的口吻写（俏皮、像真报纸但满满的你们的事）：头版标题（12 字内）、导语（50~90 字）、你的专栏（标题 + 正文 80~150 字，第一人称，对她说）、下周心情天气预报（一句话，可以搞笑）。\n只输出 JSON：{"head":"","lead":"","colT":"","col":"","fc":""}`));
    if (!j || !j.head) { const cs = X.cards(['情话', '日记'], c, 2); j = { head: X.pick([`本周两人共说话 ${g.st.n} 句`, '独家：某人又说想你了', `本周晚安 ${g.st.gn} 次，创历史新高`, '记者调查：这对情侣到底有多黏']), lead: `据本报记者观察，本周两人共有 ${g.st.days} 天聊天，最热闹的一天是 ${g.st.big}。${g.sum[0] || ''}`.slice(0, 120), colT: X.pick(['写在周末', '给你的一页', '小编有话说']), col: cs.join('') || '这一周也很好，因为有你。', fc: X.pick(WX) + '，' + X.pick(['适宜拥抱', '适宜早睡', '适宜说想你', '不宜吵架', '宜吃好吃的']) }; }
    const no = D.issues.filter(x => x.cid === cid).length + 1;
    const it = { id: 'wk' + Date.now().toString(36), cid, wk: X.day(new Date(from)), from, to, no, head: X.plain(j.head).slice(0, 24), lead: X.plain(j.lead), colT: X.plain(j.colT || '小编专栏'), col: X.plain(j.col || ''), fc: X.plain(j.fc || X.pick(WX)), quotes: g.quotes, st: g.st, ads: ads(cid), at: Date.now() };
    D.issues = D.issues.filter(x => !(x.cid === cid && x.wk === it.wk)); D.issues.unshift(it); await S.set('d', D); return it;
}
window.gyxWeeklyMake = async (cid, thisWeek) => { const c = X.char(cid) || X.cur(); if (!c) return null; const m = monday(); const it = thisWeek ? await make(c, m, Date.now() + 1) : await make(c, m - 7 * 864e5, m); if (!it) { X.toast('🗞️ 这周还没什么新闻', '多聊几句再出刊'); return null; } window.gyxWeeklyRead(it.id); return it; };
window.gyxWeeklyRead = id => {
    const x = D.issues.find(i => i.id === id); if (!x) return; const c = X.char(x.cid), me = X.me(c), ta = X.name(c), s = x.st, E = X.esc;
    const d = new Date(x.to - 1), WD = ['日', '一', '二', '三', '四', '五', '六'];
    let h = 0; for (const ch of x.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const wx7 = [...Array(7)].map((_, i) => ['☀️', '🌤️', '⛅', '🌦️', '🌈', '🌙', '💗', '🍬'][(h >>> (i * 3)) % 8]);
    const lead = E(x.lead), dc = lead.slice(0, 1), rest = lead.slice(1);
    const big = (n, l) => `<div class="np-num"><b>${n}</b><span>${l}</span></div>`;
    X.panel('gyxWeeklyOv', '🗞️ 我们的周报', `<div class="np"><div class="np-top"><span>VOL.1 · NO.${String(x.no).padStart(3, '0')}</span><span>${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 星期${WD[d.getDay()]}</span><span>定价：一个抱抱</span></div>
        <div class="np-mast"><small>— 全世界只发行一份 —</small><b>我们的周报</b><i>OUR WEEKLY · 主编 ${E(ta)} · 特约读者 ${E(me)}</i></div>
        <div class="np-ed"><span>${md(x.from)} — ${md(x.to - 1)}</span><span>本期 ${s.n} 句</span><span>${E(x.fc.split(/[，,]/)[0])}</span></div>
        <div class="np-kicker">头 版 · 独 家</div><h2 class="np-head">${E(x.head)}</h2>
        <p class="np-lead${x.lead.length > 110 ? ' cols' : ''}"><span class="np-dc">${dc}</span>${rest}</p>
        <div class="np-grid">
          <section class="np-box"><h4>本周数据</h4><div class="np-nums">${big(s.n, '总句数')}${big(s.days + '<em>/7</em>', '聊天天数')}${big(s.gn, '晚安')}${big(s.miss, '想你')}</div>
            <table><tr><td>${E(me)} 说了</td><td>${s.me} 句</td></tr><tr><td>${E(ta)} 说了</td><td>${s.ta} 句</td></tr><tr><td>最热闹的一天</td><td>${s.big}</td></tr><tr><td>黄金时段</td><td>${s.hour} 点</td></tr><tr><td>哈哈哈指数</td><td>${s.haha}</td></tr></table></section>
          <section class="np-q"><h4>本周金句</h4>${x.quotes.map((q, i) => `<blockquote class="${i ? '' : 'top'}"><p>${E(q.t)}</p><cite>${E(q.who === 'me' ? me : ta)} · ${md(q.at)}</cite></blockquote>`).join('') || '<p class="np-dim">本周沉默是金。</p>'}</section>
        </div>
        <section class="np-col"><h4>专栏 · ${E(x.colT)}</h4><div class="np-by">文 / ${E(ta)}</div><p class="${x.col.length > 140 ? 'cols' : ''}">${E(x.col)}</p></section>
        <section class="np-fc"><h4>下周心情天气预报</h4><div class="np-days">${wx7.map((w, i) => `<span><em>周${WD[(i + 1) % 7]}</em>${w}</span>`).join('')}</div><p>${E(x.fc)}</p></section>
        <section class="np-ads"><h4>分类广告</h4><div>${x.ads.map(a => { const m = a.match(/^【(.+?)】(.*)$/); return `<div><b>${E(m ? m[1] : '广告')}</b>${E(m ? m[2] : a)}</div>`; }).join('')}</div></section>
        <div class="np-foot">本报只印一份 · 读完请收好 · 下周一见</div></div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxWeeklyOpen('${x.cid}')">‹ 往期</button><button class="gyx-btn lite" onclick="gyxWeeklyPrint('${x.id}')">🖨️ 打印 / 存 PDF</button></div>`, 'np-ov');
};
window.gyxWeeklyPrint = id => { const b = document.querySelector('#gyxWeeklyOv .np'); if (!b) return; const w = window.open('', '_blank'); if (!w) { X.toast('🗞️ 弹窗被拦了', ''); return; } w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>我们的周报</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap"><style>${CSS}body{margin:0;padding:20px;background:#fff}</style></head><body>${b.outerHTML}</body></html>`); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 800); };
window.gyxWeeklyDel = async id => { const x = D.issues.find(i => i.id === id); D.issues = D.issues.filter(i => i.id !== id); await S.set('d', D); window.gyxWeeklyOpen(x && x.cid); };
window.gyxWeeklyData = () => D;
window.gyxWeeklyOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return; const cid = String(c.id), L = D.issues.filter(x => x.cid === cid);
    X.panel('gyxWeeklyOv', '🗞️ 我们的周报', `<div class="gyx-row">${X.whoSel(cid, 'gyxWeeklyOpen')}<button class="gyx-btn" onclick="this.disabled=true;this.textContent='排版中…';gyxWeeklyMake('${cid}')">上周的</button><button class="gyx-btn lite" onclick="this.disabled=true;this.textContent='排版中…';gyxWeeklyMake('${cid}',1)">这周到现在的</button></div>
        <div class="gyx-tip">${X.v('每周一早上 TA 会出上周的那一期。', '主编是 TA，读者只有你。', '新闻都是你们的事。')}</div>
        ${L.map(x => `<div class="np-it" onclick="gyxWeeklyRead('${x.id}')"><b>第 ${x.no} 期 · ${X.esc(x.head)}</b><em>${md(x.from)}～${md(x.to - 1)} · ${x.st.n} 句</em><i onclick="event.stopPropagation();gyxWeeklyDel('${x.id}')">删</i></div>`).join('') || '<div class="gyx-tip">还没出过刊</div>'}`);
};
async function tick() { if (!X.on('gyxWeekly')) return; const m = monday(); if (new Date().getHours() < 7) return; for (const c of X.chars()) { const wk = X.day(new Date(m - 7 * 864e5)); if (D.issues.some(x => x.cid === String(c.id) && x.wk === wk)) continue; if (!H(String(c.id)).some(x => x.timestamp >= m - 7 * 864e5 && x.timestamp < m)) continue; const it = await make(c, m - 7 * 864e5, m); if (it && X.on('gyxWeekly.auto')) X.notify(c, `🗞️ ${X.v('新一期《我们的周报》出刊了', '周报送到了', '今天的报纸到了')}：${X.esc(it.head)}`, '主编：' + X.name(c), () => window.gyxWeeklyRead(it.id)); } }
X.ctx(id => { const x = D.issues.find(i => i.cid === String(id)); return x && Date.now() - x.at < 2 * 864e5 ? `【你刚给你们出了一期周报】头版：「${x.head}」；你的专栏：${x.col.slice(0, 60)}` : ''; }, 'gyxWeekly');
X.action({ key: 'gyx_weekly', label: '给你们出一期周报', hint: '我们的周报', need: c => { const m = monday(); return !D.issues.some(x => x.cid === String(c.id) && x.at >= m) && H(String(c.id)).some(x => x.timestamp >= m - 7 * 864e5); },
    run: async c => { const m = monday(); const it = await make(c, m - 7 * 864e5, m) || await make(c, m, Date.now() + 1); if (!it) return null; X.notify(c, `🗞️ ${X.esc(X.name(c))} ${X.v('出了一期周报', '把你们的一周编成了报纸')}：${X.esc(it.head)}`, '去看看', () => window.gyxWeeklyRead(it.id)); return '出了一期周报'; } }, 'gyxWeekly');
X.today(() => ({ title: '🗞️ 周报', rows: D.issues.filter(x => X.day(new Date(x.at)) === X.day()).map(x => ({ t: '第 ' + x.no + ' 期', x: X.esc(x.head), go: `gyxWeeklyRead('${x.id}')` })) }), 'gyxWeekly');
X.widget('gyxWeeklyW', { n: '我们的周报', sizes: ['s', 'm'], tap: () => D.issues[0] ? window.gyxWeeklyRead(D.issues[0].id) : window.gyxWeeklyOpen(), r: w => { const x = D.issues[0]; return X.gw(w, '🗞️', '我们的周报', x ? ['第 ' + x.no + ' 期', X.esc(x.head)] : ['还没出刊']); } }, 'gyxWeekly');
X.memArr({ k: 'gyxWeekly', ico: '🗞️', n: '我们的周报', d: '每期的头版和 TA 的专栏', arr: () => D.issues, text: x => x.head + '｜' + x.col, edit: (x, v) => { const [a, b] = v.split('｜'); x.head = a; if (b != null) x.col = b; }, meta: x => '第 ' + x.no + ' 期 · ' + md(x.from) + '～' + md(x.to - 1), save: () => S.set('d', D) }, 'gyxWeekly');
const CSS = `.np{--ink:#231d16;--dim:#6f6150;--rule:#2a221a;background:#f3ead6;background-image:radial-gradient(ellipse at 20% 0%,rgba(255,255,255,.55),transparent 60%),radial-gradient(ellipse at 100% 100%,rgba(160,120,60,.14),transparent 55%),repeating-linear-gradient(0deg,rgba(90,60,20,.025) 0 1px,transparent 1px 3px);color:var(--ink);padding:16px 18px 12px;border-radius:4px;font-family:"Noto Serif SC","Songti SC","STSong","SimSun",serif;box-shadow:0 1px 0 rgba(0,0,0,.05),0 10px 30px rgba(80,50,10,.18);line-height:1.6}
.np-top{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;color:var(--dim);letter-spacing:.5px;border-bottom:1px solid var(--rule);padding-bottom:4px;flex-wrap:wrap}
.np-mast{text-align:center;padding:10px 0 8px}.np-mast small{display:block;font-size:10.5px;letter-spacing:4px;color:var(--dim)}.np-mast b{display:block;font-size:44px;font-weight:900;letter-spacing:10px;line-height:1.15;margin:2px 0;text-shadow:.5px .5px 0 rgba(0,0,0,.25)}.np-mast i{font-style:normal;font-size:10.5px;letter-spacing:2px;color:var(--dim)}
.np-ed{display:flex;justify-content:space-between;border-top:3px double var(--rule);border-bottom:3px double var(--rule);padding:4px 2px;font-size:12px;gap:6px;flex-wrap:wrap}
.np-kicker{margin-top:14px;font-size:11px;letter-spacing:3px;color:#9b2c20;font-weight:700}
.np-head{font-size:30px;font-weight:900;line-height:1.25;margin:4px 0 10px;letter-spacing:1px}
.np-lead{font-size:15px;line-height:1.9;text-align:justify;margin:0 0 12px;padding-bottom:12px;border-bottom:1px solid var(--rule);overflow:hidden}.np-lead.cols,.np-col p.cols{column-count:2;column-gap:20px;column-rule:1px solid rgba(42,34,26,.35)}
.np-dc{float:left;font-size:52px;line-height:.9;font-weight:900;margin:4px 6px 0 0;color:#9b2c20}
.np h4{font-size:12.5px;letter-spacing:3px;margin:0 0 8px;padding-bottom:3px;border-bottom:2px solid var(--rule);display:block;font-weight:900}
.np-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--rule)}
.np-box{border:1px solid var(--rule);padding:8px 10px;background:rgba(255,255,255,.25)}
.np-nums{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}.np-num{text-align:center;border-bottom:1px dotted rgba(42,34,26,.4);padding-bottom:4px}.np-num b{display:block;font-size:26px;font-weight:900;line-height:1.1}.np-num b em{font-size:13px;font-style:normal;color:var(--dim)}.np-num span{font-size:10.5px;color:var(--dim);letter-spacing:1px}
.np table{width:100%;font-size:12px;border-collapse:collapse}.np td{padding:2px 0;border-bottom:1px dotted rgba(42,34,26,.25)}.np td:last-child{text-align:right;font-weight:700}
.np-q{border-left:1px solid rgba(42,34,26,.35);padding-left:14px}.np blockquote{margin:0 0 12px;position:relative;padding-left:16px;border-left:3px solid #9b2c20}.np blockquote:before{content:none}.np blockquote p{margin:0;font-size:14px;line-height:1.7}.np blockquote.top p{font-size:17px;font-weight:700}.np cite{display:block;font-style:normal;font-size:11px;color:var(--dim);text-align:right;margin-top:2px}.np-dim{color:var(--dim);font-size:13px}
.np-col{padding:12px 0;border-bottom:1px solid var(--rule)}.np-by{font-size:11.5px;color:var(--dim);margin:-4px 0 6px}.np-col p{margin:0;font-size:14.5px;line-height:2;text-indent:2em;text-align:justify}
.np-fc{padding:12px 0;border-bottom:1px solid var(--rule)}.np-days{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;border:1px solid var(--rule)}.np-days span{font-size:20px;padding:4px 0;border-right:1px solid rgba(42,34,26,.3)}.np-days span:last-child{border-right:none}.np-days em{display:block;font-style:normal;font-size:10.5px;color:var(--dim)}.np-fc p{margin:6px 0 0;font-size:13px;text-align:center}
.np-ads{padding:12px 0 6px}.np-ads>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.np-ads>div>div{border:1px solid var(--rule);padding:6px 8px;font-size:12px;line-height:1.55;background:rgba(255,255,255,.2)}.np-ads b{display:block;text-align:center;font-size:12.5px;letter-spacing:2px;border-bottom:1px solid rgba(42,34,26,.4);margin-bottom:4px}
.np-foot{text-align:center;font-size:10.5px;color:var(--dim);letter-spacing:3px;border-top:3px double var(--rule);padding-top:6px;margin-top:6px}
@media(max-width:520px){.np-mast b{font-size:34px;letter-spacing:6px}.np-head{font-size:24px}.np-lead.cols,.np-col p.cols{column-count:1}.np-grid{grid-template-columns:1fr}.np-q{border-left:none;padding-left:0}}`;
X.css('gyxWeeklyCss', CSS + `.gyx-ov.np-ov .gyx-box{background:#e9e1cf;width:min(680px,100%)}.gyx-ov.np-ov .gyx-hd{background:rgba(233,225,207,.92)}.np-it{padding:9px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;position:relative}.np-it em{display:block;font-style:normal;font-size:11.5px;color:#999}.np-it i{position:absolute;right:4px;top:10px;font-style:normal;font-size:11px;color:#aaa}`);
if (!document.getElementById('gyxNpFont')) { const l = document.createElement('link'); l.id = 'gyxNpFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&display=swap'; document.head.appendChild(l); }
X.mini({ id: 'gyxWeekly', icon: '🗞️', title: '我们的周报', desc: '每周一份你们俩的小报纸', cat: '回忆', onOpen: () => window.gyxWeeklyOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.issues = D.issues || []; setTimeout(tick, 45000); setInterval(tick, 3600000); })();
