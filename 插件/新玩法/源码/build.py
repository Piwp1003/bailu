import json, os, re, glob, shutil
src = os.path.dirname(os.path.abspath(__file__))
out = os.path.dirname(src)
common = open(os.path.join(src, '_common.js'), encoding='utf-8').read()

# 🧩 合并：同一类的插件打成一个（「谷雨功能盘点」里选的）。每个原插件包在自己的函数里，互不影响；数据还是存在原来的地方。
BUNDLES = [
    ('🖼️', '相册里的插件', ['22', '72', '52', '35']),
    ('💞', '我们的关系', ['44', '73', '69']),
    ('📚', '回顾', ['85', '58', '48', '71', '53', '46', '45']),
    ('🎉', '纪念日和生日', ['20', '37']),
    ('🤙', '我们的约定', ['12', '61', '65', '26', '27']),
    ('🌙', '早安晚安', ['30', '13', '21', '76', '02']),
    ('💬', '问答', ['66', '19', '60', '62']),
    ('🎮', '游戏', ['25', '68', '67', '64']),
    ('💌', '信', ['11', '06', '09', '10', '54']),
    ('🏠', '我们的小屋', ['55', '75', '08', '31']),
    ('🗣️', 'TA怎么说话', ['81', '82', '83', '57']),
    ('🫂', '哄', ['32', '63', '34', '28']),
    ('🚶', '陪你', ['50', '23', '03', '74', '33']),
    ('💓', '贴贴', ['49', '51']),
    ('🎛️', '开关和后台', ['17', '77', '16']),
    ('📱', '小手机', ['80', '24', '78', '01']),
]
# 不要了的（数据不删，插件从列表里拿掉）
RETIRED = ['📺 追剧进度', '🔐 我们的暗号']

def load(f):
    body = open(f, encoding='utf-8').read()
    if '__INTRO_EARLY__' in body: body = body.replace('__INTRO_EARLY__', json.dumps(open(os.path.join(src, 'intro-early.js'), encoding='utf-8').read(), ensure_ascii=False))
    name = re.sub(r'^\d+-', '', os.path.basename(f)[:-3])
    m = re.match(r'/\*\s*(\S+)\s+(.*?)\s*\*/', body, re.S)
    desc = (m.group(2) if m else name).split('：', 1)[-1].strip()
    icon = m.group(1) if m else ''
    return {'num': os.path.basename(f)[:2], 'name': name, 'full': f'{icon} {name}', 'icon': icon, 'desc': desc, 'body': body}

files = {load(f)['num']: load(f) for f in sorted(glob.glob(os.path.join(src, '[0-9]*.js')))}
inb = {n for _, _, L in BUNDLES for n in L}
if os.path.basename(out) == 'out':
    for f in glob.glob(os.path.join(out, '*.json')): os.remove(f)
allp, mapping = [], {}
def emit(name, desc, code, srcname):
    p = {'name': name, 'type': 'script', 'scope': 'global', 'enabled': True, 'description': desc, 'onLoad': common + '\n' + code + '\n//# sourceURL=gyx-plugin/' + srcname + '.js'}
    json.dump([p], open(os.path.join(out, re.sub(r'^\S+\s', '', name) + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    allp.append(p)
for num, p in files.items():
    if num in inb: continue
    emit(p['full'], p['desc'], p['body'], p['name'])
for icon, title, L in BUNDLES:
    ms = [files[n] for n in L]
    full = f'{icon} {title}'
    desc = f'合并了 {len(ms)} 个：' + ' · '.join(m['full'] for m in ms if m['num'] != '85') + '。每一个都还能在「插件开关中心」里单独关。'
    # 每个原插件单独跑（带自己的 sourceURL）：报错时知道是哪一个，省电模式的「插件体检」也还能按原来的名字认定时器
    code = '\n'.join(f'/* ==== {m["full"]} ==== */\ntry {{ new Function(\'X\', \'applyMacros\', {json.dumps(m["body"] + chr(10) + "//# sourceURL=gyx-plugin/" + m["name"] + ".js", ensure_ascii=False)})(X, typeof applyMacros !== \'undefined\' ? applyMacros : undefined); }} catch (e) {{ console.error(\'[插件] {m["full"]} 出错：\', e); }}' for m in ms)
    emit(full, desc, code, title)
    mapping[full] = [[m['full'], re.findall(r"X\.feat\('(\w+)'", m['body'])] for m in ms if m['num'] != '85']
json.dump(allp, open(os.path.join(out, '新玩法全家桶.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'bundles': mapping, 'retired': RETIRED}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bundles.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(allp), 'plugins')
