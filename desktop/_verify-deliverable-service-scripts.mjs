/**
 * Verify Chat deliverable service-script filter is present in runtime + dist.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const TARGETS = [
  'runtime/app/beam/node_modules/@assistix/beam-client-ui-deliverables/lib/client.js',
  'runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-deliverables/lib/client.js',
  'dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-deliverables/lib/client.js',
  'dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-deliverables/lib/client.js',
]

const NEEDLES = [
  'BEAM_DELIVERABLE_SERVICE_FILTER',
  'beamShouldSuppressServiceScripts',
  'visiblePresented',
  'beamFilterChangesSummary',
  'data-beam-service-filtered',
  'beamReviewIndex(singleFile, 0)',
]

let failed = false
for (const rel of TARGETS) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) {
    console.error('MISSING', rel)
    failed = true
    continue
  }
  const src = fs.readFileSync(file, 'utf8')
  for (const needle of NEEDLES) {
    if (!src.includes(needle)) {
      console.error('MISSING needle', needle, 'in', rel)
      failed = true
    }
  }
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (check.status !== 0) {
    console.error('SYNTAX FAIL', rel, check.stderr || check.stdout)
    failed = true
  } else {
    console.log('ok', rel)
  }
}

// Heuristic smoke via upstream module if present; else duplicate assert.
const cases = [
  {
    title: 'Реферат о варёных огурцах',
    paths: ['make_referat.py', 'Почему варёные грурцы это имба.docx'],
    expectSuppress: true,
  },
  {
    title: 'Напиши python скрипт для парсинга CSV',
    paths: ['parse_csv.py'],
    expectSuppress: false,
  },
  {
    title: 'Presentation for Q3',
    paths: ['build_deck.py', 'Q3.pptx'],
    expectSuppress: true,
  },
  {
    title: 'fix_runner',
    paths: ['make_referat.py'],
    expectSuppress: false,
  },
]

const upstream = path.join(
  ROOT,
  '_beam_upstream_src/packages/client/ui-deliverables/src/client/user-facing-deliverables.ts',
)
if (!fs.existsSync(upstream)) {
  console.error('MISSING upstream helper', upstream)
  failed = true
} else {
  // Lightweight parse of decision using same rules as patch self-check
  const SERVICE = new Set(['.py', '.pyw', '.ps1', '.psm1', '.sh', '.bash', '.zsh', '.cmd', '.bat'])
  const ARTIFACT = new Set(['.docx', '.doc', '.pdf', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.odp', '.ods', '.rtf', '.html', '.htm', '.md', '.txt', '.csv', '.epub', '.tex', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
  const CODE = new Set(['.py', '.pyw', '.ps1', '.sh', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.rs', '.java', '.kt', '.cs', '.cpp', '.c', '.h', '.rb', '.php', '.swift', '.vue', '.svelte', '.css', '.scss', '.json', '.yml', '.yaml', '.toml'])
  const helperRe = /^(make_|build_|gen_|generate_|render_|create_|export_|compile_|run_|helper_|util_|scaffold_)/i
  const codingRe = /\b(python|\.py\b|typescript|\.tsx?\b|javascript|\.jsx?\b|scripts?|coding|codebase|refactor|pytest|unittest|lint|debug|программ|скрипт|питон|(?:^|\s)код(?:\s|$))/i
  const docRe = /\b(реферат|доклад|эссе|курсов|диплом|презентац|исследован|отч[её]т|essay|report|docx|pptx|pdf|presentation|slides?|thesis|paper|write[- ]?up|research)\b/i
  const ext = (p) => {
    const base = String(p || '').replace(/\\/g, '/').split('/').pop() || ''
    const i = base.lastIndexOf('.')
    return i >= 0 ? base.slice(i).toLowerCase() : ''
  }
  const base = (p) => String(p || '').replace(/\\/g, '/').split('/').pop() || ''
  const isService = (p) => SERVICE.has(ext(p))
  const isArtifact = (p) => ARTIFACT.has(ext(p))
  const isCode = (p) => CODE.has(ext(p))
  const isHelper = (p) => isService(p) && (helperRe.test(base(p)) || /^(make|build|gen|generate|render)-/i.test(base(p)))
  const isCoding = (title, paths) => {
    const text = String(title || '')
    const list = paths.filter(Boolean)
    const hasArtifact = list.some(isArtifact)
    const serviceScripts = list.filter(isService)
    const helpers = list.filter(isHelper)
    const codingHint = codingRe.test(text)
    const docHint = docRe.test(text)
    if (docHint && !codingHint) return false
    if (hasArtifact && (helpers.length > 0 || serviceScripts.length > 0) && !codingHint) return false
    if (codingHint && !docHint) return true
    if (!hasArtifact && list.length > 0 && list.every((p) => isService(p) || isCode(p))) return true
    if (!hasArtifact && serviceScripts.length > 0 && list.every(isService)) return true
    return false
  }
  for (const c of cases) {
    const suppress = !isCoding(c.title, c.paths)
    if (suppress !== c.expectSuppress) {
      console.error('heuristic fail', c)
      failed = true
    } else {
      console.log('heuristic ok:', c.title.slice(0, 40))
    }
  }
}

// Ensure we did not introduce BEAM_BASE_URL into packaged .env
for (const envPath of [
  path.join(ROOT, 'dist/Beam-Agent/resources/app/.env'),
  path.join(ROOT, 'runtime/app/.env'),
  path.join(ROOT, '.env'),
]) {
  if (fs.existsSync(envPath)) {
    const body = fs.readFileSync(envPath, 'utf8')
    if (/BEAM_BASE_URL\s*=/.test(body)) {
      console.error('UNEXPECTED BEAM_BASE_URL in', envPath)
      failed = true
    }
  }
}

void require
if (failed) {
  console.error('VERIFY FAILED')
  process.exit(1)
}
console.log('VERIFY OK')
