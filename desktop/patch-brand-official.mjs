import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'C:/Users/Alexa/OneDrive/Documents/Beam Agent'
const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8').replaceAll('fill="#00B3BC"', 'fill="currentColor"')
const word = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'), 'utf8').replaceAll('fill="#00B3BC"', 'fill="currentColor"')
const LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(logo)
const WORD = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(word)

const p = path.join(ROOT, 'dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js')
let s = fs.readFileSync(p, 'utf8')
s = s.replace(
  'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size });',
  `return (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(LOGO)}, alt: "Beam", width: size, height: Math.round(size * 1.038), style: { display: "block" } });`,
)
s = s.replace(
  'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, { includeMark: false });',
  `return (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(WORD)}, alt: "Beam Agent", style: { height: 24, width: "auto", display: "block" } });`,
)
fs.writeFileSync(p, s)
console.log('brand-official patched', !s.includes('FishLogo'), s.includes('"img"'))
