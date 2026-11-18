/**
 * Package Beam Agent Early Alpha Windows installer (Inno Setup).
 * Syncs current shippable runtime + bridge into dist, then compiles Setup.exe.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist', 'Beam Agent')
const RUNTIME_APP = path.join(ROOT, 'runtime', 'app')
const BRIDGE_SRC = path.join(ROOT, 'desktop', 'bridge')
const ISS = path.join(ROOT, 'desktop', 'installer', 'beam-agent.iss')
const OUT_DIR = path.join(ROOT, 'dist', 'installers')
const README_OUT = path.join(OUT_DIR, 'EARLY-ALPHA-TESTERS.md')

const ISCC_CANDIDATES = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 7', 'ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 7\\ISCC.exe',
]

function mustExist(p, label = p) {
  if (!fs.existsSync(p)) throw new Error(`Missing: ${label}`)
}

function copyRecursive(src, dest, { excludes = [] } = {}) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (excludes.includes(entry.name)) continue
    if (entry.name === '.env' || entry.name.endsWith('.env') || entry.name.startsWith('.env.')) continue
    if (entry.name.endsWith('.log')) continue
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyRecursive(s, d, { excludes })
    else fs.copyFileSync(s, d)
  }
}

function robocopy(src, dest) {
  // Mirror app tree efficiently on Windows; /MIR keeps dist app coherent with runtime.
  const r = spawnSync(
    'robocopy',
    [src, dest, '/MIR', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD', 'node_modules\\.cache'],
    { encoding: 'utf8', windowsHide: true },
  )
  // robocopy exit codes 0–7 are success
  if (r.status != null && r.status >= 8) {
    throw new Error(`robocopy failed (${r.status}): ${r.stderr || r.stdout || ''}`)
  }
}

function findIscc() {
  for (const p of ISCC_CANDIDATES) {
    if (p && fs.existsSync(p)) return p
  }
  const which = spawnSync('where.exe', ['ISCC.exe'], { encoding: 'utf8', windowsHide: true })
  const line = (which.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean)
  if (line && fs.existsSync(line)) return line
  return null
}

function stripEnvFiles(dir) {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) n += stripEnvFiles(full)
    else if (entry.name === '.env' || entry.name.endsWith('.env') || /^\.env\./.test(entry.name)) {
      fs.unlinkSync(full)
      n++
      console.log('  removed secret/env file:', path.relative(DIST, full))
    }
  }
  return n
}

const INSTALLER_VERSION = '0.1.6'
const INSTALLER_EXE = 'Beam-Agent-0.1.6-Setup.exe'
const UPDATE_FEED_URL = 'https://agent.assistix.org/download/'
const APP_UPDATE_YML_SRC = path.join(ROOT, 'desktop', 'installer', 'app-update.yml')

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('base64')
}

function writeUpdateFeeds(artifactPath) {
  const size = fs.statSync(artifactPath).size
  const digest = sha512Base64(artifactPath)
  const releaseDate = new Date().toISOString()
  const body =
    `version: ${INSTALLER_VERSION}\n` +
    `files:\n` +
    `  - url: ${INSTALLER_EXE}\n` +
    `    sha512: ${digest}\n` +
    `    size: ${size}\n` +
    `path: ${INSTALLER_EXE}\n` +
    `sha512: ${digest}\n` +
    `releaseDate: '${releaseDate}'\n`
  for (const name of ['nightly.yml', 'latest.yml']) {
    const out = path.join(OUT_DIR, name)
    fs.writeFileSync(out, body)
    console.log('→ Wrote update feed', out)
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'update-feed-meta.json'),
    JSON.stringify(
      {
        version: INSTALLER_VERSION,
        file: INSTALLER_EXE,
        size,
        sha512: digest,
        feedUrl: UPDATE_FEED_URL,
        urls: {
          page: UPDATE_FEED_URL,
          exe: `${UPDATE_FEED_URL}${INSTALLER_EXE}`,
          nightly: `${UPDATE_FEED_URL}nightly.yml`,
          latest: `${UPDATE_FEED_URL}latest.yml`,
        },
      },
      null,
      2,
    ) + '\n',
  )
}

function findSignTool() {
  const which = spawnSync('where.exe', ['signtool.exe'], { encoding: 'utf8', windowsHide: true })
  const line = (which.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean)
  if (line && fs.existsSync(line)) return line
  const pf = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const roots = [
    path.join(pf, 'Windows Kits', '10', 'bin'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Windows Kits', '10', 'bin'),
  ]
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const versions = fs.readdirSync(root).sort().reverse()
    for (const ver of versions) {
      for (const arch of ['x64', 'x86']) {
        const candidate = path.join(root, ver, arch, 'signtool.exe')
        if (fs.existsSync(candidate)) return candidate
      }
    }
  }
  return null
}

/**
 * Sign Setup.exe when BEAM_SIGN_* / WIN_CSC_* material is available.
 * Returns { signed: boolean, reason: string }.
 */
function maybeSignInstaller(artifactPath) {
  const pfx = process.env.BEAM_SIGN_PFX || process.env.WIN_CSC_LINK || ''
  const password = process.env.BEAM_SIGN_PFX_PASSWORD || process.env.BEAM_SIGN_PASSWORD || process.env.WIN_CSC_KEY_PASSWORD || ''
  const thumbprint = (process.env.BEAM_SIGN_THUMBPRINT || '').replace(/\s+/g, '')
  const timestamp = process.env.BEAM_SIGN_TIMESTAMP || 'http://timestamp.digicert.com'
  const description = process.env.BEAM_SIGN_DESC || 'Beam Agent Setup'

  if (!pfx && !thumbprint) {
    return {
      signed: false,
      reason: 'no cert env (set BEAM_SIGN_PFX + BEAM_SIGN_PFX_PASSWORD, or BEAM_SIGN_THUMBPRINT) — see desktop/installer/CODE-SIGNING.md',
    }
  }
  const signtool = findSignTool()
  if (!signtool) {
    return { signed: false, reason: 'signtool.exe not found (install Windows SDK)' }
  }

  const args = ['sign', '/fd', 'SHA256', '/td', 'SHA256', '/tr', timestamp, '/d', description]
  if (thumbprint) {
    args.push('/sha1', thumbprint)
  } else {
    if (!fs.existsSync(pfx)) return { signed: false, reason: `PFX not found: ${pfx}` }
    args.push('/f', pfx)
    if (password) args.push('/p', password)
  }
  args.push(artifactPath)

  console.log('→ Signing installer with', signtool)
  const r = spawnSync(signtool, args, { encoding: 'utf8', windowsHide: true })
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim().slice(0, 500)
    return { signed: false, reason: `signtool failed (${r.status}): ${err}` }
  }
  return { signed: true, reason: 'signed' }
}

function writeTesterReadme() {
  const text = `# Beam Agent — Early Alpha (Windows)

**Version:** \`${INSTALLER_VERSION}\`  
Installer: \`${INSTALLER_EXE}\`

## Install (fresh PC)

1. Run \`${INSTALLER_EXE}\` (no admin required — installs under \`%LOCALAPPDATA%\\Programs\\Beam Agent\`).
2. Optional: enable the desktop shortcut.
3. Finish and launch, or start **Beam Agent (Early Alpha)** from the Start menu.

Silent launch: Start menu / shortcut opens \`Start Beam Agent.vbs\` — no console window. Chrome uses \`beam-app://\`; splash is minimal/faster.

## First launch

1. The local bridge starts on \`127.0.0.1:17865\` (bundled Node).
2. Sign in with **ASSISTIX ID** when prompted (in-app OAuth / \`assistix-official\` — not a false ACCOUNT_SIGN_IN).
3. Create a **project by name** from the sidebar (projects are isolated), then start a chat.
4. Models: **Tide** (500K) / **Flare** (10K) / **Pine** (1K) quotas via local bridge → Kumorouter. Hard stop + renew notice when exhausted. No manual API keys for core chat.

Data home: \`%USERPROFILE%\\.beam\` (Electron userData: \`%USERPROFILE%\\.beam\\electron-userdata\`).

## What's bundled (0.1.5)

- Electron app (\`Beam Agent.exe\`) + patched frontend (Beam brand colors, ASSISTIX ID login restyle)
- Local Assistix bridge (Tide / Flare / Pine + ASSISTIX OAuth ready)
- Bundled Node runtime under \`resources\\runtime\\...\`
- Silent launchers (\`Start Beam Agent.vbs\`, \`start-bridge-hidden.vbs\`)
- Fixes baked in: \`.beam\` home / MISSING_CREDENTIAL, projects isolation + create-by-name, web tools, INVALID_REQUEST compact + DSML→tools (no chat dump), output auto-continue + **Продолжить**, Settings Profile/Limits + dynamic titles + Assistix session on Profile, session dots left + right-rail pull-out, plugins blocked, voice in settings

**Not** bundled as secrets: no packaged \`.env\`, no \`BEAM_BASE_URL\` written into \`~/.beam/.env\`. Login/OAuth at runtime only.

## Optional external deps

- **LibreOffice** (system install) can improve \`.docx\` preview quality. Core chat/agent works without it; a LibreOffice kit may already ship inside the app for basic preview.

## Updates

Packaged builds read \`resources\\app-update.yml\` and poll:

- Feed: \`${UPDATE_FEED_URL}nightly.yml\` (channel \`nightly\`, version scheme \`${INSTALLER_VERSION}\`)
- Also published: \`${UPDATE_FEED_URL}latest.yml\`
- Download page: \`${UPDATE_FEED_URL}\`

In-app: **Проверить обновления… / Check for Updates…** → download → install & restart (Inno Setup silent upgrade).

## Code signing

If \`BEAM_SIGN_PFX\` / \`BEAM_SIGN_THUMBPRINT\` is set during packaging, Setup.exe is Authenticode-signed. See \`desktop/installer/CODE-SIGNING.md\`.

## Alpha gaps (known)

- Treat as Early Alpha: expect rough edges; report issues with repro steps.

## Uninstall

Use **Удалить Beam Agent** in the Start menu group, or Windows Apps & features. User data in \`%USERPROFILE%\\.beam\` is kept unless you delete it manually.
`
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(README_OUT, text)
  console.log('→ Wrote', README_OUT)
}

console.log('=== Beam Agent Early Alpha packager ===')
mustExist(DIST, 'dist/Beam Agent')
mustExist(path.join(DIST, 'Beam Agent.exe'))
mustExist(ISS)

if (fs.existsSync(RUNTIME_APP)) {
  console.log('→ Syncing runtime/app → dist/.../resources/app')
  const appDest = path.join(DIST, 'resources', 'app')
  fs.mkdirSync(appDest, { recursive: true })
  robocopy(RUNTIME_APP, appDest)
} else {
  console.warn('→ runtime/app missing — packaging existing dist app as-is')
}

if (fs.existsSync(BRIDGE_SRC)) {
  console.log('→ Syncing desktop/bridge → dist/bridge')
  const bridgeDest = path.join(DIST, 'bridge')
  fs.rmSync(bridgeDest, { recursive: true, force: true })
  copyRecursive(BRIDGE_SRC, bridgeDest)
}

// Refresh silent launchers / beam-home env wiring into dist.
{
  const silent = path.join(ROOT, 'desktop', 'fix-silent-launch.mjs')
  if (fs.existsSync(silent)) {
    console.log('→ Applying fix-silent-launch.mjs')
    const r = spawnSync(process.execPath, [silent], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('  fix-silent-launch exited', r.status)
  }
}
{
  const ship = path.join(ROOT, 'desktop', 'ship-stability-tray.mjs')
  if (fs.existsSync(ship)) {
    console.log('→ Applying ship-stability-tray.mjs')
    const r = spawnSync(process.execPath, [ship], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('  ship-stability-tray exited', r.status)
  }
}
{
  const fixBundles = path.join(ROOT, 'desktop', 'fix-profile-dsh-bundles.mjs')
  if (fs.existsSync(fixBundles)) {
    console.log('→ Applying fix-profile-dsh-bundles.mjs (dsh.profile.bundles boot fix)')
    const r = spawnSync(process.execPath, [fixBundles], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('  fix-profile-dsh-bundles exited', r.status)
  }
}
{
  const fix = path.join(ROOT, 'desktop', 'fix-missing-credential.mjs')
  if (fs.existsSync(fix)) {
    console.log('→ Applying fix-missing-credential.mjs')
    const r = spawnSync(process.execPath, [fix], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('  fix-missing-credential exited', r.status)
  }
}

{
  const enable = path.join(ROOT, 'desktop', 'enable-beam-updates.mjs')
  if (fs.existsSync(enable)) {
    console.log('→ Enabling Beam auto-update (feed + Inno install hook + RU copy)')
    const r = spawnSync(process.execPath, [enable], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.status !== 0) console.warn('  enable-beam-updates exited', r.status)
  }
}

// Critical boot/runtime patches — must survive runtime→dist sync.
for (const name of [
  'patch-runtime-version-soft.mjs',
  'patch-boot-ipc-host-only.mjs',
  'patch-boot-ready-cap.mjs',
  'beam-splash-redesign.mjs',
]) {
  const script = path.join(ROOT, 'desktop', name)
  if (!fs.existsSync(script)) continue
  console.log('→ Applying', name)
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) console.warn(' ', name, 'exited', r.status)
}

// Ship Assistix public update feed config inside the packaged app.
{
  const dest = path.join(DIST, 'resources', 'app-update.yml')
  if (fs.existsSync(APP_UPDATE_YML_SRC)) {
    fs.copyFileSync(APP_UPDATE_YML_SRC, dest)
    const disabled = dest + '.disabled'
    if (fs.existsSync(disabled)) fs.unlinkSync(disabled)
    console.log('→ app-update.yml →', dest)
  } else {
    console.warn('→ missing', APP_UPDATE_YML_SRC)
  }
}

console.log('→ Stripping any .env files from dist (no secrets in installer)')
stripEnvFiles(DIST)

// Drop unused Chromium DevTools issue-description markdown (long paths flake ISCC; not used at runtime).
{
  const appRoot = path.join(DIST, 'resources', 'app')
  let pruned = 0
  function walkDirs(dir, visit) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name === 'descriptions' && /issues_manager[\\/]descriptions$/i.test(full)) visit(full)
      else walkDirs(full, visit)
    }
  }
  walkDirs(appRoot, (descDir) => {
    for (const name of fs.readdirSync(descDir)) {
      const fp = path.join(descDir, name)
      try {
        if (fs.statSync(fp).isFile()) {
          fs.unlinkSync(fp)
          pruned++
        }
      } catch {
        /* ignore */
      }
    }
  })
  if (pruned) console.log(`→ Pruned ${pruned} unused inspector description files`)
}

// Stamp Beam Early Alpha version everywhere user-facing / installer-visible.
{
  const appRoot = path.join(DIST, 'resources', 'app')
  const pkgPath = path.join(appRoot, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    pkg.version = INSTALLER_VERSION
    pkg.productName = 'Beam Agent'
    pkg.description = 'Beam Agent — Assistix desktop AI agent (Early Alpha)'
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`→ package.json version → ${INSTALLER_VERSION}`)
  }

  const beamPkgPath = path.join(appRoot, 'beam', 'package.json')
  if (fs.existsSync(beamPkgPath)) {
    const beamPkg = JSON.parse(fs.readFileSync(beamPkgPath, 'utf8'))
    beamPkg.version = INSTALLER_VERSION
    fs.writeFileSync(beamPkgPath, JSON.stringify(beamPkg, null, 2) + '\n')
    console.log(`→ beam/package.json version → ${INSTALLER_VERSION}`)
  }

  const runtimeJson = path.join(appRoot, 'beam', 'desktop-runtime.json')
  if (fs.existsSync(runtimeJson)) {
    const rt = JSON.parse(fs.readFileSync(runtimeJson, 'utf8'))
    if (rt.release) rt.release.version = INSTALLER_VERSION
    fs.writeFileSync(runtimeJson, JSON.stringify(rt) + '\n')
    console.log(`→ desktop-runtime.json release.version → ${INSTALLER_VERSION}`)
  }

  const stampPaths = [
    path.join(appRoot, 'lib', 'main.js'),
    path.join(appRoot, 'beam', 'node_modules', '@assistix', 'beam-client-ui-settings-general', 'lib', 'client.js'),
    path.join(appRoot, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-settings-general', 'lib', 'client.js'),
    path.join(appRoot, 'beam', 'node_modules', '@assistix', 'beam-client-ui-settings-account', 'lib', 'client.js'),
    path.join(appRoot, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-settings-account', 'lib', 'client.js'),
    path.join(appRoot, 'beam', 'node_modules', '@assistix', 'beam-client-ui-sidebar', 'lib', 'client.js'),
    path.join(appRoot, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-sidebar', 'lib', 'client.js'),
  ]
  const stampJs = (file) => {
    if (!fs.existsSync(file)) return false
    const text = fs.readFileSync(file, 'utf8')
    const next = text
      .replace(/return "0\.[^"]+";/, `return "${INSTALLER_VERSION}";`)
      .replace(/general\.currentVersion", \{ version: "[^"]+" \}/g, `general.currentVersion", { version: "${INSTALLER_VERSION}" }`)
      .replace(/accountClientMetadata\(([^,]+),\s*"[^"]+"\)/g, `accountClientMetadata($1, "${INSTALLER_VERSION}")`)
      .replace(/version:\s*"0\.[^"]+"/g, `version: "${INSTALLER_VERSION}"`)
      .replace(/return `0\.[^`]+`/g, `return \`${INSTALLER_VERSION}-beam\``)
    if (next === text) return false
    fs.writeFileSync(file, next)
    return true
  }

  let stamped = 0
  for (const file of stampPaths) {
    if (stampJs(file)) stamped++
  }
  console.log(`→ stamped Beam version into ${stamped} UI/runtime files → ${INSTALLER_VERSION}`)

  // Keep runtime mirror coherent so unpackaged / next sync does not resurrect DSH version.
  const runtimeStamp = [
    path.join(RUNTIME_APP, 'package.json'),
    path.join(RUNTIME_APP, 'lib', 'main.js'),
    path.join(RUNTIME_APP, 'beam', 'package.json'),
    path.join(RUNTIME_APP, 'beam', 'desktop-runtime.json'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@assistix', 'beam-client-ui-settings-general', 'lib', 'client.js'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-settings-general', 'lib', 'client.js'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@assistix', 'beam-client-ui-settings-account', 'lib', 'client.js'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-settings-account', 'lib', 'client.js'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@assistix', 'beam-client-ui-sidebar', 'lib', 'client.js'),
    path.join(RUNTIME_APP, 'beam', 'node_modules', '@deepseek-ai', 'dsh-client-ui-sidebar', 'lib', 'client.js'),
  ]
  for (const file of runtimeStamp) {
    if (!fs.existsSync(file)) continue
    try {
      if (file.endsWith('package.json')) {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
        pkg.version = INSTALLER_VERSION
        if (path.basename(path.dirname(file)) === 'app') {
          pkg.productName = 'Beam Agent'
          pkg.description = 'Beam Agent — Assistix desktop AI agent (Early Alpha)'
        }
        fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
        continue
      }
      if (file.endsWith('desktop-runtime.json')) {
        const rt = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (rt.release) rt.release.version = INSTALLER_VERSION
        fs.writeFileSync(file, JSON.stringify(rt) + '\n')
        continue
      }
      stampJs(file)
    } catch (error) {
      // OneDrive / AV can lock runtime mirror files; dist stamp is authoritative for Setup.exe.
      console.warn('  runtime stamp skipped', path.relative(ROOT, file), String(error?.message || error))
    }
  }
}

mustExist(path.join(DIST, 'Start Beam Agent.vbs'))
mustExist(path.join(DIST, 'bridge', 'server.js'))
mustExist(path.join(DIST, 'resources', 'app.ico'))
mustExist(path.join(DIST, 'resources', 'runtime', 'primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'), 'bundled node.exe')

writeTesterReadme()

const iscc = findIscc()
if (!iscc) throw new Error('Inno Setup ISCC.exe not found — install Inno Setup 6+')
console.log('→ Compiling with', iscc)
fs.mkdirSync(OUT_DIR, { recursive: true })

// Short drive letters avoid OneDrive / long-path flakiness during ISCC compression.
const SRC_DRIVE = 'B:'
const OUT_DRIVE = 'I:'
function subst(drive, target) {
  spawnSync('subst', [drive, '/D'], { windowsHide: true, encoding: 'utf8' })
  const r = spawnSync('subst', [drive, target], { windowsHide: true, encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(`subst ${drive} -> ${target} failed: ${(r.stderr || r.stdout || '').trim()}`)
  }
}
function unsubst(drive) {
  spawnSync('subst', [drive, '/D'], { windowsHide: true, encoding: 'utf8' })
}

// Stage outside OneDrive to avoid mid-compress file vanish; quiet ISCC to avoid OOM on stdout.
const STAGE = process.env.BEAM_INSTALLER_STAGE || 'C:\\Temp\\BeamAgent-EarlyAlpha-Stage'
const STAGE_APP = path.join(STAGE, 'app')
const STAGE_OUT = path.join(STAGE, 'out')
const isccLog = path.join(STAGE, 'iscc.log')

console.log('→ Staging pack tree outside OneDrive →', STAGE_APP)
fs.rmSync(STAGE, { recursive: true, force: true })
fs.mkdirSync(STAGE_APP, { recursive: true })
fs.mkdirSync(STAGE_OUT, { recursive: true })
robocopy(DIST, STAGE_APP)

try {
  subst(SRC_DRIVE, STAGE_APP)
  subst(OUT_DRIVE, STAGE_OUT)
  const icon = `${SRC_DRIVE}\\resources\\app.ico`
  mustExist(icon)
  const args = [
    ISS,
    '/Q',
    `/DSourceDir=${SRC_DRIVE}`,
    `/DOutDir=${OUT_DRIVE}`,
    `/DIconFile=${icon}`,
  ]
  console.log('→ ISCC quiet compile; log →', isccLog)
  const compile = spawnSync(iscc, args, {
    cwd: path.dirname(ISS),
    windowsHide: true,
    stdio: ['ignore', fs.openSync(isccLog, 'w'), fs.openSync(isccLog, 'a')],
  })
  if (compile.status !== 0) {
    const tail = fs.existsSync(isccLog) ? fs.readFileSync(isccLog, 'utf8').slice(-4000) : ''
    throw new Error(`ISCC failed with status ${compile.status}\n${tail}`)
  }
  const stagedExe = path.join(STAGE_OUT, INSTALLER_EXE)
  mustExist(stagedExe)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.copyFileSync(stagedExe, path.join(OUT_DIR, INSTALLER_EXE))
  console.log('→ Copied installer into', OUT_DIR)
} finally {
  unsubst(SRC_DRIVE)
  unsubst(OUT_DRIVE)
}

const artifact = path.join(OUT_DIR, INSTALLER_EXE)
mustExist(artifact)

const sign = maybeSignInstaller(artifact)
if (sign.signed) console.log('✓ Code signed:', artifact)
else console.log('· Code signing skipped:', sign.reason)

writeUpdateFeeds(artifact)

const mb = (fs.statSync(artifact).size / (1024 * 1024)).toFixed(1)
console.log(`✓ Installer ready: ${artifact} (${mb} MB)`)
console.log(`✓ Version: ${INSTALLER_VERSION}`)
console.log(`✓ Update feeds: ${path.join(OUT_DIR, 'nightly.yml')} + latest.yml`)
console.log(`✓ Tester README: ${README_OUT}`)
console.log(`✓ Public feed URL: ${UPDATE_FEED_URL}`)
