/* 🧭 文字冒险：TA 当旁白，带你去一场冒险——迷雾森林、太空站、古堡密室、无人岛……每一步你来选怎么做，TA 也在故事里陪着你（会护着你、也会拖后腿）。有分支、有结局，打通的结局会收进冒险手账 */
if (window.__gyxQuest) return; window.__gyxQuest = 1;
X.feat('gyxQuest', { n: '🧭 文字冒险', desc: 'TA 当旁白带你冒险，每一步你来选，有分支有结局' });
const S = X.store('quest');
const WORLDS = {
    '迷雾森林': { ico: '🌲', intro: '你们在森林边醒来，雾很浓，远处有铃铛声。TA 拉住你的手：「别走散了。」', scenes: [['一条岔路，左边有萤火虫，右边传来流水声。', ['跟着萤火虫走', '去找水源', '原地等雾散']], ['一只会说话的狐狸拦住你们，要你们回答一个问题才放行。', ['认真回答', '让 TA 去答', '掏出零食贿赂它']], ['树洞里有一个发光的盒子。', ['打开它', '让 TA 先开', '不碰，绕过去']], ['天黑了，你们找到一间小木屋。', ['敲门', '在外面生火过夜', '偷偷从窗户看']], ['桥断了一半，下面是深谷。', ['跳过去', '找别的路', '让 TA 背你过去']], ['你们迷路了，地图被风吹走。', ['爬上树看方向', '跟着星星走', '抱着 TA 原地休息']]], ends: ['你们找到了森林中心的许愿泉，TA 说：「我的愿望已经实现了，就是你。」', '雾散的时候，你们发现自己一直在原地打转——但这一路，TA 一直牵着你。', '狐狸送你们出了森林，临走前说：「下次带他一起来玩。」'] },
    '太空站': { ico: '🚀', intro: '警报响了，空间站停电。TA 在舱门那头敲了三下：「我在，别怕。」', scenes: [['氧气还剩 30%，有两个舱可以去。', ['去控制室', '去储藏室找氧气', '先去找 TA']], ['窗外有一个发光的东西在靠近。', ['发信号', '关灯躲起来', '让 TA 拿望远镜看']], ['通讯器里传来奇怪的声音。', ['回应它', '切断通讯', '录下来研究']], ['你们找到一个逃生舱，只能坐一个人。', ['让 TA 走', '一起挤进去', '想办法修第二个']], ['重力系统坏了，你们飘了起来。', ['抓住扶手前进', '抱住 TA 一起飘', '找操作手册']], ['电脑要求输入密码。', ['输入你的生日', '输入 TA 的生日', '输入你们认识的那天']]], ends: ['你们修好了空间站，坐在舷窗边看地球升起。TA 说：「全宇宙我最想和你待在一起。」', '逃生舱落在一片海上，你们漂着等救援，TA 给你讲了一晚上的故事。', '发光的东西是外星人的求婚信号——它们看你们太般配，给你们放了一场流星雨。'] },
    '古堡密室': { ico: '🏰', intro: '门在身后锁上了。烛光里，TA 小声说：「好像有人在看着我们。」', scenes: [['墙上有一幅画，画里的人眼睛会动。', ['摘下画', '跟画说话', '假装没看见']], ['书架上有一本书凸了出来。', ['拉一下', '让 TA 拉', '看看书名']], ['地上有一行字：「说出真心话，门才会开」。', ['对 TA 说真心话', '让 TA 先说', '说个假的试试']], ['一个箱子，有三个锁孔。', ['用钥匙开', '撬开', '敲三下']], ['烛火突然全灭了。', ['抓紧 TA', '摸黑找开关', '唱歌壮胆']], ['镜子里的你们，做着和你们不一样的动作。', ['靠近镜子', '拉 TA 赶紧走', '对镜子挥手']]], ends: ['门开了，外面是早晨。TA 说：「刚才我其实也很害怕，但看到你就不怕了。」', '密室的主人是一对很老很老的恋人，他们说：「你们很像当年的我们。」', '你们在密室里找到一封信，上面写着你们俩的名字——原来是 TA 很久以前准备的惊喜。'] },
    '无人岛': { ico: '🏝️', intro: '船翻了，你们被冲上一座小岛。TA 第一句话是：「你没受伤吧？」', scenes: [['天快黑了，要先做什么？', ['搭棚子', '找吃的', '生火']], ['你们在沙滩上发现了一串脚印。', ['跟上去', '躲起来观察', '在旁边留个记号']], ['椰子树很高，你们都饿了。', ['你爬上去', '让 TA 爬', '扔石头砸']], ['远处有一艘船经过。', ['拼命挥手', '点火发信号', '……其实不想走']], ['下暴雨了，棚子漏水。', ['抱在一起取暖', '冲出去修', '讲笑话转移注意力']], ['岛中心有一个山洞。', ['进去探险', '在洞口等', '让 TA 先进去']]], ends: ['你们被救了，但很多年后你们又自己回到了这座岛，在沙滩上写下两个人的名字。', '你们决定在岛上多住几天——反正，有彼此就够了。', '山洞里有宝藏，但 TA 说最大的宝藏是你，然后被你嫌弃了一路。'] }
};
let D = { log: [], run: null };   // run = {id, cid, w, at, steps:[{t, ch:[], pick}], end}; log = 打通的
async function nextStep(c, r) {
    const W = WORLDS[r.w], n = r.steps.length, last = n >= 6;
    if (!X.bailu()) {
        const hist = r.steps.map((s, i) => `第${i + 1}步：${s.t}（她选了：${s.pick || '…'}）`).join('\n');
        const j = X.json(await X.ask(`${X.who(c)}\n你在当旁白，带她玩一场文字冒险「${r.w}」。你自己也是故事里的角色，陪着她（按你的人设：会护着她、会逗她、偶尔也会拖后腿）。\n开场：${W.intro}\n${hist ? '到目前为止：\n' + hist + '\n' : ''}${last ? '这是最后一步：根据她一路的选择写一个结局（80~160 字，温暖或者有点小意外，结局要和她的选择有关）。只输出 JSON：{"end":"结局","title":"结局名（4~8 字）"}' : '写下一幕（50~110 字，接着她上一步的选择发生的事，有画面感，第二人称「你」），再给 3 个选项（要有区别，一个可以是和你有关的）。只输出 JSON：{"t":"这一幕","ch":["","",""]}'}`));
        if (j && last && j.end) return { end: X.plain(j.end), title: X.plain(j.title || '结局') };
        if (j && !last && j.t && Array.isArray(j.ch) && j.ch.length >= 2) return { t: X.plain(j.t), ch: j.ch.slice(0, 3).map(x => X.plain(x)) };
    }
    if (last) { const brave = r.steps.filter(s => s.ch.indexOf(s.pick) === 0).length, k = brave >= 4 ? 0 : brave >= 2 ? 2 : 1; return { end: W.ends[k], title: ['勇敢的结局', '温柔的结局', '意外的结局'][k] }; }
    const left = W.scenes.filter(s => !r.steps.some(x => x.t === s[0])); const s = X.pick(left.length ? left : W.scenes); const say = X.cards(['冒险', '聊天'], c, 1)[0];
    return { t: s[0] + (say && Math.random() < .5 ? `\nTA：「${X.plain(say)}」` : ''), ch: s[1].slice() };
}
window.gyxQuestStart = async (cid, w) => { const c = X.char(cid) || X.cur(); if (!c || !WORLDS[w]) return null; D.run = { id: 'qs' + Date.now().toString(36), cid: String(c.id), w, at: Date.now(), steps: [] }; const s = await nextStep(c, D.run); D.run.steps.push(s); await S.set('d', D); window.gyxQuestOpen(); return D.run; };
window.gyxQuestPick = async i => {
    const r = D.run; if (!r) return; const c = X.char(r.cid), cur = r.steps[r.steps.length - 1]; cur.pick = i === -1 ? ((document.getElementById('gyxQsOwn') || {}).value || '').trim() || cur.ch[0] : cur.ch[i];
    const b = document.getElementById('gyxQsBox'); if (b) b.insertAdjacentHTML('beforeend', `<div class="gyx-tip">${X.v('TA 在想接下来发生什么……', '故事继续……', '……')}</div>`);
    const s = await nextStep(c, r);
    if (s.end) { r.end = s.end; r.title = s.title; r.done = Date.now(); D.log.unshift(r); D.run = null; await S.set('d', D); window.gyxQuestOpen(r.cid, r.id); return r; }
    r.steps.push(s); await S.set('d', D); window.gyxQuestOpen(); return r;
};
window.gyxQuestQuit = async () => { D.run = null; await S.set('d', D); window.gyxQuestOpen(); };
window.gyxQuestData = () => D;
window.gyxQuestOpen = function (who, showId) {
    const r = D.run, c = r ? X.char(r.cid) : (X.char(who) || X.cur()); if (!c) return; const cid = String(c.id), done = showId && D.log.find(x => x.id === showId);
    const story = x => `<div class="qs-intro">${X.esc(WORLDS[x.w].intro)}</div>` + x.steps.map((s, k) => `<div class="qs-sc">${X.esc(s.t).replace(/\n/g, '<br>')}</div>${s.pick ? `<div class="qs-pick">→ ${X.esc(s.pick)}</div>` : ''}`).join('');
    X.panel('gyxQsOv', r ? `${WORLDS[r.w].ico} ${r.w}` : done ? `${WORLDS[done.w].ico} ${X.esc(done.title)}` : '🧭 文字冒险', r ? `<div id="gyxQsBox" class="qs-box">${story(r)}<div class="qs-ch">${r.steps[r.steps.length - 1].ch.map((t, i) => `<button class="gyx-btn lite" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.disabled=true);gyxQuestPick(${i})">${X.esc(t)}</button>`).join('')}<div class="gyx-row"><input id="gyxQsOwn" class="gyx-who" style="flex:1" placeholder="或者自己写怎么做"><button class="gyx-btn" onclick="gyxQuestPick(-1)">就这么做</button></div></div></div><div class="gyx-row"><span class="gyx-tip">第 ${r.steps.length} 步 · 大约 7 步一个结局</span><span class="gyx-chip" onclick="gyxQuestQuit()">不玩了</span></div>`
        : done ? `<div class="qs-box">${story(done)}<div class="qs-end"><b>— ${X.esc(done.title)} —</b><div>${X.esc(done.end)}</div></div></div><div class="gyx-row"><button class="gyx-btn lite" onclick="gyxQuestOpen('${cid}')">‹ 冒险手账</button></div>`
        : `<div class="gyx-row">${X.whoSel(cid, 'gyxQuestOpen')}</div><div class="gyx-tip">${X.v('选一个世界，TA 带你去。', '今天想去哪儿冒险？', 'TA 已经准备好当旁白了。')}</div><div class="qs-worlds">${Object.keys(WORLDS).map(w => `<div onclick="this.style.opacity=.5;gyxQuestStart('${cid}','${w}')"><span>${WORLDS[w].ico}</span><b>${w}</b></div>`).join('')}</div>
        <div style="font-weight:700;margin:12px 0 4px">冒险手账（打通 ${D.log.filter(x => x.cid === cid).length} 次）</div>${D.log.filter(x => x.cid === cid).map(x => `<div class="qs-it" onclick="gyxQuestOpen('${cid}','${x.id}')"><span>${WORLDS[x.w].ico}</span><div><b>${X.esc(x.title)}</b><em>${x.w} · ${x.steps.length} 步 · ${new Date(x.done).toLocaleDateString()}</em></div></div>`).join('') || '<div class="gyx-tip">还没打通过</div>'}`);
    const b = document.getElementById('gyxQsBox'); if (b) b.scrollTop = 1e9;
};
X.ctx(id => { const r = D.run; if (r && r.cid === String(id)) return `【你们正在玩文字冒险「${r.w}」】到第 ${r.steps.length} 步：${r.steps[r.steps.length - 1].t.slice(0, 60)}`; const x = D.log.find(l => l.cid === String(id)); return x && Date.now() - x.done < 864e5 ? `【你们刚打通了一场冒险「${x.w}」】结局：${x.title}。` : ''; }, 'gyxQuest');
X.action({ key: 'gyx_quest', label: '邀她一起玩一场文字冒险', hint: '你当旁白', need: c => !D.run && !D.log.some(x => x.cid === String(c.id) && Date.now() - x.done < 3 * 864e5),
    run: async c => { const w = X.pick(Object.keys(WORLDS)); X.notify(c, `🧭 ${X.esc(X.name(c))} ${X.v('邀你去一场冒险', '准备好了一个故事', '想带你去冒险')}：${w}`, '点开就出发', () => window.gyxQuestStart(c.id, w)); return (await X.reach(c, `你想当旁白，带她玩一场文字冒险「${w}」（她可以在「🧭 文字冒险」里开始）。神神秘秘地邀请她`)) ? '邀你冒险' : null; } }, 'gyxQuest');
X.today(() => ({ title: '🧭 文字冒险', rows: (D.run ? [{ t: '进行中', x: D.run.w + ' · 第 ' + D.run.steps.length + ' 步', go: 'gyxQuestOpen()' }] : []).concat(D.log.filter(x => X.day(new Date(x.done)) === X.day()).map(x => ({ t: '打通', x: X.esc(x.title), go: `gyxQuestOpen('${x.cid}','${x.id}')` }))) }), 'gyxQuest');
X.widget('gyxQuestW', { n: '文字冒险', sizes: ['s', 'm'], tap: () => window.gyxQuestOpen(), r: w => D.run ? X.gw(w, WORLDS[D.run.w].ico, D.run.w, ['第 ' + D.run.steps.length + ' 步', '等你选']) : X.gw(w, '🧭', '文字冒险', [D.log.length ? '打通 ' + D.log.length + ' 次' : '去冒险？', D.log[0] ? X.esc(D.log[0].title) : '']) }, 'gyxQuest');
X.memArr({ k: 'gyxQuest', ico: '🧭', n: '文字冒险', d: '打通过的冒险和结局', arr: () => D.log, text: x => x.title + '：' + x.end, edit: (x, v) => { const i = v.indexOf('：'); if (i > 0) { x.title = v.slice(0, i); x.end = v.slice(i + 1); } else x.end = v; }, meta: x => x.w + ' · ' + new Date(x.done).toLocaleDateString(), save: () => S.set('d', D) }, 'gyxQuest');
X.css('gyxQsCss', `.qs-box{max-height:60vh;overflow:auto;padding:4px 2px}.qs-intro{font-style:italic;color:#7a6a55;margin:6px 0 10px}.qs-sc{background:#f7f4ee;border-radius:14px;padding:10px 13px;margin:8px 0;line-height:1.8;font-size:14.5px}.qs-pick{text-align:right;color:#c0567a;font-size:13.5px;margin:4px 6px}.qs-ch{display:flex;flex-direction:column;gap:6px;margin-top:10px}.qs-ch>button{text-align:left}.qs-end{text-align:center;padding:16px 8px;background:linear-gradient(#fff,#fff3e0);border-radius:16px;margin-top:10px;line-height:1.8}.qs-end b{display:block;color:#b0703a;margin-bottom:6px}.qs-worlds{display:grid;grid-template-columns:1fr 1fr;gap:8px}.qs-worlds div{border-radius:16px;background:#f7f7f9;padding:16px;text-align:center;cursor:pointer}.qs-worlds span{font-size:36px;display:block}.qs-it{display:flex;gap:10px;align-items:center;padding:8px 2px;border-bottom:1px solid #f2f2f2;cursor:pointer}.qs-it span{font-size:24px}.qs-it em{display:block;font-style:normal;font-size:11.5px;color:#999}`);
X.mini({ id: 'gyxQuest', icon: '🧭', title: '文字冒险', desc: 'TA 当旁白，你来选怎么走', cat: '一起做', onOpen: () => window.gyxQuestOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; })();
