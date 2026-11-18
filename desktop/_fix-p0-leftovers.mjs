import fs from "fs";
import path from "path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const trees = [
  path.join(ROOT, "dist/Beam Agent/resources/app"),
  path.join(ROOT, "runtime/app"),
];

function patchFile(file, pairs) {
  if (!fs.existsSync(file)) return 0;
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      const c = s.split(a).length - 1;
      s = s.split(a).join(b);
      n += c;
    }
  }
  if (n) fs.writeFileSync(file, s);
  return n;
}

for (const tree of trees) {
  // permission presets: ensure RU value
  const presets = path.join(
    tree,
    "beam/node_modules/@assistix/beam-client-ui-permission-presets/lib/client.js",
  );
  let n = patchFile(presets, [
    // broken RU region still Chinese for this key — replace the third occurrence contextually
    ['"preset.workspaceWrite": "工作区内修改"', '"preset.workspaceWrite": "Запись в проект"'],
  ]);
  // Re-fix zh: first occurrence should stay Chinese. Our replace_all made ALL Chinese → RU.
  // Restore zh by rewriting locale.register style if needed — read file structure.
  if (fs.existsSync(presets)) {
    let s = fs.readFileSync(presets, "utf8");
    // Heuristic: zh block usually first. Restore first zh dict occurrence after const zh
    s = s.replace(
      /(const\s+zh\s*=\s*\{[\s\S]*?"preset\.workspaceWrite":\s*)"Запись в проект"/,
      '$1"工作区内修改"',
    );
    // Also zh object inside locale.register({ zh: { ... }})
    s = s.replace(
      /(zh\s*:\s*\{[\s\S]*?"preset\.workspaceWrite":\s*)"Запись в проект"/,
      '$1"工作区内修改"',
    );
    fs.writeFileSync(presets, s);
    console.log("presets patched", path.relative(ROOT, presets), "n=", n);
  }

  // Sidebar: New Chat → New session / Новая сессия
  const sidebar = path.join(
    tree,
    "beam/node_modules/@assistix/beam-client-ui-sidebar/lib/client.js",
  );
  n = patchFile(sidebar, [
    ['"session.new": "New Chat"', '"session.new": "New session"'],
    ['"session.new.label": "New Chat"', '"session.new.label": "New session"'],
    ['"session.new": "Новый чат"', '"session.new": "Новая сессия"'],
    ['"session.new.label": "Новый чат"', '"session.new.label": "Новая сессия"'],
    ['"New Chat"', '"New session"'],
  ]);
  console.log("sidebar", n);

  // Desktop shell menus Application/Edit
  const mainJs = path.join(tree, "lib/main.js");
  if (fs.existsSync(mainJs)) {
    let s = fs.readFileSync(mainJs, "utf8");
    // Show current Application/Edit occurrences near menus
    const hits = [];
    for (const line of s.split(/\n/)) {
      if (/Application|label:\s*"Edit"|label:\s*'Edit'|menu\.application/i.test(line) && /label|submenu|Menu/.test(line)) {
        hits.push(line.trim().slice(0, 160));
      }
    }
    console.log("main menu hits", hits.slice(0, 20));

    // RU desktop menu map if resolveDesktopLocale has Application
    n = patchFile(mainJs, [
      ['Application: "Application"', 'Application: "Приложение"'],
      ['Edit: "Edit"', 'Edit: "Правка"'],
      ['label: "Application"', 'label: "Приложение"'],
      ['label: "Edit"', 'label: "Правка"'],
      ['"menu.application": "Application"', '"menu.application": "Приложение"'],
      ['"menu.edit": "Edit"', '"menu.edit": "Правка"'],
    ]);
    // Also patch ru locale object for desktop shell if present as English leftovers inside ru
    let s2 = fs.readFileSync(mainJs, "utf8");
    // Common pattern: ru: { ..., Application: "Application", Edit: "Edit"
    s2 = s2.replace(
      /(ru\s*:\s*\{[\s\S]{0,2500}?Application:\s*)"Application"/,
      '$1"Приложение"',
    );
    s2 = s2.replace(/(ru\s*:\s*\{[\s\S]{0,2500}?Edit:\s*)"Edit"/, '$1"Правка"');
    s2 = s2.replace(/(ru\s*:\s*\{[\s\S]{0,2500}?View:\s*)"View"/, '$1"Вид"');
    s2 = s2.replace(/(ru\s*:\s*\{[\s\S]{0,2500}?Window:\s*)"Window"/, '$1"Окно"');
    s2 = s2.replace(/(ru\s*:\s*\{[\s\S]{0,2500}?Help:\s*)"Help"/, '$1"Справка"');
    s2 = s2.replace(/(ru\s*:\s*\{[\s\S]{0,2500}?File:\s*)"File"/, '$1"Файл"');
    if (s2 !== fs.readFileSync(mainJs, "utf8")) {
      // already read old — rewrite carefully
    }
    const prev = fs.readFileSync(mainJs, "utf8");
    if (s2 !== prev) {
      fs.writeFileSync(mainJs, s2);
      console.log("mainJs ru menus patched");
    } else {
      console.log("mainJs menu pairs", n);
    }
  }
}

console.log("done leftovers");
