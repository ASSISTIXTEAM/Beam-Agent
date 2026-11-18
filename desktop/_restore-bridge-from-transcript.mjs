import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transcript = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-Alexa-OneDrive-Documents-Beam-Agent/agent-transcripts/bd3407fb-79ad-4fe2-8f89-d46b1ceeafbe/bd3407fb-79ad-4fe2-8f89-d46b1ceeafbe.jsonl",
);
const out = path.join(ROOT, "desktop/bridge/_restored_from_transcript.js");

const lines = fs.readFileSync(transcript, "utf8").split(/\n/);
let best = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.includes("bridge") || !line.includes("server.js")) continue;
  if (!line.includes("Write") && !line.includes('"contents"')) continue;
  try {
    const j = JSON.parse(line);
    const parts = j?.message?.content;
    if (!Array.isArray(parts)) continue;
    for (const c of parts) {
      if (c?.type !== "tool_use" || c.name !== "Write") continue;
      const p = String(c.input?.path || "").replace(/\\/g, "/");
      if (!p.endsWith("desktop/bridge/server.js")) continue;
      const contents = c.input?.contents || "";
      if (!best || contents.length > best.len) {
        best = { line: i + 1, len: contents.length, contents };
      }
    }
  } catch {}
}

console.log(best ? `best line ${best.line} len ${best.len}` : "none");
if (best && best.len > 20000) {
  fs.writeFileSync(out, best.contents);
  console.log("wrote", out);
}
