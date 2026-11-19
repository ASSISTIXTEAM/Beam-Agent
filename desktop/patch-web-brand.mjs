import fs from 'node:fs'
import path from 'node:path'

const assets = path.join(
  'C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets',
)
for (const f of fs.readdirSync(assets).filter((x) => x.endsWith('.js'))) {
  const p = path.join(assets, f)
  const s = fs.readFileSync(p, 'utf8')
  const n = s.replaceAll('DeepSeek Harness', 'Beam Agent')
  if (n !== s) {
    fs.writeFileSync(p, n)
    console.log('patched', f)
  }
}
