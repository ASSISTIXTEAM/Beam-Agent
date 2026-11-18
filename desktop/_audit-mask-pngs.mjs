import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(import.meta.url)(
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/sharp")
);

const bold = "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold";
const names = ["settings", "user", "activity", "sun", "moon", "desktop", "cpu", "plus", "clock", "search"];

for (const name of names) {
  const p = path.join(bold, `${name}.png`);
  const img = sharp(p);
  const meta = await img.metadata();
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0, transparent = 0, partial = 0;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a === 0) transparent++;
    else if (a === 255) opaque++;
    else partial++;
  }
  const total = opaque + transparent + partial;
  console.log(name, {
    w: meta.width,
    h: meta.height,
    size: fs.statSync(p).size,
    opaquePct: +(100 * opaque / total).toFixed(2),
    transparentPct: +(100 * transparent / total).toFixed(2),
    partialPct: +(100 * partial / total).toFixed(2),
  });
}

// Also re-raster one coolicon and compare
const cool = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round/settings.svg");
let svg = fs.readFileSync(cool, "utf8");
console.log("cool settings.svg bytes", svg.length, "sample", svg.slice(0, 200));
svg = svg.replace(/currentColor/gi, "#000000");
const buf = await sharp(Buffer.from(svg), { density: 384 })
  .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .png()
  .toBuffer();
fs.writeFileSync(path.join(ROOT, "desktop/_verify-icons-v4-out/settings-reraster.png"), buf);
const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
let opaque = 0, transparent = 0, partial = 0;
for (let i = 3; i < data.length; i += 4) {
  const a = data[i];
  if (a === 0) transparent++;
  else if (a === 255) opaque++;
  else partial++;
}
const total = opaque + transparent + partial;
console.log("reraster", { opaquePct: +(100 * opaque / total).toFixed(2), transparentPct: +(100 * transparent / total).toFixed(2), partialPct: +(100 * partial / total).toFixed(2), size: buf.length });
