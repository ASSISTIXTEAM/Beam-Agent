import fs from "node:fs";

const idxPath =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";
const s = fs.readFileSync(idxPath, "utf8");

for (const needle of [
  "IconNewChatOutlineRegular",
  "IconAppsAddOutlineRegular",
  "IconPaperPlane",
  "IconSend",
  "IconClip",
  "IconAttach",
  "IconPlus",
  "IconSearch",
  "IconFolder",
  "IconPlug",
  "IconClock",
  "IconRefresh",
]) {
  const i = s.indexOf(needle);
  console.log("\n====", needle, i);
  if (i >= 0) console.log(s.slice(Math.max(0, i - 80), i + 350).replace(/\n/g, " "));
}

// Find SVG icon helper near first Icon export
const i = s.indexOf("function Icon");
console.log("\nfirst function Icon", i);
if (i >= 0) console.log(s.slice(i, i + 600));

// Search for pattern like const IconX = (props) =>
const m = s.match(/IconNewChatOutlineRegular\s*=\s*[^;]{0,400}/);
console.log("\nassign", m && m[0]);

const m2 = s.match(/NewChatOutlineRegular[\s\S]{0,500}/);
console.log("\nnear NewChatOutline", m2 && m2[0].slice(0, 500));
