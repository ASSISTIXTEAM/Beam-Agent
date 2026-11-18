import fs from "node:fs";

const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-sidebar/lib/client.js";
const s = fs.readFileSync(p, "utf8");
const idx = s.indexOf("SidebarRoot_module_css_default.newSession");
console.log(s.slice(idx - 100, idx + 900));

// IconNewChat artwork
const prim =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js";
const primAlt =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-primitives/lib/index.js";
for (const path of [prim, primAlt]) {
  if (!fs.existsSync(path)) {
    console.log("missing", path);
    continue;
  }
  const t = fs.readFileSync(path, "utf8");
  const i = t.indexOf("IconNewChat");
  console.log("\n====", path, "IconNewChat idx", i);
  if (i >= 0) console.log(t.slice(i, i + 500));
}
