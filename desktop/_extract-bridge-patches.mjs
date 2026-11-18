/**
 * Extract large bridge StrReplace new_strings / patch script bodies for reconstruction.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRANS = path.join(
  process.env.USERPROFILE || "",
  ".cursor/projects/c-Users-Alexa-OneDrive-Documents-Beam-Agent/agent-transcripts",
);
const OUT_DIR = path.join(ROOT, "desktop/bridge/_pieces");
fs.mkdirSync(OUT_DIR, { recursive: true });

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(TRANS)) {
  const lines = fs.readFileSync(file, "utf8").split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("server.js") && !line.includes("patch-dsml") && !line.includes("output_continue")) continue;
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
      if (c.name === "StrReplace" && c.input?.new_string && c.input.new_string.length > 1500) {
        const p = String(c.input.path || "");
        if (!p.includes("bridge") && !p.includes("server.js")) continue;
        const name = `sr_${String(++n).padStart(3, "0")}_${path.basename(file)}_${i + 1}.txt`;
        const meta = `PATH: ${p}\nOLD_LEN: ${(c.input.old_string || "").length}\nNEW_LEN: ${c.input.new_string.length}\nFILE: ${path.basename(file)} L${i + 1}\n---OLD---\n${c.input.old_string || ""}\n---NEW---\n${c.input.new_string}\n`;
        fs.writeFileSync(path.join(OUT_DIR, name), meta);
        console.log("wrote", name, c.input.new_string.length);
      }
      if (c.name === "Write" && c.input?.contents && c.input.contents.length > 5000) {
        const p = String(c.input.path || "");
        if (!/patch-.*\.mjs$|bridge.*server\.js$/.test(p.replace(/\\/g, "/"))) continue;
        const name = `write_${String(++n).padStart(3, "0")}_${path.basename(p)}.txt`;
        fs.writeFileSync(path.join(OUT_DIR, name), c.input.contents);
        console.log("wrote", name, c.input.contents.length, p);
      }
    }
  }
}
console.log("pieces", n, "in", OUT_DIR);
