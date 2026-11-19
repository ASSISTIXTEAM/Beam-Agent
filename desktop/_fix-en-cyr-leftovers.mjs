import fs from "node:fs";

const files = [
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-agent-preset/lib/client.js",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-agent-preset/lib/client.js",
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js",
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
];

const enOnlyPairs = [
  ["Стандартный режим", "Standard mode"],
  ["Свернуть боковую панель", "Collapse sidebar"],
  ["Открыть боковую панель", "Open sidebar"],
  ["Выбрать рабочую область", "Select workspace"],
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  const mark = s.indexOf("// #region beam-ru");
  if (mark < 0) {
    console.log("no ru region", file);
    continue;
  }
  let head = s.slice(0, mark);
  const tail = s.slice(mark);
  let n = 0;
  for (const [a, b] of enOnlyPairs) {
    if (head.includes(a)) {
      head = head.split(a).join(b);
      n++;
    }
  }
  fs.writeFileSync(file, head + tail);
  console.log(file, n);
}
