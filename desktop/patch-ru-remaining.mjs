import fs from "node:fs";
import path from "node:path";

const DSH =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai";

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

function parse(lit) {
  try {
    return Function(`"use strict"; return (${lit});`)();
  } catch {
    return null;
  }
}

// agent-preset: ensure const ru exists
{
  const p = path.join(DSH, "dsh-client-ui-agent-preset/lib/client.js");
  let s = fs.readFileSync(p, "utf8");
  if (!/\bconst ru\s*=/.test(s) && s.includes("{ en, ru }")) {
    const nav = s.indexOf('nav: "Agent presets"');
    const enIdx = s.lastIndexOf("const en = {", nav);
    const lit = extractObjectLiteral(s, s.indexOf("{", enIdx));
    const obj = parse(lit) || {};
    const ru = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string") {
        ru[k] = v;
        continue;
      }
      ru[k] = v
        .replaceAll("Agent presets", "Пресеты агента")
        .replaceAll("Settings", "Настройки");
    }
    ru.nav = "Пресеты агента";
    if (ru.title) ru.title = String(ru.title).replaceAll("Agent presets", "Пресеты агента");
    let at = s.indexOf("{", enIdx) + lit.length;
    if (s[at] === ";") at++;
    s =
      s.slice(0, at) +
      "\n\t\tconst ru = " +
      JSON.stringify(ru, null, "\t\t\t") +
      ";" +
      s.slice(at);
    fs.writeFileSync(p, s);
    console.log("agent-preset: added ru");
  } else {
    console.log("agent-preset: ok");
  }
}

// Map remaining named zh/en registers → en + ru(en)
{
  let n = 0;
  for (const name of fs.readdirSync(DSH)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(DSH, name, "lib", "client.js");
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, "utf8");
    const before = s;
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*zh:\s*(\w+)\s*,\s*en:\s*(\w+)\s*\}\)/g,
      "locale.register($1, { en: $3, ru: $3 })"
    );
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*en:\s*(\w+)\s*,\s*zh:\s*(\w+)\s*\}\)/g,
      "locale.register($1, { en: $2, ru: $2 })"
    );
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*\n\s*zh:\s*(\w+)\s*,\s*\n\s*en:\s*(\w+)\s*\n\s*\}\)/g,
      "locale.register($1, { en: $3, ru: $3 })"
    );
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*\n\s*en:\s*(\w+)\s*,\s*\n\s*zh:\s*(\w+)\s*\n\s*\}\)/g,
      "locale.register($1, { en: $2, ru: $2 })"
    );
    if (s !== before) {
      fs.writeFileSync(p, s);
      n++;
      console.log("mapped", name);
    }
  }
  console.log("mapped files", n);
}

// syntax check critical
for (const rel of [
  "dsh-client-ui-agent-preset/lib/client.js",
  "dsh-client-ui-schedule/lib/client.js",
  "dsh-client-ui-permission-presets/lib/client.js",
  "dsh-client-ui-sidebar-documentpreview/lib/client.js",
]) {
  const p = path.join(DSH, rel);
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error("FAIL", rel, r.stderr);
    process.exitCode = 1;
  } else console.log("syntax ok", rel);
}
