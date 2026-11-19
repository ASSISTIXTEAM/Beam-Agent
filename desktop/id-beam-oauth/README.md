# Beam OAuth ID patch (id.assistix.org)

## Blocker
VrumVPN TUN (elevated) fake-ips Cursor as `198.18.0.1` → SSH/FTP banners never arrive.
ISPmanager `:1500` also unreachable while VPN is on. Computer Use cannot click elevated VrumVPN.

## Deploy (after VPN off / DIRECT works)
```powershell
python "C:\Beam-Agent\desktop\id-beam-oauth\deploy_beam_oauth.py"
```

Patches on server (when reachable):
- `api/bootstrap-login.php` — Beam loopback → always set `oauth_finish` when logged in; product `BEAM AGENT` / `Продолжить в Beam Agent`
- `api/oauth-finish.php` — allow loopback for Beam desktop OAuth (already accepts loopback; soft-guard added)
- `auth/auth-app.js` — hide «Открыть кабинет», synthesize finish UI, auto-continue
- `auth/index.html` (or index.php) — hide cabinet row for Beam query

Local ready files: `auth-app.patched.js`, `auth.index.patched.html`

## Probe notes
- `assistix-agent` already returns product BEAM AGENT (EN label)
- Beam desktop uses `assistix-chat` + `state.app=beam-agent` → still shows ASSISTIX CHAT
- `oauth-finish` without session → `missing_uid` for both loopback and https (loopback not rejected)
