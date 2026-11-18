/**
 * Deep diving → Thinking, whale → brain, DeepSeek blue → Beam teal everywhere.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const DSH = path.join(ROOT, "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai");
const WEB = path.join(DSH, "dsh-web-frontend/dist");
const ASSETS = path.join(WEB, "assets");

const BEAM = "#00B3BC";
const BEAM_BRIGHT = "#2dd4bf";
const BEAM_DEEP = "#0d9488";
const BEAM_SOFT = "#ccfbf1";
const BEAM_MID = "#5eead4";
const BEAM_PALE = "#e8f7f5";
const BEAM_DARK = "#0f766e";
const BEAM_INK = "#134e4a";

// Simple brain outline path (16x16 viewBox) — lucide-ish
const BRAIN_PATH =
  "M7.2 2.8c-.9 0-1.7.4-2.2 1.1C4.5 3.5 3.9 3.2 3.3 3.2 2.1 3.2 1.2 4.2 1.2 5.4c0 .7.3 1.3.8 1.7-.5.4-.8 1-.8 1.7 0 .8.4 1.5 1 1.9-.1.3-.2.6-.2.9 0 1.3.9 2.4 2.1 2.7v.5c0 .7.6 1.3 1.3 1.3h.7c.4.6 1.1 1 1.9 1 .8 0 1.5-.4 1.9-1h.6c.8 0 1.5-.4 1.9-1h.7c.7 0 1.3-.6 1.3-1.3v-.5c1.2-.3 2.1-1.4 2.1-2.7 0-.3-.1-.6-.2-.9.6-.4 1-1.1 1-1.9 0-.7-.3-1.3-.8-1.7.5-.4.8-1 .8-1.7 0-1.2-.9-2.2-2.1-2.2-.6 0-1.2.3-1.7.7C11.3 3.2 10.5 2.8 9.6 2.8c-.7 0-1.3.2-1.8.6-.5-.4-1.1-.6-1.8-.6zm1.2 2.2c.4 0 .7.1 1 .3.2-.5.6-.8 1.1-.8.6 0 1.1.5 1.1 1.1 0 .2 0 .4-.1.5.4.1.7.4.9.8.1-.1.3-.1.4-.1.6 0 1.1.5 1.1 1.1 0 .4-.2.7-.5.9.3.2.5.6.5 1 0 .7-.5 1.2-1.1 1.3v1.1h-.9c-.2.5-.7.9-1.3.9-.5 0-.9-.2-1.1-.6-.2.4-.6.6-1.1.6-.6 0-1.1-.4-1.3-.9h-.9V10c-.6-.1-1.1-.6-1.1-1.3 0-.4.2-.8.5-1-.3-.2-.5-.5-.5-.9 0-.6.5-1.1 1.1-1.1.1 0 .3 0 .4.1.2-.4.5-.7.9-.8-.1-.1-.1-.3-.1-.5 0-.6.5-1.1 1.1-1.1.5 0 .9.3 1.1.8.3-.2.6-.3 1-.3z";

console.log("1) Chat: Deep diving → Thinking + brain icon");
{
  const p = path.join(DSH, "dsh-client-ui-chat/lib/client.js");
  let s = fs.readFileSync(p, "utf8");

  s = s.replaceAll('"chat.deepDiving": "Deep diving"', '"chat.deepDiving": "Thinking"');
  s = s.replaceAll(
    '"chat.deepDivingFor": "Deep diving for {duration} ···"',
    '"chat.deepDivingFor": "Thinking for {duration} ···"'
  );
  s = s.replaceAll('"chat.deepDiving": "深度求索中"', '"chat.deepDiving": "Thinking"');
  s = s.replaceAll(
    '"chat.deepDivingFor": "深度求索中，用时 {duration} ···"',
    '"chat.deepDivingFor": "Thinking for {duration} ···"'
  );

  // RU dict (may already say Deep diving from clone)
  s = s.replaceAll('"chat.deepDiving": "Deep diving"', '"chat.deepDiving": "Thinking"');
  // After EN replace, force RU specifically by patching inside const ru if present
  if (s.includes("const ru = {")) {
    // Replace RU thinking strings more explicitly via a second pass on the ru block
    const ruIdx = s.indexOf("const ru = {");
    const enIdx = s.indexOf("const en = {");
    // find ru block end roughly — replace within ru section only
    const ruEnd = s.indexOf("// #endregion", ruIdx + 10);
    if (ruIdx > 0 && ruEnd > ruIdx) {
      let ruBlock = s.slice(ruIdx, ruEnd);
      ruBlock = ruBlock.replace(
        /"chat\.deepDiving":\s*"[^"]*"/,
        '"chat.deepDiving": "Думаю"'
      );
      ruBlock = ruBlock.replace(
        /"chat\.deepDivingFor":\s*"[^"]*"/,
        '"chat.deepDivingFor": "Думаю · {duration} ···"'
      );
      s = s.slice(0, ruIdx) + ruBlock + s.slice(ruEnd);
    }
  }

  // Replace RunningWhaleTail with brain icon
  const whaleFn = `function RunningWhaleTail() {
			return (0, react_jsx_runtime.jsxs)("span", {
				className: ChatView_module_css_default.runningIcon,
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("span", { className: ChatView_module_css_default.runningWhaleAnimated }), (0, react_jsx_runtime.jsx)("svg", {
					className: ChatView_module_css_default.runningWhaleStill,
					width: "100%",
					height: "100%",
					viewBox: "0 0 16 16",
					fill: "none",
					children: (0, react_jsx_runtime.jsx)("path", {
						d: REST_PATH,
						stroke: "currentColor",
						strokeWidth: 1
					})
				})]
			});
		}`;

  const brainFn = `function RunningWhaleTail() {
			return (0, react_jsx_runtime.jsx)("span", {
				className: ChatView_module_css_default.runningIcon,
				"aria-hidden": "true",
				style: { color: ${JSON.stringify(BEAM)}, display: "inline-flex", alignItems: "center", justifyContent: "center" },
				children: (0, react_jsx_runtime.jsxs)("svg", {
					className: ChatView_module_css_default.runningWhaleStill,
					width: "16",
					height: "16",
					viewBox: "0 0 16 16",
					fill: "none",
					style: { display: "block", color: ${JSON.stringify(BEAM)} },
					children: [
						(0, react_jsx_runtime.jsx)("path", {
							d: ${JSON.stringify(BRAIN_PATH)},
							fill: ${JSON.stringify(BEAM)},
							opacity: 0.92
						})
					]
				})
			});
		}`;

  if (!s.includes("function RunningWhaleTail()")) throw new Error("RunningWhaleTail missing");
  // Replace from function RunningWhaleTail through its closing };
  const start = s.indexOf("function RunningWhaleTail()");
  const end = s.indexOf("//#endregion", start);
  if (start < 0 || end < 0) throw new Error("whale region bounds");
  // Keep REST_PATH unused is fine; replace function body only
  const fnEnd = s.indexOf("\n\t\t}", start) + "\n\t\t}".length;
  s = s.slice(0, start) + brainFn + s.slice(fnEnd);

  // Comment update
  s = s.replace(
    "Animated whale mask and static SVG fallback for the running Chat status.",
    "Beam thinking brain icon for the running Chat status."
  );

  fs.writeFileSync(p, s);
  console.log("  chat patched");
}

console.log("2) Theme tokens: DeepSeek blue → Beam teal");
{
  const p = path.join(DSH, "dsh-client-ui-theme/lib/client.js");
  let s = fs.readFileSync(p, "utf8");
  const map = {
    "#e4edfd": BEAM_PALE,
    "#d3e2ff": "#b6f0ea",
    "#b7c8fe": BEAM_MID,
    "#7aaaff": BEAM_BRIGHT,
    "#5686fe": BEAM,
    "#4176e6": BEAM,
    "#edf3fe": BEAM_PALE,
    "#4868b2": BEAM_DEEP,
    "#2f4c8f": BEAM_DARK,
    "#34415b": "#1a3a36",
    "#283142": "#0a1917",
  };
  // Only replace within deepseek token definitions by doing global hex replace for these exact deepseek palette values
  // which are unique enough
  for (const [from, to] of Object.entries(map)) {
    // case-insensitive
    const re = new RegExp(from.replace("#", "#"), "gi");
    s = s.replace(re, to);
  }
  // Also common brand alias if hardcoded
  s = s.replaceAll("--dsw-static-deepseek-500:#4176e6", `--dsw-static-deepseek-500:${BEAM}`);
  s = s.replaceAll("--dsw-static-deepseek-450:#5686fe", `--dsw-static-deepseek-450:${BEAM}`);
  s = s.replaceAll("--dsw-static-deepseek-400:#7aaaff", `--dsw-static-deepseek-400:${BEAM_BRIGHT}`);
  fs.writeFileSync(p, s);
  console.log("  theme palette remapped");
}

console.log("3) Strengthen beam-override.css (colors + thinking row)");
{
  const cssPath = path.join(ASSETS, "beam-override.css");
  let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";
  // Strip previous thinking/color region
  css = css.replace(/\/\* ===== BEAM thinking \+ palette ===== \*\/[\s\S]*$/g, "");

  css += `
/* ===== BEAM thinking + palette ===== */
:root, body, body[data-ds-dark-theme], html.dark, :root[data-theme="dark"] {
  --dsw-static-deepseek-50: ${BEAM_PALE} !important;
  --dsw-static-deepseek-100: ${BEAM_PALE} !important;
  --dsw-static-deepseek-200: #b6f0ea !important;
  --dsw-static-deepseek-300: ${BEAM_MID} !important;
  --dsw-static-deepseek-400: ${BEAM_BRIGHT} !important;
  --dsw-static-deepseek-450: ${BEAM} !important;
  --dsw-static-deepseek-500: ${BEAM} !important;
  --dsw-static-deepseek-600: ${BEAM_DEEP} !important;
  --dsw-static-deepseek-700-delete: ${BEAM_DARK} !important;
  --dsw-static-deepseek-800: #1a3a36 !important;
  --dsw-static-deepseek-900: #0a1917 !important;

  --dsw-alias-brand-primary: ${BEAM} !important;
  --dsw-alias-button-primary-fill: ${BEAM} !important;
  --dsw-alias-button-primary-hover: ${BEAM_DEEP} !important;
  --dsw-alias-state-business-primary: ${BEAM} !important;
  --dsw-alias-link: ${BEAM_BRIGHT} !important;
  --dsw-focus-ring-color: ${BEAM} !important;
  --dsw-alias-state-info-primary: ${BEAM} !important;
}

/* Thinking status row — Beam teal, no DeepSeek blue */
[class*="runningIcon"],
[class*="runningWhale"],
[class*="turnStatus"],
[data-chat-running="true"] {
  color: ${BEAM} !important;
}
[class*="runningWhaleAnimated"] {
  display: none !important; /* hide APNG whale */
}
[class*="runningWhaleStill"] {
  display: block !important;
  color: ${BEAM} !important;
  opacity: 1 !important;
}
[class*="TextShimmer"], [class*="textShimmer"], [class*="_shimmer_"] {
  --shimmer-color: ${BEAM_BRIGHT};
  color: ${BEAM_BRIGHT} !important;
}

/* Kill leftover DeepSeek blues in common accents */
[style*="4176e6"], [style*="5686fe"], [style*="7aaaff"] {
  /* can't override inline easily; CSS vars above cover most */
}
`;

  fs.writeFileSync(cssPath, css);
  console.log("  override css updated");
}

console.log("4) Injector: rewrite Deep diving text + force teal accents");
{
  const htmlPath = path.join(WEB, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  // Ensure rewrite includes Deep diving
  if (!html.includes("Deep diving")) {
    html = html.replace(
      ".replace(/Harness/g, \"Beam\");",
      `.replace(/Harness/g, "Beam")
        .replace(/Deep diving for/gi, "Thinking for")
        .replace(/Deep diving/gi, "Thinking")
        .replace(/深度求索中/g, "Думаю");`
    );
  } else {
    // already might have from previous - ensure present in RU_DOM or rewrite
  }

  // Add to rewriteText block if missing
  if (!html.includes("Deep diving for")) {
    html = html.replace(
      '.replace(/Harness/g, "Beam");',
      `.replace(/Harness/g, "Beam")
        .replace(/Deep diving for/gi, isRu() ? "Думаю ·" : "Thinking for")
        .replace(/Deep diving/gi, isRu() ? "Думаю" : "Thinking");`
    );
  }

  // Also add to RU_DOM array if present
  if (html.includes("const RU_DOM = [") && !html.includes('["Deep diving"')) {
    html = html.replace(
      "const RU_DOM = [",
      `const RU_DOM = [
    ["Deep diving for", "Думаю ·"],
    ["Deep diving", "Думаю"],
    ["Thinking for", "Думаю ·"],
    ["Thinking", "Думаю"],`
    );
  }

  fs.writeFileSync(htmlPath, html);
}

console.log("5) Main CSS bundle soft remap if deepseek hex left");
{
  const cssFiles = fs.readdirSync(ASSETS).filter((f) => f.endsWith(".css") && f.startsWith("index-"));
  for (const f of cssFiles) {
    const p = path.join(ASSETS, f);
    let s = fs.readFileSync(p, "utf8");
    const before = s;
    s = s.replaceAll("#4176e6", BEAM);
    s = s.replaceAll("#5686fe", BEAM);
    s = s.replaceAll("#7aaaff", BEAM_BRIGHT);
    s = s.replaceAll("#4868b2", BEAM_DEEP);
    if (s !== before) {
      fs.writeFileSync(p, s);
      console.log("  remapped", f);
    }
  }
}

// syntax check chat
{
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    process.execPath,
    ["--check", path.join(DSH, "dsh-client-ui-chat/lib/client.js")],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  console.log("✓ chat syntax ok");
}

console.log("✓ Thinking + brain + Beam teal applied");
