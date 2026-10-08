/* ============================================================
   js/54 —— 🎛️ 全部开关：所有开关收在一页
   ------------------------------------------------------------
   以前开关散在十几个地方：设置里的「自动功能开关」「互动与描写」「外观」「通知」「活人感」，
   记忆总览里的向量记忆，音乐盒 / 行程 / 关系账本 / 八卦网 / 随身物 / 日子 / 一起看电影 / 打电话各自的设置页……
   想开一个功能，得先想起来它在哪儿。

   现在设置里原来的「🔌 自动功能开关」那一页改成「🎛️ 全部开关」：
     · 上面一个搜索框，搜名字或说明里的字就能找到
     · 原来那张自动功能表照旧（分组、全开全关、只看开着的）
     · 下面接着是其它所有开关，按原来所在的地方分组
   原来那些地方的开关不再显示，换成一行「🎛️ 这里的开关在『全部开关』里 →」，点了直接跳过来、定位到那一组。
   v161 起改为：这一页只放「自动功能开关」和各个小功能页的开关；设置各页（生成参数、互动与描写、
   活人感、外观、通知、数据）和记忆总览的开关全部还回原处，不再藏、也不再列在这里。

   做法：原来的开关元素**只是藏起来，没有删**——各功能读自己开关的代码一行不用改。
   这页上点一下，就是替你去点原来那个开关（该存档的照样存档）。
   ============================================================ */
(function () {
    'use strict';
    if (window.__gyAllSwLoaded) return;
    window.__gyAllSwLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- 设置各页里的开关（按 id） ---------- */
    // 表单里的勾选（新建正则、世界书条目、小说来源这些）不是"开关"，不收
    const SKIP_IDS = /^(newRegex|newWb|newPlugin|srcCat|jsonl|novelSecondPerson|ssSecondPerson|shuraCheck|charVerified|myVerified)/;
    const PANEL_NAMES = { gen: '🎚️ 生成参数', interaction: '💬 互动与描写', alive: '🫀 活人感', appearance: '🎨 外观与主题', notify: '🔔 通知与云端', data: '💾 数据' };

    function panelOf(el) {
        const p = el.closest('.set-panel');
        if (p && p.id) return p.id.replace('setPanel-', '');
        if (el.closest('#view-memory-hub')) return 'memory';
        return '';
    }
    function textOf(el) {
        const row = el.closest('.checkbox-group, label, .input-group') || el.parentElement;
        let t = '';
        if (row) {
            const lab = row.querySelector('label') && row.tagName !== 'LABEL' ? row.querySelector('label') : row;
            t = (lab.innerText || '').trim();
        }
        if (!t && el.nextElementSibling) t = (el.nextElementSibling.innerText || '').trim();
        return t.replace(/\s+/g, ' ');
    }
    function settingsBoxes() {
        const out = [];
        document.querySelectorAll('#view-settings .set-panel input[type="checkbox"], #view-memory-hub input[type="checkbox"]#enableVectorMemory').forEach(el => {
            if (!el.id || SKIP_IDS.test(el.id)) return;
            const pk = panelOf(el);
            if (!pk || pk === 'auto') return;
            if (el.closest('.auto-feat-row')) return;
            if (/aliveSetSwitch\(/.test(el.getAttribute('onchange') || '')) return;   // 活人感那几个是自动功能表里的同一个开关
            const t = textOf(el);
            if (!t) return;
            const [title, ...rest] = t.split(/[（(]/);
            out.push({ id: el.id, el, group: pk === 'memory' ? '🧠 记忆总览' : (PANEL_NAMES[pk] || pk), title: title.trim().slice(0, 40), desc: rest.length ? '（' + rest.join('(').replace(/[）)]\s*$/, '') + '）' : '' });
        });
        return out;
    }

    /* ---------- 各功能页自己的开关（按接口） ---------- */
    const MOD = [
        { group: '🎵 音乐盒', on: () => typeof window.gymGetSay === 'function', hide: /^gymSetSay\(/, items: [
            ['sayOnSwitch', '一起听：换歌时说一句'], ['sayOnLyric', '一起听：唱到某句歌词时接一句'], ['sayOnEnd', '一起听：一首听完给个感想']
        ], get: k => window.gymGetSay(k), set: (k, v) => window.gymSetSay(k, v) },
        { group: '🗺️ 行程与天气', on: () => typeof window.gymapGetMove === 'function', hide: /^gymapSet(Move|Remind)\(/, items: [
            ['bySchedule', '角色移动：跟日程联动'], ['byAutonomy', '角色移动：自主模式里多一个「去某个地方」'], ['meetTheater', '角色移动：同一个地点碰上就触发小剧场'], ['manual', '角色移动：允许我手动拖'],
            ['__remind', '每天最多一次，让角色提醒你今天的天气']
        ], get: k => k === '__remind' ? window.gymapGetRemind() : window.gymapGetMove(k),
           set: (k, v) => k === '__remind' ? window.gymapSetRemind(v) : window.gymapSetMove(k, v) },
        { group: '💗 关系账本', on: () => typeof window.gyrelGet === 'function', hide: /^gyrelSet\(/, items: [
            ['fromMood', '跟着「情绪惯性」走'], ['askModel', '让模型每轮单独给一个数'], ['fromEvents', '一起听歌 / 一起出去，自动记账'], ['syncAffinity', '同步到主程序的好感度系统'], ['showNumber', '把分数本身也告诉角色']
        ], get: k => window.gyrelGet(k), set: (k, v) => window.gyrelSet(k, v) },
        { group: '🗣️ 八卦网', on: () => typeof window.gygsGet === 'function', hide: /^gygsSet\(/, items: [
            ['fromTheater', '素材：角色之间的后台小剧场'], ['fromDates', '素材：你和角色一起出去的事'], ['distort', '让转述失真'], ['auto', '自动传播：隔一段时间自己挑一条讲给你'], ['godMode', '面板里显示"实际发生的是什么"']
        ], get: k => window.gygsGet(k), set: (k, v) => window.gygsSet(k, v) },
        { group: '🎒 随身物', on: () => typeof window.gykitGet === 'function', hide: /^gykitSet\(/, items: [
            ['strict', '不许凭空多出单子上没有的东西'], ['showGone', '弄丢/用坏的也告诉 TA'], ['autoGen', '让 AI 按人设生成一批随身物'], ['autoAct', '自主模式里多一个「送东西 / 用掉东西」']
        ], get: k => window.gykitGet(k), set: (k, v) => window.gykitSet(k, v) },
        { group: '📅 日子', on: () => typeof window.gydayGet === 'function', hide: /^gydaySet\(/, items: [
            ['useTerms', '24 节气'], ['useSeason', '时令质感'], ['useAnniv', '读你在角色日历里记的纪念日'], ['useBuiltin', '内置公历节日'], ['remind', '到日子那天，让一个角色主动说一句']
        ], get: k => window.gydayGet(k), set: (k, v) => window.gydaySet(k, v) },
        { group: '🎬 一起看电影', on: () => typeof window.fbGet === 'function', hide: /^fbSet(Auto)?\('(danmu|filmScene|filmPause|filmEnd)'/, items: [
            ['danmu', '全屏时 TA 的话走弹幕']
        ], get: k => !!window.fbGet(k), set: (k, v) => window.fbSet(k, !!v) },
        { group: '📞 打电话', on: () => typeof window.gyCallRead === 'function', hide: /^gyCallSet\('(greetOn|askAnswer|invite)'/, items: [
            ['greetOn', '接起来先让 TA 说一句'], ['askAnswer', '让 TA 自己决定接不接'], ['invite', '允许 TA 主动打给我']
        ], get: k => !!(window.gyCallRead() || {})[k], set: (k, v) => window.gyCallSet(k, !!v) }
    ];
    // 这些地方的开关留在原处不动（「全部开关」页里照样也能开关，两边是同一个开关）
    const KEEP_IN_PLACE = '#setPanel-interaction';
    // 这几种 onchange 属于自动功能表（同一个开关），原处也藏起来
    const AUTO_HIDE = /^(aliveSetSwitch|fbSetAuto|gymapDateAuto|setAutoFeature)\(/;

    /* ---------- 这一页 ---------- */
    let Q = '';
    function quietSave() {
        const a = window.alert;
        try { window.alert = function () {}; if (typeof saveSettings === 'function') saveSettings(); } catch (e) {}
        finally { window.alert = a; }
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
    }
    window.gyswSetBox = function (id, v) {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = !!v;
        const has = !!(el.getAttribute('onchange') || el.onchange);
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        if (!has || /saveSettings/.test(el.getAttribute('onchange') || '')) quietSave();
        else { try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {} }
        renderMore();
    };
    window.gyswSetMod = function (gi, k, v) {
        const m = MOD[gi]; if (!m) return;
        try { m.set(k, !!v); } catch (e) { console.warn('[全部开关] 设置失败：', e); }
        renderMore();
    };
    const row = (title, desc, on, onchange, tag) => `
        <label class="auto-feat-row gysw-row" data-gysw="${esc((tag + ' ' + title + ' ' + desc).toLowerCase())}">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="${onchange}">
            <span style="flex:1;min-width:0;"><b>${esc(title)}</b>${desc ? `<div style="font-size:12px;color:#536471;line-height:1.7;margin-top:2px;">${esc(desc)}</div>` : ''}</span>
        </label>`;
    function head(title, n, onN, anchor) {
        return `<div class="gysw-head" id="gysw-${esc(anchor)}"><b>${esc(title)}</b><span>${onN}/${n} 开着</span></div>`;
    }
    function renderMore() {
        const box = document.getElementById('gyAllSwitchesMore');
        if (!box) return;
        let html = '';
        // 这一页只放两样：上面的自动功能表 + 这里的小功能开关。设置各页自己的开关在各自那一页
        MOD.forEach((m, gi) => {
            if (!m.on()) return;
            let items = [];
            try { items = m.items.map(([k, t]) => ({ k, t, v: !!m.get(k) })); } catch (e) { return; }
            html += `<div class="gysw-sec">${head(m.group, items.length, items.filter(x => x.v).length, m.group)}
                ${items.map(x => row(x.t, '', x.v, `gyswSetMod(${gi}, '${x.k}', this.checked)`, m.group)).join('')}</div>`;
        });
        box.innerHTML = html;
        applyFilter();
    }
    function applyFilter() {
        const q = Q.trim().toLowerCase();
        document.querySelectorAll('#setPanel-auto .auto-feat-row').forEach(r => {
            const t = (r.dataset.gysw || r.innerText || '').toLowerCase();
            r.style.display = (!q || t.indexOf(q) !== -1) ? '' : 'none';
        });
        document.querySelectorAll('#setPanel-auto .gysw-sec').forEach(sec => {
            const any = [...sec.querySelectorAll('.gysw-row')].some(r => r.style.display !== 'none');
            sec.style.display = any ? '' : 'none';
        });
    }
    window.gyswSearch = function (v) { Q = String(v || ''); applyFilter(); };

    function mountPanel() {
        const panel = document.getElementById('setPanel-auto');
        if (!panel || document.getElementById('gyAllSwitchesMore')) return;
        const top = document.createElement('div');
        top.className = 'gysw-top';
        top.innerHTML = `<input id="gyswQ" type="search" placeholder="🔍 搜开关：名字、说明里的字都行" oninput="gyswSearch(this.value)">
            <div class="gysw-note">这里是自动功能的开关，和各个小功能的开关。设置里其它页的开关还在各自那一页。</div>`;
        panel.insertBefore(top, panel.firstChild);
        const pre = document.createElement('div');
        pre.id = 'gyswPresets'; pre.className = 'gysw-pre';
        panel.insertBefore(pre, top.nextSibling);
        const more = document.createElement('div');
        more.innerHTML = `<div class="gysw-bighead">🧩 小功能的开关</div><div id="gyAllSwitchesMore"></div>`;
        panel.appendChild(more);
    }
    function hookPanel() {
        try { if (typeof GY_SETTINGS_PANELS !== 'undefined') GY_SETTINGS_PANELS.auto = '🎛️ 全部开关'; } catch (e) {}
        const op0 = window.openSettingsPanel;
        if (typeof op0 === 'function' && !op0.__gysw) {
            window.openSettingsPanel = function (k) {
                const r = op0.apply(this, arguments);
                if (k === 'auto') {
                    mountPanel();
                    // 别的设置页的开关由各自的模块在"打开那一页"时才填好当前值——这里先挨个悄悄过一遍
                    renderMore(); renderPresets();
                    setTimeout(() => { renderMore(); renderPresets(); applyFilter(); }, 120);
                }
                return r;
            };
            window.openSettingsPanel.__gysw = true;
        }
        // 自动功能表重画之后（点了全开/全关、切了筛选），把搜索重新套上
        const ra = window.renderAutoFeatureList;
        if (typeof ra === 'function' && !ra.__gysw) {
            window.renderAutoFeatureList = function () { const r = ra.apply(this, arguments); try { applyFilter(); renderPresets(); } catch (e) {} return r; };
            window.renderAutoFeatureList.__gysw = true;
        }
        // 设置目录里那一项改名
        document.querySelectorAll('#setIndex .set-entry').forEach(b => {
            if (/openSettingsPanel\('auto'\)/.test(b.getAttribute('onclick') || '')) {
                const t = b.querySelector('.set-entry-title'); if (t && t.innerText !== '全部开关') t.innerText = '全部开关';
                const d = b.querySelector('.set-entry-desc'); if (d && d.innerText !== '自动功能和小功能的开关，能搜') d.innerText = '自动功能和小功能的开关，能搜';
                const i = b.querySelector('.set-entry-ico'); if (i && i.innerText !== '🎛️') i.innerText = '🎛️';
                // 放到最上面
                const menu = b.parentElement; if (menu && menu.firstElementChild !== b) menu.insertBefore(b, menu.firstElementChild);
            }
        });
    }


    /* ---------- ⚡ 一键配置 + 📌 我的配置 ----------
       自动功能四十多个开关，一个个点太累。这里给三套现成的，外加"把现在这一身存起来，下次一点就换回来"。
       · 三套现成的只动"会自己在后台花钱"的那些；不花钱的开关、你手动点了才会调用的功能（开店、生成通讯录这些）一概不碰
       · 我的配置存的是**全部**：自动功能表 + 下面各个小功能的开关，原样存、原样换回
       · 每次换之前先弹一下"会打开哪些、关掉哪些"，换完还能撤销
       · 我的配置跟着存档走（导出的备份里也有）
    */
    const FREE_RE = /不调|不额外|不花|完全不调用|省钱|只是记账/;
    const MANUAL_RE = /手动点|只在你点|点一次一次调用|点才/;
    function kindOf(d) {
        const c = String(d.cost || '');
        if (FREE_RE.test(c)) return 'free';
        if (MANUAL_RE.test(c)) return 'manual';
        return 'auto';
    }
    // 🌤️ 推荐：日常用着有"活人感"、又不会在你不看的时候狂烧钱的那些
    const REC_ON = new Set(['autoPost', 'proactiveChat', 'proactiveLetter', 'letterReply', 'diaryReaction',
        'scheduleFlow', 'scheduleAutoRenew', 'lifeStateEnter', 'autoTodoGen',
        'theaterMemory', 'chatSummary', 'postMemory', 'scheduleMemory',
        'relatedReaction', 'postReactions',
        'aliveGlance', 'aliveVoice',
        'filmScene', 'filmPause', 'filmEnd',
        'mallTimeline', 'mallReact', 'parcelAccept', 'takeoutReact', 'dressAsk', 'dressNotice']);
    // 🌱 省钱：只留你自己先动了手、它才接着回的那几样，外加"总结"（总结反而能省后面每轮的字数）
    const SAVE_ON = new Set(['letterReply', 'diaryReaction', 'chatSummary', 'mallTimeline']);
    const BUILTIN = [
        { id: 'save', ico: '🌱', name: '省钱', desc: '后台不自己花钱，只有你先开口 TA 才回', pick: k => SAVE_ON.has(k) },
        { id: 'rec', ico: '🌤️', name: '推荐', desc: '有活人感，又不会狂烧钱', pick: k => REC_ON.has(k) },
        { id: 'all', ico: '🔥', name: '全都要', desc: '会自动花钱的全部打开，最热闹也最费', pick: () => true }
    ];
    const defs = () => {
        const seen = new Set(), out = [];
        try { (AUTO_FEATURE_DEFS || []).forEach(d => { if (d && d.key && !seen.has(d.key)) { seen.add(d.key); out.push(d); } }); } catch (e) {}
        return out;
    };
    const autoOn = k => { try { return !!isAutoOn(k); } catch (e) { return true; } };
    function captureNow() {
        const auto = {}; defs().forEach(d => { auto[d.key] = autoOn(d.key); });
        const mod = {};
        MOD.forEach(m => {
            try { if (!m.on()) return; const o = {}; m.items.forEach(([k]) => { o[k] = !!m.get(k); }); mod[m.group] = o; } catch (e) {}
        });
        return { auto, mod };
    }
    function targetOfBuiltin(b) {
        const auto = {};
        defs().forEach(d => { if (kindOf(d) === 'auto') auto[d.key] = !!b.pick(d.key); });
        return { auto, mod: {} };
    }
    function diffOf(tgt) {
        const on = [], off = [];
        const lab = {}; defs().forEach(d => { lab[d.key] = d.label; });
        Object.keys(tgt.auto || {}).forEach(k => {
            if (!(k in lab)) return;   // 存的时候有、现在没了的功能：跳过
            const cur = autoOn(k), want = !!tgt.auto[k];
            if (cur !== want) (want ? on : off).push(lab[k]);
        });
        Object.keys(tgt.mod || {}).forEach(g => {
            const m = MOD.find(x => x.group === g); if (!m) return;
            try { if (!m.on()) return; } catch (e) { return; }
            m.items.forEach(([k, t]) => {
                if (!(k in tgt.mod[g])) return;
                let cur; try { cur = !!m.get(k); } catch (e) { return; }
                const want = !!tgt.mod[g][k];
                if (cur !== want) (want ? on : off).push(g.replace(/^\S+\s*/, '') + '·' + t);
            });
        });
        return { on, off };
    }
    function applyTarget(tgt) {
        Object.keys(tgt.auto || {}).forEach(k => {
            if (!defs().some(d => d.key === k)) return;
            if (autoOn(k) === !!tgt.auto[k]) return;
            try { setAutoFeature(k, !!tgt.auto[k], true); } catch (e) {}
        });
        Object.keys(tgt.mod || {}).forEach(g => {
            const m = MOD.find(x => x.group === g); if (!m) return;
            try { if (!m.on()) return; } catch (e) { return; }
            m.items.forEach(([k]) => {
                if (!(k in tgt.mod[g])) return;
                try { if (!!m.get(k) !== !!tgt.mod[g][k]) m.set(k, !!tgt.mod[g][k]); } catch (e) {}
            });
        });
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        try { if (typeof renderAutoFeatureList === 'function') renderAutoFeatureList(); } catch (e) {}
        renderMore(); renderPresets();
    }
    const listShort = (arr) => arr.length <= 8 ? arr.join('、') : arr.slice(0, 8).join('、') + ` 等 ${arr.length} 项`;
    const toastOk = (t, d) => { try { showToast('', t, d, null, null, false); } catch (e) {} };
    let UNDO = null;   // { name, snap }
    async function confirmApply(name, tgt) {
        const df = diffOf(tgt);
        if (!df.on.length && !df.off.length) { toastOk('✅ 已经是「' + name + '」了', '现在的开关跟这套一模一样，没有要改的'); return false; }
        let msg = `换成「${name}」：`;
        if (df.on.length) msg += `\n\n🟢 打开 ${df.on.length} 项：${listShort(df.on)}`;
        if (df.off.length) msg += `\n\n⚪ 关掉 ${df.off.length} 项：${listShort(df.off)}`;
        msg += '\n\n换完可以撤销。';
        let ok = true;
        try { ok = (typeof appConfirm === 'function') ? await appConfirm(msg, '换', '算了') : confirm(msg); } catch (e) { ok = false; }
        if (!ok) return false;
        UNDO = { name, snap: captureNow() };
        applyTarget(tgt);
        toastOk('🎛️ 已换成「' + name + '」', `打开 ${df.on.length} 项，关掉 ${df.off.length} 项`);
        return true;
    }
    window.gyswApplyBuiltin = function (id) {
        const b = BUILTIN.find(x => x.id === id); if (!b) return;
        return confirmApply(b.ico + ' ' + b.name, targetOfBuiltin(b));
    };
    const mine = () => { if (!Array.isArray(window.gySwitchPresets)) window.gySwitchPresets = []; return window.gySwitchPresets; };
    window.gyswApplyMine = function (id) {
        const p = mine().find(x => x.id === id); if (!p) return;
        return confirmApply('📌 ' + p.name, p);
    };
    window.gyswSaveMine = async function () {
        let name = null;
        const def = '我的配置 ' + (mine().length + 1);
        try { name = (typeof appPrompt === 'function') ? await appPrompt('给现在这一套开关起个名字（比如"周末放开玩""上班省钱"）', def) : prompt('名字', def); } catch (e) {}
        if (name == null) return;
        name = String(name).trim() || def;   // 预设名不限字数
        const snap = captureNow();
        const same = mine().find(x => x.name === name);
        if (same) {
            let ok = false;
            try { ok = await appConfirm(`已经有一套叫「${name}」的了，用现在的开关覆盖它？`, '覆盖', '取消'); } catch (e) {}
            if (!ok) return;
            same.auto = snap.auto; same.mod = snap.mod; same.at = Date.now();
        } else {
            mine().push({ id: 'p' + Date.now().toString(36), name, at: Date.now(), auto: snap.auto, mod: snap.mod });
        }
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        renderPresets();
        const n = Object.values(snap.auto).filter(Boolean).length;
        toastOk('📌 存好了「' + name + '」', `自动功能开着 ${n} 项，小功能开关也一起存了。下次点一下就换回来`);
    };
    window.gyswDelMine = async function (id) {
        const p = mine().find(x => x.id === id); if (!p) return;
        let ok = false;
        try { ok = await appConfirm(`删掉「${p.name}」这套配置？（现在开着的开关不受影响）`, '删', '留着'); } catch (e) {}
        if (!ok) return;
        window.gySwitchPresets = mine().filter(x => x.id !== id);
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        renderPresets();
    };
    window.gyswRenameMine = async function (id) {
        const p = mine().find(x => x.id === id); if (!p) return;
        let name = null;
        try { name = await appPrompt('改个名字', p.name); } catch (e) {}
        if (name == null) return;
        name = String(name).trim(); if (!name) return;
        p.name = name;
        try { if (typeof saveAllData === 'function') saveAllData(); } catch (e) {}
        renderPresets();
    };
    window.gyswUndo = function () {
        if (!UNDO) return;
        const u = UNDO; UNDO = null;
        applyTarget(u.snap);
        toastOk('↩️ 已撤销', '开关回到换「' + u.name + '」之前的样子');
    };
    // 现在这一身跟哪套一样（给按钮打个"当前"的勾）
    function matchesNow(tgt) { const df = diffOf(tgt); return !df.on.length && !df.off.length; }
    function renderPresets() {
        const box = document.getElementById('gyswPresets');
        if (!box) return;
        const bi = BUILTIN.map(b => {
            const cur = matchesNow(targetOfBuiltin(b));
            return `<button type="button" class="gysw-pre-btn${cur ? ' cur' : ''}" onclick="gyswApplyBuiltin('${b.id}')">
                <span class="i">${b.ico}</span><b>${esc(b.name)}</b>${cur ? '<em>当前</em>' : ''}<small>${esc(b.desc)}</small></button>`;
        }).join('');
        const my = mine().map(p => {
            const cur = matchesNow(p);
            const n = Object.values(p.auto || {}).filter(Boolean).length;
            const d = new Date(p.at || Date.now());
            return `<div class="gysw-my${cur ? ' cur' : ''}">
                <button type="button" class="gysw-my-main" onclick="gyswApplyMine('${esc(p.id)}')" title="换成这一套">
                    <b>📌 ${esc(p.name)}</b>${cur ? '<em>当前</em>' : ''}<small>开着 ${n} 项 · ${d.getMonth() + 1}/${d.getDate()} 存的</small></button>
                <button type="button" class="gysw-my-x" onclick="gyswRenameMine('${esc(p.id)}')" title="改名">✏️</button>
                <button type="button" class="gysw-my-x" onclick="gyswDelMine('${esc(p.id)}')" title="删掉">🗑️</button>
            </div>`;
        }).join('');
        box.innerHTML = `
            <div class="gysw-pre-h">⚡ 一键配置<span>只动"会自己在后台花钱"的开关；不花钱的、你手动点才调用的都不碰</span></div>
            <div class="gysw-pre-row">${bi}</div>
            <div class="gysw-pre-h" style="margin-top:12px;">📌 我的配置<span>把现在这一身开关（连同下面小功能的）存起来，下次点一下就换回来</span></div>
            <div class="gysw-my-list">${my || '<div class="gysw-my-empty">还没有存过。先把开关调成你常用的样子，再点下面这颗 ↓</div>'}</div>
            <div class="gysw-pre-ops">
                <button type="button" class="gysw-op" onclick="gyswSaveMine()">💾 把现在的开关存成一套</button>
                ${UNDO ? `<button type="button" class="gysw-op ghost" onclick="gyswUndo()">↩️ 撤销刚才换的「${esc(UNDO.name)}」</button>` : ''}
            </div>`;
    }
    window.gyswRenderPresets = renderPresets;
    window.__gyswPresetKind = kindOf;   // 测试用

    // 跳过来并定位
    window.gyOpenAllSwitches = function (q) {
        try {
            if (typeof switchMainView === 'function') switchMainView('settings');
            if (typeof openSettingsPanel === 'function') openSettingsPanel('auto');
            setTimeout(() => {
                const inp = document.getElementById('gyswQ');
                if (inp) { inp.value = q || ''; gyswSearch(q || ''); }
                const first = [...document.querySelectorAll('#setPanel-auto .auto-feat-row')].find(r => r.style.display !== 'none');
                if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); first.classList.add('gy-flash'); setTimeout(() => first.classList.remove('gy-flash'), 2200); }
            }, 200);
        } catch (e) {}
    };

    /* ---------- 原处：藏起来，换成一个跳转链接 ---------- */
    function hideRow(el) {
        let r = el.closest('label, .checkbox-group') || el.parentElement;
        if (r && r.querySelectorAll('input, select, textarea, button').length > 1) r = null;   // 同一行里还有别的输入，别整行藏
        if (r) r.classList.add('gysw-moved'); else el.classList.add('gysw-moved');
        return r || el;
    }
    function linkBefore(node, q) {
        const host = node.parentElement;
        if (!host || host.querySelector(':scope > .gysw-jump')) return;
        const a = document.createElement('div');
        a.className = 'gysw-jump';
        a.innerHTML = `🎛️ 这里的开关在「全部开关」里 <span>→</span>`;
        a.onclick = () => window.gyOpenAllSwitches(q);
        host.insertBefore(a, node);
    }
    function sweep() {
        try {
            // 设置各页、记忆总览里的开关：留在原处，不收（v161 起）
            // 各功能页
            document.querySelectorAll('input[type="checkbox"][onchange]').forEach(el => {
                if (el.closest('#setPanel-auto') || el.closest('.gysw-moved') || el.classList.contains('gysw-moved')) return;
                if (el.closest('#view-settings') || el.closest('#view-memory-hub')) return;
                const oc = el.getAttribute('onchange') || '';
                const m = MOD.find(x => x.hide.test(oc));
                if (!m && !AUTO_HIDE.test(oc)) return;
                const n = hideRow(el);
                linkBefore(n, m ? m.group.replace(/^\S+\s*/, '') : '');
            });
        } catch (e) {}
    }
    let pending = false;
    const kick = () => { if (pending) return; pending = true; setTimeout(() => { pending = false; sweep(); hookPanel(); }, 120); };
    try { new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    setTimeout(() => { hookPanel(); sweep(); }, 600);

    try {
        const st = document.createElement('style');
        st.textContent = `
.gysw-moved{display:none !important;}
.gysw-jump{display:flex;align-items:center;gap:6px;margin:8px 0;padding:9px 12px;border-radius:10px;border:1px dashed var(--gy-accent,#1d9bf0);color:var(--gy-accent,#1d9bf0);font-size:13px;cursor:pointer;background:rgba(29,155,240,.05);}
.gysw-jump span{margin-left:auto;font-weight:700;}
.gysw-jump:hover{background:rgba(29,155,240,.1);}
.gysw-top{position:sticky;top:0;z-index:5;padding:6px 0 10px;background:inherit;}
.gysw-top input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--gy-accent,#1d9bf0);border-radius:10px;font-size:14px;background:transparent;color:inherit;}
.gysw-note{font-size:12px;color:#8b98a5;margin-top:6px;line-height:1.6;}
.gysw-bighead{font-size:15px;font-weight:700;margin:26px 0 4px;}
.gysw-sec{margin-top:16px;}
.gysw-head{display:flex;align-items:baseline;gap:8px;padding-bottom:6px;border-bottom:2px solid var(--gy-accent,#1d9bf0);margin-bottom:4px;}
.gysw-head b{font-size:14.5px;}
.gysw-head span{font-size:11.5px;color:#8b98a5;}
.gysw-pre{margin:4px 0 14px;padding:12px;border:1px solid rgba(139,152,165,.35);border-radius:14px;background:rgba(29,155,240,.04);}
.gysw-pre-h{font-weight:700;font-size:14px;margin-bottom:8px;}
.gysw-pre-h span{display:block;font-weight:400;font-size:11.5px;color:#8b98a5;margin-top:2px;line-height:1.6;}
.gysw-pre-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.gysw-pre-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px;border-radius:12px;border:1px solid rgba(139,152,165,.4);background:transparent;color:inherit;cursor:pointer;text-align:left;width:auto;margin:0;position:relative;}
.gysw-pre-btn .i{font-size:20px;line-height:1.2;}
.gysw-pre-btn b{font-size:14px;}
.gysw-pre-btn small{font-size:11px;color:#8b98a5;line-height:1.5;}
.gysw-pre-btn:hover,.gysw-my-main:hover{border-color:var(--gy-accent,#1d9bf0);background:rgba(29,155,240,.07);}
.gysw-pre-btn.cur,.gysw-my.cur .gysw-my-main{border-color:var(--gy-accent,#1d9bf0);box-shadow:0 0 0 1px var(--gy-accent,#1d9bf0) inset;}
.gysw-pre-btn em,.gysw-my em{position:absolute;top:6px;right:8px;font-style:normal;font-size:10.5px;padding:1px 7px;border-radius:999px;background:var(--gy-accent,#1d9bf0);color:#fff;}
.gysw-my-list{display:flex;flex-direction:column;gap:6px;}
.gysw-my{display:flex;gap:6px;align-items:stretch;position:relative;}
.gysw-my-main{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 12px;border-radius:12px;border:1px solid rgba(139,152,165,.4);background:transparent;color:inherit;cursor:pointer;text-align:left;width:auto;margin:0;}
.gysw-my-main b{font-size:13.5px;}
.gysw-my-main small{font-size:11px;color:#8b98a5;}
.gysw-my em{right:98px;}
.gysw-my-x{width:40px;flex:none;border-radius:12px;border:1px solid rgba(139,152,165,.4);background:transparent;cursor:pointer;margin:0;padding:0;font-size:14px;}
.gysw-my-empty{font-size:12px;color:#8b98a5;padding:8px 2px;}
.gysw-pre-ops{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.gysw-op{padding:8px 14px;border-radius:999px;border:none;background:var(--gy-accent,#1d9bf0);color:#fff;font-size:13px;cursor:pointer;width:auto;margin:0;}
.gysw-op.ghost{background:transparent;color:var(--gy-accent,#1d9bf0);border:1px solid var(--gy-accent,#1d9bf0);}
@media (max-width:480px){.gysw-pre-row{grid-template-columns:1fr;}.gysw-pre-btn{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px;}.gysw-pre-btn small{flex-basis:100%;}}
`;
        document.head.appendChild(st);
    } catch (e) {}
})();
