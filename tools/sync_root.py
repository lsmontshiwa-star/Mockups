"""Root of digitalswitch.co.za = the DS website. Copies ds/index.html to /index.html with paths fixed."""
import re
s = open('ds/index.html').read()
s = s.replace('"assets/', '"ds/assets/').replace("'assets/", "'ds/assets/")
s = s.replace('https://lsmontshiwa-star.github.io/Mockups/', '/')
s = s.replace('<!doctype html>', '<!doctype html>\n<!-- generated from ds/index.html by tools/sync_root.py: edit ds/index.html, not this file -->', 1)
open('index.html', 'w').write(s)
