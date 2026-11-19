import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT = path.join(ROOT, 'dist', 'installers')
const VERSION = '0.1.8'
const EXE = 'Beam-Agent-0.1.8-Setup.exe'
const GH_URL = `https://github.com/ASSISTIXTEAM/Beam-Agent/releases/download/v${VERSION}/${EXE}`
const artifact = path.join(OUT, EXE)

if (!fs.existsSync(artifact)) {
  console.error('Missing', artifact)
  process.exit(1)
}

const buf = fs.readFileSync(artifact)
const digest = crypto.createHash('sha512').update(buf).digest('base64')
const size = buf.length
const releaseDate = new Date().toISOString()
const body =
  `version: ${VERSION}\n` +
  `files:\n` +
  `  - url: ${GH_URL}\n` +
  `    sha512: ${digest}\n` +
  `    size: ${size}\n` +
  `path: ${GH_URL}\n` +
  `sha512: ${digest}\n` +
  `releaseDate: '${releaseDate}'\n`

for (const name of ['nightly.yml', 'latest.yml']) {
  fs.writeFileSync(path.join(OUT, name), body)
  console.log('wrote', name)
}
console.log('sizeMB', (size / (1024 * 1024)).toFixed(1))
console.log('sha512', digest.slice(0, 32) + '...')
