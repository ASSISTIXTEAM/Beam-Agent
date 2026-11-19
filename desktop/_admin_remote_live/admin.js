(() => {
  const view = document.getElementById("view");
  const title = document.getElementById("title");
  const subtitle = document.getElementById("subtitle");
  const drawer = document.getElementById("drawer");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerBody = document.getElementById("drawerBody");
  const titles = {
    overview: ["Обзор", "Live-данные chat.assistix.org + Beam репорты"],
    users: ["Пользователи", "Аккаунты chat.assistix.org (ASSISTIX ID)"],
    chats: ["Чаты", "Живые диалоги и сообщения из chat DB"],
    requests: ["Запросы API", "История запросов / ответов для модерации"],
    reports: ["Репорты / Feedback", "Жалобы, оценки, краши и turn failed из Beam"],
    logs: ["Системные логи", "Ошибки и события инфраструктуры"],
    security: ["Безопасность", "Баны, force-logout, admin actions, ID accounts"],
    database: ["База данных", "Chat / Main / ID таблицы"],
    search: ["Глобальный поиск", "Люди, сообщения, репорты"],
    settings: ["Настройки", "Флаги панели и заметки ops"],
  };

  async function api(action, opts = {}) {
    const url = new URL("/admin/api.php", location.origin);
    url.searchParams.set("action", action);
    if (opts.query) Object.entries(opts.query).forEach(([k, v]) => url.searchParams.set(k, v));
    const init = { credentials: "same-origin", headers: {} };
    if (opts.method === "POST") {
      init.method = "POST";
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify({ action, ...(opts.body || {}) });
    }
    const r = await fetch(url, init);
    const j = await r.json().catch(() => ({ ok: false, error: "bad json" }));
    if (!j.ok) throw new Error(j.error || "request failed");
    return j.data;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (d) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("ru-RU"); } catch { return String(d); }
  };
  const n = (x) => Number(x || 0).toLocaleString("ru-RU");

  function openDrawer(t, html) {
    drawer.hidden = false;
    drawerTitle.textContent = t;
    drawerBody.innerHTML = html;
  }
  document.getElementById("drawerClose").onclick = () => { drawer.hidden = true; };
  drawer.addEventListener("click", (e) => { if (e.target === drawer) drawer.hidden = true; });

  async function renderOverview() {
    const d = await api("overview");
    const s = d.stats;
    const maxSpark = Math.max(1, ...(d.spark || []).map((x) => x.count));
    view.innerHTML = `
      <div class="grid">
        <div class="stat accent"><em>Chat users</em><strong>${n(s.users)}</strong></div>
        <div class="stat"><em>Чаты</em><strong>${n(s.chats)}</strong></div>
        <div class="stat"><em>Сообщения</em><strong>${n(s.msgs)}</strong></div>
        <div class="stat"><em>API requests</em><strong>${n(s.apiRequests)}</strong></div>
        <div class="stat"><em>ID accounts</em><strong>${n(s.idAccounts)}</strong></div>
        <div class="stat"><em>Репорты pending</em><strong>${n(s.reportsPending)}</strong></div>
        <div class="stat"><em>Beam-репорты</em><strong>${n(s.beamReports)}</strong></div>
        <div class="stat"><em>ERROR логи</em><strong>${n(s.logsErr)}</strong></div>
      </div>
      <p class="muted" style="margin:0 0 14px">Источник: <strong>${esc(s.source || "chat.assistix.org")}</strong> · сегодня ${n(s.msgsToday)} сообщений / ${n(s.usersToday)} новых users / ${n(s.chatsToday)} чатов</p>
      <div class="row2">
        <div class="panel">
          <h3>Активность сообщений · 14 дней</h3>
          <div class="spark">${(d.spark || []).map((x) => `<i style="height:${Math.max(6, (x.count / maxSpark) * 100)}%" title="${esc(x.day)}: ${x.count}"></i>`).join("")}</div>
        </div>
        <div class="panel">
          <h3>Свежие репорты</h3>
          ${d.recentReports.length ? `<table><thead><tr><th>Тип</th><th>Тема</th><th>Статус</th></tr></thead><tbody>
            ${d.recentReports.map((r) => `<tr><td><span class="tag">${esc(r.report_type)}</span></td><td>${esc(r.subject)}</td><td><span class="tag ${esc(r.status)}">${esc(r.status)}</span></td></tr>`).join("")}
          </tbody></table>` : `<div class="empty">Пока пусто</div>`}
        </div>
      </div>
      <div class="row2">
        <div class="panel">
          <h3>Пользователи chat</h3>
          <table><thead><tr><th>ID</th><th>Email</th><th>Tier</th><th>Когда</th></tr></thead><tbody>
            ${d.recentUsers.map((u) => `<tr><td class="mono">${u.id}</td><td>${esc(u.email)}</td><td><span class="tag">${esc(u.subscription_tier || "free")}</span></td><td class="muted">${fmt(u.created_at)}</td></tr>`).join("")}
          </tbody></table>
        </div>
        <div class="panel">
          <h3>Последние чаты</h3>
          <table><thead><tr><th>ID</th><th>Title</th><th>Model</th><th>User</th></tr></thead><tbody>
            ${(d.recentChats || []).map((c) => `<tr><td class="mono">${c.id}</td><td>${esc(c.title || "—")}</td><td><span class="tag">${esc(c.model || "")}</span></td><td class="muted">${esc(c.email || "")}</td></tr>`).join("") || "<tr><td colspan=4 class='empty'>Пусто</td></tr>"}
          </tbody></table>
        </div>
      </div>`;
  }

  async function renderUsers(q = "") {
    const d = await api("users", { query: { q, limit: 40 } });
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <input id="uq" value="${esc(q)}" placeholder="email / id / display name" />
          <button class="btn primary" id="usearch">Искать</button>
          <span class="muted">Всего: ${n(d.total)} · source=${esc(d.source || "chat")}</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Email</th><th>Имя</th><th>Tier</th><th>Чаты</th><th>Msgs</th><th>Login</th><th></th></tr></thead>
          <tbody>
            ${d.items.map((u) => `<tr>
              <td class="mono">${u.id}</td>
              <td>${esc(u.email)}${Number(u.is_banned) ? ' <span class="tag bad">ban</span>' : ""}</td>
              <td>${esc(u.display_name || "—")}</td>
              <td><span class="tag">${esc(u.subscription_tier || "free")}</span></td>
              <td>${n(u.chats)}</td>
              <td>${n(u.messages)}</td>
              <td class="muted">${fmt(u.last_login_at || u.created_at)}</td>
              <td class="actions">
                <button class="btn ghost" data-user="${u.id}">Открыть</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    document.getElementById("usearch").onclick = () => renderUsers(document.getElementById("uq").value.trim());
    view.querySelectorAll("[data-user]").forEach((b) => b.onclick = async () => {
      const ud = await api("user.get", { query: { id: b.dataset.user } });
      const u = ud.user;
      const DEFAULTS = { tide: 500000, flare: 100000, pine: 10000 };
      const bu = ud.beam_usage || {};
      const bl = ud.beam_limits || {};
      const weekMeta = ud.beam_week || {};
      const num = (x) => Math.max(0, Number(x) || 0);
      const tideUsed = num(bu.tide_used), tideLim = num(bu.tide_limit || bl.tide_limit || DEFAULTS.tide);
      const flareUsed = num(bu.flare_used), flareLim = num(bu.flare_limit || bl.flare_limit || DEFAULTS.flare);
      const pineUsed = num(bu.pine_used), pineLim = num(bu.pine_limit || bl.pine_limit || DEFAULTS.pine);
      const rem = (used, lim, unlim) => unlim ? "∞" : Math.max(0, lim - used);
      const tideUn = !!(bl.unlimited || bl.tide_unlimited);
      const flareUn = !!(bl.unlimited || bl.flare_unlimited);
      const pineUn = !!(bl.unlimited || bl.pine_unlimited);
      openDrawer(`Пользователь #${u.id || u.user_id}`, `
        <p><strong>${esc(u.email)}</strong></p>
        <p class="muted">${esc(u.display_name || "")} · tier ${esc(u.subscription_tier || "free")} · id_user=${esc(u.id_user_id)} · ${fmt(u.created_at)}</p>
        ${Number(u.is_banned) ? `<p class="tag bad">BANNED: ${esc(u.ban_reason || "")}</p>` : ""}
        <div class="actions" style="margin:12px 0">
          <button class="btn danger" id="killSess">Kill session</button>
          ${Number(u.is_banned) ? `<button class="btn ok" id="unbanUser">Unban</button>` : `<button class="btn danger" id="banUser">Ban</button>`}
          <button class="btn danger" id="delUser">Удалить</button>
        </div>
        <div class="tabs" id="userTabs" style="display:flex;gap:6px;margin:14px 0 10px;flex-wrap:wrap">
          <button class="btn primary" data-utab="chat">CHAT</button>
          <button class="btn ghost" data-utab="beam">Beam Agent</button>
          <button class="btn ghost" data-utab="limits">Лимиты</button>
          <button class="btn ghost" data-utab="id">ASSISTIX ID</button>
        </div>
        <div id="utab-chat">
          <h3>CHAT · chat.assistix.org</h3>
          ${(ud.chats || []).map((c) => `<div class="msg" data-chat="${c.id}" style="cursor:pointer"><div class="role">#${c.id} · ${esc(c.model || "")}</div><pre>${esc(c.title || "без названия")}</pre><div class="muted">${fmt(c.updated_at)}</div></div>`).join("") || "<div class='empty'>Нет чатов</div>"}
          <h3>Последние API requests</h3>
          ${(ud.requests || []).slice(0, 12).map((r) => `<div class="msg"><div class="role">${esc(r.role)} · ${esc(r.model)} · ${esc(r.provider || "")}</div><pre>${esc(r.content_preview || "")}</pre><div class="muted">${fmt(r.created_at)}</div></div>`).join("") || "<div class='empty'>Пусто</div>"}
        </div>
        <div id="utab-beam" hidden>
          <h3>Beam Agent · диалоги</h3>
          <p class="muted">Текстовые реплики (user + assistant), без файлов/медиа</p>
          ${(ud.beam_sessions || []).map((s) => `<div class="msg" data-beam-sess="${s.id}" style="cursor:pointer"><div class="role">#${s.id} · ${esc(s.model || "")} · ${n(s.message_count)} msgs</div><pre>${esc(s.title || s.session_key || "session")}</pre><div class="muted">${fmt(s.last_message_at || s.updated_at)}</div></div>`).join("") || "<div class='empty'>Пока нет диалогов Beam Agent</div>"}
          <div id="beamTranscript" style="margin-top:12px"></div>
        </div>
        <div id="utab-limits" hidden>
          <h3>Единые недельные лимиты (Assistix)</h3>
          <p class="muted">Один источник истины для Beam Agent / Chat / любых продуктов с ASSISTIX ID. Неделя: Monday 00:00 UTC.</p>
          <p class="muted">Сброс used: <strong id="limResetAt">${esc(weekMeta.reset_at || "next Monday 00:00 UTC")}</strong> · week_start <span class="mono" id="limWeekStart">${esc(weekMeta.week_start || bu.week_start || "—")}</span> · defaults Tide ${DEFAULTS.tide.toLocaleString()} / Flare ${DEFAULTS.flare.toLocaleString()} / Pine ${DEFAULTS.pine.toLocaleString()}</p>
          <div id="limLive" style="display:grid;gap:8px;margin:12px 0">
            <div class="msg"><div class="role">Tide ${tideUn ? '<span class="tag ok">unlimited</span>' : ""}</div><pre id="limLiveTide">${n(tideUsed)} used · ${tideUn ? "∞" : n(tideLim)} limit · ${rem(tideUsed, tideLim, tideUn) === "∞" ? "∞" : n(rem(tideUsed, tideLim, tideUn))} left</pre></div>
            <div class="msg"><div class="role">Flare ${flareUn ? '<span class="tag ok">unlimited</span>' : ""}</div><pre id="limLiveFlare">${n(flareUsed)} used · ${flareUn ? "∞" : n(flareLim)} limit · ${rem(flareUsed, flareLim, flareUn) === "∞" ? "∞" : n(rem(flareUsed, flareLim, flareUn))} left</pre></div>
            <div class="msg"><div class="role">Pine ${pineUn ? '<span class="tag ok">unlimited</span>' : ""}</div><pre id="limLivePine">${n(pineUsed)} used · ${pineUn ? "∞" : n(pineLim)} limit · ${rem(pineUsed, pineLim, pineUn) === "∞" ? "∞" : n(rem(pineUsed, pineLim, pineUn))} left</pre></div>
          </div>
          <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-top:10px">
            <label>Tide <input id="limTide" type="number" value="${bl.tide_limit ?? DEFAULTS.tide}" style="width:110px"/></label>
            <label>Flare <input id="limFlare" type="number" value="${bl.flare_limit ?? DEFAULTS.flare}" style="width:110px"/></label>
            <label>Pine <input id="limPine" type="number" value="${bl.pine_limit ?? DEFAULTS.pine}" style="width:110px"/></label>
          </div>
          <div class="toolbar" style="flex-wrap:wrap;gap:8px;margin-top:8px">
            <label><input id="limTideUn" type="checkbox" ${tideUn ? "checked" : ""}/> Tide ∞</label>
            <label><input id="limFlareUn" type="checkbox" ${flareUn ? "checked" : ""}/> Flare ∞</label>
            <label><input id="limPineUn" type="checkbox" ${pineUn ? "checked" : ""}/> Pine ∞</label>
            <label><input id="limUnlim" type="checkbox" ${bl.unlimited ? "checked" : ""}/> All unlimited</label>
            <button class="btn primary" id="saveBeamLim">Сохранить</button>
            <button class="btn ghost" id="resetBeamUsed">Сбросить used</button>
            <button class="btn ghost" id="refreshBeamLim">Обновить live</button>
          </div>
          <p class="muted" id="limPollHint" style="margin-top:8px">Live poll каждые 4с, пока открыта вкладка Лимиты.</p>
          <h3 style="margin-top:16px">CHAT weekly_usage</h3>
          <pre>${esc(JSON.stringify(ud.usage || [], null, 2))}</pre>
        </div>
        <div id="utab-id" hidden>
          <h3>ID profile</h3>
          ${ud.id_profile ? `<pre>${esc(JSON.stringify(ud.id_profile, null, 2))}</pre>` : "<div class='empty'>Нет</div>"}
        </div>
      `);
      const showTab = (name) => {
        ["chat", "beam", "limits", "id"].forEach((t) => {
          const el = document.getElementById("utab-" + t);
          if (el) el.hidden = t !== name;
        });
        drawerBody.querySelectorAll("[data-utab]").forEach((btn) => {
          btn.className = btn.dataset.utab === name ? "btn primary" : "btn ghost";
        });
      };
      drawerBody.querySelectorAll("[data-utab]").forEach((btn) => {
        btn.onclick = () => showTab(btn.dataset.utab);
      });
      drawerBody.querySelectorAll("[data-chat]").forEach((el) => {
        el.onclick = async () => {
          const cd = await api("chat.get", { query: { id: el.dataset.chat } });
          openDrawer(`CHAT #${cd.chat.id}`, `
            <p class="muted">${esc(cd.chat.email || "")} · ${esc(cd.chat.model || "")}</p>
            ${(cd.messages || []).map((m) => `<div class="msg"><div class="role">${esc(m.role)} · ${esc(m.model || "")}</div><pre>${esc(m.content || "")}</pre><div class="muted">${fmt(m.created_at)}</div></div>`).join("") || "<div class='empty'>Пусто</div>"}
          `);
        };
      });
      drawerBody.querySelectorAll("[data-beam-sess]").forEach((el) => {
        el.onclick = async () => {
          const bd = await api("beam.session.get", { query: { id: el.dataset.beamSess } });
          const box = document.getElementById("beamTranscript");
          if (!box) return;
          box.innerHTML = `<h3>Транскрипт #${bd.session.id}</h3>` + (
            (bd.messages || []).map((m) => `<div class="msg"><div class="role">${esc(m.role)} · ${esc(m.model || "")}</div><pre>${esc(m.content || "")}</pre><div class="muted">${fmt(m.created_at)}</div></div>`).join("")
            || "<div class='empty'>Пусто</div>"
          );
          showTab("beam");
        };
      });
      const allUn = document.getElementById("limUnlim");
      if (allUn) allUn.onchange = () => {
        const on = allUn.checked;
        ["limTideUn", "limFlareUn", "limPineUn"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.checked = on;
        });
      };
      const paintLive = (usage, limits, week) => {
        const d = { tide: 500000, flare: 100000, pine: 10000 };
        const bu2 = usage || {};
        const bl2 = limits || {};
        const fmtLine = (id) => {
          const used = Math.max(0, Number(bu2[id + "_used"]) || 0);
          const un = !!(bl2.unlimited || bl2[id + "_unlimited"]);
          const lim = Math.max(0, Number(bu2[id + "_limit"] || bl2[id + "_limit"] || d[id]) || 0);
          const left = un ? "∞" : n(Math.max(0, lim - used));
          return `${n(used)} used · ${un ? "∞" : n(lim)} limit · ${left} left`;
        };
        const t = document.getElementById("limLiveTide");
        const f = document.getElementById("limLiveFlare");
        const p = document.getElementById("limLivePine");
        if (t) t.textContent = fmtLine("tide");
        if (f) f.textContent = fmtLine("flare");
        if (p) p.textContent = fmtLine("pine");
        const ws = document.getElementById("limWeekStart");
        const ra = document.getElementById("limResetAt");
        if (ws && (week?.week_start || bu2.week_start)) ws.textContent = week?.week_start || bu2.week_start;
        if (ra && week?.reset_at) ra.textContent = week.reset_at;
      };
      let limPoll = null;
      const stopLimPoll = () => { if (limPoll) { clearInterval(limPoll); limPoll = null; } };
      const refreshLimLive = async () => {
        try {
          const fresh = await api("user.get", { query: { id: b.dataset.user } });
          paintLive(fresh.beam_usage, fresh.beam_limits, fresh.beam_week);
          return fresh;
        } catch (e) {
          return null;
        }
      };
      const startLimPoll = () => {
        stopLimPoll();
        limPoll = setInterval(() => {
          const tab = document.getElementById("utab-limits");
          if (!tab || tab.hidden || drawer.hidden) { stopLimPoll(); return; }
          refreshLimLive();
        }, 4000);
      };
      const prevShowTab = showTab;
      // wrap showTab for limits live poll
      const showTabWithPoll = (name) => {
        prevShowTab(name);
        if (name === "limits") { refreshLimLive(); startLimPoll(); }
        else stopLimPoll();
      };
      drawerBody.querySelectorAll("[data-utab]").forEach((btn) => {
        btn.onclick = () => showTabWithPoll(btn.dataset.utab);
      });
      const saveLim = document.getElementById("saveBeamLim");
      if (saveLim) saveLim.onclick = async () => {
        const all = document.getElementById("limUnlim")?.checked ? 1 : 0;
        const tU = document.getElementById("limTideUn")?.checked ? 1 : 0;
        const fU = document.getElementById("limFlareUn")?.checked ? 1 : 0;
        const pU = document.getElementById("limPineUn")?.checked ? 1 : 0;
        await api("beam.limits.set", {
          method: "POST",
          body: {
            id_user_id: Number(u.id_user_id) || 0,
            email: u.email || "",
            tide_limit: Number(document.getElementById("limTide").value),
            flare_limit: Number(document.getElementById("limFlare").value),
            pine_limit: Number(document.getElementById("limPine").value),
            unlimited: all,
            tide_unlimited: all || tU,
            flare_unlimited: all || fU,
            pine_unlimited: all || pU,
          },
        });
        await refreshLimLive();
        alert("Лимиты сохранены на сервере");
      };
      const resetUsed = document.getElementById("resetBeamUsed");
      if (resetUsed) resetUsed.onclick = async () => {
        if (!confirm("Сбросить used на этой неделе?")) return;
        await api("beam.usage.reset", {
          method: "POST",
          body: { id_user_id: Number(u.id_user_id) || 0, email: u.email || "" },
        });
        await refreshLimLive();
        alert("used сброшен");
      };
      const refreshBtn = document.getElementById("refreshBeamLim");
      if (refreshBtn) refreshBtn.onclick = () => refreshLimLive();
      const drawerClose = document.getElementById("drawerClose");
      if (drawerClose) {
        const prev = drawerClose.onclick;
        drawerClose.onclick = (ev) => {
          stopLimPoll();
          if (typeof prev === "function") prev(ev);
          else drawer.hidden = true;
        };
      }
      document.getElementById("killSess").onclick = async () => {
        await api("user.terminate_sessions", { method: "POST", body: { id: Number(b.dataset.user) } });
        alert("Force logout выставлен");
      };
      const banBtn = document.getElementById("banUser");
      if (banBtn) banBtn.onclick = async () => {
        const reason = prompt("Причина бана", "abuse") || "banned";
        await api("user.ban", { method: "POST", body: { id: Number(b.dataset.user), reason } });
        drawer.hidden = true;
        renderUsers(q);
      };
      const unbanBtn = document.getElementById("unbanUser");
      if (unbanBtn) unbanBtn.onclick = async () => {
        await api("user.unban", { method: "POST", body: { id: Number(b.dataset.user) } });
        drawer.hidden = true;
        renderUsers(q);
      };
      document.getElementById("delUser").onclick = async () => {
        if (!confirm("Удалить пользователя безвозвратно?")) return;
        await api("user.delete", { method: "POST", body: { id: Number(b.dataset.user) } });
        drawer.hidden = true;
        renderUsers(q);
      };
    });
  }

  async function renderChats(q = "") {
    const d = await api("chats", { query: { q, limit: 40 } });
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <input id="cq" value="${esc(q)}" placeholder="title / email / id" />
          <button class="btn primary" id="csearch">Искать</button>
          <span class="muted">Всего: ${n(d.total)}</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>Model</th><th>User</th><th>Msgs</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            ${d.items.map((c) => `<tr>
              <td class="mono">${c.id}</td>
              <td>${esc(c.title || "—")}</td>
              <td><span class="tag">${esc(c.model || "")}</span></td>
              <td>${esc(c.email || c.user_id)}</td>
              <td>${n(c.message_count)}</td>
              <td class="muted">${fmt(c.updated_at)}</td>
              <td class="actions">
                <button class="btn ghost" data-chat="${c.id}">Открыть</button>
                <button class="btn danger" data-delchat="${c.id}">Удалить</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    document.getElementById("csearch").onclick = () => renderChats(document.getElementById("cq").value.trim());
    view.querySelectorAll("[data-chat]").forEach((b) => b.onclick = async () => {
      const cd = await api("chat.get", { query: { id: b.dataset.chat } });
      openDrawer(`Чат #${cd.chat.id}`, `
        <p class="muted">${esc(cd.chat.email || "")} · ${esc(cd.chat.title || "")} · ${esc(cd.chat.model || "")}</p>
        ${cd.messages.map((m) => `<div class="msg"><div class="role">${esc(m.role)} · ${esc(m.model || "")} · ${fmt(m.created_at)}</div><pre>${esc(m.content)}</pre></div>`).join("") || "<div class='empty'>Пусто</div>"}
      `);
    });
    view.querySelectorAll("[data-delchat]").forEach((b) => b.onclick = async () => {
      if (!confirm("Удалить чат и сообщения?")) return;
      await api("chat.delete", { method: "POST", body: { id: Number(b.dataset.delchat) } });
      renderChats(q);
    });
  }

  async function renderReports(status = "all", q = "") {
    const d = await api("reports", { query: { status, q } });
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <select id="rst">
            <option value="all" ${status === "all" ? "selected" : ""}>Все</option>
            <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
            <option value="resolved" ${status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
          <input id="rq" value="${esc(q)}" placeholder="тема / текст / email" />
          <button class="btn primary" id="rgo">Фильтр</button>
        </div>
        ${d.items.map((r) => `
          <div class="msg">
            <div class="role">
              <span class="tag">${esc(r.report_type)}</span>
              <span class="tag ${esc(r.status)}">${esc(r.status)}</span>
              #${r.id} · ${fmt(r.created_at)} · ${esc(r.email || "anon")}
            </div>
            <strong>${esc(r.subject)}</strong>
            <pre>${esc(r.message)}</pre>
            <div class="actions" style="margin-top:8px">
              ${r.status === "pending" ? `<button class="btn ok" data-resolve="${r.id}">Resolve</button>` : ""}
              <button class="btn danger" data-delrep="${r.id}">Удалить</button>
            </div>
          </div>`).join("") || `<div class="empty">Репортов нет</div>`}
      </div>`;
    document.getElementById("rgo").onclick = () => renderReports(document.getElementById("rst").value, document.getElementById("rq").value.trim());
    view.querySelectorAll("[data-resolve]").forEach((b) => b.onclick = async () => {
      await api("report.resolve", { method: "POST", body: { id: Number(b.dataset.resolve) } });
      renderReports(status, q);
    });
    view.querySelectorAll("[data-delrep]").forEach((b) => b.onclick = async () => {
      if (!confirm("Удалить репорт?")) return;
      await api("report.delete", { method: "POST", body: { id: Number(b.dataset.delrep) } });
      renderReports(status, q);
    });
  }

  async function renderLogs(level = "all", q = "") {
    const d = await api("logs", { query: { level, q } });
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <select id="ll">
            ${["all","ERROR","WARNING","INFO","DEBUG","error","warning","info"].map((x) => `<option ${level===x?"selected":""}>${x}</option>`).join("")}
          </select>
          <input id="lq" value="${esc(q)}" placeholder="поиск по message/context" />
          <button class="btn primary" id="lgo">Фильтр</button>
          <button class="btn ghost" id="lclear">Очистить старше 30д</button>
        </div>
        ${d.items.map((l) => `<div class="msg"><div class="role"><span class="tag ${esc(l.level)}">${esc(l.level)}</span> ${fmt(l.created_at)} · ${esc(l.ip_address || "")}</div><pre>${esc(l.message)}</pre>${l.context ? `<pre class="muted">${esc(l.context)}</pre>` : ""}</div>`).join("") || `<div class="empty">Пусто</div>`}
      </div>`;
    document.getElementById("lgo").onclick = () => renderLogs(document.getElementById("ll").value, document.getElementById("lq").value.trim());
    document.getElementById("lclear").onclick = async () => {
      await api("logs.clear", { method: "POST", body: {} });
      renderLogs(level, q);
    };
  }

  async function renderRequests(q = "") {
    const d = await api("requests", { query: { q } });
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <input id="rqapi" value="${esc(q)}" placeholder="preview / model / provider / user_id" />
          <button class="btn primary" id="rgoapi">Искать</button>
          <span class="muted">source=${esc(d.source || "chat")}</span>
        </div>
        ${(d.items || []).map((r) => `
          <div class="msg">
            <div class="role">
              <span class="tag">${esc(r.role)}</span>
              <span class="tag">${esc(r.model || "")}</span>
              ${r.provider ? `<span class="tag">${esc(r.provider)}</span>` : ""}
              #${r.id} · user ${esc(r.email || r.user_id || "—")} · chat #${r.conversation_id || "—"} · ${fmt(r.created_at)}
            </div>
            <pre>${esc(r.content_preview || "")}</pre>
          </div>`).join("") || `<div class="empty">Нет запросов</div>`}
      </div>`;
    document.getElementById("rgoapi").onclick = () => renderRequests(document.getElementById("rqapi").value.trim());
  }

  async function renderSecurity() {
    const d = await api("security");
    view.innerHTML = `
      <div class="row2">
        <div class="panel">
          <h3>Admin actions</h3>
          ${(d.admin_actions || []).map((e) => `<div class="msg"><div class="role">${esc(e.action)} · ${esc(e.target_type)} #${esc(e.target_id)}</div><pre>${esc(e.admin_username)} · ${fmt(e.created_at)} · ${esc(e.ip_address || "")}</pre></div>`).join("") || "<div class='empty'>Пусто</div>"}
        </div>
        <div class="panel">
          <h3>Ban / force-logout</h3>
          <table><thead><tr><th>User</th><th>Email</th><th>Reason</th><th>Force logout</th><th></th></tr></thead><tbody>
            ${(d.forced_logouts || []).map((u) => `<tr>
              <td class="mono">${u.id}</td>
              <td>${esc(u.email)}</td>
              <td>${esc(u.ban_reason || "—")}</td>
              <td class="muted">${fmt(u.force_logout_at)}</td>
              <td><button class="btn danger" data-kill="${u.id}">Kill again</button></td>
            </tr>`).join("") || "<tr><td colspan=5 class='empty'>Пусто</td></tr>"}
          </tbody></table>
        </div>
      </div>
      <div class="panel">
        <h3>ASSISTIX ID accounts</h3>
        <table><thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Verified</th></tr></thead><tbody>
          ${(d.id_accounts || []).map((u) => `<tr><td class="mono">${u.id}</td><td>${esc(u.email)}</td><td>${esc(u.display_name || "")}</td><td>${u.email_verified ? "yes" : "no"}</td></tr>`).join("") || "<tr><td colspan=4 class='empty'>Пусто</td></tr>"}
        </tbody></table>
      </div>`;
    view.querySelectorAll("[data-kill]").forEach((b) => b.onclick = async () => {
      await api("session.kill", { method: "POST", body: { id: b.dataset.kill } });
      renderSecurity();
    });
  }

  async function renderDatabase() {
    const d = await api("db.tables");
    view.innerHTML = `
      <div class="panel">
        <h3>Таблицы</h3>
        <table><thead><tr><th>DB</th><th>Таблица</th><th>Строк</th><th></th></tr></thead><tbody>
          ${d.tables.map((t) => `<tr><td><span class="tag">${esc(t.db || "chat")}</span></td><td class="mono">${esc(t.name)}</td><td>${n(t.rows)}</td><td><button class="btn ghost" data-table="${esc(t.name)}">Открыть</button></td></tr>`).join("")}
        </tbody></table>
      </div>`;
    view.querySelectorAll("[data-table]").forEach((b) => b.onclick = async () => {
      const td = await api("db.describe", { query: { table: b.dataset.table } });
      const cols = td.columns.map((c) => c.Field);
      openDrawer(`Таблица ${td.table}`, `
        <p class="muted">${td.columns.map((c) => `${c.Field} ${c.Type}`).join(" · ")}</p>
        <div style="overflow:auto">
          <table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
          <tbody>${td.sample.map((row) => `<tr>${cols.map((c) => `<td class="mono">${esc(typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c])}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>`);
    });
  }

  async function renderSearch(q = "") {
    view.innerHTML = `
      <div class="panel">
        <div class="toolbar">
          <input id="sq" value="${esc(q)}" placeholder="минимум 2 символа" />
          <button class="btn primary" id="sgo">Искать везде</button>
        </div>
        <div id="sres"><div class="empty">Введите запрос</div></div>
      </div>`;
    const run = async () => {
      const query = document.getElementById("sq").value.trim();
      if (query.length < 2) return;
      const d = await api("search", { query: { q: query } });
      document.getElementById("sres").innerHTML = `
        <h3>Пользователи</h3>
        ${d.users.map((u) => `<div class="msg"><strong>#${u.id}</strong> ${esc(u.email)} <span class="muted">${fmt(u.created_at)}</span></div>`).join("") || "<div class='empty'>Нет</div>"}
        <h3>Сообщения</h3>
        ${d.messages.map((m) => `<div class="msg"><div class="role">${esc(m.role)} · chat #${m.conversation_id}</div><pre>${esc(m.content).slice(0, 500)}</pre></div>`).join("") || "<div class='empty'>Нет</div>"}
        <h3>Репорты</h3>
        ${d.reports.map((r) => `<div class="msg"><strong>${esc(r.subject)}</strong> <span class="tag ${esc(r.status)}">${esc(r.status)}</span></div>`).join("") || "<div class='empty'>Нет</div>"}`;
    };
    document.getElementById("sgo").onclick = run;
    if (q) run();
  }

  async function renderSettings() {
    const d = await api("settings.get");
    const s = { ...d.defaults, ...d.settings };
    view.innerHTML = `
      <div class="panel">
        <h3>Ops flags</h3>
        <div class="toolbar" style="flex-direction:column;align-items:stretch">
          <label>Maintenance mode (0/1)</label>
          <input id="s_maint" value="${esc(s.maintenance || "0")}" />
          <label>Beam ingest enabled (0/1)</label>
          <input id="s_beam" value="${esc(s.beam_ingest_enabled || "1")}" />
          <label>Заметки</label>
          <input id="s_notes" value="${esc(s.notes || "")}" />
          <button class="btn primary" id="ssave">Сохранить</button>
        </div>
      </div>`;
    document.getElementById("ssave").onclick = async () => {
      const pairs = [
        ["maintenance", document.getElementById("s_maint").value],
        ["beam_ingest_enabled", document.getElementById("s_beam").value],
        ["notes", document.getElementById("s_notes").value],
      ];
      for (const [key, value] of pairs) await api("settings.set", { method: "POST", body: { key, value } });
      alert("Сохранено");
    };
  }

  const renderers = {
    overview: renderOverview,
    users: () => renderUsers(""),
    chats: () => renderChats(""),
    requests: () => renderRequests(""),
    reports: () => renderReports("all", ""),
    logs: () => renderLogs("all", ""),
    security: renderSecurity,
    database: renderDatabase,
    search: () => renderSearch(""),
    settings: renderSettings,
  };

  async function go(name) {
    document.querySelectorAll(".rail-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    const meta = titles[name] || [name, ""];
    title.textContent = meta[0];
    subtitle.textContent = meta[1];
    view.innerHTML = `<div class="panel"><div class="empty">Загрузка…</div></div>`;
    try { await renderers[name](); }
    catch (e) { view.innerHTML = `<div class="panel"><div class="empty">Ошибка: ${esc(e.message)}</div></div>`; }
  }

  document.getElementById("nav").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]");
    if (b) go(b.dataset.view);
  });
  document.getElementById("globalGo").onclick = () => {
    const q = document.getElementById("globalQ").value.trim();
    document.querySelectorAll(".rail-nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === "search"));
    title.textContent = titles.search[0];
    subtitle.textContent = titles.search[1];
    renderSearch(q);
  };
  document.getElementById("globalQ").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("globalGo").click();
  });

  go("overview");
})();
