/**
 * Fix auth gate input jitter: never rebuild password form DOM while typing.
 * Syncs runtime + dist index.html.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEW_BLOCK = `  let passwordBusy = false;
  let passwordErr = "";
  let savedEmail = "";
  let savedPassword = "";
  let gateMode = ""; // "", "password", "confirm", "signed"
  let formBound = false;
  let authPollTimer = null;

  const authErrorRu = (raw) => {
    const s = String(raw || "").trim();
    if (!s) return "Не удалось войти";
    if (/[А-Яа-яЁё]/.test(s)) return s;
    const map = {
      email_password_required: "Введите email и пароль",
      no_real_user: "Не удалось получить профиль ASSISTIX ID",
      no_oauth_code: "Не удалось завершить вход. Попробуйте ещё раз",
      invalid_assistix_user: "Некорректный ответ ASSISTIX ID",
      network_error: "Нет связи с ASSISTIX ID",
      Failed_to_fetch: "Нет связи с локальным bridge",
      "Failed to fetch": "Нет связи с локальным bridge",
    };
    if (map[s]) return map[s];
    if (/^http_\\d+$/i.test(s) || /^login_http_/i.test(s)) return "Ошибка сервера ASSISTIX ID";
    if (/^exchange_http_/i.test(s)) return "Не удалось обменять код входа";
    if (/invalid|wrong|credential|password|unauthorized/i.test(s)) return "Неверный email или пароль";
    return "Не удалось войти: " + s;
  };

  const gateEl = () => document.getElementById("beam-auth-gate");

  const isGateFormInteractive = () => {
    const gate = gateEl();
    if (!gate || gate.hidden) return false;
    const ae = document.activeElement;
    if (!ae) return false;
    if (gate.contains(ae) && (ae.matches("input,textarea,select,button") || ae.isContentEditable)) return true;
    return false;
  };

  const readFormValues = (gate) => {
    const form = gate?.querySelector?.('[data-act="pw-form"]');
    if (!form) return;
    const em = form.querySelector('[name="email"]');
    const pw = form.querySelector('[name="password"]');
    if (em) savedEmail = em.value || savedEmail;
    if (pw) savedPassword = pw.value || "";
  };

  const displayErr = (data) => {
    if (passwordErr) return String(passwordErr);
    if (data?.lastAuthError && !passwordBusy) return authErrorRu(data.lastAuthError);
    return "";
  };

  const updatePasswordChrome = (gate, data) => {
    if (!gate) return;
    const errText = displayErr(data);
    let errBox = gate.querySelector(".bag-error");
    if (errText) {
      if (!errBox) {
        errBox = document.createElement("div");
        errBox.className = "bag-error";
        const form = gate.querySelector('[data-act="pw-form"]');
        const p = gate.querySelector(".bag-card > p");
        if (form) form.parentNode.insertBefore(errBox, form);
        else if (p) p.after(errBox);
        else gate.querySelector(".bag-card")?.prepend(errBox);
      }
      if (errBox.textContent !== errText) errBox.textContent = errText;
      errBox.hidden = false;
    } else if (errBox) {
      errBox.remove();
    }

    const form = gate.querySelector('[data-act="pw-form"]');
    if (!form) return;
    const emailEl = form.querySelector('[name="email"]');
    const passEl = form.querySelector('[name="password"]');
    const btn = form.querySelector('button[type="submit"]');
    // Never overwrite values while focused; otherwise restore saved
    if (emailEl && document.activeElement !== emailEl) {
      if (savedEmail && emailEl.value !== savedEmail) emailEl.value = savedEmail;
    }
    if (passEl && document.activeElement !== passEl) {
      if (savedPassword && passEl.value !== savedPassword) passEl.value = savedPassword;
    }
    const disable = !!passwordBusy;
    if (emailEl) emailEl.disabled = disable;
    if (passEl) passEl.disabled = disable;
    if (btn) {
      btn.disabled = disable;
      const label = passwordBusy ? "Входим…" : "Войти";
      if (btn.textContent !== label) btn.textContent = label;
    }
  };

  const bindPasswordFormOnce = (gate) => {
    const form = gate.querySelector('[data-act="pw-form"]');
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    formBound = true;
    const emailEl = form.querySelector('[name="email"]');
    const passEl = form.querySelector('[name="password"]');
    if (emailEl && savedEmail) emailEl.value = savedEmail;
    if (passEl && savedPassword) passEl.value = savedPassword;
    const persist = () => {
      if (emailEl) savedEmail = emailEl.value;
      if (passEl) savedPassword = passEl.value;
    };
    emailEl?.addEventListener("input", persist);
    passEl?.addEventListener("input", persist);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      persist();
      const email = (emailEl?.value || "").trim();
      const password = passEl?.value || "";
      if (!email || !password) {
        passwordErr = "Введите email и пароль";
        updatePasswordChrome(gate, lastData || { signedIn: false });
        return;
      }
      submitPasswordLogin(email, password);
    });
  };

  const mountPasswordGate = (gate, data, { focus } = {}) => {
    gate.dataset.mode = "password";
    gateMode = "password";
    formBound = false;
    gate.innerHTML = '<div class="bag-card bag-password"><div class="bag-mark" aria-hidden="true"></div><h1>ASSISTIX ID</h1><p>Войдите с email и паролем от аккаунта ASSISTIX ID. Без входа доступ закрыт.</p><div class="bag-error" hidden></div><form class="bag-pw-form" data-act="pw-form"><label class="bag-label" for="beam-pw-email">Email</label><input id="beam-pw-email" class="bag-input" type="email" name="email" autocomplete="username" required placeholder="you@example.com"/><label class="bag-label" for="beam-pw-pass">Пароль</label><input id="beam-pw-pass" class="bag-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••"/><button type="submit">Войти</button></form><div class="bag-note">Пароль проверяется на id.assistix.org через локальный bridge. Локальных гостевых аккаунтов нет.</div></div>';
    bindPasswordFormOnce(gate);
    updatePasswordChrome(gate, data);
    if (focus) {
      setTimeout(() => {
        if (isGateFormInteractive()) return;
        const el = gate.querySelector(savedEmail ? '[name="password"]' : '[name="email"]');
        try { el?.focus(); } catch {}
      }, 40);
    }
  };

  const mountConfirmGate = (gate, pending) => {
    gate.dataset.mode = "confirm";
    gateMode = "confirm";
    formBound = false;
    const name = pending.display_name || pending.name || "ASSISTIX";
    const email = pending.email || "";
    let avUrl = String(pending.avatar_url || "").trim();
    if (avUrl && avUrl.charAt(0) === "/") avUrl = "https://id.assistix.org" + avUrl;
    const av = avUrl
      ? '<div class="bag-avatar"><img src="'+avUrl.replace(/"/g,"&quot;")+'" alt=""></div>'
      : '<div class="bag-avatar">'+String(name).trim().split(/\\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase()+"</div>";
    gate.innerHTML = '<div class="bag-card bag-confirm">'+av+'<h1>'+name.replace(/</g,"")+'</h1><p class="bag-email">'+email.replace(/</g,"")+'</p><p>Войти в Beam Agent с этим аккаунтом ASSISTIX ID?</p><button type="button" data-act="confirm">Да, войти</button><button type="button" class="bag-ghost" data-act="other">Другой аккаунт</button><div class="bag-note">После подтверждения вы сразу попадёте в приложение.</div></div>';
    gate.querySelector('[data-act="confirm"]')?.addEventListener("click", async () => {
      try { await fetch(BRIDGE + "/assistix/confirm", { method: "POST" }); } catch {}
      refresh({ force: true });
    });
    gate.querySelector('[data-act="other"]')?.addEventListener("click", async () => {
      try { await fetch(BRIDGE + "/assistix/cancel-pending", { method: "POST" }); } catch {}
      passwordErr = "";
      savedPassword = "";
      refresh({ force: true });
    });
  };

  const submitPasswordLogin = async (email, password) => {
    if (passwordBusy) return;
    passwordBusy = true;
    passwordErr = "";
    savedEmail = email;
    savedPassword = password;
    updatePasswordChrome(gateEl(), lastData || { signedIn: false });
    try {
      const r = await fetch(BRIDGE + "/assistix/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        passwordErr = authErrorRu(j.error || ("http_" + r.status));
        return;
      }
      passwordErr = "";
      savedPassword = "";
      await refresh({ force: true });
    } catch (e) {
      passwordErr = authErrorRu((e && e.message) || e || "network_error");
    } finally {
      passwordBusy = false;
      const g = gateEl();
      if (g && g.dataset.mode === "password") updatePasswordChrome(g, lastData || { signedIn: false });
      else ensureAuthGate(lastData || { signedIn: false }, { force: true });
    }
  };

  const ensureAuthGate = (data, opts = {}) => {
    const force = !!opts.force;
    let gate = gateEl();
    const signed = !!data?.signedIn && !!data?.user;
    const pending = (!signed && data?.pendingUser) ? data.pendingUser : null;

    if (signed) {
      if (gate) {
        readFormValues(gate);
        gate.hidden = true;
        gate.innerHTML = "";
        gate.dataset.mode = "signed";
      }
      document.documentElement.style.overflow = "";
      passwordErr = "";
      savedPassword = "";
      gateMode = "signed";
      formBound = false;
      return true;
    }

    if (!gate) {
      gate = document.createElement("div");
      gate.id = "beam-auth-gate";
      document.documentElement.appendChild(gate);
    }
    gate.hidden = false;
    document.documentElement.style.overflow = "hidden";

    if (pending) {
      // Allow rebuild to confirm only if mode changed or forced; don't touch while typing on password
      if (gate.dataset.mode === "confirm" && !force) return false;
      mountConfirmGate(gate, pending);
      return false;
    }

    // Password-only login form
    if (gate.dataset.mode === "password" && gate.querySelector('[data-act="pw-form"]') && !force) {
      // CRITICAL: never replace form DOM — only chrome (error / loading)
      updatePasswordChrome(gate, data);
      return false;
    }
    // If user is mid-typing somehow without mode set, still avoid smash
    if (!force && isGateFormInteractive() && gate.querySelector('[data-act="pw-form"]')) {
      updatePasswordChrome(gate, data);
      return false;
    }

    const firstMount = gate.dataset.mode !== "password";
    mountPasswordGate(gate, data, { focus: firstMount && !isGateFormInteractive() });
    return false;
  };

  const renderSide = (data) => {
    const root = findSidebarRoot();
    if (!root) return;
    // Don't touch DOM while native dialogs / open overlays might remount the tree
    if (document.querySelector('[aria-modal="true"], .ReactModal__Overlay')) return;
    // Don't fight the auth form for focus / layout thrash
    if (isGateFormInteractive()) return;

    let el = document.getElementById("beam-side-limits");
    if (!el) {
      el = document.createElement("div");
      el.id = "beam-side-limits";
      root.appendChild(el);
    } else if (el.parentElement !== root) {
      root.appendChild(el);
    }

    const tr = t();
    const user = data?.user;
    const signed = !!data?.signedIn && !!user;
    const models = modelsFrom(data);
    const rings = models.map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      return '<div class="bsl-ring" data-id="'+m.id+'"><div class="bsl-chart">'+ringSvg(pct, m.color)+'<div class="bsl-pct">'+pct+'%</div></div><div class="bsl-meta"><div class="bsl-label">'+m.name+'</div><div class="bsl-val">'+fmt(m.used)+' / '+fmt(m.limit)+'</div></div></div>';
    }).join("");

    const av = signed && user.avatar_url
      ? '<div class="bsl-avatar"><img src="'+String(user.avatar_url).replace(/"/g,'&quot;')+'" alt=""></div>'
      : '<div class="bsl-avatar">'+(signed ? String(user.name||user.email||'A').trim().slice(0,2).toUpperCase() : 'AX')+'</div>';
    const who = signed
      ? '<div class="bsl-userrow">'+av+'<div class="bsl-usercol"><div class="bsl-name">'+(user.display_name||user.name||'ASSISTIX')+'</div><div class="bsl-email">'+(user.email||'')+'</div></div></div>'
      : '<span class="bsl-user">'+tr.guest+'</span>';
    const html = '<div class="bsl-head"><span class="bsl-title">'+tr.limits+'</span></div><div style="margin-bottom:10px">'+who+'</div><div class="bsl-rings">'+rings+'</div><div class="bsl-actions">'+(signed
      ? '<button class="bsl-ghost" type="button" data-act="logout">'+tr.logout+'</button><button class="bsl-primary" type="button" data-act="refresh">'+tr.refresh+'</button>'
      : '<button class="bsl-primary" type="button" data-act="login">'+tr.login+'</button>')+'</div>';

    if (html === lastSideHtml && el.dataset.bound === "1") return;
    lastSideHtml = html;
    el.innerHTML = html;
    el.dataset.bound = "1";
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => {
      passwordErr = "";
      ensureAuthGate(lastData || { signedIn: false }, { force: false });
      const g = gateEl();
      try { g?.querySelector('[name="email"]')?.focus(); } catch {}
    });
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async () => {
      try { await stickySigned = null;
      lastData = { signedIn: false, user: null };
      try { await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); } catch {}
      await refresh({ force: true, allowSignOut: true });
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", () => refresh({ force: true }));
  };

  const enhanceLimitsPage = (data) => {
    if (document.querySelector('[aria-modal="true"]')) return;
    if (isGateFormInteractive()) return;
    const headings = [...document.querySelectorAll("h1,h2,p,[class*='title'],[class*='intro']")];
    const hit = headings.find((h) => /^(Limits|Лимиты|Models|Модели)$/i.test((h.textContent || "").trim())
      || /Tide, Flare|Weekly limits for Tide|Недельные лимиты/i.test(h.textContent || ""));
    if (!hit) {
      document.getElementById("beam-limits-panel")?.remove();
      return;
    }
    const host = hit.closest("section, [class*='section'], [class*='content'], main, div") || hit.parentElement;
    if (!host) return;
    let panel = document.getElementById("beam-limits-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "beam-limits-panel";
      host.appendChild(panel);
    }
    const tr = t();
    const meta = { tide: { tag: tr.tideTag, desc: tr.tideDesc }, flare: { tag: tr.flareTag, desc: tr.flareDesc }, pine: { tag: tr.pineTag, desc: tr.pineDesc } };
    panel.innerHTML = modelsFrom(data).map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      const info = meta[m.id];
      return '<div class="blp-card"><div class="blp-top"><div class="blp-name"><span class="blp-dot" style="background:'+m.color+'"></span>'+m.name+'</div><div class="blp-tag">'+info.tag+'</div></div><div class="blp-desc">'+info.desc+'</div><div class="blp-row"><span>'+tr.limits+'</span><span>'+fmt(m.used)+' / '+fmt(m.limit)+'</span></div><div class="blp-bar"><span style="width:'+pct+'%;background:linear-gradient(90deg,'+m.color+',#00B3BC)"></span></div></div>';
    }).join("");
  };

  // Soft text rewrite — ONLY exact leaf text nodes, never while modal open
  const rewriteLeafText = (root) => {
    if (!root || document.querySelector('[aria-modal="true"]')) return;
    if (isGateFormInteractive()) return;
    const pairs = [
      [/Deep diving for/gi, isRu() ? "Думаю ·" : "Thinking for"],
      [/Deep diving/gi, isRu() ? "Думаю" : "Thinking"],
      [/DeepSeek Harness/g, "Beam Agent"],
      [/DeepSeek Account/g, "ASSISTIX ID"],
      [/@deepseek-ai\\/dsh-client-ui-/g, ""],
      [/@deepseek-ai\\/dsh-/g, ""],
      [/@deepseek-ai\\//g, ""],
      [/DeepSeek/g, "ASSISTIX"],
      [/\\bHarness\\b/g, "Beam Agent"],
    ];
    if (isRu()) {
      pairs.push(
        [/^Models$/, "Лимиты"],
        [/^Limits$/, "Лимиты"],
        [/^General$/, "Общие"],
        [/^Settings$/, "Настройки"],
        [/^Language$/, "Язык"],
        [/^Open configuration file$/, "Открыть файл конфигурации"],
      );
    }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      if (n.parentElement?.closest?.("#beam-auth-gate,#beam-side-limits,#beam-limits-panel,script,style,textarea,input,[contenteditable=true]")) continue;
      // Only rewrite short leaf labels — never rewrite big blobs (breaks React)
      const raw = n.nodeValue;
      if (raw.length > 120) continue;
      let next = raw;
      for (const [a, b] of pairs) next = next.replace(a, b);
      if (next !== raw) n.nodeValue = next;
    }
  };

  const hideSettingsNavExtras = () => {
    // Only hide exact settings nav buttons — never parent containers
    const kill = /^(Built-in plugins|Встроенные плагины|Agent presets|Пресеты агента)$/i;
    for (const el of document.querySelectorAll("button, [role='tab']")) {
      const label = (el.innerText || "").trim().split("\\n")[0].trim();
      if (!kill.test(label)) continue;
      // must look like a settings nav item (short label)
      if (label.length > 40) continue;
      el.style.display = "none";
    }
  };

  const refresh = async (opts = {}) => {
    const force = !!opts.force;
    // While user types in the gate, skip status-driven UI churn (still allow forced login result)
    if (!force && isGateFormInteractive()) return;
    try {
      const r = await fetch(BRIDGE + "/assistix/status");
      lastData = await r.json();
    } catch {
      lastData = { signedIn: false, user: null, quotas: {} };
    }
    try {
      ensureAuthGate(lastData, { force: false });
      if (!isGateFormInteractive()) {
        renderSide(lastData);
        enhanceLimitsPage(lastData);
      }
    } catch (e) {
      console.warn("[beam] limits ui", e);
    }
  };

  const run = () => {
    if (running) return;
    // Never thrash UI while typing in auth form
    if (isGateFormInteractive()) return;
    running = true;
    try {
      document.title = "Beam Agent";
      // Never smash DOM while a modal/dialog is up (workspace picker etc.)
      if (document.querySelector('[aria-modal="true"]')) return;
      document.getElementById("beam-assistix-profile")?.remove();
      rewriteLeafText(document.body);
      hideSettingsNavExtras();
      ensureAuthGate(lastData || { signedIn: false }, { force: false });
      renderSide(lastData || { quotas: {} });
      enhanceLimitsPage(lastData || { quotas: {} });
    } catch (e) {
      console.warn("[beam] injector", e);
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (scheduled) return;
    if (isGateFormInteractive()) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; run(); }, 120);
  };

  const mutationTouchesBeamChrome = (mutation) => {
    const check = (node) => {
      if (!node || node.nodeType !== 1) return false;
      if (node.id === "beam-auth-gate" || node.id === "beam-side-limits" || node.id === "beam-limits-panel") return true;
      if (typeof node.closest === "function" && node.closest("#beam-auth-gate,#beam-side-limits,#beam-limits-panel")) return true;
      return false;
    };
    if (check(mutation.target)) return true;
    for (const n of mutation.addedNodes) if (check(n)) return true;
    for (const n of mutation.removedNodes) if (check(n)) return true;
    return false;
  };

  const armAuthPoll = () => {
    if (authPollTimer) clearInterval(authPollTimer);
    authPollTimer = setInterval(() => {
      if (lastData?.signedIn) { clearInterval(authPollTimer); authPollTimer = null; return; }
      if (isGateFormInteractive()) return; // pause while typing
      // Slow poll on password gate; faster only for pending confirm
      refresh({ force: false });
    }, lastData?.pendingUser ? 1200 : 8000);
  };

  const start = () => {
    run();
    refresh({ force: true });
    setInterval(() => {
      if (isGateFormInteractive()) return;
      refresh({ force: false });
    }, 20000);
    armAuthPoll();
    window.addEventListener("storage", (e) => { if (e.key === "beam-auth-ok") refresh({ force: true }); });
    window.addEventListener("beam-auth-return", () => refresh({ force: true }));
    window.addEventListener("focus", () => {
      if (isGateFormInteractive()) return;
      refresh({ force: false });
    });
    // Ignore our own gate/side mutations to prevent rebuild loops
    new MutationObserver((mutations) => {
      if (isGateFormInteractive()) return;
      if (mutations.every(mutationTouchesBeamChrome)) return;
      schedule();
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;

function patch(file) {
  let html = fs.readFileSync(file, "utf8");
  const start = html.indexOf("  let passwordBusy = false;");
  const alt = html.indexOf("  let authWaitUntil = 0;");
  const from = start >= 0 ? start : alt;
  if (from < 0) throw new Error("auth start not found: " + file);
  const endMarker = "</script>";
  // Replace from auth vars through end of IIFE script (exclusive of </script>)
  // Find the closing of our injector: `})();\n</script>` after from
  const close = html.indexOf("})();\n</script>", from);
  const close2 = html.indexOf("})();</script>", from);
  const closeIdx = close >= 0 ? close : close2;
  if (closeIdx < 0) throw new Error("IIFE close not found: " + file);
  const end = closeIdx + "})();".length;
  html = html.slice(0, from) + NEW_BLOCK + "\n" + html.slice(end);
  // Fix accidental double-escaping in rewrite pairs from template — restore single backslashes for regexes that need them
  // NEW_BLOCK used \\\\ in some places for @deepseek — verify file content
  fs.writeFileSync(file, html);
  console.log("patched", path.relative(ROOT, file));
}

const files = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

for (const f of files) {
  if (!fs.existsSync(f)) throw new Error("missing " + f);
  patch(f);
}

// Sanity checks
for (const f of files) {
  const h = fs.readFileSync(f, "utf8");
  const checks = {
    passwordOnly: h.includes("bag-password") && !h.includes("Войти через ASSISTIX ID") && !h.includes("openAssistix"),
    noRebuildHint: h.includes("isGateFormInteractive") && h.includes("updatePasswordChrome"),
    pausePoll: h.includes("pause while typing") || h.includes("isGateFormInteractive()) return"),
    ignoreMut: h.includes("mutationTouchesBeamChrome"),
  };
  console.log(path.relative(ROOT, f), checks);
}

console.log("done");
