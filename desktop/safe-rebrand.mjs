/**
 * Safe Beam Agent visual rebrand — never smash @deepseek-ai package ids.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WEB = path.join(ROOT, 'dist', 'Beam Agent', 'resources', 'app', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist')
const ASSETS = path.join(WEB, 'assets')
const APP = path.join(ROOT, 'dist', 'Beam Agent', 'resources', 'app')

const logoSvg = fs.readFileSync(path.join(ROOT, 'logo.svg'), 'utf8')
const wordmarkSvg = fs.readFileSync(path.join(ROOT, 'logo-beam-agent.svg'), 'utf8')

function toCurrentColor(svg) {
  return svg.replaceAll('fill="#00B3BC"', 'fill="currentColor"')
}
function dataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(toCurrentColor(svg))}`
}
const LOGO_URI = dataUri(logoSvg)
const WORDMARK_URI = dataUri(wordmarkSvg)

const BEAM_BODY = 'M738.178 118.454L1033.91 630.64C1125.1 788.578 1011.11 986 828.727 986H237.273C54.8922 986 -59.0957 788.578 32.0947 630.64L327.822 118.453C419.012 -39.4846 646.988 -39.4844 738.178 118.454ZM663.389 373.889C663.389 301.601 604.788 243 532.5 243C460.212 243 401.611 301.601 401.611 373.889C401.611 446.177 460.212 504.778 532.5 504.778C604.788 504.778 663.389 446.177 663.389 373.889ZM842 731.75C842 644.075 765.142 573 670.333 573H395.667C300.858 573 224 644.075 224 731.75C224 784.355 270.115 827 327 827H739C795.885 827 842 784.355 842 731.75Z'

function safeReplaceUserStrings(text) {
  // Protect package scopes / module ids
  const guards = []
  text = text.replace(/@deepseek-ai\/[A-Za-z0-9_./@+-]+/g, (m) => {
    const key = `__BEAM_GUARD_${guards.length}__`
    guards.push(m)
    return key
  })
  text = text.replace(/deepseek-ai/g, (m) => {
    const key = `__BEAM_GUARD_${guards.length}__`
    guards.push(m)
    return key
  })

  const pairs = [
    ['DeepSeek Harness', 'Beam Agent'],
    ['DeepSeek Account', 'ASSISTIX ID'],
    ['Sign in with DeepSeek', 'Sign in with ASSISTIX ID'],
    ['Sign in to DeepSeek', 'Sign in with ASSISTIX ID'],
    ['About DeepSeek', 'About Beam'],
    ['platform.deepseek.com', 'id.assistix.org'],
    ['harness.deepseek.com', 'agent.assistix.org'],
    ['download.deepseek.com', 'agent.assistix.org'],
    // last: bare product name, after longer phrases
    ['DeepSeek', 'Beam'],
  ]
  for (const [a, b] of pairs) text = text.split(a).join(b)

  for (let i = 0; i < guards.length; i++) {
    text = text.split(`__BEAM_GUARD_${i}__`).join(guards[i])
  }
  return text
}

console.log('→ Patch index JS fish logo + safe strings')
const indexName = fs.readdirSync(ASSETS).find((f) => f.startsWith('index-') && f.endsWith('.js'))
const indexJs = path.join(ASSETS, indexName)
let js = fs.readFileSync(indexJs, 'utf8')
const fishStart = js.indexOf('M22.9168 1.43018')
if (fishStart < 0) throw new Error('fish path missing — restore web first')
const fishEnd = js.indexOf("'", fishStart)
js = js.slice(0, fishStart) + BEAM_BODY + js.slice(fishEnd)
js = js.replaceAll('{width:23.16,height:17.04}', '{width:1066,height:1107}')
js = js.replaceAll('width:23.16,height:17.04', 'width:1066,height:1107')
js = js.replaceAll('0 0 23.16 17.04', '0 0 1066 1107')
js = safeReplaceUserStrings(js)
fs.writeFileSync(indexJs, js)
console.log('  patched', indexName)

console.log('→ Nuclear CSS')
const css = `
/* BEAM AGENT VISUAL SYSTEM */
:root {
  --beam: #00B3BC;
  --beam-2: #2dd4bf;
  --beam-3: #0d9488;
  --beam-bg: #05100f;
  --beam-surface: #0b1a18;
  --beam-elev: #10211f;
  --beam-line: #1f3d38;
  --beam-ink: #eaf5f3;

  --dsw-alias-brand-primary: var(--beam) !important;
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--beam) !important;
  --dsw-alias-button-primary-fill: var(--beam) !important;
  --dsw-alias-button-primary-hover: var(--beam-3) !important;
  --dsw-alias-state-business-primary: var(--beam) !important;
  --dsw-alias-link: var(--beam-2) !important;
  --dsw-focus-ring-color: var(--beam) !important;
  --dsw-static-deepseek-500: var(--beam) !important;
  --dsw-static-deepseek-450: var(--beam-2) !important;
  --dsw-static-deepseek-400: var(--beam-2) !important;
}
html, body, #root {
  background:
    radial-gradient(1100px 620px at -5% -15%, rgba(0,179,188,.22), transparent 55%),
    radial-gradient(900px 520px at 110% 0%, rgba(45,212,191,.10), transparent 50%),
    var(--beam-bg) !important;
  color: var(--beam-ink) !important;
}
body[data-ds-dark-theme], :root[data-theme="dark"], html.dark {
  --dsw-alias-bg-base: var(--beam-bg) !important;
  --dsw-alias-bg-layer-1: var(--beam-surface) !important;
  --dsw-alias-bg-layer-2: var(--beam-elev) !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-bg-layer-4: #1a3531 !important;
  --dsw-alias-bg-module-platform: var(--beam-surface) !important;
  --dsw-alias-border-l1: var(--beam-line) !important;
  --dsw-alias-border-l2: #27504a !important;
  --dsw-alias-border-l3: #2f5f58 !important;
  --dsw-alias-border-l4: #3a736a !important;
  --dsw-alias-label-primary: var(--beam-ink) !important;
  --dsw-alias-label-secondary: #b3d9d3 !important;
  --dsw-alias-label-tertiary: #8fbab4 !important;
  --dsw-alias-markdown-code-block: var(--beam-surface) !important;
  --dsw-alias-markdown-code-block-banner: var(--beam-elev) !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-menu-surface-fill: rgba(11,26,24,.92) !important;
}

/* Sidebar mark → Beam logo mask */
[class*="logoRow"] svg {
  width: 28px !important;
  height: 29px !important;
  color: var(--beam) !important;
  background: currentColor !important;
  -webkit-mask: url("${LOGO_URI}") center / contain no-repeat !important;
  mask: url("${LOGO_URI}") center / contain no-repeat !important;
}
[class*="logoRow"] svg * { opacity: 0 !important; }

/* Boot wordmark */
[class*="_wordmark_"] {
  width: 240px !important;
  height: 40px !important;
  background: url("${WORDMARK_URI}") center / contain no-repeat !important;
  color: transparent !important;
  font-size: 0 !important;
}

/* Primary buttons */
[class*="_primary_"], button[data-variant="primary"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important;
  border: none !important;
}
::selection { background: rgba(45,212,191,.35) !important; }
`

fs.writeFileSync(path.join(ASSETS, 'beam-override.css'), css)

console.log('→ index.html + live DOM rebrand injector')
let html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8')
html = html.replace(/<title>[^<]*<\/title>/, '<title>Beam Agent</title>')
const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const WORD = ${JSON.stringify(WORDMARK_URI)};
  const LOGO = ${JSON.stringify(LOGO_URI)};
  const rewriteText = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const v = n.nodeValue;
      if (!v || !/DeepSeek|Harness/i.test(v)) continue;
      // never touch module-looking strings in text rarely appear; UI copy only
      n.nodeValue = v
        .replace(/DeepSeek Harness/g, 'Beam Agent')
        .replace(/DeepSeek Account/g, 'ASSISTIX ID')
        .replace(/Sign in with DeepSeek/g, 'Sign in with ASSISTIX ID')
        .replace(/DeepSeek/g, 'Beam');
    }
  };
  const rewriteBrandArt = (root) => {
    for (const svg of root.querySelectorAll ? root.querySelectorAll('svg') : []) {
      const vb = svg.getAttribute('viewBox') || '';
      const w = Number(svg.getAttribute('width') || 0);
      // DeepSeek wordmark canvas
      if (vb.includes('182 24') || vb.includes('156 24') || (w >= 120 && svg.innerHTML.includes('clipPath'))) {
        const img = new Image();
        img.src = WORD;
        img.alt = 'Beam Agent';
        img.style.height = (svg.getAttribute('height') || '24') + 'px';
        img.style.width = 'auto';
        img.style.display = 'inline-block';
        img.style.verticalAlign = 'middle';
        svg.replaceWith(img);
        continue;
      }
      // Fish / mark: apply beam mask visually
      if (vb.includes('23.16') || vb.includes('1066 1107') || (w > 0 && w <= 40 && svg.querySelector('path'))) {
        svg.style.color = '#00B3BC';
        svg.style.background = 'currentColor';
        svg.style.webkitMask = 'url(' + JSON.stringify(LOGO).slice(1,-1) + ') center / contain no-repeat';
        svg.style.mask = 'url(' + JSON.stringify(LOGO).slice(1,-1) + ') center / contain no-repeat';
        for (const el of svg.querySelectorAll('*')) el.style.opacity = '0';
      }
    }
  };
  const run = () => {
    document.title = 'Beam Agent';
    rewriteText(document.body || document.documentElement);
    rewriteBrandArt(document.body || document.documentElement);
  };
  const obs = new MutationObserver(() => run());
  const start = () => {
    run();
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
</script>`
html = html.replace(/<link rel="stylesheet" href="\.\/assets\/beam-override\.css">[\s\S]*?<\/script>\s*/g, '')
html = html.replace('</head>', `${inject}\n</head>`)
fs.writeFileSync(path.join(WEB, 'index.html'), html)
fs.writeFileSync(path.join(WEB, 'favicon.svg'), logoSvg)
fs.writeFileSync(path.join(WEB, 'favicon-dark.svg'), logoSvg)

const manifest = path.join(WEB, 'manifest.webmanifest')
if (fs.existsSync(manifest)) {
  fs.writeFileSync(manifest, safeReplaceUserStrings(fs.readFileSync(manifest, 'utf8')))
}

console.log('→ Rewrite brand-official client to Beam SVG images')
const brandClient = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-client-ui-brand-official', 'lib', 'client.js')
if (fs.existsSync(brandClient)) {
  const client = `window.__ModuleLoader__.load({
\tid: "@deepseek-ai/dsh-client-ui-brand-official",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\tlet jsx = require("react/jsx-runtime");
\t\tconst LOGO = ${JSON.stringify(LOGO_URI)};
\t\tconst WORD = ${JSON.stringify(WORDMARK_URI)};
\t\tfunction OfficialBrandMark({ size = 24 }) {
\t\t\treturn jsx.jsx("img", { src: LOGO, alt: "Beam", width: size, height: size * 1.038, style: { display: "block", color: "#00B3BC" } });
\t\t}
\t\tfunction OfficialBrandName() {
\t\t\treturn jsx.jsx("img", { src: WORD, alt: "Beam Agent", style: { height: 24, width: "auto", display: "block" } });
\t\t}
\t\tfunction apply(ctx) {
\t\t\tctx.plugin(require("@deepseek-ai/dsh-client-ui-sidebar").default ?? require("@deepseek-ai/dsh-client-ui-sidebar"), {});
\t\t\t// slot registration matches upstream brand-official
\t\t\tif (ctx.slots?.contribute) {
\t\t\t\tctx.slots.contribute("sidebar.brand.mark", OfficialBrandMark);
\t\t\t\tctx.slots.contribute("sidebar.brand.name", OfficialBrandName);
\t\t\t}
\t\t}
\t\texports.OfficialBrandMark = OfficialBrandMark;
\t\texports.OfficialBrandName = OfficialBrandName;
\t\texports.apply = apply;
\t\texports.default = apply;
\t\treturn module.exports;
\t}
});
`
  // Keep original factory structure more carefully by only swapping JSX returns
  let original = fs.readFileSync(brandClient, 'utf8')
  // Safer surgical replace: swap FishLogo/BrandWordmark usage for img
  original = original.replace(
    /return \(0,[^)]+jsx\)\([^,]+,\s*\{[^}]*size[^}]*\}\)/g,
    (m) => m,
  )
  // Replace require primitives usage with inline img components by rewriting OfficialBrand* bodies if present
  if (original.includes('FishLogo') && original.includes('BrandWordmark')) {
    original = original.replace(
      /function OfficialBrandMark\([^)]*\)\s*\{[\s\S]*?\n\t\t\}/,
      `function OfficialBrandMark({ size }) {\n\t\t\treturn (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(LOGO_URI)}, alt: "Beam", width: size, height: Math.round(size * 1.038), style: { display: "block" } });\n\t\t}`,
    )
    original = original.replace(
      /function OfficialBrandName\([^)]*\)\s*\{[\s\S]*?\n\t\t\}/,
      `function OfficialBrandName() {\n\t\t\treturn (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(WORDMARK_URI)}, alt: "Beam Agent", style: { height: 24, width: "auto", display: "block" } });\n\t\t}`,
    )
    // Also handle arrow/minified forms
    original = original.replace(
      /OfficialBrandMark\s*=\s*\([^)]*\)\s*=>\s*[^\n]+FishLogo[^\n]+/,
      `OfficialBrandMark = ({ size }) => (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(LOGO_URI)}, alt: "Beam", width: size, height: Math.round((size||24)*1.038), style: { display: "block" } })`,
    )
    original = original.replace(
      /OfficialBrandName\s*=\s*\([^)]*\)\s*=>\s*[^\n]+BrandWordmark[^\n]+/,
      `OfficialBrandName = () => (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(WORDMARK_URI)}, alt: "Beam Agent", style: { height: 24, width: "auto", display: "block" } })`,
    )
    fs.writeFileSync(brandClient, original)
    console.log('  brand-official client patched')
  } else {
    console.log('  brand-official unexpected shape, dumping snippet')
    console.log(original.slice(0, 1200))
  }
}

console.log('→ Welcome brand + main strings (safe)')
fs.writeFileSync(path.join(APP, 'renderer', 'assets', 'welcome-brand.svg'), wordmarkSvg)
const mainJs = path.join(APP, 'lib', 'main.js')
if (fs.existsSync(mainJs)) {
  let main = fs.readFileSync(mainJs, 'utf8')
  // only locale/product strings — protect deepseek-ai already via safeReplace for user phrases
  main = main.split('DeepSeek Harness').join('Beam Agent')
  // Chinese about strings already handled if English phrase present
  fs.writeFileSync(mainJs, main)
}

fs.writeFileSync(path.join(ROOT, 'dist', 'Beam Agent', 'resources', 'icon.svg'), logoSvg)

console.log('✓ Safe rebrand done')
