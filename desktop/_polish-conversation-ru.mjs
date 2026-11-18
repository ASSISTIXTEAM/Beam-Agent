/**
 * Expand conversation ruDict with fuller natural Russian for remaining English values.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const EXTRA = [
  ["describe the objective for a long-running task", "опишите цель долгой задачи"],
  ["goal active — edit / pause / resume / clear", "цель активна — изменить / пауза / продолжить / сбросить"],
  ["Message or run a task, / commands, @ files or sessions", "Сообщение или задача, / команды, @ файлы или сессии"],
  ["Session unavailable", "Сессия недоступна"],
  ["Parent session offline; sending is unavailable but you can still stop the run", "Родительская сессия офлайн; отправка недоступна, но можно остановить выполнение"],
  ["Describe what you want to build, / commands, @ files or sessions", "Опишите, что нужно сделать, / команды, @ файлы или сессии"],
  ["Choose a workspace to start", "Выберите рабочую область, чтобы начать"],
  ["Cmd/Ctrl+Enter steers all queued messages", "Cmd/Ctrl+Enter направляет все сообщения в очереди"],
  ["Add files or run commands", "Добавить файлы или команды"],
  ["File", "Файл"],
  ["Queue message", "В очередь"],
  ["Steer message", "Направить сообщение"],
  ["Pending attachments", "Вложения в ожидании"],
  ["Scroll attachments left", "Прокрутить вложения влево"],
  ["Scroll attachments right", "Прокрутить вложения вправо"],
  ["Drag files or images here to add them", "Перетащите сюда файлы или изображения"],
  ["Image limit: up to {count} images, {size} each", "Лимит изображений: до {count}, по {size}"],
  ["Files and images cannot be added right now", "Сейчас нельзя добавить файлы и изображения"],
  ["Folders can only be added in the desktop app; add individual files in the browser", "Папки можно добавлять только в приложении; в браузере — отдельные файлы"],
  ["Could not obtain the folder path; drag it in again", "Не удалось получить путь к папке; перетащите ещё раз"],
  ["The path contains characters a reference cannot carry; rename it and try again", "В пути есть символы, которые нельзя передать ссылкой; переименуйте и попробуйте снова"],
  ["Pending images", "Изображения в ожидании"],
  ["View original", "Открыть оригинал"],
  ["{label}, click to view original", "{label}, нажмите, чтобы открыть оригинал"],
  ["Remove image {name}", "Удалить изображение {name}"],
  ["Original image", "Оригинал"],
  ["Image", "Изображение"],
  ["Steer queued message", "Направить сообщение из очереди"],
  ["Steering is available only while the agent is running", "Направление доступно только пока агент работает"],
  ["This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.", "Эта сессия уже используется — возможно, другим экземпляром Beam Agent. Закройте другие окна и попробуйте снова."],
  ["Edit failed: this message may have already started sending.", "Не удалось изменить: сообщение, возможно, уже отправляется."],
  ["Removal failed: this message may have already started sending.", "Не удалось удалить: сообщение, возможно, уже отправляется."],
  ["Steering failed. Try again.", "Не удалось направить. Попробуйте снова."],
  ["signal {signal}", "сигнал {signal}"],
  ["exit code {code}", "код выхода {code}"],
  ["no exit code", "без кода выхода"],
  ["Command line {n}", "Команда, строка {n}"],
  ["Running", "Выполняется"],
  ["Failed", "Ошибка"],
  ["Done", "Готово"],
  ["No output", "Нет вывода"],
  ["Collapse output", "Свернуть вывод"],
  ["Expand the remaining {n} output lines", "Развернуть оставшиеся {n} строк"],
  ["Нет output", "Нет вывода"],
  ["Свернуть output", "Свернуть вывод"],
  ["Развернуть the remaining {n} output lines", "Развернуть оставшиеся {n} строк"],
  ["describe your task to generate plan", "опишите задачу, чтобы составить план"],
];

function polish(obj) {
  const out = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v !== "string") continue;
    let s = v;
    for (const [a, b] of EXTRA) if (s.includes(a)) s = s.split(a).join(b);
    if (k === "hero.headline") s = "Собрано в Beam";
    if (k === "hero.preview") s = "";
    out[k] = s;
  }
  return out;
}

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

for (const p of [
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
]) {
  let s = fs.readFileSync(p, "utf8");
  const marker = "const ruDict = {";
  const idx = s.indexOf(marker);
  if (idx < 0) {
    console.log("no ruDict", p);
    continue;
  }
  const lit = extractObjectLiteral(s, idx + marker.length - 1);
  const obj = Function(`"use strict"; return (${lit});`)();
  const polished = polish(obj);
  const json = JSON.stringify(polished, null, "\t\t\t");
  s = s.slice(0, idx) + "const ruDict = " + json + s.slice(idx + marker.length - 1 + lit.length);
  fs.writeFileSync(p, s);
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  console.log(p.includes("runtime") ? "runtime" : "dist", r.status === 0 ? "ok" : r.stderr.slice(0, 200));
  console.log(" hero", polished["hero.headline"], "preview", JSON.stringify(polished["hero.preview"]));
}
