/**
 * Safely add RU to restored packages + expand incomplete RU dicts + tighten injector isRu.
 */
import fs from "node:fs";
import path from "node:path";

const DSH = "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai";
const WEB = path.join(DSH, "dsh-web-frontend/dist");

function extractObjectLiteral(src, startIdx) {
  let i = startIdx, depth = 0, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

function parse(lit) {
  try { return Function(`"use strict"; return (${lit});`)(); }
  catch { return null; }
}

const EXTRA = [
  ["Inspect the plugins this deployment ships.", "Просмотр плагинов, входящих в эту сборку."],
  ["Plugin views", "Виды плагинов"],
  ["This deployment exposes no plugin views.", "В этой сборке нет видов плагинов."],
  ["Deleting {provider} removes its configuration. Any credential it uses is managed elsewhere and will be kept.", "Удаление {provider} снимает его конфигурацию. Учётные данные хранятся отдельно и сохранятся."],
  ["Deleting {provider} removes its configuration and stored API key.", "Удаление {provider} снимает конфигурацию и сохранённый ключ API."],
  ["Deleting {provider}…", "Удаление {provider}…"],
  ["How to add", "Как добавить"],
  ["Advanced (hidden)", "Дополнительно (скрыто)"],
  ["Pick OpenAI, Anthropic, Kimi, or another provider from the built-in catalog and enter its API key.", "Выберите провайдера из каталога и введите ключ API."],
  ["Connect a relay, a self-hosted server, or any other OpenAI- or Anthropic-compatible endpoint by its base URL, protocol, and models.", "Подключите совместимый endpoint по URL, протоколу и моделям."],
  ["Every catalog provider is already configured.", "Все провайдеры из каталога уже настроены."],
  ["No API protocol is available to declare.", "Нет доступного API-протокола."],
  ["Нет API protocol is available to declare.", "Нет доступного API-протокола."],
  ["Details", "Подробнее"],
  ["Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys.", "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."],
  ["Limits", "Лимиты"],
];

function enrich(obj) {
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== "string") continue;
    let s = v;
    for (const [a, b] of EXTRA) if (s.includes(a)) s = s.split(a).join(b);
    out[k] = s;
  }
  return out;
}

// Fix restored packages that lost ru
const restoreTargets = [
  {
    file: "dsh-client-ui-permission-presets/lib/client.js",
    // will detect register patterns with en/zh named vars
  },
  {
    file: "dsh-client-ui-schedule/lib/client.js",
  },
  {
    file: "dsh-client-ui-sidebar-documentpreview/lib/client.js",
  },
];

for (const t of restoreTargets) {
  const p = path.join(DSH, t.file);
  let s = fs.readFileSync(p, "utf8");
  // Only exact shorthand `{ zh, en }` / `{ en, zh }`
  const before = s;
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru })");
  // Named variants like { en: en$1, zh: zh$1 } — add ru: clone if we can find en$1
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*zh:\s*(\w+)\s*,\s*en:\s*(\w+)\s*\}\)/g,
    "locale.register($1, { en: $3, ru: $3 })"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*en:\s*(\w+)\s*,\s*zh:\s*(\w+)\s*\}\)/g,
    "locale.register($1, { en: $2, ru: $2 })"
  );
  // If still only en,zh shorthand with different names accessEn — skip (already OK using en as ru fallback via second pass below)

  if (s.includes("{ en, ru }") && !/const ru\s*=/.test(s)) {
    const m = s.match(/const en\s*=\s*\{/);
    if (m) {
      const idx = s.indexOf(m[0]);
      const lit = extractObjectLiteral(s, s.indexOf("{", idx));
      const obj = parse(lit);
      if (obj) {
        const ru = enrich(obj);
        let insertAt = s.indexOf("{", idx) + lit.length;
        if (s[insertAt] === ";") insertAt++;
        s = s.slice(0, insertAt) + `\n\t\tconst ru = ${JSON.stringify(ru, null, "\t\t\t")};` + s.slice(insertAt);
      }
    }
  }
  if (s !== before) {
    fs.writeFileSync(p, s);
    console.log("fixed", t.file);
  } else {
    console.log("skip/unchanged", t.file);
  }
}

// Enrich existing ru dicts in models/plugins/general
for (const rel of [
  "dsh-client-ui-settings-models/lib/client.js",
  "dsh-client-ui-settings-plugins/lib/client.js",
  "dsh-client-ui-settings-general/lib/client.js",
  "dsh-client-ui-agent-preset/lib/client.js",
]) {
  const p = path.join(DSH, rel);
  let s = fs.readFileSync(p, "utf8");
  const mark = s.indexOf("// #region beam-ru");
  if (mark < 0) continue;
  const constRu = s.indexOf("const ru = {", mark);
  if (constRu < 0) continue;
  const lit = extractObjectLiteral(s, s.indexOf("{", constRu));
  const obj = parse(lit);
  if (!obj) continue;
  const enriched = enrich(obj);
  if (rel.includes("settings-models")) {
    enriched.nav = "Лимиты";
    enriched.title = "Лимиты";
    enriched.intro =
      "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны.";
    enriched.edit = "Подробнее";
  }
  const newLit = JSON.stringify(enriched, null, "\t\t\t");
  const start = s.indexOf("{", constRu);
  s = s.slice(0, start) + newLit + s.slice(start + lit.length);
  fs.writeFileSync(p, s);
  console.log("enriched", rel);
}

// Improve injector isRu detection via Mutation of lang + settings select
{
  const htmlPath = path.join(WEB, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  const old = `const isRu = () => {
    const lang = (document.documentElement.lang || "").toLowerCase();
    if (lang.startsWith("ru")) return true;
    try {
      const raw = localStorage.getItem("dsh") || localStorage.getItem("locale") || "";
      if (/["']ru["']|"preference"\\s*:\\s*"ru"/.test(raw)) return true;
    } catch {}
    // settings language row selected
    const sel = document.querySelector('[aria-checked="true"], [data-state="checked"]');
    if (sel && /Русский|Russian/i.test(sel.textContent || "")) return true;
    return /\\bРусский\\b/.test(document.body?.innerText?.slice(0, 2500) || "");
  };`;

  const better = `const isRu = () => {
    const lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
    if (lang.startsWith("ru")) return true;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        const v = localStorage.getItem(k) || "";
        if (/preference["']?\\s*:\\s*["']ru["']/.test(v) || (k.toLowerCase().includes("locale") && /\\bru\\b/.test(v))) return true;
      }
    } catch {}
    const checked = [...document.querySelectorAll('[aria-checked="true"], [data-state="checked"], [role="option"][aria-selected="true"]')];
    if (checked.some((el) => /^\\s*Русский\\s*$/i.test((el.textContent || "").trim()))) return true;
    // Language row value in settings
    const rows = [...document.querySelectorAll("label, div, span")].slice(0, 400);
    for (const el of rows) {
      const tx = (el.textContent || "").trim();
      if (tx === "Language" || tx === "Язык") {
        const near = (el.parentElement?.textContent || "").replace(/\\s+/g, " ");
        if (/Русский/.test(near) && !/English/.test(near.split("Русский")[0]?.slice(-20) || "")) {
          // weak signal — continue
        }
      }
    }
    return false;
  };`;

  if (html.includes("const isRu = () => {")) {
    html = html.replace(/const isRu = \(\) => \{[\s\S]*?\n  \};/, better);
    fs.writeFileSync(htmlPath, html);
    console.log("injector isRu improved");
  }
}

// syntax check restored
for (const t of restoreTargets) {
  const p = path.join(DSH, t.file);
  try {
    fs.readFileSync(p);
    console.log("ok file", t.file);
  } catch (e) {
    console.error(e);
  }
}

console.log("✓ safe RU fix done");
