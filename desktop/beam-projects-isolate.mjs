/**
 * Beam Projects isolation + create-by-name / create-from-folder.
 *
 * - Durable store: ~/.beam/storages/workspace.json + ~/.beam/projects/<name>
 * - Never reads/imports DeepSeek Harness paths
 * - UI: Projects/Проекты; create by name OR adopt existing folder
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.USERPROFILE || os.homedir();
const BEAM_HOME = process.env.BEAM_HOME || path.join(HOME, ".beam");
const PROJECTS_ROOT = path.join(BEAM_HOME, "projects");
const DEFAULT_WS = path.join(BEAM_HOME, "default-workspace");
const report = [];

const TREES = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix"),
];

const HARNESS_PATH_RE =
  /deepseek-harness|\.deepseek([\\/]|$)|[\\/]DeepSeek Harness([\\/]|$)|@deepseek-ai[\\/]dsh-|Local[\\/]Programs[\\/]DeepSeek/i;

function log(msg) {
  report.push(msg);
  console.log(msg);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function patchFile(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after === before) return false;
  fs.writeFileSync(file, after);
  log(`patched ${path.relative(ROOT, file)}`);
  return true;
}

function assistixFiles(rel) {
  return TREES.map((t) => path.join(t, rel)).filter((p) => fs.existsSync(p));
}

// --- 0) Durable Beam hierarchy ---
ensureDir(BEAM_HOME);
ensureDir(PROJECTS_ROOT);
ensureDir(DEFAULT_WS);
ensureDir(path.join(BEAM_HOME, "storages"));
ensureDir(path.join(BEAM_HOME, "sessions"));
ensureDir(path.join(BEAM_HOME, "electron-userdata"));
log(`beam home => ${BEAM_HOME}`);
log(`projects root => ${PROJECTS_ROOT}`);

// --- 1) Quarantine DeepSeek-origin entries from workspace.json ---
const workspaceJson = path.join(BEAM_HOME, "storages", "workspace.json");
if (fs.existsSync(workspaceJson)) {
  const j = JSON.parse(fs.readFileSync(workspaceJson, "utf8"));
  const tables = j.tables?.workspaces || {};
  const removed = [];
  for (const id of Object.keys(tables)) {
    const ws = tables[id];
    if (!ws) continue;
    const p = String(ws.path || "");
    if (HARNESS_PATH_RE.test(p)) {
      removed.push({ id, path: p, title: ws.title });
      delete tables[id];
    }
  }
  if (removed.length) {
    const keepIds = Object.keys(tables);
    j.global = j.global || {};
    j.global.workspaceIds = (j.global.workspaceIds || []).filter((id) => keepIds.includes(id));
    if (j.global.defaultWorkspaceId && !keepIds.includes(j.global.defaultWorkspaceId)) {
      j.global.defaultWorkspaceId = keepIds[0];
    }
    const quarantineDir = path.join(BEAM_HOME, "quarantine", "deepseek-workspaces");
    ensureDir(quarantineDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(quarantineDir, `removed-${stamp}.json`),
      JSON.stringify({ removed, at: new Date().toISOString() }, null, 2)
    );
    fs.writeFileSync(workspaceJson, JSON.stringify(j, null, 2) + "\n");
    log(`quarantined ${removed.length} DeepSeek-origin project(s)`);
  } else {
    log("workspace.json has no DeepSeek-origin paths");
  }
} else {
  // Minimal Beam-only registry
  const id = "1fa560b7-3904-4f24-884a-93ef51a560d3";
  const now = new Date().toISOString();
  fs.writeFileSync(
    workspaceJson,
    JSON.stringify(
      {
        unit: { name: "workspace", version: 2 },
        global: {
          initialized: true,
          workspaceIds: [id],
          archivedSessionIds: [],
          pinnedSessionIds: [],
          defaultWorkspaceId: id,
        },
        tables: {
          workspaces: {
            [id]: {
              path: DEFAULT_WS,
              title: "Beam Agent",
              sessionIds: [],
              createdAt: now,
              updatedAt: now,
            },
          },
        },
      },
      null,
      2
    ) + "\n"
  );
  log("created Beam-only workspace.json");
}

// Scrub session caches that still point at harness dirs
function scrubJsonTree(dir, depth = 0) {
  if (depth > 8 || !fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) scrubJsonTree(fp, depth + 1);
    else if (ent.name.endsWith(".json")) {
      try {
        const s = fs.readFileSync(fp, "utf8");
        if (!HARNESS_PATH_RE.test(s) && !/DeepSeek\s*Harness/i.test(s)) continue;
        let out = s;
        out = out.replace(/C:\\\\Users\\\\Alexa\\\\OneDrive\\\\Documents\\\\deepseek-harness\\\\default-workspace/gi, DEFAULT_WS.replaceAll("\\", "\\\\"));
        out = out.replace(/C:\/Users\/Alexa\/OneDrive\/Documents\/deepseek-harness\/default-workspace/gi, DEFAULT_WS.replaceAll("\\", "/"));
        out = out.replace(/deepseek-harness/gi, "Beam Agent");
        out = out.replace(/DeepSeek\s*Harness/gi, "Beam Agent");
        if (out !== s) {
          fs.writeFileSync(fp, out);
          log(`scrubbed ${fp}`);
        }
      } catch {}
    }
  }
}
scrubJsonTree(path.join(BEAM_HOME, "storages"));
scrubJsonTree(path.join(BEAM_HOME, "sessions"));

// --- 2) Host: create-by-name under ~/.beam/projects + reject harness paths ---
const CREATE_HELPER = `
function beamProjectsHome() {
	const envHome = (typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim()) || (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim()) || undefined;
	const paths = process.platform === "win32" ? win32 : posix;
	const home = envHome ? paths.normalize(envHome) : paths.join(homedir(), ".beam");
	return paths.join(home, "projects");
}
function sanitizeBeamProjectSlug(title) {
	const cleaned = String(title || "").trim().replace(/[<>:"/\\\\\\\\|?*\\u0000-\\u001f]/g, "-").replace(/\\s+/g, " ").replace(/[. ]+$/g, "");
	return (cleaned || "project").slice(0, 80);
}
function isForbiddenHarnessProjectPath(candidate) {
	return /deepseek-harness|\\.deepseek([\\\\\\\\/]|$)|[\\\\\\\\/]DeepSeek Harness([\\\\\\\\/]|$)|@deepseek-ai[\\\\\\\\/]dsh-|Local[\\\\\\\\/]Programs[\\\\\\\\/]DeepSeek/i.test(String(candidate || ""));
}
async function allocateNamedBeamProjectPath(title) {
	const { mkdir, access } = await import("node:fs/promises");
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
`;

const NEW_CREATE_METHOD = `create(request) {
		return this.enqueue(async () => {
			try {
				const { mkdir } = await import("node:fs/promises");
				let path = typeof request.path === "string" ? request.path.trim() : "";
				const title = typeof request.title === "string" ? request.title.trim() : "";
				if (!path && !title) throw new RemoteError("gateway/bad-request", "Project create requires a name or folder path", {});
				if (!path && title) path = await allocateNamedBeamProjectPath(title);
				if (isForbiddenHarnessProjectPath(path)) throw new RemoteError("workspace/invalid-path", "DeepSeek Harness paths cannot be used as Beam projects", { path });
				await mkdir(path, { recursive: true });
				const existing = await this.ctx.workspaceRegistry.resolveByPath(path);
				if (existing !== void 0) {
					if (title && title !== existing.title) await existing.setTitle(title);
					return {
						workspace: workspaceView(existing),
						created: false
					};
				}
				return {
					workspace: workspaceView(await this.ctx.workspaceRegistry.create(path, title || void 0)),
					created: true
				};
			} catch (error) {
				if (remoteErrorOf(error) !== void 0) throw error;
				throw new RemoteError("workspace/invalid-path", \`cannot create a Project at "\${request.path || request.title}": \${errorMessage$1(error)}\`, { path: request.path }, { cause: error });
			}
		});
	}`;

for (const file of assistixFiles("beam-api-workspace-controller/lib/index.js")) {
  patchFile(file, (s) => {
    if (!s.includes("function beamProjectsHome()")) {
      s = s.replace(
        "//#region lib/types/commands.js",
        `//#region lib/types/commands.js\n${CREATE_HELPER}`
      );
    }
    s = s.replace(
      /create\(request\) \{\s*return this\.enqueue\(async \(\) => \{[\s\S]*?throw new RemoteError\("workspace\/invalid-path", `cannot create a Workspace at "\$\{request\.path\}": \$\{errorMessage\$1\(error\)\}`, \{ path: request\.path \}, \{ cause: error \}\);\s*\}\s*\}\);\s*\}/,
      NEW_CREATE_METHOD
    );
    // Filter DeepSeek paths from feed baseline
    if (!s.includes("/* beam-projects-isolate-baseline */")) {
      s = s.replace(
        `baseline() {
		return {
			items: this.ctx.workspaceRegistry.list().map(workspaceView),
			archivedSessionIds: [...this.ctx.workspaceRegistry.archivedSessionIds],
			pinnedSessionIds: [...this.ctx.workspaceRegistry.pinnedSessionIds]
		};
	}`,
        `baseline() {
		/* beam-projects-isolate-baseline */
		return {
			items: this.ctx.workspaceRegistry.list().filter((workspace) => !isForbiddenHarnessProjectPath(workspace.path)).map(workspaceView),
			archivedSessionIds: [...this.ctx.workspaceRegistry.archivedSessionIds],
			pinnedSessionIds: [...this.ctx.workspaceRegistry.pinnedSessionIds]
		};
	}`
      );
    }
    // Keep default under ~/.beam
    if (s.includes('paths.join(directory, "deepseek-harness"')) {
      s = s.replace(
        /return paths\.join\(directory,\s*['"]deepseek-harness['"],\s*DEFAULT_WORKSPACE_DIRECTORY\);/g,
        `const envHome = (typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim()) || (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim()) || undefined;
	const beamHome = envHome ? paths.normalize(envHome) : paths.join(internals.home ?? homedir(), ".beam");
	if (!paths.isAbsolute(beamHome)) throw new Error(\`Beam home must be fully qualified: '\${beamHome}'\`);
	signal.throwIfAborted();
	return paths.join(beamHome, DEFAULT_WORKSPACE_DIRECTORY);`
      );
    }
    return s;
  });
}

for (const file of assistixFiles("beam-api-workspace-controller/lib/types/default-directory.js")) {
  patchFile(file, (s) => {
    if (s.includes('paths.join(beamHome, DEFAULT_WORKSPACE_DIRECTORY)')) return s;
    return s;
  });
}

// --- 3) Gateway/Remotes schema: path optional + title optional ---
// Root cause of create-by-name failure: host typert validates wire field "request"
// against WorkspaceCreateRequest requiring path and rejecting title. Remotes zod was
// loosened earlier, but gateway registers typert.host.js — that must match.
const TYPERT_CREATE_SCHEMA = `() => (_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0$schema$value ??= z.object({
  'path': z.string().readonly().optional(),
  'title': z.string().readonly().optional(),
}))`;
const TYPERT_CREATE_STRICT = `() => (_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict$schema$value ??= z.strictObject({
  'path': z.string().readonly().optional(),
  'title': z.string().readonly().optional(),
}))`;
const TYPERT_JSON_LOOSE = `jsonSchema: {"type":"object","properties":{"path":{"type":"string"},"title":{"type":"string"}},"additionalProperties":true}`;
const TYPERT_JSON_STRICT = `jsonSchema: {"type":"object","properties":{"path":{"type":"string"},"title":{"type":"string"}},"additionalProperties":false}`;

function patchWorkspaceCreateSchemas(s, { zodPrefix = "z", quote = "'" } = {}) {
  const pathOnlyObject = new RegExp(
    `(_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\\$schema = \\(\\) =>[^=]*=\\?=\\s*${zodPrefix}\\.object\\(\\{\\s*${quote}path${quote}:\\s*${zodPrefix}\\.string\\(\\)\\.readonly\\(\\)\\s*,?\\s*\\}\\))`,
    "m"
  );
  const pathOnlyStrict = new RegExp(
    `(_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\\$schema = \\(\\) =>[^=]*=\\?=\\s*${zodPrefix}\\.strictObject\\(\\{\\s*${quote}path${quote}:\\s*${zodPrefix}\\.string\\(\\)\\.readonly\\(\\)\\s*,?\\s*\\}\\))`,
    "m"
  );
  // Already-patched or path-required → force optional path+title
  s = s.replace(
    /const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema = \(\) => \(_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema\$value \?\?= z\.object\(\{[\s\S]*?\}\)\)/,
    `const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0$schema = ${TYPERT_CREATE_SCHEMA}`
  );
  s = s.replace(
    /const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema = \(\) => \(_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema\$value \?\?= z\.strictObject\(\{[\s\S]*?\}\)\)/,
    `const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict$schema = ${TYPERT_CREATE_STRICT}`
  );
  // Remotes bundled client uses zod.z and double quotes / semicolons
  s = s.replace(
    /const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema = \(\) => _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema\$value \?\?= zod\.z\.object\(\{[^}]*\}\);?/,
    `const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0$schema = () => _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0$schema$value ??= zod.z.object({ "path": zod.z.string().readonly().optional(), "title": zod.z.string().readonly().optional() });`
  );
  s = s.replace(
    /const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema = \(\) => _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema\$value \?\?= zod\.z\.strictObject\(\{[^}]*\}\);?/,
    `const _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict$schema = () => _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict$schema$value ??= zod.z.strictObject({ "path": zod.z.string().readonly().optional(), "title": zod.z.string().readonly().optional() });`
  );
  // jsonSchema next to WorkspaceCreateRequest codecs (host/remote/remotes)
  s = s.replace(
    /("typeSymbol":\s*"@assistix\/beam-api-workspace-controller\/types#WorkspaceCreateRequest",\s*"create":\s*_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema,\s*)"jsonSchema":\s*\{[^}]*"properties":\s*\{\s*"path":\s*\{\s*"type":\s*"string"\s*\}\s*\}[^}]*\}/g,
    `$1${TYPERT_JSON_LOOSE.replace("jsonSchema: ", '"jsonSchema": ')}`
  );
  s = s.replace(
    /("typeSymbol":\s*"@assistix\/beam-api-workspace-controller\/types#WorkspaceCreateRequest",\s*"create":\s*_deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema,\s*)"jsonSchema":\s*\{[^}]*"properties":\s*\{\s*"path":\s*\{\s*"type":\s*"string"\s*\}\s*\}[^}]*\}/g,
    `$1${TYPERT_JSON_STRICT.replace("jsonSchema: ", '"jsonSchema": ')}`
  );
  // host/remote single-line jsonSchema form
  s = s.replace(
    /(typeSymbol: '@assistix\/beam-api-workspace-controller\/types#WorkspaceCreateRequest',\s*create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema,\s*)jsonSchema: \{"type":"object","properties":\{"path":\{"type":"string"\}\},"required":\["path"\],"additionalProperties":true\}/g,
    `$1${TYPERT_JSON_LOOSE}`
  );
  s = s.replace(
    /(typeSymbol: '@assistix\/beam-api-workspace-controller\/types#WorkspaceCreateRequest',\s*create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema,\s*)jsonSchema: \{"type":"object","properties":\{"path":\{"type":"string"\}\},"required":\["path"\],"additionalProperties":false\}/g,
    `$1${TYPERT_JSON_STRICT}`
  );
  // remotes pretty-printed create codec jsonSchema (path-only)
  s = s.replace(
    /(create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0\$schema,\s*jsonSchema: \{\s*"type": "object",\s*"properties": \{ "path": \{ "type": "string" \} \},\s*"required": \["path"\],\s*"additionalProperties": true\s*\})/g,
    `create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"path": { "type": "string" },
									"title": { "type": "string" }
								},
								"additionalProperties": true
							}`
  );
  s = s.replace(
    /(create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict\$schema,\s*jsonSchema: \{\s*"type": "object",\s*"properties": \{ "path": \{ "type": "string" \} \},\s*"required": \["path"\],\s*"additionalProperties": false\s*\})/g,
    `create: _deepseek_ai_dsh_api_workspace_controller_workspace_create_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"path": { "type": "string" },
									"title": { "type": "string" }
								},
								"additionalProperties": false
							}`
  );
  s = s.replace(
    `"description": "Create or idempotently resolve one Workspace over an existing directory."`,
    `"description": "Create a Beam Project by name (under ~/.beam/projects) or adopt an existing folder."`
  );
  s = s.replace(
    `description: 'Create or idempotently resolve one Workspace over an existing directory.'`,
    `description: 'Create a Beam Project by name (under ~/.beam/projects) or adopt an existing folder.'`
  );
  s = s.replace(
    `"description": "directory path to register."`,
    `"description": "folder path and/or project title."`
  );
  s = s.replace(
    `description: 'directory path to register.'`,
    `description: 'folder path and/or project title.'`
  );
  s = s.replace(
    `"declaration": "export interface WorkspaceCreateRequest {\\n    readonly path: string;\\n}"`,
    `"declaration": "export interface WorkspaceCreateRequest {\\n    readonly path?: string;\\n    readonly title?: string;\\n}"`
  );
  void pathOnlyObject;
  void pathOnlyStrict;
  return s;
}

for (const rel of [
  "beam-api-workspace-controller/lib/typert.host.js",
  "beam-api-workspace-controller/lib/typert.remote-client.js",
  "beam-api-remotes/lib/client.js",
]) {
  for (const file of assistixFiles(rel)) {
    patchFile(file, (s) => patchWorkspaceCreateSchemas(s));
  }
}

// --- 4) UI: create-by-name modal + choose folder; Projects copy ---
const CREATE_NAMED = "::create-named";
const ADD_FOLDER = "::add-folder";

for (const file of assistixFiles("beam-client-ui-workspace/lib/client.js")) {
  patchFile(file, (s) => {
    // Dual add entries instead of single folder-only add
    if (!s.includes("BEAM_CREATE_NAMED")) {
      s = s.replace(
        `const ADD_WORKSPACE = "::add-workspace";`,
        `const ADD_WORKSPACE = "::add-workspace";
		const BEAM_CREATE_NAMED = "${CREATE_NAMED}";
		const BEAM_ADD_FOLDER = "${ADD_FOLDER}";`
      );
    }

    // Replace addEntries + auto-open directory with create/choose menu
    s = s.replace(
      `const addEntries = flowAvailable ? [{
				id: ADD_WORKSPACE,
				label: t("menu.addWorkspace"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 16 }),
				disabled: flowBusy
			}] : [];`,
      `const addEntries = [{
				id: BEAM_CREATE_NAMED,
				label: t("menu.createProject"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 16 }),
				disabled: flowBusy
			}, ...flowAvailable ? [{
				id: BEAM_ADD_FOLDER,
				label: t("menu.chooseFolder"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, { size: 16 }),
				disabled: flowBusy
			}] : []];`
    );

    // Stop auto-opening native folder picker when add is the only action
    s = s.replace(
      `const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
			(0, react.useEffect)(() => {
				if (open && addIsTheOnlyEntry && !flowBusy) openDirectoryFlow();
			}, [
				open,
				addIsTheOnlyEntry,
				flowBusy,
				openDirectoryFlow
			]);`,
      `const addIsTheOnlyEntry = false;`
    );

    // State + handlers for named create inside WorkspacePickFlow
    if (!s.includes("beamCreateOpen")) {
      s = s.replace(
        `const [pickingFolder, setPickingFolder] = (0, react.useState)(false);
			const flowBusy = flowOpen || pickingFolder;`,
        `const [pickingFolder, setPickingFolder] = (0, react.useState)(false);
			const [beamCreateOpen, setBeamCreateOpen] = (0, react.useState)(false);
			const [beamCreateName, setBeamCreateName] = (0, react.useState)("");
			const [beamCreateError, setBeamCreateError] = (0, react.useState)(null);
			const [beamCreating, setBeamCreating] = (0, react.useState)(false);
			const flowBusy = flowOpen || pickingFolder || beamCreateOpen || beamCreating;`
      );
    }

    s = s.replace(
      `const handleSelect = (id) => {
				if (id === ADD_WORKSPACE) {
					openDirectoryFlow();
					return;
				}
				onPick(id);
			};`,
      `const openNamedCreate = (0, react.useCallback)(() => {
				onClose();
				setErrorOpen(false);
				setModalError(null);
				setBeamCreateName("");
				setBeamCreateError(null);
				setBeamCreateOpen(true);
			}, [onClose]);
			const confirmNamedCreate = () => {
				const name = beamCreateName.trim();
				if (!name) {
					setBeamCreateError(t("create.nameRequired"));
					return;
				}
				setBeamCreating(true);
				setBeamCreateError(null);
				createWorkspace({ title: name }).then((workspace) => {
					setBeamCreateOpen(false);
					setBeamCreateName("");
					onPick(workspace.workspaceId);
				}).catch((reason) => {
					const raw = reason instanceof Error ? reason.message : String(reason);
					const code = reason && typeof reason === "object" && reason.rpcError && typeof reason.rpcError.code === "string" ? reason.rpcError.code : "";
					const friendly = code === "workspace/invalid-path" || /invalid-path|DeepSeek Harness/i.test(raw) ? t("create.invalidPath") : code === "workspace/conflict" || /already exists/i.test(raw) ? t("create.conflict") : /input-invalid|boundary validation/i.test(raw) ? t("create.failed") : raw.startsWith("workspace create failed:") ? t("create.failed") : raw;
					setBeamCreateError(friendly);
				}).finally(() => {
					setBeamCreating(false);
				});
			};
			const handleSelect = (id) => {
				if (id === ADD_WORKSPACE || id === BEAM_ADD_FOLDER) {
					openDirectoryFlow();
					return;
				}
				if (id === BEAM_CREATE_NAMED) {
					openNamedCreate();
					return;
				}
				onPick(id);
			};`
    );

    // Refresh friendly create errors on already-patched UI (tolerate CRLF)
    if (s.includes("createWorkspace({ title: name })") && !s.includes('t("create.failed")')) {
      s = s.replace(
        /\}\)\.catch\(\(reason\) => \{\r?\n\t+setBeamCreateError\(reason instanceof Error \? reason\.message : String\(reason\)\);\r?\n\t+\}\)\.finally\(\(\) => \{\r?\n\t+setBeamCreating\(false\);\r?\n\t+\}\);/,
        `}).catch((reason) => {
					const raw = reason instanceof Error ? reason.message : String(reason);
					const code = reason && typeof reason === "object" && reason.rpcError && typeof reason.rpcError.code === "string" ? reason.rpcError.code : "";
					const friendly = code === "workspace/invalid-path" || /invalid-path|DeepSeek Harness/i.test(raw) ? t("create.invalidPath") : code === "workspace/conflict" || /already exists/i.test(raw) ? t("create.conflict") : /input-invalid|boundary validation/i.test(raw) ? t("create.failed") : raw.startsWith("workspace create failed:") ? t("create.failed") : raw;
					setBeamCreateError(friendly);
				}).finally(() => {
					setBeamCreating(false);
				});`
      );
    }
    if (s.includes("open: beamCreateOpen") && !s.includes("beam-create-project-modal")) {
      s = s.replace(
        /open: beamCreateOpen,/,
        `/* beam-create-project-modal */\n\t\t\t\t\topen: beamCreateOpen,`
      );
    }

    // Inject create-name modal before folder-error modal closing of WorkspacePickFlow return
    if (!s.includes("beam-create-project-modal")) {
      s = s.replace(
        `(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: errorOpen,
					onClose: closeModal,
					closeLabel: t("close"),
					title: t("folderError.title"),`,
        `(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					/* beam-create-project-modal */
					open: beamCreateOpen,
					onClose: () => {
						if (beamCreating) return;
						setBeamCreateOpen(false);
						setBeamCreateError(null);
					},
					closeLabel: t("close"),
					title: t("create.title"),
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: beamCreating,
						onClick: () => {
							setBeamCreateOpen(false);
							setBeamCreateError(null);
						},
						children: t("cancel")
					}), flowAvailable && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: beamCreating,
						onClick: () => {
							setBeamCreateOpen(false);
							openDirectoryFlow();
						},
						children: t("menu.chooseFolder")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: beamCreating || !beamCreateName.trim(),
						onClick: confirmNamedCreate,
						children: t("create.action")
					})] }),
					children: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("input", {
						className: WorkspacePicker_module_css_default.modalError ? WorkspaceBrowser_module_css_default?.renameInput : void 0,
						style: {
							boxSizing: "border-box",
							width: "100%",
							height: "44px",
							borderRadius: "12px",
							border: "0.5px solid var(--dsw-alias-border-l4)",
							background: "transparent",
							color: "var(--dsw-alias-label-primary)",
							padding: "7px 14px",
							fontSize: "14px",
							outline: "none"
						},
						value: beamCreateName,
						placeholder: t("create.placeholder"),
						"aria-label": t("field.workspaceName"),
						"data-modal-autofocus": true,
						disabled: beamCreating,
						onChange: (e) => {
							setBeamCreateName(e.target.value);
							setBeamCreateError(null);
						},
						onKeyDown: (e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								confirmNamedCreate();
							}
						}
					}), beamCreateError !== null && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspacePicker_module_css_default.modalError,
						role: "alert",
						style: { marginTop: "8px" },
						children: beamCreateError
					})] })
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: errorOpen,
					onClose: closeModal,
					closeLabel: t("close"),
					title: t("folderError.title"),`
      );
    }

    // i18n: EN
    if (!s.includes('"menu.createProject": "New project"')) {
      s = s.replace(
        '"menu.addWorkspace": "Add project…",',
        '"menu.addWorkspace": "Add project…",\n\t\t\t"menu.createProject": "New project",\n\t\t\t"menu.chooseFolder": "Choose folder…",\n\t\t\t"create.title": "Create project",\n\t\t\t"create.action": "Create",\n\t\t\t"create.placeholder": "Project name",\n\t\t\t"create.nameRequired": "Enter a project name",\n\t\t\t"create.failed": "Couldn’t create the project. Try again.",\n\t\t\t"create.invalidPath": "That folder can’t be used as a Beam project.",\n\t\t\t"create.conflict": "A project with that name already exists.",'
      );
    }
    if (!s.includes('"create.failed": "Couldn’t create the project.')) {
      s = s.replace(
        '"create.nameRequired": "Enter a project name"',
        '"create.nameRequired": "Enter a project name",\n\t\t\t"create.failed": "Couldn’t create the project. Try again.",\n\t\t\t"create.invalidPath": "That folder can’t be used as a Beam project.",\n\t\t\t"create.conflict": "A project with that name already exists."'
      );
    }

    // i18n: RU
    if (!s.includes('"menu.createProject": "Новый проект"')) {
      s = s.replace(
        '"menu.addWorkspace": "Добавить проект…",',
        '"menu.addWorkspace": "Добавить проект…",\n\t\t\t"menu.createProject": "Новый проект",\n\t\t\t"menu.chooseFolder": "Выбрать папку…",\n\t\t\t"create.title": "Создать проект",\n\t\t\t"create.action": "Создать",\n\t\t\t"create.placeholder": "Название проекта",\n\t\t\t"create.nameRequired": "Введите название проекта",\n\t\t\t"create.failed": "Не удалось создать проект. Попробуйте ещё раз.",\n\t\t\t"create.invalidPath": "Эту папку нельзя использовать как проект Beam.",\n\t\t\t"create.conflict": "Проект с таким названием уже есть.",'
      );
    }
    if (!s.includes('"create.failed": "Не удалось создать проект.')) {
      s = s.replace(
        '"create.nameRequired": "Введите название проекта"',
        '"create.nameRequired": "Введите название проекта",\n\t\t\t"create.failed": "Не удалось создать проект. Попробуйте ещё раз.",\n\t\t\t"create.invalidPath": "Эту папку нельзя использовать как проект Beam.",\n\t\t\t"create.conflict": "Проект с таким названием уже есть."'
      );
    }
    // Fix mixed RU leftovers for Projects
    const ruFixes = [
      ['"conflict.named": "A project named “{name}” already exists."', '"conflict.named": "Проект «{name}» уже существует."'],
      ['"rename.workspace.title": "Rename project"', '"rename.workspace.title": "Переименовать проект"'],
      ['"field.workspaceName": "Project name"', '"field.workspaceName": "Название проекта"'],
      ['"delete.workspace": "Delete project"', '"delete.workspace": "Удалить проект"'],
      [
        '"delete.desc": "This removes “{name}” from the project list. The folder and session logs will be kept. Its sessions will appear under Ungrouped."',
        '"delete.desc": "«{name}» будет убран из списка проектов. Папка и журналы сессий сохранятся; сессии появятся в «Без группы»."',
      ],
      ['"delete.pending": "Deleting project…"', '"delete.pending": "Удаление проекта…"'],
      ['"groupBy.workspace": "Project"', '"groupBy.workspace": "По проекту"'],
      ['"groupBy.workspaceTree": "Project tree"', '"groupBy.workspaceTree": "Дерево проектов"'],
      ['"actions.workspace.aria": "Project actions for {name}"', '"actions.workspace.aria": "Действия проекта «{name}»"'],
      ['"defaultWorkspace.failed": "Не удалось создать проект по умолчанию. Выберите папку через «Выбрать проект»."', '"defaultWorkspace.failed": "Не удалось создать проект по умолчанию. Создайте проект по имени или выберите папку."'],
    ];
    // Apply RU fixes only inside ru block roughly by replacing globally where the EN remnant exists after RU section marker.
    // Safer: replace all occurrences of these exact EN strings that remain (EN locale keeps Create project phrasing via earlier keys).
    // Only replace the second occurrence for keys that exist in both en and ru with same EN text.
    for (const [a, b] of ruFixes) {
      const idx = s.lastIndexOf(a);
      if (idx !== -1) s = s.slice(0, idx) + b + s.slice(idx + a.length);
    }

    // ZH keep + add keys for completeness
    if (!s.includes('"menu.createProject": "新建项目"')) {
      s = s.replace(
        '"menu.addWorkspace": "添加工作区…",',
        '"menu.addWorkspace": "添加工作区…",\n\t\t\t"menu.createProject": "新建项目",\n\t\t\t"menu.chooseFolder": "选择文件夹…",\n\t\t\t"create.title": "创建项目",\n\t\t\t"create.action": "创建",\n\t\t\t"create.placeholder": "项目名称",\n\t\t\t"create.nameRequired": "请输入项目名称",\n\t\t\t"create.failed": "无法创建项目，请重试。",\n\t\t\t"create.invalidPath": "该文件夹不能用作 Beam 项目。",\n\t\t\t"create.conflict": "已存在同名项目。",'
      );
    }
    if (!s.includes('"create.failed": "无法创建项目')) {
      s = s.replace(
        '"create.nameRequired": "请输入项目名称"',
        '"create.nameRequired": "请输入项目名称",\n\t\t\t"create.failed": "无法创建项目，请重试。",\n\t\t\t"create.invalidPath": "该文件夹不能用作 Beam 项目。",\n\t\t\t"create.conflict": "已存在同名项目。"'
      );
    }

    return s;
  });
}

// --- 5) Stop detach script from seeding DeepSeek into Beam ---
const detach = path.join(ROOT, "desktop", "beam-detach-harness.mjs");
patchFile(detach, (s) => {
  if (s.includes("/* beam-no-seed-harness */")) return s;
  return s.replace(
    `if (beamEntries.length === 0 && fs.existsSync(OLD_WS)) {`,
    `if (false && beamEntries.length === 0 && fs.existsSync(OLD_WS)) { /* beam-no-seed-harness */`
  );
});

// --- 6) Start scripts: ensure projects dir; never point at harness ---
for (const vbs of [
  path.join(ROOT, "dist", "Beam-Agent", "Start Beam Agent.vbs"),
]) {
  patchFile(vbs, (s) => {
    if (!s.includes('EnsureDir beamHome & "\\projects"')) {
      s = s.replace(
        'EnsureDir beamHome & "\\default-workspace"',
        'EnsureDir beamHome & "\\default-workspace"\nEnsureDir beamHome & "\\projects"'
      );
    }
    // Keep DSH_HOME aliased to Beam home only (same durable root), never Documents\\deepseek-harness
    if (/deepseek-harness/i.test(s)) s = s.replace(/deepseek-harness/gi, "Beam Agent");
    return s;
  });
}

// --- 7) Verify ---
function verify() {
  const checks = [];
  for (const file of assistixFiles("beam-api-workspace-controller/lib/index.js")) {
    const s = fs.readFileSync(file, "utf8");
    checks.push({
      file: path.relative(ROOT, file),
      namedCreate: s.includes("allocateNamedBeamProjectPath"),
      harnessFilter: s.includes("isForbiddenHarnessProjectPath"),
      stillDocsHarness: /join\(directory,\s*["']deepseek-harness["']/.test(s),
    });
  }
  for (const file of assistixFiles("beam-client-ui-workspace/lib/client.js")) {
    const s = fs.readFileSync(file, "utf8");
    checks.push({
      file: path.relative(ROOT, file),
      createModal: s.includes("beam-create-project-modal"),
      createByNameCall: s.includes("createWorkspace({ title: name })"),
      projectsLabelEn: s.includes('"section.workspaces": "Projects"'),
      projectsLabelRu: s.includes('"section.workspaces": "Проекты"'),
    });
  }
  for (const file of assistixFiles("beam-api-remotes/lib/client.js")) {
    const s = fs.readFileSync(file, "utf8");
    checks.push({
      file: path.relative(ROOT, file),
      titleOptional: s.includes('"title": zod.z.string().readonly().optional()'),
      pathNotRequired: !/"required": \["path"\]/.test(s.split("workspace/create")[1]?.slice(0, 1200) || "") || s.includes('"title": { "type": "string" }'),
    });
  }
  for (const rel of [
    "beam-api-workspace-controller/lib/typert.host.js",
    "beam-api-workspace-controller/lib/typert.remote-client.js",
  ]) {
    for (const file of assistixFiles(rel)) {
      const s = fs.readFileSync(file, "utf8");
      const createBlock = s.split("'workspace/create'")[1]?.slice(0, 1500) || "";
      checks.push({
        file: path.relative(ROOT, file),
        hostTitleOptional: /'title': z\.string\(\)\.readonly\(\)\.optional\(\)/.test(s),
        hostPathOptional: /'path': z\.string\(\)\.readonly\(\)\.optional\(\)/.test(s),
        createNoRequiredPath: !/"required":\["path"\]/.test(createBlock),
      });
    }
  }
  const ws = JSON.parse(fs.readFileSync(workspaceJson, "utf8"));
  const paths = Object.values(ws.tables?.workspaces || {}).map((w) => w.path);
  checks.push({
    workspacePaths: paths,
    anyHarness: paths.some((p) => HARNESS_PATH_RE.test(String(p))),
    projectsRootExists: fs.existsSync(PROJECTS_ROOT),
  });
  return checks;
}

const verification = verify();
log("VERIFY " + JSON.stringify(verification, null, 2));

const summaryPath = path.join(ROOT, "desktop", "_beam-projects-isolate-report.json");
fs.writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      beamHome: BEAM_HOME,
      projectsRoot: PROJECTS_ROOT,
      defaultWorkspace: DEFAULT_WS,
      workspaceJson,
      deepseekHome: path.join(HOME, ".deepseek"),
      deepseekHarnessDocs: path.join(HOME, "OneDrive", "Documents", "deepseek-harness"),
      report,
      verification,
    },
    null,
    2
  )
);
log(`report => ${summaryPath}`);
