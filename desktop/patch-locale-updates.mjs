/**
 * Beam Agent: EN default + RU option (no Chinese), kill DeepSeek updates, version 0.1.3-early-alpha.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const APP = path.join(ROOT, "dist/Beam Agent/resources/app");
const DIST = path.join(ROOT, "dist/Beam Agent");
const DSH = path.join(APP, "dsh/node_modules/@deepseek-ai");
const BEAM_VERSION = "0.1.8";

const ruCommon = {
  ok: "OK",
  cancel: "Отмена",
  close: "Закрыть",
  copy: "Копировать",
  copied: "Скопировано",
  "codeBlock.title": "Блок кода",
  "codeBlock.wrap": "Перенос строк",
  "codeBlock.unwrap": "Без переноса",
  "copy.failed": "Не удалось скопировать",
  "copy.value": "Копировать значение",
  "copy.json": "Копировать JSON",
  "copy.path": "Копировать путь",
  "copy.prettyJson": "Копировать JSON (красиво)",
  "copy.compactJson": "Копировать JSON (компактно)",
  "copy.optionsHint": "{action}; ПКМ — варианты копирования",
  retry: "Повторить",
  loading: "Загрузка…",
  "load.failed": "Не удалось загрузить",
  submit: "Отправить",
  submitting: "Отправка…",
  next: "Далее",
  previous: "Назад",
  skip: "Пропустить",
  delete: "Удалить",
  edit: "Изменить",
  save: "Сохранить",
  search: "Поиск",
  more: "Ещё",
  collapse: "Свернуть",
  expand: "Развернуть",
  back: "Назад",
  "brand.localBuild": "Beam Agent",
  "workspace.defaultName": "Рабочая область по умолчанию",
  unknown: "Неизвестно",
  none: "Нет",
  truncated: "Обрезано",
  "json.label": "JSON",
  "markdown.footnotes": "Сноски",
  "markdown.truncatedCharacters": "… обрезано, всего {total} символов",
  "number.thousand": "{value}K",
  "number.million": "{value}M",
};

console.log("1) Version →", BEAM_VERSION);
{
  const pkgPath = path.join(APP, "package.json");
  const j = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  j.version = BEAM_VERSION;
  j.productName = "Beam Agent";
  j.dshDesktopUpdateChannel = "latest";
  delete j.dshMandatoryUpdatePolicy;
  fs.writeFileSync(pkgPath, JSON.stringify(j, null, 2) + "\n");

  const mainJs = path.join(APP, "lib/main.js");
  let main = fs.readFileSync(mainJs, "utf8");
  main = main.replace(/return "0\.2\.[^"]+";/, `return "${BEAM_VERSION}";`);
  main = main.replace(/return "0\.1\.0";/, `return "${BEAM_VERSION}";`);
  fs.writeFileSync(mainJs, main);
}

console.log("2) Point updates at Assistix Beam feed (do NOT disable)");
{
  const ymlSrc = path.join(ROOT, "desktop/installer/app-update.yml");
  const yml = path.join(DIST, "resources/app-update.yml");
  if (fs.existsSync(ymlSrc)) {
    fs.copyFileSync(ymlSrc, yml);
    const disabled = yml + ".disabled";
    if (fs.existsSync(disabled)) fs.unlinkSync(disabled);
    console.log("  app-update.yml → Assistix download feed");
  }
  // Keep updater enabled; DeepSeek publisherName must not ship.
  const mainJs = path.join(APP, "lib/main.js");
  let main = fs.readFileSync(mainJs, "utf8");
  main = main.replaceAll(
    "enabled = () => false",
    'enabled = () => app.isPackaged && existsSync(join(process.resourcesPath, "app-update.yml"))',
  );
  fs.writeFileSync(mainJs, main);
}

console.log("3) Locale client: en + ru only");
{
  const clientCandidates = [
    path.join(DSH, "dsh-client-locale/lib/client.js"),
    path.join(APP, "beam/node_modules/@assistix/beam-client-locale/lib/client.js"),
    path.join(APP, "beam/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js"),
  ];
  const client = clientCandidates.find((p) => fs.existsSync(p));
  if (!client) {
    console.warn("  locale client missing — skip (already shipped in beam tree)");
  } else {
  let s = fs.readFileSync(client, "utf8");

  s = s.replaceAll('const LOCALE_IDS = ["zh", "en"];', 'const LOCALE_IDS = ["en", "ru"];');

  s = s.replace(
    /const BUILT_IN_LOCALE_METADATA = \{[\s\S]*?\n\t\t\};/,
    `const BUILT_IN_LOCALE_METADATA = {
			en: { label: "English" },
			ru: {
				label: "Русский",
				fallback: "en"
			}
		};`
  );

  if (!s.includes("const ru$1 =")) {
    s = s.replace(
      "const en$1 = {",
      `const ru$1 = ${JSON.stringify(ruCommon)};\n\t\tconst en$1 = {`
    );
  }

  s = s.replace(
    `locale.register(COMMON_NS, {
				zh: zh$1,
				en: en$1
			});`,
    `locale.register(COMMON_NS, {
				en: en$1,
				ru: ru$1
			});`
  );

  if (!s.includes('const ru = { "language.title"')) {
    s = s.replace(
      'const en = { "language.title": "Language" };',
      'const en = { "language.title": "Language" };\n\t\tconst ru = { "language.title": "Язык" };'
    );
  }

  s = s.replace(
    `locale.register(SETTINGS_NS, {
				zh,
				en
			});`,
    `locale.register(SETTINGS_NS, {
				en,
				ru
			});`
  );

  s = s.replace(
    'const language = snapshot.active === "zh" ? "zh-CN" : snapshot.active;',
    'const language = snapshot.active === "ru" ? "ru-RU" : "en";'
  );

  fs.writeFileSync(client, s);

  const index = path.join(path.dirname(path.dirname(client)), "index.js");
  if (fs.existsSync(index)) {
    let idx = fs.readFileSync(index, "utf8");
    idx = idx.replaceAll('const LOCALE_IDS = ["zh", "en"];', 'const LOCALE_IDS = ["en", "ru"];');
    fs.writeFileSync(index, idx);
  }
  console.log("  locale patched", path.relative(ROOT, client));
  }
}

console.log("4) Desktop shell: never Chinese; RU if system/preference else EN");
{
  const mainJs = path.join(APP, "lib/main.js");
  let main = fs.readFileSync(mainJs, "utf8");

  const replacement = `function resolveDesktopLocale(locale) {
	const primary = String(locale || "en").toLowerCase().split(/[-_]/)[0];
	return {
		id: primary === "ru" ? "ru" : "en",
		messages: en
	};
}
/**
* Choose a built-in dictionary from the shared preference, then ordered OS languages.
* @param preference - explicit locale.preference, or null when no language was selected.
* @param languages - operating-system languages in preference order.
* @returns the supported dictionary, falling back to English.
*/
function resolveDesktopStartupLocale(preference, languages) {
	const selected = preference?.toLowerCase();
	if (selected === "ru" || selected === "en") return resolveDesktopLocale(selected);
	if (selected === "zh") return resolveDesktopLocale("en");
	for (const language of languages) {
		const primary = language.toLowerCase().split("-")[0];
		if (primary === "ru") return resolveDesktopLocale("ru");
		if (primary === "en") return resolveDesktopLocale("en");
	}
	return resolveDesktopLocale("en");
}`;

  const re =
    /function resolveDesktopLocale\(locale\) \{[\s\S]*?\n\}\n\/\*\*[\s\S]*?function resolveDesktopStartupLocale\(preference, languages\) \{[\s\S]*?\n\}/;
  if (!re.test(main)) {
    // try without the docblock between
    const re2 =
      /function resolveDesktopLocale\(locale\) \{[\s\S]*?\n\}\nfunction resolveDesktopStartupLocale\(preference, languages\) \{[\s\S]*?\n\}/;
    if (re2.test(main)) main = main.replace(re2, replacement);
    else console.warn("  WARN: resolveDesktopLocale block not found — manual check needed");
  } else {
    main = main.replace(re, replacement);
  }

  // Wire locale for platform headers: never zh
  main = main.replace(
    'return locale.toLowerCase().split(/[-_]/)[0] === "zh" ? "zh_CN" : "en_US";',
    'return locale.toLowerCase().split(/[-_]/)[0] === "ru" ? "ru_RU" : "en_US";'
  );

  fs.writeFileSync(mainJs, main);
}

console.log("5) Clear stored zh preference");
{
  const home = process.env.USERPROFILE || "";
  const roots = [
    path.join(home, ".beam"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        let st;
        try {
          st = fs.statSync(p);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          if (name === "node_modules" || name === ".git") continue;
          walk(p);
        } else if (/\.(yml|yaml|json)$/i.test(name)) {
          let s = fs.readFileSync(p, "utf8");
          const n = s
            .replace(/preference:\s*zh\b/g, "preference: en")
            .replace(/"preference"\s*:\s*"zh"/g, '"preference": "en"');
          if (n !== s) {
            fs.writeFileSync(p, n);
            console.log("  fixed", p);
          }
        }
      }
    };
    walk(root);
  }
}

console.log("6) Hide Chinese menu entries only (keep Update / Beam updates visible)");
{
  const htmlPaths = [
    path.join(APP, "dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
    path.join(APP, "beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
    path.join(APP, "beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  ];
  const snip = `
<script id="beam-kill-zh-only">
(() => {
  const run = () => {
    for (const el of document.querySelectorAll("[role=menuitem], [role=option], button, li, span, div")) {
      const t = (el.innerText || "").trim();
      if (t === "中文" || t === "简体中文" || t === "繁體中文") {
        (el.closest("[role=menuitem], [role=option], li, button") || el).style.display = "none";
      }
    }
  };
  const schedule = () => requestAnimationFrame(run);
  const start = () => {
    run();
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;
  for (const htmlPath of htmlPaths) {
    if (!fs.existsSync(htmlPath)) continue;
    let html = fs.readFileSync(htmlPath, "utf8");
    // Remove old kill-update script that hid the Update button
    html = html.replace(/<script id="beam-kill-zh-update">[\s\S]*?<\/script>\s*/g, "");
    if (!html.includes("beam-kill-zh-only")) {
      html = html.replace("</head>", snip + "\n</head>");
    }
    fs.writeFileSync(htmlPath, html);
    console.log("  locale scrub", path.relative(ROOT, htmlPath));
  }
}

console.log("✓ done");
console.log("  version:", BEAM_VERSION);
console.log("  languages: English (default) · Русский (manual / if OS is Russian)");
console.log("  Assistix Beam updates: on → https://agent.assistix.org/download/");
