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
