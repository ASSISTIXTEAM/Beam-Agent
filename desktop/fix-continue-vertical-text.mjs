/**
 * Fix Continue / max-tokens notice rendering as vertical single glyphs.
 *
 * Cause: TurnMaxTokensItem reused MessageItem `.turnErrorRow` which is
 * `display:grid; grid-template-columns: 10px minmax(0,1fr) auto` for
 * [dot | copy | code]. Continue only mounts the copy cell → it lands in the
 * 10px first track → word-wrap stacks every character + button letters.
 *
 * Applies: chat clients + beam-override.css (runtime + dist).
 * No BEAM_BASE_URL / .env writes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_CONTINUE_LAYOUT_FIX";

const CHAT_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
];

const CSS_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
];

const CSS_BLOCK = `
/* ===== ${MARK} ===== */
/* Continue notice must NOT use turnErrorRow's 10px | 1fr | auto grid */
[data-beam-continue="1"],
[data-beam-continue] {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 8px !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  grid-template-columns: none !important;
  box-sizing: border-box !important;
}
[data-beam-continue="1"] [class*="turnErrorCopy"],
[data-beam-continue] [class*="turnErrorCopy"] {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
  white-space: normal !important;
}
[data-beam-continue="1"] [class*="turnErrorMessage"],
[data-beam-continue] [class*="turnErrorMessage"] {
  display: block !important;
  width: auto !important;
  max-width: 100% !important;
  white-space: normal !important;
  overflow-wrap: break-word !important;
  word-break: normal !important;
  writing-mode: horizontal-tb !important;
}
[data-beam-continue="1"] button,
[data-beam-continue] button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 7.5rem !important;
  max-width: none !important;
  white-space: nowrap !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  writing-mode: horizontal-tb !important;
  align-self: flex-start !important;
}
/* ===== /${MARK} ===== */
`;

const NEW_CONTINUE_RETURN = `return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.turnErrorRow,
				role: "status",
				"data-beam-continue": "1",
				style: {
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					gap: 8,
					width: "100%",
					maxWidth: "100%",
					minWidth: 0,
					gridTemplateColumns: "none"
				},
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: MessageItem_module_css_default.turnErrorCopy,
					style: {
						display: "flex",
						flexDirection: "column",
						alignItems: "flex-start",
						width: "100%",
						maxWidth: "100%",
						minWidth: 0
					},
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: MessageItem_module_css_default.turnErrorMessage,
						style: {
							display: "block",
							width: "auto",
							maxWidth: "100%",
							whiteSpace: "normal",
							overflowWrap: "break-word",
							wordBreak: "normal",
							writingMode: "horizontal-tb"
						},
						children: t("message.continue.hint")
					}), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: busy,
						onClick: onContinue,
						style: {
							marginTop: 8,
							alignSelf: "flex-start",
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: "auto",
							minWidth: "7.5rem",
							whiteSpace: "nowrap",
							overflowWrap: "normal",
							wordBreak: "normal",
							writingMode: "horizontal-tb",
							border: "1px solid rgba(0,179,188,.45)",
							background: "rgba(0,179,188,.14)",
							color: "var(--dsw-alias-label-primary, #e8f7f5)",
							borderRadius: 10,
							padding: "6px 14px",
							fontSize: 13,
							fontWeight: 600,
							cursor: busy ? "wait" : "pointer"
						},
						children: busy ? t("message.continue.working") : t("message.continue")
					})]
				})]
			}); /* ${MARK} */`;

function uniqPaths(paths) {
  const seen = new Set();
  const out = [];
  for (const rel of paths) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.log("skip missing", rel);
      continue;
    }
    let key;
    try {
      key = fs.realpathSync(abs);
    } catch {
      key = abs;
    }
    if (seen.has(key)) {
      console.log("skip dup", rel);
      continue;
    }
    seen.add(key);
    out.push({ rel, abs });
  }
  return out;
}

function patchChat({ rel, abs }) {
  let s = fs.readFileSync(abs, "utf8");
  if (s.includes(MARK) && s.includes('gridTemplateColumns: "none"')) {
    console.log("chat already", rel);
    return false;
  }
  // Replace TurnMaxTokensItem return block (from return jsxs turnErrorRow ... to closing);)
  const startMark = 'return (0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\tclassName: MessageItem_module_css_default.turnErrorRow,\n\t\t\t\trole: "status",\n\t\t\t\t"data-beam-continue": "1",';
  const i = s.indexOf(startMark);
  if (i < 0) {
    console.warn("continue return miss", rel);
    return false;
  }
  // Find end of this return — next `});` after the button children that closes TurnMaxTokensItem return
  const after = s.slice(i);
  const endRel = after.indexOf("\n\t\t}\n\t\t/** Right-aligned bubble");
  const endRel2 = after.indexOf("\n\t\t}\n\t\tfunction UserStyleBubble");
  let end = endRel >= 0 ? endRel : endRel2;
  if (end < 0) {
    // fallback: close at first `});` sequence ending TurnMaxTokensItem
    const m = after.match(/\n\t\t\}\n\t\t\/\*\* Right-aligned/);
    if (!m) {
      console.warn("continue end miss", rel);
      return false;
    }
    end = m.index;
  }
  // The return ends just before the closing `}` of the function — include through `);` of return
  const block = after.slice(0, end);
  // block should end with `);` or `); /* mark */`
  const retEnd = block.lastIndexOf(");");
  if (retEnd < 0) {
    console.warn("return end miss", rel);
    return false;
  }
  s = s.slice(0, i) + NEW_CONTINUE_RETURN + after.slice(end);
  fs.writeFileSync(abs, s);
  console.log("chat patched", rel);
  return true;
}

function patchCss({ rel, abs }) {
  let s = fs.readFileSync(abs, "utf8");
  if (s.includes(`/* ===== ${MARK} ===== */`)) {
    // refresh block
    s = s.replace(
      new RegExp(`/\\* ===== ${MARK} ===== \\*/[\\s\\S]*?/\\* ===== /${MARK} ===== \\*/\\s*`),
      CSS_BLOCK.trim() + "\n",
    );
  } else {
    s = s.trimEnd() + "\n" + CSS_BLOCK;
  }
  fs.writeFileSync(abs, s);
  console.log("css patched", rel);
  return true;
}

let n = 0;
for (const p of uniqPaths(CHAT_FILES)) if (patchChat(p)) n++;
for (const p of uniqPaths(CSS_FILES)) if (patchCss(p)) n++;
console.log("done", n);
