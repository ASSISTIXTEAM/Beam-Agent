import fs from "node:fs";

const p =
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js";
const s = fs.readFileSync(p, "utf8");

console.log("register matches:");
for (const m of s.matchAll(/locale\.register\([^;]+;/g)) {
  console.log(" ", m[0].slice(0, 120));
}

console.log("const en =", /\bconst en\s*=/.test(s));
console.log("const ru =", /\bconst ru\s*=/.test(s));
console.log("beam-ru", s.includes("beam-ru"));

const em = [...s.matchAll(/const en\s*=\s*\{/g)];
console.log("en matches", em.length, em.map((m) => m.index));

function extractObjectLiteral(src, startIdx) {
  let i = startIdx,
    depth = 0,
    inStr = null,
    esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

for (const match of em) {
  const lit = extractObjectLiteral(s, match.index + match[0].length - 1);
  console.log("lit len", lit?.length);
  if (!lit) continue;
  try {
    const obj = Function(`"use strict"; return (${lit});`)();
    const vals = Object.values(obj);
    const strRatio = vals.filter((v) => typeof v === "string").length / vals.length;
    console.log("keys", vals.length, "strRatio", strRatio, "sample", Object.keys(obj).slice(0, 8));
  } catch (e) {
    console.log("parse fail", e.message);
    console.log(lit.slice(0, 200));
    console.log("...");
    console.log(lit.slice(-200));
  }
}
