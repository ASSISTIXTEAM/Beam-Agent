import fs from "node:fs";

const files = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-settings-models/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-settings-models/lib/client.js",
];
const pairs = [
  [
    'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
    'intro: "Weekly usage for Tide, Flare, and Pine."',
  ],
  [
    'intro: "填入各提供商的 API 密钥即可使用其模型。"',
    'intro: "Tide、Flare、Pine 的每周用量。"',
  ],
  [
    'deleteDescriptionWithCredential: "Deleting {provider} removes its configuration and stored API key."',
    'deleteDescriptionWithCredential: "Deleting {provider} removes its configuration."',
  ],
  ['keyPlaceholder: "Enter your API key"', 'keyPlaceholder: ""'],
  [
    'keyFallbackMissing: "Env var not detected. Enter an API key, or configure {hint} in your env."',
    'keyFallbackMissing: "Not available."',
  ],
  [
    'keyBlank: "Enter the API key, or leave the field empty to keep the stored one."',
    'keyBlank: ""',
  ],
  [
    'keyBlankNew: "Enter the API key, or leave the field empty if this provider authenticates another way."',
    'keyBlankNew: ""',
  ],
  [
    'keyIllegalCharacters: "This API key is not in a valid format. Please check it."',
    'keyIllegalCharacters: "Invalid value."',
  ],
  ['keyRequired: "Enter an API key to continue."', 'keyRequired: "Continue."'],
];
for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n++;
    }
  }
  fs.writeFileSync(f, s);
  console.log(f, "scrubbed", n);
}

const gens = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js",
];
const gPairs = [
  ['"openDocument": "Open configuration file"', '"openDocument": ""'],
  ['"openDocument": "Открыть файл конфигурации"', '"openDocument": ""'],
  ['"openDocument": "打开配置文件"', '"openDocument": ""'],
  ['"openDocument.error": "Could not open configuration file"', '"openDocument.error": ""'],
  ['"openDocument.error": "Не удалось открыть файл конфигурации"', '"openDocument.error": ""'],
  ['"openDocument.error": "无法打开配置文件"', '"openDocument.error": ""'],
];
for (const f of gens) {
  let s = fs.readFileSync(f, "utf8");
  let n = 0;
  for (const [a, b] of gPairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n++;
    }
  }
  fs.writeFileSync(f, s);
  console.log(f, "openDocument labels", n);
}
