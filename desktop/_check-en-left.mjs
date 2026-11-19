import fs from "fs";
import path from "path";
const root =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai";
for (const pkg of [
  "dsh-client-ui-conversation",
  "dsh-client-ui-schedule",
  "dsh-client-ui-model-selection",
  "dsh-client-ui-permission-presets",
  "dsh-client-ui-agent-preset",
  "dsh-client-ui-trajectory",
  "dsh-client-ui-sidebar",
]) {
  const s = fs.readFileSync(path.join(root, pkg, "lib/client.js"), "utf8");
  const hits = [];
  for (const en of [
    "Automation tasks",
    "Standard mode",
    "Select model",
    "Workspace Write",
    "Message or run a task",
    '"Chat"',
    '"Trajectory"',
    "Build with Beam",
    '"New Session"',
    "DeepSeek Harness",
  ]) {
    if (s.includes(en)) hits.push(en);
  }
  console.log(pkg, hits.join(" | ") || "OK");
}
