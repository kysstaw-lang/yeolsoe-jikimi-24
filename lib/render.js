'use strict';

const fs = require('fs');
const path = require('path');

const GU = require('./gu.json');
const AREAS = require('./areas');
const { STR, LANGS, LANG_META, translate, tr, pageUrl } = require('./i18n');

const NAMES = GU.map((g) => g.name).sort();
const BY_NAME = Object.fromEntries(GU.map((g) => [g.name, g]));
const view = (f) => fs.readFileSync(path.join(__dirname, '..', 'views', f), 'utf8');

const publicTpl = view('public.html');
const areaTpl = view('area.html');
const adminTpl = view('admin.html');
const adminScript = view('admin.script.js');
const pageTpl = view('page.html');

function fill(tpl, map) {
  let out = tpl;
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(value);
  return out;
}

/** Contact details of the business in one language. */
function biz(cfg, lang) {
  const hours = (cfg.hoursByLang && cfg.hoursByLang[lang]) || (lang === 'ko' ? cfg.hours : cfg.hoursEn);
  return lang === 'ko'
    ? { hours, bizName: cfg.bizName, owner: cfg.owner }
    : { hours, bizName: cfg.bizNameEn, owner: cfg.ownerEn || cfg.owner };
}

/** Text of one language for an admin-written item; Chinese / Japanese fall back to English, then Korean. */
function trPick(obj, field, lang) {
  if (lang === 'ko') return obj[field];
  const t = obj.tr || {};
  return (t[lang] && t[lang][field]) || (t.en && t.en[field]) || obj[field];
}

const paragraphs = (txt) => String(txt || '').split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${AREAS.esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const FONT_BASE = 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800';
const FONT_URL = {
  ko: FONT_BASE + '&display=swap',
  en: FONT_BASE + '&display=swap',
  zh: FONT_BASE + '&family=Noto+Sans+SC:wght@400;500;700;800&display=swap',
  ja: FONT_BASE + '&family=Noto+Sans+JP:wght@400;500;700;800&display=swap',
};

const FOOTER_CSS = `
  .ft { width: 100%; max-width: 1040px; margin: 40px auto 0; padding-top: 26px; border-top: 1px solid var(--border); text-align: left; }
  .ft-grid { display: grid; grid-template-columns: 1fr 1fr 1.5fr 1.1fr 1.35fr; gap: 26px 32px; }
  @media (max-width: 900px) { .ft-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 480px) { .ft-grid { grid-template-columns: 1fr; gap: 20px; } }
  .ft-col h3 { margin: 0 0 8px; font-size: 0.82rem; font-weight: 800; color: #555555; letter-spacing: -0.005em; }
  .ft-col p { margin: 0; font-size: 0.78rem; line-height: 1.75; color: var(--muted); }
  .ft-col a:hover { color: var(--accent); text-decoration: underline; }
  .ft-col .sep { margin: 0 3px; opacity: 0.6; }
  .ft-copy { margin-top: 28px; font-size: 0.72rem; color: var(--muted-2); }
  .brand-mark { -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }

  html[lang|="zh"] { --font: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Gothic A1", sans-serif; }
  html[lang="ja"] { --font: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Gothic A1", sans-serif; }
  html[lang|="zh"] body, html[lang="ja"] body { word-break: normal; overflow-wrap: break-word; line-break: strict; }
  [id="areas"], #inquiry { scroll-margin-top: 84px; }

  .gnb { position: sticky; top: 0; z-index: 45; background: rgba(255, 255, 255, 0.9); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
  .gnb-in { max-width: 1120px; margin: 0 auto; padding: 0 20px; height: 62px; display: flex; align-items: center; gap: 14px; }
  .gnb-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 1.02rem; letter-spacing: -0.01em; white-space: nowrap; }
  .gnb-brand svg { width: 20px; height: 20px; color: var(--accent); flex-shrink: 0; }
  .gnb-nav { display: flex; align-items: center; gap: 2px; margin-left: 12px; }
  .gnb-nav a { padding: 8px 13px; border-radius: 999px; font-size: 0.9rem; font-weight: 700; color: #454a5e; white-space: nowrap; transition: color 0.15s ease, background 0.15s ease; }
  .gnb-nav a:hover { color: var(--accent); background: #eef0fe; }
  .gnb-nav a[aria-current="page"] { color: var(--accent); background: #e8ebfd; }
  .gnb-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .gnb-lang { position: relative; }
  .gnb-lang summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; height: 40px; padding: 0 16px; border: 1px solid var(--border); border-radius: 999px; background: #fff; font-size: 0.88rem; font-weight: 800; white-space: nowrap; }
  .gnb-lang summary::-webkit-details-marker { display: none; }
  .gnb-lang summary svg { width: 15px; height: 15px; color: var(--muted); }
  .gnb-lang summary::after { content: ""; width: 6px; height: 6px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(45deg) translateY(-2px); margin-left: 2px; }
  .gnb-lang[open] summary { border-color: var(--accent); }
  .gnb-lang ul { position: absolute; right: 0; top: calc(100% + 8px); margin: 0; padding: 6px; list-style: none; min-width: 150px; background: #fff; border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 20px 40px -16px rgba(31, 41, 82, 0.28); }
  .gnb-lang li a { display: block; padding: 9px 12px; border-radius: 9px; font-size: 0.88rem; font-weight: 600; white-space: nowrap; }
  .gnb-lang li a:hover { background: #f4f5fb; }
  .gnb-lang li a[aria-current="true"] { color: var(--accent); font-weight: 800; }
  .gnb-cta { display: inline-flex; align-items: center; box-sizing: border-box; height: 40px; padding: 0 18px; border: 1px solid var(--accent); border-radius: 999px; background: var(--accent); color: #fff; font-size: 0.88rem; font-weight: 800; white-space: nowrap; transition: background 0.15s ease; }
  .gnb-cta:hover { background: var(--accent-hover); }
  .gnb-burger { display: none; width: 40px; height: 40px; border: 1px solid var(--border); border-radius: 50%; background: #fff; cursor: pointer; align-items: center; justify-content: center; padding: 0; color: var(--ink); }
  .gnb-burger svg { width: 18px; height: 18px; }
  .gnb-burger .x { display: none; }
  .gnb.open .gnb-burger .bars { display: none; }
  .gnb.open .gnb-burger .x { display: block; }
  @media (max-width: 900px) {
    .gnb-in { height: 58px; gap: 10px; }
    .gnb-burger { display: inline-flex; }
    .gnb-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; margin: 0; padding: 8px 16px 16px; flex-direction: column; align-items: stretch; gap: 2px; background: #fff; border-bottom: 1px solid var(--border); box-shadow: 0 24px 40px -24px rgba(31, 41, 82, 0.3); }
    .gnb.open .gnb-nav { display: flex; }
    .gnb-nav a { padding: 14px 14px; font-size: 1rem; border-radius: 12px; }
  }
  @media (max-width: 480px) { .gnb-cta { display: none; } .gnb-brand { font-size: 0.96rem; } }
  @media print { .gnb { display: none; } }

  .dock { position: fixed; right: 22px; bottom: 22px; z-index: 40; display: flex; gap: 8px; }
  .dock a { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; padding: 13px 20px; font-size: 0.92rem; font-weight: 800; white-space: nowrap; box-shadow: 0 14px 30px -12px rgba(20, 23, 31, 0.45); transition: transform 0.12s ease; }
  .dock a:active { transform: scale(0.97); }
  .dock svg { width: 17px; height: 17px; flex-shrink: 0; }
  .dock .d-call { background: var(--accent); color: #fff; }
  .dock .d-call:hover { background: var(--accent-hover); }
  .dock .d-ask { background: #fff; color: var(--ink); border: 1.5px solid var(--border); }
  .dock .d-ask:hover { border-color: var(--accent); color: var(--accent); }
  @media (max-width: 800px) {
    body { padding-bottom: 84px; }
    .dock { left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
    .dock a { flex: 1; padding: 15px 12px; font-size: 0.98rem; border-radius: 16px; }
    .dock .d-ask { flex: 0.8; }
  }
  .dock { transition: opacity 0.2s ease, transform 0.2s ease; }
  .dock.dock-hide { opacity: 0; transform: translateY(14px); pointer-events: none; }
  @media print { .dock { display: none; } }
`;

function footerHtml(cfg, lang) {
  const b = biz(cfg, lang);
  const T = STR[lang];
  const ext = (key, label) =>
    cfg.links && cfg.links[key]
      ? `<a href="${AREAS.esc(cfg.links[key])}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : '';
  const channels = [ext('naver', T.linkNaver), ext('daangn', T.linkDaangn), ext('google', T.linkGoogle)]
    .filter(Boolean)
    .join('<span class="sep">·</span>');
  const col = (title, lines) => `<div class="ft-col"><h3>${title}</h3>${lines.map((l) => `<p>${l}</p>`).join('')}</div>`;
  return `<footer class="ft">
    <div class="ft-grid">
      ${col(`<span id="brandMark" class="brand-mark">${T.brand}</span>`, [T.ftBrandLine])}
      ${col(T.ftContact, [`<a href="tel:${cfg.phone.replace(/[^0-9+]/g, '')}">${cfg.phone}</a>`, AREAS.esc(b.hours)])}
      ${col(T.ftServices, [T.ftSvcList])}
      ${col(T.ftRep, [AREAS.esc(b.owner), AREAS.esc(b.bizName)])}
      ${channels ? col(T.ftChannels, [channels]) : ''}
    </div>
    <div class="ft-copy">© ${new Date().getFullYear()} ${T.brand}</div>
  </footer>
  ${cfg.show && cfg.show.dock === false ? '' : dockHtml(cfg, lang)}`;
}

function dockHtml(cfg, lang) {
  const T = STR[lang];
  const tel = cfg.phone.replace(/[^0-9+]/g, '');
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>';
  return `<nav class="dock" aria-label="${T.dockAria}"><a class="d-call" href="tel:${tel}">${icon}${T.dockCall}</a><a class="d-ask" href="${pageUrl(lang, '/')}#inquiry">${T.dockInquire}</a></nav>`;
}

function commonFill(cfg, lang) {
  const b = biz(cfg, lang);
  return {
    '@@PHONE_TEL@@': cfg.phone.replace(/[^0-9+]/g, ''),
    '@@PHONE@@': cfg.phone,
    '@@HOURS@@': AREAS.esc(b.hours),
    '@@BIZ_NAME@@': AREAS.esc(b.bizName),
    '@@OWNER@@': AREAS.esc(b.owner),
    '@@YEAR@@': String(new Date().getFullYear()),
    '@@HOME_URL@@': pageUrl(lang, '/'),
    '@@FOOTER@@': footerHtml(cfg, lang),
    '@@FOOTER_CSS@@': FOOTER_CSS,
    '@@FONT_URL@@': FONT_URL[lang] || FONT_URL.ko,
  };
}

const GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';

/** Top navigation (GNB): brand, page links, language menu and the inquiry button. `current` marks the active link. */
function gnbHtml(cfg, lang, current, path) {
  const T = STR[lang];
  const home = pageUrl(lang, '/');
  const link = (key, href, label) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const langs = LANGS.map((l) => `<li><a href="${pageUrl(l, path || '/')}" hreflang="${LANG_META[l].hreflang}" lang="${LANG_META[l].hreflang}"${l === lang ? ' aria-current="true"' : ''}>${LANG_META[l].label}</a></li>`).join('');
  return `<header class="gnb" id="gnb">
  <div class="gnb-in">
    <a class="gnb-brand" href="${home}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${T.brand}</a>
    <nav class="gnb-nav" id="gnbNav" aria-label="${T.navAria}">
      ${link('areas', home + '#areas', T.navAreas)}
      ${link('products', pageUrl(lang, '/products'), T.navProducts)}
      ${link('reviews', pageUrl(lang, '/reviews'), T.navReviews)}
      ${link('guide', pageUrl(lang, '/guide'), T.navGuide)}
      ${link('faq', pageUrl(lang, '/faq'), T.navFaq)}
    </nav>
    <div class="gnb-right">
      <details class="gnb-lang"><summary aria-label="${T.langAria}">${GLOBE}${LANG_META[lang].label}</summary><ul>${langs}</ul></details>
      <a class="gnb-cta" href="${home}#inquiry">${T.navInquire}</a>
      <button type="button" class="gnb-burger" aria-label="${T.menuOpen}" aria-expanded="false" aria-controls="gnbNav" data-open="${T.menuOpen}" data-close="${T.menuClose}">
        <svg class="bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        <svg class="x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
  </div>
</header>
<script>
  (function () {
    var g = document.getElementById('gnb');
    if (!g) return;
    var b = g.querySelector('.gnb-burger');
    var lang = g.querySelector('.gnb-lang');
    function setOpen(on) {
      g.classList.toggle('open', on);
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      b.setAttribute('aria-label', b.getAttribute(on ? 'data-close' : 'data-open'));
    }
    b.addEventListener('click', function () { setOpen(!g.classList.contains('open')); if (lang) lang.open = false; });
    g.querySelector('.gnb-nav').addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', function (e) {
      if (lang && lang.open && !lang.contains(e.target)) lang.open = false;
      if (g.classList.contains('open') && !g.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); if (lang) lang.open = false; } });
  })();
</script>`;
}

function fmtDate(str, lang) {
  const d = new Date(str + 'T00:00:00Z');
  if (isNaN(d)) return '';
  return d.toLocaleDateString(LANG_META[lang].date, { year: 'numeric', month: lang === 'en' ? 'short' : 'long', day: 'numeric', timeZone: 'UTC' });
}

function reviewText(rv, lang) {
  return { title: trPick(rv, 'title', lang), body: trPick(rv, 'body', lang) };
}

function reviewTags(rv, lang) {
  const tags = [];
  if (rv.service && STR[lang]['svc_' + rv.service]) tags.push(`<span class="rv-tag">${AREAS.esc(STR[lang]['svc_' + rv.service])}</span>`);
  const g = AREAS.BY_NAME[rv.region];
  if (g) tags.push(`<span class="rv-tag gray">${AREAS.esc(AREAS.nm(g, lang))}</span>`);
  return tags.join('');
}

function pageShell(cfg, lang, seo, content, backUrl, langPath, current) {
  const html = translate(pageTpl, lang);
  // the content is inserted first so the shared placeholders inside it get filled too
  return fill(fill(html, { '@@CONTENT@@': content }), Object.assign(commonFill(cfg, lang), {
    '@@TITLE@@': AREAS.esc(seo.title),
    '@@HEAD@@': seo.head,
    '@@GNB@@': gnbHtml(cfg, lang, current, langPath),
    '@@BACK_URL@@': backUrl,
  }));
}

function renderReviews(items, cfg, lang) {
  lang = lang || 'ko';
  const cards = items.map((rv) => {
    const t = reviewText(rv, lang);
    const first = rv.photos[0];
    const thumb = first
      ? `<div class="rv-thumb"><img src="/uploads/${first}" alt="${AREAS.esc(t.title)}" loading="lazy">${rv.photos.length > 1 ? `<span class="pc">${tr(lang, 'photoCount', { N: rv.photos.length })}</span>` : ''}</div>`
      : '<div class="rv-thumb"></div>';
    const excerpt = t.body.replace(/\s+/g, ' ').slice(0, 140);
    return `    <a class="rv-card" href="${pageUrl(lang, '/reviews/' + rv.id)}">${thumb}` +
      `<div class="rv-body"><div class="rv-tags">${reviewTags(rv, lang)}</div><h2>${AREAS.esc(t.title)}</h2>` +
      (excerpt ? `<p class="rv-excerpt">${AREAS.esc(excerpt)}</p>` : '') +
      `<div class="rv-date">${fmtDate(rv.postedAt, lang)}</div></div></a>`;
  });
  const content = `  <section class="head"><h1>${tr(lang, 'reviewsTitle')}</h1><p>${tr(lang, 'reviewsSub')}</p></section>\n` +
    (items.length ? `  <section class="rv-grid">\n${cards.join('\n')}\n  </section>` : `  <p class="rv-empty">${tr(lang, 'reviewsEmpty')}</p>`);
  const title = `${tr(lang, 'reviewsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/reviews', title, tr(lang, 'reviewsDesc'), '') };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/reviews', 'reviews');
}

function renderReview(rv, cfg, lang) {
  lang = lang || 'ko';
  const t = reviewText(rv, lang);
  const text = paragraphs(t.body);
  const gallery = rv.photos.length
    ? `<div class="gallery">${rv.photos.map((f, i) => `<button type="button" data-full="/uploads/${f}" aria-label="${AREAS.esc(t.title)} ${i + 1}"><img src="/uploads/${f}" alt="${AREAS.esc(t.title)} ${i + 1}"${i ? ' loading="lazy"' : ''}></button>`).join('')}</div>`
    : '';
  const content = `  <main class="card">\n    <div class="rv-tags">${reviewTags(rv, lang)}</div>\n    <h1>${AREAS.esc(t.title)}</h1>\n    <div class="meta">${fmtDate(rv.postedAt, lang)}</div>\n    ${gallery}\n    <div class="text">${text}</div>\n` +
    `    <a class="back-list" href="${pageUrl(lang, '/reviews')}">${tr(lang, 'reviewsBack')}</a>\n` +
    `    <section class="cta"><p>@@HOURS@@</p><a class="btn btn-primary" href="tel:@@PHONE_TEL@@">${tr(lang, 'ctaCall')}</a></section>\n  </main>`;
  const desc = t.body.replace(/\s+/g, ' ').slice(0, 150) || tr(lang, 'reviewsDesc');
  const title = `${t.title} | ${tr(lang, 'reviewsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const ld = AREAS.ldScript({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: t.title,
    datePublished: rv.postedAt,
    inLanguage: LANG_META[lang].hreflang,
    image: rv.photos.map((f) => `${cfg.siteUrl}/uploads/${f}`),
    author: { '@type': 'Organization', name: lang === 'ko' ? '열쇠지킴이24시' : 'Yeolsoe Jikimi 24' },
  });
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/reviews/' + rv.id, title, desc, ld) };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/reviews'), '/reviews/' + rv.id, 'reviews');
}

function productText(pd, lang) {
  return { name: trPick(pd, 'name', lang), description: trPick(pd, 'description', lang), price: trPick(pd, 'price', lang) };
}

function productTags(pd, lang) {
  return pd.category && STR[lang]['cat_' + pd.category]
    ? `<span class="rv-tag">${AREAS.esc(STR[lang]['cat_' + pd.category])}</span>`
    : '';
}

function renderProducts(items, cfg, lang) {
  lang = lang || 'ko';
  const cards = items.map((pd) => {
    const t = productText(pd, lang);
    const first = pd.photos[0];
    const thumb = first
      ? `<div class="rv-thumb sq"><img src="/uploads/${first}" alt="${AREAS.esc(t.name)}" loading="lazy">${pd.photos.length > 1 ? `<span class="pc">${tr(lang, 'photoCount', { N: pd.photos.length })}</span>` : ''}</div>`
      : '<div class="rv-thumb sq"></div>';
    const excerpt = t.description.replace(/\s+/g, ' ').slice(0, 100);
    return `    <a class="rv-card" href="${pageUrl(lang, '/products/' + pd.id)}">${thumb}` +
      `<div class="rv-body"><div class="rv-tags">${productTags(pd, lang)}</div><h2>${AREAS.esc(t.name)}</h2>` +
      (excerpt ? `<p class="rv-excerpt">${AREAS.esc(excerpt)}</p>` : '') +
      (t.price ? `<div class="pd-price">${AREAS.esc(t.price)}</div>` : '') +
      `</div></a>`;
  });
  const content = `  <section class="head"><h1>${tr(lang, 'productsTitle')}</h1><p>${tr(lang, 'productsSub')}</p></section>\n` +
    (items.length ? `  <section class="rv-grid">\n${cards.join('\n')}\n  </section>` : `  <p class="rv-empty">${tr(lang, 'productsEmpty')}</p>`);
  const title = `${tr(lang, 'productsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/products', title, tr(lang, 'productsDesc'), '') };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/products', 'products');
}

function renderProduct(pd, cfg, lang) {
  lang = lang || 'ko';
  const t = productText(pd, lang);
  const text = paragraphs(t.description);
  const gallery = pd.photos.length
    ? `<div class="gallery sq">${pd.photos.map((f, i) => `<button type="button" data-full="/uploads/${f}" aria-label="${AREAS.esc(t.name)} ${i + 1}"><img src="/uploads/${f}" alt="${AREAS.esc(t.name)} ${i + 1}"${i ? ' loading="lazy"' : ''}></button>`).join('')}</div>`
    : '';
  const content = `  <main class="card">\n    <div class="rv-tags">${productTags(pd, lang)}</div>\n    <h1>${AREAS.esc(t.name)}</h1>\n` +
    (t.price ? `    <div class="pd-price big">${AREAS.esc(t.price)}</div>\n` : '') +
    `    ${gallery}\n    <div class="text">${text}</div>\n` +
    `    <a class="back-list" href="${pageUrl(lang, '/products')}">${tr(lang, 'productsBack')}</a>\n` +
    `    <section class="cta"><p>${tr(lang, 'productAsk')}<br><span style="font-weight:500;font-size:0.85rem">@@HOURS@@</span></p><a class="btn btn-primary" href="tel:@@PHONE_TEL@@">${tr(lang, 'ctaCall')}</a></section>\n  </main>`;
  const desc = t.description.replace(/\s+/g, ' ').slice(0, 150) || tr(lang, 'productsDesc');
  const title = `${t.name} | ${tr(lang, 'productsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const ld = AREAS.ldScript({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: t.name,
    description: desc,
    image: pd.photos.map((f) => `${cfg.siteUrl}/uploads/${f}`),
    inLanguage: LANG_META[lang].hreflang,
  });
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/products/' + pd.id, title, desc, ld) };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/products'), '/products/' + pd.id, 'products');
}

/** Bottom call-to-action shared by the FAQ and checklist pages. */
function helpCta(lang) {
  return `    <section class="cta"><p>${tr(lang, 'needHelp')}<br><span style="font-weight:500;font-size:0.85rem">@@HOURS@@</span></p>` +
    `<div class="cta-actions"><a class="btn btn-primary" href="tel:@@PHONE_TEL@@">${tr(lang, 'ctaCall')}</a><a class="btn btn-ghost" href="${pageUrl(lang, '/')}#inquiry">${tr(lang, 'ctaInquiry')}</a></div></section>`;
}

function renderFaq(items, cfg, lang) {
  lang = lang || 'ko';
  const rows = items.map((it) => {
    const q = trPick(it, 'question', lang);
    const a = trPick(it, 'answer', lang);
    return `    <details class="faq-item"><summary>${AREAS.esc(q)}</summary><div class="faq-a">${paragraphs(a)}</div></details>`;
  });
  const content = `  <section class="head"><h1>${tr(lang, 'faqTitle')}</h1><p>${tr(lang, 'faqSub')}</p></section>\n` +
    (items.length ? `  <section class="faq">\n${rows.join('\n')}\n  </section>` : `  <p class="rv-empty">${tr(lang, 'faqEmpty')}</p>`) +
    `\n  <div class="page-cta">\n${helpCta(lang)}\n  </div>`;
  const title = `${tr(lang, 'faqTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const ld = items.length ? AREAS.ldScript({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: LANG_META[lang].hreflang,
    mainEntity: items.map((it) => ({ '@type': 'Question', name: trPick(it, 'question', lang), acceptedAnswer: { '@type': 'Answer', text: trPick(it, 'answer', lang) } })),
  }) : '';
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/faq', title, tr(lang, 'faqDesc'), ld) };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/faq', 'faq');
}

function renderGuide(items, cfg, lang) {
  lang = lang || 'ko';
  const rows = items.map((it, i) =>
    `    <li><span class="g-n">${i + 1}</span><div><h2>${AREAS.esc(trPick(it, 'question', lang))}</h2>${paragraphs(trPick(it, 'answer', lang))}</div></li>`);
  const content = `  <section class="head"><h1>${tr(lang, 'guideTitle')}</h1><p>${tr(lang, 'guideSub')}</p></section>\n` +
    (items.length ? `  <ol class="guide">\n${rows.join('\n')}\n  </ol>` : `  <p class="rv-empty">${tr(lang, 'guideEmpty')}</p>`) +
    `\n  <div class="page-cta">\n${helpCta(lang)}\n  </div>`;
  const title = `${tr(lang, 'guideTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/guide', title, tr(lang, 'guideDesc'), '') };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/guide', 'guide');
}

/** Product and work-review teasers shown on the home page (between the banner and the map); an empty list shows a short notice. */
function homeSections(extra, lang) {
  const out = [];
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const head = (id, title, path, label) =>
    `<div class="hm-head"><h2 id="${id}">${title}</h2><a class="hm-arrow" href="${pageUrl(lang, path)}" aria-label="${label}">${arrow}</a></div>`;
  const more = (path, label) => `<div class="hm-more"><a class="hm-more-btn" href="${pageUrl(lang, path)}">${label}</a></div>`;
  if (extra.showProducts !== false) {
    const cards = (extra.products || []).map((pd) => {
      const t = productText(pd, lang);
      const first = pd.photos[0];
      const img = first ? `<img src="/uploads/${first}" alt="${AREAS.esc(t.name)}" loading="lazy" decoding="async">` : '';
      return `      <a class="hm-card" href="${pageUrl(lang, '/products/' + pd.id)}"><div class="hm-pimg">${img}</div>` +
        `<div class="hm-ptext"><h3>${AREAS.esc(t.name)}</h3>` +
        (t.price ? `<div class="hm-price">${AREAS.esc(t.price)}</div>` : '') + '</div></a>';
    });
    out.push(`  <section class="hm-sec" aria-labelledby="hmProducts">\n    ${head('hmProducts', tr(lang, 'productsTitle'), '/products', tr(lang, 'moreProducts'))}\n` +
      (cards.length
        ? `    <div class="hm-grid hm-prod">\n${cards.join('\n')}\n    </div>\n    ${more('/products', tr(lang, 'moreProducts'))}\n`
        : `    <p class="hm-empty">${tr(lang, 'productsEmpty')}</p>\n`) + '  </section>');
  }
  if (extra.showReviews !== false) {
    const cards = (extra.reviews || []).map((rv) => {
      const t = reviewText(rv, lang);
      const first = rv.photos[0];
      const img = first ? `<img src="/uploads/${first}" alt="${AREAS.esc(t.title)}" loading="lazy" decoding="async">` : '';
      const excerpt = t.body.replace(/\s+/g, ' ').trim().slice(0, 120);
      return `      <a class="hm-rcard${first ? '' : ' no-photo'}" href="${pageUrl(lang, '/reviews/' + rv.id)}">${img}` +
        `<div class="hm-rover"><h3>${AREAS.esc(t.title)}</h3>` +
        (excerpt ? `<p class="hm-rtext">${AREAS.esc(excerpt)}</p>` : '') + '</div></a>';
    });
    out.push(`  <section class="hm-sec" aria-labelledby="hmReviews">\n    ${head('hmReviews', tr(lang, 'reviewsTitle'), '/reviews', tr(lang, 'moreReviews'))}\n` +
      (cards.length
        ? `    <div class="hm-grid hm-rev">\n${cards.join('\n')}\n    </div>\n    ${more('/reviews', tr(lang, 'moreReviews'))}\n`
        : `    <p class="hm-empty">${tr(lang, 'reviewsEmpty')}</p>\n`) + '  </section>');
  }
  return out.join('\n\n');
}

function heroSub(activeGs, lang) {
  const n = activeGs.length;
  if (lang === 'zh') {
    if (n === 0) return '我们正在筹备服务区域。留言后，我们会告知能否上门。';
    let tail;
    if (n === NAMES.length) tail = '目前首尔全区域均可上门服务。';
    else if (n === 1) tail = `目前主要在${AREAS.nm(activeGs[0], 'zh')}上门服务。`;
    else if (n <= 5) tail = `目前在${activeGs.map((g) => AREAS.nm(g, 'zh')).join('、')}上门服务。`;
    else tail = `目前在首尔${n}个区上门服务。`;
    return `${tail} 在一张地图上查看服务内容与区域。`;
  }
  if (lang === 'ja') {
    if (n === 0) return 'サービスエリアを準備中です。お問い合わせいただければ、訪問の可否をご案内します。';
    let tail;
    if (n === NAMES.length) tail = '現在、ソウル全域に出張しています。';
    else if (n === 1) tail = `現在は${AREAS.nm(activeGs[0], 'ja')}を中心に出張しています。`;
    else if (n <= 5) tail = `現在は${activeGs.map((g) => AREAS.nm(g, 'ja')).join('・')}で出張しています。`;
    else tail = `現在はソウル${n}区で出張しています。`;
    return `${tail} サービス内容と対応エリアを地図一枚でご覧いただけます。`;
  }
  if (lang === 'en') {
    if (n === 0) return "We're preparing our service areas. Send us a message and we'll let you know whether we can visit.";
    let tail;
    if (n === NAMES.length) tail = 'We currently serve all of Seoul.';
    else if (n === 1) tail = `We currently serve ${activeGs[0].nameEn}.`;
    else if (n <= 5) tail = `We currently serve ${activeGs.map((g) => g.nameEn).join(', ')}.`;
    else tail = `We currently serve ${n} districts in Seoul.`;
    return `${tail} See our services and coverage on a single map.`;
  }
  if (n === 0) return '서비스 지역을 준비하고 있어요. 문의를 남겨주시면 가능 여부를 안내해 드립니다.';
  let tail;
  if (n === NAMES.length) tail = '서울 전 지역에서 출장을 나가고 있어요.';
  else if (n === 1) tail = `지금은 ${activeGs[0].name} 위주로 출장을 나가고 있어요.`;
  else if (n <= 5) tail = `지금은 ${activeGs.map((g) => g.name).join(' · ')} 지역에서 출장을 나가고 있어요.`;
  else tail = `지금은 서울 ${n}개 구에서 출장을 나가고 있어요.`;
  return `${tail} 필요한 서비스와 진행 상황을 지도 한 장으로 보여드립니다.`;
}

function chips(gs, isActive, lang) {
  if (isActive) {
    return gs
      .map((g) => `            <button type="button" class="chip active" data-slug="${g.slug}" aria-expanded="false" aria-controls="detail-${g.slug}"><span class="dot"></span>${AREAS.esc(AREAS.nm(g, lang))}</button>`)
      .join('\n');
  }
  return gs.map((g) => `            <div class="chip"><span class="dot"></span>${AREAS.esc(AREAS.nm(g, lang))}</div>`).join('\n');
}

function labelText(g, lang) {
  if (lang === 'en') return g.nameEn.replace(/-gu$/, '');
  const name = AREAS.nm(g, lang);
  return name.length > 2 ? name.replace(/[구区]$/, '') : name;
}

/** Banner texts the admin has changed (escaped); anything left empty keeps the built-in text. */
function heroOverrides(cfg, lang) {
  const h = cfg.hero && cfg.hero[lang];
  const o = {};
  if (h) {
    if (h.l1) o.heroL1 = AREAS.esc(h.l1);
    if (h.l2) o.heroL2 = AREAS.esc(h.l2);
    if (h.sub) o.heroSub = AREAS.esc(h.sub);
  }
  return o;
}

function renderPublic(activeInput, cfg, contentMap, lang, extra) {
  lang = lang || 'ko';
  extra = extra || {};
  contentMap = contentMap || {};
  const activeSet = new Set(activeInput);
  const active = NAMES.filter((n) => activeSet.has(n)).map((n) => AREAS.BY_NAME[n]);
  const inactive = NAMES.filter((n) => !activeSet.has(n)).map((n) => AREAS.BY_NAME[n]);

  const groups = [];
  groups.push(
    '        <div class="group">\n' +
    `          <div class="group-head"><b>${tr(lang, 'groupOn')}</b><span>${tr(lang, 'districtCount', { N: active.length })}</span></div>\n` +
    (active.length
      ? `          <div class="chip-grid">\n${chips(active, true, lang)}\n          </div>\n          <div class="area-details">\n${active.map((g) => AREAS.detailCard(g, contentMap[g.name], lang)).join('\n')}\n          </div>\n`
      : `          <div class="chip-empty">${tr(lang, 'groupEmpty')}</div>\n`) +
    '        </div>'
  );
  if (inactive.length) {
    groups.push(
      '        <div class="group is-dim">\n' +
      `          <div class="group-head"><b>${tr(lang, 'groupOff')}</b><span>${tr(lang, 'districtCount', { N: inactive.length })}</span></div>\n` +
      `          <div class="chip-grid">\n${chips(inactive, false, lang)}\n          </div>\n` +
      '        </div>'
    );
  }

  const off = tr(lang, 'legendOff');
  const on = tr(lang, 'legendOn');
  const paths = [];
  for (const g of GU) {
    if (!activeSet.has(g.name)) {
      const a = AREAS.BY_NAME[g.name];
      paths.push(`          <path class="gu" tabindex="0" data-name="${g.name}" data-status="${off}" d="${g.d}"><title>${AREAS.nm(a, lang)} · ${off}</title></path>`);
    }
  }
  for (const g of GU) {
    if (activeSet.has(g.name)) {
      const a = AREAS.BY_NAME[g.name];
      paths.push(`          <path class="gu gu-active" tabindex="0" role="button" data-slug="${a.slug}" data-name="${g.name}" data-status="${on}" d="${g.d}" filter="url(#liftShadow)"><title>${AREAS.nm(a, lang)} · ${on}</title></path>`);
    }
  }

  const labels = active
    .map((a) => {
      const g = BY_NAME[a.name];
      const text = labelText(a, lang);
      const per = lang === 'en' ? 0.6 : 1;
      const font = Math.max(lang === 'en' ? 8 : 9, Math.min(14, (g.r * 2 * 0.92) / (text.length * per)));
      return `        <text class="gu-label" style="font-size:${font.toFixed(1)}px" x="${g.lx}" y="${g.ly}" text-anchor="middle" dominant-baseline="central">${AREAS.esc(text)}</text>`;
    })
    .join('\n');

  const seo = AREAS.homeSeo(cfg, active, lang);
  if (extra && extra.faq && extra.faq.length) {
    seo.head += '\n' + AREAS.ldScript({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: LANG_META[lang].hreflang,
      mainEntity: extra.faq.map((it) => ({ '@type': 'Question', name: trPick(it, 'question', lang), acceptedAnswer: { '@type': 'Answer', text: trPick(it, 'answer', lang) } })),
    });
  }
  const i18n = { sending: STR[lang].jsSending, success: STR[lang].jsSuccess, error: STR[lang].jsError, phone: STR[lang].jsPhone, rate: STR[lang].jsRate, submit: STR[lang].submit };
  const html = translate(publicTpl, lang, heroOverrides(cfg, lang));
  return fill(html, Object.assign(commonFill(cfg, lang), {
    '@@TITLE@@': AREAS.esc(seo.title),
    '@@SEO@@': seo.head,
    '@@GNB@@': gnbHtml(cfg, lang, 'areas', '/'),
    '@@HOME_SECTIONS@@': homeSections(extra, lang),
    '@@I18N_JSON@@': JSON.stringify(i18n).replace(/</g, '\\u003c'),
    '@@HERO_SUB@@': AREAS.esc(heroSub(active, lang)),
    '@@GROUPS@@': groups.join('\n\n'),
    '@@GU_PATHS@@': paths.join('\n'),
    '@@GU_LABELS@@': labels,
  }));
}

function renderAdmin() {
  const adminPaths = GU
    .map((g) => `            <path class="gu" tabindex="0" data-name="${g.name}" d="${g.d}"><title>${g.name}</title></path>`)
    .join('\n');
  const script = '<script>\n' + adminScript.split('@@GU_NAMES@@').join(JSON.stringify(NAMES)) + '\n</script>';
  return fill(adminTpl, { '@@GU_PATHS@@': adminPaths, '@@ADMIN_SCRIPT@@': script });
}

function renderArea(slug, activeInput, cfg, contentMap, lang) {
  lang = lang || 'ko';
  contentMap = contentMap || {};
  const g = AREAS.BY_SLUG[slug];
  const activeSet = new Set(activeInput);
  if (!g || !activeSet.has(g.name)) return null;
  const X = AREAS.nm(g, lang);
  const D = AREAS.dongsOf(g, lang);
  const custom = contentMap[g.name];
  const text = AREAS.content(g, custom, cfg, lang);
  const seo = AREAS.areaSeo(g, cfg, custom, lang);
  const bodyHtml = text.body
    ? `<h2>${tr(lang, 'h2Body', { AREA_NAME: AREAS.esc(X) })}</h2>\n    <div class="body">${text.body.split(/\n{2,}/).map((p) => `<p>${AREAS.esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('')}</div>`
    : '';
  const services = AREAS.services(g, lang)
    .map((s) => `      <li><b>${AREAS.esc(s.title)}</b><span>${AREAS.esc(s.text)}</span></li>`)
    .join('\n');
  const neighbors = g.neighbors
    .map((n) => {
      const ng = AREAS.BY_NAME[n];
      const label = AREAS.nm(ng, lang);
      return activeSet.has(n)
        ? `<a href="${pageUrl(lang, '/area/' + ng.slug)}">${AREAS.esc(tr(lang, 'neighborLink', { NAME: label }))}</a>`
        : `<span>${AREAS.esc(label)} ${tr(lang, 'neighborSoon')}</span>`;
    })
    .join('');

  const common = commonFill(cfg, lang);
  const vars = { AREA_NAME: AREAS.esc(X), DONG_COUNT: String(D.length) };
  // translate tokens first, then substitute the page values they contain
  let html = translate(areaTpl, lang);
  html = fill(html, Object.assign({}, common, {
    '@@AREA_NAME@@': vars.AREA_NAME,
    '@@DONG_COUNT@@': vars.DONG_COUNT,
  }));
  return fill(html, {
    '@@TITLE@@': AREAS.esc(seo.title),
    '@@HEAD@@': seo.head,
    '@@GNB@@': gnbHtml(cfg, lang, 'areas', '/area/' + g.slug),
    '@@HEADLINE@@': AREAS.esc(text.headline),
    '@@INTRO@@': AREAS.esc(text.intro),
    '@@BODY@@': bodyHtml,
    '@@SERVICES@@': services,
    '@@DONG_CHIPS@@': D.map((d) => `<span>${AREAS.esc(d)}</span>`).join(''),
    '@@NEIGHBORS@@': neighbors,
  });
}

function renderSitemap(activeInput, cfg, reviewIds, productIds) {
  const activeSet = new Set(activeInput);
  const paths = ['/', '/reviews', '/products', '/faq', '/guide']
    .concat(NAMES.filter((n) => activeSet.has(n)).map((n) => '/area/' + AREAS.BY_NAME[n].slug))
    .concat((reviewIds || []).map((id) => '/reviews/' + id))
    .concat((productIds || []).map((id) => '/products/' + id));
  const hint = (p) => {
    if (p === '/') return ['weekly', '1.0'];
    if (p === '/reviews' || p === '/products') return ['weekly', '0.7'];
    if (p.startsWith('/area/')) return ['weekly', '0.8'];
    return ['monthly', '0.6'];
  };
  const entry = (lang, p) => {
    const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${cfg.siteUrl}${pageUrl(l, p)}"/>`).join('\n');
    const [freq, prio] = hint(p);
    return `  <url>\n    <loc>${cfg.siteUrl}${pageUrl(lang, p)}</loc>\n${alts}\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
  };
  const body = paths.flatMap((p) => LANGS.map((l) => entry(l, p))).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + body + '\n</urlset>\n';
}

module.exports = { NAMES, renderPublic, renderAdmin, renderArea, renderSitemap, renderReviews, renderReview, renderProducts, renderProduct, renderFaq, renderGuide };
