// ✂️ 这个文件是从 01-core-state-infra.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 01-core-state-infra.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。
const GY_APP_VERSION = 'v' + (typeof GY_VERSION !== 'undefined' ? GY_VERSION : '?');   // 跟 index.html 里的 GY_VERSION 走，这里不用改

const GY_FEATURE_MAP = {
    // 聊天
    triggerAIBatchReply: '聊天', retriggerLastReply: '聊天', contextActionEditCharMsg: '聊天',
    triggerNudge: '聊天', sendProactiveChatMessage: '主动找你聊天', aliveGlanceRun: '聊天（忙时看一眼）',
    refreshLifeStateOnChatEnter: '角色状态/日程', checkAndFlowSchedules: '角色状态/日程',
    runScheduleGeneration: '角色状态/日程', generateCharAnniversaryNote: '纪念日',
    checkAndAutoSummarizeChat: '聊天自动总结', checkAndAutoSummarizeGroupChat: '聊天自动总结',
    // 推文 / 评论
    userPost: '发推文', executeGenerationInner: '发推文', postCharacterTweet: '发推文',
    triggerRelatedCharacterReactions: '推文连锁反应', updateCharMemoryAsync: '推文记忆总结',
    runCharRepliesToComment: '评论区', submitInlineReply: '评论区', retriggerCharComments: '评论区',
    maybeCharsReactToNpcComments: '评论区', pickInterestedChars: '评论区',
    spawnNpcComments: 'NPC路人跟帖', npcArgueWithEachOther: 'NPC路人跟帖',
    // 论坛 / 营销号
    runCharRepliesToAnonPost: '匿名论坛', autoGenerateAnonPostForChar: '匿名论坛',
    userAnonPost: '匿名论坛',
    triggerForumCharReply: '小说论坛', generateNpcForumReplies: '小说论坛',
    autoGenerateForumThreadForChar: '小说论坛',
    generateTabloidPost: '营销号', rollTabloidAIParticipation: '营销号', triggerTabloidReactToQuote: '营销号',
    // 长文本
    generateNovelChapter: '小说', generateNovelFromSources: '小说',
    sendSsTurn: '续写', regenSsTurn: '续写',
    generateDiaryContent: '日记', generateTitledLetterContent: '信件', resolveDiaryReaction: '日记',
    // 杂项
    generateRandomGreeting: '随机开场白', aiCompleteCharProfile: '角色资料自动填写',
    askCharGameInvite: '小游戏', askCharGameEndComment: '小游戏',
    getSemanticContext: '向量记忆检索', embedMessageInBackground: '向量记忆检索',
    // 待办 / 自主模式
    generateCharTodosAI: '待办清单', generateCharTodosForChar: '待办清单',
    runAutonomyTurn: 'TA自己决定', autonomyWriteDiary: 'TA自己决定',
    autonomyCommentOnSomePost: 'TA自己决定', autonomyFeedTabloid: 'TA自己决定',
    runTheaterScene: '角色小剧场', updateTheaterMemoryAsync: '小剧场记忆总结'
};
let gyTokenStats = { total: { calls: 0, in: 0, out: 0, cached: 0, estimated: 0 }, byFeature: {}, byDay: {}, since: 0 };

// ===================== 🔌 自动功能开关 =====================
// 这个 app 里有一批功能是**不用你点任何按钮、自己就会去调 API** 的：定时器到点了、
// 进某个页面了、发完帖之后连锁触发……好处是"活的"，坏处是钱在你不知道的时候就花出去了。
// 这里把它们全部列出来，每一项一个独立开关，你想留哪个留哪个。
//
// 默认全开＝跟改造前的行为完全一致，不会因为升级就悄悄少了什么。
// cost 那一栏是实测的量级，只作参考——真实花费还要看你的角色数量、人设长度和世界书大小。
const AUTO_FEATURE_DEFS = [
    { key: 'autoPost',        label: '角色自动发帖',         desc: '按每个角色设置的发帖频率，定时自己发推文 / 小说论坛帖 / 匿名论坛帖。', cost: '每次一条帖子一次调用，角色多、频率高就很可观', group: '主动', where: '资料页 → 发帖频率；效果在首页时间线 / 小说论坛 / 匿名论坛' },
    { key: 'proactiveChat',   label: '角色主动找你聊天',     desc: '按每个角色设置的主动频率，隔一段时间自己发消息过来。', cost: '每条主动消息一次调用', group: '主动', where: '资料页 → 主动聊天频率；效果在私聊列表' },
    { key: 'proactiveLetter', label: '角色主动给你写信',     desc: '角色隔一段时间自己写一封信寄给你。', cost: '每封信一次调用，信件比聊天长很多', group: '主动', where: '资料页 → 写信频率；效果在「信箱」' },
    { key: 'letterReply',     label: '信件到点自动回信',     desc: '你寄出去的信，等设定的延迟时间到了自动生成回信。', cost: '每封回信一次调用，信件比聊天长很多', group: '主动', where: '你在「信箱」寄信时设的延迟；效果在「信箱」' },
    { key: 'diaryReaction',   label: '角色对你日记的反应',   desc: '你写了日记之后，角色到点自动看到并作出反应。', cost: '每次反应一次调用', group: '主动', where: '你在「我的日记」写完之后；效果在私聊 / 评论' },
    { key: 'scheduleFlow',    label: '角色状态跟日程流动',   desc: '每 15 分钟检查一次，按今日日程更新每个角色"此刻在做什么"。', cost: '每个有日程的角色各一次调用，15 分钟一轮', group: '日程', where: '角色的「今日日程」；效果在头像状态气泡、聊天页顶栏' },
    { key: 'scheduleAutoRenew', label: '日程每天自动更新',   desc: '到了第二天，把过期的日程自动重新生成一份。关掉就退回原来的做法——只在角色状态气泡里提示"日程可能过期了"，等你自己右键头像更新。', cost: '每个角色每天一次，日程比聊天长很多；一轮最多续 2 个角色，分几轮慢慢来', group: '日程', where: '角色的「今日日程」；效果在日历页和状态气泡' },
    { key: 'lifeStateEnter',  label: '进聊天页刷新角色状态', desc: '每次点进一个角色的聊天，自动更新一次 TA 此刻在做什么。', cost: '每次进聊天页一次调用', group: '日程', where: '点进某个角色聊天时；效果在聊天页顶栏' },
    // ⚠️ defaultOff：这一项默认**关**。它是后台自己跑的、你不点任何按钮它也会花钱，
    // 所以做成"主动打开才有"，而不是"发现了再去关"。
    { key: 'charTheater',     label: '角色之间的后台小剧场', desc: '每 5 分钟有 30% 概率，让有关系的两个角色在背后自己演一段，存进「我们的故事 → Ta们在做什么」。默认关着——不打开的话一次 API 都不会调。', cost: '触发一次一次调用', defaultOff: true, group: '背后', where: '「我们的故事 → Ta们在做什么」' },
    { key: 'theaterMemory',   label: '小剧场记忆总结',       desc: '把角色参与过的小剧场总结成一段记忆，让 TA 记得"我前几天跟谁发生过什么"。聊天/发推/评论/日记信件/论坛都会用上（小说和续写不用）。', cost: '每个角色攒够 3 场才总结一次', group: '记忆', where: '小剧场记录；效果在「记忆总览」' },
    { key: 'vecAutoBackfill', label: '向量记忆自动补算旧内容', desc: '聊天消息只在**发出的那一刻**算一次向量，所以你打开向量记忆之前的那几百条永远轮不上，数字会一直停在"83 / 260"不动。打开这一项之后，程序每两分钟悄悄补 8 条，数字会自己往上走。也可以不开，去「记忆总览 → 向量记忆」里手动点一次补齐。', cost: '每补一条一次 embedding 调用（很便宜，但不是免费）；一轮最多 8 条', defaultOff: true, group: '记忆', where: '记忆总览 → 🧠 向量记忆' },
    { key: 'chatSummary',     label: '聊天自动总结',         desc: '聊天记录攒够设定条数后，自动总结一次存进记忆，防止聊久了失忆。', cost: '每次总结一次调用，但能省下后续每轮的历史长度', group: '记忆', where: '设置 → 基本设置 → 聊天总结条数；效果在「记忆总览」' },
    { key: 'postMemory',      label: '推文记忆自动总结',     desc: '角色发够设定条数的推文后，自动总结成"专属推文记忆"。', cost: '每次总结一次调用', group: '记忆', where: '设置 → 基本设置 → 推文记忆条数；效果在「记忆总览」' },
    { key: 'scheduleMemory',  label: '日程记忆总结',         desc: '把过去几天的日程归档、总结成一段"最近的生活轨迹"，让角色记得自己前几天在忙什么。聊天/发推/评论/日记信件/论坛都会用上这段记忆（小说和续写不用，那两个有自己的剧情线）。', cost: '攒够 3 天才总结一次，每次一次调用', group: '记忆', where: '日程归档（保留天数在「记忆总览」里调）' },
    { key: 'relatedReaction', label: '关联角色连锁反应',     desc: '一个角色发言后，关系网里跟 TA 有关的角色自动跟着有反应。', cost: '每个被牵动的角色各一次调用', group: '连锁', where: '「关系网」里连着的角色；效果在评论区' },
    { key: 'npcArgue',        label: 'NPC 路人互掐',         desc: 'NPC 路人跟帖之后，让他们之间再互相吵一轮。', cost: '每次一次调用', group: '连锁', where: 'NPC 路人之间；效果在评论区' },
    { key: 'charReactNpc',    label: '角色回应 NPC 评论',    desc: '路人评论出现后，角色自动下场回应路人。', cost: '挑人一次 + 每个下场的角色各一次', group: '连锁', where: 'NPC 路人评论出现之后；效果在评论区' },
    { key: 'tabloidAuto',     label: '营销号自动参与',       desc: '营销号（小报）账号自动跟进、转发、评论热闹事件。', cost: '每次参与一次调用', group: '连锁', where: '营销号（小报）账号；效果在时间线 / 评论区' },
    { key: 'postReactions',   label: '发帖后角色自动来互动', desc: '你发完推文/匿名论坛帖之后，角色自动过来评论或点赞。关掉之后帖子就只是安静地发出去，谁也不会自动出现。', cost: '按上面「每条帖子最多几个角色互动」的人数，每人一次调用——这是整个 app 里最贵的一项', group: '连锁', where: '你发推文或匿名帖之后；效果在该帖的评论区' },
    { key: 'autoTodoGen',     label: '角色自己写待办清单',   desc: '角色待办快办完的时候，结合人设、今天的日程、你们的聊天和 TA 发过的推文，自己再记几件惦记的事。资料页里手动点「让 TA 自己写」不受这个开关影响。', cost: '每个角色每天最多一次', group: '日程', where: '角色资料页 → 待办清单；效果在资料页和日历' },
    // ⚠️ defaultOff：自主模式是后台自己跑、而且真的会替你发推文/发消息/写信的，
    // 所以跟小剧场一样做成"主动打开才有"。
    // 🫀 活人感三件套：都默认关，打开之前 app 行为跟以前一模一样。
    //    ⚠️ 第一项是**唯一一个会让调用变少的开关**——忙碌期里的好几条消息合成一次回复。
    { key: 'aliveOffline',    label: 'TA 不总是在线',       desc: '角色在睡觉或者在忙（按 TA 的日程和状态判断）的时候，你发的消息**不会立刻触发回复**，先挂在那儿；等 TA 那段忙完，再一次性看完、一起回你，并且会自己交代这段时间差（"刚下台"/"刚醒"）。急事豁免词、作息时间、忙完等多久，在「🫀 活人感」里调。', cost: '省钱：忙碌期里连发的好几条合成一次调用，而不是每条一次', defaultOff: true, group: '活人感', where: '设置 → 🫀 活人感（作息 / 急事豁免词 / 等多久 都在那儿调）' },
    { key: 'aliveGlance',     label: '忙的时候也会看一眼手机', desc: '要先开上面的「TA 不总是在线」。TA 在忙或在睡、你的消息被挂起时，TA 会按**你们现在的关系、TA 的性格、手头在干什么、你说的是什么**，自己判断要不要抽空先回一两句——越亲近越可能先回你，关系一般的可能就放着，睡熟了多半根本没看见。回不回、回什么全由 TA 自己决定，不是固定话术。忙完之后照样会正式回你，而且记得自己刚才顺手回过什么。关掉＝原来的样子（挂起期间一声不吭，或者只发资料页里那句自动回复）。', cost: '每次挂起最多两次调用（第一条一次；隔了一阵你又追着发，可能再看一次）', defaultOff: true, group: '活人感', where: '设置 → 自动化 → 活人感' },
    { key: 'aliveMood',       label: '情绪会留到下一轮',     desc: '角色回复时顺带给出这一轮结束时对你的情绪和原因，本地按小时慢慢衰减，下一轮再注入回去——吵完架半小时内语气还是硬的，不会下一句就若无其事。', cost: '不额外调用，只在回复的 JSON 里多两个字段', defaultOff: true, group: '活人感', where: '设置 → 🫀 活人感（衰减半衰期在那儿调）' },
    { key: 'aliveVoice',      label: '按 TA 自己的打字习惯说话', desc: '从角色已经写过的推文/聊天/日记里提炼一份"打字指纹"（句子长短、标点习惯、口头禅、用不用表情），之后每次生成都照着来，不同角色不再是同一个模型腔。提取是手动点的，提完永久复用。', cost: '提取时一次调用，之后完全免费', defaultOff: true, group: '活人感', where: '设置 → 🫀 活人感（在那儿手动点「提取指纹」）' },
    { key: 'aliveFade',       label: '久远的记忆会褪色',     desc: '聊天总结按时间分层注入：这几天的记得清清楚楚，两周前的只剩大概，更久的只剩一个印象——而且角色**知道自己记不清**，会说"好像是…吧"，被你纠正也会接受，不再拿一个月前的细节当确凿事实讲。顺便能往回记更多轮（老的压缩过，不怎么占字数）。', cost: '不额外调用。会多一段「你记不清了」的说明，实测比原来多 70~160 字——换来的是记忆能往回够到两三个月前，而且角色不会再拿模糊的事当确凿的讲', defaultOff: true, group: '活人感', where: '设置 → 🫀 活人感（清晰/模糊的天数在那儿调）' },
    { key: 'aliveBody',       label: '身上的状态会累积',     desc: '按 TA 的日程和当前时间在本地推算累/困/饿/刚喝过酒/刚运动完，注入成"自己感觉到的状态"。累的时候话就短、耐心差；饿和困会让人烦躁。不是让 TA 报告"我好累"，是让这些渗进语气里。', cost: '完全不调用，纯本地推算', defaultOff: true, group: '活人感', where: '设置 → 🫀 活人感（可预览每个角色此刻的状态）' },
    { key: 'readComment',     label: '一起阅读：翻页时角色自动评论',     desc: '每翻到新的一段，角色读一遍这段原文，挑真有感触的句子写评论，评论显示在原文对应句子下面。没感触就不写。', cost: '**每翻一页一次调用**——这一项以前没有开关，翻得快的时候很容易不知不觉花掉一堆', group: '观影阅读', where: '设置 → 🧩 小功能 → 一起阅读' },
    { key: 'filmScene',       label: '一起看电影：看到有想法的地方开口',   desc: '每隔几分钟把这一段字幕给角色看一眼，有感触才说，没有就不说。没导字幕的片子完全不触发（纯陪看）。', cost: '每隔几分钟一次调用（间隔在一起看电影的设置里调，默认 5 分钟）', group: '观影阅读', where: '设置 → 🧩 小功能 → 一起看电影 → ⚙️ 设置' },
    { key: 'filmPause',       label: '一起看电影：你一暂停 TA 接一句',     desc: '按下暂停时角色说一句，像真的在旁边被打断了那样。', cost: '每次暂停一次调用', group: '观影阅读', where: '设置 → 🧩 小功能 → 一起看电影 → ⚙️ 设置' },
    { key: 'filmEnd',         label: '一起看电影：看完给个感想',           desc: '片子放完时角色说一句看完的第一反应，并把这次一起看总结进记忆。', cost: '每部片子结束时，每个一起看的角色各一次', group: '观影阅读', where: '设置 → 🧩 小功能 → 一起看电影 → ⚙️ 设置' },
    { key: 'webExplore',      label: '角色自己上网看东西',                 desc: '角色按自己的人设挑一个此刻真想了解的东西，去网上搜一遍，读完用自己的口吻写一段感想，存进探索记录并进 prompt——以后聊到相关话题时 TA 是真的知道。取内容的方式（读取代理 / 你自己的接口 / 完全不联网）在功能页里选。默认关。', cost: '一次探索 2 次调用（挑题目 + 写感想）+ 一次网络请求；间隔在功能页里调，默认 3 小时', defaultOff: true, group: '背后', where: '设置 → 🧩 小功能 → 联网探索；记录在记忆总览' },
    { key: 'webExploreShare', label: '看到有意思的主动发给你',               desc: '探索完之后，TA 把那段感想直接私聊发给你（"我今天看到个东西……"）。关掉的话记录照样存、prompt 照样进，只是不会主动来找你。功能页里手动点的时候可以单独勾选这次要不要发。', cost: '不额外调用（跟着上面那次一起）', defaultOff: true, group: '背后', where: '设置 → 🧩 小功能 → 联网探索' },
    { key: 'charOwnDays',     label: '日子：角色自己把某天记成纪念日',       desc: '在「TA 自己决定」的自主模式里多一个动作：TA 可以给今天（或者最近某一天）画个圈，写进自己的纪念日，以后每年都会惦记。只有真发生了值得记的事才记，平常的一天不会硬记。默认关，不打开一次 API 都不会调。', cost: '跟着自主模式走，选中这个动作时一次调用', defaultOff: true, group: '背后', where: '角色资料页 → 切到「TA 自己决定」；结果在 🧩 小功能 → 日子' },
    { key: 'diaryReaction',   label: '日记：挂上的角色到点自己来看',       desc: '你写一篇日记、挂上几个角色，过一阵 TA 们会自己去看一眼并写下反应（偷看到了/没看到/看到了假装没看到）。以前这一项没有开关，一篇日记挂三个人就是三次调用，在后台悄悄发生。关掉之后日记照写、人照挂，只是不会自动来看——日记上的「立即回复」按钮不受影响，那是你主动点的。', cost: '一篇日记 × 挂上的角色数，后台定时跑', group: '主动', where: '信件与日记 → 写日记时挂角色' },
    { key: 'novelReview',     label: '故事：角色读完这一章说几句',         desc: '一章存下来之后，被勾进这个故事的角色各自读一遍，以当事人的口吻说几句——不是评文笔，是说"我在那件事里是什么感受"。带着前面章节的梗概，所以接得上上文。点评跟着章节一起显示。默认关；关着也可以在章节上点「💬 让 TA 们说说」手动来一次。', cost: '一章 × 参与角色数 次调用（人数上限在故事页里调，默认 3）', defaultOff: true, group: '连锁', where: '故事 → 打开一本 → 章节列表' },
    { key: 'relLedger',       label: '关系账本：用不用这套好感度',         desc: '关掉之后，账本不再往角色的 prompt 里注入任何东西，也不再自动记账——你和 TA 走到哪一步，回到"由你自己心里有数"。已经记下的流水不会删，随时开回来还在。（记账本身不额外调 API，它是蹭已有回复里的字段。）', cost: '不额外调用', group: '活人感', where: '设置 → 🧩 小功能 → 关系账本' },
    { key: 'inviteInChat',    label: '邀请写进私聊并跳过去',               desc: '一起看电影 / 一起听歌 / 一起阅读 / 约出去，这四个邀请会作为一条消息发进私聊，TA 的回答也在私聊里，发完自动跳过去看 TA 怎么回。关掉就退回老样子：后台悄悄问一句，只弹个提示。', cost: '不额外调用（问 TA 的那一次本来就要发）', group: '活人感', where: '各功能的邀请按钮' },
    { key: 'mallAutoBuy',     label: '商城：角色自己随机网购',             desc: '每 5 分钟掷一次骰子，中了就有个角色心血来潮下单——给自己买，或者给你点份外卖/送样东西，理由由 TA 自己说。默认关着，不打开一次 API 都不会调。', cost: '中了一次一次调用（写下单理由）；概率在商城的设置里调，默认 8%', defaultOff: true, group: '购物', where: '设置 → 🧩 小功能 → 商城 → 设置' },
    { key: 'mallCharSell',    label: '商城：角色自己上架东西卖',           desc: '角色会往货架上摆自己的东西——二手的、自己做的、多买的、用不上的，或者干脆是一份手艺（"帮你写一封信"）。商品名和描述都是 TA 自己的口吻，不是商家话术。上架什么本身就是一条人设信息。默认关；商城设置页里也能手动点一次（手动不看开关）。', cost: '触发一次一次调用，概率是随机购物的一半', defaultOff: true, group: '购物', where: '设置 → 🧩 小功能 → 商城 → 商品页' },
    { key: 'mallTimeline',    label: '商城：物流文案按世界观生成',           desc: '按收货人的世界书写四句物流跟踪文案，古代就是驿站快马，赛博就是无人机。关掉之后时间线照常走，只是四个节点用通用文案。', cost: '每笔订单一次调用（只在下单时生成一次，之后一直用）', group: '购物', where: '设置 → 🧩 小功能 → 商城 → 设置' },
    { key: 'mallReact',       label: '商城：快递到角色手上，TA 可能来找你说一句', desc: '包裹签收时角色自己判断要不要提这件事——惊喜、吐槽、道谢都可能，也可能什么都不说。只有"东西是买给角色的"才触发。', cost: '每个送到角色手上的包裹一次调用', group: '购物', where: '设置 → 🧩 小功能 → 商城 → 设置' },
    { key: 'charAutonomy',    label: '角色自己决定要做什么', desc: '把某个角色切到「TA 自己决定」之后，TA 会结合日程、待办、小剧场记忆和此刻的处境，自己挑一件事去做——发推文、私聊你、写信、写日记、发论坛帖、评论别人、拍你一下、换个状态、划掉一条待办、拉别人演一场……也可能什么都不做。白露里做不做、做哪件全按「🤖 自主行动」里的权重随机决定，不花钱。', cost: '不花钱（白露不接 API）', defaultOff: true, group: '背后', where: '角色资料页 → 切到「TA 自己决定」；效果散在全 app' }
];
// 📂 开关分类。以前 25 个开关是一条大长列表，从头翻到尾也不知道哪个管哪儿；
//    现在按"这个开关管的是什么"分成 6 组，每组一句话说清它管的是哪一块。
//    顺序就是下面这个数组的顺序。
const AUTO_FEATURE_GROUPS = [
    { key: '主动',   icon: '📮', title: '角色主动找你',
      note: '你什么都不做，角色自己发起的。关掉之后角色不会再自己冒出来，但你主动去找 TA 一切照旧。' },
    { key: '连锁',   icon: '💬', title: '你发帖之后的连锁反应',
      note: '你发完推文 / 匿名帖之后，评论区自己热闹起来。这一组是整个 app 最花钱的地方。' },
    { key: '日程',   icon: '🗓️', title: '日程与"此刻在做什么"',
      note: '维持"角色现在正在干嘛"这件事。关光了角色状态就会停在你上次手动更新的那一刻。' },
    { key: '记忆',   icon: '🧠', title: '记忆自动总结',
      note: '把聊久了的记录压成一段记忆，防失忆。这一组多数时候**反而省钱**——总结一次，换掉后面每一轮都要带的长历史。' },
    { key: '背后',   icon: '🎭', title: '背着你发生的事',
      note: '不是冲你来的，是角色之间自己在动。两项都默认关着，不打开一次 API 都不会调。' },
    { key: '观影阅读', icon: '📺', title: '一起看 / 一起读',
      note: '这两个功能里角色会自己开口。**一起阅读以前没有开关**——每翻一页就自动调一次，翻二十页就是二十次，谁都不知道。现在能关了。' },
    { key: '购物',   icon: '🛒', title: '商城与快递',
      note: '角色也会网购。买给角色的东西签收后会真的进 TA 的**随身物**，以后提起来是记得来历的。三项全关掉之后这一页纯手动。' },
    { key: '活人感', icon: '🫀', title: '活人感',
      note: '不新增功能，改的是角色"像不像个人"。全部默认关着；参数在 设置 → 🫀 活人感 里调。' }
];

let autoFeatureSwitches = {};   // { key: false } 才算关；没记录过的一律当开着（＝改造前行为）
function isAutoOn(key) {
    try {
        if (autoFeatureSwitches && autoFeatureSwitches[key] === true) return true;    // 用户明确打开过
        if (autoFeatureSwitches && autoFeatureSwitches[key] === false) return false;  // 用户明确关过
        // 没记录过：看这一项是不是"默认关"的（后台自己跑、又特别费钱的那几项）
        const def = (typeof AUTO_FEATURE_DEFS !== 'undefined') ? AUTO_FEATURE_DEFS.find(f => f.key === key) : null;
        return !(def && def.defaultOff);
    }
    catch (e) { return true; }   // 读取出错宁可让功能照常运行，也不要莫名其妙全哑掉
}

function gyDetectFeature() {
    try {
        const stack = (new Error()).stack || '';
        const lines = stack.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/at\s+(?:async\s+)?([A-Za-z_$][\w$]*)/);
            if (!m) continue;
            const label = GY_FEATURE_MAP[m[1]];
            if (label) return label;
        }
    } catch (e) { /* 拿不到调用栈就归到其它，不影响统计总量 */ }
    return '其它';
}

// data：服务商返回的原始响应；fallbackChars：拿不到 usage 时用来估算的 {inChars,outChars}
// feature：功能名。**必须在发请求之前（同步地）用 gyDetectFeature() 取好再传进来**——
// 等 await 回来之后再抓调用栈，栈已经被异步边界截断了，只会看到一堆 async 内部帧，全都归到「其它」。
function recordTokenUsage(data, fallbackChars, feature) {
    try {
        if (!gyTokenStats || !gyTokenStats.total) gyTokenStats = { total: { calls: 0, in: 0, out: 0, cached: 0, estimated: 0 }, byFeature: {}, byDay: {}, since: 0 };
        if (!gyTokenStats.since) gyTokenStats.since = Date.now();
        const u = (data && data.usage) || {};
        // OpenAI 兼容：prompt_tokens / completion_tokens，缓存命中在 prompt_tokens_details.cached_tokens
        // Anthropic：input_tokens / output_tokens，缓存命中在 cache_read_input_tokens
        let inTok = u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens != null ? u.input_tokens : null);
        let outTok = u.completion_tokens != null ? u.completion_tokens : (u.output_tokens != null ? u.output_tokens : null);
        let cached = (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) || u.cache_read_input_tokens || 0;
        // Anthropic 的 input_tokens 不含缓存命中的部分，要加回去才是"这次一共读了多少输入"
        if (u.input_tokens != null && (u.cache_read_input_tokens || u.cache_creation_input_tokens)) {
            inTok = u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        }
        let estimated = 0;
        if (inTok == null && outTok == null) {
            if (!fallbackChars) return;   // 报错的请求既没 usage 也没内容，不记
            inTok = Math.ceil((fallbackChars.inChars || 0) / 1.8);
            outTok = Math.ceil((fallbackChars.outChars || 0) / 1.8);
            estimated = 1;
        }
        if (!feature) feature = gyDetectFeature();
        const day = new Date().toISOString().slice(0, 10);
        const bump = (o) => { o.calls++; o.in += (inTok || 0); o.out += (outTok || 0); o.cached += cached; o.estimated += estimated; };
        const blank = () => ({ calls: 0, in: 0, out: 0, cached: 0, estimated: 0 });
        bump(gyTokenStats.total);
        if (!gyTokenStats.byFeature[feature]) gyTokenStats.byFeature[feature] = blank();
        bump(gyTokenStats.byFeature[feature]);
        if (!gyTokenStats.byDay[day]) gyTokenStats.byDay[day] = blank();
        bump(gyTokenStats.byDay[day]);
        // 只留最近 60 天，不然存档会一直涨
        const days = Object.keys(gyTokenStats.byDay).sort();
        while (days.length > 60) delete gyTokenStats.byDay[days.shift()];
        // 统计本身不值得为它单独写一次存档（saveAllData 是全量结构化克隆，很重），
        // 攒够一批再落盘；真正的存档时机由各功能自己的 saveAllData 顺带带走。
        gyTokenStats.__dirty = (gyTokenStats.__dirty || 0) + 1;
        if (gyTokenStats.__dirty >= 10 && typeof saveAllData === 'function') { gyTokenStats.__dirty = 0; saveAllData(); }
    } catch (e) { console.warn('[Token统计] 记录失败（不影响正常使用）：', e); }
}
function gyContentChars(content) {
    try {
        if (typeof content === 'string') return content.length;
        if (Array.isArray(content)) return content.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length), 0);
        return 0;
    } catch (e) { return 0; }
}
// 💭 收纳盒开着 + Gemini：默认不把思考发回来，要明说 include_thoughts 才给。
//    中转不认这个字段报错的话，记下来这个模型以后就不加了，并且这一次不带它重发。
function gyThoughtsExtra(api) {
    try {
        return null;   // 已停用（用户要求）：不再主动让模型把思考发回来
        if (localStorage.getItem('gy_no_thoughts_' + api.model)) return null;
        return { extra_body: { google: { thinking_config: { include_thoughts: true } } } };
    } catch (e) { return null; }
}
function gyThoughtsRefused(api) { try { localStorage.setItem('gy_no_thoughts_' + api.model, '1'); } catch (e) {} }
// Gemini 把思考写成 <thought>…</thought>：统一成 <think>，后面剥离/收纳那一整套都认
const gyNormThought = t => (typeof t === 'string' && t.indexOf('<thought') !== -1) ? t.replace(/<thought>/g, '<think>').replace(/<\/thought>/g, '</think>') : t;
async function sendChatRequestRaw(api, content, extraBody) {
    // 🎲 字数/条数设成「TA 定」的：把"不超过 占位数 字"换成"长短你自己定"（js/53）
    if (typeof window.gyTaRewrite === 'function') content = window.gyTaRewrite(content);
    extraBody = extraBody || {};
    // 📊 功能归类必须在这里同步取——下面一 await，调用栈就断了（见 recordTokenUsage 的说明）
    const __gyFeature = gyDetectFeature();
    const messages = isStructuredMessages(content) ? content : [{ role: "user", content: content }];
    if (isAnthropicApiUrl(api.url)) {
        try {
            const systemText = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
            let restMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: convertContentForAnthropic(m.content) }));
            if (restMsgs.length === 0) restMsgs = [{ role: 'user', content: '（请继续。）' }];
            const anthropicBody = Object.assign({ model: api.model, max_tokens: 4096, messages: restMsgs }, getSamplerExtraBody(true), extraBody);
            // 💰 提示词缓存：system 块（人设+世界书+预设，动辄五六千字）每次请求都一模一样地重发一遍。
            // Anthropic 支持显式标记要缓存的部分，命中之后这一段的输入价格只要 1 折。
            // 用数组形式的 system 才能挂 cache_control；纯字符串是挂不上的。
            // 太短的内容不值得（也达不到服务商的最小缓存长度），所以只在够长时才标记。
            if (systemText) {
                anthropicBody.system = (systemText.length >= 2000)
                    ? [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }]
                    : systemText;
            }
            const res = await smartFetch(`${api.url}/v1/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': api.key, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify(anthropicBody)
            });
            const data = await res.json();
            if (data.error) return { error: { message: (data.error && data.error.message) || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) } };
            // 扩展思考(extended thinking)模式下，data.content 是多个内容块的数组，思考正文在 type:'thinking' 的块里，
            // 真正的回复文字在 type:'text' 的块里，两者是分开的——不像"文本里自带<think>标签"那样天然混在一起。
            // 这里把思考内容包成<think>标签拼在正文最前面，复用下面 extractLeadingReasoning/processReasoningInText
            // 那一整套"识别思维链→按设置折叠/隐藏/保留"的逻辑，不用再另外维护一套。
            const blocks = data.content || [];
            const textBlock = blocks.find(b => b && b.type === 'text') || blocks[0] || {};
            const thinkingText = blocks.filter(b => b && b.type === 'thinking' && b.thinking).map(b => b.thinking).join('\n\n');
            let text = textBlock.text || '';
            if (thinkingText) text = `<think>${thinkingText}</think>${text}`;
            recordTokenUsage(data, { inChars: gyContentChars(content), outChars: text.length }, __gyFeature);
            return { choices: [{ message: { content: text } }] };
        } catch (e) {
            return { error: { message: enhanceNetworkErrorMessage(e.message) } };
        }
    }
    try {
        const __th = gyThoughtsExtra(api);
        const doFetch = (th) => smartFetch(`${api.url}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.key}` },
            body: JSON.stringify(Object.assign({ model: api.model, messages: messages }, getSamplerExtraBody(false), th || {}, extraBody))
        });
        let res = await doFetch(__th);
        let raw = await res.json().catch(() => ({ error: { message: 'HTTP ' + res.status } }));
        if (__th && (!res.ok || (raw && raw.error))) { gyThoughtsRefused(api); res = await doFetch(null); raw = await res.json(); }
        try { const m0 = raw && raw.choices && raw.choices[0] && raw.choices[0].message; if (m0 && typeof m0.content === 'string') m0.content = gyNormThought(m0.content); } catch (e) {}
        // 不少支持"推理模型"的服务商（DeepSeek-R1、Qwen-QwQ等）不是把思维链直接写在content里，而是单独
        // 放在 message.reasoning_content（少数用 message.reasoning）字段里返回——之前完全没读这个字段，
        // 导致这些模型的思维链在这个app里从来没有出现过（不是"渲染坏了"，是压根没被读到）。
        // 这里读出来后同样包成<think>标签拼进content最前面，跟上面Anthropic分支、以及下面流式那边保持一致。
        try {
            const msg = raw && raw.choices && raw.choices[0] && raw.choices[0].message;
            const reasoningText = msg && (msg.reasoning_content || msg.reasoning);
            if (msg && reasoningText) msg.content = `<think>${reasoningText}</think>${msg.content || ''}`;
        } catch (e) { /* 拼接失败就算了，不影响正文本身的返回 */ }
        try {
            const outText = (raw && raw.choices && raw.choices[0] && raw.choices[0].message && raw.choices[0].message.content) || '';
            if (!raw || !raw.error) recordTokenUsage(raw, { inChars: gyContentChars(content), outChars: String(outText).length }, __gyFeature);
        } catch (e) { /* 统计失败不影响返回 */ }
        return raw;
    } catch (e) {
        return { error: { message: enhanceNetworkErrorMessage(e.message) } };
    }
}

// 对外真正调用的入口：在 sendChatRequestRaw 外面包一层"模型不可用自动兜底"。
// 逻辑：请求失败且报错像是"这个模型服务商没开通/不存在"，就自动换成上次成功用过的模型重试一次；
// 重试成功的话，顺手把设置里的模型也同步切过去并保存，这样用户不用自己再去设置里手动改一遍。
// 每次请求成功，也会记录这次用的模型，作为以后的"上次可用模型"。
// 🧹 统一在这里把思维链剥掉。
// 为什么必须放在这一层：全 app 有四十多处 data.choices[0].message.content 的取值点，
// 靠一处一处记得调 processReasoningInText 是不现实的——漏一个，用户就会在营销号爆料里
// 看到一整段 <think>好的，我来梳理一下这个爆料推文的创作要点…</think>（这就是实际发生过的）。
// 放在响应层，所有调用点自动干净，以后新加功能也不用再操心这件事。
// 唯一要保留思维链的是【小说】和【续写】——那两个会把思考过程折叠成一个框给用户看，
// 它们在调用时传 __keepReasoning: true 明确opt out。
function gyStripReasoningFromResponse(data) {
    try {
        if (!data || !Array.isArray(data.choices)) return data;
        for (const ch of data.choices) {
            if (ch && ch.message && typeof ch.message.content === 'string' && ch.message.content) {
                const before = ch.message.content;
                let after = before;
                if (typeof processReasoningInText === 'function') after = processReasoningInText(after);
                // 没有标签的"好的，我来梳理一下……"（推文/评论最常见）：只处理不是 JSON 的输出——
                // JSON 那条路自己会从文本里挑出 JSON，前面的分析天然就被丢掉了。
                if (after && !/[\{\[]\s*"/.test(after)) {
                    const u = gySplitUntaggedThinking(after);
                    if (u && u.rest) after = u.rest;
                }
                // processReasoningInText 只处理"成对标签"和"开头的思维链块"。
                // 推理模型被 max_tokens 截断时会留下一个没有闭合的 <think>，那种情况正文本来就没生成出来，
                // 剥了会变成空字符串——所以只在剥完还有内容时才采用，宁可原样返回让调用方自己判断。
                if (after && after.trim()) ch.message.content = after;
            }
        }
    } catch (e) { console.warn('[思维链剥离] 出错，按原样返回：', e); }
    return data;
}

async function sendChatRequest(api, content, extraBody) {
    // 💭 收纳盒：功能名必须在第一个 await 之前取（原因见 recordTokenUsage 上面的说明）
    const __vaultFeat = reasoningVaultOn ? gyDetectFeature() : null;
    // __keepReasoning 是给小说/续写用的内部标记，不能真的发给 API，取出来就删掉
    let keepReasoning = false;
    if (extraBody && extraBody.__keepReasoning) {
        keepReasoning = true;
        extraBody = Object.assign({}, extraBody);
        delete extraBody.__keepReasoning;
    }
    let data = await sendChatRequestRaw(api, content, extraBody);

    if (data && data.error && isModelUnavailableError(data.error.message)) {
        const fallbackModel = api.isSub ? lastWorkingSubModel : lastWorkingModel;
        if (fallbackModel && fallbackModel !== api.model) {
            console.warn(`[模型兜底] "${api.model}" 当前不可用，自动切回上次可用模型 "${fallbackModel}" 重试一次。原始报错：`, data.error.message);
            const fallbackApi = Object.assign({}, api, { model: fallbackModel });
            const retryData = await sendChatRequestRaw(fallbackApi, content, extraBody);
            if (retryData && !retryData.error) {
                if (api.isSub) {
                    subModel = fallbackModel;
                    if (document.getElementById('subModelSelect')) document.getElementById('subModelSelect').value = fallbackModel;
                } else {
                    myModel = fallbackModel;
                    if (document.getElementById('modelSelect')) document.getElementById('modelSelect').value = fallbackModel;
                }
                if (typeof saveAllData === 'function') saveAllData();
                if (typeof showToast === 'function') showToast('', '⚠️ 模型自动切换', `"${api.model}" 当前不可用，已自动切回"${fallbackModel}"继续使用`, null, null, false);
            }
            if (__vaultFeat) gyVaultCaptureFromData(retryData, __vaultFeat, fallbackApi);
            return retryData;
        }
    }

    if (data && !data.error && api.model) {
        if (api.isSub) {
            if (lastWorkingSubModel !== api.model) { lastWorkingSubModel = api.model; if (typeof saveAllData === 'function') saveAllData(); }
        } else {
            if (lastWorkingModel !== api.model) { lastWorkingModel = api.model; if (typeof saveAllData === 'function') saveAllData(); }
        }
    }

    gyNoticeIfTruncated(data);
    if (__vaultFeat) gyVaultCaptureFromData(data, __vaultFeat, api);
    return keepReasoning ? data : gyStripReasoningFromResponse(data);
}

// 聊天请求的共用封装：遇到"并发数超限/请稍后重试"这类临时性报错时自动重试几次，
// 而不是直接弹一个吓人的错误框——很多API服务商（尤其是中转/代理）会有较低的并发上限，
// 短暂重试一下往往就能成功，用户完全不需要知道发生过这回事。
// images：可选，传入 base64 图片 dataURL 数组（如 "data:image/jpeg;base64,..."）时，
// 会按 OpenAI 兼容的多模态格式把文字和图片一起发给模型，用于"看图/看视频截图"这类场景；
// 不传或传空数组时行为和以前完全一样（纯文字），前提是配置里填的模型本身支持识别图片，
// 不支持的模型通常会直接忽略图片部分或报错，这段代码不负责判断模型是否支持多模态。
async function callChatCompletionAPI(api, promptContent, maxRetries = 2, images = null, opts = null) {
    // opts.keepReasoning：小说/续写专用，保留思维链交给它们自己折叠展示
    const extraBody = (opts && opts.keepReasoning) ? { __keepReasoning: true } : undefined;
    let content = promptContent;
    if (images && images.length > 0) {
        if (isStructuredMessages(promptContent)) {
            content = promptContent.map(m => ({ role: m.role, content: m.content }));
            for (let i = content.length - 1; i >= 0; i--) {
                if (content[i].role === 'user') {
                    const parts = [{ type: "text", text: content[i].content }];
                    images.forEach(imgUrl => { if (imgUrl) parts.push({ type: "image_url", image_url: { url: imgUrl } }); });
                    content[i].content = parts;
                    break;
                }
            }
        } else {
            content = [{ type: "text", text: promptContent }];
            images.forEach(imgUrl => { if (imgUrl) content.push({ type: "image_url", image_url: { url: imgUrl } }); });
        }
    }
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const data = await sendChatRequest(api, content, extraBody);
            if (data.error && attempt < maxRetries) {
                const msg = data.error.message || '';
                if (/concurrency|rate.?limit|too many requests|429/i.test(msg)) {
                    const waitMatch = msg.match(/after (\d+(\.\d+)?)\s*seconds?/i);
                    const waitMs = waitMatch ? Math.max(500, parseFloat(waitMatch[1]) * 1000) : 1500;
                    await new Promise(r => setTimeout(r, waitMs));
                    continue; // 重试
                }
            }
            return data;
        } catch (e) {
            if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1500)); continue; }
            return { error: { message: enhanceNetworkErrorMessage(e.message) } };
        }
    }
}

// ===================== 流式生成（Streaming / 打字机效果）=====================
// 只适合"一次性拿一整段纯文本"的场景（比如互动续写）——流式期间收到的是半成品文字，
// 直接展示没问题；但聊天/群聊要求AI返回一整段JSON（多气泡+延迟那套格式），流式期间的
// 半成品是"半截JSON"，直接显示出来是乱码，所以聊天那边目前继续用上面的非流式 callChatCompletionAPI，
// 不受这个函数影响。
// onDelta(fullTextSoFar, isDone) 会在每收到一点新内容、以及最终结束时被调用，调用方自己决定怎么更新界面。
// 打包成App后（window.plus存在）用的是原生plus.net.XMLHttpRequest通道，这条通道只能在整个响应
// 结束时一次性拿到全部内容、没有"边收边读"的能力，这种情况下自动退化成普通请求，拿到完整文字后
// 一次性调用一次 onDelta(text, true)，界面不会报错，只是没有逐字效果。
// signal：可选，传入 AbortController.signal 时支持中途取消（比如续写"取消"按钮）——原生App通道
// (plus.net.XMLHttpRequest) 不支持真正中断，取消功能在那种环境下不生效，只在普通浏览器/webview里有效。
async function streamCompletionText(api, promptContent, onDelta, images = null, signal = null) {
    if (typeof window.gyTaRewrite === 'function') promptContent = window.gyTaRewrite(promptContent);
    const __gyFeature = gyDetectFeature();   // 同上：必须在任何 await 之前取
    const isNativeApp = typeof window !== 'undefined' && window.plus && window.plus.net && window.plus.net.XMLHttpRequest;
    // 用户在设置里关掉了流式：走跟原生App壳子完全一样的那条路——发普通请求，
    // 拿到完整文字后一次性回调一次。所有调用方（续写工作台、同类软件桥接的 generate）
    // 都不用改，界面上的区别只是"没有逐字效果"，功能一样。
    const streamOff = (typeof enableStreaming !== 'undefined') && !enableStreaming;
    if (isNativeApp || streamOff) {
        const data = await callChatCompletionAPI(api, promptContent, 2, images);
        const text = (!data.error && data.choices?.[0]?.message?.content) || '';
        if (text) onDelta(text, true);
        return data;
    }

    let content = promptContent;
    if (images && images.length > 0) {
        if (isStructuredMessages(promptContent)) {
            content = promptContent.map(m => ({ role: m.role, content: m.content }));
            for (let i = content.length - 1; i >= 0; i--) {
                if (content[i].role === 'user') {
                    const parts = [{ type: "text", text: content[i].content }];
                    images.forEach(imgUrl => { if (imgUrl) parts.push({ type: "image_url", image_url: { url: imgUrl } }); });
                    content[i].content = parts;
                    break;
                }
            }
        } else {
            content = [{ type: "text", text: promptContent }];
            images.forEach(imgUrl => { if (imgUrl) content.push({ type: "image_url", image_url: { url: imgUrl } }); });
        }
    }
    const messages = isStructuredMessages(content) ? content : [{ role: "user", content: content }];

    try {
        const isAnthropic = isAnthropicApiUrl(api.url);
        let res;
        if (isAnthropic) {
            const systemText = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
            let restMsgs = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: convertContentForAnthropic(m.content) }));
            if (restMsgs.length === 0) restMsgs = [{ role: 'user', content: '（请继续。）' }];
            const anthropicBody = Object.assign({ model: api.model, max_tokens: 4096, messages: restMsgs, stream: true }, getSamplerExtraBody(true));
            // 跟非流式那条分支保持一致：system 块够长就打上缓存标记，命中后这一段输入只按 1 折计费
            if (systemText) {
                anthropicBody.system = (systemText.length >= 2000)
                    ? [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }]
                    : systemText;
            }
            res = await fetch(`${api.url}/v1/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': api.key, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify(anthropicBody),
                signal: signal || undefined
            });
        } else {
            res = await fetch(`${api.url}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.key}` },
    // stream_options.include_usage：OpenAI 兼容接口在流式模式下**默认不返回 usage**，
                // 加上这个才会在最后多推一个只带 usage 的分片，Token 统计才能拿到真实用量
                // （不支持这个字段的中转会直接忽略它，不影响正常返回；拿不到就退回按字数估算）。
                body: JSON.stringify(Object.assign({ model: api.model, messages: messages, stream: true, stream_options: { include_usage: true } }, getSamplerExtraBody(false), gyThoughtsExtra(api) || {})),
                signal: signal || undefined
            });
        }

        if (!res.ok && gyThoughtsExtra(api)) gyThoughtsRefused(api);   // 可能是不认 include_thoughts，下面的兜底请求就不带了
        if (!res.ok || !res.body || !res.body.getReader) {
            // 有些中转/代理服务商不支持 stream:true 或者干脆返回非200——自动退回普通(非流式)请求兜底，
            // 避免"这家服务商流式支持不完整"直接导致功能整个用不了
            const data = await callChatCompletionAPI(api, promptContent, 2, images);
            const text = (!data.error && data.choices?.[0]?.message?.content) || '';
            if (text) onDelta(text, true);
            return data;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '', fullText = '', fullReasoning = '', rawAll = '';
        let streamUsage = null;   // 流式的真实用量：OpenAI 在最后一个分片给，Anthropic 分两次给（message_start / message_delta）
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            rawAll += chunk;   // 原样留一份：有些服务商收到 stream:true 也照样返回整段普通JSON，见下面
            buffer += chunk;
            let lines = buffer.split('\n');
            buffer = lines.pop(); // 最后一行可能被截断在中间，留到下一轮再和新数据拼在一起
            for (let line of lines) {
                line = line.trim();
                if (!line.startsWith('data:')) continue;
                const dataStr = line.slice(5).trim();
                if (!dataStr || dataStr === '[DONE]') continue;
                let evt;
                try { evt = JSON.parse(dataStr); } catch (e) { continue; } // 个别心跳/不完整行直接跳过，不影响后面正常的数据
                let deltaText = '';
                // 📊 用量分片：Anthropic 在 message_start 里给输入、message_delta 里给输出；
                // OpenAI 兼容接口是在最后单独推一个 choices 为空、只带 usage 的分片。
                if (evt.usage || (evt.message && evt.message.usage)) {
                    const u = evt.usage || evt.message.usage;
                    streamUsage = Object.assign({}, streamUsage || {}, u);
                }
                if (isAnthropic) {
                    if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') deltaText = evt.delta.text || '';
                    // 扩展思考模式下，流式返回里思考内容是单独一种 delta（thinking_delta），跟正文的 text_delta 分开推送
                    if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'thinking_delta') fullReasoning += evt.delta.thinking || '';
                } else {
                    const d = evt.choices && evt.choices[0] && evt.choices[0].delta;
                    deltaText = (d && d.content) || '';
                    // DeepSeek-R1/Qwen-QwQ等"推理模型"流式返回时，思维链在delta.reasoning_content（少数用delta.reasoning）
                    // 里单独推送，不在delta.content里——之前完全没读这两个字段，思维链就凭空消失了，界面上从来没出现过。
                    if (d && (d.reasoning_content || d.reasoning)) fullReasoning += (d.reasoning_content || d.reasoning);
                }
                if (deltaText) { fullText += deltaText; const __ft = gyNormThought(fullText); onDelta(fullReasoning ? `<think>${fullReasoning}</think>${__ft}` : __ft, false); }
            }
        }
        if (!fullText.trim()) {
            // 一个字都没从 SSE 里解析出来。先别急着重发——很多中转服务商压根不支持 stream，
            // 收到 stream:true 也照样返回一整段普通的 JSON 响应。这种情况下内容其实**已经拿到手了**，
            // 再请求一次纯属白花一次钱、还多等一轮。先试着按普通响应解析，解析得出来就直接用。
            try {
                const asPlain = JSON.parse(rawAll);
                const plainText = asPlain && asPlain.choices && asPlain.choices[0] &&
                    ((asPlain.choices[0].message && asPlain.choices[0].message.content) || asPlain.choices[0].text);
                if (plainText && String(plainText).trim()) {
                    if (reasoningVaultOn) { const __p = gyCollectReasoning(String(plainText)); gyVaultDiag(__gyFeature, String(plainText), __p, api, '流式·整段'); gyVaultCapture(__p, __gyFeature, api.__gyReqKey, api.model, 'stream'); }
                    onDelta(String(plainText), true);
                    return { choices: [{ message: { content: String(plainText) } }] };
                }
                if (asPlain && asPlain.error) return asPlain; // 人家已经明确报错了，重发也是一样的结果
            } catch (e) { /* 不是完整JSON，继续走下面的重发兜底 */ }
            // 真的什么都没拿到（返回格式和预期完全对不上）——兜底重新用非流式请求一次，避免直接"生成了个寂寞"
            const data = await callChatCompletionAPI(api, promptContent, 2, images);
            const text = (!data.error && data.choices?.[0]?.message?.content) || '';
            if (text) onDelta(text, true);
            return data;
        }
        // 思维链拼进正文最前面（跟非流式的两个分支保持同样的<think>包裹格式），交给下游统一的
        // extractLeadingReasoning/processReasoningInText 处理，折叠展示/直接删除都按当前设置来。
        fullText = gyNormThought(fullText);
        const finalText = fullReasoning ? `<think>${fullReasoning}</think>${fullText}` : fullText;
        if (reasoningVaultOn) { const __p = gyCollectReasoning(finalText); gyVaultDiag(__gyFeature, finalText, __p, api, fullReasoning ? '流式·推理通道' : '流式'); gyVaultCapture(__p, __gyFeature, api.__gyReqKey, api.model, 'stream'); }
        recordTokenUsage(streamUsage ? { usage: streamUsage } : null, { inChars: gyContentChars(messages), outChars: finalText.length }, __gyFeature);
        onDelta(finalText, true);
        return { choices: [{ message: { content: finalText } }] };
    } catch (e) {
        if (e.name === 'AbortError') return { aborted: true }; // 用户主动点了"取消"，不是真的报错，调用方要区分对待
        return { error: { message: enhanceNetworkErrorMessage(e.message) } };
    }
}

// 聊天/群聊专用的"半截JSON里捞出已经写完的那几条回复"。
//
// 为什么需要它：聊天让模型返回的是 {"replies":[{"text":"..."},{"text":"..."}]}，
// 流式收到一半是 {"replies":[{"text":"我刚 ——这种半截货直接显示就是乱码。
// 但数组里**已经闭合的那几个对象**是完整可用的，可以立刻发出去，不用等整段写完。
// 这个函数就负责扫出这些完整对象，扫到第一个没写完的就停手（后面的等下一波数据再说）。
//
// 刻意保守：任何一处不确定（花括号没配对、JSON.parse 失败、对象里没有 text 字段）
// 就直接停在那儿，把剩下的交给流式结束后那次完整解析。宁可少发一条晚点补上，
// 也不能猜错了发出去——发出去的消息是收不回来的。
function extractStreamingReplies(text) {
    if (!text) return [];
    // 思维链先剥掉：推理模型会把 <think> 拼在正文最前面，里面可能出现花括号
    let s = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    const keyIdx = s.search(/["']?replies["']?\s*:\s*\[/);
    if (keyIdx < 0) return [];
    let i = s.indexOf('[', keyIdx) + 1;
    const out = [];
    while (i < s.length) {
        while (i < s.length && /[\s,]/.test(s[i])) i++;
        if (s[i] !== '{') break;              // 数组结束（']'）或者还没开始写下一条
        let depth = 0, inStr = false, esc = false, closed = -1;
        for (let j = i; j < s.length; j++) {
            const c = s[j];
            if (inStr) {
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) { closed = j; break; } }
        }
        if (closed < 0) break;                // 这条还没写完，等下一波
        const objText = s.slice(i, closed + 1);
        let obj = null;
        try { obj = JSON.parse(objText); }
        catch (e) {
            // 模型经常在字符串里直接敲回车（裸换行在JSON里是非法的），跟 extractJsonObject 一样修一下
            try { obj = JSON.parse(objText.replace(/([^\\])\n/g, '$1\\n')); } catch (e2) { obj = null; }
        }
        if (!obj || typeof obj.text !== 'string') break;
        out.push(obj);
        i = closed + 1;
    }
    return out;
}

// ===================== 变量系统（兼容同类软件的聊天变量/全局变量）=====================
// chatVariables 按"作用域key"分桶存放，getVarScopeStore 保证桶不存在时自动建一个空对象，
// 这样 {{getvar::x}} 在从没 setvar 过的情况下也不会报错，只是读到空字符串（跟同类软件行为一致）。
function getVarScopeStore(scopeId) {
    const key = scopeId || '__default__';
    if (!chatVariables[key]) chatVariables[key] = {};
    return chatVariables[key];
}
// 🆕 支持 {{getvar::神乐光.好感度}} 这种点号路径。
//
// 起因：同类软件的变量表是**任意嵌套的对象**（角色卡组件普遍这么写，
// insertOrAssignVariables({神乐光:{好感度:5}})），而白露原来的宏只能读一层扁平的 key，
// 同一个变量名一边存着对象、一边被 String() 成 "[object Object]"，两套对不上。
// 现在按 . 逐级往下取，取到最后一层再转字符串——嵌套结构原样保留，宏也能读到里面的值，
// 卡片和 {{getvar}} 从此是同一份数据。
// 没有点号的老写法完全不受影响（split 出来就一段，行为跟以前一模一样）。
function macroVarPathGet(store, name) {
    const parts = String(name == null ? '' : name).split('.');
    let cur = store;
    for (const part of parts) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
        if (!(part in cur)) return undefined;
        cur = cur[part];
    }
    return cur;
}
function macroVarPathSet(store, name, value) {
    const parts = String(name == null ? '' : name).split('.');
    let cur = store;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        // 中途遇到非对象（比如原来存的是个字符串）就换成对象，否则没法往下挂
        if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {};
        cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
}
function macroGetVar(scopeId, name) {
    const store = getVarScopeStore(scopeId);
    const v = macroVarPathGet(store, name);
    if (v === undefined) return '';
    // 取到的还是个对象（比如 {{getvar::神乐光}} 而底下还有好几个字段）——
    // 转成 JSON 而不是 "[object Object]"，至少让人能看出里面有什么
    if (v !== null && typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return ''; }
    }
    return String(v);
}
function macroSetVar(scopeId, name, value) {
    macroVarPathSet(getVarScopeStore(scopeId), name, value);
    return ''; // setvar是纯副作用宏，跟同类软件一样不在正文里输出任何东西
}
// {{addvar::name::增量}} / {{incvar::name}} / {{decvar::name}} 共用的数值累加逻辑：
// 变量当前值/增量只要有一个不是合法数字就当0处理，避免脏数据直接把整条prompt计算搞崩。
function macroAddVar(scopeId, name, delta) {
    const store = getVarScopeStore(scopeId);
    const cur = parseFloat(macroVarPathGet(store, name));
    const d = parseFloat(delta);
    const next = (isNaN(cur) ? 0 : cur) + (isNaN(d) ? 0 : d);
    macroVarPathSet(store, name, String(next));
    return '';
}
function macroGetGlobalVar(name) { return (name in globalVariables) ? String(globalVariables[name]) : ''; }
function macroSetGlobalVar(name, value) { globalVariables[name] = value; return ''; }

// ===================== 宏系统（Macros）=====================
// 支持在人设、世界书、日程等文本里写 {{char}} {{user}} {{time}} {{date}} {{weekday}} {{random:a,b,c}} 这类占位符，
// 生成prompt时会自动替换成实际内容，方便写设定的时候不用每次手打角色名/用户名。
// scopeId：变量宏({{getvar}}/{{setvar}}等)的作用域key，一般传当前聊天会话id（角色id或群聊id"g_xxx"），
// 不传就退化到char.id、再不行退化到一个固定桶——保证怎么调用都有地方读写，不会报错。
function applyMacros(text, char, scopeId) {
    if (!text || typeof text !== 'string') return text;
    const now = new Date();
    const scope = scopeId || (char && char.id) || '__default__';
    // 先过一遍EJS模板引擎（只有文本里真的有 <% 才会实际执行），这样EJS里用getvar/setvar操作的
    // 变量和下面 {{getvar::x}} 这种原生宏用的是同一份存储、同一个作用域，两套语法可以混用不冲突。
    text = renderEjsTemplate(text, char, scope);
    return text
        .replace(/\{\{char\}\}/gi, (char && char.name) || '')
        // ⚠️ 这里以前是 currentUser.name || ''：名字被清空时，{{user}} 会被替换成**空字符串**，
        // 人设里写的"{{user}}走进书店"就变成"走进书店"，主语没了。跟别处统一走 userDisplayName()：
        // 名字空着或者还是默认的"我"时，兜底成中性的"用户"。
        .replace(/\{\{user\}\}/gi, (typeof userDisplayName === 'function') ? userDisplayName() : ((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '用户'))
        .replace(/\{\{time\}\}/gi, now.toLocaleTimeString('zh-CN', { hour12: false }))
        .replace(/\{\{date\}\}/gi, now.toLocaleDateString('zh-CN'))
        .replace(/\{\{weekday\}\}/gi, now.toLocaleDateString('zh-CN', { weekday: 'long' }))
        .replace(/\{\{random[:：]([^}]+)\}\}/gi, (m, list) => {
            const options = list.split(/[,，]/).map(s => s.trim()).filter(Boolean);
            return options.length ? options[Math.floor(Math.random() * options.length)] : '';
        })
        .replace(/\{\{roll[:：]?(\d+)?\}\}/gi, (m, sides) => {
            const n = parseInt(sides) || 100;
            return String(Math.floor(Math.random() * n) + 1);
        })
        // {{//这是注释}}：跟同类软件一样，注释宏整体替换成空字符串，用来在预设/世界书里写不希望进prompt的说明文字
        .replace(/\{\{\/\/[^}]*\}\}/g, '')
        // 副作用类变量宏要放在 getvar 前面处理：同一段prompt里"先setvar、后面别的地方getvar"是常见写法，
        // 这里用两次独立的.replace()整体扫描，等价于"先把所有写操作都应用一遍，再统一读"，结果更符合预期。
        .replace(/\{\{setvar[:：]{2}([^:}]+)[:：]{2}([^}]*)\}\}/gi, (m, name, value) => macroSetVar(scope, name.trim(), value))
        .replace(/\{\{setglobalvar[:：]{2}([^:}]+)[:：]{2}([^}]*)\}\}/gi, (m, name, value) => macroSetGlobalVar(name.trim(), value))
        .replace(/\{\{addvar[:：]{2}([^:}]+)[:：]{2}([^}]*)\}\}/gi, (m, name, value) => macroAddVar(scope, name.trim(), value))
        .replace(/\{\{incvar[:：]{2}([^}]+)\}\}/gi, (m, name) => macroAddVar(scope, name.trim(), 1))
        .replace(/\{\{decvar[:：]{2}([^}]+)\}\}/gi, (m, name) => macroAddVar(scope, name.trim(), -1))
        .replace(/\{\{getvar[:：]{2}([^}]+)\}\}/gi, (m, name) => macroGetVar(scope, name.trim()))
        .replace(/\{\{getglobalvar[:：]{2}([^}]+)\}\}/gi, (m, name) => macroGetGlobalVar(name.trim()));
}

// ===================== EJS模板引擎（兼容同类软件"提示词模板/ST-Prompt-Template"扩展的 <% %> 高级语法）=====================
// 只有文本里真的出现 <% 时才会进入EJS渲染——绝大多数人设/世界书/预设根本不会用这种高级语法，
// 没必要每次生成prompt都额外过一遍模板引擎，这样对没用到这个功能的人完全零开销、零风险。
// 世界书查找辅助：按"条目标题"在这个角色能用到的世界书里查（全局的 + 挂在这个角色身上的），
// 找不到就返回空字符串——跟同类软件的getwi()语义一致（查不到不报错，静默返回空）。
function findWorldbookEntryByTitle(char, nameOrTitle) {
    if (!worldbooks || worldbooks.length === 0 || !nameOrTitle) return null;
    const localIds = new Set((char && char.worldbooks) || []);
    const candidates = worldbooks.filter(w => w.isGlobal || localIds.has(w.id));
    return candidates.find(w => (w.title || '').trim().toLowerCase() === String(nameOrTitle).trim().toLowerCase()) || null;
}
function renderEjsTemplate(text, char, scopeId) {
    if (!text || typeof text !== 'string' || text.indexOf('<%') === -1) return text;
    if (typeof ejs === 'undefined' || !ejs.render) return text; // 模板引擎脚本没加载成功（比如极端情况下vendor文件丢失）时直接降级返回原文，不让整条prompt生成中断
    const scope = scopeId || (char && char.id) || '__default__';
    const store = getVarScopeStore(scope);
    const context = {
        variables: store, // 支持 <%- variables.好感度 %> 这种直接属性访问写法（跟函数式getvar二选一都行）
        getvar: (name, opts) => (name in store) ? store[name] : ((opts && opts.defaults !== undefined) ? opts.defaults : ''),
        setvar: (name, value) => { store[name] = value; return ''; },
        addvar: (name, delta) => {
            const cur = parseFloat(store[name]), d = parseFloat(delta);
            const next = (isNaN(cur) ? 0 : cur) + (isNaN(d) ? 0 : d);
            store[name] = next; return next;
        },
        getGlobalVar: (name, opts) => (name in globalVariables) ? globalVariables[name] : ((opts && opts.defaults !== undefined) ? opts.defaults : ''),
        setGlobalVar: (name, value) => { globalVariables[name] = value; return ''; },
        getchar: (field) => (char && char[field] !== undefined && char[field] !== null) ? char[field] : '',
        getwi: (nameOrTitle) => { const wb = findWorldbookEntryByTitle(char, nameOrTitle); return wb ? (wb.content || '') : ''; },
        char: (char && char.name) || '',
        user: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '',
    };
    try {
        return ejs.render(text, context, { delimiter: '%', strict: false, rmWhitespace: false });
    } catch (e) {
        console.error('EJS模板渲染出错，已跳过、按原文输出：', e);
        return text; // 模板本身写错了（比如漏写括号）也不能让整条prompt生成失败，降级用原文本兜底
    }
}

// ===================== 兼容层：window.TavernHelper（同类软件"助手脚本/JS-Slash-Runner"的部分API兼容） =====================
// ⚠️ 这不是助手脚本的完整移植，只是照着它文档里最常用的那几个函数(变量读写/取聊天记录/取角色信息)
// 做了个"尽量兼容调用方式"的简化实现——参数、返回值细节不一定跟原版100%一致，只是让"照着助手脚本API写的脚本"
// 有更大机会在这里也能跑起来，跑不起来的复杂功能(比如触发slash命令、iframe通信)不在这个兼容范围内。
// 这里只是"定义了这些函数"，本身不会执行任何东西——真正的风险点在"允许脚本执行"这个开关控制的
// executeInjectedScripts()，那边才是把消息/帖子里的<script>标签变成真的会跑起来的代码。
// 因为聊天消息里插入的<script>是被当成真正的全局<script>标签重新创建、追加到页面上执行的（不是沙箱iframe），
// 所以脚本里能直接访问 window.TavernHelper，也能直接调用下面这两个裸函数：
function getvar(name, defaultValue) {
    return macroGetVar(currentChatSessionId, name) || (defaultValue !== undefined ? defaultValue : '');
}
function setvar(name, value) {
    macroSetVar(currentChatSessionId, name, value);
    try { saveAllData(); } catch (e) {}
    return value;
}
// 跟 getvar/setvar 一样，很多角色卡的状态栏模板不走 window.TavernHelper.xxx 这种带命名空间的写法，
// 而是直接裸调用 getChatMessages(...)/setChatMessages(...)——之前只在 window.TavernHelper 对象上挂了
// getChatMessages 一个只读版本，裸的全局函数、以及可写的 setChatMessages 都没有，模板脚本一旦调用
// 就直接报 "xxx is not defined" 崩掉，通常是在某个展开/交互按钮的onclick里，导致点了卡片没反应/展不开。
// message_id 用"在当前聊天数组里的下标"表示，支持负数（-1=最后一条，兼容同类软件的习惯写法）。
function getChatMessages(count) {
    const session = (typeof globalChats !== 'undefined' && globalChats[currentChatSessionId]) || [];
    const slice = typeof count === 'number' ? session.slice(-count) : session.slice();
    const offset = session.length - slice.length;
    return slice.map((m, i) => ({
        role: m.sender === 'me' ? 'user' : (m.sender === 'system' ? 'system' : 'assistant'),
        name: m.sender === 'me' ? ((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '我') : m.sender,
        message: m.text,
        message_id: offset + i,
        data: m.data || {},
        timestamp: m.timestamp
    }));
}
function setChatMessages(messages, options) {
    try {
        const session = (typeof globalChats !== 'undefined') ? globalChats[currentChatSessionId] : null;
        if (!session || !Array.isArray(messages)) return false;
        messages.forEach(item => {
            if (!item || typeof item !== 'object' || typeof item.message_id !== 'number') return;
            let idx = item.message_id;
            if (idx < 0) idx = session.length + idx; // 兼容"-1"表示最后一条这种写法
            const target = session[idx];
            if (!target) return;
            if (typeof item.message === 'string') target.text = item.message;
            if (item.data && typeof item.data === 'object') target.data = Object.assign(target.data || {}, item.data);
        });
        if (typeof saveAllData === 'function') saveAllData();
        if (typeof renderChatMessages === 'function' && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none') renderChatMessages();
        return true;
    } catch (e) { console.error('setChatMessages 出错：', e); return false; }
}
window.TavernHelper = {
    // 变量：跟{{getvar}}/{{setvar}}宏、EJS里的getvar/setvar是同一份存储，作用域是"当前打开的聊天"
    getVariables: () => Promise.resolve({ ...getVarScopeStore(currentChatSessionId) }),
    setVariables: (obj) => {
        const store = getVarScopeStore(currentChatSessionId);
        Object.assign(store, obj || {});
        try { saveAllData(); } catch (e) {}
        return Promise.resolve(true);
    },
    getVariable: (name, defaultValue) => Promise.resolve(getvar(name, defaultValue)),
    setVariable: (name, value) => Promise.resolve(setvar(name, value)),
    // 聊天记录：读/写都复用上面定义好的裸全局函数(getChatMessages/setChatMessages)，避免两份重复实现
    getChatMessages: (count) => Promise.resolve(getChatMessages(count)),
    setChatMessages: (messages, options) => Promise.resolve(setChatMessages(messages, options)),
    // 当前角色信息：只暴露安全的、脚本大概率会用到的几个字段，不是整个角色对象（避免意外改动内部数据结构）
    getCharData: () => {
        const char = (myCharacters || []).find(c => c.id == currentChatSessionId);
        if (!char) return Promise.resolve(null);
        return Promise.resolve({ id: char.id, name: char.name, persona: char.persona, bio: char.bio });
    },
    // 助手脚本真正的slash命令系统(比如/gen /sys这类)在这里没有对应实现，调用了只会警告一声、不会报错崩溃
    triggerSlash: (cmd) => { console.warn('TavernHelper.triggerSlash 在白露里没有对应实现，已忽略：', cmd); return Promise.resolve(''); },
};
// 🛡️ 兜底代理：这个兼容层明确不是完整移植，角色卡模板难免会调用到没实现的函数（比如这次的setChatMessages）。
// 之前的行为是直接报 "xxx is not defined"/"xxx is not a function" 崩掉——如果这行代码恰好在某个展开/交互按钮
// 的onclick里，崩溃点之后的代码（比如真正负责"切换展开状态"的那一行）就永远不会执行，卡片表现就是"点了没反应"。
// 用Proxy包一层：访问任何没在上面明确实现的方法名，都返回一个"打印警告、什么都不做"的兜底函数而不是undefined，
// 这样即使某个具体API没实现，也只是这一步功能不生效，不会连累同一段脚本里后面本来能正常执行的代码。
window.TavernHelper = new Proxy(window.TavernHelper, {
    get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === 'symbol') return undefined;
        return (...args) => {
            console.warn(`TavernHelper.${prop} 在白露里没有对应实现，已忽略这次调用。参数：`, args);
            return Promise.resolve(undefined);
        };
    }
});

// ===================== 正则替换脚本（Regex Scripts）=====================
// 对AI输出/我方输入做文本清洗替换，比如过滤口头禅、统一格式、屏蔽敏感词等
// 兼容两种正则写法：既支持裸的 pattern（比如手动填写的），也支持 /pattern/flags 这种JS字面量格式
// （同类软件导出的正则脚本 findRegex 字段就是这种格式，比如 "/foo(bar)/gi"）
function parseRegexLiteral(str) {
    if (typeof str !== 'string') return { pattern: '', flags: 'g' };
    const m = str.match(/^\/(.*)\/([a-z]*)$/i);
    if (m) return { pattern: m[1], flags: m[2] || 'g' };
    return { pattern: str, flags: 'g' };
}

// 把一批脚本依次应用到文本上——applyRegexScripts / applyDisplayOnlyRegex / applyPromptOnlyRegex
// 三个入口共用这一份核心替换逻辑，区别只在于"用哪个筛选条件挑出这批脚本、在哪个时机调用"。
function applyRegexScriptList(text, list) {
    if (!text || typeof text !== 'string' || !list || list.length === 0) return text;
    let result = text;
    list.forEach(s => {
        if (!s.find) return;
        try {
            if (s.isRegex) {
                const { pattern, flags } = parseRegexLiteral(s.find);
                const re = new RegExp(pattern, s.flags || flags);
                result = result.replace(re, s.replace || '');
            } else {
                result = result.split(s.find).join(s.replace || '');
            }
        } catch (e) { /* 正则写错了就跳过这一条，不影响其它脚本和聊天 */ }
    });
    return result;
}

// 🆕 角色专属正则：很多正则脚本（尤其是角色卡自带的"状态栏"这类）本来就是为某一个角色量身定做的，
// find规则里认的标签名（比如<闻述状态>）、字段含义都是绑死给那一个角色的，压根不是通用格式。
// 之前 regexScripts 是全局唯一一份列表，不管谁生成的内容都会拿全部启用的脚本挨个试一遍——
// 没绑定角色的脚本当然要保持"全局生效"（不然一大堆通用的清理/格式化脚本全得挨个手动给每个角色都配一遍，
// 体验会很差），但如果一条脚本明确写了 charScope（专属角色id列表），就只应该在渲染"这几个角色自己的
// 内容"时才生效——发帖、评论、回信/日记、续写、小说、论坛，只要能确定这段内容是谁说的，就把charId
// 传进来做这层过滤。charId 传空/传了但脚本没设charScope，两种情况都按"全局脚本"处理，兼容老数据。
function regexScriptMatchesChar(s, charId) {
    if (!s.charScope || !Array.isArray(s.charScope) || s.charScope.length === 0) return true; // 没绑定角色＝全局脚本，谁的内容都生效
    if (charId === null || charId === undefined || charId === '') return false;
    // 🐛 修复"角色卡自带的状态栏卡片死活不显示"：这里以前是 charScope.includes(charId)，
    // 而 includes 用的是严格相等——偏偏本app里角色id的类型根本不统一：
    //   · 手动新建角色      id = Date.now()          → 数字
    //   · 导入角色卡        id = Date.now().toString() → 字符串
    //   · 正则编辑器存的 charScope 来自 <select>.value → 永远是字符串
    //   · 小说/续写传进来的 charId 走了 parseInt      → 数字
    // 于是 ["1699..."].includes(1699...) 恒为 false，绑定了角色的状态栏正则永远不触发，
    // 表现就是"状态栏不显示"（实际是被白露内置的通用状态块兜底渲染了，不是角色卡自己那张卡片）。
    // 统一转成字符串再比，历史存档里数字/字符串混着存的情况也能一起兼容，不需要做数据迁移。
    const target = String(charId);
    return s.charScope.some(id => String(id) === target);
}

// 默认的"处理并存档"模式：AI回复生成/用户消息发送的那一刻应用一次，结果直接写进存档，之后显示和发给AI用的都是这个结果。
// 标了 displayOnly 或 promptOnly 的脚本不走这条路（它们只在下面两个专门的时机生效，不会碰存档），
// 这样同一份 regexScripts 列表里可以混合三种完全独立生效时机的脚本，互不干扰。
// 🐛 修复"状态栏HTML卡片贴着```html代码围栏一起写，导致正则收尾标签对不上/围栏文字混进正文"：
// 有些模型喜欢"贴心"地把状态栏这类结构化标签块用```html ... ```包一层（当成一段代码在展示），
// 但这个标签块本来就是要被下面角色自己的正则脚本原样替换成一段真正要渲染成HTML的卡片——被围栏包住之后，
// ①正则的"收尾标签"经常因为围栏另起一行导致对不上，从根源上让整条替换失效，看起来就是"这个角色的HTML
// 死活显示不出来"；②就算侥幸对上了，残留的```html/```这两行围栏文字也会原样贴在卡片旁边一起显示，很难看。
// 这里只解开明确标了html语言的代码围栏（不带语言标记的普通```代码块可能是角色真的想展示一段引用/代码，
// 不去动它，避免误伤），把里面的内容原样掏出来、去掉围栏那两行本身，再交给下面的正则脚本处理。
function unwrapHtmlCodeFence(text) {
    if (!text || typeof text !== 'string') return text;
    // 优先处理围栏完整闭合的情况：中间内容原样掏出来，开头/收尾两行围栏整体去掉。
    let out = text.replace(/```html[ \t]*\r?\n([\s\S]*?)\r?\n?```/gi, '$1');
    // 兜底：字数限制把回复截断，导致模型这次根本没来得及写收尾的```——围栏只剩开头这一行，
    // 同样会干扰下面的正则匹配，这里单独再扫一遍，把落单的开头围栏行去掉，后面内容原样保留。
    out = out.replace(/```html[ \t]*\r?\n/gi, '');
    return out;
}
function applyRegexScripts(text, target, charId) {
    text = unwrapHtmlCodeFence(text);
    if (!regexScripts || regexScripts.length === 0) return text;
    const list = regexScripts.filter(s => s.enabled !== false && !s.displayOnly && !s.promptOnly && (s.target === target || s.target === 'both') && regexScriptMatchesChar(s, charId));
    const result = applyRegexScriptList(text, list);
    // 🩹 修复"文字和状态栏卡片之间空白特别大"：状态栏类正则脚本只会替换掉命中的标签块本身，AI在结构化
    // 状态块前后经常习惯性空出好几个空行做"视觉分隔"，这些空行不在正则匹配范围内，原样留在旁边的纯文字里，
    // 会被容器的 white-space:pre-wrap 原样保留、渲染成一大段可见空白。这里统一把连续3行及以上的换行
    // 收紧成1个空行，不影响正常的单空行分段，只是不让"AI随手多敲了几个回车"被放大成半屏空白。
    return result.replace(/\n{3,}/g, '\n\n');
}

// "仅影响界面显示"模式：不改动存档里的原文，只在渲染到屏幕的那一刻临时处理一下（renderMarkdownLite里调用），
// 适合"清理思维链标签""美化显示格式"这类只是想让界面好看、但又想保留原始AI输出以备万一的场景。
// depth 是"距离最新一条消息多少条"（最新=0），跟同类软件的"深度"概念一致。
// 🐛 修复：角色卡自带的状态栏正则里，minDepth/maxDepth 用得非常多——
//   · 高山仰止那张报纸状态栏是 maxDepth=0：**只在最新一楼**渲染
//   · 蔚野那张仿IG状态栏是 maxDepth=1：只在最近两楼渲染
//   · 沉沦法则的手账本是 maxDepth=3
// 卡片作者这么写是有道理的：这些状态栏一张就是几万到十几万字符的完整HTML，
// 每一楼都渲染一遍，页面会被几十份重复卡片撑爆、翻旧消息卡到动不了，
// 而且"当前状态"本来就只有最新那一楼才是对的，旧楼层显示旧状态纯属干扰。
// 之前这里完全没看 depth，等于把作者的限制全忽略了。现在跟 applyPromptOnlyRegex 用同一套判定。
function applyDisplayOnlyRegex(text, charId, depth) {
    if (!regexScripts || regexScripts.length === 0) return text;
    const hasDepth = typeof depth === 'number' && isFinite(depth);
    const list = regexScripts.filter(s => {
        if (s.enabled === false || s.displayOnly !== true) return false;
        if (!regexScriptMatchesChar(s, charId)) return false;
        // 调用方没告诉我们这段内容在第几楼时，不做深度过滤——宁可多渲染一次，
        // 也不能因为拿不到楼层号就把状态栏整个吞掉（那就又变回"状态栏不显示"了）
        if (hasDepth) {
            if (typeof s.minDepth === 'number' && depth < s.minDepth) return false;
            if (typeof s.maxDepth === 'number' && depth > s.maxDepth) return false;
        }
        return true;
    });
    return applyRegexScriptList(text, list);
}

// "仅影响发给AI的内容"模式：不改动存档、不改动界面显示，只在把历史记录拼进下一次prompt时临时处理一下
// （buildTimeAwareHistoryText/buildTimeAwareHistoryTurns里调用），适合"不想让AI看到某些内容但用户自己还想留着看"的场景。
// depth是"距离最新一条消息多少条"（最新=0，越往前越大，跟同类软件自己的"深度"概念一致）——不传就当0处理
// （老代码没传depth的调用点，行为等价于"永远当作最新消息"，不会因为加了这个参数就破坏原有效果）。
// 有些从同类软件导入的正则脚本专门用 minDepth/maxDepth 限定"只处理N条以前的旧消息"（比如隐藏很久之前的历史，
// 给AI省token，但最近几条不受影响），只有传了正确的depth这类脚本才能按预期只在该生效的范围内生效。
function applyPromptOnlyRegex(text, depth, charId) {
    if (!regexScripts || regexScripts.length === 0) return text;
    const d = typeof depth === 'number' ? depth : 0;
    const list = regexScripts.filter(s => {
        if (s.enabled === false || s.promptOnly !== true) return false;
        if (!regexScriptMatchesChar(s, charId)) return false;
        if (typeof s.minDepth === 'number' && d < s.minDepth) return false;
        if (typeof s.maxDepth === 'number' && d > s.maxDepth) return false;
        return true;
    });
    return applyRegexScriptList(text, list);
}

// 把可能含有 <, >, & 的文本转成安全的显示文本，避免正则脚本里常见的HTML标签（比如美化卡片用的<div>）
// 被当成真的HTML解析，把设置页的结构撑坏
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// escapeHtml 只处理 < > &，够用来做"显示文本"，但拿去填 HTML【属性值】还不够——
// 文本里一个引号就能把属性提前截断（value="老王's笔记" 会在撇号处断掉）。
// 这个版本额外把双引号和单引号也转成实体，专门用于 value="..." / title="..." 这类地方。
function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 最麻烦的一种：要把一段文本塞进 onclick="fn('这里')" 这种【属性里的 JS 字符串字面量】。
// 得转两层，顺序不能反：
//   1) 先按 JS 字符串转义（反斜杠和单引号加反斜杠），否则撇号会提前结束 JS 字符串；
//   2) 再按 HTML 属性转义，否则引号会提前结束 HTML 属性。
// 浏览器解析时正好反着来：先把实体解码回 \'，再交给 JS 解析成一个普通撇号。
function escapeJsArg(str) {
    if (str === null || str === undefined) return '';
    return escapeAttr(String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

// ===================== 聊天/匿名论坛专用：纯文本渲染 =====================
// 需求背景：角色卡自带的HTML状态栏卡片、预设脚本/正则里写死的HTML代码，之前在聊天气泡和匿名论坛里
// 会被当成真的HTML直接渲染出来（有时候正则没处理干净，甚至原始JSON都会糊一脸）。用户明确要求：
// 聊天和匿名论坛这两个地方以后【只显示纯文字】，不管卡/正则里带了什么HTML都不要渲染出来；
// 其它地方（故事续写、推文、日记、信件、评论）不受影响，继续按原来的方式正常渲染HTML。
// 用一个"脱离文档"的<div>承接 innerHTML 再取 textContent 的方式来剥离标签——
// innerHTML 赋值本身就不会执行里面的<script>，这里额外把 <script>/<style> 整块先删掉是双保险，
// 也顺便避免这两种标签内部的原始代码文本被当成"正文"糊出来。
function stripHtmlKeepPlainText(raw) {
    if (raw === null || raw === undefined) return '';
    let t = String(raw);
    if (!t) return '';
    // 先整块删掉 <script>/<style>，避免里面的代码/CSS被当成正文文字
    t = t.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    // 常见的换行/分块标签先转成 \n，避免一整段HTML被拍扁成一行、看不出原来的段落结构
    t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
    try {
        const container = document.createElement('div');
        container.innerHTML = t;
        t = container.textContent || container.innerText || '';
    } catch (e) {
        // 万一解析出错（极端情况），退回最朴素的"硬删标签"方式，保证起码不会整体崩掉
        t = t.replace(/<[^>]+>/g, '');
    }
    // 折叠连续多个空行，保持可读性
    return t.replace(/\n{3,}/g, '\n\n').trim();
}

// 聊天气泡/匿名论坛帖子最终用的渲染函数：先剥离所有HTML标签只留纯文字，再转义成安全文本，
// 最后把换行还原成 <br> 让多段文字看着不会挤成一坨——这一步不是"渲染HTML"，只是让纯文本能正常分行显示。
function renderPlainChatText(raw) {
    const plain = stripHtmlKeepPlainText(unwrapAiEnvelopeText(raw));
    return escapeHtml(plain).replace(/\n/g, '<br>');
}

// 🐛 "一整坨 ```json 原样发到聊天里"的统一兜底。
//
// 正常情况下模型返回的 {"replies":[...],"stateUpdate":"..."} 会被 extractJsonObject 解析、拆成
// 一条条气泡。但只要有一步没对上——模型多写了闭合花括号、字段名写错、思维链混在前面、
// 或者走的是某条没做解析的旧代码路径——整段原文就会被当成一条消息文本存进 globalChats，
// 之后每次渲染都原样显示，用户看到的就是截图里那坨 JSON。
//
// 这个函数做两件事，任何一层没命中都原样返回，不会误伤正常聊天内容：
//   1) 剥掉思维链标签和 ``` 代码围栏；
//   2) 如果剩下的东西整体就是一个带 replies/stateUpdate 的 JSON 信封，把里面的话拿出来。
//
// 关键是它**同时用在两个地方**：
//   · 写入侧（各处解析失败的兜底分支）——新消息不会再存成一坨 JSON；
//   · 渲染侧（renderPlainChatText）——**已经存坏在历史记录里的旧消息，这次打开就能正常显示了**，
//     不用用户自己去一条条删。
function unwrapAiEnvelopeText(raw) {
    if (raw === null || raw === undefined) return '';
    let t = String(raw);
    if (!t) return '';
    // 快速排除：正常聊天内容里既没有代码围栏也不会以 { 开头，直接原样返回，零开销
    if (t.indexOf('```') === -1 && t.trim()[0] !== '{' && t.indexOf('<think') === -1 && t.indexOf('<thinking') === -1) return t;

    let s = t;
    try { s = processReasoningInText(s); } catch (e) {}
    // 剥掉包裹整段内容的代码围栏（```json ... ``` / ``` ... ```），只在首尾成对时才剥
    const fence = s.trim().match(/^```[a-zA-Z0-9_-]*\s*\n?([\s\S]*?)\n?```$/);
    if (fence) s = fence[1];
    else s = s.trim().replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?```\s*$/, '');
    s = s.trim();

    if (s[0] !== '{') return s === t.trim() ? t : (s || t);

    let parsed = null;
    try { parsed = extractJsonObject(s); } catch (e) {}
    if (!parsed || typeof parsed !== 'object') return s || t;

    // 认得出来的信封才拆，别的 JSON（角色卡自己要展示的数据之类）原样留着
    const hasReplies = Array.isArray(parsed.replies);
    if (!hasReplies && !parsed.stateUpdate) return s || t;

    let out = '';
    if (hasReplies) {
        out = parsed.replies
            .map(r => (r && typeof r === 'object') ? String(r.text || '') : String(r || ''))
            .filter(x => x.trim())
            .join('\n');
    }
    if (!out.trim() && parsed.stateUpdate) out = '(' + String(parsed.stateUpdate) + ')';
    return out.trim() || s || t;
}

// ===================== 思维链识别与折叠展示 =====================
// 同类软件自己就是这么设计的：不同模型/API吐思维链用的包裹标签五花八门(DeepSeek是<think>，Gemma用别的标记...)，
// 同类软件没有写死几个标签名，而是做成"前缀+后缀"配置列表，命中哪条就按哪条解析——这里照搬同样的思路，
// 内置几条从真实数据里见过的常见格式，用户也可以自己在设置里加新的前缀/后缀组合来匹配自己预设的写法。
let reasoningFormats = [
    { id: 'rf_think', name: 'think', prefix: '<think>', suffix: '</think>', enabled: true },
    { id: 'rf_thinking', name: 'thinking', prefix: '<thinking>', suffix: '</thinking>', enabled: true },
    { id: 'rf_details', name: 'details/summary', prefix: '<details>', suffix: '</details>', enabled: true },
    { id: 'rf_customthink', name: 'custom_think', prefix: '<custom_think>', suffix: '</custom_think>', enabled: true },
    { id: 'rf_secret', name: 'SECRET/thought', prefix: '<SECRET>', suffix: '</SECRET>', enabled: true },
];
// 思维链在【小说】和【续写】里怎么处理（其它场景一律剥掉，不受这个设置影响，见 processReasoningInText）：
// 'collapse' 折叠展示（默认，做成可点开的"💭思考过程"框）/ 'strip' 直接删除 / 'off' 不处理，原样显示包括标签
let reasoningDisplayMode = 'collapse';

// 只在"文本最开头"尝试匹配前缀，避免正文中间偶然出现同名标签被误判成思维链、被错误剥掉。
// 命中就返回 {reasoning: 思维链正文, rest: 剩下的正文, formatName}；一条都没命中（包括"有前缀但找不到对应后缀"，
// 说明思维链没写完或者这不是这种格式）就返回 null，调用方原样保留文本，不强行猜测容易删错东西。
function extractLeadingReasoning(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.replace(/^\s+/, '');
    for (const fmt of reasoningFormats) {
        if (fmt.enabled === false || !fmt.prefix || !fmt.suffix) continue;
        if (!trimmed.startsWith(fmt.prefix)) continue;
        const suffixIdx = trimmed.indexOf(fmt.suffix, fmt.prefix.length);
        if (suffixIdx === -1) continue;
        const reasoning = trimmed.slice(fmt.prefix.length, suffixIdx);
        const rest = trimmed.slice(suffixIdx + fmt.suffix.length).replace(/^\s+/, '');
        return { reasoning, rest, formatName: fmt.name };
    }
    return null;
}

// 循环剥离文本开头所有能识别的思维链前缀（有的模型输出会把思维标签重复/嵌套，比如结尾多打了一层闭合标签），
// 直到剥不出新的一层为止（guard只是防止极端情况死循环，5轮足够覆盖常见情况）。
// 🧹 清理：之前 processReasoningInText / extractReasoningForNovel 两个函数各自拷贝了一份几乎一模一样的
// 剥离循环，容易改了一处忘了改另一处、行为悄悄跑偏——现在合并成这一个共享实现，下面两个函数都只是在这个
// 基础上包一层"要不要生成展示用的折叠框HTML"的逻辑。
function stripLeadingReasoningBlocks(text) {
    let collapsedBlocks = [];
    let rest = text;
    let guard = 0;
    while (guard < 5) {
        const found = extractLeadingReasoning(rest);
        if (found) { collapsedBlocks.push(found); rest = found.rest; guard++; continue; }
        // 清完一层完整的前缀+后缀之后，开头有时会剩一个孤立的多余闭合标签（真实数据里见过
        // </thinking>\n</thinking>这种重复关闭的情况），这里按配置的后缀列表顺手清掉，避免留下裸露的残余标签。
        let strayCleaned = false;
        for (const fmt of reasoningFormats) {
            if (fmt.enabled === false || !fmt.suffix) continue;
            const trimmed = rest.replace(/^\s+/, '');
            if (trimmed.startsWith(fmt.suffix)) { rest = trimmed.slice(fmt.suffix.length).replace(/^\s+/, ''); strayCleaned = true; break; }
        }
        if (!strayCleaned) break;
        guard++;
    }
    return { collapsedBlocks, rest };
}
// collapse模式：用原生<details>标签拼一段默认收起的折叠框——不用额外写JS，浏览器原生支持点击展开/收起。
// 思维链内容整个转义过，只当纯文本显示，不会被当成HTML/脚本解析。
function buildReasoningCollapseHtml(collapsedBlocks) {
    const combinedReasoning = collapsedBlocks.map(b => b.reasoning).join('\n\n---\n\n');
    return `<details class="msg-reasoning-block"><summary>💭 思考过程（点击展开）</summary><div class="msg-reasoning-content">${escapeHtml(combinedReasoning)}</div></details>`;
}

// 聊天、评论、推文、论坛、导入聊天记录……这些场景用这个：一律把思维链剥干净，不展示。
//
// 思维链的"可展开查看"只保留在【小说】和【续写工作台】两个地方（跟同类软件的做法一致）——
// 那两处走 extractReasoningForNovel，把折叠框单独存一个字段、渲染时拼在正文外面。
//
// 为什么别处不能折叠展示：collapse 模式是把 <details> 那段 HTML 直接拼到正文最前面再存档的，
// 而角色卡自带的状态栏卡片全靠正则脚本转换，很多正则是从文本开头 ^ 锚定匹配的——
// 一旦思维链 HTML 堵在最前面，锚点永远匹配不上，状态栏就再也出不来。
// 与其让一个全局开关同时影响两边（想在小说里看思维链就得打开 collapse，一打开聊天的状态栏就废），
// 不如按场景分开：别处永远剥掉，只有小说/续写保留。
// 🐛 "思维链偶尔会跑出来"的补漏。
// stripLeadingReasoningBlocks 只认**文本最开头**的思维链前缀。但模型经常不老实：
// 先客套一句"好的，我来想想。"再写 <think>…</think>，或者把思考塞在正文中间。
// 这种情况开头匹配不上，整段思考就原样留在正文里了——这就是"偶尔"跑出来的那个偶尔。
//
// 这里补一道：把正文里**任意位置**的**成对**思维链标签整块删掉。
// 只处理成对的（有头有尾，边界明确，不会误伤），不处理落单的标签。
// <details> 这条格式故意不参与：角色卡自己经常用 <details> 做折叠面板，
// 全文乱删会把卡片内容一起删掉，它继续只在开头匹配（老行为不变）。
const REASONING_ANYWHERE_SAFE = ['think', 'thinking', 'custom_think', 'SECRET/thought'];
function escapeRegExpLiteral(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripPairedReasoningAnywhere(text) {
    let t = text;
    for (const fmt of reasoningFormats) {
        if (fmt.enabled === false || !fmt.prefix || !fmt.suffix) continue;
        if (!REASONING_ANYWHERE_SAFE.includes(fmt.name)) continue;
        try {
            const re = new RegExp(escapeRegExpLiteral(fmt.prefix) + '[\\s\\S]*?' + escapeRegExpLiteral(fmt.suffix), 'gi');
            t = t.replace(re, '');
        } catch (e) { /* 用户自定义的前后缀拼不出合法正则就跳过这条 */ }
    }
    return t;
}
function processReasoningInText(text) {
    if (!text || typeof text !== 'string') return text;
    let t = stripPairedReasoningAnywhere(text);
    const { collapsedBlocks, rest } = stripLeadingReasoningBlocks(t);
    if (collapsedBlocks.length > 0) t = rest;
    // 全被当成思维链删光了说明判断有误（正文不该是空的），宁可原样显示也不要给用户一条空消息
    return t.trim() ? t : text;
}

// 🔢 用户填的数字原样用：只挡"根本不是数字"（空、乱码）这一种情况，**不设任何上下限**。
//    以前各处 Math.max(5, …) / Math.min(1440, …) 这类夹逼到处都是，用户填了 1 分钟被悄悄改成 5 分钟、
//    填 0 被 `|| 默认值` 吞掉——现在一律尊重用户填的数。
function gyNum(v, dft) { const n = parseFloat(v); return isFinite(n) ? n : dft; }

// ===================== 🧹 上下文预算：数据越多越要"挑着给" =====================
// 为什么数据一多，模型就开始认错人、忘设定、格式出错：
//   不是模型"变笨"了，是每次请求塞进去的东西太多——几十条日程归档、信、日记、小剧场、
//   各个小功能的注入……真正要紧的人设、关系、预设、格式要求被挤在中间，注意力被摊薄。
// 做法：buildBasePrompt 把每一段交过来时带一个"重要程度"（js/06）：
//   keep  ＝ 骨架（人设、世界书、预设、关系、用户是谁、格式、身份提醒），永远原样保留；
//   数字  ＝ 参考资料，越小越要紧（2 聊天总结 … 8 一起看过的电影）。
// 参考资料加起来超过预算时：① 每段先截到 GY_REF_CAP 字以内；② 还超，就从最不要紧的开始整段拿掉。
// 预算在 设置 → 生成参数 →「🧹 参考资料上限」里改，填 0 ＝ 不限（回到以前的行为）。
const GY_PB_KEY = 'gy_prompt_budget';
