/**
 * MPNW Crew Hub feed.
 *
 * This script lives inside the MPNW Crew Hub sheet and only reads that sheet.
 * The app asks for  <web app URL>?u=<link code>  and gets back the schedule and
 * job info for whoever owns that code. A wrong or deleted code gets nothing.
 *
 * Tabs it reads (row 1 = headers, any column order):
 *   Crew      Name | Role | Link code | Personal link | Active
 *   Jobs      Job ID | Job name | GC | Address | Type | Status | Start date | Prevailing wage ($/hr) |
 *             Crew notes | Site contact | Phone | Email | Site access
 *   Scope     Job ID | Area | Scope | Product | Color | Sheen | Coats | Coverage | Qty
 *   Schedule  Date | Job | Start | one checkbox column per person, headed with their first name | Notes
 *             (a typed "Crew" column of names also still works)
 * Job cells can be "P-03" or the picker's "P-03 · Cape Disappointment ...": only the ID is used.
 * Start here, Lists and Inbox are for people, not the app.
 */

var CACHE_SECONDS = 60;
var DONE = /^(complete|completed|done|closed|cancel)/i;

function doGet(e) {
  var code = String((e && e.parameter && e.parameter.u) || '').trim().toLowerCase();
  var out = { me: null };
  if (code) {
    var data = shared_();
    var me = data.codes[code];
    if (me) {
      out = { me: me, updated: data.updated, crew: data.crew, jobs: data.jobs, schedule: data.schedule };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* Edits made in the sheet reach phones within a minute. */
function onEdit() {
  PropertiesService.getScriptProperties().setProperty('updated', new Date().toISOString());
  CacheService.getScriptCache().remove('feed');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Crew Hub')
    .addItem('Copy selected day to the next workday', 'copyDayForward')
    .addItem('Sort the schedule by date', 'sortSchedule')
    .addSeparator()
    .addItem('Make link codes for anyone missing one', 'makeLinkCodes')
    .addItem('Send changes to phones now', 'onEdit')
    .addToUi();
}

/* Copies every row on the selected row's date to the next Mon-Fri day, without the notes,
   so only what's different needs changing. */
function copyDayForward() {
  var ss = SpreadsheetApp.getActive(), ui = SpreadsheetApp.getUi(), sh = ss.getSheetByName('Schedule');
  var cell = ss.getActiveRange();
  if (!cell || cell.getSheet().getName() !== 'Schedule' || cell.getRow() < 2) {
    ui.alert('Click any row of the day you want to copy on the Schedule tab, then run this again.');
    return;
  }
  var v = sh.getDataRange().getValues(), head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var di = head.indexOf('date'), ni = head.indexOf('notes');
  var from = v[cell.getRow() - 1][di];
  if (!(from instanceof Date)) { ui.alert('That row has no date yet.'); return; }
  var key = function (d) { return d instanceof Date ? d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() : ''; };
  var to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (to.getDay() === 0 || to.getDay() === 6) to.setDate(to.getDate() + 1);
  var rows = v.slice(1).filter(function (r) { return key(r[di]) === key(from); }).map(function (r) {
    var c = r.slice(); c[di] = to; if (ni >= 0) c[ni] = ''; return c;
  });
  var already = v.slice(1).some(function (r) { return key(r[di]) === key(to); });
  var label = Utilities.formatDate(to, ss.getSpreadsheetTimeZone(), 'EEE M/d');
  if (already && ui.alert(label + ' already has rows. Add these as well?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sortSchedule();
  ss.toast('Copied ' + rows.length + (rows.length === 1 ? ' job' : ' jobs') + ' to ' + label + '. Notes were left blank.', 'Crew Hub', 6);
}

function sortSchedule() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Schedule');
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).sort([{ column: 1, ascending: true }, { column: 3, ascending: true }]);
  onEdit();
}

/* Fills an empty Link code cell for every crew row with a name.
   To cut off someone's old link: delete their code, then run this for a new one. */
function makeLinkCodes() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Crew');
  var v = sh.getDataRange().getValues();
  var head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var ni = head.indexOf('name'), ci = head.indexOf('link code');
  var used = {};
  v.slice(1).forEach(function (r) { used[String(r[ci]).toLowerCase()] = true; });
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][ni]).trim() && !String(v[i][ci]).trim()) {
      var c;
      do { c = newCode_(); } while (used[c]);
      used[c] = true;
      sh.getRange(i + 1, ci + 1).setValue(c);
    }
  }
  onEdit();
}

function newCode_() {
  // 10 characters from a random UUID: about a trillion possibilities.
  return Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function shared_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('feed');
  if (hit) return JSON.parse(hit);
  var data = build_();
  try { cache.put('feed', JSON.stringify(data), CACHE_SECONDS); } catch (err) { /* too big to cache; still served */ }
  return data;
}

function build_() {
  var ss = SpreadsheetApp.getActive();
  var tz = ss.getSpreadsheetTimeZone();
  var day = function (v) {
    if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    var m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : '';
  };

  // Crew: active people with a name. Codes stay on the server.
  var codes = {}, crew = [];
  rows_(ss, 'Crew').forEach(function (r) {
    var name = txt_(r, 'name');
    if (!name || !isTrue_(r.active)) return;
    crew.push({ name: name, role: txt_(r, 'role') });
    var code = txt_(r, 'link code').toLowerCase();
    if (code) codes[code] = name;
  });
  var jobId = function (v) { var m = String(v || '').match(/[A-Za-z]+-\d+/); return m ? m[0].toUpperCase() : ''; };
  var checked = function (r) {  // checkbox columns headed with a person's first or full name
    return crew.filter(function (c) {
      return r[c.name.toLowerCase()] === true || r[c.name.split(' ')[0].toLowerCase()] === true;
    }).map(function (c) { return c.name; });
  };
  var who = function (list) {
    return String(list || '').split(/\s*(?:,|&|\/|;|\+|\band\b)\s*/i).map(function (n) { return n.trim(); }).filter(String).map(function (n) {
      var full = crew.filter(function (c) { return c.name.toLowerCase() === n.toLowerCase(); })[0];
      if (full) return full.name;
      var first = crew.filter(function (c) { return c.name.split(' ')[0].toLowerCase() === n.toLowerCase(); });
      return first.length === 1 ? first[0].name : n;
    });
  };

  // Schedule: from two months back to six months out.
  var today = new Date(), from = day(new Date(today.getTime() - 60 * 864e5)), to = day(new Date(today.getTime() + 183 * 864e5));
  var schedule = [];
  rows_(ss, 'Schedule').forEach(function (r) {
    var d = day(r.date);
    if (!d || d < from || d > to) return;
    var job = jobId(r.job !== undefined ? r.job : r['job id']), notes = txt_(r, 'notes');
    if (!job && !notes) return;
    var people = checked(r);
    who(r.crew).forEach(function (n) { if (people.indexOf(n) < 0) people.push(n); });
    schedule.push({ date: d, job: job, crew: job ? people : [], start: job ? time_(r._shown.start) : '', notes: notes });
  });
  schedule.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  var onSchedule = {};
  schedule.forEach(function (s) { if (s.job) onSchedule[s.job] = true; });

  // Scope, grouped by job in sheet order.
  var scope = {};
  rows_(ss, 'Scope').forEach(function (r) {
    var id = jobId(r['job id'] !== undefined ? r['job id'] : r.job);
    if (!id) return;
    var s = { area: txt_(r, 'area'), scope: txt_(r, 'scope'), product: txt_(r, 'product'), color: txt_(r, 'color'), sheen: txt_(r, 'sheen'),
              coats: txt_(r, 'coats'), sqft: txt_(r, 'coverage'), gallons: txt_(r, 'qty') };
    if (!s.area && !s.scope && !s.product) return;
    (scope[id] = scope[id] || []).push(s);
  });

  // Jobs: everything not finished, plus any finished job still on the schedule.
  var jobs = [];
  rows_(ss, 'Jobs').forEach(function (r) {
    var id = txt_(r, 'job id').toUpperCase(), name = txt_(r, 'job name');
    if (!id || !name) return;
    var status = txt_(r, 'status');
    if (DONE.test(status) && !onSchedule[id]) return;
    if (/progress/i.test(status)) status = 'In Progress';
    var rate = Number(r['prevailing wage ($/hr)']);
    var site = {};
    [['contact', 'site contact'], ['phone', 'phone'], ['email', 'email'], ['access', 'site access']].forEach(function (p) {
      var v = txt_(r, p[1]); if (v) site[p[0]] = v;
    });
    jobs.push({ id: id, name: name, gc: txt_(r, 'gc'), address: txt_(r, 'address'), type: txt_(r, 'type'), status: status || 'Not Started',
                start: day(r['start date']), pw: rate > 0 ? { rate: Math.round(rate * 100) / 100 } : null,
                crewNotes: txt_(r, 'crew notes'), site: site, scope: scope[id] || [] });
  });

  var updated = PropertiesService.getScriptProperties().getProperty('updated');
  return { codes: codes, crew: crew, jobs: jobs, schedule: schedule, updated: updated || null };
}

/* Rows as objects keyed by lowercase header. r._shown holds what the cell displays (used for times). */
function rows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var range = sh.getDataRange(), v = range.getValues(), shown = range.getDisplayValues();
  var head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return v.slice(1).map(function (row, i) {
    var o = { _shown: {} };
    head.forEach(function (h, j) { if (h) { o[h] = row[j]; o._shown[h] = shown[i + 1][j]; } });
    return o;
  });
}

function txt_(r, key) {
  var v = r[key];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return r._shown[key] || '';
  return String(v).trim();
}

function isTrue_(v) { return v === true || /^(true|yes|y|x|1)$/i.test(String(v).trim()); }

/* "7", "7:30", "7:30 AM", "0730" or a time cell -> "07:30" */
function time_(s) {
  var m = String(s || '').trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p)?\.?m?\.?$/i);
  if (!m) return '';
  var h = Number(m[1]), min = m[2] ? Number(m[2]) : 0, ap = (m[3] || '').toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (h > 23 || min > 59) return '';
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}
