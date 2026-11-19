/**
 * OAuth UX:
 * - Open only id.assistix.org (never localhost login page)
 * - Callback stores pending user, bounces to beam-agent://, auto-closes
 * - In-app confirm card: avatar / name / email → confirm → signed in
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const BRIDGE_SRC = path.join(ROOT, "desktop/bridge/server.js");
const BRIDGE_DIST = path.join(ROOT, "dist/Beam-Agent/bridge/server.js");
const INDEX = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"
);
const CSS = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"
);
const MAIN = path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js");
const RUNTIME_INDEX = path.join(
  ROOT,
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"
);

function patchBridge(file) {
  let s = fs.readFileSync(file, "utf8");

  // Replace serveLoginPage → redirect to OAuth
  const loginFnStart = s.indexOf("function serveLoginPage(res)");
  if (loginFnStart >= 0) {
    const nextFn = s.indexOf("\nconst server = http.createServer", loginFnStart);
    if (nextFn > loginFnStart) {
      s =
        s.slice(0, loginFnStart) +
        `function serveLoginPage(res) {
  const state = loadState()
  if (!state.oauth_nonce) {
    state.oauth_nonce = crypto.randomBytes(16).toString('hex')
    saveState(state)
  }
  // Never show a localhost login UI — bounce straight to ASSISTIX ID
  res.writeHead(302, {
    Location: buildAuthUrl(state.oauth_nonce),
    'Cache-Control': 'no-store',
  })
  res.end()
}

function serveCallbackBounce(res, ok, detail = '') {
  const target = ok ? 'beam-agent://auth/callback' : 'beam-agent://auth/error'
  const safe = String(detail || '').replace(/[<>&"']/g, '')
  const html = \`<!doctype html><html lang="ru"><head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=\${target}"/>
<title>Beam Agent</title>
<script>
(function(){
  try { location.replace(\${JSON.stringify('beam-agent://auth/callback')}); } catch (e) {}
  setTimeout(function(){ try { location.replace('dsh://open'); } catch (e) {} }, 40);
  setTimeout(function(){ try { window.close(); } catch (e) {} }, 180);
})();
</script>
<style>html,body{margin:0;height:100%;background:#041210;color:#9ec9c3;font-family:Segoe UI,system-ui,sans-serif;display:grid;place-items:center}</style>
</head><body><p>\${ok ? 'Возвращаем в Beam Agent…' : ('Ошибка входа' + (safe ? (': ' + safe) : ''))}</p></body></html>\`
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(html)
}

` +
        s.slice(nextFn);
    }
  }

  // Status endpoint: expose pendingUser, authUrl only (no localhost loginUrl)
  s = s.replace(
    /if \(url\.pathname === '\/assistix\/me' \|\| url\.pathname === '\/assistix\/status'\) \{[\s\S]*?return sendJson\(res, 200, \{[\s\S]*?\}\)\s*\n\s*\}/,
    `if (url.pathname === '/assistix/me' || url.pathname === '/assistix/status') {
      const state = loadState()
      const signed = isSignedIn(state)
      if (!state.oauth_nonce) {
        state.oauth_nonce = crypto.randomBytes(16).toString('hex')
        saveState(state)
      }
      return sendJson(res, 200, {
        signedIn: signed,
        user: signed ? publicUser(state.session) : null,
        pendingUser: (!signed && state.pendingSession) ? publicUser(state.pendingSession) : null,
        authUrl: buildAuthUrl(state.oauth_nonce),
        loginUrl: buildAuthUrl(state.oauth_nonce),
        quotas: state.quotas,
        models: Object.values(MODELS).map((m) => ({
          id: m.id,
          name: m.name,
          limit: m.limit,
          used: state.quotas[m.id]?.used || 0,
        })),
      })
    }`
  );

  // POST login → authUrl only
  s = s.replace(
    /if \(url\.pathname === '\/assistix\/login' && req\.method === 'POST'\) \{[\s\S]*?return sendJson\(res, 200, \{ ok: true, authUrl: buildAuthUrl\(state\.oauth_nonce\), loginUrl:[^}]+\}\)\s*\n\s*\}/,
    `if (url.pathname === '/assistix/login' && req.method === 'POST') {
      const state = loadState()
      if (!state.oauth_nonce) {
        state.oauth_nonce = crypto.randomBytes(16).toString('hex')
        saveState(state)
      }
      state.pendingSession = null
      saveState(state)
      return sendJson(res, 200, { ok: true, authUrl: buildAuthUrl(state.oauth_nonce), loginUrl: buildAuthUrl(state.oauth_nonce) })
    }`
  );

  // Confirm / cancel pending
  if (!s.includes("/assistix/confirm")) {
    s = s.replace(
      "if (url.pathname === '/assistix/logout' && req.method === 'POST') {",
      `if (url.pathname === '/assistix/confirm' && req.method === 'POST') {
      const state = loadState()
      if (!state.pendingSession) return sendJson(res, 400, { ok: false, error: 'no_pending' })
      state.session = state.pendingSession
      state.pendingSession = null
      if (!state.quotas) {
        state.quotas = {
          tide: { used: 0, limit: MODELS.tide.limit },
          flare: { used: 0, limit: MODELS.flare.limit },
          pine: { used: 0, limit: MODELS.pine.limit },
        }
      }
      saveState(state)
      return sendJson(res, 200, { ok: true, signedIn: true, user: publicUser(state.session) })
    }

    if (url.pathname === '/assistix/cancel-pending' && req.method === 'POST') {
      const state = loadState()
      state.pendingSession = null
      saveState(state)
      return sendJson(res, 200, { ok: true })
    }

    if (url.pathname === '/assistix/logout' && req.method === 'POST') {`
    );
  }

  // Logout also clears pending
  s = s.replace(
    /if \(url\.pathname === '\/assistix\/logout' && req\.method === 'POST'\) \{\s*const state = loadState\(\)\s*state\.session = null\s*saveState\(state\)/,
    `if (url.pathname === '/assistix/logout' && req.method === 'POST') {
      const state = loadState()
      state.session = null
      state.pendingSession = null
      saveState(state)`
  );

  // Callback → pendingSession + bounce page
  s = s.replace(
    /if \(url\.pathname === '\/assistix\/callback'\) \{[\s\S]*?return res\.end\(`<html><body style="font-family:Segoe UI;background:#05100f;color:#eaf5f3;display:grid;place-items:center;height:100vh;text-align:center;padding:24px"><div><h2>Ошибка входа<\/h2><p>\$\{String\(e\.message \|\| e\)\}<\/p><p><a style="color:#2dd4bf" href="\/assistix\/login">Попробовать снова<\/a><\/p><\/div><\/body><\/html>`\)\s*\}\s*\n\s*\}/,
    `if (url.pathname === '/assistix/callback') {
      const code = url.searchParams.get('code') || ''
      const oauthErr = url.searchParams.get('oauth_error') || url.searchParams.get('error') || ''
      if (oauthErr && !code) return serveCallbackBounce(res, false, oauthErr)
      if (!code) {
        res.writeHead(302, { Location: buildAuthUrl((loadState().oauth_nonce) || 'x') })
        return res.end()
      }
      try {
        const data = await exchangeCode(code)
        const state = loadState()
        state.pendingSession = sessionFromIdUser(data.user, { token: data.access_token || data.token || null })
        state.oauth_nonce = crypto.randomBytes(16).toString('hex')
        saveState(state)
        return serveCallbackBounce(res, true)
      } catch (e) {
        return serveCallbackBounce(res, false, e.message || e)
      }
    }`
  );

  fs.writeFileSync(file, s);
  console.log("bridge patched", path.basename(path.dirname(file)) + "/" + path.basename(file), {
    confirm: s.includes("/assistix/confirm"),
    bounce: s.includes("serveCallbackBounce"),
    pending: s.includes("pendingUser"),
  });
}

function patchIndex(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  // Replace ensureAuthGate function body via marker replace of the whole IIFE auth section
  const start = html.indexOf("  const ensureAuthGate = (data) => {");
  const end = html.indexOf("  const renderSide = (data) => {");
  if (start < 0 || end < 0) {
    console.warn("ensureAuthGate not found in", file);
    return;
  }

  const replacement = `  const openAssistix = (data) => {
    const url = (data && data.authUrl) || (lastData && lastData.authUrl);
    if (!url || !/^https:\\/\\/id\\.assistix\\.org\\b/i.test(url)) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ensureAuthGate = (data) => {
    let gate = document.getElementById("beam-auth-gate");
    const signed = !!data?.signedIn && !!data?.user;
    const pending = (!signed && data?.pendingUser) ? data.pendingUser : null;
    if (signed) {
      if (gate) gate.hidden = true;
      document.documentElement.style.overflow = "";
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
      const av = pending.avatar_url
        ? '<div class="bag-avatar"><img src="'+String(pending.avatar_url).replace(/"/g,'&quot;')+'" alt=""></div>'
        : '<div class="bag-avatar">'+String(name).trim().slice(0,2).toUpperCase()+'</div>';
      gate.innerHTML = '<div class="bag-card bag-confirm">'+av+'<h1>'+name.replace(/</g,'')+'</h1><p class="bag-email">'+email.replace(/</g,'')+'</p><p>Войти в Beam Agent с этим аккаунтом ASSISTIX ID?</p><button type="button" data-act="confirm">Да, войти</button><button type="button" class="bag-ghost" data-act="other">Другой аккаунт</button><div class="bag-note">После подтверждения вы сразу попадёте в приложение.</div></div>';
      gate.querySelector('[data-act="confirm"]')?.addEventListener("click", async () => {
        try { await fetch(BRIDGE + "/assistix/confirm", { method: "POST" }); } catch {}
        refresh();
      });
      gate.querySelector('[data-act="other"]')?.addEventListener("click", async () => {
        try { await fetch(BRIDGE + "/assistix/cancel-pending", { method: "POST" }); } catch {}
        refresh().then(() => openAssistix(lastData));
      });
      return false;
    }

    gate.innerHTML = '<div class="bag-card"><div class="bag-mark" aria-hidden="true"></div><h1>ASSISTIX ID</h1><p>Войдите в аккаунт, чтобы пользоваться Beam Agent. Без входа доступ закрыт.</p><button type="button" data-act="login">Войти через ASSISTIX ID</button><div class="bag-note">Откроется безопасная страница id.assistix.org. После входа вернёмся в Beam Agent.</div></div>';
    gate.querySelector('[data-act="login"]')?.addEventListener("click", () => openAssistix(data || lastData));
    return false;
  };

`;

  html = html.slice(0, start) + replacement + html.slice(end);

  // Fix sidebar login to use authUrl only
  html = html.replace(
    'el.querySelector(\'[data-act="login"]\')?.addEventListener("click", () => window.open(BRIDGE + "/assistix/login", "_blank"));',
    'el.querySelector(\'[data-act="login"]\')?.addEventListener("click", () => openAssistix(data || lastData));'
  );

  // Faster poll while waiting for OAuth / pending
  if (!html.includes("beam-auth-return")) {
    html = html.replace(
      "window.addEventListener(\"storage\", (e) => { if (e.key === \"beam-auth-ok\") refresh(); });",
      `window.addEventListener("storage", (e) => { if (e.key === "beam-auth-ok") refresh(); });
    window.addEventListener("beam-auth-return", () => refresh());
    window.addEventListener("focus", () => refresh());`
    );
  }

  // Tighten auth poll when not signed in
  html = html.replace(
    /let authPoll = setInterval\(\(\) => \{\s*if \(lastData\?\.signedIn\) \{ clearInterval\(authPoll\); return; \}\s*refresh\(\);\s*\}, 2500\);/,
    `let authPoll = setInterval(() => {
      if (lastData?.signedIn) { clearInterval(authPoll); return; }
      refresh();
    }, lastData?.pendingUser ? 1200 : 1600);`
  );

  fs.writeFileSync(file, html);
  console.log("index patched", file.includes("runtime") ? "runtime" : "dist");
}

function patchCss(file) {
  let css = fs.readFileSync(file, "utf8");
  css = css.replace(/\/\* ===== BEAM auth gate ===== \*\/[\s\S]*?(?=\n#beam-side-limits \.bsl-avatar|\n\/\* ===== BEAM boot)/, "");
  const block = `/* ===== BEAM auth gate ===== */
#beam-auth-gate {
  position: fixed; inset: 0; z-index: 2147483646;
  display: grid; place-items: center;
  background:
    radial-gradient(900px 500px at 10% -10%, rgba(0,179,188,.22), transparent 55%),
    radial-gradient(700px 400px at 100% 0%, rgba(45,212,191,.10), transparent 50%),
    rgba(4,18,16,.92);
  backdrop-filter: blur(10px);
  color: #e8f7f5;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif;
  padding: 24px;
}
#beam-auth-gate[hidden] { display: none !important; }
#beam-auth-gate .bag-card {
  width: min(420px, 100%);
  background: rgba(10,25,23,.96);
  border: 1px solid rgba(0,179,188,.35);
  border-radius: 20px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: 0 24px 60px rgba(0,0,0,.45);
}
#beam-auth-gate .bag-mark {
  width: 56px; height: 58px; margin: 0 auto 14px;
  background: url("./beam-mark.svg") center / contain no-repeat;
  filter: drop-shadow(0 0 14px rgba(0,179,188,.35));
}
#beam-auth-gate .bag-avatar {
  width: 72px; height: 72px; border-radius: 50%; overflow: hidden;
  margin: 0 auto 14px;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  display: grid; place-items: center;
  font-size: 22px; font-weight: 800; color: #042f2e;
  box-shadow: 0 0 0 3px rgba(0,179,188,.25);
}
#beam-auth-gate .bag-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
#beam-auth-gate h1 { margin: 0 0 8px; font-size: 22px; }
#beam-auth-gate .bag-email { margin: 0 0 12px !important; color: #7aaba4 !important; font-size: 13px !important; }
#beam-auth-gate p { margin: 0 0 18px; color: #9ec9c3; font-size: 14px; line-height: 1.45; }
#beam-auth-gate button {
  width: 100%; border: 0; border-radius: 12px; padding: 13px 16px;
  font-weight: 800; font-size: 14px; cursor: pointer;
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e); color: #042f2e;
  font-family: inherit;
}
#beam-auth-gate button.bag-ghost {
  margin-top: 10px;
  background: transparent;
  color: #9ec9c3;
  border: 1px solid rgba(0,179,188,.28);
  font-weight: 600;
}
#beam-auth-gate .bag-note { margin-top: 12px; font-size: 12px; color: #7aaba4; }

`;
  if (css.includes("#beam-side-limits .bsl-avatar")) {
    css = css.replace("#beam-side-limits .bsl-avatar", block + "#beam-side-limits .bsl-avatar");
  } else {
    css += "\n" + block;
  }
  fs.writeFileSync(file, css);
  console.log("css auth confirm styles ok");
}

function patchMain(file) {
  let s = fs.readFileSync(file, "utf8");
  // Register beam-agent protocol
  s = s.replace(
    'if (app.isPackaged || process.env.DSH_DESKTOP_DEV_APP === "1") app.setAsDefaultProtocolClient("dsh");',
    `if (app.isPackaged || process.env.DSH_DESKTOP_DEV_APP === "1") {
\t\tapp.setAsDefaultProtocolClient("dsh");
\t\tapp.setAsDefaultProtocolClient("beam-agent");
\t} else {
\t\tapp.setAsDefaultProtocolClient("beam-agent", process.execPath, [pathToFileURL(join(app.getAppPath(), "lib/main.js")).href]);
\t\ttry { app.setAsDefaultProtocolClient("dsh"); } catch {}
\t}`
  );

  // Need pathToFileURL import? Check if already imported
  if (!s.includes("pathToFileURL") && s.includes('setAsDefaultProtocolClient("beam-agent"')) {
    // fallback simpler registration without pathToFileURL for unpackaged
    s = s.replace(
      /if \(app\.isPackaged \|\| process\.env\.DSH_DESKTOP_DEV_APP === "1"\) \{[\s\S]*?\} else \{[\s\S]*?\n\t\}/,
      `app.setAsDefaultProtocolClient("dsh");
\tapp.setAsDefaultProtocolClient("beam-agent");`
    );
  }

  s = s.replace(
    `app.on("open-url", (event, url) => {
\t\tevent.preventDefault();
\t\tif (url === "dsh://open" || url === "dsh://open/") focusPrimaryWindow();
\t});`,
    `app.on("open-url", (event, url) => {
\t\tevent.preventDefault();
\t\tif (url === "dsh://open" || url === "dsh://open/" || String(url).startsWith("beam-agent://")) {
\t\t\tfocusPrimaryWindow();
\t\t\ttry {
\t\t\t\tconst win = currentMainWindow?.() ?? mainWindow;
\t\t\t\twin?.webContents?.executeJavaScript("window.dispatchEvent(new CustomEvent('beam-auth-return'))").catch(() => {});
\t\t\t} catch {}
\t\t}
\t});`
  );

  // second-instance argv → focus + notify
  s = s.replace(
    "function claimDesktopSingleInstance(application, focusOwner) {\n\tif (!application.requestSingleInstanceLock()) {\n\t\tapplication.quit();\n\t\treturn false;\n\t}\n\tapplication.on(\"second-instance\", focusOwner);\n\treturn true;\n}",
    `function claimDesktopSingleInstance(application, focusOwner) {
\tif (!application.requestSingleInstanceLock()) {
\t\tapplication.quit();
\t\treturn false;
\t}
\tapplication.on("second-instance", (_event, argv) => {
\t\tfocusOwner(argv);
\t});
\treturn true;
}`
  );

  s = s.replace(
    `if (claimDesktopSingleInstance(app, () => {
\tfocusPrimaryWindow();
}))`,
    `if (claimDesktopSingleInstance(app, (argv = []) => {
\tfocusPrimaryWindow();
\tconst hit = (Array.isArray(argv) ? argv : []).find((a) => typeof a === "string" && (a.startsWith("beam-agent://") || a.startsWith("dsh://")));
\tif (hit) {
\t\ttry {
\t\t\tconst win = typeof currentMainWindow === "function" ? currentMainWindow() : mainWindow;
\t\t\twin?.webContents?.executeJavaScript("window.dispatchEvent(new CustomEvent('beam-auth-return'))").catch(() => {});
\t\t} catch {}
\t}
}))`
  );

  fs.writeFileSync(file, s);
  console.log("main protocol handlers", {
    beamAgent: s.includes('setAsDefaultProtocolClient("beam-agent")'),
    openUrl: s.includes("beam-agent://"),
  });
}

patchBridge(BRIDGE_SRC);
patchBridge(BRIDGE_DIST);
patchIndex(INDEX);
if (fs.existsSync(RUNTIME_INDEX)) patchIndex(RUNTIME_INDEX);
patchCss(CSS);
patchMain(MAIN);
console.log("✓ oauth in-app confirm flow ready");
