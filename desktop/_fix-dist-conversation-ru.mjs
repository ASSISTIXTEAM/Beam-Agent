import fs from "node:fs";
import { spawnSync } from "node:child_process";

for (const p of [
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
]) {
  let s = fs.readFileSync(p, "utf8");
  // Normalize: prefer const ruDict to avoid collisions with any outer `ru`
  if (s.includes("\t\tconst ru = {") && s.includes("// #region beam-ru")) {
    s = s.replace("\t\tconst ru = {", "\t\tconst ruDict = {");
  }
  s = s.replace("// #endregion beam-ru;", "// #endregion beam-ru");
  s = s.replace(
    /ctx\.locale\.register\(NS,\s*\{\s*en\s*,\s*ru\s*\}\)/g,
    "ctx.locale.register(NS, { en, ru: ruDict })"
  );
  s = s.replace(
    /ctx\.locale\.register\(NS,\s*\{\s*en\s*,\s*ru:\s*ru\s*\}\)/g,
    "ctx.locale.register(NS, { en, ru: ruDict })"
  );
  // If ruDict missing but register wants it, leave for now
  fs.writeFileSync(p, s);
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  console.log(p.split("/").slice(-3).join("/"), r.status === 0 ? "ok" : r.stderr.slice(0, 200));
  console.log(
    " has ruDict",
    s.includes("const ruDict"),
    "register",
    (s.match(/locale\.register\(NS,[^)]+\)/) || [])[0]
  );
}
