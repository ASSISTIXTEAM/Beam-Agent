/* Beam Agent — workspace drawer: files tree, run log, context */
(function () {
  'use strict';

  var S = { open: false, tab: 'files', data: null, loading: false, timer: 0 };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function fmtTime(s) {
    if (!s) return '—';
    var d = new Date(String(s).replace(' ', 'T'));
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString();
  }

  function convId() {
    var st = window.ACXChat && window.ACXChat.state;
    return st && st.conversationId ? st.conversationId : 0;
  }

  function build() {
    if (document.getElementById('agentWorkspace')) return;
    var root = el('aside', 'aw');
    root.id = 'agentWorkspace';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="aw-head">' +
        '<span class="aw-dot" aria-hidden="true"></span>' +
        '<h2 class="aw-title">ASSISTIX Environment</h2>' +
        '<button type="button" class="aw-ic" data-aw-refresh title="Refresh">⟳</button>' +
        '<button type="button" class="aw-ic" data-aw-close title="Close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="aw-tabs" role="tablist">' +
        '<button type="button" class="aw-tab is-on" data-aw-tab="files" role="tab">Files</button>' +
        '<button type="button" class="aw-tab" data-aw-tab="log" role="tab">Run log</button>' +
        '<button type="button" class="aw-tab" data-aw-tab="ctx" role="tab">Context</button>' +
      '</div>' +
      '<div class="aw-body" data-aw-body></div>' +
      '<div class="aw-foot" data-aw-foot>Idle</div>';
    document.body.appendChild(root);

    root.querySelector('[data-aw-close]').addEventListener('click', close);
    root.querySelector('[data-aw-refresh]').addEventListener('click', function () { load(true); });
    root.querySelectorAll('[data-aw-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.tab = b.getAttribute('data-aw-tab');
        root.querySelectorAll('[data-aw-tab]').forEach(function (x) {
          x.classList.toggle('is-on', x === b);
        });
        render();
      });
    });
  }

  function load(force) {
    var root = document.getElementById('agentWorkspace');
    if (!root) return;
    var body = root.querySelector('[data-aw-body]');
    var foot = root.querySelector('[data-aw-foot]');
    if (S.loading && !force) return;
    S.loading = true;
    if (!S.data) body.innerHTML = '<div class="aw-empty">Loading workspace…</div>';

    var cid = convId();
    fetch('/api/workspace.php' + (cid ? '?conversation_id=' + encodeURIComponent(cid) : ''), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        S.loading = false;
        if (!j || !j.success) {
          body.innerHTML = '';
          body.appendChild(el('div', 'aw-empty',
            j && j.error === 'auth_required'
              ? 'Sign in to inspect the agent workspace.'
              : 'Could not load workspace.'));
          foot.textContent = (j && j.error) || 'error';
          return;
        }
        S.data = j;
        var runs = j.runs || [];
        var last = runs[0];
        foot.textContent = last
          ? (runs.length + ' run(s) · last ' + last.status + ' · ' + fmtTime(last.finished_at || last.created_at))
          : 'No runs yet — send an agent task to populate this panel.';
        render();
      })
      .catch(function () {
        S.loading = false;
        foot.textContent = 'Network error';
      });
  }

  function render() {
    var root = document.getElementById('agentWorkspace');
    if (!root) return;
    var body = root.querySelector('[data-aw-body]');
    body.innerHTML = '';
    if (!S.data) return;

    if (S.tab === 'files') renderFiles(body);
    else if (S.tab === 'log') renderLog(body);
    else renderCtx(body);
  }

  function renderFiles(body) {
    var files = (S.data.files || []).slice().sort(function (a, b) {
      return String(a.path).localeCompare(String(b.path));
    });
    if (!files.length) {
      body.appendChild(el('div', 'aw-empty', 'Workspace is empty. Ask the agent to create a file.'));
      return;
    }
    var ul = el('ul', 'aw-tree');
    files.forEach(function (f) {
      var isDir = !!(f.dir || f.is_dir);
      var li = el('li');
      li.appendChild(el('span', 'aw-ic-file', isDir ? '▸' : '·'));
      li.appendChild(el('span', 'aw-name', f.path));
      li.appendChild(el('span', 'aw-size', isDir ? '' : fmtSize(f.size)));
      li.title = f.path;
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  function renderLog(body) {
    var steps = S.data.steps || [];
    if (!steps.length) {
      body.appendChild(el('div', 'aw-empty', 'No steps recorded for the last run.'));
      return;
    }
    steps.forEach(function (s) {
      var row = el('div', 'aw-row');
      row.appendChild(el('div', 'aw-seq', '#' + (s.seq || '')));
      var main = el('div');
      var head = el('div');
      var kind = el('span', 'aw-kind', String(s.kind || '').replace('_', ' '));
      if (s.kind === 'tool_result' && s.payload && s.payload.ok === false) kind.classList.add('is-err');
      if (s.kind === 'think') kind.classList.add('is-think');
      head.appendChild(kind);
      if (s.tool) head.appendChild(el('span', 'aw-tool', s.tool));
      main.appendChild(head);

      var p = s.payload;
      var text = '';
      if (p && typeof p === 'object') {
        if (typeof p.text === 'string') text = p.text;
        else if (typeof p.stdout === 'string' || typeof p.stderr === 'string') {
          text = [p.stdout, p.stderr].filter(Boolean).join('\n').trim();
        } else {
          try { text = JSON.stringify(p, null, 1); } catch (e) { text = String(p); }
        }
      } else if (p) {
        text = String(p);
      }
      if (text) {
        var pre = el('pre', 'aw-payload', text.length > 900 ? text.slice(0, 900) + '\n…' : text);
        main.appendChild(pre);
      }
      row.appendChild(main);
      body.appendChild(row);
    });
  }

  function renderCtx(body) {
    var d = S.data;
    var runs = d.runs || [];
    var last = runs[0] || {};
    var dl = el('dl', 'aw-kv');
    var rows = [
      ['Environment', d.environment || 'ASSISTIX Environment'],
      ['Conversation', (d.conversation && d.conversation.id) || '—'],
      ['Model', last.model || '—'],
      ['Status', last.status || '—'],
      ['Job', last.job_id || '—'],
      ['Steps', String((d.steps || []).length)],
      ['Files', String((d.files || []).length)],
      ['Started', fmtTime(last.started_at)],
      ['Finished', fmtTime(last.finished_at)],
      ['Runs kept', String(runs.length)]
    ];
    rows.forEach(function (r) {
      dl.appendChild(el('dt', null, r[0]));
      dl.appendChild(el('dd', null, r[1]));
    });
    body.appendChild(dl);
  }

  function open() {
    build();
    var root = document.getElementById('agentWorkspace');
    S.open = true;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    load(true);
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(function () {
      if (S.open) load(false);
    }, 4000);
  }

  function close() {
    var root = document.getElementById('agentWorkspace');
    S.open = false;
    if (root) {
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
    }
    if (S.timer) {
      clearInterval(S.timer);
      S.timer = 0;
    }
  }

  function toggle() {
    if (S.open) close();
    else open();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.open) close();
  });

  window.ACXWorkspace = { open: open, close: close, toggle: toggle, refresh: function () { load(true); } };

  function mountButton() {
    if (document.getElementById('workspaceBtn')) return;
    var host = document.querySelector('.c-top') || document.querySelector('header');
    if (!host) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'workspaceBtn';
    btn.className = 'acx-iconbtn c-workspace-btn';
    btn.title = 'Workspace (files, run log)';
    btn.setAttribute('aria-label', 'Workspace');
    btn.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
      '<rect x="2.6" y="3.6" width="6.2" height="5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>' +
      '<rect x="2.6" y="11.4" width="6.2" height="5" rx="1.3" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M11.6 6.1h5.8M11.6 13.9h5.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>';
    btn.addEventListener('click', toggle);
    var spacer = host.querySelector('.c-top-spacer');
    if (spacer && spacer.parentNode === host) host.insertBefore(btn, spacer);
    else host.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(mountButton, 300); });
  } else {
    setTimeout(mountButton, 300);
  }
  setTimeout(mountButton, 1500);
})();
