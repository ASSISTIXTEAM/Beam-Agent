/**
 * Restyle #beam-auth-gate to match Settings / profile modal:
 * quiet surfaces, Beam tokens, no neon teal glow DIY card.
 * Shorter RU copy. Applies to runtime + dist (@assistix + @deepseek-ai).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEW_CSS = `/* ===== BEAM auth gate — quiet Settings-like surface (no neon glow) ===== */
#beam-auth-gate {
  position: fixed; inset: 0; z-index: 2147483646;
  display: grid; place-items: center;
  background: rgba(2, 8, 7, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--beam-ink, #f2faf8);
  font-family: "Savona", "Segoe UI", system-ui, sans-serif;
  padding: 24px;
}
#beam-auth-gate[hidden] { display: none !important; }
#beam-auth-gate .bag-card {
  width: min(400px, 100%);
  background: var(--dsw-alias-bg-layer-2, var(--beam-elev, #182926));
  border: 1px solid var(--beam-line, rgba(255, 255, 255, 0.08));
  border-radius: var(--dsw-radius-panel, 20px);
  padding: 28px 24px 22px;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.48);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate {
  background: rgba(10, 36, 34, 0.45);
  color: var(--beam-light-ink, #0a2422);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-card {
  background: var(--beam-light-surface, #fff);
  border-color: var(--beam-light-line, rgba(10, 36, 34, 0.1));
  color: var(--beam-light-ink, #0a2422);
  box-shadow: 0 24px 64px rgba(10, 36, 34, 0.18);
}
#beam-auth-gate .bag-mark {
  width: 40px; height: 42px; margin: 0 auto 14px;
  background: url("./beam-mark.svg") center / contain no-repeat;
  opacity: 0.92;
}
#beam-auth-gate .bag-avatar {
  width: 56px; height: 56px; border-radius: 999px; overflow: hidden;
  margin: 0 auto 14px;
  background: var(--beam-elev-2, #203430);
  border: 1px solid var(--beam-line, rgba(255, 255, 255, 0.08));
  display: grid; place-items: center;
  font-size: 18px; font-weight: 700; color: var(--beam-ink, #f2faf8);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-avatar {
  background: var(--beam-light-elev-2, #dde8e6);
  border-color: var(--beam-light-line, rgba(10, 36, 34, 0.1));
  color: var(--beam-light-ink, #0a2422);
}
#beam-auth-gate .bag-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
#beam-auth-gate h1 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: var(--beam-ink, #f2faf8);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate h1 {
  color: var(--beam-light-ink, #0a2422);
}
#beam-auth-gate .bag-email {
  margin: 0 0 10px !important;
  color: var(--beam-muted, #9aada9) !important;
  font-size: 13px !important;
  font-weight: 400 !important;
}
#beam-auth-gate p {
  margin: 0 0 18px;
  color: var(--beam-muted, #9aada9);
  font-size: 13px;
  line-height: 1.5;
  font-weight: 400;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate p,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-email {
  color: var(--beam-light-muted, #5a6e6b) !important;
}
#beam-auth-gate button,
#beam-auth-gate .bag-primary {
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 11px 14px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  background: var(--beam, #00B3BC);
  color: #042f2e;
  font-family: inherit;
  transition: background 0.15s ease;
}
#beam-auth-gate button:hover:not(:disabled),
#beam-auth-gate .bag-primary:hover:not(:disabled) {
  background: var(--beam-deep, #0d9488);
}
#beam-auth-gate button.bag-ghost {
  margin-top: 8px;
  background: var(--beam-elev, #182926);
  color: var(--beam-ink, #f2faf8);
  border: 1px solid var(--beam-line, rgba(255, 255, 255, 0.08));
  font-weight: 600;
}
#beam-auth-gate button.bag-ghost:hover:not(:disabled) {
  background: var(--beam-elev-2, #203430);
  border-color: rgba(255, 255, 255, 0.12);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate button.bag-ghost {
  background: var(--beam-light-elev, #fff);
  color: var(--beam-light-ink, #0a2422);
  border-color: var(--beam-light-line, rgba(10, 36, 34, 0.1));
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate button.bag-ghost:hover:not(:disabled) {
  background: var(--beam-light-elev-2, #dde8e6);
}
#beam-auth-gate .bag-note {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--beam-soft, #6f827e);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-note {
  color: var(--beam-light-muted, #5a6e6b);
}
#beam-auth-gate .bag-error {
  margin: 0 0 14px; padding: 10px 12px; border-radius: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.28);
  color: #fecaca; font-size: 12px; line-height: 1.4;
  text-align: left;
}
#beam-auth-gate .bag-error[hidden] { display: none !important; }
#beam-auth-gate .bag-fallback {
  margin-top: 10px;
  color: var(--beam-muted, #9aada9);
  font-size: 13px;
}
#beam-auth-gate .bag-fallback > summary {
  list-style: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 8px;
  margin: 0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--beam-muted, #9aada9);
  transition: color 0.15s ease, background 0.15s ease;
}
#beam-auth-gate .bag-fallback > summary::-webkit-details-marker { display: none; }
#beam-auth-gate .bag-fallback > summary::before {
  content: "";
  width: 0; height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
  opacity: 0.55;
  transition: transform 0.15s ease;
}
#beam-auth-gate .bag-fallback[open] > summary::before {
  transform: rotate(90deg);
}
#beam-auth-gate .bag-fallback > summary:hover {
  color: var(--beam-ink, #f2faf8);
  background: rgba(255, 255, 255, 0.04);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-fallback > summary {
  color: var(--beam-light-muted, #5a6e6b);
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-fallback > summary:hover {
  color: var(--beam-light-ink, #0a2422);
  background: rgba(10, 36, 34, 0.05);
}
#beam-auth-gate .bag-pw-form {
  display: flex; flex-direction: column; gap: 8px;
  text-align: left; margin: 4px 0 0;
}
#beam-auth-gate .bag-label {
  font-size: 12px; font-weight: 600;
  color: var(--beam-muted, #9aada9); margin-top: 4px;
}
#beam-auth-gate .bag-input {
  width: 100%; box-sizing: border-box;
  border-radius: 12px;
  border: 1px solid var(--beam-line, rgba(255, 255, 255, 0.08));
  background: var(--beam-surface, #101c1b);
  color: var(--beam-ink, #f2faf8);
  padding: 11px 13px; font-size: 14px; font-family: inherit;
  outline: none;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
#beam-auth-gate .bag-input:focus {
  border-color: rgba(0, 179, 188, 0.45);
  box-shadow: 0 0 0 3px rgba(0, 179, 188, 0.12);
}
#beam-auth-gate .bag-input::placeholder { color: var(--beam-soft, #6f827e); }
body:not([data-ds-dark-theme]):not([data-theme="dark"]) #beam-auth-gate .bag-input {
  background: var(--beam-light-canvas, #eef5f4);
  border-color: var(--beam-light-line, rgba(10, 36, 34, 0.1));
  color: var(--beam-light-ink, #0a2422);
}
#beam-auth-gate .bag-password button[type="submit"] { margin-top: 8px; }
#beam-auth-gate button:disabled { opacity: .65; cursor: wait; }`;

const CSS_START = "/* ===== BEAM auth gate ===== */";
const CSS_START_ALT = "/* ===== BEAM auth gate — quiet Settings-like surface (no neon glow) ===== */";
const CSS_END_MARKER = "/* Primary CTAs a bit softer, like Beam web */";

const htmlFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

const cssFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
];

const settingsFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-settings-account/lib/client.js"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-settings-account/lib/client.js"),
];

function patchCss(file) {
  let s = fs.readFileSync(file, "utf8");
  let start = s.indexOf(CSS_START_ALT);
  if (start < 0) start = s.indexOf(CSS_START);
  const end = s.indexOf(CSS_END_MARKER);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`auth gate CSS block not found in ${path.relative(ROOT, file)}`);
  }
  s = s.slice(0, start) + NEW_CSS + "\n\n" + s.slice(end);
  fs.writeFileSync(file, s);
  return path.relative(ROOT, file);
}

function replaceIfPresent(haystack, needle, replacement) {
  const i = haystack.indexOf(needle);
  if (i < 0) return { text: haystack, changed: false };
  return {
    text: haystack.slice(0, i) + replacement + haystack.slice(i + needle.length),
    changed: true,
  };
}

function patchHtml(file) {
  let s = fs.readFileSync(file, "utf8");
  let changes = 0;

  const swaps = [
    [
      "<h1>Ждём вход</h1><p>Завершите вход в браузере ASSISTIX ID, затем вернитесь сюда. Подтверждение аккаунта появится автоматически — страницу в браузере можно закрыть.</p>",
      "<h1>Ожидание входа</h1><p>Завершите вход в браузере ASSISTIX ID, затем вернитесь сюда.</p>",
    ],
    [
      "<h1>ASSISTIX ID</h1><p>Откроется браузер ASSISTIX ID. После входа вернитесь в Beam Agent — подтверждение появится здесь само. Страницу в браузере можно закрыть.</p>",
      "<h1>ASSISTIX ID</h1><p>Войдите в браузере — подтверждение появится здесь автоматически.</p>",
    ],
    [
      "Сессия сохраняется на этом ПК и не сбрасывается после перезапуска.",
      "Сессия сохраняется на этом ПК.",
    ],
    [
      '<p>Войти в Beam Agent с этим аккаунтом ASSISTIX ID?</p><button type="button" data-act="confirm">Да, войти</button>',
      '<p>Войти с этим аккаунтом ASSISTIX ID?</p><button type="button" class="bag-primary" data-act="confirm">Да, войти</button>',
    ],
    [
      "После подтверждения вы сразу попадёте в приложение.",
      "После подтверждения откроется приложение.",
    ],
  ];

  for (const [from, to] of swaps) {
    const r = replaceIfPresent(s, from, to);
    s = r.text;
    if (r.changed) changes++;
  }

  // Ensure confirm primary class even if copy already shortened
  if (!s.includes('class="bag-primary" data-act="confirm"')) {
    const r = replaceIfPresent(
      s,
      '<button type="button" data-act="confirm">Да, войти</button>',
      '<button type="button" class="bag-primary" data-act="confirm">Да, войти</button>'
    );
    s = r.text;
    if (r.changed) changes++;
  }

  if (!s.includes("Ожидание входа") || !s.includes("Войдите в браузере — подтверждение") || !s.includes("Войти с этим аккаунтом ASSISTIX ID?")) {
    throw new Error(`incomplete HTML patch in ${path.relative(ROOT, file)}`);
  }
  if (changes) fs.writeFileSync(file, s);
  return `${path.relative(ROOT, file)} (${changes} swaps)`;
}

function patchSettings(file) {
  if (!fs.existsSync(file)) return null;
  let s = fs.readFileSync(file, "utf8");
  const reps = [
    ['"settingsSignedOutTitle": "You are not signed in to Beam Agent"', '"settingsSignedOutTitle": "Вход в Beam Agent"'],
    ['"settingsSignedOutDescription": "Войдите в Beam Agent, чтобы продолжить"', '"settingsSignedOutDescription": "Войдите через ASSISTIX ID, чтобы продолжить."'],
    ['"signedOut": "Нетt signed in"', '"signedOut": "Не выполнен вход"'],
    ['"loginDescription": "Войдите через ASSISTIX ID. Проекты и файлы хранятся локально."', '"loginDescription": "Войдите через ASSISTIX ID. Проекты хранятся локально."'],
  ];
  let n = 0;
  for (const [a, b] of reps) {
    if (s.includes(a)) {
      s = s.replace(a, b);
      n++;
    }
  }
  if (n) fs.writeFileSync(file, s);
  return `${path.relative(ROOT, file)} (${n} strings)`;
}

const report = [];
for (const f of cssFiles) report.push("css: " + patchCss(f));
for (const f of htmlFiles) report.push("html: " + patchHtml(f));
for (const f of settingsFiles) {
  const r = patchSettings(f);
  if (r) report.push("settings: " + r);
}

// Keep ship script copy aligned for future re-applies
const ship = path.join(ROOT, "desktop/ship-browser-oauth.mjs");
if (fs.existsSync(ship)) {
  let s = fs.readFileSync(ship, "utf8");
  const next = s
    .replace(
      /Вход как в крупных сервисах:[^<]*/,
      "Войдите в браузере — подтверждение появится здесь автоматически."
    )
    .replace(
      /Сессия сохраняется локально на этом ПК — не сбрасывается после перезапуска\./,
      "Сессия сохраняется на этом ПК."
    )
    .replace(
      /\.bag-primary\{width:100%;margin:0 0 12px;padding:14px 16px;border:0;border-radius:16px;font:800 15px\/1\.2 Segoe UI,system-ui,sans-serif;cursor:pointer;color:#042f2e;background:linear-gradient\(135deg,#2dd4bf,#00B3BC 55%,#0f766e\)\}/,
      ".bag-primary{width:100%;margin:0 0 12px;padding:11px 14px;border:0;border-radius:12px;font:700 13px/1.2 Savona,Segoe UI,system-ui,sans-serif;cursor:pointer;color:#042f2e;background:var(--beam,#00B3BC)}"
    );
  if (next !== s) {
    fs.writeFileSync(ship, next);
    report.push("ship: desktop/ship-browser-oauth.mjs");
  }
}

console.log(JSON.stringify(report, null, 2));
