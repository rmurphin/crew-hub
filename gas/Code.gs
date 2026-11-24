/**
 * MPNW Crew Hub feed.
 *
 * This script lives inside the MPNW Crew Hub sheet and only reads that sheet.
 * The app asks for  <web app URL>?u=<link code>  and gets back the schedule and
 * job info for whoever owns that code. A wrong or deleted code gets nothing.
 *
 * Tabs it reads (row 1 = headers, any column order):
 *   Crew      Name | Role | Link code | Personal link | Active | Can edit
 *             People with Can edit ticked can add, change and delete schedule rows from the app.
 *   Jobs      Job ID | Job name | GC | Address | Type | Status | Start date | Prevailing wage ($/hr) |
 *             Crew notes | Site contact | Phone | Email | Site access
 *   Scope     Job ID | Area | Scope | Product | Color | Sheen | Coats | Coverage | Qty
 *   Schedule  Date | Through (optional last day) | Job | Start | one checkbox column per person, headed with their first name | Notes
 *             (a typed "Crew" column of names also still works)
 *             A row with Through covers every Mon-Fri from Date to Through, except days marked off
 *             (a row with no job and a note, like "Thanksgiving, shop closed").
 * Job cells can be "P-03" or the picker's "P-03 · Cape Disappointment ...": only the ID is used.
 * Start here, Lists and Inbox are for people, not the app.
 *
 * Saving from the app: the app POSTs {u, action: add|update|delete, row, expect, item}. Only people
 * with Can edit get through, and an update or delete only happens if that row still holds the date
 * and job the app saw (so a sort or someone else's edit can't send it to the wrong row).
 * The same people can also add or change jobs ({action:'job'}) and scope lines ({action:'scope'}).
 * Job addresses are looked up once (Google Maps) so the app can show the forecast for each site.
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
      out = { me: me, canEdit: !!data.editors[me], updated: data.updated, crew: data.crew, jobs: data.jobs, schedule: data.schedule };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var res;
  try { res = save_(JSON.parse((e && e.postData && e.postData.contents) || '{}')); }
  catch (err) { res = { ok: false, error: 'Could not save. Try again.' }; }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function save_(b) {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone();
  var data = build_(), me = data.codes[String(b.u || '').trim().toLowerCase()];
  if (!me) return { ok: false, error: 'This link no longer works.' };
  if (!data.editors[me]) return { ok: false, error: 'Only people with Can edit on the Crew tab can change the schedule.' };
  if (b.action === 'job' || b.action === 'scope') return saveJob_(b, data, me);
  var act = b.action, it = b.item || {}, isDay = /^\d{4}-\d{2}-\d{2}$/;
  if (['add', 'update', 'delete'].indexOf(act) < 0) return { ok: false, error: 'Unknown change.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Someone else is saving. Try again in a moment.' };
  try {
    var sh = ss.getSheetByName('Schedule');
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var col = function (h) { return head.indexOf(h); };
    var day = function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || '').trim().slice(0, 10); };
    var jobId = function (v) { var m = String(v || '').match(/[A-Za-z]+-\d+/); return m ? m[0].toUpperCase() : ''; };
    var row = Number(b.row);
    if (act !== 'add') {
      if (!(row >= 2 && row <= sh.getLastRow())) return { ok: false, error: 'That row is gone. Pull down to refresh.' };
      var cur = sh.getRange(row, 1, 1, head.length).getValues()[0], ex = b.expect || {};
      if (day(cur[col('date')]) !== ex.date || jobId(cur[col('job')]) !== (ex.job || ''))
        return { ok: false, error: 'The schedule changed while you were editing. Pull down to refresh and try again.' };
    }
    var who = me.split(' ')[0], stamp = Utilities.formatDate(new Date(), tz, 'M/d h:mm a');
    if (act === 'delete') { sh.deleteRow(row); onEdit(); return { ok: true }; }

    // Check what the app sent before anything touches the sheet.
    if (!isDay.test(it.date || '')) return { ok: false, error: 'Pick a date.' };
    var job = null;
    if (it.job) { job = data.jobs.filter(function (j) { return j.id === it.job; })[0]; if (!job) return { ok: false, error: 'That job is not on the Jobs tab.' }; }
    var notes = String(it.notes || '').slice(0, 500).trim();
    if (!job && !notes) return { ok: false, error: 'Add a reason for the day off.' };
    var thru = job && isDay.test(it.thru || '') && it.thru > it.date ? it.thru : '';
    var names = data.crew.map(function (c) { return c.name; });
    var crew = (it.crew || []).filter(function (n) { return names.indexOf(n) >= 0; });
    if (job && !crew.length) return { ok: false, error: 'Tick at least one person.' };
    var start = job ? time_(it.start) : '';

    var vals = (act === 'update' ? sh.getRange(row, 1, 1, head.length).getValues()[0] : head.map(function () { return ''; })).slice();
    var put = function (h, v) { if (col(h) >= 0) vals[col(h)] = v; };
    var dateOf = function (k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); };
    put('date', dateOf(it.date));
    put('through', thru ? dateOf(thru) : '');
    put('job', job ? job.id + ' · ' + job.name : '');
    put('start', start ? label12_(start) : '');
    put('notes', notes);
    data.crew.forEach(function (c) {  // checkbox columns headed with first or full name
      var i = col(c.name.toLowerCase()); if (i < 0) i = col(c.name.split(' ')[0].toLowerCase());
      if (i >= 0) vals[i] = !!job && crew.indexOf(c.name) >= 0;
    });
    if (col('crew') >= 0) vals[col('crew')] = job ? crew.join(', ') : '';
    if (act === 'add') row = firstEmpty_(sh);
    var range = sh.getRange(row, 1, 1, head.length);
    range.setValues([vals]);
    if (col('date') >= 0) sh.getRange(row, col('date') + 1).setNote((act === 'add' ? 'Added' : 'Changed') + ' in the app by ' + who + ', ' + stamp);
    sortSchedule();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* Jobs and Scope tabs, from the app. Columns are found by header, so moving columns around is fine. */
function saveJob_(b, data, me) {
  var ss = SpreadsheetApp.getActive(), tz = ss.getSpreadsheetTimeZone(), it = b.item || {}, op = b.op;
  if (['add', 'update', 'delete'].indexOf(op) < 0) return { ok: false, error: 'Unknown change.' };
  var clip = function (v, n) { return String(v === undefined || v === null ? '' : v).trim().slice(0, n || 500); };
  var num = function (v) { v = clip(v, 30); return v !== '' && !isNaN(Number(v)) ? Number(v) : v; };
  var jobId = function (v) { var m = String(v || '').match(/[A-Za-z]+-\d+/); return m ? m[0].toUpperCase() : ''; };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Someone else is saving. Try again in a moment.' };
  try {
    var sh = ss.getSheetByName(b.action === 'job' ? 'Jobs' : 'Scope');
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var col = function (h) { return head.indexOf(h); };
    var row = Number(b.row), cur = null;
    if (op !== 'add') {
      if (!(row >= 2 && row <= sh.getLastRow())) return { ok: false, error: 'That row is gone. Pull down to refresh.' };
      cur = sh.getRange(row, 1, 1, head.length).getValues()[0];
      var ex = b.expect || {};
      var same = b.action === 'job' ? jobId(cur[col('job id')]) === ex.id
        : jobId(cur[col('job id')]) === ex.job && clip(cur[col('scope')]) === clip(ex.scope) && clip(cur[col('product')]) === clip(ex.product);
      if (!same) return { ok: false, error: 'This changed in the sheet while you were editing. Pull down to refresh and try again.' };
    }
    var stamp = 'by ' + me.split(' ')[0] + ', ' + Utilities.formatDate(new Date(), tz, 'M/d h:mm a');

    if (b.action === 'job') {
      if (op === 'delete') return { ok: false, error: 'Jobs aren\'t deleted from the app. Set the status to Complete instead.' };
      var id = op === 'add' ? clip(it.id, 20).toUpperCase() : jobId(cur[col('job id')]);
      if (op === 'add') {
        if (!/^[A-Z]+-\d+$/.test(id)) return { ok: false, error: 'Type the job number like it is in the tracker, for example P-21.' };
        var taken = sh.getRange(1, col('job id') + 1, sh.getLastRow(), 1).getValues().some(function (r) { return jobId(r[0]) === id; });
        if (taken) return { ok: false, error: id + ' is already on the Jobs tab.' };
      }
      if (!clip(it.name)) return { ok: false, error: 'Give the job a name.' };
      var status = ['Not Started', 'In Progress', 'Complete'].indexOf(it.status) >= 0 ? it.status : 'Not Started';
      var rate = clip(it.rate, 20), start = /^\d{4}-\d{2}-\d{2}$/.test(it.start || '') ? new Date(+it.start.slice(0, 4), +it.start.slice(5, 7) - 1, +it.start.slice(8, 10)) : '';
      if (rate !== '' && !(Number(rate) >= 0)) return { ok: false, error: 'Prevailing wage should be a number, like 55.64.' };
      var vals = op === 'update' ? cur.slice() : head.map(function () { return ''; });
      var put = function (h, v) { if (col(h) >= 0) vals[col(h)] = v; };
      put('job id', id); put('job name', clip(it.name, 200)); put('gc', clip(it.gc, 200)); put('address', clip(it.address, 300)); put('type', clip(it.type, 60));
      put('status', status); put('start date', start); put('prevailing wage ($/hr)', rate === '' ? '' : Math.round(Number(rate) * 100) / 100);
      put('crew notes', clip(it.crewNotes, 1000)); put('site contact', clip(it.contact)); put('phone', clip(it.phone, 200)); put('email', clip(it.email)); put('site access', clip(it.access, 1000));
      if (op === 'add') row = firstEmpty_(sh, ['job id', 'job name']);
      sh.getRange(row, 1, 1, head.length).setValues([vals]);
      sh.getRange(row, col('job id') + 1).setNote((op === 'add' ? 'Added' : 'Changed') + ' in the app ' + stamp);
      onEdit();
      return { ok: true };
    }

    // Scope line
    if (op === 'delete') { sh.deleteRow(row); onEdit(); return { ok: true }; }
    var job = data.jobs.filter(function (j) { return j.id === (op === 'add' ? b.job : jobId(cur[col('job id')])); })[0];
    if (!job) return { ok: false, error: 'That job is not on the Jobs tab.' };
    if (!clip(it.scope) && !clip(it.product)) return { ok: false, error: 'Fill in the scope or the product.' };
    var line = op === 'update' ? cur.slice() : head.map(function () { return ''; });
    var set = function (h, v) { if (col(h) >= 0) line[col(h)] = v; };
    set('job id', job.id + ' · ' + job.name); set('area', clip(it.area, 100)); set('scope', clip(it.scope, 300)); set('product', clip(it.product, 200));
    set('color', clip(it.color, 100)); set('sheen', clip(it.sheen, 60)); set('coats', num(it.coats)); set('coverage', clip(it.sqft, 60)); set('qty', num(it.gallons));
    if (op === 'add') {
      // Goes in right after this job's last line in the same area (or its last line), so the tab stays grouped.
      var all = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), head.length).getValues(), afterArea = 0, afterJob = 0;
      for (var i = 1; i < all.length; i++) if (jobId(all[i][col('job id')]) === job.id) { afterJob = i + 1; if (clip(all[i][col('area')]).toLowerCase() === clip(it.area).toLowerCase()) afterArea = i + 1; }
      var after = afterArea || afterJob;
      if (after) { sh.insertRowAfter(after); row = after + 1; } else row = firstEmpty_(sh, ['job id', 'scope', 'product']);
    }
    sh.getRange(row, 1, 1, head.length).setValues([line]);
    sh.getRange(row, col('job id') + 1).setNote((op === 'add' ? 'Added' : 'Changed') + ' in the app ' + stamp);
    onEdit();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* First Schedule row with no date, job or notes. The checkbox columns run to the bottom of the tab,
   so getLastRow() counts them as filled; this looks past them. */
function firstEmpty_(sh, keys) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var cols = (keys || ['date', 'job', 'notes']).map(function (h) { return head.indexOf(h); }).filter(function (i) { return i >= 0; });
  var v = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), head.length).getValues();
  for (var i = 1; i < v.length; i++) if (cols.every(function (c) { return v[i][c] === '' || v[i][c] === null; })) return i + 1;
  if (v.length >= sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  return v.length + 1;
}

/* "07:30" -> "7:30 AM", matching the Start dropdown */
function label12_(t) {
  var h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM');
}

/* Latitude/longitude for a job address, looked up once and kept in the script's settings. */
function geo_(address, budget) {
  if (!address) return null;
  var props = PropertiesService.getScriptProperties(), key = 'geo|' + address.toLowerCase().slice(0, 200);
  var hit = props.getProperty(key);
  if (hit === null) {
    if (budget.left-- <= 0) return null;
    hit = 'none';
    try {
      var r = Maps.newGeocoder().setRegion('us').geocode(address);
      if (r && r.status === 'OK' && r.results.length) { var l = r.results[0].geometry.location; hit = l.lat.toFixed(3) + ',' + l.lng.toFixed(3); }
      props.setProperty(key, hit);
    } catch (err) { return null; }  // try again next time
  }
  return hit === 'none' ? null : hit.split(',').map(Number);
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
  var di = head.indexOf('date'), ni = head.indexOf('notes'), ti = head.indexOf('through');
  var from = v[cell.getRow() - 1][di];
  if (!(from instanceof Date)) { ui.alert('That row has no date yet.'); return; }
  var key = function (d) { return d instanceof Date ? d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() : ''; };
  var to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (to.getDay() === 0 || to.getDay() === 6) to.setDate(to.getDate() + 1);
  var rows = v.slice(1).filter(function (r) { return key(r[di]) === key(from); }).map(function (r) {
    var c = r.slice(); c[di] = to; if (ni >= 0) c[ni] = ''; if (ti >= 0) c[ti] = ''; return c;
  });
  var already = v.slice(1).some(function (r) { return key(r[di]) === key(to); });
  var label = Utilities.formatDate(to, ss.getSpreadsheetTimeZone(), 'EEE M/d');
  if (already && ui.alert(label + ' already has rows. Add these as well?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  var at = firstEmpty_(sh);
  if (at + rows.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), at + rows.length - 1 - sh.getMaxRows());
  sh.getRange(at, 1, rows.length, rows[0].length).setValues(rows);
  sortSchedule();
  ss.toast('Copied ' + rows.length + (rows.length === 1 ? ' job' : ' jobs') + ' to ' + label + '. Notes were left blank.', 'Crew Hub', 6);
}

function sortSchedule() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Schedule');
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var by = [{ column: head.indexOf('date') + 1, ascending: true }];
  if (head.indexOf('start') >= 0) by.push({ column: head.indexOf('start') + 1, ascending: true });
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).sort(by);
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
  var codes = {}, crew = [], editors = {};
  rows_(ss, 'Crew').forEach(function (r) {
    var name = txt_(r, 'name');
    if (!name || !isTrue_(r.active)) return;
    crew.push({ name: name, role: txt_(r, 'role') });
    if (isTrue_(r['can edit'])) editors[name] = true;
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
  var schedule = [], rows = rows_(ss, 'Schedule'), off = {};
  var jobOf = function (r) { return jobId(r.job !== undefined ? r.job : r['job id']); };
  rows.forEach(function (r) { var d = day(r.date); if (d && !jobOf(r) && txt_(r, 'notes')) off[d] = true; });
  var days = function (a, b) {  // Mon-Fri keys from a to b, at most 6 months
    var out = [], t = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)), end = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    for (var n = 0; t <= end && n < 190; t += 864e5, n++) { var w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) out.push(new Date(t).toISOString().slice(0, 10)); }
    return out;
  };
  rows.forEach(function (r) {
    var d = day(r.date);
    if (!d) return;
    var job = jobOf(r), notes = txt_(r, 'notes'), thru = day(r.through);
    if (!job && !notes) return;
    var people = checked(r);
    who(r.crew).forEach(function (n) { if (people.indexOf(n) < 0) people.push(n); });
    var dates = job && thru > d ? days(d, thru).filter(function (k) { return !off[k]; }) : [d];
    dates.forEach(function (k) {
      if (k < from || k > to) return;
      schedule.push({ date: k, job: job, crew: job ? people : [], start: job ? time_(r._shown.start) : '', notes: notes,
                      row: r._row, from: d, thru: job && thru > d ? thru : '' });
    });
  });
  schedule.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
  var onSchedule = {};
  schedule.forEach(function (s) { if (s.job) onSchedule[s.job] = true; });

  // Scope, grouped by job in sheet order.
  var scope = {};
  rows_(ss, 'Scope').forEach(function (r) {
    var id = jobId(r['job id'] !== undefined ? r['job id'] : r.job);
    if (!id) return;
    var s = { row: r._row, area: txt_(r, 'area'), scope: txt_(r, 'scope'), product: txt_(r, 'product'), color: txt_(r, 'color'), sheen: txt_(r, 'sheen'),
              coats: txt_(r, 'coats'), sqft: txt_(r, 'coverage'), gallons: txt_(r, 'qty') };
    if (!s.area && !s.scope && !s.product) return;
    (scope[id] = scope[id] || []).push(s);
  });

  // Jobs: everything not finished, plus any finished job still on the schedule.
  var jobs = [], budget = { left: 8 };  // at most 8 new address lookups per refresh
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
    jobs.push({ id: id, row: r._row, name: name, gc: txt_(r, 'gc'), address: txt_(r, 'address'), type: txt_(r, 'type'), status: status || 'Not Started',
                start: day(r['start date']), pw: rate > 0 ? { rate: Math.round(rate * 100) / 100 } : null,
                crewNotes: txt_(r, 'crew notes'), site: site, scope: scope[id] || [], geo: geo_(txt_(r, 'address'), budget) });
  });

  var updated = PropertiesService.getScriptProperties().getProperty('updated');
  return { codes: codes, editors: editors, crew: crew, jobs: jobs, schedule: schedule, updated: updated || null };
}

/* Rows as objects keyed by lowercase header. r._shown holds what the cell displays (used for times). */
function rows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var range = sh.getDataRange(), v = range.getValues(), shown = range.getDisplayValues();
  var head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return v.slice(1).map(function (row, i) {
    var o = { _shown: {}, _row: i + 2 };
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
