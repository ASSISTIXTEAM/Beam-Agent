/**
 * Boot ready cap was 12s but desktop IPC host-ready race is 14s.
 * Auth/session restore + injection scripts often exceed 12s →
 * "web boot: host ready timeout" → bootFailed reload → blank black UI.
 * Raise cap to 45s (still bounded).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rels = [
	"dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
	"runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js"),
];

const OLD = 'setTimeout(()=>rej(new Error("web boot: host ready timeout")),12e3)';
const NEW = 'setTimeout(()=>rej(new Error("web boot: host ready timeout")),45e3)';

let n = 0;
for (const r of rels) {
	const p = path.isAbsolute(r) ? r : path.join(ROOT, r);
	if (!fs.existsSync(p)) continue;
	let s = fs.readFileSync(p, "utf8");
	if (s.includes(NEW)) {
		console.log("already", p);
		continue;
	}
	if (!s.includes(OLD)) {
		console.warn("pattern missing", p);
		continue;
	}
	fs.writeFileSync(p, s.replaceAll(OLD, NEW));
	n++;
	console.log("patched", p);
}
console.log("done", n);
