import fs from "node:fs";
import path from "node:path";

const assets =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets";
for (const f of fs.readdirSync(assets)) {
  if (!f.endsWith(".js")) continue;
  const s = fs.readFileSync(path.join(assets, f), "utf8");
  console.log(
    f,
    "IconNewChat",
    (s.match(/IconNewChat/g) || []).length,
    "viewBox",
    (s.match(/viewBox=/g) || []).length,
    "currentColor",
    (s.match(/currentColor/g) || []).length
  );
}

const vendor = fs.readFileSync(path.join(assets, "vendor-DcuzkuQH.js"), "utf8");
const i = vendor.indexOf("IconNewChat");
console.log("vendor IconNewChat", i);
if (i >= 0) console.log(vendor.slice(Math.max(0, i - 120), i + 500));

const idx = fs.readFileSync(path.join(assets, "index-BXV-oxvX.js"), "utf8");
for (const needle of ["IconNewChat", "IconAppsAdd", "IconPaperPlane", "IconSend", "createIcon", "aria-hidden"]) {
  console.log("idx", needle, (idx.match(new RegExp(needle, "g")) || []).length);
}

// Find primitives module in ModuleLoader registry dumps inside any js under dsh
const root =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai";
function walk(dir, depth = 0, acc = []) {
  if (depth > 5) return acc;
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "langs") continue;
      walk(p, depth + 1, acc);
    } else if (e.name.endsWith(".js") && e.name.includes("primitiv")) {
      acc.push(p);
    }
  }
  return acc;
}
console.log("primitiv files", walk(root));

// Search for function that returns svg with path for icons in vendor by looking near "OutlineRegular"
const o = vendor.indexOf("OutlineRegular");
console.log("OutlineRegular", o);
if (o >= 0) console.log(vendor.slice(Math.max(0, o - 200), o + 400));
