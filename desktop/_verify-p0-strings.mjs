import fs from "fs";
import path from "path";

const files = [
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-workspace/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-conversation/lib/client.js",
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-workspace/lib/client.js",
];
const root = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const keys = [
  "picker.loading",
  "menu.addWorkspace",
  "workspace.add",
  "section.workspaces",
  "hero.chooseWorkspace",
  "placeholder.workspace",
  "draft.workspaceRequired",
  "preset.workspaceWrite",
  "session.new",
];
for (const rel of files) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) {
    console.log("MISSING", rel);
    continue;
  }
  const s = fs.readFileSync(f, "utf8");
  console.log("\n==", rel);
  for (const k of keys) {
    const re = new RegExp(`"${k.replace(".", "\\.")}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g");
    const vals = [];
    let m;
    while ((m = re.exec(s))) vals.push(m[1]);
    if (vals.length) console.log(" ", k, "=>", [...new Set(vals)].join(" | "));
  }
  // leftover bad phrases
  for (const bad of [
    "Loading workspaces",
    "Add workspace",
    "Choose workspace",
    "Select workspace",
    "Workspace Write",
    "рабочую область",
    "рабочих областей",
    "Рабочие области",
    "Выбрать рабочую",
  ]) {
    if (s.includes(bad)) console.log("  LEFTOVER:", bad);
  }
}

const css = fs.readFileSync(
  path.join(root, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  "utf8",
);
console.log("\nCSS has P0 new session:", css.includes("BEAM P0: restore New session"));
console.log("CSS has P0 provider hide:", css.includes("BEAM P0: hide third-party"));

const html = fs.readFileSync(
  path.join(root, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  "utf8",
);
console.log("HTML strip strengthened:", html.includes('setProperty("-webkit-mask", "none"'));
console.log("HTML project rewriter:", html.includes("beamRewriteProjectWording"));
console.log("HTML locale bootstrap:", html.includes("beam-locale-bootstrap"));
