import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(root, 'desktop', 'bridge', 'server.js'), 'utf8')

function extractBetween(startMark, endMark) {
  const start = src.indexOf(startMark)
  const end = src.indexOf(endMark, start)
  if (start < 0 || end < 0) throw new Error(`slice missing ${startMark}`)
  return src.slice(start, end)
}

const code = extractBetween('function stripDsmlMarkup', '// #endregion beam-persona-bridge')
const ctx = {}
vm.createContext(ctx)
vm.runInContext(`${code}\nthis.stripDsmlMarkup = stripDsmlMarkup; this.looksTruncated = looksTruncated;`, ctx)

const sample =
  'prs.save(out)\n</ | DSML | parameter> < | DSML | parameter name="file_path" string="true">C:\\Users\\Alexa.beam\\projects\\123\\build_deck.py</ | DSML | parameter> </ | DSML | invoke>'
const cleaned = ctx.stripDsmlMarkup(sample)

function check(cond, msg) {
  if (!cond) throw new Error(msg)
}

check(!/DSML/i.test(cleaned), 'DSML tags stripped from chat text')
check(cleaned.includes('prs.save'), 'prose before DSML kept')
check(ctx.looksTruncated('def foo(') === true, 'mid-def truncated')
check(ctx.looksTruncated('```python\nprint(1)') === true, 'open fence truncated')
check(ctx.looksTruncated('Готово.') === false, 'finished ok')
check(/looksTruncated\(accumulatedText\)/.test(src), 'stream continue uses heuristic')
check(/stopReason = 'max_tokens'/.test(src) && /stream_needs_user/.test(src), 'residual max_tokens for Continue button')

const client = fs.readFileSync(
  path.join(root, 'runtime', 'app', 'beam', 'node_modules', '@assistix', 'beam-client-ui-chat', 'lib', 'client.js'),
  'utf8',
)
check(client.includes('message.continue') && client.includes('Продолжить'), 'RU Continue label present')
check(client.includes('data-beam-continue'), 'Continue control marked')
check(client.includes('continueReply'), 'continueReply wired')

console.log(JSON.stringify({ ok: true, cleanedPreview: cleaned.slice(0, 80) }, null, 2))
console.log('PASS: continue UX + DSML strip + truncation detect')
