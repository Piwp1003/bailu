/* =====================================================================
   js/37 —— 🧾 注入内容管理（收纳页）
   ---------------------------------------------------------------------
   一句话：把"每次说话前塞给模型的那一大坨东西"摊开，一条一条列出来，
   每条一个开关，你自己决定这次生成里带不带它。

   为什么要有这一页：
   功能越加越多，prompt 越来越长。可是"某个功能会往 prompt 里塞什么"
   一直是黑箱——你只能整个功能开或关，没法说"日程要，但天气不要"。
   而且 prompt 越长越贵、越长越糊，模型会被不相干的细节带跑。

   怎么做到的（没有去改那十几个模块）：
   ① 主线那些 getXxxPrompt(char) 是全局函数，这里把它们**套一层**：
      开关关着就直接返回空串，开着就原样调用。
   ② 小功能那些 __gyXxxCtxFor(charId) 返回的字符串，
      **全都是【小标题】开头的一段一段**——这里按【】切开，
      逐段看开关，关掉的段丢掉，剩下的拼回去。
      好处是以后新加的功能不用改这里：没登记过的小标题会被**自动认出来**，
      照样出现在这一页上（只是标题用的是它自己写的那个）。
   ③ 有几项本来就有开关（活人感页那五个），这里**不另做一个**，
      直接读写同一个，两边永远一致。

   存在 gyInjectBox（localforage）+ localStorage 镜像一份——
   拼 prompt 是同步的，等不了异步读盘，所以开机时先从镜像里同步拿。
   ===================================================================== */
(function () {
    'use strict';
    if (window.__gyInjectHubLoaded) return;
    window.__gyInjectHubLoaded = true;

    const LSK = 'gyInjectOffV1';
    const store = (typeof window.gyStore === 'function')
        ? window.gyStore('gyInjectBox', 'default')          // 带兜底的存档口
        : ((typeof localforage !== 'undefined')
            ? localforage.createInstance({ name: 'gyInjectBox' })
            : null);

    // off[key] === true 表示这一条**不注入**。默认全空 = 跟以前一模一样。
    let S = { off: {}, found: {}, sc: {} };   // sc: 每个场景单独设过的那些

    // 开机就同步拿一份，别等 localforage
    try {
        const raw = localStorage.getItem(LSK);
        if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') { S.off = o.off || {}; S.sc = o.sc || {}; } }
    } catch (e) {}

    let saveT = null;
    function save() {
        try { localStorage.setItem(LSK, JSON.stringify({ off: S.off, sc: S.sc })); } catch (e) {}
        if (!store) return;
        clearTimeout(saveT);
        saveT = setTimeout(() => { try { store.setItem('state', { off: S.off, sc: S.sc }); } catch (e) {} }, 200);
    }
    async function load() {
        if (!store) return;
        try {
            const o = await store.getItem('state');
            if (o && typeof o === 'object') {
                // 盘上的为准，但本地新点的（还没写盘）不能丢：以内存里的覆盖回去
                if (o.off) S.off = Object.assign({}, o.off, S.off);
                if (o.sc) { const m = {}; Object.keys(o.sc).forEach(k => m[k] = Object.assign({}, o.sc[k], S.sc[k] || {})); S.sc = Object.assign(m, S.sc && Object.keys(S.sc).length ? S.sc : {}); }
                try { localStorage.setItem(LSK, JSON.stringify({ off: S.off, sc: S.sc })); } catch (e) {}
            }
        } catch (e) {}
    }

    const esc = s => (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s))
        : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // 说明文字里写的 **重点** 一直是原样显示成星号的（写的时候当 markdown 写，
    // 页面上却是 esc 过的纯文本）。转义之后再把这一对星号变成粗体——顺序不能反，
    // 反了就等于允许说明文字往页面里塞标签。
    const mk = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    const chars = () => (typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) ? myCharacters : [];

    /* ================= 目录 =================
       item 三种写法：
         fn   : 套一个全局函数，关了就整段没有
         box  : + head，小功能注入里的某一段【小标题】
         link : 复用活人感页上已有的那个开关（aliveSettings.xxx），不另开一个
       head 可以写成字符串、字符串数组，或 re（正则源码，给那种标题里带名字的）
    */
    const GROUPS = [
        {
            key: 'core', icon: '🧬', title: '角色本身',
            note: '这几条是"TA 是谁"。',
            items: [
                { k: 'core.persona', label: '角色人设正文', always: true,
                  desc: '角色卡/资料页里那段人设。这是"TA 是谁"的本体，关掉角色就不存在了，所以这一条永远带着、关不掉——列在这儿是为了让你看到完整的清单，知道 prompt 里到底有什么。' },
                { k: 'core.gstrip', label: '人设里那几大段开场白，拼 prompt 时剥掉',
                  desc: '很多角色卡把七八条开场白整段写进人设里。不剥的话，**每一个功能**（发推文、写日记、联网探索）都在读七八条互相矛盾的剧情开头——'
                      + '一条写"你在酒馆遇见他"，一条写"你是他的上司"，模型只能各取一点乱拼。'
                      + '只在拼 prompt 的时候剥，**存档里一个字都不会动**，关掉就恢复原样。' },
                { k: 'core.greet', label: '你们这一局是怎么开始的（当前那条开场白）',
                  desc: '上面剥掉之后，换成**你这一局真正在用的那条**——你在聊天里挑的、或者 AI 生成的那条（就是这个会话里角色说的第一句）。'
                      + '你没选开场白、直接开口聊的，这里就什么都不带。' },
                { k: 'core.user', label: '我在 TA 面前是谁', fn: 'getUserContextPrompt',
                  desc: '你给这个角色单独设的用户人设（没单独设就用默认那份）。关掉之后 TA 不知道在跟谁说话。' },
                { k: 'core.voice', label: '语言指纹（TA 自己的打字习惯）', fn: 'aliveVoicePrompt',
                  desc: '从 TA 写过的东西里提出来的那段"怎么说话"。没提过就是空的，关不关都一样。' },
                { k: 'core.profile', label: '资料页上的简介 / 所在地 / 网站 / 生日', link: 'knowProfile',
                  desc: '跟「活人感 → 补齐没接上的数据」是同一个开关，两边点哪边都行。' },
                { k: 'core.faction', label: '自己属于哪个势力、同一边还有谁', link: 'knowFaction',
                  desc: '同上，同一个开关。' },
                { k: 'core.rel', label: '和其他角色的关系（关系设定那张表）', fn: 'getRelationshipContextPrompt',
                  desc: '你在关系里连的那些线。人多了会挺长的，只想让 TA 专心跟你说话的时候可以关掉。' },
                { k: 'core.human', label: '拟人化底稿（别像 AI 那样说话）', fn: 'getHumanFeelPromptText',
                  desc: '一整段"不要写成小作文、不要每句都总结"的通用要求。关掉会明显更像模型腔，但省不少 token。' },
                { k: 'core.tpes', label: '时间感知（现在几点、白天还是深夜）', fn: 'getTpesPromptText',
                  desc: '关掉之后角色对"现在是什么时候"没有概念。' },
                { k: 'core.now', label: '当前时刻那一行（整份 prompt 的最后一句）', fn: 'getTpesNowLine',
                  desc: '"现在是 X 月 X 日 X 点"那一行，钉在最后面。它每分钟都在变，所以必须放最后——放前面会让它后面所有内容的输入缓存失效、每轮都重新计费。关掉能省一点缓存开销，代价是 TA 不知道此刻几点。' },
                { k: 'core.fmt', label: '格式规则（能不能写括号里的动作心理）', desc: '"你可以用()【】写动作和心理描写"或者反过来那一句，跟着设置里的「允许动作描写」走。关掉之后这句话不进 prompt，模型按自己的习惯来。' }
            ]
        },
        {
            key: 'wb', icon: '📖', title: '世界书条目',
            note: '世界书按**插入位置**分成八段塞进 prompt——同一本世界书，条目写在哪个位置就归哪一段。这八段可以分别关：比如只留"人设之后"那一段，其余位置的条目一律不进。关掉一整段不会删任何词条，只是这一轮不塞。',
            items: [
                { k: 'wb.before_persona',  label: '人设之前', desc: '排在角色人设正文前面的词条。世界观总纲、时代背景这类通常放这儿。' },
                { k: 'wb.after_persona',   label: '人设之后（默认位置）', desc: '**没有特意设过位置的词条全在这儿**，也就是绝大多数。这一段是世界书的主体，关掉等于这张卡的设定基本不进 prompt。' },
                { k: 'wb.before_example',  label: '对话范例之前', desc: '' },
                { k: 'wb.after_example',   label: '对话范例之后', desc: '' },
                { k: 'wb.before_an',       label: '作者注释之前', desc: '酒馆卡里 Author\'s Note 前后那两个位置。' },
                { k: 'wb.after_an',        label: '作者注释之后', desc: '' },
                { k: 'wb.at_depth',        label: '按插入深度（插在聊天记录中间的）', desc: '设了"插入深度"的词条——它们不在开头，而是插进最近几轮对话之间，所以存在感最强、也最费 token。' },
                { k: 'wb.end',             label: '整份提示词的末尾', desc: '压轴强调用的那一档。' }
            ]
        },
        {
            key: 'preset', icon: '🧩', title: '预设条目',
            note: '你导入的预设（酒馆那套 preset）按同样的三个位置塞进来，跟世界书是两套东西、分别控制。',
            items: [
                { k: 'preset.before_persona', label: '人设之前', desc: '' },
                { k: 'preset.after_persona',  label: '人设之后（默认位置）', desc: '预设条目多数落在这儿。' },
                { k: 'preset.end',            label: '整份提示词的末尾', desc: '' }
            ]
        },
        {
            key: 'mem', icon: '🧠', title: '记忆与总结',
            note: '这一组最容易把 prompt 撑长。哪些旧事该被记着，你自己挑。',
            items: [
                { k: 'mem.tweet', label: '推文记忆总结', desc: '角色自己发过的推文攒出来的那份总结。' },
                { k: 'mem.chat', label: '历史聊天总结', desc: '早先聊过的内容压缩成的那几段。开了「记忆会褪色」的话，这里控制的是褪色版。' },
                { k: 'mem.group', label: '参与过的群聊话题', desc: '发帖、发言的时候能自然带出来的群聊近况。' },
                { k: 'mem.schedule', label: '今天的日程 + 最近几天的轨迹', fn: 'getScheduleContextPrompt',
                  desc: '日程系统排的那些。这是"TA 今天在干嘛"的主要来源，关掉之后 TA 的一天就空了。' },
                { k: 'mem.todo', label: '待办清单：TA 还惦记着没办的事',
                  desc: '以前这一条是塞在「今天的日程」里面的，关日程才能一起关掉。现在拆出来单独控制——只给没办完的，办完的不占 prompt。这是"角色为什么会突然想起点什么"的依据（答应过的东西、约好的日子）。' },
                { k: 'mem.theater', label: '小剧场：跟别的角色私下发生过的事', fn: 'getTheaterContextPrompt',
                  desc: '角色互动生成的那些片段。不想让 TA 在跟你聊天时惦记着别人，可以关。' },
                { k: 'mem.letter', label: '你们之间的通信', fn: 'getLetterAwarenessPrompt',
                  desc: '只给标题和一小段摘要，外加"有几封还没回"。写信的时候有另一条完整的路，不受这个影响。' },
                { k: 'mem.diary', label: 'TA 自己写过的日记', link: 'knowDiary',
                  desc: '跟「活人感 → 补齐没接上的数据」同一个开关。' },
                { k: 'mem.anniv', label: '今天是不是纪念日', link: 'knowAnniv',
                  desc: '你在日历里手记的那些。同一个开关。' },
                { k: 'mem.read', label: '一起读过的书 + 读后感', fn: 'getReadingNotesPrompt',
                  desc: '共读功能攒下来的。没一起读过书就是空的。' },
                { k: 'mem.film', label: '一起看过的片 + 观后感', fn: 'getFilmPrompt',
                  desc: '一起看功能攒下来的。' }
            ]
        },
        {
            key: 'alive', icon: '🫀', title: '活人感',
            note: '这两条每轮都在变，是"此刻的 TA"，不是设定。',
            items: [
                { k: 'alive.mood', label: '上一轮留下来的情绪，还没散干净', fn: 'aliveMoodPrompt',
                  desc: '刚吵完架不会下一句就没事人一样。关掉之后每一轮都是干净的开始。' },
                { k: 'alive.body', label: '累 / 困 / 饿 / 上头（按日程推的）', fn: 'aliveBodyPrompt',
                  desc: '本地算的，不调 API。' }
            ]
        },
        {
            key: 'music', icon: '🎵', title: '音乐盒', box: '__gymMemoryFor',
            items: [
                { k: 'music.mem', label: '你和对方一起听歌的记忆', box: '__gymMemoryFor', head: '你和对方一起听歌的记忆', desc: '' },
                { k: 'music.now', label: '此刻正在一起听的那首', box: '__gymMemoryFor', head: '你此刻正在和对方一起听', desc: '只有一起听着的时候才有。' }
            ]
        },
        {
            key: 'map', icon: '🗺️', title: '行程与天气', box: '__gyMapCtxFor',
            note: '整组是「行程与天气」这个小功能往 prompt 里塞的东西，一条一条可以拆着关。',
            items: [
                { k: 'map.where', label: '你现在在哪', box: '__gyMapCtxFor', head: '你现在在哪', desc: '地图上给 TA 钉的那个位置。' },
                { k: 'map.often', label: '你常去的地方', box: '__gyMapCtxFor', head: '你常去的地方', desc: '' },
                { k: 'map.same', label: '此刻和你在同一个地方的人', box: '__gyMapCtxFor', head: '此刻和你在同一个地方的', desc: '' },
                { k: 'map.weather', label: '今天的天气（真实 / 架空）', box: '__gyMapCtxFor', re: '那边今天的天气', desc: '你那边的真实天气和 TA 那边的架空天气都归这一条。' },
                { k: 'map.been', label: '你们一起去过的地方', box: '__gyMapCtxFor', head: ['你们一起去过的地方', '你此刻正跟'], re: '^你此刻正跟', desc: '含"此刻正约着在一起"那句。' },
                { k: 'map.no', label: '你回绝过的约', box: '__gyMapCtxFor', head: '你回绝过的约', desc: '' }
            ]
        },
        {
            key: 'rel', icon: '💗', title: '关系账本', box: '__gyRelCtxFor',
            items: [
                { k: 'rel.feel', label: '你对我的感觉（阶段 + 最近让它变化的事）', box: '__gyRelCtxFor', re: '^你对.*的感觉$', desc: '关系账本的主体。关掉之后好感度还照记，只是不进 prompt。' },
                { k: 'rel.ask', label: '让模型顺手给这一轮的加减分', box: '__gyRelCtxFor', head: '额外字段·关系', desc: '这条关了就只剩你手动记账。跟账本页里那个"让模型自己打分"是两回事——那边关了这边根本不会出现。' }
            ]
        },
        {
            key: 'gossip', icon: '🗣️', title: '八卦网', box: '__gyGossipCtxFor',
            items: [
                { k: 'gossip.about', label: '外面在传关于你的事', box: '__gyGossipCtxFor', head: '外面在传关于你的事', desc: '' },
                { k: 'gossip.told', label: '你跟对方说过的闲话', box: '__gyGossipCtxFor', head: '你跟对方说过的闲话', desc: '' }
            ]
        },
        {
            key: 'kit', icon: '🎒', title: '随身物', box: '__gyKitCtxFor',
            items: [
                { k: 'kit.have', label: '你身上／家里真的有的东西', box: '__gyKitCtxFor', head: '你身上/家里真的有的东西', desc: '' },
                { k: 'kit.gone', label: '已经不在了的东西', box: '__gyKitCtxFor', head: '已经不在了的', desc: '弄丢的、用完的、送人的。' }
            ]
        },
        {
            key: 'days', icon: '📅', title: '日子（节气与节日）', box: '__gyDaysCtxFor',
            items: [
                { k: 'days.today', label: '今天是什么日子', box: '__gyDaysCtxFor', head: '今天是什么日子', desc: '节气、节日、你标的特殊日子，以及"提前几天就开始有感觉"那段。' }
            ]
        },
        {
            key: 'mall', icon: '🛍️', title: '商城与包裹', box: '__gyMallCtxFor',
            items: [
                { k: 'mall.orders', label: '最近三单的购物／包裹动态', box: '__gyMallCtxFor', re: '^你的购物', desc: '谁买的、送给谁、到哪一步了、拆没拆。' }
            ]
        },
        {
            key: 'web', icon: '🌐', title: '联网探索', box: '__gyWebCtxFor',
            items: [
                { k: 'web.seen', label: '你自己上网看到过的东西', box: '__gyWebCtxFor', re: '^你自己上网看到过的东西', desc: '连同"这是你当时写下的原话，不许原样搬出来"那段一起。' }
            ]
        },
        {
            key: 'wallet', icon: '💰', title: '钱包', box: '__gyWalletCtxFor',
            items: [
                { k: 'wallet.money', label: '你的钱（余额 / 欠款 / 职业 / 最近几笔）', box: '__gyWalletCtxFor', head: '你的钱', desc: '关掉之后角色不知道自己手头有多少，但账照记、钱照扣。' }
            ]
        },
        {
            key: 'takeout', icon: '🛵', title: '外卖', box: '__gyTakeoutCtxFor',
            items: [
                { k: 'takeout.recent', label: '最近有人给你点的外卖', box: '__gyTakeoutCtxFor', head: '最近有人给你点的外卖', desc: '' }
            ]
        },
        {
            key: 'phone', icon: '📱', title: '手机', box: '__gyPhoneCtxFor',
            items: [
                { k: 'phone.seen', label: '手机被看过这件事 + 都看到了什么', box: '__gyPhoneCtxFor', head: '手机这件事', desc: '你翻过 TA 的手机、TA 翻过你的，双方都记着。' }
            ]
        },
        {
            key: 'silence', icon: '🕯️', title: '你很久没回消息', box: '__gySilenceCtxFor',
            items: [
                { k: 'silence.why', label: 'TA 当时认定的原因和情绪', box: '__gySilenceCtxFor', head: '你等了很久那件事', desc: '三天前的赌气本来就不会带进来，这里控制的是还新鲜的那一条。' }
            ]
        },
        {
            key: 'dress', icon: '🎀', title: '换过的样子', box: '__gyDressCtxFor',
            items: [
                { k: 'dress.log', label: '最近换过的头像 / 背景 / 壁纸，谁提的、谁注意到了', box: '__gyDressCtxFor', head: '换过的样子',
                  desc: '包括 TA 当时说的那句话。关掉之后换装照常生效，只是角色不会记得这件事。' }
            ]
        },
        {
            key: 'myday', icon: '🗓️', title: '我的日程', box: '__gyMyDayCtxFor',
            note: '你自己写的那些日程里，**这个角色有权知道**的那几条（按你给每条设的可见范围筛）。',
            items: [
                { k: 'myday.plan', label: '我这几天的安排（TA 知道的那部分）', box: '__gyMyDayCtxFor', re: '这几天的安排',
                  desc: '只包含你允许这个角色看见的条目——设成"谁都别知道"的那些根本不会出现在这儿。关掉之后你的日程照记，只是 TA 不知道。' }
            ]
        },
        {
            key: 'npc', icon: '👥', title: '世界里的人（NPC）', box: '__gyNpcCtxFor',
            note: '从角色卡世界书里抽出来、绑给这个角色的那批 NPC。',
            items: [
                { k: 'npc.around', label: '你身边的这些人（名字 / 是谁 / 什么关系）', box: '__gyNpcCtxFor', head: '你身边的这些人',
                  desc: '让 TA 提起"我师父"的时候前后对得上。条数在「小功能 → 世界里的人」里调。关掉之后 NPC 照样存着，手机通讯录和推文评论照用，只是聊天时不提。' }
            ]
        },
        {
            key: 'site', icon: '🌍', title: '全站内容（默认都不带）',
            note: 'app 里存着、但以前**根本没路子塞进 prompt** 的那些东西。'
                + '以前只能让角色读到 buildBasePrompt 恰好写进去的那几段，'
                + '所以"让发推文也读一读匿名论坛和小说"这种事做不到。现在全在这儿，一条一条勾。'
                + '⚠️ 整组默认关着——它们以前一段都没进过 prompt，默认打开等于偷偷把你的 prompt 撑大一倍。'
                + '而且别忘了这一页最上面可以**按场景分别设**：私聊时不带小说，发推文时带上，是可以的。',
            box: '__gySiteCtxFor',
            // 这一组开头挂一小块设置（每类取几条 / 每条多少字），由 js/41 画
            ctrl: 'gySiteCtxCfgUI',
            items: [
                { k: 'site.posts', label: 'TA 自己发过的推文（原话）', box: '__gySiteCtxFor', head: '你自己发过的推文', defaultOff: true,
                  desc: '跟上面「推文记忆总结」是两回事：那个是压缩过的几句话，这个是原文。想让 TA 记得自己具体说过什么就开这条。' },
                { k: 'site.anon', label: '匿名论坛上的帖子', box: '__gySiteCtxFor', head: '匿名论坛上最近在聊什么', defaultOff: true,
                  desc: '包括 TA 自己用马甲发的那几条（会标出来），和别人发的（TA 不知道是谁发的）。' },
                { k: 'site.forum', label: '论坛帖子', box: '__gySiteCtxFor', head: '论坛上最近的帖子', defaultOff: true, desc: '' },
                { k: 'site.novel', label: '我们的故事（小说章节）', box: '__gySiteCtxFor', head: '你参与的那些故事', defaultOff: true,
                  desc: '只给挂了这个角色的那些故事的最新一章。开了之后 TA 会把故事里写过的事当成真发生过。' },
                { k: 'site.story', label: '续写里正在展开的剧情', box: '__gySiteCtxFor', head: '续写里正在展开的剧情', defaultOff: true, desc: '' },
                { k: 'site.udiary', label: '我写的日记（挂了 TA 的那几篇）', box: '__gySiteCtxFor', head: '对方写的日记', defaultOff: true,
                  desc: '跟上面「TA 自己写过的日记」是反过来的：那是角色的日记，这是**你的**。' },
                { k: 'site.album', label: '回忆相册里收藏的瞬间', box: '__gySiteCtxFor', head: '被特意收藏起来的那些瞬间', defaultOff: true,
                  desc: '你特意收藏过的片段，分量比普通聊天记录重。' },
                { k: 'site.bank', label: 'TA 的专属资料库', box: '__gySiteCtxFor', head: '你的专属资料库', defaultOff: true,
                  desc: '角色编辑页里传的那些资料。文件多的话会很长，注意条数。' },
                { k: 'site.auto', label: 'TA 自主模式下做过的事', box: '__gySiteCtxFor', head: '你自己最近做过的事', defaultOff: true,
                  desc: '没人让 TA 做、TA 自己决定去做的那些。开了之后 TA 记得自己前几天干了什么。' },
                { k: 'site.emo', label: '手里有哪些表情包', box: '__gySiteCtxFor', head: '你手里有这些表情包', defaultOff: true,
                  desc: '把表情包清单和含义递过去，TA 才知道自己能发什么。' },
                { k: 'site.grouptalk', label: '群里最近说的话（原话）', box: '__gySiteCtxFor', head: '群里最近说的话', defaultOff: true,
                  desc: '跟上面「参与过的群聊话题」不同：那个是总结出来的话题，这个是原话。' }
            ]
        },
        {
            key: 'photo', icon: '📷', title: '角色发图片', box: '__gyPhotoCtxFor',
            note: '告诉模型"你可以发图，这么写"的那几句。关掉之后 TA 不会再主动发图了——'
                + '聊天框 ⋮ 里那颗 📷 是手动的，照样能用。发图走哪条路（只发卡片 / 图库里挑 / 现画 / 网上搜）'
                + '在「小功能 → 📷 角色发图片」里定。',
            items: [
                { k: 'photo.howto', label: '发图片的写法（[IMG:一句话描述]）', box: '__gyPhotoCtxFor', head: '发图片',
                  desc: '不带这一段，模型压根不知道自己能发图。「从图库里挑」那档还会顺带把 TA 手里真有的那些图的标签报给它，免得它描述一张不存在的图。' }
            ]
        },
        {
            key: 'plugin', icon: '🧩', title: '插件',
            note: '你自己装的插件，内容取决于你装了什么。（导入的**预设**是上面单独那一组，不在这儿。）',
            items: [
                { k: 'plugin.prompt', label: '提示词规则插件', fn: 'getPluginPromptText', desc: '插件往 prompt 里加的那几段规则。' },
                { k: 'plugin.script', label: '进阶脚本钩子', fn: 'runPluginScriptHooks', desc: '插件用脚本动态生成、塞进来的内容。' }
            ]
        }
    ];

    /* =====================================================================
       第二块：**生成的时候读什么**
       ---------------------------------------------------------------------
       上面那一块管的是"塞给模型的 prompt 里有哪几段"。
       但 app 里还有一堆**自己生成内容**的地方：角色手机里那些人跟 TA 的对话、
       小剧场演的那一出、有人注意到你换了头像时说的那句话……
       它们各自会去读一批数据当素材。以前读什么是写死的，
       现在每个生成器把"我会读这些"登记进来，你逐条决定给不给它读。

       模块这样用：
         gyInjectSrc.def({ feat:'phoneTalk', icon:'📱', title:'…', note:'…',
                           items:[{k:'sched', label:'今天的日程', desc:'…'}] });
         if (gyInjectSrc.on('phoneTalk','sched')) { …读日程… }
       没登记过的 feat 一律当成"全开"，所以模块先用后登记也不会出事。
       ===================================================================== */
    const SRCS = [];                      // [{feat, icon, title, note, items:[{k,label,desc,defaultOff}]}]
    const srcKey = (feat, k) => 'src:' + feat + ':' + k;
    window.gyInjectSrc = {
        def(g) {
            if (!g || !g.feat) return;
            const old = SRCS.findIndex(x => x.feat === g.feat);
            if (old >= 0) SRCS.splice(old, 1);
            SRCS.push({ feat: g.feat, icon: g.icon || '⚙️', title: g.title || g.feat,
                        note: g.note || '', items: (g.items || []).slice() });
        },
        on(feat, k, scene) {
            try {
                const g = SRCS.find(x => x.feat === feat);
                const it = g && g.items.find(x => x.k === k);
                const key = srcKey(feat, k);
                const sc = (scene === undefined) ? curScene : (scene || '');
                const v = scVal(sc, key);
                if (v !== undefined) return v;          // 这个场景单独设过
                if (Object.prototype.hasOwnProperty.call(S.off, key)) return !S.off[key];
                return !(it && it.defaultOff);          // 没动过就按默认
            } catch (e) { return true; }
        },
        list(feat) {
            const g = SRCS.find(x => x.feat === feat);
            if (!g) return [];
            return g.items.filter(x => window.gyInjectSrc.on(feat, x.k)).map(x => x.k);
        },
        all() { return SRCS.slice(); }
    };
    window.gyInjectSrcSet = async function (feat, k, v) {
        const key = srcKey(feat, k);
        if (viewScene) {                      // 正在看某个场景 → 只改这一场
            if (!S.sc[viewScene]) S.sc[viewScene] = {};
            S.sc[viewScene][key] = !!v;
        } else if (v) S.off[key] = false; else S.off[key] = true;
        save(); renderInjectPanel();
    };
    window.gyInjectSrcAll = async function (feat, v) {
        const g = SRCS.find(x => x.feat === feat); if (!g) return;
        if (viewScene && !S.sc[viewScene]) S.sc[viewScene] = {};
        g.items.forEach(it => {
            const key = srcKey(feat, it.k);
            if (viewScene) S.sc[viewScene][key] = !!v;
            else if (v) delete S.off[key]; else S.off[key] = true;
        });
        save(); renderInjectPanel();
    };
    window.gyInjectSrcSame = async function (feat, k) {
        if (!viewScene || !S.sc[viewScene]) return;
        delete S.sc[viewScene][srcKey(feat, k)];
        save(); renderInjectPanel();
    };

    /* =====================================================================
       场景：同一条数据，在不同场合该不该带
       ---------------------------------------------------------------------
       "发推文的时候只要人设，别把钱包日程全塞进去"——这是很合理的要求，
       可是那十几段注入是在 buildBasePrompt 里一次拼好的，它不知道
       这一次是要写推文、写日记，还是在跟你私聊。

       所以这里给每个**生成入口**套一层壳：进那个函数之前记下"现在是哪个场景"，
       出来再还原。buildBasePrompt 照旧被调用，只是这一次它问开关时，
       问的是"这个场景下这条开着吗"。

       每条数据在每个场景下有三种状态：
         · 跟总设置一样（默认，什么都没动过就是这个）
         · 这个场景单独打开
         · 这个场景单独关掉
       所以你可以"总的全开着，但发推文时只留人设"，
       也可以"总的关掉钱包，唯独私聊时带上"。

       ⚠️ 异步是靠"进函数时压栈、Promise 落定后弹栈"顶着的。
          两个生成同时在跑的话，后进的那个会盖住前一个——
          实际用起来不会（发推和聊天不会同一毫秒开始），
          但真撞上了最坏结果也只是某一次多带/少带一段，不会出错。
       ===================================================================== */
    const SCENES = [
        { k: 'chat',      icon: '💬', title: '私聊回复',        note: '你跟 TA 一对一说话。这是唯一"你会逐字读"的场景，一般什么都该带。' },
        { k: 'group',     icon: '👥', title: '群聊回复',        note: '群里人多，每个人都带一整套注入会很贵。' },
        { k: 'post',      icon: '🐦', title: '发推文',          note: '推文是 TA 自己在社交平台上说话，跟你无关。日程、钱包、包裹这些多半用不上。' },
        { k: 'comment',   icon: '💭', title: '评论 / 回复别人',  note: '一句话的事，注入越少越省。' },
        { k: 'forum',     icon: '📋', title: '论坛 / 匿名论坛',  note: '匿名身份说话，带太多私人细节反而容易露馅。' },
        { k: 'diary',     icon: '📔', title: '写日记',          note: '写给自己看的，情绪和身体状态比外部信息重要。' },
        { k: 'letter',    icon: '📮', title: '写信 / 回信',      note: '' },
        { k: 'react',     icon: '👀', title: '看到你日记的反应',  note: '' },
        { k: 'novel',     icon: '📖', title: '小说 / 续写 / 点评', note: '' },
        { k: 'proactive', icon: '📲', title: '主动来找你说话',    note: 'TA 自己开的口，得知道自己今天过得怎么样。' },
        { k: 'schedule',  icon: '🗓️', title: '排今天的日程 / 待办', note: '排日程时把日程本身注进去是套娃，可以关掉。' },
        { k: 'autonomy',  icon: '🧭', title: '自主模式（TA 自己拿主意）', note: 'TA 自己决定要做点什么的时候。下面那些生成器被自主模式调起来时算这一场，你手动点的时候算它们各自那一场——所以"自动跑省着点、我点的时候全读上"是设得出来的。' },
        // 下面这几个不是"写什么"，是"程序在替角色编内容"。它们各自有一批能读的素材（第②块），
        // 所以也给一个场景，好让你分开设"自动跑"和"我手动点"这两种情况。
        { k: 'theater',   icon: '🎭', title: '小剧场（手动点的那次）', srcOnly: true, note: '你在「Ta 们在做什么」里点「现在演一场」。自主模式自己演的那次算 🧭 自主模式。' },
        { k: 'web',       icon: '🌐', title: '联网探索（手动点的那次）', srcOnly: true, note: '你点「让 TA 去看看」。自主模式自己去看的那次算 🧭 自主模式。' },
        { k: 'silence',   icon: '🕯️', title: '你很久没回消息时', srcOnly: true, note: '' },
        { k: 'phoneTalk', icon: '📱', title: 'TA 手机里那些人发来的消息', srcOnly: true, note: '' },
        { k: 'dress',     icon: '🎀', title: '有人注意到你换了样子', srcOnly: true, note: '' },
        { k: 'groupTalk', icon: '👥', title: 'TA 自己去群里说话', srcOnly: true,
          note: '自主模式里那个「去某个群里说句话」。它要看几个群最近聊到哪儿了，读得越多越贵。' },
        { k: 'call',      icon: '📞', title: '打电话（手动点的那次）',
          note: '你在聊天框 ⋮ 里点了 📞。电话里句子短、来回快，一通电话是好几次请求——注入越省越好。' },
        { k: 'photo',     icon: '📷', title: '发图片（手动点的那次）',
          note: '你在聊天框 ⋮ 里点了 📷，问 TA "现在想给我看什么"的那一次。TA 自己在回复里带 [IMG:] 的那种不走这一场——那是聊天那一场顺带的。' },
        // ⬇️ 小功能自己那些"角色开口"的地方。以前一个都没挂场景——它们照样读整份 prompt，
        //    只是你在这一页上看不见、也分不开设。（漏了六十多个，v125 一次补齐。）
        { k: 'invite',    icon: '🎟️', title: '邀请：看电影 / 听歌 / 阅读 / 约出去',
          note: 'TA 答应还是拒绝、以及 TA 反过来约你。这一场很短，一句话的事，注入可以砍得很狠。' },
        { k: 'film',      icon: '🎬', title: '一起看电影时开口',
          note: '看到有想法的地方说一句、你一暂停接一句、看完给个感想。每隔几分钟就一次，是很花钱的一场。' },
        { k: 'read',      icon: '📖', title: '一起阅读时写评论',
          note: '每翻一页就一次调用，翻得快的时候特别费。' },
        { k: 'music',     icon: '🎵', title: '音乐盒：一起听 / 挑歌 / 听后感', note: '' },
        { k: 'map',       icon: '🗺️', title: '行程与天气：说自己在哪 / 造天气 / 认地图', note: '' },
        { k: 'gossip',    icon: '🗣️', title: '八卦网：传话 / 打听', note: '' },
        { k: 'kit',       icon: '🎒', title: '随身物：送东西 / 生成家当', note: '' },
        { k: 'days',      icon: '📅', title: '日子：TA 把某天记成纪念日', note: '' },
        { k: 'mall',      icon: '🛍️', title: '商城与包裹：收货反应 / 上架 / 抱怨 / 收不收',
          note: '包裹签收、角色上架东西、对买到的东西抱怨、别人送来的收不收。' },
        { k: 'wallet',    icon: '💰', title: '钱包：自己买 / 开口问你要钱', note: '' },
        { k: 'takeout',   icon: '🛵', title: '外卖：收到之后说一句', note: '' },
        { k: 'phoneAct',  icon: '📲', title: '手机：通知文案 / 借看时那句话',
          note: '跟上面「TA 手机里那些人发来的消息」不是一回事：那个是编通讯录里的人，这个是 TA 自己开口。' },
        { k: 'game',      icon: '🎲', title: '桌游 / 派对游戏里的发言',
          note: '狼人杀、UNO、斗地主、二十问这些。一局里会调很多次，是全 app 最容易悄悄烧钱的一场。' },
        { k: 'custom',    icon: '✍️', title: '你指定内容让 TA 回', note: '' },
        { k: 'welcome',   icon: '👋', title: '群里欢迎新人', note: '' }
    ];
    const sceneOf = k => SCENES.find(x => x.k === k) || null;
    // 哪个函数属于哪个场景。值是场景 key，或者一个按参数判断的函数。
    const SCENE_FNS = [
        ['triggerAIBatchReply',        a => (a && a[0] && String(a[0]).indexOf('g_') === 0) ? 'group' : 'chat'],
        ['executeGenerationInner',     'post'],
        ['runCharRepliesToComment',    'comment'],
        ['retriggerCharComments',      'comment'],
        ['maybeCharsReactToNpcComments', 'comment'],
        ['submitInlineReply',          'comment'],
        ['triggerRelatedCharacterReactions', 'comment'],
        ['autoGenerateAnonPostForChar', 'forum'],
        ['runCharRepliesToAnonPost',   'forum'],
        ['autoGenerateForumThreadForChar', 'forum'],
        ['triggerForumCharReply',      'forum'],
        ['generateDiaryContent',       'diary'],
        ['autonomyWriteDiary',         'diary'],
        ['generateProactiveLetter',    'letter'],
        ['resolveLetterReply',         'letter'],
        ['resolveDiaryReaction',       'react'],
        ['runNovelReviews',            'novel'],
        ['sendProactiveChatMessage',   'proactive'],
        ['generateRandomGreeting',     'proactive'],
        ['triggerNudge',               'proactive'],
        ['runScheduleGeneration',      'schedule'],
        ['generateCharTodosForChar',   'schedule'],
        ['generateCharTodosAI',        'schedule'],
        ['runAutonomyTurn',            'autonomy'],
        ['autonomyCommentOnSomePost',  'autonomy'],
        // ⬇️ 小功能那一批（全是挂在 window 上的，直接套；局部函数由各模块自己报场景）
        ['gyInviteAnswer',             'invite'],
        ['gyInviteAsk',                'invite'],
        ['gymapCharInvite',            'invite'],
        ['gymapSendDate',              'invite'],
        ['gymapAskSay',                'map'],
        ['gymapGenFicWeather',         'map'],
        ['gymapGenMap',                'map'],
        ['gygsTell',                   'gossip'],
        ['gygsAsk',                    'gossip'],
        ['gykitGive',                  'kit'],
        ['gykitGen',                   'kit'],
        ['gydaySay',                   'days'],
        ['rtSendDiscuss',              'read'],
        ['rtOpenReflectionGen',        'read'],
        ['gymallComplain',             'mall'],
        ['gyPhoneAiNotif',             'phoneAct'],
        ['submitCustomCharReply',      'custom'],
        ['triggerGroupWelcomeSequence','welcome'],
        ['submitAnonReplyBtn',         'forum'],
        ['gyDressAsk',                 'dress'],
        ['contextActionRegenerateChat','chat'],
        ['gymAskPick',                 'music'],
        ['gymGenTaste',                'music']
    ];
    let curScene = '';                       // '' = 没在任何已知场景里（按总设置走）
    const sceneStack = [];
    function wrapScene(name, pick) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__gyScWrapped) return false;
        const w = function () {
            let k = '';
            try { k = (pick instanceof Function) ? pick(arguments) : pick; } catch (e) { k = ''; }
            sceneStack.push(curScene); curScene = k || '';
            const pop = () => { curScene = sceneStack.pop() || ''; };
            let r;
            try { r = orig.apply(this, arguments); }
            catch (e) { pop(); throw e; }
            if (r && typeof r.then === 'function') { r.then(pop, pop); }
            else pop();
            return r;
        };
        w.__gyScWrapped = true; w.__gyScOrig = orig; w.__gyScene = pick;
        window[name] = w;
        return true;
    }
    function wrapScenes() { SCENE_FNS.forEach(([n, p]) => wrapScene(n, p)); }
    // 让别人也能问一句"现在是什么场景"，以及临时指定一个（给没被包住的调用点用）
    window.gyInjectScene = () => curScene;
    window.gyInjectInScene = function (k, fn) {
        sceneStack.push(curScene); curScene = k || '';
        const pop = () => { curScene = sceneStack.pop() || ''; };
        let r;
        try { r = fn(); } catch (e) { pop(); throw e; }
        if (r && typeof r.then === 'function') r.then(pop, pop); else pop();
        return r;
    };
    // 软设置：外面已经定了场景（比如自主模式调过来的）就不抢，只在"没人定"的时候才认领。
    // 这样同一个生成器"自动跑"和"你手动点"能分成两场设置。
    window.gyInjectInSceneSoft = function (k, fn) {
        return window.gyInjectInScene(curScene ? curScene : k, fn);
    };
    // S.sc[场景][条目] = true(单独开) / false(单独关)；没这个键就是"跟总设置一样"
    function scVal(scene, key) {
        if (!scene) return undefined;
        const m = S.sc && S.sc[scene];
        if (!m || !Object.prototype.hasOwnProperty.call(m, key)) return undefined;
        return !!m[key];
    }

    /* ============ 开关读写 ============ */
    const byKey = {};
    GROUPS.forEach(g => g.items.forEach(it => { it._g = g.key; byKey[it.k] = it; }));

    // scene 不传就用"此刻正在跑的那个场景"；传 null 表示只问总设置
    function itemOn(it, scene) {
        if (!it) return true;
        const sc = (scene === undefined) ? curScene : (scene || '');
        const v = scVal(sc, it.k);
        if (v !== undefined) return v;                // 这个场景单独设过
        if (it.link) {
            try { return typeof aliveSettings === 'undefined' || aliveSettings[it.link] !== false; }
            catch (e) { return true; }
        }
        // 三态：S.off 里没有这个 key＝用户从没动过 → 看这一条自己的默认；
        // true＝手动关掉；false＝手动打开。默认关的那些（全站内容那一组）靠的就是这个。
        const cur = S.off[it.k];
        if (cur === undefined) return !it.defaultOff;
        return !cur;
    }
    function keyOn(k, scene) {
        if (byKey[k]) return itemOn(byKey[k], scene);
        const sc = (scene === undefined) ? curScene : (scene || '');
        const v = scVal(sc, k);
        if (v !== undefined) return v;
        return !S.off[k];
    }

    // 给别的模块用：window.gyInjectOn('mem.tweet')
    window.gyInjectOn = function (k) { try { return keyOn(k); } catch (e) { return true; } };
    // 只读出口：把两块清单原样吐出来。给自检测试用（核对"prompt 里真有的段落"
    // 跟"页面上列出来的条目"是不是一一对上），也方便以后排查"这条到底登记没登记"。
    window.gyInjectGroups = () => GROUPS.map(g => ({ key: g.key, icon: g.icon, title: g.title, box: g.box,
        items: g.items.map(it => ({ k: it.k, label: it.label, fn: it.fn, box: it.box, always: !!it.always })) }));
    window.gyInjectSrcGroups = () => SRCS.map(g => ({ feat: g.feat, icon: g.icon, title: g.title,
        items: g.items.map(it => ({ k: it.k, label: it.label })) }));
    window.gyInjectSet = async function (k, v) {
        // 正在看某个场景 → 写成那个场景的单独设置，不动总设置
        if (viewScene) {
            if (!S.sc[viewScene]) S.sc[viewScene] = {};
            S.sc[viewScene][k] = !!v;
            save(); renderInjectPanel(); return;
        }
        const it = byKey[k];
        if (it && it.link) {
            try { if (typeof aliveSetLink === 'function') aliveSetLink(it.link, !!v); } catch (e) {}
        } else {
            if (v) S.off[k] = false; else S.off[k] = true;   // 写死成 false，别用 delete——
            save();                                          // 不然"手动打开过"会跟"从没动过"混在一起
        }
        renderInjectPanel();
    };
    // 把某一条（或整个场景）退回"跟总设置一样"
    window.gyInjectSame = async function (k) {
        if (!viewScene || !S.sc[viewScene]) return;
        delete S.sc[viewScene][k];
        save(); renderInjectPanel();
    };
    window.gyInjectSceneResetOf = function (k) {
        if (!k || !S.sc[k]) return;
        delete S.sc[k]; save(); renderInjectPanel();
    };
    window.gyInjectSceneReset = async function () {
        if (!viewScene) return;
        if (!confirm('把「' + ((sceneOf(viewScene) || {}).title || viewScene) + '」这个场景单独设过的全部撤掉，回到跟总设置一样？')) return;
        delete S.sc[viewScene];
        save(); renderInjectPanel();
    };
    window.gyInjectSceneView = function (k) { viewScene = k || ''; renderInjectPanel(); };
    // 不经过开关，拿原始那份（UI 要用真实数据的地方走这个，别被 prompt 开关误伤）
    window.gyInjectRaw = function (fnName, charId) {
        try {
            const f = window[fnName];
            if (typeof f !== 'function') return '';
            const orig = f.__gyInjOrig || f;
            return orig(charId) || '';
        } catch (e) { return ''; }
    };

    /* ============ 小标题 → key ============ */
    function keyOfHead(box, head) {
        const h = String(head || '').trim();
        for (const g of GROUPS) {
            for (const it of g.items) {
                if (it.box !== box) continue;
                const hs = it.head ? (Array.isArray(it.head) ? it.head : [it.head]) : [];
                if (hs.some(x => h === x || h.indexOf(x) === 0)) return it.k;
                if (it.re) { try { if (new RegExp(it.re).test(h)) return it.k; } catch (e) {} }
            }
        }
        return box + '|' + h;                      // 没登记过的：自动认领一个 key
    }
    function noteHead(box, head) {
        const k = keyOfHead(box, head);
        if (byKey[k]) return;                      // 已经在目录里了
        if (!S.found[k]) S.found[k] = { box, head: String(head).slice(0, 60) };
    }

    /* ============ 切段过滤 ============ */
    function filterSections(box, text) {
        if (!text) return text || '';
        const parts = String(text).split(/(?=【)/);
        let out = '';
        for (const p of parts) {
            const m = p.match(/^【([^】]{1,90})】/);
            if (!m) { out += p; continue; }         // 段前的零碎、没标题的部分照旧
            noteHead(box, m[1]);
            if (keyOn(keyOfHead(box, m[1]))) out += p;
        }
        // 全被关光了就别留一堆空行
        return out.trim() ? out : '';
    }

    /* ============ 套壳 ============ */
    function wrapFn(name, key) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__gyInjWrapped) return false;
        const w = function () { if (!keyOn(key)) return ''; return orig.apply(this, arguments); };
        w.__gyInjWrapped = true; w.__gyInjOrig = orig; w.__gyInjKey = key;
        window[name] = w;
        return true;
    }
    function wrapBox(name) {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__gyInjWrapped) return false;
        const w = function () {
            let t = '';
            try { t = orig.apply(this, arguments) || ''; } catch (e) { return ''; }
            try { return filterSections(name, t); } catch (e) { return t; }
        };
        w.__gyInjWrapped = true; w.__gyInjOrig = orig; w.__gyInjBox = name;
        window[name] = w;
        return true;
    }
    function wrapAll() {
        GROUPS.forEach(g => g.items.forEach(it => { if (it.fn) wrapFn(it.fn, it.k); }));
        const boxes = new Set();
        GROUPS.forEach(g => g.items.forEach(it => { if (it.box) boxes.add(it.box); }));
        // GY_BOX_CTX 里有的、目录里还没登记的，也一并套上（新功能不用改这里）
        try {
            if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX))
                GY_BOX_CTX.forEach(x => boxes.add(x[0]));
        } catch (e) {}
        boxes.forEach(n => wrapBox(n));
    }

    /* ============ 探一遍，看每条现在到底有没有内容 ============ */
    function probe() {
        const has = {};                            // key -> true 表示现在真有东西
        const cs = chars();
        if (!cs.length) return has;
        GROUPS.forEach(g => g.items.forEach(it => {
            if (!it.fn && !it.link) return;
            const fn = it.fn || ({ knowProfile: 'getProfileSelfPrompt', knowFaction: 'getFactionSelfPrompt',
                knowDiary: 'getDiaryAwarenessPrompt', knowAnniv: 'getAnniversaryAwarenessPrompt' }[it.link]);
            if (!fn) return;
            for (const c of cs) {
                let t = '';
                try { t = window.gyInjectRaw(fn, c) || ''; } catch (e) {}
                if (!t) { try { t = window.gyInjectRaw(fn, c.id) || ''; } catch (e) {} }
                if (String(t).trim()) { has[it.k] = true; break; }
            }
        }));
        const boxes = new Set();
        GROUPS.forEach(g => g.items.forEach(it => { if (it.box) boxes.add(it.box); }));
        try { if (typeof GY_BOX_CTX !== 'undefined') GY_BOX_CTX.forEach(x => boxes.add(x[0])); } catch (e) {}
        boxes.forEach(b => {
            for (const c of cs) {
                let t = '';
                try { t = window.gyInjectRaw(b, c.id) || ''; } catch (e) {}
                if (!t) continue;
                String(t).split(/(?=【)/).forEach(p => {
                    const m = p.match(/^【([^】]{1,90})】/);
                    if (!m) return;
                    noteHead(b, m[1]);
                    has[keyOfHead(b, m[1])] = true;
                });
            }
        });

        // 世界书 / 预设的八个 + 三个插入位置：它们不是独立函数，探法不一样——
        // 直接问"这个位置现在有没有词条"，这样"现在有内容/现在是空的"那个标才是真的。
        try {
            const POS_WB = ['before_persona', 'after_persona', 'before_example', 'after_example',
                            'before_an', 'after_an', 'at_depth', 'end'];
            for (const c of cs) {
                let ents = [];
                try { ents = (typeof getCharacterWorldbookEntries === 'function') ? (getCharacterWorldbookEntries(c, '', null) || []) : []; } catch (e) {}
                if (!ents.length) continue;
                POS_WB.forEach(pos => {
                    if (has['wb.' + pos]) return;
                    let t = '';
                    try { t = (typeof formatWorldbookEntriesText === 'function') ? (formatWorldbookEntriesText(ents, pos) || '') : ''; } catch (e) {}
                    if (String(t).trim()) has['wb.' + pos] = true;
                });
            }
            ['before_persona', 'after_persona', 'end'].forEach(pos => {
                for (const c of cs) {
                    let t = '';
                    try { t = (typeof getActivePresetPromptText === 'function') ? (getActivePresetPromptText(c, false, null, pos) || '') : ''; } catch (e) {}
                    if (String(t).trim()) { has['preset.' + pos] = true; break; }
                }
            });
        } catch (e) {}
        // 这两条是拼在 buildBasePrompt 里的固定文本，不是函数，永远有
        has['core.fmt'] = true;
        has['core.persona'] = true;
        return has;
    }

    /* ============ 预览：这一条现在会塞进去什么 ============ */
    window.gyInjectPeek = function (k) {
        const it = byKey[k] || (S.found[k] ? { k, box: S.found[k].box, head: S.found[k].head } : null);
        if (!it) return;
        const cs = chars();
        if (!cs.length) { if (typeof showToast === 'function') showToast('', '注入预览', '还没有角色。', null, null, false); return; }
        let text = '';
        if (it.box) {
            for (const c of cs) {
                const t = window.gyInjectRaw(it.box, c.id) || '';
                if (!t) continue;
                const seg = String(t).split(/(?=【)/).find(p => {
                    const m = p.match(/^【([^】]{1,90})】/);
                    return m && keyOfHead(it.box, m[1]) === k;
                });
                if (seg) { text = '（以「' + c.name + '」为例）\n' + seg; break; }
            }
        } else {
            const fn = it.fn || ({ knowProfile: 'getProfileSelfPrompt', knowFaction: 'getFactionSelfPrompt',
                knowDiary: 'getDiaryAwarenessPrompt', knowAnniv: 'getAnniversaryAwarenessPrompt' }[it.link]);
            for (const c of cs) {
                let t = '';
                try { t = window.gyInjectRaw(fn, c) || ''; } catch (e) {}
                if (!t) { try { t = window.gyInjectRaw(fn, c.id) || ''; } catch (e) {} }
                if (String(t).trim()) { text = '（以「' + c.name + '」为例）\n' + t; break; }
            }
        }
        const body = document.getElementById('gyinjPeekBody');
        const pop = document.getElementById('gyinjPeek');
        if (!body || !pop) return;
        body.innerText = text.trim() || '这一条现在是空的——数据还没攒起来，开着也不会占字数。';
        pop.classList.add('on');
    };
    window.gyInjectPeekClose = function () {
        const p = document.getElementById('gyinjPeek'); if (p) p.classList.remove('on');
    };

    /* ============ 页面 ============ */
    let openG = {};                                 // 哪几组是展开的
    let onlyOff = false;
    let viewScene = '';                             // 这一页正在看哪个场景（'' = 总设置）

    window.gyInjectToggleG = function (g) { openG[g] = !openG[g]; renderInjectPanel(); };
    window.gyInjectAllG = function (v) {
        GROUPS.forEach(g => { openG[g.key] = !!v; });
        (window.gyInjectSrc ? window.gyInjectSrc.all() : []).forEach(g => { openG['src:' + g.feat] = !!v; });
        renderInjectPanel();
    };
    window.gyInjectGroupSet = async function (gkey, v) {
        const g = GROUPS.find(x => x.key === gkey); if (!g) return;
        if (viewScene) {
            if (!S.sc[viewScene]) S.sc[viewScene] = {};
            g.items.forEach(it => { S.sc[viewScene][it.k] = !!v; });
            extraItemsOf(g).forEach(it => { S.sc[viewScene][it.k] = !!v; });
            save(); renderInjectPanel(); return;
        }
        for (const it of g.items) {
            if (it.link) { try { if (typeof aliveSetLink === 'function') aliveSetLink(it.link, !!v); } catch (e) {} }
            else if (v) S.off[it.k] = false; else S.off[it.k] = true;
        }
        Object.keys(S.found).forEach(k => {
            const f = S.found[k];
            if (g.box === f.box || (g.items[0] && g.items[0].box === f.box)) { if (v) delete S.off[k]; else S.off[k] = true; }
        });
        save(); renderInjectPanel();
    };
    window.gyInjectFilter = function (v) { onlyOff = !!v; renderInjectPanel(); };
    // 「按功能看」里直接写某一场的设置（不改当前 viewScene）
    window.gyInjectSetIn = function (scene, k, v) {
        if (!scene) return window.gyInjectSet(k, v);
        if (!S.sc[scene]) S.sc[scene] = {};
        S.sc[scene][k] = !!v; save(); renderInjectPanel();
    };
    window.gyInjectSameIn = function (scene, k) {
        if (!scene) return window.gyInjectSame(k);
        if (S.sc[scene]) { delete S.sc[scene][k]; if (!Object.keys(S.sc[scene]).length) delete S.sc[scene]; }
        save(); renderInjectPanel();
    };
    window.gyInjectSrcSetIn = function (scene, feat, k, v) {
        if (!scene) return window.gyInjectSrcSet(feat, k, v);
        if (!S.sc[scene]) S.sc[scene] = {};
        S.sc[scene]['src:' + feat + ':' + k] = !!v; save(); renderInjectPanel();
    };
    // 视图模式：'data' = 按数据看（老样子）；'feat' = 按功能看（每个功能列出它读的全部东西）
    let viewMode = 'data';
    try { viewMode = localStorage.getItem('gy_inj_viewmode') || 'data'; } catch (e) {}
    window.gyInjectViewMode = function (m) {
        viewMode = (m === 'feat') ? 'feat' : 'data';
        try { localStorage.setItem('gy_inj_viewmode', viewMode); } catch (e) {}
        renderInjectPanel();
    };
    let openF = {};   // 「按功能看」里哪个功能是展开的
    window.gyInjectToggleF = function (k) { openF[k] = !openF[k]; renderInjectPanel(); };
    window.gyInjectResetAll = async function () {
        if (!confirm('把所有条目都恢复成"注入"，各个场景单独设的也一起撤掉？（等于回到没动过这一页的状态）')) return;
        S.off = {}; S.sc = {}; save();      // src: 开头的、各场景单独设的，一起清
        try {
            if (typeof aliveSetLink === 'function')
                ['knowProfile', 'knowFaction', 'knowDiary', 'knowAnniv'].forEach(k => aliveSetLink(k, true));
        } catch (e) {}
        renderInjectPanel();
    };

    function extraItemsOf(g) {
        // 自动认出来、目录里没写的那些
        const boxes = new Set(g.items.filter(i => i.box).map(i => i.box));
        if (g.box) boxes.add(g.box);
        return Object.keys(S.found)
            .filter(k => boxes.has(S.found[k].box))
            .map(k => ({ k, label: S.found[k].head, desc: '（新功能自己带的，还没写说明）', box: S.found[k].box, auto: true }));
    }

    function rowHtml(it, has, scOverride) {
        const sc = (scOverride === undefined) ? viewScene : scOverride;   // 「按功能看」里每一行都绑在自己那一场上
        const on = itemOn(it, sc);
        const live = has[it.k];
        const own = sc && scVal(sc, it.k) !== undefined;                  // 这个场景单独设过
        const base = itemOn(it, '');                                       // 总设置是什么
        const setCall = (scOverride === undefined) ? `gyInjectSet('${it.k}', this.checked)`
                                                  : `gyInjectSetIn('${sc}','${it.k}', this.checked)`;
        // always：关不掉的（人设正文那种）。照样列出来——这一页的意义就是让你看到
        // prompt 里到底有什么，漏掉一条就等于骗自己。只是勾选框锁住、点不动。
        if (it.always) {
            return `<label class="gyinj-row lock">
                <input type="checkbox" checked disabled>
                <div class="gyinj-body">
                  <div class="gyinj-t">${esc(it.label)}
                    <span class="gyinj-tag own">永远带着 · 关不掉</span>
                  </div>
                  ${it.desc ? `<div class="gyinj-d">${mk(it.desc)}</div>` : ''}
                </div>
            </label>`;
        }
        return `<label class="gyinj-row${on ? '' : ' off'}${own ? ' own' : ''}">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="${setCall}">
            <div class="gyinj-body">
              <div class="gyinj-t">${esc(it.label)}
                ${it.link && !sc ? '<span class="gyinj-tag link">和活人感页同一个开关</span>' : ''}
                ${it.auto ? '<span class="gyinj-tag">自动认出来的</span>' : ''}
                ${own ? '<span class="gyinj-tag own">这一场单独设的</span>'
                      : (sc ? `<span class="gyinj-tag dim">跟总设置一样（${base ? '带' : '不带'}）</span>` : '')}
                <span class="gyinj-tag ${live ? 'live' : 'dim'}">${live ? '现在有内容' : '现在是空的'}</span>
              </div>
              ${it.desc ? `<div class="gyinj-d">${mk(it.desc)}</div>` : ''}
            </div>
            ${own ? `<span class="gyinj-peek" onclick="event.preventDefault();event.stopPropagation();gyInjectSameIn('${sc}','${it.k}')">跟总设置</span>` : ''}
            <span class="gyinj-peek" onclick="event.preventDefault();event.stopPropagation();gyInjectPeek('${it.k}')">看一眼</span>
        </label>`;
    }

    // 有些组自带一小块设置（比如「全站内容」的取多少条），由那个组自己的文件画。
    // 这里只负责在组的说明底下把它插进来；画不出来就当没有，不能带崩整页。
    const ctrlHtml = g => {
        try { const f = g && g.ctrl && window[g.ctrl]; return typeof f === 'function' ? (f() || '') : ''; }
        catch (e) { return ''; }
    };

    window.renderInjectPanel = function renderInjectPanel() {
        const box = document.getElementById('gyinjList');
        if (!box) return;
        let has = {};
        try { has = probe(); } catch (e) {}

        let all = 0, on = 0;
        const blocks = GROUPS.map(g => {
            const items = g.items.concat(extraItemsOf(g));
            const gOn = items.filter(x => itemOn(x, viewScene)).length;
            all += items.length; on += gOn;
            const shown = onlyOff ? items.filter(x => !itemOn(x, viewScene)) : items;
            const open = openG[g.key] || (onlyOff && shown.length);
            if (onlyOff && !shown.length) return '';
            return `<div class="gyinj-g${open ? ' open' : ''}">
              <div class="gyinj-gh" onclick="gyInjectToggleG('${g.key}')">
                <span class="gyinj-gi">${g.icon}</span>
                <b>${esc(g.title)}</b>
                <span class="gyinj-gn">${gOn}/${items.length}</span>
                <span class="gyinj-sp"></span>
                <span class="gyinj-ga" onclick="event.stopPropagation();gyInjectGroupSet('${g.key}',true)">全开</span>
                <span class="gyinj-ga off" onclick="event.stopPropagation();gyInjectGroupSet('${g.key}',false)">全关</span>
                <span class="gyinj-gc">${open ? '收起 ⌃' : '展开 ⌄'}</span>
              </div>
              ${open ? `<div class="gyinj-gb">
                ${g.note ? `<div class="gyinj-gnote">${mk(g.note)}</div>` : ''}
                ${ctrlHtml(g)}
                ${shown.map(it => rowHtml(it, has)).join('')}
              </div>` : ''}
            </div>`;
        }).join('');

        // 第二块：生成时读什么
        let sAll = 0, sOn = 0;
        const sBlocks = (window.gyInjectSrc ? window.gyInjectSrc.all() : []).map(g => {
            const gOn = g.items.filter(it => window.gyInjectSrc.on(g.feat, it.k, viewScene)).length;
            sAll += g.items.length; sOn += gOn;
            const key = 'src:' + g.feat;
            const shown = onlyOff ? g.items.filter(it => !window.gyInjectSrc.on(g.feat, it.k, viewScene)) : g.items;
            if (onlyOff && !shown.length) return '';
            const open = openG[key] || (onlyOff && shown.length);
            return `<div class="gyinj-g${open ? ' open' : ''}">
              <div class="gyinj-gh" onclick="gyInjectToggleG('${key}')">
                <span class="gyinj-gi">${g.icon}</span>
                <b>${esc(g.title)}</b>
                <span class="gyinj-gn">${gOn}/${g.items.length}</span>
                <span class="gyinj-sp"></span>
                <span class="gyinj-ga" onclick="event.stopPropagation();gyInjectSrcAll('${g.feat}',true)">全开</span>
                <span class="gyinj-ga off" onclick="event.stopPropagation();gyInjectSrcAll('${g.feat}',false)">全关</span>
                <span class="gyinj-gc">${open ? '收起 ⌃' : '展开 ⌄'}</span>
              </div>
              ${open ? `<div class="gyinj-gb">
                ${g.note ? `<div class="gyinj-gnote">${mk(g.note)}</div>` : ''}
                ${shown.map(it => {
                    const isOn = window.gyInjectSrc.on(g.feat, it.k, viewScene);
                    const own = viewScene && scVal(viewScene, 'src:' + g.feat + ':' + it.k) !== undefined;
                    const base = window.gyInjectSrc.on(g.feat, it.k, '');
                    return `<label class="gyinj-row${isOn ? '' : ' off'}${own ? ' own' : ''}">
                      <input type="checkbox" ${isOn ? 'checked' : ''} onchange="gyInjectSrcSet('${g.feat}','${it.k}', this.checked)">
                      <div class="gyinj-body">
                        <div class="gyinj-t">${esc(it.label)}${it.defaultOff && !viewScene ? '<span class="gyinj-tag">默认关</span>' : ''}
                          ${own ? '<span class="gyinj-tag own">这一场单独设的</span>'
                                : (viewScene ? `<span class="gyinj-tag dim">跟总设置一样（${base ? '读' : '不读'}）</span>` : '')}
                        </div>
                        ${it.desc ? `<div class="gyinj-d">${mk(it.desc)}</div>` : ''}
                      </div>
                      ${own ? `<span class="gyinj-peek" onclick="event.preventDefault();event.stopPropagation();gyInjectSrcSame('${g.feat}','${it.k}')">跟总设置</span>` : ''}
                    </label>`;
                }).join('')}
              </div>` : ''}
            </div>`;
        }).join('');

        const scCount = k => Object.keys((S.sc && S.sc[k]) || {}).length;
        const chips = `<div class="gyinj-scn">
            <div class="gyinj-scn-hd">先选一个场景，再往下勾——<b>同一条数据，在不同场合该不该带，可以不一样</b>。</div>
            <div class="gyinj-vm">
              <span class="gyinj-vmc on" onclick="gyInjectViewMode('data')">📚 按数据看</span>
              <span class="gyinj-vmc" onclick="gyInjectViewMode('feat')">🧰 按功能看</span>
              <span class="gyinj-vm-tip">想知道"发推文到底读了什么"，切到「按功能看」一眼就全在那儿</span>
            </div>
            <div class="gyinj-scn-row">
              <span class="gyinj-chip${viewScene ? '' : ' on'}" onclick="gyInjectSceneView('')">⚙️ 总设置</span>
              ${SCENES.map(x => `<span class="gyinj-chip${viewScene === x.k ? ' on' : ''}" onclick="gyInjectSceneView('${x.k}')">
                 ${x.icon} ${esc(x.title)}${scCount(x.k) ? `<i>${scCount(x.k)}</i>` : ''}</span>`).join('')}
            </div>
            ${viewScene ? `<div class="gyinj-scn-tip">
              现在改的是 <b>${esc((sceneOf(viewScene) || {}).title || viewScene)}</b> 这一个场景，
              动了的条目只在这里生效，别处照旧。没单独设过的跟总设置走。
              ${(sceneOf(viewScene) || {}).srcOnly ? '<br>这一场是程序在<b>替角色编内容</b>，主要看下面第二块「允许它读什么」。' : ''}
              ${(sceneOf(viewScene) || {}).note ? '<br>' + esc(sceneOf(viewScene).note) : ''}
              ${scCount(viewScene) ? `<br><span class="gyinj-scn-reset" onclick="gyInjectSceneReset()">↺ 这一场单独设的全撤掉（${scCount(viewScene)} 条）</span>` : ''}
            </div>` : `<div class="gyinj-scn-tip">现在改的是<b>总设置</b>：改了对所有场景生效，除非那个场景自己另设过。</div>`}
          </div>`;

        /* ===== 「按功能看」：每一个功能列出来，点开就是它读的全部东西 =====
           以前这一页只按"数据"分组，功能只是顶上一排小标签——
           想知道"发推文到底读了什么"，得先点那个标签，再从 20 多组里一组组翻。
           这个视图反过来：功能在外层，点开一个，底下就是**它读的完整清单**
           （prompt 的每一段 + 这个功能自己额外读的素材），就地勾。 */
        if (viewMode === 'feat') {
            const featBlocks = SCENES.map(sc => {
                const srcG = (window.gyInjectSrc ? window.gyInjectSrc.all() : []).filter(g => g.feat === sc.k);
                // 这一场带了多少段 prompt
                let fAll = 0, fOn = 0;
                GROUPS.forEach(g => {
                    const items = g.items.concat(extraItemsOf(g));
                    items.forEach(x => { fAll++; if (itemOn(x, sc.k)) fOn++; });
                });
                let sTot = 0, sOnN = 0;
                srcG.forEach(g => g.items.forEach(it => { sTot++; if (window.gyInjectSrc.on(g.feat, it.k, sc.k)) sOnN++; }));
                const mine = Object.keys((S.sc && S.sc[sc.k]) || {}).length;
                const open = openF[sc.k];
                const body = !open ? '' : `<div class="gyinj-gb">
                    ${sc.note ? `<div class="gyinj-gnote">${mk(sc.note)}</div>` : ''}
                    <div class="gyinj-gnote">
                      下面是<b>这个功能读的全部东西</b>，就地勾就是给这一场单独设，别的场景不受影响。
                      ${mine ? `已经单独设过 ${mine} 条　<span class="gyinj-scn-reset" onclick="gyInjectSceneResetOf('${sc.k}')">↺ 全撤掉</span>` : '现在全部跟总设置走。'}
                    </div>
                    ${srcG.map(g => `<div class="gyinj-fsec">🔧 ${esc(g.title)}（这个功能自己额外读的素材）</div>
                      ${g.items.map(it => {
                        const isOn = window.gyInjectSrc.on(g.feat, it.k, sc.k);
                        const own = scVal(sc.k, 'src:' + g.feat + ':' + it.k) !== undefined;
                        return `<label class="gyinj-row${isOn ? '' : ' off'}${own ? ' own' : ''}">
                          <input type="checkbox" ${isOn ? 'checked' : ''} onchange="gyInjectSrcSetIn('${sc.k}','${g.feat}','${it.k}', this.checked)">
                          <div class="gyinj-body"><div class="gyinj-t">${esc(it.label)}
                            ${own ? '<span class="gyinj-tag own">这一场单独设的</span>' : ''}</div>
                            ${it.desc ? `<div class="gyinj-d">${mk(it.desc)}</div>` : ''}</div>
                        </label>`; }).join('')}`).join('')}
                    ${/* ⚠️ 这里原来写的是 sc.srcOnly ? '' : …，把那 5 个"程序替角色编内容"的功能
                          整份清单藏了，只留它们自己那几项——于是页面上看着像"这几个功能只读 4 项"。
                          查过了：小剧场 / 联网探索 / 很久没回 / 手机里那些人 / 换装，
                          **五个全都调 buildBasePrompt**，也就是那 71 段它们一段不落全读。
                          藏起来等于骗人，现在一视同仁全列出来。 */ ''}
                    ${GROUPS.map(g => {
                        const items = g.items.concat(extraItemsOf(g));
                        const n = items.filter(x => itemOn(x, sc.k)).length;
                        return `<div class="gyinj-fsec">${g.icon} ${esc(g.title)} <i>${n}/${items.length}</i></div>
                                ${ctrlHtml(g)}
                                ${items.map(it => rowHtml(it, has, sc.k)).join('')}`;
                    }).join('')}
                  </div>`;
                return `<div class="gyinj-g${open ? ' open' : ''}">
                  <div class="gyinj-gh" onclick="gyInjectToggleF('${sc.k}')">
                    <span class="gyinj-gi">${sc.icon}</span>
                    <b>${esc(sc.title)}</b>
                    <span class="gyinj-gn">带 ${fOn}/${fAll} 段${sTot ? ` · 另读 ${sOnN}/${sTot} 项` : ''}</span>
                    ${mine ? `<span class="gyinj-tag own">单独设了 ${mine} 条</span>` : ''}
                    <span class="gyinj-sp"></span>
                    <span class="gyinj-gc">${open ? '收起 ⌃' : '展开 ⌄'}</span>
                  </div>
                  ${body}
                </div>`;
            }).join('');
            box.innerHTML = `<div class="gyinj-scn"><div class="gyinj-scn-hd">
                <b>按功能看</b>：每个功能点开，底下就是它读的<b>全部</b>数据——prompt 的每一段、
                加上这个功能自己额外读的素材。就地勾＝只改这一个功能。</div>
                <div class="gyinj-vm">
                  <span class="gyinj-vmc" onclick="gyInjectViewMode('data')">📚 按数据看</span>
                  <span class="gyinj-vmc on" onclick="gyInjectViewMode('feat')">🧰 按功能看</span>
                </div></div>
              <div class="gyinj-top"><div class="gyinj-sum">一共 <b>${SCENES.length}</b> 个功能</div>
                <div class="gyinj-acts"><button type="button" onclick="gyInjectResetAll()">全部恢复注入</button></div></div>
              ${featBlocks}`;
            return;
        }

        box.innerHTML = chips + `
          <div class="gyinj-top">
            <div class="gyinj-sum">${viewScene
              ? `这一场带 <b class="ok">${on}</b> / ${all} 条注入${all - on ? `，不带 <b class="bad">${all - on}</b> 条` : ''}`
              : `注入 <b>${all}</b> 条（开着 <b class="ok">${on}</b>）　·　生成读取 <b>${sAll}</b> 项（开着 <b class="ok">${sOn}</b>）${(all - on) + (sAll - sOn) ? `　·　关掉了 <b class="bad">${(all - on) + (sAll - sOn)}</b>` : ''}`}</div>
            <div class="gyinj-acts">
              <button type="button" onclick="gyInjectAllG(true)">全部展开</button>
              <button type="button" onclick="gyInjectAllG(false)">全部收起</button>
              <button type="button" class="${onlyOff ? 'on' : ''}" onclick="gyInjectFilter(${onlyOff ? 'false' : 'true'})">只看关掉的</button>
              <button type="button" class="ghost" onclick="gyInjectResetAll()">全部恢复注入</button>
            </div>
          </div>
          <div class="gyinj-h2">${viewScene ? `${(sceneOf(viewScene) || {}).icon || ''} 「${esc((sceneOf(viewScene) || {}).title || viewScene)}」这一场带哪几段`
                                        : '① 说话之前塞给模型的 prompt 里，带哪几段'}</div>
          ${blocks || '<div class="gyinj-empty">没有符合条件的条目。</div>'}
          <div class="gyinj-h2">${viewScene ? `${(sceneOf(viewScene) || {}).icon || ''} 这一场里跑到下面这些生成器时，允许它读什么`
                                        : '② 各个功能自己生成内容的时候，允许它读什么'}
            <em>${viewScene ? `这一场读 ${sOn} / ${sAll} 项` : `一共 ${sAll} 项，开着 ${sOn} 项`}</em></div>
          <div class="gyinj-gnote" style="padding:0 2px 8px;">${viewScene ? `没单独设过的跟总设置走。<b>大部分生成器只在自己那一场里跑</b>——
          真正用得上分场景的是「🧭 自主模式」：自主模式调起小剧场/联网探索的时候算那一场，
          你手动点的那次算它们各自那一场，所以"自动跑省着点、我点的时候全读上"是设得出来的。` : `跟上面那一块不是一回事：上面管的是"角色说话时知道什么"，
          这里管的是"程序替角色编内容时手里有什么素材"——比如 TA 手机里那些人发来的消息，
          是照着 TA 真实的一天编的还是套模板。全关掉就退回固定模板，不读任何真实数据。`}</div>
          ${sBlocks || '<div class="gyinj-empty">还没有功能登记它会读什么。</div>'}`;
    };

    /* ============ 挂进设置页 ============ */
    const PANEL_HTML = `
      <div class="form-hint">
        每次让角色说话，程序会先把一大堆东西拼成 prompt 交给模型：人设、日程、记忆、
        钱包、手机、天气……这一页把它们<b>一条一条摊开</b>，你自己决定带哪些。<br>
        <span style="color:#8b98a5;">关掉一条 = 模型看不到这条，但功能本身照常跑、数据照常记
        （比如关掉「你的钱」，钱还是照扣，只是角色不知道自己有多少）。
        prompt 越短越省钱，也越不容易被不相干的细节带跑。<br>
        而且<b>可以分场合</b>：私聊时什么都带，发推文时只留人设——同一条数据在不同场景可以不一样。</span>
      </div>
      <div id="gyinjList"></div>
      <div id="gyinjPeek" onclick="if(event.target===this)gyInjectPeekClose()">
        <div class="gyinj-peekbox">
          <div class="gyinj-peekhd">这一条现在会塞进去的原文
            <span onclick="gyInjectPeekClose()">✕</span></div>
          <pre id="gyinjPeekBody"></pre>
        </div>
      </div>`;

    const CSS = `
    #setPanel-inject .gyinj-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 8px;}
    .gyinj-sum{font-size:12.5px;color:#8b98a5;flex:1;min-width:180px;}
    .gyinj-sum b{color:inherit;} .gyinj-sum b.ok{color:var(--gy-accent);} .gyinj-sum b.bad{color:var(--gy-bad,#f4212e);}
    .gyinj-acts{display:flex;gap:6px;flex-wrap:wrap;}
    .gyinj-acts button{border:1px solid var(--gy-line,#cfd9de);background:transparent;color:inherit;
      border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit;}
    .gyinj-acts button.on{border-color:var(--gy-accent);color:var(--gy-accent);background:rgba(var(--gy-accent-rgb),.1);}
    .gyinj-acts button.ghost{color:#8b98a5;}
    .gyinj-g{border:1px solid var(--gy-line,#cfd9de);border-radius:12px;margin-bottom:8px;overflow:hidden;}
    .gyinj-g.open{border-color:rgba(var(--gy-accent-rgb),.5);}
    .gyinj-gh{display:flex;align-items:center;gap:8px;padding:11px 13px;cursor:pointer;user-select:none;
      background:rgba(128,128,128,.05);font-size:14px;}
    .gyinj-g.open .gyinj-gh{background:rgba(var(--gy-accent-rgb),.07);}
    .gyinj-gi{font-size:16px;}
    .gyinj-gn{font-size:11.5px;color:#8b98a5;border:1px solid var(--gy-line,#cfd9de);border-radius:999px;padding:1px 8px;}
    .gyinj-sp{flex:1;}
    .gyinj-ga{font-size:11.5px;color:var(--gy-accent);cursor:pointer;}
    .gyinj-ga.off{color:#8b98a5;}
    .gyinj-gc{font-size:11.5px;color:#8b98a5;white-space:nowrap;}
    .gyinj-gb{padding:4px 13px 10px;}
    .gyinj-gnote{font-size:12px;color:#8b98a5;line-height:1.75;padding:8px 0 4px;}
    .gyinj-row{display:flex;align-items:flex-start;gap:9px;padding:10px 0;cursor:pointer;
      border-top:1px solid rgba(128,128,128,.14);}
    .gyinj-row>input{width:16px;height:16px;margin-top:2px;flex-shrink:0;cursor:pointer;}
    .gyinj-row.off .gyinj-t{color:#8b98a5;text-decoration:line-through;text-decoration-thickness:1px;}
    .gyinj-body{flex:1;min-width:0;}
    .gyinj-t{font-size:13.5px;font-weight:600;line-height:1.55;}
    .gyinj-d{font-size:11.5px;color:#8b98a5;line-height:1.75;margin-top:3px;}
    .gyinj-tag{font-size:10px;font-weight:400;border-radius:4px;padding:1px 5px;margin-left:6px;
      border:1px solid var(--gy-line,#cfd9de);color:#8b98a5;white-space:nowrap;}
    .gyinj-tag.link{border-color:rgba(var(--gy-accent-rgb),.5);color:var(--gy-accent);}
    .gyinj-tag.live{border-color:rgba(var(--gy-accent-rgb),.5);color:var(--gy-accent);}
    .gyinj-peek{font-size:11.5px;color:var(--gy-accent);cursor:pointer;white-space:nowrap;padding-top:2px;}
    .gyinj-empty{color:#8b98a5;text-align:center;padding:28px;font-size:13px;}
    .gyinj-h2{font-size:13px;font-weight:700;margin:20px 0 8px;padding-bottom:5px;
      border-bottom:2px solid var(--gy-accent);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
    .gyinj-h2:first-of-type{margin-top:6px;}
    .gyinj-h2 em{font-style:normal;font-size:11.5px;font-weight:400;color:#8b98a5;}
    .gyinj-scn{margin:14px 0 4px;}
    .gyinj-scn-hd{font-size:12px;color:#8b98a5;line-height:1.75;margin-bottom:8px;}
    .gyinj-scn-row{display:flex;flex-wrap:wrap;gap:5px;}
    .gyinj-chip{font-size:12px;padding:5px 11px;border-radius:999px;cursor:pointer;user-select:none;
      border:1px solid var(--gy-line,#cfd9de);color:#8b98a5;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;}
    .gyinj-chip.on{border-color:var(--gy-accent);color:var(--gy-accent);background:rgba(var(--gy-accent-rgb),.12);font-weight:600;}
    .gyinj-chip i{font-style:normal;font-size:10px;background:var(--gy-accent);color:var(--gy-accent-fg,#fff);
      border-radius:999px;padding:0 5px;line-height:15px;}
    .gyinj-scn-tip{font-size:11.5px;color:#8b98a5;line-height:1.8;margin-top:9px;padding:8px 11px;border-radius:10px;
      background:rgba(var(--gy-accent-rgb),.06);border:1px dashed rgba(var(--gy-accent-rgb),.3);}
    .gyinj-scn-tip b{color:inherit;}
    .gyinj-scn-reset{color:var(--gy-accent);cursor:pointer;}
    .gyinj-row.own{background:rgba(var(--gy-accent-rgb),.05);border-radius:8px;padding-left:6px;padding-right:6px;}
    .gyinj-vm{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;}
    .gyinj-vmc{border:1px solid var(--gy-border,#cfd9de);border-radius:999px;padding:4px 12px;
        font-size:12.5px;cursor:pointer;line-height:1.7;transition:.15s;}
    .gyinj-vmc:hover{border-color:#1d9bf0;color:#1d9bf0;}
    .gyinj-vmc.on{background:#1d9bf0;border-color:#1d9bf0;color:#fff;font-weight:600;}
    .gyinj-vm-tip{font-size:11px;opacity:.6;}
    .gyinj-fsec{font-size:12px;font-weight:700;opacity:.75;margin:12px 0 2px;padding-top:8px;
        border-top:1px dashed var(--gy-border,#e6ecf0);}
    .gyinj-fsec i{font-style:normal;font-weight:400;opacity:.6;margin-left:4px;}
    .gyinj-row.lock{cursor:default;opacity:.92;}
    .gyinj-row.lock>input{cursor:not-allowed;}
    .gyinj-tag.own{border-color:var(--gy-accent);color:var(--gy-accent);}
    #gyinjPeek{position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,.45);display:none;
      align-items:center;justify-content:center;padding:18px;}
    #gyinjPeek.on{display:flex;}
    .gyinj-peekbox{background:var(--gy-bg,#fff);color:inherit;border-radius:14px;width:620px;max-width:100%;
      max-height:80vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--gy-line,#cfd9de);}
    body.dark-theme .gyinj-peekbox{background:#16181c;}
    .gyinj-peekhd{padding:13px 16px;font-size:14px;font-weight:700;display:flex;align-items:center;
      border-bottom:1px solid var(--gy-line,#cfd9de);}
    .gyinj-peekhd span{margin-left:auto;cursor:pointer;color:#8b98a5;font-weight:400;}
    #gyinjPeekBody{margin:0;padding:14px 16px 18px;overflow:auto;font-size:12.5px;line-height:1.85;
      white-space:pre-wrap;word-break:break-word;font-family:inherit;}
    `;

    function mount() {
        if (document.getElementById('setPanel-inject')) return true;
        const anchor = document.getElementById('setPanel-auto');
        if (!anchor || !anchor.parentNode) return false;
        const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

        const panel = document.createElement('div');
        panel.className = 'set-panel';
        panel.id = 'setPanel-inject';
        panel.style.cssText = 'display:none; padding:15px 20px 30px; max-width:700px; margin:0 auto;';
        panel.innerHTML = PANEL_HTML;
        anchor.parentNode.insertBefore(panel, anchor.nextSibling);

        try { if (typeof GY_SETTINGS_PANELS !== 'undefined') GY_SETTINGS_PANELS.inject = '🧾 注入内容管理'; } catch (e) {}

        // 索引页上插一颗按钮，就放在「自动功能开关」后面
        try {
            const entries = document.querySelectorAll('#setIndex .set-entry');
            let after = null;
            entries.forEach(b => { if ((b.getAttribute('onclick') || '').indexOf("'auto'") >= 0) after = b; });
            if (after && !document.getElementById('setEntryInject')) {
                const btn = document.createElement('button');
                btn.type = 'button'; btn.className = 'set-entry'; btn.id = 'setEntryInject';
                btn.setAttribute('data-core', '1');
                btn.setAttribute('onclick', "openSettingsPanel('inject')");
                btn.innerHTML = `<span class="set-entry-ico">🧾</span>
                  <span class="set-entry-main"><span class="set-entry-title">注入内容管理</span>
                  <span class="set-entry-desc">每个功能会往 prompt 里塞什么，一条一条自己挑</span></span>
                  <span class="set-entry-arrow">›</span>`;
                after.parentNode.insertBefore(btn, after.nextSibling);
            }
        } catch (e) {}

        // 进这一页才画
        try {
            const prev = window.openSettingsPanel;
            if (window.openSettingsPanel instanceof Function && !prev.__gyInjPatched) {
                const w = function (key) {
                    const r = prev.apply(this, arguments);
                    if (key === 'inject') { try { renderInjectPanel(); } catch (e) {} }
                    return r;
                };
                w.__gyInjPatched = true;
                window.openSettingsPanel = w;
            }
        } catch (e) {}
        return true;
    }

    /* ============ 起 ============ */
    wrapAll();                                   // 越早套上越好，免得有人先拼过一次 prompt
    wrapScenes();
    load();
    function boot() {
        wrapAll();                               // 晚加载的模块再套一遍
        wrapScenes();
        if (!mount()) setTimeout(mount, 1200);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
    else setTimeout(boot, 600);
    setTimeout(() => { wrapAll(); wrapScenes(); mount(); }, 2500);
})();
