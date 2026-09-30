/* ============================================================
   js/91 —— 白露的氛围和小玩法（全靠字卡，不接 API）
   ------------------------------------------------------------
   · 开场动画：「开场」字卡，一行写「主标题|副标题」
   · 聊天顶上一句格言：「格言」字卡
   · 随机来电：隔一阵掷一次骰子，TA 打过来（由头用「电话」字卡）
   · 心情手账：你每天记一笔；TA 每天也会自己记一笔（心情随机，备注从 TA 的字卡里挑）
   · 小玩法：每日三张塔罗、雷诺曼、抽签、抛硬币、聊天统计 + 词云，结果能发到聊天里
   概率都在 设置 → 🃏 字卡库 → 概率和节奏 里改。
   ============================================================ */
(function () {
    'use strict';
    if (window.__bailuPlayLoaded) return;
    window.__bailuPlayLoaded = true;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const cfg = () => (window.bailuCards && window.bailuCards.cfg) || {};
    const chars = () => (typeof myCharacters !== 'undefined' ? myCharacters : []).filter(c => c && !c.members);
    const charById = id => chars().find(c => String(c.id) === String(id));
    const draw = (k, ch, n) => (typeof window.bailuDraw === 'function' ? window.bailuDraw(k, ch, n) : []);
    const has = (k, ch) => typeof window.bailuHas === 'function' && window.bailuHas(k, ch);
    const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const toast = (a, b) => { try { showToast('', a, b || '', null, null, false); } catch (e) {} };
    // 按日期定下来的随机数：同一天打开几次，结果都一样
    function seeded(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
    const store = () => window.bailuCards && window.bailuCards.store;
    async function getKV(k, d) { try { const v = store() && await store().getItem(k); return v == null ? d : v; } catch (e) { return d; } }
    async function setKV(k, v) { try { if (store()) await store().setItem(k, v); } catch (e) {} }

    /* ================= 开场动画 ================= */
    // 小手机风格的开场：一块柔和的壁纸 + 状态栏，白露图标弹出来，名字和一句话像通知一样滑下来，最后像点开 App 一样放大淡出
    function intro(force) {
        if (!force && (!+cfg().introOn || !has('开场'))) return;
        if (!force && navigator.webdriver) return;   // 自动化测试里不挡屏幕
        if (document.getElementById('bailuIntro')) return;
        const line = draw('开场', null, 1)[0] || '白露|今天也在等你';
        const [t1, t2] = String(line).split(/[|｜]/);
        const d = new Date(), hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        const wk = '日一二三四五六'[d.getDay()];
        let phoneOn = document.body.classList.contains('gyphm'); try { phoneOn = phoneOn || localStorage.getItem('gyPhoneMode') === '1'; } catch (e) {}
        const framed = phoneOn && innerWidth >= 700;   // 电脑上开着小手机：开场也装在一台手机里
        const dark = document.body.classList.contains('pm-dark') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
        const ov = document.createElement('div'); ov.id = 'bailuIntro'; ov.className = (framed ? 'framed' : '') + (dark ? ' dark' : '');
        let dew = ''; for (let i = 0; i < 14; i++) dew += `<i style="left:${(Math.random() * 100).toFixed(1)}%;animation-delay:${(Math.random() * 2.4).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 2).toFixed(2)}s;transform:scale(${rnd(0.5, 1.1).toFixed(2)})"></i>`;
        const who = (() => { try { const c = chars()[0]; return c ? (c.remark || c.name) : ''; } catch (e) { return ''; } })();
        ov.innerHTML = `<div class="bi-ph"><div class="bi-wall"><b class="o1"></b><b class="o2"></b><b class="o3"></b></div><div class="bi-dew">${dew}</div>
            <div class="bi-sb"><span>${hh}</span><span class="r"><svg viewBox="0 0 18 12" width="17" height="11"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 26 12" width="24" height="11"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.2" y="2.2" width="16" height="7.6" rx="1.8"/><rect x="23.6" y="4" width="1.6" height="4" rx=".8" opacity=".45"/></svg></span></div>
            <div class="bi-date">${d.getMonth() + 1}月${d.getDate()}日 星期${wk}</div>
            <div class="bi-c"><div class="bi-ic"><img src="./icons/icon-192.png" alt=""></div><div class="bi-t">${esc(t1 || '白露')}</div><div class="bi-dots"><i></i><i></i><i></i></div></div>
            <div class="bi-nt"><div class="bi-nh"><img src="./icons/icon-192.png" alt=""><span>白露${who ? ' · ' + esc(who) : ''}</span><em>现在</em></div><div class="bi-s"></div></div>
            <div class="bi-hint">轻触进入</div><div class="bi-home"></div></div>`;
        document.body.appendChild(ov);
        const el = ov.querySelector('.bi-s'), target = String(t2 || ''), pool = '✦✧·°∘○◌'.split('');
        let iv = null, done = false;
        const close = () => { if (done) return; done = true; clearInterval(iv); ov.classList.add('out'); setTimeout(() => ov.remove(), 650); };
        ov.addEventListener('click', close);
        // 通知滑下来之后，那句话一个字一个字「显影」出来
        setTimeout(() => {
            ov.classList.add('nt-on');
            if (!target) { el.textContent = '今天也在等你'; return; }
            let step = 0;
            iv = setInterval(() => { step++; const k = Math.floor(step / 2); el.textContent = target.split('').map((ch, i) => i < k ? ch : (i < k + 3 ? pick(pool) : '')).join(''); if (k >= target.length) { clearInterval(iv); el.textContent = target; } }, 42);
        }, 1150);
        setTimeout(close, 3000 + target.length * 55);
    }
    window.bailuIntroPlay = () => intro(true);

    /* ================= 聊天顶上的格言 ================= */
    let mottoFor = null;
    function motto() {
        const area = document.getElementById('chatMessagesArea'), inp = document.getElementById('chatInputArea');
        if (!area) return;
        let el = document.getElementById('bailuMotto');
        const inChat = inp && inp.style.display !== 'none' && typeof currentChatSessionId !== 'undefined' && currentChatSessionId;
        if (!+cfg().mottoOn || !inChat) { if (el) el.style.display = 'none'; return; }
        const ch = charById(currentChatSessionId);
        if (!has('格言', ch)) { if (el) el.style.display = 'none'; return; }
        if (!el) { el = document.createElement('div'); el.id = 'bailuMotto'; el.title = '点一下换一句'; el.onclick = () => { el.textContent = draw('格言', ch, 1)[0] || ''; }; area.parentNode.insertBefore(el, area); }
        el.style.display = '';
        if (mottoFor !== currentChatSessionId) { mottoFor = currentChatSessionId; el.textContent = draw('格言', charById(currentChatSessionId), 1)[0] || ''; el.onclick = () => { el.textContent = draw('格言', charById(currentChatSessionId), 1)[0] || ''; }; }
    }

    /* ================= 随机来电 ================= */
    let callTimer = null;
    function scheduleCall() {
        clearTimeout(callTimer);
        const c = cfg(); const a = Math.max(1, +c.callMin || 15), b = Math.max(a, +c.callMax || 60);
        callTimer = setTimeout(tryCall, rnd(a, b) * 60000);
    }
    function tryCall() {
        try {
            const c = cfg();
            if (document.visibilityState === 'visible' && Math.random() * 100 < (+c.callP || 0) && typeof window.gyCallRing === 'function') {
                const cs = chars().filter(x => (typeof globalChats !== 'undefined' && (globalChats[x.id] || []).length));
                const ch = pick(cs.length ? cs : chars());
                if (ch) window.gyCallRing(ch, draw('电话', ch, 1)[0] || '');
            }
        } catch (e) {}
        scheduleCall();
    }
    window.bailuTestCall = tryCall;

    /* ================= 心情手账 ================= */
    const MOODS = [['开心', '😊', '#ffb74d'], ['甜', '🥰', '#f06292'], ['平静', '😌', '#81c784'], ['期待', '✨', '#ffd54f'], ['累', '😪', '#90a4ae'], ['想你', '🥺', '#ba68c8'],
        ['委屈', '😢', '#64b5f6'], ['烦', '😤', '#e57373'], ['emo', '🌧️', '#7986cb'], ['无聊', '😶', '#bdbdbd'], ['兴奋', '🤩', '#ff8a65'], ['撒娇', '🙈', '#f48fb1']];
    const moodOf = n => MOODS.find(m => m[0] === n) || ['', '·', '#ccc'];
    let MD = null;
    async function moodData() { if (!MD) MD = await getKV('mood', {}); return MD; }
    async function saveMood() { await setKV('mood', MD); }
    // TA 每天第一次打开时记一笔（有概率那天没记）
    async function taDaily() {
        const d = await moodData(), k = dayKey();
        let changed = false;
        chars().forEach(ch => {
            const day = d[k] = d[k] || { me: null, ta: {} };
            if (day.ta[ch.id] !== undefined) return;
            const cf = typeof window.bailuCfgFor === 'function' ? window.bailuCfgFor(ch) : cfg();
            if (Math.random() * 100 < (+cf.moodSkip || 0)) { day.ta[ch.id] = null; changed = true; return; }
            const note = draw('聊天', ch, 1 + Math.floor(Math.random() * 3)).join('　');
            day.ta[ch.id] = { m: pick(MOODS)[0], note, at: Date.now() };
            changed = true;
        });
        if (changed) await saveMood();
    }
    window.bailuMoodTa = taDaily;
    // 给字卡的「心情:开心 / 我心情:累」条件用：今天 TA 和你各自记的心情
    window.bailuMoodOf = function (ch) {
        const day = MD && MD[dayKey()]; if (!day) return { me: null, ta: null };
        const ta = ch && day.ta ? day.ta[ch.id] : null;
        return { me: day.me ? day.me.m : null, ta: ta ? ta.m : null };
    };

    /* ================= 🎙️ 语音库：打电话时 TA 用你上传的声音说话 ================= */
    const VS = (typeof localforage !== 'undefined' && localforage.createInstance) ? localforage.createInstance({ name: 'bailuVoice', storeName: 'clips' }) : null;
    let VL = null;   // [{id, name, chars:[], keys:[], size}]
    const urls = {};
    async function vList() { if (!VL) { try { VL = (VS && await VS.getItem('list')) || []; } catch (e) { VL = []; } } return VL; }
    async function vSave() { try { if (VS) await VS.setItem('list', VL); } catch (e) {} }
    async function vUrl(id) { if (urls[id]) return urls[id]; const b = VS && await VS.getItem('clip:' + id); if (!b) return null; return (urls[id] = URL.createObjectURL(b)); }
    const vFor = (L, ch) => L.filter(v => !v.chars.length || (ch && v.chars.includes(ch.name)));
    window.bailuVoice = async function (ch, text) {
        const L = vFor(await vList(), ch); if (!L.length) return null;
        const cf = typeof window.bailuCfgFor === 'function' ? window.bailuCfgFor(ch) : cfg();
        const t = String(text || '');
        const hit = L.filter(v => v.keys.some(k => k && t.includes(k)));
        let v = null;
        if (hit.length) v = pick(hit);
        else if (Math.random() * 100 < (+cf.voiceP || 0)) { const plain = L.filter(x => !x.keys.length); v = plain.length ? pick(plain) : null; }
        return v ? vUrl(v.id) : null;
    };
    window.bailuVoicePaint = async function () {
        const box = document.getElementById('bailuVoiceBox'); if (!box) return;
        const L = await vList(); const cs = chars();
        box.innerHTML = `<div class="bl-tip">打电话时 TA 说话，按概率放你上传的这些声音（不接 API 的「语音」）。可以给某段声音配关键词：TA 说到这个词就放这段。</div>
            <div class="bl-row"><select id="bailuVoiceChar"><option value="">谁都能用</option>${cs.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></div>
            <label class="bl-btn">上传语音（mp3 / m4a / wav / ogg，一次可以选好几个）<input type="file" multiple accept="audio/*" style="display:none" onchange="bailuVoiceUpload(this)"></label>
            <div class="bl-n">共 ${L.length} 段</div>
            ${L.map(v => `<div class="bl-card"><div class="t">🎙️ ${esc(v.name)}</div><div class="m"><span>${esc(v.chars.join('、') || '谁都能用')}</span>${v.keys.length ? `<span class="bl-key">🔑 ${esc(v.keys.join(' '))}</span>` : ''}
                <i onclick="bailuVoicePlay('${v.id}')">试听</i><i onclick="bailuVoiceEdit('${v.id}')">改角色 / 关键词</i><i class="del" onclick="bailuVoiceDel('${v.id}')">删除</i></div></div>`).join('')}`;
    };
    window.bailuVoiceUpload = async function (inp) {
        const files = [...(inp.files || [])]; inp.value = ''; if (!files.length) return;
        const who = (document.getElementById('bailuVoiceChar') || {}).value || '';
        const L = await vList();
        for (const f of files) {
            const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            try { await VS.setItem('clip:' + id, f); } catch (e) { toast('这段没存上', f.name); continue; }
            L.push({ id, name: f.name.replace(/\.[^.]+$/, ''), chars: who ? [who] : [], keys: [], size: f.size });
        }
        await vSave(); window.bailuVoicePaint(); toast(`🎙️ 加了 ${files.length} 段语音`);
    };
    window.bailuVoicePlay = async function (id) { const u = await vUrl(id); if (u) { try { new Audio(u).play(); } catch (e) {} } };
    window.bailuVoiceDel = async function (id) { VL = (await vList()).filter(v => v.id !== id); try { await VS.removeItem('clip:' + id); } catch (e) {} await vSave(); window.bailuVoicePaint(); };
    window.bailuVoiceEdit = async function (id) {
        const v = (await vList()).find(x => x.id === id); if (!v) return;
        const ask = (m, d) => typeof appPrompt === 'function' ? appPrompt(m, d) : Promise.resolve(prompt(m, d));
        const c = await ask('这段声音是谁的（角色名，多个用空格隔开；留空＝谁都能用）', v.chars.join(' ')); if (c === null || c === undefined) return;
        const k = await ask('关键词（TA 说的话里带着其中一个就放这段；留空＝按概率随机放）', v.keys.join(' ')); if (k === null || k === undefined) return;
        v.chars = String(c).split(/\s+/).filter(Boolean); v.keys = String(k).split(/[\s,，]+/).filter(Boolean);
        await vSave(); window.bailuVoicePaint();
    };

    /* ================= 占卜：塔罗 / 雷诺曼 ================= */
    const MAJ = [['愚者', '新的开始、随性、冒险', '冲动、犹豫不前'], ['魔术师', '行动力、心想事成', '分心、力不从心'], ['女祭司', '直觉、安静地等', '想太多、藏着心事'], ['皇后', '被照顾、丰盛', '过度依赖、倦怠'],
        ['皇帝', '稳定、有担当', '固执、控制欲'], ['教皇', '规矩、可靠的建议', '反叛、墨守成规'], ['恋人', '心意相通、选择', '摇摆、误会'], ['战车', '推进、赢下来', '急躁、方向乱'],
        ['力量', '温柔地坚持', '没底气、硬撑'], ['隐士', '独处、想清楚', '孤僻、封闭'], ['命运之轮', '转机、顺势', '时机不对、反复'], ['正义', '公平、说清楚', '偏颇、逃避责任'],
        ['倒吊人', '换个角度、暂停', '白白牺牲、拖延'], ['死神', '结束旧的、翻篇', '放不下'], ['节制', '平衡、慢慢来', '失衡、过头'], ['恶魔', '欲望、被牵着走', '挣脱、清醒'],
        ['高塔', '突变、打破', '躲过一劫、余震'], ['星星', '希望、治愈', '失望、没信心'], ['月亮', '不安、看不清', '迷雾散开'], ['太阳', '开心、坦荡', '小小的阴天'],
        ['审判', '回应、醒悟', '自责、犹豫'], ['世界', '圆满、一段结束', '差一点、未完成']];
    const SUITS = [['权杖', '行动和热情'], ['圣杯', '感情和心意'], ['宝剑', '想法和沟通'], ['星币', '现实和日常']];
    const RANKS = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '王后', '国王'];
    const DECK = MAJ.map(m => ({ n: m[0], up: m[1], rv: m[2] })).concat(SUITS.flatMap(s => RANKS.map((r, i) => ({ n: s[0] + r, up: `${s[1]}：${i < 3 ? '刚冒头' : i < 7 ? '在路上' : i < 10 ? '快到头了' : '由人来推动'}`, rv: `${s[1]}：卡住了、要缓一缓` }))));
    const LENO = [['骑士', '消息'], ['四叶草', '小幸运'], ['船', '远方'], ['房子', '家'], ['树', '健康、慢慢长'], ['云', '看不清'], ['蛇', '绕弯子'], ['棺材', '结束'], ['花束', '礼物、惊喜'],
        ['镰刀', '突然的决定'], ['鞭子', '争执、反复'], ['鸟', '聊天、叽叽喳喳'], ['孩子', '新的、单纯'], ['狐狸', '小心机'], ['熊', '力量、护着'], ['星星', '愿望'], ['鹳鸟', '变化'], ['狗', '朋友、忠诚'],
        ['塔', '独处、规矩'], ['花园', '人群、聚会'], ['山', '阻碍'], ['十字路口', '选择'], ['老鼠', '消耗'], ['心', '爱'], ['戒指', '承诺'], ['书', '秘密'], ['信', '文字、信'], ['男人', '他'], ['女人', '她'],
        ['百合', '安宁'], ['太阳', '顺利'], ['月亮', '情绪、被看见'], ['钥匙', '答案'], ['鱼', '收获'], ['锚', '稳定'], ['十字架', '负担']];
    function daily3() {
        const r = seeded('tarot' + dayKey()); const idx = [];
        while (idx.length < 3) { const i = Math.floor(r() * DECK.length); if (!idx.includes(i)) idx.push(i); }
        return idx.map((i, k) => ({ pos: ['过去', '现在', '未来'][k], c: DECK[i], rev: r() < 0.5 }));
    }

    /* ================= 小玩法面板 ================= */
    let TAB = 'mood', MONTH = null, WHO = null, LAST = '';
    const curSid = () => (typeof currentChatSessionId !== 'undefined' && currentChatSessionId) ? currentChatSessionId : '';
    window.bailuPlay = async function (tab) {
        if (tab) TAB = tab;
        await moodData(); await taDaily();
        if (!WHO) WHO = String(curSid() || (chars()[0] || {}).id || '');
        let ov = document.getElementById('bailuPlayOv'); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'bailuPlayOv'; ov.className = 'modal-overlay';
        ov.innerHTML = `<div class="modal-box bp-box"><div class="bp-hd"><b>🎲 小玩法</b><span onclick="document.getElementById('bailuPlayOv').remove()">✕</span></div>
            <div class="bp-tabs">${[['mood', '📔 心情手账'], ['tarot', '🔮 今日三牌'], ['leno', '🃏 雷诺曼'], ['lot', '🎋 抽签'], ['coin', '🪙 抛硬币'], ['stat', '📊 统计 · 词云']].map(t => `<span class="${TAB === t[0] ? 'on' : ''}" onclick="bailuPlay('${t[0]}')">${t[1]}</span>`).join('')}</div>
            <div class="bp-body" id="bailuPlayBody"></div></div>`;
        document.body.appendChild(ov); ov.style.display = 'flex';
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        paintTab();
    };
    function whoSel() {
        const cs = chars();
        return `<select class="bp-who" onchange="bailuPlayWho(this.value)">${cs.map(c => `<option value="${esc(c.id)}"${String(c.id) === String(WHO) ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    }
    window.bailuPlayWho = v => { WHO = v; paintTab(); };
    const sendBtn = txt => { LAST = txt; return `<button class="bp-send" onclick="bailuPlaySend()">发到和 ${esc((charById(WHO) || {}).name || 'TA')} 的聊天</button>`; };
    window.bailuPlaySend = function () {
        const sid = WHO; if (!sid || !LAST) return;
        try {
            if (!globalChats[sid]) globalChats[sid] = [];
            globalChats[sid].push({ sender: 'me', text: LAST, timestamp: Date.now(), readBy: [] });
            if (typeof saveAllData === 'function') saveAllData();
            if (String(curSid()) === String(sid) && typeof renderChatMessages === 'function') renderChatMessages();
            if (typeof triggerAIBatchReply === 'function') triggerAIBatchReply(sid, LAST);
            toast('发过去了', (charById(sid) || {}).name || '');
        } catch (e) { toast('没发出去', String(e && e.message || e)); }
    };
    function paintTab() {
        const b = document.getElementById('bailuPlayBody'); if (!b) return;
        const fn = { mood: tabMood, tarot: tabTarot, leno: tabLeno, lot: tabLot, coin: tabCoin, stat: tabStat }[TAB] || tabMood;
        b.innerHTML = fn();
        if (TAB === 'stat') setTimeout(layoutCloud, 30);
    }
    // ---- 心情手账 ----
    function tabMood() {
        const now = new Date(); if (!MONTH) MONTH = [now.getFullYear(), now.getMonth()];
        const [y, m] = MONTH, first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        const ch = charById(WHO);
        let cells = ''; for (let i = 0; i < first; i++) cells += '<i></i>';
        const cnt = { me: {}, ta: {} };
        for (let d = 1; d <= days; d++) {
            const k = dayKey(new Date(y, m, d)), day = MD[k] || {};
            const me = day.me, ta = ch && day.ta ? day.ta[ch.id] : null;
            if (me) cnt.me[me.m] = (cnt.me[me.m] || 0) + 1; if (ta) cnt.ta[ta.m] = (cnt.ta[ta.m] || 0) + 1;
            cells += `<span class="bp-day${k === dayKey() ? ' today' : ''}" onclick="bailuMoodDay('${k}')"><em>${d}</em><b>${me ? moodOf(me.m)[1] : ''}</b><u>${ta ? moodOf(ta.m)[1] : ''}</u></span>`;
        }
        const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => moodOf(n)[1] + n + '×' + c).join('　') || '还没有';
        return `<div class="bp-row">${whoSel()}<span class="bp-nav"><i onclick="bailuMoodMonth(-1)">‹</i>${y} 年 ${m + 1} 月<i onclick="bailuMoodMonth(1)">›</i></span></div>
            <div class="bp-leg">上面是你，下面是 ${esc(ch ? ch.name : 'TA')}。点日子记一笔、看 TA 那天写了什么。</div>
            <div class="bp-cal">${['日', '一', '二', '三', '四', '五', '六'].map(w => `<i class="w">${w}</i>`).join('')}${cells}</div>
            <div class="bp-stat">你这个月：${top(cnt.me)}<br>${esc(ch ? ch.name : 'TA')}这个月：${top(cnt.ta)}</div>
            <div id="bailuMoodDay"></div>`;
    }
    window.bailuMoodMonth = d => { let [y, m] = MONTH; m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } MONTH = [y, m]; paintTab(); };
    window.bailuMoodDay = function (k) {
        const day = MD[k] || { me: null, ta: {} }, ch = charById(WHO), ta = ch && day.ta ? day.ta[ch.id] : null, me = day.me || {};
        const box = document.getElementById('bailuMoodDay'); if (!box) return;
        box.innerHTML = `<div class="bp-dayd"><div class="bp-dh">${k}</div>
            <div class="bp-ta">${esc(ch ? ch.name : 'TA')}：${ta ? `${moodOf(ta.m)[1]} ${esc(ta.m)}<div class="bp-note">${esc(ta.note || '')}</div>` : '<span class="bp-mute">这天没记</span>'}</div>
            <div class="bp-me"><div>我：</div><div class="bp-moods">${MOODS.map(mm => `<span class="${me.m === mm[0] ? 'on' : ''}" style="--mc:${mm[2]}" onclick="bailuMoodSet('${k}','${mm[0]}')">${mm[1]} ${mm[0]}</span>`).join('')}</div>
            <textarea id="bailuMoodNote" rows="2" placeholder="写两句今天">${esc(me.note || '')}</textarea>
            <div class="bp-row"><button class="bp-send" onclick="bailuMoodSave('${k}')">存下来</button>${day.me ? `<button class="bp-lite" onclick="bailuMoodDel('${k}')">清掉我这天</button>` : ''}</div></div></div>`;
    };
    let PEND = {};
    window.bailuMoodSet = (k, m) => { PEND[k] = m; document.querySelectorAll('#bailuMoodDay .bp-moods span').forEach(s => s.classList.toggle('on', s.textContent.trim().endsWith(m))); };
    window.bailuMoodSave = async function (k) {
        const day = MD[k] = MD[k] || { me: null, ta: {} };
        const m = PEND[k] || (day.me && day.me.m); if (!m) { toast('先点一个心情'); return; }
        day.me = { m, note: (document.getElementById('bailuMoodNote') || {}).value || '', at: Date.now() };
        await saveMood(); paintTab(); toast('记下了 ' + moodOf(m)[1]);
    };
    window.bailuMoodDel = async function (k) { if (MD[k]) MD[k].me = null; await saveMood(); paintTab(); };
    // ---- 今日三牌 ----
    function tabTarot() {
        const cs = daily3();
        const txt = '今天的三张牌：' + cs.map(x => `${x.pos}·${x.c.n}（${x.rev ? '逆' : '正'}）`).join('，');
        return `<div class="bp-leg">每天三张（过去 · 现在 · 未来），同一天打开还是这三张。</div><div class="bp-cards">${cs.map((x, i) => `<div class="bp-tc" style="animation-delay:${i * 0.15}s"><div class="p">${x.pos}</div><div class="n${x.rev ? ' rv' : ''}">${esc(x.c.n)}</div><div class="o">${x.rev ? '逆位' : '正位'}</div><div class="m">${esc(x.rev ? x.c.rv : x.c.up)}</div></div>`).join('')}</div>
            <div class="bp-row">${whoSel()}${sendBtn(txt)}</div>`;
    }
    // ---- 雷诺曼 ----
    let LENO_DRAW = null;
    function tabLeno() {
        const body = LENO_DRAW ? `<div class="bp-cards">${LENO_DRAW.map(c => `<div class="bp-tc"><div class="n">${esc(c[0])}</div><div class="m">${esc(c[1])}</div></div>`).join('')}</div>
            <div class="bp-read">${LENO_DRAW.length === 1 ? `这张牌想说的是「${esc(LENO_DRAW[0][1])}」。` : `从「${esc(LENO_DRAW[0][1])}」开始，经过「${esc(LENO_DRAW[1][1])}」，落在「${esc(LENO_DRAW[2][1])}」。`}</div>
            <div class="bp-row">${whoSel()}${sendBtn('我抽了雷诺曼：' + LENO_DRAW.map(c => c[0]).join(' → '))}</div>` : '<div class="bp-leg">36 张雷诺曼，抽一张看今天，抽三张看一件事。</div>';
        return `<div class="bp-row"><button class="bp-lite" onclick="bailuLeno(1)">抽 1 张</button><button class="bp-lite" onclick="bailuLeno(3)">抽 3 张</button></div>${body}`;
    }
    window.bailuLeno = n => { const a = LENO.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } LENO_DRAW = a.slice(0, n); paintTab(); };
    // ---- 抽签 ----
    let LOT = '吃火锅\n吃烧烤\n吃面\n在家做饭', LOT_R = '';
    function tabLot() {
        return `<div class="bp-leg">一行一个选项，交给运气。</div><textarea id="bailuLotTa" rows="5">${esc(LOT)}</textarea>
            <div class="bp-row"><button class="bp-send" onclick="bailuLot()">抽！</button></div><div class="bp-lot" id="bailuLotR">${esc(LOT_R)}</div>
            ${LOT_R ? `<div class="bp-row">${whoSel()}${sendBtn('我抽签抽到了：' + LOT_R)}</div>` : ''}`;
    }
    window.bailuLot = function () {
        LOT = (document.getElementById('bailuLotTa') || {}).value || ''; const opts = LOT.split('\n').map(s => s.trim()).filter(Boolean); if (!opts.length) return;
        const el = document.getElementById('bailuLotR'); const total = 16 + Math.floor(Math.random() * 8); const res = pick(opts); let i = 0;
        const tick = () => {
            i++; el.textContent = i >= total - 2 ? res : pick(opts); el.classList.toggle('flash', i % 2 === 0);
            if (i < total) setTimeout(tick, i < 8 ? 80 : i < 14 ? 130 : 250); else { LOT_R = res; paintTab(); }
        };
        tick();
    };
    // ---- 抛硬币 ----
    let COIN = '';
    function tabCoin() {
        return `<div class="bp-coinw"><div class="bp-coin" id="bailuCoin">${COIN === '反面' ? '反' : '正'}</div></div><div class="bp-row"><button class="bp-send" onclick="bailuCoin()">抛一下</button></div>
            ${COIN ? `<div class="bp-lot">${COIN}</div><div class="bp-row">${whoSel()}${sendBtn('我抛了个硬币：' + COIN)}</div>` : ''}`;
    }
    window.bailuCoin = function () {
        const c = document.getElementById('bailuCoin'); const r = Math.random() < 0.5 ? '正面' : '反面';
        c.classList.remove('spin'); void c.offsetWidth; c.classList.add('spin');
        setTimeout(() => { COIN = r; paintTab(); }, 1600);
    };
    // ---- 统计 · 词云 ----
    const STOP = new Set('的了是我你他她它们在就都和也还又吗呢吧啊嗯哦呀嘛这那个一不有没要会到说去来上下着过把被让给对很太好么什怎样为'.split(''));
    function tabStat() {
        const ch = charById(WHO); const arr = (ch && typeof globalChats !== 'undefined' && globalChats[ch.id]) || [];
        const txt = m => String(m.text || '').replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]/g, '');
        const me = arr.filter(m => m.sender === 'me'), ta = arr.filter(m => String(m.sender) === String(ch && ch.id));
        const first = arr[0], last = arr[arr.length - 1];
        const fmt = t => t ? new Date(t).toLocaleString() : '—';
        const top = L => { const c = {}; L.forEach(m => { const t = txt(m).trim(); if (t && t.length <= 30) c[t] = (c[t] || 0) + 1; }); return Object.entries(c).filter(x => x[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 5); };
        const words = {}; arr.forEach(m => { const t = txt(m);
            (t.match(/[a-zA-Z]{3,}/g) || []).forEach(w => { w = w.toLowerCase(); words[w] = (words[w] || 0) + 1; });
            const zh = t.replace(/[^一-龥]+/g, ' ');
            zh.split(' ').forEach(seg => { for (let n = 4; n >= 2; n--) for (let i = 0; i + n <= seg.length; i++) { const w = seg.slice(i, i + n); if (STOP.has(w[0]) || STOP.has(w[w.length - 1])) continue; words[w] = (words[w] || 0) + (n === 4 ? 2.4 : n === 3 ? 1.8 : 1); } });
        });
        let W = Object.entries(words).filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1]);
        const kept = []; W.forEach(([w, v]) => { if (kept.length < 60 && !kept.some(([k]) => k.includes(w) && k !== w)) kept.push([w, v]); });
        const mx = Math.max(1, ...kept.map(x => x[1])), mn = Math.min(mx, ...kept.map(x => x[1]));
        const size = v => 11 + (Math.log(v) - Math.log(mn)) / Math.max(0.01, Math.log(mx) - Math.log(mn)) * 43;
        const cols = ['#1d9bf0', '#f06292', '#ba68c8', '#4db6ac', '#ffb74d', '#7986cb', '#e57373', '#81c784'];
        const cloud = kept.map(([w, v], i) => `<span style="font-size:${size(v).toFixed(1)}px;color:${cols[i % cols.length]};opacity:${(1 - i / (kept.length * 1.6)).toFixed(2)}${i > 5 && i % 6 === 0 ? ';writing-mode:vertical-rl' : ''}">${esc(w)}</span>`).join('');
        const li = L => L.length ? L.map(([t, n]) => `<li>${esc(t)} <em>×${n}</em></li>`).join('') : '<li class="bp-mute">还没有重复说过的</li>';
        return `<div class="bp-row">${whoSel()}</div>
            <div class="bp-nums"><div><b>${arr.length}</b>条消息</div><div><b>${me.length}</b>你说的</div><div><b>${ta.length}</b>${esc(ch ? ch.name : 'TA')}说的</div></div>
            <div class="bp-leg">第一次聊：${fmt(first && first.timestamp)}　最近一次：${fmt(last && last.timestamp)}</div>
            <div class="bp-two"><div><div class="bp-dh">你最常说</div><ol>${li(top(me))}</ol></div><div><div class="bp-dh">${esc(ch ? ch.name : 'TA')}最常说</div><ol>${li(top(ta))}</ol></div></div>
            <div class="bp-dh">词云</div><div class="bp-cloud" id="bailuCloud">${cloud || '<span class="bp-mute">聊得再多一点就有了</span>'}</div>`;
    }
    function layoutCloud() { /* 用 flex-wrap 自然排开；这里只留个钩子，以后想换成真正的不重叠排布再说 */ }

    /* ================= 🤖 自主行动（随机决定） ================= */
    // 谷雨那套自主模式原样保留（定时看一眼、到点的角色拿一次主意、做那件事），
    // 白露里「拿主意」这一步不问模型，而是按这里的权重掷骰子：做不做、做哪件、过多久再想。
    const acts = () => (typeof GY_AUTONOMY_ACTIONS !== 'undefined' ? GY_AUTONOMY_ACTIONS : []).filter(a => a && a.key && a.key !== 'nothing');
    const autoOn = () => { try { return isAutoOn('charAutonomy'); } catch (e) { return false; } };
    const fmtAt = t => { if (!t) return '还没排'; const m = Math.round((t - Date.now()) / 60000); return m <= 0 ? '马上' : m < 60 ? m + ' 分钟后' : Math.round(m / 6) / 10 + ' 小时后'; };
    window.bailuAuto = function () {
        let ov = document.getElementById('bailuAutoOv'); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'bailuAutoOv'; ov.className = 'modal-overlay';
        ov.innerHTML = `<div class="modal-box bp-box"><div class="bp-hd"><b>🤖 自主行动</b><span onclick="document.getElementById('bailuAutoOv').remove()">✕</span></div><div id="bailuAutoBody"></div></div>`;
        document.body.appendChild(ov); ov.style.display = 'flex';
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        paintAuto();
    };
    function paintAuto() {
        const b = document.getElementById('bailuAutoBody'); if (!b) return;
        const c = cfg(), W = c.actW || {};
        const on = autoOn();
        const log = [];
        chars().forEach(ch => (ch.autonomyLog || []).slice(-10).forEach(l => log.push(Object.assign({ who: ch.name }, l))));
        log.sort((a, b) => (b.at || 0) - (a.at || 0));
        const num = (k, lab, unit) => `<label class="ba-n"><span>${lab}</span><input type="number" min="0" value="${esc(c[k])}" onchange="bailuCfg('${k}',this.value)"><em>${unit}</em></label>`;
        b.innerHTML = `<div class="bp-leg">打开之后，切到「自己决定」的角色会隔一阵停下来掷一次骰子：做不做、做哪一件、过多久再想，全按下面的数随机来。不用 API，不花钱。</div>
            <label class="ba-sw"><input type="checkbox" ${on ? 'checked' : ''} onchange="bailuAutoSwitch(this.checked)"> <b>总开关</b><span>${on ? '开着' : '关着'}</span></label>
            <div class="bp-dh">谁自己决定</div>
            ${chars().map(ch => `<div class="ba-ch"><label><input type="checkbox" ${ch.actMode === 'auto' ? 'checked' : ''} onchange="bailuAutoChar('${esc(ch.id)}',this.checked)"> ${esc(ch.name)}</label>
                <span class="bp-mute">${ch.actMode === 'auto' ? '下次想想：' + fmtAt(ch.nextAutonomyAt) : '按固定频率'}</span>
                ${ch.actMode === 'auto' ? `<button class="bp-lite" onclick="bailuAutoNow('${esc(ch.id)}')">现在动一下</button>` : ''}</div>`).join('') || '<div class="bp-mute">还没有角色</div>'}
            <div id="bailuAutoRes" class="bp-read"></div>
            <div class="bp-dh">骰子</div>
            ${num('activity', '这次「做点什么」的概率', '%')}${num('nextMin', '最快多久再想一次', '分钟')}${num('nextMax', '最慢多久再想一次', '分钟')}
            <div class="bp-dh">每件事的权重 <span class="bp-mute" style="font-weight:normal">（数越大越常做，0＝不做）</span></div>
            <div class="ba-ws">${acts().map(a => `<label class="ba-w"><span>${esc(a.label)}</span><input type="number" min="0" step="0.5" value="${W[a.key] == null ? 1 : W[a.key]}" onchange="bailuActW('${a.key}',this.value)"></label>`).join('')}</div>
            <div class="bp-dh">最近做了什么</div>
            <ol class="ba-log">${log.slice(0, 12).map(l => `<li><em>${new Date(l.at || 0).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</em> ${esc(l.who)}：${esc(l.result || l.label || '')}</li>`).join('') || '<li class="bp-mute">还没有</li>'}</ol>`;
    }
    window.bailuAutoSwitch = function (on) { try { setAutoFeature('charAutonomy', !!on, true); } catch (e) {} try { saveAllData(); } catch (e) {} paintAuto(); };
    window.bailuAutoChar = function (id, on) {
        const ch = charById(id); if (!ch) return;
        ch.actMode = on ? 'auto' : 'fixed';
        if (on && !ch.nextAutonomyAt) { const c = cfg(); ch.nextAutonomyAt = Date.now() + rnd(+c.nextMin || 30, +c.nextMax || 360) * 60000; }
        try { saveAllData(); } catch (e) {} paintAuto();
    };
    window.bailuActW = async function (k, v) { const c = cfg(); c.actW = Object.assign({}, c.actW || {}); c.actW[k] = Math.max(0, parseFloat(v) || 0); try { await window.bailuCards.save(); } catch (e) {} };
    window.bailuAutoNow = async function (id) {
        const ch = charById(id); const box = document.getElementById('bailuAutoRes'); if (!ch) return;
        if (box) box.textContent = ch.name + ' 在想……';
        let r = null; window.__bailuNow = true; try { r = await runAutonomyTurn(ch, true); } catch (e) { r = { err: String(e && e.message || e) }; } finally { window.__bailuNow = false; }
        const es = (r && r.entries) || (r && r.entry ? [r.entry] : []);
        const txt = r && r.blocked ? '这次没动（' + ({ busy: '上一轮还没做完', noaction: '现在没有能做的事', mode: '没切到自己决定' }[r.blocked] || r.blocked) + '）'
            : es.length ? es.map(e => e.result || e.label).join('；') : (r && r.err ? '出错了：' + r.err : (r && r.queued ? '打算待会儿再做：' + ((r.entry && r.entry.reason) || '') : '想了想，什么都没做'));
        paintAuto();
        const b2 = document.getElementById('bailuAutoRes'); if (b2) b2.textContent = ch.name + '：' + txt;
    };

    /* ================= 入口 ================= */
    function entries() {
        const setIdx = document.querySelector('#setIndex .set-menu');
        if (setIdx && !document.getElementById('bailuPlayEntry')) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.id = 'bailuPlayEntry'; b.setAttribute('data-core', '1');
            b.onclick = () => window.bailuPlay();
            b.innerHTML = '<span class="set-entry-ico">🎲</span><span class="set-entry-main"><span class="set-entry-title">小玩法</span><span class="set-entry-desc">心情手账、今日三牌、雷诺曼、抽签、抛硬币、聊天统计和词云</span></span><span class="set-entry-arrow">›</span>';
            const after = document.getElementById('bailuEntry');
            if (after && after.parentNode) after.parentNode.insertBefore(b, after.nextSibling); else setIdx.insertBefore(b, setIdx.firstChild);
        }
        const pe = document.getElementById('bailuPlayEntry');
        if (pe && !document.getElementById('bailuAutoEntry')) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'set-entry'; b.id = 'bailuAutoEntry'; b.setAttribute('data-core', '1');
            b.onclick = () => window.bailuAuto();
            b.innerHTML = '<span class="set-entry-ico">🤖</span><span class="set-entry-main"><span class="set-entry-title">自主行动</span><span class="set-entry-desc">让 TA 自己决定做什么：做不做、做哪件、多久再想，全随机</span></span><span class="set-entry-arrow">›</span>';
            pe.parentNode.insertBefore(b, pe.nextSibling);
        }
        const row = document.getElementById('chatToolIconsRow');
        if (row && !document.getElementById('bailuPlayBtn')) {
            const b = document.createElement('button'); b.className = 'btn-edit-small'; b.id = 'bailuPlayBtn'; b.title = '小玩法'; b.textContent = '🎲';
            b.onclick = () => { WHO = String(curSid() || WHO || ''); window.bailuPlay(); };
            row.appendChild(b);
        }
        motto();
    }

    const CSS = `
#bailuIntro{position:fixed;inset:0;z-index:200000;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .6s ease,backdrop-filter .6s;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif;--bt:#1d1d1f;--bs:#86868b;--bg1:#eef3fb;--bg2:#f8f4fb;--gl:rgba(255,255,255,.62);--glb:rgba(255,255,255,.7)}
#bailuIntro.dark{--bt:#f5f5f7;--bs:#98989d;--bg1:#0e1320;--bg2:#171523;--gl:rgba(44,44,48,.62);--glb:rgba(255,255,255,.08)}
#bailuIntro.framed{background:rgba(10,12,20,.28);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
#bailuIntro .bi-ph{position:relative;width:100%;height:100%;overflow:hidden;color:var(--bt);background:linear-gradient(165deg,var(--bg1),var(--bg2))}
#bailuIntro.framed .bi-ph{width:min(390px,46vh);height:min(844px,calc(100vh - 48px));aspect-ratio:390/844;border-radius:54px;box-shadow:0 0 0 11px #1b1b1d,0 0 0 13px #3a3a3e,0 40px 90px rgba(0,0,0,.45);animation:biPh .7s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes biPh{from{transform:scale(.94) translateY(20px);opacity:0}to{transform:none;opacity:1}}
#bailuIntro .bi-wall b{position:absolute;border-radius:50%;filter:blur(60px);opacity:.75;animation:biFloat 9s ease-in-out infinite alternate}
#bailuIntro .bi-wall .o1{width:70%;height:42%;left:-18%;top:-6%;background:#b9d3f7}
#bailuIntro .bi-wall .o2{width:62%;height:40%;right:-20%;top:30%;background:#e7d3f3;animation-delay:-3s}
#bailuIntro .bi-wall .o3{width:80%;height:40%;left:6%;bottom:-16%;background:#cfe7e2;animation-delay:-6s}
#bailuIntro.dark .bi-wall b{opacity:.35}
@keyframes biFloat{from{transform:translate(0,0) scale(1)}to{transform:translate(6%,4%) scale(1.12)}}
#bailuIntro .bi-dew i{position:absolute;top:-12px;width:6px;height:9px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(160,195,240,.55));box-shadow:0 0 6px rgba(150,190,240,.5);animation:biDew linear infinite;opacity:0}
@keyframes biDew{0%{transform:translateY(0);opacity:0}12%{opacity:.9}100%{transform:translateY(105vh);opacity:0}}
#bailuIntro .bi-sb{position:absolute;left:0;right:0;top:0;height:50px;padding:0 30px;display:flex;align-items:center;justify-content:space-between;font-size:15px;font-weight:600;letter-spacing:.02em}
#bailuIntro .bi-sb .r{display:flex;gap:6px;align-items:center}#bailuIntro .bi-sb svg{fill:currentColor}
#bailuIntro .bi-date{position:absolute;left:0;right:0;top:64px;text-align:center;font-size:15px;color:var(--bs);font-weight:500;animation:biFade .8s .1s both}
#bailuIntro .bi-c{position:absolute;left:0;right:0;top:34%;display:flex;flex-direction:column;align-items:center;gap:14px}
#bailuIntro .bi-ic{width:96px;height:96px;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 18px 40px rgba(40,80,140,.22),0 2px 6px rgba(0,0,0,.06);animation:biPop .9s cubic-bezier(.34,1.56,.64,1) .15s both}
#bailuIntro .bi-ic img{width:100%;height:100%;display:block}
#bailuIntro .bi-t{font-size:30px;font-weight:600;letter-spacing:.14em;animation:biUp .8s cubic-bezier(.2,.9,.3,1) .45s both}
#bailuIntro .bi-dots{display:flex;gap:6px;animation:biFade .5s .7s both}#bailuIntro .bi-dots i{width:6px;height:6px;border-radius:50%;background:var(--bs);animation:biDot 1.2s infinite}#bailuIntro .bi-dots i:nth-child(2){animation-delay:.18s}#bailuIntro .bi-dots i:nth-child(3){animation-delay:.36s}
#bailuIntro.nt-on .bi-dots{opacity:0;transition:opacity .3s}
@keyframes biDot{0%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
#bailuIntro .bi-nt{position:absolute;left:14px;right:14px;top:92px;max-width:400px;margin:0 auto;padding:11px 14px 13px;border-radius:22px;background:var(--gl);border:1px solid var(--glb);backdrop-filter:blur(24px) saturate(1.6);-webkit-backdrop-filter:blur(24px) saturate(1.6);box-shadow:0 10px 30px rgba(0,0,0,.08);transform:translateY(-160%);opacity:0;transition:transform .7s cubic-bezier(.2,1.1,.3,1),opacity .4s}
#bailuIntro.nt-on .bi-nt{transform:none;opacity:1}
#bailuIntro .bi-nh{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--bs);margin-bottom:5px}#bailuIntro .bi-nh img{width:18px;height:18px;border-radius:5px}#bailuIntro .bi-nh em{font-style:normal;margin-left:auto}
#bailuIntro .bi-s{font-size:15.5px;line-height:1.55;min-height:1.55em;letter-spacing:.03em;word-break:break-all}
#bailuIntro .bi-hint{position:absolute;left:0;right:0;bottom:44px;text-align:center;font-size:13px;color:var(--bs);animation:biFade 1s 1.4s both,biBreath 2.4s 2.4s ease-in-out infinite}
#bailuIntro .bi-home{position:absolute;left:50%;bottom:12px;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:var(--bt);opacity:.8}
@keyframes biPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes biUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes biFade{from{opacity:0}to{opacity:1}}
@keyframes biBreath{0%,100%{opacity:.45}50%{opacity:1}}
#bailuIntro.out{opacity:0;pointer-events:none}#bailuIntro.out .bi-ph{transform:scale(1.08);filter:blur(4px);transition:transform .6s cubic-bezier(.4,0,.2,1),filter .6s}
#bailuMotto{text-align:center;font-size:12px;color:#8899a6;padding:5px 12px;letter-spacing:.06em;cursor:pointer;font-family:"Noto Serif SC",serif;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bailuPlayOv{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}
#bailuPlayOv .bp-box{background:#fff;color:#111;border-radius:18px;width:min(620px,100%);max-height:90vh;overflow:auto;padding:16px 18px;box-sizing:border-box;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.bp-hd{display:flex;justify-content:space-between;align-items:center;font-size:18px;margin-bottom:8px}.bp-hd span{cursor:pointer;color:#888}
.bp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.bp-tabs span{padding:5px 11px;border-radius:999px;background:#f2f2f4;font-size:13px;cursor:pointer}.bp-tabs span.on{background:#111;color:#fff}
.bp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}.bp-who{padding:7px 10px;border-radius:10px;border:1px solid #ddd;background:#fafafa}
.bp-nav{margin-left:auto;display:flex;gap:10px;align-items:center;font-size:14px}.bp-nav i{font-style:normal;cursor:pointer;padding:2px 8px;border-radius:8px;background:#f2f2f4}
.bp-leg{font-size:12.5px;color:#888;line-height:1.6;margin:4px 0 8px}.bp-mute{color:#aaa}
.bp-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.bp-cal i.w{font-style:normal;text-align:center;font-size:11px;color:#aaa}
.bp-day{border-radius:10px;background:#f7f7f9;min-height:52px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:3px 0;cursor:pointer;font-size:15px}
.bp-day em{font-style:normal;font-size:10.5px;color:#999}.bp-day b,.bp-day u{text-decoration:none;font-weight:normal;min-height:18px;line-height:18px}.bp-day u{opacity:.75}.bp-day.today{outline:2px solid #1d9bf0}
.bp-stat{font-size:12.5px;color:#666;margin:10px 0;line-height:1.8}
.bp-dayd{border-top:1px solid #eee;margin-top:10px;padding-top:10px}.bp-dh{font-weight:600;font-size:13.5px;margin:6px 0}
.bp-ta{background:#faf6ff;border-radius:12px;padding:8px 10px;font-size:14px;margin-bottom:8px}.bp-note{color:#666;font-size:13px;margin-top:4px;line-height:1.6}
.bp-moods{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.bp-moods span{padding:4px 9px;border-radius:999px;background:#f2f2f4;font-size:12.5px;cursor:pointer}.bp-moods span.on{background:var(--mc);color:#fff}
#bailuMoodNote,#bailuLotTa{width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:12px;padding:8px 10px;font-family:inherit;font-size:14px;resize:vertical}
.bp-send{padding:8px 14px;border-radius:12px;border:none;background:#111;color:#fff;cursor:pointer;font-family:inherit;font-size:13.5px}
.bp-lite{padding:8px 14px;border-radius:12px;border:none;background:#f2f2f4;cursor:pointer;font-family:inherit;font-size:13.5px}
.bp-cards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:10px 0}
.bp-tc{flex:1 1 0;min-width:96px;max-width:170px;border-radius:14px;padding:14px 10px;text-align:center;background:linear-gradient(160deg,#fdfbff,#f1ecff);border:1px solid #e6defa;animation:bpFlip .7s cubic-bezier(.34,1.56,.64,1) both}
.bp-tc .p{font-size:11.5px;color:#9a8cc2}.bp-tc .n{font-size:20px;margin:6px 0;font-family:"Noto Serif SC",serif}.bp-tc .n.rv{transform:rotate(180deg)}.bp-tc .o{font-size:11.5px;color:#999}.bp-tc .m{font-size:12.5px;color:#555;margin-top:6px;line-height:1.55}
@keyframes bpFlip{from{opacity:0;transform:rotateY(90deg)}to{opacity:1;transform:none}}
.bp-read{font-size:13.5px;color:#555;text-align:center;margin:6px 0}
.bp-lot{text-align:center;font-size:26px;margin:14px 0;font-family:"Noto Serif SC",serif;min-height:34px}.bp-lot.flash{color:#f06292}
.bp-coinw{display:flex;justify-content:center;perspective:600px;margin:14px 0}
.bp-coin{width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#e0b64a 60%,#b98b1e);display:flex;align-items:center;justify-content:center;font-size:30px;color:#7a5a0c;box-shadow:0 6px 18px rgba(0,0,0,.18);font-family:"Noto Serif SC",serif}
.bp-coin.spin{animation:bpCoin 1.6s cubic-bezier(.2,.8,.3,1)}
@keyframes bpCoin{0%{transform:rotateY(0) translateY(0)}40%{transform:rotateY(900deg) translateY(-50px)}100%{transform:rotateY(1800deg) translateY(0)}}
.bp-nums{display:flex;gap:10px;margin:8px 0}.bp-nums div{flex:1;background:#f7f7f9;border-radius:12px;padding:10px;text-align:center;font-size:12px;color:#888}.bp-nums b{display:block;font-size:22px;color:#111}
.bp-two{display:flex;gap:12px}.bp-two>div{flex:1}.bp-two ol{padding-left:18px;margin:4px 0;font-size:13px;line-height:1.8}.bp-two em{color:#999;font-style:normal}
.ba-sw{display:flex;gap:8px;align-items:center;padding:10px 12px;background:#f7f7f9;border-radius:12px;margin:6px 0;cursor:pointer}.ba-sw span{margin-left:auto;color:#888;font-size:12.5px}
.ba-ch{display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid #f2f2f2;flex-wrap:wrap}.ba-ch label{min-width:90px;cursor:pointer}.ba-ch .bp-mute{font-size:12px;flex:1}.ba-ch .bp-lite{padding:5px 10px;font-size:12.5px}
.ba-n{display:flex;align-items:center;gap:8px;font-size:13.5px;margin:4px 0}.ba-n span{flex:1}.ba-n input,.ba-w input{width:70px;padding:5px 8px;border-radius:8px;border:1px solid #ddd}.ba-n em{font-style:normal;color:#888;width:34px}
.ba-ws{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:4px 14px}.ba-w{display:flex;align-items:center;gap:8px;font-size:13px}.ba-w span{flex:1}
.ba-log{padding-left:18px;font-size:12.5px;line-height:1.8;color:#444}.ba-log em{color:#999;font-style:normal}
.bp-cloud{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;justify-content:center;padding:10px;background:#fafafa;border-radius:14px;min-height:80px;line-height:1.2}
`;
    function boot() {
        if (!document.getElementById('bailuPlayCss')) { const st = document.createElement('style'); st.id = 'bailuPlayCss'; st.textContent = CSS; document.head.appendChild(st); }
        const go = () => {
            // 白露里自主行动不花钱：总开关默认打开（你关过就尊重你的选择）
            const defOn = () => { try { if (!window.__guyuBooted) return setTimeout(defOn, 1000); if (typeof autoFeatureSwitches !== 'undefined' && autoFeatureSwitches && autoFeatureSwitches.charAutonomy === undefined && !localStorage.getItem('bailuAutoDefaulted')) { setAutoFeature('charAutonomy', true, true); localStorage.setItem('bailuAutoDefaulted', '1'); try { saveAllData(); } catch (e) {} } } catch (e) {} };
            defOn();
            intro();
            entries(); setInterval(entries, 2000);
            scheduleCall();
            moodData().catch(() => {});
            setTimeout(() => { moodData().then(taDaily).catch(() => {}); }, 4000);
        };
        (window.bailuCards && window.bailuCards.ready ? window.bailuCards.ready : Promise.resolve()).then(go, go);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
