/**
 * 1) Fix broken locale.register({ en, ru }) where `ru` is undefined → boot crash
 * 2) Scrub DeepSeek / Harness / dsh user-facing strings → ASSISTIX / Beam Agent
 * 3) Soften package ids in fatal error messages
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const DSH = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"
);
const MAIN = path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js");
const WEB_JS = path.join(
  DSH,
  "dsh-web-frontend/dist/assets/index-BXV-oxvX.js"
);
const RUNTIME_DSH = path.join(
  ROOT,
  "runtime/app/dsh/node_modules/@deepseek-ai"
);

function walkClientJs(base) {
  const out = [];
  if (!fs.existsSync(base)) return out;
  for (const pkg of fs.readdirSync(base)) {
    const p = path.join(base, pkg, "lib", "client.js");
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

console.log("1) Fix undefined `ru` in locale.register({ en, ru })");
let fixedRu = 0;
for (const file of [...walkClientJs(DSH), ...walkClientJs(RUNTIME_DSH)]) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("locale.register(")) continue;
  // Any register that references bare `ru` without a const/let/var ru declaration
  const hasBareRuRegister =
    /locale\.register\([^)]*\{\s*[^}]*\bru\b[^}]*\}\)/.test(s) ||
    /locale\.register\([^)]*\{\s*en\s*,\s*ru\s*\}\)/.test(s);
  if (!hasBareRuRegister) continue;
  const declaresRu = /\b(?:const|let|var)\s+ru\b/.test(s);
  if (declaresRu) continue;

  const before = s;
  // Prefer aliasing ru: en when only en/zh exist
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*en\s*,\s*ru\s*\}\)/g,
    "locale.register($1, { en, ru: en })"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*ru\s*,\s*en\s*\}\)/g,
    "locale.register($1, { en, ru: en })"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*,\s*ru\s*\}\)/g,
    "locale.register($1, { en, zh, ru: en })"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*,\s*ru\s*\}\)/g,
    "locale.register($1, { zh, en, ru: en })"
  );
  // Shorthand property lists that mix zh/en with bare ru
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{([^}]*)\}\)/g,
    (full, ns, inner) => {
      if (!/\bru\b/.test(inner) || /\bru\s*:/.test(inner)) return full;
      if (/\b(?:const|let|var)\s+ru\b/.test(s)) return full;
      // rewrite bare `ru` to `ru: en` if en exists, else `ru: zh`
      const alias = /\ben\b/.test(inner) ? "en" : /\bzh\b/.test(inner) ? "zh" : null;
      if (!alias) return full;
      const next = inner.replace(/(^|,)\s*ru\s*(?=,|$)/g, `$1 ru: ${alias}`);
      return `locale.register(${ns}, {${next}})`;
    }
  );

  if (s !== before) {
    fs.writeFileSync(file, s);
    fixedRu++;
    console.log("  fixed", path.relative(ROOT, file));
  }
}
console.log("  total fixed", fixedRu);

console.log("2) Scrub DeepSeek branding in main.js fatal/UI copy");
{
  let s = fs.readFileSync(MAIN, "utf8");
  const before = s;
  const pairs = [
    [/DeepSeek Harness/g, "Beam Agent"],
    [/DeepSeek Account/g, "ASSISTIX ID"],
    [/DeepSeek/g, "ASSISTIX"],
    [/\bDSH instance\b/g, "Beam Agent instance"],
    [/\bdsh web\b/g, "Beam Agent"],
    [/another DSH/gi, "another Beam Agent"],
    [/running DSH/gi, "running Beam Agent"],
    [/Feishu/g, "ASSISTIX ID"],
  ];
  for (const [a, b] of pairs) s = s.replace(a, b);

  // Sanitize package names in fatal dialog text at report time
  if (!s.includes("sanitizeFatalMessage")) {
    s = s.replace(
      "function reportFatal(error, source) {",
      `function sanitizeFatalMessage(text) {
\treturn String(text ?? "")
\t\t.replace(/@deepseek-ai\\//g, "")
\t\t.replace(/\\bdsh-client-ui-/g, "")
\t\t.replace(/\\bdsh-host-/g, "")
\t\t.replace(/\\bdsh-/g, "")
\t\t.replace(/DeepSeek\\s+Harness/gi, "Beam Agent")
\t\t.replace(/DeepSeek/gi, "ASSISTIX")
\t\t.replace(/\\bHarness\\b/g, "Beam Agent");
}
function reportFatal(error, source) {`
    );
    // Wrap message used in dialog — find where error.message is shown
    s = s.replace(
      /reportFatal\(new Error\(message\), "web-boot"\);/,
      'reportFatal(new Error(sanitizeFatalMessage(message)), "web-boot");'
    );
  }

  // Soften startup address-in-use after DeepSeek→ASSISTIX pass
  s = s.replace(
    /startupAddressInUse:\s*"[^"]*"/,
    'startupAddressInUse: "Another Beam Agent instance is already running. Quit the other window, then restart."'
  );

  if (s !== before || s.includes("sanitizeFatalMessage")) {
    fs.writeFileSync(MAIN, s);
    console.log("  main.js updated", s.includes("sanitizeFatalMessage"));
  }
}

console.log("3) Scrub DeepSeek strings in UI client packs + web frontend");
const scrubTargets = [
  ...walkClientJs(DSH),
  ...walkClientJs(RUNTIME_DSH),
  WEB_JS,
  path.join(RUNTIME_DSH, "dsh-web-frontend/dist/assets/index-BXV-oxvX.js"),
].filter((p) => fs.existsSync(p));

let scrubbed = 0;
for (const file of scrubTargets) {
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  s = s.replace(/DeepSeek Harness/g, "Beam Agent");
  s = s.replace(/DeepSeek Account/g, "ASSISTIX ID");
  s = s.replace(/DeepSeek Chat/g, "Beam Agent");
  s = s.replace(/DeepSeek V\d+(?:\.\d+)?/g, "Beam Agent");
  // Keep CSS var names (--dsw-static-deepseek-*) — changing those breaks theme.
  // Only scrub human-readable "DeepSeek" outside of those tokens.
  s = s.replace(/(?<![-/])\bDeepSeek\b(?![-/])/g, "ASSISTIX");
  s = s.replace(/\bdeepseek-harness\b/gi, "beam-agent");
  if (s !== before) {
    fs.writeFileSync(file, s);
    scrubbed++;
  }
}
console.log("  files scrubbed", scrubbed);

// Extra: open-in-app specifically — verify ru fix
{
  const p = path.join(DSH, "dsh-client-ui-open-in-app/lib/client.js");
  const s = fs.readFileSync(p, "utf8");
  console.log(
    "  open-in-app register:",
    (s.match(/locale\.register\(NS,\s*\{[^}]+\}\)/) || [])[0]
  );
  console.log("  has bare ru var?", /\b(?:const|let|var)\s+ru\b/.test(s));
}

console.log("✓ boot fix + rebrand pass done");
