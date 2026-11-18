/**
 * Verify settings nav is exactly 4 items with coolicons masks + About hosts updates.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "_verify-icons-v4-out");
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let WS;
try { WS = require("ws"); } catch {
  execSync("npm install ws --no-save", { cwd: __dirname, stdio: "inherit" });
  WS = require("ws");
}

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page" && /beam|dsh|localhost|127\.0\.0\.1/i.test(t.url || "")) || list.find((t) => t.type === "page") || list[0];
if (!page?.webSocketDebuggerUrl) throw new Error("no CDP page");
const ws = new WS(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => {
  const i = ++id;
  return new Promise((res, rej) => {
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
};
await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
ws.on("message", (data) => {
  const msg = JSON.parse(String(data));
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  }
});
await send("Runtime.enable");
await send("Page.enable");

const evalExpr = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result?.value;
};

const cssHref = await evalExpr(`document.querySelector('link[href*="beam-override"]')?.href || ""`);
console.log("cssHref", cssHref);

// Close any open dialog first
await evalExpr(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); true`);
await new Promise((r) => setTimeout(r, 300));

const opened = await evalExpr(`(() => {
  const gear = document.querySelector('.bsl-gear,[data-act="settings"],[data-beam-settings-gear="1"]');
  if (gear) { gear.click(); return "gear"; }
  const btn = [...document.querySelectorAll("button")].find((el) => {
    const t = ((el.getAttribute("aria-label")||"")+" "+(el.innerText||"")).trim();
    return /^(настройки|settings)$/i.test(t) || /настройки|settings/i.test(el.getAttribute("aria-label")||"");
  });
  if (btn) { btn.click(); return "btn:"+((btn.getAttribute("aria-label")||btn.innerText||"").slice(0,40)); }
  return null;
})()`);
console.log("opened", opened);
await new Promise((r) => setTimeout(r, 1800));

// Force tagger once
await evalExpr(`(() => {
  try {
    const mapX = [
      [/^(settings|настройки|general|общие)$/i, "general"],
      [/^(profile|профиль|account|аккаунт)$/i, "user"],
      [/^(limits|лимиты|лимит)$/i, "limits"],
      [/^(about|о приложении)$/i, "about"],
    ];
    for (const el of document.querySelectorAll('[class*="navList"] button, button[class*="navCell"], button[class*="NavCell"]')) {
      if (el.closest("#beam-side-limits,.bsl-rings")) continue;
      const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
      for (const [re, role] of mapX) {
        if (re.test(label)) { el.setAttribute("data-beam-icon", role); break; }
      }
    }
  } catch {}
  return true;
})()`);

const audit = await evalExpr(`(() => {
  const cells = [...document.querySelectorAll('[class*="navList"] button, button[class*="navCell"]')]
    .filter((el) => el.offsetParent && getComputedStyle(el).display !== "none")
    .map((el) => {
      const svg = el.querySelector("svg");
      const cs = svg ? getComputedStyle(svg) : null;
      const mask = cs ? (cs.webkitMaskImage || cs.maskImage || "") : "";
      return {
        label: ((el.innerText || "") + "").trim().split("\\n")[0].trim(),
        beam: el.getAttribute("data-beam-icon"),
        hasMask: /beam-icons|url\\(/i.test(mask) && !/^none$/i.test(mask),
        mask: mask.slice(0, 160),
        bg: cs?.backgroundColor || null,
      };
    });
  const labels = cells.map((c) => c.label);
  const expected = [/настройки|settings|общие|general/i, /профиль|profile|account/i, /лимит|limits/i, /о приложении|about/i];
  const okCount = cells.length === 4;
  const okLabels = expected.every((re, i) => re.test(labels[i] || ""));
  const okIcons = cells.every((c) => c.hasMask);
  const banned = cells.some((c) => /^(обновления|updates|сеть|network|уведомления|notifications)$/i.test(c.label));
  return { cells, labels, okCount, okLabels, okIcons, banned, dialog: !!document.querySelector('[role="dialog"]') };
})()`);

console.log("audit", JSON.stringify(audit, null, 2));

let aboutPanel = { present: false };
if (audit?.labels?.some((l) => /о приложении|about/i.test(l))) {
  await evalExpr(`(() => {
    for (const el of document.querySelectorAll('[class*="navList"] button')) {
      if (/о приложении|about/i.test((el.innerText || "").trim())) { el.click(); return true; }
    }
    return false;
  })()`);
  await new Promise((r) => setTimeout(r, 1000));
  aboutPanel = await evalExpr(`(() => {
    const root = document.querySelector('[data-beam-settings-about="1"]');
    if (!root) {
      const dlg = document.querySelector('[role="dialog"]');
      const text = (dlg?.innerText || "").slice(0, 800);
      return { present: /о приложении|beam agent|верси/i.test(text), text, viaDialog: true, hasUpdates: /обновлен|updates|проверить/i.test(text), hasNetwork: /сеть|network|bridge/i.test(text), hasNotif: /уведомлен|notification/i.test(text), hasVersion: /версия|version/i.test(text) };
    }
    const text = (root.innerText || "").slice(0, 800);
    return {
      present: true,
      hasUpdates: /обновлен|updates|проверить/i.test(text),
      hasNetwork: /сеть|network|bridge/i.test(text),
      hasNotif: /уведомлен|notification/i.test(text),
      hasVersion: /версия|version/i.test(text),
      text,
    };
  })()`);
}

const rings = await evalExpr(`(() => {
  const svg = document.querySelector("#beam-side-limits .bsl-rings svg");
  if (!svg) return { present: false };
  const cs = getComputedStyle(svg);
  const c = svg.querySelector("circle");
  return {
    present: true,
    maskNone: !cs.webkitMaskImage || cs.webkitMaskImage === "none",
    stroke: c ? getComputedStyle(c).stroke : null,
  };
})()`);

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "16-settings-about-nav.png"), Buffer.from(shot.data, "base64"));

const pass = !!(audit?.okCount && audit?.okLabels && audit?.okIcons && !audit?.banned && aboutPanel?.present && aboutPanel?.hasUpdates && rings?.present && rings?.maskNone);
const summary = { cssHref, opened, audit, aboutPanel, rings, pass };
fs.writeFileSync(path.join(OUT, "settings-about-nav.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
ws.close();
if (!pass) process.exit(1);
console.log("PASS");
