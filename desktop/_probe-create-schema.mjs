/**
 * Probe: workspace/create request codec must accept title-only payloads.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-api-workspace-controller/lib/typert.host.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-api-workspace-controller/lib/typert.host.js"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-api-workspace-controller/lib/typert.remote-client.js"),
];

const samples = [
  { title: "Проект 1" },
  { path: "C:\\Users\\Alexa\\.beam\\projects\\demo" },
  { path: "C:\\Users\\Alexa\\.beam\\projects\\demo", title: "Demo" },
];

let failed = 0;
for (const file of files) {
  const mod = await import(pathToFileURL(file).href);
  const remote = mod.TYPERT || mod.TYPERT_REMOTE || mod.default;
  const descriptors = remote?.invocations || remote?.descriptors;
  const methods = remote?.methods;
  const create =
    methods?.["workspace/create"] ||
    (Array.isArray(descriptors)
      ? descriptors.find((d) => d.namespace === "workspace" && d.method === "create")
      : null);
  const param = create?.parameters?.[0];
  if (!param?.codec?.create) {
    console.error("FAIL locate", path.relative(ROOT, file), {
      exports: Object.keys(mod),
      invCount: Array.isArray(descriptors) ? descriptors.length : typeof descriptors,
    });
    failed++;
    continue;
  }
  const schema = param.codec.create();
  const strict = param.strictCodec.create();
  for (const sample of samples) {
    try {
      schema.parse(sample);
      strict.parse(sample);
      console.log("OK", path.basename(path.dirname(file)) + "/" + path.basename(file), JSON.stringify(sample));
    } catch (e) {
      console.error("FAIL", path.basename(file), JSON.stringify(sample), String(e?.message || e));
      failed++;
    }
  }
}
process.exit(failed ? 1 : 0);
