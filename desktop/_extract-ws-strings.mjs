import fs from "fs";
import path from "path";

const roots = [
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix",
];
const pkgs = [
  "beam-client-ui-workspace",
  "beam-client-ui-conversation",
  "beam-client-ui-sidebar",
  "beam-agent-preset",
  "beam-client-ui-settings-models",
  "beam-client-ui-composer",
];

const re = /"([^"]*(?:workspace|Workspace|рабоч|Workspace)[^"]*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
for (const root of roots) {
  for (const pkg of pkgs) {
    const f = path.join(root, pkg, "lib", "client.js");
    const alt = path.join(root, pkg, "lib", "index.js");
    const file = fs.existsSync(f) ? f : fs.existsSync(alt) ? alt : null;
    if (!file) continue;
    const s = fs.readFileSync(file, "utf8");
    const hits = [];
    let m;
    const seen = new Set();
    while ((m = re.exec(s))) {
      const key = m[1] + " => " + m[2];
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(key);
    }
    // also bare string literals with workspace wording
    for (const lit of s.matchAll(/"(Choose workspace[^"]*|Select workspace[^"]*|Add workspace[^"]*|Loading workspaces[^"]*|Workspace Write[^"]*|Выбрать рабоч[^"]*|Запись в рабоч[^"]*|рабоч[^"]*)"/g)) {
      const k = "LIT " + lit[1];
      if (!seen.has(k)) {
        seen.add(k);
        hits.push(k);
      }
    }
    if (hits.length) {
      console.log("\n==", pkg, "==");
      for (const h of hits.slice(0, 80)) console.log(" ", h);
    }
  }
}
