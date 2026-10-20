"""Fill local/template.html from local/demos/<slug>.json -> local/<slug>/index.html.
The pipeline (Apps Script) uses the same template + field names for real leads."""
import json, glob, os, re, urllib.parse, sys
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
U = lambda pid: f"https://images.unsplash.com/photo-{pid}?q=80&w=1600&auto=format&fit=crop"
for f in sorted(glob.glob(os.path.join(here, 'demos', '*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    slug = os.path.splitext(os.path.basename(f))[0]
    for k in list(d):
        if k.endswith('_image') and not d[k].startswith('http'): d[k] = U(d[k])
    d['wa_text'] = urllib.parse.quote(d.get('wa_text', f"Hi {d['business_name']}, I found you online and would like to ask about"))
    out = tpl
    for k, v in d.items():
        out = out.replace('{{' + k + '}}', str(v))
    left = sorted(set(re.findall(r'{{[a-z0-9_]+}}', out)))
    if left: sys.exit(f"{slug}: missing {left}")
    os.makedirs(os.path.join(here, slug), exist_ok=True)
    open(os.path.join(here, slug, 'index.html'), 'w', encoding='utf-8').write(out)
    print('built', slug)
