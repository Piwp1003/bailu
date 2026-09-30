/* ============================================================
   js/45 —— 聊天顶栏：返回键 + 对方昵称
   ------------------------------------------------------------
   开关：设置 → 外观 →「💬 聊天页顶上显示对方昵称和返回键」，**默认开**。

   起因：v132 把聊天页顶上那一行（← 联系人列表 / ▦ 头像条 / ＋）藏了之后，
   手机上还有系统顶栏的返回键，**电脑端就彻底没有返回的地方了**。
   现在补一条自己的顶栏：左边一个返回，中间就是对方昵称（群聊显示几个人）。
   **不放头像**——聊天里每条消息旁边已经有一堆脸了，顶栏再来一个太挤。

   排法参考微信（返回在最左、名字居中），但**颜色和圆角全走项目自己的主题变量**，
   所以蓝白/黑白/深色下都跟着你的配色走，不是硬塞一块微信绿进来。

   「返回」在两种列表模式下各自都有意义：
     · 竖排列表模式：回到联系人列表（等于原来那颗「← 联系人列表」）
     · 头像条模式：退回"还没选人"那个状态（上方头像条还在，随时点谁都行）
   ⚠️ 不能用 switchChatSession(null) 来"退出会话"——它上来就 id.toString()，null 会炸。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_chat_head_cfg';
    const S = { on: true };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const ID = 'gyChatHead';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function sessionOf(id) {
        if (id == null) return null;
        const sid = String(id);
        try {
            const g = (typeof groupChats !== 'undefined' ? groupChats : []).find(x => String(x.id) === sid);
            if (g) return { raw: g, isGroup: true };
            const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === sid);
            if (c) return { raw: c, isGroup: false };
        } catch (e) {}
        return null;
    }

    function ensure() {
        const host = document.getElementById('view-chat');
        if (!host) return null;
        let bar = document.getElementById(ID);
        if (!bar) {
            bar = document.createElement('div');
            bar.id = ID; bar.className = 'gych-bar'; bar.style.display = 'none';
            bar.innerHTML =
                '<button type="button" class="gych-back" title="返回">' +
                    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
                    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' +
                '</button>' +
                // 顶栏只写名字，**不放头像**——聊天里每条消息旁边已经有一堆脸了
                '<div class="gych-mid">' +
                '<span class="gych-name"></span><span class="gych-sub"></span></div>';
            // 插在**消息区正上方**（联系人条下面）：这样它读起来就是"这一段对话的头"，
            // 而不是整页的头。它是 #view-chat 的直接子节点，不会跟着消息区一起滚走。
            const anchor = document.getElementById('chatTypingIndicator')
                || document.getElementById('chatMessagesArea') || host.firstChild;
            host.insertBefore(bar, anchor);
            bar.querySelector('.gych-back').onclick = () => window.gyChatBack();
            bar.querySelector('.gych-mid').onclick = () => {
                const s = sessionOf(typeof currentChatSessionId !== 'undefined' ? currentChatSessionId : null);
                if (!s) return;
                try {
                    // 群聊没有资料页，退一步开它的「聊天选项」
                    if (s.isGroup) { if (typeof openChatOptions === 'function') openChatOptions(s.raw.id); }
                    else if (typeof switchMainView === 'function') switchMainView('profile', s.raw.id);
                } catch (e) {}
            };
        }
        return bar;
    }

    function sync() {
        const bar = ensure(); if (!bar) return;
        const sid = (typeof currentChatSessionId !== 'undefined') ? currentChatSessionId : null;
        const s = sessionOf(sid);
        const inChat = !!s && document.getElementById('view-chat') &&
            getComputedStyle(document.getElementById('chatMessagesArea') || bar).display !== 'none';
        if (!S.on || !inChat) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        bar.querySelector('.gych-name').innerHTML = esc(s.raw.name || '');
        bar.querySelector('.gych-sub').innerHTML = s.isGroup
            ? esc('(' + ((s.raw.members || []).length) + ')') : '';
    }
    window.gyChatHeadSync = sync;

    // 返回：两种列表模式各自的"上一步"
    window.gyChatBack = function () {
        try {
            if (typeof chatListViewMode !== 'undefined' && chatListViewMode !== 'row') {
                if (typeof backToContactList === 'function') { backToContactList(); sync(); return; }
            }
            // 头像条模式：退回"还没选人"
            currentChatSessionId = null;
            const ia = document.getElementById('chatInputArea'); if (ia) ia.style.display = 'none';
            const ma = document.getElementById('chatMessagesArea');
            if (ma) ma.innerHTML = '<div class="empty-state">请在上方选择一个角色或群聊开始聊天。</div>';
            if (typeof renderChatCharList === 'function') renderChatCharList();
        } catch (e) { console.error('[聊天顶栏] 返回时出错', e); }
        sync();
    };

    // 切人、切列表模式、进出聊天页，都跟着刷新
    ['switchChatSession', 'renderChatCharList', 'backToContactList', 'toggleChatListViewMode'].forEach(fn => {
        const f0 = window[fn];
        if (!f0 || !f0.call || f0.__gyChatHead) return;
        window[fn] = function () { const r = f0.apply(this, arguments); try { setTimeout(sync, 0); } catch (e) {} return r; };
        window[fn].__gyChatHead = true;
    });
    const sw0 = window.switchMainView;
    if (sw0 && sw0.call && !sw0.__gyChatHead) {
        window.switchMainView = function (v) { const r = sw0.apply(this, arguments); if (v === 'chat') setTimeout(sync, 0); return r; };
        window.switchMainView.__gyChatHead = true;
    }

    window.gyChatHeadSet = function (on) {
        S.on = !!on; saveCfg();
        if (!S.on) { const b = document.getElementById(ID); if (b) b.style.display = 'none'; }
        else sync();
    };
    window.gyChatHeadRead = () => ({ on: S.on });
    function fillUI() { try { const el = document.getElementById('gyChatHeadOn'); if (el) el.checked = !!S.on; } catch (e) {} }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyChatHead) {
        window.openSettingsPanel = function (k) { const r = op0.apply(this, arguments); if (k === 'appearance') setTimeout(fillUI, 60); return r; };
        window.openSettingsPanel.__gyChatHead = true;
    }

    /* ---------- 样式：全走项目自己的主题变量 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gyChatHeadCss';
        st.textContent = `
#${ID}.gych-bar {
    display: none; align-items: center; position: relative;
    padding: 8px 12px; gap: 8px; flex-shrink: 0;
    border-bottom: 1px solid var(--gy-line, #eff3f4);
    background: transparent;
}
#${ID} .gych-back {
    position: absolute; left: 6px; top: 50%; transform: translateY(-50%);
    width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
    border: 0; background: none; cursor: pointer; border-radius: 50%;
    color: inherit; padding: 0;
}
#${ID} .gych-back:hover { background: rgba(var(--gy-accent-rgb, 29,155,240), .12); }
#${ID} .gych-mid {
    flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center;
    gap: 7px; cursor: pointer; padding: 0 40px;
}
#${ID} .gych-name {
    font-weight: 700; font-size: 16px; color: inherit;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60vw;
}
#${ID} .gych-sub { opacity: .6; font-size: 14px; flex: 0 0 auto; }
`;
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { ensure(); fillUI(); sync(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1000);
    else window.addEventListener('load', () => setTimeout(boot, 1000));

    console.info('[聊天顶栏] 已加载。开关：设置 → 外观 →「💬 聊天页顶上显示对方昵称和返回键」（默认开）');
})();
