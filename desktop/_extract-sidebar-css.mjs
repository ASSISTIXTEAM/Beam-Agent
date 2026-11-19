import fs from "node:fs";

const p =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-sidebar/lib/client.js";
const s = fs.readFileSync(p, "utf8");
const m = s.match(/const css = "([^"]+)"/);
if (!m) {
  console.log("no css");
  process.exit(1);
}
const css = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
const parts = css
  .split("}")
  .filter((x) => /titlebar|newSession|toggle|logoRow/i.test(x))
  .map((x) => x + "}");
console.log(parts.join("\n\n"));

// Also dump JSX around openNewSession / titlebar new chat
const idx = s.indexOf("windowsTitlebar && collapsed");
console.log("\n==== nearby JSX ====");
console.log(s.slice(Math.max(0, idx - 200), idx + 1200));
