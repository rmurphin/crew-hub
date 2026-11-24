// MPNW Crew Hub: where the crew goes each day, and what the job needs.
// Data comes from the company tracker (Google Sheet) through a crew-safe feed: no costs, notes or pay.
import TOPO_MAP from './topo.svg';
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
const SPOTS = { today: { x: '55%', y: 100, k: 2.6, few: 1 }, bar: { x: '40%', y: 30, k: 2.6, adams: 'b', few: 1 }, job: { x: '47%', y: 24, k: 2.6, adams: 'b', few: 1 }, link: { x: '47%', y: () => Math.round(Math.max(510, innerHeight * .64)), k: 2.6 } };
const TOPO = spot => {
  const { x, k, adams = 'a', few } = SPOTS[spot], y = typeof SPOTS[spot].y === 'function' ? SPOTS[spot].y() : SPOTS[spot].y, G = '#9cc4a8', W = '#eef2ee';
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
  return `<svg class="topo" aria-hidden="true" focusable="false"><svg x="${x}" y="${y}" overflow="visible"><g transform="scale(${k})"><use href="#topo-map"/></g>${marks}</svg></svg>`;
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
    const d = await r.json(); if (__PREVIEW__) d.me = (d.mockKeys || {})[S.key] || null; // preview only: sample data carries test codes
    S.offline = false;
    if (!d.me) { S.bad = true; S.me = S.data = null; store.set('me', null); store.set('data', null); }
    else { S.bad = false; S.me = d.me; fresh = trackChanges(S.data, d); S.data = d; store.set('me', d.me); store.set('data', d); }
  } catch (e) { S.offline = true; }
  render();
  if (fresh.length) toast('Schedule updated: ' + (fresh.length > 3 ? fresh.length + ' days changed' : fresh.map(d => fmtDay(d, { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')));
  else if (manual) toast(S.offline ? 'No signal. Showing the last schedule.' : 'Schedule is up to date.');
}

/* ---------- pieces ---------- */
// Prevailing wage: the job's public rate from its tracker tab. Nobody's own pay rate is ever in the feed.
const usd = n => '$' + Number(n).toFixed(2);
const DOLLAR = I('<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.6 0-4.2 1.3-4.2 3.1 0 4.5 9 2.3 9 6.8 0 1.9-1.8 3.2-4.6 3.2-2.3 0-4-.8-4.9-2.3"/>', 18);
const pwStrip = j => j?.pw ? `<div class="pw">${DOLLAR}<span class="pwk">Prevailing wage</span><b>${usd(j.pw.rate)}<small>/hr</small></b></div>` : '';
const pwPill = j => j?.pw ? '<span class="pill pwp">PW</span>' : '';
const crewChips = (names, skipMe) => names.filter(n => !(skipMe && n === S.me)).map(n => `<span class="chip${n === S.me ? ' me' : ''}">${esc(first(n))}</span>`).join('');
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
  return `<div class="card${small ? ' sm' : ' hero'}${S.changed.has(r.date) ? ' chg' : ''}" data-date="${r.date}">
    <div class="kick">${label}${S.changed.has(r.date) ? '<strong class="ctag">Updated</strong>' : ''}<span class="time">${time12(r.start)}</span></div>
    <div class="jn">${esc(j.name)}</div>
    <div class="meta">${esc(j.gc ? 'GC: ' + j.gc : '')}</div>
    ${j.address ? `<div class="addr">${PIN}<span>${esc(j.address)}</span></div>` : ''}
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
  const todayBlock = mine.length ? mine.map(r => assignCard(r, evening ? 'Today' : 'Today', !!evening)).join('') : `<div class="card${evening ? ' sm' : ' hero'}"><div class="kick">Today</div><div class="jn">${off ? esc(off.notes || 'No work today') : 'Not scheduled today'}</div><div class="empty">${off ? '' : 'Nothing on the schedule for you. Check with Riley if that seems wrong.'}</div></div>`;
  const tmrLabel = fmtDay(tmr, { weekday: 'short', month: 'short', day: 'numeric' });
  $('#app').innerHTML = `<header class="band tall">${TOPO('today')}<div class="w"><div class="top">${LOGO}<button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></div>
    <div class="hi"><h1>Hi ${esc(first(S.me))}</h1><p>${fmtDay(k, { weekday: 'long', month: 'long', day: 'numeric' })}</p>${updated()}</div></div></header>
  <main class="w lift">
    ${evening ? tmrRows.map(r => assignCard(r, 'Tomorrow · ' + tmrLabel, false)).join('') + `<div class="sec">Earlier today</div>` + todayBlock : todayBlock +
      (tmrRows.length ? `<div class="sec">Tomorrow · ${tmrLabel}</div>` + tmrRows.map(r => assignCard(r, fmtDay(tmr, { weekday: 'long' }), true)).join('')
      : next ? `<div class="sec">Next up · ${fmtDay(next.d, { weekday: 'short', month: 'short', day: 'numeric' })}</div>` + next.r.map(r => assignCard(r, fmtDay(next.d, { weekday: 'long' }), true)).join('') : '')}
  </main>`;
}
function daySection(d, rows) {
  return `<section class="day${d === today() ? ' now' : ''}${S.changed.has(d) ? ' chg' : ''}" data-date="${d}"><div class="dh">${fmtDay(d, { weekday: 'long' })}<span>${fmtDay(d, { month: 'short', day: 'numeric' })}</span>${S.changed.has(d) ? '<strong class="ctag">Updated</strong>' : ''}${d === today() ? '<em>Today</em>' : ''}</div>
      ${rows.length ? rows.map(r => r.job ? `<button class="as" data-job="${r.job}"><span class="t">${time12(r.start).replace(' ', ' ')}</span><span class="n">${S.tab === 'cal' ? `<i class="sw" style="background:${jobColor(r.job)}"></i>` : ''}${esc(jobById(r.job)?.name || r.job)}${pwPill(jobById(r.job))}</span><span class="c">${crewChips(r.crew)}</span>${r.notes ? `<span class="x">${esc(r.notes)}</span>` : ''}</button>`
        : `<div class="dn">${esc(r.notes || 'No work')}</div>`).join('') : `<div class="dn">${S.mine ? 'Not scheduled' : 'No work scheduled'}</div>`}</section>`;
}
// Each job keeps one color everywhere on the calendar (bars, legend, day list). Mid tones read on light and dark.
const PALETTE = ['#5e9474', '#5f86b0', '#c49a4a', '#b86b52', '#8a78b8', '#4f9592', '#b06a8a', '#86935a', '#7b8794'];
const jobColor = id => { const ids = [...new Set((S.data?.schedule || []).filter(r => r.job).map(r => r.job))].sort(); return PALETTE[Math.max(0, ids.indexOf(id)) % PALETTE.length]; };
function calScreen() {
  const m0 = S.month, first = fromKey(m0), start = mondayOf(m0), mm = m0.slice(0, 7);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0), weeks = Math.ceil(((first.getDay() + 6) % 7 + lastDay.getDate()) / 7);
  const rowsFor = d => rowsOn(d).filter(r => !r.job || !S.mine || r.crew.includes(S.me));
  const cells = [...Array(weeks * 7)].map((_, i) => {
    const d = addDays(start, i), rows = rowsFor(d), jobs = rows.filter(r => r.job), off = rows.find(r => !r.job), out = d.slice(0, 7) !== mm;
    const cls = ['cd', out && 'out', d === today() && 'tdy', d === S.sel && 'sel', off && 'off', S.changed.has(d) && 'chg', i % 7 > 4 && 'we', d < today() && 'past'].filter(Boolean).join(' ');
    const label = `${fmtDay(d, { weekday: 'long', month: 'long', day: 'numeric' })}: ${off ? esc(off.notes || 'off') : jobs.length ? jobs.map(r => esc(jobById(r.job)?.name || r.job)).join(', ') : 'nothing scheduled'}`;
    return `<button class="${cls}" data-day="${d}" aria-label="${label}"${d === S.sel ? ' aria-pressed="true"' : ''}><b>${+d.slice(8)}</b>${off ? '<span class="ofl">Off</span>' : `<span class="bars">${jobs.slice(0, 3).map(r => `<i style="background:${jobColor(r.job)}"></i>`).join('')}${jobs.length > 3 ? `<span class="more">+${jobs.length - 3}</span>` : ''}</span>`}</button>`;
  }).join('');
  const seen = [...new Set((S.data?.schedule || []).filter(r => r.job && r.date.startsWith(mm) && (!S.mine || r.crew.includes(S.me))).map(r => r.job))];
  const legend = seen.map(id => `<button class="lg" data-job="${id}"><i style="background:${jobColor(id)}"></i>${esc(jobById(id)?.name || id)}</button>`).join('');
  $('#app').innerHTML = `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></div>
    <div class="wk"><button data-act="mprev" aria-label="Previous month">${L}</button><b>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<br>${mm === today().slice(0, 7) ? '<span class="mt">This month</span>' : '<button class="jt" data-act="mnow">Back to this month</button>'}</b><button data-act="mnext" aria-label="Next month">${R}</button></div>
    <div class="seg"><button data-mine="1" aria-pressed="${S.mine}">My schedule</button><button data-mine="0" aria-pressed="${!S.mine}">Everyone</button></div></div></header>
  <main class="w"><div class="cal"><div class="cw" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div><div class="cg">${cells}</div>
    ${legend ? '' : `<p class="empty" style="margin:12px 4px 2px">${S.mine ? 'Nothing on your schedule this month.' : 'Nothing scheduled this month.'}</p>`}</div>
    ${daySection(S.sel, rowsFor(S.sel))}
    ${legend ? `<div class="sec">Jobs this month</div><div class="legend">${legend}</div>` : ''}</main>`;
}
function weekScreen() {
  const days = [...Array(7)].map((_, i) => addDays(S.week, i));
  const label = `${fmtDay(days[0], { month: 'short', day: 'numeric' })} – ${fmtDay(days[6], { month: 'short', day: 'numeric' })}`;
  $('#app').innerHTML = `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></div>
    <div class="wk"><button data-act="wprev" aria-label="Previous week">${L}</button><b>${S.week === mondayOf(today()) ? 'This week' : label}<br><span style="font-weight:500;font-size:13px;color:#9aa69d">${label}</span></b><button data-act="wnext" aria-label="Next week">${R}</button></div>
    <div class="seg"><button data-mine="1" aria-pressed="${S.mine}">My schedule</button><button data-mine="0" aria-pressed="${!S.mine}">Everyone</button></div></div></header>
  <main class="w">${days.map(d => {
    const rows = rowsOn(d).filter(r => !r.job || !S.mine || r.crew.includes(S.me)), wkend = [0, 6].includes(fromKey(d).getDay());
    if (wkend && !rows.length) return '';
    return daySection(d, rows);
  }).join('')}</main>`;
}
function jobsScreen() {
  const q = S.q.trim().toLowerCase(), all = (S.data?.jobs || []).filter(j => !q || (j.name + ' ' + j.gc + ' ' + j.address).toLowerCase().includes(q));
  const on = all.filter(j => j.status === 'In Progress'), up = all.filter(j => j.status !== 'In Progress').sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
  const row = j => `<button class="jl" data-job="${j.id}"><div class="n">${esc(j.name)}${pwPill(j)}</div>
    <div class="m">${esc([j.gc, city(j.address)].filter(Boolean).join(' · '))}${j.start && j.status !== 'In Progress' && j.start >= today() ? ' · starts ' + fmtDay(j.start, { month: 'short', day: 'numeric', year: j.start.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }) : ''}</div></button>`;
  $('#app').innerHTML = `<header class="band">${TOPO('bar')}<div class="w"><div class="top">${LOGO}<button class="icb" data-act="settings" aria-label="Settings">${GEAR}</button></div>
    <label class="search">${SEARCH}<input id="q" type="search" placeholder="Search jobs, GCs, cities" value="${esc(S.q)}" autocomplete="off"></label></div></header>
  <main class="w">${on.length ? `<div class="sec">In progress</div>${on.map(row).join('')}` : ''}${up.length ? `<div class="sec">Coming up</div>${up.map(row).join('')}` : ''}${!on.length && !up.length ? '<p class="empty" style="margin-top:20px">No jobs match.</p>' : ''}</main>`;
}
function jobScreen() {
  const j = jobById(S.job); if (!j) { S.job = null; return render(); }
  const site = j.site || {}, wk = (S.data.schedule || []).filter(r => r.job === j.id && r.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const tag = (l, v) => v ? `<span class="tag${/tbd|confirm/i.test(v) ? ' tbd' : ''}">${l ? l + ' ' : ''}<b>${esc(v)}</b></span>` : '';
  const na = v => /^n\/?a\b/i.test(String(v || '').trim()) ? '' : v;
  const step = s => `<div class="st">${s.scope ? `<div class="s">${esc(s.scope)}</div>` : ''}${s.product ? `<div class="p">${esc(s.product)}</div>` : ''}
    <div class="tags">${tag('Color', na(s.color))}${tag('', na(s.sheen))}${s.coats ? tag('Coats', s.coats) : ''}${tag(/sf\/gal/i.test(s.sqft) ? 'Coverage' : 'Area', na(s.sqft))}${s.gallons ? tag('Qty', /\D/.test(s.gallons) ? s.gallons : s.gallons + ' gal') : ''}</div></div>`;
  const groups = []; for (const s of j.scope || []) { const g = groups[groups.length - 1]; if (g && g.area === s.area) g.items.push(s); else groups.push({ area: s.area, items: [s] }); }
  const spec = g => `<div class="sp"><div class="a">${esc(g.area)}</div>${g.items.map(step).join('')}</div>`;
  $('#app').innerHTML = `<header class="band">${TOPO('job')}<div class="w jp"><button class="back" data-act="back">${L}Back</button>
    <h1>${esc(j.name)}</h1><p>${esc([j.gc && 'GC: ' + j.gc, j.type].filter(Boolean).join(' · '))}${j.status === 'In Progress' ? '<span class="pill on">In progress</span>' : ''}</p></div></header>
  <main class="w">
    <div class="card">${j.address ? `<div class="addr" style="margin:0">${PIN}<span>${esc(j.address)}</span></div><div class="btns" style="grid-template-columns:1fr"><a class="btn go" href="${mapsUrl(j.address)}" target="_blank" rel="noopener">${NAV}Navigate</a></div>` : '<div class="empty">No address yet.</div>'}
      ${pwStrip(j)}
      ${j.crewNotes ? `<div class="note">${WARN}<span>${esc(j.crewNotes)}</span></div>` : ''}</div>
    <div class="sec">Scope &amp; products</div><div class="card">${groups.length ? groups.map(spec).join('') : '<div class="empty">Scope hasn\'t been entered yet. Check with Riley before starting.</div>'}</div>
    <div class="sec">Site &amp; contacts</div><div class="card">${Object.keys(site).length ? `<dl class="kv">${[['Contact', site.contact], ['Phone', site.phone], ['Email', site.email], ['Access', site.access]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${linkify(v)}</dd>`).join('')}</dl>` : '<div class="empty">No site contact entered yet.</div>'}</div>
    ${wk.length ? `<div class="sec">On the schedule</div><div class="card">${wk.map(r => `<div class="sr"><div class="sd">${fmtDay(r.date, { weekday: 'short', month: 'short', day: 'numeric' })}<span>${time12(r.start)}</span></div><div class="c">${crewChips(r.crew)}</div></div>`).join('')}</div>` : ''}
  </main>`;
}
function settings() {
  $('#sheet').innerHTML = `<div class="ov" data-act="close"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="stH"><div class="sh"><h2 id="stH">Settings</h2><button class="done" data-act="close">Done</button></div>
    <p class="empty" style="margin:0">Signed in as <b style="color:var(--ink)">${esc(S.me)}</b></p>
    <p class="empty" style="margin:4px 0 0;font-size:14px">Not you, or got a new phone? Ask Paul for your link.</p>
    <button class="btn go" data-act="refresh">Refresh schedule</button>
    ${installed() ? '' : `<div class="sec">Put this on your home screen</div>
    <ol>${isIOS ? '<li>In Safari, tap the Share button.</li><li>Tap <b>Add to Home Screen</b>, then Add.</li>' : '<li>In Chrome, tap the ⋮ menu.</li><li>Tap <b>Add to Home screen</b> (or Install app).</li>'}<li>Open MPNW Crew from the new icon.</li></ol>`}
    <p class="empty" style="font-size:13px;margin-top:16px">MPNW Crew Hub ${VERSION}${S.data?.updated ? ' · schedule ' + new Date(S.data.updated).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</p></div></div>`;
}

/* ---------- render & events ---------- */
/* ---------- motion: the header map drifts slower than the page, and cards rise into place as they scroll into view ---------- */
const motionOK = matchMedia('(prefers-reduced-motion: no-preference)');
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
  render2();
  const a = $('#app'); a.className = '';
  if (nav && motionOK.matches) { void a.offsetWidth; a.className = 'nv-' + nav; clearTimeout(navT); navT = setTimeout(() => { a.className = ''; }, 480); }
  motion();
}
// Opening a job adds a history step, so the phone's own back button or swipe closes it.
function openJob(id) { S.listY = scrollY; S.job = id; history.pushState({ job: id }, ''); scrollTo(0, 0); render('push'); }
function closeJob() { S.job = null; render('pop'); scrollTo(0, S.listY || 0); parallax(); }
addEventListener('popstate', () => { if (S.skipPop) { S.skipPop = false; return; } if (S.job) closeJob(); });
function render2() {
  if (!S.key || S.bad || !S.me || !S.data) return linkScreen();
  $('#tabs').hidden = false;
  document.querySelectorAll('#tabs button').forEach(b => b.toggleAttribute('aria-current', false) || (b.dataset.tab === S.tab && b.setAttribute('aria-current', 'page')));
  if (S.job) jobScreen(); else if (S.tab === 'week') weekScreen(); else if (S.tab === 'jobs') jobsScreen(); else if (S.tab === 'cal') calScreen(); else todayScreen();
}
document.addEventListener('click', e => {
  const b = e.target.closest('button, .ov'); if (!b) return; const d = b.dataset;
  if (b.classList.contains('ov') && e.target !== b) return;
  if (d.tab) { if (d.tab === S.tab && !S.job) return scrollTo({ top: 0, behavior: motionOK.matches ? 'smooth' : 'auto' }); S.tab = d.tab; S.job = null; scrollTo(0, 0); return render('tab'); }
  if (d.job) return openJob(d.job);
  if (d.day) { S.sel = d.day; if (d.day.slice(0, 7) !== S.month.slice(0, 7)) S.month = d.day.slice(0, 8) + '01'; return render(); }
  if (d.mine) { S.mine = d.mine === '1'; return render(); }
  const act = d.act;
  if (act === 'back') { if (history.state?.job) { S.skipPop = true; history.back(); } closeJob(); }
  else if (act === 'wprev' || act === 'wnext') { S.week = addDays(S.week, act === 'wprev' ? -7 : 7); render(act === 'wprev' ? 'prev' : 'next'); }
  else if (act === 'mprev' || act === 'mnext' || act === 'mnow') {
    const f = fromKey(S.month); if (act === 'mnow') S.month = today().slice(0, 8) + '01'; else { f.setMonth(f.getMonth() + (act === 'mprev' ? -1 : 1)); S.month = keyOf(f); }
    S.sel = S.month.slice(0, 7) === today().slice(0, 7) ? today() : S.month; render(act === 'mprev' ? 'prev' : act === 'mnext' ? 'next' : 'tab'); }
  else if (act === 'settings') settings();
  else if (act === 'close') $('#sheet').innerHTML = '';
  else if (act === 'refresh') { $('#sheet').innerHTML = ''; load(true); }
});
let toastT = 0;
function toast(msg) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); } t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
document.addEventListener('input', e => { if (e.target.id === 'q') { S.q = e.target.value; const pos = e.target.selectionStart; jobsScreen(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
/* ---------- pull to refresh (touch phones) ---------- */
const MTN = I('<path d="M3 19L9.5 8l3.5 5.5L15.5 10 21 19z"/>', 22);
document.body.insertAdjacentHTML('beforeend', `<div id="ptr" aria-hidden="true"><div class="pi"><i class="arc"></i>${MTN}</div></div>`);
document.addEventListener('touchstart', () => {}, { passive: true }); // lets :active press feedback work on iPhone
let pull = null;
const ptr = $('#ptr'), ptrAt = (px, rot) => { ptr.style.transform = `translate3d(-50%,${px}px,0)`; ptr.querySelector('.arc').style.transform = `rotate(${rot}deg)`; };
document.addEventListener('touchstart', e => { if (scrollY <= 0 && S.me && !$('#sheet').innerHTML && !ptr.classList.contains('spin')) pull = { y: e.touches[0].clientY, d: 0 }; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (!pull) return; const dy = e.touches[0].clientY - pull.y;
  if (dy <= 0 || scrollY > 0) { if (pull.d) ptrAt(-70, 0); pull.d = 0; return; }
  e.preventDefault(); pull.d = Math.min(120, dy * .5); ptr.classList.add('drag'); ptr.classList.toggle('ready', pull.d >= 64); ptrAt(pull.d - 64, pull.d * 3);
}, { passive: false });
document.addEventListener('touchend', async () => {
  if (!pull) return; const go = pull.d >= 64; pull = null; ptr.classList.remove('drag', 'ready');
  if (!go) return ptrAt(-70, 0);
  ptr.classList.add('spin'); ptrAt(14, 0);
  await Promise.all([load(true), new Promise(r => setTimeout(r, 700))]);
  ptr.classList.remove('spin'); ptrAt(-70, 0);
});
render('tab'); load();
if (!PREVIEW && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
