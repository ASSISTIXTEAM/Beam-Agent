import fs from "node:fs";
import path from "node:path";

const roots = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules",
];

let broken = 0;
let checked = 0;
const brokenFiles = [];
for (const root of roots) {
  const stack = [root];
  while (stack.length) {
    const d = stack.pop();
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") stack.push(p);
        continue;
      }
      if (!e.name.endsWith(".js")) continue;
      const s = fs.readFileSync(p, "utf8");
      checked++;
      if (/\{\s*:\s*\$/.test(s)) {
        broken++;
        brokenFiles.push(p);
      }
    }
  }
}

const html =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html";
const h = fs.readFileSync(html, "utf8");
const cssPath = html.replace("index.html", "assets/beam-override.css");
const css = fs.readFileSync(cssPath, "utf8");
const override = h.match(/beam-override\.css\?v=[^"]+/);

console.log(
  JSON.stringify(
    {
      checked,
      broken,
      brokenFiles: brokenFiles.slice(0, 10),
      coolV7: h.includes("__beamCooliconsForceV7"),
      bootKiller: h.includes("beam-boot-hidden-killer"),
      localeBootstrap: h.includes("beam-locale-bootstrap"),
      override: override ? override[0] : null,
      bootHonorHidden: css.includes("BEAM boot must honor hidden"),
      coolForce: (css.match(/FORCE V\d+/) || [])[0] || null,
    },
    null,
    2
  )
);
