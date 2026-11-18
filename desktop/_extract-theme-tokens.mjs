import fs from "node:fs";

const c = fs.readFileSync(
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js",
  "utf8"
);
const marker = "var design_platform_css_default = \"";
const start = c.indexOf(marker);
if (start < 0) throw new Error("marker missing");
let i = start + marker.length;
let out = "";
while (i < c.length) {
  const ch = c[i];
  if (ch === "\\" && c[i + 1] === '"') {
    out += '"';
    i += 2;
    continue;
  }
  if (ch === "\\" && c[i + 1] === "n") {
    out += "\n";
    i += 2;
    continue;
  }
  if (ch === '"' && c[i - 1] !== "\\") break;
  out += ch;
  i++;
}

const darkIdx = out.indexOf("body[data-ds-dark-theme]{");
const lightPart = out.slice(0, darkIdx);
const darkPart = out.slice(darkIdx);

function pick(block, keys) {
  const map = {};
  for (const k of keys) {
    const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":([^;}]+)");
    const m = block.match(re);
    if (m) map[k] = m[1];
  }
  return map;
}

const keys = [
  "--dsw-alias-bg-base",
  "--dsw-alias-bg-layer-1",
  "--dsw-alias-bg-layer-2",
  "--dsw-alias-bg-layer-3",
  "--dsw-alias-bg-module",
  "--dsw-alias-bg-module-platform",
  "--dsw-alias-bg-elevated",
  "--dsw-alias-border-l1",
  "--dsw-alias-border-l2",
  "--dsw-alias-border-l3",
  "--dsw-alias-border-l4",
  "--dsw-alias-label-primary",
  "--dsw-alias-label-secondary",
  "--dsw-alias-label-tertiary",
  "--dsw-alias-label-quaternary",
  "--dsw-alias-label-caption",
  "--dsw-alias-interactive-bg-hover",
  "--dsw-alias-interactive-bg-active",
  "--dsw-alias-button-primary-fill",
  "--dsw-alias-button-primary-hover",
  "--dsw-alias-button-secondary-fill",
  "--dsw-alias-button-secondary-hover",
  "--dsw-alias-button-tertiary-fill",
  "--dsw-alias-input-bg",
  "--dsw-alias-input-fill",
  "--dsw-alias-markdown-code-block",
  "--dsw-alias-scrollbar-bg-l1",
  "--dsw-alias-scrollbar-bg-l2",
  "--dsw-menu-surface-fill",
  "--dsw-alias-brand-primary",
  "--dsw-static-neutral-50",
  "--dsw-static-neutral-100",
  "--dsw-static-neutral-200",
  "--dsw-static-neutral-300",
  "--dsw-static-neutral-400",
  "--dsw-static-neutral-500",
  "--dsw-static-neutral-600",
  "--dsw-static-neutral-700",
  "--dsw-static-neutral-800",
  "--dsw-static-neutral-850",
  "--dsw-static-neutral-900",
  "--dsw-static-neutral-950",
  "--dsw-static-neutral-bluish-00",
  "--dsw-static-neutral-bluish-50",
  "--dsw-static-neutral-bluish-100",
  "--dsw-static-neutral-bluish-200",
  "--dsw-static-neutral-bluish-300",
  "--dsw-static-neutral-bluish-400",
  "--dsw-static-neutral-bluish-500",
  "--dsw-static-neutral-bluish-600",
  "--dsw-static-neutral-bluish-700",
  "--dsw-static-neutral-bluish-800",
  "--dsw-static-neutral-bluish-850",
  "--dsw-static-neutral-bluish-900",
  "--dsw-static-neutral-bluish-950",
  "--dsw-static-neutral-bluish-1000",
];

console.log("=== LIGHT body aliases (selected) ===");
console.log(JSON.stringify(pick(lightPart, keys), null, 2));
console.log("=== DARK body aliases (selected) ===");
console.log(JSON.stringify(pick(darkPart, keys), null, 2));

// dump all --dsw-alias-* from dark
const darkAliases = [...darkPart.matchAll(/--dsw-alias-[a-z0-9-]+/g)].map((m) => m[0]);
console.log("dark alias count", new Set(darkAliases).size);
console.log([...new Set(darkAliases)].sort().join("\n"));
