import fs from "node:fs";

const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";
let s = fs.readFileSync(p, "utf8");
const before = (s.match(/HARNESS/g) || []).length;
s = s.split('wordmark,"HARNESS"').join('wordmark,"BEAM"');
s = s.split("wordmark,'HARNESS'").join("wordmark,'BEAM'");
s = s.split("Loading plugins…").join("Loading Beam…");
fs.writeFileSync(p, s);
console.log("HARNESS", before, "→", (s.match(/HARNESS/g) || []).length);
console.log("boot BEAM", s.includes('wordmark,"BEAM"'));
