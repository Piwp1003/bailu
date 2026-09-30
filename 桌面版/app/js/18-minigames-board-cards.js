/* =====================================================================
   js/18 —— 棋牌类小游戏（原来是 4 个插件，v92 起内置）
   五子棋 / 打牌合集（拼大小·21点·接龙·斗地主）/ UNO / 昆特牌

   ⚠️ 每个游戏各自包在自己的 IIFE 里，**不要合并**：
      它们之间有同名的顶层函数和常量（shuffle / getGame / setGame /
      buildUnoDeck / unoCardLabel / UNO_COLORS / pluginCharSay …），
      当插件时靠各自的闭包隔开，内置之后必须继续靠 IIFE 隔开，
      合并会互相覆盖（比如"打牌合集"的简化接龙会顶掉正版 UNO 的牌堆）。

   都通过 js/02 里的小游戏框架 registerMiniGame() 注册，
   自己不建图标，入口统一是聊天输入框上方那个 🎮。
   对局状态存在各自的 localStorage key 里（不进主存档，清缓存会丢，
   但也不会把一堆棋盘塞进你的备份文件）。
   ===================================================================== */

// ============ 五子棋 ============
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
  if (window.__gomokuPluginInstalled) return;
  window.__gomokuPluginInstalled = true;

  const BOARD_SIZE = 15;
  const STORE_KEY = 'gomokuGamesV1';
  const GAME_NAME = '五子棋';

  // ---------- 状态存取（单独存一个localStorage key，不占用主数据结构） ----------
  function loadGames() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveGamesMap(games) { localStorage.setItem(STORE_KEY, JSON.stringify(games)); }
  function getGame(sessionId) { return loadGames()[sessionId] || null; }
  function setGame(sessionId, game) {
    const games = loadGames();
    if (game) games[sessionId] = game; else delete games[sessionId];
    saveGamesMap(games);
  }
  function emptyBoard() { return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null)); }
  function getOpponentChar(sessionId, game) {
    if (game && game.opponentCharId != null) return myCharacters.find(c => c.id == game.opponentCharId);
    return myCharacters.find(c => c.id == sessionId);
  }

  // ---------- 样式注入（只加棋盘本身需要的样式；图标/悬浮窗框架样式核心已经有了）----------
  const style = document.createElement('style');
  style.textContent = `
    .gmk-board { display:inline-grid; grid-template-columns: repeat(${BOARD_SIZE}, var(--gmk-cell, 22px)); grid-template-rows: repeat(${BOARD_SIZE}, var(--gmk-cell, 22px)); background:#e8b06a; border:2px solid #1d9bf0; border-radius:8px; margin: 10px auto; touch-action: manipulation; }
    .gmk-cell { width: var(--gmk-cell, 22px); height: var(--gmk-cell, 22px); position:relative; border-right:1px solid rgba(0,0,0,0.15); border-bottom:1px solid rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; cursor:pointer; }
    .gmk-stone { width: calc(var(--gmk-cell, 22px) - 5px); height: calc(var(--gmk-cell, 22px) - 5px); border-radius:50%; box-shadow: 0 1px 2px rgba(0,0,0,0.4); pointer-events:none; }
    .gmk-stone.user { background: radial-gradient(circle at 30% 30%, #666, #000); }
    .gmk-stone.char { background: radial-gradient(circle at 30% 30%, #fff, #ccc); border:1px solid #999; }
    .gmk-stone.last { outline: 2px solid #f91880; outline-offset: -2px; }
    #gomokuBoardStatus { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:6px; min-height:20px; font-size:13px; }
  `;
  document.head.appendChild(style);

  // ---------- 悬浮棋盘窗口（可拖动，不挡聊天）----------
  function computeCellSize() {
    const maxW = Math.min(window.innerWidth * 0.8, 360);
    return Math.max(14, Math.floor(maxW / BOARD_SIZE));
  }

  function openBoardModal() {
    const panel = createMiniGameFloatingPanel('gomokuFloatPanel', '⚫⚪ 五子棋');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (body && !document.getElementById('gomokuBoardGrid')) {
      body.innerHTML = `
        <div id="gomokuBoardStatus"></div>
        <div id="gomokuBoardGrid" class="gmk-board"></div>
        <div id="gomokuBoardFooter" style="display:flex; justify-content:center; gap:10px; margin-top:12px;"></div>`;
    }
    document.documentElement.style.setProperty('--gmk-cell', computeCellSize() + 'px');
    renderBoard();
  }

  async function resign() {
    const sessionId = currentChatSessionId;
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    const ok = typeof appConfirm === 'function' ? await appConfirm('确定要认输吗？') : confirm('确定要认输吗？');
    if (!ok) return;
    const char = getOpponentChar(sessionId, game);
    game.status = 'finished'; game.winner = 'char';
    setGame(sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `你选择认输，${char ? char.name : '对方'} 赢得了这局五子棋。`, timestamp: Date.now() });
    saveAllData();
    if (typeof renderChatMessages === 'function') renderChatMessages();
    renderBoard();
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    if (char) await askCharGameEndComment(char, sessionId, GAME_NAME, `你中途认输，${char.name}获胜`);
  }
  window.__gomokuResign = resign;

  function pluginCharSay(sessionId, char, text) {
    if (typeof miniGameCharSay === 'function') return miniGameCharSay(sessionId, char, text);
    if (!text || !char) return false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: text, timestamp: Date.now(), readBy: [] });
    return true;
  }

  function reopenInviteFlow() {
    setGame(currentChatSessionId, null);
    if (typeof onMiniGameIconClick === 'function') onMiniGameIconClick();
  }
  window.__gomokuReopenInvite = reopenInviteFlow;

  function renderBoard() {
    const sessionId = currentChatSessionId;
    const game = getGame(sessionId);
    const grid = document.getElementById('gomokuBoardGrid');
    const statusEl = document.getElementById('gomokuBoardStatus');
    const footer = document.getElementById('gomokuBoardFooter');
    if (!grid || !game) return;
    const char = getOpponentChar(sessionId, game);

    if (game.status === 'finished') {
      statusEl.textContent = game.winner === 'draw' ? '棋盘下满，平局！' : (game.winner === 'user' ? '🎉 你赢了！' : `😮 ${char ? char.name : '对方'} 赢了这局`);
      if (footer) footer.innerHTML = `<button class="btn-edit-small" onclick="window.__gomokuReopenInvite()">再来一局</button><button class="btn-edit-small" onclick="document.getElementById('gomokuFloatPanel').style.display='none'">收起</button>`;
    } else {
      statusEl.textContent = game.turn === 'user' ? '轮到你落子（点击棋盘）' : `${char ? char.name : '对方'} 思考中...`;
      if (footer) footer.innerHTML = `<button class="btn-edit-small" onclick="window.__gomokuResign()">认输</button><button class="btn-edit-small" onclick="document.getElementById('gomokuFloatPanel').style.display='none'">收起（继续聊天）</button>`;
    }

    let html = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = game.board[r][c];
        const isLast = game.lastMove && game.lastMove.row === r && game.lastMove.col === c;
        let inner = v ? `<div class="gmk-stone ${v}${isLast ? ' last' : ''}"></div>` : '';
        html += `<div class="gmk-cell" onclick="window.__gomokuCellClick(${r},${c})">${inner}</div>`;
      }
    }
    grid.innerHTML = html;
  }

  function placeStone(game, row, col, who) {
    game.board[row][col] = who;
    game.moves.push({ row, col, who, t: Date.now() });
    game.lastMove = { row, col };
  }
  function isBoardFull(board) { return board.every(row => row.every(c => c)); }

  function checkWin(board, row, col, who) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let s = 1; s < 5; s++) { const r = row + dr * s, c = col + dc * s; if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== who) break; count++; }
      for (let s = 1; s < 5; s++) { const r = row - dr * s, c = col - dc * s; if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || board[r][c] !== who) break; count++; }
      if (count >= 5) return true;
    }
    return false;
  }

  function pickFallbackMove(board) {
    let candidates = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c]) continue;
        let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) {
          for (let dc = -2; dc <= 2 && !near; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc]) near = true;
          }
        }
        if (near) candidates.push({ row: r, col: c });
      }
    }
    if (candidates.length === 0) { for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (!board[r][c]) candidates.push({ row: r, col: c }); }
    if (candidates.length === 0) return { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) };
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function boardToText(board) {
    let lines = [];
    let header = '　　' + Array.from({ length: BOARD_SIZE }, (_, i) => String(i + 1).padStart(2, ' ')).join('');
    lines.push(header);
    for (let r = 0; r < BOARD_SIZE; r++) {
      let row = String(r + 1).padStart(2, ' ') + '  ';
      for (let c = 0; c < BOARD_SIZE; c++) {
        const v = board[r][c];
        row += (v === 'user' ? ' ●' : v === 'char' ? ' ○' : ' ·');
      }
      lines.push(row);
    }
    return lines.join('\n');
  }

  async function cellClick(row, col) {
    const sessionId = currentChatSessionId;
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user') return;
    if (game.board[row][col]) return;

    placeStone(game, row, col, 'user');
    setGame(sessionId, game);
    renderBoard();

    const char = getOpponentChar(sessionId, game);
    const win = checkWin(game.board, row, col, 'user');
    if (win) {
      game.status = 'finished'; game.winner = 'user';
      setGame(sessionId, game); renderBoard();
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `🎉 五子连珠！你赢了这局五子棋。`, timestamp: Date.now() });
      if (typeof renderChatMessages === 'function') renderChatMessages();
      saveAllData(); if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
      if (char) await askCharGameEndComment(char, sessionId, GAME_NAME, `你赢了，${char.name}输了`);
      return;
    }
    if (isBoardFull(game.board)) {
      game.status = 'finished'; game.winner = 'draw';
      setGame(sessionId, game); renderBoard();
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `棋盘下满了，本局平局。`, timestamp: Date.now() });
      if (typeof renderChatMessages === 'function') renderChatMessages();
      saveAllData(); if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
      if (char) await askCharGameEndComment(char, sessionId, GAME_NAME, `平局`);
      return;
    }

    game.turn = 'char';
    setGame(sessionId, game);
    renderBoard();
    await requestCharMove(sessionId);
  }
  window.__gomokuCellClick = cellClick;

  async function requestCharMove(sessionId) {
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing') return;
    const char = getOpponentChar(sessionId, game);
    if (!char) return;

    const isViewing = currentChatSessionId === sessionId;
    if (isViewing && typeof currentlyTypingChars !== 'undefined') { currentlyTypingChars.add(char.name); if (typeof updateTypingIndicator === 'function') updateTypingIndicator(); }

    const api = getApiConfig(true);
    const recentHistory = typeof buildTimeAwareHistoryText === 'function' ? buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns)) : '';
    const boardText = boardToText(game.board);

    async function askMove(extraNote) {
      const prompt = `${buildBasePrompt(char, true, recentHistory)}
你正在和用户下五子棋（15x15棋盘，坐标行列均从1到${BOARD_SIZE}，率先五子连成一线者获胜）。
你执白棋"○"，用户执黑棋"●"，"·"表示空位。
当前棋盘（顶部是列号，每行开头是行号）：
${boardText}

请结合你的人设个性认真思考棋局（可以进攻，也可以防守用户即将连成的棋），给出你要落子的位置。${extraNote || ''}
只输出严格JSON，不要markdown代码块包裹，不要任何多余文字：
{"row": 落子的行号(1到${BOARD_SIZE}的整数), "col": 落子的列号(1到${BOARD_SIZE}的整数), "message": "你落子时说的一句话，符合你的人设语气，可以吐槽/挑衅/称赞棋局，不超过30字"}`;
      let data;
      try { data = await callChatCompletionAPI(api, prompt); } catch (e) { return null; }
      if (data.error) return null;
      const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
      try { return extractJsonObject(raw); } catch (e) { return null; }
    }

    let parsed = await askMove();
    let row = parsed ? Math.round(parsed.row) - 1 : NaN;
    let col = parsed ? Math.round(parsed.col) - 1 : NaN;
    let legal = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && !game.board[row][col];

    if (!legal) {
      parsed = await askMove('（注意：你上一次给的坐标不合法，或者那个位置已经有棋子了，请重新选一个真正空着的位置）');
      row = parsed ? Math.round(parsed.row) - 1 : NaN;
      col = parsed ? Math.round(parsed.col) - 1 : NaN;
      legal = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && !game.board[row][col];
    }
    if (!legal) {
      const fb = pickFallbackMove(game.board);
      row = fb.row; col = fb.col;
    }
    const message = (parsed && parsed.message) ? String(parsed.message) : '';   // 不再截断到 100 字：模型说多少就显示多少

    placeStone(game, row, col, 'char');
    game.turn = 'user';

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    if (message) pluginCharSay(sessionId, char, message);

    const win = checkWin(game.board, row, col, 'char');
    let ended = false, endResultText = '';
    if (win) {
      game.status = 'finished'; game.winner = 'char';
      globalChats[sessionId].push({ sender: 'system', text: `😮 ${char.name} 五子连珠，赢得了这局五子棋。`, timestamp: Date.now() });
      ended = true; endResultText = `${char.name}赢了，你输了`;
    } else if (isBoardFull(game.board)) {
      game.status = 'finished'; game.winner = 'draw';
      globalChats[sessionId].push({ sender: 'system', text: `棋盘下满了，本局平局。`, timestamp: Date.now() });
      ended = true; endResultText = `平局`;
    }

    setGame(sessionId, game);
    saveAllData();

    if (isViewing && typeof currentlyTypingChars !== 'undefined') { currentlyTypingChars.delete(char.name); if (typeof updateTypingIndicator === 'function') updateTypingIndicator(); }

    if (currentChatSessionId === sessionId) {
      if (typeof renderChatMessages === 'function') renderChatMessages();
      renderBoard();
      if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    } else {
      const avatarHtml = typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 80) : '';
      if (typeof showToast === 'function') showToast(avatarHtml, `${char.name} 下棋了`, message || `在(${row + 1},${col + 1})落子`, null, sessionId);
      if (typeof globalNotifications !== 'undefined') { globalNotifications.unshift({ text: `<b>${char.name}</b> 在五子棋对局中落子了`, postId: null, chatCharId: sessionId, timestamp: Date.now() }); if (typeof unreadNotifs !== 'undefined') unreadNotifs++; if (typeof updateNotifBadge === 'function') updateNotifBadge(); }
    }

    if (ended) await askCharGameEndComment(char, sessionId, GAME_NAME, endResultText);
  }

  // ---------- 注册进核心小游戏框架（不自己建图标，完全靠核心的🎮入口）----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'gomoku',
      name: '五子棋',
      icon: '⚫⚪',
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openBoardModal(); },
      onStart: function (sessionId, opponentCharIds) {
        const opponentCharId = (opponentCharIds || [])[0];
        const char = myCharacters.find(c => c.id == opponentCharId);
        const firstTurn = Math.random() < 0.5 ? 'user' : 'char';
        const game = { board: emptyBoard(), turn: firstTurn, status: 'playing', winner: null, moves: [], startedAt: Date.now(), lastMove: null, opponentCharId: opponentCharId };
        setGame(sessionId, game);
        if (!globalChats[sessionId]) globalChats[sessionId] = [];
        globalChats[sessionId].push({ sender: 'system', text: firstTurn === 'user' ? `🎮 五子棋对局开始，你执黑先手。` : `🎮 五子棋对局开始，${char ? char.name : '对方'}执黑先手。`, timestamp: Date.now() });
        if (typeof renderChatMessages === 'function') renderChatMessages();
        saveAllData();
        openBoardModal();
        if (firstTurn === 'char') requestCharMove(sessionId);
      }
    });
  } else {
    console.error('五子棋插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ 打牌合集：拼大小 / 21点 / 接龙 / 斗地主 ============
(function () {
  if (window.__cardGamesPluginInstalled) return;
  window.__cardGamesPluginInstalled = true;

  // ---------- 通用存取（每种玩法各自一个命名空间，互不影响）----------
  function loadStore(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } }
  function saveStore(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }
  function getGame(key, sessionId) { return loadStore(key)[sessionId] || null; }
  function setGame(key, sessionId, game) {
    const all = loadStore(key);
    if (game) all[sessionId] = game; else delete all[sessionId];
    saveStore(key, all);
  }
  window.__pkSetGame = setGame;

  function pluginCharSay(sessionId, char, text) {
    if (typeof miniGameCharSay === 'function') return miniGameCharSay(sessionId, char, text);
    if (!text || !char) return false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: text, timestamp: Date.now(), readBy: [] });
    return true;
  }

  // ---------- 标准扑克牌工具（拼大小/21点/斗地主共用）----------
  const SUITS = ['♠', '♥', '♣', '♦'];
  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  function buildStandardDeck(withJokers) {
    let deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
    if (withJokers) { deck.push({ suit: 'joker', rank: 'small' }); deck.push({ suit: 'joker', rank: 'big' }); }
    return deck;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function cardLabel(c) {
    if (c.suit === 'joker') return c.rank === 'big' ? '🃏大王' : '🃏小王';
    return `${c.suit}${c.rank}`;
  }
  function cardColorClass(c) {
    if (c.suit === '♥' || c.suit === '♦') return 'card-red';
    if (c.suit === 'joker') return c.rank === 'big' ? 'card-red' : 'card-black';
    return 'card-black';
  }
  function renderCardSpan(c) { return `<span class="pk-card ${cardColorClass(c)}">${cardLabel(c)}</span>`; }

  // ---------- 样式注入 ----------
  const style = document.createElement('style');
  style.textContent = `
    .pk-card { display:inline-block; padding:4px 7px; margin:2px; border:1px solid #ccc; border-radius:6px; background:#fff; font-weight:bold; font-size:13px; min-width:18px; text-align:center; cursor:default; }
    .card-red { color:#e0245e; }
    .card-black { color:#222; }
    .pk-hand { display:flex; flex-wrap:wrap; justify-content:center; margin:8px 0; }
    .ddz-hand-card { cursor:pointer; }
    .ddz-hand-card.selected { outline:2px solid #1d9bf0; background:rgba(29,155,240,0.12); transform:translateY(-4px); }
    .uno-card { cursor:pointer; }
    .uno-red { background:#ffe1e1; border-color:#e0245e; color:#e0245e; }
    .uno-yellow { background:#fff8d6; border-color:#c9a400; color:#8a6d00; }
    .uno-green { background:#e3f8e3; border-color:#17bf63; color:#128a3e; }
    .uno-blue { background:#e1f0ff; border-color:#1d9bf0; color:#1d9bf0; }
  `;
  document.head.appendChild(style);

  // ================= 游戏一：拼大小（比点数，一次性）=================
  function startGaoSi(sessionId, opponentCharId) {
    const char = myCharacters.find(c => c.id == opponentCharId);
    const deck = shuffle(buildStandardDeck(false));
    const userCard = deck[0], charCard = deck[1];
    const rv = c => RANKS.indexOf(c.rank);
    let winner;
    if (rv(userCard) > rv(charCard)) winner = 'user';
    else if (rv(userCard) < rv(charCard)) winner = 'char';
    else winner = 'draw';

    const panel = createMiniGameFloatingPanel('gaosiFloatPanel', '🎴 拼大小');
    const body = panel.querySelector('.mini-game-float-body');
    body.innerHTML = `
      <div style="text-align:center;">
        <div>你：${renderCardSpan(userCard)}　${char ? escapeHtml(char.name) : '对方'}：${renderCardSpan(charCard)}</div>
        <div style="margin-top:10px; font-weight:bold; color:#1d9bf0;">${winner === 'draw' ? '平局！' : (winner === 'user' ? '🎉 你赢了！' : `😮 ${char ? escapeHtml(char.name) : '对方'}赢了`)}</div>
        <button class="btn-edit-small" style="margin-top:10px;" onclick="document.getElementById('gaosiFloatPanel').style.display='none'">收起</button>
      </div>`;
    panel.style.display = 'block';

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const resultLine = winner === 'draw' ? '平局' : (winner === 'user' ? '你赢了' : `${char ? char.name : '对方'}赢了`);
    globalChats[sessionId].push({ sender: 'system', text: `🎴 拼大小：你${cardLabel(userCard)}，${char ? char.name : '对方'}${cardLabel(charCard)}，${resultLine}`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    if (char) {
      askCharGameEndComment(char, sessionId, '拼大小', winner === 'draw' ? '平局' : (winner === 'user' ? '你赢了，对方输了' : `${char.name}赢了，你输了`));
    }
  }

  // ================= 游戏二：21点 =================
  function cardValueBJ(c) {
    if (c.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(c.rank)) return 10;
    return parseInt(c.rank) || 10;
  }
  function handTotalBJ(hand) {
    let total = hand.reduce((s, c) => s + cardValueBJ(c), 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function startBlackjack(sessionId, opponentCharId) {
    const deck = shuffle(buildStandardDeck(false));
    const userHand = [deck.pop(), deck.pop()];
    const charHand = [deck.pop(), deck.pop()];
    const game = { deck, userHand, charHand, userStood: false, charStood: false, status: 'playing', opponentCharId, winner: null };
    setGame('blackjack', sessionId, game);
    const char = myCharacters.find(c => c.id == opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🎴 21点对局开始，你和${char ? char.name : '对方'}各发了2张牌。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openBlackjackPanel(sessionId);
  }

  function openBlackjackPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('blackjackFloatPanel', '🎴 21点');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('bjBody')) body.innerHTML = `<div id="bjBody"></div>`;
    renderBlackjackPanel(sessionId);
  }

  function renderBlackjackPanel(sessionId) {
    const game = getGame('blackjack', sessionId);
    const el = document.getElementById('bjBody');
    if (!el || !game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const userTotal = handTotalBJ(game.userHand);
    const charTotal = handTotalBJ(game.charHand);
    let statusText;
    if (game.status === 'finished') statusText = game.winner === 'draw' ? '平局' : (game.winner === 'user' ? '🎉 你赢了！' : `😮 ${char ? char.name : '对方'}赢了`);
    else statusText = game.userStood ? `等待${char ? char.name : '对方'}操作...` : '轮到你决定要牌还是停牌';
    el.innerHTML = `
      <div style="text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px;">${escapeHtml(statusText)}</div>
      <div>你的牌（${userTotal}点）：${game.userHand.map(renderCardSpan).join('')}</div>
      <div style="margin-top:6px;">${char ? escapeHtml(char.name) : '对方'}的牌（${charTotal}点）：${game.charHand.map(renderCardSpan).join('')}</div>
      <div style="display:flex; justify-content:center; gap:10px; margin-top:12px; flex-wrap:wrap;">
        ${game.status === 'playing' && !game.userStood ? `<button class="btn-edit-small" onclick="window.__pkBjHit('${sessionId}')">要牌</button><button class="btn-edit-small" onclick="window.__pkBjStand('${sessionId}')">停牌</button>` : ''}
        ${game.status === 'finished' ? `<button class="btn-edit-small" onclick="document.getElementById('blackjackFloatPanel').style.display='none'; window.__pkSetGame('blackjack','${sessionId}',null); if(typeof onMiniGameIconClick==='function') onMiniGameIconClick();">再来一局</button>` : ''}
        <button class="btn-edit-small" onclick="document.getElementById('blackjackFloatPanel').style.display='none'">收起</button>
      </div>`;
  }

  async function endBlackjack(sessionId, char, winner, sysText) {
    const game = getGame('blackjack', sessionId);
    game.status = 'finished'; game.winner = winner;
    setGame('blackjack', sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: sysText, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderBlackjackPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    const resultText = winner === 'draw' ? '平局' : (winner === 'user' ? `你赢了，${char.name}输了` : `${char.name}赢了，你输了`);
    await askCharGameEndComment(char, sessionId, '21点', resultText);
  }

  async function userHitBJ(sessionId) {
    const game = getGame('blackjack', sessionId);
    if (!game || game.status !== 'playing' || game.userStood) return;
    game.userHand.push(game.deck.pop());
    setGame('blackjack', sessionId, game);
    renderBlackjackPanel(sessionId);
    const total = handTotalBJ(game.userHand);
    if (total > 21) {
      const char = myCharacters.find(c => c.id == game.opponentCharId);
      await endBlackjack(sessionId, char, 'char', `你爆牌了（${total}点），${char ? char.name : '对方'}获胜。`);
    }
  }
  window.__pkBjHit = userHitBJ;

  async function userStandBJ(sessionId) {
    const game = getGame('blackjack', sessionId);
    if (!game || game.status !== 'playing') return;
    game.userStood = true;
    setGame('blackjack', sessionId, game);
    renderBlackjackPanel(sessionId);
    await runCharTurnBJ(sessionId);
  }
  window.__pkBjStand = userStandBJ;

  async function runCharTurnBJ(sessionId) {
    let game = getGame('blackjack', sessionId);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const api = getApiConfig(true);

    while (true) {
      game = getGame('blackjack', sessionId);
      const total = handTotalBJ(game.charHand);
      if (total > 21) { await endBlackjack(sessionId, char, 'user', `${char.name}爆牌了（${total}点），你获胜！`); return; }

      const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
      const handText = game.charHand.map(cardLabel).join('、');
      const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩21点。你现在手里的牌是：${handText}，总点数${total}（A已按对你最有利的方式计算为1或11点）。
规则：谁的点数最接近21点且不超过21点谁赢，超过21点就爆牌直接输。
请决定你要不要继续要一张牌。只输出严格JSON，不要markdown代码块包裹：
{"action": "hit或stand", "message": "你做这个决定时说的一句话，符合人设语气，不超过20字"}`;
      let action = null, message = '';
      try {
        const data = await callChatCompletionAPI(api, prompt);
        if (!data.error) {
          const raw = (data.choices?.[0]?.message?.content || '').trim();
          const parsed = extractJsonObject(raw);
          if (parsed && parsed.action) { action = String(parsed.action).toLowerCase().includes('hit') ? 'hit' : 'stand'; message = parsed.message || ''; }
        }
      } catch (e) {}
      if (!action) action = total < 17 ? 'hit' : 'stand';

      if (message) {
        pluginCharSay(sessionId, char, message);
        renderChatMessages(); saveAllData();
      }

      if (action === 'hit') {
        game.charHand.push(game.deck.pop());
        setGame('blackjack', sessionId, game);
        renderBlackjackPanel(sessionId);
        continue;
      } else {
        game.charStood = true;
        setGame('blackjack', sessionId, game);
        break;
      }
    }

    game = getGame('blackjack', sessionId);
    const ut = handTotalBJ(game.userHand), ct = handTotalBJ(game.charHand);
    let winner, sysText;
    if (ut > ct) { winner = 'user'; sysText = `最终你${ut}点，${char.name}${ct}点，你赢了！`; }
    else if (ct > ut) { winner = 'char'; sysText = `最终${char.name}${ct}点，你${ut}点，${char.name}赢了。`; }
    else { winner = 'draw'; sysText = `双方都是${ut}点，平局。`; }
    await endBlackjack(sessionId, char, winner, sysText);
  }

  // ================= 游戏三：接龙（UNO风格，简化版：仅颜色/数字匹配，无特殊牌）=================
  const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
  const UNO_COLOR_NAME = { red: '红', yellow: '黄', green: '绿', blue: '蓝' };
  function buildUnoDeck() {
    let deck = [];
    for (const col of UNO_COLORS) for (let n = 0; n <= 9; n++) deck.push({ color: col, num: n });
    return deck;
  }
  function unoCardLabel(c) { return `${UNO_COLOR_NAME[c.color]}${c.num}`; }
  function unoCardColorClass(c) { return 'uno-' + c.color; }
  function unoPlayable(card, top) { return card.color === top.color || card.num === top.num; }

  function startUnoChain(sessionId, opponentCharId) {
    let deck = shuffle(buildUnoDeck());
    const userHand = deck.splice(0, 5);
    const charHand = deck.splice(0, 5);
    const topCard = deck.splice(0, 1)[0];
    const firstTurn = Math.random() < 0.5 ? 'user' : 'char';
    const game = { deck, discardTop: topCard, userHand, charHand, turn: firstTurn, status: 'playing', opponentCharId, winner: null };
    setGame('unoChain', sessionId, game);
    const char = myCharacters.find(c => c.id == opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🎴 接龙开始！起始牌是${unoCardLabel(topCard)}，${firstTurn === 'user' ? '你' : char.name}先出牌。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openUnoPanel(sessionId);
    if (firstTurn === 'char') runCharTurnUno(sessionId);
  }

  function openUnoPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('unoFloatPanel', '🌈 接龙');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('unoBody')) body.innerHTML = `<div id="unoBody"></div>`;
    renderUnoPanel(sessionId);
  }

  function renderUnoPanel(sessionId) {
    const game = getGame('unoChain', sessionId);
    const el = document.getElementById('unoBody');
    if (!el || !game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    let statusText;
    if (game.status === 'finished') statusText = game.winner === 'user' ? '🎉 你赢了！' : `😮 ${char ? char.name : '对方'}赢了`;
    else statusText = game.turn === 'user' ? '轮到你出牌' : `${char ? char.name : '对方'}思考中...`;
    const handHtml = game.userHand.map((c, i) => `<span class="pk-card uno-card ${unoCardColorClass(c)}" onclick="window.__pkUnoPlay('${sessionId}',${i})">${unoCardLabel(c)}</span>`).join('');
    el.innerHTML = `
      <div style="text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:8px;">${escapeHtml(statusText)}</div>
      <div style="text-align:center;">当前牌堆：<span class="pk-card uno-card ${unoCardColorClass(game.discardTop)}">${unoCardLabel(game.discardTop)}</span></div>
      <div style="margin-top:8px;">你的手牌（${game.userHand.length}张，点击出牌）：</div>
      <div class="pk-hand">${handHtml}</div>
      <div style="text-align:center; color:#8b98a5; font-size:12px;">${char ? char.name : '对方'}还剩${game.charHand.length}张牌</div>
      <div style="display:flex; justify-content:center; gap:10px; margin-top:12px; flex-wrap:wrap;">
        ${game.status === 'playing' && game.turn === 'user' ? `<button class="btn-edit-small" onclick="window.__pkUnoDraw('${sessionId}')">摸牌</button>` : ''}
        ${game.status === 'finished' ? `<button class="btn-edit-small" onclick="document.getElementById('unoFloatPanel').style.display='none'; window.__pkSetGame('unoChain','${sessionId}',null); if(typeof onMiniGameIconClick==='function') onMiniGameIconClick();">再来一局</button>` : ''}
        <button class="btn-edit-small" onclick="document.getElementById('unoFloatPanel').style.display='none'">收起</button>
      </div>`;
  }

  function userPlayCardUno(sessionId, idx) {
    const game = getGame('unoChain', sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user') return;
    const card = game.userHand[idx];
    if (!card) return;
    if (!unoPlayable(card, game.discardTop)) { alert('这张牌颜色和数字都对不上，不能出'); return; }
    game.userHand.splice(idx, 1);
    game.discardTop = card;
    if (game.userHand.length === 0) {
      setGame('unoChain', sessionId, game);
      finishUno(sessionId, 'user');
      return;
    }
    game.turn = 'char';
    setGame('unoChain', sessionId, game);
    renderUnoPanel(sessionId);
    runCharTurnUno(sessionId);
  }
  window.__pkUnoPlay = userPlayCardUno;

  function userDrawCardUno(sessionId) {
    const game = getGame('unoChain', sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user') return;
    if (game.deck.length === 0) game.deck = shuffle(buildUnoDeck());
    game.userHand.push(game.deck.pop());
    game.turn = 'char';
    setGame('unoChain', sessionId, game);
    renderUnoPanel(sessionId);
    runCharTurnUno(sessionId);
  }
  window.__pkUnoDraw = userDrawCardUno;

  async function runCharTurnUno(sessionId) {
    let game = getGame('unoChain', sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'char') return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const handText = game.charHand.map(unoCardLabel).join('、');
    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩接龙纸牌游戏（类似UNO）。规则：出的牌必须和当前牌堆最上面那张颜色相同或数字相同才能出，出不了就摸一张牌。
当前牌堆最上面是：${unoCardLabel(game.discardTop)}
你手里的牌是：${handText}
请决定你要出哪张牌（写出跟"你手里的牌"里完全一样的文字，比如"红3"），如果没有能出的牌，就输出"摸牌"。
只输出严格JSON，不要markdown代码块包裹：
{"play": "红3或摸牌这样的文字", "message": "你做这个决定时说的一句话，符合人设语气，不超过20字"}`;
    let playLabel = null, message = '';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed) { playLabel = parsed.play || null; message = parsed.message || ''; }
      }
    } catch (e) {}

    let idx = -1;
    if (playLabel && playLabel !== '摸牌') idx = game.charHand.findIndex(c => unoCardLabel(c) === playLabel && unoPlayable(c, game.discardTop));
    if (idx === -1) idx = game.charHand.findIndex(c => unoPlayable(c, game.discardTop));

    if (message) {
      pluginCharSay(sessionId, char, message);
    }

    if (idx >= 0) {
      const card = game.charHand[idx];
      game.charHand.splice(idx, 1);
      game.discardTop = card;
      if (game.charHand.length === 0) {
        setGame('unoChain', sessionId, game);
        renderChatMessages(); saveAllData();
        finishUno(sessionId, 'char');
        return;
      }
      game.turn = 'user';
    } else {
      if (game.deck.length === 0) game.deck = shuffle(buildUnoDeck());
      game.charHand.push(game.deck.pop());
      game.turn = 'user';
    }
    setGame('unoChain', sessionId, game);
    renderChatMessages(); saveAllData();
    renderUnoPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
  }

  async function finishUno(sessionId, winner) {
    const game = getGame('unoChain', sessionId);
    game.status = 'finished'; game.winner = winner;
    setGame('unoChain', sessionId, game);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: winner === 'user' ? `🎉 你出完手里的牌，赢了这局接龙！` : `😮 ${char.name}先出完了牌，赢得了这局接龙。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderUnoPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    await askCharGameEndComment(char, sessionId, '接龙', winner === 'user' ? `你赢了，${char.name}输了` : `${char.name}赢了，你输了`);
  }

  // ================= 游戏四：斗地主（简化规则：单/对/三/三带一/三带二/顺子/炸弹/火箭，不含飞机、连对）=================
  const DDZ_RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  function ddzCardValue(c) {
    if (c.suit === 'joker') return c.rank === 'big' ? 100 : 99;
    return DDZ_RANKS.indexOf(c.rank) + 3;
  }
  function seatDisplayName(seat) {
    if (seat === 'user') return (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '你';
    const c = myCharacters.find(x => x.id == seat);
    return c ? c.name : '未知';
  }

  function isConsecutiveRun(valsSortedUnique) {
    if (valsSortedUnique.some(v => v >= 15)) return false; // 2和大小王不能进连续牌型
    for (let i = 1; i < valsSortedUnique.length; i++) if (valsSortedUnique[i] !== valsSortedUnique[i - 1] + 1) return false;
    return true;
  }

  function classifyPlay(cards) {
    if (!cards || cards.length === 0) return null;
    const vals = cards.map(ddzCardValue).sort((a, b) => a - b);
    const n = cards.length;
    if (n === 2 && vals[0] === 99 && vals[1] === 100) return { type: 'rocket', mainRank: 100 };
    const countMap = {};
    vals.forEach(v => countMap[v] = (countMap[v] || 0) + 1);
    const uniqueVals = Object.keys(countMap).map(Number).sort((a, b) => a - b);
    const counts = uniqueVals.map(v => countMap[v]);
    if (n === 1) return { type: 'single', mainRank: vals[0] };
    if (n === 2 && counts.length === 1 && counts[0] === 2) return { type: 'pair', mainRank: vals[0] };
    if (n === 3 && counts.length === 1 && counts[0] === 3) return { type: 'triple', mainRank: vals[0] };
    if (n === 4 && counts.length === 1 && counts[0] === 4) return { type: 'bomb', mainRank: vals[0] };

    // 连对（木板）：3组或以上连续的对子，比如 44 55 66
    if (n >= 6 && n % 2 === 0 && counts.every(c => c === 2) && uniqueVals.length >= 3) {
      if (isConsecutiveRun(uniqueVals)) return { type: 'consecutive_pairs', mainRank: uniqueVals[uniqueVals.length - 1], length: uniqueVals.length };
    }

    // 飞机：2组或以上连续的三张，可以不带翼，或者每组带1张单牌，或者每组带1对
    const tripleVals = uniqueVals.filter((v, i) => counts[i] === 3);
    if (tripleVals.length >= 2 && isConsecutiveRun(tripleVals)) {
      const k = tripleVals.length;
      const tripleCardCount = k * 3;
      const wingCount = n - tripleCardCount;
      if (wingCount === 0) {
        return { type: 'plane', mainRank: tripleVals[tripleVals.length - 1], length: k };
      }
      if (wingCount === k) {
        return { type: 'plane_single', mainRank: tripleVals[tripleVals.length - 1], length: k };
      }
      if (wingCount === k * 2) {
        // 翼必须是k对（每组数量为2），而不是散牌
        const wingVals = uniqueVals.filter(v => !tripleVals.includes(v));
        const wingCounts = wingVals.map(v => countMap[v]);
        if (wingVals.length === k && wingCounts.every(c => c === 2)) {
          return { type: 'plane_pair', mainRank: tripleVals[tripleVals.length - 1], length: k };
        }
      }
    }

    if (n === 4 && counts.length === 2 && counts.includes(3) && counts.includes(1)) {
      const mainV = uniqueVals[counts.indexOf(3)];
      return { type: 'triple_single', mainRank: mainV };
    }
    if (n === 5 && counts.length === 2 && counts.includes(3) && counts.includes(2)) {
      const mainV = uniqueVals[counts.indexOf(3)];
      return { type: 'triple_pair', mainRank: mainV };
    }
    if (n >= 5 && counts.every(c => c === 1)) {
      if (isConsecutiveRun(uniqueVals)) return { type: 'straight', mainRank: uniqueVals[uniqueVals.length - 1], length: n };
    }
    return null;
  }

  const LENGTH_SENSITIVE_TYPES = ['straight', 'consecutive_pairs', 'plane', 'plane_single', 'plane_pair'];
  function canBeat(play, lastPlay) {
    if (!lastPlay) return true;
    if (play.type === 'rocket') return true;
    if (lastPlay.type === 'rocket') return false;
    if (play.type === 'bomb' && lastPlay.type !== 'bomb') return true;
    if (play.type === 'bomb' && lastPlay.type === 'bomb') return play.mainRank > lastPlay.mainRank;
    if (lastPlay.type === 'bomb') return false;
    if (play.type !== lastPlay.type) return false;
    if (LENGTH_SENSITIVE_TYPES.includes(play.type) && play.length !== lastPlay.length) return false;
    return play.mainRank > lastPlay.mainRank;
  }

  function findFallbackPlay(hand, lastPlay) {
    const countMap = {};
    hand.forEach(c => { const v = ddzCardValue(c); (countMap[v] = countMap[v] || []).push(c); });
    const sortedVals = Object.keys(countMap).map(Number).sort((a, b) => a - b);
    function tryType(neededCount, type) {
      for (const v of sortedVals) {
        const group = countMap[v];
        if (group.length >= neededCount) {
          const cards = group.slice(0, neededCount);
          if (!lastPlay || (lastPlay.type === type && v > lastPlay.mainRank) || (type === 'bomb' && lastPlay.type !== 'bomb') || (type === 'bomb' && lastPlay.type === 'bomb' && v > lastPlay.mainRank)) {
            return { cards, play: classifyPlay(cards) };
          }
        }
      }
      return null;
    }
    // 找一段连续、每个点数至少有neededGroupSize张、长度正好是exactLen、顶端点数比lastPlay更大的组合（用于连对/飞机兜底）
    function tryConsecutiveRun(neededGroupSize, exactLen) {
      const groupVals = sortedVals.filter(v => v < 15 && countMap[v].length >= neededGroupSize);
      for (let i = 0; i + exactLen <= groupVals.length; i++) {
        let ok = true;
        for (let j = 1; j < exactLen; j++) { if (groupVals[i + j] !== groupVals[i] + j) { ok = false; break; } }
        if (!ok) continue;
        const topVal = groupVals[i + exactLen - 1];
        if (!lastPlay || topVal > lastPlay.mainRank) {
          let cards = [];
          for (let j = 0; j < exactLen; j++) cards = cards.concat(countMap[groupVals[i + j]].slice(0, neededGroupSize));
          const play = classifyPlay(cards);
          if (play) return { cards, play };
        }
      }
      return null;
    }
    if (!lastPlay) return tryType(1, 'single');
    if (lastPlay.type === 'single') return tryType(1, 'single') || tryType(4, 'bomb');
    if (lastPlay.type === 'pair') return tryType(2, 'pair') || tryType(4, 'bomb');
    if (lastPlay.type === 'triple') return tryType(3, 'triple') || tryType(4, 'bomb');
    if (lastPlay.type === 'consecutive_pairs') return tryConsecutiveRun(2, lastPlay.length) || tryType(4, 'bomb');
    if (lastPlay.type === 'plane') return tryConsecutiveRun(3, lastPlay.length) || tryType(4, 'bomb');
    if (lastPlay.type === 'bomb') return tryType(4, 'bomb');
    // plane_single / plane_pair / straight（超出兜底能力范围的复杂牌型）以及其他情况：只能尝试用炸弹压制，压不了就过
    return tryType(4, 'bomb');
  }

  async function startDdz(sessionId, opponentCharIds) {
    const char1 = myCharacters.find(c => c.id == (opponentCharIds || [])[0]);
    const char2 = myCharacters.find(c => c.id == (opponentCharIds || [])[1]);
    if (!char1 || !char2) { alert('斗地主需要2个角色一起玩，去群聊里凑够3个人再试试～'); return; }
    const deck = shuffle(buildStandardDeck(true));
    const seats = ['user', char1.id, char2.id];
    const hands = {};
    hands.user = deck.splice(0, 17);
    hands[char1.id] = deck.splice(0, 17);
    hands[char2.id] = deck.splice(0, 17);
    const landlordCards = deck.splice(0, 3);
    const game = { status: 'bidding', seats, hands, landlordCards, landlord: null, turnIdx: 0, lastPlay: null, lastPlayerIdx: null, passCount: 0, winner: null, biddingIdx: 0 };
    setGame('ddz', sessionId, game);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🎮 斗地主开局！你和${char1.name}、${char2.name}各摸了17张牌，还有3张底牌等地主揭晓。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openDdzPanel(sessionId);
    await runBidding(sessionId);
  }

  async function runBidding(sessionId) {
    let game = getGame('ddz', sessionId);
    while (game.status === 'bidding') {
      const seat = game.seats[game.biddingIdx % game.seats.length];
      let claims = false;
      if (seat === 'user') {
        claims = typeof appConfirm === 'function'
          ? await appConfirm(`你的手牌：${game.hands.user.map(cardLabel).join('、')}\n\n要抢地主吗？`, '抢', '不抢')
          : confirm('要抢地主吗？');
        if (!globalChats[sessionId]) globalChats[sessionId] = [];
        globalChats[sessionId].push({ sender: 'me', text: claims ? '【抢地主】' : '【不抢】', timestamp: Date.now(), readBy: [] });
        renderChatMessages(); saveAllData();
      } else {
        const char = myCharacters.find(c => c.id == seat);
        const api = getApiConfig(true);
        const handText = game.hands[seat].map(cardLabel).join('、');
        const prompt = `${buildBasePrompt(char, false, '')}
你在和用户、还有另一个角色玩斗地主。现在是抢地主环节，你的手牌是：${handText}
请判断这手牌适不适合抢地主当地主（有炸弹、大牌多、点数好就适合抢），决定要不要抢。
只输出严格JSON，不要markdown代码块包裹：
{"claim": true或false, "message": "你的反应，符合人设语气，不超过20字"}`;
        let claim = false, message = '';
        try {
          const data = await callChatCompletionAPI(api, prompt);
          if (!data.error) {
            const raw = (data.choices?.[0]?.message?.content || '').trim();
            const parsed = extractJsonObject(raw);
            if (parsed) { claim = !!parsed.claim; message = parsed.message || ''; }
          }
        } catch (e) {}
        if (message) {
          pluginCharSay(sessionId, char, (claim ? '【抢地主】' : '【不抢】') + message);
          renderChatMessages(); saveAllData();
        }
        claims = claim;
      }

      game = getGame('ddz', sessionId);
      if (claims) {
        game.landlord = seat;
        game.hands[seat] = game.hands[seat].concat(game.landlordCards);
        game.status = 'playing';
        game.turnIdx = game.seats.indexOf(seat);
        setGame('ddz', sessionId, game);
        globalChats[sessionId].push({ sender: 'system', text: `${seatDisplayName(seat)} 抢到了地主！底牌是：${game.landlordCards.map(cardLabel).join('、')}，${seatDisplayName(seat)}先出牌。`, timestamp: Date.now() });
        renderChatMessages(); saveAllData();
        openDdzPanel(sessionId);
        if (seat !== 'user') await continuePlayLoopDdz(sessionId); else renderDdzPanel(sessionId);
        return;
      }
      game.biddingIdx++;
      if (game.biddingIdx >= game.seats.length * 2) {
        const forcedSeat = game.seats[0];
        game.landlord = forcedSeat;
        game.hands[forcedSeat] = game.hands[forcedSeat].concat(game.landlordCards);
        game.status = 'playing';
        game.turnIdx = 0;
        setGame('ddz', sessionId, game);
        globalChats[sessionId].push({ sender: 'system', text: `大家都不太想抢地主，${seatDisplayName(forcedSeat)}就当地主吧。底牌：${game.landlordCards.map(cardLabel).join('、')}`, timestamp: Date.now() });
        renderChatMessages(); saveAllData();
        openDdzPanel(sessionId);
        if (forcedSeat !== 'user') await continuePlayLoopDdz(sessionId); else renderDdzPanel(sessionId);
        return;
      }
      setGame('ddz', sessionId, game);
    }
  }

  function advanceTurnDdz(game) { game.turnIdx = (game.turnIdx + 1) % game.seats.length; }

  async function userPlayDdz(sessionId, selectedIdxs) {
    let game = getGame('ddz', sessionId);
    if (!game || game.status !== 'playing' || game.seats[game.turnIdx] !== 'user') return;
    const hand = game.hands.user;
    const cards = selectedIdxs.map(i => hand[i]);
    const play = classifyPlay(cards);
    if (!play) { alert('这个牌型不支持或者选牌不对，试试单张/对子/三张/三带一/三带二/顺子(5张以上)/连对(3组以上)/飞机(不带、带单、带对)/炸弹'); return; }
    const isLeading = game.lastPlayerIdx === null || game.lastPlayerIdx === game.turnIdx;
    if (!isLeading && !canBeat(play, game.lastPlay)) { alert('这手牌压不过上家，出不了'); return; }

    selectedIdxs.slice().sort((a, b) => b - a).forEach(i => hand.splice(i, 1));
    play.cards = cards;
    game.lastPlay = play; game.lastPlayerIdx = game.turnIdx; game.passCount = 0;
    setGame('ddz', sessionId, game);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `出牌：${cards.map(cardLabel).join('、')}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    if (hand.length === 0) { await finishDdz(sessionId, 'user'); return; }

    advanceTurnDdz(game);
    setGame('ddz', sessionId, game);
    renderDdzPanel(sessionId);
    await continuePlayLoopDdz(sessionId);
  }
  window.__pkDdzPlay = function (sessionId) {
    const panel = document.getElementById('ddzFloatPanel');
    const checked = [...panel.querySelectorAll('.ddz-hand-card.selected')].map(el => parseInt(el.dataset.idx));
    if (checked.length === 0) { alert('先选几张牌'); return; }
    userPlayDdz(sessionId, checked);
  };

  async function userPassDdz(sessionId) {
    let game = getGame('ddz', sessionId);
    if (!game || game.status !== 'playing' || game.seats[game.turnIdx] !== 'user') return;
    if (game.lastPlayerIdx === null || game.lastPlayerIdx === game.turnIdx) { alert('轮到你必须出牌，不能过'); return; }
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: '过牌', timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();
    game.passCount = (game.passCount || 0) + 1;
    advanceTurnDdz(game);
    if (game.turnIdx === game.lastPlayerIdx) { game.lastPlay = null; game.lastPlayerIdx = null; game.passCount = 0; }
    setGame('ddz', sessionId, game);
    renderDdzPanel(sessionId);
    await continuePlayLoopDdz(sessionId);
  }
  window.__pkDdzPass = userPassDdz;

  async function continuePlayLoopDdz(sessionId) {
    let game = getGame('ddz', sessionId);
    while (game && game.status === 'playing' && game.seats[game.turnIdx] !== 'user') {
      await runCharDdzTurn(sessionId);
      game = getGame('ddz', sessionId);
    }
  }

  async function runCharDdzTurn(sessionId) {
    let game = getGame('ddz', sessionId);
    const seat = game.seats[game.turnIdx];
    const char = myCharacters.find(c => c.id == seat);
    if (!char) return;
    const isLeading = game.lastPlayerIdx === null || game.lastPlayerIdx === game.turnIdx;
    const hand = game.hands[seat];
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const handText = hand.map(cardLabel).join('、');
    const lastPlayText = isLeading ? '（你可以自由出牌，不用跟谁）' : `上家刚出了：${game.lastPlay.cards.map(cardLabel).join('、')}（牌型：${game.lastPlay.type}），你要出比这个大的同类型牌，或者选择"过"。`;

    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩斗地主，你现在的身份是${game.landlord === seat ? '地主' : '农民'}。
你手里的牌：${handText}
${lastPlayText}
支持的牌型：单张、对子、三张、三张带一张、三张带一对、顺子(5张以上连续点数，不能带2和大小王)、连对/木板(3组以上连续对子，不能带2和大小王)、飞机(2组以上连续三张，可以不带翼，也可以每组带1张单牌，或每组带1对，不能带2和大小王)、炸弹(四张一样)、火箭(大小王)。
请决定你要出的牌（列出具体的牌，用顿号隔开，跟"你手里的牌"里的写法完全一致，比如"♠3、♥3、♣3"），如果要过牌就输出空数组。
只输出严格JSON，不要markdown代码块包裹：
{"cards": ["♠3","♥3"], "message": "你出牌/过牌时说的一句话，符合人设语气，不超过20字"}
（cards为空数组[]表示过牌；${isLeading ? '你现在必须出牌，不能过牌' : '如果确实没有能压过的牌，可以输出空数组表示过'}）`;

    let chosenCards = null, message = '';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed && Array.isArray(parsed.cards)) {
          const pool = hand.slice();
          const matched = [];
          for (const label of parsed.cards) {
            const idx = pool.findIndex(c => cardLabel(c) === label);
            if (idx >= 0) { matched.push(pool[idx]); pool.splice(idx, 1); }
          }
          if (matched.length === parsed.cards.length && matched.length > 0) chosenCards = matched;
          message = parsed.message || '';
        }
      }
    } catch (e) {}

    let play = chosenCards ? classifyPlay(chosenCards) : null;
    let valid = !!(play && (isLeading || canBeat(play, game.lastPlay)));

    if (!valid) {
      const fallback = findFallbackPlay(hand, isLeading ? null : game.lastPlay);
      if (fallback) { chosenCards = fallback.cards; play = fallback.play; valid = true; }
      else { chosenCards = null; play = null; valid = !isLeading; }
      if (!valid && isLeading) {
        const sorted = hand.slice().sort((a, b) => ddzCardValue(a) - ddzCardValue(b));
        chosenCards = [sorted[0]];
        play = classifyPlay(chosenCards);
        valid = true;
      }
    }

    if (message) {
      pluginCharSay(sessionId, char, message);
    }

    if (chosenCards && chosenCards.length > 0) {
      chosenCards.forEach(c => { const idx = hand.findIndex(h => h === c); if (idx >= 0) hand.splice(idx, 1); });
      play.cards = chosenCards;
      game.lastPlay = play; game.lastPlayerIdx = game.turnIdx; game.passCount = 0;
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `${char.name} 出牌：${chosenCards.map(cardLabel).join('、')}`, timestamp: Date.now() });
      setGame('ddz', sessionId, game);
      renderChatMessages(); saveAllData();
      renderDdzPanel(sessionId);
      if (hand.length === 0) { await finishDdz(sessionId, seat); return; }
      advanceTurnDdz(game);
    } else {
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `${char.name} 选择过牌`, timestamp: Date.now() });
      game.passCount = (game.passCount || 0) + 1;
      advanceTurnDdz(game);
      if (game.turnIdx === game.lastPlayerIdx) { game.lastPlay = null; game.lastPlayerIdx = null; game.passCount = 0; }
      renderChatMessages(); saveAllData();
    }
    setGame('ddz', sessionId, game);
    renderDdzPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
  }

  async function finishDdz(sessionId, winnerSeat) {
    let game = getGame('ddz', sessionId);
    const isLandlordWin = winnerSeat === game.landlord;
    game.status = 'finished';
    game.winner = isLandlordWin ? 'landlord' : 'peasants';
    setGame('ddz', sessionId, game);

    const landlordName = seatDisplayName(game.landlord);
    const others = game.seats.filter(s => s !== game.landlord).map(seatDisplayName);
    const sysText = isLandlordWin ? `${landlordName}（地主）率先出完牌，地主获胜！` : `${seatDisplayName(winnerSeat)}率先出完牌，农民一方（${others.join('、')}）获胜！`;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: sysText, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderDdzPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();

    for (const seat of game.seats) {
      if (seat === 'user') continue;
      const char = myCharacters.find(c => c.id == seat);
      if (!char) continue;
      const won = (seat === game.landlord) === isLandlordWin;
      const resultText = won ? `你（${seat === game.landlord ? '地主' : '农民'}）赢了这局斗地主` : `你（${seat === game.landlord ? '地主' : '农民'}）输了这局斗地主`;
      await askCharGameEndComment(char, sessionId, '斗地主', resultText);
    }
  }

  function openDdzPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('ddzFloatPanel', '🎮 斗地主');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('ddzBody')) body.innerHTML = `<div id="ddzBody" style="max-width:320px;"></div>`;
    renderDdzPanel(sessionId);
  }

  function renderDdzPanel(sessionId) {
    const game = getGame('ddz', sessionId);
    const el = document.getElementById('ddzBody');
    if (!el || !game) return;

    if (game.status === 'bidding') {
      el.innerHTML = `<div style="text-align:center; color:#1d9bf0; font-weight:bold;">抢地主中...</div>`;
      return;
    }

    const isUserTurn = game.status === 'playing' && game.seats[game.turnIdx] === 'user';
    const others = game.seats.filter(s => s !== 'user');
    const otherInfoHtml = others.map(s => `<div>${escapeHtml(seatDisplayName(s))}${game.landlord === s ? '（地主）' : '（农民）'}：剩${game.hands[s].length}张</div>`).join('');
    const handHtml = game.hands.user.map((c, i) => `<span class="pk-card ddz-hand-card ${cardColorClass(c)}" data-idx="${i}" onclick="this.classList.toggle('selected')">${cardLabel(c)}</span>`).join('');
    const lastPlayHtml = game.lastPlay ? `上一手：${game.lastPlay.cards.map(cardLabel).join('、')}（${escapeHtml(seatDisplayName(game.seats[game.lastPlayerIdx]))}）` : '（新一轮，自由出牌）';

    let statusText;
    if (game.status === 'finished') statusText = game.winner === 'landlord' ? (game.landlord === 'user' ? '🎉 你（地主）赢了！' : `😮 ${seatDisplayName(game.landlord)}（地主）赢了`) : (game.landlord === 'user' ? '😮 农民赢了' : '🎉 农民赢了！');
    else statusText = isUserTurn ? '轮到你出牌' : `等待${seatDisplayName(game.seats[game.turnIdx])}出牌...`;

    el.innerHTML = `
      <div style="text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:6px;">${escapeHtml(statusText)}</div>
      <div style="font-size:12px; color:#8b98a5; text-align:center; margin-bottom:6px;">你是${game.landlord === 'user' ? '地主' : '农民'}${otherInfoHtml}</div>
      <div style="text-align:center; font-size:12px; margin-bottom:6px;">${lastPlayHtml}</div>
      <div>你的牌（${game.hands.user.length}张，点击选中要出的牌）：</div>
      <div class="pk-hand">${handHtml}</div>
      <div style="display:flex; justify-content:center; gap:10px; margin-top:12px; flex-wrap:wrap;">
        ${isUserTurn ? `<button class="btn-edit-small" onclick="window.__pkDdzPlay('${sessionId}')">出牌</button>` : ''}
        ${isUserTurn && game.lastPlayerIdx !== null && game.lastPlayerIdx !== game.turnIdx ? `<button class="btn-edit-small" onclick="window.__pkDdzPass('${sessionId}')">过牌</button>` : ''}
        ${game.status === 'finished' ? `<button class="btn-edit-small" onclick="document.getElementById('ddzFloatPanel').style.display='none'; window.__pkSetGame('ddz','${sessionId}',null); if(typeof onMiniGameIconClick==='function') onMiniGameIconClick();">再来一局</button>` : ''}
        <button class="btn-edit-small" onclick="document.getElementById('ddzFloatPanel').style.display='none'">收起</button>
      </div>`;
  }

  // ================= 注册到核心小游戏框架 =================
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'card_gaosi',
      name: '拼大小',
      icon: '🎴',
      getStatus: function () { return null; },
      onStart: function (sessionId, opponentCharIds) { startGaoSi(sessionId, (opponentCharIds || [])[0]); }
    });

    registerMiniGame({
      id: 'card_blackjack',
      name: '21点',
      icon: '🃏',
      getStatus: function (sessionId) { const g = getGame('blackjack', sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openBlackjackPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startBlackjack(sessionId, (opponentCharIds || [])[0]); }
    });

    registerMiniGame({
      id: 'card_uno',
      name: '接龙',
      icon: '🌈',
      getStatus: function (sessionId) { const g = getGame('unoChain', sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openUnoPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startUnoChain(sessionId, (opponentCharIds || [])[0]); }
    });

    registerMiniGame({
      id: 'card_ddz',
      name: '斗地主',
      icon: '🎮',
      minOpponents: 2,
      getStatus: function (sessionId) { const g = getGame('ddz', sessionId); return g ? (g.status === 'bidding' ? 'playing' : g.status) : null; },
      onResume: function (sessionId) { openDdzPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startDdz(sessionId, opponentCharIds); }
    });
  } else {
    console.error('打牌插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ UNO（正版 108 张规则）============
(function () {
  if (window.__unoRealPluginInstalled) return;
  window.__unoRealPluginInstalled = true;

  const STORE_KEY = 'unoRealGamesV1';
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

  const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
  const UNO_COLOR_NAME = { red: '红', yellow: '黄', green: '绿', blue: '蓝', wild: '万能' };
  const UNO_VALUE_NAME = { skip: '禁止', reverse: '反转', draw2: '+2' };

  function buildUnoDeck() {
    let deck = [];
    for (const color of UNO_COLORS) {
      deck.push({ color, value: '0' });
      for (let n = 1; n <= 9; n++) { deck.push({ color, value: String(n) }); deck.push({ color, value: String(n) }); }
      for (const v of ['skip', 'reverse', 'draw2']) { deck.push({ color, value: v }); deck.push({ color, value: v }); }
    }
    for (let i = 0; i < 4; i++) deck.push({ color: 'wild', value: 'wild' });
    for (let i = 0; i < 4; i++) deck.push({ color: 'wild', value: 'wild4' });
    return deck;
  }

  function unoCardLabel(c) {
    if (c.color === 'wild') return c.value === 'wild' ? '万能变色' : '万能+4';
    return `${UNO_COLOR_NAME[c.color]}${UNO_VALUE_NAME[c.value] || c.value}`;
  }
  function unoCardColorClass(c, activeColorForWild) {
    if (c.color === 'wild') return 'unoreal-wild';
    return 'unoreal-' + c.color;
  }
  function unoPlayable(card, activeColor, topValue) {
    if (card.color === 'wild') return true;
    return card.color === activeColor || card.value === topValue;
  }
  function drawFromPile(game, side) {
    if (game.deck.length === 0) {
      if (game.discard.length <= 1) return null;
      const top = game.discard.pop();
      game.deck = shuffle(game.discard);
      game.discard = [top];
    }
    if (game.deck.length === 0) return null;
    return game.deck.pop();
  }

  // ---------- 开局 ----------
  function startUnoReal(sessionId, opponentCharId) {
    let deck = shuffle(buildUnoDeck());
    const userHand = deck.splice(0, 7);
    const charHand = deck.splice(0, 7);
    // 起始弃牌堆第一张不能是万能+4（官方规则），遇到就放回去重抽
    let firstCard = deck.pop();
    while (firstCard.color === 'wild' && firstCard.value === 'wild4') {
      deck.unshift(firstCard);
      deck = shuffle(deck);
      firstCard = deck.pop();
    }
    const activeColor = firstCard.color === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : firstCard.color;
    const firstTurn = Math.random() < 0.5 ? 'user' : 'char';
    const game = {
      status: 'playing',
      opponentCharId,
      deck, discard: [firstCard],
      hands: { user: userHand, char: charHand },
      turn: firstTurn,
      activeColor,
      hasDrawnThisTurn: false,
      pendingWildIdx: null,
      winner: null,
    };
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    let startMsg = `🎴 UNO对局开始！你和${char ? char.name : '对方'}各摸了7张牌，起始牌是${unoCardLabel(firstCard)}`;
    if (firstCard.color === 'wild') startMsg += `，随机指定了${UNO_COLOR_NAME[activeColor]}色`;
    startMsg += `，${firstTurn === 'user' ? '你' : (char ? char.name : '对方')}先出牌。`;
    globalChats[sessionId].push({ sender: 'system', text: startMsg, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openUnoRealPanel(sessionId);
    driveUnoTurns(sessionId);
  }

  // ---------- 效果应用：返回 {msg, extraTurn} ----------
  function applyUnoEffect(game, side, card, chosenColor) {
    const other = side === 'user' ? 'char' : 'user';
    let msg = unoCardLabel(card);
    let extraTurn = false;
    if (card.color === 'wild') {
      game.activeColor = chosenColor;
      msg += `（指定颜色：${UNO_COLOR_NAME[chosenColor]}）`;
      if (card.value === 'wild4') {
        let drawn = 0;
        for (let i = 0; i < 4; i++) { const d = drawFromPile(game, other); if (d) { game.hands[other].push(d); drawn++; } }
        msg += `，${other === 'user' ? '你' : '对方'}被罚摸${drawn}张牌并跳过回合`;
        extraTurn = true;
      }
    } else {
      game.activeColor = card.color;
      if (card.value === 'skip' || card.value === 'reverse') {
        msg += card.value === 'skip' ? '（跳过对方回合）' : '（反转方向，双人对战等同跳过对方回合）';
        extraTurn = true;
      } else if (card.value === 'draw2') {
        let drawn = 0;
        for (let i = 0; i < 2; i++) { const d = drawFromPile(game, other); if (d) { game.hands[other].push(d); drawn++; } }
        msg += `，${other === 'user' ? '你' : '对方'}被罚摸${drawn}张牌并跳过回合`;
        extraTurn = true;
      }
    }
    game.discard.push(card);
    return { msg, extraTurn };
  }

  // ---------- 结束对局 ----------
  async function finishUnoReal(sessionId, winnerSide) {
    let game = getGame(sessionId);
    game.status = 'finished';
    game.winner = winnerSide;
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: winnerSide === 'user' ? `🎉 你出完了所有牌，赢得了这局UNO！` : `😮 ${char ? char.name : '对方'}先出完了牌，赢得了这局UNO。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderUnoRealPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
    if (char) {
      const resultText = winnerSide === 'user' ? `你赢了，${char.name}输了` : `${char.name}赢了，你输了`;
      await askCharGameEndComment(char, sessionId, 'UNO', resultText);
    }
  }

  function checkUnoCallout(sessionId, side) {
    const game = getGame(sessionId);
    if (!game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    if (game.hands[side].length === 1) {
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `${side === 'user' ? '你' : (char ? char.name : '对方')} 只剩1张牌了，喊了一声 UNO！`, timestamp: Date.now() });
    }
  }

  // ---------- 用户操作 ----------
  function userClickUnoHand(sessionId, idx) {
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user') return;
    const card = game.hands.user[idx];
    if (!card) return;
    if (!unoPlayable(card, game.activeColor, game.discard[game.discard.length - 1].value)) { alert('这张牌颜色和数字/图案都对不上，不能出'); return; }
    if (card.color === 'wild') {
      game.pendingWildIdx = idx;
      setGame(sessionId, game);
      renderUnoRealPanel(sessionId);
      return;
    }
    finalizeUserUnoPlay(sessionId, idx, null);
  }
  window.__unorealClickHand = userClickUnoHand;

  function userPickUnoColor(sessionId, color) {
    const game = getGame(sessionId);
    if (!game || game.pendingWildIdx === null) return;
    const idx = game.pendingWildIdx;
    game.pendingWildIdx = null;
    setGame(sessionId, game);
    finalizeUserUnoPlay(sessionId, idx, color);
  }
  window.__unorealPickColor = userPickUnoColor;

  function userCancelUnoPending(sessionId) {
    const game = getGame(sessionId);
    if (!game) return;
    game.pendingWildIdx = null;
    setGame(sessionId, game);
    renderUnoRealPanel(sessionId);
  }
  window.__unorealCancelPending = userCancelUnoPending;

  async function finalizeUserUnoPlay(sessionId, handIdx, chosenColor) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user') return;
    const card = game.hands.user[handIdx];
    if (!card) return;
    game.hands.user.splice(handIdx, 1);
    const { msg, extraTurn } = applyUnoEffect(game, 'user', card, chosenColor);
    game.hasDrawnThisTurn = false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `出牌：${msg}`, timestamp: Date.now(), readBy: [] });
    renderChatMessages(); saveAllData();

    if (game.hands.user.length === 0) { setGame(sessionId, game); await finishUnoReal(sessionId, 'user'); return; }
    checkUnoCallout(sessionId, 'user');
    if (!extraTurn) game.turn = 'char';
    setGame(sessionId, game);
    renderUnoRealPanel(sessionId);
    await driveUnoTurns(sessionId);
  }

  async function userDrawUno(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user' || game.hasDrawnThisTurn) return;
    const card = drawFromPile(game, 'user');
    game.hasDrawnThisTurn = true;
    if (card) {
      game.hands.user.push(card);
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'me', text: '摸了一张牌', timestamp: Date.now(), readBy: [] });
      renderChatMessages(); saveAllData();
    }
    setGame(sessionId, game);
    renderUnoRealPanel(sessionId);
  }
  window.__unorealDraw = userDrawUno;

  async function userEndUnoTurn(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turn !== 'user' || !game.hasDrawnThisTurn) return;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: '结束回合', timestamp: Date.now(), readBy: [] });
    game.hasDrawnThisTurn = false;
    game.turn = 'char';
    setGame(sessionId, game);
    renderChatMessages(); saveAllData();
    renderUnoRealPanel(sessionId);
    await driveUnoTurns(sessionId);
  }
  window.__unorealEndTurn = userEndUnoTurn;

  // ---------- 回合驱动器：char连续行动直到轮到用户或对局结束 ----------
  async function driveUnoTurns(sessionId) {
    while (true) {
      let game = getGame(sessionId);
      if (!game || game.status !== 'playing') return;
      if (game.turn === 'user') { renderUnoRealPanel(sessionId); return; }
      await runCharUnoTurnOnce(sessionId);
    }
  }

  async function runCharUnoTurnOnce(sessionId) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const hand = game.hands.char;
    const topCard = game.discard[game.discard.length - 1];
    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const handText = hand.map(unoCardLabel).join('、');

    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩UNO纸牌游戏。规则：出的牌必须和当前生效颜色相同，或者和牌堆最上面那张的数字/图案相同才能出；万能牌任何时候都能出。
当前牌堆最上面是：${unoCardLabel(topCard)}，当前生效颜色是：${UNO_COLOR_NAME[game.activeColor]}
你手里的牌：${handText}
请决定你要出哪张牌（写出跟"你手里的牌"里完全一样的文字，比如"红5"或"万能变色"），如果没有能出的牌就输出"摸牌"。
只输出严格JSON，不要markdown代码块包裹：
{"play": "牌面文字或摸牌", "chooseColor": "red/yellow/green/blue，只有出万能牌时才需要，否则填null", "message": "你出牌时说的一句话，符合人设语气，不超过20字"}`;

    let playLabel = null, chooseColor = null, message = '';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed) { playLabel = parsed.play || null; chooseColor = parsed.chooseColor || null; message = parsed.message || ''; }
      }
    } catch (e) {}

    let idx = -1;
    if (playLabel && playLabel !== '摸牌') idx = hand.findIndex(c => unoCardLabel(c) === playLabel && unoPlayable(c, game.activeColor, topCard.value));
    if (idx === -1 && playLabel !== '摸牌') idx = hand.findIndex(c => unoPlayable(c, game.activeColor, topCard.value));

    if (message) pluginCharSay(sessionId, char, message);

    if (idx === -1) {
      // 摸牌
      const drawn = drawFromPile(game, 'char');
      let extraLog = '摸了一张牌';
      let playedAfterDraw = false;
      if (drawn) {
        hand.push(drawn);
        if (unoPlayable(drawn, game.activeColor, game.discard[game.discard.length - 1].value)) {
          // 摸到能出的牌就立刻打出去（简化：不再多问一次AI，直接出）
          const dIdx = hand.length - 1;
          const card = hand[dIdx];
          hand.splice(dIdx, 1);
          const dColor = card.color === 'wild' ? chooseColorHeuristic(hand) : null;
          const { msg } = applyUnoEffectAndAdvance(game, 'char', card, dColor);
          extraLog = `摸牌后接着出了：${msg}`;
          playedAfterDraw = true;
        } else {
          game.turn = 'user';
        }
      } else {
        extraLog = '牌堆已经摸空了，跳过';
        game.turn = 'user';
      }
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `${char.name} ${extraLog}`, timestamp: Date.now() });
      renderChatMessages(); saveAllData();
      if (game.hands.char.length === 0) { setGame(sessionId, game); await finishUnoReal(sessionId, 'char'); return; }
      if (playedAfterDraw) checkUnoCallout(sessionId, 'char');
      setGame(sessionId, game);
      renderUnoRealPanel(sessionId);
      return;
    }

    const card = hand[idx];
    hand.splice(idx, 1);
    const color = card.color === 'wild' ? (['red', 'yellow', 'green', 'blue'].includes(chooseColor) ? chooseColor : chooseColorHeuristic(hand)) : null;
    applyUnoEffectAndAdvance(game, 'char', card, color);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `${char.name} 出牌：${unoCardLabel(card)}${card.color === 'wild' ? `（指定颜色：${UNO_COLOR_NAME[color]}）` : ''}`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    if (game.hands.char.length === 0) { setGame(sessionId, game); await finishUnoReal(sessionId, 'char'); return; }
    checkUnoCallout(sessionId, 'char');
    setGame(sessionId, game);
    renderUnoRealPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
  }

  function chooseColorHeuristic(hand) {
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach(c => { if (counts[c.color] !== undefined) counts[c.color]++; });
    let best = 'red', bestCount = -1;
    for (const col of ['red', 'yellow', 'green', 'blue']) { if (counts[col] > bestCount) { bestCount = counts[col]; best = col; } }
    return best;
  }

  function applyUnoEffectAndAdvance(game, side, card, chosenColor) {
    const result = applyUnoEffect(game, side, card, chosenColor);
    game.turn = result.extraTurn ? side : (side === 'user' ? 'char' : 'user');
    return result;
  }

  // ---------- 样式 ----------
  const unoRealStyle = document.createElement('style');
  unoRealStyle.textContent = `
    .unoreal-panel-body { max-width: 320px; }
    .unoreal-status { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:6px; }
    .unoreal-top { text-align:center; margin-bottom:8px; }
    .unoreal-card { display:inline-block; padding:5px 8px; margin:2px; border-radius:6px; font-weight:bold; font-size:12px; text-align:center; min-width:24px; border:2px solid #333; }
    .unoreal-red { background:#ffdcdc; border-color:#e0245e; color:#a3123c; }
    .unoreal-yellow { background:#fff6cf; border-color:#c9a400; color:#7a5f00; }
    .unoreal-green { background:#dcf5dc; border-color:#17bf63; color:#0d7a3e; }
    .unoreal-blue { background:#dceaff; border-color:#1d9bf0; color:#0d5c94; }
    .unoreal-wild { background:#2a2f36; border-color:#888; color:#fff; }
    .unoreal-hand-card { cursor:pointer; }
    .unoreal-color-btn { margin:2px; }
  `;
  document.head.appendChild(unoRealStyle);

  function unoCardHtml(c) {
    return `<span class="unoreal-card ${unoCardColorClass(c)}">${unoCardLabel(c)}</span>`;
  }

  function openUnoRealPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('unoRealFloatPanel', '🎴 UNO');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('unoRealBody')) body.innerHTML = `<div id="unoRealBody" class="unoreal-panel-body"></div>`;
    renderUnoRealPanel(sessionId);
  }

  function renderUnoRealPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('unoRealBody');
    if (!el || !game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const charName = char ? char.name : '对方';
    const topCard = game.discard[game.discard.length - 1];

    let statusText;
    if (game.status === 'finished') statusText = game.winner === 'user' ? '🎉 你赢了！' : `😮 ${charName}赢了`;
    else statusText = game.turn === 'user' ? '轮到你出牌' : `${charName}思考中...`;

    let pendingHtml = '';
    if (game.pendingWildIdx !== null && game.hands.user[game.pendingWildIdx]) {
      pendingHtml = `<div class="gy-game-infobox">
        选择要指定的颜色：
        <div style="margin-top:6px;">
          <button class="btn-edit-small unoreal-color-btn" onclick="window.__unorealPickColor('${sessionId}','red')">红</button>
          <button class="btn-edit-small unoreal-color-btn" onclick="window.__unorealPickColor('${sessionId}','yellow')">黄</button>
          <button class="btn-edit-small unoreal-color-btn" onclick="window.__unorealPickColor('${sessionId}','green')">绿</button>
          <button class="btn-edit-small unoreal-color-btn" onclick="window.__unorealPickColor('${sessionId}','blue')">蓝</button>
        </div>
        <button class="btn-edit-small" style="margin-top:6px;" onclick="window.__unorealCancelPending('${sessionId}')">取消</button>
      </div>`;
    }

    const handHtml = game.hands.user.map((c, i) => `<span class="unoreal-card unoreal-hand-card ${unoCardColorClass(c)}" onclick="window.__unorealClickHand('${sessionId}',${i})">${unoCardLabel(c)}</span>`).join('');
    const isUserTurn = game.status === 'playing' && game.turn === 'user' && game.pendingWildIdx === null;

    el.innerHTML = `
      <div class="unoreal-status">${escapeHtml(statusText)}</div>
      <div class="unoreal-top">当前牌堆：${unoCardHtml(topCard)}　生效颜色：<span class="unoreal-card ${game.activeColor ? ('unoreal-' + game.activeColor) : ''}">${UNO_COLOR_NAME[game.activeColor]}</span></div>
      <div style="text-align:center; font-size:12px; color:#8b98a5;">牌堆剩${game.deck.length}张　${charName}还剩${game.hands.char.length}张牌</div>
      ${pendingHtml}
      <div style="text-align:center; font-size:11px; color:#8b98a5; margin-top:6px;">你的手牌（${game.hands.user.length}张）：</div>
      <div class="pk-hand" style="display:flex; flex-wrap:wrap; justify-content:center;">${handHtml}</div>
      <div style="display:flex; justify-content:center; gap:10px; margin-top:10px; flex-wrap:wrap;">
        ${isUserTurn && !game.hasDrawnThisTurn ? `<button class="btn-edit-small" onclick="window.__unorealDraw('${sessionId}')">摸牌</button>` : ''}
        ${isUserTurn && game.hasDrawnThisTurn ? `<button class="btn-edit-small" onclick="window.__unorealEndTurn('${sessionId}')">结束回合</button>` : ''}
        ${game.status === 'finished' ? `<button class="btn-edit-small" onclick="document.getElementById('unoRealFloatPanel').style.display='none'; window.__pkSetUnoRealGame('${sessionId}',null); if(typeof onMiniGameIconClick==='function') onMiniGameIconClick();">再来一局</button>` : ''}
        <button class="btn-edit-small" onclick="document.getElementById('unoRealFloatPanel').style.display='none'">收起</button>
      </div>`;
  }
  window.__pkSetUnoRealGame = setGame;

  function pluginCharSay(sessionId, char, text) {
    if (typeof miniGameCharSay === 'function') return miniGameCharSay(sessionId, char, text);
    if (!text || !char) return false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: text, timestamp: Date.now(), readBy: [] });
    return true;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'uno_real',
      name: 'UNO',
      icon: '🎴',
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openUnoRealPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startUnoReal(sessionId, (opponentCharIds || [])[0]); }
    });
  } else {
    console.error('UNO插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();

// ============ 昆特牌 ============
(function () {
  if (window.__gwentPluginInstalled) return;
  window.__gwentPluginInstalled = true;

  const STORE_KEY = 'gwentGamesV1';
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

  const ROW_NAMES = { melee: '近战', ranged: '远程', siege: '攻城' };

  // ---------- 卡池（原创卡名，仅借用昆特牌的排位/天气/密探/军号/灼烧/诱饵机制，不含任何版权角色）----------
  const GWENT_CARD_POOL = [
    { name: '北方民兵', row: 'melee', power: 2, type: 'unit', count: 3 },
    { name: '坦莫利亚长枪兵', row: 'melee', power: 3, type: 'unit', count: 3 },
    { name: '蓝衣长条军团精锐', row: 'melee', power: 5, type: 'unit', count: 2 },
    { name: '杰洛特', row: 'melee', power: 10, type: 'unit', isHero: true, count: 1 },
    { name: '迪科斯特拉', row: 'melee', power: 2, type: 'spy', count: 1 },
    { name: '松鼠党弓箭手', row: 'ranged', power: 2, type: 'unit', count: 3 },
    { name: '瑞达尼亚弩手', row: 'ranged', power: 3, type: 'unit', count: 3 },
    { name: '松鼠党神射手', row: 'ranged', power: 5, type: 'unit', count: 2 },
    { name: '米尔娃', row: 'ranged', power: 10, type: 'unit', isHero: true, count: 1 },
    { name: '瓦提尔·德·瑞多', row: 'ranged', power: 2, type: 'spy', count: 1 },
    { name: '北方投石车', row: 'siege', power: 3, type: 'unit', count: 3 },
    { name: '尼弗迦德攻城塔', row: 'siege', power: 4, type: 'unit', count: 3 },
    { name: '瑞达尼亚重炮兵', row: 'siege', power: 6, type: 'unit', count: 2 },
    { name: '恩希尔皇帝', row: 'siege', power: 10, type: 'unit', isHero: true, count: 1 },
    { name: '史蒂芬·斯凯伦', row: 'siege', power: 2, type: 'spy', count: 1 },
    { name: '刺骨冰霜', row: 'melee', type: 'weather', count: 1 },
    { name: '遮蔽之雾', row: 'ranged', type: 'weather', count: 1 },
    { name: '磅礴大雨', row: 'siege', type: 'weather', count: 1 },
    { name: '晴朗天气', type: 'clear', count: 2 },
    { name: '指挥官的号角', type: 'horn', count: 2 },
    { name: '灼烧', type: 'scorch', count: 1 },
    { name: '诱饵', type: 'decoy', count: 2 },
  ];

  function buildFullDeckPool() {
    let pool = []; let uid = 0;
    for (const def of GWENT_CARD_POOL) {
      for (let i = 0; i < def.count; i++) {
        pool.push({ uid: 'c' + (uid++), name: def.name, row: def.row, power: def.power, type: def.type, isHero: !!def.isHero });
      }
    }
    return pool;
  }

  function buildTwoDecks() {
    const all = shuffle(buildFullDeckPool());
    return { userDeck: all.slice(0, 20), charDeck: all.slice(20, 40) };
  }

  function cardTypeLabel(c) {
    if (c.type === 'unit' || c.type === 'spy') return `${ROW_NAMES[c.row]}${c.isHero ? '英雄' : (c.type === 'spy' ? '密探' : '单位')}·${c.power}力量`;
    if (c.type === 'weather') return `天气·${ROW_NAMES[c.row]}结冰`;
    if (c.type === 'clear') return '晴天(清除全部天气)';
    if (c.type === 'horn') return '军号(选一排己方非英雄单位力量翻倍)';
    if (c.type === 'scorch') return '灼烧(摧毁全场力量最高的非英雄单位)';
    if (c.type === 'decoy') return '诱饵(把己方一个非英雄单位换回手牌)';
    return c.name;
  }
  function cardShortLabel(c) { return c.name; }

  // ---------- 战力计算 ----------
  function computeRowPower(sideBoard, weather, row) {
    const cards = sideBoard[row];
    const heroSum = cards.filter(c => c.isHero).reduce((s, c) => s + c.power, 0);
    const nonHeroBase = cards.filter(c => !c.isHero).reduce((s, c) => s + (weather[row] ? 1 : c.power), 0);
    const mult = sideBoard.hornRows[row] ? 2 : 1;
    return heroSum + nonHeroBase * mult;
  }
  function computeSideTotal(sideBoard, weather) {
    return ['melee', 'ranged', 'siege'].reduce((s, row) => s + computeRowPower(sideBoard, weather, row), 0);
  }

  // ---------- 开局 ----------
  async function startGwent(sessionId, opponentCharId) {
    const { userDeck, charDeck } = buildTwoDecks();
    const userHand = userDeck.splice(0, 8);
    const charHand = charDeck.splice(0, 8);
    const firstSide = Math.random() < 0.5 ? 'user' : 'char';
    const game = {
      status: 'playing',
      opponentCharId,
      hands: { user: userHand, char: charHand },
      decks: { user: userDeck, char: charDeck },
      board: {
        user: { melee: [], ranged: [], siege: [], hornRows: { melee: false, ranged: false, siege: false } },
        char: { melee: [], ranged: [], siege: [], hornRows: { melee: false, ranged: false, siege: false } },
      },
      weather: { melee: false, ranged: false, siege: false },
      roundsWon: { user: 0, char: 0 },
      roundNum: 1,
      turnSide: firstSide,
      passed: { user: false, char: false },
      winner: null,
      pendingAction: null,
    };
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == opponentCharId);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'system', text: `🃏 昆特牌对局开始！三局两胜，你和${char ? char.name : '对方'}各自摸了8张牌，${firstSide === 'user' ? '你' : (char ? char.name : '对方')}先出牌。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    openGwentPanel(sessionId);
    await driveTurns(sessionId);
  }

  // ---------- 出牌效果应用（不含合法性判断，调用前请先确认可以出）----------
  // side: 出牌方 'user'|'char'；返回 { logText } 用于系统消息
  function applyCardEffect(game, side, card, target) {
    const other = side === 'user' ? 'char' : 'user';
    if (card.type === 'unit') {
      game.board[side][card.row].push(card);
      return `${cardShortLabel(card)}（${ROW_NAMES[card.row]}，力量${card.power}）`;
    }
    if (card.type === 'spy') {
      // 密探放在对方那一排，为对方增加力量，但出牌方额外抽2张牌
      game.board[other][card.row].push(card);
      let drawn = 0;
      for (let i = 0; i < 2; i++) { if (game.decks[side].length > 0) { game.hands[side].push(game.decks[side].pop()); drawn++; } }
      return `${cardShortLabel(card)}（密探，放在对方${ROW_NAMES[card.row]}排，${side === 'user' ? '你' : '对方'}额外抽了${drawn}张牌）`;
    }
    if (card.type === 'weather') {
      game.weather[card.row] = true;
      return `${cardShortLabel(card)}（${ROW_NAMES[card.row]}排陷入天气效果，双方非英雄单位力量降为1）`;
    }
    if (card.type === 'clear') {
      game.weather = { melee: false, ranged: false, siege: false };
      return `${cardShortLabel(card)}（清除了场上所有天气效果）`;
    }
    if (card.type === 'horn') {
      const row = target && target.row ? target.row : 'melee';
      game.board[side].hornRows[row] = true;
      return `${cardShortLabel(card)}（${side === 'user' ? '你' : '对方'}的${ROW_NAMES[row]}排非英雄单位力量翻倍）`;
    }
    if (card.type === 'scorch') {
      let maxPower = 0;
      const allNonHero = [];
      for (const s of ['user', 'char']) {
        for (const row of ['melee', 'ranged', 'siege']) {
          for (const c of game.board[s][row]) {
            if (c.isHero) continue;
            const effPower = game.weather[row] ? 1 : c.power;
            allNonHero.push({ side: s, row, card: c, effPower });
            if (effPower > maxPower) maxPower = effPower;
          }
        }
      }
      if (maxPower <= 0) return `${cardShortLabel(card)}（场上没有可摧毁的单位，没有效果）`;
      const toDestroy = allNonHero.filter(x => x.effPower === maxPower);
      for (const x of toDestroy) {
        const arr = game.board[x.side][x.row];
        const idx = arr.findIndex(c => c === x.card);
        if (idx >= 0) arr.splice(idx, 1);
      }
      const names = toDestroy.map(x => cardShortLabel(x.card)).join('、');
      return `${cardShortLabel(card)}（摧毁了力量最高的单位：${names}）`;
    }
    if (card.type === 'decoy') {
      if (!target || !target.row || target.cardUid == null) return `${cardShortLabel(card)}（没有可换回的目标，浪费了）`;
      const arr = game.board[side][target.row];
      const idx = arr.findIndex(c => c.uid === target.cardUid);
      if (idx < 0) return `${cardShortLabel(card)}（目标已经不在场上了，浪费了）`;
      const [returned] = arr.splice(idx, 1);
      game.hands[side].push(returned);
      return `${cardShortLabel(card)}（把${cardShortLabel(returned)}换回了${side === 'user' ? '你' : '对方'}的手牌）`;
    }
    return '';
  }

  function findDecoyTargets(game, side) {
    const targets = [];
    for (const row of ['melee', 'ranged', 'siege']) {
      for (const c of game.board[side][row]) { if (!c.isHero) targets.push({ row, cardUid: c.uid, card: c }); }
    }
    return targets;
  }

  // ---------- 回合与回合结束 ----------
  function otherSide(side) { return side === 'user' ? 'char' : 'user'; }

  function advanceTurnAfterAction(game, actingSide) {
    const other = otherSide(actingSide);
    if (!game.passed[other]) game.turnSide = other;
    else game.turnSide = actingSide; // 对方已过牌，继续轮到自己
  }

  async function checkRoundEnd(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing') return false;
    if (!(game.passed.user && game.passed.char)) return false;

    const userTotal = computeSideTotal(game.board.user, game.weather);
    const charTotal = computeSideTotal(game.board.char, game.weather);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    let roundWinner = null;
    if (userTotal > charTotal) roundWinner = 'user';
    else if (charTotal > userTotal) roundWinner = 'char';

    if (roundWinner) game.roundsWon[roundWinner]++;

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const resultLine = roundWinner ? `第${game.roundNum}局：你 ${userTotal} : ${charTotal} ${char ? char.name : '对方'}，${roundWinner === 'user' ? '你' : (char ? char.name : '对方')}赢下这局！` : `第${game.roundNum}局：你 ${userTotal} : ${charTotal} ${char ? char.name : '对方'}，战平，这局谁都没拿下！`;
    globalChats[sessionId].push({ sender: 'system', text: resultLine, timestamp: Date.now() });

    setGame(sessionId, game);
    renderChatMessages(); saveAllData();
    renderGwentPanel(sessionId);

    if (game.roundsWon.user >= 2 || game.roundsWon.char >= 2 || game.roundNum >= 3) {
      await finishGwentMatch(sessionId);
      return true;
    }

    // 输的一方（或战平双方）补抽1张牌，清空场面和天气，进入下一局
    const losers = roundWinner ? [otherSide(roundWinner)] : ['user', 'char'];
    for (const s of losers) {
      if (game.decks[s].length > 0) game.hands[s].push(game.decks[s].pop());
    }
    game.board = {
      user: { melee: [], ranged: [], siege: [], hornRows: { melee: false, ranged: false, siege: false } },
      char: { melee: [], ranged: [], siege: [], hornRows: { melee: false, ranged: false, siege: false } },
    };
    game.weather = { melee: false, ranged: false, siege: false };
    game.passed = { user: false, char: false };
    game.roundNum++;
    // 上一局输的一方这一局先手；战平则维持原来的先手方
    game.turnSide = roundWinner ? otherSide(roundWinner) : game.turnSide;
    setGame(sessionId, game);

    globalChats[sessionId].push({ sender: 'system', text: `第${game.roundNum}局开始，场面清空，${losers.length === 2 ? '双方各' : (losers[0] === 'user' ? '你' : (char ? char.name : '对方'))}补抽了1张牌。`, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderGwentPanel(sessionId);
    return false;
  }

  async function finishGwentMatch(sessionId) {
    let game = getGame(sessionId);
    game.status = 'finished';
    if (game.roundsWon.user > game.roundsWon.char) game.winner = 'user';
    else if (game.roundsWon.char > game.roundsWon.user) game.winner = 'char';
    else game.winner = 'draw';
    setGame(sessionId, game);
    const char = myCharacters.find(c => c.id == game.opponentCharId);

    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    const sysText = game.winner === 'draw' ? `整场比赛打成${game.roundsWon.user}:${game.roundsWon.char}，平局！` : (game.winner === 'user' ? `你以${game.roundsWon.user}:${game.roundsWon.char}赢得了整场昆特牌对局！` : `${char ? char.name : '对方'}以${game.roundsWon.char}:${game.roundsWon.user}赢得了整场昆特牌对局。`);
    globalChats[sessionId].push({ sender: 'system', text: sysText, timestamp: Date.now() });
    renderChatMessages(); saveAllData();
    renderGwentPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();

    if (char) {
      const resultText = game.winner === 'draw' ? '平局' : (game.winner === 'user' ? `你赢了，${char.name}输了` : `${char.name}赢了，你输了`);
      await askCharGameEndComment(char, sessionId, '昆特牌', resultText);
    }
  }

  // ---------- 用户操作 ----------
  function userClickHandCard(sessionId, idx) {
    const game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turnSide !== 'user' || game.passed.user) return;
    const card = game.hands.user[idx];
    if (!card) return;
    if (card.type === 'horn') {
      game.pendingAction = { kind: 'horn', handIdx: idx };
      setGame(sessionId, game);
      renderGwentPanel(sessionId);
      return;
    }
    if (card.type === 'decoy') {
      const targets = findDecoyTargets(game, 'user');
      if (targets.length === 0) { alert('你场上没有可以换回来的非英雄单位'); return; }
      game.pendingAction = { kind: 'decoy', handIdx: idx };
      setGame(sessionId, game);
      renderGwentPanel(sessionId);
      return;
    }
    finalizeUserPlay(sessionId, idx, null);
  }
  window.__gwentClickHand = userClickHandCard;

  function userPickTarget(sessionId, targetPayload) {
    const game = getGame(sessionId);
    if (!game || !game.pendingAction) return;
    const idx = game.pendingAction.handIdx;
    game.pendingAction = null;
    setGame(sessionId, game);
    finalizeUserPlay(sessionId, idx, targetPayload);
  }
  window.__gwentPickTarget = userPickTarget;

  function userCancelPending(sessionId) {
    const game = getGame(sessionId);
    if (!game) return;
    game.pendingAction = null;
    setGame(sessionId, game);
    renderGwentPanel(sessionId);
  }
  window.__gwentCancelPending = userCancelPending;

  async function finalizeUserPlay(sessionId, handIdx, target) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turnSide !== 'user' || game.passed.user) return;
    const card = game.hands.user[handIdx];
    if (!card) return;
    game.hands.user.splice(handIdx, 1);
    const logText = applyCardEffect(game, 'user', card, target);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: `出牌：${logText}`, timestamp: Date.now(), readBy: [] });
    advanceTurnAfterAction(game, 'user');
    setGame(sessionId, game);
    renderChatMessages(); saveAllData();
    renderGwentPanel(sessionId);
    await driveTurns(sessionId);
  }

  async function userPassGwent(sessionId) {
    let game = getGame(sessionId);
    if (!game || game.status !== 'playing' || game.turnSide !== 'user' || game.passed.user) return;
    game.passed.user = true;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: 'me', text: '过牌', timestamp: Date.now(), readBy: [] });
    advanceTurnAfterAction(game, 'user');
    setGame(sessionId, game);
    renderChatMessages(); saveAllData();
    renderGwentPanel(sessionId);
    await driveTurns(sessionId);
  }
  window.__gwentPass = userPassGwent;

  // ---------- 回合驱动器：自动处理"手牌打完自动过牌"和AI连续出牌，直到轮到用户操作或整场结束 ----------
  async function driveTurns(sessionId) {
    while (true) {
      let game = getGame(sessionId);
      if (!game || game.status !== 'playing') return;

      if (game.passed.user && game.passed.char) {
        const ended = await checkRoundEnd(sessionId);
        if (ended) return;
        continue;
      }

      if (game.turnSide === 'user') {
        if (game.passed.user) { game.turnSide = 'char'; setGame(sessionId, game); continue; }
        if (game.hands.user.length === 0) {
          game.passed.user = true;
          if (!globalChats[sessionId]) globalChats[sessionId] = [];
          globalChats[sessionId].push({ sender: 'system', text: '你的手牌已经打完，自动过牌。', timestamp: Date.now() });
          advanceTurnAfterAction(game, 'user');
          setGame(sessionId, game);
          renderChatMessages(); saveAllData(); renderGwentPanel(sessionId);
          continue;
        }
        renderGwentPanel(sessionId);
        return;
      } else {
        if (game.passed.char) { game.turnSide = 'user'; setGame(sessionId, game); continue; }
        await runCharGwentTurnOnce(sessionId);
        continue;
      }
    }
  }

  async function playCharCard(sessionId, game, char, cardIdx, target, message) {
    const hand = game.hands.char;
    const card = hand[cardIdx];
    hand.splice(cardIdx, 1);
    const logText = applyCardEffect(game, 'char', card, target);
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    if (message) pluginCharSay(sessionId, char, message);
    globalChats[sessionId].push({ sender: 'system', text: `${char.name} 出牌：${logText}`, timestamp: Date.now() });
    advanceTurnAfterAction(game, 'char');
    setGame(sessionId, game);
    renderChatMessages(); saveAllData(); renderGwentPanel(sessionId);
    if (typeof refreshMiniGameIconBadge === 'function') refreshMiniGameIconBadge();
  }

  async function runCharGwentTurnOnce(sessionId) {
    let game = getGame(sessionId);
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const hand = game.hands.char;

    if (hand.length === 0) {
      game.passed.char = true;
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      globalChats[sessionId].push({ sender: 'system', text: `${char.name}的手牌已经打完，自动过牌。`, timestamp: Date.now() });
      advanceTurnAfterAction(game, 'char');
      setGame(sessionId, game);
      renderChatMessages(); saveAllData(); renderGwentPanel(sessionId);
      return;
    }

    const api = getApiConfig(true);
    const recentHistory = buildTimeAwareHistoryText(globalChats[sessionId].slice(-chatHistoryTurns));
    const userTotal = computeSideTotal(game.board.user, game.weather);
    const charTotal = computeSideTotal(game.board.char, game.weather);
    function boardRowText(side) {
      return ['melee', 'ranged', 'siege'].map(row => {
        const cards = game.board[side][row];
        const names = cards.map(c => `${cardShortLabel(c)}(${c.isHero ? '英雄' : (game.weather[row] ? '1(天气)' : c.power)})`).join('、') || '空';
        const hornTxt = game.board[side].hornRows[row] ? '[已吹军号x2]' : '';
        return `${ROW_NAMES[row]}${hornTxt}: ${names}`;
      }).join('\n');
    }
    const handText = hand.map(c => `${cardShortLabel(c)}(${cardTypeLabel(c)})`).join('、');

    const prompt = `${buildBasePrompt(char, true, recentHistory)}
你在和用户玩昆特牌风格的卡牌对战。规则：近战/远程/攻城三排各自的力量总和相加，一局结束时（双方都选择"过"）总力量高的一方赢下这一局，三局两胜。
当前是第${game.roundNum}局，比分 你${game.roundsWon.char}:${game.roundsWon.user}用户。
当前场面：
【你的牌】
${boardRowText('char')}
（你当前总力量：${charTotal}）
【用户的牌】
${boardRowText('user')}
（用户当前总力量：${userTotal}）
天气效果：近战${game.weather.melee ? '结冰(非英雄单位力量降为1)' : '正常'}，远程${game.weather.ranged ? '结冰' : '正常'}，攻城${game.weather.siege ? '结冰' : '正常'}。

你手里的牌：${handText}
卡牌说明：普通/密探单位放到对应排增加力量（密探要放在对方那一排，但你能额外抽2张牌）；天气牌让指定排双方非英雄单位力量都降为1；晴天清除所有天气；军号让你指定的一排非英雄单位力量翻倍；灼烧摧毁全场（双方）力量最高的非英雄单位；诱饵能把你自己场上一个非英雄单位换回手牌，没有非英雄单位在场上就别选诱饵。

请决定你要出哪张牌，或者选择过牌（过牌后这局你就不能再出牌了，除非用户也过牌，这局才会结束）。
只输出严格JSON，不要markdown代码块包裹：
{"play": "牌名，比如\\"弓箭手\\"，如果选择过牌就填null", "hornRow": "melee或ranged或siege，只有出军号时才需要，否则填null", "message": "你出牌或过牌时说的一句话，符合人设语气，不超过25字"}`;

    let playName = null, hornRow = null, message = '';
    try {
      const data = await callChatCompletionAPI(api, prompt);
      if (!data.error) {
        const raw = (data.choices?.[0]?.message?.content || '').trim();
        const parsed = extractJsonObject(raw);
        if (parsed) { playName = parsed.play || null; hornRow = parsed.hornRow || null; message = parsed.message || ''; }
      }
    } catch (e) {}

    let cardIdx = playName ? hand.findIndex(c => c.name === playName) : -1;
    if (cardIdx === -1 && playName !== null) {
      cardIdx = hand.findIndex(c => c.type === 'unit' || c.type === 'spy');
    }

    if (cardIdx === -1) {
      game.passed.char = true;
      if (!globalChats[sessionId]) globalChats[sessionId] = [];
      if (message) pluginCharSay(sessionId, char, message);
      globalChats[sessionId].push({ sender: 'system', text: `${char.name} 选择过牌`, timestamp: Date.now() });
      advanceTurnAfterAction(game, 'char');
      setGame(sessionId, game);
      renderChatMessages(); saveAllData(); renderGwentPanel(sessionId);
      return;
    }

    const card = hand[cardIdx];
    let target = null;
    if (card.type === 'horn') {
      const validRows = ['melee', 'ranged', 'siege'];
      target = { row: validRows.includes(hornRow) ? hornRow : validRows[Math.floor(Math.random() * 3)] };
    } else if (card.type === 'decoy') {
      const targets = findDecoyTargets(game, 'char');
      if (targets.length === 0) {
        const fallbackIdx = hand.findIndex((c, i) => i !== cardIdx && (c.type === 'unit' || c.type === 'spy'));
        if (fallbackIdx >= 0) { await playCharCard(sessionId, game, char, fallbackIdx, null, message); return; }
        game.passed.char = true;
        if (!globalChats[sessionId]) globalChats[sessionId] = [];
        if (message) pluginCharSay(sessionId, char, message);
        globalChats[sessionId].push({ sender: 'system', text: `${char.name} 选择过牌`, timestamp: Date.now() });
        advanceTurnAfterAction(game, 'char');
        setGame(sessionId, game);
        renderChatMessages(); saveAllData(); renderGwentPanel(sessionId);
        return;
      }
      const weakest = targets.reduce((a, b) => (a.card.power <= b.card.power ? a : b));
      target = { row: weakest.row, cardUid: weakest.cardUid };
    }

    await playCharCard(sessionId, game, char, cardIdx, target, message);
  }

  // ---------- 样式 ----------
  const gwentStyle = document.createElement('style');
  gwentStyle.textContent = `
    .gwent-panel-body { max-width: 340px; }
    .gwent-scoreboard { text-align:center; font-weight:bold; color:#1d9bf0; margin-bottom:6px; }
    .gwent-side-total { text-align:center; font-size:12px; color:#8b98a5; margin-bottom:4px; }
    .gwent-rows { border:1px solid #333; border-radius:8px; overflow:hidden; margin-bottom:6px; }
    .gwent-row { display:flex; flex-wrap:wrap; align-items:center; gap:3px; padding:4px 6px; min-height:30px; border-bottom:1px solid rgba(255,255,255,0.08); background:#16181c; }
    .gwent-row.weather-on { background:#1a2a3a; }
    .gwent-row-label { font-size:11px; color:#8b98a5; width:34px; flex-shrink:0; }
    .gwent-card { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; width:44px; height:44px; border-radius:6px; background:#2a2f36; color:#fff; font-size:10px; text-align:center; padding:2px; cursor:default; border:1px solid #444; }
    .gwent-card.hero { border-color:#f9a825; background:#3a2f10; }
    .gwent-card.spy { border-color:#1d9bf0; }
    .gwent-card-power { font-weight:bold; font-size:13px; }
    .gwent-hand-strip { display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin:6px 0; }
    .gwent-hand-card { cursor:pointer; }
    .gwent-hand-card.pending { outline:2px solid #f91880; }
    .gwent-target-row-btn { margin:2px; }
  `;
  document.head.appendChild(gwentStyle);

  function gwentCardHtml(c, weatherOn) {
    const power = c.isHero ? c.power : (weatherOn ? 1 : c.power);
    const cls = 'gwent-card' + (c.isHero ? ' hero' : '') + (c.type === 'spy' ? ' spy' : '');
    return `<div class="${cls}" title="${escapeHtml(cardTypeLabel(c))}"><div>${escapeHtml(c.name)}</div><div class="gwent-card-power">${power}</div></div>`;
  }

  function gwentHandCardHtml(sessionId, c, idx, pending) {
    let display;
    if (c.type === 'unit' || c.type === 'spy') display = `${escapeHtml(c.name)}<br><b>${c.power}</b>`;
    else display = escapeHtml(c.name);
    const cls = 'gwent-card gwent-hand-card' + (c.isHero ? ' hero' : '') + (c.type === 'spy' ? ' spy' : '') + (pending ? ' pending' : '');
    return `<div class="${cls}" title="${escapeHtml(cardTypeLabel(c))}" onclick="window.__gwentClickHand('${sessionId}',${idx})">${display}</div>`;
  }

  function openGwentPanel(sessionId) {
    const panel = createMiniGameFloatingPanel('gwentFloatPanel', '🃏 昆特牌');
    panel.style.display = 'block';
    const body = panel.querySelector('.mini-game-float-body');
    if (!document.getElementById('gwentBody')) body.innerHTML = `<div id="gwentBody" class="gwent-panel-body"></div>`;
    renderGwentPanel(sessionId);
  }

  function renderGwentPanel(sessionId) {
    const game = getGame(sessionId);
    const el = document.getElementById('gwentBody');
    if (!el || !game) return;
    const char = myCharacters.find(c => c.id == game.opponentCharId);
    const charName = char ? char.name : '对方';

    const userTotal = computeSideTotal(game.board.user, game.weather);
    const charTotal = computeSideTotal(game.board.char, game.weather);

    let statusText;
    if (game.status === 'finished') {
      statusText = game.winner === 'draw' ? `🤝 整场比赛平局 ${game.roundsWon.user}:${game.roundsWon.char}` : (game.winner === 'user' ? `🎉 你赢得了整场比赛 ${game.roundsWon.user}:${game.roundsWon.char}` : `😮 ${charName}赢得了整场比赛 ${game.roundsWon.char}:${game.roundsWon.user}`);
    } else if (game.passed.user && game.passed.char) {
      statusText = '本局结算中...';
    } else if (game.turnSide === 'user') {
      statusText = game.passed.user ? `等待${charName}...` : '轮到你出牌';
    } else {
      statusText = game.passed.char ? '轮到你出牌' : `${charName}思考中...`;
    }

    function rowsHtml(side) {
      return ['melee', 'ranged', 'siege'].map(row => {
        const cards = game.board[side][row];
        const weatherOn = game.weather[row];
        const cardsHtml = cards.map(c => gwentCardHtml(c, weatherOn)).join('') || '<span style="color:#555; font-size:11px;">（空）</span>';
        const hornTag = game.board[side].hornRows[row] ? ' 📯x2' : '';
        return `<div class="gwent-row${weatherOn ? ' weather-on' : ''}"><span class="gwent-row-label">${ROW_NAMES[row]}${weatherOn ? '❄️' : ''}${hornTag}</span>${cardsHtml}</div>`;
      }).join('');
    }

    let pendingHtml = '';
    if (game.pendingAction) {
      const pa = game.pendingAction;
      const card = game.hands.user[pa.handIdx];
      if (card && pa.kind === 'horn') {
        pendingHtml = `<div class="gy-game-infobox">
          选择军号要加成的排：
          <div style="margin-top:6px;">
            <button class="btn-edit-small gwent-target-row-btn" onclick="window.__gwentPickTarget('${sessionId}', {row:'melee'})">近战</button>
            <button class="btn-edit-small gwent-target-row-btn" onclick="window.__gwentPickTarget('${sessionId}', {row:'ranged'})">远程</button>
            <button class="btn-edit-small gwent-target-row-btn" onclick="window.__gwentPickTarget('${sessionId}', {row:'siege'})">攻城</button>
          </div>
          <button class="btn-edit-small" style="margin-top:6px;" onclick="window.__gwentCancelPending('${sessionId}')">取消</button>
        </div>`;
      } else if (card && pa.kind === 'decoy') {
        const targets = findDecoyTargets(game, 'user');
        const btns = targets.map(t => `<button class="btn-edit-small gwent-target-row-btn" onclick="window.__gwentPickTarget('${sessionId}', {row:'${t.row}', cardUid:'${t.cardUid}'})">${escapeHtml(cardShortLabel(t.card))}(${ROW_NAMES[t.row]})</button>`).join('');
        pendingHtml = `<div class="gy-game-infobox">
          选择要换回手牌的单位：<div style="margin-top:6px;">${btns}</div>
          <button class="btn-edit-small" style="margin-top:6px;" onclick="window.__gwentCancelPending('${sessionId}')">取消</button>
        </div>`;
      }
    }

    const handHtml = game.hands.user.map((c, i) => gwentHandCardHtml(sessionId, c, i, game.pendingAction && game.pendingAction.handIdx === i)).join('');
    const isUserTurn = game.status === 'playing' && game.turnSide === 'user' && !game.passed.user && !game.pendingAction;

    el.innerHTML = `
      <div class="gwent-scoreboard">${escapeHtml(statusText)}　🏆 你${game.roundsWon.user} : ${game.roundsWon.char}${escapeHtml(charName)}　（第${game.roundNum}局）</div>
      <div class="gwent-side-total">${escapeHtml(charName)} 总力量：${charTotal}</div>
      <div class="gwent-rows">${rowsHtml('char')}</div>
      <div class="gwent-rows">${rowsHtml('user')}</div>
      <div class="gwent-side-total">你 总力量：${userTotal}</div>
      ${pendingHtml}
      <div style="text-align:center; font-size:11px; color:#8b98a5; margin-top:4px;">你的手牌（${game.hands.user.length}张，牌堆还剩${game.decks.user.length}张）</div>
      <div class="gwent-hand-strip">${handHtml}</div>
      <div style="display:flex; justify-content:center; gap:10px; margin-top:8px; flex-wrap:wrap;">
        ${isUserTurn ? `<button class="btn-edit-small" onclick="window.__gwentPass('${sessionId}')">过牌</button>` : ''}
        ${game.status === 'finished' ? `<button class="btn-edit-small" onclick="document.getElementById('gwentFloatPanel').style.display='none'; window.__pkSetGwentGame('${sessionId}',null); if(typeof onMiniGameIconClick==='function') onMiniGameIconClick();">再来一局</button>` : ''}
        <button class="btn-edit-small" onclick="document.getElementById('gwentFloatPanel').style.display='none'">收起</button>
      </div>`;
  }
  window.__pkSetGwentGame = setGame;

  function pluginCharSay(sessionId, char, text) {
    if (typeof miniGameCharSay === 'function') return miniGameCharSay(sessionId, char, text);
    if (!text || !char) return false;
    if (!globalChats[sessionId]) globalChats[sessionId] = [];
    globalChats[sessionId].push({ sender: char.id, text: text, timestamp: Date.now(), readBy: [] });
    return true;
  }

  // ---------- 注册进核心小游戏框架 ----------
  if (typeof registerMiniGame === 'function') {
    registerMiniGame({
      id: 'gwent_style',
      name: '昆特牌',
      icon: '🃏',
      getStatus: function (sessionId) { const g = getGame(sessionId); return g ? g.status : null; },
      onResume: function (sessionId) { openGwentPanel(sessionId); },
      onStart: function (sessionId, opponentCharIds) { startGwent(sessionId, (opponentCharIds || [])[0]); }
    });
  } else {
    console.error('昆特牌插件：没有找到核心小游戏框架（registerMiniGame），请确认网页已经更新到支持小游戏框架的版本。');
  }
})();
