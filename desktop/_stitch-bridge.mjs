/**
 * Rebuild bridge/server.js from earliest Write + chronological StrReplace pieces,
 * then run durable patch scripts. Finally overlay modern persona/DSML head from
 * the truncated file (which still has that region intact).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRIDGE = path.join(ROOT, "desktop/bridge/server.js");
const DIST_BRIDGE = path.join(ROOT, "dist/Beam Agent/bridge/server.js");
const PIECES = path.join(ROOT, "desktop/bridge/_pieces");
const TRUNC = path.join(ROOT, "desktop/bridge/server.js"); // currently truncated
const BASE = path.join(ROOT, "desktop/bridge/_pieces/write_004_server.js.txt");

function parsePiece(text) {
  const pathM = text.match(/^PATH:\s*(.+)$/m);
  const oldIdx = text.indexOf("---OLD---\n");
  const newIdx = text.indexOf("---NEW---\n");
  if (oldIdx < 0 || newIdx < 0) return null;
  const old = text.slice(oldIdx + "---OLD---\n".length, newIdx).replace(/\n$/, "");
  const neu = text.slice(newIdx + "---NEW---\n".length).replace(/\n$/, "");
  return { path: pathM?.[1]?.trim() || "", old, neu };
}

// 1) Start from earliest full Write
let s = fs.readFileSync(BASE, "utf8");
console.log("base len", s.length);

// 2) Apply sr_* pieces in numeric order (desktop only)
const pieces = fs
  .readdirSync(PIECES)
  .filter((f) => f.startsWith("sr_"))
  .sort();
let applied = 0;
let skipped = 0;
for (const f of pieces) {
  const parsed = parsePiece(fs.readFileSync(path.join(PIECES, f), "utf8"));
  if (!parsed) continue;
  if (!/desktop[\\/]+bridge[\\/]+server\.js/i.test(parsed.path.replace(/\\/g, "/"))) {
    // allow anyway if path mentions bridge/server
    if (!/bridge[\\/]+server\.js/i.test(parsed.path.replace(/\\/g, "/"))) continue;
  }
  const idx = s.indexOf(parsed.old);
  if (idx < 0) {
    skipped++;
    console.log("skip", f, "old_len", parsed.old.length);
    continue;
  }
  s = s.slice(0, idx) + parsed.neu + s.slice(idx + parsed.old.length);
  applied++;
  console.log("apply", f, "->", s.length);
}
console.log({ applied, skipped, len: s.length });

// Save intermediate before patch scripts
const mid = path.join(ROOT, "desktop/bridge/_stitched_mid.js");
fs.writeFileSync(mid, s);
fs.writeFileSync(BRIDGE, s);

// 3) Run durable patch scripts that target the bridge
const scripts = [
  "desktop/patch-persona.mjs",
  "desktop/patch-quota-auth-hardstop.mjs",
  "desktop/patch-quotas-ux-clarity.mjs",
  "desktop/patch-dsml-tool-leak.mjs",
  "desktop/patch-dsh-ui-branding.mjs",
];
for (const rel of scripts) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.log("missing script", rel);
    continue;
  }
  console.log("run", rel);
  const r = spawnSync(process.execPath, [abs], { cwd: ROOT, encoding: "utf8" });
  console.log("exit", r.status);
  if (r.stdout) console.log(r.stdout.slice(0, 500));
  if (r.stderr) console.log("stderr", r.stderr.slice(0, 400));
}

s = fs.readFileSync(BRIDGE, "utf8");
console.log("after patches", {
  len: s.length,
  hasMAX: s.includes("MAX_OUTPUT_CONTINUES"),
  hasDsml: s.includes("createDsmlStreamGate"),
  hasPersona: s.includes("__BRIDGE_PERSONA"),
  hasLooks: s.includes("function looksTruncated"),
  hasComplete: s.includes("completeWithOutputContinues"),
});

// 4) Overlay truncated head's DSML/persona if stitched is weaker
const trunc = fs.readFileSync(TRUNC, "utf8");
// If we overwrote TRUNC already, re-read from backup snip
const snip = path.join(ROOT, "desktop/bridge/_persona_dsml_snip.js");
if (fs.existsSync(snip) && s.includes("createDsmlStreamGate")) {
  console.log("dsml present after patches — good");
} else if (fs.existsSync(snip)) {
  console.log("injecting persona/dsml snip");
  // Insert snip after OAuth constants if missing
  if (!s.includes("createDsmlStreamGate") && snip) {
    const snipText = fs.readFileSync(snip, "utf8");
    const anchor = 'const OAUTH_REDIRECT = () => `http://127.0.0.1:${PORT}/assistix/callback`';
    const i = s.indexOf(anchor);
    if (i >= 0) {
      const end = i + anchor.length;
      s = s.slice(0, end) + "\n\n" + snipText + s.slice(end);
      fs.writeFileSync(BRIDGE, s);
    }
  }
}

fs.copyFileSync(BRIDGE, DIST_BRIDGE);
console.log("synced dist bridge", fs.statSync(DIST_BRIDGE).size);
