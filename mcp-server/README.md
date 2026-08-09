# Ronan Tracker MCP Server

A remote MCP (Model Context Protocol) server that exposes the tracker's data
model — categories, live timer, sessions, calls, income — as tools an AI
assistant can call: `get_state`, `get_totals`, `start_timer`, `log_income`,
`edit_session`, and so on. This is the Phase 2 hook the app was built
against (`tracker.html` keeps state access behind `getState`/`mutate`/
`totalsFor` for exactly this reason).

## Important: this is a separate data store from `tracker.html`

`tracker.html` is a static file that reads/writes the browser's
`localStorage` — it has no server and can't be reached from outside the
browser. This MCP server keeps its **own** JSON file
(`data/tracker-state.json`), independent of whatever's in your phone's
browser storage. They don't sync automatically.

To bring data from one into the other: use tracker.html's **Export JSON**
button, then either hand that file to your AI assistant to log via the MCP
tools, or drop it in as `mcp-server/data/tracker-state.json` (same shape) and
restart the server. Same in reverse via `get_state`.

## Run it

```bash
cd mcp-server
npm install
npm start
```

On first run it seeds the same default categories as the app (PeakFlow,
Ranch, Build, Admin) and prints an auth token — save it, you'll need it to
connect. The token is also persisted to `data/.mcp-token` so it survives
restarts. Set `MCP_AUTH_TOKEN` yourself to pin it instead.

By default it listens on `0.0.0.0:3000`. Set `PORT`/`HOST` env vars to
change that. If you deploy this somewhere reachable from the internet, put
it behind HTTPS (a reverse proxy like Caddy/nginx, or your host's built-in
TLS) — the bearer token is meaningless over plain HTTP.

## Connect a client

The endpoint is `POST /mcp`, using the Streamable HTTP transport, with:

```
Authorization: Bearer <your token>
```

For Claude Desktop / Claude Code, add it as a remote MCP server pointing at
`https://your-host:3000/mcp` with that header. No API key for any LLM lives
in this server or in `tracker.html` — this only stores your tracker data and
your own access token.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_state` | Full raw state dump |
| `get_totals` | Revenue %, minutes, calls, income for a day (default today) + 7-day rolling % |
| `get_history` | Merged reverse-chronological log for a day |
| `list_categories` / `add_category` / `update_category` / `delete_category` | Category CRUD (refuses to delete the last one; requires `cascade: true` to delete one with sessions attached) |
| `start_timer` / `stop_timer` | Mirrors the app's one-timer-at-a-time rule; discards sessions under 30s |
| `log_session` / `edit_session` / `delete_session` | Quick-add and edit completed blocks |
| `log_call` / `edit_call` / `delete_call` | Call records |
| `log_income` / `edit_income` / `delete_income` | Income records — arbitrary amount/precision, stored exactly |
| `get_all_time_income` | All-time income total |

## Data model

Same shape as `tracker:v1` in the browser app:

```
{
  categories: [{ id, name, revenue, order }],
  running:    { catId, startedAt } | null,
  sessions:   [{ id, catId, start, minutes, note }],
  calls:      [{ id, ts, note }],
  income:     [{ id, ts, amount, note }]
}
```
