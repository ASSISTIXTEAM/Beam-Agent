/**
 * Boot IPC was racing the full startup promise (including openInitialWindow /
 * welcome UI) against a 14s cap. Host+auth often finish first while welcome
 * work continues → "Desktop Host ready timeout" despite a live Host.
 * Wait for hostUrl only, with a 60s bound.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
	path.join(ROOT, "dist/Beam-Agent/resources/app/lib/main.js"),
	path.join(ROOT, "runtime/app/lib/main.js"),
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/lib/main.js"),
].filter((p) => fs.existsSync(p));

const OLD = `ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
		assertDesktopSender(event, ["app"]);
		/* beam-boot-ipc-cap: host must become ready fairly fast; do not hang splash forever */
		await Promise.race([
			Promise.resolve(startup),
			new Promise((_, reject) => setTimeout(() => reject(new Error("Desktop Host ready timeout")), 14000))
		]);
		if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");
		return {
			injections,
			streamBaseUrl: new URL(hostUrl).origin
		};
	});`;

const NEW = `ipcMain.handle(DESKTOP_IPC.boot, async (event) => {
		assertDesktopSender(event, ["app"]);
		/* beam-boot-ipc-cap: wait for host+auth only — openInitialWindow/welcome must not block renderer boot */
		reconcileBackend();
		const bootDeadline = Date.now() + 60000;
		while (backend.host === void 0 || hostUrl === void 0) {
			if (Date.now() > bootDeadline) throw new Error("Desktop Host ready timeout");
			await new Promise((resolve) => setTimeout(resolve, 100));
			if (startup === void 0 && (backend.host === void 0 || hostUrl === void 0)) {
				await new Promise((resolve) => setTimeout(resolve, 250));
				if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");
				break;
			}
		}
		if (backend.host === void 0 || hostUrl === void 0) throw new Error("Desktop Host is unavailable");
		return {
			injections,
			streamBaseUrl: new URL(hostUrl).origin
		};
	});`;

let n = 0;
for (const file of files) {
	let s = fs.readFileSync(file, "utf8");
	if (s.includes("wait for host+auth only")) {
		console.log("already", file);
		continue;
	}
	if (!s.includes(OLD)) {
		const idx = s.indexOf("beam-boot-ipc-cap");
		console.warn("pattern missing", file, "capIdx", idx);
		if (idx >= 0) console.warn(JSON.stringify(s.slice(Math.max(0, idx - 40), idx + 420)));
		continue;
	}
	fs.writeFileSync(file, s.replace(OLD, NEW));
	n++;
	console.log("patched", file);
}
console.log("done", n);
