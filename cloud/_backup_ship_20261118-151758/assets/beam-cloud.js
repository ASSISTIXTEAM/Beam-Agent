/* Beam Agent cloud — phone-first UI + durable cloud sessions */
(function () {
  'use strict';

  var A = window.ACX || {};
  var API = A.API || null;

  var state = {
    boot: null,
    model: 'TIDE',
    mode: 'agent',
    web: false,
    conversationId: 0,
    messages: [],
    sessions: [],
    projects: [],
    projectFilter: null,
    streaming: false,
    attachments: [],
    streamHandle: null,
    tab: 'chat',
    cloudSession: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  function modelClass(key) {
    var k = String(key || '').toLowerCase();
    if (k === 'flair') return 'flare';
    return k || 'tide';
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function isMobile() {
    return window.matchMedia('(max-width: 960px)').matches;
  }

  function setAppState(s) {
    var app = $('app');
    if (app) app.setAttribute('data-state', s);
  }

  function currentProject() {
    if (!state.projectFilter) return null;
    return state.projects.find(function (p) { return p.id === state.projectFilter; }) || null;
  }

  function updateProjectChip() {
    var label = $('projectChipLabel');
    if (!label) return;
    var p = currentProject();
    label.textContent = p ? p.name : 'All';
  }

  function updateCloudBar(info) {
    if (info) state.cloudSession = info;
    var bar = $('cloudBar');
    var text = $('cloudBarText');
    var cardLabel = $('cloudSessionLabel');
    var cs = state.cloudSession;
    var proj = currentProject();
    var label = proj
      ? ('Cloud · ' + proj.name)
      : (cs && cs.ws_key ? ('Cloud · ' + cs.ws_key) : 'Cloud workspace · durable');
    if (cs && cs.path_label) label += ' · ' + cs.path_label;
    if (text) text.textContent = label;
    if (cardLabel) {
      cardLabel.textContent = proj
        ? ('Project workspace «' + proj.name + '» — files persist across agent runs')
        : 'Personal cloud workspace — files persist on server across sessions';
    }
    if (bar) show(bar, true);
  }

  function setTab(tab) {
    state.tab = tab || 'chat';
    var app = $('app');
    var shell = $('shell');
    if (app) app.setAttribute('data-tab', state.tab);

    document.querySelectorAll('#bottomNav .ba-nav-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === state.tab);
    });

    if (!shell) return;

    shell.classList.remove('side-open');
    show($('sideScrim'), false);
    show($('projectMenu'), false);

    if (state.tab === 'process') {
      show($('processPanel'), true);
      shell.classList.add('process-open', 'is-process');
      refreshProcess();
    } else if (isMobile()) {
      show($('processPanel'), false);
      shell.classList.remove('process-open', 'is-process');
    }

    if (state.tab === 'limits') {
      renderLimits($('limitsBodyMobile'));
      show($('panelLimits'), true);
    } else {
      show($('panelLimits'), false);
    }

    if (state.tab === 'profile') {
      renderProfile($('profileBodyMobile'));
      show($('panelProfile'), true);
    } else {
      show($('panelProfile'), false);
    }
  }

  function openModal(id) { show($(id), true); }
  function closeModal(id) { show($(id), false); }

  function fetchJson(url, opts) {
    opts = opts || {};
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts)).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var err = new Error((j && j.error) || ('HTTP ' + r.status));
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j;
      }).catch(function (e) {
        if (e.status) throw e;
        var err = new Error('bad_json');
        err.status = r.status;
        throw err;
      });
    });
  }

  function ensureApi() {
    if (API && API.bootstrap && API.chatStream) return true;
    API = {
      bootstrap: function () { return fetchJson('/api/bootstrap.php'); },
      history: function (params) {
        var q = new URLSearchParams(params || {}).toString();
        return fetchJson('/api/chat.php' + (q ? '?' + q : ''));
      },
      chatPost: function (body) {
        return fetchJson('/api/chat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      },
      chatStream: (A.API && A.API.chatStream) || null,
      upload: (A.API && A.API.upload) || null
    };
    if (window.ACX && window.ACX.API) {
      API = window.ACX.API;
    }
    return !!API.bootstrap;
  }

  function renderGate(loginUrl) {
    show($('authGate'), true);
    show($('shell'), false);
    setAppState('gate');
    var btn = $('loginBtn');
    if (btn && loginUrl) btn.href = loginUrl;
  }

  function renderShell() {
    show($('authGate'), false);
    show($('shell'), true);
    setAppState('app');
    var d = state.boot || {};
    var u = d.user || {};
    if ($('userName')) $('userName').textContent = u.display_name || 'ASSISTIX';
    if ($('userEmail')) $('userEmail').textContent = u.email || '';
    if ($('userAv')) $('userAv').textContent = initials(u.display_name || u.email || 'A');
    renderModels();
    renderUsageMini();
    updateModeChips();
    updateProjectChip();
    updateCloudBar(null);
    setTab(state.tab || 'chat');
  }

  function renderModels() {
    var models = (state.boot && state.boot.models) || [];
    var menu = $('modelMenu');
    var btn = $('modelBtn');
    if (!menu || !btn) return;
    if (!models.length) {
      models = [
        { key: 'TIDE', name: 'Tide' },
        { key: 'FLARE', name: 'Flare' },
        { key: 'PINE', name: 'Pine' }
      ];
    }
    var cur = models.find(function (m) { return m.key === state.model; }) || models[0];
    state.model = cur.key;
    btn.textContent = cur.name;
    menu.innerHTML = models.map(function (m) {
      return '<button type="button" role="option" data-model="' + esc(m.key) + '">' +
        '<span class="ba-dot ' + esc(modelClass(m.key)) + '"></span> ' + esc(m.name) +
        (m.description ? '<div style="color:var(--ba-muted);font-size:11px;margin-top:2px">' + esc(m.description) + '</div>' : '') +
        '</button>';
    }).join('');
    menu.querySelectorAll('[data-model]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.model = b.getAttribute('data-model');
        show(menu, false);
        renderModels();
      });
    });
  }

  function usagePct(used, cap) {
    if (!cap || cap <= 0) return 0;
    return Math.min(100, Math.round((used / cap) * 100));
  }

  function renderUsageMini() {
    var u = (state.boot && state.boot.usage) || {};
    var tide = u.tide || {};
    var flare = u.flare || u.flair || {};
    var pine = u.pine || {};
    var t = usagePct(tide.tokens_used, tide.tokens_cap);
    var f = usagePct(flare.tokens_used, flare.tokens_cap);
    var p = usagePct(pine.requests_used != null ? pine.requests_used : pine.tokens_used, pine.requests_cap || pine.tokens_cap);
    var el = $('usageMini');
    if (el) el.textContent = 'Tide ' + t + '% · Flare ' + f + '% · Pine ' + p + '%';
  }

  function limitsHtml() {
    var u = (state.boot && state.boot.usage) || {};
    var rows = [
      { id: 'Tide', color: 'var(--ba-tide)', used: (u.tide || {}).tokens_used || 0, cap: (u.tide || {}).tokens_cap, unit: 'tok' },
      { id: 'Flare', color: 'var(--ba-flare)', used: (u.flare || u.flair || {}).tokens_used || 0, cap: (u.flare || u.flair || {}).tokens_cap, unit: 'tok' },
      { id: 'Pine', color: 'var(--ba-pine)', used: (u.pine || {}).requests_used != null ? (u.pine || {}).requests_used : ((u.pine || {}).tokens_used || 0), cap: (u.pine || {}).requests_cap || (u.pine || {}).tokens_cap, unit: 'req' }
    ];
    return rows.map(function (r) {
      var pct = usagePct(r.used, r.cap);
      var capLabel = r.cap == null ? '∞' : fmtNum(r.cap);
      return '<div class="ba-limit-card">' +
        '<div class="ba-ring" style="border-color:' + r.color + '">' + pct + '%</div>' +
        '<div><p class="ba-limit-name">' + esc(r.id) + '</p>' +
        '<div class="ba-limit-row"><span>Неделя</span><span>' + fmtNum(r.used) + ' / ' + capLabel + ' ' + r.unit + '</span></div>' +
        '<div class="ba-bar"><span style="width:' + pct + '%;background:' + r.color + '"></span></div></div></div>';
    }).join('') +
      '<p class="ba-muted">Лимиты обновляются еженедельно. Computer use только в desktop.</p>';
  }

  function renderLimits(target) {
    var el = target || $('limitsBody');
    if (el) el.innerHTML = limitsHtml();
  }

  function profileHtml() {
    var u = (state.boot && state.boot.user) || {};
    return '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' +
      '<div class="ba-av" style="width:48px;height:48px;font-size:16px">' + esc(initials(u.display_name || u.email)) + '</div>' +
      '<div><div style="font-weight:700">' + esc(u.display_name || 'ASSISTIX') + '</div>' +
      '<div class="ba-muted">' + esc(u.email || '') + '</div>' +
      '<span style="display:inline-block;margin-top:6px;font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--ba-line);color:var(--ba-teal2)">ASSISTIX ID</span></div></div>' +
      '<div class="ba-actions">' +
      '<a class="ba-btn ba-btn-ghost" href="https://id.assistix.org/profile/" target="_blank" rel="noreferrer">Открыть ASSISTIX ID</a>' +
      '<a class="ba-btn ba-btn-ghost" href="https://agent.assistix.org/download/">Скачать desktop</a>' +
      '<button type="button" class="ba-btn ba-btn-danger ba-logout">Выйти</button></div>';
  }

  function renderProfile(target) {
    var el = target || $('profileBody');
    if (!el) return;
    el.innerHTML = profileHtml();
    el.querySelectorAll('.ba-logout').forEach(function (lo) {
      lo.addEventListener('click', doLogout);
    });
  }

  var RT_KEY = 'acx_agent_rt_v1';

  function saveRefreshToken(tok) {
    if (!tok) return;
    try {
      localStorage.setItem(RT_KEY, String(tok));
      localStorage.setItem('acx_agent_rt_at', String(Date.now()));
    } catch (e) { /* private mode */ }
  }

  function readRefreshToken() {
    try { return localStorage.getItem(RT_KEY) || ''; } catch (e) { return ''; }
  }

  function clearRefreshToken() {
    try {
      localStorage.removeItem(RT_KEY);
      localStorage.removeItem('acx_agent_rt_at');
    } catch (e) {}
  }

  function doLogout() {
    clearRefreshToken();
    fetch('/api/logout.php', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {})
      .then(function () { location.href = '/auth/login.php'; });
  }

  function authPing() {
    return fetch('/auth/ping.php?_=' + Date.now(), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
    }).then(function (r) { return r.json(); }).catch(function () {
      return { authenticated: false };
    });
  }

  function authRestore(token) {
    var body = token ? JSON.stringify({ refresh_token: token }) : '{}';
    return fetch('/auth/restore.php?_=' + Date.now(), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Acx-Refresh': token || ''
      },
      body: body
    }).then(function (r) { return r.json(); }).catch(function () {
      return { authenticated: false };
    });
  }

  async function ensureAuthenticated() {
    if (window.__ACX_PREAUTH__ && window.__ACX_PREAUTH__.authenticated) {
      return { authenticated: true, user: window.__ACX_PREAUTH__.user || null };
    }
    var ping = await authPing();
    if (ping && ping.authenticated) return ping;
    var rt = readRefreshToken();
    var restored = await authRestore(rt);
    if (restored && restored.ok && restored.authenticated) {
      if (restored.refresh_token) saveRefreshToken(restored.refresh_token);
      return authPing();
    }
    if (restored && (restored.error === 'refresh_invalid' || restored.error === 'no_refresh_token')) {
      clearRefreshToken();
    }
    return ping || { authenticated: false };
  }

  function flattenSessions(groups) {
    var out = [];
    // chat.php returns either an array of groups OR a date-keyed object: { "Сегодня": [ ... ] }
    if (!groups) return out;
    var list;
    if (Array.isArray(groups)) {
      list = groups;
    } else if (typeof groups === 'object') {
      list = Object.keys(groups).map(function (k) {
        var v = groups[k];
        if (Array.isArray(v)) return { title: k, conversations: v, items: v };
        return v;
      });
    } else {
      return out;
    }
    list.forEach(function (g) {
      if (!g) return;
      var items = g.items || g.conversations;
      if (Array.isArray(items)) {
        items.forEach(function (c) { if (c) out.push(c); });
      } else if (g.id) {
        out.push(g);
      }
    });
    return out;
  }

  function setProjectFilter(id) {
    state.projectFilter = id || null;
    updateProjectChip();
    updateCloudBar(null);
    renderProjects();
    renderProjectMenu();
    renderSessions();
    refreshProcess();
  }

  function renderProjectMenu() {
    var menu = $('projectMenu');
    if (!menu) return;
    var html = '<button type="button" role="option" data-pid="" class="' + (!state.projectFilter ? 'active' : '') + '">All sessions</button>';
    state.projects.forEach(function (p) {
      html += '<button type="button" role="option" data-pid="' + esc(p.id) + '" class="' +
        (state.projectFilter === p.id ? 'active' : '') + '">' + esc(p.name) + '</button>';
    });
    html += '<button type="button" data-new-project="+">+ New project</button>';
    menu.innerHTML = html;
    menu.querySelectorAll('[data-pid]').forEach(function (b) {
      b.addEventListener('click', function () {
        setProjectFilter(b.getAttribute('data-pid') || '');
        show(menu, false);
      });
    });
    menu.querySelectorAll('[data-new-project]').forEach(function (b) {
      b.addEventListener('click', function () {
        show(menu, false);
        createProject().catch(alert);
      });
    });
  }

  function renderSessions() {
    var list = $('sessionList');
    if (!list) return;
    var rows = state.sessions.slice();
    if (state.projectFilter) {
      var proj = state.projects.find(function (p) { return p.id === state.projectFilter; });
      var ids = (proj && proj.session_ids) || [];
      rows = rows.filter(function (s) { return ids.indexOf(Number(s.id)) >= 0; });
    }
    if (!rows.length) {
      list.innerHTML = '<p class="ba-muted" style="padding:8px">Нет сессий — нажмите +</p>';
      return;
    }
    list.innerHTML = rows.map(function (s) {
      var active = Number(s.id) === Number(state.conversationId);
      return '<button type="button" class="ba-item' + (active ? ' active' : '') + '" data-sid="' + esc(s.id) + '">' +
        '<span class="ba-dot ' + esc(modelClass(s.model || state.model)) + '"></span>' +
        '<span class="nm">' + esc(s.title || 'Сессия') + '</span></button>';
    }).join('');
    list.querySelectorAll('[data-sid]').forEach(function (b) {
      b.addEventListener('click', function () {
        loadSession(Number(b.getAttribute('data-sid')));
        if (isMobile()) setTab('chat');
      });
    });
  }

  function renderProjects() {
    var list = $('projectList');
    if (!list) return;
    var html = '<button type="button" class="ba-item' + (!state.projectFilter ? ' active' : '') + '" data-pid="">' +
      '<span class="nm">All sessions<span class="sub">Personal cloud workspace</span></span></button>';
    state.projects.forEach(function (p) {
      var n = (p.session_ids || []).length;
      html += '<button type="button" class="ba-item' + (state.projectFilter === p.id ? ' active' : '') + '" data-pid="' + esc(p.id) + '">' +
        '<span class="nm">' + esc(p.name) +
        '<span class="sub">Cloud · ' + n + ' sess</span></span></button>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-pid]').forEach(function (b) {
      b.addEventListener('click', function () {
        setProjectFilter(b.getAttribute('data-pid') || '');
      });
    });
    renderProjectMenu();
    updateProjectChip();
  }

  function renderMessages() {
    var box = $('messages');
    var empty = $('emptyState');
    if (!box) return;
    if (!state.messages.length) {
      box.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    box.innerHTML = state.messages.map(function (m) {
      var role = m.role === 'user' ? 'user' : 'assistant';
      var meta = role === 'assistant'
        ? '<div class="meta"><span class="ba-dot ' + esc(modelClass(m.model || state.model)) + '"></span>' + esc(m.model || state.model) + '</div>'
        : '';
      return '<div class="ba-msg ' + role + (m.error ? ' error' : '') + '">' + meta + esc(m.content || '') + '</div>';
    }).join('');
    var sc = $('chatScroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function updateModeChips() {
    var agent = $('modeAgent');
    var web = $('modeWeb');
    var webM = $('modeWebMobile');
    if (agent) agent.classList.toggle('active', state.mode === 'agent');
    if (web) web.classList.toggle('active', !!state.web || state.mode === 'web');
    if (webM) webM.classList.toggle('active', !!state.web || state.mode === 'web');
  }

  function updateSendEnabled() {
    var t = (($('composer') && $('composer').value) || '').trim();
    if ($('btnSend')) $('btnSend').disabled = !t || state.streaming;
  }

  async function loadBootstrap() {
    ensureApi();
    var j = await API.bootstrap();
    if (!j || !j.success) throw new Error('bootstrap_failed');
    state.boot = j.data || {};
    return state.boot;
  }

  async function loadSessions() {
    ensureApi();
    var j = await API.history({ limit: 40, offset: 0 });
    var groups = (j && j.conversations) || [];
    state.sessions = flattenSessions(groups).filter(function (s) { return s && s.id; });
    renderSessions();
  }

  async function loadProjects() {
    try {
      var j = await fetchJson('/api/projects.php');
      state.projects = (j && j.projects) || [];
    } catch (e) {
      state.projects = [];
    }
    renderProjects();
  }

  async function loadSession(id) {
    ensureApi();
    var j = await API.history({ conversation_id: id });
    if (!j || !j.success) return;
    state.conversationId = Number((j.conversation && j.conversation.id) || id);
    state.messages = (j.messages || []).map(function (m) {
      return { role: m.role, content: m.content, model: m.model };
    });
    if ($('chatTitle')) $('chatTitle').textContent = (j.conversation && j.conversation.title) || 'Сессия';
    if (j.conversation && j.conversation.model) {
      var mk = String(j.conversation.model).toUpperCase();
      if (mk === 'FLAIR') mk = 'FLARE';
      state.model = mk;
      renderModels();
    }
    renderMessages();
    renderSessions();
    refreshProcess();
  }

  function newSession() {
    state.conversationId = 0;
    state.messages = [];
    if ($('chatTitle')) $('chatTitle').textContent = 'Новая сессия';
    renderMessages();
    renderSessions();
    if ($('composer')) $('composer').focus();
    if (isMobile()) setTab('chat');
  }

  async function createProject() {
    var name = prompt('Название проекта', 'Project');
    if (name == null) return;
    name = String(name).trim() || 'Project';
    var j = await fetchJson('/api/projects.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: name })
    });
    if (j && j.project) {
      state.projects.unshift(j.project);
      setProjectFilter(j.project.id);
      if (isMobile()) setTab('projects');
    }
  }

  async function refreshProcess() {
    var stepsEl = $('processSteps');
    var filesEl = $('processFiles');
    var q = '/api/workspace.php?conversation_id=' + encodeURIComponent(state.conversationId || 0);
    if (state.projectFilter) q += '&project_id=' + encodeURIComponent(state.projectFilter);
    try {
      var j = await fetchJson(q);
      if (j.cloud_session) updateCloudBar(j.cloud_session);
      var steps = j.steps || [];
      var files = j.files || [];
      if (stepsEl) {
        stepsEl.innerHTML = steps.length
          ? steps.map(function (s) {
              return '<div class="ba-step"><div class="k">' + esc(s.kind || 'step') +
                (s.tool ? ' · ' + esc(s.tool) : '') + '</div>' +
                '<div class="ba-muted">' + esc(typeof s.payload === 'string' ? s.payload : JSON.stringify(s.payload || {}).slice(0, 180)) + '</div></div>';
            }).join('')
          : '<p class="ba-muted">Пока нет шагов.</p>';
      }
      if (filesEl) {
        var visible = files.filter(function (f) { return !f.dir; });
        filesEl.innerHTML = visible.length
          ? visible.map(function (f) {
              var name = f.name || f.path || 'file';
              var url = f.url || '';
              return '<div class="ba-file"><span class="nm">' + esc(name) + '</span>' +
                (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">Open</a>' : '') +
                '</div>';
            }).join('')
          : '<p class="ba-muted">Файлы появятся после agent-задачи.</p>';
      }
    } catch (e) {
      if (stepsEl) stepsEl.innerHTML = '<p class="ba-muted">Process недоступен.</p>';
      if (filesEl) filesEl.innerHTML = '<p class="ba-muted">Cloud workspace недоступен.</p>';
    }
  }

  function appendMessage(msg) {
    state.messages.push(msg);
    renderMessages();
  }

  function updateLastAssistant(text, meta) {
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') {
        state.messages[i].content = text;
        if (meta && meta.model) state.messages[i].model = meta.model;
        renderMessages();
        return;
      }
    }
  }

  async function sendMessage() {
    if (state.streaming) return;
    var input = $('composer');
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    updateSendEnabled();
    appendMessage({ role: 'user', content: text });
    appendMessage({ role: 'assistant', content: '', model: state.model });
    state.streaming = true;
    updateSendEnabled();

    var mode = state.mode;
    if (state.web && mode === 'chat') mode = 'web';
    var payload = {
      message: text,
      model: state.model,
      mode: mode,
      web: !!state.web || mode === 'web',
      conversation_id: state.conversationId || 0,
      project_id: state.projectFilter || '',
      locale: (navigator.language || 'ru').slice(0, 2),
      attachments: state.attachments.slice()
    };
    state.attachments = [];
    renderAttachList();

    var acc = '';
    var onDoneMeta = {};

    function finishOk(meta) {
      state.streaming = false;
      updateSendEnabled();
      if (meta && meta.conversation_id) {
        var cid = Number(meta.conversation_id);
        var wasNew = !state.conversationId;
        state.conversationId = cid;
        if (wasNew && state.projectFilter) {
          fetchJson('/api/projects.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'attach_session', id: state.projectFilter, session_id: cid })
          }).then(loadProjects).catch(function () {});
        }
      }
      if (meta && meta.title && $('chatTitle')) $('chatTitle').textContent = meta.title;
      updateLastAssistant(acc || (meta && meta.content) || '…', { model: (meta && meta.model_key) || state.model });
      loadBootstrap().then(function () {
        renderUsageMini();
        if (state.tab === 'limits') renderLimits($('limitsBodyMobile'));
      }).catch(function () {});
      loadSessions().catch(function () {});
      refreshProcess();
    }

    function finishErr(err) {
      state.streaming = false;
      updateSendEnabled();
      var msg = (err && err.message) ? err.message : 'Ошибка';
      if (msg === 'auth_required' || (err && err.status === 401)) {
        renderGate((state.boot && state.boot.login_url) || '/auth/login.php');
        return;
      }
      updateLastAssistant(msg, { model: state.model });
      state.messages[state.messages.length - 1].error = true;
      renderMessages();
    }

    ensureApi();
    if (!API.chatStream) {
      finishErr(new Error('Streaming unavailable'));
      return;
    }

    state.streamHandle = API.chatStream(payload, {
      onToken: function (piece) {
        acc += String(piece || '');
        updateLastAssistant(acc, { model: state.model });
      },
      onReplace: function (finalText) {
        acc = String(finalText || '');
        updateLastAssistant(acc, { model: state.model });
      },
      onMeta: function (meta) {
        onDoneMeta = Object.assign(onDoneMeta, meta || {});
        if (meta && meta.conversation_id) state.conversationId = Number(meta.conversation_id);
        if (meta && meta.model_key) {
          var mk = String(meta.model_key).toUpperCase();
          if (mk === 'FLAIR') mk = 'FLARE';
          state.model = mk;
          renderModels();
        }
      },
      onAgent: function (name, payload) {
        if (name === 'agent_cloud_session' && payload) updateCloudBar(payload);
        refreshProcess();
      },
      onDone: function (meta) {
        finishOk(Object.assign(onDoneMeta, meta || {}));
      },
      onError: function (err) {
        finishErr(typeof err === 'string' ? new Error(err) : (err || new Error('stream_error')));
      }
    });
  }

  function renderAttachList() {
    var el = $('attachList');
    if (!el) return;
    el.textContent = state.attachments.length
      ? state.attachments.map(function (a) { return a.name || 'file'; }).join(', ')
      : '';
  }

  function toggleWeb() {
    state.web = !state.web;
    if (state.web && state.mode === 'chat') state.mode = 'web';
    if (!state.web && state.mode === 'web') state.mode = 'chat';
    updateModeChips();
  }

  function bindUi() {
    if ($('btnSend')) $('btnSend').addEventListener('click', sendMessage);
    if ($('composer')) {
      $('composer').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      $('composer').addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(140, this.scrollHeight) + 'px';
        updateSendEnabled();
      });
    }
    if ($('btnNewSession')) $('btnNewSession').addEventListener('click', newSession);
    if ($('btnNewProject')) $('btnNewProject').addEventListener('click', function () { createProject().catch(alert); });
    if ($('btnProjectSwitch')) $('btnProjectSwitch').addEventListener('click', function (e) {
      e.stopPropagation();
      var m = $('projectMenu');
      if (!m) return;
      renderProjectMenu();
      show(m, m.hidden);
      show($('modelMenu'), false);
    });
    if ($('modelBtn')) $('modelBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var m = $('modelMenu');
      show(m, m.hidden);
      show($('projectMenu'), false);
    });
    if ($('modeAgent')) $('modeAgent').addEventListener('click', function () {
      state.mode = state.mode === 'agent' ? 'chat' : 'agent';
      updateModeChips();
    });
    if ($('modeWeb')) $('modeWeb').addEventListener('click', toggleWeb);
    if ($('modeWebMobile')) $('modeWebMobile').addEventListener('click', toggleWeb);
    if ($('btnLimits')) $('btnLimits').addEventListener('click', function () {
      renderLimits($('limitsBody'));
      openModal('limitsModal');
    });
    if ($('btnProfile')) $('btnProfile').addEventListener('click', function () {
      renderProfile($('profileBody'));
      openModal('profileModal');
    });
    if ($('btnToggleProcess')) $('btnToggleProcess').addEventListener('click', function () {
      var shell = $('shell');
      var panel = $('processPanel');
      var open = panel.hidden;
      show(panel, open);
      shell.classList.toggle('is-process', open);
      shell.classList.toggle('process-open', open);
      if (open) refreshProcess();
    });
    if ($('btnCloseProcess')) $('btnCloseProcess').addEventListener('click', function () {
      show($('processPanel'), false);
      $('shell').classList.remove('is-process', 'process-open');
    });
    if ($('sideScrim')) $('sideScrim').addEventListener('click', function () { setTab('chat'); });

    document.querySelectorAll('#bottomNav [data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-tab'));
      });
    });

    document.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () { closeModal(el.getAttribute('data-close')); });
    });
    if ($('fileInput')) $('fileInput').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      if (!files.length || !API || !API.upload) return;
      files.forEach(function (file) {
        API.upload(file, { conversation_id: state.conversationId || 0 }).then(function (j) {
          if (j && j.attachment) {
            state.attachments.push(j.attachment);
            renderAttachList();
          }
        }).catch(function (e) { alert(e.message || 'upload_failed'); });
      });
      this.value = '';
    });

    document.addEventListener('click', function () {
      show($('modelMenu'), false);
      show($('projectMenu'), false);
    });
    if ($('modelPicker')) $('modelPicker').addEventListener('click', function (e) { e.stopPropagation(); });
    if ($('btnProjectSwitch')) {
      var headLeft = $('btnProjectSwitch').parentElement;
      if (headLeft) headLeft.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    window.addEventListener('resize', function () {
      if (!isMobile() && state.tab !== 'chat' && state.tab !== 'process') {
        setTab('chat');
      }
    });
  }

  function cleanAuthQuery() {
    try {
      var u = new URL(location.href);
      ['oauth_error', 't', 'rt', 'acx_rt', 'code', 'state'].forEach(function (k) {
        u.searchParams.delete(k);
      });
      // Keep auth=ok briefly for gate suppression, strip after boot
      history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
    } catch (e) { /* ignore */ }
  }

  function justCompletedAuth() {
    try {
      var u = new URL(location.href);
      if (u.searchParams.get('auth') === 'ok') return true;
    } catch (e) {}
    try { return sessionStorage.getItem('acx_auth_just') === '1'; } catch (e2) {}
    return false;
  }

  async function boot() {
    bindUi();
    ensureApi();
    var authJust = justCompletedAuth();
    try {
      var u0 = new URL(location.href);
      var qrt = u0.searchParams.get('acx_rt') || u0.searchParams.get('rt');
      if (qrt) saveRefreshToken(qrt);
      if (authJust) {
        try { sessionStorage.setItem('acx_auth_just', '1'); } catch (e) {}
      }
    } catch (e0) {}

    // Never flash login gate while finishing OAuth / when server preauth says logged in
    if (authJust || (window.__ACX_PREAUTH__ && window.__ACX_PREAUTH__.authenticated)) {
      setAppState('booting');
      show($('authGate'), false);
    }

    try {
      var auth = await ensureAuthenticated();
      if (!auth || !auth.authenticated) {
        // One more chance right after complete (cookie race on some WebViews)
        if (authJust) {
          await new Promise(function (r) { setTimeout(r, 200); });
          auth = await ensureAuthenticated();
        }
      }
      if (!auth || !auth.authenticated) {
        cleanAuthQuery();
        try { sessionStorage.removeItem('acx_auth_just'); } catch (e) {}
        renderGate((auth && auth.login_url) || '/auth/login.php');
        return;
      }

      var data = await loadBootstrap();
      if (!data.authenticated) {
        auth = await ensureAuthenticated();
        if (auth && auth.authenticated) data = await loadBootstrap();
      }
      if (!data.authenticated) {
        cleanAuthQuery();
        renderGate(data.login_url || '/auth/login.php');
        return;
      }

      renderShell();
      // Isolate secondary loads — NEVER kick authenticated users back to login
      try { await loadProjects(); } catch (eP) { state.projects = []; renderProjects(); }
      try { await loadSessions(); } catch (eS) { state.sessions = []; renderSessions(); }
      newSession();
      try { refreshProcess(); } catch (eR) {}
      cleanAuthQuery();
      try {
        var u1 = new URL(location.href);
        if (u1.searchParams.has('auth')) {
          u1.searchParams.delete('auth');
          history.replaceState({}, '', u1.pathname + (u1.search || '') + u1.hash);
        }
        sessionStorage.removeItem('acx_auth_just');
      } catch (eC) {}
    } catch (e) {
      // Last resort: if we have session/RT, stay in app — never loop to login
      try {
        var last = await ensureAuthenticated();
        if (last && last.authenticated) {
          try { var d2 = await loadBootstrap(); state.boot = d2 || state.boot; } catch (e2) {}
          renderShell();
          try { await loadProjects(); } catch (e3) {}
          try { await loadSessions(); } catch (e4) {}
          newSession();
          cleanAuthQuery();
          return;
        }
      } catch (e5) {}
      cleanAuthQuery();
      renderGate('/auth/login.php');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
