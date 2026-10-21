'use strict';

const DATA = require('./areas-data.json');
const { tr, pageUrl } = require('./i18n');

const BY_NAME = Object.fromEntries(DATA.map((g) => [g.name, g]));
const BY_SLUG = Object.fromEntries(DATA.map((g) => [g.slug, g]));
const INDEX = Object.fromEntries(DATA.map((g, i) => [g.name, i]));

const SITE_NAME = { ko: '열쇠지킴이 24시', en: 'Yeolsoe Jikimi 24' };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** District name shown to visitors. */
const nm = (g, lang) => (lang === 'en' ? g.nameEn : g.name);
const dongsOf = (g, lang) => (lang === 'en' ? g.dongsEn : g.dongs);

function sample(list, n) {
  if (list.length <= n) return list.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round((i * (list.length - 1)) / (n - 1))]);
  return out;
}

function intro(g, lang) {
  const X = nm(g, lang);
  const D = dongsOf(g, lang);
  const N = D.length;
  const s3 = sample(D, 3).join(lang === 'en' ? ', ' : '·');
  const s2 = sample(D, 2).join(lang === 'en' ? ' and ' : '·');
  const first = D[0];
  const last = D[D.length - 1];
  const variants = lang === 'en'
    ? [
        `We come to you anywhere in ${X}, including ${s3} and all ${N} neighborhoods (dong), to solve key and door lock problems on the spot. Door lock installation and replacement, key making and duplication, lock repair and lockout help, all in one visit.`,
        `Locked out, or stuck with a door lock that won't open in ${X}? From ${first} to ${last}, we take on-site service requests across ${N} neighborhoods. Send us a message and we'll confirm availability and the work involved first.`,
        `From ${s2} to every corner of ${X}, we help with key making and door lock installation. After a move, for battery or malfunction checks, or to remake a lost key, just ask us anywhere in ${X}'s ${N} neighborhoods.`,
        `Trouble with a key or door lock in ${X}? Contact us right away. We visit ${s3} and the rest of ${X}'s ${N} neighborhoods for lockout help, door lock replacement and key duplication, all on site.`,
      ]
    : [
        `${X} ${s3} 등 ${N}개 동 어디든 방문해 열쇠와 도어락 문제를 현장에서 해결합니다. 도어락 설치·교체, 열쇠 제작·복사, 잠금장치 수리, 잠금 해제까지 ${X}에서 필요한 작업을 한 번에 도와드려요.`,
        `${X}에서 열쇠를 잃어버렸거나 도어락이 갑자기 열리지 않으시나요? ${first}에서 ${last}까지 ${X} ${N}개 동을 기준으로 출장 상담을 받고 있습니다. 문의를 남기시면 방문 가능 여부와 작업 내용을 먼저 안내해 드립니다.`,
        `${s2} 등 ${X} 전역에서 열쇠 제작과 도어락 설치를 도와드립니다. 이사 후 도어락 교체, 배터리·오작동 점검, 분실 열쇠 재제작까지 ${X} ${N}개 동 어디서든 문의해 주세요.`,
        `${X}에서 열쇠나 도어락 때문에 곤란하다면 바로 연락 주세요. ${s3} 등 ${X}의 ${N}개 동을 방문해 잠금 해제부터 도어락 교체, 열쇠 복사까지 현장에서 처리해 드립니다.`,
      ];
  return variants[INDEX[g.name] % variants.length];
}

function headline(g, lang) {
  const X = nm(g, lang);
  return lang === 'en'
    ? `${X} on-site key & door lock service: from lockouts to door lock installation and key making.`
    : `${X} 열쇠 · 도어락 출장 — 잠긴 문 개문부터 도어락 설치, 열쇠 제작까지 가능합니다.`;
}

function services(g, lang) {
  const X = nm(g, lang);
  if (lang === 'en') {
    return [
      { title: 'Door lock installation & replacement', text: `In apartments, villas and shops across ${X}, we install new keypad and fingerprint door locks and replace existing ones.` },
      { title: 'Key making & duplication', text: `Lost a key or need a spare? We make and copy keys on site in ${X}. We'll tell you first whether your key type is supported.` },
      { title: 'Lock repair', text: `In ${X}, we check battery problems, malfunctions and broken parts, and replace what is needed.` },
      { title: 'Lockout help', text: `If you can't get in anywhere in ${X}, we'll assess the situation and help you open the door quickly.` },
    ];
  }
  return [
    { title: '도어락 설치 · 교체', text: `${X}의 아파트·빌라·상가 어디든 번호키와 지문인식 도어락 신규 설치, 기존 제품 교체를 진행합니다.` },
    { title: '열쇠 제작 · 복사', text: `분실했거나 여분이 필요한 열쇠를 ${X}에서 바로 제작·복사해 드립니다. 키 종류에 따라 가능 여부를 먼저 안내해 드려요.` },
    { title: '잠금장치 수리', text: `${X}에서 도어락 배터리 문제, 오작동, 부품 파손을 점검하고 필요한 부품을 교체합니다.` },
    { title: '잠금 해제 출동', text: `${X}에서 문이 열리지 않는 상황이라면 상황을 확인한 뒤 신속하게 개방을 도와드립니다.` },
  ];
}

function defaultDescription(g, cfg, lang) {
  const D = dongsOf(g, lang);
  const X = nm(g, lang);
  return lang === 'en'
    ? `${X} key making, door lock installation & replacement and lockout service in Seoul. On-site visits across ${sample(D, 3).join(', ')} and ${D.length} neighborhoods. Call ${cfg.phone}`
    : `${X} 열쇠 제작, 도어락 설치·교체, 잠금 해제 출장. ${sample(D, 3).join('·')} 등 ${D.length}개 동 방문 상담. 문의 ${cfg.phone}`;
}

/** Text the admin may override per district and language; empty custom fields fall back to the generated copy. */
function content(g, custom, cfg, lang) {
  const c = custom || {};
  const sfx = lang === 'en' ? '_en' : '';
  return {
    intro: c['intro' + sfx] || intro(g, lang),
    headline: c['headline' + sfx] || headline(g, lang),
    body: c['body' + sfx] || '',
    description: c['description' + sfx] || defaultDescription(g, cfg, lang),
  };
}

function toIntl(phone) {
  const d = String(phone).replace(/[^0-9]/g, '');
  return d.startsWith('0') ? `+82-${d.slice(1, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : phone;
}

const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function businessLd(cfg, areaGs, lang) {
  const en = lang === 'en';
  return ldScript({
    '@context': 'https://schema.org',
    '@type': 'Locksmith',
    name: en ? 'Yeolsoe Jikimi 24' : '열쇠지킴이24시',
    alternateName: en ? '열쇠지킴이24시' : '열쇠 지킴이',
    url: cfg.siteUrl + pageUrl(lang, '/'),
    telephone: toIntl(cfg.phone),
    inLanguage: lang,
    areaServed: areaGs.map((g) => ({ '@type': 'AdministrativeArea', name: en ? `${g.nameEn}, Seoul` : `서울특별시 ${g.name}` })),
    makesOffer: (en
      ? ['Door lock installation & replacement', 'Key making & duplication', 'Lock repair', 'Lockout help']
      : ['도어락 설치·교체', '열쇠 제작·복사', '잠금장치 수리', '잠금 해제']
    ).map((n) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
  });
}

/** hreflang alternates for a page that exists in every language. */
function alternates(cfg, path) {
  return [
    `<link rel="alternate" hreflang="ko" href="${cfg.siteUrl}${pageUrl('ko', path)}">`,
    `<link rel="alternate" hreflang="en" href="${cfg.siteUrl}${pageUrl('en', path)}">`,
    `<link rel="alternate" hreflang="x-default" href="${cfg.siteUrl}${pageUrl('ko', path)}">`,
  ].join('\n');
}

function seoHead(cfg, lang, path, title, desc, extra) {
  const url = cfg.siteUrl + pageUrl(lang, path);
  return [
    cfg.naverVerify ? `<meta name="naver-site-verification" content="${esc(cfg.naverVerify)}" />` : '',
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    alternates(cfg, path),
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ko_KR'}">`,
    extra,
  ].filter(Boolean).join('\n');
}

function homeSeo(cfg, activeGs, lang) {
  const en = lang === 'en';
  const n = activeGs.length;
  let label;
  if (en) label = n === 0 ? 'Seoul' : n <= 3 ? activeGs.map((g) => g.nameEn).join(', ') : `${n} districts in Seoul`;
  else label = n === 0 ? '서울' : n <= 3 ? `서울 ${activeGs.map((g) => g.name).join('·')}` : `서울 ${n}개 구`;
  const title = en
    ? `${SITE_NAME.en} | Key & Door Lock On-site Service in Seoul`
    : `${SITE_NAME.ko} | 서울 열쇠 · 도어락 출장 서비스`;
  const desc = en
    ? `${label}: key making, door lock installation & replacement and lockout help on site. Check our service areas on the map and send an inquiry. ${cfg.phone}`
    : `${label} 열쇠 제작, 도어락 설치·교체, 잠금 해제 출장 서비스. 서비스 지역을 지도에서 확인하고 간편하게 문의하세요. ${cfg.phone}`;
  return { title, head: seoHead(cfg, lang, '/', title, desc, businessLd(cfg, activeGs, lang)) };
}

function areaSeo(g, cfg, custom, lang) {
  const en = lang === 'en';
  const title = en
    ? `${g.nameEn} Key & Door Lock Service | ${SITE_NAME.en}`
    : `${g.name} 열쇠 · 도어락 출장 | ${SITE_NAME.ko}`;
  const desc = content(g, custom, cfg, lang).description;
  const path = `/area/${g.slug}`;
  const crumbs = ldScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME[lang], item: cfg.siteUrl + pageUrl(lang, '/') },
      { '@type': 'ListItem', position: 2, name: en ? `${g.nameEn} key & door lock service` : `${g.name} 열쇠 · 도어락 출장`, item: cfg.siteUrl + pageUrl(lang, path) },
    ],
  });
  return { title, head: seoHead(cfg, lang, path, title, desc, businessLd(cfg, [g], lang) + '\n' + crumbs) };
}

/** Collapsible detail card shown on the home page when a district chip is pressed. */
function detailCard(g, custom, lang) {
  const text = content(g, custom, { phone: '' }, lang);
  const X = nm(g, lang);
  const D = dongsOf(g, lang);
  const dongChips = D.map((d) => `<span>${esc(d)}</span>`).join('');
  return (
    `<section class="area-detail" id="detail-${g.slug}" aria-label="${esc(tr(lang, 'detailAria', { NAME: X }))}" hidden>\n` +
    `  <div class="area-detail-head"><h3>${esc(X)}<span class="cnt">${esc(tr(lang, 'dongCount', { N: D.length }))}</span></h3>` +
    `<button type="button" class="area-close" data-close aria-label="${esc(tr(lang, 'detailCloseAria', { NAME: X }))}">${esc(tr(lang, 'closeBtn'))}</button></div>\n` +
    `  <p class="area-intro">${esc(text.intro)}</p>\n` +
    `  <p class="area-headline">${esc(text.headline)}</p>\n` +
    `  <div class="dong-chips">${dongChips}</div>\n` +
    `  <a class="area-more" href="${pageUrl(lang, '/area/' + g.slug)}">${esc(tr(lang, 'detailMore', { NAME: X }))}</a>\n` +
    `</section>`
  );
}

module.exports = {
  DATA, BY_NAME, BY_SLUG, SITE_NAME, esc, nm, dongsOf, intro, headline, defaultDescription, content, services,
  homeSeo, areaSeo, detailCard, sample, seoHead, ldScript,
};
