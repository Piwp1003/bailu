/* 🔋 省电模式 · 插件体检：插件多了，后台定时跑的东西也多了。这里能看到每个插件开了几个定时器、跑了多少次、一共花了多少时间，谁最吃电一目了然；打开省电模式，插件的后台任务都放慢几倍（锁屏 / 切到后台时更慢），动画也少一点。手机电量低时可以自动打开 */
if (window.__gyxSaverP) return; window.__gyxSaverP = 1;
X.feat('gyxSaver', { n: '🔋 省电模式', desc: '插件体检看谁最吃电，一键让插件后台跑慢一点、动画少一点', auto: true });
const S = X.store('saver');
let D = { log: [] };   // [{at, on, why}]
const SV = () => window.__gyxSaver || (window.__gyxSaver = { on: false, fac: 3, hid: 6, anim: true, auto: true });
const keep = () => { try { localStorage.setItem('gyxSaver', JSON.stringify(SV())); } catch (e) {} };
let BAT = null;
function apply() { document.body.classList.toggle('gyx-calm', !!(SV().on && SV().anim)); }
async function setOn(v, why) { const s = SV(); if (!!s.on === !!v) return; s.on = !!v; keep(); apply(); D.log.unshift({ at: Date.now(), on: !!v, why: why || '手动' }); D.log = D.log.slice(0, 100); await S.set('d', D); X.repaint(); }
window.gyxSaverSet = async (k, v) => { if (k === 'on') return setOn(v, '手动').then(() => window.gyxSaverOpen()); SV()[k] = v; keep(); apply(); };
window.gyxSaverStats = () => {
    const by = {}; (window.__gyxTimers || []).forEach(t => { const b = (by[t.who] = by[t.who] || { who: t.who, n: 0, min: 1e12, runs: 0, cost: 0, skip: 0, since: t.at }); b.n++; b.min = Math.min(b.min, t.ms); b.runs += t.runs; b.cost += t.cost; b.skip += t.skip; b.since = Math.min(b.since, t.at); });
    return Object.values(by).map(b => Object.assign(b, { perH: b.cost / Math.max(1, (Date.now() - b.since) / 36e5) })).sort((a, b) => b.cost - a.cost || a.min - b.min);
};
window.gyxSaverOff = async name => {
    try { const p = (typeof plugins !== 'undefined' ? plugins : []).find(x => String(x.name).replace(/^\S+\s/, '') === name || String(x.name).includes(name)); if (!p) { X.toast('🔋 没找到这个插件', name); return; } p.enabled = false; saveAllData(); try { renderPluginsList(); } catch (e) {} const ask = typeof appConfirm === 'function' ? appConfirm : m => Promise.resolve(confirm(m)); if (await ask(`「${p.name}」已经停用，刷新一下才会真的停下来。现在刷新吗？`)) (window.refreshAppPage || (() => location.reload()))(); } catch (e) {}
};
const ms = v => v < 1 ? '<1 毫秒' : v < 1000 ? Math.round(v) + ' 毫秒' : (v / 1000).toFixed(1) + ' 秒';
const per = v => v >= 60000 ? Math.round(v / 60000) + ' 分钟' : v >= 1000 ? Math.round(v / 1000) + ' 秒' : v + ' 毫秒';
window.gyxSaverOpen = function () {
    const s = SV(), L = window.gyxSaverStats(), tot = L.reduce((a, b) => a + b.perH, 0);
    X.panel('gyxSvrOv', '🔋 省电模式 · 插件体检', `<div class="svr-top ${s.on ? 'on' : ''}"><div><b>${s.on ? '省电模式开着' : '省电模式关着'}</b><span>${BAT ? `电量 ${Math.round(BAT.level * 100)}%${BAT.charging ? ' · 充电中' : ''} · ` : ''}插件后台每小时大约花 ${ms(tot)}</span></div><label class="svr-sw"><input type="checkbox" ${s.on ? 'checked' : ''} onchange="gyxSaverSet('on',this.checked)"><i></i></label></div>
        <div class="gyx-row gyx-tip">打开后插件后台任务慢 <select class="gyx-who" onchange="gyxSaverSet('fac',+this.value)">${[2, 3, 5, 10].map(n => `<option${+s.fac === n ? ' selected' : ''}>${n}</option>`).join('')}</select> 倍，切到后台 / 锁屏时慢 <select class="gyx-who" onchange="gyxSaverSet('hid',+this.value)">${[3, 6, 10, 30].map(n => `<option${+s.hid === n ? ' selected' : ''}>${n}</option>`).join('')}</select> 倍</div>
        <div class="gyx-row gyx-tip"><label><input type="checkbox" ${s.anim ? 'checked' : ''} onchange="gyxSaverSet('anim',this.checked)"> 省电时插件的动画也停掉</label><label><input type="checkbox" ${s.auto ? 'checked' : ''} onchange="gyxSaverSet('auto',this.checked)"> 电量低于 20% 自动打开，充上电自动关</label></div>
        <div class="svr-h">插件体检 <span class="gyx-tip">（从这次打开 App 算起）</span></div>
        <div class="svr-list">${L.map((b, i) => `<div><span class="svr-rk">${i + 1}</span><div><b>${X.esc(b.who)}</b><em>${b.n} 个定时器 · 最快每 ${per(b.min)} 一次 · 跑了 ${b.runs} 次${b.skip ? ' · 省掉 ' + b.skip + ' 次' : ''}</em></div><span class="svr-c ${b.perH > 2000 ? 'hi' : b.perH > 300 ? 'mid' : ''}">${ms(b.perH)}/时</span><a onclick="gyxSaverOff('${X.esc(b.who)}')">停用</a></div>`).join('') || '<div class="gyx-tip">还没统计到（打开一会儿再来看）</div>'}</div>
        <div class="gyx-tip">「每小时花多少」是插件自己的代码跑掉的时间，越大越费电。不常用又排在前面的，可以停用，或者去「功能开关中心」关掉它的单项。</div>`);
};
async function battery() { try { if (!navigator.getBattery) return; BAT = await navigator.getBattery(); const chk = () => { if (!SV().auto || !X.on('gyxSaver')) return; if (!BAT.charging && BAT.level <= .2 && !SV().on) setOn(true, '电量低自动打开'); if (BAT.charging && SV().on && (D.log[0] || {}).why === '电量低自动打开') setOn(false, '充上电自动关'); }; BAT.addEventListener('levelchange', chk); BAT.addEventListener('chargingchange', chk); chk(); } catch (e) {} }
X.ctx(() => SV().on && BAT && BAT.level <= .2 && !BAT.charging ? `【她手机快没电了（${Math.round(BAT.level * 100)}%）】可以提醒她去充电，话少一点。` : '', 'gyxSaver');
X.action({ key: 'gyx_saver', label: '提醒她手机快没电了，去充电', hint: '电量低', need: () => !!(BAT && !BAT.charging && BAT.level <= .15), run: async c => (await X.reach(c, `她手机只剩 ${Math.round(BAT.level * 100)}% 的电了，提醒她去充电（别聊太久）`)) ? '提醒你充电' : null }, 'gyxSaver');
X.today(() => { const s = SV(); const top = window.gyxSaverStats()[0]; return { title: '🔋 省电', rows: [{ t: s.on ? '开着' : '关着', x: top ? '最费电：' + X.esc(top.who) : '插件体检', go: 'gyxSaverOpen()' }] }; }, 'gyxSaver');
X.widget('gyxSaverW', { n: '省电模式', sizes: ['s', 'm'], tap: () => window.gyxSaverOpen(), r: w => X.gw(w, SV().on ? '🔋' : '🪫', '省电模式', [SV().on ? '开着' : '关着', BAT ? '电量 ' + Math.round(BAT.level * 100) + '%' : '']) }, 'gyxSaver');
X.mem({ k: 'gyxSaver', ico: '🔋', n: '省电模式', d: '什么时候开 / 关过（删掉不影响设置）', items: () => D.log, text: x => (x.on ? '打开' : '关掉') + '：' + x.why, edit: () => {}, del: (c, i) => { D.log.splice(i, 1); }, meta: x => new Date(x.at).toLocaleString(), save: () => S.set('d', D) }, 'gyxSaver');
X.css('gyxSvrCss', `.gyx-calm .gyx-ov *,.gyx-calm #gyxPet,.gyx-calm #gyxPet *,.gyx-calm .drop-it,.gyx-calm .drop-it *{animation:none!important;transition:none!important}.svr-top{display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;background:#f4f4f6}.svr-top.on{background:linear-gradient(135deg,#e6f9ec,#d9f3ff)}.svr-top>div{flex:1}.svr-top b{display:block;font-size:17px}.svr-top span{font-size:12px;color:#888}.svr-sw{position:relative;width:52px;height:30px;flex:none}.svr-sw input{opacity:0;width:0;height:0}.svr-sw i{position:absolute;inset:0;border-radius:15px;background:#ccc;transition:.2s}.svr-sw i:before{content:'';position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:.2s}.svr-sw input:checked+i{background:#34c759}.svr-sw input:checked+i:before{transform:translateX(22px)}.svr-h{font-weight:700;margin:14px 0 6px}.svr-list>div{display:flex;gap:10px;align-items:center;padding:7px 2px;border-bottom:1px solid #f2f2f2}.svr-rk{width:20px;text-align:center;color:#bbb;font-size:12px}.svr-list>div>div{flex:1;min-width:0}.svr-list b{font-size:13.5px}.svr-list em{display:block;font-style:normal;font-size:11px;color:#999}.svr-c{font-size:12px;font-variant-numeric:tabular-nums;color:#34a853}.svr-c.mid{color:#e69500}.svr-c.hi{color:#e5484d}.svr-list a{font-size:12px;color:#aaa;cursor:pointer}`);
X.mini({ id: 'gyxSaver', icon: '🔋', title: '省电模式', desc: '插件体检，一键省电', cat: '生活', onOpen: () => window.gyxSaverOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.log = D.log || []; apply(); battery(); })();
