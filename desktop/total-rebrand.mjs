/**
 * TOTAL Beam Agent visual/identity takeover of the packaged desktop UI.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const APP = path.join(ROOT, 'dist', 'Beam-Agent', 'resources', 'app')
const WEB = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist')
const ASSETS = path.join(WEB, 'assets')

const logoSvg = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8')
const wordmarkSvg = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'), 'utf8')
const beamWord = fs.readFileSync(path.join(ROOT, 'beam.svg'), 'utf8')
const agentWord = fs.readFileSync(path.join(ROOT, 'agent.svg'), 'utf8')
const logoAgent = fs.readFileSync(path.join(ROOT, 'logo-agent.svg'), 'utf8')

function toCurrentColor(svg) {
  return svg
    .replaceAll('fill="#00B3BC"', 'fill="currentColor"')
    .replaceAll("fill='#00B3BC'", "fill='currentColor'")
}

function dataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toCurrentColor(svg))}`
}

const LOGO_URI = dataUri(logoSvg)
const WORDMARK_URI = dataUri(wordmarkSvg)
const BEAM_URI = dataUri(beamWord)
const AGENT_URI = dataUri(agentWord)
const LOGO_AGENT_URI = dataUri(logoAgent)

// Beam mark path extracted from logo.svg (viewBox 0 0 1066 1107)
const BEAM_MARK_PATHS = [
  'M59.0641 509.469C46.1981 482.347 39 452.014 39 420C39 310.216 123.646 220.202 231.234 211.663L59.0641 509.469Z',
  'M834.766 211.663C942.354 220.202 1027 310.216 1027 420C1027 452.014 1019.8 482.347 1006.94 509.469L834.766 211.663Z',
  'M704.139 1018C666.329 1071.82 603.772 1107 533 1107C462.228 1107 399.671 1071.82 361.861 1018H704.139Z',
  'M738.178 118.454L1033.91 630.64C1125.1 788.578 1011.11 986 828.727 986H237.273C54.8922 986 -59.0957 788.578 32.0947 630.64L327.822 118.453C419.012 -39.4846 646.988 -39.4844 738.178 118.454ZM663.389 373.889C663.389 301.601 604.788 243 532.5 243C460.212 243 401.611 301.601 401.611 373.889C401.611 446.177 460.212 504.778 532.5 504.778C604.788 504.778 663.389 446.177 663.389 373.889ZM842 731.75C842 644.075 765.142 573 670.333 573H395.667C300.858 573 224 644.075 224 731.75C224 784.355 270.115 827 327 827H739C795.885 827 842 784.355 842 731.75Z',
]

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' && !full.includes(`${path.sep}dsh${path.sep}node_modules`)) {
        // still walk @deepseek-ai packages under dsh/node_modules
        if (entry.name === 'node_modules' && full.endsWith(`${path.sep}dsh${path.sep}node_modules`)) {
          // only brand-related packages
          for (const pkg of fs.readdirSync(full)) {
            if (pkg === '@deepseek-ai') walk(path.join(full, pkg), filter, out)
          }
          continue
        }
        if (entry.name === 'node_modules') continue
      }
      walk(full, filter, out)
    } else if (filter(full)) out.push(full)
  }
  return out
}

function replaceAllInFile(file, pairs) {
  let text = fs.readFileSync(file, 'utf8')
  let changed = false
  for (const [from, to] of pairs) {
    if (!from) continue
    if (text.includes(from)) {
      text = text.split(from).join(to)
      changed = true
    }
  }
  if (changed) fs.writeFileSync(file, text)
  return changed
}

console.log('1) Replace fish logo geometry in web JS')
const indexJs = path.join(ASSETS, 'index-BXV-oxvX.js')
let js = fs.readFileSync(indexJs, 'utf8')
const fishStart = js.indexOf('M22.9168 1.43018')
if (fishStart < 0) throw new Error('Fish path not found in index JS')
const fishEnd = js.indexOf("'", fishStart)
const oldFish = js.slice(fishStart, fishEnd)
// Keep a single path for FishLogo API (one path element). Use the main mark body.
const newFish = BEAM_MARK_PATHS[3]
js = js.slice(0, fishStart) + newFish + js.slice(fishEnd)
// viewBox dimensions used by FishLogo only (avoid global numeric smash)
js = js.replaceAll('{width:23.16,height:17.04}', '{width:1066,height:1107}')
js = js.replaceAll('width:23.16,height:17.04', 'width:1066,height:1107')
js = js.replaceAll('0 0 23.16 17.04', '0 0 1066 1107')
js = js.replaceAll('0 0 23.16 17.0435', '0 0 1066 1107')
// Brand strings that may remain in JS
const stringPairs = [
  ['DeepSeek Harness', 'Beam Agent'],
  ['DeepSeek Account', 'ASSISTIX ID'],
  ['Sign in with DeepSeek', 'Sign in with ASSISTIX ID'],
  ['Sign in to DeepSeek', 'Sign in with ASSISTIX ID'],
  ['platform.deepseek.com', 'id.assistix.org'],
  ['harness.deepseek.com', 'agent.assistix.org'],
  ['api.deepseek.com', '127.0.0.1:17865'],
  ['download.deepseek.com', 'agent.assistix.org'],
  ['About DeepSeek', 'About Beam'],
  ['DeepSeek', 'Beam'],
]
for (const [a, b] of stringPairs) js = js.split(a).join(b)
fs.writeFileSync(indexJs, js)
console.log('  fish path replaced, len', oldFish.length, '->', newFish.length)

// FishLogo only has one <path>. Extra mark ears won't show — inject multi-path via CSS background instead for wordmarks.
console.log('2) Patch BrandWordmark unique letter paths → hide via CSS + inject images')

console.log('3) Write nuclear CSS override')
const css = `
/* ========== BEAM AGENT TOTAL VISUAL TAKEOVER ========== */
:root, html, body, #root {
  --dsw-alias-brand-primary: #00B3BC !important;
  --dsw-alias-brand-primary-new-colorprimary-new-color: #00B3BC !important;
  --dsw-alias-button-primary-fill: #00B3BC !important;
  --dsw-alias-button-primary-hover: #0d9488 !important;
  --dsw-alias-state-business-primary: #00B3BC !important;
  --dsw-alias-link: #2dd4bf !important;
  --dsw-focus-ring-color: #00B3BC !important;
  --dsw-static-deepseek-500: #00B3BC !important;
  --dsw-static-deepseek-450: #14b8a6 !important;
  --dsw-static-deepseek-400: #2dd4bf !important;
  --dsw-accent: #00B3BC !important;
  --dsw-accent-hover: #0d9488 !important;
  --acx-500: #00B3BC !important;
  --acx-400: #2dd4bf !important;
  --acx-600: #0d9488 !important;
}

html, body, #root {
  background:
    radial-gradient(1100px 620px at -5% -15%, rgba(0,179,188,.22), transparent 55%),
    radial-gradient(900px 520px at 110% 0%, rgba(45,212,191,.10), transparent 50%),
    #05100f !important;
  color: #eaf5f3 !important;
}

body[data-ds-dark-theme],
:root[data-theme="dark"],
html.dark {
  --dsw-alias-bg-base: #05100f !important;
  --dsw-alias-bg-layer-1: #0b1a18 !important;
  --dsw-alias-bg-layer-2: #10211f !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-bg-layer-4: #1a3531 !important;
  --dsw-alias-bg-module-platform: #0b1a18 !important;
  --dsw-alias-border-l1: #1f3d38 !important;
  --dsw-alias-border-l2: #27504a !important;
  --dsw-alias-border-l3: #2f5f58 !important;
  --dsw-alias-border-l4: #3a736a !important;
  --dsw-alias-label-primary: #eaf5f3 !important;
  --dsw-alias-label-secondary: #b3d9d3 !important;
  --dsw-alias-label-tertiary: #8fbab4 !important;
  --dsw-alias-label-caption: #6d9a94 !important;
  --dsw-alias-markdown-code-block: #0b1a18 !important;
  --dsw-alias-markdown-code-block-banner: #10211f !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-alias-interactive-bg-active: rgba(0,179,188,.18) !important;
  --dsw-menu-surface-fill: rgba(11,26,24,.92) !important;
}

/* Hide original DeepSeek fish/wordmark SVG artwork in chrome */
[class*="logoRow"] > svg,
[class*="logoRow"] svg,
[class*="brand"] svg,
[data-slot*="brand"] svg,
[class*="Brand"] svg,
svg[viewBox="0 0 23.16 17.04"],
svg[viewBox="0 0 182 24"],
svg[viewBox="26 0 156 24"],
svg[viewBox="0 0 1066 1107"] {
  /* keep layout box for mark, paint Beam via mask below when possible */
}

/* Sidebar / header mark: paint Beam logo as mask over currentColor */
[class*="logoRow"] svg,
[class*="logoRow"] > span > svg {
  width: 26px !important;
  height: 27px !important;
  color: #00B3BC !important;
  background: currentColor !important;
  -webkit-mask: url("${LOGO_URI}") center / contain no-repeat !important;
  mask: url("${LOGO_URI}") center / contain no-repeat !important;
}
[class*="logoRow"] svg path,
[class*="logoRow"] > span > svg path {
  opacity: 0 !important;
}

/* Full wordmark surfaces (welcome / about / onboarding) */
[class*="wordmark"],
[class*="Wordmark"],
[class*="brandName"],
[class*="BrandName"],
[class*="welcomeBrand"],
[class*="productName"] {
  background-image: url("${WORDMARK_URI}") !important;
  background-repeat: no-repeat !important;
  background-position: left center !important;
  background-size: contain !important;
  color: transparent !important;
  min-height: 28px !important;
  min-width: 160px !important;
}

/* Boot splash wordmark text */
[class*="_wordmark_"] {
  background: url("${WORDMARK_URI}") center / contain no-repeat !important;
  color: transparent !important;
  font-size: 0 !important;
  width: 220px !important;
  height: 36px !important;
}

/* Accent sweeps */
[class*="sidebar"], header, nav, [role="navigation"] {
  border-color: #1f3d38 !important;
}
button[class*="primary"], [class*="_primary_"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important;
}

/* Selection */
::selection { background: rgba(45,212,191,.35) !important; }

/* Account / DeepSeek leftovers as Assistix */
img[alt*="DeepSeek" i], img[alt*="deepseek" i] {
  content: url("${LOGO_URI}") !important;
}
`

fs.writeFileSync(path.join(ASSETS, 'beam-override.css'), css)

console.log('4) Patch index.html with inject script + logos')
let html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8')
html = html
  .replace(/<title>[^<]*<\/title>/, '<title>Beam Agent</title>')
  .replaceAll('DeepSeek Harness', 'Beam Agent')
  .replaceAll('DeepSeek', 'Beam')

const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const rename = () => {
    if (document.title && /deepseek|harness/i.test(document.title)) document.title = 'Beam Agent';
    document.title = 'Beam Agent';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue) continue;
      if (/DeepSeek|Harness/i.test(n.nodeValue)) {
        n.nodeValue = n.nodeValue
          .replace(/DeepSeek Harness/g, 'Beam Agent')
          .replace(/DeepSeek Account/g, 'ASSISTIX ID')
          .replace(/Sign in with DeepSeek/g, 'Sign in with ASSISTIX ID')
          .replace(/DeepSeek/g, 'Beam')
          .replace(/Harness/g, 'Agent');
      }
    }
    // Replace large wordmark SVGs with Beam wordmark image
    for (const svg of document.querySelectorAll('svg')) {
      const vb = svg.getAttribute('viewBox') || '';
      const w = Number(svg.getAttribute('width') || 0);
      if (vb.includes('182 24') || vb.includes('156 24') || (w > 80 && svg.querySelector('rect[width="52"]'))) {
        const img = document.createElement('img');
        img.src = '${WORDMARK_URI}';
        img.alt = 'Beam Agent';
        img.style.height = (svg.getAttribute('height') || 24) + 'px';
        img.style.width = 'auto';
        img.style.display = 'inline-block';
        svg.replaceWith(img);
      }
    }
  };
  const obs = new MutationObserver(() => rename());
  const start = () => {
    rename();
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
</script>
`
if (!html.includes('beam-override.css')) {
  html = html.replace('</head>', `${inject}\n</head>`)
} else {
  // refresh inject block
  html = html.replace(/<link rel="stylesheet" href="\.\/assets\/beam-override\.css">[\s\S]*?<\/script>\n?/m, '')
  html = html.replace('</head>', `${inject}\n</head>`)
}
fs.writeFileSync(path.join(WEB, 'index.html'), html)

fs.writeFileSync(path.join(WEB, 'favicon.svg'), logoSvg)
fs.writeFileSync(path.join(WEB, 'favicon-dark.svg'), logoSvg)
replaceAllInFile(path.join(WEB, 'manifest.webmanifest'), stringPairs)

console.log('5) Welcome / renderer / main branding')
fs.writeFileSync(path.join(APP, 'renderer', 'assets', 'welcome-brand.svg'), wordmarkSvg)
const welcomeCss = path.join(APP, 'renderer', 'welcome.css')
if (fs.existsSync(welcomeCss)) {
  fs.appendFileSync(welcomeCss, `
body { background:#05100f !important; color:#eaf5f3 !important; }
img, svg { filter: none !important; }
`)
}

const mainJs = path.join(APP, 'lib', 'main.js')
replaceAllInFile(mainJs, [
  ['DeepSeek Harness', 'Beam Agent'],
  ['DeepSeek', 'Beam'],
  ['com.deepseek.dsh', 'org.assistix.beam-agent'],
])

console.log('6) Locale / brand-official / theme packages')
const localeFiles = walk(path.join(APP, 'dsh', 'node_modules', '@deepseek-ai'), (f) =>
  f.endsWith('.json') || f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.svg') || f.endsWith('.html'),
)
let touched = 0
for (const file of localeFiles) {
  // skip enormous unrelated vendor if any slipped in
  if (file.includes(`${path.sep}openai${path.sep}`) || file.includes(`${path.sep}@aws-sdk${path.sep}`)) continue
  if (file.includes('dsh-web-frontend') && file.endsWith('index-BXV-oxvX.js')) continue // already done carefully
  const ext = path.extname(file)
  if (ext === '.svg' && (file.includes('favicon') || file.includes('brand') || file.includes('logo') || file.includes('welcome'))) {
    fs.writeFileSync(file, file.includes('beam') || file.includes('word') ? wordmarkSvg : logoSvg)
    touched++
    continue
  }
  if (ext === '.js' || ext === '.json' || ext === '.css' || ext === '.html') {
    if (replaceAllInFile(file, stringPairs)) touched++
  }
}
console.log('  touched package files:', touched)

console.log('7) Theme design tokens CSS if present')
const themeCssCandidates = walk(path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-theme'), (f) => f.endsWith('.css'))
for (const file of themeCssCandidates) {
  replaceAllInFile(file, [
    ['#4D6BFE', '#00B3BC'],
    ['#3b82f6', '#00B3BC'],
    ['#2563eb', '#0d9488'],
    ['deepseek', 'beam'],
  ])
}

// Resources icons at electron level
const resDir = path.join(ROOT, 'dist', 'Beam-Agent', 'resources')
fs.writeFileSync(path.join(resDir, 'icon.svg'), logoSvg)
fs.copyFileSync(path.join(ROOT, 'logo.svg'), path.join(ROOT, 'dist', 'Beam-Agent', 'logo.svg'))
fs.copyFileSync(path.join(ROOT, 'logo-beam-agent.svg'), path.join(ROOT, 'dist', 'Beam-Agent', 'logo-beam-agent.svg'))

console.log('✓ TOTAL rebrand complete')
console.log('  logo mark URI bytes', LOGO_URI.length)
console.log('  wordmark URI bytes', WORDMARK_URI.length)
