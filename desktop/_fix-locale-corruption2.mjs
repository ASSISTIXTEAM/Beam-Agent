import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-sidebar-documentpreview/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-schedule/lib/client.js",
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-sidebar-documentpreview/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-schedule/lib/client.js",
].map((p) => path.join(ROOT, p));

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  // { : $1,\n  en: ... → {\n  en: ...
  s = s.replace(/\{\s*:\s*\$[0-9]+\s*,/g, "{");
  // leftover compact form
  s = s.replace(/\{\s*:\s*\$[0-9]+\s*,\s*en\s*,\s*ru:\s*(en\$[0-9]+)\s*\}/g, "{ en: $1, ru: $1 }");
  if (s !== orig) {
    fs.writeFileSync(file, s);
    console.log("fixed", path.relative(ROOT, file), (orig.match(/\{\s*:\s*\$/g) || []).length);
  } else {
    console.log("noop", path.relative(ROOT, file));
  }
}

// global leftover scan
for (const base of [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules"),
  path.join(ROOT, "runtime/app/beam/node_modules"),
]) {
  if (!fs.existsSync(base)) continue;
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") stack.push(p);
      } else if (e.name.endsWith(".js")) {
        const t = fs.readFileSync(p, "utf8");
        if (/\{\s*:\s*\$/.test(t)) console.log("STILL", path.relative(ROOT, p));
      }
    }
  }
}
console.log("scan done");
