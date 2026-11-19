import fs from "node:fs";

const file = "dist/Beam-Agent/resources/app/lib/main.js";
let s = fs.readFileSync(file, "utf8");
const start = s.indexOf("function resolveDesktopLocale(locale)");
const end = s.indexOf("/**", start + 10);
console.log("block:\n", s.slice(start, end));
const fixed = `function resolveDesktopLocale(locale) {
\tconst primary = String(locale || "en").toLowerCase().split(/[-_]/)[0];
\treturn {
\t\tid: primary === "ru" ? "ru" : "en",
\t\tmessages: primary === "ru" ? ru : en
\t};
}
`;
s = s.slice(0, start) + fixed + s.slice(end);
fs.writeFileSync(file, s);
console.log("done", s.includes('messages: primary === "ru" ? ru : en'));
