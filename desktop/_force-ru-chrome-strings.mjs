import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const TREES = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai"),
];

/** Force user-facing chrome to RU even inside en/zh dicts (Beam RU-first). */
const REPLACES = [
  ['"panel": "Automation tasks"', '"panel": "Задачи автоматизации"'],
  ['"title": "Automation tasks"', '"title": "Задачи автоматизации"'],
  ['"panel": "自动化任务"', '"panel": "Задачи автоматизации"'],
  ['"title": "自动化任务"', '"title": "Задачи автоматизации"'],
  ['"view.chat": "Chat"', '"view.chat": "Чат"'],
  ['"view.chat": "对话"', '"view.chat": "Чат"'],
  ['"view.trajectory": "Trajectory"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Process"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Траектория"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "轨迹"', '"view.trajectory": "Процесс"'],
  ['"tab.preview": "Preview"', '"tab.preview": ""'],
  ['"trigger.fallback": "Select model"', '"trigger.fallback": "Выбрать модель"'],
  ['"trigger.selectAria": "Select model"', '"trigger.selectAria": "Выбрать модель"'],
  ['"trigger.fallback": "选择模型"', '"trigger.fallback": "Выбрать модель"'],
  ['"trigger.selectAria": "选择模型"', '"trigger.selectAria": "Выбрать модель"'],
  ['"preset.workspaceWrite": "Workspace Write"', '"preset.workspaceWrite": "Запись в рабочую область"'],
  ['"preset.workspaceWrite": "工作区写入"', '"preset.workspaceWrite": "Запись в рабочую область"'],
  ['"preset.workspaceWrite": "工作区可写"', '"preset.workspaceWrite": "Запись в рабочую область"'],
  [
    '"placeholder.default": "Message or run a task, / commands, @ files or sessions"',
    '"placeholder.default": "Сообщение или задача, / команды, @ файлы или сессии"',
  ],
  [
    '"placeholder.default": "发消息或创建任务, / 调用指令, @ 文件或对话"',
    '"placeholder.default": "Сообщение или задача, / команды, @ файлы или сессии"',
  ],
  [
    '"placeholder.hero": "描述你想要构建的内容, / 调用指令, @ 文件或对话"',
    '"placeholder.hero": "Опишите, что хотите сделать, / команды, @ файлы или сессии"',
  ],
  ['"session.new": "New Session"', '"session.new": "Новая сессия"'],
  ['"session.new": "新会话"', '"session.new": "Новая сессия"'],
  ['"session.new.label": "New session"', '"session.new.label": "Новая сессия"'],
  ['"session.new.label": "新建会话"', '"session.new.label": "Новая сессия"'],
  ["presetStandardName: \"Standard mode\"", "presetStandardName: \"Стандартный режим\""],
  ["presetStandardName: \"标准模式\"", "presetStandardName: \"Стандартный режим\""],
  ['"Standard mode"', '"Стандартный режим"'],
  ['"标准模式"', '"Стандартный режим"'],
  ['"hero.chooseWorkspace": "选择工作区"', '"hero.chooseWorkspace": "Выбрать рабочую область"'],
  ['"hero.chooseWorkspace": "Choose workspace"', '"hero.chooseWorkspace": "Выбрать рабочую область"'],
  ["DeepSeek Harness", "Beam Agent"],
  ["DeepSeek Account", "ASSISTIX ID"],
];

let files = 0;
for (const tree of TREES) {
  for (const d of fs.readdirSync(tree, { withFileTypes: true })) {
    if (!d.isDirectory() || !d.name.startsWith("dsh-client")) continue;
    const f = path.join(tree, d.name, "lib", "client.js");
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, "utf8");
    const o = s;
    for (const [a, b] of REPLACES) {
      if (s.includes(a)) s = s.split(a).join(b);
    }
    if (s !== o) {
      fs.writeFileSync(f, s);
      files++;
      console.log("patched", d.name);
    }
  }
}
console.log("files", files);
