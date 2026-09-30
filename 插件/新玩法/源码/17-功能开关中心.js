/* 🎛️ 功能开关中心：新功能一个一个开关——用不用、TA 自己会不会做，全由你定；TA 自主行动能做的每一件事也能单独关；顺便把「一起听」「占卜」补进 TA 的自主行动 */
if (window.__gyxSwitch) return; window.__gyxSwitch = 1;
X.feat('gyxSwitch', { n: '🎛️ 功能开关中心', desc: '管理所有新功能的开关', auto: false });
X.feat('gyxWebInvite', { n: '🎧 TA 约你一起听 / 一起看', desc: 'TA 会自己挑一首歌 / 一个视频来约你' });
X.feat('gyxMystic', { n: '🔮 TA 给你占卜', desc: 'TA 会给你抽签 / 抽牌，讲给你听' });
const OK = 'gyxActOff';
let OFF = {}; try { OFF = JSON.parse(localStorage.getItem(OK) || '{}') || {}; } catch (e) {}
// 每一件自主行动都套一层：你关掉的，TA 就不会选
function wrapActs() {
    try {
        if (typeof GY_AUTONOMY_ACTIONS === 'undefined') return;
        GY_AUTONOMY_ACTIONS.forEach(a => { if (!a || a.__gyxW || a.key === 'nothing') return; const need = a.need; a.need = c => !OFF[a.key] && (!need || need(c)); a.__gyxW = true; });
    } catch (e) {}
}
/* ---- 补进自主行动：一起听 / 一起看、占卜 ---- */
X.action({ key: 'gyx_webmedia', label: '约她一起听首歌 / 一起看个视频', hint: '你挑一首歌或一个视频', need: () => typeof window.gyWmOpen === 'function', run: async c => (await X.reach(c, X.pick(['你想约她一起听首歌，说说是哪首、为什么想和她一起听（她可以在「一起听 · 一起看」里放）', '你刷到一个想和她一起看的视频 / 一部剧，约她一起看', '你单曲循环了一首歌，想让她也听听']))) ? '约你一起听 / 看' : null }, 'gyxWebInvite');
X.action({ key: 'gyx_mystic', label: '给她占卜一下（抽签 / 抽牌）', hint: '今天的运势、她纠结的事', need: () => !!window.__gyMysticDO, run: async c => {
    const D = window.__gyMysticDO; let t = '';
    try { if (Math.random() < .5) { const l = D.lot(); t = `你给她求了一支签：第 ${l.no} 签「${l.lv}」，签文「${(l.poem || []).join('，')}」，解曰「${l.jie}」`; } else { const l = D.lenormand(3); t = `你给她抽了三张雷诺曼牌：${(l.cards || []).map(x => Array.isArray(x) ? x[0] : (x.n || x)).join('、')}`; } } catch (e) { t = '你想给她抽一张塔罗牌'; }
    return (await X.reach(c, t + '。用你自己的方式讲给她听（可以半信半疑、可以很认真）')) ? '给你占卜了一下' : null;
} }, 'gyxMystic');
/* ---- 面板 ---- */
function actList() { try { return (typeof GY_AUTONOMY_ACTIONS !== 'undefined' ? GY_AUTONOMY_ACTIONS : []).filter(a => a && a.key && a.key !== 'nothing'); } catch (e) { return []; } }
window.gyxSwitchOpen = function (tab) {
    const T = tab || window.__gyxSwTab || 'feat'; window.__gyxSwTab = T;
    const F = X.FEATS.filter(f => f.id !== 'gyxSwitch');
    let body = '';
    if (T === 'feat') body = `<div class="gyx-tip">新功能都在这儿。「用」关掉＝这个功能整个不出现；「TA 会自己做」关掉＝你还能用，但 TA 不会主动去做。</div>
        ${F.map(f => `<div class="sw-it"><div class="sw-n"><b>${X.esc(f.n)}</b><span>${X.esc(f.desc || '')}</span></div>
            <label class="sw"><input type="checkbox" ${X.on(f.id) ? 'checked' : ''} onchange="gyxSwitchSet('${f.id}',this.checked)"><i></i><em>用</em></label>
            ${f.auto !== false ? `<label class="sw"><input type="checkbox" ${X.on(f.id + '.auto') ? 'checked' : ''} ${X.on(f.id) ? '' : 'disabled'} onchange="gyxSwitchSet('${f.id}.auto',this.checked)"><i></i><em>TA 会自己做</em></label>` : ''}</div>`).join('')}
        ${core()}`;
    else body = `<div class="gyx-tip">TA 在自主模式里能挑的每一件事。关掉的 TA 就不会再选（默认模式的角色不受影响）。</div>
        <div class="gyx-row"><span class="gyx-chip" onclick="gyxSwitchActAll(0)">全部打开</span><span class="gyx-chip" onclick="gyxSwitchActAll(1)">全部关掉</span></div>
        ${actList().map(a => `<div class="sw-it"><div class="sw-n"><b>${X.esc(a.label || a.key)}</b><span>${X.esc(a.hint || '')}</span></div><label class="sw"><input type="checkbox" ${OFF[a.key] ? '' : 'checked'} onchange="gyxSwitchAct('${a.key}',this.checked)"><i></i></label></div>`).join('')}`;
    X.panel('gyxSwOv', '🎛️ 功能开关中心', `<div class="gyx-row"><span class="gyx-chip ${T === 'feat' ? 'on' : ''}" onclick="gyxSwitchOpen('feat')">新功能</span><span class="gyx-chip ${T === 'act' ? 'on' : ''}" onclick="gyxSwitchOpen('act')">TA 的自主行动（${actList().length} 件事）</span></div>${body}`);
};
// 谷雨 / 白露本体里后来加的几样（能关的都放这儿）
function core() {
    const rows = [];
    if (typeof window.gyVoiceSetF === 'function' && window.gyVoiceCfgFor) rows.push(['🎤 TA 发语音条', '聊天里 TA 会发语音条', !!(window.__gyxCoreVoice != null ? window.__gyxCoreVoice : true), "gyxSwitchCore('voice',this.checked)"]);
    if (typeof window.gyWmReact === 'function') rows.push(['🎧 一起听时 TA 搭话', '换歌 / 换视频时 TA 会说两句', (() => { try { return (JSON.parse(localStorage.getItem('gyWm') || '{}').react ?? 30) > 0; } catch (e) { return true; } })(), "gyxSwitchCore('wm',this.checked)"]);
    if (typeof window.gyIntroSet === 'function') rows.push(['🎬 原版开场动画', '谷雨自带的星空开场（开了「开场动画合集」时不放）', (() => { try { const d = window.gyMoodData && window.gyMoodData(); return !d || d.intro.on !== false; } catch (e) { return true; } })(), "gyIntroSet('on',this.checked)"]);
    if (!rows.length) return '';
    return `<div class="gyx-tip" style="margin-top:14px">本体里的新功能</div>` + rows.map(([n, d, on, fn]) => `<div class="sw-it"><div class="sw-n"><b>${n}</b><span>${d}</span></div><label class="sw"><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}"><i></i><em>用</em></label></div>`).join('');
}
window.gyxSwitchCore = async (k, v) => {
    if (k === 'voice') { window.__gyxCoreVoice = v; try { await window.gyVoiceSetF('root', 'bubbles', v); } catch (e) {} }
    if (k === 'wm') { try { window.gyWmReact(v ? 30 : 0); } catch (e) {} }
};
window.gyxSwitchSet = (id, v) => { X.set(id, v); window.gyxSwitchOpen(); };
window.gyxSwitchAct = (k, v) => { if (v) delete OFF[k]; else OFF[k] = 1; try { localStorage.setItem(OK, JSON.stringify(OFF)); } catch (e) {} };
window.gyxSwitchActAll = off => { OFF = {}; if (off) actList().forEach(a => OFF[a.key] = 1); try { localStorage.setItem(OK, JSON.stringify(OFF)); } catch (e) {} window.gyxSwitchOpen('act'); };
X.css('gyxSwCss', `.sw-it{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #f2f2f4}.sw-n{flex:1;min-width:0}.sw-n b{display:block;font-size:14.5px;font-weight:500}.sw-n span{font-size:12px;color:#8e8e93}
.sw{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;flex-shrink:0}.sw input{display:none}.sw i{width:44px;height:26px;border-radius:13px;background:#e5e5ea;position:relative;transition:background .2s}.sw i::after{content:"";position:absolute;left:2px;top:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2);transition:transform .2s}.sw input:checked+i{background:#34c759}.sw input:checked+i::after{transform:translateX(18px)}.sw input:disabled+i{opacity:.4}.sw em{font-style:normal;font-size:10.5px;color:#8e8e93}`);
X.mini({ id: 'gyxSwitch', icon: '🎛️', title: '功能开关中心', desc: '每个新功能都能单独开关；TA 自主行动能做的事也能一件件关', onOpen: () => window.gyxSwitchOpen() });
wrapActs(); setInterval(wrapActs, 3000);
