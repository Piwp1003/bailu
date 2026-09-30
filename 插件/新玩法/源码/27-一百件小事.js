/* 💯 一百件小事：「我们要一起做的 100 件事」清单——做完一件就打个勾，写下那天的样子、配张照片；TA 也会时不时约你做其中一件，还能自己加 */
if (window.__gyx100) return; window.__gyx100 = 1;
X.feat('gyx100', { n: '💯 一百件小事', desc: '我们要一起做的 100 件事，做完一件打个勾' });
const S = X.store('hundred');
const LIST = '一起看一次日出|一起看一场流星雨|一起去海边踩水|一起坐一次摩天轮|给对方做一顿饭|一起逛一次菜市场|一起拍一套大头贴|一起养一盆植物|互相写一封信|一起看一部恐怖片|一起通宵聊天|一起去游乐园|一起淋一场雨|一起堆一个雪人|一起去看演唱会|一起去一个没去过的城市|一起坐一次长途火车|一起逛宜家|一起做一次蛋糕|一起去动物园|一起放风筝|一起去一次寺庙许愿|一起看一次烟花|一起去露营|一起在天台看星星|给对方剪一次头发|一起去电玩城|一起拼一副拼图|一起学一道新菜|一起去看一次海上日落|一起穿情侣装出门|一起去一家猫咖|一起玩一次密室逃脱|一起去一次书店待一下午|一起听一整张专辑|一起去看画展|一起骑一次双人自行车|一起在雨天窝在家里|一起写下十年后的愿望|一起去一次跨年|一起过一次生日|一起去吃一家排队很久的店|一起逛夜市|一起看一场电影首映|一起早起去吃早茶|一起去泡温泉|一起去一次滑雪场|一起去一次花海|一起录一首歌|一起做一次手工|一起种一棵树|一起去拍一次写真|一起去看一次话剧|一起去一次游泳馆|一起跑一次步|一起爬一座山|一起在山顶看云海|一起去一次古镇|一起吃一次火锅到半夜|一起喝一次醉|一起看一部很长的剧|一起去一次水族馆|一起逛一次宠物店|一起给未来写一封信|一起去一次二手市场|一起去一次音乐节|一起在沙滩上写名字|一起看一次极光|一起在海边等涨潮|一起坐一次船|一起在公园野餐|一起去一次植物园|一起玩一次桌游到天亮|一起去一次天文馆|一起在江边散步|一起去一次夜爬|一起吃一次路边摊|一起听一次雨声睡觉|一起互换手机一天|一起给对方化一次妆|一起做一次大扫除|一起去一次超市囤零食|一起去一次灯会|一起放一次孔明灯|一起去看一次樱花|一起去看一次枫叶|一起去一次雪山|一起去一次沙漠|一起在车里听歌兜风|一起吃一次对方家乡的菜|一起去一次对方长大的地方|一起翻看小时候的照片|一起做一本相册|一起去看一场球赛|一起学一种乐器|一起穿一次汉服|一起去看一次舞台剧|一起在凌晨的便利店吃泡面|一起养一只小猫|一起把这一百件事做完'.split('|');
let D = { done: {}, custom: [], cfg: { per: 10 } };   // done[i] = {at, note, photo, cid}
const all = () => LIST.concat(D.custom);
window.gyx100Open = function (filter) {
    const L = all(), n = Object.keys(D.done).length, F = filter || window.__gyx100F || 'all'; window.__gyx100F = F;
    const pct = Math.round(n / L.length * 100), C = 2 * Math.PI * 34;
    X.panel('gyx100Ov', '💯 一百件小事', `<div class="hd-top"><svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="34" fill="none" stroke="#f2e8ef" stroke-width="8"/><circle cx="40" cy="40" r="34" fill="none" stroke="#ff7aa2" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - n / L.length)}" transform="rotate(-90 40 40)"/><text x="40" y="46" text-anchor="middle" font-size="18" fill="#ff5c8a">${n}</text></svg><div><b>已经一起做了 ${n} 件</b><span>还有 ${L.length - n} 件 · ${pct}%</span></div></div>
        <div class="gyx-row">${[['all', '全部'], ['todo', '还没做'], ['done', '做过的']].map(([k, t]) => `<span class="gyx-chip ${F === k ? 'on' : ''}" onclick="gyx100Open('${k}')">${t}</span>`).join('')}<span class="gyx-chip" onclick="gyx100Pick()">🎲 随机抽一件</span></div>
        <div class="hd-list">${L.map((t, i) => ({ t, i })).filter(({ i }) => F === 'all' || (F === 'done') === !!D.done[i]).map(({ t, i }) => { const d = D.done[i]; return `<div class="hd-it${d ? ' ok' : ''}"><span class="hd-n">${i + 1}</span><div><b>${X.esc(t)}</b>${d ? `<em>${new Date(d.at).toLocaleDateString()}${d.cid ? ' · 和 ' + X.esc(X.name(X.char(d.cid))) : ''}${d.note ? ' · ' + X.esc(d.note) : ''}</em>${d.photo ? `<img src="${d.photo}">` : ''}` : ''}</div>${d ? '<i>✓</i>' : `<button class="gyx-btn lite" onclick="gyx100Done(${i})">做到了</button>`}</div>`; }).join('')}</div>
        <div class="gyx-row"><input id="gyx100New" class="gyx-in" placeholder="加一件你们自己的事" style="flex:1"><button class="gyx-btn" onclick="gyx100Add()">加上</button></div>
        <div class="gyx-row gyx-tip">默认模式的 TA 每天有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.per}" style="width:60px" onchange="gyx100Cfg(+this.value)">% 的可能约你做其中一件；自主模式的 TA 自己决定。</div>`);
};
window.gyx100Done = function (i) {
    const t = all()[i]; const box = document.createElement('div'); box.className = 'hd-dlg';
    box.innerHTML = `<div class="gyx-card"><b>✓ ${X.esc(t)}</b><div class="gyx-row">和谁：${X.whoSel((X.cur() || {}).id, 'gyx100Who')}</div><input id="gyx100Note" class="gyx-in" placeholder="那天是什么样子（可空）"><div class="gyx-row"><label class="gyx-btn lite">配张照片<input id="gyx100Ph" type="file" accept="image/*" style="display:none"></label><button class="gyx-btn" onclick="gyx100Save(${i})">记下来</button></div></div>`;
    window.GYX_100_WHO = String((X.cur() || {}).id || '');
    const it = document.querySelectorAll('#gyx100Ov .hd-it'); const ov = document.getElementById('gyx100Ov'); ov.querySelector('.gyx-bd').insertBefore(box, ov.querySelector('.hd-list'));
};
window.GYX_100_WHO = '';
window.gyx100Who = v => { window.GYX_100_WHO = v; };
window.gyx100Save = async function (i) {
    const f = (document.getElementById('gyx100Ph') || {}).files; const note = ((document.getElementById('gyx100Note') || {}).value || '').trim();
    const photo = f && f[0] ? await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f[0]); }) : '';
    D.done[i] = { at: Date.now(), note, photo, cid: window.GYX_100_WHO }; await S.set('d', D);
    const c = X.char(window.GYX_100_WHO); if (c) X.reach(c, `你们刚完成了「一起要做的 100 件事」里的第 ${i + 1} 件：「${all()[i]}」${note ? '，她写下：' + note : ''}。说说你的感受（这是你们第 ${Object.keys(D.done).length} 件一起做的事了）`);
    X.toast(X.v(`第 ${Object.keys(D.done).length} 件 ✓`, '又一起做到了一件'), all()[i]); window.gyx100Open();
};
window.gyx100Add = async () => { const t = ((document.getElementById('gyx100New') || {}).value || '').trim(); if (!t) return; D.custom.push(t); await S.set('d', D); window.gyx100Open(); };
window.gyx100Pick = () => { const L = all().map((t, i) => i).filter(i => !D.done[i]); if (!L.length) return; const i = X.pick(L); X.toast(X.v('今天就做这件吧', '抽到了'), `第 ${i + 1} 件：${all()[i]}`); };
window.gyx100Cfg = v => { D.cfg.per = v; S.set('d', D); };
window.gyx100Data = () => D;
async function invite(c) { const L = all().map((t, i) => i).filter(i => !D.done[i]); if (!L.length) return null; const i = X.pick(L); D.today = { i, cid: String(c.id), day: X.day() }; await S.set('d', D); await X.reach(c, `你们有一张「一起要做的 100 件事」清单，你想约她做第 ${i + 1} 件：「${all()[i]}」，用你的方式约她（可以是现在就做、也可以约个时间）`); return i; }
async function tick() { if (!X.on('gyx100')) return; const k = X.day(); if (D.last === k) return; const h = new Date().getHours(); if (h < 9 || h > 22) return; D.last = k; await S.set('d', D); for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.per || 0)) { await invite(c); break; } } }
X.action({ key: 'gyx_100', label: '约她做「一起要做的 100 件事」里的一件', hint: '清单上还没做的', need: () => Object.keys(D.done).length < all().length, run: async c => (await invite(c)) != null ? '约你做清单上的一件事' : null }, 'gyx100');
X.ctx(() => { const n = Object.keys(D.done).length; if (!n && !D.today) return ''; const last = Object.entries(D.done).sort((a, b) => b[1].at - a[1].at)[0]; return `【一起要做的 100 件事】已经一起做了 ${n} 件${last ? '，最近一件是「' + all()[last[0]] + '」' : ''}。`; }, 'gyx100');
X.today(() => { const rows = []; if (D.today && D.today.day === X.day()) rows.push({ t: '第 ' + (D.today.i + 1) + ' 件', x: `${X.esc(X.name(X.char(D.today.cid)))} 约你：${X.esc(all()[D.today.i])}`, go: 'gyx100Open()' }); rows.push({ t: Object.keys(D.done).length + '/' + all().length, x: '一起做过的事', go: 'gyx100Open()' }); return { title: '💯 一百件小事', rows }; }, 'gyx100');
X.css('gyx100Css', `.hd-top{display:flex;gap:14px;align-items:center;padding:10px;border-radius:18px;background:#fff5f8}.hd-top b{display:block;font-size:17px}.hd-top span{font-size:13px;color:#999}
.hd-list{max-height:48vh;overflow:auto;margin:8px 0}.hd-it{display:flex;gap:10px;align-items:center;padding:8px 6px;border-bottom:1px solid #f4f4f4}.hd-it>div{flex:1}.hd-it b{font-weight:500;font-size:14.5px}.hd-it em{display:block;font-style:normal;font-size:12px;color:#999}.hd-it img{width:64px;height:64px;object-fit:cover;border-radius:8px;margin-top:4px}.hd-it.ok b{color:#999;text-decoration:line-through}.hd-it>i{font-style:normal;color:#ff5c8a;font-size:18px}
.hd-n{width:28px;height:28px;border-radius:50%;background:#f2f2f4;display:flex;align-items:center;justify-content:center;font-size:12px;color:#888;flex-shrink:0}.hd-it.ok .hd-n{background:#ff7aa2;color:#fff}.hd-dlg{margin:8px 0}`);
X.mini({ id: 'gyx100', icon: '💯', title: '一百件小事', desc: '我们要一起做的 100 件事：做完一件打个勾，写下那天、配张照片', onOpen: () => window.gyx100Open() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.done = D.done || {}; D.custom = D.custom || []; D.cfg = Object.assign({ per: 10 }, D.cfg || {}); setTimeout(tick, 35000); setInterval(tick, 30 * 60000); })();
