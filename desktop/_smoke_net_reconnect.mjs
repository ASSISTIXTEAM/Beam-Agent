/**
 * Smoke-test resilient reconnect paths (no live generation required).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEAM = path.join(os.homedir(), "BeamAgent");
const BRIDGE = "http://127.0.0.1:17865";
let failed = 0;

function ok(name, cond, detail = "") {
  if (cond) console.log("PASS", name, detail);
  else {
    failed++;
    console.error("FAIL", name, detail);
  }
}

async function getJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  return { status: r.status, j };
}

const bridgeSrc = fs.readFileSync(path.join(ROOT, "desktop", "bridge", "server.js"), "utf8");
ok("bridge has NET_STATE", bridgeSrc.includes("BEAM_NET_RECONNECT") && bridgeSrc.includes("waitForOutboundNet"));
ok("bridge has quota blip grace", bridgeSrc.includes("quota_blip_grace") && bridgeSrc.includes("QUOTA_BLIP_GRACE_MS"));
ok("bridge has network_interrupted", bridgeSrc.includes("network_interrupted") && bridgeSrc.includes("stream_net_interrupt"));
ok("BeamAgent bridge synced", fs.existsSync(path.join(BEAM, "bridge", "server.js"))
  && fs.readFileSync(path.join(BEAM, "bridge", "server.js"), "utf8").includes("BEAM_NET_RECONNECT"));

const html = fs.readFileSync(
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
  "utf8"
);
ok("watchdog in index.html", html.includes("BEAM_NET_RECONNECT_WATCHDOG") && html.includes("__beamSimulateOffline"));

const retry = fs.readFileSync(
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-llm-retry", "lib", "index.js"),
  "utf8"
);
ok("llm-retry offline gate", retry.includes("BEAM_NET_RETRY_OFFLINE_GATE") && retry.includes("beamWaitForNetIfOffline"));

const main = fs.readFileSync(path.join(ROOT, "runtime", "app", "lib", "main.js"), "utf8");
ok("main bridge watchdog", main.includes("BEAM_BRIDGE_WATCHDOG"));

const health = await getJson(BRIDGE + "/health");
ok("GET /health", health.status === 200 && health.j.ok === true && health.j.service === "beam-bridge", JSON.stringify(health.j));

const net = await getJson(BRIDGE + "/assistix/net?force=1");
ok("GET /assistix/net", net.status === 200 && net.j.bridge === true && typeof net.j.online === "boolean", JSON.stringify(net.j));
ok("Host/Kumo ping fields", "kumo" in net.j && "host" in net.j);

// Soft simulation of offline evaluation logic (mirrors watchdog)
function evaluateSim({ browserOnline, bridgeOk, kumoOk, hostOk }) {
  const upstreamKnownBad = kumoOk === false && hostOk === false;
  return browserOnline && bridgeOk && !upstreamKnownBad;
}
ok("sim online healthy", evaluateSim({ browserOnline: true, bridgeOk: true, kumoOk: true, hostOk: true }) === true);
ok("sim browser offline", evaluateSim({ browserOnline: false, bridgeOk: true, kumoOk: true, hostOk: true }) === false);
ok("sim bridge down", evaluateSim({ browserOnline: true, bridgeOk: false, kumoOk: true, hostOk: true }) === false);
ok("sim upstream both down", evaluateSim({ browserOnline: true, bridgeOk: true, kumoOk: false, hostOk: false }) === false);
ok("sim unknown upstream ok", evaluateSim({ browserOnline: true, bridgeOk: true, kumoOk: null, hostOk: null }) === true);

console.log(failed ? `\nFAILED ${failed}` : "\nALL PASS");
process.exit(failed ? 1 : 0);
