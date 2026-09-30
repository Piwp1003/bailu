// ===================== 助手脚本（TavernHelper）兼容层 · 主页面这一侧 =====================
//
// 角色卡里那些"完整前端页面"类的组件（开场白菜单、状态栏、手账本、操作栏），除了画界面，
// 还会回过头来调同类软件的接口。这一层负责把那些调用接到白露自己的功能上。
//
// ── 楼层模型：跟同类软件对齐 ─────────────────────────────────────────
//
// 同类软件里一段对话就是一个数组 chat[]，**下标就是楼层号（message_id）**，从 0 开始：
//
//     message_id 0 ← 开场白（它的 swipes 就是角色卡里那一串候选开场白）
//     message_id 1 ← 用户说的话
//     message_id 2 ← AI 的回复（它的 swipes 是重 roll 出来的几个版本）
//     ...
//
// 白露续写工作台的 session.turns[] 本来就是一模一样的结构，只是几个字段名不同：
//
//    同类软件             白露              说明
//     message_id   =   数组下标          现在楼层号也改成从 0 开始显示，跟同类软件一致
//     role         ←→  role             白露用 'ai'，同类软件用 'assistant'
//     message      ←→  text
//     swipe_id     ←→  currentSwipe
//     swipes       ←→  swipes
//     is_hidden    ←→  hidden
//     data         ←→  data             楼层变量，本来没有，这次补上
//
// 所以这里不是"另做一套"，而是把同一份数据按同类软件的字段名翻译进出。白露内部保持原来的
// 字段名不动（改名要动一大片代码，风险远大于收益），翻译只发生在这一层。

// ---------------------------------------------------------------- 楼层读写

// 取当前这段续写的楼层数组。续写工作台没打开时返回 null——
// 卡片可能出现在小说章节、推文这些地方，那里没有"楼层"这个概念。
function gyTavernTurns() {
    try {
        const s = (typeof ssSession === 'function') ? ssSession() : null;
        return (s && Array.isArray(s.turns)) ? s : null;
    } catch (e) { return null; }
}

function gyRoleToTavern(role) {
    if (role === 'user') return 'user';
    if (role === 'system') return 'system';
    return 'assistant';           // 白露的 'ai'
}
function gyRoleFromTavern(role) {
    if (role === 'user') return 'user';
    if (role === 'system') return 'system';
    return 'ai';
}

// 楼层变量＝MVU 快照（AI 写的状态树）叠上 turn.data（卡片写的）。
// 读的时候合并，写的时候只写 turn.data，见 getVariables 那里的说明。
function gyMergedTurnVars(t) {
    const merged = {};
    try { if (t.mvuSnapshot && typeof t.mvuSnapshot === 'object') Object.assign(merged, JSON.parse(JSON.stringify(t.mvuSnapshot))); } catch (e) { /* ignore */ }
    try { if (t.data && typeof t.data === 'object') gyDeepAssign(merged, JSON.parse(JSON.stringify(t.data))); } catch (e) { /* ignore */ }
    return merged;
}

// 一条白露楼层 → 一条同类软件消息
function gyTurnToMessage(t, idx, includeSwipes) {
    const swipes = (Array.isArray(t.swipes) && t.swipes.length) ? t.swipes.slice() : [t.text || ''];
    const swipeId = Math.min(t.currentSwipe || 0, swipes.length - 1);
    const base = {
        message_id: idx,
        name: gyTurnName(t),
        role: gyRoleToTavern(t.role),
        is_hidden: !!t.hidden,
        data: gyMergedTurnVars(t),
        extra: {},
    };
    if (!includeSwipes) {
        base.message = t.text || '';
        return base;
    }
    base.swipe_id = swipeId;
    base.swipes = swipes;
    base.swipes_data = swipes.map(() => ({}));
    base.swipes_info = swipes.map(() => ({}));
    return base;
}

function gyTurnName(t) {
    if (t.role === 'user') {
        try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) return currentUser.name; } catch (e) { /* ignore */ }
        return '你';
    }
    try {
        const c = myCharacters.find(x => String(x.id) === String(t.charId));
        if (c) return c.name || '';
    } catch (e) { /* ignore */ }
    return '';
}

// 同类软件的 range 写法：0 / '0' / '0-3' / -1（负数＝从后往前数）/ '{{lastMessageId}}'
function gyParseRange(range, len) {
    const last = len - 1;
    if (range === undefined || range === null || range === '') return [0, last];
    let r = String(range).replace(/\{\{lastMessageId\}\}/gi, String(last)).trim();
    const norm = (n) => {
        n = parseInt(n, 10);
        if (isNaN(n)) return null;
        return n < 0 ? len + n : n;      // -1 ＝ 最后一楼
    };
    // '2-5' 这种区间。单个负数 '-1' 不会被误认成区间——这条正则要求有**两个**数字，
    // 而 '-1' 里 -?\d+ 会把整个 '-1' 吃掉，后面没东西了，匹配不上。
    const m = r.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
    if (m) {
        const a = norm(m[1]), b = norm(m[2]);
        if (a !== null && b !== null) return [Math.min(a, b), Math.max(a, b)];
    }
    if (/^-?\d+$/.test(r)) {
        const n = norm(r);
        return n === null ? [0, last] : [n, n];
    }
    return [0, last];
}

// ---------------------------------------------------------------- 快照

// 卡片里的 getChatMessages 是**同步调用**的（`const m = getChatMessages("0", ...)`，没有 await），
// 来不及等 iframe 问完主页面再回答，所以建 iframe 的时候就要把楼层数据一起塞进去。
//
// 楼层多了以后这份快照会很大（每层正文都在里面），所以做了截断：开场白那一楼永远带上
// （卡片最常用），其余只带最近 40 楼，并且总字数封顶。卡片要的是"当前状态"，
// 不是完整历史，这个取舍不会影响它们的功能。
const GY_SNAPSHOT_MAX_FLOORS = 40;
const GY_SNAPSHOT_MAX_CHARS = 200000;

function gyTavernContextFor(charId) {
    const ctx = {
        charId: (charId === null || charId === undefined || charId === '') ? null : String(charId),
        charName: '',
        userName: '',
        messages: [],
        lastMessageId: -1,
        currentMessageId: -1,
        hasChat: false,
        chatVariables: {},
        globalVariables: {},
        // 下面这些是卡片会**同步**读的（同类软件那边这些接口也是同步的），
        // 所以必须在建 iframe 时就一起塞进来，不能等 postMessage 往返
        characters: [],
        worldbookNames: [],
        presetNames: [],
        activePresetName: '',
        charAvatar: '',
        userAvatar: '',
        chatId: '',
        chatName: '',
        personas: [],
        currentPersonaId: null,
        version: { app: '白露', tavern: '1.18.0-compatible', helper: 'guyu-bridge' },
    };
    try {
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ctx.userName = currentUser.name;
    } catch (e) { /* ignore */ }

    let char = null;
    try {
        if (ctx.charId !== null && typeof myCharacters !== 'undefined' && Array.isArray(myCharacters)) {
            char = myCharacters.find(c => String(c.id) === ctx.charId) || null;
        }
    } catch (e) { /* ignore */ }
    if (char) ctx.charName = char.name || '';

    const session = gyTavernTurns();
    if (!session) {
        // 不在续写工作台里（小说章节、推文、日记那些地方）。这时候还是要让开场白菜单能用，
        // 所以退一步：只把这个角色的开场白当成"第 0 楼的 swipes"给出去。
        if (char) {
            let greetings = [];
            try { if (typeof getGreetingOptions === 'function') greetings = getGreetingOptions(char) || []; } catch (e) { /* ignore */ }
            if (greetings.length) {
                ctx.messages = [{
                    message_id: 0, name: char.name || '', role: 'assistant', is_hidden: false,
                    swipe_id: 0, message: greetings[0], swipes: greetings.slice(),
                    swipes_data: greetings.map(() => ({})), swipes_info: greetings.map(() => ({})), data: {}, extra: {},
                }];
                ctx.lastMessageId = 0;
                ctx.currentMessageId = 0;
            }
        }
        gyFillStaticSnapshot(ctx, char, null);
        return ctx;
    }

    ctx.hasChat = true;
    const turns = session.turns;
    ctx.lastMessageId = turns.length - 1;
    ctx.currentMessageId = turns.length - 1;

    // 开场白那一楼的 swipes 用角色卡的候选开场白填上——同类软件里第 0 楼的 swipes 就是这个，
    // 卡片的开场白菜单全靠它列出可选项
    const openingIdx = turns.findIndex(t => t.fromGreeting);
    let greetings = [];
    if (char) {
        try { if (typeof getGreetingOptions === 'function') greetings = getGreetingOptions(char) || []; } catch (e) { /* ignore */ }
    }

    const picked = [];
    for (let i = turns.length - 1; i >= 0; i--) {
        if (picked.length >= GY_SNAPSHOT_MAX_FLOORS && i !== 0 && i !== openingIdx) continue;
        picked.push(i);
    }
    picked.sort((a, b) => a - b);

    let budget = GY_SNAPSHOT_MAX_CHARS;
    ctx.messages = picked.map(i => {
        const msg = gyTurnToMessage(turns[i], i, true);
        if (i === openingIdx && greetings.length) {
            msg.swipes = greetings.slice();
            msg.swipes_data = greetings.map(() => ({}));
            msg.swipes_info = greetings.map(() => ({}));
            const gi = turns[i].greetingIndex;
            msg.swipe_id = (typeof gi === 'number' && gi >= 0 && gi < greetings.length) ? gi : 0;
        }
        // 字数封顶：超了就把正文截断，但结构保持完整，卡片不会因为拿到 undefined 而崩
        msg.swipes = msg.swipes.map(s => {
            const str = String(s || '');
            if (budget <= 0) return '';
            if (str.length > budget) { const cut = str.slice(0, budget); budget = 0; return cut; }
            budget -= str.length;
            return str;
        });
        msg.message = msg.swipes[msg.swipe_id] || '';
        return msg;
    });

    try { ctx.chatVariables = gyTavernVarStore('chat') || {}; } catch (e) { /* ignore */ }
    try { ctx.globalVariables = gyTavernVarStore('global') || {}; } catch (e) { /* ignore */ }
    gyFillStaticSnapshot(ctx, char, session);
    return ctx;
}

// 卡片同步读的那批信息。头像是 base64，可能很大，超过阈值就不塞——
// 卡片顶多少张头像，不会因此崩掉，但每个 iframe 背几百 KB 就太亏了。
const GY_SNAPSHOT_MAX_AVATAR = 300000;
function gyFillStaticSnapshot(ctx, char, session) {
    try { ctx.characters = (myCharacters || []).map(c => ({ id: String(c.id), name: c.name || '' })); } catch (e) { /* ignore */ }
    try { ctx.worldbookNames = (worldbooks || []).map(w => w.title); } catch (e) { /* ignore */ }
    try {
        ctx.presetNames = (aiPresets || []).map(p => p.name || '未命名预设');
        const active = (typeof getActivePresetObj === 'function') ? getActivePresetObj() : null;
        ctx.activePresetName = active ? (active.name || '') : '';
    } catch (e) { /* ignore */ }
    try {
        const a = char && char.avatarImg;
        if (typeof a === 'string' && a && a.length <= GY_SNAPSHOT_MAX_AVATAR) ctx.charAvatar = a;
    } catch (e) { /* ignore */ }
    try {
        const a = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.avatarImg : null;
        if (typeof a === 'string' && a && a.length <= GY_SNAPSHOT_MAX_AVATAR) ctx.userAvatar = a;
    } catch (e) { /* ignore */ }
    if (session) { ctx.chatId = session.id || ''; ctx.chatName = session.title || ''; }
    // 用户人设：卡片同步读 getPersonaIds/getPersonaNames，所以要随快照带过去。
    // 头像是 base64，几份人设加起来可能不小，共用一份预算，超了就不带头像（只影响显示，不影响功能）。
    try {
        let avatarBudget = GY_SNAPSHOT_MAX_AVATAR;
        ctx.personas = gyPersonaList().map(p => {
            const t = gyPersonaToTavern(p);
            if (t.avatar && t.avatar.length <= avatarBudget) avatarBudget -= t.avatar.length;
            else t.avatar = '';
            return t;
        });
        const cur = gyCurrentPersona();
        ctx.currentPersonaId = cur ? cur.id : null;
    } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- 变量

// 同类软件有 5 种变量作用域，白露只有 2 种能一一对上，详见「助手脚本兼容层说明.md」。
// 对不上的那几种（preset / character / extension）单独存一份，只在本次会话里有效，
// 保证卡片读写不报错，但不会假装它跟白露的某个真实数据是同一份。
let gyTavernScratchVars = { preset: {}, character: {}, extension: {}, script: {} };

function gyTavernVarStore(type) {
    if (type === 'chat') {
        // 白露的聊天变量是按"作用域key"分桶的，续写这边的桶就是 ssScopeId(session)
        const s = gyTavernTurns();
        const scope = (s && typeof ssScopeId === 'function') ? ssScopeId(s) : '__default__';
        if (typeof getVarScopeStore === 'function') return getVarScopeStore(scope);
        return {};
    }
    if (type === 'global') {
        return (typeof globalVariables !== 'undefined') ? globalVariables : {};
    }
    if (!gyTavernScratchVars[type]) gyTavernScratchVars[type] = {};
    return gyTavernScratchVars[type];
}

// 楼层变量：同类软件的 getVariables({type:'message', message_id}) 读的是挂在那一楼上的对象。
// 白露这边就存在 turn.data 里。
function gyTavernMessageVarTurn(messageId) {
    const s = gyTavernTurns();
    if (!s) return null;
    let idx = messageId;
    if (idx === 'latest' || idx === undefined || idx === null) idx = s.turns.length - 1;
    idx = Number(idx);
    if (idx < 0) idx = s.turns.length + idx;
    const t = s.turns[idx];
    if (!t) return null;
    if (!t.data) t.data = {};
    return t;
}

// ---------------------------------------------------------------- 事件

// 卡片可以 eventOn(...) 监听事件。白露这边在真正发生对应动作时调 gyTavernEmit 广播出去，
// 由 js/03 转发给所有卡片 iframe。哪些事件白露真的会发，见说明文档。
const gyTavernListeners = new Set();   // 只记录"有哪些 iframe 在听"，具体分发在 js/03

function gyTavernEmit(eventType, payload) {
    try {
        const frames = document.querySelectorAll('iframe.gy-frontend-frame');
        frames.forEach(f => {
            try { f.contentWindow.postMessage({ __gyTavernEvent: { type: eventType, args: payload === undefined ? [] : [payload] } }, '*'); }
            catch (e) { /* iframe 可能正在被替换 */ }
        });
    } catch (e) { /* ignore */ }
}
window.gyTavernEmit = gyTavernEmit;

// 楼层发生任何变化之后，把新的快照推给所有卡片，让它们手里的数据别过期
function gyTavernPushSnapshot() {
    try {
        const frames = document.querySelectorAll('iframe.gy-frontend-frame');
        frames.forEach(f => {
            const src = f.__gyFrontendSrc || {};
            try { f.contentWindow.postMessage({ __gyTavernSnapshot: gyTavernContextFor(src.charId) }, '*'); }
            catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
}
window.gyTavernPushSnapshot = gyTavernPushSnapshot;

// 白露这边动完数据统一调这个：存档 + 重画 + 广播事件 + 刷新卡片手里的快照
function gyTavernAfterChange(session, eventType, payload) {
    if (session) session.updatedAt = Date.now();
    try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
    try { if (typeof renderSsTurns === 'function') renderSsTurns(); } catch (e) { /* ignore */ }
    if (eventType) gyTavernEmit(eventType, payload);
    // 重画之后 iframe 是新建的，等它建好再推快照
    setTimeout(gyTavernPushSnapshot, 60);
}
window.gyTavernAfterChange = gyTavernAfterChange;


// ---------------------------------------------------------------- 供上面用的小工具

// 正在跑的生成请求，stopAllGeneration 时一起中断
const gyTavernActiveAborts = new Set();

function gyFindChar(idOrName) {
    if (idOrName === null || idOrName === undefined || idOrName === '') return null;
    try {
        return (myCharacters || []).find(c => String(c.id) === String(idOrName))
            || (myCharacters || []).find(c => c.name === idOrName)
            || null;
    } catch (e) { return null; }
}

// 白露的世界书条目 → 同类软件的 worldbook entry 形状
// 白露的世界书条目 → 同类软件的 worldbook entry。
//
// 📌 之前我判断错过一次，这里说清楚：**两边的条目字段几乎是 1:1 的**——
// 关键词、次要关键词、逻辑、顺序、概率、递归、粘性、冷却、延迟、位置、深度、身份、正文，
// 白露全都有，一个不缺。真正的差别只有一处：
//
//   · 同类软件是两层：**一本"书"里装很多条目**
//   · 白露是一层：一个扁平列表，每条有个 category（分类标签）
//
// 而 category 本来就在干"书名"这件事。所以不需要迁移任何数据、不需要动你的存档结构，
// 只要把 **category 当成书名** 来读写，白露在卡片眼里就是标准的同类软件两层世界书。
// 没填分类的条目归到「未分类」这本里。
const GY_WB_DEFAULT_BOOK = '未分类';

function gyWbBookOf(w) { return (w && w.category) ? w.category : GY_WB_DEFAULT_BOOK; }

const GY_WB_POS_TO_TAVERN = {
    before_persona: 'before_character_definition',
    after_persona: 'after_character_definition',
    before_example: 'before_example_messages',
    after_example: 'after_example_messages',
    before_an: 'before_author_note',
    after_an: 'after_author_note',
    at_depth: 'at_depth',
    end: 'after_author_note',
};

function gyWbToTavern(w) {
    const keys = String(w.keywords || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
    const keys2 = String(w.secondaryKeywords || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
    return {
        uid: w.id,
        name: w.title,
        comment: w.title,
        content: w.content || '',
        keys,
        secondary_keys: keys2,
        selective: keys2.length > 0,
        selective_logic: w.secondaryLogic || 'and_any',
        enabled: w.disabled !== true,
        constant: !!w.isGlobal,
        probability: typeof w.probability === 'number' ? w.probability : 100,
        position: GY_WB_POS_TO_TAVERN[w.position] || 'after_character_definition',
        depth: typeof w.depth === 'number' ? w.depth : 0,
        role: w.depthRole || 'system',
        order: typeof w.priority === 'number' ? w.priority : 100,
        recursion: { prevent_incoming: !w.recursive, prevent_outgoing: !w.recursive },
        sticky: typeof w.stickyTurns === 'number' ? w.stickyTurns : 0,
        cooldown: typeof w.cooldownTurns === 'number' ? w.cooldownTurns : 0,
        delay: typeof w.delayTurns === 'number' ? w.delayTurns : 0,
        group: w.group || '',
        book: gyWbBookOf(w),
    };
}

// 把卡片临时注入的提示词拼进这次请求。
// in_chat 按深度插进历史里（复用 js/15 已有的 insertTextAtDepth，跟预设的深度注入同一套规则）；
// before_prompt / after_prompt 交给回调加进系统提示词。
function gyApplyInjects(history, injects, addToSystem) {
    const session = gyTavernTurns();
    const all = [];
    if (session && Array.isArray(session.cardInjects)) all.push(...session.cardInjects);
    if (Array.isArray(injects)) all.push(...injects.filter(x => x && typeof x.content === 'string'));
    if (all.length === 0) return history;

    let out = history.slice();
    all.forEach(inj => {
        const pos = inj.position || 'in_chat';
        if (pos === 'none') return;
        if (pos === 'before_prompt' || pos === 'after_prompt') {
            if (typeof addToSystem === 'function') addToSystem(inj.content);
            return;
        }
        if (typeof insertTextAtDepth === 'function') {
            // ⚠️ insertTextAtDepth 是**原地 splice**、返回 undefined 的，
            // 写成 out = insertTextAtDepth(...) 会把整条历史变成 undefined。
            insertTextAtDepth(out, typeof inj.depth === 'number' ? inj.depth : 0, inj.content, inj.role || 'system');
        } else {
            out.push({ role: inj.role === 'user' ? 'user' : 'assistant', content: inj.content });
        }
    });
    return out;
}


// 从网址下载一个插件。支持三种写法：
//   1. 直接给 .json —— 白露插件导出文件，原样用
//   2. 直接给 .js   —— 当成 script 类插件的代码
//   3. 给 GitHub 仓库地址 —— 转成 raw 地址，按常见文件名挨个试
//
// 用 smartFetch（白露自己那个 fetch 封装，桌面版走 Electron 侧、能绕开浏览器的跨域限制）。
async function gyFetchRemotePlugin(url) {
    const fetcher = (typeof smartFetch === 'function') ? smartFetch : fetch;
    const candidates = gyRemotePluginCandidates(url);
    let lastErr = null;
    for (const u of candidates) {
        try {
            const res = await fetcher(u, { method: 'GET' });
            if (!res.ok) { lastErr = new Error('HTTP ' + res.status + '：' + u); continue; }
            const text = await res.text();
            if (!text || !text.trim()) { lastErr = new Error('下下来是空的：' + u); continue; }
            // JSON？那就是白露插件导出文件
            const trimmed = text.trim();
            if (trimmed[0] === '[' || trimmed[0] === '{') {
                try { return JSON.parse(trimmed); } catch (e) { /* 不是 JSON，往下当代码处理 */ }
            }
            // 当成 script 类插件的代码。名字从 URL 末段取。
            const name = decodeURIComponent(String(u).split('/').filter(Boolean).pop() || '远程扩展').replace(/\.[a-z]+$/i, '');
            return [{ name, type: 'script', description: '从 ' + url + ' 下载', code: text, onLoad: '', scope: 'global' }];
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('没找到可用的插件文件');
}

// GitHub 仓库地址 → 可能的 raw 文件地址。直链就原样返回。
function gyRemotePluginCandidates(url) {
    const u = String(url).trim().replace(/\.git$/, '').replace(/\/+$/, '');
    if (/\.(json|js)(\?|$)/i.test(u)) return [u];
    const gh = u.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/i);
    if (!gh) return [u];
    const [, owner, repo] = gh;
    const files = ['白露插件.json', 'guyu-plugin.json', 'plugin.json', 'plugins.json', 'index.js', 'script.js'];
    const out = [];
    // main / master 两个分支都试一遍，很多老仓库还在 master
    ['main', 'master'].forEach(branch => {
        files.forEach(f => out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURIComponent(f)}`));
    });
    return out;
}



// ---------------------------------------------------------------- 用户人设

function gyPersonaList() {
    try { return Array.isArray(userPersonas) ? userPersonas : []; } catch (e) { return []; }
}

function gyFindPersona(idOrName) {
    const list = gyPersonaList();
    if (idOrName === 'current' || idOrName === undefined || idOrName === null) return gyCurrentPersona();
    return list.find(p => p.id === idOrName) || list.find(p => p.label === idOrName)
        || list.find(p => p.data && p.data.name === idOrName) || null;
}

// 白露没有单独记"当前是哪个人设"——切换时是把快照整体覆盖进 currentUser 的。
// 所以反过来推：先看人设下拉框选的是谁，没有就按名字+账号去比对。
function gyCurrentPersona() {
    const list = gyPersonaList();
    if (list.length === 0) return null;
    try {
        const sel = document.getElementById('personaSwitchSelect');
        if (sel && sel.value) {
            const hit = list.find(p => p.id === sel.value);
            if (hit) return hit;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof currentUser !== 'undefined' && currentUser) {
            return list.find(p => p.data && p.data.name === currentUser.name
                && (!p.data.handle || p.data.handle === currentUser.handle)) || null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// 白露的人设快照 → 同类软件的 Persona 形状
function gyPersonaToTavern(p) {
    const d = (p && p.data) || {};
    const cur = gyCurrentPersona();
    return {
        avatar_id: p.id,                 // 同类软件用头像文件名当 id，这里用白露自己的 id，对卡片都是个字符串
        avatar: d.avatarImg || '',
        name: d.name || '',
        title: p.label || '',            // 白露给人设起的名字（"本体""马甲小号"）
        description: d.persona || d.bio || '',
        position: 0, depth: 0, role: 0,
        lorebook: '',
        connections: [],
        is_default: !!(cur && cur.id === p.id),
    };
}

// ---------------------------------------------------------------- 音频

let gyAudioEl = null;
let gyAudioList = [];

function gyEnsureAudioEl() {
    if (gyAudioEl && document.body.contains(gyAudioEl)) return gyAudioEl;
    const el = document.createElement('audio');
    el.id = 'gyCardAudio';
    el.style.display = 'none';
    el.preload = 'none';
    el.addEventListener('play', gyRenderAudioBar);
    el.addEventListener('pause', gyRenderAudioBar);
    el.addEventListener('ended', gyRenderAudioBar);
    el.addEventListener('error', () => {
        console.warn('[音频] 加载失败：', el.dataset.src);
        gyTavernNotify('角色卡的音频加载失败了，可能是链接失效或者没网。');
        gyRenderAudioBar();
    });
    document.body.appendChild(el);
    gyAudioEl = el;
    return el;
}

// 右下角的小控制条。卡片自己放的音乐必须有个地方能关掉，
// 否则一张卡放起 BGM 来你只能刷新整个页面。
function gyRenderAudioBar() {
    const el = gyAudioEl;
    let bar = document.getElementById('gyAudioBar');
    const active = el && el.dataset.src && (!el.paused || el.currentTime > 0);
    if (!active) { if (bar) bar.remove(); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'gyAudioBar';
        bar.className = 'gy-audio-bar';
        document.body.appendChild(bar);
    }
    const name = decodeURIComponent(String(el.dataset.src).split('/').pop() || '音频').slice(0, 22);
    bar.innerHTML =
        `<span class="gy-audio-icon">${el.paused ? '⏸️' : '🎵'}</span>` +
        `<span class="gy-audio-name" title="${(el.dataset.src || '').replace(/"/g, '&quot;')}">${(typeof escapeHtml === 'function' ? escapeHtml(name) : name)}</span>` +
        `<button type="button" onclick="gyAudioToggle()">${el.paused ? '播放' : '暂停'}</button>` +
        `<input type="range" min="0" max="100" value="${Math.round(el.volume * 100)}" oninput="gyAudioVolume(this.value)">` +
        `<button type="button" onclick="gyAudioStop()">✕</button>`;
}

function gyAudioToggle() {
    const el = gyAudioEl; if (!el) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
    gyRenderAudioBar();
}
function gyAudioVolume(v) {
    const el = gyAudioEl; if (!el) return;
    el.volume = Math.max(0, Math.min(1, Number(v) / 100));
}
function gyAudioStop() {
    const el = gyAudioEl; if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch (e) { /* ignore */ }
    el.dataset.src = '';
    el.removeAttribute('src');
    gyRenderAudioBar();
}
window.gyAudioToggle = gyAudioToggle;
window.gyAudioVolume = gyAudioVolume;
window.gyAudioStop = gyAudioStop;

// ---------------------------------------------------------------- 动作分发

// iframe 里调了会改变状态的接口时，postMessage 到这里执行。
const gyTavernBridge = {

    // ==== 楼层 ====

    getChatMessages(range, options, ctx) {
        const opt = options || {};
        const session = gyTavernTurns();
        if (!session) return { ok: true, value: gyTavernContextFor(ctx && ctx.charId).messages };
        const turns = session.turns;
        const [a, b] = gyParseRange(range, turns.length);
        const out = [];
        for (let i = Math.max(0, a); i <= Math.min(turns.length - 1, b); i++) {
            const t = turns[i];
            if (opt.role && opt.role !== 'all' && gyRoleToTavern(t.role) !== opt.role) continue;
            if (opt.hide_state === 'hidden' && !t.hidden) continue;
            if (opt.hide_state === 'unhidden' && t.hidden) continue;
            out.push(gyTurnToMessage(t, i, !!opt.include_swipes));
        }
        return { ok: true, value: out };
    },

    getLastMessageId() {
        const session = gyTavernTurns();
        return { ok: true, value: session ? session.turns.length - 1 : -1 };
    },

    // 同类软件最常被卡片用到的写接口。支持改正文、切 swipe、换整组 swipes、隐藏/显示、写楼层变量。
    setChatMessages(list, options, ctx) {
        if (!Array.isArray(list) || list.length === 0) return { ok: false, reason: '参数为空' };
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里，没有楼层可以改' };
        const turns = session.turns;

        let changed = 0, swiped = false, needConfirmDone = false;
        for (const item of list) {
            if (!item || typeof item !== 'object') continue;
            let idx = Number(item.message_id);
            if (isNaN(idx)) continue;
            if (idx < 0) idx = turns.length + idx;
            const t = turns[idx];
            if (!t) {
                // 🐛 一个必须单独处理的情况：**这段续写还一楼都没有**，
                // 而卡片正在调 setChatMessages([{message_id:0, swipe_id:N}])。
                // 这恰恰是最常见的场景——你点开「用角色开场白开个头」，
                // 作者做的那页美化开场白就摆在眼前，点一个场景就是要用它开局。
                // 按"第 0 楼不存在所以跳过"处理的话，点了没反应，整个美化开场白等于废了。
                // 这里按语义走：第 0 楼 ＝ 开场白，没有就创建。
                if (idx === 0 && typeof item.swipe_id === 'number' && typeof ssSwitchOpening === 'function') {
                    const r = ssSwitchOpening(ctx && ctx.charId, item.swipe_id, { silent: true });
                    if (r && r.ok === false) return { ok: false, reason: r.reason };
                    changed++;
                    swiped = true;
                    continue;
                }
                console.warn('[同类软件兼容层] 卡片要改第 ' + idx + ' 楼，但这段续写只有 ' + turns.length + ' 楼，已跳过。');
                continue;
            }

            // 换整组 swipes（同类软件用来"设置开局"）
            if (Array.isArray(item.swipes)) {
                t.swipes = item.swipes.slice();
                t.currentSwipe = Math.min(t.currentSwipe || 0, t.swipes.length - 1);
                t.text = t.swipes[t.currentSwipe] || '';
                changed++;
            }

            // 切 swipe。开场白那一楼要走"换开场白"那条路（要跑宏、正则、MVU 整条后处理链），
            // 其它楼层就是在已经生成好的几个版本之间切，直接换文本即可。
            if (typeof item.swipe_id === 'number') {
                if (t.fromGreeting && typeof ssSwitchOpening === 'function') {
                    const r = ssSwitchOpening(ctx && ctx.charId, item.swipe_id, { silent: true });
                    if (r && r.ok === false) return { ok: false, reason: r.reason };
                    if (r && r.cancelled) { needConfirmDone = true; continue; }
                } else {
                    const sw = t.swipes || [t.text || ''];
                    if (item.swipe_id < 0 || item.swipe_id >= sw.length) {
                        console.warn('[同类软件兼容层] 第 ' + idx + ' 楼只有 ' + sw.length + ' 个版本，卡片要第 ' + (item.swipe_id + 1) + ' 个，已跳过。');
                    } else {
                        t.swipes = sw;
                        t.currentSwipe = item.swipe_id;
                        t.text = sw[item.swipe_id];
                        changed++;
                    }
                }
                swiped = true;
            }

            if (typeof item.message === 'string') {
                t.text = item.message;
                if (Array.isArray(t.swipes) && t.swipes.length) t.swipes[t.currentSwipe || 0] = item.message;
                changed++;
            }
            if (typeof item.is_hidden === 'boolean') { t.hidden = item.is_hidden; changed++; }
            if (item.data && typeof item.data === 'object') { t.data = JSON.parse(JSON.stringify(item.data)); changed++; }
        }

        if (changed > 0) {
            gyTavernAfterChange(session, swiped ? 'message_swiped' : 'message_updated', undefined);
        } else if (needConfirmDone) {
            // 用户在"要不要换开场"那一步点了取消，什么都没做，也不用报错
            return { ok: true, value: 0 };
        } else {
            // 只带了 message_id 的调用＝"重新渲染这一楼"，同类软件那边就是这个语义
            gyTavernAfterChange(session, null, undefined);
        }
        return { ok: true, value: changed };
    },

    createChatMessages(list, options) {
        if (!Array.isArray(list) || list.length === 0) return { ok: false, reason: '参数为空' };
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里' };
        const opt = options || {};
        let at = opt.insert_before;
        if (at === undefined) at = opt.insert_at;
        const turns = session.turns;
        const pos = (at === 'end' || at === undefined || at === null) ? turns.length : Math.max(0, Math.min(turns.length, Number(at)));

        const made = list.filter(m => m && typeof m.message === 'string').map((m, i) => ({
            id: 't_' + Date.now() + '_c' + i,
            role: gyRoleFromTavern(m.role),
            text: m.message,
            timestamp: Date.now(),
            charId: (m.role === 'user') ? undefined : (typeof ssTurnCharId === 'function' ? ssTurnCharId(session) : undefined),
            hidden: !!m.is_hidden,
            data: m.data ? JSON.parse(JSON.stringify(m.data)) : undefined,
            fromCard: true,
        }));
        if (made.length === 0) return { ok: false, reason: '没有合法的消息' };
        turns.splice(pos, 0, ...made);
        gyTavernAfterChange(session, 'message_received', pos);
        return { ok: true, value: made.length };
    },

    deleteChatMessages(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return { ok: false, reason: '参数为空' };
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里' };
        const turns = session.turns;
        const norm = ids.map(n => { let i = Number(n); if (i < 0) i = turns.length + i; return i; })
                        .filter(i => i >= 0 && i < turns.length);
        if (norm.length === 0) return { ok: true, value: 0 };
        // 卡片能删楼层这件事风险不小，问一句再删
        if (!confirm(`角色卡的组件要删掉 ${norm.length} 楼内容，确定吗？删掉找不回来。`)) return { ok: true, value: 0 };
        const kill = new Set(norm);
        session.turns = turns.filter((_t, i) => !kill.has(i));
        gyTavernAfterChange(session, 'message_deleted', undefined);
        return { ok: true, value: norm.length };
    },

    // ==== 变量 ====

    // 楼层变量走「读合并、写分开」：
    //   读 → MVU 快照（AI 通过 <JSONPatch> 更新的状态树，那一楼当时的值）
    //        叠上 turn.data（卡片自己写的），卡片能直接读到疲劳度/好感度这些真实数值；
    //   写 → 只写 turn.data，绝不碰 MVU 树。
    // 这样状态栏卡片能自动工作，又不会让卡片把 AI 的状态树改坏。
    getVariables(option) {
        const opt = option || { type: 'chat' };
        if (opt.type === 'message') {
            const t = gyTavernMessageVarTurn(opt.message_id);
            if (!t) return { ok: true, value: {} };
            const merged = {};
            if (t.mvuSnapshot && typeof t.mvuSnapshot === 'object') {
                try { Object.assign(merged, JSON.parse(JSON.stringify(t.mvuSnapshot))); } catch (e) { /* ignore */ }
            }
            if (t.data && typeof t.data === 'object') {
                try { gyDeepAssign(merged, JSON.parse(JSON.stringify(t.data))); } catch (e) { /* ignore */ }
            }
            return { ok: true, value: merged };
        }
        const store = gyTavernVarStore(opt.type || 'chat');
        return { ok: true, value: JSON.parse(JSON.stringify(store || {})) };
    },

    replaceVariables(vars, option) {
        const opt = option || { type: 'chat' };
        if (!vars || typeof vars !== 'object') return { ok: false, reason: '变量表必须是对象' };
        if (opt.type === 'message') {
            const t = gyTavernMessageVarTurn(opt.message_id);
            if (!t) return { ok: false, reason: '找不到那一楼' };
            t.data = JSON.parse(JSON.stringify(vars));
            gyTavernAfterChange(gyTavernTurns(), null);
            return { ok: true };
        }
        const store = gyTavernVarStore(opt.type || 'chat');
        Object.keys(store).forEach(k => delete store[k]);
        Object.assign(store, JSON.parse(JSON.stringify(vars)));
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        return { ok: true };
    },

    insertOrAssignVariables(vars, option) {
        const opt = option || { type: 'chat' };
        if (!vars || typeof vars !== 'object') return { ok: false, reason: '变量表必须是对象' };
        if (opt.type === 'message') {
            const t = gyTavernMessageVarTurn(opt.message_id);
            if (!t) return { ok: false, reason: '找不到那一楼' };
            gyDeepAssign(t.data, vars);
            gyTavernAfterChange(gyTavernTurns(), null);
            return { ok: true };
        }
        gyDeepAssign(gyTavernVarStore(opt.type || 'chat'), vars);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        return { ok: true };
    },

    deleteVariable(path, option) {
        const opt = option || { type: 'chat' };
        const store = (opt.type === 'message')
            ? (gyTavernMessageVarTurn(opt.message_id) || {}).data
            : gyTavernVarStore(opt.type || 'chat');
        if (!store) return { ok: true, value: false };
        const parts = String(path || '').split('.').filter(Boolean);
        if (parts.length === 0) return { ok: true, value: false };
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur || typeof cur !== 'object') return { ok: true, value: false };
            cur = cur[parts[i]];
        }
        if (!cur || typeof cur !== 'object') return { ok: true, value: false };
        const had = Object.prototype.hasOwnProperty.call(cur, parts[parts.length - 1]);
        delete cur[parts[parts.length - 1]];
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        return { ok: true, value: had };
    },


    // ==== 生成 ====
    //
    // 同类软件的 generate() 是卡片"让 AI 写一段"的入口（比如沉沦法则那张卡的 uu 生成器）。
    // 白露这边完全有对应能力，用的就是续写自己那条链路：
    //   buildSsSystemPrompt（大纲/人设/世界书/预设/宏都在里面）→ buildSsHistory → 主/副 API。
    // 所以卡片生成出来的内容，跟你自己点「续写」得到的是同一套设定，不是另起炉灶。
    //
    // 跟同类软件的差别：generate() **不会**自己往楼层里加内容（同类软件也不会），
    // 结果原样返回给卡片，加不加、加到哪由卡片决定。
    async generate(config) {
        const cfg = config || {};
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里，没有上下文可以生成' };
        if (typeof buildSsSystemPrompt !== 'function' || typeof streamCompletionText !== 'function') {
            return { ok: false, reason: '生成功能不可用' };
        }
        const api = (typeof ssGetApi === 'function') ? ssGetApi(session) : null;
        if (!api || !api.key || !api.url) return { ok: false, reason: '还没配好 API' };

        const userInput = String(cfg.user_input == null ? '' : cfg.user_input);
        const recent = session.turns.slice(-6).map(t => t.text).join('\n') + '\n' + userInput;

        let systemText = buildSsSystemPrompt(session, recent);
        let history = buildSsHistory(session);
        if (typeof cfg.max_chat_history === 'number' && cfg.max_chat_history >= 0) {
            history = history.slice(-cfg.max_chat_history);
        }

        // injects：同类软件让卡片往这次请求里临时插几段提示词，用完即弃，不落存档
        history = gyApplyInjects(history, cfg.injects, (txt) => { systemText += '\n\n' + txt; });

        gyTavernEmit('generation_started');
        try {
            const messages = buildStructuredMessages(systemText, history, userInput || '请继续。');
            const abort = new AbortController();
            gyTavernActiveAborts.add(abort);
            let out = '';
            const data = await streamCompletionText(api, messages, (partial, isDone) => {
                out = partial;
                // 卡片要流式的话，把增量当同类软件的 stream_token_received 事件发出去
                if (cfg.should_stream) gyTavernEmit('stream_token_received', partial);
                if (isDone) gyTavernEmit('stream_reasoning_done');
            }, null, abort.signal);
            gyTavernActiveAborts.delete(abort);
            if (data && data.aborted) return { ok: true, value: out || '' };
            if (data && data.error) return { ok: false, reason: data.error.message || '生成失败' };
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message
                        && data.choices[0].message.content) || out || '';
            return { ok: true, value: String(raw).trim() };
        } catch (e) {
            return { ok: false, reason: e && e.message };
        } finally {
            gyTavernEmit('generation_ended');
        }
    },

    // generateRaw：不带白露的任何设定，卡片给什么就发什么。
    // 卡片拿它做"翻译一下""起个名字"这类跟剧情无关的小任务。
    async generateRaw(config) {
        const cfg = config || {};
        const session = gyTavernTurns();
        const api = (typeof ssGetApi === 'function' && session) ? ssGetApi(session)
                  : (typeof getApiConfig === 'function' ? getApiConfig(true) : null);
        if (!api || !api.key || !api.url) return { ok: false, reason: '还没配好 API' };
        if (typeof callChatCompletionAPI !== 'function') return { ok: false, reason: '生成功能不可用' };

        let messages;
        if (Array.isArray(cfg.ordered_prompts) && cfg.ordered_prompts.length) {
            messages = cfg.ordered_prompts
                .filter(p => p && typeof p === 'object' && typeof p.content === 'string')
                .map(p => ({ role: p.role === 'user' ? 'user' : (p.role === 'assistant' ? 'assistant' : 'system'), content: p.content }));
        } else {
            const text = String(cfg.prompt || cfg.user_input || '');
            if (!text) return { ok: false, reason: '没有给要生成的内容' };
            messages = [{ role: 'user', content: text }];
        }
        gyTavernEmit('generation_started');
        try {
            const data = await callChatCompletionAPI(api, messages);
            if (data && data.error) return { ok: false, reason: data.error.message || '生成失败' };
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message
                        && data.choices[0].message.content) || '';
            return { ok: true, value: String(raw).trim() };
        } catch (e) {
            return { ok: false, reason: e && e.message };
        } finally {
            gyTavernEmit('generation_ended');
        }
    },

    stopAllGeneration() {
        let n = 0;
        gyTavernActiveAborts.forEach(a => { try { a.abort(); n++; } catch (e) { /* ignore */ } });
        gyTavernActiveAborts.clear();
        // 续写自己那条正在跑的也一起停掉
        try { if (typeof ssAbortController !== 'undefined' && ssAbortController) { ssAbortController.abort(); n++; } } catch (e) { /* ignore */ }
        gyTavernEmit('generation_stopped');
        return { ok: true, value: n };
    },

    // ==== 世界书（同类软件叫 worldbook，老名字叫 lorebook，两套名字指同一个东西）====

    // 书名列表 ＝ 白露的分类列表（没填分类的归到「未分类」）
    getWorldbookNames() {
        try {
            const set = new Set((worldbooks || []).map(gyWbBookOf));
            (typeof worldbookCategories !== 'undefined' ? worldbookCategories : []).forEach(c => { if (c) set.add(c); });
            return { ok: true, value: Array.from(set) };
        } catch (e) { return { ok: true, value: [] }; }
    },

    // 一本书 ＝ 一个分类下的所有条目。不传书名就给全部。
    getWorldbook(name) {
        try {
            const list = (worldbooks || []).filter(w => !name || gyWbBookOf(w) === name);
            return { ok: true, value: list.map(gyWbToTavern) };
        } catch (e) { return { ok: true, value: [] }; }
    },

    getCharWorldbookNames(charIdOrName, ctx) {
        const char = gyFindChar(charIdOrName != null ? charIdOrName : (ctx && ctx.charId));
        if (!char) return { ok: true, value: { primary: null, additional: [] } };
        // 角色勾了哪些条目 → 这些条目属于哪几本书（分类）
        const names = Array.from(new Set((char.worldbooks || []).map(id => {
            const w = (worldbooks || []).find(x => String(x.id) === String(id));
            return w ? gyWbBookOf(w) : null;
        }).filter(Boolean)));
        return { ok: true, value: { primary: names[0] || null, additional: names.slice(1) } };
    },

    // 卡片改世界书：按 title 找到那条，更新正文/关键词/开关。找不到就新建一条。
    replaceWorldbook(name, entries) {
        if (!Array.isArray(entries)) return { ok: false, reason: '条目必须是数组' };
        let n = 0;
        entries.forEach(e => {
            if (!e || typeof e !== 'object') return;
            const title = e.name || e.comment || e.title;
            if (!title) return;
            const book = name || GY_WB_DEFAULT_BOOK;
            // 同一本书里按条目名找；找不到就在这本书下新建一条
            let wb = (worldbooks || []).find(w => w.title === title && gyWbBookOf(w) === book)
                  || (worldbooks || []).find(w => w.title === title);
            if (!wb) {
                wb = { id: Date.now() + Math.floor(Math.random() * 1000), title, content: '', isGlobal: false,
                       category: (book === GY_WB_DEFAULT_BOOK ? '' : book) };
                worldbooks.push(wb);
            }
            if (typeof e.content === 'string') wb.content = e.content;
            if (Array.isArray(e.keys)) wb.keywords = e.keys.join(',');
            if (Array.isArray(e.secondary_keys)) wb.secondaryKeywords = e.secondary_keys.join(',');
            if (typeof e.selective_logic === 'string') wb.secondaryLogic = e.selective_logic;
            if (typeof e.enabled === 'boolean') wb.disabled = !e.enabled;
            if (typeof e.constant === 'boolean') wb.isGlobal = e.constant;
            if (typeof e.probability === 'number') wb.probability = e.probability;
            if (typeof e.order === 'number') wb.priority = e.order;
            if (typeof e.depth === 'number') wb.depth = e.depth;
            if (typeof e.role === 'string') wb.depthRole = e.role;
            if (typeof e.sticky === 'number') wb.stickyTurns = e.sticky;
            if (typeof e.cooldown === 'number') wb.cooldownTurns = e.cooldown;
            if (typeof e.delay === 'number') wb.delayTurns = e.delay;
            n++;
        });
        if (n > 0) {
            try { if (typeof saveAllData === 'function') saveAllData(); } catch (err) { /* ignore */ }
            try { if (typeof renderWorldbookCards === 'function') renderWorldbookCards(); } catch (err) { /* ignore */ }
            gyTavernEmit('worldinfo_updated', name);
        }
        return { ok: true, value: n };
    },

    // ==== 正则 ====

    getTavernRegexes(option) {
        const opt = option || {};
        try {
            const list = (regexScripts || []).filter(r => opt.enable_state === 'all' ? true
                : (opt.enable_state === 'disabled' ? r.enabled === false : r.enabled !== false));
            // 不把 replace 原样吐出去——状态栏那种一条就十几万字符，
            // 卡片要的是"有哪些规则"，不是规则的完整内容
            return { ok: true, value: list.map(r => ({
                id: r.id, script_name: r.name, enabled: r.enabled !== false,
                find_regex: r.find, replace_string_length: (r.replace || '').length,
                source: { user_input: r.target === 'user_input' || r.target === 'both',
                          ai_output: r.target === 'ai_output' || r.target === 'both' },
                destination: { display: !!r.displayOnly, prompt: !!r.promptOnly },
                min_depth: r.minDepth, max_depth: r.maxDepth,
            })) };
        } catch (e) { return { ok: true, value: [] }; }
    },

    // 卡片拿一段文本，问"按正则处理完长什么样"
    formatAsTavernRegexedString(text, option, ctx) {
        const opt = option || {};
        let out = String(text == null ? '' : text);
        const charId = (opt.char_id != null) ? opt.char_id : (ctx && ctx.charId);
        try {
            if (typeof applyRegexScripts === 'function') {
                out = applyRegexScripts(out, opt.source === 'user_input' ? 'user_input' : 'ai_output', charId);
            }
            if (opt.destination !== 'prompt' && typeof applyDisplayOnlyRegex === 'function') {
                out = applyDisplayOnlyRegex(out, charId, opt.depth);
            }
        } catch (e) { /* 正则出错就返回尽量处理过的结果，不让卡片拿到 undefined */ }
        return { ok: true, value: out };
    },

    // ==== 宏 ====

    // 完整版的宏替换：{{char}} {{user}} {{getvar}} {{setvar}} {{random}} {{roll}}、EJS <% %> 全都走白露自己的 applyMacros。
    // （iframe 里那个同步版只认几个只读的常用宏，因为跨窗口没法同步调用主页面。）
    substitudeMacros(text, ctx) {
        const session = gyTavernTurns();
        const char = gyFindChar(ctx && ctx.charId);
        try {
            if (typeof applyMacros === 'function') {
                const scope = (session && typeof ssScopeId === 'function') ? ssScopeId(session) : undefined;
                return { ok: true, value: applyMacros(String(text == null ? '' : text), char, scope) };
            }
        } catch (e) { /* ignore */ }
        return { ok: true, value: String(text == null ? '' : text) };
    },

    // ==== 显示 ====

    // 把一段原始文本按白露的渲染链路转成最终显示的 HTML（markdown + 正则 + 卡片）
    formatAsDisplayedMessage(text, option, ctx) {
        const opt = option || {};
        try {
            if (typeof renderMarkdownLite === 'function') {
                return { ok: true, value: renderMarkdownLite(String(text == null ? '' : text),
                    opt.char_id != null ? opt.char_id : (ctx && ctx.charId), opt.depth) };
            }
        } catch (e) { /* ignore */ }
        return { ok: true, value: String(text == null ? '' : text) };
    },

    refreshOneMessage() {
        try { if (typeof renderSsTurns === 'function') renderSsTurns(); } catch (e) { /* ignore */ }
        setTimeout(gyTavernPushSnapshot, 60);
        return { ok: true };
    },

    // ==== 提示词注入 ====

    // 同类软件的 injectPrompts：卡片往接下来的请求里挂几段提示词，直到 uninject 为止。
    // 存在会话上（不进存档快照的正文，只影响拼 prompt），由 buildSsSystemPrompt / buildSsHistory 消费。
    injectPrompts(list) {
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里' };
        if (!Array.isArray(list)) return { ok: false, reason: '参数必须是数组' };
        if (!session.cardInjects) session.cardInjects = [];
        list.forEach(item => {
            if (!item || typeof item.content !== 'string') return;
            const id = item.id || ('inj_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
            const idx = session.cardInjects.findIndex(x => x.id === id);
            const entry = {
                id,
                role: item.role === 'user' ? 'user' : (item.role === 'assistant' ? 'assistant' : 'system'),
                content: item.content,
                position: item.position || 'in_chat',
                depth: typeof item.depth === 'number' ? item.depth : 0,
            };
            if (idx >= 0) session.cardInjects[idx] = entry; else session.cardInjects.push(entry);
        });
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        return { ok: true, value: session.cardInjects.length };
    },

    uninjectPrompts(ids) {
        const session = gyTavernTurns();
        if (!session || !session.cardInjects) return { ok: true, value: 0 };
        const before = session.cardInjects.length;
        if (!Array.isArray(ids)) session.cardInjects = [];
        else session.cardInjects = session.cardInjects.filter(x => ids.indexOf(x.id) === -1);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        return { ok: true, value: before - session.cardInjects.length };
    },

    // ==== 预设 ====

    loadPreset(name) {
        try {
            const target = (aiPresets || []).find(p => p.name === name || String(p.id) === String(name));
            if (!target) return { ok: false, reason: '没有这个预设：' + name };
            if (typeof setActivePreset === 'function') { setActivePreset(target.id); return { ok: true, value: true }; }
            (aiPresets || []).forEach(p => { p.enabled = (p.id === target.id); });
            if (typeof saveAllData === 'function') saveAllData();
            return { ok: true, value: true };
        } catch (e) { return { ok: false, reason: e && e.message }; }
    },

    // ==== 聊天列表 ====

    getChatHistoryBrief() {
        try {
            return { ok: true, value: (storySessions || []).map(s => ({
                chat_id: s.id, name: s.title || '未命名续写',
                message_count: (s.turns || []).length,
                last_modified: s.updatedAt || s.createdAt,
            })) };
        } catch (e) { return { ok: true, value: [] }; }
    },





    // ==== 上面那批接口需要主页面干的活 ====

    getPreset(name) {
        try {
            const p = (aiPresets || []).find(x => x.name === name || String(x.id) === String(name))
                   || (typeof getActivePresetObj === 'function' ? getActivePresetObj() : null);
            if (!p) return { ok: false, reason: '没有这个预设：' + name };
            // 只给概要，不把整份预设（可能几十条提示词、上万字）塞回 iframe
            return { ok: true, value: {
                name: p.name || '', enabled: p.enabled !== false,
                prompt_count: (p.prompts || []).length,
                sampler: p.samplerParams || {},
            } };
        } catch (e) { return { ok: false, reason: e && e.message }; }
    },

    async deletePreset(name) {
        const p = (aiPresets || []).find(x => x.name === name || String(x.id) === String(name));
        if (!p) return { ok: true, value: false };
        const msg = `角色卡想删掉预设「${p.name}」，确定吗？`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: false };
        aiPresets = aiPresets.filter(x => x !== p);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPresetsPage === 'function') renderPresetsPage(); } catch (e) { /* ignore */ }
        return { ok: true, value: true };
    },

    renamePreset(name, next) {
        const p = (aiPresets || []).find(x => x.name === name || String(x.id) === String(name));
        if (!p || !next) return { ok: true, value: false };
        p.name = String(next);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPresetsPage === 'function') renderPresetsPage(); } catch (e) { /* ignore */ }
        return { ok: true, value: true };
    },

    // 每段续写连楼层一起给（getChatHistoryBrief 只给概要，这个给细节）
    getChatHistoryDetail() {
        try {
            return { ok: true, value: (storySessions || []).map(s2 => ({
                chat_id: s2.id, name: s2.title || '未命名续写',
                messages: (s2.turns || []).map((t, i) => gyTurnToMessage(t, i, false)),
            })) };
        } catch (e) { return { ok: true, value: [] }; }
    },

    getGlobalWorldbookNames() {
        try { return { ok: true, value: Array.from(new Set((worldbooks || []).filter(w => w.isGlobal).map(gyWbBookOf))) }; }
        catch (e) { return { ok: true, value: [] }; }
    },

    async deleteWorldbook(name) {
        const hits = (worldbooks || []).filter(x => gyWbBookOf(x) === name);
        if (hits.length === 0) return { ok: true, value: false };
        const msg = `角色卡想删掉世界书「${name}」，里面有 ${hits.length} 条内容，确定吗？删了找不回来。`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: false };
        const kill = new Set(hits);
        worldbooks = worldbooks.filter(x => !kill.has(x));
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderWorldbookCards === 'function') renderWorldbookCards(); } catch (e) { /* ignore */ }
        return { ok: true, value: true };
    },

    // 删一本书里的指定条目（按 uid 或条目名）
    async deleteWorldbookEntries(name, uids) {
        if (!Array.isArray(uids) || uids.length === 0) return { ok: true, value: 0 };
        const want = new Set(uids.map(String));
        const hits = (worldbooks || []).filter(w => gyWbBookOf(w) === name
            && (want.has(String(w.id)) || want.has(w.title)));
        if (hits.length === 0) return { ok: true, value: 0 };
        const msg = `角色卡想从世界书「${name}」里删掉 ${hits.length} 条内容，确定吗？`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: 0 };
        const kill = new Set(hits);
        worldbooks = worldbooks.filter(w => !kill.has(w));
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderWorldbookCards === 'function') renderWorldbookCards(); } catch (e) { /* ignore */ }
        return { ok: true, value: hits.length };
    },

    async createPersona(name, data) {
        if (!name) return { ok: false, reason: '没给人设名字' };
        const msg = `角色卡想给你新建一个人设「${name}」，要建吗？`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: false };
        const base = (typeof currentUser !== 'undefined') ? JSON.parse(JSON.stringify(currentUser)) : {};
        const d = data || {};
        if (d.name) base.name = d.name;
        if (d.description) base.persona = d.description;
        if (d.avatar) base.avatarImg = d.avatar;
        userPersonas.push({ id: 'persona_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), label: String(name), data: base });
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPersonaSwitchSelect === 'function') renderPersonaSwitchSelect(); } catch (e) { /* ignore */ }
        setTimeout(gyTavernPushSnapshot, 60);
        return { ok: true, value: true };
    },

    async deletePersona(id) {
        const p = gyFindPersona(id);
        if (!p) return { ok: true, value: false };
        const msg = `角色卡想删掉人设「${p.label || p.id}」，确定吗？`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: false };
        userPersonas = userPersonas.filter(x => x !== p);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPersonaSwitchSelect === 'function') renderPersonaSwitchSelect(); } catch (e) { /* ignore */ }
        setTimeout(gyTavernPushSnapshot, 60);
        return { ok: true, value: true };
    },

    appendAudioList(list) {
        if (Array.isArray(list)) gyAudioList = gyAudioList.concat(list);
        return { ok: true, value: gyAudioList.length };
    },

    // ==== 用户人设（persona）====
    //
    // 同类软件的 persona ＝ "你自己"的身份档案（名字/头像/自我描述），可以存好几个随时切，
    // 比如"本体""马甲小号"。卡片拿这些接口来称呼你、显示你的头像，
    // 或者按不同人设走不同剧情分支。
    //
    // 白露完全有对应的东西：用户资料里的 userPersonas（每份是一整份 currentUser 快照）。
    // 唯一的结构差异：同类软件用**头像文件名**当 persona 的唯一 id（历史包袱），
    // 白露用自己生成的 persona_xxx；对卡片来说都只是个不透明的字符串，不影响使用。

    getPersona(personaId) {
        const p = gyFindPersona(personaId);
        if (!p) return { ok: false, reason: '没有这个人设：' + personaId };
        return { ok: true, value: gyPersonaToTavern(p) };
    },

    // 切换当前人设。会改动你的用户资料，所以要问一句。
    async switchPersona(personaId) {
        const p = gyFindPersona(personaId);
        if (!p) return { ok: false, reason: '没有这个人设：' + personaId };
        const msg = `角色卡想把你的人设切换成「${p.label || p.id}」，要切吗？`;
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: false };
        if (typeof switchToPersona === 'function') switchToPersona(p.id);
        setTimeout(gyTavernPushSnapshot, 60);
        return { ok: true, value: true };
    },

    // ==== 音频播放 ====
    //
    // 角色卡拿它放 BGM / 音效（蔚野那张"下雪❄️播放器"就是）。
    // 白露原来只有 TTS 朗读，没有音频播放器，这次补一个真的：
    // 一个 <audio> 元素 + 右下角一个小控制条，让你随时能停、能调音量——
    // 卡片自己放的音乐没个地方关掉是很烦人的。
    playAudio(config) {
        const cfg = (typeof config === 'string') ? { url: config } : (config || {});
        const url = cfg.url || cfg.src || cfg.audio;
        if (!url) return { ok: false, reason: '没给音频地址' };
        const el = gyEnsureAudioEl();
        if (String(el.dataset.src || '') !== String(url)) {
            el.src = url;
            el.dataset.src = url;
        }
        if (typeof cfg.volume === 'number') el.volume = Math.max(0, Math.min(1, cfg.volume > 1 ? cfg.volume / 100 : cfg.volume));
        if (typeof cfg.loop === 'boolean') el.loop = cfg.loop;
        el.play().catch(e => {
            // 浏览器不许"用户还没交互就自动播放"，这是正常的，不是 bug——
            // 提示一下让用户点一下页面即可，不要静默失败让人以为坏了
            console.info('[音频] 浏览器拦下了自动播放，等你点一下页面再放：', e && e.message);
            gyTavernNotify('角色卡想放一段音频，点一下页面任意处就会开始。');
        });
        gyRenderAudioBar();
        return { ok: true, value: true };
    },

    pauseAudio() {
        const el = gyAudioEl;
        if (el) { try { el.pause(); } catch (e) { /* ignore */ } }
        gyRenderAudioBar();
        return { ok: true, value: true };
    },

    getCurrentAudio() {
        const el = gyAudioEl;
        if (!el || !el.dataset.src) return { ok: true, value: null };
        return { ok: true, value: {
            url: el.dataset.src, playing: !el.paused,
            volume: el.volume, loop: !!el.loop,
            currentTime: el.currentTime, duration: isFinite(el.duration) ? el.duration : 0,
        } };
    },

    getAudioSettings() {
        const el = gyAudioEl;
        return { ok: true, value: { volume: el ? el.volume : 1, loop: el ? !!el.loop : false, muted: el ? !!el.muted : false } };
    },

    setAudioSettings(settings) {
        const el = gyEnsureAudioEl();
        const s2 = settings || {};
        if (typeof s2.volume === 'number') el.volume = Math.max(0, Math.min(1, s2.volume > 1 ? s2.volume / 100 : s2.volume));
        if (typeof s2.loop === 'boolean') el.loop = s2.loop;
        if (typeof s2.muted === 'boolean') el.muted = s2.muted;
        gyRenderAudioBar();
        return { ok: true, value: true };
    },

    // 同类软件的播放列表。白露这边就是一个数组，配合 playAudio 用。
    getAudioList() { return { ok: true, value: gyAudioList.slice() }; },
    replaceAudioList(list) {
        gyAudioList = Array.isArray(list) ? list.slice() : [];
        return { ok: true, value: gyAudioList.length };
    },

    // ==== 模型列表 ====

    // 接的就是设置页那个「🔄 拉取模型」按钮用的同一份逻辑（fetchModelListFrom），
    // 所以卡片看到的模型列表跟你自己点拉取看到的完全一致。
    async getModelList(which) {
        const useSub = (which === 'sub' || which === true);
        const api = (typeof getApiConfig === 'function') ? getApiConfig(useSub) : null;
        if (!api || !api.url || !api.key) return { ok: false, reason: '还没配好 API' };
        if (typeof fetchModelListFrom !== 'function') return { ok: false, reason: '拉取模型功能不可用' };
        try {
            const list = await fetchModelListFrom(api.url, api.key);
            return { ok: true, value: list.map(m => m.id) };
        } catch (e) {
            return { ok: false, reason: (typeof enhanceNetworkErrorMessage === 'function')
                ? enhanceNetworkErrorMessage(e.message) : (e && e.message) };
        }
    },

    // ==== 扩展 ＝ 白露的插件 ====
    //
    // 同类软件的"扩展"是从 git 地址装一份前端代码进来。白露对应的东西就是**插件**
    //（设置 → 插件：prompt / action / macro / script 四类，结构见 js/01 的 plugins 注释）。
    // 所以这里把 installExtension 接到插件系统上。
    //
    // ⚠️ 但有一条底线：**绝不静默安装**。
    // 白露的 script 类插件是在主页面里跑真代码的（executePluginOnLoad），
    // 而卡片本来被我关在 iframe 里就是为了不让它碰主页面。要是卡片能悄悄装一个 script 插件，
    // 等于我亲手把那道墙拆了。所以：一律先弹框问你，把要装的东西一条条列清楚；
    // script 类另外再警告一次。你不点同意，什么都不会发生。
    //
    // 给 git 地址的那种（同类软件原本的用法）直接拒绝——不会去下载并执行任何远程代码。
    async installExtension(payload) {
        let list = payload;
        // 网址形式：真的去下。白露是本地部署，装什么都是自己的机器，
        // 所以不再一刀切拒绝，改成"下下来 → 看清楚是什么 → 你点头才装"。
        if (typeof list === 'string' && /^https?:\/\//i.test(list)) {
            try {
                list = await gyFetchRemotePlugin(list);
            } catch (e) {
                gyTavernNotify('下载扩展失败：' + (e && e.message));
                return { ok: false, reason: e && e.message };
            }
        }
        if (typeof list === 'string') { try { list = JSON.parse(list); } catch (e) { return { ok: false, reason: '不是合法的插件 JSON' }; } }
        if (!Array.isArray(list)) list = [list];
        const valid = list.filter(x => x && typeof x === 'object' && x.name && x.type);
        if (valid.length === 0) return { ok: false, reason: '没有合法的插件内容' };

        const hasScript = valid.some(x => x.type === 'script');
        const lines = valid.map(x => `　· [${x.type}] ${x.name}${x.description ? '　—— ' + x.description : ''}`).join('\n');
        let msg = `这张角色卡想往你的白露里安装 ${valid.length} 个插件：\n\n${lines}\n\n装进去之后会出现在「设置 → 插件」里，你随时能关掉或删掉。要装吗？`;
        if (hasScript) {
            msg += '\n\n⚠️ 其中有 script 类插件——这类插件会在白露主界面里执行真正的代码，权限比角色卡自己高得多。不确定这张卡的来源就点取消。';
        }
        const go = (typeof appConfirm === 'function') ? await appConfirm(msg) : confirm(msg);
        if (!go) return { ok: true, value: 0 };

        const added = [];
        valid.forEach(x => {
            const plugin = Object.assign({}, x, {
                id: 'plg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                enabled: x.enabled !== false,
                fromCard: true,
            });
            plugins.push(plugin);
            added.push(plugin);
        });
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPluginsList === 'function') renderPluginsList(); } catch (e) { /* ignore */ }
        try { if (typeof renderChatPluginActionsBar === 'function') renderChatPluginActionsBar(); } catch (e) { /* ignore */ }
        // 带"网页打开时执行"钩子的，装完立刻跑一次（跟手动导入插件的行为一致）
        added.forEach(pl => {
            try { if (pl.enabled !== false && pl.type === 'script' && pl.onLoad && typeof executePluginOnLoad === 'function') executePluginOnLoad(pl); }
            catch (e) { console.error('插件启动钩子出错：', e); }
        });
        gyTavernNotify(`已安装 ${added.length} 个插件，在「设置 → 插件」里能看到。`);
        return { ok: true, value: added.length };
    },

    async uninstallExtension(nameOrId) {
        const target = (plugins || []).find(p => p.id === nameOrId || p.name === nameOrId);
        if (!target) return { ok: true, value: false };
        const go = (typeof appConfirm === 'function')
            ? await appConfirm(`要卸载插件「${target.name}」吗？`)
            : confirm(`要卸载插件「${target.name}」吗？`);
        if (!go) return { ok: true, value: false };
        plugins = plugins.filter(p => p !== target);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderPluginsList === 'function') renderPluginsList(); } catch (e) { /* ignore */ }
        try { if (typeof renderChatPluginActionsBar === 'function') renderChatPluginActionsBar(); } catch (e) { /* ignore */ }
        return { ok: true, value: true };
    },

    isInstalledExtension(nameOrId) {
        return { ok: true, value: (plugins || []).some(p => p.id === nameOrId || p.name === nameOrId) };
    },

    getExtensionInstallationInfo() {
        return { ok: true, value: (plugins || []).map(p => ({
            name: p.name, type: p.type, enabled: p.enabled !== false,
            description: p.description || '', from_card: !!p.fromCard,
        })) };
    },

    // ==== 脚本按钮 ＝ 续写页上方的卡片按钮栏 ====
    //
    // 同类软件把这类按钮挂在脚本库的抽屉里；白露改成放在续写操作区上方——卡片就在这个页面里，
    // 按钮离它近才用得顺手。行为不变：点一下把事件发回给注册它的那张卡。
    // 注册信息存在会话上，所以卡片重渲染 / iframe 重建都不会把按钮弄丢。
    replaceScriptButtons(scriptId, buttons, ctx) {
        const session = gyTavernTurns();
        if (!session) return { ok: false, reason: '当前不在续写里' };
        const sid = scriptId || (ctx && ctx.charId) || 'card';
        const list = Array.isArray(buttons) ? buttons : [];
        const others = (session.cardButtons || []).filter(b => b.script_id !== sid);
        session.cardButtons = others.concat(
            list.filter(b => b && b.name).map(b => ({
                script_id: sid, name: String(b.name), visible: b.visible !== false,
            }))
        );
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
        try { if (typeof renderSsCardButtons === 'function') renderSsCardButtons(); } catch (e) { /* ignore */ }
        return { ok: true, value: session.cardButtons.length };
    },

    getScriptButtons(scriptId, ctx) {
        const session = gyTavernTurns();
        if (!session) return { ok: true, value: [] };
        const sid = scriptId || (ctx && ctx.charId) || 'card';
        return { ok: true, value: (session.cardButtons || [])
            .filter(b => b.script_id === sid)
            .map(b => ({ name: b.name, visible: b.visible !== false })) };
    },

    // ==== 杂项 ====

    // 斜杠命令。白露有对应功能的都接上了，没有的忽略掉并在控制台留一行。
    async triggerSlash(command, ctx) {
        const raw = String(command || '').trim();
        if (!raw) return { ok: true };
        // 同类软件允许用 | 串几条命令
        const parts = raw.split(/\s*\|\s*(?=\/)/);
        let last = '';
        for (const one of parts) last = await gyRunSlash(one, ctx);
        return { ok: true, value: last };
    },
};


// 单条斜杠命令。参数写法跟同类软件一致：`/命令 key=value 正文`
async function gyRunSlash(cmd, ctx) {
    const m = String(cmd).trim().match(/^\/([a-zA-Z-]+)\s*([\s\S]*)$/);
    if (!m) return '';
    const name = m[1].toLowerCase();
    let rest = m[2] || '';
    // 摘出 key=value 参数，剩下的是正文
    const args = {};
    rest = rest.replace(/\b([a-zA-Z_]+)\s*=\s*("[^"]*"|'[^']*'|\S+)/g, (_all, k, v) => {
        args[k.toLowerCase()] = v.replace(/^["']|["']$/g, '');
        return '';
    }).trim();

    const session = gyTavernTurns();
    const idxOf = (v) => { let i = Number(v); if (isNaN(i)) return null; if (i < 0 && session) i = session.turns.length + i; return i; };

    switch (name) {
        case 'echo':
        case 'toast':
            if (rest) gyTavernNotify(rest);
            return rest;

        // 隐藏/显示楼层——白露的"隐藏楼层·不进 prompt"就是这个
        case 'hide':
        case 'unhide': {
            if (!session) return '';
            const want = (name === 'hide');
            const spec = rest || args.at || '';
            const ids = [];
            const range = String(spec).match(/^(-?\d+)\s*-\s*(-?\d+)$/);
            if (range) { const a = idxOf(range[1]), b = idxOf(range[2]); for (let i = Math.min(a,b); i <= Math.max(a,b); i++) ids.push(i); }
            else { const i = idxOf(spec); if (i !== null) ids.push(i); }
            let n = 0;
            ids.forEach(i => { if (session.turns[i]) { session.turns[i].hidden = want; n++; } });
            if (n) gyTavernAfterChange(session, 'message_updated');
            return String(n);
        }

        // 往楼层里加一条
        case 'send':
        case 'sys':
        case 'sendas': {
            if (!session || !rest) return '';
            const role = (name === 'send') ? 'user' : (name === 'sys' ? 'system' : 'ai');
            gyTavernBridge.createChatMessages([{ role: role === 'ai' ? 'assistant' : role, message: rest }], {});
            return rest;
        }

        case 'del': {
            if (!session) return '';
            const n = parseInt(rest || args.n || '1', 10) || 1;
            const ids = [];
            for (let i = 0; i < n; i++) ids.push(session.turns.length - 1 - i);
            return String((gyTavernBridge.deleteChatMessages(ids) || {}).value || 0);
        }

        // 变量：走白露自己那份存储，{{getvar}} 立刻能读到
        case 'setvar': {
            const key = args.key || args.name;
            if (!key) return '';
            const scope = (session && typeof ssScopeId === 'function') ? ssScopeId(session) : '__default__';
            if (typeof macroSetVar === 'function') macroSetVar(scope, key, rest);
            try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
            return rest;
        }
        case 'getvar': {
            const key = args.key || args.name || rest;
            const scope = (session && typeof ssScopeId === 'function') ? ssScopeId(session) : '__default__';
            return (typeof macroGetVar === 'function') ? macroGetVar(scope, key) : '';
        }
        case 'addvar':
        case 'incvar':
        case 'decvar': {
            const key = args.key || args.name || rest;
            const scope = (session && typeof ssScopeId === 'function') ? ssScopeId(session) : '__default__';
            const delta = (name === 'incvar') ? 1 : (name === 'decvar') ? -1 : parseFloat(rest) || 0;
            if (typeof macroAddVar === 'function') macroAddVar(scope, key, delta);
            try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) { /* ignore */ }
            return (typeof macroGetVar === 'function') ? macroGetVar(scope, key) : '';
        }

        // 让 AI 生成一段
        case 'gen':
        case 'gen-raw':
        case 'trigger': {
            const r = await gyTavernBridge.generate({ user_input: rest }, ctx);
            return (r && r.ok) ? (r.value || '') : '';
        }

        // 宏替换
        case 'pass':
        case 'evalmacro': {
            const r = gyTavernBridge.substitudeMacros(rest, ctx);
            return (r && r.value) || rest;
        }

        case 'abort':
        case 'stop':
            gyTavernBridge.stopAllGeneration();
            return '';

        default:
            console.info('[同类软件兼容层] 卡片执行了斜杠命令 /' + name + '，白露没有对应功能，已忽略。');
            return '';
    }
}

// 深合并：同类软件的 insertOrAssignVariables 是"有就覆盖、没有就插入"，嵌套对象要往里走
function gyDeepAssign(target, source) {
    if (!target || !source) return target;
    Object.keys(source).forEach(k => {
        const v = source[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
            gyDeepAssign(target[k], v);
        } else {
            target[k] = v;
        }
    });
    return target;
}

// 卡片弹的提示，用白露自己的提示条显示，不要用会打断操作的 alert
function gyTavernNotify(text) {
    try {
        if (typeof showToast === 'function') { showToast('💬', '角色卡', text, null, null); return; }
    } catch (e) { /* 掉下去用兜底 */ }
    try {
        if (typeof appAlert === 'function') { appAlert(text); return; }
    } catch (e) { /* ignore */ }
    console.info('[角色卡] ' + text);
}

window.gyTavernContextFor = gyTavernContextFor;
window.gyTavernBridge = gyTavernBridge;
