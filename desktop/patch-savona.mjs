/**
 * Embed Savona (all weights + italics) into Beam Agent UI.
 * Applies to chat/UI prose via design tokens + selectors.
 * Keeps monospace for code/pre/terminal chips; does not override icon/KaTeX fonts.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const SRC_CANDIDATES = [
  path.join(
    process.env.USERPROFILE || "C:/Users/Alexa",
    ".beam/default-workspace/assistix-chat/assets/fonts/savona"
  ),
  path.join(ROOT, "assets/fonts/savona"),
];

const ASSET_DIRS = [
  path.join(
    ROOT,
    "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets"
  ),
  path.join(
    ROOT,
    "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets"
  ),
  path.join(
    ROOT,
    "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets"
  ),
  path.join(
    ROOT,
    "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets"
  ),
];

const faces = [
  ["Thin", 100, "normal"],
  ["ThinItalic", 100, "italic"],
  ["UltraLight", 200, "normal"],
  ["UltraLightItalic", 200, "italic"],
  ["Light", 300, "normal"],
  ["LightItalic", 300, "italic"],
  ["Regular", 400, "normal"],
  ["RegularItalic", 400, "italic"],
  ["Medium", 500, "normal"],
  ["MediumItalic", 500, "italic"],
  ["Semibold", 600, "normal"],
  ["SemiboldItalic", 600, "italic"],
  ["Bold", 700, "normal"],
  ["BoldItalic", 700, "italic"],
  ["Extrabold", 800, "normal"],
  ["ExtraboldItalic", 800, "italic"],
  ["Heavy", 850, "normal"],
  ["HeavyItalic", 850, "italic"],
  ["Black", 900, "normal"],
  ["BlackItalic", 900, "italic"],
];

const SAVONA_STACK = `"Savona", "Segoe UI", system-ui, sans-serif`;
const MONO_STACK = `ui-monospace, "SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, monospace`;

const SRC = SRC_CANDIDATES.find((p) => fs.existsSync(p));
if (!SRC) {
  console.error("Savona source fonts not found in:", SRC_CANDIDATES);
  process.exit(1);
}

function copyFonts(fontDir) {
  fs.mkdirSync(fontDir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(SRC)) {
    if (/\.(woff2|woff)$/i.test(f)) {
      fs.copyFileSync(path.join(SRC, f), path.join(fontDir, f));
      n++;
    }
  }
  return n;
}

function buildFaceCss(fontDir) {
  return faces
    .map(([name, weight, style]) => {
      const w2 = `./fonts/savona/Savona-${name}.woff2`;
      const w1 = `./fonts/savona/Savona-${name}.woff`;
      const hasW2 = fs.existsSync(path.join(fontDir, `Savona-${name}.woff2`));
      const hasW1 = fs.existsSync(path.join(fontDir, `Savona-${name}.woff`));
      if (!hasW2 && !hasW1) return "";
      const src = [
        hasW2 ? `url("${w2}") format("woff2")` : null,
        hasW1 ? `url("${w1}") format("woff")` : null,
      ]
        .filter(Boolean)
        .join(",\n       ");
      return `@font-face {
  font-family: "Savona";
  src: ${src};
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`;
    })
    .filter(Boolean)
    .join("\n");
}

const applyCss = `
/* ===== Savona UI + chat prose (keep mono for code) ===== */
:root,
html,
body,
body[data-ds-dark-theme],
:root[data-theme="dark"],
html.dark,
html[data-theme="dark"] body {
  --font-ui: ${SAVONA_STACK} !important;
  --dsh-font-family-text-default: ${SAVONA_STACK} !important;
  --dsw-font-family: ${SAVONA_STACK} !important;
  --dsw-font-sans: ${SAVONA_STACK} !important;
  --dsw-font-family-brand: "Savona", "Montserrat", "Segoe UI", system-ui, sans-serif !important;
  --dsw-font-markdown-base-font-family: ${SAVONA_STACK} !important;
}

html, body, #root {
  font-family: ${SAVONA_STACK} !important;
}

/* Chat markdown / message bubbles / UI chrome prose */
[class*="markdown"],
[class*="Markdown"],
[class*="messageBody"],
[class*="MessageBody"],
[class*="messageContent"],
[class*="MessageContent"],
[class*="prose"],
[class*="chatTurn"],
[class*="ChatTurn"],
[class*="assistantMessage"],
[class*="userMessage"],
[class*="chatMessage"],
[class*="bubble"] [class*="content"],
[class*="Bubble"] [class*="content"],
[data-message-role],
[data-role="assistant"],
[data-role="user"],
button, input, textarea, select, option, label,
[class*="titleGroup"],
[class*="sidebar"],
[class*="Sidebar"],
[class*="composer"],
[class*="Composer"],
[class*="settings"],
[class*="Settings"],
[class*="menu"],
[class*="Menu"],
[class*="dialog"],
[class*="Dialog"],
[class*="modal"],
[class*="Modal"],
[class*="tooltip"],
[class*="Tooltip"],
[class*="toast"],
[class*="Toast"],
#beam-auth-gate,
#beam-limits-panel,
#beam-side-limits {
  font-family: ${SAVONA_STACK} !important;
}

/* Explicit monospace — inline code pills, blocks, terminal, tokens */
code,
pre,
kbd,
samp,
tt,
.token,
[class*="token"],
[class*="inlineCode"],
[class*="InlineCode"],
[class*="codeBlock"],
[class*="CodeBlock"],
[class*="codeChip"],
[class*="CodeChip"],
[class*="mono"],
[class*="Mono"],
[class*="terminal"],
[class*="Terminal"],
[class*="xterm"],
.cm-editor,
.cm-content,
.cm-line,
.monaco-editor,
.monaco-editor *,
[class*="language-"],
[data-code],
[data-language] {
  font-family: ${MONO_STACK} !important;
}

/* Intentionally omit .katex / icon-font selectors so their @font-face stacks stay intact */
`;

function patchCss(cssPath, fontDir) {
  let css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

  // Remove prior Savona apply / face blocks so re-runs are idempotent
  css = css.replace(/\/\* ===== Savona[\s\S]*?(?=\/\* =====|$)/g, "");
  css = css.replace(/\/\* Savona[\s\S]*?(?=@font-face|:root|\/\* =====|$)/g, "");
  css = css.replace(/@font-face\s*\{\s*font-family:\s*"Savona";[\s\S]*?\}\s*/g, "");

  const faceCss = buildFaceCss(fontDir);
  css = `/* Savona — Assistix brand typeface (all weights) */\n${faceCss}\n${applyCss}\n${css}`;
  fs.writeFileSync(cssPath, css);
  return {
    faces: (faceCss.match(/@font-face/g) || []).length,
    bytes: css.length,
  };
}

// Keep project assets copy in sync
const projectFonts = path.join(ROOT, "assets/fonts/savona");
copyFonts(projectFonts);

for (const assets of ASSET_DIRS) {
  if (!fs.existsSync(assets)) {
    console.log("skip missing:", assets);
    continue;
  }
  const fontDir = path.join(assets, "fonts", "savona");
  const copied = copyFonts(fontDir);
  const cssPath = path.join(assets, "beam-override.css");
  const result = patchCss(cssPath, fontDir);
  console.log(
    "patched",
    path.relative(ROOT, assets),
    `| fonts ${copied} | @font-face ${result.faces} | css ${result.bytes}b`
  );
}

console.log("Savona source:", SRC);
console.log("Done. Reload the Beam Agent window to pick up CSS/fonts.");
