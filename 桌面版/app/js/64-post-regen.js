/* ===========================================================================
   js/64 —— 🔄 让 TA 把这条推文重新写一遍
   ---------------------------------------------------------------------------
   喜欢角色发的这条的意思，但想让 TA 换个写法：推文右上角 ⋮ 里多一行「🔄 让 TA 重新写」。
   · 同一个时间点、同一件事，TA 按自己的人设再写一次；状态栏 / 卡片格式照常（跟发推同一套正则）
   · 原来那一版留着：⋮ 里会多一行「↩ 换回上一版」，每一版都留着
   · 评论、点赞、图片、引用都不动，只换正文
   只收在 ⋮ 菜单里，不在推文上多放按钮。
   =========================================================================== */
(function () {
    'use strict';
    if (window.__gyPostRegenLoaded) return;
    window.__gyPostRegenLoaded = true;

    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    const findPost = id => (typeof globalPosts !== 'undefined' ? globalPosts : []).find(p => String(p.id) === String(id));
    const charOf = id => (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => String(c.id) === String(id));
    const busy = new Set();

    function hook() {
        const orig = window.gyPostMenu;
        if (typeof orig !== 'function' || orig.__gyRegen) return false;
        const w = function (e, postId) {
            const r = orig.apply(this, arguments);
            try {
                const post = findPost(postId);
                const menu = document.getElementById('chatContextMenu');
                if (!post || !menu || !post.char || String(post.char.id) === 'me' || String(postId).startsWith('tb_') || !charOf(post.char.id)) return r;
                const rows = [`<button class="context-btn" onclick="gyPostRegen('${postId}')">${busy.has(String(postId)) ? '⏳ TA 正在重新写…' : '🔄 让 TA 重新写'}</button>`];
                if (post.prevTexts && post.prevTexts.length) rows.push(`<button class="context-btn" onclick="gyPostRegenUndo('${postId}')">↩ 换回上一版</button>`);
                // 放在「删除」上面
                const del = [...menu.querySelectorAll('.context-btn')].find(b => /删除/.test(b.textContent));
                if (del) del.insertAdjacentHTML('beforebegin', rows.join('')); else menu.insertAdjacentHTML('beforeend', rows.join(''));
                const top = parseFloat(menu.style.top) || 0, h = menu.getBoundingClientRect().height;
                if (top + h > window.innerHeight - 8) menu.style.top = Math.max(8, window.innerHeight - h - 8) + 'px';
            } catch (er) {}
            return r;
        };
        w.__gyRegen = true;
        window.gyPostMenu = w;
        return true;
    }

    function closeMenu() { const m = document.getElementById('chatContextMenu'); if (m) m.style.display = 'none'; }
    function refresh(postId) {
        try {
            const vis = id => { const v = document.getElementById(id); return v && v.style.display !== 'none'; };
            if (vis('view-home') && typeof renderPosts === 'function') renderPosts();
            if (vis('view-profile') && typeof renderProfileFeed === 'function') renderProfileFeed();
            const det = document.getElementById('postDetailSection');
            if (det && det.offsetParent !== null && typeof switchMainView === 'function') switchMainView('postDetail', postId);
        } catch (e) {}
    }

    window.gyPostRegen = async function (postId) {
        closeMenu();
        const post = findPost(postId); if (!post) return;
        const char = charOf(post.char && post.char.id);
        if (!char) { toast('找不到这个角色了'); return; }
        if (busy.has(String(postId))) { toast('还在写呢', '等一下就好'); return; }
        if (typeof myApiKey !== 'undefined' && !myApiKey) { toast('还没配 API Key', '去 设置 → API 与模型'); return; }
        busy.add(String(postId));
        toast(`🔄 ${char.name} 在重新写这条…`, '写好了会直接换上，原来那版还能换回来');
        try {
            const limit = (typeof postWordLimit !== 'undefined' && postWordLimit) || 50;
            const chatPart = typeof getRecentChatContext === 'function' ? `\n【最近对话上下文】：\n${getRecentChatContext(char.id)}` : '';
            let old = String(post.text || '');
            try { if (typeof gyExtractChatStatus === 'function') old = gyExtractChatStatus(old, char.id).rest || old; } catch (e) {}
            old = old.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
            const tag = (String(post.text || '').match(/(^|\s)(#[^\s#]{1,20})\s*$/) || [])[2] || '';
            const base = typeof buildBasePrompt === 'function' ? buildBasePrompt(char, true, chatPart) : `你是${char.name}。${char.persona || ''}`;
            const p = `${base}${chatPart}
你刚才发过这样一条推文：
「${old.slice(0, 600)}」
现在请把这条推文**重新写一遍**：同一个时间、同一件事、同样的心情，但换一种说法——措辞、角度、细节都可以换，读起来要像你本人另一次发的，不要照抄原句，也不要写成解释或道歉。不超过${limit}字。${typeof WORD_LIMIT_PRIORITY_NOTE !== 'undefined' ? WORD_LIMIT_PRIORITY_NOTE : ''}
如果你的世界观设定/正则脚本要求每次输出固定附带某种格式标签或HTML（比如状态栏），照常写进text里（换行用\\n转义）。
${typeof getFinalAnswerMarkerPromptNote === 'function' ? getFinalAnswerMarkerPromptNote() : ''}
【强制要求】只返回 JSON：{"text":"重新写好的推文正文（不含#标签）"}`;
            const data = await sendChatRequest({ url: myApiUrl, key: myApiKey, model: myModel }, p);
            if (data && data.error) throw new Error(data.error.message || String(data.error));
            const raw = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
            let parsed = typeof extractJsonObject === 'function' ? extractJsonObject(raw) : null;
            let text = parsed && parsed.text ? String(parsed.text) : (raw && raw[0] !== '{' ? raw : '');
            text = text.replace(/^["“]|["”]$/g, '').trim();
            if (!text) throw new Error('TA 这次没写出东西来');
            if (typeof applyRegexScripts === 'function') text = applyRegexScripts(text, 'ai_output', char.id);
            if (tag && !text.includes(tag)) text += '\n' + tag;
            post.prevTexts = (post.prevTexts || []).concat([post.text]);
            post.text = text;
            post.rewrittenAt = Date.now();
            if (typeof saveAllData === 'function') saveAllData();
            refresh(postId);
            toast(`✨ ${char.name} 重新写好了`, '不喜欢的话 ⋮ 里可以「换回上一版」');
        } catch (e) {
            toast('没写成', String(e && e.message || e).slice(0, 80));
        } finally { busy.delete(String(postId)); }
    };
    window.gyPostRegenUndo = function (postId) {
        closeMenu();
        const post = findPost(postId); if (!post || !post.prevTexts || !post.prevTexts.length) return;
        post.text = post.prevTexts.pop();
        if (typeof saveAllData === 'function') saveAllData();
        refresh(postId);
        toast('↩ 换回上一版了');
    };

    if (!hook()) { let n = 0; const iv = setInterval(() => { if (hook() || ++n > 40) clearInterval(iv); }, 250); }
})();
