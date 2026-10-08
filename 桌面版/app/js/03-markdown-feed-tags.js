// ===================== 轻量 Markdown 渲染（兼容同类软件角色卡常用的 *动作* **强调** `代码` 语法）=====================
// 很多角色卡自带的HTML卡片（比如状态栏）用的是写死的id（像id="o3-dr"这种），每次这个正则脚本
// 触发都会生成一模一样的id。同一个聊天里发过好几次这种卡片，页面上就会有一堆重复id——这是不合法的HTML，
// 会导致"点展开箭头没反应"（label的for=只会绑定到文档里第一个同名id，不一定是自己这张卡片里的那个），
// 也可能让后面的卡片意外继承前面卡片"展开/收起"的状态。这里给每条消息的卡片id都加上专属后缀，让它们互不干扰。
function namespaceInjectedIds(html, uniqueSuffix) {
    if (!html || html.indexOf('id=') === -1) return html; 
    const ids = [...new Set([...html.matchAll(/\s(?:id|for)=["']([\w-]+)["']/g)].map(m => m[1]))];
    if (ids.length === 0) return html;
    let result = html;
    ids.forEach(id => {
        // 1. 替换 HTML 标签上的 id="xxx" 或 for="xxx"
        result = result.replace(new RegExp(`\\b(id|for)=(["'])${id}\\2`, 'g'), (m, attr, quote) => `${attr}=${quote}${id}_${uniqueSuffix}${quote}`);
        
        // 2. 替换内嵌 <style> 里的 #xxx 选择器
        result = result.replace(new RegExp(`#${id}\\b`, 'g'), `#${id}_${uniqueSuffix}`);
        
        // 3. 🔥新增修复：同步替换 JS 脚本或 onclick 事件里被当做参数传递的旧 ID (例如 o3Tog('o3-dr'))
        result = result.replace(new RegExp(`(\\(\\s*)(["']|&quot;|&apos;)${id}\\2(\\s*\\))`, 'g'), (m, pre, quote, post) => `${pre}${quote}${id}_${uniqueSuffix}${quote}${post}`);
    });
    return result;
}
// 角色卡的状态栏卡片，正则替换进来的往往是一整段 HTML 文档片段——里面混着
// <meta>/<title>/<style>/<script> 这些本身不显示的标签，标签之间还带着源码缩进换行。
// 而气泡/章节容器为了保留正文换行用的是 white-space:pre-wrap，于是这些"纯粹是源码格式"
// 的换行全被当成真的空行渲染出来，表现就是卡片上下各顶出一大片空白。
//
// 在 HTML 字符串上跑正则很难分清"源码缩进"和"正文里真正的空行"，所以改成渲染完之后
// 直接在 DOM 上处理：只摘掉紧贴元素的纯空白文本节点，正文段落之间的空行一个不动。
function pruneCardWhitespace(container) {
    if (!container) return;
    Array.from(container.childNodes).forEach(n => {
        if (n.nodeType !== 3) return;                       // 只看文本节点
        const prev = n.previousSibling, next = n.nextSibling;
        const prevIsEl = prev && prev.nodeType === 1;
        const nextIsEl = next && next.nodeType === 1;
        if (n.textContent.trim() === '') {
            // 整段都是空白：只要它夹在元素旁边，就是源码缩进留下的，直接摘掉
            if (prevIsEl || nextIsEl) n.remove();
            return;
        }
        // 有正文的文本节点：只收掉紧贴元素那一侧的多余空白，
        // 卡片本身有 margin，不靠这些换行撑间距
        if (nextIsEl) n.textContent = n.textContent.replace(/\s+$/, '');
        if (prevIsEl) n.textContent = n.textContent.replace(/^\s+/, '');
    });
}

// ===================== 角色卡「前端界面」隔离渲染 =====================
// 这是"状态栏死活显示不对"的真正根因。
//
// 现在流行的角色卡，状态栏/开场白/手账本这些正则脚本，replaceString 里塞的不是一小段
// <div>，而是**一整份完整的 HTML 文档**——从 <!DOCTYPE html> 开始，带 <head>、带 <meta>、
// 带一大坨 <style>，还带 <script> 做交互（点击展开、切页签、存进度）。
//
// 之前白露是把这份文档直接 innerHTML 塞进气泡里的，四件事同时出问题：
//   1. innerHTML 会把 <!DOCTYPE>/<html>/<head>/<body> 直接丢掉，<meta>/<title>/<link>
//      这些不该显示的东西反而漏到正文里，变成一截怪文字。
//   2. innerHTML 塞进去的 <script> **永远不会执行**——所有靠 JS 的卡片（展开/收起、
//      切页签、进度条）全是死的，看起来就是"卡片没显示全""点了没反应"。
//   3. 卡片的 <style> 是按"我就是整个页面"写的，里面全是 body{...}、*{...}、.container{...}
//      这种全局选择器。塞进白露的页面之后，这些规则**反向污染整个 app**——字体、背景、
//      间距全被改掉；同时卡片自己也被白露的样式压住，经常直接塌成高度 0。
//   4. 好几张卡片同时出现时，它们的全局样式互相打架，谁后渲染谁赢，表现极其随机。
//
// 同类软件那边（JS-Slash-Runner）从来就不是这么干的：它把每一个"看起来像完整前端页面"的
// 代码块**单独丢进一个 iframe** 里渲染。iframe 自带文档边界，样式进不来也出不去，
// <script> 正常执行，高度由里面量好了报给外面。这里照抄同一套做法。
//
// 判定标准也跟同类软件保持完全一致（见其 util/is_frontend.ts）：内容里出现
// 'html>'、'<head>'、'<body' 任意一个，就当成完整前端页面走 iframe；
// 只是一小段 <div> 的（比如霍樊那张状态栏）继续原地内联渲染，不动它。
function isFrontendHtml(content) {
    if (!content || typeof content !== 'string') return false;
    return ['html>', '<head>', '<body'].some(tag => content.indexOf(tag) !== -1);
}

// 卡片脚本里用 jQuery 的不少（8张卡里有5条脚本用到 $）。只在真的用到时才往那个 iframe
// 里挂一个 <script src>，没用到的卡片不背这 87KB；用到的话浏览器也只会下载一次。
//
// ⚠️ 这里**不能**用 fetch 把 jQuery 读成字符串再内联：白露跑在 file://（桌面版 exe、
// HBuilderX 打的 APK 都是），而 Chrome 对 file:// 的 fetch/XHR 一律按跨域拒绝，
// 读出来永远是失败，卡片脚本照样报 "$ is not defined" 当场挂掉。
// <script src> 这条路径不受那个限制，file:// 下能正常加载。
function frontendBaseHref() {
    try {
        const u = document.baseURI || location.href;
        return u.replace(/[^/]*$/, '');
    } catch (e) { return ''; }
}

// 卡片里写 100vh 的话，iframe 高度是按内容量出来的，vh 又是相对 iframe 自己的高度——
// 会互相咬住，卡片要么被压扁成一条要么撑不开。跟同类软件一样，把 vh 换成"外面真实视口高度"
// 这个变量，卡片就能按作者本来的意图占满一屏。
function replaceVhForFrontend(content) {
    if (!/\d+(?:\.\d+)?vh\b/i.test(content)) return content;
    const conv = (v) => v.replace(/(\d+(?:\.\d+)?)vh\b/gi, (m, n) => {
        const p = parseFloat(n);
        if (!isFinite(p)) return m;
        return p === 100 ? 'var(--gy-vh)' : `calc(var(--gy-vh) * ${p / 100})`;
    });
    return content.replace(/((?:min-|max-)?height\s*:\s*)([^;{}"']*?\d+(?:\.\d+)?vh)(?=\s*[;}"'])/gi,
        (_m, prefix, value) => prefix + conv(value));
}

function buildFrontendSrcdoc(content, charId) {
    const vh = (window.innerHeight || 800) + 'px';
    // 卡片里的 getChatMessages 是同步调用的（没有 await），来不及等 iframe 问完主页面再回答，
    // 所以在建 iframe 的这一刻就把需要的数据一起塞进去。见 js/17。
    let tavernCtx = { charId: null, charName: '', userName: '', messages: [], currentMessageId: 0 };
    try {
        if (typeof gyTavernContextFor === 'function') tavernCtx = gyTavernContextFor(charId);
    } catch (e) { console.warn('[同类软件兼容层] 准备上下文失败：', e); }
    // JSON 里如果出现 </script> 会把外面这个 <script> 提前截断，尖括号一律转义掉
    const tavernCtxJson = JSON.stringify(tavernCtx).replace(/</g, '\\u003c');
    const base = frontendBaseHref();
    // ⚠️ 不是"用到 $ 就塞 jQuery"。很多卡片自己写了一个极简的
    //   var $ = function(s, r){ return (r||document).querySelector(s); }
    // 然后拿返回值当**原生 DOM 元素**用（sl.appendChild(...) 这种）。
    // 这时候再塞 jQuery 进去，$ 就可能返回 jQuery 对象，卡片当场报
    // "sl.appendChild is not a function"，整张卡片死掉——本来好好的卡片反而被我们弄坏了。
    // 所以：卡片自己定义了 $ 的，一律不塞，用它自己的。
    const definesOwnDollar = /(?:var|let|const)\s+\$\s*[=,]|window\.\$\s*=|function\s+\$\s*\(/.test(content);
    const needsJq = !definesOwnDollar && /\$\(|\bjQuery\b/.test(content);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${base ? `<base href="${base}">` : ''}
<style>
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0!important;padding:0;overflow:hidden!important;max-width:100%!important;background:transparent;}
:root{--gy-vh:${vh};}
${tavernCtx.charAvatar ? `.char_avatar,.char-avatar{background-image:url('${tavernCtx.charAvatar}');background-size:cover;background-position:center;}` : ''}
${tavernCtx.userAvatar ? `.user_avatar,.user-avatar{background-image:url('${tavernCtx.userAvatar}');background-size:cover;background-position:center;}` : ''}
</style>
<script>
// 有些卡片会用 localStorage 存展开状态/进度。srcdoc 里的 iframe 在 file:// 下
// （桌面版 exe、HBuilderX 打的 APK）拿到的是不透明源，一碰 localStorage 就抛 SecurityError，
// 卡片脚本会当场挂掉、整张卡片变成死的。这里先垫一层：能用就用真的，不能用就退回内存版，
// 保证卡片脚本无论在哪个环境都能跑完。
(function(){
  try { window.localStorage.getItem('__gy_probe__'); return; } catch (e) {}
  var mem = {};
  var shim = {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function(k, v){ mem[k] = String(v); },
    removeItem: function(k){ delete mem[k]; },
    clear: function(){ mem = {}; },
    key: function(i){ return Object.keys(mem)[i] || null; }
  };
  Object.defineProperty(shim, 'length', { get: function(){ return Object.keys(mem).length; } });
  try {
    Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: shim, configurable: true });
  } catch (e) {}
})();
<\/script>
${needsJq ? `<script src="${base}js/vendor/jquery.min.js"><\/script>` : ''}
<script>
// ===== 助手脚本（TavernHelper）兼容层 · iframe 这一侧 =====
// 角色卡的开场白菜单/状态栏/操作栏会直接调 setChatMessages、getChatMessages、
// getVariables、eventOn 这些全局函数，调不到就弹「环境未配置助手脚本」。这里把它们补上：
//   · 读数据的接口 —— 用快照同步回答（卡片是同步调的，等不了 postMessage 往返）
//   · 改数据的接口 —— postMessage 给主页面，由 js/17 接到白露自己的功能上
//   · 快照会在楼层变动后被主页面主动推新的过来，所以卡片手里的数据不会过期
(function(){
  var ctx = ${tavernCtxJson};
  var seq = 0, waiting = {};
  var listeners = {};        // eventOn 注册的监听

  window.addEventListener('message', function(e){
    var d = e.data;
    if (!d) return;

    // 1) 调用的回话
    if (d.__gyTavernReply) {
      var w = waiting[d.__gyTavernReply.id];
      if (!w) return;
      delete waiting[d.__gyTavernReply.id];
      if (d.__gyTavernReply.ok) w.resolve(d.__gyTavernReply.value);
      else w.reject(new Error(d.__gyTavernReply.reason || '调用失败'));
      return;
    }

    // 2) 楼层变了，主页面推来新快照
    if (d.__gyTavernSnapshot) { ctx = d.__gyTavernSnapshot; return; }

    // 3) 事件广播
    if (d.__gyTavernEvent) {
      var ev = d.__gyTavernEvent;
      (listeners[ev.type] || []).slice().forEach(function(fn){
        try { fn.apply(null, ev.args || []); } catch (err) { console.error('[同类软件兼容层] 事件处理出错：', err); }
      });
    }
  });

  function call(method, args){
    return new Promise(function(resolve, reject){
      var id = ++seq;
      waiting[id] = { resolve: resolve, reject: reject };
      try { parent.postMessage({ __gyTavernCall: { id: id, method: method, args: args } }, '*'); }
      catch (err) { delete waiting[id]; reject(err); }
      setTimeout(function(){
        if (waiting[id]) { delete waiting[id]; reject(new Error('主页面没有响应')); }
      }, 8000);
    });
  }

  function clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }

  // 同类软件的 range 写法：0 / '0' / '0-3' / -1（负数＝从后往前数）/ '{{lastMessageId}}'
  function pickMessages(range, option){
    var all = ctx.messages || [];
    var opt = option || {};
    var len = (ctx.lastMessageId != null ? ctx.lastMessageId : all.length - 1) + 1;
    var lo = 0, hi = len - 1;
    if (range !== undefined && range !== null && range !== '') {
      var r = String(range).replace(/\{\{lastMessageId\}\}/gi, String(len - 1)).trim();
      var norm = function(n){ n = parseInt(n, 10); return isNaN(n) ? null : (n < 0 ? len + n : n); };
      var m = r.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
      if (m) { var a = norm(m[1]), b = norm(m[2]); if (a !== null && b !== null) { lo = Math.min(a,b); hi = Math.max(a,b); } }
      else if (/^-?\d+$/.test(r)) { var n = norm(r); if (n !== null) { lo = n; hi = n; } }
    }
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var msg = all[i];
      if (msg.message_id < lo || msg.message_id > hi) continue;
      if (opt.role && opt.role !== 'all' && msg.role !== opt.role) continue;
      if (opt.hide_state === 'hidden' && !msg.is_hidden) continue;
      if (opt.hide_state === 'unhidden' && msg.is_hidden) continue;
      var c = clone(msg);
      if (!opt.include_swipes) { delete c.swipes; delete c.swipes_data; delete c.swipes_info; delete c.swipe_id; }
      out.push(c);
    }
    return out;
  }

  function varStoreFor(option){
    var opt = option || { type: 'chat' };
    if (opt.type === 'message') {
      var all = ctx.messages || [];
      var id = opt.message_id;
      if (id === undefined || id === null || id === 'latest') id = ctx.lastMessageId;
      id = Number(id);
      if (id < 0) id = (ctx.lastMessageId + 1) + id;
      for (var i = 0; i < all.length; i++) if (all[i].message_id === id) return clone(all[i].data || {});
      return {};
    }
    if (opt.type === 'global') return clone(ctx.globalVariables || {});
    return clone(ctx.chatVariables || {});
  }

  function notImplemented(name, fallback){
    return function(){
      console.info('[同类软件兼容层] 这张卡片调用了 ' + name + '()，白露没有对应功能，已安全跳过。');
      return fallback;
    };
  }

  var TavernHelper = {
    // —— 楼层 ——
    getChatMessages: function(range, option){ return pickMessages(range, option); },
    setChatMessages: function(list, option){ return call('setChatMessages', [list, option]); },
    createChatMessages: function(list, option){ return call('createChatMessages', [list, option]); },
    deleteChatMessages: function(ids, option){ return call('deleteChatMessages', [ids, option]); },
    getLastMessageId: function(){ return ctx.lastMessageId != null ? ctx.lastMessageId : -1; },
    getCurrentMessageId: function(){ return ctx.currentMessageId != null ? ctx.currentMessageId : -1; },

    // —— 变量 ——
    // 读是同步的（用快照），写是异步的（发给主页面）。跟同类软件一致。
    getVariables: function(option){ return varStoreFor(option); },
    replaceVariables: function(vars, option){ return call('replaceVariables', [vars, option]); },
    insertOrAssignVariables: function(vars, option){ return call('insertOrAssignVariables', [vars, option]); },
    setVariables: function(vars, option){ return call('insertOrAssignVariables', [vars, option]); },
    deleteVariable: function(path, option){ return call('deleteVariable', [path, option]); },

    // —— 事件 ——
    // 白露真的会发的事件见「助手脚本兼容层说明.md」；监听没有的事件不会报错，只是永远不触发。
    eventOn: function(type, fn){
      if (typeof fn !== 'function') return { stop: function(){} };
      if (!listeners[type]) listeners[type] = [];
      if (listeners[type].indexOf(fn) === -1) listeners[type].push(fn);
      return { stop: function(){ TavernHelper.eventRemoveListener(type, fn); } };
    },
    eventOnce: function(type, fn){
      var once = function(){ TavernHelper.eventRemoveListener(type, once); fn.apply(null, arguments); };
      return TavernHelper.eventOn(type, once);
    },
    eventMakeFirst: function(type, fn){
      TavernHelper.eventRemoveListener(type, fn);
      if (!listeners[type]) listeners[type] = [];
      listeners[type].unshift(fn);
      return { stop: function(){ TavernHelper.eventRemoveListener(type, fn); } };
    },
    eventMakeLast: function(type, fn){
      TavernHelper.eventRemoveListener(type, fn);
      return TavernHelper.eventOn(type, fn);
    },
    eventRemoveListener: function(type, fn){
      var arr = listeners[type];
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    },
    eventClearEvent: function(type){ delete listeners[type]; },
    // 卡片自己发的自定义事件：本地分发一份，同时也让主页面广播给别的卡片
    eventEmit: function(type){
      var args = Array.prototype.slice.call(arguments, 1);
      (listeners[type] || []).slice().forEach(function(f){
        try { f.apply(null, args); } catch (e) { console.error(e); }
      });
      return Promise.resolve();
    },

    // —— 杂项 ——
    triggerSlash: function(cmd){ return call('triggerSlash', [cmd]); },
    getCharData: function(){ return { name: ctx.charName || '' }; },
    substitudeMacros: function(t){
      return String(t == null ? '' : t)
        .replace(/\{\{char\}\}/gi, ctx.charName || '')
        .replace(/\{\{user\}\}/gi, ctx.userName || '')
        .replace(/\{\{lastMessageId\}\}/gi, String(ctx.lastMessageId != null ? ctx.lastMessageId : 0));
    },
    // 注册按钮时主页面用的 script_id 就是这个（见 js/17 的 replaceScriptButtons），
    // 两边必须算出同一个值，getButtonEvent 才能对上
    getScriptId: function(){ return ctx.charId || 'card'; },

    // —— 生成 ——
    // 走白露续写自己那条链路：大纲/人设/世界书/预设/宏全都在，跟你点「续写」得到的是同一套设定。
    generate:    function(config){ return call('generate', [config]); },
    generateRaw: function(config){ return call('generateRaw', [config]); },
    stopAllGeneration: function(){ return call('stopAllGeneration', []); },

    // —— 世界书（worldbook / lorebook 是同一个东西的两套叫法）——
    getWorldbookNames: function(){ return clone(ctx.worldbookNames || []); },
    getWorldbook:      function(name){ return call('getWorldbook', [name]); },
    replaceWorldbook:  function(name, entries){ return call('replaceWorldbook', [name, entries]); },
    createWorldbookEntries: function(name, entries){ return call('replaceWorldbook', [name, entries]); },
    getCharWorldbookNames:  function(id){ return call('getCharWorldbookNames', [id]); },

    // —— 正则 ——
    getTavernRegexes: function(option){ return call('getTavernRegexes', [option]); },
    formatAsTavernRegexedString: function(text, option){ return call('formatAsTavernRegexedString', [text, option]); },
    isCharacterTavernRegexesEnabled: function(){ return true; },

    // —— 显示 ——
    formatAsDisplayedMessage: function(text, option){ return call('formatAsDisplayedMessage', [text, option]); },
    refreshOneMessage: function(){ return call('refreshOneMessage', []); },

    // —— 提示词注入 ——
    injectPrompts:   function(list){ return call('injectPrompts', [list]); },
    uninjectPrompts: function(ids){ return call('uninjectPrompts', [ids]); },

    // —— 角色 / 人设 ——
    getCharacterNames: function(){ return (ctx.characters || []).map(function(c){ return c.name; }); },
    getCharacterIds:   function(){ return (ctx.characters || []).map(function(c){ return c.id; }); },
    getCurrentCharacterId:   function(){ return ctx.charId; },
    getCurrentCharacterName: function(){ return ctx.charName || ''; },
    getCurrentPersonaName:   function(){ return ctx.userName || ''; },   // 就是当前的用户名
    getCharacter: function(id){
      var list = ctx.characters || [];
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id) || list[i].name === id) return clone(list[i]);
      return null;
    },
    // 头像是 base64 直接给的，卡片拿去当 background-image 就能用
    getCharAvatarPath: function(){ return ctx.charAvatar || ''; },
    getUserAvatarPath: function(){ return ctx.userAvatar || ''; },
    getPersonaAvatarPath: function(id){
      if (id === undefined || id === null || id === 'current') return ctx.userAvatar || '';
      var p = TavernHelper.getPersona(id);
      return (p && p.avatar) || ctx.userAvatar || '';
    },

    // —— 预设 ——
    getPresetNames:     function(){ return clone(ctx.presetNames || []); },
    getLoadedPresetName: function(){ return ctx.activePresetName || ''; },
    loadPreset:         function(name){ return call('loadPreset', [name]); },

    // —— 聊天 ——
    getChatHistoryBrief: function(){ return call('getChatHistoryBrief', []); },
    getCurrentChatId:    function(){ return ctx.chatId || ''; },

    // —— 版本 ——
    // 老实说自己是白露，不冒充同类软件版本号——卡片要是按版本号做行为分支，
    // 谎报只会让它走到一条根本没测试过的路上。
    getTavernVersion:       function(){ return (ctx.version && ctx.version.tavern) || ''; },
    getTavernHelperVersion: function(){ return (ctx.version && ctx.version.helper) || ''; },
    getIframeName: function(){ return window.name || ''; },

    // —— 模型列表 ——
    // 走的就是设置页那个「🔄 拉取模型」按钮同一份逻辑，卡片看到的跟你看到的一致
    getModelList: function(which){ return call('getModelList', [which]); },

    // —— 扩展 ＝ 白露的插件 ——
    // 装什么都会先弹框问用户，绝不静默安装；给网址的那种直接拒绝，不下载执行远程代码
    installExtension:   function(payload){ return call('installExtension', [payload]); },
    uninstallExtension: function(name){ return call('uninstallExtension', [name]); },
    isInstalledExtension: function(name){ return call('isInstalledExtension', [name]); },
    getExtensionInstallationInfo: function(){ return call('getExtensionInstallationInfo', []); },
    getExtensionType: function(){ return 'guyu-plugin'; },

    // —— 脚本按钮 ＝ 续写页上方的卡片按钮栏 ——
    replaceScriptButtons: function(scriptId, buttons){
      // 同类软件的签名有两种写法：(script_id, buttons) 和只给 (buttons)
      if (Array.isArray(scriptId)) { buttons = scriptId; scriptId = undefined; }
      return call('replaceScriptButtons', [scriptId, buttons]);
    },
    getScriptButtons: function(scriptId){ return call('getScriptButtons', [scriptId]); },
    updateScriptButtonsWith: function(scriptId, fn){
      // 同类软件这个接口是传一个函数进去改。函数没法跨 iframe 传，所以在本地先算好再整体替换。
      return Promise.resolve(TavernHelper.getScriptButtons(scriptId)).then(function(cur){
        var next = (typeof fn === 'function') ? fn(cur || []) : cur;
        return TavernHelper.replaceScriptButtons(scriptId, next);
      });
    },
    // 按钮点击的事件名。卡片写 eventOn(getButtonEvent('开始'), fn) 就能收到
    getButtonEvent: function(name){ return (TavernHelper.getScriptId() + '_' + name + '_button_clicked'); },
    eventOnButton: function(name, fn){ return TavernHelper.eventOn(TavernHelper.getButtonEvent(name), fn); },

    // —— 音频 ——
    // 卡片放的 BGM / 音效。右下角会出现一个小控制条，你随时能停、能调音量。
    playAudio:         function(cfg){ return call('playAudio', [cfg]); },
    pauseAudio:        function(){ return call('pauseAudio', []); },
    getCurrentAudio:   function(){ return call('getCurrentAudio', []); },
    getAudioSettings:  function(){ return call('getAudioSettings', []); },
    setAudioSettings:  function(s){ return call('setAudioSettings', [s]); },
    getAudioList:      function(){ return call('getAudioList', []); },
    replaceAudioList:  function(l){ return call('replaceAudioList', [l]); },

    // —— 用户人设 ——
    // 同类软件的 persona ＝"你自己"的身份档案，可以存好几个随时切。
    // 白露对应的就是用户资料里那份「人设」列表（userPersonas）。
    getPersonaIds:   function(){ return (ctx.personas || []).map(function(p){ return p.avatar_id; }); },
    getPersonaNames: function(){ return (ctx.personas || []).map(function(p){ return p.name; }); },
    getCurrentPersonaId: function(){ return ctx.currentPersonaId || null; },
    getPersona: function(id){
      var list = ctx.personas || [];
      if (id === 'current' || id === undefined || id === null) id = ctx.currentPersonaId;
      for (var i = 0; i < list.length; i++) {
        if (list[i].avatar_id === id || list[i].name === id || list[i].title === id) return clone(list[i]);
      }
      return null;
    },
    switchPersona: function(id){ return call('switchPersona', [id]); },

    // —— 下面这些在 iframe 里就能自己答，不用问主页面 ——
    getMessageId:   function(){ return ctx.currentMessageId != null ? ctx.currentMessageId : -1; },
    getScriptName:  function(){ return ctx.charName ? (ctx.charName + ' 的卡片组件') : '角色卡组件'; },
    getScriptInfo:  function(){ return { id: TavernHelper.getScriptId(), name: TavernHelper.getScriptName() }; },
    getTavernHelperExtensionId: function(){ return 'guyu-bridge'; },
    isAdmin:        function(){ return false; },
    reloadIframe:   function(){ try { location.reload(); } catch (e) {} },
    eventClearAll:      function(){ listeners = {}; },
    eventClearListener: function(type, fn){ TavernHelper.eventRemoveListener(type, fn); },
    eventEmitAndWait:   function(){ return TavernHelper.eventEmit.apply(null, arguments); },
    // 同类软件用这个包一层来兜住报错，卡片里挺常见
    errorCatched: function(fn){
      return function(){
        try {
          var r = fn.apply(this, arguments);
          return (r && typeof r.catch === 'function') ? r.catch(function(e){ console.error('[卡片]', e); }) : r;
        } catch (e) { console.error('[卡片]', e); }
      };
    },
    // 同类软件的全局初始化，白露这边建 iframe 时就已经准备好了，直接当已完成
    initializeGlobal:      function(){ return Promise.resolve(); },
    waitGlobalInitialized: function(){ return Promise.resolve(); },

    // —— 「传函数进去改」那一类：函数没法跨 iframe 传，所以在本地算好再整体替换 ——
    updateVariablesWith: function(fn, option){
      var cur = TavernHelper.getVariables(option);
      return TavernHelper.replaceVariables((typeof fn === 'function') ? fn(cur) : cur, option);
    },
    insertVariables: function(vars, option){ return TavernHelper.insertOrAssignVariables(vars, option); },
    getAllVariables: function(){
      return { chat: clone(ctx.chatVariables || {}), global: clone(ctx.globalVariables || {}) };
    },

    // —— 需要主页面干活的 ——
    getPreset:        function(name){ return call('getPreset', [name]); },
    deletePreset:     function(name){ return call('deletePreset', [name]); },
    renamePreset:     function(name, next){ return call('renamePreset', [name, next]); },
    getChatHistoryDetail: function(){ return call('getChatHistoryDetail', []); },
    getGlobalWorldbookNames: function(){ return call('getGlobalWorldbookNames', []); },
    createWorldbook:  function(name, entries){ return call('replaceWorldbook', [name, entries]); },
    deleteWorldbook:  function(name){ return call('deleteWorldbook', [name]); },
    deleteWorldbookEntries: function(name, uids){ return call('deleteWorldbookEntries', [name, uids]); },
    updateWorldbookWith: function(name, fn){
      return Promise.resolve(TavernHelper.getWorldbook(name)).then(function(cur){
        return TavernHelper.replaceWorldbook(name, (typeof fn === 'function') ? fn(cur || []) : cur);
      });
    },
    createPersona:    function(name, data){ return call('createPersona', [name, data]); },
    deletePersona:    function(id){ return call('deletePersona', [id]); },
    appendAudioList:  function(list){ return call('appendAudioList', [list]); },
    stopGenerationById: function(){ return call('stopAllGeneration', []); }
  };
  // 别名：有的卡片写单数
  TavernHelper.setChatMessage = TavernHelper.setChatMessages;
  TavernHelper.getChatMessage = TavernHelper.getChatMessages;
  // lorebook 是 worldbook 的老叫法，指的是同一个东西，两套名字都得能用
  TavernHelper.getLorebooks       = TavernHelper.getWorldbookNames;
  TavernHelper.getLorebookEntries = TavernHelper.getWorldbook;
  TavernHelper.setLorebookEntries = TavernHelper.replaceWorldbook;
  TavernHelper.createLorebookEntries = TavernHelper.createWorldbookEntries;
  TavernHelper.getCharLorebooks   = TavernHelper.getCharWorldbookNames;
  TavernHelper.getCurrentCharPrimaryLorebook = function(){
    return Promise.resolve(TavernHelper.getCharWorldbookNames()).then(function(r){ return (r && r.primary) || null; });
  };

  window.TavernHelper = TavernHelper;

  // 同类软件的事件名常量，卡片会写 tavern_events.MESSAGE_UPDATED 这种
  window.tavern_events = {
    MESSAGE_SENT: 'message_sent', MESSAGE_RECEIVED: 'message_received',
    MESSAGE_UPDATED: 'message_updated', MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted', MESSAGE_SWIPED: 'message_swiped',
    CHAT_CHANGED: 'chat_id_changed',
    GENERATION_STARTED: 'generation_started', GENERATION_ENDED: 'generation_ended',
    GENERATION_STOPPED: 'generation_stopped',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    USER_MESSAGE_RENDERED: 'user_message_rendered'
  };
  window.iframe_events = {
    MESSAGE_IFRAME_RENDER_STARTED: 'message_iframe_render_started',
    MESSAGE_IFRAME_RENDER_ENDED: 'message_iframe_render_ended'
  };

  // ⚠️ 兜底：助手脚本总共有 161 个接口，白露真正接上的是其中一部分。
  // 剩下那些如果**压根不定义**，卡片一调就是 "xxx is not a function" —— 整个脚本当场断在那里，
  // 后面的界面全废。这比返回个空值糟得多。
  //
  // 所以把同类软件的接口名单整个列在这儿，凡是上面没实现的，一律装一个安全空实现：
  // 按名字猜一个合理的返回值（列表类给 []、判断类给 false、写操作给 resolved Promise），
  // 并在控制台留一行说明是哪张卡想干什么。卡片顶多少个效果，不会整张崩掉。
  var ST_API = [
    'appendAudioList',
    'appendInexistentScriptButtons',
    'createCharacter',
    'createChatMessages',
    'createLorebook',
    'createLorebookEntries',
    'createOrReplaceCharacter',
    'createOrReplacePersona',
    'createOrReplacePreset',
    'createOrReplaceWorldbook',
    'createPersona',
    'createPreset',
    'createWorldbook',
    'createWorldbookEntries',
    'deleteCharacter',
    'deleteChatMessages',
    'deleteLorebook',
    'deleteLorebookEntries',
    'deletePersona',
    'deletePreset',
    'deleteVariable',
    'deleteWorldbook',
    'deleteWorldbookEntries',
    'errorCatched',
    'eventClearAll',
    'eventClearEvent',
    'eventClearListener',
    'eventEmit',
    'eventEmitAndWait',
    'eventMakeFirst',
    'eventMakeLast',
    'eventOn',
    'eventOnButton',
    'eventOnce',
    'eventRemoveListener',
    'formatAsDisplayedMessage',
    'formatAsTavernRegexedString',
    'generate',
    'generateRaw',
    'getAllEnabledScriptButtons',
    'getAllVariables',
    'getAudioList',
    'getAudioSettings',
    'getButtonEvent',
    'getCharAvatarPath',
    'getCharData',
    'getCharLorebooks',
    'getCharWorldbookNames',
    'getCharacter',
    'getCharacterIds',
    'getCharacterNames',
    'getChatHistoryBrief',
    'getChatHistoryDetail',
    'getChatLorebook',
    'getChatMessages',
    'getChatWorldbookName',
    'getCurrentAudio',
    'getCurrentCharPrimaryLorebook',
    'getCurrentCharacterId',
    'getCurrentCharacterName',
    'getCurrentMessageId',
    'getCurrentPersonaId',
    'getCurrentPersonaName',
    'getExtensionInstallationInfo',
    'getExtensionType',
    'getGlobalWorldbookNames',
    'getIframeName',
    'getLastMessageId',
    'getLoadedPresetName',
    'getLorebookEntries',
    'getLorebookSettings',
    'getLorebooks',
    'getMessageId',
    'getModelList',
    'getOrCreateChatLorebook',
    'getOrCreateChatWorldbook',
    'getPersona',
    'getPersonaAvatarPath',
    'getPersonaIds',
    'getPersonaNames',
    'getPreset',
    'getPresetNames',
    'getProxyPresetNames',
    'getScriptButtons',
    'getScriptId',
    'getScriptInfo',
    'getScriptName',
    'getScriptTrees',
    'getTavernHelperExtensionId',
    'getTavernHelperVersion',
    'getTavernRegexes',
    'getTavernVersion',
    'getVariables',
    'getWorldbook',
    'getWorldbookNames',
    'importRawCharacter',
    'importRawChat',
    'importRawPreset',
    'importRawTavernRegex',
    'importRawWorldbook',
    'initializeGlobal',
    'injectPrompts',
    'insertOrAssignVariables',
    'insertVariables',
    'installExtension',
    'isAdmin',
    'isCharacterTavernRegexesEnabled',
    'isInstalledExtension',
    'isPresetNormalPrompt',
    'isPresetPlaceholderPrompt',
    'isPresetSystemPrompt',
    'loadPreset',
    'pauseAudio',
    'playAudio',
    'rebindCharWorldbooks',
    'rebindChatWorldbook',
    'rebindGlobalWorldbooks',
    'refreshOneMessage',
    'registerMacroLike',
    'registerVariableSchema',
    'reinstallExtension',
    'reloadIframe',
    'renamePreset',
    'replaceAudioList',
    'replaceCharacter',
    'replaceLorebookEntries',
    'replacePersona',
    'replacePreset',
    'replaceScriptButtons',
    'replaceScriptInfo',
    'replaceScriptTrees',
    'replaceTavernRegexes',
    'replaceVariables',
    'replaceWorldbook',
    'retrieveDisplayedMessage',
    'rotateChatMessages',
    'setAudioSettings',
    'setChatLorebook',
    'setChatMessages',
    'setCurrentCharLorebooks',
    'setLorebookEntries',
    'setLorebookSettings',
    'setPreset',
    'stopAllGeneration',
    'stopGenerationById',
    'substitudeMacros',
    'triggerSlash',
    'uninjectPrompts',
    'uninstallExtension',
    'unregisterMacroLike',
    'updateCharacterWith',
    'updateExtension',
    'updateLorebookEntriesWith',
    'updatePersonaWith',
    'updatePresetWith',
    'updateScriptButtonsWith',
    'updateScriptTreesWith',
    'updateTavernRegexesWith',
    'updateVariablesWith',
    'updateWorldbookWith',
    'waitGlobalInitialized'
  ];
  var SAFE = {};
  ST_API.forEach(function(name){
    if (typeof TavernHelper[name] === 'function') return;
    var kind = 'other';
    if (/^is[A-Z]/.test(name)) kind = 'bool';
    else if (/(Names|Ids|List|Entries|Buttons|Trees|Messages)$/.test(name)) kind = 'array';
    else if (/^(create|delete|replace|update|set|rebind|import|register|unregister|reinstall|rotate|append|initialize|wait)/.test(name)) kind = 'promise';
    else if (/^get/.test(name)) kind = 'object';
    SAFE[name] = (function(n, k){
      return function(){
        console.info('[同类软件兼容层] 这张卡片调用了 ' + n + '()，白露没有对应功能，已安全跳过。');
        if (k === 'bool') return false;
        if (k === 'array') return [];
        if (k === 'promise') return Promise.resolve(undefined);
        if (k === 'object') return {};
        return undefined;
      };
    })(name, kind);
    // 打个标记：调试时能一眼看出"这个接口是兜底的空实现，不是真的接上了"
    SAFE[name].__gySafeStub = kind;
    TavernHelper[name] = SAFE[name];
  });

  // 卡片绝大多数是直接调裸函数名的（setChatMessages(...) 而不是 TavernHelper.setChatMessages(...)），
  // 所以每个方法都再挂一份到全局
  Object.keys(TavernHelper).forEach(function(k){
    if (window[k] === undefined) window[k] = TavernHelper[k];
  });
})();
<\/script>
<script>
// 把量好的高度报给外面。iframe 里的内容是异步的（字体、图片、卡片自己的脚本），
// 所以不能只量一次——用 ResizeObserver 一直盯着，卡片展开/收起时高度也跟着变。
(function(){
  var last = -1;
  function measure(){
    var b = document.body;
    if (!b) return 0;
    // ⚠️ 只能量 body，**绝对不能**把 documentElement 算进来：
    // html 元素是撑满 iframe 的，它的 scrollHeight 恒等于 iframe 当前高度。
    // 一旦把它算进最大值，量出来的高度就永远 >= 现在的高度——高度只增不减，
    // 卡住在 CSS 里那个初始值上再也下不来（表现就是"卡片只露出一小条"）。
    var h = Math.max(b.scrollHeight, b.offsetHeight);
    // 🐛 很多状态栏卡片（手账本、模拟器那种"整屏界面"）根容器是 position:absolute/fixed 的，
    // 这类元素**根本不计入 scrollHeight**——只按 scrollHeight 量，量出来就是几十像素，
    // 卡片看起来就是"只露出一条边"。这里把脱离文档流的元素单独量一遍最下沿补上。
    try {
      var all = b.querySelectorAll('*');
      var n = Math.min(all.length, 4000);
      for (var i = 0; i < n; i++) {
        var el = all[i];
        var cs = getComputedStyle(el);
        var pos = cs.position;
        if (pos !== 'absolute' && pos !== 'fixed') continue;
        // 藏着的弹窗/遮罩（visibility:hidden、透明度 0）不算——不然一个没弹出来的确认框就把卡片撑出一大片空白
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        var hid = false;
        for (var up = el; up && up !== b; up = up.parentElement) { if (parseFloat(getComputedStyle(up).opacity) === 0) { hid = true; break; } }
        if (hid) continue;
        // 收着的 <details> 里面的东西看不见，也不算
        try { var dt = el.closest('details:not([open])'); if (dt && !el.closest('summary')) continue; } catch (e) {}
        var rect = el.getBoundingClientRect();
        if (rect.height <= 0) continue;
        var bottom = rect.bottom + (window.scrollY || 0);
        if (bottom > h) h = bottom;
      }
    } catch (e) {}
    return Math.ceil(h);
  }
  function report(){
    try {
      var h = measure();
      if (!isFinite(h) || h <= 0) return;
      // 差一两像素就别来回抖了
      if (Math.abs(h - last) < 2) return;
      last = h;
      parent.postMessage({ __gyFrontendHeight: h }, '*');
    } catch (e) {}
  }
  window.addEventListener('load', report);
  document.addEventListener('DOMContentLoaded', report);
  window.addEventListener('message', function(e){
    if (e.data && e.data.__gyFrontendPing) { last = -1; report(); }
  });
  if (typeof ResizeObserver === 'function') {
    var ro = new ResizeObserver(function(){ report(); });
    var start = function(){ if (document.body) ro.observe(document.body); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  // 卡片里的图片加载完往往会把高度顶上去，补几次兜底
  [80, 300, 800, 2000].forEach(function(ms){ setTimeout(report, ms); });
})();
<\/script>
</head>
<body>
${content}
</body>
</html>`;
}

// renderMarkdownLite 是个纯函数（只吐字符串），但 iframe 必须是真的 DOM 元素才能建。
// 所以渲染时先留一个占位 div，把源码暂存起来；等这段 HTML 真的被插进页面之后，
// 下面的 MutationObserver 再把占位替换成 iframe。这样所有调用 renderMarkdownLite 的
// 地方（续写、小说章节、推文、日记、评论、论坛……）都不用改，自动都能用上。
const __frontendPending = new Map();
let __frontendSeq = 0;
function makeFrontendPlaceholder(html, charId) {
    const id = 'gyfe_' + (++__frontendSeq);
    __frontendPending.set(id, { html: html, charId: charId });
    // 存档里可能留着很久以前渲染过、但一直没被挂载的占位（比如渲染完没插进页面就被丢弃了），
    // 不清理的话这个 Map 会一直涨。只保留最近的一批。
    if (__frontendPending.size > 200) {
        const oldest = __frontendPending.keys().next().value;
        __frontendPending.delete(oldest);
    }
    return `<div class="gy-frontend" data-frontend-id="${id}"></div>`;
}

function mountFrontendFrames(root) {
    const scope = (root && root.querySelectorAll) ? root : document;
    const list = scope.querySelectorAll('.gy-frontend[data-frontend-id]');
    if (!list.length) return;
    list.forEach(ph => {
        const id = ph.getAttribute('data-frontend-id');
        const src = __frontendPending.get(id);
        ph.removeAttribute('data-frontend-id');
        if (src === undefined) return;
        __frontendPending.delete(id);
        const frame = document.createElement('iframe');
        frame.className = 'gy-frontend-frame';
        frame.setAttribute('frameborder', '0');
        frame.setAttribute('scrolling', 'no');
        frame.setAttribute('loading', 'lazy');
        // 给每个卡片 iframe 一个名字：调试时能一眼认出是哪一张，
        // 卡片自己调 getIframeName() 也能拿到（同类软件那边也有这个接口）
        frame.name = id;
        // 不加 sandbox：卡片脚本要能正常跑（同类软件那边也是不加的）。iframe 自带的
        // 文档边界已经把样式冲突这个真正的问题解决掉了。
        frame.__gyFrontendSrc = src;
        frame.srcdoc = buildFrontendSrcdoc(replaceVhForFrontend(src.html), src.charId);
        ph.appendChild(frame);
    });
}

// 找出是哪个 iframe 发来的消息
function findFrontendFrame(source) {
    const frames = document.querySelectorAll('iframe.gy-frontend-frame');
    for (let i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
}

// iframe 里报上来的高度，找到是哪个 iframe 报的，把它撑到那么高
window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || typeof d.__gyFrontendHeight !== 'number') return;
    const frame = findFrontendFrame(e.source);
    if (frame) frame.style.height = d.__gyFrontendHeight + 'px';
});

// 卡片调"会改变状态"的同类软件接口时走这里：iframe 只负责发请求，真正干活的是 js/17 里的
// gyTavernBridge，它把这些调用接到白露自己已有的功能上（比如换开场白）。
window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || !d.__gyTavernCall) return;
    const { id, method, args } = d.__gyTavernCall;
    const frame = findFrontendFrame(e.source);
    if (!frame) return;   // 认不出来源就不处理，不给不明来路的窗口开后门

    const reply = (ok, value, reason) => {
        try { e.source.postMessage({ __gyTavernReply: { id, ok, value, reason } }, '*'); } catch (err) { /* iframe 可能已经没了 */ }
    };

    const bridge = window.gyTavernBridge;
    if (!bridge || typeof bridge[method] !== 'function') {
        console.info('[同类软件兼容层] 卡片调用了 ' + method + '()，白露这边没有实现，已安全跳过。');
        return reply(true, undefined);
    }
    // 让桥接方法知道这是哪个角色的卡片——换开场白得知道换谁的
    const src = frame.__gyFrontendSrc || {};
    try {
        const r = bridge[method].apply(bridge, (args || []).concat([{ charId: src.charId }]));
        Promise.resolve(r).then(res => {
            if (res && res.ok === false) reply(false, undefined, res.reason);
            else reply(true, res && 'value' in res ? res.value : res);
        }, err => reply(false, undefined, err && err.message));
    } catch (err) {
        console.error('[同类软件兼容层] 执行 ' + method + ' 时出错：', err);
        reply(false, undefined, err && err.message);
    }
});

// 谁把带占位的 HTML 插进页面都行，这里统一兜住，不需要每个渲染入口各自记得调一次。
//
// ⚠️ 性能：这个观察者盯的是**整个 body 的所有插入**，所以回调里第一件事必须是
// "有没有卡片在等着挂载"这个 O(1) 判断，没有就立刻返回。
//
// 上一版没有这层判断，每插入一个节点都要 querySelector 一遍整棵子树。
// 平时看不出来，但聊天记录几百条、或者导入备份时整个界面重建，
// 这个回调会被触发上万次、每次扫一大片 DOM，主线程直接卡死——
// 表现就是"聊天框打不了字""导入备份之后动不了，只能大退"。
// 现在没有待挂载的卡片时（绝大多数时候都是），回调几乎不花时间。
if (typeof MutationObserver === 'function') {
    const __feObserver = new MutationObserver(muts => {
        if (__frontendPending.size === 0) return;   // ← 关键：没东西等着挂就别扫 DOM
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.classList && n.classList.contains('gy-frontend') && n.hasAttribute('data-frontend-id')) {
                    mountFrontendFrames(n.parentNode || document);
                    continue;
                }
                if (n.querySelector && n.querySelector('.gy-frontend[data-frontend-id]')) {
                    mountFrontendFrames(n);
                }
                if (__frontendPending.size === 0) return;   // 挂完了就收工，别继续扫
            }
        }
    });
    const __feStart = () => __feObserver.observe(document.body, { childList: true, subtree: true });
    if (document.body) __feStart(); else document.addEventListener('DOMContentLoaded', __feStart);
}

function renderMarkdownLite(text, charId, depth, opts) {
    // opts.statusContext：'post' | 'comment' | undefined
    // 状态栏在推文/评论里分别有独立开关（有些卡的状态栏又长又私密，刷在时间线上很挤）。
    // 没传 context 的场景（日记、小说、续写等）沿用总开关，行为跟以前一样。
    const _ctx = opts && opts.statusContext;
    const _statusOn = (typeof autoRenderStatusChips === 'undefined' || autoRenderStatusChips)
        && !(_ctx === 'post' && typeof showStatusInPosts !== 'undefined' && !showStatusInPosts)
        && !(_ctx === 'comment' && typeof showStatusInComments !== 'undefined' && !showStatusInComments)
        && !(_ctx === 'diary' && typeof showStatusInDiary !== 'undefined' && !showStatusInDiary);
    if (!text) return '';
    let t = String(text);
    // 仅影响界面显示的正则脚本（displayOnly）在这里生效：不改动传进来的原始文本/存档，只在渲染这一刻处理一次
    // charId 有值时，绑定了专属角色（charScope）的脚本只在渲染"那个角色自己的内容"时才生效，不会波及其它角色
    if (typeof applyDisplayOnlyRegex === 'function') t = applyDisplayOnlyRegex(t, charId, depth);

    // 💡 核心修复 1：提前把 <script> 和 <style> 标签整个"保护"起来，防止里面的代码被当成 Markdown 解析
    // 🐛 修复：占位符原来用的是三个下划线包一个数字（___BLOCK_PLACEHOLDER_0___），一旦一段内容里连续出现
    // 两个这样的占位符、中间又没有换行分隔（角色卡的HTML小组件经常把好几个<script>/<style>写在同一段里），
    // 下面第51/52行的**粗体**/__粗体__识别规则会把"前一个占位符结尾的__"和"后一个占位符开头的__"当成一对
    // 粗体标记，跨占位符匹配、把中间内容整段加粗，同时啃掉两边各2个下划线——占位符文本被打烂后，最下面
    // 96-99行的"放回原内容"这一步就再也认不出它，导致原本该恢复的<script>/<style>内容彻底丢失、只留下
    // 一截打烂的占位符残片糊在页面上（就是"__BLOCK_PLACEHOLDER_0_"这种乱码文字+组件没样式的bug）。
    // 换成用控制字符包住占位符——这个字符不会出现在正常文本里，也不会被下面任何一条markdown规则
    // （粗体/斜体/代码/状态栏方括号/同名标签）误认成语法的一部分，从根上避免跨占位符误匹配。
    let protectedBlocks = [];
    const PH = '\x01';
    const protect = (chunk) => {
        protectedBlocks.push(chunk);
        return `${PH}BLOCKPLACEHOLDER${protectedBlocks.length - 1}${PH}`;
    };

    // 🐛 关键修复（状态栏）：代码围栏必须**最先**处理，而且处理完就立刻保护起来。
    //
    // 以前这一步排在最后面，于是角色卡正则刚刚替换进来的那一整份状态栏 HTML，会先被
    // 下面那一堆 markdown 规则（**加粗**、*斜体*、[标签|值] 状态条、<同名标签> 状态块）
    // 挨个啃一遍——卡片 HTML 里到处是 * 和 [ ] 和 <div>xx：yy</div>，几乎必然被误伤：
    // style 属性从中间被拆开、结构被塞进多余的 <span>、甚至整块被当成"通用状态块"重新包装，
    // 卡片作者精心写的样式当场崩掉。
    //
    // 现在改成：先把围栏里的内容整块摘出来，判断是"完整前端页面"还是"一小段HTML"，
    // 分别处理成 iframe 占位 / 原样HTML，然后**立刻塞进保护槽**，markdown 规则一个字都碰不到，
    // 最后再原样放回去。
    const applyDisplayMacros = (s) => {
        const now = new Date();
        return s.replace(/\{\{time\}\}/gi, now.toLocaleTimeString('zh-CN', { hour12: false }))
                .replace(/\{\{date\}\}/gi, now.toLocaleDateString('zh-CN'))
                .replace(/\{\{weekday\}\}/gi, now.toLocaleDateString('zh-CN', { weekday: 'long' }));
    };
    t = t.replace(/```[ \t]*([a-zA-Z0-9]*)[ \t]*\r?\n?([\s\S]*?)```/g, (m, lang, code) => {
        const trimmed = code.trim();
        const looksLikeHtml = /^</.test(trimmed) || lang.toLowerCase() === 'html';
        if (!looksLikeHtml) return protect(`<pre class="md-codeblock"><code>${escapeHtml(trimmed)}</code></pre>`);
        const withMacros = applyDisplayMacros(trimmed);
        // 完整的前端页面（带 <head>/<body>/html>）交给 iframe：样式和脚本都关在里面，
        // 既不会被白露自己的样式压住，也不会反过来污染白露
        if (typeof isFrontendHtml === 'function' && isFrontendHtml(withMacros)) {
            return protect(makeFrontendPlaceholder(withMacros, charId));
        }
        return protect(withMacros);
    });

    // 围栏之外，正则/AI 有时候会直接吐一整份裸的 HTML 文档（没包围栏）。同样按前端页面处理。
    t = t.replace(/<!DOCTYPE\s+html[\s\S]*?<\/html\s*>/gi, (m) => {
        if (typeof makeFrontendPlaceholder !== 'function') return m;
        return protect(makeFrontendPlaceholder(applyDisplayMacros(m), charId));
    });

    t = t.replace(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi, (match) => protect(match));

    // 🐛 修复：角色卡自带的“手机截图/状态栏”HTML小组件里经常写死 {{time}}/{{date}}/{{weekday}} 这类占位符，
    // 期望显示的时候能看到真实的当前时间（比如截图卡片顶部状态栏那一行）。但这几个宏之前只在“拼prompt发给AI”
    // 那条路径上会被替换（见 applyMacros），推文/日记/论坛这些直接渲染AI已经生成好的文本时完全没走过这一步，
    // 导致占位符原文“{{time}}”被当成普通文字直接糊在卡片上，没有被替换成真的时间。这里在渲染时补一道
    // 只替换这三个只读、无副作用的时间类宏（每次渲染都基于“现在”重新算一遍也没问题，甚至更符合“实时状态栏”的直觉），
    // 不在这里处理 {{setvar}}/{{getvar}} 这类带副作用的宏——那些必须只在生成的那一刻处理一次，
    // 如果放在渲染时处理，每次刷新/重新渲染页面都会重复触发一次副作用（比如重复加减变量），会出严重的数据错误。
    const __macroNow = new Date();
    t = t.replace(/\{\{time\}\}/gi, __macroNow.toLocaleTimeString('zh-CN', { hour12: false }))
         .replace(/\{\{date\}\}/gi, __macroNow.toLocaleDateString('zh-CN'))
         .replace(/\{\{weekday\}\}/gi, __macroNow.toLocaleDateString('zh-CN', { weekday: 'long' }));

    // 行内代码 `...`
    t = t.replace(/`([^`\n]+)`/g, (m, code) => {
        if (/^</.test(code.trim())) return code;
        return `<code class="md-inlinecode">${escapeHtml(code)}</code>`;
    });

    // 加粗 **text** / __text__
    t = t.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    
    // 斜体动作描写 *text*（只处理星号）
    t = t.replace(/\*([^\*\n]+)\*/g, '<em class="md-action">$1</em>');

    // 通用"方括号状态栏"识别：很多角色卡/世界书会让AI用 [标签名|值1|值2|...] 这种格式输出状态信息
    // （比如 [BasicInfo|时间|地点] [Outfit|穿着] ...），但每张卡的标签名和字段数都不一样，没法写死
    // 具体字段去认。这里改成不关心标签叫什么，只要是"[英文标识符|至少一段内容]"这个通用形状就转成
    // 统一样式的状态行——不管哪张卡、哪种字段命名，都能一致地显示成好看的状态栏，而不是原始方括号文本。
    // 要求标签是纯英文标识符（字母开头）是为了避免误伤普通的中文动作批注，比如"[叹气]""[歪头]"这种
    // 没有竖线分隔值的中文方括号批注，本来就该保留原样，不应该被当成状态栏处理。
    if (_statusOn) {
        t = t.replace(/\[([A-Za-z][A-Za-z0-9_]{0,24})((?:\|[^\[\]]*){1,8})\]/g, (m, label, rest) => {
            const values = rest.slice(1).split('|').map(s => s.trim()).filter(Boolean);
            if (values.length === 0) return m; // 没有实际内容（比如"[Foo|]"）就不转换，原样保留，避免误伤
            return `<span class="ai-status-chip"><b class="ai-status-chip-label">${escapeHtml(label)}</b><span class="ai-status-chip-value">${values.map(escapeHtml).join(' · ')}</span></span>`;
        });
    }

    // 第二种常见的状态栏写法：<标签名>字段1：值1 字段2：值2 ...</标签名> 这种"同名开闭标签包一段文字，
    // 里面再用中文/英文冒号分字段"的格式（跟上面的方括号写法是两码事，不同卡片作者习惯不一样，两种都识别）。
    // 同样不关心标签名具体叫什么、里面有哪些字段——整段包成一个状态卡片，内部把"看起来像字段名的词+冒号"加粗，
    // 只做视觉上的加粗提示，不强行拆行（字段内容本身可能很长、也可能字段名恰好在句子里重复出现，硬拆行容易拆错，
    // 加粗是相对安全、出错也不影响阅读的做法）。纯数字开头的"标签"（比如时间"23:49"里的"23:"）不会被误加粗，
    // 因为要求标签必须以中文/字母开头。
    if (_statusOn) {
        t = t.replace(/<([\u4e00-\u9fa5A-Za-z0-9_]{1,20})>([\s\S]*?)<\/\1>/g, (m, tagName, inner) => {
            const trimmedInner = inner.trim();
            if (!trimmedInner) return m; // 空标签内容不处理，原样保留
            // ⚠️ 关键防护：如果标签内部本身就带着别的HTML标签（比如AI直接输出了一整块自带样式的
            // <div>...</div>富文本状态卡片，界面本来就能原生渲染成好看的卡片），说明这根本不是
            // "纯文本+冒号字段"这种简单写法，而是已经是成品HTML——这时候绝对不能碰它，一旦当成
            // 纯文本处理会把整块HTML内容连同里面的标签一起被当成普通文字对待，破坏掉AI精心输出的
            // 原生样式，让本来该显示成漂亮卡片的内容退化成这里的通用样式。检测到内部含有形如
            // "<字母/汉字...>"的嵌套标签就直接跳过，保持原样交给浏览器按HTML原生渲染。
            if (/<[a-zA-Z\u4e00-\u9fa5][^<>]*>/.test(trimmedInner)) return m;
            // 再加一道防护：内部如果压根没有"字段名：值"这种冒号字段，也不像是这种状态栏写法，
            // 同样不转换，避免把无关的同名标签文本误包装成状态卡片。
            if (!/[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9]{1,7}[：:]/.test(trimmedInner)) return m;
            const boldedInner = trimmedInner.replace(/(^|\s)([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9]{1,7}[：:])/g, (mm, pre, label) => `${pre}<b class="ai-status-field">${label}</b>`);
            return `<div class="ai-status-block"><div class="ai-status-block-title">${escapeHtml(tagName)}</div><div class="ai-status-block-body">${boldedInner}</div></div>`;
        });
    }

    // 第三种写法：【标签】换行 + 连续多行「字段：值」。
    // 这是中文角色卡里最常见的一种（比如「【闻述状态】\n地点：主卧床上\n时间：凌晨两三点…」），
    // 但它既不是方括号那种 [Eng|值|值]，也没有成对的开闭标签，所以上面两条规则都不认，
    // 一直是当成大白话原样堆在推文里的——用户看到的就是"有的状态栏能显示成卡片、有的不能"。
    // 这里补上：【中文/英文标签】后面紧跟着至少两行"字段：值"，就整段包成同一种状态卡。
    // 要求至少两行，是为了不误伤正文里偶然出现的单句【某某】提示；
    // 行首字段名限定在 12 字以内且不含标点，避免把普通对白（"他说：……"）当成字段。
    if (_statusOn) {
        t = t.replace(/【([^【】\n]{1,20})】[ \t]*(?:<br\s*\/?>|\n)+((?:[ \t]*[\u4e00-\u9fa5A-Za-z][^\n：:<>]{0,11}[：:][^\n]*(?:<br\s*\/?>|\n|$))+)/g,
            (m, title, body) => {
                // ⚠️ 关键守卫（跟上面 <标签> 那条同一个道理，这条当初漏写了，是回归的根源）：
                // 角色卡自己输出的是一整块带样式的 HTML 状态卡，界面本来就能原生渲染成漂亮的样子。
                // 一旦这里把它当成"纯文本+冒号字段"重新包一遍，卡片精心写的结构和配色就全没了，
                // 退化成这里的通用蓝框。所以只要匹配到的内容里带着 <br> 以外的标签，一律不碰。
                if (/<(?!br\b)[a-zA-Z\u4e00-\u9fa5\/][^<>]*>/.test(m)) return m;
                const lines = body.split(/<br\s*\/?>|\n/).map(x => x.trim()).filter(Boolean);
                if (lines.length < 2) return m; // 只有一行的不算状态栏，原样保留
                const rows = lines.map(line => {
                    const hit = line.match(/^([\u4e00-\u9fa5A-Za-z][^：:]{0,11})[：:]([\s\S]*)$/);
                    if (!hit) return `<div>${line}</div>`;
                    return `<div><b class="ai-status-field">${hit[1]}：</b>${hit[2].trim()}</div>`;
                }).join('');
                return `<div class="ai-status-block"><div class="ai-status-block-title">${escapeHtml(title)}</div><div class="ai-status-block-body">${rows}</div></div>`;
            });
    }

    // 💡 核心修复 2：Markdown 替换完成后，把之前保护起来的 <script> 和 <style> 标签毫发无损地放回去
    t = t.replace(new RegExp(PH + 'BLOCKPLACEHOLDER(\\d+)' + PH, 'g'), (match, idx) => {
        return protectedBlocks[idx];
    });

    return t;
}

function formatPostText(text, charId, opts) {
if (!text) return '';
// 💭 渲染侧兜底：修好之前存进来的旧推文/评论里还带着思考（<think>… 或"好的，我来梳理一下……"），
//    这里显示前摘掉；思维链收纳盒开着的话，摘下来的放进正文上方一个很小的可折叠 💭。只影响显示，不改存档。
let __rsnHtml = '';
if (typeof gyPeelReasoningForDisplay === 'function') { const __pr = gyPeelReasoningForDisplay(text); text = __pr.rest; __rsnHtml = __pr.html; }
let html = renderMarkdownLite(text, charId, 0, opts);

// 💡 修复：#话题标签 / @提及 高亮的正则之前是对整个渲染后的HTML字符串做全局替换，没有跳过HTML标签本身。
// 角色卡自带的富文本状态栏卡片里到处是十六进制颜色值（style="...background:...#e8636f..."这种），
// #(\S+) 会把这些颜色值一路匹配到下一个空白字符为止，把好端端的style属性值从中间硬拆开塞进一个
// <span class="clickable-tag">，直接打穿了原本合法的HTML结构，表现为大段样式代码变成可见乱码文字，
// 甚至能把 onmouseout="this.style.color='#ddd'" 这种事件属性也拆坏。这里先保护两层：
// 1) <script>...</script> 和 <style>...</style> 整块（含内部代码），不能只护住标签本身——
//    脚本代码里同样一大堆 '#e8636f' 这种字符串，只保护标签边界的话内部JS代码里的#还是会被
//    当成话题标签拆开插入<span>，把好端端的JS语句拆成语法错误（实测会报 Unexpected identifier）。
// 2) 剩下所有HTML标签本身（<...>，包括属性），只在标签与标签之间的纯文本部分做话题标签/提及高亮。
let protectedTags = [];
html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => {
    protectedTags.push(m);
    return `___TAG_PLACEHOLDER_${protectedTags.length - 1}___`;
});
html = html.replace(/<[^>]+>/g, (m) => {
    protectedTags.push(m);
    return `___TAG_PLACEHOLDER_${protectedTags.length - 1}___`;
});

html = html.replace(/#(\S+)/g, (m, tag) =>
        // 标签文本要转义两次：onclick 里那份是"属性里的 JS 字符串"，显示的那份是普通文本。
        // 以前直接拼 $1，遇到 #can't、#老王's笔记 这种带撇号的标签属性会被提前截断。
        `<span class="clickable-tag" onclick="event.stopPropagation(); switchMainView('tag', '#${escapeJsArg(tag)}')">#${escapeHtml(tag)}</span>`)
           .replace(/@(\S+)/g, '<span class="mention-tag" onclick="event.stopPropagation();">@$1</span>');

html = html.replace(/___TAG_PLACEHOLDER_(\d+)___/g, (m, idx) => protectedTags[idx]);
return __rsnHtml + html;
}

// ==========================================
// 修复：主页推文流渲染（完美限制评论预览长度）
// ==========================================
// 🆕 引用推文的预览卡：不管是用户手动引用发的、还是AI自己决定引用的，渲染逻辑都走这一份，
// 显示原帖作者头像/名字/正文摘要，点击跳到原帖详情页；原帖被删了就显示"该推文已被删除"占位，
// 不会因为找不到而白屏/报错。
function renderQuotedPostPreviewHTML(quotedPostId) {
    if (!quotedPostId) return '';
    // 🐛 修复："营销号的帖子无法转发引用"：这里之前只在 globalPosts 里找，营销号(tabloidAccount)发的帖子
    // 存在完全独立的 tabloidPosts 数组里，id前缀是"tb_"，globalPosts里永远找不到，导致引用悄悄失败。
    const qp = globalPosts.find(p => p.id === quotedPostId) || (typeof tabloidPosts !== 'undefined' ? tabloidPosts.find(p => p.id === quotedPostId) : null);
    if (!qp) return `<div class="quoted-post-card" style="border:1px solid #eff3f4; border-radius:12px; padding:10px 12px; margin-top:8px; color:#8b98a5; font-size:13px;">该推文已被删除</div>`;
    const qChar = qp.char || { name: '未知' };
    return `
    <div class="quoted-post-card" style="border:1px solid #eff3f4; border-radius:12px; padding:10px 12px; margin-top:8px; cursor:pointer;" onclick="event.stopPropagation(); switchMainView('postDetail', '${qp.id}')">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            ${getAvatarHTML(qChar, 20)}
            <b style="font-size:13px; color:#0f1419;">${escapeHtml(qChar.name)}</b>
            <span style="font-size:12px; color:#536471;">${escapeHtml(qChar.handle || '')}</span>
        </div>
        <div style="font-size:13px; color:#0f1419; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml((qp.text || '').slice(0, 120))}</div>
    </div>`;
}

// 用户手动点击某条推文的"引用"按钮：记下被引用的推文id，打开发推框，并在框内展示一个引用预览。
function openQuoteComposer(postId) {
    pendingQuotePostId = postId;
    if (typeof openModal === 'function') openModal('postCreateModal');
    renderQuotePreviewInModal();
    let input = document.getElementById('userPostInput');
    if (input) setTimeout(() => input.focus(), 50);
}

// 取消本次引用（不影响正常发帖，只是不再附带被引用的推文）
function cancelQuoteComposer() {
    pendingQuotePostId = null;
    renderQuotePreviewInModal();
}

// 用户手动"分享到聊天"：选个角色，把这条推文的内容填进跟TA的聊天输入框（不自动发送，让用户自己看一眼再发）
let pendingSharePostId = null;
function openShareToChatModal(postId) {
    pendingSharePostId = postId;
    const container = document.getElementById('sharePostToChatCharList');
    if (!container) return;
    if (!myCharacters || myCharacters.length === 0) {
        container.innerHTML = '<div class="empty-state">还没有创建角色，先去创建一个吧。</div>';
    } else {
        container.innerHTML = myCharacters.map(c => `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 4px; cursor:pointer; border-bottom:1px solid #eff3f4;" onclick="shareThisPostToChat('${c.id}')">
                ${getAvatarHTML(c, 36)}
                <span style="font-size:15px;">${escapeHtml(c.name)}</span>
            </div>`).join('');
    }
    openModal('sharePostToChatModal');
}

function shareThisPostToChat(charId) {
    const post = globalPosts.find(p => p.id === pendingSharePostId) || (typeof tabloidPosts !== 'undefined' ? tabloidPosts.find(p => p.id === pendingSharePostId) : null);
    closeModal('sharePostToChatModal');
    if (!post) return;
    const authorName = (post.char && post.char.name) || post.anonName || '未知';
    pendingSharePostId = null;
    switchMainView('chat');
    switchChatSession(charId);
    // 跟"回复某条聊天消息"复用同一套引用预览机制（pendingChatQuote + chatQuotePreview 那根条），
    // 这样发出去之后聊天记录里存的就是真正的 msg.quote 结构，能渲染成推文卡片样式，而不是把推文内容
    // 硬编码成一段死文字糊进输入框里（那样发出去就只是普通文字消息，没法跟真正的引用区分开）。
    // type:'tweet' 用来在渲染时跟"引用一条聊天消息"区分开，走推文卡片的样式。
    pendingChatQuote = { name: authorName, text: post.text || '', type: 'tweet' };
    setTimeout(() => {
        const nameEl = document.getElementById('chatQuoteName'), textEl = document.getElementById('chatQuoteText'), previewEl = document.getElementById('chatQuotePreview');
        if (nameEl) nameEl.innerText = authorName;
        if (textEl) textEl.innerText = (post.text || '').replace(/\n+/g, ' ').slice(0, 100);
        if (previewEl) previewEl.style.display = 'flex';
        const input = document.getElementById('chatInput');
        if (input) input.focus();
    }, 100);
}

// 把 postCreateModal 里的引用预览区渲染成"有引用/无引用"两种状态
function renderQuotePreviewInModal() {
    let box = document.getElementById('quoteComposerPreview');
    if (!box) return;
    if (!pendingQuotePostId) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    let qp = globalPosts.find(p => p.id === pendingQuotePostId) || (typeof tabloidPosts !== 'undefined' ? tabloidPosts.find(p => p.id === pendingQuotePostId) : null);
    if (!qp) {
        pendingQuotePostId = null;
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    let qChar = qp.char || { name: '未知' };
    box.style.display = 'block';
    box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; border:1px solid #eff3f4; border-radius:12px; padding:10px 12px; margin-bottom:10px; background:rgba(29,155,240,0.04);">
        <div style="min-width:0; flex:1;">
            <div style="font-size:12px; color:#536471; margin-bottom:4px;">🔁 引用推文</div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                ${getAvatarHTML(qChar, 18)}
                <b style="font-size:13px; color:#0f1419;">${escapeHtml(qChar.name)}</b>
            </div>
            <div style="font-size:13px; color:#0f1419; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml((qp.text || '').slice(0, 120))}</div>
        </div>
        <button class="btn-edit-small" style="flex-shrink:0;" title="取消引用" onclick="cancelQuoteComposer()">✕</button>
    </div>`;
}

function generatePostHTML(posts) {
    return posts.map(post => {
        // 少了 stats 的帖子（很旧的备份、手工导进来的、别的地方 push 忘了带）
        // 会让下面 post.stats.comments 直接抛错——**整条时间线一条都渲染不出来**，
        // 页面看着像白屏。补一个空的，宁可显示 0 也不能让一条坏数据拖垮整页。
        if (!post.stats) post.stats = { comments: 0, retweets: 0, likes: 0, views: 0 };
        let char = post.char;
        let isMe = char.id === 'me';
        let verifiedIcon = char.verified ? verifiedSVG : '';
        let mediaHTML = post.mediaUrl ? `<div class="post-media" onclick="event.stopPropagation();"><img src="${post.mediaUrl}" loading="lazy"></div>` : '';
        // 定位并进头一行（名字 · @账号 · 时间 · 📍地点）了，正文下面不再单独占一行
        // v107：定位不上名字那一排，只跟在推文正文底下（用户明确要求）
        let locationHTML = post.location
            ? `<div class="post-loc-line">${locationSVG}<span>${escapeHtml(post.location)}</span></div>` : '';
        let quotedHTML = renderQuotedPostPreviewHTML(post.quotedPostId);
        
        let replyPreview = '';
        if (post.replies && post.replies.length > 0) {
            let topReply = post.replies[post.replies.length - 1];
            
            // 💡核心修复：给最外层加 width:100%，给名字和内容加上 display:block; flex:1; min-width:0; 强制它在超长时显示省略号...
            replyPreview = `
            <div class="post-placeholder" style="border-bottom:none; padding:8px 0 0 0; margin-top:8px; border-top:1px solid #eff3f4; cursor:pointer;" onclick="event.stopPropagation(); switchMainView('postDetail', '${post.id}')">
                <div style="display:flex; gap:8px; width:100%; align-items:center;">
                    ${getAvatarHTML(topReply.char, 24)}
                    <div style="font-size:13px; color:#536471; display:flex; align-items:center; gap:4px; flex-grow:1; min-width:0;">
                        <b style="flex-shrink:0; max-width:100px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${topReply.char.name}</b> 
                        <span style="flex-shrink:0;">回复了：</span>
                        <span style="color:#0f1419; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:block; flex:1; min-width:0;">${topReply.text}</span>
                    </div>
                </div>
            </div>`;
        }

        return `
        <div class="post-placeholder" onclick="switchMainView('postDetail', '${post.id}')">
            <div style="cursor:pointer; flex-shrink:0;" onclick="event.stopPropagation(); switchMainView('profile', '${char.id}')">
                ${getAvatarHTML(char, 40)}
            </div>
            <div class="post-content" style="min-width:0; flex:1;">
                <div class="post-header">
                    <div class="post-header-info" onclick="event.stopPropagation(); switchMainView('profile', '${char.id}')">
                        <div class="post-name">${char.name}${verifiedIcon}</div>
                        <div class="post-handle">${char.handle}</div>
                        <div class="post-dot">·</div>
                        <div class="time-updater post-time" data-fmt="post" data-timestamp="${post.timestamp}" onclick="gyToggleTimeFmt(event)" title="点一下换成具体日期">${fmtPostTime(post.timestamp)}</div>
                    </div>
                    <button class="post-more-btn" onclick="gyPostMenu(event, '${post.id}')" title="更多">${moreDotsSVG}</button>
                </div>
                <div class="post-body" ondblclick="editPost('${post.id}', this); event.stopPropagation();" title="双击可直接修改此帖子">${namespaceInjectedIds(formatPostText(post.text, char.id, { statusContext: 'post' }), post.id)}</div>
                ${locationHTML}
                ${mediaHTML}
                ${quotedHTML}
                <!-- 操作栏按 X 的排法：评论 / 转发 / 点赞 / 浏览量 四个均分，分享单独顶到最右边。
                     引用、收藏、修改、删除、关注全部收进右上角的 ⋮ ——一行摆七个图标既挤又没人认得出哪个是哪个。 -->
                <div class="post-actions">
                    <div class="pa-item" onclick="event.stopPropagation(); switchMainView('postDetail', '${post.id}')" title="评论">${commentSVG}<span>${formatStat(post.stats.comments)}</span></div>
                    <div class="pa-item rt" onclick="event.stopPropagation(); openQuoteComposer('${post.id}')" title="转发 / 引用">${retweetSVG}<span>${formatStat(post.stats.retweets)}</span></div>
                    <div class="pa-item like ${post.userLiked ? 'on' : ''}" onclick="event.stopPropagation(); toggleMainPostLike('${post.id}', event)" title="喜欢"><span class="like-icon-wrap">${post.userLiked ? likeSVGFilled : likeSVG}</span><span class="like-count">${formatStat(post.stats.likes)}</span></div>
                    <div class="pa-item" onclick="event.stopPropagation(); switchMainView('postDetail', '${post.id}')" title="查看次数">${viewsBarSVG}<span>${formatStat(post.stats.views)}</span></div>
                    <div class="pa-item pa-share" onclick="event.stopPropagation(); openShareToChatModal('${post.id}')" title="分享">${shareOutSVG}</div>
                </div>
                ${replyPreview}
            </div>
        </div>`;
    }).join('');
}

// ⋮ 推文的更多菜单。以前操作栏里塞了七个图标（含引用、收藏、分享），
// 一行摆不下、也认不出来。现在低频的都收进这里，跟 X 一样。
window.gyPostMenu = function (e, postId) {
    e.preventDefault(); e.stopPropagation();
    const isTabloid = String(postId).startsWith('tb_');
    const post = isTabloid ? (typeof tabloidPosts !== 'undefined' ? tabloidPosts : []).find(p => p.id == postId)
                           : globalPosts.find(p => p.id == postId);
    if (!post) return;
    const char = post.char || {};
    const isMe = String(char.id) === 'me';
    const starred = (typeof isInMemoryAlbum === 'function') && isInMemoryAlbum('post', postId);
    const menu = document.getElementById('chatContextMenu');
    if (!menu) return;
    const rows = [];
    rows.push(`<button class="context-btn" onclick="gyPostMenuDo('quote','${postId}')">💬 引用推文</button>`);
    rows.push(`<button class="context-btn" onclick="gyPostMenuDo('share','${postId}')">📤 分享到私聊</button>`);
    rows.push(`<button class="context-btn" onclick="gyPostMenuDo('star','${postId}')">${starred ? '⭐ 从回忆相册移出' : '☆ 收藏进回忆相册'}</button>`);
    // 🖼️ 推文里的图：换一张 / 删掉 / 没图的加一张
    if (!isTabloid) {
        if (post.mediaUrl) {
            rows.push(`<button class="context-btn" onclick="gyPostMenuDo('imgSwap','${postId}')">🖼️ 换张图片</button>`);
            rows.push(`<button class="context-btn" onclick="gyPostMenuDo('imgDel','${postId}')">🧹 删掉图片</button>`);
        } else {
            rows.push(`<button class="context-btn" onclick="gyPostMenuDo('imgSwap','${postId}')">🖼️ 加张图片</button>`);
        }
    }
    if (isMe) {
        rows.push(`<button class="context-btn" onclick="gyPostMenuDo('edit','${postId}')">✏️ 修改这条推文</button>`);
        rows.push(`<button class="context-btn" style="color:#f91880;" onclick="gyPostMenuDo('del','${postId}')">🗑️ 删除</button>`);
    } else if (char.id !== undefined) {
        rows.push(`<button class="context-btn" onclick="gyPostMenuDo('follow','${postId}')">${char.isFollowing ? '取消关注' : '＋ 关注'} ${escapeHtml(char.name || '')}</button>`);
        rows.push(`<button class="context-btn" style="color:#f91880;" onclick="gyPostMenuDo('del','${postId}')">🗑️ 删除</button>`);
    }
    menu.innerHTML = rows.join('');
    menu.style.display = 'flex';
    let x = e.pageX, y = e.pageY;
    if (x + 190 > window.innerWidth) x = window.innerWidth - 195;
    if (y + rows.length * 42 > window.innerHeight) y = Math.max(8, window.innerHeight - rows.length * 42 - 10);
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
};
// 🖼️ 换 / 删推文里的图。选的图先压一下（长边 1280），不然存档一下子就胖了
function gyPostRefresh(postId) {
    try {
        const vis = id => { const v = document.getElementById(id); return v && v.style.display !== 'none'; };
        if (vis('view-home') && typeof renderPosts === 'function') renderPosts();
        if (vis('view-profile') && typeof renderProfileFeed === 'function') renderProfileFeed();
        const det = document.getElementById('postDetailSection');
        if (det && det.offsetParent !== null && typeof switchMainView === 'function') switchMainView('postDetail', postId);
    } catch (e) {}
}
async function gyPostImage(post, act) {
    if (act === 'imgDel') {
        const ok = (typeof appConfirm === 'function') ? await appConfirm('把这条推文里的图片删掉？文字不动。') : confirm('把这条推文里的图片删掉？');
        if (!ok) return;
        delete post.mediaUrl;
        if (typeof saveAllData === 'function') saveAllData();
        return gyPostRefresh(post.id);
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
            const img = new Image();
            img.onload = () => {
                let src = rd.result;
                try {
                    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
                    if (k < 1 || String(src).length > 600000) {
                        const cv = document.createElement('canvas');
                        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
                        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                        src = cv.toDataURL('image/jpeg', 0.86);
                    }
                } catch (e) {}
                post.mediaUrl = src;
                if (typeof saveAllData === 'function') saveAllData();
                gyPostRefresh(post.id);
            };
            img.onerror = () => { try { appAlert('这张图片打不开，换一张试试？'); } catch (e) {} };
            img.src = rd.result;
        };
        rd.readAsDataURL(f);
    };
    inp.click();
}
window.gyPostImage = gyPostImage;
window.gyPostMenuDo = function (act, postId) {
    const menu = document.getElementById('chatContextMenu');
    if (menu) menu.style.display = 'none';
    const isTabloid = String(postId).startsWith('tb_');
    const post = isTabloid ? (typeof tabloidPosts !== 'undefined' ? tabloidPosts : []).find(p => p.id == postId)
                           : globalPosts.find(p => p.id == postId);
    if (!post) return;
    if (act === 'imgDel' || act === 'imgSwap') return gyPostImage(post, act);
    if (act === 'quote' && typeof openQuoteComposer === 'function') return openQuoteComposer(postId);
    if (act === 'share' && typeof openShareToChatModal === 'function') return openShareToChatModal(postId);
    if (act === 'star' && typeof toggleMemoryStar === 'function') {
        return toggleMemoryStar({ stopPropagation() {}, preventDefault() {} }, 'post', postId);
    }
    if (act === 'del') {
        // 在帖子详情页上删完要弹回主页，那是 deleteDetailPost 干的事；
        // 在信息流里删就地刷新，走 deletePost。
        const onDetail = document.getElementById('postDetailSection') &&
                         document.getElementById('postDetailSection').offsetParent !== null;
        if (onDetail && typeof deleteDetailPost === 'function') return deleteDetailPost(postId);
        if (typeof deletePost === 'function') return deletePost(postId, { stopPropagation() {}, preventDefault() {} });
        return;
    }
    if (act === 'follow' && typeof toggleFollow === 'function') {
        return toggleFollow(post.char.id, { stopPropagation() {}, preventDefault() {} });
    }
    if (act === 'edit') {
        // editPost 要的是那条推文正文的 DOM 节点，找不到就退回"在详情页里改"
        const el = document.querySelector(`.post-placeholder[onclick*="${postId}"] .post-body`)
                || document.querySelector('#postDetailSection .detail-post-body');
        if (el && typeof editPost === 'function') return editPost(postId, el);
        if (typeof switchMainView === 'function') switchMainView('postDetail', postId);
    }
};

// opts（可选）：{ view:'mall' }  → 点通知切到那一页
//               { feature:'gossip' } → 点通知打开那个小功能页（js/27）
//               { param:'xxx' }      → 跟着 view 一起传给 switchMainView
// 加这个是因为以前通知只认两种跳转：私聊 和 帖子详情。像"快递到了""TA 说了句话"
// 这种来自小功能的通知点了没反应，只能自己去翻——等于通知只是个已读回执。
function addNotification(text, postId, chatCharId, char, desc, opts) {
const o = opts || {};
const n = { text, postId, chatCharId, timestamp: Date.now(),
    view: o.view || null, param: o.param || null, feature: o.feature || null };
if (o.jump) n.jump = o.jump;
// 🆔 每条都带 charId / desc：点了跳不过去时，还能按"是谁的事"兜底；小手机通知中心那行细节也用得上
if (char && char.id != null) n.charId = String(char.id);
if (desc) n.desc = String(desc);
return gyPushNotif(n, { avatar: (typeof getAvatarHTML === 'function' ? getAvatarHTML(char, 40) : ''), title: String(text || '').replace(/<[^>]+>/g, ''), desc });
}

// 🆔 通知的唯一 id。
// 以前通知页 / 小手机通知中心 / 灵动岛全是按"列表里第几条"去找通知的——页面开着的时候
// 又来了一条新通知，所有下标都往后挪一位，点第 1 条打开的其实是刚进来的那条（"点通知跳错地方"）。
// 现在每条通知一生下来就有自己的 id，点的时候按 id 找，谁插队都不影响。
function gyNotifNewId() { return 'nt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
// 老数据 / 别的模块直接 unshift 进来的通知没有 id，渲染和点击之前统一补上
function gyNotifEnsureIds() {
    try {
        if (typeof globalNotifications === 'undefined' || !Array.isArray(globalNotifications)) return;
        for (const n of globalNotifications) if (n && typeof n === 'object' && !n.id) n.id = gyNotifNewId();
    } catch (e) {}
}
function gyNotifFind(nid) {
    if (nid == null) return null;
    gyNotifEnsureIds();
    try { return (globalNotifications || []).find(n => n && String(n.id) === String(nid)) || null; } catch (e) { return null; }
}
window.gyNotifNewId = gyNotifNewId; window.gyNotifEnsureIds = gyNotifEnsureIds; window.gyNotifFind = gyNotifFind;

// 📮 统一的"发一条通知"：进通知页 + 角标 +（可选）弹窗；弹窗带着这条通知本身，点弹窗和点通知页走同一套跳转。
// n：{ text, postId, chatCharId, charId, desc, jump, view, param, feature, timestamp }
// toast：{ avatar, title, desc, anon } —— 传 false 就只进通知页不弹
function gyPushNotif(n, toast) {
    const item = Object.assign({ postId: null, chatCharId: null, timestamp: Date.now() }, n || {});
    if (!item.id) item.id = gyNotifNewId();
    if (!item.timestamp) item.timestamp = Date.now();
    try { globalNotifications.unshift(item); } catch (e) {}
    try { unreadNotifs++; } catch (e) {}
    if (typeof updateNotifBadge === 'function') updateNotifBadge();
    if (toast && typeof showToast === 'function') {
        const plainTitle = toast.title != null ? toast.title : String(item.text || '').replace(/<[^>]+>/g, '');
        showToast(toast.avatar || '', plainTitle, toast.desc != null ? toast.desc : (item.desc || ''), item.postId, item.chatCharId, !!toast.anon, item);
    }
    return item;
}
window.gyPushNotif = gyPushNotif;

function updateNotifBadge() {
let mBadge = document.getElementById('mnavNotifBadge');
if (mBadge) { if (unreadNotifs > 0) { mBadge.style.display = 'block'; mBadge.innerText = unreadNotifs > 99 ? '99+' : unreadNotifs; } else { mBadge.style.display = 'none'; } }
let badge = document.getElementById('notifBadge');
if (badge) {
    if (unreadNotifs > 0) {
        badge.style.display = 'block';
        badge.innerText = unreadNotifs > 99 ? '99+' : unreadNotifs;
    } else {
        badge.style.display = 'none';
    }
}
// 通知页正开着又来了新通知：马上重画，列表跟数据保持一致
gyNotifRefreshIfOpen();
}

function gyNotifPageOpen() {
    const v = document.getElementById('view-notifications');
    return !!(v && v.style.display && v.style.display !== 'none');
}
function gyNotifRefreshIfOpen() {
    try {
        if (!gyNotifPageOpen()) return;
        gyNotifEnsureIds();
        const c = document.getElementById('notificationsSection');
        const first = c && c.querySelector('[data-nid]');
        const top = (globalNotifications || [])[0];
        const shown = c ? c.querySelectorAll('[data-nid]').length : 0;
        if (!top ? shown > 0 : (!first || first.getAttribute('data-nid') !== String(top.id) || shown !== globalNotifications.length)) renderNotifications();
    } catch (e) {}
}
// 有些模块往 globalNotifications 里塞完不叫 updateNotifBadge，这里再轻轻看一眼兜底
setInterval(gyNotifRefreshIfOpen, 1500);

// 点通知页里的一条：按 id 找到这条，交给统一的跳转（js/60 gyOpenNotif）
function gyNotifClick(nid) {
    const n = gyNotifFind(nid);
    if (!n) { renderNotifications(); return; }
    if (typeof window.gyOpenNotif === 'function') window.gyOpenNotif(n);
}

function renderNotifications() {
const container = document.getElementById('notificationsSection');
if (!container) return;
if (!globalNotifications || globalNotifications.length === 0) {
    container.innerHTML = `<div class="empty-state">暂无新通知</div>`;
    return;
}
gyNotifEnsureIds();
// 每一条都能点：有明确去处的跳过去；什么都没写的按文字猜（信 → 信件与日记……），猜不到就留在这页
container.innerHTML = globalNotifications.map(n => {
    const nid = String(n.id).replace(/[^\w-]/g, '');
    const desc = n.desc ? String(n.desc).replace(/<[^>]+>/g, '').slice(0, 80) : '';
    return `
    <div class="notification-item notif-jump${n.read ? ' notif-read' : ''}" data-nid="${nid}" style="cursor:pointer;" onclick="gyNotifClick('${nid}')">
        <div style="flex-grow:1;">
            <div style="font-size:15px; color:#0f1419; margin-bottom:4px;">${n.text}</div>
            ${desc ? `<div style="font-size:13px; color:#536471; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(desc)}</div>` : ''}
            <div style="font-size:13px; color:#536471;" class="time-updater" data-timestamp="${n.timestamp}">${timeAgo(n.timestamp)}</div>
        </div>
    </div>`;
}).join('');
}

function renderTrends() {
const c = document.getElementById('trendListContainer');
if (!c) return;
c.innerHTML = trendingTags.map((t, i) => `
    <div class="trend-item" ondblclick="editTrend(${i}, this)">
        <div class="trend-meta">${i+1} · 趋势</div>
        <div class="trend-title" onclick="switchMainView('tag', '${escapeJsArg(t)}')">${escapeHtml(t)}</div>
        <div class="trend-meta">${getRandomStat(50000) + 1000} 帖子</div>
    </div>
`).join('');
}

// ===================== 角色自创标签 → 自动收录进趋势榜 =====================
// 之前角色能自己现想标签了，但trendingTags（首页趋势栏/标签页那个列表）完全是手动维护的，
// AI自己想出来的标签发出去就"沉底"了——推文正文里虽然能点（formatPostText已经把#标签做成
// 可点击链接），但不会出现在趋势栏，也没法被"发现"。这里补上自动收录逻辑：
// 同一个标签如果被【不同角色】用到了一定次数，说明这个话题是真的在角色之间"火"起来了，
// 就自动收进trendingTags；用"不同角色数"而不是"出现次数"来判断，是为了避免某一个角色
// 自己反复刷同一个口头禅标签就被误判成全站热门。
function extractHashtagsFromText(text) {
    if (!text) return [];
    // 跟 formatPostText 里识别"#标签"用的是同一套正则(#(\S+))，保证「发推文时能不能被识别成标签」
    // 跟「展示推文时能不能点」这两处逻辑判断的是同一批字符，不会出现"点得了但数不到"的不一致。
    const matches = text.match(/#(\S+)/g);
    return matches ? [...new Set(matches)] : [];
}
const TRENDING_TAG_PROMOTE_THRESHOLD = 3; // 至少几个不同角色都用过同一个标签，才自动收录进趋势榜
const TRENDING_TAGS_MAX = 20; // 趋势榜最多保留多少条，避免无限增长
function autoPromoteTrendingTagsFromPosts(posts) {
    if (!posts || posts.length === 0) return false;
    const tagToChars = {}; // 标签 -> 用过它的角色id集合
    posts.forEach(p => {
        const charId = p.char && p.char.id !== undefined ? p.char.id : p.char;
        extractHashtagsFromText(p.text).forEach(tag => {
            if (!tagToChars[tag]) tagToChars[tag] = new Set();
            tagToChars[tag].add(charId);
        });
    });
    let promoted = false;
    Object.keys(tagToChars).forEach(tag => {
        if (tagToChars[tag].size >= TRENDING_TAG_PROMOTE_THRESHOLD && !trendingTags.includes(tag)) {
            trendingTags.unshift(tag);
            promoted = true;
        }
    });
    if (promoted) {
        if (trendingTags.length > TRENDING_TAGS_MAX) trendingTags.length = TRENDING_TAGS_MAX;
        if (typeof renderTrends === 'function') renderTrends();
    }
    return promoted;
}
// ⚠️ 补充修复：光让AI"自己现想标签"是不够的——如果每个角色各想各的，谁也不知道别人刚用过什么词，
// 同一个话题永远凑不出"3个不同角色都用过同一个标签"，上面那个自动收录进趋势榜的机制就永远触发不了。
// 这里从最近的帖子里提取"最近还在被使用的标签"喂给发推文的AI，让它优先考虑直接沿用已有标签，
// 而不是每次都独立发明一个意思相近的新词——这样标签才可能真的被多个角色共用、"火"起来。
function getRecentActiveTags(scanCount = 40, limit = 8) {
    const recentPosts = globalPosts.slice(0, scanCount);
    const tagCount = {};
    recentPosts.forEach(p => {
        extractHashtagsFromText(p.text).forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
    });
    return Object.keys(tagCount).sort((a, b) => tagCount[b] - tagCount[a]).slice(0, limit);
}

// 🆕 给"AI自己发新推文时可以顺手引用一条别人的推文"用：从最近的帖子里挑一批候选（排除自己刚发过的），
// 带上真实post.id，喂给AI选。AI选中的id会直接存进新帖子的quotedPostId字段里——用真实id而不是临时编号，
// 因为推文本来就有稳定id（跟聊天消息不一样），引用关系可以长期有效、能一直点回原帖，不用每次都重新解析。
function getQuotableCandidatePosts(excludeCharId, count = 12) {
    return globalPosts
        .filter(p => !p.isStory && !p.quotedPostId && (!excludeCharId || !p.char || p.char.id !== excludeCharId))
        .slice(0, 40)
        .sort(() => 0.5 - Math.random())
        .slice(0, count)
        .map(p => ({ id: p.id, name: p.char?.name || '未知', text: (p.text || '').slice(0, 40) }));
}

function addCustomTrend() {
const input = document.getElementById('customTrendInput');
let val = input.value.trim();
if(val) {
    if(!val.startsWith('#')) val = '#' + val;
    trendingTags.unshift(val);
    renderTrends();
    saveAllData();
    input.value = '';
}
}

function editTrend(idx, el) {
const oldVal = trendingTags[idx];
// value 里含双引号的话属性会被提前截断，这里必须走属性转义
el.innerHTML = `<input type="text" class="trend-edit-input" value="${escapeAttr(oldVal)}" onblur="saveTrend(${idx}, this.value)" onkeypress="if(event.key==='Enter') this.blur()" autoFocus>`;
el.querySelector('input').focus();
}

function saveTrend(idx, val) {
val = val.trim();
if(val) {
    if(!val.startsWith('#')) val = '#' + val;
    trendingTags[idx] = val;
} else {
    trendingTags.splice(idx, 1);
}
renderTrends();
saveAllData();
}

window.onload = async function() {
    // ⚠️ 整段包在 try/finally 里，是为了保证最后那句 __guyuBooted = true 一定会执行。
    // 踩过的坑：这个标志位原来是本函数的最后一行，只要上面二十多句初始化里任何一句抛异常，
    // 它就永远置不上，后果有两层——
    //   1) index.html 的启动自检 12 秒后必定弹「启动超时」，哪怕 app 其实已经能用了；
    //   2) 更麻烦的是 bootDone() 会永远返回 false，于是此后每一个运行时错误（包括角色卡
    //      自带脚本报的错）都会糊出一个全屏「启动失败」面板，而这恰恰是自检代码里
    //      写明要避免的情况。
    // 放进 finally 之后，出错时报错面板照样会弹（那是 window.onerror 干的，跟这个标志无关），
    // 但不会再连累后面所有的错误。
    try {
        registerServiceWorkerForNotifications();
        await loadAllData();
        updateGlobalBgStyles();
        applyGlobalCSS();
        // v107 版式：中栏宽度（存档里读到的）+ 右边缘那条拖宽手柄
        if (typeof applyMainWidth === 'function') applyMainWidth();
        if (typeof initMainWidthGrip === 'function') initMainWidthGrip();
        updateCharSelects();
        updateSiteLogo();
        if (typeof renderPosts === "function") renderPosts();
        if (typeof renderTrends === "function") renderTrends();
        if (typeof renderCenterCharList === "function") renderCenterCharList();
        updateUserMiniProfile();
        startAutoPostTimer();
        startProactiveChatTimer();
        // 🎲 自主模式的定时器：装上不等于会跑，里面第一件事就是查 charAutonomy 开关（默认关）
        if (typeof startAutonomyTimer === 'function') startAutonomyTimer();
        if (typeof fetchPendingFromCloud === 'function') fetchPendingFromCloud(); // 打开网页时先把云端攒的内容拉回来
        if (typeof syncStateToCloud === 'function') { syncStateToCloud(true); setInterval(() => syncStateToCloud(false), CLOUD_SYNC_MIN_INTERVAL); }
        setInterval(updateAllRelativeTimes, 60000);
        initMobileUI();
        initFAB(); // 初始化悬浮按钮拖拽逻辑
        if (typeof runPluginOnLoadHooks === 'function') runPluginOnLoadHooks(); // 插件系统：网页一打开就自动跑一遍"启动钩子"插件
    } finally {
        window.__guyuBooted = true;   // 给 index.html 里的启动自检看的：启动阶段到此结束（成功与否都算）
    }
};

// 悬浮按钮的自由拖拽逻辑
function initFAB() {
    const fab = document.getElementById('fabPost');
    if (!fab) return;
    
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let hasMoved = false;

    const onDragStart = (e) => {
        if (e.type === 'touchstart') {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault(); // 阻止鼠标选中文字
        }
        const rect = fab.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        isDragging = true;
        hasMoved = false;
        
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, {passive: false});
        document.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        let currentX, currentY;
        if (e.type === 'touchmove') {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }
        
        const dx = currentX - startX;
        const dy = currentY - startY;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
            if (e.cancelable) e.preventDefault(); // 滑动时阻止页面滚动
        }
        
        if (hasMoved) {
            let newX = initialX + dx;
            let newY = initialY + dy;
            
            // 边缘碰撞检测，限制在可视区内
            const maxX = window.innerWidth - fab.offsetWidth;
            const maxY = window.innerHeight - fab.offsetHeight;
            
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));
            
            fab.style.left = newX + 'px';
            fab.style.top = newY + 'px';
            fab.style.bottom = 'auto'; // 清除默认样式的定位
            fab.style.right = 'auto';
        }
    };

    const onDragEnd = (e) => {
        isDragging = false;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
        
        // 如果没有发生位移，则判定为点击事件，打开弹窗
        if (!hasMoved) {
            pendingQuotePostId = null; // 普通发帖入口，清掉可能残留的引用状态
            renderQuotePreviewInModal();
            openModal('postCreateModal');
        }
    };

    fab.addEventListener('mousedown', onDragStart);
    fab.addEventListener('touchstart', onDragStart, {passive: false});
}
