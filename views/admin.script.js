var GU_NAMES = @@GU_NAMES@@;
var STATUS_CLASS = { '신규': 'new', '연락함': 'contacted', '완료': 'done' };
var STATUS_ORDER = ['신규', '연락함', '완료'];

var docs = [];
var activeFilter = 'all';
var currentView = 'inquiries';
var activeAreas = [];
var pollTimer = null;
var savedTimer = null;

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

/* ---------- start ---------- */

buildAreasList();
fetch('/api/admin/me', { credentials: 'same-origin' }).then(function (r) {
  if (r.ok) enterApp(); else showAuth();
}).catch(function () { showAuth('서버에 연결할 수 없어요.'); });
