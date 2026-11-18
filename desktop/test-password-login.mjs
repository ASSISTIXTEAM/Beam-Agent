/**
 * Smoke-test Beam bridge password login against real ASSISTIX ID.
 * Usage: node desktop/test-password-login.mjs email@mail.ru 'password'
 */
const email = process.argv[2] || ''
const password = process.argv[3] || ''
if (!email.includes('@') || !password) {
  console.error('Usage: node desktop/test-password-login.mjs <email> <password>')
  process.exit(2)
}
const r = await fetch('http://127.0.0.1:17865/assistix/login-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ email, password }),
})
const j = await r.json().catch(() => ({}))
console.log(JSON.stringify({ status: r.status, body: j }, null, 2))
if (j.ok && j.pendingUser) {
  const c = await fetch('http://127.0.0.1:17865/assistix/confirm', { method: 'POST' })
  console.log('confirm', c.status, await c.json())
  console.log('status', await (await fetch('http://127.0.0.1:17865/assistix/status')).json())
}
process.exit(j.ok ? 0 : 1)
