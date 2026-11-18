/**
 * Verify silent auto-continue architecture (bridge + chat UI).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bridge = fs.readFileSync(path.join(ROOT, "desktop/bridge/server.js"), "utf8");
const chat = fs.readFileSync(
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js"),
  "utf8",
);

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

check(bridge.includes("MAX_OUTPUT_CONTINUES"), "bridge MAX_OUTPUT_CONTINUES");
check(bridge.includes("OUTPUT_CONTINUE_PROMPT"), "bridge continue prompt");
check(bridge.includes("createDsmlStreamGate"), "dsml gate");
check(bridge.includes("function looksTruncated"), "looksTruncated");
check(bridge.includes("completeWithOutputContinues(body, tier"), "sync uses completeWithOutputContinues");
check(bridge.includes("pipeOpenAiSseToAnthropic(upstream, res, streamState)"), "stream silent continue loop");
check(bridge.includes("stream_needs_user"), "stream fallback needs_user");
check(bridge.includes("sync_needs_user"), "sync fallback needs_user");
check(bridge.includes("continueFailed"), "continueFailed tracking");
check(bridge.includes("maxTokensCap: 65536"), "raised output caps");
check(!/stopReason = 'end_turn'\s*\n\s*}\s*\n\s*blockIndex = streamState/.test(bridge) || bridge.includes("stream_needs_user"), "does not always hide max_tokens");

// Heuristic unit checks
const start = bridge.indexOf("function looksTruncated");
const marker = "\n  return false\n}";
const end = bridge.indexOf(marker, start) + marker.length;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  "function dsmlPresent(){return false}\n" + bridge.slice(start, end) + "\nthis.looksTruncated=looksTruncated;",
  ctx,
);
check(ctx.looksTruncated("Готово.") === false, "finished prose ok");
check(ctx.looksTruncated("Вывод:") === false, "no false positive on colon heading");
check(ctx.looksTruncated("текст…") === false, "no false positive on ellipsis");
check(ctx.looksTruncated("def foo(") === true, "mid-def truncated");
check(ctx.looksTruncated("```python\nprint(1)") === true, "open fence truncated");

// Chat UI
check(chat.includes("BEAM_SILENT_AUTO_CONTINUE"), "chat silent mark");
check(chat.includes("autoSilent"), "autoSilent prop");
check(chat.includes('phase === "silent"') && chat.includes("return null"), "silent phase hides banner");
check(chat.includes("__beamIsSystemContinuePrompt"), "hide continue bubbles");
check(chat.includes("data-beam-continue"), "manual Continue still present");
check(chat.includes("Продолжить"), "RU Continue label");

console.log(JSON.stringify({ ok: true }, null, 2));
console.log("PASS: silent auto-continue architecture");
