# Beam Agent desktop updates

## Endpoints
- `GET https://agent.assistix.org/api/check-update.php?current=<localVersion>`
- `POST https://agent.assistix.org/api/publish-update.php` (auth: `X-Beam-Update-Token` / Bearer)
- Storage: `https://agent.assistix.org/updates/` (latest package only + `manifest.json`)
- electron-updater feeds mirrored to `https://agent.assistix.org/download/{nightly,latest}.yml`

## Publish
```bash
python desktop/publish-desktop-update.py path/to/Setup.exe --version 0.1.6 --notes "…"
```
Or deploy APIs only: `python desktop/_deploy_update_api.py`

Token env: `BEAM_UPDATE_TOKEN` (default ops token matches server fallback).

## Client
- Profile foot shows **Update / Обновить** only when server version > local.
- Click → Electron `dshDesktop.updates.open()` (preferred) or bridge `POST /assistix/update/apply`.
- Bridge keeps previous installer under `%USERPROFILE%\.beam\bridge\updates\` and rolls back on critical apply/boot failure.
