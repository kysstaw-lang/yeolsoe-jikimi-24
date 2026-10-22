'use strict';

const fs = require('fs');
const path = require('path');

const GU = require('./gu.json');
const AREAS = require('./areas');
const { STR, LANGS, translate, tr, pageUrl } = require('./i18n');

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
  return lang === 'en'
    ? { hours: cfg.hoursEn, bizName: cfg.bizNameEn, owner: cfg.ownerEn || cfg.owner }
    : { hours: cfg.hours, bizName: cfg.bizName, owner: cfg.owner };
}

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
  ${dockHtml(cfg, lang)}`;
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
  };
}

function langSwitch(lang, path) {
  const link = (l, label) =>
    `<a href="${pageUrl(l, path)}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${label}</a>`;
  return `<nav class="lang-switch" aria-label="${STR[lang].langAria}">${link('ko', '한국어')}${link('en', 'English')}</nav>`;
}

function tabsHtml(lang, current, counts) {
  counts = counts || {};
  const tab = (key, path, label) => {
    const n = counts[key];
    return `<a href="${pageUrl(lang, path)}"${current === key ? ' class="on" aria-current="page"' : ''}>${label}${n ? ` <span class="cnt">${n}</span>` : ''}</a>`;
  };
  return `<nav class="tab-nav" aria-label="${STR[lang].tabsAria}">` +
    tab('areas', '/', STR[lang].tabAreas) +
    tab('reviews', '/reviews', STR[lang].tabReviews) +
    tab('products', '/products', STR[lang].tabProducts) +
    `</nav>`;
}

function fmtDate(str, lang) {
  const d = new Date(str + 'T00:00:00Z');
  if (isNaN(d)) return '';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR', { year: 'numeric', month: lang === 'en' ? 'short' : 'long', day: 'numeric', timeZone: 'UTC' });
}

function reviewText(rv, lang) {
  return {
    title: (lang === 'en' && rv.titleEn) || rv.title,
    body: (lang === 'en' && rv.bodyEn) || rv.body,
  };
}

function reviewTags(rv, lang) {
  const tags = [];
  if (rv.service && STR[lang]['svc_' + rv.service]) tags.push(`<span class="rv-tag">${AREAS.esc(STR[lang]['svc_' + rv.service])}</span>`);
  const g = AREAS.BY_NAME[rv.region];
  if (g) tags.push(`<span class="rv-tag gray">${AREAS.esc(AREAS.nm(g, lang))}</span>`);
  return tags.join('');
}

function pageShell(cfg, lang, seo, content, backUrl, langPath) {
  const html = translate(pageTpl, lang);
  // the content is inserted first so the shared placeholders inside it get filled too
  return fill(fill(html, { '@@CONTENT@@': content }), Object.assign(commonFill(cfg, lang), {
    '@@TITLE@@': AREAS.esc(seo.title),
    '@@HEAD@@': seo.head,
    '@@LANG_SWITCH@@': langSwitch(lang, langPath),
    '@@BACK_URL@@': backUrl,
  }));
}

function renderReviews(items, cfg, lang, counts) {
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
  const content = `  <section class="head"><h1>${tr(lang, 'reviewsTitle')}</h1><p>${tr(lang, 'reviewsSub')}</p>${tabsHtml(lang, 'reviews', Object.assign({}, counts, { reviews: items.length }))}</section>\n` +
    (items.length ? `  <section class="rv-grid">\n${cards.join('\n')}\n  </section>` : `  <p class="rv-empty">${tr(lang, 'reviewsEmpty')}</p>`);
  const title = `${tr(lang, 'reviewsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/reviews', title, tr(lang, 'reviewsDesc'), '') };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/reviews');
}

function renderReview(rv, cfg, lang) {
  lang = lang || 'ko';
  const t = reviewText(rv, lang);
  const text = t.body.split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${AREAS.esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
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
    inLanguage: lang,
    image: rv.photos.map((f) => `${cfg.siteUrl}/uploads/${f}`),
    author: { '@type': 'Organization', name: lang === 'en' ? 'Yeolsoe Jikimi 24' : '열쇠지킴이24시' },
  });
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/reviews/' + rv.id, title, desc, ld) };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/reviews'), '/reviews/' + rv.id);
}

function productText(pd, lang) {
  return {
    name: (lang === 'en' && pd.nameEn) || pd.name,
    description: (lang === 'en' && pd.descriptionEn) || pd.description,
    price: (lang === 'en' && pd.priceEn) || pd.price,
  };
}

function productTags(pd, lang) {
  return pd.category && STR[lang]['cat_' + pd.category]
    ? `<span class="rv-tag">${AREAS.esc(STR[lang]['cat_' + pd.category])}</span>`
    : '';
}

function renderProducts(items, cfg, lang, counts) {
  lang = lang || 'ko';
  const cards = items.map((pd) => {
    const t = productText(pd, lang);
    const first = pd.photos[0];
    const thumb = first
      ? `<div class="rv-thumb"><img src="/uploads/${first}" alt="${AREAS.esc(t.name)}" loading="lazy">${pd.photos.length > 1 ? `<span class="pc">${tr(lang, 'photoCount', { N: pd.photos.length })}</span>` : ''}</div>`
      : '<div class="rv-thumb"></div>';
    const excerpt = t.description.replace(/\s+/g, ' ').slice(0, 100);
    return `    <a class="rv-card" href="${pageUrl(lang, '/products/' + pd.id)}">${thumb}` +
      `<div class="rv-body"><div class="rv-tags">${productTags(pd, lang)}</div><h2>${AREAS.esc(t.name)}</h2>` +
      (excerpt ? `<p class="rv-excerpt">${AREAS.esc(excerpt)}</p>` : '') +
      (t.price ? `<div class="pd-price">${AREAS.esc(t.price)}</div>` : '') +
      `</div></a>`;
  });
  const content = `  <section class="head"><h1>${tr(lang, 'productsTitle')}</h1><p>${tr(lang, 'productsSub')}</p>${tabsHtml(lang, 'products', Object.assign({}, counts, { products: items.length }))}</section>\n` +
    (items.length ? `  <section class="rv-grid">\n${cards.join('\n')}\n  </section>` : `  <p class="rv-empty">${tr(lang, 'productsEmpty')}</p>`);
  const title = `${tr(lang, 'productsTitle')} | ${AREAS.SITE_NAME[lang]}`;
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/products', title, tr(lang, 'productsDesc'), '') };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/'), '/products');
}

function renderProduct(pd, cfg, lang) {
  lang = lang || 'ko';
  const t = productText(pd, lang);
  const text = t.description.split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${AREAS.esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  const gallery = pd.photos.length
    ? `<div class="gallery">${pd.photos.map((f, i) => `<button type="button" data-full="/uploads/${f}" aria-label="${AREAS.esc(t.name)} ${i + 1}"><img src="/uploads/${f}" alt="${AREAS.esc(t.name)} ${i + 1}"${i ? ' loading="lazy"' : ''}></button>`).join('')}</div>`
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
    inLanguage: lang,
  });
  const seo = { title, head: AREAS.seoHead(cfg, lang, '/products/' + pd.id, title, desc, ld) };
  return pageShell(cfg, lang, seo, content, pageUrl(lang, '/products'), '/products/' + pd.id);
}

function heroSub(activeGs, lang) {
  const n = activeGs.length;
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
  return g.name.length > 2 ? g.name.replace(/구$/, '') : g.name;
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
  const i18n = { sending: STR[lang].jsSending, success: STR[lang].jsSuccess, error: STR[lang].jsError, phone: STR[lang].jsPhone, rate: STR[lang].jsRate, submit: STR[lang].submit };
  const html = translate(publicTpl, lang);
  return fill(html, Object.assign(commonFill(cfg, lang), {
    '@@TITLE@@': AREAS.esc(seo.title),
    '@@SEO@@': seo.head,
    '@@LANG_SWITCH@@': langSwitch(lang, '/'),
    '@@TABS@@': tabsHtml(lang, 'areas', { reviews: extra.reviewCount || 0, products: extra.productCount || 0 }),
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
    '@@LANG_SWITCH@@': langSwitch(lang, '/area/' + g.slug),
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
  const paths = ['/', '/reviews', '/products']
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

module.exports = { NAMES, renderPublic, renderAdmin, renderArea, renderSitemap, renderReviews, renderReview, renderProducts, renderProduct };
