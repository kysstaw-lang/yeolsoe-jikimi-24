var GU_NAMES = @@GU_NAMES@@;
var STATUS_CLASS = { '신규': 'new', '연락함': 'contacted', '완료': 'done' };
var STATUS_ORDER = ['신규', '연락함', '완료'];

var docs = [];
var activeFilter = 'all';
var currentView = 'inquiries';
var activeAreas = [];
var pollTimer = null;
var savedTimer = null;
var contentItems = [];
var contentSel = null;
var contentLoaded = false;
var drafts = {};
var translatorName = '';
var reviews = [];
var rvSel = null;
var rvDrafts = {};
var rvLoaded = false;
var rvUploading = 0;
var products = [];
var pdSel = null;
var pdDrafts = {};
var pdLoaded = false;
var pdUploading = 0;
var siteLoaded = false;
var siteData = null;

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function api(method, url, body) {
  var opts = { method: method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts).then(function (r) {
    if (r.status === 401) { showAuth(); throw new Error('unauthorized'); }
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { var e = new Error(j.error || 'request failed'); e.status = r.status; throw e; }
      return j;
    });
  });
}

/* ---------- two-step confirm for destructive buttons ---------- */

function armOrRun(btn, label, armedLabel, run) {
  if (btn.getAttribute('data-armed') === '1') {
    clearTimeout(btn._t);
    btn.removeAttribute('data-armed');
    btn.classList.remove('armed');
    btn.textContent = label;
    run();
    return;
  }
  btn.setAttribute('data-armed', '1');
  btn.classList.add('armed');
  btn.textContent = armedLabel;
  btn._t = setTimeout(function () {
    btn.removeAttribute('data-armed');
    btn.classList.remove('armed');
    btn.textContent = label;
  }, 3000);
}

/* ---------- auth ---------- */

function setAuthError(msg) { $('authError').textContent = msg || ''; }

function showAuth(msg) {
  stopPolling();
  $('appView').hidden = true;
  $('authView').hidden = false;
  setAuthError(msg);
  $('authPass').value = '';
  $('authUser').focus();
}

$('authForm').addEventListener('submit', function (e) {
  e.preventDefault();
  setAuthError('');
  var btn = $('authSubmit');
  btn.disabled = true;
  fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: $('authUser').value.trim(), password: $('authPass').value })
  }).then(function (r) {
    if (r.ok) { enterApp(); return; }
    setAuthError(r.status === 429
      ? '시도 횟수를 초과했어요. 잠시 후 다시 시도해 주세요.'
      : '아이디 또는 비밀번호가 맞지 않아요.');
    $('authPass').value = '';
  }).catch(function () {
    setAuthError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }).then(function () {
    btn.disabled = false;
  });
});

$('logoutBtn').addEventListener('click', function () {
  api('POST', '/api/logout', {}).catch(function () {}).then(function () {
    docs = [];
    contentItems = [];
    contentLoaded = false;
    drafts = {};
    reviews = [];
    rvLoaded = false;
    rvDrafts = {};
    rvSel = null;
    products = [];
    pdLoaded = false;
    pdDrafts = {};
    pdSel = null;
    siteLoaded = false;
    siteData = null;
    showAuth();
  });
});

/* ---------- app shell ---------- */

function enterApp() {
  $('authView').hidden = true;
  $('appView').hidden = false;
  setView(currentView);
  renderSyncInfo();
  refreshAll();
  startPolling();
}

function refreshAll() {
  return Promise.all([loadInquiries(), loadAreas()]).catch(function () {});
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(function () {
    if (document.hidden) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.tagName === 'SELECT')) return;
    refreshAll();
  }, 15000);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

function setView(v) {
  currentView = v;
  $('inquiriesView').hidden = v !== 'inquiries';
  $('areasView').hidden = v !== 'areas';
  $('contentView').hidden = v !== 'content';
  $('reviewsView').hidden = v !== 'reviews';
  $('productsView').hidden = v !== 'products';
  $('siteView').hidden = v !== 'site';
  if (v === 'site' && !siteLoaded) loadSite().catch(function () {});
  if (v === 'products' && !pdLoaded) loadProducts().catch(function () {});
  if (v === 'reviews' && !rvLoaded) loadReviews().catch(function () {});
  if (v === 'content' && !contentLoaded) loadContent().catch(function () {});
  document.querySelectorAll('#menu button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-view') === v);
  });
}

$('menu').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-view]');
  if (b) setView(b.getAttribute('data-view'));
});

/* ---------- inquiries ---------- */

function loadInquiries() {
  return api('GET', '/api/admin/inquiries').then(function (j) {
    docs = j.items || [];
    renderInquiries();
  });
}

$('addToggle').addEventListener('click', function () {
  $('addPanel').classList.toggle('open');
  if ($('addPanel').classList.contains('open')) $('a-region').focus();
});
$('addCancel').addEventListener('click', function () {
  $('addPanel').classList.remove('open');
  $('addForm').reset();
});

$('addForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var region = $('a-region').value.trim();
  var contact = $('a-contact').value.trim();
  var message = $('a-message').value.trim();
  if (!region && !contact && !message) return;
  api('POST', '/api/admin/inquiries', { region: region, contact: contact, message: message }).then(function () {
    $('addForm').reset();
    $('addPanel').classList.remove('open');
    return loadInquiries();
  }).catch(function () {});
});

$('tabs').addEventListener('click', function (e) {
  var btn = e.target.closest('.tab');
  if (!btn) return;
  activeFilter = btn.getAttribute('data-status');
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === btn); });
  renderInquiries();
});

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function nextStatus(s) { return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length]; }

function renderInquiries() {
  var counts = { '신규': 0, '연락함': 0, '완료': 0 };
  docs.forEach(function (d) { if (counts[d.status] !== undefined) counts[d.status]++; });
  $('cnt-all').textContent = docs.length;
  $('cnt-new').textContent = counts['신규'];
  $('cnt-contacted').textContent = counts['연락함'];
  $('cnt-done').textContent = counts['완료'];
  $('menu-inq').textContent = counts['신규'] ? docs.length + ' · 신규 ' + counts['신규'] : docs.length;

  $('summary').innerHTML =
    '<div class="summary-chip"><div class="n">' + docs.length + '</div><div class="l">전체</div></div>' +
    '<div class="summary-chip"><div class="n">' + counts['신규'] + '</div><div class="l">신규</div></div>';

  var shown = activeFilter === 'all' ? docs : docs.filter(function (d) { return d.status === activeFilter; });
  if (shown.length === 0) {
    $('list').innerHTML = '';
    $('empty').style.display = 'block';
    return;
  }
  $('empty').style.display = 'none';

  $('list').innerHTML = shown.map(function (d) {
    var cls = STATUS_CLASS[d.status] || 'new';
    var telHref = d.contact ? 'tel:' + d.contact.replace(/[^0-9+]/g, '') : '';
    return (
      '<div class="row" data-id="' + esc(d.id) + '">' +
        '<div class="row-top">' +
          '<div class="row-meta">' +
            '<button class="badge ' + cls + '" data-action="cycle">' + esc(d.status) + '</button>' +
            '<span class="row-date">' + fmtDate(d.createdAt) + '</span>' +
          '</div>' +
          '<button class="row-del" data-action="delete" aria-label="삭제"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7"/></svg></button>' +
        '</div>' +
        '<div class="row-body">' +
          '<div class="row-field"><div class="k">지역</div><div class="v">' + (d.region ? esc(d.region) : '—') + '</div></div>' +
          '<div class="row-field"><div class="k">연락처</div><div class="v mono">' + (d.contact ? '<a href="' + esc(telHref) + '">' + esc(d.contact) + '</a>' : '—') + '</div></div>' +
        '</div>' +
        (d.message ? '<div class="row-message"><div class="k">문의사항</div><div class="v">' + esc(d.message) + '</div></div>' : '') +
        '<div class="row-note"><textarea placeholder="메모 추가..." data-action="note">' + esc(d.note) + '</textarea></div>' +
      '</div>'
    );
  }).join('');
}

$('list').addEventListener('click', function (e) {
  var row = e.target.closest('.row');
  if (!row) return;
  var id = row.getAttribute('data-id');
  if (e.target.closest('[data-action="cycle"]')) {
    var doc = docs.find(function (d) { return String(d.id) === id; });
    if (doc) {
      api('PATCH', '/api/admin/inquiries/' + encodeURIComponent(id), { status: nextStatus(doc.status) })
        .then(loadInquiries).catch(function () {});
    }
  }
  var del = e.target.closest('[data-action="delete"]');
  if (del) {
    if (del.getAttribute('data-armed') === '1') {
      api('DELETE', '/api/admin/inquiries/' + encodeURIComponent(id)).then(loadInquiries).catch(function () {});
    } else {
      var orig = del.innerHTML;
      del.setAttribute('data-armed', '1');
      del.classList.add('armed');
      del.textContent = '한 번 더 누르면 삭제';
      setTimeout(function () {
        del.removeAttribute('data-armed');
        del.classList.remove('armed');
        del.innerHTML = orig;
      }, 3000);
    }
  }
});

$('list').addEventListener('blur', function (e) {
  if (e.target.getAttribute && e.target.getAttribute('data-action') === 'note') {
    var id = e.target.closest('.row').getAttribute('data-id');
    var value = e.target.value;
    var doc = docs.find(function (d) { return String(d.id) === id; });
    if (doc && doc.note === value) return;
    if (doc) doc.note = value;
    api('PATCH', '/api/admin/inquiries/' + encodeURIComponent(id), { note: value }).catch(function () {});
  }
}, true);

/* ---------- service areas ---------- */

function loadAreas() {
  return api('GET', '/api/admin/areas').then(function (j) {
    activeAreas = j.active || [];
    renderAreas();
  });
}

function buildAreasList() {
  $('areasList').innerHTML = GU_NAMES.map(function (n) {
    return '<button type="button" class="switch-row" role="switch" aria-checked="false" data-name="' + n + '">' +
      '<span class="nm">' + n + '</span><span class="sw"><i></i></span></button>';
  }).join('');
}

function renderSyncInfo() {
  var b = $('syncBanner');
  b.className = 'sync-banner info';
  b.innerHTML = '켜고 끄면 홈 사이트에 바로 반영돼요 · <a href="/" target="_blank" rel="noopener">홈에서 확인</a>';
}

function flashSaved() {
  var b = $('syncBanner');
  b.className = 'sync-banner ok';
  b.innerHTML = '✓ 저장했어요. 홈 사이트에 반영되었습니다 · <a href="/" target="_blank" rel="noopener">홈에서 확인</a>';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(renderSyncInfo, 4000);
}

function saveAreas(names) {
  var ordered = GU_NAMES.filter(function (n) { return names.indexOf(n) > -1; });
  activeAreas = ordered;
  renderAreas();
  api('PUT', '/api/admin/areas', { active: ordered }).then(function (j) {
    activeAreas = j.active || ordered;
    renderAreas();
    flashSaved();
  }).catch(function () { loadAreas().catch(function () {}); });
}

function toggleArea(name) {
  var cur = activeAreas.slice();
  var i = cur.indexOf(name);
  if (i > -1) cur.splice(i, 1); else cur.push(name);
  saveAreas(cur);
}

$('areasList').addEventListener('click', function (e) {
  var r = e.target.closest('.switch-row');
  if (r) toggleArea(r.getAttribute('data-name'));
});
$('areasMap').addEventListener('click', function (e) {
  var g = e.target.closest('.gu');
  if (g) toggleArea(g.getAttribute('data-name'));
});
$('areasMap').addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gu')) {
    e.preventDefault();
    toggleArea(e.target.getAttribute('data-name'));
  }
});
$('allOn').addEventListener('click', function () { saveAreas(GU_NAMES.slice()); });
$('allOff').addEventListener('click', function () {
  armOrRun($('allOff'), '전체 끄기', '한 번 더 누르면 모두 꺼요', function () { saveAreas([]); });
});

function renderAreas() {
  var on = {};
  activeAreas.forEach(function (n) { on[n] = true; });

  $('areasCount').textContent = '서비스 가능 ' + activeAreas.length + ' / ' + GU_NAMES.length + '개 구';
  $('menu-areas').textContent = activeAreas.length + '/' + GU_NAMES.length;

  document.querySelectorAll('#areasList .switch-row').forEach(function (r) {
    var isOn = !!on[r.getAttribute('data-name')];
    r.classList.toggle('on', isOn);
    r.setAttribute('aria-checked', isOn ? 'true' : 'false');
  });
  document.querySelectorAll('#areasMap .gu').forEach(function (g) {
    g.classList.toggle('on', !!on[g.getAttribute('data-name')]);
  });
}

/* ---------- per-district content ---------- */

var CE_FIELDS = ['intro', 'headline', 'body', 'description'];

function loadContent() {
  return api('GET', '/api/admin/area-content').then(function (j) {
    contentItems = j.items || [];
    translatorName = j.translator || '';
    contentLoaded = true;
    if (!contentSel && contentItems.length) {
      var firstLive = contentItems.find(function (i) { return i.active; });
      contentSel = (firstLive || contentItems[0]).slug;
    }
    renderContentList();
    renderEditor();
  });
}

function writtenCount() {
  return contentItems.filter(function (i) { return i.custom; }).length;
}

function renderContentList() {
  $('menu-content').textContent = writtenCount() + '/' + (contentItems.length || GU_NAMES.length);
  $('contentList').innerHTML = contentItems.map(function (i) {
    return '<button type="button" class="content-item' + (i.slug === contentSel ? ' selected' : '') + '" data-slug="' + esc(i.slug) + '" role="tab" aria-selected="' + (i.slug === contentSel) + '">' +
      '<span>' + esc(i.name) + '</span><span class="tags">' +
      (i.custom ? '<span class="tag-written">작성</span>' : '') +
      (i.active ? '<span class="dot-live" title="서비스 중"></span>' : '') +
      '</span></button>';
  }).join('');
}

function currentItem() {
  return contentItems.find(function (i) { return i.slug === contentSel; });
}

function readEditor() {
  var out = {};
  CE_FIELDS.forEach(function (f) { var el = $('ce-' + f); out[f] = el ? el.value : ''; });
  return out;
}

function draftKey(item) { return item.slug; }

function savedValues(item) {
  var c = item.custom || {};
  return { intro: c.intro || '', headline: c.headline || '', body: c.body || '', description: c.description || '' };
}

var TRANSLATOR_LABEL = { deepl: 'DeepL', google: 'Google 번역', anthropic: 'Claude', mymemory: '무료 번역(MyMemory)' };

function englishPreview(item) {
  var en = item.english;
  var has = en && (en.intro || en.headline || en.body || en.description);
  if (!has) return '<div class="ce-en-empty">저장하면 영어 사이트용 번역이 자동으로 만들어져요.</div>';
  var rows = [['소개 문단', en.intro], ['강조 문구', en.headline], ['추가 안내', en.body], ['검색 결과 설명', en.description]]
    .filter(function (r) { return r[1]; })
    .map(function (r) { return '<div class="ce-en-row"><div class="k">' + r[0] + '</div><div class="v">' + esc(r[1]) + '</div></div>'; })
    .join('');
  return rows;
}

function renderEditor() {
  var item = currentItem();
  if (!item) { $('contentEditor').innerHTML = ''; return; }
  var vals = drafts[draftKey(item)] || savedValues(item);
  var d = item.defaults;
  $('contentEditor').innerHTML =
    '<div class="ce-head"><h3>' + esc(item.name) + '</h3>' +
      '<span class="ce-pill ' + (item.active ? 'live' : 'off') + '">' + (item.active ? '서비스 중' : '준비 중') + '</span>' +
      (item.active ? '<a href="/area/' + esc(item.slug) + '" target="_blank" rel="noopener">상세 페이지 보기</a>' : '') +
    '</div>' +
    '<div class="field"><label for="ce-intro">소개 문단<span class="ce-hint">홈 카드와 상세 페이지 맨 위에 나와요</span></label>' +
      '<textarea id="ce-intro" rows="4" maxlength="1200" placeholder="' + esc(d.intro) + '">' + esc(vals.intro) + '</textarea></div>' +
    '<div class="field"><label for="ce-headline">강조 문구<span class="ce-hint">파란색으로 눈에 띄게 나와요</span></label>' +
      '<textarea id="ce-headline" rows="2" maxlength="240" placeholder="' + esc(d.headline) + '">' + esc(vals.headline) + '</textarea></div>' +
    '<div class="field"><label for="ce-body">추가 안내<span class="ce-hint">상세 페이지에만 나와요 · 빈 줄을 넣으면 문단이 나뉘어요</span></label>' +
      '<textarea id="ce-body" rows="9" maxlength="6000" placeholder="예) 이 지역에서 자주 받는 문의, 작업 사례, 출장 방식, 안내 사항 등을 자유롭게 적어 주세요.">' + esc(vals.body) + '</textarea></div>' +
    '<div class="field"><label for="ce-description">검색 결과 설명<span class="ce-count" id="ce-desc-count"></span><span class="ce-hint">구글 검색 결과에 나오는 문장 · 120자 안팎 권장</span></label>' +
      '<textarea id="ce-description" rows="2" maxlength="240" placeholder="' + esc(d.description) + '">' + esc(vals.description) + '</textarea></div>' +
    '<div class="ce-actions">' +
      '<button type="button" class="btn-ghost" id="ce-load">자동 문구 불러오기</button>' +
      '<button type="button" class="btn-ghost" id="ce-reset">기본 문구로 되돌리기</button>' +
      '<span class="spacer"></span><span class="ce-saved" id="ce-saved"></span>' +
      '<button type="button" class="btn-primary" id="ce-save">저장</button>' +
    '</div>' +
    '<div class="ce-note">비워 둔 칸은 자동 문구가 그대로 쓰여요. 서비스 중인 구만 홈과 상세 페이지에 나옵니다.<br>' +
      '저장하면 영어 사이트(English)에는 이 글이 <b>자동으로 번역</b>되어 나와요' + (translatorName ? ' · 번역: ' + esc(TRANSLATOR_LABEL[translatorName] || translatorName) : '') + '.</div>' +
    '<details class="ce-en"><summary>영어로 자동 번역된 내용 보기 (읽기 전용)</summary>' + englishPreview(item) +
      (item.active ? '<a class="ce-en-link" href="/en/area/' + esc(item.slug) + '" target="_blank" rel="noopener">영어 상세 페이지 보기</a>' : '') + '</details>';
  updateDescCount();
}

function updateDescCount() {
  var el = $('ce-description');
  if (el) $('ce-desc-count').textContent = el.value.length + '자';
}

$('contentList').addEventListener('click', function (e) {
  var b = e.target.closest('.content-item');
  if (!b) return;
  var cur = currentItem();
  if (cur && $('ce-intro')) drafts[draftKey(cur)] = readEditor();
  contentSel = b.getAttribute('data-slug');
  renderContentList();
  renderEditor();
});

$('contentEditor').addEventListener('input', function () {
  var cur = currentItem();
  if (cur) drafts[draftKey(cur)] = readEditor();
  updateDescCount();
  var s = $('ce-saved');
  if (s) s.textContent = '';
});

function saveContent(values, done) {
  var item = currentItem();
  if (!item) return;
  var saveBtn = $('ce-save');
  var msg = $('ce-saved');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장·번역 중…'; }
  if (msg) { msg.style.color = ''; msg.textContent = ''; }
  api('PUT', '/api/admin/area-content/' + encodeURIComponent(item.slug), values).then(function (j) {
    item.custom = j.custom;
    item.english = j.english;
    delete drafts[draftKey(item)];
    renderContentList();
    renderEditor();
    var s = $('ce-saved');
    if (!s) return;
    var t = j.translation || {};
    if (t.status === 'failed') {
      s.style.color = '#b45309';
      s.textContent = '저장했어요 · 영어 번역은 실패했어요 (다시 저장하면 재시도해요)';
    } else {
      s.textContent = done || (t.status === 'ok' ? '✓ 저장했어요 · 영어 번역도 완료' : '✓ 저장했어요');
    }
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { var x = $('ce-saved'); if (x) x.textContent = ''; }, 6000);
  }).catch(function () {
    var s = $('ce-saved');
    if (s) { s.style.color = 'var(--danger)'; s.textContent = '저장하지 못했어요. 다시 시도해 주세요.'; }
    var b = $('ce-save');
    if (b) { b.disabled = false; b.textContent = '저장'; }
  });
}

$('contentEditor').addEventListener('click', function (e) {
  var item = currentItem();
  if (!item) return;
  if (e.target.closest('#ce-save')) {
    saveContent(readEditor());
  } else if (e.target.closest('#ce-load')) {
    ['intro', 'headline', 'description'].forEach(function (f) {
      var el = $('ce-' + f);
      if (el && !el.value.trim()) el.value = item.defaults[f];
    });
    drafts[draftKey(item)] = readEditor();
    updateDescCount();
  } else if (e.target.closest('#ce-reset')) {
    var btn = $('ce-reset');
    armOrRun(btn, '기본 문구로 되돌리기', '한 번 더 누르면 작성한 내용이 지워져요', function () {
      saveContent({ intro: '', headline: '', body: '', description: '' }, '✓ 기본 문구로 되돌렸어요');
    });
  }
});

/* ---------- work reviews ---------- */

var SERVICE_OPTIONS = [['', '선택 안 함'], ['install', '도어락 설치·교체'], ['key', '열쇠 제작·복사'], ['repair', '잠금장치 수리'], ['unlock', '잠금 해제'], ['other', '기타']];
var MAX_PHOTOS = 12;

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function loadReviews() {
  return api('GET', '/api/admin/reviews').then(function (j) {
    reviews = j.items || [];
    rvLoaded = true;
    if (rvSel === null && reviews.length) rvSel = reviews[0].id;
    renderRvList();
    renderRvEditor();
  });
}

function rvDraftFor(id) {
  if (rvDrafts[id]) return rvDrafts[id];
  if (id === 'new') return { title: '', body: '', region: '', service: '', postedAt: todayStr(), published: true, photos: [] };
  var item = reviews.find(function (r) { return r.id === id; });
  if (!item) return { title: '', body: '', region: '', service: '', postedAt: todayStr(), published: true, photos: [] };
  return { title: item.title, body: item.body, region: item.region, service: item.service, postedAt: item.postedAt, published: item.published, photos: item.photos.slice() };
}

function renderRvList() {
  $('menu-reviews').textContent = reviews.length;
  var rows = [];
  if (rvSel === 'new') rows.push('<button type="button" class="rv-item selected" data-id="new"><span class="th"></span><span class="tx"><div class="t">새 후기</div><div class="d">작성 중</div></span></button>');
  reviews.forEach(function (r) {
    rows.push('<button type="button" class="rv-item' + (r.id === rvSel ? ' selected' : '') + '" data-id="' + r.id + '">' +
      '<span class="th">' + (r.photos[0] ? '<img src="/uploads/' + esc(r.photos[0]) + '" alt="">' : '') + '</span>' +
      '<span class="tx"><div class="t">' + esc(r.title) + '</div><div class="d">' + esc(r.postedAt) + (r.published ? '' : ' · <span class="off">비공개</span>') + '</div></span></button>');
  });
  $('rvList').innerHTML = rows.length ? rows.join('') : '<div class="rv-empty-list">아직 작성한 후기가 없어요. “새 후기 쓰기”를 눌러 시작하세요.</div>';
}

function renderPhotos() {
  var d = rvDraftFor(rvSel);
  var html = d.photos.map(function (f, i) {
    return '<div class="rv-ph" data-f="' + esc(f) + '"><img src="/uploads/' + esc(f) + '" alt="">' +
      (i === 0 ? '<span class="main">대표</span>' : '') +
      '<div class="ctl"><button type="button" data-act="left" aria-label="앞으로">←</button><button type="button" data-act="del" aria-label="삭제">✕</button><button type="button" data-act="right" aria-label="뒤로">→</button></div></div>';
  }).join('');
  if (d.photos.length < MAX_PHOTOS) html += '<label class="rv-add">+ 사진<br>추가<input type="file" id="rv-file" accept="image/*" multiple hidden></label>';
  $('rv-photos').innerHTML = html;
}

function renderRvEditor() {
  if (rvSel === null) {
    $('rvEditor').innerHTML = '<div class="rv-empty-list">왼쪽에서 후기를 고르거나 “새 후기 쓰기”를 눌러 주세요.</div>';
    return;
  }
  var d = rvDraftFor(rvSel);
  var isNew = rvSel === 'new';
  var svc = SERVICE_OPTIONS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === d.service ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  var gus = '<option value="">선택 안 함</option>' + GU_NAMES.map(function (n) { return '<option value="' + n + '"' + (n === d.region ? ' selected' : '') + '>' + n + '</option>'; }).join('');
  $('rvEditor').innerHTML =
    '<div class="ce-head"><h3>' + (isNew ? '새 작업 후기' : '작업 후기 수정') + '</h3>' +
      (!isNew && d.published ? '<a href="/reviews/' + rvSel + '" target="_blank" rel="noopener">홈페이지에서 보기</a>' : '') + '</div>' +
    '<div class="field"><label for="rv-title">제목</label><input id="rv-title" type="text" maxlength="120" value="' + esc(d.title) + '" placeholder="예) 강남구 역삼동 아파트 디지털 도어락 교체"></div>' +
    '<div class="field-row"><div class="field"><label for="rv-date">작업 날짜</label><input id="rv-date" type="date" value="' + esc(d.postedAt) + '"></div>' +
      '<div class="field"><label for="rv-service">작업 종류</label><select id="rv-service">' + svc + '</select></div></div>' +
    '<div class="field"><label for="rv-region">지역 (구)</label><select id="rv-region">' + gus + '</select></div>' +
    '<div class="field"><label for="rv-body">내용</label><textarea id="rv-body" rows="9" maxlength="8000" placeholder="어떤 상황이었고 어떻게 해결했는지 적어 주세요. 빈 줄을 넣으면 문단이 나뉘어요.">' + esc(d.body) + '</textarea></div>' +
    '<div class="field"><label>사진<span class="ce-hint">최대 12장 · 첫 번째 사진이 대표 사진이에요 · 올릴 때 자동으로 줄여서 저장돼요</span></label><div class="rv-photos" id="rv-photos"></div><div class="ce-note" id="rv-upmsg" style="margin-top:8px"></div></div>' +
    '<label class="rv-pub"><input type="checkbox" id="rv-pub"' + (d.published ? ' checked' : '') + '> 홈페이지에 공개</label>' +
    '<div class="ce-actions">' + (isNew ? '' : '<button type="button" class="btn-ghost" id="rv-del">삭제</button>') +
      '<span class="spacer"></span><span class="ce-saved" id="rv-saved"></span><button type="button" class="btn-primary" id="rv-save">저장</button></div>' +
    '<div class="ce-note">저장하면 영어 사이트에는 제목과 내용이 자동으로 번역되어 나와요. 사진의 위치 정보 등은 올릴 때 제거돼요.</div>';
  renderPhotos();
}

function readRvForm() {
  var d = rvDraftFor(rvSel);
  d.title = $('rv-title').value;
  d.postedAt = $('rv-date').value || todayStr();
  d.service = $('rv-service').value;
  d.region = $('rv-region').value;
  d.body = $('rv-body').value;
  d.published = $('rv-pub').checked;
  rvDrafts[rvSel] = d;
  return d;
}

function selectReview(id) {
  if ($('rv-title')) readRvForm();
  rvSel = id;
  renderRvList();
  renderRvEditor();
}

$('rvNew').addEventListener('click', function () { selectReview('new'); $('rv-title').focus(); });
$('rvList').addEventListener('click', function (e) {
  var b = e.target.closest('.rv-item');
  if (!b) return;
  var id = b.getAttribute('data-id');
  selectReview(id === 'new' ? 'new' : Number(id));
});

$('rvEditor').addEventListener('input', function (e) { if (e.target.id && e.target.id.indexOf('rv-') === 0 && e.target.id !== 'rv-file') readRvForm(); });
$('rvEditor').addEventListener('change', function (e) {
  if (e.target.id === 'rv-pub' || e.target.id === 'rv-service' || e.target.id === 'rv-region' || e.target.id === 'rv-date') { readRvForm(); return; }
  if (e.target.id === 'rv-file') uploadPhotos(Array.prototype.slice.call(e.target.files));
});

function shrink(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * s));
      var h = Math.max(1, Math.round(img.naturalHeight * s));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('encode')); }, 'image/jpeg', 0.82);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

async function uploadPhotos(files) {
  var id = rvSel;
  var d = rvDraftFor(id);
  var msg = $('rv-upmsg');
  var failed = [];
  rvUploading++;
  for (var i = 0; i < files.length; i++) {
    if (d.photos.length >= MAX_PHOTOS) { failed.push('사진은 최대 ' + MAX_PHOTOS + '장까지예요'); break; }
    if (msg && rvSel === id) msg.textContent = '사진 올리는 중… (' + (i + 1) + '/' + files.length + ')';
    try {
      var blob = await shrink(files[i]);
      var r = await fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      if (r.status === 401) { showAuth(); rvUploading--; return; }
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'upload');
      d.photos.push(j.file);
      rvDrafts[id] = d;
      if (rvSel === id) renderPhotos();
    } catch (err) {
      failed.push(files[i].name);
    }
  }
  rvUploading--;
  var m = $('rv-upmsg');
  if (m && rvSel === id) m.textContent = failed.length ? '올리지 못한 사진: ' + failed.join(', ') + ' (JPG·PNG 사진을 사용해 주세요)' : '';
}

$('rvEditor').addEventListener('click', function (e) {
  var ctl = e.target.closest('.rv-ph button');
  if (ctl) {
    var d = readRvForm();
    var f = ctl.closest('.rv-ph').getAttribute('data-f');
    var i = d.photos.indexOf(f);
    var act = ctl.getAttribute('data-act');
    if (act === 'del') d.photos.splice(i, 1);
    if (act === 'left' && i > 0) { d.photos.splice(i, 1); d.photos.splice(i - 1, 0, f); }
    if (act === 'right' && i < d.photos.length - 1) { d.photos.splice(i, 1); d.photos.splice(i + 1, 0, f); }
    rvDrafts[rvSel] = d;
    renderPhotos();
    return;
  }
  if (e.target.closest('#rv-save')) saveReview();
  else if (e.target.closest('#rv-del')) {
    armOrRun($('rv-del'), '삭제', '한 번 더 누르면 삭제돼요', function () {
      api('DELETE', '/api/admin/reviews/' + rvSel).then(function () {
        delete rvDrafts[rvSel];
        rvSel = null;
        return loadReviews();
      }).catch(function () {});
    });
  }
});

function saveReview() {
  var d = readRvForm();
  var msg = $('rv-saved');
  if (rvUploading) { msg.style.color = 'var(--danger)'; msg.textContent = '사진을 올리는 중이에요. 잠시 후 저장해 주세요.'; return; }
  if (!d.title.trim()) { msg.style.color = 'var(--danger)'; msg.textContent = '제목을 입력해 주세요.'; $('rv-title').focus(); return; }
  var btn = $('rv-save');
  btn.disabled = true;
  btn.textContent = '저장·번역 중…';
  msg.style.color = '';
  msg.textContent = '';
  var isNew = rvSel === 'new';
  var payload = { title: d.title, body: d.body, region: d.region, service: d.service, postedAt: d.postedAt, published: d.published, photos: d.photos };
  api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/reviews' : '/api/admin/reviews/' + rvSel, payload).then(function (j) {
    delete rvDrafts[rvSel];
    var oldSel = rvSel;
    rvSel = j.item.id;
    return loadReviews().then(function () {
      var m = $('rv-saved');
      if (m) {
        m.style.color = j.translation && j.translation.failed ? '#b45309' : '';
        m.textContent = j.translation && j.translation.failed ? '저장했어요 · 영어 번역은 실패했어요 (다시 저장하면 재시도해요)' : '✓ 저장했어요';
        setTimeout(function () { var x = $('rv-saved'); if (x) x.textContent = ''; }, 6000);
      }
    });
  }).catch(function (err) {
    var m = $('rv-saved');
    if (m) { m.style.color = 'var(--danger)'; m.textContent = '저장하지 못했어요. ' + (err && err.message ? '' : '다시 시도해 주세요.'); }
    var b = $('rv-save');
    if (b) { b.disabled = false; b.textContent = '저장'; }
  });
}

/* ---------- products ---------- */

var PRODUCT_CATEGORIES = [['', '선택 안 함'], ['lock', '도어락'], ['key', '열쇠·자물쇠'], ['other', '기타']];
var MAX_PRODUCT_PHOTOS = 8;

function loadProducts() {
  return api('GET', '/api/admin/products').then(function (j) {
    products = j.items || [];
    pdLoaded = true;
    if (pdSel === null && products.length) pdSel = products[0].id;
    renderPdList();
    renderPdEditor();
  });
}

function pdBlank() { return { name: '', category: '', price: '', description: '', published: true, photos: [] }; }

function pdDraftFor(id) {
  if (pdDrafts[id]) return pdDrafts[id];
  if (id === 'new') return pdBlank();
  var item = products.find(function (r) { return r.id === id; });
  if (!item) return pdBlank();
  return { name: item.name, category: item.category, price: item.price, description: item.description, published: item.published, photos: item.photos.slice() };
}

function renderPdList() {
  $('menu-products').textContent = products.length;
  var rows = [];
  if (pdSel === 'new') rows.push('<button type="button" class="rv-item selected" data-id="new"><span class="th"></span><span class="tx"><div class="t">새 제품</div><div class="d">작성 중</div></span></button>');
  products.forEach(function (r) {
    rows.push('<button type="button" class="rv-item' + (r.id === pdSel ? ' selected' : '') + '" data-id="' + r.id + '">' +
      '<span class="th">' + (r.photos[0] ? '<img src="/uploads/' + esc(r.photos[0]) + '" alt="">' : '') + '</span>' +
      '<span class="tx"><div class="t">' + esc(r.name) + '</div><div class="d">' + esc(r.price || '가격 미입력') + (r.published ? '' : ' · <span class="off">비공개</span>') + '</div></span></button>');
  });
  $('pdList').innerHTML = rows.length ? rows.join('') : '<div class="rv-empty-list">아직 등록한 제품이 없어요. “새 제품 등록”을 눌러 시작하세요.</div>';
}

function renderPdPhotos() {
  var d = pdDraftFor(pdSel);
  var html = d.photos.map(function (f, i) {
    return '<div class="rv-ph" data-f="' + esc(f) + '"><img src="/uploads/' + esc(f) + '" alt="">' +
      (i === 0 ? '<span class="main">대표</span>' : '') +
      '<div class="ctl"><button type="button" data-act="left" aria-label="앞으로">←</button><button type="button" data-act="del" aria-label="삭제">✕</button><button type="button" data-act="right" aria-label="뒤로">→</button></div></div>';
  }).join('');
  if (d.photos.length < MAX_PRODUCT_PHOTOS) html += '<label class="rv-add">+ 사진<br>추가<input type="file" id="pd-file" accept="image/*" multiple hidden></label>';
  $('pd-photos').innerHTML = html;
}

function renderPdEditor() {
  if (pdSel === null) {
    $('pdEditor').innerHTML = '<div class="rv-empty-list">왼쪽에서 제품을 고르거나 “새 제품 등록”을 눌러 주세요.</div>';
    return;
  }
  var d = pdDraftFor(pdSel);
  var isNew = pdSel === 'new';
  var cats = PRODUCT_CATEGORIES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === d.category ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  $('pdEditor').innerHTML =
    '<div class="ce-head"><h3>' + (isNew ? '새 제품 등록' : '제품 수정') + '</h3>' +
      (!isNew && d.published ? '<a href="/products/' + pdSel + '" target="_blank" rel="noopener">홈페이지에서 보기</a>' : '') + '</div>' +
    '<div class="field"><label for="pd-name">제품 이름</label><input id="pd-name" type="text" maxlength="120" value="' + esc(d.name) + '" placeholder="예) 디지털 도어락 (카드·비밀번호 겸용)"></div>' +
    '<div class="field-row"><div class="field"><label for="pd-category">분류</label><select id="pd-category">' + cats + '</select></div>' +
      '<div class="field"><label for="pd-price">가격<span class="ce-hint">비워 두면 홈페이지에 표시되지 않아요</span></label><input id="pd-price" type="text" maxlength="60" value="' + esc(d.price) + '" placeholder="예) 150,000원"></div></div>' +
    '<div class="field"><label for="pd-desc">설명</label><textarea id="pd-desc" rows="8" maxlength="8000" placeholder="제품 특징, 규격, 설치 가능 여부 등을 적어 주세요. 빈 줄을 넣으면 문단이 나뉘어요.">' + esc(d.description) + '</textarea></div>' +
    '<div class="field"><label>사진<span class="ce-hint">최대 8장 · 첫 번째 사진이 대표 사진이에요 · 올릴 때 자동으로 줄여서 저장돼요</span></label><div class="rv-photos" id="pd-photos"></div><div class="ce-note" id="pd-upmsg" style="margin-top:8px"></div></div>' +
    '<label class="rv-pub"><input type="checkbox" id="pd-pub"' + (d.published ? ' checked' : '') + '> 홈페이지에 공개</label>' +
    '<div class="ce-actions">' + (isNew ? '' : '<button type="button" class="btn-ghost" id="pd-del">삭제</button>') +
      '<span class="spacer"></span><span class="ce-saved" id="pd-saved"></span><button type="button" class="btn-primary" id="pd-save">저장</button></div>' +
    '<div class="ce-note">저장하면 영어 사이트에는 이름·가격·설명이 자동으로 번역되어 나와요. 사진의 위치 정보 등은 올릴 때 제거돼요.</div>';
  renderPdPhotos();
}

function readPdForm() {
  var d = pdDraftFor(pdSel);
  d.name = $('pd-name').value;
  d.category = $('pd-category').value;
  d.price = $('pd-price').value;
  d.description = $('pd-desc').value;
  d.published = $('pd-pub').checked;
  pdDrafts[pdSel] = d;
  return d;
}

function selectProduct(id) {
  if ($('pd-name')) readPdForm();
  pdSel = id;
  renderPdList();
  renderPdEditor();
}

$('pdNew').addEventListener('click', function () { selectProduct('new'); $('pd-name').focus(); });
$('pdList').addEventListener('click', function (e) {
  var b = e.target.closest('.rv-item');
  if (!b) return;
  var id = b.getAttribute('data-id');
  selectProduct(id === 'new' ? 'new' : Number(id));
});

$('pdEditor').addEventListener('input', function (e) { if (e.target.id && e.target.id.indexOf('pd-') === 0 && e.target.id !== 'pd-file') readPdForm(); });
$('pdEditor').addEventListener('change', function (e) {
  if (e.target.id === 'pd-pub' || e.target.id === 'pd-category') { readPdForm(); return; }
  if (e.target.id === 'pd-file') uploadProductPhotos(Array.prototype.slice.call(e.target.files));
});

async function uploadProductPhotos(files) {
  var id = pdSel;
  var d = pdDraftFor(id);
  var msg = $('pd-upmsg');
  var failed = [];
  pdUploading++;
  for (var i = 0; i < files.length; i++) {
    if (d.photos.length >= MAX_PRODUCT_PHOTOS) { failed.push('사진은 최대 ' + MAX_PRODUCT_PHOTOS + '장까지예요'); break; }
    if (msg && pdSel === id) msg.textContent = '사진 올리는 중… (' + (i + 1) + '/' + files.length + ')';
    try {
      var blob = await shrink(files[i]);
      var r = await fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      if (r.status === 401) { showAuth(); pdUploading--; return; }
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'upload');
      d.photos.push(j.file);
      pdDrafts[id] = d;
      if (pdSel === id) renderPdPhotos();
    } catch (err) {
      failed.push(files[i].name);
    }
  }
  pdUploading--;
  var m = $('pd-upmsg');
  if (m && pdSel === id) m.textContent = failed.length ? '올리지 못한 사진: ' + failed.join(', ') + ' (JPG·PNG 사진을 사용해 주세요)' : '';
}

$('pdEditor').addEventListener('click', function (e) {
  var ctl = e.target.closest('.rv-ph button');
  if (ctl) {
    var d = readPdForm();
    var f = ctl.closest('.rv-ph').getAttribute('data-f');
    var i = d.photos.indexOf(f);
    var act = ctl.getAttribute('data-act');
    if (act === 'del') d.photos.splice(i, 1);
    if (act === 'left' && i > 0) { d.photos.splice(i, 1); d.photos.splice(i - 1, 0, f); }
    if (act === 'right' && i < d.photos.length - 1) { d.photos.splice(i, 1); d.photos.splice(i + 1, 0, f); }
    pdDrafts[pdSel] = d;
    renderPdPhotos();
    return;
  }
  if (e.target.closest('#pd-save')) saveProduct();
  else if (e.target.closest('#pd-del')) {
    armOrRun($('pd-del'), '삭제', '한 번 더 누르면 삭제돼요', function () {
      api('DELETE', '/api/admin/products/' + pdSel).then(function () {
        delete pdDrafts[pdSel];
        pdSel = null;
        return loadProducts();
      }).catch(function () {});
    });
  }
});

function saveProduct() {
  var d = readPdForm();
  var msg = $('pd-saved');
  if (pdUploading) { msg.style.color = 'var(--danger)'; msg.textContent = '사진을 올리는 중이에요. 잠시 후 저장해 주세요.'; return; }
  if (!d.name.trim()) { msg.style.color = 'var(--danger)'; msg.textContent = '제품 이름을 입력해 주세요.'; $('pd-name').focus(); return; }
  var btn = $('pd-save');
  btn.disabled = true;
  btn.textContent = '저장·번역 중…';
  msg.style.color = '';
  msg.textContent = '';
  var isNew = pdSel === 'new';
  var payload = { name: d.name, category: d.category, price: d.price, description: d.description, published: d.published, photos: d.photos };
  api(isNew ? 'POST' : 'PUT', isNew ? '/api/admin/products' : '/api/admin/products/' + pdSel, payload).then(function (j) {
    delete pdDrafts[pdSel];
    pdSel = j.item.id;
    return loadProducts().then(function () {
      var m = $('pd-saved');
      if (m) {
        m.style.color = j.translation && j.translation.failed ? '#b45309' : '';
        m.textContent = j.translation && j.translation.failed ? '저장했어요 · 영어 번역은 실패했어요 (다시 저장하면 재시도해요)' : '✓ 저장했어요';
        setTimeout(function () { var x = $('pd-saved'); if (x) x.textContent = ''; }, 6000);
      }
    });
  }).catch(function (err) {
    var m = $('pd-saved');
    if (m) { m.style.color = 'var(--danger)'; m.textContent = '저장하지 못했어요. ' + (err && err.message ? '' : '다시 시도해 주세요.'); }
    var b = $('pd-save');
    if (b) { b.disabled = false; b.textContent = '저장'; }
  });
}

/* ---------- site settings ---------- */

function loadSite() {
  return api('GET', '/api/admin/site').then(function (j) {
    siteData = j;
    siteLoaded = true;
    renderSite();
  });
}

function stField(id, label, value, placeholder, hint, max) {
  return '<div class="field"><label for="' + id + '">' + label + (hint ? '<span class="ce-hint">' + hint + '</span>' : '') + '</label>' +
    '<input id="' + id + '" type="text" maxlength="' + (max || 200) + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '"></div>';
}

function stCheck(id, label, checked) {
  return '<label class="st-check"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + label + '</label>';
}

function renderSite() {
  var c = siteData.config;
  var d = siteData.defaults;
  $('siteEditor').innerHTML =
    '<div class="st-sec"><h3>첫 화면 배너</h3><div class="st-sub">홈 맨 위 큰 제목과 설명이에요. 첫 줄은 파란색으로 나와요.</div>' +
      stField('st-l1', '제목 첫 줄 (파란색)', c.hero.l1, d.hero.l1, '', 40) +
      stField('st-l2', '제목 둘째 줄', c.hero.l2, d.hero.l2, '', 40) +
      stField('st-sub', '설명', c.hero.sub, d.hero.sub, '', 160) + '</div>' +
    '<div class="st-sec"><h3>연락처</h3><div class="st-sub">전화 버튼, 하단 고정 버튼, 푸터에 모두 반영돼요.</div>' +
      '<div class="field-row">' + stField('st-phone', '전화번호', c.phone, d.phone, '숫자와 - 만', 20) +
      stField('st-hours', '영업시간 문구', c.hours, d.hours, '', 60) + '</div></div>' +
    '<div class="st-sec"><h3>사업자 정보</h3><div class="st-sub">푸터와 연락처 영역에 나와요.</div>' +
      '<div class="field-row">' + stField('st-biz', '상표명', c.bizName, d.bizName, '', 80) +
      stField('st-owner', '대표자', c.owner, d.owner, '', 40) + '</div></div>' +
    '<div class="st-sec"><h3>채널 링크</h3><div class="st-sub">https:// 로 시작하는 주소만 저장돼요.</div>' +
      stField('st-naver', '네이버 플레이스', c.links.naver, d.links.naver, '', 300) +
      stField('st-daangn', '당근', c.links.daangn, d.links.daangn, '', 300) +
      stField('st-google', '구글 지도', c.links.google, d.links.google, '', 300) + '</div>' +
    '<div class="st-sec"><h3>화면 표시</h3>' +
      stCheck('st-show-products', '홈에 제품 구역 보이기', c.show.products) +
      stCheck('st-show-reviews', '홈에 작업 후기 구역 보이기', c.show.reviews) +
      stCheck('st-show-dock', '화면 아래 고정 연락 버튼(전화 상담 / 문의하기) 보이기', c.show.dock) + '</div>' +
    '<div class="ce-actions"><span class="spacer"></span><span class="ce-saved" id="st-saved"></span><button type="button" class="btn-primary" id="st-save">저장</button></div>' +
    '<div class="ce-note">저장하면 영어 사이트의 제목·설명·영업시간은 자동으로 번역돼요. 칸을 비우고 저장하면 기본 문구로 돌아가요.</div>';
}

function readSiteForm() {
  return {
    phone: $('st-phone').value, hours: $('st-hours').value, bizName: $('st-biz').value, owner: $('st-owner').value,
    links: { naver: $('st-naver').value, daangn: $('st-daangn').value, google: $('st-google').value },
    hero: { l1: $('st-l1').value, l2: $('st-l2').value, sub: $('st-sub').value },
    show: { products: $('st-show-products').checked, reviews: $('st-show-reviews').checked, dock: $('st-show-dock').checked },
  };
}

$('siteEditor').addEventListener('click', function (e) {
  if (!e.target.closest('#st-save')) return;
  var btn = $('st-save');
  var msg = $('st-saved');
  btn.disabled = true;
  btn.textContent = '저장·번역 중…';
  msg.style.color = '';
  msg.textContent = '';
  api('PUT', '/api/admin/site', readSiteForm()).then(function (j) {
    siteData.config = j.config;
    renderSite();
    var m = $('st-saved');
    m.style.color = j.translation && j.translation.failed ? '#b45309' : '';
    m.textContent = j.translation && j.translation.failed ? '저장했어요 · 영어 번역은 실패했어요 (다시 저장하면 재시도해요)' : '✓ 저장했어요';
    setTimeout(function () { var x = $('st-saved'); if (x) x.textContent = ''; }, 6000);
  }).catch(function (err) {
    var m = $('st-saved');
    if (m) { m.style.color = 'var(--danger)'; m.textContent = (err && err.message) || '저장하지 못했어요. 다시 시도해 주세요.'; }
    var b = $('st-save');
    if (b) { b.disabled = false; b.textContent = '저장'; }
  });
});

/* ---------- start ---------- */

buildAreasList();
fetch('/api/admin/me', { credentials: 'same-origin' }).then(function (r) {
  if (r.ok) enterApp(); else showAuth();
}).catch(function () { showAuth('서버에 연결할 수 없어요.'); });
