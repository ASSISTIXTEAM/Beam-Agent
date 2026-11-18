import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(import.meta.url)(
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/sharp")
);
const OUT = path.join(ROOT, "desktop/_verify-icons-v4-out");
const bold =
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold";
const names = [
  "settings",
  "user",
  "activity",
  "sun",
  "moon",
  "desktop",
  "cpu",
  "plus",
  "clock",
  "search",
  "paperclip",
  "window-sidebar",
];
const tiles = [];
for (const n of names) {
  const src = path.join(bold, `${n}.png`);
  const { data } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const a = data[i * 4 + 3];
    out[i * 4] = 30;
    out[i * 4 + 1] = 40;
    out[i * 4 + 2] = 38;
    out[i * 4 + 3] = a;
  }
  const icon = await sharp(out, { raw: { width: 64, height: 64, channels: 4 } })
    .png()
    .toBuffer();
  const labelSvg = Buffer.from(
    `<svg width="80" height="20" xmlns="http://www.w3.org/2000/svg"><text x="40" y="14" font-size="9" text-anchor="middle" fill="#334">${n}</text></svg>`
  );
  const card = await sharp({
    create: { width: 80, height: 96, channels: 4, background: { r: 232, g: 242, b: 248, alpha: 1 } },
  })
    .composite([
      { input: icon, left: 8, top: 8 },
      { input: labelSvg, left: 0, top: 74 },
    ])
    .png()
    .toBuffer();
  tiles.push(card);
}
const cols = 4;
const rows = Math.ceil(tiles.length / cols);
const sheet = await sharp({
  create: {
    width: cols * 80,
    height: rows * 96,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite(
    tiles.map((t, i) => ({
      input: t,
      left: (i % cols) * 80,
      top: Math.floor(i / cols) * 96,
    }))
  )
  .png()
  .toBuffer();
fs.writeFileSync(path.join(OUT, "19-mask-sheet.png"), sheet);
console.log("wrote", path.join(OUT, "19-mask-sheet.png"));
