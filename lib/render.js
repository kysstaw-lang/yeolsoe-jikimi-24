'use strict';

const fs = require('fs');
const path = require('path');

const GU = require('./gu.json');
const NAMES = GU.map((g) => g.name).sort();
const BY_NAME = Object.fromEntries(GU.map((g) => [g.name, g]));

const publicTpl = fs.readFileSync(path.join(__dirname, '..', 'views', 'public.html'), 'utf8');
const adminTpl = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.html'), 'utf8');
const adminScript = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.script.js'), 'utf8');

function fill(tpl, map) {
  let out = tpl;
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(value);
  return out;
}

function heroSub(active) {
  const n = active.length;
  if (n === 0) return '서비스 지역을 준비하고 있어요. 문의를 남겨주시면 가능 여부를 안내해 드립니다.';
  let tail;
  if (n === NAMES.length) tail = '서울 전 지역에서 출장을 나가고 있어요.';
  else if (n === 1) tail = `지금은 ${active[0]} 위주로 출장을 나가고 있어요.`;
  else if (n <= 5) tail = `지금은 ${active.join(' · ')} 지역에서 출장을 나가고 있어요.`;
  else tail = `지금은 서울 ${n}개 구에서 출장을 나가고 있어요.`;
  return `${tail} 필요한 서비스와 진행 상황을 지도 한 장으로 보여드립니다.`;
}

function chips(items, isActive) {
  const cls = isActive ? 'chip active' : 'chip';
  return items.map((n) => `            <div class="${cls}"><span class="dot"></span>${n}</div>`).join('\n');
}

function renderPublic(activeInput, cfg) {
  const activeSet = new Set(activeInput);
  const active = NAMES.filter((n) => activeSet.has(n));
  const inactive = NAMES.filter((n) => !activeSet.has(n));

  const groups = [];
  groups.push(
    '        <div class="group">\n' +
    `          <div class="group-head"><b>서비스 가능 지역</b><span>${active.length}개 구</span></div>\n` +
    (active.length
      ? `          <div class="chip-grid">\n${chips(active, true)}\n          </div>\n`
      : '          <div class="chip-empty">현재 준비 중입니다.</div>\n') +
    '        </div>'
  );
  if (inactive.length) {
    groups.push(
      '        <div class="group is-dim">\n' +
      `          <div class="group-head"><b>준비 중 지역</b><span>${inactive.length}개 구</span></div>\n` +
      `          <div class="chip-grid">\n${chips(inactive, false)}\n          </div>\n` +
      '        </div>'
    );
  }

  const paths = [];
  for (const g of GU) {
    if (!activeSet.has(g.name)) {
      paths.push(`          <path class="gu" tabindex="0" data-name="${g.name}" data-status="준비중" d="${g.d}"><title>${g.name} · 준비중</title></path>`);
    }
  }
  for (const g of GU) {
    if (activeSet.has(g.name)) {
      paths.push(`          <path class="gu gu-active" tabindex="0" data-name="${g.name}" data-status="서비스 가능" d="${g.d}" filter="url(#liftShadow)"><title>${g.name} · 서비스 가능</title></path>`);
    }
  }

  const font = active.length <= 3 ? 15 : 11;
  const labels = active
    .map((n) => `        <text class="gu-label" style="font-size:${font}px" x="${BY_NAME[n].lx}" y="${BY_NAME[n].ly}" text-anchor="middle" dominant-baseline="middle">${n}</text>`)
    .join('\n');

  return fill(publicTpl, {
    '@@HERO_SUB@@': heroSub(active),
    '@@GROUPS@@': groups.join('\n\n'),
    '@@GU_PATHS@@': paths.join('\n'),
    '@@GU_LABELS@@': labels,
    '@@PHONE_TEL@@': cfg.phone.replace(/[^0-9+]/g, ''),
    '@@PHONE@@': cfg.phone,
    '@@HOURS@@': cfg.hours,
    '@@YEAR@@': String(new Date().getFullYear()),
  });
}

function renderAdmin() {
  const adminPaths = GU
    .map((g) => `            <path class="gu" tabindex="0" data-name="${g.name}" d="${g.d}"><title>${g.name}</title></path>`)
    .join('\n');
  const script = '<script>\n' + adminScript.split('@@GU_NAMES@@').join(JSON.stringify(NAMES)) + '\n</script>';
  return fill(adminTpl, { '@@GU_PATHS@@': adminPaths, '@@ADMIN_SCRIPT@@': script });
}

module.exports = { NAMES, renderPublic, renderAdmin };
