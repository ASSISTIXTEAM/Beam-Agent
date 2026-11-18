import fs from "node:fs";

const files = [
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-app/lib/client.js",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web/lib/index.js",
];

function snippets(data, needle, limit = 8, pad = 160) {
  let from = 0;
  let n = 0;
  while ((from = data.indexOf(needle, from)) >= 0 && n < limit) {
    console.log(`\n[${needle}@${from}]`, data.slice(Math.max(0, from - pad), from + pad).replace(/\s+/g, " "));
    from += needle.length;
    n++;
  }
}

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("MISSING", f);
    continue;
  }
  const d = fs.readFileSync(f, "utf8");
  console.log("\n====", f, "len", d.length);
  for (const k of [
    "buildVersion",
    "brandName",
    "brandMark",
    "brandIdentity",
    "Build with",
    "built with",
    "Preview",
    "Harness",
    "DeepSeek",
    "Beam Agent",
    "logoRow",
  ]) {
    const c = d.split(k).length - 1;
    if (c) console.log(" count", k, c);
  }
}

const sidebar = fs.readFileSync(files[0], "utf8");
snippets(sidebar, "buildVersion");
snippets(sidebar, "brandName");
snippets(sidebar, "brandMark");
snippets(sidebar, "brandIdentity");

// look for i18n keys near brand
const m = sidebar.match(/["'][^"']*(?:brand|build|preview|harness|deepseek|logo)[^"']*["']\s*:\s*["'][^"']+["']/gi);
console.log("\nbrand-ish dict entries", (m || []).slice(0, 40));

// Find JSX that renders buildVersion class
let idx = 0;
let hits = 0;
while ((idx = sidebar.indexOf("buildVersion", idx)) >= 0 && hits < 10) {
  console.log("\nCTX buildVersion", sidebar.slice(Math.max(0, idx - 250), idx + 250).replace(/\s+/g, " "));
  idx += 12;
  hits++;
}
