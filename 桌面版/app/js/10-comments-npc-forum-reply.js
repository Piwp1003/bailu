// ==========================================
// 修复：推文下方的评论功能 (postUserComment)
// 【重要修复】：原来这里只会去 globalPosts 里找帖子，导致在"营销号"(tabloid)详情页的
// 评论框发言时，因为营销号帖子存在 tabloidPosts 数组里而不是 globalPosts，找不到帖子后
// 直接 return，评论发不出去、角色/NPC自然也不会有任何回应。现在改成和 renderSinglePostDetail /
// submitInlineReply 一致的写法：根据 postId 前缀（tb_）判断是不是营销号帖子，分别处理。
// ==========================================
async function postUserComment(postId) {
    const input = document.getElementById('myCommentInput'); if (!input) return;
    const text = input.value ? input.value.trim() : "";
    // 🔁 输入框空着点「回复」＝ 让角色们针对你上一条评论重新回应一次。
    // 场景跟聊天页那个一样：角色回的这条不满意，删掉之后就没入口再叫它了 ——
    // 原来这里只会弹一句"评论内容不能为空"，等于死路。
    if (!text && !pendingReplyAttachment) return retriggerCharComments(postId);

    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId);
    if (!post) return;

    const newReply = isTabloid ? {
        id: 'r_' + Date.now(),
        parentId: null,
        charId: 'me',
        name: currentUser.name,
        text: text,
        timestamp: Date.now(),
        likes: 0,
        liked: false,
        likedBy: [],
        mediaUrl: pendingReplyAttachment
    } : {
        id: 'r_' + Date.now(),
        parentId: null,
        char: { ...currentUser },
        text: text,
        timestamp: Date.now(),
        likes: 0,
        liked: false,
        likedBy: [], // 记录点赞记录
        mediaUrl: pendingReplyAttachment
    };

    if (!post.replies) post.replies = []; post.replies.push(newReply); post.stats.comments = (parseInt(post.stats.comments) || 0) + 1;
    input.value = ''; clearAttachment('reply'); if(typeof renderSinglePostDetail === 'function') renderSinglePostDetail(postId); saveAllData();

    if (!myApiKey) return;

    // 营销号帖子：没有"博主本人"这个概念（博主是营销号账号），走营销号自己的AI互动逻辑 + 随机路人NPC评论
    if (isTabloid) {
        rollTabloidAIParticipation(postId, text, currentUser.name);
        spawnNpcComments(postId, 'tabloid', { triggerName: currentUser.name, triggerText: text, triggerId: newReply.id });
        return;
    }

    // 真正让角色们回应这条评论的活儿，抽到 runCharRepliesToComment 里了 —— 因为它
    // 需要被**两个**地方调用：一个是这里（用户刚发了评论），另一个是"删掉角色评论之后
    // 想让它重新生成"（见下面的 retriggerCharComments）。以前只有这一个入口，
    // 所以评论一删就再也叫不回来了。
    await runCharRepliesToComment(post, postId, newReply, text);
}

// 让角色们针对用户的评论各自决定回应/点赞/转私聊。
// postUserComment 和 retriggerCharComments 共用这一份，避免两边逻辑慢慢长歪。
//
// opts.userComments：只有「重新生成」那条路会传。传了就进**挑一条回**模式：
//   · 给模型一份编号列表（用户在这条帖子下说过的话），让它自己挑一条回应
//   · 允许输出 NO 直接不回 —— 这样每次参与的角色数、回的是哪条都不固定，
//     而不是每个角色齐刷刷冲着最后一条来（那样"重新生成"每次结果都一个样）
//   · 挑哪条、回不回，都交给人设自己判断，不是代码随机指派
// 不传的话是老行为：用户刚发了评论，大家就针对那条回，一个都不许装看不见。
async function runCharRepliesToComment(post, postId, newReply, text, opts) {
    const o = opts || {};
    const pickList = Array.isArray(o.userComments) && o.userComments.length > 0 ? o.userComments : null;
    let emoPrompt = getEmoticonPrompt();
    // 🆕 识图：这条推文本身带的图（比如用户发的是一张照片），以及用户这条评论顺手附的图，
    // 一起交给角色，让它能看懂图里是什么再回应，而不是只看文字瞎猜。
    let commentImages = [post.mediaUrl, newReply.mediaUrl].filter(Boolean);

    // 挑一条回的模式下，角色的顺序也打乱 —— 不然每次都是同一个人先开口，
    // 后面的角色永远只能接在它后面说，看着就很假。
    let charQueue = myCharacters.slice();
    if (pickList) {
        for (let i = charQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [charQueue[i], charQueue[j]] = [charQueue[j], charQueue[i]];
        }
    }

    // 编号列表：给模型看的"用户在这条帖子下说过哪些话"
    const pickListText = pickList
        ? `\n【${userDisplayName()}在这条推文下说过的话（编号供你挑选）】：\n`
          + pickList.map((c, i) => `${i + 1}. ${String(c.text || '').slice(0, 120)}`).join('\n') + '\n'
        : '';

    for (let char of charQueue) {
        if (char.replyToUser === false) continue; // 设置里关闭了"回复用户"的角色，直接跳过不参与互动
        let isPostAuthor = (char.id === post.char.id);
        // 修复：之前这里完全没告诉AI这条推文到底是谁发的，角色容易默认脑补成"用户自己发的"，
        // 结果在给别的角色的推文回复用户评论时，把不属于自己的推文错当成自己发的来回应。
        // 现在明确写清楚博主是谁（是你自己/用户本人/还是另一个角色），避免这种归属错乱。
        let postAuthorLabel = isPostAuthor ? '你自己' : (post.char.id === 'me' ? `用户（${userDisplayName()}）本人` : `角色"${post.char.name}"（不是你，也不是用户）`);

        let actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要在回复中包含任何动作、神态或心理描写（如括号内的动作），只能输出你直接说出的话！";
        let contextInfo = pickList
            ? `\n【原推文内容】(发布者是：${postAuthorLabel})："${post.text}"\n${pickListText}`
            : `\n【原推文内容】(发布者是：${postAuthorLabel})："${post.text}"\n【用户的评论】："${text}"\n`;
        // 设置里打开"转私聊"选项后，给角色多一个选择：不想在评论区公开回应，可以转而私聊找用户聊
        let moveToChatOption = (typeof enableCharMoveToChat !== 'undefined' && enableCharMoveToChat)
            ? `\n【额外选项】：如果你觉得这件事更适合私下聊、不想在评论区公开回应，可以输出"[MOVETOCHAT]"，紧跟着写你想在私聊里对用户说的话（比如：[MOVETOCHAT]哎这个我们私下聊聊吧...），这样这段话会私聊发给用户而不是公开评论。这只是众多选项之一，不是必须用。\n`
            : '';
        // 修复：只在prompt中间提一次"发布者是谁"容易被中间夹的世界书/关系网/预设内容冲淡、模型读到末尾时已经忘了。
        // 这里在prompt最后再明确重申一遍归属（离生成越近的内容模型越重视），并顺带强调必须结合人设/预设/世界书/
        // 记忆/关系网来组织回复，不要只看到"评论"两个字就机械回应、把这些设定丢在一边。
        let ownerReinforcement = `\n\n【重要，请务必留意】：这条推文的发布者是${postAuthorLabel}。${isPostAuthor ? '这确实是你自己发的推文。' : '这不是你发的推文，' + (post.char.id === 'me' ? '是用户本人发的，不要误以为是你自己发的。' : '是另一个角色发的，既不是你也不是用户，不要把它当成你自己发的、也不要当成用户发的。')}请结合你的人设、当前生效的预设规则、世界书设定、你的相关记忆、以及你和上面提到的人物之间的关系网来组织这条回复，不要遗忘这些设定，也不要人设崩坏(OOC)。\n\n【回复的写法·硬性要求】：直接说你想说的话，**不要复述、不要转引、不要总结推文原文或别人的评论**——那些内容用户已经看得见了，再抄一遍只会让评论又臭又长。也不要写"关于你说的XXX……"这种把原话再念一遍的开场。就像真人刷到一条推文随手回一句那样，上来直接是你的反应。`;

        // 🆕 三角关系提醒：只有"这条推文不是你发的，也不是用户发的"（即作者是另一个角色）这种情况才需要——
        // 这时候你（当前回复的角色）未必认识发帖的那个角色，但你跟用户之间是有关系的，用户在别人帖子下的评论
        // 语气亲不亲密、熟不熟络，都是你能观察到的信息。不强制要求"吃醋"这一种反应，具体反应完全由人设/关系
        // 性质自己判断（可能毫不在意、可能单纯好奇、可能阴阳怪气、可能就是很正常地插句话），避免模型只会
        // 机械地"围绕推文内容回应"而完全忽略这层关系张力。
        let crossRelationshipHint = (!isPostAuthor && post.char.id !== 'me')
            ? `\n【额外提醒，仅供参考】：这条推文是另一个角色发的，你不一定认识对方（除非你的关系网/世界书里另有说明）。但你和评论区里的用户是有关系的——留意一下用户这条评论的语气/称呼/内容，如果透出跟这位陌生博主不一般的亲近感，这可能会牵动到你和用户之间关系的某种情绪（不一定是吃醋，也可能是好奇、警惕、单纯八卦一下、或者完全不在意——具体是哪种、要不要表现出来，由你的人设和你们的关系阶段决定，不要机械套用"吃醋"这一种模板）。如果你觉得这类心思不适合摆在公开评论区说，可以用上面提到的私聊选项。这只是提供一种可能性，不是必须往这个方向写，更多时候正常回应评论内容即可。\n`
            : '';

        // 挑一条回的模式：让角色自己选回哪条、也允许完全不回。
        // 这正是"条数不固定、谁开口不固定"的来源 —— 由人设决定，不是代码随机指派。
        const pickRule = pickList
            ? `\n【这一轮怎么做】：上面列出了${userDisplayName()}在这条推文下说过的每一句话。请你**按自己的人设**判断：
- 有想接的话：在回复的最前面写上 [回复N]（N 是上面的编号，只能选一条），紧跟着写你要说的内容。挑哪条完全看你在意什么，不必挑最后一条。
- 只想随手点个赞：写 [回复N] 之后紧跟着 LIKE，比如"[回复2]LIKE"。
- 确实没什么想说的：直接输出 NO，这一轮就不出声（这是允许的，不用勉强找话说）。
不要几个人都盯着同一句话说车轱辘话，你只管按自己的性子来。\n`
            : '';

        let prompt = "";
        if (pickList) {
            // 「重新生成」模式：不再强制每个人都出声，回哪条也由角色自己挑
            const ownerLine = isPostAuthor
                ? '这条推文是你自己发的。'
                : `这条推文不是你发的，发布者是${postAuthorLabel}，你只是在评论区里看到了这些话。`;
            prompt = `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${emoPrompt}${ownerLine}${moveToChatOption}${pickRule}`
                + `要回的话，紧扣你挑中的那句直接输出话术（不超过${postWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}），若用表情附[EMO:ID]。`
                + `${actionStrictRule}${ownerReinforcement}${crossRelationshipHint}${getFinalAnswerMarkerPromptNote()}`;
        } else if (isPostAuthor) {
            prompt = `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${emoPrompt}${moveToChatOption}用户刚刚在你的推文下评论了。你必须互动！如果只需点赞请输出"LIKE"；若文字回复，请紧扣原推文和评论内容直接输出话术（不超过${postWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}）。绝对不能输出"NO"。若用表情附[EMO:ID]。${actionStrictRule}${ownerReinforcement}${getFinalAnswerMarkerPromptNote()}`;
        } else {
            // 修复："所有角色都要围着用户转"：即使不是这条推文的博主，只要用户发了评论，也不允许完全无视，
            // 高冷人设最多是"倾向于只点赞"，而不是可以彻底装看不见。
            let ownerReminder = `这条推文不是你发的，发布者是${postAuthorLabel}，你只是在旁边看到了用户的评论。`;
            prompt = isCoolTowardUser(char) ? `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${ownerReminder}${moveToChatOption}用户刚刚评论了。你性格高冷，通常只点赞，但也必须对用户的评论有所反应，不能完全无视。请输出"LIKE"。${actionStrictRule}${ownerReinforcement}${crossRelationshipHint}${getFinalAnswerMarkerPromptNote()}` : `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${emoPrompt}${ownerReminder}${moveToChatOption}针对上述推文和用户的评论，你必须插话反应一下，不能完全无视。如果想认真回复，请紧扣推文内容直接输出话术（不超过${postWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}），若用表情附[EMO:ID]；如果只是随手点赞，输出"LIKE"。只能二选一，不允许输出"NO"。${actionStrictRule}${ownerReinforcement}${crossRelationshipHint}${getFinalAnswerMarkerPromptNote()}`;
        }
        try {
            let data = await callChatCompletionAPI({ url: myApiUrl, key: myApiKey, model: myModel }, prompt, 2, commentImages.length > 0 ? commentImages : null);
            if (data.error) { console.error(`角色"${char.name}"回复评论失败：`, data.error); continue; }
            // ⚠️ 修复"评论带思考过程"：这里之前直接把AI原始输出.trim()当成评论正文，没有像其它评论生成
            // 场景（NPC路人评论/论坛回帖等）那样过一遍"正式输出标记"截取+"超长自动扔掉前面思考草稿"这两层
            // 兜底，导致部分模型（尤其是被要求"想清楚再回答"、但没有走标准reasoning_content通道的模型）
            // 会把整段分析过程也原样发出来，混进最终评论里。现在统一走跟其它评论场景一致的清洗流程。
            let repText = extractAfterFinalMarker(data.choices?.[0]?.message?.content || '').trim();
            repText = stripUndelimitedReasoningIfOverLength(repText, postWordLimit);

            // "转私聊"选项：角色选了不在评论区回应，改成私聊发消息，这条评论到此为止不再继续走公开评论/点赞逻辑
            let moveToChatMatch = repText.match(/^\[MOVETOCHAT\]\s*/i);
            if (moveToChatMatch) {
                let chatMsg = repText.replace(moveToChatMatch[0], '').trim();
                if (chatMsg) {
                    chatMsg = chatMsg.replace(/^["“]|["”]$/g, '').trim();
                    deliverCharMoveToChatMessage(char, chatMsg, { name: (post.char && post.char.name) || '未知', text: post.text });
                }
                continue;
            }

            // 🆕 挑一条回：解析开头的 [回复N]，把这条回复挂到用户对应的那条评论下面。
            // 没写编号的话就退回默认那条（newReply），不至于挂丢。
            let replyTarget = newReply;
            if (pickList) {
                const mark = repText.match(/^\s*[\[【]\s*回复\s*(\d+)\s*[\]】]\s*/);
                if (mark) {
                    repText = repText.slice(mark[0].length).trim();
                    const picked = pickList[parseInt(mark[1], 10) - 1];
                    if (picked) replyTarget = picked;
                }
            }

            let repMediaUrl = null; let emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
            if (emoMatch) { let emo = globalEmoticons.find(e => e.id === emoMatch[1]); if (emo) repMediaUrl = emo.url; repText = repText.replace(emoMatch[0], '').trim(); }
            repText = stripLeftoverMarkers(repText); // 标记都解析完了，漏网的不许显示给用户（见 js/01）

            // ⚠️ 修复"角色卡自带的状态栏模板在评论区显示成一整段带尖括号标签的裸文本"：这里之前特意跳过了
            // ai_output正则烘焙，理由是"状态栏卡片只在小说/日记/信件里显示"——但这跟"帖子/评论/小报继续
            // 正常渲染HTML"的既定设计（以及专门给帖子/评论/小报准备的"脚本执行"开关）矛盾：如果这一步不烘焙，
            // 角色卡里靠正则脚本把模板转成卡片HTML的这一步根本没机会跑，模板占位符文本就会原样露出来，
            // 而不是变成设计好的卡片样式。跟推文/NPC回应NPC评论等其它评论场景保持一致，统一都跑一遍正则烘焙。
            if (repText.toUpperCase() !== 'LIKE') repText = applyRegexScripts(repText, 'ai_output', char.id);

            // 顺手把AI偶尔自己加的首尾引号去掉（正则烘焙之后再做，避免烘焙脚本本身依赖首尾引号做匹配）。
            if (repText.toUpperCase() !== 'LIKE') repText = repText.replace(/^["“]|["”]$/g, '').trim();

            // 老行为：博主本人不许装看不见，输出 NO 也强行转成点赞。
            // 但「重新生成」模式下必须允许 NO —— 不允许的话每个角色都一定会出声，
            // 参与人数又变回固定的了，跟"条数不固定"的诉求正好相反。
            if (!pickList && isPostAuthor && repText.toUpperCase().startsWith("NO") && repText.length < 5) repText = "LIKE";
            if (pickList && repText.toUpperCase().startsWith('NO') && repText.length < 5) continue;   // 这一轮它选择不出声

            // 宽松识别"这条其实只是想点个赞"（见 js/01 looksLikeALikeOnly 的说明）
            if ((typeof looksLikeALikeOnly === 'function') ? looksLikeALikeOnly(repText) : (repText.toUpperCase() === 'LIKE')) {
                replyTarget.likes = (replyTarget.likes || 0) + 1;
                if (!replyTarget.likedBy) replyTarget.likedBy = [];
                if (!replyTarget.likedBy.includes(char.id)) replyTarget.likedBy.push(char.id); // 记录AI点赞
                if(typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 赞了您的评论 ❤️`, postId, null, char, "");
            }
            else if (!repText.toUpperCase().startsWith("NO") && repText !== "") {
                post.replies.push({
                    id: 'r_' + Date.now() + Math.floor(Math.random()*100),
                    parentId: replyTarget.id,
                    char: char,
                    text: repText,
                    timestamp: Date.now(),
                    likes: 0,
                    liked: false,
                    likedBy: [],
                    replyTo: currentUser.name,
                    mediaUrl: repMediaUrl
                });
                post.stats.comments++;
                if(typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 回复了您的评论`, postId, null, char, repText);
            }
            if(typeof renderSinglePostDetail === 'function') renderSinglePostDetail(postId); saveAllData();
        } catch(e) { console.error(`角色"${char.name}"回复评论请求异常：`, e); }
    }
    if (Math.random() < npcReplyProb) spawnNpcComments(postId, false, { triggerName: currentUser.name, triggerText: text, triggerId: newReply.id });
}

// 🔁 删掉角色的评论之后，让它们重新回应一次。
// 入口：帖子详情页里评论框空着直接点「回复」。
//
// 为什么需要它：角色评论**只有一个触发口** —— 用户发评论的那一刻。
// 所以一旦把角色回的那条删了，就再也没有任何办法让它重新生成，
// 除非把自己那条评论也删了、原话再打一遍，很别扭。
//
// 做法是拿你在这条帖子下**最后一条自己的评论**当触发点，重新跑一遍生成，
// 不会新增一条你的评论。
async function retriggerCharComments(postId) {
    const isTabloid = String(postId).startsWith('tb_');
    const post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId);
    if (!post) return;
    if (!myApiKey) return alert('请先配置 API Key！');

    const replies = post.replies || [];
    // 收集**所有**我发过的评论，不只是最后一条 —— 角色可以从里面自己挑一条回。
    // 营销号帖子的结构是 charId:'me'，普通推文是 char.id === 'me'。
    // 只取最近 8 条：再多提示词就开始膨胀了，而且更早的评论也不太可能有人还想接。
    const MAX_PICKABLE = 8;
    const myComments = replies.filter(r => isTabloid ? (r.charId === 'me') : (r.char && r.char.id === 'me'))
                              .filter(r => r && r.text)
                              .slice(-MAX_PICKABLE);
    const mine = myComments.length > 0 ? myComments[myComments.length - 1] : null;
    if (!mine) {
        showToast('<div class="avatar" style="width:40px;height:40px;">💬</div>', '没什么可以重新生成的',
            '得先有一条你自己的评论，角色才知道要回应什么。先说点什么吧。', null, null);
        return;
    }

    // 防连点：正在生成时不再叠一次
    if (retriggerCharComments._busy) return;
    retriggerCharComments._busy = true;
    try {
        if (isTabloid) {
            // 营销号帖子没有"博主本人"，走它自己那套：营销号互动 + 路人围观
            rollTabloidAIParticipation(postId, mine.text, mine.name || userDisplayName());
            await spawnNpcComments(postId, 'tabloid', { triggerName: mine.name || userDisplayName(), triggerText: mine.text, triggerId: mine.id });
        } else {
            // 传 userComments 就进"挑一条回"模式：谁开口、回哪条、回几条，全由人设决定
            await runCharRepliesToComment(post, postId, mine, mine.text || '', { userComments: myComments });
        }
    } finally {
        retriggerCharComments._busy = false;
    }
}

// 1. 全新：支持无限极嵌套、3层自动折叠的深渊渲染器
window.renderAnonPosts = function() {
    const container = document.getElementById('anonFeedSection');
    if (!anonPosts || anonPosts.length === 0) {
        container.innerHTML = '<div class="empty-state" style="color:#aaa;">深渊里一片死寂...</div>';
        return;
    }

    // 预处理：确保所有旧评论都有唯一ID，防止树状图断裂
    let dataChanged = false;
    anonPosts.forEach(post => {
        if (post.replies) {
            post.replies.forEach(r => {
                if (!r.id) { r.id = 'ar_' + Date.now() + Math.random().toString(36).substr(2, 5); dataChanged = true; }
            });
        }
    });
    if(dataChanged && typeof saveAllData === 'function') saveAllData();

    container.innerHTML = anonPosts.map((post, pIdx) => {
        let repliesHtml = '';
        if (post.replies && post.replies.length > 0) {
            
            // 【核心算法】将扁平的评论数组转换为虚拟嵌套树
            const map = new Map();
            const roots = [];
            
            post.replies.forEach((r, idx) => {
                map.set(r.id, { data: r, originalIdx: idx, children: [] });
            });
            
            post.replies.forEach((r, idx) => {
                let node = map.get(r.id);
                let parentFound = false;
                
                if (r.parentId && map.has(r.parentId)) {
                    map.get(r.parentId).children.push(node);
                    parentFound = true;
                } else if (r.replyTo) {
                    // 兼容旧数据：如果只有回复名字，自动向前回溯寻找父节点
                    for (let i = idx - 1; i >= 0; i--) {
                        if (post.replies[i].anonName === r.replyTo) {
                            map.get(post.replies[i].id).children.push(node);
                            parentFound = true;
                            break;
                        }
                    }
                }
                if (!parentFound) roots.push(node); // 找不到父节点的归为顶层
            });

            // 【递归渲染函数】控制层级缩进与折叠
            function renderNode(node, depth) {
                let isMaxDepth = depth >= 2; // 0=第一层, 1=第二层, 2=第三层 (在此处折叠)
                let childrenHtml = '';
                
                if (node.children && node.children.length > 0) {
                    if (isMaxDepth) {
                        // 超过3层：隐藏子节点，显示查看更多按钮
                        childrenHtml += `<div id="anon-children-${node.data.id}" style="display:none; border-left: 2px solid #333; margin-left: 12px; padding-left: 10px; margin-top: 5px;">`;
                        node.children.forEach(child => childrenHtml += renderNode(child, depth + 1));
                        childrenHtml += `</div>`;
                        childrenHtml += `<div style="margin-left:12px; margin-top:5px; color:#1d9bf0; font-size:12px; cursor:pointer;" onclick="document.getElementById('anon-children-${node.data.id}').style.display='block'; this.style.display='none';"> ↳ 展开 ${node.children.length} 条隐藏回复...</div>`;
                    } else {
                        // 正常嵌套显示，带有左侧跟帖线
                        childrenHtml += `<div style="border-left: 2px solid #333; margin-left: 12px; padding-left: 10px; margin-top: 5px;">`;
                        node.children.forEach(child => childrenHtml += renderNode(child, depth + 1));
                        childrenHtml += `</div>`;
                    }
                }

                let nodeHtml = `
                    <div class="anon-reply-item" style="padding: 10px 0; border-bottom: ${depth === 0 && node.children.length === 0 ? '1px solid #222' : 'none'};" oncontextmenu="showAnonReplyContextMenu(event, '${post.id}', ${node.originalIdx})">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <span style="font-weight:bold; color:#fff; font-size:13px;">${node.data.anonName}</span> 
                                <span style="color:#1d9bf0; font-size:12px; cursor:pointer; margin-left:10px;" onclick="window.triggerAnonReply('${post.id}', '${node.data.id}', '${node.data.anonName}')">💬 回复</span>
                            </div>
                        </div>
                        <div style="margin-top:4px; color:#ccc; font-size:14px; line-height:1.5;">${typeof renderPlainChatText === 'function' ? renderPlainChatText(node.data.text) : node.data.text}</div>
                    </div>
                `;
                return nodeHtml + childrenHtml;
            }

            repliesHtml = `<div class="anon-reply-section" style="margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;">` 
                        + roots.map(root => renderNode(root, 0)).join('') 
                        + `</div>`;
        }

        return `
        <div class="anon-post-item">
            <div class="anon-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="anon-avatar">${post.anonName ? post.anonName[0] : '?'}</div>
                    <div>
                        <div class="anon-name">${post.anonName}</div>
                        <div class="anon-id">ID: ${post.anonId} · ${timeAgo(post.timestamp)}</div>
                    </div>
                </div>
                <button class="anon-action-btn" style="background:transparent; border:none; color:#f91880; font-size:16px; padding:0;" onclick="deleteAnonPost('${post.id}')" title="删除帖子">🗑️</button>
            </div>
            <div class="anon-body">${typeof renderPlainChatText === 'function' ? renderPlainChatText(post.text) : post.text}</div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button class="anon-action-btn" onclick="likeAnonPost('${post.id}')">${post.userLiked ? '❤️ 已赞' : '🤍 赞'} ${post.stats.likes || 0}</button>
                <button class="anon-action-btn" onclick="window.triggerAnonReply('${post.id}', null, '')">💬 评论 ${post.stats.comments || 0}</button>
            </div>
            
            <div id="anon-reply-input-${post.id}" style="display:none; margin-top:15px; padding-top:15px; border-top:1px dashed #444;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="text" id="anon-input-text-${post.id}" placeholder="发布你的匿名回复..." style="flex:1; background: #222; color: #fff; border: 1px solid #555; padding: 10px 15px; border-radius: 20px; outline: none; font-size: 14px;" onkeypress="if(event.key === 'Enter') submitAnonReplyBtn('${post.id}')">
                    <button style="background: #1d9bf0; color: #fff; border: none; padding: 8px 18px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 14px;" onclick="submitAnonReplyBtn('${post.id}')">回复</button>
                </div>
            </div>
            
            ${repliesHtml}
        </div>
        `;
    }).join('');
};

// 2. 唤醒对应层级的回复输入框
window.triggerAnonReply = function(postId, parentId, replyToName) {
    const inputContainer = document.getElementById(`anon-reply-input-${postId}`);
    if (inputContainer.style.display === 'none' || inputContainer.dataset.parentId !== String(parentId)) {
        inputContainer.style.display = 'block';
        inputContainer.dataset.parentId = parentId || ''; // 记录父评论ID
        const inputEl = document.getElementById(`anon-input-text-${postId}`);
        inputEl.value = replyToName ? `回复 @${replyToName}：` : '';
        inputEl.focus();
    } else {
        inputContainer.style.display = 'none';
    }
};

// 3. 提交带层级记忆的评论
// 【重要修复】：之前这个函数只是把用户的评论存进数组里就完事了，从来没有触发过任何AI互动——
// 不管这条帖子是用户自己发的还是某个角色发的，评论之后角色和路人NPC都不会有任何反应。
// 现在补上：如果帖子是角色发的，让ta本人有几率亲自回应；然后再按概率随机召唤路人NPC围观。
window.submitAnonReplyBtn = async function(postId) {
    const inputContainer = document.getElementById(`anon-reply-input-${postId}`);
    const inputEl = document.getElementById(`anon-input-text-${postId}`);
    let text = inputEl.value.trim();
    if(!text) return;

    let parentId = inputContainer.dataset.parentId || null;
    let replyTo = '';

    // 如果用户没有删掉"回复 @xxx："前缀，剥离出真实文本
    if(text.startsWith('回复 @')) {
        const parts = text.split('：');
        if(parts.length > 1) {
            replyTo = parts[0].replace('回复 @', '');
            text = parts.slice(1).join('：').trim();
        }
    }

    const post = anonPosts.find(p => p.id === postId);
    if (!post) return;

    post.replies = post.replies || [];
    const anonProfile = { name: document.getElementById('myAnonName')?.value || '无名氏', id: document.getElementById('myAnonId')?.value || 'User123' };

    const newReply = {
        id: 'ar_' + Date.now() + Math.random().toString(36).substr(2, 5),
        parentId: parentId, // 绑定层级
        charId: 'user',
        anonName: anonProfile.name,
        anonId: anonProfile.id,
        replyTo: replyTo,
        text: text,
        timestamp: Date.now()
    };
    post.replies.push(newReply);

    post.stats.comments++;
    inputEl.value = '';
    inputContainer.style.display = 'none';
    if(typeof saveAllData === 'function') saveAllData();
    window.renderAnonPosts();

    if (!myApiKey) return;

    // 如果这条帖子是某个角色发的（不是用户自己），让发帖角色本人有机会亲自回应这条评论
    if (post.charId && post.charId !== 'me' && post.charId !== 'user') {
        const char = myCharacters.find(c => c.id == post.charId);
        if (char && char.replyToUser !== false) {
            try {
                const api = getApiConfig(true);
                if (api.key) {
                    const actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要包含任何动作、神态或心理描写（不要用括号()或【】），只输出你直接说的话。";
                    // 修复：这里之前只塞了人设，没带世界书/关系网/预设——容易在匿名论坛这种"卸下伪装"的场景里OOC。
                    // 换成buildBasePrompt统一走一遍完整上下文，跟其它地方保持一致。
                    const p = `${buildBasePrompt(char, false, post.text + '\n' + text)}你现在处于匿名论坛（暗网、抽象、无底线氛围），你在这里发的帖子是："${post.text}"。刚刚有人评论道："${text}"。
这是你自己发的帖子，有人评论了就必须回应，不能装作没看见。直接输出你的回复内容（不超过${chatWordLimit}字，语气符合匿名论坛的恶劣氛围和你的隐藏性格）。${WORD_LIMIT_PRIORITY_NOTE}绝对不能输出"NO"。${actionStrictRule}${getFinalAnswerMarkerPromptNote()}`;
                    const data = await sendChatRequest(api, p);
                    if (data.error) { console.error(`角色"${char.name}"回应匿名评论失败：`, data.error); }
                    else {
                        // ⚠️ 修复"评论带思考过程"：跟推文评论区那处同一类问题，统一走"截取正式输出标记+超长自动扔思考草稿"清洗
                        let rep = stripUndelimitedReasoningIfOverLength(extractAfterFinalMarker(data.choices?.[0]?.message?.content || '').trim(), chatWordLimit);
                        if (rep && !rep.toUpperCase().startsWith('NO')) {
                            rep = rep.replace(/^["“]|["”]$/g, '').trim();
                            post.replies.push({
                                id: 'ar_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                parentId: newReply.id,
                                charId: char.id,
                                anonName: post.anonName,
                                anonId: post.anonId,
                                replyTo: anonProfile.name,
                                text: rep,
                                timestamp: Date.now()
                            });
                            post.stats.comments++;
                            saveAllData();
                            window.renderAnonPosts();
                        }
                    }
                }
            } catch (e) { console.error('匿名论坛角色回应评论异常：', e); }
        }
    }

    // 随机召唤路人NPC围观评论
    if (Math.random() < npcReplyProb) spawnNpcComments(postId, 'anon', { triggerName: anonProfile.name, triggerText: text, triggerId: newReply.id });
};
async function deleteAnonPost(postId) {
    if (!(await appConfirm('警告：确定要彻底删除这条匿名帖子吗？'))) return;
    anonPosts = anonPosts.filter(p => p.id !== postId);
    saveAllData();
    renderAnonPosts();
}

function likeAnonPost(postId) {
    let post = anonPosts.find(p => p.id === postId);
    if(!post) return;
    post.userLiked = !post.userLiked;
    post.stats.likes = Math.max(0, (post.stats.likes || 0) + (post.userLiked ? 1 : -1));
    renderAnonPosts();
    saveAllData();
}

// 论坛发帖身份下拉框：填充「我 / 随机角色 / 各个角色」，并同步左边那个小头像。
// 跟 updateCharSelects 里其它几个下拉框一样，角色增删后会被重新填一遍。
function populateAnonPostRoleSelect() {
    const sel = document.getElementById('anonPostRoleSelect');
    if (!sel) return;
    const old = sel.value;
    sel.innerHTML = '<option value="me">我（自己写）</option>'
        + '<option value="random">🎲 随机角色（AI 代笔）</option>'
        + (myCharacters || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}（AI 代笔）</option>`).join('');
    if (old && sel.querySelector(`option[value="${old}"]`)) sel.value = old;
    updateAnonPostAvatar();
}

function updateAnonPostAvatar() {
    const sel = document.getElementById('anonPostRoleSelect');
    const box = document.getElementById('anonPostAvatar');
    if (!sel || !box) return;
    const v = sel.value;
    // 论坛是匿名的，这里不显示真实头像（那就等于当场破功了），只用一个符号提示"这条要以谁的身份写"
    if (v === 'me') { box.innerText = '我'; box.title = '以你自己的身份发'; }
    else if (v === 'random') { box.innerText = '🎲'; box.title = '随机挑一个角色，由 AI 代笔'; }
    else {
        const c = (myCharacters || []).find(x => x.id == v);
        box.innerText = '匿';
        box.title = c ? `由「${c.name}」代笔（论坛上仍然匿名）` : '由角色代笔';
    }
}

// 让角色们来回这条论坛帖子。用户自己发的帖、以及角色代笔发的帖，走的都是这一个函数——
// 「发布的论坛和推文一样，角色都可以互动」说的就是这件事：不管帖子是谁发的，
// 其他角色都有机会看到并回应，而不是只有用户发的帖才有人理。
async function runCharRepliesToAnonPost(post) {
    if (!post) return;
    const st = document.getElementById('anonLoadingStatus');
    if (st) st.style.display = 'block';
    const text = post.text || ''; // 帖子正文（原来这段是内联在 userAnonPost 里的，直接用外层的 text 变量）
    // 💰 跟推文那条路一样：以前是全角色库遍历，一人一次完整上下文的请求，帖子一发就是几十次调用。
    // 现在先按相关度挑出最多 charInteractMaxCount 个（设置里可调，0＝不限）。
    // 🔌 同上：关掉之后帖子只是安静地发出去
    const anonPool = (typeof isAutoOn === 'function' && !isAutoOn('postReactions'))
        ? []
        : myCharacters.filter(c => c.replyToUser !== false && String(post.charId) !== String(c.id));
    const anonChars = (typeof pickInteractingChars === 'function')
        ? pickInteractingChars(anonPool, text, post.charId) : anonPool;
    for (let char of anonChars) {
        let actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要包含任何动作、神态或心理描写（不要用括号()或【】），只输出你直接说的话。";
        // 修复：同上，补齐世界书/关系网/预设上下文，避免匿名论坛这种"卸下伪装"场景里OOC
        let p = `${buildBasePrompt(char, false, text)}你正在逛一个匿名论坛，看到有人发帖："${text}"。

【最重要的一条】匿名 = **不署真名**，不等于换一个人格。
你还是你——人设、说话习惯、在意的事、跟其他人的关系，全都不变。
匿名只是让你**敢说平时不方便公开说的话**（更直接、更真实、少一点场面话），
不是让你变成一个暴躁发癫的陌生人。绝对不要为了"符合论坛氛围"而演一个不是自己的角色。
该冷淡就冷淡，该话少就话少，该不感兴趣就明说不感兴趣。
${actionStrictRule}
直接输出你的回复内容（不超过${chatWordLimit}字）。${WORD_LIMIT_PRIORITY_NOTE}
如果你确实对这个帖子没什么想说的，直接输出 NO。`;

        try {
            let data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, p);
            // ⚠️ 修复"评论带思考过程"：同上，统一走清洗流程，避免思考草稿混进评论正文
            let repText = stripUndelimitedReasoningIfOverLength(extractAfterFinalMarker(data.choices?.[0]?.message?.content || '').trim(), chatWordLimit);

            if (!repText.toUpperCase().startsWith("NO") && repText !== "") {
                repText = repText.replace(/^["“]|["”]$/g, '').trim();
                post.replies.push({
                    charId: char.id,
                    anonName: char.anonName || '匿名者',
                    anonId: char.anonId || Math.random().toString(36).substr(2,6).toUpperCase(),
                    text: repText,
                    timestamp: Date.now()
                });
                post.stats.comments++;
                
                let avatarHtml = `<div class="avatar" style="background:#555; border:1px solid #777; color:#fff;">?</div>`;
                showToast(avatarHtml, `匿名用户 评论了你的帖子`, repText, post.id, null, true);
                renderAnonPosts();
            }
        } catch(e) { console.error(e); }
    }
    if (st) st.style.display = 'none';
    saveAllData();
}

async function userAnonPost() {
    const input = document.getElementById('userAnonInput');
    const text = input.value.trim();
    if (!myApiKey) return alert("请先在设置中配置密钥！");

    // 🆕 发帖身份：选了角色（或随机角色）时，这条帖子交给 AI 照着那个角色的人设+记忆写，
    // 走的是 autoGenerateAnonPostForChar——也就是跟"召唤角色发言"完全同一套逻辑和格式，
    // 发完之后一样会被路人和其他角色围观、互动。输入框里的文字这时当成"给角色的题目"。
    const roleSel = document.getElementById('anonPostRoleSelect');
    const roleId = roleSel ? roleSel.value : 'me';
    if (roleId !== 'me') {
        let char = null;
        if (roleId === 'random') {
            const pool = (myCharacters || []).filter(c => c.replyToUser !== false);
            char = pool[Math.floor(Math.random() * pool.length)] || null;
        } else {
            char = (myCharacters || []).find(c => c.id == roleId) || null;
        }
        if (!char) return alert('没有可用的角色，先去【角色中心】建一个。');

        const st = document.getElementById('anonLoadingStatus');
        if (st) { st.innerText = `「${char.name}」正在写…`; st.style.display = 'block'; }
        try {
            const r = await autoGenerateAnonPostForChar(char, text || null);
            if (!r || !r.success) alert('角色发帖失败：' + ((r && r.error) || '未知原因'));
            else input.value = '';
        } finally {
            if (st) { st.innerText = '深渊正在低语... '; st.style.display = 'none'; }
        }
        return;
    }

    if (!text) return;

    const newPost = {
        id: 'anon_' + Date.now(),
        charId: 'me',
        anonName: currentUser.anonName || '匿名用户',
        anonId: currentUser.anonId || 'User',
        text: text,
        timestamp: Date.now(),
        replies: [],
        stats: { likes: 0, comments: 0 },
        userLiked: false
    };
    if(!anonPosts) anonPosts = [];
    anonPosts.unshift(newPost);
    input.value = '';
    renderAnonPosts();
    
    // ==========================================
    // 触发路人 NPC 在匿名论坛的评论
    spawnNpcComments(newPost.id, 'anon', { triggerName: newPost.anonName, triggerText: text });
    // ==========================================

    // 角色们来回帖（跟角色代笔发的帖走的是同一个函数，一视同仁）
    await runCharRepliesToAnonPost(newPost);
}

// 匿名论坛发帖的核心生成逻辑：抽出来单独一个函数，手动"召唤角色发言"按钮和角色自主发帖定时器共用同一套逻辑，
// 不用维护两份几乎一样的prompt。返回 {success, error?, post?}，调用方自己决定失败了要不要弹提示
// （手动触发失败要弹给用户看；后台自动触发失败静默跳过就行，不然天天弹烦死人）。
async function autoGenerateAnonPostForChar(char, topicHint) {
    if (!char) return { success: false, error: '没有指定角色' };
    const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : { url: myApiUrl, key: myApiKey, model: myModel };
    if (!api.key) return { success: false, error: '未配置API Key' };

    try {
        let actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要包含任何动作、神态或心理描写（不要用括号()或【】），只输出你直接想说的文字内容。";
        // 补齐世界书/关系网/预设上下文，避免匿名论坛发帖OOC
        // ⚠️ 防御修复：buildBasePrompt 调用之前在try外面，一旦抛异常会变成未捕获的promise rejection，
        // 挪进来后跟其它类型的自动发帖统一走同一套"单个角色失败不影响其它角色"的错误处理。
        let p = `${buildBasePrompt(char, false)}${typeof getRecentPostsAwarenessText === 'function' ? getRecentPostsAwarenessText(char) : ''}${typeof getTimeAwarenessPrompt === 'function' ? getTimeAwarenessPrompt(String(char.id), char) : ''}

你要在一个匿名论坛上发一条帖子。${topicHint ? `\n【这次想写的方向】：${topicHint}（照这个方向写，但要用你自己的语气和视角，不要照抄这句话）` : ''}

【最重要的一条】匿名 = **不署真名**，不等于换一个人格。
你还是你——人设、语气、最近在经历的事、心里装着的人，全都不变。
匿名只是让你敢把平时不会公开讲的心里话讲出来，而不是变成一个陌生的暴躁网友。
内容要能从你的人设、你最近的经历、你和其他人的关系里长出来，不要凭空编一件跟你无关的事。
${actionStrictRule}
用第一人称写，不超过${postWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}
不要暴露你的真实姓名和身份。直接输出帖子正文，不要 JSON、不要标题、不要任何说明文字。`;

        let data = await sendChatRequest(api, p);
        if (data.error) { console.warn("[匿名帖生成] 失败：", data.error); return { success: false, error: data.error.message || "API 返回了错误，请检查密钥/模型配置" }; }
        let repText = stripUndelimitedReasoningIfOverLength(extractAfterFinalMarker(data.choices?.[0]?.message?.content || '').trim(), postWordLimit);
        // 强力清洗可能的 Markdown/JSON 污染符
        repText = repText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').replace(/^["“]/, '').replace(/["”]$/, '').trim();
        if (!repText) return { success: false, error: '这次AI没有返回有效内容，可能是网络波动或模型拒答' };

        if (!Array.isArray(anonPosts)) anonPosts = [];
        let aName = char.anonName || '匿名者';
        let aId = char.anonId || Math.random().toString(36).substring(2, 8).toUpperCase();
        let newPost = {
            id: 'anon_' + Date.now(), charId: char.id, anonName: aName, anonId: aId,
            text: repText, timestamp: Date.now(), replies: [], stats: { likes: 0, comments: 0 }, userLiked: false
        };
        anonPosts.unshift(newPost);
        saveAllData();
        if (typeof renderAnonPosts === 'function') renderAnonPosts();
        // 角色发帖后，随机召唤 NPC 阴阳怪气
        spawnNpcComments(newPost.id, 'anon', { triggerName: aName, triggerText: repText });
        // 角色发的帖子，其他角色同样会来围观互动（跟用户发帖一视同仁）。
        // 不 await：让它在后台慢慢来，别把"发帖"这个动作卡在这儿等一圈人回完。
        runCharRepliesToAnonPost(newPost).catch(e => console.error('角色围观论坛帖失败：', e));
        return { success: true, post: newPost };
    } catch (e) {
        console.error("[匿名帖生成] 出错：", e);
        return { success: false, error: e.message };
    }
}

async function generateAnonPostForSelected() {
    if (!myApiKey) return alert("请先在设置中配置密钥！");
    if (myCharacters.length === 0) return alert("请先创建至少一个角色！");

    const selVal = document.getElementById('anonCharSelect').value;
    let selectedChar = selVal === 'random' ? myCharacters[Math.floor(Math.random() * myCharacters.length)] : (myCharacters.find(x => x.id == selVal) || myCharacters[0]);

    const btn = document.getElementById('btnGenerateAnon');
    btn.innerText = "处理中... ⏳"; btn.disabled = true;

    const result = await autoGenerateAnonPostForChar(selectedChar);
    if (!result.success) alert("生成失败：" + (result.error || '未知错误'));

    btn.innerText = "召唤角色发言"; btn.disabled = false;
}

// 修改内联回复框，与新版极简回复框保持一致
function toggleInlineReply(replyIdx, postId) {
    const areaId = `inline-reply-${postId}-${replyIdx}`; const existing = document.getElementById(areaId); if (existing) { existing.remove(); return; }
    const replyItem = document.querySelector(`[data-reply-idx="${replyIdx}"][data-post-id="${postId}"]`); if (!replyItem) return;
    const area = document.createElement('div'); area.className = 'inline-reply-area'; area.id = areaId;
    let isTabloid = postId.startsWith('tb_');
    const post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId);
    const targetReply = post?.replies[replyIdx];
    const targetDisplayName = isTabloid ? (targetReply?.name || '') : (targetReply?.char?.name || '');
    
    area.innerHTML = `
        <div style="display:flex; align-items:center; padding:10px 16px; gap:12px; margin-top:0; border-top:1px solid #eff3f4;">
            ${getAvatarHTML(currentUser, 40)}
            <input type="text" id="inline-input-${postId}-${replyIdx}" placeholder="回复 @${targetDisplayName}" style="flex:1; border:none; outline:none; font-size:15px; color:#0f1419; background:transparent;" onkeypress="if(event.key === 'Enter') submitInlineReply('${postId}', ${replyIdx})">
            <input type="file" id="inlineAttachmentInput-${postId}-${replyIdx}" accept="image/*" style="display:none;" onchange="handleDirectImageUpload(this, 'inline', '${postId}-${replyIdx}')">
            <span onclick="document.getElementById('inlineAttachmentInput-${postId}-${replyIdx}').click()" title="上传图片" style="cursor:pointer; font-size:18px;">📷</span>
            <button onclick="submitInlineReply('${postId}', ${replyIdx})" style="background-color:rgba(29, 155, 240, 0.4); color:white; border:none; border-radius:9999px; padding:6px 16px; font-weight:bold; font-size:14px; cursor:pointer;">回复</button>
        </div>
        <div id="inlineAttachmentPreview-${postId}-${replyIdx}" class="emo-preview-box" style="display:none; padding-left:0;"></div>
    `;
    // 插入到对应的回复项之后，保证层级正确
    replyItem.parentNode.insertBefore(area, replyItem.nextSibling); document.getElementById(`inline-input-${postId}-${replyIdx}`).focus();
}

// ==========================================
// 修复：主页/推文的 NPC 跟帖系统 (增加弹窗提醒及楼中楼兼容)
// ==========================================
async function spawnNpcComments(postId, postType, opts = {}) {
    const { triggerName, triggerText, isShura, triggerId } = opts;
    let post;
    
    if (postType === true || postType === 'tabloid') post = tabloidPosts.find(p => p.id == postId);
    else if (postType === 'anon') post = anonPosts.find(p => p.id == postId);
    else post = globalPosts.find(p => p.id == postId);
    
    if (!post) return;
    const api = getApiConfig(true); if (!api.key) return;
    if (npcReplyMaxCount <= 0) return;
const count = Math.floor(Math.random() * npcReplyMaxCount) + 1; 
    
    let postCharContext = "当前被评论的推文博主是用户本人。";
    if (post.char && post.char.id !== 'me' && post.char.id !== 'tabloid_admin') {
        postCharContext = `当前被评论的推文博主是"${post.char.name}"，其人设为：${post.char.persona}。`;
    }
    
    const context = triggerText ? `刚才"${triggerName}"评论说："${triggerText}"。` : `帖子内容："${post.text}"。`;
    const toneHint = isShura ? '拱火、阴阳怪气、骂战' : '吃瓜、围观、玩梗';
    let forumHint = postType === 'anon' ? "注意：当前处于匿名、抽象且无底线的深渊论坛，请用非常暴躁、极端、抽象、不礼貌的网民语气。" : "";
    const actionStrictRule = allowActionTags ? "" : "评论内容里绝对不要有任何动作、神态或心理描写，不要用括号()或【】，只写路人会打出来的话。";

    /* 👥 v114：这个博主身边真有人的话（世界书里抽出来的 NPC），
       按比例把其中几条换成熟人来说——以前一个古代角色发推，
       底下能冒出 @fatui_watcher，跟这个世界一点关系都没有。 */
    let npcHint = '';
    try {
        const ownerId = (post.char && post.char.id !== 'me' && post.char.id !== 'tabloid_admin') ? post.char.id : null;
        if (ownerId && typeof window.gyNpcCommentHint === 'function') npcHint = window.gyNpcCommentHint(ownerId, count) || '';
    } catch (e) {}

    const prompt = `你现在要模拟${count}个路人NPC网友进行网络评论。
【重要设定上下文】：
${postCharContext}${npcHint}
${getUserContextPrompt(post.char && post.char.id !== 'me' ? myCharacters.find(c => c.id == post.char.id) : null)}
生成NPC言论时，你必须严格记忆、区分并遵循上述博主和用户的性别与人设特征，绝不能搞错代词！
${forumHint}
${context}
请模拟${count}个路人NPC看到后的${toneHint}评论，各不相同，每条不超过${typeof commentWordLimit !== 'undefined' ? commentWordLimit : 30}字。
【严格禁止】：评论内容必须是路人自己的原创发言，绝对不能照抄、复述或改写上面引用的原话，也不能和原帖内容重复！${actionStrictRule}
每个网友还要有一个自己的推特账号名（英文/拼音/数字，像真人账号那样，比如 @liyue_ore、@fatui_watcher），要跟这个人的昵称气质对得上。
请严格返回JSON数组: [{"name":"网友昵称","handle":"@账号名","text":"评论内容"}]，不要有其他任何说明文字。
${getFinalAnswerMarkerPromptNote()}`;

    // 修复：AI 偶尔会把"刚才谁说了什么"的引用内容直接当成一条新评论抄回来，
    // 导致评论区里出现一条和角色/用户刚发的内容一模一样的"新评论"。这里做一层归一化去重兜底。
    const normalizeForCompare = (s) => (s || '').replace(/["“”'‘’，。！？~\s]/g, '');
    const bannedTexts = [triggerText, post.text].filter(Boolean).map(normalizeForCompare);
    const isEchoOfTrigger = (text) => {
        const t = normalizeForCompare(text);
        if (!t) return true;
        return bannedTexts.some(b => b && (t === b || (t.length > 6 && (b.includes(t) || t.includes(b)))));
    };

    try {
        // 🆕 识图：帖子本身带图的话，让路人NPC的吃瓜评论也能看图说话，而不是只针对文字反应。
        const resData = await callChatCompletionAPI(api, prompt, 2, post.mediaUrl ? [post.mediaUrl] : null);
        if (resData.error) { console.error("NPC 评论生成失败（API返回错误）：", resData.error); return; }
        const rawContent = resData.choices?.[0]?.message?.content || '';
        const arr = extractJsonArray(rawContent) || [];
        let lastName = triggerName, lastText = triggerText;
        
        arr.forEach(c => {
            if (!c || !c.text) return;
            if (isEchoOfTrigger(c.text)) return; // 跳过照抄原话的"伪造评论"
            
            if (postType === true || postType === 'tabloid') {
                const savedReply = {
                    id: 'r_' + Date.now() + Math.floor(Math.random()*100),
                    parentId: triggerId || null,
                    charId: 'npc', name: c.name || '路人网友', text: c.text, timestamp: Date.now(),
                    replyTo: triggerId ? triggerName : undefined
                };
                post.replies.push(savedReply);
                c._replyId = savedReply.id; // 记下这条NPC评论真实存下来的id，供下面"角色回应NPC评论"精确挂楼中楼用
                // 【新增：小报推文收到NPC回复的弹窗】
                if (opts.triggerName === currentUser.name) {
                    showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">📰</div>`, `${c.name || '路人网友'} 评论了你`, c.text, postId, null);
                }
            } else if (postType === 'anon') {
                const savedReply = {
                    id: 'ar_' + Date.now() + Math.floor(Math.random()*100),
                    parentId: triggerId || null,
                    charId: 'npc', anonName: c.name || '路人网友', anonId: 'NPC', text: c.text, timestamp: Date.now(),
                    replyTo: triggerId ? triggerName : undefined
                };
                post.replies.push(savedReply);
                c._replyId = savedReply.id;
                // 【新增：匿名推文收到NPC回复的弹窗】
                if (post.charId === 'me' || opts.triggerName === (currentUser.anonName || '匿名用户')) {
                    showToast(`<div class="avatar" style="background:#555; border:1px solid #777; color:#fff;">?</div>`, `匿名网友 评论了你`, c.text, postId, null, true);
                }
            } else {
                // 每个路人有自己的账号/头像/颜色，同名的人在别的帖子下也是同一个账号（见 getNpcIdentity）
                const npcChar = getNpcIdentity(c.name || '路人网友', c.handle);

                const savedReply = {
                    id: 'r_' + Date.now() + Math.floor(Math.random()*100),
                    // 修复：优先挂载到触发本轮NPC评论的那条评论下（角色/用户的评论），实现楼中楼嵌套；没有明确触发对象时才作为一级评论
                    parentId: triggerId || null,
                    char: npcChar,
                    text: c.text,
                    timestamp: Date.now(),
                    likes: 0,
                    liked: false,
                    likedBy: [],
                    replyTo: triggerId ? triggerName : undefined
                };
                post.replies.push(savedReply);
                c._replyId = savedReply.id;

                // 【新增：普通推文如果是用户的，或者用户刚刚参与了评论，就弹窗通知】
                if (post.char.id === 'me' || opts.triggerName === currentUser.name) {
                    showToast(getAvatarHTML(npcChar, 40), `${npcChar.name} 评论了你`, c.text, postId, null);
                }
            }
            post.stats.comments = (post.stats.comments || 0) + 1;
            lastName = c.name || '路人网友'; lastText = c.text;
        });
        saveAllData();
        
        const detailEl = document.getElementById('view-post-detail');
        if (detailEl && detailEl.style.display !== 'none') renderSinglePostDetail(postId);
        const tabloidEl = document.getElementById('view-tabloid');
        if ((postType === true || postType === 'tabloid') && tabloidEl && tabloidEl.style.display !== 'none') renderTabloidPosts();
        const anonEl = document.getElementById('view-anon-forum');
        if (postType === 'anon' && anonEl && anonEl.style.display !== 'none') renderAnonPosts();
        const homeEl = document.getElementById('view-home');
        if (!postType && homeEl && homeEl.style.display !== 'none' && typeof renderPosts === 'function') renderPosts();
        if (postType === 'tabloid' && arr.length > 0) rollTabloidAIParticipation(postId, lastText, lastName);

        // 🆕 角色是否要搭理这些路人NPC的评论，完全看人设自己判断（不像和真实用户互动那样强制要求回应）。
        // 之前这里只有"首页推文 + 发帖本人"这一种情况会触发，小报/匿名论坛完全没有、而且不管哪种情况都只有
        // 发帖人自己有机会搭理——现在统一改成 maybeCharsReactToNpcComments，四个板块（推文/小报/匿名论坛/论坛）
        // 都覆盖，而且除了发帖人，其它角色也各自有机会判断要不要主动插一嘴（受"全局角色互动"开关控制）。
        // 🆕 路人随手点赞/转发 + 路人之间互相接话，让评论区不只是"各说各的一句"
        // 🆕 论坛也放开"路人互相接话 + 随手点赞"：原来这里的条件是 !postType，
        // 等于只有推文能享受到，论坛永远是"几个路人各说一句然后就死了"。
        // 匿名论坛本来就该比推文更吵，没道理反而更冷清。
        if (arr.length > 0 && (!postType || postType === 'anon')) {
            const justAdded = post.replies.filter(r => arr.some(c => c._replyId && c._replyId === r.id));
            npcCasualLikes(post, justAdded);
            npcArgueWithEachOther(post, arr, opts).then(did => {
                if (did && document.getElementById('view-post-detail')?.style.display !== 'none') renderSinglePostDetail(postId);
            });
            saveAllData();
        }

        if (arr.length > 0) {
            let authorChar = null, authorName = '';
            if (postType === true || postType === 'tabloid') {
                authorName = post.char?.name || tabloidAccount?.name || '营销号';
                // 小报固定是营销号本人发的，不是myCharacters里的真实角色，没有"发帖人"这个候选
            } else if (postType === 'anon') {
                authorName = post.anonName || '匿名者';
                if (post.charId && post.charId !== 'user' && post.charId !== 'me') authorChar = myCharacters.find(c => c.id == post.charId) || null;
            } else {
                authorName = post.char?.name || '';
                if (post.char && post.char.id !== 'me' && post.char.id !== 'tabloid_admin') authorChar = post.char;
            }
            // 🆕 不再秒回：隔一会儿角色才冒出来，像真的刚刷到。旧帖子拖得更久。
            const delay = charReplyDelayMs(post);
            setTimeout(() => {
                maybeCharsReactToNpcComments(arr, { kind: (postType === true ? 'tabloid' : (postType || 'post')), post, postText: post.text, authorChar, authorName, postId });
            }, delay);
        }
    } catch (e) { console.error("NPC 评论生成失败：", e); }
}


// ===================== 让评论区活起来 =====================
//
// 以前的评论区是"一次性"的：刷出几个陌生路人各说一句、角色秒回一条、然后就死了。
// 这一节做四件事，让它更像个真的有人在的地方：
//   1. 路人有固定人格（杠精 / 考据党 / 吹彩虹屁的…），同一个人到哪都是这个调性
//   2. 路人之间会互相接话、吵起来，不再各说各的
//   3. 路人会点赞，而不是只会评论
//   4. 角色不再秒回——刷到旧帖子会隔一会儿才冒出来，像真的刚看到

// 路人的固定人格。按名字算，所以同一个路人永远是同一个调性，跟账号头像一样稳定。
const NPC_TRAITS = [
    '杠精，喜欢抬杠找茬', '考据党，爱纠正细节', '彩虹屁选手，逮谁夸谁',
    '阴阳怪气的看客', '理中客，喜欢和稀泥', '嗑生嗑死的CP粉',
    '路过的键盘侠，脾气爆', '爱玩梗接梗的', '一本正经分析的', '纯吃瓜，只会"我靠"',
];
function getNpcTrait(name) {
    const id = getNpcIdentity(name);
    if (!id.trait) {
        id.trait = NPC_TRAITS[npcNameHash(name) % NPC_TRAITS.length];
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
    }
    return id.trait;
}

// —— 路人点赞 ——
// 真的评论区里点赞永远比评论多得多。这里让路过的人随手点几个赞，不花任何 API 调用。
function npcCasualLikes(post, replies) {
    if (!post) return;
    // 帖子本身：随机涨几个赞/转发
    post.stats = post.stats || { likes: 0, retweets: 0, comments: 0 };
    post.stats.likes = (post.stats.likes || 0) + Math.floor(Math.random() * 4);
    if (Math.random() < 0.25) post.stats.retweets = (post.stats.retweets || 0) + 1;
    // 评论：说得好的那几条会被点赞（这里就是随机挑，但视觉效果一样）
    (replies || []).forEach(r => {
        if (Math.random() < 0.35) {
            r.likes = (r.likes || 0) + 1 + Math.floor(Math.random() * 3);
            if (!r.likedBy) r.likedBy = [];
            r.likedBy.push('npc');
        }
    });
}

// —— 路人吵架 ——
// 从刚生成的这批路人里挑一个去回另一个，用它自己的固定人格。
// 只挑一对、一轮一句，不然评论区会被路人吵架刷屏、把角色的话淹掉。
async function npcArgueWithEachOther(post, npcComments, opts) {
    if (typeof isAutoOn === 'function' && !isAutoOn('npcArgue')) return false;   // 🔌 设置里关掉了「NPC 路人互掐」
    if (!post || !npcComments || npcComments.length < 2) return false;
    if (Math.random() > (typeof npcArgueProb !== 'undefined' ? npcArgueProb : 0.5)) return false;
    const api = getApiConfig(true); if (!api.key) return false;

    // 随机挑"谁去回谁"，但不能自己回自己
    const i = Math.floor(Math.random() * npcComments.length);
    let j = Math.floor(Math.random() * npcComments.length);
    if (j === i) j = (j + 1) % npcComments.length;
    const target = npcComments[i], speaker = npcComments[j];
    const targetName = target.name || '路人网友';
    const speakerName = speaker.name || '路人网友';
    if (!target._replyId) return false;

    const trait = getNpcTrait(speakerName);
    const actionRule = allowActionTags ? '' : '不要有任何动作、神态或心理描写，不要用括号()或【】，只写你会打出来的话。';
    const prompt = `你是评论区里的路人网友"${speakerName}"，人设：${trait}。
帖子内容："${post.text}"
另一个网友"${targetName}"评论说："${target.text}"
请你以自己的人设接话——赞同、抬杠、补刀、玩梗都行，要符合你的人设调性，不超过${commentWordLimit}字。
这是网上随口一说，不要客套、不要复述对方的话。直接输出内容，不要带引号。${actionRule}
${getFinalAnswerMarkerPromptNote()}`;
    try {
        let rep = (await callChatCompletionAPI(api, prompt, 1)).choices?.[0]?.message?.content?.trim() || '';
        rep = stripLeadingReasoningBlocks(rep).rest.trim();
        rep = stripUndelimitedReasoningIfOverLength(rep, commentWordLimit);
        rep = rep.replace(/^["“]|["”]$/g, '').trim();
        if (!rep || rep.toUpperCase().startsWith('NO')) return false;
        // ⚠️ 推文和论坛的"回帖"数据结构不一样：推文用 { char: {...} }，
        // 论坛用 { anonName, anonId }（渲染时读的就是 anonName）。
        // 这个函数现在两种帖子都会跑，所以必须按帖子类型推对应的结构，
        // 否则往论坛里塞一条推文格式的回帖，界面上就是一条没有名字的空评论。
        const isAnonPost = String(post.id || '').startsWith('anon_');
        const npcIdent = getNpcIdentity(speakerName);
        const base = {
            id: (isAnonPost ? 'ar_' : 'r_') + Date.now() + Math.floor(Math.random() * 100),
            parentId: target._replyId,
            text: rep, timestamp: Date.now(),
            likes: 0, liked: false, likedBy: [], replyTo: targetName,
        };
        post.replies.push(isAnonPost
            ? Object.assign(base, {
                charId: 'npc',
                anonName: speakerName || '匿名者',
                anonId: (npcIdent && npcIdent.handle ? String(npcIdent.handle).replace(/^@/, '') : Math.random().toString(36).slice(2, 8)).toUpperCase().slice(0, 6),
            })
            : Object.assign(base, { char: npcIdent }));
        post.stats.comments = (post.stats.comments || 0) + 1;
        saveAllData();
        return true;
    } catch (e) { console.error('路人互相接话失败：', e); return false; }
}

// —— 角色不秒回 ——
// 真人刷到一条帖子不会零点几秒就回。这里给个随机延迟：
// 刚发出来的帖子回得快一点，旧帖子（刷到的）慢一些，最多拖到几分钟。
// 页面关了就不回了——这是刻意的，总比刷新之后突然蹦出一堆积压的回复要好。
function charReplyDelayMs(post) {
    if (typeof charReplyDelayEnabled !== 'undefined' && !charReplyDelayEnabled) return 0;
    const age = Date.now() - (post && post.timestamp ? post.timestamp : Date.now());
    const isOld = age > 10 * 60 * 1000;          // 十分钟前的就算"刷到的旧帖"
    const base = isOld ? 25000 : 4000;
    const spread = isOld ? 90000 : 20000;
    return base + Math.floor(Math.random() * spread);
}

// 🆕 NPC评论了帖子/论坛楼层之后，谁会主动搭理这些评论：
// 1）发帖本人：始终有机会自己判断要不要理会路人评论（跟"跨角色联动"开关无关，纯粹是"自己的帖子自己看不看评论"）；
// 2）其他角色：受"全局角色互动"开关控制（跟关系网联动、营销号联动共用同一个总开关），毕竟凑过来围观别人的帖子
//    已经算跨角色行为了，不想要这种联动可以直接把总开关关掉；为了不让每次刷NPC评论都问遍所有角色（慢、烧token），
//    这边只随机抽样最多 NPC_COMMENT_OTHER_CHARS_MAX 个候选人，要不要真的回应仍然完全交给AI按人设判断
//    （跟角色自己的帖子一样，输出"NO"就是选择无视，高冷/懒得理人的人设完全可以拒绝互动）。
// target: {kind:'post'|'tabloid'|'anon'|'forum', post?, thread?, postText, authorChar, authorName, postId?}

// 一次筛选请求决定"谁想插嘴"。
// 角色少的时候（<=2）不值得多发一次请求，直接全都算候选。
const CHAR_JOIN_MAX = 3;          // 一轮最多几个角色插嘴，免得一条帖子底下挤满自己人
async function pickInterestedChars(chars, target, commentsText) {
    if (!chars || chars.length === 0) return [];
    if (chars.length <= 2) return chars;
    const api = getApiConfig(true); if (!api.key) return [];

    const roster = chars.map((c, i) =>
        `${i + 1}. ${c.name}：${String(c.persona || '').replace(/\s+/g, ' ').slice(0, 60)}`).join('\n');
    const prompt = `下面是一条帖子和它底下的评论，以及一群人的人设。
请判断这些人里**谁会有兴趣凑过去说一句**——可以是感兴趣、想接话、看不惯想怼、或者跟自己有关。
高冷的、跟话题无关的、懒得理人的，就不要选。宁缺毋滥，没人想说就返回空数组。

【帖子】${target.postText || ''}
【评论】
${commentsText}

【这些人】
${roster}

只返回JSON数组，元素是他们的编号，最多 ${CHAR_JOIN_MAX} 个，比如 [1,3]。不要有别的文字。
${getFinalAnswerMarkerPromptNote()}`;
    try {
        const res = await callChatCompletionAPI(api, prompt, 1);
        const raw = res.choices?.[0]?.message?.content || '';
        const arr = extractJsonArray(raw) || [];
        const picked = [];
        arr.forEach(n => {
            const idx = parseInt(n, 10) - 1;
            if (chars[idx] && picked.indexOf(chars[idx]) === -1) picked.push(chars[idx]);
        });
        return picked.slice(0, CHAR_JOIN_MAX);
    } catch (e) {
        console.error('筛选"谁想插嘴"失败，这一轮就不让角色插嘴了：', e);
        return [];
    }
}

const NPC_COMMENT_OTHER_CHARS_MAX = 2;
async function maybeCharsReactToNpcComments(npcComments, target) {
    if (typeof isAutoOn === 'function' && !isAutoOn('charReactNpc')) return;   // 🔌 设置里关掉了「角色回应 NPC 评论」
    if (!npcComments || npcComments.length === 0) return;
    const api = getApiConfig(true); if (!api.key) return;
    // 编号交给角色，它才有办法指明"我回的是哪一条"
    const commentsText = npcComments.map((c, i) =>
        `${i + 1}. ${c.name || c.author || '路人网友'}：${c.text || c.content || ''}`).join('\n');

    // 🐛🐛 修复"回复错位"——截图里 多托雷 明明在回答"夫人画的是咒术符号吗"，
    // 却挂在了完全不相干的"匿名研究员"那条下面、还@了人家。
    //
    // 原因：这个函数一次性把好几条 NPC 评论打包丢给角色，角色回一段话，
    // 然后代码**不管它实际在回哪一条，一律硬挂到「最后一条」上**（就是下面这两行原来干的事）。
    // 只要角色回的不是最后那条，@ 的人和回复的内容就对不上——而这基本是必然的，
    // 角色总会挑最有意思的那条回，很少刚好是最后一条。
    //
    // 改法：给评论编上号交给角色，让它**自己说清楚在回第几条**（第一行写 [回复N]），
    // 然后按它说的挂。它没说、或者说了个不存在的号，才退回"挂最后一条"这个老行为。
    const lastNpcComment = npcComments[npcComments.length - 1];
    const fallbackParentId = (lastNpcComment && lastNpcComment._replyId) || null;
    const fallbackReplyToName = (lastNpcComment && (lastNpcComment.name || lastNpcComment.author)) || undefined;

    // 🆕 "所有角色都能来"。
    //
    // 以前这里随机抽最多 2 个角色，然后**每个角色各发一次 API 请求**问它想不想插嘴——
    // 想让所有角色都有机会，就得发 N 次请求，角色一多直接烧穿。
    //
    // 改成两步：先用**一次**便宜的筛选请求，把所有角色的名字+人设摘要一起丢过去问
    // "这些人里谁会想插嘴"，拿到名单之后才给真正想说话的那几个生成回复。
    // 于是不管你有 3 个还是 30 个角色，固定只多花一次请求，而每个角色都真的有机会出场。
    const candidates = [];
    if (target.authorChar) candidates.push({ char: target.authorChar, isAuthor: true });
    if ((typeof isGlobalCharInteractionEnabled !== 'function' || isGlobalCharInteractionEnabled()) && myCharacters && myCharacters.length > 0) {
        const others = myCharacters.filter(c => c.id !== 'me' && (!target.authorChar || c.id !== target.authorChar.id) && c.replyToUser !== false);
        const interested = await pickInterestedChars(others, target, commentsText);
        interested.forEach(c => candidates.push({ char: c, isAuthor: false }));
    }
    if (candidates.length === 0) return;

    // 🆕 识图：被评论的内容如果是带图的帖子，一起交给角色，回应NPC评论时也能看懂图里是什么。
    const reactImages = (target.post && target.post.mediaUrl) ? [target.post.mediaUrl] : null;

    let anyReplied = false;
    for (const { char, isAuthor } of candidates) {
        if (char.replyToUser === false) continue;
        try {
            const postDesc = target.postText ? `【被评论的内容】：\"${target.postText}\"\n` : '';
            const roleDesc = isAuthor ? '这是你自己发的内容，' : `这不是你发的，是"${target.authorName || '别人'}"发的，你只是刚好刷到这条下面的这些评论，`;
            const prompt = `${buildBasePrompt(char, true, commentsText)}\n${postDesc}【刚刚有几个路人网友评论说】：\n${commentsText}\n这些只是路人NPC，不是重要的人。${roleDesc}请结合你的人设自行判断要不要搭理/插一嘴——高冷、懒得理人、只活在自己世界里的性格完全可以选择无视，不需要勉强互动。如果决定要回应，**第一行只写一个 [回复N] 标记**（N 是上面那些评论的编号，表示你在回哪一条；只能选一条，挑你最想回的那条），从第二行开始再写你要说的话。话术要紧扣你选中的那条评论（不超过${commentWordLimit}字。即使这只是一条评论回复而不是完整对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签、状态栏或HTML卡片，也请照常带上，不要因为是评论场景就省略。${WORD_LIMIT_PRIORITY_NOTE}）；不想搭理就直接输出"NO"。\n${getFinalAnswerMarkerPromptNote()}`;
            let repText = (await callChatCompletionAPI(api, prompt, 2, reactImages)).choices?.[0]?.message?.content?.trim() || "";
            // 去掉可能混进来的思维链前缀（比如<think>...</think>），评论只应该显示真正的回复内容。
            repText = stripLeadingReasoningBlocks(repText).rest.trim();
            repText = stripUndelimitedReasoningIfOverLength(repText, commentWordLimit);
            repText = repText.replace(/^["“]|["”]$/g, '').trim();
            if (!repText || repText.toUpperCase().startsWith("NO")) continue; // 角色选择无视，符合人设自主判断，不强求

            // 把角色自己标出来的"我在回第几条"读出来，并从正文里摘掉这个标记。
            // 读到了就精确挂到那条评论下面，@ 的人也跟着对——这是"回复错位"的正解。
            let parentId = fallbackParentId, replyToName = fallbackReplyToName;
            const mark = repText.match(/^\s*[\[【]\s*回复\s*(\d+)\s*[\]】]\s*/);
            if (mark) {
                repText = repText.slice(mark[0].length).trim();
                const pick = npcComments[parseInt(mark[1], 10) - 1];
                if (pick) {
                    parentId = pick._replyId || fallbackParentId;
                    replyToName = pick.name || pick.author || fallbackReplyToName;
                }
            }
            if (!repText) continue;   // 只写了个标记、没写正文，当作没回
            // 匿名论坛(anon)故意不烘焙生成后正则——那条路径要保持纯文本，跟聊天/匿名论坛的既有设计一致。
            const finalText = (target.kind !== 'anon') ? applyRegexScripts(repText, 'ai_output', char.id) : repText;

            if (target.kind === 'forum') {
                const thread = target.thread;
                const nextFloor = thread.replies.length > 0 ? thread.replies[thread.replies.length - 1].floor + 1 : 2;
                thread.replies.push({ floor: nextFloor, author: char.name, charId: char.id, isOp: false, content: finalText, quoteFloor: null, likes: 0, timestamp: Date.now() });
            } else if (target.kind === 'anon') {
                target.post.replies.push({ id: 'ar_' + Date.now() + Math.floor(Math.random() * 100), parentId, charId: char.id, anonName: isAuthor ? (target.post.anonName || char.anonName || char.name) : (char.anonName || char.name), anonId: isAuthor ? (target.post.anonId || char.anonId || 'anon') : (char.anonId || 'anon'), text: repText, timestamp: Date.now(), replyTo: parentId ? replyToName : undefined });
                target.post.stats.comments = (target.post.stats.comments || 0) + 1;
            } else if (target.kind === 'tabloid') {
                target.post.replies.push({ id: 'r_' + Date.now() + Math.floor(Math.random() * 100), parentId, charId: char.id, name: char.name, text: finalText, timestamp: Date.now(), replyTo: parentId ? replyToName : undefined });
                target.post.stats.comments = (target.post.stats.comments || 0) + 1;
            } else {
                target.post.replies.push({ id: 'r_' + Date.now() + Math.floor(Math.random() * 100), parentId, char, text: finalText, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], replyTo: parentId ? replyToName : undefined });
                target.post.stats.comments = (target.post.stats.comments || 0) + 1;
            }
            anyReplied = true;
            saveAllData();
        } catch (e) { console.error('角色回应NPC评论失败:', e); }
    }
    if (!anyReplied) return;

    if (target.kind === 'forum') { if (document.getElementById('current-forum-wrap')) openForumThread(target.thread.id); }
    else if (target.kind === 'anon') { if (typeof renderAnonPosts === 'function' && document.getElementById('view-anon-forum')?.style.display !== 'none') renderAnonPosts(); }
    else if (target.kind === 'tabloid') { if (document.getElementById('view-tabloid')?.style.display !== 'none') renderTabloidPosts(); }
    else {
        if (document.getElementById('view-post-detail')?.style.display !== 'none') renderSinglePostDetail(target.postId);
        if (document.getElementById('view-home')?.style.display !== 'none' && typeof renderPosts === 'function') renderPosts();
    }
}


// ===================== 路人 NPC 的身份 =====================
//
// 🐛 修复"评论区所有路人都是 @npc_user"：以前每生成一条路人评论，handle 都写死成
// '@npc_user'、头像写死成 👤、颜色写死成灰色。于是十个路人长得一模一样，
// 看起来就像同一个人在自言自语，完全不像一个有很多人的评论区。
//
// 现在每个路人按**名字**算出一份稳定的身份（账号、头像、颜色）：
//   · 同一个名字永远得到同一份身份 —— 所以"璃月矿石鉴定师"在不同帖子下出现时，
//     账号和头像是一致的，像个真的常驻网友，而不是每次都换一张脸
//   · 不同名字得到不同身份 —— 评论区一眼能看出是好几个人在说话
//
// 身份还会存进存档（npcIdentities），这样刷新、换设备之后这些"老熟人"依然是同一个账号。
const NPC_AVATARS = ['🐟','🍊','🌵','🦊','🐧','🍜','🌙','⚡','🎈','🐙','🍄','🧊','🐝','🎭','🪐','🍁','🦉','🧃','🐳','🌶️'];
const NPC_COLORS  = ['#1d9bf0','#17bf63','#f91880','#ffad1f','#7856ff','#ff7a45','#00b8d9','#eb5757','#8b5cf6','#0ea5e9'];

function npcNameHash(name) {
    const s2 = String(name || '路人网友');
    let h = 0;
    for (let i = 0; i < s2.length; i++) { h = (h * 31 + s2.charCodeAt(i)) >>> 0; }
    return h;
}

// name：路人昵称；preferredHandle：AI 自己起的账号（有就优先用，更像真人）
function getNpcIdentity(name, preferredHandle) {
    const key = String(name || '路人网友');
    if (typeof npcIdentities === 'undefined') window.npcIdentities = {};
    if (npcIdentities[key]) {
        // 老熟人：沿用原来的身份。但如果这次 AI 给了个更像样的账号名，而之前是自动生成的，就升级一下
        if (preferredHandle && npcIdentities[key].auto) {
            npcIdentities[key].handle = normalizeNpcHandle(preferredHandle);
            npcIdentities[key].auto = false;
            try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        }
        return npcIdentities[key];
    }
    const h = npcNameHash(key);
    const identity = {
        id: 'npc_' + h.toString(36),
        name: key,
        handle: preferredHandle ? normalizeNpcHandle(preferredHandle) : ('@' + h.toString(36).padStart(6, '0').slice(-6)),
        auto: !preferredHandle,
        avatarEmoji: NPC_AVATARS[h % NPC_AVATARS.length],
        themeColor: NPC_COLORS[(h >> 5) % NPC_COLORS.length],
        verified: false,
        isNpc: true,
    };
    npcIdentities[key] = identity;
    try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
    return identity;
}

function normalizeNpcHandle(h) {
    let x = String(h || '').trim().replace(/^@+/, '');
    x = x.replace(/[^\w一-龥.]/g, '').slice(0, 20);
    return '@' + (x || 'user');
}

// ==========================================
// 修复：楼中楼内联回复系统 (增加 NPC 反击弹窗)
// ==========================================
async function submitInlineReply(postId, replyIdx) {
    const inputEl = document.getElementById(`inline-input-${postId}-${replyIdx}`); if (!inputEl) return;
    const paramKey = `${postId}-${replyIdx}`; const text = inputEl.value.trim(); if (!text && !pendingInlineAttachments[paramKey]) return;
    
    let isTabloid = postId.startsWith('tb_');
    let post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId); 
    if (!post) return; 
    
    const targetReply = post.replies[replyIdx];
    if (!targetReply.id) targetReply.id = 'r_legacy_' + Date.now();
    
    let targetName = isTabloid ? targetReply.name : targetReply.char.name;
    let targetId = isTabloid ? targetReply.charId : targetReply.char.id;

    const newReply = isTabloid 
        ? { id: 'r_' + Date.now(), parentId: targetReply.id, charId: 'me', name: currentUser.name, text: text, timestamp: Date.now() }
        : { id: 'r_' + Date.now(), parentId: targetReply.id, char: { ...currentUser }, text: text, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], replyTo: targetName, mediaUrl: pendingInlineAttachments[paramKey] };

    if (!post.replies) post.replies = [];
    post.replies.push(newReply); post.stats.comments++; clearAttachment('inline', paramKey); 
    if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
    saveAllData();
    
    if (isTabloid) rollTabloidAIParticipation(postId, text, currentUser.name);
    else if (Math.random() < npcReplyProb) spawnNpcComments(postId, false, { triggerName: currentUser.name, triggerText: text, triggerId: newReply.id });
    
    const api = getApiConfig(true); 
    if (!api.key || targetId === 'me') return;

    if (String(targetId).startsWith('npc')) {
        let npcActionRule = allowActionTags ? "" : "不要有任何动作、神态或心理描写，不要用括号()或【】，只输出要说的话。";
        let p = `你是路人网友"${targetName}"。刚才用户"${userDisplayName()}"针对你的评论回复道："${text}"。请你以路人网友的身份（八卦、吃瓜、拱火）简短回击，不超过${commentWordLimit}字。如果在扮演具体角色，注意带入角色的情绪。直接输出内容，不要带引号。${npcActionRule}\n${getFinalAnswerMarkerPromptNote()}`;
        try {
            let rep = (await sendChatRequest(api, p)).choices?.[0]?.message?.content?.trim();
            // 去掉可能混进来的思维链前缀（比如<think>...</think>），评论只应该显示真正的回复内容。
            if (rep) rep = stripLeadingReasoningBlocks(rep).rest.trim();
            if (rep) rep = stripUndelimitedReasoningIfOverLength(rep, 50);
            if (rep && !rep.toUpperCase().startsWith("NO")) {
                post.replies.push(isTabloid
                    ? { id: 'r_' + Date.now(), parentId: newReply.id, charId: targetId, name: targetName, text: rep, timestamp: Date.now() } 
                    : { id: 'r_' + Date.now(), parentId: newReply.id, char: getNpcIdentity(targetName), text: rep, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], replyTo: currentUser.name });
                post.stats.comments++;
                if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
                saveAllData();

                // 【新增：如果 NPC 跟你吵起来了，也得跳出弹窗提醒你】
                let npcCharMock = getNpcIdentity(targetName);
                showToast(getAvatarHTML(npcCharMock, 40), `${targetName} 回复了你`, rep, postId, null);
            }
        } catch(e) {}
        return;
    }

    const char = myCharacters.find(c => c.id === targetId); if (!char) return;
    if (char.replyToUser === false) return; // 新增：设置里关闭了"回复用户"的角色，用户直接@/回复它也不会再收到回应
    let emoPrompt = getEmoticonPrompt(); const isCool = isCoolTowardUser(char);

    let targetText = targetReply.text || targetReply.content || '';
    let actionStrictRule = allowActionTags ? "" : "\n【严格禁止】：绝对不要在回复中包含任何动作、神态或心理描写（如括号内的动作），只能输出你直接说出的话！";
    // 修复：同上，这条推文可能是用户自己发的，也可能是另一个角色发的，被@的角色需要明确知道，
    // 不要下意识把别的角色发的推文当成自己或用户发的。
    let inlinePostAuthorLabel = (post.char && post.char.id === char.id) ? '你自己' : (!post.char || post.char.id === 'me' ? `用户（${userDisplayName()}）本人` : `角色"${post.char.name}"（不是你，也不是用户）`);
    let contextInfo = `\n【原推文内容】(发布者是：${inlinePostAuthorLabel})："${post.text}"\n【原评论/你想回的话】："${targetText}"\n`;
    // 修复：之前这里是手写的简化版prompt（只有人设+世界书+聊天总结），没走buildBasePrompt，
    // 漏了关系网/预设/插件这些上下文，换成buildBasePrompt统一走一遍完整上下文，避免OOC。
    // 同时在prompt末尾再重申一次归属（离生成越近的内容模型越重视，不容易被前面一大段设定冲淡）。
    let inlineOwnerReinforcement = `\n\n【重要，请务必留意】：这条推文的发布者是${inlinePostAuthorLabel}，不要把它误认成你自己发的或用户发的（除非本来就是）。请结合你的人设、当前生效的预设规则、世界书设定、你的相关记忆、以及你和上面提到的人物之间的关系网来组织这条回复，不要遗忘这些设定，也不要人设崩坏(OOC)。\n`;

    // 修复："所有角色都要围着用户转"：用户是直接点名回复/@了这个角色，属于最强互动信号，
    // 不应该再给"NO"这个选项——高冷人设最多是回得简短冷淡，而不是不回。
    const htmlTagNote = `即使这只是一条评论回复而不是完整对话，如果你的世界观设定/正则脚本里要求每次输出固定附带某种格式标签、状态栏或HTML卡片，也请照常带上，不要因为是评论场景就省略。\n${getFinalAnswerMarkerPromptNote()}`;
    const prompt = isCool
        ? `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${emoPrompt}用户在上述对话中直接回复了你："${text}"。你性格高冷，但用户都直接找你说话了，你必须回应，哪怕只是简短冷淡的一两句（不超过${commentWordLimit}字）。请紧扣上下文直接输出内容，绝对不能输出"NO"或保持沉默。若用表情包附上 [EMO:对应ID]。${actionStrictRule}${inlineOwnerReinforcement}${htmlTagNote}`
        : `${buildBasePrompt(char, true, contextInfo)}${contextInfo}${emoPrompt}用户在上述对话中@了你："${text}"。你必须回应，绝对不能输出"NO"或保持沉默。请紧扣前文对话直接输出回复内容（不超过${commentWordLimit}字。${WORD_LIMIT_PRIORITY_NOTE}）。若想使用表情，请附带 [EMO:对应ID]。${actionStrictRule}${inlineOwnerReinforcement}${htmlTagNote}`;
        
    try {
        // 🆕 识图：原帖的图、被回复那条评论的图、用户这条楼中楼回复顺手附的图，一起交给角色识别。
        const inlineReplyImages = [post.mediaUrl, targetReply && targetReply.mediaUrl, newReply.mediaUrl].filter(Boolean);
        const data = await callChatCompletionAPI(api, prompt, 2, inlineReplyImages.length > 0 ? inlineReplyImages : null);
        let repText = data.choices?.[0]?.message?.content?.trim() || "";
        // 去掉可能混进来的思维链前缀（比如<think>...</think>），评论只应该显示真正的回复内容。
        repText = stripLeadingReasoningBlocks(repText).rest.trim();
        // 有些模型不走标准思维链标签，直接把大段思考过程原样写在回复最前面——上面那步认不出来，
        // 这里做兜底：明显超长时只取最后一段当真正回复。
        repText = stripUndelimitedReasoningIfOverLength(repText, commentWordLimit);
        let repMediaUrl = null; let emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
        if (emoMatch) { let emo = globalEmoticons.find(e => e.id === emoMatch[1]); if (emo) repMediaUrl = emo.url; repText = repText.replace(emoMatch[0], '').trim(); }
        repText = stripLeftoverMarkers(repText); // 标记都解析完了，漏网的不许显示给用户（见 js/01）
        // 去掉AI偶尔自己加的首尾引号，再跑一遍该角色的"生成后处理"正则脚本——
        // 角色卡自带的状态栏/格式化HTML卡片就是靠这批脚本烘焙进正文的，评论回复也不例外。
        repText = repText.replace(/^["“]|["”]$/g, '').trim();
        repText = applyRegexScripts(repText, 'ai_output', char.id);

        if (!repText.toUpperCase().startsWith("NO") && repText !== "") {
            const charReplyId = 'r_' + Date.now() + Math.floor(Math.random()*100);
            if(isTabloid) {
                post.replies.push({ id: charReplyId, parentId: newReply.id, charId: char.id, name: char.name, text: repText, timestamp: Date.now() });
            } else {
                post.replies.push({ id: charReplyId, parentId: newReply.id, char: char, text: repText, timestamp: Date.now(), likes: 0, liked: false, likedBy: [], mediaUrl: repMediaUrl, replyTo: currentUser.name }); 
            }
            post.stats.comments++; 
            addNotification(`<b>${char.name}</b> 回复了您`, postId, null, char, repText); 
            if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
            saveAllData();
            if (isTabloid) { generateAutoNpcReaction(postId, char.name, repText, charReplyId); rollTabloidAIParticipation(postId, repText, char.name); }
            else if (Math.random() < npcReplyProb) spawnNpcComments(postId, false, { triggerName: char.name, triggerText: repText, triggerId: charReplyId });
        }
    } catch(e) {}
}
