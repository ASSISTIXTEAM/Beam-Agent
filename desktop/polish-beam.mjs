/**
 * Polish Beam Agent: Tide/Flare/Pine only, Assistix profile, theme, logos.
 * No Custom API / provider-key UX. No DeepSeek whale leftovers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "dist", "Beam-Agent", "resources", "app");
const DSH = path.join(APP, "dsh", "node_modules", "@deepseek-ai");
const WEB = path.join(DSH, "dsh-web-frontend", "dist");
const ASSETS = path.join(WEB, "assets");

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const wordSvg = fs.readFileSync(path.join(ROOT, "logo-beam-agent.svg"), "utf8");
const toCC = (s) => s.replaceAll('fill="#00B3BC"', 'fill="currentColor"');
const dataUri = (s) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(toCC(s));
const LOGO = dataUri(logoSvg);
const WORD = dataUri(wordSvg);

function replaceAllPairs(file, pairs) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  let n = s;
  for (const [a, b] of pairs) n = n.split(a).join(b);
  if (n !== s) {
    fs.writeFileSync(file, n);
    return true;
  }
  return false;
}

console.log("0) Boot splash HARNESS → BEAM");
{
  const indexJs = path.join(ASSETS, "index-BXV-oxvX.js");
  if (fs.existsSync(indexJs)) {
    let s = fs.readFileSync(indexJs, "utf8");
    s = s.split('wordmark,"HARNESS"').join('wordmark,"BEAM"');
    s = s.split("Loading plugins…").join("Loading Beam…");
    fs.writeFileSync(indexJs, s);
  }
}

console.log("1) Clean Tide / Flare / Pine catalog (no backend brand names)");
{
  const llm = path.join(DSH, "dsh-llm-deepseek", "lib", "index.js");
  let s = fs.readFileSync(llm, "utf8");
  s = s.replace(
    /DEFAULT_MODELS = \[[\s\S]*?\];/,
    `DEFAULT_MODELS = [{
\tid: "tide",
\tname: "Tide",
\tdescription: "Быстрая модель Beam — до 1M токенов",
\tcontextWindow: OFFICIAL_CONTEXT_WINDOW,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "flare",
\tname: "Flare",
\tdescription: "Сбалансированная модель Beam — до 500K токенов",
\tcontextWindow: 524288,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "pine",
\tname: "Pine",
\tdescription: "Сильный режим Beam — до 10K токенов",
\tcontextWindow: 16384
}];`
  );
  fs.writeFileSync(llm, s);
  console.log("  models catalog ok");
}

console.log("2) Provider label → Beam Agent (not Assistix custom key)");
{
  const apiKey = path.join(DSH, "dsh-llm-deepseek-api-key", "lib", "index.js");
  replaceAllPairs(apiKey, [
    ['displayName: "Assistix"', 'displayName: "Beam Agent"'],
    ["displayName: 'Assistix'", "displayName: 'Beam Agent'"],
    ['providerName: "Assistix"', 'providerName: "Beam Agent"'],
    ["providerName: 'Assistix'", "providerName: 'Beam Agent'"],
    ['displayName: "DeepSeek"', 'displayName: "Beam Agent"'],
    ["displayName: 'DeepSeek'", "displayName: 'Beam Agent'"],
    ['providerName: "DeepSeek"', 'providerName: "Beam Agent"'],
    ["providerName: 'DeepSeek'", "providerName: 'Beam Agent'"],
    ['displayName: "Beam"', 'displayName: "Beam Agent"'],
    ["displayName: 'Beam'", "displayName: 'Beam Agent'"],
    ['providerName: "Beam"', 'providerName: "Beam Agent"'],
    ["providerName: 'Beam'", "providerName: 'Beam Agent'"],
  ]);
}

console.log("3) Models settings copy — no custom API / key onboarding");
{
  const modelsUi = path.join(DSH, "dsh-client-ui-settings-models", "lib", "client.js");
  replaceAllPairs(modelsUi, [
    [
      'intro: "Enter your API keys to use models from the following providers."',
      'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
    ],
    [
      'add: "Add model provider"',
      'add: "Advanced (hidden)"',
    ],
    [
      'addCustom: "Custom model API"',
      'addCustom: "Custom model API"',
    ],
    [
      'onboardingTitle: "Add an API key to get started"',
      'onboardingTitle: "Sign in with ASSISTIX ID to use Tide, Flare and Pine"',
    ],
    [
      'credentialConfigured: "API key configured"',
      'credentialConfigured: "Connected via ASSISTIX"',
    ],
    [
      'credentialMissing: "API key missing"',
      'credentialMissing: "Sign in with ASSISTIX ID"',
    ],
    [
      'keyInput: "API key"',
      'keyInput: "Access"',
    ],
    [
      'deepSeekAccount: "ASSISTIX ID"',
      'deepSeekAccount: "ASSISTIX ID"',
    ],
  ]);
}

console.log("4) Hero / whale theme copy → Beam");
{
  const conv = path.join(DSH, "dsh-client-ui-conversation", "lib", "client.js");
  replaceAllPairs(conv, [
    ["Into the Unknown", "Build with Beam"],
    ["Build with Beam", "Build with Beam"],
  ]);
  // Keep HeroFish as Beam img if already patched; ensure alt/text
  let s = fs.readFileSync(conv, "utf8");
  if (s.includes("function HeroFish({ hovering }) {") && !s.includes('alt: "Beam"')) {
    console.log("  hero still svg — re-run patch-hero separately if needed");
  }
}

console.log("5) Nuclear Beam theme + hide custom-key chrome + profile styles");
const css = `/* ===== BEAM AGENT — Assistix visual system ===== */
:root {
  --beam: #00B3BC;
  --beam-bright: #2dd4bf;
  --beam-deep: #0d9488;
  --beam-ink: #e8f7f5;
  --beam-muted: #9ec9c3;
  --beam-bg: #041210;
  --beam-surface: #0a1917;
  --beam-elev: #102220;
  --beam-line: #1a3a36;
  --beam-danger: #f07178;

  --dsw-alias-brand-primary: var(--beam) !important;
  --dsw-alias-button-primary-fill: var(--beam) !important;
  --dsw-alias-button-primary-hover: var(--beam-deep) !important;
  --dsw-alias-state-business-primary: var(--beam) !important;
  --dsw-alias-link: var(--beam-bright) !important;
  --dsw-focus-ring-color: var(--beam) !important;
  --dsw-static-deepseek-500: var(--beam) !important;
  --dsw-static-deepseek-450: var(--beam-bright) !important;
  --dsw-static-deepseek-400: var(--beam-bright) !important;
  --dsw-static-deepseek-350: #5eead4 !important;
  --dsw-static-deepseek-300: #99f6e4 !important;
  --dsw-static-deepseek-200: #ccfbf1 !important;
}

html, body, #root {
  background:
    radial-gradient(1000px 560px at -8% -20%, rgba(0,179,188,.20), transparent 58%),
    radial-gradient(820px 480px at 108% -5%, rgba(45,212,191,.09), transparent 52%),
    var(--beam-bg) !important;
  color: var(--beam-ink) !important;
  color-scheme: dark !important;
}

body[data-ds-dark-theme], :root[data-theme="dark"], html.dark {
  --dsw-alias-bg-base: var(--beam-bg) !important;
  --dsw-alias-bg-layer-1: var(--beam-surface) !important;
  --dsw-alias-bg-layer-2: var(--beam-elev) !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-bg-layer-4: #1a3531 !important;
  --dsw-alias-bg-module-platform: var(--beam-surface) !important;
  --dsw-alias-border-l1: var(--beam-line) !important;
  --dsw-alias-border-l2: #24504a !important;
  --dsw-alias-border-l3: #2f5f58 !important;
  --dsw-alias-border-l4: #3a736a !important;
  --dsw-alias-label-primary: var(--beam-ink) !important;
  --dsw-alias-label-secondary: var(--beam-muted) !important;
  --dsw-alias-label-tertiary: #7aaba4 !important;
  --dsw-alias-markdown-code-block: var(--beam-surface) !important;
  --dsw-alias-markdown-code-block-banner: var(--beam-elev) !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-menu-surface-fill: rgba(10,25,23,.94) !important;
}

/* Brand chrome */
[class*="logoRow"] svg {
  width: 28px !important; height: 29px !important;
  color: var(--beam) !important; background: currentColor !important;
  -webkit-mask: url("${LOGO}") center / contain no-repeat !important;
  mask: url("${LOGO}") center / contain no-repeat !important;
}
[class*="logoRow"] svg * { opacity: 0 !important; }
[class*="_wordmark_"] {
  width: 220px !important; height: 36px !important;
  background: url("${WORD}") center / contain no-repeat !important;
  color: transparent !important; font-size: 0 !important;
}

[class*="_primary_"], button[data-variant="primary"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important; border: none !important;
}
::selection { background: rgba(45,212,191,.35) !important; }
:focus-visible { outline-color: var(--beam) !important; }

/* Hide Harness custom-provider / API-key chrome — Beam uses ASSISTIX + 3 models */
[class*="addBlock"],
[class*="AddBlock"],
button[aria-label*="Custom model" i],
button[aria-label*="Add model provider" i],
button[aria-label*="Third-party" i],
[data-testid*="custom-provider" i] {
  display: none !important;
}

/* Assistix profile dock */
#beam-assistix-profile {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483000;
  width: min(300px, calc(100vw - 36px));
  background: linear-gradient(160deg, rgba(10,25,23,.96), rgba(4,18,16,.98));
  border: 1px solid rgba(0,179,188,.35);
  border-radius: 16px;
  padding: 14px 14px 12px;
  box-shadow: 0 18px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(45,212,191,.08) inset;
  color: var(--beam-ink);
  font-family: "Segoe UI", system-ui, sans-serif;
  backdrop-filter: blur(12px);
}
#beam-assistix-profile[data-collapsed="1"] { width: auto; padding: 10px 12px; }
#beam-assistix-profile .bap-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
#beam-assistix-profile .bap-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  color: #042f2e; font-weight: 800; font-size: 13px;
  display: grid; place-items: center; flex: 0 0 auto;
}
#beam-assistix-profile .bap-meta { min-width: 0; flex: 1; }
#beam-assistix-profile .bap-name {
  font-size: 13px; font-weight: 700; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
#beam-assistix-profile .bap-email {
  font-size: 11px; color: var(--beam-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#beam-assistix-profile .bap-toggle {
  border: 0; background: transparent; color: var(--beam-muted);
  cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px;
}
#beam-assistix-profile .bap-body { display: grid; gap: 8px; }
#beam-assistix-profile[data-collapsed="1"] .bap-body { display: none; }
#beam-assistix-profile .bap-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; gap: 8px;
}
#beam-assistix-profile .bap-bar {
  height: 5px; border-radius: 99px; background: rgba(255,255,255,.08);
  overflow: hidden; margin-top: 4px;
}
#beam-assistix-profile .bap-bar > span {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, #2dd4bf, #00B3BC);
}
#beam-assistix-profile .bap-actions { display: flex; gap: 8px; margin-top: 4px; }
#beam-assistix-profile .bap-actions button {
  flex: 1; border: 0; border-radius: 10px; padding: 8px 10px;
  font-size: 12px; font-weight: 700; cursor: pointer;
}
#beam-assistix-profile .bap-primary {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e);
  color: #042f2e;
}
#beam-assistix-profile .bap-ghost {
  background: transparent; color: var(--beam-ink);
  border: 1px solid var(--beam-line) !important;
}
#beam-assistix-profile .bap-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; letter-spacing: .04em; text-transform: uppercase;
  color: var(--beam-bright); margin-bottom: 8px;
}
`;
fs.writeFileSync(path.join(ASSETS, "beam-override.css"), css);

console.log("6) Injector: text rewrite + Assistix profile dock");
{
  const CLEAN = path.join(ROOT, "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html");
  if (fs.existsSync(CLEAN)) fs.copyFileSync(CLEAN, path.join(WEB, "index.html"));
  let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");
  html = html.replaceAll("DeepSeek Harness", "Beam Agent");

  const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const WORD = ${JSON.stringify(WORD)};
  const BRIDGE = "http://127.0.0.1:17865";
  let scheduled = false, running = false;

  const rewriteText = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const v = n.nodeValue;
      if (!v || !/DeepSeek|Harness|whale|Custom model API|API key/i.test(v)) continue;
      // skip if inside our profile
      if (n.parentElement?.closest?.("#beam-assistix-profile")) continue;
      n.nodeValue = v
        .replace(/DeepSeek Harness/g, "Beam Agent")
        .replace(/DeepSeek Account/g, "ASSISTIX ID")
        .replace(/Sign in with DeepSeek/g, "Sign in with ASSISTIX ID")
        .replace(/Custom model API/g, "Advanced")
        .replace(/Add an API key to get started/g, "Sign in with ASSISTIX ID")
        .replace(/Enter your API keys to use models from the following providers\\./g, "Beam models: Tide, Flare, Pine.")
        .replace(/deepseek-v4-flash/gi, "Tide")
        .replace(/deepseek-flash/gi, "Tide")
        .replace(/gemini-3\\.8-flash(?:-lite)?/gi, "Flare")
        .replace(/grok-4\\.7/gi, "Pine")
        .replace(/DeepSeek/g, "Beam")
        .replace(/Harness/g, "Beam");
    }
  };

  const rewriteWordmarks = (root) => {
    if (!root.querySelectorAll) return;
    for (const svg of [...root.querySelectorAll("svg")]) {
      if (svg.dataset.beamWord === "1") continue;
      const vb = svg.getAttribute("viewBox") || "";
      if (!(vb.includes("182 24") || vb.includes("156 24"))) continue;
      const img = new Image();
      img.src = WORD; img.alt = "Beam Agent"; img.dataset.beamWord = "1";
      img.style.height = (svg.getAttribute("height") || "24") + "px";
      img.style.width = "auto"; img.style.display = "inline-block";
      svg.replaceWith(img);
    }
  };

  const hideCustomChrome = (root) => {
    if (!root.querySelectorAll) return;
    for (const el of root.querySelectorAll("button, a, [role=button]")) {
      const t = (el.innerText || el.getAttribute("aria-label") || "").trim();
      if (/^Custom model API$/i.test(t) || /^Add model provider$/i.test(t) || /^Third-party model provider$/i.test(t)) {
        const card = el.closest("[class*=addBlock], [class*=Add], section, article, div") || el;
        card.style.display = "none";
      }
    }
    // Hide API key fields in models settings when official Beam is configured
    for (const label of root.querySelectorAll("label, span, p")) {
      const t = (label.textContent || "").trim();
      if (/^API key$/i.test(t) || /^Enter your API key$/i.test(t)) {
        const block = label.closest("label, div, section") || label;
        if (block.closest("#beam-assistix-profile")) continue;
        // only hide if near Assistix/Beam provider card
        const near = (block.parentElement?.innerText || "").slice(0, 200);
        if (/Beam Agent|Assistix|DEEPSEEK_API_KEY|Official/i.test(near)) {
          block.style.display = "none";
        }
      }
    }
  };

  const fmt = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + "K";
    return String(n);
  };

  const ensureProfile = () => {
    let el = document.getElementById("beam-assistix-profile");
    if (!el) {
      el = document.createElement("div");
      el.id = "beam-assistix-profile";
      el.dataset.collapsed = "0";
      document.documentElement.appendChild(el);
    }
    return el;
  };

  const renderProfile = (data) => {
    const el = ensureProfile();
    const user = data?.user;
    const signed = !!data?.signedIn && !!user;
    const quotas = data?.quotas || {};
    const models = data?.models || [
      { id: "tide", name: "Tide", limit: 1e6, used: quotas.tide?.used || 0 },
      { id: "flare", name: "Flare", limit: 5e5, used: quotas.flare?.used || 0 },
      { id: "pine", name: "Pine", limit: 1e4, used: quotas.pine?.used || 0 },
    ];
    const initials = signed
      ? String(user.name || user.email || "A").trim().slice(0, 2).toUpperCase()
      : "AX";
    const rows = models.map((m) => {
      const used = m.used ?? quotas[m.id]?.used ?? 0;
      const limit = m.limit ?? quotas[m.id]?.limit ?? 1;
      const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
      return \`<div>
        <div class="bap-row"><span>\${m.name}</span><span>\${fmt(used)} / \${fmt(limit)}</span></div>
        <div class="bap-bar"><span style="width:\${pct}%"></span></div>
      </div>\`;
    }).join("");

    el.innerHTML = \`
      <div class="bap-badge">ASSISTIX ID</div>
      <div class="bap-head">
        <div class="bap-avatar">\${initials}</div>
        <div class="bap-meta">
          <div class="bap-name">\${signed ? (user.name || "Assistix") : "Гость"}</div>
          <div class="bap-email">\${signed ? (user.email || "signed in") : "Войдите, чтобы открыть лимиты"}</div>
        </div>
        <button class="bap-toggle" type="button" title="Свернуть">\${el.dataset.collapsed === "1" ? "▸" : "▾"}</button>
      </div>
      <div class="bap-body">
        \${rows}
        <div class="bap-actions">
          \${signed
            ? \`<button class="bap-ghost" type="button" data-act="logout">Выйти</button>
               <button class="bap-primary" type="button" data-act="refresh">Обновить</button>\`
            : \`<button class="bap-primary" type="button" data-act="login">Войти</button>\`}
        </div>
      </div>\`;

    el.querySelector(".bap-toggle")?.addEventListener("click", () => {
      el.dataset.collapsed = el.dataset.collapsed === "1" ? "0" : "1";
      renderProfile(data);
    });
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => {
      window.open(BRIDGE + "/assistix/login", "_blank");
    });
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async () => {
      await fetch(BRIDGE + "/assistix/logout", { method: "POST" });
      refreshProfile();
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", () => refreshProfile());
  };

  let lastProfile = null;
  const refreshProfile = async () => {
    try {
      const r = await fetch(BRIDGE + "/assistix/status");
      lastProfile = await r.json();
      renderProfile(lastProfile);
    } catch {
      renderProfile({ signedIn: false, user: null, quotas: {} });
    }
  };

  const run = () => {
    if (running) return;
    running = true;
    try {
      document.title = "Beam Agent";
      const root = document.body || document.documentElement;
      if (!root) return;
      rewriteText(root);
      rewriteWordmarks(root);
      hideCustomChrome(root);
      if (!document.getElementById("beam-assistix-profile")) refreshProfile();
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; run(); });
  };

  const start = () => {
    run();
    refreshProfile();
    setInterval(refreshProfile, 15000);
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;

  html = html.replace(
    /<link rel="stylesheet" href="\.\/assets\/beam-override\.css">[\s\S]*?<\/script>\s*/g,
    ""
  );
  html = html.replace("</head>", inject + "\n</head>");
  fs.writeFileSync(path.join(WEB, "index.html"), html);
  fs.writeFileSync(path.join(WEB, "favicon.svg"), logoSvg);
  fs.writeFileSync(path.join(WEB, "favicon-dark.svg"), logoSvg);
}

console.log("7) Icons (png/ico/svg)");
{
  const resDir = path.join(ROOT, "dist", "Beam-Agent", "resources");
  fs.writeFileSync(path.join(resDir, "icon.svg"), logoSvg);
  try {
    const sharp = require("sharp");
    const png256 = await sharp(Buffer.from(logoSvg))
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const png32 = await sharp(Buffer.from(logoSvg))
      .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(resDir, "icon.png"), png256);
    // PNG-in-ICO
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    const entry = Buffer.alloc(16);
    entry[0] = 32; entry[1] = 32;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png32.length, 8);
    entry.writeUInt32LE(22, 12);
    fs.writeFileSync(path.join(resDir, "tray.ico"), Buffer.concat([header, entry, png32]));
    console.log("  icon.png + tray.ico updated");
  } catch (e) {
    console.log("  sharp unavailable:", e.message);
  }
}

console.log("8) Welcome brand + ensure local API key env");
{
  const welcome = path.join(APP, "renderer", "assets", "welcome-brand.svg");
  if (fs.existsSync(path.dirname(welcome))) fs.writeFileSync(welcome, wordSvg);

  // Ensure .beam/.env so harness never asks for a key
  const beamHome = path.join(process.env.USERPROFILE || "", ".beam");
  fs.mkdirSync(beamHome, { recursive: true });
  const envPath = path.join(beamHome, ".env");
  const map = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) map[m[1]] = m[2];
    }
  }
  map.DEEPSEEK_API_KEY = map.DEEPSEEK_API_KEY || "beam-assistix-local";
  map.BEAM_API_KEY = map.BEAM_API_KEY || map.DEEPSEEK_API_KEY;
  // Launcher/bootstrap-only — must NOT live in .env (Start Beam Agent.vbs PROCESS env)
  for (const k of Object.keys(map)) {
    const u = k.toUpperCase();
    if (
      u === "BEAM_BASE_URL" ||
      u === "BEAM_HOME" ||
      u === "DEEPSEEK_BASE_URL" ||
      u === "DSH_HOME" ||
      u === "DEEPSEEK_SEARCH_BASE_URL" ||
      u.startsWith("DSH_") ||
      u.startsWith("XDG_") ||
      u.startsWith("DYLD_") ||
      u.startsWith("BASH_FUNC_")
    ) {
      delete map[k];
    }
  }
  fs.writeFileSync(
    envPath,
    Object.entries(map)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
  console.log("  .beam/.env ready (API keys only; no launcher-forbidden keys)");
}

console.log("9) Silent launch stays on VBS (keys injected in Start Beam Agent.vbs / Electron main — never via visible .cmd)");
{
  // Do not rebuild Start Beam Agent.cmd into a console env script — that flashes a terminal.
  // Credentials/home are set in PROCESS env by Start Beam Agent.vbs and BEAM_LAUNCH_ENV in main.js.
}

console.log("10) Savona typeface");
await import("./patch-savona.mjs");

console.log("✓ polish-beam done");
