/**
 * Harden ASSISTIX session persistence on the local bridge.
 * - Never clear a real session except explicit /assistix/logout
 * - Stub OAuth callback must not clobber a real signed-in user
 * - Persist access + refresh tokens; refresh before JWT expiry
 * - Transient network/auth blips keep the last good session
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
  path.join(ROOT, "desktop", "bridge", "server.js"),
  path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js"),
  path.join(process.env.USERPROFILE || "", "BeamAgent", "bridge", "server.js"),
].filter((p) => fs.existsSync(p));

const HELPERS = `
/* BEAM_SESSION_PERSIST */
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json')
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000 // ~6 months local grace

function readTokenStore() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return {}
    const j = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
    return j && typeof j === 'object' ? j : {}
  } catch { return {} }
}

function writeTokenStore(tokens) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2))
  } catch (e) {
    bridgeLog('token_store_write_fail: ' + String(e?.message || e))
  }
}

function persistSessionTokens(session) {
  if (!session || typeof session !== 'object') return
  const access = session.token || session.access_token || null
  const refresh = session.refresh_token || null
  if (!access && !refresh) return
  const prev = readTokenStore()
  writeTokenStore({
    access_token: access || prev.access_token || null,
    refresh_token: refresh || prev.refresh_token || null,
    id_user_id: session.id_user_id || prev.id_user_id || null,
    email: session.email || prev.email || null,
    updatedAt: new Date().toISOString(),
  })
}

function clearTokenStore() {
  try { if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE) } catch {}
}

function jwtExpMs(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return 0
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const payload = JSON.parse(json)
    const exp = Number(payload?.exp || 0)
    return exp > 0 ? exp * 1000 : 0
  } catch { return 0 }
}

function isRealAssistixSession(session) {
  if (!session || typeof session !== 'object') return false
  const id = Number(session.id_user_id || session.user_id || 0) || 0
  const email = String(session.email || '').trim().toLowerCase()
  if (id > 0 && email.includes('@') && email !== 'user@assistix.org' && email !== 'guest@assistix.org') return true
  return false
}

async function refreshAssistixAccessToken(refreshToken) {
  if (!refreshToken) return null
  const endpoints = [
    ID_BASE.replace(/\\/$/, '') + '/api/oauth/token',
    ID_BASE.replace(/\\/$/, '') + '/api/oauth/token.php',
    ID_BASE.replace(/\\/$/, '') + '/api/auth/refresh',
  ]
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.ASSISTIX_OAUTH_CLIENT_ID || 'assistix-agent',
          client_secret: process.env.ASSISTIX_OAUTH_CLIENT_SECRET || 'YOUR_OAUTH_CLIENT_SECRET_HERE',
        }),
      })
      if (!r.ok) continue
      const data = await r.json().catch(() => null)
      if (!data) continue
      const access = data.access_token || data.token || null
      if (!access) continue
      return {
        access_token: access,
        refresh_token: data.refresh_token || refreshToken,
        user: data.user || null,
      }
    } catch {}
  }
  return null
}

async function ensureSessionFresh(state) {
  if (!state || !isRealAssistixSession(state.session)) return state
  const session = state.session
  const store = readTokenStore()
  const access = session.token || session.access_token || store.access_token || null
  const refresh = session.refresh_token || store.refresh_token || null
  const expMs = jwtExpMs(access)
  const skew = 6 * 60 * 60 * 1000 // refresh 6h before expiry
  const stillValid = !expMs || expMs - Date.now() > skew
  if (stillValid) {
    if (access && !session.token) session.token = access
    persistSessionTokens(session)
    return state
  }
  if (!refresh) {
    // No refresh token: keep local session for long TTL (do not drop casually)
    const at = Date.parse(session.at || 0) || 0
    if (!at || Date.now() - at < SESSION_TTL_MS) {
      bridgeLog('session_keep_without_refresh id=' + session.id_user_id)
      return state
    }
    return state
  }
  try {
    const next = await refreshAssistixAccessToken(refresh)
    if (!next?.access_token) {
      bridgeLog('session_refresh_miss; keeping local session')
      return state
    }
    session.token = next.access_token
    session.access_token = next.access_token
    if (next.refresh_token) session.refresh_token = next.refresh_token
    session.at = new Date().toISOString()
    if (next.user && typeof next.user === 'object') {
      if (next.user.display_name || next.user.name) {
        session.name = next.user.display_name || next.user.name
        session.display_name = session.name
      }
      if (next.user.avatar_url || next.user.avatar) {
        session.avatar_url = next.user.avatar_url || next.user.avatar
      }
    }
    persistSessionTokens(session)
    saveState(state)
    bridgeLog('session_refresh_ok id=' + session.id_user_id)
  } catch (e) {
    bridgeLog('session_refresh_error: ' + String(e?.message || e) + '; keeping local session')
  }
  return state
}
/* /BEAM_SESSION_PERSIST */
`;

function patchFile(file) {
  let s = fs.readFileSync(file, "utf8");
  const before = s;

  if (!s.includes("BEAM_SESSION_PERSIST")) {
    // Insert helpers after saveState
    if (s.includes("function saveState(state) {")) {
      s = s.replace(
        /function saveState\(state\) \{\s*ensureData\(\)\s*fs\.writeFileSync\(STATE_FILE, JSON\.stringify\(state, null, 2\)\)\s*\}/,
        (m) => m + "\n" + HELPERS
      );
    } else {
      console.warn("saveState not found", file);
    }
  }

  // status: refresh tokens softly, never drop session on blips
  if (s.includes("if (url.pathname === '/assistix/me' || url.pathname === '/assistix/status')")) {
    s = s.replace(
      /if \(url\.pathname === '\/assistix\/me' \|\| url\.pathname === '\/assistix\/status'\) \{[\s\S]*?const state = loadState\(\)\s*return sendJson\(res, 200, \{/,
      `if (url.pathname === '/assistix/me' || url.pathname === '/assistix/status') {
      // Prefer server quotas; local mirror is UX-only. Soft timeout so UI never hangs.
      const sync = syncQuotasFromServer()
      const raced = await Promise.race([
        sync.then((r) => r).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
      ])
      if (!raced) sync.catch(() => null) // continue in background if slow
      let state = loadState()
      try { state = await ensureSessionFresh(state) } catch {}
      if (isRealAssistixSession(state.session)) persistSessionTokens(state.session)
      return sendJson(res, 200, {`
    );
  }

  // logout: clear tokens too
  s = s.replace(
    /if \(url\.pathname === '\/assistix\/logout' && req\.method === 'POST'\) \{\s*const state = loadState\(\)\s*state\.session = null\s*saveState\(state\)/,
    `if (url.pathname === '/assistix/logout' && req.method === 'POST') {
      const state = loadState()
      state.session = null
      state.pendingSession = null
      state.lastAuthError = null
      clearTokenStore()
      saveState(state)`
  );

  // stub callback: never clobber a real Assistix session
  const stubCb = `if (url.pathname === '/assistix/callback') {
      // OAuth return — accept query token/code if present, otherwise open login form
      const state = loadState()
      state.session = {
        id: crypto.randomUUID(),
        email: url.searchParams.get('email') || 'user@assistix.org',
        name: url.searchParams.get('name') || 'Assistix User',
        provider: 'assistix-id-oauth',
        code: url.searchParams.get('code') || null,
        at: new Date().toISOString(),
      }
      saveState(state)
      res.writeHead(302, { Location: '/assistix/done' })
      return res.end()
    }`;

  const safeCb = `if (url.pathname === '/assistix/callback') {
      // Soft OAuth return: never clobber a real Assistix session with stub data.
      const state = loadState()
      const code = url.searchParams.get('code') || ''
      const email = String(url.searchParams.get('email') || '').trim().toLowerCase()
      const name = url.searchParams.get('name') || ''
      if (isRealAssistixSession(state.session)) {
        bridgeLog('oauth_callback_keep_existing id=' + state.session.id_user_id)
        res.writeHead(302, { Location: '/assistix/done' })
        return res.end()
      }
      if (code || (email && email.includes('@') && email !== 'user@assistix.org')) {
        state.pendingSession = {
          id: crypto.randomUUID(),
          email: email || 'user@assistix.org',
          name: name || 'Assistix User',
          provider: 'assistix-id-oauth',
          code: code || null,
          at: new Date().toISOString(),
        }
        saveState(state)
      }
      res.writeHead(302, { Location: '/assistix/done' })
      return res.end()
    }`;

  if (s.includes(stubCb)) s = s.replace(stubCb, safeCb);

  // login-password: persist tokens when ID returns them
  if (s.includes("const st = { ...(loadState() || {}), session, updatedAt: Date.now() }")
    && !s.includes("persistSessionTokens(session)")) {
    s = s.replace(
      "const st = { ...(loadState() || {}), session, updatedAt: Date.now() }\n        saveState(st)",
      `if (data.access_token || data.token) session.token = data.access_token || data.token
        if (data.refresh_token) session.refresh_token = data.refresh_token
        session.from_exchange = true
        const st = { ...(loadState() || {}), session, updatedAt: Date.now() }
        saveState(st)
        persistSessionTokens(session)`
    );
  }

  // After successful login POST, persist tokens
  if (s.includes("state.session = {") && s.includes("provider: 'assistix-id',") && !s.includes("/* session persist after login */")) {
    s = s.replace(
      "saveState(state)\n      await syncQuotasFromServer().catch(() => null)\n      return sendJson(res, 200, { ok: true, user: state.session, quotas: loadState().quotas })\n    }",
      `saveState(state)
      /* session persist after login */
      if (isRealAssistixSession(state.session)) persistSessionTokens(state.session)
      await syncQuotasFromServer().catch(() => null)
      return sendJson(res, 200, { ok: true, user: state.session, quotas: loadState().quotas })
    }`
    );
  }

  if (s !== before) {
    fs.writeFileSync(file, s);
    console.log("patched", file);
    return true;
  }
  console.log("unchanged", file);
  return false;
}

let n = 0;
for (const f of TARGETS) if (patchFile(f)) n++;
console.log("done files=", n);
