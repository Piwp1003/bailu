// ===================== 插件系统 (Plugins) =====================
// 目的：把"想要的AI行为/工具"做成可以导入导出的独立插件，而不是每次都要改代码加新功能。
// 支持四种类型：
//   prompt  -- 提示词规则插件：往prompt里注入一段固定指令（全局或指定角色生效），类似世界书但更适合"通用工具规则"
//   action  -- 快捷动作插件：在聊天输入框上方加一个按钮，点一下就发送预设的话（比如"掷骰子""生成天气"）
//   macro   -- 宏插件：扩展 {{xxx}} 占位符系统，可以在人设/世界书里直接用
//   script  -- 进阶：自定义JS钩子（高级选项，谨慎导入不信任来源的脚本，因为它和你自己写代码的权限一样大）

function pluginMatchesScope(p, charId) {
    if (!charId) return p.scope === 'global';
    if (p.scope === 'global') return true;
    if (Array.isArray(p.scope)) return p.scope.some(id => id == charId);
    return p.scope == charId; // 兼容旧版单选角色的插件数据
}

function getPluginPromptText(char) {
    if (!plugins || plugins.length === 0) return '';
    const applicable = plugins.filter(p => p.enabled !== false && p.type === 'prompt' && pluginMatchesScope(p, char && char.id));
    if (applicable.length === 0) return '';
    return '\n' + applicable.map(p => applyMacros(p.promptText || '', char)).join('\n') + '\n';
}

function runPluginScriptHooks(char, contextText) {
    if (!plugins || plugins.length === 0) return '';
    const applicable = plugins.filter(p => p.enabled !== false && p.type === 'script' && pluginMatchesScope(p, char && char.id));
    let out = '';
    applicable.forEach(p => {
        if (!p.code) return;
        try {
            const fn = new Function('char', 'context', 'applyMacros', p.code);
            const result = fn(char, contextText, applyMacros);
            if (typeof result === 'string' && result.trim()) out += '\n' + result;
        } catch (e) { console.error(`插件"${p.name}"执行出错：`, e); }
    });
    return out;
}

// 插件系统：AI回复解析完JSON之后的钩子。response 是同一个对象的引用，插件里对它的修改
// （比如 response.replies = [...]）会直接影响后续核心逻辑读到的内容，方便插件实现
// "读取AI返回的自定义字段、并据此改写这轮回复"这类需求（好感度、日程忙碌打断回复等）。
function runPluginResponseHooks(char, sessionId, response) {
    runBoxResponseHooks(char, sessionId, response);   // 🧩 先跑内置小功能的（js/22~25）
    if (!plugins || plugins.length === 0) return;
    const applicable = plugins.filter(p => p.enabled !== false && p.type === 'script' && p.onResponse && pluginMatchesScope(p, char && char.id));
    applicable.forEach(p => {
        try {
            const fn = new Function('char', 'sessionId', 'response', 'applyMacros', p.onResponse);
            fn(char, sessionId, response, applyMacros);
        } catch (e) { console.error(`插件"${p.name}"的响应钩子执行出错：`, e); }
    });
}

// 插件系统：启动钩子（onLoad）—— 和 code/onResponse 不同，这个不依赖"正在聊天/生成"这类特定场景，
// 而是每次网页打开、数据读取完毕后就自动跑一次，用来让插件自己往页面里插入按钮、新页面、弹窗、样式，
// 实现"导入插件JSON就能直接用"，不需要我们手动改index.html/script.js/style.css。
// 代码里能直接访问 document/window，以及 myCharacters、plugins、saveAllData 等全局变量和函数——权限和手写代码一样大，只导入信任来源的插件。
function executePluginOnLoad(p) {
    if (!p || p.type !== 'script' || !p.onLoad) return;
    try {
        const fn = new Function('applyMacros', p.onLoad);
        fn(applyMacros);
    } catch (e) { console.error(`插件"${p.name}"的启动钩子执行出错：`, e); }
}
function runPluginOnLoadHooks() {
    if (!plugins || plugins.length === 0) return;
    plugins.filter(p => p.enabled !== false && p.type === 'script' && p.onLoad).forEach(executePluginOnLoad);
}

function applyPluginMacros(text, char) {
    if (!text || !plugins || plugins.length === 0) return text;
    let result = text;
    plugins.filter(p => p.enabled !== false && p.type === 'macro' && p.macroName).forEach(p => {
        const re = new RegExp(`\\{\\{${p.macroName}\\}\\}`, 'gi');
        result = result.replace(re, applyMacros(p.macroValue || '', char));
    });
    return result;
}

function getActivePluginActions(charId) {
    if (!plugins || plugins.length === 0) return [];
    return plugins.filter(p => p.enabled !== false && p.type === 'action' && pluginMatchesScope(p, charId));
}

function runPluginAction(actionId) {
    const p = plugins.find(x => x.id === actionId);
    if (!p || !currentChatSessionId) return;
    const char = myCharacters.find(c => c.id == currentChatSessionId);
    const input = document.getElementById('chatInput');
    if (input) { input.value = applyMacros(p.actionPrompt || '', char, currentChatSessionId); sendChatMessage(); }
}

function renderChatPluginActionsBar() {
    const bar = document.getElementById('chatPluginActionsBar');
    if (!bar) return;
    if (!currentChatSessionId || currentChatSessionId.startsWith('g_')) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    const actions = getActivePluginActions(currentChatSessionId);
    if (actions.length === 0) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = actions.map(p => `<button type="button" class="btn-edit-small" style="margin:0; white-space:nowrap;" onclick="runPluginAction('${p.id}')">${p.actionLabel || p.name}</button>`).join('');
}

// ===================== 小游戏框架 (Mini Games) =====================
// 核心提供：输入框上方的🎮图标、"选择游戏"弹窗、私聊直接邀请/群聊多选或随机选人逐个邀请、
// 角色是否接受邀请的通用AI判断逻辑、邀请对话写入聊天记录。
// 具体某个游戏怎么玩（棋盘/规则/落子逻辑等）由对应的"游戏类插件"通过 registerMiniGame() 注册进来，
// 插件只需要实现 { id, name, icon, getStatus(sessionId), onStart(sessionId, opponentCharId), onResume(sessionId) }。
let registeredMiniGames = [];

function registerMiniGame(gameDef) {
    if (!gameDef || !gameDef.id || !gameDef.name) return;
    registeredMiniGames = registeredMiniGames.filter(g => g.id !== gameDef.id); // 避免重复注册（比如插件被重新导入）
    registeredMiniGames.push(gameDef);
    refreshMiniGameIconBadge();
}

function refreshMiniGameIconBadge() {
    const btn = document.getElementById('miniGameIconBtn');
    if (!btn) return;
    let active = false;
    if (currentChatSessionId) {
        for (const g of registeredMiniGames) {
            if (typeof g.getStatus === 'function' && g.getStatus(currentChatSessionId) === 'playing') { active = true; break; }
        }
    }
    btn.classList.toggle('active', active);
}

function onMiniGameIconClick() {
    if (!currentChatSessionId) return;
    if (registeredMiniGames.length === 0) { alert('还没有安装任何游戏插件～'); return; }
    for (const g of registeredMiniGames) {
        const st = typeof g.getStatus === 'function' ? g.getStatus(currentChatSessionId) : null;
        if (st === 'playing' || st === 'finished') { if (typeof g.onResume === 'function') g.onResume(currentChatSessionId); return; }
    }
    openMiniGameSelectModal();
}

function openMiniGameSelectModal() {
    let modal = document.getElementById('miniGameSelectModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'miniGameSelectModal'; modal.className = 'modal-overlay'; document.body.appendChild(modal); }
    const listHtml = registeredMiniGames.map(g => `<button type="button" class="btn-edit-small" style="padding:12px; width:100%;" onclick="startMiniGameFlow('${g.id}')">${g.icon || '🎮'} ${escapeHtml(g.name)}</button>`).join('');
    modal.innerHTML = `
        <div class="modal-box" style="width:320px; text-align:center;">
            <h2>🎮 选择游戏</h2>
            <div class="form-hint">邀请对方一起玩，Ta会结合人设决定要不要答应～</div>
            <div style="display:flex; flex-direction:column; gap:10px; margin:16px 0;">${listHtml}</div>
            <button type="button" class="btn-edit-small" onclick="document.getElementById('miniGameSelectModal').style.display='none'">取消</button>
        </div>`;
    modal.style.display = 'flex';
}

function startMiniGameFlow(gameId) {
    const modal = document.getElementById('miniGameSelectModal');
    if (modal) modal.style.display = 'none';
    const gameDef = registeredMiniGames.find(g => g.id === gameId);
    const isGroup = currentChatSessionId.startsWith('g_');
    const needed = (gameDef && gameDef.minOpponents) || 1;
    if (needed > 1 && !isGroup) { alert(`${gameDef ? gameDef.name : '这个游戏'}至少需要${needed}个角色一起玩，私聊里凑不够人数，去群聊里试试吧～`); return; }
    if (isGroup) openMiniGameGroupPickModal(gameId); else runMiniGame1v1Invite(gameId);
}

async function runMiniGame1v1Invite(gameId) {
    const gameDef = registeredMiniGames.find(g => g.id === gameId);
    const sessionId = currentChatSessionId;
    const char = myCharacters.find(c => c.id == sessionId);
    if (!gameDef || !char) return;
    const api = getApiConfig(true);
    if (!api.key) return alert('请先配置 API Key！');

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `[邀请对方玩${gameDef.name}]`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    const accepted = await askCharGameInvite(char, sessionId, gameDef.name);
    refreshMiniGameIconBadge();
    if (accepted) beginMiniGame(gameDef, sessionId, [char.id]);
}

// 通用：问某个角色要不要接受游戏邀请（把角色的回应写进聊天记录），返回是否接受。
// spectatorMode为true时表示名额已经被别人占了，只让这个角色围观吐槽一句，不再真的问要不要上场。
// 报场景：这段生成属于「game」那一场（soft＝外层已有场景就不抢）
async function askCharGameInvite() {
    const a = arguments;
    if (typeof window.gyInjectInSceneSoft === 'function')
        return window.gyInjectInSceneSoft('game', () => askCharGameInviteInner.apply(null, a));
    return askCharGameInviteInner.apply(null, a);
}
async function askCharGameInviteInner(char, sessionId, gameName, spectatorMode, opponentName) {
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    if (spectatorMode) {
        const prompt = buildStructuredMessages(buildBasePrompt(char, true, recentHistory), [],
            `用户邀请了群里好几个人一起玩${gameName}，"${opponentName}"已经先答应上场了，你没有上场。
请以你的人设身份，说一句围观/吐槽/起哄/看戏的话，不超过30字，只输出这句话本身，不要引号、不要任何多余文字。`);
        let data; try { data = await callChatCompletionAPI(api, prompt); } catch (e) { return false; }
        if (data.error) return false;
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const text = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').replace(/^["「]|["」]$/g, '').trim().slice(0, 100);
        if (text) { globalChats[sessionId].push({ sender: char.id, text, timestamp: Date.now(), readBy: [] }); renderChatMessages(); saveAllData(); }
        return false;
    }
    const prompt = buildStructuredMessages(buildBasePrompt(char, true, recentHistory), [],
        `用户邀请你一起玩${gameName}。请结合你的人设、性格、当前和用户的关系，决定要不要答应这次游戏邀请。
只输出严格JSON，不要markdown代码块包裹，不要任何多余文字：
{"accept": true或false, "reply": "你对这个邀请的回应，符合你的说话风格，一两句话就好"}`);
    let data;
    try { data = await callChatCompletionAPI(api, prompt); } catch (e) { alert('请求失败：' + e.message); return false; }
    if (data.error) { alert('请求失败：' + (data.error.message || JSON.stringify(data.error))); return false; }
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    let parsed = null; try { parsed = extractJsonObject(raw); } catch (e) {}
    const accept = parsed ? !!parsed.accept : (/答应|好啊|可以|同意|没问题|来吧/.test(raw) && !/不想|拒绝|不了/.test(raw));
    const replyText = (parsed && parsed.reply) ? parsed.reply : (raw ? raw.slice(0, 80) : (accept ? '来吧！' : '这次不太想玩呢。'));
    globalChats[sessionId].push({ sender: char.id, text: replyText, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();
    return accept;
}

function openMiniGameGroupPickModal(gameId) {
    const sessionId = currentChatSessionId;
    const gameDef = registeredMiniGames.find(g => g.id === gameId);
    const groupObj = groupChats.find(g => g.id === sessionId);
    if (!groupObj) return;
    const members = (groupObj.members || []).map(id => myCharacters.find(c => c.id == id)).filter(Boolean);
    if (members.length === 0) return alert('这个群里还没有角色成员');
    const needed = (gameDef && gameDef.minOpponents) || 1;

    let modal = document.getElementById('miniGameGroupPickModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'miniGameGroupPickModal'; modal.className = 'modal-overlay'; document.body.appendChild(modal); }
    const rowsHtml = members.map(c => `<div class="mini-game-member-pick-row"><input type="checkbox" class="mini-game-member-pick" id="mgpick_${c.id}" value="${c.id}"><label for="mgpick_${c.id}" style="display:flex; align-items:center; gap:8px; cursor:pointer;">${getAvatarHTML(c, 28)} ${escapeHtml(c.name)}</label></div>`).join('');
    const hintText = needed > 1
        ? `这个游戏需要${needed}个角色一起玩。可以手动勾选，也可以随机抽人；会逐个发邀请，凑够${needed}人后开局，其他被问过但没上场的人在旁边围观吐槽～`
        : `可以手动勾选，也可以随机抽人；逐个发邀请，谁先答应谁上场，其他人在旁边围观吐槽～`;
    modal.innerHTML = `
        <div class="modal-box" style="width:340px;">
            <h2 style="text-align:center;">🎮 选择邀请对象</h2>
            <div class="form-hint">${hintText}</div>
            <div style="display:flex; gap:8px; margin:10px 0; flex-wrap:wrap; justify-content:center;">
                <button type="button" class="btn-edit-small" onclick="miniGameRandomPick(${needed})">🎲随机${needed}人</button>
                <button type="button" class="btn-edit-small" onclick="miniGameRandomPick(${Math.min(needed + 2, members.length)})">🎲多选几个备选</button>
                <button type="button" class="btn-edit-small" onclick="miniGameRandomPick(${members.length})">🎲全选</button>
            </div>
            <div style="max-height:240px; overflow-y:auto; text-align:left; margin-bottom:10px; border:1px solid #eff3f4; border-radius:8px;">${rowsHtml}</div>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button type="button" class="btn-post" onclick="runMiniGameGroupInvite('${gameId}')">发出邀请</button>
                <button type="button" class="btn-edit-small" onclick="document.getElementById('miniGameGroupPickModal').style.display='none'">取消</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
}

function miniGameRandomPick(n) {
    const modal = document.getElementById('miniGameGroupPickModal');
    if (!modal) return;
    const boxes = [...modal.querySelectorAll('.mini-game-member-pick')];
    boxes.forEach(b => { b.checked = false; });
    boxes.slice().sort(() => Math.random() - 0.5).slice(0, n).forEach(b => { b.checked = true; });
}

async function runMiniGameGroupInvite(gameId) {
    const modal = document.getElementById('miniGameGroupPickModal');
    const sessionId = currentChatSessionId;
    const gameDef = registeredMiniGames.find(g => g.id === gameId);
    if (!gameDef) return;
    const needed = gameDef.minOpponents || 1;
    const pickedIds = modal ? [...modal.querySelectorAll('.mini-game-member-pick:checked')].map(b => b.value) : [];
    if (modal) modal.style.display = 'none';
    if (pickedIds.length === 0) return alert('至少选一个角色吧');

    const api = getApiConfig(true);
    if (!api.key) return alert('请先配置 API Key！');

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `[邀请大家一起玩${gameDef.name}]`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    // 逐个发邀请：先凑够 needed 个人接受，凑够之后剩下被问到的人只围观吐槽，不再真的问要不要上场
    let opponents = [];
    for (const idStr of pickedIds) {
        const char = myCharacters.find(c => c.id == idStr);
        if (!char) continue;
        if (opponents.length >= needed) {
            const namesText = opponents.map(c => c.name).join('、');
            await askCharGameInvite(char, sessionId, gameDef.name, true, namesText);
            continue;
        }
        const accepted = await askCharGameInvite(char, sessionId, gameDef.name);
        if (accepted) opponents.push(char);
    }

    if (opponents.length < needed) {
        globalChats[sessionId].push({ sender: 'system', text: needed > 1 ? `这次答应的人不够${needed}个，没能凑成一局。` : `看起来大家都不太想玩，这次没能凑成一局。`, timestamp: Date.now() });
        renderChatMessages(); saveAllData();
        refreshMiniGameIconBadge();
        return;
    }
    beginMiniGame(gameDef, sessionId, opponents.map(c => c.id));
}

function beginMiniGame(gameDef, sessionId, opponentCharIds) {
    refreshMiniGameIconBadge();
    if (typeof gameDef.onStart === 'function') gameDef.onStart(sessionId, opponentCharIds);
}

// 通用：游戏结束时问角色要一句感言（不管输赢/平局/认输，都要有反应），写进聊天记录。
// resultText 用自然语言描述这局结果就行，比如"你赢了，对方输了" / "平局" / "你中途认输，对方获胜"。
function miniGameCharSay(sessionId, char, text) {
    // 供各小游戏插件调用，统一受"小游戏中角色发言"总开关控制；关闭时直接不发送，返回false
    if (!enableMiniGameCharSpeech) return false;
    if (!text || !char) return false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: text, timestamp: Date.now(), readBy: [] });
    return true;
}


// 报场景：这段生成属于「game」那一场（soft＝外层已有场景就不抢）

async function askCharGameEndComment() {

    const a = arguments;

    if (typeof window.gyInjectInSceneSoft === 'function')

        return window.gyInjectInSceneSoft('game', () => askCharGameEndCommentInner.apply(null, a));

    return askCharGameEndCommentInner.apply(null, a);

}
async function askCharGameEndCommentInner(char, sessionId, gameName, resultText) {
    if (!enableMiniGameCharSpeech) return '';
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const prompt = buildStructuredMessages(buildBasePrompt(char, true, recentHistory), [],
        `你刚和用户玩完${gameName}，结果是：${resultText}
请结合你的人设、性格，对这个结果说一句感言或反应（不管输赢都要说点什么，可以是得意、不服气、安慰、恭喜、自嘲、约下次再战等），不超过40字。
只输出这句话本身，不要引号、不要任何多余文字、不要markdown。`);
    let data;
    try { data = await callChatCompletionAPI(api, prompt); } catch (e) { return ''; }
    if (data.error) return '';
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    const text = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').replace(/^["「]|["」]$/g, '').trim().slice(0, 150);
    if (text) {
        if (!globalChats[sessionId]) globalChats[sessionId] = [];
        globalChats[sessionId].push({ sender: char.id, text, timestamp: Date.now(), readBy: [] });
        if (typeof renderChatMessages === 'function') renderChatMessages();
        saveAllData();
    }
    return text;
}

// 通用：给游戏用的悬浮可拖动窗口（不是modal，不会挡住/锁住聊天，用户可以边玩边正常打字聊天）。
// 游戏插件调用一次拿到面板，把自己的棋盘/内容渲染进 .mini-game-float-body 就行，拖动逻辑核心已经处理好了。
function createMiniGameFloatingPanel(panelId, titleText) {
    let panel = document.getElementById(panelId);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'mini-game-float-panel';
    panel.innerHTML = `
        <div class="mini-game-float-header">
            <span class="mini-game-float-title">${escapeHtml(titleText || '游戏')}</span>
            <span class="mini-game-float-close" onclick="document.getElementById('${panelId}').style.display='none'">×</span>
        </div>
        <div class="mini-game-float-body"></div>`;
    document.body.appendChild(panel);
    makeMiniGamePanelDraggable(panel, panel.querySelector('.mini-game-float-header'));
    return panel;
}

function makeMiniGamePanelDraggable(panel, handle) {
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    function getPoint(e) { return e.touches ? e.touches[0] : e; }
    function pointerDown(e) {
        dragging = true;
        const rect = panel.getBoundingClientRect();
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        startLeft = rect.left; startTop = rect.top;
        const p = getPoint(e);
        startX = p.clientX; startY = p.clientY;
        e.preventDefault();
    }
    function pointerMove(e) {
        if (!dragging) return;
        const p = getPoint(e);
        let newLeft = startLeft + (p.clientX - startX);
        let newTop = startTop + (p.clientY - startY);
        newLeft = Math.max(-panel.offsetWidth + 60, Math.min(window.innerWidth - 60, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - 60, newTop));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
    }
    function pointerUp() { dragging = false; }
    handle.addEventListener('mousedown', pointerDown);
    document.addEventListener('mousemove', pointerMove);
    document.addEventListener('mouseup', pointerUp);
    handle.addEventListener('touchstart', pointerDown, { passive: false });
    document.addEventListener('touchmove', pointerMove, { passive: false });
    document.addEventListener('touchend', pointerUp);
}

function renderPluginsList() {
    const container = document.getElementById('pluginsList');
    if (!container) return;
    if (!plugins || plugins.length === 0) { container.innerHTML = '<div class="empty-state">还没有安装任何插件，从下面导入或新建一个吧</div>'; return; }
    const typeLabel = { prompt: '📜 提示词规则', action: '⚡ 快捷动作', macro: '🔤 宏', script: '🧬 脚本钩子(进阶)' };
    container.innerHTML = plugins.map(p => {
        let scopeLabel;
        if (p.scope === 'global') scopeLabel = '全局生效';
        else if (Array.isArray(p.scope)) scopeLabel = `仅限：${p.scope.map(id => myCharacters.find(c => c.id == id)?.name || '未知角色').join('、') || '（未选择角色）'}`;
        else scopeLabel = `仅限：${myCharacters.find(c => c.id == p.scope)?.name || '未知角色'}`;
        const bodyText = p.promptText || p.actionPrompt || p.macroValue || p.code || '';
        const descHtml = p.description ? `<div class="plugin-clamp-wrap"><div class="plugin-clamp-text" style="font-size:12px; color:#8b98a5;">${escapeHtml(p.description)}</div><span class="plugin-expand-hint" onclick="togglePluginClamp(this)">展开 ▾</span></div>` : '';
        const bodyHtml = bodyText ? `<div class="plugin-clamp-wrap" style="margin-top:6px;"><div class="plugin-clamp-text" style="font-family:monospace; font-size:11px; color:#536471;">${escapeHtml(bodyText)}</div><span class="plugin-expand-hint" onclick="togglePluginClamp(this)">展开 ▾</span></div>` : '';
        return `<div class="wb-card" style="min-width:0; max-width:none; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div style="flex:1; min-width:0;">
                    <div class="wb-title">${escapeHtml(p.name)} <span style="font-size:11px; font-weight:normal; color:#8b98a5;">[${typeLabel[p.type] || p.type}]</span></div>
                    <div style="font-size:12px; color:#8b98a5; margin-bottom:4px;">${scopeLabel}</div>
                    ${descHtml}
                </div>
                <input type="checkbox" ${p.enabled !== false ? 'checked' : ''} onchange="togglePluginEnabled('${p.id}')" title="启用/禁用">
            </div>
            ${bodyHtml}
            <div style="display:flex; gap:10px; margin-top:6px;">
                <span style="color:#1d9bf0; cursor:pointer; font-size:13px;" onclick="editPlugin('${p.id}')">✏️ 编辑</span>
                <span style="color:#f91880; cursor:pointer; font-size:13px;" onclick="deletePlugin('${p.id}')">删除</span>
            </div>
        </div>`;
    }).join('');
}

// 插件列表里描述/内容默认只显示两行，点"展开"切换显示全部（再点一次收起）
function togglePluginClamp(hintEl) {
    const textEl = hintEl && hintEl.previousElementSibling;
    if (!textEl) return;
    const expanded = textEl.classList.toggle('plugin-expanded');
    hintEl.textContent = expanded ? '收起 ▴' : '展开 ▾';
}

function togglePluginEnabled(id) {
    const p = plugins.find(p => p.id === id);
    if (p) { p.enabled = !(p.enabled !== false); saveAllData(); renderChatPluginActionsBar(); }
}

async function deletePlugin(id) {
    if (!(await appConfirm('确定要删除这个插件吗？'))) return;
    plugins = plugins.filter(p => p.id !== id);
    if (editingPluginId === id) cancelPluginEdit();
    saveAllData();
    renderPluginsList();
    renderChatPluginActionsBar();
}

function updatePluginFormFields() {
    const type = document.getElementById('newPluginType').value;
    ['prompt', 'action', 'macro', 'script'].forEach(t => {
        const el = document.getElementById(`pluginFields-${t}`);
        if (el) el.style.display = (t === type) ? 'block' : 'none';
    });
}

function populatePluginScopeSelect() {
    const box = document.getElementById('newPluginScopeCharsBox');
    if (!box) return;
    box.innerHTML = myCharacters.map(c => `<label style="display:flex; align-items:center; gap:4px; font-size:13px;"><input type="checkbox" value="${c.id}" class="plugin-scope-char-check"> ${c.name}</label>`).join('') || '<span style="color:#8b98a5; font-size:13px;">暂无角色</span>';
}

function togglePluginScopeGlobal() {
    const isGlobal = document.getElementById('newPluginScopeGlobal').checked;
    document.getElementById('newPluginScopeCharsBox').style.display = isGlobal ? 'none' : 'flex';
}

// 把某个已安装插件的数据填回"新建插件"表单，进入编辑模式（保存时会更新这一条，而不是新建一条）
function editPlugin(id) {
    const p = plugins.find(p => p.id === id);
    if (!p) return;
    editingPluginId = id;

    document.getElementById('newPluginName').value = p.name || '';
    document.getElementById('newPluginDesc').value = p.description || '';
    document.getElementById('newPluginType').value = p.type || 'prompt';
    updatePluginFormFields();

    populatePluginScopeSelect();
    const isGlobal = p.scope === 'global';
    document.getElementById('newPluginScopeGlobal').checked = isGlobal;
    togglePluginScopeGlobal();
    if (!isGlobal) {
        const scopeIds = Array.isArray(p.scope) ? p.scope.map(String) : [String(p.scope)];
        document.querySelectorAll('.plugin-scope-char-check').forEach(el => { el.checked = scopeIds.includes(el.value); });
    }

    document.getElementById('newPluginPromptText').value = p.promptText || '';
    document.getElementById('newPluginActionLabel').value = p.actionLabel || '';
    document.getElementById('newPluginActionPrompt').value = p.actionPrompt || '';
    document.getElementById('newPluginMacroName').value = p.macroName || '';
    document.getElementById('newPluginMacroValue').value = p.macroValue || '';
    document.getElementById('newPluginScriptCode').value = p.code || '';
    document.getElementById('newPluginScriptOnResponse').value = p.onResponse || '';
    document.getElementById('newPluginScriptOnLoad').value = p.onLoad || '';

    const titleEl = document.getElementById('pluginFormTitle'); if (titleEl) titleEl.innerText = '编辑插件';
    const saveBtn = document.getElementById('savePluginBtn'); if (saveBtn) saveBtn.innerText = '保存插件修改';
    const cancelBtn = document.getElementById('cancelPluginEditBtn'); if (cancelBtn) cancelBtn.style.display = 'block';

    const formSection = document.getElementById('pluginFormSection');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelPluginEdit() {
    editingPluginId = null;
    ['newPluginName', 'newPluginDesc', 'newPluginPromptText', 'newPluginActionLabel', 'newPluginActionPrompt', 'newPluginMacroName', 'newPluginMacroValue', 'newPluginScriptCode', 'newPluginScriptOnResponse', 'newPluginScriptOnLoad'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('newPluginType').value = 'prompt';
    updatePluginFormFields();
    document.getElementById('newPluginScopeGlobal').checked = true;
    togglePluginScopeGlobal();
    document.querySelectorAll('.plugin-scope-char-check').forEach(el => el.checked = false);
    const titleEl = document.getElementById('pluginFormTitle'); if (titleEl) titleEl.innerText = '新建插件';
    const saveBtn = document.getElementById('savePluginBtn'); if (saveBtn) saveBtn.innerText = '添加插件';
    const cancelBtn = document.getElementById('cancelPluginEditBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
}

function createPlugin() {
    const name = document.getElementById('newPluginName').value.trim();
    if (!name) return alert('请填写插件名称');
    const type = document.getElementById('newPluginType').value;
    const isGlobal = document.getElementById('newPluginScopeGlobal').checked;
    const scope = isGlobal ? 'global' : Array.from(document.querySelectorAll('.plugin-scope-char-check:checked')).map(el => el.value);
    if (!isGlobal && scope.length === 0) return alert('请至少勾选一个生效的角色，或者勾选"全局"');
    const description = document.getElementById('newPluginDesc').value.trim();

    // 编辑模式：更新已存在的插件；否则新建一条
    const existing = editingPluginId ? plugins.find(p => p.id === editingPluginId) : null;
    const p = existing || { id: 'plg_' + Date.now(), enabled: true };
    p.name = name; p.description = description; p.type = type; p.scope = scope;
    if (type === 'prompt') p.promptText = document.getElementById('newPluginPromptText').value.trim();
    if (type === 'action') { p.actionLabel = document.getElementById('newPluginActionLabel').value.trim(); p.actionPrompt = document.getElementById('newPluginActionPrompt').value.trim(); }
    if (type === 'macro') { p.macroName = document.getElementById('newPluginMacroName').value.trim().replace(/[^a-zA-Z0-9_]/g, ''); p.macroValue = document.getElementById('newPluginMacroValue').value.trim(); }
    if (type === 'script') { p.code = document.getElementById('newPluginScriptCode').value; p.onResponse = document.getElementById('newPluginScriptOnResponse').value; p.onLoad = document.getElementById('newPluginScriptOnLoad').value; }
    if (!existing) plugins.push(p);
    saveAllData();
    if (type === 'script' && p.onLoad) executePluginOnLoad(p); // 新建/编辑后立刻跑一次启动钩子，不用等刷新页面
    cancelPluginEdit();
    renderPluginsList();
    renderChatPluginActionsBar();
}

function exportPlugins() {
    if (!plugins || plugins.length === 0) return alert('还没有任何插件可以导出');
    saveTextFileForApp(`插件导出_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(plugins, null, 2), 'application/json');
}

// 刷新按钮：解决"导入/编辑插件（尤其是带自定义按钮/页面的脚本插件）之后，
// 有时候要把App整个大退再重新打开才能看到效果"的问题。
// 点一下等价于把网页整个重新打开一次：聊天记录、角色、插件等数据都存在 IndexedDB/localForage 里，
// 跟"刷新页面"完全是两回事，不会因为这个操作丢失，可以放心点。
async function refreshAppPage() {
    if (!(await appConfirm('确定要刷新页面吗？聊天记录、角色、插件等数据都已自动保存，不会丢失。'))) return;

    // 页面上所有刷新按钮（手机顶栏图标、电脑侧边栏、插件页那个）一起转起来，
    // 让"已经点到了"这件事立刻可见——刷新本身有零点几秒的空窗期，没反馈的话很容易以为没点上。
    document.querySelectorAll('[data-refresh-btn]').forEach(el => el.classList.add('is-refreshing'));

    // 顺便让 Service Worker 检查一次有没有新版本，避免刷新后还是命中旧缓存。
    // 加超时兜底：万一网络卡住，最多等1.5秒也照样刷新，不能让按钮一直转着不动。
    try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
            await Promise.race([
                navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(reg => reg.update()))),
                new Promise(resolve => setTimeout(resolve, 1500))
            ]);
        }
    } catch (e) { console.warn('[刷新] 检查 Service Worker 更新失败（不影响刷新）：', e); }

    location.reload();
}

function handlePluginImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            let addedCount = 0;
            const newlyAdded = [];
            list.forEach(p => {
                if (!p.name || !p.type) return;
                const newPlugin = { ...p, id: 'plg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), enabled: p.enabled !== false };
                plugins.push(newPlugin);
                newlyAdded.push(newPlugin);
                addedCount++;
            });
            saveAllData();
            renderPluginsList();
            renderChatPluginActionsBar();
            // 即插即用：如果插件带有"网页打开时执行"的钩子，导入这一刻就立刻跑一次，不用等刷新页面
            newlyAdded.forEach(p => { if (p.enabled !== false && p.type === 'script' && p.onLoad) executePluginOnLoad(p); });
            alert(`成功导入 ${addedCount} 个插件！`);
        } catch (err) {
            alert('导入失败，文件不是合法的插件JSON：' + err.message);
        }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
}

// 👤 char 传进来就按“在这个角色面前我是谁”取人设（见 js/01 resolveUserPersonaFor）；
// 不传就是当前正在用的这份资料——老调用点一个字都不用改，行为完全不变。
function getUserContextPrompt(char) {
const u = (char && typeof resolveUserPersonaFor === 'function') ? resolveUserPersonaFor(char) : currentUser;
let context = '';
if (u.name && u.name !== '我') {
    context += `\n【用户的名字】：${u.name}。`;
}
if (u.gender && u.gender !== '未知') {
    context += `\n【重要设定】：用户的性别是“${u.gender}”。你在回复、心理描写和称呼中，绝对不能搞错用户的性别，必须严格遵循。`;
}
if (u.persona) {
    context += `\n【用户设定】：与你互动的用户人设为“${u.persona}”。在进行互动、聊天、回复以及心理描写时，你必须知晓并严格结合用户的这个设定背景。`;
}
return context;
}


// 🧩 内置小功能的"回复解析完之后"钩子。
// 目前只有关系账本用得上：开了"让模型每轮单独给一个数"的时候，
// 它要从 response 里把 rel / relWhy 捡出来记进账本。
// 原来这是插件的 onResponse，内置之后由 runPluginResponseHooks 顺手带一下。
function runBoxResponseHooks(char, sessionId, response) {
    try {
        if (char && response && typeof window.__gyRelCapture === 'function') {
            window.__gyRelCapture(char, response);
        }
    } catch (e) { console.warn('[小功能] 关系账本记账出错，已跳过：', e); }
}
