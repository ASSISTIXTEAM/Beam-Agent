import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const tree of [
  "runtime/app/dsh/node_modules/@deepseek-ai",
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai",
]) {
  const p = path.join(tree, "dsh-client-ui-agent-preset/lib/client.js");
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru })");
  if (/locale\.register\([^)]*\bru\b/.test(s) && !/\bconst ru\s*=/.test(s)) {
    const m = s.match(/const en\s*=\s*\{/);
    if (m) {
      const start = s.indexOf(m[0]);
      // extract lit
      let i = start + m[0].length - 1,
        depth = 0,
        inStr = null,
        esc = false;
      for (; i < s.length; i++) {
        const c = s[i];
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
          if (depth === 0) break;
        }
      }
      const lit = s.slice(start + m[0].length - 1, i + 1);
      let obj = {};
      try {
        obj = Function(`"use strict"; return (${lit});`)();
      } catch {
        const re = /"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
        let mm;
        while ((mm = re.exec(lit))) obj[JSON.parse(`"${mm[1]}"`)] = JSON.parse(`"${mm[2]}"`);
      }
      const ru = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v !== "string") continue;
        ru[k] = v
          .replaceAll("Agent presets", "Пресеты агента")
          .replaceAll("Settings", "Настройки")
          .replaceAll("General", "Общие");
      }
      if (ru.nav) ru.nav = "Пресеты агента";
      const json = JSON.stringify(ru, null, "\t\t\t");
      s =
        s.slice(0, i + 1) +
        `;\n\t\t// #region beam-ru\n\t\tconst ru = ${json};\n\t\t// #endregion beam-ru` +
        s.slice(i + 1);
      s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
    }
  }
  fs.writeFileSync(p, s);
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  console.log(tree.includes("runtime") ? "runtime" : "dist", r.status === 0 ? "ok" : r.stderr.slice(0, 200));
}
