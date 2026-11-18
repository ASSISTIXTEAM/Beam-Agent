/**
 * Beam Agent local bridge:
 * - Anthropic Messages API (what DeepSeek Harness speaks) → Kumorouter OpenAI Chat Completions
 * - Assistix ID session + Tide / Flare / Pine quotas
 */
import http from 'node:http'
import { createServer as createNetServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const DATA_DIR = path.join(process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam'), 'bridge')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const PORT = Number(process.env.BEAM_BRIDGE_PORT || 17865)

const KUMO_URL = process.env.KUMO_API_URL || 'https://api.kumorouter.com/v1/chat/completions'
const KUMO_KEY = process.env.KUMO_API_KEY || 'YOUR_KUMO_API_KEY_HERE'
const ID_BASE = process.env.ASSISTIX_ID_URL || 'https://id.assistix.org'

/** Beam Agent catalog (display → Kumorouter). */
const MODELS = {
  tide: { id: 'tide', name: 'Tide', backend: 'deepseek-v4-flash', limit: 1_000_000, aliases: ['deepseek-flash', 'deepseek-v4-flash', 'tide'] },
  flare: { id: 'flare', name: 'Flare', backend: 'gemini-3.8-flash', limit: 500_000, aliases: ['flair', 'flare', 'gemini-3.8-flash', 'gemini-3.8-flash-lite'] },
  pine: { id: 'pine', name: 'Pine', backend: 'grok-4.7', limit: 10_000, aliases: ['pine', 'grok-4.7', 'deepseek-v4-pro'] },
}

/** Monday-based UTC week id (YYYY-MM-DD of that Monday). */
function quotaWeekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  if (day !== 1) t.setUTCDate(t.getUTCDate() - (day - 1))
  return t.toISOString().slice(0, 10)
}

/** Keep stored weekly token quotas aligned with MODELS caps; reset used each week. */
function normalizeQuotas(state) {
  let changed = false
  const week = quotaWeekId()
  if (!state.quotas || typeof state.quotas !== 'object') {
    state.quotas = {}
    changed = true
  }
  if (state.quotaWeek == null) {
    state.quotaWeek = week
    changed = true
  } else if (state.quotaWeek !== week) {
    state.quotaWeek = week
    for (const id of Object.keys(MODELS)) {
      state.quotas[id] = { used: 0, limit: MODELS[id].limit }
    }
    return true
  }
  for (const id of Object.keys(MODELS)) {
    const want = MODELS[id].limit
    const prev = state.quotas[id]
    const used = Math.max(0, Number(prev?.used) || 0)
    if (!prev || typeof prev !== 'object' || Number(prev.limit) !== want || Number(prev.used) !== used) {
      state.quotas[id] = { used, limit: want }
      changed = true
    }
  }
  return changed
}

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STATE_FILE)) {
    const initial = {
      session: null,
      quotaWeek: quotaWeekId(),
      quotas: {
        tide: { used: 0, limit: MODELS.tide.limit },
        flare: { used: 0, limit: MODELS.flare.limit },
        pine: { used: 0, limit: MODELS.pine.limit },
      },
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2))
  }
}

function loadState() {
  ensureData()
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  if (normalizeQuotas(state)) saveState(state)
  return state
}

function saveState(state) {
  ensureData()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function resolveTier(modelId) {
  const id = String(modelId || 'tide').toLowerCase()
  for (const tier of Object.values(MODELS)) {
    if (tier.aliases.includes(id) || tier.id === id || tier.backend === id) return tier
  }
  return MODELS.tide
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(body)
}

/** Kumorouter rejects request text above 1 MiB → HTTP 400 → client INVALID_REQUEST. */
const KUMO_TEXT_LIMIT = 1_048_576
const KUMO_SAFE_BUDGET = 900_000
const KUMO_HARD_BUDGET = 550_000
const MAX_TOOL_CONTENT = 100_000
const MAX_MSG_CONTENT = 160_000
const MAX_TOOL_ARGS = 24_000
const MAX_TOOL_DESC = 4_000

function textFromAnthropicContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      if (block.type === 'text') return block.text || ''
      if (block.type === 'tool_result') return stringifyToolContent(block.content)
      if (block.type === 'image' || block.type === 'image_url') return '[image omitted]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function stringifyToolContent(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (!b || typeof b !== 'object') return String(b ?? '')
        if (b.type === 'text') return b.text || ''
        if (b.type === 'image' || b.type === 'image_url') return '[image omitted]'
        try { return JSON.stringify(b) } catch { return '' }
      })
      .filter(Boolean)
      .join('\n')
  }
  try { return JSON.stringify(content) } catch { return String(content) }
}

function clipText(text, max, label = 'truncated') {
  const s = String(text ?? '')
  if (s.length <= max) return s
  const keep = Math.max(0, max - 80)
  const head = Math.floor(keep * 0.7)
  const tail = keep - head
  return `${s.slice(0, head)}\n\n…[${label}: ${s.length} chars]…\n\n${s.slice(-tail)}`
}

function payloadBytes(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj), 'utf8') } catch { return Number.MAX_SAFE_INTEGER }
}

function mapToolChoice(tc) {
  if (tc == null) return undefined
  if (typeof tc === 'string') {
    if (tc === 'any') return 'required'
    if (tc === 'auto' || tc === 'none' || tc === 'required') return tc
    return 'auto'
  }
  if (typeof tc !== 'object') return undefined
  if (tc.type === 'auto') return 'auto'
  if (tc.type === 'any') return 'required'
  if (tc.type === 'none') return 'none'
  if (tc.type === 'tool' && tc.name) return { type: 'function', function: { name: String(tc.name) } }
  if (tc.type === 'function' && (tc.function?.name || tc.name)) {
    return { type: 'function', function: { name: String(tc.function?.name || tc.name) } }
  }
  return 'auto'
}

function anthropicToOpenAIMessages(messages = [], system) {
  const out = []
  if (system) {
    const sys = typeof system === 'string' ? system : textFromAnthropicContent(system)
    if (sys) out.push({ role: 'system', content: sys })
  }
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : msg.role === 'tool' ? 'tool' : msg.role === 'system' ? 'system' : 'user'
    if (Array.isArray(msg.content)) {
      const toolCalls = []
      const texts = []
      const toolResults = []
      for (const block of msg.content) {
        if (!block || typeof block !== 'object') continue
        if (block.type === 'text') {
          if (block.text) texts.push(block.text)
        } else if (block.type === 'tool_use') {
          const name = String(block.name || 'tool').slice(0, 128) || 'tool'
          let args = '{}'
          try { args = JSON.stringify(block.input ?? {}) } catch { args = '{}' }
          if (args.length > MAX_TOOL_ARGS) args = JSON.stringify({ _truncated: true, preview: args.slice(0, MAX_TOOL_ARGS - 80) })
          toolCalls.push({
            id: String(block.id || `tool_${crypto.randomBytes(6).toString('hex')}`),
            type: 'function',
            function: { name, arguments: args },
          })
        } else if (block.type === 'tool_result') {
          const id = String(block.tool_use_id || block.tool_call_id || '').trim()
          if (!id) continue
          let content = stringifyToolContent(block.content)
          if (block.is_error && content && !content.startsWith('Error:')) content = `Error: ${content}`
          toolResults.push({
            role: 'tool',
            tool_call_id: id,
            content: content || '(empty tool result)',
          })
        } else if (block.type === 'image' || block.type === 'image_url') {
          texts.push('[image omitted for provider payload size]')
        }
      }
      if (toolResults.length && role !== 'assistant') {
        out.push(...toolResults)
        if (texts.length) out.push({ role: 'user', content: texts.join('\n') })
        continue
      }
      if (role === 'assistant' && (texts.length || toolCalls.length)) {
        const row = { role: 'assistant', content: texts.join('\n') || null }
        if (toolCalls.length) row.tool_calls = toolCalls
        out.push(row)
      } else if (texts.length) {
        out.push({ role: role === 'tool' ? 'user' : role, content: texts.join('\n') })
      } else if (role === 'user') {
        // Skip empty user turns — empty content → provider INVALID_REQUEST
      }
    } else if (role === 'tool') {
      const id = String(msg.tool_call_id || msg.tool_use_id || '').trim()
      if (!id) continue
      out.push({
        role: 'tool',
        tool_call_id: id,
        content: stringifyToolContent(msg.content) || '(empty tool result)',
      })
    } else {
      const content = msg.content == null ? '' : String(msg.content)
      if (!content && role !== 'assistant') continue
      out.push({ role, content })
    }
  }
  return out
}

function repairToolPairing(messages) {
  const out = []
  let pending = []
  const flushStubs = () => {
    for (const id of pending) {
      out.push({ role: 'tool', tool_call_id: id, content: '(tool result unavailable)' })
    }
    pending = []
  }
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    if (msg.role === 'assistant') {
      if (pending.length) flushStubs()
      const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls.filter((tc) => tc && tc.id) : []
      const row = { ...msg }
      if (calls.length) {
        row.tool_calls = calls
        if (row.content === '') row.content = null
        out.push(row)
        pending = calls.map((tc) => String(tc.id))
      } else {
        delete row.tool_calls
        if (row.content == null || row.content === '') row.content = '…'
        out.push(row)
      }
      continue
    }
    if (msg.role === 'tool') {
      const id = String(msg.tool_call_id || '').trim()
      if (!id) continue
      const idx = pending.indexOf(id)
      if (idx >= 0) pending.splice(idx, 1)
      out.push({
        role: 'tool',
        tool_call_id: id,
        content: (msg.content == null || msg.content === '') ? '(empty tool result)' : String(msg.content),
      })
      continue
    }
    if (pending.length) flushStubs()
    if (msg.role === 'system' || msg.role === 'user') {
      const content = msg.content == null ? '' : String(msg.content)
      if (msg.role === 'user' && !content) continue
      out.push({ role: msg.role, content: content || (msg.role === 'system' ? '' : '…') })
    }
  }
  if (pending.length) flushStubs()
  return out
}

function clipMessagesInPlace(messages, toolCap, msgCap) {
  for (const msg of messages) {
    if (!msg) continue
    if (typeof msg.content === 'string' && msg.content.length > (msg.role === 'tool' ? toolCap : msgCap)) {
      msg.content = clipText(msg.content, msg.role === 'tool' ? toolCap : msgCap, msg.role === 'tool' ? 'tool truncated' : 'truncated')
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const args = tc?.function?.arguments
        if (typeof args === 'string' && args.length > MAX_TOOL_ARGS) {
          tc.function.arguments = JSON.stringify({ _truncated: true, preview: args.slice(0, MAX_TOOL_ARGS - 80) })
        }
      }
    }
  }
}

function compactOpenAIMessages(messages, budget) {
  let msgs = repairToolPairing(messages.map((m) => ({ ...m, tool_calls: m.tool_calls ? m.tool_calls.map((tc) => ({ ...tc, function: { ...tc.function } })) : undefined })))
  clipMessagesInPlace(msgs, MAX_TOOL_CONTENT, MAX_MSG_CONTENT)

  const measure = () => payloadBytes({ messages: msgs })
  if (measure() <= budget) return msgs

  // Aggressive tool-result clipping (keep recent tools fuller)
  const toolIdx = []
  for (let i = 0; i < msgs.length; i++) if (msgs[i].role === 'tool') toolIdx.push(i)
  const keepFull = 6
  for (let k = 0; k < toolIdx.length; k++) {
    const i = toolIdx[k]
    const fromEnd = toolIdx.length - 1 - k
    const cap = fromEnd < keepFull ? Math.min(MAX_TOOL_CONTENT, Math.floor(budget / (keepFull + 2))) : 4_000
    if (typeof msgs[i].content === 'string' && msgs[i].content.length > cap) {
      msgs[i].content = clipText(msgs[i].content, cap, 'tool compacted')
    }
  }
  if (measure() <= budget) return msgs

  // Drop oldest non-system turns in pairs while preserving tool pairing
  while (measure() > budget && msgs.length > 4) {
    let dropAt = -1
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'system') continue
      dropAt = i
      break
    }
    if (dropAt < 0) break
    const first = msgs[dropAt]
    let dropCount = 1
    if (first.role === 'assistant' && first.tool_calls?.length) {
      dropCount = 1
      while (dropAt + dropCount < msgs.length && msgs[dropAt + dropCount].role === 'tool') dropCount++
    } else if (first.role === 'tool') {
      // shouldn't lead after repair, but skip orphan tools
      while (dropAt + dropCount < msgs.length && msgs[dropAt + dropCount].role === 'tool') dropCount++
    } else if (first.role === 'user' && dropAt + 1 < msgs.length && msgs[dropAt + 1].role === 'assistant') {
      dropCount = 1
      if (msgs[dropAt + 1].tool_calls?.length) {
        dropCount = 2
        while (dropAt + dropCount < msgs.length && msgs[dropAt + dropCount].role === 'tool') dropCount++
      } else {
        dropCount = 2
      }
    }
    const removed = msgs.splice(dropAt, dropCount)
    bridgeLog(`payload_drop count=${removed.length} roles=${removed.map((m) => m.role).join(',')}`)
    msgs = repairToolPairing(msgs)
    clipMessagesInPlace(msgs, 3_000, 8_000)
  }

  if (measure() > budget) {
    // Last resort: keep system + last few messages only
    const system = msgs.filter((m) => m.role === 'system')
    const rest = msgs.filter((m) => m.role !== 'system')
    const kept = rest.slice(-8)
    msgs = repairToolPairing([...system, { role: 'user', content: '[Earlier conversation compacted to fit provider request size limit.]' }, ...kept])
    clipMessagesInPlace(msgs, 2_500, 6_000)
  }
  return msgs
}

function anthropicToolsToOpenAI(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: String(t.name || 'tool').slice(0, 128),
      description: clipText(t.description || '', MAX_TOOL_DESC, 'desc truncated'),
      parameters: t.input_schema || t.parameters || { type: 'object', properties: {} },
    },
  }))
}

function buildOpenAIBody(body, tier, budget = KUMO_SAFE_BUDGET) {
  const requestedMax = Number(body.max_tokens) || 4096
  const cappedMax = Math.min(requestedMax, Number(tier.maxTokensCap) || requestedMax)
  const system = [
    __BRIDGE_PERSONA,
    typeof body.system === 'string'
      ? body.system
      : (Array.isArray(body.system) ? body.system.map((x) => x?.text || '').join('\n') : ''),
  ].filter(Boolean).join('\n\n')
  let messages = anthropicToOpenAIMessages(body.messages, system)
  messages = compactOpenAIMessages(messages, budget)
  const openaiBody = {
    model: tier.backend,
    messages,
    max_tokens: cappedMax,
  }
  const temp = Number(body.temperature)
  if (Number.isFinite(temp)) openaiBody.temperature = Math.min(2, Math.max(0, temp))
  const tools = anthropicToolsToOpenAI(body.tools)
  if (tools?.length) openaiBody.tools = tools
  const toolChoice = mapToolChoice(body.tool_choice)
  if (toolChoice !== undefined) openaiBody.tool_choice = toolChoice

  let bytes = payloadBytes(openaiBody)
  if (bytes > budget && tools?.length) {
    // Shrink tool schemas if still oversized
    openaiBody.tools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: clipText(t.function.description || '', 800, 'desc'),
        parameters: { type: 'object', properties: {} },
      },
    }))
    bytes = payloadBytes(openaiBody)
  }
  if (bytes > budget) {
    openaiBody.messages = compactOpenAIMessages(openaiBody.messages, Math.floor(budget * 0.85))
    bytes = payloadBytes(openaiBody)
  }
  bridgeLog(`payload_ready bytes=${bytes} budget=${budget} msgs=${openaiBody.messages.length} tools=${openaiBody.tools?.length || 0}`)
  return openaiBody
}

function kumoErrorMessage(status, bodyText) {
  const raw = String(bodyText || '')
  let parsed
  try { parsed = JSON.parse(raw) } catch {}
  const providerMsg = parsed?.error?.message || parsed?.message || ''
  if (/Request limit exceeded|payload too large|request body too large|length limit exceeded/i.test(raw)) {
    return 'Контекст диалога слишком большой для модели после инструментов. История сжата — отправьте сообщение ещё раз или начните новый чат.'
  }
  if (status === 400 || /invalid.?request/i.test(raw)) {
    return providerMsg
      ? `Некорректный запрос к модели: ${clipText(providerMsg, 240)}`
      : 'Некорректный запрос к модельному API. Попробуйте ещё раз.'
  }
  if (status === 401 || status === 403) return 'Ошибка авторизации модельного API.'
  if (status === 429) return 'Модели временно ограничили частоту запросов. Подождите и повторите.'
  if (status >= 500) return 'Модельный API временно недоступен. Попробуйте ещё раз.'
  return providerMsg || 'Ошибка модельного API при потоке. Попробуйте ещё раз.'
}

function isKumoSizeLimitError(status, bodyText) {
  return status === 400 && /Request limit exceeded|payload too large|request body too large|1048576/i.test(String(bodyText || ''))
}

async function callKumoSanitized(body, tier, { stream, backends }) {
  let openaiBody = buildOpenAIBody(body, tier, KUMO_SAFE_BUDGET)
  const opts = { stream, backends: backends || tier.backends || [tier.backend] }
  let upstream = await callKumo(openaiBody, opts)
  if (upstream.ok) return { upstream, openaiBody, errText: null }

  const errText = await upstream.text()
  bridgeLog(`kumo_${stream ? 'stream' : 'sync'}_http status=${upstream.status} body=${errText.slice(0, 240)}`)

  if (isKumoSizeLimitError(upstream.status, errText)) {
    openaiBody = buildOpenAIBody(body, tier, KUMO_HARD_BUDGET)
    bridgeLog(`kumo_size_retry hard_budget=${KUMO_HARD_BUDGET} bytes=${payloadBytes(openaiBody)}`)
    upstream = await callKumo(openaiBody, opts)
    if (upstream.ok) return { upstream, openaiBody, errText: null }
    const errText2 = await upstream.text()
    bridgeLog(`kumo_size_retry_fail status=${upstream.status} body=${errText2.slice(0, 240)}`)
    return { upstream, openaiBody, errText: errText2 }
  }
  return { upstream, openaiBody, errText }
}

/** Append assistant partial + continue user turn for invisible output continuation. */
function buildContinuationOpenAIBody(openaiBody, partialText, budget = KUMO_SAFE_BUDGET) {
  const base = {
    ...openaiBody,
    messages: [
      ...(Array.isArray(openaiBody.messages) ? openaiBody.messages : []),
      { role: 'assistant', content: String(partialText || '') },
      { role: 'user', content: OUTPUT_CONTINUE_PROMPT },
    ],
  }
  // Continuations drop tools — text-only resume; keeps payload under Kumo 1 MiB.
  delete base.tools
  delete base.tool_choice
  base.messages = compactOpenAIMessages(base.messages, budget)
  if (payloadBytes(base) > budget) {
    base.messages = compactOpenAIMessages(base.messages, Math.floor(budget * 0.85))
  }
  return base
}

/**
 * Read one OpenAI SSE upstream into Anthropic-shaped SSE writes.
 * Holds DeepSeek DSML out of text_delta and emits tool_use instead (Harness UX).
 * Returns { stopReason, usage, text, hadTools, hadDsml }.
 */
async function pipeOpenAiSseToAnthropic(upstream, res, state) {
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let stopReason = 'end_turn'
  let usage = { ...state.usage }
  let textChunk = ''
  const dsmlGate = createDsmlStreamGate()

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

  const emitParsedTools = (toolCalls) => {
    if (!toolCalls?.length) return
    if (state.textStarted) {
      sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.textStarted = false
    }
    for (const tc of toolCalls) {
      const idx = state.toolBuf.size
      const id = tc.id || `tool_${crypto.randomBytes(6).toString('hex')}`
      const name = tc.function?.name || 'tool'
      const args = tc.function?.arguments || '{}'
      state.toolBuf.set(`dsml_${idx}`, { id, name, args, anthropicIndex: state.blockIndex })
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
    const parts = buffer.split('\n')
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
        // scrubBrandLeak already strips closed DSML; gate catches split tags mid-stream
        const safe = dsmlGate.feed(scrubbed)
        if (safe) emitText(safe)
      }
      if (delta.tool_calls) {
        const finEarly = dsmlGate.finalize()
        if (finEarly.flush) emitText(finEarly.flush)
        if (finEarly.toolCalls?.length) emitParsedTools(finEarly.toolCalls)
        if (state.textStarted) {
          sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: state.blockIndex })
          state.blockIndex += 1
          state.textStarted = false
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!state.toolBuf.has(idx)) {
            const id = tc.id || `tool_${crypto.randomBytes(6).toString('hex')}`
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
    emitParsedTools(fin.toolCalls)
    bridgeLog(`dsml_extract stream tools=${fin.toolCalls.length}`)
  }
  if (fin.text != null) textChunk = fin.text

  state.usage = usage
  return {
    stopReason,
    usage,
    text: textChunk,
    hadTools: state.toolBuf.size > 0,
    hadDsml: !!(fin.hadDsml || dsmlGate.hadDsml),
  }
}

/** Non-stream: keep requesting continuation until end/tool or safe cap. */
async function completeWithOutputContinues(body, tier, kumoOpts) {
  let { upstream, openaiBody, errText } = await callKumoSanitized(body, tier, { stream: false, ...kumoOpts })
  if (!upstream.ok) return { upstream, openaiBody, errText, content: null, stop: null, usage: null, continues: 0 }

  const text = errText != null ? errText : await upstream.text()
  let data
  try { data = JSON.parse(text) } catch {
    return { upstream, openaiBody, errText: text, content: null, stop: null, usage: null, continues: 0, badJson: true }
  }
  if (!upstream.ok) {
    return { upstream, openaiBody, errText: text, content: null, stop: null, usage: null, continues: 0 }
  }

  const choice = data.choices?.[0] || {}
  const msg = choice.message || {}
  let fullText = typeof msg.content === 'string' ? scrubBrandLeak(msg.content) : ''
  let toolCalls = msg.tool_calls || null
  let stop = toolCalls?.length ? 'tool_use' : (choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn')
  let usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 }
  let continues = 0
  let lastId = data.id
  const baseOpenAIBody = openaiBody

  while (
    !toolCalls?.length &&
    continues < MAX_OUTPUT_CONTINUES &&
    (stop === 'max_tokens' || looksTruncated(fullText))
  ) {
    continues += 1
    const beforeLen = fullText.length
    // Always resume from the original request + full accumulated text (not nested continues).
    const contBody = buildContinuationOpenAIBody(baseOpenAIBody, fullText, KUMO_SAFE_BUDGET)
    bridgeLog(`output_continue sync round=${continues} chars=${fullText.length} reason=${stop === 'max_tokens' ? 'max_tokens' : 'heuristic'}`)
    let contUp
    try {
      contUp = await callKumo(contBody, { stream: false, backends: kumoOpts.backends || tier.backends || [tier.backend] })
    } catch (e) {
      bridgeLog(`output_continue sync_fail ${e?.message || e}`)
      break
    }
    const contText = await contUp.text()
    if (!contUp.ok) {
      bridgeLog(`output_continue sync_http status=${contUp.status} body=${contText.slice(0, 200)}`)
      break
    }
    let contData
    try { contData = JSON.parse(contText) } catch {
      bridgeLog('output_continue sync_bad_json')
      break
    }
    const cChoice = contData.choices?.[0] || {}
    const cMsg = cChoice.message || {}
    const piece = typeof cMsg.content === 'string' ? scrubBrandLeak(cMsg.content) : ''
    if (piece) fullText += piece
    if (cMsg.tool_calls?.length) {
      toolCalls = cMsg.tool_calls
      stop = 'tool_use'
    } else {
      stop = cChoice.finish_reason === 'length' ? 'max_tokens' : 'end_turn'
    }
    if (contData.usage) {
      usage = {
        prompt_tokens: (usage.prompt_tokens || 0) + (contData.usage.prompt_tokens || 0),
        completion_tokens: (usage.completion_tokens || 0) + (contData.usage.completion_tokens || 0),
        total_tokens: (usage.total_tokens || 0) + (contData.usage.total_tokens || 0),
      }
    }
    lastId = contData.id || lastId
    if (fullText.length <= beforeLen) {
      bridgeLog('output_continue sync_no_progress')
      break
    }
  }

  fullText = scrubBrandLeak(fullText)
  // Keep max_tokens when still truncated so the client can offer «Продолжить».
  if (stop === 'max_tokens' || looksTruncated(fullText)) {
    bridgeLog(`output_continue sync_needs_user rounds=${continues} chars=${fullText.length} truncated=${looksTruncated(fullText)}`)
    stop = 'max_tokens'
  } else if (stop !== 'tool_use') {
    stop = 'end_turn'
  }

  const content = []
  if (fullText) content.push({ type: 'text', text: fullText })
  if (toolCalls?.length) content.push(...openAIToolCallsToAnthropic(toolCalls))
  if (!content.length) content.push({ type: 'text', text: '…' })

  return {
    upstream: { ok: true, status: 200 },
    openaiBody,
    errText: null,
    content,
    stop,
    usage,
    continues,
    id: lastId,
  }
}

function openAIToolCallsToAnthropic(toolCalls = []) {
  return toolCalls.map((tc) => {
    let input = {}
    try { input = JSON.parse(tc.function?.arguments || '{}') } catch { input = { raw: tc.function?.arguments } }
    return {
      type: 'tool_use',
      id: tc.id,
      name: tc.function?.name,
      input,
    }
  })
}

async function callKumo(payload, { stream }) {
  const res = await fetch(KUMO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KUMO_KEY}`,
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify({ ...payload, stream: !!stream }),
  })
  return res
}

function chargeTokens(state, tierId, usage) {
  const total = Number(usage?.total_tokens || 0)
    || (Number(usage?.prompt_tokens || 0) + Number(usage?.completion_tokens || 0))
    || 1
  const key = tierId === 'flair' ? 'flare' : tierId
  if (!state.quotas[key]) state.quotas[key] = { used: 0, limit: MODELS[key]?.limit || 0 }
  state.quotas[key].used = Math.min(state.quotas[key].limit, state.quotas[key].used + total)
  saveState(state)
  return total
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function handleMessages(req, res) {
  const raw = await readBody(req)
  let body
  try { body = JSON.parse(raw.toString('utf8') || '{}') } catch {
    return sendJson(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'Invalid JSON' } })
  }

  const state = loadState()
  const tier = resolveTier(body.model)
  const quota = state.quotas[tier.id] || { used: 0, limit: tier.limit }
  if (quota.used >= quota.limit) {
    return sendJson(res, 429, {
      type: 'error',
      error: { type: 'rate_limit_error', message: `${tier.name} token quota exhausted (${quota.used}/${quota.limit})` },
    })
  }

  const openaiBody = {
    model: tier.backend,
    messages: anthropicToOpenAIMessages(body.messages, body.system),
    max_tokens: body.max_tokens || 4096,
    temperature: body.temperature,
    tools: anthropicToolsToOpenAI(body.tools),
  }
  if (body.tool_choice) openaiBody.tool_choice = body.tool_choice

  const wantStream = body.stream === true

  if (!wantStream) {
    const upstream = await callKumo(openaiBody, { stream: false })
    const text = await upstream.text()
    let data
    try { data = JSON.parse(text) } catch {
      return sendJson(res, 502, { type: 'error', error: { type: 'api_error', message: text.slice(0, 500) } })
    }
    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        type: 'error',
        error: { type: 'api_error', message: data?.error?.message || text.slice(0, 500) },
      })
    }
    const choice = data.choices?.[0] || {}
    const msg = choice.message || {}
    const content = []
    if (msg.content) content.push({ type: 'text', text: msg.content })
    if (msg.tool_calls?.length) content.push(...openAIToolCallsToAnthropic(msg.tool_calls))
    const stop = msg.tool_calls?.length ? 'tool_use' : (choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn')
    chargeTokens(state, tier.id, data.usage)
    return sendJson(res, 200, {
      id: data.id || `msg_${crypto.randomBytes(8).toString('hex')}`,
      type: 'message',
      role: 'assistant',
      model: tier.id,
      content: content.length ? content : [{ type: 'text', text: '' }],
      stop_reason: stop,
      stop_sequence: null,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
    })
  }

  // Streaming Anthropic-compatible SSE
  const upstream = await callKumo(openaiBody, { stream: true })
  if (!upstream.ok) {
    const text = await upstream.text()
    return sendJson(res, upstream.status, {
      type: 'error',
      error: { type: 'api_error', message: text.slice(0, 500) },
    })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const msgId = `msg_${crypto.randomBytes(8).toString('hex')}`
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

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const ensureTextBlock = () => {
    if (textStarted) return
    textStarted = true
    sseWrite(res, 'content_block_start', {
      type: 'content_block_start',
      index: blockIndex,
      content_block: { type: 'text', text: '' },
    })
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
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
        ensureTextBlock()
        sseWrite(res, 'content_block_delta', {
          type: 'content_block_delta',
          index: blockIndex,
          delta: { type: 'text_delta', text: delta.content },
        })
      }
      if (delta.tool_calls) {
        if (textStarted) {
          sseWrite(res, 'content_block_stop', { type: 'content_block_stop', index: blockIndex })
          blockIndex += 1
          textStarted = false
        }
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolBuf.has(idx)) {
            const id = tc.id || `tool_${crypto.randomBytes(6).toString('hex')}`
            toolBuf.set(idx, { id, name: tc.function?.name || '', args: '', anthropicIndex: blockIndex })
            sseWrite(res, 'content_block_start', {
              type: 'content_block_start',
              index: blockIndex,
              content_block: { type: 'tool_use', id, name: tc.function?.name || '', input: {} },
            })
            blockIndex += 1
          }
          const entry = toolBuf.get(idx)
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

function serveLoginPage(res) {
  const logo = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'), 'utf8')
  const html = `<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Войти в Beam Agent — ASSISTIX ID</title>
<style>
  :root { --brand:#00B3BC; --bg:#05100f; --card:#0b1a18; --ink:#eaf5f3; --muted:#8fbab4; --line:#1f3d38; }
  *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:Segoe UI,system-ui,sans-serif;background:
    radial-gradient(900px 500px at 10% -10%, rgba(0,179,188,.25), transparent 55%),
    radial-gradient(700px 400px at 100% 0%, rgba(45,212,191,.12), transparent 50%),
    var(--bg); color:var(--ink); display:grid; place-items:center; padding:24px}
  .card{width:min(440px,100%); background:var(--card); border:1px solid var(--line); border-radius:20px; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,.35)}
  .logo{display:flex;justify-content:center;margin-bottom:18px}
  .logo svg{width:min(280px,100%); height:auto}
  h1{margin:0 0 8px; font-size:22px; text-align:center}
  p{margin:0 0 18px; color:var(--muted); text-align:center; line-height:1.45; font-size:14px}
  label{display:block;font-size:12px;color:var(--muted);margin:12px 0 6px}
  input{width:100%;border:1px solid var(--line);background:#071412;color:var(--ink);border-radius:12px;padding:12px 14px;font-size:14px}
  button{width:100%;margin-top:18px;border:0;border-radius:12px;padding:13px 16px;font-weight:700;font-size:14px;color:#042f2e;background:linear-gradient(135deg,#2dd4bf,#00B3BC 55%,#0f766e);cursor:pointer}
  button.secondary{margin-top:10px;background:transparent;color:var(--ink);border:1px solid var(--line)}
  .hint{margin-top:14px;font-size:12px;color:var(--muted);text-align:center}
</style></head>
<body>
  <div class="card">
    <div class="logo">${logo}</div>
    <h1>ASSISTIX ID</h1>
    <p>Войдите, чтобы открыть Beam Agent с моделями Tide, Flare и Pine. Настройка API не нужна.</p>
    <label>Email</label>
    <input id="email" type="email" placeholder="you@assistix.org" value=""/>
    <label>Имя</label>
    <input id="name" type="text" placeholder="Summer" value=""/>
    <button id="login">Войти через ASSISTIX ID</button>
    <button class="secondary" id="id">Открыть id.assistix.org</button>
    <div class="hint">Хостинг Assistix сейчас может быть на паузе — локальный вход всё равно активирует встроенный Kumorouter.</div>
  </div>
  <script>
    const post = async (email, name) => {
      const r = await fetch('/assistix/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, name }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'login failed');
      location.href = '/assistix/done';
    };
    document.getElementById('login').onclick = () => post(document.getElementById('email').value.trim() || 'user@assistix.org', document.getElementById('name').value.trim() || 'Assistix User').catch(e => alert(e.message));
    document.getElementById('id').onclick = () => window.open('${ID_BASE}/auth?client_id=assistix-agent&redirect_uri=' + encodeURIComponent('http://127.0.0.1:${PORT}/assistix/callback'), '_blank');
  </script>
</body></html>`
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(html)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      })
      return res.end()
    }

    if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'beam-bridge' })

    if (url.pathname === '/assistix/status') {
      const state = loadState()
      return sendJson(res, 200, {
        signedIn: !!state.session,
        user: state.session,
        quotas: state.quotas,
        models: Object.values(MODELS).map((m) => ({
          id: m.id,
          name: m.name,
          backend: m.backend,
          limit: m.limit,
          used: state.quotas[m.id]?.used || 0,
        })),
      })
    }

    if (url.pathname === '/assistix/login' && req.method === 'POST') {
      const raw = await readBody(req)
      const body = JSON.parse(raw.toString('utf8') || '{}')
      const state = loadState()
      state.session = {
        id: crypto.randomUUID(),
        email: body.email || 'user@assistix.org',
        name: body.name || 'Assistix User',
        provider: 'assistix-id',
        at: new Date().toISOString(),
      }
      // reset quotas on fresh login for local desktop pool
      state.quotas = {
        tide: { used: 0, limit: MODELS.tide.limit },
        flare: { used: 0, limit: MODELS.flare.limit },
        pine: { used: 0, limit: MODELS.pine.limit },
      }
      saveState(state)
      return sendJson(res, 200, { ok: true, user: state.session, quotas: state.quotas })
    }

    if (url.pathname === '/assistix/logout' && req.method === 'POST') {
      const state = loadState()
      state.session = null
      saveState(state)
      return sendJson(res, 200, { ok: true })
    }

    if (url.pathname === '/assistix/login' && req.method === 'GET') return serveLoginPage(res)
    if (url.pathname === '/assistix/done') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end('<html><body style="font-family:Segoe UI;background:#05100f;color:#eaf5f3;display:grid;place-items:center;height:100vh"><div><h2>Готово</h2><p>Можно вернуться в Beam Agent.</p></div></body></html>')
    }
    if (url.pathname === '/assistix/callback') {
      // OAuth return — accept query token/code if present, otherwise open login form
      const state = loadState()
      state.session = {
        id: crypto.randomUUID(),
        email: url.searchParams.get('email') || 'user@assistix.org',
        name: url.searchParams.get('name') || 'Assistix User',
        provider: 'assistix-id-oauth',
        code: url.searchParams.get('code') || null,
        at: new Date().toISOString(),
      }
      saveState(state)
      res.writeHead(302, { Location: '/assistix/done' })
      return res.end()
    }

    // Anthropic Messages root used by Harness: {baseURL}/v1/messages where baseURL ends with /anthropic
    if ((url.pathname === '/anthropic/v1/messages' || url.pathname === '/v1/messages') && req.method === 'POST') {
      return await handleMessages(req, res)
    }

    // Lightweight OpenAI passthrough for debugging
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const raw = await readBody(req)
      const body = JSON.parse(raw.toString('utf8') || '{}')
      const tier = resolveTier(body.model)
      body.model = tier.backend
      const upstream = await callKumo(body, { stream: !!body.stream })
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' })
      return res.end(buf)
    }

    sendJson(res, 404, { error: 'not_found', path: url.pathname })
  } catch (error) {
    sendJson(res, 500, { type: 'error', error: { type: 'api_error', message: String(error?.stack || error) } })
  }
})

function listen(port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(port))
  })
}

ensureData()
const state = loadState()
if (!state.session) {
  // Auto-provision a local Assistix session so first launch is ready after UI login,
  // but do not invent a user until login — quotas still exist.
  saveState(state)
}

listen(PORT).then((port) => {
  console.log(`[beam-bridge] http://127.0.0.1:${port}`)
  console.log(`[beam-bridge] anthropic base: http://127.0.0.1:${port}/anthropic`)
  console.log(`[beam-bridge] assistix login: http://127.0.0.1:${port}/assistix/login`)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
