# Beam Agent desktop updates

## Endpoints
- `GET https://agent.assistix.org/api/check-update.php?current=<localVersion>`
  - Returns `updateAvailable`, `critical` / `mandatory` (true only when newer **and** release marked critical), `channel`, notes, hashes, download URL.
- `POST https://agent.assistix.org/api/publish-update.php` (auth: `X-Beam-Update-Token` / Bearer)
  - Accepts `critical` / `mandatory` / `force` (bool or `1`/`true`/`yes`).
- Storage: `https://agent.assistix.org/updates/` (latest package only + `manifest.json`)
- electron-updater feeds mirrored to `https://agent.assistix.org/download/{nightly,latest}.yml`

## Publish
```bash
python desktop/publish-desktop-update.py path/to/Setup.exe --version 0.1.6 --notes "…"
# Security / mandatory:
python desktop/publish-desktop-update.py path/to/Setup.exe --version 0.1.7 --critical --notes "Security fix"
```
Or deploy APIs only: `python desktop/_deploy_update_api.py`

Token env: `BEAM_UPDATE_TOKEN` (default ops token matches server fallback).

## Client
- **О приложении** hosts Updates + Network + Notifications (4-nav: Настройки / Профиль / Лимиты / О приложении).
- Profile foot shows **Update / Обновить** when server version > local; gear + About nav show a badge.
- **Critical** releases open a persistent blocking modal (no dismiss) until the update is applied.
- Click Обновить → bridge `POST /assistix/update/apply` (download + sha512 + silent install); Electron updater is fallback.
- Bridge keeps previous installer under `%USERPROFILE%\.beam\bridge\updates\` and rolls back on critical apply/boot failure.
