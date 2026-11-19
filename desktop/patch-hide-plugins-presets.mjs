/**
 * Hide Built-in plugins + Agent presets from Settings.
 * Plugins stay loaded system-side; no user chrome for managing them.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const DSH = path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai");
const WEB = path.join(DSH, "dsh-web-frontend/dist");
const ASSETS = path.join(WEB, "assets");

function disableSectionRegister(file, needle) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes(needle)) {
    console.log("  skip (needle missing)", path.basename(path.dirname(path.dirname(file))));
    return;
  }
  // Already disabled?
  if (s.includes(`/* beam-hide-settings ${needle}`) || s.includes(`// beam-hide: ${needle}`)) {
    console.log("  already hidden", needle);
    return;
  }

  // Replace ctx.slots.inject("settings.section", ...) that contains the id
  const re = new RegExp(
    String.raw`ctx\.slots\.inject\("settings\.section",\s*\(\)\s*=>\s*ctx\.slots\.register\(\{[\s\S]*?id:\s*"${needle}"[\s\S]*?\},[^\)]+\)\);`,
    "m"
  );
  if (!re.test(s)) {
    // try looser: find id line and wrap nearby inject call
    const idIdx = s.indexOf(`id: "${needle}"`);
    if (idIdx < 0) throw new Error("id not found " + needle);
    const injectStart = s.lastIndexOf('ctx.slots.inject("settings.section"', idIdx);
    if (injectStart < 0) throw new Error("inject not found for " + needle);
    // find matching end: from injectStart, find `}, Component));` pattern
    let i = injectStart;
    let depth = 0;
    let started = false;
    let end = -1;
    for (; i < s.length; i++) {
      if (s[i] === "(") {
        depth++;
        started = true;
      } else if (s[i] === ")") {
        depth--;
        if (started && depth === 0) {
          // include trailing );
          end = i + 1;
          if (s[end] === ";") end++;
          break;
        }
      }
    }
    if (end < 0) throw new Error("end not found " + needle);
    const block = s.slice(injectStart, end);
    s =
      s.slice(0, injectStart) +
      `/* beam-hide-settings ${needle} */ void 0; /* was: settings.section ${needle} */` +
      s.slice(end);
    fs.writeFileSync(file, s);
    console.log("  disabled", needle, "(brace walk)", block.length, "chars");
    return;
  }

  s = s.replace(
    re,
    `/* beam-hide-settings ${needle} */ void 0;`
  );
  fs.writeFileSync(file, s);
  console.log("  disabled", needle);
}

console.log("1) Disable settings sections");
disableSectionRegister(
  path.join(DSH, "dsh-client-ui-settings-plugins/lib/client.js"),
  "plugins"
);
disableSectionRegister(
  path.join(DSH, "dsh-client-ui-agent-preset/lib/client.js"),
  "agent-presets"
);

// Also hide plugin-manager panel title if it registers a top-level section
{
  const p = path.join(DSH, "dsh-client-ui-plugin-manager/lib/client.js");
  if (fs.existsSync(p)) {
    let s = fs.readFileSync(p, "utf8");
    if (s.includes('ctx.slots.inject("settings.section"') && !s.includes("beam-hide-settings plugins-mgr")) {
      // plugin manager usually goes under plugins tabs, not top nav — leave host plugins running
      console.log("  plugin-manager: no top-level settings.section (ok)");
    }
  }
}

console.log("2) CSS + injector backup hide");
{
  const cssPath = path.join(ASSETS, "beam-override.css");
  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(/\/\* ===== BEAM hide plugins\/presets ===== \*\/[\s\S]*$/g, "");
  css += `
/* ===== BEAM hide plugins/presets ===== */
/* Nav rows whose label is plugins / agent presets — defensive if slot still mounts */
[data-settings-nav="plugins"],
[data-settings-nav="agent-presets"],
[data-section-id="plugins"],
[data-section-id="agent-presets"] {
  display: none !important;
}
`;
  fs.writeFileSync(cssPath, css);

  const htmlPath = path.join(WEB, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  // Remove prior hidePlugins block
  html = html.replace(/\n\s*\/\/ #region beam-hide-plugins[\s\S]*?\/\/ #endregion beam-hide-plugins\n/g, "\n");

  const snippet = `
  // #region beam-hide-plugins
  const hidePluginChrome = (root) => {
    if (!root?.querySelectorAll) return;
    const kill = /^(Built-in plugins|Встроенные плагины|Agent presets|Пресеты агента|Plugins|Плагины|Plugin market|Маркет плагинов)$/i;
    for (const el of root.querySelectorAll("button, a, [role='tab'], [role='button'], li, div")) {
      const tx = (el.childNodes.length && [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("") || el.innerText || "").trim();
      const label = tx.split("\\n")[0].trim();
      if (!kill.test(label)) continue;
      // Only hide settings nav / tab chrome, not chat content
      const inSettings = el.closest("[class*='settings'], [class*='Settings'], [role='dialog'], aside, nav");
      if (!inSettings) continue;
      const row = el.closest("button, [role='tab'], li, [class*='nav'], [class*='item'], [class*='row']") || el;
      row.style.display = "none";
    }
  };
  // #endregion beam-hide-plugins
`;

  if (!html.includes("hidePluginChrome")) {
    // insert before `const run = () => {`
    if (html.includes("const run = () => {")) {
      html = html.replace("const run = () => {", snippet + "\n  const run = () => {");
      html = html.replace(
        "hideCustomChrome(root);",
        "hideCustomChrome(root);\n      hidePluginChrome(root);"
      );
    }
  }
  fs.writeFileSync(htmlPath, html);
  console.log("  injector/css backup ok");
}

// syntax check
for (const rel of [
  "dsh-client-ui-settings-plugins/lib/client.js",
  "dsh-client-ui-agent-preset/lib/client.js",
]) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, ["--check", path.join(DSH, rel)], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  console.log("  syntax ok", rel);
}

console.log("✓ plugins + agent presets hidden from Settings");
