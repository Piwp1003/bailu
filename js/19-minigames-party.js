/* =====================================================================
   js/19 —— 派对类小游戏（原来是 4 个插件，v92 起内置）
   狼人杀 / 谁是卧底 / 20个问题 / 真心话大冒险
   （20个问题：题数自定/不限，能反过来让角色猜；
     20个问题和真心话的问答都能点 ☆ 收藏，收藏库见 window.gyGameFav）

   前两个要群聊（狼人杀至少 3 个角色，谁是卧底至少 2 个），
   后两个私聊就能玩。同样每个一个 IIFE，理由见 js/18 顶部。
   ===================================================================== */

// ============ 狼人杀 ============
(function () {

    /* 🎲 这个模块里所有"让角色开口"的地方都属于「桌游 / 派对游戏」那一场。
       模块是个 IIFE、里面十几个函数都是局部的，一个个包太脏；
       而 prompt 是 buildBasePrompt 同步拼出来的，所以在这儿遮蔽它一次就够——
       模块内部所有调用都会自动落在 game 这一场里。 */
    const buildBasePrompt = function () {
        const a = arguments;
        if (typeof window.gyInjectInScene === 'function' && typeof window.buildBasePrompt === 'function')
            return window.gyInjectInScene('game', () => window.buildBasePrompt.apply(null, a));
        return window.buildBasePrompt ? window.buildBasePrompt.apply(null, a) : '';
    };
  if (window.__werewolfPluginInstalled) return;
  window.__werewolfPluginInstalled = true;

  const STORE_KEY = 'werewolfGamesV1';
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveStore(obj) { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }
  function getGame(sessionId) { return loadStore()[sessionId] || null; }
  function setGame(sessionId, game) {
    const all = loadStore();
    if (game) all[sessionId] = game; else delete all[sessionId];
    saveStore(all);
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function playerName(p) { if (!p) return '未知'; if (p.id === 'user') return (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '你'; const c = myCharacters.find(x => x.id == p.id); return c ? c.name : '未知'; }
  const ROLE_LABEL = { villager: '村民', werewolf: '狼人', seer: '预言家' };

  // ---------- 分配身份 ----------
  function assignRoles(allIds) {
    const total = allIds.length;
    const werewolfCount = Math.max(1, Math.floor(total / 3));
    const hasSeer = total >= 4;
    const shuffled = shuffle(allIds);
    const roles = {};
    for (let i = 0; i < werewolfCount; i++) roles[shuffled[i]] = 'werewolf';
    if (hasSeer) roles[shuffled[werewolfCount]] = 'seer';
    for (let i = werewolfCount + (hasSeer ? 1 : 0); i < total; i++) roles[shuffled[i]] = 'villager';
    return allIds.map(id => ({ id, role: roles[id], alive: true }));
  }

  function aliveOf(game, roleFilter) {
    return game.players.filter(p => p.alive && (!roleFilter || p.role === roleFilter));
  }
  function goodAlive(game) { return game.players.filter(p => p.alive && p.role !== 'werewolf'); }
  function wolfAlive(game) { return game.players.filter(p => p.alive && p.role === 'werewolf'); }

  // ---------- 开局 ----------
  async function startWerewolf(sessionId, opponentCharIds) {
    const chars = (opponentCharIds || []).map(id => myCharacters.find(c => c.id == id)).filter(Boolean);
    if (chars.length < 3) { alert('狼人杀至少需要3个角色一起玩（加上你总共4人），去群聊里凑够人数吧～'); return; }
    const allIds = ['user', ...chars.map(c => c.id)];
    const players = assignRoles(allIds);

    const game = {
      status: 'playing', players,
      phase: 'night', dayNum: 1,
      nightActions: { werewolfVotes: {}, seerTarget: null, seerResult: null },
      seerHistory: [],
      discussOrder: [], discussIndex: 0, discussions: [],
      dayVotes: {}, lastNightVictim: null, winner: null,
    };
    setGame(sessionId, game);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🐺 狼人杀开局！${players.length}位玩家（${players.map(playerName).join('、')}），身份已经悄悄分配好（狼人：${wolfAlive(game).length}人，预言家：${aliveOf(game, 'seer').length}人，其余是村民）。天黑请闭眼...`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openWolfPanel(sessionId);
    await startNightPhase(sessionId);
  }

  function openWolfPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('wolfFloatPanel', '🐺 狼人杀');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('wolfBody')) body.innerHTML = `<div id="wolfBody" style="max-width:320px;"></div>`;
    renderWolfPanel(sessionId);
  }

  // ---------- 夜晚阶段 ----------
  async function startNightPhase(sessionId) {
    let game = getGame(sessionId);
    game.phase = 'night';
    game.nightActions = { werewolfVotes: {}, seerTarget: null, seerResult: null };
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🌙 第${game.dayNum}天夜晚降临，天黑请闭眼...`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderWolfPanel(sessionId);

    const wolves = wolfAlive(game);
    const userIsWolf = wolves.some(p => p.id === 'user');
    for (const wolf of wolves) {
      if (wolf.id === 'user') continue; // 等用户自己在面板里选
      await runAiWerewolfVote(sessionId, wolf);
    }

    const seerAlive = aliveOf(getGame(sessionId), 'seer');
    const seer = seerAlive[0];
    if (seer && seer.id !== 'user') {
      await runAiSeerCheck(sessionId, seer);
    }

    renderWolfPanel(sessionId);
    await tryResolveNight(sessionId);
  }

  async function runAiWerewolfVote(sessionId, wolf) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == wolf.id);
    const api = getApiConfig(true);
    const targets = goodAlive(game); // 只能杀好人阵营
    if (targets.length === 0) return;
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const targetNames = targets.map(playerName).join('、');
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在玩狼人杀，你的身份是狼人（对外必须保密，白天讨论时要伪装成好人）。现在是夜晚，你和其他狼人同伴要选一个目标杀掉。
可以选择的目标（好人阵营存活玩家）：${targetNames}
请选择一个你要杀的目标。
只输出严格JSON，不要markdown代码块包裹：
{"target": "目标的名字，必须完全匹配上面列出的名字之一"}`;
    let targetId = null;
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed && parsed.target) { const t = targets.find(p => playerName(p) === parsed.target); if (t) targetId = t.id; }
      }
    } catch (e) {}
    if (!targetId) targetId = targets[Math.floor(Math.random() * targets.length)].id;
    game = getGame(sessionId);
    game.nightActions.werewolfVotes[wolf.id] = targetId;
    setGame(sessionId, game);
  }

  async function runAiSeerCheck(sessionId, seer) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == seer.id);
    const api = getApiConfig(true);
    const checkedIds = (game.seerHistory || []).map(h => h.targetId);
    const targets = game.players.filter(p => p.alive && p.id !== seer.id && !checkedIds.includes(p.id));
    const pool = targets.length > 0 ? targets : game.players.filter(p => p.alive && p.id !== seer.id);
    if (pool.length === 0) return;
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const targetNames = pool.map(playerName).join('、');
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在玩狼人杀，你的身份是预言家（对外必须保密）。现在是夜晚，你可以查验一名玩家的真实阵营（好人还是狼人）。
可以选择查验的目标：${targetNames}
请选择一个你要查验的目标。
只输出严格JSON，不要markdown代码块包裹：
{"target": "目标的名字，必须完全匹配上面列出的名字之一"}`;
    let targetId = null;
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed && parsed.target) { const t = pool.find(p => playerName(p) === parsed.target); if (t) targetId = t.id; }
      }
    } catch (e) {}
    if (!targetId) targetId = pool[Math.floor(Math.random() * pool.length)].id;
    game = getGame(sessionId);
    const target = game.players.find(p => p.id === targetId);
    const result = target.role === 'werewolf' ? 'werewolf' : 'good';
    game.seerHistory.push({ day: game.dayNum, targetId, result });
    game.nightActions.seerTarget = targetId;
    game.nightActions.seerResult = result;
    setGame(sessionId, game);
  }

  // ---------- 用户的夜晚操作 ----------
  async function submitNightWerewolfTarget(sessionId, targetId) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'night') return;
    const me = game.players.find(p => p.id === 'user');
    if (!me || me.role !== 'werewolf' || !me.alive) return;
    if (game.nightActions.werewolfVotes.user !== undefined) return;
    game.nightActions.werewolfVotes.user = targetId;
    setGame(sessionId, game);
    renderWolfPanel(sessionId);
    await tryResolveNight(sessionId);
  }
  window.__wolfSubmitWerewolfTarget = submitNightWerewolfTarget;

  async function submitNightSeerCheck(sessionId, targetId) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'night') return;
    const me = game.players.find(p => p.id === 'user');
    if (!me || me.role !== 'seer' || !me.alive) return;
    if (game.nightActions.seerTarget !== null) return;
    const target = game.players.find(p => p.id === targetId);
    const result = target.role === 'werewolf' ? 'werewolf' : 'good';
    game.nightActions.seerTarget = targetId;
    game.nightActions.seerResult = result;
    game.seerHistory.push({ day: game.dayNum, targetId, result });
    setGame(sessionId, game);
    renderWolfPanel(sessionId);
    await tryResolveNight(sessionId);
  }
  window.__wolfSubmitSeerCheck = submitNightSeerCheck;

  async function tryResolveNight(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'night') return;
    const wolves = wolfAlive(game);
    const wolvesDone = wolves.every(w => game.nightActions.werewolfVotes[w.id] !== undefined);
    const seerAlive = aliveOf(game, 'seer')[0];
    const seerDone = !seerAlive || game.nightActions.seerTarget !== null || game.nightActions.seerResult !== null;
    if (wolvesDone && seerDone) await resolveNight(sessionId);
  }

  async function resolveNight(sessionId) {
    let game = getGame(sessionId);
    const tally = {};
    Object.values(game.nightActions.werewolfVotes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    let maxVotes = -1, top = [];
    for (const pid of Object.keys(tally)) {
      if (tally[pid] > maxVotes) { maxVotes = tally[pid]; top = [pid]; }
      else if (tally[pid] === maxVotes) top.push(pid);
    }
    let victimId = top.length > 0 ? top[Math.floor(Math.random() * top.length)] : null;
    if (victimId) {
      const victim = game.players.find(p => p.id === victimId);
      victim.alive = false;
      game.lastNightVictim = victimId;
    } else {
      game.lastNightVictim = null;
    }
    setGame(sessionId, game);

    const winCheck = checkWinCondition(game);
    if (winCheck) { await finishWerewolf(sessionId, winCheck); return; }

    await startDayPhase(sessionId);
  }

  function checkWinCondition(game) {
    const wolves = wolfAlive(game);
    const goods = goodAlive(game);
    if (wolves.length === 0) return 'good';
    if (wolves.length >= goods.length) return 'werewolf';
    return null;
  }

  // ---------- 白天：宣布死讯 + 讨论 ----------
  async function startDayPhase(sessionId) {
    let game = getGame(sessionId);
    game.phase = 'day_discuss';
    game.discussions = [];
    const alive = game.players.filter(p => p.alive);
    game.discussOrder = shuffle(alive.map(p => p.id));
    game.discussIndex = 0;
    setGame(sessionId, game);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const victimText = game.lastNightVictim ? `昨晚 ${playerName(game.players.find(p => p.id === game.lastNightVictim))} 被杀害了。` : '昨晚是平安夜，没有人被杀。';
    globalChats[sessionId].push({ sender: 'system', text: `☀️ 第${game.dayNum}天天亮了。${victimText}现在开始自由讨论，请大家依次发言。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderWolfPanel(sessionId);
    await advanceDiscussion(sessionId);
  }

  async function advanceDiscussion(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    if (game.discussIndex >= game.discussOrder.length) { await startDayVote(sessionId); return; }
    const pid = game.discussOrder[game.discussIndex];
    if (pid === 'user') { renderWolfPanel(sessionId); return; }

    const player = game.players.find(p => p.id === pid);
    const char = myCharacters.find(c => c.id == pid);
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const discussSoFar = game.discussions.length > 0 ? game.discussions.map(d => `${playerName(game.players.find(p => p.id === d.by))}："${d.text}"`).join('；') : '（还没有人发言）';
    let roleContext = '';
    if (player.role === 'werewolf') {
      const wolfTeammates = wolfAlive(game).filter(w => w.id !== pid).map(playerName).join('、');
      roleContext = `你的身份是狼人（同伴：${wolfTeammates || '无'}），发言时要伪装成好人，可以带节奏、嫁祸给别人，绝对不能暴露自己是狼人。`;
    } else if (player.role === 'seer') {
      const myChecks = (game.seerHistory || []).filter(h => true).map(h => `${playerName(game.players.find(p => p.id === h.targetId))}是${h.result === 'werewolf' ? '狼人' : '好人'}`).join('，');
      roleContext = `你的身份是预言家，你目前查验过的结果：${myChecks || '还没查验过谁'}。你可以选择这一轮是否"跳身份"公布查验结果来带领好人阵营，也可以先观察局势再决定。`;
    } else {
      roleContext = `你的身份是村民，没有特殊能力，尽量通过大家的发言逻辑推理出谁是狼人。`;
    }
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在玩狼人杀。${roleContext}
当前是第${game.dayNum}天白天讨论，到目前为止大家的发言：${discussSoFar}
请说一段你这一轮的发言（分析局势、怀疑某人、或为自己辩护等），符合你的人设语气，不超过60字。
只输出这段发言本身，不要markdown、不要多余说明。`;
    let text = '（想不出该说什么...）';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        if (raw) text = raw.replace(/^["「]|["」]$/g, '').trim();
      }
    } catch (e) {}

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.discussions.push({ by: pid, text });
    game.discussIndex++;
    setGame(sessionId, game);
    renderWolfPanel(sessionId);
    await advanceDiscussion(sessionId);
  }

  function submitUserDiscussion(sessionId) {
    const input = document.getElementById('wolfDiscussInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { alert('说点什么吧～'); return; }
    let game = getGame(sessionId);
    if (!game || game.phase !== 'day_discuss' || game.discussOrder[game.discussIndex] !== 'user') return;

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game.discussions.push({ by: 'user', text });
    game.discussIndex++;
    setGame(sessionId, game);
    renderWolfPanel(sessionId);
    advanceDiscussion(sessionId);
  }
  window.__wolfSubmitDiscussion = submitUserDiscussion;

  // ---------- 白天投票放逐 ----------
  async function startDayVote(sessionId) {
    let game = getGame(sessionId);
    game.phase = 'day_vote';
    game.dayVotes = {};
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🗳️ 讨论结束，开始投票放逐！`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderWolfPanel(sessionId);

    const alive = game.players.filter(p => p.alive);
    for (const player of alive) {
      if (player.id === 'user') continue;
      await runAiDayVote(sessionId, player);
    }
    renderWolfPanel(sessionId);

    game = getGame(sessionId);
    const userPlayer = game.players.find(p => p.id === 'user');
    if (!userPlayer || !userPlayer.alive) { await resolveDayVote(sessionId); }
  }

  async function runAiDayVote(sessionId, player) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == player.id);
    const api = getApiConfig(true);
    const alive = game.players.filter(p => p.alive);
    const candidates = alive.filter(p => p.id !== player.id);
    if (candidates.length === 0) return;
    const discussText = game.discussions.map(d => `${playerName(game.players.find(p => p.id === d.by))}："${d.text}"`).join('；');
    const candidateNames = candidates.map(playerName).join('、');
    let roleContext = player.role === 'werewolf' ? `你的身份是狼人，投票时要避免票给同伴，尽量把票带向好人身上。` : `你的身份是${ROLE_LABEL[player.role]}，尽量投给你觉得最可疑的人。`;
    const prompt = `${buildBasePrompt(char, false, '')}
你在玩狼人杀。${roleContext}
本轮讨论内容：${discussText}
可以投票的对象：${candidateNames}
请选择一个你要投票放逐的对象。
只输出严格JSON，不要markdown代码块包裹：
{"vote": "你要投的那个人的名字，必须完全匹配上面列出的名字之一"}`;
    let voteTarget = null;
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed && parsed.vote) { const t = candidates.find(p => playerName(p) === parsed.vote); if (t) voteTarget = t.id; }
      }
    } catch (e) {}
    if (!voteTarget) voteTarget = candidates[Math.floor(Math.random() * candidates.length)].id;
    game = getGame(sessionId);
    game.dayVotes[player.id] = voteTarget;
    setGame(sessionId, game);
  }

  function submitUserDayVote(sessionId, targetId) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'day_vote') return;
    const me = game.players.find(p => p.id === 'user');
    if (!me || !me.alive) return;
    game.dayVotes.user = targetId;
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `【投票】放逐 ${playerName(game.players.find(p => p.id === targetId))}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();
    renderWolfPanel(sessionId);
    resolveDayVote(sessionId);
  }
  window.__wolfSubmitDayVote = submitUserDayVote;

  async function resolveDayVote(sessionId) {
    let game = getGame(sessionId);
    const alive = game.players.filter(p => p.alive);
    if (Object.keys(game.dayVotes).length < alive.length) return;

    const tally = {};
    Object.values(game.dayVotes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    let maxVotes = -1, top = [];
    for (const pid of Object.keys(tally)) {
      if (tally[pid] > maxVotes) { maxVotes = tally[pid]; top = [pid]; }
      else if (tally[pid] === maxVotes) top.push(pid);
    }
    const eliminatedId = top[Math.floor(Math.random() * top.length)];
    const eliminated = game.players.find(p => p.id === eliminatedId);
    eliminated.alive = false;

    const voteSummary = alive.map(p => {
      const votersFor = Object.keys(game.dayVotes).filter(voter => game.dayVotes[voter] === p.id).map(voter => playerName(game.players.find(x => x.id === voter)));
      return votersFor.length > 0 ? `${playerName(p)}(${votersFor.length}票)` : null;
    }).filter(Boolean).join('、');

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `票数统计：${voteSummary}。${playerName(eliminated)} 被放逐，TA的真实身份是「${ROLE_LABEL[eliminated.role]}」！`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    setGame(sessionId, game);
    renderWolfPanel(sessionId);

    const winCheck = checkWinCondition(game);
    if (winCheck) { await finishWerewolf(sessionId, winCheck); return; }

    game = getGame(sessionId);
    game.dayNum++;
    setGame(sessionId, game);
    await startNightPhase(sessionId);
  }

  // ---------- 结束游戏 ----------
  async function finishWerewolf(sessionId, winner) {
    let game = getGame(sessionId);
    game.status = 'finished';
    game.winner = winner;
    setGame(sessionId, game);

    const roleReveal = game.players.map(p => `${playerName(p)}(${ROLE_LABEL[p.role]}${p.alive ? '' : '·已死亡'})`).join('、');
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const sysText = winner === 'good' ? `🎉 好人阵营获胜！所有狼人都被找出来了。` : `😈 狼人阵营获胜！狼人数量已经追平或超过好人。`;
    globalChats[sessionId].push({ sender: 'system', text: `${sysText}\n身份公布：${roleReveal}`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderWolfPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();

    for (const p of game.players) {
      if (p.id === 'user') continue;
      const char = myCharacters.find(c => c.id == p.id);
      if (!char) continue;
      const isWolf = p.role === 'werewolf';
      const won = (isWolf && winner === 'werewolf') || (!isWolf && winner === 'good');
      const resultText = won ? `你的身份是${ROLE_LABEL[p.role]}，这局你的阵营赢了` : `你的身份是${ROLE_LABEL[p.role]}，这局你的阵营输了`;
      await askCharGameEndComment(char, sessionId, '狼人杀', resultText);
    }
  }

  // ---------- 样式 ----------
  const wolfStyle = document.createElement('style');
  wolfStyle.textContent = `
    .wolf-status { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px; }
    .wolf-role-box { text-align:center; background:var(--gy-game-box-bg); color:var(--gy-game-box-fg); padding:8px; border-radius:6px; margin-bottom:8px; font-size:13px; }
    .wolf-input { width:100%; box-sizing:border-box; padding:8px; border-radius:6px; border:1px solid #ccc; margin-top:4px; font-size:14px; }
    .wolf-action-btn { margin:3px; }
    .wolf-player-list { font-size:12px; color:#8b98a5; text-align:center; margin-bottom:6px; }
    .wolf-seer-log { font-size:12px; color:#f9a825; text-align:center; margin-top:6px; }
  `;
  document.head.appendChild(wolfStyle);

  function renderWolfPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('wolfBody');
    if (!el || !game) return;
    const me = game.players.find(p => p.id === 'user');
    const myRole = me ? me.role : null;
    const myAlive = me ? me.alive : false;
    const playerListHtml = game.players.map(p => `${playerName(p)}${p.alive ? '' : '（已死亡）'}`).join('、');

    let statusText, bodyHtml = '';
    let seerLogHtml = '';
    if (myRole === 'seer' && game.seerHistory && game.seerHistory.length > 0) {
      seerLogHtml = `<div class="wolf-seer-log">🔮 你的查验记录：${game.seerHistory.map(h => `${playerName(game.players.find(p => p.id === h.targetId))}=${h.result === 'werewolf' ? '狼人' : '好人'}`).join('，')}</div>`;
    }

    if (game.status === 'finished') {
      statusText = game.winner === 'good' ? '🎉 好人阵营获胜！' : '😈 狼人阵营获胜！';
      bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">可以点游戏图标重新开一局～</div>`;
    } else if (!myAlive) {
      statusText = `第${game.dayNum}天 - ${game.phase === 'night' ? '夜晚' : game.phase === 'day_discuss' ? '讨论中' : '投票中'}`;
      bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已经出局了，正在旁观剩下的对局...</div>`;
    } else if (game.phase === 'night') {
      statusText = `第${game.dayNum}天夜晚`;
      if (myRole === 'werewolf') {
        const voted = game.nightActions.werewolfVotes.user !== undefined;
        if (voted) {
          bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已经选好目标，等待天亮...</div>`;
        } else {
          const targets = goodAlive(game);
          const btns = targets.map(p => `<button class="btn-edit-small wolf-action-btn" onclick="window.__wolfSubmitWerewolfTarget('${sessionId}','${p.id}')">${escapeHtml(playerName(p))}</button>`).join('');
          bodyHtml = `<div style="text-align:center; font-size:13px; margin-bottom:6px;">🐺 选择今晚要杀的目标：</div><div style="text-align:center;">${btns}</div>`;
        }
      } else if (myRole === 'seer') {
        const checked = game.nightActions.seerTarget !== null;
        if (checked) {
          bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已经查验过了，等待天亮...</div>`;
        } else {
          const targets = game.players.filter(p => p.alive && p.id !== 'user');
          const btns = targets.map(p => `<button class="btn-edit-small wolf-action-btn" onclick="window.__wolfSubmitSeerCheck('${sessionId}','${p.id}')">${escapeHtml(playerName(p))}</button>`).join('');
          bodyHtml = `<div style="text-align:center; font-size:13px; margin-bottom:6px;">🔮 选择今晚要查验的目标：</div><div style="text-align:center;">${btns}</div>`;
        }
      } else {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">天黑请闭眼，等待天亮...</div>`;
      }
    } else if (game.phase === 'day_discuss') {
      const currentTurnId = game.discussOrder && game.discussOrder.length > 0 ? game.discussOrder[game.discussIndex] : null;
      const currentTurnPlayer = currentTurnId ? game.players.find(p => p.id === currentTurnId) : null;
      statusText = `第${game.dayNum}天白天讨论中`;
      if (!currentTurnPlayer) {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">准备中...</div>`;
      } else if (currentTurnId === 'user') {
        bodyHtml = `<div style="text-align:center; font-size:13px; color:#f91880; margin-bottom:6px;">轮到你发言了！</div>
          <textarea class="wolf-input" id="wolfDiscussInput" rows="2" placeholder="说说你的看法..."></textarea>
          <div style="text-align:center; margin-top:6px;"><button class="btn-edit-small" onclick="window.__wolfSubmitDiscussion('${sessionId}')">发言</button></div>`;
      } else {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">等待${escapeHtml(playerName(currentTurnPlayer))}发言...</div>`;
      }
    } else if (game.phase === 'day_vote') {
      const voted = game.dayVotes.user !== undefined;
      statusText = `第${game.dayNum}天投票中`;
      if (voted) {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已投票，等待结果...</div>`;
      } else {
        const candidates = game.players.filter(p => p.alive && p.id !== 'user');
        const btns = candidates.map(p => `<button class="btn-edit-small wolf-action-btn" onclick="window.__wolfSubmitDayVote('${sessionId}','${p.id}')">${escapeHtml(playerName(p))}</button>`).join('');
        bodyHtml = `<div style="text-align:center; font-size:13px; margin-bottom:6px;">投票放逐谁？</div><div style="text-align:center;">${btns}</div>`;
      }
    }

    el.innerHTML = `
      <div class="wolf-status">${escapeHtml(statusText)}</div>
      ${me ? `<div class="wolf-role-box">你的身份是：<b>${ROLE_LABEL[myRole] || '未知'}</b>${myAlive ? '' : '（已出局）'}</div>` : ''}
      ${seerLogHtml}
      <div class="wolf-player-list">玩家：${escapeHtml(playerListHtml)}</div>
      ${bodyHtml}
      <div style="display:flex; justify-content:center; gap:10px; margin-top:14px;">
        <button class="btn-edit-small" onclick="document.getElementById('wolfFloatPanel').style.display='none'">收起（继续聊天）</button>
      </div>`;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'simplified_werewolf',
      name: '狼人杀',
      icon: '🐺',
      minOpponents: 3,
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openWolfPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startWerewolf(sessionId, opponentCharIds); }
    });
  } else {
    console.error('狼人杀插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ 谁是卧底 ============
(function () {
  if (window.__undercoverPluginInstalled) return;
  window.__undercoverPluginInstalled = true;

  const STORE_KEY = 'undercoverGamesV1';
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveStore(obj) { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }
  function getGame(sessionId) { return loadStore()[sessionId] || null; }
  function setGame(sessionId, game) {
    const all = loadStore();
    if (game) all[sessionId] = game; else delete all[sessionId];
    saveStore(all);
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function playerName(p) { if (p.id === 'user') return (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '你'; const c = myCharacters.find(x => x.id == p.id); return c ? c.name : '未知'; }

  // ---------- 开局：生成词对、分配身份 ----------
  async function startUndercover(sessionId, opponentCharIds) {
    const chars = (opponentCharIds || []).map(id => myCharacters.find(c => c.id == id)).filter(Boolean);
    if (chars.length < 2) { alert('谁是卧底至少需要2个角色一起玩，去群聊里凑够人数吧～'); return; }

    const api = getApiConfig(true);
    const wordPrompt = `请给"谁是卧底"这个游戏生成一对适合的词语：两个词要属于同一类别、有一定相似性，但又有明确区别，让大多数人拿到词A、少数人（卧底）拿到词B时，双方在描述时既可能蒙混过关也可能被识破（比如"苹果/梨"、"篮球/排球"、"老师/医生"这样的难度，但请自己想一对新的，不要直接用这几个例子）。
只输出严格JSON，不要markdown代码块包裹：
{"wordA": "多数人的词", "wordB": "卧底的词"}`;
    // 模型请求失败时才从这里随机抽一对（原来固定是苹果/梨，断网时每局都一样）
    const FALLBACK_PAIRS = [['苹果', '梨'], ['篮球', '排球'], ['老师', '医生'], ['饺子', '包子'], ['咖啡', '奶茶'], ['猫', '狐狸'], ['口红', '唇膏'], ['地铁', '公交'], ['电影院', '剧场'], ['月饼', '汤圆'], ['钢琴', '电子琴'], ['雨伞', '雨衣']];
    let [wordA, wordB] = FALLBACK_PAIRS[Math.floor(Math.random() * FALLBACK_PAIRS.length)];
    try {
      const data = await callChatCompletionAPI(api, wordPrompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed && parsed.wordA && parsed.wordB) { wordA = parsed.wordA; wordB = parsed.wordB; }
      }
    } catch (e) {}

    const allIds = ['user', ...chars.map(c => c.id)];
    const undercoverId = allIds[Math.floor(Math.random() * allIds.length)];
    const players = allIds.map(id => ({ id, name: id === 'user' ? '你' : (myCharacters.find(c => c.id == id) || {}).name, word: id === undercoverId ? wordB : wordA, role: id === undercoverId ? 'undercover' : 'majority', alive: true }));

    const game = { status: 'playing', players, round: 1, phase: 'clue', clueOrder: [], clueIndex: 0, clues: [], votes: {}, winner: null };
    setGame(sessionId, game);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🕵️ 谁是卧底开始！${players.length}位玩家（${players.map(playerName).join('、')}）各自拿到了一个词，其中混入了1名卧底。轮流用一句话描述自己的词（不能直接说出这个词），然后投票揪出卧底！`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openUcPanel(sessionId);
    await startClueRound(sessionId);
  }

  function openUcPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('ucFloatPanel', '🕵️ 谁是卧底');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('ucBody')) body.innerHTML = `<div id="ucBody" style="max-width:320px;"></div>`;
    renderUcPanel(sessionId);
  }

  // ---------- 描述回合 ----------
  async function startClueRound(sessionId) {
    let game = getGame(sessionId);
    const alive = game.players.filter(p => p.alive);
    game.clueOrder = shuffle(alive.map(p => p.id));
    game.clueIndex = 0;
    game.clues = [];
    game.phase = 'clue';
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `📢 第${game.round}轮描述开始，顺序：${game.clueOrder.map(id => playerName(game.players.find(p => p.id === id))).join(' → ')}`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    await advanceClue(sessionId);
  }

  async function advanceClue(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    if (game.clueIndex >= game.clueOrder.length) { await startVotingRound(sessionId); return; }

    const pid = game.clueOrder[game.clueIndex];
    if (pid === 'user') { renderUcPanel(sessionId); return; }

    const player = game.players.find(p => p.id === pid);
    const char = myCharacters.find(c => c.id == pid);
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const cluesSoFar = game.clues.length > 0 ? game.clues.map(c => `${playerName(game.players.find(p => p.id === c.by))}："${c.text}"`).join('；') : '（还没有人描述）';
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和其他人玩"谁是卧底"。你拿到的词是："${player.word}"（绝对不能直接说出这个词本身，也不要说出明显的谐音）。
到目前为止其他人的描述：${cluesSoFar}
请你用一句话描述你拿到的这个词的特征（不能说出词本身），要尽量贴合词义又不要过于直白暴露，也可以参考别人的描述风格来判断该更靠拢一致还是需要谨慎（如果你怀疑自己可能是卧底，可以适当模糊/跟随大家的描述方向）。
只输出这句描述本身，不要markdown、不要多余说明，不超过30字。`;
    let clueText = '（想不出该怎么形容...）';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        if (raw) clueText = raw.replace(/^["「]|["」]$/g, '').trim();
      }
    } catch (e) {}

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: clueText, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.clues.push({ by: pid, text: clueText });
    game.clueIndex++;
    setGame(sessionId, game);
    renderUcPanel(sessionId);
    await advanceClue(sessionId);
  }

  function submitUserClue(sessionId) {
    const input = document.getElementById('ucClueInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { alert('描述点什么吧～'); return; }
    let game = getGame(sessionId);
    if (!game || game.phase !== 'clue' || game.clueOrder[game.clueIndex] !== 'user') return;

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game.clues.push({ by: 'user', text });
    game.clueIndex++;
    setGame(sessionId, game);
    renderUcPanel(sessionId);
    advanceClue(sessionId);
  }
  window.__ucSubmitClue = submitUserClue;

  // ---------- 投票回合 ----------
  async function startVotingRound(sessionId) {
    let game = getGame(sessionId);
    game.phase = 'voting';
    game.votes = {};
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🗳️ 描述完毕，开始投票！请大家选出你认为最可疑的卧底。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderUcPanel(sessionId);

    // AI玩家先各自投票（同时进行，不受用户投票影响）
    const alive = game.players.filter(p => p.alive);
    for (const player of alive) {
      if (player.id === 'user') continue;
      const char = myCharacters.find(c => c.id == player.id);
      const api = getApiConfig(true);
      const cluesText = game.clues.map(c => `${playerName(game.players.find(p => p.id === c.by))}："${c.text}"`).join('；');
      const candidateNames = alive.filter(p => p.id !== player.id).map(p => playerName(p)).join('、');
      const prompt = `${buildBasePrompt(char, false, '')}
你在和其他人玩"谁是卧底"。你自己拿到的词是："${player.word}"，你的身份是${player.role === 'undercover' ? '卧底（你要尽量伪装，把怀疑引向别人）' : '普通人（你要通过大家的描述找出那个格格不入的卧底）'}。
本轮所有人的描述是：${cluesText}
可以投票怀疑的对象（不包括你自己）：${candidateNames}
请从这些人里选一个你要投票怀疑的对象。
只输出严格JSON，不要markdown代码块包裹：
{"vote": "你要投的那个人的名字，必须完全匹配上面列出的名字之一"}`;
      let voteTarget = null;
      try {
        const data = await callChatCompletionAPI(api, prompt);
        if (!data.error) {
          const raw = (data.choices?.[0]?.message?.content || '').trim();
          const parsed = extractJsonObject(raw);
          if (parsed && parsed.vote) {
            const target = alive.find(p => p.id !== player.id && playerName(p) === parsed.vote);
            if (target) voteTarget = target.id;
          }
        }
      } catch (e) {}
      if (!voteTarget) {
        const others = alive.filter(p => p.id !== player.id);
        voteTarget = others[Math.floor(Math.random() * others.length)].id;
      }
      game = getGame(sessionId);
      game.votes[player.id] = voteTarget;
      setGame(sessionId, game);
    }
    renderUcPanel(sessionId);

    // 如果用户自己已经出局，不需要等用户投票，AI票投完就直接结算
    const userPlayer = game.players.find(p => p.id === 'user');
    if (!userPlayer || !userPlayer.alive) { await resolveVotes(sessionId); }
  }

  function submitUserVote(sessionId, targetId) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'voting') return;
    const userPlayer = game.players.find(p => p.id === 'user');
    if (!userPlayer || !userPlayer.alive) return; // 已出局的话不能投票
    game.votes.user = targetId;
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `【投票】怀疑 ${playerName(game.players.find(p => p.id === targetId))}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();
    renderUcPanel(sessionId);
    resolveVotes(sessionId);
  }
  window.__ucSubmitVote = submitUserVote;

  async function resolveVotes(sessionId) {
    let game = getGame(sessionId);
    const alive = game.players.filter(p => p.alive);
    if (Object.keys(game.votes).length < alive.length) return; // 还没投完（理论上AI都已投完，只等用户）

    const tally = {};
    Object.values(game.votes).forEach(t => { tally[t] = (tally[t] || 0) + 1; });
    let maxVotes = -1, topCandidates = [];
    for (const pid of Object.keys(tally)) {
      if (tally[pid] > maxVotes) { maxVotes = tally[pid]; topCandidates = [pid]; }
      else if (tally[pid] === maxVotes) topCandidates.push(pid);
    }
    const eliminatedId = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    const eliminated = game.players.find(p => p.id === eliminatedId);
    eliminated.alive = false;

    const voteSummary = game.players.filter(p => p.alive || p.id === eliminatedId).map(p => {
      const votersFor = Object.keys(game.votes).filter(voter => game.votes[voter] === p.id).map(voter => playerName(game.players.find(x => x.id === voter)));
      return votersFor.length > 0 ? `${playerName(p)}(${votersFor.length}票)` : null;
    }).filter(Boolean).join('、');

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `票数统计：${voteSummary}。${playerName(eliminated)} 被投票出局，TA的身份是${eliminated.role === 'undercover' ? '卧底！' : `普通人（词是"${eliminated.word}"）`}`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    setGame(sessionId, game);
    renderUcPanel(sessionId);

    if (eliminated.role === 'undercover') { await finishUndercover(sessionId, 'majority'); return; }

    const remaining = game.players.filter(p => p.alive);
    if (remaining.length <= 2) { await finishUndercover(sessionId, 'undercover'); return; }

    game = getGame(sessionId);
    game.round++;
    setGame(sessionId, game);
    await startClueRound(sessionId);
  }

  // ---------- 结束游戏 ----------
  async function finishUndercover(sessionId, outcome) {
    let game = getGame(sessionId);
    game.status = 'finished';
    game.winner = outcome;
    setGame(sessionId, game);

    const undercoverPlayer = game.players.find(p => p.role === 'undercover');
    const majorityWord = game.players.find(p => p.role === 'majority').word;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const sysText = outcome === 'majority'
      ? `🎉 好人阵营获胜！卧底 ${playerName(undercoverPlayer)} 被找出来了。多数人的词是"${majorityWord}"，卧底的词是"${undercoverPlayer.word}"。`
      : `😈 卧底获胜！${playerName(undercoverPlayer)} 一直伪装到了最后。多数人的词是"${majorityWord}"，卧底的词是"${undercoverPlayer.word}"。`;
    globalChats[sessionId].push({ sender: 'system', text: sysText, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderUcPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();

    for (const p of game.players) {
      if (p.id === 'user') continue;
      const char = myCharacters.find(c => c.id == p.id);
      if (!char) continue;
      const won = (p.role === 'undercover') === (outcome === 'undercover');
      const resultText = won ? `你是${p.role === 'undercover' ? '卧底' : '好人'}，这局赢了` : `你是${p.role === 'undercover' ? '卧底' : '好人'}，这局输了`;
      await askCharGameEndComment(char, sessionId, '谁是卧底', resultText);
    }
  }

  // ---------- 样式 ----------
  const ucStyle = document.createElement('style');
  ucStyle.textContent = `
    .uc-status { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px; }
    .uc-word-box { text-align:center; background:var(--gy-game-box-bg); color:var(--gy-game-box-fg); padding:8px; border-radius:6px; margin-bottom:8px; font-size:13px; }
    .uc-input { width:100%; box-sizing:border-box; padding:8px; border-radius:6px; border:1px solid #ccc; margin-top:4px; font-size:14px; }
    .uc-vote-btn { margin:3px; }
    .uc-player-list { font-size:12px; color:#8b98a5; text-align:center; margin-bottom:6px; }
  `;
  document.head.appendChild(ucStyle);

  function renderUcPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('ucBody');
    if (!el || !game) return;

    const alivePlayers = game.players.filter(p => p.alive);
    const playerListHtml = game.players.map(p => `${playerName(p)}${p.alive ? '' : '（已出局）'}`).join('、');
    const myWord = (game.players.find(p => p.id === 'user') || {}).word || '';

    let statusText, bodyHtml = '';
    if (game.status === 'finished') {
      statusText = game.winner === 'majority' ? '🎉 好人阵营获胜！' : '😈 卧底获胜！';
      bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">可以点游戏图标重新开一局～</div>`;
    } else if (game.phase === 'clue') {
      const currentTurnId = game.clueOrder && game.clueOrder.length > 0 ? game.clueOrder[game.clueIndex] : null;
      const currentTurnPlayer = currentTurnId ? game.players.find(p => p.id === currentTurnId) : null;
      const isUserTurn = currentTurnId === 'user';
      statusText = `第${game.round}轮描述中`;
      if (!currentTurnPlayer) {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">准备中...</div>`;
      } else {
        bodyHtml = isUserTurn
          ? `<div style="text-align:center; font-size:13px; color:#f91880; margin-bottom:6px;">轮到你描述了！</div>
             <input type="text" class="uc-input" id="ucClueInput" placeholder="用一句话描述你的词（别说出来）" onkeypress="if(event.key==='Enter') window.__ucSubmitClue('${sessionId}')">
             <div style="text-align:center; margin-top:6px;"><button class="btn-edit-small" onclick="window.__ucSubmitClue('${sessionId}')">发送描述</button></div>`
          : `<div style="text-align:center; color:#8b98a5; font-size:13px;">等待${playerName(currentTurnPlayer)}描述...</div>`;
      }
    } else if (game.phase === 'voting') {
      const userAlive = (game.players.find(p => p.id === 'user') || {}).alive;
      const userVoted = game.votes.user !== undefined;
      statusText = `第${game.round}轮投票中`;
      if (!userAlive) {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已出局，正在旁观其他人投票...</div>`;
      } else if (userVoted) {
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">你已投票，等待结果...</div>`;
      } else {
        const candidates = alivePlayers.filter(p => p.id !== 'user');
        const btns = candidates.map(p => `<button class="btn-edit-small uc-vote-btn" onclick="window.__ucSubmitVote('${sessionId}','${p.id}')">${escapeHtml(playerName(p))}</button>`).join('');
        bodyHtml = `<div style="text-align:center; font-size:13px; margin-bottom:6px;">你怀疑谁是卧底？</div><div style="text-align:center;">${btns}</div>`;
      }
    }

    el.innerHTML = `
      <div class="uc-status">${escapeHtml(statusText)}</div>
      <div class="uc-word-box">你的词是：<b>${escapeHtml(myWord)}</b></div>
      <div class="uc-player-list">玩家：${escapeHtml(playerListHtml)}</div>
      ${bodyHtml}
      <div style="display:flex; justify-content:center; gap:10px; margin-top:14px;">
        <button class="btn-edit-small" onclick="document.getElementById('ucFloatPanel').style.display='none'">收起（继续聊天）</button>
      </div>`;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'who_is_undercover',
      name: '谁是卧底',
      icon: '🕵️',
      minOpponents: 2,
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openUcPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startUndercover(sessionId, opponentCharIds); }
    });
  } else {
    console.error('谁是卧底插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ 小游戏收藏夹（20个问题 / 真心话大冒险 共用）============
// 玩的时候碰到喜欢的问题、回答、真心话题目，点旁边的 ☆ 就存进来。
// 存在 localStorage 里单独一个 key（跟对局一样不进主存档：收藏的是几句话，丢了也不心疼，
// 但也不想为了它去改存档结构）。两个游戏共用一个库，用 game 字段区分，面板里各看各的。
(function () {
  if (window.gyGameFav) return;
  const FAV_KEY = 'gyGameFavoritesV1';
  function load() { try { const a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch (e) { alert('收藏没存上：' + e.message); } }
  const norm = s => String(s || '').trim();
  const api = {
    list(game) { return load().filter(f => !game || f.game === game); },
    has(game, text) { const t = norm(text); return load().some(f => f.game === game && norm(f.text) === t); },
    // 同一句话重复点 ☆ 不重复存；再点一次（已经是 ★）就是取消收藏
    toggle(item) {
      const list = load(); const t = norm(item.text);
      const i = list.findIndex(f => f.game === item.game && norm(f.text) === t);
      if (i >= 0) { list.splice(i, 1); save(list); return false; }
      list.unshift({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), game: item.game, kind: item.kind || '', from: item.from || '', text: t, ts: Date.now() });
      save(list); return true;
    },
    add(item) { if (!api.has(item.game, item.text)) api.toggle(item); },
    update(id, text) { const list = load(); const f = list.find(x => x.id === id); if (f) { f.text = norm(text); save(list); } },
    remove(id) { save(load().filter(f => f.id !== id)); },
  };
  window.gyGameFav = api;

  // 一个小 ☆ 按钮的 HTML：文本放在 data 属性里，点的时候再取，省得在 onclick 里拼字符串转义两层
  api.starHtml = function (game, kind, from, text) {
    const on = api.has(game, text);
    return `<span class="gy-fav-star${on ? ' on' : ''}" title="${on ? '取消收藏' : '收藏这句'}" data-game="${escapeAttr(game)}" data-kind="${escapeAttr(kind || '')}" data-from="${escapeAttr(from || '')}" data-text="${escapeAttr(text)}" onclick="window.__gyFavStar(this, event)">${on ? '★' : '☆'}</span>`;
  };
  window.__gyFavStar = function (el, ev) {
    if (ev) ev.stopPropagation();
    const on = api.toggle({ game: el.dataset.game, kind: el.dataset.kind, from: el.dataset.from, text: el.dataset.text });
    el.classList.toggle('on', on); el.textContent = on ? '★' : '☆'; el.title = on ? '取消收藏' : '收藏这句';
  };

  // 收藏列表画进某个容器里。ctx: { game, onBack(), onUse(text)? }
  // 用一个表按容器 id 记住 ctx，onclick 里只传容器 id 和收藏 id
  const CTX = {};
  const KIND_LABEL = { question: '问题', answer: '回答', guess: '猜测', truth: '真心话', dare: '大冒险', reply: '回应' };
  api.renderInto = function (boxId, ctx) {
    if (ctx) CTX[boxId] = ctx; else ctx = CTX[boxId];
    const el = document.getElementById(boxId);
    if (!el || !ctx) return;
    const list = api.list(ctx.game);
    const rows = list.map(f => `
      <div class="gy-fav-row" data-id="${escapeAttr(f.id)}">
        <div class="gy-fav-text">${escapeHtml(f.text)}</div>
        <div class="gy-fav-meta">${escapeHtml(KIND_LABEL[f.kind] || f.kind || '')}${f.from ? ' · ' + escapeHtml(f.from) : ''}</div>
        <div class="gy-fav-ops">
          ${ctx.onUse ? `<button class="btn-edit-small" onclick="window.__gyFavOp('${boxId}','use','${escapeAttr(f.id)}')">用这句</button>` : ''}
          <button class="btn-edit-small" onclick="window.__gyFavOp('${boxId}','edit','${escapeAttr(f.id)}')">编辑</button>
          <button class="btn-edit-small" style="color:#f91880; border-color:#f91880;" onclick="window.__gyFavOp('${boxId}','del','${escapeAttr(f.id)}')">删除</button>
        </div>
      </div>`).join('');
    el.innerHTML = `
      <div class="tq-status">⭐ 收藏（${list.length}）</div>
      <div class="gy-fav-list">${rows || '<div style="text-align:center; color:#8b98a5; font-size:13px; padding:10px 0;">还没有收藏。玩的时候点问答旁边的 ☆ 就能存进来～</div>'}</div>
      <div class="tq-section">
        <textarea class="tq-input" id="${boxId}_new" rows="2" placeholder="也可以手动写一句存进来"></textarea>
        <div style="text-align:center; margin-top:6px;"><button class="btn-edit-small" onclick="window.__gyFavOp('${boxId}','add')">＋ 存进收藏</button></div>
      </div>
      <div style="text-align:center; margin-top:10px;"><button class="btn-edit-small" onclick="window.__gyFavOp('${boxId}','back')">← 返回游戏</button></div>`;
  };
  window.__gyFavOp = function (boxId, op, id) {
    const ctx = CTX[boxId]; if (!ctx) return;
    const f = id ? api.list().find(x => x.id === id) : null;
    if (op === 'back') { ctx.onBack && ctx.onBack(); return; }
    if (op === 'use' && f) { ctx.onUse && ctx.onUse(f.text); return; }
    if (op === 'del' && f) { api.remove(id); api.renderInto(boxId); return; }
    if (op === 'add') {
      const ta = document.getElementById(boxId + '_new'); const t = ta ? ta.value.trim() : '';
      if (!t) return;
      api.add({ game: ctx.game, kind: '', from: '手动', text: t }); api.renderInto(boxId); return;
    }
    if (op === 'edit' && f) {
      // 原地变成输入框，不弹 prompt（手机上系统 prompt 太小，长句子改不动）
      const row = document.querySelector(`#${boxId} .gy-fav-row[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.innerHTML = `<textarea class="tq-input" rows="3">${escapeHtml(f.text)}</textarea>
        <div class="gy-fav-ops"><button class="btn-edit-small" onclick="window.__gyFavOp('${boxId}','save','${escapeAttr(id)}')">保存</button>
        <button class="btn-edit-small" onclick="window.__gyGameFavRerender('${boxId}')">取消</button></div>`;
      return;
    }
    if (op === 'save' && f) {
      const row = document.querySelector(`#${boxId} .gy-fav-row[data-id="${CSS.escape(id)}"]`);
      const ta = row && row.querySelector('textarea');
      const t = ta ? ta.value.trim() : '';
      if (t) api.update(id, t); else api.remove(id);   // 改成空的就当删了
      api.renderInto(boxId);
    }
  };
  window.__gyGameFavRerender = boxId => api.renderInto(boxId);

  const st = document.createElement('style');
  st.id = 'gyGameFavCss';
  st.textContent = `
    .gy-fav-star { cursor:pointer; color:#b0b8c1; margin-left:4px; font-size:14px; user-select:none; flex-shrink:0; }
    .gy-fav-star.on { color:#ffad1f; }
    .gy-fav-star:hover { color:#ffad1f; }
    .gy-fav-list { max-height:50vh; overflow-y:auto; }
    .gy-fav-row { padding:8px 0; border-bottom:1px dashed #e1e8ed; }
    .gy-fav-text { font-size:14px; white-space:pre-wrap; word-break:break-word; }
    .gy-fav-meta { font-size:11px; color:#8b98a5; margin-top:2px; }
    .gy-fav-ops { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .gy-fav-ops .btn-edit-small { margin:0; padding:3px 8px; font-size:12px; }
  `;
  document.head.appendChild(st);
})();

// ============ 20个问题（其实不限 20 个，也能反过来让角色猜）============
// 两种玩法：
//   · 我来猜：角色心里想一个东西，你问是非题 / 直接猜（原来的玩法）
//   · TA来猜：你心里想一个东西，角色按自己的人设一题一题问你，你答 是/不是/不确定/猜对了
// 题数开局时自己定：填几都行，也可以勾「不限」一直问到猜中为止。
// 问题一律现场让模型生成（角色问的、"帮我想一题"的都是），不再有固定题库；
// 下面那几句固定的只是断网/接口挂了时的兜底，免得游戏卡死。
(function () {
  if (window.__twentyQPluginInstalled) return;
  window.__twentyQPluginInstalled = true;

  /* 🎲 跟狼人杀一样：让角色开口的 prompt 都算「game」那一场 */
  const buildBasePrompt = function () {
    const a = arguments;
    if (typeof window.gyInjectInScene === 'function' && typeof window.buildBasePrompt === 'function')
      return window.gyInjectInScene('game', () => window.buildBasePrompt.apply(null, a));
    return window.buildBasePrompt ? window.buildBasePrompt.apply(null, a) : '';
  };

  const STORE_KEY = 'twentyQGamesV1';
  const PREF_KEY = 'twentyQPrefsV1';   // 记住上次选的玩法和题数，下次开局不用重选
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveStore(obj) { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }
  function getGame(sessionId) {
    const g = loadStore()[sessionId] || null;
    // 老版本存下来的对局没有这几个字段——当成"我来猜"、已经在玩
    if (g) { if (!g.phase) g.phase = 'play'; if (!g.mode) g.mode = 'char_thinks'; if (!Array.isArray(g.log)) g.log = []; }
    return g;
  }
  function setGame(sessionId, game) {
    const all = loadStore();
    if (game) all[sessionId] = game; else delete all[sessionId];
    saveStore(all);
  }
  function loadPrefs() { try { return Object.assign({ mode: 'char_thinks', max: 20, unlimited: false }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { return { mode: 'char_thinks', max: 20, unlimited: false }; } }
  function savePrefs(p) { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} }
  // "正在等模型回话"只记在内存里：存进 localStorage 的话，刷新页面时请求断了，
  // 这个标记却永远留着，面板就一直显示"正在想..."卡死
  const BUSY = {};
  window.__tqGetGame = getGame; window.__tqSetGame = setGame;   // 给测试和别的模块看状态用

  // 兜底：只有模型请求失败时才用
  const FALLBACK_SECRETS = ['苹果', '大象', '雨伞', '月亮', '钢琴', '饺子', '长颈鹿', '手机', '图书馆', '向日葵', '自行车', '企鹅', '蛋糕', '灯塔', '吉他'];
  const FALLBACK_QUESTIONS = ['它是活的吗？', '它比一个书包大吗？', '家里一般能找到它吗？', '它能吃吗？', '它是人造的吗？', '它会动吗？', '它和电有关吗？', '它通常在户外吗？', '小孩子会喜欢它吗？', '它是圆的吗？', '它能拿在手里吗？', '它有颜色上的明显特征吗？', '它和水有关吗？', '它会发出声音吗？', '它很贵吗？', '它和节日有关吗？'];

  const charOf = game => myCharacters.find(c => c.id == game.opponentCharId);
  const charNameOf = game => { const c = charOf(game); return c ? c.name : '对方'; };
  const isUnlimited = game => !(game.maxQuestions > 0);
  const remainingOf = game => isUnlimited(game) ? Infinity : (game.maxQuestions - game.questionsUsed);
  function pushChat(sessionId, sender, text) {
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const m = { sender, text, timestamp: Date.now() };
    if (sender !== 'system') m.readBy = [];
    globalChats[sessionId].push(m);
  }
  function stripFence(s) { return String(s || '').trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim(); }
  async function askJson(prompt) {
    try {
      const data = await callChatCompletionAPI(getApiConfig(true), prompt);
      if (data && !data.error) return extractJsonObject((data.choices?.[0]?.message?.content || '').trim());
    } catch (e) {}
    return null;
  }
  // 本局问答写成给模型看的一段文字
  function qaTranscript(game) {
    const out = []; let n = 0;
    (game.log || []).forEach((l, i) => {
      if (l.kind === 'question' || l.kind === 'guess') {
        n++;
        const ans = (game.log[i + 1] && game.log[i + 1].kind === 'answer') ? game.log[i + 1].text : '（还没回答）';
        out.push(`${n}. ${l.kind === 'guess' ? '猜' : '问'}：${l.text} → 答：${ans}`);
      }
    });
    return out.join('\n');
  }

  // ---------- 开局：先在面板里选玩法和题数 ----------
  // 邀请被接受后不马上开，停在 setup 这一步；status 仍记成 playing，
  // 这样点 🎮 会回到这局（框架只认 playing/finished），不会又弹一遍选游戏
  function startTwentyQuestions(sessionId, opponentCharId) {
    setGame(sessionId, { status: 'playing', phase: 'setup', opponentCharId, log: [], questionsUsed: 0 });
    openTqPanel(sessionId);
  }

  async function beginRound(sessionId) {
    let game = getGame(sessionId);
    if (!game) return;
    const mode = (document.querySelector('input[name="tqMode"]:checked') || {}).value || 'char_thinks';
    const unlimited = !!(document.getElementById('tqUnlimited') || {}).checked;
    const maxRaw = parseInt((document.getElementById('tqMaxInput') || {}).value, 10);
    const max = unlimited ? 0 : (maxRaw > 0 ? maxRaw : 20);
    const scope = ((document.getElementById('tqScopeInput') || {}).value || '').trim();
    const userSecret = ((document.getElementById('tqUserSecretInput') || {}).value || '').trim();
    savePrefs({ mode, max: max || 20, unlimited });

    const char = charOf(game);
    Object.assign(game, { phase: 'play', mode, maxQuestions: max, questionsUsed: 0, log: [], winner: null, secret: '', category: scope, userSecret, pending: null });
    BUSY[sessionId] = true;
    setGame(sessionId, game);
    renderTqPanel(sessionId);
    const countText = max ? `${max}次机会` : '不限次数';

    if (mode === 'user_thinks') {
      pushChat(sessionId, 'system', `🔮 猜谜问答开始！这次由你心里想一个东西，${char ? char.name : '对方'}来问是非题猜（${countText}）${scope ? `，范围：${scope}` : ''}。`);
      renderChatMessages(); saveAllData();
      await charAskNext(sessionId);
      return;
    }

    // 我来猜：角色想答案
    const prompt = `${buildBasePrompt(char, false, '')}
你要和用户玩"20个问题"猜谜游戏。请你自己想一个具体的东西作为这局游戏的秘密答案（可以是动物、物品、食物、地点、人物、概念等，尽量明确具体，比如"大象"而不是"动物"；可以带点你自己的喜好和生活，但别老是想同一类东西）。${scope ? `\n用户希望答案在这个范围里：${scope}` : ''}
只输出严格JSON，不要markdown代码块包裹：
{"secret": "具体的答案", "category": "这个答案所属的大类，比如\\"动物\\"", "message": "你想好之后说的一句话，符合人设语气，绝对不能透露具体答案是什么"}`;
    const parsed = await askJson(prompt);
    let secret = FALLBACK_SECRETS[Math.floor(Math.random() * FALLBACK_SECRETS.length)], category = scope, message = '';
    if (parsed && parsed.secret) { secret = String(parsed.secret).trim(); category = parsed.category || scope; message = parsed.message || ''; }
    game = getGame(sessionId);
    Object.assign(game, { secret, category });
    BUSY[sessionId] = false;
    setGame(sessionId, game);
    pushChat(sessionId, 'system', `🔮 猜谜问答开始！${char ? char.name : '对方'}心里想好了一个答案${category ? `（大类：${category}）` : ''}，你有${countText}，可以问是非题或直接猜。`);
    if (message && char) pushChat(sessionId, char.id, message);
    renderChatMessages(); saveAllData();
    renderTqPanel(sessionId);
  }
  window.__tqBegin = beginRound;

  function openTqPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('tqFloatPanel', '🔮 20个问题');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('tqBody')) body.innerHTML = `<div id="tqBody" style="min-width:260px;"></div>`;
    renderTqPanel(sessionId);
  }

  // ================= 玩法一：我来猜 =================
  async function submitTqQuestion(sessionId) {
    const input = document.getElementById('tqQuestionInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { alert('写点什么问题吧～'); return; }
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.phase !== 'play' || BUSY[sessionId]) return;
    const char = charOf(game);

    pushChat(sessionId, 'me', `【提问】${text}`);
    renderChatMessages(); saveAllData();
    input.value = '';
    game.questionsUsed++;
    game.log.push({ who: 'user', kind: 'question', text });
    BUSY[sessionId] = true;
    setGame(sessionId, game);
    renderTqPanel(sessionId);

    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩"20个问题"猜谜游戏。你心里的秘密答案是："${game.secret}"（这是只有你自己知道的秘密，绝对不能直接说出这个答案，只能如实回答用户的是非题）。
${game.log.length > 1 ? `之前的问答：\n${qaTranscript(Object.assign({}, game, { log: game.log.slice(0, -1) }))}\n` : ''}用户刚才问了："${text}"
请诚实、准确地回答这个问题是不是符合你的秘密答案"${game.secret}"的真实情况。回答只能是"是"、"不是"、"不一定/无法简单回答"这三种之一，可以在后面附一句符合人设语气的俏皮话或反应，但绝对不能透露具体答案。
只输出严格JSON，不要markdown代码块包裹：
{"answer": "是/不是/不一定", "message": "你的完整回复，包含答案判断和你的反应"}`;
    const parsed = await askJson(prompt);
    let reply = '不一定～';
    if (parsed && parsed.message) reply = parsed.message;
    else if (parsed && parsed.answer) reply = parsed.answer;

    if (char) pushChat(sessionId, char.id, reply);
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.log.push({ who: 'char', kind: 'answer', text: reply });
    BUSY[sessionId] = false;
    setGame(sessionId, game);
    if (remainingOf(game) <= 0) { await finishTwentyQuestions(sessionId, 'char'); return; }
    renderTqPanel(sessionId);
  }
  window.__tqSubmitQuestion = submitTqQuestion;

  // 🎲 帮我想一题：不带秘密答案、不带人设，只看问过什么，给个能缩小范围的好问题
  async function suggestQuestion(sessionId) {
    const game = getGame(sessionId);
    const input = document.getElementById('tqQuestionInput');
    if (!game || !input) return;
    const btn = document.getElementById('tqSuggestBtn'); if (btn) { btn.disabled = true; btn.textContent = '想题中...'; }
    const prompt = `你在帮用户玩"20个问题"猜谜：对方心里想了一个东西${game.category ? `（大类：${game.category}）` : ''}，用户通过是非题来猜。
${game.log.length ? `目前的问答：\n${qaTranscript(game)}\n` : '还一个问题都没问。\n'}请给用户建议下一个最能缩小范围的是非题（不能和问过的重复，要能用"是/不是"回答）。
只输出严格JSON，不要markdown代码块包裹：{"question": "问题"}`;
    const parsed = await askJson(prompt);
    let q = parsed && parsed.question ? String(parsed.question).trim() : '';
    if (!q) {
      const asked = new Set((game.log || []).map(l => l.text));
      q = FALLBACK_QUESTIONS.find(x => !asked.has(x)) || FALLBACK_QUESTIONS[0];
    }
    const inp = document.getElementById('tqQuestionInput'); if (inp) { inp.value = q; inp.focus(); }
    const b2 = document.getElementById('tqSuggestBtn'); if (b2) { b2.disabled = false; b2.textContent = '🎲 帮我想一题'; }
  }
  window.__tqSuggest = suggestQuestion;

  async function submitTqGuess(sessionId) {
    const input = document.getElementById('tqGuessInput');
    if (!input) return;
    const guess = input.value.trim();
    if (!guess) { alert('写下你猜的答案吧～'); return; }
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.phase !== 'play' || BUSY[sessionId]) return;
    const char = charOf(game);

    pushChat(sessionId, 'me', `【猜测】${guess}`);
    renderChatMessages(); saveAllData();
    input.value = '';
    game.questionsUsed++;
    game.log.push({ who: 'user', kind: 'guess', text: guess });
    BUSY[sessionId] = true;
    setGame(sessionId, game);
    renderTqPanel(sessionId);

    const prompt = `秘密答案是："${game.secret}"。用户猜的是："${guess}"。
请判断用户猜的这个东西和秘密答案是不是同一个东西（允许别名、同义词、相近的合理表述算作猜对，比如"手机"和"智能手机"算对，但明显不同的东西算错）。
只输出严格JSON，不要markdown代码块包裹：
{"correct": true或false}`;
    const parsed = await askJson(prompt);
    let correct = !!(parsed && parsed.correct);
    if (!correct && guess.trim() === String(game.secret).trim()) correct = true; // 兜底：完全一致的字符串也算对

    game = getGame(sessionId);
    BUSY[sessionId] = false;
    if (correct) {
      game.log.push({ who: 'char', kind: 'answer', text: '猜对了！' });
      setGame(sessionId, game);
      await finishTwentyQuestions(sessionId, 'user');
      return;
    }
    const remaining = remainingOf(game);
    const reply = remaining <= 0 ? '不对哦～机会用完啦！' : (isUnlimited(game) ? '不对～继续猜！' : `不对～还剩${remaining}次机会，继续加油！`);
    game.log.push({ who: 'char', kind: 'answer', text: reply });
    setGame(sessionId, game);
    if (char) pushChat(sessionId, char.id, reply);
    renderChatMessages(); saveAllData();
    if (remaining <= 0) { await finishTwentyQuestions(sessionId, 'char'); return; }
    renderTqPanel(sessionId);
  }
  window.__tqSubmitGuess = submitTqGuess;

  // ================= 玩法二：TA来猜（角色提问）=================
  async function charAskNext(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.mode !== 'user_thinks') return;
    const char = charOf(game);
    BUSY[sessionId] = true; game.pending = null; setGame(sessionId, game); renderTqPanel(sessionId);

    const remaining = remainingOf(game);
    const limitText = isUnlimited(game) ? '这局不限提问次数，但还是尽量用少的问题猜中。'
      : (remaining <= 1 ? '这是你最后一次机会了，必须直接猜一个具体的答案。' : `你总共有${game.maxQuestions}次机会（问题和猜测都算），已经用了${game.questionsUsed}次，还剩${remaining}次。`);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩"20个问题"猜谜游戏，这次反过来：用户心里想好了一个东西，由你来猜。${game.category ? `\n用户给的范围/大类：${game.category}` : ''}
${limitText}
${game.log.length ? `到目前为止的问答：\n${qaTranscript(game)}` : '你还一个问题都没问。'}
请结合你的人设、性格、说话方式和你对用户的了解来提问（问题可以带你自己的兴趣和视角，但必须能用"是/不是"回答，要真的能帮你缩小范围，不要重复问过的）。如果你已经比较有把握了，就直接猜一个具体的东西。
只输出严格JSON，不要markdown代码块包裹：
{"type": "question或guess", "question": "你要问的是非题；如果是猜测，就写成\\"是XX吗？\\"", "guess": "猜测时你猜的具体东西，提问时留空", "message": "提问前顺口说的一句话，符合人设，可以为空"}`;
    const parsed = await askJson(prompt);
    let type = 'question', text = '', guessWord = '', message = '';
    if (parsed && (parsed.question || parsed.guess)) {
      type = parsed.type === 'guess' ? 'guess' : 'question';
      guessWord = String(parsed.guess || '').trim();
      text = String(parsed.question || (guessWord ? `是${guessWord}吗？` : '')).trim();
      message = String(parsed.message || '').trim();
    } else {
      // 请求挂了：从兜底题里挑一个没问过的，全问完了就让用户点「重问」
      const asked = new Set((game.log || []).map(l => l.text));
      text = FALLBACK_QUESTIONS.find(x => !asked.has(x)) || '';
    }
    game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    BUSY[sessionId] = false;
    if (!text) { setGame(sessionId, game); renderTqPanel(sessionId); return; }
    game.pending = { type, text, guess: guessWord };
    game.log.push({ who: 'char', kind: type, text });
    setGame(sessionId, game);
    if (char) pushChat(sessionId, char.id, `${message ? message + '\n' : ''}【${type === 'guess' ? '猜测' : '提问'}】${text}`);
    renderChatMessages(); saveAllData();
    renderTqPanel(sessionId);
  }
  window.__tqCharAsk = charAskNext;

  // 你回答角色的问题：yes / no / unsure / correct
  async function answerCharQuestion(sessionId, ans) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.mode !== 'user_thinks' || !game.pending || BUSY[sessionId]) return;
    const label = { yes: '是', no: '不是', unsure: '不确定', correct: '猜对了！' }[ans] || '不确定';
    pushChat(sessionId, 'me', `【回答】${label}`);
    game.questionsUsed++;
    game.log.push({ who: 'user', kind: 'answer', text: label });
    const wasPending = game.pending;
    game.pending = null;
    setGame(sessionId, game);
    renderChatMessages(); saveAllData();

    if (ans === 'correct') {
      if (wasPending.guess && !game.userSecret) { game.userSecret = wasPending.guess; setGame(sessionId, game); }
      await finishTwentyQuestions(sessionId, 'char');
      return;
    }
    if (remainingOf(game) <= 0) { await finishTwentyQuestions(sessionId, 'user'); return; }
    await charAskNext(sessionId);
  }
  window.__tqAnswer = answerCharQuestion;

  // 不想玩了 / 想直接揭晓：把答案告诉 TA，这局算 TA 没猜中
  async function revealUserSecret(sessionId) {
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    let secret = game.userSecret;
    if (!secret) {
      secret = typeof appPrompt === 'function' ? await appPrompt('揭晓答案：你心里想的是什么？', '') : prompt('揭晓答案：你心里想的是什么？', '');
      if (secret === null || secret === undefined) return;
      secret = String(secret).trim();
    }
    const g = getGame(sessionId); g.userSecret = secret; setGame(sessionId, g);
    await finishTwentyQuestions(sessionId, 'user');
  }
  window.__tqReveal = revealUserSecret;

  // ---------- 结算。winner: 'user' | 'char'（谁赢） ----------
  async function finishTwentyQuestions(sessionId, winner) {
    let game = getGame(sessionId);
    if (!game) return;
    game.status = 'finished';
    game.winner = winner;
    BUSY[sessionId] = false; game.pending = null;
    setGame(sessionId, game);
    const char = charOf(game);
    const name = char ? char.name : '对方';

    let sysText, resultText;
    if (game.mode === 'user_thinks') {
      const ans = game.userSecret ? `"${game.userSecret}"` : '你心里的答案';
      if (winner === 'char') { sysText = `🎉 ${name}猜中了${ans}，用了${game.questionsUsed}次机会。`; resultText = `你猜中了用户心里想的${ans}，用了${game.questionsUsed}次机会`; }
      else { sysText = `😏 ${name}没能猜中！答案是${ans}。`; resultText = `你没能猜中用户心里想的东西，答案是${ans}`; }
    } else {
      if (winner === 'user') { sysText = `🎉 猜对了！答案就是"${game.secret}"，用了${game.questionsUsed}次机会。`; resultText = `用户猜中了你的答案"${game.secret}"，用了${game.questionsUsed}次机会`; }
      else { sysText = `😮 没能猜中，正确答案是"${game.secret}"。`; resultText = `用户没能猜中你的答案"${game.secret}"，机会用完了`; }
    }
    pushChat(sessionId, 'system', sysText);
    renderChatMessages(); saveAllData();
    renderTqPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    if (char) await askCharGameEndComment(char, sessionId, '20个问题', resultText);
  }

  // 再来一局：同一个对手，不用重新邀请，回到选玩法那一步
  function restartTq(sessionId) {
    const game = getGame(sessionId);
    if (!game) return;
    setGame(sessionId, { status: 'playing', phase: 'setup', opponentCharId: game.opponentCharId, log: [], questionsUsed: 0 });
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    renderTqPanel(sessionId);
  }
  window.__tqRestart = restartTq;

  // 完全结束（关掉这局，下次点 🎮 会重新选游戏）
  function closeTq(sessionId) {
    setGame(sessionId, null);
    const p = document.getElementById('tqFloatPanel'); if (p) p.style.display = 'none';
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
  }
  window.__tqClose = closeTq;

  // ---------- 收藏 ----------
  function openTqFav(sessionId) {
    const el = document.getElementById('tqBody');
    if (!el || !window.gyGameFav) return;
    window.gyGameFav.renderInto('tqBody', {
      game: '20q',
      onBack: () => renderTqPanel(sessionId),
      // "用这句"：正在"我来猜"就填进提问框，别的时候复制到剪贴板
      onUse: text => {
        renderTqPanel(sessionId);
        const inp = document.getElementById('tqQuestionInput');
        if (inp) { inp.value = text; inp.focus(); }
        else { try { navigator.clipboard.writeText(text); } catch (e) {} alert('已复制：' + text); }
      },
    });
  }
  window.__tqOpenFav = openTqFav;

  // ---------- 样式 ----------
  const tqStyle = document.createElement('style');
  tqStyle.textContent = `
    .tq-status { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px; }
    .tq-input { width:100%; box-sizing:border-box; padding:8px; border-radius:6px; border:1px solid #ccc; margin-top:4px; font-size:14px; font-family:inherit; }
    .tq-section { margin-top:10px; padding-top:10px; border-top:1px dashed #ccc; }
    .tq-log { max-height:34vh; overflow-y:auto; font-size:13px; background:rgba(29,155,240,0.04); border-radius:8px; padding:6px 8px; }
    .tq-log-line { display:flex; align-items:flex-start; gap:4px; padding:3px 0; }
    .tq-log-line .who { color:#8b98a5; flex-shrink:0; }
    .tq-log-line .txt { flex:1; white-space:pre-wrap; word-break:break-word; }
    .tq-mode-opt { display:flex; align-items:center; gap:6px; font-size:14px; margin:4px 0; cursor:pointer; }
    .tq-ans-btns { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:8px; }
    .tq-ans-btns .btn-edit-small { margin:0; }
    .tq-pending { font-size:15px; text-align:center; padding:8px; background:rgba(255,173,31,0.1); border-radius:8px; white-space:pre-wrap; word-break:break-word; }
  `;
  document.head.appendChild(tqStyle);

  function logHtml(game) {
    const name = charNameOf(game);
    if (!game.log || !game.log.length) return '';
    const lines = game.log.map(l => {
      const who = l.who === 'user' ? '你' : name;
      const verb = { question: '问', guess: '猜', answer: '答' }[l.kind] || '';
      return `<div class="tq-log-line"><span class="who">${escapeHtml(who)}${verb}：</span><span class="txt">${escapeHtml(l.text)}</span>${window.gyGameFav ? window.gyGameFav.starHtml('20q', l.kind, who, l.text) : ''}</div>`;
    }).join('');
    return `<div class="tq-log" id="tqLog">${lines}</div>`;
  }

  function renderTqPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('tqBody');
    if (!el || !game) return;
    const charName = charNameOf(game);
    const sid = escapeJsArg(sessionId);
    let statusText, bodyHtml;

    if (game.phase === 'setup') {
      const p = loadPrefs();
      statusText = '选一下这局怎么玩';
      bodyHtml = `
        <label class="tq-mode-opt"><input type="radio" name="tqMode" value="char_thinks" ${p.mode !== 'user_thinks' ? 'checked' : ''} onchange="document.getElementById('tqUserSecretWrap').style.display='none'"> 我来猜（${escapeHtml(charName)}想一个答案）</label>
        <label class="tq-mode-opt"><input type="radio" name="tqMode" value="user_thinks" ${p.mode === 'user_thinks' ? 'checked' : ''} onchange="document.getElementById('tqUserSecretWrap').style.display='block'"> ${escapeHtml(charName)}来猜（我想一个，TA问我答）</label>
        <div class="tq-section">
          <div style="font-size:13px; color:#536471;">最多问几次（问题和猜测都算一次）：</div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
            <input type="number" class="tq-input" id="tqMaxInput" min="1" step="1" value="${p.max || 20}" style="width:110px; margin:0;">
            <label style="font-size:13px; display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" id="tqUnlimited" ${p.unlimited ? 'checked' : ''}> 不限</label>
          </div>
          <div style="font-size:13px; color:#536471; margin-top:8px;">范围 / 大类（可不填，比如"动物""我们去过的地方"）：</div>
          <input type="text" class="tq-input" id="tqScopeInput" placeholder="不填就随便">
          <div id="tqUserSecretWrap" style="display:${p.mode === 'user_thinks' ? 'block' : 'none'};">
            <div style="font-size:13px; color:#536471; margin-top:8px;">你心里想的答案（可不填；只记在你这边，不会发给TA，结束时揭晓）：</div>
            <input type="text" class="tq-input" id="tqUserSecretInput" placeholder="悄悄写下来">
          </div>
        </div>
        <div style="text-align:center; margin-top:10px;"><button class="btn-post" onclick="window.__tqBegin('${sid}')">开始</button></div>`;
    } else if (game.status === 'finished') {
      if (game.mode === 'user_thinks') statusText = game.winner === 'char' ? `🎉 ${charName}猜中了${game.userSecret ? `"${game.userSecret}"` : ''}` : `😏 ${charName}没猜中${game.userSecret ? `，答案是"${game.userSecret}"` : ''}`;
      else statusText = game.winner === 'user' ? `🎉 你猜中了！答案是"${game.secret}"` : `😮 没猜中，答案是"${game.secret}"`;
      bodyHtml = `${logHtml(game)}
        <div style="text-align:center; margin-top:10px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button class="btn-edit-small" onclick="window.__tqRestart('${sid}')">🔁 再来一局</button>
          <button class="btn-edit-small" onclick="window.__tqClose('${sid}')">结束，不玩了</button>
        </div>`;
    } else {
      const used = game.questionsUsed || 0;
      const countText = isUnlimited(game) ? `已用 ${used} 次（不限）` : `剩余机会：${game.maxQuestions - used} / ${game.maxQuestions}`;
      statusText = `${countText}${game.category ? `　范围：${game.category}` : ''}`;
      if (game.mode === 'user_thinks') {
        let ask;
        if (BUSY[sessionId]) ask = `<div style="text-align:center; color:#8b98a5; font-size:13px;">${escapeHtml(charName)}正在想问题...</div>`;
        else if (game.pending) ask = `
          <div class="tq-pending">${game.pending.type === 'guess' ? '🎯 ' : '❓ '}${escapeHtml(game.pending.text)}</div>
          <div class="tq-ans-btns">
            <button class="btn-edit-small" onclick="window.__tqAnswer('${sid}','yes')">✅ 是</button>
            <button class="btn-edit-small" onclick="window.__tqAnswer('${sid}','no')">❌ 不是</button>
            <button class="btn-edit-small" onclick="window.__tqAnswer('${sid}','unsure')">🤔 不确定</button>
            <button class="btn-edit-small" style="color:#00ba7c; border-color:#00ba7c;" onclick="window.__tqAnswer('${sid}','correct')">🎉 猜对了</button>
          </div>`;
        else ask = `<div style="text-align:center;"><button class="btn-edit-small" onclick="window.__tqCharAsk('${sid}')">🔄 让TA重新问</button></div>`;
        bodyHtml = `${logHtml(game)}<div class="tq-section">${ask}</div>
          ${game.userSecret ? `<div style="font-size:12px; color:#8b98a5; text-align:center; margin-top:6px;">（你想的是：${escapeHtml(game.userSecret)}，只有你看得到）</div>` : ''}
          <div style="text-align:center; margin-top:8px;"><button class="btn-edit-small" onclick="window.__tqReveal('${sid}')">揭晓答案，结束这局</button></div>`;
      } else if (!game.secret && !BUSY[sessionId]) {
        // 开局时 TA 还没想好答案页面就刷新了：这局没法继续，回开局重来
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">${escapeHtml(charName)}还没想好答案这局就断了</div>
          <div style="text-align:center; margin-top:8px;"><button class="btn-edit-small" onclick="window.__tqRestart('${sid}')">↩ 回到开局</button></div>`;
      } else {
        const busy = BUSY[sessionId] ? ' disabled' : '';
        bodyHtml = `${logHtml(game)}
          <div class="tq-section">
            <div style="font-size:13px; color:#536471;">问一个是非题（${escapeHtml(charName)}只会回答"是/不是/不一定"）：</div>
            <input type="text" class="tq-input" id="tqQuestionInput" placeholder="比如：它是活的吗？" onkeydown="if(event.key==='Enter' && !event.isComposing) window.__tqSubmitQuestion('${sid}')">
            <div style="text-align:center; margin-top:6px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
              <button class="btn-edit-small" onclick="window.__tqSubmitQuestion('${sid}')"${busy}>提问</button>
              <button class="btn-edit-small" id="tqSuggestBtn" onclick="window.__tqSuggest('${sid}')">🎲 帮我想一题</button>
            </div>
          </div>
          <div class="tq-section">
            <div style="font-size:13px; color:#536471;">直接猜答案：</div>
            <input type="text" class="tq-input" id="tqGuessInput" placeholder="猜猜是什么" onkeydown="if(event.key==='Enter' && !event.isComposing) window.__tqSubmitGuess('${sid}')">
            <div style="text-align:center; margin-top:6px;"><button class="btn-edit-small" onclick="window.__tqSubmitGuess('${sid}')"${busy}>猜测</button></div>
          </div>
          ${BUSY[sessionId] ? `<div style="text-align:center; color:#8b98a5; font-size:12px; margin-top:6px;">${escapeHtml(charName)}在想怎么回答...</div>` : ''}`;
      }
    }

    // 重画会把输入框清掉——先把没发出去的字记下来再放回去
    const keep = {};
    ['tqQuestionInput', 'tqGuessInput'].forEach(id => { const i = document.getElementById(id); if (i && i.value) keep[id] = i.value; });
    el.innerHTML = `
      <div class="tq-status">${escapeHtml(statusText)}</div>
      ${bodyHtml}
      <div style="display:flex; justify-content:center; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn-edit-small" onclick="window.__tqOpenFav('${sid}')">⭐ 收藏</button>
        <button class="btn-edit-small" onclick="document.getElementById('tqFloatPanel').style.display='none'">收起（继续聊天）</button>
      </div>`;
    Object.keys(keep).forEach(id => { const i = document.getElementById(id); if (i) i.value = keep[id]; });
    const log = document.getElementById('tqLog'); if (log) log.scrollTop = log.scrollHeight;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'twenty_questions',
      name: '20个问题',
      icon: '🔮',
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openTqPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startTwentyQuestions(sessionId, (opponentCharIds || [])[0]); }
    });
  } else {
    console.error('20个问题插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ 真心话大冒险 ============
// 题目都是现场让模型按人设出的；下面的固定题只在请求失败时兜底。
// 你给 TA 出题时也可以点「🎲 帮我出一题」让模型帮你想，或者从「⭐ 收藏」里挑。
// 每一道出过的题都能点 ☆ 存进收藏（跟 20个问题 共用一个收藏库，各看各的）。
(function () {
  if (window.__truthOrDarePluginInstalled) return;
  window.__truthOrDarePluginInstalled = true;

  /* 🎲 让角色开口的 prompt 都算「game」那一场（同狼人杀） */
  const buildBasePrompt = function () {
    const a = arguments;
    if (typeof window.gyInjectInScene === 'function' && typeof window.buildBasePrompt === 'function')
      return window.gyInjectInScene('game', () => window.buildBasePrompt.apply(null, a));
    return window.buildBasePrompt ? window.buildBasePrompt.apply(null, a) : '';
  };

  const STORE_KEY = 'truthOrDareGamesV1';
  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveStore(obj) { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }
  function getGame(sessionId) { const g = loadStore()[sessionId] || null; if (g && !Array.isArray(g.history)) g.history = []; return g; }
  function setGame(sessionId, game) {
    const all = loadStore();
    if (game) all[sessionId] = game; else delete all[sessionId];
    saveStore(all);
  }
  window.__todSetGame = setGame;
  window.__todGetGame = getGame;

  // 兜底题库：只在模型请求失败时随机抽一道
  const FALLBACK_TRUTH = ['说一件你一直没告诉过别人的小秘密吧。', '你最近一次偷偷开心是因为什么？', '你第一印象里我是个什么样的人？', '有没有哪句话你想说但一直没说出口？', '你最害怕别人发现你的哪一面？', '最近一次哭是因为什么？', '如果可以重来一天，你想重过哪一天？'];
  const FALLBACK_DARE = ['去做一件让自己觉得有点不好意思的小事，然后告诉我结果～', '用最夸张的语气夸一下你身边的一样东西。', '给你手机里最近联系的人发一句"今天也要开心"。', '模仿一种小动物叫三声。', '现在拍一张窗外的照片（描述给我听也行）。', '闭眼转三圈，然后说出你看到的第一样东西。'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const stripFence = s => String(s || '').trim().replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
  async function askText(prompt) {
    try {
      const data = await callChatCompletionAPI(getApiConfig(true), prompt);
      if (data && !data.error) return stripFence(data.choices?.[0]?.message?.content || '');
    } catch (e) {}
    return '';
  }
  // 本局出过的题，给模型看，免得老出同一道
  function askedList(game) { return (game.history || []).filter(h => h.kind === 'truth' || h.kind === 'dare').map(h => '· ' + h.text).join('\n'); }

  // ---------- 开局 ----------
  function startTruthOrDare(sessionId, opponentCharId) {
    const activePlayer = Math.random() < 0.5 ? 'user' : 'char';
    const game = {
      status: 'playing',
      opponentCharId,
      activePlayer,
      phase: 'choosing', // choosing | awaiting_question | awaiting_answer
      charChoice: null,
      round: 1,
      history: [],       // [{who:'user'|'char', kind:'truth'|'dare'|'reply', text}]
    };
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🎲 真心话大冒险开始！${activePlayer === 'user' ? '你先选真心话还是大冒险' : `${char ? char.name : '对方'}先选`}。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openTodPanel(sessionId);
    if (activePlayer === 'char') runCharChoosePhase(sessionId);
  }

  function openTodPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('todFloatPanel', '🎲 真心话大冒险');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('todBody')) body.innerHTML = `<div id="todBody" style="min-width:260px;"></div>`;
    renderTodPanel(sessionId);
  }

  // ---------- 角色回合：自己选真心话/大冒险 ----------
  async function runCharChoosePhase(sessionId) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩真心话大冒险。现在轮到你被问，你需要自己选择"真心话"还是"大冒险"（请结合你的性格：大胆/外向的角色可以多选大冒险，内敛/害羞的角色可以多选真心话，也可以纯粹看当下心情）。
只输出严格JSON，不要markdown代码块包裹：
{"choice": "truth或dare", "message": "你做这个选择时说的一句话，符合人设语气"}`;
    let choice = Math.random() < 0.5 ? 'truth' : 'dare', message = '';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed) { choice = parsed.choice === 'dare' ? 'dare' : 'truth'; message = parsed.message || ''; }
      }
    } catch (e) {}

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: `【选择了${choice === 'dare' ? '大冒险' : '真心话'}】${message}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.charChoice = choice;
    game.phase = 'awaiting_question';
    setGame(sessionId, game);
    renderTodPanel(sessionId);
  }

  // ---------- 用户给角色出题（真心话问题或大冒险挑战）----------
  async function submitQuestionForChar(sessionId) {
    const input = document.getElementById('todQuestionInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { alert('写点什么吧～'); return; }
    let game = getGame(sessionId);
    if (!game || game.phase !== 'awaiting_question' || game.activePlayer !== 'char') return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const tag = game.charChoice === 'dare' ? '大冒险挑战' : '真心话提问';

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `【${tag}】${text}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game.phase = 'awaiting_answer';
    game.history.push({ who: 'user', kind: game.charChoice === 'dare' ? 'dare' : 'truth', text });
    setGame(sessionId, game);
    renderTodPanel(sessionId);

    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const actionWord = game.charChoice === 'dare' ? '大冒险挑战，请你详细描述自己实际去完成/尝试这个挑战的过程和反应' : '真心话问题，请你诚实、符合人设地回答';
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
用户刚才向你提出了一个${game.charChoice === 'dare' ? '大冒险挑战' : '真心话问题'}：「${text}」
请${actionWord}。符合你的人设和性格，可以带情绪、带反应。
只输出你的回应内容本身，不要markdown、不要多余说明。`;
    let answer = await askText(prompt);
    if (!answer) answer = '（好像不知道该说什么……）';

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: answer, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.history.push({ who: 'char', kind: 'reply', text: answer });
    game.activePlayer = 'user';
    game.phase = 'choosing';
    game.round++;
    setGame(sessionId, game);
    renderTodPanel(sessionId);
  }
  window.__todSubmitQuestion = submitQuestionForChar;

  // 🎲 帮我给 TA 出一题：按 TA 的人设和你们的关系想一道，填进输入框，你可以再改
  async function suggestForChar(sessionId) {
    const game = getGame(sessionId);
    if (!game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const btn = document.getElementById('todSuggestBtn'); if (btn) { btn.disabled = true; btn.textContent = '想题中...'; }
    const dare = game.charChoice === 'dare';
    const recentHistory = buildTimeAwareHistoryText((globalChats[sessionId] || []).slice(-chatHistoryTurns));
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
（这一步不是让你以角色身份说话，而是帮用户出题。）用户在和你玩真心话大冒险，你选了"${dare ? '大冒险' : '真心话'}"。请站在用户的角度，结合你的人设、经历、你们的关系和最近聊的内容，替用户想一道最有意思、最能让你（这个角色）露出真实一面的${dare ? '大冒险挑战（能在文字里描述完成过程的）' : '真心话问题'}。
${askedList(game) ? `本局已经出过的题（不要重复）：\n${askedList(game)}\n` : ''}只输出这道题本身，不要引号、不要markdown、不要多余说明。`;
    let q = (await askText(prompt)).replace(/^["「]|["」]$/g, '').trim();
    if (!q) q = pick(dare ? FALLBACK_DARE : FALLBACK_TRUTH);
    const inp = document.getElementById('todQuestionInput'); if (inp) { inp.value = q; inp.focus(); }
    const b2 = document.getElementById('todSuggestBtn'); if (b2) { b2.disabled = false; b2.textContent = '🎲 帮我出一题'; }
  }
  window.__todSuggest = suggestForChar;

  // ---------- 用户回合：自己选真心话/大冒险，角色出题 ----------
  async function userPickChoice(sessionId, choice) {
    let game = getGame(sessionId);
    if (!game || game.phase !== 'choosing' || game.activePlayer !== 'user') return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `【选择】${choice === 'dare' ? '大冒险' : '真心话'}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game.phase = 'awaiting_answer'; // 角色出题中
    setGame(sessionId, game);
    renderTodPanel(sessionId);

    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const askWord = choice === 'dare' ? '给用户出一个大冒险挑战（一件用户可以在现实里去做/尝试并回来描述结果的小挑战，不要太出格）' : '给用户出一个真心话问题（可以是关于用户本人、关于你们的关系、或者你好奇的事情）';
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
用户在真心话大冒险里选择了"${choice === 'dare' ? '大冒险' : '真心话'}"，请结合你的人设、性格、和你们的关系，${askWord}。
${askedList(game) ? `本局已经出过的题（不要重复）：\n${askedList(game)}\n` : ''}只输出这个问题/挑战本身，不要markdown、不要多余说明。`;
    let question = await askText(prompt);
    if (!question) question = pick(choice === 'dare' ? FALLBACK_DARE : FALLBACK_TRUTH);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: `【${choice === 'dare' ? '大冒险挑战' : '真心话提问'}】${question}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    game = getGame(sessionId);
    game.phase = 'awaiting_answer'; // 等待用户在正常聊天框里回答，回答完点"下一轮"继续
    game.history.push({ who: 'char', kind: choice === 'dare' ? 'dare' : 'truth', text: question });
    setGame(sessionId, game);
    renderTodPanel(sessionId);
  }
  window.__todPickChoice = userPickChoice;

  function userDoneAnswering(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.activePlayer !== 'user' || game.phase !== 'awaiting_answer') return;
    game.activePlayer = 'char';
    game.phase = 'choosing';
    game.round++;
    setGame(sessionId, game);
    renderTodPanel(sessionId);
    runCharChoosePhase(sessionId);
  }
  window.__todDoneAnswering = userDoneAnswering;

  async function endTruthOrDare(sessionId) {
    let game = getGame(sessionId);
    if (!game) return;
    game.status = 'finished';
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🎲 真心话大冒险结束，一共玩了${game.round}轮。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderTodPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    if (char) await askCharGameEndComment(char, sessionId, '真心话大冒险', `一起玩了${game.round}轮，聊了很多`);
  }
  window.__todEndGame = endTruthOrDare;

  function openTodFav(sessionId) {
    if (!window.gyGameFav) return;
    window.gyGameFav.renderInto('todBody', {
      game: 'tod',
      onBack: () => renderTodPanel(sessionId),
      // 正在给 TA 出题就填进输入框；别的时候复制
      onUse: text => {
        renderTodPanel(sessionId);
        const inp = document.getElementById('todQuestionInput');
        if (inp) { inp.value = text; inp.focus(); }
        else { try { navigator.clipboard.writeText(text); } catch (e) {} alert('已复制：' + text); }
      },
    });
  }
  window.__todOpenFav = openTodFav;

  // ---------- 样式 ----------
  const todStyle = document.createElement('style');
  todStyle.textContent = `
    .tod-status { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px; }
    .tod-choice-btn { margin:4px; padding:10px 18px; }
    .tod-input { width:100%; box-sizing:border-box; padding:8px; border-radius:6px; border:1px solid #ccc; margin-top:6px; font-size:14px; font-family:inherit; }
    .tod-hist { max-height:30vh; overflow-y:auto; font-size:13px; background:rgba(249,24,128,0.04); border-radius:8px; padding:6px 8px; margin-bottom:8px; }
    .tod-hist-line { display:flex; align-items:flex-start; gap:4px; padding:3px 0; }
    .tod-hist-line .who { color:#8b98a5; flex-shrink:0; }
    .tod-hist-line .txt { flex:1; white-space:pre-wrap; word-break:break-word; }
  `;
  document.head.appendChild(todStyle);

  function historyHtml(game, charName) {
    const h = game.history || [];
    if (!h.length) return '';
    const label = { truth: '真心话', dare: '大冒险', reply: '回应' };
    const lines = h.map(x => {
      const who = x.who === 'user' ? '你' : charName;
      return `<div class="tod-hist-line"><span class="who">${escapeHtml(who)}·${label[x.kind] || ''}：</span><span class="txt">${escapeHtml(x.text)}</span>${window.gyGameFav ? window.gyGameFav.starHtml('tod', x.kind, who, x.text) : ''}</div>`;
    }).join('');
    return `<details class="tod-hist-wrap" open><summary style="font-size:12px; color:#8b98a5; cursor:pointer;">本局出过的题（点 ☆ 收藏）</summary><div class="tod-hist" id="todHist">${lines}</div></details>`;
  }

  function renderTodPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('todBody');
    if (!el || !game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const charName = char ? char.name : '对方';
    const sid = escapeJsArg(sessionId);

    let bodyHtml = '';
    let statusText = `第${game.round}轮`;

    if (game.status === 'finished') {
      statusText = '游戏已结束';
      bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">可以点下面的图标重新开始一局～</div>`;
    } else if (game.activePlayer === 'char') {
      if (game.phase === 'choosing') {
        statusText += `：${charName}选择中...`;
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">等${escapeHtml(charName)}决定真心话还是大冒险</div>`;
      } else if (game.phase === 'awaiting_question') {
        statusText += `：${charName}选了${game.charChoice === 'dare' ? '大冒险' : '真心话'}，该你出题了`;
        bodyHtml = `
          <textarea class="tod-input" id="todQuestionInput" rows="3" placeholder="${game.charChoice === 'dare' ? '给TA出一个大冒险挑战吧...' : '想问TA什么真心话...'}"></textarea>
          <div style="text-align:center; margin-top:8px; display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
            <button class="btn-edit-small" onclick="window.__todSubmitQuestion('${sid}')">发送给TA</button>
            <button class="btn-edit-small" id="todSuggestBtn" onclick="window.__todSuggest('${sid}')">🎲 帮我出一题</button>
          </div>`;
      } else {
        statusText += `：${charName}正在回答/挑战中...`;
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px;">请稍等，去下面聊天记录里看看TA的反应～</div>`;
      }
    } else {
      if (game.phase === 'choosing') {
        statusText += '：轮到你选了';
        bodyHtml = `
          <div style="text-align:center;">
            <button class="btn-edit-small tod-choice-btn" onclick="window.__todPickChoice('${sid}','truth')">💬 真心话</button>
            <button class="btn-edit-small tod-choice-btn" onclick="window.__todPickChoice('${sid}','dare')">🔥 大冒险</button>
          </div>`;
      } else {
        statusText += `：${charName}出题中或已出题，去聊天框回答TA吧`;
        bodyHtml = `<div style="text-align:center; color:#8b98a5; font-size:13px; margin-bottom:8px;">在下面正常聊天框里回答/描述你的表现，回答完点这里继续</div>
          <div style="text-align:center;"><button class="btn-edit-small" onclick="window.__todDoneAnswering('${sid}')">回答完了，下一轮</button></div>`;
      }
    }

    const kept = (document.getElementById('todQuestionInput') || {}).value || '';
    el.innerHTML = `
      <div class="tod-status">${escapeHtml(statusText)}</div>
      ${historyHtml(game, charName)}
      ${bodyHtml}
      <div style="display:flex; justify-content:center; gap:10px; margin-top:14px; flex-wrap:wrap;">
        ${game.status === 'playing' ? `<button class="btn-edit-small" style="color:#f91880; border-color:#f91880;" onclick="window.__todEndGame('${sid}')">结束游戏</button>` : ''}
        <button class="btn-edit-small" onclick="window.__todOpenFav('${sid}')">⭐ 收藏</button>
        <button class="btn-edit-small" onclick="document.getElementById('todFloatPanel').style.display='none'">收起（继续聊天）</button>
      </div>`;
    const ni = document.getElementById('todQuestionInput'); if (ni && kept) ni.value = kept;
    const hl = document.getElementById('todHist'); if (hl) hl.scrollTop = hl.scrollHeight;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'truth_or_dare',
      name: '真心话大冒险',
      icon: '🎲',
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openTodPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startTruthOrDare(sessionId, (opponentCharIds || [])[0]); }
    });
  } else {
    console.error('真心话大冒险插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();
