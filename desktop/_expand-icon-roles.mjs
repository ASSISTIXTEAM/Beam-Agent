/**
 * Expand coolicons V5 coverage for remaining chrome buttons + bump script in HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forcePath = path.join(ROOT, "desktop/_force-icons-v5.mjs");

let src = fs.readFileSync(forcePath, "utf8");

// Expand ROLE_MAP
if (!src.includes("archive:")) {
  src = src.replace(
    `"new-chat": "chat-plus",
  "chat-plus": "chat-plus",
};`,
    `"new-chat": "chat-plus",
  "chat-plus": "chat-plus",
  archive: "archive",
  pin: "pin",
  unpin: "pin",
  collapse: "panel-left",
  expand: "panel-right",
  sidebar: "panel-left",
  options: "more-horizontal",
  "view-options": "more-horizontal",
  "add-project": "folder-plus",
  project: "folder",
  fullscreen: "expand",
  split: "columns",
  "new-tab": "plus",
  limits: "gauge",
  model: "sparkle",
  auto: "sparkle",
  chevron: "chevron-down",
  "open-right": "panel-right",
  "collapse-right": "panel-right",
};`
  );
}

// Expand LABEL_RULES
if (!src.includes("архив|archive")) {
  src = src.replace(
    `/[микрофон|microphone|voice/i, "microphone"],
];`,
    `/[микрофон|microphone|voice/i, "microphone"],
  [/архив|archive/i, "archive"],
  [/закреп|pin session|unpin|откреп/i, "pin"],
  [/свернуть боков|collapse sidebar|collapse left/i, "collapse"],
  [/развернуть боков|expand sidebar|open left/i, "expand"],
  [/параметр|view options|options/i, "options"],
  [/добавить проект|add project|new project/i, "add-project"],
  [/полноэкран|fullscreen/i, "fullscreen"],
  [/раздел|split/i, "split"],
  [/новая вклад|new tab/i, "new-tab"],
  [/лимит|limits|quota/i, "limits"],
  [/модель|model|auto/i, "model"],
  [/правую боков|right sidebar|open right|collapse right/i, "open-right"],
];`
  );
}

// Fix the botched replace if any
src = src.replace(
  `/[микрофон|microphone|voice/i, "microphone"],`,
  `[/микрофон|microphone|voice/i, "microphone"],`
);

fs.writeFileSync(forcePath, src);

// Re-run V5 installer
const r = spawnSync(process.execPath, [forcePath], { cwd: ROOT, encoding: "utf8" });
console.log(r.stdout);
if (r.stderr) console.error(r.stderr);
console.log("exit", r.status);
