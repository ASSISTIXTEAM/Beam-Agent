/**
 * Beam Agent: Auto model picker (default) + smart routing + mini usage rings.
 *
 * - Trigger shows "Auto" by default (never "Select model")
 * - Popup: Auto toggle on top; when OFF → Tide / Flare / Pine with compact quota rings
 * - Smart route prefers weakest capable model; escalate for coding/tools/heavy
 * - Persist ~/.beam/model-prefs.json { auto, lastManual }
 * - Bridge resolves model "auto" / prefs.auto on /anthropic/v1/messages
 * Applies runtime + dist; cache-busts web assets.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "/* beam-auto-model */";
const BEAM_HOME = process.env.BEAM_HOME || path.join(os.homedir(), ".beam");
const PREFS = path.join(BEAM_HOME, "model-prefs.json");
const report = [];

function log(f) {
  report.push(path.relative(ROOT, f).replace(/\\/g, "/"));
}

function write(file, s) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, s);
  log(file);
}

function patchFile(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after == null || after === before) return false;
  fs.writeFileSync(file, after);
  log(file);
  return true;
}

function appRoots() {
  return [
    path.join(ROOT, "runtime", "app"),
    path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
  ].filter((p) => fs.existsSync(p));
}

function modelSelectionFiles() {
  const out = [];
  for (const app of appRoots()) {
    for (const base of ["beam", "dsh"]) {
      for (const ns of [
        "@assistix/beam-client-ui-model-selection",
        "@deepseek-ai/dsh-client-ui-model-selection",
      ]) {
        const f = path.join(app, base, "node_modules", ns, "lib", "client.js");
        if (fs.existsSync(f)) out.push(f);
      }
    }
  }
  return [...new Set(out)];
}

function webHtmlFiles() {
  const out = [];
  for (const app of appRoots()) {
    for (const base of ["beam", "dsh"]) {
      for (const ns of ["@assistix/beam-web-frontend", "@deepseek-ai/dsh-web-frontend"]) {
        const f = path.join(app, base, "node_modules", ns, "dist", "index.html");
        if (fs.existsSync(f)) out.push(f);
      }
    }
  }
  return [...new Set(out)];
}

function webCssFiles() {
  const out = [];
  for (const app of appRoots()) {
    for (const base of ["beam", "dsh"]) {
      for (const ns of ["@assistix/beam-web-frontend", "@deepseek-ai/dsh-web-frontend"]) {
        const f = path.join(app, base, "node_modules", ns, "dist", "assets", "beam-override.css");
        if (fs.existsSync(f)) out.push(f);
      }
    }
  }
  return [...new Set(out)];
}

function ensurePrefs() {
  fs.mkdirSync(BEAM_HOME, { recursive: true });
  if (!fs.existsSync(PREFS)) {
    fs.writeFileSync(
      PREFS,
      JSON.stringify({ auto: true, lastManual: "tide", updatedAt: new Date().toISOString() }, null, 2),
    );
  } else {
    try {
      const j = JSON.parse(fs.readFileSync(PREFS, "utf8"));
      if (typeof j.auto !== "boolean") j.auto = true;
      if (!["tide", "flare", "pine"].includes(String(j.lastManual || "").toLowerCase())) j.lastManual = "tide";
      fs.writeFileSync(PREFS, JSON.stringify(j, null, 2));
    } catch {
      fs.writeFileSync(
        PREFS,
        JSON.stringify({ auto: true, lastManual: "tide", updatedAt: new Date().toISOString() }, null, 2),
      );
    }
  }
  log(PREFS);
}

/** ---------- Bridge restore + Auto routing ---------- */
const BRIDGE_SRC = path.join(ROOT, "desktop", "bridge", "server.js");
const BRIDGE_DIST = path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js");
const BRIDGE_ORIG = path.join(ROOT, "desktop", "bridge", "_restored_from_transcript.js");

function buildBridge() {
  // Never clobber a healthy restored bridge — only additive Auto patches.
  if (fs.existsSync(BRIDGE_SRC)) {
    const cur = fs.readFileSync(BRIDGE_SRC, "utf8");
    if (
      cur.includes("async function handleMessages") &&
      cur.includes("server.listen") &&
      cur.length > 40000
    ) {
      let s = cur;
      if (!s.includes("function smartRouteModel")) {
        console.warn("bridge healthy but missing Auto — run surgical StrReplace / re-apply helpers");
      }
      // Sync dist copy only
      fs.mkdirSync(path.dirname(BRIDGE_DIST), { recursive: true });
      fs.copyFileSync(BRIDGE_SRC, BRIDGE_DIST);
      log(BRIDGE_SRC);
      log(BRIDGE_DIST);
      return;
    }
  }

  // Prefer reconstructing from original transcript copy if current is truncated.
  let base = fs.existsSync(BRIDGE_ORIG)
    ? fs.readFileSync(BRIDGE_ORIG, "utf8")
    : fs.readFileSync(BRIDGE_SRC, "utf8");

  let s = base;

  // Fix ROOT (desktop/bridge → repo root for logo paths historically used ..,..)
  s = s.replace(
    /const ROOT = path\.resolve\(__dirname, '\.\.', '\.\.'\)/,
    "const ROOT = path.resolve(__dirname, '..', '..')",
  );
  if (!s.includes("OAUTH_CLIENT_ID")) {
    s = s.replace(
      "const ID_BASE = process.env.ASSISTIX_ID_URL || 'https://id.assistix.org'",
      `const ID_BASE = process.env.ASSISTIX_ID_URL || 'https://id.assistix.org'\nconst OAUTH_CLIENT_ID = process.env.ASSISTIX_OAUTH_CLIENT_ID || "assistix-agent"\nconst OAUTH_CLIENT_SECRET = process.env.ASSISTIX_OAUTH_CLIENT_SECRET || "YOUR_OAUTH_CLIENT_SECRET_HERE"\nconst OAUTH_REDIRECT = () => \`http://127.0.0.1:\${PORT}/assistix/callback\`\nconst PREFS_FILE = path.join(process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam'), 'model-prefs.json')`,
    );
  } else if (!s.includes("PREFS_FILE")) {
    s = s.replace(
      /const OAUTH_REDIRECT = \(\) => `http:\/\/127\.0\.0\.1:\$\{PORT\}\/assistix\/callback`/,
      `const OAUTH_REDIRECT = () => \`http://127.0.0.1:\${PORT}/assistix/callback\`\nconst PREFS_FILE = path.join(process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam'), 'model-prefs.json')`,
    );
  }

  // Modern MODELS + quotas
  const MODELS_BLOCK = `/** Beam Agent catalog (display → Kumorouter). Tide cheapest → Pine strongest. */
const MODELS = {
  tide: {
    id: 'tide',
    name: 'Tide',
    backend: 'deepseek-v4-1-flash',
    backends: ['deepseek-v4-1-flash', 'qwen3-8-flash', 'deepseek-v4-flash'],
    limit: 1_000_000,
    contextWindow: 1_048_576,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-1-flash', 'tide', 'auto'],
  },
  flare: {
    id: 'flare',
    name: 'Flare',
    backend: 'google/gemini-3.1-flash-lite',
    backends: ['google/gemini-3.1-flash-lite', 'gemini-3.8-flash', 'qwen3-8-flash', 'gemini-3.6-flash'],
    limit: 100_000,
    contextWindow: 1_048_576,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['flair', 'flare', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.8-flash-high'],
  },
  pine: {
    id: 'pine',
    name: 'Pine',
    backend: 'xai/grok-4.7',
    backends: ['xai/grok-4.7', 'grok-4.7'],
    limit: 10_000,
    contextWindow: 131_072,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['pine', 'grok-4.7', 'xai/grok-4.7', 'deepseek-v4-pro'],
  },
}
`;

  if (/const MODELS = \{[\s\S]*?\n\}/.test(s)) {
    s = s.replace(/const MODELS = \{[\s\S]*?\n\}/, MODELS_BLOCK.trim());
  } else {
    s = s.replace(
      "const PORT = Number(process.env.BEAM_BRIDGE_PORT || 17865)",
      `const PORT = Number(process.env.BEAM_BRIDGE_PORT || 17865)\n\n${MODELS_BLOCK}`,
    );
  }

  // Auto prefs + smart route (idempotent)
  if (!s.includes("function loadModelPrefs")) {
    const helpers = `
${MARK}
function loadModelPrefs() {
  try {
    const home = process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam')
    const file = typeof PREFS_FILE === 'string' ? PREFS_FILE : path.join(home, 'model-prefs.json')
    if (!fs.existsSync(file)) return { auto: true, lastManual: 'tide' }
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    return {
      auto: j.auto !== false,
      lastManual: ['tide', 'flare', 'pine'].includes(String(j.lastManual || '').toLowerCase())
        ? String(j.lastManual).toLowerCase()
        : 'tide',
    }
  } catch {
    return { auto: true, lastManual: 'tide' }
  }
}

function saveModelPrefs(prefs) {
  const home = process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam')
  const file = typeof PREFS_FILE === 'string' ? PREFS_FILE : path.join(home, 'model-prefs.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({
    auto: prefs.auto !== false,
    lastManual: prefs.lastManual || 'tide',
    updatedAt: new Date().toISOString(),
  }, null, 2))
}

/**
 * Prefer weakest model that can handle the task.
 * Signals → pine (heavy/code/tools/long), flare (creative/style), else tide.
 */
function smartRouteModel(body, state) {
  const msgs = Array.isArray(body?.messages) ? body.messages : []
  let text = ''
  let hasTools = Array.isArray(body?.tools) && body.tools.length > 0
  let toolResults = 0
  for (const m of msgs) {
    if (typeof m?.content === 'string') text += '\\n' + m.content
    else if (Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type === 'text') text += '\\n' + (b.text || '')
        if (b?.type === 'tool_use' || b?.type === 'tool_result') {
          hasTools = true
          if (b?.type === 'tool_result') toolResults++
        }
      }
    }
  }
  const sys = typeof body?.system === 'string'
    ? body.system
    : Array.isArray(body?.system)
      ? body.system.map((b) => b?.text || '').join('\\n')
      : ''
  text = (sys + '\\n' + text).toLowerCase()

  const long = text.length > 6000 || msgs.length > 24 || toolResults > 4
  const coding = /\\b(code|coding|refactor|typescript|javascript|python|rust|golang|\\bdebug\\b|stack trace|compiler|eslint|webpack|react|node_modules|git diff|pull request|dockerfile|kubernetes|sql|regex)\\b|\`\`\`|функци|код|рефактор|отладк/i.test(text)
  const creative = /\\b(rewrite|polish|tone|brand|marketing|poem|story|creative|copywriting|слог|стилизац|креатив|перепиши|реклам)\\b/i.test(text)
  const heavy = /\\b(architect|multi-?step|plan carefully|deep analysis|prove|theorem|research|security audit|архитектур|доказа|исслед)/i.test(text) || long

  const remaining = (id) => {
    const lim = MODELS[id]?.limit || 1
    const used = Number(state?.quotas?.[id]?.used) || 0
    return used < lim
  }

  let pick = 'tide'
  if (heavy || (coding && hasTools) || (coding && long)) pick = 'pine'
  else if (coding || creative) pick = 'flare'
  else pick = 'tide'

  // Escalate down if exhausted: pine→flare→tide (still prefer weakest available for non-heavy)
  const orderStrong = ['pine', 'flare', 'tide']
  const orderWeak = ['tide', 'flare', 'pine']
  if (!remaining(pick)) {
    const ladder = pick === 'tide' ? orderWeak : orderStrong
    pick = ladder.find((id) => remaining(id)) || 'tide'
  }
  return MODELS[pick] || MODELS.tide
}

function resolveTierWithAuto(modelId, body, state) {
  const prefs = loadModelPrefs()
  const id = String(modelId || '').toLowerCase()
  const flag = body?.metadata?.beam_auto === true || body?.beam_auto === true
  // When Auto is on (prefs or explicit id/flag), always smart-route — client may still send tide/flare/pine.
  if (prefs.auto || flag || id === 'auto' || id === 'assistix-auto') {
    return smartRouteModel(body, state)
  }
  return resolveTier(id === 'auto' ? 'tide' : modelId)
}
`;
    // Insert after resolveTier
    if (s.includes("function resolveTier(modelId)")) {
      s = s.replace(
        /function resolveTier\(modelId\) \{[\s\S]*?return MODELS\.tide\n\}\n/,
        (m) => m + "\n" + helpers + "\n",
      );
    } else {
      s = s.replace("function readBody(req)", helpers + "\nfunction readBody(req)");
    }
  }

  // Wire handleMessages to use resolveTierWithAuto
  s = s.replace(
    "const tier = resolveTier(body.model)",
    "const tier = (typeof resolveTierWithAuto === 'function' ? resolveTierWithAuto(body.model, body, state) : resolveTier(body.model))",
  );

  // /models listing + prefs endpoints
  if (!s.includes("url.pathname === '/models'") && s.includes("if (url.pathname === '/health')")) {
    s = s.replace(
      "if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'beam-bridge' })",
      `if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'beam-bridge' })

    if (
      (url.pathname === '/models' ||
        url.pathname === '/v1/models' ||
        url.pathname === '/anthropic/v1/models' ||
        url.pathname === '/anthropic/models') &&
      req.method === 'GET'
    ) {
      const data = Object.values(MODELS).filter((m) => m.id !== 'auto').map((m) => ({
        id: m.id,
        object: 'model',
        created: 0,
        owned_by: 'beam-agent',
        display_name: m.name,
        name: m.name,
        context_window: m.contextWindow || 128000,
        max_output_tokens: m.maxTokensCap || 65536,
        input_modalities: m.id === 'pine' ? ['text'] : ['text', 'image'],
        output_modalities: ['text'],
      }))
      return sendJson(res, 200, { object: 'list', data })
    }

    if (url.pathname === '/assistix/model-prefs' && req.method === 'GET') {
      return sendJson(res, 200, loadModelPrefs())
    }
    if (url.pathname === '/assistix/model-prefs' && req.method === 'POST') {
      const raw = await readBody(req)
      let body = {}
      try { body = JSON.parse(raw.toString('utf8') || '{}') } catch {}
      const next = {
        auto: body.auto !== false,
        lastManual: ['tide', 'flare', 'pine'].includes(String(body.lastManual || '').toLowerCase())
          ? String(body.lastManual).toLowerCase()
          : 'tide',
      }
      saveModelPrefs(next)
      return sendJson(res, 200, next)
    }`,
    );
  }

  // Sync quotas caps from MODELS on load
  if (!s.includes("/* beam-auto-sync-quota-caps */") && s.includes("function loadState()")) {
    s = s.replace(
      "function loadState() {\n  ensureData()\n  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))\n}",
      `function loadState() {
  ensureData()
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  /* beam-auto-sync-quota-caps */
  state.quotas = state.quotas || {}
  for (const m of Object.values(MODELS)) {
    const q = state.quotas[m.id] || { used: 0, limit: m.limit }
    q.limit = m.limit
    q.used = Math.min(Number(q.used) || 0, m.limit)
    state.quotas[m.id] = q
  }
  return state
}`,
    );
  }

  // Include persona scrub lightly if missing
  if (!s.includes("function scrubBrandLeak") && fs.existsSync(path.join(ROOT, "desktop/bridge/_persona_dsml_snip.js"))) {
    // skip full DSML for restore stability; persona flavor applied via system prepend below
  }

  if (!s.includes("/* beam-auto-persona-prepend */") && s.includes("anthropicToOpenAIMessages(body.messages, body.system)")) {
    s = s.replace(
      "messages: anthropicToOpenAIMessages(body.messages, body.system),",
      `messages: anthropicToOpenAIMessages(body.messages, (typeof body.system === 'string' ? body.system + '\\n\\n' : '') + \`ACTIVE MODEL THIS SESSION: Assistix \${tier.name} (Beam Agent).\` /* beam-auto-persona-prepend */),`,
    );
  }

  write(BRIDGE_SRC, s);
  fs.mkdirSync(path.dirname(BRIDGE_DIST), { recursive: true });
  fs.copyFileSync(BRIDGE_SRC, BRIDGE_DIST);
  log(BRIDGE_DIST);
}

/** ---------- Model selection UI ---------- */
const AUTO_HELPERS = `
		${MARK}
		function beamReadAutoPrefs() {
			try {
				const raw = localStorage.getItem("beam.modelPrefs");
				if (raw) {
					const j = JSON.parse(raw);
					return { auto: j.auto !== false, lastManual: j.lastManual || "tide" };
				}
			} catch {}
			return { auto: true, lastManual: "tide" };
		}
		function beamWriteAutoPrefs(prefs) {
			const next = { auto: prefs.auto !== false, lastManual: prefs.lastManual || "tide", updatedAt: Date.now() };
			try { localStorage.setItem("beam.modelPrefs", JSON.stringify(next)); } catch {}
			try { window.__beamModelPrefs = next; } catch {}
			try {
				fetch("http://127.0.0.1:17865/assistix/model-prefs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(next)
				}).catch(() => {});
			} catch {}
			try { window.dispatchEvent(new CustomEvent("beam:model-prefs", { detail: next })); } catch {}
			return next;
		}
		function beamQuotaFor(id) {
			const snap = (typeof window !== "undefined" && window.__beamLimitsSnapshot) || { models: [] };
			const m = (snap.models || []).find((x) => x.id === id) || null;
			const defaults = { tide: 1e6, flare: 1e5, pine: 1e4 };
			const used = Number(m?.used) || 0;
			const rawLim = m?.limit == null || m?.limit === "" ? NaN : Number(m.limit);
			const unlimited = !!(m?.unlimited || !Number.isFinite(rawLim) || rawLim >= 1e9 || rawLim >= 2147483640);
			const limit = unlimited ? null : Math.max(1, Number.isFinite(rawLim) ? rawLim : (defaults[id] || 1));
			const remaining = unlimited ? null : Math.max(0, limit - used);
			const pct = unlimited ? 100 : Math.min(100, Math.round((remaining / limit) * 100));
			const color = m?.color || ({ tide: "#f97316", flare: "#a78bfa", pine: "#34d399" }[id] || "#00B3BC");
			return { used, limit, remaining, unlimited, pct, pctLabel: unlimited ? "∞" : (pct + "%"), color };
		}
		function BeamMiniRing({ modelId }) {
			const q = beamQuotaFor(modelId);
			const r = 7, c = 2 * Math.PI * r, dash = (q.pct / 100) * c;
			return (0, react_jsx_runtime.jsxs)("span", {
				className: "beam-mini-ring",
				title: q.pctLabel,
				"aria-hidden": "true",
				children: [
					(0, react_jsx_runtime.jsxs)("svg", {
						viewBox: "0 0 18 18",
						width: 16,
						height: 16,
						children: [
							(0, react_jsx_runtime.jsx)("circle", { cx: 9, cy: 9, r, fill: "none", stroke: "rgba(255,255,255,.12)", strokeWidth: 2.2 }),
							(0, react_jsx_runtime.jsx)("circle", {
								cx: 9, cy: 9, r, fill: "none", stroke: q.color, strokeWidth: 2.2, strokeLinecap: "round",
								transform: "rotate(-90 9 9)",
								strokeDasharray: dash.toFixed(2) + " " + (c - dash).toFixed(2)
							})
						]
					})
				]
			});
		}
`;

function patchModelSelection(file) {
  patchFile(file, (src) => {
    let s = src;

    // Dictionaries: Select model → Auto
    const dictPairs = [
      ['"trigger.fallback": "Select model"', '"trigger.fallback": "Auto"'],
      ['"trigger.selectAria": "Select model"', '"trigger.selectAria": "Auto"'],
      ['"trigger.fallback": "Выбрать модель"', '"trigger.fallback": "Auto"'],
      ['"trigger.selectAria": "Выбрать модель"', '"trigger.selectAria": "Auto"'],
      ['"trigger.fallback": "请选择模型"', '"trigger.fallback": "Auto"'],
      ['"trigger.selectAria": "请选择模型"', '"trigger.selectAria": "Auto"'],
      ['"trigger.aria": "Select model, current {model}"', '"trigger.aria": "Model, current {model}"'],
      ['"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}"', '"trigger.ariaEffort": "Model, current {model}, effort {effort}"'],
      ['"command.description": "Select the model for this conversation"', '"command.description": "Auto picks the model, or choose Tide / Flare / Pine"'],
      ['"command.description": "Выберите модель для этого разговора"', '"command.description": "Auto выбирает модель, или Tide / Flare / Pine"'],
    ];
    for (const [a, b] of dictPairs) {
      if (s.includes(a)) s = s.split(a).join(b);
    }

    // Inject helpers once before ModelSelect
    if (!s.includes("function beamReadAutoPrefs")) {
      s = s.replace(
        "function ModelSelect({ locked, available, directory, load, select, t, renderSlot }) {",
        AUTO_HELPERS + "\n\t\tfunction ModelSelect({ locked, available, directory, load, select, t, renderSlot }) {",
      );
    }

    // State for auto prefs inside ModelSelect
    if (!s.includes("beamAutoPrefs") && s.includes("const [open, setOpen] = (0, react.useState)(false);")) {
      s = s.replace(
        "const [open, setOpen] = (0, react.useState)(false);",
        `const [open, setOpen] = (0, react.useState)(false);
			const [beamAutoPrefs, setBeamAutoPrefs] = (0, react.useState)(() => beamReadAutoPrefs());
			(0, react.useEffect)(() => {
				const sync = () => setBeamAutoPrefs(beamReadAutoPrefs());
				window.addEventListener("beam:model-prefs", sync);
				window.addEventListener("beam:limits-updated", sync);
				// Hydrate from bridge
				fetch("http://127.0.0.1:17865/assistix/model-prefs").then((r) => r.json()).then((j) => {
					if (j && typeof j.auto === "boolean") setBeamAutoPrefs(beamWriteAutoPrefs(j));
				}).catch(() => {});
				return () => {
					window.removeEventListener("beam:model-prefs", sync);
					window.removeEventListener("beam:limits-updated", sync);
				};
			}, []);`,
      );
    }

    // Open model pane directly (skip root Model/Effort)
    if (s.includes('setPane(currentChoice === void 0 ? "model" : "root");') && !s.includes("/* beam-auto-open-model */")) {
      s = s.replace(
        'setPane(currentChoice === void 0 ? "model" : "root");',
        'setPane("model"); /* beam-auto-open-model */',
      );
    }

    // Trigger label: Auto when prefs.auto
    if (!s.includes("/* beam-auto-trigger-label */")) {
      s = s.replace(
        'const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? t("trigger.fallback");',
        `const modelLabel = waiting ? t("trigger.loading") : (beamAutoPrefs?.auto ? "Auto" : (currentChoice?.model.name ?? t("trigger.fallback"))); /* beam-auto-trigger-label */`,
      );
      s = s.replace(
        "children: currentChoice === void 0 ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, \"trigger\", true)",
        `children: (beamAutoPrefs?.auto || currentChoice === void 0) ? modelLabel : renderModelLabel(currentChoice.group.provider, currentChoice.model, "trigger", true)`,
      );
    }

    // choose(): turning Auto off on manual pick
    if (!s.includes("/* beam-auto-manual-pick */") && s.includes("const choose = (selection) => {")) {
      s = s.replace(
        "const choose = (selection) => {\n\t\t\t\tif (state.current?.provider === selection.provider && state.current.model === selection.model) {\n\t\t\t\t\tcloseAfterSelection();\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t\tsubmit(selection);\n\t\t\t};",
        `const choose = (selection) => {
				/* beam-auto-manual-pick */
				const mid = String(selection.model || "").toLowerCase();
				if (["tide", "flare", "pine"].includes(mid)) {
					setBeamAutoPrefs(beamWriteAutoPrefs({ auto: false, lastManual: mid }));
				}
				if (state.current?.provider === selection.provider && state.current.model === selection.model && !beamAutoPrefs?.auto) {
					closeAfterSelection();
					return;
				}
				submit(selection);
			};`,
      );
    }

    // Inject Auto toggle + rings into model pane
    if (!s.includes("beam-auto-toggle-row") && s.includes('pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment')) {
      s = s.replace(
        'pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [',
        `pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: "beam-auto-toggle-row",
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: "beam-auto-toggle-copy",
											children: [
												(0, react_jsx_runtime.jsx)("div", { className: "beam-auto-toggle-title", children: "Auto" }),
												(0, react_jsx_runtime.jsx)("div", {
													className: "beam-auto-toggle-hint",
													children: ((document.documentElement.lang || "").toLowerCase().startsWith("ru") || document.documentElement.dataset.beamLang === "ru")
														? "Умный выбор: слабее, если хватает"
														: "Smart pick: weakest that fits"
												})
											]
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "switch",
											"aria-checked": !!beamAutoPrefs?.auto,
											className: "beam-auto-switch" + (beamAutoPrefs?.auto ? " is-on" : ""),
											onClick: () => {
												const nextAuto = !beamAutoPrefs?.auto;
												const last = beamAutoPrefs?.lastManual || "tide";
												const next = beamWriteAutoPrefs({ auto: nextAuto, lastManual: last });
												setBeamAutoPrefs(next);
												if (!nextAuto) {
													const g = state.groups?.[0];
													const provider = g?.id || state.current?.provider || "assistix-official";
													submit({ provider, model: last });
												} else {
													closeAfterSelection();
												}
											},
											children: (0, react_jsx_runtime.jsx)("span", { className: "beam-auto-switch-knob" })
										})
									]
								}),
								!beamAutoPrefs?.auto ? null : (0, react_jsx_runtime.jsx)("div", {
									className: "beam-auto-active-note",
									children: ((document.documentElement.lang || "").toLowerCase().startsWith("ru") || document.documentElement.dataset.beamLang === "ru")
										? "Модель подберётся сама под задачу"
										: "Model is chosen per task"
								}),`,
      );
    }

    // Mini ring beside each model name
    if (!s.includes("BeamMiniRing") || !s.includes('model.id }), (0, react_jsx_runtime.jsx)(BeamMiniRing')) {
      s = s.replace(
        `children: [(0, react_jsx_runtime.jsx)("span", {
														className: ModelSelect_module_css_default.optionCopy,
														children: (0, react_jsx_runtime.jsx)("span", {
															className: ModelSelect_module_css_default.modelName,
															children: renderModelLabel(group.provider, model, "option", selected)
														})
													}), (0, react_jsx_runtime.jsx)("span", {
														className: ModelSelect_module_css_default.check,`,
        `children: [(0, react_jsx_runtime.jsx)(BeamMiniRing, { modelId: model.id }), (0, react_jsx_runtime.jsx)("span", {
														className: ModelSelect_module_css_default.optionCopy,
														children: (0, react_jsx_runtime.jsx)("span", {
															className: ModelSelect_module_css_default.modelName,
															children: renderModelLabel(group.provider, model, "option", selected)
														})
													}), (0, react_jsx_runtime.jsx)("span", {
														className: ModelSelect_module_css_default.check,`,
      );
    }

    // Dim model rows while Auto is on (still visible for rings)
    if (!s.includes("beam-auto-dim") && s.includes("ModelSelect_module_css_default.modelOption")) {
      s = s.replace(
        "className: clsx(ModelSelect_module_css_default.option, ModelSelect_module_css_default.modelOption, selected && ModelSelect_module_css_default.selected, index === activeModelIndex && ModelSelect_module_css_default.optionActive),",
        "className: clsx(ModelSelect_module_css_default.option, ModelSelect_module_css_default.modelOption, selected && ModelSelect_module_css_default.selected, index === activeModelIndex && ModelSelect_module_css_default.optionActive, beamAutoPrefs?.auto && \"beam-auto-dim\"),",
      );
      s = s.replace(
        "disabled: busy,",
        "disabled: busy || !!beamAutoPrefs?.auto,",
      );
    }

    // Catalog default stays tide (routing decides); trigger shows Auto via prefs
    s = s.replace(
      'default: { provider: "assistix-official", model: "tide" }',
      'default: { provider: "assistix-official", model: "tide" } /* beam-auto: UI label Auto via prefs */',
    );

    return s;
  });
}

const CSS_BLOCK = `
/* ===== BEAM Auto model picker ===== */
${MARK}
.beam-auto-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 8px 6px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.beam-auto-toggle-copy {
  flex: 1;
  min-width: 0;
}
.beam-auto-toggle-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsw-alias-label-primary, #e8f2f0);
}
.beam-auto-toggle-hint {
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-tertiary, #8faba5);
  margin-top: 2px;
}
.beam-auto-switch {
  position: relative;
  width: 36px !important;
  height: 20px !important;
  min-width: 36px !important;
  min-height: 20px !important;
  border-radius: 999px !important;
  border: 0 !important;
  padding: 0 !important;
  cursor: pointer;
  background: rgba(255,255,255,.14) !important;
  flex: none;
  transition: background .15s ease;
  overflow: visible !important;
  -webkit-appearance: none;
  appearance: none;
}
.beam-auto-switch.is-on {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 60%, #0f766e) !important;
}
.beam-auto-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.25);
  transition: transform .15s ease;
  pointer-events: none;
}
.beam-auto-switch.is-on .beam-auto-switch-knob {
  transform: translateX(16px);
}
.beam-auto-active-note {
  padding: 4px 8px 8px;
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-tertiary, #8faba5);
}
.beam-mini-ring {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex: none;
}
.beam-auto-dim {
  opacity: .45;
  pointer-events: none;
}
`;

function patchCss(file) {
  patchFile(file, (s) => {
    if (s.includes("BEAM Auto model picker")) {
      return s.replace(
        /\/\* ===== BEAM Auto model picker ===== \*\/[\s\S]*?(?=\/\* =====|$)/,
        CSS_BLOCK.trim() + "\n\n",
      );
    }
    return s.trimEnd() + "\n\n" + CSS_BLOCK.trim() + "\n";
  });
}

function cacheBust(file) {
  patchFile(file, (s) => {
    const stamp = String(Date.now());
    if (s.includes("beamAutoCache=")) {
      return s.replace(/beamAutoCache=\d+/g, `beamAutoCache=${stamp}`);
    }
    // bump common asset query if present
    let out = s;
    out = out.replace(/(beam-override\.css)(\?v=\d+)?/g, `$1?v=${stamp}&beamAutoCache=${stamp}`);
    if (!out.includes("beamAutoCache=")) {
      out = out.replace("</head>", `<meta name="beam-auto-model" content="${stamp}" />\n</head>`);
    }
    return out;
  });
}

/** Pre-send routing hook in web injector: when Auto, set model via bridge preference flag */
function patchHtml(file) {
  patchFile(file, (s) => {
    if (s.includes("beam-auto-presend-hook")) return s;
    const hook = `
<script>
/* beam-auto-presend-hook */
(function () {
  try {
    if (!localStorage.getItem("beam.modelPrefs")) {
      localStorage.setItem("beam.modelPrefs", JSON.stringify({ auto: true, lastManual: "tide" }));
    }
  } catch {}
  const sync = () => {
    fetch("http://127.0.0.1:17865/assistix/model-prefs").then((r) => r.json()).then((j) => {
      if (!j || typeof j.auto !== "boolean") return;
      try { localStorage.setItem("beam.modelPrefs", JSON.stringify(j)); } catch {}
      window.__beamModelPrefs = j;
      window.dispatchEvent(new CustomEvent("beam:model-prefs", { detail: j }));
    }).catch(() => {});
  };
  sync();
  setInterval(sync, 60000);
})();
</script>
`;
    if (s.includes("</body>")) return s.replace("</body>", hook + "</body>");
    return s + hook;
  });
}

// ---- run ----
ensurePrefs();
buildBridge();
for (const f of modelSelectionFiles()) patchModelSelection(f);
for (const f of webCssFiles()) patchCss(f);
for (const f of webHtmlFiles()) {
  patchHtml(f);
  cacheBust(f);
}

// Locale json if present
for (const app of appRoots()) {
  for (const base of ["beam", "dsh"]) {
    for (const ns of [
      "@assistix/beam-client-ui-model-selection",
      "@deepseek-ai/dsh-client-ui-model-selection",
    ]) {
      for (const loc of ["en.json", "zh.json"]) {
        const f = path.join(app, base, "node_modules", ns, "locale", loc);
        if (!fs.existsSync(f)) continue;
        patchFile(f, (s) =>
          s
            .replaceAll('"Select model"', '"Auto"')
            .replaceAll('"请选择模型"', '"Auto"')
            .replaceAll('"Выбрать модель"', '"Auto"'),
        );
      }
    }
  }
}

console.log("patch-auto-model:");
for (const f of report) console.log(" -", f);
console.log(`done (${report.length} files)`);
console.log("prefs:", PREFS);
console.log("relaunch: quit Beam Agent, start dist/Beam-Agent/Beam Agent.exe (bridge :17865)");
