/**
 * Replay chronological StrReplace/Write ops from agent transcripts onto the
 * earliest known bridge/server.js to rebuild a modern copy after truncation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRANS = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-Alexa-OneDrive-Documents-Beam-Agent/agent-transcripts",
);
const basePath = path.join(ROOT, "desktop/bridge/_restored_from_transcript.js");
const outPath = path.join(ROOT, "desktop/bridge/_replayed_server.js");

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

function normPath(p) {
  return String(p || "").replace(/\\/g, "/");
}

function isBridgeServer(p) {
  const n = normPath(p);
  return n.endsWith("desktop/bridge/server.js") || n.endsWith("dist/Beam-Agent/bridge/server.js");
}

const ops = [];
for (const file of walk(TRANS)) {
  const stat = fs.statSync(file);
  const lines = fs.readFileSync(file, "utf8").split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("server.js")) continue;
    if (!line.includes("StrReplace") && !line.includes('"Write"')) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const parts = j?.message?.content;
    if (!Array.isArray(parts)) continue;
    for (const c of parts) {
      if (c?.type !== "tool_use") continue;
      if (!isBridgeServer(c.input?.path)) continue;
      const isDist = normPath(c.input.path).includes("/dist/");
      if (c.name === "StrReplace" && c.input?.old_string && c.input?.new_string) {
        ops.push({
          t: stat.mtimeMs,
          line: i + 1,
          file: path.basename(file),
          kind: "StrReplace",
          isDist,
          old: c.input.old_string,
          neu: c.input.new_string,
          replaceAll: !!c.input.replace_all,
        });
      }
      if (c.name === "Write" && c.input?.contents) {
        ops.push({
          t: stat.mtimeMs,
          line: i + 1,
          file: path.basename(file),
          kind: "Write",
          isDist,
          contents: c.input.contents,
        });
      }
    }
  }
}

ops.sort((a, b) => a.t - b.t || a.line - b.line);
const desktopOps = ops.filter((o) => !o.isDist);
console.log("ops", ops.length, "desktop", desktopOps.length);
console.log(
  "kinds",
  desktopOps.reduce((a, o) => {
    a[o.kind] = (a[o.kind] || 0) + 1;
    return a;
  }, {}),
);

let s = fs.readFileSync(basePath, "utf8");
let applied = 0;
let skipped = 0;
const skipReasons = [];
for (const op of desktopOps) {
  if (op.kind === "Write") {
    if (op.contents.length > Math.max(20_000, s.length * 0.4)) {
      s = op.contents;
      applied++;
    } else {
      skipped++;
      skipReasons.push(`Write short@${op.file}:${op.line}`);
    }
    continue;
  }
  if (op.replaceAll) {
    if (!s.includes(op.old)) {
      skipped++;
      continue;
    }
    s = s.split(op.old).join(op.neu);
    applied++;
    continue;
  }
  const idx = s.indexOf(op.old);
  if (idx < 0) {
    skipped++;
    continue;
  }
  s = s.slice(0, idx) + op.neu + s.slice(idx + op.old.length);
  applied++;
}

const report = {
  applied,
  skipped,
  finalLen: s.length,
  lines: s.split(/\n/).length,
  hasMAX: s.includes("MAX_OUTPUT_CONTINUES"),
  hasLooks: s.includes("function looksTruncated"),
  hasDsml: s.includes("createDsmlStreamGate"),
  hasPersona: s.includes("__BRIDGE_PERSONA"),
  hasContinuePrompt: s.includes("OUTPUT_CONTINUE_PROMPT"),
  hasComplete: s.includes("completeWithOutputContinues"),
  hasPipe: s.includes("pipeOpenAiSseToAnthropic"),
};
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(outPath, s);
console.log("wrote", outPath);
