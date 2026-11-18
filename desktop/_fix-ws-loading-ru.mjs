import fs from "fs";

const files = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@assistix/beam-client-ui-workspace/lib/client.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-workspace/lib/client.js",
];

const pairs = [
  ['"picker.loading": "Loading workspaces…"', '"picker.loading": "Загрузка рабочих областей…"'],
  ['"menu.addWorkspace": "Add workspace…"', '"menu.addWorkspace": "Добавить рабочую область…"'],
  ['"section.workspaces": "Рабочая областьs"', '"section.workspaces": "Рабочие области"'],
  ['"empty.none": "No sessions yet"', '"empty.none": "Пока нет сессий"'],
  ['"draft.workspaceRequired": "Choose a workspace first."', '"draft.workspaceRequired": "Сначала выберите рабочую область."'],
  ['"workspace.add": "Add workspace"', '"workspace.add": "Добавить рабочую область"'],
  [
    '"defaultWorkspace.failed": "Unable to create default workspace. Use Choose workspace to select a folder."',
    '"defaultWorkspace.failed": "Не удалось создать рабочую область по умолчанию. Выберите папку через «Выбрать рабочую область»."',
  ],
  ['"folderError.retry": "Choose again"', '"folderError.retry": "Выбрать снова"'],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const re = /\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru/;
  const m = s.match(re);
  if (!m) {
    console.log("no region", f);
    continue;
  }
  let block = m[0];
  let n = 0;
  for (const [a, b] of pairs) {
    if (block.includes(a)) {
      block = block.split(a).join(b);
      n++;
    }
  }
  block = block.replace(
    /"folderError\.title": "Couldn[’']t open folder"/,
    '"folderError.title": "Не удалось открыть папку"',
  );
  s = s.replace(re, block);
  fs.writeFileSync(f, s);
  console.log("patched", f, "pairs", n);
  for (const line of s.split(/\n/)) {
    if (
      line.includes("picker.loading") ||
      (line.includes("menu.addWorkspace") && line.includes("Добавить")) ||
      line.includes("section.workspaces")
    ) {
      console.log(" ", line.trim());
    }
  }
}
