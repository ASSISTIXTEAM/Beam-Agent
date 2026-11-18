# Beam Agent Cloud — architecture

**Live URL:** https://agent.assistix.org/

## Goal

Same product as desktop Beam Agent, in the cloud: ASSISTIX ID auth, Projects, Sessions, Chat / Process, Tide / Flare / Pine, Profile / Limits, durable per-account workspaces, agent tools on the server.

## Stack

- **Hosting:** Reg.ru PHP shared hosting (`agent.assistix.org`) — no Node Cordis host (system Node is v10; desktop needs Node 24 + long-lived WS).
- **Frontend:** Desktop-parity Beam shell (`index.html` + `assets/beam-app.*`) using **real Beam fonts / mark / icons** from `@assistix/beam-web-frontend` (`assets/beam/`). HTTPS bridge shim: `api/bridge.php` (desktop `/assistix/status` shape).
- **Auth:** ASSISTIX ID OAuth (`assistix-agent` → `/auth/callback.php` → ticket → `/auth/complete.php`). No guest. Invite gate via `rollout_gate_enforce('chat')`.
- **Models:** Tide / Flare / Pine via Kumorouter (key only in server `config.local.php`).
- **Persistence:** MySQL conversations/messages + `storage/projects/` + `storage/cloud/{uid}/` workspaces.
- **Agent loop:** PHP runtime (`lib/agent.php`, sandbox tools, ASSISTIX Environment).

## Auth (do not break)

- Cookie: 90-day `ASSISTIX_AGENT_SESS` under `storage/sessions/`.
- Refresh: `ASSISTIX_AGENT_RT` + `localStorage acx_agent_rt_v1`; `/auth/ping.php`, `/auth/restore.php`; API `_boot.php` rehydrates from RT.
- Mobile OAuth: callback never Sets-Cookie on cross-site hop. Ticket → first-party `complete.php` 200 HTML.
- `index.php` injects `__ACX_PREAUTH__` so first paint is the app shell when already signed in.

## Ported vs stubbed

| Area | Status |
|------|--------|
| Projects / Sessions / Chat / Process | Ported (cloud PHP APIs) |
| Tide / Flare / Pine + weekly limits | Ported |
| Profile / ASSISTIX ID / logout | Ported |
| Cloud workspace + agent file tools | Ported (server sandbox) |
| Composer + streaming | Ported (`acx-core` + `stream.php`) |
| Deliverables / process steps | Ported via `workspace.php` |
| Computer use | **Stubbed** — desktop only, clear UX |
| Cordis UI plugins / Typert WS host | **Not runnable** on this shared host — shell is Beam-looking cloud port of the product modules |

## Deploy

```bat
set BP=<ssh password>
python cloud\deploy.py
```

Source of truth: `cloud/ship/`. Deploy backs up remote `index.html`, wipes obsolete chat-shell assets, uploads the new stack, hard cache-busts.
