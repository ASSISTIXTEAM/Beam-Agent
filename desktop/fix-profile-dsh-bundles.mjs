/**
 * ROOT CAUSE: rebrand left initProfile/writeProfileBundles writing only
 * `beam.profile.bundles`, while loadProfileDirectory reads only
 * `dsh.profile.bundles`. Empty bundles → no webserver/connection plugins →
 * "profile booted without connection/webServer".
 *
 * Fix: always write BOTH keys; loader falls back beam→dsh; heal live profiles.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MAINS = [
	path.join(ROOT, "runtime", "app", "lib", "main.js"),
	path.join(ROOT, "dist", "Beam Agent", "resources", "app", "lib", "main.js"),
	path.join(process.env.USERPROFILE || "", "BeamAgent", "resources", "app", "lib", "main.js"),
].filter((p) => fs.existsSync(p));

const BOOTS = [
	path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-app-boot", "lib", "index.js"),
	path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-app-boot", "lib", "index.js"),
	path.join(process.env.USERPROFILE || "", "BeamAgent", "resources", "app", "beam", "node_modules", "@assistix", "beam-app-boot", "lib", "index.js"),
].filter((p) => fs.existsSync(p));

const INIT_OLD = `\t\t\tbeam: { profile: { bundles: [...bundles] } }`;
const INIT_NEW = `\t\t\tdsh: { profile: { bundles: [...bundles] } },
\t\t\tbeam: { profile: { bundles: [...bundles] } } /* BEAM_DSH_PROFILE_BUNDLES */`;

const WRITE_OLD = `function writeProfileBundles(profileDir, manifest, bundles) {
	const updated = {
		...manifest,
		beam: {
			...manifest.dsh,
			profile: {
				...manifest.dsh?.profile,
				bundles: [...bundles]
			}
		}
	};
	writeProfileManifest(profileDir, updated);
	return updated;
}`;

const WRITE_NEW = `function writeProfileBundles(profileDir, manifest, bundles) {
	/* BEAM_DSH_PROFILE_BUNDLES: loader reads dsh.profile.bundles; keep beam in sync */
	const profile = {
		...(manifest.dsh?.profile ?? manifest.beam?.profile),
		bundles: [...bundles]
	};
	const updated = {
		...manifest,
		dsh: {
			...manifest.dsh,
			profile
		},
		beam: {
			...manifest.beam,
			profile
		}
	};
	writeProfileManifest(profileDir, updated);
	return updated;
}`;

const LOAD_OLD = `const bundles = dropRetiredBundles(dir, readProfileManifest(binName, dir)).dsh?.profile?.bundles ?? [];`;
const LOAD_NEW = `const _manifest = dropRetiredBundles(dir, readProfileManifest(binName, dir));
	const bundles = _manifest.dsh?.profile?.bundles ?? _manifest.beam?.profile?.bundles ?? []; /* BEAM_DSH_PROFILE_BUNDLES */`;

/* Also heal dropRetiredBundles / withBundles consumers that only see dsh */
const DROP_OLD = `function dropRetiredBundles(dir, manifest) {
	const bundles = manifest.dsh?.profile?.bundles ?? [];
	const kept = bundles.filter((bundle) => !RETIRED_BUNDLES.has(bundle));
	if (kept.length === bundles.length) return manifest;
	const normalized = withBundles(manifest, kept);
	writeProfileManifest(dir, normalized);
	return normalized;
}`;
const DROP_NEW = `function dropRetiredBundles(dir, manifest) {
	const bundles = manifest.dsh?.profile?.bundles ?? manifest.beam?.profile?.bundles ?? []; /* BEAM_DSH_PROFILE_BUNDLES */
	const kept = bundles.filter((bundle) => !RETIRED_BUNDLES.has(bundle));
	if (kept.length === bundles.length) {
		/* ensure dsh key exists when only beam was written by rebranded shell */
		if ((manifest.dsh?.profile?.bundles?.length ?? 0) === 0 && (manifest.beam?.profile?.bundles?.length ?? 0) > 0) {
			const healed = withBundles(manifest, bundles);
			writeProfileManifest(dir, healed);
			return healed;
		}
		return manifest;
	}
	const normalized = withBundles(manifest, kept);
	writeProfileManifest(dir, normalized);
	return normalized;
}`;

const WITH_OLD = `function withBundles(manifest, bundles) {
	return {
		...manifest,
		dsh: {
			...manifest.dsh,
			profile: {
				...manifest.dsh?.profile,
				bundles: [...bundles]
			}
		}
	};
}`;
const WITH_NEW = `function withBundles(manifest, bundles) {
	/* BEAM_DSH_PROFILE_BUNDLES: keep dsh + beam in sync */
	const profile = {
		...(manifest.dsh?.profile ?? manifest.beam?.profile),
		bundles: [...bundles]
	};
	return {
		...manifest,
		dsh: {
			...manifest.dsh,
			profile
		},
		beam: {
			...manifest.beam,
			profile
		}
	};
}`;

let n = 0;
for (const file of MAINS) {
	let s = fs.readFileSync(file, "utf8");
	let changed = false;
	if (s.includes("BEAM_DSH_PROFILE_BUNDLES") && s.includes("dsh: { profile: { bundles: [...bundles] } }")) {
		console.log("main already fixed", path.relative(ROOT, file));
	} else {
		if (s.includes(INIT_OLD) && !s.includes(INIT_NEW)) {
			s = s.split(INIT_OLD).join(INIT_NEW);
			changed = true;
			console.log("initProfile", path.relative(ROOT, file));
		} else if (!s.includes("dsh: { profile: { bundles: [...bundles] } }")) {
			console.warn("miss initProfile", path.relative(ROOT, file));
		}
		if (s.includes(WRITE_OLD)) {
			s = s.split(WRITE_OLD).join(WRITE_NEW);
			changed = true;
			console.log("writeProfileBundles", path.relative(ROOT, file));
		} else if (!s.includes("BEAM_DSH_PROFILE_BUNDLES: loader reads dsh.profile.bundles")) {
			console.warn("miss writeProfileBundles", path.relative(ROOT, file));
		}
	}
	if (changed) {
		fs.writeFileSync(file, s);
		n++;
	}
}

for (const file of BOOTS) {
	let s = fs.readFileSync(file, "utf8");
	let changed = false;
	if (s.includes("BEAM_DSH_PROFILE_BUNDLES") && s.includes("_manifest.beam?.profile?.bundles")) {
		console.log("boot already fixed", path.relative(ROOT, file));
	} else {
		if (s.includes(LOAD_OLD)) {
			s = s.split(LOAD_OLD).join(LOAD_NEW);
			changed = true;
			console.log("loadProfileDirectory", path.relative(ROOT, file));
		} else if (!s.includes("_manifest.beam?.profile?.bundles")) {
			console.warn("miss loadProfileDirectory", path.relative(ROOT, file));
		}
		if (s.includes(DROP_OLD)) {
			s = s.split(DROP_OLD).join(DROP_NEW);
			changed = true;
			console.log("dropRetiredBundles", path.relative(ROOT, file));
		} else if (!s.includes("ensure dsh key exists when only beam")) {
			console.warn("miss dropRetiredBundles", path.relative(ROOT, file));
		}
		if (s.includes(WITH_OLD)) {
			s = s.split(WITH_OLD).join(WITH_NEW);
			changed = true;
			console.log("withBundles", path.relative(ROOT, file));
		} else if (!s.includes("keep dsh + beam in sync")) {
			console.warn("miss withBundles", path.relative(ROOT, file));
		}
		/* also heal boot initProfile if it only writes dsh (keep beam twin) */
		const bootInit = `\t\t\tdsh: { profile: { bundles: [...bundles] } }`;
		const bootInitDual = `\t\t\tdsh: { profile: { bundles: [...bundles] } },
\t\t\tbeam: { profile: { bundles: [...bundles] } } /* BEAM_DSH_PROFILE_BUNDLES */`;
		if (s.includes(bootInit) && !s.includes("beam: { profile: { bundles: [...bundles] } } /* BEAM_DSH_PROFILE_BUNDLES */")) {
			s = s.replace(bootInit, bootInitDual);
			changed = true;
			console.log("boot initProfile dual", path.relative(ROOT, file));
		}
	}
	if (changed) {
		fs.writeFileSync(file, s);
		n++;
	}
}

/* Heal live profiles under ~/.beam/profiles */
const profilesRoot = path.join(process.env.USERPROFILE || "", ".beam", "profiles");
if (fs.existsSync(profilesRoot)) {
	for (const name of fs.readdirSync(profilesRoot)) {
		const pj = path.join(profilesRoot, name, "package.json");
		if (!fs.existsSync(pj)) continue;
		const j = JSON.parse(fs.readFileSync(pj, "utf8"));
		const bundles = j.dsh?.profile?.bundles ?? j.beam?.profile?.bundles;
		if (!Array.isArray(bundles) || bundles.length === 0) {
			const healed = ["@assistix/beam-base", "@assistix/beam-web-app"];
			j.dsh = { ...(j.dsh || {}), profile: { ...(j.dsh?.profile || {}), bundles: healed } };
			j.beam = { ...(j.beam || {}), profile: { ...(j.beam?.profile || {}), bundles: healed } };
			fs.writeFileSync(pj, JSON.stringify(j, null, 2) + "\n");
			console.log("healed empty profile", name, "→", healed);
			n++;
			continue;
		}
		let changed = false;
		if (!j.dsh?.profile?.bundles) {
			j.dsh = { ...(j.dsh || {}), profile: { ...(j.dsh?.profile || {}), bundles: [...bundles] } };
			changed = true;
		}
		if (!j.beam?.profile?.bundles) {
			j.beam = { ...(j.beam || {}), profile: { ...(j.beam?.profile || {}), bundles: [...bundles] } };
			changed = true;
		}
		if (changed) {
			fs.writeFileSync(pj, JSON.stringify(j, null, 2) + "\n");
			console.log("synced profile keys", name);
			n++;
		} else {
			console.log("profile ok", name, bundles);
		}
	}
}

/* Ensure package dsh.bundle on beam-base / beam-web-app in every tree */
for (const tree of [
	path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix"),
	path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix"),
	path.join(process.env.USERPROFILE || "", "BeamAgent", "resources", "app", "beam", "node_modules", "@assistix"),
]) {
	if (!fs.existsSync(tree)) continue;
	for (const pkg of ["beam-base", "beam-web-app"]) {
		const pj = path.join(tree, pkg, "package.json");
		if (!fs.existsSync(pj)) continue;
		const j = JSON.parse(fs.readFileSync(pj, "utf8"));
		j.dsh ??= {};
		let changed = false;
		if (j.beam?.bundle && !j.dsh.bundle) {
			j.dsh.bundle = j.beam.bundle;
			changed = true;
		}
		if (changed) {
			fs.writeFileSync(pj, JSON.stringify(j, null, 2) + "\n");
			console.log("restored dsh.bundle", path.relative(ROOT, pj));
			n++;
		}
	}
}

console.log("done changes", n);
