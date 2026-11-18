/**
 * Keep Assistix session across brief bridge blips.
 * - Retry /assistix/status
 * - Never treat transient fetch failure as logout
 * - Only show auth gate when bridge confirms signedIn:false
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OLD = `  const refresh = async (opts = {}) => {
    const force = !!opts.force;
    // While user types in the gate, skip status-driven UI churn (still allow forced login result)
    if (!force && isGateFormInteractive()) return;
    try {
      const r = await fetch(BRIDGE + "/assistix/status");
      lastData = await r.json();
    } catch {
      lastData = { signedIn: false, user: null, quotas: {} };
    }`;

const NEW = `  const refresh = async (opts = {}) => {
    const force = !!opts.force;
    // While user types in the gate, skip status-driven UI churn (still allow forced login result)
    if (!force && isGateFormInteractive()) return;
    let ok = false;
    let next = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await fetch(BRIDGE + "/assistix/status", { cache: "no-store" });
        if (!r.ok) throw new Error("http_" + r.status);
        next = await r.json();
        ok = true;
        break;
      } catch (e) {
        if (attempt < 3) await new Promise((res) => setTimeout(res, 180 * (attempt + 1)));
      }
    }
    if (ok && next) {
      lastData = next;
      try { window.__beamBridgeDown = false; } catch {}
    } else {
      // CRITICAL: do NOT clear a known-good session on transient bridge blips
      try { window.__beamBridgeDown = true; } catch {}
      if (lastData && lastData.signedIn && lastData.user) {
        // keep lastData — stay signed in; soft reconnect only
      } else if (!lastData) {
        lastData = { signedIn: false, user: null, quotas: {}, bridgeDown: true };
      } else {
        lastData = { ...lastData, bridgeDown: true };
      }
    }`;

const OLD_GATE_ERR = `      Failed_to_fetch: "Нет связи с Beam Agent",
      "Failed to fetch": "Нет связи с Beam Agent",`;

const NEW_GATE_ERR = `      Failed_to_fetch: "Нет связи с Beam Agent — подождите или перезапустите через StartBeamAgent",
      "Failed to fetch": "Нет связи с Beam Agent — подождите или перезапустите через StartBeamAgent",`;

/** Don't force auth overlay when we still have a cached signed session during bridgeDown */
const OLD_ENSURE_START = `  const ensureAuthGate = (data, opts = {}) => {
    const force = !!opts.force;
    let gate = gateEl();
    const signed = !!data?.signedIn && !!data?.user;`;

const NEW_ENSURE_START = `  const ensureAuthGate = (data, opts = {}) => {
    const force = !!opts.force;
    let gate = gateEl();
    const signed = !!data?.signedIn && !!data?.user;
    // Soft reconnect: if we believe we're signed in, never slam the login wall for bridgeDown
    if (signed && data?.bridgeDown) {
      if (gate) { gate.hidden = true; }
      document.documentElement.style.overflow = "";
      return true;
    }`;

function targets() {
  const list = [];
  const rels = [
    "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
    "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
    "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
    "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  ];
  for (const r of rels) {
    const p = path.join(ROOT, r);
    if (fs.existsSync(p)) list.push(p);
  }
  return list;
}

let n = 0;
for (const file of targets()) {
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  if (s.includes(OLD)) s = s.replace(OLD, NEW);
  else if (!s.includes("window.__beamBridgeDown")) {
    console.warn("refresh block not found:", file);
  }
  if (s.includes(OLD_GATE_ERR)) s = s.replace(OLD_GATE_ERR, NEW_GATE_ERR);
  if (s.includes(OLD_ENSURE_START) && !s.includes("data?.bridgeDown")) {
    s = s.replace(OLD_ENSURE_START, NEW_ENSURE_START);
  }
  if (s !== before) {
    fs.writeFileSync(file, s);
    n++;
    console.log("patched", path.relative(ROOT, file));
  } else {
    console.log("unchanged", path.relative(ROOT, file));
  }
}
console.log("done files=", n);
