"""Solar template builder.
Fill local/solar/template.html from local/solar/demos/<slug>.json -> local/<slug>/index.html.
Optional blocks are wrapped in <!--if:field--> ... <!--/if:field--> and dropped when the field is empty
(no fake numbers or reviews: anything the business hasn't given us simply doesn't appear).
Lists (areas, credentials, brands) are comma-separated strings."""
import json, glob, os, re, sys, urllib.parse, html
here = os.path.dirname(os.path.abspath(__file__))
local = os.path.dirname(here)
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
m = re.search(r'<script id="ds-view">.*?</script>', open(os.path.join(local, 'template.html'), encoding='utf-8').read(), re.S)
dsview = m.group(0) if m else ''
DEFAULTS = {'accent': '#ffb547', 'headline': 'Keep the lights on.', 'demo_note': '', 'work_label': 'Our work',
            'services_title': 'Three things. Done properly.', 'noon_title': 'Your roof, working.'}
targets = sys.argv[1:] or sorted(glob.glob(os.path.join(here, 'demos', '*.json')))
for f in targets:
    d = {**DEFAULTS, **json.load(open(f, encoding='utf-8'))}
    slug = d.get('slug') or os.path.splitext(os.path.basename(f))[0]
    d['wa_text'] = urllib.parse.quote(d.get('wa_text') or f"Hi {d['short_name']}, I saw your website and I'd like a solar quote.")
    out = tpl
    # drop optional blocks whose field is empty (innermost first)
    for _ in range(3):
        out = re.sub(r'<!--if:([a-z0-9_]+)-->(.*?)<!--/if:\1-->',
                     lambda mm: mm.group(2) if str(d.get(mm.group(1), '')).strip() else '', out, flags=re.S)
    for k, v in d.items():
        val = str(v) if k in ('wa_text', 'accent') else html.escape(str(v), quote=True)
        out = out.replace('{{' + k + '}}', val)
    left = sorted(set(re.findall(r'{{[a-z0-9_]+}}', out)))
    if left: sys.exit(f"{slug}: missing {left}")
    out = out.replace('<!--DSVIEW-->', dsview)
    os.makedirs(os.path.join(local, slug), exist_ok=True)
    open(os.path.join(local, slug, 'index.html'), 'w', encoding='utf-8').write(out)
    print('built', slug)
