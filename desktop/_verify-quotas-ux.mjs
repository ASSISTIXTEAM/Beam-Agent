import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function ok(name, cond, detail = "") {
  checks.push({ name, cond: !!cond, detail });
  console.log((cond ? "OK  " : "FAIL") + " " + name + (detail ? " — " + detail : ""));
}

const html = path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html");
const css = path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css");
const general = path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js");
const chat = path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js");
const bridge = path.join(ROOT, "desktop/bridge/server.js");
const distBridge = path.join(ROOT, "dist/Beam-Agent/bridge/server.js");
const distHtml = path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html");
const distGeneral = path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js");

const h = fs.readFileSync(html, "utf8");
ok("rings used/limit", h.includes('class="bsl-used"') && h.includes("usedOf"));
ok("exhaustHint i18n", h.includes("exhaustHint") && h.includes("resetMonday"));
ok("enhanceLimits used label", h.includes("usedLbl") && h.includes("is-exhausted"));

const c = fs.readFileSync(css, "utf8");
ok("css bsl-used", c.includes("#beam-side-limits .bsl-used") && c.includes("beam-settings-limits-note"));

const g = fs.readFileSync(general, "utf8");
ok("settings reset/exhaust notes", g.includes("beam-settings-limits-note") && g.includes("Обновление: каждый понедельник"));
ok("settings used label", g.includes('usedLabel = ru ? "Использовано"') && g.includes("statusOut"));

const ch = fs.readFileSync(chat, "utf8");
ok("chat switch hint host", ch.includes("weekly quota notice + switch hint"));
ok("chat RU locale", ch.includes("Запросы этой модели остановлены до понедельника") && ch.includes("Попробуйте {models}"));

const b = fs.readFileSync(bridge, "utf8");
ok("bridge local reset + suggest", b.includes("formatQuotaResetLocal") && b.includes("Можно переключиться") && b.includes("alternatives:"));
ok("bridge call passes state", b.includes("sendQuotaExhausted(res, tier, used, limit, state)"));

const db = fs.readFileSync(distBridge, "utf8");
ok("dist bridge suggest", db.includes("formatQuotaResetLocal") && db.includes("Можно переключиться") && !db.includes("alts.map((n) => String(n).toLowerCase())"));

const dh = fs.readFileSync(distHtml, "utf8");
ok("dist rings", dh.includes('class="bsl-used"'));

const dg = fs.readFileSync(distGeneral, "utf8");
ok("dist settings limits", dg.includes("beam-settings-limits-note"));

const failed = checks.filter((x) => !x.cond);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
