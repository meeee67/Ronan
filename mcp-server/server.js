"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { createMcpExpressApp } = require("@modelcontextprotocol/sdk/server/express.js");

const { registerTools } = require("./lib/tools");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST || "0.0.0.0";

// This server is meant to be reachable remotely (your phone/laptop and your
// AI assistant may not be on the same machine), so unlike a local stdio MCP
// server it needs its own auth — a bearer token, not an API key baked into
// any client-side code. Reuse one across restarts via data/.mcp-token so you
// don't have to re-share it every deploy.
const TOKEN_FILE = path.join(__dirname, "data", ".mcp-token");

function getOrCreateToken() {
  if (process.env.MCP_AUTH_TOKEN) return process.env.MCP_AUTH_TOKEN;
  try {
    return fs.readFileSync(TOKEN_FILE, "utf8").trim();
  } catch (e) {
    const token = crypto.randomBytes(24).toString("hex");
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, token);
    return token;
  }
}

const AUTH_TOKEN = getOrCreateToken();

function getServer() {
  const server = new McpServer({ name: "ronan-tracker", version: "1.0.0" });
  registerTools(server);
  return server;
}

const app = createMcpExpressApp({ host: HOST });

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const providedBuf = Buffer.from(provided);
  const tokenBuf = Buffer.from(AUTH_TOKEN);
  const authorized = providedBuf.length === tokenBuf.length && crypto.timingSafeEqual(providedBuf, tokenBuf);
  if (!authorized) {
    res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
    return;
  }
  next();
}

app.post("/mcp", requireAuth, async (req, res) => {
  const server = getServer();
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

app.get("/mcp", requireAuth, (req, res) => {
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

app.delete("/mcp", requireAuth, (req, res) => {
  res.writeHead(405).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
});

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.listen(PORT, HOST, () => {
  console.log(`Ronan Tracker MCP server listening on http://${HOST}:${PORT}/mcp`);
  if (!process.env.MCP_AUTH_TOKEN) {
    console.log(`Auth token (saved to data/.mcp-token): ${AUTH_TOKEN}`);
  }
  console.log("Point your MCP client at this URL with header: Authorization: Bearer <token>");
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
