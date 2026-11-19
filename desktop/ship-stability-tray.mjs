/**
 * Beam Agent — idempotent stability + tray/native Windows polish.
 *
 * - Keeps blank-window / flicker guards (does NOT neutralize remount recovery)
 * - Tray: Beam tooltip, icon fallbacks, reliable show/hide + blank restore
 * - Preload Application/Edit → RU (Приложение / Правка)
 * - Silent launch re-assert; AUMID Assistix.BeamAgent
 * - Applies runtime + dist. Never writes BEAM_BASE_URL into ~/.beam/.env.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist", "Beam-Agent");
const MARK = "BEAM_STABILITY_TRAY";

const MAIN_FILES = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(DIST, "resources", "app", "lib", "main.js"),
];

const PRELOAD_FILES = [
  path.join(ROOT, "runtime", "app", "lib", "preload-app.cjs"),
  path.join(DIST, "resources", "app", "lib", "preload-app.cjs"),
  path.join(ROOT, "runtime", "app", "lib", "preload-welcome.cjs"),
  path.join(DIST, "resources", "app", "lib", "preload-welcome.cjs"),
];

const report = [];

function writeIfChanged(file, next, label) {
  const before = fs.readFileSync(file, "utf8");
  if (before === next) {
    report.push(`unchanged ${label}`);
    return false;
  }
  fs.writeFileSync(file, next);
  report.push(`patched ${label}`);
  return true;
}

/** RU caption strings for Windows titlebar Application / Edit. */
const RU_MENU_SNIPPET = `const ru = {
	application: "Приложение",
	fileMenu: "Файл",
	closePage: "Закрыть страницу или окно",
	aboutMenu: "О Beam Agent",
	aboutProduct: "Beam Agent",
	aboutVersion: "Версия V{version}",
	hideApplication: "Скрыть Beam Agent",
	hideOtherApplications: "Скрыть остальные",
	showAllApplications: "Показать все",
	quitApplication: "Выйти из Beam Agent",
	openApplication: "Открыть Beam Agent",
	quit: "Выйти",
	cancel: "Отмена",
	quitTitle: "Выйти из Beam Agent?",
	quitActiveTasks: "Текущие задачи будут прерваны.",
	quitScheduledTasks: "Пока приложение закрыто, запланированные задачи не выполняются.",
	quitActiveAndScheduledTasks: "Текущие задачи будут прерваны, а запланированные не выполнятся, пока приложение закрыто.",
	backgroundNoticeBody: "Задачи продолжат работу. Окно можно открыть снова из системного трея.",
	backgroundNoticeConfirm: "ОК",
	edit: "Правка",
	menuBar: "Меню приложения",
	delete: "Удалить",
	undo: "Отменить",
	redo: "Повторить",
	cut: "Вырезать",
	copy: "Копировать",
	paste: "Вставить",
	selectAll: "Выделить всё",
	startupFailed: "Beam Agent недоступен",
	fatalSummary: "Приложение не удалось запустить или оно неожиданно остановилось.",
	exitApplication: "Выйти",
	restartApplication: "Перезапустить",
	welcomeTitle: "Beam Agent",
	welcomeBrand: "Beam Agent",
	welcomeTaglineBefore: "Добро пожаловать в ",
	welcomeTaglineBrand: "Beam Agent",
	welcomeTaglineAfter: "",
	welcomeDescription: "ASSISTIX · Beam Agent",
	welcomeSignIn: "Войти через ASSISTIX ID",
	cliCommandMenu: "Команда Beam…",
	cliCommandTitle: "Команда Beam",
	cliCommandClose: "Закрыть"
}; /* ${MARK}: ru caption */`;

function patchPreload(file) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${path.relative(ROOT, file)}`);
    return;
  }
  let s = fs.readFileSync(file, "utf8");

  // Inject ru dict once (before resolveDesktopLocale)
  if (!s.includes(`/* ${MARK}: ru caption */`)) {
    const resolveNeedle = "/** Resolve Electron's locale to one shipped Desktop dictionary. */\nfunction resolveDesktopLocale(locale) {";
    if (s.includes(resolveNeedle)) {
      s = s.replace(resolveNeedle, `${RU_MENU_SNIPPET}\n/** Resolve Electron's locale to one shipped Desktop dictionary. */\nfunction resolveDesktopLocale(locale) {`);
    } else {
      report.push(`WARN resolveDesktopLocale miss ${path.relative(ROOT, file)}`);
    }
  }

  // Prefer ru; keep zh; en remains available
  const oldResolve = `function resolveDesktopLocale(locale) {
	return locale.toLowerCase().startsWith("zh") ? {
		id: "zh-CN",
		messages: zh
	} : {
		id: "en",
		messages: en
	};
}`;
  const newResolve = `function resolveDesktopLocale(locale) {
	/* ${MARK}: ru-first caption locale */
	const primary = String(locale || "ru").toLowerCase().split(/[-_]/)[0];
	if (primary === "zh") return { id: "zh-CN", messages: zh };
	if (primary === "en") return { id: "en", messages: en };
	return { id: "ru", messages: typeof ru !== "undefined" ? ru : en };
}`;
  if (s.includes(oldResolve)) {
    s = s.split(oldResolve).join(newResolve);
  } else if (!s.includes(`/* ${MARK}: ru-first caption locale */`)) {
    // Already partially patched or format drift — try soft replace of en-only branch
    if (s.includes('messages: en\n\t};') && s.includes("startsWith(\"zh\")")) {
      s = s.replace(
        /function resolveDesktopLocale\(locale\) \{[\s\S]*?\n\}/,
        newResolve,
      );
    } else {
      report.push(`WARN resolve already custom ${path.relative(ROOT, file)}`);
    }
  }

  writeIfChanged(file, s, path.relative(ROOT, file));
}

function patchMainTray(file) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${path.relative(ROOT, file)}`);
    return;
  }
  const before = fs.readFileSync(file, "utf8");
  let s = before;
  let n = 0;

  // AUMID early — idempotent
  if (!s.includes("BEAM_AUMID_EARLY")) {
    const inject = `/* BEAM_AUMID_EARLY: Windows jump-list / taskbar name — must run before any BrowserWindow */
try {
	app.setName("Beam Agent");
	if (process.platform === "win32") app.setAppUserModelId("Assistix.BeamAgent");
} catch {}

`;
    if (s.includes('from "electron";')) {
      s = s.replace('from "electron";\n', `from "electron";\n${inject}`);
      n++;
    }
  } else if (!s.includes('app.setAppUserModelId("Assistix.BeamAgent")')) {
    s = s.replace(/app\.setAppUserModelId\("[^"]+"\)/g, 'app.setAppUserModelId("Assistix.BeamAgent")');
    n++;
  }

  // DesktopTray: Beam tooltip + icon fallback + left-click toggle
  if (!s.includes(`/* ${MARK}: tray class */`)) {
    const oldClass = `var DesktopTray = class {
	options;
	tray;
	/** @param options - Icon path, locale reader, and the open and quit actions. */
	constructor(options) {
		this.options = options;
		const tray = new Tray(nativeImage.createFromPath(options.iconPath));
		this.tray = tray;
		tray.on("click", () => {
			options.open();
		});
		this.relabel();
	}
	/** Rebuild the tooltip and context menu in the current locale. */
	relabel() {
		const tray = this.tray;
		if (tray === void 0) return;
		const { messages } = this.options.locale();
		tray.setToolTip(messages.aboutProduct);
		tray.setContextMenu(Menu.buildFromTemplate([
			{
				label: messages.openApplication,
				click: () => {
					this.options.open();
				}
			},
			{ type: "separator" },
			{
				label: messages.quitApplication,
				click: () => {
					this.options.quit();
				}
			}
		]));
	}`;
    const newClass = `var DesktopTray = class {
	options;
	tray;
	/** @param options - Icon path, locale reader, and the open and quit actions. */
	constructor(options) {
		/* ${MARK}: tray class */
		this.options = options;
		let image = nativeImage.createFromPath(options.iconPath);
		if (image.isEmpty()) {
			for (const p of options.fallbackPaths || []) {
				try {
					const next = nativeImage.createFromPath(p);
					if (!next.isEmpty()) { image = next; break; }
				} catch {}
			}
		}
		if (!image.isEmpty() && /\.png$/i.test(String(options.iconPath || "")) && image.getSize().width > 32) {
			try { image = image.resize({ width: 16, height: 16 }); } catch {}
		}
		const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
		this.tray = tray;
		const activate = () => {
			if (typeof options.toggle === "function") options.toggle();
			else options.open();
		};
		tray.on("click", activate);
		tray.on("double-click", activate);
		this.relabel();
	}
	/** Rebuild the tooltip and context menu in the current locale. */
	relabel() {
		const tray = this.tray;
		if (tray === void 0) return;
		const { messages } = this.options.locale();
		tray.setToolTip("Beam Agent"); /* ${MARK}: tooltip */
		tray.setContextMenu(Menu.buildFromTemplate([
			{
				label: messages.openApplication || "Открыть Beam Agent",
				click: () => {
					this.options.open();
				}
			},
			{ type: "separator" },
			{
				label: messages.quitApplication || "Выйти из Beam Agent",
				click: () => {
					this.options.quit();
				}
			}
		]));
	}`;
    if (s.includes(oldClass)) {
      s = s.split(oldClass).join(newClass);
      n++;
    } else if (s.includes("tray.setToolTip(messages.aboutProduct)")) {
      s = s.replace(
        "tray.setToolTip(messages.aboutProduct);",
        `tray.setToolTip("Beam Agent"); /* ${MARK}: tooltip */`,
      );
      n++;
      report.push(`soft tooltip ${path.relative(ROOT, file)}`);
    } else if (s.includes(`/* ${MARK}: tray class */`) || s.includes(`/* ${MARK}: tooltip */`)) {
      report.push(`tray already ${path.relative(ROOT, file)}`);
    } else {
      report.push(`WARN DesktopTray pattern miss ${path.relative(ROOT, file)}`);
    }
  }

  // Tray construction: fallbacks + toggle show/hide
  if (!s.includes(`/* ${MARK}: tray construct */`)) {
    const oldCtor = `	if (process.platform === "win32") try {
		tray = new DesktopTray({
			iconPath: trayIconPath,
			locale: currentDesktopLocale,
			open: () => {
				focusPrimaryWindow();
			},
			quit: () => {
				app.quit();
			}
		});
	} catch (error) {
		console.warn("desktop tray: unavailable", error);
	}`;
    const newCtor = `	if (process.platform === "win32") try {
		/* ${MARK}: tray construct */
		tray = new DesktopTray({
			iconPath: trayIconPath,
			fallbackPaths: [
				join(process.resourcesPath, "app.ico"),
				join(process.resourcesPath, "icon.png"),
				development ? join(app.getAppPath(), "resources", "icon-windows.png") : "",
			].filter(Boolean),
			locale: currentDesktopLocale,
			open: () => {
				focusPrimaryWindow();
			},
			toggle: () => {
				const window = welcomeWindow ?? mainWindow;
				if (window && !window.isDestroyed() && window.isVisible() && !window.isMinimized() && window.isFocused()) {
					try { window.hide(); } catch {}
					return;
				}
				focusPrimaryWindow();
			},
			quit: () => {
				app.quit();
			}
		});
	} catch (error) {
		console.warn("desktop tray: unavailable", error);
	}`;
    if (s.includes(oldCtor)) {
      s = s.split(oldCtor).join(newCtor);
      n++;
    } else if (!s.includes(`/* ${MARK}: tray construct */`)) {
      report.push(`WARN tray construct miss ${path.relative(ROOT, file)}`);
    }
  }

  // Ensure tray restore blank guard stays (do not strip)
  if (!s.includes("beam-finish-tray-restore")) {
    report.push(`WARN missing beam-finish-tray-restore ${path.relative(ROOT, file)}`);
  }
  if (!s.includes("beam-blank-window-harden")) {
    report.push(`WARN missing beam-blank-window-harden ${path.relative(ROOT, file)}`);
  }
  if (!s.includes("beam-bootstuck-noflicker")) {
    report.push(`WARN missing beam-bootstuck-noflicker ${path.relative(ROOT, file)}`);
  }

  // aboutProduct must stay Beam Agent for any remaining tooltip callers
  s = s.replace(/aboutProduct:\s*"DeepSeek[^"]*"/g, 'aboutProduct: "Beam Agent"');
  s = s.replace(/"aboutProduct":\s*"DeepSeek[^"]*"/g, '"aboutProduct": "Beam Agent"');

  if (s !== before) {
    fs.writeFileSync(file, s);
    report.push(`patched main (${n}) → ${path.relative(ROOT, file)}`);
  } else {
    report.push(`unchanged main ${path.relative(ROOT, file)}`);
  }
}

function ensureIcons() {
  const appIco = path.join(DIST, "resources", "app.ico");
  const trayIco = path.join(DIST, "resources", "tray.ico");
  const iconPng = path.join(DIST, "resources", "icon.png");
  const runtimeRes = path.join(ROOT, "runtime", "app", "resources");
  fs.mkdirSync(runtimeRes, { recursive: true });

  if (fs.existsSync(appIco)) {
    const trayStat = fs.existsSync(trayIco) ? fs.statSync(trayIco).size : 0;
    // Prefer multi-size app.ico when tray.ico is a tiny single-frame stub
    if (trayStat < 4096) {
      fs.copyFileSync(appIco, trayIco);
      report.push(`tray.ico ← app.ico (${fs.statSync(trayIco).size} bytes)`);
    } else {
      report.push(`tray.ico ok (${trayStat} bytes)`);
    }
    fs.copyFileSync(appIco, path.join(runtimeRes, "tray-windows.ico"));
    report.push("runtime tray-windows.ico synced");
  } else {
    report.push("WARN app.ico missing — skip tray sync");
  }

  if (fs.existsSync(iconPng)) {
    fs.copyFileSync(iconPng, path.join(runtimeRes, "icon-windows.png"));
    report.push("runtime icon-windows.png synced");
  }

  // Also place tray.ico next to packaged exe resources (already there) and root Start helpers unchanged.
}

function assertNoBeamBaseUrlEnv() {
  const envPath = path.join(os.homedir(), ".beam", ".env");
  if (!fs.existsSync(envPath)) {
    report.push("ok no ~/.beam/.env");
    return;
  }
  const text = fs.readFileSync(envPath, "utf8");
  if (/^\s*BEAM_BASE_URL\s*=/m.test(text)) {
    const next = text
      .split(/\r?\n/)
      .filter((line) => !/^\s*BEAM_BASE_URL\s*=/.test(line))
      .join("\n");
    fs.writeFileSync(envPath, next);
    report.push("REMOVED BEAM_BASE_URL from ~/.beam/.env");
  } else {
    report.push("ok ~/.beam/.env has no BEAM_BASE_URL");
  }
}

function reassertSilentLaunch() {
  const silent = path.join(ROOT, "desktop", "fix-silent-launch.mjs");
  if (!fs.existsSync(silent)) {
    report.push("WARN fix-silent-launch.mjs missing");
    return;
  }
  const r = spawnSync(process.execPath, [silent], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  report.push(`fix-silent-launch exit=${r.status}`);
}

function verifyGuards() {
  for (const file of MAIN_FILES) {
    if (!fs.existsSync(file)) continue;
    const s = fs.readFileSync(file, "utf8");
    const checks = {
      aumid: s.includes('setAppUserModelId("Assistix.BeamAgent")'),
      blankHarden: s.includes("beam-blank-window-harden"),
      noflicker: s.includes("beam-bootstuck-noflicker"),
      trayRestore: s.includes("beam-finish-tray-restore"),
      windowsHide: s.includes("BEAM_WINDOWS_HIDE_HOST"),
      tooltip: s.includes('setToolTip("Beam Agent")') || s.includes("tray.setToolTip(messages.aboutProduct)"),
      trayMark: s.includes(MARK),
    };
    report.push(`verify ${path.relative(ROOT, file)} ${JSON.stringify(checks)}`);
  }
  for (const file of PRELOAD_FILES) {
    if (!fs.existsSync(file)) continue;
    const s = fs.readFileSync(file, "utf8");
    report.push(
      `verify ${path.relative(ROOT, file)} ru=${s.includes("Приложение")} resolve=${s.includes(`${MARK}: ru-first`)}`,
    );
  }
}

// --- run ---
report.push(`=== ${MARK} ===`);
for (const f of PRELOAD_FILES) patchPreload(f);
for (const f of MAIN_FILES) patchMainTray(f);
ensureIcons();
assertNoBeamBaseUrlEnv();
reassertSilentLaunch();
verifyGuards();
console.log(report.join("\n"));
console.log("SHIP_STABILITY_TRAY_DONE");
