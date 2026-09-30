/* ============================================================
   js/41 —— 全站内容注入：app 里存着、但以前**根本没法塞进 prompt** 的那些
   ------------------------------------------------------------
   以前「注入内容管理」里能勾的，只有 buildBasePrompt 恰好写进去的那 37 段。
   可 app 里还存着一大堆东西：匿名论坛的帖子、小说、续写、这个角色自己发过的
   推文原文、你写的日记、回忆相册、专属资料库、TA 自主模式干过什么……
   这些数据一直都在，只是没有任何一条路把它们递给模型——
   所以"让推文功能也读一读匿名论坛"这种事，以前根本做不到。

   这个文件把它们全部做成可注入的段落，每一段一个开关，**默认全关**
   （它们以前一段都没进过 prompt，默认打开就等于偷偷把你的 prompt 撑大一倍）。
   打开哪条、在哪个场景打开（私聊/发推/写日记…），都在「注入内容管理」里点。

   实现方式：所有段落拼进一个 __gySiteCtxFor，挂进 GY_BOX_CTX。
   js/37 的 wrapBox 会按【标题】把它切成段、按开关逐段过滤——
   所以这里只管把内容拼出来，开关逻辑一行都不用写。
   ============================================================ */
(function () {
    'use strict';

    const S = { n: 5, chars: 400 };          // 每类取几条、每条最多多少字
    const LSK = 'gy_site_ctx_cfg';
    try { const r = localStorage.getItem(LSK); if (r) Object.assign(S, JSON.parse(r) || {}); } catch (e) {}
    window.gySiteCtxCfg = function (n, chars) {
        if (n !== undefined) S.n = gyNum(n, 5);
        if (chars !== undefined) S.chars = gyNum(chars, 400);
        try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {}
        return { n: S.n, chars: S.chars };
    };
    window.gySiteCtxRead = function () { return { n: S.n, chars: S.chars }; };

    const on = k => { try { return !window.gyInjectOn || window.gyInjectOn(k); } catch (e) { return true; } };
    const cut = t => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, S.chars);
    const nameOf = id => { try { const c = (myCharacters || []).find(x => String(x.id) === String(id)); return c ? c.name : ''; } catch (e) { return ''; } };
    const when = t => { if (!t) return ''; const d = Math.round((Date.now() - t) / 86400000);
        return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : Math.round(d / 30) + ' 个月前'; };
    // 一段：有内容才给标题，省得 prompt 里全是空壳
    const block = (title, lines, tail) => {
        const l = (lines || []).filter(Boolean);
        if (!l.length) return '';
        return `\n【${title}】\n${l.join('\n')}\n${tail ? tail + '\n' : ''}`;
    };

    /* ---------- 一条一条取 ---------- */

    // 这个角色自己发过的推文（原文。跟「推文记忆总结」是两回事：那是压缩过的，这是原话）
    function myPosts(id) {
        try {
            return block('你自己发过的推文（原话）',
                (globalPosts || []).filter(p => p.char && String(p.char.id) === String(id))
                    .slice(0, S.n).map(p => `· ${when(p.timestamp)}：${cut(p.content)}`),
                '（这些是你自己写的，不用复述；只有聊到相关的事才自然提。）');
        } catch (e) { return ''; }
    }
    // 匿名论坛
    function anon(id) {
        try {
            const mine = (anonPosts || []).filter(p => String(p.charId) === String(id) || (p.char && String(p.char.id) === String(id)));
            const other = (anonPosts || []).filter(p => !mine.includes(p)).slice(0, S.n);
            return block('匿名论坛上最近在聊什么',
                [].concat(
                    mine.slice(0, S.n).map(p => `· （这条是你自己用马甲发的）${cut(p.content)}`),
                    other.map(p => `· ${cut(p.content)}`)
                ),
                '（论坛是匿名的，你不知道每条是谁发的——除非那条标了是你自己发的。）');
        } catch (e) { return ''; }
    }
    // 小说论坛的帖子
    function forum(id) {
        try {
            if (typeof forumThreads === 'undefined') return '';
            return block('论坛上最近的帖子',
                (forumThreads || []).slice(0, S.n).map(t =>
                    `· ${cut(t.title || '')}${t.posts && t.posts[0] ? '：' + cut(t.posts[0].content) : ''}`));
        } catch (e) { return ''; }
    }
    // 我们的故事（小说章节）
    function novels(id) {
        try {
            if (typeof globalNovels === 'undefined') return '';
            const mine = (globalNovels || []).filter(n =>
                !n.charIds || !n.charIds.length || n.charIds.map(String).includes(String(id)));
            return block('你参与的那些故事（已经写下来的部分）',
                mine.slice(0, S.n).map(n => {
                    const ch = (n.chapters || []).slice(-1)[0];
                    return `· 《${cut(n.title || '无题')}》${ch ? '，最新一章：' + cut(ch.content || ch.text) : ''}`;
                }),
                '（这是已经发生过的事，你记得。）');
        } catch (e) { return ''; }
    }
    // 续写工作台
    function story(id) {
        try {
            if (typeof storySessions === 'undefined') return '';
            return block('续写里正在展开的剧情',
                (storySessions || []).slice(0, S.n).map(ss => {
                    const last = (ss.messages || ss.turns || []).slice(-1)[0];
                    const txt = last ? (last.content || last.text || '') : '';
                    return `· ${cut(ss.title || '未命名')}${txt ? '：' + cut(txt) : ''}`;
                }));
        } catch (e) { return ''; }
    }
    // 我（用户）写的日记 —— 跟「TA 自己写过的日记」是两码事
    function myDiary(id) {
        try {
            if (typeof globalUserDiaries === 'undefined') return '';
            const list = (globalUserDiaries || []).filter(d =>
                !d.charIds || !d.charIds.length || d.charIds.map(String).includes(String(id)));
            return block('对方写的日记（挂了你的那几篇）',
                list.slice(0, S.n).map(d => `· ${when(d.time || d.timestamp)}：${cut(d.content || d.text)}`),
                '（这是对方写下来的心里话，你看到了就该有反应，但别一上来就复述。）');
        } catch (e) { return ''; }
    }
    // 回忆相册
    function album(id) {
        try {
            if (typeof memoryAlbum === 'undefined') return '';
            return block('被特意收藏起来的那些瞬间',
                (memoryAlbum || []).filter(m => !m.charId || String(m.charId) === String(id))
                    .slice(0, S.n).map(m => `· ${when(m.timestamp)}：${cut(m.text)}${m.note ? '（备注：' + cut(m.note) + '）' : ''}`),
                '（这些是被专门留下来的片段，分量比普通聊天重。）');
        } catch (e) { return ''; }
    }
    // 角色专属资料库
    function bank(id) {
        try {
            if (typeof dataBank === 'undefined') return '';
            return block('你的专属资料库',
                (dataBank || []).filter(d => String(d.charId) === String(id))
                    .slice(0, S.n).map(d => `· ${cut(d.name || d.title || '')}：${cut(d.content || d.text)}`));
        } catch (e) { return ''; }
    }
    // 自主模式干过什么
    function autolog(id) {
        try {
            const c = (myCharacters || []).find(x => String(x.id) === String(id));
            const log = (c && c.autonomyLog) || [];
            return block('你自己最近做过的事（没人让你做，你自己决定的）',
                log.slice(-S.n).reverse().map(x => `· ${when(x.at || x.time)}：${cut(x.text || x.what || x.action)}`));
        } catch (e) { return ''; }
    }
    // 表情包清单
    function emo(id) {
        try {
            if (typeof globalEmoticons === 'undefined') return '';
            return block('你手里有这些表情包',
                (globalEmoticons || []).slice(0, Math.max(S.n, 10))
                    .map(e => `· ${cut(e.name || e.meaning || '')}${e.meaning && e.name ? '（' + cut(e.meaning) + '）' : ''}`),
                '（想发的时候按含义挑，不是每句都要配图。）');
        } catch (e) { return ''; }
    }
    // 群聊里最近说了什么（原话，不是话题总结）
    function groupTalk(id) {
        try {
            if (typeof globalChats === 'undefined') return '';
            const lines = [];
            Object.keys(globalChats).forEach(sid => {
                if (!/^group/i.test(sid) && sid.indexOf('group') < 0) return;
                (globalChats[sid] || []).slice(-S.n).forEach(m => {
                    const who = String(m.sender) === 'me' ? '对方' : (nameOf(m.sender) || '某人');
                    if (m.text) lines.push(`· ${who}：${cut(m.text)}`);
                });
            });
            return block('群里最近说的话（原话）', lines.slice(-S.n * 2));
        } catch (e) { return ''; }
    }

    const PARTS = [
        ['site.posts',  myPosts],
        ['site.anon',   anon],
        ['site.forum',  forum],
        ['site.novel',  novels],
        ['site.story',  story],
        ['site.udiary', myDiary],
        ['site.album',  album],
        ['site.bank',   bank],
        ['site.auto',   autolog],
        ['site.emo',    emo],
        ['site.grouptalk', groupTalk]
    ];

    // 挂进 prompt。每一段自带【标题】，js/37 会按标题切段过滤，
    // 所以这里再自己判一次 on() 只是为了**省掉白算一遍**，不是开关逻辑本身。
    window.__gySiteCtxFor = function (charId) {
        if (!charId) return '';
        let out = '';
        PARTS.forEach(([k, fn]) => {
            try { if (on(k)) out += fn(charId) || ''; } catch (e) {}
        });
        return out;
    };

    /* ============================================================
       「每类取几条 / 每条最多多少字」的界面
       ------------------------------------------------------------
       这两个数以前只能在控制台敲 gySiteCtxCfg(8, 600)，等于没有。
       现在做进「注入内容管理 → 🌍 全站内容」那一组的开头，拖着调。
       顺手带了「试算」：按你现在勾着的那几条，实际会往 prompt 里塞多少字。
       因为这两个数一动，长度是**成倍**变的（条数 × 每条字数 × 勾了几类），
       光看两个数字根本没感觉，非得有个实数摆在旁边才知道自己在干什么。
       ============================================================ */
    let probeId = '';
    function chars() { try { return myCharacters || []; } catch (e) { return []; } }
    function probeChar() {
        const list = chars();
        return list.find(c => String(c.id) === String(probeId)) || list[0] || null;
    }
    function estimate(id) {
        try {
            const t = window.__gySiteCtxFor(id) || '';
            return { chars: t.length, blocks: (t.match(/\n【/g) || []).length };
        } catch (e) { return { chars: 0, blocks: 0, bad: true }; }
    }
    function estHtml() {
        const c = probeChar();
        if (!c) return '还没有角色，建一个再来试算。';
        const e = estimate(c.id);
        if (!e.blocks) return `按 <b>${esch(c.name)}</b> 算：这一组<b>一条都没勾</b>（或者那些数据本来是空的），现在往 prompt 里塞 <b>0</b> 字。`;
        const warn = e.chars > 6000 ? '　⚠️ 这已经很长了，模型可能顾不上前面的正事'
                   : e.chars > 3000 ? '　⚠️ 有点长了' : '';
        return `按 <b>${esch(c.name)}</b> 算：现在勾着 <b>${e.blocks}</b> 类，`
             + `往 prompt 里塞 <b style="color:${e.chars > 6000 ? '#f4212e' : e.chars > 3000 ? '#ffad1f' : '#00ba7c'}">${e.chars}</b> 字`
             + `<span style="color:#8b98a5">${warn}</span>`;
    }
    function esch(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

    // 「按功能看」那个视图里可以同时展开好几个功能，这块设置就会同时出现好几份。
    // 所以这里一律用 class 找、一次全更新，不用 id——不然是重复 id，只有第一份会动。
    const each = (sel, fn) => { try { document.querySelectorAll(sel).forEach(fn); } catch (e) {} };
    function refreshEst() {
        const h = estHtml();
        each('.gysitecfg-est', el => { el.innerHTML = h; });
    }
    function syncLabels() {
        each('.gysitecfg-nl', el => { el.textContent = S.n + ' 条'; });
        each('.gysitecfg-cl', el => { el.textContent = S.chars + ' 字'; });
        refreshEst();
    }
    window.gySiteCtxProbe = function (id) {
        probeId = id || '';
        each('.gysitecfg-sel', el => { if (el.value !== String(probeId)) el.value = String(probeId); });
        refreshEst();
    };
    // 拖动的时候只改旁边的数字和试算，**不重画整页**——
    // 整页重画会把展开的分组收回去、还会把页面弹回顶上，拖都拖不动
    window.gySiteCtxSet = function (field, v) {
        if (field === 'n') window.gySiteCtxCfg(v, undefined);
        else window.gySiteCtxCfg(undefined, v);
        each(field === 'n' ? '.gysitecfg-rn' : '.gysitecfg-rc', el => { if (el.value !== String(field === 'n' ? S.n : S.chars)) el.value = String(field === 'n' ? S.n : S.chars); });
        syncLabels();
    };
    window.gySiteCtxReset = function () {
        window.gySiteCtxCfg(5, 400);
        each('.gysitecfg-rn', el => { el.value = String(S.n); });
        each('.gysitecfg-rc', el => { el.value = String(S.chars); });
        syncLabels();
    };
    // js/37 在「全站内容」这一组的说明底下调这个（g.ctrl）
    window.gySiteCtxCfgUI = function () {
        const list = chars();
        const cur = probeChar();
        return `<div class="gysitecfg">
          <div class="gysitecfg-hd">🎚️ 这一组取多少</div>
          <div class="gysitecfg-r">
            <span class="gysitecfg-k">每类取几条</span>
            <!-- 以前是 1~30 的滑块，封了顶；改成数字框，填多少取多少 -->
            <input class="gysitecfg-rn" type="number" min="1" step="1" value="${S.n}" style="width:90px;"
                   onchange="gySiteCtxSet('n', this.value)">
            <b class="gysitecfg-nl">${S.n} 条</b>
          </div>
          <div class="gysitecfg-r">
            <span class="gysitecfg-k">每条最多</span>
            <input class="gysitecfg-rc" type="number" min="1" step="20" value="${S.chars}" style="width:90px;"
                   onchange="gySiteCtxSet('chars', this.value)">
            <b class="gysitecfg-cl">${S.chars} 字</b>
          </div>
          <div class="gysitecfg-e gysitecfg-est">${estHtml()}</div>
          <div class="gysitecfg-f">
            ${list.length > 1 ? `按谁试算：<select class="gysitecfg-sel" onchange="gySiteCtxProbe(this.value)">
              ${list.map(c => `<option value="${esch(c.id)}"${cur && String(cur.id) === String(c.id) ? ' selected' : ''}>${esch(c.name)}</option>`).join('')}
            </select>　` : ''}
            <span class="gysitecfg-rs" onclick="gySiteCtxReset()">↺ 恢复默认（5 条 / 400 字）</span>
          </div>
          <div class="gysitecfg-n">这两个数对<b>这一组的每一条</b>都生效，不分场景。
            想让发推文读得多、私聊读得少，做不到——那得靠上面勾/不勾来分。
            （表情包清单至少给 10 条，群聊原话给两倍，因为这两样太少了没用。）</div>
        </div>`;
    };
    // 样式跟着这块走，省得改 js/37 的 CSS
    (function css() {
        if (document.getElementById('gySiteCtxCss')) return;
        const s = document.createElement('style');
        s.id = 'gySiteCtxCss';
        s.textContent = `
        .gysitecfg{border:1px solid var(--gy-border,#cfd9de);border-radius:12px;padding:10px 12px;margin:6px 0 12px;
          background:rgba(29,155,240,.04);}
        .gysitecfg-hd{font-size:13px;font-weight:700;margin-bottom:8px;}
        .gysitecfg-r{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px;}
        .gysitecfg-k{color:#8b98a5;min-width:72px;flex:none;}
        .gysitecfg-r input[type=range]{flex:1;min-width:90px;accent-color:#1d9bf0;}
        .gysitecfg-r b{min-width:52px;text-align:right;flex:none;font-size:12px;color:#1d9bf0;}
        .gysitecfg-e{font-size:12px;line-height:1.7;margin:8px 0 4px;padding:6px 8px;border-radius:8px;
          background:rgba(128,128,128,.08);}
        .gysitecfg-f{font-size:12px;color:#8b98a5;margin:6px 0 2px;display:flex;align-items:center;flex-wrap:wrap;gap:4px;}
        .gysitecfg-f select{font-size:12px;padding:2px 4px;border-radius:6px;border:1px solid var(--gy-border,#cfd9de);
          background:transparent;color:inherit;}
        .gysitecfg-rs{cursor:pointer;color:#1d9bf0;}
        .gysitecfg-rs:hover{text-decoration:underline;}
        .gysitecfg-n{font-size:11px;color:#8b98a5;line-height:1.7;}`;
        document.head.appendChild(s);
    })();

    function hook() {
        try {
            if (typeof GY_BOX_CTX !== 'undefined' && Array.isArray(GY_BOX_CTX)
                && !GY_BOX_CTX.some(x => x[0] === '__gySiteCtxFor'))
                GY_BOX_CTX.push(['__gySiteCtxFor', '全站内容']);
        } catch (e) {}
    }
    hook();
    setTimeout(hook, 1200);
    setTimeout(hook, 3000);
})();
