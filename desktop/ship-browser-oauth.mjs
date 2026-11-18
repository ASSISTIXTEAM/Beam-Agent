/**
 * Ship browser OAuth for Beam Agent:
 * 1) bridge → assistix-agent client + loopback redirect (internal only)
 * 2) auth gate → system browser (primary), password as fallback
 * 3) sync desktop bridge → dist
 *
 * IMPORTANT: callback success HTML must NOT navigate to beam-agent:// /
 * dsh:// — that triggers Chrome «Open Beam Agent from 127.0.0.1».
 * App discovers pendingUser via /assistix/status polling instead.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const report = [];

function patch(file, fn) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${file}`);
    return false;
  }
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    report.push(`patched ${path.relative(ROOT, file)}`);
    return true;
  }
  report.push(`unchanged ${path.relative(ROOT, file)}`);
  return false;
}

// --- Bridge client ---
const bridges = [
  path.join(ROOT, "desktop", "bridge", "server.js"),
  path.join(ROOT, "dist", "Beam Agent", "bridge", "server.js"),
];

for (const file of bridges) {
  patch(file, (s) => {
    s = s.replace(
      /const OAUTH_CLIENT_ID = process\.env\.ASSISTIX_OAUTH_CLIENT_ID \|\| "[^"]+"/,
      'const OAUTH_CLIENT_ID = process.env.ASSISTIX_OAUTH_CLIENT_ID || "assistix-agent"'
    );
    s = s.replace(
      /const OAUTH_CLIENT_SECRET = process\.env\.ASSISTIX_OAUTH_CLIENT_SECRET \|\| "[^"]+"/,
      'const OAUTH_CLIENT_SECRET = process.env.ASSISTIX_OAUTH_CLIENT_SECRET || "YOUR_OAUTH_CLIENT_SECRET_HERE"'
    );
    // Comment: browser OAuth is primary
    s = s.replace(
      "// Primary: email+password against real ASSISTIX ID (no local guests, no OAuth browser)",
      "// Fallback: email+password against ASSISTIX ID (primary is system-browser OAuth via /assistix/login)"
    );
    return s;
  });
}

// --- Auth gate: browser-first ---
const NEW_MOUNT = `  const startBrowserLogin = async () => {
    if (passwordBusy) return;
    passwordBusy = true;
    passwordErr = "";
    ensureAuthGate(lastData || { signedIn: false }, { force: true });
    try {
      const r = await fetch(BRIDGE + "/assistix/login", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const j = await r.json().catch(() => ({}));
      const url = j.authUrl || j.loginUrl;
      if (!r.ok || !url) {
        passwordErr = authErrorRu(j.error || ("http_" + r.status));
        return;
      }
      // Electron setWindowOpenHandler → system browser
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      if (authPollTimer) clearInterval(authPollTimer);
      authPollTimer = setInterval(() => refresh({ force: true }), 1200);
      setTimeout(() => { if (authPollTimer) { clearInterval(authPollTimer); authPollTimer = null; } }, 180000);
    } catch (e) {
      passwordErr = authErrorRu((e && e.message) || e || "network_error");
    } finally {
      passwordBusy = false;
      ensureAuthGate(lastData || { signedIn: false }, { force: true });
    }
  };

  const mountPasswordGate = (gate, data, { focus } = {}) => {
    gate.dataset.mode = "password";
    gateMode = "password";
    formBound = false;
    const busyLabel = passwordBusy ? "Открываем браузер…" : "Войти через ASSISTIX ID";
    gate.innerHTML = '<div class="bag-card bag-password"><div class="bag-mark" aria-hidden="true"></div><h1>ASSISTIX ID</h1><p>Войдите в браузере — подтверждение появится здесь автоматически.</p><div class="bag-error" hidden></div><button type="button" class="bag-primary" data-act="browser-login">'+busyLabel+'</button><details class="bag-fallback"><summary>Войти email и паролем</summary><form class="bag-pw-form" data-act="pw-form"><label class="bag-label" for="beam-pw-email">Email</label><input id="beam-pw-email" class="bag-input" type="email" name="email" autocomplete="username" required placeholder="you@example.com"/><label class="bag-label" for="beam-pw-pass">Пароль</label><input id="beam-pw-pass" class="bag-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••"/><button type="submit">Войти</button></form></details><div class="bag-note">Сессия сохраняется на этом ПК.</div></div>';
    gate.querySelector('[data-act="browser-login"]')?.addEventListener("click", () => startBrowserLogin());
    bindPasswordFormOnce(gate);
    updatePasswordChrome(gate, data);
    const btn = gate.querySelector('[data-act="browser-login"]');
    if (btn) {
      btn.disabled = !!passwordBusy;
      btn.textContent = passwordBusy ? "Открываем браузер…" : "Войти через ASSISTIX ID";
    }
    if (focus) {
      setTimeout(() => {
        try { gate.querySelector('[data-act="browser-login"]')?.focus(); } catch {}
      }, 40);
    }
  };`;

const indexes = [
  path.join(
    ROOT,
    "dist",
    "Beam Agent",
    "resources",
    "app",
    "beam",
    "node_modules",
    "@assistix",
    "beam-web-frontend",
    "dist",
    "index.html"
  ),
  path.join(
    ROOT,
    "runtime",
    "app",
    "beam",
    "node_modules",
    "@assistix",
    "beam-web-frontend",
    "dist",
    "index.html"
  ),
];

for (const file of indexes) {
  patch(file, (s) => {
    // Replace mountPasswordGate function body start through its closing before mountConfirmGate
    const start = s.indexOf("  const mountPasswordGate = (gate, data, { focus } = {}) => {");
    const end = s.indexOf("  const mountConfirmGate = (gate, pending) => {");
    if (start < 0 || end < 0 || end <= start) {
      report.push(`WARN mountPasswordGate not found in ${path.relative(ROOT, file)}`);
      return s;
    }
    // Insert startBrowserLogin + new mountPasswordGate before mountConfirmGate
    // Remove old mountPasswordGate
    let out = s.slice(0, start) + NEW_MOUNT + "\n\n" + s.slice(end);

    // Also stop wiping auth poll on signed when we want — already clears on signed via ensureAuthGate
    out = out.replace(
      // Password-only login form
      "    // Password-only login form",
      "    // Browser OAuth primary (+ password fallback)"
    );

    // CSS for primary button + details if missing
    if (!out.includes(".bag-primary{") && out.includes(".bag-card button")) {
      out = out.replace(
        ".bag-card button{",
        ".bag-primary{width:100%;margin:0 0 12px;padding:11px 14px;border:0;border-radius:12px;font:700 13px/1.2 Savona,Segoe UI,system-ui,sans-serif;cursor:pointer;color:#042f2e;background:var(--beam,#00B3BC)}.bag-primary:disabled{opacity:.65;cursor:wait}.bag-fallback{margin-top:8px;color:#9ec9c3;font-size:13px}.bag-fallback summary{cursor:pointer;margin-bottom:10px}.bag-card button{"
      );
    }
    return out;
  });
}

// Copy desktop bridge → dist if different path already patched both
console.log(JSON.stringify(report, null, 2));
