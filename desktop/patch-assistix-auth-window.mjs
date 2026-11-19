/**
 * Open ASSISTIX ID inside an Electron BrowserWindow (not dead-end profile),
 * force "Continue in Beam Agent", intercept localhost callback → back to app.
 */
import fs from "node:fs";

const MAIN =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/lib/main.js";
const INDEX =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html";
const INDEX_RUNTIME =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html";
const BRIDGE_SRC =
  "C:/Beam-Agent/desktop/bridge/server.js";
const BRIDGE_DIST =
  "C:/Beam-Agent/dist/Beam-Agent/bridge/server.js";

const AUTH_HELPER = `
let assistixAuthWindow;
function notifyBeamAuthReturn() {
\ttry {
\t\tfocusPrimaryWindow();
\t} catch {}
\ttry {
\t\tfor (const win of BrowserWindow.getAllWindows()) {
\t\t\tif (assistixAuthWindow && win === assistixAuthWindow) continue;
\t\t\tif (win.isDestroyed()) continue;
\t\t\twin.webContents.executeJavaScript("window.dispatchEvent(new CustomEvent('beam-auth-return'))").catch(() => {});
\t\t}
\t} catch {}
}
function isAssistixAuthUrl(raw) {
\ttry {
\t\tconst u = new URL(raw);
\t\treturn u.protocol === "https:" && u.hostname === "id.assistix.org";
\t} catch {
\t\treturn false;
\t}
}
function isAssistixCallbackUrl(raw) {
\ttry {
\t\tconst u = new URL(raw);
\t\treturn (u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.port === "17865" && u.pathname.startsWith("/assistix/callback");
\t} catch {
\t\treturn false;
\t}
}
function isBeamDeepLink(raw) {
\treturn typeof raw === "string" && (raw.startsWith("beam-agent://") || raw.startsWith("dsh://"));
}
function openAssistixAuthWindow(authUrl) {
\tif (!isAssistixAuthUrl(authUrl)) {
\t\tshell.openExternal(authUrl);
\t\treturn;
\t}
\tif (assistixAuthWindow && !assistixAuthWindow.isDestroyed()) {
\t\tassistixAuthWindow.focus();
\t\tassistixAuthWindow.loadURL(authUrl).catch(() => {});
\t\treturn;
\t}
\tconst win = new BrowserWindow({
\t\twidth: 980,
\t\theight: 720,
\t\tminWidth: 420,
\t\tminHeight: 560,
\t\ttitle: "ASSISTIX ID — Beam Agent",
\t\tautoHideMenuBar: true,
\t\tbackgroundColor: "#041210",
\t\twebPreferences: {
\t\t\tnodeIntegration: false,
\t\t\tcontextIsolation: true,
\t\t\tsandbox: true,
\t\t\twebSecurity: true
\t\t}
\t});
\tassistixAuthWindow = win;
\tconst closeAndReturn = () => {
\t\tif (!win.isDestroyed()) win.close();
\t\tnotifyBeamAuthReturn();
\t};
\tconst finishWithCallback = (callbackUrl) => {
\t\tif (win.isDestroyed()) return;
\t\twin.loadURL(callbackUrl).catch(() => {});
\t\tsetTimeout(closeAndReturn, 900);
\t};
\tconst onNav = (event, url) => {
\t\tif (isBeamDeepLink(url)) {
\t\t\tevent.preventDefault();
\t\t\tcloseAndReturn();
\t\t\treturn;
\t\t}
\t\tif (!isAssistixCallbackUrl(url)) return;
\t\tevent.preventDefault();
\t\tfinishWithCallback(url);
\t};
\twin.webContents.on("will-redirect", onNav);
\twin.webContents.on("will-navigate", onNav);
\twin.webContents.setWindowOpenHandler(({ url }) => {
\t\tif (isBeamDeepLink(url) || isAssistixCallbackUrl(url)) {
\t\t\tif (isAssistixCallbackUrl(url)) finishWithCallback(url);
\t\t\telse closeAndReturn();
\t\t\treturn { action: "deny" };
\t\t}
\t\tif (isAssistixAuthUrl(url)) return { action: "allow" };
\t\ttry {
\t\t\tif (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
\t\t} catch {}
\t\treturn { action: "deny" };
\t});
\twin.webContents.on("did-finish-load", () => {
\t\tconst page = win.webContents.getURL();
\t\tif (isAssistixCallbackUrl(page)) {
\t\t\tsetTimeout(closeAndReturn, 600);
\t\t\treturn;
\t\t}
\t\tif (!isAssistixAuthUrl(page)) return;
\t\twin.webContents.executeJavaScript(\`(async () => {
  try {
    const sp = new URLSearchParams(location.search);
    const redirectUri = sp.get('redirect_uri') || '';
    const clientId = sp.get('client_id') || '';
    const state = sp.get('state') || '';
    if (!redirectUri || !clientId) return;
    const bj = await fetch('/api/bootstrap-login.php?' + sp.toString(), { credentials: 'include' }).then((r) => r.json());
    const form = document.getElementById('oauthFinishForm');
    const btn = document.getElementById('oauthContinueBtn');
    const redir = document.getElementById('oauthFinishRedirectUri');
    const client = document.getElementById('oauthFinishClientId');
    const st = document.getElementById('oauthFinishState');
    const cab = document.getElementById('sessionResumeProfileRow');
    const hint = document.getElementById('sessionResumeHint');
    if (cab) cab.style.display = 'none';
    const label = document.querySelector('[data-i18n="session_resume_title"], .session-resume-title, #sessionResumeTitle');
    if (label) label.textContent = 'Вернуться в Beam Agent';
    if (!(bj && bj.logged_in && bj.user && form && btn && redir && client && st)) return;
    redir.value = (bj.oauth_finish && bj.oauth_finish.redirect_uri) || redirectUri;
    client.value = (bj.oauth_finish && bj.oauth_finish.client_id) || clientId;
    st.value = (bj.oauth_finish && bj.oauth_finish.state) || state;
    form.classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.textContent = 'Продолжить в Beam Agent';
    if (hint) {
      hint.classList.remove('hidden');
      hint.textContent = 'Beam Agent ждёт вход под этим аккаунтом. Сейчас вернём вас в приложение…';
    }
    setTimeout(() => { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (e) {} }, 280);
  } catch (e) {}
})();\`).catch(() => {});
\t});
\twin.on("closed", () => {
\t\tif (assistixAuthWindow === win) assistixAuthWindow = void 0;
\t\tnotifyBeamAuthReturn();
\t});
\twin.loadURL(authUrl).catch(() => {
\t\tshell.openExternal(authUrl);
\t});
}
`;

let main = fs.readFileSync(MAIN, "utf8");

if (!main.includes("function openAssistixAuthWindow")) {
  if (!main.includes("function createWindow(preload, show = false, primary = false) {")) {
    throw new Error("createWindow marker not found in main.js");
  }
  main = main.replace(
    "function createWindow(preload, show = false, primary = false) {",
    AUTH_HELPER + "\nfunction createWindow(preload, show = false, primary = false) {"
  );
}

const OLD_HANDLER = `window.webContents.setWindowOpenHandler(({ url }) => {
\t\tif (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
\t\treturn { action: "deny" };
\t});`;

const NEW_HANDLER = `window.webContents.setWindowOpenHandler(({ url }) => {
\t\ttry {
\t\t\tconst parsed = new URL(url);
\t\t\tif (parsed.protocol === "https:" && parsed.hostname === "id.assistix.org") {
\t\t\t\topenAssistixAuthWindow(url);
\t\t\t\treturn { action: "deny" };
\t\t\t}
\t\t\tif (["http:", "https:"].includes(parsed.protocol)) shell.openExternal(url);
\t\t} catch {
\t\t\tshell.openExternal(url);
\t\t}
\t\treturn { action: "deny" };
\t});`;

if (main.includes("openAssistixAuthWindow(url)")) {
  console.log("main handler already patched");
} else if (main.includes(OLD_HANDLER)) {
  main = main.replace(OLD_HANDLER, NEW_HANDLER);
} else {
  throw new Error("setWindowOpenHandler block not found for createWindow");
}

fs.writeFileSync(MAIN, main);
console.log("main auth window", main.includes("openAssistixAuthWindow"));

const NOTE_OLD =
  "Откроется безопасная страница id.assistix.org. После входа вернёмся в Beam Agent с вашим реальным профилем.";
const NOTE_NEW =
  "Откроется окно ASSISTIX ID. Если вы уже вошли — сразу вернёмся в Beam Agent с вашим профилем.";

for (const file of [INDEX, INDEX_RUNTIME]) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(NOTE_OLD)) html = html.replace(NOTE_OLD, NOTE_NEW);
  fs.writeFileSync(file, html);
  console.log("index note", file.includes("runtime") ? "runtime" : "dist");
}

for (const file of [BRIDGE_SRC, BRIDGE_DIST]) {
  let s = fs.readFileSync(file, "utf8");
  const oldState =
    "const state = Buffer.from(JSON.stringify({ app: 'beam-agent', nonce: stateToken }), 'utf8').toString('base64url')";
  const newState =
    "const state = Buffer.from(JSON.stringify({ app: 'beam-agent', product: 'Beam Agent', nonce: stateToken }), 'utf8').toString('base64url')";
  if (s.includes(oldState)) s = s.replace(oldState, newState);
  fs.writeFileSync(file, s);
  console.log("bridge state", file.includes("dist") ? "dist" : "src");
}

console.log("✓ assistix auth window patch applied");
