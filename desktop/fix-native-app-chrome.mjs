/**
 * Make Beam Agent feel like a native desktop app — never a localhost web GUI.
 *
 * What was exposing "localhost / URL" feel:
 * - BrowserWindow had no fixed title → Electron can fall back to document URL
 *   (beam-app://… or http://127.0.0.1:…) in the native title / Alt-Tab / taskbar.
 * - page-title-updated was not cancelled on the main window.
 * - Native Electron menu bar could still appear under the custom titlebar.
 * - Auto openDevTools in unpackaged builds looked like a browser shell.
 *
 * UI load path stays custom protocol: beam-app://app/ (internal bridge 127.0.0.1:17865 unchanged).
 * Does NOT write BEAM_BASE_URL into ~/.beam/.env.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_NATIVE_APP_CHROME";

const MAIN_FILES = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "lib", "main.js"),
];

const HTML_FILES = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html"),
];

const report = [];

function patchMain(file) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${path.relative(ROOT, file)}`);
    return;
  }
  let s = fs.readFileSync(file, "utf8");
  const before = s;
  let n = 0;

  // 1) Fixed product title + hide native menu bar on BrowserWindow
  if (!s.includes(`/* ${MARK}: window options */`)) {
    const oldOpts = `function createWindow(preload, show = false, primary = false) {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 520,
		minHeight: 600,
		show,`;
    const newOpts = `function createWindow(preload, show = false, primary = false) {
	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 520,
		minHeight: 600,
		show,
		title: "Beam Agent", /* ${MARK}: window options */
		autoHideMenuBar: true,`;
    if (!s.includes(oldOpts)) {
      report.push(`WARN createWindow options miss ${path.relative(ROOT, file)}`);
    } else {
      s = s.replace(oldOpts, newOpts);
      n++;
    }
  }

  // 2) Lock title + hide menu bar after create (never show URL / localhost)
  if (!s.includes(`/* ${MARK}: lock title */`)) {
    const needle = `	});
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
		return { action: "deny" };
	});`;
    const repl = `	});
	/* ${MARK}: lock title */
	try {
		window.setTitle("Beam Agent");
		window.setAutoHideMenuBar(true);
		window.setMenuBarVisibility(false);
	} catch {}
	window.on("page-title-updated", (event, title) => {
		event.preventDefault();
		const raw = String(title || "");
		const looksLikeUrl = /localhost|127\\.0\\.0\\.1|\\[::1\\]|:\\/\\/|beam-app:\\/\\/|dsh-app:\\/\\/|file:\\/\\//i.test(raw);
		const next = !raw.trim() || looksLikeUrl ? "Beam Agent" : (/Beam Agent/i.test(raw) ? raw : \`\${raw} — Beam Agent\`);
		if (!window.isDestroyed()) window.setTitle(next);
	});
	const lockBeamTitle = () => {
		if (window.isDestroyed()) return;
		try {
			window.setMenuBarVisibility(false);
			window.setAutoHideMenuBar(true);
			const cur = window.getTitle();
			if (!cur || /localhost|127\\.0\\.0\\.1|\\[::1\\]|:\\/\\/|beam-app:\\/\\/|dsh-app:\\/\\//i.test(cur)) window.setTitle("Beam Agent");
		} catch {}
	};
	window.webContents.on("did-finish-load", lockBeamTitle);
	window.webContents.on("did-navigate", lockBeamTitle);
	window.webContents.on("did-navigate-in-page", lockBeamTitle);
	window.webContents.setWindowOpenHandler(({ url }) => {
		if (["http:", "https:"].includes(new URL(url).protocol)) shell.openExternal(url);
		return { action: "deny" };
	});`;
    if (!s.includes(needle)) {
      report.push(`WARN setWindowOpenHandler miss ${path.relative(ROOT, file)}`);
    } else {
      s = s.replace(needle, repl);
      n++;
    }
  }

  // 3) After application menu refresh, keep native menu bar hidden on Windows
  if (!s.includes(`/* ${MARK}: hide menubar */`)) {
    const oldMenu = `	const refreshApplicationMenu = () => {
		Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === "win32" ? devToolsItems : [{
			label: darwin ? app.name : currentDesktopLocale().messages.application,
			submenu: [...applicationItems(), ...devToolsItems]
		}, ...platformMenus()]));
		tray?.relabel();
	};`;
    const newMenu = `	const refreshApplicationMenu = () => {
		Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === "win32" ? devToolsItems : [{
			label: darwin ? app.name : currentDesktopLocale().messages.application,
			submenu: [...applicationItems(), ...devToolsItems]
		}, ...platformMenus()]));
		/* ${MARK}: hide menubar */
		if (process.platform === "win32") {
			for (const w of BrowserWindow.getAllWindows()) {
				if (w.isDestroyed()) continue;
				try {
					w.setMenuBarVisibility(false);
					w.setAutoHideMenuBar(true);
				} catch {}
			}
		}
		tray?.relabel();
	};`;
    if (!s.includes(oldMenu)) {
      report.push(`WARN refreshApplicationMenu miss ${path.relative(ROOT, file)}`);
    } else {
      s = s.replace(oldMenu, newMenu);
      n++;
    }
  }

  // 4) Never auto-open DevTools unless explicitly requested (unpackaged default was "browser feel")
  if (!s.includes(`/* ${MARK}: no auto-devtools */`)) {
    const oldDev = `if (activate && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS !== "0") window.webContents.openDevTools({ mode: "detach" });`;
    const newDev = `if (activate && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS === "1") window.webContents.openDevTools({ mode: "detach" }); /* ${MARK}: no auto-devtools */`;
    if (s.includes(oldDev)) {
      s = s.split(oldDev).join(newDev);
      n++;
    } else if (s.includes(`/* ${MARK}: no auto-devtools */`)) {
      // already
    } else {
      // Second occurrence near end of file (focusPrimaryWindow path)
      const oldDev2 = `if (window !== void 0 && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS !== "0") window.webContents.openDevTools({ mode: "detach" });`;
      const newDev2 = `if (window !== void 0 && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS === "1") window.webContents.openDevTools({ mode: "detach" }); /* ${MARK}: no auto-devtools */`;
      if (s.includes(oldDev2)) {
        s = s.split(oldDev2).join(newDev2);
        n++;
      } else {
        report.push(`WARN openDevTools pattern miss ${path.relative(ROOT, file)}`);
      }
    }
    // Catch any remaining !== "0" openDevTools for desktop window
    s = s.replace(
      /development && process\.env\.DSH_DESKTOP_OPEN_DEVTOOLS !== "0"\) window\.webContents\.openDevTools\(\{ mode: "detach" \}\);/g,
      `development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS === "1") window.webContents.openDevTools({ mode: "detach" }); /* ${MARK}: no auto-devtools */`,
    );
  }

  // 5) Assert applicationUrl stays custom-protocol (do not rewrite to localhost)
  if (!s.includes('const applicationUrl = `${SCHEME}://app/`;')) {
    report.push(`WARN applicationUrl missing custom scheme ${path.relative(ROOT, file)}`);
  } else {
    report.push(`ok applicationUrl beam-app:// ${path.relative(ROOT, file)}`);
  }

  if (s !== before) {
    fs.writeFileSync(file, s);
    report.push(`patched main (${n}) → ${path.relative(ROOT, file)}`);
  } else {
    report.push(`unchanged main ${path.relative(ROOT, file)}`);
  }
}

function patchHtml(file) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${path.relative(ROOT, file)}`);
    return;
  }
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  // Ensure <title>Beam Agent</title>
  if (/<title>[^<]*<\/title>/.test(html)) {
    html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");
  }

  // Strengthen title scrubber against URL / localhost leak into document.title
  if (!html.includes(`/* ${MARK}: title scrub */`)) {
    const oldScrub = `  const beamScrubDocumentTitle = () => {
    try {
      let t = String(document.title || "");
      t = t.replace(/ASSISTIX\\s*Beam Agent/gi, "Beam Agent")
        .replace(/\\bDeepSeek\\b/gi, "Beam")
        .replace(/\\bHarness\\b/gi, "Beam Agent")
        .replace(/\\bKumo(?:router)?\\b/gi, "Beam")
        .replace(/Assistix Official/gi, "Beam");
      // Keep ASSISTIX ID only as auth product; strip other ASSISTIX chrome from title
      if (!/ASSISTIX ID/i.test(t)) t = t.replace(/\\bASSISTIX\\b/gi, "Beam");
      if (!t.trim() || t.trim() === "DSH" || t.trim() === "Beam") t = "Beam Agent";
      if (!/Beam Agent/i.test(t)) t = "Beam Agent";
      if (document.title !== t) document.title = t;
    } catch {}
  };`;
    const newScrub = `  const beamScrubDocumentTitle = () => {
    try {
      let t = String(document.title || "");
      /* ${MARK}: title scrub */
      if (/localhost|127\\.0\\.0\\.1|\\[::1\\]|beam-app:\\/\\/|dsh-app:\\/\\/|https?:\\/\\//i.test(t)) t = "Beam Agent";
      t = t.replace(/ASSISTIX\\s*Beam Agent/gi, "Beam Agent")
        .replace(/\\bDeepSeek\\b/gi, "Beam")
        .replace(/\\bHarness\\b/gi, "Beam Agent")
        .replace(/\\bKumo(?:router)?\\b/gi, "Beam")
        .replace(/Assistix Official/gi, "Beam");
      // Keep ASSISTIX ID only as auth product; strip other ASSISTIX chrome from title
      if (!/ASSISTIX ID/i.test(t)) t = t.replace(/\\bASSISTIX\\b/gi, "Beam");
      if (!t.trim() || t.trim() === "DSH" || t.trim() === "Beam") t = "Beam Agent";
      if (!/Beam Agent/i.test(t)) t = "Beam Agent";
      if (document.title !== t) document.title = t;
    } catch {}
  };`;
    if (html.includes(oldScrub)) {
      html = html.replace(oldScrub, newScrub);
    } else if (html.includes("const beamScrubDocumentTitle")) {
      // Soft insert after first assignment
      html = html.replace(
        /const beamScrubDocumentTitle = \(\) => \{\s*try \{\s*let t = String\(document\.title \|\| ""\);/,
        `const beamScrubDocumentTitle = () => {\n    try {\n      let t = String(document.title || "");\n      /* ${MARK}: title scrub */\n      if (/localhost|127\\.0\\.0\\.1|\\[::1\\]|beam-app:\\/\\/|dsh-app:\\/\\/|https?:\\/\\//i.test(t)) t = "Beam Agent";`,
      );
    } else {
      report.push(`WARN title scrub miss ${path.relative(ROOT, file)}`);
    }
  }

  // Never surface bridge URL in any injector-rendered note (keep BRIDGE const for fetch only)
  if (!html.includes(`/* ${MARK}: hide bridge url */`) && html.includes('const BRIDGE = "http://127.0.0.1:17865"')) {
    html = html.replace(
      'const BRIDGE = "http://127.0.0.1:17865";',
      'const BRIDGE = "http://127.0.0.1:17865"; /* ${MARK}: hide bridge url — internal fetch only, never render */',
    );
  }

  if (html !== before) {
    fs.writeFileSync(file, html);
    report.push(`patched html → ${path.relative(ROOT, file)}`);
  } else {
    report.push(`unchanged html ${path.relative(ROOT, file)}`);
  }
}

for (const f of MAIN_FILES) patchMain(f);
for (const f of HTML_FILES) patchHtml(f);

console.log(JSON.stringify({ mark: MARK, report }, null, 2));
