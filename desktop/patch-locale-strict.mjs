/**
 * Beam Agent — hard EN/RU locale isolation.
 *
 * Rules:
 * - English is the base/source of truth.
 * - When locale is en → never inject Russian (auth gate, chrome scrub, bridge errors).
 * - When locale is ru → use RU catalogs only (no EN chrome leftovers where catalogs cover).
 * - Preference: Host settings locale.preference in ~/.beam/profiles/.../cordis.patch.yml
 *   (also mirrored via __DSH_LOCALE__ and document.documentElement.lang / dataset.beamLang).
 *
 * Re-run anytime: node desktop/patch-locale-strict.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE = `strictloc${Date.now().toString(36)}`;

const APP_TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const BRIDGE_FILES = [
  path.join(ROOT, "desktop", "bridge", "server.js"),
  path.join(ROOT, "dist", "Beam Agent", "bridge", "server.js"),
].filter((p) => fs.existsSync(p));

const PHRASES = [
  ["Open configuration file", "Открыть файл конфигурации"],
  ["Could not open configuration file", "Не удалось открыть файл конфигурации"],
  ["Built-in plugins", "Встроенные плагины"],
  ["Agent presets", "Пресеты агента"],
  ["Sign in with ASSISTIX ID to use Tide, Flare and Pine", "Войдите через ASSISTIX ID, чтобы использовать Tide, Flare и Pine"],
  ["Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed.", "Модели Beam Agent — Tide, Flare и Pine. Доступ через ASSISTIX ID, ключи API не нужны."],
  ["Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys.", "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."],
  ["Connected via ASSISTIX", "Подключено через ASSISTIX"],
  ["Sign in with ASSISTIX ID", "Войти через ASSISTIX ID"],
  ["Could not save. Please try again.", "Не удалось сохранить. Попробуйте ещё раз."],
  ["Checking for updates…", "Проверка обновлений…"],
  ["Install and Restart", "Установить и перезапустить"],
  ["Retry update", "Повторить обновление"],
  ["Show coding view", "Показать вид кодирования"],
  ["Shows trajectory, code diffs, and all Agent presets", "Показывает процесс, диффы кода и все пресеты агента"],
  ["Reload to load the new version", "Перезагрузить, чтобы применить новую версию"],
  ["Service version changed", "Версия сервиса изменилась"],
  ["Add an API key to get started", "Войдите через ASSISTIX ID"],
  ["Enter your API keys to use models from the following providers.", "Лимиты моделей Tide, Flare и Pine."],
  ["Third-party model provider", "Сторонний провайдер"],
  ["Custom model API", "Свой API моделей"],
  ["No models available.", "Нет доступных моделей."],
  ["No matching models.", "Нет подходящих моделей."],
  ["Search models…", "Поиск моделей…"],
  ["Message or task, / commands, @ files or sessions", "Сообщение или задача, / команды, @ файлы или сессии"],
  ["Message or run a task, / commands, @ files or sessions", "Сообщение или задача, / команды, @ файлы или сессии"],
  ["Please try again later", "Попробуйте позже"],
  ["Please try again", "Попробуйте ещё раз"],
  ["Check your connection and try again", "Проверьте соединение и попробуйте снова"],
  ["Could not check for updates", "Не удалось проверить обновления"],
  ["Could not download the update", "Не удалось скачать обновление"],
  ["Could not install the update", "Не удалось установить обновление"],
  ["Downloading update", "Скачивание обновления"],
  ["Target version", "Целевая версия"],
  ["Verifying update files…", "Проверка файлов обновления…"],
  ["Preparing to restart…", "Подготовка к перезапуску…"],
  ["Current version:", "Текущая версия:"],
  ["Restore defaults", "Сбросить по умолчанию"],
  ["Context window", "Контекст"],
  ["Max output tokens", "Макс. токенов ответа"],
  ["Reasoning levels", "Уровни рассуждения"],
  ["Display name", "Отображаемое имя"],
  ["Base URL", "Базовый URL"],
  ["API key", "Ключ API"],
  ["Add model", "Добавить модель"],
  ["Delete model", "Удалить модель"],
  ["New session", "Новая сессия"],
  ["New chat", "Новый чат"],
  ["Signed in", "Вы вошли"],
  ["Sign out", "Выйти"],
  ["Sign in", "Войти"],
  ["Loading…", "Загрузка…"],
  ["Applying…", "Применение…"],
  ["Connected", "Подключено"],
  ["Disconnected", "Отключено"],
  ["Reconnecting", "Переподключение"],
  ["Not now", "Не сейчас"],
  ["Overridden", "Переопределено"],
  ["Enabled", "Включено"],
  ["Disabled", "Выключено"],
  ["Language", "Язык"],
  ["Settings", "Настройки"],
  ["General", "Общие"],
  ["Models", "Лимиты"],
  ["Limits", "Лимиты"],
  ["Plugins", "Плагины"],
  ["Account", "Аккаунт"],
  ["Workspace", "Проект"],
  ["Sessions", "Сессии"],
  ["Terminal", "Терминал"],
  ["Browser", "Браузер"],
  ["Permissions", "Разрешения"],
  ["Shortcuts", "Горячие клавиши"],
  ["Provider", "Провайдер"],
  ["Update", "Обновление"],
  ["Warning", "Предупреждение"],
  ["Error", "Ошибка"],
  ["About", "О программе"],
  ["Theme", "Тема"],
  ["Dark", "Тёмная"],
  ["Light", "Светлая"],
  ["System", "Системная"],
  ["Search", "Поиск"],
  ["Cancel", "Отмена"],
  ["Close", "Закрыть"],
  ["Apply", "Применить"],
  ["Retry", "Повторить"],
  ["Delete", "Удалить"],
  ["Edit", "Изменить"],
  ["Save", "Сохранить"],
  ["Skip", "Пропустить"],
  ["More", "Ещё"],
  ["Back", "Назад"],
  ["Next", "Далее"],
  ["Previous", "Назад"],
  ["Collapse", "Свернуть"],
  ["Expand", "Развернуть"],
  ["Copy", "Копировать"],
  ["Copied", "Скопировано"],
  ["Send", "Отправить"],
  ["Stop", "Стоп"],
  ["Help", "Справка"],
  ["Unknown", "Неизвестно"],
  ["None", "Нет"],
  ["Yes", "Да"],
  ["No", "Нет"],
  ["On", "Вкл"],
  ["Off", "Выкл"],
  ["Chat", "Чат"],
  ["Process", "Процесс"],
  ["Trajectory", "Процесс"],
  ["Plan", "План"],
  ["Goals", "Цели"],
  ["Files", "Файлы"],
  ["Thinking", "Думаю"],
  ["Standard mode", "Стандартный режим"],
  ["Automation tasks", "Задачи автоматизации"],
  ["Select model", "Выбрать модель"],
  ["Project write", "Запись в проект"],
  ["Build with Beam", "Собрано в Beam"],
  ["Into the Unknown", "Собрано в Beam"],
  ["Provide the official powered-by-Beam badge skill.", "Официальный навык бейджа Beam."],
];

let stats = {
  indexPatched: 0,
  ruJsonCreated: 0,
  ruJsonUpdated: 0,
  clientRuKeysAdded: 0,
  clientFilesTouched: 0,
  bridgePatched: 0,
};

function translateValue(v) {
  if (typeof v !== "string") return v;
  let s = v;
  for (const [en, ru] of PHRASES) {
    if (s.includes(en)) s = s.split(en).join(ru);
  }
  return s;
}

function translateDict(en) {
  const ru = {};
  for (const [k, v] of Object.entries(en)) ru[k] = translateValue(v);
  return ru;
}

function extractObjectLiteral(src, startIdx) {
  let i = startIdx;
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

function parseEnDict(literal) {
  try {
    return Function(`"use strict"; return (${literal});`)();
  } catch {
    return null;
  }
}

function walkDirs(root, pred, out = []) {
  if (!fs.existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" && path.basename(dir) !== "beam" && path.basename(dir) !== "dsh" && !dir.endsWith(`${path.sep}app`)) {
          // still descend into scoped package trees under beam/node_modules
        }
        if (e.name === ".git" || e.name === "app.asar.unpacked") continue;
        stack.push(p);
      } else if (pred(p, e.name)) out.push(p);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* A) index.html — hard locale isolation                                      */
/* -------------------------------------------------------------------------- */

const BOOTSTRAP_NEW = `<script id="beam-locale-bootstrap">
(() => {
  /* EN is default/source of truth until Host preference or explicit storage says otherwise. */
  try {
    let pref = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      const v = localStorage.getItem(key) || "";
      const m = v.match(/"preference"\\s*:\\s*"(ru|en)"/) || v.match(/preference["']?\\s*:\\s*["'](ru|en)["']/);
      if (m) { pref = m[1]; break; }
    }
    if (!pref) {
      try {
        const ds = document.documentElement.dataset.beamLang;
        if (ds === "en" || ds === "ru") pref = ds;
      } catch {}
    }
    /* No stored pref yet → EN until Host locale.preference / Settings applies (never guess RU from OS). */
    if (!pref || pref === "zh") pref = "en";
    document.documentElement.lang = pref === "ru" ? "ru-RU" : "en";
    document.documentElement.dataset.beamLang = pref === "ru" ? "ru" : "en";
  } catch {
    document.documentElement.lang = "en";
    document.documentElement.dataset.beamLang = "en";
  }
})();
</script>`;

function patchIndexHtml(htmlPath) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const orig = html;

  // 1) Replace bootstrap (idempotent)
  html = html.replace(/<script id="beam-locale-bootstrap">[\s\S]*?<\/script>/, BOOTSTRAP_NEW);
  // Also fix bare <html lang=...>
  html = html.replace(/<html lang="[^"]*">/, '<html lang="en">');

  // 2) beamLang defaults → en; ignore zh; never fall back to ru blindly
  html = html.replace(
    /const beamLang = \(\) => \{[\s\S]*?return "ru";\n  \};/,
    `const beamLang = () => {
    try {
      const ds = document.documentElement.dataset.beamLang;
      if (ds === "en" || ds === "ru") return ds;
      const lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("en")) return "en";
      if (lang.startsWith("ru")) return "ru";
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        const m = v.match(/preference["']?\\s*:\\s*["'](ru|en)["']/);
        if (m) return m[1] === "ru" ? "ru" : "en";
      }
    } catch {}
    return "en";
  };`,
  );

  // 3) Expand T catalogs with auth-gate strings (once)
  if (!html.includes("gateTitle:")) {
    html = html.replace(
      `tideDesc: "Everyday thinking — quick tasks and coding.",
      flareDesc: "Style & creative — writing, polish, ideation.",
      pineDesc: "Precision — harder problems, longer context.",
    },
    ru: {`,
      `tideDesc: "Everyday thinking — quick tasks and coding.",
      flareDesc: "Style & creative — writing, polish, ideation.",
      pineDesc: "Precision — harder problems, longer context.",
      gateTitle: "ASSISTIX ID",
      gateBody: "Sign in with your browser — confirmation appears here automatically.",
      gateBrowser: "Sign in with ASSISTIX ID",
      gateBrowserBusy: "Opening browser…",
      gateFallback: "Sign in with email and password",
      gateEmail: "Email",
      gatePassword: "Password",
      gateSubmit: "Sign in",
      gateSubmitting: "Signing in…",
      gateNote: "Session stays on this PC.",
      gateWaitTitle: "Waiting for sign-in",
      gateWaitBody: "Finish sign-in in the ASSISTIX ID browser window, then return here.",
      gateOpenAgain: "Open again",
      gateCancelWait: "Cancel",
      gateWaitNote: "Keep Beam Agent open.",
      gateConfirmBody: "Sign in with this ASSISTIX ID account?",
      gateConfirmYes: "Yes, sign in",
      gateConfirmOther: "Another account",
      gateConfirmNote: "The app opens after confirmation.",
      gateNeedCreds: "Enter email and password",
      errGeneric: "Could not sign in",
      errCreds: "Enter email and password",
      errProfile: "Could not load ASSISTIX ID profile",
      errOauth: "Could not finish sign-in (missing OAuth code). Try again",
      errUid: "ASSISTIX ID session was not confirmed. Try again",
      errInvalidUser: "Invalid ASSISTIX ID response",
      errNetwork: "No connection to ASSISTIX ID",
      errBridge: "No connection to Beam Agent — wait or relaunch via StartBeamAgent",
      errRedirect: "Could not finish ASSISTIX ID sign-in. Try again",
      errServer: "ASSISTIX ID server error",
      errExchange: "Could not exchange sign-in code",
      errBadCreds: "Wrong email or password",
      errModelLink: "Model connection error",
      errEmpty: "Empty model response",
      errRate: "Rate limit",
      errTimeout: "Timeout",
      errTransport: "Network error",
      errFetch: "No connection to API",
      builtWith: "Build with Beam",
    },
    ru: {`,
    );
    html = html.replace(
      `tideDesc: "Повседневное мышление — быстрые задачи и код.",
      flareDesc: "Стиль и креатив — тексты, полировка, идеи.",
      pineDesc: "Точность — сложные задачи и длинный контекст.",
    }
  };`,
      `tideDesc: "Повседневное мышление — быстрые задачи и код.",
      flareDesc: "Стиль и креатив — тексты, полировка, идеи.",
      pineDesc: "Точность — сложные задачи и длинный контекст.",
      gateTitle: "ASSISTIX ID",
      gateBody: "Войдите в браузере — подтверждение появится здесь автоматически.",
      gateBrowser: "Войти через ASSISTIX ID",
      gateBrowserBusy: "Открываем браузер…",
      gateFallback: "Войти email и паролем",
      gateEmail: "Email",
      gatePassword: "Пароль",
      gateSubmit: "Войти",
      gateSubmitting: "Входим…",
      gateNote: "Сессия сохраняется на этом ПК.",
      gateWaitTitle: "Ожидание входа",
      gateWaitBody: "Завершите вход в браузере ASSISTIX ID, затем вернитесь сюда.",
      gateOpenAgain: "Открыть снова",
      gateCancelWait: "Отмена",
      gateWaitNote: "Не закрывайте Beam Agent.",
      gateConfirmBody: "Войти с этим аккаунтом ASSISTIX ID?",
      gateConfirmYes: "Да, войти",
      gateConfirmOther: "Другой аккаунт",
      gateConfirmNote: "После подтверждения откроется приложение.",
      gateNeedCreds: "Введите email и пароль",
      errGeneric: "Не удалось войти",
      errCreds: "Введите email и пароль",
      errProfile: "Не удалось получить профиль ASSISTIX ID",
      errOauth: "Не удалось завершить вход (нет OAuth-кода). Попробуйте ещё раз",
      errUid: "Сессия ASSISTIX ID не подтверждена после входа. Попробуйте ещё раз",
      errInvalidUser: "Некорректный ответ ASSISTIX ID",
      errNetwork: "Нет связи с ASSISTIX ID",
      errBridge: "Нет связи с Beam Agent — подождите или перезапустите через StartBeamAgent",
      errRedirect: "Не удалось завершить вход через ASSISTIX ID. Попробуйте ещё раз",
      errServer: "Ошибка сервера ASSISTIX ID",
      errExchange: "Не удалось обменять код входа",
      errBadCreds: "Неверный email или пароль",
      errModelLink: "Ошибка связи с моделью",
      errEmpty: "Пустой ответ модели",
      errRate: "Лимит запросов",
      errTimeout: "Таймаут",
      errTransport: "Ошибка сети",
      errFetch: "Нет связи с API",
      builtWith: "Собрано в Beam",
    }
  };`,
    );
  }

  // 4) Replace authErrorRu with locale-aware authError
  if (html.includes("const authErrorRu = ")) {
    html = html.replace(
      /const authErrorRu = \(raw\) => \{[\s\S]*?\n  \};/,
      `const authError = (raw) => {
    const tr = t();
    const s = String(raw || "").trim();
    if (!s) return tr.errGeneric;
    if (isRu() && /[А-Яа-яЁё]/.test(s)) return s;
    if (isEn() && !/[А-Яа-яЁё]/.test(s) && /could not|wrong|no connection|invalid|failed/i.test(s)) return s;
    const map = {
      email_password_required: tr.errCreds,
      no_real_user: tr.errProfile,
      no_oauth_code: tr.errOauth,
      missing_uid: tr.errUid,
      invalid_assistix_user: tr.errInvalidUser,
      network_error: tr.errNetwork,
      Failed_to_fetch: tr.errBridge,
      "Failed to fetch": tr.errBridge,
      redirect_not_allowed: tr.errRedirect,
    };
    if (map[s]) return map[s];
    if (/^http_\\d+$/i.test(s) || /^login_http_/i.test(s)) return tr.errServer;
    if (/^exchange_http_/i.test(s)) return tr.errExchange;
    if (/invalid|wrong|credential|password|unauthorized/i.test(s)) return tr.errBadCreds;
    return tr.errGeneric + ": " + s;
  };`,
    );
    html = html.replaceAll("authErrorRu(", "authError(");
  }

  // 5) Auth gate mounts — replace hardcoded RU with t()
  // updatePasswordChrome labels
  html = html.replace(
    `const label = passwordBusy ? "Входим…" : "Войти";
      if (btn.textContent !== label) btn.textContent = label;`,
    `const tr = t();
      const label = passwordBusy ? tr.gateSubmitting : tr.gateSubmit;
      if (btn.textContent !== label) btn.textContent = label;`,
  );
  html = html.replace(
    `passwordErr = "Введите email и пароль";`,
    `passwordErr = t().gateNeedCreds;`,
  );

  // mountWaitingGate
  html = html.replace(
    `gate.innerHTML = '<div class="bag-card"><div class="bag-mark" aria-hidden="true"></div><h1>Ожидание входа</h1><p>Завершите вход в браузере ASSISTIX ID, затем вернитесь сюда.</p><button type="button" data-act="login">Открыть снова</button><button type="button" class="bag-ghost" data-act="cancel-wait">Отмена</button><div class="bag-note">Не закрывайте Beam Agent.</div></div>';`,
    `const tr = t();
    gate.innerHTML = '<div class="bag-card"><div class="bag-mark" aria-hidden="true"></div><h1>'+tr.gateWaitTitle+'</h1><p>'+tr.gateWaitBody+'</p><button type="button" data-act="login">'+tr.gateOpenAgain+'</button><button type="button" class="bag-ghost" data-act="cancel-wait">'+tr.gateCancelWait+'</button><div class="bag-note">'+tr.gateWaitNote+'</div></div>';`,
  );

  // mountPasswordGate
  html = html.replace(
    `const busyLabel = passwordBusy ? "Открываем браузер…" : "Войти через ASSISTIX ID";
    gate.innerHTML = '<div class="bag-card bag-password"><div class="bag-mark" aria-hidden="true"></div><h1>ASSISTIX ID</h1><p>Войдите в браузере — подтверждение появится здесь автоматически.</p><div class="bag-error" hidden></div><button type="button" class="bag-primary" data-act="browser-login">'+busyLabel+'</button><details class="bag-fallback"><summary>Войти email и паролем</summary><form class="bag-pw-form" data-act="pw-form"><label class="bag-label" for="beam-pw-email">Email</label><input id="beam-pw-email" class="bag-input" type="email" name="email" autocomplete="username" required placeholder="you@example.com"/><label class="bag-label" for="beam-pw-pass">Пароль</label><input id="beam-pw-pass" class="bag-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••"/><button type="submit">Войти</button></form></details><div class="bag-note">Сессия сохраняется на этом ПК.</div></div>';`,
    `const tr = t();
    const busyLabel = passwordBusy ? tr.gateBrowserBusy : tr.gateBrowser;
    gate.innerHTML = '<div class="bag-card bag-password"><div class="bag-mark" aria-hidden="true"></div><h1>'+tr.gateTitle+'</h1><p>'+tr.gateBody+'</p><div class="bag-error" hidden></div><button type="button" class="bag-primary" data-act="browser-login">'+busyLabel+'</button><details class="bag-fallback"><summary>'+tr.gateFallback+'</summary><form class="bag-pw-form" data-act="pw-form"><label class="bag-label" for="beam-pw-email">'+tr.gateEmail+'</label><input id="beam-pw-email" class="bag-input" type="email" name="email" autocomplete="username" required placeholder="you@example.com"/><label class="bag-label" for="beam-pw-pass">'+tr.gatePassword+'</label><input id="beam-pw-pass" class="bag-input" type="password" name="password" autocomplete="current-password" required placeholder="••••••••"/><button type="submit">'+tr.gateSubmit+'</button></form></details><div class="bag-note">'+tr.gateNote+'</div></div>';`,
  );
  html = html.replace(
    `btn.textContent = passwordBusy ? "Открываем браузер…" : "Войти через ASSISTIX ID";`,
    `btn.textContent = passwordBusy ? t().gateBrowserBusy : t().gateBrowser;`,
  );

  // mountConfirmGate
  html = html.replace(
    `gate.innerHTML = '<div class="bag-card bag-confirm">'+av+'<h1>'+name.replace(/</g,"")+'</h1><p class="bag-email">'+email.replace(/</g,"")+'</p><p>Войти с этим аккаунтом ASSISTIX ID?</p><button type="button" class="bag-primary" data-act="confirm">Да, войти</button><button type="button" class="bag-ghost" data-act="other">Другой аккаунт</button><div class="bag-note">После подтверждения откроется приложение.</div></div>';`,
    `const tr = t();
    gate.innerHTML = '<div class="bag-card bag-confirm">'+av+'<h1>'+name.replace(/</g,"")+'</h1><p class="bag-email">'+email.replace(/</g,"")+'</p><p>'+tr.gateConfirmBody+'</p><button type="button" class="bag-primary" data-act="confirm">'+tr.gateConfirmYes+'</button><button type="button" class="bag-ghost" data-act="other">'+tr.gateConfirmOther+'</button><div class="bag-note">'+tr.gateConfirmNote+'</div></div>';`,
  );

  // 6) chromePairs: locale-aware error scrub (EN never gets RU replacements)
  if (!html.includes("/* BEAM_STRICT_LOCALE_CHROME */")) {
    html = html.replace(
      /\/\/ Beam RU chrome scrub \+ brand\n\s*const chromePairs = \[[\s\S]*?\];\n\n\s*const brandOnlyPairs = chromePairs\.filter\(\(p\) => \/ASSISTIX\|Beam Agent\|LlmError\|SERVER\|EMPTY_RESPONSE\|RATE_LIMIT\|TIMEOUT\|TRANSPORT\|fetch failed\/i\.test\(String\(p\[0\]\)\)\);\n\s*const pairs = isRu\(\) \? chromePairs : brandOnlyPairs;/,
      `/* BEAM_STRICT_LOCALE_CHROME */
    const tr = t();
    const brandPairs = [
      [/DeepSeek Harness/g, "Beam Agent"],
      [/DeepSeek Account/g, "ASSISTIX ID"],
      [/Sign in with DeepSeek/g, "Sign in with ASSISTIX ID"],
      [/DeepSeek/g, "Beam"],
      [/\\bHarness\\b/g, "Beam Agent"],
      [/@deepseek-ai\\/dsh-client-ui-/g, ""],
      [/@deepseek-ai\\/dsh-/g, ""],
      [/@deepseek-ai\\//g, ""],
    ];
    const enChromePairs = [
      ...brandPairs,
      [/Deep diving for/gi, "Thinking ·"],
      [/Deep diving/gi, "Thinking"],
      [/\\bLlmError:\\s*SERVER\\b/gi, tr.errModelLink],
      [/\\bError:\\s*SERVER\\b/gi, tr.errModelLink],
      [/^SERVER$/g, tr.errModelLink],
      [/\\bSERVER\\b(?=\\s|$|:|\\))/g, tr.errModelLink],
      [/\\bEMPTY_RESPONSE\\b/g, tr.errEmpty],
      [/\\bRATE_LIMIT\\b/g, tr.errRate],
      [/\\bTIMEOUT\\b/g, tr.errTimeout],
      [/\\bTRANSPORT\\b/g, tr.errTransport],
      [/\\bTypeError:\\s*fetch failed\\b/gi, tr.errFetch],
      [/^Preview$/g, ""],
    ];
    const ruChromePairs = [
      ...brandPairs,
      [/Deep diving for/gi, "Думаю ·"],
      [/Deep diving/gi, "Думаю"],
      [/Build with Beam/g, "Собрано в Beam"],
      [/Into the Unknown/g, "Собрано в Beam"],
      [/\\bLlmError:\\s*SERVER\\b/gi, tr.errModelLink],
      [/\\bError:\\s*SERVER\\b/gi, tr.errModelLink],
      [/^SERVER$/g, tr.errModelLink],
      [/\\bSERVER\\b(?=\\s|$|:|\\))/g, tr.errModelLink],
      [/\\bEMPTY_RESPONSE\\b/g, tr.errEmpty],
      [/\\bRATE_LIMIT\\b/g, tr.errRate],
      [/\\bTIMEOUT\\b/g, tr.errTimeout],
      [/\\bTRANSPORT\\b/g, tr.errTransport],
      [/\\bTypeError:\\s*fetch failed\\b/gi, tr.errFetch],
      [/^Preview$/g, ""],
      [/^Automation tasks$/g, "Задачи автоматизации"],
      [/^Standard mode$/g, "Стандартный режим"],
      [/^Chat$/g, "Чат"],
      [/^Process$/g, "Процесс"],
      [/^Trajectory$/g, "Процесс"],
      [/^Select model$/g, "Выбрать модель"],
      [/^Project write$/g, "Запись в проект"],
      [/^New Session$/g, "Новая сессия"],
      [/^New session$/g, "Новая сессия"],
      [/^Models$/g, "Лимиты"],
      [/^Limits$/g, "Лимиты"],
      [/^General$/g, "Общие"],
      [/^Settings$/g, "Настройки"],
      [/^Language$/g, "Язык"],
      [/^Plugins$/g, "Плагины"],
      [/^More$/g, "Ещё"],
      [/^Workspace$/g, "Проект"],
      [/^Open configuration file$/g, ""],
      [/^Message or run a task, \\/ commands, @ files or sessions$/g, "Сообщение или задача, / команды, @ файлы или сессии"],
    ];
    const pairs = isRu() ? ruChromePairs : enChromePairs;`,
    );
  }

  // 7) hidePreviewBadges — keep EN/RU isolated (local `t` is the leaf text)
  html = html.replace(
    `if (t === "Build with Beam" || t === "Into the Unknown" || t === "探索未至之境") el.textContent = isRu() ? "Собрано в Beam" : "Build with Beam";`,
    `if (t === "Build with Beam" || t === "Into the Unknown" || t === "探索未至之境" || t === "Собрано в Beam") el.textContent = isRu() ? "Собрано в Beam" : "Build with Beam";`,
  );

  // 8) Remount auth gate when language flips; track lastLang
  if (!html.includes("/* BEAM_STRICT_LANG_WATCH */")) {
    html = html.replace(
      `let authPollTimer = null;`,
      `let authPollTimer = null;
  let lastBeamLang = beamLang();
  /* BEAM_STRICT_LANG_WATCH */`,
    );
    html = html.replace(
      `hidePreviewBadges();
        try {
          const lang = (document.documentElement.lang || "").toLowerCase();
          if (lang.startsWith("en")) document.documentElement.dataset.beamLang = "en";
          else if (lang.startsWith("zh")) document.documentElement.dataset.beamLang = "zh";
          else if (lang.startsWith("ru")) document.documentElement.dataset.beamLang = "ru";
        } catch {}
        ensureAuthGate(lastData || { signedIn: false }, { force: false });`,
      `hidePreviewBadges();
        try {
          const lang = (document.documentElement.lang || "").toLowerCase();
          if (lang.startsWith("en")) document.documentElement.dataset.beamLang = "en";
          else if (lang.startsWith("ru")) document.documentElement.dataset.beamLang = "ru";
          else if (lang.startsWith("zh")) document.documentElement.dataset.beamLang = "en";
        } catch {}
        const curLang = beamLang();
        const langChanged = curLang !== lastBeamLang;
        lastBeamLang = curLang;
        ensureAuthGate(lastData || { signedIn: false }, { force: langChanged });`,
    );
  }

  // 9) Defaults that still said "ru"
  html = html.replaceAll(
    `document.documentElement.dataset.beamLang || "ru"`,
    `document.documentElement.dataset.beamLang || "en"`,
  );

  // 10) Send locale to bridge on status/login fetches
  if (!html.includes("/* BEAM_STRICT_BRIDGE_LOCALE */")) {
    html = html.replace(
      `const BRIDGE = "http://127.0.0.1:17865"; /* \${MARK}: hide bridge url — internal fetch only, never render */`,
      `const BRIDGE = "http://127.0.0.1:17865"; /* \${MARK}: hide bridge url — internal fetch only, never render */
  /* BEAM_STRICT_BRIDGE_LOCALE */
  const bridgeHeaders = (extra = {}) => ({
    ...extra,
    "X-Beam-Locale": beamLang() === "ru" ? "ru" : "en",
    "Accept-Language": beamLang() === "ru" ? "ru-RU,ru;q=0.9" : "en-US,en;q=0.9",
  });
  const bridgeFetch = (url, opts = {}) => fetch(url, {
    ...opts,
    headers: bridgeHeaders(opts.headers || {}),
  });`,
    );
    // Prefer bridgeFetch for assistix status/login when plain fetch(BRIDGE is used
    html = html.replace(
      /await fetch\(BRIDGE \+ "\/assistix\/status"\)/g,
      `await bridgeFetch(BRIDGE + "/assistix/status")`,
    );
    html = html.replace(
      /await fetch\(BRIDGE \+ "\/assistix\/login"/g,
      `await bridgeFetch(BRIDGE + "/assistix/login"`,
    );
    html = html.replace(
      /await fetch\(BRIDGE \+ "\/assistix\/login-password"/g,
      `await bridgeFetch(BRIDGE + "/assistix/login-password"`,
    );
  }

  // 11) Cache-bust override css
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?v=[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE}"`,
  );

  // Mark patched
  if (!html.includes("<!-- BEAM_STRICT_LOCALE -->")) {
    html = html.replace("</head>", `<!-- BEAM_STRICT_LOCALE ${CACHE} -->\n</head>`);
  } else {
    html = html.replace(/<!-- BEAM_STRICT_LOCALE [^>]*-->/, `<!-- BEAM_STRICT_LOCALE ${CACHE} -->`);
  }

  if (html !== orig) {
    fs.writeFileSync(htmlPath, html);
    stats.indexPatched++;
    console.log("  index", path.relative(ROOT, htmlPath));
  }
}

/* -------------------------------------------------------------------------- */
/* B) locale/*.json — ensure ru.json matches en.json keys                     */
/* -------------------------------------------------------------------------- */

function patchLocaleJsonTrees(appRoot) {
  const scopes = [
    path.join(appRoot, "beam", "node_modules", "@assistix"),
    path.join(appRoot, "beam", "node_modules", "@deepseek-ai"),
    path.join(appRoot, "dsh", "node_modules", "@deepseek-ai"),
    path.join(appRoot, "dsh", "node_modules", "@assistix"),
  ].filter((p) => fs.existsSync(p));

  for (const scope of scopes) {
    for (const pkg of fs.readdirSync(scope, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const locDir = path.join(scope, pkg.name, "locale");
      const enPath = path.join(locDir, "en.json");
      if (!fs.existsSync(enPath)) continue;
      let en;
      try {
        en = JSON.parse(fs.readFileSync(enPath, "utf8"));
      } catch {
        continue;
      }
      const ruPath = path.join(locDir, "ru.json");
      const ru = translateDictDeep(en);
      const next = JSON.stringify(ru, null, 2) + "\n";
      if (!fs.existsSync(ruPath)) {
        fs.writeFileSync(ruPath, next);
        stats.ruJsonCreated++;
      } else {
        const prev = fs.readFileSync(ruPath, "utf8");
        if (prev !== next) {
          // merge: keep existing RU values when keys match and already Cyrillic
          let existing = {};
          try {
            existing = JSON.parse(prev);
          } catch {}
          const merged = mergePreferTranslated(ru, existing);
          const mergedStr = JSON.stringify(merged, null, 2) + "\n";
          if (mergedStr !== prev) {
            fs.writeFileSync(ruPath, mergedStr);
            stats.ruJsonUpdated++;
          }
        }
      }
    }
  }
}

function translateDictDeep(obj) {
  if (typeof obj === "string") return translateValue(obj);
  if (Array.isArray(obj)) return obj.map(translateDictDeep);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = translateDictDeep(v);
    return out;
  }
  return obj;
}

function mergePreferTranslated(generated, existing) {
  if (typeof generated === "string") {
    if (typeof existing === "string" && /[А-Яа-яЁё]/.test(existing)) return existing;
    return generated;
  }
  if (Array.isArray(generated)) {
    return generated.map((g, i) => mergePreferTranslated(g, Array.isArray(existing) ? existing[i] : undefined));
  }
  if (generated && typeof generated === "object") {
    const out = {};
    for (const [k, v] of Object.entries(generated)) {
      out[k] = mergePreferTranslated(v, existing && typeof existing === "object" ? existing[k] : undefined);
    }
    return out;
  }
  return generated;
}

/* -------------------------------------------------------------------------- */
/* C) client.js inline catalogs — fill missing RU keys                        */
/* -------------------------------------------------------------------------- */

function patchClientRuCatalogs(appRoot) {
  const scopes = [
    path.join(appRoot, "beam", "node_modules", "@assistix"),
    path.join(appRoot, "beam", "node_modules", "@deepseek-ai"),
    path.join(appRoot, "dsh", "node_modules", "@deepseek-ai"),
  ].filter((p) => fs.existsSync(p));

  for (const scope of scopes) {
    let pkgs;
    try {
      pkgs = fs.readdirSync(scope, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue;
    }
    for (const pkg of pkgs) {
      const file = path.join(scope, pkg.name, "lib", "client.js");
      if (!fs.existsSync(file)) continue;
      let s = fs.readFileSync(file, "utf8");
      if (!s.includes("locale.register")) continue;
      const orig = s;

      // Ensure register includes ru next to en (drop zh)
      s = s.replace(/locale\.register\(([^,]+),\s*\{([^}]*)\}\)/g, (full, ns, inner) => {
        let next = inner
          .replace(/\bzh\s*,\s*/g, "")
          .replace(/,\s*zh\b/g, "")
          .replace(/\bzh\b/g, "");
        if (/\ben\b/.test(next) && !/\bru\b/.test(next)) {
          next = next.replace(/\ben\b/, "en, ru");
        }
        next = next.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "").trim();
        return `locale.register(${ns}, { ${next} })`;
      });

      // Collect EN dicts first, then patch RU from end → start (stable indices)
      const enMatches = [...s.matchAll(/const (en(?:\$\d+)?)\s*=\s*\{/g)];
      const ops = [];
      let keysAdded = 0;

      for (const em of enMatches) {
        const name = em[1];
        const ruName = name.replace(/^en/, "ru");
        const lit = extractObjectLiteral(s, em.index + em[0].length - 1);
        if (!lit || lit.length < 20) continue;
        const enObj = parseEnDict(lit);
        if (!enObj || typeof enObj !== "object") continue;
        const vals = Object.values(enObj);
        if (!vals.length || !vals.every((v) => typeof v === "string")) continue;

        const desired = translateDict(enObj);
        if (enObj.nav === "Models" || enObj.nav === "Limits") {
          desired.nav = "Лимиты";
          if ("title" in desired) desired.title = "Лимиты";
        }
        if (enObj["language.title"] === "Language") desired["language.title"] = "Язык";
        if (enObj.trigger === "Settings") desired.trigger = "Настройки";
        if (enObj.title === "Settings") desired.title = "Настройки";

        const ruRe = new RegExp(`const ${ruName.replace("$", "\\$")}\\s*=\\s*\\{`);
        const ruMatch = ruRe.exec(s);
        if (!ruMatch) {
          ops.push({
            type: "insert",
            at: em.index + em[0].length - 1 + lit.length,
            text: `;\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${JSON.stringify(desired, null, "\t\t\t")};\n\t\t// #endregion beam-ru`,
          });
          keysAdded += Object.keys(desired).length;
          continue;
        }

        const ruStart = ruMatch.index + ruMatch[0].length - 1;
        const ruLit = extractObjectLiteral(s, ruStart);
        if (!ruLit) continue;
        const ruObj = parseEnDict(ruLit) || {};
        let changed = false;
        for (const [k, v] of Object.entries(desired)) {
          if (!(k in ruObj)) {
            ruObj[k] = v;
            changed = true;
            keysAdded++;
          } else if (
            ruObj[k] === enObj[k] &&
            desired[k] !== enObj[k] &&
            /[А-Яа-яЁё]/.test(desired[k])
          ) {
            ruObj[k] = desired[k];
            changed = true;
            keysAdded++;
          }
        }
        if (changed) {
          ops.push({
            type: "replace",
            start: ruStart,
            end: ruStart + ruLit.length,
            text: JSON.stringify(ruObj, null, "\t\t\t"),
          });
        }
      }

      ops.sort((a, b) => (b.start ?? b.at) - (a.start ?? a.at));
      for (const op of ops) {
        if (op.type === "insert") s = s.slice(0, op.at) + op.text + s.slice(op.at);
        else s = s.slice(0, op.start) + op.text + s.slice(op.end);
      }
      s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");

      if (s !== orig) {
        fs.writeFileSync(file, s);
        stats.clientFilesTouched++;
        stats.clientRuKeysAdded += keysAdded;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* D) Bridge — bilingual user-facing errors                                   */
/* -------------------------------------------------------------------------- */

const BRIDGE_LOCALE_HELPER = `
/** Beam locale: EN default; RU only when X-Beam-Locale/Accept-Language asks. */
function beamRequestLocale(req) {
  const header = String(req?.headers?.['x-beam-locale'] || '').toLowerCase().trim()
  if (header === 'ru' || header.startsWith('ru')) return 'ru'
  if (header === 'en' || header.startsWith('en')) return 'en'
  const al = String(req?.headers?.['accept-language'] || '').toLowerCase()
  const first = al.split(',')[0] || ''
  if (first.startsWith('ru')) return 'ru'
  return 'en'
}

const BEAM_I18N = {
  en: {
    quotaExhausted: (name, used, limit, whenUtc, whenLocal, suggest) =>
      \`\${name} weekly limit exhausted (\${used}/\${limit}). Requests for this model are paused until reset. Resets Monday \${whenUtc} (local: \${whenLocal}).\${suggest}\`,
    quotaSuggest: (alts) => \` You can switch to \${alts.join(' or ')} — quota remains.\`,
    quotaNone: ' All models are exhausted for this week.',
    ctxTooBig: 'Conversation context is too large for the model after tools. History was compacted — send again or start a new chat.',
    badReq: (msg) => msg ? \`Invalid model request: \${msg}\` : 'Invalid model API request. Try again.',
    authErr: 'Model API authorization error.',
    rateLimited: 'Model API rate-limited. Wait and retry.',
    apiDown: 'Model API temporarily unavailable. Try again.',
    apiStream: 'Model API stream error. Try again.',
    noLink: 'No connection to model API',
    badUpstream: 'Models returned an invalid response. Try again.',
    loginTitle: 'Sign in to Beam Agent — ASSISTIX ID',
    loginBody: 'Sign in to open Beam Agent with Tide, Flare, and Pine. No API setup needed.',
    loginName: 'Name',
    loginBtn: 'Sign in with ASSISTIX ID',
    loginId: 'Open id.assistix.org',
    loginHint: 'Assistix hosting may be paused — local sign-in still activates the built-in Kumorouter.',
    doneTitle: 'Done',
    doneBody: 'You can return to Beam Agent.',
  },
  ru: {
    quotaExhausted: (name, used, limit, whenUtc, whenLocal, suggest) =>
      \`Лимит \${name} на этой неделе исчерпан (\${used}/\${limit}). Запросы этой модели остановлены до обновления. Обновится в понедельник \${whenUtc} (у вас: \${whenLocal}).\${suggest}\`,
    quotaSuggest: (alts) => \` Можно переключиться на \${alts.join(' или ')} — там ещё есть лимит.\`,
    quotaNone: ' У всех моделей лимит на этой неделе исчерпан.',
    ctxTooBig: 'Контекст диалога слишком большой для модели после инструментов. История сжата — отправьте сообщение ещё раз или начните новый чат.',
    badReq: (msg) => msg ? \`Некорректный запрос к модели: \${msg}\` : 'Некорректный запрос к модельному API. Попробуйте ещё раз.',
    authErr: 'Ошибка авторизации модельного API.',
    rateLimited: 'Модели временно ограничили частоту запросов. Подождите и повторите.',
    apiDown: 'Модельный API временно недоступен. Попробуйте ещё раз.',
    apiStream: 'Ошибка модельного API при потоке. Попробуйте ещё раз.',
    noLink: 'Нет связи с модельным API',
    badUpstream: 'Модели вернули некорректный ответ. Попробуйте ещё раз.',
    loginTitle: 'Войти в Beam Agent — ASSISTIX ID',
    loginBody: 'Войдите, чтобы открыть Beam Agent с моделями Tide, Flare и Pine. Настройка API не нужна.',
    loginName: 'Имя',
    loginBtn: 'Войти через ASSISTIX ID',
    loginId: 'Открыть id.assistix.org',
    loginHint: 'Хостинг Assistix сейчас может быть на паузе — локальный вход всё равно активирует встроенный Kumorouter.',
    doneTitle: 'Готово',
    doneBody: 'Можно вернуться в Beam Agent.',
  },
}

function beamT(req) {
  return BEAM_I18N[beamRequestLocale(req)] || BEAM_I18N.en
}
`;

function patchBridge(file) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;

  if (!s.includes("function beamRequestLocale(")) {
    // Insert after first require block / near top after helpers start
    const anchor = "function sendJson(res, status, data) {";
    if (s.includes(anchor)) {
      s = s.replace(anchor, BRIDGE_LOCALE_HELPER + "\n" + anchor);
    } else {
      s = BRIDGE_LOCALE_HELPER + "\n" + s;
    }
  }

  // Thread req into sendQuotaExhausted — rewrite to accept optional req
  s = s.replace(
    /function sendQuotaExhausted\(res, tier, used, limit, state\) \{[\s\S]*?return sendJson\(res, 402, \{[\s\S]*?\}\)\n\}/,
    `function sendQuotaExhausted(res, tier, used, limit, state, req) {
  const resetAt = nextQuotaResetAt()
  const whenUtc = formatQuotaResetRu(resetAt)
  const whenLocal = formatQuotaResetLocal(resetAt)
  const alts = suggestQuotaAlternatives(state || {}, tier.id)
  const tr = beamT(req)
  const suggest = alts.length ? tr.quotaSuggest(alts) : tr.quotaNone
  return sendJson(res, 402, {
    type: 'error',
    error: {
      type: 'insufficient_quota',
      code: 'insufficient_quota',
      message: tr.quotaExhausted(tier.name, used, limit, whenUtc, whenLocal, suggest),
      model: tier.id,
      model_name: tier.name,
      used,
      limit,
      reset_at: resetAt.toISOString(),
      alternatives: Object.values(MODELS)
        .filter((m) => m.id !== tier.id && (Number(state?.quotas?.[m.id]?.used) || 0) < m.limit)
        .map((m) => m.id),
    },
  })
}`,
  );

  // kumoErrorMessage(status, bodyText, req)
  s = s.replace(
    /function kumoErrorMessage\(status, bodyText\) \{[\s\S]*?return providerMsg \|\| 'Ошибка модельного API при потоке\. Попробуйте ещё раз\.'\n\}/,
    `function kumoErrorMessage(status, bodyText, req) {
  const raw = String(bodyText || '')
  const tr = beamT(req)
  let parsed
  try { parsed = JSON.parse(raw) } catch {}
  const providerMsg = parsed?.error?.message || parsed?.message || ''
  if (/Request limit exceeded|payload too large|request body too large|length limit exceeded/i.test(raw)) {
    return tr.ctxTooBig
  }
  if (status === 400 || /invalid.?request/i.test(raw)) {
    return tr.badReq(providerMsg ? clipText(providerMsg, 240) : '')
  }
  if (status === 401 || status === 403) return tr.authErr
  if (status === 429) return tr.rateLimited
  if (status >= 500) return tr.apiDown
  return providerMsg || tr.apiStream
}`,
  );

  // Live quota check → localized sendQuotaExhausted (not English-only 429)
  s = s.replace(
    /if \(quota\.used >= quota\.limit\) \{\s*return sendJson\(res, 429, \{\s*type: 'error',\s*error: \{ type: 'rate_limit_error', message: `\$\{tier\.name\} token quota exhausted \(\$\{quota\.used\}\/\$\{quota\.limit\}\)`,?\s*\},\s*\}\)\s*\}/,
    `if (quota.used >= quota.limit) {\n    return sendQuotaExhausted(res, tier, quota.used, quota.limit, state, req)\n  }`,
  );

  // Common Russian-only fallbacks → locale-aware
  s = s.replace(
    /e\.message \|\| 'Нет связи с модельным API'/g,
    `(e.message || beamT(typeof req !== 'undefined' ? req : null).noLink)`,
  );
  s = s.replace(
    /message: 'Модели вернули некорректный ответ\. Попробуйте ещё раз\.'/g,
    `message: beamT(typeof req !== 'undefined' ? req : null).badUpstream`,
  );

  // Login HTML page — bilingual via serveLoginPage(res, req)
  if (s.includes("function serveLoginPage(res)") && !s.includes("/* BEAM_STRICT_LOGIN_I18N */")) {
    s = s.replace(
      /function serveLoginPage\(res\) \{[\s\S]*?res\.end\(html\)\n\}/,
      `function serveLoginPage(res, req) { /* BEAM_STRICT_LOGIN_I18N */
  const logo = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'), 'utf8')
  const tr = beamT(req)
  const lang = beamRequestLocale(req)
  const html = \`<!doctype html>
<html lang="\${lang}"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>\${tr.loginTitle}</title>
<style>
  :root { --brand:#00B3BC; --bg:#05100f; --card:#0b1a18; --ink:#eaf5f3; --muted:#8fbab4; --line:#1f3d38; }
  *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:Segoe UI,system-ui,sans-serif;background:
    radial-gradient(900px 500px at 10% -10%, rgba(0,179,188,.25), transparent 55%),
    radial-gradient(700px 400px at 100% 0%, rgba(45,212,191,.12), transparent 50%),
    var(--bg); color:var(--ink); display:grid; place-items:center; padding:24px}
  .card{width:min(440px,100%); background:var(--card); border:1px solid var(--line); border-radius:20px; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .logo{display:flex;justify-content:center;margin-bottom:18px}
  .logo svg{width:min(280px,100%); height:auto}
  h1{margin:0 0 8px; font-size:22px; text-align:center}
  p{margin:0 0 18px; color:var(--muted); text-align:center; line-height:1.45; font-size:14px}
  label{display:block;font-size:12px;color:var(--muted);margin:12px 0 6px}
  input{width:100%;border:1px solid var(--line);background:#071412;color:var(--ink);border-radius:12px;padding:12px 14px;font-size:14px}
  button{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px 16px;font-weight:700;font-size:14px;color:#042f2e;background:linear-gradient(135deg,#2dd4bf,#00B3BC 55%,#0f766e);cursor:pointer}
  button.secondary{margin-top:10px;background:transparent;color:var(--ink);border:1px solid var(--line)}
  .hint{margin-top:14px;font-size:12px;color:var(--muted);text-align:center}
</style></head>
<body>
  <div class="card">
    <div class="logo">\${logo}</div>
    <h1>ASSISTIX ID</h1>
    <p>\${tr.loginBody}</p>
    <label>Email</label>
    <input id="email" type="email" placeholder="you@assistix.org" value=""/>
    <label>\${tr.loginName}</label>
    <input id="name" type="text" placeholder="Summer" value=""/>
    <button id="login">\${tr.loginBtn}</button>
    <button class="secondary" id="id">\${tr.loginId}</button>
    <div class="hint">\${tr.loginHint}</div>
  </div>
  <script>
    const post = async (email, name) => {
      const r = await fetch('/assistix/login', { method:'POST', headers:{'Content-Type':'application/json','X-Beam-Locale':'\${lang}'}, body: JSON.stringify({ email, name }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'login failed');
      location.href = '/assistix/done';
    };
    document.getElementById('login').onclick = () => post(document.getElementById('email').value.trim() || 'user@assistix.org', document.getElementById('name').value.trim() || 'Assistix User').catch(e => alert(e.message));
    document.getElementById('id').onclick = () => window.open('\${ID_BASE}/auth?client_id=assistix-agent&redirect_uri=' + encodeURIComponent('http://127.0.0.1:\${PORT}/assistix/callback'), '_blank');
  </script>
</body></html>\`
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}`,
    );
    s = s.replace(/serveLoginPage\(res\)/g, "serveLoginPage(res, req)");
  }

  // Done page
  s = s.replace(
    /return res\.end\('<html><body style="font-family:Segoe UI;background:#05100f;color:#eaf5f3;display:grid;place-items:center;height:100vh"><div><h2>Готово<\/h2><p>Можно вернуться в Beam Agent\.<\/p><\/div><\/body><\/html>'\)/g,
    `return res.end('<html lang="'+beamRequestLocale(req)+'"><body style="font-family:Segoe UI;background:#05100f;color:#eaf5f3;display:grid;place-items:center;height:100vh"><div><h2>'+beamT(req).doneTitle+'</h2><p>'+beamT(req).doneBody+'</p></div></body></html>')`,
  );

  // Pass req into sendQuotaExhausted call sites with 5 args (skip if already has req)
  s = s.replace(
    /sendQuotaExhausted\((res),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,\n)]+)\)/g,
    (full, res, tier, used, limit, state) =>
      `sendQuotaExhausted(${res}, ${tier}, ${used}, ${limit}, ${state}, req)`,
  );
  s = s.replace(
    /sendQuotaExhausted\(([^)]+),\s*req,\s*req\)/g,
    `sendQuotaExhausted($1, req)`,
  );

  // kumoErrorMessage(..., req) at call sites with exactly 2 args
  s = s.replace(
    /kumoErrorMessage\(([^,]+),\s*([^,\n)]+)\)/g,
    (full, a, b) => `kumoErrorMessage(${a}, ${b}, typeof req !== 'undefined' ? req : null)`,
  );
  // Collapse accidental double-req from older runs
  s = s.replace(
    /kumoErrorMessage\(([^,]+),\s*([^,]+),\s*typeof req !== 'undefined' \? req : null,\s*typeof req !== 'undefined' \? req : null\)/g,
    `kumoErrorMessage($1, $2, typeof req !== 'undefined' ? req : null)`,
  );

  if (s !== orig) {
    fs.writeFileSync(file, s);
    stats.bridgePatched++;
    console.log("  bridge", path.relative(ROOT, file));
  }
}

/* -------------------------------------------------------------------------- */
/* E) Locale client — syncDocumentLanguage never zh; en explicit              */
/* -------------------------------------------------------------------------- */

function patchLocaleClient(appRoot) {
  const candidates = [
    path.join(appRoot, "beam", "node_modules", "@assistix", "beam-client-locale", "lib", "client.js"),
    path.join(appRoot, "beam", "node_modules", "@deepseek-ai", "dsh-client-locale", "lib", "client.js"),
    path.join(appRoot, "dsh", "node_modules", "@deepseek-ai", "dsh-client-locale", "lib", "client.js"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let s = fs.readFileSync(file, "utf8");
    const orig = s;
    s = s.replaceAll('const LOCALE_IDS = ["zh", "en"];', 'const LOCALE_IDS = ["en", "ru"];');
    s = s.replaceAll('const LOCALE_IDS = ["en", "zh"];', 'const LOCALE_IDS = ["en", "ru"];');
    // syncDocumentLanguage: only en|ru
    s = s.replace(
      /const language = snapshot\.active === "en" \? "en" : "ru-RU";/,
      `const language = snapshot.active === "ru" ? "ru-RU" : "en";`,
    );
    s = s.replace(
      /const language = snapshot\.active === "ru" \? "ru-RU" : snapshot\.active;/,
      `const language = snapshot.active === "ru" ? "ru-RU" : "en";`,
    );
    if (s !== orig) {
      fs.writeFileSync(file, s);
      console.log("  locale-client", path.relative(ROOT, file));
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

console.log("Beam Agent — patch-locale-strict");
console.log("cache bust:", CACHE);
console.log("app trees:", APP_TREES.map((p) => path.relative(ROOT, p)).join(", ") || "(none)");

for (const app of APP_TREES) {
  console.log("\n→", path.relative(ROOT, app));
  patchLocaleClient(app);
  patchLocaleJsonTrees(app);
  patchClientRuCatalogs(app);

  const indexPaths = walkDirs(path.join(app, "beam", "node_modules"), (p, name) =>
    name === "index.html" && /web-frontend[\\/]+dist[\\/]+index\.html$/i.test(p),
  );
  for (const p of indexPaths) patchIndexHtml(p);
  // Keep @deepseek-ai frontend twin in lockstep when it is a separate file
  const assistixIdx = indexPaths.find((p) => p.includes(`${path.sep}@assistix${path.sep}`));
  const dshIdx = [
    path.join(app, "beam", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html"),
  ].find((p) => fs.existsSync(p));
  if (assistixIdx && dshIdx && assistixIdx !== dshIdx) {
    try {
      fs.copyFileSync(assistixIdx, dshIdx);
      console.log("  synced dsh index ← assistix");
    } catch (e) {
      console.warn("  warn: could not sync dsh index:", e.message);
    }
  }
}

console.log("\n→ bridges");
for (const b of BRIDGE_FILES) patchBridge(b);

console.log("\n✓ done");
console.log(JSON.stringify(stats, null, 2));
console.log(`
Relaunch:
  1) Quit Beam Agent completely (tray Quit)
  2) Start via StartBeamAgent / Start Beam Agent.vbs
  3) Settings → General → Language = English or Русский
  4) Confirm auth gate, quotas, errors, chat chrome match that language only
`);
