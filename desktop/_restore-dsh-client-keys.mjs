import fs from "node:fs";
import path from "node:path";

const roots = process.argv.slice(2);
for (const root of roots) {
  let checked = 0;
  let fixed = 0;
  for (const name of fs.readdirSync(root)) {
    const pj = path.join(root, name, "package.json");
    if (!fs.existsSync(pj)) continue;
    checked++;
    const j = JSON.parse(fs.readFileSync(pj, "utf8"));
    let changed = false;
    j.dsh ??= {};
    if (j.beam?.client && !j.dsh.client) {
      j.dsh.client = j.beam.client;
      changed = true;
    }
    if (j.beam?.bundle && !j.dsh.bundle) {
      j.dsh.bundle = j.beam.bundle;
      changed = true;
    }
    if (j.beam?.profile && !j.dsh.profile) {
      j.dsh.profile = j.beam.profile;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(pj, `${JSON.stringify(j, null, 2)}\n`);
      fixed++;
    }
  }
  console.log(root, { checked, fixed });
}
