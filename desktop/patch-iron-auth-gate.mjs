/**
 * Install ASSISTIX ID-only browser OAuth iron gate + RU/EN device-locale copy.
 * Source of truth: desktop/overlays/beam-iron-auth.js
 *
 * Re-run: node desktop/patch-iron-auth-gate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.USERPROFILE || process.env.HOME || "";
const SRC = path.join(ROOT, "desktop", "overlays", "beam-iron-auth.js");
const TAG = '<script src="./assets/beam-iron-auth.js"></script>';

const DISTS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(HOME, "BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(HOME, "AppData/Local/Programs/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
].filter((p) => fs.existsSync(p));

if (!fs.existsSync(SRC)) {
  console.error("missing overlay", SRC);
  process.exit(1);
}

const js = fs.readFileSync(SRC, "utf8");
let n = 0;
for (const dist of DISTS) {
  const assets = path.join(dist, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, "beam-iron-auth.js"), js, "utf8");
  fs.writeFileSync(path.join(dist, "beam-iron-auth.js"), js, "utf8");

  const indexPath = path.join(dist, "index.html");
  if (!fs.existsSync(indexPath)) continue;
  let html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes("beam-iron-auth.js")) {
    if (html.includes('href="./assets/beam-override.css')) {
      html = html.replace(
        /(<link rel="stylesheet" href="\.\/assets\/beam-override\.css[^"]*">)/,
        `$1\n${TAG}`,
      );
    } else if (html.includes("</head>")) {
      html = html.replace("</head>", `${TAG}\n</head>`);
    }
  } else {
    html = html
      .replace(/src="\.\/beam-iron-auth\.js"/g, 'src="./assets/beam-iron-auth.js"')
      .replace(/src="\/beam-iron-auth\.js"/g, 'src="./assets/beam-iron-auth.js"');
  }
  fs.writeFileSync(indexPath, html, "utf8");
  n++;
  console.log("iron-auth →", dist);
}
console.log(`✓ beam-iron-auth installed in ${n} frontend tree(s)`);
