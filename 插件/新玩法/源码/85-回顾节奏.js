/* ⚙️ 多久总结一次：周报、我们的书、星图、TA 眼中的你、回忆放映、TA 写给你的歌……各自多久总结一次、到时间要不要 TA 自己做，都在这一页定 */
if (window.__gyxRecapCfg) return; window.__gyxRecapCfg = 1;
const NAME = v => typeof v === 'number' || /^\d+$/.test(String(v)) ? `每 ${v} 天` : ({ half: '每半个月', month: '每个月', season: '每个季度', year: '每年' }[v] || v);
window.gyxRecapSet = (key, k, v) => { X.recapSet(key, k, k === 'v' ? (/^\d+$/.test(v) ? +v : v) : !!v); X.toast(X.v('改好了', '记下了', '好，就按这个来'), ''); window.gyxRecapCfgOpen(); };
window.gyxRecapCfgOpen = function () {
    const L = X.RECAP.filter(d => X.on(({ book: 'gyxOurBook', weekly: 'gyxWeekly', star: 'gyxStar', eye: 'gyxEye', reel: 'gyxReel', song: 'gyxSong' })[d.key] || 'x'));
    const cur = L.map(d => `${d.n.replace(/^\S+\s/, '')} ${NAME(X.recap(d.key).v)}`).join(' · ');
    X.panel('gyxRecapCfgOv', '⚙️ 多久总结一次', `<div class="gyx-tip">这几样都会回头看你们的聊天。各自定一个节奏，就不会一到月初全都在总结同一段话。${cur ? '<br>现在：' + X.esc(cur) : ''}</div>
        ${L.map(d => { const r = X.recap(d.key); return `<div class="gyx-card rc-r"><b>${X.esc(d.n)}</b><div class="gyx-row"><span class="gyx-tip" style="margin:0">${X.esc(d.txt)}</span><select class="gyx-who" onchange="gyxRecapSet('${d.key}','v',this.value)">${d.opts.map(o => `<option value="${o}"${String(r.v) === String(o) ? ' selected' : ''}>${NAME(o)}</option>`).join('')}</select></div>${d.autoTxt ? `<label class="gyx-tip" style="display:block;margin:2px 0 0"><input type="checkbox" ${r.auto ? 'checked' : ''} onchange="gyxRecapSet('${d.key}','auto',this.checked)"> ${X.esc(d.autoTxt)}</label>` : ''}</div>`; }).join('') || '<div class="gyx-tip">回顾类的插件都关着。</div>'}
        <div class="gyx-tip">换了「多久算一章 / 一个星座」以后，以前写好的章节名还留着，只是会按新的时间段重新分。</div>`);
};
X.css('gyxRecapCfgCss', '.rc-r b{display:block;margin-bottom:2px}.rc-r .gyx-row{margin:4px 0;justify-content:space-between}');
X.mini({ id: 'gyxRecapCfg', icon: '⚙️', title: '多久总结一次', desc: '周报、我们的书、星图、观察笔记、回忆放映、写歌：各自多久总结一次', cat: '回忆', onOpen: () => window.gyxRecapCfgOpen() });
