import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-trajectory/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-trajectory/lib/client.js",
];
const pairs = [
  ['"toolbar.aria": "Process toolbar"', '"toolbar.aria": "Панель процесса"'],
  ['"toolbar.search": "Search process"', '"toolbar.search": "Поиск по процессу"'],
  ['"history.loadingTrajectory": "Loading process…"', '"history.loadingTrajectory": "Загрузка процесса…"'],
  ['"timeline.aria": "Process timeline"', '"timeline.aria": "Временная шкала процесса"'],
];
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  const start = s.indexOf("// #region beam-ru");
  const end = s.indexOf("// #endregion beam-ru", start);
  if (start < 0 || end < 0) {
    console.log("no ru region", rel);
    continue;
  }
  let block = s.slice(start, end);
  for (const [a, b] of pairs) block = block.split(a).join(b);
  s = s.slice(0, start) + block + s.slice(end);
  fs.writeFileSync(p, s);
  console.log("ru a11y", rel);
}
