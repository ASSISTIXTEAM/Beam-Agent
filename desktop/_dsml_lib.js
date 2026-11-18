/**
 * Shared DSML extract helpers — inlined into bridge/server.js by patch-dsml-tool-leak.mjs
 * DeepSeek V4 / V4.1 tool markup → OpenAI tool_calls + clean chat text.
 */

/** @param {string} text */
export function makeDsmlHelpers(crypto, pathBasename) {
  const PIPE = '[|｜]'
  const OPEN = `<\\s*${PIPE}\\s*DSML\\s*${PIPE}`
  const CLOSE = `<\\/\\s*${PIPE}\\s*DSML\\s*${PIPE}`
  const BLOCK_OPEN = new RegExp(`${OPEN}\\s*(?:tool_calls|calls)\\s*>`, 'i')
  const BLOCK_CLOSE = new RegExp(`${CLOSE}\\s*(?:tool_calls|calls)\\s*>`, 'i')
  const ANY_OPEN = new RegExp(OPEN, 'i')

  function dsmlPresent(text) {
    return typeof text === 'string' && (ANY_OPEN.test(text) || /\|\s*DSML\s*\|/i.test(text))
  }

  function dsmlLooksIncomplete(text) {
    if (!dsmlPresent(text)) return false
    const opens = text.match(new RegExp(BLOCK_OPEN.source, 'gi')) || []
    const closes = text.match(new RegExp(BLOCK_CLOSE.source, 'gi')) || []
    if (opens.length > closes.length) return true
    if (ANY_OPEN.test(text.slice(-500)) && !BLOCK_CLOSE.test(text.slice(-500))) return true
    return false
  }

  function parseParamValue(raw, isString) {
    const v = String(raw ?? '')
    if (isString) return v
    const t = v.trim()
    if (!t) return ''
    try { return JSON.parse(t) } catch { return v }
  }

  function parseInvokes(inner) {
    const calls = []
    const invokeRe = new RegExp(
      `${OPEN}\\s*(?:invoke|tool)\\s+name="([^"]+)"\\s*>([\\s\\S]*?)${CLOSE}\\s*(?:invoke|tool)\\s*>`,
      'gi',
    )
    let m
    while ((m = invokeRe.exec(inner)) !== null) {
      const name = String(m[1] || '').trim()
      if (!name) continue
      const body = m[2] || ''
      const input = {}
      const paramRe = new RegExp(
        `${OPEN}\\s*parameter\\s+name="([^"]+)"(?:\\s+string="(true|false)")?\\s*>([\\s\\S]*?)${CLOSE}\\s*parameter\\s*>`,
        'gi',
      )
      let pm
      while ((pm = paramRe.exec(body)) !== null) {
        const key = String(pm[1] || '').trim()
        if (!key) continue
        input[key] = parseParamValue(pm[3], String(pm[2] || 'true').toLowerCase() !== 'false')
      }
      calls.push({
        id: `tool_${crypto.randomBytes(6).toString('hex')}`,
        type: 'function',
        function: { name, arguments: JSON.stringify(input) },
      })
    }
    return calls
  }

  function toolArgs(tc) {
    try { return JSON.parse(tc?.function?.arguments || '{}') } catch { return {} }
  }

  function scrubDuplicateFilePayloadProse(text, toolCalls) {
    if (!text || !toolCalls?.length) return text
    let largest = ''
    for (const tc of toolCalls) {
      const name = tc?.function?.name || ''
      if (!/write|edit|replace|file|create/i.test(name)) continue
      const args = toolArgs(tc)
      for (const key of ['contents', 'content', 'new_str', 'new_string', 'file_text', 'code', 'text', 'body']) {
        if (typeof args[key] === 'string' && args[key].length > largest.length) largest = args[key]
      }
    }
    if (largest.length < 400) return text
    const norm = (s) => s.replace(/\s+/g, ' ').slice(0, 600)
    const overlaps = norm(text).includes(norm(largest).slice(0, 160)) || text.length > largest.length * 0.45
    if (!overlaps) return text
    const lines = text.split('\n')
    const lead = []
    for (const line of lines) {
      const t = line.trim()
      if (!t) { if (lead.length) break; continue }
      if (/^(def |class |import |from |const |let |var |function |path\s*=|new_slide\(|panel\(|s\s*=\s*new_)/.test(t)) break
      if (/^[=\-–]{6,}$/.test(t) || /^===\s*\d+/.test(t)) break
      if (t.length > 180 && /[{();=]/.test(t)) break
      lead.push(t)
      if (lead.join(' ').length > 280) break
    }
    let file = ''
    for (const tc of toolCalls) {
      const args = toolArgs(tc)
      for (const key of ['path', 'file_path', 'filePath', 'filename', 'target']) {
        if (typeof args[key] === 'string' && args[key]) { file = args[key]; break }
      }
      if (file) break
    }
    const base = file ? pathBasename(file.replace(/\\/g, '/')) : ''
    if (lead.length) return lead.join(' ').trim()
    return base ? `Updating ${base}…` : ''
  }

  function stripDsmlDebris(text) {
    return String(text || '')
      .replace(new RegExp(`${OPEN}[^>]*>`, 'gi'), '')
      .replace(new RegExp(`${CLOSE}[^>]*>`, 'gi'), '')
      .replace(/\|\s*DSML\s*\|\s*(?:tool_calls|calls|invoke|parameter|tool)\b[^\n]*/gi, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  /** @returns {{ text: string, toolCalls: object[], hadDsml: boolean, incomplete: boolean }} */
  function extractDsmlToolCalls(text) {
    if (!text || typeof text !== 'string') {
      return { text: text || '', toolCalls: [], hadDsml: false, incomplete: false }
    }
    if (!dsmlPresent(text)) {
      return { text, toolCalls: [], hadDsml: false, incomplete: false }
    }

    const toolCalls = []
    let hadDsml = false
    let incomplete = false
    let out = ''
    let i = 0
    const openG = new RegExp(BLOCK_OPEN.source, 'gi')
    const closeG = new RegExp(BLOCK_CLOSE.source, 'gi')

    while (i < text.length) {
      openG.lastIndex = i
      const open = openG.exec(text)
      if (!open) {
        // No block wrapper — still try loose invokes, then strip debris
        const rest = text.slice(i)
        if (ANY_OPEN.test(rest) || /\|\s*DSML\s*\|/i.test(rest)) {
          hadDsml = true
          const loose = parseInvokes(rest)
          toolCalls.push(...loose)
          if (dsmlLooksIncomplete(rest) && !loose.length) incomplete = true
          // Cut from first DSML marker for visible text
          const cut = rest.search(/<\s*[|｜]\s*DSML|\|\s*DSML\s*\|/i)
          if (cut >= 0) out += rest.slice(0, cut)
          else out += rest
        } else {
          out += rest
        }
        break
      }
      hadDsml = true
      out += text.slice(i, open.index)
      const after = open.index + open[0].length
      closeG.lastIndex = after
      const close = closeG.exec(text)
      if (!close) {
        incomplete = true
        // Try parsing partial invokes before giving up
        toolCalls.push(...parseInvokes(text.slice(open.index)))
        break
      }
      const inner = text.slice(after, close.index)
      let parsed = parseInvokes(inner)
      if (!parsed.length) parsed = parseInvokes(open[0] + inner + close[0])
      toolCalls.push(...parsed)
      i = close.index + close[0].length
    }

    let clean = stripDsmlDebris(out)
    clean = scrubDuplicateFilePayloadProse(clean, toolCalls)
    return { text: clean, toolCalls, hadDsml, incomplete }
  }

  function mergeToolCalls(existing, fromDsml) {
    const out = Array.isArray(existing) ? [...existing] : []
    const seen = new Set(out.map((tc) => `${tc?.function?.name}::${tc?.function?.arguments || ''}`))
    for (const tc of fromDsml || []) {
      const key = `${tc?.function?.name}::${tc?.function?.arguments || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(tc)
    }
    return out
  }

  function stripDsmlMarkup(text) {
    return extractDsmlToolCalls(text).text
  }

  function createDsmlStreamGate() {
    let visible = ''
    let hold = ''
    let inDsml = false
    let toolCalls = []
    let hadDsml = false

    function feed(chunk) {
      if (!chunk) return ''
      let emit = ''
      hold += chunk
      while (hold.length) {
        if (!inDsml) {
          const m = hold.match(BLOCK_OPEN) || hold.match(ANY_OPEN)
          if (!m) {
            if (hold.length > 64 && /<[|｜]?\s*$/.test(hold.slice(-8))) {
              const keep = 12
              emit += hold.slice(0, -keep)
              visible += hold.slice(0, -keep)
              hold = hold.slice(-keep)
              break
            }
            if (/<\s*[|｜]?\s*D?S?M?L?\s*[|｜]?\s*(?:tool|call|invok|param)/i.test(hold.slice(-40)) && hold.length < 96) break
            emit += hold
            visible += hold
            hold = ''
            break
          }
          const idx = m.index
          if (idx > 0) {
            emit += hold.slice(0, idx)
            visible += hold.slice(0, idx)
          }
          hold = hold.slice(idx)
          inDsml = true
          hadDsml = true
          continue
        }
        const close = hold.match(BLOCK_CLOSE)
        if (!close) break
        const end = close.index + close[0].length
        const block = hold.slice(0, end)
        const parsed = extractDsmlToolCalls(block)
        toolCalls = mergeToolCalls(toolCalls, parsed.toolCalls)
        hold = hold.slice(end)
        inDsml = false
      }
      return emit
    }

    function finalize() {
      if (hold) {
        if (inDsml || dsmlPresent(hold)) {
          hadDsml = true
          const parsed = extractDsmlToolCalls(hold)
          toolCalls = mergeToolCalls(toolCalls, parsed.toolCalls)
          hold = ''
          inDsml = false
        } else {
          const flush = hold
          visible += hold
          hold = ''
          const cleaned = extractDsmlToolCalls(visible)
          toolCalls = mergeToolCalls(toolCalls, cleaned.toolCalls)
          return { flush, text: cleaned.text, toolCalls, hadDsml: hadDsml || cleaned.hadDsml, incomplete: cleaned.incomplete }
        }
      }
      const cleaned = extractDsmlToolCalls(visible)
      toolCalls = mergeToolCalls(toolCalls, cleaned.toolCalls)
      return { flush: '', text: cleaned.text, toolCalls, hadDsml: hadDsml || cleaned.hadDsml, incomplete: cleaned.incomplete }
    }

    return { feed, finalize, get hadDsml() { return hadDsml }, get toolCalls() { return toolCalls } }
  }

  return {
    extractDsmlToolCalls,
    mergeToolCalls,
    stripDsmlMarkup,
    dsmlLooksIncomplete,
    dsmlPresent,
    createDsmlStreamGate,
  }
}
