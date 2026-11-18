/**
 * Focused verify: Beam Projects storage isolation + create-by-name helpers.
 * Does not launch Electron.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.USERPROFILE || os.homedir();
const BEAM_HOME = process.env.BEAM_HOME || path.join(HOME, ".beam");
const fail = [];
const ok = [];

function check(name, cond, detail = "") {
  if (cond) ok.push(name);
  else fail.push(`${name}${detail ? ": " + detail : ""}`);
}

const workspaceJson = path.join(BEAM_HOME, "storages", "workspace.json");
check("workspace.json exists", fs.existsSync(workspaceJson));
const ws = JSON.parse(fs.readFileSync(workspaceJson, "utf8"));
const paths = Object.values(ws.tables?.workspaces || {}).map((w) => String(w.path || ""));
check(
  "no DeepSeek paths in workspace.json",
  !paths.some((p) => /deepseek-harness|\.deepseek|DeepSeek Harness/i.test(p)),
  paths.join(" | ")
);
check("projects dir exists", fs.existsSync(path.join(BEAM_HOME, "projects")));
check(".deepseek is not Beam home", !fs.existsSync(path.join(HOME, ".deepseek")) || path.resolve(BEAM_HOME) !== path.resolve(path.join(HOME, ".deepseek")));

const ctrl = path.join(
  ROOT,
  "dist",
  "Beam Agent",
  "resources",
  "app",
  "beam",
  "node_modules",
  "@assistix",
  "beam-api-workspace-controller",
  "lib",
  "index.js"
);
const ui = path.join(
  ROOT,
  "dist",
  "Beam Agent",
  "resources",
  "app",
  "beam",
  "node_modules",
  "@assistix",
  "beam-client-ui-workspace",
  "lib",
  "client.js"
);
const remotes = path.join(
  ROOT,
  "dist",
  "Beam Agent",
  "resources",
  "app",
  "beam",
  "node_modules",
  "@assistix",
  "beam-api-remotes",
  "lib",
  "client.js"
);
const vbs = path.join(ROOT, "dist", "Beam Agent", "Start Beam Agent.vbs");

const ctrlSrc = fs.readFileSync(ctrl, "utf8");
check("host named create", ctrlSrc.includes("allocateNamedBeamProjectPath"));
check("host harness reject", ctrlSrc.includes("isForbiddenHarnessProjectPath"));
check("host baseline filter", ctrlSrc.includes("beam-projects-isolate-baseline"));
check("host no Documents/deepseek-harness default", !/join\(directory,\s*['"]deepseek-harness['']/.test(ctrlSrc));

const uiSrc = fs.readFileSync(ui, "utf8");
check("UI create by name", uiSrc.includes("createWorkspace({ title: name })"));
check("UI choose folder", uiSrc.includes("BEAM_ADD_FOLDER") || uiSrc.includes("menu.chooseFolder"));
check("UI Projects EN", uiSrc.includes('"section.workspaces": "Projects"'));
check("UI Projects RU", uiSrc.includes('"section.workspaces": "Проекты"'));
check("UI no auto folder-only add", uiSrc.includes("const addIsTheOnlyEntry = false"));

const remSrc = fs.readFileSync(remotes, "utf8");
check("remotes title optional", remSrc.includes('"title": zod.z.string().readonly().optional()'));

const typertHost = path.join(
  ROOT,
  "dist",
  "Beam Agent",
  "resources",
  "app",
  "beam",
  "node_modules",
  "@assistix",
  "beam-api-workspace-controller",
  "lib",
  "typert.host.js"
);
const typertRemote = path.join(
  ROOT,
  "dist",
  "Beam Agent",
  "resources",
  "app",
  "beam",
  "node_modules",
  "@assistix",
  "beam-api-workspace-controller",
  "lib",
  "typert.remote-client.js"
);
for (const [label, file] of [
  ["typert.host", typertHost],
  ["typert.remote-client", typertRemote],
]) {
  const src = fs.readFileSync(file, "utf8");
  const createZod = src.match(
    /workspace_create_parameter_0\$schema = \(\) =>[\s\S]*?z\.(?:strictObject|object)\(\{([\s\S]*?)\}\)/
  )?.[1] || "";
  check(`${label} path optional`, /'path': z\.string\(\)\.readonly\(\)\.optional\(\)/.test(createZod));
  check(`${label} title optional`, /'title': z\.string\(\)\.readonly\(\)\.optional\(\)/.test(createZod));
  const createEndpoint = src.split("'workspace/create'")[1]?.slice(0, 1200) || "";
  check(`${label} create jsonSchema no required path`, !/"required":\["path"\]/.test(createEndpoint));
}

check("UI create modal marker", uiSrc.includes("beam-create-project-modal"));
check("UI friendly create catch", uiSrc.includes('t("create.failed")'));
check("UI create.failed i18n", uiSrc.includes('"create.failed"'));

const vbsSrc = fs.readFileSync(vbs, "utf8");
check("VBS BEAM_HOME=.beam", vbsSrc.includes('\\.beam"') || vbsSrc.includes("\\.beam"));
check("VBS ensures projects", vbsSrc.includes('\\projects"') || vbsSrc.includes("\\projects"));
check("VBS DSH_HOME aliases Beam", /DSH_HOME.*=.*beamHome/i.test(vbsSrc));
check("VBS no deepseek-harness", !/deepseek-harness/i.test(vbsSrc));

// Exercise helpers by evaluating the same logic inline
const { mkdir, access, rm } = await import("node:fs/promises");
const { homedir } = await import("node:os");
const { win32, posix } = await import("node:path");
function beamProjectsHome() {
  const envHome =
    (typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim()) ||
    (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim()) ||
    undefined;
  const paths = process.platform === "win32" ? win32 : posix;
  const home = envHome ? paths.normalize(envHome) : paths.join(homedir(), ".beam");
  return paths.join(home, "projects");
}
function sanitizeBeamProjectSlug(title) {
  const cleaned = String(title || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");
  return (cleaned || "project").slice(0, 80);
}
function isForbiddenHarnessProjectPath(candidate) {
  return /deepseek-harness|\.deepseek([\\/]|$)|[\\/]DeepSeek Harness([\\/]|$)|@deepseek-ai[\\/]dsh-|Local[\\/]Programs[\\/]DeepSeek/i.test(
    String(candidate || "")
  );
}
async function allocateNamedBeamProjectPath(title) {
  const paths = process.platform === "win32" ? win32 : posix;
  const root = beamProjectsHome();
  await mkdir(root, { recursive: true });
  const slug = sanitizeBeamProjectSlug(title);
  let candidate = paths.join(root, slug);
  let n = 2;
  for (;;) {
    try {
      await access(candidate);
      candidate = paths.join(root, slug + "-" + n++);
    } catch {
      break;
    }
  }
  await mkdir(candidate, { recursive: true });
  return candidate;
}

const probeName = `_beam_verify_${Date.now()}`;
const created = await allocateNamedBeamProjectPath(probeName);
check("create-by-name under ~/.beam/projects", created.replaceAll("\\", "/").includes("/.beam/projects/"));
check("created folder exists", fs.existsSync(created));
check(
  "reject deepseek-harness path",
  isForbiddenHarnessProjectPath("C:\\Users\\Alexa\\OneDrive\\Documents\\deepseek-harness\\default-workspace")
);
check("allow beam project path", !isForbiddenHarnessProjectPath(created));
await rm(created, { recursive: true, force: true });

console.log(JSON.stringify({ ok, fail, beamHome: BEAM_HOME, workspacePaths: paths }, null, 2));
if (fail.length) process.exit(1);
