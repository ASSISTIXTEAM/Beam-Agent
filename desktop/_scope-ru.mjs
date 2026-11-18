import fs from "node:fs";
const s = fs.readFileSync(
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "utf8"
);
// Find enclosing function of const ru by scanning backwards for function/factory
const ruAt = s.indexOf("\t\tconst ru = {");
console.log("ruAt", ruAt);
const before = s.slice(Math.max(0, ruAt - 5000), ruAt);
// last function ( params )
const funcs = [...before.matchAll(/function\s*(\w*)\s*\(([^)]*)\)\s*\{/g)];
console.log(
  "recent functions",
  funcs.slice(-5).map((m) => ({ name: m[1], params: m[2].slice(0, 120) }))
);
const arrows = [...before.matchAll(/(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g)];
console.log(
  "recent arrows",
  arrows.slice(-5).map((m) => ({ name: m[1], params: m[2].slice(0, 120) }))
);
// factory
const fac = s.indexOf("factory:");
console.log("factory snippet", s.slice(fac, fac + 200));

// Check if zh/en/ru are inside an object literal somehow
let depth = 0;
let inS = null;
let esc = false;
const start = s.indexOf("//#region lib/types/client/locales.js");
for (let i = start; i < ruAt; i++) {
  const c = s[i];
  if (inS) {
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === inS) inS = null;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") {
    inS = c;
    continue;
  }
  if (c === "{") depth++;
  if (c === "}") depth--;
}
console.log("brace depth at const ru relative to locales region start", depth);

// Try acorn-free: rename to ruDict and fix register
let fixed = s.replace("\t\tconst ru = {", "\t\tconst ruDict = {");
fixed = fixed.replace(
  'ctx.locale.register(NS, { en, ru })',
  "ctx.locale.register(NS, { en, ru: ruDict })"
);
// also fix endregion glue
fixed = fixed.replace("// #endregion beam-ru;", "// #endregion beam-ru");
fs.writeFileSync(
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  fixed
);
const { spawnSync } = await import("node:child_process");
const r = spawnSync(process.execPath, ["--check", "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js"], {
  encoding: "utf8",
});
console.log("check", r.status, r.stderr?.slice(0, 300));
