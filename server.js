'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { NAMES, renderPublic, renderAdmin } = require('./lib/render');

const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let SESSION_SECRET = process.env.SESSION_SECRET;

const SITE = {
  phone: process.env.SITE_PHONE || '010-0000-0000',
  hours: process.env.SITE_HOURS || '매일 09:00–22:00',
};

if (PROD && (!ADMIN_PASSWORD || !SESSION_SECRET)) {
  console.error('ADMIN_PASSWORD and SESSION_SECRET must be set in production.');
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = 'admin1234';
  console.warn('[dev] ADMIN_PASSWORD not set - using the local default (admin / admin1234).');
}
if (!SESSION_SECRET) SESSION_SECRET = crypto.randomBytes(32).toString('hex');
if (PROD && !process.env.SITE_PHONE) console.warn('[warn] SITE_PHONE is not set - the site shows the placeholder number.');

/* ---------- database ---------- */

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'app.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '신규',
    source TEXT NOT NULL DEFAULT 'web',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('service_areas', ?)").run(JSON.stringify(['강남구']));

const STATUSES = ['신규', '연락함', '완료'];
const nameSet = new Set(NAMES);

const q = {
  insert: db.prepare('INSERT INTO inquiries (region, contact, message, source, created_at) VALUES (?, ?, ?, ?, ?)'),
  list: db.prepare('SELECT id, region, contact, message, note, status, source, created_at AS createdAt FROM inquiries ORDER BY created_at DESC, id DESC LIMIT 500'),
  setStatus: db.prepare('UPDATE inquiries SET status = ? WHERE id = ?'),
  setNote: db.prepare('UPDATE inquiries SET note = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM inquiries WHERE id = ?'),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  putSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
};

function getAreas() {
  try {
    const raw = JSON.parse(q.getSetting.get('service_areas').value);
    return NAMES.filter((n) => raw.includes(n));
  } catch (e) {
    return [];
  }
}

function setAreas(list) {
  const clean = NAMES.filter((n) => list.includes(n));
  q.putSetting.run('service_areas', JSON.stringify(clean));
  return clean;
}

/* ---------- helpers ---------- */

const adminHtml = renderAdmin();

function makeLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) {
      const fresh = arr.filter((t) => now - t < windowMs);
      if (fresh.length) hits.set(k, fresh); else hits.delete(k);
    }
  }, 10 * 60 * 1000).unref();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now);
    hits.set(key, arr);
    return true;
  };
}

const loginLimit = makeLimiter(10, 10 * 60 * 1000);
const inquiryLimit = makeLimiter(5, 10 * 60 * 1000);
const inquiryGlobalLimit = makeLimiter(200, 60 * 60 * 1000);

function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real);
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const parts = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket.remoteAddress || 'unknown';
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, SECURITY_HEADERS, headers));
  res.end(body);
}

function sendJson(res, status, obj, headers) {
  send(res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(httpError(413, '내용이 너무 길어요.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw httpError(415, 'JSON 요청만 받을 수 있어요.');
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { /* invalid origin */ }
    if (host !== req.headers.host) throw httpError(403, '허용되지 않은 요청이에요.');
  }
  const raw = await readBody(req, 32 * 1024);
  try { return JSON.parse(raw || '{}'); } catch (e) { throw httpError(400, '요청 형식이 올바르지 않아요.'); }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/* ---------- sessions ---------- */

const COOKIE = 'yj_sid';
const SESSION_MS = 12 * 60 * 60 * 1000;

const sign = (s) => crypto.createHmac('sha256', SESSION_SECRET).update(s).digest('base64url');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function makeSession(user) {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + SESSION_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function readSession(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch (e) {
    return null;
  }
}

function cookieHeader(req, value, maxAgeSec) {
  const secure = PROD || String(req.headers['x-forwarded-proto'] || '').includes('https');
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}

/* ---------- routes ---------- */

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  if (method === 'GET' && (p === '/' || p === '/index.html')) {
    return send(res, 200, renderPublic(getAreas(), SITE), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (method === 'GET' && (p === '/admin' || p === '/admin/')) {
    return send(res, 200, adminHtml, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  }
  if (method === 'GET' && p === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (method === 'GET' && p === '/robots.txt') {
    return send(res, 200, 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n', { 'Content-Type': 'text/plain' });
  }

  // public: submit an inquiry
  if (method === 'POST' && p === '/api/inquiries') {
    const ip = clientIp(req);
    if (!inquiryLimit(ip) || !inquiryGlobalLimit('all')) {
      return sendJson(res, 429, { error: '잠시 후 다시 시도해 주세요. 급하시면 전화로 문의해 주세요.' });
    }
    const body = await readJson(req);
    if (str(body.website, 100)) return sendJson(res, 200, { ok: true });
    const region = str(body.region, 120);
    const contact = str(body.contact, 40);
    const message = str(body.message, 2000);
    if (contact.replace(/\D/g, '').length < 8) return sendJson(res, 400, { error: '연락처를 확인해 주세요.' });
    q.insert.run(region, contact, message, 'web', Date.now());
    return sendJson(res, 200, { ok: true });
  }

  // auth
  if (method === 'POST' && p === '/api/login') {
    if (!loginLimit(clientIp(req))) return sendJson(res, 429, { error: 'too many attempts' });
    const body = await readJson(req);
    const okUser = safeEqual(str(body.username, 100), ADMIN_USER);
    const okPass = safeEqual(typeof body.password === 'string' ? body.password : '', ADMIN_PASSWORD);
    if (!(okUser && okPass)) return sendJson(res, 401, { error: 'invalid credentials' });
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, makeSession(ADMIN_USER), SESSION_MS / 1000) });
  }
  if (method === 'POST' && p === '/api/logout') {
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, '', 0) });
  }

  // admin api
  if (p.startsWith('/api/admin/')) {
    if (!readSession(req)) return sendJson(res, 401, { error: 'unauthorized' });

    if (method === 'GET' && p === '/api/admin/me') return sendJson(res, 200, { ok: true });

    if (method === 'GET' && p === '/api/admin/inquiries') return sendJson(res, 200, { items: q.list.all() });

    if (method === 'POST' && p === '/api/admin/inquiries') {
      const body = await readJson(req);
      const region = str(body.region, 120);
      const contact = str(body.contact, 40);
      const message = str(body.message, 2000);
      if (!region && !contact && !message) return sendJson(res, 400, { error: '내용을 입력해 주세요.' });
      q.insert.run(region, contact, message, 'manual', Date.now());
      return sendJson(res, 200, { ok: true });
    }

    const m = p.match(/^\/api\/admin\/inquiries\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      if (method === 'PATCH') {
        const body = await readJson(req);
        if (body.status !== undefined) {
          if (!STATUSES.includes(body.status)) return sendJson(res, 400, { error: '상태 값이 올바르지 않아요.' });
          q.setStatus.run(body.status, id);
        }
        if (body.note !== undefined) q.setNote.run(str(body.note, 2000), id);
        return sendJson(res, 200, { ok: true });
      }
      if (method === 'DELETE') {
        q.remove.run(id);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (method === 'GET' && p === '/api/admin/areas') return sendJson(res, 200, { active: getAreas() });
    if (method === 'PUT' && p === '/api/admin/areas') {
      const body = await readJson(req);
      if (!Array.isArray(body.active)) return sendJson(res, 400, { error: '지역 목록이 필요해요.' });
      const list = body.active.filter((n) => typeof n === 'string' && nameSet.has(n));
      return sendJson(res, 200, { active: setAreas(list) });
    }
  }

  return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? '서버에 문제가 생겼어요.' : err.message });
    else res.end();
  });
});

server.listen(PORT, () => console.log(`열쇠지킴이 24시 listening on :${PORT}`));
