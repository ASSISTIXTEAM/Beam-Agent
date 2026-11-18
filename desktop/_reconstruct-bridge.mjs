/**
 * Reconstruct desktop/bridge/server.js from agent-transcript Read tool results.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRANS = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-Alexa-OneDrive-Documents-Beam-Agent/agent-transcripts",
);
const OUT = path.join(ROOT, "desktop/bridge/_reconstructed_server.js");

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

/** Collect {offset, limit, text} from Read tool results mentioning bridge/server.js */
const chunks = [];
for (const file of walk(TRANS)) {
  const lines = fs.readFileSync(file, "utf8").split(/\n/);
  for (const line of lines) {
    if (!line.includes("bridge") || !line.includes("server.js")) continue;
    // User/assistant tool_use Read requests — remember last read params
    try {
      const j = JSON.parse(line);
      const parts = j?.message?.content;
      if (!Array.isArray(parts)) continue;
      for (const c of parts) {
        if (c?.type === "tool_use" && c.name === "Read") {
          const p = String(c.input?.path || "").replace(/\\/g, "/");
          if (!p.endsWith("desktop/bridge/server.js") && !p.endsWith("dist/Beam Agent/bridge/server.js")) continue;
          // stash request; result comes in next tool message as role tool — not always present in these jsonl
        }
      }
    } catch {}
  }
}

// Cursor agent transcripts usually inline tool results as role=assistant after, OR as separate.
// Also scan compaction markdown for fenced server excerpts with line numbers like "1385|"
const mdRoot = path.join(TRANS, "bd3407fb-79ad-4fe2-8f89-d46b1ceeafbe");
const mdChunks = [];
function walkMd(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkMd(p);
    else if (/\.(md|jsonl)$/.test(e.name)) {
      const text = fs.readFileSync(p, "utf8");
      // numbered dump: "  1385|const ..."
      const re = /(?:^|\n)(?: {0,2})(\d+)\|(.*)/g;
      let m;
      const map = new Map();
      while ((m = re.exec(text))) {
        const n = Number(m[1]);
        if (n > 0 && n < 5000) map.set(n, m[2]);
      }
      if (map.size > 50) mdChunks.push({ file: p, map });
    }
  }
}
walkMd(mdRoot);

// Prefer largest line-map coverage
let best = null;
for (const c of mdChunks) {
  const keys = [...c.map.keys()];
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  const score = c.map.size;
  if (!best || score > best.score) best = { ...c, min, max, score };
}
console.log(
  "md maps",
  mdChunks.length,
  best ? `best ${best.score} lines ${best.min}-${best.max} from ${path.basename(best.file)}` : "none",
);

// Also parse Read tool RESULT blocks from jsonl: often "line 1|..." format inside tool result
const lineMap = new Map();
for (const file of walk(TRANS)) {
  const raw = fs.readFileSync(file, "utf8");
  // Tool results appear as {"role":"tool"...} rarely; more often assistant repeats.
  // Look for path then numbered content in nearby Read outputs embedded as:
  // "     1|/**" style inside JSON strings
  const re = /(?:^|\\n)(?: {0,4})(\d+)\\|([^\\n]*)/g;
  // Better: find sequences mentioning MODELS / callKumo with line numbers from Read
}

// Parse every jsonl for tool result payloads that look like file reads with | line prefix
for (const file of walk(TRANS)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
    if (!line.includes("|") || line.length < 200) continue;
    if (!line.includes("Kumo") && !line.includes("MODELS") && !line.includes("resolveTier") && !line.includes("handleMessages") && !line.includes("callKumo") && !line.includes("anthropicToOpenAI")) continue;
    // unescape JSON string fragments of numbered lines
    const matches = [...line.matchAll(/(\\n|^)(\d{1,4})\\|([^\\]*)/g)];
    if (matches.length < 20) continue;
    for (const m of matches) {
      const n = Number(m[2]);
      const body = m[3];
      if (!n || n > 4000) continue;
      // prefer longer / later content
      const prev = lineMap.get(n);
      if (!prev || body.length >= prev.length) lineMap.set(n, body);
    }
  }
}
console.log("lineMap size", lineMap.size, lineMap.size ? `${Math.min(...lineMap.keys())}-${Math.max(...lineMap.keys())}` : "");

if (best && best.score > lineMap.size) {
  for (const [n, t] of best.map) lineMap.set(n, t);
}

if (lineMap.size < 100) {
  console.log("insufficient reconstruction data; falling back to transcript original");
  const orig = path.join(ROOT, "desktop/bridge/_restored_from_transcript.js");
  fs.copyFileSync(orig, OUT);
  console.log("copied original to", OUT);
  process.exit(0);
}

const max = Math.max(...lineMap.keys());
const lines = [];
let missing = 0;
for (let i = 1; i <= max; i++) {
  if (lineMap.has(i)) lines.push(lineMap.get(i));
  else {
    missing++;
    lines.push("");
  }
}
fs.writeFileSync(OUT, lines.join("\n"));
console.log("wrote", OUT, "lines", max, "missing", missing);
