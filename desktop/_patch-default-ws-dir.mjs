import fs from "node:fs";

const files = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@assistix/beam-api-workspace-controller/lib/index.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-api-workspace-controller/lib/index.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/_tmp_app/dsh/node_modules/@deepseek-ai/dsh-api-workspace-controller/lib/index.js",
];

const replacement = `async function defaultWorkspaceDirectory(documentsDirectory, signal, internals = {}) {
	const platform = internals.platform ?? process.platform;
	const paths = platform === "win32" ? win32 : posix;
	signal.throwIfAborted();
	const envHome = (typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim()) || (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim()) || undefined;
	const beamHome = envHome ? paths.normalize(envHome) : paths.join(internals.home ?? homedir(), ".beam");
	if (!paths.isAbsolute(beamHome)) throw new Error(\`Beam home must be fully qualified: '\${beamHome}'\`);
	signal.throwIfAborted();
	return paths.join(beamHome, DEFAULT_WORKSPACE_DIRECTORY);
}`;

const re = /async function defaultWorkspaceDirectory\([\s\S]*?\n\}/;

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("skip", f);
    continue;
  }
  let s = fs.readFileSync(f, "utf8");
  if (!re.test(s)) {
    console.log("NO MATCH", f);
    continue;
  }
  s = s.replace(re, replacement);
  s = s.replaceAll("<Documents>/deepseek-harness", "~/.beam");
  fs.writeFileSync(f, s);
  console.log("patched", f, "still-harness=", s.includes("deepseek-harness"));
}
