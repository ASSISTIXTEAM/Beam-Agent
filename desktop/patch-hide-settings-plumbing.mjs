/**
 * Kill Settings «Лимиты» / API plumbing UI for end users.
 *
 * - Hide nav: models (Лимиты), agent-presets, account, plugins
 * - Hide header action: Open configuration file
 * - Keep Общие (general) only
 * - Does NOT touch ASSISTIX ID login or sidebar Tide/Flare/Pine rings
 *
 * Applies to both runtime + dist @assistix trees.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const TREES = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix"),
];

function disableSettingsSection(clientPath, sectionId) {
  if (!fs.existsSync(clientPath)) {
    console.log("  miss", clientPath);
    return false;
  }
  let s = fs.readFileSync(clientPath, "utf8");
  const marker = `/* beam-hide-settings ${sectionId} */`;
  if (s.includes(marker)) {
    console.log("  already", sectionId, path.basename(path.dirname(path.dirname(clientPath))));
    return true;
  }

  const idNeedle = `id: "${sectionId}"`;
  const idIdx = s.indexOf(idNeedle);
  if (idIdx < 0) {
    console.log("  no id", sectionId, path.basename(path.dirname(path.dirname(clientPath))));
    return false;
  }

  const injectStart = s.lastIndexOf('ctx.slots.inject("settings.section"', idIdx);
  if (injectStart < 0) {
    throw new Error(`inject not found for ${sectionId} in ${clientPath}`);
  }

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
        end = i + 1;
        if (s[end] === ";") end++;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`end not found for ${sectionId}`);

  s =
    s.slice(0, injectStart) +
    `${marker} void 0; /* was: settings.section ${sectionId} */` +
    s.slice(end);
  fs.writeFileSync(clientPath, s);
  console.log("  disabled section", sectionId, "→", path.relative(ROOT, clientPath));
  return true;
}

function disableOpenDocumentAction(clientPath) {
  if (!fs.existsSync(clientPath)) return false;
  let s = fs.readFileSync(clientPath, "utf8");
  const marker = "/* beam-hide-settings open-document */";
  if (s.includes(marker)) {
    console.log("  already open-document");
    return true;
  }

  const idNeedle = 'id: "open-document"';
  const idIdx = s.indexOf(idNeedle);
  if (idIdx < 0) {
    console.log("  no open-document id");
    return false;
  }

  // Prefer wrapping the whole `if (documentInjected !== void 0) ctx.slots.inject("settings.action"...`
  const ifStart = s.lastIndexOf("if (documentInjected !== void 0)", idIdx);
  const injectStart =
    ifStart >= 0 ? ifStart : s.lastIndexOf('ctx.slots.inject("settings.action"', idIdx);
  if (injectStart < 0) throw new Error("open-document inject not found");

  let i = injectStart;
  // if we started at `if`, walk to the inject's closing
  if (s.startsWith("if (", injectStart)) {
    // find the inject call after if
    const inj = s.indexOf('ctx.slots.inject("settings.action"', injectStart);
    if (inj < 0) throw new Error("settings.action inject missing");
    let depth = 0;
    let started = false;
    let end = -1;
    for (let j = inj; j < s.length; j++) {
      if (s[j] === "(") {
        depth++;
        started = true;
      } else if (s[j] === ")") {
        depth--;
        if (started && depth === 0) {
          end = j + 1;
          if (s[end] === ";") end++;
          break;
        }
      }
    }
    if (end < 0) throw new Error("open-document end not found");
    s =
      s.slice(0, injectStart) +
      `${marker} void 0; /* was: settings.action open-document */` +
      s.slice(end);
  } else {
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
          end = i + 1;
          if (s[end] === ";") end++;
          break;
        }
      }
    }
    if (end < 0) throw new Error("open-document end not found");
    s =
      s.slice(0, injectStart) +
      `${marker} void 0; /* was: settings.action open-document */` +
      s.slice(end);
  }

  fs.writeFileSync(clientPath, s);
  console.log("  disabled open-document →", path.relative(ROOT, clientPath));
  return true;
}

/** Soften leftover teaching copy (page is hidden; belt-and-suspenders). */
function scrubModelsCopy(clientPath) {
  if (!fs.existsSync(clientPath)) return;
  let s = fs.readFileSync(clientPath, "utf8");
  const pairs = [
    [
      'intro: "Enter your API keys to use models from the following providers."',
      'intro: "Weekly usage for Tide, Flare, and Pine."',
    ],
    [
      'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
      'intro: "Weekly usage for Tide, Flare, and Pine."',
    ],
    [
      '"intro": "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."',
      '"intro": "Недельные лимиты Tide, Flare и Pine."',
    ],
    [
      'intro: "填入各提供商的 API 密钥即可使用其模型。"',
      'intro: "Tide、Flare、Pine 的每周用量。"',
    ],
    [
      'onboardingTitle: "Add an API key to get started"',
      'onboardingTitle: "Continue with Beam Agent"',
    ],
    [
      'credentialConfigured: "API key configured"',
      'credentialConfigured: "Connected"',
    ],
    [
      'credentialMissing: "API key missing"',
      'credentialMissing: "Not connected"',
    ],
    [
      'addCatalogHint: "Pick OpenAI, Anthropic, Kimi, or another provider from the built-in catalog and enter its API key."',
      'addCatalogHint: "Models are provided by Beam Agent."',
    ],
    [
      'deleteDescriptionWithCredential: "Deleting {provider} removes its configuration and stored API key."',
      'deleteDescriptionWithCredential: "Deleting {provider} removes its configuration."',
    ],
    ['keyPlaceholder: "Enter your API key"', 'keyPlaceholder: ""'],
    [
      'keyFallbackMissing: "Env var not detected. Enter an API key, or configure {hint} in your env."',
      'keyFallbackMissing: "Not available."',
    ],
    [
      'keyBlank: "Enter the API key, or leave the field empty to keep the stored one."',
      'keyBlank: ""',
    ],
    [
      'keyBlankNew: "Enter the API key, or leave the field empty if this provider authenticates another way."',
      'keyBlankNew: ""',
    ],
    [
      'keyIllegalCharacters: "This API key is not in a valid format. Please check it."',
      'keyIllegalCharacters: "Invalid value."',
    ],
    ['keyRequired: "Enter an API key to continue."', 'keyRequired: "Continue."'],
  ];
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n++;
    }
  }
  if (n) {
    fs.writeFileSync(clientPath, s);
    console.log("  scrubbed models copy", n, "→", path.relative(ROOT, clientPath));
  }
}

function scrubAccountCopy(clientPath) {
  if (!fs.existsSync(clientPath)) return;
  let s = fs.readFileSync(clientPath, "utf8");
  const pairs = [
    [
      'loginDescription: "Sign in to your ASSISTIX account or add an API Key to get started. Your projects and files are stored locally."',
      'loginDescription: "Sign in with ASSISTIX ID to continue. Your projects and files are stored locally."',
    ],
    [
      '"loginDescription": "Войти to your ASSISTIX account or add an API Key to get started. Your projects and files are stored locally."',
      '"loginDescription": "Войдите через ASSISTIX ID. Проекты и файлы хранятся локально."',
    ],
    [
      'settingsSignedOutDescription: "Sign in to Beam Agent to get your dedicated API Key"',
      'settingsSignedOutDescription: "Sign in to Beam Agent to continue"',
    ],
    [
      '"settingsSignedOutDescription": "Войти to Beam Agent to get your dedicated API Key"',
      '"settingsSignedOutDescription": "Войдите в Beam Agent, чтобы продолжить"',
    ],
    ['addApiKey: "Add API Key"', 'addApiKey: "Continue"'],
    ['"addApiKey": "Add API Key"', '"addApiKey": "Continue"'],
  ];
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n++;
    }
  }
  if (n) {
    fs.writeFileSync(clientPath, s);
    console.log("  scrubbed account copy", n, "→", path.relative(ROOT, clientPath));
  }
}

function patchChrome(assistixRoot) {
  const web = path.join(assistixRoot, "beam-web-frontend/dist");
  const cssPath = path.join(web, "assets/beam-override.css");
  const htmlPath = path.join(web, "index.html");
  if (!fs.existsSync(cssPath) || !fs.existsSync(htmlPath)) {
    console.log("  skip chrome (no web frontend)", path.relative(ROOT, assistixRoot));
    return;
  }

  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(/\/\* ===== BEAM hide settings plumbing ===== \*\/[\s\S]*?(?=\/\* =====|$)/g, "");
  css += `
/* ===== BEAM hide settings plumbing ===== */
[data-settings-nav="models"],
[data-settings-nav="limits"],
[data-settings-nav="agent-presets"],
[data-settings-nav="account"],
[data-settings-nav="plugins"],
[data-section-id="models"],
[data-section-id="limits"],
[data-section-id="agent-presets"],
[data-section-id="account"],
[data-section-id="plugins"],
[data-settings-action="open-document"] {
  display: none !important;
}
`;
  fs.writeFileSync(cssPath, css);

  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(/\n\s*\/\/ #region beam-hide-settings-plumbing[\s\S]*?\/\/ #endregion beam-hide-settings-plumbing\n/g, "\n");

  const snippet = `
  // #region beam-hide-settings-plumbing
  const hideSettingsPlumbing = (root) => {
    if (!root?.querySelectorAll) return;
    const killNav = /^(Limits|Лимиты|Models|Модели|Agent presets|Пресеты агента|Account|Аккаунт|Built-in plugins|Встроенные плагины|Plugins|Плагины)$/i;
    const killBtn = /^(Open configuration file|Открыть файл конфигурации|打开配置文件)$/i;
    for (const el of root.querySelectorAll("button, a, [role='tab'], [role='button'], li")) {
      const textNodes = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
      const label = (textNodes || el.innerText || "").trim().split("\\n")[0].trim();
      if (!label) continue;
      const inSettings = el.closest("[class*='settings'], [class*='Settings'], [role='dialog'], aside, nav");
      if (!inSettings) continue;
      if (killBtn.test(label) || killNav.test(label)) {
        const row = el.closest("button, [role='tab'], li, [class*='nav'], [class*='item'], [class*='row'], [class*='action']") || el;
        row.style.display = "none";
      }
    }
    // Also hide injected limits exposé panel if present
    document.getElementById("beam-limits-panel")?.remove();
  };
  // #endregion beam-hide-settings-plumbing
`;

  if (!html.includes("hideSettingsPlumbing")) {
    if (html.includes("const run = () => {")) {
      html = html.replace("const run = () => {", snippet + "\n  const run = () => {");
      if (html.includes("hideCustomChrome(root);")) {
        html = html.replace(
          "hideCustomChrome(root);",
          "hideCustomChrome(root);\n      hideSettingsPlumbing(root);"
        );
      } else if (html.includes("hidePluginChrome(root);")) {
        html = html.replace(
          "hidePluginChrome(root);",
          "hidePluginChrome(root);\n      hideSettingsPlumbing(root);"
        );
      } else {
        // append call near start of run
        html = html.replace(
          "const run = () => {",
          "const run = () => {\n    try { hideSettingsPlumbing(document); } catch (_) {}"
        );
      }
    } else {
      // fallback: inject before </body>
      html = html.replace(
        "</body>",
        `<script>${snippet}\ntry{hideSettingsPlumbing(document); new MutationObserver(()=>hideSettingsPlumbing(document)).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}</script></body>`
      );
    }
  }

  // Stop teaching "Open configuration file" via RU rewrite table if present
  html = html.replace(
    '[/^Open configuration file$/g, "Открыть файл конфигурации"],',
    '[/^Open configuration file$/g, ""],'
  );

  fs.writeFileSync(htmlPath, html);
  console.log("  chrome patched →", path.relative(ROOT, web));
}

function syntaxCheck(file) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error("syntax fail " + file);
  }
}

for (const tree of TREES) {
  if (!fs.existsSync(tree)) {
    console.log("skip missing tree", tree);
    continue;
  }
  console.log("\n===", path.relative(ROOT, tree), "===");

  disableSettingsSection(
    path.join(tree, "beam-client-ui-settings-models/lib/client.js"),
    "models"
  );
  disableSettingsSection(
    path.join(tree, "beam-client-ui-agent-preset/lib/client.js"),
    "agent-presets"
  );
  disableSettingsSection(
    path.join(tree, "beam-client-ui-settings-account/lib/client.js"),
    "account"
  );
  disableSettingsSection(
    path.join(tree, "beam-client-ui-settings-plugins/lib/client.js"),
    "plugins"
  );
  disableOpenDocumentAction(
    path.join(tree, "beam-client-ui-settings-general/lib/client.js")
  );

  scrubModelsCopy(path.join(tree, "beam-client-ui-settings-models/lib/client.js"));
  scrubAccountCopy(path.join(tree, "beam-client-ui-settings-account/lib/client.js"));
  {
    const gen = path.join(tree, "beam-client-ui-settings-general/lib/client.js");
    if (fs.existsSync(gen)) {
      let s = fs.readFileSync(gen, "utf8");
      const gPairs = [
        ['"openDocument": "Open configuration file"', '"openDocument": ""'],
        ['"openDocument": "Открыть файл конфигурации"', '"openDocument": ""'],
        ['"openDocument": "打开配置文件"', '"openDocument": ""'],
        ['"openDocument.error": "Could not open configuration file"', '"openDocument.error": ""'],
        ['"openDocument.error": "Не удалось открыть файл конфигурации"', '"openDocument.error": ""'],
        ['"openDocument.error": "无法打开配置文件"', '"openDocument.error": ""'],
      ];
      let n = 0;
      for (const [a, b] of gPairs) {
        if (s.includes(a)) {
          s = s.split(a).join(b);
          n++;
        }
      }
      if (n) {
        fs.writeFileSync(gen, s);
        console.log("  scrubbed openDocument labels", n);
      }
    }
  }
  patchChrome(tree);

  for (const rel of [
    "beam-client-ui-settings-models/lib/client.js",
    "beam-client-ui-agent-preset/lib/client.js",
    "beam-client-ui-settings-account/lib/client.js",
    "beam-client-ui-settings-plugins/lib/client.js",
    "beam-client-ui-settings-general/lib/client.js",
  ]) {
    const f = path.join(tree, rel);
    if (fs.existsSync(f)) {
      syntaxCheck(f);
      console.log("  syntax ok", rel);
    }
  }
}

console.log("\n✓ Settings plumbing UI hidden (Limits / presets / account / plugins / config file)");
