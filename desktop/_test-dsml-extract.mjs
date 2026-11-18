import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import path from 'node:path'

const src = fs.readFileSync(new URL('./bridge/server.js', import.meta.url), 'utf8')
const start = src.indexOf('// #region beam-dsml-tool-leak')
const end = src.indexOf('// #endregion beam-dsml-tool-leak') + '// #endregion beam-dsml-tool-leak'.length
if (start < 0) throw new Error('dsml region missing')
const chunk = src.slice(start, end)
const ctx = { crypto, path, console }
vm.createContext(ctx)
vm.runInContext(`${chunk}\n;this.__r = { extractDsmlToolCalls, mergeToolCalls, dsmlLooksIncomplete, stripDsmlMarkup, createDsmlStreamGate };`, ctx)

const body = 'x'.repeat(500)
const sample = [
  'Lead prose about the deck.',
  '',
  '<｜DSML｜ calls>',
  '<｜DSML｜ invoke name="Write">',
  '<｜DSML｜ parameter name="file_path" string="true">C:\\Users\\Alexa\\.beam\\projects\\123\\build_deck.py</｜DSML｜ parameter>',
  `<｜DSML｜ parameter name="content" string="true">${body}</｜DSML｜ parameter>`,
  '</｜DSML｜ invoke>',
  '</｜DSML｜ calls>',
].join('\n')

const r = ctx.__r.extractDsmlToolCalls(sample)
console.log('fullwidth:', {
  text: r.text,
  tools: r.toolCalls.map((t) => ({
    name: t.function.name,
    path: JSON.parse(t.function.arguments).file_path,
    contentLen: JSON.parse(t.function.arguments).content?.length,
  })),
  had: r.hadDsml,
  incomplete: r.incomplete,
})

const spaced = sample.replace(/｜/g, ' | ').replace(/</g, '< ').replace(/>/g, ' >')
const r2 = ctx.__r.extractDsmlToolCalls(spaced)
console.log('spaced OCR-like tools:', r2.toolCalls.length, 'text:', JSON.stringify(r2.text))

const gate = ctx.__r.createDsmlStreamGate()
const chunks = ['Hello ', 'world\n', sample.slice(0, 40), sample.slice(40)]
let emitted = ''
for (const c of chunks) emitted += gate.feed(c)
const fin = gate.finalize()
emitted += fin.flush
console.log('stream gate:', {
  emitted,
  finalText: fin.text,
  tools: fin.toolCalls.length,
  hadDsml: fin.hadDsml,
})

if (!r.toolCalls.length) {
  console.error('FAIL: expected tool calls')
  process.exit(1)
}
if (/DSML/i.test(r.text)) {
  console.error('FAIL: DSML leaked into text', r.text)
  process.exit(1)
}
console.log('OK')
