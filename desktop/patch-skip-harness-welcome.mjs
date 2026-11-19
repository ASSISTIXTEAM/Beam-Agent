/**
 * Kill the Electron Harness welcome window (Sign in / Add API Key) and scrub
 * DeepSeek branding from welcome preload/locales. Beam auth is the ASSISTIX
 * gate inside dsh-web-frontend index.html — never this native welcome.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_ROOTS = [
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
  path.join(ROOT, "runtime", "app"),
].filter((p) => fs.existsSync(p));

const STRING_REPLACEMENTS = [
  [/DeepSeek Harness/g, "Beam Agent"],
  [/DeepSeek Account/g, "ASSISTIX ID"],
  [/Configure official DeepSeek models to start using Harness/g, "Sign in with ASSISTIX ID to start Beam Agent"],
  [/配置 DeepSeek 官方模型，即可开始使用/g, "使用 ASSISTIX ID 登录以开始使用 Beam Agent"],
  [/Build potential\. Explore intelligence\./g, "ASSISTIX · Beam Agent"],
  [/组装无限可能，共探智能上限/g, "ASSISTIX · Beam Agent"],
  [/welcomeApiKey: "Add API Key"/g, 'welcomeApiKey: "Continue"'],
  [/welcomeApiKey: "添加 API Key"/g, 'welcomeApiKey: "继续"'],
  [/welcomeSignIn: "Sign in"/g, 'welcomeSignIn: "Войти через ASSISTIX ID"'],
  [/welcomeKeyTitle: "Add an API key to get started"/g, 'welcomeKeyTitle: "Sign in with ASSISTIX ID"'],
  [/welcomeKeyTitle: "添加 API Key 即可开始"/g, 'welcomeKeyTitle: "使用 ASSISTIX ID 登录"'],
  [/Another DSH instance \(such as dsh web or the desktop app\) is running\. They cannot start at the same time\. Quit the other running DSH instance, then restart\./g, "Another Beam Agent instance is already running. Quit the other window, then restart."],
  [/Sign in with Feishu/g, "Sign in with ASSISTIX ID"],
  [/Feishu/g, "ASSISTIX ID"],
];

function scrubFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let s = fs.readFileSync(filePath, "utf8");
  const before = s;
  for (const [re, to] of STRING_REPLACEMENTS) s = s.replace(re, to);
  // Soft remaining product mentions in welcome/about copy (keep package paths)
  s = s.replace(/(?<![-/@])\bDeepSeek\b(?![-/])/g, "ASSISTIX");
  if (s !== before) {
    fs.writeFileSync(filePath, s);
    return true;
  }
  return false;
}

function forceSkipWelcome(mainPath) {
  if (!fs.existsSync(mainPath)) return false;
  let s = fs.readFileSync(mainPath, "utf8");
  const before = s;

  // Always skip native Harness welcome → workspace (ASSISTIX gate) instead
  const needle = `function needsWelcome(authentication) {
	return !authentication.loggedIn && !authentication.hasApiKey;
}`;
  const replacement = `function needsWelcome(authentication) {
	return false; // Beam: never show Harness Sign in / Add API Key; ASSISTIX gate is in web UI
}`;
  if (s.includes(needle)) {
    s = s.replace(needle, replacement);
  } else if (!s.includes("Beam: never show Harness")) {
    // Already patched or differently formatted — try loose match
    s = s.replace(
      /function needsWelcome\(authentication\)\s*\{\s*return !authentication\.loggedIn && !authentication\.hasApiKey;\s*\}/,
      replacement
    );
  }

  for (const [re, to] of STRING_REPLACEMENTS) s = s.replace(re, to);

  if (s !== before) {
    fs.writeFileSync(mainPath, s);
    return true;
  }
  return s.includes("Beam: never show Harness");
}

let changed = 0;
for (const app of APP_ROOTS) {
  const label = path.relative(ROOT, app);
  const mainJs = path.join(app, "lib", "main.js");
  if (forceSkipWelcome(mainJs)) {
    console.log("skip-welcome", label + "/lib/main.js");
    changed++;
  } else {
    console.log("main unchanged/missing", label);
  }

  for (const rel of ["lib/preload-welcome.cjs", "lib/preload-app.cjs"]) {
    const p = path.join(app, rel);
    if (scrubFile(p)) {
      console.log("scrubbed", label + "/" + rel);
      changed++;
    } else if (fs.existsSync(p)) {
      console.log("no string change", label + "/" + rel);
    }
  }
}

console.log(changed ? `✓ skipped Harness welcome (${changed} files)` : "✓ already applied");
