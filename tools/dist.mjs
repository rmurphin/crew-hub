// Rebuilds the published app in docs/ (served by GitHub Pages).
// Usage: python3 tools/topo.py && node tools/dist.mjs <sheet script /exec URL>
// Icons, font and manifest live in docs/ already; this only rewrites app.js, sw.js and index.html.
import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const feed = process.argv[2];
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(feed || '')) { console.error('Pass the sheet script /exec URL'); process.exit(1); }
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
mkdirSync('docs/fonts', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, minifySyntax: true, format: 'iife', target: ['es2020', 'safari15', 'chrome100'], loader: { '.svg': 'text' },
  define: { __FEED__: JSON.stringify(feed), __PREVIEW__: 'false' }, outfile: 'docs/app.js' });
copyFileSync('www/index.html', 'docs/index.html');
// first-time setup from the working folder: copy assets if docs/ doesn't have them yet
for (const f of ['topo-desk.svg', 'demo.json', 'icon-pc-512.png', 'manifest-pc.webmanifest', 'sc-week.png', 'sc-cal.png', 'sc-newjob.png', 'sc-receipt.png', 'icon-pc-16.png', 'icon-pc-32.png', 'icon-pc-48.png', 'icon-pc-64.png', 'icon-pc-96.png', 'icon-pc-128.png', 'icon-pc-256.png', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'fonts/archivo.woff2'])
  if (!existsSync('docs/' + f) && existsSync('www/' + f)) copyFileSync('www/' + f, 'docs/' + f);
writeFileSync('docs/sw.js', readFileSync('src/sw.js', 'utf8').replace('__BUILD__', stamp));
const js = readFileSync('docs/app.js', 'utf8');
for (const bad of ['mockKeys', 'data.json']) if (js.includes(bad)) { console.error('preview data leaked into build: ' + bad); process.exit(1); }
console.log('docs/ built', stamp, (js.length / 1024).toFixed(0) + ' KB');
