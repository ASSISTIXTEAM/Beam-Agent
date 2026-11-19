(() => {
  if (window.__beamIronGateInstalled) return;
  window.__beamIronGateInstalled = true;
  const BRIDGE = "http://127.0.0.1:17865";
  const GATE_ID = "beam-auth-gate";

  const beamLang = () => {
    try {
      const ds = document.documentElement.dataset.beamLang;
      if (ds === "ru" || ds === "en") return ds;
      const lang = String(document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("ru")) return "ru";
      if (lang.startsWith("en")) return "en";
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        const m = v.match(/preference["']?\s*:\s*["'](ru|en)["']/);
        if (m) return m[1];
      }
      const langs = [];
      if (navigator.language) langs.push(navigator.language);
      for (const l of (navigator.languages || [])) langs.push(l);
      if (langs.some((l) => String(l || "").toLowerCase().startsWith("ru"))) return "ru";
    } catch {}
    return "en";
  };
  const isRu = () => beamLang() === "ru";

  const copy = () => {
    if (isRu()) {
      return {
        title: "ASSISTIX ID",
        body: "Войдите через ASSISTIX ID в браузере. После возврата Beam Agent продолжит работу.",
        btn: "Войти через ASSISTIX ID",
        busy: "Открываем браузер…",
        note: "Только вход через ASSISTIX ID в браузере. Сессия сохраняется на этом ПК.",
        errOpen: "Не удалось открыть вход: ",
        errBridge: "Нет связи с Beam Agent. Подождите или перезапустите.",
      };
    }
    return {
      title: "ASSISTIX ID",
      body: "Sign in with ASSISTIX ID in your browser. Beam Agent continues after you return.",
      btn: "Sign in with ASSISTIX ID",
      busy: "Opening browser…",
      note: "Only ASSISTIX ID browser sign-in. Session stays on this PC.",
      errOpen: "Could not open sign-in: ",
      errBridge: "No connection to Beam Agent. Wait or relaunch.",
    };
  };

  const paintGate = (gate, force) => {
    const tr = copy();
    const lang = beamLang();
    if (!force && gate.dataset.lang === lang && gate.querySelector('[data-act="browser-login"]')) {
      return;
    }
    gate.innerHTML =
      '<div class="bag-card bag-oauth">' +
      '<div class="bag-mark" aria-hidden="true"></div>' +
      "<h1>" + tr.title + "</h1>" +
      "<p>" + tr.body + "</p>" +
      '<div class="bag-error" data-act="err" hidden></div>' +
      '<button type="button" class="bag-primary" data-act="browser-login">' + tr.btn + "</button>" +
      '<div class="bag-note">' + tr.note + "</div>" +
      "</div>";
    gate.dataset.lang = lang;
    const btn = gate.querySelector('[data-act="browser-login"]');
    if (btn) btn.addEventListener("click", startLogin);
  };

  const ensureDom = () => {
    let gate = document.getElementById(GATE_ID);
    if (!gate) {
      gate = document.createElement("div");
      gate.id = GATE_ID;
      gate.setAttribute("role", "dialog");
      gate.setAttribute("aria-modal", "true");
      (document.documentElement || document.body).appendChild(gate);
    }
    paintGate(gate, gate.dataset.lang !== beamLang());
    gate.hidden = false;
    gate.removeAttribute("hidden");
    gate.dataset.mode = "oauth";
    document.documentElement.classList.add("beam-auth-locked");
    document.documentElement.style.overflow = "hidden";
    return gate;
  };

  const setErr = (msg) => {
    const gate = document.getElementById(GATE_ID);
    if (!gate) return;
    const err = gate.querySelector('[data-act="err"], .bag-error');
    if (!err) return;
    if (msg) {
      err.hidden = false;
      err.textContent = msg;
    } else {
      err.hidden = true;
      err.textContent = "";
    }
  };

  const unlock = () => {
    const gate = document.getElementById(GATE_ID);
    if (gate) {
      gate.hidden = true;
      gate.setAttribute("hidden", "");
      gate.dataset.mode = "signed";
    }
    document.documentElement.classList.remove("beam-auth-locked");
    document.documentElement.style.overflow = "";
    window.__beamIronSignedIn = true;
  };

  const lock = () => {
    ensureDom();
    window.__beamIronSignedIn = false;
  };

  let loginBusy = false;
  const startLogin = async () => {
    if (loginBusy) return;
    loginBusy = true;
    setErr("");
    const tr = copy();
    const btn = document.querySelector("#" + GATE_ID + ' [data-act="browser-login"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = tr.busy;
    }
    try {
      const r = await fetch(BRIDGE + "/assistix/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Beam-Locale": beamLang(),
          "Accept-Language": beamLang() === "ru" ? "ru-RU,ru;q=0.9" : "en-US,en;q=0.9",
        },
        body: "{}",
      });
      const j = await r.json().catch(() => ({}));
      const url = j.authUrl || j.loginUrl;
      if (!r.ok || !url) throw new Error(j.error || ("http_" + r.status));
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.documentElement.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      setErr(tr.errOpen + String((e && e.message) || e || "error"));
    } finally {
      loginBusy = false;
      const b = document.querySelector("#" + GATE_ID + ' [data-act="browser-login"]');
      if (b) {
        b.disabled = false;
        b.textContent = copy().btn;
      }
    }
  };

  let busy = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const gate = document.getElementById(GATE_ID);
      if (gate && !gate.hidden && gate.dataset.lang !== beamLang()) paintGate(gate, true);
      const r = await fetch(BRIDGE + "/assistix/me", { cache: "no-store" });
      const j = await r.json();
      if (j && j.signedIn && j.user) unlock();
      else lock();
    } catch (e) {
      lock();
      setErr(copy().errBridge);
    } finally {
      busy = false;
    }
  };

  if (!document.getElementById("beam-iron-lock-style")) {
    const st = document.createElement("style");
    st.id = "beam-iron-lock-style";
    st.textContent =
      "html.beam-auth-locked #root{visibility:hidden!important;opacity:0!important;pointer-events:none!important}" +
      "html.beam-auth-locked #root *{pointer-events:none!important}" +
      "html.beam-auth-locked #" + GATE_ID + ",html.beam-auth-locked #" + GATE_ID + " *{visibility:visible!important;opacity:1!important;pointer-events:auto!important}";
    (document.head || document.documentElement).appendChild(st);
  }

  const arm = () => {
    lock();
    poll();
    setInterval(poll, 1500);
    window.addEventListener("focus", poll);
    new MutationObserver(() => {
      if (window.__beamIronSignedIn) return;
      const gate = document.getElementById(GATE_ID);
      if (!gate || gate.hidden) lock();
      else if (gate.dataset.lang !== beamLang()) paintGate(gate, true);
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "lang", "data-beam-lang"],
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
  else arm();
})();
