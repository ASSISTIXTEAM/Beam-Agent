import fs from "node:fs";

const files = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-brand-official/locale/zh.json",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-brand-official/locale/en.json",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml",
];

for (const p of files) {
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(/DeepSeek Harness/g, "Beam Agent");
  s = s.replace(/DeepSeek Account/g, "ASSISTIX ID");
  s = s.replace(/DeepSeek Chat/g, "Beam Agent");
  s = s.replace(/DeepSeek V\d+(?:\.\d+)?/g, "Beam Agent");
  // Keep CSS token names and import paths
  s = s.replace(/(?<![-/@])\bDeepSeek\b(?![-/])/g, "ASSISTIX");
  if (s !== before) {
    fs.writeFileSync(p, s);
    console.log("scrubbed", p.split("/").slice(-3).join("/"));
  } else console.log("no change", p.split("/").slice(-3).join("/"));
}
