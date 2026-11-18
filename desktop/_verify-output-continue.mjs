/**
 * Verify output-token smart caps + continuation helpers without live Kumo.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(root, 'desktop', 'bridge', 'server.js'), 'utf8')

function extract(fnName) {
  const start = src.indexOf(`function ${fnName}`)
  if (start < 0) throw new Error(`missing ${fnName}`)
  let i = src.indexOf('{', start)
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return src.slice(start, i)
}

const MODELS = {
  tide: { id: 'tide', maxTokensCap: 65536, maxTokensDefault: 65536 },
  flare: { id: 'flare', maxTokensCap: 65536, maxTokensDefault: 65536 },
  pine: { id: 'pine', maxTokensCap: 65536, maxTokensDefault: 65536 },
}

const sandbox = {
  MODELS,
  MAX_OUTPUT_CONTINUES: 8,
  OUTPUT_CONTINUE_PROMPT: 'Continue exactly where you left off. Do not repeat earlier text. Output only the continuation.',
  KUMO_SAFE_BUDGET: 900_000,
  KUMO_HARD_BUDGET: 550_000,
  MAX_TOOL_CONTENT: 100_000,
  MAX_MSG_CONTENT: 160_000,
  MAX_TOOL_ARGS: 24_000,
  MAX_TOOL_DESC: 4_000,
  bridgeLog() {},
  console,
}
const helpers = [
  'resolveMaxTokens',
  'clipText',
  'payloadBytes',
  'repairToolPairing',
  'clipMessagesInPlace',
  'compactOpenAIMessages',
  'buildContinuationOpenAIBody',
]
// Pull supporting fns by scanning source for needed names in dependency order.
const needed = [
  'function clipText',
  'function payloadBytes',
  'function repairToolPairing',
  'function clipMessagesInPlace',
  'function compactOpenAIMessages',
  'function resolveMaxTokens',
  'function buildContinuationOpenAIBody',
]
let code = ''
for (const marker of needed) {
  const name = marker.replace(/^function /, '')
  code += extract(name) + '\n'
}
code += `
globalThis.__out = {
  resolveMaxTokens,
  buildContinuationOpenAIBody,
  compactOpenAIMessages,
  MODELS,
  MAX_OUTPUT_CONTINUES,
};
`
vm.createContext(sandbox)
vm.runInContext(code, sandbox)
const h = sandbox.__out

function check(cond, msg) {
  if (!cond) throw new Error(msg)
}

check(h.resolveMaxTokens({ max_tokens: 256000 }, MODELS.tide) === 65536, 'cap high request')
check(h.resolveMaxTokens({ max_tokens: 8192 }, MODELS.tide) === 65536, 'lift stale 8k')
check(h.resolveMaxTokens({ max_tokens: 12288 }, MODELS.flare) === 65536, 'lift stale 12k')
check(h.resolveMaxTokens({ max_tokens: 16384 }, MODELS.pine) === 65536, 'lift stale 16k')
check(h.resolveMaxTokens({ max_tokens: 4096 }, MODELS.tide) === 4096, 'honor intentional low')
check(h.resolveMaxTokens({}, MODELS.pine) === 65536, 'default when missing')
check(h.resolveMaxTokens({ max_tokens: 40000 }, MODELS.pine) === 40000, 'honor mid request')

const cont = h.buildContinuationOpenAIBody(
  {
    model: 'deepseek-v4-1-flash',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'write a long pptx' },
    ],
    max_tokens: 65536,
    tools: [{ type: 'function', function: { name: 'x', description: 'y', parameters: {} } }],
    tool_choice: 'auto',
  },
  'partial code up to series.format.line.dash_style =',
)
check(!cont.tools && !cont.tool_choice, 'continuation drops tools')
check(cont.messages.at(-1)?.content.includes('Continue exactly'), 'continue prompt present')
check(cont.messages.at(-2)?.role === 'assistant', 'assistant partial present')
check(cont.messages.at(-2)?.content.includes('dash_style'), 'partial preserved')
check(h.MAX_OUTPUT_CONTINUES >= 6, 'continue cap configured')

// listing alignment in source
check(/maxTokensCap:\s*65536/.test(src), 'tide/flare/pine caps raised in source')
check(/max_output_tokens:\s*m\.maxTokensCap/.test(src), 'models listing uses maxTokensCap')
check(/output_continue/.test(src), 'auto-continue logging present')
check(/stream_needs_user/.test(src) && /looksTruncated/.test(src), 'truncation detect + Continue path present')

console.log(JSON.stringify({
  ok: true,
  resolve: {
    stale8k: h.resolveMaxTokens({ max_tokens: 8192 }, MODELS.tide),
    mid: h.resolveMaxTokens({ max_tokens: 40000 }, MODELS.pine),
    missing: h.resolveMaxTokens({}, MODELS.flare),
  },
  continueMsgs: cont.messages.length,
  maxContinues: h.MAX_OUTPUT_CONTINUES,
}, null, 2))
console.log('PASS: output continue + smart max_tokens')
