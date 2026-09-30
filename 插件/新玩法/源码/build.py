import json, os, re, glob
src = os.path.dirname(os.path.abspath(__file__))
out = os.path.dirname(src)
common = open(os.path.join(src, '_common.js'), encoding='utf-8').read()
allp = []
for f in sorted(glob.glob(os.path.join(src, '[0-9]*.js'))):
    body = open(f, encoding='utf-8').read()
    if '__INTRO_EARLY__' in body: body = body.replace('__INTRO_EARLY__', json.dumps(open(os.path.join(src, 'intro-early.js'), encoding='utf-8').read(), ensure_ascii=False))
    name = re.sub(r'^\d+-', '', os.path.basename(f)[:-3])
    m = re.match(r'/\*\s*(\S+)\s+(.*?)\s*\*/', body, re.S)
    desc = (m.group(2) if m else name).split('：', 1)[-1].strip()
    icon = m.group(1) if m else ''
    p = {'name': f'{icon} {name}', 'type': 'script', 'scope': 'global', 'enabled': True, 'description': desc, 'onLoad': common + '\n' + body}
    json.dump([p], open(os.path.join(out, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    allp.append(p)
json.dump(allp, open(os.path.join(out, '新玩法全家桶.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(allp), 'plugins')
