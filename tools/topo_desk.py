"""Draws the header map: Cascade volcanoes and the Columbia at their real positions (km from Mt St Helens),
over stylized terrain contours. Writes src/topo.svg, which esbuild bundles into app.js."""
import numpy as np
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon

X0, X1, Y0, Y1, C = -440, 420, -210, 200, 0.75         # km, x east / y north of St Helens; C = cell size
xs = np.arange(X0, X1 + C, C); ys = np.arange(Y0, Y1 + C, C); X, Y = np.meshgrid(xs, ys)
rng = np.random.default_rng(8363)
sig = lambda v: 1 / (1 + np.exp(-v))
def noise(scale, amp):
    n = gaussian_filter(rng.standard_normal(X.shape), scale / C); return amp * n / n.std()

z = 60 + 1050 * sig((X + 38) / 11) + 380 * sig((-X - 82) / 7)            # Cascade foothills east, Coast Range west
rough = 0.8 + 0.2 * sig((X + 45) / 10)
z += 260 * sig((-X - 150) / 30) * (1 + noise(25, 0.6))           # rolling hills further west so the wide map has lines edge to edge
z += rough * (noise(9, 170) + noise(3.5, 70)) + noise(18, 40)
def cone(cx, cy, h, r, p=1.7):
    d = np.hypot(X - cx, Y - cy); return h * np.clip(1 - d / r, 0, 1) ** p
z += cone(33, 72, 3700, 24) + cone(54, 0, 3050, 21) + cone(38, -92, 2750, 19)
sth = cone(0, 0, 1700, 15)                                                 # St Helens with its north-facing horseshoe crater
d0 = np.hypot(X, Y); ang = np.arctan2(Y, X)
breach = np.clip(1 - np.abs(ang - np.pi / 2) / 0.55, 0, 1) * np.clip(1 - d0 / 7, 0, 1)
sth -= 520 * np.clip(1 - d0 / 2.6, 0, 1) ** 0.8 + 700 * breach
z += np.maximum(sth, 0)
river = np.array([(-440, 6), (-300, 3), (-200, 0), (-115, -2), (-80, -4), (-58, -7), (-50, -22), (-47, -35), (-42, -52), (-36, -62), (-25, -68), (-15, -73),
                  (0, -68), (12, -63), (23, -59), (38, -57), (52, -54), (70, -50), (100, -46), (180, -40), (300, -30), (420, -24)], float)
def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P[..., 0] - a[0]) * ab[0] + (P[..., 1] - a[1]) * ab[1]) / (ab @ ab), 0, 1)
    return np.hypot(P[..., 0] - (a[0] + t * ab[0]), P[..., 1] - (a[1] + t * ab[1]))
P = np.stack([X, Y], -1); dr = np.min([seg_dist(P, river[i], river[i + 1]) for i in range(len(river) - 1)], axis=0)
f = np.clip(dr / 9, 0, 1) ** 0.9; z = 6 + (z - 6) * f
z = gaussian_filter(z, 0.6 / C)

out = []
step = 120
for k, lvl in enumerate(np.arange(step, z.max(), step)):
    major = round(lvl) % 600 == 0
    ds = []
    for c in find_contours(z, lvl):
        if len(c) < 8: continue
        c = approximate_polygon(c, 0.8)
        pts = [(X0 + q[1] * C, -(Y0 + q[0] * C)) for q in c]
        ds.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts))
    if ds: out.append(f'<path d="{"".join(ds)}" stroke-width="{1.1 if major else 0.6}" stroke-opacity="{0.30 if major else 0.17}"/>')
rv = 'M' + 'L'.join(f'{x} {-y}' for x, y in river)
G = '#86a892'
svg = (f'<g fill="none" stroke="{G}" stroke-linejoin="round" vector-effect="non-scaling-stroke">{"".join(out).replace("<path ", "<path vector-effect=\"non-scaling-stroke\" ")}</g>'
       f'<path d="{rv}" fill="none" stroke="#8fb9c7" stroke-opacity=".45" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>')
open('www/topo-desk.svg', 'w').write(svg)
print(len(svg) // 1024, 'KB')
