import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "beam-bootfail-noflicker";
const files = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js"),
];

const old = `if (webBootRecoveries <= 2) wc.reload();
				else if (typeof applicationUrl !== "undefined" && applicationUrl) {
					webBootRecoveries = 0;
					wc.loadURL(String(applicationUrl)).catch(() => { try { wc.reload(); } catch {} });
				} else wc.reload();`;

const neu = `/* ${MARK} */
				if (webBootRecoveries <= 2) wc.reload();
				else { console.warn("desktop web-boot: stop auto-reload to avoid flicker", message); return; }`;

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(MARK)) {
    console.log("already", path.relative(ROOT, file));
    continue;
  }
  if (s.includes(old)) {
    s = s.split(old).join(neu);
    fs.writeFileSync(file, s);
    console.log("patched", path.relative(ROOT, file));
    continue;
  }
  console.warn("miss exact", path.relative(ROOT, file));
}
