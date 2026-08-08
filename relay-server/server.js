"use strict";

const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const { TOKENS, isLaptopToken, isPhoneToken, TOKENS_FILE } = require("./lib/tokens");
const { Hub } = require("./lib/hub");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const HOST = process.env.HOST || "0.0.0.0";
const HEARTBEAT_MS = 30000;

const hub = new Hub();
const app = express();
app.use(express.json());

// No auth needed: this only reveals whether Jarvis is reachable, not any
// tracker/vault content, so the phone/home page can show a status dot
// before the user has even opened a websocket.
app.get("/status", (req, res) => res.json(hub.status()));
app.get("/healthz", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch (e) {
    socket.destroy();
    return;
  }
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }
  const role = url.searchParams.get("role");
  const headerToken = (req.headers["authorization"] || "").replace(/^Bearer\s+/i, "");
  const token = url.searchParams.get("token") || headerToken;

  const authed =
    (role === "laptop" && isLaptopToken(token)) || (role === "phone" && isPhoneToken(token));
  if (!authed) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.role = role;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  if (ws.role === "laptop") {
    hub.registerLaptop(ws);
    ws.on("close", () => hub.unregisterLaptop(ws));
    ws.on("message", (raw) => {
      hub.touchLaptop();
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        return;
      }
      if (msg.type === "response" || msg.type === "error") {
        hub.handleLaptopResponse(msg);
      } else if (msg.type === "push") {
        hub.broadcastFromLaptop(msg);
      }
    });
  } else {
    hub.registerPhone(ws);
    ws.on("close", () => hub.unregisterPhone(ws));
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (e) {
        return;
      }
      if (msg.type === "request") {
        hub.handlePhoneRequest(ws, msg);
      }
    });
  }
});

// Drop dead sockets (phone gone to sleep, laptop lost network without a
// clean close) so hub.status() doesn't lie about being online.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

server.listen(PORT, HOST, () => {
  console.log(`Ronan/Jarvis relay listening on http://${HOST}:${PORT} (ws at /ws)`);
  console.log(`Tokens stored at ${TOKENS_FILE}`);
  console.log(`  laptop token: ${TOKENS.laptopToken}`);
  console.log(`  phone token(s): ${TOKENS.phoneTokens.join(", ")}`);
  console.log("Put this host behind HTTPS/WSS (reverse proxy or your host's built-in TLS) before using it off your LAN.");
});

process.on("SIGINT", () => {
  clearInterval(heartbeat);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(heartbeat);
  process.exit(0);
});
