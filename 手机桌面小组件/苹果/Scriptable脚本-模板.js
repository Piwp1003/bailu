// 谷雨 · 桌面小组件（Scriptable 用）
// 1. App Store 装「Scriptable」→ 右上角 ＋ 新建脚本 → 把这整段粘进去，名字随便起
// 2. 回桌面长按 → 左上角 ＋ → 找 Scriptable → 选大小 → 添加 → 长按小组件「编辑小组件」→ Script 选这个脚本
// 3. Parameter（参数）可以填一张卡片的名字，比如：每日一问；空着就每次换一张；大号小组件会一次显示好几张
const RELAY = "https://你的中转站.workers.dev"
const TOKEN = "在谷雨里复制口令填这里"
const WEB = ""   // 点小组件打开的网址（你的谷雨网页版地址）
const THEMES = { light: ['#FFFFFF', '#1D1D1F', '#6E6E73'], dark: ['#1C1C1E', '#F5F5F7', '#A1A1A6'], pink: ['#FFF0F5', '#7A2948', '#B0647F'], cream: ['#FFF8EC', '#4A3A28', '#8A7660'], sky: ['#EEF5FF', '#1F3A5F', '#5B7699'] }
async function load() {
  const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'guyu-widget.json')
  try { const r = new Request(RELAY + '/w/' + TOKEN); r.timeoutInterval = 10; const d = await r.loadJSON(); if (d && d.cards) { fm.writeString(cache, JSON.stringify(d)); return d } } catch (e) {}
  try { return JSON.parse(fm.readString(cache)) } catch (e) { return { cards: [] } }
}
function pick(cards, want) {
  if (want) { const c = cards.find(x => x.n.includes(want) || x.k === want); if (c) return c }
  const slot = Math.floor(Date.now() / 1800000); return cards[slot % Math.max(1, cards.length)]
}
function card(w, c, T, big) {
  const h = w.addStack(); h.centerAlignContent()
  const i = h.addText(c.ico || '🌸'); i.font = Font.systemFont(big ? 20 : 16)
  h.addSpacer(6)
  const t = h.addText(c.n); t.font = Font.boldSystemFont(big ? 14 : 12); t.textColor = new Color(T[1]); t.lineLimit = 1
  w.addSpacer(big ? 8 : 3)
  ;(c.lines || []).slice(0, big ? 3 : 1).forEach((l, k) => { const x = w.addText(l); x.font = k === 0 ? Font.boldSystemFont(big ? 16 : 13) : Font.systemFont(13); x.textColor = new Color(k === 0 ? T[1] : T[2]); x.lineLimit = 2; w.addSpacer(2) })
}
const d = await load(), T = THEMES[d.theme] || THEMES.light, fam = config.widgetFamily || 'medium', want = (args.widgetParameter || '').trim()
const w = new ListWidget(); w.backgroundColor = new Color(T[0]); w.setPadding(14, 14, 12, 14)
if (!d.cards || !d.cards.length) { const t = w.addText('打开谷雨，在「📲 手机桌面小组件」里点「现在同步」'); t.textColor = new Color(T[2]); t.font = Font.systemFont(13) }
else if (fam === 'large' && !want) { d.cards.slice(0, 4).forEach((c, i) => { card(w, c, T, false); if (i < 3) w.addSpacer(10) }); w.url = WEB }
else { const c = pick(d.cards, want); card(w, c, T, fam !== 'small'); if (WEB) w.url = WEB + (WEB.includes('?') ? '&' : '?') + 'open=' + encodeURIComponent(c.k) }
w.addSpacer()
if (d.at) { const f = w.addText((t => ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2))(new Date(d.at)) + ' 同步'); f.font = Font.systemFont(9); f.textColor = new Color(T[2]); f.rightAlignText() }
w.refreshAfterDate = new Date(Date.now() + 15 * 60000)
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium()
Script.complete()
