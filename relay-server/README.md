# Ronan/Jarvis Relay

Internet-reachable bridge between your phone (or the home page, from any
browser) and Jarvis running on your laptop. It solves the "my laptop is
behind home Wi-Fi with no public IP" problem by having **Jarvis dial out**
to this relay and hold the connection open — nothing needs to be exposed or
port-forwarded on your home network. The phone/home page then dials in to
the same relay and sends it requests, which get forwarded over that open
connection to Jarvis and back.

This is a message relay, not a database — nothing is persisted except the
two auth tokens. If the relay process restarts, both sides just reconnect.

It also serves `index.html`, `tracker.html`, and `jarvis-phone.html` (from
the repo root, one level up) over plain HTTP, so whatever URL reaches this
server is also the URL your phone opens to use the app — no separate static
host needed. Nothing else in the repo is servable; those three pages are
named explicitly, not a directory listing.

## Two roles, two tokens

- **laptop token** — goes ONLY into `jarvis-integration/relay_client.py` on
  the machine running `jarvis.py`. Exactly one laptop connection is expected;
  a second one replaces the first (e.g. on Jarvis restart).
- **phone token(s)** — one per device you want able to talk to Jarvis (your
  phone, your browser on the home page, ...). A list, so adding a device
  doesn't mean rotating everyone else's token.

On first run both are generated and printed to the console, and saved to
`data/tokens.json` so they survive restarts. Set `LAPTOP_TOKEN` /
`PHONE_TOKENS` (comma-separated) yourself to pin them instead.

## Run it

```bash
cd relay-server
npm install
npm start
```

Listens on `0.0.0.0:3001` by default (`PORT`/`HOST` env vars to change).
**Put this behind HTTPS/WSS** before using it off your LAN — a reverse
proxy (Caddy/nginx) or a zero-config tunnel (Tailscale Funnel, Cloudflare
Tunnel) both work; the bearer tokens are meaningless over plain HTTP/WS.

## Run it on the laptop, right next to jarvis.py

You don't need a separate server to rent or manage — `relay-server` runs
on the same Windows machine as `jarvis.py`. Two ways to expose it, pick
one:

### Quick test (5 minutes, but fragile)

Good for confirming everything's wired up correctly. Not good for actual
daily use — the moment either terminal window closes, or the laptop sleeps,
your phone can't reach it, and the URL changes every restart.

```powershell
# Terminal 1 — the relay itself, staying on localhost
cd relay-server
npm install
npm start

# Terminal 2 — exposes it publicly over HTTPS/WSS, prints a
# https://<random-words>.trycloudflare.com URL
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3001
```

On your phone, open `https://<random-words>.trycloudflare.com/` — that
loads `index.html` straight from the relay. Gear icon → Settings → Relay
URL `wss://<random-words>.trycloudflare.com/ws` + your phone token.

### Make it stay up permanently (do this once, forget about it)

Two problems to solve: the relay needs to survive closed terminals/reboots,
and the public URL needs to stop changing every restart. [Tailscale](https://tailscale.com)
Funnel fixes both — free, no domain to buy, gives you a fixed
`https://<device>.<tailnet>.ts.net` address, and runs as a background
Windows service (no terminal window required at all).

```powershell
# 1. Install Tailscale (also installs its background service)
winget install tailscale.tailscale
tailscale up   # opens a browser tab to sign in — free account, any email/Google/GitHub

# 2. Point Funnel at the relay's port. This is stored by the background
#    tailscaled service, not tied to this terminal staying open.
tailscale funnel --bg 3001

# 3. Get your fixed public URL
tailscale funnel status
```

(Exact flags occasionally change between Tailscale versions — `tailscale
funnel --help` if `--bg` doesn't work as shown.)

Then make `relay-server` itself survive reboots/crashes without a terminal:

```powershell
cd relay-server
powershell -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1
```

That registers a Scheduled Task that starts `node server.js` at logon and
restarts it automatically if it ever crashes (`scripts\uninstall-startup-task.ps1`
to remove it later).

One thing this *doesn't* fix: if the laptop itself is fully asleep, it's off
the network and nothing reaches it regardless of services/tasks. If you
want the phone to always be able to reach it, stop the laptop from sleeping
while plugged in:

```powershell
powercfg /change standby-timeout-ac 0
```

(Leaves battery-mode sleep alone — only affects it while charging.)

Once this is set up: your phone's Settings (Relay URL / phone token) only
need entering **once** — the URL doesn't change anymore. Update
`jarvis-integration`'s config to point at `ws://localhost:3001/ws` instead
of the public URL — since `jarvis.py` runs on the same machine as
`relay-server`, it doesn't need to go out to the internet and back in.

## Protocol

WebSocket at `/ws?role=laptop|phone&token=<token>` (token can also go in an
`Authorization: Bearer <token>` header for non-browser clients — browsers'
`WebSocket` API can't set custom headers, hence the query-param fallback).

Phone/home -> relay -> laptop:

```json
{ "type": "request", "id": "optional-uuid", "kind": "chat", "payload": { "text": "..." } }
```

`kind` is one of `chat`, `daily_plan`, `efficiency` (payload
`{ "onLaptop": true|false }`) — see `jarvis-integration/README.md` for what
Jarvis is expected to do with each.

Laptop -> relay -> the phone/home client that made the matching request:

```json
{ "type": "response", "id": "same-id", "payload": { "text": "..." } }
```

or `{ "type": "error", "id": "same-id", "message": "..." }`.

Laptop -> relay -> all connected phone/home clients (no request involved,
e.g. a proactive check-in): `{ "type": "push", "payload": { "text": "..." } }`.

Requests time out after 30s if Jarvis doesn't reply, and requests made while
Jarvis isn't connected get an immediate `error` response — the phone/home
UI should show "Jarvis is offline" rather than hang.

`GET /status` (no auth) returns `{ online, lastSeen, phonesConnected }` so
the UI can show a status dot before opening a websocket.
