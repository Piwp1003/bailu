/* ===========================================================================
   js/31 —— 💳 钱包 · 银行卡 · 转账 · 小票
   ---------------------------------------------------------------------------
   为什么要有这一层：以前商城里所有东西都是凭空来的。角色送你一块金表和送你
   一张手写信，代价一模一样——都是零。于是"TA 攒了三个月给你买这个"和"随手点的
   外卖"在数据上没有任何区别，角色的慷慨也就没有重量。

   加上钱之后：
     · 买东西**真的扣钱**，买不起就买不了（随机网购也一样，不会再无限刷单）
     · 每一单生成一张**小票**，附在订单上，随时点开看：谁、用哪张卡、付了多少
     · **转账 / 红包**是私聊里的一张卡，对方要**真的点收**才到账，可以退回
     · 角色有工作就有**固定收入**（按天结算，不调 API）
     · 生活是随机的，所以有**随机账单**；愿意花钱的话，可以让角色**自己决定**
       这笔钱花在哪儿（一次调用，写成一条流水的理由）

   💳 关于"很多张卡"：现实里没人只有一个余额。这里给四类支付方式——
       储蓄卡（有多少花多少）· 信用卡（有额度，会欠着）· 余额（App 里的零钱）
       · 红包（收来的钱，单独一格）。
      付款时用哪张：**你可以指定，也可以让角色自己挑**（挑的规则是死的，不调 API：
      够钱的储蓄卡 → 余额 → 红包 → 信用卡兜底，跟真人一个顺序）。

   ⚠️ 整个系统默认**关着**。不打开的话商城、聊天、资料页跟以前一模一样，
      一分钱不扣，一次 API 都不调。

   💰 花钱的地方只有一处：让角色自己决定账单花在哪（开关 walletCharDecide，默认关）。
      发工资、扣款、转账、收红包、生成小票，全都是本地算账，一次都不调。
   =========================================================================== */
(function () {
    if (window.__gyWalletLoaded) return;
    window.__gyWalletLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyWalletBox', 'wallet')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyWalletBox', storeName: 'wallet' })
            : null);
    const KEY = 'gyWallet_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const meName = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '我';
    const nameOf = id => String(id) === 'me' ? meName() : ((charOf(id) || {}).name || '某人');
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    // 🩹 这个文件里一直在调 toast()，但从来没定义过——「让 TA 现在想」一点就报错。补上。
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '💳 钱包', m, null, null, false); } catch (e) {} };
    const uid = p => (p || 'w') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
    const day = t => new Date(t || Date.now()).toISOString().slice(0, 10);

    /* ---------- 四类支付方式 ----------
       kind 决定的是"钱从哪儿来、能不能透支"，不是好看不好看。 */
    const KINDS = {
        debit:     { name: '储蓄卡', ico: '💳', hint: '有多少花多少' },
        credit:    { name: '信用卡', ico: '🪙', hint: '有额度，会欠着，下个月要还' },
        balance:   { name: '余额',   ico: '👛', hint: 'App 里的零钱' },
        redpacket: { name: '红包',   ico: '🧧', hint: '收来的钱，单独放一格' }
    };
    const BANKS = ['工商', '建设', '招商', '农业', '中国', '交通', '邮储', '兴业'];
    const kindOf = k => KINDS[k] || KINDS.debit;

    let S = {
        me: { cards: [], defaultCard: '' },
        chars: {},                 // { 角色id: {cards, defaultCard, job, lastPayDay, lastBillDay} }
        log: {},                   // { 拥有者id: [流水] }
        receipts: {},              // { 订单id: 小票 }
        settings: { billMin: 8, billMax: 120, startMe: 2000, startChar: 1500,
                    // 出门那一趟谁掏钱：random 随机 / me 我请 / ta TA请 / aa 各付各的 / rel 按好感度
                    outingPayer: 'random',
                    // 出门"什么都没花"的概率（%）——散个步什么都不买是很正常的事
                    outingFreePct: 30 }
    };

    async function save() { try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[钱包] 存档失败', e); } }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!S.me || typeof S.me !== 'object') S.me = { cards: [], defaultCard: '' };
        if (!Array.isArray(S.me.cards)) S.me.cards = [];
        if (!S.chars || typeof S.chars !== 'object') S.chars = {};
        if (!S.log || typeof S.log !== 'object') S.log = {};
        if (!S.receipts || typeof S.receipts !== 'object') S.receipts = {};
    }

    /* ---------- 钱包 / 卡 ---------- */
    function walletOf(ownerId) {
        if (String(ownerId) === 'me') return S.me;
        const k = String(ownerId);
        if (!S.chars[k]) S.chars[k] = { cards: [], defaultCard: '', job: null, lastPayDay: '', lastBillDay: '' };
        if (!Array.isArray(S.chars[k].cards)) S.chars[k].cards = [];
        return S.chars[k];
    }
    function newCard(kind, name, amount) {
        const K = kindOf(kind);
        return {
            id: uid('c_'), kind, name: name || (BANKS[Math.floor(Math.random() * BANKS.length)] + K.name),
            no4: String(Math.floor(1000 + Math.random() * 9000)),
            balance: kind === 'credit' ? 0 : (Number(amount) || 0),
            limit: kind === 'credit' ? (Number(amount) || 5000) : 0,
            createdAt: Date.now()
        };
    }
    // 第一次用的时候自动开一套卡，免得钱包是空的什么都干不了
    function ensureCards(ownerId) {
        const w = walletOf(ownerId);
        if (w.cards.length) return w;
        const me = String(ownerId) === 'me';
        const start = me ? (Number(S.settings.startMe) || 2000) : (Number(S.settings.startChar) || 1500);
        w.cards.push(newCard('debit', '', Math.round(start * 0.7)));
        w.cards.push(newCard('balance', '钱包余额', Math.round(start * 0.3)));
        w.cards.push(newCard('credit', '', 5000));
        w.cards.push(newCard('redpacket', '红包零钱', 0));
        w.defaultCard = w.cards[0].id;
        return w;
    }
    const cardOf = (ownerId, cardId) => walletOf(ownerId).cards.find(c => c.id === cardId) || null;
    // 可用多少只是给人看的数（信用卡＝额度减已用，可以是负的＝透支了），**不拿来拦付款**
    const avail = c => c.kind === 'credit' ? ((c.limit || 0) - (c.balance || 0)) : (c.balance || 0);
    // 一个人现在总共有多少能花的（信用卡的可用额度不算"资产"，单独看）
    function totalOf(ownerId) {
        const w = walletOf(ownerId);
        return w.cards.filter(c => c.kind !== 'credit').reduce((a, c) => a + (c.balance || 0), 0);
    }
    function debtOf(ownerId) {
        return walletOf(ownerId).cards.filter(c => c.kind === 'credit').reduce((a, c) => a + (c.balance || 0), 0);
    }

    /* 付款时用哪张卡。
       指定了就用指定的；没指定就按真人的顺序自己挑——
       够钱的储蓄卡 → 余额 → 红包 → 信用卡。这套规则是死的，不调 API。
       **不设上限**：指定的卡/默认卡不管够不够都照扣（可以扣成负数＝透支），
       一张都不够的时候也不拒付，落到默认卡（没有就第一张）上。 */
    function pickCard(ownerId, amt, prefer) {
        const w = ensureCards(ownerId);
        if (prefer) { const c = cardOf(ownerId, prefer); if (c) return c; }
        if (!on('walletPayChoice') && w.defaultCard) {
            const d = cardOf(ownerId, w.defaultCard);
            if (d) return d;
        }
        const order = ['debit', 'balance', 'redpacket', 'credit'];
        for (const k of order) {
            const c = w.cards.filter(x => x.kind === k).sort((a, b) => avail(b) - avail(a))[0];
            if (c && avail(c) >= amt) return c;
        }
        return cardOf(ownerId, w.defaultCard) || w.cards.find(x => x.kind === 'debit') || w.cards[0] || null;
    }

    /* ---------- 记账 ----------
       每一笔都开一张凭证（不只是商城那种商品小票）——这样账单里点任意一笔
       都能看到"什么时候、用哪张卡、花在哪儿"，而不是只有一行字。 */
    function logOf(ownerId) { const k = String(ownerId); if (!Array.isArray(S.log[k])) S.log[k] = []; return S.log[k]; }
    function note(ownerId, amt, why, kind, card, meta) {
        const arr = logOf(ownerId);
        const rid = uid('r_');
        const e = { id: uid('l_'), at: Date.now(), amt: Math.round(amt * 100) / 100,
                    why: String(why || ''), kind, rid,
                    tag: (meta && meta.tag) || (kind === 'income' ? '收入' : '日常'),
                    card: card ? (card.name + ' ·' + card.no4) : '' };
        arr.unshift(e);   // 流水不设条数上限，全留着
        S.receipts[rid] = {
            no: (meta && meta.no) || ((amt >= 0 ? 'I' : 'P') + String(Date.now()).slice(-9)),
            at: e.at, who: String(ownerId), label: e.why, amount: Math.abs(e.amt),
            sign: e.amt >= 0 ? 1 : -1,
            shop: (meta && meta.shop) || '',
            items: (meta && meta.items) || null,
            method: card ? kindOf(card.kind).name : '—',
            card: card ? (card.name + ' ****' + card.no4) : '',
            tag: e.tag
        };
        // 凭证也不设张数上限（以前只留 800 张，旧账点开是空的）
        return e;
    }
    // 扣钱。不设上限：钱不够也照扣，余额可以变负数（只有这人一张卡都没有才会失败）
    async function pay(ownerId, amt, why, prefer, meta) {
        const n = Math.round((Number(amt) || 0) * 100) / 100;
        if (n <= 0) return { ok: true, card: null };
        const c = pickCard(ownerId, n, prefer);
        if (!c) return { ok: false, card: null, reason: '没有卡' };
        c.balance = Math.round(((c.balance || 0) + (c.kind === 'credit' ? n : -n)) * 100) / 100;
        const e = note(ownerId, -n, why, 'spend', c, meta);
        await save();
        touched();
        return { ok: true, card: c, rid: e.rid };
    }
    async function earn(ownerId, amt, why, prefer, meta) {
        const n = Math.round((Number(amt) || 0) * 100) / 100;
        if (n <= 0) return null;
        const w = ensureCards(ownerId);
        let c = prefer ? cardOf(ownerId, prefer) : null;
        // 收入优先进储蓄卡；红包进红包格；信用卡上的钱算还款
        if (!c) c = w.cards.find(x => x.kind === 'debit') || w.cards.find(x => x.kind === 'balance') || w.cards[0];
        c.balance = Math.round(((c.balance || 0) + (c.kind === 'credit' ? -n : n)) * 100) / 100;
        note(ownerId, n, why, 'income', c, meta);
        await save();
        touched();
        return c;
    }

    /* ---------- 工作与固定收入（不调 API）----------
       角色的职业和薪水写在钱包这一层，不动角色卡的结构。
       没填职业的角色不发钱——不是每个人都有稳定工作，这本身也是设定。 */
    async function payday() {
        if (!on('walletOn') || !on('walletSalary')) return;
        const today = day();
        for (const c of chars()) {
            const w = walletOf(c.id);
            if (!w.job || !w.job.title) continue;
            const per = Number(w.job.pay) || 0;
            if (per <= 0) continue;
            if (w.lastPayDay === today) continue;
            let cycle = w.job.cycle === 'month' ? 'month' : w.job.cycle === 'self' ? 'self' : 'day';
            let amt = per;
            let why = '';
            if (cycle === 'self') {
                // TA 自己定的那套：没想过就先想一次（一次调用，想完存下来，之后不再花钱）
                if (!w.job.self) { try { await decideSelf(c); } catch (e) {} }
                const sf = w.job.self;
                if (!sf) continue;
                amt = Number(sf.per) || per;
                why = sf.why || '';
                if (sf.mode === 'month') {
                    if (new Date().getDate() !== (Number(sf.payday) || 15)) { w.lastPayDay = ''; continue; }
                } else if (sf.mode === 'week') {
                    if (new Date().getDay() !== (Number(sf.payday) % 7)) { w.lastPayDay = ''; continue; }
                } else if (sf.mode === 'irregular') {
                    // 有活才有钱：大部分日子什么都不进账
                    if (Math.random() > 0.28) { w.lastPayDay = ''; continue; }
                    amt = Math.round(amt * (0.5 + Math.random() * 1.4));
                }
            } else if (cycle === 'month') {
                const dnum = new Date().getDate();
                if (dnum !== (Number(w.job.payday) || 15)) { w.lastPayDay = ''; continue; }
            }
            if (!(amt > 0)) continue;
            w.lastPayDay = today;
            const label = cycle === 'self'
                ? ((w.job.self && w.job.self.label) || '进账') + '（' + w.job.title + '）'
                : (cycle === 'month' ? '发工资' : '当天的工钱') + '（' + w.job.title + '）';
            await earn(c.id, amt, label);
        }
    }

    /* ---------- 让 TA 自己定发薪的节奏 ----------
       "按天/按月"是打工人的两种，可现实里还有一堆：周结的、有活才有钱的、
       月底才结的、拿提成的。与其让你替每个角色猜，不如照着人设让 TA 自己说。
       只在第一次发生（或者你点「重新想一次」）时花一次调用，想完存下来。 */
    let selfBusy = {};
        // 报一下场景：这段生成属于「wallet」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function decideSelf() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('wallet', () => decideSelfInner.apply(null, a));
        return decideSelfInner.apply(null, a);
    }
    async function decideSelfInner(c) {
        const id = String(c.id);
        if (selfBusy[id]) return null;
        const w = walletOf(id);
        if (!w.job || !w.job.title) return null;
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return null;
        selfBusy[id] = true;
        try {
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name + '。' + (c.persona || ''));
            const hint = Number(w.job.pay) > 0 ? `用户填的参考数字是每次 ￥${Number(w.job.pay)}，你可以照着调。` : '用户没填数字，你自己定一个合理的。';
            const ask = `你的职业是「${w.job.title}」。按你的人设和这份工作的实际情况，说说你的钱是怎么进来的。
${hint}
参考现实：有月薪的、有周结的、有做一单结一单的、有月底才拿到的。别都写成月薪。

只输出 JSON，不要解释：
{"mode":"day|week|month|irregular","per":每次到手多少的数字,"payday":按月就写几号(1-28)、按周就写星期几(1-7)、其它写0,"label":"这笔钱在账单上叫什么，6字以内","why":"为什么是这个节奏，20字以内"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t).trim();
            t = t.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            const o = (typeof extractJsonObject === 'function') ? extractJsonObject(t) : JSON.parse(t);
            if (!o || !o.mode) return null;
            const sf = {
                mode: ['day', 'week', 'month', 'irregular'].indexOf(o.mode) >= 0 ? o.mode : 'month',
                per: Math.max(1, Math.round(Number(o.per) || Number(w.job.pay) || 100)),
                payday: Math.max(0, Math.min(28, parseInt(o.payday) || 0)),
                label: String(o.label || '进账').slice(0, 8),
                why: String(o.why || '').slice(0, 30),
                at: Date.now()
            };
            w.job.self = sf;
            await save();
            renderCharWallet();
            return sf;
        } catch (e) { return null; }
        finally { selfBusy[id] = false; }
    }
    // 点了就想（不看开关——全 app 一条规矩：点击就生成）
    window.gyWalletThinkPay = async function (charId) {
        const c = charOf(charId); if (!c) return;
        const w = walletOf(charId);
        if (!w.job || !w.job.title) { toast('先填个职业'); return; }
        toast(c.name + ' 正在想自己的钱怎么进来…');
        const sf = await decideSelf(c);
        toast(sf ? '想好了：' + SELF_TXT(sf) : '没想出来，回头再试');
    };
    const SELF_TXT = sf => !sf ? '' : (
        (sf.mode === 'month' ? '每月 ' + (sf.payday || 15) + ' 号'
         : sf.mode === 'week' ? '每周' + '日一二三四五六'.charAt((sf.payday || 5) % 7)
         : sf.mode === 'day' ? '按天'
         : '有活才有钱')
        + ' · ￥' + sf.per + (sf.label ? ' · ' + sf.label : '') + (sf.why ? '（' + sf.why + '）' : ''));

    /* ---------- 随机账单（生活是随机的）----------
       默认用一张固定的开销表，不调 API。
       打开「让角色自己决定这笔钱花在哪」之后，才会问模型一次，
       拿回来的是一条更像那个人的理由（"给妹妹买了参考书"这种）。 */
    // 日常开销：分了类，好在账单里按类别看，也让流水读起来像真的过日子
    const BILLS = [
        { n: '早饭', t: '吃喝', lo: 5, hi: 18 },      { n: '午饭', t: '吃喝', lo: 12, hi: 40 },
        { n: '一杯咖啡', t: '吃喝', lo: 12, hi: 35 }, { n: '买菜', t: '吃喝', lo: 20, hi: 80 },
        { n: '打车', t: '出行', lo: 10, hi: 45 },     { n: '地铁公交', t: '出行', lo: 2, hi: 12 },
        { n: '加油', t: '出行', lo: 150, hi: 400 },   { n: '话费充值', t: '生活', lo: 30, hi: 100 },
        { n: '水电燃气', t: '生活', lo: 60, hi: 260 },{ n: '房租', t: '生活', lo: 800, hi: 2600 },
        { n: '洗衣', t: '生活', lo: 10, hi: 40 },     { n: '日用品', t: '生活', lo: 15, hi: 90 },
        { n: '看病拿药', t: '医疗', lo: 30, hi: 300 },{ n: '理发', t: '生活', lo: 20, hi: 80 },
        { n: '买书', t: '爱好', lo: 25, hi: 120 },    { n: '看电影', t: '爱好', lo: 35, hi: 90 },
        { n: '给家里寄钱', t: '人情', lo: 200, hi: 1500 },
        { n: '还人钱', t: '人情', lo: 50, hi: 500 },  { n: '随份子', t: '人情', lo: 200, hi: 800 },
        { n: '修东西', t: '生活', lo: 20, hi: 200 }
    ];
    // 随机进账：人不只花钱，也会有零零碎碎的收入
    const LUCKS = [
        { n: '收到红包', t: '人情', lo: 20, hi: 200 },   { n: '朋友还钱', t: '人情', lo: 50, hi: 600 },
        { n: '退款到账', t: '退款', lo: 10, hi: 300 },   { n: '卖了点旧东西', t: '零工', lo: 30, hi: 400 },
        { n: '接了个私活', t: '零工', lo: 100, hi: 1200 },{ n: '稿费', t: '零工', lo: 80, hi: 900 },
        { n: '报销下来了', t: '报销', lo: 50, hi: 800 }, { n: '路上捡到零钱', t: '意外', lo: 1, hi: 20 }
    ];
    async function randomBill() {
        if (!on('walletOn') || !on('walletBills')) return;
        const cs = chars();
        if (!cs.length) return;
        const c = cs[Math.floor(Math.random() * cs.length)];
        const w = ensureCards(c.id);
        const today = day();
        if (w.lastBillDay === today && Math.random() < 0.7) return;   // 一天多笔是可能的，但别刷屏
        w.lastBillDay = today;
        // 房租这种大额一个月最多来一次，不然天天交房租
        const pool = BILLS.filter(x => !(x.n === '房租' && w.lastRentMonth === day().slice(0, 7)));
        const b = pool[Math.floor(Math.random() * pool.length)];
        if (b.n === '房租') w.lastRentMonth = day().slice(0, 7);
        let amt = Math.round((b.lo + Math.random() * Math.max(1, b.hi - b.lo)) * 100) / 100;
        let why = b.n, tag = b.t;
        if (on('walletCharDecide')) {
            const r = await askSpend(c, amt);
            if (r) { why = r.why || why; if (r.amt > 0) amt = r.amt; }   // TA 说花多少就花多少，不封顶
        }
        const res = await pay(c.id, amt, why, '', { tag });
        if (!res.ok) {
            note(c.id, 0, '想花 ￥' + money(amt) + ' 在' + why + '，卡里不够', 'spend', null, { tag });
            await save();
        }
        renderPanel();
    }
    // 随机进账（开关 walletLuck）：红包、还钱、退款、私活……不调 API
    async function randomLuck() {
        if (!on('walletOn') || !on('walletLuck')) return;
        const cs = chars();
        if (!cs.length) return;
        const c = cs[Math.floor(Math.random() * cs.length)];
        ensureCards(c.id);
        const l = LUCKS[Math.floor(Math.random() * LUCKS.length)];
        const amt = Math.round((l.lo + Math.random() * Math.max(1, l.hi - l.lo)) * 100) / 100;
        await earn(c.id, amt, l.n, '', { tag: l.t });
        renderPanel();
    }
        // 报一下场景：这段生成属于「wallet」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function askSpend() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('wallet', () => askSpendInner.apply(null, a));
        return askSpendInner.apply(null, a);
    }
    async function askSpendInner(c, hintAmt) {
        try {
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key) return null;
            const w = walletOf(c.id);
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            const ask = `今天你花了一笔钱。按你的人设、处境和手头的宽裕程度想一件**你真的会花钱的事**——
可以很小（一碗面、一次打车），也可以是这个月绕不开的（房租、给家里寄钱、还人情）。
${w.job && w.job.title ? `你的工作是：${w.job.title}。` : '你没有稳定收入。'}你现在能动的钱大约 ${money(totalOf(c.id))}。
只输出 JSON，不要解释：{"amt": 数字（这笔花了多少，不要带符号）, "why":"花在哪儿，15字以内，你自己的说法"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            if (!r) return null;
            return { amt: Math.max(0, Number(r.amt) || hintAmt), why: String(r.why || '').slice(0, 30) };
        } catch (e) { console.warn('[钱包] 问花在哪儿失败：', e); return null; }
    }

    /* ================= 转账 / 红包卡片 =================
       样子跟包裹卡（快递面单）和邀请卡（两个头像＋一条线）都不一样：
       这里是一张**票据**——上半截金额、下半截一句留言，中间一道齿孔虚线。 */
    function pushMoneyCard(hostId, sender, mo) {
        if (typeof globalChats === 'undefined') return null;
        const sid = String(hostId);
        if (!globalChats[sid]) globalChats[sid] = [];
        globalChats[sid].push({
            sender, type: 'money', money: mo, timestamp: Date.now(), readBy: [],
            text: `［${mo.kind === 'red' ? '红包' : '转账'}］￥${money(mo.amt)}　${nameOf(mo.from)} → ${nameOf(mo.to)}${mo.note ? '　' + mo.note : ''}`
        });
        return mo;
    }
    function findMoney(id) {
        if (typeof globalChats === 'undefined') return null;
        for (const sid in globalChats) {
            const arr = globalChats[sid] || [];
            for (let i = arr.length - 1; i >= 0; i--) {
                const m = arr[i];
                if (m && m.type === 'money' && m.money && m.money.id === id) return { sid, mo: m.money };
            }
        }
        return null;
    }
    function refreshChat(charId) {
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try {
            const open = typeof currentChatSessionId !== 'undefined' && String(currentChatSessionId) === String(charId)
                && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none';
            if (open && typeof renderChatMessages === 'function') renderChatMessages();
            else if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) {}
        renderPanel();
    }

    window.gyMoneyCardHtml = function (msg) {
        const mo = msg.money || {};
        const red = mo.kind === 'red';
        const toMe = String(mo.to) === 'me';
        const st = mo.status;
        // 底下那一条窄边：状态或者两个按钮。收/退只有收款方能点。
        let foot = '';
        if (st === 'pending') {
            foot = toMe
                ? `<div class="gywl-foot acts">
                     <button type="button" class="gywl-b yes" onclick="gyMoneyTake('${mo.id}',true)">${red ? '拆开' : '收下'}</button>
                     <span class="gywl-sep"></span>
                     <button type="button" class="gywl-b" onclick="gyMoneyTake('${mo.id}',false)">退回</button>
                   </div>`
                : `<div class="gywl-foot">等 ${esc(nameOf(mo.to))} 收</div>`;
        } else if (st === 'taken') {
            foot = `<div class="gywl-foot ok">已收${mo.intoCard ? '　·　' + esc(mo.intoCard) : ''}</div>`;
        } else {
            foot = `<div class="gywl-foot no">已退回${mo.line ? '　·　' + esc(mo.line) : ''}</div>`;
        }
        // ⚠️ v108c：这不是居中的一张卡，是**一条谁发出来的消息**——外面那层
        //    .chat-msg-row / .chat-bubble-wrapper 由 js/05 给，左右分边和头像跟普通气泡一致。
        //    单子本身走克制路线：底是卡片色，颜色只落在左边那个小圆章上，
        //    不再整块糊一层橙色渐变（那样在聊天里太抢眼，也压不住深色模式）。
        return `
          <div class="gywl-tx ${red ? 'red' : ''} s-${esc(st)} ${String(mo.from) === 'me' ? 'from-me' : 'from-ta'}">
            <div class="gywl-tx-main">
              <div class="gywl-seal">${red ? '🧧' : '¥'}</div>
              <div class="gywl-tx-txt">
                <div class="gywl-tx-amt">${esc(money(mo.amt))}</div>
                <div class="gywl-tx-memo">${esc(mo.note || (red ? '发了个红包' : '转账'))}</div>
              </div>
            </div>
            ${foot}
          </div>`;
    };

    /* 你发一笔（或者角色发一笔）。钱在发出的那一刻就从付款方扣走，
       退回的时候原路还回去——跟真的转账一样，不是"点收才扣"。 */
    window.gyWallet = {
        cards: ownerId => ensureCards(ownerId).cards.slice(),
        total: totalOf, debt: debtOf, log: id => logOf(id).slice(),
        pay, earn,
        async send({ from = 'me', to, amt, note: memo = '', kind = 'transfer', cardId } = {}) {
            if (!on('walletOn')) return null;
            const n = Math.round((Number(amt) || 0) * 100) / 100;
            if (!to || n <= 0) return null;
            const host = String(from) === 'me' ? String(to) : String(from);
            const r = await pay(from, n, (kind === 'red' ? '发红包给' : '转账给') + nameOf(to), cardId);
            // 不拦：钱不够也照转，付款卡可以透支成负数
            const mo = { id: uid('m_'), kind: kind === 'red' ? 'red' : 'transfer', amt: n, note: String(memo),
                         from: String(from), to: String(to), status: 'pending', at: Date.now(),
                         payCard: r.card ? (r.card.name + ' ·' + r.card.no4) : '', line: '', intoCard: '' };
            pushMoneyCard(host, String(from) === 'me' ? 'me' : from, mo);
            refreshChat(host);
            touched();
            // 发给角色的：TA 自己决定收不收（不额外调 API，用的是收礼那一套的规则：默认收）
            if (String(to) !== 'me') setTimeout(() => askTake(mo.id), 600);
            return mo;
        },
        receipt: id => S.receipts[String(id)] || null,
        // 给别的模块用：记一笔花销/进账，带类别，自动出凭证。
        // 钱包没开就当没发生（返回 {skipped:true}），调用方不用自己判断开关。
        async spend(ownerId, amt, why, meta) {
            if (!on('walletOn')) return { ok: true, skipped: true };
            return await pay(ownerId, amt, why, (meta && meta.card) || '', meta || {});
        },
        async income(ownerId, amt, why, meta) {
            if (!on('walletOn')) return null;
            return await earn(ownerId, amt, why, (meta && meta.card) || '', meta || {});
        },
        // 出门这一趟到底花没花钱、花在哪儿、谁掏的——**整个是随机的**。
        // 现实里出去一趟可能就是散个步什么都没买，也可能一顿饭吃掉两百；
        // 可能各付各的，也可能一方全请了。所以不按时长算、也不按"谁约的谁多担"，
        // 就掷骰子：先掷"这趟有没有花钱"，有的话再掷花在哪几项、谁掏。
        async outing({ charId, spot, mins }) {
            if (!on('walletOn') || !on('walletOuting')) return null;
            // ① 一定概率就是出去走走、一分钱没花（默认 30%，在钱包页里可调）
            const freeP = Math.max(0, Math.min(100, Number(S.settings.outingFreePct))) / 100;
            if (Math.random() < (isNaN(freeP) ? 0.3 : freeP)) return { total: 0, nothing: true };
            // ② 随机拿一到三样"这趟花在哪儿"
            const POOL = [
                { n: '往返车费', lo: 4, hi: 40 },   { n: '路上买了瓶水', lo: 3, hi: 8 },
                { n: '吃了一顿', lo: 25, hi: 180 }, { n: '喝了杯咖啡', lo: 15, hi: 40 },
                { n: '门票', lo: 20, hi: 120 },     { n: '买了点小东西', lo: 10, hi: 90 },
                { n: '停车费', lo: 5, hi: 30 },     { n: '看了场电影', lo: 60, hi: 120 },
                { n: '路边摊', lo: 8, hi: 45 }
            ];
            const pool = POOL.slice();
            const items = [];
            const k = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < k && pool.length; i++) {
                const x = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
                items.push({ n: x.n, p: Math.round((x.lo + Math.random() * (x.hi - x.lo)) * 100) / 100 });
            }
            const total = Math.round(items.reduce((a2, x) => a2 + x.p, 0) * 100) / 100;
            // ③ 谁掏。默认是随机三选一，但你可以在钱包页里钉死成某一种；
            //    选「按好感度」的话，越熟越可能是 TA 请或者各付各的——
            //    刚认识的时候谁主动谁掏，熟了之后才会有"这顿我来"和"各付各的"。
            const mode = S.settings.outingPayer || 'random';
            let who;
            if (mode === 'me' || mode === 'ta' || mode === 'aa') {
                who = mode;
            } else if (mode === 'rel') {
                let sc = 0;
                try { if (window.gyRel && typeof window.gyRel.score === 'function') sc = Number(window.gyRel.score(charId)) || 0; } catch (e) {}
                const r = Math.random();
                if (sc >= 50) who = r < 0.35 ? 'me' : r < 0.7 ? 'ta' : 'aa';        // 亲近：谁掏都自然
                else if (sc >= 20) who = r < 0.45 ? 'me' : r < 0.75 ? 'ta' : 'aa';  // 熟人
                else who = r < 0.7 ? 'me' : r < 0.85 ? 'ta' : 'aa';                 // 还不熟：多半你请
            } else if (mode === 'self') {
                /* 让 TA 自己决定：照人设 + 关系 + 兜里有多少钱来掷。
                   本地算，不调 API——抢着买单这件事跟性格的关系比跟当天心情大得多：
                   要面子/大方/宠着你的人抢着付；抠门/计较/穷学生那一挂多半 AA；
                   兜里真没钱的时候，再大方也只能你来。 */
                const c = charOf(charId) || {};
                const per = String(c.persona || '') + ' ' + String(c.bio || '');
                let w = { me: 34, ta: 33, aa: 33 };
                const bump = (k, n) => { w[k] += n; };
                if (/大方|豪爽|阔绰|不差钱|富|少爷|老板|宠|惯着|护短|要面子|好面子|讲究/.test(per)) { bump('ta', 40); bump('me', -18); }
                if (/抠|吝啬|节俭|省|计较|穷|拮据|清贫|学生|打工/.test(per)) { bump('aa', 30); bump('ta', -22); }
                if (/独立|界限|分寸|不欠人情|生分|见外|客气/.test(per)) { bump('aa', 35); bump('ta', -15); }
                if (/傲|冷|不屑|懒得/.test(per)) { bump('me', 12); }
                try {
                    const sc = (window.gyRel && typeof window.gyRel.score === 'function') ? (Number(window.gyRel.score(charId)) || 0) : 0;
                    if (sc >= 50) { bump('ta', 18); bump('aa', -8); }        // 亲近的更愿意请
                    else if (sc < 20) { bump('me', 18); bump('ta', -12); }   // 还不熟，多半你请
                } catch (e) {}
                if (totalOf(charId) < total) { w.ta = 0; bump('me', 25); }   // TA 真掏不出来
                const sum = Math.max(1, w.me + w.ta + w.aa);
                const r = Math.random() * sum;
                who = r < w.me ? 'me' : r < w.me + w.ta ? 'ta' : 'aa';
            } else {
                who = ['me', 'ta', 'aa'][Math.floor(Math.random() * 3)];
            }
            const taName = (typeof userDisplayName === 'function') ? userDisplayName(charOf(charId)) : '对方';
            const label = m => (m ? '和' + nameOf(charId) : '和' + taName) + '去「' + spot + '」';
            const meta = extra => Object.assign({ tag: '出行', shop: spot }, extra);
            let mine = 0, his = 0;
            if (who === 'me') {
                mine = total;
                await pay('me', total, label(true) + '（我请）', '', meta({ items }));
            } else if (who === 'ta') {
                his = total;
                await pay(charId, total, label(false) + '（我请）', '', meta({ items }));
            } else {
                mine = Math.round(total / 2 * 100) / 100;
                his = Math.round((total - mine) * 100) / 100;
                const half = items.map(x => ({ n: x.n + '（AA）', p: Math.round(x.p / 2 * 100) / 100 }));
                await pay('me', mine, label(true) + '（AA）', '', meta({ items: half }));
                await pay(charId, his, label(false) + '（AA）', '', meta({ items: half }));
            }
            renderPanel();
            return { total, mine, his, who, items };
        },
        // 商城下单时调这个：扣钱 + 出小票。返回 {ok:false} ＝ 钱不够，别让这单成立
        async charge(ownerId, amount, label, orderId, prefer) {
            if (!on('walletOn')) return { ok: true, skipped: true };
            const n = Math.round((Number(amount) || 0) * 100) / 100;
            const r = await pay(ownerId, n, '买' + label, prefer, { tag: '购物', shop: '白露商城' });
            if (!r.ok) return { ok: false };
            if (on('walletReceipt')) {
                // 商城那张按订单 id 也存一份（订单详情里按订单号取），内容跟流水里那张一致
                S.receipts[String(orderId)] = Object.assign({}, S.receipts[r.rid] || {}, {
                    no: 'R' + String(Date.now()).slice(-10), at: Date.now(), sign: -1,
                    who: String(ownerId), label: String(label), amount: n,
                    shop: '白露商城', tag: '购物',
                    method: r.card ? kindOf(r.card.kind).name : '未知',
                    card: r.card ? (r.card.name + ' ****' + r.card.no4) : ''
                });
                await save();
            }
            return { ok: true, card: r.card, rid: r.rid };
        }
    };
    window.gyMoneyTake = async function (id, yes) { await settleMoney(id, !!yes, ''); };
    async function settleMoney(id, yes, line) {
        const f = findMoney(id);
        if (!f) return;
        const mo = f.mo;
        if (mo.status !== 'pending') return;
        mo.status = yes ? 'taken' : 'refused';
        mo.line = line || mo.line;
        if (yes) {
            const w = ensureCards(mo.to);
            const into = mo.kind === 'red' ? (w.cards.find(c => c.kind === 'redpacket') || w.cards[0]) : null;
            const c = await earn(mo.to, mo.amt, (mo.kind === 'red' ? '收到红包 · ' : '收到转账 · ') + nameOf(mo.from), into ? into.id : '');
            mo.intoCard = c ? (c.name + ' ·' + c.no4) : '钱包';
        } else {
            await earn(mo.from, mo.amt, '退回的' + (mo.kind === 'red' ? '红包' : '转账'));
        }
        await save();
        refreshChat(f.sid);
        touched();
    }
    // 角色收不收：**不额外调 API**，一律收下。
    // 以前金额"大得离谱"会被写死的规则自动退回（'太多了，我不能收。'）——那是个偷偷的上限，删了。
    async function askTake(id) {
        const f = findMoney(id);
        if (!f) return;
        const mo = f.mo;
        if (mo.status !== 'pending') return;
        await settleMoney(id, true, '');
    }

    /* ================= 小票 ================= */
    // 任何一笔都能出凭证：商城买的是购物小票，外卖是外卖单，
    // 转账/工资/日常开销是一张"收支凭证"，长得一样，只是抬头和明细不同。
    window.gyReceiptHtml = function (id) {
        const r = S.receipts[String(id)];
        if (!r) return '';
        const t = new Date(r.at);
        const pad = n => String(n).padStart(2, '0');
        const income = r.sign === 1;
        const items = Array.isArray(r.items) && r.items.length ? r.items : [{ n: r.label, p: r.amount }];
        const sum = items.reduce((a, x) => a + (Number(x.p) || 0), 0) || r.amount;
        return `
        <div class="gyrc">
          <div class="gyrc-head">
            <div class="gyrc-shop">${esc(r.shop || (income ? '收款凭证' : '白露商城'))}</div>
            <div class="gyrc-sub">${income ? 'CREDIT NOTE' : 'SALES RECEIPT'}</div>
          </div>
          <div class="gyrc-line"></div>
          <div class="gyrc-kv"><span>单号</span><b>${esc(r.no)}</b></div>
          <div class="gyrc-kv"><span>时间</span><b>${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}</b></div>
          <div class="gyrc-kv"><span>${income ? '收款人' : '付款人'}</span><b>${esc(nameOf(r.who))}</b></div>
          ${r.tag ? `<div class="gyrc-kv"><span>类别</span><b>${esc(r.tag)}</b></div>` : ''}
          <div class="gyrc-line dash"></div>
          ${items.map(x => `<div class="gyrc-kv item"><span>${esc(x.n)}${x.q > 1 ? ' ×' + x.q : ''}</span><b>￥${esc(money(x.p))}</b></div>`).join('')}
          <div class="gyrc-line dash"></div>
          <div class="gyrc-kv total"><span>${income ? '实收' : '合计'}</span><b>￥${esc(money(sum))}</b></div>
          <div class="gyrc-kv"><span>${income ? '入账' : '支付方式'}</span><b>${esc(r.method)}</b></div>
          ${r.card ? `<div class="gyrc-kv"><span>卡号</span><b>${esc(r.card)}</b></div>` : ''}
          <div class="gyrc-line"></div>
          <div class="gyrc-foot">${income ? '此凭证仅作留念' : '谢谢惠顾 · 此小票仅作留念'}</div>
        </div>`;
    };

    /* ================= 面板（我的资料 → 我的钱包）================= */
    window.gyWalletPanel = function () {
        const box = document.getElementById('upWalletBox');
        if (!box) return;
        if (!on('walletOn')) {
            box.innerHTML = `<div class="form-hint">
                钱包系统现在是<b>关着</b>的：商城不扣钱、不出小票、聊天里也没有转账卡。<br>
                去 设置 → ⚙️ 自动化功能 → 💰 钱包 打开「钱包与转账」这一项。
                </div>
                <button type="button" class="btn-secondary" onclick="gyWalletOn()">直接打开钱包系统</button>`;
            return;
        }
        ensureCards('me');
        const w = walletOf('me');
        const p0 = v => (S.settings.outingPayer || 'random') === v ? ' selected' : '';
        box.innerHTML = `
            <div class="form-hint">买东西真的扣钱，转账要对方点收。这里的卡和余额只属于你，角色各有各的。<br>每张卡上的 ✏️ 可以直接改余额/额度；钱不够也照样能付，只是余额会变成负数。</div>
            <div class="gywl-sum">
                <div><em>可用</em><b>￥${money(totalOf('me'))}</b></div>
                <div><em>欠款</em><b class="bad">￥${money(debtOf('me'))}</b></div>
            </div>
            <label style="font-size:15px;margin-top:12px;">我的卡</label>
            <div class="gywl-cards">${w.cards.map(c => cardHtml('me', c, w.defaultCard === c.id)).join('')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0;">
                ${Object.keys(KINDS).map(k => `<button type="button" class="btn-edit-small" onclick="gyWalletAddCard('me','${k}')">＋${KINDS[k].ico} ${KINDS[k].name}</button>`).join('')}
            </div>
            <button type="button" class="gywl-billbtn" onclick="gyBillOpen('me')">
                <span>🧾 账单</span>
                <em>按年月看收支，点任意一笔看凭证</em>
                <i>›</i>
            </button>
            <label style="font-size:15px;margin-top:16px;">🚕 出门那一趟</label>
            <div class="form-hint" style="margin-bottom:8px;">
                「行程与天气」里约成一次出门时怎么记账。开关在 设置 → ⚙️ 自动化功能 → 💰 钱包 →「出门会花钱」。<br>
                选「让 TA 自己决定」的话：要面子/大方的抢着付，计较/讲分寸的多半 AA，兜里真没钱的时候还是你来。本地算，不调 API。
            </div>
            <div class="gywl-set">
                <span>谁掏钱</span>
                <select onchange="gyWalletSet('outingPayer', this.value)">
                    <option value="random"${p0('random')}>随机（我请 / TA 请 / 各付各的，三选一）</option>
                    <option value="me"${p0('me')}>一直我请</option>
                    <option value="ta"${p0('ta')}>一直 TA 请</option>
                    <option value="aa"${p0('aa')}>一直各付各的</option>
                    <option value="rel"${p0('rel')}>按好感度定（越熟越可能 TA 请或 AA）</option>
                    <option value="self"${p0('self')}>让 TA 自己决定（按人设 + 关系 + 兜里有多少）</option>
                </select>
            </div>
            <div class="gywl-set">
                <span>什么都没花的概率　<b id="gywlFreeLab">${Number(S.settings.outingFreePct)}%</b></span>
                <input type="range" min="0" max="100" step="5" value="${Number(S.settings.outingFreePct)}"
                    oninput="document.getElementById('gywlFreeLab').innerText=this.value+'%'"
                    onchange="gyWalletSet('outingFreePct', parseInt(this.value))">
            </div>
            <div class="form-hint" style="margin-top:4px;">
                调到 0 就是每次出门都要花钱；调高就更常出现"就是出去走走，什么都没买"。
            </div>`;
    };
    function cardHtml(ownerId, c, isDef) {
        const K = kindOf(c.kind);
        return `<div class="gywl-cd k-${esc(c.kind)}${isDef ? ' def' : ''}" onclick="gyWalletDefault('${ownerId}','${c.id}')" title="点一下设成默认付款方式">
            <div class="gywl-cd-top">${K.ico} ${esc(c.name)}${isDef ? '<i>默认</i>' : ''}</div>
            <div class="gywl-cd-no">**** **** **** ${esc(c.no4)}</div>
            <div class="gywl-cd-bal">${c.kind === 'credit'
                ? `已用 ￥${money(c.balance)} / 额度 ￥${money(c.limit)}`
                : `￥${money(c.balance)}`}</div>
            <button type="button" class="btn-edit-small" style="margin-top:6px;" onclick="event.stopPropagation();gyWalletEditCard('${ownerId}','${c.id}')">✏️ ${c.kind === 'credit' ? '改额度/已用' : '改余额'}</button>
        </div>`;
    }
    /* ✏️ 改卡里的钱：起始金额是死的、钱不够又不能自己往里充——所以每张卡都能直接改数。
       储蓄卡/余额/红包改余额（可以填负数＝透支）；信用卡改额度和已用。不设任何上下限。 */
    window.gyWalletEditCard = async function (ownerId, cardId) {
        const c = cardOf(ownerId, cardId);
        if (!c) return;
        // 用 app 自己的输入框（appPrompt，js/12）：原生 prompt() 打包成 exe 之后是死的
        const ask = async (msg, v) => { const t = (typeof appPrompt === 'function') ? await appPrompt(msg, String(v)) : null; if (t === null || t === undefined) return null; const x = parseFloat(String(t).replace(/[,，￥¥\s]/g, '')); return isFinite(x) ? Math.round(x * 100) / 100 : null; };
        if (c.kind === 'credit') {
            const lim = await ask('「' + c.name + '」的信用额度改成多少？', c.limit || 0);
            if (lim !== null) c.limit = lim;
            const used = await ask('已经用了（欠了）多少？', c.balance || 0);
            if (used !== null) c.balance = used;
        } else {
            const b = await ask('「' + c.name + '」里现在有多少钱？', c.balance || 0);
            if (b === null) return;
            c.balance = b;
        }
        await save();
        try { gyWalletPanel(); } catch (e) {}
        touched();
    };
    /* ================= 🧾 账单 =================
       以前这儿是一列"最近的钱都去哪儿了"，翻不了历史、也点不开细节。
       现在是一个真正的账单：选年月 → 看这个月的收入/支出/结余 → 按天分组列出每一笔
       → 点任意一笔弹出那一笔的凭证（商城买的东西就是那张购物小票）。 */
    let billWho = 'me', billYM = '';
    const ymOf = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    function billMonths(ownerId) {
        const set = new Set(logOf(ownerId).map(x => ymOf(x.at)));
        const cur = ymOf(Date.now());
        set.add(cur);
        return [...set].sort().reverse();
    }
    window.gyBillOpen = function (ownerId) {
        billWho = String(ownerId || 'me');
        billYM = billYM && billMonths(billWho).includes(billYM) ? billYM : (billMonths(billWho)[0] || ymOf(Date.now()));
        let ov = document.getElementById('gyBillModal');
        if (!ov) { ov = document.createElement('div'); ov.id = 'gyBillModal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
        ov.style.display = 'flex';
        gyBillRender();
    };
    window.gyBillClose = function () { const o = document.getElementById('gyBillModal'); if (o) o.style.display = 'none'; };
    window.gyBillMonth = function (ym) { billYM = ym; gyBillRender(); };
    window.gyBillRender = function () {
        const ov = document.getElementById('gyBillModal');
        if (!ov) return;
        const all = logOf(billWho);
        const rows = all.filter(x => ymOf(x.at) === billYM);
        const income = rows.filter(x => x.amt > 0).reduce((a, x) => a + x.amt, 0);
        const spend = rows.filter(x => x.amt < 0).reduce((a, x) => a - x.amt, 0);
        // 按天分组，天内按时间倒序
        const byDay = {};
        rows.forEach(x => { const k = day(x.at); (byDay[k] = byDay[k] || []).push(x); });
        const days = Object.keys(byDay).sort().reverse();
        const months = billMonths(billWho);
        const [yy, mm] = billYM.split('-');
        const list = days.map(d => {
            const dd = new Date(d + 'T00:00:00');
            const din = byDay[d].filter(x => x.amt > 0).reduce((a, x) => a + x.amt, 0);
            const dout = byDay[d].filter(x => x.amt < 0).reduce((a, x) => a - x.amt, 0);
            return `<div class="gybl-day">
                <div class="gybl-day-hd"><b>${dd.getMonth() + 1}月${dd.getDate()}日</b>
                    <span>${din ? '收 ￥' + money(din) : ''}${din && dout ? '　' : ''}${dout ? '支 ￥' + money(dout) : ''}</span></div>
                ${byDay[d].map(x => `
                <div class="gybl-row" onclick="gyBillReceipt('${x.rid || ''}')">
                    <div class="gybl-ico ${x.amt >= 0 ? 'in' : 'out'}">${x.amt >= 0 ? '↓' : '↑'}</div>
                    <div class="gybl-mid">
                        <div class="gybl-why">${esc(x.why)}</div>
                        <div class="gybl-sub">${new Date(x.at).toTimeString().slice(0, 5)}${x.card ? '　·　' + esc(x.card) : ''}${x.tag ? '　·　' + esc(x.tag) : ''}</div>
                    </div>
                    <b class="gybl-amt ${x.amt >= 0 ? 'in' : 'out'}">${x.amt >= 0 ? '+' : '−'}${money(Math.abs(x.amt))}</b>
                </div>`).join('')}
            </div>`;
        }).join('');
        ov.innerHTML = `<div class="modal-box gybl" style="width:94%;max-width:420px;max-height:86vh;display:flex;flex-direction:column;">
            <div class="gybl-top">
                <h3 style="margin:0;">🧾 ${esc(nameOf(billWho))}的账单</h3>
                <span style="cursor:pointer;font-size:20px;color:#8b98a5;" onclick="gyBillClose()">×</span>
            </div>
            <select class="gybl-pick" onchange="gyBillMonth(this.value)">
                ${months.map(m => { const [a, b] = m.split('-'); return `<option value="${m}"${m === billYM ? ' selected' : ''}>${a} 年 ${parseInt(b)} 月</option>`; }).join('')}
            </select>
            <div class="gybl-sum">
                <div><em>收入</em><b class="in">￥${money(income)}</b></div>
                <div><em>支出</em><b class="out">￥${money(spend)}</b></div>
                <div><em>结余</em><b class="${income - spend >= 0 ? 'in' : 'out'}">￥${money(income - spend)}</b></div>
            </div>
            <div class="gybl-list">${list || `<div class="gybl-empty">${yy} 年 ${parseInt(mm)} 月没有任何收支。</div>`}</div>
            <div id="gyBillRc"></div>
        </div>`;
    };
    // 点一笔 → 弹出那一笔的凭证（商城买的就是那张购物小票）
    window.gyBillReceipt = function (rid) {
        const host = document.getElementById('gyBillRc');
        if (!host) return;
        if (!rid || !S.receipts[rid]) { host.innerHTML = '<div class="gybl-empty">这一笔没有留下凭证。</div>'; return; }
        if (host.getAttribute('data-rid') === rid) { host.innerHTML = ''; host.removeAttribute('data-rid'); return; }
        host.setAttribute('data-rid', rid);
        host.innerHTML = window.gyReceiptHtml(rid);
        try { host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    };
    window.gyWalletOn = function () {
        try { if (typeof setAutoFeature === 'function') setAutoFeature('walletOn', true); } catch (e) {}
        gyWalletPanel();
    };
    window.gyWalletAddCard = async function (ownerId, kind) {
        const w = ensureCards(ownerId);
        w.cards.push(newCard(kind, '', kind === 'credit' ? 5000 : 0));
        await save(); gyWalletPanel(); renderPanel();
    };
    // 资料页 ⋮ 里的「钱包与工作」——点了把资料页上那块钱包展开并滚过去
    function addProfileMenu() {
        try {
            if (typeof window.gyProfMenuAdd !== 'function') return;
            window.gyProfMenuAdd({
                id: 'wallet', icon: '💳', label: '钱包与工作', sub: '余额、银行卡、职业、账单',
                show: id => on('walletOn') && id && String(id) !== 'me' && !!charOf(id),
                run: id => window.gyWalletGotoChar(id)
            });
        } catch (e) {}
    }
    // 从我的钱包页跳到某个角色的资料页，并把钱包那一块展开
    window.gyWalletGotoChar = function (charId) {
        profOpen = true;
        try { if (typeof closeModal === 'function') closeModal('userProfileModal'); } catch (e) {}
        try { if (typeof switchMainView === 'function') switchMainView('profile', String(charId)); } catch (e) {}
        setTimeout(() => { try { window.gyWalletProfOpen(charId); } catch (e) {} }, 150);   // 钱包现在是个弹窗
        setTimeout(() => { try { const b = document.getElementById('gywlProfBox'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 420);
    };
    window.gyWalletSet = async function (k, v) {
        S.settings[k] = v;
        await save();
        if (k === 'outingPayer') gyWalletPanel();   // 重画一次让下拉框停在新选项上
    };
    window.gyWalletDefault = async function (ownerId, cardId) {
        walletOf(ownerId).defaultCard = cardId;
        await save(); gyWalletPanel(); renderPanel();
    };
    // 钱一动（进账/出账）就把开着的钱包面板重画一遍，再告诉别的面板"钱包变了"
    function touched() {
        try { renderPanel(); } catch (e) {}
        try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged('wallet'); } catch (e) {}
    }
    function renderPanel() {
        try { if (document.getElementById('upWalletBox') && document.getElementById('upPanel-wallet')
            && document.getElementById('upPanel-wallet').style.display !== 'none') gyWalletPanel(); } catch (e) {}
        try { renderCharWallet(); } catch (e) {}
    }

    /* ================= 角色那边的钱包（记忆总览里）================= */
    let profOpen = true;   // 现在收在资料页 ⋮ 菜单里、打开就是一个弹窗，里面直接展开
    window.gyWalletProfToggle = function () { profOpen = !profOpen; renderCharWallet(); };
    function profileHtml(charId) {
        ensureCards(charId);
        const w = walletOf(charId);
        const c = charOf(charId) || {};
        const job = (w.job && w.job.title) ? w.job.title : '';
        const autoMode = (typeof getCharActMode === 'function') && getCharActMode(c) === 'auto';
        const taRow = `
          <div class="gywl-prof-self" style="margin-bottom:10px;">
            <div>${w.taSet ? '🎲 这份钱包是 TA 自己定的' + (w.taSet.why ? '：' + esc(w.taSet.why) : '') + '（' + new Date(w.taSet.at).toLocaleDateString('zh-CN') + '）'
                : (autoMode ? '🎲 TA 是「自己决定」模式：打开这里时 TA 会按人设自己定职业、收入、卡里有多少钱。' : '想让 TA 按自己的人设定职业、收入、各张卡里有多少钱？')}</div>
            <button type="button" class="btn-edit-small" onclick="gyWalletTaDecide('${charId}')">${w.taSet ? '让 TA 重新定一次' : '🎲 让 TA 自己定'}</button>
          </div>`;
        return `
          <div class="gywl-prof-hd" onclick="gyWalletProfToggle()">
            <span class="gywl-prof-ico">💳</span>
            <div class="gywl-prof-t">
              <b>钱包与工作</b>
              <em>${job ? esc(job) : '还没填职业'}　·　可用 ￥${money(totalOf(charId))}${debtOf(charId) > 0 ? '　·　欠 ￥' + money(debtOf(charId)) : ''}</em>
            </div>
            <span class="gywl-prof-ch">${profOpen ? '收起' : '展开'} ›</span>
          </div>
          ${profOpen ? `
          <div class="gywl-prof-b">
            ${taRow}
            <div class="gywl-sum">
              <div><em>可用</em><b>￥${money(totalOf(charId))}</b></div>
              <div><em>欠款</em><b class="bad">￥${money(debtOf(charId))}</b></div>
            </div>
            <div class="gywl-prof-job">
              <input type="text" id="gywlJobTitle" placeholder="职业，例：县政府办公室科员" value="${esc(job)}">
              <input type="number" id="gywlJobPay" placeholder="薪水" value="${(w.job && w.job.pay) || ''}">
              <select id="gywlJobCycle">
                <option value="day"${(w.job && w.job.cycle) === 'day' || !(w.job && w.job.cycle) ? ' selected' : ''}>按天</option>
                <option value="month"${(w.job && w.job.cycle) === 'month' ? ' selected' : ''}>按月</option>
                <option value="self"${(w.job && w.job.cycle) === 'self' ? ' selected' : ''}>让 TA 按人设自己定</option>
              </select>
              <button type="button" class="btn-edit-small" onclick="gyWalletSaveJob('${charId}')">保存</button>
            </div>
            ${(w.job && w.job.cycle === 'self') ? `
            <div class="gywl-prof-self">
              <div>${w.job.self ? '🗓️ TA 自己定的：' + esc(SELF_TXT(w.job.self)) : '还没想过——保存之后 TA 会自己想一次（花一次调用），也可以现在就点。'}</div>
              <button type="button" class="btn-edit-small" onclick="gyWalletThinkPay('${charId}')">${w.job.self ? '重新想一次' : '让 TA 现在想'}</button>
            </div>` : ''}
            <div class="gywl-prof-hint">填了职业和薪水，TA 就会按天（或到发薪日）自动进账。没填的不发工资——不是每个人都有稳定收入。<br>
              选「让 TA 按人设自己定」的话，节奏和金额由 TA 自己说了算：可能是月薪、周结、也可能是有活才有钱——上面那个数字只当参考。</div>
            <div class="gywl-cards">${w.cards.map(x => cardHtml(charId, x, w.defaultCard === x.id)).join('')}</div>
            <button type="button" class="gywl-billbtn" onclick="gyBillOpen('${charId}')">
              <span>🧾 ${esc(c.name || 'TA')}的账单</span><em>按年月看收支，点任意一笔看凭证</em><i>›</i>
            </button>
          </div>` : ''}`;
    }

    window.gyWalletSaveJob = async function (charId) {
        const t = (document.getElementById('gywlJobTitle') || {}).value || '';
        const p = parseFloat((document.getElementById('gywlJobPay') || {}).value) || 0;
        const cy = (document.getElementById('gywlJobCycle') || {}).value || 'day';
        const w0 = walletOf(charId);
        const same = w0.job && w0.job.cycle === cy && w0.job.title === t.trim();
        w0.job = t.trim() ? { title: t.trim(), pay: p, cycle: cy, payday: 15,
                              self: (same && w0.job) ? w0.job.self : null } : null;
        await save();
        // 选了"自己定"又还没想过：这就去想一次
        if (w0.job && cy === 'self' && !w0.job.self) { try { decideSelf(charOf(charId)); } catch (e) {} }
        try { if (typeof showToast === 'function') showToast('', '💳 钱包', t.trim() ? '记下了：' + t.trim() : '清掉了职业', null, null, false); } catch (e) {}
        renderCharWallet();
    };
    /* ⚠️ 角色的钱包只有一份实现：上面那个可展开收起的 profileHtml，
       挂在 TA 的个人资料页上（简介下面）。别再加第二份——加过一次，
       结果两块钱包同时出现在资料页上。 */
    // 💳 以前钱包直接铺在资料页简介下面，占一大块。现在收进资料页右上角的 ⋮ 菜单，点开是一个弹窗。
    function renderCharWallet() {
        const old = document.getElementById('gywlProfBox'); if (old) old.remove();
        const m = document.getElementById('gywlProfModal');
        if (!m) return;
        const id = m.dataset.charId;
        if (!id || !charOf(id) || !on('walletOn')) { m.remove(); return; }
        const body = m.querySelector('.gywl-prof');
        if (body) body.innerHTML = profileHtml(id);
    }
    window.gyWalletProfOpen = function (charId) {
        const c = charOf(charId); if (!c) return;
        let m = document.getElementById('gywlProfModal');
        if (m) m.remove();
        m = document.createElement('div');
        m.id = 'gywlProfModal'; m.className = 'modal-overlay'; m.style.display = 'flex'; m.style.zIndex = '3100';
        m.dataset.charId = String(charId);
        m.innerHTML = `<div class="modal-box" style="width:520px; max-width:94vw; max-height:88vh; overflow-y:auto;">
            <h2 style="margin-top:0;">💳 ${esc(c.name)} 的钱包</h2>
            <div class="gywl-prof"></div>
            <div style="text-align:right; margin-top:12px;"><button type="button" class="btn-cancel" onclick="document.getElementById('gywlProfModal').remove()">关闭</button></div>
          </div>`;
        m.addEventListener('click', ev => { if (ev.target === m) m.remove(); });
        document.body.appendChild(m);
        profOpen = true;
        renderCharWallet();
        // 「TA 自己决定」模式、还没定过：打开就让 TA 定
        try { if (typeof getCharActMode === 'function' && getCharActMode(c) === 'auto' && !walletOf(charId).taSet) window.gyWalletTaDecide(charId, true); } catch (e) {}
    };

    // 🎲 让 TA 自己定钱包：职业、收入节奏、各张卡里有多少钱、信用额度
    const taBusy = {};
    window.gyWalletTaDecide = async function (charId, quiet) {
        const c = charOf(charId); if (!c) return;
        const id = String(charId);
        if (taBusy[id]) return; taBusy[id] = true;
        try {
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key) { if (!quiet) toast('还没配 API'); return; }
            if (!quiet) toast(c.name + ' 正在想自己的钱包…');
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name + '。' + (c.persona || ''));
            const ask = `按你的人设、身份、年龄和生活处境，说说你现在的经济状况——像真人一样，别凑整数，别都是有钱人也别都是穷光蛋。
只输出 JSON，不要解释：
{"job":"职业，没有固定工作就写空字符串","mode":"day|week|month|irregular（钱怎么进来）","per":每次到手多少,"payday":按月写几号、按周写星期几、其它写0,
 "debit":储蓄卡里现在有多少,"cash":手机零钱/现金有多少,"creditLimit":信用卡额度（没有信用卡写0）,"owe":信用卡已经欠了多少,
 "why":"一句话说说你的经济状况，20字以内，你自己的口气"}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const d = await callChatCompletionAPI(api, msgs);
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof extractAfterFinalMarker === 'function') t = extractAfterFinalMarker(t).trim();
            const o = (typeof parseModelJson === 'function') ? parseModelJson(t) : ((typeof extractJsonObject === 'function') ? extractJsonObject(t) : null);
            if (!o) { if (!quiet) toast('没想出来，回头再试'); return; }
            const n = v => { const x = Number(v); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; };
            const w = ensureCards(id);
            const byKind = k => w.cards.find(x => x.kind === k);
            const deb = byKind('debit'), cash = byKind('balance'), cr = byKind('credit');
            if (deb) deb.balance = n(o.debit);
            if (cash) cash.balance = n(o.cash);
            if (cr) { cr.limit = n(o.creditLimit); cr.balance = Math.min(cr.limit, n(o.owe)); }
            const job = String(o.job || '').trim().slice(0, 30);
            if (job) {
                const mode = ['day', 'week', 'month', 'irregular'].indexOf(o.mode) >= 0 ? o.mode : 'month';
                w.job = { title: job, pay: n(o.per), cycle: 'self', payday: 15,
                          self: { mode, per: Math.max(1, Math.round(n(o.per) || 1)), payday: Math.max(0, Math.min(28, parseInt(o.payday) || 0)), label: '进账', why: '', at: Date.now() } };
            } else w.job = null;
            w.taSet = { at: Date.now(), why: String(o.why || '').slice(0, 40) };
            await save();
            renderCharWallet();
            if (!quiet) toast('定好了' + (w.taSet.why ? '：' + w.taSet.why : ''));
        } catch (e) { console.warn('[钱包] TA 自己定失败：', e); if (!quiet) toast('没想出来，回头再试'); }
        finally { taBusy[id] = false; }
    };
    function hookProfile() {
        try {
            if (typeof window.gyProfMenuAdd === 'function') window.gyProfMenuAdd({
                id: 'wallet', icon: '💳', label: '钱包与工作', sub: '卡、收入、账单',
                show: id => on('walletOn') && id && String(id) !== 'me' && !!charOf(id),
                run: id => window.gyWalletProfOpen(id)
            });
        } catch (e) {}
        try {
            const f = window.renderProfilePage;
            if (typeof f !== 'function' || f.__gywlPatched) return;
            window.renderProfilePage = function () {
                const r = f.apply(this, arguments);
                try { setTimeout(renderCharWallet, 0); } catch (e) {}
                return r;
            };
            window.renderProfilePage.__gywlPatched = true;
        } catch (e) { console.warn('[钱包] 挂资料页失败：', e); }
    }

    /* ---------- prompt 注入：TA 知道自己兜里有多少钱 ---------- */
    window.__gyWalletCtxFor = function (charId) {
        try {
            if (!on('walletOn')) return '';
            const w = S.chars[String(charId)];
            if (!w || !Array.isArray(w.cards) || !w.cards.length) return '';
            const t = totalOf(charId), d = debtOf(charId);
            const recent = logOf(charId).slice(0, 3).map(x => `· ${x.amt >= 0 ? '进' : '出'} ￥${money(Math.abs(x.amt))}　${x.why}`).join('\n');
            return `\n【你的钱】：手头能动的大约 ￥${money(t)}${d > 0 ? `，另外信用卡上还欠着 ￥${money(d)}` : ''}。` +
                (w.job && w.job.title ? `你靠「${w.job.title}」挣钱。` : '你没有稳定收入。') +
                (recent ? `\n最近几笔：\n${recent}` : '') +
                `\n这是真的账，不是设定——手头紧的时候别装大方，宽裕的时候也不用刻意哭穷。不用主动报数字。\n`;
        } catch (e) { return ''; }
    };

    /* ---------- 心跳 ---------- */
    let beat = null;
    function startBeat() {
        if (beat) return;
        beat = setInterval(async () => {
            if (!on('walletOn')) return;
            try { await payday(); } catch (e) {}
            try { if (Math.random() < 0.25) await randomBill(); } catch (e) {}
            try { if (Math.random() < 0.10) await randomLuck(); } catch (e) {}
        }, 5 * 60 * 1000);
    }

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
                && !AUTO_FEATURE_GROUPS.some(g => g.key === '钱包')) {
                AUTO_FEATURE_GROUPS.push({ key: '钱包', icon: '💰', title: '钱包与转账',
                    note: '给"钱"这件事一个真实的重量：买东西真的扣钱，转账要对方点收，角色有工作就有收入。整组默认关着，不打开的话商城和聊天跟以前一模一样。' });
            }
            const defs = [
                { key: 'walletOn', label: '钱包与转账（总开关）',
                  desc: '打开之后：商城买东西真的从卡里扣钱、每单出一张小票、私聊里能发转账和红包、角色也各有各的钱包和银行卡。关掉就当这套系统不存在，一分钱不扣。',
                  cost: '不调 API', defaultOff: true, group: '钱包', where: '我的资料 → 💳 我的钱包与银行卡' },
                { key: 'walletSalary', label: '角色有工作就发固定收入',
                  desc: '给角色填了职业和薪水之后，按天（或按月到发薪日）自动进账。没填职业的不发——不是每个人都有稳定工作，这本身也是设定。',
                  cost: '不调 API，纯本地算账', group: '钱包', where: '角色资料页 → 💳 钱包与工作' },
                { key: 'walletBills', label: '角色的生活开销随机发生',
                  desc: '人的生活是随机的，所以账单也是：吃饭、打车、话费、还人钱……金额在设置的区间里随机。卡里不够就记一条"想买但没买成"。',
                  cost: '不调 API', group: '钱包', where: '角色资料页 → 💳 钱包与工作 → 账单' },
                { key: 'walletCharDecide', label: '让角色自己决定这笔钱花在哪',
                  desc: '不用固定的开销表，而是问 TA 一次——按人设和手头宽裕程度自己说花了多少、花在哪儿（"给妹妹买了参考书"这种）。比固定表有人味，但要花钱。',
                  cost: '每笔账单一次调用', defaultOff: true, group: '钱包', where: '同上' },
                { key: 'walletPayChoice', label: '付款时角色自己挑用哪张卡',
                  desc: '不固定用默认卡，而是按真人的顺序自己挑：够钱的储蓄卡 → 余额 → 红包 → 信用卡兜底。关掉就一律先用默认卡。⚠️ 这一项是死规则，不调 API。',
                  cost: '不调 API', group: '钱包', where: '我的资料 → 💳 我的钱包（点卡片设默认）' },
                { key: 'walletOuting', label: '出门会花钱（车费 + 在那儿的消费）',
                  desc: '「行程与天气」里约成一次出门，会随机决定这一趟花没花钱、花在哪儿、谁掏的——**有三成的可能就是出去走走，一分钱没花**；花了的话是车费/一顿饭/咖啡/门票/电影这些里随机一到三样，然后掷一次"我请 / TA 请 / 各付各的"。不按时长算，也不按谁约的算，就跟真的出门一样没准。',
                  cost: '不调 API', group: '钱包', where: '小功能 → 行程与天气 → 约出去；账单里能看到' },
                { key: 'walletLuck', label: '也会有零零碎碎的进账',
                  desc: '人不只花钱：收红包、朋友还钱、退款到账、卖旧东西、接私活、稿费、报销、路上捡到零钱。频率比开销低得多。',
                  cost: '不调 API', group: '钱包', where: '账单里的收入那一栏' },
                { key: 'walletReceipt', label: '每一单生成小票',
                  desc: '下单时出一张小票：单号、时间、商品、合计、支付方式、卡尾号。附在订单详情里，随时点开看。',
                  cost: '不调 API', group: '钱包', where: '商城 → 我的订单 → 点开某一单' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) { console.warn('[钱包] 注册开关失败：', e); }
    }

    /* ---------- 样式 ---------- */
    const CSS = `
    /* 转账卡：一张票据——上半截金额、下半截留言，中间一道齿孔虚线。
       跟包裹卡（面单）和邀请卡（两头像＋连线）刻意都不一样。 */
    /* 转账 / 红包：一条消息，不是居中的卡。
       克制路线——底是卡片色，颜色只落在左边那枚小圆章上。
       整块糊一层橙色渐变在聊天里太抢眼，深色模式下也压不住。 */
    .gywl-tx{--w:var(--gy-accent);--txbg:#f5faff;--txline:rgba(var(--gy-accent-rgb),.22);
        width:216px;max-width:100%;border-radius:14px;overflow:hidden;
        background:var(--txbg);border:1px solid var(--txline);
        box-shadow:0 1px 4px rgba(0,0,0,.05);}
    /* 红包保留一点红——那是这东西本身的意思；黑白主题下再折成灰阶 */
    .gywl-tx.red{--w:#d0524b;--txbg:#fef6f5;--txline:rgba(208,82,75,.22);}
    .gywl-tx.s-refused{--w:#9aa0a6;--txbg:rgba(128,128,128,.06);--txline:rgba(128,128,128,.2);}
    .gywl-tx.from-me{border-bottom-right-radius:5px;}
    .gywl-tx.from-ta{border-bottom-left-radius:5px;}
    .gywl-tx-main{display:flex;align-items:center;gap:11px;padding:13px 14px 12px;}
    .gywl-seal{width:34px;height:34px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        background:var(--w);color:#fff;font-size:17px;font-weight:700;line-height:1;}
    .gywl-tx.red .gywl-seal{font-size:16px;}
    .gywl-tx-txt{min-width:0;flex:1;}
    .gywl-tx-amt{font-size:21px;font-weight:800;line-height:1.15;color:#17181a;letter-spacing:-.2px;}
    .gywl-tx-amt:before{content:'￥';font-size:13px;font-weight:600;margin-right:1px;opacity:.55;}
    .gywl-tx-memo{font-size:12px;color:#8b98a5;margin-top:2px;line-height:1.5;
        overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
    .gywl-foot{border-top:1px solid var(--txline);padding:7px 14px;
        font-size:11.5px;color:#8b98a5;background:rgba(128,128,128,.04);}
    .gywl-foot.ok{color:var(--w);font-weight:600;}
    .gywl-foot.no{color:#9aa0a6;}
    .gywl-foot.acts{display:flex;align-items:center;padding:0;background:transparent;}
    .gywl-b{flex:1;border:none;background:transparent;cursor:pointer;
        padding:9px 0;font-size:12.5px;color:#8b98a5;transition:background .15s;}
    .gywl-b.yes{color:var(--w);font-weight:700;}
    .gywl-b:hover{background:rgba(128,128,128,.07);}
    .gywl-sep{width:1px;align-self:stretch;background:var(--txline);}
    .gywl-tx.s-refused .gywl-tx-amt{text-decoration:line-through;opacity:.55;}
    /* 深色模式：不要压一块近黑的方块在蓝气泡旁边，底色往主色那边带一点 */
    body.dark-theme .gywl-tx{--txbg:#18293a;--txline:rgba(var(--gy-accent-rgb),.30);box-shadow:none;}
    body.dark-theme .gywl-tx.red{--txbg:#2b1e1d;--txline:rgba(208,82,75,.32);}
    body.dark-theme .gywl-tx-amt{color:#e7e9ea;}
    body.dark-theme .gywl-foot{background:rgba(255,255,255,.04);border-top-color:var(--txline);}
    /* 黑白主题：连红包一起折成灰阶 */
    body.theme-mono .gywl-tx,body.theme-mono .gywl-tx.red{
        --w:var(--gy-accent);--txbg:var(--gy-accent-soft);--txline:var(--gy-accent-line);}
    body.theme-mono.dark-theme .gywl-tx,body.theme-mono.dark-theme .gywl-tx.red{--txbg:#202326;}

    /* 钱包面板 */
    .gywl-sum{display:flex;gap:10px;}
    .gywl-sum>div{flex:1;background:var(--gy-accent-soft);border-radius:10px;padding:10px 12px;}
    .gywl-sum em{display:block;font-style:normal;font-size:11.5px;color:#8b98a5;}
    .gywl-sum b{font-size:19px;}
    .gywl-sum b.bad{color:var(--gy-bad);}
    .gywl-cards{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
    .gywl-cd{width:150px;border-radius:10px;padding:10px 12px;cursor:pointer;color:#fff;
        background:linear-gradient(150deg,#4a5b78,#2f3a4d);transition:.15s;}
    .gywl-cd:hover{transform:translateY(-2px);}
    .gywl-cd.k-credit{background:linear-gradient(150deg,#7a5b9c,#4d3565);}
    .gywl-cd.k-balance{background:linear-gradient(150deg,#3f8f7a,#28604f);}
    .gywl-cd.k-redpacket{background:linear-gradient(150deg,#d1544d,#96322c);}
    .gywl-cd.def{outline:2px solid var(--gy-accent);outline-offset:1px;}
    .gywl-cd-top{font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:5px;}
    .gywl-cd-top i{font-style:normal;font-size:10px;background:rgba(255,255,255,.25);border-radius:3px;padding:0 4px;}
    .gywl-cd-no{font:600 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;opacity:.8;margin:8px 0 6px;}
    .gywl-cd-bal{font-size:12.5px;font-weight:600;}
    body.theme-mono .gywl-cd{background:linear-gradient(150deg,#4a4f55,#2a2e33) !important;}
    /* 账单入口 */
    /* 角色资料页上的钱包卡 */
    .gywl-prof{border:1px solid var(--gy-accent-line);border-radius:14px;padding:12px 14px;margin:12px 0;
        background:var(--gy-accent-soft);}
    .gywl-prof-hd{display:flex;align-items:baseline;gap:10px;}
    .gywl-prof-hd b{font-size:14px;}
    .gywl-prof-b{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;margin-left:auto;}
    .gywl-prof-hd i{font-style:normal;font-size:11.5px;color:var(--gy-bad);}
    .gywl-prof-job{font-size:12px;color:#8b98a5;margin-top:3px;}
    .gywl-prof-cards{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;}
    .gywl-prof-cd{font-size:11.5px;padding:4px 9px;border-radius:8px;color:#fff;
        background:linear-gradient(150deg,#4a5b78,#2f3a4d);display:inline-flex;align-items:center;gap:5px;}
    .gywl-prof-cd.k-credit{background:linear-gradient(150deg,#7a5b9c,#4d3565);}
    .gywl-prof-cd.k-balance{background:linear-gradient(150deg,#3f8f7a,#28604f);}
    .gywl-prof-cd.k-redpacket{background:linear-gradient(150deg,#d1544d,#96322c);}
    .gywl-prof-cd b{font-weight:700;}
    body.theme-mono .gywl-prof-cd{background:linear-gradient(150deg,#4a4f55,#2a2e33) !important;}
    .gywl-prof-log{margin-top:9px;font-size:12px;}
    .gywl-prof-log>div{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid rgba(128,128,128,.12);}
    .gywl-prof-log span{flex:1;min-width:0;color:#8b98a5;}
    .gywl-prof-log b{font-variant-numeric:tabular-nums;}
    .gywl-prof-log b.in{color:var(--gy-ok);}
    .gywl-prof-acts{display:flex;gap:6px;margin-top:10px;}

    /* 出门那一趟的两项设置 */
    .gywl-set{display:flex;align-items:center;gap:10px;padding:9px 0;
        border-bottom:1px solid rgba(128,128,128,.14);font-size:13px;}
    .gywl-set>span{flex:0 0 auto;min-width:100px;}
    .gywl-set>span b{font-weight:700;color:var(--gy-accent);}
    .gywl-set select,.gywl-set input[type=range]{flex:1;min-width:0;}
    .gywl-set select{padding:7px;border-radius:8px;background:transparent;color:inherit;
        border:1px solid var(--gy-accent-line);font-family:inherit;}
    @media(max-width:600px){.gywl-set{flex-wrap:wrap;}.gywl-set>span{min-width:100%;}}

    /* 角色资料页上的那一块 */
    .gywl-prof{border-bottom:1px solid #eff3f4;}
    .gywl-prof-hd{display:flex;align-items:center;gap:11px;padding:12px 16px;cursor:pointer;transition:.15s;}
    .gywl-prof-hd:hover{background:rgba(128,128,128,.05);}
    .gywl-prof-ico{width:36px;height:36px;border-radius:10px;flex-shrink:0;font-size:18px;
        display:flex;align-items:center;justify-content:center;background:var(--gy-accent-soft);}
    .gywl-prof-t{flex:1;min-width:0;}
    .gywl-prof-t b{display:block;font-size:14.5px;}
    .gywl-prof-t em{font-style:normal;font-size:12px;color:#8b98a5;}
    .gywl-prof-ch{font-size:12.5px;color:var(--gy-accent);white-space:nowrap;}
    .gywl-prof-b{padding:0 16px 16px;}
    .gywl-prof-job{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:12px 0 6px;}
    .gywl-prof-job input,.gywl-prof-job select{padding:7px 9px;border-radius:8px;background:transparent;
        color:inherit;border:1px solid var(--gy-accent-line);font-family:inherit;}
    .gywl-prof-job input:first-child{flex:1;min-width:150px;}
    .gywl-prof-job input[type=number]{width:88px;}
    .gywl-prof-job select{width:82px;}
    .gywl-prof-hint{font-size:11.5px;color:#8b98a5;line-height:1.7;margin-bottom:10px;}
    .gywl-prof-self{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 10px;
      padding:9px 11px;border-radius:10px;background:rgba(var(--gy-accent-rgb),.07);
      border:1px solid rgba(var(--gy-accent-rgb),.22);font-size:12px;line-height:1.7;}
    .gywl-prof-self>div{flex:1;min-width:150px;}
    body.dark-theme .gywl-prof{border-bottom-color:#38444d;}

    .gywl-billbtn{display:flex;align-items:center;gap:10px;width:100%;margin-top:14px;cursor:pointer;
        padding:13px 14px;border-radius:12px;border:1px solid var(--gy-accent-line);
        background:var(--gy-accent-soft);color:inherit;text-align:left;transition:.15s;}
    .gywl-billbtn:hover{background:rgba(var(--gy-accent-rgb),.16);}
    .gywl-billbtn span{font-size:14.5px;font-weight:700;color:var(--gy-accent);}
    .gywl-billbtn em{font-style:normal;font-size:11.5px;color:#8b98a5;}
    .gywl-billbtn i{margin-left:auto;font-style:normal;font-size:18px;color:var(--gy-accent);}

    /* 🧾 账单 */
    .gybl-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
    .gybl-pick{width:100%;padding:9px;border-radius:9px;background:transparent;color:inherit;
        border:1px solid var(--gy-accent-line);margin-bottom:10px;}
    .gybl-sum{display:flex;gap:8px;margin-bottom:10px;}
    .gybl-sum>div{flex:1;background:rgba(128,128,128,.07);border-radius:10px;padding:9px 10px;text-align:center;}
    .gybl-sum em{display:block;font-style:normal;font-size:11px;color:#8b98a5;margin-bottom:2px;}
    .gybl-sum b{font-size:15px;}
    .gybl-sum b.in{color:var(--gy-ok);} .gybl-sum b.out{color:var(--gy-bad);}
    .gybl-list{flex:1;overflow-y:auto;min-height:80px;}
    .gybl-day{margin-bottom:10px;}
    .gybl-day-hd{display:flex;justify-content:space-between;font-size:11.5px;color:#8b98a5;
        padding:4px 2px;border-bottom:1px solid rgba(128,128,128,.14);}
    .gybl-row{display:flex;align-items:center;gap:10px;padding:9px 4px;cursor:pointer;
        border-bottom:1px solid rgba(128,128,128,.09);transition:background .15s;}
    .gybl-row:hover{background:rgba(128,128,128,.06);}
    .gybl-ico{width:26px;height:26px;border-radius:50%;flex-shrink:0;font-size:13px;font-weight:700;
        display:flex;align-items:center;justify-content:center;color:#fff;}
    .gybl-ico.in{background:var(--gy-ok);} .gybl-ico.out{background:var(--gy-accent);}
    .gybl-mid{flex:1;min-width:0;}
    .gybl-why{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .gybl-sub{font-size:11px;color:#8b98a5;margin-top:1px;}
    .gybl-amt{font-size:14.5px;font-variant-numeric:tabular-nums;}
    .gybl-amt.in{color:var(--gy-ok);} .gybl-amt.out{color:inherit;}
    .gybl-empty{color:#8b98a5;font-size:13px;text-align:center;padding:24px 0;}

    /* 小票：热敏纸的样子，底下一条撕口 */
    .gyrc{background:#fffdf8;color:#33302b;border-radius:4px;padding:14px 16px 18px;
        font:12.5px/1.75 ui-monospace,Menlo,monospace;max-width:300px;margin:10px auto;
        box-shadow:0 2px 10px rgba(0,0,0,.09);position:relative;}
    .gyrc:after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:7px;
        background:repeating-linear-gradient(135deg,#fffdf8 0 6px,transparent 6px 12px);}
    .gyrc-head{text-align:center;margin-bottom:8px;}
    .gyrc-shop{font-size:15px;font-weight:800;letter-spacing:.2em;}
    .gyrc-sub{font-size:10px;letter-spacing:.28em;color:#9a938a;}
    .gyrc-line{border-top:1px solid #d9d2c6;margin:8px 0;}
    .gyrc-line.dash{border-top-style:dashed;}
    .gyrc-kv{display:flex;justify-content:space-between;gap:10px;}
    .gyrc-kv span{color:#9a938a;}
    .gyrc-kv.item span{color:#33302b;}
    .gyrc-kv.total b{font-size:15px;}
    .gyrc-foot{text-align:center;color:#9a938a;font-size:10.5px;margin-top:6px;}
    body.dark-theme .gyrc{background:#26231f;color:#e2ddd5;}
    body.dark-theme .gyrc-line{border-top-color:#453f38;}
    body.dark-theme .gyrc:after{background:repeating-linear-gradient(135deg,#26231f 0 6px,transparent 6px 12px);}
    body.theme-mono .gyrc{background:#f7f7f7;color:#1a1c1e;}
    body.theme-mono.dark-theme .gyrc{background:#222426;color:#e7e9ea;}
    @media(max-width:600px){.gywl-tx{width:196px;}.gywl-cd{width:calc(50% - 4px);}}
    `;
    function mount() {
        if (document.getElementById('gywlCss')) return;
        const st = document.createElement('style'); st.id = 'gywlCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    /* ---------- 聊天里那颗 💸 按钮 ---------- */
    window.gyWalletSendUI = function () {
        const to = (typeof currentChatSessionId !== 'undefined') ? currentChatSessionId : null;
        if (!to || String(to).startsWith('g_')) {
            try { if (typeof showToast === 'function') showToast('', '💸', '先进一个人的私聊', null, null, false); } catch (e) {}
            return;
        }
        ensureCards('me');
        const w = walletOf('me');
        const html = `<div class="modal-box" style="width:92%;max-width:340px;">
            <h3 style="margin:0 0 4px;">转账给 ${esc(nameOf(to))}</h3>
            <div class="form-hint" style="margin-bottom:12px;">钱在你按下发送的那一刻就从卡里扣了；对方退回会原路还给你。</div>
            <div class="input-group"><label>金额</label>
                <input type="number" id="gywlAmt" placeholder="0.00" step="0.01" min="0.01"></div>
            <div class="input-group"><label>留言（选填）</label>
                <input type="text" id="gywlMemo" placeholder="拿去买杯热的"></div>
            <div class="input-group"><label>用哪张卡</label>
                <select id="gywlCard">
                    <option value="">让它自己挑（够钱的储蓄卡 → 余额 → 红包 → 信用卡）</option>
                    ${w.cards.map(c => `<option value="${c.id}">${kindOf(c.kind).ico} ${esc(c.name)} ·${esc(c.no4)}　可用 ￥${money(avail(c))}</option>`).join('')}
                </select></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                <button type="button" class="btn-cancel" style="margin:0;" onclick="gyWalletCloseSend()">取消</button>
                <button type="button" class="btn-secondary" style="margin:0;" onclick="gyWalletDoSend('${to}','red')">🧧 发红包</button>
                <button type="button" class="btn-primary" style="margin:0;width:auto;" onclick="gyWalletDoSend('${to}','transfer')">转账</button>
            </div></div>`;
        let ov = document.getElementById('gywlSendModal');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'gywlSendModal'; ov.className = 'modal-overlay';
            document.body.appendChild(ov);
        }
        ov.innerHTML = html;
        ov.style.display = 'flex';
    };
    window.gyWalletCloseSend = function () { const o = document.getElementById('gywlSendModal'); if (o) o.style.display = 'none'; };
    window.gyWalletDoSend = async function (to, kind) {
        const amt = parseFloat((document.getElementById('gywlAmt') || {}).value) || 0;
        const memo = (document.getElementById('gywlMemo') || {}).value || '';
        const cardId = (document.getElementById('gywlCard') || {}).value || '';
        if (amt <= 0) { try { if (typeof showToast === 'function') showToast('', '💸', '先填个金额', null, null, false); } catch (e) {} return; }
        gyWalletCloseSend();
        await window.gyWallet.send({ from: 'me', to, amt, note: memo, kind, cardId });
    };
    // 钱包关着的时候那颗按钮不该出现在工具栏里
    function paintSendBtn() {
        const b = document.getElementById('gywlSendBtn');
        if (b) b.style.display = on('walletOn') ? '' : 'none';
    }

    (async function init() {
        mount();
        addSwitches();
        hookProfile();
        setTimeout(addProfileMenu, 900);
        await load();
        startBeat();
        // 🎲「TA 自己决定」模式的角色，钱包还没自己定过的：开机后悄悄让 TA 定（一次最多两个，别一下子刷一堆请求）
        setTimeout(() => {
            try {
                if (!on('walletOn') || typeof getCharActMode !== 'function') return;
                chars().filter(c => getCharActMode(c) === 'auto' && !walletOf(c.id).taSet).slice(0, 2)
                    .forEach((c, i) => setTimeout(() => window.gyWalletTaDecide(c.id, true), i * 4000));
            } catch (e) {}
        }, 20000);
        paintSendBtn();
        // 开关是随时能改的，所以切页时对一遍 + 一个慢心跳兜底
        try {
            const sw = window.switchMainView;
            if (typeof sw === 'function' && !sw.__gywlPatched) {
                window.switchMainView = function () { const r = sw.apply(this, arguments); try { setTimeout(paintSendBtn, 0); } catch (e) {} return r; };
                window.switchMainView.__gywlPatched = true;
            }
        } catch (e) {}
        setInterval(paintSendBtn, 3000);
    })();
})();
