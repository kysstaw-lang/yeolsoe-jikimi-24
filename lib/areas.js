'use strict';

const DATA = require('./areas-data.json');
const { tr, pageUrl, LANGS, LANG_META } = require('./i18n');

const BY_NAME = Object.fromEntries(DATA.map((g) => [g.name, g]));
const BY_SLUG = Object.fromEntries(DATA.map((g) => [g.slug, g]));
const INDEX = Object.fromEntries(DATA.map((g, i) => [g.name, i]));

const SITE_NAME = { ko: '열쇠지킴이 24시', en: 'Yeolsoe Jikimi 24', zh: 'Yeolsoe Jikimi 24', ja: 'Yeolsoe Jikimi 24' };

/** Seoul district names written with Chinese characters (Simplified for zh, Japanese forms for ja). */
const GU_ZH = {
  강남구: '江南区', 강동구: '江东区', 강북구: '江北区', 강서구: '江西区', 관악구: '冠岳区', 광진구: '广津区', 구로구: '九老区',
  금천구: '衿川区', 노원구: '芦原区', 도봉구: '道峰区', 동대문구: '东大门区', 동작구: '铜雀区', 마포구: '麻浦区',
  서대문구: '西大门区', 서초구: '瑞草区', 성동구: '城东区', 성북구: '城北区', 송파구: '松坡区', 양천구: '阳川区',
  영등포구: '永登浦区', 용산구: '龙山区', 은평구: '恩平区', 종로구: '钟路区', 중구: '中区', 중랑구: '中浪区',
};
const GU_JA = {
  강남구: '江南区', 강동구: '江東区', 강북구: '江北区', 강서구: '江西区', 관악구: '冠岳区', 광진구: '広津区', 구로구: '九老区',
  금천구: '衿川区', 노원구: '蘆原区', 도봉구: '道峰区', 동대문구: '東大門区', 동작구: '銅雀区', 마포구: '麻浦区',
  서대문구: '西大門区', 서초구: '瑞草区', 성동구: '城東区', 성북구: '城北区', 송파구: '松坡区', 양천구: '陽川区',
  영등포구: '永登浦区', 용산구: '龍山区', 은평구: '恩平区', 종로구: '鍾路区', 중구: '中区', 중랑구: '中浪区',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** District name shown to visitors. */
const nm = (g, lang) => (lang === 'en' ? g.nameEn : lang === 'zh' ? GU_ZH[g.name] : lang === 'ja' ? GU_JA[g.name] : g.name);
/** Neighborhood (dong) names: Hangul for Korean, the official English romanization for every other language. */
const dongsOf = (g, lang) => (lang === 'ko' ? g.dongs : g.dongsEn);
/** Suffix of the *_xx content columns the admin text is stored under (the Korean text has no suffix). */
const sfxOf = (lang) => (lang === 'ko' ? '' : '_' + lang);
const joinList = (list, lang) => list.join(lang === 'en' ? ', ' : lang === 'ko' ? '·' : '、');

const OFFERS = {
  ko: ['도어락 설치·교체', '열쇠 제작·복사', '잠금장치 수리', '잠금 해제'],
  en: ['Door lock installation & replacement', 'Key making & duplication', 'Lock repair', 'Lockout help'],
  zh: ['门锁安装·更换', '配钥匙·复制', '门锁维修', '开锁服务'],
  ja: ['ドアロックの設置・交換', '合鍵作成・複製', '錠の修理', '鍵開け'],
};

/** Generated copy for the languages other than Korean and English. */
const COPY = {
  zh: {
    intro: (c) => [
      `我们上门服务覆盖${c.X}的${c.s3}等${c.N}个洞，当场解决钥匙和门锁问题。门锁安装·更换、配钥匙·复制、门锁维修、开锁，在${c.X}所需的作业一次帮您搞定。`,
      `在${c.X}丢了钥匙，或者门锁突然打不开？我们以${c.X}${c.first}到${c.last}共${c.N}个洞为范围提供上门咨询。留言后，我们会先告知能否上门以及作业内容。`,
      `从${c.s2}到${c.X}各处，我们都能协助配钥匙和安装门锁。搬家后更换门锁、检查电池和故障、重新配丢失的钥匙，${c.X}${c.N}个洞内都欢迎咨询。`,
      `在${c.X}遇到钥匙或门锁问题请立刻联系我们。我们会上门${c.s3}等${c.X}的${c.N}个洞，现场处理开锁、门锁更换和配钥匙。`,
    ],
    headline: (X) => `${X}钥匙·门锁上门服务——从开锁到门锁安装、配钥匙，我们都能处理。`,
    services: (X) => [
      { title: '门锁安装 · 更换', text: `在${X}的公寓、别墅和商铺，我们提供密码锁、指纹锁的新装，以及现有产品的更换。` },
      { title: '配钥匙 · 复制', text: `在${X}可当场配制、复制丢失或需要备用的钥匙。我们会先告知您的钥匙类型是否可以制作。` },
      { title: '门锁维修', text: `在${X}检查门锁电池问题、故障和部件损坏，并更换所需部件。` },
      { title: '开锁服务', text: `在${X}遇到打不开门的情况时，我们会先确认情况，然后尽快协助开锁。` },
    ],
    description: (X, D, cfg) => `${X}配钥匙、门锁安装·更换、开锁上门服务。可上门${joinList(sample(D, 3), 'zh')}等${D.length}个洞。咨询电话 ${cfg.phone}`,
    homeTitle: () => `${SITE_NAME.zh} | 首尔钥匙·门锁上门服务`,
    homeLabel: (gs) => (gs.length === 0 ? '首尔' : gs.length <= 3 ? `首尔${gs.map((g) => nm(g, 'zh')).join('·')}` : `首尔${gs.length}个区`),
    homeDesc: (label, cfg) => `${label}配钥匙、门锁安装·更换、开锁上门服务。在地图上查看服务区域，轻松留言咨询。${cfg.phone}`,
    areaTitle: (X) => `${X}钥匙·门锁上门服务 | ${SITE_NAME.zh}`,
    crumb: (X) => `${X}钥匙·门锁上门服务`,
  },
  ja: {
    intro: (c) => [
      `${c.X}の${c.s3}など${c.N}の洞、どこでも出張して、鍵とドアロックのお悩みを現場で解決します。ドアロックの設置・交換、合鍵作成、錠の修理、鍵開けまで、${c.X}で必要な作業をまとめてお手伝いします。`,
      `${c.X}で鍵をなくした、またはドアロックが急に開かなくなりましたか？${c.first}から${c.last}まで、${c.X}の${c.N}の洞を対象に出張相談を受け付けています。お問い合わせいただければ、訪問の可否と作業内容を先にご案内します。`,
      `${c.s2}など${c.X}全域で、合鍵作成とドアロックの設置をお手伝いします。引っ越し後の交換、電池・故障の点検、紛失した鍵の再作成まで、${c.X}の${c.N}の洞どこからでもご相談ください。`,
      `${c.X}で鍵やドアロックにお困りなら、今すぐご連絡ください。${c.s3}など${c.X}の${c.N}の洞を訪問し、鍵開けからドアロック交換、合鍵作成まで現場で対応します。`,
    ],
    headline: (X) => `${X} 鍵・ドアロック出張 — 鍵開けからドアロック設置、合鍵作成まで対応します。`,
    services: (X) => [
      { title: 'ドアロックの設置・交換', text: `${X}のマンション・ビラ・店舗など、どこでも暗証番号式・指紋認証式ドアロックの新規設置と既存製品の交換を行います。` },
      { title: '合鍵作成・複製', text: `紛失した鍵や予備が必要な鍵を、${X}でその場で作成・複製します。鍵の種類によって対応可否を先にご案内します。` },
      { title: '錠の修理', text: `${X}でドアロックの電池トラブル、誤作動、部品の破損を点検し、必要な部品を交換します。` },
      { title: '鍵開け', text: `${X}で扉が開かない状況なら、状況を確認したうえで迅速に開錠をお手伝いします。` },
    ],
    description: (X, D, cfg) => `${X}の合鍵作成、ドアロックの設置・交換、鍵開け出張。${joinList(sample(D, 3), 'ja')}など${D.length}の洞を訪問。お問い合わせ ${cfg.phone}`,
    homeTitle: () => `${SITE_NAME.ja} | ソウル 鍵・ドアロック出張サービス`,
    homeLabel: (gs) => (gs.length === 0 ? 'ソウル' : gs.length <= 3 ? `ソウル${gs.map((g) => nm(g, 'ja')).join('・')}` : `ソウル${gs.length}区`),
    homeDesc: (label, cfg) => `${label}の合鍵作成、ドアロックの設置・交換、鍵開け出張サービス。サービスエリアを地図で確認して、かんたんにお問い合わせください。${cfg.phone}`,
    areaTitle: (X) => `${X} 鍵・ドアロック出張 | ${SITE_NAME.ja}`,
    crumb: (X) => `${X} 鍵・ドアロック出張`,
  },
};

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
  const s3 = joinList(sample(D, 3), lang);
  const s2 = lang === 'en' ? sample(D, 2).join(' and ') : joinList(sample(D, 2), lang);
  const first = D[0];
  const last = D[D.length - 1];
  if (COPY[lang]) return COPY[lang].intro({ X, N, s3, s2, first, last })[INDEX[g.name] % 4];
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
  if (COPY[lang]) return COPY[lang].headline(X);
  return lang === 'en'
    ? `${X} on-site key & door lock service: from lockouts to door lock installation and key making.`
    : `${X} 열쇠 · 도어락 출장 — 잠긴 문 개문부터 도어락 설치, 열쇠 제작까지 가능합니다.`;
}

function services(g, lang) {
  const X = nm(g, lang);
  if (COPY[lang]) return COPY[lang].services(X);
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
  if (COPY[lang]) return COPY[lang].description(X, D, cfg);
  return lang === 'en'
    ? `${X} key making, door lock installation & replacement and lockout service in Seoul. On-site visits across ${sample(D, 3).join(', ')} and ${D.length} neighborhoods. Call ${cfg.phone}`
    : `${X} 열쇠 제작, 도어락 설치·교체, 잠금 해제 출장. ${sample(D, 3).join('·')} 등 ${D.length}개 동 방문 상담. 문의 ${cfg.phone}`;
}

/** Text the admin may override per district and language; empty custom fields fall back to the generated copy. */
function content(g, custom, cfg, lang) {
  const c = custom || {};
  const sfx = sfxOf(lang);
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
  const ko = lang === 'ko';
  return ldScript({
    '@context': 'https://schema.org',
    '@type': 'Locksmith',
    '@id': cfg.siteUrl + '/#business',
    name: ko ? '열쇠지킴이24시' : 'Yeolsoe Jikimi 24',
    alternateName: ko ? '열쇠 지킴이' : '열쇠지킴이24시',
    url: cfg.siteUrl + pageUrl(lang, '/'),
    image: cfg.siteUrl + '/og-cover.png',
    telephone: toIntl(cfg.phone),
    sameAs: Object.values(cfg.links || {}).filter(Boolean),
    inLanguage: LANG_META[lang].hreflang,
    areaServed: areaGs.map((g) => ({ '@type': 'AdministrativeArea', name: ko ? `서울특별시 ${g.name}` : `${g.nameEn}, Seoul` })),
    makesOffer: OFFERS[lang].map((n) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
  });
}

/** hreflang alternates for a page that exists in every language. */
function alternates(cfg, path) {
  return LANGS.map((l) => `<link rel="alternate" hreflang="${LANG_META[l].hreflang}" href="${cfg.siteUrl}${pageUrl(l, path)}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${cfg.siteUrl}${pageUrl('ko', path)}">`)
    .join('\n');
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
    `<meta property="og:locale" content="${LANG_META[lang].og}">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME[lang])}">`,
    `<meta property="og:image" content="${cfg.siteUrl}/og-cover.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(SITE_NAME[lang])}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${cfg.siteUrl}/og-cover.png">`,
    `<meta name="geo.region" content="KR-11">`,
    `<meta name="geo.placename" content="${lang === 'ko' ? '서울특별시' : 'Seoul'}">`,
    `<meta name="theme-color" content="#4f63f0">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">`,
    extra,
  ].filter(Boolean).join('\n');
}

function homeSeo(cfg, activeGs, lang) {
  if (COPY[lang]) {
    const c = COPY[lang];
    const title = c.homeTitle();
    return { title, head: seoHead(cfg, lang, '/', title, c.homeDesc(c.homeLabel(activeGs), cfg), businessLd(cfg, activeGs, lang)) };
  }
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
  const X = nm(g, lang);
  const title = COPY[lang] ? COPY[lang].areaTitle(X) : en
    ? `${g.nameEn} Key & Door Lock Service | ${SITE_NAME.en}`
    : `${g.name} 열쇠 · 도어락 출장 | ${SITE_NAME.ko}`;
  const desc = content(g, custom, cfg, lang).description;
  const path = `/area/${g.slug}`;
  const crumbs = ldScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME[lang], item: cfg.siteUrl + pageUrl(lang, '/') },
      { '@type': 'ListItem', position: 2, name: COPY[lang] ? COPY[lang].crumb(X) : en ? `${g.nameEn} key & door lock service` : `${g.name} 열쇠 · 도어락 출장`, item: cfg.siteUrl + pageUrl(lang, path) },
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
  DATA, BY_NAME, BY_SLUG, SITE_NAME, GU_ZH, GU_JA, sfxOf, esc, nm, dongsOf, intro, headline, defaultDescription, content, services,
  homeSeo, areaSeo, detailCard, sample, seoHead, ldScript,
};
