/* ============================================================
   js/52 —— 💬 说到做到：角色在聊天里能真的去做事
   ------------------------------------------------------------
   以前角色在私聊里说"我现在给你打电话""转你两百""五分钟后一起看电影"，
   说完就完了——打电话、转账、邀请卡这些功能明明都做好了，却只有你点按钮才会发生。
   现在 TA 说要做、并且真打算做的时候，会在那条回复里带一个看不见的标记，这边照着真的执行：
     📞 打电话（弹来电页面）   💸 转账 / 🧧 红包（私聊里一张票据，你点收）
     🎬🎧📖🤝 约看电影 / 听歌 / 读书 / 出去（私聊里一张邀请卡）
     🛵 给你点外卖   🎁 给你买东西（包裹卡）   ✉️ 写信   🐦 发推文
     📔 写日记（进 TA 自己的日记本，不是信）   🎭 匿名论坛发帖   🏛️ 论坛发帖   🌀 发朋友圈
     📰 给营销号递料   🗣️ 讲八卦   🟢 换自己此刻的状态   📝 记一条待办
     …以及自主模式那张动作表里的**每一件**（上网、给自己点外卖、刷手机、改签名……）：
     这张表里没有的名字，会去 GY_AUTONOMY_ACTIONS 里找（"桥"），聊天 prompt 里也会一起列出来。
   名字怎么认：先一字不差；再找"被包含的最长那个名字"——以前是数组里第一个碰上就算，
   「信」吃掉了"写日记"那句里的请求、「发帖」把"匿名论坛发帖"吃成了发推文。
   方向：对方开口让做的，做的时候会告诉那件事"这是对方让你做的"（写日记、匿名发帖的内容会跟着变）。
   能带时间："五分钟后一起看电影" → 五分钟后邀请卡才弹出来（刷新页面也不会丢）。

   两种模式跟着角色资料页里的「行为模式」走：
     · TA 自己决定（actMode = auto）：列表只是"你做得到这些"，做不做 TA 自己判断——
       说了不一定做，你开口要求也可以不答应（看关系、看性子、看处境）。
     · 默认（按固定频率）：说到就做到，你开口要求的也照办。为了保证"说了就做"，
       模型忘了带标记的时候，这边还会从话里认一遍最常见的几件（打电话、转账、约看电影/听歌）。

   私聊、群聊都生效。群里做的事都是冲着你一个人的（电话、转账、邀请卡都私下发给你），
   "⏰ 说好几点做"那一行出现在 TA 说这句话的那个聊天里。群里只认标记，不从话里猜——
   群里的"你"可能是在跟别的成员说话。
   开关：设置 → 自动化 →「💬 聊天里说到做到」，默认开；关掉＝完全回到以前，只说不做。
   各功能自己的开关照样算数：钱包没开就不会有转账，外卖没开就不会点外卖。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyChatActsLoaded) return;
    window.__gyChatActsLoaded = true;

    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []);
    const charOf = id => chars().find(c => String(c.id) === String(id)) || null;
    const autoOn = k => (typeof isAutoOn === 'function') ? isAutoOn(k) : false;
    const featureOn = () => (typeof isAutoOn === 'function') ? isAutoOn('chatActions') : true;
    const modeOf = c => (typeof getCharActMode === 'function') ? getCharActMode(c) : 'fixed';
    const uname = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : '对方';
    const num = v => { const n = parseFloat(String(v || '').replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };

    function sysLine(charId, text) {
        try {
            const sid = String(charId);
            if (!globalChats[sid]) globalChats[sid] = [];
            globalChats[sid].push({ sender: 'system', text, timestamp: Date.now(), readBy: [] });
            if (typeof saveAllData === 'function') saveAllData();
            refresh(sid);
        } catch (e) {}
    }
    function refresh(sid) {
        try {
            const v = document.getElementById('view-chat');
            if (String(currentChatSessionId) === String(sid) && v && v.style.display !== 'none') { if (typeof renderChatMessages === 'function') renderChatMessages(); }
            else if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) {}
    }
    function invite(kind) {
        return async (c, args) => {
            if (typeof window.gyInviteFromChar !== 'function') return null;
            const K = (window.GY_INVITE_KINDS || {})[kind];
            const title = String(args[0] || '').trim(), sub = String(args[1] || '').trim();
            // 片名 / 书名 / 歌名 → 找到库里真的那一部（js/28），点「好啊」直接进那一部，不是随便开个放映厅
            let extra = null;
            try { extra = (window.gyInviteResolveItem && title) ? await window.gyInviteResolveItem(kind, title) : null; } catch (e) { extra = null; }
            const inv = window.gyInviteFromChar(Object.assign({ char: c, kind, title, sub }, extra || {}, {
                onYes: (iv) => { try { if (K && K.accept) K.accept(iv || inv || { charId: String(c.id) }); } catch (e) {} }
            }));
            return inv ? ((K ? K.name : '邀请') + (title ? '「' + title + '」' : '')) : null;
        };
    }
    // 自主模式那张动作表里的某一项（js/14、js/58 等往里加的）
    const autoActs = () => { try { return (typeof GY_AUTONOMY_ACTIONS !== 'undefined' && Array.isArray(GY_AUTONOMY_ACTIONS)) ? GY_AUTONOMY_ACTIONS : []; } catch (e) { return []; } };
    const autoAct = key => autoActs().find(a => a && a.key === key) || (window.GY_MORE_ACTS || []).find(a => a && a.key === key) || null;
    const autoNeed = (key, c) => { const a = autoAct(key); try { return !!(a && typeof a.run === 'function' && (!a.need || a.need(c))); } catch (e) { return false; } };
    // 自主动作的返回值可能是字符串，也可能是 {text, jump…}
    const resText = (r, dflt) => (r && typeof r === 'object') ? (r.text || dflt) : (r || null);
    // 这件事是谁的主意：对方让做的（'user'）还是 TA 自己想做的（'self'）。写进那件事的方向里，让生成的内容知道
    const dirNote = (c, by) => by === 'user' ? `这是${uname(c)}在聊天里让你去做的` : '这是你自己想做的';
    const withDir = (c, topic, by) => { const t = String(topic || '').trim(); return by === 'user' ? (t ? t + '（' + dirNote(c, by) + '）' : dirNote(c, by) + '，具体写什么由你定') : t; };
    const byOf = c => { const d = window.__gyActBy; return (d && String(d.charId) === String(c.id) && d.by) || 'self'; };
    const walletOn = () => !!(window.gyWallet && typeof window.gyWallet.send === 'function' && autoOn('walletOn'));

    // 动作表。names：模型可能写的各种叫法；once：同一轮里只做一次（防止两条气泡各带一个、打两次电话）
    const ACTS = [
        { key: 'call', short: '给你打电话', names: ['打电话', '电话', '语音', '视频', 'call'], once: true,
          syntax: '[ACT:打电话|这会儿想打的理由]', label: '给对方打个电话（对方那边会弹来电页面）',
          need: () => typeof window.gyCallRing === 'function',
          run: async (c, args) => window.gyCallRing(c, args[0] || '') ? '打来了电话' : null },
        { key: 'money', short: '给你转账', names: ['转账', '转钱', 'transfer', 'money'], once: true,
          syntax: '[ACT:转账|金额|留言]', label: '给对方转账（私聊里一张转账单，对方点收）',
          need: walletOn,
          run: async (c, args) => { const amt = num(args[0]); if (amt <= 0) return null;
              const mo = await window.gyWallet.send({ from: String(c.id), to: 'me', amt, note: args[1] || '', kind: 'transfer' });
              return mo ? '转账 ￥' + amt : null; } },
        { key: 'red', short: '给你发红包', names: ['红包', '发红包', 'red'], once: true,
          syntax: '[ACT:红包|金额|留言]', label: '给对方发红包',
          need: walletOn,
          run: async (c, args) => { const amt = num(args[0]); if (amt <= 0) return null;
              const mo = await window.gyWallet.send({ from: String(c.id), to: 'me', amt, note: args[1] || '', kind: 'red' });
              return mo ? '红包 ￥' + amt : null; } },
        { key: 'film', short: '约你一起看电影', names: ['约看电影', '看电影', '电影', 'film', 'movie'], once: true,
          syntax: '[ACT:约看电影|片名（可不写）]', label: '约对方一起看电影（发一张邀请卡，对方点好啊就进放映厅）',
          need: () => typeof window.gyInviteFromChar === 'function', run: invite('film') },
        { key: 'music', short: '约你一起听歌', names: ['约听歌', '听歌', '一起听', 'music'], once: true,
          syntax: '[ACT:约听歌|歌名（可不写）]', label: '约对方一起听歌',
          need: () => typeof window.gyInviteFromChar === 'function', run: invite('music') },
        { key: 'read', short: '约你一起读书', names: ['约读书', '一起读', '读书', '阅读', 'read'], once: true,
          syntax: '[ACT:约读书|书名（可不写）]', label: '约对方一起读书',
          need: () => typeof window.gyInviteFromChar === 'function', run: invite('read') },
        { key: 'date', short: '约你出去', names: ['约出去', '约你出去', '约会', '出去', '见面', 'date'], once: true,
          syntax: '[ACT:约出去|去哪儿|几点/做什么]', label: '约对方出去见面（在地图上挑个真地方）',
          need: () => typeof window.gyInviteFromChar === 'function' || typeof window.gymapCharInvite === 'function',
          // 有地图就用地图：挑一个真的地点，你答应了真的一起去、会记进行程；没地点可挑才退回普通邀请卡
          run: async (c, args) => {
              if (typeof window.gymapCharInvite === 'function') {
                  try { const sp = await window.gymapCharInvite(c.id); if (sp) return '约你去「' + sp + '」'; } catch (e) {}
              }
              return typeof window.gyInviteFromChar === 'function' ? invite('date')(c, args) : null;
          } },
        { key: 'takeout', short: '给你点外卖', names: ['点外卖', '外卖', 'takeout'], once: true,
          syntax: '[ACT:点外卖|想给对方点的吃的]', label: '给对方点一份外卖（真的下单，按时送到）',
          need: () => typeof window.gytoCharOrder === 'function' && autoOn('takeoutOn'),
          run: async (c, args) => { const r = await window.gytoCharOrder(c.id, args[0] || ''); return r ? '点了外卖「' + r.shop + '」' : null; } },
        { key: 'gift', short: '给你买东西', names: ['买礼物', '送礼物', '买东西', '礼物', 'gift'], once: true,
          syntax: '[ACT:买礼物|想买的东西]', label: '在商城给对方买样东西（包裹寄到对方那儿）',
          need: () => typeof window.gymallCharBuy === 'function' && typeof window.gymallHasProducts === 'function' && window.gymallHasProducts(),
          run: async (c, args) => { const n = await window.gymallCharBuy(c.id, 'me', args[0] || '', args[1] || ''); return n ? '买了「' + n + '」' : null; } },
        { key: 'letter', short: '给你写信', names: ['写信', '回信', '寄信', '写封信', '写一封信', 'letter'], once: true,
          syntax: '[ACT:写信]', label: '给对方写一封信',
          need: () => typeof generateProactiveLetter === 'function',
          run: async (c) => { const ok = await generateProactiveLetter(c); if (ok === false) return null;
              try { c.lastLetterProactiveTime = Date.now(); if (typeof window.gyTaAfter === 'function') window.gyTaAfter(c, 'letter'); } catch (e) {}
              return '写了封信'; } },
        { key: 'diary', short: '去写日记', names: ['写日记', '写篇日记', '记日记', '日记', 'diary'], once: true,
          syntax: '[ACT:写日记|想写的方向（可不写）]', label: '写一篇自己的日记（写进你的日记本，不是寄给对方的信）',
          need: () => typeof autonomyWriteDiary === 'function',
          run: async (c, args) => { const r = await autonomyWriteDiary(c, String(args[0] || '').trim(), byOf(c)); return r || null; } },
        { key: 'anon', short: '去匿名区发帖', names: ['匿名论坛发帖', '匿名发帖', '匿名论坛', '匿名区', '匿名版', '匿名', 'anon'], once: true,
          syntax: '[ACT:匿名论坛发帖|想发的内容/方向]', label: '去匿名论坛发一条（不署名；不是推文）',
          need: () => typeof autoGenerateAnonPostForChar === 'function',
          run: async (c, args) => { const r = await autoGenerateAnonPostForChar(c, withDir(c, args[0], byOf(c)));
              if (r && r.success === false) return null;
              try { c.lastAnonPostTime = Date.now(); if (typeof window.gyTaAfter === 'function') window.gyTaAfter(c, 'anon'); } catch (e) {}
              return '在匿名区发了一条'; } },
        { key: 'forum', short: '去论坛发帖', names: ['论坛发帖', '论坛开帖', '论坛', 'forum'], once: true,
          syntax: '[ACT:论坛发帖|想聊的话题]', label: '用自己的身份去论坛发一个帖子（不是推文）',
          need: () => typeof autoGenerateForumThreadForChar === 'function',
          run: async (c, args) => { const r = await autoGenerateForumThreadForChar(c, withDir(c, args[0], byOf(c)));
              if (r && r.success === false) return null;
              try { c.lastForumPostTime = Date.now(); if (typeof window.gyTaAfter === 'function') window.gyTaAfter(c, 'forum'); } catch (e) {}
              return '在论坛发了个帖'; } },
        { key: 'moment', short: '发朋友圈', names: ['发朋友圈', '朋友圈', 'moment'], once: true,
          syntax: '[ACT:发朋友圈|想发的内容]', label: '发一条朋友圈（只有熟人看得到，不是推文）',
          need: c => autoNeed('moment_self', c),
          run: async (c, args) => resText(await autoAct('moment_self').run(c, withDir(c, args[0], byOf(c))), '发了条朋友圈') },
        { key: 'tabloid', short: '给营销号递料', names: ['给营销号递料', '营销号', '递料', '爆料', 'tabloid'], once: true,
          syntax: '[ACT:给营销号递料|料的内容]', label: '给八卦营销号递一条料，让它去写',
          need: () => typeof autonomyFeedTabloid === 'function' && typeof myCharacters !== 'undefined' && myCharacters.length > 1,
          run: async (c, args) => resText(await autonomyFeedTabloid(c, String(args[0] || '').trim()), '给营销号递了料') },
        { key: 'gossip', short: '跟你八卦', names: ['八卦网', '讲八卦', '八卦', 'gossip'], once: true,
          syntax: '[ACT:八卦]', label: '把听来的一件八卦讲给对方',
          need: c => autoNeed('gossip_tell', c),
          run: async (c) => resText(await autoAct('gossip_tell').run(c, ''), '跟你八卦了一件事') },
        { key: 'post', short: '发推文', names: ['发推文', '发推', '发动态', '推文', 'post'], once: true,
          syntax: '[ACT:发推文]', label: '发一条推文',
          need: () => typeof executeGeneration === 'function',
          run: async (c) => { await executeGeneration([c]);
              try { c.lastPostTime = Date.now(); if (typeof window.gyTaAfter === 'function') window.gyTaAfter(c, 'post'); } catch (e) {}
              return '发了条推文'; } },
        { key: 'status', short: '换状态', names: ['状态', '换状态', '去做', 'status'],
          syntax: '[ACT:状态|你接下来在干嘛，10字以内]', label: '换一下自己此刻在做的事（去洗澡、出门、开会……会更新你的状态）',
          need: () => typeof saveCharLifeState === 'function',
          run: async (c, args) => { const t = String(args[0] || '').trim(); if (!t) return null;
              saveCharLifeState(c, t, null); if (typeof saveAllData === 'function') saveAllData();
              try { if (typeof window.gyAutonomyRefreshViews === 'function') window.gyAutonomyRefreshViews(c, 'status'); } catch (e) {}
              return '状态：' + t; } },
        { key: 'todo', short: '记待办', names: ['记待办', '待办', '记下', 'todo'],
          syntax: '[ACT:记待办|要记的事]', label: '往自己的待办里记一件事（答应了对方的事、想起来要做的事）',
          need: () => typeof autonomyAddTodo === 'function',
          run: async (c, args) => { if (!args[0]) return null; const r = await autonomyAddTodo(c, args[0]); return r || ('记下了：' + args[0]); } }
    ];
    window.GY_CHAT_ACTS = ACTS;   // 别的模块想加动作就往这里 push（结构同上）

    const needOk = (a, c) => { try { return !!a.need(c); } catch (e) { return false; } };

    /* ---------- 桥：上面这张表里没有的事，去自主模式那张大表里找（上网、给自己点外卖、刷手机、改签名……） ----------
       所以你在聊天里让 TA 做任何一件 TA 本来做得到的事，TA 都能真的去做——默认模式、自主模式都一样。 */
    const BRIDGE_SKIP = { nothing: 1, diary_peek: 1, chat: 1 };
    // 上面那张表已经管了的，自主表里对应的那一项就不重复列
    const COVERED = { letter: 'letter', post: 'post', diary: 'diary', anon: 'anon', forum: 'forum', moment: 'moment_self', tabloid: 'tabloid',
        gossip: 'gossip_tell', status: 'status', todo: 'todo_add', call: 'call_invite', money: 'money_user', film: 'film_invite',
        music: 'music_invite', read: 'read_invite', date: 'invite_user', takeout: 'takeout_user', gift: 'gift_user' };
    const coveredKeys = () => { const s = {}; ACTS.forEach(a => { if (COVERED[a.key]) s[COVERED[a.key]] = 1; }); return s; };
    const hintOf = a => { try { const h = a.hint; return String((typeof h === 'function' ? h() : h) || ''); } catch (e) { return ''; } };
    const labelOf = a => String(a.label || a.short || a.key || '');
    const bridgeName = a => String(a.short || a.key);
    const bridgeDefs = {};
    function bridgeDef(key) {
        const a = autoAct(key);
        if (!a || BRIDGE_SKIP[key] || typeof a.run !== 'function') return null;
        if (!bridgeDefs[key] || bridgeDefs[key].__src !== a) {
            bridgeDefs[key] = {
                key: 'auto:' + key, __src: a, short: a.short || labelOf(a), label: labelOf(a), once: true, bridge: true,
                need: c => { try { return !a.need || !!a.need(c); } catch (e) { return false; } },
                run: async (c, args) => {
                    const r = await a.run(c, (args || []).join('|'));
                    const t = resText(r, labelOf(a));
                    // 跟自主模式做的一样记一笔：时间卡上的"上一次"、自主日志里都看得到
                    try { if (t && typeof gyAutonomyLog === 'function') gyAutonomyLog(c, { at: Date.now(), charId: c.id, charName: c.name, action: key, label: labelOf(a), reason: byOf(c) === 'user' ? '聊天里对方让做的' : '聊天里说到做到', result: t, ok: true, fromChat: true }); } catch (e) {}
                    return t;
                }
            };
        }
        return bridgeDefs[key];
    }
    const defOf = key => { const k = String(key || ''); return k.indexOf('auto:') === 0 ? bridgeDef(k.slice(5)) : (ACTS.find(x => x.key === k) || null); };

    // 找动作：先一字不差；再在「聊天动作 + 自主动作」里找**最长**的那个被包含的名字（不是数组里第一个碰上的）。
    // 以前是第一个碰上就算：「信」把"写日记信""回信""微信"全吃掉，「发帖」把"匿名论坛发帖"吃成了发推文。
    function findAct(name) {
        const n = String(name || '').trim().toLowerCase();
        if (!n) return null;
        const exact = ACTS.find(a => a.key === n || a.names.some(x => x.toLowerCase() === n));
        if (exact) return exact;
        let best = null, bestLen = 0;
        const consider = (def, len) => { if (def && len > bestLen) { best = def; bestLen = len; } };
        const autos = autoActs().filter(a => a && a.key && !BRIDGE_SKIP[a.key]);
        // 自主动作的 key / 简称一字不差
        for (const a of autos) {
            if (String(a.key).toLowerCase() === n || String(a.short || '').toLowerCase() === n || labelOf(a).toLowerCase() === n) return bridgeDef(a.key);
        }
        ACTS.forEach(a => a.names.forEach(x => { const xl = x.toLowerCase(); if (xl && n.indexOf(xl) !== -1) consider(a, xl.length); }));
        autos.forEach(a => {
            const sh = String(a.short || '').toLowerCase(), lb = labelOf(a).toLowerCase(), k = String(a.key).toLowerCase();
            if (sh && n.indexOf(sh) !== -1) consider(bridgeDef(a.key), sh.length);
            if (k.length > 3 && n.indexOf(k) !== -1) consider(bridgeDef(a.key), k.length);
            // 模型写的是标签里的一截（"给自己点份外卖" 里的 "点份外卖"）：要比已有的更长才算，免得两个字就抢走
            if (n.length >= 3 && lb.indexOf(n) !== -1) consider(bridgeDef(a.key), n.length - 0.5);
        });
        return best;
    }

    /* ---------- 时间："@5" / "@5分钟" / "@1小时" / "5分钟后" ---------- */
    const CN = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5 };
    function cnNum(s) {
        if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
        if (s === '十') return 10;
        let m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
        if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
        if (s.length === 1 && CN[s] !== undefined) return CN[s];
        return NaN;
    }
    function toMinutes(n, unit) {
        if (!isFinite(n) || n <= 0) return 0;
        if (/小时|h/i.test(unit || '')) return n * 60;
        if (/秒|s/i.test(unit || '')) return n / 60;
        return n;
    }

    function parseBody(body) {
        const parts = String(body).split(/[|｜]/).map(x => x.trim());
        let head = parts.shift() || '';
        let delay = 0;
        const dm = head.match(/@\s*(\d+(?:\.\d+)?)\s*(小时|h|分钟|分|min|m|秒|s)?\s*$/i);
        if (dm) { delay = toMinutes(parseFloat(dm[1]), dm[2]); head = head.slice(0, dm.index).trim(); }
        const args = [];
        parts.forEach(p => {
            const m = p.match(/^@\s*(\d+(?:\.\d+)?)\s*(小时|h|分钟|分|min|m|秒|s)?$/i);
            if (m) delay = toMinutes(parseFloat(m[1]), m[2]); else args.push(p);
        });
        const a = findAct(head);
        return a ? { key: a.key, args, delay, name: head } : null;
    }

    /* ---------- 默认模式的兜底：话里说了、却忘了带标记 ---------- */
    const DELAY_RE = /([0-9]+|[一二两三四五六七八九十半]{1,3})\s*(个)?\s*(分钟|小时)\s*(之?后|以后|过后)/;
    function delayOf(sent) {
        const m = sent.match(DELAY_RE);
        return m ? toMinutes(cnNum(m[1]), m[3]) : 0;
    }
    const NEG = /(不|别|没|不要|不能|不想|不会|不用|甭|怎么|为什么|要不要|吗|？|\?)/;
    function sniff(text) {
        const acts = [];
        const sents = String(text || '').split(/(?<=[。！!？?\n～~])/);
        sents.forEach(s => {
            const pre = (re) => { const m = s.match(re); return m ? s.slice(0, m.index) : null; };
            // 打电话：我(现在/这就/等下)给你打(个)电话/视频
            let p = pre(/打\s*(个|一个)?\s*(电话|视频|语音)/);
            if (p !== null && /(我|这就|马上|现在|立刻|等下|等会|待会)/.test(p) && !NEG.test(p.slice(-6))
                && !/((^|[^给])你|给我)\s*$/.test(p.trim()) && !/(昨天|刚才|刚刚|之前|上次|那天|已经|前天)/.test(p))
                acts.push({ key: 'call', args: [], delay: delayOf(s) });
            // 转账 / 红包：给你转200、转你两百块、发你个520的红包
            const mm = s.match(/(转(给)?你|给你转|发(给)?你|给你发)[^。！？\n\d]{0,6}?(\d+(?:\.\d+)?)\s*(块|元|w|万)?/);
            if (mm && !NEG.test(s.slice(0, mm.index).slice(-5))) {
                let amt = parseFloat(mm[4]); if (/w|万/.test(mm[5] || '')) amt *= 10000;
                acts.push({ key: /红包/.test(s) ? 'red' : 'money', args: [String(amt), ''], delay: 0 });
            }
            // 约看电影 / 听歌：(我们/一起/陪你)…看电影，最好带时间
            if (/(看电影|看个电影|看部电影|看片)/.test(s) && /(一起|我们|咱们|陪你|带你)/.test(s) && !NEG.test(s))
                acts.push({ key: 'film', args: [], delay: delayOf(s) });
            if (/(听歌|听首歌)/.test(s) && /(一起|我们|咱们|陪你|放给你)/.test(s) && !NEG.test(s))
                acts.push({ key: 'music', args: [], delay: delayOf(s) });
            // 写日记 / 去匿名区 / 去论坛 / 发朋友圈：我(这就/先/去)写篇日记、我去匿名论坛发一条、我去论坛发个帖、我发个朋友圈
            const selfDo = (re, key) => {
                const q = pre(re); if (q === null) return false;
                const tail = q.slice(-8);
                if (!/(我|这就|马上|现在|立刻|等下|等会|待会|先|这就去|回头)/.test(q.slice(-10)) && !/^\s*(去|先去|这就去)/.test(q)) return false;
                if (NEG.test(tail) || /(昨天|刚才|刚刚|之前|上次|那天|已经|前天|你)\s*$/.test(q.trim())) return false;
                if (/(昨天|刚才|刚刚|之前|上次|那天|已经|前天)/.test(tail)) return false;
                acts.push({ key, args: [], delay: delayOf(s) });
                return true;
            };
            selfDo(/(写|记)\s*(篇|一篇|个|点|会儿|一会儿)?\s*日记/, 'diary');
            if (!selfDo(/(去|到|上)?\s*匿名(论坛|区|版)?\s*(里|上)?\s*(发|说|吐槽|写|问)/, 'anon'))
                selfDo(/(去|到|上)\s*论坛\s*(里|上)?\s*(发|开|写|问)/, 'forum');
            selfDo(/发\s*(个|条|一条|一下)?\s*朋友圈/, 'moment');
        });
        return acts;
    }

    /* ---------- 从一条回复里摘标记 ---------- */
    // 返回 {text: 去掉标记后的话, acts: [...]}
    window.gyChatActsExtract = function (text, char, isGroup) {
        const res = { text, acts: [] };
        try {
            if (!featureOn() || !text || !char) return res;
            let found = false;
            res.text = String(text).replace(/\[\s*ACT\s*[:：]\s*([^\]]*?)\s*\]/gi, (m0, body) => {
                found = true;
                const a = parseBody(body);
                if (a) res.acts.push(a);
                return '';
            }).replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
            if (!found && !isGroup && modeOf(char) !== 'auto') res.acts = sniff(res.text);
            res.acts = res.acts.filter(a => { const d = defOf(a.key); return d && needOk(d, char); });
        } catch (e) { console.warn('[说到做到] 解析出错（不影响消息本身）：', e); }
        return res;
    };

    /* ---------- 执行（立刻 / 过一会儿）---------- */
    const recentRun = {};   // `${charId}:${key}` → 时间，防同一轮两条气泡各做一次
    async function runOne(c, a) {
        const d = defOf(a.key);
        if (!d || !needOk(d, c)) return null;
        const k = String(c.id) + ':' + a.key;
        if (d.once && recentRun[k] && Date.now() - recentRun[k] < 90000) return null;
        recentRun[k] = Date.now();
        // 方向：是对方开口让做的，还是 TA 自己要做的——做那件事的时候（写日记、匿名发帖…）会带上
        const by0 = window.__gyActBy;
        window.__gyActBy = { by: a.by || 'self', charId: String(c.id) };
        try {
            const r = await d.run(c, a.args || []);
            if (r) console.info(`[说到做到] ${c.name}：${r}${a.by === 'user' ? '（对方让做的）' : ''}`);
            refresh(String(c.id));
            try { if (typeof window.gyAutonomyRefreshViews === 'function') window.gyAutonomyRefreshViews(c, String(a.key).replace(/^auto:/, '')); else if (typeof window.gyDataChanged === 'function') window.gyDataChanged('chatAct'); } catch (e) {}
            return r;
        } catch (e) { console.warn('[说到做到] 执行出错：', a, e); return null; }
        finally { window.__gyActBy = by0; }
    }
    window.gyChatActsRunOne = runOne;
    window.gyChatActsResetRecent = () => { Object.keys(recentRun).forEach(k => delete recentRun[k]); };   // 测试用：清掉「刚做过」的记录   // 测试 / 别的模块想直接做一件

    // 是不是对方开口让做的：最近几条对方的话里提到了这件事
    function askedByUser(sessionId, c, a) {
        try {
            const h = (typeof globalChats !== 'undefined' && globalChats) ? (globalChats[String(sessionId || c.id)] || []) : [];
            const mine = [];
            for (let i = h.length - 1; i >= 0 && mine.length < 3; i--) {
                const m = h[i]; if (!m) continue;
                if (m.sender === 'me' || m.sender === 'user') { if (Date.now() - (m.timestamp || 0) < 30 * 60000) mine.push(String(m.text || '')); }
                else if (m.sender !== 'system' && mine.length) break;   // 对方这几句之前 TA 已经回过了：更早的不算
            }
            if (!mine.length) return false;
            const said = mine.join('\n').toLowerCase();
            const d = defOf(a.key); if (!d) return false;
            const words = [].concat(d.names || [], a.name ? [a.name] : [], d.short ? [String(d.short).replace(/^(给你|去|约你|自己|给自己)/, '')] : [])
                .map(x => String(x || '').toLowerCase()).filter(x => x.length >= 2);
            return words.some(w => said.indexOf(w) !== -1) && /(你|去|帮|给|来|快|能不能|可以|要|让|写|发|做|吧)/.test(said);
        } catch (e) { return false; }
    }

    const QK = 'gy_chat_act_queue';
    let Q = [];
    try { Q = JSON.parse(localStorage.getItem(QK) || '[]') || []; } catch (e) { Q = []; }
    const saveQ = () => { try { localStorage.setItem(QK, JSON.stringify(Q)); } catch (e) {} };

    window.gyChatActsRun = function (char, sessionId, acts) {
        if (!char || !acts || !acts.length) return;
        acts.forEach((a, i) => {
            const d = defOf(a.key);
            if (!d) return;
            if (!a.by) a.by = askedByUser(sessionId, char, a) ? 'user' : 'self';
            if (a.delay && a.delay > 0.2) {
                const at = Date.now() + Math.round(a.delay * 60000);
                Q.push({ id: 'q' + Date.now().toString(36) + i, charId: String(char.id), key: a.key, args: a.args || [], at, by: a.by });
                saveQ();
                const t = new Date(at), pad = n => String(n).padStart(2, '0');
                sysLine(sessionId || char.id, `⏰ ${char.name} 说好 ${pad(t.getHours())}:${pad(t.getMinutes())} ${d.short || String(d.label || '').replace(/（.*$/, '')}`);
                try { if (typeof window.gyDataChanged === 'function') window.gyDataChanged('chatActQueue'); } catch (e) {}
            } else {
                // 稍等一下再做：让那句话先出现在屏幕上，像真人先说"我打给你"再拨号
                setTimeout(() => runOne(char, a), 1200 + i * 800);
            }
        });
    };

    async function tick() {
        if (!Q.length) return;
        const now = Date.now();
        const due = Q.filter(x => x.at <= now);
        if (!due.length) return;
        Q = Q.filter(x => x.at > now);
        saveQ();
        for (const x of due) {
            if (now - x.at > 6 * 3600000) continue;           // 过了太久（比如 app 关了一整天）就不补了
            const c = charOf(x.charId);
            if (c && featureOn()) await runOne(c, { key: x.key, args: x.args, delay: 0, by: x.by });
        }
    }
    setInterval(tick, 15000);
    setTimeout(tick, 5000);
    window.gyChatActsQueue = () => Q.slice();

    /* ---------- 写进聊天 prompt 的那一段 ---------- */
    window.gyChatActsPrompt = function (char, isGroup) {
        try {
            if (!featureOn() || !char) return '';
            const avail = ACTS.filter(a => needOk(a, char));
            const cov = coveredKeys();
            const more = autoActs().filter(a => a && a.key && !BRIDGE_SKIP[a.key] && !cov[a.key] && !ACTS.some(x => x.key === a.key) && typeof a.run === 'function'
                && (() => { try { return !a.need || a.need(char); } catch (e) { return false; } })());
            if (!avail.length && !more.length) return '';
            const who = uname(char);
            const list = avail.map(a => `- ${a.syntax}　${a.label}`).join('\n');
            const moreList = more.map(a => { const h = hintOf(a).replace(/param\s*填/g, '参数填'); return `- [ACT:${bridgeName(a)}${/参数|param/.test(hintOf(a)) ? '|参数' : ''}]　${labelOf(a)}${h ? '（' + h + '）' : ''}`; }).join('\n');
            const auto = modeOf(char) === 'auto';
            const rule = auto
                ? `这些都是你**真的做得到**的事，不是只能嘴上说。做不做由你自己判断：此刻想做、做得到、符合你的性子和你们现在的关系，就在那条回复里带上标记，系统会真的去做；只是随口一提、打算以后再说、或者你根本不想做，就别带。
${who}开口要你做（让你打电话、给你转账、陪看电影……）的时候，也由你按人设和关系决定——可以爽快答应、可以推脱、可以讨价还价、也可以拒绝；答应了才带标记。`
                : `这些都是你**真的做得到**的事。你只要在回复里说了要做其中某件（"我给你打电话""转你两百""五分钟后一起看电影"），或者${who}开口让你做，就**一定**在那条回复里带上对应的标记——说到就做到，系统会按标记真的执行。`;
            return `
【💬 你在聊天里能真的去做的事】
${list}${moreList ? `\n其它你也做得到的（${who}让你做、或者你自己想做的时候用，写法一样）：\n${moreList}` : ''}
分清楚：写日记是写进你自己的日记本（[ACT:写日记]），写信才是寄给${who}（[ACT:写信]）；匿名论坛、论坛、朋友圈、推文是四个不同的地方，${who}让你去哪儿发就用哪一个。
${rule}
${isGroup ? `你们现在在群里。这些事做起来都是冲着${who}一个人的（电话打给TA、钱转给TA、邀请私下发给TA），不是冲着群里别人。\n` : ''}写法：标记放在那条回复文字的末尾，对方看不到标记本身；一条可以带好几个。要过一会儿才做的，在名字后面加 @分钟数，比如 [ACT:约看电影@5|星际穿越] 就是五分钟后才发来邀请。金额只写数字。不要为了用而用，平常聊天大多数时候什么标记都不用带。
`;
        } catch (e) { return ''; }
    };

    /* ---------- 开关：挂进 设置 → 自动化 的开关表 ---------- */
    try {
        if (typeof AUTO_FEATURE_DEFS !== 'undefined' && Array.isArray(AUTO_FEATURE_DEFS) && !AUTO_FEATURE_DEFS.some(f => f.key === 'chatActions')) {
            AUTO_FEATURE_DEFS.push({
                key: 'chatActions', label: '💬 聊天里说到做到',
                desc: '私聊里角色说"我给你打电话""转你两百""五分钟后一起看电影"时，真的弹来电、发转账单、到点发邀请卡；点外卖、买礼物、写信、写日记、去匿名区/论坛发帖、发朋友圈、发推、换状态、记待办……自主模式里能做的每件事也一样。角色是「TA 自己决定」模式的，说了做不做、你要求了答不答应由 TA 自己判断；默认模式说到就做到，你开口要求的也照办。各功能自己的开关照样算数（钱包没开就不会转账）。关掉＝回到以前，只说不做。',
                cost: '不额外调用（标记跟着回复一起出来）；真去做的那件事如果本身要调用（比如写信、发推、打电话里的对话），照那件事自己的算',
                group: '活人感', where: '设置 → 自动化 → 活人感'
            });
        }
    } catch (e) {}
})();
