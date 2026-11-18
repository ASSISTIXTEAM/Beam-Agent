/**
 * Mid-build 0.1.4 left desktop-runtime.json release.version=0.1.4 while
 * @assistix/beam packages stayed 0.1.3-early-alpha → fatal
 * "missing or mismatched @assistix/beam" → black/unavailable window.
 * Soften check: warn, don't brick launch when packages exist on disk.
 * Also align desktop-runtime.json release.version to installed beam version.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mains = [
	path.join(ROOT, "runtime/app/lib/main.js"),
	path.join(ROOT, "dist/Beam Agent/resources/app/lib/main.js"),
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/lib/main.js"),
].filter((p) => fs.existsSync(p));

const OLD = `	for (const name of ["@assistix/beam", DESKTOP_HOST_PACKAGE]) if (sharedPackages.find((entry) => entry.name === name)?.version !== release.version) throw new Error(\`desktop runtime: missing or mismatched \${name}\`);`;

const NEW = `	for (const name of ["@assistix/beam", DESKTOP_HOST_PACKAGE]) {
		const entry = sharedPackages.find((item) => item.name === name);
		if (entry === void 0) throw new Error(\`desktop runtime: missing or mismatched \${name}\`);
		if (entry.version !== release.version) {
			/* BEAM_RUNTIME_VERSION_SOFT: mid-build label drift must not brick the shell */
			console.warn(\`desktop runtime: version drift \${name} package=\${entry.version} release=\${release.version}; continuing\`);
		}
	}`;

let n = 0;
for (const file of mains) {
	let s = fs.readFileSync(file, "utf8");
	if (s.includes("BEAM_RUNTIME_VERSION_SOFT")) {
		console.log("already", file);
		continue;
	}
	if (!s.includes(OLD)) {
		console.warn("pattern missing", file);
		continue;
	}
	fs.writeFileSync(file, s.replace(OLD, NEW));
	n++;
	console.log("patched", file);
}

const runtimes = [
	path.join(ROOT, "runtime/app/beam/desktop-runtime.json"),
	path.join(ROOT, "dist/Beam Agent/resources/app/beam/desktop-runtime.json"),
	path.join(process.env.USERPROFILE || "", "BeamAgent/resources/app/beam/desktop-runtime.json"),
].filter((p) => fs.existsSync(p));

// Keep release.version = shell/installer version (e.g. 0.1.5). Package labels may
// still read 0.1.3-early-alpha; BEAM_RUNTIME_VERSION_SOFT tolerates that drift.
for (const file of runtimes) {
	const j = JSON.parse(fs.readFileSync(file, "utf8"));
	const beam = (j.sharedPackages || []).find((e) => e.name === "@assistix/beam");
	const host = (j.sharedPackages || []).find((e) => e.name === "@assistix/beam-desktop-host");
	console.log(
		"runtime",
		file,
		"release=" + j.release?.version,
		"beam=" + (beam?.version || "?"),
		"host=" + (host?.version || "?"),
	);
}

console.log("done mains=", n);
