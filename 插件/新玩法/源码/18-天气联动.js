/* 🌦️ 天气联动：TA 知道你那边真实的天气——下雨提醒带伞、降温让你加衣服、太热让你别中暑；异地的话也能看 TA 那边的天气 */
if (window.__gyxWeather) return; window.__gyxWeather = 1;
X.feat('gyxWeather', { n: '🌦️ 天气联动', desc: 'TA 知道你那边的真实天气，下雨降温会提醒你' });
const S = X.store('weather');
let D = { me: null, ta: {}, now: null, taNow: {}, at: 0, cfg: { remind: 60 }, done: {} };   // me/ta: {name, lat, lon}
const WC = { 0: ['晴', '☀️'], 1: ['晴间多云', '🌤️'], 2: ['多云', '⛅'], 3: ['阴', '☁️'], 45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'], 51: ['毛毛雨', '🌦️'], 53: ['小雨', '🌦️'], 55: ['中雨', '🌧️'], 56: ['冻毛毛雨', '🌧️'], 57: ['冻雨', '🌧️'], 61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'], 66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'], 71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'], 80: ['阵雨', '🌦️'], 81: ['阵雨', '🌧️'], 82: ['暴雨', '⛈️'], 85: ['阵雪', '🌨️'], 86: ['大阵雪', '❄️'], 95: ['雷雨', '⛈️'], 96: ['雷阵雨伴冰雹', '⛈️'], 99: ['强雷暴', '⛈️'] };
const wc = c => WC[c] || ['未知', '🌡️'];
async function geo(name) {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=' + encodeURIComponent(name));
    const j = await r.json(); const g = j && j.results && j.results[0]; if (!g) return null;
    return { name: g.name + (g.admin1 && g.admin1 !== g.name ? '·' + g.admin1 : ''), lat: g.latitude, lon: g.longitude };
}
async function fetchW(p) {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&past_days=1&forecast_days=2`;
    const j = await (await fetch(u)).json(); if (!j || !j.current) return null;
    const d = j.daily || {};
    return { at: Date.now(), t: j.current.temperature_2m, feel: j.current.apparent_temperature, code: j.current.weather_code, hum: j.current.relative_humidity_2m, wind: j.current.wind_speed_10m, yMax: (d.temperature_2m_max || [])[0], yMin: (d.temperature_2m_min || [])[0], max: (d.temperature_2m_max || [])[1], min: (d.temperature_2m_min || [])[1], rain: (d.precipitation_probability_max || [])[1], dcode: (d.weather_code || [])[1], uv: (d.uv_index_max || [])[1] };
}
async function refresh(force) {
    if (!X.on('gyxWeather')) return;
    if (!force && Date.now() - D.at < 30 * 60000) return;
    D.at = Date.now();
    try { if (D.me) D.now = await fetchW(D.me) || D.now; } catch (e) {}
    for (const [cid, p] of Object.entries(D.ta || {})) { try { D.taNow[cid] = await fetchW(p) || D.taNow[cid]; } catch (e) {} }
    await S.set('d', D); X.repaint();
}
window.gyxWeatherRefresh = () => refresh(true);
const desc = w => w ? `${wc(w.code)[0]} ${Math.round(w.t)}°C（体感 ${Math.round(w.feel)}°），今天 ${Math.round(w.min)}~${Math.round(w.max)}°C${w.rain != null ? '，降水概率 ' + w.rain + '%' : ''}` : '';
function worry(w) {
    if (!w) return null; const r = [];
    if (w.rain >= 50 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(w.dcode)) r.push(['rain', `今天她那边会下雨（降水概率 ${w.rain}%），提醒她带伞`]);
    if (w.yMax != null && w.max != null && w.yMax - w.max >= 6) r.push(['cold', `她那边降温了（昨天最高 ${Math.round(w.yMax)}°，今天只有 ${Math.round(w.max)}°），让她加衣服`]);
    if (w.max >= 33) r.push(['hot', `她那边今天 ${Math.round(w.max)}°，很热，让她防暑、多喝水`]);
    if (w.min <= 0) r.push(['ice', `她那边今天最低 ${Math.round(w.min)}°，会结冰，让她穿厚点、路上小心`]);
    if (w.uv >= 8) r.push(['uv', `她那边今天紫外线很强，提醒她防晒`]);
    if ([71, 73, 75, 85, 86].includes(w.dcode)) r.push(['snow', `她那边今天下雪`]);
    return r;
}
async function remind(c, force) {
    const w = D.now; const ws = worry(w); if (!ws || !ws.length) return null;
    const k = X.day() + ':' + c.id; if (!force && D.done[k]) return null; D.done[k] = 1; await S.set('d', D);
    const why = ws.map(x => x[1]).join('；');
    if (X.bailu()) { const t = X.cards(['天气', '关心', '聊天'], c, 1)[0]; X.say(c, t ? t : { rain: '今天要下雨，记得带伞。', cold: '降温了，多穿一件。', hot: '今天很热，别中暑了。', ice: '今天很冷，路上小心。', uv: '太阳很晒，记得防晒。', snow: '下雪了！出门慢点。' }[ws[0][0]]); return why; }
    return (await X.reach(c, `你看了她那边的天气：${desc(w)}。${why}`)) ? why : null;
}
window.gyxWeatherRemind = id => remind(X.char(id) || X.cur(), true);
async function tick() {
    if (!X.on('gyxWeather')) return; await refresh();
    const h = new Date().getHours(); if (h < 7 || h > 10) return;
    for (const c of X.chars()) { if (X.auto(c)) continue; if (Math.random() * 100 < (+D.cfg.remind || 0)) { await remind(c); break; } }
}
X.action({ key: 'gyx_weather', label: '看看她那边的天气，提醒她（带伞 / 加衣 / 防晒）', hint: '她那边下雨或降温了', need: c => { const w = worry(D.now); return !!(w && w.length) && !D.done[X.day() + ':' + c.id]; }, run: async c => (await remind(c)) ? '提醒了你天气' : null }, 'gyxWeather');
X.ctx(id => { let t = ''; if (D.now && D.me) t += `【她那边的天气】${D.me.name}：${desc(D.now)}。`; const tw = D.taNow[String(id)], tp = D.ta[String(id)]; if (tw && tp) t += `【你这边的天气】${tp.name}：${desc(tw)}。`; return t ? t + '聊天时可以自然地提到（别每句都提）。' : ''; }, 'gyxWeather');
X.today(() => { const rows = []; if (D.now && D.me) rows.push({ t: wc(D.now.code)[1] + ' ' + Math.round(D.now.t) + '°', x: `${X.esc(D.me.name)} · ${wc(D.now.code)[0]}，${Math.round(D.now.min)}~${Math.round(D.now.max)}°${D.now.rain >= 50 ? ' · <b>记得带伞</b>' : ''}`, go: 'gyxWeatherOpen()' }); Object.entries(D.taNow || {}).forEach(([cid, w]) => { const p = D.ta[cid]; if (w && p) rows.push({ t: wc(w.code)[1] + ' ' + Math.round(w.t) + '°', x: `${X.esc(X.name(X.char(cid)))}那边（${X.esc(p.name)}）· ${wc(w.code)[0]}`, go: 'gyxWeatherOpen()' }); }); return { title: '🌦️ 天气', rows }; }, 'gyxWeather');
X.widget('gyxWeather', { n: '天气', sizes: ['s', 'm'], tap: () => window.gyxWeatherOpen(), r: w => { const n = D.now; if (!n) return '<div class="gw-we s"><b>🌡️</b><em>设置城市</em></div>'; if (w.size === 's') return `<div class="gw-we s"><b>${wc(n.code)[1]}</b><em>${Math.round(n.t)}° ${wc(n.code)[0]}</em></div>`; return `<div class="gw-we m"><b>${wc(n.code)[1]}</b><div><i>${Math.round(n.t)}°</i><em>${X.esc(D.me.name)} · ${wc(n.code)[0]}</em><em>${Math.round(n.min)}~${Math.round(n.max)}° · 雨 ${n.rain}%</em></div></div>`; } });
window.gyxWeatherOpen = function () {
    const n = D.now, cs = X.chars();
    X.panel('gyxWeOv', '🌦️ 天气联动', `<div class="gyx-tip">天气数据来自 Open-Meteo（免费，不用 Key）。</div>
        <div class="gyx-row">你在哪个城市：<input id="gyxWeMe" class="gyx-who" value="${X.esc(D.me ? D.me.name.split('·')[0] : '')}" placeholder="比如：杭州"><button class="gyx-btn" onclick="gyxWeatherSet('me',document.getElementById('gyxWeMe').value)">确定</button></div>
        ${n ? `<div class="we-card"><b>${wc(n.code)[1]}</b><div><i>${Math.round(n.t)}°</i><span>${X.esc(D.me.name)} · ${wc(n.code)[0]} · 体感 ${Math.round(n.feel)}°</span><span>今天 ${Math.round(n.min)}~${Math.round(n.max)}° · 降水 ${n.rain}% · 湿度 ${n.hum}% · 紫外线 ${n.uv}</span></div></div>` : ''}
        <div class="gyx-tip">异地的话，也可以填 TA 在哪（TA 会知道自己那边的天气，你在「今天」里也能看到）：</div>
        ${cs.map(c => `<div class="gyx-row">${X.esc(X.name(c))}：<input class="gyx-who" id="gyxWeTa${c.id}" value="${X.esc(D.ta[c.id] ? D.ta[c.id].name.split('·')[0] : '')}" placeholder="不填＝跟你在一起"><button class="gyx-btn lite" onclick="gyxWeatherSet('${c.id}',document.getElementById('gyxWeTa${c.id}').value)">确定</button></div>`).join('')}
        <div class="gyx-row gyx-tip">早上下雨 / 降温 / 太热时，默认模式的 TA 有 <input class="gyx-who" type="number" min="0" max="100" value="${D.cfg.remind}" style="width:60px" onchange="gyxWeatherCfg(+this.value)">% 的可能来提醒你；自主模式的 TA 自己决定。</div>
        <div class="gyx-row"><button class="gyx-btn lite" onclick="gyxWeatherRefresh().then(()=>gyxWeatherOpen())">刷新</button><button class="gyx-btn lite" onclick="gyxWeatherRemind()">让 TA 现在看看天气</button></div>`);
};
window.gyxWeatherSet = async function (who, name) {
    name = String(name || '').trim();
    if (!name) { if (who === 'me') D.me = null; else { delete D.ta[who]; delete D.taNow[who]; } await S.set('d', D); window.gyxWeatherOpen(); return; }
    let g = null; try { g = await geo(name); } catch (e) {}
    if (!g) { X.toast(X.v('没找到这个城市', '换个写法试试'), name); return; }
    if (who === 'me') D.me = g; else D.ta[who] = g;
    await S.set('d', D); await refresh(true); window.gyxWeatherOpen();
};
window.gyxWeatherCfg = v => { D.cfg.remind = v; S.set('d', D); };
window.gyxWeatherData = () => D;
X.css('gyxWeCss', `.we-card{display:flex;gap:14px;align-items:center;padding:14px 16px;border-radius:18px;background:linear-gradient(135deg,#dff0ff,#f3f8ff);margin:10px 0}.we-card>b{font-size:48px;font-weight:normal}.we-card i{font-style:normal;font-size:34px;font-weight:300}.we-card span{display:block;font-size:12.5px;color:#556}
.gw-we{height:100%;display:flex;align-items:center;gap:10px}.gw-we.s{flex-direction:column;justify-content:center;gap:2px}.gw-we b{font-size:34px;font-weight:normal}.gw-we i{font-style:normal;font-size:26px;display:block}.gw-we em{font-style:normal;font-size:12px;color:var(--pm-sub);display:block}`);
X.mini({ id: 'gyxWeather', icon: '🌦️', title: '天气联动', desc: 'TA 知道你那边的真实天气，下雨降温会提醒你', onOpen: () => window.gyxWeatherOpen() });
(async () => { D = Object.assign(D, await S.get('d', {})); D.ta = D.ta || {}; D.taNow = D.taNow || {}; D.done = D.done || {}; D.cfg = Object.assign({ remind: 60 }, D.cfg || {}); setTimeout(tick, 12000); setInterval(tick, 15 * 60000); })();
