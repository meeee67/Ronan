# Ronan

A phone-reachable home base for Jarvis (the voice assistant/dashboard
running on the laptop, source lives outside this repo) plus the time/
revenue tracker it's grounded in.

## Pieces

| Path | What it is |
| --- | --- |
| `index.html` | **Home page.** Open this first. Shows "what to do now" and laptop-efficiency suggestions (both answered by Jarvis over the relay), plus links to the tracker and the chat page. |
| `tracker.html` | Single-file, no-backend time/revenue tracker (localStorage only). Existing app this whole system is built around. |
| `jarvis-phone.html` | Phone chat/voice page — configurable wake-phrase listening, tap-to-talk, text chat, spoken replies. |
| `mcp-server/` | Remote MCP server exposing the tracker's data (`get_totals`, `start_timer`, etc.) as tools an AI assistant can call. Its own JSON store, separate from `tracker.html`'s localStorage — see its README for how to sync the two. |
| `relay-server/` | Internet-reachable message relay between the phone/home page and Jarvis on the laptop. Jarvis dials **out** to it, so nothing needs to be exposed on the home network. |
| `jarvis-integration/` | Drop-in files (`relay_client.py`, `mcp_client.py`) + a wiring guide for the actual `jarvis.py`, which lives on the laptop, not in this repo. |

## How it fits together

```
 phone (jarvis-phone.html) ─┐
                             ├─► relay-server (internet-reachable, token auth) ◄── jarvis.py (dials out)
 home page (index.html)    ─┘                                                          │
                                                                                         ▼
                                                                          mcp-server (tracker data)
                                                                          + Obsidian vault + config.json
```

- **Phone/home page → relay → Jarvis**: chat messages, the home page's
  "what to do now" and "laptop efficiency" prompts all travel this path.
  Jarvis answers using whatever it already knows (vault, routines,
  standards) plus any MCP tools it's configured to call — the tracker's
  `mcp-server` is the first one, `jarvis-integration/mcp_client.py` is
  config-driven so more can be added later.
- **Tracker ↔ mcp-server**: separate stores today (see `mcp-server/README.md`
  for the export/import bridge). `tracker.html` still works standalone with
  no backend at all if you never touch the relay/Jarvis side.
- **Jarvis itself**: not in this repo. `jarvis-integration/` is what you
  copy into its `files` source folder per the existing deploy workflow.

## First-time setup

1. **Tracker**: nothing to do — open `tracker.html` on your phone, it just
   works (localStorage).
2. **Relay**: run it on the laptop itself, right next to `jarvis.py`, and
   expose it with a free Cloudflare Quick Tunnel — no separate server to
   rent, no port forwarding. See `relay-server/README.md`'s "Recommended"
   section for the exact commands. Save the printed laptop token and phone
   token(s), and the `https://...trycloudflare.com` URL it gives you.
3. **Jarvis side**: follow `jarvis-integration/README.md` to wire the relay
   client (and, optionally, the tracker MCP server) into `jarvis.py`.
4. **Phone**: relay-server also serves the app pages, so just open the
   `https://...trycloudflare.com/` URL from step 2 on your phone — that's
   `index.html`. Enter the `wss://...trycloudflare.com/ws` relay URL and
   your phone token in Settings (shared with `jarvis-phone.html`
   automatically), then add the page to your home screen.

## Known limitation

Wake-word listening on the phone only works while `jarvis-phone.html` is
open and the screen is on — mobile browsers can't do continuous background
mic capture like a native app or Siri. Tap-to-talk and text chat aren't
affected by this and work anytime the page is open.
