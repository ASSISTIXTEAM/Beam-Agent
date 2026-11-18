/**
 * Bump shell/installer markers 0.1.5 → 0.1.6 for a clean post-boot-fix release.
 * Keeps @assistix/beam package labels at 0.1.3-early-alpha (soft version check).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = "0.1.5";
const TO = "0.1.6";

const textFiles = [
	"desktop/package-installer.mjs",
	"desktop/build-beam.mjs",
	"desktop/make-exe-icon.mjs",
	"desktop/patch-locale-updates.mjs",
	"desktop/bridge/server.js",
	"desktop/installer/beam-agent.iss",
	"desktop/installer/deploy-early-alpha.py",
	"desktop/installer/write-update-feeds.mjs",
	"desktop/UPDATES.md",
	"desktop/publish-desktop-update.py",
	"dist/Beam Agent/resources/app/package.json",
	"runtime/app/package.json",
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/package.json"),
	"dist/Beam Agent/bridge/server.js",
	"runtime/../desktop/bridge/server.js",
].map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)));

// Also sync installed + dist bridge copies under Beam Agent folders
const extraBridges = [
	path.join(ROOT, "dist/Beam Agent/bridge/server.js"),
	path.join(process.env.USERPROFILE || "", "BeamAgent/bridge/server.js"),
];

const all = [...new Set([...textFiles, ...extraBridges])].filter((p) => fs.existsSync(p));

let n = 0;
for (const file of all) {
	let s = fs.readFileSync(file, "utf8");
	const before = s;
	if (file.endsWith("package.json")) {
		const j = JSON.parse(s);
		if (j.version === FROM || j.version === "0.1.5") {
			j.version = TO;
			s = JSON.stringify(j, null, 2) + "\n";
		}
	} else if (file.endsWith(".iss")) {
		s = s
			.replaceAll(`#define MyAppVersion "${FROM}"`, `#define MyAppVersion "${TO}"`)
			.replaceAll(`Beam-Agent-${FROM}-Setup`, `Beam-Agent-${TO}-Setup`)
			.replaceAll(`VersionInfoVersion=${FROM}.0`, `VersionInfoVersion=${TO}.0`)
			.replaceAll(`VersionInfoProductVersion=${FROM}.0`, `VersionInfoProductVersion=${TO}.0`);
	} else {
		// conservative replacements for known version constants
		s = s
			.replaceAll(`'${FROM}'`, `'${TO}'`)
			.replaceAll(`"${FROM}"`, `"${TO}"`)
			.replaceAll(`Beam-Agent-${FROM}-Setup`, `Beam-Agent-${TO}-Setup`)
			.replaceAll(`Beam Agent ${FROM}`, `Beam Agent ${TO}`)
			.replaceAll(`${FROM}.0`, `${TO}.0`)
			.replaceAll(`/${FROM}`, `/${TO}`)
			.replaceAll(`= ${FROM}`, `= ${TO}`)
			.replaceAll(`VERSION = "${FROM}"`, `VERSION = "${TO}"`)
			.replaceAll(`VERSION = '${FROM}'`, `VERSION = '${TO}'`);
	}
	if (s !== before) {
		fs.writeFileSync(file, s);
		n++;
		console.log("bumped", path.relative(ROOT, file));
	} else {
		console.log("unchanged", path.relative(ROOT, file));
	}
}

const runtimes = [
	path.join(ROOT, "dist/Beam Agent/resources/app/beam/desktop-runtime.json"),
	path.join(ROOT, "runtime/app/beam/desktop-runtime.json"),
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/beam/desktop-runtime.json"),
].filter((p) => fs.existsSync(p));

for (const file of runtimes) {
	const j = JSON.parse(fs.readFileSync(file, "utf8"));
	const before = j.release?.version;
	j.release.version = TO;
	fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
	console.log("runtime release", before, "->", TO, path.relative(ROOT, file));
}

console.log("done files=", n, "version=", TO);
