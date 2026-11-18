/**
 * Give boot a long grace period before blank remount; never remount while spinner shows.
 * Prevents remount storms that leave UI forever on «Loading…».
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "beam-blank-grace";
const files = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam Agent/resources/app/lib/main.js"),
];

for (const file of files) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(MARK)) {
    console.log("already", path.relative(ROOT, file));
    continue;
  }
  if (!s.includes("beam-blank-nofatal")) {
    console.warn("nofatal missing", path.relative(ROOT, file));
  }
  // Replace scheduleBlankWatch delays + logic with grace-aware version
  const re = /const scheduleBlankWatch = \(\) => \{[\s\S]*?\n\t\t\};/;
  if (!re.test(s)) {
    console.warn("no scheduleBlankWatch", path.relative(ROOT, file));
    continue;
  }
  const next = `const scheduleBlankWatch = () => {
			/* ${MARK}: long grace; never fight an active boot spinner */
			if (quitting || window.isDestroyed()) return;
			if (!window.__beamBlankWatchArmedAt) window.__beamBlankWatchArmedAt = Date.now();
			const delays = [20000, 35000, 55000];
			for (const ms of delays) {
				setTimeout(() => {
					if (quitting || window.isDestroyed()) return;
					if (Date.now() - (window.__beamBlankWatchArmedAt || 0) < 15000) return;
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
						if (boot || overlay || /Loading Beam|Загрузка Beam|Loading plugins/i.test(text)) return { blank: false, booting: true, textLen: text.length };
						const hasUi = !!(root && (root.childElementCount > 0 || text.length > 20 || root.querySelector("canvas,img,svg,input,textarea,[contenteditable],button,[role=textbox]")));
						return { blank: !hasUi, href: location.href, textLen: text.length };
					})()\`, true).then((info) => {
						if (info && info.blank) remountApplication("blank-document");
					}).catch(() => {});
				}, ms);
			}
		};`;
  s = s.replace(re, next);
  fs.writeFileSync(file, s);
  console.log("patched", path.relative(ROOT, file), s.includes(MARK));
}
