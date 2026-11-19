/** Patch remaining beam-icons that missed coolicons alias resolution. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DUO = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round");
const FILL = path.join(ROOT, "desktop/_coolicons_svg/package/fill/round");

const FIX = {
  "apps-add": "more-grid",
  "grid-add": "more-grid",
  plugins: "grid",
  workspace: "folder",
  panel: "window-sidebar",
  "panel-left": "window-sidebar",
  "sidebar-left": "window-sidebar",
  "panel-right": "window-sidebar-right",
  "sidebar-right": "window-sidebar-right",
  collapse: "window-sidebar",
  "settings-sliders": "slider-2",
  "sliders-horizontal": "slider-2",
  "new-chat": "chat-plus",
  "chat-plus": "chat-plus",
  "message-plus": "chat-plus",
  mic: "microphone",
  microphone: "microphone",
  lightbulb: "bulb",
  bulb: "bulb",
  maximize: "expand",
  fullscreen: "expand",
  "layout-dashboard": "window",
  dashboard: "window",
  "layout-columns": "window",
  columns: "window",
  split: "window",
  "cloud-up": "cloud-upload",
  "cloud-upload": "cloud-upload",
  limits: "activity",
  gauge: "activity",
  model: "cpu",
  chip: "cpu",
  bot: "robot",
  agent: "robot",
  "chevrons-down": "chevron-down",
  "chevron-double-down": "chevron-down",
  "circle-x": "circle-close",
  "circle-close": "circle-close",
  "circle-alert": "circle-warning",
  "circle-warning": "circle-warning",
  "file-down": "file-download",
  "file-download": "file-download",
  "open-right": "external-link",
  "new-tab": "external-link",
  list: "list-unordered",
  magic: "sparkle",
  "magic-wand": "sparkle",
};

const DIRS = [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons",
].map((p) => path.join(ROOT, p));

let n = 0;
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const [beamName, coolName] of Object.entries(FIX)) {
    const duo = path.join(DUO, `${coolName}.svg`);
    const fill = path.join(FILL, `${coolName}.svg`);
    if (!fs.existsSync(duo)) {
      console.log("missing coolicon", coolName, "for", beamName);
      continue;
    }
    fs.writeFileSync(path.join(dir, "bold", `${beamName}.svg`), fs.readFileSync(duo));
    fs.writeFileSync(
      path.join(dir, "fill", `${beamName}.svg`),
      fs.existsSync(fill) ? fs.readFileSync(fill) : fs.readFileSync(duo)
    );
    n++;
  }
}
console.log("fixed aliases", n);
