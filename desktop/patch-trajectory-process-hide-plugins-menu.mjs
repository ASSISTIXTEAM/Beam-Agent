/**
 * Beam product chrome:
 * 1) Rename Trajectory tab → Process / Процесс (EN+RU i18n + a11y copy)
 * 2) Remove Browse/Create plugins from session/sidebar/rightbar More menus
 *    by not registering entry-customization slot actions (ellipsis hides).
 *
 * Applies runtime + dist (@assistix + @deepseek-ai). No BEAM_BASE_URL / .env writes.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_TRAJECTORY_PROCESS_HIDE_PLUGINS";

const TRAJECTORY_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-trajectory/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-trajectory/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-trajectory/lib/client.js",
];

const ENTRY_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-entry-customization/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-entry-customization/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-entry-customization/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-entry-customization/lib/client.js",
];

const FRONTEND_INDEX = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
];

const SETTINGS_GENERAL = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-settings-general/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js",
];

function abs(rel) {
  return path.join(ROOT, rel);
}

function patchFile(rel, fn) {
  const file = abs(rel);
  if (!fs.existsSync(file)) {
    console.log("  skip missing", rel);
    return false;
  }
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before, rel);
  if (after === before) {
    console.log("  unchanged", rel);
    return false;
  }
  fs.writeFileSync(file, after);
  console.log("  patched", rel);
  return true;
}

function renameTrajectoryLocales(s) {
  const pairs = [
    ['"view.trajectory": "Trajectory"', '"view.trajectory": "Process"'],
    ['"view.trajectory": "Траектория"', '"view.trajectory": "Процесс"'],
    ['"view.trajectory": "轨迹"', '"view.trajectory": "过程"'],
    ['"view.trajectory": "軌跡"', '"view.trajectory": "過程"'],
    ['"toolbar.aria": "Trajectory toolbar"', '"toolbar.aria": "Process toolbar"'],
    ['"toolbar.aria": "Панель траектории"', '"toolbar.aria": "Панель процесса"'],
    ['"toolbar.search": "Search trajectory"', '"toolbar.search": "Search process"'],
    ['"toolbar.search": "Поиск по траектории"', '"toolbar.search": "Поиск по процессу"'],
    ['"toolbar.search": "搜索轨迹"', '"toolbar.search": "搜索过程"'],
    ['"history.loadingTrajectory": "Loading trajectory…"', '"history.loadingTrajectory": "Loading process…"'],
    ['"history.loadingTrajectory": "Загрузка траектории…"', '"history.loadingTrajectory": "Загрузка процесса…"'],
    ['"history.loadingTrajectory": "正在加载轨迹…"', '"history.loadingTrajectory": "正在加载过程…"'],
    ['"timeline.aria": "Trajectory timeline"', '"timeline.aria": "Process timeline"'],
    ['"timeline.aria": "Временная шкала траектории"', '"timeline.aria": "Временная шкала процесса"'],
    ['"timeline.aria": "轨迹时间线"', '"timeline.aria": "过程时间线"'],
  ];
  let out = s;
  for (const [a, b] of pairs) out = out.split(a).join(b);

  // RU beam-ru block: localize Process a11y (not leave English).
  const start = out.indexOf("// #region beam-ru");
  const end = out.indexOf("// #endregion beam-ru", start);
  if (start >= 0 && end > start) {
    let block = out.slice(start, end);
    const ruPairs = [
      ['"toolbar.aria": "Process toolbar"', '"toolbar.aria": "Панель процесса"'],
      ['"toolbar.search": "Search process"', '"toolbar.search": "Поиск по процессу"'],
      ['"history.loadingTrajectory": "Loading process…"', '"history.loadingTrajectory": "Загрузка процесса…"'],
      ['"timeline.aria": "Process timeline"', '"timeline.aria": "Временная шкала процесса"'],
    ];
    for (const [a, b] of ruPairs) block = block.split(a).join(b);
    out = out.slice(0, start) + block + out.slice(end);
  }
  return out;
}

function stripEntryCustomizationMenus(s) {
  if (s.includes(`/* ${MARK} */`)) {
    // Idempotent re-apply: ensure injects stay disabled.
  }

  // Remove Browse/Create menu rows from EntryMenuContent (defensive if injects remain).
  let out = s.replace(
    /moreEntries\.map\(\(entry\) =>[\s\S]*?\}, entry\.id\)\),\s*\(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.MenuItemButton, \{[\s\S]*?children: t\("install"\)\s*\}\),\s*\(0, react_jsx_runtime\.jsx\)\(_deepseek_ai_dsh_client_ui_primitives\.MenuItemButton, \{[\s\S]*?children: t\("create"\)\s*\}\)/,
    `moreEntries.map((entry) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
					current: entry.active === true,
					onSelect: () => {
						onDismiss();
						onOpen(entry.id);
					},
					children: (0, react_jsx_runtime.jsxs)("span", {
						className: EntryMenu_module_css_default.entryName,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: EntryMenu_module_css_default.entryTitle,
							children: entry.label
						}), entry.active === true && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {
							size: 16,
							className: EntryMenu_module_css_default.activeMark
						})]
					})
				}, entry.id)) /* ${MARK}: plugins browse/create rows removed */`
  );

  // Do not register More-menu slot actions — ellipsis/More chrome hides when slot empty.
  const injectBlock = `ctx.slots.inject("sidebar.panellist.actions", () => ctx.slots.register({
				name: "sidebar.panellist.actions",
				id: "entry-customization",
				locale: "entryCustomization",
				inject: () => injected("sidebar")
			}, EntryMenuContent));
			ctx.slots.inject("conversation.session.header.views.actions", () => ctx.slots.register({
				name: "conversation.session.header.views.actions",
				id: "entry-customization",
				locale: "entryCustomization",
				inject: () => injected("conversation")
			}, EntryMenuContent));
			ctx.slots.inject("sidebar.right.tab.guide.actions", () => ctx.slots.register({
				name: "sidebar.right.tab.guide.actions",
				id: "entry-customization",
				locale: "entryCustomization",
				inject: () => injected("rightbar")
			}, EntryMenuContent));`;

  const injectDisabled = `/* ${MARK}: plugins More menus disabled (sidebar / conversation / rightbar) */
			void injected;
			void EntryMenuContent;`;

  if (out.includes(injectBlock)) {
    out = out.replace(injectBlock, injectDisabled);
  } else if (!out.includes(`/* ${MARK}: plugins More menus disabled`)) {
    // Already partially patched or format drift — neutralize remaining injects.
    out = out.replace(
      /ctx\.slots\.inject\("(sidebar\.panellist\.actions|conversation\.session\.header\.views\.actions|sidebar\.right\.tab\.guide\.actions)"[\s\S]*?\}, EntryMenuContent\);/g,
      `/* ${MARK} */ void 0; /* disabled slot inject */`
    );
  }

  return out;
}

function patchFrontendIndex(s) {
  let out = s;
  const processPair = '[/^Process$/g, "Процесс"]';
  const trajOld = '[/^Trajectory$/g, "Траектория"]';
  const trajNew = '[/^Trajectory$/g, "Процесс"]';
  if (!out.includes(processPair)) {
    if (out.includes(trajOld)) {
      out = out.split(trajOld).join(`${processPair},\n      ${trajNew}`);
    } else if (out.includes(trajNew) && !out.includes(processPair)) {
      out = out.split(trajNew).join(`${processPair},\n      ${trajNew}`);
    } else if (out.includes('[/^Chat$/g, "Чат"]')) {
      out = out.split('[/^Chat$/g, "Чат"]').join(`[/^Chat$/g, "Чат"],\n      ${processPair},\n      ${trajNew}`);
    }
  } else {
    out = out.split(trajOld).join(trajNew);
  }

  const killExtra = `
    // #region ${MARK}
    const killPluginMenuRows = /^(Browse other plugins|Create your plugin|浏览更多插件|创建你的插件|Обзор других плагинов|Создать плагин)$/i;
    for (const el of document.querySelectorAll("[role='menuitem'], button, [role='button']")) {
      const label = (el.innerText || el.textContent || "").trim().split("\\n")[0].trim();
      if (!killPluginMenuRows.test(label)) continue;
      const row = el.closest("[role='menuitem'], button, li, [class*='menuItem'], [class*='MenuItem']") || el;
      row.setAttribute("data-beam-hidden-plugin-menu", "1");
      row.style.cssText = "display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;";
    }
    // #endregion ${MARK}
`;
  if (!out.includes(`#region ${MARK}`) && out.includes("hidePluginsEntryPoints();")) {
    out = out.replace(
      "hidePluginsEntryPoints();",
      `hidePluginsEntryPoints();\n${killExtra}`
    );
  }
  const oldKill =
    "const killLabel = /^(Plugins|Плагины|Plugin marketplace|Marketplace|Магазин плагинов|Built-in plugins|Встроенные плагины)$/i;";
  const newKill =
    "const killLabel = /^(Plugins|Плагины|Plugin marketplace|Marketplace|Магазин плагинов|Built-in plugins|Встроенные плагины|Browse other plugins|Create your plugin)$/i;";
  out = out.split(oldKill).join(newKill);
  return out;
}

function patchSettingsGeneral(s) {
  return s
    .split('"developerTools.description": "Shows trajectory, code diffs, and all Agent presets"')
    .join('"developerTools.description": "Shows process, code diffs, and all Agent presets"')
    .split('"developerTools.description": "Shows Trajectory, code diffs, and all Agent presets"')
    .join('"developerTools.description": "Shows process, code diffs, and all Agent presets"');
}

console.log("1) Rename Trajectory → Process / Процесс");
for (const rel of TRAJECTORY_FILES) {
  patchFile(rel, renameTrajectoryLocales);
}

console.log("2) Hide plugins More menus (entry-customization)");
for (const rel of ENTRY_FILES) {
  patchFile(rel, stripEntryCustomizationMenus);
}

console.log("3) Frontend injector + settings copy");
for (const rel of FRONTEND_INDEX) {
  patchFile(rel, patchFrontendIndex);
}
for (const rel of SETTINGS_GENERAL) {
  patchFile(rel, patchSettingsGeneral);
}

console.log("4) Syntax check");
const checkTargets = [...TRAJECTORY_FILES, ...ENTRY_FILES, ...SETTINGS_GENERAL]
  .map(abs)
  .filter((f) => fs.existsSync(f));
for (const file of checkTargets) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  console.log("  ok", path.relative(ROOT, file));
}

console.log(`✓ ${MARK}`);
