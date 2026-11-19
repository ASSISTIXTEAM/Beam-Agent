import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = require(path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/sharp"));
const COOL = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round");
const BUST = "settings-nav-about-v2b";

const dirs = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons/bold"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons/bold"),
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons/bold",
];

const htmls = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
];

async function raster(coolName, outPng, size = 64) {
  let svg = fs.readFileSync(path.join(COOL, `${coolName}.svg`), "utf8");
  svg = svg
    .replace(/currentColor/gi, "#000000")
    .replace(/stroke="white"/gi, 'stroke="#000000"')
    .replace(/fill="white"/gi, 'fill="#000000"');
  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
  fs.writeFileSync(outPng, buf);
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let trans = 0;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a === 0) clear++;
    else if (a === 255) opaque++;
    else trans++;
  }
  return { bytes: buf.length, w: info.width, opaque, trans, clear };
}

const names = ["circle-info", "info", "settings", "user", "activity"];
const primary = dirs.find((d) => fs.existsSync(d));
for (const name of names) {
  const dest = path.join(primary, `${name}.png`);
  const stats = await raster(name, dest);
  console.log("gen", name, stats);
  for (const d of dirs) {
    if (!fs.existsSync(d) || d === primary) continue;
    fs.copyFileSync(dest, path.join(d, `${name}.png`));
  }
}

for (const h of htmls) {
  if (!fs.existsSync(h)) continue;
  let html = fs.readFileSync(h, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${BUST}"`
  );
  fs.writeFileSync(h, html);
  console.log("bust", h);
}

// Preview for Read tool
const preview = path.join(ROOT, "desktop/_verify-icons-v4-out/circle-info-preview.png");
fs.copyFileSync(path.join(primary, "circle-info.png"), preview);
console.log("DONE", BUST);
