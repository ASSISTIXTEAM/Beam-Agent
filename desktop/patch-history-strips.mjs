/**
 * Session list: quiet leading DOTS (not strips).
 * RIGHT conversation turn-rail: single-peak pull-out, proximity-gated magnet.
 * Never reintroduce left-edge dash scrubbers.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

const CSS_MARKER = "/* ===== BEAM history strips ===== */";
const SCRIPT_ID = "beam-history-strips";

const CSS_BLOCK = `${CSS_MARKER}
/* Kill leftover left-sidebar scrubber chrome from the bad v1 patch */
#beam-hist-rail,
#beam-hist-peek,
.beam-hist-strip {
  display: none !important;
  pointer-events: none !important;
  width: 0 !important;
  height: 0 !important;
  opacity: 0 !important;
}

/*
 * Left session list: quiet circular bullets in the empty 16×20 leading slot.
 * NOT strips — small grey dots like a normal list.
 */
[role="treeitem"][data-row-key^="session:"] > [class*="slot"],
[class*="sessionRow"] > [class*="slot"] {
  position: relative !important;
  justify-content: center !important;
  align-items: center !important;
}
[role="treeitem"][data-row-key^="session:"] > [class*="slot"]::before,
[class*="sessionRow"] > [class*="slot"]::before {
  content: "" !important;
  display: block !important;
  width: 5px !important;
  height: 5px !important;
  min-width: 5px !important;
  min-height: 5px !important;
  max-width: 5px !important;
  max-height: 5px !important;
  margin: 0 auto !important;
  border-radius: 50% !important;
  background: var(--beam-soft, #6f827e) !important;
  opacity: 0.72 !important;
  box-shadow: none !important;
  border: 0 !important;
  transform: none !important;
  flex: none !important;
  pointer-events: none !important;
}
[role="treeitem"][data-row-key^="session:"][aria-selected="true"] > [class*="slot"]::before,
[class*="sessionRow"][class*="selected"] > [class*="slot"]::before,
[class*="sessionRow"]:hover > [class*="slot"]::before {
  background: var(--beam-ink, #f2faf8) !important;
  opacity: 0.92 !important;
}
/* If native status / schedule mark is present, don't double-dot */
[role="treeitem"][data-row-key^="session:"] > [class*="slot"]:has(svg)::before,
[role="treeitem"][data-row-key^="session:"] > [class*="slot"]:has([class*="dot"])::before,
[role="treeitem"][data-row-key^="session:"] > [class*="slot"]:has([class*="Dot"])::before,
[class*="sessionRow"] > [class*="slot"]:has(svg)::before,
[class*="sessionRow"] > [class*="slot"]:has([class*="dot"])::before,
[class*="sessionRow"] > [class*="slot"]:has([class*="Dot"])::before {
  content: none !important;
  display: none !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) [role="treeitem"][data-row-key^="session:"] > [class*="slot"]::before,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) [class*="sessionRow"] > [class*="slot"]::before {
  background: var(--beam-light-soft, #6a8380) !important;
  opacity: 0.8 !important;
}
body:not([data-ds-dark-theme]):not([data-theme="dark"]) [role="treeitem"][data-row-key^="session:"][aria-selected="true"] > [class*="slot"]::before,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) [class*="sessionRow"][class*="selected"] > [class*="slot"]::before,
body:not([data-ds-dark-theme]):not([data-theme="dark"]) [class*="sessionRow"]:hover > [class*="slot"]::before {
  background: var(--beam-light-ink, #0a2422) !important;
  opacity: 0.9 !important;
}

/*
 * Native RIGHT turn-rail marks — single-peak hover pull-out.
 *
 * IMPORTANT: Do NOT drive length with scaleX > ~1.3. The turn-rail scroller
 * is ~28px wide and clips overflow, so many bars at scaleX≥1.4 all look like
 * the same max-length plateau. Instead --beam-pull is 0..1 intensity mapped
 * to an explicit width that stays inside the rail.
 */
[data-conversation-scroll] [class*="_frame"] button[class*="_mark"] {
  --beam-pull: 0.35;
  --beam-hot: 0;
}
[data-conversation-scroll] [class*="_frame"] button[class*="_markUnloaded"] {
  --beam-pull: 0.22;
}
[data-conversation-scroll] [class*="_frame"] button[class*="_markPreview"] {
  --beam-pull: 0.55;
}
[data-conversation-scroll] [class*="_frame"] button[class*="_markActive"],
[data-conversation-scroll] [class*="_frame"] button[class*="_mark"]:focus-visible {
  --beam-pull: 0.7;
}

/* Hitbox — keep near native so thin pills aren't oversized */
[data-conversation-scroll] [class*="_frame"] button[class*="_mark"],
[data-conversation-scroll] .SNx2jG_mark {
  height: 10px !important;
}

/* Native uses :before (single colon) — keep BOTH forms; thin rounded pills */
[data-conversation-scroll] [class*="_frame"] button[class*="_mark"]:before,
[data-conversation-scroll] [class*="_frame"] button[class*="_mark"]::before,
[data-conversation-scroll] .SNx2jG_mark:before,
[data-conversation-scroll] .SNx2jG_mark::before,
[data-conversation-scroll] .SNx2jG_markUnloaded:before,
[data-conversation-scroll] .SNx2jG_markPreview:before,
[data-conversation-scroll] .SNx2jG_markActive:before,
[data-conversation-scroll] .SNx2jG_markBusy:before {
  /* Slim rounded: ~3px (was overshot 8px; native was 2px) */
  width: calc(8px + var(--beam-pull, 0.35) * 15px) !important;
  height: 3px !important;
  min-height: 3px !important;
  max-height: 3px !important;
  border-radius: 999px !important;
  transform: translateY(-50%) scaleX(1) !important;
  transform-origin: right center !important;
  transition: width 0.12s cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 0.12s ease,
    opacity 0.12s ease !important;
}

/* Dark: pure white ONLY at hot=1 (the single peak); neighbors → brand teal */
html[data-beam-right-hist="1"] [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]:before,
html[data-beam-right-hist="1"] [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]::before,
html[data-beam-right-hist="1"] [data-conversation-scroll] .SNx2jG_mark:before,
html[data-beam-right-hist="1"] [data-conversation-scroll] .SNx2jG_mark::before {
  background: color-mix(
    in srgb,
    #ffffff calc(var(--beam-hot, 0) * 100%),
    var(--beam, #00B3BC)
  ) !important;
  opacity: calc(0.55 + var(--beam-hot, 0) * 0.45) !important;
}

/* Light: peak = deep ink; neighbors → brand teal */
html[data-beam-right-hist="1"] body:not([data-ds-dark-theme]):not([data-theme="dark"]) [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]:before,
html[data-beam-right-hist="1"] body:not([data-ds-dark-theme]):not([data-theme="dark"]) [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]::before,
html[data-beam-right-hist="1"] body:not([data-ds-dark-theme]):not([data-theme="dark"]) [data-conversation-scroll] .SNx2jG_mark:before,
html[data-beam-right-hist="1"] body:not([data-ds-dark-theme]):not([data-theme="dark"]) [data-conversation-scroll] .SNx2jG_mark::before {
  background: color-mix(
    in srgb,
    var(--beam-light-ink, #0a2422) calc(var(--beam-hot, 0) * 100%),
    var(--beam, #00B3BC)
  ) !important;
  opacity: calc(0.6 + var(--beam-hot, 0) * 0.4) !important;
}

@media (prefers-reduced-motion: reduce) {
  [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]:before,
  [data-conversation-scroll] [class*="_frame"] button[class*="_mark"]::before,
  [data-conversation-scroll] .SNx2jG_mark:before,
  [data-conversation-scroll] .SNx2jG_mark::before {
    transition: none !important;
  }
}
`;

const SCRIPT_BLOCK = `<script id="${SCRIPT_ID}">
(() => {
  if (window.__beamHistStripsV5) return;
  window.__beamHistStripsV5 = true;
  // Disable leftover plateau / far-magnet loops
  window.__beamHistStrips = true;
  window.__beamHistStripsV2 = true;
  window.__beamHistStripsV3 = true;
  window.__beamHistStripsV4 = true;

  // Index-space Gaussian: only the peak mark can hit pull/hot = 1 at full strength.
  const SIGMA = 0.9;
  const PULL_FLOOR = 0.18;
  const PULL_SPAN = 0.82; // peak = 1.0 → width 22px; never hits scroller clip wall
  const HOT_NEIGHBOR_CAP = 0.32; // adjacent never looks pure white

  // Horizontal magnet: only when cursor is within this many px LEFT of the rail.
  // Farther into the chat = off. Strength fades from 1 (on rail) → 0 (at threshold).
  const PROXIMITY_X = 44;
  const EDGE_PAD_Y = 10;
  const EDGE_PAD_RIGHT = 16;
  const smoothstep = (t) => t * t * (3 - 2 * t);

  const killLeftChrome = () => {
    document.getElementById("beam-hist-rail")?.remove();
    document.getElementById("beam-hist-peek")?.remove();
    document.documentElement.removeAttribute("data-beam-hist-scrub");
    for (const el of document.querySelectorAll(".beam-hist-strip")) el.remove();
  };

  // Prefer real turn-rail marks; avoid matching unrelated *_frame* layout boxes.
  const markSelector = '[data-conversation-scroll] button[class*="_mark"]';

  let marks = [];
  let raf = 0;
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let proximity = 0; // 0..1 horizontal strength
  let moTimer = 0;

  const clearMarkStyle = (el) => {
    el.style.removeProperty("--beam-pull");
    el.style.removeProperty("--beam-hot");
    el.removeAttribute("data-beam-hot");
    el.removeAttribute("data-beam-peak");
  };

  /** Union of mark rects = the actual strip rail (not a wide chat _frame). */
  const railBounds = () => {
    if (!marks.length) return null;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const el of marks) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
    }
    if (!Number.isFinite(left)) return null;
    // Marks span the rail band; ticks sit on the right — use a tight right strip.
    const tickLeft = Math.max(left, right - 24);
    return { left: tickLeft, right, top, bottom };
  };

  const sync = () => {
    killLeftChrome();
    marks = [...document.querySelectorAll(markSelector)].filter((el) => {
      if (el.closest('[role="tree"], [class*="sessionRow"], [class*="projectRow"], [data-row-key], aside, [class*="sidebar"]')) return false;
      const r = el.getBoundingClientRect();
      // Right-rail ticks only
      if (r.left < window.innerWidth * 0.55) return false;
      return r.height > 0 && r.width > 0;
    });
    marks.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (!active) {
      for (const el of marks) clearMarkStyle(el);
    }
  };

  const gauss = (d) => Math.exp(-(d * d) / (2 * SIGMA * SIGMA));

  const resetPulls = () => {
    for (const el of marks) clearMarkStyle(el);
    proximity = 0;
    document.documentElement.removeAttribute("data-beam-right-hist");
  };

  /** 0 if far; 1 when over/near ticks; fades with horizontal distance into chat. */
  const proximityAt = (x, y) => {
    const rail = railBounds();
    if (!rail) return 0;
    if (y < rail.top - EDGE_PAD_Y || y > rail.bottom + EDGE_PAD_Y) return 0;
    if (x > rail.right + EDGE_PAD_RIGHT) return 0;
    // Distance into the chat from the rail's left edge (0 = on/over rail)
    const intoChat = rail.left - x;
    if (intoChat > PROXIMITY_X) return 0;
    if (intoChat <= 0) return 1; // on the rail or to its right (still in pad)
    return smoothstep(1 - intoChat / PROXIMITY_X);
  };

  const paint = () => {
    raf = 0;
    if (!active || !marks.length || proximity <= 0.001) {
      if (active && proximity <= 0.001) {
        active = false;
        resetPulls();
      }
      return;
    }

    let peakIdx = 0;
    let peakDist = Infinity;
    for (let i = 0; i < marks.length; i++) {
      const r = marks[i].getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const dist = Math.abs(lastY - cy);
      if (dist < peakDist) {
        peakDist = dist;
        peakIdx = i;
      }
    }

    const s = proximity; // horizontal strength multiplies elongation + whiteness
    for (let i = 0; i < marks.length; i++) {
      const el = marks[i];
      const d = Math.abs(i - peakIdx);
      if (d === 0) {
        const pull = PULL_FLOOR + s * PULL_SPAN; // max 1.0 only at full proximity
        el.style.setProperty("--beam-pull", pull.toFixed(3));
        el.style.setProperty("--beam-hot", s.toFixed(3));
        el.setAttribute("data-beam-peak", "1");
        el.setAttribute("data-beam-hot", s > 0.85 ? "1" : "0");
        continue;
      }
      const w = gauss(d);
      const pull = PULL_FLOOR + s * w * PULL_SPAN * 0.72;
      const hot = Math.min(HOT_NEIGHBOR_CAP, s * w * w * 0.55);
      el.style.setProperty("--beam-pull", pull.toFixed(3));
      el.style.setProperty("--beam-hot", hot.toFixed(3));
      el.removeAttribute("data-beam-peak");
      el.setAttribute("data-beam-hot", "0");
    }
  };

  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };

  const onMove = (ev) => {
    if (!marks.length) return;
    lastX = ev.clientX;
    lastY = ev.clientY;
    const next = proximityAt(lastX, lastY);
    proximity = next;
    if (next > 0) {
      if (!active) {
        active = true;
        document.documentElement.setAttribute("data-beam-right-hist", "1");
      }
      schedule();
    } else if (active) {
      active = false;
      resetPulls();
    }
  };

  const refresh = () => {
    sync();
    if (active) {
      proximity = proximityAt(lastX, lastY);
      if (proximity > 0) schedule();
      else {
        active = false;
        resetPulls();
      }
    }
  };

  const arm = () => {
    killLeftChrome();
    refresh();
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("scroll", refresh, { passive: true, capture: true });
    window.addEventListener("resize", refresh);
    new MutationObserver(() => {
      clearTimeout(moTimer);
      moTimer = setTimeout(refresh, 140);
    }).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(refresh, 5000);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
  else arm();
})();
</script>`;

function upsertCss(file) {
  if (!fs.existsSync(file)) return false;
  let css = fs.readFileSync(file, "utf8");
  if (css.includes(CSS_MARKER)) {
    const start = css.indexOf(CSS_MARKER);
    const next = css.indexOf("\n/* =====", start + CSS_MARKER.length);
    const end = next > start ? next : css.length;
    css = css.slice(0, start) + CSS_BLOCK + (next > start ? "\n" + css.slice(end).replace(/^\n+/, "") : "");
  } else {
    css = css.trimEnd() + "\n\n" + CSS_BLOCK + "\n";
  }
  fs.writeFileSync(file, css);
  return true;
}

function upsertHtml(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  const re = new RegExp(`<script id="${SCRIPT_ID}">[\\s\\S]*?<\\/script>\\s*`, "m");
  if (re.test(html)) html = html.replace(re, SCRIPT_BLOCK + "\n");
  else if (html.includes("</body>")) html = html.replace("</body>", SCRIPT_BLOCK + "\n</body>");
  else html = html.trimEnd() + "\n" + SCRIPT_BLOCK + "\n";
  // Bust Chromium disk cache for override CSS (no Cache-Control on custom protocol)
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=hist9"'
  );
  fs.writeFileSync(file, html);
  return true;
}

/** Bake thickness into native TurnNavigator CSS so cache can't keep 2px hairlines. */
function patchNativeChatClient(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  // hitbox back to native-ish
  s = s.replace(/(\.SNx2jG_mark\{[^}]*?)height:14px/, "$1height:10px");
  s = s.replace(/(\.SNx2jG_mark\{[^}]*?)height:10px/, "$1height:10px");
  // slim rounded pill (idempotent across prior 2/6.5/8px experiments)
  s = s.replace(
    /(\.SNx2jG_mark:before\{[^}]*?)height:(?:2|3|6\.5|8)px/,
    "$1height:3px"
  );
  s = s.replace(
    /(\.SNx2jG_mark:before\{[^}]*?)border-radius:(?:2|999)px/,
    "$1border-radius:999px"
  );
  if (s === before) return false;
  fs.writeFileSync(file, s);
  return true;
}

const CHAT_CLIENTS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js"),
];

let n = 0;
for (const web of WEBS) {
  const cssOk = upsertCss(path.join(web, "assets/beam-override.css"));
  const htmlOk = upsertHtml(path.join(web, "index.html"));
  console.log(path.relative(ROOT, web), { cssOk, htmlOk });
  if (cssOk || htmlOk) n++;
}
let chatN = 0;
for (const c of CHAT_CLIENTS) {
  const ok = patchNativeChatClient(c);
  console.log(path.relative(ROOT, c), { nativeMark: ok });
  if (ok) chatN++;
}
if (!n) {
  console.error("No trees patched");
  process.exit(1);
}
console.log("history-strips RIGHT-ONLY ok", n, "nativeChat", chatN);
