// =====================================================================================
// 续写工作台（Story Studio）
//
// 从"我们的故事 → 小说编辑器 → 互动续写模式"里独立出来的功能，现在是左侧导航栏的一级入口。
// 跟旧版的区别：
//   1. 有自己的会话列表，一个会话＝一段独立的续写，不再寄生在某本小说上
//   2. 设定（大纲/出场角色/字数/人称/历史轮数）按会话各存一份，互不干扰
//   3. 章节存档在会话内部，可单独阅读、删除、整体导出 TXT
//   4. 楼层可以"隐藏"——照常显示给你看，但不进 prompt，省 token 又不丢内容
//   5. 主/副 API 可按会话切换
//   6. 系统提示词整体过一遍 applyMacros，所以 {{char}} / {{getvar}} / EJS <% %> 在这里也能用
//
// 世界书、正则、思维链、MVU 变量、记忆召回全部复用白露已有的那套实现，没有另起炉灶。
// =====================================================================================

let storySessions = [];          // 见文件末尾 createStorySession() 的字段说明
let currentStorySessionId = null;
let storyStudioTab = 'write';    // 'write' | 'set' | 'arc'
let ssPendingImage = null;
let ssAbortController = null;
let ssMenuTurnId = null;
let ssTouchTimer = null;

// ---------------------------------------------------------------- 基础工具

function ssEsc(s) {
    return (typeof escapeHtml === 'function')
        ? escapeHtml(s == null ? '' : s)
        : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function ssSession() {
    return storySessions.find(s => s.id === currentStorySessionId) || null;
}
function ssScopeId(session) {
    // 变量宏 / MVU 状态树 / 记忆库 / 世界书 sticky 都按这个 key 分桶，
    // 保证同一个续写会话内状态连续，不同会话之间互不串味。
    return 'story_' + (session ? session.id : 'none');
}
function ssAlert(msg) {
    if (typeof appAlert === 'function') appAlert(msg); else alert(msg);
}
async function ssConfirm(msg) {
    if (typeof appConfirm === 'function') return await appConfirm(msg);
    return confirm(msg);
}

// ---------------------------------------------------------------- 会话增删改查

function createStorySession(title) {
    const session = {
        id: 'ss_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        title: title || '未命名续写',
        outline: '',
        extraChars: '',                 // 角色卡之外临时登场人物的补充说明
        chars: [],                      // 参与角色 id 列表，'me' 表示用户自己也出场
        wordCount: 300,
        secondPerson: true,
        maxHistory: 20,                 // 发给 AI 的历史轮数
        apiMode: 'sub',                 // 'main' 用主API；'sub' 优先副API、没配就自动回落主API
        turns: [],
        chapters: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    storySessions.unshift(session);
    saveAllData();
    return session;
}

function newStorySession() {
    const s = createStorySession();
    openStorySession(s.id);
}

function openStorySession(id) {
    const changed = currentStorySessionId !== id;
    currentStorySessionId = id;
    storyStudioTab = 'write';
    // 换了一段续写＝换了一个"聊天"，广播同类软件的 CHAT_CHANGED。
    // 卡片靠这个事件重置自己的状态（比如手账本清掉上一段的进度），
    // 不发的话卡片会拿着上一段的数据继续显示。
    if (changed && typeof gyTavernEmit === 'function') {
        setTimeout(() => gyTavernEmit('chat_id_changed', id), 80);
    }
    const listView = document.getElementById('storyStudioListView');
    const workView = document.getElementById('storyStudioWorkView');
    if (listView) listView.style.display = 'none';
    if (workView) workView.style.display = 'flex';
    ssSettingsToForm();
    renderSsCharChecks();
    switchStoryTab('write');
}

function closeStorySession() {
    // 离开工作台前把表单里的最新值同步进会话，避免"改了没保存"
    ssFormToSettings();
    saveAllData();
    currentStorySessionId = null;
    const listView = document.getElementById('storyStudioListView');
    const workView = document.getElementById('storyStudioWorkView');
    if (workView) workView.style.display = 'none';
    if (listView) listView.style.display = 'block';
    renderStoryStudioList();
}

async function deleteStorySession(id, event) {
    if (event) event.stopPropagation();
    const s = storySessions.find(x => x.id === id);
    if (!s) return;
    if (!(await ssConfirm(`确定删除续写《${s.title || '未命名'}》吗？\n里面 ${s.turns.length} 层剧情和 ${s.chapters.length} 个章节都会一起删掉，找不回来。`))) return;
    storySessions = storySessions.filter(x => x.id !== id);
    if (currentStorySessionId === id) currentStorySessionId = null;
    saveAllData();
    renderStoryStudioList();
}

async function renameStorySession(id, event) {
    if (event) event.stopPropagation();
    const s = storySessions.find(x => x.id === id);
    if (!s) return;
    // 用 appPrompt 而不是原生 prompt：Electron 不支持 window.prompt()，
    // 调了直接抛异常，表现是"点了重命名完全没反应"。
    const next = await appPrompt('新的名字：', s.title || '');
    if (next == null) return;
    s.title = next.trim() || '未命名续写';
    s.updatedAt = Date.now();
    saveAllData();
    renderStoryStudioList();
}

// ---------------------------------------------------------------- 列表页

function renderStoryStudio() {
    // switchMainView('storyStudio') 的入口：没打开具体会话就显示列表
    migrateLegacyStoryTurns();
    if (currentStorySessionId && storySessions.some(s => s.id === currentStorySessionId)) {
        openStorySession(currentStorySessionId);
    } else {
        const listView = document.getElementById('storyStudioListView');
        const workView = document.getElementById('storyStudioWorkView');
        if (workView) workView.style.display = 'none';
        if (listView) listView.style.display = 'block';
        renderStoryStudioList();
    }
}

function renderStoryStudioList() {
    const box = document.getElementById('storyStudioList');
    if (!box) return;
    if (storySessions.length === 0) {
        box.innerHTML = `<div class="ss-empty">还没有任何续写。<br>点上面的「＋ 新建续写」开一段故事——输入几句话开个头，AI 会顺着往下写，一轮一轮推进。</div>`;
        return;
    }
    box.innerHTML = storySessions.map(s => {
        const lastTurn = s.turns.length ? s.turns[s.turns.length - 1] : null;
        const preview = lastTurn ? String(lastTurn.text || '').replace(/<[^>]+>/g, '').slice(0, 70) : '（还没有内容）';
        const charNames = (s.chars || []).map(id => {
            if (id === 'me') return (currentUser && currentUser.name) || '我';
            const c = myCharacters.find(x => x.id == id);
            return c ? c.name : null;
        }).filter(Boolean).join('、');
        return `
        <div class="ss-card" onclick="openStorySession('${s.id}')">
            <div class="ss-card-head">
                <span class="ss-card-title">${ssEsc(s.title || '未命名续写')}</span>
                <span class="ss-card-ops">
                    <span onclick="renameStorySession('${s.id}', event)" title="重命名">✏️</span>
                    <span onclick="deleteStorySession('${s.id}', event)" title="删除" style="color:#f91880;">🗑️</span>
                </span>
            </div>
            <div class="ss-card-meta">${s.turns.length} 层剧情 · ${s.chapters.length} 章存档${charNames ? ' · ' + ssEsc(charNames) : ''}</div>
            <div class="ss-card-preview">${ssEsc(preview)}${preview.length >= 70 ? '…' : ''}</div>
            <div class="ss-card-time">${new Date(s.updatedAt || s.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------- 标签页

function switchStoryTab(tab) {
    storyStudioTab = tab;
    ['write', 'set', 'arc'].forEach(t => {
        const btn = document.getElementById('ssTab-' + t);
        const pane = document.getElementById('ssPane-' + t);
        if (btn) btn.className = 'ss-tab' + (t === tab ? ' active' : '');
        // 续写页是 flex 纵向布局（剧情区撑满、输入框钉在最底下），另外两页普通块级即可
        if (pane) pane.style.display = (t === tab ? (t === 'write' ? 'flex' : 'block') : 'none');
    });
    if (tab === 'write') renderSsTurns();
    if (tab === 'set') { ssSettingsToForm(); renderSsCharChecks(); renderSsDiag(); }
    if (tab === 'arc') renderSsChapters();
}

// ---------------------------------------------------------------- 设定表单

function ssSettingsToForm() {
    const s = ssSession();
    if (!s) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    set('ssTitle', s.title || '');
    set('ssOutline', s.outline || '');
    set('ssExtraChars', s.extraChars || '');
    set('ssWordCount', s.wordCount || 300);
    set('ssMaxHistory', s.maxHistory || 20);
    set('ssApiMode', s.apiMode || 'sub');
    chk('ssSecondPerson', s.secondPerson !== false);
}

function ssFormToSettings() {
    const s = ssSession();
    if (!s) return;
    const val = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
    const chk = id => { const el = document.getElementById(id); return el ? el.checked : undefined; };
    const t = val('ssTitle'); if (t !== undefined) s.title = t.trim() || '未命名续写';
    const o = val('ssOutline'); if (o !== undefined) s.outline = o;
    const e = val('ssExtraChars'); if (e !== undefined) s.extraChars = e;
    const w = val('ssWordCount'); if (w !== undefined) s.wordCount = parseInt(w, 10) || 300;
    const m = val('ssMaxHistory'); if (m !== undefined) s.maxHistory = parseInt(m, 10) || 20;
    const a = val('ssApiMode'); if (a !== undefined) s.apiMode = a;
    const sp = chk('ssSecondPerson'); if (sp !== undefined) s.secondPerson = sp;
    s.updatedAt = Date.now();
}

function saveSsSettings() {
    ssFormToSettings();
    saveAllData();
    if (typeof showToast === 'function') {
        showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">💾</div>`, '设定已保存', '这段续写的设定已更新。', null, null);
    }
}

function renderSsCharChecks() {
    const box = document.getElementById('ssCharChecks');
    const s = ssSession();
    if (!box || !s) return;
    const selected = new Set((s.chars || []).map(String));
    const items = [{ id: 'me', name: (currentUser && currentUser.name) || '我（用户本人出场）' }]
        .concat(myCharacters.map(c => ({ id: c.id, name: c.name })));
    box.innerHTML = items.map(it => `
        <label class="ss-chk">
            <input type="checkbox" class="ss-char-check" value="${it.id}" ${selected.has(String(it.id)) ? 'checked' : ''} onchange="syncSsChars()">
            ${ssEsc(it.name)}
        </label>`).join('');
}

function syncSsChars() {
    const s = ssSession();
    if (!s) return;
    s.chars = Array.from(document.querySelectorAll('.ss-char-check:checked')).map(cb => {
        const v = cb.value;
        return v === 'me' ? 'me' : (parseInt(v, 10) || v);
    });
    s.updatedAt = Date.now();
    saveAllData();
}

// ---------------------------------------------------------------- 提示词组装

function ssCharObjects(session) {
    return (session.chars || []).map(id => id === 'me' ? currentUser : myCharacters.find(x => x.id == id)).filter(Boolean);
}

// 这一轮的正文算在哪个角色头上——决定"仅限该角色"的正则脚本（状态栏那类）要不要跑。
// 多角色同场时取第一个非"me"的角色兜底，跟旧版行为一致。
function ssTurnCharId(session) {
    const raw = (session.chars || []).find(v => v !== 'me');
    return raw != null ? raw : null;
}

function buildSsSystemPrompt(session, recentContextText) {
    const charObjs = ssCharObjects(session);
    const charContext = charObjs.map(c => {
        const extraMemory = c.memorySummary ? `\n[该角色近期的经历记忆]: ${c.memorySummary}` : '';
        return `角色【${c.name}】：${c.persona || '暂无设定'}${extraMemory}`;
    }).join('\n\n');

    // 世界书：全局的 + 出场角色各自挂载的，按最近剧情内容关键词触发。
    // 传 sessionKey 和 turnIndex 才能让条目的 sticky / cooldown / delay / 概率触发生效。
    const wbText = (typeof getStoryWorldbookText === 'function')
        ? getStoryWorldbookText(charObjs, recentContextText, ssScopeId(session), session.turns.length)
        : '';

    // 小剧场：跟旧版共用同一套检测/注入逻辑，scopeId 传会话 id 保证变量宏在一段续写内连续
    const theaterChar = charObjs.find(c => c && c.id != null && !(currentUser && c === currentUser)) || null;
    const theaterInjection = (typeof getTheaterPromptInjection === 'function')
        ? getTheaterPromptInjection(theaterChar, session.id) : '';
    const theaterBlock = theaterInjection
        ? `\n【附加环节：小剧场】\n这一轮续写正文写完之后，请紧接着按下面的规则再追加生成一段小剧场番外内容：\n${theaterInjection}\n`
        : '';

    const wordNote = (typeof WORD_LIMIT_PRIORITY_NOTE !== 'undefined') ? WORD_LIMIT_PRIORITY_NOTE : '';
    const markerNote = (typeof getFinalAnswerMarkerPromptNote === 'function') ? getFinalAnswerMarkerPromptNote() : '';

    const raw = `你是一个才华横溢的互动故事续写者，正在与用户共同创作故事《${session.title || '未命名故事'}》。

【核心故事大纲与走向】(⚠️必须围绕此大纲发展剧情，同时要灵活结合用户每一轮的引导)：
${session.outline || '无大纲，请自由发挥想象力推进剧情，并顺着用户的引导发展'}

${wbText}【主要登场角色与设定】：
${charContext || '无特定登场角色，可根据剧情自由安排角色'}
${session.extraChars ? `\n【补充登场人物】：\n${session.extraChars}\n` : ''}
【互动创作规则】：
1. 用户每次会发来一小段话（可能是剧情指令、角色台词、动作描写，或单纯的方向引导），请你紧接着当前剧情，把它自然地融入故事并继续往下写，不要另起炉灶、不要重开场景。
2. 直接输出续写正文（叙事、对话皆可），不要输出"好的""接下来"之类的寒暄语，不要原样复述用户刚才说的话，不要输出Markdown代码块或"第X章"之类的标题前缀。
3. 单次续写字数控制在约${session.wordCount || 300}字左右（这是目标参考值，允许有一定浮动，但不要明显偏离太多），像连载小说一样留有余地，不要一次性把剧情写死写满，给用户下一轮继续引导的空间。${wordNote}
4. 严格贴合上方角色人设与世界观设定行事，人物言行不能崩坏、不能脱离设定杜撰能力或背景。${session.secondPerson !== false ? '\n5. 采用第二人称视角写作：把"你"当作这个故事的主角/视角人物，叙述和心理描写都用"你"来指代主角本人（例如"你推开门，心里一紧"），不要用"我"的第一人称、也不要用角色名字或"他/她"的第三人称来写主角视角的内容；其他配角正常按人称描写即可，对话引号内的台词不受此限制。' : ''}
6. 如果世界观设定/正则脚本里要求每次输出/每段情境结束时固定附带某种格式标签或HTML（比如状态栏、卡片等），照常写进这一轮正文末尾即可，不用因为是续写场景就跳过或省略这些规则。
${theaterBlock}
${markerNote}`;

    // 整体过一遍宏系统：{{char}} {{user}} {{getvar::x}} 以及 EJS <% %> 都在这一步生效。
    // 旧版的互动续写漏了这一步，导致人设里写的宏在续写场景下不会被替换。
    if (typeof applyMacros === 'function') {
        return applyMacros(raw, charObjs.find(c => c !== currentUser) || null, ssScopeId(session));
    }
    return raw;
}

// 组装发给 AI 的历史：跳过隐藏楼层，并对每条套用"仅影响发给AI"的正则（带 depth）
function buildSsHistory(session, upToIndex) {
    const all = session.turns.slice(0, upToIndex == null ? session.turns.length : upToIndex);
    const visible = all.filter(t => !t.hidden);
    const sliced = visible.slice(-(session.maxHistory || 20));
    const total = sliced.length;
    const turns = sliced.map((t, i) => {
        let text = t.text || '';
        if (typeof applyPromptOnlyRegex === 'function') {
            text = applyPromptOnlyRegex(text, total - 1 - i, t.role === 'user' ? null : t.charId);
        }
        return { role: t.role === 'user' ? 'user' : 'assistant', content: text };
    });
    // 角色卡组件通过 injectPrompts 临时挂上的提示词，在这里按深度插进历史。
    // 只影响这次请求，不落存档正文——跟同类软件的 injectPrompts 语义一致。
    if (typeof gyApplyInjects === 'function' && session.cardInjects && session.cardInjects.length) {
        try { return gyApplyInjects(turns, null, null); } catch (e) { console.error('注入提示词出错：', e); }
    }
    return turns;
}

// ---------------------------------------------------------------- 渲染剧情

function renderSsTurns() {
    const box = document.getElementById('ssTurns');
    const s = ssSession();
    if (!box || !s) return;
    const turns = s.turns || [];
    if (turns.length === 0) {
        box.innerHTML = `<div class="ss-empty">在下面输入几句话开个头，AI 会顺着往下续写剧情，就像聊天一样一轮一轮推进。<br>也可以点上面的「💬 用角色开场白开个头」，直接拿角色卡自带的开场白当第一轮。<br>世界书会按当前剧情内容自动触发，不用手动挂载。</div>`;
        return;
    }
    // 从旧版互动续写迁移过来的楼层可能没有 charId，退回按这个会话勾选的第一个角色兜底，
    // 否则角色专属的状态栏正则命中不了
    const fallbackCharId = ssTurnCharId(s);
    const showFloor = typeof showNovelFloorNumber === 'undefined' || showNovelFloorNumber;
    const showTime = typeof showNovelThinkingTime === 'undefined' || showNovelThinkingTime;

    box.innerHTML = turns.map((t, idx) => {
        const isUser = t.role === 'user';
        const bits = [];
        // 楼层号跟同类软件对齐：**从 0 开始**，楼层号就是 message_id。
        // 角色卡的组件调 setChatMessages([{message_id:N}]) 时说的就是这个号，
        // 显示成 1 起会跟卡片对不上，排查问题时也容易数错。
        if (showFloor) bits.push(`#${idx}楼`);
        if (showTime && !isUser && t.genTimeMs) bits.push(`🕐 耗时 ${(t.genTimeMs / 1000).toFixed(1)}s`);
        if (t.hidden) bits.push('已隐藏·不进prompt');
        const meta = bits.length
            ? `<div class="ss-meta" style="text-align:${isUser ? 'right' : 'left'};">${ssEsc(bits.join(' · '))}</div>` : '';

        const events = !isUser
            ? `oncontextmenu="showSsTurnMenu(event, '${t.id}')" ontouchstart="ssTouchStart(event, '${t.id}')" ontouchend="ssTouchEnd()" ontouchmove="ssTouchEnd()"`
            : '';

        let swipeHtml = '';
        // 开场那一楼：◀▶ 在这个角色的所有开场白之间切（跟同类软件第 0 楼的 swipes 一个意思）。
        // 切的时候要重跑宏/正则/MVU 整条链，所以走 swipeSsTurn → ssSwitchOpening，
        // 不能像普通楼层那样直接换个文本了事。
        if (!isUser && t.fromGreeting && (t.greetingCount || 0) > 1) {
            const gi = (typeof t.greetingIndex === 'number') ? t.greetingIndex : 0;
            swipeHtml = `
            <div class="ss-swipe">
                <span class="nav" onclick="swipeSsTurn('${t.id}', -1)">◀</span>
                <span>开场 ${gi + 1} / ${t.greetingCount}</span>
                <span class="nav" onclick="swipeSsTurn('${t.id}', 1)">▶</span>
            </div>`;
        } else if (!isUser && t.swipes && t.swipes.length > 1) {
            const cIdx = t.currentSwipe || 0;
            swipeHtml = `
            <div class="ss-swipe">
                <span class="nav" onclick="swipeSsTurn('${t.id}', -1)">◀</span>
                <span>${cIdx + 1} / ${t.swipes.length}</span>
                <span class="nav" onclick="swipeSsTurn('${t.id}', 1)">▶</span>
            </div>`;
        }

        // 思维链 / MVU 状态栏 / 记忆召回都单独存字段、单独拼在正文前面，
        // 绝不拼进 t.text —— 否则从文本开头 ^ 锚定匹配的状态栏正则会被它们挡住，永远匹配不上。
        const head = isUser ? '' :
            (t.reasoningHtml || '') +
            (t.mvuSnapshot && typeof renderMvuStatusBarHtml === 'function' ? renderMvuStatusBarHtml(t.mvuSnapshot) : '') +
            (t.recallHtml || '');

        // 深度＝距离最新一楼有多少楼（最新=0），角色卡状态栏正则的 maxDepth 靠它生效：
        // 像"只在最新一楼渲染报纸状态栏"这种限制，不传深度的话会变成每一楼都渲染一份，
        // 十几万字符的卡片乘以楼层数，页面直接卡死。
        const depth = turns.length - 1 - idx;
        let bodyHtml = (typeof renderMarkdownLite === 'function')
            ? renderMarkdownLite(t.text, isUser ? null : (t.charId || fallbackCharId), depth)
            : ssEsc(t.text);
        if (typeof namespaceInjectedIds === 'function') bodyHtml = namespaceInjectedIds(bodyHtml, t.id);

        const img = t.image ? `<img src="${t.image}" class="ss-img">` : '';

        return `
        <div class="ss-turn ${isUser ? 'me' : 'other'}${t.hidden ? ' hidden-turn' : ''}">
            <div class="ss-wrap">
                ${meta}
                <div class="ss-bubble ${isUser ? 'me' : 'other'}" data-turn-id="${t.id}" ${events}>${head}${bodyHtml}${img}</div>
                ${swipeHtml}
            </div>
        </div>`;
    }).join('');

    // 卡片 HTML 带进来的源码缩进换行会被 pre-wrap 渲染成空行，摘掉
    if (typeof pruneCardWhitespace === 'function') {
        box.querySelectorAll('.ss-bubble').forEach(b => pruneCardWhitespace(b));
    }
    box.scrollTop = box.scrollHeight;
    if (typeof renderSsCardButtons === 'function') renderSsCardButtons();
    // 状态栏那类卡片的"点击展开"是靠真的 <script> 跑起来的，跟别处一样受安全开关控制
    if (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution && typeof executeInjectedScripts === 'function') {
        try { executeInjectedScripts(box); } catch (e) { console.error('执行续写工作台注入脚本时出错：', e); }
    }
}

// 流式期间只更新这一条气泡，不整列表重绘（长对话下全量重绘很卡）
function updateSsBubbleLive(turnId, text, showCursor) {
    const bubble = document.querySelector(`#ssTurns .ss-bubble[data-turn-id="${turnId}"]`);
    if (!bubble) return;
    const escaped = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    bubble.innerHTML = escaped + (showCursor ? '<span class="typing-blink">▍</span>' : '');
    const box = document.getElementById('ssTurns');
    if (box) box.scrollTop = box.scrollHeight;
}

// ---------------------------------------------------------------- 开场白开局

// 「用角色开场白开个头」：不用自己手打第一句，直接拿已勾选角色卡里的开场白
// （firstMessage + alternateGreetings）当续写的第一轮 AI 发言。
// 复用聊天/小说那边同一套挑选弹窗（greetingPickerModal），只是把 mode 标成 storyStudio，
// 选中之后回到下面的 applySsGreeting 落地。
// 这个角色的开场白有没有"美化版"？
//
// 现在的角色卡很多会给开场白配一条正则（叫「开场白跳转」「开场主页」这类），
// 把 <greetings>...</greetings> 或者【开场白】这种标记整个替换成一整页做好的 HTML —
// 一排可点的场景卡片，点一下调 setChatMessages 切到对应开场白。
//
// 以前白露的挑选框只按纯文本列，等于把作者做好的那一页完全浪费掉了。
// 现在先跑一遍显示正则，只要结果是"完整前端页面"，就直接把那一页渲染出来给你用。
// 🐛 实测 27 张卡后修正的一处选错：以前是"第一条能渲染成整页 HTML 的就用它"。
// 可这类卡里**每一条**开场白都会被正则渲染成整页 HTML（蔚野是仿苹果播客播放器、
// 沈映寒/闻述是聊天流截图），第一条命中的往往只是一段普通剧情，不是那份目录页。
// 现在分两轮挑：先找真正的"开场白导航页"（hasGreetingNavTargets 认出来的那种，
// 点里面的条目会跳到别的开场白），找不到再退回原来的"第一条整页 HTML"。
// 「这一页 HTML 是不是这条开场白的全部内容」。
// 🐛 修的是"美化开场白还是显示成纯文本"：很多卡会给**每一条普通开场白**的末尾挂一个
// 【返回】按钮，正则把它换成一小段完整 HTML 页面（闻述、易云辞、时间病症都是这么写的）。
// 只看 isFrontendHtml 的话，一条 1200 字的正常剧情 + 一个返回按钮也会被当成"美化开场白页"，
// 挑选框于是把这条剧情当美化版摊出来——满屏都是正文，那个按钮 iframe 缩在最下面看不见，
// 看起来就是"美化开场白没生效、还是纯文本"。
// 判据：把成品里的 HTML 页面部分整个抠掉，剩下的可见文字如果还有一大段，
// 那这就是"带装饰的普通开场白"，不是作者做的那一页。
function ssFrontendDominates(out) {
    let rest = String(out || '');
    rest = rest.replace(/```[a-zA-Z0-9]*[\s\S]*?```/g, '');          // 围栏包起来的整页
    rest = rest.replace(/<!DOCTYPE\s+html[\s\S]*?<\/html\s*>/gi, ''); // 裸的整份文档
    rest = rest.replace(/<html[\s\S]*?<\/html\s*>/gi, '');
    rest = rest.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
    rest = rest.replace(/<[^>]*>/g, '');                              // 剩下的零散标签
    rest = rest.replace(/\s|&nbsp;/g, '');
    return rest.length <= 150;   // 150 字以内算"只是页面旁边的一两句话"，超了就是正文
}
function ssGreetingBeautified(char) {
    if (!char || typeof applyDisplayOnlyRegex !== 'function' || typeof isFrontendHtml !== 'function') return null;
    const list = (typeof getGreetingOptions === 'function') ? (getGreetingOptions(char) || []) : [];
    let fallback = null;
    for (let i = 0; i < list.length; i++) {
        let out;
        try { out = applyDisplayOnlyRegex(list[i], char.id, 0); } catch (e) { continue; }
        // 🐛 这里以前还有一句 `if (out === list[i]) continue;`（"正则没命中就不是美化版"），
        // 结果把**作者直接把整页 HTML 写死在开场白正文里、压根不需要正则**的那一类漏掉了
        // （沉沦法则的 first_mes 就是这样，59982 字符的完整页面）。判据只看成品是不是整页 HTML 就够了。
        if (!isFrontendHtml(out)) continue;         // 不是整页 HTML，按普通文本处理就行
        if (typeof hasGreetingNavTargets === 'function' && hasGreetingNavTargets(out)) {
            return { greetingIndex: i, raw: list[i], isMenu: true };
        }
        if (!ssFrontendDominates(out)) continue;    // 正文压倒性地多 → 这是带装饰的普通开场白，不当美化页
        if (!fallback) fallback = { greetingIndex: i, raw: list[i], isMenu: false };
    }
    return fallback;
}

// 「用角色开场白开个头」——挑选框。
//
// 两种呈现：
//   · 有美化版 → 直接把作者做好的那一页渲染出来（点里面的场景卡片就能开局）
//   · 没有     → 还是原来的纯文本候选列表
// 勾了多个角色时，上面多一排角色按钮，可以切着看每个角色的美化开场白。
function showSsGreetingPicker() {
    const session = ssSession();
    if (!session) return;
    if (typeof getGreetingOptions !== 'function') return ssAlert('开场白功能不可用（js/05 没加载成功）');

    const chars = (session.chars || [])
        .filter(id => id !== 'me')                       // 用户自己没有"开场白"这个概念
        .map(id => myCharacters.find(c => c.id == id))
        .filter(c => c && getGreetingOptions(c).length > 0);

    if (chars.length === 0) {
        return ssAlert('已勾选出场的角色都没有设置开场白。\n先去「设定」页勾一个有开场白的角色，或者直接手打第一句开个头也行～');
    }

    window.__greetingPickerMode = 'storyStudio';
    // 有美化版的角色排前面——那才是作者希望你看到的样子
    window.__ssGreetChars = chars.slice().sort((a, b) => (ssGreetingBeautified(b) ? 1 : 0) - (ssGreetingBeautified(a) ? 1 : 0));
    window.__ssGreetCharId = window.__ssGreetChars[0].id;

    const titleEl = document.getElementById('greetingPickerTitle');
    if (titleEl) titleEl.innerText = '💬 选择开场白（作为续写第一轮）';
    renderSsGreetingPicker();
    openModal('greetingPickerModal');
}

// 切到某个角色的开场白
function ssGreetPickChar(charId) {
    window.__ssGreetCharId = charId;
    // 切角色也要把"美化/列表"重置回默认（有美化就看美化），不然切过去还停在上一个角色选的视图上
    window.__ssGreetForceList = false;
    renderSsGreetingPicker();
}

// 在「美化版」和「纯文本列表」之间切
function ssGreetToggleView() {
    window.__ssGreetForceList = !window.__ssGreetForceList;
    renderSsGreetingPicker();
}

function renderSsGreetingPicker() {
    const box = document.getElementById('greetingPickerList');
    if (!box) return;
    const chars = window.__ssGreetChars || [];
    const char = chars.find(c => String(c.id) === String(window.__ssGreetCharId)) || chars[0];
    if (!char) { box.innerHTML = ''; return; }

    // 多角色时才显示角色切换条，只有一个角色就不啰嗦
    let tabs = '';
    if (chars.length > 1) {
        tabs = `<div class="ss-greet-tabs">` + chars.map(c => {
            const on = String(c.id) === String(char.id);
            const pretty = ssGreetingBeautified(c) ? ' 🎨' : '';
            return `<button type="button" class="ss-greet-tab${on ? ' active' : ''}" onclick="ssGreetPickChar('${c.id}')">${ssEsc(c.name)}${pretty}</button>`;
        }).join('') + `</div>`;
    }

    const beautified = ssGreetingBeautified(char);
    const showPretty = beautified && !window.__ssGreetForceList;

    // 美化版和列表版之间可以互相切——美化那页有时候会漏掉几个候选，
    // 或者你就是想看看原文，留个退路
    let toggle = '';
    if (beautified) {
        toggle = `<div class="ss-greet-switch">
            <button type="button" onclick="ssGreetToggleView()">${showPretty ? '📄 看纯文本列表' : '🎨 看美化开场白'}</button>
        </div>`;
    }

    if (showPretty) {
        // 走跟楼层完全同一条渲染链路：applyDisplayOnlyRegex → iframe 隔离。
        // 所以卡片里的 setChatMessages 照样能用，点一下就开局。
        const html = (typeof renderMarkdownLite === 'function')
            ? renderMarkdownLite(beautified.raw, char.id, 0) : '';
        box.innerHTML = (typeof randomGreetingCardHtml === 'function' ? randomGreetingCardHtml('storyStudio') : '') + tabs + toggle + `<div class="ss-greet-pretty">${html}</div>`;
        if (typeof mountFrontendFrames === 'function') mountFrontendFrames(box);
        // 兜底：ssGreetingBeautified 判定"这是整页 HTML"，但真正渲染出来一个 iframe 都没有——
        // 说明这一页在渲染链路上被别的规则吃掉了（历史上出过好几次）。这种时候宁可退回纯文本列表，
        // 也不能给用户留一块空白/一坨裸文字，那样连开场白都选不了。
        if (!box.querySelector('iframe.gy-frontend-frame')) {
            console.warn('[开场白] 这条美化开场白没能渲染出 iframe，已自动退回纯文本列表。角色：', char.name);
            window.__ssGreetForceList = true;
            return renderSsGreetingPicker();
        }
        return;
    }

    // 纯文本列表：沿用聊天那边同一套卡片渲染
    const options = getGreetingOptions(char).map((text, gi) => ({
        charId: char.id, charName: char.name, text, greetingIndex: gi,
    }));
    // 续写这边跟聊天/小说相反：目录页排最前、当正式入口标出来。
    // 因为在这里点开目录页是真能用的——上面那条美化分支会把作者做的整页渲染出来，
    // 点里面的场景卡就直接开局（实测江执那页点"温柔的入侵"确实把第一轮换成了对应开场白）。
    const sorted = (typeof sortGreetingOptions === 'function')
        ? sortGreetingOptions(options, { menuFirst: true, charId: char.id })
        : options;
    window.__greetingPickerOptions = sorted;
    box.innerHTML = (typeof randomGreetingCardHtml === 'function' ? randomGreetingCardHtml('storyStudio') : '') + tabs + toggle
        + renderGreetingOptionCards(sorted, null, { charId: char.id, menuAsEntry: true });
}

// 选中某条开场白之后真正落地成第一轮。由 js/05 的 selectGreeting 在 mode==='storyStudio' 时调过来。
function applySsGreeting(item) {
    const session = ssSession();
    if (!session || !item) return;
    const char = myCharacters.find(c => c.id == item.charId);

    // <!-- title --> / <!-- desc --> 那两行只是给挑选界面看的标签，不是开场白正文，先剥掉
    const meta = (typeof parseGreetingMeta === 'function') ? parseGreetingMeta(item.text) : null;
    let text = meta ? meta.body : item.text;

    // 宏 + EJS：作用域跟这段续写的其它内容保持一致，开场白里写的 {{user}}/{{getvar}} 才能对上
    if (typeof applyMacros === 'function') {
        try { text = applyMacros(text, char, ssScopeId(session)); }
        catch (e) { console.error('开场白宏替换出错，改用原文：', e); }
    }

    // 跟正常生成的一轮走同一条后处理链：正则 → MVU 变量补丁 → 记忆召回。
    // 这里明确知道是哪个角色（item.charId），charScope 限定的状态栏正则才能正常触发。
    const p = ssPostProcess(text, session, item.charId);

    session.turns.push({
        id: 't_' + Date.now() + '_a',
        role: 'ai',
        text: p.text,
        timestamp: Date.now(),
        charId: item.charId,
        reasoningHtml: p.reasoningHtml,
        mvuSnapshot: p.mvuSnapshot,
        recallHtml: p.recallHtml,
        fromGreeting: true,
        greetingIndex: (typeof item.greetingIndex === 'number') ? item.greetingIndex : undefined,
        // 记下这个角色一共有几个开场白 —— 开场那一楼的 ◀▶ 就是在这些之间切，
        // 跟同类软件里"第 0 楼的 swipes 就是所有候选开场白"完全一致。
        greetingCount: (char && typeof getGreetingOptions === 'function') ? (getGreetingOptions(char) || []).length : undefined,
    });
    session.updatedAt = Date.now();
    saveAllData();
    if (storyStudioTab !== 'write') switchStoryTab('write');
    renderSsTurns();
}

// 「换一个开场白」——给角色卡自带的开场白菜单用。
//
// 很多角色卡的开场白其实是一整页 HTML 目录（一排可点的场景卡片），点一下会调
// setChatMessages([{message_id:0, swipe_id:N}])，意思是"把开场换成第 N 个开场白"。
// 白露这边对应的动作就是：把当前这段续写里那条开场轮**换掉**（不是再追加一条）。
//
// 只在"开场那一轮还是整段续写的开头、后面没写出别的内容"时才直接换；
// 如果后面已经续写出内容了，换开场等于把已经写的东西架空，这时候要先问一句。
function ssSwitchOpening(charId, swipeIdx, opts) {
    opts = opts || {};
    const session = ssSession();
    if (!session) return { ok: false, reason: '当前没有打开的续写' };
    if (typeof getGreetingOptions !== 'function') return { ok: false, reason: '开场白功能不可用' };

    // 卡片没告诉我们是谁的开场白时，退回这段续写勾选的角色
    let cid = charId;
    if (cid === null || cid === undefined || cid === '') cid = ssTurnCharId(session);
    const char = myCharacters.find(c => String(c.id) === String(cid));
    if (!char) return { ok: false, reason: '找不到对应的角色' };

    const options = getGreetingOptions(char) || [];
    const idx = Number(swipeIdx);
    if (!(idx >= 0 && idx < options.length)) {
        return { ok: false, reason: `这个角色只有 ${options.length} 个开场白，卡片要的是第 ${idx + 1} 个` };
    }

    const turns = session.turns || [];
    const openingPos = turns.findIndex(t => t.fromGreeting);
    // 开场轮后面还有别的内容吗？（开场轮之后只要还有任何一轮，就是"已经写下去了"）
    const hasMore = openingPos >= 0 ? turns.length > openingPos + 1 : turns.length > 0;
    if (hasMore) {
        const go = confirm(`要把开场换成第 ${idx + 1} 个开场白吗？\n\n后面已经写了 ${turns.length - (openingPos >= 0 ? openingPos + 1 : 0)} 楼，换掉开场之后这些内容还在，但可能接不上了。`);
        if (!go) return { ok: true, value: 0, cancelled: true };
    }

    // 从美化开场白那一页点进来的：选完就把挑选框关掉，不然那一页还杵在屏幕上
    try {
        const modal = document.getElementById('greetingPickerModal');
        if (modal && modal.style.display === 'flex' && typeof closeModal === 'function') closeModal('greetingPickerModal');
    } catch (e) { /* ignore */ }

    const item = { charId: char.id, charName: char.name, text: options[idx], greetingIndex: idx };
    if (openingPos >= 0) {
        // 换掉原来那条：先摘掉，再让 applySsGreeting 按同一条后处理链生成新的，
        // 然后挪回原来的位置，保证开场永远在最前面
        const before = turns.length;
        turns.splice(openingPos, 1);
        applySsGreeting(item);
        if (session.turns.length === before) {
            const fresh = session.turns.pop();
            session.turns.splice(openingPos, 0, fresh);
            saveAllData();
            renderSsTurns();
        }
    } else {
        applySsGreeting(item);
    }
    return { ok: true, value: 1 };
}

// ---------------------------------------------------------------- 生成

function ssGetApi(session) {
    // v107：续写归「主 API」那一档（方案 A：你会逐字读的内容走好模型）。
    // 会话自己选了 'sub' 才走副 API；没选过的默认就是主 API 优先。
    if (session && session.apiMode === 'sub') return getApiConfig(true);
    return (typeof getApiMain === 'function') ? getApiMain() : getApiConfig(false);
}

// 把一段 AI 原始输出跑完整条后处理链：思维链 → 正则 → MVU 补丁 → 记忆召回
function ssPostProcess(rawText, session, turnCharId) {
    let text = String(rawText || '').replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
    const extract = (typeof extractReasoningForNovel === 'function')
        ? extractReasoningForNovel(text) : { rest: text, reasoningHtml: '' };
    text = extract.rest;
    if (typeof applyRegexScripts === 'function') text = applyRegexScripts(text, 'ai_output', turnCharId);

    let mvuSnapshot = null, recallHtml = '';
    if (typeof processMvuPatchInText === 'function') {
        const r = processMvuPatchInText(text, ssScopeId(session));
        text = r.cleanText; mvuSnapshot = r.snapshot;
    }
    if (typeof processRecallBlockInText === 'function') {
        const r = processRecallBlockInText(text, ssScopeId(session));
        text = r.cleanText; recallHtml = r.recallHtml;
    }
    return { text, reasoningHtml: extract.reasoningHtml, mvuSnapshot, recallHtml };
}

function ssSendClick() {
    if (ssAbortController) ssAbortController.abort();
    else sendSsTurn();
}

async function sendSsTurn() {
    const session = ssSession();
    if (!session) return;
    ssFormToSettings();

    const api = ssGetApi(session);
    if (!api.key) return ssAlert('请先在设置里配置 API Key（主API或副API）！');

    const inputEl = document.getElementById('ssInput');
    let userText = inputEl.value.trim();
    const pendingImage = ssPendingImage;
    if (!userText && !pendingImage && session.turns.length === 0) {
        return ssAlert('请先输入几句话开个头，或上传一张图～');
    }
    if (typeof applyRegexScripts === 'function') userText = applyRegexScripts(userText, 'user_input');

    const btn = document.getElementById('ssSend');
    const originalText = btn.innerText;
    btn.innerText = '取消'; btn.classList.add('generating');
    inputEl.disabled = true;
    const abortController = new AbortController();
    ssAbortController = abortController;

    // 先用"还没塞入新一轮"的原始 turns 算上下文，再把用户这轮和空占位一起渲染出来
    const recentContextText = session.turns.slice(-6).map(t => t.text).join('\n') + '\n' + userText;
    const history = buildSsHistory(session);
    const turnCharId = ssTurnCharId(session);

    const userTurnId = 't_' + Date.now() + '_u';
    const aiTurnId = 't_' + Date.now() + '_a';
    session.turns.push({ id: userTurnId, role: 'user', text: userText || '（发来一张图片）', image: pendingImage || null, timestamp: Date.now() });
    session.turns.push({ id: aiTurnId, role: 'ai', text: '', timestamp: Date.now(), charId: turnCharId });
    // 广播给角色卡里的组件：同类软件的 message_sent / generation_started 就是这两个时机
    if (typeof gyTavernEmit === 'function') {
        gyTavernEmit('message_sent', session.turns.length - 2);
        gyTavernEmit('generation_started');
    }
    inputEl.value = '';
    ssRemoveImage();
    renderSsTurns();
    updateSsBubbleLive(aiTurnId, '', true);

    const t0 = Date.now();
    try {
        const systemText = buildSsSystemPrompt(session, recentContextText);
        const finalUserText = userText || (pendingImage ? '（发来一张图片，请结合图片内容继续发展剧情）' : '请继续发展剧情。');
        const messages = buildStructuredMessages(systemText, history, finalUserText);

        let lastPartial = '';
        const data = await streamCompletionText(api, messages, (partial, isDone) => {
            lastPartial = partial;
            updateSsBubbleLive(aiTurnId, partial, !isDone);
        }, pendingImage ? [pendingImage] : null, abortController.signal);

        if (data.aborted) {
            // 主动取消：已经流出来的半截内容留着，一个字都没生成才把空占位撤回
            const aiTurn = session.turns.find(t => t.id === aiTurnId);
            if (aiTurn && lastPartial.trim()) {
                const p = ssPostProcess(lastPartial, session, turnCharId);
                aiTurn.text = p.text + '（已取消，内容可能不完整）';
                aiTurn.reasoningHtml = p.reasoningHtml;
                aiTurn.mvuSnapshot = p.mvuSnapshot;
                aiTurn.recallHtml = p.recallHtml;
                aiTurn.genTimeMs = Date.now() - t0;
            } else {
                session.turns = session.turns.filter(t => t.id !== userTurnId && t.id !== aiTurnId);
                inputEl.value = userText;
            }
            session.updatedAt = Date.now();
            saveAllData();
            renderSsTurns();
            return;
        }
        if (data.error) throw new Error(data.error.message || '请求报错');
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw) throw new Error('生成返回为空，可能是模型拒绝了这段内容，换个说法试试');

        const p = ssPostProcess(raw, session, turnCharId);
        const aiTurn = session.turns.find(t => t.id === aiTurnId);
        if (aiTurn) {
            aiTurn.text = p.text;
            aiTurn.reasoningHtml = p.reasoningHtml;
            aiTurn.mvuSnapshot = p.mvuSnapshot;
            aiTurn.recallHtml = p.recallHtml;
            aiTurn.genTimeMs = Date.now() - t0;
        }
        session.updatedAt = Date.now();
        saveAllData();
        renderSsTurns(); // 流式期间是纯文本直显，这里补一次完整渲染把 markdown / 状态栏 HTML 跑出来
        if (typeof gyTavernEmit === 'function') {
            gyTavernEmit('message_received', session.turns.length - 1);
            gyTavernEmit('generation_ended');
        }
        // 新一楼的内容会影响状态栏/手账本，把新快照推给所有卡片
        if (typeof gyTavernPushSnapshot === 'function') setTimeout(gyTavernPushSnapshot, 60);
    } catch (e) {
        // 失败：把这一对占位撤回，不留一个写着报错的空气泡
        session.turns = session.turns.filter(t => t.id !== userTurnId && t.id !== aiTurnId);
        saveAllData();
        renderSsTurns();
        inputEl.value = userText;
        ssAlert('续写失败：' + e.message);
    } finally {
        ssAbortController = null;
        btn.innerText = originalText; btn.classList.remove('generating');
        inputEl.disabled = false;
        inputEl.focus();
    }
}

// 侧滑重新生成：只用"这一轮之前"的剧情当上下文，结果攒进这一轮自己的 swipes
async function regenSsTurn(turnId) {
    const session = ssSession();
    if (!session) return;
    if (ssAbortController) return ssAlert('正在生成中，先等这一轮结束');

    const idx = session.turns.findIndex(t => t.id === turnId);
    if (idx === -1) return;
    const turn = session.turns[idx];
    if (turn.role === 'user') return;

    ssFormToSettings();
    const api = ssGetApi(session);
    if (!api.key) return ssAlert('请先在设置里配置 API Key（主API或副API）！');

    const turnCharId = turn.charId || ssTurnCharId(session);
    const priorTurns = session.turns.slice(0, idx);
    const recentContextText = priorTurns.slice(-6).map(t => t.text).join('\n');
    const history = buildSsHistory(session, idx);

    const oldText = turn.text;
    turn.text = '🔄 尝试新路线中...';
    renderSsTurns();

    const t0 = Date.now();
    try {
        const systemText = buildSsSystemPrompt(session, recentContextText);
        const finalUserText = '请换一个全新的角度或思路重新写这一轮的剧情发展（不要重复刚才那个版本的写法/走向），其它设定要求不变。';
        const messages = buildStructuredMessages(systemText, history, finalUserText);
        // keepReasoning：续写跟小说一样，把思考过程折叠成框展示，不在响应层剥掉
        const data = await callChatCompletionAPI(api, messages, 2, null, { keepReasoning: true });
        if (data.error) throw new Error(data.error.message || '请求报错');
        const raw = data.choices?.[0]?.message?.content?.trim();
        if (!raw) throw new Error('生成返回为空，可能是模型拒绝了这段内容，换个说法试试');

        const p = ssPostProcess(raw, session, turnCharId);
        if (!turn.swipes) turn.swipes = [oldText];
        turn.swipes.push(p.text);
        turn.currentSwipe = turn.swipes.length - 1;
        turn.text = p.text;
        turn.reasoningHtml = p.reasoningHtml;
        turn.mvuSnapshot = p.mvuSnapshot;
        turn.recallHtml = p.recallHtml;
        turn.genTimeMs = Date.now() - t0;
        session.updatedAt = Date.now();
        saveAllData();
        renderSsTurns();
    } catch (e) {
        turn.text = oldText;
        renderSsTurns();
        ssAlert('重新生成失败：' + e.message);
    }
}

function regenSsLastTurn() {
    const session = ssSession();
    if (!session) return;
    for (let i = session.turns.length - 1; i >= 0; i--) {
        if (session.turns[i].role !== 'user') return regenSsTurn(session.turns[i].id);
    }
    ssAlert('还没有可以重新生成的 AI 轮次');
}

function swipeSsTurn(turnId, direction) {
    const session = ssSession();
    if (!session) return;
    const turn = session.turns.find(t => t.id === turnId);
    if (!turn) return;

    // 开场那一楼：在所有开场白之间切。不能直接换文本——开场白里的宏、正则（状态栏/美化页）、
    // MVU 都得重跑一遍，所以交给 ssSwitchOpening 走完整链路。
    if (turn.fromGreeting && (turn.greetingCount || 0) > 1) {
        const n = turn.greetingCount;
        let idx = ((typeof turn.greetingIndex === 'number') ? turn.greetingIndex : 0) + direction;
        if (idx < 0) idx = n - 1;
        if (idx >= n) idx = 0;
        if (typeof ssSwitchOpening === 'function') ssSwitchOpening(turn.charId, idx, { silent: true });
        return;
    }

    if (!turn.swipes || turn.swipes.length <= 1) return;
    let idx = (turn.currentSwipe || 0) + direction;
    if (idx < 0) idx = turn.swipes.length - 1;
    if (idx >= turn.swipes.length) idx = 0;
    turn.currentSwipe = idx;
    turn.text = turn.swipes[idx];
    if (typeof gyTavernEmit === 'function') gyTavernEmit('message_swiped', session.turns.indexOf(turn));
    session.updatedAt = Date.now();
    saveAllData();
    renderSsTurns();
}

// ---------------------------------------------------------------- 右键 / 长按菜单

function showSsTurnMenu(e, turnId) {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    const session = ssSession();
    const turn = session && session.turns.find(t => t.id === turnId);
    if (!turn || turn.role === 'user') return;
    ssMenuTurnId = turnId;
    const menu = document.getElementById('ssTurnContextMenu');
    if (!menu) return;
    menu.innerHTML =
        `<button class="context-btn" onclick="ssMenuAct('regen')">🔄 侧滑重新生成</button>` +
        `<button class="context-btn" onclick="ssMenuAct('edit')">✏️ 编辑这一楼</button>` +
        `<button class="context-btn" onclick="ssMenuAct('hide')">${turn.hidden ? '👁️ 取消隐藏' : '🙈 隐藏（不进prompt）'}</button>` +
        `<button class="context-btn" onclick="ssMenuAct('copy')">📋 复制正文</button>` +
        `<button class="context-btn" style="color:#f91880;" onclick="ssMenuAct('del')">🗑️ 删除这一楼</button>`;
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY;
    if (x + 180 > window.innerWidth) x = Math.max(4, window.innerWidth - 188);
    if (y + 220 > window.innerHeight) y = Math.max(4, window.innerHeight - 228);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function ssTouchStart(e, turnId) {
    ssTouchEnd();
    const t = e.touches ? e.touches[0] : e;
    const pageX = t.pageX, pageY = t.pageY;
    ssTouchTimer = setTimeout(() => {
        showSsTurnMenu({ preventDefault() {}, stopPropagation() {}, pageX, pageY }, turnId);
        ssTouchTimer = null;
    }, 500);
}
function ssTouchEnd() {
    if (ssTouchTimer) { clearTimeout(ssTouchTimer); ssTouchTimer = null; }
}

async function ssMenuAct(act) {
    const turnId = ssMenuTurnId;
    const menu = document.getElementById('ssTurnContextMenu');
    if (menu) menu.style.display = 'none';
    const session = ssSession();
    const turn = session && session.turns.find(t => t.id === turnId);
    if (!turn) return;

    if (act === 'regen') return regenSsTurn(turnId);

    if (act === 'edit') {
        const next = await appPrompt('编辑这一楼的正文：', turn.text);   // 同上，不能用原生 prompt
        if (next == null) return;
        turn.text = next;
        if (turn.swipes && turn.swipes.length) turn.swipes[turn.currentSwipe || 0] = next;
        if (typeof gyTavernAfterChange === 'function') return gyTavernAfterChange(session, 'message_updated', session.turns.indexOf(turn));
        session.updatedAt = Date.now();
        saveAllData();
        return renderSsTurns();
    }
    if (act === 'hide') {
        turn.hidden = !turn.hidden;
        if (typeof gyTavernAfterChange === 'function') return gyTavernAfterChange(session, 'message_updated', session.turns.indexOf(turn));
        session.updatedAt = Date.now();
        saveAllData();
        return renderSsTurns();
    }
    if (act === 'copy') {
        try { await navigator.clipboard.writeText(turn.text); ssAlert('已复制'); }
        catch (e) { ssAlert('复制失败，浏览器不允许访问剪贴板'); }
        return;
    }
    if (act === 'del') {
        if (!(await ssConfirm('确定删除这一楼吗？删掉就找不回来了。'))) return;
        session.turns = session.turns.filter(t => t.id !== turnId);
        if (typeof gyTavernAfterChange === 'function') return gyTavernAfterChange(session, 'message_deleted');
        session.updatedAt = Date.now();
        saveAllData();
        renderSsTurns();
    }
}


// ---------------------------------------------------------------- 角色卡按钮栏

// 同类软件的「脚本按钮」：卡片调 replaceScriptButtons() 注册几个按钮，用户点一下，
// 卡片自己的脚本收到一个事件去处理。
//
// 语义按白露的界面改了一点：同类软件把这类按钮塞在脚本库的抽屉里，白露直接放在续写操作区上方——
// 卡片本来就在这个页面里，按钮离它近才用得顺手。行为不变：点击 = 把事件发回给注册它的那张卡。
//
// 注册信息存在会话上（跟着这段续写走），卡片重新渲染、iframe 重建都不会把按钮弄丢。
function renderSsCardButtons() {
    const bar = document.getElementById('ssCardButtons');
    if (!bar) return;
    const s = ssSession();
    const list = (s && Array.isArray(s.cardButtons)) ? s.cardButtons.filter(b => b && b.visible !== false) : [];
    if (list.length === 0) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = list.map((b, i) =>
        `<button type="button" class="btn-secondary" style="width:auto; padding:6px 14px; margin-top:0; font-size:13px;" onclick="clickSsCardButton(${i})">${ssEsc(b.name)}</button>`
    ).join('');
}

function clickSsCardButton(idx) {
    const s = ssSession();
    const b = s && s.cardButtons && s.cardButtons[idx];
    if (!b) return;
    // 事件名跟同类软件的 getButtonEvent() 算法一致，卡片那边 eventOn(getButtonEvent('名字')) 才对得上
    if (typeof gyTavernEmit === 'function') {
        gyTavernEmit((b.script_id || 'card') + '_' + b.name + '_button_clicked');
        gyTavernEmit('button_clicked', b.name);   // 再发一个通用的，兼容写法不一样的卡
    }
}

// ---------------------------------------------------------------- 图片

async function ssPickImage(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return ssAlert('请选择图片文件');
    try {
        ssPendingImage = await fileToBase64(file);
        const img = document.getElementById('ssImagePreview');
        const boxEl = document.getElementById('ssImagePreviewBox');
        if (img) img.src = ssPendingImage;
        if (boxEl) boxEl.style.display = 'inline-block';
    } catch (e) {
        ssAlert('图片读取失败：' + e.message);
    }
}
function ssRemoveImage() {
    ssPendingImage = null;
    const boxEl = document.getElementById('ssImagePreviewBox');
    if (boxEl) boxEl.style.display = 'none';
}

// ---------------------------------------------------------------- 章节

function saveSsChapter() {
    const session = ssSession();
    if (!session) return;
    const body = session.turns.filter(t => t.role !== 'user').map(t => (t.text || '').trim()).filter(Boolean).join('\n\n');
    if (!body) return ssAlert('还没有可以存档的剧情内容～');

    session.chapters.push({ id: 'c_' + Date.now(), index: session.chapters.length + 1, content: body, timestamp: Date.now() });
    session.turns = [];
    session.updatedAt = Date.now();
    saveAllData();
    renderSsTurns();
    renderSsChapters();

    if (typeof showToast === 'function') {
        showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">📚</div>`,
            '新章节已保存完毕！',
            `《${session.title || '未命名续写'}》第 ${session.chapters.length} 章已存档，剧情已清空，可以开始下一段。`, null, null);
    }
}

async function clearSsTurns() {
    const session = ssSession();
    if (!session || !session.turns.length) return;
    if (!(await ssConfirm('确定要清空当前的续写记录吗？还没存为章节的内容将会丢失。'))) return;
    session.turns = [];
    session.updatedAt = Date.now();
    saveAllData();
    renderSsTurns();
}

function renderSsChapters() {
    const box = document.getElementById('ssChapters');
    const session = ssSession();
    if (!box || !session) return;
    if (!session.chapters.length) {
        box.innerHTML = `<div class="ss-empty">还没有存档的章节。<br>在「续写」页点「存为新章节」，会把当前所有剧情收成一章并清空，方便开始下一段。</div>`;
        return;
    }
    box.innerHTML = session.chapters.map((c, i) => {
        const preview = String(c.content || '').slice(0, 150);
        return `
        <div class="ss-card" style="cursor:default;">
            <div class="ss-card-head">
                <span class="ss-card-title">第 ${i + 1} 章</span>
                <span class="ss-card-ops">
                    <span onclick="readSsChapter(${i})" title="阅读">📖</span>
                    <span onclick="deleteSsChapter(${i})" title="删除" style="color:#f91880;">🗑️</span>
                </span>
            </div>
            <div class="ss-card-meta">${String(c.content || '').length} 字 · ${new Date(c.timestamp || Date.now()).toLocaleString('zh-CN', { hour12: false })}</div>
            <div class="ss-card-preview">${ssEsc(preview)}${String(c.content || '').length > 150 ? '…' : ''}</div>
        </div>`;
    }).join('');
}

function readSsChapter(i) {
    const session = ssSession();
    if (!session || !session.chapters[i]) return;
    const modal = document.getElementById('ssReaderModal');
    const content = document.getElementById('ssReaderContent');
    const title = document.getElementById('ssReaderTitle');
    if (!modal || !content) return;
    if (title) title.innerText = `${session.title || '未命名续写'} · 第 ${i + 1} 章`;
    content.innerText = session.chapters[i].content;
    if (typeof openModal === 'function') openModal('ssReaderModal'); else modal.style.display = 'flex';
}

async function deleteSsChapter(i) {
    const session = ssSession();
    if (!session || !session.chapters[i]) return;
    if (!(await ssConfirm(`确定删除第 ${i + 1} 章吗？`))) return;
    session.chapters.splice(i, 1);
    session.updatedAt = Date.now();
    saveAllData();
    renderSsChapters();
}

function exportSsTxt() {
    const session = ssSession();
    if (!session) return;
    const parts = session.chapters.map((c, i) => `第 ${i + 1} 章\n\n${c.content}`);
    const live = session.turns.filter(t => t.role !== 'user').map(t => (t.text || '').trim()).filter(Boolean).join('\n\n');
    if (live) parts.push(`（未存档的最新剧情）\n\n${live}`);
    if (!parts.length) return ssAlert('没有可导出的内容');

    const text = `${session.title || '未命名续写'}\n\n` + parts.join('\n\n\n' + '─'.repeat(24) + '\n\n\n');
    try {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(session.title || '续写').replace(/[\\/:*?"<>|]/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) {
        ssAlert('导出失败：' + e.message);
    }
}

// ---------------------------------------------------------------- 诊断面板

function renderSsDiag() {
    const box = document.getElementById('ssDiag');
    const session = ssSession();
    if (!box || !session) return;
    const api = ssGetApi(session);
    const charObjs = ssCharObjects(session);
    const wbCount = (typeof worldbooks !== 'undefined' && worldbooks)
        ? worldbooks.filter(w => w.enabled !== false && (w.isGlobal || charObjs.some(c => c && c.worldbooks && c.worldbooks.includes(w.id)))).length : 0;
    const rxCount = (typeof regexScripts !== 'undefined' && regexScripts) ? regexScripts.filter(s => s.enabled !== false).length : 0;
    const hiddenCount = session.turns.filter(t => t.hidden).length;
    const rows = [
        ['当前 API', api.key ? `${api.isSub ? '副API' : '主API'} · ${api.model || '未填模型'}` : '⚠️ 没有可用的 Key，去设置里配一个'],
        ['候选世界书', `${wbCount} 本（全局 + 出场角色专属），按剧情内容关键词自动触发`],
        ['启用中的正则', `${rxCount} 条`],
        ['EJS 模板', (typeof ejs !== 'undefined' && ejs.render) ? '✅ 可用，人设/世界书里的 <% %> 会执行' : '⚠️ vendor/ejs.min.js 没加载成功'],
        ['变量作用域', ssScopeId(session) + '（宏、MVU 状态树、记忆库都用这个 key 分桶）'],
        ['隐藏楼层', hiddenCount ? `${hiddenCount} 层已隐藏，不会进 prompt` : '无'],
        ['发给 AI 的历史', `最近 ${session.maxHistory || 20} 层可见楼层`],
        ['注入脚本执行', (typeof enableChatScriptExecution !== 'undefined' && enableChatScriptExecution) ? '✅ 已开启（状态栏卡片的交互能用）' : '➖ 已关闭，状态栏里的 JS 交互不会跑'],
    ];
    box.innerHTML = rows.map(r => `<div style="margin-bottom:6px;"><b style="color:#536471;">${ssEsc(r[0])}：</b>${ssEsc(r[1])}</div>`).join('');
}

// ---------------------------------------------------------------- 旧数据迁移

// 旧版的互动续写寄生在小说对象上（novel.storyTurns）。这个入口独立出来之后，
// 把每本还留着 storyTurns 的小说自动搬成一个续写会话，搬完清掉小说上的 storyTurns，
// 只做一次（用 __ssMigrated 标记），不会重复搬。
function migrateLegacyStoryTurns() {
    if (typeof globalNovels === 'undefined' || !Array.isArray(globalNovels)) return;
    let migrated = 0;
    globalNovels.forEach(novel => {
        if (!novel || novel.__ssMigrated) return;
        if (!Array.isArray(novel.storyTurns) || novel.storyTurns.length === 0) {
            novel.__ssMigrated = true;
            return;
        }
        const session = {
            id: 'ss_migrated_' + novel.id,
            title: (novel.title || '未命名故事') + '（从小说迁移）',
            outline: novel.outline || '',
            extraChars: '',
            chars: (novel.chars || []).slice(),
            wordCount: novel.storyTurnWordCount || 300,
            secondPerson: novel.secondPerson !== false,
            maxHistory: 20,
            apiMode: 'sub',
            turns: novel.storyTurns.map(t => Object.assign({}, t)),
            chapters: [],
            createdAt: novel.createdAt || Date.now(),
            updatedAt: Date.now(),
        };
        if (!storySessions.some(s => s.id === session.id)) {
            storySessions.unshift(session);
            migrated++;
        }
        novel.storyTurns = [];
        novel.__ssMigrated = true;
    });
    if (migrated > 0) {
        saveAllData();
        if (typeof showToast === 'function') {
            showToast(`<div class="avatar" style="background:#1d9bf0;color:white;font-size:20px;">📦</div>`,
                '续写记录已迁移',
                `从小说里搬了 ${migrated} 段互动续写过来，现在它们是独立的续写会话了。`, null, null);
        }
    }
}

// 全局菜单点击后关闭右键菜单
document.addEventListener('click', function () {
    const menu = document.getElementById('ssTurnContextMenu');
    if (menu) menu.style.display = 'none';
});
