import fs from "node:fs";
for (const f of [
  "dist/Beam Agent/resources/app/lib/main.js",
  "runtime/app/lib/main.js",
]) {
  const s = fs.readFileSync(f, "utf8");
  console.log(f.includes("runtime") ? "runtime" : "dist", {
    constRu: /\bconst ru = \{/.test(s),
    constZh: /\bconst zh = \{/.test(s),
    messagesRu: s.includes('messages: primary === "ru" ? ru : en'),
    fileMenu: s.includes('fileMenu: "Файл"'),
    edit: s.includes('edit: "Правка"'),
    zhRefs: (s.match(/\bzh\b/g) || []).length,
  });
}
