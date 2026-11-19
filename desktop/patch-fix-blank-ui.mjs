/**
 * Fix blank UI after workspace dialog: stop DOM smashers that break React.
 * Safe injector only — no replaceWith on React nodes, no characterData observer,
 * no broad display:none on parent divs, no cross-script ReferenceErrors.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const WEB = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist"
);
const ASSETS = path.join(WEB, "assets");
const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const LOGO =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logoSvg);

const BEAM = "#00B3BC";
const BEAM_BRIGHT = "#2dd4bf";
const BEAM_DEEP = "#0d9488";
const BEAM_PALE = "#e8f7f5";
const BEAM_MID = "#5eead4";
const BEAM_DARK = "#0f766e";

// Rebuild CSS (keep visual system, drop anything that fights layout)
const css = `/* ===== BEAM AGENT — safe visual system ===== */
:root {
  --beam: ${BEAM};
  --beam-bright: ${BEAM_BRIGHT};
  --beam-deep: ${BEAM_DEEP};
  --beam-ink: #e8f7f5;
  --beam-muted: #9ec9c3;
  --beam-bg: #041210;
  --beam-surface: #0a1917;
  --beam-elev: #102220;
  --beam-line: #1a3a36;

  --dsw-alias-brand-primary: var(--beam) !important;
  --dsw-alias-button-primary-fill: var(--beam) !important;
  --dsw-alias-button-primary-hover: var(--beam-deep) !important;
  --dsw-alias-state-business-primary: var(--beam) !important;
  --dsw-alias-link: var(--beam-bright) !important;
  --dsw-focus-ring-color: var(--beam) !important;
  --dsw-static-deepseek-50: ${BEAM_PALE} !important;
  --dsw-static-deepseek-100: ${BEAM_PALE} !important;
  --dsw-static-deepseek-200: #b6f0ea !important;
  --dsw-static-deepseek-300: ${BEAM_MID} !important;
  --dsw-static-deepseek-400: ${BEAM_BRIGHT} !important;
  --dsw-static-deepseek-450: ${BEAM} !important;
  --dsw-static-deepseek-500: ${BEAM} !important;
  --dsw-static-deepseek-600: ${BEAM_DEEP} !important;
  --dsw-static-deepseek-700-delete: ${BEAM_DARK} !important;
  --dsw-static-deepseek-800: #1a3a36 !important;
  --dsw-static-deepseek-900: #0a1917 !important;
}

html, body, #root {
  background:
    radial-gradient(1000px 560px at -8% -20%, rgba(0,179,188,.18), transparent 58%),
    radial-gradient(820px 480px at 108% -5%, rgba(45,212,191,.08), transparent 52%),
    var(--beam-bg) !important;
  color: var(--beam-ink) !important;
  color-scheme: dark !important;
}

body[data-ds-dark-theme], :root[data-theme="dark"], html.dark {
  --dsw-alias-bg-base: var(--beam-bg) !important;
  --dsw-alias-bg-layer-1: var(--beam-surface) !important;
  --dsw-alias-bg-layer-2: var(--beam-elev) !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-border-l1: var(--beam-line) !important;
  --dsw-alias-label-primary: var(--beam-ink) !important;
  --dsw-alias-label-secondary: var(--beam-muted) !important;
  --dsw-alias-label-tertiary: #7aaba4 !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-menu-surface-fill: rgba(10,25,23,.94) !important;
}

[class*="brandMark"] img, [class*="railMark"] img, img[alt="Beam"] {
  filter: none !important; opacity: 1 !important;
}
[class*="_primary_"], button[data-variant="primary"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important; border: none !important;
}
::selection { background: rgba(45,212,191,.35) !important; }

/* Hide custom-provider chrome without nuking parents */
[class*="addBlock"], [class*="AddBlock"] { display: none !important; }

/* Never show old floating profile */
#beam-assistix-profile { display: none !important; visibility: hidden !important; pointer-events: none !important; }

/* Thinking status teal */
[class*="runningIcon"], [class*="runningWhale"], [data-chat-running="true"] { color: ${BEAM} !important; }
[class*="runningWhaleAnimated"] { display: none !important; }
[class*="runningWhaleStill"] { display: block !important; color: ${BEAM} !important; }

/* Sidebar limits dock */
#beam-side-limits {
  margin-top: auto; margin-bottom: 8px; padding: 10px 10px 12px;
  border-radius: 14px; background: rgba(10, 25, 23, 0.92);
  border: 1px solid rgba(0,179,188,.28); color: var(--beam-ink);
  font-family: "Savona", "Segoe UI", system-ui, sans-serif; flex-shrink: 0;
}
#beam-side-limits .bsl-head { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:10px; }
#beam-side-limits .bsl-title { font-size:11px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:var(--beam-muted); }
#beam-side-limits .bsl-user { font-size:10px; color:var(--beam-bright); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:55%; }
#beam-side-limits .bsl-rings { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; }
#beam-side-limits .bsl-ring { display:flex; align-items:center; gap:8px; min-width:0; }
#beam-side-limits .bsl-ring[data-id="tide"] { grid-column: 1 / -1; }
#beam-side-limits .bsl-chart { position:relative; width:40px; height:40px; flex-shrink:0; }
#beam-side-limits .bsl-chart svg { display:block; width:40px; height:40px; }
#beam-side-limits .bsl-pct { position:absolute; inset:0; display:grid; place-items:center; font-size:9px; font-weight:800; }
#beam-side-limits .bsl-label { font-size:11px; font-weight:800; }
#beam-side-limits .bsl-val { font-size:10px; color:var(--beam-muted); }
#beam-side-limits .bsl-actions { display:flex; gap:6px; margin-top:10px; }
#beam-side-limits .bsl-actions button {
  flex:1; border:0; border-radius:10px; padding:7px 8px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit;
}
#beam-side-limits .bsl-primary { background:linear-gradient(135deg,#2dd4bf,#00B3BC 55%,#0f766e); color:#042f2e; }
#beam-side-limits .bsl-ghost { background:transparent; color:var(--beam-ink); border:1px solid var(--beam-line) !important; }

/* Limits settings cards */
#beam-limits-panel { display:grid; gap:10px; margin-top:14px; font-family:"Savona","Segoe UI",system-ui,sans-serif; }
#beam-limits-panel .blp-card {
  border:1px solid rgba(0,179,188,.28);
  background:linear-gradient(160deg,rgba(16,34,32,.95),rgba(10,25,23,.98));
  border-radius:14px; padding:14px 16px;
}
#beam-limits-panel .blp-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
#beam-limits-panel .blp-name { font-size:15px; font-weight:800; display:flex; align-items:center; gap:8px; }
#beam-limits-panel .blp-dot { width:8px; height:8px; border-radius:50%; background:#2dd4bf; }
#beam-limits-panel .blp-tag { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--beam-bright); }
#beam-limits-panel .blp-desc { margin:6px 0 10px; font-size:12px; color:var(--beam-muted); line-height:1.4; }
#beam-limits-panel .blp-row { display:flex; justify-content:space-between; font-size:12px; }
#beam-limits-panel .blp-bar { margin-top:6px; height:6px; border-radius:99px; background:rgba(255,255,255,.08); overflow:hidden; }
#beam-limits-panel .blp-bar > span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#2dd4bf,#00B3BC); }
`;

fs.writeFileSync(path.join(ASSETS, "beam-override.css"), css);

const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const BRIDGE = "http://127.0.0.1:17865";
  let scheduled = false, running = false, lastData = null, lastSideHtml = "";

  const isRu = () => {
    const lang = (document.documentElement.lang || "").toLowerCase();
    if (lang.startsWith("ru")) return true;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        if (/preference["']?\\s*:\\s*["']ru["']/.test(v)) return true;
      }
    } catch {}
    return false;
  };

  const T = {
    en: {
      limits: "Weekly limits", guest: "Guest", login: "Sign in", logout: "Sign out", refresh: "Refresh",
      tideTag: "Fast", flareTag: "Style", pineTag: "Precise",
      tideDesc: "Everyday thinking — quick tasks and coding.",
      flareDesc: "Style & creative — writing, polish, ideation.",
      pineDesc: "Precision — harder problems, longer context.",
    },
    ru: {
      limits: "Лимиты недели", guest: "Гость", login: "Войти", logout: "Выйти", refresh: "Обновить",
      tideTag: "Быстрая", flareTag: "Стиль", pineTag: "Точная",
      tideDesc: "Повседневное мышление — быстрые задачи и код.",
      flareDesc: "Стиль и креатив — тексты, полировка, идеи.",
      pineDesc: "Точность — сложные задачи и длинный контекст.",
    }
  };
  const t = () => (isRu() ? T.ru : T.en);
  const fmt = (n) => n >= 1e6 ? ((n/1e6).toFixed(n % 1e6 ? 1 : 0) + "M") : n >= 1e3 ? ((n/1e3).toFixed(n % 1e3 ? 1 : 0) + "K") : String(n);

  const modelsFrom = (data) => {
    const q = data?.quotas || {};
    return [
      { id: "tide", name: "Tide", limit: q.tide?.limit || 1e6, used: q.tide?.used || 0, color: "#f97316" },
      { id: "flare", name: "Flare", limit: q.flare?.limit || 5e5, used: q.flare?.used || 0, color: "#a78bfa" },
      { id: "pine", name: "Pine", limit: q.pine?.limit || 1e4, used: q.pine?.used || 0, color: "#34d399" },
    ];
  };

  const ringSvg = (pct, color) => {
    const r = 16, c = 2 * Math.PI * r, dash = Math.max(0, Math.min(100, pct)) / 100 * c;
    return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="'+r+'" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4"/><circle cx="20" cy="20" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="4" stroke-linecap="round" transform="rotate(-90 20 20)" stroke-dasharray="'+dash+' '+c+'"/></svg>';
  };

  const findSidebarRoot = () => {
    const logo = document.querySelector('[class*="logoRow"]');
    return logo?.closest('[class*="root"]') || null;
  };

  const renderSide = (data) => {
    const root = findSidebarRoot();
    if (!root) return;
    // Don't touch DOM while native dialogs / open overlays might remount the tree
    if (document.querySelector('[aria-modal="true"], .ReactModal__Overlay')) return;

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

    const html = '<div class="bsl-head"><span class="bsl-title">'+tr.limits+'</span><span class="bsl-user">'+(signed ? (user.name || user.email || "ASSISTIX") : tr.guest)+'</span></div><div class="bsl-rings">'+rings+'</div><div class="bsl-actions">'+(signed
      ? '<button class="bsl-ghost" type="button" data-act="logout">'+tr.logout+'</button><button class="bsl-primary" type="button" data-act="refresh">'+tr.refresh+'</button>'
      : '<button class="bsl-primary" type="button" data-act="login">'+tr.login+'</button>')+'</div>';

    if (html === lastSideHtml && el.dataset.bound === "1") return;
    lastSideHtml = html;
    el.innerHTML = html;
    el.dataset.bound = "1";
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => window.open(BRIDGE + "/assistix/login", "_blank"));
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async () => {
      try { await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); } catch {}
      refresh();
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", () => refresh());
  };

  const enhanceLimitsPage = (data) => {
    if (document.querySelector('[aria-modal="true"]')) return;
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
    const pairs = [
      [/Deep diving for/gi, isRu() ? "Думаю ·" : "Thinking for"],
      [/Deep diving/gi, isRu() ? "Думаю" : "Thinking"],
      [/DeepSeek Harness/g, "Beam Agent"],
      [/DeepSeek Account/g, "ASSISTIX ID"],
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
      if (n.parentElement?.closest?.("#beam-side-limits,#beam-limits-panel,script,style,textarea,input,[contenteditable=true]")) continue;
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

  const refresh = async () => {
    try {
      const r = await fetch(BRIDGE + "/assistix/status");
      lastData = await r.json();
    } catch {
      lastData = { signedIn: false, user: null, quotas: {} };
    }
    try {
      renderSide(lastData);
      enhanceLimitsPage(lastData);
    } catch (e) {
      console.warn("[beam] limits ui", e);
    }
  };

  const run = () => {
    if (running) return;
    running = true;
    try {
      document.title = "Beam Agent";
      // Never smash DOM while a modal/dialog is up (workspace picker etc.)
      if (document.querySelector('[aria-modal="true"]')) return;
      document.getElementById("beam-assistix-profile")?.remove();
      rewriteLeafText(document.body);
      hideSettingsNavExtras();
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
    scheduled = true;
    setTimeout(() => { scheduled = false; run(); }, 120);
  };

  const start = () => {
    run();
    refresh();
    setInterval(refresh, 15000);
    // childList only — NEVER characterData (rewrite would loop and break React)
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;

let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
// Strip ALL previous beam scripts/styles from head
html = html.replace(/<script id="beam-kill-zh-update">[\s\S]*?<\/script>\s*/g, "");
html = html.replace(/<link rel="stylesheet" href="\.\/assets\/beam-override\.css">\s*/g, "");
html = html.replace(/<script>\s*\(\(\) => \{[\s\S]*?BRIDGE[\s\S]*?<\/script>\s*/g, "");
// Also catch any leftover beam IIFE
html = html.replace(/<script>\s*\(\(\) => \{[\s\S]*?beam-side-limits[\s\S]*?<\/script>\s*/g, "");

html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");
if (!html.includes("</head>")) throw new Error("no head");
html = html.replace("</head>", inject + "\n</head>");
fs.writeFileSync(path.join(WEB, "index.html"), html);
fs.writeFileSync(path.join(WEB, "favicon.svg"), logoSvg);
fs.writeFileSync(path.join(WEB, "favicon-dark.svg"), logoSvg);

// Verify no hidePluginChrome ReferenceError / replaceWith / characterData
const check = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
if (check.includes("replaceWith(")) console.warn("WARN: replaceWith still present");
if (check.includes("characterData: true")) console.warn("WARN: characterData still observed");
if ((check.match(/beam-side-limits/g) || []).length < 1) throw new Error("injector missing");
if (check.includes("beam-kill-zh-update") && check.includes("hidePluginChrome(root)")) {
  // ensure hidePluginChrome is defined in same scope if called — we removed calls
}
console.log("✓ safe injector written");
