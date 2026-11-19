import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const TREES = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
];

const phrases = [
  ["Into the Unknown", "Собрано в Beam"],
  ["Build with Beam", "Собрано в Beam"],
  ["Open configuration file", "Открыть файл конфигурации"],
  ["Built-in plugins", "Встроенные плагины"],
  ["Agent presets", "Пресеты агента"],
  ["Choose workspace", "Выбрать рабочую область"],
  ["New session", "Новая сессия"],
  ["New chat", "Новый чат"],
  ["Language", "Язык"],
  ["Settings", "Настройки"],
  ["General", "Общие"],
  ["Models", "Лимиты"],
  ["Limits", "Лимиты"],
  ["Workspace", "Рабочая область"],
  ["Sessions", "Сессии"],
  ["Account", "Аккаунт"],
  ["Sign in", "Войти"],
  ["Sign out", "Выйти"],
  ["Search", "Поиск"],
  ["Send", "Отправить"],
  ["Stop", "Стоп"],
  ["Copy", "Копировать"],
  ["Copied", "Скопировано"],
  ["Collapse", "Свернуть"],
  ["Expand", "Развернуть"],
  ["Cancel", "Отмена"],
  ["Close", "Закрыть"],
  ["Save", "Сохранить"],
  ["Delete", "Удалить"],
  ["Edit", "Изменить"],
  ["Retry", "Повторить"],
  ["Loading…", "Загрузка…"],
  ["Theme", "Тема"],
  ["Dark", "Тёмная"],
  ["Light", "Светлая"],
  ["System", "Системная"],
  ["Connected", "Подключено"],
  ["Disconnected", "Отключено"],
  ["Thinking", "Думаю"],
  ["Working…", "Работаю…"],
  ["Please try again", "Попробуйте ещё раз"],
];

function translateValue(v) {
  if (typeof v !== "string") return v;
  let s = v;
  for (const [en, ru] of phrases) if (s.includes(en)) s = s.split(en).join(ru);
  if (s === "Preview") return "";
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

function parseEnDict(literal) {
  try {
    return Function(`"use strict"; return (${literal});`)();
  } catch {
    return null;
  }
}

function fixFile(file) {
  let s = fs.readFileSync(file, "utf8");
  if (!/locale\.register\([^)]*\bru\b/.test(s)) return false;

  // Find which ru names are referenced
  const needed = new Set();
  for (const m of s.matchAll(/locale\.register\([^,]+,\s*\{([^}]*)\}\)/g)) {
    const inner = m[1];
    if (/\bru\b/.test(inner) && !/\bru\s*:/.test(inner)) needed.add("ru");
    for (const nm of inner.matchAll(/\bru:\s*(ru(?:\$\d+)?)/g)) needed.add(nm[1]);
  }

  let changed = false;
  for (const ruName of needed) {
    if (new RegExp(`\\bconst ${ruName}\\s*=`).test(s)) continue;
    const enName = ruName.replace(/^ru/, "en");
    const em = [...s.matchAll(new RegExp(`const ${enName}\\s*=\\s*\\{`, "g"))];
    if (!em.length) {
      // fallback: alias ru = en if en exists
      if (new RegExp(`\\bconst ${enName}\\s*=`).test(s)) {
        const insertAt = s.lastIndexOf(`const ${enName}`);
        // find end of that statement roughly — better extract
        const litStart = s.indexOf("{", s.indexOf(`const ${enName}`));
        const lit = extractObjectLiteral(s, litStart);
        if (!lit) continue;
        const after = litStart + lit.length;
        const obj = parseEnDict(lit);
        if (!obj) {
          // alias
          s =
            s.slice(0, after) +
            `;\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${enName};\n\t\t// #endregion beam-ru` +
            s.slice(after);
          s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
          changed = true;
          continue;
        }
        const ruObj = translateDict(obj);
        const json = JSON.stringify(ruObj, null, "\t\t\t");
        s =
          s.slice(0, after) +
          `;\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${json};\n\t\t// #endregion beam-ru` +
          s.slice(after);
        s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
        changed = true;
      }
      continue;
    }
    // use last large en dict
    let best = null;
    for (const match of em) {
      const lit = extractObjectLiteral(s, match.index + match[0].length - 1);
      if (!lit) continue;
      const obj = parseEnDict(lit);
      if (!obj) continue;
      const vals = Object.values(obj);
      if (!vals.length) continue;
      // allow mostly strings
      const strRatio = vals.filter((v) => typeof v === "string").length / vals.length;
      if (strRatio < 0.8) continue;
      if (!best || lit.length > best.lit.length) best = { match, lit, obj };
    }
    if (!best) continue;
    // stringify only string values; keep others as-is via JSON (drops functions — shouldn't be in locale)
    const clean = {};
    for (const [k, v] of Object.entries(best.obj)) {
      if (typeof v === "string") clean[k] = v;
    }
    const ruObj = translateDict(clean);
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
  console.log("\n===", dsh);
  let n = 0;
  for (const name of fs.readdirSync(dsh)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(dsh, name, "lib", "client.js");
    if (!fs.existsSync(p)) continue;
    if (fixFile(p)) {
      n++;
      console.log(" fixed", name);
      const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
      if (r.status !== 0) console.error("  SYNTAX", r.stderr.slice(0, 300));
    }
  }
  console.log("fixed count", n);

  // report still-missing
  const missing = [];
  for (const name of fs.readdirSync(dsh)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(dsh, name, "lib", "client.js");
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    if (!/locale\.register\([^)]*\bru\b/.test(s)) continue;
    if (!/\bconst ru\b/.test(s) && !/\bconst ru\$/.test(s) && !/\/\/ #region beam-ru/.test(s)) {
      // check named ru vars exist for named registers
      const named = [...s.matchAll(/\bru:\s*(ru(?:\$\d+)?)/g)].map((m) => m[1]);
      const ok = named.length ? named.every((nm) => new RegExp(`\\bconst ${nm}\\s*=`).test(s)) : false;
      if (!ok && !/\bconst ru\s*=/.test(s)) missing.push(name);
    }
  }
  console.log("still missing", missing);
}
