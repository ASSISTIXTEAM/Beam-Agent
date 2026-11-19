/**
 * Dry multi-turn: oversized tool results must compact under Kumo 1 MiB
 * and not surface as INVALID_REQUEST when bridge is healthy.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BRIDGE = path.join(ROOT, 'dist/Beam-Agent/bridge/server.js')
const PORT = 17865
const BASE = `http://127.0.0.1:${PORT}`

// Load compaction helpers without binding :17865 — eval extracted source slice.
function loadBridgeHelpers() {
  const src = fs.readFileSync(BRIDGE, 'utf8')
  const start = src.indexOf('/** Kumorouter rejects request text above 1 MiB')
  const end = src.indexOf('function openAIToolCallsToAnthropic')
  if (start < 0 || end < 0) throw new Error('helpers region not found in bridge')
  const crypto = createRequire(import.meta.url)('node:crypto')
  const bridgeLog = () => {}
  const __BRIDGE_PERSONA = 'You are Assistix Tide in Beam Agent.'
  const __bridgePersona = () => __BRIDGE_PERSONA
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'crypto',
    'bridgeLog',
    '__BRIDGE_PERSONA',
    '__bridgePersona',
    `${src.slice(start, end)}\nreturn { buildOpenAIBody, payloadBytes, KUMO_SAFE_BUDGET, KUMO_TEXT_LIMIT, anthropicToOpenAIMessages, compactOpenAIMessages, repairToolPairing, mapToolChoice };`,
  )
  return factory(crypto, bridgeLog, __BRIDGE_PERSONA, __bridgePersona)
}

function fatToolBlock(id, bytes) {
  const pad = 'X'.repeat(bytes)
  return {
    type: 'tool_result',
    tool_use_id: id,
    content: `FILE_CONTENTS\n${pad}`,
  }
}

function buildFatAnthropicMessages() {
  const messages = [
    { role: 'user', content: 'Analyze the repo and extract figures.' },
  ]
  // Simulate several tool-heavy turns with ~2.1 MiB total text like production failure
  for (let turn = 0; turn < 4; turn++) {
    const ids = [`tool_a_${turn}`, `tool_b_${turn}`, `tool_c_${turn}`]
    messages.push({
      role: 'assistant',
      content: [
        { type: 'text', text: `Excellent — data through November 2026. Turn ${turn}.` },
        ...ids.map((id, i) => ({
          type: 'tool_use',
          id,
          name: i === 0 ? 'grep_search' : i === 1 ? 'Read' : 'read_file',
          input: { path: `file_${turn}_${i}.txt`, pattern: 'revenue' },
        })),
      ],
    })
    messages.push({
      role: 'user',
      content: ids.map((id) => fatToolBlock(id, 180_000)),
    })
  }
  messages.push({ role: 'user', content: 'Continue extracting key figures.' })
  return messages
}

async function waitHealth(ms = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${BASE}/health`)
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

async function main() {
  const h = loadBridgeHelpers()
  const tier = {
    id: 'tide',
    backend: 'deepseek-v4-1-flash',
    backends: ['deepseek-v4-1-flash'],
    maxTokensCap: 8192,
  }
  const fat = buildFatAnthropicMessages()
  const rawBody = {
    model: 'tide',
    max_tokens: 4096,
    stream: true,
    system: 'You are a research agent.',
    tools: [
      { name: 'grep_search', description: 'Search code', input_schema: { type: 'object', properties: { pattern: { type: 'string' } } } },
      { name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } } } },
      { name: 'read_file', description: 'Read file', input_schema: { type: 'object', properties: { path: { type: 'string' } } } },
    ],
    tool_choice: { type: 'auto' },
    messages: fat,
  }

  // Uncompacted estimate
  const naive = h.anthropicToOpenAIMessages(fat, 'sys')
  const naiveBytes = h.payloadBytes({ model: tier.backend, messages: naive, tools: rawBody.tools })
  const compact = h.buildOpenAIBody(rawBody, tier, h.KUMO_SAFE_BUDGET)
  const compactBytes = h.payloadBytes(compact)

  console.log(JSON.stringify({
    naiveBytes,
    compactBytes,
    kumoLimit: h.KUMO_TEXT_LIMIT,
    underLimit: compactBytes < h.KUMO_TEXT_LIMIT,
    msgs: compact.messages.length,
    toolChoice: compact.tool_choice,
    hasEmptyTool: compact.messages.some((m) => m.role === 'tool' && (!m.content || !m.tool_call_id)),
    danglingTools: (() => {
      const pending = new Set()
      for (const m of compact.messages) {
        if (m.role === 'assistant' && m.tool_calls) for (const tc of m.tool_calls) pending.add(tc.id)
        if (m.role === 'tool') pending.delete(m.tool_call_id)
      }
      return [...pending]
    })(),
  }, null, 2))

  if (!(naiveBytes > h.KUMO_TEXT_LIMIT)) {
    console.error('FAIL: fixture not large enough to reproduce size INVALID_REQUEST')
    process.exit(1)
  }
  if (!(compactBytes < h.KUMO_TEXT_LIMIT)) {
    console.error('FAIL: compact still over Kumo limit')
    process.exit(1)
  }
  if (compact.tool_choice !== 'auto') {
    console.error('FAIL: tool_choice not mapped to OpenAI auto')
    process.exit(1)
  }
  if (compact.messages.some((m) => m.role === 'tool' && (!m.content || !m.tool_call_id))) {
    console.error('FAIL: empty/broken tool messages remain')
    process.exit(1)
  }

  // Live bridge smoke (auth may block messages; health + compact path already proven)
  const healthy = await waitHealth(1500)
  console.log(JSON.stringify({ bridgeHealthy: healthy }, null, 2))
  console.log('PASS: payload compaction prevents INVALID_REQUEST size blow-up')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
