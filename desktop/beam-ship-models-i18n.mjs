/**
 * Ship Tide/Flare/Pine + dual RU/EN dictionaries for @assistix/beam-* trees.
 * No mixed strings; locale preference ru; early bootstrap; bridge catalog always open.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const MODEL_SELECTION_RU = {
  "provider.account": "ASSISTIX ID",
  "command.label": "Модель",
  "command.description": "Выберите модель для этого разговора",
  "option.loadError": "Не удалось загрузить каталог: {message}",
  "trigger.fallback": "Выбрать модель",
  "trigger.loading": "Загрузка моделей…",
  "trigger.selectAria": "Выбрать модель",
  "trigger.aria": "Выбрать модель, сейчас {model}",
  "trigger.ariaEffort": "Выбрать модель, сейчас {model}, усилие рассуждения {effort}",
  "menu.aria": "Модель и усилие рассуждения",
  "menu.model": "Модель",
  "menu.effort": "Усилие",
  "effort.providerDefault": "По умолчанию",
  "status.loading": "Обновление списка моделей…",
  "error.action": "Ошибка операции с моделью: {message}",
  "error.sessionInUse":
    "Эта сессия уже используется другим экземпляром Beam Agent. Закройте другие окна и попробуйте снова.",
  "action.reload": "Обновить",
  "warning.groupLoad": "{name}: не удалось загрузить — {message}",
  "search.placeholder": "Поиск моделей…",
  "search.clear": "Очистить поиск",
  "search.empty": "Нет подходящих моделей.",
  "empty.models": "Нет доступных моделей.",
  "empty.efforts": "У этой модели нет уровней рассуждения.",
};

const MODEL_SELECTION_EN = {
  "provider.account": "ASSISTIX ID",
  "command.label": "Model",
  "command.description": "Select the model for this conversation",
  "option.loadError": "Catalog failed to load: {message}",
  "trigger.fallback": "Select model",
  "trigger.loading": "Loading models…",
  "trigger.selectAria": "Select model",
  "trigger.aria": "Select model, current {model}",
  "trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
  "menu.aria": "Model and reasoning effort",
  "menu.model": "Model",
  "menu.effort": "Effort",
  "effort.providerDefault": "Default",
  "status.loading": "Refreshing model list…",
  "error.action": "Model operation failed: {message}",
  "error.sessionInUse":
    "This session is already in use by another Beam Agent instance. Quit other windows and try again.",
  "action.reload": "Reload",
  "warning.groupLoad": "{name} failed to load: {message}",
  "search.placeholder": "Search models…",
  "search.clear": "Clear search",
  "search.empty": "No matching models.",
  "empty.models": "No models available.",
  "empty.efforts": "This model provides no reasoning effort levels.",
};

/** Extra RU chrome fixes for mixed leftovers across client packs */
const MIXED_FIXES = [
  ['"Нет models available."', '"Нет доступных моделей."'],
  ['"Нет matching models."', '"Нет подходящих моделей."'],
  ['"Поиск models…"', '"Поиск моделей…"'],
  ['"Поиск models..."', '"Поиск моделей…"'],
  ['"Очистить search"', '"Очистить поиск"'],
  ['"models will be shown"', '"модели не будут показаны"'],
  [
    '"Нет models will be shown in the selector. Unlisted IDs can still be sent directly."',
    '"В селекторе модели не будут показаны. Неперечисленные ID всё ещё можно отправить напрямую."',
  ],
  ['"Loading models…"', '"Загрузка моделей…"'],
  ['"Refreshing model list…"', '"Обновление списка моделей…"'],
  ['"Clear search"', '"Очистить поиск"'],
  ['"No models available."', '"Нет доступных моделей."'],
  ['"No matching models."', '"Нет подходящих моделей."'],
  ['"Search models…"', '"Поиск моделей…"'],
  ['"Select model"', '"Выбрать модель"'],
  ['"Reload"', '"Обновить"'],
  ['"Language"', '"Язык"'],
  ['"Settings"', '"Настройки"'],
  ['"General"', '"Общие"'],
  ['"Plugins"', '"Плагины"'],
  ['"More"', '"Ещё"'],
  ['"Workspace"', '"Рабочая область"'],
  ['"Chat"', '"Чат"'],
  ['"Process"', '"Процесс"'],
  ['"Trajectory"', '"Процесс"'],
  ['"Standard mode"', '"Стандартный режим"'],
  ['"New session"', '"Новая сессия"'],
  ['"New Session"', '"Новая сессия"'],
  ['"Automation tasks"', '"Задачи автоматизации"'],
  ['"Thinking"', '"Думаю"'],
  ['"Deep diving"', '"Думаю"'],
];

function replaceDictBlock(src, varName, dict) {
  const mark = `const ${varName} = {`;
  const start = src.indexOf(mark);
  if (start < 0) return { src, changed: false };
  let i = start + mark.length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const body =
    "{\n" +
    Object.entries(dict)
      .map(([k, v]) => `\t\t\t"${k}": ${JSON.stringify(v)}`)
      .join(",\n") +
    "\n\t\t}";
  const next = src.slice(0, start) + `const ${varName} = ` + body + src.slice(i);
  return { src: next, changed: next !== src };
}

function patchModelSelection(file) {
  let s = fs.readFileSync(file, "utf8");
  let changed = false;
  // Ensure beam-ru region exists; if not, insert after en dict
  if (!s.includes("// #region beam-ru")) {
    const enEnd = s.indexOf('const en = {');
    if (enEnd >= 0) {
      // find end of en
      let i = s.indexOf("{", enEnd);
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      const insert =
        "\n\t\t// #region beam-ru\n\t\tconst ru = " +
        JSON.stringify(MODEL_SELECTION_RU, null, "\t\t\t").replace(/^\t\t\t\{/, "{").replace(/\n\t\t\t/g, "\n\t\t\t") +
        ";\n\t\t// #endregion beam-ru";
      // simpler insert
      const ruLiteral =
        `\n\t\t// #region beam-ru\n\t\tconst ru = {\n` +
        Object.entries(MODEL_SELECTION_RU)
          .map(([k, v]) => `\t\t\t"${k}": ${JSON.stringify(v)}`)
          .join(",\n") +
        `\n\t\t};\n\t\t// #endregion beam-ru`;
      s = s.slice(0, i) + ruLiteral + s.slice(i);
      changed = true;
    }
  }
  {
    const r = replaceDictBlock(s, "en", MODEL_SELECTION_EN);
    s = r.src;
    changed = changed || r.changed;
  }
  {
    const r = replaceDictBlock(s, "ru", MODEL_SELECTION_RU);
    s = r.src;
    changed = changed || r.changed;
  }
  // Wire locale picker: ensure ru is registered if there's a dict map
  if (s.includes("zh,") && s.includes("en,") && !s.includes("ru,") && s.includes("dictionaries")) {
    s = s.replace(/dictionaries:\s*\{\s*zh,\s*en\s*\}/, "dictionaries: { zh, en, ru }");
    s = s.replace(/dictionaries:\s*\{\s*en,\s*zh\s*\}/, "dictionaries: { en, zh, ru }");
    changed = true;
  }
  // Common pattern: locale.of({ en, zh })
  if (s.includes("en, zh") && !s.includes("en, zh, ru") && !s.includes("ru, en, zh")) {
    s = s.replace(/\{\s*en,\s*zh\s*\}/g, "{ en, zh, ru }");
    s = s.replace(/\{\s*zh,\s*en\s*\}/g, "{ zh, en, ru }");
    changed = true;
  }
  if (changed) fs.writeFileSync(file, s);
  return changed;
}

function scrubMixedInRuRegions(file) {
  let s = fs.readFileSync(file, "utf8");
  let changed = false;
  // Only apply MIXED_FIXES inside beam-ru regions when present; else whole file for settings-models
  const apply = (chunk) => {
    let c = chunk;
    for (const [a, b] of MIXED_FIXES) {
      if (c.includes(a)) {
        c = c.split(a).join(b);
        changed = true;
      }
    }
    return c;
  };
  if (s.includes("// #region beam-ru")) {
    s = s.replace(/\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru;?/g, (m) => apply(m));
  } else if (s.includes('const ru = {') || s.includes('"modelsEmpty"')) {
    // settings packs often have "ru" object
    s = apply(s);
  }
  if (changed) fs.writeFileSync(file, s);
  return changed;
}

function patchAccountDiscover(file) {
  let s = fs.readFileSync(file, "utf8");
  const bad = `discoverModels: async (provider) => {
			const view = await catalog.view(settings().catalog);
			return view.authenticated ? discovered(view).catalog.offered.map((model) => catalogModelInfo(provider, model)) : [];
		}`;
  const good = `discoverModels: async (provider) => {
			/* Beam Agent: never return empty — Tide/Flare/Pine from listing or built-in catalog. */
			const fallback = () => {
				try {
					return resolveAdapterOptions({}).models.map((model) => catalogModelInfo(provider, model));
				} catch {
					return ["tide", "flare", "pine"].map((id, i) => catalogModelInfo(provider, {
						id,
						name: id === "tide" ? "Tide" : id === "flare" ? "Flare" : "Pine",
						contextWindow: id === "pine" ? 16384 : 1048576,
						inputModalities: id === "pine" ? ["text"] : ["text", "image"],
						systemPromptUpdate: "in-history",
						toolUpdate: "addition-only",
					}));
				}
			};
			try {
				const view = await catalog.view(settings().catalog);
				if (view.authenticated) {
					const offered = discovered(view).catalog.offered;
					if (offered?.length) return offered.map((model) => catalogModelInfo(provider, model));
				}
			} catch {}
			return fallback();
		}`;
  if (s.includes("Beam Agent: never return empty")) return false;
  if (!s.includes(bad)) {
    // looser
    const re =
      /discoverModels:\s*async\s*\(provider\)\s*=>\s*\{\s*const view = await catalog\.view\(settings\(\)\.catalog\);\s*return view\.authenticated \? discovered\(view\)\.catalog\.offered\.map\(\(model\) => catalogModelInfo\(provider, model\)\) : \[\];\s*\}/;
    if (!re.test(s)) {
      console.warn("account discoverModels pattern miss", file);
      return false;
    }
    s = s.replace(re, good.trim());
  } else {
    s = s.split(bad).join(good);
  }
  fs.writeFileSync(file, s);
  return true;
}

function patchApiKeyDiscover(file) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("Beam Agent: Tide/Flare/Pine always")) return false;
  const needle = `discoverModels: async (provider) => {
			const connection = options();
			if (connection.listing === void 0) {
				if (await presentApiKey(connection) === void 0) return [];
				return connection.models.map((model) => catalogModelInfo(provider, model));
			}
			const view = await listings.view(connection.listing);
			return view.authenticated ? connectionOf(connection, view).offered.map((model) => catalogModelInfo(provider, model)) : [];
		}`;
  const repl = `discoverModels: async (provider) => {
			const connection = options();
			const local = () => connection.models.map((model) => catalogModelInfo(provider, model));
			/* Beam Agent: Tide/Flare/Pine always from local catalog — never empty on missing key/listing. */
			if (connection.listing === void 0) return local();
			try {
				const view = await listings.view(connection.listing);
				if (view.authenticated) {
					const offered = connectionOf(connection, view).offered;
					if (offered?.length) return offered.map((model) => catalogModelInfo(provider, model));
				}
			} catch {}
			return local();
		}`;
  if (!s.includes(needle)) {
    if (s.includes("Beam Agent: Tide/Flare/Pine always")) return false;
    console.warn("api-key discover already patched or miss", file);
    return false;
  }
  fs.writeFileSync(file, s.split(needle).join(repl));
  return true;
}

function patchIndexHtml(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  let changed = false;
  if (!s.includes("beam-locale-bootstrap")) {
    const boot = `<script id="beam-locale-bootstrap">
(() => {
  try {
    let pref = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      const v = localStorage.getItem(key) || "";
      const m = v.match(/"preference"\\s*:\\s*"(ru|en|zh)"/) || v.match(/preference["']?\\s*:\\s*["'](ru|en|zh)["']/);
      if (m) { pref = m[1]; break; }
    }
    if (!pref) {
      const nav = String(navigator.language || "").toLowerCase();
      pref = nav.startsWith("ru") ? "ru" : nav.startsWith("zh") ? "zh" : (nav.startsWith("en") ? "en" : "ru");
    }
    document.documentElement.lang = pref === "en" ? "en" : pref === "zh" ? "zh-CN" : "ru-RU";
    document.documentElement.dataset.beamLang = pref === "zh" ? "zh" : pref;
  } catch {
    document.documentElement.lang = "ru-RU";
    document.documentElement.dataset.beamLang = "ru";
  }
})();
</script>
`;
    s = s.replace("<head>", "<head>\n" + boot);
    changed = true;
  }
  // Kill partial No→Нет live rewrites that create «Нет models available.»
  if (!s.includes("beam-ban-partial-no")) {
    const guard = `
<script id="beam-ban-partial-no">
/* Prevent half-translated empty-model strings */
(function(){
  const fix = (t) => {
    if (!t) return t;
    if (t === "Нет models available." || t === "No models available.") {
      const lang = document.documentElement.dataset.beamLang || "ru";
      return lang === "en" ? "No models available." : "Нет доступных моделей.";
    }
    if (t === "Нет matching models." || t === "Поиск models…") {
      const lang = document.documentElement.dataset.beamLang || "ru";
      if (t.startsWith("Поиск")) return lang === "en" ? "Search models…" : "Поиск моделей…";
      return lang === "en" ? "No matching models." : "Нет подходящих моделей.";
    }
    return t;
  };
  const run = () => {
    const tw = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let n; while ((n = tw.nextNode())) {
      const next = fix(n.nodeValue);
      if (next !== n.nodeValue) n.nodeValue = next;
    }
  };
  document.addEventListener("DOMContentLoaded", run);
  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
</script>`;
    s = s.replace("</body>", guard + "\n</body>");
    changed = true;
  }
  if (changed) fs.writeFileSync(file, s);
  return changed;
}

function patchBridgeAuth(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const old = `      const state = loadState()
      if (!requireAuth(res, state)) return
      const data = Object.values(MODELS).map((m) => ({`;
  const neu = `      const data = Object.values(MODELS).map((m) => ({`;
  if (!s.includes(old)) return false;
  fs.writeFileSync(file, s.split(old).join(neu));
  return true;
}

function patchCordisLocale(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  if (/id:\s*locale[\s\S]*?preference:\s*ru/.test(s) && !s.includes("preference: en")) {
    // might already be ru
  }
  const next = s.replace(
    /(id:\s*locale\s*\n(?:.*\n)*?\s*preference:\s*)en(\b)/,
    "$1ru$2"
  );
  if (next === s) {
    // try alternate
    const n2 = s.replace(/preference:\s*en(\s*\n)/, "preference: ru$1");
    if (n2 === s) return false;
    fs.writeFileSync(file, n2);
    return true;
  }
  fs.writeFileSync(file, next);
  return true;
}

function hardenStream(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("BEAM_STREAM_FINALLY")) return false;
  const marker = `  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''`;
  if (!s.includes(marker)) return false;
  // Wrap read loop completion with guaranteed message_stop
  const stopBlock = `  if (textStarted) {
    sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  }
  for (const entry of toolBuf.values()) {
    sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: entry.anthropicIndex })
  }

  chargeTokens(state, tier.id, {
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || Math.max(1, [...toolBuf.values()].length),
  })

  sseWrite(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: usage.completion_tokens || 0 },
  })
  sseWrite(res, 'message_stop', { type: 'message_stop' })
  res.end()`;

  // Replace catch that just ends without message_stop
  const badCatch = `  } catch (e) {
    bridgeLog(\`handleMessages_fail \${e?.stack || e}\`)
    if (!res.headersSent) {
      return sendJson(res, 502, {
        type: 'error',
        error: { type: 'api_error', message: e?.message || 'Ошибка bridge. Попробуйте ещё раз.' },
      })
    }
    try { res.end() } catch {}
  }
}`;
  const goodCatch = `  } catch (e) {
    /* BEAM_STREAM_FINALLY */
    bridgeLog(\`handleMessages_fail \${e?.stack || e}\`)
    if (!res.headersSent) {
      return sendJson(res, 502, {
        type: 'error',
        error: { type: 'api_error', message: e?.message || 'Ошибка bridge. Попробуйте ещё раз.' },
      })
    }
    try {
      if (!textStarted && toolBuf.size === 0) {
        sseWrite(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        sseWrite(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Связь с моделью прервалась. Попробуйте ещё раз.' } })
        sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
      } else if (textStarted) {
        try { sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: 0 }) } catch {}
      }
      for (const entry of toolBuf.values()) {
        try { sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: entry.anthropicIndex }) } catch {}
      }
      sseWrite(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } })
      sseWrite(res, 'message_stop', { type: 'message_stop' })
      res.end()
    } catch { try { res.end() } catch {} }
  }
}`;
  if (s.includes(badCatch)) {
    s = s.split(badCatch).join(goodCatch);
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

const summary = {
  trees: [],
  modelSelection: 0,
  mixed: 0,
  account: 0,
  apiKey: 0,
  html: 0,
  bridge: 0,
  stream: 0,
  cordis: 0,
};

for (const tree of TREES) {
  const ai = path.join(tree, "beam", "node_modules", "@assistix");
  const ms = path.join(ai, "beam-client-ui-model-selection", "lib", "client.js");
  if (fs.existsSync(ms) && patchModelSelection(ms)) summary.modelSelection++;

  // scrub all client packs
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === "client.js" && p.includes("beam-client")) {
        if (scrubMixedInRuRegions(p)) summary.mixed++;
      }
    }
  };
  walk(ai);

  const account = path.join(ai, "beam-llm-deepseek-account", "lib", "index.js");
  if (fs.existsSync(account) && patchAccountDiscover(account)) summary.account++;

  const apiKey = path.join(ai, "beam-llm-deepseek-api-key", "lib", "index.js");
  if (fs.existsSync(apiKey) && patchApiKeyDiscover(apiKey)) summary.apiKey++;

  const html = path.join(ai, "beam-web-frontend", "dist", "index.html");
  if (patchIndexHtml(html)) summary.html++;

  summary.trees.push(tree);
}

const bridgeSrc = path.join(ROOT, "desktop", "bridge", "server.js");
if (patchBridgeAuth(bridgeSrc)) summary.bridge++;
if (hardenStream(bridgeSrc)) summary.stream++;

const bridgeDst = path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js");
fs.mkdirSync(path.dirname(bridgeDst), { recursive: true });
fs.copyFileSync(bridgeSrc, bridgeDst);
summary.bridgeSync = true;
if (patchBridgeAuth(bridgeDst)) summary.bridge++;
if (hardenStream(bridgeDst)) summary.stream++;

const cordisPaths = [
  path.join(process.env.USERPROFILE || "", ".beam", "profiles", "desktop", "cordis.patch.yml"),
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-base", "cordis.patch.yml"),
];
for (const c of cordisPaths) {
  if (patchCordisLocale(c)) summary.cordis++;
}

console.log(JSON.stringify(summary, null, 2));
