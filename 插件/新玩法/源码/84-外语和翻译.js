/* 🌐 外语和翻译：TA 是外国人就用自己的语言跟你说话（英语、日语、韩语、法语……），气泡下面点「译」看中文；你发的中文也能自动翻成 TA 的语言给你看，TA 知道你是用翻译跟 TA 聊的。 */
if (window.__gyxLang) return; window.__gyxLang = 1;
X.feat('gyxLang', { n: '🌐 外语和翻译', desc: 'TA 用自己的语言说话，气泡下面点「译」看中文；你发的也能翻成 TA 的语言' });
const S = X.store('lang');
const LANGS = ['English', '日本語', '한국어', 'Français', 'Deutsch', 'Español', 'Italiano', 'Русский', 'Português', 'ภาษาไทย', 'Tiếng Việt'];
const ZH = { 'English': '英语', '日本語': '日语', '한국어': '韩语', 'Français': '法语', 'Deutsch': '德语', 'Español': '西班牙语', 'Italiano': '意大利语', 'Русский': '俄语', 'Português': '葡萄牙语', 'ภาษาไทย': '泰语', 'Tiếng Việt': '越南语' };
let D = { per: {}, cfg: { show: 'tap' }, log: [] };   // per[cid] = { lang, mix, out }
const perOf = c => D.per[String(c && c.id)] || null;
const langOf = c => { const p = perOf(c); return p && p.lang ? p.lang : ''; };
const zh = l => ZH[l] || l;
const TR = /\[\s*译\s*[:：]\s*([^\]]+?)\s*\]/g;
const wait = [];
window.gyxLangSet = async (cid, k, v) => {
    const p = D.per[String(cid)] = D.per[String(cid)] || { lang: '', mix: false, out: false };
    p[k] = k === 'lang' ? String(v || '').trim().slice(0, 20) : !!v;
    D.log.unshift({ id: 'lg' + Date.now().toString(36), cid: String(cid), at: Date.now(), t: k === 'lang' ? (p.lang ? `说${zh(p.lang)}` : '说中文') : k === 'mix' ? (v ? '夹着中文说' : '只说自己的语言') : (v ? '你的话自动翻译' : '你的话不翻译') });
    D.log = D.log.slice(0, 100); await S.set('d', D); window.gyxLangOpen(cid);
};
window.gyxLangShow = async v => { D.cfg.show = v; await S.set('d', D); try { renderChatMessages(); } catch (e) {} };
// 现翻（模型没带翻译、或者是你发的）
async function translate(text, to) {
    if (X.bailu()) return null;
    const r = await X.ask(`把下面这段话翻译成${to}，口语、自然，像真人聊天那样，保留语气和表情符号。只输出译文，不要解释，不要加引号。\n\n${text}`);
    return r ? r.trim().slice(0, 600) : null;
}
window.gyxLangTr = async (sid, idx) => {
    const m = (globalChats[sid] || [])[idx]; if (!m) return;
    if (m.gyxTrans) { m.gyxTrOpen = !m.gyxTrOpen; try { renderChatMessages(); } catch (e) {} return; }
    const mine = m.sender === 'me', c = X.char(mine ? sid : m.sender) || X.char(sid);
    m.gyxTrans = '…'; m.gyxTrOpen = true; try { renderChatMessages(); } catch (e) {}
    const t = await translate(X.plain(m.text), mine ? (langOf(c) || 'English') : '中文');
    m.gyxTrans = t || '（没翻出来，再点一次试试）'; if (!t) m.gyxTrans = null;
    try { saveAllData(); renderChatMessages(); } catch (e) {}
};
// 模型回复里每条末尾的 [译:…]：摘下来，挂到那条消息上
function hooks() {
    const ex = window.gyChatActsExtract;
    if (typeof ex === 'function' && !ex.__gyxLang) {
        const w = function (text, char) {
            if (typeof text === 'string' && char && /\[\s*译\s*[:：]/.test(text)) {
                let tr = ''; text = text.replace(TR, (m0, a) => { tr += (tr ? ' ' : '') + a; return ''; }).replace(/[ \t]{2,}/g, ' ').trim(); arguments[0] = text;
                if (tr && text) wait.push({ cid: String(char.id), text: X.plain(text), tr, at: Date.now() });
            }
            return ex.apply(this, arguments);
        };
        Object.keys(ex).forEach(k => { try { w[k] = ex[k]; } catch (e) {} }); w.__gyxLang = 1; window.gyChatActsExtract = w;
    }
    const st = window.stripLeftoverMarkers;
    if (typeof st === 'function' && !st.__gyxLang) {
        const w = function (t) { if (typeof t === 'string' && t.indexOf('译') >= 0) arguments[0] = t.replace(TR, '').trim(); return st.apply(this, arguments); };
        Object.keys(st).forEach(k => { try { w[k] = st[k]; } catch (e) {} }); w.__gyxLang = 1; window.stripLeftoverMarkers = w; try { stripLeftoverMarkers = w; } catch (e) {}
    }
    const rr = window.renderChatMessages;
    if (typeof rr === 'function' && !rr.__gyxLang) { const w = function () { try { attach(); } catch (e) {} const x = rr.apply(this, arguments); try { paint(); } catch (e) {} return x; }; Object.keys(rr).forEach(k => { try { w[k] = rr[k]; } catch (e) {} }); w.__gyxLang = 1; window.renderChatMessages = w; try { renderChatMessages = w; } catch (e) {} }
}
function attach() {
    let ch = false;
    for (let q = wait.length - 1; q >= 0; q--) {
        const w = wait[q]; if (Date.now() - w.at > 180000) { wait.splice(q, 1); continue; }
        const sids = [w.cid].concat((typeof groupChats !== 'undefined' ? groupChats : []).filter(g => (g.members || []).map(String).includes(w.cid)).map(g => g.id));
        let hit = null;
        for (const sid of sids) { hit = (globalChats[sid] || []).slice(-30).reverse().find(m => String(m.sender) === w.cid && !m.gyxTrans && X.plain(m.text) === w.text); if (hit) break; }
        if (!hit) continue;
        hit.gyxTrans = w.tr; hit.gyxTrOpen = D.cfg.show === 'always'; wait.splice(q, 1); ch = true;
    }
    if (ch) { try { saveAllData(); } catch (e) {} }
}
// 你发的话：自动翻成 TA 的语言（只给你看，TA 知道你在用翻译）
const seenMine = {};
async function watchMine() {
    if (!X.on('gyxLang') || X.bailu()) return;
    for (const c of X.chars()) {
        const p = perOf(c); if (!p || !p.lang || !p.out) continue;
        const H = globalChats[String(c.id)] || []; const m = H[H.length - 1] && H.slice().reverse().find(x => x.sender === 'me');
        if (!m || m.gyxTrans || seenMine[m.timestamp] || Date.now() - m.timestamp > 60000 || !X.plain(m.text)) continue;
        seenMine[m.timestamp] = 1;
        const t = await translate(X.plain(m.text), p.lang); if (!t) continue;
        m.gyxTrans = t; m.gyxTrOpen = true; try { saveAllData(); if (String(currentChatSessionId) === String(c.id)) renderChatMessages(); } catch (e) {}
    }
}
function paint() {
    const area = document.getElementById('chatMessagesArea'); if (!area || !X.on('gyxLang')) return;
    const sid = String(currentChatSessionId), L = globalChats[sid] || [];
    area.querySelectorAll('.lg-tr').forEach(n => n.remove());
    area.querySelectorAll('.chat-bubble[oncontextmenu]').forEach(b => {
        const mm = /showChatContextMenu\(event,\s*(\d+)\)/.exec(b.getAttribute('oncontextmenu') || ''); if (!mm) return;
        const i = +mm[1], m = L[i]; if (!m) return;
        const c = X.char(m.sender === 'me' ? sid : m.sender); const foreign = c && langOf(c);
        if (!m.gyxTrans && !foreign) return;
        const d = document.createElement('div'); d.className = 'lg-tr' + (m.sender === 'me' ? ' me' : '');
        if (m.gyxTrans && (m.gyxTrOpen || D.cfg.show === 'always')) d.innerHTML = `<span class="lg-x" onclick="event.stopPropagation();gyxLangTr('${sid}',${i})">${m.sender === 'me' ? '→ ' + X.esc(zh(langOf(c) || '')) : '译'}</span> ${X.esc(m.gyxTrans)}`;
        else if (m.gyxTrans || (foreign && m.sender !== 'me' && !X.bailu())) d.innerHTML = `<span class="lg-x" onclick="event.stopPropagation();gyxLangTr('${sid}',${i})">${m.sender === 'me' ? '看翻译' : '译'}</span>`;
        else return;
        b.after(d);
    });
}
window.gyxLangOpen = function (who) {
    const c = X.char(who) || X.cur(); if (!c) return X.toast('还没有角色');
    const p = perOf(c) || { lang: '', mix: false, out: false };
    X.panel('gyxLangOv', '🌐 外语和翻译', `<div class="gyx-row">${X.whoSel(c.id, 'gyxLangOpen')}</div>
        ${X.bailu() ? '<div class="gyx-card gyx-tip">白露没接模型：TA 说不了外语，也翻不了。这个在谷雨里用。</div>' : ''}
        <div class="du-h" style="font-weight:700;margin:12px 0 6px">${X.esc(X.name(c))} 说什么语言</div>
        <div class="lg-grid"><span class="lg-c${!p.lang ? ' on' : ''}" onclick="gyxLangSet('${c.id}','lang','')">中文</span>${LANGS.map(l => `<span class="lg-c${p.lang === l ? ' on' : ''}" onclick="gyxLangSet('${c.id}','lang','${l}')">${l}<i>${zh(l)}</i></span>`).join('')}</div>
        <div class="gyx-row"><input class="gyx-in" placeholder="别的语言，自己写（比如：粤语、上海话、文言文）" value="${p.lang && !LANGS.includes(p.lang) ? X.esc(p.lang) : ''}" onchange="gyxLangSet('${c.id}','lang',this.value)" style="flex:1"></div>
        ${p.lang ? `<label class="gyx-row"><input type="checkbox" ${p.mix ? 'checked' : ''} onchange="gyxLangSet('${c.id}','mix',this.checked)"> 会一点中文，偶尔夹几个中文词（说得不太标准）</label>
        <label class="gyx-row"><input type="checkbox" ${p.out ? 'checked' : ''} onchange="gyxLangSet('${c.id}','out',this.checked)"> 我发的中文自动翻成${X.esc(zh(p.lang))}（显示在我的气泡下面；TA 知道我在用翻译）</label>` : ''}
        <div class="gyx-row gyx-tip">翻译显示：<select class="gyx-who" onchange="gyxLangShow(this.value)"><option value="tap"${D.cfg.show !== 'always' ? ' selected' : ''}>点「译」才显示</option><option value="always"${D.cfg.show === 'always' ? ' selected' : ''}>一直显示</option></select></div>
        <div class="gyx-tip">TA 每条回复会顺手带上中文翻译（不多调一次）；没带的点「译」现翻。</div>`);
};
X.ctx(id => {
    const c = X.char(id); const p = c && perOf(c); if (!p || !p.lang) return '';
    return `【你说的语言】你平时说${p.lang}。私聊 / 群聊里你的每条回复正文都用${p.lang}写${p.mix ? '（你会一点中文，偶尔夹一两个中文词，说得不太标准）' : ''}，然后在那条末尾加上中文翻译，格式：[译:这条的中文意思]。推文、日记、信也用${p.lang}写。${p.out ? `\n她不太会${zh(p.lang)}，是用翻译软件跟你聊的：她发来的中文你看得懂（翻译过来了），偶尔翻译会有点怪，你可以笑她、帮她纠正、教她说。` : `\n她发中文，你看得懂中文。`}`;
}, 'gyxLang');
X.action({ key: 'gyx_lang_teach', label: '教她说一句你的语言', hint: '日常的一句话，教她怎么说、什么意思', need: c => !!langOf(c),
    run: async c => (await X.reach(c, `突然想教她说一句${langOf(c)}——一句你们俩用得上的日常话（或者有点暧昧的话），告诉她怎么说、什么意思，像真人那样随口教，别像上课`)) ? `教她说了一句${zh(langOf(c))}` : null }, 'gyxLang');
X.today(() => { const rows = []; X.chars().forEach(c => { if (!langOf(c)) return; const H = globalChats[String(c.id)] || []; const n = H.filter(m => m.gyxTrans && X.day(new Date(m.timestamp)) === X.day()).length; rows.push({ t: X.name(c), x: `说${X.esc(zh(langOf(c)))}${n ? ` · 今天翻了 ${n} 句` : ''}`, go: `gyxLangOpen('${c.id}')` }); }); return { title: '🌐 外语和翻译', rows: rows.slice(0, 4) }; }, 'gyxLang');
X.widget('gyxLangW', { n: '外语和翻译', sizes: ['s', 'm'], tap: () => window.gyxLangOpen(), r: w => { const c = X.cur(); const l = c && langOf(c); const H = c ? (globalChats[String(c.id)] || []) : []; const m = H.slice().reverse().find(x => x.gyxTrans && x.sender !== 'me');
    return X.gw(w, '🌐', c ? X.name(c) : '外语和翻译', [l ? '说' + zh(l) : '说中文', m ? X.esc(X.plain(m.text).slice(0, 18)) : '', m ? '译：' + X.esc(String(m.gyxTrans).slice(0, 18)) : '']); } }, 'gyxLang');
X.mem({ k: 'gyxLang', ico: '🌐', n: '翻译', d: 'TA 说的外语和对应的中文（改的是中文翻译）',
    items: c => (globalChats[String(c.id)] || []).filter(m => m.gyxTrans && m.sender !== 'me').slice(-40).reverse(), text: m => m.gyxTrans,
    edit: (m, v) => { m.gyxTrans = String(v); }, del: (c, i) => { const L = (globalChats[String(c.id)] || []).filter(m => m.gyxTrans && m.sender !== 'me').slice(-40).reverse(); if (L[i]) delete L[i].gyxTrans; },
    meta: m => X.plain(m.text).slice(0, 40) }, 'gyxLang');
X.css('gyxLangCss', `.lg-tr{font-size:12px;color:#8e8e93;line-height:1.6;margin:3px 2px 0;max-width:260px;word-break:break-word}.lg-tr.me{text-align:right;align-self:flex-end}
.lg-x{display:inline-block;font-size:11px;padding:0 7px;border-radius:8px;background:rgba(0,0,0,.05);color:#1d9bf0;cursor:pointer;margin-right:4px}
.lg-grid{display:flex;flex-wrap:wrap;gap:6px}.lg-c{padding:6px 11px;border-radius:12px;background:#f2f2f4;cursor:pointer;font-size:13px}.lg-c i{font-style:normal;font-size:11px;color:#999;margin-left:4px}.lg-c.on{background:#1d9bf0;color:#fff}.lg-c.on i{color:#e6f3ff}`);
X.mini({ id: 'gyxLang', icon: '🌐', title: '外语和翻译', desc: 'TA 用自己的语言说话，点「译」看中文；你发的也能翻成 TA 的语言', cat: '关系', onOpen: () => window.gyxLangOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.per = D.per || {}; D.cfg = Object.assign({ show: 'tap' }, D.cfg || {}); D.log = Array.isArray(D.log) ? D.log : []; hooks(); setInterval(() => { hooks(); try { attach(); } catch (e) {} watchMine(); }, 1500); })();
