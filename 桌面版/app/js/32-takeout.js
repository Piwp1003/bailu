/* ===========================================================================
   js/32 —— 🛵 外卖
   ---------------------------------------------------------------------------
   商城卖的是"东西"，外卖卖的是"这一顿"。两件事在真实生活里完全不一样：
   外卖是当下的、便宜的、几十分钟就到的，而且**店本身有性格**——
   巷口那家面馆的老板会在备注里回你一句，连锁店只会发一条模板短信。

   所以这一页是照着现实外卖软件做的：
     · 首页是**店铺列表**：招牌 · 评分 · 月售 · 起送 · 配送费 · 大概多久到
     · 点进去是**菜单**，加进购物车，凑够起送才能下单
     · 下单 → 扣钱（走 js/31 的钱包）→ 出**外卖单**（小票，含每一道菜和配送费）
     · 然后是**真的在配送**：商家接单 → 出餐 → 骑手取餐 → 送达，时间按距离走
     · 送达时聊天里给一条提示；给角色点的，TA 可能会说一句

   🏪 店从哪儿来：
     · **随机生成**：不调 API 也能生成（从菜系/词根里拼），也可以让模型来写
       ——模型写出来的店有人设（老板是谁、什么脾气、招牌是什么）
     · **你自己开**：店名、简介、老板人设、菜单，全部自己填
     · 角色也可能有自己的店（用「老板」那一栏指到某个角色身上）

   ⚠️ 整块默认关着。不打开的话商城还是原来那两页，一次 API 都不调。
   💰 花钱的地方只有一处：让模型生成店铺（开关 takeoutAiShop，默认关）。
      随机开店、下单、配送、送达提示，全都是本地的，一次都不调。
   =========================================================================== */
(function () {
    if (window.__gyTakeoutLoaded) return;
    window.__gyTakeoutLoaded = true;

    const LF = (typeof window.gyStore === 'function')
        ? window.gyStore('gyTakeoutBox', 'takeout')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyTakeoutBox', storeName: 'takeout' })
            : null);
    const KEY = 'gyTakeout_state';

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const meName = () => (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '我';
    const nameOf = id => String(id) === 'me' ? meName() : ((charOf(id) || {}).name || '某人');
    const on = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const uid = p => (p || 't') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const money = n => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
    const rnd = a => a[Math.floor(Math.random() * a.length)];
    const rint = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

    /* ---------- 随机开店用的词根（不调 API 也能开出像样的店）---------- */
    const CUISINE = [
        { k: '面馆', ico: '🍜', pre: ['老', '巷口', '一碗', '西关', '桥头', '阿婆'], suf: ['面馆', '牛肉面', '拉面馆', '汤面铺'],
          menu: [['牛肉面', 18, 28], ['素面', 9, 14], ['小馄饨', 10, 16], ['卤蛋', 2, 3], ['凉拌黄瓜', 6, 10], ['豆浆', 4, 6]] },
        { k: '快餐', ico: '🍱', pre: ['好味', '每日', '一食', '街角', '老王'], suf: ['快餐', '饭堂', '简餐', '小炒'],
          menu: [['红烧肉饭', 22, 32], ['宫保鸡丁饭', 20, 28], ['青椒肉丝饭', 18, 26], ['番茄蛋汤', 5, 8], ['加个煎蛋', 3, 5]] },
        { k: '咖啡', ico: '☕', pre: ['半日', '深夜', '拐角', '第七', '未名'], suf: ['咖啡', '咖啡馆', 'Coffee', '烘焙室'],
          menu: [['美式', 15, 22], ['拿铁', 22, 32], ['燕麦拿铁', 26, 36], ['司康', 12, 18], ['可颂', 10, 16]] },
        { k: '烧烤', ico: '🍢', pre: ['夜市', '老李', '铁签', '巷子里'], suf: ['烧烤', '串店', '烤串'],
          menu: [['羊肉串（十串）', 30, 45], ['烤茄子', 12, 18], ['烤韭菜', 8, 12], ['烤馒头片', 6, 10], ['冰啤酒', 8, 12]] },
        { k: '甜品', ico: '🍰', pre: ['小满', '一勺', '云顶', '慢一点'], suf: ['甜品', '烘焙', '糖水铺'],
          menu: [['芋圆西米露', 16, 24], ['杨枝甘露', 18, 26], ['提拉米苏', 22, 32], ['布丁', 10, 15]] },
        { k: '粥铺', ico: '🥣', pre: ['清早', '一粥', '南巷', '老城'], suf: ['粥铺', '早点', '粥店'],
          menu: [['皮蛋瘦肉粥', 12, 18], ['小米粥', 6, 10], ['生煎（四只）', 12, 18], ['豆腐脑', 6, 9], ['油条', 3, 5]] },
        { k: '火锅', ico: '🍲', pre: ['蜀', '重庆', '围炉', '一口'], suf: ['火锅', '麻辣烫', '冒菜'],
          menu: [['麻辣烫（自选）', 25, 45], ['冒鸭血', 15, 22], ['宽粉', 6, 10], ['豆皮', 5, 8], ['酸梅汤', 6, 10]] }
    ];
    const OWNER_TRAITS = [
        '话不多，出餐快，备注写什么就照做什么',
        '爱多问一句"要不要加辣"，忘了放小料会补一句道歉',
        '开了二十年，认得回头客，会多给一个卤蛋',
        '年轻人开的，包装很讲究，附一张手写小卡片',
        '脾气有点冲，但东西是真好吃',
        '晚上才开门，凌晨两点还在',
        '两口子一起做的，男的掌勺女的招呼'
    ];

    let S = {
        shops: [],      // {id,name,ico,cuisine,desc,ownerId,ownerTrait,rating,sold,minOrder,fee,eta,menu:[{id,n,p,hot}],byUser}
        orders: [],     // {id,shopId,shopName,items,total,fee,forWhom,by,at,etaMs,status,riderName,note,receiptId,told}
        cart: {},       // { 店id: {菜id: 份数} }
        settings: { autoNewShop: true }
    };
    // 订单不设条数上限（以前只留最近 120 单，旧单会自己消失）
    async function save() {
        try { if (LF) await LF.setItem(KEY, JSON.parse(JSON.stringify(S))); } catch (e) { console.warn('[外卖] 存档失败', e); }
    }
    async function load() {
        try { if (LF) { const d = await LF.getItem(KEY); if (d && typeof d === 'object') S = Object.assign(S, d); } } catch (e) {}
        if (!Array.isArray(S.shops)) S.shops = [];
        if (!Array.isArray(S.orders)) S.orders = [];
        if (!S.cart || typeof S.cart !== 'object') S.cart = {};
    }

    /* ---------- 开店 ---------- */
    // 本地随机开一家（不调 API）。菜价在区间里随机，所以两家同类型的店价格也不一样。
    function randomShop() {
        const c = rnd(CUISINE);
        const name = rnd(c.pre) + rnd(c.suf);
        return {
            id: uid('s_'), name, ico: c.ico, cuisine: c.k,
            desc: rnd(['做了很多年了', '街坊常来', '分量足', '干净，出餐快', '晚上人多，早点下单']),
            ownerId: '', ownerTrait: rnd(OWNER_TRAITS),
            rating: (rint(38, 49) / 10).toFixed(1),
            sold: rint(30, 3000),
            minOrder: rnd([0, 0, 15, 20, 25]),
            fee: rnd([0, 2, 3, 4, 5]),
            eta: rint(20, 55),
            menu: c.menu.map((m, i) => ({ id: 'i' + i + Math.random().toString(36).slice(2, 5), n: m[0], p: rint(m[1], m[2]), hot: i === 0 })),
            byUser: false, at: Date.now()
        };
    }
    window.gytoNewShop = async function () {
        S.shops.unshift(randomShop());
        await save(); render();
    };
    /* 🔄 刷新附近的店：换一批。
       跟真的外卖软件一样——你换个位置、换个时间，能点的店就不一样了。
       ⚠️ 只换"系统随机开的"那些：**你自己开的店和挂在角色名下的店永远留着**，
          不然刷一下自己辛苦填的菜单就没了。 */
    window.gytoRefresh = async function () {
        const keep = S.shops.filter(x => x.byUser || x.ownerId);
        const n = 4 + Math.floor(Math.random() * 4);          // 一次换 4~7 家
        const fresh = [];
        const used = new Set(keep.map(x => x.name));
        let guard = 0;
        while (fresh.length < n && guard++ < 60) {
            const sh = randomShop();
            if (used.has(sh.name)) continue;                   // 同名的不要两家
            used.add(sh.name); fresh.push(sh);
        }
        // 自己开的店排在前面——那是"我的常点"，别被随机的挤到底下去
        S.shops = keep.concat(fresh);
        // 购物车跟着清掉已经不在的店，不然会留下指向空店铺的残留
        Object.keys(S.cart).forEach(k => { if (!S.shops.some(x => x.id === k)) delete S.cart[k]; });
        openShop = null;
        await save(); render();
        toast('换了一批，附近现在有 ' + S.shops.length + ' 家店');
    };
    // 让模型开一家（开关 takeoutAiShop）：写出来的店有老板、有脾气、有招牌
    window.gytoAiShop = async function () {
        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
        if (!api || !api.key) return toast('还没配 API Key');
        toast('正在开一家新店…');
        try {
            const had = S.shops.slice(0, 6).map(s => '· ' + s.name).join('\n');
            const ask = `你在为一个外卖软件编一家**真实感很强的小店**。不要连锁品牌，不要网红噱头，
就是那种开在街边、有人在里面真的做饭的店。
${had ? `已经有这些店了，别重复：\n${had}\n` : ''}
只输出 JSON，不要解释：
{"name":"店名，10字以内","ico":"一个 emoji","cuisine":"品类，4字以内",
 "desc":"一句店铺简介，20字以内，像老板自己写的",
 "owner":"老板是个什么人、什么脾气，25字以内",
 "menu":[{"n":"菜名","p":价格数字},…5到8道菜，价格贴近现实]}`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages('', [], ask) : [{ role: 'user', content: ask }];
            const data = await callChatCompletionAPI(api, msgs);
            let r = (typeof parseModelJson === 'function') ? parseModelJson(data.choices?.[0]?.message?.content || '') : null;
            if (Array.isArray(r)) r = r[0];
            if (!r || !r.name) return toast('这次没开成');
            const base = randomShop();
            base.name = String(r.name).slice(0, 16);
            base.ico = String(r.ico || base.ico).slice(0, 4);
            base.cuisine = String(r.cuisine || base.cuisine).slice(0, 8);
            base.desc = String(r.desc || base.desc).slice(0, 40);
            base.ownerTrait = String(r.owner || base.ownerTrait).slice(0, 50);
            if (Array.isArray(r.menu) && r.menu.length) {
                base.menu = r.menu.slice(0, 10).map((m, i) => ({
                    id: 'i' + i + Math.random().toString(36).slice(2, 5),
                    n: String(m.n || '一道菜').slice(0, 16),
                    p: Math.max(1, Math.round(Number(m.p) || 15)), hot: i === 0
                }));
            }
            S.shops.unshift(base);
            await save(); render();
            toast('「' + base.name + '」开张了');
        } catch (e) { console.warn('[外卖] AI 开店失败', e); toast('这次没开成'); }
    };
    window.gytoDelShop = async function (id) {
        S.shops = S.shops.filter(s => s.id !== id);
        delete S.cart[id];
        await save(); render();
    };

    /* ---------- 购物车 / 下单 ---------- */
    const shopOf = id => S.shops.find(s => s.id === id) || null;
    const cartOf = id => { if (!S.cart[id]) S.cart[id] = {}; return S.cart[id]; };
    function cartSum(shop) {
        const c = cartOf(shop.id);
        let n = 0, p = 0;
        shop.menu.forEach(m => { const q = c[m.id] || 0; n += q; p += q * m.p; });
        return { n, p: Math.round(p * 100) / 100 };
    }
    window.gytoAdd = async function (sid, iid, d) {
        const s = shopOf(sid); if (!s) return;
        const c = cartOf(sid);
        c[iid] = Math.max(0, (c[iid] || 0) + (d || 1));
        if (!c[iid]) delete c[iid];
        await save(); render();
    };
    window.gytoClearCart = async function (sid) { S.cart[sid] = {}; await save(); render(); };

    const RIDERS = ['小周', '老陈', '阿凯', '小杨', '大刘', '小马', '阿强'];
    window.gytoOrder = async function (sid) {
        const s = shopOf(sid); if (!s) return;
        const { n, p } = cartSum(s);
        if (!n) return toast('购物车是空的');
        // 起送价只是店铺的一个标签，不拦你下单
        const forWhom = (document.getElementById('gytoFor') || {}).value || 'me';
        const note = ((document.getElementById('gytoNote') || {}).value || '');
        const c = cartOf(sid);
        const items = s.menu.filter(m => c[m.id]).map(m => ({ n: m.n, q: c[m.id], p: Math.round(m.p * c[m.id] * 100) / 100 }));
        const fee = Number(s.fee) || 0;
        const total = Math.round((p + fee) * 100) / 100;

        // 💳 走钱包扣钱 + 出外卖单（钱包没开就跳过，行为跟以前一样）
        let receiptId = '';
        if (window.gyWallet && typeof window.gyWallet.spend === 'function') {
            const r = await window.gyWallet.spend('me', total, s.name + '（外卖）', {
                tag: '外卖', shop: s.name,
                items: items.concat(fee ? [{ n: '配送费', p: fee }] : [])
            });
            // 钱不够也照下：钱包那边允许透支，不再"这一单没下成"
            if (r && r.rid) receiptId = r.rid;
        }

        const o = {
            id: uid('o_'), shopId: s.id, shopName: s.name, shopIco: s.ico,
            items, total, fee, forWhom, by: 'me', note,
            at: Date.now(), etaMs: (Number(s.eta) || 30) * 60000,
            status: 'accepted', riderName: rnd(RIDERS), receiptId, told: false
        };
        S.orders.unshift(o);
        s.sold = (Number(s.sold) || 0) + n;
        S.cart[sid] = {};
        await save();
        changed();
        // ⚠️ 下完单要退出店铺页，否则 openShop 还占着，切到「我的订单」也只会重画菜单
        openShop = null;
        tab = 'orders'; render();
        toast(s.name + ' 已接单 · 大约 ' + s.eta + ' 分钟送到');
        // 点给角色的，聊天里说一声（系统提示一句，不是卡片）
        if (forWhom !== 'me') sysLine(forWhom, `你给 ${nameOf(forWhom)} 点了「${s.name}」的外卖，大约 ${s.eta} 分钟送到。`);
    };

    // 💬 聊天里角色说"给你点了份外卖"时真的下一单（js/52 调）。
    //    hint 是 TA 说的吃的/店：对得上菜名或店名就在那家点，对不上随便挑一家；
    //    凑够起送价，钱从 TA 的钱包出（钱包没开就不扣），送达时间照常走，到了你这儿会有通知。
    // forSelf：TA 给自己点（自主模式里「给自己点外卖」，js/58）
    window.gytoCharOrder = async function (charId, hint, forSelf) {
        const c = charOf(charId);
        if (!c || !on('takeoutOn') || !S.shops.length) return null;
        const h = String(hint || '').trim();
        const hit = (x) => h && x && (String(x).indexOf(h) !== -1 || h.indexOf(String(x)) !== -1);
        let shop = h ? (S.shops.find(sh => hit(sh.name) || hit(sh.cuisine) || (sh.menu || []).some(m => hit(m.n)))) : null;
        if (!shop) shop = rnd(S.shops);
        if (!shop || !(shop.menu || []).length) return null;
        const menu = shop.menu.slice();
        const want = h ? menu.filter(m => hit(m.n)) : [];
        const items = [];
        const add = (m) => { const e = items.find(x => x.n === m.n); if (e) { e.q++; e.p = Math.round(m.p * e.q * 100) / 100; } else items.push({ n: m.n, q: 1, p: m.p }); };
        (want.length ? want : [menu.find(m => m.hot) || rnd(menu)]).forEach(add);
        let guard = 0;
        while (items.reduce((a, x) => a + x.p, 0) < (shop.minOrder || 0) && guard++ < 8) add(rnd(menu));
        const fee = Number(shop.fee) || 0;
        const total = Math.round((items.reduce((a, x) => a + x.p, 0) + fee) * 100) / 100;
        let receiptId = '';
        if (window.gyWallet && typeof window.gyWallet.spend === 'function') {
            const r = await window.gyWallet.spend(String(c.id), total, shop.name + (forSelf ? '（给自己点的外卖）' : '（给' + meName() + '点的外卖）'), {
                tag: '外卖', shop: shop.name, items: items.concat(fee ? [{ n: '配送费', p: fee }] : [])
            });
            if (r && r.ok === false) return null;
            if (r && r.rid) receiptId = r.rid;
        }
        const o = {
            id: uid('o_'), shopId: shop.id, shopName: shop.name, shopIco: shop.ico,
            items, total, fee, forWhom: forSelf ? String(c.id) : 'me', by: String(c.id), note: '',
            at: Date.now(), etaMs: (Number(shop.eta) || 30) * 60000,
            status: 'accepted', riderName: rnd(RIDERS), receiptId, told: false
        };
        S.orders.unshift(o);
        shop.sold = (Number(shop.sold) || 0) + items.reduce((a, x) => a + x.q, 0);
        await save();
        // 角色下的单：外卖页开着「我的订单」就马上重画，不用等下一拍
        if (viewOpen() && tab === 'orders' && !openShop) render();
        changed();
        if (!forSelf) sysLine(c.id, `🛵 ${c.name} 给你点了「${shop.name}」的${items.map(x => x.n).join('、')}，大约 ${shop.eta} 分钟送到。`);
        return { shop: shop.name, items: items.map(x => x.n), eta: shop.eta };
    };

    function sysLine(charId, text) {
        try {
            if (typeof globalChats === 'undefined') return;
            const sid = String(charId);
            if (!globalChats[sid]) globalChats[sid] = [];
            globalChats[sid].push({ sender: 'system', text: esc(text), timestamp: Date.now(), readBy: [] });
            if (typeof saveAllData === 'function') saveAllData();
            if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === sid) renderChatMessages();
        } catch (e) {}
    }

    /* ---------- 配送 ---------- */
    // 四段：商家接单 → 出餐 → 骑手取餐 → 送达。时间按这一单的 eta 摊开。
    const STEPS = ['商家已接单', '正在出餐', '骑手已取餐', '已送达'];
    function stepOf(o) {
        if (o.status === 'done') return 3;
        const p = (Date.now() - o.at) / o.etaMs;
        return p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.25 ? 1 : 0;
    }
    function etaText(o) {
        if (o.status === 'done') return '已送达';
        const m = Math.round(Math.max(0, o.at + o.etaMs - Date.now()) / 60000);
        return m <= 0 ? '马上到' : '还有 ' + m + ' 分钟';
    }
    async function tick() {
        if (!on('takeoutOn')) return;
        let changed = false;
        for (const o of S.orders) {
            if (o.status !== 'done' && Date.now() - o.at >= o.etaMs) {
                o.status = 'done'; o.doneAt = Date.now(); changed = true;
                await arrived(o);
            }
        }
        if (changed) { await save(); changedNote(); }
        if (viewOpen() && tab === 'orders') render();
    }
    async function arrived(o) {
        const who = o.forWhom === 'me' ? '你' : nameOf(o.forWhom);
        try {
            if (typeof addNotification === 'function' && !(o.forWhom !== 'me' && String(o.by) === String(o.forWhom))) {
                addNotification('🛵 <b>外卖到了</b>', null, o.forWhom === 'me' ? null : o.forWhom,
                    charOf(o.forWhom), `${o.shopIco || '🍜'} ${o.shopName}　${who}的餐到了`,
                    o.forWhom === 'me' ? { view: 'mall' } : null);
            }
        } catch (e) {}
        if (o.forWhom !== 'me' && String(o.by) === String(o.forWhom)) {
            // TA 给自己点的：不往你们的聊天里插系统消息，也不"谢谢你点的外卖"；算 TA 身上的一件小事
            try { if (typeof window.gyLifeEvent === 'function') window.gyLifeEvent(o.forWhom, `自己点的「${o.shopName}」外卖到了`, 0.1); } catch (e) {}
        } else if (o.forWhom !== 'me') {
            sysLine(o.forWhom, `${o.shopName} 的外卖送到了 ${nameOf(o.forWhom)} 那儿。`);
            react(o);
        }
    }
    // 送到角色手上，TA 可能说一句（开关 takeoutReact）
        // 报一下场景：这段生成属于「takeout」那一场，好让「注入内容管理」能单独设它读什么（soft＝外层已经有场景就不抢）
    async function react() {
        const a = arguments;
        if (typeof window.gyInjectInSceneSoft === 'function')
            return window.gyInjectInSceneSoft('takeout', () => reactInner.apply(null, a));
        return reactInner.apply(null, a);
    }
    async function reactInner(o) {
        try {
            if (!on('takeoutReact')) return;
            const c = charOf(o.forWhom); if (!c) return;
            const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
            if (!api || !api.key) return;
            const s = shopOf(o.shopId);
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : ('你是' + c.name);
            const ask = `${(typeof userDisplayName === 'function') ? userDisplayName(c) : '对方'}给你点了外卖，刚刚送到：
「${o.shopName}」${s ? `（${s.cuisine}，${s.desc}）` : ''}　${o.items.map(x => x.n + (x.q > 1 ? '×' + x.q : '')).join('、')}${o.note ? `\n下单备注：${o.note}` : ''}
按你的人设决定要不要说一句——道谢、吐槽、"你怎么知道我想吃这个"、或者什么都不说都行。
不想说就只输出 NO；想说就直接输出那句话，40 字以内，不要引号。`;
            const msgs = (typeof buildStructuredMessages === 'function') ? buildStructuredMessages(base, [], ask) : [{ role: 'user', content: base + '\n' + ask }];
            const data = await callChatCompletionAPI(api, msgs);
            const raw = (data?.choices?.[0]?.message?.content || '').trim();
            if (!raw || raw.toUpperCase().indexOf('NO') === 0) return;
            const text = raw.replace(/^["「]|["」]$/g, '').trim().slice(0, 80);
            if (text && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(c, text, null);
        } catch (e) { console.warn('[外卖] 送达反应失败', e); }
    }

    /* ---------- prompt 注入 ---------- */
    window.__gyTakeoutCtxFor = function (charId) {
        try {
            if (!on('takeoutOn')) return '';
            const mine = S.orders.filter(o => String(o.forWhom) === String(charId)).slice(0, 3);
            if (!mine.length) return '';
            return '\n【最近有人给你点的外卖】：\n' + mine.map(o =>
                `- 「${o.shopName}」${o.items.map(x => x.n).join('、')}：${o.status === 'done' ? '已经送到了' : '还在路上（' + etaText(o) + '）'}`
            ).join('\n') + '\n（真发生过的事，合适的时候可以提一句，不用刻意聊。）\n';
        } catch (e) { return ''; }
    };

    /* ================= 页面（挂在商城里的一个标签页）================= */
    let tab = 'shops', openShop = null;
    const viewOpen = () => { const v = document.getElementById('view-mall'); return v && v.style.display !== 'none'; };
    const toast = m => { try { if (typeof showToast === 'function') showToast('', '🛵 外卖', m, null, null, false); } catch (e) {} };

    window.gytoTab = t => { tab = t; openShop = null; render(); };
    window.gytoOpenShop = id => { openShop = id; render(); };
    window.gytoBack = () => { openShop = null; render(); };

    window.gyTakeoutHtml = function () {
        if (!on('takeoutOn')) {
            return `<div class="gymall-empty">外卖现在是<b>关着</b>的。<br>
                去 设置 → ⚙️ 自动化功能 → 🛵 外卖 打开「外卖」这一项。</div>`;
        }
        if (openShop) return shopPage(openShop);
        return `
        <div class="gyto-tabs">
            <span class="gyto-t ${tab === 'shops' ? 'on' : ''}" onclick="gytoTab('shops')">附近的店</span>
            <span class="gyto-t ${tab === 'orders' ? 'on' : ''}" onclick="gytoTab('orders')">我的订单</span>
            <span class="gyto-t ${tab === 'new' ? 'on' : ''}" onclick="gytoTab('new')">开一家店</span>
        </div>
        ${tab === 'shops' ? shopList() : tab === 'orders' ? orderList() : newShopForm()}`;
    };

    function shopList() {
        if (!S.shops.length) {
            return `<div class="gymall-empty">附近还没有店。<br>
                <button type="button" class="gymall-btn solid" style="margin-top:10px;" onclick="gytoRefresh()">🔄 刷新附近的店</button></div>`;
        }
        return `<div class="gyto-bar">
            <button type="button" class="gymall-btn solid" onclick="gytoRefresh()">🔄 换一批</button>
            <button type="button" class="gymall-btn" onclick="gytoNewShop()">🎲 再开一家</button>
            ${on('takeoutAiShop') ? `<button type="button" class="gymall-btn" onclick="gytoAiShop()">✨ 让模型开一家</button>` : ''}
            <span class="gyto-cnt">附近 ${S.shops.length} 家　·　换一批不会动你自己开的店</span>
        </div>` + S.shops.map(s => {
            const owner = s.ownerId ? charOf(s.ownerId) : null;
            return `<div class="gyto-shop" onclick="gytoOpenShop('${s.id}')">
                <div class="gyto-logo">${esc(s.ico || '🍜')}</div>
                <div class="gyto-si">
                    <div class="gyto-sn">${esc(s.name)}${s.byUser ? '<i>自建</i>' : ''}${owner ? `<i>${esc(owner.name)}的店</i>` : ''}</div>
                    <div class="gyto-sr">⭐ ${esc(s.rating)}　月售 ${esc(s.sold)}　${s.cuisine ? esc(s.cuisine) : ''}</div>
                    <div class="gyto-sd">${esc(s.desc || '')}</div>
                    <div class="gyto-sf">${s.minOrder ? '起送 ￥' + s.minOrder : '无起送'}　配送 ${s.fee ? '￥' + s.fee : '免费'}　约 ${s.eta} 分钟</div>
                </div>
                <div class="gyto-go">›</div>
            </div>`;
        }).join('');
    }

    function shopPage(id) {
        const s = shopOf(id);
        if (!s) { openShop = null; return shopList(); }
        const c = cartOf(id);
        const { n, p } = cartSum(s);
        const owner = s.ownerId ? charOf(s.ownerId) : null;
        const enough = n > 0;   // 不凑起送价也能下单
        return `
        <div class="gyto-hd">
            <span class="gyto-back" onclick="gytoBack()">←</span>
            <span class="gyto-logo big">${esc(s.ico || '🍜')}</span>
            <div style="min-width:0;flex:1;">
                <div class="gyto-sn" style="font-size:16px;">${esc(s.name)}</div>
                <div class="gyto-sr">⭐ ${esc(s.rating)}　月售 ${esc(s.sold)}　约 ${s.eta} 分钟</div>
            </div>
            <button type="button" class="gymall-btn ghost" onclick="gytoDelShop('${s.id}')">关店</button>
        </div>
        <div class="gyto-owner">
            <b>${owner ? esc(owner.name) + '（这家店的老板）' : '老板'}</b>${esc(s.ownerTrait || '')}
        </div>
        ${s.menu.map(m => `
            <div class="gyto-dish">
                <div style="min-width:0;flex:1;">
                    <div class="gyto-dn">${esc(m.n)}${m.hot ? '<em>招牌</em>' : ''}</div>
                    <div class="gyto-dp">￥${esc(m.p)}</div>
                </div>
                <div class="gyto-step">
                    ${c[m.id] ? `<button type="button" onclick="gytoAdd('${s.id}','${m.id}',-1)">−</button><b>${c[m.id]}</b>` : ''}
                    <button type="button" class="add" onclick="gytoAdd('${s.id}','${m.id}',1)">＋</button>
                </div>
            </div>`).join('')}
        <div class="gyto-order-box">
            <div class="input-group" style="margin-bottom:8px;">
                <label style="font-size:12px;">给谁点</label>
                <select id="gytoFor" class="gyto-in">
                    <option value="me">给我自己</option>
                    ${chars().map(x => `<option value="${x.id}">送给 ${esc(x.name)}</option>`).join('')}
                </select>
            </div>
            <input type="text" id="gytoNote" class="gyto-in" placeholder="备注：不要香菜 / 多加辣 / 放门口">
            <div class="gyto-pay">
                <div>
                    <b>￥${money(p + (n ? (Number(s.fee) || 0) : 0))}</b>
                    <em>${n ? n + ' 件' + (s.fee ? '　含配送费 ￥' + s.fee : '') : '购物车是空的'}</em>
                </div>
                <button type="button" class="gyto-sub ${enough ? '' : 'off'}"
                    onclick="${enough ? `gytoOrder('${s.id}')` : ''}">
                    ${n === 0 ? '选点东西' : '去下单'}
                </button>
            </div>
        </div>`;
    }

    function orderList() {
        if (!S.orders.length) return `<div class="gymall-empty">还没点过外卖。</div>`;
        return S.orders.map(o => {
            const si = stepOf(o);
            return `<div class="gyto-ord">
                <div class="gyto-ord-hd">
                    <b>${esc(o.shopIco || '🍜')} ${esc(o.shopName)}</b>
                    <span class="${o.status === 'done' ? 'ok' : ''}">${STEPS[si]}　${etaText(o)}</span>
                </div>
                <div class="gyto-ord-it">${o.items.map(x => esc(x.n) + (x.q > 1 ? '×' + x.q : '')).join('、')}</div>
                <div class="gyto-ord-sub">送给 ${esc(nameOf(o.forWhom))}　·　骑手 ${esc(o.riderName)}${o.note ? '　·　备注：' + esc(o.note) : ''}</div>
                <div class="gyto-rail">${STEPS.map((t, i) => `<i class="${i <= si ? 'on' : ''}"></i>`).join('')}</div>
                <div class="gyto-ord-ft">
                    <span>合计 ￥${money(o.total)}</span>
                    ${o.status !== 'done' ? `<button type="button" class="gymall-btn ghost" onclick="gytoNow('${o.id}')">⚡ 立即送达</button>` : ''}
                    ${o.receiptId ? `<button type="button" class="gymall-btn ghost" onclick="gytoReceipt('${o.id}')">🧾 外卖单</button>` : ''}
                </div>
                ${rcOpen === o.id && o.receiptId && typeof gyReceiptHtml === 'function' ? gyReceiptHtml(o.receiptId) : ''}
            </div>`;
        }).join('');
    }
    /* ⚡ 立即送达：把 eta 抹掉让它"已经到了"，然后照常走 tick——
       送达提示、角色的反应一样都不少，只是不用等那半小时。 */
    window.gytoNow = async function (id) {
        const o = S.orders.find(x => x.id === id);
        if (!o || o.status === 'done') return;
        o.at = Date.now() - 1; o.etaMs = 0;
        await save();
        await tick();
        render();
    };
    let rcOpen = null;
    window.gytoReceipt = id => { rcOpen = (rcOpen === id) ? null : id; render(); };

    function newShopForm() {
        return `
        <div class="gyto-form">
            <div class="form-hint">自己开一家店：店名、老板是谁、什么脾气、卖什么，全都你说了算。
                老板可以指到某个角色身上——那家店就是 TA 开的。</div>
            <input type="text" id="gytoNName" class="gyto-in" placeholder="店名，例：巷口那家面馆">
            <input type="text" id="gytoNIco" class="gyto-in" placeholder="一个 emoji，例：🍜">
            <input type="text" id="gytoNCui" class="gyto-in" placeholder="品类，例：面馆">
            <input type="text" id="gytoNDesc" class="gyto-in" placeholder="一句简介，例：做了很多年了，街坊常来">
            <select id="gytoNOwner" class="gyto-in">
                <option value="">老板：不指定（就是个陌生老板）</option>
                ${chars().map(c => `<option value="${c.id}">老板：${esc(c.name)}</option>`).join('')}
            </select>
            <input type="text" id="gytoNTrait" class="gyto-in" placeholder="老板是个什么人（会写进备注回复的口吻）">
            <div style="display:flex;gap:6px;">
                <input type="number" id="gytoNMin" class="gyto-in" placeholder="起送价" style="flex:1;">
                <input type="number" id="gytoNFee" class="gyto-in" placeholder="配送费" style="flex:1;">
                <input type="number" id="gytoNEta" class="gyto-in" placeholder="送达分钟" style="flex:1;">
            </div>
            <textarea id="gytoNMenu" class="gyto-in" rows="5" placeholder="菜单，一行一道：&#10;牛肉面 22&#10;小馄饨 14&#10;卤蛋 3"></textarea>
            <button type="button" class="gymall-btn solid" style="width:100%;" onclick="gytoSaveShop()">开张</button>
        </div>`;
    }
    window.gytoSaveShop = async function () {
        const g = id => (document.getElementById(id) || {}).value || '';
        const name = g('gytoNName').trim();
        if (!name) return toast('先给它起个店名');
        const menu = g('gytoNMenu').split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
            const m = l.match(/^(.*?)[\s　]+(\d+(?:\.\d+)?)$/);
            return { id: 'i' + i + Math.random().toString(36).slice(2, 5),
                     n: (m ? m[1] : l), p: m ? Math.round(parseFloat(m[2])) : 15, hot: i === 0 };
        });
        const base = randomShop();
        S.shops.unshift(Object.assign(base, {
            name: name,
            ico: g('gytoNIco').trim() || base.ico,
            cuisine: g('gytoNCui').trim() || base.cuisine,
            desc: g('gytoNDesc').trim() || base.desc,
            ownerId: g('gytoNOwner'),
            ownerTrait: g('gytoNTrait').trim() || base.ownerTrait,
            minOrder: parseFloat(g('gytoNMin')) || 0,
            fee: parseFloat(g('gytoNFee')) || 0,
            eta: parseInt(g('gytoNEta')) || base.eta,
            menu: menu.length ? menu : base.menu,
            byUser: true
        }));
        await save();
        tab = 'shops'; render();
        toast('「' + name + '」开张了');
    };

    // 通知别的面板"外卖数据变了"（全局帮手可能还没装上，所以要判断）
    function changedNote() {
        try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged('takeout'); } catch (e) {}
    }
    const changed = changedNote;
    function render() {
        const box = document.getElementById('gyTakeoutBody');
        if (box) box.innerHTML = window.gyTakeoutHtml();
    }
    window.gyTakeoutRender = render;

    /* ---------- 开关 ---------- */
    function addSwitches() {
        try {
            if (typeof AUTO_FEATURE_DEFS === 'undefined' || !Array.isArray(AUTO_FEATURE_DEFS)) return;
            if (typeof AUTO_FEATURE_GROUPS !== 'undefined' && Array.isArray(AUTO_FEATURE_GROUPS)
                && !AUTO_FEATURE_GROUPS.some(g => g.key === '外卖')) {
                AUTO_FEATURE_GROUPS.push({ key: '外卖', icon: '🛵', title: '外卖',
                    note: '商城卖的是"东西"，外卖卖的是"这一顿"——几十分钟就到，店本身有性格。整组默认关着。' });
            }
            const defs = [
                { key: 'takeoutOn', label: '外卖（总开关）',
                  desc: '在商城里多一页「外卖」：附近的店、菜单、购物车、下单、骑手配送、送达提示。店可以随机开、也可以自己开，老板还能指到某个角色身上。关掉就当这一页不存在。',
                  cost: '不调 API', defaultOff: true, group: '外卖', where: '小功能 → 商城 → 外卖' },
                { key: 'takeoutAiShop', label: '让模型开店（店铺有老板、有脾气）',
                  desc: '不用本地词根拼店名，而是让模型写一家完整的店：店名、品类、简介、老板是个什么人、五到八道菜和价格。写出来的店比拼出来的有人味。',
                  cost: '开一家店一次调用（只在你点那颗按钮时）', defaultOff: true, group: '外卖', where: '商城 → 外卖 → 附近的店 → ✨ 让模型开一家' },
                { key: 'takeoutReact', label: '给角色点的外卖到了，TA 可能说一句',
                  desc: '外卖送到角色手上时，TA 按人设决定要不要提——道谢、吐槽、"你怎么知道我想吃这个"，也可能什么都不说。',
                  cost: '每份送到角色手上的外卖一次调用', group: '外卖', where: '私聊里' }
            ];
            defs.forEach(d => { if (!AUTO_FEATURE_DEFS.some(x => x.key === d.key)) AUTO_FEATURE_DEFS.push(d); });
        } catch (e) { console.warn('[外卖] 注册开关失败：', e); }
    }

    /* ---------- 样式 ---------- */
    const CSS = `
    .gyto-tabs{display:flex;gap:6px;margin-bottom:12px;}
    .gyto-t{font-size:13px;padding:6px 12px;border-radius:999px;cursor:pointer;
        border:1px solid rgba(128,128,128,.28);color:#8b98a5;transition:.15s;}
    .gyto-t.on{background:var(--mc,var(--gy-accent));color:#fff;border-color:transparent;}
    .gyto-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
    .gyto-cnt{font-size:11.5px;color:#8b98a5;}
    .gyto-shop{display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:10px;cursor:pointer;
        border:1px solid rgba(128,128,128,.2);border-radius:12px;transition:.15s;}
    .gyto-shop:hover{background:rgba(128,128,128,.06);}
    .gyto-logo{width:52px;height:52px;border-radius:12px;flex-shrink:0;font-size:26px;
        display:flex;align-items:center;justify-content:center;background:rgba(128,128,128,.1);}
    .gyto-logo.big{width:46px;height:46px;font-size:23px;}
    .gyto-si{min-width:0;flex:1;}
    .gyto-sn{font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
    .gyto-sn i{font-style:normal;font-size:10px;font-weight:500;color:#8b98a5;
        border:1px solid rgba(128,128,128,.3);border-radius:3px;padding:0 5px;}
    .gyto-sr{font-size:11.5px;color:#8b98a5;margin-top:2px;}
    .gyto-sd{font-size:12px;color:#8b98a5;margin-top:2px;}
    .gyto-sf{font-size:11.5px;color:var(--mc,var(--gy-accent));margin-top:3px;}
    .gyto-go{color:#8b98a5;font-size:20px;}
    .gyto-hd{display:flex;align-items:center;gap:10px;padding-bottom:10px;margin-bottom:8px;
        border-bottom:1px solid rgba(128,128,128,.18);}
    .gyto-back{cursor:pointer;font-size:19px;color:var(--mc,var(--gy-accent));padding:2px 6px;}
    .gyto-owner{font-size:12.5px;color:#8b98a5;line-height:1.7;background:rgba(128,128,128,.07);
        border-radius:9px;padding:9px 11px;margin-bottom:10px;}
    .gyto-owner b{color:inherit;margin-right:6px;}
    .gyto-dish{display:flex;align-items:center;gap:10px;padding:10px 2px;
        border-bottom:1px solid rgba(128,128,128,.12);}
    .gyto-dn{font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:6px;}
    .gyto-dn em{font-style:normal;font-size:10px;background:var(--mc,var(--gy-accent));color:#fff;
        border-radius:3px;padding:0 5px;}
    .gyto-dp{font-size:13px;color:var(--mc,var(--gy-accent));font-weight:700;margin-top:2px;}
    .gyto-step{display:flex;align-items:center;gap:7px;}
    .gyto-step button{width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;line-height:1;
        border:1px solid var(--mc,var(--gy-accent));background:transparent;color:var(--mc,var(--gy-accent));}
    .gyto-step button.add{background:var(--mc,var(--gy-accent));color:#fff;}
    .gyto-step b{min-width:14px;text-align:center;font-size:13px;}
    .gyto-order-box{margin-top:14px;padding-top:12px;border-top:1px dashed rgba(128,128,128,.3);}
    .gyto-in{width:100%;padding:9px;margin-bottom:8px;border-radius:9px;background:transparent;
        color:inherit;border:1px solid rgba(128,128,128,.3);box-sizing:border-box;font-family:inherit;}
    .gyto-pay{display:flex;align-items:center;gap:12px;margin-top:4px;}
    .gyto-pay b{font-size:19px;}
    .gyto-pay em{display:block;font-style:normal;font-size:11.5px;color:#8b98a5;}
    .gyto-sub{margin-left:auto;padding:11px 22px;border-radius:999px;border:none;cursor:pointer;
        background:var(--mc,var(--gy-accent));color:#fff;font-weight:700;font-size:13.5px;}
    .gyto-sub.off{background:rgba(128,128,128,.35);cursor:default;}
    .gyto-ord{border:1px solid rgba(128,128,128,.2);border-radius:12px;padding:12px;margin-bottom:10px;}
    .gyto-ord-hd{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;}
    .gyto-ord-hd span{font-size:12px;color:var(--mc,var(--gy-accent));white-space:nowrap;}
    .gyto-ord-hd span.ok{color:var(--gy-ok);}
    .gyto-ord-it{font-size:12.5px;color:#8b98a5;margin-top:4px;}
    .gyto-ord-sub{font-size:11.5px;color:#8b98a5;margin-top:2px;}
    .gyto-rail{display:flex;gap:3px;margin:8px 0 6px;}
    .gyto-rail i{flex:1;height:3px;border-radius:2px;background:rgba(128,128,128,.25);}
    .gyto-rail i.on{background:var(--mc,var(--gy-accent));}
    .gyto-ord-ft{display:flex;align-items:center;gap:10px;font-size:12.5px;}
    .gyto-ord-ft button{margin-left:auto;}
    .gyto-form .gyto-in{margin-bottom:8px;}
    @media(max-width:600px){.gyto-logo{width:44px;height:44px;font-size:22px;}}
    `;
    function mount() {
        if (document.getElementById('gytoCss')) return;
        const st = document.createElement('style'); st.id = 'gytoCss'; st.textContent = CSS;
        document.head.appendChild(st);
    }

    (async function init() {
        mount();
        addSwitches();
        await load();
        // 第一次打开先摆三家店，不然是个空页面
        if (!S.shops.length) {
            const used = new Set();
            for (let i = 0; i < 5; i++) {
                const sh = randomShop();
                if (used.has(sh.name)) { i--; continue; }
                used.add(sh.name); S.shops.push(sh);
            }
            await save();
        }
        setInterval(tick, 60 * 1000);
        tick();
    })();
})();
