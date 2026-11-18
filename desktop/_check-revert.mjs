import fs from "node:fs";

const cssPath =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css";
const htmlPath = cssPath.replace("assets/beam-override.css", "index.html");
const s = fs.readFileSync(cssPath, "utf8");
const h = fs.readFileSync(htmlPath, "utf8");

const re = /opacity:\s*0\s*!important;/g;
let m;
while ((m = re.exec(s))) {
  const i = m.index;
  console.log("---", i);
  console.log(s.slice(Math.max(0, i - 200), i + 30).replace(/\s+/g, " "));
}

console.log({
  cssCoolicons: s.includes("coolicons") || s.includes("data-beam-cool") || /FORCE V/.test(s),
  htmlCoolicons: h.includes("coolicons"),
  override: (h.match(/beam-override\.css[^"]*/) || [])[0] || null,
});

// Also neutralize remaining mask-era svg* opacity:0 on chrome buttons so stock icons show
let out = s;
const before = out.length;
out = out.replace(
  /(button\[aria-label[^\]]*\][^{]*svg \*[^{]*)\{\s*opacity:\s*0\s*!important;?\s*\}/gi,
  "$1{ /* reverted: stock svg visible */ }"
);
out = out.replace(
  /(\[class\*="(?:sendButton|SendButton|attach)"\][^{]*svg \*[^{]*)\{\s*opacity:\s*0\s*!important;?\s*\}/gi,
  "$1{ /* reverted: stock svg visible */ }"
);
if (out !== s) {
  fs.writeFileSync(cssPath, out);
  // mirror to other trees
  for (const p of [
    cssPath.replace("@assistix/beam-web-frontend", "@deepseek-ai/dsh-web-frontend"),
    cssPath.replace("dist/Beam Agent/resources/app", "runtime/app"),
    cssPath
      .replace("dist/Beam Agent/resources/app", "runtime/app")
      .replace("@assistix/beam-web-frontend", "@deepseek-ai/dsh-web-frontend"),
  ]) {
    if (fs.existsSync(p) && p !== cssPath) fs.writeFileSync(p, out);
  }
  console.log("neutralized svg* opacity0", before, "->", out.length);
} else {
  console.log("no aria svg* opacity0 rules to neutralize (or already comments)");
}
