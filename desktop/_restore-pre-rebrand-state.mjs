/**
 * Restore UI state from RIGHT BEFORE the DSH→Beam Agent rebrand request.
 * Base = Programs-pristine app trees (already robocopied).
 * Then replay coolicons / UX scripts that ran before _rebrand / _nuke.
 * Does NOT run rebrand, nuke, or cutover.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESKTOP = path.join(ROOT, "desktop");

/** Order matters — last successful pre-rebrand pipeline (Nov 19 ~18:00–18:45). */
const STEPS = [
  "_icons-rollback-then-cool.mjs",
  "_fix-guide-hero-compass.mjs",
  "_enlarge-send-icon.mjs",
  "_default-collapse-rightbar.mjs",
  "_swap-folder-open.mjs",
  "_guide-fill-icons.mjs",
  "_fix-empty-icons-now.mjs",
  "_move-folder-split-last.mjs",
  "_split-folder-header-open.mjs",
  "_fix-folder-split-placement.mjs",
  "_repair-cool-inline-braces.mjs",
  "_slash-menu-cool-icons.mjs",
  "_remap-semantic-icons.mjs",
  "_expand-cool-coverage.mjs",
  "_ai-sparkles-target-export.mjs",
  "_bump-access-menu-gap.mjs",
];

const results = [];
for (const name of STEPS) {
  const script = path.join(DESKTOP, name);
  console.log(`\n>>> ${name}`);
  const r = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000,
  });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (out) console.log(out.slice(-1500));
  results.push({
    name,
    code: r.status,
    ok: r.status === 0,
  });
  if (r.status !== 0) {
    console.error(`FAILED ${name} exit=${r.status}`);
    break;
  }
}

const failed = results.filter((x) => !x.ok);
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(results, null, 2));
if (failed.length) process.exit(1);
console.log("pre-rebrand icon/UX pipeline restored");
