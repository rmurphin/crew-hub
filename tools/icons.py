"""Home-screen icons: MP / NW stacked over the header's contour map, rendered with the app's own font."""
import pathlib
from playwright.sync_api import sync_playwright
H = pathlib.Path('.').resolve(); topo = (H / 'src/topo.svg').read_text()
font = (H / 'www/fonts/archivo-normal.woff2').as_uri()
def page(pad):  # pad = share of the icon kept clear for maskable/rounded crops
    return f"""<html><head><style>@font-face{{font-family:A;src:url({font});font-weight:100 900;font-stretch:62% 125%}}
html,body{{margin:0;width:512px;height:512px;background:#141815;overflow:hidden}}
svg{{position:absolute;inset:0}}
.m{{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;font:900 {int(178*(1-pad*1.4))}px/0.86 A;letter-spacing:-.02em;color:#fff}}
.m i{{color:#4fb576;font-style:italic}}</style></head><body>
<svg viewBox="-70 -55 110 110" width="512" height="512"><g transform="scale(1)">{topo}</g></svg>
<div class="m"><span>MP</span><i>NW</i></div></body></html>"""
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--allow-file-access-from-files'])
    for name, pad in [('icon-512.png', .04), ('icon-maskable-512.png', .12)]:
        pg = br.new_page(viewport={'width': 512, 'height': 512}); f = pathlib.Path('/tmp/icon.html'); f.write_text(page(pad))
        pg.goto(f.as_uri()); pg.wait_for_timeout(500); pg.screenshot(path=str(H / 'www' / name)); pg.close()
    br.close()
from PIL import Image
im = Image.open(H / 'www/icon-512.png').convert('RGB')
im.resize((192, 192), Image.LANCZOS).save(H / 'www/icon-192.png'); im.resize((180, 180), Image.LANCZOS).save(H / 'www/apple-touch-icon.png')
print('ok')
