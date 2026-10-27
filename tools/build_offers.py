"""Build a ready-to-send offer for every SA lead demo site.

For each local/za-<id>/index.html this writes:
  offer-za/<id>/index.html   short link: opens the offer page with the business name, a clean
                             web address and their site in the preview (WhatsApp shows preview.jpg)
  offer-za/<id>/preview.jpg  link preview: their demo site on desktop (1200 x 803)
  offer-za/<id>/offer.jpg    branded offer image for WhatsApp (2160 x 2700)

Everything reads offer-za/offer.json (prices, lines, message, per-lead overrides) and
tools/offer-card.html (the image design). A lead is only re-rendered when its demo site,
offer.json or the template changed (offer-za/<id>/.stamp holds the fingerprint).

Run:  python3 tools/build_offers.py            (only what changed)
      python3 tools/build_offers.py --all      (force every lead)
      python3 tools/build_offers.py <id> ...   (just these leads)
Needs: pip install playwright && python -m playwright install chromium
Offline use (no internet): set DS_VENDOR to a node_modules folder holding gsap, lenis and the
@fontsource fonts; CDN and Google Fonts requests are then served from it.
"""
import hashlib, html, json, mimetypes, os, re, sys, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://digitalswitch.co.za/"
OFFER = ROOT / "offer-za"
CFG = json.loads((OFFER / "offer.json").read_text(encoding="utf-8"))
TPL = (ROOT / "tools" / "offer-card.html").read_text(encoding="utf-8")
VENDOR = Path(os.environ["DS_VENDOR"]) if os.environ.get("DS_VENDOR") else None

# words dropped when turning a business name into a pretend web address
DROP = {"pty", "ltd", "cc", "the", "and", "gauteng", "johannesburg", "joburg", "pretoria",
        "ekurhuleni", "randburg", "sandton", "company", "co", "services", "service", "solutions"}


def leads():
    for d in sorted(ROOT.glob("local/za-*/index.html")):
        lid = d.parent.name[3:]
        page = d.read_text(encoding="utf-8")
        m = re.search(r"<title>(.*?)</title>", page, re.S)
        name = html.unescape(m.group(1).split(" | ")[0]).strip() if m else lid
        yield lid, name, page


def domain_for(lid, name):
    o = CFG.get("leads", {}).get(lid, {})
    if o.get("domain"):
        return o["domain"]
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower().replace("&", " and ")) if w not in DROP]
    out = ""
    for w in words:
        if len(out) + len(w) > 24:
            break
        out += w
    return out or re.sub(r"[^a-z0-9]", "", name.lower())[:24]


def fmt(n):
    return f"{int(n):,}"


def fingerprint(page):
    h = hashlib.sha256()
    for part in (page, json.dumps(CFG, sort_keys=True), TPL, Path(__file__).read_text(encoding="utf-8")):
        h.update(part.encode("utf-8"))
    return h.hexdigest()[:16]


# ---------- serving the repo (and, offline, the CDN) to the headless browser ----------
EXTRA = {}  # url -> (body, content type)


def font_css(query):
    pk = {"Instrument Serif": "instrument-serif", "Geist": "geist", "Geist Mono": "geist-mono",
          "Unbounded": "unbounded", "Ballet": "ballet", "Inter Tight": "inter-tight", "IBM Plex Mono": "ibm-plex-mono"}
    css = []
    for fam in re.findall(r"family=([^&:]+)", query):
        pkg = pk.get(urllib.parse.unquote_plus(fam))
        if not pkg:
            continue
        for f in sorted((VENDOR / "@fontsource" / pkg).glob("*.css")):
            if re.match(r"^\d+(-italic)?$", f.stem):
                css.append(f.read_text().replace("url(./files/", f"url(https://fontsrv.test/{pkg}/files/"))
    return "\n".join(css)


def handler(route):
    url = route.request.url
    if url in EXTRA:
        body, ct = EXTRA[url]
        return route.fulfill(body=body, content_type=ct)
    if url.startswith(SITE):
        rel = urllib.parse.unquote(url[len(SITE):].split("?")[0].split("#")[0])
        p = ROOT / rel
        if p.is_dir() or rel == "" or rel.endswith("/"):
            p = p / "index.html"
        if p.is_file():
            return route.fulfill(path=str(p), content_type=mimetypes.guess_type(str(p))[0] or "application/octet-stream")
        return route.fulfill(status=404, body="")
    if VENDOR:
        if url.startswith("https://cdn.jsdelivr.net/npm/"):
            m = re.match(r"https://cdn.jsdelivr.net/npm/(@?[^@/]+(?:/[^@/]+)?)@[^/]+/(.*)", url)
            return route.fulfill(path=str(VENDOR / m.group(1) / m.group(2)), content_type="application/javascript")
        if url.startswith("https://fonts.googleapis.com/css"):
            return route.fulfill(body=font_css(url), content_type="text/css")
        if url.startswith("https://fontsrv.test/"):
            pkg, rest = url[len("https://fontsrv.test/"):].split("/", 1)
            return route.fulfill(path=str(VENDOR / "@fontsource" / pkg / rest), content_type="font/woff2")
        return route.abort()
    return route.continue_()


def short_link_html(lid, name):
    dom = domain_for(lid, name)
    prev = f"{SITE}offer-za/{lid}/preview.jpg"
    q = ("../?b=" + urllib.parse.quote(name) + "&d=" + urllib.parse.quote(dom)
         + "&s=" + urllib.parse.quote(prev, safe="") + "&u=" + urllib.parse.quote(f"{SITE}local/za-{lid}/", safe=""))
    t = html.escape(f"Your website offer: {name}")
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} | Digital Switch</title>
<meta property="og:title" content="{t}"><meta property="og:description" content="What is included, what it costs and how to get your site live in {html.escape(CFG.get('golive', '24 hours'))}.">
<meta property="og:image" content="{prev}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="803">
<meta name="robots" content="noindex"><meta name="theme-color" content="#071719">
<meta http-equiv="refresh" content="0; url={q}"><style>body{{background:#071719}}</style>
<script>location.replace('{q}'+location.hash)</script></head><body></body></html>
"""


def card_html(lid, name, shot_url):
    o = CFG.get("leads", {}).get(lid, {})
    size = "xlong" if len(name) > 44 else "long" if len(name) > 30 else ""
    lines = "".join(f"<li>{x}</li>" for x in o.get("card_includes", CFG["card_includes"]))
    rep = {"name": html.escape(name), "size": size, "setup": fmt(CFG["setup"]), "monthly": fmt(CFG["monthly"]),
           "includes": lines, "shot": shot_url, "tagline": html.escape(o.get("card_tagline", CFG["card_tagline"])),
           "wa": html.escape(CFG["whatsapp_display"])}
    out = TPL
    for k, v in rep.items():
        out = out.replace("{{" + k + "}}", v)
    left = re.findall(r"{{\w+}}", out)
    if left:
        sys.exit(f"offer-card.html has unfilled fields: {left}")
    return out


def main(argv):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    force = "--all" in argv
    only = [a for a in argv if not a.startswith("-")]
    todo = []
    for lid, name, page in leads():
        if only and lid not in only:
            continue
        out = OFFER / lid
        stamp = out / ".stamp"
        fp = fingerprint(page)
        if not force and not only and stamp.exists() and stamp.read_text().strip() == fp \
                and (out / "offer.jpg").exists() and (out / "preview.jpg").exists():
            continue
        todo.append((lid, name, fp))
    print(f"{len(todo)} lead(s) to build")
    if not todo:
        return
    tmp = ROOT / ".offer-tmp"
    tmp.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        phone = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
        desk = b.new_context(viewport={"width": 1344, "height": 900}, device_scale_factor=1.25)
        card = b.new_context(viewport={"width": 720, "height": 900}, device_scale_factor=3)
        for c in (phone, desk, card):
            c.route("**/*", handler)
        for lid, name, fp in todo:
            out = OFFER / lid
            out.mkdir(parents=True, exist_ok=True)
            site = f"{SITE}local/za-{lid}/"
            # 1. phone screenshot of their demo (goes inside the offer image)
            pg = phone.new_page(); pg.goto(site, wait_until="load"); pg.wait_for_timeout(4500)
            pg.screenshot(path=str(tmp / "phone.png")); pg.close()
            # 2. desktop screenshot -> WhatsApp link preview
            pg = desk.new_page(); pg.goto(site, wait_until="load"); pg.wait_for_timeout(4500)
            pg.screenshot(path=str(tmp / "desk.png")); pg.close()
            im = Image.open(tmp / "desk.png").convert("RGB")
            w, h = im.size
            cw = int(h * 1200 / 803)
            im.crop((0, 0, min(cw, w), h)).resize((1200, 803), Image.LANCZOS).save(out / "preview.jpg", quality=86, optimize=True)
            # 3. the branded offer image
            shot_url = f"{SITE}__offer_phone__/{lid}.png"
            EXTRA[shot_url] = ((tmp / "phone.png").read_bytes(), "image/png")
            card_url = f"{SITE}__offer_card__/{lid}.html"
            EXTRA[card_url] = (card_html(lid, name, shot_url), "text/html")
            pg = card.new_page(); pg.goto(card_url, wait_until="load"); pg.wait_for_timeout(1500)
            pg.screenshot(path=str(tmp / "card.png")); pg.close()
            Image.open(tmp / "card.png").convert("RGB").save(out / "offer.jpg", quality=88, optimize=True)
            # 4. short link
            (out / "index.html").write_text(short_link_html(lid, name), encoding="utf-8")
            (out / ".stamp").write_text(fp + "\n")
            print("built", lid)
        b.close()
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()


if __name__ == "__main__":
    main(sys.argv[1:])
