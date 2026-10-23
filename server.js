'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { NAMES, renderPublic, renderAdmin, renderArea, renderSitemap, renderReviews, renderReview, renderProducts, renderProduct } = require('./lib/render');
const AREAS = require('./lib/areas');
const { translateKoToEn, primaryProvider } = require('./lib/translate');

const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let SESSION_SECRET = process.env.SESSION_SECRET;

const SITE = {
  phone: process.env.SITE_PHONE || '010-4555-6239',
  hours: process.env.SITE_HOURS || '연중무휴 24시간 상담',
  bizName: process.env.SITE_BIZ_NAME || '열쇠 지킴이, 열쇠지킴이24시',
  owner: process.env.SITE_OWNER || '이문술',
  hoursEn: process.env.SITE_HOURS_EN || 'Open every day · 24-hour consultation',
  bizNameEn: process.env.SITE_BIZ_NAME_EN || 'Yeolsoe Jikimi 24 (열쇠지킴이24시)',
  ownerEn: process.env.SITE_OWNER_EN || '',
  links: {
    naver: process.env.SITE_LINK_NAVER || 'https://naver.me/GHLekCgj',
    daangn: process.env.SITE_LINK_DAANGN || 'https://www.daangn.com/kr/local-profile/hywk2pekt1xg/?referrer=share',
    google: process.env.SITE_LINK_GOOGLE || 'https://share.google/AgOHGXSDJYKfUwdaI',
  },
  siteUrl: (process.env.SITE_URL || 'https://www.xn--2i4b2n54hnwa.com').replace(/\/+$/, ''),
  naverVerify: process.env.NAVER_SITE_VERIFICATION || 'fd368e75fcd75202ba1a187734be9ca69ba9f300',
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
  CREATE TABLE IF NOT EXISTS area_content (
    name TEXT PRIMARY KEY,
    intro TEXT NOT NULL DEFAULT '',
    headline TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    intro_en TEXT NOT NULL DEFAULT '',
    headline_en TEXT NOT NULL DEFAULT '',
    body_en TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    title_en TEXT NOT NULL DEFAULT '',
    body_en TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    service TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 1,
    posted_at TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_posted ON reviews(posted_at DESC, id DESC);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    price TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    name_en TEXT NOT NULL DEFAULT '',
    price_en TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    photos TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const contentCols = new Set(db.prepare('PRAGMA table_info(area_content)').all().map((c) => c.name));
for (const col of ['intro_en', 'headline_en', 'body_en', 'description_en']) {
  if (!contentCols.has(col)) db.exec(`ALTER TABLE area_content ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
}
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
  reviewsAll: db.prepare('SELECT * FROM reviews ORDER BY posted_at DESC, id DESC'),
  reviewsPublished: db.prepare('SELECT * FROM reviews WHERE published = 1 ORDER BY posted_at DESC, id DESC LIMIT 100'),
  reviewById: db.prepare('SELECT * FROM reviews WHERE id = ?'),
  reviewInsert: db.prepare(`INSERT INTO reviews (title, body, title_en, body_en, region, service, photos, published, posted_at, created_at, updated_at)
    VALUES (@title, @body, @title_en, @body_en, @region, @service, @photos, @published, @posted_at, @created_at, @updated_at)`),
  reviewUpdate: db.prepare(`UPDATE reviews SET title = @title, body = @body, title_en = @title_en, body_en = @body_en, region = @region,
    service = @service, photos = @photos, published = @published, posted_at = @posted_at, updated_at = @updated_at WHERE id = @id`),
  reviewDelete: db.prepare('DELETE FROM reviews WHERE id = ?'),
  productsAll: db.prepare('SELECT * FROM products ORDER BY id DESC'),
  productsPublished: db.prepare('SELECT * FROM products WHERE published = 1 ORDER BY id DESC LIMIT 200'),
  productById: db.prepare('SELECT * FROM products WHERE id = ?'),
  productInsert: db.prepare(`INSERT INTO products (name, category, price, description, name_en, price_en, description_en, photos, published, created_at, updated_at)
    VALUES (@name, @category, @price, @description, @name_en, @price_en, @description_en, @photos, @published, @created_at, @updated_at)`),
  productUpdate: db.prepare(`UPDATE products SET name = @name, category = @category, price = @price, description = @description, name_en = @name_en,
    price_en = @price_en, description_en = @description_en, photos = @photos, published = @published, updated_at = @updated_at WHERE id = @id`),
  productDelete: db.prepare('DELETE FROM products WHERE id = ?'),
  contentAll: db.prepare('SELECT * FROM area_content'),
  contentUpsert: db.prepare(`INSERT INTO area_content (name, intro, headline, body, description, intro_en, headline_en, body_en, description_en, updated_at)
    VALUES (@name, @intro, @headline, @body, @description, @intro_en, @headline_en, @body_en, @description_en, @updated_at)
    ON CONFLICT(name) DO UPDATE SET intro = @intro, headline = @headline, body = @body, description = @description,
      intro_en = @intro_en, headline_en = @headline_en, body_en = @body_en, description_en = @description_en, updated_at = @updated_at`),
  contentDelete: db.prepare('DELETE FROM area_content WHERE name = ?'),
  putSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
};

/** Published products and reviews for the home page (one row of the newest items; counts are totals). */
function homeExtra() {
  const reviews = q.reviewsPublished.all().map(rowToReview);
  const products = q.productsPublished.all().map(rowToProduct);
  return { reviewCount: reviews.length, productCount: products.length, reviews: reviews.slice(0, 3), products: products.slice(0, 5) };
}

function getAreas() {
  try {
    const raw = JSON.parse(q.getSetting.get('service_areas').value);
    return NAMES.filter((n) => raw.includes(n));
  } catch (e) {
    return [];
  }
}

const SERVICE_KEYS = ['install', 'key', 'repair', 'unlock', 'other'];
const PHOTO_RE = /^[a-f0-9]{24}\.jpg$/;

function rowToReview(row) {
  let photos = [];
  try { photos = JSON.parse(row.photos).filter((f) => PHOTO_RE.test(f)); } catch (e) { /* keep empty */ }
  return {
    id: row.id, title: row.title, body: row.body, titleEn: row.title_en, bodyEn: row.body_en,
    region: row.region, service: row.service, photos, published: !!row.published, postedAt: row.posted_at,
  };
}

const PRODUCT_CATEGORIES = ['lock', 'key', 'other'];

function rowToProduct(row) {
  let photos = [];
  try { photos = JSON.parse(row.photos).filter((f) => PHOTO_RE.test(f)); } catch (e) { /* keep empty */ }
  return {
    id: row.id, name: row.name, category: row.category, price: row.price, description: row.description,
    nameEn: row.name_en, priceEn: row.price_en, descriptionEn: row.description_en,
    photos, published: !!row.published,
  };
}

function productInput(body, prevPhotos) {
  const name = str(body.name, 120);
  if (!name) return { error: '제품 이름을 입력해 주세요.' };
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((f, i, a) => typeof f === 'string' && PHOTO_RE.test(f) && a.indexOf(f) === i && fs.existsSync(path.join(UPLOAD_DIR, f))).slice(0, 8)
    : prevPhotos || [];
  return {
    name, category: PRODUCT_CATEGORIES.includes(body.category) ? body.category : '',
    price: str(body.price, 60), description: str(body.description, 8000), photos, published: body.published === false ? 0 : 1,
  };
}

async function translateProduct(prev, next) {
  const out = { name_en: '', price_en: '', description_en: '' };
  let failed = false;
  for (const [src, dst] of [['name', 'name_en'], ['price', 'price_en'], ['description', 'description_en']]) {
    if (!next[src]) continue;
    if (prev && prev[src] === next[src] && prev[dst]) { out[dst] = prev[dst]; continue; }
    if (src === 'price' && /^[\d,.\s]+원?$/.test(next[src])) { out[dst] = 'KRW ' + next[src].replace(/\s*원$/, '').trim(); continue; }
    try { out[dst] = (await translateKoToEn(next[src])).text; } catch (err) { console.warn('[translate] failed:', err.message); failed = true; }
  }
  return { out, failed };
}

function removeUpload(file) {
  if (PHOTO_RE.test(file)) fs.unlink(path.join(UPLOAD_DIR, file), () => {});
}

function reviewInput(body, prevPhotos) {
  const title = str(body.title, 120);
  if (!title) return { error: '제목을 입력해 주세요.' };
  const region = typeof body.region === 'string' && nameSet.has(body.region) ? body.region : '';
  const service = SERVICE_KEYS.includes(body.service) ? body.service : '';
  const photos = Array.isArray(body.photos)
    ? body.photos.filter((f, i, a) => typeof f === 'string' && PHOTO_RE.test(f) && a.indexOf(f) === i && fs.existsSync(path.join(UPLOAD_DIR, f))).slice(0, 12)
    : prevPhotos || [];
  const postedAt = /^\d{4}-\d{2}-\d{2}$/.test(body.postedAt || '') && !isNaN(new Date(body.postedAt + 'T00:00:00Z'))
    ? body.postedAt
    : new Date().toISOString().slice(0, 10);
  return { title, body: str(body.body, 8000), region, service, photos, published: body.published === false ? 0 : 1, posted_at: postedAt };
}

async function translateReview(prev, next) {
  const out = { title_en: '', body_en: '' };
  let failed = false;
  for (const [src, dst] of [['title', 'title_en'], ['body', 'body_en']]) {
    if (!next[src]) continue;
    if (prev && prev[src] === next[src] && prev[dst]) { out[dst] = prev[dst]; continue; }
    try { out[dst] = (await translateKoToEn(next[src])).text; } catch (err) { console.warn('[translate] failed:', err.message); failed = true; }
  }
  return { out, failed };
}

/** Photos uploaded in an editor but never saved into a review or product are removed after a day. */
function cleanOrphanUploads() {
  const used = new Set();
  for (const row of q.reviewsAll.all()) rowToReview(row).photos.forEach((f) => used.add(f));
  for (const row of q.productsAll.all()) rowToProduct(row).photos.forEach((f) => used.add(f));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    if (!PHOTO_RE.test(f) || used.has(f)) continue;
    try { if (fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs < cutoff) fs.unlinkSync(path.join(UPLOAD_DIR, f)); } catch (e) { /* ignore */ }
  }
}

function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(httpError(413, '사진 용량이 너무 커요.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const CONTENT_FIELDS = ['intro', 'headline', 'body', 'description', 'intro_en', 'headline_en', 'body_en', 'description_en'];

function getContentMap() {
  const map = {};
  for (const row of q.contentAll.all()) map[row.name] = row;
  return map;
}

function setAreas(list) {
  const clean = NAMES.filter((n) => list.includes(n));
  q.putSetting.run('service_areas', JSON.stringify(clean));
  return clean;
}

/* ---------- helpers ---------- */

const adminHtml = renderAdmin();
const llmsTxt = fs.readFileSync(path.join(__dirname, 'static', 'llms.txt'), 'utf8');

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
    "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
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

  // uploaded photos
  if (method === 'GET' && p.startsWith('/uploads/')) {
    const file = p.slice(9);
    if (!PHOTO_RE.test(file)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const full = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(full)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    return send(res, 200, fs.readFileSync(full), { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' });
  }

  // reviews (both languages)
  const rm = p.match(/^(\/en)?\/reviews(?:\/(\d+))?\/?$/);
  if (method === 'GET' && rm) {
    const lang = rm[1] ? 'en' : 'ko';
    if (!rm[2]) {
      const list = q.reviewsPublished.all().map(rowToReview);
      return send(res, 200, renderReviews(list, SITE, lang, { products: q.productsPublished.all().length }), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    const row = q.reviewById.get(Number(rm[2]));
    if (row && row.published) {
      return send(res, 200, renderReview(rowToReview(row), SITE, lang), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    return send(res, 404, '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p style="font-family:sans-serif;padding:40px">Not found. <a href="/">Home</a></p>', { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // products (both languages)
  const pm = p.match(/^(\/en)?\/products(?:\/(\d+))?\/?$/);
  if (method === 'GET' && pm) {
    const lang = pm[1] ? 'en' : 'ko';
    if (!pm[2]) {
      const list = q.productsPublished.all().map(rowToProduct);
      return send(res, 200, renderProducts(list, SITE, lang, { reviews: q.reviewsPublished.all().length }), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    const row = q.productById.get(Number(pm[2]));
    if (row && row.published) {
      return send(res, 200, renderProduct(rowToProduct(row), SITE, lang), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    }
    return send(res, 404, '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Not found</title><p style="font-family:sans-serif;padding:40px">Not found. <a href="/">Home</a></p>', { 'Content-Type': 'text/html; charset=utf-8' });
  }

  if (method === 'GET' && (p === '/en' || p === '/en/')) {
    return send(res, 200, renderPublic(getAreas(), SITE, getContentMap(), 'en', homeExtra()), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (method === 'GET' && p.startsWith('/en/area/')) {
    const slugEn = decodeURIComponent(p.slice(9)).replace(/\/+$/, '');
    const htmlEn = renderArea(slugEn, getAreas(), SITE, getContentMap(), 'en');
    if (htmlEn) return send(res, 200, htmlEn, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return send(res, 404, '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found</title><p style="font-family:sans-serif;padding:40px">Page not found. <a href="/en">Back to home</a></p>', { 'Content-Type': 'text/html; charset=utf-8' });
  }
  if (method === 'GET' && (p === '/' || p === '/index.html')) {
    return send(res, 200, renderPublic(getAreas(), SITE, getContentMap(), 'ko', homeExtra()), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (method === 'GET' && (p === '/admin' || p === '/admin/')) {
    return send(res, 200, adminHtml, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  }
  if (method === 'GET' && p === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (method === 'GET' && p === '/robots.txt') {
    // AI search / assistant crawlers get their own groups (a bot that matches a specific group ignores the * group),
    // so the private paths are repeated in each of them.
    const rules = 'Allow: /\nDisallow: /admin\nDisallow: /api/\n';
    const txt =
      `User-agent: OAI-SearchBot\n${rules}\n` +
      `User-agent: ChatGPT-User\n${rules}\n` +
      `User-agent: *\n${rules}\n` +
      `Sitemap: ${SITE.siteUrl}/sitemap.xml\n`;
    return send(res, 200, txt, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  }
  if (method === 'GET' && p === '/llms.txt') {
    return send(res, 200, llmsTxt, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  }
  if (method === 'GET' && p === '/sitemap.xml') {
    return send(res, 200, renderSitemap(getAreas(), SITE, q.reviewsPublished.all().map((r) => r.id), q.productsPublished.all().map((r) => r.id)), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (method === 'GET' && p.startsWith('/area/')) {
    const slug = decodeURIComponent(p.slice(6)).replace(/\/+$/, '');
    const html = renderArea(slug, getAreas(), SITE, getContentMap());
    if (html) return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return send(res, 404, '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>페이지를 찾을 수 없어요</title><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없어요. <a href="/">홈으로 가기</a></p>', { 'Content-Type': 'text/html; charset=utf-8' });
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

    if (method === 'GET' && p === '/api/admin/area-content') {
      const map = getContentMap();
      const activeNow = new Set(getAreas());
      const pick = (row, sfx) => ({
        intro: row['intro' + sfx], headline: row['headline' + sfx], body: row['body' + sfx], description: row['description' + sfx],
      });
      const items = AREAS.DATA.map((g) => {
        const row = map[g.name];
        return {
          name: g.name,
          slug: g.slug,
          dongCount: g.dongs.length,
          active: activeNow.has(g.name),
          custom: row ? pick(row, '') : null,
          english: row ? pick(row, '_en') : null,
          defaults: {
            intro: AREAS.intro(g, 'ko'),
            headline: AREAS.headline(g, 'ko'),
            description: AREAS.defaultDescription(g, SITE, 'ko'),
          },
        };
      });
      return sendJson(res, 200, { items, translator: primaryProvider() });
    }

    const cm = p.match(/^\/api\/admin\/area-content\/([a-z-]+)$/);
    if (cm && method === 'PUT') {
      const g = AREAS.BY_SLUG[cm[1]];
      if (!g) return sendJson(res, 404, { error: '없는 지역이에요.' });
      const body = await readJson(req);
      const prev = getContentMap()[g.name] || {};
      const ko = {
        intro: str(body.intro, 1200),
        headline: str(body.headline, 240),
        body: str(body.body, 6000),
        description: str(body.description, 240),
      };
      const next = { name: g.name, updated_at: Date.now() };
      let provider = null;
      let translated = false;
      let failed = false;
      for (const f of ['intro', 'headline', 'body', 'description']) {
        next[f] = ko[f];
        const prevEn = prev[f + '_en'] || '';
        if (!ko[f]) { next[f + '_en'] = ''; continue; }
        if (ko[f] === (prev[f] || '') && prevEn) { next[f + '_en'] = prevEn; continue; }
        try {
          const r = await translateKoToEn(ko[f]);
          next[f + '_en'] = r.text;
          provider = r.provider;
          translated = true;
        } catch (err) {
          console.warn('[translate] failed:', err.message);
          next[f + '_en'] = '';
          failed = true;
        }
      }
      if (CONTENT_FIELDS.every((f) => !next[f])) {
        q.contentDelete.run(g.name);
        return sendJson(res, 200, { custom: null, english: null, translation: { status: 'none' } });
      }
      q.contentUpsert.run(next);
      return sendJson(res, 200, {
        custom: { intro: next.intro, headline: next.headline, body: next.body, description: next.description },
        english: { intro: next.intro_en, headline: next.headline_en, body: next.body_en, description: next.description_en },
        translation: { status: failed ? 'failed' : translated ? 'ok' : 'unchanged', provider },
      });
    }

    if (method === 'POST' && p === '/api/admin/uploads') {
      const origin = req.headers.origin;
      if (origin) {
        let host = '';
        try { host = new URL(origin).host; } catch (e) { /* invalid */ }
        if (host !== req.headers.host) return sendJson(res, 403, { error: '허용되지 않은 요청이에요.' });
      }
      if (String(req.headers['content-type'] || '').split(';')[0] !== 'image/jpeg') return sendJson(res, 415, { error: 'JPG 사진만 올릴 수 있어요.' });
      const buf = await readBuffer(req, 4 * 1024 * 1024);
      if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return sendJson(res, 400, { error: '사진 파일이 올바르지 않아요.' });
      const file = crypto.randomBytes(12).toString('hex') + '.jpg';
      fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
      return sendJson(res, 200, { file, url: '/uploads/' + file });
    }

    if (method === 'GET' && p === '/api/admin/reviews') {
      return sendJson(res, 200, { items: q.reviewsAll.all().map(rowToReview) });
    }
    if (method === 'POST' && p === '/api/admin/reviews') {
      const input = reviewInput(await readJson(req));
      if (input.error) return sendJson(res, 400, { error: input.error });
      const { out, failed } = await translateReview(null, input);
      const now = Date.now();
      const info = q.reviewInsert.run(Object.assign({}, input, out, { photos: JSON.stringify(input.photos), created_at: now, updated_at: now }));
      return sendJson(res, 200, { item: rowToReview(q.reviewById.get(info.lastInsertRowid)), translation: { failed } });
    }
    const rvm = p.match(/^\/api\/admin\/reviews\/(\d+)$/);
    if (rvm) {
      const id = Number(rvm[1]);
      const prevRow = q.reviewById.get(id);
      if (!prevRow) return sendJson(res, 404, { error: '없는 후기예요.' });
      const prev = rowToReview(prevRow);
      if (method === 'PUT') {
        const input = reviewInput(await readJson(req), prev.photos);
        if (input.error) return sendJson(res, 400, { error: input.error });
        const { out, failed } = await translateReview({ title: prev.title, body: prev.body, title_en: prev.titleEn, body_en: prev.bodyEn }, input);
        q.reviewUpdate.run(Object.assign({ id }, input, out, { photos: JSON.stringify(input.photos), updated_at: Date.now() }));
        prev.photos.filter((f) => !input.photos.includes(f)).forEach(removeUpload);
        return sendJson(res, 200, { item: rowToReview(q.reviewById.get(id)), translation: { failed } });
      }
      if (method === 'DELETE') {
        q.reviewDelete.run(id);
        prev.photos.forEach(removeUpload);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (method === 'GET' && p === '/api/admin/products') {
      return sendJson(res, 200, { items: q.productsAll.all().map(rowToProduct) });
    }
    if (method === 'POST' && p === '/api/admin/products') {
      const input = productInput(await readJson(req));
      if (input.error) return sendJson(res, 400, { error: input.error });
      const { out, failed } = await translateProduct(null, input);
      const now = Date.now();
      const info = q.productInsert.run(Object.assign({}, input, out, { photos: JSON.stringify(input.photos), created_at: now, updated_at: now }));
      return sendJson(res, 200, { item: rowToProduct(q.productById.get(info.lastInsertRowid)), translation: { failed } });
    }
    const pdm = p.match(/^\/api\/admin\/products\/(\d+)$/);
    if (pdm) {
      const id = Number(pdm[1]);
      const prevRow = q.productById.get(id);
      if (!prevRow) return sendJson(res, 404, { error: '없는 제품이에요.' });
      const prev = rowToProduct(prevRow);
      if (method === 'PUT') {
        const input = productInput(await readJson(req), prev.photos);
        if (input.error) return sendJson(res, 400, { error: input.error });
        const { out, failed } = await translateProduct({ name: prev.name, price: prev.price, description: prev.description, name_en: prev.nameEn, price_en: prev.priceEn, description_en: prev.descriptionEn }, input);
        q.productUpdate.run(Object.assign({ id }, input, out, { photos: JSON.stringify(input.photos), updated_at: Date.now() }));
        prev.photos.filter((f) => !input.photos.includes(f)).forEach(removeUpload);
        return sendJson(res, 200, { item: rowToProduct(q.productById.get(id)), translation: { failed } });
      }
      if (method === 'DELETE') {
        q.productDelete.run(id);
        prev.photos.forEach(removeUpload);
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

cleanOrphanUploads();
setInterval(cleanOrphanUploads, 6 * 60 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`열쇠지킴이 24시 listening on :${PORT}`));
