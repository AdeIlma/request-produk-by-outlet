/**
 * =========================================================
 * OUTLET 23 — REQUEST PRODUK OUTLET → TIM FORECASTING (API)
 * ---------------------------------------------------------
 * Spreadsheet & Apps Script TERPISAH dari Customer Feedback.
 * Pasang di: Spreadsheet baru → Extensions → Apps Script
 * Deploy  : Deploy → New deployment → Web app
 *           (Execute as: Me | Who has access: Anyone)
 *
 * POST (JSON sebagai text/plain):
 *   1) Kirim request : { outlet, region, pic, productRequest, productCategory, requestNote }
 *   2) Login         : { action: "login", username, password } → { token, user }
 *   3) Data          : { action: "list", token }
 *   4) Logout        : { action: "logout", token }
 *
 * SHEET:
 *   - OUTLET_REQUEST : data request dari outlet (kolom Status bisa diubah tim forecasting)
 *   - TEAM_USERS     : akun dashboard tim forecasting (password disimpan sebagai hash)
 *
 * KEAMANAN (sama dengan Customer Feedback v4):
 *   - Tidak ada password di kode maupun config.js.
 *   - Super Admin: hash di Script Properties (menu "OUTLET 23 Forecasting → Set Password Super Admin").
 *   - TEAM_USERS: password otomatis di-hash saat diketik (onEdit) / lewat menu.
 *   - Sesi token 6 jam (CacheService), 5x gagal login → dikunci 10 menit.
 * =========================================================
 */

const SHEET_NAME = 'OUTLET_REQUEST';
const USERS_SHEET_NAME = 'TEAM_USERS';
const TIMEZONE = 'Asia/Jakarta';

const HEADERS = [
  'Timestamp', 'Region', 'Outlet', 'PIC',
  'Product Request', 'Product Category', 'Request Note', 'Status'
];
const USERS_HEADERS = ['Username', 'Password', 'Name', 'Active'];
const STATUS_OPTIONS = ['Baru', 'Ditinjau', 'Disetujui', 'Ditolak', 'Sudah tersedia'];
const DEFAULT_STATUS = 'Baru';
const CATEGORIES = ['Beer', 'Vodka', 'Whisky', 'Tequila', 'Gin', 'Wine', 'Cocktail / Mix', 'Non Alcohol', 'Lainnya'];

const PROP_SUPER_USERNAME = 'SUPER_ADMIN_USERNAME';
const PROP_SUPER_HASH = 'SUPER_ADMIN_PASSWORD_HASH';
const PROP_LEGACY_PLAIN = 'ADMIN_PASSWORD';

const HASH_ITERATIONS = 1500;
const MIN_PASSWORD_LENGTH = 8;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_SECONDS = 10 * 60;
const SESSION_SECONDS = 6 * 60 * 60;

/* ---------- Entry points ---------- */

function doGet() {
  return jsonOut({ success: true, message: 'Outlet Request API aktif', time: Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss') });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut({ success: false, message: 'Format data tidak valid (JSON rusak).' });
  }
  try {
    if (body && body.action === 'login') return handleLogin(body);
    if (body && body.action === 'logout') return handleLogout(body);
    if (body && body.action === 'list') return handleList(body);
    return handleSubmit(body || {});
  } catch (err) {
    return jsonOut({ success: false, message: 'Terjadi kesalahan server: ' + err.message });
  }
}

/* ---------- Kirim request ---------- */

function handleSubmit(d) {
  // Honeypot: bot mengisi field tersembunyi → pura-pura sukses, tidak disimpan
  if (cleanText(d.website, 200)) return jsonOut({ success: true, message: 'Request berhasil dikirim' });

  const region = cleanText(d.region, 60);
  const outlet = cleanText(d.outlet, 120);
  const pic = cleanText(d.pic, 60);
  const product = cleanText(d.productRequest, 120);
  const category = cleanText(d.productCategory, 60);
  const note = cleanText(d.requestNote, 1000);

  const errors = [];
  if (!outlet) errors.push('Outlet wajib diisi');
  if (!region) errors.push('Region wajib diisi');
  if (pic.length < 2) errors.push('Nama PIC wajib diisi');
  if (product.length < 2) errors.push('Nama produk wajib diisi');
  if (CATEGORIES.indexOf(category) === -1) errors.push('Kategori tidak valid');
  if (errors.length) return jsonOut({ success: false, message: errors.join('; ') });

  const record = {
    'Timestamp': new Date(),
    'Region': region,
    'Outlet': outlet,
    'PIC': pic,
    'Product Request': product,
    'Product Category': category,
    'Request Note': note,
    'Status': DEFAULT_STATUS
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet();
    const headers = readHeaders(sheet);
    sheet.appendRow(headers.map(function (h) {
      if (!(h in record)) return '';
      const v = record[h];
      return typeof v === 'string' ? safeCell(v) : v;
    }));
  } finally {
    lock.releaseLock();
  }
  return jsonOut({ success: true, message: 'Request berhasil dikirim' });
}

/* ---------- Data dashboard ---------- */

function handleList(d) {
  const user = getSessionUser(d);
  if (!user) return jsonOut({ success: false, code: 'UNAUTHORIZED', message: 'Sesi berakhir. Silakan login ulang.' });

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const data = [];
  if (lastRow >= 2) {
    const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0].map(function (h) { return String(h).trim(); });
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (row.join('') === '') continue;
      const obj = { _row: r + 1 };
      headers.forEach(function (h, c) {
        if (!h) return;
        const v = row[c];
        obj[h] = v instanceof Date ? formatTs(v) : v;
      });
      data.push(obj);
    }
  }
  return jsonOut({ success: true, count: data.length, statuses: STATUS_OPTIONS, user: publicUser(user), data: data });
}

/* ---------- Login & sesi ---------- */

function handleLogin(d) {
  const username = cleanText(d.username, 80).toLowerCase();
  const password = String(d.password || '');
  if (!username || !password) return jsonOut({ success: false, code: 'UNAUTHORIZED', message: 'Username dan password wajib diisi.' });

  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + username;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= MAX_LOGIN_ATTEMPTS) {
    return jsonOut({ success: false, code: 'LOCKED', message: 'Terlalu banyak percobaan login. Coba lagi dalam ' + Math.round(LOCK_SECONDS / 60) + ' menit.' });
  }

  const result = authenticate(username, password);
  if (!result.user) {
    cache.put(failKey, String(fails + 1), LOCK_SECONDS);
    Utilities.sleep(600);
    return jsonOut({ success: false, code: result.code || 'UNAUTHORIZED', message: result.message || 'Username atau password salah.' });
  }
  cache.remove(failKey);
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  cache.put('sess_' + token, JSON.stringify(result.user), SESSION_SECONDS);
  return jsonOut({ success: true, token: token, expiresIn: SESSION_SECONDS, user: publicUser(result.user) });
}

function handleLogout(d) {
  if (d.token) CacheService.getScriptCache().remove('sess_' + String(d.token));
  return jsonOut({ success: true });
}

function getSessionUser(d) {
  if (!d || !d.token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('sess_' + String(d.token));
  if (!raw) return null;
  let user;
  try { user = JSON.parse(raw); } catch (e) { return null; }
  if (user.source === 'sheet') {
    const fresh = loadSheetUser(user.username);
    if (!fresh || !fresh.active) { cache.remove('sess_' + String(d.token)); return null; }
    user.name = fresh.name;
  }
  return user;
}

function authenticate(username, password) {
  const props = PropertiesService.getScriptProperties();
  const superName = String(props.getProperty(PROP_SUPER_USERNAME) || 'admin').trim().toLowerCase();
  if (username === superName) {
    const hash = getSuperAdminHash();
    if (!hash) return { user: null, code: 'NOT_CONFIGURED', message: 'Password Super Admin belum diatur. Jalankan menu OUTLET 23 Forecasting → Set Password Super Admin.' };
    return verifyPassword(password, hash) ? { user: { username: superName, name: 'Super Admin', source: 'property' } } : { user: null };
  }
  const u = loadSheetUser(username);
  if (!u || !u.active || !isHashed(u.passwordHash) || !verifyPassword(password, u.passwordHash)) return { user: null };
  return { user: { username: u.username, name: u.name, source: 'sheet' } };
}

function loadSheetUser(username) {
  const sheet = getUsersSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const headers = readHeaders(sheet);
  const col = function (h) { return headers.indexOf(h); };
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const target = String(username || '').trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const u = String(r[col('Username')] || '').trim();
    if (!u || u.toLowerCase() !== target) continue;
    const activeRaw = String(r[col('Active')]).trim().toUpperCase();
    return {
      username: u.toLowerCase(),
      name: String(r[col('Name')] || u).trim(),
      passwordHash: String(r[col('Password')] || '').trim(),
      active: !(activeRaw === 'FALSE' || activeRaw === 'NO' || activeRaw === 'TIDAK' || activeRaw === '0')
    };
  }
  return null;
}

function publicUser(user) {
  return { username: user.username, name: user.name, role: 'forecast', pages: ['dashboard'], scope: ['ALL'] };
}

/* ---------- Sheet ---------- */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME, 0);
    writeHeaders(sheet, HEADERS);
    applyStatusValidation(sheet);
    return sheet;
  }
  const headers = readHeaders(sheet);
  const missing = HEADERS.filter(function (h) { return headers.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    styleHeader(sheet, headers.length + missing.length);
  }
  return sheet;
}

/* Dropdown Status di sheet agar tim forecasting bisa update langsung */
function applyStatusValidation(sheet) {
  const col = readHeaders(sheet).indexOf('Status') + 1;
  if (col < 1) return;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    writeHeaders(sheet, USERS_HEADERS);
    sheet.getRange('A:B').setNumberFormat('@');
    sheet.appendRow(['forecast1', '', 'Tim Forecasting', 'FALSE']);
    sheet.getRange(1, 2).setNote('Ketik password baru di sini. Otomatis diubah menjadi hash (sha256$…). Minimal ' + MIN_PASSWORD_LENGTH + ' karakter.');
  }
  return sheet;
}

/* ---------- Menu & auto-hash ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OUTLET 23 Forecasting')
    .addItem('Set Password Super Admin', 'setSuperAdminPassword')
    .addItem('Hash Password TEAM_USERS', 'hashAdminUserPasswords')
    .addSeparator()
    .addItem('Setup / Cek Sheet', 'setup')
    .addToUi();
}

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== USERS_SHEET_NAME) return;
  const pwCol = readHeaders(sheet).indexOf('Password') + 1;
  const r = e.range;
  if (pwCol < 1 || pwCol < r.getColumn() || pwCol > r.getLastColumn()) return;
  const top = Math.max(2, r.getRow());
  const bottom = r.getLastRow();
  if (bottom < top) return;
  hashPasswordRange(sheet.getRange(top, pwCol, bottom - top + 1, 1));
}

function hashAdminUserPasswords() {
  const sheet = getUsersSheet();
  const pwCol = readHeaders(sheet).indexOf('Password') + 1;
  const lastRow = sheet.getLastRow();
  if (pwCol < 1 || lastRow < 2) return;
  const n = hashPasswordRange(sheet.getRange(2, pwCol, lastRow - 1, 1));
  notify(n + ' password di ' + USERS_SHEET_NAME + ' berhasil di-hash.');
}

function setup() {
  const sheet = getSheet();
  applyStatusValidation(sheet);
  sheet.setColumnWidth(1, 160);
  getUsersSheet();
  notify(getSuperAdminHash() ? 'Setup selesai.' : 'Setup selesai. Password Super Admin BELUM diatur: menu OUTLET 23 Forecasting → Set Password Super Admin.');
}

/* ---------- Hashing, util (sama dengan Customer Feedback) ---------- */

function isHashed(value) {
  return /^sha256\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(value || ''));
}

function hashPassword(password, salt, iterations) {
  const iter = iterations || HASH_ITERATIONS;
  const s = salt || (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const saltBytes = Utilities.newBlob(s).getBytes();
  let digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s + ':' + String(password), Utilities.Charset.UTF_8);
  for (let i = 1; i < iter; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest.concat(saltBytes));
  }
  return 'sha256$' + iter + '$' + s + '$' + toHex(digest);
}

function verifyPassword(password, stored) {
  if (!isHashed(stored)) return false;
  const parts = String(stored).split('$');
  const candidate = hashPassword(password, parts[2], Number(parts[1]));
  return safeEqual(candidate, stored);
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function toHex(bytes) {
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function getSuperAdminHash() {
  const props = PropertiesService.getScriptProperties();
  let hash = props.getProperty(PROP_SUPER_HASH);
  if (!hash) {
    const plain = props.getProperty(PROP_LEGACY_PLAIN);
    if (plain) {
      hash = hashPassword(plain);
      props.setProperty(PROP_SUPER_HASH, hash);
      props.deleteProperty(PROP_LEGACY_PLAIN);
    }
  }
  return isHashed(hash) ? hash : null;
}

function hashPasswordRange(range) {
  const values = range.getValues();
  let changed = 0;
  const notes = range.getNotes();
  values.forEach(function (row, i) {
    const v = String(row[0] || '').trim();
    if (!v || isHashed(v)) { notes[i][0] = ''; return; }
    if (v.length < MIN_PASSWORD_LENGTH) {
      row[0] = '';
      notes[i][0] = 'Password ditolak: minimal ' + MIN_PASSWORD_LENGTH + ' karakter. Ketik ulang password baru.';
      return;
    }
    row[0] = hashPassword(v);
    notes[i][0] = '';
    changed++;
  });
  range.setNumberFormat('@').setValues(values).setNotes(notes);
  return changed;
}

function setSuperAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const currentUser = props.getProperty(PROP_SUPER_USERNAME) || 'admin';
  const u = ui.prompt('Username Super Admin', 'Kosongkan untuk tetap memakai "' + currentUser + '".', ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const p1 = ui.prompt('Password baru Super Admin', 'Minimal ' + MIN_PASSWORD_LENGTH + ' karakter.', ui.ButtonSet.OK_CANCEL);
  if (p1.getSelectedButton() !== ui.Button.OK) return;
  const p2 = ui.prompt('Ulangi password', 'Ketik ulang password yang sama.', ui.ButtonSet.OK_CANCEL);
  if (p2.getSelectedButton() !== ui.Button.OK) return;
  const pw = p1.getResponseText();
  if (pw.length < MIN_PASSWORD_LENGTH) { ui.alert('Password minimal ' + MIN_PASSWORD_LENGTH + ' karakter.'); return; }
  if (pw !== p2.getResponseText()) { ui.alert('Password tidak sama. Coba lagi.'); return; }
  const name = u.getResponseText().trim().toLowerCase();
  if (name) props.setProperty(PROP_SUPER_USERNAME, name);
  props.setProperty(PROP_SUPER_HASH, hashPassword(pw));
  props.deleteProperty(PROP_LEGACY_PLAIN);
  ui.alert('Password Super Admin tersimpan (hash) untuk username "' + (name || currentUser) + '".');
}

function notify(msg) {
  Logger.log(msg);
  try { SpreadsheetApp.getActive().toast(msg, 'OUTLET 23 Admin', 6); } catch (e) { /* dijalankan dari editor */ }
}

function readHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  let n = headers.length;
  while (n > 0 && !headers[n - 1]) n--;
  return headers.slice(0, n);
}

function writeHeaders(sheet, headers) {
  headers = headers || HEADERS;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
}

function styleHeader(sheet, cols) {
  sheet.getRange(1, 1, 1, cols)
    .setFontWeight('bold')
    .setBackground('#C80000')
    .setFontColor('#FFFFFF');
}

function cleanText(v, max) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function safeCell(s) {
  return /^[=+\-@]/.test(s) && s.length > 1 ? "'" + s : s;
}

function formatTs(v) {
  return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
