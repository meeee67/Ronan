"use strict";

const crypto = require("crypto");

const REQUEST_TIMEOUT_MS = 30000;

// In-memory message relay between exactly one "laptop" connection (Jarvis,
// dialing out from home) and any number of "phone" connections (the phone
// app / home page, dialing in from wherever). Nothing here is persisted —
// if the process restarts, both sides just reconnect.
class Hub {
  constructor() {
    this.laptopSocket = null;
    this.laptopLastSeen = null;
    this.phoneSockets = new Set();
    this.pending = new Map(); // requestId -> { phoneSocket, timer }
  }

  isOnline() {
    return this.laptopSocket !== null;
  }

  status() {
    return {
      online: this.isOnline(),
      lastSeen: this.laptopLastSeen ? new Date(this.laptopLastSeen).toISOString() : null,
      phonesConnected: this.phoneSockets.size
    };
  }

  registerLaptop(ws) {
    if (this.laptopSocket && this.laptopSocket !== ws) {
      try {
        this.laptopSocket.close(4001, "Replaced by new laptop connection");
      } catch (e) {
        // already dead, ignore
      }
    }
    this.laptopSocket = ws;
    this.laptopLastSeen = Date.now();
  }

  unregisterLaptop(ws) {
    if (this.laptopSocket === ws) {
      this.laptopSocket = null;
      // Anything still waiting on a reply will never get one now.
      for (const [id, entry] of this.pending) {
        this._replyToPhone(entry.phoneSocket, { type: "error", id, message: "Jarvis disconnected before replying." });
        clearTimeout(entry.timer);
        this.pending.delete(id);
      }
    }
  }

  registerPhone(ws) {
    this.phoneSockets.add(ws);
  }

  unregisterPhone(ws) {
    this.phoneSockets.delete(ws);
    for (const [id, entry] of this.pending) {
      if (entry.phoneSocket === ws) {
        clearTimeout(entry.timer);
        this.pending.delete(id);
      }
    }
  }

  // Called on every inbound laptop message (including plain pings) so
  // /status reflects real liveness, not just socket-open state.
  touchLaptop() {
    this.laptopLastSeen = Date.now();
  }

  _replyToPhone(phoneSocket, message) {
    if (phoneSocket && phoneSocket.readyState === phoneSocket.OPEN) {
      phoneSocket.send(JSON.stringify(message));
    }
  }

  // A phone/home client asking Jarvis something: { kind, payload }.
  // Returns nothing directly — the reply (or error) is sent async over ws.
  handlePhoneRequest(phoneSocket, msg) {
    const id = msg.id || crypto.randomUUID();
    if (!this.isOnline()) {
      this._replyToPhone(phoneSocket, { type: "error", id, message: "Jarvis is offline (laptop not connected to the relay)." });
      return;
    }
    const timer = setTimeout(() => {
      this.pending.delete(id);
      this._replyToPhone(phoneSocket, { type: "error", id, message: "Jarvis didn't reply in time." });
    }, REQUEST_TIMEOUT_MS);
    this.pending.set(id, { phoneSocket, timer });
    this.laptopSocket.send(
      JSON.stringify({ type: "request", id, kind: msg.kind, payload: msg.payload || {} })
    );
  }

  // Jarvis replying to a previously relayed request: { id, payload } or { id, message } for errors.
  handleLaptopResponse(msg) {
    const entry = this.pending.get(msg.id);
    if (!entry) return; // late reply after timeout, or unknown id — drop it
    clearTimeout(entry.timer);
    this.pending.delete(msg.id);
    this._replyToPhone(entry.phoneSocket, msg);
  }

  // Jarvis pushing a message with no matching phone request (e.g. a proactive
  // nudge). Broadcast to all connected phone/home clients.
  broadcastFromLaptop(msg) {
    const payload = JSON.stringify(msg);
    for (const ws of this.phoneSockets) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}

module.exports = { Hub, REQUEST_TIMEOUT_MS };
