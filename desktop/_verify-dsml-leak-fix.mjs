/**
 * Verify DSML tool-leak fix is shipped in runtime + dist.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
function check(ok, msg) {
  console.log(ok ? 'OK' : 'FAIL', msg)
  if (!ok) failed++
}

const bridges = [
  path.join(ROOT, 'desktop', 'bridge', 'server.js'),
  path.join(ROOT, 'dist', 'Beam-Agent', 'bridge', 'server.js'),
]
for (const b of bridges) {
  const s = fs.readFileSync(b, 'utf8')
  check(s.includes('function extractDsmlToolCalls'), `extractDsml ${path.relative(ROOT, b)}`)
  check(s.includes('createDsmlStreamGate'), `stream gate ${path.relative(ROOT, b)}`)
  check(s.includes('!pipe.hadDsml'), `no continue on dsml ${path.relative(ROOT, b)}`)
  check(s.includes('// #region beam-dsml-tool-leak'), `region ${path.relative(ROOT, b)}`)
  // scrubBrandLeak must NOT strip DSML before parse
  const scrub = s.slice(s.indexOf('function scrubBrandLeak'), s.indexOf('// #endregion beam-persona-bridge'))
  check(!scrub.includes('stripDsmlMarkup'), `scrubBrandLeak does not eat DSML early`)
}

const chats = [
  path.join(ROOT, 'runtime', 'app', 'beam', 'node_modules', '@assistix', 'beam-client-ui-chat', 'lib', 'client.js'),
  path.join(ROOT, 'dist', 'Beam-Agent', 'resources', 'app', 'beam', 'node_modules', '@assistix', 'beam-client-ui-chat', 'lib', 'client.js'),
]
for (const c of chats) {
  const s = fs.readFileSync(c, 'utf8')
  check(s.includes('BEAM_DSML_DISPLAY_SCRUB'), `display scrub ${path.relative(ROOT, c)}`)
  check(s.includes('__beamScrubDsmlDisplay(block.text)'), `wrap block.text ${path.relative(ROOT, c)}`)
}

const persona = fs.readFileSync(path.join(ROOT, 'desktop', 'identity', 'persona.common.txt'), 'utf8')
check(persona.includes('CHAT OUTPUT HYGIENE'), 'persona hygiene')

const t = spawnSync(process.execPath, [path.join(ROOT, 'desktop', '_test-dsml-extract.mjs')], {
  encoding: 'utf8',
  cwd: ROOT,
})
check(t.status === 0 && /OK\s*$/.test(t.stdout.trim().split('\n').pop() || ''), 'unit extract')
if (t.status !== 0) console.log(t.stdout, t.stderr)

const envFile = path.join(process.env.USERPROFILE || '', '.beam', '.env')
if (fs.existsSync(envFile)) {
  check(!fs.readFileSync(envFile, 'utf8').includes('BEAM_BASE_URL'), 'no BEAM_BASE_URL')
} else {
  check(true, 'no .env')
}

process.exit(failed ? 1 : 0)
