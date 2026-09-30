// ✂️ 这个文件是从 05-anniversary-memory.js 拆出来的第 2 段（原来一个文件太大，改起来容易改坏）。
// 跟 05-anniversary-memory.js 以及同一组的其它段共用一个全局作用域，index.html 里的加载顺序不能换。

// 「🎲 随机生成一条」卡片。三个场景的挑选框都挂它，文案按场景走。
function randomGreetingCardHtml(mode) {
    const desc = {
        chat: '让 AI 照着人设现编一条聊天开场白，跟已有的不重样',
        storyStudio: '让 AI 照着人设现编一段续写开场（场景+留给你接话的话头）',
        novelOutline: '让 AI 照着人设现编一段小说开篇，会先进预览区'
    }[mode] || '';
    return `
        <div class="wb-card" id="randomGreetingBtn" style="min-width:0; max-width:none; width:100%; cursor:pointer; margin-bottom:8px; border:1px dashed #1d9bf0; background:rgba(29,155,240,0.04);" onclick="generateRandomGreeting()">
            <div style="font-size:14px; font-weight:bold; color:#1d9bf0; margin-bottom:2px;">🎲 随机生成一条</div>
            <div style="font-size:13px; color:#536471;">${desc}</div>
        </div>`;
}

function showGreetingPicker(charId) {
    const char = myCharacters.find(c => c.id == charId);
    if (!char) return;
    const options = sortGreetingOptionsMenuLast(getGreetingOptions(char), char.id);
    if (options.length === 0) return;
    window.__greetingPickerMode = 'chat';
    window.__greetingPickerCharId = charId;
    window.__greetingPickerOptions = options;

    document.getElementById('greetingPickerTitle').innerText = `💬 选择 ${char.name} 的开场白`;
    // 💡 聊天模式专属：最上面加一张"不使用开场白"的卡片，用户可以自己决定不用角色卡自带的开场白，
    // 直接自己先开口——续写模式(showNovelGreetingPicker)不需要这张卡，那边没有"跳过"这个概念。
    const skipCardHtml = `
        <div class="wb-card" style="min-width:0; max-width:none; width:100%; cursor:pointer; margin-bottom:8px; border:1px dashed #536471;" onclick="skipGreetingPicker()">
            <div style="font-size:14px; font-weight:bold; color:#536471; margin-bottom:2px;">🚫 不使用开场白</div>
            <div style="font-size:13px; color:#536471;">直接开始聊天，自己先开口说第一句</div>
        </div>`;
    document.getElementById('greetingPickerList').innerHTML = randomGreetingCardHtml('chat') + skipCardHtml + renderGreetingOptionCards(options, null, { charId: char.id });
    openModal('greetingPickerModal');
}

// 用户在聊天开场白选择框里点了"不使用开场白"：不推送任何角色消息，改成推送一条小的系统提示，
// 一是让用户清楚知道"跳过"生效了，二是让 globalChats[charId].length > 0，避免下次再进这个聊天时
// sendFirstMessageIfNeeded 发现历史仍是空的、又弹一次选择框（相当于用这条系统提示当"已经决定过了"的标记）。
function skipGreetingPicker() {
    const charId = window.__greetingPickerCharId;
    closeModal('greetingPickerModal');
    if (!charId) return;
    if (!globalChats[charId]) globalChats[charId] = [];
    if (globalChats[charId].length === 0) {
        globalChats[charId].push({ sender: 'system', text: '已跳过开场白，你可以先开口打个招呼～', timestamp: Date.now(), readBy: [] });
        saveAllData();
    }
    if (currentChatSessionId === charId) { try { renderChatMessages(); } catch (e) { console.error('渲染聊天消息时出错：', e); } }
    else switchChatSession(charId);
}

// 续写/小说模式的开场白挑选：把这个故事里"已勾选参与"的每个角色的候选开场白都汇总进来，
// 卡片上额外标出是哪个角色的（一个故事可能挂了好几个角色），选中后直接当第一轮"AI"内容插进续写记录，
// 不用调用AI接口——这就是一段已经写好的开场文字，没必要为它专门请求一次生成。
// forOutlineMode：true=从"一键生成模式"里调用（开场白会被当成一章内容，走预览区"保留/重新生成/放弃"流程）；
// 不传/false=从"互动续写模式"调用（开场白直接作为续写第一轮插入，原有行为不变）。
function showNovelGreetingPicker(forOutlineMode) {
    const novel = globalNovels.find(n => n.id === currentEditingNovelId);
    if (!novel) return;
    const selChars = Array.from(document.querySelectorAll('.novel-char-check:checked')).map(cb => cb.value);
    const combined = [];
    selChars.forEach(id => {
        if (id === 'me') return; // 用户自己没有"开场白"这个概念
        const char = myCharacters.find(c => c.id == id);
        if (!char) return;
        getGreetingOptions(char).forEach(text => combined.push({ charId: char.id, charName: char.name, text }));
    });
    if (combined.length === 0) { appAlert('已勾选参与的角色都没有设置开场白，直接手打第一句开个头就行～'); return; }

    // 互动续写已经独立成「续写工作台」，它有自己的挑选入口（js/16 的 showSsGreetingPicker，
    // mode='storyStudio'）。所以这个函数现在只服务小说编辑器的"一键生成模式"。
    window.__greetingPickerMode = 'novelOutline';
    const sortedCombined = sortGreetingOptionsMenuLast(combined);
    window.__greetingPickerOptions = sortedCombined;
    // 涉及多个角色时才需要在每张卡片上标注"这是谁的开场白"，只有一个角色就不用啰嗦重复标注
    const uniqueCharCount = new Set(combined.map(o => o.charId)).size;
    document.getElementById('greetingPickerTitle').innerText = `💬 选择开场白（作为一章内容）`;
    document.getElementById('greetingPickerList').innerHTML = randomGreetingCardHtml('novelOutline') + renderGreetingOptionCards(sortedCombined, uniqueCharCount > 1 ? (idx, item) => `【${item.charName}】` : null);
    openModal('greetingPickerModal');
}

function selectGreeting(idx) {
    const mode = window.__greetingPickerMode || 'chat';
    // 续写工作台（js/16）：宏替换、正则、MVU、记忆召回那一整套后处理都在 applySsGreeting 里做，
    // 跟它自己正常生成的一轮走完全同一条链路，这里只负责把选中的候选转交过去。
    if (mode === 'storyStudio') {
        const item = (window.__greetingPickerOptions || [])[idx];
        closeModal('greetingPickerModal');
        if (item && typeof applySsGreeting === 'function') applySsGreeting(item);
        return;
    }
    if (mode === 'novelOutline') {
        const item = (window.__greetingPickerOptions || [])[idx];
        if (!item) return;
        closeModal('greetingPickerModal');
        const novel = globalNovels.find(n => n.id === currentEditingNovelId);
        if (!novel) return;
        const char = myCharacters.find(c => c.id == item.charId);
        const meta = parseGreetingMeta(item.text);
        let text = meta ? meta.body : item.text;
        try { text = applyMacros(text, char); } catch (e) { console.error('开场白宏替换出错，改用原文：', e); }
        // 跟聊天模式的开场白一样，续写这边选中的开场白也要过一遍正则脚本+MVU剥离，避免角色卡里焊死的状态栏JSON漏出来。
        // 这里明确知道是哪个角色的开场白（item.charId），直接传给正则，charScope限定的显示/输出脚本才能正常触发。
        text = applyRegexScripts(text, 'ai_output', item.charId);
        const mvuResult = processMvuPatchInText(text, currentEditingNovelId);
        text = mvuResult.cleanText;

        // 一键生成模式：开场白不直接落地存档，而是丢进跟AI生成章节完全一样的预览区，
        // 用户还能"保留/重新生成/放弃"，跟正常生成的章节体验一致，不搞特殊。
        const chapterNum = (novel.chapters ? novel.chapters.length : 0) + 1;
        tempNovelChapter = { id: 'c_' + Date.now(), index: chapterNum, content: text, timestamp: Date.now() };
        const tempArea = document.getElementById('novelTempArea'), tempContentEl = document.getElementById('novelTempContent');
        if (tempContentEl) tempContentEl.value = text;
        if (tempArea) { tempArea.style.display = 'block'; tempArea.scrollIntoView({ behavior: 'smooth' }); }
        return;
    }
    const charId = window.__greetingPickerCharId;
    const options = window.__greetingPickerOptions || [];
    if (!options[idx]) return;
    closeModal('greetingPickerModal');
    applyGreetingAsFirstMessage(charId, options[idx]);
    if (currentChatSessionId !== charId) switchChatSession(charId);
}

// 每次点进角色的聊天界面，就结合ta的日程和当前真实时间，刷新一次状态气泡（char.lifeState）
let lastScheduleBubbleRefresh = {};
async function refreshLifeStateOnChatEnter(charId) {
    if (typeof isAutoOn === 'function' && !isAutoOn('lifeStateEnter')) return;   // 🔌 设置里关掉了「进聊天页刷新角色状态」
    if (!charId || charId.startsWith('g_')) return; // 群聊暂不处理
    const char = myCharacters.find(c => c.id == charId);
    if (!char || !char.schedule || !char.schedule.text) return; // 没有日程就没有可结合的信息

    const now = Date.now();
    if (lastScheduleBubbleRefresh[charId] && now - lastScheduleBubbleRefresh[charId] < 60000) return; // 1分钟内重复进入同一个聊天不重复请求
    lastScheduleBubbleRefresh[charId] = now;

    const api = getApiMain();
    if (!api.key) return;

    const typeAsk = statusTypes.length > 0 ? `，并从这些状态类型里选一个最贴近的填入 "statusTypeLabel" 字段：[${statusTypes.map(t => t.label).join('、')}]，都不贴切就填空字符串` : '';
    const prompt = `现在的真实时间是 ${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}。这是"${char.name}"的今日日程：\n${char.schedule.text}\n请根据现在的真实时间，对照ta的日程表，判断ta此刻正在做什么（20字以内，不要加引号）${typeAsk}。请严格只输出 JSON，不要包含任何 Markdown 语法或多余说明：{"activity": "此刻在做的事"${typeAsk ? ', "statusTypeLabel": "从给定列表里选的状态类型"' : ''}}`;

    try {
        const data = await sendChatRequest(api, prompt);
        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        const parsed = (typeof parseModelJson === 'function') ? parseModelJson(rawText) : JSON.parse(rawText);
        if (parsed && parsed.activity) {
            saveCharLifeState(char, parsed.activity, parsed.statusTypeLabel || (char.lifeState && char.lifeState.statusTypeLabel));
            saveAllData();
        }
    } catch (e) { /* 静默失败，不打断进入聊天的体验 */ }
}

function checkAndAnnounceAnniversary(sessionId) {
    if (!enableAnniversary || sessionId.startsWith('g_')) return; // 群聊暂不支持纪念日
    const char = myCharacters.find(c => c.id == sessionId); if (!char) return;
    const history = globalChats[sessionId];
    if (!history || history.length === 0) return;
    // 🔧 天数改走 annBaseInfo（跟日历页同一个算法）。以前这里是从聊天记录第一条算的，
    //    跟日历上显示的数对不上，而且清一次聊天记录就归零。
    const info = annBaseInfo(char);
    const daysSince = info ? info.days : 0;
    if (daysSince < 1) return;
    // 🔧 以前 365 天之后要等到 730 才再响一次，中间整整一年一声不吭（400/500/600 全落空）。
    //    现在整百天一直有效。
    const isMilestone = [1, 7, 30, 100].includes(daysSince)
        || (daysSince >= 100 && daysSince % 100 === 0)
        || (daysSince >= 365 && daysSince % 365 === 0);
    if (!isMilestone) return;
    const todayKey = new Date().toDateString();
    if (char.lastAnniversaryShownDate === todayKey) return; // 今天已经提示过，不重复刷屏

    char.lastAnniversaryShownDate = todayKey;
    char.pendingAnniversaryDays = daysSince; // 下次生成回复时会自然提一句，用完即清空
    globalChats[sessionId].push({ sender: 'system', text: `✨ 今天是你和 ${char.name} 认识的第 ${daysSince} 天`, timestamp: Date.now() });
    saveAllData();
    renderChatMessages();
}

// "转私聊"功能：角色本来该在推文/评论下公开回应，但（在设置里打开这个选项后）判断这件事更适合私下聊时，
// 会调用这个函数把消息直接送进跟用户的1v1私聊里，而不是发公开评论——因为这种消息不会出现在推文流/评论区，
// 容易被用户错过，所以额外弹一条通知提醒（复用 addNotification 的 chatCharId 参数，点通知能直接跳转到对应聊天）。
// quotedPost：可选，{name, text} —— 跟Twitter"分享推文到私信"一样，把触发这次转私聊的那条推文/评论内容
// 一起带过去，而不是只留一句凭空冒出来的话。复用聊天气泡本来就支持的 msg.quote 结构（引用消息那个功能），
// 不用另外再造一套UI。
function deliverCharMoveToChatMessage(char, messageText, quotedPost) {
    if (!char || !messageText) return;
    const sessionId = char.id;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const quote = (quotedPost && quotedPost.text) ? { name: quotedPost.name || '未知', text: quotedPost.text, type: 'tweet' } : null;
    globalChats[sessionId].push({ sender: char.id, text: messageText, timestamp: Date.now(), readBy: [], quote });
    saveAllData();
    if (currentChatSessionId === sessionId && document.getElementById('view-chat') && document.getElementById('view-chat').style.display !== 'none') {
        renderChatMessages();
    } else if (typeof renderChatCharList === 'function') {
        renderChatCharList();
    }
    if (typeof addNotification === 'function') addNotification(`<b>${char.name}</b> 想私下跟你聊聊`, null, char.id, char, messageText);
}

async function triggerNudge(sessionId, targetId) {
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    let sysText = targetId === 'me' ? `"${currentUser.name}" 拍了拍 自己 ${currentUser.nudgeText || '的脑袋'}` : `"${currentUser.name}" 拍了拍 "${myCharacters.find(c => c.id == targetId).name}" ${myCharacters.find(c => c.id == targetId).nudgeText || '的肩膀'}`;
    globalChats[sessionId].push({ sender: 'system', text: sysText, timestamp: Date.now() }); renderChatMessages(); saveAllData();

    const api = getApiMain();
    if (targetId !== 'me' && api.key) {
        let targetChar = myCharacters.find(c => c.id == targetId);
        let prompt = buildStructuredMessages(buildBasePrompt(targetChar, false, sysText), [],
            `刚刚用户在聊天中双击头像"拍了拍"你。\n系统提示：${sysText}\n你可以选择回复，或者输出 [NUDGE] 来反击。\n【格式铁律】"XX 拍了拍 YY"这句话由系统自动生成并显示，你绝对不要自己写这句话、也不要模仿它的写法——想反击就只输出 [NUDGE] 这个标记本身，其余部分正常说你要说的话。（照抄那句话会导致引号错乱、内容重复两遍。）字数${chatWordLimit}字以内。${WORD_LIMIT_PRIORITY_NOTE}`);
        try {
            if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') { currentlyTypingChars.add(targetChar.name); updateTypingIndicator(); }
            let data = await callChatCompletionAPI(api, prompt);
            let repText = data.choices?.[0]?.message?.content?.trim() || "";
            currentlyTypingChars.delete(targetChar.name); updateTypingIndicator();
            
            if (repText.toUpperCase().startsWith("NO") && repText.length < 5) return;
            // 兜底清洗：模型偶尔还是会照着历史里的系统消息，自己写一句「X"拍了拍"Y的手背」当开场。
            // 这句本来就由系统生成并单独显示，气泡里再来一遍就是重复，而且引号常常是错乱的。
            // 只清洗"照抄系统消息"那一种：系统消息一定带引号（"林" 拍了拍 "Elias" 的肩膀），
            // 模型照抄时引号会错位但仍然带着（林"拍了拍"Elias的手背）。
            // 加上"这一行里必须出现引号"这个前提，普通句子（我今天拍了拍照片）就不会被误删。
            repText = repText.replace(/^(?=[^\n]*["“”'])[^\n]{0,14}拍了拍[^\n]{0,30}(?:\n+|$)/, '').trim();
            if (repText.includes("[NUDGE]")) { repText = repText.replace(/\[NUDGE\]/ig, '').trim(); globalChats[sessionId].push({ sender: 'system', text: `"${targetChar.name}" 拍了拍 "${currentUser.name}" ${currentUser.nudgeText || '的脑袋'}`, timestamp: Date.now() }); }
            repText = applyRegexScripts(repText, 'ai_output', targetChar.id);
            if (repText) globalChats[sessionId].push({ sender: targetChar.id, text: repText, timestamp: Date.now(), readBy: [] });
            if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') { renderChatMessages(); } else { renderChatCharList(); }
            saveAllData();
        } catch (e) { currentlyTypingChars.delete(targetChar.name); updateTypingIndicator(); }
    }
}

function isScheduleStale(char) {
    if (!char.schedule || !char.schedule.generatedAt) return false;
    return new Date(char.schedule.generatedAt).toDateString() !== new Date().toDateString();
}

function showCharLifeStatePopup(charId, event) {
    const char = myCharacters.find(c => c.id == charId); if (!char) return;
    const bubble = document.getElementById('charStatusBubble');
    document.getElementById('charStatusPopupAvatar').innerHTML = getAvatarHTML(char, 44);
    document.getElementById('charStatusPopupName').innerText = char.name;
    const textEl = document.getElementById('charStatusPopupText');
    let statusHtml = '';
    const typeColor = char.lifeState ? getStatusTypeColor(char.lifeState.statusTypeLabel) : null;
    if (typeColor) {
        bubble.style.background = typeColor + '1a'; // 淡色背景，保证文字可读
        bubble.style.borderLeft = `4px solid ${typeColor}`;
    } else {
        bubble.style.background = '#fff';
        bubble.style.borderLeft = 'none';
    }
    if (char.lifeState && char.lifeState.activity) {
        const ago = formatDurationZh(Math.max(0, Date.now() - (char.lifeState.updatedAt || Date.now())));
        const typeBadge = char.lifeState.statusTypeLabel ? `<span style="background:${typeColor}; color:#fff; font-size:10px; padding:1px 8px; border-radius:8px; margin-right:6px;">${char.lifeState.statusTypeLabel}</span>` : '';
        statusHtml = `${typeBadge}💭 ${char.lifeState.activity}<br><span style="font-size:11px; color:#8b98a5;">（${ago}前）</span>`;
    } else {
        statusHtml = `暂时还不知道ta在做什么，多聊聊看吧～`;
    }
    if (enableAffinitySystem) {
        const aff = char.affinity || 0;
        statusHtml += `<br><span style="font-size:12px; color:${aff >= 0 ? '#17bf63' : '#f91880'};">💗 好感度 ${aff > 0 ? '+' : ''}${aff}</span>`;
    }
    if (enableScheduleAutoCheck && isScheduleStale(char)) {
        statusHtml += `<br><span style="font-size:11px; color:#f91880;">⚠️ 日程是之前生成的，可能已过期，右键头像可更新</span>`;
    }
    textEl.innerHTML = statusHtml;
    const scheduleToggle = document.getElementById('charStatusScheduleToggle');
    const scheduleText = document.getElementById('charStatusScheduleText');
    scheduleText.style.display = 'none'; scheduleText.dataset.expanded = '0';
    scheduleToggle.innerText = '📅 查看今日日程';
    if (char.schedule && char.schedule.text) {
        scheduleToggle.style.display = 'inline-block';
        scheduleToggle.dataset.charId = char.id;
    } else {
        scheduleToggle.style.display = 'none';
    }

    // 先展示出来才能测量气泡自身尺寸，用于自适应定位
    bubble.style.display = 'block';
    bubble.style.visibility = 'hidden';
    const targetEl = (event && (event.currentTarget || event.target)) || null;
    const rect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth/2, right: window.innerWidth/2, top: 100, bottom: 100, width: 0 };
    const bubbleRect = bubble.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - bubbleRect.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - bubbleRect.width - 10));
    let top = rect.bottom + 10;
    let isArrowUp = true;
    if (top + bubbleRect.height > window.innerHeight - 10) {
        top = rect.top - bubbleRect.height - 10;
        isArrowUp = false;
    }
    bubble.style.left = left + 'px';
    bubble.style.top = Math.max(10, top) + 'px';

    const arrowEl = bubble.querySelector('.char-status-bubble-arrow');
    const arrowLeft = Math.max(14, Math.min(rect.left + rect.width / 2 - left - 6, bubbleRect.width - 26));
    arrowEl.style.left = arrowLeft + 'px';
    arrowEl.className = 'char-status-bubble-arrow ' + (isArrowUp ? 'arrow-up' : 'arrow-down');
    arrowEl.style.background = typeColor ? typeColor + '1a' : '#fff';
    bubble.style.visibility = 'visible';

    if (event) event.stopPropagation();
    setTimeout(() => { document.addEventListener('click', closeStatusBubbleOnOutsideClick); }, 0);
}

function closeStatusBubbleOnOutsideClick(e) {
    const bubble = document.getElementById('charStatusBubble');
    if (bubble && !bubble.contains(e.target)) {
        bubble.style.display = 'none';
        document.removeEventListener('click', closeStatusBubbleOnOutsideClick);
    }
}

function toggleScheduleInBubble() {
    const scheduleToggle = document.getElementById('charStatusScheduleToggle');
    const char = myCharacters.find(c => c.id == scheduleToggle.dataset.charId);
    if (!char || !char.schedule) return;

    // 在弹窗中显示日程
    document.getElementById('scheduleViewTitle').innerText = `${char.name}的今日日程`;
    const typeColor = getStatusTypeColor(char.schedule.currentStatus ? getScheduleStatusType(char.schedule) : '');
    const typeBadge = char.schedule.currentStatus ? `<span style="background:${typeColor || '#1d9bf0'}; color:#fff; font-size:12px; padding:2px 8px; border-radius:8px; margin-right:6px; display:inline-block; margin-bottom:10px;">${getScheduleStatusType(char.schedule)}</span>` : '';
    document.getElementById('scheduleViewStatus').innerHTML = char.schedule.currentStatus ? `${typeBadge}💭 当前状态：${char.schedule.currentStatus}` : '';
    document.getElementById('scheduleViewText').innerText = char.schedule.text;
    openModal('scheduleViewModal');
}

function getScheduleStatusType(schedule) {
    return schedule.statusTypeLabel || '未设置';
}

function renderChatMessages() {
    // 🫀 顶上那条"TA 这会儿在忙/在睡"的提示，跟着聊天一起刷
    try { if (typeof renderAliveBar === 'function') renderAliveBar(); } catch (e) {}
    const container = document.getElementById('chatMessagesArea'); if (!currentChatSessionId) return;
    let history = globalChats[currentChatSessionId] || [], isGroup = currentChatSessionId.startsWith('g_');
    let groupData = isGroup ? groupChats.find(g => g.id === currentChatSessionId) : null, totalMembers = isGroup ? (groupData?.members.length || 1) : 1;

    // 防御：单条消息渲染出错（比如内容含有异常字符/宏替换失败）之前会导致 .map() 整体抛错，
    // container.innerHTML 完全不会被赋值——表现出来就是"聊天区一片空白/开场白不显示"，其实是有一条消息渲染炸了拖累了全部。
    // 改成逐条 try/catch，单条出错就跳过那一条（控制台留错误方便排查），不影响其它消息正常显示。
    // ⚠️ 这里以前是"每遇到一条未读就调一次 saveAllData()"。saveAllData 会把整份存档做一次
    // 结构化克隆写进 IndexedDB，这一步同步占着主线程——60条未读就是60次全量克隆，实测能把
    // 主线程占住近2秒，这段时间里键盘敲的字全丢，就是"对面一发消息就打不了字"的直接原因。
    // 现在改成：先记个标记，整轮渲染完只存一次（saveAllData 本身也已经改成合并写入了，双保险）。
    let __markedAnyRead = false;
    /* 🕰️ 时间分隔条（微信那种居中灰字）
       以前每个气泡旁边都挂着一个 HH:MM，一屏十几个时间，看着乱，
       而且"这两句中间隔了三天"完全看不出来。
       现在按微信的规矩：隔满 N 分钟才插一条居中的时间，气泡边上那个就不用盯着了。
       写法也按微信来：今天只写时分，昨天写"昨天 HH:MM"，一周内写"星期X HH:MM"，
       再远写"M月D日 HH:MM"，跨年才写年份。点一下展开成完整的"X年X月X日 星期X HH:MM"。 */
    let __lastSepAt = 0;
    const sepHtml = (ts) => {
        if (!chatTimeSepEnabled || !ts) return '';
        const gap = Math.max(0, parseInt(chatTimeSepMin)) * 60000;
        if (__lastSepAt && (ts - __lastSepAt) < gap) return '';
        __lastSepAt = ts;
        return `<div class="chat-time-sep" data-ts="${ts}" onclick="gyChatSepToggle(this)" title="点一下看完整日期"><span>${gyChatSepText(ts, false)}</span></div>`;
    };
    container.innerHTML = history.map((msg, idx) => {
        try {
            const __sep = sepHtml(msg.timestamp);
            if (msg.sender === 'system') return __sep + `<div class="chat-system-msg"><span>${msg.text}</span></div>`;
            // 📨 邀请卡片（js/28）：一起看电影 / 一起听歌 / 一起阅读 / 约出去，
            //    都是聊天里的一张卡，不是气泡。谁发起的、答没答应、TA 说了什么，全在卡上。
            if (msg.type === 'invite' && msg.invite && typeof gyInviteCardHtml === 'function') {
                return __sep + gyInviteCardHtml(msg, idx);
            }
            // 📦 包裹卡片（js/30）：下单 / 到货 / 收货。跟邀请卡是两种卡，样子也不一样。
            if (msg.type === 'parcel' && msg.parcel && typeof gyParcelCardHtml === 'function') {
                return __sep + gyParcelCardHtml(msg, idx);
            }
            // 📷 角色发的图（js/42）：图 + TA 对这张图说的那句话。
            //    四种路子（只发卡片 / 图库里挑 / 现画 / 网上搜）出来的都是这一张卡，
            //    一张图都没出的时候卡照样在，上面是文字描述——不会变成一个裂开的图标。
            if (msg.type === 'photo' && msg.photo && typeof gyPhotoCardHtml === 'function') {
                return __sep + gyPhotoCardHtml(msg, idx);
            }
            let isMe = msg.sender === 'me', senderChar = isMe ? currentUser : myCharacters.find(c => c.id == msg.sender), timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (!isMe && (!msg.readBy || !msg.readBy.includes('me'))) { if(!msg.readBy) msg.readBy=[]; msg.readBy.push('me'); __markedAnyRead = true; }

            let readStatusHtml = '';
            if (isMe && enableTypingIndicator) {
                let readCount = Array.isArray(msg.readBy) ? msg.readBy.length : 0;
                if (isGroup) { let unreadCount = totalMembers - readCount; readStatusHtml = unreadCount > 0 ? `<div style="font-size:10px; color:#888; margin-top:2px;">${unreadCount}人未读</div>` : `<div style="font-size:10px; color:#1d9bf0; margin-top:2px;">全部已读</div>`; } 
                else { readStatusHtml = readCount > 0 ? `<div style="font-size:10px; color:#1d9bf0; margin-top:2px;">已读</div>` : `<div style="font-size:10px; color:#888; margin-top:2px;">未读</div>`; }
            }
            // 🔗 角色转过来的网页（js/29）：分享感想时把 TA 刚读的那个网页一起转过来，
            //    点一下直接打开——不然你只看见一段感想，不知道 TA 在说什么、从哪儿看来的。
            if (msg.type === 'weblink' && msg.weblink && typeof gyWebLinkHtml === 'function') {
                const isMe0 = msg.sender === 'me';
                const sc = isMe0 ? currentUser : myCharacters.find(c => c.id == msg.sender);
                const av = isMe0 ? '' : `<div>${getAvatarHTML(sc, 40)}</div>`;
                return __sep + `<div class="chat-msg-row other">${av}
                    <div class="chat-bubble-wrapper" style="align-items:flex-start;">
                        <div class="chat-sender-name" style="font-size:10px;"><i class="chat-msg-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</i></div>
                        ${gyWebLinkHtml(msg, idx)}
                    </div></div>`;
            }
            // 🎀 换装卡（js/35）：换头像/背景/壁纸要先问一声，卡上直接把那张图放出来。
            if (msg.type === 'dress' && msg.dress && typeof gyDressCardHtml === 'function') {
                return __sep + gyDressCardHtml(msg, idx);
            }
            // 💸 转账 / 红包（js/31）：不是居中的一张卡，而是**一条谁发出来的消息**——
            //    跟气泡一样左右分边、带头像，只是气泡里装的是转账单。所以放在这儿，
            //    要用到上面算好的 isMe / senderChar / timeStr。
            let avatarHtml = !isMe && senderChar ? `<div style="cursor:pointer;" onclick="showCharLifeStatePopup('${senderChar.id}', event)" ondblclick="triggerNudge('${currentChatSessionId}', '${senderChar.id}')" title="左键查看状态·双击拍一拍">${getAvatarHTML(senderChar, 40)}</div>` : `<div style="cursor:pointer;" ondblclick="triggerNudge('${currentChatSessionId}', 'me')" title="双击拍一拍">${getAvatarHTML(currentUser, 40)}</div>`;
            
            // 🌟 核心渲染：侧滑抽卡控件 🌟
            let swipeHtml = '';
            if (!isMe && msg.swipes && msg.swipes.length > 1) {
                let cIdx = msg.currentSwipe || 0;
                swipeHtml = `
                <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:6px; font-size:12px; color:#536471; user-select:none;">
                    <span style="cursor:pointer; padding:2px 10px; background:rgba(255,255,255,0.4); border-radius:4px;" onclick="swipeMessage('${currentChatSessionId}', ${idx}, -1)">◀</span>
                    <span>${cIdx + 1} / ${msg.swipes.length}</span>
                    <span style="cursor:pointer; padding:2px 10px; background:rgba(255,255,255,0.4); border-radius:4px;" onclick="swipeMessage('${currentChatSessionId}', ${idx}, 1)">▶</span>
                </div>`;
            }

            // 渲染侧兜底：已经存坏在历史里的旧消息（比如修好之前那批带着 [QUOTE:12] 的）
            // 也要能显示干净。只对**角色**说的话生效——用户自己打的字一个都不动。
            // 万一整条消息就只有一个标记、清完是空的，那就原样显示，宁可露一次也别给个空气泡。
            let displayText = msg.text;
            if (!isMe && typeof stripLeftoverMarkers === 'function') {
                const cleaned = stripLeftoverMarkers(msg.text);
                if (cleaned && cleaned.trim()) displayText = cleaned;
            }
            // 📊 状态栏：角色卡自带的（<baixinghe_status>…、<jsy_status>…、<闻述状态>…）或者通用的 [STATUS_START]…。
            //    聊天气泡是纯文字，状态栏原样糊在气泡里就是一大坨字。显示时摘出来：
            //    设置里「聊天里显示状态栏」关着＝不显示；开着＝气泡下面一个可折叠框，
            //    卡片自带状态栏正则的，框里就是卡片作者设计的那张。存档、发给 AI 的内容都不动。
            //    msg.statusRaw：模型把状态栏写在 JSON 外面时，生成那一刻单独收下来的那一截（见下面 finalizeReplies）。
            let __statusCard = '';
            if (!isMe && typeof gyExtractChatStatus === 'function' && (displayText || msg.statusRaw)) {
                const __sid = senderChar ? senderChar.id : msg.sender;
                let __cs = gyExtractChatStatus(displayText || '', __sid);
                if (__cs.seg) displayText = __cs.rest || '';
                else if (msg.statusRaw) __cs = gyExtractChatStatus(msg.statusRaw, __sid);
                if (__cs.seg) {
                    if (typeof showStatusInChat !== 'undefined' && showStatusInChat) {
                        const __depth = history.length - 1 - idx;
                        const __isLatest = !history.slice(idx + 1).some(m => m && m.sender === msg.sender && (m.statusRaw || /status|状态|_START\]/i.test(String(m.text || ''))));
                        __statusCard = gyChatStatusBlockHtml(__cs, __sid, __depth, __isLatest, 'cs' + (msg.timestamp || idx));
                    }
                    if (!displayText && !msg.mediaUrl && !__statusCard) return __sep;
                }
            }
            // 🧩 卡片自带的小界面（手机消息/小红书/朋友圈…，js/55）：从正文里摘出来，画在气泡下面
            let __widget = '';
            if (!isMe && displayText && typeof window.gyChatWidgetSplit === 'function') {
                const __w = window.gyChatWidgetSplit(displayText, senderChar ? senderChar.id : msg.sender, history.length - 1 - idx);
                if (__w.html) { displayText = __w.rest; __widget = __w.html; }
            }
            if (msg.type === 'phonePeek' && typeof window.gyPhonePeekHtml === 'function') {
                return __sep + `
                <div class="chat-msg-row other">
                    ${avatarHtml}
                    <div class="chat-bubble-wrapper" style="align-items:flex-start;">
                        <div class="chat-sender-name" style="font-size:10px;">${isGroup ? (senderChar && senderChar.name) || '' : ''} <i class="chat-msg-time">${timeStr}</i></div>
                        ${window.gyPhonePeekHtml(msg)}
                    </div>
                </div>`;
            }
            if (msg.type === 'money' && msg.money && typeof gyMoneyCardHtml === 'function') {
                return __sep + `
                <div class="chat-msg-row ${isMe ? 'me' : 'other'}">
                    ${!isMe ? avatarHtml : ''}
                    <div class="chat-bubble-wrapper" style="align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        <div class="chat-sender-name" style="font-size:10px;">${!isMe && isGroup ? (senderChar && senderChar.name) || '' : ''} <i class="chat-msg-time">${timeStr}</i></div>
                        ${gyMoneyCardHtml(msg, idx)}
                        ${isMe ? readStatusHtml : ''}
                    </div>
                    ${isMe ? avatarHtml : ''}
                </div>`;
            }

            // 💡 聊天气泡改为【纯文本显示】：不再渲染MVU状态栏卡片、记忆召回面板，也不再把
            // renderMarkdownLite（会保留卡/正则里原样的HTML标签）用在聊天正文上——统一换成
            // renderPlainChatText，只剥离标签取纯文字。注意：mvuSnapshot/recallHtml 等后台数据
            // 处理（变量追踪、记忆库更新）完全不受影响，只是不再画出来。
            return __sep + `
                <div class="chat-msg-row ${isMe ? 'me' : 'other'}">
                    ${!isMe ? avatarHtml : ''}
                    <div class="chat-bubble-wrapper" style="align-items: ${isMe ? 'flex-end' : 'flex-start'};">
                        <div class="chat-sender-name" style="font-size:10px;">${!isMe && isGroup ? senderChar?.name : ''} <i class="chat-msg-time">${timeStr}</i></div>
                        ${(() => { if (!isMe && swipeHtml && !String(displayText || '').replace(/<[^>]*>/g, '').trim() && !msg.mediaUrl) displayText = '（这一版是空的，点 ◀ 翻回去）'; return ''; })()}${(displayText || msg.mediaUrl || msg.quote || !(__statusCard || __widget)) ? `<div class="chat-bubble ${isMe ? 'me' : 'other'}" oncontextmenu="showChatContextMenu(event, ${idx})" ontouchstart="chatBubbleTouchStart(event, ${idx})" ontouchend="chatBubbleTouchEnd(event)" ontouchmove="chatBubbleTouchEnd(event)">${msg.quote ? `<div class="chat-quote-bubble${msg.quote.type === 'tweet' ? ' tweet-quote-card' : ''}">${msg.quote.type === 'tweet' ? '<div class="tweet-quote-label">🐦 分享的推文</div>' : ''}<b>${msg.quote.name}</b>: ${renderPlainChatText(msg.quote.text)}</div>` : ''}${renderPlainChatText(displayText)}${msg.mediaUrl ? `<img src="${msg.mediaUrl}">` : ''}${swipeHtml}</div>` : ''}
                        ${__widget}
                        ${__statusCard}
                        ${(!isMe && msg.reasoningKey && typeof gyVaultChipHtml === 'function') ? gyVaultChipHtml(msg.reasoningKey) : ''}
                        ${isMe ? readStatusHtml : ''}
                    </div>
                    ${isMe ? avatarHtml : ''}
                </div>`;
        } catch (e) {
            console.error('渲染某条聊天消息时出错，已跳过：', idx, msg, e);
            return '';
        }
    }).join('');
    if (__markedAnyRead) saveAllData();   // 整轮只存一次，不再每条一次
    container.scrollTop = container.scrollHeight;

    // 「空着点发送＝重新生成」这个功能得让人看得见，不然没人知道有它。
    // 只在真的可用（最后一条是你说的）而且输入框空着的时候改提示文字。
    const inputEl = document.getElementById('chatInput');
    if (inputEl && !inputEl.value) {
        const manual0 = (typeof gyChatReplyMode !== 'undefined' && gyChatReplyMode === 'manual');
        const waiting = ((typeof pendingBatchReplyTexts !== 'undefined'
            && pendingBatchReplyTexts[currentChatSessionId]) || []).length;
        inputEl.placeholder = manual0
            ? (waiting ? `攒了 ${waiting} 句 · 再点发送就让 TA 回` : '输入消息…（空着点发送＝让 TA 回）')
            : (collectTrailingMyTexts(history).length > 0
                ? '输入消息…（留空点发送＝让TA重新回一次）'
                : '输入消息...');
    }
    // 💡 聊天气泡现在统一是纯文本渲染（renderPlainChatText），不会再有真实HTML/<script>标签进到DOM里，
    // 这里以前的"聊天注入脚本执行"调用已经是死代码了，去掉。脚本执行开关(enableChatScriptExecution)本身
    // 还留着——推文/评论/小报这些地方仍然正常渲染HTML，那些地方还用得到，见 08/09/11 号文件里的调用。
}

// 浏览器出于安全考虑，不会执行通过 innerHTML 动态插入的 <script> 标签——很多角色卡自带的HTML卡片
// （比如状态栏的展开/收起按钮）依赖这类内嵌脚本才能工作，不然点了会报"xxx is not defined"。
// 这里手动把这些脚本"重新创建"一遍来强制执行。⚠️这意味着聊天内容里只要出现<script>标签就会真的运行，
// 只有在"设置 → AI增强功能"里手动打开对应开关、并且信任你导入的角色卡来源时才应该开启。
//
// 🐛 根因修复：不少"手机截图/聊天美化"类角色卡HTML组件，是照搬SillyTavern里"每条消息用一个独立
// <iframe>文档渲染"的写法习惯，内部初始化逻辑全部挂在 document.addEventListener('DOMContentLoaded', fn)
// 上——这个假设只有在"这段HTML/JS是被浏览器当成一份全新文档从头加载"时才成立。但本app不是用iframe
// 渲染这些卡片的，而是把<script>直接重新创建、追加到当前这个早就"加载完毕"的页面里：'DOMContentLoaded'
// 事件在页面刚打开那一刻就已经触发过一次了，不会再触发第二次。结果就是这些卡片里"等页面加载完成后
// 才去初始化/往容器里填充正文内容"的代码永远不会运行——表现出来就是卡片的外壳（状态栏、边框、背景）
// 能看到，里面本该动态填充的聊天气泡/正文内容却是一片空白，点卡片自带的设置按钮也没反应（同样卡在
// 这个从没触发过的监听器里）。
//
// 这里给每个注入脚本生成一个独一无二、不会跟真正的'DOMContentLoaded'重名的"替身事件名"，把脚本源码里
// 所有监听 DOMContentLoaded 的地方偷梁换柱成监听这个替身事件；<script>标签插入DOM后是同步执行的，
// 这时脚本自己的addEventListener已经注册完毕，插入后立刻手动派发一次这个替身事件，等效于帮它从头
// 触发一次"页面加载完成"。全程只是替换脚本文本里的一个事件名字符串，完全不影响本app自己真正挂在
// 原生'DOMContentLoaded'上的启动逻辑（那些监听的字符串没有被替换过）。
function executeInjectedScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
        try {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            let code = oldScript.textContent || '';
            const usesDCL = /DOMContentLoaded/.test(code);
            const fakeEventName = usesDCL ? ('__injectedCardReady_' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '__') : null;
            if (usesDCL) code = code.replace(/DOMContentLoaded/g, fakeEventName);
            newScript.textContent = code;
            oldScript.parentNode.replaceChild(newScript, oldScript);
            if (usesDCL) document.dispatchEvent(new Event(fakeEventName));
        } catch (e) { /* 单个脚本出错不影响其它内容 */ }
    });
}
function showChatContextMenu(e, msgIdx) {
    e.preventDefault(); let msg = globalChats[currentChatSessionId][msgIdx]; if (!msg || msg.sender === 'system') return;
    chatContextMenuTarget = { name: msg.sender === 'me' ? currentUser.name : (myCharacters.find(c => c.id == msg.sender)?.name || '未知'), text: msg.text }; chatContextMenuMsgIdx = msgIdx; 
    const menu = document.getElementById('chatContextMenu');
    menu.innerHTML = `
        <button class="context-btn" onclick="contextActionReplyChat()">引用回复</button>
        ${msg.sender === 'me'
            ? '<button class="context-btn" onclick="contextActionEditChat()">重新编辑</button>'
            : '<button class="context-btn" onclick="contextActionEditCharMsg()">✏️ 编辑这条消息</button><button class="context-btn" onclick="contextActionRegenerateChat()">🔄 侧滑重新生成</button>'}
        ${!currentChatSessionId.startsWith('g_') ? '<button class="context-btn" style="color:#17bf63;" onclick="contextActionBranchChat()">🌳 从此处开辟分支（保留旧对话）</button>' : ''}
        <button class="context-btn" onclick="contextActionSpeakChat()">🔊 朗读这条消息</button>
        <button class="context-btn" onclick="contextActionAddToMemory()">⭐ 收藏进相册</button>
        <button class="context-btn" style="color:#f91880;" onclick="contextActionDeleteChat()">删除消息</button>
    `;
    menu.style.display = 'flex'; let x = e.pageX, y = e.pageY; if(x + 100 > window.innerWidth) x -= 100; if(y + 200 > window.innerHeight) y -= 200; menu.style.left = x + 'px'; menu.style.top = y + 'px';
}

// ==========================================
// 🎤🔊 语音输入(STT) 与 朗读(TTS) —— 纯浏览器原生 Web Speech API，不依赖任何后端/第三方服务，
// 所以"没有后端也能用"这条底线不受影响；不支持的浏览器/环境会提示，不影响其它功能。
// ==========================================
let activeSpeechRecognition = null; // 同一时间只允许一路语音识别在录，按钮上会切换成"聆听中"的样式

function isSpeechRecognitionSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function isSpeechSynthesisSupported() { return !!window.speechSynthesis; }

// 点击麦克风按钮：开始/再点一次＝停止。识别出的文字直接追加进目标输入框，不会覆盖已经打好的内容。
function toggleVoiceInput(targetInputId, btnEl) {
    if (!isSpeechRecognitionSupported()) return alert('当前浏览器/环境不支持语音输入（Web Speech API）。安卓上换系统自带的浏览器内核（比如Chrome）试试看。');

    if (activeSpeechRecognition) { activeSpeechRecognition.stop(); return; } // 正在录 -> 这次点击当"停止"处理

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'zh-CN'; rec.continuous = false; rec.interimResults = false;

    const input = document.getElementById(targetInputId);
    // ⚠️ 以前录音时把按钮的 innerHTML 换成一个 🔴。现在聊天那颗是 SVG 图标，
    //    换掉就回不来了（而且样子也不统一）。改成加一个 .rec 类，由 CSS 让它变红闪。
    //    别处那些还是 emoji 的按钮也照顾到：没有 SVG 的才退回换字符。
    const originalBtnHtml = btnEl ? btnEl.innerHTML : '';
    const isIcon = !!(btnEl && btnEl.querySelector('svg'));
    if (btnEl) {
        btnEl.title = '正在聆听...点击停止';
        if (isIcon) btnEl.classList.add('rec');
        else btnEl.innerHTML = '🔴';
    }

    rec.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
        if (input && text) { input.value = (input.value ? input.value + ' ' : '') + text; input.focus(); }
    };
    rec.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            alert('语音识别出错：' + event.error + (event.error === 'not-allowed' ? '\n（请检查是否已授权麦克风权限）' : ''));
        }
    };
    rec.onend = () => {
        activeSpeechRecognition = null;
        if (!btnEl) return;
        btnEl.title = '语音输入';
        if (isIcon) btnEl.classList.remove('rec');
        else btnEl.innerHTML = originalBtnHtml || '🎤';
    };

    activeSpeechRecognition = rec;
    try { rec.start(); } catch (e) {
        alert('启动语音识别失败：' + e.message);
        activeSpeechRecognition = null;
        if (btnEl) { if (isIcon) btnEl.classList.remove('rec'); else btnEl.innerHTML = originalBtnHtml || '🎤'; }
    }
}

// 朗读一段文字：自动剥掉Markdown符号/HTML标签/代码块，只念纯文本，不然会把 **、<div> 这些符号也念出来
function speakText(text) {
    if (!isSpeechSynthesisSupported()) return alert('当前浏览器/环境不支持语音朗读（Web Speech API）。');
    speechSynthesis.cancel(); // 先打断上一条还没读完的，避免声音叠在一起

    let plain = String(text || '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[*_~`#>]/g, '')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .trim();
    if (!plain) return;

    const utter = new SpeechSynthesisUtterance(plain);
    utter.lang = 'zh-CN'; utter.rate = 1.0;
    speechSynthesis.speak(utter);
}
function stopSpeaking() { if (isSpeechSynthesisSupported()) speechSynthesis.cancel(); }

// 聊天气泡右键菜单里的"朗读这条消息"入口
function contextActionSpeakChat() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (!chatContextMenuTarget) return;
    speakText(chatContextMenuTarget.text);
}

function contextActionAddToMemory() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (!chatContextMenuTarget) return;
    const msg = globalChats[currentChatSessionId] ? globalChats[currentChatSessionId][chatContextMenuMsgIdx] : null;
    const charForAvatar = myCharacters.find(c => c.id == currentChatSessionId);
    memoryAlbum.unshift({
        id: 'mem_' + Date.now(), type: 'chat', refId: currentChatSessionId,
        charId: currentChatSessionId, charName: chatContextMenuTarget.name,
        text: chatContextMenuTarget.text, timestamp: msg ? msg.timestamp : Date.now(), savedAt: Date.now()
    });
    saveAllData();
    if (typeof showToast === 'function' && charForAvatar) showToast(getAvatarHTML(charForAvatar, 40), '已收藏', '这条聊天已经存进回忆相册啦～', null, null);
}

let replyContextMenuTarget = null;


// ✏️ 改评论/楼层的内容。推文评论、营销号评论、故事论坛楼层、匿名论坛评论四种全走这一个。
// 以前只有"删"没有"改"——写错一个字只能删掉重来，AI 生成的那条就永远回不来了。
async function contextActionEditReply() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (!replyContextMenuTarget) return;
    const target = replyContextMenuTarget; replyContextMenuTarget = null;

    // ① 故事论坛：{threadId, floor}
    if (target.type === 'forum') {
        const thread = (typeof forumThreads !== 'undefined' ? forumThreads : []).find(t => t.id === target.threadId);
        if (!thread) return;
        const isMain = target.floor === 1;
        const cur = isMain ? thread.content : ((thread.replies || []).find(r => r.floor === target.floor) || {}).content || '';
        const next = await appPrompt(isMain ? '修改主楼内容：' : `修改 ${target.floor} 楼的内容：`, cur);
        if (next === null || !next.trim() || next === cur) return;
        if (isMain) thread.content = next;
        else { const rp = (thread.replies || []).find(r => r.floor === target.floor); if (rp) rp.content = next; }
        saveAllData();
        if (typeof openForumThread === 'function') openForumThread(target.threadId);
        return;
    }

    // ② 匿名论坛：{postId, replyIdx}，评论存在 anonPosts 里
    if (target.type === 'anon') {
        const post = (typeof anonPosts !== 'undefined' ? anonPosts : []).find(p => String(p.id) === String(target.postId));
        const rp = post && post.replies && post.replies[target.replyIdx];
        if (!rp) return;
        const cur = rp.text || rp.content || '';
        const next = await appPrompt('修改这条评论：', cur);
        if (next === null || !next.trim() || next === cur) return;
        if (rp.text !== undefined) rp.text = next; else rp.content = next;
        saveAllData();
        if (typeof renderAnonPosts === 'function') renderAnonPosts();
        return;
    }

    // ③ 推文 / 营销号评论：{postId, replyIdx}
    const { postId, replyIdx } = target;
    const isTabloid = String(postId).startsWith('tb_');
    const post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId);
    const rp = post && post.replies && post.replies[replyIdx];
    if (!rp) return;
    const cur = rp.text || rp.content || '';
    const next = await appPrompt('修改这条评论：', cur);
    if (next === null || !next.trim() || next === cur) return;
    if (rp.text !== undefined) rp.text = next; else rp.content = next;
    saveAllData();
    if (document.getElementById('view-post-detail') && document.getElementById('view-post-detail').style.display !== 'none'
        && typeof renderSinglePostDetail === 'function') renderSinglePostDetail(postId);
    if (typeof renderPosts === 'function') renderPosts();
    if (isTabloid && typeof renderTabloidPosts === 'function') renderTabloidPosts();
}

async function contextActionDeleteReply() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (!replyContextMenuTarget) return;
    const target = replyContextMenuTarget; replyContextMenuTarget = null;

    // 论坛的删除目标形状是 {threadId, floor}，不是 {postId, replyIdx}，跟下面推文评论的删除逻辑分开处理
    if (target.type === 'forum') {
        const thread = forumThreads.find(t => t.id === target.threadId);
        if (!thread) return;
        if (target.floor === 1) {
            if (!(await appConfirm('确定要删除整个帖子（含所有回复）吗？该操作不可逆！'))) return;
            forumThreads = forumThreads.filter(t => t.id !== target.threadId);
            saveAllData();
            if (typeof renderForumList === 'function') renderForumList();
        } else {
            if (!(await appConfirm('确定删除这条回复吗？该操作不可逆！'))) return;
            thread.replies = (thread.replies || []).filter(r => r.floor !== target.floor);
            saveAllData();
            if (typeof openForumThread === 'function') openForumThread(target.threadId);
        }
        return;
    }

    // 匿名论坛的评论存在 anonPosts 里，不在 globalPosts/tabloidPosts 里——
    // 以前这里没分支，右键删匿名评论会一路走到"找不到"然后**静默返回**，点了跟没点一样。
    if (target.type === 'anon') {
        const ap = (typeof anonPosts !== 'undefined' ? anonPosts : []).find(p => String(p.id) === String(target.postId));
        if (!ap || !ap.replies || !ap.replies[target.replyIdx]) return;
        if (!(await appConfirm('确定删除这条评论吗？该操作不可逆！'))) return;
        ap.replies.splice(target.replyIdx, 1);
        saveAllData();
        if (typeof renderAnonPosts === 'function') renderAnonPosts();
        return;
    }

    const { postId, replyIdx } = target;
    let isTabloid = postId.startsWith('tb_');
    const post = isTabloid ? tabloidPosts.find(p => p.id == postId) : globalPosts.find(p => p.id == postId);
    if (!post || !post.replies || !post.replies[replyIdx]) return;
    if (!(await appConfirm('确定删除这条评论吗？该操作不可逆！'))) return;
    post.replies.splice(replyIdx, 1);
    post.stats.comments = Math.max(0, (parseInt(post.stats.comments) || 1) - 1);
    saveAllData();
    if (document.getElementById('view-post-detail').style.display !== 'none') renderSinglePostDetail(postId);
    if (isTabloid && document.getElementById('view-tabloid').style.display !== 'none') renderTabloidPosts();
}

async function contextActionDeleteChat() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (chatContextMenuMsgIdx === null) return; const idx = chatContextMenuMsgIdx, sessionId = currentChatSessionId;
    if (!globalChats[sessionId] || !globalChats[sessionId][idx]) return;
    if (!(await appConfirm('确定删除这条消息吗？该操作不可逆！'))) return;
    globalChats[sessionId].splice(idx, 1);
    renderChatMessages(); saveAllData();
    chatContextMenuMsgIdx = null;
}

async function contextActionEditChat() {
    if (chatContextMenuMsgIdx === null) return; const idx = chatContextMenuMsgIdx, sessionId = currentChatSessionId, msg = globalChats[sessionId][idx];
    document.getElementById('chatContextMenu').style.display = 'none';
    let newText = await appPrompt("重新编辑您的消息：", msg.text); if (newText === null || newText.trim() === "") return;
    msg.text = newText.trim(); globalChats[sessionId].splice(idx + 1); renderChatMessages(); saveAllData();
    await triggerAIBatchReply(sessionId, msg.text);
}

// ✏️ 编辑角色说过的话。
//
// 跟上面"重新编辑自己的消息"不是一回事，别看着像就合并：
//   改自己的话 = "我刚才那句重说一遍" → 后面的对话作废，砍掉重新生成；
//   改角色的话 = "就当TA当时是这么说的" → 后面的对话全都还算数，一条都不许动。
// 所以这里既不 splice 也不重新请求AI。
//
// 真正麻烦的是"各处都同步"。这句话不只存在气泡里，还散落在好几个地方，
// 只改 msg.text 的话会出现"改完了，但别的地方还是旧的"：
//   · msg.swipes —— 侧滑抽卡的当前这张。不改的话左右滑一下，改动就被旧版本盖回去了。
//   · 别的消息里的 msg.quote —— 引用回复存的是**当时那句话的文字副本**，不是指针。
//   · memoryAlbum —— 收藏进回忆相册时同样存的是副本。
//   · msg.embVec —— 向量记忆的 embedding 是按旧文字算出来的，不清掉，
//                    语义检索还会拿着旧内容去匹配，角色"记得"的还是没改之前那句。
//
// 有一样确实同步不了，也不装作能同步：**已经生成过的聊天总结**。那是模型读完一段对话
// 之后自己写的一段话，不是这句话的副本，没法定位到"哪几个字来自这条消息"。
// 所以改完之后给一句明确提示，让用户自己决定要不要重新总结，而不是让他以为全同步了。
async function contextActionEditCharMsg() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (chatContextMenuMsgIdx === null || !currentChatSessionId) return;
    const sessionId = currentChatSessionId, idx = chatContextMenuMsgIdx;
    const msg = (globalChats[sessionId] || [])[idx];
    if (!msg || msg.sender === 'system' || msg.sender === 'me') return;

    const oldText = msg.text || '';
    const senderChar = myCharacters.find(c => c.id == msg.sender);
    const senderName = (senderChar && senderChar.name) || '未知';

    const newTextRaw = await appPrompt(`编辑「${senderName}」的这条消息（后面的对话不会被删掉）：`, oldText);
    if (newTextRaw === null) return;
    const newText = String(newTextRaw).trim();
    if (!newText) return alert('内容不能为空。想让这条消失请用"删除消息"。');
    if (newText === oldText) return;

    msg.text = newText;
    msg.editedAt = Date.now();

    // 1) 侧滑抽卡的当前这张也跟着改，否则左右滑一下就被旧版本盖回去
    if (Array.isArray(msg.swipes) && msg.swipes.length) {
        let cIdx = msg.currentSwipe || 0;
        if (cIdx >= 0 && cIdx < msg.swipes.length) msg.swipes[cIdx] = newText;
    }

    // 2) 所有会话里引用了这句话的快照
    let quoteFixed = 0;
    Object.keys(globalChats).forEach(sid => {
        (globalChats[sid] || []).forEach(m => {
            if (m && m.quote && m.quote.text === oldText && (!m.quote.name || m.quote.name === senderName)) {
                m.quote.text = newText; quoteFixed++;
            }
        });
    });

    // 3) 回忆相册里收藏过的副本
    let memFixed = 0;
    if (typeof memoryAlbum !== 'undefined' && Array.isArray(memoryAlbum)) {
        memoryAlbum.forEach(m => {
            if (m && m.type === 'chat' && m.text === oldText && (m.refId == sessionId || m.charId == sessionId)) {
                m.text = newText; memFixed++;
            }
        });
    }

    // 4) 向量记忆：旧向量必须作废，不然检索出来的还是改之前那句
    if (msg.embVec) delete msg.embVec;

    renderChatMessages();
    saveAllData();
    if (typeof embedMessageInBackground === 'function') embedMessageInBackground(msg);

    // 改完给个明确回执：哪些地方跟着改了、哪一样确实改不了。不留"点了好像有反应又好像没有"的空档。
    const parts = ['已改这条消息'];
    if (quoteFixed) parts.push(`同步了 ${quoteFixed} 处引用`);
    if (memFixed) parts.push(`同步了 ${memFixed} 条回忆收藏`);
    const note = parts.join('，') + '。已经生成过的聊天总结里是模型自己写的话，没法逐句对应，需要的话可以重新总结一次。';
    if (typeof showToast === 'function' && senderChar) showToast(getAvatarHTML(senderChar, 40), '已修改', note, null, null);
    else alert(note);
}

// 🌳 开辟分支（保留旧对话）：复制一份角色和到目前为止的聊天记录，另开一条独立时间线
window.contextActionBranchChat = async function() {
    document.getElementById('chatContextMenu').style.display = 'none';
    if (chatContextMenuMsgIdx === null || !currentChatSessionId) return;
    if (currentChatSessionId.startsWith('g_')) return alert("群聊暂不支持分支功能！");

    const char = myCharacters.find(c => c.id == currentChatSessionId);
    if (!char) return;

    const branchName = await appPrompt("为这条新的分支起个名字吧（原角色和聊天记录都会保留不变）：", char.name + " (分支)");
    if (!branchName) return;

    // 克隆出一个属于这条新分支的角色副本
    const newChar = JSON.parse(JSON.stringify(char));
    newChar.id = Date.now().toString();
    newChar.name = branchName;
    newChar.branchedFrom = char.id;
    newChar.branchedFromName = char.name;
    myCharacters.unshift(newChar); // 放在列表最前面

    // 把当前聊天记录复制到断点处，分支和原对话各自独立，谁都不会被覆盖
    const chatClone = JSON.parse(JSON.stringify(globalChats[currentChatSessionId].slice(0, chatContextMenuMsgIdx + 1)));
    globalChats[newChar.id] = chatClone;

    saveAllData();
    renderChatCharList();
    switchChatSession(newChar.id);
    alert(`🌳 分支创建成功！当前处于【${branchName}】，原来的对话还在【${char.name}】里，两边互不影响。`);
};

// 🔄 侧滑重新生成
window.contextActionRegenerateChat = async function() {
    if (chatContextMenuMsgIdx === null) return;
    const idx = chatContextMenuMsgIdx, sessionId = currentChatSessionId;
    document.getElementById('chatContextMenu').style.display = 'none';

    const msg = globalChats[sessionId][idx];
    if (msg.sender === 'me' || msg.sender === 'system') return alert("只能重新生成角色的回复！");

    const char = myCharacters.find(c => c.id == msg.sender);
    if (!char) return;

    const historyForPrompt = globalChats[sessionId].slice(0, idx);
    const recentHistory = buildTimeAwareHistoryText(historyForPrompt.slice(-chatHistoryTurns));
    const historyTurns = buildTimeAwareHistoryTurns(historyForPrompt.slice(-chatHistoryTurns), char.name);

    const api = getApiMain();
    if (!api.key) return alert("请先配置 API Key！");

    let oldText = msg.text;
    msg.text = "🔄 尝试新路线中...";
    renderChatMessages();

    let emoPrompt = typeof getEmoticonPrompt === 'function' ? getEmoticonPrompt() : '';
    let actionTagReminder = allowActionTags
        ? `\n【重要格式要求】：你可以且应该适度使用括号（如()或【】）穿插动作、神态、心理描写，让对话更有画面感。\n`
        : `\n【重要格式要求】：绝对不要有任何动作、神态或心理描写，不要使用括号()或【】，只输出你直接说出的话。\n`;
        
    // 💡 修复：让重新生成的提示词也严格遵守 JSON 格式
    // 💡 再修复：这段文案原来把"不超过chatWordLimit字"写死了，不看"聊天回复条数/长度模式"，
    //    导致经典模式下一侧滑重新生成就变回可控字数模式的短回复。现在统一走 getChatRegenReplyBlock()。
    let multiReplyBlock = getChatRegenReplyBlock();

    // 结构化消息改造：历史记录改成独立的user/assistant轮次，不再拼进正文文本里
    let systemText = `${buildBasePrompt(char, true, recentHistory)}${getRecentPostsAwarenessText(char)}${getTimeAwarenessPrompt(sessionId, char)}${getChatNaturalnessPrompt()}`;
    let finalUserText = `请尝试一条全新的思路重新生成你的最新回复。
${emoPrompt}
${actionTagReminder}
${multiReplyBlock}`;
    let prompt = buildStructuredMessages(systemText, historyTurns, finalUserText);

    try {
        let data = await callChatCompletionAPI(api, prompt);
        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        
        let repText = "";
        let repMediaUrl = null;
        
        // 💡 修复：加入 JSON 解析逻辑（改用 extractJsonObject，能容错AI输出里常见的裸换行/多余逗号等小毛病）
        try {
            let parsed = extractJsonObject(rawText);
            if (parsed) {
                runPluginResponseHooks(char, sessionId, parsed);
                if (parsed.stateUpdate) saveCharLifeState(char, parsed.stateUpdate, parsed.statusTypeLabel);
                if (typeof aliveCaptureMood === 'function') aliveCaptureMood(char, parsed);   // 🫀 情绪惯性

                if (parsed.replies && Array.isArray(parsed.replies) && parsed.replies.length > 0) {
                    // 模型有时写成 content / message / 直接字符串——都认；空的那几条不要（以前会拼出一个只有换行的空气泡）
                    repText = parsed.replies.map(r => typeof r === 'string' ? r : (r && (r.text || r.content || r.message || r.msg)) || '')
                        .map(t => String(t).trim()).filter(Boolean).join('\n');
                } else if (parsed.stateUpdate) {
                    repText = `(${parsed.stateUpdate})`;
                } else {
                    repText = rawText;
                }
            } else {
                repText = rawText;
            }
        } catch (err) {
            repText = rawText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
        }

        // 思维链、只剩空白的，都不算写出东西来
        if (typeof stripReasoningBlocks === 'function') { try { repText = stripReasoningBlocks(repText); } catch (e) {} }
        repText = String(repText || '').trim();
        if (repText && /^NO\b[.。!！]?$/i.test(repText)) repText = '';
        if (repText) {
            let emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
            if (emoMatch && typeof globalEmoticons !== 'undefined') {
                let emo = globalEmoticons.find(e => e.id === emoMatch[1]);
                if (emo) repMediaUrl = emo.url;
                repText = repText.replace(emoMatch[0], '').trim();
            }
            repText = applyRegexScripts(repText, 'ai_output', char.id);
            // 显示出来是不是空的（比如整段被正则换成了看不见的东西）——空的就别存成新的一版
            const shown = (typeof renderPlainChatText === 'function') ? renderPlainChatText(repText).replace(/<br>/g, '').trim() : repText.trim();
            if (!shown && !repMediaUrl && !(typeof gyExtractChatStatus === 'function' && gyExtractChatStatus(repText, char.id).seg)) {
                msg.text = oldText; renderChatMessages();
                try { showToast('', '这次没写出内容', '模型返回的是空的，原来那版还在；再点一次重新生成试试', null, null, false); } catch (e) {}
                return;
            }

            if (!msg.swipes) { msg.swipes = [oldText]; msg.currentSwipe = 0; }
            msg.swipes.push(repText);
            msg.currentSwipe = msg.swipes.length - 1;
            msg.text = repText;
            if (repMediaUrl) msg.mediaUrl = repMediaUrl;

            saveAllData(); renderChatMessages();
        } else {
            msg.text = oldText; renderChatMessages();
            try { showToast('', '这次没写出内容', '模型返回的是空的，原来那版还在；再点一次重新生成试试', null, null, false); } catch (e) {}
        }
    } catch(e) { msg.text = oldText; renderChatMessages(); alert("生成失败：" + e.message); }
};

// ◀ ▶ 控制侧滑翻页
window.swipeMessage = function(sessionId, msgIdx, direction) {
    let msg = globalChats[sessionId][msgIdx];
    if (!msg || !msg.swipes || msg.swipes.length <= 1) return;
    let cIdx = msg.currentSwipe || 0;
    cIdx += direction;
    if (cIdx < 0) cIdx = msg.swipes.length - 1;
    if (cIdx >= msg.swipes.length) cIdx = 0;
    msg.currentSwipe = cIdx;
    msg.text = msg.swipes[cIdx];
    saveAllData();
    renderChatMessages();
};
function contextActionReplyChat() { if (!chatContextMenuTarget) return; pendingChatQuote = chatContextMenuTarget; document.getElementById('chatQuoteName').innerText = pendingChatQuote.name; document.getElementById('chatQuoteText').innerText = pendingChatQuote.text; document.getElementById('chatQuotePreview').style.display = 'flex'; document.getElementById('chatInput').focus(); chatContextMenuTarget = null; document.getElementById('chatContextMenu').style.display = 'none'; }
function clearChatQuote() { pendingChatQuote = null; document.getElementById('chatQuotePreview').style.display = 'none'; }

// 用户短时间内连续发好几条消息时，等一小会儿再统一触发AI回复、把这几条一起回应，而不是每发一条就立刻触发一次、
// 角色逐条分别回复（那样容易显得很割裂，也容易让角色只顾着回最新一条、前面几句等于白发）。
// 按会话id分别计时：连续发消息会不断重置这个计时器，真正停下来不再发之后，稍等一下才会统一触发。
let pendingBatchReplyTimers = {};
let pendingBatchReplyTexts = {};
/* 自动模式下点了发送要等多久才让 TA 开口。
   以前写死 5000ms：连着说几句会合并成一次回复，代价是**每一句都要干等五秒**，
   而绝大多数时候你就发一句，那五秒纯属白等。
   现在默认 0＝点了就回。想恢复"等一会儿合并"就把下面这个数调大
   （设置 → 💬 互动与描写 → 什么时候让 TA 回）。 */
let CHAT_BATCH_REPLY_DELAY_MS = 0;
window.gySetChatBatchDelay = function (sec) {
    const n = Math.max(0, gyNum(sec, 0));
    CHAT_BATCH_REPLY_DELAY_MS = n * 1000;
    try { window.gyChatBatchDelaySec = n; if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    return n;
};

// 🔁 输入框空着点「发送」＝ 让 AI 把上一轮重新回一次。
//
// 场景：角色回的这条不满意，右键删掉。删完最后一条就是你自己说的话了，
// 但发送键这时候是**哑的**（原来的逻辑是"没内容就 return"），只能靠再打一遍
// 一模一样的话来催它重来——很别扭。
// 现在空着点发送就直接拿最后那几条你说的话重新触发一次回复。
//
// 只在"最后一条是你说的"时候才生效。要是最后一条是角色说的，那说明这一轮
// 它已经回过了，重新生成应该走气泡上的「🔄 侧滑重新生成」——那个会把旧回复
// 存成 swipe 可以左右切换，比在这儿凭空再生一条更合适。
function collectTrailingMyTexts(msgs) {
    const out = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (!m) continue;
        if (m.sender === 'system') continue;          // 拍一拍之类的系统提示不算打断
        if (m.sender !== 'me') break;                 // 遇到角色说的话就停
        if (m.text) out.unshift(m.text);
    }
    return out;
}
async function retriggerLastReply(sessionId) {
    const msgs = globalChats[sessionId] || [];
    const mine = collectTrailingMyTexts(msgs);
    if (mine.length === 0) {
        // 不能默默地什么都不做——那又变成"点了没反应"了，得说清楚为什么
        const last = msgs.filter(m => m && m.sender !== 'system').slice(-1)[0];
        showToast('<div class="avatar" style="width:40px;height:40px;">💬</div>', '没什么可以重新生成的',
            last ? '最后一条是角色说的。想让这条重来，右键点它选「🔄 侧滑重新生成」，旧的那条会留着能左右切换。'
                 : '这里还没有消息。', null, null);
        return;
    }
    // 防连点：正在等这个会话回复时不再叠一次
    if (pendingBatchReplyTimers[sessionId] || (currentlyTypingChars && currentlyTypingChars.size > 0)) return;
    await triggerAIBatchReply(sessionId, mine.join('\n'));
}

async function sendChatMessage() {
    if (!currentChatSessionId) return; const sessionId = currentChatSessionId; const input = document.getElementById('chatInput'); let text = input.value.trim();
    /* 🖐️ 手动模式：输入框空着再点一次发送＝"好了，你回吧"。
       以前这件事挂在输入框右边一颗单独的「回复」按钮上，白占一格。
       攒着的那几句一起交给 TA（跟自动模式合批一样）；一句都没攒就当"再回一次"。 */
    if (!text && !pendingChatAttachment
        && typeof gyChatReplyMode !== 'undefined' && gyChatReplyMode === 'manual') {
        return gyChatReplyNow();
    }
    if (!text && !pendingChatAttachment) return retriggerLastReply(sessionId);
    text = applyRegexScripts(text, 'user_input');
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const myMsg = { sender: 'me', text: text, timestamp: Date.now(), mediaUrl: pendingChatAttachment, readBy: [], quote: pendingChatQuote };
    globalChats[sessionId].push(myMsg);
    let triggerText = text; input.value = ''; clearAttachment('chat'); clearChatQuote(); renderChatMessages(); saveAllData(); checkAndAutoSummarizeChat(sessionId);
    embedMessageInBackground(myMsg);

    // 累积这一条到"待发送批次"里，重置计时器；真正停下来不再连发之后才会统一触发一次AI回复
    if (!pendingBatchReplyTexts[sessionId]) pendingBatchReplyTexts[sessionId] = [];
    pendingBatchReplyTexts[sessionId].push(triggerText);
    if (pendingBatchReplyTimers[sessionId]) clearTimeout(pendingBatchReplyTimers[sessionId]);
    /* 🖐️ 手动回复模式：消息照常发出去，但**不自动叫 TA 回**。
       想让 TA 回的时候点输入框右边那颗「回复」。
       为什么要有这一档：有时候你想连着说好几句、想先把话说完再等回应，
       也有时候只是想把一句话记在聊天里，不想立刻花一次调用。 */
    if (typeof gyChatReplyMode !== 'undefined' && gyChatReplyMode === 'manual') {
        pendingBatchReplyTimers[sessionId] = null;
        try { gyPaintReplyBtn(); } catch (e) {}
        return;
    }
    pendingBatchReplyTimers[sessionId] = setTimeout(() => {
        const batchTexts = pendingBatchReplyTexts[sessionId] || [];
        pendingBatchReplyTexts[sessionId] = [];
        pendingBatchReplyTimers[sessionId] = null;
        if (batchTexts.length === 0) return;
        const combinedText = batchTexts.join('\n');
        triggerAIBatchReply(sessionId, combinedText);
    }, (typeof gyTaBatchDelayMs === 'function') ? gyTaBatchDelayMs(sessionId, CHAT_BATCH_REPLY_DELAY_MS) : CHAT_BATCH_REPLY_DELAY_MS);
}

/* 🖐️「回复」：手动模式下把攒着的那几句一次交给 TA。
   攒了几句就一起给，跟自动模式合批的行为一致——
   TA 看到的是"你连着说了这几句"，不是分开的几轮。 */
async function gyChatReplyNow() {
    const sessionId = currentChatSessionId;
    if (!sessionId) return;
    const batch = pendingBatchReplyTexts[sessionId] || [];
    pendingBatchReplyTexts[sessionId] = [];
    if (pendingBatchReplyTimers[sessionId]) { clearTimeout(pendingBatchReplyTimers[sessionId]); pendingBatchReplyTimers[sessionId] = null; }
    try { gyPaintReplyBtn(); } catch (e) {}
    if (batch.length) return triggerAIBatchReply(sessionId, batch.join('\n'));
    // 一句新的都没有：当成"再回一次"（比如你想让 TA 接着上一句继续）
    return retriggerLastReply(sessionId);
}
/* 手动模式下"攒了几句"写在哪儿。
   以前是输入框右边那颗「回复」按钮上标个数字——那颗按钮已经去掉了（空着点发送就是回复），
   所以改成写进输入框的提示文字里：不多占地方，又能让人知道现在按发送会发生什么。
   （那颗按钮的 id 万一还在页面上，也顺手照旧维护一下，不至于变成死按钮。） */
function gyPaintReplyBtn() {
    const manual = (typeof gyChatReplyMode !== 'undefined' && gyChatReplyMode === 'manual');
    const n = ((typeof currentChatSessionId !== 'undefined' && pendingBatchReplyTexts[currentChatSessionId]) || []).length;
    const b = document.getElementById('chatReplyNowBtn');
    if (b) {
        b.style.display = manual ? '' : 'none';
        b.innerText = n ? `回复 ${n}` : '回复';
        b.classList.toggle('waiting', n > 0);
    }
    const input = document.getElementById('chatInput');
    if (input && !input.value) {
        input.placeholder = manual
            ? (n ? `攒了 ${n} 句 · 再点发送就让 TA 回` : '输入消息…（空着点发送＝让 TA 回）')
            : '输入消息...';
    }
}

async function triggerAIBatchReply(sessionId, triggerText, aliveCatchUp) {
    // 🫀 TA 不总是在线：睡着/在忙的时候先把消息挂起来，等 TA 那段过去了再一次性回（见 js/06）
    //    aliveCatchUp 有值＝这一轮就是"补回"，门卫直接放行，不要再挂一次。
    let aliveCatch = aliveCatchUp || null;
    if (!aliveCatchUp && typeof aliveGate === 'function') {
        const g = aliveGate(sessionId, triggerText);
        if (g && g.hold) return;
        if (g && g.text) triggerText = g.text;
        if (g && g.catchUp) aliveCatch = g.catchUp;
    }
    const api = getApiMain(); 
    if (!api.key) return alert("请先配置 API Key！");
    
    let emoPrompt = getEmoticonPrompt(), isGroup = sessionId.startsWith('g_'), targetChars = [];
    let groupObj = null, speakOrder = 'all';
    if (isGroup) {
        groupObj = groupChats.find(x => x.id === sessionId);
        if (groupObj) {
            // 临时禁言成员（mutedMembers）：被禁言的成员这一轮完全跳过，不参与AI回复判断，等于暂时把TA从"会说话的人"里摘出去，
            // 跟踢出群/删除角色不是一回事——群聊列表、历史消息、角色本身都完全不受影响，随时可以在群聊选项里取消禁言。
            const muted = new Set(groupObj.mutedMembers || []);
            targetChars = groupObj.members.filter(id => !muted.has(id)).map(id => myCharacters.find(c => c.id == id)).filter(Boolean);
            speakOrder = groupObj.speakOrder || 'all';
            if (speakOrder === 'random') { for (let i = targetChars.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [targetChars[i], targetChars[j]] = [targetChars[j], targetChars[i]]; } }
            /* 🗣️「让角色自己决定谁先开口」：顺序不是固定也不是随机，是**按性格排**。
               群里谁先说话本来就不是掷骰子——话多的抢先，刚被点名的自然接话，
               跟你熟的更容易开口，慢热的等别人说完。全是现成数据，不调 API。 */
            if (speakOrder === 'self') {
                const txt = String(triggerText || '');
                const score = c => {
                    let v = 0;
                    if (txt.indexOf(c.name) >= 0) v += 40;                       // 刚被提到
                    try { if (window.gyRel && window.gyRel.score) v += Math.min(30, Number(window.gyRel.score(c.id)) || 0); } catch (e) {}
                    const p = String(c.persona || '');
                    if (/话多|聒噪|自来熟|外向|爱说|活泼|热情|八卦/.test(p)) v += 25;
                    if (/寡言|冷淡|沉默|内向|慢热|不爱说话|少言|面瘫/.test(p)) v -= 25;
                    v += Math.min(10, ((globalChats[sessionId] || []).filter(m => String(m.sender) === String(c.id)).length) / 5);
                    return v + Math.random() * 8;                                // 一点点抖动，免得每次一模一样
                };
                targetChars.sort((a, b) => score(b) - score(a));
            }
        }
    } 
    else { let c = myCharacters.find(c => c.id == sessionId); if (c) targetChars = [c]; }

    let currentBatchText = triggerText, anyCharReplied = false;
    // 每个角色的"私聊时间线"各自独立跑，最后统一等一下再收尾（标已读/存档）
    let pendingPrivateChains = [];
    let semanticContextCache = {}; // 按角色缓存，避免群聊里给每个角色重复请求 embedding

    // 🆕 识图：把这一批用户刚发的消息里带的图片（不管是拍的照片还是从表情/图片库选的）一并收集起来，
    // 交给支持识图的模型（callChatCompletionAPI 的 images 参数），让角色能真正"看到"图里是什么再回复，
    // 而不是完全无视图片、只根据文字瞎猜。只往前找连续的"me"消息（这一批还没被回复的），不翻查更早的历史。
    let batchImages = [];
    {
        const msgs = globalChats[sessionId] || [];
        for (let i = msgs.length - 1; i >= 0 && msgs[i].sender === 'me'; i--) {
            if (msgs[i].mediaUrl) batchImages.unshift(msgs[i].mediaUrl);
        }
    }

    for (let char of targetChars) {
        let isMentioned = isGroup ? (currentBatchText.includes('@所有人') || currentBatchText.includes('@' + char.name) || ((char.handle||'').replace('@','').toLowerCase() && currentBatchText.toLowerCase().includes('@' + (char.handle||'').replace('@','').toLowerCase()))) : true;
        if (isGroup && speakOrder === 'mentioned' && !isMentioned) continue; // 仅@到的人回复模式：没被@就完全跳过，不给AI判断机会
        
        // 结构化消息改造：以前是把人设/世界书/聊天记录/各种指令全部拼成一整段文本塞进一条user消息；
        // 现在拆成 system（人设+世界书+语义上下文+时间感知等"背景设定"部分）+ 按发言人分开的历史轮次
        // （user/assistant交替，不再是一整段夹在中间的文本）+ 最后一条user消息（"这一轮到底要AI做什么"
        // 的任务指令）。recentHistory这个文本版本仍然保留：buildBasePrompt内部要靠它做世界书关键词
        // 触发判断，这个用途和"要不要把历史拼进prompt正文"是两回事，不能删。
        let recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
        // groupMode 一定要传：群聊的历史必须带上说话人名字，否则模型分不清哪句是自己说的
        // （这正是"群里角色乱回复、记不住人设"的根源，详见 js/06 那个函数顶上的说明）
        let historyTurns = buildTimeAwareHistoryTurns(globalChats[sessionId].slice(-chatHistoryTurns), char.name, { groupMode: isGroup });

        // 预设系统的"深度注入"模块：不跟着系统提示词固定堆在最前面，而是插到聊天历史里对应的深度位置
        // （比如"倒数第4条消息前"），效果更接近真正打断/介入对话，而不是一股脑全塞在开头容易被后面内容盖过去。
        if (typeof getActivePresetDepthEntries === 'function' && typeof insertTextAtDepth === 'function') {
            getActivePresetDepthEntries(char, sessionId).forEach(entry => insertTextAtDepth(historyTurns, entry.depth, entry.content));
        }

        // 世界书条目里选了"[系统/用户/AI]插入深度"的，同理精确插到聊天历史对应深度位置（可以指定用哪个身份说这句话）；
        // 选了"作者注释之前/之后"的，先摘出来，等下跟导演耳语文本拼在一起、按同一个深度/位置一起插入，见下方。
        let wbEntriesForChat = (typeof getCharacterWorldbookEntries === 'function') ? getCharacterWorldbookEntries(char, recentHistory, sessionId) : [];
        if (typeof getWorldbookDepthEntries === 'function' && typeof insertTextAtDepth === 'function') {
            getWorldbookDepthEntries(wbEntriesForChat).forEach(entry => insertTextAtDepth(historyTurns, entry.depth, entry.content, entry.role));
        }
        let wbAnAnchor = (typeof getWorldbookAnAnchorText === 'function') ? getWorldbookAnAnchorText(wbEntriesForChat) : { before: '', after: '' };

        let replyRule = (isMentioned || (isGroup && speakOrder === 'sequential')) ? `你被艾特了（或这是私聊，或本群设置了轮流发言），你【必须】回复，不能输出"NO"。` : (isGroup ? `如果觉得群里没人理你且无需回复，直接输出"NO"。` : `如果不知道怎么回可以输出"NO"。`);
        if (semanticContextCache[char.id] === undefined) semanticContextCache[char.id] = await getSemanticContext(sessionId, char, triggerText);
        let semanticContext = semanticContextCache[char.id];

       // 📝 导演耳语（Author's Note）：支持"每隔N条消息才提醒一次"（频率）和"插到倒数第几条消息位置"（深度）两个设置，
       // 不再是每次都无条件原样塞在prompt末尾。频率=1或没填时每轮都生效，跟以前行为一样；深度=0或没填时也还是老位置（prompt末尾）。
        let anInput = document.getElementById('chatAuthorsNote');
        let anBox = document.getElementById('chatAuthorsNoteBox');
        let anText = (anInput && anBox && anBox.style.display !== 'none') ? anInput.value.trim() : '';
        let anFreq = Math.max(1, parseInt(document.getElementById('anFrequencyInput')?.value) || 1);
        let anDepth = Math.max(0, parseInt(document.getElementById('anDepthInput')?.value) || 0);
        let turnCountNow = (globalChats[sessionId] || []).length;
        let anShouldFire = !!anText && (anFreq <= 1 || turnCountNow % anFreq === 0);
        let anPrompt = '';
        // 世界书"作者注释之前/之后"的内容，不管这一轮导演耳语本身有没有触发，都跟着作者注释这个锚点位置一起插入
        // （锚点本身是个位置概念，不依赖这一轮到底有没有填耳语文本），避免选了这个位置的世界书条目因为耳语没触发就白白丢失。
        const anBodyParts = [wbAnAnchor.before, anShouldFire ? `【导演耳语 (Author's Note) - 最高优先级上帝指令】：\n${anText}` : '', wbAnAnchor.after].filter(Boolean);
        if (anBodyParts.length > 0) {
            const anFullText = anBodyParts.join('\n\n');
            if (anDepth > 0) { insertTextAtDepth(historyTurns, anDepth, anFullText); }
            else { anPrompt = `\n\n${anFullText}\n`; }
        }

        // ⚠️ 修复"角色不看用户发了什么、一直重复旧话题"的bug：
        // 之前最新消息只是被埋在很长的历史记录文本中间，容易被模型忽略。这里把它单独提出来，
        // 放在prompt末尾（模型注意力通常更集中在结尾），并明确要求必须针对这条最新内容来回复。
        // 结构化消息里历史记录本身已经是独立的轮次了，这条提醒依然有价值（防止模型只盯着更早的话题），继续保留。
        // 修复"用户连发好几条消息，角色只回应最后一条"：triggerText 现在可能是"用户短时间内连发的好几条消息
        // 合并后的内容"（见 sendChatMessage 的合并发送去抖逻辑），不再只取 globalChats 最后一条——
        // 不然合并逻辑再怎么做，这里最终提醒AI的还是只有最后一句，等于白合并。
        let latestMsgText = `${currentUser.name}：${triggerText}`;
        let latestEmphasis = `\n\n【⚠️最新消息 - 请务必围绕这些来回复（如果是好几条连着发的，说明用户是一口气说完的，要整体理解、一起回应，不要只挑最后一句），不要无视它、也不要延续更早之前已经聊完的旧话题】：\n${latestMsgText}\n` +
            // 🖐️ 手动模式下攒了好几句时，再补一句"这是一条话，别一句一句分开答"（js/49，可关）
            ((typeof window.gyBatchOneNote === 'function') ? window.gyBatchOneNote(triggerText) : '');

        // ⚠️ 修复"开启了动作/心理描写开关，但角色还是没有动作描写"的bug：
        // 之前这条规则只在 buildBasePrompt 里出现一次，位置偏早，容易被后面"真人聊天铁律"里大段
        // 强调"短句为主、别写小说化描写"的内容盖过去。这里在prompt末尾再明确重申一次，位置越靠后模型越重视。
        let actionTagReminder = allowActionTags
            ? `\n【重要格式要求】：你可以且应该适度使用括号（如()或【】）穿插动作、神态、心理描写，让对话更有画面感——这和"像真人一样自然聊天"并不冲突，不要因为追求聊天感就完全省略掉这些描写。\n`
            : `\n【重要格式要求】：绝对不要有任何动作、神态或心理描写，不要使用括号()或【】，只输出你直接说出的话。\n`;
        
        let multiReplyBlock = getChatMultiReplyBlock();

        // 群聊转私聊：角色看完群里的对话，可以自己决定要不要私下来找用户说这件事。
        // 只在**群聊**里给这个选项——1v1本来就是私聊，再"转私聊"没有意义，白占提示词。
        // 跟推特评论区那个转私聊是同一套机制（[MOVETOCHAT] + deliverCharMoveToChatMessage），
        // 但开关是分开的：群里当着大家的面不好说的话，和评论区不想公开回应，是两回事。
        let groupMoveToChatOption = (isGroup && (typeof enableGroupMoveToChat === 'undefined' || enableGroupMoveToChat))
            ? `\n【额外选项·可以私戳】：如果群里聊到的事你不想当着大家的面接、只想单独跟${userDisplayName()}说，就在那条回复的最前面加上"[MOVETOCHAT]"，紧跟着写你想私下说的话（例：[MOVETOCHAT]刚才那事我们私下说吧），这条会变成私聊消息发给${userDisplayName()}，群里的人看不到。
可以加不止一条，也**可以一边在群里正常接话、一边私戳TA**——真人本来就是这样：群里说着场面话，私聊里说真话，两边同时进行。所以不用二选一，该在群里说的照常在群里说，同时把不方便公开的那句单独标出来就行。
用不用、用几条你自己判断。大部分话本来就该在群里说，别每次都用；不想用就正常回复，什么都不用加。\n`
            : '';

        // 🆕 AI自主引用最近消息：给一份编号列表，AI自己判断这一轮要不要引用、引用哪条
        let quotable = buildQuotableRecentMessages(sessionId, char, isGroup);

        // 注：这里原来加过一大段「群聊身份说明」，已经删掉了。
        // 删的原因不是它没用，是它把别的功能弄坏了：那段里写着"你只输出你自己要说的话"，
        // 跟上面 actionTagReminder 里"你可以且应该适度使用括号穿插动作、神态、心理描写"
        // 直接冲突——模型只能二选一，结果就是**开着动作描写开关，群聊里角色却不写动作了**。
        //
        // "群里角色分不清谁说的话"这个问题不靠加提示词解决，靠的是
        // buildTimeAwareHistoryTurns 在群聊历史里给每条发言加上"名字："前缀
        // （见 js/06 那个函数顶上的说明）。那是**数据格式**层面的修复，不占提示词、
        // 不跟任何设定打架，效果也更稳。

        let systemText = `${buildBasePrompt(char, true, recentHistory, { sessionId, excludeDepthPresetEntries: true, excludeWorldbookPositions: ['at_depth', 'before_an', 'after_an'], precomputedWbEntries: wbEntriesForChat })}${semanticContext}${getRecentPostsAwarenessText(char)}${getTimeAwarenessPrompt(sessionId, char)}${getChatNaturalnessPrompt()}`;
        let finalUserText = `${replyRule}
你可以通过输出 [NUDGE] 主动拍一拍用户。也可艾特别人。
${emoPrompt}
${quotable.promptText}
${anPrompt}
${latestEmphasis}
${groupMoveToChatOption}${(typeof window.gyChatActsPrompt === 'function') ? window.gyChatActsPrompt(char, isGroup) : ''}${(typeof gyNowAnchorNote === 'function') ? gyNowAnchorNote() : ''}
${actionTagReminder}
${multiReplyBlock}${(typeof aliveMoodFormatNote === 'function') ? aliveMoodFormatNote() : ''}${(typeof aliveCatchUpPrompt === 'function') ? aliveCatchUpPrompt(aliveCatch) : ''}`;
        let prompt = buildStructuredMessages(systemText, historyTurns, finalUserText);

        try {
            if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') { currentlyTypingChars.add(char.name); updateTypingIndicator(); }
            // ===== 取回复：流式和非流式塞进同一个队列，下面的消费循环一行都不用分叉 =====
            // 聊天要模型返回一整段 {"replies":[...]} 的JSON，半截JSON贴进气泡是乱码，所以聊天的
            // 流式不是"按字"而是"按气泡"：一边收一边扫，数组里哪条写完了就立刻入队发出去，
            // 模型还在写第二条的时候第一条已经出现在屏幕上了。
            // 流式关掉（或接口不支持流式、原生App壳子）时 streamCompletionText 会自动退回普通请求，
            // 这里 streamedCount 保持 0，全部由下面那次完整解析一次性入队 —— 就是老行为。
            const replyQueue = [];
            let queueClosed = false, queueWake = null, streamedCount = 0;
            const pushReply = (r) => { if (!r) return; replyQueue.push(r); if (queueWake) { const w = queueWake; queueWake = null; w(); } };
            const closeQueue = () => { queueClosed = true; if (queueWake) { const w = queueWake; queueWake = null; w(); } };

            let data = null;
            let statusOutside = '';   // 模型把状态栏写在 JSON 外面（或者单独一截）时收在这儿，回复发完挂到最后一条上
            const turnStartedAt = Date.now();
            // 流式结束（或压根没走流式）后做一次完整解析：stateUpdate、插件钩子、格式没对上的兜底
            // 都还在这里，跟以前一模一样。唯一多出来的是最后那个 for —— 只补流式还没发过的部分，
            // 不然同一条会发两遍。
            const finalizeReplies = () => {
                if (!data || data.error || data.aborted) return;
                let rawText = data.choices?.[0]?.message?.content?.trim() || "";
                let replies = [];
                // 解析 JSON（用 extractJsonObject：逐字符找匹配的花括号+自动修复裸换行/多余逗号，
                // 不再是"截图里代码原文整段被当成消息发出来"背后那个粗暴正则）
                try {
                    let parsed = extractJsonObject(rawText);
                    if (!parsed) throw new Error("No JSON object found");
                    try {
                        // 状态栏可能写在 JSON 外面，也可能写在 JSON 的某个字段里（"stateUpdate": "<xx_status>…"）。
                        // 字段里的用 JSON.parse 之后的值（换行、引号都已经还原），外面的用 JSON 前后那两截。
                        const a0 = rawText.indexOf('{'), a1 = rawText.lastIndexOf('}');
                        const outside = (a0 >= 0 && a1 > a0) ? rawText.slice(0, a0) + '\n' + rawText.slice(a1 + 1) : rawText;
                        const fields = [];
                        (function walk(o, depth) {
                            if (!o || depth > 3) return;
                            if (typeof o === 'string') { fields.push(o); return; }
                            if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
                            if (typeof o === 'object') Object.keys(o).forEach(k => { if (k !== 'replies') walk(o[k], depth + 1); });
                        })(parsed, 0);
                        const pool = outside + '\n' + fields.join('\n');
                        const segF = (typeof gyFindStatusSegment === 'function') ? gyFindStatusSegment(pool, char.id) : null;
                        if (segF && Array.isArray(parsed.replies) && !parsed.replies.some(r => r && typeof r.text === 'string' && r.text.indexOf(segF.seg.slice(0, 30)) !== -1)) {
                            statusOutside = segF.seg;
                        }
                    } catch (e) {}

                    runPluginResponseHooks(char, sessionId, parsed);
                    if (parsed.stateUpdate) saveCharLifeState(char, parsed.stateUpdate, parsed.statusTypeLabel);
                    if (typeof aliveCaptureMood === 'function') aliveCaptureMood(char, parsed);   // 🫀 情绪惯性

                    if (parsed.replies && Array.isArray(parsed.replies) && parsed.replies.length > 0) {
                        replies = parsed.replies;
                    } else if (parsed.stateUpdate) {
                        // 💡 强力兜底：如果 AI 忘了写对话，只写了动作/状态，就直接把动作发出来！
                        replies = [{ delay: 1, text: `(${parsed.stateUpdate})` }];
                    } else {
                        throw new Error("Invalid structure");
                    }
                } catch (err) {
                    // 降级处理：模型没按格式吐JSON，直接把原始文本当一整条回复发出来——这种情况下更容易夹带
                    // 没被JSON结构"天然过滤掉"的思维链前缀，这里顺手处理一次（关闭/折叠/删除按当前设置来）
                    // unwrapAiEnvelopeText 会把思维链、``` 围栏、以及"其实是个 JSON 信封但上面没解析成功"
                    // 这三种情况一次处理干净，不会再把一整坨 JSON 原样当成一条消息发出来
                    replies = [{ delay: 1, text: unwrapAiEnvelopeText(rawText) }];
                }
                for (let k = streamedCount; k < replies.length; k++) pushReply(replies[k]);
            };

            const chatImages = batchImages.length > 0 ? batchImages : null;
            const useChatStream = (typeof enableStreaming !== 'undefined') && enableStreaming
                && typeof streamCompletionText === 'function' && typeof extractStreamingReplies === 'function';

            // 💭 思维链收纳盒开着时，给这个角色这一轮的请求打个取件码，第一条气泡带上它（关着时原样返回 api）
            const rqApi = (typeof gyVaultTagApi === 'function') ? gyVaultTagApi(api) : api;
            let rqKeyPending = rqApi.__gyReqKey || '';
            const producing = (async () => {
                try {
                    if (useChatStream) {
                        data = await streamCompletionText(rqApi, prompt, (fullSoFar, isDone) => {
                            if (isDone) return; // 收尾那一次交给 finalizeReplies 统一解析，别重复
                            const partial = extractStreamingReplies(fullSoFar);
                            while (streamedCount < partial.length) { pushReply(partial[streamedCount]); streamedCount++; }
                        }, chatImages);
                    } else {
                        data = await callChatCompletionAPI(rqApi, prompt, 2, chatImages);
                    }
                } catch (e) {
                    data = { error: { message: (e && e.message) || String(e) } };
                }
                finalizeReplies();
                closeQueue();
            })();

            // 私聊是**另一条时间线**：真人一边在群里接话、一边私戳你，两边各按各的节奏，
            // 不会"等群里这句发完才轮到私聊那句"。所以转私聊的消息不占下面这个循环的队——
            // 挂到 privateChain 上自己跑，群聊那边照常往下走，谁先到谁先出现。
            let privateChain = Promise.resolve(), privateSent = 0;

            let gotFirstReply = false;
            while (true) {
                if (replyQueue.length === 0) {
                    if (queueClosed) break;
                    await new Promise(res => { queueWake = res; }); // 等下一条写完
                    continue;
                }
                let replyObj = replyQueue.shift();
                if (!gotFirstReply) { gotFirstReply = true; currentlyTypingChars.delete(char.name); updateTypingIndicator(); }
                let repText = replyObj.text || "";
                let delaySec = replyObj.delay || 1;

                // 群聊转私聊：角色给某条回复加了 [MOVETOCHAT] 前缀，表示这句不想当着群里说。
                // 开关关掉时提示词里压根没给它这个选项，但万一它自己写了（预设/角色卡里教过），
                // 也只是把标记抹掉当普通群消息发——绝不能让 "[MOVETOCHAT]" 原样出现在用户眼前。
                let moveToChat = false;
                const mtcMatch = repText.match(/^\s*\[MOVETOCHAT\]\s*/i);
                if (mtcMatch) {
                    repText = repText.slice(mtcMatch[0].length).trim();
                    moveToChat = isGroup && (typeof enableGroupMoveToChat === 'undefined' || enableGroupMoveToChat);
                }

                if (moveToChat) {
                    if (repText) {
                        const grp = groupChats.find(x => x.id === sessionId);
                        const quoteInfo = { name: (grp && grp.name) || '群聊', text: '（群里没说出口的话）' };
                        const rawPriv = repText;
                        // 第一条私聊消息额外多等一会儿：真人得先切到私聊窗口再打字，
                        // 不可能群里刚说完下一秒私聊就到。后面几条就按模型自己给的节奏走。
                        const leadMs = privateSent === 0 ? 1500 + Math.floor(Math.random() * 2500) : 0;
                        const waitMs = leadMs + delaySec * 1000;
                        privateSent++;
                        privateChain = privateChain.then(async () => {
                            await new Promise(r => setTimeout(r, waitMs));
                            // 清洗跟群聊那边同一套，只是作用域换成1v1的会话
                            let t = stripLeftoverMarkers(applyRegexScripts(rawPriv, 'ai_output', char.id));
                            t = processMvuPatchInText(t, String(char.id)).cleanText;
                            t = processRecallBlockInText(t, String(char.id)).cleanText;
                            t = t.replace(/^["\u201c]|["\u201d]$/g, '').trim();
                            if (t && typeof deliverCharMoveToChatMessage === 'function') deliverCharMoveToChatMessage(char, t, quoteInfo);
                        }).catch(() => {});
                        anyCharReplied = true;
                    }
                    continue; // 不 await：群聊那边不等私聊，两条线并行
                }

                // 💬 说到做到（js/52）：摘掉 [ACT:…] 标记，记下要做的事，这条消息发出去之后再去做
                let __acts = [];
                if (typeof window.gyChatActsExtract === 'function') {
                    const __ex = window.gyChatActsExtract(repText, char, isGroup);
                    repText = __ex.text; __acts = __ex.acts;
                }
                // 📱 卡片格式的"手机里的事"（js/33）：发给你的变成真消息，跟别人的收进 TA 的手机
                let __phone = null;
                if (typeof window.gyPhoneIntake === 'function') {
                    try { __phone = window.gyPhoneIntake(char, repText, { phoneOnly: isGroup }); repText = __phone.text; } catch (e) { __phone = null; }
                }

                if (isMentioned && repText.toUpperCase().startsWith("NO") && repText.length < 5) repText = char.autoReplyText?.trim() || "嗯，我看到了。";
                else if (!isMentioned && repText.toUpperCase().startsWith("NO") && repText.length < 5) continue;

                // 核心：模拟打字延迟
                if (delaySec > 0) {
                    if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') {
                        currentlyTypingChars.add(char.name); updateTypingIndicator();
                    }
                    await new Promise(r => setTimeout(r, delaySec * 1000));
                    currentlyTypingChars.delete(char.name); updateTypingIndicator();
                }

                let repMediaUrl = null, emoMatch = repText.match(/\[EMO:(emo_\w+)\]/i);
                if (emoMatch) { let emo = globalEmoticons.find(e => e.id === emoMatch[1]); if (emo) repMediaUrl = emo.url; repText = repText.replace(emoMatch[0], '').trim(); }

                // 🆕 解析AI自己选的[QUOTE:编号]标记：编号对照的是这一轮prompt里给它的quotable.list，
                // 拿到手就是原始{name,text}快照，跟手动"引用回复"存的数据结构完全一样，渲染那边不用另外改。
                //
                // ⚠️ 这里**故意不锚定 ^ 句首**。以前只认写在最前面的标记，可模型经常把它甩在句子末尾
                // （prompt里白纸黑字写着"加在最前面"照样不听），结果标记既没被解析成引用、也没被清掉，
                // "[QUOTE:12]" 五个字就原样出现在聊天气泡里了。现在不管它写在哪儿都认，并且把所有
                // 出现过的都清干净——认不出编号（比如编号超出列表范围）时至少也不会漏给用户看见。
                let repQuote = null, quoteMatch = repText.match(/\[\s*QUOTE\s*:\s*(\d+)\s*\]/i);
                if (quoteMatch) {
                    const qIdx = parseInt(quoteMatch[1], 10) - 1;
                    const qTarget = quotable.list[qIdx];
                    if (qTarget) repQuote = { name: qTarget.name, text: qTarget.text };
                    repText = repText.replace(/\[\s*QUOTE\s*:\s*\d+\s*\]/ig, '').trim();
                }

                if (repText.includes("[NUDGE]")) { repText = repText.replace(/\[NUDGE\]/ig, '').trim(); globalChats[sessionId].push({ sender: 'system', text: `"${char.name}" 拍了拍 "${currentUser.name}" ${currentUser.nudgeText || '的脑袋'}`, timestamp: Date.now() }); anyCharReplied = true; }
                
                if (!repText && isMentioned && !__acts.length) {
                    // 诊断日志：AI这一轮实际解析出的回复内容是空的，才会走到这条兜底"嗯。"。
                    // 之前这里完全没有痕迹，出现"角色只回一个嗯"的时候没法判断是AI真的没写内容、
                    // 内容被安全策略拦了、还是JSON格式没对上导致解析漏了字段——现在把原始返回和
                    // 解析结果都打到控制台，方便对着实际报错/内容排查，不用再靠猜。
                    console.warn(`[空回复兜底] "${char.name}" 这一轮AI解析出的文本是空的，已用兜底文案"${char.autoReplyText?.trim() || '嗯。'}"代替。原始AI返回：`, (() => { try { return data; } catch (e) { return null; } })());
                    repText = char.autoReplyText?.trim() || "嗯。";
                }
                repText = applyRegexScripts(repText, 'ai_output', char.id);
                repText = stripLeftoverMarkers(repText); // 漏网的内部标记不许进气泡（见 js/01 里的说明）
                // MVU变量补丁块（酒馆"状态栏"预设常见格式）：识别+剥离，并把应用后的状态快照挂在这条消息上，
                // 渲染时读快照画一个真正的状态栏卡片，而不是把原始JSON糊在气泡里。
                const mvuResult = processMvuPatchInText(repText, sessionId);
                repText = mvuResult.cleanText;
                // 记忆召回块（酒馆"数据库"类预设常见格式）：同样识别+剥离，渲染成本地的召回面板。
                const recallResult = processRecallBlockInText(repText, sessionId);
                repText = recallResult.cleanText;

                // 📷 回复里写了 [IMG:一句话] 就单独发一张图（js/42）。
                //    先把标记从正文里摘掉，免得气泡里出现一行 [IMG:…]；
                //    图是异步取的（生图要等十几秒），所以不 await，先让这句话进聊天。
                let __photoDesc = '', __photoSelf = false;
                try {
                    if (typeof window.gyPhotoScan === 'function') {
                        const r0 = window.gyPhotoScan(repText);
                        repText = r0.text; __photoDesc = r0.desc; __photoSelf = r0.self;
                    }
                } catch (e) {}

                if (repText || repMediaUrl) {
                    const aiMsg = { sender: char.id, text: repText, timestamp: Date.now(), mediaUrl: repMediaUrl, readBy: [], mvuSnapshot: mvuResult.snapshot, recallHtml: recallResult.recallHtml, quote: repQuote };
                    if (rqKeyPending) { aiMsg.reasoningKey = rqKeyPending; rqKeyPending = ''; }
                    // 🟢 这条里带着状态栏：记进 TA 的状态流水（日历里按天翻）
                    try { const __sf = (typeof gyFindStatusSegment === 'function') ? gyFindStatusSegment(repText, char.id) : null; if (__sf && typeof gyStatusLogAdd === 'function') gyStatusLogAdd(char, { seg: __sf.seg, src: 'chat' }); } catch (e) {}
                    globalChats[sessionId].push(aiMsg); anyCharReplied = true; currentBatchText += `\n${char.name}: ${repText}`;
                    embedMessageInBackground(aiMsg);
                    if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') { renderChatMessages(); } 
                    else {
                        let avatarHtml = isGroup ? getGroupAvatarHTML(groupChats.find(x=>x.id===sessionId), 80) : getAvatarHTML(char, 80);
                        showToast(avatarHtml, isGroup ? `[${groupChats.find(x=>x.id===sessionId).name}] ${char.name}` : `${char.name} 发来消息`, repText || "[图片/表情/拍一拍]", null, sessionId);
                        globalNotifications.unshift({ text: `<b>${char.name}</b> 给您发来消息`, postId: null, chatCharId: sessionId, timestamp: Date.now() }); unreadNotifs++; updateNotifBadge(); renderChatCharList();
                    }
                    saveAllData(); checkAndAutoSummarizeChat(sessionId);
                }
                if (__photoDesc && typeof window.gyPhotoFromReply === 'function') {
                    try { window.gyPhotoFromReply(char.id, sessionId, __photoDesc, __photoSelf); } catch (e) {}
                }
                if (__acts.length && typeof window.gyChatActsRun === 'function') {
                    try { window.gyChatActsRun(char, sessionId, __acts); anyCharReplied = true; } catch (e) {}
                }
                // 📱 手机格式里发给你的：一条一条当真消息发出来（转账走钱包那张票据）
                if (__phone && (__phone.toMe.length || __phone.apps.length)) {
                    try {
                        for (const sp of __phone.toMe) {
                            await new Promise(r => setTimeout(r, 600));
                            if (sp.kind === 'money') {
                                const walletOk = window.gyWallet && typeof isAutoOn === 'function' && isAutoOn('walletOn');
                                if (sp.amt > 0 && walletOk && typeof window.gyChatActsRun === 'function') { window.gyChatActsRun(char, sessionId, [{ key: 'money', args: [String(sp.amt), ''] }]); continue; }
                                sp.kind = 'text'; sp.text = `［转账］￥${sp.amt}`;
                            }
                            const t = sp.kind === 'voice' ? `🎤 ${sp.text}` : sp.kind === 'sticker' ? `［表情］${sp.text}` : sp.kind === 'img' ? `［图片］${sp.text}` : sp.kind === 'music' ? `🎵 分享了一首歌：${sp.text}` : sp.text;
                            if (!t) continue;
                            globalChats[sessionId].push({ sender: char.id, text: t, timestamp: Date.now(), readBy: [] });
                            anyCharReplied = true;
                        }
                        if (__phone.apps.length) {
                            globalChats[sessionId].push({ sender: char.id, type: 'phonePeek', phone: Object.assign({ apps: __phone.apps }, __phone.logged), text: '［手机］' + char.name + ' 刚在手机上有点动静', timestamp: Date.now(), readBy: [] });
                        }
                        saveAllData();
                        if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') renderChatMessages();
                    } catch (e) { console.warn('[卡片手机] 发消息出错：', e); }
                }
            }
            await producing;
            if (statusOutside) {
                try {
                    const arr = globalChats[sessionId] || [];
                    for (let k = arr.length - 1; k >= 0; k--) {
                        const m = arr[k];
                        if (!m || (m.timestamp || 0) < turnStartedAt) break;
                        if (String(m.sender) === String(char.id)) { m.statusRaw = statusOutside; if (typeof gyStatusLogAdd === 'function') gyStatusLogAdd(char, { seg: statusOutside, src: 'chat' }); break; }
                    }
                    saveAllData();
                    if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') renderChatMessages();
                } catch (e) {}
            }
            pendingPrivateChains.push(privateChain);
            currentlyTypingChars.delete(char.name); updateTypingIndicator();
            if (data && data.error) {
                alert(`⚠️ 聊天 API 报错（${char.name} 回复失败）:\n${data.error.message || JSON.stringify(data.error)}`);
                continue;
            }
        } catch(e) { 
            currentlyTypingChars.delete(char.name); updateTypingIndicator(); 
        }
    }

    if (pendingPrivateChains.length) await Promise.all(pendingPrivateChains);

    if (anyCharReplied) {
        let myMsgsToMark = isGroup ? targetChars.map(c => String(c.id)) : [String(targetChars[0]?.id)].filter(Boolean);
        globalChats[sessionId].forEach(m => { if (m.sender === 'me') { if (!m.readBy) m.readBy = []; myMsgsToMark.forEach(cid => { if (!m.readBy.includes(cid)) m.readBy.push(cid); }); } });
        if (currentChatSessionId === sessionId && document.getElementById('view-chat').style.display !== 'none') renderChatMessages(); saveAllData();
    }
}

function openCreateGroupModal() {
    document.getElementById('groupChatCharPicker').innerHTML = myCharacters.map(char => `<div class="char-checkbox-item"><input type="checkbox" id="gpick_${char.id}" value="${char.id}"><label for="gpick_${char.id}">${getAvatarHTML(char, 28)} ${char.name}</label></div>`).join('');
    document.getElementById('newGroupChatName').value = ''; 
    document.getElementById('newGroupAvatarFile').value = '';
    document.getElementById('groupAvatarPreview').style.display = 'none';
    tempCropResults.groupAvatar = null;
    openModal('createGroupChatModal');
}

async function saveGroupChat() {
    let name = document.getElementById('newGroupChatName').value.trim(), selected = [...document.querySelectorAll('#groupChatCharPicker input[type=checkbox]:checked')].map(cb => parseInt(cb.value));
    if(!name) return alert("请输入群聊名称"); if(selected.length < 2) return alert("群聊至少需要选择两个角色");
    
    let newG = { id: 'g_' + Date.now(), name: name, members: selected, avatarImg: tempCropResults.groupAvatar || null, speakOrder: 'all' };
    groupChats.push(newG); closeModal('createGroupChatModal'); saveAllData(); renderChatCharList(); switchChatSession(newG.id);
}

function renderEmoticonManagerGallery() {
    const c = document.getElementById('emoticonManagerGallery');
    if(globalEmoticons.length === 0) { c.innerHTML = '<div style="grid-column:1/-1; color:#536471;">暂无表情/图片，快去上传吧~</div>'; return; }
    c.innerHTML = globalEmoticons.map((e, idx) => `<div class="emo-item"><img src="${e.url}"><button class="emo-del-btn" onclick="deleteEmoticon(${idx})">×</button><input type="text" value="${e.desc || ''}" placeholder="添加含义描述" onchange="updateEmoticonDesc(${idx}, this.value)" onclick="event.stopPropagation()"></div>`).join('');
}

function updateEmoticonDesc(idx, val) { globalEmoticons[idx].desc = val.trim(); saveAllData(); }

async function handleEmoticonUpload(event) {
    const files = Array.from(event.target.files); if (!files.length) return;
    // 一次选多少张都收（以前单次最多 99 张，多的截掉）
    for(let file of files) { globalEmoticons.push({ id: 'emo_' + Date.now() + Math.floor(Math.random()*1000), url: await fileToBase64(file), desc: "" }); }
    renderEmoticonManagerGallery(); event.target.value = ''; saveAllData();
}
/* ============================================================
   🕰️ 聊天里的时间分隔条 —— 微信那一套写法
   ------------------------------------------------------------
   微信的规矩是"越近写得越省"：
       今天      → 13:03
       昨天      → 昨天 13:03
       一周之内  → 星期四 13:03
       今年      → 9月11日 13:03
       跨年      → 2025年9月11日 13:03
   点一下展开成完整的 "2026年9月11日 星期四 13:03"，再点收回去。
   （这就是那条小红书里说的"点一下能具体到几月几日星期几"。）
   ============================================================ */
window.gyChatSepText = function (ts, full) {
    const d = new Date(Number(ts) || 0);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const week = '星期' + '日一二三四五六'[d.getDay()];
    const ymd = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (full) return `${ymd} ${week} ${hm}`;
    // 按"自然天"算差几天，不是按 24 小时——不然昨晚 23:00 到今早 01:00 会被算成"今天"
    const day0 = t => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const diff = Math.round((day0(now) - day0(d)) / 86400000);
    if (diff === 0) return hm;
    if (diff === 1) return '昨天 ' + hm;
    if (diff === 2) return '前天 ' + hm;
    if (diff > 2 && diff < 7) return week + ' ' + hm;
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
    return ymd + ' ' + hm;
};
// 点一下展开 / 收回。展开状态只记在这一条上，不写存档——
// 这是"看一眼"的动作，不该变成需要同步的设置。
window.gyChatSepToggle = function (el) {
    try {
        const box = el.closest ? el.closest('.chat-time-sep') : el;
        if (!box) return;
        const span = box.querySelector('span'); if (!span) return;
        const ts = Number(box.getAttribute('data-ts') || 0);
        const full = box.classList.toggle('full');
        if (ts) span.textContent = window.gyChatSepText(ts, full);
    } catch (e) {}
};
