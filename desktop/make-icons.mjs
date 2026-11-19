import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = "C:/Beam-Agent";
const logo = fs.readFileSync(path.join(ROOT, "logo.svg"));
const outDir = path.join(ROOT, "dist/Beam-Agent/resources");

const png256 = await sharp(logo).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const png64 = await sharp(logo).resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const png32 = await sharp(logo).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

fs.writeFileSync(path.join(outDir, "icon.png"), png256);
fs.writeFileSync(path.join(ROOT, "dist/Beam-Agent/resources/icon.svg"), fs.readFileSync(path.join(ROOT, "logo.svg")));

// Simple ICO: embed 32px PNG (modern Windows accepts PNG-in-ICO)
function pngToIco(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 32; // width
  entry[1] = 32; // height
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, pngBuf]);
}

fs.writeFileSync(path.join(outDir, "tray.ico"), pngToIco(png32));
fs.writeFileSync(path.join(ROOT, "logo-icon-256.png"), png256);
console.log("icons written", png256.length, png64.length, png32.length);
