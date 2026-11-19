/**
 * 1) Kill blank remount flicker (recovery becomes no-op soft log only during grace / forever soft)
 * 2) Rewrite deepseek package ids → assistix in frontend shell so host injections resolve
 * 3) Syntax-check before write
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INDEX_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
].map((p) => path.join(ROOT, p));

const MAIN_FILES = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js"),
];

function check(src, label) {
  const tmp = path.join(ROOT, "desktop", `_tmp_chk_${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  if (r.status !== 0) {
    throw new Error(`${label} parse fail: ${(r.stderr || "").slice(0, 300)}`);
  }
}

function rewriteFrontend(src) {
  let s = src;
  const pairs = [
    ["@deepseek-ai/", "@assistix/"],
    ["dsh-app://", "beam-app://"],
    ['wordmark,"HARNESS"', 'wordmark,"BEAM"'],
    ['wordmark,"DeepSeek"', 'wordmark,"Beam Agent"'],
    ["Loading plugins…", "Loading Beam Agent…"],
    ["Loading plugins...", "Loading Beam Agent..."],
  ];
  // Also common package rename: dsh- → beam- inside @assistix scope only after deepseek rewrite
  // Host uses @assistix/beam-* ; deepseek used @deepseek-ai/dsh-*
  s = s.split("@deepseek-ai/").join("@assistix/");
  s = s.split("dsh-app://").join("beam-app://");
  // Rename dsh-* package suffixes that appear as module ids
  s = s.replace(/@assistix\/dsh-/g, "@assistix/beam-");
  // Bare "dsh-" in static module keys like "dsh-client-..." after scope rewrite may already be beam-
  for (const [a, b] of pairs) {
    if (a === "@deepseek-ai/" || a === "dsh-app://") continue;
    if (s.includes(a)) s = s.split(a).join(b);
  }
  return s;
}

function disableFlickerRemount(mainSrc) {
  const MARK = "beam-no-flicker-remount";
  if (mainSrc.includes(MARK)) return { s: mainSrc, n: 0 };
  let s = mainSrc;
  // Replace remountApplication body to NO-OP after first soft attempt logging — never loadURL storm
  const re = /const remountApplication = \(why\) => \{[\s\S]*?setTimeout\(\(\) => \{[\s\S]*?\}, delay\);\n\t\t\};/;
  if (!re.test(s)) {
    // fallback: neutralize reportFatal blank + neutralize remount loadURL
    if (s.includes("desktop blank-recover:")) {
      s = s.replace(
        /const remountApplication = \(why\) => \{/,
        `const remountApplication = (why) => {\n\t\t\t/* ${MARK} */\n\t\t\tconsole.warn("desktop blank-recover suppressed:", why);\n\t\t\treturn;`,
      );
      return { s, n: 1 };
    }
    return { s, n: 0 };
  }
  s = s.replace(
    re,
    `const remountApplication = (why) => {
			/* ${MARK}: never reload-storm; log only (boot must succeed without flicker) */
			if (quitting || window.isDestroyed()) return;
			console.warn("desktop blank-recover suppressed:", why);
		};`,
  );
  return { s, n: 1 };
}

const report = { index: [], main: [] };

for (const file of INDEX_FILES) {
  if (!fs.existsSync(file)) {
    report.index.push({ file: path.relative(ROOT, file), status: "missing" });
    continue;
  }
  const before = fs.readFileSync(file, "utf8");
  const after = rewriteFrontend(before);
  check(after, path.relative(ROOT, file));
  const deepBefore = (before.match(/@deepseek-ai\//g) || []).length;
  const deepAfter = (after.match(/@deepseek-ai\//g) || []).length;
  const asstAfter = (after.match(/@assistix\//g) || []).length;
  if (after !== before) fs.writeFileSync(file, after);
  report.index.push({
    file: path.relative(ROOT, file),
    status: "ok",
    deepBefore,
    deepAfter,
    assistix: asstAfter,
    bytes: Buffer.byteLength(after),
  });
}

for (const file of MAIN_FILES) {
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const { s, n } = disableFlickerRemount(before);
  if (n && s !== before) fs.writeFileSync(file, s);
  report.main.push({ file: path.relative(ROOT, file), patched: n > 0, hasMark: s.includes("beam-no-flicker-remount") });
}

console.log(JSON.stringify(report, null, 2));
