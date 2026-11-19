/**
 * Replace Chinese desktop shell dictionary with Russian and wire resolveDesktopLocale.
 */
import fs from "node:fs";

const files = [
  "dist/Beam-Agent/resources/app/lib/main.js",
  "runtime/app/lib/main.js",
];

const RU_OVERRIDES = {
  application: "Приложение",
  fileMenu: "Файл",
  closePage: "Закрыть страницу или окно",
  aboutMenu: "О Beam Agent",
  aboutProduct: "Beam Agent",
  aboutVersion: "Версия V{version}",
  hideApplication: "Скрыть Beam Agent",
  hideOtherApplications: "Скрыть остальные",
  showAllApplications: "Показать все",
  quitApplication: "Выйти из Beam Agent",
  openApplication: "Открыть Beam Agent",
  quit: "Выйти",
  cancel: "Отмена",
  quitTitle: "Выйти из Beam Agent?",
  quitActiveTasks: "Текущие задачи будут прерваны.",
  quitScheduledTasks: "Пока приложение закрыто, запланированные задачи не выполняются.",
  quitActiveAndScheduledTasks:
    "Текущие задачи будут прерваны, а запланированные не выполнятся, пока приложение закрыто.",
  backgroundNoticeBody: "Задачи продолжат работу. Окно можно открыть снова из системного трея.",
  backgroundNoticeConfirm: "ОК",
  edit: "Правка",
  menuBar: "Меню приложения",
  delete: "Удалить",
  undo: "Отменить",
  redo: "Повторить",
  cut: "Вырезать",
  copy: "Копировать",
  paste: "Вставить",
  selectAll: "Выделить всё",
  startupFailed: "Beam Agent недоступен",
  fatalSummary: "Приложение не удалось запустить или оно неожиданно остановилось.",
  startupAddressInUse:
    "Уже запущен другой экземпляр Beam Agent. Закройте другое окно и перезапустите.",
  diagnosticTruncated: "… Подробности ошибки сокращены.",
  reportWrittenTo: "Диагностический отчёт: {path}",
  startupReinstallAdvice:
    "Если файлы приложения повреждены или отсутствуют, закройте его и переустановите. Задачи хранятся отдельно.",
  exitApplication: "Выйти",
  restartApplication: "Перезапустить",
  recoveryOperationFailed: "Не удалось выполнить восстановление",
  disableThirdPartyPlugins:
    "Отключить сторонние плагины, сохранить патч профиля и перезапустить",
  welcomeTitle: "Beam Agent",
  welcomeBrand: "Beam Agent",
  welcomeTaglineBefore: "Добро пожаловать в ",
  welcomeTaglineBrand: "Beam Agent",
  welcomeTaglineAfter: "",
  welcomeDescription: "ASSISTIX · Beam Agent",
  welcomeAuthStarting: "Открываем вход…",
  welcomeAuthWaiting: "Браузер не открылся автоматически?",
  welcomeAuthWaitingDescription: "Скопируйте ссылку входа и откройте её в браузере.",
  welcomeAuthExchanging: "Завершаем вход…",
  welcomeAuthExpired: "Время входа истекло",
  welcomeAuthExpiredDescription: "Войдите снова, чтобы продолжить",
  welcomeAuthFailed: "Не удалось завершить вход. Попробуйте ещё раз.",
  welcomeAuthCopyLink: "Скопировать ссылку входа",
  welcomeAuthCopied: "Скопировано",
  welcomeAuthCopyFailed: "Не удалось скопировать. Попробуйте снова.",
  welcomeAuthCancel: "Отмена",
  welcomeAuthRetry: "Войти снова",
  welcomeSignIn: "Войти через ASSISTIX ID",
  welcomeApiKey: "Продолжить",
  welcomeKeyTitle: "Вход через ASSISTIX ID",
  welcomeKeyDescription: "Войдите через ASSISTIX ID, чтобы начать работу с Beam Agent",
  welcomeKeyPlaceholder: "Введите ключ API",
  welcomeKeySave: "Сохранить и продолжить",
  welcomeKeyLater: "Настроить позже",
  welcomeKeyBack: "Назад ко входу",
};

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

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");

  // Find Chinese dict after en — typically `const zh = {` with Chinese strings
  let dictName = null;
  let dictStart = -1;
  for (const name of ["zh", "ru", "zhCN", "zh$1"]) {
    const marker = `const ${name} = {`;
    const idx = s.indexOf(marker, s.indexOf("const en = {"));
    if (idx > 0) {
      dictName = name;
      dictStart = idx;
      break;
    }
  }
  if (dictStart < 0) {
    // insert ru after en
    const enMarker = "const en = {";
    const enIdx = s.indexOf(enMarker);
    const lit = extractObjectLiteral(s, enIdx + enMarker.length - 1);
    const after = enIdx + enMarker.length - 1 + lit.length;
    const enObj = Function(`"use strict"; return (${lit});`)();
    const ruObj = { ...enObj, ...RU_OVERRIDES };
    const json = JSON.stringify(ruObj, null, "\t").replace(/\n/g, "\n");
    s = s.slice(0, after) + `;\nconst ru = ${json}` + s.slice(after);
    s = s.replace(/;\s*;\nconst ru/, ";\nconst ru");
    console.log(file, "inserted ru after en");
  } else {
    const marker = `const ${dictName} = {`;
    const lit = extractObjectLiteral(s, dictStart + marker.length - 1);
    const obj = Function(`"use strict"; return (${lit});`)();
    // Start from English keys for completeness
    const enIdx = s.indexOf("const en = {");
    const enLit = extractObjectLiteral(s, enIdx + "const en = {".length - 1);
    const enObj = Function(`"use strict"; return (${enLit});`)();
    const ruObj = { ...enObj, ...obj, ...RU_OVERRIDES };
    // Naturalize remaining Chinese-looking leftovers by keeping EN overrides already in RU_OVERRIDES;
    // for keys still Chinese, fall back to EN
    for (const [k, v] of Object.entries(ruObj)) {
      if (typeof v === "string" && /[\u4e00-\u9fff]/.test(v) && enObj[k]) ruObj[k] = enObj[k];
      if (RU_OVERRIDES[k]) ruObj[k] = RU_OVERRIDES[k];
    }
    const json = JSON.stringify(ruObj, null, "\t");
    s =
      s.slice(0, dictStart) +
      `const ru = ${json}` +
      s.slice(dictStart + marker.length - 1 + lit.length);
    console.log(file, "replaced", dictName, "→ ru");
  }

  const oldResolve = `function resolveDesktopLocale(locale) {
\tconst primary = String(locale || "en").toLowerCase().split(/[-_]/)[0];
\treturn {
\t\tid: primary === "ru" ? "ru" : "en",
\t\tmessages: en
\t};
}`;
  const newResolve = `function resolveDesktopLocale(locale) {
\tconst primary = String(locale || "en").toLowerCase().split(/[-_]/)[0];
\treturn {
\t\tid: primary === "ru" ? "ru" : "en",
\t\tmessages: primary === "ru" ? ru : en
\t};
}`;
  if (s.includes(oldResolve)) s = s.split(oldResolve).join(newResolve);
  else if (s.includes('messages: primary === "ru" ? ru : en')) {
    /* already patched */
  } else {
    s = s.replace("messages: en\n\t};\n}", "messages: primary === \"ru\" ? ru : en\n\t};\n}");
  }

  // Prefer Russian default when no preference matched
  s = s.replace(
    `\treturn resolveDesktopLocale("en");
}`,
    `\treturn resolveDesktopLocale("ru");
}`
  );

  fs.writeFileSync(file, s);
}
console.log("desktop shell RU done");
