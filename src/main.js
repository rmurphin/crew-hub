// MPNW Crew Hub: where the crew goes each day, and what the job needs.
// Data comes from the company tracker (Google Sheet) through a crew-safe feed: no costs, notes or pay.
import TOPO_MAP from './topo.svg';
import TOPO_FILL from './topo-fill.svg';
// Set at build time: the sheet's feed in the published app, sample data.json in the preview.
const DATA_URL = __FEED__;
const VERSION = '1.0';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const keyOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const today = () => keyOf(new Date());
const mondayOf = k => { const d = fromKey(k); return addDays(k, -((d.getDay() + 6) % 7)); };
const fmtDay = (k, o) => fromKey(k).toLocaleDateString('en-US', o);
const first = n => String(n || '').split(' ')[0];
const time12 = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${(h % 12) || 12}:${pad(m || 0)} ${h < 12 ? 'AM' : 'PM'}`; };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('hub.' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('hub.' + k, JSON.stringify(v)); } catch (e) {} }
};
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const mapsUrl = a => { a = String(a || '').replace(/\s*\(.*?\)\s*/g, ' ').trim(); return isIOS ? `https://maps.apple.com/?daddr=${encodeURIComponent(a)}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`; };
const linkify = t => esc(t).replace(/(\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4})/g, m => `<a href="tel:${m.replace(/\D/g, '')}">${m}</a>`)
  .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, m => `<a href="mailto:${m}">${m}</a>`).replace(/\n/g, '<br>');

/* ---------- icons ---------- */
const I = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const NAV = I('<path d="M3 11l18-8-8 18-2-8-8-2z"/>');
const PIN = I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 18);
const INFO = I('<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6M9 18h4"/>');
const GEAR = I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>');
const WARN = I('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>', 18);
const L = I('<path d="M15 5l-7 7 7 7"/>'), R = I('<path d="M9 5l7 7-7 7"/>');
const SEARCH = I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>');
const LINK = I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 18);
// Header map (Cascade volcanoes + Columbia River), drawn once and reused by every dark header.
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="topo-map">${TOPO_MAP}</g></defs></svg>`);
// Landmarks sit at their real positions in km from Mt St Helens (x east, y north). Labels are drawn in screen pixels so they stay crisp.
const MARKS = [
  { n: 'MT ST HELENS', f: '8,363 FT', x: 0, y: 0, main: true }, { n: 'MT ADAMS', f: '12,281 FT', x: 54, y: 0, side: 'adams' },
  { n: 'MT RAINIER', f: '14,411 FT', x: 33, y: 72 }, { n: 'MT HOOD', f: '11,249 FT', x: 38, y: -92 },
  { n: 'VANCOUVER', x: -36, y: -62, town: true }, { n: 'PORTLAND', x: -40, y: -77, town: true }, { n: 'COLUMBIA RIVER', x: 2, y: -71.5, river: true }];
// Where Mt St Helens lands in each header, chosen so labels sit in open space beside the header's own text and buttons.
// Short headers only label the two peaks; the full map (river, towns, Rainier, Hood) shows on the sign-in screen.
const DESK_MAP = { ok: false, loading: false };
function loadDeskMap() {
  if (DESK_MAP.ok || DESK_MAP.loading || !desk()) return; DESK_MAP.loading = true;
  fetch('topo-desk.svg').then(r => r.ok ? r.text() : Promise.reject()).then(svg => {
    document.querySelector('#topo-map').insertAdjacentHTML('afterend', `<g id="topo-desk">${svg}</g>`); DESK_MAP.ok = true;
    if (S.data && !S.splashHold) render();
  }).catch(() => { DESK_MAP.loading = false; });
}
const SPOTS = { today: { x: '55%', y: 100, k: 2.6, few: 1 }, bar: { x: '40%', y: 30, k: 2.6, adams: 'b', few: 1 }, job: { x: '47%', y: 24, k: 2.6, adams: 'b', few: 1 }, splash: { x: '50%', y: () => Math.round(innerHeight * .5), k: 2.6, few: 1 }, link: { x: '47%', y: () => Math.round(Math.max(510, innerHeight * .64)), k: 2.6 } };
const TOPO = spot => {
  let { x, k, adams = 'a', few } = SPOTS[spot]; const y = typeof SPOTS[spot].y === 'function' ? SPOTS[spot].y() : SPOTS[spot].y, G = '#9cc4a8', W = '#eef2ee';
  // Computers: header bands use the wide map so the lines reach both edges; the opening screen shows the map bigger.
  const wide = desk() && spot !== 'splash' && spot !== 'link' && DESK_MAP.ok;
  if (wide) { k = 2.6 * Math.max(1, (innerWidth - 236) / 2000); if (spot === 'bar' || spot === 'job') x = '68%'; }
  else if (desk() && spot === 'splash') k = 2.6 * Math.min(2.4, Math.max(1, innerWidth / 820));
  const t = (px, py, txt, size, wt, fill, op, end, more = '') => `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="${size}" font-weight="${wt}" fill="${fill}" opacity="${op}" letter-spacing=".07em"${end ? ' text-anchor="end"' : ''}${more}>${txt}</text>`;
  const marks = MARKS.filter(m => !few || m.main || m.side).map(m => {
    const px = m.x * k, py = -m.y * k;
    if (m.town) return `<circle cx="${px}" cy="${py}" r="2.2" fill="${W}" opacity=".5"/>` + t(px + 5, py + 3.5, m.n, 9, 700, W, .5);
    if (m.river) return t(px, py, m.n, 9, 650, '#8fb9c7', .65, false, ' font-style="italic"');
    const s = m.main ? 5.5 : 4.2, col = m.main ? G : W, op = m.main ? .9 : .55, side = m.side === 'adams' ? adams : 'r';
    const tri = `<path d="M${px} ${py - s * 1.2}L${px + s} ${py + s * .6}L${px - s} ${py + s * .6}Z" fill="${m.main ? col : 'none'}" stroke="${col}" stroke-width="1.3" opacity="${op}"/>`;
    const [nx, ny, fy, end] = side === 'r' ? [px + s + 5, py + 1, py + 11, false] : side === 'a' ? [px + s, py - s - 15, py - s - 6, true] : [px + s, py + s + 12, py + s + 21, true];
    return tri + t(nx, ny, m.n, m.main ? 10.5 : 9, m.main ? 800 : 750, col, op, end) + t(nx, fy, m.f, m.main ? 8.5 : 8, 600, col, op * .8, end);
  }).join('');
  return `<svg class="topo${wide ? ' wide' : ''}" aria-hidden="true" focusable="false"><svg x="${x}" y="${y}" overflow="visible"><g transform="scale(${k})"><use href="#${wide ? 'topo-desk' : 'topo-map'}"/></g>${marks}</svg></svg>`;
};
const LOGO = '<div class="logo">MP<i>NW</i><small>CREW HUB</small></div>';

/* ---------- state ---------- */
// Sign-in is a personal link: hub-link?u=CODE. Each person's code lives in Paul's sheet; changing it retires the old link.
// The code stays in the address on purpose, so an iPhone home-screen icon (which keeps its own storage) opens already signed in.
const urlKey = new URLSearchParams(location.search).get('u');
if (urlKey && urlKey !== store.get('key')) { store.set('key', urlKey); store.set('me', null); store.set('data', null); }
const S = { key: urlKey || store.get('key'), bad: false, data: store.get('data'), me: store.get('me'), tab: 'today', week: mondayOf(today()), month: today().slice(0, 8) + '01', sel: today(), mine: true, q: '', job: null, offline: false, changed: new Set(Object.keys(store.get('changed') || {})), glowDone: new Set() };
const jobById = id => (S.data?.jobs || []).find(j => j.id === id);
const rowsOn = k => (S.data?.schedule || []).filter(r => r.date === k).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
const mineOn = k => rowsOn(k).filter(r => r.crew.includes(S.me));
const cleanAddr = a => String(a || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
const city = a => { const p = cleanAddr(a).split(','); return p.length > 1 ? p[p.length - 2].trim() : ''; };

// Preview only: the published feed checks the code in the sheet and answers with that person's name, or nothing.
const PREVIEW = __PREVIEW__;
// Which days changed since this phone last saw the schedule. Kept for a day so the "Updated" tag survives app switches.
const rowSig = r => JSON.stringify([r.job, [...r.crew].sort(), r.start, r.notes]);
const daySigs = sched => { const m = {}; for (const r of sched || []) (m[r.date] ||= []).push(rowSig(r)); for (const k in m) m[k] = m[k].sort().join('|'); return m; };
function trackChanges(prev, next) {
  const now = Date.now(), map = Object.fromEntries(Object.entries(store.get('changed') || {}).filter(([d, t]) => now - t < 864e5 && d >= today()));
  const fresh = [];
  if (prev?.schedule) { const a = daySigs(prev.schedule), b = daySigs(next.schedule); for (const d of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[d] !== b[d] && d >= today()) { map[d] = now; fresh.push(d); } }
  store.set('changed', map); S.changed = new Set(Object.keys(map)); return fresh.sort();
}
async function load(manual) {
  if (!S.key) return render();
  let fresh = [];
  try {
    const r = await fetch(PREVIEW ? DATA_URL : DATA_URL + '?u=' + encodeURIComponent(S.key), { cache: 'no-store' });
    if (!r.ok) throw new Error('http');
    const d = await r.json(); if (__PREVIEW__) { d.me = (d.mockKeys || {})[S.key] || null; d.canEdit = (d.mockEditors || []).includes(d.me); if (!d.canEdit) { d.myReceipts = (d.receipts || []).filter(r => r.by === d.me); delete d.receipts; } } // preview only: sample data carries test codes
    S.offline = false;
    if (!d.me) { S.bad = true; S.me = S.data = null; store.set('me', null); store.set('data', null); }
    else { S.bad = false; S.me = d.me; fresh = trackChanges(S.data, d); S.data = d; store.set('me', d.me); store.set('data', d); }
  } catch (e) { S.offline = true; }
  render(); loadWeather();
  if (fresh.length && document.hidden && navigator.setAppBadge) { S.badge = (S.badge || 0) + fresh.length; navigator.setAppBadge(S.badge).catch(() => {}); }
  if (fresh.length) toast('Schedule updated: ' + (fresh.length > 3 ? fresh.length + ' days changed' : fresh.map(d => fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')));
  else if (manual) toast(S.offline ? 'No signal. Showing the last schedule.' : 'Schedule is up to date.');
}

/* ---------- pieces ---------- */
// Prevailing wage: the job's public rate from its tracker tab. Nobody's own pay rate is ever in the feed.
const usd = n => '$' + Number(n).toFixed(2);
const DOLLAR = I('<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4.2 1.3-4.2 3.1 0 4.5 9 2.3 9 6.8 0 1.9-1.8 3.2-4.6 3.2-2.3 0-4-.8-4.9-2.3"/>', 18);
const pwStrip = j => j?.pw ? `<div class="pw">${DOLLAR}<span class="pwk">Prevailing wage</span><b>${usd(j.pw.rate)}<small>/hr</small></b></div>` : '';
const pwPill = j => j?.pw ? '<span class="pill pwp">PW</span>' : '';
// Each person gets a small initial badge in a steady color of their own.
const AV = ['#4f7f68', '#5b7fa8', '#a8834a', '#9a6a5a', '#7a6fa6', '#4f8a87', '#8c6a86', '#6f7f4f'];
const avColor = n => AV[[...String(n)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length];
const crewChips = (names, skipMe) => names.filter(n => !(skipMe && n === S.me)).map(n => `<span class="chip${n === S.me ? ' me' : ''}"><i class="av" style="background:${avColor(n)}">${esc(first(n)[0] || '')}</i>${esc(first(n))}</span>`).join('');
const updated = () => {
  if (!S.data?.updated) return '';
  const d = new Date(S.data.updated), t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = keyOf(d) === today() ? '' : ' ' + d.toLocaleDateString('en-US', { weekday: 'short' });
  return `<div class="upd${S.offline ? ' off' : ''}">${S.offline ? 'Offline: showing schedule from' : 'Updated'}${day} ${t}</div>`;
};
function assignCard(r, label, small) {
  const j = jobById(r.job);
  if (!j) return `<div class="card${small ? ' sm' : ' hero'}"><div class="kick">${label}</div><div class="jn">No work</div>${r.notes ? `<div class="meta">${esc(r.notes)}</div>` : ''}</div>`;
  const others = r.crew.filter(n => n !== S.me);
  return `<div class="card${small ? ' sm' : ' hero'}${!small && r.date === today() ? ' live' : ''}${S.changed.has(r.date) ? ' chg' : ''}" data-date="${r.date}" data-vt="${j.id}">
    <div class="kick">${label}${S.changed.has(r.date) ? '<strong class="ctag">Updated</strong>' : ''}<span class="time">${time12(r.start).replace(/ (AM|PM)$/, '<small>$1</small>')}</span></div>
    <div class="jn">${jdot(j.id)}${esc(j.name)}</div>
    <div class="meta">${esc(j.gc ? 'GC: ' + j.gc : '')}</div>
    ${j.address ? `<div class="addr">${PIN}<span>${esc(j.address)}</span></div>` : ''}
    ${wxLine(j, r.date)}
    ${pwStrip(j)}
    ${small ? '' : `<div class="btns">${j.address ? `<a class="btn go" href="${mapsUrl(j.address)}" target="_blank" rel="noopener">${NAV}Navigate</a>` : '<span></span>'}<button class="btn" data-job="${j.id}">${INFO}Job info</button></div>`}
    ${others.length ? `<div class="with">With ${crewChips(others)}</div>` : ''}
    ${r.notes ? `<div class="note">${WARN}<span>${esc(r.notes)}</span></div>` : ''}
    ${small ? `<div class="btns" style="grid-template-columns:1fr"><button class="btn" data-job="${j.id}">${INFO}Job info</button></div>` : ''}
  </div>`;
}

/* ---------- screens ---------- */
function linkScreen() {
  $('#tabs').hidden = true;
  const [h, p] = S.bad ? ['This link was replaced', 'Paul set up a new link for you. Ask him to text it, then open the new one.']
    : S.key ? ['Signing you in…', S.offline ? 'Can\'t reach the schedule. Check your signal and try again.' : '']
    : ['Open your personal link', 'Paul texts each person their own link. Open it on your phone and you\'re signed in for good.'];
  $('#app').innerHTML = `<div class="who">${TOPO('link')}<div class="w">${LOGO}<h1>${h}</h1><p>${p}</p>
    ${S.key && S.offline ? '<button class="btn go" data-act="refresh">Try again</button>' : ''}
    ${S.key ? '' : `<div class="lk">${LINK}<span>No link? Text Paul.</span></div>`}</div></div>`;
}
function todayScreen() {
  const k = today(), mine = mineOn(k), all = rowsOn(k), off = all.find(r => !r.job);
  let next = null;
  for (let i = 1; i <= 21 && !next; i++) { const d = addDays(k, i), m = mineOn(d); if (m.length) next = { d, r: m }; }
  const tmr = addDays(k, 1), tmrRows = mineOn(tmr), evening = new Date().getHours() >= 15 && tmrRows.length;
  const todayBlock = mine.length ? mine.map(r => assignCard(r, evening ? 'Today' : 'Today', !!evening)).join('') : `<div class="card calm${evening ? ' sm' : ' hero'}"><svg class="ctopo" viewBox="-30 -18 60 36" aria-hidden="true"><use href="#topo-map"/></svg><div class="kick">Today</div><div class="jn">${off ? esc(off.notes || 'No work today') : 'Not scheduled today'}</div><div class="empty">${off ? '' : 'Nothing on the schedule for you. Check with Riley if that seems wrong.'}</div></div>`;
  const tmrLabel = fmtDay(tmr, { weekday: 'short', month: 'short', day: 'numeric' });
  $('#app').innerHTML = `<header class="band tall">${TOPO('today')}<div class="w"><div class="top">${LOGO}<span class="tbtns"><button class="icb" data-act="search" aria-label="Search everything">${SEARCH}</button><button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></span></div>
    <div class="hi"><h1>Hi ${esc(first(S.me))}</h1><p>${fmtDay(k, { weekday: 'long', month: 'long', day: 'numeric' })}</p>${updated()}</div></div></header>`;
  const colA = evening ? tmrRows.map(r => assignCard(r, 'Tomorrow · ' + tmrLabel, false)).join('') : todayBlock;
  const colB = (evening ? `<div class="sec">Earlier today</div>` + todayBlock
      : tmrRows.length ? `<div class="sec">Tomorrow · ${tmrLabel}</div>` + tmrRows.map(r => assignCard(r, fmtDay(tmr, { weekday: 'long' }), true)).join('')
      : next ? `<div class="sec">Next up · ${fmtDay(next.d, { weekday: 'short', month: 'short', day: 'numeric' })}</div>` + next.r.map(r => assignCard(r, fmtDay(next.d, { weekday: 'long' }), true)).join('') : '')
    + `<button class="rbtn" data-act="radd">${RCPT}<span><b>Add a receipt</b><small>Gas, supplies, food. Type it in, it goes to the office.</small></span></button>`;
  // Two columns on a computer; on a phone the columns just stack.
  $('#app').innerHTML += `<main class="w lift tcols"><div class="col">${colA}</div><div class="col">${colB}</div></main>`;
}
function daySection(d, rows) {
  return `<section class="day${d === today() ? ' now' : ''}${S.changed.has(d) ? ' chg' : ''}" data-date="${d}"><div class="dh">${fmtDay(d, { weekday: 'long' })}<span>${fmtDay(d, { month: 'short', day: 'numeric' })}</span>${S.changed.has(d) ? '<strong class="ctag">Updated</strong>' : ''}${d === today() ? '<em>Today</em>' : ''}</div>
      ${rows.length ? rows.map(r => r.job ? `<button class="as${canEdit() ? ' ed' : ''}${r.crew.includes(S.me) ? ' me' : ''}" ${canEdit() ? `data-edrow="${esc(JSON.stringify(r))}"` : `data-job="${r.job}"`}><span class="t">${time12(r.start).replace(' ', ' ')}</span><span class="n">${jdot(r.job)}${esc(jobById(r.job)?.name || r.job)}${pwPill(jobById(r.job))}</span><span class="c">${crewChips(r.crew)}${wxMini(jobById(r.job), r.date)}</span>${canEdit() ? `<span class="pen" aria-hidden="true">${PENCIL}</span>` : ''}${r.notes ? `<span class="x">${esc(r.notes)}</span>` : ''}</button>`
        : canEdit() ? `<button class="dn dno" data-edrow="${esc(JSON.stringify(r))}">${esc(r.notes || 'No work')}<span class="pen" aria-hidden="true">${PENCIL}</span></button>` : `<div class="dn">${esc(r.notes || 'No work')}</div>`).join('') : `<div class="dn dcalm"><svg class="ctopo" viewBox="-20 -6 40 12" aria-hidden="true"><use href="#topo-map"/></svg><span>Open day</span></div>`}</section>`;
}
// Each job keeps one color everywhere on the calendar (bars, legend, day list). Mid tones read on light and dark.
const PALETTE = ['#22a861', '#2f7be0', '#eba312', '#ec5b37', '#8b5cf6', '#0ea5a5', '#e0418f', '#7fae12', '#b5793a'];
const jobColor = id => { const ids = [...new Set((S.data?.schedule || []).filter(r => r.job).map(r => r.job))].sort(); const i = ids.indexOf(id); return i < 0 ? '#8a938c' : PALETTE[i % PALETTE.length]; };
function calScreen() {
  const m0 = S.month, first = fromKey(m0), start = mondayOf(m0), mm = m0.slice(0, 7);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0), weeks = Math.ceil(((first.getDay() + 6) % 7 + lastDay.getDate()) / 7);
  const rowsFor = d => rowsOn(d);  // everyone; your own days get a dot
  const cells = [...Array(weeks * 7)].map((_, i) => {
    const d = addDays(start, i), rows = rowsFor(d), jobs = rows.filter(r => r.job), off = rows.find(r => !r.job), out = d.slice(0, 7) !== mm;
    const cls = ['cd', jobs.some(r => r.crew.includes(S.me)) && 'mine', out && 'out', d === today() && 'tdy', d === S.sel && 'sel', off && 'off', S.changed.has(d) && 'chg', i % 7 > 4 && 'we', d < today() && 'past'].filter(Boolean).join(' ');
    const label = `${fmtDay(d, { weekday: 'long', month: 'long', day: 'numeric' })}: ${off ? esc(off.notes || 'off') : jobs.length ? jobs.map(r => esc(jobById(r.job)?.name || r.job)).join(', ') : 'nothing scheduled'}`;
    return `<button class="${cls}" data-day="${d}" aria-label="${label}"${d === S.sel ? ' aria-pressed="true"' : ''}><b>${+d.slice(8)}</b>${off ? '<span class="ofl">Off</span>' : `<span class="bars">${jobs.slice(0, 3).map(r => `<i style="background:${jobColor(r.job)}"></i>`).join('')}${jobs.length > 3 ? `<span class="more">+${jobs.length - 3}</span>` : ''}</span><span class="cn">${jobs.slice(0, 3).map(r => `<i data-cj="${r.job}" style="--c:${jobColor(r.job)}">${esc(jobById(r.job)?.name || r.job)}</i>`).join('')}${jobs.length > 3 ? `<small>+${jobs.length - 3} more</small>` : ''}</span>`}</button>`;
  }).join('');
  const seen = [...new Set((S.data?.schedule || []).filter(r => r.job && r.date.startsWith(mm)).map(r => r.job))];
  const legend = seen.map(id => `<button class="lg" data-job="${id}"><i style="background:${jobColor(id)}"></i>${esc(jobById(id)?.name || id)}</button>`).join('');
  $('#app').innerHTML = `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<span class="tbtns"><button class="icb" data-act="search" aria-label="Search everything">${SEARCH}</button><button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></span></div>
    <div class="wk"><button data-act="mprev" aria-label="Previous month">${L}</button><b>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<br>${mm === today().slice(0, 7) ? '<span class="mt">This month</span>' : '<button class="jt" data-act="mnow">Back to this month</button>'}</b><button data-act="mnext" aria-label="Next month">${R}</button></div></div></header>
  <main class="w calw"><div class="cal"><div class="cw" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div><div class="cg">${cells}</div>
    ${legend ? `<p class="mykey"><i></i>Days you're on the schedule</p>` : `<p class="empty" style="margin:12px 4px 2px">Nothing scheduled this month.</p>`}</div>
    ${daySection(S.sel, rowsFor(S.sel))}
    ${legend ? `<div class="sec">Jobs this month</div><div class="legend">${legend}</div>` : ''}</main>`;
}
function weekScreen() {
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  const label = `${fmtDay(days[0], { month: 'short', day: 'numeric' })} – ${fmtDay(days[6], { month: 'short', day: 'numeric' })}`;
  $('#app').innerHTML = `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<span class="tbtns"><button class="icb" data-act="search" aria-label="Search everything">${SEARCH}</button><button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></span></div>
    <div class="wk"><button data-act="wprev" aria-label="Previous week">${L}</button><b>${S.week === mondayOf(today()) ? 'This week' : label}<br><span style="font-weight:500;font-size:13px;color:#9aa69d">${label}</span></b><button data-act="wnext" aria-label="Next week">${R}</button></div></div></header>
  <main class="w board">${days.map(d => {
    const rows = rowsOn(d), wkend = [0, 6].includes(fromKey(d).getDay());
    if (wkend && !rows.length) return '';
    return daySection(d, rows);
  }).join('')}</main>`;
}
function jobLists() {
  const q = S.q.trim().toLowerCase(), all = (S.data?.jobs || []).filter(j => !q || (j.name + ' ' + j.gc + ' ' + j.address).toLowerCase().includes(q));
  return { on: all.filter(j => j.status === 'In Progress'), up: all.filter(j => j.status !== 'In Progress').sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999')) };
}
function jobsScreen() { $('#app').innerHTML = jobsHTML(); }
function jobsHTML(listOnly) {
  const { on, up } = jobLists();
  const row = j => `<button class="jl${desk() && j.id === S.job ? ' sel' : ''}" data-job="${j.id}"><div class="n">${jdot(j.id)}${esc(j.name)}${pwPill(j)}${canEdit() && jobTotal(j.id) ? `<span class="jt">${money(jobTotal(j.id))}</span>` : ''}</div>
    <div class="m">${esc([j.gc, city(j.address)].filter(Boolean).join(' · '))}${j.start && j.status !== 'In Progress' && j.start >= today() ? ' · starts ' + fmtDay(j.start, { month: 'short', day: 'numeric', year: j.start.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }) : ''}</div></button>`;
  const list = `${on.length ? `<div class="sec">In progress</div>${on.map(row).join('')}` : ''}${up.length ? `<div class="sec">Coming up</div>${up.map(row).join('')}` : ''}${!on.length && !up.length ? '<p class="empty" style="margin-top:20px">No jobs match.</p>' : ''}`;
  if (listOnly) return list;
  return `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<span class="tbtns"><button class="icb" data-act="search" aria-label="Search everything">${SEARCH}</button><button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></span></div>
    <label class="search">${SEARCH}<input id="q" type="search" placeholder="Search jobs, GCs, cities" value="${esc(S.q)}" autocomplete="off"></label></div></header>
  <main class="w">${on.length ? `<div class="sec">In progress</div>${on.map(row).join('')}` : ''}${up.length ? `<div class="sec">Coming up</div>${up.map(row).join('')}` : ''}${!on.length && !up.length ? '<p class="empty" style="margin-top:20px">No jobs match.</p>' : ''}</main>`;
}
// Computer: one header across the top, the job list on the left and the chosen job on the right.
function deskJobs() {
  if (!jobById(S.job)) { const { on, up } = jobLists(), all = S.data?.jobs || []; S.job = (on[0] || up[0] || all.find(j => j.status === 'In Progress') || all[0])?.id || null; }
  const head = `<header class="band djh">${TOPO('bar')}<div class="w"><div class="top"><div class="djt"><h1>Jobs</h1><label class="search">${SEARCH}<input id="q" type="search" placeholder="Search jobs, GCs, cities" value="${esc(S.q)}" autocomplete="off"></label></div><span class="tbtns"><button class="icb" data-act="search" aria-label="Search everything">${SEARCH}</button><button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></span></div></div></header>`;
  let pane = '<p class="empty" style="padding:40px 8px">No jobs yet.</p>';
  if (S.job) {
    jobScreen(); const a = $('#app'), q = s => a.querySelector(s)?.outerHTML || '';
    pane = `<div class="jhd"><div>${q('.jp h1')}${q('.jp > p')}</div>${q('.edb')}</div>${q('main')}`;
  }
  $('#app').innerHTML = `${head}<div class="w split"><aside class="jlist">${jobsHTML(true)}</aside><section class="pane" aria-label="Job details">${pane}</section></div>`;
}
function jobScreen() {
  const j = jobById(S.job); if (!j) { S.job = null; return render(); }
  const site = j.site || {}, wk = (S.data.schedule || []).filter(r => r.job === j.id && r.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const tag = (l, v) => v ? `<span class="tag${/tbd|confirm/i.test(v) ? ' tbd' : ''}">${l ? l + ' ' : ''}<b>${esc(v)}</b></span>` : '';
  const na = v => /^n\/?a\b/i.test(String(v || '').trim()) ? '' : v;
  const step = s => `<${canEdit() ? `button class="st ed" data-sidx="${j.scope.indexOf(s)}"` : 'div class="st"'}>${canEdit() ? `<span class="pen">${PENCIL}</span>` : ''}${s.scope ? `<div class="s">${esc(s.scope)}</div>` : ''}${s.product ? `<div class="p">${esc(s.product)}</div>` : ''}
    <div class="tags">${tag('Color', na(s.color))}${tag('', na(s.sheen))}${s.coats ? tag('Coats', s.coats) : ''}${tag(/sf\/gal/i.test(s.sqft) ? 'Coverage' : 'Area', na(s.sqft))}${s.gallons ? tag('Qty', /\D/.test(s.gallons) ? s.gallons : s.gallons + ' gal') : ''}</div></${canEdit() ? 'button' : 'div'}>`;
  const groups = []; for (const s of j.scope || []) { const g = groups[groups.length - 1]; if (g && g.area === s.area) g.items.push(s); else groups.push({ area: s.area, items: [s] }); }
  const spec = g => `<div class="sp"><div class="a">${esc(g.area)}</div>${g.items.map(step).join('')}</div>`;
  $('#app').innerHTML = `<header class="band">${TOPO('job')}<div class="w jp"><div class="jtop"><button class="back" data-act="back">${L}Back</button>${canEdit() ? `<button class="edb" data-act="jedit">${PENCIL}Edit job</button>` : ''}</div>
    <h1>${jdot(j.id)}${esc(j.name)}</h1><p>${esc([j.gc && 'GC: ' + j.gc, j.type].filter(Boolean).join(' · '))}${j.status === 'In Progress' ? '<span class="pill on">In progress</span>' : ''}</p></div></header>
  <main class="w jcols"><div class="col">
    <div class="card">${siteMap(j)}${j.address ? `<div class="addr" style="margin:0">${PIN}<span>${esc(j.address)}</span></div><div class="btns" style="grid-template-columns:1fr"><a class="btn go" href="${mapsUrl(j.address)}" target="_blank" rel="noopener">${NAV}Navigate</a></div>` : '<div class="empty">No address yet.</div>'}
      ${pwStrip(j)}
      ${j.crewNotes ? `<div class="note">${WARN}<span>${esc(j.crewNotes)}</span></div>` : ''}</div>
    ${jobProgress(j)}
    ${j.geo && WX.data[geoKey(j)] ? `<div class="sec">Weather at the site</div><div class="card wxd">${[...Array(5)].map((_, n) => { const d = addDays(today(), n), w = wxFor(j, d); if (!w) return '';
      return `<div class="wd"><b>${n ? fmtDay(d, { weekday: 'short' }) : 'Today'}</b>${wxIcon(w.code, 24)}<span>${w.hi}° <i>${w.lo}°</i></span><small>${w.pop}%</small></div>`; }).join('')}</div>` : ''}
    </div><div class="col">
    <div class="sech"><div class="sec">Scope &amp; products</div>${canEdit() ? '<button class="addl" data-act="sadd">+ Add line</button>' : ''}</div><div class="card">${groups.length ? groups.map(spec).join('') : '<div class="empty">Scope hasn\'t been entered yet. Check with Riley before starting.</div>'}</div>
    ${rcptSection(j)}
    <div class="sech"><div class="sec">Site &amp; contacts</div>${canEdit() ? '<button class="addl" data-act="jedit">Edit</button>' : ''}</div><div class="card">${Object.keys(site).length ? `<dl class="kv">${[['Contact', site.contact], ['Phone', site.phone], ['Email', site.email], ['Access', site.access]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${linkify(v)}</dd>`).join('')}</dl>` : '<div class="empty">No site contact entered yet.</div>'}</div>
    ${wk.length ? `<div class="sec">On the schedule</div><div class="card">${wk.map(r => `<div class="sr"><div class="sd">${fmtDay(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}<span>${time12(r.start)}</span></div><div class="c">${crewChips(r.crew)}</div></div>`).join('')}</div>` : ''}
  </div></main>`;
}
function settings() {
  showSheet(`<div class="ov" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stH"><div class="sh"><h2 id="stH">Settings</h2><button class="done" data-act="close">Done</button></div>
    <p class="empty" style="margin:0">Signed in as <b style="color:var(--ink)">${esc(S.me)}</b></p>
    <p class="empty" style="margin:4px 0 0;font-size:14px">Not you, or got a new phone? Ask Paul for your link.</p>
    <button class="btn go" data-act="refresh">Refresh schedule</button>
    ${installed() ? '' : `<div class="sec">Put this on your home screen</div>
    <ol>${isIOS ? '<li>In Safari, tap the Share button.</li><li>Tap <b>Add to Home Screen</b>, then Add.</li>' : '<li>In Chrome, tap the ⋮ menu.</li><li>Tap <b>Add to Home screen</b> (or Install app).</li>'}<li>Open MPNW Crew from the new icon.</li></ol>`}
    <p class="empty" style="font-size:13px;margin-top:16px">MPNW Crew Hub ${VERSION}${S.data?.updated ? ' · schedule ' + new Date(S.data.updated).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</p></div></div>`);
}

/* ---------- weather (Open-Meteo, free, no key). Each job has geo [lat, lng] from the sheet script. ---------- */
const WX_ICONS = {
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  part: '<path d="M8 5.5V4M3.8 9.7H2.5M4.9 6.6l-.9-.9M11.6 6.6l.9-.9"/><path d="M5.6 11.3a3.4 3.4 0 0 1 6-2.6"/><path d="M8 19h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 19z"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.4 3.4 0 0 0 7 18.5z"/>',
  rain: '<path d="M7 14.5h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.4 3.4 0 0 0 7 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
  snow: '<path d="M7 14.5h10.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.4A3.4 3.4 0 0 0 7 14.5z"/><path d="M8.5 18.5h.01M12 20h.01M15.5 18.5h.01"/>',
  fog: '<path d="M4 9h16M6 13h12M4 17h16"/>'
};
const wxKind = c => c <= 1 ? 'sun' : c <= 2 ? 'part' : c === 3 ? 'cloud' : c <= 48 ? 'fog' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : 'rain';
const wxIcon = (c, s = 18) => I(WX_ICONS[wxKind(c)], s);
const WX = { data: store.get('wx') || {}, at: store.get('wxAt') || 0 };
const geoKey = j => j?.geo ? j.geo.map(n => (+n).toFixed(2)).join(',') : '';
const wxFor = (j, d) => WX.data[geoKey(j)]?.[d] || null;
const wxLine = (j, d) => {
  const w = wxFor(j, d); if (!w) return '';
  return `<div class="wx">${wxIcon(w.code)}<b>${w.hi}°</b><span>/ ${w.lo}°</span><span class="wxp">${I('<path d="M12 3.5s-5.5 6-5.5 10a5.5 5.5 0 0 0 11 0c0-4-5.5-10-5.5-10z"/>', 13)}${w.pop}%</span></div>`;
};
const wxMini = (j, d) => { const w = wxFor(j, d); return w ? `<span class="wxs">${wxIcon(w.code, 15)}${w.hi}°${w.pop >= 20 ? ` · ${w.pop}%` : ''}</span>` : ''; };
async function loadWeather(force) {
  const jobs = (S.data?.jobs || []).filter(j => j.geo), keys = [...new Set(jobs.map(geoKey))];
  if (!keys.length || (!force && Date.now() - WX.at < 36e5 && keys.every(k => WX.data[k]))) return;
  try {
    let list;
    if (__PREVIEW__) list = keys.map((k, i) => previewForecast(i));
    else {
      const [lat, lng] = [keys.map(k => k.split(',')[0]).join(','), keys.map(k => k.split(',')[1]).join(',')];
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=10`);
      if (!r.ok) throw new Error('wx'); const j = await r.json(); list = Array.isArray(j) ? j : [j];
    }
    keys.forEach((k, i) => { const d = list[i]?.daily; if (!d) return; WX.data[k] = Object.fromEntries(d.time.map((t, n) => [t, { code: d.weather_code[n], hi: Math.round(d.temperature_2m_max[n]), lo: Math.round(d.temperature_2m_min[n]), pop: d.precipitation_probability_max[n] ?? 0 }])); });
    WX.at = Date.now(); store.set('wx', WX.data); store.set('wxAt', WX.at); render();
  } catch (e) { /* no weather is fine; the schedule still works */ }
}
function previewForecast(i) {  // sample forecast so the preview shows real-looking weather
  const time = [...Array(10)].map((_, n) => addDays(today(), n)), seed = [61, 64, 3, 2, 80, 51, 1, 3, 63, 0];
  return { daily: { time, weather_code: time.map((_, n) => seed[(n + i) % 10]), temperature_2m_max: time.map((_, n) => 47 + ((n * 3 + i * 2) % 9)), temperature_2m_min: time.map((_, n) => 36 + ((n * 5 + i) % 10)), precipitation_probability_max: time.map((_, n) => [80, 70, 15, 10, 90, 40, 5, 20, 65, 0][(n + i) % 10]) } };
}

/* ---------- editing the schedule (only for people with "Can edit" on the Crew tab) ---------- */
const TIMES = ['5:00', '5:30', '6:00', '6:30', '7:00', '7:30', '8:00', '8:30', '9:00', '10:00', '11:00', '12:00', '13:00'].map(t => (t.length < 5 ? '0' : '') + t);
const canEdit = () => !!S.data?.canEdit;
const PENCIL = I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', 16);
const PLUS = I('<path d="M12 5v14M5 12h14"/>', 22);
function editor(src) {  // src: a schedule entry to edit, or { date } to add
  const e = S.ed = { row: src.row || null, from: src.from || src.date, thru: src.thru || '', job: src.job || '', start: src.start || '07:00',
    crew: [...(src.crew || [])], notes: src.notes || '', off: !!src.row && !src.job, expect: src.row ? { date: src.from || src.date, job: src.job || '' } : null, del: false, busy: false, err: '' };
  e.multi = !!e.thru; drawEditor();
}
function drawEditor() {
  const e = S.ed, jobs = (S.data?.jobs || []), crew = S.data?.crew || [];
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  showSheet(`<div class="ov" data-act="edclose"><div class="sheet ed" role="dialog" aria-modal="true" aria-labelledby="edH">
    <div class="sh"><h2 id="edH">${e.row ? 'Edit schedule' : 'Add to schedule'}</h2><button class="done" data-act="edclose">Cancel</button></div>
    ${e.note ? `<p class="hint">${e.note}</p>` : ''}${e.row && e.thru && !e.note ? `<p class="hint">This row covers ${fmtDay(e.from, { weekday: 'short', month: 'short', day: 'numeric' })} to ${fmtDay(e.thru, { weekday: 'short', month: 'short', day: 'numeric' })}. Changes apply to every day in it.</p>` : ''}
    <div class="seg2"><button data-edmode="job" aria-pressed="${!e.off}">Job</button><button data-edmode="off" aria-pressed="${e.off}">Day off</button></div>
    <div class="f2"><label class="fl">${e.multi ? 'First day' : 'Date'}<input type="date" data-f="from" value="${e.from}"></label>
      ${e.off ? '' : e.multi ? `<label class="fl">Last day<input type="date" data-f="thru" value="${e.thru}"></label>` : '<span></span>'}</div>
    ${e.off ? '' : `<label class="ck"><input type="checkbox" data-f="multi"${e.multi ? ' checked' : ''}> More than one day <small>(weekdays only)</small></label>
    <label class="fl">Job<select data-f="job">${opt('', 'Pick a job', !e.job)}${jobs.map(j => opt(j.id, `${j.id} · ${j.name}`, j.id === e.job)).join('')}</select></label>
    <label class="fl">Start<select data-f="start">${TIMES.concat(TIMES.includes(e.start) ? [] : [e.start]).map(t => opt(t, time12(t), t === e.start)).join('')}</select></label>
    <div class="fl">Crew<div class="pick">${crew.map(c => `<button data-crew="${esc(c.name)}" aria-pressed="${e.crew.includes(c.name)}">${esc(first(c.name))}</button>`).join('')}</div></div>`}
    <label class="fl">${e.off ? 'Reason' : 'Notes'}<textarea data-f="notes" rows="2" placeholder="${e.off ? 'Thanksgiving, shop closed' : 'Optional'}">${esc(e.notes)}</textarea></label>
    ${e.err ? `<p class="ferr" role="alert">${esc(e.err)}</p>` : ''}
    <div class="btns ${e.row ? '' : 'one'}"><button class="btn go" data-act="edsave"${e.busy ? ' disabled' : ''}>${e.busy ? 'Saving…' : 'Save'}</button>${e.row ? `<button class="btn del" data-act="eddel"${e.busy ? ' disabled' : ''}>${e.del ? 'Tap again to delete' : 'Delete'}</button>` : ''}</div>
    ${e.row && e.job ? `<button class="lnk" data-job="${e.job}" data-act="edclose">Open the job page</button>` : ''}
  </div></div>`);
}
function edCheck() {
  const e = S.ed;
  if (!e.from) return 'Pick a date.';
  if (e.off) return e.notes.trim() ? '' : 'Add a reason for the day off.';
  if (e.multi && (!e.thru || e.thru < e.from)) return 'The last day has to be after the first day.';
  if (!e.job) return 'Pick a job.';
  if (!e.crew.length) return 'Tick at least one person.';
  return '';
}
async function edSave(del) {
  const e = S.ed; e.err = del ? '' : edCheck(); if (e.err) return drawEditor();
  e.busy = true; drawEditor();
  const item = e.off ? { date: e.from, thru: '', job: '', start: '', crew: [], notes: e.notes.trim() }
    : { date: e.from, thru: e.multi ? e.thru : '', job: e.job, start: e.start, crew: e.crew, notes: e.notes.trim() };
  const body = { u: S.key, action: del ? 'delete' : e.row ? 'update' : 'add', row: e.row, expect: e.expect, item };
  try {
    const res = __PREVIEW__ ? previewWrite(body) : await fetch(DATA_URL, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
    if (!res.ok) throw new Error(res.error || 'Could not save.');
    S.ed = null; closeSheet();
    if (__PREVIEW__) { render(); toast(del ? 'Removed from the schedule.' : 'Saved to the schedule.'); } else { await load(); toast(del ? 'Removed from the schedule.' : 'Saved to the schedule.'); }
  } catch (err) { e.busy = false; e.err = S.offline || !navigator.onLine ? 'No signal. Nothing was saved, try again when you have service.' : err.message; drawEditor(); }
}
function previewWrite(b) {  // preview only: apply the change to the sample data the way the sheet script would
  const sched = S.data.schedule, rows = new Set(sched.map(s => s.row)), it = b.item;
  const strip = r => { for (let i = sched.length - 1; i >= 0; i--) if (sched[i].row === r) sched.splice(i, 1); };
  if (b.action !== 'add') strip(b.row);
  if (b.action === 'delete') return { ok: true };
  const row = b.row || Math.max(1, ...rows) + 1, off = new Set(sched.filter(s => !s.job).map(s => s.date));
  let days = [it.date];
  if (it.job && it.thru > it.date) { days = []; for (let d = it.date; d <= it.thru; d = addDays(d, 1)) { const w = fromKey(d).getDay(); if (w && w < 6 && !off.has(d)) days.push(d); } }
  days.forEach(d => sched.push({ date: d, job: it.job, crew: it.crew, start: it.start, notes: it.notes, row, from: it.date, thru: it.thru }));
  return { ok: true };
}

/* ---------- editing jobs and scope (same "Can edit" people) ---------- */
const STATUSES = ['Not Started', 'In Progress', 'Complete'];
const JOB_FIELDS = [['name', 'Job name'], ['gc', 'GC'], ['address', 'Address', 'area'], ['type', 'Type', 'list', ['Commercial', 'Interior', 'Exterior', 'Interior + Exterior', 'Industrial']],
  ['status', 'Status', 'select', STATUSES], ['start', 'Start date', 'date'], ['rate', 'Prevailing wage ($/hr)', 'num'], ['crewNotes', 'Notes for the crew', 'area'],
  ['@', 'Site & contacts'], ['contact', 'Site contact', 'area'], ['phone', 'Phone', 'tel'], ['email', 'Email', 'area'], ['access', 'Site access', 'area']];
const SCOPE_FIELDS = [['area', 'Area', 'list'], ['scope', 'Scope'], ['product', 'Product'], ['color', 'Color'], ['sheen', 'Sheen', 'list', ['Flat', 'Matte', 'Eggshell', 'Satin', 'Semi-Gloss', 'Gloss']],
  ['coats', 'Coats', 'num'], ['sqft', 'Coverage'], ['gallons', 'Qty']];
const nextJobId = () => { const n = (S.data?.jobs || []).map(j => +(j.id.match(/\d+/) || [0])[0]); return 'P-' + pad(Math.max(0, ...n) + 1); };
function jobForm(j) {  // j: a job to edit, or null for a new one
  const s = j?.site || {};
  S.form = { kind: 'job', row: j?.row || null, expect: j ? { id: j.id } : null, del: false, busy: false, err: '',
    v: j ? { id: j.id, name: j.name, gc: j.gc, address: j.address, type: j.type, status: j.status, start: j.start || '', rate: j.pw?.rate ?? '', crewNotes: j.crewNotes || '',
      contact: s.contact || '', phone: s.phone || '', email: s.email || '', access: s.access || '' }
      : { id: '', name: '', gc: '', address: '', type: '', status: 'Not Started', start: '', rate: '', crewNotes: '', contact: '', phone: '', email: '', access: '' } };
  drawForm();
}
function scopeForm(j, i) {  // i: index into j.scope, or -1 for a new line
  const s = j.scope[i] || {}, last = j.scope[j.scope.length - 1];
  S.form = { kind: 'scope', job: j.id, row: s.row || null, expect: s.row ? { job: j.id, scope: s.scope || '', product: s.product || '' } : null, del: false, busy: false, err: '',
    v: i >= 0 ? { area: s.area, scope: s.scope, product: s.product, color: s.color, sheen: s.sheen, coats: s.coats, sqft: s.sqft, gallons: s.gallons }
      : { area: last?.area || '', scope: '', product: '', color: '', sheen: '', coats: '', sqft: '', gallons: '' } };
  drawForm();
}
function drawForm() {
  if (S.form.kind === 'rcpt') return drawRcpt();
  const f = S.form, v = f.v, job = f.kind === 'scope' && jobById(f.job), isJob = f.kind === 'job';
  const areas = job ? [...new Set(job.scope.map(s => s.area).filter(Boolean))] : [];
  const field = ([k, label, type, opts]) => {
    if (k === '@') return `<div class="sec" style="margin:6px 0 -4px">${label}</div>`;
    const val = esc(v[k] ?? ''), list = type === 'list' ? (k === 'area' ? areas : opts) : null;
    const input = type === 'select' ? `<select data-ff="${k}">${opts.map(o => `<option${o === v[k] ? ' selected' : ''}>${o}</option>`).join('')}</select>`
      : type === 'area' ? `<textarea data-ff="${k}" rows="2">${val}</textarea>`
      : `<input data-ff="${k}" value="${val}" ${type === 'date' ? 'type="date"' : type === 'num' ? 'inputmode="decimal"' : type === 'tel' ? 'type="tel"' : 'type="text"'}${list ? ` list="dl-${k}"` : ''} autocomplete="off">${list ? `<datalist id="dl-${k}">${list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
    return `<label class="fl">${label}${k === 'id' ? input.replace('autocomplete="off"', `autocomplete="off" autocapitalize="characters" placeholder="e.g. ${nextJobId()}"`) : input}</label>`;
  };
  const pairs = isJob ? (f.row ? JOB_FIELDS : [['id', 'Job number']].concat(JOB_FIELDS)) : SCOPE_FIELDS;
  const body = isJob ? pairs.map(field).join('') : `${field(pairs[0])}${field(pairs[1])}${field(pairs[2])}<div class="f2">${field(pairs[3])}${field(pairs[4])}</div><div class="f3">${field(pairs[5])}${field(pairs[6])}${field(pairs[7])}</div>`;
  const title = isJob ? (f.row ? 'Edit job' : 'New job') : f.row ? 'Edit scope line' : 'Add scope line';
  showSheet(`<div class="ov" data-act="fclose"><div class="sheet ed" role="dialog" aria-modal="true" aria-labelledby="fH">
    <div class="sh"><h2 id="fH">${title}</h2><button class="done" data-act="fclose">Cancel</button></div>
    ${isJob && !f.row ? '<p class="sub">Use the same job number as your company tracker.</p>' : `<p class="sub">${isJob ? `<b>${esc(v.id)}</b>` : esc(job ? job.id + ' · ' + job.name : '')}</p>`}
    ${body}
    ${isJob && v.status === 'Complete' ? '<p class="hint">Complete jobs drop off the crew\'s Jobs list once they\'re off the schedule.</p>' : ''}
    ${f.err ? `<p class="ferr" role="alert">${esc(f.err)}</p>` : ''}
    <div class="btns ${f.row && !isJob ? '' : 'one'}"><button class="btn go" data-act="fsave"${f.busy ? ' disabled' : ''}>${f.busy ? 'Saving…' : 'Save'}</button>${f.row && !isJob ? `<button class="btn del" data-act="fdel"${f.busy ? ' disabled' : ''}>${f.del ? 'Tap again to delete' : 'Delete'}</button>` : ''}</div>
  </div></div>`);
}
function formCheck() {
  const f = S.form, v = f.v;
  if (f.kind === 'rcpt') return rcptCheck(v);
  if (f.kind === 'job') {
    if (!f.row) {
      const id = String(v.id).trim().toUpperCase(); v.id = id;
      if (!/^[A-Z]+-\d+$/.test(id)) return 'Type the job number like it is in the tracker, for example P-21.';
      if ((S.data?.jobs || []).some(j => j.id === id)) return id + ' is already on the Jobs tab.';
    }
    if (!String(v.name).trim()) return 'Give the job a name.';
    if (v.rate !== '' && !(+v.rate >= 0)) return 'Prevailing wage should be a number, like 55.64. Leave it blank if it isn\'t prevailing wage.';
  } else if (!String(v.scope).trim() && !String(v.product).trim()) return 'Fill in the scope or the product.';
  return '';
}
async function formSave(del) {
  const f = S.form; f.err = del ? '' : formCheck(); if (f.err) return drawForm();
  f.busy = true; drawForm();
  const item = Object.fromEntries(Object.entries(f.v).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]));
  const body = { u: S.key, action: f.kind, op: del ? 'delete' : f.row ? 'update' : 'add', row: f.row, expect: f.expect, job: f.job, item };
  try {
    const res = __PREVIEW__ ? (f.kind === 'rcpt' ? previewRcpt(body) : previewForm(body)) : await fetch(DATA_URL, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
    if (!res.ok) throw new Error(res.error || 'Could not save.');
    S.form = null; closeSheet();
    if (f.kind === 'job' && !f.row) S.job = item.id;
    if (__PREVIEW__) render(); else await load();
    buzz(); toast(del ? 'Deleted.' : f.kind === 'rcpt' ? 'Receipt saved.' : 'Saved to the sheet.');
  } catch (err) { f.busy = false; f.err = !navigator.onLine ? 'No signal. Nothing was saved, try again when you have service.' : err.message; drawForm(); }
}
function previewForm(b) {  // preview only: apply the change to the sample data the way the sheet script would
  const jobs = S.data.jobs, it = b.item;
  if (b.action === 'job') {
    let j = jobs.find(x => x.id === (b.expect?.id || it.id));
    if (!j) { j = { id: it.id, scope: [], row: jobs.length + 2 }; jobs.push(j); }
    Object.assign(j, { name: it.name, gc: it.gc, address: it.address, type: it.type, status: it.status, start: it.start, crewNotes: it.crewNotes, pw: +it.rate > 0 ? { rate: +it.rate } : null,
      site: Object.fromEntries(['contact', 'phone', 'email', 'access'].filter(k => it[k]).map(k => [k, it[k]])) });
    return { ok: true };
  }
  const j = jobs.find(x => x.id === b.job), i = j.scope.findIndex(s => s.row === b.row);
  if (b.op === 'delete') j.scope.splice(i, 1);
  else if (i >= 0) Object.assign(j.scope[i], it);
  else { const after = j.scope.map(s => s.area).lastIndexOf(it.area); j.scope.splice(after < 0 ? j.scope.length : after + 1, 0, { ...it, row: 900 + Math.round(Math.random() * 99) }); }
  return { ok: true };
}

/* ---------- receipts (typed in; no photos yet) ----------
   Everyone can add receipts. Crew members only ever get their own receipts in the feed;
   job totals and everyone's receipts only reach people with Can edit. */
const CATS = ['Fuel', 'Materials', 'Food', 'Lodging', 'Equipment', 'Other'], CARDS = ['Gas card', 'General card'];
const money = n => '$' + (+n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CAT_COLOR = { Fuel: '#ec5b37', Materials: '#2f7be0', Food: '#eba312', Lodging: '#8b5cf6', Equipment: '#0ea5a5', Other: '#8a938c' };
const RCPT = I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>', 18);
const recsFor = id => (canEdit() ? S.data?.receipts : S.data?.myReceipts || []).filter(r => r.job === id).sort((a, b) => b.date.localeCompare(a.date) || b.row - a.row);
const jobTotal = id => (S.data?.receipts || []).filter(r => r.job === id).reduce((t, r) => t + (+r.amount || 0), 0);
function rcptForm(src) {  // src: a receipt to edit, or { job } to add
  const r = src.row ? src : null, job = src.job || mineOn(today())[0]?.job || '';
  S.form = { kind: 'rcpt', row: r?.row || null, expect: r ? { job: r.job, amount: r.amount, date: r.date } : null, del: false, busy: false, err: '',
    v: r ? { job: r.job, date: r.date, amount: String(r.amount), card: r.card, cat: r.cat, vendor: r.vendor || '', notes: r.notes || '' }
      : { job, date: today(), amount: '', card: 'Gas card', cat: 'Fuel', vendor: '', notes: '' } };
  drawForm();
}
function drawRcpt() {
  const f = S.form, v = f.v, jobs = (S.data?.jobs || []);
  const opt = (val, l, sel) => `<option value="${esc(val)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;
  showSheet(`<div class="ov" data-act="fclose"><div class="sheet ed" role="dialog" aria-modal="true" aria-labelledby="fH">
    <div class="sh"><h2 id="fH">${f.row ? 'Edit receipt' : 'Add a receipt'}</h2><button class="done" data-act="fclose">Cancel</button></div>
    <label class="fl">Job<select data-ff="job">${opt('', 'Pick a job', !v.job)}${jobs.map(j => opt(j.id, `${j.id} · ${j.name}`, j.id === v.job)).join('')}</select></label>
    <div class="f2"><label class="fl">Amount<span class="amt"><i>$</i><input data-ff="amount" inputmode="decimal" placeholder="0.00" value="${esc(v.amount)}" autocomplete="off"></span></label>
      <label class="fl">Date<input type="date" data-ff="date" value="${v.date}" max="${today()}"></label></div>
    <div class="f2"><label class="fl">Card<select data-ff="card">${CARDS.map(c => opt(c, c, c === v.card)).join('')}</select></label>
      <label class="fl">Category<select data-ff="cat">${CATS.map(c => opt(c, c, c === v.cat)).join('')}</select></label></div>
    <label class="fl">Where<input data-ff="vendor" value="${esc(v.vendor)}" placeholder="Chevron, Sherwin-Williams…" autocomplete="off"></label>
    <label class="fl">Note<textarea data-ff="notes" rows="2" placeholder="Optional">${esc(v.notes)}</textarea></label>
    ${f.err ? `<p class="ferr" role="alert">${esc(f.err)}</p>` : ''}
    <div class="btns ${f.row ? '' : 'one'}"><button class="btn go" data-act="fsave"${f.busy ? ' disabled' : ''}>${f.busy ? 'Saving…' : 'Save receipt'}</button>${f.row ? `<button class="btn del" data-act="fdel"${f.busy ? ' disabled' : ''}>${f.del ? 'Tap again to delete' : 'Delete'}</button>` : ''}</div>
  </div></div>`);
}
function rcptCheck(v) {
  if (!v.job) return 'Pick the job this receipt is for.';
  const a = String(v.amount).replace(/[$,\s]/g, ''); if (!/^\d+(\.\d{1,2})?$/.test(a) || !(+a > 0)) return 'Type the amount, like 64.20.';
  v.amount = a;
  if (!v.date || v.date > today()) return 'Pick the date on the receipt.';
  return '';
}
function rcptRow(r, who) {
  const by = who && r.by ? first(r.by) : '';
  return `<button class="rc" data-rrow="${r.row}"><span class="rcd">${fmtDay(r.date, { month: 'short', day: 'numeric' })}</span>
    <span class="rcm"><b>${esc(r.vendor || r.cat)}</b><small>${esc([r.vendor ? r.cat : '', r.card, by].filter(Boolean).join(' · '))}</small></span><span class="rca">${money(r.amount)}</span></button>`;
}
function rcptSection(j) {
  const list = recsFor(j.id), add = `<button class="addl" data-act="radd">+ Add receipt</button>`;
  if (!canEdit()) return `<div class="sech"><div class="sec">Your receipts</div>${add}</div><div class="card rcl">${list.length ? list.map(r => rcptRow(r, false)).join('') : '<div class="empty">Got a gas or supply receipt for this job? Add it here.</div>'}</div>`;
  const total = list.reduce((t, r) => t + (+r.amount || 0), 0), by = {};
  list.forEach(r => { by[r.cat] = (by[r.cat] || 0) + (+r.amount || 0); });
  const cats = CATS.filter(c => by[c]), shown = S.allRcpt === j.id ? list : list.slice(0, 6);
  return `<div class="sech"><div class="sec">Costs <span class="only">only you and editors see this</span></div>${add}</div>
  <div class="card rcl">${list.length ? `<div class="ctot"><b>${money(total)}</b><span>${list.length} receipt${list.length > 1 ? 's' : ''}</span></div>
    <div class="cbar">${cats.map(c => `<i style="flex:${by[c]};background:${CAT_COLOR[c]}"></i>`).join('')}</div>
    <div class="clg">${cats.map(c => `<span><i style="background:${CAT_COLOR[c]}"></i>${c} <b>${money(by[c])}</b></span>`).join('')}</div>
    ${shown.map(r => rcptRow(r, true)).join('')}${list.length > shown.length ? `<button class="lnk more" data-act="rall">Show all ${list.length}</button>` : ''}`
    : '<div class="empty">No receipts yet.</div>'}</div>`;
}
function previewRcpt(b) {  // preview only: same as the sheet script would do
  const key = canEdit() ? 'receipts' : 'myReceipts', list = S.data[key] = S.data[key] || [], i = list.findIndex(r => r.row === b.row);
  if (b.op === 'delete') { list.splice(i, 1); return { ok: true }; }
  const it = { ...b.item, amount: +b.item.amount, by: i >= 0 ? list[i].by : S.me };
  if (i >= 0) Object.assign(list[i], it); else list.push({ ...it, row: 500 + list.length });
  return { ok: true };
}

/* ---------- site map on the job page: a regular street map (OpenStreetMap tiles) with the job pinned ---------- */
function siteMap(j) {
  if (!j.geo) return '';
  const Z = 13, T = 256, lat = +j.geo[0], lng = +j.geo[1], n = 2 ** Z, r = lat * Math.PI / 180;
  const px = (lng + 180) / 360 * n * T, py = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * T;
  const tiles = [];
  for (let tx = Math.floor((px - 260) / T); tx <= Math.floor((px + 260) / T); tx++)
    for (let ty = Math.floor((py - 90) / T); ty <= Math.floor((py + 90) / T); ty++)
      tiles.push(`<img src="https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png" alt="" loading="lazy" decoding="async" style="left:${Math.round(tx * T - px)}px;top:${Math.round(ty * T - py)}px">`);
  return `<a class="mmap" href="${mapsUrl(j.address)}" target="_blank" rel="noopener" aria-label="Open ${esc(j.name)} in maps">
    <div class="mtiles">${tiles.join('')}</div><i class="mpin"></i>
    <span class="mlab">${PIN}${esc(city(j.address) || 'Open in maps')}</span><span class="mcred">© OpenStreetMap</span></a>`;
}
const buzz = () => { try { navigator.vibrate?.(9); } catch (e) {} };  // a light tick on Android; iPhones ignore it
/* Loading placeholders: soft shapes where the cards will be, the first time the schedule loads. */
function skeletonScreen() {
  $('#tabs').hidden = false;
  const line = (w, h = 14, mt = 10) => `<div class="sk" style="width:${w};height:${h}px;margin-top:${mt}px"></div>`;
  $('#app').innerHTML = `<header class="band tall">${TOPO('today')}<div class="w"><div class="top">${LOGO}</div>
    <div class="hi"><div class="sk skd" style="width:150px;height:30px"></div><div class="sk skd" style="width:190px;height:14px;margin-top:12px"></div></div></div></header>
  <main class="w lift"><div class="card hero">${line('34%', 11, 0)}${line('62%', 26, 14)}${line('40%')}${line('78%')}<div class="btns" style="margin-top:16px"><div class="sk" style="height:52px;border-radius:16px"></div><div class="sk" style="height:52px;border-radius:16px"></div></div></div>
    <div class="sk" style="width:46%;height:11px;margin:30px 4px 0"></div>
    <div class="card">${line('30%', 11, 0)}${line('55%', 20, 12)}${line('70%')}</div></main>`;
}

/* ---------- search everything: jobs, people, schedule, products and colors, receipts ----------
   Every word typed has to match somewhere in the result (any order, any case). Only searches what this phone
   already has: crew members' receipts are their own, and no costs are added for them. */
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const words = q => fold(q).split(/[\s,]+/).filter(Boolean);
const hits = (ws, ...fields) => { const t = fold(fields.join(' ')); return ws.every(w => t.includes(w)); };
const mark = (text, ws) => { let out = esc(text); ws.filter(w => w.length > 1).sort((a, b) => b.length - a.length).forEach(w => {
  out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![^<]*>)', 'gi'), '<mark>$1</mark>'); }); return out; };
const SR_ICONS = { job: I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 18),
  person: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 18), day: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', 18),
  paint: I('<path d="M5 3h12a2 2 0 0 1 2 2v3H3V5a2 2 0 0 1 2-2z"/><path d="M19 6h2v5h-9v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>', 18), rcpt: RCPT };
function searchOpen() {
  S.sq = '';
  showSheet(`<div class="ov" data-act="sclose"><div class="sheet srch" role="dialog" aria-modal="true" aria-label="Search">
    <div class="sbar"><label class="sfield">${SEARCH}<input id="sq" type="search" placeholder="Jobs, people, products, colors…" autocomplete="off" enterkeyhint="search" aria-label="Search everything"></label><button class="done" data-act="sclose">Cancel</button></div>
    <div id="sres" aria-live="polite"></div></div></div>`);
  drawResults(); setTimeout(() => $('#sq')?.focus(), 60);
}
function drawResults() {
  const box = $('#sres'); if (!box) return;
  const q = S.sq || '', ws = words(q), d = S.data || {};
  if (!ws.length) {
    const recent = store.get('recentSearch') || [];
    box.innerHTML = recent.length ? `<div class="sec">Recent</div><div class="schips">${recent.map(r => `<button data-sq="${esc(r)}">${esc(r)}</button>`).join('')}</div>`
      : `<p class="shint">Try a job name, a person, a product like ProMar, a color like SW 7006, or a city.</p>`;
    return;
  }
  const groups = [];
  // Jobs
  const jobs = (d.jobs || []).filter(j => hits(ws, j.id, j.name, j.gc, j.address, j.type, j.status, j.crewNotes, j.site?.contact, j.site?.access));
  groups.push(['Jobs', jobs.map(j => ({ icon: 'job', c: jobColor(j.id), t: mark(j.name, ws), s: mark([j.id, j.gc, city(j.address)].filter(Boolean).join(' · '), ws), act: `data-sjob="${j.id}"` }))]);
  // People, with their next assignment
  const people = (d.crew || []).filter(c => hits(ws, c.name, c.role));
  groups.push(['People', people.map(c => { const nx = (d.schedule || []).filter(r => r.job && r.date >= today() && r.crew.includes(c.name)).sort((a, b) => a.date.localeCompare(b.date))[0];
    return { icon: 'person', t: mark(c.name, ws), s: nx ? `Next: ${fmtDay(nx.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${esc(jobById(nx.job)?.name || nx.job)}` : esc(c.role || 'Nothing scheduled'), act: `data-sperson="${esc(c.name)}"` }; })]);
  // Schedule: two weeks back to two months ahead, one result per row (a range shows once)
  const lo = addDays(today(), -14), hi = addDays(today(), 60), seen = new Set();
  const sched = (d.schedule || []).filter(r => r.date >= lo && r.date <= hi && hits(ws, jobById(r.job)?.name, r.job, r.crew.join(' '), r.notes, fmtDay(r.date, { weekday: 'long', month: 'long', day: 'numeric' }), fmtDay(r.date, { month: 'short', day: 'numeric' }), r.date === today() ? 'today' : r.date === addDays(today(), 1) ? 'tomorrow' : ''))
    .sort((a, b) => (a.date < today()) - (b.date < today()) || (a.date < today() ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))  // upcoming first, then most recent past
    .filter(r => { const k = (r.row || '') + '|' + (r.row ? '' : r.date); if (seen.has(k)) return false; seen.add(k); return true; });
  groups.push(['Schedule', sched.map(r => ({ icon: 'day', c: r.job ? jobColor(r.job) : '', t: r.job ? mark(jobById(r.job)?.name || r.job, ws) : mark(r.notes || 'Day off', ws),
    s: `${fmtDay(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}${r.thru ? ' – ' + fmtDay(r.thru, { month: 'short', day: 'numeric' }) : ''}${r.job ? ' · ' + mark(r.crew.map(first).join(', '), ws) : ''}`, act: `data-sday="${r.date}"` }))]);
  // Products and colors on scope lines
  const lines = [];
  (d.jobs || []).forEach(j => (j.scope || []).forEach((s, i) => { if (hits(ws, s.product, s.color, s.sheen, s.scope, s.area, j.name)) lines.push({ j, s, i }); }));
  groups.push(['Products and colors', lines.map(({ j, s, i }) => ({ icon: 'paint', t: mark([s.product, s.color].filter(Boolean).join(' · ') || s.scope, ws),
    s: mark([s.scope, s.sheen, j.name].filter(Boolean).join(' · '), ws), act: `data-sjob="${j.id}" data-sline="${i}"` }))]);
  // Receipts: everything for editors, only your own for everyone else
  const recs = (canEdit() ? d.receipts : d.myReceipts) || [];
  groups.push(['Receipts', recs.filter(r => hits(ws, r.vendor, r.cat, r.card, r.notes, r.by, jobById(r.job)?.name, String(r.amount))).sort((a, b) => b.date.localeCompare(a.date))
    .map(r => ({ icon: 'rcpt', t: `${mark(r.vendor || r.cat, ws)} <b class="samt">${money(r.amount)}</b>`, s: mark([fmtDay(r.date, { month: 'short', day: 'numeric' }), jobById(r.job)?.name, r.card, canEdit() && r.by ? first(r.by) : ''].filter(Boolean).join(' · '), ws), act: `data-sjob="${r.job}" data-srcpt="1"` }))]);
  const any = groups.some(([, list]) => list.length);
  box.innerHTML = any ? groups.filter(([, list]) => list.length).map(([name, list]) => { const open = S.sAll === name, shown = open ? list : list.slice(0, 4);
    return `<div class="sec">${name}<span class="scount">${list.length}</span></div><div class="card sres">${shown.map(x => `<button class="sx" ${x.act}><span class="si"${x.c ? ` style="--jc:${x.c}"` : ''}>${SR_ICONS[x.icon]}</span><span class="st2"><b>${x.t}</b><small>${x.s}</small></span></button>`).join('')}
      ${list.length > shown.length ? `<button class="lnk more" data-sall="${name}">Show all ${list.length}</button>` : ''}</div>`; }).join('')
    : `<p class="shint">Nothing matches "${esc(q)}". Check the spelling or try fewer words.</p>`;
}
function searchGo(fn) {  // remember the search, close the sheet, then go
  const q = (S.sq || '').trim();
  if (q) { const r = (store.get('recentSearch') || []).filter(x => fold(x) !== fold(q)); r.unshift(q); store.set('recentSearch', r.slice(0, 6)); }
  closeSheet(); S.sAll = null; fn();
}

/* ---------- feel: page transitions, gestures, compact header, count-up ---------- */
const vtOK = () => !!document.startViewTransition && motionOK.matches;
const clearVT = () => document.querySelectorAll('[style*="view-transition-name"]').forEach(el => { el.style.viewTransitionName = ''; });
const nameJobPage = () => { $('#app header.band') && ($('#app header.band').style.viewTransitionName = 'jobcard'); $('#app .jp h1') && ($('#app .jp h1').style.viewTransitionName = 'jobname'); };
const nameSource = el => { if (!el) return; el.style.viewTransitionName = 'jobcard'; const n = el.querySelector('.jn, .n'); if (n) n.style.viewTransitionName = 'jobname'; };
const sourceFor = id => [...document.querySelectorAll(`#app [data-vt="${id}"], #app .jl[data-job="${id}"], #app .as[data-job="${id}"]`)]
  .find(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
// Card-to-page: the tapped card grows into the job page, and Back shrinks it back into place.
function deskOpen(id) {
  const fromTab = S.tab !== 'jobs'; S.tab = 'jobs'; S.job = id; scrollTo(0, 0); render(fromTab ? 'tab' : undefined);
  $('.jl.sel')?.scrollIntoView({ block: 'nearest' }); countUp();
}
function openJobFrom(id, src) {
  if (!vtOK() || !src || desk()) return openJob(id);
  clearVT(); nameSource(src);
  const t = document.startViewTransition(() => { S.listY = scrollY; S.job = id; history.pushState({ job: id }, ''); scrollTo(0, 0); clearVT(); render('vt'); nameJobPage(); });
  t.finished.finally(() => { clearVT(); countUp(); });
}
function closeJobAnimated() {
  if (!vtOK() || S.dragBack) { S.dragBack = false; return closeJob(); }
  const id = S.job; clearVT(); nameJobPage();
  const t = document.startViewTransition(() => { clearVT(); S.job = null; render(); scrollTo(0, S.listY || 0); parallax(); nameSource(sourceFor(id)); });
  t.finished.finally(clearVT);
}
// Count-up for the costs total when a job opens (editors only see it).
function countUp() {
  const el = $('#app .ctot b'); if (!el || !motionOK.matches || el.dataset.counted) return;
  const end = +el.textContent.replace(/[^0-9.]/g, ''); if (!end) return; el.dataset.counted = 1;
  const t0 = performance.now(), dur = 750, f = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = money(end * e); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
// Compact header: once the big header scrolls away, a slim bar with the page title slides in.
function cbarTitle() {
  if (S.job) return jobById(S.job)?.name || '';
  if (S.tab === 'week') return S.week === mondayOf(today()) ? 'This week' : `Week of ${fmtDay(S.week, { month: 'short', day: 'numeric' })}`;
  if (S.tab === 'cal') return fromKey(S.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (S.tab === 'jobs') return 'Jobs';
  return 'Today · ' + fmtDay(today(), { weekday: 'short', month: 'short', day: 'numeric' });
}
function cbarUpdate() {
  const bar = $('#cbar'), band = $('#app .band'); if (!bar) return;
  const show = !!(band && S.me && S.data && scrollY > band.offsetHeight - bar.offsetHeight - 8);
  bar.classList.toggle('show', show); bar.classList.toggle('job', !!S.job);
}
addEventListener('scroll', () => requestAnimationFrame(cbarUpdate), { passive: true });
/* Gestures. Only finished touches count: a swipe the phone itself takes (system back) cancels the touch, so nothing happens twice. */
let sw = null;
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || $('#sheet').firstChild) return;
  const t = e.touches[0];
  sw = { x: t.clientX, y: t.clientY, t: Date.now(), edge: !!S.job && t.clientX < 28, dx: 0 };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!sw || !sw.edge) return; const t = e.touches[0]; sw.dx = Math.max(0, t.clientX - sw.x);
  if (sw.dx > 8 && Math.abs(t.clientY - sw.y) < sw.dx) { const a = $('#app'); a.style.transition = 'none'; a.style.transform = `translate3d(${sw.dx}px,0,0)`; a.style.opacity = 1 - Math.min(.35, sw.dx / 900); }
}, { passive: true });
document.addEventListener('touchcancel', () => { if (sw?.edge) { const a = $('#app'); a.style.transition = 'transform .25s ease, opacity .25s ease'; a.style.transform = ''; a.style.opacity = ''; } sw = null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, quick = Date.now() - sw.t < 650, s0 = sw; sw = null;
  if (s0.edge) {  // swipe from the left edge on a job page goes back
    const a = $('#app'), go = s0.dx > 90 || (s0.dx > 40 && quick);
    a.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s ease';
    if (go) { a.style.transform = 'translate3d(100%,0,0)'; a.style.opacity = '0'; setTimeout(() => { a.style.transition = 'none'; a.style.transform = ''; a.style.opacity = ''; S.dragBack = true; $('#app [data-act=back]')?.click(); }, 200); }
    else { a.style.transform = ''; a.style.opacity = ''; }
    return;
  }
  // left/right swipe on Week or Calendar changes the week or month
  if (S.job || !['week', 'cal'].includes(S.tab) || !quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
  if (e.target.closest('.band, .tabbar, .fab, input, select, textarea')) return;
  $(`#app [data-act=${S.tab === 'week' ? 'w' : 'm'}${dx < 0 ? 'next' : 'prev'}]`)?.click();
}, { passive: true });
// Pull a pop-up down to close it (from its top bar, or anywhere once it's scrolled to the top).
let sd = null;
function onSheetMove(e) {
  if (!sd) return; const dy = e.touches[0].clientY - sd.y;
  if (dy <= 0 && !sd.on) return;
  if (!sd.on && dy < 8) return; sd.on = true; e.preventDefault();
  sd.dy = Math.max(0, dy); sd.sheet.style.transition = 'none'; sd.sheet.style.transform = `translate3d(0,${sd.dy}px,0)`;
  sd.ov.style.backgroundColor = `rgba(8,12,10,${(.42 * (1 - Math.min(1, sd.dy / 500))).toFixed(3)})`;
}
document.addEventListener('touchstart', e => {
  const sheet = e.target.closest('.sheet'); if (!sheet || e.touches.length !== 1) return;
  const top = e.target.closest('.sh, .sbar') || e.touches[0].clientY - sheet.getBoundingClientRect().top < 34;
  const inScroll = e.target.closest('#sres'), field = e.target.closest('input, textarea, select');
  if (!top && (field || inScroll || sheet.scrollTop > 0)) return;
  sd = { y: e.touches[0].clientY, t: Date.now(), sheet, ov: sheet.parentElement, dy: 0, on: false };
  sd.ov.classList.remove('anim'); sheet.style.animation = 'none';
  document.addEventListener('touchmove', onSheetMove, { passive: false });
}, { passive: true });
const sheetEnd = () => {
  document.removeEventListener('touchmove', onSheetMove, { passive: false });
  if (!sd) return; const s0 = sd; sd = null; if (!s0.on) { s0.sheet.style.animation = ''; return; }
  const fast = s0.dy > 40 && Date.now() - s0.t < 280;
  if (s0.dy > 120 || fast) {
    s0.sheet.style.transition = 'transform .2s ease-in'; s0.sheet.style.transform = 'translate3d(0,100%,0)'; buzz();
    setTimeout(() => s0.ov.querySelector('.sheet .done, .sheet [data-act$="close"]')?.click(), 170);
  } else { s0.sheet.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)'; s0.sheet.style.transform = ''; s0.ov.style.backgroundColor = ''; setTimeout(() => { s0.sheet.style.animation = ''; }, 260); }
};
document.addEventListener('touchend', sheetEnd, { passive: true }); document.addEventListener('touchcancel', sheetEnd, { passive: true });
/* Job progress: every scheduled day for this job, done / today / coming up. */
function jobProgress(j) {
  const days = [...new Set((S.data.schedule || []).filter(r => r.job === j.id).map(r => r.date))].sort(); if (!days.length) return '';
  const k = today(), done = days.filter(d => d < k).length, on = days.includes(k), total = days.length, next = days.find(d => d > k);
  const f = d => fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' });
  const head = on ? `Day ${done + 1} of ${total}` : done === total ? `Wrapped up ${fmtDay(days[total - 1], { month: 'short', day: 'numeric' })}` : done ? `${done} of ${total} days done` : `Starts ${f(days[0])}`;
  const sub = on ? (next ? `Next: ${f(next)}` : 'Last scheduled day') : done === total ? `${total} day${total > 1 ? 's' : ''} on the schedule` : next ? `${done ? 'Next' : total + ' days scheduled'}${done ? ': ' + f(next) : ''}` : '';
  const segs = total <= 40 ? days.map(d => `<i class="${d < k ? 'dn2' : d === k ? 'now' : ''}" title="${f(d)}"></i>`).join('')
    : `<i class="dn2" style="flex:${done}"></i>${on ? '<i class="now"></i>' : ''}<i style="flex:${total - done - (on ? 1 : 0)}"></i>`;
  return `<div class="card prog"><div class="ph"><b>${head}</b><span>${sub}</span></div><div class="pbar">${segs}</div>
    <div class="pends"><span>${fmtDay(days[0], { month: 'short', day: 'numeric' })}</span><span>${fmtDay(days[total - 1], { month: 'short', day: 'numeric' })}</span></div></div>`;
}
const jdot = id => `<i class="sw" style="background:${jobColor(id)}"></i>`;

/* ---------- render & events ---------- */
/* ---------- motion: the header map drifts slower than the page, and cards rise into place as they scroll into view ---------- */
const motionOK = matchMedia('(prefers-reduced-motion: no-preference)');
/* Pop-up sheets slide up when they open and down when they close. Redrawing an open sheet (typing, toggles) doesn't replay it. */
let sheetT = 0;
function showSheet(html) {
  clearTimeout(sheetT); const box = $('#sheet'), fresh = !box.firstChild || box.querySelector('.ov.out');
  box.innerHTML = html; document.documentElement.classList.add('locked');
  if (fresh && motionOK.matches) box.querySelector('.ov').classList.add('anim');
}
function closeSheet() {
  const box = $('#sheet'), ov = box.querySelector('.ov'); document.documentElement.classList.remove('locked');
  if (!ov || !motionOK.matches) { box.innerHTML = ''; return; }
  ov.classList.remove('anim'); ov.classList.add('out'); clearTimeout(sheetT); sheetT = setTimeout(() => { box.innerHTML = ''; }, 220);
}
/* Press feedback: buttons sink a moment after the finger lands, and not at all if the finger is starting a scroll. */
const PRESS = 'button, a.btn, .ov .pick button, label.ck';
let pressEl = null, pressT = 0, pressXY = null;
const unpress = () => { clearTimeout(pressT); pressEl?.classList.remove('press'); pressEl = null; };
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button) return; unpress();
  const el = e.target.closest(PRESS); if (!el || el.disabled) return;
  pressEl = el; pressXY = [e.clientX, e.clientY]; pressT = setTimeout(() => el.classList.add('press'), e.pointerType === 'touch' ? 45 : 0);
}, { passive: true });
document.addEventListener('pointermove', e => { if (pressEl && Math.hypot(e.clientX - pressXY[0], e.clientY - pressXY[1]) > 8) unpress(); }, { passive: true });
['pointerup', 'pointercancel', 'dragstart'].forEach(t => document.addEventListener(t, () => setTimeout(unpress, 90), { passive: true }));
addEventListener('scroll', unpress, { passive: true });
let io = null, rafId = 0;
function parallax() {
  rafId = 0; const band = document.querySelector('.band'); if (!band) return;
  const y = Math.max(0, scrollY), topo = band.querySelector('.topo'), inner = band.querySelector(':scope > .w');
  if (topo) topo.style.transform = y ? `translate3d(0,${(y * .55).toFixed(1)}px,0)` : '';
  if (inner) { const k = Math.min(1, y / (band.offsetHeight * 1.2)); inner.style.transform = y ? `translate3d(0,${(y * .25).toFixed(1)}px,0)` : ''; inner.style.opacity = y ? (1 - k * .8).toFixed(3) : ''; }
}
addEventListener('scroll', () => { if (motionOK.matches && !rafId) rafId = requestAnimationFrame(parallax); }, { passive: true });
// Changed days pulse once, the first time each one comes into view on each page.
function glow(el, delay = 0) {
  if (!el.classList.contains('chg')) return; const k = S.tab + (S.job || '') + ':' + (el.dataset.date || el.dataset.day);
  if (S.glowDone.has(k)) return; S.glowDone.add(k); if (!motionOK.matches) return;
  setTimeout(() => { el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); }, delay);
}
function motion() {
  io?.disconnect();
  if (!motionOK.matches || !('IntersectionObserver' in window)) { document.querySelectorAll('.chg').forEach(el => glow(el)); return; }
  io = new IntersectionObserver(es => {
    es.filter(e => e.isIntersecting).forEach((e, i) => {
      const el = e.target; el.style.transitionDelay = i * 70 + 'ms'; el.classList.add('in'); io.unobserve(el); glow(el, i * 70 + 350);
      el.addEventListener('transitionend', function done(ev) { if (ev.propertyName !== 'transform') return; el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; el.removeEventListener('transitionend', done); });
    });
  }, { rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('main .card, main .day, main .jl, main .cal, main .sp, main .legend').forEach(el => {
    if (el.getBoundingClientRect().top > innerHeight - 30) { el.classList.add('rv'); io.observe(el); }
  });
  document.querySelectorAll('.chg:not(.rv)').forEach(el => glow(el, 380));
  parallax();
}
// nav: 'push' (open a job), 'pop' (back), 'tab', 'next' / 'prev' (week or month arrows). Animates the new page in.
let navT = 0;
function render(nav) {
  if (S.splashHold) { S.splashDirty = true; return; }  // no redraws while the opening animation plays
  render2(); const fab = canEdit() && S.me && (!S.job || (desk() && S.tab === 'jobs')) && ['today', 'week', 'cal', 'jobs'].includes(S.tab) && !!S.data;
  if (fab) $('#app').insertAdjacentHTML('beforeend', S.tab === 'jobs' ? `<button class="fab" data-act="jnew">${PLUS}New job</button>` : `<button class="fab" data-act="edadd">${PLUS}Add</button>`);
  const a = $('#app'); a.className = '';
  if (fab) a.classList.add('has-fab');
  if (nav && motionOK.matches) { void a.offsetWidth; a.classList.add('nv-' + nav); clearTimeout(navT); navT = setTimeout(() => { a.classList.remove('nv-' + nav); }, 420); }
  if (nav) motion(); else { io?.disconnect(); parallax(); }
  const cbt = $('#cbt'); if (cbt) cbt.textContent = cbarTitle(); cbarUpdate();
  if (nav === 'push') countUp();
  deskAfter(); goShortcut();
}
// Computer layout: wide windows get a sidebar, a week board, a split Jobs view and centered pop-ups.
const deskMQ = matchMedia('(min-width: 1100px)'), desk = () => deskMQ.matches;
const setDesk = () => document.documentElement.classList.toggle('desk', desk());
setDesk(); loadDeskMap(); deskMQ.addEventListener?.('change', () => { setDesk(); loadDeskMap(); if (S.data && !S.splashHold) { if (!desk() && S.tab === 'jobs') S.job = null; render(); } });
function sideBar() {
  const nav = $('#tabs'); if (!nav.querySelector('.slg')) { nav.insertAdjacentHTML('afterbegin', `<div class="slg" aria-hidden="true">${LOGO}</div>`); nav.insertAdjacentHTML('beforeend', '<div class="sfoot"></div>'); }
  nav.querySelector('.sfoot').innerHTML = `<span class="av" style="background:${avColor(S.me)}">${esc(S.me[0])}</span><span><b>${esc(first(S.me))}</b><small>${canEdit() ? 'Can edit' : 'Crew'}</small></span>`;
  if (!nav.querySelector('.scol')) nav.querySelector('.slg').insertAdjacentHTML('afterend', `<button class="scol" data-act="slim" aria-label="Collapse the sidebar" title="Collapse the sidebar">${I('<path d="M15 6l-6 6 6 6"/>', 18)}</button>`);
  nav.querySelectorAll('button[data-tab]').forEach(b => { b.title = b.textContent.trim(); });
}
const setSlim = on => { document.documentElement.classList.toggle('slim', on); const b = $('#tabs .scol'); if (b) { b.title = b.ariaLabel = on ? 'Expand the sidebar' : 'Collapse the sidebar'; } };
setSlim(!!store.get('slim'));
// Installed on a computer: the dark header runs up into the window's title bar.
const wcoMQ = matchMedia('(display-mode: window-controls-overlay)');
const setWco = () => document.documentElement.classList.toggle('wco', wcoMQ.matches);
setWco(); wcoMQ.addEventListener?.('change', setWco);
document.body.insertAdjacentHTML('afterbegin', '<div id="tbar" aria-hidden="true"></div>');
// Keyboard on a computer: / opens search, Escape closes a pop-up.
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === '/' && !typing && !$('#sheet .ov') && S.data) { e.preventDefault(); $('#app [data-act=search]')?.click(); }
  else if (e.key === 'Escape' && $('#ctx')) { e.preventDefault(); ctxClose(); }
  else if (e.key === 'Escape' && $('#sheet .ov')) { e.preventDefault(); $('#sheet .sh .done, #sheet [data-act=sclose]')?.click(); }
});
/* ---------- computer extras: drag to reschedule, right-click menus, calendar previews, taskbar shortcuts ---------- */
// One schedule change without opening the editor, with an Undo on the message.
async function schedPost(body, msg, undo) {
  toast('Saving…');
  try {
    const b = { u: S.key, ...body };
    const res = __PREVIEW__ ? previewWrite(b) : await fetch(DATA_URL, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
    if (!res.ok) throw new Error(res.error || 'Could not save.');
    if (__PREVIEW__) render(); else await load();
    toast(msg, undo ? { label: 'Undo', fn: () => schedPost(undo, 'Change undone.') } : null);
  } catch (err) { toast(S.offline || !navigator.onLine ? 'No signal. Nothing was saved.' : err.message); if (!__PREVIEW__) load(); }
}
const itemOf = (r, over = {}) => ({ date: r.from || r.date, thru: r.thru || '', job: r.job, start: r.start, crew: [...r.crew], notes: r.notes || '', ...over });
const multiDay = r => !!(r.thru && r.thru !== (r.from || r.date));
const short = d => fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' });
function moveRow(r, to) {
  const name = jobById(r.job)?.name || r.job;
  if (multiDay(r)) {  // a multi-day row: shift the whole run, but let them check it first
    const delta = Math.round((fromKey(to) - fromKey(r.date)) / 864e5);
    editor(r); S.ed.from = addDays(r.from || r.date, delta); S.ed.thru = addDays(r.thru, delta);
    S.ed.note = `${esc(name)} runs ${short(r.from || r.date)} to ${short(r.thru)}. Moving it shifts every day by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'}. Check the dates and save.`; return drawEditor();
  }
  schedPost({ action: 'update', row: r.row, expect: { date: r.date, job: r.job }, item: itemOf(r, { date: to }) }, `Moved ${name} to ${short(to)}.`,
    { action: 'update', row: r.row, expect: { date: to, job: r.job }, item: itemOf(r) });
}
function addCrew(r, who) {
  if (r.crew.includes(who)) return toast(`${first(who)} is already on it.`);
  const name = jobById(r.job)?.name || r.job;
  if (multiDay(r)) { editor(r); S.ed.crew.push(who); S.ed.note = `${esc(name)} runs ${short(r.from || r.date)} to ${short(r.thru)}. ${esc(first(who))} will be added to every day. Save to confirm.`; return drawEditor(); }
  schedPost({ action: 'update', row: r.row, expect: { date: r.date, job: r.job }, item: itemOf(r, { crew: [...r.crew, who] }) }, `Added ${first(who)} to ${name}, ${short(r.date)}.`,
    { action: 'update', row: r.row, expect: { date: r.date, job: r.job }, item: itemOf(r) });
}
function dupRow(r, d) {
  let nd = addDays(d, 1); while ([0, 6].includes(fromKey(nd).getDay())) nd = addDays(nd, 1);
  schedPost({ action: 'add', item: itemOf(r, { date: nd, thru: '' }) }, `Copied ${jobById(r.job)?.name || r.job} to ${short(nd)}.`);
}
function deskAfter() {
  ctxClose(); hovHide();
  if (!desk() || !canEdit() || S.tab !== 'week' || S.job) return;
  const board = $('main.board'); if (!board) return;
  board.querySelectorAll('.as[data-edrow]').forEach(b => { const r = JSON.parse(b.dataset.edrow); if (r.job) b.draggable = true; });
  board.insertAdjacentHTML('beforebegin', `<div class="w cstrip"><span>Drag a job to another day, or drag a name onto a job</span>${(S.data?.crew || []).map(c => `<span class="chip dc" draggable="true" data-dragcrew="${esc(c.name)}"><i class="av" style="background:${avColor(c.name)}">${esc(first(c.name)[0] || '')}</i>${esc(first(c.name))}</span>`).join('')}</div>`);
}
const dropClear = () => document.querySelectorAll('.dropok').forEach(x => x.classList.remove('dropok'));
document.addEventListener('dragstart', e => {
  const row = e.target.closest?.('.board .as[data-edrow]'), chip = e.target.closest?.('[data-dragcrew]');
  if (row) S.drag = { kind: 'row', r: JSON.parse(row.dataset.edrow) }; else if (chip) S.drag = { kind: 'crew', who: chip.dataset.dragcrew }; else return;
  e.dataTransfer.effectAllowed = row ? 'move' : 'copy'; e.dataTransfer.setData('text/plain', S.drag.kind); (row || chip).classList.add('dragging'); ctxClose(); hovHide();
});
document.addEventListener('dragover', e => {
  const d = S.drag; if (!d) return; let tgt = null;
  if (d.kind === 'row') { const day = e.target.closest('.board .day[data-date]'); if (day && day.dataset.date !== d.r.date && !rowsOn(day.dataset.date).some(x => !x.job)) tgt = day; }
  else { const as = e.target.closest('.board .as[data-edrow]'); if (as && JSON.parse(as.dataset.edrow).job) tgt = as; }
  if (!tgt) { dropClear(); return; }
  e.preventDefault(); e.dataTransfer.dropEffect = d.kind === 'row' ? 'move' : 'copy';
  if (!tgt.classList.contains('dropok')) { dropClear(); tgt.classList.add('dropok'); }
});
document.addEventListener('drop', e => {
  const d = S.drag, tgt = $('.dropok'); if (!d || !tgt) return; e.preventDefault(); dropClear(); S.drag = null;
  if (d.kind === 'row') moveRow(d.r, tgt.dataset.date); else addCrew(JSON.parse(tgt.dataset.edrow), d.who);
});
document.addEventListener('dragend', () => { S.drag = null; dropClear(); document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging')); });

// Right-click menus on jobs and schedule rows
function ctxClose() { $('#ctx')?.remove(); S.ctx = null; }
document.addEventListener('contextmenu', e => {
  if (!desk() || !S.data) return;
  const el = e.target.closest('[data-edrow], .card[data-vt], .jl[data-job], .lg[data-job], .as[data-job], [data-cj], .jhd');
  if (!el) return ctxClose();
  let job = null, r = null;
  if (el.dataset.edrow) { r = JSON.parse(el.dataset.edrow); job = r.job; }
  else if (el.dataset.cj) { job = el.dataset.cj; const d = el.closest('[data-day]')?.dataset.day; r = d ? rowsOn(d).find(x => x.job === job) : null; }
  else if (el.classList.contains('jhd')) job = S.job;
  else { job = el.dataset.vt || el.dataset.job; const d = el.dataset.date || el.closest('[data-date]')?.dataset.date; r = d ? rowsOn(d).find(x => x.job === job) : null; }
  const j = jobById(job); if (!j && !r) return ctxClose();
  e.preventDefault(); ctxClose(); S.ctx = { job, r };
  const it = (act, icon, label) => `<button role="menuitem" data-ctx="${act}">${icon}${label}</button>`;
  const items = [j && it('open', INFO, 'Open job'), canEdit() && r && it('edrow', PENCIL, 'Edit schedule'), canEdit() && j && it('edjob', PENCIL, 'Edit job info'),
    j?.address && '<hr>', j?.address && it('nav', NAV, 'Navigate'), j?.address && it('copy', PIN, 'Copy address'),
    canEdit() && r?.job && '<hr>', canEdit() && r?.job && it('dup', PLUS, `Copy to the next workday`)].filter(Boolean).join('');
  document.body.insertAdjacentHTML('beforeend', `<div id="ctx" class="ctx" role="menu">${j ? `<div class="ctt">${jdot(job)}${esc(j.name)}</div>` : ''}${items}</div>`);
  const m = $('#ctx'), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(e.clientX, innerWidth - w - 8) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - h - 8) + 'px';
});
document.addEventListener('click', e => {
  const b = e.target.closest('#ctx [data-ctx]'); if (!b) { if (!e.target.closest('#ctx')) ctxClose(); return; }
  e.stopPropagation(); const { job, r } = S.ctx || {}, j = jobById(job), a = b.dataset.ctx; ctxClose();
  if (a === 'open') openJob(job);
  else if (a === 'edrow') editor(r);
  else if (a === 'edjob') jobForm(j);
  else if (a === 'nav') open(mapsUrl(j.address), '_blank', 'noopener');
  else if (a === 'copy') navigator.clipboard?.writeText(cleanAddr(j.address)).then(() => toast('Address copied.'), () => toast('Could not copy.'));
  else if (a === 'dup') dupRow(r, r.date);
}, true);
addEventListener('scroll', () => { ctxClose(); hovHide(); }, { passive: true }); addEventListener('resize', ctxClose); addEventListener('blur', ctxClose);

// Calendar: hover a day to see who's where without clicking
let hovT = 0;
function hovHide() { clearTimeout(hovT); $('#hov')?.remove(); }
document.addEventListener('mouseover', e => {
  if (!desk() || S.drag) return;
  const cell = e.target.closest('.cd[data-day]');
  if (!cell) { if (!e.target.closest('#hov')) hovHide(); return; }
  if ($('#hov')?.dataset.day === cell.dataset.day) return;
  hovHide(); const d = cell.dataset.day, rows = rowsOn(d); if (!rows.length) return;
  hovT = setTimeout(() => {
    const off = rows.find(r => !r.job);
    const body = off ? `<p class="hn">${esc(off.notes || 'Day off')}</p>` : rows.map(r => { const j = jobById(r.job), w = j && wxFor(j, d);
      return `<div class="hr"><span class="ht">${time12(r.start)}</span><div><b>${jdot(r.job)}${esc(j?.name || r.job)}</b><div class="hc">${esc(r.crew.map(first).join(', '))}${w ? ` · ${w.hi}° · ${w.pop}%` : ''}</div>${r.notes ? `<p class="hn">${esc(r.notes)}</p>` : ''}</div></div>`; }).join('');
    document.body.insertAdjacentHTML('beforeend', `<div id="hov" class="hov" data-day="${d}"><div class="hh">${fmtDay(d, { weekday: 'long', month: 'short', day: 'numeric' })}</div>${body}</div>`);
    const h = $('#hov'), rc = cell.getBoundingClientRect(), w = h.offsetWidth, ht = h.offsetHeight;
    const x = rc.right + 10 + w < innerWidth ? rc.right + 10 : rc.left - w - 10;
    h.style.left = Math.max(8, x) + 'px'; h.style.top = Math.max(8, Math.min(rc.top, innerHeight - ht - 8)) + 'px';
  }, 280);
});

// Taskbar shortcuts open the app with ?go=…
let GO = new URLSearchParams(location.search).get('go');
function goShortcut() {
  if (!GO || !S.data || !S.me || S.splashHold) return; const g = GO; GO = null;
  history.replaceState(null, '', location.pathname);
  if (g === 'receipt') return rcptForm({ job: '' });
  if (g === 'newjob' && canEdit()) { S.tab = 'jobs'; render('tab'); return jobForm(null); }
  if (['week', 'cal', 'jobs', 'today'].includes(g) || g === 'newjob') { S.tab = g === 'newjob' ? 'jobs' : g; S.job = null; render('tab'); }
}
// Opening a job adds a history step, so the phone's own back button or swipe closes it.
function openJob(id) { if (desk()) return deskOpen(id); S.listY = scrollY; S.job = id; history.pushState({ job: id }, ''); scrollTo(0, 0); render('push'); }
function closeJob() { S.job = null; render('pop'); scrollTo(0, S.listY || 0); parallax(); }
addEventListener('popstate', () => { if (S.skipPop) { S.skipPop = false; return; } if (S.job) closeJobAnimated(); });
function render2() {
  if (S.key && !S.bad && !S.offline && !S.data) return skeletonScreen();
  if (!S.key || S.bad || !S.me || !S.data) return linkScreen();
  $('#tabs').hidden = false; sideBar();
  if (desk() && S.tab === 'jobs') { document.querySelectorAll('#tabs button').forEach(b => b.toggleAttribute('aria-current', b.dataset.tab === 'jobs')); return deskJobs(); }
  document.querySelectorAll('#tabs button').forEach((b, i) => { b.toggleAttribute('aria-current', false); if (b.dataset.tab === S.tab) { b.setAttribute('aria-current', 'page'); $('#tabs').style.setProperty('--ti', i); } });
  if (S.job) jobScreen(); else if (S.tab === 'week') weekScreen(); else if (S.tab === 'jobs') jobsScreen(); else if (S.tab === 'cal') calScreen(); else todayScreen();
}
document.addEventListener('click', e => {
  const b = e.target.closest('button, .ov'); if (!b) return; const d = b.dataset;
  if (b.classList.contains('ov') && e.target !== b) return;
  if (d.act === 'sclose') { closeSheet(); S.sAll = null; return; }
  if (d.sq !== undefined) { S.sq = d.sq; $('#sq').value = d.sq; return drawResults(); }
  if (d.sall) { S.sAll = d.sall; return drawResults(); }
  if (d.sjob) return searchGo(() => { if (S.job !== d.sjob) { S.tab = 'jobs'; openJob(d.sjob); } else render();
    // Products jump to their scope line, receipts to the receipts section.
    const line = d.sline !== undefined ? jobById(d.sjob)?.scope?.[+d.sline] : null;
    if (line || d.srcpt) setTimeout(() => {
      const el = line ? [...document.querySelectorAll('#app .st')].find(x => [line.scope, line.product].filter(Boolean).every(t => x.textContent.includes(t))) : $('#app .rcl');
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); glow(el, 250); }
    }, 380); });
  if (d.sday) return searchGo(() => { S.job = null; S.tab = 'cal'; S.month = d.sday.slice(0, 8) + '01'; S.sel = d.sday; render('tab'); scrollTo(0, 0); });
  if (d.sperson) return searchGo(() => { S.job = null; S.tab = 'week'; const nx = (S.data.schedule || []).filter(r => r.job && r.date >= today() && r.crew.includes(d.sperson)).sort((a, b) => a.date.localeCompare(b.date))[0];
    S.week = mondayOf(nx ? nx.date : today()); render('tab'); scrollTo(0, 0); });
  if (d.act === 'fclose') { S.form = null; closeSheet(); return; }
  if (d.sidx !== undefined) return scopeForm(jobById(S.job), +d.sidx);
  if (d.rrow) return rcptForm((canEdit() ? S.data.receipts : S.data.myReceipts).find(r => r.row === +d.rrow));
  if (d.act === 'edclose') { S.ed = null; closeSheet(); if (!d.job) return; }
  if (d.edrow) return editor(JSON.parse(d.edrow));
  if (d.edmode) { S.ed.off = d.edmode === 'off'; S.ed.err = ''; return drawEditor(); }
  if (d.crew && S.ed) { const c = S.ed.crew, i = c.indexOf(d.crew); i < 0 ? c.push(d.crew) : c.splice(i, 1); b.setAttribute('aria-pressed', i < 0); return; }
  if (d.tab) { buzz(); if (d.tab === S.tab && !S.job) return scrollTo({ top: 0, behavior: motionOK.matches ? 'smooth' : 'auto' }); S.tab = d.tab; S.job = null; scrollTo(0, 0); return render('tab'); }
  if (d.job) return openJobFrom(d.job, b.closest('[data-vt], .jl, .as, .card'));
  if (d.day) { S.sel = d.day; if (d.day.slice(0, 7) !== S.month.slice(0, 7)) S.month = d.day.slice(0, 8) + '01'; return render(); }
  const act = d.act;
  if (act === 'back') { if (history.state?.job) { S.skipPop = true; history.back(); } closeJobAnimated(); }
  else if (act === 'wprev' || act === 'wnext') { S.week = addDays(S.week, act === 'wprev' ? -7 : 7); render(act === 'wprev' ? 'prev' : 'next'); }
  else if (act === 'mprev' || act === 'mnext' || act === 'mnow') {
    const f = fromKey(S.month); if (act === 'mnow') S.month = today().slice(0, 8) + '01'; else { f.setMonth(f.getMonth() + (act === 'mprev' ? -1 : 1)); S.month = keyOf(f); }
    S.sel = S.month.slice(0, 7) === today().slice(0, 7) ? today() : S.month; render(act === 'mprev' ? 'prev' : act === 'mnext' ? 'next' : 'tab'); }
  else if (act === 'edadd') editor({ date: S.tab === 'cal' ? S.sel : S.tab === 'week' && S.week > today() ? S.week : today() });
  else if (act === 'edsave') edSave(false);
  else if (act === 'jedit') jobForm(jobById(S.job));
  else if (act === 'jnew') jobForm(null);
  else if (act === 'sadd') scopeForm(jobById(S.job), -1);
  else if (act === 'radd') rcptForm({ job: S.job || '' });
  else if (act === 'slim') { const on = !document.documentElement.classList.contains('slim'); store.set('slim', on); setSlim(on); }
  else if (act === 'toastfn') { const f = toast.fn; toast.fn = null; $('#toast')?.classList.remove('show'); f?.(); }
  else if (act === 'rall') { S.allRcpt = S.job; render(); }
  else if (act === 'fsave') formSave(false);
  else if (act === 'fdel') { if (S.form.del) formSave(true); else { S.form.del = true; drawForm(); } }
  else if (act === 'eddel') { if (S.ed.del) edSave(true); else { S.ed.del = true; drawEditor(); } }
  else if (act === 'settings') settings();
  else if (act === 'search') searchOpen();
  else if (act === 'close') closeSheet();
  else if (act === 'refresh') { closeSheet(); load(true); }
});
let toastT = 0;
function toast(msg, action) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.toggle('act', !!action); toast.fn = action?.fn || null;
  if (action) t.insertAdjacentHTML('beforeend', `<button data-act="toastfn">${esc(action.label)}</button>`);
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 7000 : 3200); }
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; const pos = e.target.selectionStart; if (desk() && $('.jlist')) { $('.jlist').innerHTML = jobsHTML(true); return; } jobsScreen(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.badge = 0; navigator.clearAppBadge?.().catch(() => {}); load(); } });
// Installed app: check for schedule changes every 5 minutes while it sits in the background, and count them on the taskbar icon.
if (matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)').matches) setInterval(() => { if (document.hidden && S.key) load(); }, 5 * 60e3);
// editor form fields
const edField = e => { const el = e.target.closest('[data-f]'); if (!el || !S.ed) return; const f = el.dataset.f;
  if (f === 'multi') { S.ed.multi = el.checked; if (S.ed.multi && !S.ed.thru) S.ed.thru = addDays(S.ed.from, 4); return drawEditor(); }
  S.ed[f] = el.value; S.ed.del = false; if (S.ed.err) { S.ed.err = ''; } };
document.addEventListener('input', edField); document.addEventListener('change', edField);
const fField = e => { const el = e.target.closest('[data-ff]'); if (!el || !S.form) return; S.form.v[el.dataset.ff] = el.value; S.form.del = false;
  if (el.dataset.ff === 'status') drawForm();
  if (el.dataset.ff === 'card' && S.form.kind === 'rcpt') { S.form.v.cat = el.value === 'Gas card' ? 'Fuel' : S.form.v.cat === 'Fuel' ? 'Materials' : S.form.v.cat; drawForm(); } };
document.addEventListener('input', fField);
document.addEventListener('input', e => { if (e.target.id === 'sq') { S.sq = e.target.value; S.sAll = null; drawResults(); } });
document.addEventListener('keydown', e => { if (e.target.id === 'sq' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }); document.addEventListener('change', fField);
/* ---------- pull to refresh (touch phones) ---------- */
const MTN = I('<path d="M3 19L9.5 8l3.5 5.5L15.5 10 21 19z"/>', 22);
document.body.insertAdjacentHTML('beforeend', `<div id="ptr" aria-hidden="true"><div class="pi"><i class="arc"></i>${MTN}</div></div>`);
document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active press feedback work on iPhone
let pull = null;
const ptr = $('#ptr'), ptrAt = (px, rot) => { ptr.style.transform = `translate3d(-50%,${px}px,0)`; ptr.querySelector('.arc').style.transform = `rotate(${rot}deg)`; };
// The scroll-blocking listener is only attached while a pull might be starting (finger down at the very top),
// so normal scrolling never waits on it.
document.addEventListener('touchstart', e => { if (scrollY <= 0 && S.me && !$('#sheet').firstChild && !ptr.classList.contains('spin')) { pull = { y: e.touches[0].clientY, d: 0 }; document.addEventListener('touchmove', onPull, { passive: false }); } }, { passive: true });
function onPull(e) {
  if (!pull) return; const dy = e.touches[0].clientY - pull.y;
  if (dy <= 0 || scrollY > 0) { if (pull.d) { ptrAt(-70, 0); pull.d = 0; return; } pull = null; document.removeEventListener('touchmove', onPull, { passive: false }); return; }
  e.preventDefault(); const was = pull.d >= 64; pull.d = Math.min(120, dy * .5); ptr.classList.add('drag'); ptr.classList.toggle('ready', pull.d >= 64); ptrAt(pull.d - 64, pull.d * 3);
  if (!was && pull.d >= 64) navigator.vibrate?.(8);  // a light tick on Android when it's far enough
}
document.addEventListener('touchend', async () => {
  document.removeEventListener('touchmove', onPull, { passive: false });
  if (!pull) return; const go = pull.d >= 64; pull = null; ptr.classList.remove('drag', 'ready');
  if (!go) return ptrAt(-70, 0);
  ptr.classList.add('spin'); ptrAt(14, 0);
  await Promise.all([load(true), new Promise(r => setTimeout(r, 700))]);
  ptr.classList.remove('spin'); ptrAt(-70, 0);
});
/* Opening animation. The app's first screen is built and the logo font loaded while the screen is still plain dark,
   then the logo fades up with nothing else running. Schedule and weather updates that arrive meanwhile are held and
   drawn once, behind the finished logo, before it fades away. */
const splash = $('#splash');
render('tab');
if (splash) {
  // Just the contour lines here: no mountain markers or labels competing with the logo.
  const map = TOPO('splash'), lines = map.slice(0, map.indexOf('</g>') + 4).replace('<use href="#topo-map"/>', '<use href="#topo-map"/>' + TOPO_FILL);
  splash.insertAdjacentHTML('afterbegin', lines + '</svg></svg>');
  S.splashHold = true;
  const frames = n => new Promise(r => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
  const fontReady = Promise.race([Promise.all([document.fonts?.load('900 1em Archivo'), document.fonts?.ready]), new Promise(r => setTimeout(r, 700))]);
  let finished = false;
  const finish = async () => {
    if (finished) return; finished = true;
    S.splashHold = false;
    if (S.splashDirty) { S.splashDirty = false; render(); await frames(2); }
    splash.classList.add('out'); setTimeout(() => splash.remove(), 600);
    if (waitLoad) setTimeout(() => { load(); loadWeather(); }, 520);  // fresh data once the logo has faded
  };
  // With a saved schedule on the phone, the app is already showing it, so checking for updates can wait 2 seconds.
  var waitLoad = !!(S.key && S.data);
  fontReady.then(() => frames(2)).then(() => { splash.classList.add('go'); setTimeout(finish, 2400); });
  setTimeout(finish, 4200);  // never hold the app longer than this
}
if (!splash || !waitLoad) { load(); loadWeather(); }
if (!PREVIEW && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
