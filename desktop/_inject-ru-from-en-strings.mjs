/**
 * Build RU locale objects by extracting "key": "value" string pairs from EN dicts.
 * Handles dicts that reference identifiers (which break Function() parse).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const TREES = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
];

// Reuse full phrase map from chrome patch by evaluating a slice — or duplicate key set.
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
  ["Show coding view", "Показать вид кодирования"],
  ["Shows trajectory, code diffs, and all Agent presets", "Показывает траекторию, диффы кода и все пресеты агента"],
  ["Could not save. Please try again.", "Не удалось сохранить. Попробуйте ещё раз."],
  ["Checking for updates…", "Проверка обновлений…"],
  ["Install and Restart", "Установить и перезапустить"],
  ["Retry update", "Повторить обновление"],
  ["Into the Unknown", "Собрано в Beam"],
  ["Build with Beam", "Собрано в Beam"],
  ["DSH Local Build", "Beam Agent"],
  ["Original image preview", "Просмотр оригинала"],
  ["Close original image preview", "Закрыть просмотр"],
  ["Choose workspace", "Выбрать рабочую область"],
  ["Session hierarchy", "Иерархия сессий"],
  ["More conversation views", "Другие виды беседы"],
  ["New session", "Новая сессия"],
  ["New chat", "Новый чат"],
  ["Ask anything", "Спросите что угодно"],
  ["Message Beam Agent", "Сообщение для Beam Agent"],
  ["Type a message", "Введите сообщение"],
  ["Send message", "Отправить сообщение"],
  ["Stop generating", "Остановить генерацию"],
  ["Thinking for", "Думаю ·"],
  ["Deep diving for", "Думаю ·"],
  ["Deep diving", "Думаю"],
  ["Thinking…", "Думаю…"],
  ["Thinking", "Думаю"],
  ["Working…", "Работаю…"],
  ["Running…", "Выполняю…"],
  ["Queued", "В очереди"],
  ["Attach files", "Прикрепить файлы"],
  ["Upload file", "Загрузить файл"],
  ["Drop files here", "Перетащите файлы сюда"],
  ["No conversations yet", "Пока нет бесед"],
  ["No sessions yet", "Пока нет сессий"],
  ["Search chats", "Поиск чатов"],
  ["Search sessions", "Поиск сессий"],
  ["Default workspace", "Рабочая область по умолчанию"],
  ["Current version:", "Текущая версия:"],
  ["Reload to load the new version", "Перезагрузить, чтобы применить новую версию"],
  ["Service version changed", "Версия сервиса изменилась"],
  ["Check your connection and try again", "Проверьте соединение и попробуйте снова"],
  ["Could not check for updates", "Не удалось проверить обновления"],
  ["Could not download the update", "Не удалось скачать обновление"],
  ["Could not install the update", "Не удалось установить обновление"],
  ["Downloading update", "Скачивание обновления"],
  ["Target version", "Целевая версия"],
  ["Verifying update files…", "Проверка файлов обновления…"],
  ["Preparing to restart…", "Подготовка к перезапуску…"],
  ["Please try again later", "Попробуйте позже"],
  ["Please try again", "Попробуйте ещё раз"],
  ["Add an API key to get started", "Войдите через ASSISTIX ID"],
  ["Enter your API keys to use models from the following providers.", "Лимиты моделей Tide, Flare и Pine."],
  ["Third-party model provider", "Сторонний провайдер"],
  ["Custom model API", "Свой API моделей"],
  ["Permission required", "Требуется разрешение"],
  ["Allow once", "Разрешить один раз"],
  ["Allow always", "Разрешить всегда"],
  ["Deny", "Отклонить"],
  ["Approve", "Одобрить"],
  ["Reject", "Отклонить"],
  ["Continue", "Продолжить"],
  ["Dismiss", "Скрыть"],
  ["Clear", "Очистить"],
  ["Rename", "Переименовать"],
  ["Duplicate", "Дублировать"],
  ["Export", "Экспорт"],
  ["Import", "Импорт"],
  ["Download", "Скачать"],
  ["Upload", "Загрузить"],
  ["Refresh", "Обновить"],
  ["Reconnect", "Переподключить"],
  ["Disconnected", "Отключено"],
  ["Reconnecting", "Переподключение"],
  ["Connected", "Подключено"],
  ["Signed in", "Вы вошли"],
  ["Sign out", "Выйти"],
  ["Sign in", "Войти"],
  ["Guest", "Гость"],
  ["Language", "Язык"],
  ["Settings", "Настройки"],
  ["General", "Общие"],
  ["Models", "Лимиты"],
  ["Limits", "Лимиты"],
  ["Account", "Аккаунт"],
  ["Workspace", "Рабочая область"],
  ["Sessions", "Сессии"],
  ["Files", "Файлы"],
  ["Terminal", "Терминал"],
  ["Browser", "Браузер"],
  ["Plan", "План"],
  ["Goals", "Цели"],
  ["Permissions", "Разрешения"],
  ["Shortcuts", "Горячие клавиши"],
  ["Plugins", "Плагины"],
  ["Theme", "Тема"],
  ["Dark", "Тёмная"],
  ["Light", "Светлая"],
  ["System", "Системная"],
  ["Provider", "Провайдер"],
  ["API key", "Ключ API"],
  ["Base URL", "Базовый URL"],
  ["Display name", "Отображаемое имя"],
  ["Context window", "Контекст"],
  ["Max output tokens", "Макс. токенов ответа"],
  ["Reasoning levels", "Уровни рассуждения"],
  ["Add model", "Добавить модель"],
  ["Delete model", "Удалить модель"],
  ["Restore defaults", "Сбросить по умолчанию"],
  ["Not now", "Не сейчас"],
  ["Overridden", "Переопределено"],
  ["Enabled", "Включено"],
  ["Disabled", "Выключено"],
  ["Edit", "Изменить"],
  ["Delete", "Удалить"],
  ["Close", "Закрыть"],
  ["Cancel", "Отмена"],
  ["Apply", "Применить"],
  ["Applying…", "Применение…"],
  ["Retry", "Повторить"],
  ["Loading…", "Загрузка…"],
  ["Search", "Поиск"],
  ["Send", "Отправить"],
  ["Stop", "Стоп"],
  ["Copy", "Копировать"],
  ["Copied", "Скопировано"],
  ["Collapse", "Свернуть"],
  ["Expand", "Развернуть"],
  ["Back", "Назад"],
  ["Next", "Далее"],
  ["Previous", "Назад"],
  ["Save", "Сохранить"],
  ["Skip", "Пропустить"],
  ["More", "Ещё"],
  ["Unknown", "Неизвестно"],
  ["None", "Нет"],
  ["Update", "Обновление"],
  ["Help", "Справка"],
  ["About", "О программе"],
  ["Error", "Ошибка"],
  ["Warning", "Предупреждение"],
  ["Yes", "Да"],
  ["No", "Нет"],
  ["On", "Вкл"],
  ["Off", "Выкл"],
  ["New line", "Новая строка"],
  ["Open command menu", "Открыть меню команд"],
  ["Open reference menu", "Открыть меню ссылок"],
  ["Use the complementary Queue / Steer action", "Доп. действие Очередь / Управление"],
  ["Expand the remaining {n} output lines", "Развернуть оставшиеся {n} строк"],
  ["… {n} more lines", "… ещё {n} строк"],
  ["(send input)", "(отправить ввод)"],
  ["Terminal {sessionId}", "Терминал {sessionId}"],
  ["Preview", "Предпросмотр"],
];

function translateValue(v) {
  let s = v;
  for (const [en, ru] of PHRASES) if (s.includes(en)) s = s.split(en).join(ru);
  s = s
    .replaceAll("DeepSeek Harness", "Beam Agent")
    .replaceAll("DeepSeek Account", "ASSISTIX ID")
    .replaceAll("DeepSeek", "ASSISTIX")
    .replace(/\bHarness\b/g, "Beam Agent");
  return s;
}

function translateDict(en) {
  const ru = {};
  for (const [k, v] of Object.entries(en)) {
    if (k === "hero.headline") {
      ru[k] = "Собрано в Beam";
      continue;
    }
    if (k === "hero.preview") {
      ru[k] = "";
      continue;
    }
    if (k === "brand.localBuild") {
      ru[k] = "Beam Agent";
      continue;
    }
    ru[k] = translateValue(v);
  }
  return ru;
}

function extractObjectLiteral(src, startIdx) {
  let i = startIdx,
    depth = 0,
    inStr = null,
    esc = false;
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

/** Pull only "key": "value" pairs (JSON-compatible escapes). */
function extractStringPairs(lit) {
  const obj = {};
  const re = /"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(lit))) {
    const key = JSON.parse(`"${m[1]}"`);
    const val = JSON.parse(`"${m[2]}"`);
    obj[key] = val;
  }
  return obj;
}

function fixFile(file) {
  let s = fs.readFileSync(file, "utf8");
  if (!/locale\.register\([^)]*\bru\b/.test(s)) return false;

  // Remove prior incomplete beam-ru for rebuild of missing only
  const needed = new Set();
  for (const m of s.matchAll(/locale\.register\([^,]+,\s*\{([^}]*)\}\)/g)) {
    const inner = m[1];
    if (/\ben\s*,\s*ru\b/.test(inner) || /\bru\s*,\s*en\b/.test(inner)) needed.add("ru");
    for (const nm of inner.matchAll(/\bru:\s*(ru(?:\$\d+)?)/g)) needed.add(nm[1]);
  }
  if (!needed.size && /\{ en, ru \}/.test(s)) needed.add("ru");

  let changed = false;
  for (const ruName of needed) {
    if (new RegExp(`\\bconst ${ruName}\\s*=`).test(s)) continue;
    const enName = ruName.replace(/^ru/, "en");
    const em = [...s.matchAll(new RegExp(`const ${enName}\\s*=\\s*\\{`, "g"))];
    if (!em.length) continue;

    let best = null;
    for (const match of em) {
      const lit = extractObjectLiteral(s, match.index + match[0].length - 1);
      if (!lit || lit.length < 40) continue;
      const obj = extractStringPairs(lit);
      if (Object.keys(obj).length < 3) continue;
      if (!best || Object.keys(obj).length > Object.keys(best.obj).length) {
        best = { match, lit, obj };
      }
    }
    if (!best) continue;

    const ruObj = translateDict(best.obj);
    const json = JSON.stringify(ruObj, null, "\t\t\t");
    const after = best.match.index + best.match[0].length - 1 + best.lit.length;
    s =
      s.slice(0, after) +
      `;\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${json};\n\t\t// #endregion beam-ru` +
      s.slice(after);
    s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
    changed = true;
  }

  if (changed) fs.writeFileSync(file, s);
  return changed;
}

for (const dsh of TREES) {
  console.log("\n===", path.basename(path.dirname(path.dirname(dsh))));
  let n = 0;
  for (const name of fs.readdirSync(dsh)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(dsh, name, "lib", "client.js");
    if (!fs.existsSync(p)) continue;
    if (fixFile(p)) {
      n++;
      const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
      console.log(r.status === 0 ? " ok" : " FAIL", name, r.status !== 0 ? r.stderr.slice(0, 200) : "");
    }
  }
  console.log("fixed", n);

  const missing = [];
  for (const name of fs.readdirSync(dsh)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(dsh, name, "lib", "client.js");
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    if (!/locale\.register\([^)]*\bru\b/.test(s)) continue;
    const needsRu = /\{ en, ru \}/.test(s) || /\bru:\s*ru\b/.test(s);
    if (needsRu && !/\bconst ru\s*=/.test(s)) missing.push(name);
  }
  console.log("still missing shorthand ru", missing);
}
