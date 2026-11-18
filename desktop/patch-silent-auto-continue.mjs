/**
 * Silent auto-continue: bridge keeps chaining invisibly; UI Continue is fallback only.
 *
 * Layer A (bridge): harden looksTruncated + only surface max_tokens after silent
 *   continues fail/exhaust (never force Continue on clean end_turn + soft prose).
 * Layer B (chat UI): when residual turn-max-tokens lands on the latest turn,
 *   auto-fire continueReply once with no banner; show Continue only if that fails.
 *   Hide system continue prompts from the user transcript bubbles.
 *
 * Targets: desktop/bridge + dist bridge, assistix + deepseek chat clients (runtime + dist).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MARK = "BEAM_SILENT_AUTO_CONTINUE";

const BRIDGE_FILES = [
  "desktop/bridge/server.js",
  "dist/Beam Agent/bridge/server.js",
];

const CHAT_FILES = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
];

const LOOKS_TRUNCATED_NEW = `/** Heuristic: reply interrupted mid-structure (NOT DSML — that becomes tool_use).
 * Hard signals only — no soft prose (ellipsis / "Вывод:") false positives. */
function looksTruncated(text) {
  const raw = String(text || '')
  if (!raw.trim()) return false
  if (typeof dsmlPresent === 'function' && dsmlPresent(raw)) return false
  const fences = (raw.match(/\`\`\`/g) || []).length
  if (fences % 2 === 1) return true
  const tail = raw.trimEnd().slice(-160)
  // Structural code/math cutoffs — not academic prose punctuation.
  if (/[=+\\-*/%<>]\\s*$/.test(tail)) return true
  if (/[(\\[{]\\s*$/.test(tail)) return true
  if (/\\\\\\s*$/.test(tail)) return true
  if (/\\b(?:def|class|function|return|import|from|const|let|var|async|await|if|for|while|with|elif|else|try|catch|except|finally|then|do)\\s*$/.test(tail)) return true
  if (/["'\`]$/.test(tail) && (tail.match(/["'\`]/g) || []).length % 2 === 1) {
    if (/\`\`\`|^\\s{2,}|[{};=]/.test(tail)) return true
  }
  return false
}
`;

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

function replaceFunction(src, name, nextFn) {
  // Marker-based only — NEVER brace-walk (regex char classes like [{] corrupt the file).
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return null;
  if (name === "looksTruncated") {
    const marker = "\n  return false\n}";
    const end = src.indexOf(marker, start);
    if (end < 0) return null;
    let from = start;
    const before = src.slice(Math.max(0, start - 220), start);
    const doc = before.lastIndexOf("/**");
    if (doc >= 0) from = Math.max(0, start - 220) + doc;
    return src.slice(0, from) + nextFn + src.slice(end + marker.length);
  }
  return null;
}

function patchBridgeNeedsUser(s, kind) {
  // kind: 'sync' | 'stream'
  if (kind === "sync") {
    const old = `  // Keep max_tokens when still truncated so the client can offer «Продолжить».
  // Never ask the user to continue raw DSML/tool soup — that becomes tool_use above.
  if (stop !== 'tool_use' && (stop === 'max_tokens' || looksTruncated(fullText))) {
    bridgeLog(\`output_continue sync_needs_user rounds=\${continues} chars=\${fullText.length} truncated=\${looksTruncated(fullText)}\`)
    stop = 'max_tokens'
  } else if (stop !== 'tool_use') {
    stop = 'end_turn'
  }`;
    const neu = `  // /* ${MARK} */ Surface Continue only after silent continues failed/exhausted.
  // Never ask the user to continue raw DSML/tool soup — that becomes tool_use above.
  // Do NOT force max_tokens on clean end_turn just because prose "looks" soft-truncated.
  if (stop !== 'tool_use' && (
    stop === 'max_tokens' ||
    (looksTruncated(fullText) && (continues >= MAX_OUTPUT_CONTINUES || continueFailed))
  )) {
    bridgeLog(\`output_continue sync_needs_user rounds=\${continues} chars=\${fullText.length} truncated=\${looksTruncated(fullText)} failed=\${!!continueFailed}\`)
    stop = 'max_tokens'
  } else if (stop !== 'tool_use') {
    stop = 'end_turn'
  }`;
    if (s.includes(old)) return s.replace(old, neu);
    if (s.includes(`sync_needs_user`) && s.includes(MARK) && s.includes("continueFailed")) return s;
    // Already partially updated — try looser replace
    if (s.includes("sync_needs_user") && !s.includes("continueFailed")) {
      const looser = /\/\/ Keep max_tokens when still truncated[\s\S]*?else if \(stop !== 'tool_use'\) \{\s*stop = 'end_turn'\s*\}/;
      if (looser.test(s)) return s.replace(looser, neu.trim());
    }
    return s;
  }

  const oldStream = `  // Still truncated after silent continues → max_tokens so UI shows «Продолжить».
  // Never surface continue for DSML/tool work — that was converted to tool_use above.
  if (stopReason !== 'tool_use' && (stopReason === 'max_tokens' || looksTruncated(accumulatedText))) {
    bridgeLog(\`output_continue stream_needs_user rounds=\${continues} chars=\${accumulatedText.length} truncated=\${looksTruncated(accumulatedText)}\`)
    stopReason = 'max_tokens'
  } else if (stopReason !== 'tool_use') {
    stopReason = 'end_turn'
  }`;
  const neuStream = `  // /* ${MARK} */ Residual max_tokens only when silent path failed/exhausted.
  // Never surface continue for DSML/tool work — that was converted to tool_use above.
  if (stopReason !== 'tool_use' && (
    stopReason === 'max_tokens' ||
    (looksTruncated(accumulatedText) && (continues >= MAX_OUTPUT_CONTINUES || continueFailed))
  )) {
    bridgeLog(\`output_continue stream_needs_user rounds=\${continues} chars=\${accumulatedText.length} truncated=\${looksTruncated(accumulatedText)} failed=\${!!continueFailed}\`)
    stopReason = 'max_tokens'
  } else if (stopReason !== 'tool_use') {
    stopReason = 'end_turn'
  }`;
  if (s.includes(oldStream)) return s.replace(oldStream, neuStream);
  if (s.includes("stream_needs_user") && s.includes(MARK) && s.includes("continueFailed")) return s;
  const looser = /\/\/ Still truncated after silent continues[\s\S]*?else if \(stopReason !== 'tool_use'\) \{\s*stopReason = 'end_turn'\s*\}/;
  if (looser.test(s)) return s.replace(looser, neuStream.trim());
  return s;
}

function ensureContinueFailedInLoop(s, label) {
  // Insert continueFailed tracking into sync/stream continue loops.
  if (label === "sync") {
    if (s.includes("let continueFailed = false") && s.includes("completeWithOutputContinues")) {
      // ok if already present near sync path
    }
    const anchor = `  let continues = 0\n  let lastId = data.id\n  const baseOpenAIBody = openaiBody`;
    if (s.includes(anchor) && !s.includes("let continueFailed = false\n  let lastId = data.id")) {
      s = s.replace(
        anchor,
        `  let continues = 0\n  let continueFailed = false\n  let lastId = data.id\n  const baseOpenAIBody = openaiBody`,
      );
    }
    s = s.replace(
      /bridgeLog\(`output_continue sync_fail \$\{e\?\.message \|\| e\}`\)\n\s*break/,
      `bridgeLog(\`output_continue sync_fail \${e?.message || e}\`)\n      continueFailed = true\n      break`,
    );
    s = s.replace(
      /bridgeLog\(`output_continue sync_http status=\$\{contUp\.status\} body=\$\{contText\.slice\(0, 200\)\}`\)\n\s*break/,
      `bridgeLog(\`output_continue sync_http status=\${contUp.status} body=\${contText.slice(0, 200)}\`)\n      continueFailed = true\n      break`,
    );
    s = s.replace(
      /bridgeLog\('output_continue sync_bad_json'\)\n\s*break/,
      `bridgeLog('output_continue sync_bad_json')\n      continueFailed = true\n      break`,
    );
    s = s.replace(
      /bridgeLog\('output_continue sync_no_progress'\)\n\s*break/,
      `bridgeLog('output_continue sync_no_progress')\n      continueFailed = true\n      break`,
    );
    return s;
  }

  const streamAnchor = `  let accumulatedText = ''\n  let continues = 0\n  const baseOpenAIBody = openaiBody`;
  if (s.includes(streamAnchor)) {
    s = s.replace(
      streamAnchor,
      `  let accumulatedText = ''\n  let continues = 0\n  let continueFailed = false\n  const baseOpenAIBody = openaiBody`,
    );
  }
  s = s.replace(
    /bridgeLog\(`output_continue stream_fail \$\{e\?\.message \|\| e\}`\)\n\s*break/,
    `bridgeLog(\`output_continue stream_fail \${e?.message || e}\`)\n      continueFailed = true\n      break`,
  );
  s = s.replace(
    /bridgeLog\(`output_continue stream_http status=\$\{contUp\.status\} body=\$\{failBody\.slice\(0, 200\)\}`\)\n\s*break/,
    `bridgeLog(\`output_continue stream_http status=\${contUp.status} body=\${failBody.slice(0, 200)}\`)\n      continueFailed = true\n      break`,
  );
  s = s.replace(
    /bridgeLog\('output_continue stream_no_progress'\)\n\s*break/,
    `bridgeLog('output_continue stream_no_progress')\n      continueFailed = true\n      break`,
  );
  return s;
}

function patchBridge({ rel, abs }) {
  let s = fs.readFileSync(abs, "utf8");
  let changed = false;

  const next = replaceFunction(s, "looksTruncated", LOOKS_TRUNCATED_NEW);
  if (next && next !== s) {
    s = next;
    changed = true;
  }

  const beforeFail = s;
  s = ensureContinueFailedInLoop(s, "sync");
  s = ensureContinueFailedInLoop(s, "stream");
  if (s !== beforeFail) changed = true;

  const beforeNeeds = s;
  s = patchBridgeNeedsUser(s, "sync");
  s = patchBridgeNeedsUser(s, "stream");
  if (s !== beforeNeeds) changed = true;

  // While: keep max_tokens OR hard truncated (looksTruncated is now hard-only)
  if (!s.includes(`/* ${MARK}:while */`)) {
    // already uses looksTruncated — mark for idempotency
    if (s.includes("(stop === 'max_tokens' || looksTruncated(fullText))")) {
      s = s.replace(
        "(stop === 'max_tokens' || looksTruncated(fullText))",
        `(stop === 'max_tokens' || looksTruncated(fullText)) /* ${MARK}:while */`,
      );
      changed = true;
    }
    if (s.includes("(stopReason === 'max_tokens' || looksTruncated(accumulatedText))")) {
      s = s.replace(
        "(stopReason === 'max_tokens' || looksTruncated(accumulatedText))",
        `(stopReason === 'max_tokens' || looksTruncated(accumulatedText)) /* ${MARK}:while */`,
      );
      changed = true;
    }
  }

  if (!changed && s.includes(MARK)) {
    console.log("bridge already", rel);
    return false;
  }
  if (!changed) {
    console.warn("bridge no-op?", rel);
    return false;
  }
  fs.writeFileSync(abs, s);
  console.log("bridge patched", rel);
  return true;
}

const CONTINUE_PROMPT =
  "Продолжи с того места, где остановился. Не повторяй уже написанное. Не выводи DSML/XML служебные теги в чат.";

const TURN_MAX_TOKENS_ITEM_NEW = `function TurnMaxTokensItem({ t, continueReply, autoSilent = false, turnKey = null }) {
			/* ${MARK} */
			const [phase, setPhase] = (0, react.useState)(autoSilent ? "silent" : "manual");
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!autoSilent || phase !== "silent") return;
				const key = turnKey == null ? "anon" : String(turnKey);
				if (globalThis.__beamSilentContinueDone instanceof Set && globalThis.__beamSilentContinueDone.has(key)) {
					setPhase("manual");
					return;
				}
				if (!(globalThis.__beamSilentContinueDone instanceof Set)) globalThis.__beamSilentContinueDone = new Set();
				globalThis.__beamSilentContinueDone.add(key);
				let cancelled = false;
				(async () => {
					if (typeof continueReply !== "function") {
						if (!cancelled) setPhase("manual");
						return;
					}
					setBusy(true);
					try {
						await continueReply();
						await new Promise((r) => setTimeout(r, 2800));
						if (!cancelled) setPhase("manual");
					} catch {
						if (!cancelled) setPhase("manual");
					} finally {
						if (!cancelled) setBusy(false);
					}
				})();
				return () => {
					cancelled = true;
				};
			}, [autoSilent, continueReply, turnKey, phase]);
			const onContinue = (0, react.useCallback)(async () => {
				if (busy) return;
				setBusy(true);
				try {
					if (typeof continueReply === "function") await continueReply();
				} catch {} finally {
					setBusy(false);
				}
			}, [busy, continueReply]);
			if (phase === "silent") return null;
			/* BEAM_CONTINUE_LAYOUT_FIX: do not reuse turnErrorRow 10px|1fr|auto grid — only one child would squeeze into 10px and stack glyphs. */
			return (0, react_jsx_runtime.jsxs)("div", {
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
			});
		}`;

const TURN_MAX_TOKENS_VIEW_NEW = `const TurnMaxTokensNodeView = (0, react.memo)(function TurnMaxTokensNodeView({ t, continueReply, node, useChat }) {
			/* ${MARK} */
			const autoSilent = typeof useChat === "function" ? useChat((snapshot) => {
				const last = snapshot?.timeline?.turnOrder?.at?.(-1);
				return last === node?.data?.turn;
			}) : false;
			const turnKey = node?.data ? \`\${node.data.turn}:\${node.data.seq}\` : null;
			return (0, react_jsx_runtime.jsx)(TurnMaxTokensItem, {
				t,
				continueReply,
				autoSilent,
				turnKey
			});
		});`;

function replaceTurnMaxTokensItem(s) {
  const start = s.indexOf("function TurnMaxTokensItem({");
  if (start < 0) return s;
  const endMark = "\n\t\t/** Right-aligned bubble shared by user and steering rows. */";
  const end = s.indexOf(endMark, start);
  if (end < 0) return s;
  return s.slice(0, start) + TURN_MAX_TOKENS_ITEM_NEW + s.slice(end);
}

function replaceTurnMaxTokensView(s) {
  const start = s.indexOf("const TurnMaxTokensNodeView = (0, react.memo)(function TurnMaxTokensNodeView");
  if (start < 0) return s;
  const endMark = "\n\t\t/** Explicit unknown-surface keyed Chat renderer. */";
  const end = s.indexOf(endMark, start);
  if (end < 0) return s;
  return s.slice(0, start) + TURN_MAX_TOKENS_VIEW_NEW + s.slice(end);
}

function patchHideContinueBubbles(s) {
  if (s.includes(`/* ${MARK}:hide-continue-bubble */`)) return s;

  const helper = `
		/* ${MARK}:hide-continue-bubble */
		function __beamIsSystemContinuePrompt(content) {
			try {
				const parts = contentParts(content);
				const text = String(parts?.text || "").trim();
				if (!text) return false;
				if (parts?.attachments?.length) return false;
				if (parts?.rest?.length) return false;
				return /Продолжи с того места|Continue exactly where you left off|Continue from where you left off/i.test(text);
			} catch {
				return false;
			}
		}
`;

  // Insert helper just before UserStyleBubble
  const anchor = "\t\t/** Right-aligned bubble shared by user and steering rows. */\n\t\tfunction UserStyleBubble";
  if (s.includes(anchor) && !s.includes("__beamIsSystemContinuePrompt")) {
    s = s.replace(anchor, helper + "\t\t/** Right-aligned bubble shared by user and steering rows. */\n\t\tfunction UserStyleBubble");
  }

  const userViewOld = `const UserMessageNodeView = (0, react.memo)(function UserMessageNodeView({ node, renderFactorySlot, loadImage, t }) {
			const data = node.data;
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {`;
  const userViewNew = `const UserMessageNodeView = (0, react.memo)(function UserMessageNodeView({ node, renderFactorySlot, loadImage, t }) {
			const data = node.data;
			if (typeof __beamIsSystemContinuePrompt === "function" && __beamIsSystemContinuePrompt(data.content)) return null;
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {`;
  if (s.includes(userViewOld)) s = s.replace(userViewOld, userViewNew);

  // Hide pending submission echoes for continue prompts
  const pendingOld = `function PendingSubmissionBubble({ submission, loadImage, renderFactorySlot, t }) {
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {`;
  const pendingNew = `function PendingSubmissionBubble({ submission, loadImage, renderFactorySlot, t }) {
			if (/Продолжи с того места|Continue exactly where you left off|Continue from where you left off/i.test(String(submission?.text || ""))) return null;
			return (0, react_jsx_runtime.jsx)(UserStyleBubble, {`;
  if (s.includes(pendingOld)) s = s.replace(pendingOld, pendingNew);

  return s;
}

function patchContinueReplyMarker(s) {
  // Keep prompt text; ensure continueReply path is identifiable (already matches hide regex).
  const needle = `text: "${CONTINUE_PROMPT}"`;
  if (!s.includes(needle) && !s.includes("Продолжи с того места, где остановился")) {
    console.warn("continueReply prompt missing");
  }
  return s;
}

function patchChat({ rel, abs }) {
  let s = fs.readFileSync(abs, "utf8");
  if (s.includes(MARK) && s.includes("autoSilent") && s.includes("__beamIsSystemContinuePrompt")) {
    console.log("chat already", rel);
    return false;
  }
  s = replaceTurnMaxTokensItem(s);
  s = replaceTurnMaxTokensView(s);
  s = patchHideContinueBubbles(s);
  s = patchContinueReplyMarker(s);
  if (!s.includes(MARK)) {
    console.warn("chat patch incomplete", rel);
    return false;
  }
  fs.writeFileSync(abs, s);
  console.log("chat patched", rel);
  return true;
}

let n = 0;
for (const f of uniqPaths(BRIDGE_FILES)) if (patchBridge(f)) n++;
for (const f of uniqPaths(CHAT_FILES)) if (patchChat(f)) n++;
console.log(JSON.stringify({ ok: true, patched: n, mark: MARK }));
