'use strict';

/**
 * Branch/office listing shown in the footer and under the inquiry form, and fed into llms.txt
 * and the business structured data so AI/search crawlers pick it up too.
 * Admin writes it as plain text (see DEFAULT_BRANCHES_TEXT for the format):
 *   "## 지사 이름" starts a new group; "이름: 설명 123-45-67890 https://..." is one branch
 *   (the Naver-map/blog link at the end is optional); any other line (e.g. "(추가 예정)")
 *   becomes a short note shown instead of a branch list.
 */

const BIZNO_RE = /(\d{3}-\d{2}-\d{5})/;
const URL_IN_TEXT_RE = /(https?:\/\/\S+)/;

function parseBranches(text) {
  const regions = [];
  let cur = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      cur = { title: line.slice(3).trim(), note: '', branches: [] };
      regions.push(cur);
      continue;
    }
    if (!cur) {
      cur = { title: '', note: '', branches: [] };
      regions.push(cur);
    }
    const colon = line.indexOf(':');
    if (colon === -1) {
      cur.note = cur.note ? `${cur.note} ${line}` : line;
      continue;
    }
    const name = line.slice(0, colon).trim();
    let rest = line.slice(colon + 1).trim();
    // Pull the link out first so a numeric bit inside the URL is never mistaken for the biz number.
    const u = URL_IN_TEXT_RE.exec(rest);
    let map = '';
    if (u) {
      map = u[1];
      rest = (rest.slice(0, u.index) + rest.slice(u.index + u[1].length)).trim();
    }
    const m = BIZNO_RE.exec(rest);
    let bizNo = '';
    if (m) {
      bizNo = m[1];
      rest = (rest.slice(0, m.index) + rest.slice(m.index + m[1].length)).trim();
    }
    if (name) cur.branches.push({ name, desc: rest, bizNo, map });
  }
  return regions.filter((r) => r.title || r.note || r.branches.length);
}

/** Every branch map/profile link across all regions, for structured data. */
function branchLinks(regions) {
  return (regions || []).flatMap((r) => r.branches).map((b) => b.map).filter(Boolean);
}

const DEFAULT_BRANCHES_TEXT = `## 서울 지사
서울 대치 본점: 열쇠지킴이 120-09-12308
논현점: 출장열쇠수리 번호키 금고태양문 757-74-00091
신사점: 출장열쇠도어락 금고 태양자동문 812-31-00557
성수점: 24시 출장열쇠수리, 전자번호키,보조키 434-11-01246
선릉점: 24시 출장 열쇠수리, 전자번호키, 디지털 도어락, 보조키 110-08-60029
성수2호점: 24시열쇠수리, 디지털도어락 744-04-01257

## 인천지사
(추가 예정)

## 경기지사
(추가 예정)`;

module.exports = { parseBranches, branchLinks, DEFAULT_BRANCHES_TEXT };
