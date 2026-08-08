# Jarvis relay + MCP integration

Three files meant to be copied into your Jarvis `files` source folder
(then deployed to `C:\Jarvis` as usual) so `jarvis.py` can:

1. Talk to the phone app / home page over the internet, via `relay-server`
   (Jarvis dials **out**, so nothing on your home network needs to be
   exposed).
2. Call tools on any remote MCP server — starting with the tracker's own
   `mcp-server` — while answering.

This code isn't wired into `jarvis.py` automatically: that file lives on
your machine, not in this repo, so integrating it is a manual step (same
reason the existing deploy workflow copies files by hand instead of a
build/CI step).

## Files

- `relay_client.py` — outbound websocket connection to the relay, auto-
  reconnecting. You give it a `handler(kind, payload) -> str` function; it
  calls that for every relayed request and sends back whatever string it
  returns.
- `mcp_client.py` — synchronous helper to call tools on any MCP server
  listed in `mcp_servers.json` (config-driven, so adding a server later
  doesn't need a code change).
- `mcp_servers.example.json` — copy to `mcp_servers.json` and fill in real
  values (not committed — see `.gitignore`).
- `example_integration.py` — the wiring sketch. Not runnable as-is; two
  calls are placeholders for jarvis.py's real reasoning entrypoint (whatever
  function today turns a transcribed voice command into a Claude reply).

## Setup

1. `pip install -r requirements.txt` in Jarvis's Python environment.
2. Run `relay-server` somewhere reachable (see `../relay-server/README.md`)
   and grab the **laptop token** it prints.
3. Copy `relay_client.py`, `mcp_client.py`, and your filled-in
   `mcp_servers.json` into the `files` source folder, then to `C:\Jarvis`
   (same two-step deploy as every other Jarvis file).
4. In `jarvis.py`, near your other setup code in `main()`, add:

   ```python
   from relay_client import RelayClient

   def handle_relay_request(kind, payload):
       if kind == "chat":
           return think_and_reply(payload.get("text", ""))  # your real function
       if kind == "daily_plan":
           return think_and_reply("Give me a short, prioritized list of what to do next today.")
       if kind == "efficiency":
           on_laptop = payload.get("onLaptop", False)
           return think_and_reply(
               "I'm at my laptop right now, give specific efficiency suggestions."
               if on_laptop else
               "I'm away from my laptop, tell me what to prioritize next time I sit down."
           )
       return f"Unrecognized request kind: {kind}"

   relay = RelayClient(RELAY_WS_URL, LAPTOP_TOKEN, handle_relay_request)
   relay.start()
   ```

   See `example_integration.py` for a version that also grounds the
   `daily_plan`/`efficiency` replies in real numbers from the tracker MCP
   server via `mcp_client.call_tool("ronan-tracker", "get_totals")`.

5. Store `RELAY_WS_URL` / `LAPTOP_TOKEN` the same way `config.json` already
   stores the Anthropic API key — a gitignored local file, not committed.
6. On the phone app (`jarvis-phone.html`) and home page (`index.html`),
   open Settings and enter the relay's **phone** token (different token,
   same relay).

## What "connect to any MCP" means here

`mcp_client.py` isn't tied to the tracker — `mcp_servers.json` is a list,
so any remote MCP server (another tool, another data source) can be added
the same way and called from `handle_relay_request` or from wherever
jarvis.py's existing Claude tool-use loop lives. The tracker's `mcp-server`
is just the first entry.

## Known limitation

Wake-word listening on the phone (`jarvis-phone.html`) only works while
that page is open and the screen is on — mobile browsers can't run
continuous mic capture in the background the way a native app or Siri can.
Tap-to-talk and text chat both work regardless.
