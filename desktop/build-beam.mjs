/**
 * Patch extracted DeepSeek Harness runtime into Beam Agent desktop build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APP = path.join(ROOT, 'runtime', 'app')
const DIST = path.join(ROOT, 'dist', 'Beam Agent')
const DS_INSTALL = 'C:\\Users\\Alexa\\AppData\\Local\\Programs\\DeepSeek Harness'

function mustExist(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`)
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyRecursive(s, d)
    else fs.copyFileSync(s, d)
  }
}

function replaceInFile(file, replacements) {
  if (!fs.existsSync(file)) return false
  let text = fs.readFileSync(file, 'utf8')
  let next = text
  for (const [from, to] of replacements) next = next.split(from).join(to)
  if (next !== text) {
    fs.writeFileSync(file, next)
    return true
  }
  return false
}

function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' && !full.includes(`${path.sep}dsh${path.sep}node_modules${path.sep}@deepseek-ai`)) {
        // still walk @deepseek-ai packages we care about; skip huge trees elsewhere carefully
      }
      walk(full, filter, out)
    } else if (filter(full)) out.push(full)
  }
  return out
}

mustExist(APP)
mustExist(path.join(ROOT, 'logo.svg'))
mustExist(path.join(ROOT, 'logo-beam-agent.svg'))

console.log('→ Patching package identity')
const pkgPath = path.join(APP, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.name = '@assistix/beam-agent-desktop'
pkg.description = 'Beam Agent — Assistix desktop AI agent'
pkg.productName = 'Beam Agent'
pkg.dshDesktopAppId = 'org.assistix.beam-agent'
pkg.dshDesktopUpdateChannel = 'nightly'
pkg.dshMandatoryUpdatePolicy = {
  origin: 'https://agent.assistix.org',
  allowedPageOrigins: ['https://agent.assistix.org', 'https://id.assistix.org', 'https://assistix.org'],
  authentication: 'anonymous',
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

console.log('→ Patching main process branding + home dir')
const mainJs = path.join(APP, 'lib', 'main.js')
replaceInFile(mainJs, [
  ['DeepSeek Harness', 'Beam Agent'],
  ['关于 DeepSeek Harness', '关于 Beam Agent'],
  ['隐藏 DeepSeek Harness', '隐藏 Beam Agent'],
  ['退出 DeepSeek Harness', '退出 Beam Agent'],
  ['打开 DeepSeek Harness', '打开 Beam Agent'],
  ['const DSH_HOME_DIR_NAME = ".dsh";', 'const DSH_HOME_DIR_NAME = ".beam";'],
  ['applicationName: "Beam Agent"', 'applicationName: "Beam Agent"'], // already replaced above
])
{
  let main = fs.readFileSync(mainJs, 'utf8')
  if (!main.includes('Assistix.BeamAgent')) {
    const marker = 'if (claimDesktopSingleInstance(app,'
    const inject = `app.setName("Beam Agent");\nif (process.platform === "win32") {\n\tapp.setAppUserModelId("Assistix.BeamAgent");\n}\n`
    if (!main.includes(marker)) throw new Error('main.js: claimDesktopSingleInstance marker missing')
    main = main.replace(marker, inject + marker)
    fs.writeFileSync(mainJs, main)
    console.log('  injected app.setName + setAppUserModelId')
  }
}

console.log('→ Patching LLM catalog + Kumorouter anthropic bridge base URL')
const llmJs = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm-deepseek', 'lib', 'index.js')
mustExist(llmJs)
let llm = fs.readFileSync(llmJs, 'utf8')
llm = llm.replace(
  /DEFAULT_MODELS = \[[\s\S]*?\];/,
  `DEFAULT_MODELS = [{
\tid: "tide",
\tname: "Tide",
\tdescription: "DeepSeek V4 Flash — быстрая модель Assistix (1M токенов)",
\tcontextWindow: OFFICIAL_CONTEXT_WINDOW,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "flare",
\tname: "Flare",
\tdescription: "Gemini 3.8 Flash — сбалансированная модель Assistix (500K токенов)",
\tcontextWindow: OFFICIAL_CONTEXT_WINDOW,
\tinputModalities: ["text", "image"],
\tsystemPromptUpdate: "in-history",
\ttoolUpdate: "addition-only"
}, {
\tid: "pine",
\tname: "Pine",
\tdescription: "Grok 4.7 — сильный режим Assistix (10K токенов)",
\tcontextWindow: OFFICIAL_CONTEXT_WINDOW
}];`,
)
llm = llm.replace(
  'const PUBLIC_BASE_URL = "https://api.deepseek.com/anthropic";',
  'const PUBLIC_BASE_URL = "http://127.0.0.1:17865/anthropic";',
)
// Keep old ids working by also accepting aliases in listing if present — bridge maps them.
llm = llm.replaceAll('deepseek-flash', 'tide')
llm = llm.replaceAll('deepseek-v4-pro', 'pine')
fs.writeFileSync(llmJs, llm)

// Provider display name
const apiKeyPkg = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-llm-deepseek-api-key', 'lib', 'index.js')
if (fs.existsSync(apiKeyPkg)) {
  replaceInFile(apiKeyPkg, [
    ["displayName: 'DeepSeek'", "displayName: 'Assistix'"],
    ['displayName: "DeepSeek"', 'displayName: "Assistix"'],
    ["providerName: 'DeepSeek'", "providerName: 'Assistix'"],
    ['providerName: "DeepSeek"', 'providerName: "Assistix"'],
  ])
}

console.log('→ Replacing logos / favicons')
const logo = fs.readFileSync(path.join(ROOT, 'logo.svg'))
const wordmark = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'))
const webDist = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist')
fs.writeFileSync(path.join(webDist, 'favicon.svg'), logo)
fs.writeFileSync(path.join(webDist, 'favicon-dark.svg'), logo)
replaceInFile(path.join(webDist, 'index.html'), [
  ['DeepSeek Harness', 'Beam Agent'],
  ['</head>', '<link rel="stylesheet" href="./assets/beam-override.css">\n</head>'],
])
replaceInFile(path.join(webDist, 'manifest.webmanifest'), [
  ['DeepSeek Harness', 'Beam Agent'],
  ['DeepSeek', 'Beam'],
])

const welcomeBrand = path.join(APP, 'renderer', 'assets', 'welcome-brand.svg')
if (fs.existsSync(welcomeBrand)) fs.writeFileSync(welcomeBrand, wordmark)

// Brand official package assets if any svg present
const brandDir = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-brand-official')
if (fs.existsSync(brandDir)) {
  for (const file of walk(brandDir, (f) => f.endsWith('.svg'))) {
    fs.writeFileSync(file, logo)
  }
  for (const file of walk(brandDir, (f) => f.endsWith('.json'))) {
    replaceInFile(file, [
      ['DeepSeek Harness', 'Beam Agent'],
      ['DeepSeek', 'Beam'],
    ])
  }
}

console.log('→ Writing Assistix / Beam theme override')
const themeCss = `
/* Beam Agent — Assistix teal theme (agent.assistix.org language) */
:root {
  --acx-500: #00B3BC !important;
  --acx-600: #0d9488 !important;
  --acx-700: #0f766e !important;
  --acx-400: #2dd4bf !important;
  --acx-300: #5eead4 !important;
  --dsw-accent: #00B3BC !important;
  --dsw-accent-hover: #0d9488 !important;
  --dsw-accent-soft: rgba(0, 179, 188, 0.14) !important;
  --dsw-selection: rgba(45, 212, 191, 0.28) !important;
}
html, body {
  background:
    radial-gradient(1200px 600px at 0% -10%, rgba(0,179,188,.16), transparent 55%),
    radial-gradient(900px 500px at 100% 0%, rgba(45,212,191,.08), transparent 50%),
    #05100f !important;
}
body[data-ds-dark-theme],
:root[data-theme="dark"],
html.dark,
body.dark {
  --dsw-surface-base: #05100f !important;
  --dsw-surface-container: #0b1a18 !important;
  --dsw-surface-elevated: #10211f !important;
  --dsw-line: #1f3d38 !important;
  --dsw-line-strong: #27504a !important;
  --dsw-accent: #2dd4bf !important;
  --dsw-accent-hover: #00B3BC !important;
  color-scheme: dark;
}
/* Soft brand tint on chrome */
[class*="sidebar"], header, nav {
  border-color: #1f3d38 !important;
}
`

const assetsDir = path.join(webDist, 'assets')
fs.mkdirSync(assetsDir, { recursive: true })
fs.writeFileSync(path.join(assetsDir, 'beam-override.css'), themeCss)

// Patch JS bundles branding (careful: don't break API host strings already patched)
for (const file of fs.readdirSync(assetsDir)) {
  if (!file.endsWith('.js')) continue
  const fp = path.join(assetsDir, file)
  let text = fs.readFileSync(fp, 'utf8')
  const next = text
    .replaceAll('DeepSeek Harness', 'Beam Agent')
    .replaceAll('DeepSeek Account', 'ASSISTIX ID')
    .replaceAll('Sign in with DeepSeek', 'Sign in with ASSISTIX ID')
  if (next !== text) {
    fs.writeFileSync(fp, next)
    console.log('  branded', file)
  }
}

console.log('→ Assembling dist/Beam Agent')
fs.rmSync(DIST, { recursive: true, force: true })
fs.mkdirSync(DIST, { recursive: true })

// Copy Electron runtime files from installed DeepSeek Harness (binary + helpers), but NOT its app.asar
for (const name of fs.readdirSync(DS_INSTALL)) {
  if (name === 'resources' || name === 'Uninstall DeepSeek Harness.exe') continue
  const src = path.join(DS_INSTALL, name)
  const destName = name === 'DeepSeek Harness.exe' ? 'Beam Agent.exe' : name
  const dest = path.join(DIST, destName)
  const st = fs.statSync(src)
  if (st.isDirectory()) copyRecursive(src, dest)
  else fs.copyFileSync(src, dest)
}

const resourcesSrc = path.join(DS_INSTALL, 'resources')
const resourcesDest = path.join(DIST, 'resources')
fs.mkdirSync(resourcesDest, { recursive: true })
for (const name of fs.readdirSync(resourcesSrc)) {
  if (name === 'app.asar' || name === 'app.asar.unpacked') continue
  const src = path.join(resourcesSrc, name)
  const dest = path.join(resourcesDest, name)
  const st = fs.statSync(src)
  if (st.isDirectory()) copyRecursive(src, dest)
  else fs.copyFileSync(src, dest)
}

// Place patched app as unpacked directory (Electron loads resources/app)
copyRecursive(APP, path.join(resourcesDest, 'app'))

// Ensure LibreOffice kit RDB files survive packaging (preview otherwise hard-fails).
try {
  const { spawnSync } = await import('node:child_process')
  const fix = path.join(ROOT, 'desktop', 'fix-libreoffice-preview.mjs')
  if (fs.existsSync(fix)) {
    const r = spawnSync(process.execPath, [fix], { stdio: 'inherit' })
    if (r.status) console.warn('→ libreoffice preview fix exited', r.status)
  }
} catch (err) {
  console.warn('→ libreoffice preview fix skipped:', err?.message || err)
}


// Rewrite PE ProductName/FileDescription so Windows taskbar jump list is Beam Agent
try {
  const rceditMod = await import('rcedit')
  const rcedit = rceditMod.default || rceditMod.rcedit
  const exePath = path.join(DIST, 'Beam Agent.exe')
  await rcedit(exePath, {
    'product-version': '0.1.6',
    'file-version': '0.1.6.0',
    'version-string': {
      ProductName: 'Beam Agent',
      FileDescription: 'Beam Agent',
      ProductVersion: '0.1.6',
      FileVersion: '0.1.6.0',
      InternalName: 'Beam Agent',
      OriginalFilename: 'Beam Agent.exe',
      CompanyName: 'ASSISTIX',
      LegalCopyright: 'ASSISTIX',
    },
  })
  console.log('→ exe ProductName/FileDescription/version → Beam Agent 0.1.6')
} catch (err) {
  console.warn('→ rcedit skipped:', err?.message || err)
}

// Icons
fs.copyFileSync(path.join(ROOT, 'logo.svg'), path.join(resourcesDest, 'icon.svg'))
if (fs.existsSync(path.join(resourcesSrc, 'icon.png'))) {
  // keep electron icon.png but also drop our svg nearby
}

// Bridge + launcher scripts into dist
copyRecursive(path.join(ROOT, 'desktop', 'bridge'), path.join(DIST, 'bridge'))
fs.copyFileSync(path.join(ROOT, 'logo-beam-agent.svg'), path.join(DIST, 'logo-beam-agent.svg'))
fs.copyFileSync(path.join(ROOT, 'logo.svg'), path.join(DIST, 'logo.svg'))

// Silent launchers + windowsHide host spawn (no console flash).
{
  const silent = path.join(ROOT, 'desktop', 'fix-silent-launch.mjs')
  if (fs.existsSync(silent)) {
    const r = spawnSync(process.execPath, [silent], { cwd: ROOT, encoding: 'utf8' })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('fix-silent-launch exited', r.status)
  } else {
    console.warn('fix-silent-launch.mjs missing')
  }
}

// Idempotent tray / blank-window / RU caption polish (runtime already patched; sync dist).
{
  const ship = path.join(ROOT, 'desktop', 'ship-stability-tray.mjs')
  if (fs.existsSync(ship)) {
    const r = spawnSync(process.execPath, [ship], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('ship-stability-tray exited', r.status)
  }
}

// Keep auth/credential path on ~/.beam (prevents MISSING_CREDENTIAL regressions).
{
  const fix = path.join(ROOT, 'desktop', 'fix-missing-credential.mjs')
  if (fs.existsSync(fix)) {
    const r = spawnSync(process.execPath, [fix], { cwd: ROOT, encoding: 'utf8' })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('fix-missing-credential exited', r.status)
  }
}

console.log('✓ Beam Agent build ready at:', DIST)
