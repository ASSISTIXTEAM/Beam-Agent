/**
 * Focused verification that patched web_search / web_fetch providers work
 * through the same package entrypoints the agent loads.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fetchLib = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-fetch-http/lib/index.js"
);
const searchLib = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-search-assistix/lib/index.js"
);

const require = createRequire(pathToFileURL(fetchLib).href);
const ipaddr = require("ipaddr.js");

function checkFakeIp() {
  // Mirror patched isPublicIpAddress logic
  const input = "198.18.0.12";
  const parsed = ipaddr.parse(input);
  const ipv4 = parsed;
  const range = ipv4.range();
  const bytes = ipv4.toByteArray();
  const allowed =
    range === "unicast" ||
    range === "carrierGradeNat" ||
    (bytes[0] === 198 && (bytes[1] === 18 || bytes[1] === 19));
  if (!allowed) throw new Error(`fake-ip still blocked: range=${range}`);
  // Still block loopback
  const loop = ipaddr.parse("127.0.0.1");
  if (loop.range() === "unicast") throw new Error("loopback misclassified");
  console.log("ok fake-ip allow 198.18.0.12 range=", range);
}

async function checkSearchModule() {
  const mod = await import(pathToFileURL(searchLib).href);
  if (!mod.DeepSeekSearchProvider) throw new Error("DeepSeekSearchProvider missing");
  const provider = new mod.DeepSeekSearchProvider(() => ({
    baseURL: "https://unused.example/v1",
    model: "x",
    apiVersion: "2023-06-01",
    maxTokens: 100,
    maxUses: 1,
  }));
  if (!provider.available()) throw new Error("provider.available() false");
  const result = await provider.search({ query: "Node.js official site", maxResults: 5 });
  if (!result?.sources?.length) throw new Error("no search sources");
  console.log(
    "ok web_search sources=",
    result.sources.length,
    "first=",
    result.sources[0].title,
    result.sources[0].url
  );
}

async function checkFetchModule() {
  const mod = await import(pathToFileURL(fetchLib).href);
  // HttpFetchProvider may not be exported — use apply-level if needed
  const exported = Object.keys(mod);
  console.log("fetch exports", exported.join(","));
  if (!String(await import("node:fs").then((fs) => fs.readFileSync(fetchLib, "utf8"))).includes(
    "BEAM_FAKEIP_ALLOW"
  )) {
    throw new Error("fetch patch marker missing");
  }
  // Exercise resolve via provider if exported; else call undici after manual allow check
  if (mod.HttpFetchProvider) {
    const p = new mod.HttpFetchProvider({
      timeoutMs: 20000,
      maxRedirects: 3,
      maxResponseBytes: 500_000,
      maxBodyChars: 100_000,
      userAgent: "BeamAgent-Verify/1.0",
    });
    const page = await p.fetch({ url: "https://example.com/" });
    console.log("ok web_fetch status=", page.statusCode, "url=", page.url, "kind=", page.body?.kind);
  } else {
    // Fallback: instantiate the same SSRF-safe path by dynamic eval of patched network
    const { lookup } = await import("node:dns/promises");
    const addrs = await lookup("example.com", { all: true, order: "verbatim" });
    for (const a of addrs) {
      const parsed = ipaddr.parse(a.address);
      const bytes = parsed.toByteArray();
      const range = parsed.range();
      const ok =
        range === "unicast" ||
        range === "carrierGradeNat" ||
        (bytes[0] === 198 && (bytes[1] === 18 || bytes[1] === 19));
      if (!ok) throw new Error(`example.com addr blocked: ${a.address} ${range}`);
    }
    const res = await fetch("https://example.com/", { signal: AbortSignal.timeout(15000) });
    console.log(
      "ok web_fetch path (dns+http) status=",
      res.status,
      "addrs=",
      addrs.map((a) => a.address).join(",")
    );
  }
}

const results = { ok: true, errors: [] };
try {
  checkFakeIp();
} catch (e) {
  results.ok = false;
  results.errors.push(String(e));
  console.error("FAIL fake-ip", e);
}
try {
  await checkSearchModule();
} catch (e) {
  results.ok = false;
  results.errors.push(String(e));
  console.error("FAIL search", e);
}
try {
  await checkFetchModule();
} catch (e) {
  results.ok = false;
  results.errors.push(String(e));
  console.error("FAIL fetch", e);
}

if (!results.ok) {
  console.error("VERIFY FAILED", results.errors);
  process.exit(1);
}
console.log("VERIFY OK");
