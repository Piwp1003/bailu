/* ============================================================
   js/46 —— 右边那块「今天」
   ------------------------------------------------------------
   开关：设置 → 外观 →「📅 右边放一块「今天」」，**默认关**——
   不开就一个节点都不建，右侧栏还是项目原来的样子。

   起因：微信皮肤把正文收成固定一栏之后，宽屏上右边空出来一大片。
   这块面板把**项目里本来就有、但散在各处的东西**汇到一页：
     · 今天几号、星期几
     · 今天和明天的日程（js/38「我的日程」里记的）
     · 最近要到的纪念日/生日（你自己记的 + 每个角色的，按"每年同月同日"算）
     · 谁有未读消息（点一下直接进那个聊天）
     · TA 们刚发的几条（点一下进帖子详情）
   全是读现成数据，不生成、不请求接口、不写任何存档。

   放哪儿：挂在**原来的右侧栏里**（.sidebar-right-content 的最前面）。
   所以不贴皮肤时它就是右侧栏顶上多一张卡；贴了微信皮肤，皮肤会认
   body 上的 gytoday-on，把那条被收掉的右栏重新放出来专门装它。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_today_cfg';
    const S = { on: false };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const saveCfg = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const ID = 'gyToday';
    const OPEN = new Set();          // 哪几张节奏卡是展开的（重画时保持）
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const arr = x => Array.isArray(x) ? x : [];
    const pad = n => (n < 10 ? '0' : '') + n;
    const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    /* ---------- 今天的日程 ---------- */
    function days() {
        let items = [];
        try { if (typeof gyMyDayAll === 'function') items = arr(gyMyDayAll()); } catch (e) {}
        const today = keyOf(new Date());
        const tm = new Date(); tm.setDate(tm.getDate() + 1);
        const tomorrow = keyOf(tm);
        const pick = k => items.filter(x => x && x.date === k)
            .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
        return { today: pick(today), tomorrow: pick(tomorrow) };
    }

    /* ---------- 最近的纪念日（含生日），按"每年同月同日" ---------- */
    function annivs() {
        const out = [];
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const push = (dateStr, label, who) => {
            if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return;
            const [y, m, d] = String(dateStr).split('-').map(Number);
            let next = new Date(now.getFullYear(), m - 1, d);
            if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
            const left = Math.round((next - now) / 86400000);
            if (left > 366) return;
            out.push({ left, label, who, years: next.getFullYear() - y });
        };
        try {
            arr(currentUser && currentUser.customAnniversaries).forEach(a => push(a.date, a.label, ''));
            if (currentUser && currentUser.birthdate) push(currentUser.birthdate, '生日', '我');
            arr(typeof myCharacters !== 'undefined' ? myCharacters : []).forEach(c => {
                arr(c.anniversaries).forEach(a => push(a.date, a.event || a.label || '纪念日', c.name));
                if (c.birthdate) push(c.birthdate, '生日', c.name);
            });
        } catch (e) {}
        return out.sort((a, b) => a.left - b.left).slice(0, 4);
    }

    /* ---------- 谁有未读 ---------- */
    function unread() {
        const out = [];
        try {
            if (typeof chatHasUnread !== 'function') return out;
            const all = [...arr(typeof groupChats !== 'undefined' ? groupChats : []),
                         ...arr(typeof myCharacters !== 'undefined' ? myCharacters : [])];
            all.forEach(x => { if (x && chatHasUnread(x.id)) out.push({ id: x.id, name: x.name }); });
        } catch (e) {}
        return out.slice(0, 6);
    }

    /* ---------- TA 们刚发的 ---------- */
    function fresh() {
        try {
            return arr(typeof globalPosts !== 'undefined' ? globalPosts : [])
                .slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 3)
                .map(p => {
                    // 预览只要正文：状态栏（<xxx_status>…）、<br>、标签都去掉
                    let t = String(p.text || '');
                    try { if (typeof gyExtractChatStatus === 'function') t = gyExtractChatStatus(t, p.char && p.char.id).rest || t; } catch (e) {}
                    t = t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
                    return { id: p.id, name: (p.char && p.char.name) || '', text: t.slice(0, 38), at: p.timestamp };
                });
        } catch (e) { return []; }
    }
    const ago = t => {
        if (!t) return '';
        const m = Math.round((Date.now() - t) / 60000);
        if (m < 1) return '刚刚';
        if (m < 60) return m + ' 分钟前';
        if (m < 1440) return Math.round(m / 60) + ' 小时前';
        return Math.round(m / 1440) + ' 天前';
    };

    /* ---------- ⏳ 时间管理大师（原「TA 们的节奏」）：总开关「角色自己决定要做什么」开着时，每个自主角色一张卡 ---------- */
    const until = t => {
        const m = Math.round((t - Date.now()) / 60000);
        if (m <= 0) return '随时';
        if (m < 60) return m + ' 分钟后';
        if (m < 1440) return (m / 60).toFixed(m < 600 ? 1 : 0).replace(/\.0$/, '') + ' 小时后';
        return (m / 1440).toFixed(1).replace(/\.0$/, '') + ' 天后';
    };
    function rhythm() {
        try {
            const autoOn = typeof isAutoOn !== 'function' || isAutoOn('charAutonomy');
            const diceOn = typeof isAutoOn === 'function' && isAutoOn('lifeDice') && typeof window.gyLifeTodayHtml === 'function';
            return arr(typeof myCharacters !== 'undefined' ? myCharacters : []).map(c => {
                const rows = (autoOn && typeof window.gyTaRhythm === 'function') ? window.gyTaRhythm(c) : null;
                if (rows) return { c, rows };
                // 默认模式的角色：没有时间卡，只有「随机事件」那一块（挡位你来调）
                if (diceOn) return { c, rows: [], fixed: true };
                return null;
            }).filter(Boolean);
        } catch (e) { return []; }
    }

    /* ---------- ⏳ 点开一张时间卡 ---------- */
    const hm = t => { const d = new Date(t); const today = keyOf(new Date()) === keyOf(d);
        const tm = new Date(); tm.setDate(tm.getDate() + 1);
        return (today ? '今天 ' : keyOf(tm) === keyOf(d) ? '明天 ' : (d.getMonth() + 1) + '月' + d.getDate() + '日 ') + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    let MOPEN = null;
    function closeTile() { const m = document.getElementById('gyTileModal'); if (m) { m.classList.remove('show'); setTimeout(() => m.remove(), 180); } MOPEN = null; }
    function tileHtml(c, r) {
        const ava = c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : `<span>${esc(String(c.name || '?').slice(0, 1))}</span>`;
        let meta = '';
        if (r.at) meta += `<div class="gtm-row"><span>什么时候定的</span><b>${esc(ago(r.at))}</b></div>`;
        if (r.last) meta += `<div class="gtm-row"><span>上一次</span><b>${esc(hm(r.last))}</b></div>`;
        if (r.next) meta += `<div class="gtm-row"><span>下一次大概</span><b>${esc(hm(r.next))}<em>${r.next > Date.now() ? '（' + esc(until(r.next)) + '）' : '（随时）'}</em></b></div>`;
        const pct = (r.next && r.ms) ? Math.max(0, Math.min(100, Math.round((Date.now() - r.last) / r.ms * 100))) : -1;
        return `<div class="gtm-card" role="dialog">
            <div class="gtm-head">
              <div class="gtm-ico">${r.icon}</div>
              <div class="gtm-ttl"><small>${esc(c.name)} 的时间表</small><b>${esc(r.label)}</b></div>
              <button type="button" class="gtm-x" data-gtm="close" aria-label="关闭">×</button>
            </div>
            <div class="gtm-val${r.text ? '' : ' dim'}">${r.busy ? '正在想…' : r.text ? esc(r.text) : (r.act ? '想做就做' : '还没定')}</div>
            ${pct >= 0 ? `<div class="gtm-bar"><s style="width:${pct}%"></s></div><div class="gtm-barl">${pct >= 100 ? '到点了，就等 TA 想起来' : '离下一次过去了 ' + pct + '%'}</div>` : ''}
            ${r.why ? `<div class="gtm-quote"><div class="gtm-ava">${ava}</div><p>“${esc(r.why)}”</p></div>`
                    : `<div class="gtm-quote empty"><p>${r.text ? 'TA 没说为什么。' : 'TA 还没想过这件事。点下面的按钮问问 TA。'}</p></div>`}
            ${meta ? `<div class="gtm-meta">${meta}</div>` : ''}
            <div class="gtm-desc">${esc(r.desc)}${r.act ? '<br>卡上的数只是 TA 上次随口说的"大概"，不是闹钟：想做随时做，一件接一件也行，马上做还是等有空再做都由 TA 定。TA 真做了这件事，才会顺便说下一次大概隔多久，不会定时重问。' : ''}</div>
            <div class="gtm-btns">
              <button type="button" data-gtm="ask">${r.text ? '🎲 让 TA 重新想想' : '🎲 让 TA 定'}</button>
              <button type="button" data-gtm="close" class="ghost">好</button>
            </div>
          </div>`;
    }
    function openTile(cid, gk) {
        const c = arr(typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === String(cid));
        if (!c || typeof window.gyTaRhythm !== 'function') return;
        const r = (window.gyTaRhythm(c) || []).find(x => x.gk === gk); if (!r) return;
        MOPEN = { cid, gk };
        let m = document.getElementById('gyTileModal');
        if (!m) {
            m = document.createElement('div'); m.id = 'gyTileModal';
            m.addEventListener('click', async ev => {
                const b = ev.target.closest('[data-gtm]');
                if (ev.target === m || (b && b.dataset.gtm === 'close')) { closeTile(); return; }
                if (b && b.dataset.gtm === 'ask' && MOPEN && typeof window.gyTaAskOne === 'function') {
                    b.disabled = true; b.textContent = 'TA 在想…';
                    const v = m.querySelector('.gtm-val'); if (v) { v.textContent = '正在想…'; v.classList.add('thinking'); }
                    const cur = MOPEN;
                    await window.gyTaAskOne(cur.cid, cur.gk);
                    if (MOPEN && MOPEN.cid === cur.cid && MOPEN.gk === cur.gk) openTile(cur.cid, cur.gk);
                }
            });
            document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && MOPEN) closeTile(); });
            document.body.appendChild(m);
            requestAnimationFrame(() => m.classList.add('show'));
        }
        m.innerHTML = tileHtml(c, r);
    }

    /* ---------- 画 ---------- */
    const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    function html() {
        const d = new Date();
        const dd = days(), an = annivs(), un = unread(), fr = fresh(), rh = rhythm();
        let h = `<div class="gyt-head">
              <div class="gyt-day">${d.getDate()}</div>
              <div class="gyt-md"><b>${d.getFullYear()} 年 ${d.getMonth() + 1} 月</b><span>${WD[d.getDay()]}</span></div>
            </div>`;

        if (dd.today.length || dd.tomorrow.length) {
            h += `<div class="gyt-sec"><h4>🗓️ 日程</h4>`;
            dd.today.forEach(it => h += `<div class="gyt-row"><span class="gyt-t">${esc(it.time || '今天')}</span>
                <span class="gyt-x">${esc(it.text)}${it.place ? `<em>在${esc(it.place)}</em>` : ''}</span></div>`);
            dd.tomorrow.forEach(it => h += `<div class="gyt-row dim"><span class="gyt-t">明天${it.time ? ' ' + esc(it.time) : ''}</span>
                <span class="gyt-x">${esc(it.text)}</span></div>`);
            h += `</div>`;
        }

        if (an.length) {
            h += `<div class="gyt-sec"><h4>💗 快到的日子</h4>`;
            an.forEach(a => h += `<div class="gyt-row"><span class="gyt-t">${a.left === 0 ? '就是今天' : '还有 ' + a.left + ' 天'}</span>
                <span class="gyt-x">${a.who ? esc(a.who) + '的' : ''}${esc(a.label)}${a.years > 0 && a.left === 0 ? `<em>第 ${a.years} 年</em>` : ''}</span></div>`);
            h += `</div>`;
        }

        if (un.length) {
            h += `<div class="gyt-sec"><h4>💬 有人在等你回</h4>`;
            un.forEach(x => h += `<div class="gyt-row click" data-chat="${esc(x.id)}">
                <span class="gyt-dot"></span><span class="gyt-x">${esc(x.name)}</span></div>`);
            h += `</div>`;
        }

        if (rh.length) {
            h += `<details class="gyt-sec gyt-rhall"${S.rhOpen ? ' open' : ''}><summary><h4>⏳ 时间管理大师<span>${rh.length} 位</span></h4></summary>`;
            rh.forEach(({ c, rows, fixed }) => {
                const open = OPEN.has(String(c.id));
                if (fixed) {
                    h += `<details class="gyt-rh" data-rh="${esc(c.id)}"${open ? ' open' : ''}>
                      <summary><b>${esc(c.name)}</b><span>默认模式</span></summary>
                      ${window.gyLifeTodayHtml(c)}
                    </details>`;
                    return;
                }
                const miss = rows.filter(r => !r.text).length;
                h += `<details class="gyt-rh" data-rh="${esc(c.id)}"${open ? ' open' : ''}>
                  <summary><b>${esc(c.name)}</b><span>${c.nextAutonomyAt ? '下次停下来想想：' + esc(until(c.nextAutonomyAt)) : '还没排下一次'}</span></summary>
                  ${(() => { const q = (typeof window.gyAutoQueueOf === 'function') ? window.gyAutoQueueOf(c) : [];
                      return q.length ? `<div class="gyt-rh-gt">📌 打算等会儿做</div><div class="gyt-rh-q">${q.map(x => `<div><span>${esc(until(x.at))}</span><b>${esc(x.label)}</b>${x.reason ? `<em>${esc(x.reason)}</em>` : ''}</div>`).join('')}</div>` : ''; })()}
                  ${(typeof window.gyLifeTodayHtml === 'function') ? window.gyLifeTodayHtml(c) : ''}
                  ${[['⏰ 到点就做 · 习惯', rows.filter(r => !r.act)],
                     ['💌 冲着你的 · 想做就做，做完再定下一次', rows.filter(r => r.act && r.cat === 'you')],
                     ['👥 跟别人的', rows.filter(r => r.act && r.cat === 'others')],
                     ['🙋 自己的日子', rows.filter(r => r.act && r.cat !== 'you' && r.cat !== 'others')]].filter(g => g[1].length).map(([gt, rs]) => `
                  <div class="gyt-rh-gt">${gt}</div>
                  <div class="gyt-rh-grid">${rs.map(r => {
                      const pct = (r.next && r.ms) ? Math.max(0, Math.min(100, Math.round((Date.now() - r.last) / r.ms * 100))) : -1;
                      return `<div class="gyt-rh-i${r.text ? '' : ' dim'}" data-rhi="${esc(c.id)}|${esc(r.gk)}" role="button" tabindex="0">
                        <div class="gyt-rh-top"><i>${r.icon}</i><span>${esc(r.label)}</span></div>
                        <b>${r.busy ? '正在想…' : r.text ? esc(r.text) : (r.act ? '想做就做' : '还没定')}</b>
                        ${r.why ? `<em>${esc(r.why)}</em>` : (r.text ? '' : (r.act ? '<em>做过一次才会定下一次</em>' : '<em>点开让 TA 定</em>'))}
                        ${pct >= 0 ? `<div class="gyt-rh-bar"><s style="width:${pct}%"></s></div>` : ''}
                      </div>`; }).join('')}</div>`).join('')}
                  <div class="gyt-rh-foot"><button type="button" data-ta-ask="${esc(c.id)}">${miss ? `🎲 让 TA 把剩下 ${miss} 件定了` : '🎲 让 TA 全部重新想想'}</button><label style="font-size:12px;margin-left:8px"><input type="checkbox" ${localStorage.getItem('gyTaDailyAsk') !== '0' ? 'checked' : ''} onchange="gyTaDailyAskSet&&gyTaDailyAskSet(this.checked)"> 每天自己重新想一遍</label></div>
                </details>`;
            });
            h += `</details>`;
        }

        if (fr.length) {
            h += `<div class="gyt-sec"><h4>📝 TA 们刚发的</h4>`;
            fr.forEach(p => h += `<div class="gyt-row click col" data-post="${esc(p.id)}">
                <span class="gyt-x"><b>${esc(p.name)}</b> ${esc(p.text)}</span>
                <span class="gyt-ago">${esc(ago(p.at))}</span></div>`);
            h += `</div>`;
        }

        if (!dd.today.length && !dd.tomorrow.length && !an.length && !un.length && !fr.length && !rh.length)
            h += `<div class="gyt-empty">今天还没什么事。<br>记一条日程、或者去跟谁说句话。</div>`;
        return h;
    }

    // 事件：桌面右栏那块和手机上那块共用
    function bindBox(box) {
        box.addEventListener('toggle', ev => {
            const d = ev.target; if (!d || !d.dataset) return;
            if (d.classList && d.classList.contains('gyt-rhall')) { S.rhOpen = d.open; saveCfg(); return; }
            if (d.dataset.rh == null) return;
            if (d.open) OPEN.add(d.dataset.rh); else OPEN.delete(d.dataset.rh);
        }, true);
        box.addEventListener('click', ev => {
            const tile = ev.target.closest('[data-rhi]');
            if (tile) { ev.preventDefault(); const [cid, gk] = tile.dataset.rhi.split('|'); openTile(cid, gk); return; }
            const ask = ev.target.closest('[data-ta-ask]');
            if (ask) { ev.preventDefault(); ask.disabled = true; ask.textContent = '正在问…'; if (typeof gyTaAskMissing === 'function') gyTaAskMissing(ask.dataset.taAsk); return; }
            const row = ev.target.closest('.gyt-row.click'); if (!row) return;
            try {
                if (row.dataset.chat) {
                    switchMainView('chat');
                    setTimeout(() => { try { switchChatSession(row.dataset.chat); } catch (e) {} }, 60);
                } else if (row.dataset.post) switchMainView('postDetail', row.dataset.post);
            } catch (e) {}
        });
    }
    function ensure() {
        const host = document.querySelector('.sidebar-right-content');
        if (!host) return null;
        let box = document.getElementById(ID);
        if (!box) {
            box = document.createElement('div');
            box.id = ID; box.className = 'gyt-box';
            // 放在右栏最前面（搜索框后面），不动原来那些卡片
            const sb = host.querySelector('.search-box');
            if (sb && sb.nextSibling) host.insertBefore(box, sb.nextSibling);
            else host.insertBefore(box, host.firstChild);
            bindBox(box);
        }
        return box;
    }
    /* ---------- 📱 手机上：右栏整个是藏起来的，「今天」放进底栏第二个按钮（原来的话题广场）那一页 ----------
       开着「今天」时：那个按钮的图标换成日历，点进去顶上就是今天面板（跟桌面右栏一样，话题标签收起来）；
       关掉「今天」就还原成话题广场。 */
    const MID = 'gyTodayM';
    const CAL_SVG = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    let navSvg0 = null, head0 = null;
    function ensureMobile() {
        const view = document.getElementById('view-mobile-trends');
        if (!view) return null;
        let box = document.getElementById(MID);
        if (!box) {
            box = document.createElement('div');
            box.id = MID; box.className = 'gyt-box gyt-mobile';
            const hd = view.querySelector('.header-title');
            if (hd && hd.nextSibling) view.insertBefore(box, hd.nextSibling); else view.insertBefore(box, view.firstChild);
            bindBox(box);
        }
        return box;
    }
    function mobileChrome(on) {
        try {
            const nav = document.getElementById('mnav-search');
            if (nav) {
                if (navSvg0 == null) navSvg0 = nav.innerHTML;
                nav.innerHTML = on ? CAL_SVG : navSvg0;
                nav.title = on ? '今天' : '话题';
            }
            const hd = document.querySelector('#view-mobile-trends .header-title > span');
            if (hd) { if (head0 == null) head0 = hd.textContent; hd.textContent = on ? '今天' : head0; }
        } catch (e) {}
    }

    function render() {
        // ⚠️ 关着的时候**一个节点都不建**——先判开关再 ensure，
        //    不然刷新之后页面上还是会多出一块空的 #gyToday。
        if (!S.on) {
            const old = document.getElementById(ID); if (old) old.remove();
            const oldM = document.getElementById(MID); if (oldM) oldM.remove();
            document.body.classList.remove('gytoday-on');
            mobileChrome(false);
            return;
        }
        const mbox = ensureMobile();
        if (mbox) { mbox.innerHTML = html(); mobileChrome(true); }
        const box = ensure(); if (!box) return;
        box.style.display = '';
        document.body.classList.add('gytoday-on');
        // 开着「今天」的时候，右栏只放它：趋势标签和"你可能会喜欢"收起来
        if (!document.getElementById('gyTodayOnlyCss')) {
            const st = document.createElement('style'); st.id = 'gyTodayOnlyCss';
            // 右栏本来是 sticky 贴顶的：内容一长（时间管理大师展开之后），比屏幕高的那截就再也看不到了。
            // 开着「今天」时让右栏自己能上下滑；底下留出音乐盒那块的高度，最后几行不会被挡住。
            st.textContent = 'body.gytoday-on #rightPanelTrend, body.gytoday-on #rightPanelSuggest { display:none !important; }'
                + 'body.gytoday-on .sidebar-right-content { max-height: 100vh; max-height: 100dvh; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding-bottom: 130px; box-sizing: border-box; }'
                + 'body.gytoday-on .sidebar-right-content::-webkit-scrollbar { width: 6px; } body.gytoday-on .sidebar-right-content::-webkit-scrollbar-thumb { background: rgba(139,152,165,.35); border-radius: 3px; }'
                // 手机上：话题那一页只放「今天」（跟桌面右栏一样，话题标签收起来）
                + 'body.gytoday-on #view-mobile-trends #mobileTrendsListContainer, body.gytoday-on #view-mobile-trends #mobileTrendManageBar, body.gytoday-on #view-mobile-trends .header-title .mtb-icon-btn, body.gytoday-on #view-mobile-trends > .header-title { display:none !important; }';
            document.head.appendChild(st);
        }
        box.innerHTML = html();
    }
    window.gyTodayRender = render;
    window.gyTodaySet = function (on) {
        S.on = !!on; saveCfg();
        const box = document.getElementById(ID);
        if (!S.on) render();   // 关掉：桌面、手机两块一起收，图标还原
        else render();
    };
    window.gyTodayRead = () => ({ on: S.on });

    // 📱 点底栏第二个按钮（话题 / 今天）时也重画一次
    (function hookMobile(tries) {
        const o0 = window.openMobileTrendsView;
        if (typeof o0 === 'function') {
            if (!o0.__gyToday) {
                window.openMobileTrendsView = function () {
                    const r = o0.apply(this, arguments);
                    try { render(); if (S.on) { const t = document.getElementById('mtbCenterTitle'); if (t) t.innerText = '今天'; } } catch (e) {}
                    return r;
                };
                window.openMobileTrendsView.__gyToday = true;
            }
            return;
        }
        if ((tries || 0) < 20) setTimeout(() => hookMobile((tries || 0) + 1), 300);
    })(0);
    // 切页、切主题都重画一次；再挂一个 5 分钟的慢刷新（跨零点也能跟上）
    const sw0 = window.switchMainView;
    if (sw0 && sw0.call && !sw0.__gyToday) {
        window.switchMainView = function () { const r = sw0.apply(this, arguments); try { setTimeout(render, 0); } catch (e) {} return r; };
        window.switchMainView.__gyToday = true;
    }
    setInterval(() => { try { if (S.on) render(); } catch (e) {} }, 300000);

    // 🔄 数据变了（写了信、发了帖、自主模式排了下一次…）：开着的「今天」马上重画，不用等切页 / 5 分钟
    const shown = el => !!(el && el.isConnected && (el.offsetParent !== null || el.getClientRects().length));
    function refreshIfShown() {
        try {
            if (!S.on) return;
            const box = document.getElementById(ID), mbox = document.getElementById(MID);
            // 还没建过（开着但从没画过）也画一次；建过的只在看得见时画，省得后台白白重排
            if ((box || mbox) && !shown(box) && !shown(mbox) && !MOPEN) return;
            render();
            if (MOPEN && document.getElementById('gyTileModal')) openTile(MOPEN.cid, MOPEN.gk);   // 点开的那张时间卡也跟着更新
        } catch (e) {}
    }
    let rt = null, rtAt = 0;
    const soon = (ms) => {
        const at = Date.now() + ms;
        if (rt && rtAt <= at) return;          // 已经排了更早的一次
        if (rt) clearTimeout(rt);
        rtAt = at; rt = setTimeout(() => { rt = null; rtAt = 0; refreshIfShown(); }, ms);
    };
    window.addEventListener('gy:data', () => soon(30));
    // 各处改完数据几乎都会 saveAllData：顺着它也刷一下（合并成一次，慢一点，别跟着每次存档都重排）
    (function hookSave(tries) {
        const s0 = window.saveAllData;
        if (typeof s0 === 'function') {
            if (!s0.__gyToday) {
                window.saveAllData = function () { const r = s0.apply(this, arguments); try { if (S.on) soon(700); } catch (e) {} return r; };
                window.saveAllData.__gyToday = true;
            }
            return;
        }
        if ((tries || 0) < 20) setTimeout(() => hookSave((tries || 0) + 1), 300);
    })(0);

    function fillUI() { try { const el = document.getElementById('gyTodayOn'); if (el) el.checked = !!S.on; } catch (e) {} }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyToday) {
        window.openSettingsPanel = function (k) { const r = op0.apply(this, arguments); if (k === 'appearance') setTimeout(fillUI, 60); return r; };
        window.openSettingsPanel.__gyToday = true;
    }

    /* ---------- 样式：走项目自己的变量，深色/黑白都跟着变 ---------- */
    try {
        const st = document.createElement('style');
        st.id = 'gyTodayCss';
        st.textContent = `
#${ID}.gyt-box { padding: 4px 0 16px; font-size: 14px; }
#${ID} .gyt-head { display: flex; align-items: center; gap: 12px; padding: 14px 4px 10px; }
#${ID} .gyt-day { font-size: 40px; font-weight: 700; line-height: 1; color: var(--gy-accent, #1d9bf0); }
#${ID} .gyt-md { display: flex; flex-direction: column; gap: 2px; }
#${ID} .gyt-md b { font-size: 14px; }
#${ID} .gyt-md span { font-size: 13px; opacity: .6; }
#${ID} .gyt-sec { margin-top: 14px; }
#${ID} .gyt-sec h4 { margin: 0 0 6px; font-size: 13px; font-weight: 600; opacity: .55; }
#${ID} .gyt-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 4px;
                  border-radius: 6px; line-height: 1.45; }
#${ID} .gyt-row.col { flex-direction: column; gap: 2px; }
#${ID} .gyt-row.dim { opacity: .55; }
#${ID} .gyt-row.click { cursor: pointer; }
#${ID} .gyt-row.click:hover { background: rgba(var(--gy-accent-rgb, 29,155,240), .08); }
#${ID} .gyt-t { flex: 0 0 auto; font-size: 12px; opacity: .6; min-width: 56px; }
#${ID} .gyt-x { flex: 1 1 auto; min-width: 0; word-break: break-word; }
#${ID} .gyt-x em { font-style: normal; opacity: .5; margin-left: 6px; font-size: 12px; }
#${ID} .gyt-ago { font-size: 12px; opacity: .45; }
#${ID} .gyt-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 7px;
                  background: var(--gy-bad, #f91880); align-self: center; }
#${ID} .gyt-empty { padding: 18px 4px; font-size: 13px; opacity: .5; line-height: 1.7; }
#${ID} .gyt-rhall > summary { list-style: none; cursor: pointer; }
#${ID} .gyt-rhall > summary::-webkit-details-marker { display: none; }
#${ID} .gyt-rhall > summary h4 { display: flex; align-items: center; gap: 6px; }
#${ID} .gyt-rhall > summary h4 span { font-weight: 400; font-size: 12px; }
#${ID} .gyt-rhall > summary h4::after { content: '▸'; margin-left: auto; transition: transform .15s; }
#${ID} .gyt-rhall[open] > summary h4::after { transform: rotate(90deg); }
#${ID} .gyt-rh summary b::before { content: '▸ '; opacity: .45; font-weight: 400; }
#${ID} .gyt-rh[open] summary b::before { content: '▾ '; }
#${ID} .gyt-rh { margin: 0 0 8px; border: 1px solid rgba(139,152,165,.25); border-radius: 12px; padding: 0 10px;
                 background: rgba(var(--gy-accent-rgb, 29,155,240), .03); }
#${ID} .gyt-rh[open] { padding-bottom: 8px; }
#${ID} .gyt-rh summary { list-style: none; cursor: pointer; display: flex; align-items: baseline; gap: 8px; padding: 9px 0; }
#${ID} .gyt-rh summary::-webkit-details-marker { display: none; }
#${ID} .gyt-rh summary b { font-size: 14px; }
#${ID} .gyt-rh summary span { font-size: 12px; opacity: .55; margin-left: auto; }
#${ID} .gyt-rh-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
#${ID} .gyt-rh-gt { font-size: 11.5px; opacity: .6; margin: 10px 2px 6px; font-weight: 600; }
#${ID} .gyt-rh-q > div { display: flex; gap: 8px; align-items: baseline; padding: 5px 2px; font-size: 13px; border-bottom: 1px dashed rgba(139,152,165,.25); }
#${ID} .gyt-rh-q span { flex: 0 0 auto; font-size: 11.5px; opacity: .55; min-width: 64px; }
#${ID} .gyt-rh-q em { font-style: normal; font-size: 11.5px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${ID} .gyt-rh-gt:first-of-type { margin-top: 4px; }
#${ID} .gyt-rh-i { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 9px 10px 10px; border-radius: 12px;
                   background: linear-gradient(145deg, rgba(var(--gy-accent-rgb, 29,155,240), .09), rgba(var(--gy-accent-rgb, 29,155,240), .025));
                   border: 1px solid rgba(var(--gy-accent-rgb, 29,155,240), .14); min-width: 0; cursor: pointer; overflow: hidden;
                   transition: transform .15s, box-shadow .15s, border-color .15s; }
#${ID} .gyt-rh-i:hover { transform: translateY(-2px); border-color: rgba(var(--gy-accent-rgb, 29,155,240), .45);
                         box-shadow: 0 6px 16px rgba(var(--gy-accent-rgb, 29,155,240), .16); }
#${ID} .gyt-rh-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
#${ID} .gyt-rh-top i { font-style: normal; font-size: 13px; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%;
                       display: grid; place-items: center; background: rgba(255,255,255,.75); box-shadow: 0 1px 3px rgba(0,0,0,.06); }
body.dark-theme #${ID} .gyt-rh-top i { background: rgba(255,255,255,.08); }
#${ID} .gyt-rh-top span { font-size: 11.5px; opacity: .6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#${ID} .gyt-rh-i b { font-size: 15px; font-weight: 700; color: var(--gy-accent, #1d9bf0); margin-top: 3px; letter-spacing: .2px; }
#${ID} .gyt-rh-i em { font-style: normal; font-size: 11px; opacity: .55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${ID} .gyt-rh-i.dim { background: transparent; border-style: dashed; border-color: rgba(139,152,165,.35); }
#${ID} .gyt-rh-i.dim b { color: inherit; opacity: .4; font-weight: 400; font-size: 13.5px; }
#${ID} .gyt-rh-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(var(--gy-accent-rgb, 29,155,240), .1); }
#${ID} .gyt-rh-bar s { display: block; height: 100%; background: var(--gy-accent, #1d9bf0); border-radius: 0 3px 3px 0; opacity: .7; }
#${ID} .gyt-rh-foot { text-align: right; margin-top: 6px; }
#${ID} .gyt-rh-foot button { width: auto; font-size: 12px; padding: 3px 10px; border-radius: 999px; cursor: pointer;
                             border: 1px dashed rgba(139,152,165,.6); background: transparent; color: inherit; opacity: .75; }
#${ID} .gyt-rh-foot button:hover { opacity: 1; border-color: var(--gy-accent, #1d9bf0); color: var(--gy-accent, #1d9bf0); }
#gyTileModal { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; padding: 16px;
               background: rgba(15,20,25,.35); backdrop-filter: blur(3px); opacity: 0; transition: opacity .18s; }
#gyTileModal.show { opacity: 1; }
#gyTileModal .gtm-card { width: min(360px, 100%); border-radius: 20px; padding: 18px 18px 16px; background: #fff; color: #0f1419;
               box-shadow: 0 20px 50px rgba(0,0,0,.2); transform: translateY(10px) scale(.97); transition: transform .2s;
               background-image: linear-gradient(180deg, rgba(var(--gy-accent-rgb, 29,155,240), .12), rgba(var(--gy-accent-rgb, 29,155,240), 0) 120px); }
#gyTileModal.show .gtm-card { transform: none; }
body.dark-theme #gyTileModal .gtm-card { background-color: #16202a; color: #e7e9ea; }
#gyTileModal .gtm-head { display: flex; align-items: center; gap: 12px; }
#gyTileModal .gtm-ico { width: 46px; height: 46px; flex: 0 0 46px; border-radius: 14px; display: grid; place-items: center; font-size: 24px;
               background: #fff; box-shadow: 0 4px 12px rgba(var(--gy-accent-rgb, 29,155,240), .25); }
body.dark-theme #gyTileModal .gtm-ico { background: rgba(255,255,255,.08); }
#gyTileModal .gtm-ttl { flex: 1; min-width: 0; display: flex; flex-direction: column; }
#gyTileModal .gtm-ttl small { font-size: 12px; opacity: .55; }
#gyTileModal .gtm-ttl b { font-size: 17px; }
#gyTileModal .gtm-x { width: 30px; height: 30px; border-radius: 50%; border: 0; background: rgba(139,152,165,.15); color: inherit;
               font-size: 18px; line-height: 1; cursor: pointer; padding: 0; }
#gyTileModal .gtm-val { margin: 18px 0 4px; font-size: 32px; font-weight: 800; color: var(--gy-accent, #1d9bf0); letter-spacing: .5px; }
#gyTileModal .gtm-val.dim { color: inherit; opacity: .35; font-weight: 500; font-size: 24px; }
#gyTileModal .gtm-val.thinking { animation: gtmPulse 1.1s ease-in-out infinite; }
@keyframes gtmPulse { 50% { opacity: .35; } }
#gyTileModal .gtm-bar { height: 6px; border-radius: 99px; background: rgba(var(--gy-accent-rgb, 29,155,240), .12); overflow: hidden; margin-top: 8px; }
#gyTileModal .gtm-bar s { display: block; height: 100%; border-radius: 99px;
               background: linear-gradient(90deg, rgba(var(--gy-accent-rgb, 29,155,240), .5), var(--gy-accent, #1d9bf0)); }
#gyTileModal .gtm-barl { font-size: 11.5px; opacity: .5; margin-top: 4px; }
#gyTileModal .gtm-quote { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 12px; border-radius: 14px;
               background: rgba(139,152,165,.1); }
#gyTileModal .gtm-quote p { margin: 0; font-size: 14px; line-height: 1.6; flex: 1; word-break: break-word; }
#gyTileModal .gtm-quote.empty p { opacity: .55; font-size: 13px; }
#gyTileModal .gtm-ava { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; overflow: hidden; display: grid; place-items: center;
               background: var(--gy-accent, #1d9bf0); color: #fff; font-weight: 700; font-size: 14px; }
#gyTileModal .gtm-ava img { width: 100%; height: 100%; object-fit: cover; }
#gyTileModal .gtm-meta { margin-top: 12px; border-top: 1px dashed rgba(139,152,165,.35); padding-top: 8px; }
#gyTileModal .gtm-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 13px; }
#gyTileModal .gtm-row span { opacity: .55; }
#gyTileModal .gtm-row em { font-style: normal; opacity: .5; font-weight: 400; margin-left: 4px; }
#gyTileModal .gtm-desc { margin-top: 10px; font-size: 12px; line-height: 1.7; opacity: .55; }
#gyTileModal .gtm-btns { display: flex; gap: 8px; margin-top: 16px; }
#gyTileModal .gtm-btns button { flex: 1; width: auto; padding: 10px 0; border-radius: 999px; border: 0; cursor: pointer; font-size: 14px; font-weight: 600;
               background: var(--gy-accent, #1d9bf0); color: #fff; }
#gyTileModal .gtm-btns button.ghost { flex: 0 0 72px; background: rgba(139,152,165,.15); color: inherit; }
#gyTileModal .gtm-btns button:disabled { opacity: .6; cursor: default; }
#${MID}.gyt-box { padding: 4px 14px 110px; }
#${MID} .gyt-rh-grid { gap: 6px; }
#${MID} .gyt-rh-i b { font-size: 15px; }
`.replace(/#gyToday(?![\w-])/g, ':is(#gyToday,#gyTodayM)');
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { fillUI(); render(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1100);
    else window.addEventListener('load', () => setTimeout(boot, 1100));

    console.info('[今天] 已加载。开关：设置 → 外观 →「📅 右边放一块「今天」」（默认关）');
})();
