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
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(process.env.BEAM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.beam'), 'bridge')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const PORT = Number(process.env.BEAM_BRIDGE_PORT || 17865)

const KUMO_URL = process.env.KUMO_API_URL || 'https://api.kumorouter.com/v1/chat/completions'
const KUMO_KEY = process.env.KUMO_API_KEY || 'YOUR_KUMO_API_KEY_HERE'
const ID_BASE = process.env.ASSISTIX_ID_URL || 'https://id.assistix.org'

/**
 * Beam Agent catalog (display → Kumorouter).
 * Tide = cheapest reliable flash; Flare = mid flash; Pine = strongest still-cheap.
 * `backends` tried in order on socket/5xx failures (VPN/fake-ip flakiness).
 */
const MODELS = {
  tide: {
    id: 'tide',
    name: 'Tide',
    backend: 'deepseek-v4-1-flash',
    backends: ['deepseek-v4-1-flash', 'qwen3-8-flash', 'deepseek-v4-flash'],
    limit: 1_000_000,
    maxTokensCap: 8192,
    aliases: ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-1-flash', 'tide'],
  },
  flare: {
    id: 'flare',
    name: 'Flare',
    backend: 'google/gemini-3.1-flash-lite',
    backends: ['google/gemini-3.1-flash-lite', 'gemini-3.8-flash', 'qwen3-8-flash', 'gemini-3.6-flash'],
    limit: 500_000,
    maxTokensCap: 12288,
    aliases: ['flair', 'flare', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'google/gemini-3.1-flash-lite', 'google/gemini-3.8-flash-high'],
  },
  pine: {
    id: 'pine',
    name: 'Pine',
    backend: 'xai/grok-4.7',
    backends: ['xai/grok-4.7', 'deepseek-v4-pro-0813', 'google/gemini-3.6-flash-high', 'xai/grok-4.6'],
    limit: 10_000,
    maxTokensCap: 16384,
    aliases: ['pine', 'grok-4.7', 'xai/grok-4.7', 'deepseek-v4-pro', 'deepseek-v4-pro-0813'],
  },
}

function bridgeLog(line) {
  try { fs.appendFileSync(path.join(DATA_DIR, 'bridge.log'), `[${new Date().toISOString()}] ${line}\n`) } catch {}
}

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(STATE_FILE)) {
    const initial = {
      session: null,
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
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
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

function textFromAnthropicContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      if (block.type === 'text') return block.text || ''
      if (block.type === 'tool_result') {
        const out = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '')
        return out
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function anthropicToOpenAIMessages(messages = [], system) {
  const out = []
  if (system) {
    const sys = typeof system === 'string' ? system : textFromAnthropicContent(system)
    if (sys) out.push({ role: 'system', content: sys })
  }
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : msg.role
    if (Array.isArray(msg.content)) {
      const toolCalls = []
      const texts = []
      const toolResults = []
      for (const block of msg.content) {
        if (!block) continue
        if (block.type === 'text') texts.push(block.text || '')
        else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id || `tool_${crypto.randomBytes(6).toString('hex')}`,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          })
        } else if (block.type === 'tool_result') {
          toolResults.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
          })
        }
      }
      if (role === 'assistant' && (texts.length || toolCalls.length)) {
        const row = { role: 'assistant', content: texts.join('\n') || null }
        if (toolCalls.length) row.tool_calls = toolCalls
        out.push(row)
      } else if (toolResults.length) {
        out.push(...toolResults)
      } else {
        out.push({ role: role === 'tool' ? 'user' : role, content: texts.join('\n') })
      }
    } else {
      out.push({ role, content: msg.content ?? '' })
    }
  }
  return out
}

function anthropicToolsToOpenAI(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.input_schema || t.parameters || { type: 'object', properties: {} },
    },
  }))
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

async function callKumoOnce(payload, { stream }) {
  return fetch(KUMO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KUMO_KEY}`,
      'Content-Type': 'application/json',
      Accept: stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify({ ...payload, stream: !!stream }),
    signal: AbortSignal.timeout(180_000),
  })
}

function isRetryableKumoFailure(err, status) {
  if (status && status >= 500) return true
  const cause = String(err?.cause?.code || err?.code || err?.message || err || '')
  return /UND_ERR_SOCKET|ECONNRESET|ETIMEDOUT|ENOTFOUND|FETCH_FAILED|terminated|socket|SSL|EOF|closed/i.test(cause)
}

async function callKumo(payload, { stream, backends }) {
  const modelList = (Array.isArray(backends) && backends.length ? backends : [payload.model]).filter(Boolean)
  let lastErr
  for (const model of modelList) {
    const nextPayload = { ...payload, model }
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await callKumoOnce(nextPayload, { stream })
        if (!res.ok && res.status >= 500 && attempt < 2) {
          bridgeLog(`kumo_http_${res.status} model=${model} attempt=${attempt}`)
          await new Promise((r) => setTimeout(r, 350 * attempt))
          continue
        }
        if (!res.ok && res.status >= 500 && model !== modelList[modelList.length - 1]) {
          bridgeLog(`kumo_fallback_http status=${res.status} from=${model}`)
          break // try next backend
        }
        if (model !== payload.model) bridgeLog(`kumo_using_fallback model=${model}`)
        return res
      } catch (e) {
        lastErr = e
        const cause = e?.cause?.code || e?.cause?.message || e?.code || e?.message || e
        bridgeLog(`kumo_fetch_fail attempt=${attempt} model=${model} cause=${cause}`)
        if (!isRetryableKumoFailure(e) || attempt >= 2) break
        await new Promise((r) => setTimeout(r, 400 * attempt))
      }
    }
  }
  const err = new Error(
    'Нет связи с модельным API (сеть/VPN). Проверьте интернет и повторите.'
  )
  err.cause = lastErr
  err.status = 502
  throw err
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
    if (msg.content) content.push({ type: 'text', text: scrubBrandLeak(msg.content) })
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
          delta: { type: 'text_delta', text: scrubBrandLeak(delta.content) },
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
  } catch (e) {
    bridgeLog(`handleMessages_fail ${e?.stack || e}`)
    if (!res.headersSent) {
      return sendJson(res, 502, {
        type: 'error',
        error: { type: 'api_error', message: e?.message || 'Ошибка bridge. Попробуйте ещё раз.' },
      })
    }
    try { res.end() } catch {}
  }
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

    // Anthropic-compatible model listing — Tide / Flare / Pine only
    // Must include api_capabilities.anthropic_messages or Harness marks every entry unusable.
    if (
      (url.pathname === '/models' ||
        url.pathname === '/v1/models' ||
        url.pathname === '/anthropic/v1/models' ||
        url.pathname === '/anthropic/models') &&
      req.method === 'GET'
    ) {
      const state = loadState()
      if (!requireAuth(res, state)) return
      const data = Object.values(MODELS).map((m) => ({
        id: m.id,
        object: 'model',
        created: 0,
        owned_by: 'beam-agent',
        display_name: m.name,
        name: m.name,
        context_window: m.id === 'tide' ? 1_048_576 : m.id === 'flare' ? 524_288 : 16_384,
        max_output_tokens: m.id === 'pine' ? 8192 : 65536,
        input_modalities: m.id === 'pine' ? ['text'] : ['text', 'image'],
        output_modalities: ['text'],
        api_capabilities: {
          anthropic_messages: {
            system_prompt_update: 'in-history',
            tool_update: 'addition-only',
          },
        },
      }))
      return sendJson(res, 200, { object: 'list', data })
    }

    if (url.pathname === '/assistix/me' || url.pathname === '/assistix/status') {
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
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'bridge.log'), `[beam-bridge] listening on 127.0.0.1:${port}\n`, 'utf8')
  } catch {}
}).catch((err) => {
  try {
    fs.writeFileSync(path.join(DATA_DIR, 'bridge.log'), String(err?.stack || err), 'utf8')
  } catch {}
  process.exit(1)
})
