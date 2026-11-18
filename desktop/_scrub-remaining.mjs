import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const TREES = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai"),
];

for (const tree of TREES) {
  // Conversation: force hero + placeholders even in EN (RU-first product)
  const conv = path.join(tree, "dsh-client-ui-conversation/lib/client.js");
  if (fs.existsSync(conv)) {
    let s = fs.readFileSync(conv, "utf8");
    const o = s;
    s = s
      .replaceAll('"hero.headline": "Into the Unknown"', '"hero.headline": "Собрано в Beam"')
      .replaceAll('"hero.headline": "Build with Beam"', '"hero.headline": "Собрано в Beam"')
      .replaceAll('"hero.headline": "探索未至之境"', '"hero.headline": "Собрано в Beam"')
      .replaceAll('"hero.preview": "Preview"', '"hero.preview": ""')
      .replaceAll('"hero.preview": "预览版"', '"hero.preview": ""')
      .replaceAll('"hero.preview": "预览"', '"hero.preview": ""')
      .replaceAll(
        '"placeholder.default": "Message or run a task, / commands, @ files or sessions"',
        '"placeholder.default": "Сообщение или задача, / команды, @ файлы или сессии"'
      )
      .replaceAll('"session.new": "New Session"', '"session.new": "Новая сессия"')
      .replaceAll("DeepSeek Harness", "Beam Agent")
      .replaceAll("DeepSeek Account", "ASSISTIX ID");
    if (s !== o) {
      fs.writeFileSync(conv, s);
      console.log("patched conversation", path.relative(ROOT, conv));
    }
  }

  // Trajectory tab.preview badge text (not document preview feature name in code)
  const traj = path.join(tree, "dsh-client-ui-trajectory/lib/client.js");
  if (fs.existsSync(traj)) {
    let s = fs.readFileSync(traj, "utf8");
    const o = s;
    s = s
      .replaceAll('"tab.preview": "Preview"', '"tab.preview": ""')
      .replaceAll('"view.chat": "Chat"', '"view.chat": "Чат"')
      .replaceAll('"view.trajectory": "Trajectory"', '"view.trajectory": "Процесс"')
      .replaceAll('"view.trajectory": "Process"', '"view.trajectory": "Процесс"')
      .replaceAll('"view.trajectory": "Траектория"', '"view.trajectory": "Процесс"')
      .replaceAll("DeepSeek Harness", "Beam Agent");
    if (s !== o) {
      fs.writeFileSync(traj, s);
      console.log("patched trajectory");
    }
  }

  // Schedule
  const sch = path.join(tree, "dsh-client-ui-schedule/lib/client.js");
  if (fs.existsSync(sch)) {
    let s = fs.readFileSync(sch, "utf8");
    const o = s;
    s = s
      .replaceAll('"panel": "Automation tasks"', '"panel": "Задачи автоматизации"')
      .replaceAll('"title": "Automation tasks"', '"title": "Задачи автоматизации"')
      .replaceAll("DeepSeek Harness", "Beam Agent");
    // Don't wipe every "Preview" word in schedule code comments — only locale values
    s = s.replace(/"tab\.preview": "Preview"/g, '"tab.preview": ""');
    if (s !== o) {
      fs.writeFileSync(sch, s);
      console.log("patched schedule");
    }
  }

  // Locale common brand
  const loc = path.join(tree, "dsh-client-locale/lib/client.js");
  if (fs.existsSync(loc)) {
    let s = fs.readFileSync(loc, "utf8");
    const o = s;
    s = s
      .replaceAll('"brand.localBuild": "DSH Local Build"', '"brand.localBuild": "Собрано в Beam"')
      .replaceAll('"brand.localBuild": "Beam Agent"', '"brand.localBuild": "Собрано в Beam"')
      .replaceAll("DeepSeek Harness", "Beam Agent")
      .replaceAll("DeepSeek Account", "ASSISTIX ID");
    if (s !== o) {
      fs.writeFileSync(loc, s);
      console.log("patched locale");
    }
  }

  // index.js assets — scrub boot title leftovers carefully
  const assets = path.join(tree, "dsh-web-frontend/dist/assets");
  for (const f of fs.readdirSync(assets)) {
    if (!f.endsWith(".js")) continue;
    const p = path.join(assets, f);
    let s = fs.readFileSync(p, "utf8");
    const o = s;
    if (s.includes("DeepSeek Harness") || s.includes("DeepSeek Account")) {
      s = s.split("DeepSeek Harness").join("Beam Agent").split("DeepSeek Account").join("ASSISTIX ID");
      fs.writeFileSync(p, s);
      console.log("scrubbed", f, "delta", s.length - o.length);
    }
  }

  // index.html: ensure title observer present and no user-visible DeepSeek outside regex literals is ok
  const html = path.join(tree, "dsh-web-frontend/dist/index.html");
  let h = fs.readFileSync(html, "utf8");
  // Count occurrences
  const count = (h.match(/DeepSeek Harness/g) || []).length;
  console.log("index DeepSeek Harness count", count, "(expected only in scrub regexes)");
}

console.log("done");
