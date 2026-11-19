/**
 * ROOT CAUSE FIX: runtimeResources() was rebranded to return `beam`, but main.js
 * still uses resources.dsh for Desktop Host, static frontend serve, and mandatory
 * update policy. That yields undefined → TypeError on join → host never starts →
 * eternal Beam splash.
 *
 * Also fail-open the early splash watchdog so UI can appear even if host is slow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAINS = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "lib", "main.js"),
];
const HTMLS = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-web-frontend", "dist", "index.html"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist", "index.html"),
];

const OLD_RESOURCES = `function runtimeResources() {
	const development = !app.isPackaged;
	return {
		node: process.execPath,
		nodeBin: development ? join(app.getAppPath(), "scripts", "node-bin") : join(process.resourcesPath, "runtime", "bin"),
		pnpm: (development ? process.env.DSH_DESKTOP_PNPM_ENTRY : void 0) ?? (development ? join(app.getAppPath(), "node_modules", "pnpm", "bin", "pnpm.mjs") : join(process.resourcesPath, "runtime", "primary-runtime", "dependencies", "pnpm", "bin", "pnpm.mjs")),
		beam: (development ? process.env.DSH_DESKTOP_DSH_DIR : void 0) ?? (development ? join(app.getAppPath(), ".desktop-build", "development", "project") : join(app.getAppPath(), "beam"))
	};
}`;

const NEW_RESOURCES = `function runtimeResources() {
	const development = !app.isPackaged;
	/* BEAM_DSH_ALIAS: keep both keys — consumers still read resources.dsh */
	const beamDir = (development ? process.env.DSH_DESKTOP_DSH_DIR : void 0) ?? (development ? join(app.getAppPath(), ".desktop-build", "development", "project") : join(app.getAppPath(), "beam"));
	return {
		node: process.execPath,
		nodeBin: development ? join(app.getAppPath(), "scripts", "node-bin") : join(process.resourcesPath, "runtime", "bin"),
		pnpm: (development ? process.env.DSH_DESKTOP_PNPM_ENTRY : void 0) ?? (development ? join(app.getAppPath(), "node_modules", "pnpm", "bin", "pnpm.mjs") : join(process.resourcesPath, "runtime", "primary-runtime", "dependencies", "pnpm", "bin", "pnpm.mjs")),
		beam: beamDir,
		dsh: beamDir
	};
}`;

const OLD_POLICY_VERSION = `bundledDshVersion: app.isPackaged ? readDesktopRuntime(resources.dsh).release.version : app.getVersion()`;
const NEW_POLICY_VERSION = `bundledDshVersion: app.isPackaged ? readDesktopRuntime(resources.dsh || resources.beam).release.version : app.getVersion() /* BEAM_DSH_ALIAS */`;

const OLD_CAP_BLOCK = `      if (age >= CAP_MS && bootOnly()) {
        // Cap eternal splash: ask desktop once, then stop feeling infinite
        if (!window.__beamBootCapFired) {
          window.__beamBootCapFired = true;
          console.warn("beam-splash: boot cap", age);
          try {
            const desk = globalThis.dshDesktopBoot;
            if (desk && typeof desk.failed === "function") {
              desk.failed("web boot: splash timeout").catch(() => {});
            }
          } catch {}
        }
      }`;

const NEW_CAP_BLOCK = `      if (age >= CAP_MS) {
        // BEAM_SPLASH_FAILOPEN: always clear early splash; never block main UI forever
        if (!window.__beamBootCapFired) {
          window.__beamBootCapFired = true;
          console.warn("beam-splash: boot cap fail-open", age);
          hideEarly();
          try {
            for (const el of document.querySelectorAll("#root > [data-dsh-boot], #root > [data-beam-boot]")) {
              el.setAttribute("hidden", "");
              el.hidden = true;
            }
          } catch {}
          try {
            const desk = globalThis.dshDesktopBoot;
            if (bootOnly() && desk && typeof desk.failed === "function") {
              desk.failed("web boot: splash timeout").catch(() => {});
            }
          } catch {}
        } else {
          hideEarly();
        }
      }`;

let n = 0;
for (const file of MAINS) {
  if (!fs.existsSync(file)) {
    console.warn("missing", path.relative(ROOT, file));
    continue;
  }
  let s = fs.readFileSync(file, "utf8");
  let changed = false;
  if (s.includes("BEAM_DSH_ALIAS") && s.includes("dsh: beamDir")) {
    console.log("main already aliased", path.relative(ROOT, file));
  } else if (s.includes(OLD_RESOURCES)) {
    s = s.split(OLD_RESOURCES).join(NEW_RESOURCES);
    changed = true;
    console.log("resources alias", path.relative(ROOT, file));
  } else if (s.includes("beam: (development ? process.env.DSH_DESKTOP_DSH_DIR")) {
    // Fallback: insert dsh next to beam line
    s = s.replace(
      /beam: (\(development \? process\.env\.DSH_DESKTOP_DSH_DIR[\s\S]*?join\(app\.getAppPath\(\), "beam"\)\))/,
      "beam: $1,\n\t\tdsh: $1 /* BEAM_DSH_ALIAS */",
    );
    if (s.includes("BEAM_DSH_ALIAS")) {
      changed = true;
      console.log("resources alias (fallback)", path.relative(ROOT, file));
    } else {
      console.warn("miss resources pattern", path.relative(ROOT, file));
    }
  } else {
    console.warn("miss resources block", path.relative(ROOT, file));
  }

  if (s.includes(OLD_POLICY_VERSION)) {
    s = s.split(OLD_POLICY_VERSION).join(NEW_POLICY_VERSION);
    changed = true;
    console.log("policy version guard", path.relative(ROOT, file));
  } else if (!s.includes("resources.dsh || resources.beam")) {
    console.warn("miss policy version", path.relative(ROOT, file));
  }

  if (changed) {
    fs.writeFileSync(file, s);
    n++;
  }
}

for (const file of HTMLS) {
  if (!fs.existsSync(file)) {
    console.warn("missing html", path.relative(ROOT, file));
    continue;
  }
  let s = fs.readFileSync(file, "utf8");
  if (s.includes("BEAM_SPLASH_FAILOPEN")) {
    console.log("splash already fail-open", path.relative(ROOT, file));
    continue;
  }
  if (!s.includes(OLD_CAP_BLOCK)) {
    console.warn("miss splash cap", path.relative(ROOT, file));
    continue;
  }
  s = s.split(OLD_CAP_BLOCK).join(NEW_CAP_BLOCK);
  fs.writeFileSync(file, s);
  console.log("splash fail-open", path.relative(ROOT, file));
  n++;
}

console.log("done changes", n);
