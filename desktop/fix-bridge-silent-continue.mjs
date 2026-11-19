/**
 * Repair stitched bridge/server.js and finish silent auto-continue wiring.
 * Safe string ops only (no brace-walking replaceFunction).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  path.join(ROOT, "desktop/bridge/server.js"),
  path.join(ROOT, "dist/Beam-Agent/bridge/server.js"),
];
const SNIP = path.join(ROOT, "desktop/bridge/_persona_dsml_snip.js");

const MARK = "BEAM_SILENT_AUTO_CONTINUE";

const MODELS_MODERN = `const MODELS = {
  tide: {
    id: 'tide',
    name: 'Tide',
    backend: 'deepseek-v4-1-flash',
    backends: ['deepseek-v4-1-flash', 'qwen3-8-flash', 'deepseek-v4-flash'],
    limit: 500_000,
    contextWindow: 1_048_576,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-1-flash', 'tide', 'auto'],
  },
  flare: {
    id: 'flare',
    name: 'Flare',
    backend: 'google/gemini-3.1-flash-lite',
    backends: ['google/gemini-3.1-flash-lite', 'gemini-3.8-flash', 'qwen3-8-flash', 'gemini-3.6-flash'],
    limit: 10_000,
    contextWindow: 1_048_576,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['flair', 'flare', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.8-flash-high'],
  },
  pine: {
    id: 'pine',
    name: 'Pine',
    backend: 'xai/grok-4.7',
    backends: ['xai/grok-4.7', 'deepseek-v4-pro-0813', 'google/gemini-3.6-flash-high', 'xai/grok-4.6'],
    limit: 1_000,
    contextWindow: 131_072,
    maxTokensCap: 65536,
    maxTokensDefault: 65536,
    aliases: ['pine', 'grok-4.7', 'xai/grok-4.7', 'deepseek-v4-pro', 'deepseek-v4-pro-0813'],
  },
}
`;

const CONTINUE_CONSTS = `/** Seamless multi-chunk generation when provider hits finish_reason=length or content looks truncated. */
const MAX_OUTPUT_CONTINUES = 8
const OUTPUT_CONTINUE_PROMPT =
  'Continue exactly where you left off. Do not repeat earlier text. Output only the continuation. Do not emit DSML/XML tool markup in the chat text — use structured tool calls only.'

function bridgeLog(line) {
  try { fs.appendFileSync(path.join(DATA_DIR, 'bridge.log'), \`[\${new Date().toISOString()}] \${line}\\n\`) } catch {}
}
`;

function extractDsmlRegion(snip) {
  const start = snip.indexOf("// #region beam-dsml-tool-leak");
  if (start < 0) throw new Error("dsml region missing in snip");
  // Prefer explicit endregion; else cut after looksTruncated's final `return false\n}`
  let end = snip.indexOf("// #endregion beam-dsml-tool-leak", start);
  if (end >= 0) {
    end = snip.indexOf("\n", end) + 1;
    return snip.slice(start, end);
  }
  const looks = snip.indexOf("function looksTruncated", start);
  if (looks < 0) throw new Error("looksTruncated missing in snip");
  const closer = snip.indexOf("\n  return false\n}", looks);
  if (closer < 0) throw new Error("looksTruncated end missing");
  const i = closer + "\n  return false\n}".length;
  return snip.slice(start, i) + "\n// #endregion beam-dsml-tool-leak\n";
}

function replaceFirst(s, old, neu, label) {
  const i = s.indexOf(old);
  if (i < 0) {
    console.warn("miss", label);
    return s;
  }
  return s.slice(0, i) + neu + s.slice(i + old.length);
}

function patchFile(file) {
  if (!fs.existsSync(file)) {
    console.warn("skip", file);
    return false;
  }
  let s = fs.readFileSync(file, "utf8");
  const snip = fs.readFileSync(SNIP, "utf8");
  const dsml = extractDsmlRegion(snip);

  // ROOT: desktop/bridge needs ../.. ; dist/Beam-Agent/bridge needs ..
  if (file.includes(`${path.sep}dist${path.sep}`)) {
    s = s.replace(
      /const ROOT = path\.resolve\(__dirname, '[^']+'\)/,
      "const ROOT = path.resolve(__dirname, '..')",
    );
  } else {
    s = s.replace(
      /const ROOT = path\.resolve\(__dirname, '[^']+'(?:, '[^']+')?\)/,
      "const ROOT = path.resolve(__dirname, '..', '..')",
    );
  }

  // Inject DSML if missing
  if (!s.includes("function createDsmlStreamGate")) {
    const anchor = "// #endregion beam-persona-bridge";
    if (!s.includes(anchor)) throw new Error("persona endregion missing: " + file);
    s = s.replace(anchor, anchor + "\n\n" + dsml + "\n");
    console.log("injected dsml", path.relative(ROOT, file));
  } else if (!s.includes("function looksTruncated")) {
    // has dsml gate but no looksTruncated — append hardened heuristic before endregion
    const looks = snip.slice(snip.indexOf("/** Heuristic:"));
    const end = s.indexOf("// #endregion beam-dsml-tool-leak");
    if (end >= 0) s = s.slice(0, end) + looks + "\n" + s.slice(end);
    else s += "\n" + looks + "\n";
  } else {
    // Replace looksTruncated with hardened version from snip (marker-based, no brace walk)
    const start = s.indexOf("function looksTruncated");
    const snipLooksStart = snip.indexOf("function looksTruncated");
    if (start >= 0 && snipLooksStart >= 0) {
      const endOld = s.indexOf("\n  return false\n}", start);
      const endNew = snip.indexOf("\n  return false\n}", snipLooksStart);
      if (endOld >= 0 && endNew >= 0) {
        let from = snipLooksStart;
        const before = snip.slice(Math.max(0, snipLooksStart - 220), snipLooksStart);
        const doc = before.lastIndexOf("/**");
        if (doc >= 0) from = Math.max(0, snipLooksStart - 220) + doc;
        const iOld = endOld + "\n  return false\n}".length;
        const jNew = endNew + "\n  return false\n}".length;
        s = s.slice(0, start) + snip.slice(from, jNew) + s.slice(iOld);
      }
    }
  }

  // Continue constants + bridgeLog
  if (!s.includes("const MAX_OUTPUT_CONTINUES")) {
    const afterModels = s.indexOf("const MODELS =");
    // insert after MODELS block — find next top-level const/function after MODELS closing
    const modelsStart = s.indexOf("{", afterModels);
    let i = modelsStart;
    let depth = 0;
    for (; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    s = s.slice(0, i) + "\n\n" + CONTINUE_CONSTS + s.slice(i);
    console.log("injected continue consts");
  } else if (!s.includes("function bridgeLog")) {
    s = s.replace(
      "const MAX_OUTPUT_CONTINUES = 8",
      CONTINUE_CONSTS.trimStart().replace(/^\/\*\*.*?\*\/\n/s, ""),
    );
  }

  // Upgrade MODELS if still old single-line style or missing maxTokensCap
  if (!s.includes("maxTokensCap: 65536")) {
    const start = s.indexOf("const MODELS =");
    if (start >= 0) {
      let i = s.indexOf("{", start);
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      s = s.slice(0, start) + MODELS_MODERN + s.slice(i);
      console.log("upgraded MODELS");
    }
  }

  // Fix callKumo to accept backends option (keep existing if already multi-backend)
  if (s.includes("async function callKumo(payload, { stream }) {") && !s.includes("backends")) {
    // leave simple callKumo; completeWithOutputContinues passes backends — wrap
    s = s.replace(
      "async function callKumo(payload, { stream }) {",
      "async function callKumo(payload, { stream, backends } = {}) {\n  void backends",
    );
  }

  // Wire handleMessages sync path to completeWithOutputContinues
  if (s.includes("if (!wantStream)") && !s.includes("completeWithOutputContinues(body, tier")) {
    const oldSyncStart = s.indexOf("  if (!wantStream) {");
    const streamComment = s.indexOf("  // Streaming Anthropic-compatible SSE", oldSyncStart);
    if (oldSyncStart >= 0 && streamComment > oldSyncStart) {
      const neuSync = `  if (!wantStream) {
    let completed
    try {
      completed = await completeWithOutputContinues(body, tier, { backends: tier.backends || [tier.backend] })
    } catch (e) {
      return sendJson(res, 502, {
        type: 'error',
        error: { type: 'api_error', message: e.message || 'Нет связи с модельным API' },
      })
    }
    if (completed.badJson) {
      bridgeLog(\`kumo_bad_json body=\${String(completed.errText || '').slice(0, 200)}\`)
      return sendJson(res, 502, { type: 'error', error: { type: 'api_error', message: 'Модели вернули некорректный ответ. Попробуйте ещё раз.' } })
    }
    if (!completed.upstream?.ok || !completed.content) {
      const raw = completed.errText || ''
      const status = completed.upstream?.status >= 400 ? completed.upstream.status : 502
      return sendJson(res, status, {
        type: 'error',
        error: { type: 'api_error', message: typeof kumoErrorMessage === 'function' ? kumoErrorMessage(status, raw) : (raw.slice(0, 500) || 'API error') },
      })
    }
    chargeTokens(state, tier.id, completed.usage)
    return sendJson(res, 200, {
      id: completed.id || \`msg_\${crypto.randomBytes(8).toString('hex')}\`,
      type: 'message',
      role: 'assistant',
      model: tier.id,
      content: completed.content,
      stop_reason: completed.stop,
      stop_sequence: null,
      usage: {
        input_tokens: completed.usage?.prompt_tokens || 0,
        output_tokens: completed.usage?.completion_tokens || 0,
      },
    })
  }

`;
      s = s.slice(0, oldSyncStart) + neuSync + s.slice(streamComment);
      console.log("wired sync completeWithOutputContinues");
    }
  }

  // Replace old stream body with silent continue loop if not present
  if (s.includes("// Streaming Anthropic-compatible SSE") && !s.includes("pipeOpenAiSseToAnthropic(upstream, res, streamState)")) {
    const streamStart = s.indexOf("  // Streaming Anthropic-compatible SSE");
    const serveLogin = s.indexOf("\nfunction serveLoginPage", streamStart);
    if (streamStart >= 0 && serveLogin > streamStart) {
      const neuStream = `  // Streaming Anthropic-compatible SSE (+ silent output continuation)
  /* ${MARK} */
  const kumoOpts = { backends: tier.backends || [tier.backend] }
  let upstream
  let openaiBody
  let errText = null
  try {
    ;({ upstream, openaiBody, errText } = await callKumoSanitized(body, tier, { stream: true, ...kumoOpts }))
  } catch (e) {
    return sendJson(res, 502, {
      type: 'error',
      error: { type: 'api_error', message: e.message || 'Нет связи с модельным API' },
    })
  }
  if (!upstream.ok) {
    const text = errText != null ? errText : await upstream.text()
    if (!errText) bridgeLog(\`kumo_stream_http status=\${upstream.status} body=\${text.slice(0, 200)}\`)
    const status = upstream.status >= 400 ? upstream.status : 502
    return sendJson(res, status, {
      type: 'error',
      error: { type: 'api_error', message: typeof kumoErrorMessage === 'function' ? kumoErrorMessage(status, text) : text.slice(0, 500) },
    })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const msgId = \`msg_\${crypto.randomBytes(8).toString('hex')}\`
  sseWrite(res, 'message_start', {
    type: 'message_start',
    message: {
      id: msgId,
      type: 'message',
      role: 'assistant',
      model: tier.id,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })

  let blockIndex = 0
  let textStarted = false
  let toolBuf = new Map()
  let usage = { prompt_tokens: 0, completion_tokens: 0 }
  let stopReason = 'end_turn'
  const streamState = { blockIndex, textStarted, toolBuf, usage }
  let accumulatedText = ''
  let continues = 0
  let continueFailed = false
  const baseOpenAIBody = openaiBody
  let pipe = await pipeOpenAiSseToAnthropic(upstream, res, streamState)
  accumulatedText += pipe.text
  stopReason = pipe.stopReason
  usage = streamState.usage

  while (
    !pipe.hadTools &&
    !pipe.hadDsml &&
    !dsmlLooksIncomplete(accumulatedText) &&
    continues < MAX_OUTPUT_CONTINUES &&
    (stopReason === 'max_tokens' || looksTruncated(accumulatedText)) /* ${MARK}:while */
  ) {
    continues += 1
    const beforeLen = accumulatedText.length
    const contBody = buildContinuationOpenAIBody(baseOpenAIBody, accumulatedText, KUMO_SAFE_BUDGET)
    bridgeLog(\`output_continue stream round=\${continues} chars=\${accumulatedText.length} reason=\${stopReason === 'max_tokens' ? 'max_tokens' : 'heuristic'}\`)
    let contUp
    try {
      contUp = await callKumo(contBody, { stream: true, backends: kumoOpts.backends || tier.backends || [tier.backend] })
    } catch (e) {
      bridgeLog(\`output_continue stream_fail \${e?.message || e}\`)
      continueFailed = true
      break
    }
    if (!contUp.ok) {
      const failBody = await contUp.text().catch(() => '')
      bridgeLog(\`output_continue stream_http status=\${contUp.status} body=\${failBody.slice(0, 200)}\`)
      continueFailed = true
      break
    }
    pipe = await pipeOpenAiSseToAnthropic(contUp, res, streamState)
    accumulatedText += pipe.text
    stopReason = pipe.stopReason
    usage = streamState.usage
    if (accumulatedText.length <= beforeLen) {
      bridgeLog('output_continue stream_no_progress')
      continueFailed = true
      break
    }
  }

  // /* ${MARK} */ Residual max_tokens only when silent path failed/exhausted.
  if (stopReason !== 'tool_use' && (
    stopReason === 'max_tokens' ||
    (looksTruncated(accumulatedText) && (continues >= MAX_OUTPUT_CONTINUES || continueFailed))
  )) {
    bridgeLog(\`output_continue stream_needs_user rounds=\${continues} chars=\${accumulatedText.length} truncated=\${looksTruncated(accumulatedText)} failed=\${!!continueFailed}\`)
    stopReason = 'max_tokens'
  } else if (stopReason !== 'tool_use') {
    stopReason = 'end_turn'
  }

  blockIndex = streamState.blockIndex
  textStarted = streamState.textStarted
  toolBuf = streamState.toolBuf

  if (textStarted) {
    sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  }
  for (const entry of toolBuf.values()) {
    sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: entry.anthropicIndex })
  }

  chargeTokens(state, tier.id, {
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || Math.max(1, [...toolBuf.values()].length),
  })

  sseWrite(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: usage.completion_tokens || 0 },
  })
  sseWrite(res, 'message_stop', { type: 'message_stop' })
  res.end()
}
`;
      s = s.slice(0, streamStart) + neuStream + s.slice(serveLogin);
      console.log("wired stream silent continue");
    }
  }

  // Harden sync needs_user
  s = s.replace(
    /\/\/ Keep max_tokens when still truncated so the client can offer «Продолжить»\.\s*\n\s*if \(stop === 'max_tokens' \|\| looksTruncated\(fullText\)\) \{\s*\n\s*bridgeLog\(`output_continue sync_needs_user rounds=\$\{continues\} chars=\$\{fullText\.length\} truncated=\$\{looksTruncated\(fullText\)\}`\)\s*\n\s*stop = 'max_tokens'\s*\n\s*\} else if \(stop !== 'tool_use'\) \{\s*\n\s*stop = 'end_turn'\s*\n\s*\}/,
    `// /* ${MARK} */ Surface Continue only after silent continues failed/exhausted.
  if (stop !== 'tool_use' && (
    stop === 'max_tokens' ||
    (looksTruncated(fullText) && (continues >= MAX_OUTPUT_CONTINUES || continueFailed))
  )) {
    bridgeLog(\`output_continue sync_needs_user rounds=\${continues} chars=\${fullText.length} truncated=\${looksTruncated(fullText)} failed=\${!!continueFailed}\`)
    stop = 'max_tokens'
  } else if (stop !== 'tool_use') {
    stop = 'end_turn'
  }`,
  );

  // Ensure continueFailed in sync loop
  if (s.includes("async function completeWithOutputContinues") && !s.includes("let continueFailed = false")) {
    s = s.replace(
      /let continues = 0\n  let lastId = data\.id/,
      "let continues = 0\n  let continueFailed = false\n  let lastId = data.id",
    );
    s = s.replace(
      /bridgeLog\(`output_continue sync_fail \$\{e\?\.message \|\| e\}`\)\n\s*break/,
      "bridgeLog(`output_continue sync_fail ${e?.message || e}`)\n      continueFailed = true\n      break",
    );
    s = s.replace(
      /bridgeLog\(`output_continue sync_http status=\$\{contUp\.status\} body=\$\{contText\.slice\(0, 200\)\}`\)\n\s*break/,
      "bridgeLog(`output_continue sync_http status=${contUp.status} body=${contText.slice(0, 200)}`)\n      continueFailed = true\n      break",
    );
    s = s.replace(
      /bridgeLog\('output_continue sync_bad_json'\)\n\s*break/,
      "bridgeLog('output_continue sync_bad_json')\n      continueFailed = true\n      break",
    );
    s = s.replace(
      /bridgeLog\('output_continue sync_no_progress'\)\n\s*break/,
      "bridgeLog('output_continue sync_no_progress')\n      continueFailed = true\n      break",
    );
  }

  // Prefer not to always force end_turn on cap in older completeWithOutputContinues
  s = s.replace(
    /\/\/ After seamless continues, never surface max_tokens to the desktop \(orange banner\)\.\s*\n\s*if \(stop === 'max_tokens'\) \{\s*\n\s*bridgeLog\(`output_continue sync_cap_reached rounds=\$\{continues\} chars=\$\{fullText\.length\}`\)\s*\n\s*stop = 'end_turn'\s*\n\s*\}/,
    `// /* ${MARK} */ keep max_tokens only when still truncated after silent path
  if (stop !== 'tool_use' && (
    stop === 'max_tokens' ||
    (typeof looksTruncated === 'function' && looksTruncated(fullText) && (continues >= MAX_OUTPUT_CONTINUES || continueFailed))
  )) {
    bridgeLog(\`output_continue sync_needs_user rounds=\${continues} chars=\${fullText.length}\`)
    stop = 'max_tokens'
  } else if (stop !== 'tool_use') {
    stop = 'end_turn'
  }`,
  );

  fs.writeFileSync(file, s);
  console.log("wrote", path.relative(ROOT, file), s.length);
  return true;
}

for (const f of FILES) {
  try {
    patchFile(f);
  } catch (e) {
    console.error("FAIL", f, e.message);
  }
}

// sanity
const s = fs.readFileSync(FILES[0], "utf8");
const report = {
  hasDsml: s.includes("createDsmlStreamGate"),
  hasLooks: s.includes("function looksTruncated"),
  hasMAX: s.includes("MAX_OUTPUT_CONTINUES"),
  hasPrompt: s.includes("OUTPUT_CONTINUE_PROMPT"),
  hasBridgeLog: s.includes("function bridgeLog"),
  hasStreamPipe: s.includes("pipeOpenAiSseToAnthropic(upstream, res, streamState)"),
  hasSyncComplete: s.includes("completeWithOutputContinues(body, tier"),
  hasNeedsUser: s.includes("stream_needs_user") || s.includes("sync_needs_user"),
  hasMaxTokensCap: s.includes("maxTokensCap: 65536"),
  mark: s.includes(MARK),
};
console.log(JSON.stringify(report, null, 2));
