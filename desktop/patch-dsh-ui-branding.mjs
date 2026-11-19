/**
 * Purge user-facing DSH / DeepSeek Harness branding → Beam.
 *
 * Targets locale dictionaries, chat/system error copy, plugin UI strings,
 * Electron shell dialogs, and bridge scrubBrandLeak. Keeps internal protocol
 * ids, env names (DSH_HOME), CSS tokens (--dsh-*), IPC channels, package paths.
 *
 * Re-runnable: node desktop/patch-dsh-ui-branding.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const report = {
  files: [],
  stringSamples: new Set(),
  skippedInternal: [],
};

/** Exact phrase pairs (longest / most specific first). */
const EXACT = [
  // Chat interrupted-turn (screenshot)
  [
    "The DSH process exited before this turn finished (for example, it was killed, crashed, or timed out while shutting down), so the turn was closed when DSH restarted. Unfinished tool calls have unknown outcomes.",
    "The Beam process exited before this turn finished (for example, it was killed, crashed, or timed out while shutting down), so the turn was closed when Beam restarted. Unfinished tool calls have unknown outcomes.",
  ],
  [
    "DSH 进程在本轮完成前退出（例如被强制结束、崩溃或关闭超时），重新启动后本轮已中止。未完成的工具调用结果未知。",
    "Beam 进程在本轮完成前退出（例如被强制结束、崩溃或关闭超时），重新启动后本轮已中止。未完成的工具调用结果未知。",
  ],
  [
    "The DSH process exited before this turn finished.",
    "The Beam process exited before this turn finished.",
  ],
  [
    "or a turn that restart recovery closed because the DSH process exited mid-turn.",
    "or a turn that restart recovery closed because the Beam process exited mid-turn.",
  ],

  // Product name
  ["DeepSeek Harness", "Beam Agent"],
  ["DeepSeek Account", "ASSISTIX ID"],

  // Electron CLI dialogs
  ["Manage dsh Command…", "Manage Beam Command…"],
  ["Manage dsh Command", "Manage Beam Command"],
  ["Current dsh command:", "Current Beam command:"],
  [
    "Another dsh takes precedence. Remove or reorder that installation to use the Desktop command by default. You can also run the Desktop command by its full path.",
    "Another Beam installation takes precedence. Remove or reorder that installation to use the Desktop command by default. You can also run the Desktop command by its full path.",
  ],
  [
    "Your shell command could not be verified. An alias or another dsh installation may take precedence.",
    "Your shell command could not be verified. An alias or another Beam installation may take precedence.",
  ],
  [
    "Install Desktop in your Applications folder before managing the dsh command.",
    "Install Desktop in your Applications folder before managing the Beam command.",
  ],
  [
    "Open a new terminal and run dsh --version.",
    "Open a new terminal and run Beam Agent.",
  ],
  [
    "Open Manage dsh Command again to review the current state.",
    "Open Manage Beam Command again to review the current state.",
  ],

  // Plugin manager / market (EN)
  ["Restart DSH to apply the change.", "Restart Beam to apply the change."],
  ["restart DSH to load it.", "restart Beam to load it."],
  ["Installed; restart DSH to load it.", "Installed; restart Beam to load it."],
  [
    "An installed package now resolves to another directory, or the change replaces a package the DSH installation provides. Uninstall a package before installing it from another location.",
    "An installed package now resolves to another directory, or the change replaces a package the Beam installation provides. Uninstall a package before installing it from another location.",
  ],
  [
    "The change reaches modules DSH itself loaded.",
    "The change reaches modules Beam itself loaded.",
  ],
  [
    "DSH could not compare the loaded plugins with their files.",
    "Beam could not compare the loaded plugins with their files.",
  ],
  [
    "On-demand Official plugins offer Update when their version differs from DSH.",
    "On-demand Official plugins offer Update when their version differs from Beam.",
  ],
  [
    "This plugin ships with DSH; upgrading DSH updates it",
    "This plugin ships with Beam; upgrading Beam updates it",
  ],
  ["Source for this DSH", "Source for this Beam"],
  ["Version for this DSH", "Version for this Beam"],
  [
    "{plugin} is incompatible with DSH {runtime} (requires {requirements}); running it may cause crashes or data loss.",
    "{plugin} is incompatible with Beam {runtime} (requires {requirements}); running it may cause crashes or data loss.",
  ],
  [
    "This plugin is incompatible with the running DSH version; running it may cause crashes or data loss.",
    "This plugin is incompatible with the running Beam version; running it may cause crashes or data loss.",
  ],
  [
    "Install a plugin version compatible with this DSH.",
    "Install a plugin version compatible with this Beam.",
  ],
  [
    "Uninstall it and install a version compatible with this DSH.",
    "Uninstall it and install a version compatible with this Beam.",
  ],
  ["Provided by DSH", "Provided by Beam"],
  [
    "This version is not compatible with the running DSH {runtime}; it requires DSH {range}.",
    "This version is not compatible with the running Beam {runtime}; it requires Beam {range}.",
  ],
  ["No version is compatible with DSH {runtime}", "No version is compatible with Beam {runtime}"],
  [
    "This version is not compatible with the running DSH, but you set a compatibility exemption for it.",
    "This version is not compatible with the running Beam, but you set a compatibility exemption for it.",
  ],

  // Plugin manager (ZH)
  ["请重启 DSH 使更改生效。", "请重启 Beam 使更改生效。"],
  [
    "已安装的插件包解析到了另一个目录，或者更改替换了 DSH 安装自带的包。从其他位置安装前请先卸载。",
    "已安装的插件包解析到了另一个目录，或者更改替换了 Beam 安装自带的包。从其他位置安装前请先卸载。",
  ],
  ["更改涉及 DSH 自身已加载的模块。", "更改涉及 Beam 自身已加载的模块。"],
  [
    "DSH 无法将已加载的插件与磁盘上的文件进行比较。",
    "Beam 无法将已加载的插件与磁盘上的文件进行比较。",
  ],
  [
    "按需安装的官方插件会在版本与 DSH 不同时提供“更新”。其他插件请先卸载再安装新版。",
    "按需安装的官方插件会在版本与 Beam 不同时提供“更新”。其他插件请先卸载再安装新版。",
  ],
  [
    "该插件随 DSH 提供，升级 DSH 即可获得新版本",
    "该插件随 Beam 提供，升级 Beam 即可获得新版本",
  ],
  ["当前 DSH 对应来源", "当前 Beam 对应来源"],
  ["当前 DSH 对应版本", "当前 Beam 对应版本"],
  ["已安装，请重启 DSH 加载它。", "已安装，请重启 Beam 加载它。"],
  [
    "{plugin} 与 DSH {runtime} 不兼容（要求 {requirements}），运行它可能导致崩溃或数据丢失。",
    "{plugin} 与 Beam {runtime} 不兼容（要求 {requirements}），运行它可能导致崩溃或数据丢失。",
  ],
  [
    "这个插件与当前 DSH 版本不兼容，运行它可能导致崩溃或数据丢失。",
    "这个插件与当前 Beam 版本不兼容，运行它可能导致崩溃或数据丢失。",
  ],
  ["请安装与当前 DSH 兼容的插件版本。", "请安装与当前 Beam 兼容的插件版本。"],
  ["请卸载后重新安装与当前 DSH 兼容的版本。", "请卸载后重新安装与当前 Beam 兼容的版本。"],
  ["随 DSH 提供", "随 Beam 提供"],
  [
    "此版本与当前的 DSH {runtime} 不兼容，它要求 DSH {range}",
    "此版本与当前的 Beam {runtime} 不兼容，它要求 Beam {range}",
  ],
  ["没有与当前 DSH {runtime} 兼容的版本", "没有与当前 Beam {runtime} 兼容的版本"],
  [
    "此版本与当前 DSH 不兼容，但你已为它设置了兼容性豁免",
    "此版本与当前 Beam 不兼容，但你已为它设置了兼容性豁免",
  ],

  // Session / conversation
  [
    "This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.",
    "This session is already in use, possibly by another running Beam instance (such as Beam web or the desktop app). Quit other running Beam instances and try again.",
  ],
  [
    "当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。",
    "当前会话已被占用，可能是其他正在运行的 Beam 导致的（如其他 Beam web、桌面端），请退出其他正在运行的 Beam 后重试。",
  ],

  // Sidebar browser
  [
    "The embedded browser cannot open the DSH application itself.",
    "The embedded browser cannot open the Beam application itself.",
  ],
  ["不能在嵌入浏览器中打开 DSH 应用自身。", "不能在嵌入浏览器中打开 Beam 应用自身。"],

  // Entry customization / creator prompts
  ["Create a DSH plugin with a left sidebar entry.", "Create a Beam plugin with a left sidebar entry."],
  ["Create a DSH conversation view plugin.", "Create a Beam conversation view plugin."],
  ["Create a DSH plugin with a right sidebar entry.", "Create a Beam plugin with a right sidebar entry."],
  ["创建一个带左侧栏入口的 DSH 插件。", "创建一个带左侧栏入口的 Beam 插件。"],
  ["创建一个 DSH 会话视图插件。", "创建一个 Beam 会话视图插件。"],
  ["创建一个带右侧栏入口的 DSH 插件。", "创建一个带右侧栏入口的 Beam 插件。"],
  [
    "A plugin adds capabilities to DSH, such as a tool, a service connection, or a UI entry.",
    "A plugin adds capabilities to Beam, such as a tool, a service connection, or a UI entry.",
  ],
  [
    "> Create a DSH plugin that adds a project notes entry to the sidebar.",
    "> Create a Beam plugin that adds a project notes entry to the sidebar.",
  ],
  ["插件为 DSH 增加能力", "插件为 Beam 增加能力"],
  ["> 帮我写一个 DSH 插件", "> 帮我写一个 Beam 插件"],

  // Voice input
  [
    "Local models will be downloaded to the machine running DSH. No Python or compiler is required.",
    "Local models will be downloaded to the machine running Beam. No Python or compiler is required.",
  ],
  ["将在运行 DSH 的机器上下载本地模型，无需安装 Python 或编译工具。", "将在运行 Beam 的机器上下载本地模型，无需安装 Python 或编译工具。"],
  ["machine running DSH", "machine running Beam"],
  ["运行 DSH 的机器", "运行 Beam 的机器"],
  [
    "Audio is recognized on the machine running DSH.",
    "Audio is recognized on the machine running Beam.",
  ],
  ["音频在运行 DSH 的机器上识别。", "音频在运行 Beam 的机器上识别。"],

  // Badge / skill locales
  ['"title": "DSH"', '"title": "Beam"'],
  ['"title": "DSH badge skill"', '"title": "Beam badge skill"'],
  ['"title": "DSH 徽章技能"', '"title": "Beam 徽章技能"'],
  ["powered-by-DSH", "powered-by-Beam"],
  ["powered by dsh", "powered by Beam"],
  ["powered by DSH", "powered by Beam"],
  ["「powered by dsh」", "「powered by Beam」"],
  ["Provide the official powered-by-DSH badge skill.", "Provide the official powered-by-Beam badge skill."],
  ["提供官方 powered-by-DSH 徽章技能。", "提供官方 powered-by-Beam 徽章技能。"],
  [
    "Let agents add a “powered by dsh” badge to documents, pull requests, and other outputs.",
    "Let agents add a “powered by Beam” badge to documents, pull requests, and other outputs.",
  ],
  ["为命令执行工具统一提供 DSH 环境变量。", "为命令执行工具统一提供 Beam 环境变量。"],
  ["作为 dsh-llm-deepseek 的设计验证实现。", "作为 Beam LLM 适配的设计验证实现。"],

  // API remotes tool description (can surface in UI)
  ["Exact current DSH version for grants", "Exact current Beam version for grants"],

  // Creator / modes leftovers
  ["Customize DSH through conversation", "Customize Beam Agent through conversation"],
  ["add capabilities to DSH", "add capabilities to Beam Agent"],
  ["own DSH plugin", "own Beam Agent plugin"],
  ["扩展 DSH 的能力", "扩展 Beam Agent 的能力"],
  ["用对话定制 DSH", "用对话定制 Beam Agent"],
  ["你的 DSH 插件", "你的 Beam Agent 插件"],

  // Local build leftover
  ["DSH Local Build", "Собрано в Beam"],
  ["DSH 本地构建", "Собрано в Beam"],
];

/** Word-boundary DSH → Beam after exact pairs (safe: won't touch DSH_HOME / __DSH_BOOT__). */
const WORD_PASSES = [
  [/\bDSH\b/g, "Beam"],
  // Lowercase standalone product mention in prose (not package paths with hyphen)
  [/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/g, "beam"],
];

const TARGET_NAME_RE =
  /(client\.js|index\.js|locale\.js|main\.js|\.json|\.yml|\.yaml|\.html|\.md)$/i;

/** Paths that hold user-visible copy (or shell dialogs). */
function isUiCopyPath(file) {
  const n = file.replace(/\\/g, "/").toLowerCase();
  if (n.includes("/node_modules/") && !n.includes("/@assistix/") && !n.includes("/@deepseek-ai/")) {
    // app lib/main.js etc.
  }
  if (n.endsWith("/lib/main.js") || n.endsWith("/lib/locale.js")) return true;
  if (n.includes("/locale/")) return true;
  if (/\/(beam|dsh)-client-ui[^/]*\/lib\/client\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-experimental-client-ui[^/]*\/lib\/client\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-api-remotes\/lib\/client\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-client-ui-agent-preset\/lib\/client\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-web-frontend\/dist\/index\.html$/.test(n)) return true;
  if (/\/(beam|dsh)-skill-badge\//.test(n)) return true;
  if (/\/(beam|dsh)-shell-env\/locale\//.test(n)) return true;
  if (/\/(beam|dsh)-experimental-badge-skill-bundle\//.test(n)) return true;
  if (/\/(beam|dsh)-llm-pi-ai\/locale\//.test(n)) return true;
  if (/\/(beam|dsh)-harness-dev-context\/lib\/index\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-cordis-client-runner\/lib\/client\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-plugin-manager\/lib\/typert\.host\.js$/.test(n)) return true;
  if (/\/(beam|dsh)-api-remotes\/lib\/client\.js$/.test(n)) return true;
  return false;
}

function rewriteUiCopy(s) {
  let out = s;
  for (const [from, to] of EXACT) {
    if (out.includes(from)) {
      out = out.split(from).join(to);
      report.stringSamples.add(`${from.slice(0, 72)}… → ${to.slice(0, 72)}…`);
    }
  }
  for (const [re, to] of WORD_PASSES) {
    if (re.test(out)) {
      out = out.replace(re, to);
      report.stringSamples.add(`${re} → ${to}`);
    }
  }
  return out;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".git" || ent.name === "node_modules" && dir.endsWith("node_modules")) {
      // still walk top-level package node_modules
    }
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".git") continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

function patchFile(file) {
  if (!TARGET_NAME_RE.test(file)) return false;
  if (!isUiCopyPath(file)) return false;
  let s;
  try {
    s = fs.readFileSync(file, "utf8");
  } catch {
    return false;
  }
  if (!/DSH|DeepSeek Harness|\bdsh\b/.test(s)) return false;
  const next = rewriteUiCopy(s);
  if (next === s) return false;
  fs.writeFileSync(file, next);
  report.files.push(file);
  return true;
}

/** Inject / refresh DOM safety net that rewrites residual DSH in live text. */
const DOM_MARK = "beam-dsh-ui-brand-scrub";
const DOM_SNIPPET = `
<script>
/* ${DOM_MARK} */
(function () {
  if (window.__BEAM_DSH_UI_BRAND_SCRUB__) return;
  window.__BEAM_DSH_UI_BRAND_SCRUB__ = true;
  function rewrite(s) {
    if (!s || typeof s !== "string") return s;
    return s
      .replace(/DeepSeek\\s+Harness/gi, "Beam Agent")
      .replace(/\\bDSH\\b/g, "Beam")
      .replace(/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/g, "beam");
  }
  function scrubNode(n) {
    if (!n) return;
    if (n.nodeType === 3) {
      const v = n.nodeValue;
      const nv = rewrite(v);
      if (nv !== v) n.nodeValue = nv;
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = (n.tagName || "").toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript") return;
    for (const c of [...n.childNodes]) scrubNode(c);
  }
  function run() {
    try { scrubNode(document.body || document.documentElement); } catch {}
  }
  const mo = new MutationObserver(() => run());
  function start() {
    run();
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>
`;

function patchFrontendHtml(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const re = new RegExp(
    `<script>\\s*/\\* ${DOM_MARK} \\*/[\\s\\S]*?</script>\\s*`,
    "g"
  );
  s = s.replace(re, "");
  if (s.includes("</body>")) {
    s = s.replace("</body>", `${DOM_SNIPPET}</body>`);
  } else if (s.includes("</head>")) {
    s = s.replace("</head>", `${DOM_SNIPPET}</head>`);
  } else {
    s += DOM_SNIPPET;
  }
  // Also rewrite any static DSH copy already in the HTML string tables via rewriteUiCopy
  s = rewriteUiCopy(s);
  fs.writeFileSync(file, s);
  if (!report.files.includes(file)) report.files.push(file);
  return true;
}

/** Extend scrubBrandLeak in bridge + keep patch-persona template in sync via direct edit. */
function patchBridgeScrub(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("function scrubBrandLeak")) return false;
  const needle = "t = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, 'Beam Agent')";
  const needleAlt = 't = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, "Beam Agent")';
  const inject = [
    "t = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, 'Beam Agent')",
    "t = t.replace(/\\bDSH\\b/g, 'Beam')",
    "t = t.replace(/The Beam process exited before this turn finished[^.]*(?:\\.\\s*)?/gi, (m) => m) // already Beam",
    "t = t.replace(/\\bDeepSeek\\s+Harness\\s+process\\b/gi, 'Beam process')",
    "t = t.replace(/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/gi, 'beam')",
  ].join("\n  ");
  // Prefer inserting after existing DeepSeek Harness line
  if (s.includes("t = t.replace(/\\bDSH\\b/g, 'Beam')") || s.includes('t = t.replace(/\\bDSH\\b/g, "Beam")')) {
    // already extended
  } else if (s.includes(needle)) {
    s = s.replace(
      needle,
      [
        "t = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, 'Beam Agent')",
        "t = t.replace(/\\bDSH\\b/g, 'Beam')",
        "t = t.replace(/\\bDeepSeek\\s+Harness\\s+process\\b/gi, 'Beam process')",
        "t = t.replace(/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/gi, 'beam')",
      ].join("\n  ")
    );
  } else if (s.includes("DeepSeek\\s+(?:Harness|Beam Agent)")) {
    s = s.replace(
      /t = t\.replace\(\/\\bDeepSeek\\s\+\(\?:Harness\|Beam Agent\)\\b\/gi,\s*['"]Beam Agent['"]\)/,
      [
        "t = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, 'Beam Agent')",
        "t = t.replace(/\\bDSH\\b/g, 'Beam')",
        "t = t.replace(/\\bDeepSeek\\s+Harness\\s+process\\b/gi, 'Beam process')",
        "t = t.replace(/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/gi, 'beam')",
      ].join("\n  ")
    );
  } else {
    // Insert before return t in scrubBrandLeak
    s = s.replace(
      /(function scrubBrandLeak\(text\) \{[\s\S]*?)(\n\s*return t\n\})/,
      `$1\n  t = t.replace(/\\bDeepSeek\\s+(?:Harness|Beam Agent)\\b/gi, 'Beam Agent')\n  t = t.replace(/\\bDSH\\b/g, 'Beam')\n  t = t.replace(/(?<![A-Za-z0-9_/@.-])dsh(?![A-Za-z0-9_/-])/gi, 'beam')\n$2`
    );
  }
  // Drop the noop line if we accidentally added a weird comment form
  s = s.replace(
    /\n\s*t = t\.replace\(\/The Beam process exited before this turn finished\[\^\.\]\*\(\?:\\\.\\s\*\)\?\/gi, \(m\) => m\) \/\/ already Beam/g,
    ""
  );
  fs.writeFileSync(file, s);
  if (!report.files.includes(file)) report.files.push(file);
  return true;
}

// --- run ---
for (const tree of APP_TREES) {
  for (const file of walk(tree)) patchFile(file);
  for (const rel of [
    "beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
    "beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
    "dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  ]) {
    patchFrontendHtml(path.join(tree, rel));
  }
}

for (const bridge of [
  path.join(ROOT, "desktop", "bridge", "server.js"),
  path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js"),
]) {
  patchBridgeScrub(bridge);
}

// Record intentional leftovers note
report.skippedInternal = [
  "DSH_HOME / DSH_* env (launcher compatibility)",
  "__DSH_BOOT__ / __DSH_BOOT_READY__ / data-dsh-boot (boot protocol)",
  "--dsh-* CSS variables / data-dsh-* attributes",
  "dsh-welcome:* / dsh-update-dialog:* IPC channel names",
  "@deepseek-ai/dsh-* / @assistix twin package folder names",
  "resolveDshHome / isDSHRemoteError / internal Error() logs in main process",
];

const outPath = path.join(ROOT, "desktop", "_dsh-ui-branding-report.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      files: report.files,
      stringSamples: [...report.stringSamples],
      skippedInternal: report.skippedInternal,
    },
    null,
    2
  )
);

console.log(`patched ${report.files.length} files`);
console.log(`samples: ${report.stringSamples.size}`);
console.log(`report: ${outPath}`);
