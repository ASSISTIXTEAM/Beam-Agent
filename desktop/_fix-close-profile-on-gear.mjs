import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const files = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
];

const needle =
  'el.querySelector(\'[data-act="settings"]\')?.addEventListener("click", (ev) => {\n' +
  "      ev.preventDefault();\n" +
  "      ev.stopPropagation();\n" +
  "      openAppSettings();\n" +
  "    });";

const replacement =
  'el.querySelector(\'[data-act="settings"]\')?.addEventListener("click", (ev) => {\n' +
  "      ev.preventDefault();\n" +
  "      ev.stopPropagation();\n" +
  "      closeProfileModal();\n" +
  "      openAppSettings();\n" +
  "    });";

for (const rel of files) {
  const p = path.join(ROOT, rel);
  let h = fs.readFileSync(p, "utf8");
  if (h.includes("closeProfileModal();\n      openAppSettings();")) {
    console.log("already", rel);
    continue;
  }
  if (!h.includes(needle)) {
    console.log("miss", rel);
    continue;
  }
  h = h.replace(needle, replacement);
  fs.writeFileSync(p, h);
  console.log("ok", rel);
}

// Also keep patch script in sync for future re-runs
const patch = path.join(ROOT, "desktop/patch-sidebar-profile-foot.mjs");
let ps = fs.readFileSync(patch, "utf8");
if (!ps.includes("closeProfileModal();\n      openAppSettings();")) {
  ps = ps.replace(
    "openAppSettings();\n    });\n    hideNativeMoreControl();",
    "closeProfileModal();\n      openAppSettings();\n    });\n    hideNativeMoreControl();"
  );
  fs.writeFileSync(patch, ps);
  console.log("synced patch script");
}
