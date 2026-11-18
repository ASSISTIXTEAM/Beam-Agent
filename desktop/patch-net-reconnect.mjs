/**
 * Resilient reconnect-and-continue:
 * - Detect navigator.onLine + bridge /health + /assistix/net (Host/Kumo)
 * - Soft UX while reconnecting; never treat blips as logout
 * - Debounced stable recovery → refresh session, Host WS reconnect, one LLM resume
 * - Gate EMPTY_RESPONSE spam while offline
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEAM_HOME = process.env.USERPROFILE || os.homedir();

const SCRIPT_MARK = "/* BEAM_NET_RECONNECT_WATCHDOG */";

const WATCHDOG = `
<script id="beam-net-reconnect">
${SCRIPT_MARK}
(function () {
  if (window.__beamNetWatchdogInstalled) return;
  window.__beamNetWatchdogInstalled = true;

  const BRIDGE = "http://127.0.0.1:17865";
  const STABLE_MS = 1500;
  const POLL_MS = 2500;
  const state = {
    browserOnline: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
    bridgeOk: true,
    kumoOk: null,
    hostOk: null,
    healthySince: 0,
    stable: true,
    reconnecting: false,
    pendingResume: false,
    lastEvent: "boot",
  };

  try {
    window.__DSH_CONNECTION_RECOVERY__ = Object.assign({}, window.__DSH_CONNECTION_RECOVERY__ || {}, {
      backoffBaseMs: 400,
      backoffMaxMs: 8000,
    });
  } catch {}

  const publish = (evt) => {
    try {
      window.__beamNetState = { ...state, online: !!(state.browserOnline && state.bridgeOk && state.stable) };
      window.__beamNetOnline = window.__beamNetState.online;
      window.__beamBridgeDown = !state.bridgeOk;
      window.dispatchEvent(new CustomEvent(evt, { detail: window.__beamNetState }));
    } catch {}
  };

  const ensureChip = () => {
    let el = document.getElementById("beam-net-chip");
    if (el) return el;
    el = document.createElement("div");
    el.id = "beam-net-chip";
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed", "left:50%", "bottom:18px", "transform:translateX(-50%)",
      "z-index:2147483640", "display:none", "align-items:center", "gap:8px",
      "padding:8px 14px", "border-radius:999px", "font:12px/1.3 Savona,Segoe UI,system-ui,sans-serif",
      "background:rgba(2,16,14,.92)", "color:#dff7f4", "border:1px solid rgba(0,179,188,.45)",
      "box-shadow:0 8px 28px rgba(0,0,0,.28)", "pointer-events:none", "letter-spacing:.01em",
    ].join(";");
    document.documentElement.appendChild(el);
    return el;
  };

  const setChip = (visible, text) => {
    try {
      const el = ensureChip();
      el.textContent = text || "";
      el.style.display = visible ? "inline-flex" : "none";
    } catch {}
  };

  const lang = () => {
    try {
      return (document.documentElement.dataset.beamLang || navigator.language || "en").toLowerCase().startsWith("ru")
        ? "ru" : "en";
    } catch { return "en"; }
  };

  const copy = {
    en: {
      offline: "No network — waiting to reconnect…",
      bridge: "Reconnecting to Beam Agent…",
      upstream: "Connection unstable — reconnecting…",
      resume: "Connection restored — continuing…",
    },
    ru: {
      offline: "Нет сети — ждём восстановления…",
      bridge: "Переподключение к Beam Agent…",
      upstream: "Связь нестабильна — переподключаемся…",
      resume: "Связь восстановлена — продолжаем…",
    },
  };

  const markUnhealthy = (reason) => {
    state.stable = false;
    state.healthySince = 0;
    state.reconnecting = true;
    state.lastEvent = reason;
    const t = copy[lang()] || copy.en;
    const msg = reason === "browser-offline" ? t.offline
      : reason === "bridge-down" ? t.bridge
      : t.upstream;
    setChip(true, msg);
    publish("beam:net-degraded");
  };

  const tryHostReconnect = () => {
    try {
      const conn = window.__dsh?.connection || window.dsh?.connection
        || window.__cordis?.connection || null;
      if (conn && typeof conn.reconnect === "function") conn.reconnect();
    } catch {}
    try {
      // Settings UI wires ConnectionIndicator via Cordis; also poke known global.
      if (typeof window.__beamHostReconnect === "function") window.__beamHostReconnect();
    } catch {}
  };

  const onStableRecovered = async () => {
    if (state.stable && !state.reconnecting && !state.pendingResume) return;
    state.stable = true;
    state.reconnecting = false;
    const t = copy[lang()] || copy.en;
    if (state.pendingResume) setChip(true, t.resume);
    else setChip(false, "");
    publish("beam:net-recovered");
    try {
      if (typeof window.__beamRefreshAssistix === "function") {
        await window.__beamRefreshAssistix({ force: true });
      }
    } catch {}
    tryHostReconnect();
    // One deferred resume signal for in-flight generation / llm-retry waiters.
    if (state.pendingResume) {
      state.pendingResume = false;
      try {
        window.dispatchEvent(new CustomEvent("beam:net-resume-turn", { detail: window.__beamNetState }));
      } catch {}
      setTimeout(() => setChip(false, ""), 1600);
    }
  };

  const evaluate = () => {
    const upstreamKnownBad = state.kumoOk === false && state.hostOk === false;
    const componentsOk = state.browserOnline && state.bridgeOk && !upstreamKnownBad;
    if (!componentsOk) {
      markUnhealthy(!state.browserOnline ? "browser-offline" : (!state.bridgeOk ? "bridge-down" : "upstream"));
      return;
    }
    if (!state.healthySince) state.healthySince = Date.now();
    if (Date.now() - state.healthySince >= STABLE_MS) {
      onStableRecovered();
    } else if (state.reconnecting) {
      const t = copy[lang()] || copy.en;
      setChip(true, t.upstream);
    }
    publish("beam:net-tick");
  };

  const probe = async () => {
    state.browserOnline = typeof navigator === "undefined" ? true : navigator.onLine !== false;
    if (!state.browserOnline) {
      state.bridgeOk = false;
      evaluate();
      return;
    }
    let bridgeOk = false;
    let kumoOk = null;
    let hostOk = null;
    try {
      const health = await fetch(BRIDGE + "/health", { cache: "no-store" });
      if (health.ok) {
        bridgeOk = true;
        const j = await health.json().catch(() => null);
        if (j && typeof j === "object") {
          if (typeof j.kumo === "boolean") kumoOk = j.kumo;
          if (typeof j.host === "boolean") hostOk = j.host;
        }
      }
    } catch {
      bridgeOk = false;
    }
    if (bridgeOk) {
      try {
        const net = await fetch(BRIDGE + "/assistix/net", { cache: "no-store" });
        if (net.ok) {
          const j = await net.json().catch(() => null);
          if (j && typeof j === "object") {
            if (typeof j.kumo === "boolean") kumoOk = j.kumo;
            if (typeof j.host === "boolean") hostOk = j.host;
          }
        }
      } catch {}
    }
    const wasDown = !state.bridgeOk || !state.stable;
    state.bridgeOk = bridgeOk;
    state.kumoOk = kumoOk;
    state.hostOk = hostOk;
    if (wasDown && bridgeOk) state.pendingResume = true;
    evaluate();
  };

  // Simulate offline for smoke tests: window.__beamSimulateOffline(true/false)
  window.__beamSimulateOffline = (off) => {
    state.browserOnline = !off;
    if (off) {
      state.bridgeOk = false;
      state.pendingResume = true;
      markUnhealthy("browser-offline");
    } else {
      probe();
    }
  };

  window.addEventListener("online", () => {
    state.browserOnline = true;
    state.pendingResume = true;
    state.healthySince = 0;
    probe();
  });
  window.addEventListener("offline", () => {
    state.browserOnline = false;
    state.pendingResume = true;
    markUnhealthy("browser-offline");
  });

  // Generation failures while offline → queue one resume after stable reconnect.
  window.addEventListener("beam:generation-paused", () => {
    state.pendingResume = true;
    if (!state.stable) markUnhealthy(state.lastEvent || "upstream");
  });

  setInterval(probe, POLL_MS);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => probe());
  else probe();
  publish("beam:net-boot");
})();
</script>
`;

function htmlTargets() {
  const rels = [
    "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
    "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
    "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
    "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
    path.join(BEAM_HOME, "BeamAgent", "resources", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
    path.join(BEAM_HOME, "BeamAgent", "resources", "app", "beam", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html"),
  ];
  const out = [];
  for (const r of rels) {
    const p = path.isAbsolute(r) ? r : path.join(ROOT, r);
    if (fs.existsSync(p)) out.push(p);
  }
  return [...new Set(out)];
}

function llmRetryTargets() {
  const bases = [
    path.join(ROOT, "runtime", "app"),
    path.join(ROOT, "dist", "Beam Agent", "resources", "app"),
    path.join(BEAM_HOME, "BeamAgent", "resources", "app"),
  ];
  const out = [];
  for (const app of bases) {
    for (const ns of ["@assistix/beam-llm-retry", "@deepseek-ai/dsh-llm-retry"]) {
      for (const tree of ["beam", "dsh"]) {
        const f = path.join(app, tree, "node_modules", ns, "lib", "index.js");
        if (fs.existsSync(f)) out.push(f);
      }
    }
  }
  return [...new Set(out)];
}

function mainJsTargets() {
  return [
    path.join(ROOT, "runtime", "app", "lib", "main.js"),
    path.join(ROOT, "dist", "Beam Agent", "resources", "app", "lib", "main.js"),
    path.join(BEAM_HOME, "BeamAgent", "resources", "app", "lib", "main.js"),
  ].filter((p) => fs.existsSync(p));
}

const RETRY_MARK = "/* BEAM_NET_RETRY_GATE */";
const RETRY_HOOK = `
${RETRY_MARK}
async function beamWaitForNetIfOffline(signal) {
  try {
    if (globalThis.__beamNetOnline !== false && globalThis.__beamSimulateOffline !== true) return true;
  } catch {}
  try { globalThis.dispatchEvent?.(new CustomEvent("beam:generation-paused")); } catch {}
  return await new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { globalThis.removeEventListener?.("beam:net-recovered", onRec); } catch {}
      try { signal?.removeEventListener?.("abort", onAbort); } catch {}
      resolve(ok);
    };
    const onRec = () => finish(true);
    const onAbort = () => finish(false);
    try { globalThis.addEventListener?.("beam:net-recovered", onRec, { once: true }); } catch {}
    try { signal?.addEventListener?.("abort", onAbort, { once: true }); } catch {}
    setTimeout(() => finish(globalThis.__beamNetOnline !== false), 20000);
  });
}
`;

let nHtml = 0;
for (const file of htmlTargets()) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(SCRIPT_MARK)) {
    // Replace existing block
    s = s.replace(/<script id="beam-net-reconnect">[\s\S]*?<\/script>/, WATCHDOG.trim());
  } else if (s.includes("</body>")) {
    s = s.replace("</body>", WATCHDOG + "\n</body>");
  } else {
    s += "\n" + WATCHDOG;
  }
  fs.writeFileSync(file, s);
  nHtml++;
  console.log("html", path.relative(ROOT, file));
}

let nRetry = 0;
for (const file of llmRetryTargets()) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(RETRY_MARK)) {
    // Insert helper near top after imports / before apply
    if (s.includes("async function recover(")) {
      s = s.replace("async function recover(", RETRY_HOOK + "\nasync function recover(");
    } else if (s.includes("async function recover({")) {
      s = s.replace("async function recover({", RETRY_HOOK + "\nasync function recover({");
    } else {
      console.warn("retry hook site missing", file);
      continue;
    }
  }
  // Gate EMPTY_RESPONSE / TRANSPORT retries while offline — wait for stable reconnect once.
  const gateNeedle = "if (policy.mode === \"normal\" && previousRetry >= policy.maxRetries) return next();";
  const gateReplace = `if (policy.mode === "normal" && previousRetry >= policy.maxRetries) return next();
\t\t/* BEAM_NET_RETRY_OFFLINE_GATE */
\t\tif ((failure?.code === "EMPTY_RESPONSE" || failure?.code === "TRANSPORT" || failure?.code === "TIMEOUT" || /network_interrupted|fetch failed|Failed to fetch/i.test(String(failure?.message || ""))) && previousRetry >= 1 && globalThis.__beamNetOnline === false) return next();
\t\tif ((failure?.code === "EMPTY_RESPONSE" || failure?.code === "TRANSPORT" || failure?.code === "TIMEOUT" || /network_interrupted|fetch failed|Failed to fetch/i.test(String(failure?.message || ""))) && globalThis.__beamNetOnline === false) {
\t\t\tconst ok = await beamWaitForNetIfOffline(signal);
\t\t\tif (!ok) return next();
\t\t\tif (previousRetry >= 1) return next();
\t\t}`;
  if (s.includes(gateNeedle) && !s.includes("BEAM_NET_RETRY_OFFLINE_GATE")) {
    s = s.replace(gateNeedle, gateReplace);
  }
  fs.writeFileSync(file, s);
  nRetry++;
  console.log("retry", path.relative(ROOT, file));
}

const MAIN_MARK = "/* BEAM_BRIDGE_WATCHDOG */";
const MAIN_SNIPPET = `
${MAIN_MARK}
(function beamBridgeWatchdog() {
\ttry {
\t\tif (process.platform !== "win32") return;
\t\tlet fails = 0;
\t\tlet spawning = false;
\t\tconst probe = async () => {
\t\t\ttry {
\t\t\t\tconst ac = new AbortController();
\t\t\t\tconst t = setTimeout(() => ac.abort(), 2500);
\t\t\t\tconst r = await fetch("http://127.0.0.1:17865/health", { signal: ac.signal, cache: "no-store" });
\t\t\t\tclearTimeout(t);
\t\t\t\treturn !!r && r.ok;
\t\t\t} catch {
\t\t\t\treturn false;
\t\t\t}
\t\t};
\t\tconst respawn = () => {
\t\t\tif (spawning) return;
\t\t\tspawning = true;
\t\t\ttry {
\t\t\t\tconst beamRoot = process.env.BEAM_ROOT || dirname(process.execPath);
\t\t\t\tconst bridgeJs = join(beamRoot, "bridge", "server.js");
\t\t\t\tconst candidates = [
\t\t\t\t\tjoin(beamRoot, "resources", "runtime", "primary-runtime", "dependencies", "node", "bin", "node.exe"),
\t\t\t\t\ttypeof process.env.BEAM_NODE === "string" ? process.env.BEAM_NODE : "",
\t\t\t\t];
\t\t\t\tlet nodeExe = "";
\t\t\t\tfor (const c of candidates) {
\t\t\t\t\tif (c && existsSync(c)) { nodeExe = c; break; }
\t\t\t\t}
\t\t\t\tif (!nodeExe || !existsSync(bridgeJs)) return;
\t\t\t\tconst child = spawn(nodeExe, [bridgeJs], {
\t\t\t\t\tcwd: beamRoot,
\t\t\t\t\tenv: process.env,
\t\t\t\t\tdetached: true,
\t\t\t\t\tstdio: "ignore",
\t\t\t\t\twindowsHide: true,
\t\t\t\t});
\t\t\t\tchild.unref();
\t\t\t} catch {}
\t\t\tfinally { setTimeout(() => { spawning = false; }, 4000); }
\t\t};
\t\tsetInterval(async () => {
\t\t\tconst ok = await probe();
\t\t\tif (ok) { fails = 0; return; }
\t\t\tfails += 1;
\t\t\tif (fails >= 2) respawn();
\t\t}, 5000);
\t} catch {}
})();
`;

let nMain = 0;
for (const file of mainJsTargets()) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(MAIN_MARK)) {
    s = s.replace(/\/\* BEAM_BRIDGE_WATCHDOG \*\/[\s\S]*?\}\)\(\);/, MAIN_SNIPPET.trim());
  } else if (s.includes("})();") && s.includes("BEAM_SILENT_BRIDGE_BOOT")) {
    // Append after silent boot IIFE
    s = s.replace(
      /(\/\* BEAM_SILENT_BRIDGE_BOOT[\s\S]*?\}\)\(\);\s*)/,
      `$1\n${MAIN_SNIPPET}\n`
    );
  } else {
    s = MAIN_SNIPPET + "\n" + s;
  }
  fs.writeFileSync(file, s);
  nMain++;
  console.log("main", path.relative(ROOT, file));
}

console.log("done html=", nHtml, "retry=", nRetry, "main=", nMain);
