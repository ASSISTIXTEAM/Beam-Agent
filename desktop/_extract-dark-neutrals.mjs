import fs from "node:fs";

const c = fs.readFileSync(
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js",
  "utf8"
);
const marker = "var design_platform_css_default = \"";
const start = c.indexOf(marker);
let i = start + marker.length;
let out = "";
while (i < c.length) {
  const ch = c[i];
  if (ch === "\\" && c[i + 1] === '"') {
    out += '"';
    i += 2;
    continue;
  }
  if (ch === '"' && c[i - 1] !== "\\") break;
  out += ch;
  i++;
}

const parts = out.split("body[data-ds-dark-theme]{");
console.log("parts", parts.length, "total len", out.length);
const dark = parts.slice(1).map((p) => p.split("}")[0]).join("\n---\n");
fs.writeFileSync("desktop/_dark-theme-raw.css", dark);
const aliases = [...dark.matchAll(/--([a-z0-9-]+):([^;]+)/g)].map((m) => [m[1], m[2]]);
const interesting = aliases.filter(([k]) =>
  /alias-bg|alias-border|alias-label|alias-button|alias-interactive|alias-markdown|alias-brand|menu-surface|static-neutral|scrollbar/.test(k)
);
for (const [k, v] of interesting) console.log(`--${k}: ${v}`);
