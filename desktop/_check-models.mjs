import fs from "node:fs";

const llm = fs.readFileSync(
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js",
  "utf8"
);
const i = llm.indexOf("DEFAULT_MODELS");
console.log(llm.slice(i, i + 800));
console.log("BASE", llm.includes("127.0.0.1:17865"));

const api = fs.readFileSync(
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-llm-deepseek-api-key/lib/index.js",
  "utf8"
);
console.log(
  "display",
  api.match(/displayName: "[^"]+"/)?.[0],
  api.match(/providerName: "[^"]+"/)?.[0]
);

for (const u of [
  "http://127.0.0.1:17865/models",
  "http://127.0.0.1:17865/anthropic/v1/models",
]) {
  const r = await fetch(u);
  console.log(u, r.status, (await r.text()).slice(0, 300));
}
