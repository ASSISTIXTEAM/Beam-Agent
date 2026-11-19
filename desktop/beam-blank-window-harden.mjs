/**
 * Harden Beam Agent against sticky blank BrowserWindow:
 * - did-fail-load / render-process-gone → remount with cooldown (not immediate fatal)
 * - after navigate / finish-load → blank-document watchdog
 * - bootFailed already recovers client-modules races; keep compatible
 * Applies to runtime/app + dist/.../resources/app. Does not change custom protocol scheme.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
].filter((p) => fs.existsSync(path.join(p, "lib", "main.js")));

const MARK = "beam-blank-window-harden";

const FAIL_LOAD_OLD = `		window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
			if (isMainFrame && code !== -3 && !quitting && !window.isDestroyed()) reportFatal(/* @__PURE__ */ new Error(\`Desktop page failed to load: \${url} (\${String(code)}: \${description})\`), "renderer");
		});
		window.webContents.on("preload-error", (_event, _path, error) => {
			if (!quitting && !window.isDestroyed()) reportFatal(error, "renderer");
		});
		window.webContents.on("render-process-gone", (_event, details) => {
			navigation = void 0;
			if (!quitting && !window.isDestroyed() && details.reason !== "clean-exit") reportFatal(/* @__PURE__ */ new Error(\`Desktop renderer exited: \${details.reason}\`), "renderer");
		});
		return window;`;

const FAIL_LOAD_NEW = `		/* ${MARK}: recover blank / failed loads instead of sticky empty chrome */
		let blankFailRecoveries = 0;
		let blankFailLastAt = 0;
		const remountApplication = (why) => {
			if (quitting || window.isDestroyed()) return;
			const now = Date.now();
			if (now - blankFailLastAt > 20000) blankFailRecoveries = 0;
			blankFailLastAt = now;
			blankFailRecoveries += 1;
			console.warn("desktop blank-recover:", why, "attempt", blankFailRecoveries);
			const wc = window.webContents;
			if (!wc || wc.isDestroyed()) return;
			const target = typeof applicationUrl !== "undefined" && applicationUrl ? String(applicationUrl) : "beam-app://app/";
			const go = () => {
				try {
					if (blankFailRecoveries <= 3) wc.loadURL(target).catch(() => { try { wc.reload(); } catch {} });
					else if (blankFailRecoveries <= 5) { try { wc.reload(); } catch {} }
					else reportFatal(new Error(\`Desktop UI stayed blank after recoveries (\${why})\`), "renderer");
				} catch (error) {
					if (blankFailRecoveries > 5) reportFatal(error instanceof Error ? error : new Error(String(error)), "renderer");
				}
			};
			setTimeout(go, blankFailRecoveries === 1 ? 250 : 900);
		};
		const scheduleBlankWatch = () => {
			if (quitting || window.isDestroyed()) return;
			const delays = [2500, 6000, 12000];
			for (const ms of delays) {
				setTimeout(() => {
					if (quitting || window.isDestroyed()) return;
					const wc = window.webContents;
					if (!wc || wc.isDestroyed()) return;
					const url = (() => { try { return wc.getURL?.() || ""; } catch { return ""; } })();
					if (!url || url === "about:blank") {
						remountApplication("about-blank");
						return;
					}
					if (!url.startsWith("beam-app://app")) return;
					wc.executeJavaScript(\`(function(){
						const root = document.getElementById("root");
						const boot = document.querySelector("[data-dsh-boot], [data-dsh-boot-spinner]");
						const text = ((root && root.innerText) || (document.body && document.body.innerText) || "").trim();
						const hasUi = !!(root && (root.childElementCount > 0 || text.length > 12 || root.querySelector("canvas,img,svg,input,textarea,[contenteditable],button")));
						const stuckBoot = !!(boot && text.length < 40 && !hasUi);
						return { blank: !hasUi || stuckBoot, href: location.href, textLen: text.length };
					})()\`, true).then((info) => {
						if (info && info.blank) remountApplication("blank-document");
					}).catch(() => {});
				}, ms);
			}
		};
		window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
			if (!isMainFrame || code === -3 || quitting || window.isDestroyed()) return;
			console.warn("desktop did-fail-load:", code, description, url);
			remountApplication(\`did-fail-load:\${code}\`);
		});
		window.webContents.on("did-finish-load", () => {
			scheduleBlankWatch();
		});
		window.webContents.on("preload-error", (_event, _path, error) => {
			if (!quitting && !window.isDestroyed()) {
				console.warn("desktop preload-error:", error);
				remountApplication("preload-error");
			}
		});
		window.webContents.on("render-process-gone", (_event, details) => {
			navigation = void 0;
			if (!quitting && !window.isDestroyed() && details.reason !== "clean-exit") remountApplication(\`renderer-gone:\${details.reason}\`);
		});
		return window;`;

const NAVIGATE_OLD = `	const navigateMain = (url) => {
		const window = mainWindow;
		if (quitting || window === void 0 || window.isDestroyed()) return Promise.resolve();
		if (navigation?.window === window && navigation.url === url) return navigation.promise;
		const next = {
			window,
			url,
			promise: Promise.resolve()
		};
		next.promise = window.loadURL(url).catch((error) => {
			if (quitting || shuttingDown || window.isDestroyed() || navigation !== next || error instanceof Error && "code" in error && error.code === "ERR_ABORTED") return;
			navigation = void 0;
			throw error;
		});
		navigation = next;
		return next.promise;
	};`;

const NAVIGATE_NEW = `	const navigateMain = (url) => {
		/* ${MARK}: resilient loadURL with one silent retry */
		const window = mainWindow;
		if (quitting || window === void 0 || window.isDestroyed()) return Promise.resolve();
		if (navigation?.window === window && navigation.url === url) return navigation.promise;
		const next = {
			window,
			url,
			promise: Promise.resolve()
		};
		const attempt = (retry) => window.loadURL(url).catch((error) => {
			if (quitting || shuttingDown || window.isDestroyed() || navigation !== next || error instanceof Error && "code" in error && error.code === "ERR_ABORTED") return;
			if (!retry) {
				console.warn("desktop navigateMain retry after", error);
				return new Promise((resolve) => setTimeout(resolve, 400)).then(() => attempt(true));
			}
			navigation = void 0;
			throw error;
		});
		next.promise = attempt(false);
		navigation = next;
		return next.promise;
	};`;

function patchFile(file) {
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  if (!s.includes(`${MARK}: recover blank`)) {
    if (s.includes(FAIL_LOAD_OLD)) {
      s = s.split(FAIL_LOAD_OLD).join(FAIL_LOAD_NEW);
      n++;
    } else {
      console.warn("miss fail-load block", path.relative(ROOT, file));
    }
  } else {
    console.log("fail-load already", path.relative(ROOT, file));
  }
  if (!s.includes(`${MARK}: resilient loadURL`)) {
    if (s.includes(NAVIGATE_OLD)) {
      s = s.split(NAVIGATE_OLD).join(NAVIGATE_NEW);
      n++;
    } else {
      console.warn("miss navigateMain block", path.relative(ROOT, file));
    }
  } else {
    console.log("navigate already", path.relative(ROOT, file));
  }
  // Widen bootFailed recoveries slightly (idempotent)
  if (!s.includes("beam-blank-boot-widen")) {
    const widened = s.replace(
      /if \(\/HTML did not preload\|client-modules\/i\.test\(message\)\) \{/,
      `if (/HTML did not preload|client-modules|web boot:|boot readiness is missing|__ModuleLoader__/i.test(message)) { /* beam-blank-boot-widen */`,
    );
    if (widened !== s) {
      s = widened;
      n++;
    }
  }
  if (n) fs.writeFileSync(file, s);
  return n;
}

function quarantineSessions() {
  const sessionsRoot = path.join(process.env.USERPROFILE || "", ".beam", "sessions");
  if (!fs.existsSync(sessionsRoot)) return 0;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destRoot = path.join(sessionsRoot, `_quarantine_blankfix_${stamp}`);
  let n = 0;
  const badId = "0d4c62d3-423a-4bff-8613-d278c59a01c8";
  for (const ent of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith("_quarantine")) continue;
    const dir = path.join(sessionsRoot, ent.name);
    if (/deepseek-harness/i.test(ent.name)) {
      fs.mkdirSync(destRoot, { recursive: true });
      fs.renameSync(dir, path.join(destRoot, ent.name));
      n++;
      continue;
    }
    for (const sub of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      if (sub.name.includes(badId) || /deepseek-harness/i.test(sub.name)) {
        fs.mkdirSync(path.join(destRoot, ent.name), { recursive: true });
        fs.renameSync(path.join(dir, sub.name), path.join(destRoot, ent.name, sub.name));
        n++;
      }
    }
  }
  return n;
}

let total = 0;
for (const tree of TREES) {
  const file = path.join(tree, "lib", "main.js");
  const n = patchFile(file);
  console.log("patched", path.relative(ROOT, file), n);
  total += n;
}
const q = quarantineSessions();
console.log(JSON.stringify({ trees: TREES.length, patches: total, quarantined: q, mark: MARK }));
