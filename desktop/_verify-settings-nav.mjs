import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let WS;
try { WS = require("ws"); } catch {
  execSync("npm install ws --no-save", { cwd: __dirname, stdio: "inherit" });
  WS = require("ws");
}

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page") || list[0];
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};

// Force open settings profile section
await evalExpr(`(() => {
  try { window.dispatchEvent(new CustomEvent("beam:open-settings", { detail: { section: "account" } })); } catch {}
  document.querySelector('.bsl-gear,[data-act="settings"]')?.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 1200));

// Manually invoke tagger if exposed
await evalExpr(`(() => { try { if (typeof beamTagIcons === "function") beamTagIcons(); } catch {} return true; })()`);
await new Promise((r) => setTimeout(r, 400));

const dump = await evalExpr(`(() => {
  const dialogs = [...document.querySelectorAll('[role="dialog"], [class*="settings"], [class*="Settings"]')].slice(0, 8).map((d) => ({
    cls: String(d.className || "").slice(0, 80),
    role: d.getAttribute("role"),
    text: (d.innerText || "").slice(0, 120),
  }));

  // Find nav-like items mentioning Общие/Профиль/Лимиты
  const hits = [];
  for (const el of document.querySelectorAll("button, [role='button'], [role='tab'], a, div, span, li")) {
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (!/^(Общие|General|Профиль|Profile|Account|Лимиты|Limits|Модели|Models)$/i.test(label)) continue;
    if (label.length > 40) continue;
    const svg = el.querySelector?.("svg") || el.closest?.("button, [role='tab'], [role='button']")?.querySelector("svg");
    const host = el.closest("button, [role='tab'], [role='button'], [class*='nav'], [class*='Nav']") || el;
    const cs = svg ? getComputedStyle(svg) : null;
    hits.push({
      tag: el.tagName,
      hostTag: host.tagName,
      hostCls: String(host.className || "").slice(0, 100),
      label,
      beamIcon: host.getAttribute?.("data-beam-icon") || el.getAttribute?.("data-beam-icon"),
      hasSvg: !!svg,
      svgChildCount: svg ? svg.childElementCount : 0,
      mask: cs ? (cs.webkitMaskImage || cs.maskImage || "").slice(0, 140) : null,
      bg: cs?.backgroundColor,
      pathStroke: svg?.querySelector("path")?.getAttribute("stroke"),
      pathD: (svg?.querySelector("path")?.getAttribute("d") || "").slice(0, 50),
    });
  }

  // Gear mask
  const gear = document.querySelector(".bsl-gear-ico, .bsl-gear");
  const gcs = gear ? getComputedStyle(gear.classList?.contains("bsl-gear-ico") ? gear : gear.querySelector(".bsl-gear-ico") || gear) : null;

  // Appearance light/dark/system
  const theme = [...document.querySelectorAll("button, [role='button'], [role='radio'], [role='tab']")].filter((el) => {
    const t = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim();
    return /^(Light|Dark|System|Светл|Тёмн|Темн|Систем)/i.test(t.split("\\n")[0].trim());
  }).map((el) => ({
    label: ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().slice(0, 30),
    beamIcon: el.getAttribute("data-beam-icon"),
    mask: (() => {
      const svg = el.querySelector("svg");
      if (!svg) return null;
      return (getComputedStyle(svg).webkitMaskImage || getComputedStyle(svg).maskImage || "").slice(0, 120);
    })(),
  }));

  return {
    dialogs,
    hits,
    theme,
    gearMask: gcs ? (gcs.webkitMaskImage || gcs.maskImage || "").slice(0, 140) : null,
    cssHref: document.querySelector('link[href*="beam-override"]')?.href,
  };
})()`);

console.log(JSON.stringify(dump, null, 2));
fs.writeFileSync(path.join(__dirname, "_verify-icons-v4-out/settings-nav.json"), JSON.stringify(dump, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(__dirname, "_verify-icons-v4-out/05-settings-nav.png"), Buffer.from(shot.data, "base64"));

// Click Limits nav if found
await evalExpr(`(() => {
  for (const el of document.querySelectorAll("button, [role='tab'], [role='button']")) {
    const t = ((el.innerText || "") + " " + (el.getAttribute("aria-label") || "")).trim().split("\\n")[0].trim();
    if (/^(Лимиты|Limits)$/i.test(t)) { el.click(); return t; }
  }
  return null;
})()`);
await new Promise((r) => setTimeout(r, 800));
const shot2 = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(__dirname, "_verify-icons-v4-out/06-settings-limits.png"), Buffer.from(shot2.data, "base64"));

const limitsIcons = await evalExpr(`(() => {
  return [...document.querySelectorAll("[data-beam-icon]")].filter((el) => el.closest('[role="dialog"], [class*="settings"], [class*="Settings"]')).map((el) => ({
    role: el.getAttribute("data-beam-icon"),
    label: ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().slice(0, 40),
    mask: (() => {
      const svg = el.querySelector("svg");
      if (!svg) return "no-svg";
      return (getComputedStyle(svg).webkitMaskImage || getComputedStyle(svg).maskImage || "").slice(0, 120);
    })(),
  }));
})()`);
console.log("limitsIcons", JSON.stringify(limitsIcons, null, 2));

ws.close();
