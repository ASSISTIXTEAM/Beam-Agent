import fs from "fs";

const files = [
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/lib/main.js",
  "C:/Beam-Agent/runtime/app/lib/main.js",
];

/** Map EN desktop chrome → RU inside the `const ru = { ... }` (or `ru = {`) messages object. */
const RU_MENU = [
  ["application: \"Application\"", "application: \"Приложение\""],
  ["fileMenu: \"File\"", "fileMenu: \"Файл\""],
  ["edit: \"Edit\"", "edit: \"Правка\""],
  ["view: \"View\"", "view: \"Вид\""],
  ["window: \"Window\"", "window: \"Окно\""],
  ["help: \"Help\"", "help: \"Справка\""],
  ["menuBar: \"Application menu\"", "menuBar: \"Меню приложения\""],
  ["menuBar: \"Application Menu\"", "menuBar: \"Меню приложения\""],
  ["closePage: \"Close\"", "closePage: \"Закрыть\""],
  ["quitApplication: \"Quit\"", "quitApplication: \"Выйти\""],
  ["exitApplication: \"Exit\"", "exitApplication: \"Выход\""],
  ["openApplication: \"Open\"", "openApplication: \"Открыть\""],
  ["hideApplication: \"Hide\"", "hideApplication: \"Скрыть\""],
  ["hideOtherApplications: \"Hide Others\"", "hideOtherApplications: \"Скрыть остальные\""],
  ["showAllApplications: \"Show All\"", "showAllApplications: \"Показать все\""],
  ["backgroundNoticeConfirm: \"Confirm\"", "backgroundNoticeConfirm: \"Подтвердить\""],
  ["copy: \"Copy\"", "copy: \"Копировать\""],
  ["paste: \"Paste\"", "paste: \"Вставить\""],
  ["cut: \"Cut\"", "cut: \"Вырезать\""],
  ["selectAll: \"Select All\"", "selectAll: \"Выделить всё\""],
  ["undo: \"Undo\"", "undo: \"Отменить\""],
  ["redo: \"Redo\"", "redo: \"Повторить\""],
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");

  // Find ru message dictionary — common patterns
  const patterns = [
    /(?:const|let|var)\s+ru\s*=\s*\{[\s\S]*?\n\};/,
    /ru\s*=\s*\{[\s\S]*?\n\};/,
  ];
  let patched = false;
  for (const re of patterns) {
    if (!re.test(s)) continue;
    s = s.replace(re, (block) => {
      // Only treat as desktop messages if it has application:
      if (!/application:\s*"/.test(block)) return block;
      let b = block;
      let n = 0;
      for (const [a, c] of RU_MENU) {
        if (b.includes(a)) {
          b = b.split(a).join(c);
          n++;
        }
      }
      console.log(file.split("/").slice(-3).join("/"), "ru menu pairs", n);
      patched = n > 0;
      return b;
    });
    break;
  }

  // Fallback: if ru object is huge and regex failed, patch between markers
  if (!patched) {
    const start = s.search(/\nconst ru = \{/);
    const enStart = s.search(/\nconst en = \{/);
    if (start >= 0 && enStart > start) {
      let block = s.slice(start, enStart);
      let n = 0;
      for (const [a, c] of RU_MENU) {
        if (block.includes(a)) {
          block = block.split(a).join(c);
          n++;
        }
      }
      s = s.slice(0, start) + block + s.slice(enStart);
      console.log(file.split("/").slice(-3).join("/"), "slice ru pairs", n);
      patched = n > 0;
    }
  }

  fs.writeFileSync(file, s);

  // Verify
  const out = fs.readFileSync(file, "utf8");
  const m = out.match(/application:\s*"([^"]+)"/g) || [];
  console.log("  application values:", m);
  const e = out.match(/\bedit:\s*"([^"]+)"/g) || [];
  console.log("  edit values:", e.slice(0, 6));
}
