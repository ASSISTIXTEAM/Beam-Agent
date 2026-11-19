/**
 * Stop DeepSeek DSML tool XML + file payloads from dumping into Beam chat prose.
 *
 * Root cause: Tide (deepseek-v4*) emits tool calls as DSML text
 *   <｜DSML｜ calls>…<｜DSML｜ invoke>…</｜DSML｜ calls>
 * Kumo often returns that as delta.content instead of structured tool_calls.
 * Bridge was forwarding it as Anthropic text_delta → chat wall of code/XML.
 * Harness parses DSML into tool rows (collapsed process UI). Match that.
 *
 * Applies: desktop+dist bridge, runtime+dist chat clients, persona hygiene.
 * Does NOT write BEAM_BASE_URL into .env.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const BRIDGE_MARK = 'beam-dsml-tool-leak'
const CHAT_MARK = 'BEAM_DSML_DISPLAY_SCRUB'

const DSML_REGION = `
// #region ${BRIDGE_MARK}
/** DeepSeek V4/V4.1 DSML tool markup (fullwidth ｜ or ASCII |, optional spaces). */
const DSML_PIPE = '[|｜]'
const DSML_TAG = \`<\\\\s*\${DSML_PIPE}\\\\s*DSML\\\\s*\${DSML_PIPE}\`
const DSML_CLOSE_TAG = \`</\\\\s*\${DSML_PIPE}\\\\s*DSML\\\\s*\${DSML_PIPE}\`
const DSML_BLOCK_OPEN_RE = new RegExp(\`\${DSML_TAG}\\\\s*(?:tool_calls|calls)\\\\s*>\`, 'i')
const DSML_BLOCK_CLOSE_RE = new RegExp(\`\${DSML_CLOSE_TAG}\\\\s*(?:tool_calls|calls)\\\\s*>\`, 'i')
const DSML_ANY_OPEN_RE = new RegExp(DSML_TAG, 'i')
const DSML_START_HINT_RE = /<[|｜]?\\s*D?S?M?L?\\s*[|｜]?\\s*(?:tool_?calls|calls|invoke|parameter|tool)\\b/i

function dsmlLooksIncomplete(text) {
  if (!text || typeof text !== 'string') return false
  const open = text.match(new RegExp(DSML_BLOCK_OPEN_RE.source, 'gi')) || []
  const close = text.match(new RegExp(DSML_BLOCK_CLOSE_RE.source, 'gi')) || []
  if (open.length > close.length) return true
  // Mid-tag / mid-parameter at tail — never auto-continue or flush as prose.
  const tail = text.slice(-400)
  if (DSML_ANY_OPEN_RE.test(tail) && !DSML_BLOCK_CLOSE_RE.test(tail)) return true
  if (/<[|｜]\\s*DSML\\s*[|｜][^>]{0,80}$/i.test(text)) return true
  if (/<[|｜]\\s*DSML\\s*[|｜]\\s*parameter\\b[^>]*>[\\s\\S]*$/i.test(text) && !new RegExp(DSML_CLOSE_TAG + '\\\\s*parameter\\\\s*>', 'i').test(tail)) {
    // Has an open parameter without a recent close — treat incomplete if last open is after last close.
    const lastOpen = text.toLowerCase().lastIndexOf('parameter')
    const lastClose = text.toLowerCase().lastIndexOf('</')
    if (lastOpen > lastClose) return true
  }
  return false
}

function parseDsmlParameterValue(raw, isString) {
  const v = String(raw ?? '')
  if (isString) return v
  const trimmed = v.trim()
  if (!trimmed) return ''
  try { return JSON.parse(trimmed) } catch { return v }
}

function parseDsmlInvokes(blockInner) {
  const calls = []
  const invokeRe = new RegExp(
    \`\${DSML_TAG}\\\\s*(?:invoke|tool)\\\\s+name="([^"]+)"\\\\s*>([\\\\s\\\\S]*?)\${DSML_CLOSE_TAG}\\\\s*(?:invoke|tool)\\\\s*>\`,
    'gi'
  )
  let m
  while ((m = invokeRe.exec(blockInner)) !== null) {
    const name = String(m[1] || '').trim()
    if (!name) continue
    const body = m[2] || ''
    const input = {}
    const paramRe = new RegExp(
      \`\${DSML_TAG}\\\\s*parameter\\\\s+name="([^"]+)"(?:\\\\s+string="(true|false)")?\\\\s*>([\\\\s\\\\S]*?)\${DSML_CLOSE_TAG}\\\\s*parameter\\\\s*>\`,
      'gi'
    )
    let pm
    while ((pm = paramRe.exec(body)) !== null) {
      const key = String(pm[1] || '').trim()
      if (!key) continue
      const isString = String(pm[2] || 'true').toLowerCase() !== 'false'
      input[key] = parseDsmlParameterValue(pm[3], isString)
    }
    calls.push({
      id: \`tool_\${crypto.randomBytes(6).toString('hex')}\`,
      type: 'function',
      function: { name, arguments: JSON.stringify(input) },
    })
  }
  return calls
}

/**
 * Pull complete DSML tool blocks out of assistant text.
 * Incomplete trailing DSML is stripped from visible text (never shown as prose).
 * @returns {{ text: string, toolCalls: object[], hadDsml: boolean, incomplete: boolean }}
 */
function extractDsmlToolCalls(text) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', toolCalls: [], hadDsml: false, incomplete: false }
  }
  if (!DSML_ANY_OPEN_RE.test(text) && !/\\|\\s*DSML\\s*\\|/i.test(text)) {
    return { text, toolCalls: [], hadDsml: false, incomplete: false }
  }

  const toolCalls = []
  let hadDsml = false
  let incomplete = false
  let out = ''
  let i = 0
  const openGlobal = new RegExp(DSML_BLOCK_OPEN_RE.source, 'gi')
  const closeGlobal = new RegExp(DSML_BLOCK_CLOSE_RE.source, 'gi')

  while (i < text.length) {
    openGlobal.lastIndex = i
    const open = openGlobal.exec(text)
    if (!open) {
      out += text.slice(i)
      break
    }
    hadDsml = true
    out += text.slice(i, open.index)
    const afterOpen = open.index + open[0].length
    closeGlobal.lastIndex = afterOpen
    const close = closeGlobal.exec(text)
    if (!close) {
      // Unclosed DSML — suppress remainder (fail-closed like Harness).
      incomplete = true
      break
    }
    const inner = text.slice(afterOpen, close.index)
    toolCalls.push(...parseDsmlInvokes(inner))
    // Also allow invokes that include the open/close tags in a looser scan
    if (!toolCalls.length) {
      toolCalls.push(...parseDsmlInvokes(open[0] + inner + close[0]))
    }
    i = close.index + close[0].length
  }

  // Fallback: loose invoke scan if block wrappers missing but tags present
  if (hadDsml && toolCalls.length === 0) {
    toolCalls.push(...parseDsmlInvokes(text))
  }

  // Strip any leftover DSML tag debris from visible prose
  let clean = out
    .replace(new RegExp(\`\${DSML_TAG}[^>]*>\`, 'gi'), '')
    .replace(new RegExp(\`\${DSML_CLOSE_TAG}[^>]*>\`, 'gi'), '')
    .replace(/\\|\\s*DSML\\s*\\|\\s*(?:tool_calls|calls|invoke|parameter|tool)\\b[^\\n]*/gi, '')
    .replace(/[ \\t]+\\n/g, '\\n')
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim()

  // When a write/edit tool carried the file body, drop duplicate code walls from chat.
  clean = scrubDuplicateFilePayloadProse(clean, toolCalls)

  return { text: clean, toolCalls, hadDsml, incomplete }
}

function toolArgsObject(tc) {
  try { return JSON.parse(tc?.function?.arguments || '{}') } catch { return {} }
}

function scrubDuplicateFilePayloadProse(text, toolCalls) {
  if (!text || !toolCalls?.length) return text
  const WRITE_NAMES = /^(write|Write|create_file|str_replace_editor|StrReplace|search_replace|ApplyPatch|edit_file|WriteFile)$/i
  let largest = ''
  for (const tc of toolCalls) {
    const name = tc?.function?.name || ''
    if (!WRITE_NAMES.test(name) && !/write|edit|replace|file/i.test(name)) continue
    const args = toolArgsObject(tc)
    for (const key of ['contents', 'content', 'new_str', 'new_string', 'file_text', 'code', 'text', 'body']) {
      const v = args[key]
      if (typeof v === 'string' && v.length > largest.length) largest = v
    }
  }
  if (largest.length < 400) return text
  // If chat text mostly duplicates the file payload, keep only a short lead-in.
  const norm = (s) => s.replace(/\\s+/g, ' ').slice(0, 800)
  if (norm(text).includes(norm(largest).slice(0, 200)) || text.length > largest.length * 0.5) {
    const lines = text.split('\\n')
    const lead = []
    for (const line of lines) {
      const t = line.trim()
      if (!t) {
        if (lead.length) break
        continue
      }
      // Stop at code-ish lines
      if (/^(def |class |import |from |const |let |var |function |#include|using |package |path\\s*=|new_slide\\(|panel\\(|s\\s*=\\s*new_)/.test(t)) break
      if (/^[=\\-]{6,}$/.test(t) || /^===\\s*\\d+/.test(t)) break
      if (t.length > 180 && /[{();=]/.test(t)) break
      lead.push(t)
      if (lead.join(' ').length > 280) break
    }
    const pathHint = (() => {
      for (const tc of toolCalls) {
        const args = toolArgsObject(tc)
        for (const key of ['path', 'file_path', 'filePath', 'filename', 'target']) {
          if (typeof args[key] === 'string' && args[key]) return args[key]
        }
      }
      return ''
    })()
    const base = pathHint ? path.basename(pathHint.replace(/\\\\/g, '/')) : ''
    if (lead.length) return lead.join(' ').trim()
    return base ? \`Updating \${base}…\` : ''
  }
  return text
}

/** Merge OpenAI tool_calls with DSML-extracted ones (DSML fills when provider leaked text). */
function mergeToolCalls(existing, fromDsml) {
  const out = Array.isArray(existing) ? [...existing] : []
  const seen = new Set(out.map((tc) => \`\${tc?.function?.name}::\${tc?.function?.arguments || ''}\`))
  for (const tc of fromDsml || []) {
    const key = \`\${tc?.function?.name}::\${tc?.function?.arguments || ''}\`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tc)
  }
  return out
}

/**
 * Streaming gate: hold DSML spans out of text_delta; emit structured tools at finalize.
 */
function createDsmlStreamGate() {
  let visible = ''
  let hold = ''
  let inDsml = false
  let toolCalls = []
  let hadDsml = false

  function feed(chunk) {
    if (!chunk) return ''
    let emit = ''
    hold += chunk
    while (hold.length) {
      if (!inDsml) {
        const m = hold.match(DSML_BLOCK_OPEN_RE) || hold.match(DSML_ANY_OPEN_RE)
        if (!m) {
          // Keep a short tail in case the next chunk completes a split marker.
          if (hold.length > 64 && /<[|｜]?\\s*$/i.test(hold.slice(-8))) {
            const keep = 12
            emit += hold.slice(0, -keep)
            visible += hold.slice(0, -keep)
            hold = hold.slice(-keep)
            break
          }
          // Also hold if tail looks like start of DSML
          if (DSML_START_HINT_RE.test(hold.slice(-32)) && hold.length < 80) break
          emit += hold
          visible += hold
          hold = ''
          break
        }
        const idx = m.index
        if (idx > 0) {
          emit += hold.slice(0, idx)
          visible += hold.slice(0, idx)
        }
        hold = hold.slice(idx)
        inDsml = true
        hadDsml = true
        continue
      }
      // in DSML — wait for close
      const close = hold.match(DSML_BLOCK_CLOSE_RE)
      if (!close) break
      const end = close.index + close[0].length
      const block = hold.slice(0, end)
      const parsed = extractDsmlToolCalls(block)
      toolCalls = mergeToolCalls(toolCalls, parsed.toolCalls)
      hold = hold.slice(end)
      inDsml = false
    }
    return emit
  }

  function finalize() {
    if (hold) {
      if (inDsml || DSML_ANY_OPEN_RE.test(hold)) {
        hadDsml = true
        const parsed = extractDsmlToolCalls(hold)
        toolCalls = mergeToolCalls(toolCalls, parsed.toolCalls)
        // never flush incomplete DSML as visible text
        hold = ''
        inDsml = false
      } else {
        visible += hold
        const emit = hold
        hold = ''
        return { flush: emit, text: visible, toolCalls, hadDsml }
      }
    }
    // Post-pass: strip any DSML that slipped + duplicate payloads
    const cleaned = extractDsmlToolCalls(visible)
    toolCalls = mergeToolCalls(toolCalls, cleaned.toolCalls)
    return { flush: '', text: cleaned.text, toolCalls, hadDsml: hadDsml || cleaned.hadDsml, incomplete: cleaned.incomplete }
  }

  return {
    feed,
    finalize,
    get visible() { return visible },
    get hadDsml() { return hadDsml },
    get toolCalls() { return toolCalls },
    get buffering() { return inDsml || hold.length > 0 },
  }
}
// #endregion ${BRIDGE_MARK}
`

function ensureDsmlRegion(src) {
  let s = src.replace(new RegExp(`\\n// #region ${BRIDGE_MARK}[\\s\\S]*?// #endregion ${BRIDGE_MARK}\\n`, 'g'), '\n')
  const anchor = 'function scrubBrandLeak(text) {'
  const i = s.indexOf(anchor)
  if (i < 0) throw new Error('scrubBrandLeak not found')
  // Insert AFTER scrubBrandLeak function end (before catalog)
  const endRegion = s.indexOf('// #endregion beam-persona-bridge', i)
  if (endRegion < 0) throw new Error('persona region end not found')
  const insertAt = s.indexOf('\n', endRegion) + 1
  s = s.slice(0, insertAt) + DSML_REGION + s.slice(insertAt)
  return s
}

function wireSyncPath(s) {
  // After accumulating fullText / toolCalls in completeWithOutputContinues, extract DSML.
  const needle = `  let fullText = typeof msg.content === 'string' ? scrubBrandLeak(msg.content) : ''
  let toolCalls = msg.tool_calls || null
  let stop = toolCalls?.length ? 'tool_use' : (choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn')`
  const repl = `  let fullText = typeof msg.content === 'string' ? scrubBrandLeak(msg.content) : ''
  let toolCalls = msg.tool_calls || null
  {
    const dsml = extractDsmlToolCalls(fullText)
    fullText = dsml.text
    toolCalls = mergeToolCalls(toolCalls, dsml.toolCalls)
    if (dsml.hadDsml) bridgeLog(\`dsml_extract sync tools=\${dsml.toolCalls.length} incomplete=\${dsml.incomplete}\`)
  }
  let stop = toolCalls?.length ? 'tool_use' : (choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn')`
  if (!s.includes(needle)) {
    // already patched or drifted
    if (s.includes('extractDsmlToolCalls(fullText)')) return s
    throw new Error('sync fullText needle missing')
  }
  s = s.replace(needle, repl)

  // Also extract after each continue piece
  const pieceNeedle = `    const piece = typeof cMsg.content === 'string' ? scrubBrandLeak(cMsg.content) : ''
    if (piece) fullText += piece
    if (cMsg.tool_calls?.length) {
      toolCalls = cMsg.tool_calls
      stop = 'tool_use'
    } else {
      stop = cChoice.finish_reason === 'length' ? 'max_tokens' : 'end_turn'
    }`
  const pieceRepl = `    const piece = typeof cMsg.content === 'string' ? scrubBrandLeak(cMsg.content) : ''
    if (piece) fullText += piece
    {
      const dsml = extractDsmlToolCalls(fullText)
      fullText = dsml.text
      toolCalls = mergeToolCalls(cMsg.tool_calls?.length ? cMsg.tool_calls : toolCalls, dsml.toolCalls)
      if (dsml.hadDsml) bridgeLog(\`dsml_extract sync_cont tools=\${dsml.toolCalls.length}\`)
      if (dsml.incomplete) {
        stop = toolCalls?.length ? 'tool_use' : 'end_turn'
      } else if (toolCalls?.length) {
        stop = 'tool_use'
      } else {
        stop = cChoice.finish_reason === 'length' ? 'max_tokens' : 'end_turn'
      }
    }`
  if (s.includes(pieceNeedle)) s = s.replace(pieceNeedle, pieceRepl)

  // Don't auto-continue when DSML incomplete / present as tool protocol
  const whileNeedle = `  while (stop === 'max_tokens' && !toolCalls?.length && continues < MAX_OUTPUT_CONTINUES) {`
  const whileRepl = `  while (stop === 'max_tokens' && !toolCalls?.length && !dsmlLooksIncomplete(fullText) && continues < MAX_OUTPUT_CONTINUES) {`
  if (s.includes(whileNeedle)) s = s.replace(whileNeedle, whileRepl)

  return s
}

function wireStreamPipe(s) {
  // Replace pipeOpenAiSseToAnthropic text handling to use DSML gate
  if (s.includes('createDsmlStreamGate()') && s.includes('dsmlGate.feed')) return s

  const fnStart = s.indexOf('async function pipeOpenAiSseToAnthropic(upstream, res, state) {')
  if (fnStart < 0) throw new Error('pipeOpenAiSseToAnthropic missing')
  const fnEnd = s.indexOf('\nasync function completeWithOutputContinues', fnStart)
  if (fnEnd < 0) throw new Error('pipe fn end missing')

  const newFn = `async function pipeOpenAiSseToAnthropic(upstream, res, state) {
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let stopReason = 'end_turn'
  let usage = { ...state.usage }
  let textChunk = ''
  const dsmlGate = createDsmlStreamGate()
  if (!state.pendingDsmlTools) state.pendingDsmlTools = []

  const ensureTextBlock = () => {
    if (state.textStarted) return
    state.textStarted = true
    sseWrite(res, 'content_block_start', {
      type: 'content_block_start',
      index: state.blockIndex,
      content_block: { type: 'text', text: '' },
    })
  }

  const emitText = (piece) => {
    if (!piece) return
    textChunk += piece
    ensureTextBlock()
    sseWrite(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: state.blockIndex,
      delta: { type: 'text_delta', text: piece },
    })
  }

  const emitOpenAiTools = (toolCalls) => {
    if (!toolCalls?.length) return
    if (state.textStarted) {
      sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.textStarted = false
    }
    for (const tc of toolCalls) {
      const idx = state.toolBuf.size
      const id = tc.id || \`tool_\${crypto.randomBytes(6).toString('hex')}\`
      const name = tc.function?.name || 'tool'
      const args = tc.function?.arguments || '{}'
      state.toolBuf.set(idx, { id, name, args, anthropicIndex: state.blockIndex })
      sseWrite(res, 'content_block_start', {
        type: 'content_block_start',
        index: state.blockIndex,
        content_block: { type: 'tool_use', id, name, input: {} },
      })
      sseWrite(res, 'content_block_delta', {
        type: 'content_block_delta',
        index: state.blockIndex,
        delta: { type: 'input_json_delta', partial_json: args },
      })
      state.blockIndex += 1
    }
    stopReason = 'tool_use'
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\\n')
    buffer = parts.pop() || ''
    for (const line of parts) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      let chunk
      try { chunk = JSON.parse(payload) } catch { continue }
      if (chunk.usage) usage = { ...usage, ...chunk.usage }
      const delta = chunk.choices?.[0]?.delta || {}
      const finish = chunk.choices?.[0]?.finish_reason
      if (delta.content) {
        const scrubbed = scrubBrandLeak(delta.content)
        const safe = dsmlGate.feed(scrubbed)
        if (safe) emitText(safe)
      }
      if (delta.tool_calls) {
        // Flush any pending non-DSML text before structured tools
        const fin = dsmlGate.finalize()
        if (fin.flush) emitText(fin.flush)
        if (fin.toolCalls?.length) {
          emitOpenAiTools(fin.toolCalls)
          state.pendingDsmlTools.push(...fin.toolCalls)
        }
        if (state.textStarted) {
          sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: state.blockIndex })
          state.blockIndex += 1
          state.textStarted = false
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!state.toolBuf.has(idx)) {
            const id = tc.id || \`tool_\${crypto.randomBytes(6).toString('hex')}\`
            state.toolBuf.set(idx, { id, name: tc.function?.name || '', args: '', anthropicIndex: state.blockIndex })
            sseWrite(res, 'content_block_start', {
              type: 'content_block_start',
              index: state.blockIndex,
              content_block: { type: 'tool_use', id, name: tc.function?.name || '', input: {} },
            })
            state.blockIndex += 1
          }
          const entry = state.toolBuf.get(idx)
          if (tc.function?.name) entry.name = tc.function.name
          if (tc.function?.arguments) {
            entry.args += tc.function.arguments
            sseWrite(res, 'content_block_delta', {
              type: 'content_block_delta',
              index: entry.anthropicIndex,
              delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
            })
          }
        }
        stopReason = 'tool_use'
      }
      if (finish === 'length') stopReason = 'max_tokens'
      if (finish === 'tool_calls') stopReason = 'tool_use'
    }
  }

  const fin = dsmlGate.finalize()
  if (fin.flush) emitText(fin.flush)
  if (fin.toolCalls?.length) {
    emitOpenAiTools(fin.toolCalls)
    state.pendingDsmlTools.push(...fin.toolCalls)
    bridgeLog(\`dsml_extract stream tools=\${fin.toolCalls.length}\`)
  }
  // Prefer visible cleaned text for continuation decisions
  if (fin.text != null) textChunk = fin.text

  state.usage = usage
  return {
    stopReason,
    usage,
    text: textChunk,
    hadTools: state.toolBuf.size > 0 || (fin.toolCalls?.length > 0),
    hadDsml: fin.hadDsml || dsmlGate.hadDsml,
    dsmlIncomplete: !!fin.incomplete,
  }
}
`
  s = s.slice(0, fnStart) + newFn + s.slice(fnEnd)
  return s
}

function wireStreamContinue(s) {
  const needle = `  while (
    stopReason === 'max_tokens' &&
    !pipe.hadTools &&
    continues < MAX_OUTPUT_CONTINUES
  ) {`
  const repl = `  while (
    stopReason === 'max_tokens' &&
    !pipe.hadTools &&
    !pipe.hadDsml &&
    !dsmlLooksIncomplete(accumulatedText) &&
    continues < MAX_OUTPUT_CONTINUES
  ) {`
  if (s.includes(needle)) return s.replace(needle, repl)
  if (s.includes('!pipe.hadDsml')) return s
  throw new Error('stream continue while needle missing')
}

function patchBridge(file) {
  if (!fs.existsSync(file)) {
    console.warn('skip missing', file)
    return false
  }
  let s = fs.readFileSync(file, 'utf8')
  s = ensureDsmlRegion(s)
  s = wireSyncPath(s)
  s = wireStreamPipe(s)
  s = wireStreamContinue(s)
  // Final sync content assembly already uses fullText + toolCalls — good.
  fs.writeFileSync(file, s)
  console.log('patched bridge', path.relative(ROOT, file))
  return true
}

const DISPLAY_SCRUB_HELPER = `
		/* ${CHAT_MARK} */
		function __beamScrubDsmlDisplay(text) {
			if (!text || typeof text !== "string") return text;
			if (!/[|｜]\\s*DSML\\s*[|｜]/i.test(text) && !/<\\s*[|｜]\\s*DSML/i.test(text)) return text;
			let t = text;
			t = t.replace(/<\\s*[|｜]\\s*DSML\\s*[|｜]\\s*(?:tool_calls|calls)\\s*>[\\s\\S]*?<\\/\\s*[|｜]\\s*DSML\\s*[|｜]\\s*(?:tool_calls|calls)\\s*>/gi, "");
			t = t.replace(/<\\s*[|｜]\\s*DSML\\s*[|｜][^>]*>/gi, "");
			t = t.replace(/<\\/\\s*[|｜]\\s*DSML\\s*[|｜][^>]*>/gi, "");
			t = t.replace(/\\|\\s*DSML\\s*\\|\\s*(?:tool_calls|calls|invoke|parameter|tool)\\b[^\\n]*/gi, "");
			t = t.replace(/\\n{3,}/g, "\\n\\n").trim();
			return t;
		}
`

function patchChatClient(file) {
  if (!fs.existsSync(file)) return false
  let s = fs.readFileSync(file, 'utf8')
  if (s.includes(CHAT_MARK) && s.includes('__beamScrubDsmlDisplay(block.text)')) {
    console.log('chat already patched', path.relative(ROOT, file))
    return false
  }
  // Insert helper near AssistantMarkdown
  if (!s.includes(CHAT_MARK)) {
    const anchor = 'const AssistantMarkdown = (0, react.memo)(function AssistantMarkdown'
    const i = s.indexOf(anchor)
    if (i < 0) throw new Error('AssistantMarkdown missing in ' + file)
    s = s.slice(0, i) + DISPLAY_SCRUB_HELPER + '\n\t\t' + s.slice(i)
  }
  // Wrap text: block.text → scrubbed
  s = s.replace(
    /text:\s*block\.text,\s*\n\s*streaming,/g,
    'text: __beamScrubDsmlDisplay(block.text),\n\t\t\t\t\t\t\tstreaming,'
  )
  // Also User markdown path if any plain block.text to MarkdownText
  if (!s.includes('__beamScrubDsmlDisplay(block.text)')) {
    throw new Error('failed to wrap block.text in ' + file)
  }
  fs.writeFileSync(file, s)
  console.log('patched chat', path.relative(ROOT, file))
  return true
}

function patchPersonaHygiene() {
  const personaFile = path.join(ROOT, 'desktop', 'identity', 'persona.common.txt')
  const patchFile = path.join(ROOT, 'desktop', 'patch-persona.mjs')
  const hygiene = `

CHAT OUTPUT HYGIENE (mandatory — match Harness UX):
- Never dump raw tool calls, DSML/XML tool markup (\`<|DSML|>\`, invoke/parameter tags), or file-edit payloads into chat prose.
- Create/edit files only via tools. Chat shows a short status and the final user-facing result — not scripts, parameter soup, or absolute paths as the main message.
- Do not paste entire slide-builders, Python/JS files, or long code walls into chat when a Write/Edit tool can own the file. Work details / process UI show the file step.
- If you must show a short code snippet for explanation, use a fenced markdown code block (\\\`\\\`\\\`lang). Never emit DSML as visible text.`

  if (fs.existsSync(personaFile)) {
    let p = fs.readFileSync(personaFile, 'utf8')
    if (!p.includes('CHAT OUTPUT HYGIENE')) {
      p = p.replace(/\nTONE\n/, `${hygiene}\n\nTONE\n`)
      fs.writeFileSync(personaFile, p)
      console.log('persona.common.txt hygiene added')
    }
  }
  if (fs.existsSync(patchFile)) {
    let p = fs.readFileSync(patchFile, 'utf8')
    if (!p.includes('CHAT OUTPUT HYGIENE')) {
      p = p.replace(
        /TONE\nHelpful, concrete, tool-capable\./,
        `CHAT OUTPUT HYGIENE (mandatory — match Harness UX):
- Never dump raw tool calls, DSML/XML tool markup, or file-edit payloads into chat prose.
- Create/edit files only via tools. Chat shows short status + final user-facing result.
- Do not paste entire scripts into chat when a Write/Edit tool can create the file.
- Short explanatory snippets only, inside fenced markdown code blocks — never visible DSML.

TONE
Helpful, concrete, tool-capable.`
      )
      fs.writeFileSync(patchFile, p)
      console.log('patch-persona.mjs hygiene added')
    }
  }
}

function main() {
  console.log('=== DSML tool-leak fix ===')
  const bridges = [
    path.join(ROOT, 'desktop', 'bridge', 'server.js'),
    path.join(ROOT, 'dist', 'Beam-Agent', 'bridge', 'server.js'),
  ]
  for (const b of bridges) patchBridge(b)

  const chats = [
    path.join(ROOT, 'runtime', 'app', 'beam', 'node_modules', '@assistix', 'beam-client-ui-chat', 'lib', 'client.js'),
    path.join(ROOT, 'runtime', 'app', 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-chat', 'lib', 'client.js'),
    path.join(ROOT, 'dist', 'Beam-Agent', 'resources', 'app', 'beam', 'node_modules', '@assistix', 'beam-client-ui-chat', 'lib', 'client.js'),
    path.join(ROOT, 'dist', 'Beam-Agent', 'resources', 'app', 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-chat', 'lib', 'client.js'),
  ]
  for (const c of chats) {
    try { patchChatClient(c) } catch (e) { console.error('chat patch fail', c, e.message) }
  }

  patchPersonaHygiene()

  // Re-embed persona blob so hygiene ships with identity pack
  const personaPatch = path.join(ROOT, 'desktop', 'patch-persona.mjs')
  if (fs.existsSync(personaPatch)) {
    const r = spawnSync(process.execPath, [personaPatch], { cwd: ROOT, encoding: 'utf8' })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('persona re-embed exit', r.status)
  }

  // Verify
  const distBridge = bridges[1]
  const src = fs.readFileSync(distBridge, 'utf8')
  const checks = [
    ['extractDsmlToolCalls', src.includes('function extractDsmlToolCalls')],
    ['createDsmlStreamGate', src.includes('function createDsmlStreamGate')],
    ['stream hadDsml gate', src.includes('!pipe.hadDsml')],
    ['sync incomplete gate', src.includes('!dsmlLooksIncomplete(fullText)')],
  ]
  for (const [name, ok] of checks) console.log(ok ? 'OK' : 'FAIL', name)
  if (checks.some(([, ok]) => !ok)) process.exit(1)
  console.log('=== done ===')
}

main()
