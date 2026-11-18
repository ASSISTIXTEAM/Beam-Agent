import * as asar from '@electron/asar'
import fs from 'node:fs'
import path from 'node:path'

const src = 'C:/Users/Alexa/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const dest = 'C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist'

fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(dest, { recursive: true })

const marker = 'dsh-web-frontend\\dist\\'
const all = asar.listPackage(src).filter((f) => String(f).includes('dsh-web-frontend') && String(f).includes('dist'))
let n = 0
for (const f of all) {
  const raw = String(f)
  const norm = raw.replaceAll('/', '\\')
  const idx = norm.toLowerCase().indexOf(marker.toLowerCase())
  if (idx < 0) continue
  const rel = norm.slice(idx + marker.length)
  if (!rel || !path.extname(rel)) continue // skip directory stubs
  try {
    const buf = asar.extractFile(src, raw.startsWith('\\') ? raw.slice(1).replaceAll('\\', '/') : raw.replaceAll('\\', '/'))
    // try multiple path styles
    let data = null
    const candidates = [
      raw,
      raw.replaceAll('\\', '/'),
      raw.replace(/^\\/, ''),
      raw.replace(/^\\/, '').replaceAll('\\', '/'),
      `/${raw.replace(/^\\/, '').replaceAll('\\', '/')}`,
    ]
    for (const c of candidates) {
      try {
        data = asar.extractFile(src, c)
        break
      } catch {}
    }
    if (!data) continue
    const out = path.join(dest, rel.replaceAll('\\', path.sep))
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, data)
    n++
  } catch (e) {
    console.log('skip', raw, e.message)
  }
}
console.log('restored', n)
console.log('index', fs.existsSync(path.join(dest, 'index.html')))
console.log('assets', fs.existsSync(path.join(dest, 'assets')))
