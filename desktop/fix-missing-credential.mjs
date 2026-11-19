/**
 * Fix MISSING_CREDENTIAL: credentials-local / loadLayeredEnv were still resolving
 * harness home via @assistix/beam-home-paths → ~/.dsh (no BEAM_API_KEY), while
 * Electron profiles + OAuth live under ~/.beam. Also inject Beam launch env into
 * Electron main so direct .exe starts (without VBS) still reach the local bridge.
 *
 * Never writes BEAM_BASE_URL into ~/.beam/.env (process env / profile only).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BEAM_HOME = process.env.BEAM_HOME || path.join(os.homedir(), ".beam");
const BRIDGE = "http://127.0.0.1:17865/anthropic";
const LOCAL_KEY = "beam-assistix-local";

const report = [];

function write(file, text) {
  fs.writeFileSync(file, text);
  report.push(path.relative(ROOT, file));
}

function patchFile(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) return false;
  write(file, after);
  return true;
}

const homePathFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-home-paths/lib/index.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-home-paths/lib/index.js"),
];

for (const file of homePathFiles) {
  patchFile(file, (s) => {
    s = s.replace(
      'const DSH_HOME_DIR_NAME = ".dsh";',
      'const DSH_HOME_DIR_NAME = ".beam";'
    );
    s = s.replace(
      'const DSH_HOME_ENV = "DSH_HOME";',
      'const DSH_HOME_ENV = "BEAM_HOME";\n/** Legacy alias still honored via resolveDshHome. */\nconst DSH_HOME_ENV_LEGACY = "DSH_HOME";'
    );
    s = s.replace(
      /function resolveDshHome\(configured, env = process\.env\) \{\s*return resolveRoot\(configured, env, DSH_HOME_ENV, defaultDshHome\);\s*\}/,
      `function resolveDshHome(configured, env = process.env) {
	if (configured !== undefined && configured !== null && String(configured).trim()) {
		return resolve(expandHomePath(String(configured)));
	}
	const beam = env.BEAM_HOME;
	if (beam !== undefined && String(beam).trim()) return resolve(expandHomePath(String(beam)));
	const legacy = env.DSH_HOME;
	if (legacy !== undefined && String(legacy).trim()) return resolve(expandHomePath(String(legacy)));
	return defaultDshHome();
}`
    );
    s = s.replace(/`~\/\.dsh`/g, "`~/.beam`");
    s = s.replace(/\$DSH_HOME/g, "$BEAM_HOME");
    s = s.replace(
      "* Precedence, highest first: an explicit configured path, `$BEAM_HOME`, then\n* `~/.beam`. The harness keeps all user data under one root. An empty or\n* whitespace-only `$BEAM_HOME` is treated as unset, so a blank override never\n* resolves the home to the current working directory.\n* @param configured - explicit harness-home override, which has highest precedence.\n* @param env - environment mapping used to read `DSH_HOME`.",
      "* Precedence, highest first: an explicit configured path, `$BEAM_HOME`, then `$DSH_HOME`, then\n* `~/.beam`. The harness keeps all user data under one root. An empty or\n* whitespace-only `$BEAM_HOME` / `$DSH_HOME` is treated as unset.\n* @param configured - explicit harness-home override, which has highest precedence.\n* @param env - environment mapping used to read `BEAM_HOME` / `DSH_HOME`."
    );
    return s;
  });
}

const llmFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-llm-assistix/lib/index.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-llm-assistix/lib/index.js"),
];

for (const file of llmFiles) {
  patchFile(file, (s) => {
    // Prefer local Tide bridge over official DeepSeek when BEAM_BASE_URL is unset.
    s = s.replace(
      'const baseURL = config.baseURL ?? environment?.get(BASE_URL_ENV)?.value ?? "https://api.deepseek.com/anthropic";',
      'const baseURL = config.baseURL ?? environment?.get(BASE_URL_ENV)?.value ?? PUBLIC_BASE_URL;'
    );
    return s;
  });
}

const apiKeyFiles = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-llm-assistix-api-key/lib/index.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-llm-assistix-api-key/lib/index.js"),
];

for (const file of apiKeyFiles) {
  patchFile(file, (s) => {
    // Keep assistix-official aliases registered (legacy DeepSeek ids).
    s = s.replace(
      /register(?:Beam|DeepSeek)Provider\(ctx, PROVIDER,/g,
      (m) => m.replace("PROVIDER,", "PROVIDER_ALIASES,")
    );
    if (s.includes("BEAM_API_KEY_ALIASES") && s.includes('credentialRef("DEEPSEEK_API_KEY")') && s.includes("const refs = [connection.apiKeyEnv")) return s;
    const old = `const presentApiKey = async (connection) => {
		try {
			return await resolveApiKey(connection);
		} catch (error) {
			if (error instanceof LlmError && error.code === "MISSING_CREDENTIAL") return void 0;
			throw error;
		}
	};`;
    const next = `const presentApiKey = async (connection) => {
		try {
			return await resolveApiKey(connection);
		} catch (error) {
			if (error instanceof LlmError && error.code === "MISSING_CREDENTIAL") {
				try {
					const legacy = { ...connection, apiKeyEnv: credentialRef("DEEPSEEK_API_KEY") };
					return await resolveApiKey(legacy);
				} catch (legacyError) {
					if (legacyError instanceof LlmError && legacyError.code === "MISSING_CREDENTIAL") return void 0;
					throw legacyError;
				}
			}
			throw error;
		}
	};`;
    if (!s.includes(old)) return s;
    s = s.replace(old, next);
    s = s.replace(
      'credentialRef(apiKeyEnv ?? "BEAM_API_KEY")',
      'credentialRef(apiKeyEnv ?? "BEAM_API_KEY") /* BEAM_API_KEY_ALIASES */'
    );
    // Also dual-read inside resolveApiKey itself for chat sends (not only discovery).
    const resolveOld = `	const resolveApiKey = async (connection) => {
		const ref = connection.apiKeyEnv;
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) {
			const hit = await credentials.resolve(ref);
			if (hit !== void 0) return assertUsableApiKey(hit.value, "llm-deepseek", ref);
		} else {
			const ambient = launchEnvironmentOf(ctx).get(ref);
			if (ambient !== void 0 && ambient.value.length > 0) return assertUsableApiKey(ambient.value, "llm-deepseek", ref);
		}
		throw new LlmError(\`llm-deepseek: no API key for provider route "\${PROVIDER}"; store \${ref} through the credentials service (the web Models page writes it), or export \${ref} in the launching environment\`, "MISSING_CREDENTIAL");
	};`;
    const resolveNext = `	const resolveApiKey = async (connection) => {
		const refs = [connection.apiKeyEnv, credentialRef("BEAM_API_KEY"), credentialRef("DEEPSEEK_API_KEY")];
		const seen = new Set();
		const credentials = ctx.get("credentials");
		for (const ref of refs) {
			const name = String(ref);
			if (seen.has(name)) continue;
			seen.add(name);
			if (credentials !== void 0) {
				const hit = await credentials.resolve(ref);
				if (hit !== void 0) return assertUsableApiKey(hit.value, "llm-deepseek", ref);
			} else {
				const ambient = launchEnvironmentOf(ctx).get(ref);
				if (ambient !== void 0 && ambient.value.length > 0) return assertUsableApiKey(ambient.value, "llm-deepseek", ref);
			}
		}
		const ref = connection.apiKeyEnv;
		throw new LlmError(\`llm-deepseek: no API key for provider route "\${PROVIDER}"; store \${ref} through the credentials service (the web Models page writes it), or export \${ref} in the launching environment\`, "MISSING_CREDENTIAL");
	};`;
    if (s.includes(resolveOld)) s = s.replace(resolveOld, resolveNext);
    return s;
  });
}

const LAUNCH_ENV_MARKER = "/* BEAM_LAUNCH_ENV:";
const LAUNCH_ENV_SNIPPET = `/* BEAM_LAUNCH_ENV: ensure host inherits Beam home + bridge credentials even when .exe is opened without the VBS launcher. Never write BEAM_BASE_URL into ~/.beam/.env. */
(function ensureBeamLaunchEnv() {
	try {
		const home = (() => {
			const beam = process.env.BEAM_HOME;
			if (beam !== undefined && String(beam).trim()) return resolve(expandHomePath(String(beam)));
			const legacy = process.env.DSH_HOME;
			if (legacy !== undefined && String(legacy).trim()) return resolve(expandHomePath(String(legacy)));
			return join(homedir(), ".beam");
		})();
		if (!(typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim())) process.env.BEAM_HOME = home;
		if (!(typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim())) process.env.DSH_HOME = process.env.BEAM_HOME;
		const bridge = "http://127.0.0.1:17865/anthropic";
		if (!(typeof process.env.BEAM_BASE_URL === "string" && process.env.BEAM_BASE_URL.trim())) process.env.BEAM_BASE_URL = bridge;
		if (!(typeof process.env.DEEPSEEK_BASE_URL === "string" && process.env.DEEPSEEK_BASE_URL.trim())) process.env.DEEPSEEK_BASE_URL = process.env.BEAM_BASE_URL;
		let key = (typeof process.env.BEAM_API_KEY === "string" && process.env.BEAM_API_KEY.trim()) || (typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY.trim()) || "";
		if (!key) {
			try {
				const text = readFileSync(join(home, ".credentials.yaml"), "utf8");
				const m = text.match(/^\\s*BEAM_API_KEY:\\s*(\\S+)/m) || text.match(/^\\s*DEEPSEEK_API_KEY:\\s*(\\S+)/m);
				if (m) key = m[1];
			} catch {}
		}
		if (!key) {
			try {
				const envText = readFileSync(join(home, ".env"), "utf8");
				const m = envText.match(/^\\s*BEAM_API_KEY=(.+)$/m) || envText.match(/^\\s*DEEPSEEK_API_KEY=(.+)$/m);
				if (m) key = m[1].trim().replace(/^["']|["']$/g, "");
			} catch {}
		}
		if (!key) key = "beam-assistix-local";
		if (!(typeof process.env.BEAM_API_KEY === "string" && process.env.BEAM_API_KEY.trim())) process.env.BEAM_API_KEY = key;
		if (!(typeof process.env.DEEPSEEK_API_KEY === "string" && process.env.DEEPSEEK_API_KEY.trim())) process.env.DEEPSEEK_API_KEY = process.env.BEAM_API_KEY;
		try {
			mkdirSync(home, { recursive: true });
			const credPath = join(home, ".credentials.yaml");
			let text = "";
			try { text = readFileSync(credPath, "utf8"); } catch { text = "version: 1\\nrefs:\\n"; }
			if (!/^\\s*BEAM_API_KEY:/m.test(text)) {
				if (!/\\nrefs:\\s*$/m.test(text) && !/\\nrefs:\\n/m.test(text)) {
					if (!/^version:\\s*1\\b/m.test(text)) text = "version: 1\\n" + text;
					if (!/\\nrefs:/m.test(text) && !/^refs:/m.test(text)) text = text.replace(/\\s*$/, "") + "\\nrefs:\\n";
				}
				text = text.replace(/(^refs:\\s*\\n)/m, \`$1  BEAM_API_KEY: \${process.env.BEAM_API_KEY}\\n\`);
				if (!/^\\s*BEAM_API_KEY:/m.test(text)) text += \`  BEAM_API_KEY: \${process.env.BEAM_API_KEY}\\n\`;
				if (!/^\\s*DEEPSEEK_API_KEY:/m.test(text)) text += \`  DEEPSEEK_API_KEY: \${process.env.BEAM_API_KEY}\\n\`;
				writeFileSync(credPath, text);
			}
			const envPath = join(home, ".env");
			let envText = "";
			try { envText = readFileSync(envPath, "utf8"); } catch { envText = ""; }
			const lines = envText.split(/\\r?\\n/).filter((line) => line && !/^(BEAM_BASE_URL|BEAM_HOME|DEEPSEEK_BASE_URL|DSH_HOME|DEEPSEEK_SEARCH_BASE_URL)=/i.test(line));
			const hasBeamKey = lines.some((line) => /^BEAM_API_KEY=/i.test(line));
			const hasDeepKey = lines.some((line) => /^DEEPSEEK_API_KEY=/i.test(line));
			if (!hasBeamKey) lines.unshift(\`BEAM_API_KEY=\${process.env.BEAM_API_KEY}\`);
			if (!hasDeepKey) lines.push(\`DEEPSEEK_API_KEY=\${process.env.BEAM_API_KEY}\`);
			writeFileSync(envPath, lines.filter(Boolean).join("\\n") + "\\n");
		} catch {}
	} catch (error) {
		console.warn("beam launch env:", error);
	}
})();
`;

const mainFiles = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js"),
];

for (const file of mainFiles) {
  patchFile(file, (s) => {
    if (s.includes(LAUNCH_ENV_MARKER)) return s;
    // Insert after resolveDshHome / resolveDesktopPaths region so expandHomePath + fs helpers exist.
    const anchor = "//#endregion\n//#region lib/types/paths.js";
    if (s.includes(anchor)) {
      return s.replace(anchor, `//#endregion\n${LAUNCH_ENV_SNIPPET}//#region lib/types/paths.js`);
    }
    // Fallback: after first resolveDshHome closing brace block
    const idx = s.indexOf("function resolveDesktopPaths");
    if (idx > 0) return s.slice(0, idx) + LAUNCH_ENV_SNIPPET + s.slice(idx);
    return s;
  });
}

// Pin assistix-official → local bridge in the live desktop profile (process-safe; not .env).
const profilePatch = path.join(BEAM_HOME, "profiles/desktop/cordis.patch.yml");
if (fs.existsSync(profilePatch)) {
  patchFile(profilePatch, (s) => {
    if (s.includes("id: llm-deepseek")) {
      if (!/baseURL:\s*http:\/\/127\.0\.0\.1:17865\/anthropic/.test(s)) {
        s = s.replace(
          /- id: llm-deepseek\n([\s\S]*?)(?=\n- id:|\n*$)/,
          (block) => {
            if (/baseURL:/.test(block)) {
              return block.replace(/baseURL:\s*.*/, "  config:\n    baseURL: http://127.0.0.1:17865/anthropic\n    apiKeyEnv: BEAM_API_KEY");
            }
            return `- id: llm-deepseek
  name: "@assistix/beam-llm-assistix-api-key"
  config:
    baseURL: http://127.0.0.1:17865/anthropic
    apiKeyEnv: BEAM_API_KEY
`;
          }
        );
      }
      return s;
    }
    return (
      s.replace(/\s*$/, "") +
      `

- id: llm-deepseek
  name: "@assistix/beam-llm-assistix-api-key"
  config:
    baseURL: http://127.0.0.1:17865/anthropic
    apiKeyEnv: BEAM_API_KEY
`
    );
  });
}

// Ensure ~/.beam credentials + .env (keys only).
fs.mkdirSync(BEAM_HOME, { recursive: true });
const credPath = path.join(BEAM_HOME, ".credentials.yaml");
let cred = fs.existsSync(credPath) ? fs.readFileSync(credPath, "utf8") : "version: 1\nrefs:\n";
if (!/^version:\s*1\b/m.test(cred)) cred = "version: 1\n" + cred;
if (!/^refs:/m.test(cred) && !/\nrefs:/m.test(cred)) cred = cred.replace(/\s*$/, "") + "\nrefs:\n";
if (!/^\s*BEAM_API_KEY:/m.test(cred)) {
  cred = cred.replace(/(^refs:\s*\n)/m, `$1  BEAM_API_KEY: ${LOCAL_KEY}\n`);
  if (!/^\s*BEAM_API_KEY:/m.test(cred)) cred += `  BEAM_API_KEY: ${LOCAL_KEY}\n`;
}
if (!/^\s*DEEPSEEK_API_KEY:/m.test(cred)) cred += `  DEEPSEEK_API_KEY: ${LOCAL_KEY}\n`;
fs.writeFileSync(credPath, cred);
report.push(path.relative(os.homedir(), credPath));

const envPath = path.join(BEAM_HOME, ".env");
let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const envLines = envText
  .split(/\r?\n/)
  .filter((line) => line && !/^(BEAM_BASE_URL|BEAM_HOME|DEEPSEEK_BASE_URL|DSH_HOME|DEEPSEEK_SEARCH_BASE_URL)=/i.test(line));
if (!envLines.some((line) => /^BEAM_API_KEY=/i.test(line))) envLines.unshift(`BEAM_API_KEY=${LOCAL_KEY}`);
if (!envLines.some((line) => /^DEEPSEEK_API_KEY=/i.test(line))) envLines.push(`DEEPSEEK_API_KEY=${LOCAL_KEY}`);
fs.writeFileSync(envPath, envLines.filter(Boolean).join("\n") + "\n");
report.push(path.relative(os.homedir(), envPath));

// Soft-migrate: if ~/.dsh credentials lack BEAM_API_KEY, leave them alone — home-paths now points at .beam.

console.log("fix-missing-credential patched:");
for (const f of report) console.log(" -", f);
