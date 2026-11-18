# Beam Projects isolation

## What leaked
- Default workspace used to resolve under `Documents/deepseek-harness`.
- Detach script could seed Beam’s default workspace from DeepSeek Harness files.
- Add-project UX only adopted an existing folder (easy to re-pick Harness dirs).
- `@deepseek-ai/*` junctions still exist for code compat, but must never share project storage.

## What Beam reads/writes now
| Role | Path |
|------|------|
| Durable home | `%USERPROFILE%\.beam` (`BEAM_HOME`) |
| Project registry | `%USERPROFILE%\.beam\storages\workspace.json` |
| Named projects | `%USERPROFILE%\.beam\projects\<name>\` |
| Default project | `%USERPROFILE%\.beam\default-workspace\` |
| Sessions / caches | `%USERPROFILE%\.beam\sessions\`, `%USERPROFILE%\.beam\storages\` |
| Electron userData | `%USERPROFILE%\.beam\electron-userdata\` |

DeepSeek locations (not used by Beam):
- `%USERPROFILE%\.deepseek` (absent)
- `%USERPROFILE%\OneDrive\Documents\deepseek-harness`
- `%LOCALAPPDATA%\Programs\DeepSeek Harness`

## Features shipped
1. **Create by name** — UI «Новый проект / New project» → host creates `%USERPROFILE%\.beam\projects\<slug>\` and registers it.
2. **Create from folder** — «Выбрать папку… / Choose folder…» adopts an existing directory (DeepSeek Harness paths rejected).
3. **Listing filter** — workspace feed baseline drops Harness paths.
4. **Copy** — user-facing EN/RU uses Projects / Проекты.
5. **No seed** — `beam-detach-harness.mjs` no longer copies Documents/deepseek-harness into Beam.

## How to verify
```bat
node desktop\_verify-projects-isolate.mjs
```
Manual:
1. Start via `Start Beam Agent.vbs`.
2. Sidebar **+** → **Новый проект** → name only → folder appears under `~\.beam\projects\`.
3. **Выбрать папку…** → pick a normal folder (not deepseek-harness).
4. Confirm `~\.beam\storages\workspace.json` paths stay under `~\.beam` or user-chosen non-Harness dirs.
5. Confirm no entries for `Documents\deepseek-harness`.

## Create-by-name bug (fixed)
UI sent `{ title }` only. Host `create()` already allocated `~/.beam/projects/<name>`, but
gateway boundary validation used `typert.host.js` / `typert.remote-client.js` schemas that still
**required `path`** and rejected `title` → `gateway/input-invalid` / wire field `"request"`.
Fix: loosen create codecs (optional `path` + `title`) in typert host/remote + remotes; map
remaining create failures to clean UI copy.

## Patch entrypoint
`desktop/beam-projects-isolate.mjs` (re-runnable for host/typert/remotes/UI in runtime+dist).
