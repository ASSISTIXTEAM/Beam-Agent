import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function check(label, cond) {
  console.log(cond ? "OK " : "FAIL ", label);
  return cond;
}

let ok = true;
const css = fs.readFileSync(
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  "utf8",
);
const i = css.indexOf("/* ===== BEAM boot splash ===== */");
const j = css.indexOf("/* ===== BEAM RU chrome");
ok &= check("splash before ru chrome", i >= 0 && j > i);
ok &= check("large mark 112px", css.includes("width: 112px !important"));
ok &= check("hint hidden", /_hint_[\s\S]{0,120}display:\s*none !important/.test(css));
ok &= check("brand #00B3BC", css.includes("--dsh-boot-brand: #00B3BC"));
ok &= check("side limits intact", css.includes("#beam-side-limits"));
ok &= check("profile modal intact", css.includes("#beam-profile-modal") || css.includes(".bpm-panel"));

const html = fs.readFileSync(
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  "utf8",
);
ok &= check("early splash", html.includes("beam-early-splash"));
ok &= check("watchdog remove", html.includes('removeAttribute("data-beam-boot")') && html.includes("el.remove()"));
ok &= check("early before root", html.indexOf("beam-early-splash") < html.indexOf('id="root"'));

const js = fs.readFileSync(
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js"),
  "utf8",
);
ok &= check("ready cap", js.includes("beam-boot-ready-cap"));
ok &= check("wordmark Beam Agent", js.includes('wordmark,"Beam Agent"') || js.includes('Yn(Kn.wordmark,"Beam Agent")'));
ok &= check("empty hint", js.includes('Yn(Kn.hint,"")'));
ok &= check("no Loading Beam Agent copy", !js.includes("Loading Beam Agent"));

const main = fs.readFileSync(path.join(ROOT, "runtime/app/lib/main.js"), "utf8");
ok &= check("ipc cap", main.includes("beam-boot-ipc-cap"));
ok &= check("bootstuck cap", main.includes("beam-bootstuck-cap"));
ok &= check("noflicker", main.includes("beam-bootstuck-noflicker"));
ok &= check("fast delays", main.includes("beam-splash-fast-delays"));
ok &= check("hidden boot selector", main.includes("[data-dsh-boot]:not([hidden])"));
ok &= check("no BEAM_BASE_URL in .env touch", !fs.readFileSync(path.join(ROOT, "desktop/beam-splash-redesign.mjs"), "utf8").includes("BEAM_BASE_URL"));

const fonts = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/fonts/savona/Savona-Semibold.woff2",
);
ok &= check("Savona font present", fs.existsSync(fonts));
ok &= check(
  "mark svg",
  fs.existsSync(
    path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-mark.svg"),
  ),
);

// dist mirrors
for (const rel of [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/lib/main.js",
]) {
  ok &= check("exists " + rel, fs.existsSync(path.join(ROOT, rel)));
}

process.exit(ok ? 0 : 1);
