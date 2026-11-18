import fs from "node:fs";

const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js";
let s = fs.readFileSync(p, "utf8");
const pairs = [
  [
    'intro: "Enter your API keys to use models from the following providers."',
    'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
  ],
  [
    'onboardingTitle: "Add an API key to get started"',
    'onboardingTitle: "Sign in with ASSISTIX ID to use Tide, Flare and Pine"',
  ],
  [
    'credentialConfigured: "API key configured"',
    'credentialConfigured: "Connected via ASSISTIX"',
  ],
  [
    'credentialMissing: "API key missing"',
    'credentialMissing: "Sign in with ASSISTIX ID"',
  ],
  ['deepSeekAccount: "DeepSeek Account"', 'deepSeekAccount: "ASSISTIX ID"'],
  ['deepSeekAccount: "ASSISTIX ID"', 'deepSeekAccount: "ASSISTIX ID"'],
];
for (const [a, b] of pairs) s = s.split(a).join(b);
fs.writeFileSync(p, s);
console.log("settings-models patched");
