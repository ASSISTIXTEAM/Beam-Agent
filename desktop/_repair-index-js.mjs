/**
 * Repair shredded index-BXV-oxvX.js (SyntaxError → blank UI → «недоступен»).
 * Cause: naive string replaces turned `\n` inside regex literals into real newlines.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
].map((p) => path.join(ROOT, p));

const GOOD = path.join(
  ROOT,
  "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
);

function sha(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
}

/** Detect illegal real newlines inside /.../ regex literals (short heuristic). */
function countRegexNewlineBreaks(buf) {
  // Pattern: '/' '(' 0x0A   OR   '|' '\\' 'r' 0x0A ')' '/'
  const a = Buffer.from([0x2f, 0x28, 0x0a]); // /(\n
  let n = 0;
  let p = 0;
  while ((p = buf.indexOf(a, p)) !== -1) {
    n++;
    p++;
  }
  return n;
}

/**
 * Surgical fix: restore e.split(/(\n|\r)/) when shattered across lines.
 * Also escape any remaining LF immediately after `/(`.
 */
function surgicalRepair(src) {
  let s = src;
  let ops = 0;

  // Exact observed shatter (LF between ( and |\\r, then LF before )/ )
  const frag = "e.split(/(" + "\n" + "|\\r" + "\n" + ")/)";
  if (s.includes(frag)) {
    s = s.split(frag).join("e.split(/(\\n|\\r)/)");
    ops++;
  }

  // Broader: /(<stuff>\n<stuff>)/ where both sides are short — escape the newline
  s = s.replace(/\/\(([^/\n]{0,20})\n([^/\n]{0,20})\)\//g, (m, a, b) => {
    ops++;
    return `/(\\n${b.startsWith("|") ? b.slice(1) : b})/`.replace(
      `/(\\n${b.startsWith("|") ? b.slice(1) : b})/`,
      `/(\\n|\\r)/`,
    );
  });

  // Simpler broader pass: replace the known broken token sequences
  const known = [
    ["e.split(/(\n|\\r\n)/)", "e.split(/(\\n|\\r)/)"],
    ["e.split(/(\n|\\r)/)", "e.split(/(\\n|\\r)/)"],
  ];
  for (const [a, b] of known) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      ops++;
    }
  }

  return { s, ops };
}

function brandSafe(s) {
  let out = s;
  const pairs = [
    ['wordmark,"HARNESS"', 'wordmark,"BEAM"'],
    ['wordmark,"DeepSeek"', 'wordmark,"Beam Agent"'],
    ["Loading plugins…", "Loading Beam Agent…"],
    ["Loading plugins...", "Loading Beam Agent..."],
    ["dsh-app://", "beam-app://"],
  ];
  for (const [a, b] of pairs) {
    if (out.includes(a)) out = out.split(a).join(b);
  }
  return out;
}

function syntaxCheck(src) {
  const tmp = path.join(ROOT, "desktop", `_tmp_index_check_${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  const err = (r.stderr || r.stdout || "").trim();
  return { ok: r.status === 0, err: err.slice(0, 500) };
}

function inspectBreaks(label, buf) {
  const needle = Buffer.from([0x2f, 0x28, 0x0a]);
  const hits = [];
  let p = 0;
  while ((p = buf.indexOf(needle, p)) !== -1 && hits.length < 8) {
    hits.push(p);
    p++;
  }
  console.log(label, "sha", sha(buf), "bytes", buf.length, "regexLF", hits.length, hits);
  if (hits[0] != null) {
    console.log("  sample", JSON.stringify(buf.toString("utf8", hits[0], hits[0] + 24)));
  }
}

console.log("--- inspect ---");
for (const f of [...TARGETS, GOOD]) {
  if (!fs.existsSync(f)) {
    console.log("MISS", path.relative(ROOT, f));
    continue;
  }
  inspectBreaks(path.relative(ROOT, f), fs.readFileSync(f));
}

if (!fs.existsSync(GOOD)) {
  console.error("No good candidate at", GOOD);
  process.exit(1);
}

const goodBuf = fs.readFileSync(GOOD);
const goodCheck = syntaxCheck(goodBuf.toString("utf8"));
console.log("GOOD parse", goodCheck);

const branded = brandSafe(goodBuf.toString("utf8"));
const brandedCheck = syntaxCheck(branded);
console.log("BRANDED parse", brandedCheck);

if (!brandedCheck.ok) {
  console.error("Branded good source still fails parse — abort");
  process.exit(1);
}

const report = [];
for (const file of TARGETS) {
  if (!fs.existsSync(file)) {
    report.push({ file: path.relative(ROOT, file), status: "missing" });
    continue;
  }
  const before = fs.readFileSync(file);
  const beforeStr = before.toString("utf8");
  const beforeCheck = syntaxCheck(beforeStr);

  let final = beforeStr;
  let mode = "keep";

  if (!beforeCheck.ok || countRegexNewlineBreaks(before) > 0) {
    const surgical = surgicalRepair(beforeStr);
    const surgCheck = syntaxCheck(surgical.s);
    if (surgCheck.ok && countRegexNewlineBreaks(Buffer.from(surgical.s)) === 0) {
      final = brandSafe(surgical.s);
      mode = `surgical:${surgical.ops}`;
    } else {
      // Restore known-good bundle + light brand
      final = branded;
      mode = "restore-_tmp_app";
    }
  }

  const afterCheck = syntaxCheck(final);
  if (!afterCheck.ok) {
    report.push({
      file: path.relative(ROOT, file),
      status: "FAIL",
      mode,
      before: beforeCheck.err,
      after: afterCheck.err,
    });
    continue;
  }

  if (final !== beforeStr) {
    fs.writeFileSync(file, final);
  }
  report.push({
    file: path.relative(ROOT, file),
    status: "ok",
    mode,
    beforeOk: beforeCheck.ok,
    afterOk: afterCheck.ok,
    beforeSha: sha(before),
    afterSha: sha(Buffer.from(final)),
    bytes: Buffer.byteLength(final),
  });
}

console.log("--- report ---");
console.log(JSON.stringify(report, null, 2));
