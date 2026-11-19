import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const tree of [
  "runtime/app/dsh/node_modules/@deepseek-ai",
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai",
]) {
  console.log("\n===", tree.includes("runtime") ? "runtime" : "dist");
  let bad = 0;
  for (const name of fs.readdirSync(tree)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(tree, name, "lib/client.js");
    if (!fs.existsSync(p)) continue;
    const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
    if (r.status !== 0) {
      bad++;
      console.log("FAIL", name, (r.stderr || "").split("\n")[0]);
    }
  }
  console.log("failures", bad);

  // critical checks
  const conv = fs.readFileSync(path.join(tree, "dsh-client-ui-conversation/lib/client.js"), "utf8");
  console.log({
    hero: conv.includes("Собрано в Beam"),
    ruDict: conv.includes("const ruDict"),
    register: (conv.match(/locale\.register\(NS,[^)]+\)/) || [])[0],
    previewEmpty: conv.includes('"hero.preview": ""'),
    HeroFishImg: /function HeroFish[\s\S]{0,200}img/.test(conv),
  });
}
