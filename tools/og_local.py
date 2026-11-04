"""Gives every SA lead page (local/<slug>/) a link-preview picture of its own site.
When a rep sends the link on WhatsApp, the chat shows the site straight away.
Runs in GitHub Actions (needs Playwright + network for fonts). Usage: python3 tools/og_local.py [--force]"""
import html, os, re, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://digitalswitch.co.za'
force = '--force' in sys.argv
dirs = sorted(d for d in os.listdir(os.path.join(ROOT, 'local')) if os.path.isfile(os.path.join(ROOT, 'local', d, 'index.html')))

def meta_block(slug, name):
    img = f'{BASE}/local/{slug}/og.jpg'
    t = html.escape(f'{name}: website preview', quote=True)
    d = html.escape(f'A preview of the new website Digital Switch built for {name}. Open it on your phone.', quote=True)
    return ('<!-- ds-og -->\n'
            f'<meta property="og:type" content="website">\n<meta property="og:title" content="{t}">\n'
            f'<meta property="og:description" content="{d}">\n<meta property="og:image" content="{img}">\n'
            '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
            f'<meta property="og:url" content="{BASE}/local/{slug}/">\n<meta name="twitter:card" content="summary_large_image">\n'
            f'<meta name="twitter:image" content="{img}">\n<!-- /ds-og -->\n')

done = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    for slug in dirs:
        f = os.path.join(ROOT, 'local', slug, 'index.html')
        src = open(f, encoding='utf-8').read()
        img = os.path.join(ROOT, 'local', slug, 'og.jpg')
        has_meta = '<!-- ds-og -->' in src
        if has_meta and os.path.exists(img) and not force:
            continue
        if force or not os.path.exists(img):
            try:
                pg.goto('file://' + f, wait_until='networkidle', timeout=30000)
            except Exception:
                pass
            time.sleep(2.5)
            pg.screenshot(path=img, type='jpeg', quality=82)
        m = re.search(r'<title>(.*?)</title>', src, re.S)
        name = html.unescape(m.group(1)).split('|')[0].strip() if m else slug
        src = re.sub(r'<!-- ds-og -->.*?<!-- /ds-og -->\n', '', src, flags=re.S)
        src = src.replace('</head>', meta_block(slug, name) + '</head>', 1)
        open(f, 'w', encoding='utf-8').write(src)
        done += 1
    b.close()
print(f'og: updated {done} of {len(dirs)} lead pages')
