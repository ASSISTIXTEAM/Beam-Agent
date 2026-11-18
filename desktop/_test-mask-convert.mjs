import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require("../dist/Beam Agent/resources/app/beam/node_modules/sharp");

const tmp = path.join(__dirname, "_mask_test");
fs.mkdirSync(tmp, { recursive: true });

const duo = fs.readFileSync(
  path.join(__dirname, "_coolicons_svg/package/duocolor/round/plus.svg"),
  "utf8"
);
const duoBlack = duo.replace(/currentColor/g, "#000000");
fs.writeFileSync(path.join(tmp, "plus-duo.svg"), duoBlack);

const pngBuf = await sharp(Buffer.from(duoBlack), { density: 288 })
  .resize(48, 48)
  .png()
  .toBuffer();
fs.writeFileSync(path.join(tmp, "plus-duo.png"), pngBuf);

const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let opaque = 0;
for (let i = 3; i < data.length; i += 4) if (data[i] > 10) opaque++;
console.log("png", info, "opaquePixels", opaque, "of", info.width * info.height);

const b64 = pngBuf.toString("base64");
const wrap = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image href="data:image/png;base64,${b64}" width="24" height="24"/></svg>`;
fs.writeFileSync(path.join(tmp, "plus-mask.svg"), wrap);
console.log("wrote mask svg bytes", wrap.length);

// Also try chat-plus and settings
for (const name of ["chat-plus", "settings", "window-sidebar", "paper-plane"]) {
  const src = fs
    .readFileSync(path.join(__dirname, `_coolicons_svg/package/duocolor/round/${name}.svg`), "utf8")
    .replace(/currentColor/g, "#000000");
  const buf = await sharp(Buffer.from(src), { density: 288 }).resize(48, 48).png().toBuffer();
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let o = 0;
  for (let i = 3; i < raw.data.length; i += 4) if (raw.data[i] > 10) o++;
  console.log(name, "opaque", o);
}
