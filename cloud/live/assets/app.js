(function () {
  "use strict";

  const $ = function (sel) {
    return document.querySelector(sel);
  };

  const state = {
    boot: null,
    guest: true,
    currentConversationId: null,
    currentLocalId: null,
    sending: false,
    idEmbedProbeComplete: false,
    idProbeTimer: null,
    idModalEscBound: false,
  };

  const ID_ORIGIN = "https://id.assistix.org";

  function toast(msg, isErr) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  }

  async function apiGet(path) {
    const r = await fetch(path, { credentials: "same-origin" });
    const j = await r.json().catch(function () {
      return null;
    });
    if (!r.ok || !j) {
      const detail = j && j.error ? j.error : !j ? "HTTP " + r.status : "";
      throw new Error(detail || "Ошибка сети");
    }
    return j;
  }

  async function apiPost(body) {
    const r = await fetch("/api/chat.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    let j = null;
    try {
      j = raw ? JSON.parse(raw) : null;
    } catch (e) {
      j = null;
    }
    if (!j || j.success === false) {
      const detail =
        j && j.error
          ? String(j.error)
          : !j
            ? "Сервер не вернул JSON (HTTP " + r.status + ")"
            : "Ошибка запроса";
      throw new Error(detail);
    }
    return j;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMarkdown(md) {
    if (window.marked && typeof marked.parse === "function") {
      try {
        return marked.parse(md, { async: false });
      } catch (e) {
        return "<p>" + escapeHtml(md) + "</p>";
      }
    }
    return "<p>" + escapeHtml(md).replace(/\n/g, "<br/>") + "</p>";
  }

  function renderUserAvatarFooter() {
    const av = $("#userAvatar");
    const nameEl = $("#userFooterName");
    if (!av || !state.boot) return;
    if (!state.boot.authenticated) {
      av.textContent = "?";
      av.title = "Гость";
      if (nameEl) nameEl.textContent = "Гость";
      return;
    }
    const u = state.boot.user || {};
    const letter = ((u.display_name || u.email || "?").trim().charAt(0) || "?").toUpperCase();
    const url = (u.avatar_url || "").trim();
    if (url) {
      av.innerHTML = '<img src="' + escapeHtml(url) + '" alt="" width="40" height="40" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />';
    } else {
      av.textContent = letter;
    }
    const label = u.display_name || (u.email || "").split("@")[0] || "Профиль";
    av.title = label;
    if (nameEl) nameEl.textContent = label;
  }

  function renderAuth() {
    const host = $("#topbarAuth");
    if (!host || !state.boot) return;
    host.innerHTML = "";
    const d = state.boot;
    if (!d.authenticated) {
      const a = document.createElement("a");
      var ret = window.location.href.split("#")[0];
      if (!/^https:\/\/agent\.assistix\.org/i.test(ret)) {
        ret = "https://agent.assistix.org/";
      }
      a.href =
        "https://assistix.org/auth/?app=chat&next=" +
        encodeURIComponent(ret);
      a.className = "btn-login";
      a.textContent = "Войти в CHAT";
      a.setAttribute("aria-label", "Войти через ASSISTIX ID и вернуться в чат");
      a.title = "ASSISTIX ID → подтверждение → обратно в CHAT";
      host.appendChild(a);
      renderUserAvatarFooter();
      return;
    }
    const u = d.user || {};
    const pill = document.createElement("div");
    pill.className = "profile-pill";
    const av = (u.avatar_url || "").trim();
    if (av) {
      const img = document.createElement("img");
      img.src = av;
      img.alt = "";
      pill.appendChild(img);
    } else {
      const fb = document.createElement("div");
      fb.className = "av";
      fb.textContent = ((u.display_name || u.email || "?").trim().charAt(0) || "?").toUpperCase();
      pill.appendChild(fb);
    }
    const txt = document.createElement("div");
    txt.className = "txt";
    const strong = document.createElement("strong");
    strong.textContent = u.display_name || (u.email || "").split("@")[0] || "Профиль";
    const span = document.createElement("span");
    span.textContent = u.email || "";
    txt.appendChild(strong);
    txt.appendChild(span);
    pill.appendChild(txt);
    host.appendChild(pill);

    const prof = document.createElement("a");
    prof.href = d.id_profile_url || "https://id.assistix.org/profile/";
    prof.className = "btn-ghost";
    prof.target = "_blank";
    prof.rel = "noopener";
    prof.textContent = "Профиль";
    host.appendChild(prof);

    const out = document.createElement("a");
    out.href = "/api/logout.php";
    out.className = "btn-ghost";
    out.textContent = "Выйти";
    host.appendChild(out);
    renderUserAvatarFooter();
  }

  function renderModelSelect() {
    const sel = $("#modelSelect");
    if (!sel || !state.boot) return;
    sel.innerHTML = "";
    (state.boot.models || []).forEach(function (m) {
      const o = document.createElement("option");
      o.value = m.key;
      o.textContent = m.name;
      sel.appendChild(o);
    });
    if (!state.guest) {
      const saved = localStorage.getItem("acx_model");
      if (saved && Array.prototype.some.call(sel.options, function (o) { return o.value === saved; })) {
        sel.value = saved;
      }
    } else {
      sel.value = "GUEST";
      sel.disabled = true;
    }
    sel.onchange = function () {
      if (!state.guest) localStorage.setItem("acx_model", sel.value);
    };
  }

  function renderComposerHint() {
    const el = $("#composerHint");
    if (!el || !state.boot) return;
    if (state.guest) {
      const g = state.boot.guest_usage || {};
      el.textContent =
        "Демо: " +
        (g.daily_user_messages || 0) +
        "/" +
        (g.max_daily_user_messages || 40) +
        " сообщений сегодня · чаты " +
        (g.conversation_count || 0) +
        "/" +
        (g.max_conversations || 3);
      return;
    }
    const u = state.boot.usage;
    if (!u) {
      el.textContent = "";
      return;
    }
    const f = u.flair || {};
    const p = u.pine || {};
    el.textContent =
      "FLAIR токены (неделя UTC): " +
      f.tokens_used +
      "/" +
      f.tokens_cap +
      " · PINE: " +
      p.requests_used +
      "/" +
      p.requests_cap +
      " · TIDE без лимита";
  }

  function renderHistory() {
    const nav = $("#historyNav");
    const meta = $("#sidebarMeta");
    if (!nav) return;
    if (meta) {
      meta.textContent = state.guest
        ? "Демо: история в сессии браузера."
        : "История сохраняется в сервисе BEAM AGENT.";
    }
    nav.innerHTML = "";
    const groups = state.historyGroups || {};
    const keys = Object.keys(groups);
    if (keys.length === 0) {
      const empty = document.createElement("li");
      empty.className = "chat-group-label";
      empty.textContent = "Нет чатов";
      nav.appendChild(empty);
      return;
    }
    keys.forEach(function (gname) {
      const t = document.createElement("li");
      t.className = "chat-group-label";
      t.textContent = gname;
      nav.appendChild(t);
      (groups[gname] || []).forEach(function (c) {
        const item = document.createElement("li");
        item.className = "chat-info-item";
        item.textContent = c.title || "Чат";
        if (state.guest) {
          item.dataset.localId = c.local_id;
          if (c.local_id === state.currentLocalId) item.classList.add("active");
        } else {
          item.dataset.convId = String(c.id);
          if (Number(c.id) === Number(state.currentConversationId)) item.classList.add("active");
        }
        item.addEventListener("click", function () {
          if (state.guest) loadGuestThread(c.local_id);
          else loadUserThread(Number(c.id));
          closeMobileSidebar();
        });
        nav.appendChild(item);
      });
    });
  }

  async function loadHistoryList() {
    const j = await apiGet("/api/chat.php");
    state.historyGroups = j.conversations || {};
    renderHistory();
  }

  function updateChatView() {
    const box = $("#messages");
    const welcome = $("#welcomeScreen");
    const hasMsg = !!(box && box.querySelector(".message"));
    if (welcome) {
      welcome.style.display = hasMsg ? "none" : "";
    }
    if (box) {
      box.classList.toggle("hidden", !hasMsg);
    }
    if (hasMsg) {
      syncScrollButton();
    } else {
      const sb = $("#scrollToBottomBtn");
      if (sb) sb.classList.add("hidden");
    }
  }

  function syncScrollButton() {
    const box = $("#messages");
    const btn = $("#scrollToBottomBtn");
    if (!box || !btn) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    btn.classList.toggle("hidden", nearBottom);
  }

  function appendMessage(role, content) {
    const box = $("#messages");
    if (!box) return;
    const wrap = document.createElement("div");
    wrap.className = "message " + (role === "user" ? "user" : "assistant");
    const av = document.createElement("div");
    av.className = "message-avatar";
    av.textContent = role === "user" ? "Вы" : "A";
    const inner = document.createElement("div");
    inner.className = "message-content";
    if (role === "user") {
      inner.innerHTML = "<p>" + escapeHtml(content).replace(/\n/g, "<br/>") + "</p>";
    } else {
      inner.innerHTML = renderMarkdown(content);
    }
    wrap.appendChild(av);
    wrap.appendChild(inner);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    updateChatView();
  }

  function clearMessages() {
    const box = $("#messages");
    if (box) box.innerHTML = "";
    updateChatView();
  }

  async function loadGuestThread(localId) {
    state.currentLocalId = localId;
    state.currentConversationId = null;
    clearMessages();
    const j = await apiGet("/api/chat.php?local_id=" + encodeURIComponent(localId));
    (j.messages || []).forEach(function (m) {
      appendMessage(m.role, m.content);
    });
    await loadHistoryList();
  }

  async function loadUserThread(id) {
    state.currentConversationId = id;
    state.currentLocalId = null;
    clearMessages();
    const j = await apiGet("/api/chat.php?conversation_id=" + encodeURIComponent(id));
    const sel = $("#modelSelect");
    if (sel && j.conversation && j.conversation.model) sel.value = j.conversation.model;
    (j.messages || []).forEach(function (m) {
      appendMessage(m.role, m.content);
    });
    await loadHistoryList();
  }

  async function loadBootstrap() {
    const j = await apiGet("/api/bootstrap.php");
    if (!j.success || !j.data) throw new Error("bootstrap");
    state.boot = j.data;
    state.guest = !!j.data.guest;
    renderAuth();
    renderModelSelect();
    renderComposerHint();
    await loadHistoryList();
    if (!j.data.authenticated) {
      maybeProbeAssistixIdSession();
    } else {
      state.idEmbedProbeComplete = true;
      hideIdResumeModal();
    }
    updateChatView();
  }

  function setPrompt(text) {
    const ta = $("#inputMessage");
    if (!ta) return;
    ta.value = text;
    ta.focus();
    ta.dispatchEvent(new Event("input"));
  }

  function updateCharCount() {
    const ta = $("#inputMessage");
    const el = $("#charCount");
    if (!ta || !el) return;
    el.textContent = ta.value.length + " / 32000";
  }

  function setLoading(on) {
    const bar = $("#loadingProgress");
    if (bar) bar.classList.toggle("show", !!on);
  }

  function filterHistory() {
    const q = ($("#searchInput") && $("#searchInput").value || "").trim().toLowerCase();
    document.querySelectorAll(".chat-info-item").forEach(function (item) {
      const t = (item.textContent || "").toLowerCase();
      item.style.display = !q || t.indexOf(q) >= 0 ? "" : "none";
    });
  }

  function getChatReturnUrl() {
    var ret = window.location.href.split("#")[0];
    if (!/^https:\/\/agent\.assistix\.org/i.test(ret)) {
      ret = "https://agent.assistix.org/";
    }
    return ret;
  }

  function buildChatLoginUrl() {
    return (
      "https://assistix.org/auth/?app=chat&next=" +
      encodeURIComponent(getChatReturnUrl())
    );
  }

  function cleanupIdProbe() {
    if (state.idProbeTimer) {
      clearTimeout(state.idProbeTimer);
      state.idProbeTimer = null;
    }
    window.removeEventListener("message", onAssistixIdEmbedMessage);
  }

  function onAssistixIdEmbedMessage(ev) {
    if (ev.origin !== ID_ORIGIN) return;
    var d = ev.data;
    if (!d || d.type !== "assistix_id_session") return;
    cleanupIdProbe();
    state.idEmbedProbeComplete = true;
    if (!d.logged_in || !d.user) return;
    showIdResumeModal(d.user);
  }

  function onIdResumeModalEsc(ev) {
    if (ev.key !== "Escape") return;
    var m = $("#idResumeModal");
    if (!m || m.classList.contains("hidden")) return;
    dismissIdResumeModal();
  }

  function hideIdResumeModal() {
    if (state.idModalEscBound) {
      document.removeEventListener("keydown", onIdResumeModalEsc);
      state.idModalEscBound = false;
    }
    var m = $("#idResumeModal");
    if (m) m.classList.add("hidden");
  }

  function dismissIdResumeModal() {
    try {
      sessionStorage.setItem("assistix_id_hint_dismissed", "1");
      localStorage.setItem("assistix_chat_id_hint_snooze", String(Date.now()));
    } catch (e) {}
    hideIdResumeModal();
  }

  function showIdResumeModal(user) {
    var m = $("#idResumeModal");
    var tx = $("#idResumeText");
    if (!m || !tx) return;
    var name = (user.display_name || "").trim();
    var em = (user.email_masked || "").trim();
    var line = "";
    if (name && em) line = name + " · " + em;
    else if (em) line = em;
    else if (name) line = name;
    else line = "Аккаунт ASSISTIX ID";
    tx.textContent = "Узнан аккаунт: " + line;
    m.classList.remove("hidden");
    var cont = $("#idResumeContinueBtn");
    var dis = $("#idResumeDismissBtn");
    if (cont) {
      cont.textContent = "Войти в CHAT";
      cont.onclick = function () {
        window.location.href = buildChatLoginUrl();
      };
    }
    if (dis) {
      dis.onclick = dismissIdResumeModal;
    }
    if (!state.idModalEscBound) {
      document.addEventListener("keydown", onIdResumeModalEsc);
      state.idModalEscBound = true;
    }
    setTimeout(function () {
      if (cont) cont.focus();
    }, 80);
  }

  function maybeProbeAssistixIdSession() {
    if (!state.boot || state.boot.authenticated) return;
    if (state.idEmbedProbeComplete) return;
    try {
      if (sessionStorage.getItem("assistix_id_hint_dismissed") === "1") {
        state.idEmbedProbeComplete = true;
        return;
      }
      var sn = localStorage.getItem("assistix_chat_id_hint_snooze");
      if (sn && Date.now() - parseInt(sn, 10) < 86400000) {
        state.idEmbedProbeComplete = true;
        return;
      }
    } catch (e) {}
    window.addEventListener("message", onAssistixIdEmbedMessage);
    state.idProbeTimer = setTimeout(function () {
      cleanupIdProbe();
      state.idEmbedProbeComplete = true;
    }, 12000);
    var iframe = $("#idSessionProbeFrame");
    if (!iframe) {
      cleanupIdProbe();
      state.idEmbedProbeComplete = true;
      return;
    }
    iframe.src =
      ID_ORIGIN +
      "/api/embed-session-hint.php?parent_origin=" +
      encodeURIComponent(window.location.origin);
  }

  async function send() {
    const ta = $("#inputMessage");
    const btn = $("#btnSend");
    if (!ta || state.sending) return;
    const text = ta.value.trim();
    if (!text) return;
    state.sending = true;
    setLoading(true);
    if (btn) {
      btn.disabled = true;
      btn.classList.add("sending");
    }
    appendMessage("user", text);
    ta.value = "";
    ta.dispatchEvent(new Event("input"));
    try {
      if (state.guest) {
        const j = await apiPost({
          action: "send_message",
          message: text,
          local_id: state.currentLocalId || "",
        });
        state.currentLocalId = j.local_id;
        appendMessage("assistant", j.assistant_message.content);
      } else {
        const sel = $("#modelSelect");
        const j = await apiPost({
          action: "send_message",
          message: text,
          conversation_id: state.currentConversationId || 0,
          model: sel ? sel.value : "TIDE",
        });
        state.currentConversationId = j.conversation_id;
        appendMessage("assistant", j.assistant_message.content);
      }
      await loadBootstrap();
      renderHistory();
    } catch (e) {
      toast(e.message || "Ошибка", true);
    } finally {
      state.sending = false;
      setLoading(false);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("sending");
      }
    }
  }

  function newChat() {
    state.currentConversationId = null;
    state.currentLocalId = null;
    clearMessages();
    renderHistory();
    closeMobileSidebar();
  }

  function isDesktop() {
    return window.matchMedia("(min-width: 769px)").matches;
  }

  function toggleSidebarCollapsed() {
    const sb = $("#sidebar");
    if (!sb || !isDesktop()) return;
    sb.classList.toggle("collapsed");
  }

  function openMobileSidebar() {
    $("#sidebar").classList.add("open");
    $("#mobileOverlay").classList.add("active");
    $("#mobileMenuBtn").classList.add("active");
    $("#mobileMenuBtn").setAttribute("aria-expanded", "true");
  }

  function closeMobileSidebar() {
    $("#sidebar").classList.remove("open");
    $("#mobileOverlay").classList.remove("active");
    const m = $("#mobileMenuBtn");
    if (m) {
      m.classList.remove("active");
      m.setAttribute("aria-expanded", "false");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(location.search);
    const oauthErr = params.get("oauth_error");
    if (oauthErr) {
      toast("Вход: " + oauthErr, true);
      history.replaceState({}, "", location.pathname);
    }

    $("#btnSend").addEventListener("click", send);
    $("#inputMessage").addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send();
      }
    });
    (function bindTextareaAutoresize() {
      var ta = $("#inputMessage");
      if (!ta) return;
      var run = function () {
        ta.style.height = "auto";
        var h = Math.min(120, Math.max(24, ta.scrollHeight));
        ta.style.height = h + "px";
        updateCharCount();
      };
      ta.addEventListener("input", run);
      run();
    })();

    document.querySelectorAll(".prompt-card[data-prompt]").forEach(function (card) {
      card.addEventListener("click", function () {
        setPrompt(card.getAttribute("data-prompt") || "");
      });
    });

    var searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", filterHistory);
    }

    var messagesBox = $("#messages");
    if (messagesBox) {
      messagesBox.addEventListener("scroll", syncScrollButton);
    }

    var scrollBtn = $("#scrollToBottomBtn");
    if (scrollBtn) {
      scrollBtn.addEventListener("click", function () {
        var box = $("#messages");
        if (box) box.scrollTop = box.scrollHeight;
      });
    }
    $("#btnNewChat").addEventListener("click", newChat);

    $("#mobileMenuBtn").addEventListener("click", function () {
      if ($("#sidebar").classList.contains("open")) closeMobileSidebar();
      else openMobileSidebar();
    });
    $("#mobileOverlay").addEventListener("click", closeMobileSidebar);
    $("#sidebarCloseMobile").addEventListener("click", closeMobileSidebar);

    var foldBtn = $("#sidebarFoldBtn");
    if (foldBtn) foldBtn.addEventListener("click", toggleSidebarCollapsed);
    var expandBtn = $("#sidebarExpandBtn");
    if (expandBtn) {
      expandBtn.addEventListener("click", function () {
        var sb = $("#sidebar");
        if (sb) sb.classList.remove("collapsed");
        if (isDesktop()) closeMobileSidebar();
        else openMobileSidebar();
      });
    }
    var userFooter = $("#userFooter");
    if (userFooter) {
      userFooter.addEventListener("click", function () {
        if (!state.boot || !state.boot.authenticated) {
          window.location.href = buildChatLoginUrl();
          return;
        }
        var url = state.boot.id_profile_url || "https://id.assistix.org/profile/";
        window.open(url, "_blank", "noopener");
      });
      userFooter.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          userFooter.click();
        }
      });
    }

    if (window.marked && typeof marked.setOptions === "function") {
      marked.setOptions({ breaks: true });
    }

    loadBootstrap()
      .then(function () {
        var modal = $("#idResumeModal");
        if (modal) {
          modal.addEventListener("click", function (ev) {
            if (ev.target === modal) {
              dismissIdResumeModal();
            }
          });
        }
      })
      .catch(function () {
        toast("Не удалось загрузить приложение.", true);
      });
  });
})();
