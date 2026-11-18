/**
 * Faster boot past splash + larger minimalist Beam splash.
 * Splash-only CSS/HTML + web-boot timing; does not touch Settings Profile/Limits.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WEB_ROOTS = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
].map((p) => path.join(ROOT, p));

const MAIN_FILES = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam Agent/resources/app/lib/main.js"),
];

const BOOT_CSS = `/* ===== BEAM boot splash ===== */
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Semibold.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Savona";
  src: url("./fonts/savona/Savona-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

[data-dsh-boot],
[data-beam-boot],
[class*="_boot_u7vgf"],
#beam-early-splash {
  --dsh-boot-label-primary: #f2faf8 !important;
  --dsh-boot-label-secondary: #9aada9 !important;
  --dsh-boot-label-tertiary: #6f827e !important;
  --dsh-boot-brand: #00B3BC !important;
  --dsh-boot-bg: #020807 !important;
  --dsh-boot-border: rgba(255, 255, 255, 0.08) !important;
  --dsh-boot-arc: 96deg !important;
  --dsw-alias-brand-primary: #00B3BC !important;
  --dsw-alias-bg-base: #020807 !important;
  --dsw-alias-label-primary: #f2faf8 !important;
  --dsw-alias-label-tertiary: #9aada9 !important;
  --dsw-alias-border-l2: rgba(255, 255, 255, 0.08) !important;
  height: 100% !important;
  min-height: 100vh !important;
  display: grid !important;
  place-items: center !important;
  background:
    radial-gradient(640px 380px at 50% 42%, rgba(0, 179, 188, 0.16), transparent 62%),
    #020807 !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
  color: #f2faf8 !important;
}

[data-dsh-boot] [class*="_card_"],
[class*="_boot_u7vgf"] [class*="_card_"],
#beam-early-splash .bes-card {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 22px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  min-width: 0 !important;
}

/* Large mark + short Beam Agent title — no Loading clutter */
[data-dsh-boot] [class*="_wordmark_"],
[class*="_boot_u7vgf"] [class*="_wordmark_"],
#beam-early-splash .bes-title {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 22px !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  background: none !important;
  color: #f2faf8 !important;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
  font-size: 20px !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: 0.04em !important;
  text-transform: none !important;
  overflow: visible !important;
}
[data-dsh-boot] [class*="_wordmark_"]::before,
[class*="_boot_u7vgf"] [class*="_wordmark_"]::before,
#beam-early-splash .bes-mark {
  content: "" !important;
  display: block !important;
  width: 112px !important;
  height: 116px !important;
  background: url("./beam-mark.svg") center / contain no-repeat !important;
  filter: drop-shadow(0 0 28px rgba(0, 179, 188, 0.42));
  animation: beam-boot-breathe 2.4s ease-in-out infinite;
}
#beam-early-splash .bes-mark {
  content: none !important;
}

/* Soft pulse instead of busy ring; keep a hairline spinner as secondary cue */
[data-dsh-boot] [class*="_spinner_"],
[class*="_boot_u7vgf"] [class*="_spinner_"],
[data-dsh-boot-spinner],
#beam-early-splash .bes-spin {
  width: 18px !important;
  height: 18px !important;
  margin: 2px auto 0 !important;
  border: 1.5px solid rgba(0, 179, 188, 0.16) !important;
  border-top-color: #00B3BC !important;
  border-right-color: rgba(45, 212, 191, 0.85) !important;
  border-radius: 50% !important;
  background: transparent !important;
  box-shadow: none !important;
  animation: beam-boot-spin 0.9s linear infinite !important;
  color: transparent !important;
  opacity: 0.9 !important;
}
[data-dsh-boot] [class*="_spinner_"]::after,
[class*="_boot_u7vgf"] [class*="_spinner_"]::after,
[data-dsh-boot-spinner]::after {
  content: none !important;
  display: none !important;
}

[data-dsh-boot] [class*="_hint_"],
[class*="_boot_u7vgf"] [class*="_hint_"] {
  display: none !important;
  margin: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

@keyframes beam-boot-spin {
  to { transform: rotate(360deg); }
}
@keyframes beam-boot-breathe {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 22px rgba(0, 179, 188, 0.34));
  }
  50% {
    transform: scale(1.035);
    filter: drop-shadow(0 0 36px rgba(45, 212, 191, 0.5));
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-boot] [class*="_spinner_"],
  [data-dsh-boot-spinner],
  [data-dsh-boot] [class*="_wordmark_"]::before,
  #beam-early-splash .bes-mark,
  #beam-early-splash .bes-spin {
    animation: none !important;
  }
}

#beam-early-splash {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483000 !important;
  pointer-events: none !important;
}
#beam-early-splash[hidden] {
  display: none !important;
}
`;

const EARLY_SPLASH_MARK = "beam-early-splash";
const EARLY_SPLASH_HTML = `<!-- ${EARLY_SPLASH_MARK} -->
<style id="beam-early-splash-css">
#beam-early-splash{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:radial-gradient(640px 380px at 50% 42%,rgba(0,179,188,.16),transparent 62%),#020807;font-family:Savona,Segoe UI,system-ui,sans-serif;pointer-events:none}
#beam-early-splash[hidden]{display:none!important}
#beam-early-splash .bes-card{display:flex;flex-direction:column;align-items:center;gap:22px}
#beam-early-splash .bes-mark{width:112px;height:116px;background:url("./assets/beam-mark.svg") center/contain no-repeat;filter:drop-shadow(0 0 28px rgba(0,179,188,.42));animation:beam-boot-breathe 2.4s ease-in-out infinite}
#beam-early-splash .bes-title{margin:0;color:#f2faf8;font-size:20px;font-weight:600;letter-spacing:.04em}
#beam-early-splash .bes-spin{width:18px;height:18px;border:1.5px solid rgba(0,179,188,.16);border-top-color:#00B3BC;border-right-color:rgba(45,212,191,.85);border-radius:50%;animation:beam-boot-spin .9s linear infinite}
@keyframes beam-boot-spin{to{transform:rotate(360deg)}}
@keyframes beam-boot-breathe{0%,100%{transform:scale(1);filter:drop-shadow(0 0 22px rgba(0,179,188,.34))}50%{transform:scale(1.035);filter:drop-shadow(0 0 36px rgba(45,212,191,.5))}}
@media (prefers-reduced-motion:reduce){#beam-early-splash .bes-mark,#beam-early-splash .bes-spin{animation:none}}
</style>
<div id="beam-early-splash" data-beam-boot aria-busy="true" aria-label="Beam Agent">
  <div class="bes-card">
    <div class="bes-mark" aria-hidden="true"></div>
    <div class="bes-title">Beam Agent</div>
    <div class="bes-spin" aria-hidden="true"></div>
  </div>
</div>
<script id="beam-splash-watchdog">
(() => {
  if (window.__beamSplashWatchdog) return;
  window.__beamSplashWatchdog = true;
  window.__beamBootStartedAt = window.__beamBootStartedAt || Date.now();
  const CAP_MS = 12000;
  const early = () => document.getElementById("beam-early-splash");
  const hideEarly = () => {
    const el = early();
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.removeAttribute("data-beam-boot");
    el.removeAttribute("aria-busy");
    try { el.remove(); } catch {}
  };
  const hasAppUi = () => {
    const root = document.getElementById("root");
    if (!root) return false;
    if (root.querySelector('[class*="sidebar" i], [class*="Sidebar"], aside, [data-sidebar], textarea, [contenteditable="true"], [role="textbox"], [data-shell-overlay], #beam-side-limits, #beam-auth-gate')) return true;
    // BootHandoff swapped away from splash: root has non-boot children
    const kids = [...root.children];
    if (kids.length === 0) return false;
    if (kids.some((el) => !el.hasAttribute("data-dsh-boot") && !el.hasAttribute("data-beam-boot"))) return true;
    return false;
  };
  const bootOnly = () => {
    const root = document.getElementById("root");
    const boot = document.querySelector("[data-dsh-boot], [data-beam-boot]");
    const text = ((root && root.innerText) || (document.body && document.body.innerText) || "").trim();
    return !!(boot && !hasAppUi() && text.length < 80);
  };
  const tick = () => {
    try {
      if (hasAppUi()) {
        hideEarly();
        // If a hydrated boot shell lingered over UI, drop it once
        for (const el of document.querySelectorAll("#root > [data-dsh-boot]")) {
          if (hasAppUi()) el.remove();
        }
        return;
      }
      // Hand off early paint to framework boot page once it mounts
      if (document.querySelector("#root > [data-dsh-boot]")) hideEarly();
      const age = Date.now() - Number(window.__beamBootStartedAt || Date.now());
      if (age >= CAP_MS && bootOnly()) {
        // Cap eternal splash: ask desktop once, then stop feeling infinite
        if (!window.__beamBootCapFired) {
          window.__beamBootCapFired = true;
          console.warn("beam-splash: boot cap", age);
          try {
            const desk = globalThis.dshDesktopBoot;
            if (desk && typeof desk.failed === "function") {
              desk.failed("web boot: splash timeout").catch(() => {});
            }
          } catch {}
        }
      }
    } catch {}
  };
  const arm = () => {
    tick();
    setInterval(tick, 400);
    try {
      new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
  else arm();
})();
</script>
`;

function checkJs(src, label) {
  const tmp = path.join(ROOT, "desktop", `_tmp_splash_chk_${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) throw new Error(`${label} parse fail: ${(r.stderr || "").slice(0, 400)}`);
}

function patchCss(assetsDir) {
  const cssPath = path.join(assetsDir, "beam-override.css");
  if (!fs.existsSync(cssPath)) return { ok: false, reason: "missing css" };
  const logo = fs.existsSync(path.join(ROOT, "logo.svg"))
    ? fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8")
    : null;
  if (logo) fs.writeFileSync(path.join(assetsDir, "beam-mark.svg"), logo);
  let css = fs.readFileSync(cssPath, "utf8");
  if (/\/\* ===== BEAM boot splash ===== \*\//.test(css)) {
    css = css.replace(
      /\/\* ===== BEAM boot splash ===== \*\/[\s\S]*?(?=\n\/\* ===== |\n\/\*=+)/,
      BOOT_CSS.trimEnd() + "\n\n",
    );
  } else {
    css = css.trimEnd() + "\n\n" + BOOT_CSS;
  }
  fs.writeFileSync(cssPath, css);
  return { ok: true, hasSplash: css.includes("112px") && css.includes("beam-boot-breathe") };
}

function patchIndexJs(assetsDir) {
  const jsPath = path.join(assetsDir, "index-BXV-oxvX.js");
  if (!fs.existsSync(jsPath)) return { ok: false, reason: "missing js" };
  let s = fs.readFileSync(jsPath, "utf8");
  const before = s;

  // Minimal copy
  s = s.replaceAll('wordmark,"HARNESS"', 'wordmark,"Beam Agent"');
  s = s.replaceAll('wordmark,"BEAM"', 'wordmark,"Beam Agent"');
  s = s.replaceAll('wordmark,"DeepSeek"', 'wordmark,"Beam Agent"');
  s = s.replace(/Yn\(Kn\.wordmark,"[^"]*"\)/g, 'Yn(Kn.wordmark,"Beam Agent")');
  s = s.replace(/Yn\(Kn\.hint,"[^"]*"\)/g, 'Yn(Kn.hint,"")');
  s = s.replaceAll('hint,"Loading Beam Agent…"', 'hint,""');
  s = s.replaceAll('hint,"Loading Beam Agent..."', 'hint,""');
  s = s.replaceAll('hint,"Loading Beam…"', 'hint,""');
  s = s.replaceAll('hint,"Loading plugins…"', 'hint,""');
  s = s.replaceAll('hint,"Загрузка Beam Agent…"', 'hint,""');

  // Host-ready timeout so splash cannot hang forever on Ls.ready / injections
  if (!s.includes("beam-boot-ready-cap")) {
    const oldAwait = "await globalThis.__DSH_BOOT_READY__?.promise;";
    const neuAwait =
      'await Promise.race([globalThis.__DSH_BOOT_READY__?.promise??Promise.resolve(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("web boot: host ready timeout")),12e3))]);/* beam-boot-ready-cap */';
    if (!s.includes(oldAwait)) return { ok: false, reason: "ready await pattern missing" };
    s = s.split(oldAwait).join(neuAwait);
  }

  // Stamp boot start for shell blank-watch / watchdog
  if (!s.includes("beam-boot-started-stamp")) {
    const ctor = 'this.page=new zZ(e)}async run(e){';
    const neu =
      'this.page=new zZ(e);try{globalThis.__beamBootStartedAt=globalThis.__beamBootStartedAt||Date.now()}catch{}/* beam-boot-started-stamp */}async run(e){';
    if (s.includes(ctor)) s = s.split(ctor).join(neu);
  }

  if (s === before && !s.includes("beam-boot-ready-cap")) {
    return { ok: false, reason: "no changes" };
  }
  checkJs(s, path.relative(ROOT, jsPath));
  fs.writeFileSync(jsPath, s);
  return {
    ok: true,
    readyCap: s.includes("beam-boot-ready-cap"),
    wordmark: s.includes('wordmark,"Beam Agent"') || s.includes('Yn(Kn.wordmark,"Beam Agent")'),
  };
}

function patchIndexHtml(webDist) {
  const htmlPath = path.join(webDist, "index.html");
  if (!fs.existsSync(htmlPath)) return { ok: false, reason: "missing html" };
  let html = fs.readFileSync(htmlPath, "utf8");
  // Refresh early splash block
  if (html.includes(EARLY_SPLASH_MARK)) {
    html = html.replace(
      /<!-- beam-early-splash -->[\s\S]*?<script id="beam-splash-watchdog">[\s\S]*?<\/script>\s*/m,
      "",
    );
  }
  if (!html.includes('<div id="root"></div>')) return { ok: false, reason: "no #root" };
  html = html.replace(
    '<div id="root"></div>',
    EARLY_SPLASH_HTML + '\n    <div id="root"></div>',
  );
  fs.writeFileSync(htmlPath, html);
  return { ok: true, hasEarly: html.includes("beam-early-splash"), hasWatchdog: html.includes("beam-splash-watchdog") };
}

function patchMain(mainPath) {
  if (!fs.existsSync(mainPath)) return { ok: false, reason: "missing" };
  let s = fs.readFileSync(mainPath, "utf8");
  let n = 0;

  // Faster stuck-splash detection (12s) + bootingStuck flag without reload storm
  const oldGrace =
    "const started = Number(window.__beamBootStartedAt || (window.__beamBootStartedAt = Date.now()));\n\t\t\t\t\t\tif (boot && text.length >= 8 && Date.now() - started < 20000) return { blank: false, booting: true, textLen: text.length };\n\t\t\t\t\t\tconst hasUi = !!(root && (root.childElementCount > 0 || text.length > 40 || root.querySelector(\"canvas,img,svg,input,textarea,[contenteditable],button,[role=textbox],[data-shell-overlay]\")));\n\t\t\t\t\t\tconst emptyRoot = !root || root.childElementCount === 0;\n\t\t\t\t\t\treturn { blank: emptyRoot || !hasUi, href: location.href, textLen: text.length };";
  const neuGrace =
    "const started = Number(window.__beamBootStartedAt || (window.__beamBootStartedAt = Date.now()));\n\t\t\t\t\t\tconst age = Date.now() - started;\n\t\t\t\t\t\tif (boot && text.length >= 8 && age < 12000) return { blank: false, booting: true, textLen: text.length };\n\t\t\t\t\t\tif (boot && text.length >= 8 && age >= 12000) return { blank: true, bootingStuck: true, textLen: text.length }; /* beam-bootstuck-cap */\n\t\t\t\t\t\tconst hasUi = !!(root && (root.childElementCount > 0 || text.length > 40 || root.querySelector(\"canvas,img,svg,input,textarea,[contenteditable],button,[role=textbox],[data-shell-overlay],#beam-side-limits,#beam-auth-gate\")));\n\t\t\t\t\t\tconst emptyRoot = !root || root.childElementCount === 0;\n\t\t\t\t\t\treturn { blank: emptyRoot || !hasUi, href: location.href, textLen: text.length };";
  if (s.includes(oldGrace)) {
    s = s.split(oldGrace).join(neuGrace);
    n++;
  } else if (!s.includes("beam-bootstuck-cap")) {
    // Softer match
    const softOld =
      "if (boot && text.length >= 8 && Date.now() - started < 20000) return { blank: false, booting: true, textLen: text.length };";
    const softNeu =
      "if (boot && text.length >= 8 && Date.now() - started < 12000) return { blank: false, booting: true, textLen: text.length }; if (boot && text.length >= 8) return { blank: true, bootingStuck: true, textLen: text.length }; /* beam-bootstuck-cap */";
    if (s.includes(softOld)) {
      s = s.split(softOld).join(softNeu);
      n++;
    }
  }

  // Cap blank remounts for bootstuck — one soft try, then stop (no flicker loop)
  if (!s.includes("beam-bootstuck-noflicker")) {
    const remountStart = "const remountApplication = (why) => {\n\t\t\t/* beam-blank-nofatal: soft remount with cooldown — never sticky void, never crash dialog */\n\t\t\tif (quitting || window.isDestroyed()) return;";
    const remountNeu = `const remountApplication = (why) => {
			/* beam-blank-nofatal: soft remount with cooldown — never sticky void, never crash dialog */
			/* beam-bootstuck-noflicker */
			if (quitting || window.isDestroyed()) return;
			if (String(why || "").includes("blank-document") && blankFailRecoveries >= 1) {
				console.warn("desktop blank-recover: stop flicker after bootstuck", why);
				return;
			}`;
    if (s.includes(remountStart)) {
      s = s.split(remountStart).join(remountNeu);
      n++;
    }
  }

  // Earlier blank watch probes so stuck splash is capped sooner
  if (s.includes("const delays = [8000, 18000, 32000];") && !s.includes("beam-splash-fast-delays")) {
    s = s.replace(
      "const delays = [8000, 18000, 32000];",
      "const delays = [5000, 12000, 20000]; /* beam-splash-fast-delays */",
    );
    n++;
  }

  // Boot IPC must wait for host+auth only (not welcome/workspace UI).
  // Replacing the old full-startup race / 14s cap that caused false timeouts.
  if (!s.includes("wait for host+auth only")) {
    const oldBootRace = `ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
		assertDesktopSender(event, ["app"]);
		/* beam-boot-ipc-cap: host must become ready fairly fast; do not hang splash forever */
		await Promise.race([
			Promise.resolve(startup),
			new Promise((_, reject) => setTimeout(() => reject(new Error("Desktop Host ready timeout")), 14000))
		]);
		if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");`;
    const oldBootPlain = `ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
		assertDesktopSender(event, ["app"]);
		await startup;
		if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");`;
    const neuBoot = `ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
		assertDesktopSender(event, ["app"]);
		/* beam-boot-ipc-cap: wait for host+auth only — openInitialWindow/welcome must not block renderer boot */
		reconcileBackend();
		const bootDeadline = Date.now() + 60000;
		while (backend.host === void 0 || hostUrl === void 0) {
			if (Date.now() > bootDeadline) throw new Error("Desktop Host ready timeout");
			await new Promise((resolve) => setTimeout(resolve, 100));
			if (startup === void 0 && (backend.host === void 0 || hostUrl === void 0)) {
				await new Promise((resolve) => setTimeout(resolve, 250));
				if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");
				break;
			}
		}
		if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");`;
    if (s.includes(oldBootRace)) {
      s = s.split(oldBootRace).join(neuBoot);
      n++;
    } else if (s.includes(oldBootPlain)) {
      s = s.split(oldBootPlain).join(neuBoot);
      n++;
    }
  }

  if (n) fs.writeFileSync(mainPath, s);
  return {
    ok: true,
    patched: n,
    bootstuck: s.includes("beam-bootstuck-cap") || s.includes("bootingStuck"),
    ipcCap: s.includes("beam-boot-ipc-cap"),
    delays: s.includes("beam-splash-fast-delays"),
  };
}

const report = { web: [], main: [] };

for (const web of WEB_ROOTS) {
  if (!fs.existsSync(web)) {
    report.web.push({ web: path.relative(ROOT, web), status: "missing" });
    continue;
  }
  const assets = path.join(web, "assets");
  const css = patchCss(assets);
  const js = patchIndexJs(assets);
  const html = patchIndexHtml(web);
  report.web.push({
    web: path.relative(ROOT, web),
    css,
    js,
    html,
  });
}

for (const main of MAIN_FILES) {
  report.main.push({ file: path.relative(ROOT, main), ...patchMain(main) });
}

console.log(JSON.stringify(report, null, 2));
