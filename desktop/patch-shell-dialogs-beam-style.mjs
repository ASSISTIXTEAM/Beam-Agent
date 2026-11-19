/**
 * Beam Agent — restyle Electron shell dialogs (tray/about/update) + ASSISTIX-official aliases.
 * Safe to re-run. Does not touch auth/oauth.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const copies = [
  path.join(root, 'runtime', 'app'),
  path.join(root, 'dist', 'Beam-Agent', 'resources', 'app'),
]

function patchFile(file, transform) {
  if (!fs.existsSync(file)) return false
  const before = fs.readFileSync(file, 'utf8')
  const after = transform(before)
  if (after === before) return false
  fs.writeFileSync(file, after)
  return true
}

for (const app of copies) {
  const render = path.join(app, 'renderer')
  const srcRender = path.join(root, 'runtime', 'app', 'renderer')
  for (const f of ['update-dialog.css', 'mandatory-update.css', 'update-close.svg', 'welcome.css']) {
    const from = path.join(srcRender, f)
    const to = path.join(render, f)
    if (fs.existsSync(from) && app.includes('dist')) fs.copyFileSync(from, to)
  }

  const apiKey = path.join(app, 'beam/node_modules/@assistix/beam-llm-assistix-api-key/lib/index.js')
  patchFile(apiKey, (s) => {
    if (s.includes('PROVIDER_ALIASES')) return s
    return s
      .replace(
        'const PROVIDER = "assistix-official";',
        `const PROVIDER = "assistix-official";\n/** Beam Agent: map legacy DeepSeek + display-case ids onto the Tide bridge route. */\nconst PROVIDER_ALIASES = ["assistix-official", "ASSISTIX-official", "deepseek-official", "DeepSeek-official"];`,
      )
      .replace('registerDeepSeekProvider(ctx, PROVIDER, {', 'registerDeepSeekProvider(ctx, PROVIDER_ALIASES, {')
  })

  const assistix = path.join(app, 'beam/node_modules/@assistix/beam-llm-assistix/lib/index.js')
  patchFile(assistix, (s) => {
    if (s.includes('Beam Agent: accept string or alias list')) return s
    return s.replace(
      /function registerDeepSeekProvider\(ctx, provider, dependencies\) \{\r?\n\tctx\.inject/,
      `function registerDeepSeekProvider(ctx, provider, dependencies) {\n\t/* Beam Agent: accept string or alias list so legacy/case variants resolve. */\n\tconst providers = Array.isArray(provider) ? provider : [provider];\n\tconst primaryProvider = providers[0];\n\tctx.inject`,
    )
      .replace('const registration = ctx.llm.registerAdapter([provider], adapter);', 'const registration = ctx.llm.registerAdapter(providers, adapter);')
      .replace('registration.replace([provider]);', 'registration.replace(providers);')
  })

  const llm = path.join(app, 'beam/node_modules/@assistix/beam-llm/lib/index.js')
  patchFile(llm, (s) => {
    if (s.includes('Beam Agent: normalize provider aliases')) return s
    return s.replace(
      'const registration = this.adapters.get(provider);',
      `/* Beam Agent: normalize provider aliases before adapter lookup. */\n\t\t\tconst providerKey = (() => {\n\t\t\t\tconst p = String(provider ?? "");\n\t\t\t\tconst lower = p.toLowerCase();\n\t\t\t\tif (lower === "assistix-official" || lower === "deepseek-official" || p === "ASSISTIX-official") return this.adapters.has("assistix-official") ? "assistix-official" : (this.adapters.has(p) ? p : "assistix-official");\n\t\t\t\tif (lower === "assistix-account" || lower === "deepseek-account") return this.adapters.has("assistix-account") ? "assistix-account" : p;\n\t\t\t\treturn p;\n\t\t\t})();\n\t\t\tconst registration = this.adapters.get(providerKey) ?? this.adapters.get(provider);`,
    )
  })
}

console.log('beam-shell-dialogs-beam-style: done')
