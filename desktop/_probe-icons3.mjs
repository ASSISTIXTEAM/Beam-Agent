import fs from "node:fs";

const side =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js";
const s = fs.readFileSync(side, "utf8");

// Dump Icon* usages with surrounding context
const re = /Icon[A-Za-z0-9]+/g;
const seen = new Map();
let m;
while ((m = re.exec(s))) {
  seen.set(m[0], (seen.get(m[0]) || 0) + 1);
}
console.log([...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40));

// Look at panel entry icon rendering
const i = s.indexOf("panelGlyph");
console.log("\npanelGlyph context:\n", s.slice(i - 200, i + 400));

const i2 = s.indexOf("IconPlugin");
console.log("\nIconPlugin:\n", s.slice(Math.max(0, i2 - 100), i2 + 200));

// Conversation composer icons
const conv =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js";
const c = fs.readFileSync(conv, "utf8");
const seen2 = new Map();
let m2;
const re2 = /Icon[A-Za-z0-9]+/g;
while ((m2 = re2.exec(c))) {
  seen2.set(m2[0], (seen2.get(m2[0]) || 0) + 1);
}
console.log("\nconversation icons", [...seen2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50));

// Find send button
for (const needle of ["IconSend", "IconPaperPlane", "IconPaperclip", "IconPlus"]) {
  const j = c.indexOf(needle);
  console.log("\n", needle, j >= 0 ? c.slice(j - 120, j + 180).replace(/\s+/g, " ") : "missing");
}

// Check SVG structure of an icon in index bundle via minified LT function
const idx = fs.readFileSync(
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "utf8"
);
// Find definition of LT= (IconNewChatOutlineRegular)
const assign = idx.match(/LT=([A-Za-z0-9_$]+)/);
console.log("\nLT assign", assign && assign[0]);
// Search for svg jsx factory used by icons - look for strokeWidth near Icon
const svgIcon = idx.match(/strokeWidth:1\.5[\s\S]{0,120}/);
console.log("strokeWidth sample", svgIcon && svgIcon[0]);
const roleImg = idx.match(/role:\"img\"[\s\S]{0,200}/);
console.log("role img", roleImg && roleImg[0]);
