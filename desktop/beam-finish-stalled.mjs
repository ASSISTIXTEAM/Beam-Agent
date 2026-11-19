/**
 * Finish stalled sibling work in ONE coherent pass (dist + runtime):
 * 1) Workspace/рабочая область → Project/Проект (user-visible)
 * 2) Model picker: single Tide/Flare/Pine list, no provider headers
 * 3) Blank window: tray restore + web-boot reload harden
 * 4) LibreOffice preview kit/fallbacks
 * 5) Sidebar foot: hide «… Ещё», profile → popup, gear → Settings
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TREES = [
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
  path.join(ROOT, "runtime", "app"),
].filter((p) => fs.existsSync(p));

const summary = {
  trees: TREES.length,
  projectWording: 0,
  models: 0,
  blank: 0,
  libreoffice: false,
  sidebar: 0,
  css: 0,
  quarantine: 0,
};

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function write(p, s) {
  fs.writeFileSync(p, s);
}

function patchOnce(file, label, find, replace) {
  if (!exists(file)) return false;
  let s = read(file);
  if (s.includes(label)) return false;
  if (!s.includes(find)) {
    console.warn("miss", label, path.relative(ROOT, file));
    return false;
  }
  write(file, s.split(find).join(replace));
  console.log("patched", label, path.relative(ROOT, file));
  return true;
}

function replaceAll(file, pairs) {
  if (!exists(file)) return 0;
  let s = read(file);
  let n = 0;
  for (const [a, b] of pairs) {
    if (!a || a === b || !s.includes(a)) continue;
    const c = s.split(a).length - 1;
    s = s.split(a).join(b);
    n += c;
  }
  if (n) write(file, s);
  return n;
}

function assistix(tree) {
  return path.join(tree, "beam", "node_modules", "@assistix");
}

/* -------------------------------------------------------------------------- */
/* 1) Project wording                                                          */
/* -------------------------------------------------------------------------- */
function fixProjectWording(tree) {
  const webHtml = path.join(assistix(tree), "beam-web-frontend", "dist", "index.html");
  let n = 0;
  n += replaceAll(webHtml, [
    ['[/^Workspace$/g, "Рабочая область"]', '[/^Workspace$/g, "Проект"]'],
    ['[/^Workspaces$/g, "Рабочие области"]', '[/^Workspaces$/g, "Проекты"]'],
    ['[/^More$/g, "Ещё"]', '[/^More$/g, "Ещё"]'], // keep; hide via CSS/UI
    ["Запись в рабочую область", "Запись в проект"],
    ["Выбрать рабочую область", "Выбрать проект"],
    ["рабочую область", "проект"],
    ["рабочей области", "проекта"],
    ["рабочих областей", "проектов"],
    ["Рабочие области", "Проекты"],
    ["Рабочая область", "Проект"],
    ["Choose workspace", "Choose project"],
    ["Select workspace", "Choose project"],
    ["Add workspace", "Add project"],
    ["Loading workspaces", "Loading projects"],
    ["Workspace Write", "Project write"],
  ]);

  // Ensure rewrite helper prefers Project and never reintroduces рабочая область
  if (exists(webHtml)) {
    let html = read(webHtml);
    if (html.includes("beamRewriteProjectWording") && !html.includes("BEAM_FINISH_PROJECT_PAIRS")) {
      html = html.replace(
        /const pairs = ru \? \[/,
        `/* BEAM_FINISH_PROJECT_PAIRS */\n      const pairs = ru ? [`,
      );
      // Strengthen: any leftover «рабочая область» variants
      if (!html.includes("[/рабочая область/gi, 'проект']")) {
        html = html.replace(
          "[/Рабочая область/g, 'Проект'],",
          "[/Рабочая область/g, 'Проект'],\n        [/рабочая область/gi, 'проект'],",
        );
      }
      write(webHtml, html);
      n++;
    }
  }

  // High-value locale packs (idempotent exact string fixes)
  for (const pkg of [
    "beam-client-ui-workspace",
    "beam-client-ui-conversation",
    "beam-client-ui-sidebar",
    "beam-client-ui-permission-presets",
    "beam-client-ui-composer",
    "beam-client-ui-settings-models",
    "beam-client-locale",
  ]) {
    for (const name of ["client.js", "index.js"]) {
      const f = path.join(assistix(tree), pkg, "lib", name);
      n += replaceAll(f, [
        ['"section.workspaces": "Workspaces"', '"section.workspaces": "Projects"'],
        ['"section.workspaces": "Workspace"', '"section.workspaces": "Project"'],
        ['"section.workspaces": "Рабочие области"', '"section.workspaces": "Проекты"'],
        ['"section.workspaces": "Рабочая область"', '"section.workspaces": "Проект"'],
        ['"workspace.add": "Add workspace"', '"workspace.add": "Add project"'],
        ['"workspace.add": "Добавить рабочую область"', '"workspace.add": "Добавить проект"'],
        ['"hero.chooseWorkspace": "Choose workspace"', '"hero.chooseWorkspace": "Choose project"'],
        ['"hero.chooseWorkspace": "Select workspace"', '"hero.chooseWorkspace": "Choose project"'],
        ['"hero.chooseWorkspace": "Выбрать рабочую область"', '"hero.chooseWorkspace": "Выбрать проект"'],
        ['"preset.workspaceWrite": "Workspace Write"', '"preset.workspaceWrite": "Project write"'],
        ['"preset.workspaceWrite": "Запись в рабочую область"', '"preset.workspaceWrite": "Запись в проект"'],
        ['"picker.loading": "Loading workspaces…"', '"picker.loading": "Loading projects…"'],
        ['"picker.loading": "Загрузка рабочих областей…"', '"picker.loading": "Загрузка проектов…"'],
        ['"More"', '"Ещё"'], // only inside RU — careful; skip broad
      ]);
    }
  }
  summary.projectWording += n;
  return n;
}

/* -------------------------------------------------------------------------- */
/* 2) Model picker dedupe + hide group headers                                 */
/* -------------------------------------------------------------------------- */
function fixModelPicker(tree) {
  const file = path.join(assistix(tree), "beam-client-ui-model-selection", "lib", "client.js");
  if (!exists(file)) return 0;
  let s = read(file);
  let n = 0;

  // Merge duplicate Tide/Flare/Pine groups into one flat catalog group.
  const oldNorm = `const normalizeCatalog = (value) => {
					const allow = new Set(["tide", "flare", "pine"]);
					const groups = (value?.groups || []).map((g) => ({
						...g,
						name: "Beam",
						models: (g.models || []).filter((m) => allow.has(String(m.id || "").toLowerCase()))
					})).filter((g) => g.models.length > 0);
					if (groups.length === 0) return beamFallbackCatalog();
					// Default ALWAYS Tide — keep provider id for routing, never surface it in UI.
					const provider = groups.find((g) => g.models.some((m) => m.id === "tide"))?.id || groups[0].id;
					return { ...value, default: { provider, model: "tide" }, groups, failures: [] };
				};`;
  const newNorm = `const normalizeCatalog = (value) => {
					/* beam-finish-dedupe-models */
					const allow = new Set(["tide", "flare", "pine"]);
					const order = ["tide", "flare", "pine"];
					const byId = new Map();
					let preferredProvider = "assistix-official";
					for (const g of value?.groups || []) {
						for (const m of g.models || []) {
							const id = String(m.id || "").toLowerCase();
							if (!allow.has(id)) continue;
							if (!byId.has(id)) byId.set(id, { ...m, id });
							if (id === "tide") preferredProvider = g.id || preferredProvider;
						}
					}
					if (byId.size === 0) return beamFallbackCatalog();
					const models = order.filter((id) => byId.has(id)).map((id) => byId.get(id));
					const provider = preferredProvider || "assistix-official";
					return {
						...value,
						default: { provider, model: "tide" },
						routableProviders: [provider],
						groups: [{ id: provider, name: "", models }],
						failures: []
					};
				};`;
  if (!s.includes("beam-finish-dedupe-models")) {
    if (s.includes(oldNorm)) {
      s = s.split(oldNorm).join(newNorm);
      n++;
    } else {
      // looser: replace body after const allow
      const re =
        /const normalizeCatalog = \(value\) => \{[\s\S]*?return \{ \.\.\.value, default: \{ provider, model: "tide" \}, groups, failures: \[\] \};\s*\};/;
      if (re.test(s)) {
        s = s.replace(re, newNorm.trim());
        n++;
      } else console.warn("normalizeCatalog pattern miss");
    }
  }

  // Never show provider group headers (even if >1 group sneaks in).
  const oldLabel = "label: filteredGroups.length > 1 ? group.provider.name : \"\",";
  const newLabel = "label: \"\", /* beam-finish-hide-group-headers */";
  if (s.includes(oldLabel)) {
    s = s.split(oldLabel).join(newLabel);
    n++;
  } else if (!s.includes("beam-finish-hide-group-headers")) {
    s = s.replace(
      /label:\s*filteredGroups\.length\s*>\s*1\s*\?\s*group\.provider\.name\s*:\s*""\s*,/,
      newLabel,
    );
    if (s.includes("beam-finish-hide-group-headers")) n++;
  }

  // Blank provider display names so headers stay empty if multiple groups remain.
  if (!s.includes("beam-finish-blank-provider-name")) {
    const mapped =
      /provider:\s*\{\s*id:\s*group\.id,\s*name:\s*"Beam"\s*\}/;
    if (mapped.test(s)) {
      s = s.replace(mapped, 'provider: { id: group.id, name: "" /* beam-finish-blank-provider-name */ }');
      n++;
    }
  }

  if (n) write(file, s);
  summary.models += n;
  return n;
}

/* -------------------------------------------------------------------------- */
/* 3) Blank window harden                                                      */
/* -------------------------------------------------------------------------- */
function fixBlankWindow(tree) {
  const mainJs = path.join(tree, "lib", "main.js");
  if (!exists(mainJs)) return 0;
  let s = read(mainJs);
  let n = 0;

  // Harden bootFailed: reload with cooldown, then remount URL once; avoid fatal blank.
  const oldBoot = `	ipcMain.handle(DESKTOP_IPC.bootFailed, (event, message) => {
		assertDesktopSender(event, ["app"]);
		if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error("dsh desktop: rejected startup failure from a non-primary frame");
		if (typeof message !== "string") throw new Error("dsh desktop: startup failure must be text");
		// Soft-fail recoverable client bootstrap races; reload once instead of fatal dialog
		if (/HTML did not preload|client-modules/i.test(message)) {
			console.warn("desktop web-boot recoverable:", message);
			try { mainWindow?.webContents.reload(); } catch {}
			return;
		}
		reportFatal(new Error(message), "web-boot");
	});`;
  const newBoot = `	/* beam-finish-blank-boot */ let webBootRecoveries = 0;
	let webBootLastAt = 0;
	ipcMain.handle(DESKTOP_IPC.bootFailed, (event, message) => {
		assertDesktopSender(event, ["app"]);
		if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error("dsh desktop: rejected startup failure from a non-primary frame");
		if (typeof message !== "string") throw new Error("dsh desktop: startup failure must be text");
		if (/HTML did not preload|client-modules/i.test(message)) {
			const now = Date.now();
			if (now - webBootLastAt > 15000) webBootRecoveries = 0;
			webBootLastAt = now;
			webBootRecoveries += 1;
			console.warn("desktop web-boot recoverable:", message, "attempt", webBootRecoveries);
			try {
				const wc = mainWindow?.webContents;
				if (!wc || wc.isDestroyed()) return;
				if (webBootRecoveries <= 2) wc.reload();
				else if (typeof applicationUrl !== "undefined" && applicationUrl) {
					webBootRecoveries = 0;
					wc.loadURL(String(applicationUrl)).catch(() => { try { wc.reload(); } catch {} });
				} else wc.reload();
			} catch {}
			return;
		}
		reportFatal(new Error(message), "web-boot");
	});`;
  if (!s.includes("beam-finish-blank-boot")) {
    if (s.includes(oldBoot)) {
      s = s.split(oldBoot).join(newBoot);
      n++;
    } else if (s.includes("desktop web-boot recoverable:")) {
      // Already partially patched — wrap if missing marker
      s = s.replace(
        /\/\/ Soft-fail recoverable client bootstrap races; reload once instead of fatal dialog\s*if \(\/HTML did not preload\|client-modules\/i\.test\(message\)\) \{\s*console\.warn\("desktop web-boot recoverable:", message\);\s*try \{ mainWindow\?\.webContents\.reload\(\); \} catch \{\}\s*return;\s*\}/,
        `if (/HTML did not preload|client-modules/i.test(message)) {
			const now = Date.now();
			if (typeof webBootRecoveries === "undefined") { globalThis.__beamWebBootRecoveries = globalThis.__beamWebBootRecoveries || 0; }
			/* beam-finish-blank-boot */
			if (now - (globalThis.__beamWebBootLastAt || 0) > 15000) globalThis.__beamWebBootRecoveries = 0;
			globalThis.__beamWebBootLastAt = now;
			globalThis.__beamWebBootRecoveries = (globalThis.__beamWebBootRecoveries || 0) + 1;
			console.warn("desktop web-boot recoverable:", message, "attempt", globalThis.__beamWebBootRecoveries);
			try {
				const wc = mainWindow?.webContents;
				if (!wc || wc.isDestroyed()) return;
				if (globalThis.__beamWebBootRecoveries <= 2) wc.reload();
				else {
					globalThis.__beamWebBootRecoveries = 0;
					if (typeof applicationUrl !== "undefined" && applicationUrl) wc.loadURL(String(applicationUrl)).catch(() => { try { wc.reload(); } catch {} });
					else wc.reload();
				}
			} catch {}
			return;
		}`,
      );
      if (s.includes("beam-finish-blank-boot")) n++;
    }
  }

  // Tray/activate restore: never no-op when !enteredWorkspace; reload blank roots.
  const oldFocus = `	focusPrimaryWindow = () => {
		if (quitting) return;
		if (isMandatory()) {
			mandatoryUI?.focus();
			return;
		}
		const window = welcomeWindow ?? mainWindow;
		if (window === void 0 || window.isDestroyed()) {
			try {
				createMainWindow();
			} catch (error) {
				reportFatal(error, "main");
				return;
			}
			(backend.state.phase === "ready" ? openInitialWindow() : navigateMain(applicationUrl)).catch((error) => {
				reportFatal(error, "main");
			});
			return;
		}
		if (window === mainWindow && !enteredWorkspace) return;
		if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
	};`;
  const newFocus = `	focusPrimaryWindow = () => {
		/* beam-finish-tray-restore */
		if (quitting) return;
		if (isMandatory()) {
			mandatoryUI?.focus();
			return;
		}
		const window = welcomeWindow ?? mainWindow;
		if (window === void 0 || window.isDestroyed()) {
			try {
				createMainWindow();
			} catch (error) {
				reportFatal(error, "main");
				return;
			}
			(backend.state.phase === "ready" ? openInitialWindow() : navigateMain(applicationUrl)).catch((error) => {
				reportFatal(error, "main");
			});
			return;
		}
		if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
		if (window === mainWindow) {
			try {
				const wc = window.webContents;
				if (!wc || wc.isDestroyed()) return;
				const url = wc.getURL?.() || "";
				if (!url || url === "about:blank") {
					if (typeof applicationUrl !== "undefined" && applicationUrl) wc.loadURL(String(applicationUrl)).catch(() => {});
					return;
				}
				wc.executeJavaScript(\`(function(){
					const root = document.getElementById('root');
					const empty = !root || root.childElementCount === 0 || ((root.innerText || '').trim().length < 8 && !root.querySelector('canvas,img,svg,input,textarea,[contenteditable]'));
					return !!empty;
				})()\`, true).then((blank) => {
					if (blank) {
						console.warn("desktop tray: blank UI detected — reloading");
						try { wc.reload(); } catch {}
					}
				}).catch(() => {});
			} catch {}
		}
	};`;
  if (!s.includes("beam-finish-tray-restore")) {
    if (s.includes(oldFocus)) {
      s = s.split(oldFocus).join(newFocus);
      n++;
    } else {
      // Surgical: remove early-return that skips restore, append blank check
      if (s.includes("if (window === mainWindow && !enteredWorkspace) return;")) {
        s = s.replace(
          "if (window === mainWindow && !enteredWorkspace) return;\n\t\tif (window.isMinimized()) window.restore();\n\t\twindow.show();\n\t\twindow.focus();",
          `/* beam-finish-tray-restore */ if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
		if (window === mainWindow) {
			try {
				const wc = window.webContents;
				if (wc && !wc.isDestroyed()) {
					const url = wc.getURL?.() || "";
					if (!url || url === "about:blank") {
						if (typeof applicationUrl !== "undefined" && applicationUrl) wc.loadURL(String(applicationUrl)).catch(() => {});
					} else {
						wc.executeJavaScript(\`(function(){const root=document.getElementById('root');return !root||root.childElementCount===0||((root.innerText||'').trim().length<8&&!root.querySelector('canvas,img,svg,input,textarea,[contenteditable]'));})()\`, true).then((blank)=>{ if(blank){ console.warn('desktop tray: blank UI — reloading'); try{wc.reload();}catch{}} }).catch(()=>{});
					}
				}
			} catch {}
		}`,
        );
        if (s.includes("beam-finish-tray-restore")) n++;
      }
    }
  }

  if (n) write(mainJs, s);
  summary.blank += n;
  return n;
}

function quarantineCorruptSessions() {
  const sessionsRoot = path.join(process.env.USERPROFILE || "", ".beam", "sessions");
  if (!exists(sessionsRoot)) return 0;
  let n = 0;
  // Known bad path from crash log: session identity points at old harness cwd
  for (const ent of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const dir = path.join(sessionsRoot, ent.name);
    // If folder name still references deepseek-harness default workspace, quarantine
    if (/deepseek-harness/i.test(ent.name)) {
      const dest = dir + ".corrupt-quarantine";
      if (!exists(dest)) {
        try {
          fs.renameSync(dir, dest);
          n++;
          console.log("quarantined", ent.name);
        } catch (e) {
          console.warn("quarantine failed", ent.name, e.message);
        }
      }
    }
  }
  // Also scan session logs for identity mismatch marker and soft-quarantine those dirs
  for (const ent of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.endsWith(".corrupt-quarantine")) continue;
    const dir = path.join(sessionsRoot, ent.name);
    let hit = false;
    const walk = (d, depth = 0) => {
      if (hit || depth > 3) return;
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(path.join(d, f.name), depth + 1);
        else if (/\.jsonl(\.zstd)?$/i.test(f.name) && f.name.includes("session")) {
          // Can't easily read zstd; quarantine dirs that mix path spellings in name
          if (/OneDrive-Documents-deepseek-harness/i.test(dir) || /deepseek-harness/i.test(dir)) hit = true;
        }
      }
    };
    walk(dir);
    if (hit) {
      const dest = dir + ".corrupt-quarantine";
      if (!exists(dest)) {
        try {
          fs.renameSync(dir, dest);
          n++;
        } catch {}
      }
    }
  }
  summary.quarantine = n;
  return n;
}

/* -------------------------------------------------------------------------- */
/* 4) LibreOffice                                                              */
/* -------------------------------------------------------------------------- */
function fixLibreOffice() {
  const script = path.join(ROOT, "desktop", "fix-libreoffice-preview.mjs");
  if (!exists(script)) {
    console.warn("fix-libreoffice-preview.mjs missing");
    return;
  }
  const r = spawnSync(process.execPath, [script], { stdio: "inherit", cwd: ROOT });
  summary.libreoffice = r.status === 0;
}

/* -------------------------------------------------------------------------- */
/* 5) Sidebar foot: profile + gear, hide … Ещё                                 */
/* -------------------------------------------------------------------------- */
function fixSidebarFoot(tree) {
  let n = 0;
  const account = path.join(assistix(tree), "beam-client-ui-settings-account", "lib", "client.js");
  if (exists(account)) {
    let s = read(account);
    if (!s.includes("beam-finish-profile-gear")) {
      // Replace AccountMenu return trigger row: profile opens menu; gear opens settings.
      const oldTrigger = `					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
						open,
						side: "top",
						portal: true,
						autoFocus: true,
						className: AccountMenu_module_css_default.anchor,
						listClassName: signedIn ? void 0 : AccountMenu_module_css_default.signedOutMenu,
						anchor: (0, react_jsx_runtime.jsxs)("button", {
							ref: trigger,
							type: "button",
							className: AccountMenu_module_css_default.trigger,
							"data-collapsed": !wide,
							"data-signed-out": !signedIn,
							"aria-label": t("menu"),
							"aria-haspopup": "menu",
							"aria-expanded": open,
							onClick: () => {
								setOpen((value) => !value);
							},
							children: [signedIn ? (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.avatar,
								"data-avatar-status": account.avatar?.status,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: account.avatar,
									avatarFailed
								})
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineMedium, { size: 14 }), wide && (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.label,
								children: signedIn ? label : t("more")
							})]
						}),
						items: [
							{
								id: "settings",
								label: t("settings"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 16 }),
								...settingsShortcut === void 0 ? {} : { shortcut: settingsShortcut }
							},
							{
								id: "contact",
								label: t("contactUs"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineMedium, { size: 16 })
							},
							...signedIn ? [{
								id: "signout",
								label: t("signOut"),
								icon: (0, react_jsx_runtime.jsx)(LogoutIcon, {}),
								disabled: busy
							}] : [{
								id: "signin",
								label: t("signIn"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 16 })
							}]
						],
						onClose: () => {
							setOpen(false);
						},
						onSelect: (id) => {
							if (id === "settings") {
								setOpen(false);
								trigger.current?.focus();
								openSettings();
							} else if (id === "contact") {
								setOpen(false);
								contactUs();
							} else if (id === "signin") beginSignIn();
							else requestSignOut();
						}
					}),`;
      const newTrigger = `					/* beam-finish-profile-gear */ (0, react_jsx_runtime.jsxs)("div", {
						className: AccountMenu_module_css_default.root,
						style: { display: "flex", alignItems: "center", gap: 6, width: "100%" },
						"data-beam-foot": "profile-gear",
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
						open,
						side: "top",
						portal: true,
						autoFocus: true,
						className: AccountMenu_module_css_default.anchor,
						listClassName: signedIn ? void 0 : AccountMenu_module_css_default.signedOutMenu,
						anchor: (0, react_jsx_runtime.jsxs)("button", {
							ref: trigger,
							type: "button",
							className: AccountMenu_module_css_default.trigger,
							"data-collapsed": !wide,
							"data-signed-out": !signedIn,
							"data-beam-profile": "1",
							"aria-label": signedIn ? (label || t("signedIn") || "Profile") : (t("signIn") || "Profile"),
							"aria-haspopup": "menu",
							"aria-expanded": open,
							onClick: () => {
								setOpen((value) => !value);
							},
							children: [signedIn ? (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.avatar,
								"data-avatar-status": account.avatar?.status,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: account.avatar,
									avatarFailed
								})
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 14 }), wide && (0, react_jsx_runtime.jsx)("span", {
								className: AccountMenu_module_css_default.label,
								children: signedIn ? label : (t("signIn") || "Sign in")
							})]
						}),
						items: [
							{
								id: "contact",
								label: t("contactUs"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineMedium, { size: 16 })
							},
							...signedIn ? [{
								id: "signout",
								label: t("signOut"),
								icon: (0, react_jsx_runtime.jsx)(LogoutIcon, {}),
								disabled: busy
							}] : [{
								id: "signin",
								label: t("signIn"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 16 })
							}]
						],
						onClose: () => {
							setOpen(false);
						},
						onSelect: (id) => {
							if (id === "contact") {
								setOpen(false);
								contactUs();
							} else if (id === "signin") beginSignIn();
							else requestSignOut();
						}
					}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-beam-settings-gear": "1",
								"aria-label": t("settings") || "Settings",
								title: t("settings") || "Settings",
								onClick: () => { setOpen(false); openSettings(); },
								style: {
									flex: "none",
									width: 28,
									height: 28,
									borderRadius: 8,
									border: "none",
									background: "transparent",
									color: "var(--dsw-alias-label-secondary)",
									cursor: "pointer",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center"
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutlineMedium, { size: 16 })
							})
						]
					}),`;
      if (s.includes(oldTrigger)) {
        // Also remove outer wrapping root jsxs duplication — AccountMenu already wraps in root.
        // Replace only the Menu block inside existing root.
        const slim = newTrigger.replace(
          `/* beam-finish-profile-gear */ (0, react_jsx_runtime.jsxs)("div", {
						className: AccountMenu_module_css_default.root,
						style: { display: "flex", alignItems: "center", gap: 6, width: "100%" },
						"data-beam-foot": "profile-gear",
						children: [`,
          `/* beam-finish-profile-gear */ (0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", alignItems: "center", gap: 6, width: "100%" },
						"data-beam-foot": "profile-gear",
						children: [`,
        );
        s = s.split(oldTrigger).join(slim);
        n++;
      } else {
        // Fallback: change "more" label + ellipsis to sign-in/user, append gear via smaller edits
        if (s.includes("IconEllipsisOutlineMedium") && s.includes('children: signedIn ? label : t("more")')) {
          s = s
            .replace(
              "(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEllipsisOutlineMedium, { size: 14 })",
              "(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUserOutlineMedium, { size: 14 }) /* beam-finish-profile-gear */",
            )
            .replace(
              'children: signedIn ? label : t("more")',
              'children: signedIn ? label : (t("signIn") || "Sign in")',
            );
          n++;
        }
      }
    }
    // RU/EN: never surface «Ещё» as the account launcher label
    n += replaceAll(account, [
      ['more: "More"', 'more: "Profile"'],
      ['"more": "Ещё"', '"more": "Профиль"'],
      ['more: "Ещё"', 'more: "Профиль"'],
    ]);
    if (n) write(account, s);
  }

  // Hide panel «Ещё» overflow launcher above foot (rings sit below it).
  const sidebar = path.join(assistix(tree), "beam-client-ui-sidebar", "lib", "client.js");
  if (exists(sidebar)) {
    let s = read(sidebar);
    if (!s.includes("beam-finish-hide-panel-more") && s.includes("hasEntryActions && (0, react_jsx_runtime.jsx)(PanelMoreMenu")) {
      s = s.replace(
        "hasEntryActions && (0, react_jsx_runtime.jsx)(PanelMoreMenu, {",
        "false && /* beam-finish-hide-panel-more */ hasEntryActions && (0, react_jsx_runtime.jsx)(PanelMoreMenu, {",
      );
      write(sidebar, s);
      n++;
    }
  }

  // Injector: profile click opens native profile menu; gear opens settings; hide duplicate «Ещё».
  const html = path.join(assistix(tree), "beam-web-frontend", "dist", "index.html");
  if (exists(html)) {
    let h = read(html);
    // Update renderSide profile row to include gear + wire clicks
    if (!h.includes("beam-finish-side-foot")) {
      const oldHtml = `    const html = '<div class="bsl-rings">'+rings+'</div>'+profile;

    if (html === lastSideHtml && el.dataset.bound === "1") return;
    lastSideHtml = html;
    el.innerHTML = html;
    el.dataset.bound = "1";
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => {
      passwordErr = "";
      ensureAuthGate(lastData || { signedIn: false }, { force: false });
      const g = gateEl();
      try { g?.querySelector('[name="email"]')?.focus(); } catch {}
    });
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try { await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); } catch {}
      refresh({ force: true });
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.('[data-act="logout"]')) return;
      refresh({ force: true });
    });
  };`;
      const newHtml = `    /* beam-finish-side-foot */ const gear = '<button type="button" class="bsl-gear" data-act="settings" title="'+(isRu()?'Настройки':'Settings')+'" aria-label="'+(isRu()?'Настройки':'Settings')+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l2-1.5-1.9-3.3-2.4 1a7.4 7.4 0 0 0-2.6-1.5l-.4-2.6h-3.8l-.4 2.6a7.4 7.4 0 0 0-2.6 1.5l-2.4-1L2.5 9l2 1.5a7.8 7.8 0 0 0-.1 1.5 7.8 7.8 0 0 0 .1 1.5L2.5 15l1.9 3.3 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h3.8l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1L21.5 15l-2.1-1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>';
    const row = '<div class="bsl-footrow">'+profile+gear+'</div>';
    const html = '<div class="bsl-rings">'+rings+'</div>'+row;

    if (html === lastSideHtml && el.dataset.bound === "1") return;
    lastSideHtml = html;
    el.innerHTML = html;
    el.dataset.bound = "1";
    const openNativeProfile = () => {
      const btn = document.querySelector('[data-beam-profile="1"], [data-beam-foot="profile-gear"] button[aria-haspopup="menu"], .wtg9ga_settingsArea button[aria-haspopup="menu"]');
      if (btn) { btn.click(); return true; }
      return false;
    };
    const openNativeSettings = () => {
      const gearBtn = document.querySelector('[data-beam-settings-gear="1"]');
      if (gearBtn) { gearBtn.click(); return true; }
      // Ctrl+, settings shortcut fallback
      try {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", code: "Comma", ctrlKey: true, bubbles: true }));
        return true;
      } catch { return false; }
    };
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => {
      if (openNativeProfile()) return;
      passwordErr = "";
      ensureAuthGate(lastData || { signedIn: false }, { force: false });
      const g = gateEl();
      try { g?.querySelector('[name="email"]')?.focus(); } catch {}
    });
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try { await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); } catch {}
      refresh({ force: true });
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", (ev) => {
      if (ev.target?.closest?.('[data-act="logout"]')) return;
      if (ev.target?.closest?.('[data-act="settings"]')) return;
      if (openNativeProfile()) return;
      refresh({ force: true });
    });
    el.querySelector('[data-act="settings"]')?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openNativeSettings();
    });
  };`;
      if (h.includes(oldHtml)) {
        h = h.split(oldHtml).join(newHtml);
        n++;
      } else {
        console.warn("renderSide bind block miss — applying CSS-only sidebar foot fixes");
      }
    }
    write(html, h);
  }

  // CSS: hide native «Ещё»/panel more above rings; style gear; order rings then foot.
  const cssPath = path.join(assistix(tree), "beam-web-frontend", "dist", "assets", "beam-override.css");
  if (exists(cssPath)) {
    let css = read(cssPath);
    const block = `
/* ===== BEAM FINISH: sidebar foot profile + gear, hide … Ещё ===== */
.wtg9ga_root,
[class*="wtg9ga_root"] {
  display: flex !important;
  flex-direction: column !important;
}
#beam-side-limits {
  order: 50 !important;
  margin-top: auto !important;
  margin-bottom: 4px !important;
}
.wtg9ga_footArea,
[class*="footArea"] {
  order: 60 !important;
}
/* Hide panel overflow «Ещё» above rings */
.wtg9ga_moreAnchor,
[class*="moreAnchor"],
button.wtg9ga_panelRow[aria-haspopup="menu"]:has([class*="panelTitle"]),
.wtg9ga_panelList .wtg9ga_moreAnchor {
  display: none !important;
}
/* Prefer injected profile+gear; collapse native launcher label «Ещё» if still mounted */
.wtg9ga_settingsArea [aria-label="Ещё"],
.wtg9ga_settingsArea [aria-label="More"],
.wtg9ga_settingsArea button[data-signed-out="true"] {
  /* keep for wiring when AccountMenu not yet patched */
}
#beam-side-limits .bsl-footrow {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
#beam-side-limits .bsl-footrow .bsl-profile {
  flex: 1;
  min-width: 0;
}
#beam-side-limits .bsl-gear {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--beam-line, rgba(0,179,188,.28));
  background: var(--beam-elev, rgba(16,34,32,.95));
  color: var(--beam-ink, #e8f7f5);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
#beam-side-limits .bsl-gear:hover {
  border-color: rgba(0,179,188,.5);
  color: #2dd4bf;
}
/* Hide provider group headers in model picker */
[class*="MenuGroup"] > [class*="label"]:empty,
[role="group"] > legend:empty,
._9r0rkG_groups [class*="groupLabel"],
._9r0rkG_groups [class*="GroupLabel"] {
  display: none !important;
}
`;
    if (!css.includes("BEAM FINISH: sidebar foot")) {
      css += "\n" + block + "\n";
      write(cssPath, css);
      summary.css++;
      n++;
    }
  }

  summary.sidebar += n;
  return n;
}

/* -------------------------------------------------------------------------- */
/* Sync bridge + env                                                           */
/* -------------------------------------------------------------------------- */
function syncBridgeAndEnv() {
  const src = path.join(ROOT, "desktop", "bridge", "server.js");
  const dst = path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js");
  if (exists(src) && exists(path.dirname(dst))) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  const envPath = path.join(process.env.USERPROFILE || "", ".beam", ".env");
  if (exists(envPath)) {
    const lines = read(envPath).split(/\r?\n/);
    const kept = lines.filter((l) => !/^\s*BEAM_BASE_URL\s*=/.test(l));
    if (kept.length !== lines.length) {
      write(envPath, kept.join("\n").replace(/\n+$/, "\n"));
      console.log("removed BEAM_BASE_URL from ~/.beam/.env");
    }
  }
}

/* -------------------------------------------------------------------------- */
console.log("Beam finish stalled — trees:", TREES.length);
for (const tree of TREES) {
  console.log("\n==", tree);
  fixProjectWording(tree);
  fixModelPicker(tree);
  fixBlankWindow(tree);
  fixSidebarFoot(tree);
}
fixLibreOffice();
quarantineCorruptSessions();
syncBridgeAndEnv();

// Also re-run p0 polish for any remaining workspace pairs (safe/idempotent)
const p0 = path.join(ROOT, "desktop", "beam-p0-ui-polish.mjs");
if (exists(p0)) {
  console.log("\n→ beam-p0-ui-polish.mjs");
  spawnSync(process.execPath, [p0], { stdio: "inherit", cwd: ROOT });
}

console.log("\n✓ beam-finish-stalled done");
console.log(JSON.stringify(summary, null, 2));
