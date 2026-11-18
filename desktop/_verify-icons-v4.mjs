/**
 * CDP verify: open Settings/Profile/Models, dump data-beam-icon + mask styles,
 * confirm quota rings still have stroke (not masked), save screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "desktop/_verify-icons-v4-out");
fs.mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
let WS;
try {
  WS = require("ws");
} catch {
  execSync("npm install ws --no-save", { cwd: __dirname, stdio: "inherit" });
  WS = require("ws");
}

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page") || list[0];
if (!page) throw new Error("No CDP page");

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WS(url);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => {
      const i = ++id;
      return new Promise((res, rej) => {
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    };
    ws.on("open", () => resolve({ ws, send }));
    ws.on("error", reject);
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  });
}

const { ws, send } = await connect(page.webSocketDebuggerUrl);
await send("Runtime.enable");
await send("Page.enable");

async function evalExpr(expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(JSON.stringify(r.exceptionDetails));
  }
  return r.result?.value;
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const p = path.join(OUT, `${name}.png`);
  fs.writeFileSync(p, Buffer.from(r.data, "base64"));
  console.log("shot", p);
  return p;
}

const cssBust = await evalExpr(`document.querySelector('link[href*="beam-override"]')?.href || ""`);
console.log("cssHref", cssBust);

// Home / sidebar shot
await shot("01-home");

const ringAudit = await evalExpr(`(() => {
  const rings = document.querySelector(".bsl-rings");
  if (!rings) return { ok: false, reason: "no .bsl-rings" };
  const svgs = [...rings.querySelectorAll("svg")];
  const info = svgs.slice(0, 6).map((svg) => {
    const cs = getComputedStyle(svg);
    const path = svg.querySelector("circle, path, ellipse");
    const pcs = path ? getComputedStyle(path) : null;
    return {
      mask: cs.webkitMaskImage || cs.maskImage,
      bg: cs.backgroundColor,
      stroke: pcs?.stroke,
      opacity: pcs?.opacity,
      fill: pcs?.fill,
    };
  });
  return { ok: true, count: svgs.length, info };
})()`);
console.log("rings", JSON.stringify(ringAudit, null, 2));

// Open settings via gear or event
await evalExpr(`(() => {
  try { window.dispatchEvent(new CustomEvent("beam:open-settings", { detail: { section: "general" } })); } catch {}
  const gear = document.querySelector('#beam-side-limits [data-act="settings"], .bsl-gear, [data-beam-settings-gear]');
  if (gear) gear.click();
  return true;
})()`);
await new Promise((r) => setTimeout(r, 900));
await shot("02-settings");

const settingsAudit = await evalExpr(`(() => {
  const tagged = [...document.querySelectorAll("[data-beam-icon]")].map((el) => ({
    role: el.getAttribute("data-beam-icon"),
    label: ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().slice(0, 40),
    inDialog: !!el.closest('[role="dialog"], [class*="settings"], [class*="Settings"]'),
    mask: (() => {
      const svg = el.querySelector("svg");
      if (!svg) return null;
      const cs = getComputedStyle(svg);
      return (cs.webkitMaskImage || cs.maskImage || "").slice(0, 120);
    })(),
  }));
  const settingsTagged = tagged.filter((t) =>
    /general|user|limits|model|settings|sun|moon|monitor|sliders|mic|archive/i.test(t.role)
  );
  return { totalTagged: tagged.length, settingsTagged, sample: tagged.slice(0, 40) };
})()`);
console.log("settings", JSON.stringify(settingsAudit, null, 2));

// Try open profile
await evalExpr(`(() => {
  try { document.querySelector('#beam-side-limits [data-act="profile"], .bsl-profile')?.click(); } catch {}
  try { window.dispatchEvent(new CustomEvent("beam:open-settings", { detail: { section: "account" } })); } catch {}
  return true;
})()`);
await new Promise((r) => setTimeout(r, 800));
await shot("03-profile");

const profileAudit = await evalExpr(`(() => {
  const modal = document.querySelector("#beam-profile-modal:not([hidden]), [class*='settings'][role='dialog'], [role='dialog']");
  const icons = [...document.querySelectorAll("[data-beam-icon='user'], [data-beam-icon='profile'], [data-beam-icon='settings'], [data-beam-icon='logout'], [data-beam-icon='login']")].map((el) => ({
    role: el.getAttribute("data-beam-icon"),
    label: ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().slice(0, 40),
    mask: (() => {
      const svg = el.querySelector("svg") || el.querySelector(".bsl-gear-ico");
      const node = svg || el;
      const cs = getComputedStyle(node);
      return (cs.webkitMaskImage || cs.maskImage || "").slice(0, 120);
    })(),
  }));
  return {
    profileModalOpen: !!(document.querySelector("#beam-profile-modal") && !document.querySelector("#beam-profile-modal")?.hidden),
    dialogText: (modal?.innerText || "").slice(0, 200),
    icons,
  };
})()`);
console.log("profile", JSON.stringify(profileAudit, null, 2));

// Models / model picker
await evalExpr(`(() => {
  // Close overlays first
  try { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch {}
  const candidates = [...document.querySelectorAll("button, [role='button']")].filter((el) => {
    const t = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).toLowerCase();
    return /model|модел|tide|flare|pine|auto/.test(t) && !el.closest("#beam-side-limits");
  });
  const btn = candidates.find((b) => b.offsetParent) || candidates[0];
  if (btn) btn.click();
  return { clicked: !!btn, label: btn ? ((btn.getAttribute("aria-label") || "") + " " + (btn.innerText || "")).trim().slice(0, 60) : null, count: candidates.length };
})()`);
await new Promise((r) => setTimeout(r, 800));
await shot("04-models");

const modelsAudit = await evalExpr(`(() => {
  const modelIcons = [...document.querySelectorAll("[data-beam-icon='model'], [data-beam-icon='chip'], [class*='modelPicker'] [data-beam-icon], [class*='ModelPicker'] [data-beam-icon]")].map((el) => ({
    role: el.getAttribute("data-beam-icon"),
    label: ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().slice(0, 40),
    mask: (() => {
      const svg = el.querySelector("svg");
      if (!svg) return null;
      return (getComputedStyle(svg).webkitMaskImage || getComputedStyle(svg).maskImage || "").slice(0, 120);
    })(),
  }));
  return { modelIcons, openText: (document.body.innerText || "").includes("Tide") };
})()`);
console.log("models", JSON.stringify(modelsAudit, null, 2));

// Final ring re-check after CSS
const ring2 = await evalExpr(`(() => {
  const svg = document.querySelector("#beam-side-limits .bsl-rings .bsl-chart svg, #beam-side-limits .bsl-ring svg");
  if (!svg) return { ok: false };
  const cs = getComputedStyle(svg);
  const circle = svg.querySelector("circle");
  const ccs = circle ? getComputedStyle(circle) : null;
  return {
    ok: true,
    maskNone: !cs.webkitMaskImage || cs.webkitMaskImage === "none",
    bg: cs.backgroundColor,
    stroke: ccs?.stroke,
    strokeOpacity: ccs?.strokeOpacity || ccs?.opacity,
  };
})()`);
console.log("ringsAfter", JSON.stringify(ring2, null, 2));

const report = {
  cssBust,
  ringAudit,
  settingsAudit,
  profileAudit,
  modelsAudit,
  ring2,
};
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log("DONE", OUT);
ws.close();
