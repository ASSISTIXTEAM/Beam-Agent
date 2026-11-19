/**
 * Rename packaging identity: @deepseek-ai/* → @assistix/*, dsh-* → beam-*,
 * DEEPSEEK_* → BEAM_* (with dual-read where needed), folder dsh → beam.
 * Operates on runtime/app and dist/.../resources/app (+ desktop/bridge, start scripts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const TEXT_EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".ts",
  ".tsx",
  ".jsx",
  ".html",
  ".htm",
  ".css",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".cmd",
  ".bat",
  ".vbs",
  ".ps1",
  ".svg",
  ".map",
  ".vue",
  ".xml",
]);

const report = {
  trees: [],
  renamedDirs: [],
  filesPatched: 0,
  leftovers: [],
  mustKeepTemporarily: [],
};

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".git" || ent.name === "node_modules" && p.includes("node_modules\\node_modules")) {
        // still walk node_modules of app
      }
      walkFiles(p, out);
    } else out.push(p);
  }
  return out;
}

function isTextFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  // extensionless small configs
  const base = path.basename(file);
  return base === "LICENSE" || base === "version" || base.endsWith(".webmanifest");
}

/** Map old package folder name → new (under scope). */
function mapPkgFolder(name) {
  if (name === "dsh") return "beam";
  if (name.startsWith("dsh-")) return "beam-" + name.slice(4);
  // deepseek in the middle
  return name.replace(/deepseek/gi, "assistix");
}

function rewriteContent(s, { dualCredential = true } = {}) {
  // Scope + package path rewrites (order matters)
  s = s.split("@deepseek-ai/dsh-").join("@assistix/beam-");
  s = s.split("@deepseek-ai/dsh\"").join("@assistix/beam\"");
  s = s.split("@deepseek-ai/dsh'").join("@assistix/beam'");
  s = s.split("@deepseek-ai/dsh/").join("@assistix/beam/");
  s = s.split("@deepseek-ai/dsh`").join("@assistix/beam`");
  s = s.split("@deepseek-ai/").join("@assistix/");

  // node_modules path segments
  s = s.split("node_modules/@deepseek-ai/dsh-").join("node_modules/@assistix/beam-");
  s = s.split("node_modules/@deepseek-ai/dsh/").join("node_modules/@assistix/beam/");
  s = s.split("node_modules/@deepseek-ai/").join("node_modules/@assistix/");
  s = s.split("node_modules\\\\@deepseek-ai\\\\dsh-").join("node_modules\\\\@assistix\\\\beam-");
  s = s.split("node_modules\\\\@deepseek-ai\\\\").join("node_modules\\\\@assistix\\\\");
  s = s.split("node_modules/@deepseek-ai\\").join("node_modules/@assistix\\");

  // Folder resources/app/dsh → beam
  s = s.replace(/(["'`])dsh\//g, "$1beam/");
  s = s.replace(/(["'`])dsh\\/g, "$1beam\\");
  s = s.replace(/join\(([^)]*?),\s*["']dsh["']/g, 'join($1, "beam"');
  s = s.replace(/,\s*["']dsh["']\s*,/g, ', "beam",');
  s = s.replace(/\/dsh\/node_modules/g, "/beam/node_modules");
  s = s.replace(/\\dsh\\node_modules/g, "\\beam\\node_modules");

  // Protocol
  s = s.split("dsh-app").join("beam-app");
  s = s.split("dsh-platform").join("beam-platform");
  s = s.split("dsh-desktop").join("beam-desktop");

  // Provider / product strings
  s = s.split("deepseek-official").join("assistix-official");
  s = s.split("deepseek-account").join("assistix-account");
  s = s.replace(/\bDeepSeek Harness\b/g, "Beam Agent");
  s = s.replace(/\bDeepSeek Account\b/g, "ASSISTIX ID");
  s = s.replace(/\bDeepSeek\b/g, "ASSISTIX");
  s = s.replace(/\bHarness\b/g, "Beam Agent");

  // Env / credential names
  if (dualCredential) {
    // Keep reading both: replace default string but add aliases in specific files later
    s = s.split("DEEPSEEK_API_KEY").join("BEAM_API_KEY");
    s = s.split("DEEPSEEK_BASE_URL").join("BEAM_BASE_URL");
  }

  // DSH_ env leftovers in comments/strings that are user/docs facing
  s = s.replace(/\bDSH_HOME\b/g, "BEAM_HOME");
  s = s.replace(/\bDSH Local Build\b/gi, "Beam Agent");

  // Package short names in package.json name fields already handled via @assistix rewrite;
  // also fix "name": "dsh-..." without scope
  s = s.replace(/"name"\s*:\s*"dsh-/g, '"name": "beam-');
  s = s.replace(/"name"\s*:\s*"dsh"/g, '"name": "beam"');

  return s;
}

function renameScopeTree(appRoot) {
  const nm = path.join(appRoot, "dsh", "node_modules");
  const oldScope = path.join(nm, "@deepseek-ai");
  const newScope = path.join(nm, "@assistix");
  if (!fs.existsSync(oldScope)) {
    // maybe already renamed
    if (fs.existsSync(newScope)) {
      report.notes = report.notes || [];
      return newScope;
    }
    // try beam/node_modules
    const alt = path.join(appRoot, "beam", "node_modules", "@deepseek-ai");
    if (fs.existsSync(alt)) return renamePackagesInScope(alt, path.join(appRoot, "beam", "node_modules", "@assistix"));
    return null;
  }
  return renamePackagesInScope(oldScope, newScope);
}

function renamePackagesInScope(oldScope, newScope) {
  fs.mkdirSync(path.dirname(newScope), { recursive: true });
  // First rename each package folder for dsh- → beam-
  const pkgs = fs.readdirSync(oldScope, { withFileTypes: true }).filter((d) => d.isDirectory());
  const tmpScope = oldScope + ".__beam_rename__";
  fs.renameSync(oldScope, tmpScope);
  fs.mkdirSync(newScope, { recursive: true });
  for (const d of pkgs) {
    const neu = mapPkgFolder(d.name);
    const from = path.join(tmpScope, d.name);
    const to = path.join(newScope, neu);
    fs.renameSync(from, to);
    if (neu !== d.name) report.renamedDirs.push(`${d.name} → ${neu}`);
  }
  // remove tmp if empty
  try {
    fs.rmSync(tmpScope, { recursive: true, force: true });
  } catch {}
  report.renamedDirs.push("@deepseek-ai → @assistix");
  return newScope;
}

function renameDshFolder(appRoot) {
  const oldD = path.join(appRoot, "dsh");
  const newD = path.join(appRoot, "beam");
  if (fs.existsSync(oldD) && !fs.existsSync(newD)) {
    fs.renameSync(oldD, newD);
    report.renamedDirs.push("dsh/ → beam/");
    return newD;
  }
  return fs.existsSync(newD) ? newD : oldD;
}

function patchAllText(root) {
  const files = walkFiles(root);
  for (const file of files) {
    if (!isTextFile(file)) continue;
    // skip huge binaries mistaken
    const st = fs.statSync(file);
    if (st.size > 8_000_000) continue;
    let s;
    try {
      s = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (
      !/@deepseek-ai|DeepSeek|Harness|DEEPSEEK_|dsh-app|dsh-platform|deepseek-official|deepseek-account|\/dsh\/|\\dsh\\|["']dsh["']/.test(
        s
      ) &&
      !/"name": "dsh/.test(s)
    ) {
      continue;
    }
    const next = rewriteContent(s);
    if (next !== s) {
      fs.writeFileSync(file, next);
      report.filesPatched++;
    }
  }
}

function patchCredentialDualRead(appRoot) {
  // llm api-key package: accept BEAM_API_KEY or legacy DEEPSEEK_API_KEY
  const candidates = [
    path.join(appRoot, "beam", "node_modules", "@assistix", "beam-llm-assistix-api-key", "lib", "index.js"),
    path.join(appRoot, "beam", "node_modules", "@assistix", "beam-llm-deepseek-api-key", "lib", "index.js"),
    path.join(appRoot, "beam", "node_modules", "@assistix", "beam-llm-api-key", "lib", "index.js"),
  ];
  // after rename, dsh-llm-deepseek-api-key → beam-llm-assistix-api-key (deepseek→assistix)
  const apiKeyDir = path.join(appRoot, "beam", "node_modules", "@assistix");
  if (!fs.existsSync(apiKeyDir)) return;
  for (const name of fs.readdirSync(apiKeyDir)) {
    if (!/llm.*api-key/i.test(name) && name !== "beam-llm-assistix-api-key") continue;
    const f = path.join(apiKeyDir, name, "lib", "index.js");
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, "utf8");
    if (s.includes("BEAM_API_KEY_ALIASES")) continue;
    // Inject alias resolution after credentialRef default
    if (s.includes('credentialRef(apiKeyEnv ?? "BEAM_API_KEY")')) {
      s = s.replace(
        'credentialRef(apiKeyEnv ?? "BEAM_API_KEY")',
        'credentialRef(apiKeyEnv ?? "BEAM_API_KEY") /* BEAM_API_KEY_ALIASES */'
      );
    }
    // presentApiKey: try BEAM then legacy
    if (s.includes("const presentApiKey = async") && !s.includes("LEGACY_DEEPSEEK_API_KEY")) {
      s = s.replace(
        "const presentApiKey = async (connection) => {\n\t\ttry {\n\t\t\treturn await resolveApiKey(connection);\n\t\t} catch (error) {\n\t\t\tif (error instanceof LlmError && error.code === \"MISSING_CREDENTIAL\") return void 0;\n\t\t\tthrow error;\n\t\t}\n\t};",
        `const presentApiKey = async (connection) => {
\t\ttry {
\t\t\treturn await resolveApiKey(connection);
\t\t} catch (error) {
\t\t\tif (error instanceof LlmError && error.code === "MISSING_CREDENTIAL") {
\t\t\t\t/* LEGACY_DEEPSEEK_API_KEY: temporary dual-read */
\t\t\t\ttry {
\t\t\t\t\tconst legacy = { ...connection, apiKeyEnv: credentialRef("DEEPSEEK_API_KEY") };
\t\t\t\t\treturn await resolveApiKey(legacy);
\t\t\t\t} catch { return void 0; }
\t\t\t}
\t\t\tthrow error;
\t\t}
\t};`
      );
      report.mustKeepTemporarily.push(
        "Dual-read DEEPSEEK_API_KEY in beam-llm-*-api-key if BEAM_API_KEY missing (one release)."
      );
    }
    fs.writeFileSync(f, s);
  }
}

function patchStartScripts() {
  for (const rel of ["dist/Beam-Agent/Start Beam Agent.cmd", "Start Beam Agent.cmd"]) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, "utf8");
    s = s.replace(/set "DSH_HOME=/g, 'set "BEAM_HOME=');
    s = s.replace(/%DSH_HOME%/g, "%BEAM_HOME%");
    // remove DEEPSEEK aliases if we fully moved — keep one release dual write
    if (!s.includes("REM dual-cred")) {
      s = s.replace(
        /set "DEEPSEEK_API_KEY=%BEAM_API_KEY%"\r?\nset "DEEPSEEK_BASE_URL=%BEAM_BASE_URL%"/,
        "REM dual-cred removed — provider uses BEAM_API_KEY only"
      );
    }
    fs.writeFileSync(f, s);
    report.filesPatched++;
  }
}

function renameWorkspaceJunk() {
  const old = path.join(ROOT, "_deepseek_harness_src");
  const neu = path.join(ROOT, "_beam_upstream_src");
  if (fs.existsSync(old) && !fs.existsSync(neu)) {
    try {
      fs.renameSync(old, neu);
      report.renamedDirs.push("_deepseek_harness_src → _beam_upstream_src");
    } catch (e) {
      report.leftovers.push(`Could not rename _deepseek_harness_src: ${e.message}`);
    }
  }
}

function scanLeftovers(roots) {
  const hits = new Map();
  const re = /@deepseek-ai|DeepSeek|Harness|DEEPSEEK_|deepseek-harness|deepseek_harness/gi;
  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!isTextFile(file)) continue;
      if (file.includes("_beam_upstream_src") || file.includes("_tmp_app")) continue;
      let s;
      try {
        s = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const m = s.match(re);
      if (m) {
        const key = path.relative(ROOT, file);
        hits.set(key, [...new Set(m.map((x) => x.toLowerCase()))].join(","));
      }
    }
  }
  report.leftovers = [...hits.entries()].slice(0, 80).map(([f, k]) => `${f}: ${k}`);
  report.leftoverCount = hits.size;
}

// --- run ---
renameWorkspaceJunk();
patchStartScripts();

for (const appRoot of APP_TREES) {
  report.trees.push(appRoot);
  // 1) rename packages under @deepseek-ai while still in dsh/
  renameScopeTree(appRoot);
  // 2) rename dsh → beam folder
  renameDshFolder(appRoot);
  // 3) rewrite all text under app root
  patchAllText(appRoot);
  // 4) dual credential
  patchCredentialDualRead(appRoot);
}

// Also patch desktop/bridge and desktop scripts
for (const extra of [
  path.join(ROOT, "desktop", "bridge"),
  path.join(ROOT, "desktop"),
  path.join(ROOT, "dist", "Beam-Agent", "bridge"),
]) {
  if (fs.existsSync(extra)) patchAllText(extra);
}

// Update ~/.beam credentials ref names
const cred = path.join(process.env.USERPROFILE || "", ".beam", ".credentials.yaml");
if (fs.existsSync(cred)) {
  let s = fs.readFileSync(cred, "utf8");
  const next = s.replace(/DEEPSEEK_API_KEY/g, "BEAM_API_KEY");
  if (next !== s) {
    // keep legacy key too
    if (!next.includes("DEEPSEEK_API_KEY")) {
      fs.writeFileSync(
        cred,
        next + (next.endsWith("\n") ? "" : "\n") + "  DEEPSEEK_API_KEY: beam-assistix-local\n"
      );
      report.mustKeepTemporarily.push(
        "~/.beam/.credentials.yaml keeps DEEPSEEK_API_KEY alias → same secret for one release"
      );
    } else fs.writeFileSync(cred, next);
  }
}
const envf = path.join(process.env.USERPROFILE || "", ".beam", ".env");
if (fs.existsSync(envf)) {
  // Keep API keys; never promote BASE_URL into .env (launcher-only via VBS PROCESS env).
  const banned = /^(BEAM_BASE_URL|BEAM_HOME|DEEPSEEK_BASE_URL|DSH_HOME|DEEPSEEK_SEARCH_BASE_URL)=/i;
  let lines = fs
    .readFileSync(envf, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !banned.test(l));
  let s = lines.join("\n");
  if (!/BEAM_API_KEY=/i.test(s) && /DEEPSEEK_API_KEY=/i.test(s)) {
    s = s.replace(/DEEPSEEK_API_KEY=/i, "BEAM_API_KEY=");
  }
  if (!/BEAM_API_KEY=/i.test(s)) s = "BEAM_API_KEY=beam-assistix-local\n" + s;
  if (!/DEEPSEEK_API_KEY=/i.test(s)) {
    const key = (s.match(/BEAM_API_KEY=(.+)/i) || [])[1] || "beam-assistix-local";
    s += (s.endsWith("\n") ? "" : "\n") + `DEEPSEEK_API_KEY=${key}\n`;
  }
  fs.writeFileSync(envf, s.endsWith("\n") ? s : s + "\n");
}

scanLeftovers([
  path.join(ROOT, "dist", "Beam-Agent"),
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "desktop", "bridge"),
]);

console.log(JSON.stringify(report, null, 2));
