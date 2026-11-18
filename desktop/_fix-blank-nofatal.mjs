/**
 * Blank recovery must KEEP remounting — never escalate to «Beam Agent недоступен».
 * Also treat boot spinner as non-blank; widen cooldown.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "beam-blank-nofatal";
const files = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam Agent/resources/app/lib/main.js"),
];

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
		};`;

const NEW = `		const remountApplication = (why) => {
			/* ${MARK}: never escalate blank remounts to crash dialog */
			if (quitting || window.isDestroyed()) return;
			const now = Date.now();
			if (now - blankFailLastAt > 45000) blankFailRecoveries = 0;
			blankFailLastAt = now;
			blankFailRecoveries += 1;
			console.warn("desktop blank-recover:", why, "attempt", blankFailRecoveries);
			const wc = window.webContents;
			if (!wc || wc.isDestroyed()) return;
			const target = typeof applicationUrl !== "undefined" && applicationUrl ? String(applicationUrl) : "beam-app://app/";
			const delay = blankFailRecoveries === 1 ? 200 : Math.min(4000, 600 * blankFailRecoveries);
			setTimeout(() => {
				if (quitting || window.isDestroyed() || wc.isDestroyed()) return;
				try {
					navigation = void 0;
					wc.loadURL(target).catch(() => { try { wc.reloadIgnoringCache(); } catch { try { wc.reload(); } catch {} } });
				} catch {
					try { wc.reload(); } catch {}
				}
			}, delay);
		};
		const scheduleBlankWatch = () => {
			if (quitting || window.isDestroyed()) return;
			const delays = [4000, 9000, 16000];
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
						const boot = document.querySelector("[data-dsh-boot], [data-dsh-boot-spinner], [data-beam-boot]");
						const overlay = document.querySelector("[data-shell-overlay]");
						const text = ((root && root.innerText) || (document.body && document.body.innerText) || "").trim();
						if (boot || overlay) return { blank: false, booting: !!boot, textLen: text.length };
						const hasUi = !!(root && (root.childElementCount > 0 || text.length > 20 || root.querySelector("canvas,img,svg,input,textarea,[contenteditable],button,[role=textbox]")));
						return { blank: !hasUi, href: location.href, textLen: text.length };
					})()\`, true).then((info) => {
						if (info && info.blank) remountApplication("blank-document");
					}).catch(() => {});
				}, ms);
			}
		};`;

let n = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(MARK)) {
    console.log("already", path.relative(ROOT, file));
    continue;
  }
  if (!s.includes(OLD)) {
    console.warn("miss block", path.relative(ROOT, file));
    // try softer: just kill reportFatal in remount
    if (s.includes("Desktop UI stayed blank after recoveries")) {
      s = s.replace(
        /else reportFatal\(new Error\(`Desktop UI stayed blank after recoveries \(\$\{why\}\)`\), "renderer"\);/,
        `else { /* ${MARK} */ navigation = void 0; wc.loadURL(target).catch(() => { try { wc.reload(); } catch {} }); }`,
      );
      s = s.replace(
        /if \(blankFailRecoveries > 5\) reportFatal\(error instanceof Error \? error : new Error\(String\(error\)\), "renderer"\);/,
        `/* ${MARK} */ try { wc.reload(); } catch {}`,
      );
      fs.writeFileSync(file, s);
      n++;
      console.log("soft-patched", path.relative(ROOT, file));
    }
    continue;
  }
  s = s.split(OLD).join(NEW);
  fs.writeFileSync(file, s);
  n++;
  console.log("patched", path.relative(ROOT, file));
}
console.log(JSON.stringify({ patched: n, mark: MARK }));
