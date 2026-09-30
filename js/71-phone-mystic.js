/* ===========================================================================
   js/71 —— 📱 小手机：神秘学 + 更多小组件
   ---------------------------------------------------------------------------
   ✨ 神秘学（gyMystic）：雷诺曼、卢恩符文、易经起卦、星座运势、灵摆、求签、生命灵数、占星骰子。
      全是真随机（每次都重新洗 / 重新掷），不是写死的一天一个样；结果可以让 TA 解读、也能发给 TA。
   🧩 新小组件：神秘学、信件、日记、匿名区、论坛、每日一问、骰子、TA 的待办。
   只在小手机模式里出现，不碰别的页面。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyMysticLoaded) return;
    window.__gyMysticLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const R = () => Math.random();
    const pick = a => a[Math.floor(R() * a.length)];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pad = n => String(n).padStart(2, '0');
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    const seeded = seed => { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
    const uname = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '你';
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charOf = id => chars().find(c => String(c.id) === String(id));
    const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

    /* =================== 资料 =================== */
    const LENO = [['骑士', '🐎', '消息、访客、事情很快来'], ['四叶草', '🍀', '小幸运、短暂的好运'], ['船', '⛵', '远方、旅行、渴望'], ['房子', '🏠', '家、安稳、私人空间'], ['树', '🌳', '健康、慢慢成长'], ['云', '☁️', '迷惑、看不清、情绪起伏'],
        ['蛇', '🐍', '绕弯子、复杂、第三方'], ['棺材', '⚰️', '结束、休息、告一段落'], ['花束', '💐', '礼物、惊喜、被欣赏'], ['镰刀', '🌾', '突然的决定、一刀切'], ['鞭子', '🪢', '争执、反复、较劲'], ['鸟', '🐦', '聊天、八卦、有点紧张'],
        ['孩子', '👶', '新开始、单纯、小事'], ['狐狸', '🦊', '小心机、要留个心眼'], ['熊', '🐻', '力量、保护、有人撑腰'], ['星星', '⭐', '愿望、指引、希望'], ['鹳鸟', '🕊️', '变化、搬动、升级'], ['狗', '🐕', '朋友、忠诚、可靠的人'],
        ['塔', '🗼', '独处、规矩、边界'], ['花园', '🌷', '社交、聚会、公开场合'], ['山', '⛰️', '阻碍、要多花点力气'], ['十字路口', '🛤️', '选择、几条路'], ['老鼠', '🐭', '消耗、焦虑、一点点丢'], ['心', '❤️', '爱、心动、温柔'],
        ['戒指', '💍', '承诺、约定、绑定'], ['书', '📖', '秘密、学习、还没揭开的事'], ['信', '✉️', '文字、消息、一封信'], ['男人', '🧑', '他 / 你生命里的某位男性'], ['女人', '👩', '她 / 你生命里的某位女性'], ['百合', '🌸', '平静、成熟、体面'],
        ['太阳', '☀️', '成功、能量、晴朗'], ['月亮', '🌙', '情绪、被看见、浪漫'], ['钥匙', '🗝️', '答案、突破、打开'], ['鱼', '🐟', '财富、流动、丰盛'], ['锚', '⚓', '稳定、坚持、落地'], ['十字架', '✝️', '负担、信念、责任']];
    const RUNES = [['ᚠ', 'Fehu', '财富、收获', '失去、别太贪'], ['ᚢ', 'Uruz', '力量、身体好', '虚弱、错过机会'], ['ᚦ', 'Thurisaz', '突破、防御', '冲动、小心危险'], ['ᚨ', 'Ansuz', '讯息、智慧', '误会、话没说清'],
        ['ᚱ', 'Raidho', '旅程、往前走', '停滞、方向乱'], ['ᚲ', 'Kenaz', '灵感、点亮', '迷茫、灵感枯竭'], ['ᚷ', 'Gebo', '礼物、伙伴、交换', null], ['ᚹ', 'Wunjo', '喜悦、圆满', '失落、有点闷'],
        ['ᚺ', 'Hagalaz', '突变、被打乱', null], ['ᚾ', 'Nauthiz', '需要、忍耐', '匮乏、焦虑'], ['ᛁ', 'Isa', '冻结、暂停一下', null], ['ᛃ', 'Jera', '收成、时机到了', null],
        ['ᛇ', 'Eihwaz', '坚韧、转化', null], ['ᛈ', 'Perthro', '秘密、命运的安排', '秘密泄露、失望'], ['ᛉ', 'Algiz', '守护、被保护', '脆弱、没防备'], ['ᛊ', 'Sowilo', '成功、太阳', null],
        ['ᛏ', 'Tiwaz', '胜利、公正', '失衡、没斗志'], ['ᛒ', 'Berkano', '新生、被滋养', '停滞、家里的事'], ['ᛖ', 'Ehwaz', '同行、信任', '不安、背道而驰'], ['ᛗ', 'Mannaz', '自我、和别人的关系', '孤立、自我怀疑'],
        ['ᛚ', 'Laguz', '流动、直觉', '情绪泛滥'], ['ᛜ', 'Ingwaz', '完成、孕育', null], ['ᛞ', 'Dagaz', '黎明、转折点', null], ['ᛟ', 'Othala', '家、传承、归属', '失根、放不下过去'], ['◯', 'Wyrd（空白）', '未知，一切皆有可能', null]];
    const HEX = ['乾', '坤', '屯', '蒙', '需', '讼', '师', '比', '小畜', '履', '泰', '否', '同人', '大有', '谦', '豫', '随', '蛊', '临', '观', '噬嗑', '贲', '剥', '复', '无妄', '大畜', '颐', '大过', '坎', '离', '咸', '恒',
        '遁', '大壮', '晋', '明夷', '家人', '睽', '蹇', '解', '损', '益', '夬', '姤', '萃', '升', '困', '井', '革', '鼎', '震', '艮', '渐', '归妹', '丰', '旅', '巽', '兑', '涣', '节', '中孚', '小过', '既济', '未济'];
    const HEXM = ['刚健向上，自强不息', '包容承载，顺势而为', '万事开头难，先扎根', '懵懂待启，虚心请教', '耐心等，时机会来', '起了争执，退一步海阔天空', '团结众人，靠纪律取胜', '亲近相助，找到同伴',
        '小有积累，还要蓄力', '如履薄冰，谨慎前行', '天地交泰，顺利通达', '闭塞不通，先守住自己', '志同道合，与人同心', '收获丰盛，记得分享', '谦虚低调，反而得益', '愉悦顺心，别太松懈',
        '随机应变，跟对的人走', '旧问题该整顿了', '好事将近，主动靠近', '静观其变，多看少说', '咬碎阻碍，把话说开', '装点门面，也要有里子', '层层剥落，先护住根本', '一阳来复，重新开始',
        '不妄动，真诚最好', '厚积薄发，大有积蓄', '好好吃饭，好好说话', '担子太重，要调整', '重重险阻，心定则过', '光明依附，互相照亮', '心有感应，两情相悦', '细水长流，坚持不变',
        '适时退让，保存实力', '气势正盛，别用力过猛', '步步高升，前景明亮', '光被遮住，先韬光养晦', '家和万事兴，用心经营', '意见相左，求同存异', '前路难行，找人搭把手', '困局松动，放下包袱',
        '有舍才有得', '互相成就，好处在变多', '当断则断', '不期而遇，一场邂逅', '人聚在一起，好热闹', '稳稳上升，一步一个脚印', '被困住了，守住信念', '源源不断，修身养性',
        '该变了，除旧布新', '新气象，安定成形', '惊雷一响，有惊无险', '该停就停，静下来', '循序渐进，慢慢来', '摆正位置，关系才稳', '盛极之时，珍惜当下', '在路上，身在他乡',
        '柔顺渗透，顺风而行', '喜悦交流，笑一笑', '散了之后重新凝聚', '有节制，量力而行', '以诚相待，心意相通', '小事可行，大事缓缓', '已经完成，守成要稳', '还没结束，未来可期'];
    const TRI = { '111': ['乾', '☰', '天'], '100': ['震', '☳', '雷'], '010': ['坎', '☵', '水'], '001': ['艮', '☶', '山'], '000': ['坤', '☷', '地'], '011': ['巽', '☴', '风'], '101': ['离', '☲', '火'], '110': ['兑', '☱', '泽'] };
    const TORD = ['乾', '震', '坎', '艮', '坤', '巽', '离', '兑'];
    const KW = [[1, 34, 5, 26, 11, 9, 14, 43], [25, 51, 3, 27, 24, 42, 21, 17], [6, 40, 29, 4, 7, 59, 64, 47], [33, 62, 39, 52, 15, 53, 56, 31], [12, 16, 8, 23, 2, 20, 35, 45], [44, 32, 48, 18, 46, 57, 50, 28], [13, 55, 63, 22, 36, 37, 30, 49], [10, 54, 60, 41, 19, 61, 38, 58]];
    const hexOf = bits => { const lo = TRI[bits.slice(0, 3).join('')], up = TRI[bits.slice(3, 6).join('')]; const n = KW[TORD.indexOf(lo[0])][TORD.indexOf(up[0])]; return { n, name: HEX[n - 1], m: HEXM[n - 1], lo, up }; };
    const SIGNS = [['白羊', '♈', [3, 21], '火'], ['金牛', '♉', [4, 20], '土'], ['双子', '♊', [5, 21], '风'], ['巨蟹', '♋', [6, 22], '水'], ['狮子', '♌', [7, 23], '火'], ['处女', '♍', [8, 23], '土'],
        ['天秤', '♎', [9, 23], '风'], ['天蝎', '♏', [10, 24], '水'], ['射手', '♐', [11, 23], '火'], ['摩羯', '♑', [12, 22], '土'], ['水瓶', '♒', [1, 20], '风'], ['双鱼', '♓', [2, 19], '水']];
    const signOfDate = s => { const m = String(s || '').match(/(\d{1,2})-(\d{1,2})$/); if (!m) return null; const mo = +m[1], d = +m[2]; let best = 9; SIGNS.forEach((x, i) => { const [sm, sd] = x[2]; if (mo === sm && d >= sd) best = i; }); if (SIGNS.every(x => !(mo === x[2][0] && d >= x[2][1]))) { const prev = SIGNS.findIndex(x => x[2][0] === mo); best = (prev + 11) % 12; } return best; };
    const COLORS = ['珊瑚红', '奶油白', '雾霾蓝', '薄荷绿', '香芋紫', '柠檬黄', '焦糖棕', '樱花粉', '墨绿', '天空蓝', '经典黑', '橘子色'];
    const Z_OPEN = ['今天的你像充好电的手机，', '今天适合慢一点，', '今天心思有点细，', '今天运气在拐角处等你，', '今天容易被小事打动，', '今天行动力在线，', '今天的你格外有魅力，', '今天脑子转得很快，', '今天有点想躲起来，', '今天身边的人会帮你，'];
    const Z_TAIL = ['把想说的话说出口吧。', '别把情绪都藏在心里。', '记得多喝水，早点睡。', '有好消息会从远处来。', '适合把拖着的事做完。', '别跟自己较劲啦。', '晚上会有一点小惊喜。', '花钱前多想一秒。', '主动一点，结果会不一样。', '给在意的人发条消息吧。'];
    const LIFE = { 1: '开创者：独立、有主见，适合走在前面', 2: '协调者：温柔细腻，擅长陪伴和合作', 3: '表达者：有趣、会说话，创造力强', 4: '建造者：踏实可靠，一步一个脚印', 5: '自由者：爱冒险、爱新鲜，不喜欢被框住', 6: '守护者：责任感强，很会照顾人', 7: '探索者：爱思考，需要独处的时间', 8: '掌控者：有野心，擅长把事情做成', 9: '理想者：包容博爱，心里装着很多人', 11: '直觉大师：敏感、灵性强，是天生的引路人', 22: '造梦大师：能把很大的梦想变成现实', 33: '疗愈大师：温暖无私，身边的人都被你照亮' };
    const PLANETS = [['太阳', '自我、存在感'], ['月亮', '情绪、安全感'], ['水星', '沟通、想法'], ['金星', '爱、美、钱'], ['火星', '行动、欲望'], ['木星', '好运、扩张'], ['土星', '责任、考验'], ['天王星', '突变、自由'], ['海王星', '梦、直觉'], ['冥王星', '深层的转变']];
    const HOUSES = ['自己', '钱和物', '沟通和学习', '家', '恋爱和玩乐', '工作和身体', '伴侣', '亲密和秘密', '远方和信念', '事业', '朋友和愿望', '内心深处'];
    // 求签：签诗是随机拼的四句（每次都不一样）
    const LOT_LV = [['上上签', 8, 'good'], ['上吉签', 20, 'good'], ['中吉签', 30, 'mid'], ['中平签', 25, 'mid'], ['下签', 17, 'bad']];
    const LOT_L = {
        good: ['春风一夜到门前', '云开月出照小楼', '枝头喜鹊报平安', '顺水行舟不用篙', '花开正好蝶来时', '明灯一盏在前头', '心想事成好时节', '久旱逢来及时雨', '千里良缘一线牵', '拨云见日在今朝', '好事成双喜上眉', '金风玉露正相逢'],
        mid: ['半晴半雨半开花', '慢行一步看山高', '水到渠成莫心焦', '且把心事付清茶', '等闲风雨也寻常', '路远还需耐心行', '一半留白一半晴', '桥边柳色正青青', '守得云开见月明', '莫将小事挂心头', '且听风吟等时来', '船到桥头自然直'],
        bad: ['风急浪高且泊舟', '雾锁前山路未明', '暂把锋芒收一收', '雨打芭蕉夜未眠', '退后一步天地宽', '莫向寒江独钓愁', '冬尽春来总有时', '且守灯前一寸心', '莫急莫急再等等', '旧事如烟随风散', '留得青山在心头', '明朝自有好晴天']
    };
    const LOT_J = { good: ['所求皆顺，放手去做', '贵人在侧，好消息近了', '感情甜，事业稳，心想事成'], mid: ['凡事慢一点就好', '眼下平平，耐心会有回报', '不必强求，顺其自然'], bad: ['暂且守住，别急着冲', '先照顾好自己，事情会转好', '退一步反而是进一步'] };
    const LOT_T = ['求财：', '感情：', '出行：', '健康：', '学业 / 工作：'];
    const LOT_T2 = { good: ['顺', '大吉', '宜', '无碍', '有成'], mid: ['平', '小有', '可', '留意', '渐进'], bad: ['缓', '需守', '慎', '多休息', '再等等'] };

    /* =================== 各种占卜 =================== */
    const DO = {
        lenormand(n) { return { kind: 'lenormand', n, cards: shuffle(LENO).slice(0, n) }; },
        rune(n) { return { kind: 'rune', n, runes: shuffle(RUNES).slice(0, n).map(r => ({ r, rv: !!r[3] && R() < .4 })) }; },
        iching() {
            const lines = Array.from({ length: 6 }, () => [0, 0, 0].reduce(s => s + (R() < .5 ? 3 : 2), 0));   // 三枚铜钱：正 3 反 2
            const b0 = lines.map(v => (v === 7 || v === 9) ? 1 : 0), b1 = lines.map(v => v === 9 ? 0 : v === 6 ? 1 : ((v === 7) ? 1 : 0));
            const moving = lines.map((v, i) => (v === 6 || v === 9) ? i : -1).filter(i => i >= 0);
            return { kind: 'iching', lines, moving, ben: hexOf(b0), zhi: moving.length ? hexOf(b1) : null };
        },
        zodiac(si, roll) {
            const r = seeded('z' + today() + si + (roll || '')), sc = () => 1 + Math.floor(r() * 5);
            return { kind: 'zodiac', si, all: sc(), love: sc(), work: sc(), money: sc(), health: sc(), color: COLORS[Math.floor(r() * 12)], num: 1 + Math.floor(r() * 9), match: SIGNS[Math.floor(r() * 12)][0], text: Z_OPEN[Math.floor(r() * Z_OPEN.length)] + Z_TAIL[Math.floor(r() * Z_TAIL.length)] };
        },
        pendulum(q) { const w = [['是', 40], ['否', 35], ['再等等', 15], ['换个问法', 10]]; let x = R() * 100; const a = w.find(([, p]) => (x -= p) < 0) || w[0]; return { kind: 'pendulum', q, a: a[0] }; },
        lot() {
            let x = R() * 100; const lv = LOT_LV.find(([, p]) => (x -= p) < 0) || LOT_LV[2];
            const no = 1 + Math.floor(R() * 100), g = lv[2];
            return { kind: 'lot', no, lv: lv[0], poem: shuffle(LOT_L[g]).slice(0, 4), jie: pick(LOT_J[g]), topics: LOT_T.map(t => t + pick(LOT_T2[g])) };
        },
        life(date) {
            const ds = String(date || '').replace(/\D/g, ''); if (ds.length < 6) return null;
            let n = ds.split('').reduce((a, b) => a + +b, 0);
            while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = String(n).split('').reduce((a, b) => a + +b, 0);
            return { kind: 'life', date, n, m: LIFE[n] };
        },
        astro() { const p = pick(PLANETS), s = pick(SIGNS), h = 1 + Math.floor(R() * 12); return { kind: 'astro', p, s, h }; }
    };
    const NAMES = { lenormand: '🃏 雷诺曼', rune: 'ᚱ 卢恩符文', iching: '☯ 易经', zodiac: '♈ 星座', pendulum: '🔮 灵摆', lot: '🎋 求签', life: '🔢 生命灵数', astro: '🎲 占星骰子' };
    // 一句话说清结果（发给 TA / 让 TA 解读用）
    function textOf(x) {
        if (!x) return '';
        if (x.kind === 'lenormand') return `雷诺曼${x.n === 9 ? '九宫格' : x.n + '张'}：` + x.cards.map(c => `${c[0]}（${c[2]}）`).join('、');
        if (x.kind === 'rune') return '卢恩符文：' + x.runes.map(({ r, rv }) => `${r[1]}${rv ? '逆位' : ''}（${rv ? r[3] : r[2]}）`).join('、');
        if (x.kind === 'iching') return `易经起卦：本卦「${x.ben.name}」（${x.ben.m}）` + (x.zhi ? `，变爻在第 ${x.moving.map(i => i + 1).join('、')} 爻，之卦「${x.zhi.name}」（${x.zhi.m}）` : '，六爻安静没有变爻');
        if (x.kind === 'zodiac') return `${SIGNS[x.si][0]}座今日运势：综合${x.all}星、爱情${x.love}星、事业${x.work}星、财运${x.money}星；${x.text}`;
        if (x.kind === 'pendulum') return `我问灵摆「${x.q || '（心里默念的问题）'}」，它说：${x.a}`;
        if (x.kind === 'lot') return `求到第 ${x.no} 签，${x.lv}：${x.poem.join('，')}。解曰：${x.jie}`;
        if (x.kind === 'life') return `生命灵数 ${x.n}：${x.m}`;
        if (x.kind === 'astro') return `占星骰子：${x.p[0]}（${x.p[1]}）· ${x.s[0]}座 · 第 ${x.h} 宫（${HOUSES[x.h - 1]}）`;
        return '';
    }

    /* =================== 面板 =================== */
    let CUR = LS.get('gyMysticLast', {});   // 每种占卜最近一次的结果
    let TAB = 'lot';
    const saveCur = () => LS.set('gyMysticLast', CUR);
    function sheet(html) {
        if (document.body.classList.contains('gyphm') && typeof window.gyPmSheet === 'function') return window.gyPmSheet(html);
        let ov = document.getElementById('gyMysOv');
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyMysOv'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
        ov.innerHTML = `<div class="box">${html}</div>`; return ov;
    }
    const closeSheet = () => { if (typeof window.gyPmCloseSheet === 'function') window.gyPmCloseSheet(); const o = document.getElementById('gyMysOv'); if (o) o.remove(); };
    window.gyMysticClose = closeSheet;
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    function bodyOf(k) {
        const x = CUR[k];
        const btn = (lab, js) => `<span class="chip" onclick="${js}">${lab}</span>`;
        if (k === 'lenormand') {
            const top = `<div class="chips">${btn('抽 1 张', "gyMysticDo('lenormand',1)")}${btn('抽 3 张', "gyMysticDo('lenormand',3)")}${btn('九宫格', "gyMysticDo('lenormand',9)")}</div>`;
            if (!x) return top + '<div class="gm-tip">36 张雷诺曼：1 张看今天，3 张看一件事的来龙去脉，九宫格看整个局面（中间那张是核心）。</div>';
            const cell = (c, i) => `<div class="gm-card${x.n === 9 && i === 4 ? ' core' : ''}" style="animation-delay:${i * .06}s"><b>${c[1]}</b><span>${esc(c[0])}</span><em>${esc(c[2])}</em></div>`;
            const read = x.n === 1 ? `今天的关键词是「${esc(x.cards[0][2])}」。` : x.n === 3 ? `从「${esc(x.cards[0][0])}」开始，经过「${esc(x.cards[1][0])}」，落在「${esc(x.cards[2][0])}」——${esc(x.cards[2][2])}。` : `核心是「${esc(x.cards[4][0])}」：${esc(x.cards[4][2])}。上面一行是想法，中间一行是现在，下面一行是会怎么走。`;
            return top + `<div class="gm-grid n${x.n}">${x.cards.map(cell).join('')}</div><div class="gm-read">${read}</div>`;
        }
        if (k === 'rune') {
            const top = `<div class="chips">${btn('一颗', "gyMysticDo('rune',1)")}${btn('三颗（过去 · 现在 · 未来）', "gyMysticDo('rune',3)")}${btn('五颗十字', "gyMysticDo('rune',5)")}</div>`;
            if (!x) return top + '<div class="gm-tip">从 25 颗卢恩石里摸，有的会倒过来（逆位）。</div>';
            const POS = { 1: ['今天'], 3: ['过去', '现在', '未来'], 5: ['现在', '过去的影响', '未来', '根源', '走向'] }[x.n] || [];
            return top + `<div class="gm-grid rune n${x.n}">${x.runes.map(({ r, rv }, i) => `<div class="gm-stone${rv ? ' rv' : ''}" style="animation-delay:${i * .08}s"><em>${POS[i] || ''}</em><b>${r[0]}</b><span>${esc(r[1])}</span><i>${rv ? '逆位 · ' + esc(r[3]) : esc(r[2])}</i></div>`).join('')}</div>`;
        }
        if (k === 'iching') {
            const top = `<div class="chips">${btn('🪙 摇六次起一卦', "gyMysticDo('iching')")}</div>`;
            if (!x) return top + '<div class="gm-tip">三枚铜钱摇六次，从下往上成卦。遇到老阳 / 老阴就是变爻，会变出另一卦（之卦）。</div>';
            const ln = (v, i) => `<div class="gm-yao${(v === 7 || v === 9) ? ' yang' : ' yin'}${(v === 6 || v === 9) ? ' mv' : ''}"><i></i><em>${['初', '二', '三', '四', '五', '上'][i]}爻 ${v === 9 ? '老阳 ○' : v === 6 ? '老阴 ✕' : v === 7 ? '少阳' : '少阴'}</em></div>`;
            const hx = h => `<div class="gm-hex"><b>${h.up[1]}<br>${h.lo[1]}</b><div><span>第 ${h.n} 卦</span><strong>${esc(h.name)}</strong><em>${h.up[2]}${h.lo[2]} · ${esc(h.m)}</em></div></div>`;
            return top + `<div class="gm-ich"><div class="gm-lines">${x.lines.map(ln).reverse().join('')}</div><div>${hx(x.ben)}${x.zhi ? `<div class="gm-arrow">变 ↓</div>${hx(x.zhi)}` : '<div class="gm-tip">六爻安静，没有变爻：就看本卦。</div>'}</div></div>`;
        }
        if (k === 'zodiac') {
            let si = LS.get('gyMysticSign', null);
            if (si == null) { const b = typeof currentUser !== 'undefined' && currentUser && currentUser.birthdate; si = signOfDate(b); if (si == null) si = 0; }
            const z = (x && x.si === si) ? x : DO.zodiac(si);
            if (!x || x.si !== si) { CUR.zodiac = z; saveCur(); }
            const s = SIGNS[si];
            return `<div class="chips gm-signs">${SIGNS.map((q, i) => `<span class="chip${i === si ? ' on' : ''}" onclick="gyMysticSign(${i})">${q[1]} ${q[0]}</span>`).join('')}</div>
                <div class="gm-zod"><b>${s[1]}</b><div><strong>${s[0]}座 · 今日</strong><em>${s[3]}象星座</em></div><span class="chip" onclick="gyMysticDo('zodiac')">↻ 再看一次</span></div>
                <div class="gm-bars">${[['综合', z.all], ['爱情', z.love], ['事业', z.work], ['财运', z.money], ['健康', z.health]].map(([a, n]) => `<p><i>${a}</i><u>${stars(n)}</u></p>`).join('')}</div>
                <div class="gm-read">${esc(z.text)}</div><div class="gm-tip">幸运色 ${z.color} · 幸运数字 ${z.num} · 速配 ${z.match}座</div>`;
        }
        if (k === 'pendulum') {
            return `<input class="in gm-q" id="gyMysQ" placeholder="心里想一个只能回答「是 / 否」的问题（也可以不写）" value="${esc((x && x.q) || '')}">
                <div class="gm-pend"><div class="gm-rope${x && x.swing ? ' swing' : ''}"><i></i><b></b></div></div>
                <div class="gm-ans">${x ? esc(x.a) : '　'}</div>
                <div class="chips">${btn('问灵摆', "gyMysticDo('pendulum')")}</div>`;
        }
        if (k === 'lot') {
            const top = `<div class="chips">${btn('🎋 摇签筒', "gyMysticDo('lot')")}</div>`;
            if (!x) return top + '<div class="gm-tip">心里默念想问的事，摇一摇签筒。一共 100 支签，签诗每次都不一样。</div><div class="gm-tube"><i></i><i></i><i></i><i></i><i></i></div>';
            return top + `<div class="gm-lot"><em>第 ${x.no} 签</em><b>${esc(x.lv)}</b><div class="poem">${x.poem.map(p => `<span>${esc(p)}</span>`).join('')}</div><p>解曰：${esc(x.jie)}</p><div class="tp">${x.topics.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>`;
        }
        if (k === 'life') {
            const b = (x && x.date) || (typeof currentUser !== 'undefined' && currentUser && currentUser.birthdate) || '';
            return `<div class="gm-tip">生日的每一位数字加起来，一直加到个位（11、22、33 这三个大师数留着不加）。</div>
                <input class="in" type="date" id="gyMysD" value="${esc(b)}"><div class="chips">${btn('算一算', "gyMysticDo('life')")}</div>
                ${x ? `<div class="gm-life"><b>${x.n}</b><span>${esc(x.m)}</span></div>` : ''}`;
        }
        if (k === 'astro') {
            const top = `<div class="chips">${btn('🎲 掷三颗骰子', "gyMysticDo('astro')")}</div>`;
            if (!x) return top + '<div class="gm-tip">三颗骰子：一颗行星（什么能量）、一颗星座（什么味道）、一颗宫位（落在生活的哪一块）。</div>';
            return top + `<div class="gm-dice"><div><b>${x.p[0]}</b><span>${esc(x.p[1])}</span></div><div><b>${x.s[1]} ${x.s[0]}</b><span>${x.s[3]}象</span></div><div><b>第 ${x.h} 宫</b><span>${HOUSES[x.h - 1]}</span></div></div>
                <div class="gm-read">「${esc(x.p[1])}」的能量，落在「${HOUSES[x.h - 1]}」这一块，带着${x.s[0]}座的味道。</div>`;
        }
        return '';
    }
    function paint() {
        const cs = chars(), x = CUR[TAB];
        const tabs = Object.keys(NAMES).map(k => `<span class="chip${TAB === k ? ' on' : ''}" onclick="gyMystic('${k}')">${NAMES[k]}</span>`).join('');
        const share = x ? `<div class="lbl">让 TA 看看</div><div class="chips">${cs.map(c => `<span class="chip" onclick="gyMysticRead('${esc(c.id)}')">让 ${esc(c.remark || c.name)} 解读</span>`).join('')}<span class="chip" onclick="gyMysticRead('')">占卜师解读</span></div>
            <div class="chips">${cs.map(c => `<span class="chip" onclick="gyMysticSend('${esc(c.id)}')">发给 ${esc(c.remark || c.name)}</span>`).join('')}</div><div class="gm-rd" id="gyMysRead">${x.read ? esc(x.read).replace(/\n/g, '<br>') + (x.by ? `<div class="by">—— ${esc(x.by)}</div>` : '') : ''}</div>` : '';
        sheet(`<h4>✨ 神秘学</h4><div class="chips gm-tabs">${tabs}</div><div class="gm-body">${bodyOf(TAB)}</div>${share}<button class="it muted" onclick="gyMysticClose()">好了</button>`);
    }
    window.gyMystic = function (k) { if (k && k !== 'more') TAB = k; paint(); };
    window.gyMysticSign = i => { LS.set('gyMysticSign', i); CUR.zodiac = DO.zodiac(i); saveCur(); paint(); };
    window.gyMysticDo = function (k, n) {
        let r = null;
        if (k === 'zodiac') { const si = CUR.zodiac ? CUR.zodiac.si : 0; r = DO.zodiac(si, Math.random().toString(36).slice(2)); }
        else if (k === 'pendulum') { const q = (document.getElementById('gyMysQ') || {}).value || ''; r = DO.pendulum(q); CUR.pendulum = Object.assign({}, r, { a: '…', swing: 1 }); TAB = k; paint(); setTimeout(() => { CUR.pendulum = r; saveCur(); if (TAB === 'pendulum') paint(); }, 1600); return r; }
        else if (k === 'life') { r = DO.life((document.getElementById('gyMysD') || {}).value); if (!r) return null; }
        else r = DO[k](n);
        CUR[k] = r; saveCur(); TAB = k; paint();
        refreshWidgets();
        return r;
    };
    window.gyMysticCur = k => CUR[k] || null;
    window.gyMysticText = k => textOf(CUR[k]);
    window.gyMysticSend = function (cid) {
        const t = textOf(CUR[TAB]); if (!t || typeof globalChats === 'undefined') return;
        if (!globalChats[cid]) globalChats[cid] = [];
        globalChats[cid].push({ sender: 'me', text: t, timestamp: Date.now(), readBy: [] });
        try { saveAllData(); } catch (e) {}
        try { if (String(currentChatSessionId) === String(cid)) renderChatMessages(); } catch (e) {}
        try { if (typeof triggerAIBatchReply === 'function') triggerAIBatchReply(String(cid), t); } catch (e) {}
        try { showToast('', '发过去了', (charOf(cid) || {}).name || '', null, null, false); } catch (e) {}
    };
    window.gyMysticRead = async function (cid) {
        const x = CUR[TAB], t = textOf(x); if (!t) return;
        const box = document.getElementById('gyMysRead');
        const c = cid ? charOf(cid) : null;
        if (!(typeof sendChatRequest === 'function' && typeof myApiKey !== 'undefined' && myApiKey)) { if (box) box.innerHTML = '<span class="muted">还没配语言模型，先看上面的结果吧</span>'; return; }
        if (box) box.innerHTML = `<span class="muted">${c ? esc(c.remark || c.name) + ' 在看…' : '占卜师在看…'}</span>`;
        let p;
        if (c) {
            const base = typeof buildBasePrompt === 'function' ? buildBasePrompt(c, false, '') : `你是${c.name}。${c.persona || ''}`;
            const hist = typeof getRecentChatContext === 'function' ? getRecentChatContext(c.id) : '';
            p = `${base}\n${hist ? '【你们最近的聊天】\n' + hist + '\n' : ''}${uname()}刚刚占了一卦，拿给你看：\n${t}\n请完全用你自己的性格和说话方式，结合你们最近的事，跟${uname()}说说你怎么看。像你本人在聊天，不要写成算命文章。只输出你要说的话。`;
        } else p = `你是一位温柔又一针见血的占卜师。${uname()}的结果是：\n${t}\n请具体地解读，再给一段建议。语气温暖，不故弄玄虚。只输出解读正文。`;
        try {
            const data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, p);
            let txt = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            if (c && typeof applyRegexScripts === 'function') txt = applyRegexScripts(txt, 'ai_output', c.id);
            if (!txt) throw new Error('没写出东西来');
            x.read = txt; x.by = c ? (c.remark || c.name) : '占卜师'; saveCur();
            const b2 = document.getElementById('gyMysRead'); if (b2) b2.innerHTML = esc(txt).replace(/\n/g, '<br>') + `<div class="by">—— ${esc(x.by)}</div>`;
        } catch (e) { const b2 = document.getElementById('gyMysRead'); if (b2) b2.innerHTML = `<span class="muted">没解读成：${esc(String(e && e.message || e).slice(0, 80))}</span>`; }
    };
    window.__gyMysticDO = DO;
    function refreshWidgets() { try { const X = window.__gyPmW; if (X && X.render) X.render(); } catch (e) {} }

    /* =================== 小组件 =================== */
    const QS = ['你最想和我一起去的地方是哪里？', '最近一次心动是什么时候？', '如果明天放假一天，你想怎么过？', '你小时候的梦想是什么？', '你最喜欢我哪一点？', '有什么事你一直想做但还没做？', '你觉得我们第一次见面是什么感觉？', '最近有什么让你开心的小事？',
        '你害怕什么？', '你最近在听什么歌？', '如果可以瞬间学会一项技能，你选什么？', '你理想中的周末是什么样的？', '你最近有没有偷偷想我？', '你会怎么形容我们的关系？', '最想收到什么礼物？', '你难过的时候希望别人怎么做？',
        '有没有一句话一直想对我说？', '你最喜欢的季节是哪个？为什么？', '最近一次哭是因为什么？', '如果我们养一只宠物，你想养什么？', '你觉得十年后的自己在做什么？', '你最近的小烦恼是什么？', '你喜欢下雨天吗？', '一天里你最喜欢哪个时刻？',
        '你最想回到哪一天？', '你睡前通常在想什么？', '有什么是你觉得只有我懂的？', '最想和我一起做的一件小事是什么？', '你会记得我们聊过的哪句话？', '今天过得怎么样？'];
    function boot() {
        const X = window.__gyPmW; if (!X) return false;
        const { WD, T, G } = X;
        const V = w => (w.d && w.d.v) || '';
        const paintW = w => { try { X.render(); } catch (e) {} };
        const cidOf = w => (w.d && w.d.cid) || '';
        const pickChar = w => { const id = cidOf(w); return id ? charOf(id) : null; };
        const chipsFor = (w, key, list) => `<div class="chips">${list.map(([v, n]) => `<span class="chip${String((w.d && w.d[key]) || '') === String(v) ? ' on' : ''}" onclick="gyPmWSet('${w.id}','${key}','${esc(v)}')">${n}</span>`).join('')}</div>`;
        const whoEdit = w => `<div class="lbl">看谁的</div>${chipsFor(w, 'cid', [['', '谁都行'], ...chars().map(c => [c.id, esc(c.remark || c.name)])])}`;
        const plainT = (t, id) => { try { return X.plain(t, id); } catch (e) { return String(t || '').replace(/<[^>]+>/g, ''); } };
        const dt = ts => { const d = new Date(ts || 0); return `${d.getMonth() + 1}月${d.getDate()}日`; };

        // ✨ 神秘学
        const MV = [['', '求签'], ['lenormand', '雷诺曼'], ['rune', '卢恩符文'], ['iching', '易经'], ['zodiac', '星座'], ['pendulum', '灵摆'], ['astro', '占星骰子']];
        WD.mystic = {
            n: '神秘学', sizes: ['s', 'm'], vars: MV,
            tap: w => window.gyMystic(V(w) || 'lot'),
            act: (w, a) => { if (a === 'again') window.gyMysticDo(V(w) || 'lot', V(w) === 'lenormand' || V(w) === 'rune' ? (w.size === 's' ? 1 : 3) : undefined); },
            r: w => {
                const k = V(w) || 'lot', x = CUR[k], m = w.size === 'm';
                const again = `<em class="wx-rf" data-act="again" title="再来一次">↻</em>`;
                const head = `<em class="gw-h">${T(w, 'h', NAMES[k].replace(/^\S+ /, ''))}</em>`;
                if (!x && k !== 'zodiac') return `<div class="gw-my empty ${k}">${head}<b>${NAMES[k].split(' ')[0]}</b><span>${T(w, 'e', '点一下开始')}</span></div>`;
                if (k === 'lot') return `<div class="gw-my lot">${again}${head}<b class="pm-hf">${esc(x.lv)}</b>${m ? `<p>${x.poem.slice(0, 2).map(esc).join('<br>')}</p>` : `<span>第 ${x.no} 签</span>`}</div>`;
                if (k === 'lenormand') return `<div class="gw-my leno">${again}${head}<div class="row">${x.cards.slice(0, m ? 3 : 1).map(c => `<div class="c"><b>${c[1]}</b><span>${esc(c[0])}</span></div>`).join('')}</div>${m ? `<span>${esc(x.cards[0][2])}</span>` : ''}</div>`;
                if (k === 'rune') return `<div class="gw-my rune">${again}${head}<div class="row">${x.runes.slice(0, m ? 3 : 1).map(({ r, rv }) => `<div class="c${rv ? ' rv' : ''}"><b>${r[0]}</b><span>${esc(r[1])}</span></div>`).join('')}</div></div>`;
                if (k === 'iching') return `<div class="gw-my ich">${again}${head}<b class="pm-hf">${x.ben.up[1]}${x.ben.lo[1]} ${esc(x.ben.name)}</b><span>${esc(x.ben.m)}</span>${m && x.zhi ? `<span>→ 之卦 ${esc(x.zhi.name)}</span>` : ''}</div>`;
                if (k === 'zodiac') { const z = x || DO.zodiac(LS.get('gyMysticSign', 0) || 0); const s = SIGNS[z.si]; return `<div class="gw-my zod">${head}<b>${s[1]} ${s[0]}座</b><span class="st">${stars(z.all)}</span>${m ? `<p>${esc(z.text)}</p>` : ''}</div>`; }
                if (k === 'pendulum') return `<div class="gw-my pend">${head}<b class="pm-hf">${esc(x.a)}</b>${m && x.q ? `<span>「${esc(x.q.slice(0, 18))}」</span>` : ''}</div>`;
                if (k === 'astro') return `<div class="gw-my astro">${again}${head}<b>${esc(x.p[0])} · ${esc(x.s[0])}</b><span>第 ${x.h} 宫 · ${HOUSES[x.h - 1]}</span></div>`;
                return '';
            }
        };
        // ✉️ 信件：最近收到的一封
        const lettersOf = w => { const out = []; chars().forEach(c => { if (cidOf(w) && String(c.id) !== String(cidOf(w))) return; ((c.diaryData && c.diaryData.letters) || []).forEach(l => { if (l && l.author !== 'user' && l.author !== 'me') out.push({ c, l }); }); }); return out.sort((a, b) => (b.l.date || 0) - (a.l.date || 0)); };
        WD.letter = {
            n: '信件', sizes: ['s', 'm'], vars: [['', '信封'], ['paper', '信纸']],
            tap: () => window.gyPmOpen('diary'),
            r: w => {
                const L = lettersOf(w), x = L[0];
                if (!x) return `<div class="gw-lt empty"><div class="env"><i class="seal">✉</i></div><span>${T(w, 'e', '还没有收到信')}</span></div>`;
                const body = plainT(x.l.content, x.c.id).replace(/\s+/g, ' ');
                if (V(w) === 'paper') return `<div class="gw-lt paper ${w.size}"><em>${esc(x.l.title || '无题')}</em><p class="pm-hf">${esc(body.slice(0, w.size === 'm' ? 70 : 28))}…</p><span>—— ${esc(x.c.remark || x.c.name)} · ${dt(x.l.date)}</span></div>`;
                return `<div class="gw-lt ${w.size}"><div class="env"><i class="seal">${esc((x.c.remark || x.c.name || '？').slice(0, 1))}</i></div><div class="tx"><b>${esc(x.l.title || '一封信')}</b><span>来自 ${esc(x.c.remark || x.c.name)} · ${dt(x.l.date)}</span>${w.size === 'm' ? `<p>${esc(body.slice(0, 36))}…</p>` : ''}</div>${L.length > 1 ? `<u>${L.length}</u>` : ''}</div>`;
            },
            edit: whoEdit
        };
        // 📔 日记：TA 最近的一篇
        const diariesOf = w => { const out = []; chars().forEach(c => { if (cidOf(w) && String(c.id) !== String(cidOf(w))) return; ((c.diaryData && (c.diaryData.diaries || c.diaryData.entries)) || []).forEach(d => { if (d && d.author !== 'user') out.push({ c, d }); }); }); return out.sort((a, b) => (b.d.date || 0) - (a.d.date || 0)); };
        WD.tadiary = {
            n: 'TA 的日记', sizes: ['s', 'm', 'l'], vars: [['', '横线纸'], ['kraft', '牛皮纸'], ['grid', '方格']],
            tap: () => window.gyPmOpen('diary'),
            r: w => {
                const x = diariesOf(w)[0];
                if (!x) return `<div class="gw-dy ${V(w)} empty"><span>${T(w, 'e', 'TA 还没写日记')}</span></div>`;
                const body = plainT(x.d.content, x.c.id).replace(/\s+/g, ' ');
                const n = { s: 30, m: 60, l: 180 }[w.size] || 40;
                return `<div class="gw-dy ${V(w)} ${w.size}"><em>${dt(x.d.date)} · ${esc(x.c.remark || x.c.name)}</em><b>${esc(x.d.title || '')}</b><p class="pm-hf">${esc(body.slice(0, n))}${body.length > n ? '…' : ''}</p></div>`;
            },
            edit: whoEdit
        };
        // 🎭 匿名区 / 论坛：最新一条
        WD.anonw = {
            n: '匿名区', sizes: ['m'],
            tap: () => window.gyPmOpen('anon'),
            act: (w, a) => { if (a === 'rf') { w.d = Object.assign({}, w.d || {}, { i: ((w.d && w.d.i) || 0) + 1 }); X.save(); paintW(w); } },
            r: w => {
                const L = (typeof anonPosts !== 'undefined' ? anonPosts : []).filter(p => p && p.text);
                if (!L.length) return `<div class="wg-empty pm-hf">匿名区还没人说话</div>`;
                const p = L[((w.d && w.d.i) || 0) % Math.min(L.length, 30)];
                return `<div class="gw-an"><div class="hd"><b>🎭 ${esc(p.anonName || '匿名')}</b><span>${esc(X.ago(p.timestamp))}</span><em class="wx-rf" data-act="rf">↻</em></div><p>${esc(String(p.text).replace(/<[^>]+>/g, '').slice(0, 70))}</p><span class="ft">💬 ${(p.replies || []).length}</span></div>`;
            }
        };
        WD.forumw = {
            n: '论坛', sizes: ['m'],
            tap: () => window.gyPmOpen('forum'),
            r: w => {
                const L = (typeof forumThreads !== 'undefined' ? forumThreads : []).filter(t => t && t.title);
                if (!L.length) return `<div class="wg-empty pm-hf">论坛还没有帖子</div>`;
                const t = L[0];
                return `<div class="gw-fo"><em>${T(w, 'h', '论坛 · 最新')}</em><b>${esc(t.title)}</b><p>${esc(String(t.content || '').replace(/<[^>]+>/g, '').slice(0, 44))}</p><span>${esc(t.author || '')} · ${(t.replies || []).length} 回复</span></div>`;
            }
        };
        // 💬 每日一问
        const qOf = w => (w.d && w.d.qday === today() && w.d.q != null) ? QS[w.d.q % QS.length] : QS[Math.floor(seeded('q' + today() + w.id)() * QS.length)];
        WD.question = {
            n: '每日一问', sizes: ['s', 'm'],
            tap: w => { let n; const cur = QS.indexOf(qOf(w)); do { n = Math.floor(Math.random() * QS.length); } while (n === cur); w.d = Object.assign({}, w.d || {}, { q: n, qday: today() }); X.save(); paintW(w); },
            act: (w, a) => { if (a === 'ask') { const c = pickChar(w) || chars()[0]; if (!c) return; CUR.__q = { kind: 'q' }; if (!globalChats[c.id]) globalChats[c.id] = []; const t = qOf(w); globalChats[c.id].push({ sender: 'me', text: t, timestamp: Date.now(), readBy: [] }); try { saveAllData(); } catch (e) {} try { triggerAIBatchReply(String(c.id), t); } catch (e) {} try { window.gyPmOpenChat(c.id); } catch (e) {} } },
            r: w => `<div class="gw-q ${w.size}"><em>${T(w, 'h', '每日一问')}</em><p class="pm-hf">${esc(qOf(w))}</p>${w.size === 'm' ? `<div class="bt"><span>轻点换一题</span><b data-act="ask">问 ${esc(((pickChar(w) || chars()[0]) || {}).remark || ((pickChar(w) || chars()[0]) || {}).name || 'TA')} ›</b></div>` : ''}</div>`,
            edit: w => `<div class="lbl">问谁</div>${chipsFor(w, 'cid', chars().map(c => [c.id, esc(c.remark || c.name)]))}`
        };
        // 🎲 骰子
        const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
        const die = n => `<div class="die">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i) ? ' class="p"' : ''}></i>`).join('')}</div>`;
        WD.dice = {
            n: '骰子', sizes: ['s', 'm'],
            tap: w => {
                if (w.__roll) return; w.__roll = 1; let k = 0; const cnt = w.size === 'm' ? 2 : 1;
                const iv = setInterval(() => {
                    w.d = Object.assign({}, w.d || {}, { dv: Array.from({ length: cnt }, () => 1 + Math.floor(Math.random() * 6)), rolling: 1 }); paintW(w);
                    if (++k > 9) { clearInterval(iv); w.__roll = 0; w.d.rolling = 0; X.save(); paintW(w); }
                }, 80);
            },
            r: w => { const v = (w.d && w.d.dv) || (w.size === 'm' ? [6, 6] : [6]); return `<div class="gw-dc${w.d && w.d.rolling ? ' roll' : ''}">${v.map(die).join('')}<span>${w.d && w.d.dv ? (v.length > 1 ? '一共 ' + v.reduce((a, b) => a + b, 0) + ' 点' : v[0] + ' 点') : T(w, 'e', '点一下掷骰子')}</span></div>`; }
        };
        // ✅ TA 的待办
        WD.tatodo = {
            n: 'TA 的待办', sizes: ['s', 'm'],
            tap: w => { const c = pickChar(w) || chars()[0]; if (c) window.gyPmOpenChat(c.id); },
            r: w => {
                const c = pickChar(w) || chars()[0]; if (!c) return `<div class="wg-empty pm-hf">还没有角色</div>`;
                const L = (c.todos || []).filter(t => t);
                return `<div class="wg-todo gw-tt"><div class="h"><b>${esc(c.remark || c.name)} 的待办</b><span>${L.filter(t => t.done).length}/${L.length}</span></div>${L.length ? L.slice(0, w.size === 's' ? 4 : 5).map(t => `<div class="it${t.done ? ' done' : ''}"><i></i><span>${esc(t.text || t.title || '')}</span></div>`).join('') : '<div class="gw-tip">TA 还没记什么</div>'}</div>`;
            },
            edit: w => `<div class="lbl">看谁的</div>${chipsFor(w, 'cid', chars().map(c => [c.id, esc(c.remark || c.name)]))}`
        };
        return true;
    }

    const CSS = `
#gyMysOv{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center}
#gyMysOv .box{background:#f2f2f7;color:#111;width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px;box-sizing:border-box}
#gyMysOv .chip{display:inline-block;padding:6px 11px;border-radius:999px;background:#fff;margin:3px;font-size:13px;cursor:pointer}#gyMysOv .chip.on{background:#111;color:#fff}
#gyMysOv .it{display:block;width:100%;padding:12px;border:none;border-radius:14px;background:#fff;margin-top:10px;cursor:pointer}#gyMysOv .lbl{font-size:12px;color:#888;margin:12px 4px 6px}
#gyMysOv .in{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:12px;border:1px solid #ddd}
.gm-tabs{margin-bottom:6px}.gm-body{min-height:120px}
.gm-tip{font-size:12.5px;color:var(--pm-sub,#888);line-height:1.6;margin:8px 4px}
.gm-read,.gm-rd{font-size:13.5px;line-height:1.7;margin:10px 4px;color:var(--pm-text,#222)}.gm-rd .by{text-align:right;color:var(--pm-sub,#999);font-size:12px}
.gm-grid{display:grid;gap:8px;margin:12px 0}.gm-grid.n1{grid-template-columns:minmax(0,160px);justify-content:center}.gm-grid.n3{grid-template-columns:repeat(3,1fr)}.gm-grid.n9{grid-template-columns:repeat(3,1fr)}.gm-grid.n5{grid-template-columns:repeat(3,1fr)}
.gm-card,.gm-stone{border-radius:12px;padding:10px 6px;text-align:center;background:linear-gradient(160deg,#fffdf7,#f4ecdc);border:1px solid #e8dcc2;animation:gmIn .5s cubic-bezier(.34,1.56,.64,1) both;color:#3b2f1c}
.gm-card.core{box-shadow:0 0 0 2px #c9a55c}.gm-card b{display:block;font-size:26px}.gm-card span{display:block;font-weight:600;font-size:14px;margin:3px 0}.gm-card em{font-style:normal;font-size:11.5px;color:#7a6a50;line-height:1.4;display:block}
.gm-stone{background:radial-gradient(circle at 35% 30%,#8a8f96,#4a4e55);border-color:#3a3d42;color:#f3efe6;border-radius:40% 45% 42% 48%}.gm-stone b{display:block;font-size:30px;transition:transform .3s}.gm-stone.rv b{transform:rotate(180deg)}
.gm-stone em{font-style:normal;font-size:11px;opacity:.7;display:block}.gm-stone span{font-size:12px;display:block}.gm-stone i{font-style:normal;font-size:11.5px;display:block;margin-top:4px;opacity:.9}
@keyframes gmIn{from{opacity:0;transform:translateY(10px) rotateY(80deg)}to{opacity:1;transform:none}}
.gm-ich{display:flex;gap:14px;align-items:flex-start;margin:12px 0}.gm-lines{display:flex;flex-direction:column;gap:6px;min-width:120px}
.gm-yao{display:flex;align-items:center;gap:8px}.gm-yao i{width:70px;height:9px;border-radius:3px;background:#333;position:relative}.gm-yao.yin i{background:linear-gradient(90deg,#333 42%,transparent 42%,transparent 58%,#333 58%)}
.gm-yao.mv i{box-shadow:0 0 0 2px #e0a33a}.gm-yao em{font-style:normal;font-size:11px;color:var(--pm-sub,#888);white-space:nowrap}
.gm-hex{display:flex;gap:10px;align-items:center;background:var(--pm-card,#fff);border-radius:12px;padding:10px}.gm-hex b{font-size:26px;line-height:1}.gm-hex span{font-size:11px;color:var(--pm-sub,#888);display:block}.gm-hex strong{font-size:18px;display:block}.gm-hex em{font-style:normal;font-size:12px;color:var(--pm-sub,#666)}
.gm-arrow{text-align:center;font-size:12px;color:#e0a33a;margin:4px 0}
.gm-signs .chip{padding:4px 9px;font-size:12px}.gm-zod{display:flex;align-items:center;gap:12px;margin:10px 4px}.gm-zod b{font-size:34px}.gm-zod strong{display:block;font-size:16px}.gm-zod em{font-style:normal;font-size:12px;color:var(--pm-sub,#888)}.gm-zod .chip{margin-left:auto}
.gm-bars p{margin:4px 6px;display:flex;gap:10px;font-size:13px}.gm-bars i{font-style:normal;color:var(--pm-sub,#888);width:32px}.gm-bars u{text-decoration:none;color:#f2b400;letter-spacing:2px}
.gm-pend{height:150px;display:flex;justify-content:center;perspective:400px}.gm-rope{transform-origin:top center;display:flex;flex-direction:column;align-items:center}.gm-rope i{width:2px;height:110px;background:#999}.gm-rope b{width:22px;height:30px;background:linear-gradient(160deg,#e8d4ff,#9b7fd1);clip-path:polygon(50% 100%,0 30%,50% 0,100% 30%)}
.gm-rope.swing{animation:gmSwing .4s ease-in-out infinite alternate}@keyframes gmSwing{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
.gm-ans{text-align:center;font-size:28px;font-weight:700;letter-spacing:4px;min-height:40px}
.gm-lot{background:linear-gradient(180deg,#fff7e8,#f7e3c3);border:1px solid #e6c894;border-radius:14px;padding:14px;margin:12px 0;text-align:center;color:#5a3d12;animation:gmIn .6s both}
.gm-lot em{font-style:normal;font-size:12px}.gm-lot>b{display:block;font-size:22px;color:#b23a2b;letter-spacing:4px;margin:4px 0 10px}.gm-lot .poem{display:flex;flex-direction:row-reverse;justify-content:center;gap:10px}.gm-lot .poem span{writing-mode:vertical-rl;font-size:15px;letter-spacing:3px;font-family:"Noto Serif SC",serif}
.gm-lot p{font-size:13px;margin:12px 0 6px}.gm-lot .tp{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}.gm-lot .tp span{font-size:12px;background:rgba(255,255,255,.6);padding:2px 8px;border-radius:8px}
.gm-tube{display:flex;justify-content:center;gap:4px;margin:14px;animation:gmShake .9s ease-in-out infinite}.gm-tube i{width:6px;height:60px;background:#c98a4b;border-radius:2px}@keyframes gmShake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
.gm-life{display:flex;gap:14px;align-items:center;margin:12px 4px}.gm-life b{font-size:44px;font-family:var(--pm-num,inherit)}.gm-life span{font-size:14px;line-height:1.6}
.gm-dice{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.gm-dice div{background:var(--pm-card,#fff);border-radius:12px;padding:12px 6px;text-align:center;animation:gmIn .5s both}.gm-dice b{display:block;font-size:15px}.gm-dice span{font-size:11.5px;color:var(--pm-sub,#888)}
.gw-h{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}
.gw-my{height:100%;display:flex;flex-direction:column;justify-content:center;gap:5px;position:relative}.gw-my>b{font-size:20px}.gw-my>span{font-size:12px;color:var(--pm-sub)}.gw-my p{font-size:12.5px;margin:0;line-height:1.5}
.gw-my.empty{align-items:center;text-align:center}.gw-my.empty>b{font-size:30px}.gw-my .row{display:flex;gap:6px}.gw-my .row .c{flex:1;text-align:center;border-radius:10px;background:var(--pm-fill);padding:6px 2px}.gw-my .row .c b{display:block;font-size:22px}.gw-my .row .c span{font-size:11px}.gw-my .row .c.rv b{transform:rotate(180deg)}
.gw-my .st{color:#f2b400;letter-spacing:2px}.gw-my.lot>b{color:#b23a2b;letter-spacing:3px}
.gw-lt{height:100%;display:flex;align-items:center;gap:12px;position:relative}.gw-lt .env{width:64px;height:46px;flex-shrink:0;border-radius:6px;background:linear-gradient(160deg,#fbf3e4,#efdfc2);position:relative;box-shadow:0 2px 6px rgba(0,0,0,.1);overflow:hidden}
.gw-lt .env:before{content:"";position:absolute;left:0;right:0;top:0;height:60%;background:linear-gradient(160deg,#f5e7cc,#e9d3a9);clip-path:polygon(0 0,100% 0,50% 100%)}
.gw-lt .seal{position:absolute;left:50%;top:50%;transform:translate(-50%,-30%);width:20px;height:20px;border-radius:50%;background:#b8322a;color:#fff;font-style:normal;font-size:11px;display:flex;align-items:center;justify-content:center}
.gw-lt.s{flex-direction:column;justify-content:center;text-align:center;gap:8px}.gw-lt .tx b{display:block;font-size:14px}.gw-lt .tx span{font-size:11.5px;color:var(--pm-sub)}.gw-lt .tx p{font-size:12px;margin:4px 0 0;color:var(--pm-sub)}
.gw-lt u{position:absolute;right:0;top:0;text-decoration:none;font-size:11px;background:var(--pm-red);color:#fff;border-radius:9px;padding:0 6px}
.gw-lt.empty{flex-direction:column;justify-content:center;font-size:12px;color:var(--pm-sub)}
.gw-lt.paper{flex-direction:column;align-items:stretch;justify-content:center;background:repeating-linear-gradient(transparent 0 19px,rgba(120,100,70,.18) 19px 20px);border-radius:8px;padding:4px 6px}.gw-lt.paper em{font-style:normal;font-size:12px;font-weight:600}.gw-lt.paper p{font-size:12.5px;line-height:20px;margin:2px 0}.gw-lt.paper span{font-size:11px;color:var(--pm-sub);text-align:right}
.gw-dy{height:100%;display:flex;flex-direction:column;gap:3px;padding:2px 4px;border-radius:8px;background:repeating-linear-gradient(transparent 0 19px,rgba(90,120,170,.18) 19px 20px);overflow:hidden}
.gw-dy.kraft{background:#e9d9bb;color:#4a3a22}.gw-dy.grid{background-image:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px);background-size:14px 14px}
.gw-dy em{font-style:normal;font-size:11px;color:var(--pm-sub)}.gw-dy b{font-size:13.5px}.gw-dy p{font-size:12.5px;line-height:20px;margin:0}.gw-dy.empty{align-items:center;justify-content:center;font-size:12px;color:var(--pm-sub)}
.gw-an,.gw-fo{height:100%;display:flex;flex-direction:column;gap:5px;position:relative}.gw-an .hd{display:flex;gap:8px;align-items:center;font-size:12px}.gw-an .hd span{color:var(--pm-sub)}.gw-an p,.gw-fo p{font-size:13px;margin:0;line-height:1.5}.gw-an .ft,.gw-fo span{font-size:11.5px;color:var(--pm-sub)}
.gw-fo em{font-style:normal;font-size:11px;color:var(--pm-sub);letter-spacing:1px}.gw-fo b{font-size:14.5px}
.gw-q{height:100%;display:flex;flex-direction:column;justify-content:center;gap:6px}.gw-q em{font-style:normal;font-size:11px;letter-spacing:1.5px;color:var(--pm-sub);font-weight:600}.gw-q p{margin:0;font-size:15px;line-height:1.5}.gw-q.s p{font-size:13.5px}
.gw-q .bt{display:flex;justify-content:space-between;font-size:11.5px;color:var(--pm-sub)}.gw-q .bt b{color:var(--pm-accent,#1d9bf0);cursor:pointer}
.gw-dc{height:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px}.gw-dc span{width:100%;text-align:center;font-size:12px;color:var(--pm-sub)}
.gw-dc .die{width:46px;height:46px;border-radius:11px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15),inset 0 -3px 0 rgba(0,0,0,.06);display:grid;grid-template-columns:repeat(3,1fr);padding:6px;box-sizing:border-box;gap:2px}
.gw-dc .die i{border-radius:50%}.gw-dc .die i.p{background:#222}.gw-dc.roll .die{animation:gmRoll .16s linear infinite}@keyframes gmRoll{50%{transform:rotate(18deg) scale(.94)}}
.gw-tt .it i{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--pm-sub);display:inline-block;margin-right:6px;vertical-align:-1px}.gw-tt .it.done span{text-decoration:line-through;color:var(--pm-sub)}.gw-tt .it.done i{background:var(--pm-accent,#1d9bf0);border-color:transparent}
.gw-tip{font-size:12px;color:var(--pm-sub)}
`;
    function start() {
        if (!document.getElementById('gyMysticCss')) { const st = document.createElement('style'); st.id = 'gyMysticCss'; st.textContent = CSS; document.head.appendChild(st); }
        let n = 0; const t = () => { if (boot()) { return; } if (++n < 60) setTimeout(t, 500); };
        t();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
