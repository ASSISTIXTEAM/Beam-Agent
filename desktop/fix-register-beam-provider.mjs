/**
 * Ensure @assistix/beam-llm-assistix exports registerBeamProvider
 * (alias of registerDeepSeekProvider) so api-key/account plugins load.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  path.join(root, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-llm-deepseek", "lib", "index.js"),
  path.join(root, "runtime", "app", "beam", "node_modules", "@assistix", "beam-llm-deepseek", "lib", "index.js"),
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("registerBeamProvider")) {
    console.log("ok", file);
    continue;
  }
  if (!s.includes("registerDeepSeekProvider")) {
    console.warn("skip (no registerDeepSeekProvider)", file);
    continue;
  }
  s = s.replace(
    "export { Config, DEFAULT_CONTEXT_WINDOW,",
    "const registerBeamProvider = registerDeepSeekProvider;\nexport { Config, DEFAULT_CONTEXT_WINDOW,",
  );
  s = s.replace(
    "registerDeepSeekProvider, requestModelListing",
    "registerDeepSeekProvider, registerBeamProvider, requestModelListing",
  );
  fs.writeFileSync(file, s);
  console.log("patched", file);
}
