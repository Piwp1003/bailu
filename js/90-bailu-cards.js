/* ============================================================
   js/90 —— 🃏 白露的字卡引擎：不接 API，TA 说的话都从你的字卡里来
   ------------------------------------------------------------
   谷雨里所有「问模型」的地方，最后都走两个出口：sendChatRequestRaw（一次拿全）和
   streamCompletionText（边写边出）。白露把这两个出口换成本地的字卡引擎，所以：
     · 所有功能都还在：聊天、推文、评论、信、日记、论坛、匿名区、朋友圈、打电话、小剧场、自主模式……
     · 该说话的地方：按「谁在说 × 这是什么场合」从字卡库里挑，随机拼起来
     · 该做选择的地方（接不接、去不去、做什么事、过多久再来）：按设置里的概率随机
     · 功能要求的格式（JSON 之类）照着它要求的样子填，功能那边察觉不到差别
   字卡：设置 →「🃏 字卡库」。可以上传 txt / json / csv，也可以直接粘贴；
         还能从聊天记录、推文、信件里把 TA 说过的话收集成字卡。

   字卡的写法（txt）：一行一张。「#」开头的行给下面的字卡贴标签，直到下一个「#」行：
       #类型:聊天 角色:霍樊
       你等下冻的话记得叫我
       以后有事先找我，听到没
       #类型:信
       见字如面，{user}。
   类型：聊天 推文 评论 信 日记 论坛 匿名 朋友圈 电话 状态 标题 旁白 通用（不写就是通用）
   角色：写角色名；不写就是谁都能用
   字卡里可以写：{user} 你的名字、{char} 说话的这个角色、{time} 现在几点、{date} 今天日期
   ============================================================ */
(function () {
    'use strict';
    if (window.__bailuCardsLoaded) return;
    window.__bailuCardsLoaded = true;

    const KINDS = ['聊天', '推文', '评论', '信', '日记', '论坛', '匿名', '朋友圈', '电话', '状态', '标题', '旁白', '拍一拍', '表情', '格言', '开场', '通用'];
    // 只在自己那一格里用、不会被借去当别的话说的几类（氛围字卡）
    const SOLO = ['拍一拍', '表情', '格言', '开场'];
    const DEF_CFG = {
        replyMin: 1, replyMax: 3,      // （旧）一次回几条：下面 w1~w5 有值就按权重来
        w1: 75, w2: 24, w3: 1, w4: 0, w5: 0,   // 回 1/2/3/4/5 条的权重：大多数时候就一句，偶尔连发
        readMin: 1.5, readMax: 4,       // 你发完多久「已读」（秒）
        emojiP: 20,                     // 话里夹一个表情字卡的概率（%）
        stickerP: 20,                   // 顺手发张表情包的概率（%，用的是「表情 / 图片」里的表情包）
        quoteP: 30,                     // 引用你说过的某句再回的概率（%）
        pokeP: 3,                       // 拍一拍你的概率（%）
        introOn: 1, mottoOn: 1,         // 开场动画 / 聊天顶上的格言（1 开 0 关）
        callP: 25, callMin: 15, callMax: 60,   // 随机来电：每隔 callMin~callMax 分钟掷一次，callP% 打过来（0＝不打）
        moodSkip: 20,                   // TA 某天不记心情的概率（%）
        keyP: 90,                       // 你说的话里有某张字卡的关键词：用那张来回的概率（%）
        condP: 70,                      // 有符合此刻条件（晚上 / 周末 / 心情…）的字卡：优先用它们的概率（%）
        voiceP: 60,                     // 打电话时 TA 说话：用你上传的语音片段（而不是机器朗读）的概率（%）
        accept: 70,                     // 答应 / 接电话 / 同意的概率（%）
        activity: 45,                   // 自主模式里「这次做点什么」的概率（%）
        silence: 5,                     // 「不想说话」的概率（%）
        obey: 85,                       // 你在聊天里让 TA 去做某件事，TA 照做的概率（%）
        delayMin: 3, delayMax: 7,       // 已读之后「想一下」再回的秒数
        nextMin: 30, nextMax: 360       // 自主模式：过多久再想想（分钟）
    };
    const S = { cards: [], groups: [], cfg: Object.assign({}, DEF_CFG), charCfg: {}, loaded: false, recent: [] };
    // 每个角色单独一套概率：没单独设的项跟着全局走
    const cfgFor = ch => { const o = ch && S.charCfg[String(ch.name || '')]; return o ? Object.assign({}, S.cfg, o) : S.cfg; };
    const GCOLORS = ['#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784', '#aed581', '#dce775', '#ffd54f', '#ffb74d', '#ff8a65', '#a1887f', '#90a4ae', '#bdbdbd'];
    const store = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'bailuCards', storeName: 'cards' }) : null;
    const uid = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const rint = (a, b) => Math.floor(rnd(a, b + 1));
    const chance = pct => Math.random() * 100 < pct;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };

    /* ---------------- 示例字卡：字卡库空着的时候先用这些，保证一装上就能玩 ---------------- */
    const SAMPLE = {
        '聊天': ['在呢。', '刚忙完，你呢？', '嗯，听你的。', '今天有点累，但看到你消息就好多了。', '你吃饭了没？', '别熬夜了。', '想你了，就是想说一声。', '好啊。', '哈哈哈你怎么这样。', '等我一下，马上回来。', '你说的我都记着呢。', '今天天气还不错，想出去走走。', '又在发呆了？', '好，那就这么定了。', '晚安，{user}。'],
        '推文': ['今天的风有点温柔。', '忙了一天，终于能坐下来喝口水。', '又是被生活推着走的一天。', '记录一下：今天挺好的。', '想吃点甜的。', '路过一家花店，站了好久。'],
        '评论': ['哈哈哈哈', '同感。', '好看！', '抱抱。', '这也太真实了', '收藏了'],
        '信': ['见字如面，{user}。', '最近过得怎么样？我这边一切都好，就是偶尔会想起你。', '有些话发消息说不出口，写下来好像就容易一点。', '今天路过我们上次去的地方，那家店还开着。', '你要照顾好自己，按时吃饭，别总是熬夜。', '等天暖和一点，我们再一起出去走走吧。', '纸短情长，就写到这里。', '—— {char}'],
        '日记': ['今天是很普通的一天。', '早上醒得很早，窗外有鸟叫。', '和{user}聊了一会儿，心情好了很多。', '有件事一直在心里，不知道该不该说。', '晚饭随便吃了点。', '睡前想了很多，最后还是决定明天再说。'],
        '论坛': ['有没有人跟我一样，一到晚上就想很多？', '分享一个最近的小发现。', '求推荐：适合一个人安静待着的地方。', '说说你们最近在看什么书？'],
        '匿名': ['有些话只敢在这里说。', '其实我挺在意的，只是没说出口。', '今天差点就没忍住。', '如果能重来一次就好了。'],
        '朋友圈': ['今天的晚霞。', '周末快乐。', '好久没这么开心了。', '记录一下。'],
        '电话': ['喂？', '嗯，我在听。', '你那边好吵啊。', '想听听你声音。', '好，那先这样。', '挂了啊，早点睡。'],
        '状态': ['在家', '在路上', '在看书', '在发呆', '刚睡醒', '在忙'],
        '标题': ['无题', '今天', '给你', '碎碎念', '一封信', '随笔'],
        '旁白': ['窗外下起了小雨。', '夜很安静。', '风从街角吹过来。'],
        '拍一拍': ['的脑袋', '的小脸', '的手心', '的肩膀，说该睡了'],
        '表情': ['(｡･ω･｡)', '🥺', '😤', '🫶', '~', '（笑）'],
        '格言': ['慢慢来，比较快。', '今天也被好好喜欢着。', '露从今夜白。', '见字如面。'],
        '开场': ['白露|露从今夜白', '见字如面|每一句都是你写给 TA 的', '晚安|今天也辛苦了']
    };
    function sampleCards() {
        const out = [];
        Object.keys(SAMPLE).forEach(k => SAMPLE[k].forEach(t => out.push({ id: 's_' + k + '_' + out.length, t, kinds: [k], chars: [], sample: true })));
        return out;
    }

    /* ---------------- 存取 ---------------- */
    async function load() {
        try {
            if (store) {
                const d = await store.getItem('lib');
                if (d && Array.isArray(d.cards)) S.cards = d.cards;
                if (d && d.cfg) S.cfg = Object.assign({}, DEF_CFG, d.cfg);
                if (d && Array.isArray(d.groups)) S.groups = d.groups;
                if (d && d.charCfg && typeof d.charCfg === 'object') S.charCfg = d.charCfg;
                // 老存档里「回复前等」是 0.4~1.6 秒：换成新的默认节奏
                if (d && d.cfg && d.cfg.delayMin === 0.4 && d.cfg.delayMax === 1.6) { S.cfg.delayMin = DEF_CFG.delayMin; S.cfg.delayMax = DEF_CFG.delayMax; }
            }
        } catch (e) { console.warn('[白露] 字卡库读不出来：', e); }
        if (!S.cards.length) S.cards = sampleCards();
        S.loaded = true;
    }
    async function save() { try { if (store) await store.setItem('lib', { cards: S.cards, groups: S.groups, cfg: S.cfg, charCfg: S.charCfg }); } catch (e) { toast('字卡没存上', String(e && e.message || e)); } }
    const ready = load();
    window.bailuCards = { get cards() { return S.cards; }, get groups() { return S.groups; }, get cfg() { return S.cfg; }, get charCfg() { return S.charCfg; }, cfgFor, save, ready, KINDS, store };
    window.bailuCfgFor = cfgFor;

    /* ---------------- 解析上传 / 粘贴的字卡 ---------------- */
    const KIND_ALIAS = { chat: '聊天', 私聊: '聊天', 消息: '聊天', tweet: '推文', post: '推文', 发推: '推文', comment: '评论', 回复: '评论', letter: '信', 信件: '信', diary: '日记', forum: '论坛', anon: '匿名', 匿名区: '匿名', 匿名论坛: '匿名', moment: '朋友圈', call: '电话', 通话: '电话', status: '状态', title: '标题', narration: '旁白', 动作: '旁白', 通用: '通用', any: '通用', poke: '拍一拍', 戳一戳: '拍一拍', emoji: '表情', 颜文字: '表情', motto: '格言', 签名: '格言', intro: '开场', 开场动画: '开场' };
    const normKind = k => { k = String(k || '').trim(); if (!k) return ''; if (KINDS.includes(k)) return k; return KIND_ALIAS[k] || KIND_ALIAS[k.toLowerCase()] || ''; };
    const charNames = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).map(c => [c.name, c.remark].filter(Boolean)).flat();
    const splitList = v => String(v || '').split(/[\s,，、;；]+/).map(x => x.trim()).filter(Boolean);
    // 一行开头可以带 {if 晚上 周末} / {关键词 累 困}（顺序随意，可以都带）
    function takeInline(l) {
        const cond = [], keys = [];
        let m;
        while ((m = l.match(/^\s*[{｛]\s*(if|如果|条件|关键词|关键字|key|keys|kw)\s*[:：]?\s*([^}｝]*)[}｝]\s*/i))) {
            (/if|如果|条件/i.test(m[1]) ? cond : keys).push(...splitList(m[2]));
            l = l.slice(m[0].length);
        }
        return { l, cond, keys };
    }
    function parseText(txt, base) {
        const out = [];
        let kinds = base && base.kind ? [base.kind] : [], chars = base && base.char ? [base.char] : [], hc = [], hk = [];
        String(txt || '').replace(/\r/g, '').split('\n').forEach(line => {
            const l0 = line.trim();
            if (!l0 || l0.startsWith('//')) return;
            if (/^[#＃]/.test(l0)) {
                // 标签行：#类型:聊天 角色:霍樊 条件:晚上 关键词:累,困 / #聊天 / #霍樊
                kinds = []; chars = []; hc = []; hk = [];
                l0.replace(/^[#＃]+/, '').split(/[\s#＃]+/).filter(Boolean).flatMap(p => /[:：=]/.test(p) ? [p] : p.split(/[|｜,，]+/)).filter(Boolean).forEach(part => {
                    const m = part.match(/^(类型|kind|场合|角色|char|人物|条件|if|关键词|关键字|key|keys)[:：=](.+)$/i);
                    if (m) {
                        const many = String(m[2]).split(/[|｜,，、;；\s]+/).filter(Boolean);
                        if (/类型|kind|场合/i.test(m[1])) many.forEach(x => { const k = normKind(x); if (k && k !== '通用') kinds.push(k); });
                        else if (/条件|if/i.test(m[1])) hc.push(...splitList(m[2]));
                        else if (/关键|key/i.test(m[1])) hk.push(...splitList(m[2]));
                        else chars.push(...many);
                        return;
                    }
                    const k = normKind(part); if (k) { if (k !== '通用') kinds.push(k); return; }
                    chars.push(part);
                });
                return;
            }
            const { l, cond, keys } = takeInline(l0);
            if (!l.trim()) return;
            const c = { id: uid(), t: l.trim().replace(/\\n/g, '\n'), kinds: kinds.slice(), chars: chars.slice() };
            const cc = hc.concat(cond), kk = hk.concat(keys);
            if (cc.length) c.cond = cc; if (kk.length) c.keys = kk;
            out.push(c);
        });
        return out;
    }
    // 手写的 JSON 常见毛病：结尾多逗号、两项之间漏逗号、中文引号——先修一下再读
    function looseJson(txt) {
        try { return JSON.parse(txt); } catch (e) {}
        let t = String(txt).replace(/^\uFEFF/, '').replace(/[“”]/g, '"')
            .replace(/,\s*([\]}])/g, '$1')
            .replace(/"\s*\n\s*"/g, '",\n"').replace(/}\s*\n?\s*{/g, '},{').replace(/]\s*\n?\s*\[/g, '],[')
            .replace(/"\s*\n\s*{/g, '",{').replace(/}\s*\n\s*"/g, '},"');
        try { return JSON.parse(t); } catch (e) { return undefined; }
    }
    // 别的字卡软件导出来的整包（customReplies / customPokes / customStatuses / customMottos / customIntros / customEmojis + 分组）
    const PACK = { customReplies: '聊天', customPokes: '拍一拍', customStatuses: '状态', customMottos: '格言', customIntros: '开场', customEmojis: '表情' };
    function parsePack(d) {
        if (!d || Array.isArray(d) || !Object.keys(PACK).some(k => Array.isArray(d[k]))) return null;
        const out = []; const groups = [];
        const gOf = {};
        ['customReplyGroups', 'customPokeGroups', 'customStatusGroups'].forEach(gk => (Array.isArray(d[gk]) ? d[gk] : []).forEach(g => {
            if (!g || !g.name) return;
            const gg = { id: 'g' + uid(), name: String(g.name), color: g.color || GCOLORS[groups.length % GCOLORS.length], off: !!g.disabled };
            groups.push(gg); (g.items || []).forEach(t => { gOf[gk.replace('Groups', '') + '|' + String(t).trim()] = gg.id; });
        }));
        const gkey = { customReplies: 'customReply', customPokes: 'customPoke', customStatuses: 'customStatus' };
        Object.keys(PACK).forEach(k => (Array.isArray(d[k]) ? d[k] : []).forEach(t => {
            t = String(t == null ? '' : t).trim(); if (!t) return;
            const c = { id: uid(), t, kinds: [PACK[k]], chars: [] };
            const g = gkey[k] && gOf[gkey[k] + '|' + t]; if (g) c.g = g;
            out.push(c);
        }));
        out.__groups = groups;
        return out;
    }
    function parseJson(txt) {
        let d = looseJson(txt); if (d === undefined) return null;
        const pk = parsePack(d); if (pk) return pk;
        if (d && !Array.isArray(d) && Array.isArray(d.cards)) d = d.cards;
        if (!Array.isArray(d)) return null;
        return d.map(x => {
            if (typeof x === 'string') return { id: uid(), t: x, kinds: [], chars: [] };
            const t = x.t || x.text || x.content || x['内容'] || x['字卡'];
            if (!t) return null;
            const ks = [].concat(x.kinds || x.kind || x['类型'] || []).map(normKind).filter(k => k && k !== '通用');
            const cs = [].concat(x.chars || x.char || x['角色'] || []).map(s => String(s).trim()).filter(Boolean);
            const o = { id: uid(), t: String(t), kinds: ks, chars: cs };
            const cd = [].concat(x.cond || x['条件'] || []).flatMap(splitList); if (cd.length) o.cond = cd;
            const kw = [].concat(x.keys || x.keywords || x['关键词'] || []).flatMap(splitList); if (kw.length) o.keys = kw;
            const gn = x.group || x['分组']; if (gn) o.gname = String(gn);
            if (x.off || x['停用']) o.off = true;
            return o;
        }).filter(Boolean);
    }
    function parseCsv(txt) {
        const rows = String(txt).replace(/\r/g, '').split('\n').filter(Boolean).map(r => {
            const cells = []; let cur = '', q = false;
            for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '"') { if (q && r[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
            cells.push(cur); return cells;
        });
        if (rows.length && /内容|text|字卡/i.test(rows[0][0] || '')) rows.shift();
        return rows.filter(r => (r[0] || '').trim()).map(r => ({ id: uid(), t: r[0].trim(), kinds: [normKind(r[1])].filter(k => k && k !== '通用'), chars: (r[2] || '').split(/[|｜/、]/).map(s => s.trim()).filter(Boolean), cond: splitList(r[3]), keys: splitList(r[4]) })).map(c => { if (!c.cond.length) delete c.cond; if (!c.keys.length) delete c.keys; return c; });
    }
    function parseAny(txt, name, base) {
        if (/\.json$/i.test(name || '') || /^\s*[\[{]/.test(txt)) { const j = parseJson(txt); if (j) return j; }
        if (/\.csv$/i.test(name || '')) return parseCsv(txt);
        return parseText(txt, base);
    }
    const norm = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
    function groupByName(name) {
        name = String(name || '').trim(); if (!name) return null;
        let g = S.groups.find(x => x.name === name);
        if (!g) { g = { id: 'g' + uid(), name, color: GCOLORS[S.groups.length % GCOLORS.length], off: false }; S.groups.push(g); }
        return g;
    }
    // mode：'add' 追加（去重） / 'replace' 覆盖（整个库换成这一批）；gid：一起放进哪个分组
    function addCards(list, mode, gid) {
        if (!list) return 0;
        (list.__groups || []).forEach(g => { if (!S.groups.some(x => x.name === g.name)) S.groups.push(g); else { const old = S.groups.find(x => x.name === g.name); list.forEach(c => { if (c.g === g.id) c.g = old.id; }); } });
        list.forEach(c => { if (c.gname) { const g = groupByName(c.gname); if (g) c.g = g.id; delete c.gname; } if (gid && !c.g) c.g = gid; });
        if (mode === 'replace') { S.cards = []; }
        // 头一次导入自己的字卡：示例字卡自动收起来（不删，设置里能再放出来）
        if (list.length && S.cards.every(c => c.sample)) S.cards = [];
        const sig = c => norm(c.t) + '|' + c.kinds.join() + '|' + c.chars.join() + '|' + (c.cond || []).join() + '|' + (c.keys || []).join();
        const have = new Set(S.cards.map(sig));
        let n = 0;
        list.forEach(c => { const k = sig(c); if (have.has(k)) return; have.add(k); S.cards.push(c); n++; });
        return n;
    }
    function dedup() {
        const seen = new Set(), n0 = S.cards.length;
        S.cards = S.cards.filter(c => { const k = norm(c.t) + '|' + c.kinds.slice().sort().join() + '|' + c.chars.slice().sort().join(); if (seen.has(k)) return false; seen.add(k); return true; });
        return n0 - S.cards.length;
    }

    /* ---------------- 挑字卡 ---------------- */
    const nameOf = c => c ? String(c.name || '') : '';
    const matchChar = (card, ch) => !card.chars.length || (ch && card.chars.some(n => n === nameOf(ch) || n === String(ch.remark || '') || n === String(ch.id)));
    /* ---------------- 条件和关键词 ---------------- */
    let CUR_SAID = '';          // 这一轮你刚说的话（找关键词用）
    const WD = '日一二三四五六';
    const SLOTS = { '凌晨': [0, 5], '早上': [5, 9], '早晨': [5, 9], '上午': [9, 12], '中午': [11, 14], '下午': [13, 18], '傍晚': [17, 19], '晚上': [18, 23], '夜里': [20, 29], '深夜': [22, 26], '半夜': [0, 4], '白天': [7, 18] };
    function condOne(tok, ch, now) {
        tok = String(tok).trim(); if (!tok) return true;
        if (/[|｜/]/.test(tok)) return tok.split(/[|｜/]/).some(x => condOne(x, ch, now));
        if (/^(不是|非|!|！)/.test(tok)) return !condOne(tok.replace(/^(不是|非|!|！)/, ''), ch, now);
        const h = now.getHours(), d = now.getDay(), mo = now.getMonth() + 1;
        if (SLOTS[tok]) { const [a, b] = SLOTS[tok]; return (h >= a && h < b) || (h + 24 >= a && h + 24 < b); }
        let m;
        if ((m = tok.match(/^(\d{1,2})[点:：](?:-|到|~|～)(\d{1,2})[点]?$/))) { const a = +m[1], b = +m[2]; return a <= b ? (h >= a && h < b) : (h >= a || h < b); }
        if (tok === '周末') return d === 0 || d === 6;
        if (tok === '工作日') return d > 0 && d < 6;
        if ((m = tok.match(/^(周|星期|礼拜)([日天一二三四五六])$/))) return WD.indexOf(m[2] === '天' ? '日' : m[2]) === d;
        if (tok === '春天' || tok === '春') return mo >= 3 && mo <= 5;
        if (tok === '夏天' || tok === '夏') return mo >= 6 && mo <= 8;
        if (tok === '秋天' || tok === '秋') return mo >= 9 && mo <= 11;
        if (tok === '冬天' || tok === '冬') return mo === 12 || mo <= 2;
        if ((m = tok.match(/^(\d{1,2})月$/))) return +m[1] === mo;
        if ((m = tok.match(/^(\d{1,2})月(\d{1,2})[日号]?$/))) return +m[1] === mo && +m[2] === now.getDate();
        // 心情：心情:开心 / TA心情:开心 → TA 今天手账里记的；我心情:累 / 你心情:累 → 你自己记的
        if ((m = tok.match(/^(TA|ta|他|她)?心情[:：=](.+)$/)) || (m = tok.match(/^(我|你)心情[:：=](.+)$/))) {
            const md = typeof window.bailuMoodOf === 'function' ? window.bailuMoodOf(ch) : null;
            const mine = m[1] === '我' || m[1] === '你';
            const v = md ? (mine ? md.me : md.ta) : null;
            return !!v && String(m[2]).split(/[|｜/]/).includes(v);
        }
        // 经期（js/74 经期记录）：经期 / 经期快到 / 排卵期（易孕期）/ 推迟
        if (/^(经期|例假|生理期|经期中|大姨妈)$/.test(tok)) { const x = pst(); return !!(x && x.inPeriod); }
        if (/^(经期快到|快来例假|经期前)$/.test(tok)) { const x = pst(); return !!(x && x.has && !x.inPeriod && x.late === 0 && x.toNext <= 3); }
        if (/^(排卵期|易孕期|排卵日)$/.test(tok)) { const x = pst(); return !!(x && (x.fertile || x.ovDay)); }
        if (/^(推迟|经期推迟)$/.test(tok)) { const x = pst(); return !!(x && x.late > 0); }
        return false;   // 认不出的条件：不满足（字卡库里会标出来）
    }
    const pst = () => { try { return typeof window.gyPeriodNow === 'function' ? window.gyPeriodNow() : null; } catch (e) { return null; } };
    const condOk = (c, ch) => !c.cond || !c.cond.length || c.cond.every(t => condOne(t, ch, new Date()));
    const keyHit = c => !!(c.keys && c.keys.length && CUR_SAID && c.keys.some(k => k && CUR_SAID.toLowerCase().includes(String(k).toLowerCase())));
    window.bailuCondKnown = tok => { try { const t = String(tok).replace(/^(不是|非|!|！)/, ''); return t.split(/[|｜/]/).every(x => SLOTS[x] || /^(\d{1,2})[点:：](?:-|到|~|～)(\d{1,2})点?$|^周末$|^工作日$|^(周|星期|礼拜)[日天一二三四五六]$|^[春夏秋冬]天?$|^\d{1,2}月(\d{1,2}[日号]?)?$|心情[:：=]|^(经期|例假|生理期|经期中|大姨妈|经期快到|快来例假|经期前|排卵期|易孕期|排卵日|推迟|经期推迟)$/.test(x)); } catch (e) { return false; } };
    function pool(kind, ch) {
        const P = poolRaw(kind, ch);
        const cf = cfgFor(ch);
        // 你说的话里带着某张字卡的关键词：先用那几张回
        const hot = P.__hot || [];
        if (hot.length && chance(cf.keyP)) return hot;
        // 此刻符合条件的（晚上 / 周末 / 心情…）优先
        // 这一刻正好满足条件的（经期 / 晚上 / 周末 / 心情…）：不管是 TA 专属的还是谁都能用的，都优先；TA 专属的更优先
        const cm = (P.__cond || []);
        if (cm.length && chance(cf.condP)) { const own = cm.filter(c => c.chars.length); return own.length ? own : cm; }
        return P;
    }
    function poolRaw(kind, ch) {
        const offG = new Set(S.groups.filter(g => g.off).map(g => g.id));
        let all = S.cards.filter(c => !c.off && !(c.g && offG.has(c.g)) && condOk(c, ch));
        // 带关键词的字卡是「你说到才回」的：没说到就不拿出来
        const hot = all.filter(c => keyHit(c) && matchChar(c, ch) && (!kind || !c.kinds.length || c.kinds.includes(kind)));
        let cs = all.filter(c => !(c.keys && c.keys.length));
        // 拍一拍 / 表情 / 格言 / 开场 这几类只在自己那一格用；别的场合挑字卡时不拿它们凑数
        if (!SOLO.includes(kind)) cs = cs.filter(c => !c.kinds.length || c.kinds.some(k => !SOLO.includes(k)));
        else return cs.filter(c => c.kinds.includes(kind) && matchChar(c, ch)).sort((x, y) => (y.chars.length ? 1 : 0) - (x.chars.length ? 1 : 0)).filter((c, i, arr) => !arr.some(o => o.chars.length) || c.chars.length);
        const strictChar = c => c.chars.length && ch && matchChar(c, ch);
        const okKind = c => kind ? c.kinds.includes(kind) : !c.kinds.length;
        const tiers = [
            cs.filter(c => strictChar(c) && okKind(c)),                       // 这个人 × 这个场合
            cs.filter(c => strictChar(c) && !c.kinds.length),                 // 这个人 × 通用
            cs.filter(c => !c.chars.length && okKind(c)),                     // 谁都能用 × 这个场合
            cs.filter(c => !c.chars.length && !c.kinds.length),               // 谁都能用 × 通用
            cs.filter(c => strictChar(c)),                                    // 这个人别的场合的
            cs.filter(c => matchChar(c, ch))                                  // 实在没有：随便
        ];
        let res = null;
        for (const t of tiers) if (t.length) { res = t; break; }
        if (!res) res = cs.length ? cs : sampleCards().filter(c => !SOLO.includes(c.kinds[0]));
        res = res.slice(); res.__hot = hot;
        res.__cond = cs.filter(c => c.cond && c.cond.length && matchChar(c, ch) && (kind ? (c.kinds.includes(kind) || !c.kinds.length) : !c.kinds.length));
        return res;
    }
    function draw(kind, ch, n) {
        const p = pool(kind, ch), out = [];
        for (let i = 0; i < n; i++) {
            // 同一次里不重复用同一张；字卡不够就少拼几句，不硬凑
            const fresh = p.filter(c => !out.includes(c));
            if (!fresh.length) break;
            const notRecent = fresh.filter(c => !S.recent.includes(c.id));
            const c = pick(notRecent.length ? notRecent : fresh);
            out.push(c);
            S.recent.push(c.id); if (S.recent.length > 40) S.recent.shift();
        }
        if (!out.length && p.length) out.push(pick(p));
        if (!out.length) return [];
        return out.map(c => fill(c.t, ch));
    }
    function fill(t, ch) {
        const d = new Date(), pad = n => String(n).padStart(2, '0');
        let uname = '你'; try { uname = (typeof userDisplayName === 'function' && ch) ? userDisplayName(ch) : ((typeof currentUser !== 'undefined' && currentUser.name) || '你'); } catch (e) {}
        return String(t).replace(/\{(user|我|你)\}/g, uname).replace(/\{(char|TA|ta|角色)\}/g, nameOf(ch) || 'TA')
            .replace(/\{time\}/g, pad(d.getHours()) + ':' + pad(d.getMinutes())).replace(/\{date\}/g, (d.getMonth() + 1) + '月' + d.getDate() + '日');
    }
    const LEN = { '聊天': [1, 1], '推文': [1, 2], '评论': [1, 1], '信': [8, 12], '日记': [3, 6], '论坛': [2, 4], '匿名': [1, 3], '朋友圈': [1, 1], '电话': [1, 2], '状态': [1, 1], '标题': [1, 1], '旁白': [1, 2], '小说': [5, 10], '总结': [1, 1] };
    // 句子结尾没标点的，随机补一个：！ 20% / … 16% / 。 64%
    const endPunct = t => /[。！？!?…~～」』”）)\]】.,，、;；:：—\-]$|[\u{1F300}-\u{1FAFF}\u2600-\u27BF]$/u.test(t) ? t : t + (Math.random() < 0.2 ? '！' : (Math.random() < 0.2 ? '…' : '。'));
    function compose(kind, ch, long) {
        const [a, b] = LEN[kind] || [1, 2];
        const n = long ? rint(Math.max(a, 3), Math.max(b, 5)) : rint(a, b);
        const k = kind === '小说' ? '旁白' : kind;
        let parts = draw(k, ch, n);
        // 信 / 日记：这一类字卡不够长，就拿 TA 平时说的话补上
        if ((kind === '信' || kind === '日记') && parts.length < n) {
            const more = draw('聊天', ch, n - parts.length).filter(t => !parts.includes(t));
            const tail = parts.length > 1 && /^[—-]/.test(parts[parts.length - 1]) ? parts.pop() : null;   // 落款留在最后
            parts = parts.concat(more); if (tail) parts.push(tail);
        }
        if (kind === '信') parts = parts.map(t => /^[—-]|见字如面|[:：]$/.test(t) ? t : endPunct(t));
        return (kind === '信' || kind === '日记' || kind === '小说' || kind === '论坛') ? parts.join('\n\n') : parts.join(kind === '聊天' || kind === '电话' ? '' : '\n');
    }

    /* ---------------- 这次是在干什么（按调用栈 + 要求里的字眼判断） ---------------- */
    function kindOf(stack, text) {
        // 先看是哪个功能在问（调用栈里的函数名），再看要求里的字眼
        const names = []; String(stack || '').replace(/at (?:async )?([^\s(]+)(?: \(|$)/gm, (m, n) => { if (!/^(file|https?|eval|<anonymous>)/.test(n)) names.push(n); return m; });
        const RULES = [
            [/[Ss]ummar|Memory|memory|Vector|Semantic|embed/, '总结'], [/[Ss]chedule|Todo|todo/, '日程'],
            [/gyCall|gyGroupCall|[Vv]oiceCall|[Pp]honeCall/, '电话'], [/[Ll]etter/, '信'], [/[Dd]iary/, '日记'], [/[Aa]non/, '匿名'],
            [/[Ff]orum/, '论坛'], [/[Mm]oment/, '朋友圈'], [/[Nn]ovel|sendSsTurn|regenSsTurn|[Tt]heater|[Ss]tory/, '小说'],
            [/[Cc]omment|[Rr]eplies|[Nn]pc|[Tt]abloid/, '评论'], [/executeGeneration|[Pp]ost|[Tt]weet/, '推文'],
            [/triggerAIBatchReply|[Cc]hatReply|retriggerLastReply|contextActionRegenerate|gyAfterActivity/, '聊天'],
            [/runAutonomyTurn|ActNote|askGap|TaDecide|taDecide/, '决定']
        ];
        // 从最里面那层往外看：自主模式里去发推，算「推文」不算「决定」
        for (const n of names) {
            const nn = n.replace(/^(window|Object|async)\./, '');
            if (/^(callChatCompletionAPI|sendChatRequest\w*|streamCompletionText|Promise\.\w+)$/.test(nn)) continue;
            for (const [re, k] of RULES) if (re.test(nn)) return k;
        }
        const t = text || '';
        const tail = t.slice(-400);
        if (/请?总结|摘要|概括/.test(tail)) return '总结';
        if (/日程|作息/.test(tail)) return '日程';
        if (/电话/.test(tail)) return '电话';
        if (/信件|写一封信/.test(tail)) return '信';
        if (/日记/.test(tail)) return '日记';
        if (/推文|发推/.test(tail)) return '推文';
        if (/评论|回复这条/.test(tail)) return '评论';
        return '聊天';
    }

    /* ---------------- 读懂功能要的 JSON 格式（宽松：模板里常夹着中文说明） ---------------- */
    function findTemplate(txt) {
        // 找最后一段像 {"键": …} / [{"键": …}] 的东西，取最外层那个（不要只拿到里面的一小块）
        const segEnd = st => {
            let depth = 0, q = false;
            for (let i = st; i < txt.length; i++) {
                const c = txt[i];
                if (c === '"' && txt[i - 1] !== '\\') q = !q;
                if (q) continue;
                if (c === '{' || c === '[') depth++;
                else if (c === '}' || c === ']') { depth--; if (depth === 0) return i; }
            }
            return -1;
        };
        const idxs = [];
        for (let i = 0; i < txt.length; i++) { const c = txt[i]; if ((c === '{' || c === '[') && /^[\[{]\s*[\[{]?\s*"/.test(txt.slice(i, i + 12).replace(/\s+/g, ' '))) idxs.push(i); }
        let best = null;
        for (let k = idxs.length - 1; k >= 0; k--) {
            const st = idxs[k], en = segEnd(st);
            if (en < 0) continue;
            const seg = txt.slice(st, en + 1);
            if (!/"[\w一-龥]+"\s*[:：]/.test(seg)) continue;
            if (!best) { best = [st, en]; continue; }
            if (st < best[0] && en >= best[1]) best = [st, en];   // 把刚才那块包在里面：换成外层
        }
        return best ? txt.slice(best[0], best[1] + 1) : null;
    }
    function parseSchema(src) {
        let i = 0;
        const ws = () => { while (i < src.length && /[\s,，]/.test(src[i])) i++; };
        function str() { let o = ''; i++; while (i < src.length && src[i] !== '"') { if (src[i] === '\\') { o += src[i + 1] || ''; i += 2; continue; } o += src[i++]; } i++; return o; }
        function bare() { let o = ''; while (i < src.length && !/[,，}\]\n]/.test(src[i])) o += src[i++]; return o.trim(); }
        function val(depth) {
            ws(); const c = src[i];
            if (depth > 8) return { t: 'str', ex: '' };
            if (c === '{') return obj(depth);
            if (c === '[') return arr(depth);
            if (c === '"') { const s = str(); ws(); return { t: 'str', ex: s }; }
            const b = bare();
            if (/true|false|是否|布尔/.test(b)) return { t: 'bool', ex: /true/.test(b) };
            if (/^-?\d/.test(b) || /数字|分钟|秒|几|个数|整数|数值/.test(b)) { const m = b.match(/-?\d+(\.\d+)?/); return { t: 'num', ex: m ? parseFloat(m[0]) : null }; }
            if (/^null$/.test(b)) return { t: 'str', ex: '' };
            return { t: 'str', ex: b };
        }
        function obj(depth) {
            i++; const o = { t: 'obj', keys: [] };
            while (i < src.length) {
                ws(); if (src[i] === '}') { i++; break; }
                let key;
                if (src[i] === '"') key = str(); else { let k = ''; while (i < src.length && !/[:：}]/.test(src[i])) k += src[i++]; key = k.trim(); }
                ws(); if (src[i] === ':' || src[i] === '：') i++; else { if (src[i] === '}') { i++; break; } i++; continue; }
                const v = val(depth + 1);
                if (key && !o.keys.some(x => x[0] === key)) o.keys.push([key, v]);
                ws(); if (src[i] === '}') { i++; break; }
            }
            return o;
        }
        function arr(depth) {
            i++; const a = { t: 'arr', item: null };
            while (i < src.length) {
                ws(); if (src[i] === ']') { i++; break; }
                if (src[i] === '.' || src[i] === '…') { i++; continue; }
                const v = val(depth + 1);
                if (!a.item) a.item = v;
                else if (a.item.t === 'obj' && v.t === 'obj') v.keys.forEach(kv => { if (!a.item.keys.some(x => x[0] === kv[0])) a.item.keys.push(kv); });
                ws(); if (src[i] === ']') { i++; break; }
            }
            if (!a.item) a.item = { t: 'str', ex: '' };
            return a;
        }
        try { const v = val(0); return v && (v.t === 'obj' || v.t === 'arr') ? v : null; } catch (e) { return null; }
    }

    /* ---------------- 按格式填 ---------------- */
    function menuKeys(txt) {
        const out = []; const re = /^\s*[-·•]\s*([a-z][\w]*)\s*[：:]/gm; let m;
        const SCHEMA = /^(plan|nextIn|nextSame|sameWhy|after|reason|param|action|delay|text|time|name)$/;
        while ((m = re.exec(txt))) if (!out.includes(m[1]) && !SCHEMA.test(m[1])) out.push(m[1]);
        // 自主行动的菜单：只认真的有这件事的 key（别把说明里的「· nextIn：」之类当成一件事）
        try { if (typeof GY_AUTONOMY_ACTIONS !== 'undefined') { const real = new Set(GY_AUTONOMY_ACTIONS.map(a => a.key)); const hit = out.filter(k => real.has(k)); if (hit.length) return hit; } } catch (e) {}
        return out;
    }
    let seqTime = null;
    const NICKS = ['路过的猫', '今天也要早睡', '小林', '雨天', '一只鹅', '西瓜冰', '晚风', '不吃香菜', '夜猫子', '阿七', '南方', '橘子汽水', 'momo', '小周', '书虫', '白开水'];
    function numFor(key, ex, C) {
        const k = key.toLowerCase();
        if (/^nextin$|^next$|gapmin|^gap$|interval/.test(k)) return rint(C.cfg.nextMin, C.cfg.nextMax);
        if (/nextsame/.test(k)) return rint(12 * 60, 72 * 60);
        if (/^after$|wait/.test(k)) return (window.__bailuNow || chance(75)) ? 0 : rint(10, 120);   // 「现在动一下」就是现在做
        if (/delay/.test(k)) return Math.round(rnd(0, 2) * 10) / 10;
        if (/^rel$|score|delta|change|favor|好感/.test(k)) return rint(-1, 2);
        if (/star|rating|评分/.test(k)) return rint(3, 5);
        if (/amt|amount|price|money|cost|钱|金额/.test(k)) return rint(5, 200);
        if (/min|minute|duration|mins/.test(k)) return rint(10, 120);
        if (/prob|rate|chance/.test(k)) return Math.round(Math.random() * 100) / 100;
        if (/count|^n$|num|times/.test(k)) return rint(1, 3);
        if (/idx|index|quote/.test(k)) return ex != null ? ex : 0;
        if (/hour/.test(k)) return rint(0, 23);
        return ex != null ? ex : rint(0, 5);
    }
    function boolFor(key, C) {
        const k = key.toLowerCase();
        if (/^ok$|accept|agree|yes|answer|join|pick|^go$|come|want|willing|同意|答应/.test(k)) return chance(C.cfg.accept);
        if (/image|photo|pic|voice|sticker|图|语音/.test(k)) return chance(12);
        if (/like|赞/.test(k)) return chance(50);
        if (/correct|right|猜中|hit/.test(k)) return chance(30);
        return chance(50);
    }
    function strFor(key, ex, C) {
        const k = key.toLowerCase(), ch = C.char;
        if (/^(action|act|key|choice|option)$/.test(k)) {
            const ks = C.menu.filter(x => x !== 'nothing');
            if (ks.length) {
                // 自主行动：按你在「🤖 自主行动」里给每件事定的权重随机挑（0＝永远不做；没设过＝1）
                const W = (C.cfg.actW) || {};
                const ws = ks.map(x => W[x] == null ? 1 : Math.max(0, +W[x] || 0));
                const sum = ws.reduce((a, b) => a + b, 0);
                if (!sum) return 'nothing';
                let r = Math.random() * sum;
                for (let i = 0; i < ks.length; i++) { if ((r -= ws[i]) < 0) return ks[i]; }
                return ks[ks.length - 1];
            }
            return ex || '';
        }
        if (/^(name|speaker|sender|who|char|character|from|by)$/.test(k) && C.names.length) return pick(C.names);
        if (/^(handle|nick|nickname|username|user|anonname|anonid|author|npc|npcname|commenter)$/.test(k)) return pick(NICKS) + (/handle|id/.test(k) ? String(rint(10, 999)) : '');
        if (/^(time|when|at|clock)$/.test(k)) {
            const pad = n => String(n).padStart(2, '0');
            if (seqTime == null) seqTime = rint(6, 9) * 60 + rint(0, 5) * 10; else seqTime += rint(60, 180);
            seqTime = Math.min(seqTime, 23 * 60 + 50);
            return pad(Math.floor(seqTime / 60)) + ':' + pad(seqTime % 60);
        }
        if (/date|day/.test(k)) { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
        if (/title|topic|subject|theme|标题/.test(k)) return draw('标题', ch, 1)[0].slice(0, 20);
        if (/reason|why|samewhy|because|原因/.test(k)) return draw(C.kind === '决定' ? '状态' : C.kind, ch, 1)[0].slice(0, 20);
        if (/^(status|state|stateupdate|doing|location|place|mood|activity|now|statustypelabel)$/.test(k)) return draw('状态', ch, 1)[0].slice(0, 30);
        if (/secret|answer|guess|word/.test(k)) return pick(['猫', '雨伞', '月亮', '奶茶', '钢琴', '图书馆', '海边', '冰淇淋', '台灯', '樱花', '火锅', '地铁', '向日葵', '耳机', '雪']);
        if (/emoticon|stickerid|emoid/.test(k)) return '';
        if (/emoji|emo$/.test(k)) return pick(['😊', '🥺', '😤', '🤔', '😂', '🫶', '😴']);
        if (/tag|label/.test(k)) return draw('标题', ch, 1)[0].slice(0, 8);
        if (/question|ask|提问/.test(k)) return pick(['它是活的吗？', '它比手机大吗？', '平时能吃吗？', '家里会有吗？', '是蓝色的吗？']);
        if (/summary|memory|总结/.test(k)) return summarize(C);
        const long = /content|body|letter|diary|story|chapter|正文/.test(k) && /信|日记|论坛|小说/.test(C.kind);
        return compose(C.kind === '决定' || C.kind === '日程' ? '聊天' : C.kind, ch, long);
    }
    function replyCount(cfg) {
        const w = [cfg.w1, cfg.w2, cfg.w3, cfg.w4, cfg.w5].map(x => Math.max(0, +x || 0));
        const sum = w.reduce((a, b) => a + b, 0);
        if (!sum) return rint(cfg.replyMin, Math.max(cfg.replyMin, cfg.replyMax));
        let r = Math.random() * sum;
        for (let i = 0; i < w.length; i++) { if ((r -= w[i]) < 0) return i + 1; }
        return 1;
    }
    // 自主行动里每件事要带的参数：换状态给个状态、办待办给一条真的待办、写东西给个话题……
    function paramFor(action, C) {
        const ch = C.char, a = String(action || '');
        const one = k => draw(k, ch, 1)[0] || '';
        if (a === 'status' || a === 'stateUpdate') return one('状态').slice(0, 20);
        if (a === 'todo_done') { const t = ((ch && ch.todos) || []).filter(x => x && !x.done); return t.length ? String(pick(t).text || pick(t).title || '') : ''; }
        if (a === 'todo_add') return one('状态').slice(0, 20);
        if (/diary|forum|anon|tabloid|post|moment/.test(a)) return one('标题').slice(0, 20);
        if (/music|song/.test(a)) return '';
        return '';
    }
    function fillSchema(sc, key, C, depth) {
        if (!sc) return '';
        if (sc.t === 'num') return numFor(key || '', sc.ex, C);
        if (sc.t === 'bool') return boolFor(key || '', C);
        if (sc.t === 'str') return strFor(key || '', sc.ex, C);
        if (sc.t === 'obj') {
            const o = {};
            // 这一项是谁说的（群聊之类）：先定下名字，后面的话就用这个人的字卡
            const nk = sc.keys.find(([k]) => /^(name|speaker|sender|who|char|character)$/i.test(k));
            const save = C.char;
            if (nk && C.names.length) { const n = strFor(nk[0], nk[1].ex, C); o[nk[0]] = n; const c2 = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => c.name === n || c.remark === n); if (c2) C.char = c2; }
            const ak = sc.keys.find(([k]) => /^action$/i.test(k));
            if (ak) o[ak[0]] = fillSchema(ak[1], ak[0], C, depth + 1);
            sc.keys.forEach(([k, v]) => {
                if ((nk && k === nk[0]) || (ak && k === ak[0])) return;
                if (ak && /^param$/i.test(k)) { o[k] = paramFor(o[ak[0]], C); return; }
                o[k] = fillSchema(v, k, C, depth + 1);
            });
            C.char = save;
            return o;
        }
        if (sc.t === 'arr') {
            const k = String(key || '').toLowerCase();
            let n;
            if (/^(replies|messages|bubbles|lines|msgs)$/.test(k) || (!k && C.kind === '聊天')) n = replyCount(C.cfg);
            else if (/^plan$/.test(k)) n = chance(C.cfg.activity) ? rint(1, 2) : 0;
            else if (/schedule|items|todos|list|events/.test(k) || C.kind === '日程') n = rint(4, 7);
            else n = rint(1, 3);
            const out = [];
            // 帖子底下的回复 / 评论：用「评论」字卡，不是再发一遍帖子
            const kind0 = C.kind;
            if (/repl|comment|评论|回复/.test(k) && C.kind !== '聊天') C.kind = '评论';
            for (let i = 0; i < n; i++) out.push(fillSchema(sc.item, k.replace(/s$/, ''), C, depth + 1));
            C.kind = kind0;
            return out;
        }
        return '';
    }
    function summarize(C) {
        // 从这次给的聊天记录里挑几句最近的，当成「记下来的事」
        const lines = C.all.split('\n').map(l => l.trim()).filter(l => /^[^\s：:]{1,12}[：:].{2,}/.test(l) && !/^(【|注意|要求|规则)/.test(l));
        const last = lines.slice(-6);
        if (!last.length) return compose('状态', C.char, false);
        return last.slice(-3).map(l => '· ' + l.slice(0, 60)).join('\n');
    }

    /* ---------------- 你在聊天里让 TA 去做某件事：按概率照做（带上 [ACT:…]） ---------------- */
    function obeyAct(C) {
        const acts = []; const re = /\[ACT:([^\]|@]+)/g; let m;
        while ((m = re.exec(C.all))) { const n = m[1].trim(); if (n && !acts.includes(n) && !/名字|动作/.test(n)) acts.push(n); }
        if (!acts.length || !C.userLast) return '';
        const said = C.userLast;
        const loose = a => { const core = a.replace(/^(去|给|约|帮)/, ''); if (core.length < 2) return null; try { return new RegExp(core.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{0,2}')); } catch (e) { return null; } };
        const hit = acts.filter(a => { const re = loose(a); return re && re.test(said); }).sort((a, b) => b.length - a.length)[0];
        if (!hit || !chance(C.cfg.obey)) return '';
        return `[ACT:${hit}]`;
    }

    /* ---------------- 聊天里的小动作：表情、表情包、引用、拍一拍 ---------------- */
    function decorate(replies, C) {
        const items = replies.filter(r => r && typeof r === 'object' && 'text' in r);
        if (!items.length) return;
        const ch = C.char;
        // 1) 话里夹一个表情字卡（前面或后面）
        items.forEach(r => { if (!chance(C.cfg.emojiP)) return; const e = draw('表情', ch, 1)[0]; if (!e) return; r.text = Math.random() < 0.5 ? String(r.text) + e : e + String(r.text); });
        // 2) 顺手一张表情包：用的是这次给 TA 看的那份表情包清单（你在「表情 / 图片」里管的那些）
        if (chance(C.cfg.stickerP)) {
            const ids = []; const re = /\[ID:\s*(emo_[\w-]+)/g; let m; while ((m = re.exec(C.all))) if (!ids.includes(m[1])) ids.push(m[1]);
            if (ids.length) { const last = items[items.length - 1]; last.text = String(last.text) + '[EMO:' + pick(ids) + ']'; }
        }
        // 3) 引用你刚才说的某一句再回（只挂在第一条上）
        if (chance(C.cfg.quoteP)) {
            const i = C.all.indexOf('QUOTE:编号');
            if (i >= 0) {
                const seg = C.all.slice(i, i + 3000); const nums = []; const re = /^\s*(\d+)\.\s*[^\n:：]{1,30}[:：]/gm; let m;
                while ((m = re.exec(seg))) nums.push(m[1]);
                if (nums.length) items[0].text = '[QUOTE:' + pick(nums.slice(-10)) + ']' + String(items[0].text);
            }
        }
        // 4) 拍一拍你：拍的那句话用「拍一拍」字卡
        if (chance(C.cfg.pokeP)) {
            const last = items[items.length - 1]; last.text = String(last.text) + '[NUDGE]';
            const p = draw('拍一拍', ch, 1)[0];
            if (p) { try { const u = currentUser, old = u.nudgeText; u.nudgeText = p; setTimeout(() => { if (u.nudgeText === p) u.nudgeText = old; }, 20000); } catch (e) {} }
        }
    }

    /* ---------------- 主入口：拿到这次的「问题」，给出「回答」 ---------------- */
    let LASTCHAR = null;
    function textOf(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.map(m => typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(p => p.text || '').join('') : '')).join('\n');
        return String(content || '');
    }
    function findChar(sys) {
        const cs = typeof myCharacters !== 'undefined' ? myCharacters : [];
        if (LASTCHAR && cs.includes(LASTCHAR)) return LASTCHAR;
        let best = null, at = 1e9;
        cs.forEach(c => { const i = sys.indexOf(c.name); if (i >= 0 && i < at) { at = i; best = c; } });
        return best;
    }
    function lastUserSaid(all, userMsgs) {
        const m = all.match(/最新消息[^\n]*\n([\s\S]{0,600}?)(?:\n\s*\n|$)/);
        if (m && m[1].trim()) return m[1].slice(-300);
        return (userMsgs.slice(-2).join('\n') || '').slice(-300);
    }
    window.__bailuKindOf = (st, t) => kindOf(st, t);
    let answer = function (content, stack) {
        const all = textOf(content);
        const msgs = Array.isArray(content) ? content : [{ role: 'user', content: all }];
        const instr = textOf([msgs[msgs.length - 1]]);
        const sys = textOf(msgs.filter(m => m.role === 'system')) || all.slice(0, 3000);
        const ch = findChar(sys);
        const cs = typeof myCharacters !== 'undefined' ? myCharacters : [];
        const names = cs.filter(c => all.indexOf(c.name) !== -1).map(c => c.name);
        const userMsgs = msgs.slice(0, -1).filter(m => m.role === 'user').map(m => textOf([m]));
        const C = { cfg: cfgFor(ch), char: ch, kind: kindOf(stack, instr), all, instr, menu: menuKeys(instr), names, userLast: lastUserSaid(all, userMsgs) };
        CUR_SAID = C.kind === '聊天' || C.kind === '电话' ? String(C.userLast || '').replace(/^我[:：]/gm, '') : '';
        seqTime = null;
        // 「不想说就输出 NO」：偶尔真的不说
        if (/输出\s*NO|只输出\s*NO|回\s*NO/.test(instr) && chance(C.cfg.silence)) return 'NO';
        const tpl = findTemplate(instr) || (/JSON|json/.test(instr) ? findTemplate(all.slice(-4000)) : null);
        const sc = tpl ? parseSchema(tpl) : null;
        if (sc) {
            const v = fillSchema(sc, sc.t === 'arr' && C.kind === '聊天' ? 'replies' : '', C, 0);
            // 聊天：你让 TA 做的事，挂在最后一条上
            if (C.kind === '聊天' && v && Array.isArray(v.replies) && v.replies.length) {
                decorate(v.replies, C);
                const act = obeyAct(C);
                if (act) { const last = v.replies[v.replies.length - 1]; if (last && typeof last === 'object') last.text = String(last.text || '') + act; }
                // 已读不回：真人也有看了消息没回的时候（你让 TA 做事的那一轮不算）
                if (!act && /\{"replies":\s*\[\]\}/.test(C.all) && chance(C.cfg.silence)) v.replies = [];
            }
            return JSON.stringify(v);
        }
        if (C.kind === '总结') return summarize(C);
        if (C.kind === '日程') { const out = []; for (let i = 0; i < rint(4, 7); i++) out.push(strFor('time', '', C) + ' ' + draw('状态', ch, 1)[0]); return out.join('\n'); }
        if (C.kind === '决定') return chance(C.cfg.accept) ? '是' : '否';
        const long = /长|一段|几段|篇|详细/.test(instr.slice(-200));
        return compose(C.kind, ch, long);
    }
    const answer0 = answer;
    answer = function (content, stack) { try { return answer0(content, stack); } finally { CUR_SAID = ''; } };
    window.bailuAnswer = answer;
    // 🩸 头一次记经期：给字卡库加一组「经期关心」（带条件，只在经期 / 快到的时候用；可改可删，不想要整组停用就行）
    async function periodCards() {
        await ready;
        const x = pst(); if (!x || !x.has || S.cfg.__periodCards) return;
        const g = groupByName('经期关心（内置，可改可删）');
        const mk = (t, cond) => ({ id: uid(), t, kinds: ['聊天'], chars: [], cond: [cond], g: g.id });
        const L = ['肚子还疼吗？', '别碰凉的，喝点热的。', '今天就好好躺着，别硬撑。', '想吃什么？我给你点。', '抱抱，疼的话跟我说。', '暖宝宝贴上了吗？', '早点睡，睡着了就没那么难受了。', '红糖姜茶喝了没？'].map(t => mk(t, '经期'))
            .concat(['这几天别吃冰的啊。', '包里记得带好东西。', '快到日子了吧，这几天早点睡。'].map(t => mk(t, '经期快到')));
        L.forEach(c => { if (!S.cards.some(o => o.t === c.t && (o.cond || []).join() === c.cond.join())) S.cards.push(c); });
        S.cfg.__periodCards = 1; await save();
    }
    window.addEventListener('gy:period', () => { periodCards().catch(() => {}); });
    setTimeout(() => periodCards().catch(() => {}), 6000);
    // 给 js/91（小玩法、心情、来电、格言、开场）用：只拿这一类的字卡，没有就是空的
    window.bailuDraw = (kind, ch, n) => draw(kind, ch, n || 1);
    window.bailuHas = (kind, ch) => pool(kind, ch).some(c => c.kinds.includes(kind));

    /* ---------------- 接管两个出口 ---------------- */
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const think = () => { const c = cfgFor(LASTCHAR); return sleep(rnd(c.delayMin, c.delayMax) * 1000); };
    // 聊天：先「已读」，再想一会儿才开始打字
    const isChat = st => /triggerAIBatchReply|[Cc]hatReply|retriggerLastReply/.test(st) && !/[Ll]etter|[Dd]iary|gyCall|[Ss]ummar/.test(st);
    async function readThenThink(stack) {
        if (!isChat(stack)) return think();
        { const c = cfgFor(LASTCHAR); await sleep(rnd(c.readMin, c.readMax) * 1000); }
        try {
            const ch = LASTCHAR; const arr = ch && typeof globalChats !== 'undefined' ? globalChats[String(ch.id)] : null;
            if (arr) {
                let any = false;
                arr.forEach(m => { if (m && m.sender === 'me') { if (!Array.isArray(m.readBy)) m.readBy = []; if (!m.readBy.includes(ch.id)) { m.readBy.push(ch.id); any = true; } } });
                if (any && typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === String(ch.id) && typeof renderChatMessages === 'function') renderChatMessages();
            }
        } catch (e) {}
        return think();
    }
    function hook() {
        if (typeof window.sendChatRequestRaw !== 'function' || window.sendChatRequestRaw.__bailu) return;
        window.sendChatRequestRaw = async function (api, content) {
            const stack = (new Error()).stack || '';   // 必须在第一个 await 之前取：知道是哪个功能在问
            if (!S.loaded) await ready;
            if (typeof window.gyTaRewrite === 'function') { try { content = window.gyTaRewrite(content); } catch (e) {} }
            let out = '';
            try { out = answer(content, stack); } catch (e) { console.warn('[白露] 字卡引擎出错：', e); out = draw('聊天', null, 1)[0]; }
            await readThenThink(stack);
            return { choices: [{ message: { content: out } }], usage: { prompt_tokens: 0, completion_tokens: 0 }, __bailu: true };
        };
        window.sendChatRequestRaw.__bailu = true;
        window.streamCompletionText = async function (api, content, onDelta) {
            const stack = (new Error()).stack || '';
            if (!S.loaded) await ready;
            let out = '';
            try { out = answer(content, stack); } catch (e) { console.warn('[白露] 字卡引擎出错：', e); out = draw('聊天', null, 1)[0]; }
            await readThenThink(stack);
            // 一点点吐出来，像在打字（聊天那边会把半截 JSON 里已经写完的几条先显示）
            const step = Math.max(4, Math.ceil(out.length / 12));
            for (let i = step; i < out.length; i += step) { try { onDelta(out.slice(0, i), false); } catch (e) {} await sleep(40); }
            try { onDelta(out, true); } catch (e) {}
            return { choices: [{ message: { content: out } }] };
        };
        // 记下「这次是替谁说话」
        if (typeof window.buildBasePrompt === 'function' && !window.buildBasePrompt.__bailu) {
            const b0 = window.buildBasePrompt;
            window.buildBasePrompt = function (char) { if (char && typeof char === 'object') LASTCHAR = char; return b0.apply(this, arguments); };
            window.buildBasePrompt.__bailu = true;
        }
    }
    // 各处「还没配 API Key」的检查：白露不用 key，给它们一个永远在的
    function fakeKey() {
        try { myApiUrl = 'bailu://cards'; myApiKey = 'bailu-cards'; myModel = '字卡'; } catch (e) {}
        try { if (!subApiKey) { subApiUrl = 'bailu://cards'; subApiKey = 'bailu-cards'; subModel = '字卡'; } } catch (e) {}
    }
    // 拉模型列表：白露只有一个「模型」，就是字卡
    function hookModels() {
        if (typeof window.fetchModelListFrom !== 'function' || window.fetchModelListFrom.__bailu) return;
        const f0 = window.fetchModelListFrom;
        window.fetchModelListFrom = async function (url) { if (/^bailu:/.test(String(url || ''))) return [{ id: '字卡' }]; return f0.apply(this, arguments); };
        window.fetchModelListFrom.__bailu = true;
    }
    hook(); fakeKey(); hookModels();
    setInterval(hookModels, 3000);
    setInterval(() => { hook(); fakeKey(); }, 1500);
    const load0 = window.loadAllData;
    if (typeof load0 === 'function' && !load0.__bailu) {
        window.loadAllData = async function () { const r = await load0.apply(this, arguments); fakeKey(); return r; };
        window.loadAllData.__bailu = true;
    }

    /* ---------------- 从已有的内容里收集字卡（导入谷雨的存档以后特别好用） ---------------- */
    function harvest() {
        const out = [];
        const cs = typeof myCharacters !== 'undefined' ? myCharacters : [];
        const clean = t => { let s = String(t || ''); try { if (typeof gyExtractChatStatus === 'function') s = gyExtractChatStatus(s).rest || s; } catch (e) {} return s.replace(/<[^>]+>/g, '').replace(/\[[A-Z]+:[^\]]*\]/g, '').trim(); };
        cs.forEach(c => {
            ((typeof globalChats !== 'undefined' && globalChats[c.id]) || []).forEach(m => { if (m && String(m.sender) === String(c.id) && !m.viaCall) { const t = clean(m.text); if (t && t.length <= 200) out.push({ id: uid(), t, kinds: ['聊天'], chars: [c.name] }); } });
            try { ((c.diaryData && c.diaryData.letters) || []).forEach(l => { if (l.author === 'user') return; clean(l.content).split(/\n+/).filter(p => p.trim().length > 3).forEach(p => out.push({ id: uid(), t: p.trim(), kinds: ['信'], chars: [c.name] })); }); } catch (e) {}
            try { ((c.diaryData && (c.diaryData.diaries || c.diaryData.entries)) || []).forEach(d => clean(d.content).split(/\n+/).filter(p => p.trim().length > 3).forEach(p => out.push({ id: uid(), t: p.trim(), kinds: ['日记'], chars: [c.name] }))); } catch (e) {}
        });
        try { (typeof globalPosts !== 'undefined' ? globalPosts : []).forEach(p => { if (!p || !p.char || String(p.char.id) === 'me') return; const t = clean(p.text); if (t && t.length <= 280) out.push({ id: uid(), t, kinds: ['推文'], chars: [p.char.name] }); }); } catch (e) {}
        return out;
    }

    /* ---------------- 设置里的「🃏 字卡库」 ---------------- */
    let F = { kind: '', char: '', q: '', g: '' };
    let IMP = { mode: 'add', g: '' };
    function statsHtml() {
        const by = {}; S.cards.forEach(c => (c.kinds.length ? c.kinds : ['通用']).forEach(k => { by[k] = (by[k] || 0) + 1; }));
        return KINDS.map(k => `<span class="bl-chip${F.kind === k ? ' on' : ''}" onclick="bailuF('kind','${k}')">${k} ${by[k] || 0}</span>`).join('');
    }
    function listHtml() {
        let L = S.cards;
        if (F.kind) L = L.filter(c => F.kind === '通用' ? !c.kinds.length : c.kinds.includes(F.kind));
        if (F.char) L = L.filter(c => F.char === '*' ? !c.chars.length : c.chars.includes(F.char));
        if (F.q) L = L.filter(c => c.t.includes(F.q));
        if (F.g) L = L.filter(c => F.g === '-' ? !c.g : c.g === F.g);
        const shown = L.slice(-300).reverse();
        return `<div class="bl-n">共 ${L.length} 张${L.length > shown.length ? `（先显示最新的 ${shown.length} 张，用上面的筛选找别的）` : ''}</div>` + shown.map(c => `<div class="bl-card${c.off ? ' off' : ''}">
            <div class="t" contenteditable="true" onblur="bailuEdit('${c.id}',this.innerText)">${esc(c.t)}</div>
            <div class="m">${gTag(c)}<span>${esc(c.kinds.join('、') || '通用')}</span><span>${esc(c.chars.join('、') || '谁都能用')}</span>${(c.cond || []).map(t => `<span class="bl-cond${window.bailuCondKnown(t) ? '' : ' bad'}" title="${window.bailuCondKnown(t) ? '条件' : '认不出这个条件，这张卡不会被用到'}">⏱ ${esc(t)}</span>`).join('')}${(c.keys || []).length ? `<span class="bl-key">🔑 ${esc(c.keys.join(' '))}</span>` : ''}${c.sample ? '<span class="s">示例</span>' : ''}
            <i onclick="bailuTag('${c.id}')">改标签</i><i onclick="bailuPickGroup('${c.id}')">分组</i><i onclick="bailuToggle('${c.id}')">${c.off ? '启用' : '停用'}</i><i class="del" onclick="bailuDel('${c.id}')">删除</i></div></div>`).join('');
    }
    const gById = id => S.groups.find(g => g.id === id);
    function gTag(c) { const g = c.g && gById(c.g); return g ? `<span class="bl-gtag" style="background:${g.color}22;color:${g.color}">● ${esc(g.name)}${g.off ? '（停用）' : ''}</span>` : ''; }
    function groupsHtml() {
        const cnt = {}; S.cards.forEach(c => { const k = c.g || '-'; cnt[k] = (cnt[k] || 0) + 1; });
        return `<span class="bl-chip${!F.g ? ' on' : ''}" onclick="bailuF('g','')">全部分组</span><span class="bl-chip${F.g === '-' ? ' on' : ''}" onclick="bailuF('g','-')">没分组 ${cnt['-'] || 0}</span>`
            + S.groups.map(g => `<span class="bl-chip bl-g${F.g === g.id ? ' on' : ''}${g.off ? ' goff' : ''}" style="--gc:${g.color}" onclick="bailuF('g','${g.id}')"><i style="background:${g.color}"></i>${esc(g.name)} ${cnt[g.id] || 0}</span>`).join('')
            + `<span class="bl-chip bl-add-g" onclick="bailuGroupNew()">＋ 新分组</span>`;
    }
    function groupOps() {
        const g = F.g && F.g !== '-' ? gById(F.g) : null;
        if (!g) return '';
        return `<div class="bl-gops" style="border-color:${g.color}"><b style="color:${g.color}">● ${esc(g.name)}</b>
            <span onclick="bailuGroupToggle('${g.id}')">${g.off ? '启用这一组' : '整组停用'}</span><span onclick="bailuGroupEdit('${g.id}')">改名 / 换颜色</span><span class="del" onclick="bailuGroupDel('${g.id}')">删掉分组（字卡留着）</span></div>`;
    }
    function gSelect(id, withNone) { return `<select id="${id}">${withNone ? '<option value="">不放进分组</option>' : ''}${S.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>`; }
    let SCOPE = '';   // '' ＝ 全部角色（默认）；角色名 ＝ 只给这个人单独调
    function cfgHtml() {
        const own = SCOPE ? (S.charCfg[SCOPE] || {}) : null;
        const row = (k, lab, min, max, step, unit) => own
            ? `<label class="bl-cfg${own[k] != null ? ' own' : ''}"><span>${lab}</span><input type="number" min="${min}" step="${step || 1}" value="${own[k] != null ? own[k] : ''}" placeholder="${S.cfg[k]}" onchange="bailuCfg('${k}',this.value)"><em>${unit || ''}</em></label>`
            : `<label class="bl-cfg"><span>${lab}</span><input type="number" min="${min}" step="${step || 1}" value="${S.cfg[k]}" onchange="bailuCfg('${k}',this.value)"><em>${unit || ''}</em></label>`;
        const sec = t => `<div class="bl-cfg-h">${t}</div>`;
        const cs = typeof myCharacters !== 'undefined' ? myCharacters.filter(c => c && !c.members) : [];
        const head = `<div class="bl-scope"><select onchange="bailuCfgScope(this.value)"><option value="">给所有人调（默认）</option>${cs.map(c => `<option value="${esc(c.name)}"${SCOPE === c.name ? ' selected' : ''}>只给 ${esc(c.name)} 单独调${S.charCfg[c.name] && Object.keys(S.charCfg[c.name]).length ? '（已单独设过）' : ''}</option>`).join('')}</select>
            ${SCOPE ? `<div class="bl-tip">空着的项跟着全局走（灰字是全局的数）；填了就只对 ${esc(SCOPE)} 生效。<span class="bl-link" onclick="bailuCfgReset()">清掉 ${esc(SCOPE)} 的单独设置</span></div>` : ''}</div>`;
        return head + sec('聊天节奏') + row('w1', '回 1 条的权重', 0) + row('w2', '回 2 条的权重', 0) + row('w3', '回 3 条的权重', 0) + row('w4', '回 4 条的权重', 0) + row('w5', '回 5 条的权重', 0)
            + row('readMin', '你发完，最快多久已读', 0, null, 0.1, '秒') + row('readMax', '你发完，最慢多久已读', 0, null, 0.1, '秒')
            + row('delayMin', '已读后最少想多久再回', 0, null, 0.1, '秒') + row('delayMax', '已读后最多想多久再回', 0, null, 0.1, '秒')
            + row('silence', '已读不回的概率', 0, 100, 1, '%')
            + sec('聊天里的小动作') + row('emojiP', '话里夹个表情字卡', 0, 100, 1, '%') + row('stickerP', '顺手发张表情包', 0, 100, 1, '%') + row('quoteP', '引用你说过的话再回', 0, 100, 1, '%') + row('pokeP', '拍一拍你', 0, 100, 1, '%')
            + sec('TA 做事') + row('obey', '你让 TA 做事，TA 照做', 0, 100, 1, '%') + row('accept', '答应邀请 / 接电话', 0, 100, 1, '%') + row('activity', '自主模式里「做点什么」', 0, 100, 1, '%')
            + row('nextMin', '自主模式：最快多久再想想', 1, null, 1, '分钟') + row('nextMax', '自主模式：最慢多久再想想', 1, null, 1, '分钟')
            + sec('氛围') + row('callP', '随机来电的概率（每次掷）', 0, 100, 1, '%') + row('callMin', '来电：最快多久掷一次', 1, null, 1, '分钟') + row('callMax', '来电：最慢多久掷一次', 1, null, 1, '分钟')
            + row('moodSkip', 'TA 某天不记心情', 0, 100, 1, '%') + (own ? '' : row('introOn', '开场动画（1 开 0 关）', 0, 1) + '<div class="bl-tip"><i onclick="bailuIntroPlay()" style="cursor:pointer;color:#1d9bf0;font-style:normal">▶ 预览开场</i></div>' + row('mottoOn', '聊天顶上的格言（1 开 0 关）', 0, 1))
            + sec('字卡怎么挑') + row('keyP', '你说到关键词：用那张来回', 0, 100, 1, '%') + row('condP', '符合此刻条件的字卡优先', 0, 100, 1, '%') + row('voiceP', '打电话时用你上传的语音', 0, 100, 1, '%');
    }
    function paint() {
        const box = document.getElementById('bailuBox'); if (!box) return;
        const cs = typeof myCharacters !== 'undefined' ? myCharacters : [];
        box.querySelector('.bl-stats').innerHTML = `<span class="bl-chip${!F.kind ? ' on' : ''}" onclick="bailuF('kind','')">全部 ${S.cards.length}</span>` + statsHtml();
        box.querySelector('.bl-chars').innerHTML = `<span class="bl-chip${!F.char ? ' on' : ''}" onclick="bailuF('char','')">所有人</span><span class="bl-chip${F.char === '*' ? ' on' : ''}" onclick="bailuF('char','*')">谁都能用</span>` + cs.map(c => `<span class="bl-chip${F.char === c.name ? ' on' : ''}" onclick="bailuF('char','${esc(c.name)}')">${esc(c.name)}</span>`).join('');
        box.querySelector('.bl-groups').innerHTML = groupsHtml();
        box.querySelector('.bl-gop').innerHTML = groupOps();
        box.querySelector('.bl-list').innerHTML = listHtml();
        const ig = document.getElementById('bailuImpGroup'); if (ig) { const v = IMP.g; ig.innerHTML = '<option value="">不放进分组</option>' + S.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join(''); ig.value = v; }
    }
    window.bailuOpen = function () {
        let ov = document.getElementById('bailuOv');
        if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'bailuOv'; ov.className = 'modal-overlay';
        const cs = typeof myCharacters !== 'undefined' ? myCharacters : [];
        ov.innerHTML = `<div class="modal-box bl-box" id="bailuBox">
            <div class="bl-hd"><b>🃏 字卡库</b><span onclick="document.getElementById('bailuOv').remove()">✕</span></div>
            <div class="bl-tip">白露不接 API：TA 说的每一句都从这里挑，随机拼起来。先挑「这个人 × 这个场合」的，没有就用「谁都能用」的。字卡里可以写 {user}（你的名字）、{char}（说话的人）、{time}、{date}。</div>
            <details class="bl-sec" open><summary>➕ 加字卡</summary>
                <div class="bl-add">
                    <div class="bl-row bl-imp"><label><input type="radio" name="bailuMode" value="add" ${IMP.mode === 'add' ? 'checked' : ''} onchange="bailuImp('mode','add')"> 追加（重复的跳过）</label><label><input type="radio" name="bailuMode" value="replace" ${IMP.mode === 'replace' ? 'checked' : ''} onchange="bailuImp('mode','replace')"> 覆盖（整个库换成这一批）</label></div>
                    <div class="bl-row"><select id="bailuImpGroup" onchange="bailuImp('g',this.value)"></select></div>
                    <label class="bl-btn">上传文件（txt / json / csv，一次可以选好几个）<input type="file" multiple accept=".txt,.md,.json,.csv,text/*" style="display:none" onchange="bailuUpload(this)"></label>
                    <div class="bl-row"><select id="bailuPasteKind"><option value="">类型：通用</option>${KINDS.filter(k => k !== '通用').map(k => `<option>${k}</option>`).join('')}</select>
                        <select id="bailuPasteChar"><option value="">角色：谁都能用</option>${cs.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></div>
                    <textarea id="bailuPaste" rows="5" placeholder="一行一张字卡。也可以用「#类型:聊天 角色:霍樊」这样的行给下面几行贴标签。"></textarea>
                    <button class="bl-btn pri" onclick="bailuPaste()">加进去</button>
                    <button class="bl-btn" onclick="bailuHarvest()">从聊天记录、推文、信件里收集 TA 说过的话</button>
                    <details class="bl-help"><summary>txt 怎么写？</summary><pre>#类型:聊天 角色:霍樊
你等下冻的话，记得叫我
以后有事先找我，听到没
#类型:信
见字如面，{user}。
#推文
今天的风有点温柔。
#类型:聊天 条件:晚上|深夜
还不睡？
{关键词 累 困}累了就去睡，我陪你。
{if 周末}{关键词 出去}周末要不要出去走走？</pre>条件可写：凌晨 早上 上午 中午 下午 傍晚 晚上 深夜 白天、22点-2点、周末 工作日 周五、春天…冬天、12月、2月14日、心情:开心（TA 今天手账里的心情）、我心情:累、经期 / 经期快到 / 排卵期 / 推迟（接你的经期记录）、不是周末；多个要全满足，「晚上|深夜」其一就行。带关键词的字卡只在你说到时才用。<br>类型可写：${KINDS.join(' ')}。json 可以是 ["一句","两句"]，或 [{"text":"…","类型":"聊天","角色":"霍樊"}]；csv 三列：内容,类型,角色。</details>
                </div></details>
            <details class="bl-sec" ontoggle="if(this.open&&window.bailuVoicePaint)bailuVoicePaint()"><summary>🎙️ 语音库</summary><div id="bailuVoiceBox"></div></details>
            <details class="bl-sec"><summary>🖼️ 图片</summary><div class="bl-tip">TA 发图不接 API：默认从图库里按聊的内容挑一张（去「小功能 → 🖼️ 图库」给 TA 喂图、打标签）。想换成别的方式，在「小功能 → 📷 角色发图片」里改。</div></details>
            <details class="bl-sec"><summary>🎲 概率和节奏</summary><div class="bl-cfgs">${cfgHtml()}</div></details>
            <div class="bl-sec"><div class="bl-filter"><input placeholder="搜字卡" oninput="bailuF('q',this.value)"></div>
                <div class="bl-stats"></div><div class="bl-chars"></div><div class="bl-groups"></div><div class="bl-gop"></div>
                <div class="bl-ops"><span onclick="bailuExport()">导出全部</span><span onclick="bailuExportShown()" title="上面选了哪个角色，就是导出这个人的字卡">导出筛出来的</span><span onclick="bailuDedup()">一键去重</span><span onclick="bailuGroupShown()">把筛出来的放进分组</span><span onclick="bailuToggleShown()">筛出来的全部停用/启用</span><span onclick="bailuSamples()">${S.cards.some(c => c.sample) ? '删掉示例字卡' : '放回示例字卡'}</span><span class="del" onclick="bailuClearShown()">删掉当前筛出来的</span></div>
                <div class="bl-list"></div></div>
        </div>`;
        document.body.appendChild(ov);
        ov.style.display = 'flex';
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        ready.then(paint);
    };
    window.bailuF = function (k, v) { F[k] = v; paint(); };
    const askOk = async m => typeof appConfirm === 'function' ? await appConfirm(m) : confirm(m);
    const ask = (m, d) => typeof appPrompt === 'function' ? appPrompt(m, d) : Promise.resolve(prompt(m, d));
    window.bailuImp = function (k, v) { IMP[k] = v; };
    window.bailuDedup = async function () { const n = dedup(); await save(); paint(); toast(n ? `🃏 去掉了 ${n} 张重复的` : '没有重复的字卡'); };
    window.bailuGroupNew = async function () {
        const name = await ask('新分组叫什么？', ''); if (!name || !String(name).trim()) return;
        const g = groupByName(name); F.g = g.id; await save(); paint();
    };
    window.bailuGroupEdit = async function (id) {
        const g = gById(id); if (!g) return;
        const name = await ask('分组名字', g.name); if (name === null || name === undefined) return;
        if (String(name).trim()) g.name = String(name).trim();
        const col = await ask('颜色（写颜色值，比如 #e57373；可选：' + GCOLORS.join(' ') + '）', g.color);
        if (col && /^#?[0-9a-f]{3,8}$/i.test(String(col).trim())) g.color = String(col).trim().replace(/^(?!#)/, '#');
        await save(); paint();
    };
    window.bailuGroupToggle = async function (id) { const g = gById(id); if (!g) return; g.off = !g.off; await save(); paint(); toast(g.off ? `「${g.name}」整组停用了，TA 不会再用这一组` : `「${g.name}」启用了`); };
    window.bailuGroupDel = async function (id) {
        const g = gById(id); if (!g) return;
        if (!(await askOk(`删掉分组「${g.name}」？里面的字卡会留着，只是不再属于这一组。`))) return;
        S.groups = S.groups.filter(x => x.id !== id); S.cards.forEach(c => { if (c.g === id) delete c.g; }); if (F.g === id) F.g = ''; await save(); paint();
    };
    const hitF = c => (!F.kind || (F.kind === '通用' ? !c.kinds.length : c.kinds.includes(F.kind))) && (!F.char || (F.char === '*' ? !c.chars.length : c.chars.includes(F.char))) && (!F.q || c.t.includes(F.q)) && (!F.g || (F.g === '-' ? !c.g : c.g === F.g));
    async function chooseGroup(title) {
        const names = S.groups.map((g, i) => (i + 1) + '. ' + g.name).join('\n');
        const v = await ask(title + '\n' + (names ? names + '\n' : '') + '写编号选已有的，写新名字就新建一组；写 0 ＝ 移出分组', '');
        if (v === null || v === undefined || String(v).trim() === '') return undefined;
        const t = String(v).trim();
        if (t === '0') return null;
        if (/^\d+$/.test(t) && S.groups[+t - 1]) return S.groups[+t - 1].id;
        return groupByName(t).id;
    }
    window.bailuPickGroup = async function (id) {
        const c = S.cards.find(x => x.id === id); if (!c) return;
        const g = await chooseGroup('这张字卡放进哪个分组？'); if (g === undefined) return;
        if (g) c.g = g; else delete c.g; await save(); paint();
    };
    window.bailuGroupShown = async function () {
        const L = S.cards.filter(hitF); if (!L.length) return;
        const g = await chooseGroup(`把筛出来的 ${L.length} 张放进哪个分组？`); if (g === undefined) return;
        L.forEach(c => { if (g) c.g = g; else delete c.g; }); await save(); paint(); toast(`🃏 ${L.length} 张换好分组了`);
    };
    window.bailuToggleShown = async function () {
        const L = S.cards.filter(hitF); if (!L.length) return;
        const off = !L.every(c => c.off); L.forEach(c => { c.off = off; }); await save(); paint(); toast(`${L.length} 张${off ? '停用' : '启用'}了`);
    };
    window.bailuUpload = async function (inp) {
        const files = [...(inp.files || [])]; inp.value = '';
        let n = 0;
        if (IMP.mode === 'replace' && files.length) { const ok = await askOk(`用这 ${files.length} 个文件覆盖整个字卡库？原来的字卡会被换掉。`); if (!ok) return; }
        let first = true;
        for (const f of files) { const txt = await f.text(); n += addCards(parseAny(txt, f.name), first ? IMP.mode : 'add', IMP.g); first = false; }
        await save(); paint(); toast(`🃏 加了 ${n} 张字卡`, files.length > 1 ? `来自 ${files.length} 个文件` : '');
    };
    window.bailuPaste = async function () {
        const ta = document.getElementById('bailuPaste'); if (!ta || !ta.value.trim()) return;
        const base = { kind: normKind((document.getElementById('bailuPasteKind') || {}).value), char: (document.getElementById('bailuPasteChar') || {}).value || '' };
        if (base.kind === '通用') base.kind = '';
        if (IMP.mode === 'replace' && !(await askOk('用这些覆盖整个字卡库？原来的字卡会被换掉。'))) return;
        const n = addCards(parseAny(ta.value, '', base), IMP.mode, IMP.g); ta.value = '';
        await save(); paint(); toast(`🃏 加了 ${n} 张字卡`);
    };
    window.bailuHarvest = async function () {
        const n = addCards(harvest());
        await save(); paint(); toast(n ? `🃏 收集到 ${n} 张新字卡` : '没有新的可收集', n ? '来自聊天记录、推文和信件' : '');
    };
    window.bailuEdit = async function (id, t) { const c = S.cards.find(x => x.id === id); if (!c) return; t = String(t || '').trim(); if (!t || t === c.t) return; c.t = t; delete c.sample; await save(); };
    window.bailuDel = async function (id) { S.cards = S.cards.filter(x => x.id !== id); await save(); paint(); };
    window.bailuToggle = async function (id) { const c = S.cards.find(x => x.id === id); if (c) { c.off = !c.off; await save(); paint(); } };
    window.bailuTag = async function (id) {
        const c = S.cards.find(x => x.id === id); if (!c) return;
        const ask = typeof appPrompt === 'function' ? appPrompt : (m, d) => Promise.resolve(prompt(m, d));
        const k = await ask('类型（多个用空格隔开；留空＝通用）\n可写：' + KINDS.join(' '), c.kinds.join(' '));
        if (k === null || k === undefined) return;
        const ch = await ask('角色名（多个用空格隔开；留空＝谁都能用）', c.chars.join(' '));
        if (ch === null || ch === undefined) return;
        const cd = await ask('条件（多个用空格隔开，要全满足；「晚上|深夜」＝其一就行；留空＝什么时候都能用）\n可写：凌晨 早上 上午 中午 下午 傍晚 晚上 深夜 白天 · 22点-2点 · 周末 工作日 周五 · 春天…冬天 · 12月 2月14日 · 心情:开心（TA 今天的心情）· 我心情:累 · 不是周末 · 经期 · 经期快到 · 排卵期 · 推迟', (c.cond || []).join(' '));
        if (cd === null || cd === undefined) return;
        const kw = await ask('关键词（多个用空格隔开）：你说的话里带着其中一个，TA 就优先用这张回；留空＝不按关键词', (c.keys || []).join(' '));
        if (kw === null || kw === undefined) return;
        c.kinds = String(k).split(/\s+/).map(normKind).filter(x => x && x !== '通用');
        c.chars = String(ch).split(/\s+/).map(s => s.trim()).filter(Boolean);
        const cl = splitList(cd), kl = splitList(kw);
        if (cl.length) c.cond = cl; else delete c.cond;
        if (kl.length) c.keys = kl; else delete c.keys;
        delete c.sample; await save(); paint();
    };
    window.bailuCfg = async function (k, v) {
        const n = parseFloat(v);
        if (SCOPE) {
            const o = S.charCfg[SCOPE] = S.charCfg[SCOPE] || {};
            if (String(v).trim() === '' || !isFinite(n)) delete o[k]; else o[k] = n;
            if (!Object.keys(o).length) delete S.charCfg[SCOPE];
            await save(); return;
        }
        if (!isFinite(n)) return; S.cfg[k] = n; await save();
    };
    window.bailuCfgScope = function (v) { SCOPE = v || ''; const b = document.querySelector('#bailuOv .bl-cfgs'); if (b) b.innerHTML = cfgHtml(); };
    window.bailuCfgReset = async function () { if (!SCOPE) return; delete S.charCfg[SCOPE]; await save(); window.bailuCfgScope(SCOPE); toast('清掉了，' + SCOPE + ' 现在跟着全局走'); };
    window.bailuSamples = async function () {
        if (S.cards.some(c => c.sample)) S.cards = S.cards.filter(c => !c.sample);
        else S.cards = S.cards.concat(sampleCards());
        await save(); window.bailuOpen();
    };
    window.bailuClearShown = async function () {
        const n0 = S.cards.length;
        const hit = hitF;
        const n = S.cards.filter(hit).length; if (!n) return;
        const ok = typeof appConfirm === 'function' ? await appConfirm(`删掉筛出来的这 ${n} 张字卡？`) : confirm(`删掉筛出来的这 ${n} 张字卡？`);
        if (!ok) return;
        S.cards = S.cards.filter(c => !hit(c)); await save(); paint(); toast(`删掉了 ${n0 - S.cards.length} 张`);
    };
    function exportList(L, name) {
        const txt = JSON.stringify(L.map(c => { const o = { text: c.t, 类型: c.kinds, 角色: c.chars }; const g = c.g && gById(c.g); if (g) o.分组 = g.name; if (c.off) o.停用 = true; if (c.cond && c.cond.length) o.条件 = c.cond; if (c.keys && c.keys.length) o.关键词 = c.keys; return o; }), null, 2);
        try { if (typeof saveTextFileForApp === 'function') { saveTextFileForApp(name, txt, 'application/json'); return txt; } } catch (e) {}
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; a.click();
        return txt;
    }
    window.bailuExport = function () { return exportList(S.cards, '白露字卡.json'); };
    // 导出筛出来的：选了某个角色就是「这个人的字卡」，拿去分享给别人直接能导
    window.bailuExportShown = function () {
        const L = S.cards.filter(hitF); if (!L.length) { toast('没有筛出来的字卡'); return ''; }
        const tag = [F.char && F.char !== '*' ? F.char : (F.char === '*' ? '谁都能用' : ''), F.kind, F.g && F.g !== '-' ? (gById(F.g) || {}).name : ''].filter(Boolean).join('-');
        return exportList(L, '白露字卡' + (tag ? '-' + tag : '') + '.json');
    };

    // 设置首页：把「API 与模型」换成「字卡库」
    function entry() {
        const api = document.querySelector('#setIndex .set-entry[onclick*="openSettingsPanel(\'api\')"]');
        if (api && !document.getElementById('bailuEntry')) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.id = 'bailuEntry'; b.setAttribute('data-core', '1');
            b.onclick = () => window.bailuOpen();
            b.innerHTML = '<span class="set-entry-ico">🃏</span><span class="set-entry-main"><span class="set-entry-title">字卡库</span><span class="set-entry-desc">TA 说的话都从这里来：上传、粘贴、收集字卡，调概率</span></span><span class="set-entry-arrow">›</span>';
            api.parentNode.insertBefore(b, api);
            api.style.display = 'none';
        }
    }
    const CSS = `
#bailuOv{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
#bailuOv .bl-box{background:#fff;color:#111;border-radius:18px;width:min(620px,100%);max-height:88vh;overflow:auto;padding:16px 18px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.bl-hd{display:flex;justify-content:space-between;align-items:center;font-size:18px;margin-bottom:6px}.bl-hd span{cursor:pointer;font-size:18px;color:#888}
.bl-tip{font-size:12.5px;color:#777;line-height:1.6;margin-bottom:10px}
.bl-sec{border-top:1px solid #eee;padding:10px 0}.bl-sec>summary{cursor:pointer;font-weight:600;font-size:14.5px}
.bl-add{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.bl-row{display:flex;gap:8px}.bl-row select{flex:1;padding:8px;border-radius:10px;border:1px solid #ddd;background:#fafafa}
#bailuPaste{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:12px;padding:10px;font-size:14px;font-family:inherit;resize:vertical}
.bl-btn{display:block;text-align:center;padding:10px;border-radius:12px;background:#f2f2f4;border:none;cursor:pointer;font-size:14px;font-family:inherit;color:#111}
.bl-btn.pri{background:#111;color:#fff}
.bl-help{font-size:12.5px;color:#666}.bl-help pre{background:#f7f7f7;padding:8px;border-radius:8px;white-space:pre-wrap}
.bl-cfgs{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.bl-cfg{display:flex;align-items:center;gap:8px;font-size:13.5px}.bl-cfg span{flex:1}.bl-cfg input{width:80px;padding:6px 8px;border-radius:8px;border:1px solid #ddd}.bl-cfg em{font-style:normal;color:#888;width:34px}
.bl-filter input{width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:1px solid #ddd;margin-bottom:8px}
.bl-stats,.bl-chars{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.bl-chip{padding:4px 10px;border-radius:999px;background:#f2f2f4;font-size:12.5px;cursor:pointer}.bl-chip.on{background:#111;color:#fff}
.bl-ops{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#576b95;margin:4px 0 8px}.bl-ops span{cursor:pointer;white-space:nowrap}.bl-ops .del{color:#e0443e}
.bl-n{font-size:12px;color:#888;margin-bottom:6px}
.bl-cfg-h{font-size:12px;color:#999;margin:8px 0 2px;font-weight:600}
.bl-imp{font-size:13px;gap:14px;flex-wrap:wrap}.bl-imp label{display:flex;gap:4px;align-items:center;cursor:pointer}
.bl-groups{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}.bl-g i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:1px}
.bl-g.on{background:var(--gc);color:#fff}.bl-g.on i{background:#fff!important}.bl-g.goff{opacity:.5;text-decoration:line-through}.bl-add-g{color:#576b95;background:transparent;border:1px dashed #cdd}
.bl-gops{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:12.5px;border-left:3px solid;padding:4px 10px;margin-bottom:8px}.bl-gops span{color:#576b95;cursor:pointer}.bl-gops .del{color:#e0443e}
.bl-scope select{width:100%;padding:8px;border-radius:10px;border:1px solid #ddd;background:#fafafa;margin-bottom:6px}.bl-link{color:#576b95;cursor:pointer;margin-left:6px}
.bl-cfg.own span{color:#1d9bf0;font-weight:600}
.bl-cond{padding:0 6px;border-radius:6px;background:#eef6ff;color:#3a78c2}.bl-cond.bad{background:#fdecec;color:#d33;text-decoration:line-through}.bl-key{padding:0 6px;border-radius:6px;background:#fff5e0;color:#b27400}
.bl-gtag{padding:0 6px;border-radius:6px;font-size:11px}
.bl-card{border:1px solid #eee;border-radius:12px;padding:8px 10px;margin-bottom:6px}.bl-card.off{opacity:.45}
.bl-card .t{font-size:14px;line-height:1.55;outline:none;white-space:pre-wrap}.bl-card .t:focus{background:#fffbe6}
.bl-card .m{display:flex;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#999;margin-top:4px;align-items:center}.bl-card .m .s{color:#d08b00}
.bl-card .m i{font-style:normal;color:#576b95;cursor:pointer}.bl-card .m i.del{color:#e0443e}
body.gyphm #bailuOv .bl-box,body.gywx #bailuOv .bl-box{font-family:inherit}
`;
    function boot() {
        if (!document.getElementById('bailuCss')) { const st = document.createElement('style'); st.id = 'bailuCss'; st.textContent = CSS; document.head.appendChild(st); }
        entry(); setInterval(entry, 2000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    console.info('[白露] 字卡引擎已接管：不连任何 API，所有回复都来自字卡库');
})();
