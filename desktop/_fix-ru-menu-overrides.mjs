import fs from "node:fs";

const OVERRIDES = {
  application: "Приложение",
  fileMenu: "Файл",
  closePage: "Закрыть страницу или окно",
  aboutMenu: "О Beam Agent",
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
  welcomeTaglineBefore: "Добро пожаловать в ",
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

for (const file of [
  "dist/Beam-Agent/resources/app/lib/main.js",
  "runtime/app/lib/main.js",
]) {
  let s = fs.readFileSync(file, "utf8");
  const marker = "const ru = {";
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.log("no ru", file);
    continue;
  }
  const lit = extractObjectLiteral(s, idx + marker.length - 1);
  const obj = Function(`"use strict"; return (${lit});`)();
  Object.assign(obj, OVERRIDES);
  const json = JSON.stringify(obj, null, "\t");
  s = s.slice(0, idx) + "const ru = " + json + s.slice(idx + marker.length - 1 + lit.length);

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
  else s = s.replace("\t\tmessages: en\n\t};", '\t\tmessages: primary === "ru" ? ru : en\n\t};');

  fs.writeFileSync(file, s);
  console.log(file.includes("runtime") ? "runtime" : "dist", obj.fileMenu, obj.edit, s.includes('messages: primary === "ru" ? ru : en'));
}
