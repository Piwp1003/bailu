/* 🔮 神秘学加量：在原来的神秘学（求签、雷诺曼、卢恩、易经、星座、灵摆、占星骰子）之外，再加一堆小手机小组件——塔罗（一张 / 三张）、月相、幸运色和数字、水晶球、天使数字、今日水晶、花语签、守护动物、星座配对、月老灵签、脉轮能量、咖啡渣、五行今日、你们的恋爱运势。点一下重抽，结果可以让 TA 解读 */
if (window.__gyxMystic) return; window.__gyxMystic = 1;
X.feat('gyxMystic', { n: '🔮 神秘学加量', desc: '塔罗、月相、水晶球、天使数字、花语、守护动物、月老灵签……一堆神秘学小组件' });
const S = X.store('mystic');
let D = { cur: {}, log: [], sign: 0 };   // cur[kind] = 最近一次结果
const R = () => Math.random();
const sample = (a, n) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
// ---------- 资料 ----------
const MAJOR = [['愚者', '新的开始、说走就走、别想太多'], ['魔术师', '手里的东西都够了，去做'], ['女祭司', '答案在心里，安静下来听'], ['皇后', '丰盛、被好好照顾、温柔'], ['皇帝', '稳住、定规矩、扛起来'], ['教皇', '传统、请教别人、守约'], ['恋人', '选择、心动、两个人的事'], ['战车', '往前冲、意志赢一切'], ['力量', '温柔地坚持，以柔克刚'], ['隐者', '一个人想清楚、慢下来'], ['命运之轮', '转机来了、顺势而为'], ['正义', '公平、有因有果、讲清楚'], ['倒吊人', '换个角度看、先等等'], ['死神', '一件事结束，另一件开始'], ['节制', '平衡、刚刚好、慢慢调'], ['恶魔', '放不下的执念、小心上瘾'], ['高塔', '突然的变化，推倒重来'], ['星星', '希望、治愈、慢慢好起来'], ['月亮', '看不清、别被情绪骗了'], ['太阳', '开心、坦荡、一切明朗'], ['审判', '回头看、被唤醒、重新开始'], ['世界', '圆满、完成、一个阶段的终点']];
const SUITS = [['权杖', '行动和热情'], ['圣杯', '感情和关系'], ['宝剑', '想法和冲突'], ['星币', '钱、身体和现实']];
const RANKS = [['王牌', '刚刚开始的'], ['二', '要做选择的'], ['三', '有了点成果的'], ['四', '想稳一稳的'], ['五', '有点不顺的'], ['六', '慢慢回暖的'], ['七', '要坚持一下的'], ['八', '加速推进的'], ['九', '快到头了的'], ['十', '告一段落的'], ['侍从', '带来消息的'], ['骑士', '急着出发的'], ['王后', '温柔成熟的'], ['国王', '掌控全局的']];
const TAROT = MAJOR.map(([n, m]) => ({ n, m, major: 1 })).concat(...SUITS.map(([s, sm]) => RANKS.map(([r, rm]) => ({ n: s + r, m: rm + sm }))));
const MOON = [['新月', '🌑', '许愿、开始新的事'], ['娥眉月', '🌒', '小步往前'], ['上弦月', '🌓', '做决定、行动'], ['盈凸月', '🌔', '调整、打磨'], ['满月', '🌕', '收获、情绪满溢'], ['亏凸月', '🌖', '分享、感恩'], ['下弦月', '🌗', '放下、整理'], ['残月', '🌘', '休息、告别']];
const COLORS = [['樱花粉', '#ffb7c5'], ['雾霾蓝', '#8fa9c4'], ['抹茶绿', '#a8c686'], ['奶油黄', '#fbe7a1'], ['薰衣草紫', '#b8a1d9'], ['珊瑚橘', '#ff8a65'], ['月光白', '#f4f1ea'], ['焦糖棕', '#b07a4f'], ['湖水青', '#6cc3c1'], ['酒红', '#9b2d3c'], ['星空黑', '#2b2b3a'], ['天青', '#9fd3e6']];
const DIRS = ['东', '南', '西', '北', '东南', '西南', '东北', '西北'];
const BALL = ['会的，比你想的快', '现在还看不清，过几天再问', '答案是肯定的', '别抱太大期望', '换个方式就能成', '它已经在路上了', '这件事要靠你主动', '时机未到', '放心去做', '先照顾好自己再说', '有人在悄悄帮你', '再问一次，认真点'];
const ANGEL = [['111', '想法正在变成现实，多想好事'], ['222', '一切在慢慢对齐，耐心一点'], ['333', '你被支持着，放心表达'], ['444', '你很安全，有人在守着'], ['555', '大的变化要来了'], ['666', '别只顾着焦虑，回到身边的小事'], ['777', '方向对了，继续'], ['888', '好运和回报在路上'], ['999', '一件事要结束了，准备好新的'], ['1010', '跟着直觉走'], ['1111', '许个愿吧'], ['1212', '相信自己正在成长'], ['1314', '有人一直想着你'], ['520', '被爱着']];
const CRYSTAL = [['粉晶', '温柔、爱自己也被爱'], ['紫水晶', '安神、好好睡一觉'], ['黄水晶', '财运、自信'], ['白水晶', '清空杂念、专注'], ['月光石', '直觉、情绪平稳'], ['黑曜石', '挡掉坏情绪'], ['海蓝宝', '好好说话、沟通顺'], ['草莓晶', '桃花、心动'], ['虎眼石', '勇气、行动力'], ['拉长石', '灵感、转变'], ['绿幽灵', '事业、慢慢积累'], ['青金石', '想明白一件事']];
const FLOWERS = [['向日葵', '一直看着你'], ['桔梗', '不变的爱'], ['满天星', '甘愿做配角的喜欢'], ['白玫瑰', '纯粹、我配得上你'], ['铃兰', '幸福会回来'], ['勿忘我', '别忘了我'], ['洋桔梗', '真诚不变的爱'], ['栀子花', '永恒的约定'], ['郁金香', '爱的告白'], ['蒲公英', '自由、停不下的爱'], ['风信子', '重新开始'], ['小雏菊', '藏在心里的爱'], ['茉莉', '你是我的'], ['蓝雪花', '冷淡中的热情']];
const ANIMALS = [['狐狸', '聪明、会绕弯子保护自己'], ['猫头鹰', '看得透、夜里最清醒'], ['鹿', '温柔又敏感'], ['狼', '重感情、认定了就不放'], ['熊', '慢热但很能扛'], ['海豚', '开心果、会照顾气氛'], ['猫', '自由、有点傲娇'], ['兔子', '心软、容易紧张'], ['鲸', '安静、心很大'], ['乌鸦', '记仇也记恩'], ['水獭', '黏人、喜欢牵手'], ['蝴蝶', '正在变成更好的样子']];
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const ELEM = ['火', '土', '风', '水'];
const LOTS = [['上上签', '天作之合，佳期在望'], ['上签', '心意相通，莫负良辰'], ['中上签', '细水长流，贵在坚持'], ['中签', '缘分在前，需主动一步'], ['中下签', '好事多磨，耐心等待'], ['下签', '暂避锋芒，静待时机']];
const CHAKRA = [['海底轮', '🔴', '安全感'], ['脐轮', '🟠', '创造和欲望'], ['太阳轮', '🟡', '自信'], ['心轮', '🟢', '爱'], ['喉轮', '🔵', '表达'], ['眉心轮', '🟣', '直觉'], ['顶轮', '⚪', '连接']];
const COFFEE = [['心形', '有人在想你'], ['鸟', '好消息要来'], ['钥匙', '一扇门会打开'], ['山', '有点难但能翻过去'], ['月亮', '情绪需要照顾'], ['路', '要出一趟门'], ['花', '小小的开心'], ['星星', '愿望会实现一点点'], ['圆圈', '一件事会圆满'], ['船', '远方的消息']];
const WX = ['金', '木', '水', '火', '土'];
// ---------- 抽 ----------
const DO = {
    tarot1: () => { const c = sample(TAROT, 1)[0]; return { c, rv: R() < 0.3 }; },
    tarot3: () => ({ cs: sample(TAROT, 3).map(c => ({ c, rv: R() < 0.3 })) }),
    moon: () => { const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000, age = ((Date.now() / 86400000 - ref) % syn + syn) % syn, i = Math.floor((age / syn) * 8 + 0.5) % 8; return { i, age: Math.round(age * 10) / 10, ill: Math.round((1 - Math.cos(2 * Math.PI * age / syn)) / 2 * 100) }; },
    lucky: () => ({ col: X.pick(COLORS), num: 1 + Math.floor(R() * 99), dir: X.pick(DIRS) }),
    ball: () => ({ a: X.pick(BALL) }),
    angel: () => ({ a: X.pick(ANGEL) }),
    crystal: () => ({ a: X.pick(CRYSTAL) }),
    flower: () => ({ a: X.pick(FLOWERS) }),
    animal: () => ({ a: X.pick(ANIMALS) }),
    match: () => { const a = D.sign || 0, b = (D.taSign != null ? D.taSign : Math.floor(R() * 12)), ea = ELEM[a % 4], eb = ELEM[b % 4]; const good = { 火风: 92, 风火: 92, 土水: 90, 水土: 90, 火火: 80, 土土: 82, 风风: 78, 水水: 85 }[ea + eb] || 60 + Math.floor(R() * 20); return { a, b, s: Math.min(99, good + Math.floor(R() * 8)) }; },
    yuelao: () => { const l = X.pick(LOTS); return { l, no: 1 + Math.floor(R() * 100) }; },
    chakra: () => ({ v: CHAKRA.map(() => 30 + Math.floor(R() * 70)) }),
    coffee: () => ({ a: sample(COFFEE, 2) }),
    wuxing: () => { const v = WX.map(() => 10 + Math.floor(R() * 90)); const lo = v.indexOf(Math.min(...v)); return { v, lo }; },
    love: () => ({ s: 60 + Math.floor(R() * 40), tip: X.pick(['今天适合主动说想你', '小心为小事拌嘴', '一起吃顿好的', '适合翻旧照片', '多夸夸对方', '早点睡，别熬夜吵架', '给对方留一句话', '一起散个步']) })
};
const NAMES = { tarot1: '🃏 今日塔罗', tarot3: '🃏 塔罗三张', moon: '🌙 月相', lucky: '🍀 幸运色和数字', ball: '🔮 水晶球', angel: '😇 天使数字', crystal: '💎 今日水晶', flower: '🌷 花语签', animal: '🦊 守护动物', match: '♈ 星座配对', yuelao: '🧧 月老灵签', chakra: '🌈 脉轮能量', coffee: '☕ 咖啡渣', wuxing: '☯️ 五行今日', love: '💞 恋爱运势' };
const AUTO = ['moon'];   // 自动算的，不用抽
function text(k, x) {
    if (!x) return '';
    if (k === 'tarot1') return `${x.c.n}${x.rv ? '（逆位）' : ''}：${x.c.m}${x.rv ? '，但现在有点卡住' : ''}`;
    if (k === 'tarot3') return ['过去', '现在', '将来'].map((p, i) => `${p}·${x.cs[i].c.n}${x.cs[i].rv ? '（逆）' : ''}`).join('　');
    if (k === 'moon') return `${MOON[x.i][1]} ${MOON[x.i][0]}（月龄 ${x.age} 天，亮 ${x.ill}%）：${MOON[x.i][2]}`;
    if (k === 'lucky') return `幸运色 ${x.col[0]}，幸运数字 ${x.num}，方位 ${x.dir}`;
    if (k === 'ball' || k === 'angel' || k === 'crystal' || k === 'flower' || k === 'animal') return Array.isArray(x.a) ? `${x.a[0]}：${x.a[1]}` : x.a;
    if (k === 'match') return `${SIGNS[x.a]}座 × ${SIGNS[x.b]}座：契合度 ${x.s}%`;
    if (k === 'yuelao') return `第 ${x.no} 签 ${x.l[0]}：${x.l[1]}`;
    if (k === 'chakra') { const lo = x.v.indexOf(Math.min(...x.v)); return `最弱的是${CHAKRA[lo][0]}（${CHAKRA[lo][2]}），今天多照顾一下`; }
    if (k === 'coffee') return x.a.map(a => `${a[0]}（${a[1]}）`).join('、');
    if (k === 'wuxing') return `今天${WX[x.lo]}最弱，${{ 金: '多晒太阳', 木: '去看看绿色', 水: '多喝水', 火: '动一动出出汗', 土: '吃顿热饭' }[WX[x.lo]]}`;
    if (k === 'love') return `恋爱运 ${x.s} 分：${x.tip}`;
    return '';
}
window.gyxMysticDo = async function (k) { if (!DO[k]) return null; const x = DO[k](); D.cur[k] = Object.assign(x, { at: Date.now() }); D.log.unshift({ k, t: text(k, x), at: Date.now() }); D.log = D.log.slice(0, 200); await S.set('d', D); X.repaint(); if (document.getElementById('gyxMyOv')) window.gyxMysticOpen(k); return x; };
const cur = k => D.cur[k] || (AUTO.includes(k) ? DO[k]() : null);
// 让 TA 解读
async function read(c, k) {
    const x = cur(k); if (!x) return null; const t = text(k, x);
    if (X.bailu()) return X.cards(['占卜', '聊天'], c, 2).join('') || '我看不太懂，但我觉得是好兆头。';
    return X.plain(await X.ask(`${X.who(c)}\n她刚刚玩了「${NAMES[k].replace(/^\S+ /, '')}」，结果是：${t}。\n用你自己的口吻帮她解读一下（60~150 字）：结合她最近的状态和你们的聊天，说点有用也有温度的，别装神弄鬼，信不信随她。\n最近的聊天：\n${X.recent(c, 8)}\n只输出这段话。`) || '');
}
window.gyxMysticRead = async function (k, cid) { const c = X.char(cid) || X.cur(); if (!c) return null; const el = document.getElementById('gyxMyRead'); if (el) el.textContent = '……'; const t = await read(c, k); if (el) el.textContent = t || '……'; if (t) { X.say(c, `🔮 ${t}`); } return t; };
window.gyxMysticSign = async (v, ta) => { if (ta) D.taSign = v; else D.sign = v; await S.set('d', D); window.gyxMysticOpen('match'); };
window.gyxMysticOpen = function (k) {
    k = k || window.__gyxMyK || 'tarot1'; window.__gyxMyK = k; const x = cur(k);
    X.panel('gyxMyOv', '🔮 神秘学加量', `<div class="gyx-row">${Object.entries(NAMES).map(([kk, n]) => `<span class="gyx-chip ${kk === k ? 'on' : ''}" onclick="gyxMysticOpen('${kk}')">${n}</span>`).join('')}</div>
        <div class="my-res">${x ? render(k, x, 'm') : '<div class="gyx-tip">点下面「抽」</div>'}</div>
        ${k === 'match' ? `<div class="gyx-row">我是 <select class="gyx-who" onchange="gyxMysticSign(+this.value)">${SIGNS.map((s, i) => `<option value="${i}"${i === D.sign ? ' selected' : ''}>${s}座</option>`).join('')}</select> TA 是 <select class="gyx-who" onchange="gyxMysticSign(+this.value,1)">${SIGNS.map((s, i) => `<option value="${i}"${i === D.taSign ? ' selected' : ''}>${s}座</option>`).join('')}</select></div>` : ''}
        <div class="gyx-row">${AUTO.includes(k) ? '' : `<button class="gyx-btn" onclick="gyxMysticDo('${k}')">${x ? '再抽一次' : '抽'}</button>`}<button class="gyx-btn lite" onclick="gyxMysticRead('${k}')">让 TA 解读</button></div>
        <div id="gyxMyRead" class="gyx-hand my-read"></div>
        <div class="gyx-tip">这些也都是小手机桌面的小组件（加小组件时找「🔮」开头的），点一下就重抽。只是好玩，别太当真～</div>`);
};
// ---------- 小组件 ----------
function render(k, x, size) {
    const m = size !== 's';
    if (k === 'tarot1') return `<div class="my-t ${x.rv ? 'rv' : ''}"><div class="my-card"><i>${x.c.major ? '✦' : '◇'}</i><b>${x.c.n}</b></div>${m ? `<span>${X.esc(text(k, x))}</span>` : ''}</div>`;
    if (k === 'tarot3') return `<div class="my-t3">${x.cs.slice(0, m ? 3 : 1).map((y, i) => `<div class="my-card ${y.rv ? 'rv' : ''}"><em>${['过去', '现在', '将来'][i]}</em><b>${y.c.n}</b></div>`).join('')}</div>`;
    if (k === 'moon') return `<div class="my-mo"><b>${MOON[x.i][1]}</b><span>${MOON[x.i][0]}${m ? ' · 亮 ' + x.ill + '% · ' + MOON[x.i][2] : ''}</span></div>`;
    if (k === 'lucky') return `<div class="my-lk" style="--c:${x.col[1]}"><i></i><b>${x.num}</b><span>${x.col[0]}${m ? ' · 方位 ' + x.dir : ''}</span></div>`;
    if (k === 'match') return `<div class="my-mo"><b>${x.s}%</b><span>${SIGNS[x.a]} × ${SIGNS[x.b]}</span></div>`;
    if (k === 'chakra') return `<div class="my-ch">${CHAKRA.map((c, i) => `<i style="height:${x.v[i]}%" title="${c[0]}">${m ? '' : ''}</i>`).join('')}${m ? `<span>${X.esc(text(k, x))}</span>` : ''}</div>`;
    if (k === 'wuxing') return `<div class="my-ch wx">${WX.map((w, i) => `<i style="height:${x.v[i]}%"><em>${w}</em></i>`).join('')}${m ? `<span>${X.esc(text(k, x))}</span>` : ''}</div>`;
    const ico = NAMES[k].split(' ')[0], t = text(k, x), [head, ...rest] = t.split('：');
    return `<div class="my-g"><b>${ico}</b><strong>${X.esc(head.slice(0, 14))}</strong>${m && rest.length ? `<span>${X.esc(rest.join('：'))}</span>` : ''}</div>`;
}
Object.keys(NAMES).forEach(k => X.widget('gyxMy_' + k, { n: NAMES[k], sizes: ['s', 'm'], tap: () => window.gyxMysticDo(k), r: w => { const x = cur(k); return x ? `<div class="my-w">${render(k, x, w.size)}</div>` : X.gw(w, NAMES[k].split(' ')[0], NAMES[k].replace(/^\S+ /, ''), ['点一下抽']); } }, 'gyxMystic'));
X.action({ key: 'gyx_mystic_more', label: '帮她抽一张塔罗 / 看看今天的运势，再解读给她听', hint: '想哄她开心、或者她最近有点迷茫', need: () => true,
    run: async c => { const k = X.pick(['tarot1', 'tarot3', 'love', 'yuelao', 'flower', 'crystal']); await window.gyxMysticDo(k); const t = await read(c, k); if (!t) return null; X.say(c, `🔮 给你抽了个${NAMES[k].replace(/^\S+ /, '')}：${text(k, cur(k))}\n${t}`); return '帮你抽了' + NAMES[k].replace(/^\S+ /, ''); } }, 'gyxMystic');
X.today(() => { const L = D.log.filter(x => X.day(new Date(x.at)) === X.day()).slice(0, 3); const mo = DO.moon(); return { title: '🔮 神秘学', rows: [{ t: MOON[mo.i][1], x: MOON[mo.i][0] + ' · ' + MOON[mo.i][2], go: "gyxMysticOpen('moon')" }].concat(L.map(x => ({ t: NAMES[x.k].split(' ')[0], x: X.esc(x.t), go: `gyxMysticOpen('${x.k}')` }))) }; }, 'gyxMystic');
X.css('gyxMyCss', `.my-res{padding:14px;border-radius:18px;background:linear-gradient(160deg,#241b3a,#3d2c5e);color:#f3e9ff;min-height:90px;display:flex;align-items:center;justify-content:center;margin:8px 0}.my-read{font-size:18px;line-height:1.8;margin:8px 0;min-height:10px}
.my-w{height:100%;display:flex;align-items:center;justify-content:center;border-radius:14px;background:linear-gradient(160deg,#241b3a,#3d2c5e);color:#f3e9ff;overflow:hidden;padding:6px;box-sizing:border-box}
.my-card{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:56px;height:84px;border-radius:8px;border:1.5px solid #e6c97a;background:linear-gradient(170deg,#3b2a63,#1d1430);color:#f5e6b8;padding:4px;box-sizing:border-box;text-align:center}.my-card b{font-size:12px;font-weight:600;line-height:1.2}.my-card i{font-style:normal;color:#e6c97a}.my-card em{font-style:normal;font-size:10px;opacity:.7}.my-card.rv b,.my-t.rv .my-card b{transform:rotate(180deg)}
.my-t{display:flex;align-items:center;gap:10px}.my-t span{font-size:12.5px;line-height:1.5;max-width:180px}.my-t3{display:flex;gap:6px}
.my-mo,.my-g,.my-lk{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}.my-mo b{font-size:34px;font-weight:normal}.my-mo span,.my-g span,.my-lk span{font-size:12px;opacity:.85;line-height:1.4}.my-g b{font-size:26px;font-weight:normal}.my-g strong{font-size:14px}
.my-lk i{width:30px;height:30px;border-radius:50%;background:var(--c);box-shadow:0 0 14px var(--c)}.my-lk b{font-size:22px}
.my-ch{display:flex;align-items:flex-end;gap:4px;height:70px;flex-wrap:wrap;justify-content:center}.my-ch i{width:10px;border-radius:5px;background:linear-gradient(0deg,#ff5c8a,#ffd166,#7cc38a,#5ab0ff,#b9a6ff);display:block;position:relative}.my-ch.wx i{width:18px;background:#e6c97a}.my-ch.wx em{position:absolute;bottom:-16px;left:3px;font-style:normal;font-size:10px}.my-ch span{width:100%;text-align:center;font-size:11.5px;margin-top:16px}`);
X.mini({ id: 'gyxMystic', icon: '🔮', title: '神秘学加量', desc: '塔罗、月相、水晶球、天使数字、花语签、守护动物、月老灵签……也都能放到小手机桌面', cat: '生活', onOpen: () => window.gyxMysticOpen() });
X.mem({ k: 'gyxMystic', ico: '🔮', n: '抽过的牌和签', d: '（大家共用一份）', items: () => D.log, text: x => x.t, meta: x => NAMES[x.k] + ' · ' + new Date(x.at).toLocaleString(), edit: (x, v) => { x.t = v; }, del: (c, i) => { D.log.splice(i, 1); }, save: () => S.set('d', D) }, 'gyxMystic');
(async () => { D = Object.assign(D, await S.get('d', {})); D.cur = D.cur || {}; D.log = D.log || []; })();
