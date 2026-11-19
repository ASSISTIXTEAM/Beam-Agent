/**
 * Beam Agent: password-only ASSISTIX ID login gate (no OAuth browser button).
 * Updates runtime + dist index.html auth injector, and hardens bridge login-password.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEW_AUTH_BLOCK = `  let passwordBusy = false;
  let passwordErr = "";
  let savedEmail = "";

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

  const submitPasswordLogin = async (email, password) => {
    if (passwordBusy) return;
    passwordBusy = true;
    passwordErr = "";
    savedEmail = email;
    ensureAuthGate(lastData || { signedIn: false });
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
      await refresh();
    } catch (e) {
      passwordErr = authErrorRu((e && e.message) || e || "network_error");
    } finally {
      passwordBusy = false;
      ensureAuthGate(lastData || { signedIn: false });
    }
  };

  const bindPasswordForm = (gate) => {
    const form = gate.querySelector('[data-act="pw-form"]');
    if (!form) return;
    const emailEl = form.querySelector('[name="email"]');
    if (emailEl && savedEmail && !emailEl.value) emailEl.value = savedEmail;
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const email = (form.querySelector('[name="email"]')?.value || "").trim();
      const password = form.querySelector('[name="password"]')?.value || "";
      if (!email || !password) {
        passwordErr = "Введите email и пароль";
        ensureAuthGate(lastData || { signedIn: false });
        return;
      }
      submitPasswordLogin(email, password);
    });
    if (!passwordBusy) {
      setTimeout(() => {
        const focusEl = gate.querySelector(savedEmail ? '[name="password"]' : '[name="email"]');
        try { focusEl?.focus(); } catch {}
      }, 30);
    }
  };

  const ensureAuthGate = (data) => {
    let gate = document.getElementById("beam-auth-gate");
    const signed = !!data?.signedIn && !!data?.user;
    const pending = (!signed && data?.pendingUser) ? data.pendingUser : null;
    if (signed) {
      if (gate) gate.hidden = true;
      document.documentElement.style.overflow = "";
      passwordErr = "";
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
      const name = pending.display_name || pending.name || "ASSISTIX";
      const email = pending.email || "";
      let avUrl = String(pending.avatar_url || '').trim();
      if (avUrl && avUrl.charAt(0) === '/') avUrl = 'https://id.assistix.org' + avUrl;
      const av = avUrl
        ? '<div class="bag-avatar"><img src="'+avUrl.replace(/"/g,'&quot;')+'" alt=""></div>'
        : '<div class="bag-avatar">'+String(name).trim().split(/\\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0]||''}).join('').toUpperCase()+'</div>';
      gate.innerHTML = '<div class="bag-card bag-confirm">'+av+'<h1>'+name.replace(/</g,'')+'</h1><p class="bag-email">'+email.replace(/</g,'')+'</p><p>Войти в Beam Agent с этим аккаунтом ASSISTIX ID?</p><button type="button" data-act="confirm">Да, войти</button><button type="button" class="bag-ghost" data-act="other">Другой аккаунт</button><div class="bag-note">После подтверждения вы сразу попадёте в приложение.</div></div>';
      gate.querySelector('[data-act="confirm"]')?.addEventListener("click", async () => {
        try { await fetch(BRIDGE + "/assistix/confirm", { method: "POST" }); } catch {}
        refresh();
      });
      gate.querySelector('[data-act="other"]')?.addEventListener("click", async () => {
        try { await fetch(BRIDGE + "/assistix/cancel-pending", { method: "POST" }); } catch {}
        passwordErr = "";
        refresh();
      });
      return false;
    }

    const err = passwordErr
      ? '<div class="bag-error">'+String(passwordErr).replace(/</g,'')+'</div>'
      : (data?.lastAuthError ? '<div class="bag-error">'+authErrorRu(data.lastAuthError).replace(/</g,'')+'</div>' : '');
    const busy = passwordBusy ? ' disabled' : '';
    gate.innerHTML = '<div class="bag-card bag-password"><div class="bag-mark" aria-hidden="true"></div><h1>ASSISTIX ID</h1><p>Войдите email и паролем от аккаунта ASSISTIX ID. Без входа доступ закрыт.</p>'+err+'<form class="bag-pw-form" data-act="pw-form"><label class="bag-label" for="beam-pw-email">Email</label><input id="beam-pw-email" class="bag-input" type="email" name="email" autocomplete="username" required placeholder="you@example.com"'+busy+'/><label class="bag-label" for="beam-pw-pass">Пароль</label><input id="beam-pw-pass" class="bag-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••"'+busy+'/><button type="submit"'+busy+'>'+(passwordBusy ? 'Входим…' : 'Войти')+'</button></form><div class="bag-note">Пароль проверяется на id.assistix.org через локальный bridge. Локальных гостевых аккаунтов нет.</div></div>';
    bindPasswordForm(gate);
    return false;
  };
`;

function patchIndexHtml(file) {
  let html = fs.readFileSync(file, "utf8");
  const start = html.indexOf("  let authWaitUntil = 0;");
  // also handle already-patched start
  const startAlt = html.indexOf("  let passwordBusy = false;");
  const endMarker = "  const renderSide = (data) => {";
  const end = html.indexOf(endMarker);
  if (end < 0) throw new Error("renderSide not found in " + file);

  let from = start >= 0 ? start : startAlt;
  if (from < 0) {
    // older shape
    from = html.indexOf("  const openAssistix");
    if (from < 0) throw new Error("auth block start not found in " + file);
  }

  html = html.slice(0, from) + NEW_AUTH_BLOCK + "\n" + html.slice(end);

  // Sidebar login: show gate / focus form, never OAuth browser
  html = html.replace(
    /el\.querySelector\('\[data-act="login"\]'\)\?\.addEventListener\("click", \(\) => openAssistix\(\)\);/,
    `el.querySelector('[data-act="login"]')?.addEventListener("click", () => { passwordErr = ""; ensureAuthGate(lastData || { signedIn: false }); });`
  );

  // Auth poll: drop authWaitUntil references
  html = html.replace(
    /\(lastData\?\.pendingUser \|\| lastData\?\.authWaiting \|\| \(authWaitUntil && Date\.now\(\) < authWaitUntil\)\) \? 900 : 2000/,
    "(lastData?.pendingUser) ? 900 : 2000"
  );

  if (/openAssistix|Войти через ASSISTIX ID|authWaitUntil|passwordMode/.test(html)) {
    // Allow remaining openAssistix only if somehow left — strip leftover refs in gate area
    if (html.includes("openAssistix") || html.includes("Войти через ASSISTIX ID")) {
      console.warn("WARN: leftover OAuth UI strings in", file);
    }
  }

  fs.writeFileSync(file, html);
  console.log("patched", path.relative(ROOT, file));
}

function patchBridge(file) {
  let src = fs.readFileSync(file, "utf8");

  if (!src.includes("function authErrorRu(")) {
    const insertAfter = "function publicUser(session) {";
    const idx = src.indexOf(insertAfter);
    if (idx < 0) throw new Error("publicUser not found");
    // insert before publicUser
    const helper = `
function authErrorRu(code) {
  const s = String(code || '').trim()
  if (!s) return 'Не удалось войти'
  if (/[А-Яа-яЁё]/.test(s)) return s
  const map = {
    email_password_required: 'Введите email и пароль',
    no_real_user: 'Не удалось получить профиль ASSISTIX ID',
    no_oauth_code: 'Не удалось завершить вход. Попробуйте ещё раз',
    invalid_assistix_user: 'Некорректный ответ ASSISTIX ID',
    network_error: 'Нет связи с ASSISTIX ID',
  }
  if (map[s]) return map[s]
  if (/^login_http_/i.test(s) || /^exchange_http_/i.test(s)) return 'Ошибка сервера ASSISTIX ID'
  if (/invalid|wrong|credential|password|unauthorized/i.test(s)) return 'Неверный email или пароль'
  return 'Не удалось войти: ' + s
}

`;
    src = src.slice(0, idx) + helper + src.slice(idx);
  }

  // Harden loginWithPassword headers + cookie follow
  const oldLoginFetch = `  const loginRes = await fetch(\`\${ID_BASE}/api/login-actions.php\`, {
    method: 'POST',
    body: fd,
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  })`;
  const newLoginFetch = `  const loginRes = await fetch(\`\${ID_BASE}/api/login-actions.php\`, {
    method: 'POST',
    body: fd,
    headers: {
      Accept: 'application/json',
      Origin: ID_BASE,
      Referer: \`\${ID_BASE}/auth/\`,
    },
    redirect: 'manual',
  })`;
  if (src.includes(oldLoginFetch)) src = src.replace(oldLoginFetch, newLoginFetch);

  // Map errors in login-password handler
  src = src.replace(
    `return sendJson(res, 401, { ok: false, error: 'no_real_user' })`,
    `return sendJson(res, 401, { ok: false, error: authErrorRu('no_real_user') })`
  );
  src = src.replace(
    `const status = Number(e.status) || 401
        return sendJson(res, status, { ok: false, error: String(e.message || e) })`,
    `const status = Number(e.status) || 401
        return sendJson(res, status, { ok: false, error: authErrorRu(e.message || e) })`
  );
  // Also store RU in lastAuthError
  src = src.replace(
    `st.lastAuthError = String(e.message || e)
        st.authWaiting = false
        saveState(st)
        try { fs.appendFileSync(path.join(DATA_DIR, 'bridge.log'), '[auth-password] ' + st.lastAuthError + '\\n') } catch {}`,
    `st.lastAuthError = authErrorRu(e.message || e)
        st.authWaiting = false
        saveState(st)
        try { fs.appendFileSync(path.join(DATA_DIR, 'bridge.log'), '[auth-password] ' + st.lastAuthError + '\\n') } catch {}`
  );

  // Improve oauth-finish headers
  const oldFinish = `    const finishRes = await fetch(\`\${ID_BASE}/api/oauth-finish.php\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/html',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: finishBody,
      redirect: 'manual',
    })`;
  const newFinish = `    const finishRes = await fetch(\`\${ID_BASE}/api/oauth-finish.php\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/html',
        Origin: ID_BASE,
        Referer: \`\${ID_BASE}/auth/\`,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: finishBody,
      redirect: 'manual',
    })`;
  if (src.includes(oldFinish)) src = src.replace(oldFinish, newFinish);

  // Comment update
  src = src.replace(
    " * Backup password login against real ASSISTIX ID:",
    " * Primary password login against real ASSISTIX ID:"
  );
  src = src.replace(
    "    // Backup: email+password against real ASSISTIX ID (no local guests)",
    "    // Primary: email+password against real ASSISTIX ID (no local guests, no OAuth browser)"
  );

  fs.writeFileSync(file, src);
  console.log("patched", path.relative(ROOT, file));
}

const htmlFiles = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

for (const f of htmlFiles) {
  if (!fs.existsSync(f)) throw new Error("missing " + f);
  patchIndexHtml(f);
}

const bridgeSrc = path.join(ROOT, "desktop/bridge/server.js");
const bridgeDist = path.join(ROOT, "dist/Beam-Agent/bridge/server.js");
patchBridge(bridgeSrc);
fs.copyFileSync(bridgeSrc, bridgeDist);
console.log("synced bridge → dist");

// Verify no OAuth primary CTA left in gates
for (const f of htmlFiles) {
  const h = fs.readFileSync(f, "utf8");
  const bad = [];
  if (h.includes("Войти через ASSISTIX ID")) bad.push("OAuth CTA");
  if (h.includes("openAssistix")) bad.push("openAssistix");
  if (h.includes("passwordMode")) bad.push("passwordMode");
  if (!h.includes("login-password")) bad.push("missing login-password");
  if (!h.includes("bag-password")) bad.push("missing bag-password");
  console.log(path.relative(ROOT, f), bad.length ? "FAIL " + bad.join(",") : "OK password-only");
}

console.log("done");
