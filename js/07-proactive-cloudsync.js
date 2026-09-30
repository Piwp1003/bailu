// ====== 新的主动发消息与后台唤醒逻辑 ======
let isProactiveChatRunning = false;

// 休息时间段判断：quietHoursStart/End 是 "HH:MM" 格式的本地时间，支持跨零点（比如 23:00 到 08:00）。
// 起止时间相同时视为没配置，不拦截（避免用户手滑把两个时间设成一样导致全天静音自己都不知道）。
function isInQuietHours() {
    if (!quietHoursEnabled || !quietHoursStart || !quietHoursEnd) return false;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = quietHoursStart.split(':').map(Number);
    const [eh, em] = quietHoursEnd.split(':').map(Number);
    if ([sh, sm, eh, em].some(n => isNaN(n))) return false;
    const startMin = sh * 60 + sm, endMin = eh * 60 + em;
    if (startMin === endMin) return false;
    if (startMin < endMin) return curMin >= startMin && curMin < endMin; // 同一天内，比如 13:00-15:00
    return curMin >= startMin || curMin < endMin; // 跨零点，比如 23:00-08:00
}

async function checkAndTriggerProactiveChats() {
    if (typeof isAutoOn === 'function' && !isAutoOn('proactiveChat')) return;   // 🔌 设置里关掉了「角色主动找你聊天」
    if (isInQuietHours()) return; // 休息时间段内，本地这条主动消息定时器直接不触发
    const api = getApiConfig(true); 
    if (!api.key || isProactiveChatRunning) return;
    
    let now = Date.now();
    // 找出需要发消息的角色
    let due = myCharacters.filter(char => {
        // 如果没设置频率，直接跳过
        const __ta = typeof gyTaCharOn === 'function' && gyTaCharOn(char, 'chatFreqInterval');
        if (!__ta && (!char.chatFreq || !char.chatFreq.interval || char.chatFreq.interval <= 0)) return false;
        
        // 计算间隔毫秒数（🎲 TA 定的话，用 TA 自己说的"下次隔多久"，见 js/53）
        let reqMs = __ta ? gyTaGapMs(char, 'chat', Infinity) : char.chatFreq.interval * (char.chatFreq.unit === 'minute' ? 60000 : char.chatFreq.unit === 'hour' ? 3600000 : 86400000);
        
        // 核心：直接去聊天记录里找“最后一句话”的时间
        let sessionId = String(char.id);
        let chatHistory = globalChats[sessionId] || [];
        
        let lastTime = now;
        if (chatHistory.length > 0) {
            // 获取聊天记录里最后一条消息的时间（不管是你发的还是TA发的）
            lastTime = chatHistory[chatHistory.length - 1].timestamp || now;
        } 
        
        // 如果之前因为网络报错没发成功，用上一次尝试的时间兜底，防止无限死循环报错
        lastTime = Math.max(lastTime, char.lastChatProactiveTime || 0);
        
        // 如果当前时间 减去 最后一句话的时间，大于设定的间隔，就触发！
        return (now - lastTime) >= reqMs;
    });

    if (due.length === 0) return;

    isProactiveChatRunning = true;
    // ⚠️ try/finally兜底：即使 sendProactiveChatMessage 内部万一还是漏了什么没接住的异常，
    // 这里也保证 isProactiveChatRunning 一定会复位，不会因为一次意外报错就让"主动聊天"这个
    // 功能永久失效（双重保险，sendProactiveChatMessage 内部本身也已经把拼装+请求都包进try/catch了）。
    try {
        for (let char of due.slice(0, 2)) {
            // 触发前，更新一下时间记录
            char.lastChatProactiveTime = now;
            await sendProactiveChatMessage(char);
            if (typeof gyTaAfter === 'function') gyTaAfter(char, 'chat');
        }
    } catch (e) {
        console.error('主动聊天流程异常中断：', e);
    } finally {
        isProactiveChatRunning = false;
    }
    saveAllData();
}

// ✉️ 角色主动写信（按letterFreq频率）：跟主动聊天是同一套"到点就触发"的思路，只是判断依据从
// "聊天记录最后一句话的时间"换成"上一封角色主动写的信的时间"（用户自己写的信、角色回信都不算"主动"，
// 不能拿来当作"最近写过信了"的凭据，不然设了主动写信频率也永远不会真正触发）。
let isProactiveLetterRunning = false;
async function checkAndTriggerProactiveLetters() {
    if (typeof isAutoOn === 'function' && !isAutoOn('proactiveLetter')) return;   // 🔌 设置里关掉了「角色主动给你写信」
    if (isInQuietHours()) return;
    const api = getApiMain();
    if (!api.key || isProactiveLetterRunning) return;
    if (typeof generateProactiveLetter !== 'function') return; // 定义在 js/08，防止加载顺序问题报错

    let now = Date.now();
    let due = myCharacters.filter(char => {
        const __ta = typeof gyTaCharOn === 'function' && gyTaCharOn(char, 'letterFreqInterval');
        if (!__ta && (!char.letterFreq || !char.letterFreq.interval || char.letterFreq.interval <= 0)) return false;
        let reqMs = __ta ? gyTaGapMs(char, 'letter', Infinity) : char.letterFreq.interval * (char.letterFreq.unit === 'minute' ? 60000 : char.letterFreq.unit === 'hour' ? 3600000 : 86400000);
        let letters = (char.diaryData && char.diaryData.letters) || [];
        let lastProactive = letters.find(l => l.author !== 'user' && !l.replyToId);
        let lastTime = lastProactive ? lastProactive.date : now;
        lastTime = Math.max(lastTime, char.lastLetterProactiveTime || 0);
        return (now - lastTime) >= reqMs;
    });

    if (due.length === 0) return;
    isProactiveLetterRunning = true;
    try {
        for (let char of due.slice(0, 2)) {
            char.lastLetterProactiveTime = now;
            await generateProactiveLetter(char);
            if (typeof gyTaAfter === 'function') gyTaAfter(char, 'letter');
        }
    } catch (e) {
        console.error('主动写信流程异常中断：', e);
    } finally {
        isProactiveLetterRunning = false;
    }
    saveAllData();
}

// ✉️ 用户写信之后，随机等待一段时间再收到角色回信（在设置里可以调"最短/最长等待时间"）；
// 🗒️ 用户写日记选角色偷看，角色决定要不要看、看了要不要批注，同样随机延迟一段时间再有反应。
// 这两个都定义在 js/08，这里只是到点了负责调用它们的"扫描+触发"逻辑，跟上面主动写信共用同一套定时器节奏。
async function checkAndTriggerLetterReplies() {
    if (typeof isAutoOn === 'function' && !isAutoOn('letterReply')) return;   // 🔌 设置里关掉了「信件到点自动回信」
    if (typeof resolveDueLetterReplies === 'function') await resolveDueLetterReplies();
}
async function checkAndTriggerDiaryReactions() {
    if (typeof isAutoOn === 'function' && !isAutoOn('diaryReaction')) return;   // 🔌 设置里关掉了「角色对你日记的反应」
    if (typeof resolveDueDiaryReactions === 'function') await resolveDueDiaryReactions();
}

function startProactiveChatTimer() {
    // 保留每20秒检查一次（用于你一直开着屏幕的时候）
    setInterval(checkAndTriggerProactiveChats, 20000);
    setInterval(checkAndTriggerProactiveLetters, 20000);
    setInterval(checkAndTriggerLetterReplies, 20000);
    setInterval(checkAndTriggerDiaryReactions, 20000);
}


// 🎯 黑科技 1：监听普通手机浏览器"从后台切回前台"
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible') {
        onAppForeground();
    } else {
        // 切到后台前，尽量把当前状态同步给云端Worker，让它在网页彻底不运行时也能接手判断
        if (typeof syncStateToCloud === 'function') syncStateToCloud(true);
    }
});

// 🎯 黑科技 2：监听 HBuilderX 打包的 APK "从后台唤醒"
document.addEventListener("plusready", () => {
    document.addEventListener("resume", () => {
        onAppForeground();
    }, false);
    // APK启动时就主动申请一次存储/媒体/相机权限，避免页面上没走openFilePickerForApp()的文件输入框
    // （比如头像、背景图上传）因为权限没提前申请到，导致系统选择器只剩"拍照"一个选项可用。
    if (typeof requestAllAppPermissionsOnLaunch === 'function') requestAllAppPermissionsOnLaunch();
});
// =====================================

// 手机后台时，系统会限流甚至暂停JS定时器和正在进行的请求，导致"挂后台就停止生成"——
// 这是安卓/WebView本身的省电机制，网页层面没法让后台无限期跑下去，只能在切回前台的
// 瞬间把该检查的都补一遍，尽量做到"回来就自动接上"，而不是干等着下一次触发。
function onAppForeground() {
    checkAndTriggerProactiveChats();
    checkAndTriggerProactiveLetters();
    checkAndTriggerLetterReplies();
    checkAndTriggerDiaryReactions();
    if (typeof checkAndFlowSchedules === 'function') checkAndFlowSchedules();
    // 如果正在看着某个聊天，回到前台时重新渲染一下，避免停留在挂起前的旧画面
    if (currentChatSessionId && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none') {
        renderChatMessages();
    }
    // 回到前台时，把云端Worker在网页关闭期间生成的消息/推文拉回来合并进本地记录
    if (typeof fetchPendingFromCloud === 'function') fetchPendingFromCloud();
}

// ====== 云端主动消息唤醒：与Cloudflare Worker同步 ======
// 把角色状态（人设/发消息与发推频率/最近聊天与推文记录）和API配置推送到云端，
// 让Worker能在网页彻底关闭/锁屏时，靠自己的定时器判断"到点该聊天/发推的角色"并生成+推送通知。
async function syncStateToCloud(force = false) {
    if (!cloudSyncEnabled || !cloudWorkerUrl || !cloudAuthToken) return;
    const now = Date.now();
    if (!force && now - lastCloudSyncTime < CLOUD_SYNC_MIN_INTERVAL) return;
    lastCloudSyncTime = now;

    try {
        const api = getApiConfig(true); // 优先用副API（和本地"主动发消息"用的是同一个配置）
        // 同步全部角色（不只是设了聊天/发推频率的）：围观反应和私下互动这两个功能需要能从任意角色里挑人
        const characters = (myCharacters || []).map(char => {
            const hasChat = char.chatFreq && char.chatFreq.interval > 0;
            const hasPost = char.postFreq && char.postFreq.interval > 0;
            const sessionId = String(char.id);
            const history = hasChat ? (globalChats[sessionId] || []).slice(-8).map(m => ({
                sender: m.sender === char.id ? 'char' : 'user',
                text: (m.text || '').slice(0, 300),
                timestamp: m.timestamp,
            })) : [];
            const recentPosts = hasPost ? (globalPosts || [])
                .filter(p => p.char && p.char.id === char.id)
                .slice(-6)
                .map(p => ({ text: (p.text || '').slice(0, 300), timestamp: p.timestamp })) : [];
            return {
                id: char.id,
                name: char.name,
                persona: (char.persona || '').slice(0, 1200),
                chatFreq: char.chatFreq,
                lastChatProactiveTime: char.lastChatProactiveTime || 0,
                recentHistory: history,
                postFreq: char.postFreq,
                lastPostTime: char.lastPostTime || 0,
                recentPosts: recentPosts,
            };
        });

        if (characters.length === 0) return;

        // 私下互动需要的关系数据（全局 charRelationships：fromId/toId/label）
        const relationships = (charRelationships || []).map(r => ({ fromId: r.fromId, toId: r.toId, label: r.label }));
        const charInteractionEnabled = typeof isGlobalCharInteractionEnabled === 'function' ? isGlobalCharInteractionEnabled() : false;
        const charInteractionNotify = document.getElementById('settingNotifyCharInteraction')?.checked ?? (localStorage.getItem('settingNotifyCharInteraction') !== 'false');

        await fetch(`${cloudWorkerUrl}/sync`, {
            method: 'POST',
            keepalive: true, // 允许在页面切后台/关闭的瞬间也能把请求发出去
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cloudAuthToken}` },
            body: JSON.stringify({ apiUrl: api.url, apiKey: api.key, model: api.model, ntfyTopic, characters, relationships, charInteractionEnabled, charInteractionNotify, quietHoursEnabled, quietHoursStart, quietHoursEnd, tzOffsetMin: new Date().getTimezoneOffset() }),
        });
    } catch (e) {
        // ⚠️ 别用 console.error：云同步是**每次切页都会跑**的后台任务，Worker 没起来/地址填错时
        //    它每次都失败，日志里会刷出几十条红字，把真正要看的错误全冲走了
        //    （你贴的那条 "Failed to fetch" 就是这么来的）。
        //    改成：同一个原因只提醒一次，之后只在控制台留一行灰字。
        const why = String((e && e.message) || e);
        if (window.__gyCloudLastErr !== why) {
            window.__gyCloudLastErr = why;
            console.warn('[云同步] 连不上，之后同样的错误不再重复打印：', why,
                '\n（这不影响本地使用；不需要云同步的话去 设置 → ☁️ 云同步 关掉它。）');
            if (typeof showToast === 'function') {
                showToast('', '☁️ 云同步连不上', '不影响本地使用。不用的话可以在设置里关掉。', null, null, false);
            }
        }
    }
}

// 从云端拉取"网页关闭期间，Worker已经生成好的消息/推文"，合并进本地记录，避免重复触发
async function fetchPendingFromCloud() {
    if (!cloudSyncEnabled || !cloudWorkerUrl || !cloudAuthToken) return;
    try {
        const res = await fetch(`${cloudWorkerUrl}/pending`, {
            headers: { 'Authorization': `Bearer ${cloudAuthToken}` },
        });
        const data = await res.json();
        const pending = data.pending || [];
        if (pending.length === 0) return;

        const consumedIds = [];
        let postsAdded = false;
        const pendingIdToPostId = {}; // Worker给"post"这条消息分配的临时id -> 本地生成的post.id，供同一批次里的post_reaction找到目标帖子

        for (const item of pending) {
            if (item.type === 'interaction') {
                // 私下互动：更新两个角色的状态气泡，不涉及聊天记录/推文
                const charA = myCharacters.find(c => c.id === item.charAId || String(c.id) === String(item.charAId));
                const charB = myCharacters.find(c => c.id === item.charBId || String(c.id) === String(item.charBId));
                if (charA && charB) {
                    if (typeof saveCharLifeState === 'function') {
                        saveCharLifeState(charA, item.charAStatus, '私下互动');
                        saveCharLifeState(charB, item.charBStatus, '私下互动');
                    }
                    const notifyEnabled = document.getElementById('settingNotifyCharInteraction')?.checked ?? (localStorage.getItem('settingNotifyCharInteraction') !== 'false');
                    if (notifyEnabled) {
                        const msg = `👀 发现私下互动：${charA.name} 和 ${charB.name} ${item.eventSummary || '正在互动'}！`;
                        if (typeof showToast === 'function') showToast(msg); else alert(msg);
                    }
                }
                consumedIds.push(item.id);
                continue;
            }

            if (item.type === 'post_reaction') {
                // 围观反应：给某条云端生成的推文补一个点赞或评论
                const localPostId = pendingIdToPostId[item.targetPendingId];
                const post = localPostId ? globalPosts.find(p => p.id === localPostId) : null;
                const reactor = myCharacters.find(c => c.id === item.reactorId || String(c.id) === String(item.reactorId));
                if (post && reactor) {
                    if (item.kind === 'like') {
                        post.stats.likes = (parseInt(post.stats.likes) || 0) + 1;
                        if (!post.likedBy) post.likedBy = [];
                        if (!post.likedBy.includes(reactor.id)) post.likedBy.push(reactor.id);
                    } else if (item.kind === 'comment' && item.text) {
                        post.replies.push({ id: 'r_' + item.timestamp + Math.floor(Math.random() * 100), parentId: null, char: reactor, text: item.text, timestamp: item.timestamp, likes: 0, liked: false, likedBy: [] });
                        post.stats.comments = (post.stats.comments || 0) + 1;
                    }
                    postsAdded = true;
                }
                consumedIds.push(item.id);
                continue;
            }

            const char = myCharacters.find(c => c.id === item.charId || String(c.id) === String(item.charId));
            if (!char) { consumedIds.push(item.id); continue; }

            if (item.type === 'post') {
                // 云端生成的推文：拼成本地帖子结构塞进feed里
                // 防重复：如果ack请求之前失败过，Worker那边队列没清掉，同一条会被再次拉到，这里做个去重
                const dupPost = globalPosts.find(p => p.char && p.char.id === char.id && p.timestamp === item.timestamp && p.text === item.text);
                if (dupPost) { consumedIds.push(item.id); continue; }
                const post = {
                    id: 'p_' + item.timestamp + Math.floor(Math.random() * 1000),
                    char: char,
                    text: item.text,
                    timestamp: item.timestamp,
                    replies: [],
                    mediaUrl: null,
                    stats: { retweets: getRandomStat ? getRandomStat(1000) : 0, likes: getRandomStat ? getRandomStat(5000) : 0, views: getRandomStat ? getRandomStat(50000) : 0, comments: 0 },
                    isStory: false, location: '',
                };
                globalPosts.unshift(post);
                char.lastPostTime = Math.max(char.lastPostTime || 0, item.timestamp);
                postsAdded = true;
                pendingIdToPostId[item.id] = post.id;

                // 通知带 id / charId / desc，弹窗带着这条通知：点弹窗、点通知页都跳到这条推文
                gyPushNotif({ text: `<b>${char.name}</b> 发布了新推文`, postId: post.id, chatCharId: null, timestamp: item.timestamp, charId: String(char.id), desc: String(item.text || '').slice(0, 200) },
                    { avatar: typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 80) : '', title: `${char.name} 发布了新推文`, desc: item.text });
            } else {
                // 默认当聊天消息处理（老数据没有type字段的兜底）
                const sessionId = String(char.id);
                if (!globalChats[sessionId]) globalChats[sessionId] = [];
                // 防重复：如果ack请求之前失败过，Worker那边队列没清掉，同一条会被再次拉到，这里做个去重
                const dupChat = globalChats[sessionId].some(m => m.timestamp === item.timestamp && m.text === item.text);
                if (dupChat) { consumedIds.push(item.id); continue; }
                globalChats[sessionId].push({ sender: char.id, text: item.text, timestamp: item.timestamp, readBy: [] });

                // 推进本地的"上次主动发消息时间"，避免网页打开后本地定时器把同一轮再触发一次
                char.lastChatProactiveTime = Math.max(char.lastChatProactiveTime || 0, item.timestamp);

                if (currentChatSessionId === sessionId && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none') {
                    if (typeof renderChatMessages === 'function') renderChatMessages();
                } else {
                    gyPushNotif({ text: `<b>${char.name}</b> 给您发来消息`, postId: null, chatCharId: sessionId, timestamp: item.timestamp, charId: String(char.id), desc: String(item.text || '').slice(0, 200) },
                        { avatar: typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 80) : '', title: `${char.name} 发来消息`, desc: item.text });
                    if (typeof renderChatCharList === 'function') renderChatCharList();
                }
            }
            consumedIds.push(item.id);
        }

        if (postsAdded && typeof renderPosts === 'function') renderPosts();
        saveAllData();

        // 告诉Worker这些消息已经拿到手了，清掉云端队列
        await fetch(`${cloudWorkerUrl}/ack`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cloudAuthToken}` },
            body: JSON.stringify({ ids: consumedIds }),
        });
    } catch (e) {
        console.error('拉取云端消息失败：', e);
    }
}

async function sendProactiveChatMessage(char) {
    const api = getApiConfig(true);
    if (!api.key) return;

    // ⚠️ 防御修复：prompt拼装（buildBasePrompt等）之前写在try外面，一旦某个角色的世界书/预设数据
    // 触发异常就会直接抛出未捕获的异常，导致调用方 checkAndTriggerProactiveChats 里的
    // isProactiveChatRunning 卡在true、此后所有角色的主动消息全部被静默挡住（跟推文那边同一类问题）。
    // 现在整段拼装也纳入下面的 try/catch 保护范围。
    try {
        let sessionId = String(char.id);
        if (!globalChats[sessionId]) globalChats[sessionId] = [];

        let recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns), char.name);
        let emoPrompt = getEmoticonPrompt();
        let actionTagReminder = allowActionTags
            ? `\n【重要格式要求】：你可以且应该适度使用括号（如()或【】）穿插动作、神态、心理描写，让对话更有画面感——这和"像真人一样自然聊天"并不冲突。\n`
            : `\n【重要格式要求】：绝对不要有任何动作、神态或心理描写，不要使用括号()或【】，只输出你直接说出的话。\n`;

        let prompt = `${buildBasePrompt(char, true, recentHistory)}${getRecentPostsAwarenessText(char)}${getTimeAwarenessPrompt(sessionId, char)}${getChatNaturalnessPrompt()}
以下是你们最近的聊天记录（每条前面的[时间标记]是真实发出时间，不是现在；时间是持续流动的，不要把很久以前的事当成刚发生的）：
${recentHistory || '(暂无记录)'}
现在，请主动找用户开启一次对话。优先考虑聊你自己感兴趣、最近在琢磨的新鲜事（结合你的兴趣列表和人设），而不是重复或延续之前已经聊完的旧话题；只有当你的兴趣里确实没什么可聊、或者上次的话题明显没聊完时，才继续之前的话题。
你可以通过输出 [NUDGE] 主动拍一拍用户。
${emoPrompt}
${actionTagReminder}
${getChatMultiReplyBlock()}${(typeof window.gyChatActsPrompt === 'function') ? window.gyChatActsPrompt(char, false) : ''}`;

        let data = await sendChatRequest(api, prompt);
        if (data.error) return;

        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        let replies = [];
        try {
            let parsed = extractJsonObject(rawText);
            if (!parsed) throw new Error("No JSON object found");
            runPluginResponseHooks(char, sessionId, parsed); // 插件系统：好感度/日程联动等行为现在由插件接管
            if (parsed.stateUpdate) saveCharLifeState(char, parsed.stateUpdate, parsed.statusTypeLabel);
            if (typeof aliveCaptureMood === 'function') aliveCaptureMood(char, parsed);   // 🫀 情绪惯性
            if (parsed.replies && Array.isArray(parsed.replies) && parsed.replies.length > 0) replies = parsed.replies;
            else if (parsed.stateUpdate) replies = [{ delay: 1, text: `(${parsed.stateUpdate})` }];
            else throw new Error("Invalid structure");   // 交给下面的兜底，别静悄悄什么都不发
        } catch (err) {
            // 🐛 这里以前只调 processReasoningInText(rawText)——它只剥思维链标签，**不剥 ``` 代码围栏**，
            // 所以模型一旦把 JSON 包在 ```json ... ``` 里返回而上面又解析失败，整段原文（连 ```json 那一行）
            // 就原样变成一条聊天消息发出来了。截图里那坨 JSON 就是从这条路出来的。
            // 换成 unwrapAiEnvelopeText：剥思维链 + 剥围栏 + 认得出 JSON 信封就把里面的话取出来。
            replies = [{ delay: 1, text: unwrapAiEnvelopeText(rawText) }];
        }
        if (replies.length === 0) return;

        for (let replyObj of replies) {
            let repText = replyObj.text || "";
            let delaySec = replyObj.delay || 1;

            if (!repText || (repText.toUpperCase().startsWith("NO") && repText.length < 5)) continue;

            // 核心：主动发消息时的打字停顿感
            if (delaySec > 0) {
                if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') {
                    currentlyTypingChars.add(char.name); updateTypingIndicator();
                }
                await new Promise(r => setTimeout(r, delaySec * 1000));
                currentlyTypingChars.delete(char.name); updateTypingIndicator();
            }

            let repMediaUrl = null; 
            let emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
            if (emoMatch) { 
                let emo = globalEmoticons.find(e => e.id === emoMatch[1]); 
                if (emo) repMediaUrl = emo.url; 
                repText = repText.replace(emoMatch[0], '').trim(); 
            }
            
            // 💬 说到做到（js/52）：主动找你的时候说"我给你打个电话"也一样会真的打
            let __acts = [];
            if (typeof window.gyChatActsExtract === 'function') { const __ex = window.gyChatActsExtract(repText, char); repText = __ex.text; __acts = __ex.acts; }
            if (__acts.length && typeof window.gyChatActsRun === 'function') setTimeout(() => { try { window.gyChatActsRun(char, sessionId, __acts); } catch (e) {} }, 300);

            if (repText.includes("[NUDGE]")) {
                repText = repText.replace(/\[NUDGE\]/ig, '').trim();
                globalChats[sessionId].push({ sender: 'system', text: `"${char.name}" 拍了拍 "${currentUser.name}" ${currentUser.nudgeText || '的脑袋'}`, timestamp: Date.now() });
            }

            // 主动发消息这条路子之前漏了正则脚本/MVU变量补丁处理（跟聊天页主回复流程不是同一份代码，
            // 之前各自维护漏掉了同步）——角色卡挂的预设一样会让AI在主动找茬聊天时也带上状态栏JSON块，
            // 不补这一步的话，主动消息里的状态栏JSON就没法隐藏、也不会更新到状态树上。
            repText = applyRegexScripts(repText, 'ai_output', char.id);
            const mvuResult = processMvuPatchInText(repText, sessionId);
            repText = mvuResult.cleanText;

            // 📷 主动找你说话的时候也能发图（js/42）。跟聊天页那条路走同一套。
            let __photoDesc = '', __photoSelf = false;
            try {
                if (typeof window.gyPhotoScan === 'function') {
                    const r0 = window.gyPhotoScan(repText);
                    repText = r0.text; __photoDesc = r0.desc; __photoSelf = r0.self;
                }
            } catch (e) {}

            if (repText || repMediaUrl) {
                globalChats[sessionId].push({ sender: char.id, text: repText, timestamp: Date.now(), mediaUrl: repMediaUrl, readBy: [], mvuSnapshot: mvuResult.snapshot });
                try { const __sf = (typeof gyFindStatusSegment === 'function') ? gyFindStatusSegment(repText, char.id) : null; if (__sf && typeof gyStatusLogAdd === 'function') gyStatusLogAdd(char, { seg: __sf.seg, src: 'chat' }); } catch (e) {}
                
                if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') { 
                    renderChatMessages(); 
                } else {
                    gyPushNotif({ text: `<b>${char.name}</b> 给您发来消息`, postId: null, chatCharId: sessionId, charId: String(char.id), desc: String(repText || '').slice(0, 200) },
                        { avatar: getAvatarHTML(char, 80), title: `${char.name} 发来消息`, desc: repText || "[图片/表情/拍一拍]" });
                    renderChatCharList();
                }
                saveAllData(); checkAndAutoSummarizeChat(sessionId);
            }
            if (__photoDesc && typeof window.gyPhotoFromReply === 'function') {
                try { window.gyPhotoFromReply(char.id, sessionId, __photoDesc, __photoSelf); } catch (e) {}
            }
        }
    } catch(e) { console.error("主动发送消息网络请求失败:", e); }
}

document.addEventListener('click', () => {
    document.getElementById('customContextMenu').style.display = 'none';
    document.getElementById('chatContextMenu').style.display = 'none';
    document.getElementById('novelContextMenu').style.display = 'none';
    const storyMenu = document.getElementById('ssTurnContextMenu');
    if (storyMenu) storyMenu.style.display = 'none';
});

function showFollowingContextMenu(e, charId) {
    e.preventDefault(); e.stopPropagation();
    suppressCardClickUntil = Date.now() + 500; // 抑制紧随长按而来的幽灵 click，防止菜单被瞬间关闭/卡片被误触跳转
    contextMenuTargetId = charId; const char = myCharacters.find(c => c.id == charId); if(!char) return;
    const menu = document.getElementById('customContextMenu'); document.getElementById('ctxBtnStar').innerText = char.isSpecialFollow ? "取消星标" : "特别关注⭐";
    menu.style.display = 'flex'; let x = e.pageX, y = e.pageY; if(x + 160 > window.innerWidth) x -= 160; if(y + 100 > window.innerHeight) y -= 100; menu.style.left = x + 'px'; menu.style.top = y + 'px';
}

// 修复：已关注角色右键(长按)菜单——把跳转个人页的点击和弹出菜单的长按拆开，避免互相打断
function handleFollowingCardClick(e, charId) {
    if (Date.now() < suppressCardClickUntil) { e.stopPropagation(); return; }
    switchMainView('profile', charId);
}

let contextNovelId = null;
function showNovelContextMenu(e, id) {
    e.preventDefault();
    contextNovelId = id;
    const menu = document.getElementById('novelContextMenu');
    menu.style.display = 'flex'; 
    let x = e.pageX, y = e.pageY; 
    if(x + 150 > window.innerWidth) x -= 150; 
    if(y + 100 > window.innerHeight) y -= 100; 
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
}
function contextActionExportNovel() {
    if(!contextNovelId) return;
    const novel = globalNovels.find(n => n.id === contextNovelId);
    if(!novel) return;
    let txt = `《${novel.title || '未命名故事'}》\n\n【故事大纲】\n${novel.outline || '无'}\n\n`;
    novel.chapters.forEach(c => { txt += `=== 第 ${c.index} 章 ===\n${c.content}\n\n`; });
    saveTextFileForApp(`${(novel.title || '未命名故事').replace(/[\\/:*?"<>|]/g, "_")}.txt`, txt, 'text/plain');
    document.getElementById('novelContextMenu').style.display = 'none';
}
async function contextActionDeleteNovel() {
    if(!contextNovelId) return;
    if(await appConfirm('警告：确定要删除这部故事及所有章节吗？操作不可逆！')) {
        globalNovels = globalNovels.filter(n => n.id !== contextNovelId);
        saveAllData(); renderNovelList();
    }
    document.getElementById('novelContextMenu').style.display = 'none';
}

function contextActionStar() { if(!contextMenuTargetId) return; let char = myCharacters.find(c => c.id == contextMenuTargetId); if(char) { char.isSpecialFollow = !char.isSpecialFollow; renderFollowingList(); saveAllData(); } }
function contextActionUnfollow() { if(!contextMenuTargetId) return; let char = myCharacters.find(c => c.id == contextMenuTargetId); if(char) { char.isFollowing = false; char.isSpecialFollow = false; updateAllFollowButtons(char.id, false); renderFollowingList(); saveAllData(); } }

function toggleFollow(charId, event) {
    if (event) event.stopPropagation(); 
    let char = charId === 'tabloid_admin' ? tabloidAccount : myCharacters.find(c => c.id == charId);
    if (char) {
        char.isFollowing = !char.isFollowing; 
        updateAllFollowButtons(char.id, char.isFollowing); 
        saveAllData(); 
        if (document.getElementById('view-following-list').style.display !== 'none') {
            renderFollowingList();
        }
    }
}

function updateAllFollowButtons(charId, isFollowing) { document.querySelectorAll(`.btn-follow-${charId}`).forEach(btn => { btn.className = isFollowing ? `follow-btn following btn-follow-${charId}` : `follow-btn btn-follow-${charId}`; btn.innerText = isFollowing ? "已关注" : "关注"; }); }

function editPost(postId, el) {
    let post = globalPosts.find(p => p.id == postId); if (!post || el.querySelector('textarea')) return;
    el.innerHTML = `<textarea id="edit-post-input-${postId}" style="width:100%; min-height:80px; font-family:inherit; font-size:15px; padding:10px; border:1px solid #1d9bf0; border-radius:8px; outline:none; margin-bottom:8px; background:rgba(255,255,255,0.8);" onclick="event.stopPropagation()">${post.text}</textarea><div style="display:flex; align-items:center; gap:8px;">${locationSVG}<input type="text" id="edit-post-loc-${postId}" value="${post.location || ''}" placeholder="自定义定位名称 (选填)" style="flex:1; padding:6px 10px; border:1px solid #1d9bf0; border-radius:8px; outline:none; font-size:13px; background:rgba(255,255,255,0.8);" onclick="event.stopPropagation()"></div><div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;"><button class="btn-edit-small" onclick="savePostEdit('${postId}', event)">保存修改</button><button class="btn-edit-small" style="color:#536471; border-color:#cfd9de;" onclick="cancelPostEdit('${postId}', event)">取消</button></div>`;
}
function savePostEdit(postId, e) {
    e.stopPropagation(); let post = globalPosts.find(p => p.id == postId); 
    if (post) { post.text = document.getElementById(`edit-post-input-${postId}`).value; post.location = document.getElementById(`edit-post-loc-${postId}`).value.trim(); }
    saveAllData(); if (typeof renderPosts === "function" && document.getElementById('view-home').style.display !== 'none') renderPosts(); if (typeof renderProfileFeed === "function" && document.getElementById('view-profile').style.display !== 'none') renderProfileFeed(); if (typeof renderSinglePostDetail === "function" && document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
}
function cancelPostEdit(postId, e) {
    e.stopPropagation(); if (typeof renderPosts === "function" && document.getElementById('view-home').style.display !== 'none') renderPosts(); if (typeof renderProfileFeed === "function" && document.getElementById('view-profile').style.display !== 'none') renderProfileFeed(); if (typeof renderSinglePostDetail === "function" && document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
}
async function deletePost(postId, event) {
    event.stopPropagation();
    if(await appConfirm('确定要删除这条帖子吗？该操作不可逆！')) { globalPosts = globalPosts.filter(p => p.id != postId); saveAllData(); if(typeof renderPosts === "function" && document.getElementById('view-home').style.display !== 'none') renderPosts(); if(typeof renderProfileFeed === "function" && document.getElementById('view-profile').style.display !== 'none') renderProfileFeed(); }
}

function hideAllViews() {
    ['home','profile','tag','search','notifications','post-detail','following-list','chat','anon-forum','diary','novel','theater','story-studio','tabloid','mobile-trends','faction-network','faction-members','char-relations','faction-overview','memory-album','character-center','settings','worldbook','plugins','presets','ai-enhance','memory-hub','watch-together','mini-hub','grapevine','mall','feature-page'].forEach(v => { const el = document.getElementById(`view-${v}`); if(el) el.style.display = 'none'; });
    ['nav-home','nav-following','nav-notif','nav-myprofile','nav-chat','nav-anon','nav-diary','nav-novel','nav-storystudio','nav-tabloid','nav-faction','nav-memoryhub','nav-minihub','nav-grapevine'].forEach(id => { const el = document.getElementById(id); if(el) el.className = 'nav-item'; });
    ['mnav-home','mnav-notif','mnav-chat','mnav-search'].forEach(id => { const el = document.getElementById(id); if(el) el.className = 'mnav-item'; });
    document.getElementById('rightPanelTrend').style.display = 'block'; document.getElementById('rightPanelProfile').style.display = 'none';
}

const mobileViewTitles = { home:'主页', anonForum:'匿名论坛', diary:'信件与日记', novel:'故事', theater:'Ta们在做什么', storyStudio:'续写', tabloid:'营销号', profile:'个人资料', tag:'标签', search:'全站搜索', notifications:'通知', postDetail:'帖子', followingList:'我的关注', chat:'聊天', factionNetwork:'势力关系网', factionMembers:'势力成员', charRelations:'角色关系', factionOverview:'势力总览', characterCenter:'角色中心', settings:'系统设置', worldbook:'世界书', plugins:'插件', presets:'预设', 'ai-enhance':'AI增强功能', memoryHub:'记忆总览', watchTogether:'一起看电影', miniHub:'小功能', grapevine:'日常' };

function switchMainView(viewId, param = null) {
    pushViewHistory(viewId);
    hideAllViews();
    closeDrawer();
    // ➕ 那个"发帖/生成"悬浮按钮以前在**每一页**都飘着，包括设置页、世界书、插件、记忆总览
    // ——那些页面根本没有"发帖"这回事，它只是浮在右下角挡住内容（实测挡住了开关面板里的
    // 「全开/全关」）。这些页面里直接收起来。
    try {
        const fab = document.getElementById('fabPost');
        if (fab) fab.style.display = ['settings', 'worldbook', 'plugins', 'presets', 'ai-enhance', 'memoryHub', 'chat', 'watchTogether', 'miniHub', 'mall', 'featurePage'].includes(viewId) ? 'none' : '';
    } catch (e) {}
    // 手机顶栏中间显示当前页面名。这里的 id 以前写成 mobileTopTitle（元素其实叫 mtbCenterTitle），
    // 拿到的永远是 null，加上有 if 判空所以不报错——顶栏标题就一直是空的，谁也没发现。
    const mSearchCenter = document.getElementById('mtbCenterSearch'), mTitleCenter = document.getElementById('mtbCenterTitle');
    if (mTitleCenter) mTitleCenter.innerText = mobileViewTitles[viewId] || '白露';
    // 搜索框开着的时候让位给搜索框，否则把标题显示出来（它在 index.html 里初始是 display:none）
    if (mSearchCenter && mSearchCenter.style.display !== 'none') { mSearchCenter.style.display = 'none'; }
    if (mTitleCenter) mTitleCenter.style.display = 'flex';
    // 手机端通用返回键：主页不需要（没有"上一页"可回），其它页面都显示
    const mBack = document.getElementById('mtbBackBtn');
    if (mBack) mBack.style.display = (viewId === 'home') ? 'none' : 'flex';
    if (viewId === 'home') { document.getElementById('view-home').style.display = 'block'; document.getElementById('nav-home').className = 'nav-item active'; const m=document.getElementById('mnav-home'); if(m) m.className='mnav-item active'; if(typeof renderPosts === 'function') renderPosts(); }
    else if (viewId === 'anonForum') { document.getElementById('view-anon-forum').style.display = 'block'; document.getElementById('nav-anon').className = 'nav-item active'; if(typeof renderAnonPosts === 'function') renderAnonPosts(); }
    else if (viewId === 'diary') { document.getElementById('view-diary').style.display = 'block'; document.getElementById('nav-diary').className = 'nav-item active'; renderDiaryCharList(); }
    else if (viewId === 'novel') { document.getElementById('view-novel').style.display = 'block'; document.getElementById('nav-novel').className = 'nav-item active'; renderNovelList(); }
    // ⚠️ 下面这 7 条（个人资料 / 话题 / 搜索 / 通知 / 帖子详情 / 我的关注 / 聊天）v101 补回来的。
    //    v100 合并「日常」时，删 tabloid 分支的那次替换把从 tabloid 一直到 chat 的整段一起吃掉了，
    //    结果这几页全都命中不了任何分支，被末尾那段"谁都没显示就退回主页"的兜底接走——
    //    表现就是点侧栏「聊天」「通知」「个人资料」都跳回主页，而且不报错。
    //    （clickall 那套测试也抓不到：兜底不抛异常，点了确实"有反应"，只是反应错了。）
    else if (viewId === 'profile') { document.getElementById('view-profile').style.display = 'block'; if(param === 'me') document.getElementById('nav-myprofile').className = 'nav-item active'; renderProfilePage(param); }
    else if (viewId === 'tag') { document.getElementById('view-tag').style.display = 'block'; document.getElementById('currentTagTitle').innerText = param; if(typeof renderPosts === 'function') renderPosts(param); }
    else if (viewId === 'search') { document.getElementById('view-search').style.display = 'block'; document.getElementById('currentSearchTitle').innerText = param; document.getElementById('globalSearchInput').value = ''; const m=document.getElementById('mnav-search'); if(m) m.className='mnav-item active'; if(typeof renderSearchPosts === 'function') renderSearchPosts(param); }
    else if (viewId === 'notifications') { document.getElementById('view-notifications').style.display = 'block'; document.getElementById('nav-notif').className = 'nav-item active'; const m=document.getElementById('mnav-notif'); if(m) m.className='mnav-item active'; unreadNotifs = 0; if(typeof updateNotifBadge === 'function') updateNotifBadge(); if(typeof renderNotifications === 'function') renderNotifications(); }
    else if (viewId === 'postDetail') { document.getElementById('view-post-detail').style.display = 'block'; if(typeof renderSinglePostDetail === 'function') renderSinglePostDetail(param); }
    else if (viewId === 'followingList') { document.getElementById('view-following-list').style.display = 'block'; document.getElementById('nav-following').className = 'nav-item active'; renderFollowingList(); }
    else if (viewId === 'chat') {
        document.getElementById('view-chat').style.display = 'flex'; document.getElementById('nav-chat').className = 'nav-item active'; const m=document.getElementById('mnav-chat'); if(m) m.className='mnav-item active'; renderChatCharList();
        if(!currentChatSessionId && myCharacters.length>0) switchChatSession(myCharacters[0].id); else if(currentChatSessionId) renderChatMessages();
    }
    // （'theater' 和 'tabloid' 的分支已经并进上面的「日常」里了）
    else if (viewId === 'storyStudio') { document.getElementById('view-story-studio').style.display = 'block'; const nav = document.getElementById('nav-storystudio'); if (nav) nav.className = 'nav-item active'; if (typeof renderStoryStudio === 'function') renderStoryStudio(); }
    // ⚠️ nav-faction 这一行从侧边栏拿掉了（关系网搬进了小功能），所以这里必须判空——
    // 不判的话点一次关系网就是一个 TypeError，整个 switchMainView 断在这儿，页面卡住不动。
    else if (viewId === 'factionNetwork') { document.getElementById('view-faction-network').style.display = 'block'; const nvF = document.getElementById('nav-faction'); if (nvF) nvF.className = 'nav-item active'; renderFactionNetworkGrid(); }
    else if (viewId === 'factionMembers') { document.getElementById('view-faction-members').style.display = 'block'; renderFactionMembersGrid(param); }
    else if (viewId === 'charRelations') { document.getElementById('view-char-relations').style.display = 'block'; renderCharRelationsView(param); }
    else if (viewId === 'factionOverview') { document.getElementById('view-faction-overview').style.display = 'block'; renderFactionOverviewList(); }
    else if (viewId === 'characterCenter') {
        document.getElementById('view-character-center').style.display = 'block';
        const nav = document.getElementById('nav-charcenter'); if (nav) nav.className = 'nav-item active';
        refreshGroupFilterBar(); refreshGroupSelect(); renderCenterCharList(); renderStatusTypesList();
        document.getElementById('characterListView').style.display = 'block';
        document.getElementById('characterFormView').style.display = 'none';
    }
    else if (viewId === 'settings') {
        document.getElementById('view-settings').style.display = 'block';
        // 每次进设置页都回到目录：上次停在哪一张分页跟这次要找什么没关系，
        // 直接把目录摆出来比"接着上次"更好找。
        if (typeof closeSettingsPanel === 'function') closeSettingsPanel();
        if(typeof renderCharReplyToggleList === 'function') renderCharReplyToggleList();
        if(typeof renderRegexScriptsList === 'function') renderRegexScriptsList();
    }
    else if (viewId === 'worldbook') {
        document.getElementById('view-worldbook').style.display = 'flex';
        if(typeof refreshWbCategorySelect === 'function') refreshWbCategorySelect();
        if(typeof renderWorldbookCards === 'function') renderWorldbookCards();
    }
    else if (viewId === 'plugins') {
        document.getElementById('view-plugins').style.display = 'block';
        populatePluginScopeSelect();
        renderPluginsList();
    }
    else if (viewId === 'presets') {
        document.getElementById('view-presets').style.display = 'block';
        const nav = document.getElementById('nav-presets'); if (nav) nav.className = 'nav-item active';
        renderPresetsPage();
    }
    else if (viewId === 'ai-enhance') {
        document.getElementById('view-ai-enhance').style.display = 'block';
        renderRegexScriptsList();
        if (typeof renderReasoningFormatsList === 'function') renderReasoningFormatsList();
    }
    else if (viewId === 'memoryHub') {
        document.getElementById('view-memory-hub').style.display = 'block';
        const nav = document.getElementById('nav-memoryhub'); if (nav) nav.className = 'nav-item active';
        const chatIntEl = document.getElementById('memHubChatSummaryInterval'); if (chatIntEl) chatIntEl.value = chatSummaryInterval;
        const groupIntEl = document.getElementById('memHubGroupSummaryInterval'); if (groupIntEl) groupIntEl.value = groupSummaryInterval;
        const postIntEl = document.getElementById('memHubPostMemoryInterval'); if (postIntEl) postIntEl.value = postMemoryInterval;
        const schKeepEl = document.getElementById('memHubScheduleKeep'); if (schKeepEl) schKeepEl.value = (typeof scheduleHistoryKeep === 'number' ? scheduleHistoryKeep : 14);
        const stKeepEl = document.getElementById('memHubStatusKeep'); if (stKeepEl && typeof statusLogKeepDays !== 'undefined') stKeepEl.value = statusLogKeepDays;
        const thKeepEl = document.getElementById('memHubTheaterKeep'); if (thKeepEl) thKeepEl.value = (typeof theaterLogKeep === 'number' ? theaterLogKeep : 0);
        if (typeof renderMemoryHubTargetOptions === 'function') renderMemoryHubTargetOptions();
    }

    // 🕸️ 日常：小剧场 / 八卦网 / 营销号 三合一。
    //    'theater' 和 'tabloid' 这两个老 viewId 全部重定向到这儿的对应 tab——
    //    代码里到处都有 switchMainView('theater')，一个个改容易漏，重定向最稳。
    else if (viewId === 'grapevine' || viewId === 'theater' || viewId === 'tabloid') {
        const el = document.getElementById('view-grapevine');
        if (el) el.style.display = 'block';
        const nav = document.getElementById('nav-grapevine'); if (nav) nav.className = 'nav-item active';
        if (typeof gyGrapevineTab === 'function') {
            gyGrapevineTab(viewId === 'tabloid' ? 'tabloid' : viewId === 'theater' ? 'theater'
                : (typeof gyGrapevineTab_ !== 'undefined' ? gyGrapevineTab_ : 'theater'));
        }
    }

    // 🧩 小功能：以前是设置里的一个分页，现在是侧边栏的独立页面
    else if (viewId === 'miniHub') {
        const el = document.getElementById('view-mini-hub');
        if (el) el.style.display = 'block';
        const nav = document.getElementById('nav-minihub'); if (nav) nav.className = 'nav-item active';
        if (typeof renderMiniFeaturePanel === 'function') renderMiniFeaturePanel();
    }

    // 🎬 一起看电影（js/21 建的页面）。必须在这儿有个正式分支——
    //    以前是靠 js/21 自己 patch switchMainView 在事后把页面显示出来，
    //    结果下面那段兜底先跑（那时候一个页面都还没显示），把主页也放了出来，
    //    于是主页的时间线跟播放器叠在了一起（实测截图里两个都在）。
    else if (viewId === 'watchTogether') {
        const el = document.getElementById('view-watch-together');
        if (el) el.style.display = 'block';
        if (typeof window.fbOnEnterView === 'function') window.fbOnEnterView();
    }

    // 🛒 商城（js/26 建的页面）。跟一起看电影一样，必须在核心这儿有正式分支，
    //    不能靠模块自己 patch switchMainView——那样会被下面的"没页面就退回主页"兜底抢先。
    else if (viewId === 'mall') {
        const el = document.getElementById('view-mall');
        if (el) el.style.display = 'block';
        if (typeof window.gymallOnEnterView === 'function') window.gymallOnEnterView();
    }

    // 🧩 小功能页（js/27）：音乐盒 / 行程与天气 / 关系账本 / 八卦网 / 随身物 / 日子 /
    //    此刻 / 一起阅读 / 表情，都是把各自那个全屏弹窗的壳搬进这一页当内容用。
    else if (viewId === 'featurePage') {
        const el = document.getElementById('view-feature-page');
        if (el) el.style.display = 'block';
        const nav = document.getElementById('nav-minihub'); if (nav) nav.className = 'nav-item active';
        if (typeof window.gyFeatureOnEnterView === 'function') window.gyFeatureOnEnterView();
    }

    // 🛟 兜底：上面一长串 else-if 是按 viewId 精确匹配的，写错一个字（比如把 'ai-enhance' 写成 'aiEnhance'）
    // 就会走完整条链却一个分支都不命中——hideAllViews() 已经把所有页面藏起来了，结果就是白屏，
    // 而且不报任何错，非常难查。这里补一层：谁都没显示出来就退回主页，并在控制台留下线索。
    try {
        const anyVisible = Array.from(document.querySelectorAll('.main-content > div[id^="view-"]'))
            .some(el => el.style.display && el.style.display !== 'none');
        if (!anyVisible) {
            console.warn('[switchMainView] 未知的 viewId：', viewId, '——已退回主页，请检查调用处的拼写');
            const home = document.getElementById('view-home');
            if (home) home.style.display = 'block';
            const nav = document.getElementById('nav-home'); if (nav) nav.className = 'nav-item active';
            const mTitle = document.getElementById('mtbCenterTitle'); if (mTitle) mTitle.innerText = '主页';
        }
    } catch (e) { /* 兜底本身出错不能反过来影响正常切页 */ }

    // 右侧「你可能会喜欢」：除了聊天页，其它页面都显示。
    // 聊天页排除掉是因为那一页右侧本来就被会话内容占着，再塞一块推荐会分散注意力，
    // 而且正在跟人说话的时候不需要"再逛逛别人"。
    // 每次切页都重新洗一批，逛起来才有"每页都不一样"的感觉。
    const sug = document.getElementById('rightPanelSuggest');
    if (sug) {
        if (viewId === 'chat') sug.style.display = 'none';
        else if (typeof renderSuggestedChars === 'function') renderSuggestedChars(true);
        else sug.style.display = 'none';
    }
}
