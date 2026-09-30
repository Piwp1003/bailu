/* =====================================================================
   js/20 —— 一起阅读（原来是插件，v92 起内置）
   导入 txt / docx / pdf / epub，选一个角色当共读搭子，一段一段一起读。
   角色不是每页硬点评，而是自己判断这段里有没有真想说的句子。

   依赖：docx 走已经打包进来的 mammoth；pdf 和 epub 会在你第一次导入
   这两种格式时去 CDN 拉 pdf.js / JSZip（离线打不开这两种，txt/docx 不受影响）。
   书籍原文和评论存在 IndexedDB（readTogetherMetaV1），
   读后感存在 char.readingNotes 里，跟着主存档一起备份。
   ===================================================================== */

// ⚠️ 原插件是靠 new Function(...) 跑的，所以开头那句 `if(...){return;}` 当时合法。
//    作为普通 <script> 文件加载时顶层 return 是语法错误（实测整个文件直接不执行），
//    所以这里整体包进 IIFE。里面的函数本来就通过 window.rtXxx 暴露了，包起来不影响 onclick。
(function () {

if(window.__readTogetherPluginInstalled){return;}
window.__readTogetherPluginInstalled = true;

var rtStyle = document.createElement('style');
rtStyle.textContent = '.rt-overlay{position:fixed;top:0;height:100vh;z-index:1500;background:#fff;display:none;flex-direction:column;box-sizing:border-box;}.rt-overlay.rt-fullscreen{left:0 !important;width:100% !important;z-index:1700;}.rt-overlay.rt-fullscreen .rt-topbar{display:none !important;}.rt-fs-exit-btn{position:absolute;top:calc(10px + env(safe-area-inset-top, 0px));right:14px;z-index:30;background:rgba(0,0,0,0.35);color:#fff;border:none;border-radius:16px;padding:6px 14px;font-size:12px;cursor:pointer;display:none;}.rt-overlay.rt-fullscreen .rt-fs-exit-btn{display:block;}.rt-overlay.rt-collapsed{height:auto !important;}.rt-overlay.rt-collapsed .rt-body,.rt-overlay.rt-collapsed .rt-nav-row,.rt-overlay.rt-collapsed .rt-discuss-dock,.rt-overlay.rt-collapsed .rt-loading{display:none !important;}.rt-topbar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1d9bf0;color:#fff;flex-shrink:0;flex-wrap:wrap;gap:6px;}.rt-topbar .rt-title{font-weight:bold;font-size:15px;}.rt-topbar button{background:rgba(255,255,255,0.2);color:#fff;border:none;padding:6px 10px;border-radius:16px;font-size:12px;cursor:pointer;margin-left:6px;}.rt-loading{background:#fffbe6;color:#8a6d00;font-size:12px;padding:6px 12px;text-align:center;flex-shrink:0;}.rt-body{flex:1;overflow-y:auto;padding:20px 24px;min-height:0;}.rt-chapter-title{font-size:18px;font-weight:bold;color:#0f1419;margin-bottom:14px;}.rt-chapter-text{font-size:16px;line-height:1.9;color:#0f1419;white-space:pre-wrap;word-wrap:break-word;margin-bottom:20px;}.rt-highlight{background:rgba(29,155,240,0.18);border-bottom:2px solid #1d9bf0;cursor:pointer;border-radius:2px;}.rt-highlight:hover{background:rgba(29,155,240,0.3);}.rt-comment-list{border-top:1px solid #eff3f4;padding-top:14px;display:flex;flex-direction:column;gap:12px;}.rt-comment-card{display:flex;gap:10px;transition:background-color .3s;border-radius:8px;padding:6px;}.rt-comment-card.rt-pulse{background:rgba(29,155,240,0.12);}.rt-comment-avatar{flex-shrink:0;}.rt-comment-body{flex:1;min-width:0;}.rt-comment-quote{font-size:13px;color:#536471;font-style:italic;margin-bottom:4px;}.rt-comment-text{font-size:14px;color:#0f1419;background:#f7f9f9;padding:8px 12px;border-radius:10px;display:inline-block;}.rt-inline-comment{display:flex;gap:8px;background:#f7f9f9;border-left:3px solid #1d9bf0;border-radius:8px;padding:8px 10px;margin:6px 0 14px 0;transition:background-color .3s;}.rt-inline-comment.rt-pulse{background:rgba(29,155,240,0.15);}.rt-inline-comment-avatar{flex-shrink:0;}.rt-inline-comment-body{flex:1;min-width:0;}.rt-inline-comment-text{font-size:14px;color:#0f1419;line-height:1.5;}.rt-inline-comment-quote-btn{display:block;margin-top:4px;background:transparent;border:none;color:#1d9bf0;font-size:12px;cursor:pointer;padding:0;}.rt-empty{text-align:center;color:#8b98a5;padding:30px 10px;font-size:13px;}.rt-nav-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#f7f9f9;border-top:1px solid #eff3f4;flex-shrink:0;flex-wrap:wrap;}.rt-nav-row button{background:#fff;color:#1d9bf0;border:1px solid #1d9bf0;padding:5px 12px;border-radius:14px;cursor:pointer;font-size:13px;}.rt-nav-row button:disabled{opacity:0.35;cursor:default;}.rt-nav-row select{border:1px solid #cfd9de;border-radius:8px;padding:4px 8px;font-size:12px;max-width:160px;}.rt-discuss-dock{flex-shrink:0;border-top:1px solid #eff3f4;background:#fff;max-height:34vh;display:flex;flex-direction:column;}.rt-discuss-title{font-size:12px;color:#536471;padding:6px 12px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;}.rt-quote-select-btn{background:transparent;border:1px solid #1d9bf0;color:#1d9bf0;border-radius:12px;padding:2px 10px;font-size:11px;cursor:pointer;flex-shrink:0;}.rt-quote-preview{display:flex;align-items:center;gap:8px;background:#eff8ff;border-left:3px solid #1d9bf0;padding:6px 12px;margin:6px 12px 0;border-radius:6px;font-size:12px;color:#536471;}.rt-quote-preview-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.rt-quote-preview-close{cursor:pointer;color:#8b98a5;font-weight:bold;flex-shrink:0;padding:0 4px;}.rt-discuss-area{flex:1;overflow-y:auto;padding:0 12px;display:flex;flex-direction:column;gap:8px;min-height:60px;}.rt-discuss-row{display:flex;gap:8px;align-items:flex-end;}.rt-discuss-row.rt-me{flex-direction:row-reverse;}.rt-discuss-avatar{flex-shrink:0;}.rt-discuss-bubble-wrap{display:flex;flex-direction:column;max-width:75%;}.rt-discuss-row.rt-me .rt-discuss-bubble-wrap{align-items:flex-end;}.rt-discuss-quote{font-size:11px;color:#8b98a5;background:#f0f2f5;border-left:2px solid #1d9bf0;padding:3px 8px;border-radius:4px;margin-bottom:3px;word-wrap:break-word;}.rt-discuss-bubble{background:#f0f2f5;color:#0f1419;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word;}.rt-discuss-row.rt-me .rt-discuss-bubble{background:#1d9bf0;color:#fff;}.rt-input-row{display:flex;gap:8px;padding:8px 12px;flex-shrink:0;}.rt-input-row input{flex:1;padding:9px 12px;border:1px solid #cfd9de;border-radius:20px;font-size:14px;outline:none;}.rt-input-row button{background:#1d9bf0;color:#fff;border:none;padding:8px 16px;border-radius:20px;font-size:13px;cursor:pointer;}.rt-library-item{display:flex;align-items:center;gap:10px;border-bottom:1px solid #eff3f4;padding:10px 0;}@media (max-width:900px){.rt-overlay{padding-top:calc(52px + env(safe-area-inset-top,0px));padding-bottom:calc(56px + env(safe-area-inset-bottom,0px));}.rt-topbar{padding:6px 8px;}.rt-topbar button{font-size:11px;padding:5px 8px;margin-left:4px;}.rt-body{padding:14px;}}';
document.head.appendChild(rtStyle);

// 🗂️ 侧栏 / 手机抽屉里不再加入口了——那两处本来就挤。
//    统一走 设置 → 🧩 小功能 → 一起阅读。

var rtOverlay = document.createElement('div');
rtOverlay.id = 'rtOverlay';
rtOverlay.className = 'rt-overlay';
rtOverlay.innerHTML = "<button id='rtFsExitBtn' class='rt-fs-exit-btn' title='退出全屏'>⛶ 退出全屏</button><div class='rt-topbar'><div class='rt-title' id='rtBookTitle'>📖 一起阅读</div><div><button id='rtLibraryBtn'>📚 书架</button><button id='rtImportBtn'>📥 导入</button><button id='rtOnlineBtn' onclick=\"if(window.gyResOpen) gyResOpen('book')\">🌐 在线找书</button><button id='rtCompanionBtn'>👤 搭子</button><button id='rtReflectionGenBtn'>🏁 写读后感</button><button id='rtReflectionListBtn'>📝 读后感列表</button><button id='rtFullscreenBtn' title='全屏'>⛶ 全屏</button><button id='rtCollapseBtn' title='收起/展开'>—</button><button id='rtCloseBtn'>✕ 关闭</button></div></div><div class='rt-loading' id='rtLoadingHint' style='display:none;'>TA正在思考中...</div><div class='rt-body' id='rtReaderBody'></div><div class='rt-nav-row'><button id='rtPrevBtn'>◀ 上一部分</button><span id='rtChapterLabel'>0 / 0</span><select id='rtChapterJump'></select><button id='rtNextBtn'>下一部分 ▶</button></div><div class='rt-discuss-dock'><div class='rt-discuss-title'><span>💬 和TA聊聊这段</span><button id='rtQuoteSelectBtn' class='rt-quote-select-btn'>🔖 引用选中文字</button></div><div class='rt-discuss-area' id='rtDiscussArea'></div><div class='rt-quote-preview' id='rtQuotePreview' style='display:none;'><div class='rt-quote-preview-text' id='rtQuotePreviewText'></div><span class='rt-quote-preview-close' id='rtQuotePreviewClose'>✕</span></div><div class='rt-input-row'><input type='text' id='rtDiscussInput' placeholder='说说你的想法...'><button id='rtDiscussSendBtn'>发送</button></div></div>";
document.body.appendChild(rtOverlay);

var rtImportModal = document.createElement('div');
rtImportModal.id = 'rtImportModal';
rtImportModal.className = 'modal-overlay';
rtImportModal.innerHTML = "<div class='modal-box' style='width:420px;'><h2>📥 导入书籍</h2><div class='form-hint'>支持 txt / docx / pdf / epub 格式，导入后会自动尝试按章节拆分，方便和搭子一段一段地读；识别不出章节的话会自动改成固定长度分页。</div><button class='btn-edit-small' id='rtPickFileBtn' type='button'>📂 选择文件</button><span id='rtFileNameLabel' style='font-size:12px;color:#1d9bf0;margin-left:8px;'></span><input type='file' id='rtImportFileInput' accept='*/*' style='display:none;'><div style='margin-top:10px;'><label style='font-size:13px;color:#536471;'>书名（选填，不填用文件名）</label><input type='text' id='rtImportTitleInput' placeholder='这本书叫什么'></div><div id='rtImportStatus' style='font-size:13px;color:#1d9bf0;margin-top:8px;min-height:18px;'></div><button class='btn-primary' id='rtImportConfirmBtn'>开始导入</button><button class='btn-cancel' onclick=\"closeModal('rtImportModal')\">取消</button></div>";
document.body.appendChild(rtImportModal);

var rtLibraryModal = document.createElement('div');
rtLibraryModal.id = 'rtLibraryModal';
rtLibraryModal.className = 'modal-overlay';
rtLibraryModal.innerHTML = "<div class='modal-box' style='width:460px;max-height:75vh;overflow-y:auto;'><h2>📚 书架</h2><div id='rtLibraryList'></div><button class='btn-cancel' onclick=\"closeModal('rtLibraryModal')\">关闭</button></div>";
document.body.appendChild(rtLibraryModal);

var rtCompanionModal = document.createElement('div');
rtCompanionModal.id = 'rtCompanionModal';
rtCompanionModal.className = 'modal-overlay';
rtCompanionModal.innerHTML = "<div class='modal-box' style='width:420px;'><h2>👤 选一个一起读书的搭子</h2><div class='form-hint'>选好后，TA会读到你翻到的每一部分，并根据自己的人设决定要不要评论、和你讨论内容。</div><div id='rtCompanionList' style='display:flex;gap:12px;flex-wrap:wrap;'></div><button class='btn-cancel' onclick=\"closeModal('rtCompanionModal')\">关闭</button></div>";
document.body.appendChild(rtCompanionModal);

var rtReflectionModal = document.createElement('div');
rtReflectionModal.id = 'rtReflectionModal';
rtReflectionModal.className = 'modal-overlay';
rtReflectionModal.innerHTML = "<div class='modal-box' style='width:480px;'><h2>🏁 TA的读后感</h2><div class='form-hint'>可以在保存前直接修改。</div><label style='font-size:13px;color:#536471;'>标题</label><input type='text' id='rtReflectionTitleInput'><label style='font-size:13px;color:#536471;'>正文</label><textarea id='rtReflectionContentArea' rows='10'></textarea><button class='btn-primary' id='rtReflectionSaveBtn'>保存</button><button class='btn-secondary' id='rtReflectionRegenBtn'>🔄 重新生成</button><button class='btn-cancel' onclick=\"closeModal('rtReflectionModal')\">取消</button></div>";
document.body.appendChild(rtReflectionModal);

var rtReflectionListModal = document.createElement('div');
rtReflectionListModal.id = 'rtReflectionListModal';
rtReflectionListModal.className = 'modal-overlay';
rtReflectionListModal.innerHTML = "<div class='modal-box' style='width:460px;max-height:75vh;overflow-y:auto;'><h2>📝 读后感列表</h2><div id='rtReflectionListContent'></div><button class='btn-cancel' onclick=\"closeModal('rtReflectionListModal')\">关闭</button></div>";
document.body.appendChild(rtReflectionListModal);

var rtReflectionDetailModal = document.createElement('div');
rtReflectionDetailModal.id = 'rtReflectionDetailModal';
rtReflectionDetailModal.className = 'modal-overlay';
rtReflectionDetailModal.innerHTML = "<div class='modal-box' style='width:480px;max-height:75vh;overflow-y:auto;'><h3 id='rtReflectionDetailTitle' style='color:#1d9bf0;margin-top:0;'></h3><div id='rtReflectionDetailMeta' style='font-size:12px;color:#536471;margin-bottom:10px;'></div><div id='rtReflectionDetailContent' style='font-size:15px;line-height:1.7;white-space:pre-wrap;'></div><button class='btn-cancel' onclick=\"closeModal('rtReflectionDetailModal')\">关闭</button></div>";
document.body.appendChild(rtReflectionDetailModal);

var rtMetaStore = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({name:'readTogetherMetaV1'}) : null;
window.__rtState = { books: [], currentBookId: null };
window.__rtPendingReflection = null;
window.__rtPendingQuote = null;

function rtSaveState(){ if(rtMetaStore){ rtMetaStore.setItem('state', window.__rtState).catch(function(e){ console.error('保存阅读插件数据失败', e); }); } }
function rtSetLoading(on){ var el = document.getElementById('rtLoadingHint'); if(el){ el.style.display = on ? 'block' : 'none'; } }
function rtCurrentBook(){ var books = window.__rtState.books || []; return books.find(function(b){ return b.id === window.__rtState.currentBookId; }) || null; }

function rtSetPendingQuote(text){
  window.__rtPendingQuote = text;
  var bar = document.getElementById('rtQuotePreview');
  var txtEl = document.getElementById('rtQuotePreviewText');
  if(bar && txtEl){
    txtEl.innerText = '引用：' + text;
    bar.style.display = 'flex';
  }
  var input = document.getElementById('rtDiscussInput');
  if(input){ input.focus(); }
}
function rtClearPendingQuote(){
  window.__rtPendingQuote = null;
  var bar = document.getElementById('rtQuotePreview');
  if(bar){ bar.style.display = 'none'; }
}

function rtSyncOverlaySize(){
  var overlay = document.getElementById('rtOverlay');
  if(!overlay || overlay.style.display!=='flex'){ return; }
  if(overlay.classList.contains('rt-fullscreen')){
    overlay.style.left = '0px';
    overlay.style.width = '100%';
    return;
  }
  var mc = document.querySelector('.main-content');
  if(mc){
    var rect = mc.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
  } else {
    overlay.style.left = '0px';
    overlay.style.width = '100%';
  }
}
window.addEventListener('resize', rtSyncOverlaySize);

/* 💬 这一趟读完（关掉阅读页）之后，搭子像真人一样在私聊里再说两句（js/28 gyAfterActivity）。
   只有真读了（翻过页、或者聊过）才算；开一下就关掉不算。 */
var rtSess = null;   // { bookId, ch, t0 }
function rtSessStart(){
  var b = rtCurrentBook();
  rtSess = b ? { bookId: b.id, ch: b.currentChapterIndex, t0: Date.now() } : null;
}
function rtAfterRead(){
  try{
    var s = rtSess; rtSess = null;
    if(!s || typeof window.gyAfterActivity !== 'function') return;
    var b = (window.__rtState.books || []).find(function(x){ return x.id === s.bookId; });
    if(!b || !b.companionCharId) return;
    var talk = [];
    Object.keys(b.discussion || {}).forEach(function(k){
      (b.discussion[k] || []).forEach(function(m){ if((m.ts || 0) >= s.t0) talk.push(m); });
    });
    var moved = b.currentChapterIndex !== s.ch;
    if(!moved && !talk.length) return;
    var char = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(function(c){ return String(c.id) === String(b.companionCharId); });
    if(!char) return;
    var uname = (typeof userDisplayName === 'function') ? userDisplayName(char) : '对方';
    var chName = function(i){ var c = b.chapters[i]; return c ? (c.title || ('第' + (i+1) + '部分')) : ''; };
    var mine = [];
    for(var i = Math.min(s.ch, b.currentChapterIndex); i <= Math.max(s.ch, b.currentChapterIndex); i++){
      (b.comments[i] || []).forEach(function(c){ if(c && c.comment) mine.push('（读到「' + (c.quote || '') + '」时）你说：' + c.comment); });
    }
    talk.sort(function(a, z){ return (a.ts || 0) - (z.ts || 0); });
    var summary = '一起读《' + b.title + '》' + (moved ? '，从「' + chName(s.ch) + '」读到了「' + chName(b.currentChapterIndex) + '」' : '，停在「' + chName(b.currentChapterIndex) + '」') + '。'
      + (mine.length ? '\n你边读边写的评论：\n' + mine.slice(-8).join('\n') : '')
      + (talk.length ? '\n你们聊过的：\n' + talk.slice(-12).map(function(m){ return (m.role === 'user' ? uname : char.name) + '：' + m.text; }).join('\n') : '');
    window.gyAfterActivity(char.id, '一起读书', summary, { by: b.companionBy === 'char' ? 'char' : 'me', mins: (Date.now() - s.t0) / 60000 });
  } catch(e){ console.warn('[一起阅读] 事后消息没发出去：', e); }
}
window.rtOpenOverlay = function(){
  var ov = document.getElementById('rtOverlay');
  var wasOpen = ov.style.display === 'flex';
  ov.style.display = 'flex';
  rtSyncOverlaySize();
  rtRenderReader();
  if(!wasOpen || !rtSess) rtSessStart();
};
window.rtCloseOverlay = function(){ document.getElementById('rtOverlay').style.display = 'none'; rtAfterRead(); };
document.getElementById('rtCloseBtn').addEventListener('click', function(){ window.rtCloseOverlay(); });
document.getElementById('rtCollapseBtn').addEventListener('click', function(){ document.getElementById('rtOverlay').classList.toggle('rt-collapsed'); });
// 全屏时顶部栏（书名/书架/导入/搭子/写读后感等按钮）整个隐藏掉，只剩纯正文，更专注阅读；
// 顶部栏一隐藏，原来挂在顶部栏里的"退出全屏"按钮也跟着看不见了，所以另外做了个悬浮在
// 右上角的小按钮(rtFsExitBtn，只在全屏时才显示)专门用来退出全屏，两个按钮共用同一套切换逻辑。
function rtSetFullscreen(isFull){
  var overlay = document.getElementById('rtOverlay');
  overlay.classList.toggle('rt-fullscreen', isFull);
  var dock = overlay.querySelector('.rt-discuss-dock');
  if(dock){ dock.style.display = isFull ? 'none' : ''; }
  var topbarBtn = document.getElementById('rtFullscreenBtn');
  if(topbarBtn){ topbarBtn.innerText = isFull ? '⛶ 退出全屏' : '⛶ 全屏'; }
  rtSyncOverlaySize();
}
document.getElementById('rtFullscreenBtn').addEventListener('click', function(){
  var overlay = document.getElementById('rtOverlay');
  rtSetFullscreen(!overlay.classList.contains('rt-fullscreen'));
});
document.getElementById('rtFsExitBtn').addEventListener('click', function(){ rtSetFullscreen(false); });
document.getElementById('rtLibraryBtn').addEventListener('click', function(){ window.rtOpenLibrary(); });
document.getElementById('rtImportBtn').addEventListener('click', function(){ window.rtOpenImportModal(); });
document.getElementById('rtCompanionBtn').addEventListener('click', function(){ window.rtOpenCompanionModal(); });
document.getElementById('rtReflectionGenBtn').addEventListener('click', function(){ window.rtOpenReflectionGen(); });
document.getElementById('rtReflectionListBtn').addEventListener('click', function(){ window.rtOpenReflectionList(); });
document.getElementById('rtImportConfirmBtn').addEventListener('click', function(){ window.rtConfirmImport(); });
document.getElementById('rtPickFileBtn').addEventListener('click', function(){ if(typeof openFilePickerForApp === 'function'){ openFilePickerForApp('rtImportFileInput'); } else { document.getElementById('rtImportFileInput').click(); } });
document.getElementById('rtImportFileInput').addEventListener('change', function(e){ var f = e.target.files && e.target.files[0]; document.getElementById('rtFileNameLabel').innerText = f ? ('已选择：' + f.name) : ''; });
document.getElementById('rtReflectionSaveBtn').addEventListener('click', function(){ window.rtSaveReflection(); });
document.getElementById('rtReflectionRegenBtn').addEventListener('click', function(){ window.rtOpenReflectionGen(); });
document.getElementById('rtDiscussSendBtn').addEventListener('click', function(){ window.rtSendDiscuss(); });
document.getElementById('rtDiscussInput').addEventListener('keypress', function(e){ if(e.key==='Enter'){ window.rtSendDiscuss(); } });
document.getElementById('rtChapterJump').addEventListener('change', function(){ window.rtJumpChapter(this.value); });
document.getElementById('rtQuotePreviewClose').addEventListener('click', function(){ rtClearPendingQuote(); });
document.getElementById('rtQuoteSelectBtn').addEventListener('click', function(){
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  var chapterEl = document.getElementById('rtChapterText');
  var inChapter = !!(text && chapterEl && sel.anchorNode && (chapterEl.contains(sel.anchorNode) || chapterEl === sel.anchorNode));
  if(!text || !inChapter){
    alert('请先在上方正文里选中你想讨论的一段文字，再点这个按钮。');
    return;
  }
  rtSetPendingQuote(text);
});

document.getElementById('rtOverlay').addEventListener('click', function(e){
  var hl = e.target.closest && e.target.closest('.rt-highlight');
  if(hl){
    var idx = hl.getAttribute('data-rt-comment');
    var card = document.getElementById('rt-comment-idx-'+idx);
    if(card){ card.scrollIntoView({behavior:'smooth', block:'center'}); card.classList.add('rt-pulse'); setTimeout(function(){ card.classList.remove('rt-pulse'); }, 1200); }
  }
  var qbtn = e.target.closest && e.target.closest('.rt-inline-comment-quote-btn');
  if(qbtn){
    var qidx = parseInt(qbtn.getAttribute('data-rt-quote-comment'), 10);
    var book = rtCurrentBook();
    if(book){
      var comments = book.comments[book.currentChapterIndex] || [];
      var c = comments[qidx];
      if(c && c.comment){ rtSetPendingQuote(c.comment); }
    }
  }
});

document.getElementById('rtCompanionModal').addEventListener('click', async function(e){
  var pick = e.target.closest('.rt-companion-pick');
  if(pick){
    var book = rtCurrentBook(); if(!book) return;
    var cid = pick.getAttribute('data-char-id');
    closeModal('rtCompanionModal');
    // 📨 邀请发成私聊里的一张卡（js/28）：以前选一下人就直接当搭子了，
    //    TA 连拒绝的机会都没有，聊天记录里也留不下"你叫过 TA 一起读这本书"。
    var c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(function(x){ return String(x.id) === String(cid); });
    if (c && typeof window.gyInviteSend === 'function') {
      await window.gyInviteSend({
        char: c, kind: 'read',
        title: book.title || '一本书',
        bookId: book.id,
        sub: '一段一段地读，读到哪儿聊到哪儿',
        onYes: function(){ book.companionCharId = cid; book.companionBy = 'me'; rtSaveState(); rtRenderReader(); },
        onNo:  function(){ rtRenderReader(); }
      });
      return;
    }
    book.companionCharId = cid;
    book.companionBy = 'me';
    rtSaveState();
    rtRenderReader();
  }
});

// 给邀请卡片的「去读 ›」用：这时候已经答应过了，直接设成搭子
// by：'me'＝你约的 TA（默认），'char'＝TA 约的你
window.rtSetCompanion = function(charId, by){
  var book = rtCurrentBook(); if(!book) return;
  book.companionCharId = String(charId);
  book.companionBy = (by === 'char') ? 'char' : 'me';
  rtSaveState();
  try { rtRenderReader(); } catch(e){}
};

/* ===== 文件解析：txt / docx / pdf / epub ===== */
function rtReadAsText(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(reader.result); };
    reader.onerror = function(){ reject(new Error('文件读取失败')); };
    reader.readAsText(file, 'utf-8');
  });
}
function rtLoadPdfJs(){
  if(window.pdfjsLib){ return Promise.resolve(); }
  if(window.__rtPdfJsLoading){ return window.__rtPdfJsLoading; }
  window.__rtPdfJsLoading = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function(){
      try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; }catch(e){}
      resolve();
    };
    s.onerror = function(){ reject(new Error('PDF解析库加载失败，请检查网络')); };
    document.head.appendChild(s);
  });
  return window.__rtPdfJsLoading;
}
function rtLoadJSZip(){
  if(window.JSZip){ return Promise.resolve(); }
  if(window.__rtJsZipLoading){ return window.__rtJsZipLoading; }
  window.__rtJsZipLoading = new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('EPUB解析库加载失败，请检查网络')); };
    document.head.appendChild(s);
  });
  return window.__rtJsZipLoading;
}
function rtFixedPaginate(text, fallbackTitle){
  var chunkSize = 1200;
  var paras = text.split(/\n{2,}/);
  var chapters = [];
  var buf = '';
  var pageNum = 1;
  paras.forEach(function(p){
    p = p.trim();
    if(!p) return;
    if((buf + '\n\n' + p).length > chunkSize && buf){
      chapters.push({title: fallbackTitle+' 第'+pageNum+'页', text: buf.trim()});
      pageNum++;
      buf = p;
    } else {
      buf = buf ? (buf + '\n\n' + p) : p;
    }
  });
  if(buf.trim()){ chapters.push({title: fallbackTitle+' 第'+pageNum+'页', text: buf.trim()}); }
  if(chapters.length===0 && text.trim()){ chapters.push({title: fallbackTitle, text: text.trim()}); }
  return chapters;
}
function rtSplitChapters(fullText, fallbackTitle){
  var text = fullText.replace(/\r\n/g, '\n');
  var pattern = /^[ \t]*(第[0-9一二三四五六七八九十百千零两\d]+[章回卷部篇][^\n]{0,40}|[Cc]hapter\s+\d+[^\n]{0,40}|[Pp]art\s+\d+[^\n]{0,40})[ \t]*$/gm;
  var matches = [];
  var m;
  while((m = pattern.exec(text)) !== null){ matches.push({index: m.index, title: m[0].trim()}); }
  var chapters = [];
  if(matches.length >= 2){
    for(var i=0;i<matches.length;i++){
      var start = matches[i].index;
      var end = (i+1<matches.length) ? matches[i+1].index : text.length;
      var body = text.slice(start, end).trim();
      if(body){ chapters.push({title: matches[i].title, text: body}); }
    }
  }
  var totalLen = text.length;
  var tooFew = chapters.length < 2;
  var tooUneven = chapters.some(function(c){ return c.text.length > 30000; }) && chapters.length < (totalLen/8000);
  if(tooFew || tooUneven){ chapters = rtFixedPaginate(text, fallbackTitle); }
  return chapters;
}
function rtHtmlToText(html){
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var body = doc.body || doc;
  var blockTags = {P:1,DIV:1,BR:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,LI:1,TR:1};
  var out = [];
  (function walk(node){
    if(node.nodeType===3){ out.push(node.textContent); return; }
    if(node.nodeType!==1) return;
    if(node.tagName==='SCRIPT' || node.tagName==='STYLE') return;
    var children = node.childNodes;
    for(var i=0;i<children.length;i++){ walk(children[i]); }
    if(blockTags[node.tagName]){ out.push('\n'); }
  })(body);
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
async function rtParseEpub(file){
  await rtLoadJSZip();
  var buf = await file.arrayBuffer();
  var zip = await window.JSZip.loadAsync(buf);
  var containerFile = zip.file('META-INF/container.xml');
  if(!containerFile){ throw new Error('不是有效的EPUB文件（找不到container.xml）'); }
  var containerXml = await containerFile.async('text');
  var containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
  var rootfileEl = containerDoc.querySelector('rootfile');
  var opfPath = rootfileEl ? rootfileEl.getAttribute('full-path') : null;
  if(!opfPath){ throw new Error('EPUB结构异常，找不到内容清单文件'); }
  var opfDir = opfPath.indexOf('/')!==-1 ? opfPath.slice(0, opfPath.lastIndexOf('/')+1) : '';
  var opfFile = zip.file(opfPath);
  if(!opfFile){ throw new Error('EPUB内容清单文件缺失'); }
  var opfXml = await opfFile.async('text');
  var opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');
  var manifestMap = {};
  Array.prototype.slice.call(opfDoc.querySelectorAll('manifest > item')).forEach(function(item){
    manifestMap[item.getAttribute('id')] = item.getAttribute('href');
  });
  var bookTitleEl = opfDoc.querySelector('title');
  var bookTitle = bookTitleEl ? bookTitleEl.textContent.trim() : null;
  var spineItems = Array.prototype.slice.call(opfDoc.querySelectorAll('spine > itemref'));
  var chapters = [];
  for(var i=0;i<spineItems.length;i++){
    var idref = spineItems[i].getAttribute('idref');
    var href = manifestMap[idref];
    if(!href) continue;
    var fullPath = opfDir + href;
    var chapFile = zip.file(fullPath) || zip.file(decodeURIComponent(fullPath));
    if(!chapFile) continue;
    var chapHtml = await chapFile.async('text');
    var parsedText = rtHtmlToText(chapHtml);
    if(!parsedText || parsedText.trim().length < 30) continue;
    var headingMatch = chapHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    var chapTitle = headingMatch ? rtHtmlToText(headingMatch[1]).trim().slice(0,40) : ('第'+(chapters.length+1)+'部分');
    chapters.push({ title: chapTitle || ('第'+(chapters.length+1)+'部分'), text: parsedText.trim() });
  }
  if(chapters.length===0){ throw new Error('没能从这个EPUB里提取出正文章节'); }
  var finalChapters = [];
  chapters.forEach(function(c){
    if(c.text.length > 20000){ finalChapters = finalChapters.concat(rtFixedPaginate(c.text, c.title)); }
    else { finalChapters.push(c); }
  });
  return { title: bookTitle, chapters: finalChapters };
}
async function rtParseFile(file, ext){
  if(ext==='txt'){
    var text = await rtReadAsText(file);
    return { title: null, chapters: rtSplitChapters(text, file.name.replace(/\.[^.]+$/, '')) };
  }
  if(ext==='docx'){
    if(typeof mammoth==='undefined'){ throw new Error('文档解析库加载失败，请检查网络'); }
    var arrayBuffer = await file.arrayBuffer();
    var result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
    return { title: null, chapters: rtSplitChapters(result.value, file.name.replace(/\.[^.]+$/, '')) };
  }
  if(ext==='pdf'){
    await rtLoadPdfJs();
    var buf2 = await file.arrayBuffer();
    var pdf = await window.pdfjsLib.getDocument({data: buf2}).promise;
    var pages = [];
    for(var p=1;p<=pdf.numPages;p++){
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      pages.push(content.items.map(function(it){ return it.str; }).join(' '));
    }
    return { title: null, chapters: rtSplitChapters(pages.join('\n\n'), file.name.replace(/\.[^.]+$/, '')) };
  }
  if(ext==='epub'){ return await rtParseEpub(file); }
  throw new Error('不支持的格式');
}

/* ===== 导入书籍 ===== */
window.rtOpenImportModal = function(){
  document.getElementById('rtImportFileInput').value = '';
  document.getElementById('rtImportTitleInput').value = '';
  document.getElementById('rtImportStatus').innerText = '';
  document.getElementById('rtFileNameLabel').innerText = '';
  if(typeof openModal==='function'){ openModal('rtImportModal'); }
};
// 🌐 在线找到的书（js/59）：拿到纯文本就直接变成一本书，跟导入 txt 走同一套分章
window.rtImportText = async function(title, text, meta){
  if(!text || !String(text).trim()) return null;
  var file = new File([String(text)], (title || '在线书籍').replace(/[\\/:*?"<>|]/g,'') + '.txt', { type: 'text/plain' });
  var result = await rtParseFile(file, 'txt');
  if(!result.chapters || !result.chapters.length) return null;
  // ⚠️ 搭子不再"顺手沿用上一本书的"：这本是谁找来的、跟谁一起读，由打开它的人（邀请卡 / 你自己选）来定，
  //    不然 TA 约你读的书，搭子可能是上一本书的另一个人。
  var book = { id: 'book_' + Date.now() + Math.random().toString(36).slice(2, 5), title: title || result.title || '在线书籍', format: 'txt', addedAt: Date.now(),
    chapters: result.chapters, currentChapterIndex: 0, companionCharId: null,
    comments: {}, discussion: {}, finished: false, online: (meta && meta.src) || true };
  window.__rtState.books.push(book);
  if(!window.__rtState.currentBookId || !rtCurrentBook()) window.__rtState.currentBookId = book.id;
  rtSaveState();
  return book;
};
window.rtConfirmImport = async function(){
  var fileInput = document.getElementById('rtImportFileInput');
  var file = fileInput.files && fileInput.files[0];
  if(!file){ alert('请先选择一个文件！'); return; }
  var ext = file.name.split('.').pop().toLowerCase();
  if(['txt','pdf','docx','epub'].indexOf(ext)===-1){ alert('暂时只支持 txt / pdf / docx / epub 格式'); return; }
  var statusEl = document.getElementById('rtImportStatus');
  statusEl.innerText = '正在解析文件，请稍候...';
  try{
    var result = await rtParseFile(file, ext);
    if(!result.chapters || result.chapters.length===0){ statusEl.innerText = ''; alert('没能从这个文件里提取出正文内容，换个文件试试？'); return; }
    var titleInput = document.getElementById('rtImportTitleInput').value.trim();
    var lastCompanion = window.__rtState.books.length ? window.__rtState.books[window.__rtState.books.length-1].companionCharId : null;
    var book = {
      id: 'book_' + Date.now(),
      title: titleInput || result.title || file.name.replace(/\.[^.]+$/, ''),
      format: ext,
      addedAt: Date.now(),
      chapters: result.chapters,
      currentChapterIndex: 0,
      companionCharId: lastCompanion || (myCharacters[0] && myCharacters[0].id) || null,
      comments: {},
      discussion: {},
      finished: false
    };
    window.__rtState.books.push(book);
    window.__rtState.currentBookId = book.id;
    rtSaveState();
    statusEl.innerText = '';
    closeModal('rtImportModal');
    rtRenderReader();
    if(!book.companionCharId){ window.rtOpenCompanionModal(); }
  } catch(e){
    console.error('解析文件失败', e);
    statusEl.innerText = '';
    alert('解析失败：' + (e && e.message ? e.message : '未知错误'));
  }
};

/* ===== 书架 ===== */
window.rtOpenLibrary = function(){
  var container = document.getElementById('rtLibraryList');
  var books = window.__rtState.books || [];
  if(books.length===0){ container.innerHTML = '<div class="empty-state">还没有导入过书~</div>'; }
  else {
    container.innerHTML = books.slice().reverse().map(function(b){
      var progress = b.chapters.length ? Math.round(((b.currentChapterIndex+1)/b.chapters.length)*100) : 0;
      var char = myCharacters.find(function(c){ return c.id===b.companionCharId; });
      return '<div class="rt-library-item"><div style="flex:1;min-width:0;cursor:pointer;" onclick="window.rtOpenBook(\'' + b.id + '\')"><div style="font-weight:bold;font-size:14px;">' + escapeHtml(b.title) + (b.finished ? ' ✅' : '') + '</div><div style="font-size:12px;color:#536471;margin-top:2px;">' + (char ? ('搭子：' + escapeHtml(char.name) + ' · ') : '') + '进度 ' + progress + '%（' + b.chapters.length + '部分）</div></div><button class="btn-edit-small" style="color:#f91880;border-color:#f91880;flex-shrink:0;" onclick="window.rtDeleteBook(\'' + b.id + '\', event)">删除</button></div>';
    }).join('');
  }
  if(typeof openModal==='function'){ openModal('rtLibraryModal'); }
};
window.rtOpenBook = function(bookId){
  var prev = window.__rtState.currentBookId;
  if(prev && prev !== bookId && rtSess){ rtAfterRead(); }
  window.__rtState.currentBookId = bookId;
  // 从 TA 的邀请卡进来、书当时还没到手：现在打开的这本就跟 TA 一起读
  var pc = window.__rtPendingCompanion;
  if(pc){
    window.__rtPendingCompanion = null;
    var bk = (window.__rtState.books || []).find(function(x){ return x.id === bookId; });
    if(bk){ bk.companionCharId = String(pc.charId); bk.companionBy = pc.by === 'char' ? 'char' : 'me'; }
  }
  if(document.getElementById('rtOverlay').style.display === 'flex' && (!rtSess || rtSess.bookId !== bookId)){ setTimeout(rtSessStart, 0); }
  rtClearPendingQuote();
  rtSaveState();
  closeModal('rtLibraryModal');
  rtRenderReader();
};
window.rtDeleteBook = function(bookId, event){
  if(event) event.stopPropagation();
  if(!confirm('确定删除这本书吗？阅读进度和评论/讨论记录都会一起删除（已保存的读后感不受影响）。')) return;
  window.__rtState.books = (window.__rtState.books || []).filter(function(b){ return b.id !== bookId; });
  if(window.__rtState.currentBookId===bookId){ window.__rtState.currentBookId = (window.__rtState.books[0] && window.__rtState.books[0].id) || null; }
  rtSaveState();
  window.rtOpenLibrary();
  rtRenderReader();
};

/* ===== 搭子选择 ===== */
window.rtOpenCompanionModal = function(){
  var book = rtCurrentBook();
  var list = document.getElementById('rtCompanionList');
  // 前置条件：没配 API、翻页评论开关关着，都会让"选了搭子却没人说话"
  try {
    var reqBox = document.getElementById('rtCompanionReq');
    if (!reqBox && list && list.parentElement) {
      reqBox = document.createElement('div'); reqBox.id = 'rtCompanionReq';
      list.parentElement.insertBefore(reqBox, list);
    }
    if (reqBox) reqBox.innerHTML = (typeof gyReqBox === 'function')
      ? gyReqBox([{ api: true }, { sw: 'readComment' }], { title: '想让搭子在书页旁边写评论，还差这些' }) : '';
  } catch (e) {}
  if(!myCharacters || myCharacters.length===0){ list.innerHTML = '<div style="color:#888;font-size:13px;">还没有角色，先去角色中心创建一个吧。</div>'; }
  else {
    list.innerHTML = myCharacters.map(function(c){
      var op = (book && book.companionCharId==c.id) ? '1' : '0.5';
      return '<div class="rt-companion-pick" data-char-id="' + c.id + '" style="display:flex;flex-direction:column;align-items:center;cursor:pointer;opacity:' + op + ';">' + getAvatarHTML(c,44) + '<div style="font-size:12px;margin-top:4px;">' + escapeHtml(c.name) + '</div></div>';
    }).join('');
  }
  if(typeof openModal==='function'){ openModal('rtCompanionModal'); }
};

/* ===== 阅读器渲染 ===== */
function rtRenderChapterHtml(text, comments){
  var escText = escapeHtml(text);
  var matches = [];
  (comments||[]).forEach(function(c, i){
    if(!c.quote) return;
    var escQuote = escapeHtml(c.quote);
    if(!escQuote) return;
    var pos = escText.indexOf(escQuote);
    if(pos===-1) return;
    matches.push({start: pos, end: pos + escQuote.length, i: i, c: c, escQuote: escQuote});
  });
  matches.sort(function(a,b){ return a.start - b.start; });
  var filtered = [];
  var lastEnd = -1;
  matches.forEach(function(m){
    if(m.start >= lastEnd){ filtered.push(m); lastEnd = m.end; }
  });
  var html = '';
  var cursor = 0;
  filtered.forEach(function(m){
    html += escText.slice(cursor, m.start);
    html += '<span class="rt-highlight" data-rt-comment="' + m.i + '">' + m.escQuote + '</span>';
    var char = myCharacters.find(function(x){ return x.id==m.c.charId; });
    html += '<div class="rt-inline-comment" id="rt-comment-idx-' + m.i + '">' +
      (char ? ('<div class="rt-inline-comment-avatar">' + getAvatarHTML(char,26) + '</div>') : '') +
      '<div class="rt-inline-comment-body">' +
        '<div class="rt-inline-comment-text">' + escapeHtml(m.c.comment) + '</div>' +
        '<button class="rt-inline-comment-quote-btn" data-rt-quote-comment="' + m.i + '">💬 讨论这条评论</button>' +
      '</div></div>';
    cursor = m.end;
  });
  html += escText.slice(cursor);
  return html.replace(/\n/g, '<br>');
}
function rtRenderDiscuss(){
  var book = rtCurrentBook(); if(!book) return;
  var container = document.getElementById('rtDiscussArea');
  var idx = book.currentChapterIndex;
  var log = book.discussion[idx] || [];
  if(log.length===0){ container.innerHTML = '<div class="rt-empty" style="padding:16px;">跟TA聊聊这段内容吧~</div>'; return; }
  container.innerHTML = log.map(function(m){
    var isMe = m.role==='user';
    var char = isMe ? null : myCharacters.find(function(c){ return c.id==m.charId; });
    var avatarHtml = isMe ? '' : (char ? ('<div class="rt-discuss-avatar">' + getAvatarHTML(char,28) + '</div>') : '');
    var quoteHtml = m.quote ? ('<div class="rt-discuss-quote">「' + escapeHtml(m.quote) + '」</div>') : '';
    return '<div class="rt-discuss-row' + (isMe ? ' rt-me' : '') + '">' + avatarHtml + '<div class="rt-discuss-bubble-wrap">' + quoteHtml + '<div class="rt-discuss-bubble">' + escapeHtml(m.text) + '</div></div></div>';
  }).join('');
  container.scrollTop = container.scrollHeight;
}
function rtRenderReader(){
  var book = rtCurrentBook();
  var body = document.getElementById('rtReaderBody');
  var titleEl = document.getElementById('rtBookTitle');
  var navLabel = document.getElementById('rtChapterLabel');
  var jumpSel = document.getElementById('rtChapterJump');
  if(!book){
    titleEl.innerText = '📖 一起阅读';
    body.innerHTML = '<div class="rt-empty">还没有导入书籍，点右上角"📥 导入"开始吧~</div>';
    navLabel.innerText = '';
    jumpSel.innerHTML = '';
    document.getElementById('rtDiscussArea').innerHTML = '';
    document.getElementById('rtPrevBtn').disabled = true;
    document.getElementById('rtNextBtn').disabled = true;
    return;
  }
  titleEl.innerText = '📖 ' + book.title;
  var idx = book.currentChapterIndex;
  var chapter = book.chapters[idx];
  var comments = book.comments[idx] || [];
  body.innerHTML = '<div class="rt-chapter-title">' + escapeHtml(chapter.title || ('第' + (idx+1) + '部分')) + '</div>' +
    '<div class="rt-chapter-text" id="rtChapterText">' + rtRenderChapterHtml(chapter.text, comments) + '</div>';
  navLabel.innerText = (idx+1) + ' / ' + book.chapters.length;
  jumpSel.innerHTML = book.chapters.map(function(c,i){ return '<option value="' + i + '">' + (i+1) + '. ' + escapeHtml((c.title||'').slice(0,20)) + '</option>'; }).join('');
  jumpSel.value = idx;
  document.getElementById('rtPrevBtn').disabled = (idx<=0);
  document.getElementById('rtNextBtn').disabled = false;
  rtRenderDiscuss();
  if(comments.length===0 && book.companionCharId){ rtGenerateComments(book, idx); }
}
window.rtPrevChapter = function(){
  var book = rtCurrentBook(); if(!book) return;
  if(book.currentChapterIndex>0){ book.currentChapterIndex--; rtClearPendingQuote(); rtSaveState(); rtRenderReader(); }
};
window.rtNextChapter = function(){
  var book = rtCurrentBook(); if(!book) return;
  if(book.currentChapterIndex < book.chapters.length-1){ book.currentChapterIndex++; rtClearPendingQuote(); rtSaveState(); rtRenderReader(); }
  else if(confirm('已经是最后一部分了，要现在写读后感吗？')){ window.rtOpenReflectionGen(); }
};
window.rtJumpChapter = function(idx){
  var book = rtCurrentBook(); if(!book) return;
  idx = parseInt(idx, 10);
  if(!isNaN(idx) && idx>=0 && idx<book.chapters.length){ book.currentChapterIndex = idx; rtClearPendingQuote(); rtSaveState(); rtRenderReader(); }
};
document.getElementById('rtPrevBtn').addEventListener('click', function(){ window.rtPrevChapter(); });
document.getElementById('rtNextBtn').addEventListener('click', function(){ window.rtNextChapter(); });

// 这次一起读是谁约的谁
function rtByText(book, char){
  var u = (typeof userDisplayName === 'function') ? userDisplayName(char) : currentUser.name;
  return book && book.companionBy === 'char' ? ('这次一起读是你发起的：是你约' + u + '来读的') : ('这次一起读是' + u + '发起的：是' + u + '约你一起读的');
}
/* ===== AI：角色自主评论当前段落 ===== */
async function rtGenerateComments(book, chapterIdx){
  // 🔌 设置 → 自动功能开关 → 一起看/一起读 → 「一起阅读：翻页时角色自动评论」
  //    这一项以前**根本没有开关**：每翻一页就自动调一次，翻二十页就是二十次调用，
  //    而且是静悄悄花的。现在关掉之后翻页只是翻页，角色不评论。
  if(typeof isAutoOn === 'function' && !isAutoOn('readComment')) return;
  var chapter = book.chapters[chapterIdx];
  if(!chapter) return;
  var char = myCharacters.find(function(c){ return c.id==book.companionCharId; });
  if(!char) return;
  if(book.comments[chapterIdx] && book.comments[chapterIdx].length>0) return;
  var api = getApiConfig(true);
  if(!api.key) return;
  var wbText = (typeof getCharacterWorldbookText==='function') ? getCharacterWorldbookText(char) : '';
  var actionRule = allowActionTags ? '' : '\n【严格禁止】：不要有任何动作、神态或心理描写，不要用括号()或【】，只输出文字内容。';
  var textForAI = chapter.text.length > 6000 ? chapter.text.slice(0,6000) + '……（后面省略）' : chapter.text;
  var prompt = '你正在扮演角色："' + char.name + '"。\n【人设】\n' + (char.persona||'') + '\n' + (wbText ? ('【相关设定】\n' + wbText + '\n') : '') +
    '你正在和' + currentUser.name + '一起读书，书名是《' + book.title + '》（' + rtByText(book, char) + '），你们刚读到这一部分（' + (chapter.title||'') + '）：\n\n' + textForAI +
    '\n\n如果这段文字里有让你（根据你的人设和说话风格）特别有感触、想吐槽、觉得有意思或想拿出来讨论的句子，挑1-3处评论一下；如果没有特别想说的，就不用硬凑评论，返回空数组即可。' +
    '\n每条评论要包含：quote（必须是从上面原文里逐字摘抄的一句话，不超过40字，不能改写或省略中间内容）和 comment（你的评论/感想，20-60字，要符合你的人设和说话风格）。' + actionRule +
    '\n必须只返回如下JSON格式，不要加其它文字或代码块标记：{"comments":[{"quote":"...","comment":"..."}]}\n如果这段没有特别想评论的，返回{"comments":[]}。';
  rtSetLoading(true);
  try{
    var data = await callChatCompletionAPI(api, prompt, 2);
    if(data.error){ console.error('读书评论生成失败', data.error); return; }
    var raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    var parsed = (typeof extractJsonObject==='function') ? extractJsonObject(raw) : null;
    var list = (parsed && Array.isArray(parsed.comments)) ? parsed.comments : [];
    list = list.filter(function(c){ return c && c.comment; }).slice(0,3);
    book.comments[chapterIdx] = list.map(function(c){ return {quote: c.quote||'', comment: c.comment, charId: char.id, ts: Date.now()}; });
    rtSaveState();
    if(window.__rtState.currentBookId===book.id && book.currentChapterIndex===chapterIdx){ rtRenderReader(); }
  } finally { rtSetLoading(false); }
}

/* ===== 讨论区 ===== */
window.rtSendDiscuss = async function(){
  var book = rtCurrentBook(); if(!book) return;
  var char = myCharacters.find(function(c){ return c.id==book.companionCharId; });
  if(!char){ alert('请先选择一起读书的搭子角色！'); return; }
  var input = document.getElementById('rtDiscussInput');
  var text = input.value.trim();
  if(!text) return;
  var pendingQuote = window.__rtPendingQuote || '';
  var chapterIdx = book.currentChapterIndex;
  book.discussion[chapterIdx] = book.discussion[chapterIdx] || [];
  book.discussion[chapterIdx].push({role:'user', text: text, quote: pendingQuote, ts: Date.now()});
  input.value = '';
  rtClearPendingQuote();
  rtRenderDiscuss();
  rtSaveState();
  var api = getApiConfig(true);
  if(!api.key) return;
  var chapter = book.chapters[chapterIdx];
  var wbText = (typeof getCharacterWorldbookText==='function') ? getCharacterWorldbookText(char) : '';
  var actionRule = allowActionTags ? '' : '\n【严格禁止】：不要有任何动作、神态或心理描写，不要用括号()或【】，只输出文字内容。';
  var textForAI = chapter.text.length > 4000 ? chapter.text.slice(0,4000) + '……' : chapter.text;
  var histText = (book.discussion[chapterIdx] || []).slice(-10).map(function(m){
    var who = (m.role==='user' ? currentUser.name : char.name);
    var q = m.quote ? ('（针对这句："' + m.quote + '"）') : '';
    return who + q + '：' + m.text;
  }).join('\n');
  var prompt = '你正在扮演角色："' + char.name + '"。\n【人设】\n' + (char.persona||'') + '\n' + (wbText ? ('【相关设定】\n' + wbText + '\n') : '') +
    '你正在和' + currentUser.name + '一起读《' + book.title + '》（' + rtByText(book, char) + '），目前读到"' + (chapter.title||'') + '"，这部分原文内容：\n\n' + textForAI +
    '\n\n你们之间关于这段内容的讨论记录：\n' + histText +
    '\n\n请以' + char.name + '的口吻自然回应' + currentUser.name + '最后说的话，符合你的人设和说话风格，紧扣书的内容和你们的讨论，必须给出实际回应。如果对方引用了某一句原文或你自己之前的某条评论，要针对那句话来回应。' + actionRule +
    '\n只输出回复内容本身，不要加多余的前缀。';
  rtSetLoading(true);
  try{
    var data = await callChatCompletionAPI(api, prompt, 2);
    if(data.error){ alert('生成回复失败：' + data.error.message); return; }
    var reply = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
    if(reply){
      book.discussion[chapterIdx].push({role:'char', text: reply, charId: char.id, ts: Date.now()});
      rtSaveState();
      rtRenderDiscuss();
    }
  } finally { rtSetLoading(false); }
};

/* ===== 读后感 ===== */
window.rtOpenReflectionGen = async function(){
  var book = rtCurrentBook(); if(!book) return;
  var char = myCharacters.find(function(c){ return c.id==book.companionCharId; });
  if(!char){ alert('请先选择一起读书的搭子角色！'); return; }
  var api = getApiConfig(true);
  if(!api.key){ alert('请先在设置中配置API密钥！'); return; }
  var allComments = [];
  Object.keys(book.comments || {}).forEach(function(k){ (book.comments[k]||[]).forEach(function(c){ allComments.push(c.comment); }); });
  var allDiscuss = [];
  Object.keys(book.discussion || {}).forEach(function(k){ (book.discussion[k]||[]).slice(-4).forEach(function(m){ allDiscuss.push((m.role==='user'?currentUser.name:char.name) + '：' + m.text); }); });
  var wbText = (typeof getCharacterWorldbookText==='function') ? getCharacterWorldbookText(char) : '';
  var chapterTitles = book.chapters.map(function(c){ return c.title; }).join('、').slice(0,300);
  var prompt = '你正在扮演角色："' + char.name + '"。\n【人设】\n' + (char.persona||'') + '\n' + (wbText ? ('【相关设定】\n' + wbText + '\n') : '') +
    '你刚和' + currentUser.name + '一起读完了《' + book.title + '》（涉及部分：' + chapterTitles + '）。\n' +
    (allComments.length ? ('阅读过程中你对书里内容的一些感想：\n' + allComments.slice(0,20).join('\n') + '\n') : '') +
    (allDiscuss.length ? ('你们讨论过的一些内容：\n' + allDiscuss.slice(0,20).join('\n') + '\n') : '') +
    '\n请以' + char.name + '第一人称的口吻，写一篇读后感，字数300-600字，要有真情实感、贴合你的人设和说话风格，可以谈书里印象最深的部分、自己的感悟或联想，不要写成流水账。' +
    '\n必须只返回如下JSON格式，不要加其它文字或代码块标记：{"title":"读后感标题","content":"读后感正文"}';
  rtSetLoading(true);
  try{
    var data = await callChatCompletionAPI(api, prompt, 2);
    if(data.error){ alert('生成读后感失败：' + data.error.message); return; }
    var raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    var parsed = (typeof extractJsonObject==='function') ? extractJsonObject(raw) : null;
    if(!parsed || !parsed.content){ alert('生成失败，请重试'); return; }
    window.__rtPendingReflection = { title: parsed.title || ('《' + book.title + '》读后感'), content: parsed.content, bookId: book.id, bookTitle: book.title, charId: char.id };
    document.getElementById('rtReflectionTitleInput').value = window.__rtPendingReflection.title;
    document.getElementById('rtReflectionContentArea').value = window.__rtPendingReflection.content;
    if(typeof openModal==='function'){ openModal('rtReflectionModal'); }
  } finally { rtSetLoading(false); }
};
window.rtSaveReflection = function(){
  var pending = window.__rtPendingReflection; if(!pending) return;
  var char = myCharacters.find(function(c){ return c.id==pending.charId; });
  if(!char) return;
  var title = document.getElementById('rtReflectionTitleInput').value.trim() || pending.title;
  var content = document.getElementById('rtReflectionContentArea').value.trim() || pending.content;
  char.readingNotes = char.readingNotes || [];
  char.readingNotes.unshift({ id: 'rn_' + Date.now(), title: title, content: content, bookTitle: pending.bookTitle, date: Date.now() });
  saveAllData();
  var book = (window.__rtState.books || []).find(function(b){ return b.id===pending.bookId; });
  if(book){ book.finished = true; rtSaveState(); }
  window.__rtPendingReflection = null;
  if(typeof closeModal==='function'){ closeModal('rtReflectionModal'); }
  alert('读后感已保存！可以在"📝 读后感列表"里查看。');
};
window.rtOpenReflectionList = function(){
  var container = document.getElementById('rtReflectionListContent');
  var all = [];
  (myCharacters || []).forEach(function(c){ (c.readingNotes || []).forEach(function(n){ all.push({char:c, note:n}); }); });
  all.sort(function(a,b){ return b.note.date - a.note.date; });
  if(all.length===0){ container.innerHTML = '<div class="empty-state">还没有写过读后感~读完一本书后点"🏁 写读后感"试试</div>'; }
  else {
    container.innerHTML = all.map(function(x, i){
      return '<div class="wb-card" style="min-width:0;max-width:none;width:100%;margin-bottom:8px;cursor:pointer;" onclick="window.rtShowReflectionDetail(' + i + ')"><div style="font-weight:bold;font-size:14px;color:#1d9bf0;">' + escapeHtml(x.note.title) + '</div><div style="font-size:12px;color:#536471;margin-top:2px;">' + escapeHtml(x.char.name) + (x.note.bookTitle ? (' · 《' + escapeHtml(x.note.bookTitle) + '》') : '') + ' · ' + new Date(x.note.date).toLocaleDateString('zh-CN') + '</div></div>';
    }).join('');
  }
  window.__rtReflectionListCache = all;
  if(typeof openModal==='function'){ openModal('rtReflectionListModal'); }
};
window.rtShowReflectionDetail = function(i){
  var item = (window.__rtReflectionListCache || [])[i]; if(!item) return;
  document.getElementById('rtReflectionDetailTitle').innerText = item.note.title;
  document.getElementById('rtReflectionDetailMeta').innerText = item.char.name + (item.note.bookTitle ? (' · 《' + item.note.bookTitle + '》') : '') + ' · ' + new Date(item.note.date).toLocaleString('zh-CN');
  document.getElementById('rtReflectionDetailContent').innerText = item.note.content;
  if(typeof openModal==='function'){ openModal('rtReflectionDetailModal'); }
};

if(rtMetaStore){
  rtMetaStore.getItem('state').then(function(saved){
    if(saved){
      saved.books = saved.books || [];
      saved.books.forEach(function(b){ b.comments = b.comments || {}; b.discussion = b.discussion || {}; });
      window.__rtState = saved;
    }
    var ov = document.getElementById('rtOverlay');
    if(ov && ov.style.display==='flex'){ rtSyncOverlaySize(); rtRenderReader(); }
  }).catch(function(e){ console.error('读取阅读插件数据失败', e); });
}
})();

// 📖 以前一起读过的书 —— 原插件的 `code` 钩子（每次拼 prompt 时注入）。
// 内置之后改成一个普通函数，由 buildBasePrompt 调用。
// 只带最近两本、每本 80 字，并且说明"不用每次都提"，免得角色一开口就是读后感。
function getReadingNotesPrompt(char) {
    try {
        if (!char || !Array.isArray(char.readingNotes) || char.readingNotes.length === 0) return '';
        const lines = char.readingNotes.slice(0, 2).map(n =>
            '你之前和用户一起读过《' + (n.bookTitle || '一本书') + '》，写下的读后感大致是：'
            + String(n.content || '').slice(0, 80) + '……');
        return '\n【你以前一起读过的书，聊天时如果合适可以自然提起，不用每次都提】：\n' + lines.join('\n');
    } catch (e) { return ''; }
}

// 🧩 收进「设置 → 小功能」。侧栏那个入口保留——一起阅读是要反复进的，
// 埋进设置里反而难找；这里只是多给一个统一的入口。
if (typeof registerMiniFeature === 'function') {
    registerMiniFeature({
        id: 'reading_together',
        icon: '📖',
        title: '一起阅读',
        desc: '导入 txt / docx / pdf / epub，选个角色一起读，TA 会在原文旁边写评论',
        onOpen: function () { if (typeof window.rtOpenOverlay === 'function') window.rtOpenOverlay(); }
    });
}
