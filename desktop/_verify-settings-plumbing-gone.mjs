/**
 * Static + optional CDP verify: Settings should only expose General.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const DIST = path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix");

const mustHide = [
  ["beam-client-ui-settings-models/lib/client.js", "models"],
  ["beam-client-ui-agent-preset/lib/client.js", "agent-presets"],
  ["beam-client-ui-settings-account/lib/client.js", "account"],
  ["beam-client-ui-settings-plugins/lib/client.js", "plugins"],
  ["beam-client-ui-settings-general/lib/client.js", "open-document"],
];

let ok = true;
for (const [rel, id] of mustHide) {
  const p = path.join(DIST, rel);
  const s = fs.readFileSync(p, "utf8");
  const marker = `/* beam-hide-settings ${id} */`;
  if (!s.includes(marker)) {
    console.error("FAIL missing hide marker", id, rel);
    ok = false;
  } else {
    console.log("OK hidden", id);
  }
}

const general = fs.readFileSync(
  path.join(DIST, "beam-client-ui-settings-general/lib/client.js"),
  "utf8"
);
if (!general.includes('id: "general"') || !general.includes('ctx.slots.inject("settings.section"')) {
  console.error("FAIL general section missing");
  ok = false;
} else {
  console.log("OK general still registered");
}

const models = fs.readFileSync(
  path.join(DIST, "beam-client-ui-settings-models/lib/client.js"),
  "utf8"
);
for (const bad of [
  "ASSISTIX ID handles access",
  "no API keys needed",
  "ключи API",
  "Enter your API keys to use models",
]) {
  if (models.includes(bad)) {
    console.error("FAIL models still teaches:", bad);
    ok = false;
  }
}
console.log("OK models teaching copy scrubbed");

const html = fs.readFileSync(
  path.join(DIST, "beam-web-frontend/dist/index.html"),
  "utf8"
);
if (!html.includes("hideSettingsPlumbing")) {
  console.error("FAIL injector missing hideSettingsPlumbing");
  ok = false;
} else {
  console.log("OK injector backup present");
}

// Ensure no live inject for hidden sections remains
for (const [rel, id] of mustHide) {
  if (id === "open-document") continue;
  const s = fs.readFileSync(path.join(DIST, rel), "utf8");
  // After hide, the inject call for that id should be voided — search for active register id near inject
  const re = new RegExp(
    String.raw`ctx\.slots\.inject\("settings\.section"[\s\S]{0,400}?id:\s*"${id}"`
  );
  if (re.test(s)) {
    console.error("FAIL live inject still present for", id);
    ok = false;
  }
}

if (!ok) {
  process.exit(1);
}
console.log("\n✓ Settings plumbing statically verified gone; only General remains");
