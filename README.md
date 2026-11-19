# Beam Agent

Десктопный ИИ-агент Assistix на базе DeepSeek Harness runtime.

## Запуск

Дважды кликни `Start Beam Agent.vbs` (или ярлык в меню Пуск / на рабочем столе) — окно консоли не появляется. `Start Beam Agent.cmd` тоже вызывает тот же silent launcher.

Отдельно от DeepSeek Harness:

- данные: `%USERPROFILE%\.beam`
- Electron userData: `%USERPROFILE%\.beam\electron-userdata`
- appId: `org.assistix.beam-agent`

## ASSISTIX ID

Логин: http://127.0.0.1:17865/assistix/login  
(или `ASSISTIX ID Login.cmd`)

## Модели (Assistix LLM Gateway)

| Модель | Публичный id | Лимит токенов |
|--------|--------------|---------------|
| Tide | `tide` | 100 000 |
| Flare | `flare` | 50 000 |
| Pine | `pine` | 10 000 |

Локальный bridge ходит в Assistix API (`https://agent.assistix.org/llm` / `api.assistix.org`) с Assistix ID. Маппинг на upstream и ключ провайдера — только на сервере.

## Пересборка

```bat
node desktop\build-beam.mjs
```

Нужен уже распакованный `runtime\app` (из DeepSeek Harness `app.asar`).

## Early Alpha installer + auto-update

```bat
node desktop\package-installer.mjs
python desktop\installer\deploy-early-alpha.py
```

Артефакт: `dist\installers\Beam-Agent-0.1.5-Setup.exe`  
Публично: https://agent.assistix.org/download/  
Feed: https://agent.assistix.org/download/nightly.yml (и `latest.yml`)  
Подпись (опционально): `desktop/installer/CODE-SIGNING.md`  
Инструкция для тестеров: `dist\installers\EARLY-ALPHA-TESTERS.md`

## Publish update channel

```bat
node desktop\package-installer.mjs
python desktop\publish-desktop-update.py dist\installers\Beam-Agent-0.1.5-Setup.exe --version 0.1.5 --notes "…"
```

Secrets (SSH / FTP / update token / Kumo / OAuth) live in this private repo — see `secrets.local.env` and `secrets.example.env`.

## Secrets

Private repo keeps live passwords/tokens in `secrets.local.env` (also mirrored in `secrets.example.env` and deploy script defaults):

- `BP` / `ASSISTIX_SSH_PASS` — hosting SSH
- `ASSISTIX_FTP_PASS` — hosting FTP (id.assistix.org)
- `BEAM_UPDATE_TOKEN` — update publish API
- `KUMO_API_KEY` — Assistix LLM Gateway → Kumorouter
- `ASSISTIX_OAUTH_CLIENT_SECRET` — ASSISTIX ID OAuth

## Repo layout

- `desktop/` — Electron packager, bridge, installers, admin/deploy scripts
- `runtime/app/` — desktop app runtime (without `node_modules`; restore from Harness / local build)
- `cloud/` — agent.assistix.org PHP/API ship tree + deploy
- `assets/` — icons/branding
- Launchers: `Start Beam Agent.vbs`, `ASSISTIX ID Login.vbs`

Rebuild: `node desktop\build-beam.mjs` then `node desktop\package-installer.mjs`.
