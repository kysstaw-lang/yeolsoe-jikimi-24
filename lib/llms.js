'use strict';

const { pageUrl } = require('./i18n');

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
const won = (p) => (/^[\d,\s]+$/.test(String(p || '').trim()) ? `${String(p).trim()}원` : String(p || '').trim());

/**
 * Sections of llms.txt / llms-full.txt that come from the live data (so admin edits show up automatically).
 * llms.txt lists everything; llms-full.txt adds the long texts of products and work reviews.
 */
function dynamicSections(cfg, data, full) {
  const url = (p) => cfg.siteUrl + pageUrl('ko', p);
  const out = [];

  if (data.areas.length) {
    out.push('## 지역별 페이지', ...data.areas.map((a) => `- [${a.name} 출장 열쇠·도어락](${url('/area/' + a.slug)})`), '');
  }
  if (data.faq.length) {
    out.push(`## 자주 묻는 질문 (${url('/faq')})`);
    for (const it of data.faq) out.push(`- ${clip(it.question, 200)} → ${clip(it.answer, full ? 1200 : 400)}`);
    out.push('');
  }
  if (data.guide.length) {
    out.push(`## 출장 전 확인사항 (${url('/guide')})`);
    data.guide.forEach((it, i) => out.push(`${i + 1}. ${clip(it.question, 200)} — ${clip(it.answer, full ? 1200 : 400)}`));
    out.push('');
  }
  if (data.products.length) {
    out.push(`## 제품 (${url('/products')})`);
    for (const p of data.products) {
      const detail = [p.price ? won(p.price) : '', full ? clip(p.description, 500) : ''].filter(Boolean).join(' — ');
      out.push(`- [${clip(p.name, 100)}](${url('/products/' + p.id)})${detail ? ': ' + detail : ''}`);
    }
    out.push('');
  }
  if (data.reviews.length) {
    out.push(`## 작업 후기 (${url('/reviews')})`);
    for (const r of data.reviews) {
      out.push(`- [${clip(r.title, 100)}](${url('/reviews/' + r.id)})${full && r.body ? ': ' + clip(r.body, 400) : ''}`);
    }
    out.push('');
  }
  return out.join('\n');
}

/** `template` is static/llms.txt; @@AUTO@@ marks where the generated sections go. */
function buildLlms(template, cfg, data, full) {
  return template
    .split('@@AUTO@@').join(dynamicSections(cfg, data, full))
    .split('@@PHONE@@').join(cfg.phone)
    .split('@@HOURS@@').join(cfg.hours)
    .split('@@SITE@@').join(cfg.siteUrl);
}

module.exports = { buildLlms };
