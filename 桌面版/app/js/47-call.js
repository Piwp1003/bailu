/* ============================================================
   js/47 —— 📞 打电话
   ------------------------------------------------------------
   入口：聊天框 ⋮ 里那颗 📞。**点了就打，不受任何开关拦**。
   设置里那个开关只管"要不要显示这颗按钮"，默认开。

   三档，自己在通话界面右上角 ⚙️ 里切（也可以在 设置 → 互动与描写 里切）：
     ① 纯文字（默认）—— 界面是通话的样子，内容还是打字。
        但模型知道"现在是在讲电话"：句子更短、更口语、会有"喂/嗯/哎"，
        会提环境音，不会写动作描写和长段心理活动。不用任何额外接口。
     ② 加朗读 —— TA 的每句话用 TTS 念出来。可以用浏览器自带的合成音（免费、机器味重），
        也可以填一个 OpenAI 格式的 /v1/audio/speech 接口（更像人）。
     ③ 我也说话 —— 再加上浏览器的麦克风识别，你对着说就转成文字发过去。
        ⚠️ 识别准不准全看浏览器；打包成 APK 之后多半用不了，这时会自动退回打字。

   通话内容**会进聊天记录**（前后各加一条「📞 通话开始/结束」的系统消息），
   所以挂断之后 TA 记得你们在电话里说了什么——这是故意的，不然打完就白打了。
   ============================================================ */
(function () {
    'use strict';

    const LSK = 'gy_call_cfg';
    const S = {
        on: true,               // 只管 ⋮ 里那颗按钮显不显示
        mode: 'text',           // text | tts | voice
        tts: 'browser',         // browser | api
        url: '', key: '', model: 'tts-1', voice: 'alloy', rate: 1,
        greetOn: true,          // 接起来先让 TA 说一句
        invite: false,          // TA 主动打给你（挂在自主模式的动作表里）。默认关：会弹全屏、也要花调用
        askAnswer: true,        // 你打过去时，让 TA 自己决定接不接（只在这个角色开了自主模式时才问）
        ringSec: 20             // 来电响多久没人接就算未接
    };
    try { Object.assign(S, JSON.parse(localStorage.getItem(LSK) || '{}') || {}); } catch (e) {}
    const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (t, m) => { try { if (typeof showToast === 'function') showToast('', t, m, null, null, false); } catch (e) {} };

    let C = null;   // 当前通话 { id, char, isGroup, t0, timer, log:[], busy, ended }

    function charOf(id) {
        const sid = String(id == null ? '' : id);
        try {
            const g = (typeof groupChats !== 'undefined' ? groupChats : []).find(x => String(x.id) === sid);
            if (g) return { raw: g, isGroup: true };
            const c = (typeof myCharacters !== 'undefined' ? myCharacters : []).find(x => String(x.id) === sid);
            if (c) return { raw: c, isGroup: false };
        } catch (e) {}
        return null;
    }

    /* ================= 界面 ================= */
    function ensure() {
        let m = document.getElementById('gyCallModal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'gyCallModal';
        m.innerHTML = `
<div class="gycall-box">
  <button type="button" class="gycall-cfg" title="通话设置" onclick="gyCallCfg()">⚙️</button>
  <button type="button" class="gycall-min" title="缩成小窗（通话不断）" onclick="gyCallMin()">▁</button>
  <div class="gycall-top">
    <div class="gycall-av" id="gyCallAv"></div>
    <div class="gycall-name" id="gyCallName"></div>
    <div class="gycall-state" id="gyCallState">正在呼叫…</div>
  </div>
  <div class="gycall-log" id="gyCallLog"></div>
  <div class="gycall-cfgbox" id="gyCallCfgBox" style="display:none;"></div>
  <div class="gycall-in" id="gyCallIn">
    <button type="button" class="gycall-mic" id="gyCallMic" title="按住说话" style="display:none;">🎤</button>
    <input type="text" id="gyCallText" placeholder="说点什么…（回车发出去）">
    <button type="button" class="gycall-send" onclick="gyCallSay()">发送</button>
  </div>
  <div class="gycall-bar">
    <button type="button" class="gycall-hang" onclick="gyCallEnd()">挂断</button>
  </div>
</div>`;
        document.body.appendChild(m);
        m.querySelector('#gyCallText').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); gyCallSay(); }
        });
        const mic = m.querySelector('#gyCallMic');
        mic.onclick = () => micToggle();
        return m;
    }

    function line(who, text, cls) {
        const box = document.getElementById('gyCallLog'); if (!box) return;
        const d = document.createElement('div');
        d.className = 'gycall-line ' + (cls || '');
        d.innerHTML = `<b>${esc(who)}</b>${esc(text)}`;
        box.appendChild(d);
        box.scrollTop = box.scrollHeight;
    }
    const setState = t => { const e = document.getElementById('gyCallState'); if (e) e.innerText = t; };
    const mmss = s => Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    // 卡片上用人话写，**秒也写出来**：不到一分钟就只写秒
    const durTxt = s => (s < 60) ? (s + ' 秒') : (Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒');

    /* ================= 朗读 ================= */
    let audio = null;
    function stopSound() {
        try { if (audio) { audio.pause(); audio = null; } } catch (e) {}
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    }
    async function speak(text) {
        if (S.mode === 'text' || !text) return;
        if (S.tts === 'api' && S.url) {
            try {
                const r = await fetch(S.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.key },
                    body: JSON.stringify({ model: S.model || 'tts-1', input: text, voice: S.voice || 'alloy', speed: S.rate || 1 })
                });
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const b = await r.blob();
                stopSound();
                audio = new Audio(URL.createObjectURL(b));
                await audio.play().catch(() => {});
                return;
            } catch (e) { toast('📞', '朗读接口没通（' + (e.message || e) + '），这句用浏览器自带的念'); }
        }
        try {
            if (!window.speechSynthesis) return;
            stopSound();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN'; u.rate = S.rate || 1;
            const v = speechSynthesis.getVoices().find(x => /zh|Chinese/i.test(x.lang + x.name));
            if (v) u.voice = v;
            speechSynthesis.speak(u);
        } catch (e) {}
    }

    /* ================= 麦克风 ================= */
    let rec = null, recOn = false;
    function micToggle() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { toast('📞', '这个浏览器不支持语音识别，先用打字吧'); return; }
        const btn = document.getElementById('gyCallMic');
        if (recOn) { try { rec.stop(); } catch (e) {} return; }
        try {
            rec = new SR();
            rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false;
            rec.onstart = () => { recOn = true; if (btn) btn.classList.add('rec'); setState('在听你说…'); };
            rec.onresult = ev => {
                let t = '';
                for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
                const inp = document.getElementById('gyCallText'); if (inp) inp.value = t;
            };
            rec.onerror = e => { toast('📞', '没听清（' + (e.error || '') + '）'); };
            rec.onend = () => {
                recOn = false; if (btn) btn.classList.remove('rec');
                if (C && !C.ended) setState('通话中 ' + mmss(Math.floor((Date.now() - C.t0) / 1000)));
                const inp = document.getElementById('gyCallText');
                if (inp && inp.value.trim()) gyCallSay();
            };
            rec.start();
        } catch (e) { toast('📞', '麦克风打不开：' + (e.message || e)); }
    }

    /* ================= 跟模型说话 ================= */
    const uName = c => (typeof userDisplayName === 'function') ? userDisplayName(c) : ((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '用户');
    // 这通电话是谁打给谁的——TA 打过来的和你打过去的，开口、语气完全不一样
    function whoCalled(c) {
        const u = uName(c);
        if (C.group) {
            const by = C.by ? (C.joined || []).concat(membersOf(C.group)).find(x => String(x.id) === String(C.by)) : null;
            if (by && String(by.id) === String(c.id)) return `【这通群通话是你发起的】是你在「${C.group.name || '群'}」里拉大家（包括${u}）进来的。`;
            if (by) return `【这通群通话是${by.name}发起的】${by.name}在「${C.group.name || '群'}」里拉大家进来的，你是被拉进来的。`;
            return `【这通群通话是${u}发起的】${u}在「${C.group.name || '群'}」里拉大家进来，你接了。`;
        }
        if (C.incoming) return `【这通电话是你打给${u}的】是你主动打过去、${u}接起来的。${C.why ? '你打这通电话是因为：' + C.why + '。' : ''}`;
        return `【这通电话是${u}打给你的】是${u}主动打过来、你接起来的。`;
    }
    function callPrompt(c) {
        const u = uName(c);
        const last = C.log.slice(-10).map(x => {
            if (x.me) return u + '：' + x.text;
            if (x.who && x.who !== c.name) return x.who + '：' + x.text;
            return '你：' + x.text;
        }).join('\n');
        return `【现在你们在打电话，不是在打字】
${whoCalled(c)}
这是一通语音通话，你说的每一句都会被对方**听见**，不是看见。所以：
· 句子要短，一次只说一两句，像真的在讲电话
· 用口语：可以有"喂""嗯""哎""诶你等一下"这种
· **不要写任何动作描写、神态描写、心理活动**，也不要用括号、星号、颜文字——电话里这些都发不出声音
· 可以提你这边听得见的动静（风、锅、车、有人叫你），但只用一句带过
· 该你问就问、该你停就停，别一个人讲一大段
${last ? '\n【电话里已经说过的】\n' + last + '\n' : ''}`;
    }

    async function ask(c, userText, first) {
        if (typeof callChatCompletionAPI !== 'function' || typeof getApiConfig !== 'function') return '';
        const api = getApiConfig(false);
        if (!api || !api.key) { toast('📞', '还没配 API Key'); return ''; }
        const u = uName(c);
        let opener;
        if (C && C.group) {
            opener = (C.by && String(C.by) === String(c.id))
                ? '\n群通话刚接通，大家都进来了。你是拉大家进来的那个人，先开口说第一句（说说为什么拉大家），一句就够。'
                : '\n群通话刚接通，你进来了。说你进来的第一句，一句就够。';
        } else if (C && C.incoming) {
            opener = '\n你打过去，' + u + '刚接起来。你是打电话的那一方，先开口说第一句（自然地带出你为什么打来），一句就够。';
        } else {
            opener = '\n' + u + '刚把电话打过来，你接起来了。说你接电话的第一句，一句就够。';
        }
        const tail = first
            ? callPrompt(c) + opener
            : callPrompt(c) + '\n' + u + '在电话里说：「' + String(userText || '') + '」\n你回一句（最多两句）。';
        const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(c, false, '') : '';
        const d = await callChatCompletionAPI(api, buildStructuredMessages(base, [], tail));
        if (d && d.error) { toast('📞', '接口报错：' + (d.error.message || '')); return ''; }
        let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
        if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
        // 电话里说不出括号里的动作，兜底再洗一遍
        t = t.replace(/[（(][^）)]{0,40}[）)]/g, '').replace(/\*[^*]{0,40}\*/g, '')
             .replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim();
        return t.slice(0, 200);
    }
    const askScened = (c, u, f) => (typeof window.gyInjectInSceneSoft === 'function')
        ? window.gyInjectInSceneSoft('call', () => ask(c, u, f)) : ask(c, u, f);

    /* ================= 开始 / 说话 / 挂断 ================= */
    // incoming＝TA 打过来的（你接了）；opts.why＝TA 打这通电话的由头
    window.gyCallStart = async function (id, incoming, opts) {
        const sid = id != null ? id : (typeof currentChatSessionId !== 'undefined' ? currentChatSessionId : null);
        const s = charOf(sid);
        if (!s) { toast('📞', '先点开一个人再打'); return; }
        if (s.isGroup) return gyGroupCallStart(s.raw, opts);

        const m = ensure();
        C = { id: String(sid), char: s.raw, t0: Date.now(), log: [], busy: false, ended: false, incoming: !!incoming,
              why: (opts && opts.why) || '' };
        document.getElementById('gyCallName').innerText = s.raw.name || '';
        const av = document.getElementById('gyCallAv');
        try {
            av.innerHTML = (typeof getAvatarHTML === 'function') ? getAvatarHTML(s.raw, 96) : '';
        } catch (e) { av.innerHTML = ''; }
        document.getElementById('gyCallLog').innerHTML = '';
        document.getElementById('gyCallText').value = '';
        document.getElementById('gyCallMic').style.display = (S.mode === 'voice') ? '' : 'none';
        document.getElementById('gyCallCfgBox').style.display = 'none';
        setState('正在呼叫…');
        m.classList.add('on');

        await new Promise(r => setTimeout(r, 1200));
        if (!C || C.ended) return;

        // ☎️ TA 接不接？没开自主模式的角色默认就接；开了才真去问 TA。
        //    TA 自己打过来的那通不用问——人家都打过来了。
        const yes = incoming ? { ok: true } : await decideScened(s.raw);
        if (!C || C.ended) return;
        if (!yes.ok) {
            setState('对方暂时无法接听');
            line(s.raw.name, yes.why || '（没接）', 'them');
            await new Promise(r => setTimeout(r, 1800));
            noAnswer(String(sid), s.raw, yes.why, true);
            return;
        }

        C.t0 = Date.now();
        C.timer = setInterval(() => {
            if (!C || C.ended) return;
            const t = mmss(Math.floor((Date.now() - C.t0) / 1000));
            setState('通话中 ' + t);
            const mt = document.getElementById('gyMiniTime'); if (mt) mt.innerText = t;
        }, 1000);
        setState('通话中 0:00');

        if (S.greetOn) {
            C.busy = true; line(s.raw.name, '…', 'them wait');
            const t = await askScened(s.raw, '', true);
            const w = document.querySelector('#gyCallLog .wait'); if (w) w.remove();
            C.busy = false;
            if (t) { C.log.push({ me: false, text: t }); line(s.raw.name, t, 'them'); speak(t); if (C.mini) miniBubble(t); }
        }
    };

    window.gyCallSay = async function () {
        if (!C || C.ended) return;
        const inp = document.getElementById('gyCallText');
        const t = (inp.value || '').trim();
        if (!t) return;
        if (C.busy) { toast('📞', 'TA 还在说，等一下'); return; }
        inp.value = '';
        C.log.push({ me: true, text: t });
        line('我', t, 'me');
        if (C.group) { await groupReply(t); return; }
        C.busy = true; line(C.char.name, '…', 'them wait');
        const r = await askScened(C.char, t, false);
        const w = document.querySelector('#gyCallLog .wait'); if (w) w.remove();
        C.busy = false;
        if (!C || C.ended) return;
        if (r) { C.log.push({ me: false, text: r }); line(C.char.name, r, 'them'); speak(r); if (C.mini) miniBubble(r); }
    };

    window.gyCallEnd = async function () {
        if (!C) { const m = document.getElementById('gyCallModal'); if (m) m.classList.remove('on'); return; }
        const secs = Math.max(0, Math.floor((Date.now() - C.t0) / 1000));
        C.ended = true;
        if (C.timer) clearInterval(C.timer);
        stopSound();
        try { if (recOn && rec) rec.stop(); } catch (e) {}
        const m = document.getElementById('gyCallModal'); if (m) m.classList.remove('on');
        const mini = document.getElementById('gyCallMini'); if (mini) mini.classList.remove('on');

        // 聊天里留一张**卡片**：谁打的就挂在谁那边（我打的在右，TA 打的在左）。
        // 卡片正文第一行是时长，下面接整段通话内容——
        // 页面上默认只显示第一行（点「看看说了什么」才展开），但**prompt 里是全的**，
        // 所以挂断之后 TA 照样记得电话里说过什么。
        // ⚠️ 你说的话**写你的名字**，不能写"我："——历史里这条消息挂在 TA 名下（TA 打来的那通）时，
        //    模型会把"我：……"读成它自己说的。第一行写清楚是谁打给谁的，TA 翻记录时不会弄反。
        //    第一行是标题、第二行是【电话里说了什么】——下面的 cardSweep 按这个排版切卡片，别动。
        const ended = C;
        let body = '';
        try {
            const un = uName(ended.group ? null : ended.char);
            body = ended.log.map(x => (x.me ? un : (x.who || ended.char.name || 'TA')) + '：' + x.text).join('\n');
            if (ended.log.length && typeof globalChats !== 'undefined') {
                const arr = globalChats[ended.id] = globalChats[ended.id] || [];
                let head;
                if (ended.group) {
                    const by = ended.by ? membersOf(ended.group).find(x => String(x.id) === String(ended.by)) : null;
                    head = (by ? by.name : un) + ' 发起的群通话 · ' + durTxt(secs);
                } else {
                    head = ended.incoming ? (ended.char.name + ' 打给 ' + un) : (un + ' 打给 ' + ended.char.name);
                    head += ' · ' + durTxt(secs);
                }
                arr.push({
                    sender: ended.group ? (ended.by || 'me') : (ended.incoming ? ended.id : 'me'),
                    text: '📞 ' + head + '\n【电话里说了什么】\n' + body,
                    timestamp: Date.now(), readBy: ['me'], viaCall: true, callSecs: secs, callBy: ended.group ? (ended.by || 'me') : (ended.incoming ? ended.id : 'me')
                });
                if (typeof saveAllData === 'function') saveAllData();
                if (typeof renderChatMessages === 'function' &&
                    String(currentChatSessionId) === ended.id) renderChatMessages();
            }
        } catch (e) { console.error('[打电话] 写聊天记录时出错', e); }
        C = null;
        // 💬 挂了电话，TA 像真人一样再发一两条（回味 / 补一句 / 约下次…）
        try {
            // 聊了一大段、只说了一句、刚接通就被挂了——真人都会有反应，所以不设门槛；只是经过写得不一样
            if (!body) body = '（刚接通就挂了，几乎什么都没说）';
            else if (ended.log.length < 2) body += '\n（没说几句电话就挂了）';
            if (typeof window.gyAfterActivity === 'function') {
                if (ended.group) {
                    const pool = ended.joined || [];
                    const sp = pool.find(x => String(x.id) === String(ended.by)) || pool[Math.floor(Math.random() * pool.length)];
                    if (sp) window.gyAfterActivity(sp.id, '群通话', body, { by: ended.by ? (String(ended.by) === String(sp.id) ? 'char' : (membersOf(ended.group).find(x => String(x.id) === String(ended.by)) || {}).name) : 'me', mins: secs / 60, group: ended.id });
                } else {
                    window.gyAfterActivity(ended.id, '打电话', body, { by: ended.incoming ? 'char' : 'me', mins: secs / 60 });
                }
            }
        } catch (e) {}
    };

    /* ================= 通话里的设置 ================= */
    window.gyCallCfg = function () {
        const box = document.getElementById('gyCallCfgBox'); if (!box) return;
        if (box.style.display !== 'none') { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = `
<label class="gycall-l">怎么打</label>
<select onchange="gyCallSet('mode', this.value)">
  <option value="text"${S.mode === 'text' ? ' selected' : ''}>① 纯文字（不用任何额外接口）</option>
  <option value="tts"${S.mode === 'tts' ? ' selected' : ''}>② 加朗读：TA 说的话念出来</option>
  <option value="voice"${S.mode === 'voice' ? ' selected' : ''}>③ 我也说话：麦克风转文字</option>
</select>
<label class="gycall-l">用什么念</label>
<select onchange="gyCallSet('tts', this.value)">
  <option value="browser"${S.tts === 'browser' ? ' selected' : ''}>浏览器自带（免费，机器味重）</option>
  <option value="api"${S.tts === 'api' ? ' selected' : ''}>自己的接口（OpenAI 格式 /v1/audio/speech）</option>
</select>
<div id="gyCallApiBox" style="display:${S.tts === 'api' ? 'block' : 'none'};">
  <input type="text" placeholder="https://xxx/v1/audio/speech" value="${esc(S.url)}" onchange="gyCallSet('url', this.value)">
  <input type="password" placeholder="密钥" value="${esc(S.key)}" onchange="gyCallSet('key', this.value)">
  <input type="text" placeholder="模型，比如 tts-1" value="${esc(S.model)}" onchange="gyCallSet('model', this.value)">
  <input type="text" placeholder="音色，比如 alloy" value="${esc(S.voice)}" onchange="gyCallSet('voice', this.value)">
</div>
<label class="gycall-l">语速 <span id="gyCallRateV">${S.rate}</span></label>
<input type="range" min="0.6" max="1.6" step="0.1" value="${S.rate}"
       oninput="document.getElementById('gyCallRateV').innerText=this.value; gyCallSet('rate', parseFloat(this.value))">
<label class="gycall-ck"><input type="checkbox" ${S.greetOn ? 'checked' : ''} onchange="gyCallSet('greetOn', this.checked)"> 接起来先让 TA 说一句</label>
<label class="gycall-ck"><input type="checkbox" ${S.askAnswer ? 'checked' : ''} onchange="gyCallSet('askAnswer', this.checked)"> 让 TA 自己决定接不接（只对开了自主模式的角色）</label>
<label class="gycall-ck"><input type="checkbox" ${S.invite ? 'checked' : ''} onchange="gyCallSet('invite', this.checked)"> 允许 TA 主动打给我（挂在自主模式里）</label>
<button type="button" class="gycall-try" onclick="gyCallTry()">试听一句</button>`;
    };
    window.gyCallSet = function (k, v) {
        S[k] = v; save();
        if (k === 'mode') {
            const mic = document.getElementById('gyCallMic');
            if (mic) mic.style.display = (v === 'voice') ? '' : 'none';
            if (v === 'text') stopSound();
        }
        if (k === 'tts') { const b = document.getElementById('gyCallApiBox'); if (b) b.style.display = (v === 'api') ? 'block' : 'none'; }
        const sel = document.getElementById('gyCallModeSel'); if (sel && k === 'mode') sel.value = v;
    };
    window.gyCallRead = () => Object.assign({}, S);
    window.gyCallTry = function () {
        const old = S.mode;
        if (old === 'text') S.mode = 'tts';           // 试听不该被"纯文字"挡住
        speak('喂？是我。这会儿方便说话吗？');
        S.mode = old;
    };

    /* ================= 👥 群通话 =================
       跟一对一同一套界面，区别只有两个：
         ① **谁来**由每个成员自己定：这个成员没开自主模式 → 直接进；
            开了 → 按他此刻的处境决定接不接（跟一对一那套判断是同一个函数，
            所以日程联动、拒接理由，群里也一样管用）。一个人都没来就算没打通。
         ② 每一轮**按人回**：模型只回"某个人这会儿会说的一句"，一次一个人，
            不让它一口气把所有人的台词都编了（那样读起来像剧本，不像电话）。
       通话结束照样写一张卡片进群聊。 */
    function membersOf(g) {
        try {
            return (g.members || []).map(id =>
                (typeof myCharacters !== 'undefined' ? myCharacters : []).find(c => String(c.id) === String(id)))
                .filter(Boolean);
        } catch (e) { return []; }
    }

    // opts.by＝发起这通群通话的角色 id（TA 拉大家进来的）；不传＝你发起的
    window.gyGroupCallStart = async function (g, opts) {
        const mem = membersOf(g);
        if (!mem.length) { toast('📞', '这个群里还没有人'); return; }
        if (C || IN) { toast('📞', '已经在通话里了'); return; }
        const m = ensure();
        const by = (opts && opts.by != null && mem.some(x => String(x.id) === String(opts.by))) ? String(opts.by) : '';
        C = { id: String(g.id), char: g, group: g, t0: Date.now(), log: [], busy: false, ended: false, joined: [], by };
        document.getElementById('gyCallName').innerText = g.name || '';
        try {
            document.getElementById('gyCallAv').innerHTML =
                (typeof getGroupAvatarHTML === 'function') ? getGroupAvatarHTML(g, 96) : '';
        } catch (e) {}
        document.getElementById('gyCallLog').innerHTML = '';
        document.getElementById('gyCallText').value = '';
        document.getElementById('gyCallMic').style.display = (S.mode === 'voice') ? '' : 'none';
        document.getElementById('gyCallCfgBox').style.display = 'none';
        setState('正在呼叫 ' + mem.length + ' 个人…');
        m.classList.add('on');
        await new Promise(r => setTimeout(r, 1200));
        if (!C || C.ended) return;

        // 一个个问谁来（发起的那个人不用问——是 TA 拉的大家）
        for (const c of mem) {
            if (!C || C.ended) return;
            const yes = (by && String(c.id) === by) ? { ok: true } : await decideScened(c);
            if (yes.ok) { C.joined.push(c); line(c.name, '（进来了）', 'them'); }
            // ⚠️ 这一行不能带 wait 类：下面清"…"占位用的是 querySelector('.wait')，
            //    会把这条"没接"当占位符删掉（实测就被删了）。
            else line(c.name, '没接' + (yes.why ? '：' + yes.why : ''), 'them dim');
        }
        if (!C || C.ended) return;
        if (!C.joined.length) {
            setState('没有人接');
            await new Promise(r => setTimeout(r, 1600));
            noAnswer(String(g.id), g, '', true);
            return;
        }
        C.t0 = Date.now();
        C.timer = setInterval(() => {
            if (!C || C.ended) return;
            const t = mmss(Math.floor((Date.now() - C.t0) / 1000));
            setState(C.joined.length + ' 人在线 · ' + t);
            const mt = document.getElementById('gyMiniTime'); if (mt) mt.innerText = t;
        }, 1000);
        setState(C.joined.length + ' 人在线 · 0:00');

        if (S.greetOn) {
            const who = C.joined.find(x => String(x.id) === by) || C.joined[0];
            C.busy = true; line(who.name, '…', 'them wait');
            const t = await askScened(who, '', true);
            const w = document.querySelector('#gyCallLog .wait'); if (w) w.remove();
            C.busy = false;
            if (t) { C.log.push({ me: false, who: who.name, text: t }); line(who.name, t, 'them'); speak(t); if (C.mini) miniBubble(who.name + '：' + t); }
        }
    };

    // 群通话里我说完一句：挑一两个人接话（谁接由模型自己挑，挑不出来就按顺序来）
    async function groupReply(userText) {
        const pool = C.joined.slice();
        if (!pool.length) return;
        const n = Math.min(pool.length, 1 + (Math.random() < 0.45 ? 1 : 0));
        const picked = [];
        for (let i = 0; i < n; i++) {
            const c = pool[(C.turn = ((C.turn || 0) + 1)) % pool.length];
            if (!picked.includes(c)) picked.push(c);
        }
        for (const c of picked) {
            if (!C || C.ended) return;
            C.busy = true; line(c.name, '…', 'them wait');
            const r = await askScened(c, userText, false);
            const w = document.querySelector('#gyCallLog .wait'); if (w) w.remove();
            C.busy = false;
            if (!C || C.ended) return;
            if (r) {
                C.log.push({ me: false, who: c.name, text: r });
                line(c.name, r, 'them'); speak(r);
                if (C.mini) miniBubble(c.name + '：' + r);
            }
            userText = '';   // 后面那个人是在接前一个人的话，不用再重复你那句
        }
    }

    /* ================= ☎️ 接不接 =================
       规矩（你定的）：
         · 这个角色**没开自主模式** → 默认就接，一次调用都不花
         · 开了自主模式 → 真去问 TA 一次，让 TA 按此刻的处境决定接不接
         · 再开了「日程自动核对」→ 把今天的日程和现在几点一起递过去，
           TA 会拿"我正在开会/我在路上"这种真实理由拒你
       返回 { ok, why }。问不出来（没接口、报错、解析失败）一律当"接"，
       ——宁可接通，也不能因为一个附加判断把主功能挡死。 */
    function todayLines(char) {
        const out = [];
        try {
            const on = (typeof enableScheduleAutoCheck === 'undefined') || !!enableScheduleAutoCheck;
            if (!on) return '';
            if (char && char.schedule && char.schedule.text) out.push('TA 今天的安排：' + String(char.schedule.text).slice(0, 300));
            if (typeof gyMyDayAll === 'function') {
                const pad = n => (n < 10 ? '0' : '') + n;
                const d = new Date();
                const k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
                const mine = (gyMyDayAll() || []).filter(x => x && x.date === k)
                    .map(x => `· ${x.time || ''} ${x.text}`.trim());
                if (mine.length) out.push('对方今天的安排（TA 知道的那些）：\n' + mine.join('\n'));
            }
        } catch (e) {}
        return out.join('\n');
    }

    async function decideAnswer(char) {
        try {
            if (!S.askAnswer) return { ok: true };
            if (typeof getCharActMode !== 'function' || getCharActMode(char) !== 'auto') return { ok: true };
            if (typeof callChatCompletionAPI !== 'function' || typeof getApiConfig !== 'function') return { ok: true };
            const api = getApiConfig(true);
            if (!api || !api.key) return { ok: true };
            const sched = todayLines(char);
            const ask = `现在的真实时间：${new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' })}。
对方给你打电话，手机正在响。
${sched ? '\n' + sched + '\n' : ''}
按你此刻真实的处境决定：这通电话你现在**接不接得了**。
· 大多数时候是接的。只有真的不方便（在开会/在人前/在忙手上的事/在睡/心情实在不想说话）才不接。
· 不要为了戏剧性而拒接。

只回一行，格式二选一：
接
不接|一句话说为什么（不超过 15 字，用你自己的口气，像事后补的那条消息）`;
            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : '';
            const d = await callChatCompletionAPI(api, buildStructuredMessages(base, [], ask));
            if (d && d.error) return { ok: true };
            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
            if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
            t = t.split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
            if (/^不接/.test(t)) {
                const why = (t.split('|')[1] || t.split('｜')[1] || '').trim();
                return { ok: false, why: why || '这会儿不方便' };
            }
            return { ok: true };
        } catch (e) { return { ok: true }; }
    }
    const decideScened = c => (typeof window.gyInjectInSceneSoft === 'function')
        ? window.gyInjectInSceneSoft('call', () => decideAnswer(c)) : decideAnswer(c);

    // 没接通：聊天里记一条，TA 把没接的理由补一句过来
    // why0＝TA 打过来时想说的由头；rejected＝你是点了挂断（不是没听见）
    function noAnswer(id, char, why, iCalled, why0, rejected) {
        try {
            const m = document.getElementById('gyCallModal'); if (m) m.classList.remove('on');
            if (C && C.timer) clearInterval(C.timer);
            C = null;
            if (typeof globalChats === 'undefined') return;
            const arr = globalChats[id] = globalChats[id] || [];
            // 我打的挂我名下（右边），TA 打的挂 TA 名下（左边）
            arr.push({ sender: iCalled ? 'me' : id,
                       text: iCalled ? '📞 呼叫未接通' : '📞 未接来电',
                       timestamp: Date.now(), readBy: ['me'], viaCall: true, callMissed: true });
            if (iCalled && why) arr.push({ sender: id, text: why, timestamp: Date.now() + 1000, readBy: [], viaCall: true });
            if (typeof saveAllData === 'function') saveAllData();
            if (typeof renderChatMessages === 'function' && String(currentChatSessionId) === String(id)) renderChatMessages();
            if (!iCalled && typeof addNotification === 'function')
                addNotification(`<b>${esc(char.name)}</b> 给你打过电话，你没接 📞`, null, id, char, '');
            // TA 打给你、你没接（或者直接挂了）：像真人一样发条消息过来——"怎么不接电话""在忙吗"…
            if (!iCalled && !char.members && typeof window.gyAfterActivity === 'function') {
                const u = uName(char);
                window.gyAfterActivity(id, '没打通的电话', '', {
                    by: 'char',
                    ask: `你刚才给${u}打了个电话${why0 ? '（你打过去是因为：' + why0 + '）' : ''}，${rejected ? u + '直接挂断了' : '响了半天' + u + '没接'}。`
                });
            }
        } catch (e) {}
    }

    /* ================= ☎️ TA 打进来（全屏来电） ================= */
    let IN = null;   // { id, char, timer, left }
    function ensureIn() {
        let m = document.getElementById('gyCallIncoming');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'gyCallIncoming';
        m.innerHTML = `
<div class="gyin-box">
  <div class="gyin-av" id="gyInAv"></div>
  <div class="gyin-name" id="gyInName"></div>
  <div class="gyin-sub" id="gyInSub">邀请你语音通话…</div>
  <div class="gyin-why" id="gyInWhy"></div>
  <div class="gyin-btns">
    <button type="button" class="gyin-no" onclick="gyCallReject()"><span>✕</span>挂断</button>
    <button type="button" class="gyin-yes" onclick="gyCallAccept()"><span>✆</span>接听</button>
  </div>
</div>`;
        document.body.appendChild(m);
        return m;
    }

    // char 可以是角色对象或 id；why = TA 想说的由头（可选）
    window.gyCallRing = function (charOrId, why) {
        const s = (charOrId && charOrId.id) ? { raw: charOrId, isGroup: !!charOrId.members } : charOf(charOrId);
        if (!s || s.isGroup) return false;
        if (C || IN) return false;                     // 已经在通话/已经在响了就别叠
        const m = ensureIn();
        IN = { id: String(s.raw.id), char: s.raw, why: String(why || ''), left: Math.max(1, Math.round(gyNum(S.ringSec, 20))) };
        document.getElementById('gyInName').innerText = s.raw.name || '';
        document.getElementById('gyInWhy').innerText = why ? '“' + String(why) + '”' : '';
        try { document.getElementById('gyInAv').innerHTML = (typeof getAvatarHTML === 'function') ? getAvatarHTML(s.raw, 120) : ''; } catch (e) {}
        document.getElementById('gyInSub').innerText = '邀请你语音通话…';
        m.classList.add('on');
        try { if (typeof addNotification === 'function') addNotification(`<b>${esc(s.raw.name)}</b> 正在呼叫你 📞`, null, s.raw.id, s.raw, ''); } catch (e) {}
        IN.timer = setInterval(() => {
            if (!IN) return;
            IN.left--;
            const sub = document.getElementById('gyInSub');
            if (sub) sub.innerText = '邀请你语音通话…（' + IN.left + '）';
            if (IN.left <= 0) {
                const id = IN.id, ch = IN.char, w = IN.why;
                gyCallReject(true);
                noAnswer(id, ch, '', false, w, false);
            }
        }, 1000);
        return true;
    };
    window.gyCallAccept = async function () {
        if (!IN) return;
        const id = IN.id, why = IN.why;
        clearInterval(IN.timer);
        document.getElementById('gyCallIncoming').classList.remove('on');
        IN = null;
        await gyCallStart(id, true, { why });  // true = TA 打过来的，不用再问"接不接"；why = TA 为什么打
    };
    window.gyCallReject = function (silent) {
        if (!IN) return;
        clearInterval(IN.timer);
        const m = document.getElementById('gyCallIncoming'); if (m) m.classList.remove('on');
        const id = IN.id, ch = IN.char, w = IN.why;
        IN = null;
        if (!silent) noAnswer(id, ch, '', false, w, true);
    };

    /* ================= 🗗 小窗 ================= */
    function ensureMini() {
        let m = document.getElementById('gyCallMini');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'gyCallMini';
        // 小窗上**不放挂断键**（那颗叉太丑了）——点小窗回到通话，在那儿挂
        m.innerHTML = `<div class="gymini-bub" id="gyMiniBub"></div>
<div class="gymini-body" onclick="if(!this.parentElement.dataset.gyDragged) gyCallMax();">
  <span class="gymini-av" id="gyMiniAv"></span>
  <span class="gymini-txt"><b id="gyMiniName"></b><i id="gyMiniTime">0:00</i></span>
</div>`;
        document.body.appendChild(m);
        dragify(m);
        return m;
    }

    /* 小窗可以拖着走，位置记在 localStorage 里，下次还在那儿。
       ⚠️ 拖动和"点一下回到通话"要分开：动了超过 4px 才算拖，
       否则松手时那一下 click 会把通话窗又打开。 */
    const POSK = 'gy_call_mini_pos';
    function applyPos(m) {
        try {
            const p = JSON.parse(localStorage.getItem(POSK) || 'null');
            if (!p) return;
            const w = 128, h = 128;
            const x = Math.max(4, Math.min(innerWidth - w - 4, p.x));
            const y = Math.max(4, Math.min(innerHeight - h - 4, p.y));
            m.style.left = x + 'px'; m.style.top = y + 'px';
            m.style.right = 'auto'; m.style.bottom = 'auto';
        } catch (e) {}
    }
    function dragify(m) {
        let sx = 0, sy = 0, ox = 0, oy = 0, moved = false, on = false;
        const down = e => {
            const t = (e.touches && e.touches[0]) || e;
            const r = m.getBoundingClientRect();
            sx = t.clientX; sy = t.clientY; ox = r.left; oy = r.top;
            on = true; moved = false;
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
        };
        const move = e => {
            if (!on) return;
            const t = (e.touches && e.touches[0]) || e;
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            moved = true;
            if (e.cancelable) e.preventDefault();
            const x = Math.max(4, Math.min(innerWidth - m.offsetWidth - 4, ox + dx));
            const y = Math.max(4, Math.min(innerHeight - m.offsetHeight - 4, oy + dy));
            m.style.left = x + 'px'; m.style.top = y + 'px';
            m.style.right = 'auto'; m.style.bottom = 'auto';
        };
        const up = () => {
            on = false;
            document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
            document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
            if (moved) {
                const r = m.getBoundingClientRect();
                try { localStorage.setItem(POSK, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch (e) {}
                m.dataset.gyDragged = '1';
                setTimeout(() => { delete m.dataset.gyDragged; }, 60);   // 这一下 click 不算"点回去"
            }
        };
        m.addEventListener('mousedown', down);
        m.addEventListener('touchstart', down, { passive: true });
    }

    window.gyCallMin = function () {
        if (!C || C.ended) return;
        const m = document.getElementById('gyCallModal'); if (m) m.classList.remove('on');
        const mini = ensureMini();
        document.getElementById('gyMiniName').innerText = C.char.name || '';
        try { document.getElementById('gyMiniAv').innerHTML = (typeof getAvatarHTML === 'function') ? getAvatarHTML(C.char, 44) : ''; } catch (e) {}
        mini.classList.add('on');
        applyPos(mini);
        C.mini = true;
    };
    window.gyCallMax = function () {
        if (!C || C.ended) return;
        const mini = document.getElementById('gyCallMini'); if (mini) mini.classList.remove('on');
        const m = document.getElementById('gyCallModal'); if (m) m.classList.add('on');
        C.mini = false;
        const box = document.getElementById('gyCallLog'); if (box) box.scrollTop = box.scrollHeight;
    };
    // 小窗状态下 TA 说话：在小窗上面冒一个气泡，几秒后自己收起来
    let bubT = null;
    function miniBubble(text) {
        const b = document.getElementById('gyMiniBub'); if (!b) return;
        b.innerText = String(text || '').slice(0, 60);
        b.classList.add('on');
        if (bubT) clearTimeout(bubT);
        bubT = setTimeout(() => { b.classList.remove('on'); }, 5200);
    }

    /* ================= 🗂 聊天里那张通话卡片 =================
       不去改 js/05 的渲染（那一坨模板谁都不想碰），而是**画完之后扫一遍**：
       气泡正文以「📞 」开头的，就地换成一张卡。
       气泡本身是 .chat-bubble.me / .other，所以"谁打的在哪边"由消息的 sender 决定，
       这里一点都不用管。 */
    function cardSweep() {
        try {
            const box = document.getElementById('chatMessagesArea'); if (!box) return;
            box.querySelectorAll('.chat-bubble').forEach(b => {
                if (b.dataset.gycard) return;
                // ⚠️ 不能用 textContent：渲染时换行已经变成 <br>，textContent 读出来是一整行，
                //    split('\n') 会得到一条，正文就永远切不出来。先把 <br> 换回换行再取文字。
                const tmp = document.createElement('div');
                tmp.innerHTML = (b.innerHTML || '').replace(/<br\s*\/?>/gi, '\n');
                const raw = (tmp.textContent || '').trim();
                if (raw.indexOf('📞 ') !== 0) return;
                const lines = raw.split('\n');
                const head = lines[0].trim();
                const miss = /未接来电|呼叫未接通/.test(head);
                const body = lines.slice(2).join('\n').trim();   // 第 2 行是【电话里说了什么】
                b.dataset.gycard = '1';
                b.classList.add('gycard');
                if (miss) b.classList.add('miss');
                b.innerHTML =
                    `<span class="gycard-ic">${miss ? '✕' : '✆'}</span>` +
                    `<span class="gycard-t">${esc(head.replace(/^📞\s*/, ''))}</span>` +
                    (body ? `<span class="gycard-more">看看说了什么</span>
                             <span class="gycard-body">${esc(body).replace(/\n/g, '<br>')}</span>` : '');
                const more = b.querySelector('.gycard-more');
                if (more) more.onclick = ev => {
                    ev.stopPropagation();
                    b.classList.toggle('open');
                    more.innerText = b.classList.contains('open') ? '收起来' : '看看说了什么';
                };
            });
        } catch (e) {}
    }
    window.gyCallCardSweep = cardSweep;
    const rcm0 = window.renderChatMessages;
    if (rcm0 && rcm0.call && !rcm0.__gyCallCard) {
        window.renderChatMessages = function () {
            const r = rcm0.apply(this, arguments);
            try { setTimeout(cardSweep, 0); } catch (e) {}
            return r;
        };
        window.renderChatMessages.__gyCallCard = true;
    }

    /* ================= 🧭 自主模式里多一个动作：TA 主动打给你 =================
       默认关（S.invite）——这一项会**直接弹全屏**，还要花一次调用，不该偷偷开着。
       只有这个角色开了自主模式、而且你把这个开关打开了，TA 才可能打过来。 */
    function hookAutonomy() {
        try {
            if (typeof GY_AUTONOMY_ACTIONS === 'undefined' || !Array.isArray(GY_AUTONOMY_ACTIONS)) return;
            if (GY_AUTONOMY_ACTIONS.some(a => a.key === 'call_invite')) return;
            GY_AUTONOMY_ACTIONS.splice(GY_AUTONOMY_ACTIONS.length - 1, 0, {
                key: 'call_invite',
                label: '给用户打个电话',
                hint: '有话想当面说、或者只是想听听声音；打字说不清的时候',
                need: () => !!S.invite && !C && !IN,
                run: async (char) => {
                    let why = '';
                    try {
                        const api = (typeof getApiConfig === 'function') ? getApiConfig(true) : null;
                        if (api && api.key && typeof callChatCompletionAPI === 'function') {
                            const ask = '你现在要给对方打个电话。用一句话说你为什么这会儿想打（不超过 15 字，你自己的口气，不要引号）。';
                            const base = (typeof buildBasePrompt === 'function') ? buildBasePrompt(char, false, '') : '';
                            const d = await callChatCompletionAPI(api, buildStructuredMessages(base, [], ask));
                            let t = (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content || '').trim();
                            if (typeof stripReasoningBlocks === 'function') t = stripReasoningBlocks(t);
                            why = t.replace(/^["'“”「」]+|["'“”「」]+$/g, '');
                        }
                    } catch (e) {}
                    window.gyCallRing(char, why);
                    return '给你打了个电话';
                }
            });
            console.info('[打电话] 已经把「给用户打个电话」加进自主模式的动作表');
        } catch (e) { console.warn('[打电话] 挂自主模式失败（不影响打电话本身）：', e); }
    }

    /* ================= ⋮ 里那颗按钮 ================= */
    function paintBtn() {
        const row = document.getElementById('chatToolIconsRow'); if (!row) return;
        let b = document.getElementById('gyCallBtn');
        if (!S.on) { if (b) b.remove(); return; }
        if (!b) {
            b = document.createElement('button');
            b.id = 'gyCallBtn'; b.className = 'btn-edit-small'; b.type = 'button';
            b.title = '打电话'; b.innerText = '📞';
            b.onclick = () => gyCallStart();
            row.appendChild(b);
        }
    }
    window.gyCallOnSet = function (on) { S.on = !!on; save(); paintBtn(); };
    function fillUI() {
        try {
            const a = document.getElementById('gyCallOn'); if (a) a.checked = !!S.on;
            const b = document.getElementById('gyCallModeSel'); if (b) b.value = S.mode;
            const c = document.getElementById('gyCallInvite'); if (c) c.checked = !!S.invite;
            const d = document.getElementById('gyCallAsk'); if (d) d.checked = !!S.askAnswer;
            const e2 = document.getElementById('gyCallRing'); if (e2) e2.value = S.ringSec;
        } catch (e) {}
    }
    const op0 = window.openSettingsPanel;
    if (op0 && op0.call && !op0.__gyCall) {
        window.openSettingsPanel = function (k) { const r = op0.apply(this, arguments); if (k === 'interaction') setTimeout(fillUI, 60); return r; };
        window.openSettingsPanel.__gyCall = true;
    }

    /* ================= 样式 ================= */
    try {
        const st = document.createElement('style');
        st.id = 'gyCallCss';
        st.textContent = `
#gyCallModal { position: fixed; inset: 0; z-index: 12000; display: none;
    align-items: center; justify-content: center; background: rgba(0,0,0,.55); }
#gyCallModal.on { display: flex; }
#gyCallModal .gycall-box { position: relative; width: min(420px, 94vw); height: min(680px, 92vh);
    display: flex; flex-direction: column; border-radius: 16px; overflow: hidden;
    background: linear-gradient(180deg, #2f3b47 0%, #1d252e 100%); color: #eef1f4;
    box-shadow: 0 18px 60px rgba(0,0,0,.45); }
#gyCallModal .gycall-cfg { position: absolute; right: 10px; top: 10px; width: 34px; height: 34px;
    border: 0; border-radius: 50%; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; font-size: 16px; }
#gyCallModal .gycall-top { padding: 34px 20px 14px; text-align: center; }
#gyCallModal .gycall-av { display: flex; justify-content: center; margin-bottom: 12px; }
#gyCallModal .gycall-av .avatar { width: 96px !important; height: 96px !important;
    border-radius: 14px !important; border: 0 !important; box-shadow: none !important; font-size: 36px !important; }
#gyCallModal .gycall-name { font-size: 20px; font-weight: 700; }
#gyCallModal .gycall-state { font-size: 13px; opacity: .65; margin-top: 4px; }
#gyCallModal .gycall-log { flex: 1 1 auto; overflow-y: auto; padding: 10px 18px; font-size: 14.5px; line-height: 1.6; }
#gyCallModal .gycall-line { margin: 8px 0; opacity: .95; }
#gyCallModal .gycall-line b { display: block; font-size: 12px; opacity: .5; font-weight: 500; margin-bottom: 2px; }
#gyCallModal .gycall-line.me { text-align: right; }
#gyCallModal .gycall-line.wait { opacity: .45; }
#gyCallModal .gycall-line.dim { opacity: .5; }
#gyCallModal .gycall-cfgbox { padding: 12px 18px; background: rgba(0,0,0,.25); font-size: 13px; max-height: 46%; overflow-y: auto; }
#gyCallModal .gycall-cfgbox select, #gyCallModal .gycall-cfgbox input[type="text"],
#gyCallModal .gycall-cfgbox input[type="password"] { width: 100%; margin: 4px 0 8px; padding: 7px 9px;
    border-radius: 7px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); color: #eef1f4; }
#gyCallModal .gycall-cfgbox input[type="range"] { width: 100%; }
#gyCallModal .gycall-l { display: block; font-size: 12px; opacity: .6; margin-top: 6px; }
#gyCallModal .gycall-ck { display: flex; align-items: center; gap: 6px; margin: 8px 0; }
#gyCallModal .gycall-try { margin-top: 6px; padding: 6px 12px; border: 0; border-radius: 8px;
    background: rgba(255,255,255,.16); color: #fff; cursor: pointer; }
#gyCallModal .gycall-in { display: flex; gap: 8px; padding: 10px 14px; align-items: center; }
#gyCallModal .gycall-in input { flex: 1 1 auto; min-width: 0; padding: 10px 12px; border-radius: 999px;
    border: 0; background: rgba(255,255,255,.12); color: #eef1f4; outline: none; }
#gyCallModal .gycall-send { padding: 9px 14px; border: 0; border-radius: 999px;
    background: rgba(255,255,255,.18); color: #fff; cursor: pointer; }
#gyCallModal .gycall-mic { width: 40px; height: 40px; border: 0; border-radius: 50%;
    background: rgba(255,255,255,.12); color: #fff; cursor: pointer; font-size: 18px; }
#gyCallModal .gycall-mic.rec { background: #f4212e; animation: gycall-blink 1s infinite; }
@keyframes gycall-blink { 50% { opacity: .45; } }
#gyCallModal .gycall-bar { padding: 8px 14px 22px; text-align: center; }
#gyCallModal .gycall-hang { width: 62px; height: 62px; border: 0; border-radius: 50%;
    background: #f4212e; color: #fff; font-size: 14px; cursor: pointer; }
#gyCallModal .gycall-min { position: absolute; right: 52px; top: 10px; width: 34px; height: 34px;
    border: 0; border-radius: 50%; background: rgba(255,255,255,.12); color: #fff; cursor: pointer;
    font-size: 15px; line-height: 1; }

/* ☎️ 来电：全屏，跟真打电话一样 */
#gyCallIncoming { position: fixed; inset: 0; z-index: 12500; display: none;
    align-items: center; justify-content: center;
    background: linear-gradient(180deg, #2b3641 0%, #161c23 100%); color: #eef1f4; }
#gyCallIncoming.on { display: flex; animation: gyin-in .22s ease; }
@keyframes gyin-in { from { opacity: 0; transform: scale(1.03); } }
#gyCallIncoming .gyin-box { text-align: center; width: min(420px, 92vw); }
#gyCallIncoming .gyin-av { display: flex; justify-content: center; margin-bottom: 18px;
    animation: gyin-pulse 1.6s ease-in-out infinite; }
@keyframes gyin-pulse { 50% { transform: scale(1.05); } }
#gyCallIncoming .gyin-av .avatar { width: 120px !important; height: 120px !important;
    border-radius: 18px !important; border: 0 !important; box-shadow: none !important; font-size: 44px !important; }
#gyCallIncoming .gyin-name { font-size: 24px; font-weight: 700; }
#gyCallIncoming .gyin-sub { font-size: 14px; opacity: .6; margin-top: 6px; }
#gyCallIncoming .gyin-why { font-size: 14px; opacity: .8; margin-top: 12px; min-height: 20px; }
#gyCallIncoming .gyin-btns { display: flex; justify-content: center; gap: 70px; margin-top: 54px; }
#gyCallIncoming .gyin-btns button { width: 66px; height: 66px; border: 0; border-radius: 50%;
    color: #fff; font-size: 12px; cursor: pointer; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px; }
#gyCallIncoming .gyin-btns button span { font-size: 22px; line-height: 1; }
#gyCallIncoming .gyin-no { background: #f4212e; }
#gyCallIncoming .gyin-yes { background: #07c160; animation: gyin-shake 1.4s ease-in-out infinite; }
@keyframes gyin-shake { 0%,100% { transform: none; } 45% { transform: translateY(-5px); } }

/* 🗗 小窗：通话缩起来之后 */
/* 小窗是个**正方形**：头像 + 名字 + 一直在走的时长（到秒），底下一颗挂断 */
#gyCallMini { position: fixed; right: 18px; bottom: 96px; z-index: 12200; display: none;
    touch-action: none; user-select: none; -webkit-user-select: none;
    width: 128px; height: 128px; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; padding: 10px; border-radius: 16px;
    background: #1d252e; color: #eef1f4; box-shadow: 0 10px 30px rgba(0,0,0,.4); cursor: pointer; }
#gyCallMini.on { display: flex; }
#gyCallMini .gymini-body { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#gyCallMini .gymini-av .avatar { width: 44px !important; height: 44px !important;
    border-radius: 10px !important; border: 0 !important; box-shadow: none !important; font-size: 19px !important; }
#gyCallMini .gymini-txt { display: flex; flex-direction: column; align-items: center; line-height: 1.25; }
#gyCallMini .gymini-txt b { font-size: 12px; max-width: 104px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
#gyCallMini .gymini-txt i { font-style: normal; font-size: 17px; font-weight: 700;
    font-variant-numeric: tabular-nums; letter-spacing: .5px; }
#gyCallMini::after { content: "点一下回到通话 · 可拖走"; font-size: 10px; opacity: .45; margin-top: 2px; }
#gyCallMini .gymini-bub { position: absolute; right: 0; bottom: calc(100% + 8px);
    max-width: 260px; padding: 9px 12px; border-radius: 12px; background: #fff; color: #191919;
    font-size: 13px; line-height: 1.5; box-shadow: 0 6px 20px rgba(0,0,0,.22);
    opacity: 0; transform: translateY(6px); pointer-events: none; transition: .18s ease; }
#gyCallMini .gymini-bub.on { opacity: 1; transform: none; }
@media (max-width: 700px) { #gyCallMini { right: 12px; bottom: 120px; } }

/* 🗂 聊天里那张通话卡片 */
.chat-bubble.gycard { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.chat-bubble.gycard .gycard-ic { display: none; }
.chat-bubble.gycard .gycard-t::before { content: "✆ "; opacity: .75; }
.chat-bubble.gycard.miss .gycard-t::before { content: "✕ "; color: #f4212e; }
.chat-bubble.gycard.miss .gycard-t { color: #f4212e; }
.chat-bubble.gycard .gycard-more { font-size: 11px; opacity: .55; cursor: pointer;
    text-decoration: underline; margin-top: 2px; }
.chat-bubble.gycard .gycard-body { display: none; font-size: 13px; line-height: 1.6;
    margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(128,128,128,.25); opacity: .85; }
.chat-bubble.gycard.open .gycard-body { display: block; }
`;
        document.head.appendChild(st);
    } catch (e) {}

    const boot = () => { try { fillUI(); paintBtn(); hookAutonomy(); } catch (e) {} };
    if (document.readyState === 'complete') setTimeout(boot, 1200);
    else window.addEventListener('load', () => setTimeout(boot, 1200));

    console.info('[打电话] 已加载。入口：聊天框 ⋮ 里的 📞（点了就打）；三档在通话界面右上角 ⚙️ 里切');
})();
