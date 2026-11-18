/**
 * Beam Agent: restore Tide/Flare/Pine picker + total RU/EN dictionaries (no mix, no flash).
 * Patches runtime + dist trees in place.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const PHRASE_EN_TO_RU = {
  "No models available.": "Нет доступных моделей.",
  "No matching models.": "Нет подходящих моделей.",
  "Search models…": "Поиск моделей…",
  "Search models...": "Поиск моделей…",
  "Clear search": "Очистить поиск",
  "Refreshing model list…": "Обновление списка моделей…",
  "Refreshing model list...": "Обновление списка моделей…",
  "Loading models…": "Загрузка моделей…",
  "Loading models...": "Загрузка моделей…",
  "Select model": "Выбрать модель",
  "Select model, current {model}": "Выбрать модель, сейчас {model}",
  "Select model, current {model}, reasoning effort {effort}":
    "Выбрать модель, сейчас {model}, усилие рассуждения {effort}",
  "Model and reasoning effort": "Модель и усилие рассуждения",
  Model: "Модель",
  Effort: "Усилие",
  Default: "По умолчанию",
  Reload: "Обновить",
  "Catalog failed to load: {message}": "Не удалось загрузить каталог: {message}",
  "Model operation failed: {message}": "Ошибка операции с моделью: {message}",
  "{name} failed to load: {message}": "{name}: не удалось загрузить — {message}",
  "This model provides no reasoning effort levels.": "У этой модели нет уровней рассуждения.",
  "Select the model for this conversation": "Выберите модель для этого разговора",
  Language: "Язык",
  Settings: "Настройки",
  General: "Общие",
  Plugins: "Плагины",
  More: "Ещё",
  Workspace: "Рабочая область",
  Chat: "Чат",
  Process: "Процесс",
  Trajectory: "Процесс",
  "Standard mode": "Стандартный режим",
  "New session": "Новая сессия",
  "New Session": "Новая сессия",
  Limits: "Лимиты",
  Models: "Модели",
  "Weekly limits": "Лимиты недели",
  Guest: "Гость",
  "Sign in": "Войти",
  "Sign out": "Выйти",
  Refresh: "Обновить",
  Cancel: "Отмена",
  Save: "Сохранить",
  Close: "Закрыть",
  Confirm: "Подтвердить",
  Delete: "Удалить",
  Edit: "Изменить",
  Copy: "Копировать",
  Share: "Поделиться",
  Search: "Поиск",
  Loading: "Загрузка",
  Error: "Ошибка",
  Retry: "Повторить",
  Continue: "Продолжить",
  Back: "Назад",
  Next: "Далее",
  Done: "Готово",
  Yes: "Да",
  No: "Нет",
  On: "Вкл",
  Off: "Выкл",
  Enabled: "Включено",
  Disabled: "Выключено",
  Unknown: "Неизвестно",
  Optional: "Необязательно",
  Required: "Обязательно",
  Name: "Имя",
  Email: "Email",
  Password: "Пароль",
  Account: "Аккаунт",
  Profile: "Профиль",
  About: "О программе",
  Help: "Справка",
  Documentation: "Документация",
  Feedback: "Обратная связь",
  Updates: "Обновления",
  Version: "Версия",
  "Open configuration file": "Открыть файл конфигурации",
  "Message or run a task, / commands, @ files or sessions":
    "Сообщение или задача, / команды, @ файлы или сессии",
  "Automation tasks": "Задачи автоматизации",
  "Workspace Write": "Запись в рабочую область",
  "Build with Beam": "Собрано в Beam",
  Thinking: "Думаю",
  "Deep diving": "Думаю",
  Preview: "Превью",
};

/** English restorations when `en` was wrongly Cyrillic-patched. */
const RU_OR_MIXED_TO_EN = {
  "Выбрать модель": "Select model",
  "Выбрать модель, сейчас {model}": "Select model, current {model}",
  "Выбрать модель, сейчас {model}, усилие рассуждения {effort}":
    "Select model, current {model}, reasoning effort {effort}",
  "Нет models available.": "No models available.",
  "Нет доступных моделей.": "No models available.",
  "Нет matching models.": "No matching models.",
  "Нет подходящих моделей.": "No matching models.",
  "Поиск models…": "Search models…",
  "Поиск моделей…": "Search models…",
  "Очистить search": "Clear search",
  "Очистить поиск": "Clear search",
  "Обновитьing model list…": "Refreshing model list…",
  "Обновление списка моделей…": "Refreshing model list…",
  "Загрузка моделей…": "Loading models…",
  Язык: "Language",
  Настройки: "Settings",
  Общие: "General",
  Плагины: "Plugins",
  Ещё: "More",
  "Рабочая область": "Workspace",
  Чат: "Chat",
  Процесс: "Process",
  Траектория: "Process",
  "Стандартный режим": "Standard mode",
  "Новая сессия": "New session",
  Лимиты: "Limits",
  Модели: "Models",
  "Собрано в Beam": "Build with Beam",
  Думаю: "Thinking",
};

const KEEP_LATIN = /^(ASSISTIX|Beam Agent|Tide|Flare|Pine|OK|ID|URL|API|HTTP|JSON|SSE|CTA)$/i;

function hasCyr(s) {
  return /[А-Яа-яЁё]/.test(s);
}
function hasLatinWord(s) {
  return /\b[A-Za-z]{3,}\b/.test(s);
}
function isMixed(s) {
  return hasCyr(s) && hasLatinWord(s) && !KEEP_LATIN.test(s.trim());
}

function restoreEn(value) {
  if (typeof value !== "string") return value;
  if (!hasCyr(value)) return value;
  if (RU_OR_MIXED_TO_EN[value]) return RU_OR_MIXED_TO_EN[value];
  // Drop accidental Cyrillic-only patches: leave placeholders if unknown
  for (const [ru, en] of Object.entries(RU_OR_MIXED_TO_EN)) {
    if (value.includes(ru)) value = value.split(ru).join(en);
  }
  // If still mostly Cyrillic with no mapping, keep as-is only if no English key expected —
  // better to strip known RU chrome words back
  if (hasCyr(value) && PHRASE_EN_TO_RU[value] === undefined) {
    // reverse lookup
    for (const [en, ru] of Object.entries(PHRASE_EN_TO_RU)) {
      if (value === ru) return en;
    }
  }
  return value;
}

function toRu(enValue) {
  if (typeof enValue !== "string") return enValue;
  if (KEEP_LATIN.test(enValue.trim())) return enValue;
  if (PHRASE_EN_TO_RU[enValue]) return PHRASE_EN_TO_RU[enValue];
  // already good Russian and not mixed
  if (hasCyr(enValue) && !isMixed(enValue)) return enValue;
  // light phrase heuristics
  let s = enValue;
  const reps = [
    [/^No /i, "Нет "],
    [/\bmodels available\b/gi, "доступных моделей"],
    [/\bmatching models\b/gi, "подходящих моделей"],
    [/\bSearch models\b/gi, "Поиск моделей"],
    [/\bClear search\b/gi, "Очистить поиск"],
    [/\bLoading models\b/gi, "Загрузка моделей"],
    [/\bRefreshing model list\b/gi, "Обновление списка моделей"],
    [/\bSelect model\b/gi, "Выбрать модель"],
    [/\bcurrent\b/gi, "сейчас"],
    [/\breasoning effort\b/gi, "усилие рассуждения"],
    [/\bfailed to load\b/gi, "не удалось загрузить"],
    [/\bReload\b/g, "Обновить"],
    [/\bLanguage\b/g, "Язык"],
    [/\bSettings\b/g, "Настройки"],
    [/\bWorkspace\b/g, "Рабочая область"],
    [/\bPlugins\b/g, "Плагины"],
    [/\bProcess\b/g, "Процесс"],
    [/\bTrajectory\b/g, "Процесс"],
    [/\bStandard mode\b/gi, "Стандартный режим"],
    [/\bNew session\b/gi, "Новая сессия"],
    [/\bAutomation tasks\b/gi, "Задачи автоматизации"],
  ];
  for (const [a, b] of reps) s = s.replace(a, b);
  return s;
}

function patchObjectLiteral(src, varName, transform) {
  const re = new RegExp(`const ${varName} = \\{`);
  const m = re.exec(src);
  if (!m) return { src, changed: false };
  const start = m.index + m[0].length - 1; // at {
  let i = start;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const block = src.slice(start, i);
  // Replace string values "key": "value" carefully
  let changed = false;
  const next = block.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
    (all, k, v) => {
      const quote = v[0];
      const raw = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, "\n");
      const out = transform(raw);
      if (out === raw) return all;
      changed = true;
      const esc = String(out)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n");
      return `${k}: ${quote === "'" ? "'" : '"'}${esc}${quote === "'" ? "'" : '"'}`;
    }
  );
  if (!changed) return { src, changed: false };
  return { src: src.slice(0, start) + next + src.slice(i), changed: true };
}

function fixLocaleFile(file) {
  let s = fs.readFileSync(file, "utf8");
  let changed = false;

  // Fix en: remove Cyrillic leaks
  {
    const r = patchObjectLiteral(s, "en", restoreEn);
    s = r.src;
    changed = changed || r.changed;
  }
  // Fix ru: proper Russian from en values where mixed/bad
  {
    const r = patchObjectLiteral(s, "ru", (val) => {
      if (!isMixed(val) && hasCyr(val)) return val;
      // Prefer translating known English; if val is mixed, restore to en first
      const en = restoreEn(val);
      return toRu(en);
    });
    s = r.src;
    changed = changed || r.changed;
  }

  // Explicit model-selection keys (authoritative)
  if (file.includes("dsh-client-ui-model-selection")) {
    const enFix = {
      '"trigger.fallback": "Выбрать модель"': '"trigger.fallback": "Select model"',
      '"trigger.selectAria": "Выбрать модель"': '"trigger.selectAria": "Select model"',
      '"trigger.aria": "Выбрать модель, сейчас {model}"':
        '"trigger.aria": "Select model, current {model}"',
      '"trigger.ariaEffort": "Выбрать модель, сейчас {model}, усилие рассуждения {effort}"':
        '"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}"',
    };
    const ruFix = {
      '"empty.models": "Нет models available."': '"empty.models": "Нет доступных моделей."',
      '"empty.models": "No models available."': '"empty.models": "Нет доступных моделей."',
      '"search.empty": "Нет matching models."': '"search.empty": "Нет подходящих моделей."',
      '"search.placeholder": "Поиск models…"': '"search.placeholder": "Поиск моделей…"',
      '"search.clear": "Очистить search"': '"search.clear": "Очистить поиск"',
      '"status.loading": "Обновитьing model list…"':
        '"status.loading": "Обновление списка моделей…"',
      '"trigger.loading": "Loading models…"': '"trigger.loading": "Загрузка моделей…"',
      '"command.label": "Model"': '"command.label": "Модель"',
      '"command.description": "Select the model for this conversation"':
        '"command.description": "Выберите модель для этого разговора"',
      '"option.loadError": "Catalog failed to load: {message}"':
        '"option.loadError": "Не удалось загрузить каталог: {message}"',
      '"menu.aria": "Model and reasoning effort"':
        '"menu.aria": "Модель и усилие рассуждения"',
      '"menu.model": "Model"': '"menu.model": "Модель"',
      '"menu.effort": "Effort"': '"menu.effort": "Усилие"',
      '"effort.providerDefault": "Default"': '"effort.providerDefault": "По умолчанию"',
      '"error.action": "Model operation failed: {message}"':
        '"error.action": "Ошибка операции с моделью: {message}"',
      '"action.reload": "Reload"': '"action.reload": "Обновить"',
      '"warning.groupLoad": "{name} failed to load: {message}"':
        '"warning.groupLoad": "{name}: не удалось загрузить — {message}"',
      '"empty.efforts": "This model provides no reasoning effort levels."':
        '"empty.efforts": "У этой модели нет уровней рассуждения."',
      '"trigger.fallback": "Select model"': '"trigger.fallback": "Выбрать модель"',
      '"trigger.selectAria": "Select model"': '"trigger.selectAria": "Выбрать модель"',
      '"trigger.aria": "Select model, current {model}"':
        '"trigger.aria": "Выбрать модель, сейчас {model}"',
      '"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}"':
        '"trigger.ariaEffort": "Выбрать модель, сейчас {model}, усилие рассуждения {effort}"',
    };
    // Apply enFix only inside first const en = { ... } roughly by sequential replace carefully:
    // Split by beam-ru region
    const ruMark = "// #region beam-ru";
    const idx = s.indexOf(ruMark);
    if (idx > 0) {
      let head = s.slice(0, idx);
      let tail = s.slice(idx);
      for (const [a, b] of Object.entries(enFix)) {
        if (head.includes(a)) {
          head = head.split(a).join(b);
          changed = true;
        }
      }
      for (const [a, b] of Object.entries(ruFix)) {
        if (tail.includes(a)) {
          tail = tail.split(a).join(b);
          changed = true;
        }
      }
      // Also ensure ru has correct empty.models even if pattern differed
      tail = tail.replace(
        /"empty\.models":\s*"[^"]*"/,
        '"empty.models": "Нет доступных моделей."'
      );
      s = head + tail;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(file, s);
  return changed;
}

function patchDiscoverModels(file) {
  let s = fs.readFileSync(file, "utf8");
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
  if (!s.includes("Beam Agent: Tide/Flare/Pine always")) {
    if (!s.includes(needle)) {
      console.warn("discoverModels pattern miss", file);
      return false;
    }
    s = s.split(needle).join(repl);
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function patchModelDescriptions(file) {
  let s = fs.readFileSync(file, "utf8");
  const pairs = [
    [
      'description: "DeepSeek V4 Flash — быстрая модель Assistix (1M токенов)"',
      'description: "Tide — быстрый экономный режим Beam Agent"',
    ],
    [
      'description: "Gemini 3.8 Flash — сбалансированная модель Assistix (500K токенов)"',
      'description: "Flare — сбалансированный режим Beam Agent"',
    ],
    [
      'description: "Grok 4.7 — сильный режим Assistix (10K токенов)"',
      'description: "Pine — максимальный режим Beam Agent"',
    ],
  ];
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n++;
    }
  }
  if (n) fs.writeFileSync(file, s);
  return n > 0;
}

function patchResolveDesktopLocale(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const broken = `function resolveDesktopLocale(locale) {
	return locale.toLowerCase().startsWith("zh") ? {
		id: "zh-CN",
		messages: zh
	} : {
		id: "en",
		messages: primary === "ru" ? ru : en
	};
}`;
  const fixed = `function resolveDesktopLocale(locale) {
	const primary = String(locale || "en").toLowerCase().split(/[-_]/)[0];
	if (primary === "ru") return { id: "ru", messages: ru };
	if (primary === "zh") return { id: "zh-CN", messages: zh };
	return { id: "en", messages: en };
}`;
  if (s.includes(broken)) {
    s = s.split(broken).join(fixed);
    // Also fix startup locale to honor ru preference
    s = s.replace(
      `function resolveDesktopStartupLocale(preference, languages) {
	const selected = preference?.toLowerCase();
	if (selected === "zh" || selected === "en") return resolveDesktopLocale(selected);
	for (const language of languages) {
		const primary = language.toLowerCase().split("-")[0];
		if (primary === "zh" || primary === "en") return resolveDesktopLocale(primary);
	}
	return resolveDesktopLocale("ru");
}`,
      `function resolveDesktopStartupLocale(preference, languages) {
	const selected = preference?.toLowerCase();
	if (selected === "zh" || selected === "en" || selected === "ru") return resolveDesktopLocale(selected);
	for (const language of languages) {
		const primary = language.toLowerCase().split(/[-_]/)[0];
		if (primary === "zh" || primary === "en" || primary === "ru") return resolveDesktopLocale(primary);
	}
	return resolveDesktopLocale("ru");
}`
    );
    fs.writeFileSync(file, s);
    return true;
  }
  // Already partially fixed?
  if (!s.includes("messages: primary === \"ru\" ? ru : en") && s.includes('primary === "ru" ? "ru"')) {
    return false;
  }
  if (s.includes("messages: primary === \"ru\" ? ru : en")) {
    s = s.replace(
      /function resolveDesktopLocale\(locale\) \{[\s\S]*?\n\}/,
      fixed
    );
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function patchIndexHtml(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  let changed = false;

  // Early locale bootstrap before modules — flash-free
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

  // Fix isRu to respect EN (no force-RU)
  const badIsRu = `  const isRu = () => {
    try {
      const lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("ru")) return true;
      if (lang.startsWith("en") || lang.startsWith("zh")) {
        /* still prefer RU chrome for Beam Agent product */
      }
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        if (/preference["']?\\s*:\\s*["']ru["']/.test(v)) return true;
        if (/preference["']?\\s*:\\s*["']en["']/.test(v)) return true; /* continue — Beam RU scrub still applies */
      }
    } catch {}
    return true; /* Beam Agent ships RU-first */
  };`;

  const goodIsRu = `  const beamLang = () => {
    try {
      const ds = document.documentElement.dataset.beamLang;
      if (ds === "en" || ds === "ru" || ds === "zh") return ds;
      const lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("en")) return "en";
      if (lang.startsWith("zh")) return "zh";
      if (lang.startsWith("ru")) return "ru";
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        const m = v.match(/preference["']?\\s*:\\s*["'](ru|en|zh)["']/);
        if (m) return m[1];
      }
    } catch {}
    return "ru";
  };
  const isRu = () => beamLang() === "ru";
  const isEn = () => beamLang() === "en";`;

  if (s.includes(badIsRu)) {
    s = s.split(badIsRu).join(goodIsRu);
    changed = true;
  } else if (!s.includes("const beamLang = ()")) {
    // try looser replace
    s = s.replace(
      /const isRu = \(\) => \{[\s\S]*?return true; \/\* Beam Agent ships RU-first \*\/\n  \};/,
      goodIsRu.trim().replace(/^\s+/gm, (m) => m) && goodIsRu
    );
    if (s.includes("const beamLang = ()")) changed = true;
  }

  // Only run chrome EN→RU rewrite when Russian is active
  if (s.includes("const pairs = chromePairs;") && !s.includes("const pairs = isRu() ? chromePairs : brandOnlyPairs;")) {
    s = s.replace(
      "const pairs = chromePairs;",
      `const brandOnlyPairs = chromePairs.filter((p) => /DeepSeek|Harness|LlmError|SERVER|EMPTY_RESPONSE|RATE_LIMIT|TIMEOUT|TRANSPORT|fetch failed/i.test(String(p[0])));
    const pairs = isRu() ? chromePairs : brandOnlyPairs;`
    );
    changed = true;
  }

  // Don't force hero / placeholder to RU when EN
  if (s.includes('el.textContent = "Собрано в Beam";') && !s.includes("if (isRu()) el.textContent = \"Собрано в Beam\"")) {
    s = s.replace(
      /if \(t === "Build with Beam" \|\| t === "Into the Unknown" \|\| t === "探索未至之境"\) el\.textContent = "Собрано в Beam";/g,
      'if (t === "Build with Beam" || t === "Into the Unknown" || t === "探索未至之境") el.textContent = isRu() ? "Собрано в Beam" : "Build with Beam";'
    );
    s = s.replace(
      'el.setAttribute("placeholder", "Сообщение или задача, / команды, @ файлы или сессии");',
      'el.setAttribute("placeholder", isRu() ? "Сообщение или задача, / команды, @ файлы или сессии" : "Message or task, / commands, @ files or sessions");'
    );
    changed = true;
  }

  if (changed) fs.writeFileSync(file, s);
  return changed;
}

function patchBridgeModelsAuth(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  // Allow unauthenticated model catalog so picker never goes empty
  const old = `      const state = loadState()
      if (!requireAuth(res, state)) return
      const data = Object.values(MODELS).map((m) => ({`;
  const neu = `      const data = Object.values(MODELS).map((m) => ({`;
  if (s.includes(old)) {
    s = s.split(old).join(neu);
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function syncBridge() {
  const src = path.join(ROOT, "desktop", "bridge", "server.js");
  const dst = path.join(ROOT, "dist", "Beam Agent", "bridge", "server.js");
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dst))) {
    fs.copyFileSync(src, dst);
    return true;
  }
  return false;
}

let summary = { trees: [], localeFiles: 0, discover: 0, desc: 0, localeMain: 0, html: 0, bridgeAuth: 0 };

for (const tree of TREES) {
  const ai = path.join(tree, "dsh", "node_modules", "@deepseek-ai");
  const clients = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === "client.js" && p.includes("dsh-client")) clients.push(p);
    }
  }
  walk(ai);

  let loc = 0;
  for (const f of clients) {
    if (fixLocaleFile(f)) loc++;
  }
  summary.localeFiles += loc;

  const apiKey = path.join(ai, "dsh-llm-deepseek-api-key", "lib", "index.js");
  if (fs.existsSync(apiKey) && patchDiscoverModels(apiKey)) summary.discover++;

  const llm = path.join(ai, "dsh-llm-deepseek", "lib", "index.js");
  if (fs.existsSync(llm) && patchModelDescriptions(llm)) summary.desc++;

  const mainJs = path.join(tree, "lib", "main.js");
  if (patchResolveDesktopLocale(mainJs)) summary.localeMain++;

  const indexHtml = path.join(ai, "dsh-web-frontend", "dist", "index.html");
  if (patchIndexHtml(indexHtml)) summary.html++;

  summary.trees.push(tree);
}

const bridgeDesktop = path.join(ROOT, "desktop", "bridge", "server.js");
if (patchBridgeModelsAuth(bridgeDesktop)) summary.bridgeAuth++;
if (syncBridge()) summary.bridgeSync = true;

// Also patch dist bridge auth if copy didn't include it yet
const bridgeDist = path.join(ROOT, "dist", "Beam Agent", "bridge", "server.js");
if (patchBridgeModelsAuth(bridgeDist)) summary.bridgeAuth++;

console.log(JSON.stringify(summary, null, 2));
