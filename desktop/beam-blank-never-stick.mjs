/**
 * Make blank BrowserWindow impossible to leave stuck:
 * - never reportFatal for blank/did-fail-load remounts (soft infinite retry + cooldown)
 * - listen for SyntaxError in renderer console → remount after file settle
 * - tray restore already remounts; keep markers
 * Applies runtime + dist. No BEAM_BASE_URL writes.
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

const MARK = "beam-blank-never-stick";

const OLD = `		const remountApplication = (why) => {
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
		};`;

const NEW = `		const remountApplication = (why) => {
			/* ${MARK}: soft infinite remount — never leave sticky void via reportFatal */
			if (quitting || window.isDestroyed() || (typeof recovery !== "undefined" && recovery.active)) return;
			const now = Date.now();
			if (now - blankFailLastAt > 30000) blankFailRecoveries = 0;
			blankFailLastAt = now;
			blankFailRecoveries += 1;
			console.warn("desktop blank-recover:", why, "attempt", blankFailRecoveries);
			const wc = window.webContents;
			if (!wc || wc.isDestroyed()) return;
			const target = typeof applicationUrl !== "undefined" && applicationUrl ? String(applicationUrl) : "beam-app://app/";
			const delay = blankFailRecoveries === 1 ? 200 : Math.min(8000, 400 * blankFailRecoveries);
			setTimeout(() => {
				if (quitting || window.isDestroyed() || (typeof recovery !== "undefined" && recovery.active)) return;
				try {
					navigation = void 0;
					wc.loadURL(target).catch(() => { try { wc.reloadIgnoringCache?.() ?? wc.reload(); } catch {} });
				} catch {
					try { wc.reload(); } catch {}
				}
			}, delay);
		};`;

const CONSOLE_HOOK_OLD = `		window.webContents.on("console-message", (details) => {
			if (details.level !== "error") return;
			rendererConsole.push(\`\${details.sourceId}:\${String(details.lineNumber)} \${details.message}\`);
		});`;

const CONSOLE_HOOK_NEW = `		window.webContents.on("console-message", (details) => {
			if (details.level !== "error") return;
			rendererConsole.push(\`\${details.sourceId}:\${String(details.lineNumber)} \${details.message}\`);
			/* ${MARK}: syntax/boot errors → remount instead of sticky chrome */
			if (/SyntaxError|Unexpected number|Unexpected token|HTML did not preload|client-modules|web boot:/i.test(String(details.message || ""))) {
				try { remountApplication("console:" + String(details.message).slice(0, 80)); } catch {}
			}
		});`;

function patchMain(file) {
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  if (!s.includes(MARK)) {
    if (s.includes(OLD)) {
      s = s.split(OLD).join(NEW);
      n++;
    } else if (s.includes("Desktop UI stayed blank after recoveries")) {
      s = s.replace(
        /else reportFatal\(new Error\(`Desktop UI stayed blank after recoveries \(\$\{why\}\)`\), "renderer"\);[\s\S]*?setTimeout\(go, blankFailRecoveries === 1 \? 250 : 900\);/,
        `/* ${MARK} */ navigation = void 0; wc.loadURL(target).catch(() => { try { wc.reload(); } catch {} });
				} catch { try { wc.reload(); } catch {} }
			};
			setTimeout(go, blankFailRecoveries === 1 ? 200 : Math.min(8000, 400 * blankFailRecoveries));`,
      );
      if (s.includes(MARK)) n++;
      else console.warn("miss remount replace", path.relative(ROOT, file));
    } else console.warn("miss remount block", path.relative(ROOT, file));
  }
  // Move remountApplication above console-message OR inject hook after remount exists
  if (s.includes(MARK) && !s.includes(`${MARK}: syntax/boot`)) {
    // console-message currently BEFORE remountApplication — reorder by patching console to delayed check
    if (s.includes(CONSOLE_HOOK_OLD) && s.includes("const remountApplication")) {
      // console-message is before remount — use deferred global hook instead
      const deferred = `		window.webContents.on("console-message", (details) => {
			if (details.level !== "error") return;
			rendererConsole.push(\`\${details.sourceId}:\${String(details.lineNumber)} \${details.message}\`);
			/* ${MARK}: syntax/boot errors → remount instead of sticky chrome */
			if (/SyntaxError|Unexpected number|Unexpected token|HTML did not preload|client-modules|web boot:/i.test(String(details.message || ""))) {
				setTimeout(() => { try { typeof remountApplication === "function" && remountApplication("console:" + String(details.message).slice(0, 80)); } catch {} }, 50);
			}
		});`;
      // Only if remount is in TDZ after console — use setTimeout + function hoisting won't work for const.
      // Place hook AFTER remountApplication definition instead.
      s = s.replace(CONSOLE_HOOK_OLD, `		window.webContents.on("console-message", (details) => {
			if (details.level !== "error") return;
			rendererConsole.push(\`\${details.sourceId}:\${String(details.lineNumber)} \${details.message}\`);
		});`);
      if (!s.includes(`${MARK}: syntax/boot`)) {
        s = s.replace(
          "window.webContents.on(\"did-fail-load\",",
          `window.webContents.on("console-message", (details) => {
			if (details.level !== "error") return;
			if (/SyntaxError|Unexpected number|Unexpected token|HTML did not preload|client-modules|web boot:/i.test(String(details.message || ""))) {
				/* ${MARK}: syntax/boot errors → remount instead of sticky chrome */
				try { remountApplication("console:" + String(details.message).slice(0, 80)); } catch {}
			}
		});
		window.webContents.on("did-fail-load",`,
        );
        // Remove duplicate simple console-message if we left one above remount
        // Keep first console-message for rendererConsole push; second adds remount — OK both fire
        if (s.includes(`${MARK}: syntax/boot`)) n++;
      }
    }
  }
  // Ensure blank watch treats Application/Edit-only chrome as blank (no root UI)
  if (!s.includes("beam-blank-empty-chrome")) {
    const oldBlank = `const hasUi = !!(root && (root.childElementCount > 0 || text.length > 12 || root.querySelector("canvas,img,svg,input,textarea,[contenteditable],button")));
						const stuckBoot = !!(boot && text.length < 40 && !hasUi);
						return { blank: !hasUi || stuckBoot, href: location.href, textLen: text.length };`;
    const newBlank = `const hasUi = !!(root && (root.childElementCount > 0 || text.length > 12 || root.querySelector("canvas,img,svg,input,textarea,[contenteditable],button,[data-shell-overlay]")));
						const stuckBoot = !!(boot && text.length < 40 && !hasUi);
						const emptyChrome = !root || root.childElementCount === 0; /* beam-blank-empty-chrome */
						return { blank: emptyChrome || !hasUi || stuckBoot, href: location.href, textLen: text.length };`;
    if (s.includes(oldBlank)) {
      s = s.split(oldBlank).join(newBlank);
      n++;
    }
  }
  if (n) fs.writeFileSync(file, s);
  return n;
}

let total = 0;
for (const tree of TREES) {
  const file = path.join(tree, "lib", "main.js");
  const n = patchMain(file);
  console.log("patched", path.relative(ROOT, file), n);
  total += n;
}
console.log(JSON.stringify({ patches: total, mark: MARK }));
