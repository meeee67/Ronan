"""Outbound relay connection for jarvis.py.

Connects OUT to the relay-server (see ../relay-server) as the "laptop" role
and stays connected, so nothing needs to be exposed or port-forwarded on the
home network. Requests relayed from the phone/home page arrive here as
(kind, payload) and whatever the handler returns is relayed back.

Drop this file next to jarvis.py (source folder first, then C:\\Jarvis per
the usual deploy step) and wire it up as shown in example_integration.py.
"""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import Callable, Optional

import websockets

log = logging.getLogger("relay_client")

# (kind: str, payload: dict) -> str
Handler = Callable[[str, dict], str]


class RelayClient:
    def __init__(self, relay_ws_url: str, laptop_token: str, handler: Handler):
        """
        relay_ws_url: e.g. "wss://your-relay-host/ws" (no query string —
            role/token are appended here).
        laptop_token: the laptop-only token from relay-server's data/tokens.json.
        handler: called for every relayed request; return the reply text.
            Exceptions are caught and sent back as an error response so one
            bad request can't kill the connection.
        """
        self._url = self._with_auth(relay_ws_url, laptop_token)
        self._handler = handler
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._ws = None
        self._stop = threading.Event()

    @staticmethod
    def _with_auth(base_url: str, token: str) -> str:
        sep = "&" if "?" in base_url else "?"
        return f"{base_url}{sep}role=laptop&token={token}"

    def start(self) -> None:
        """Starts the connection in a background thread. Non-blocking."""
        self._thread = threading.Thread(target=self._run, name="relay-client", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._loop and self._ws:
            asyncio.run_coroutine_threadsafe(self._ws.close(), self._loop)

    def push(self, text: str) -> None:
        """Send a proactive message to every connected phone/home client
        (e.g. a scheduled check-in nudge), not tied to any request."""
        if not self._loop or not self._ws:
            log.warning("push() called while relay not connected; dropped: %s", text)
            return
        msg = json.dumps({"type": "push", "payload": {"text": text}})
        asyncio.run_coroutine_threadsafe(self._ws.send(msg), self._loop)

    def _run(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._connect_forever())

    async def _connect_forever(self) -> None:
        delay = 1
        while not self._stop.is_set():
            try:
                async with websockets.connect(self._url, ping_interval=20, ping_timeout=20) as ws:
                    self._ws = ws
                    log.info("Connected to relay.")
                    delay = 1
                    async for raw in ws:
                        await self._handle_message(ws, raw)
            except (websockets.exceptions.WebSocketException, OSError) as e:
                log.warning("Relay connection lost (%s); retrying in %ss", e, delay)
            finally:
                self._ws = None
            if self._stop.is_set():
                break
            time.sleep(delay)
            delay = min(delay * 2, 30)

    async def _handle_message(self, ws, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except ValueError:
            return
        if msg.get("type") != "request":
            return
        req_id = msg.get("id")
        kind = msg.get("kind", "chat")
        payload = msg.get("payload", {})
        try:
            reply_text = self._handler(kind, payload)
            await ws.send(json.dumps({"type": "response", "id": req_id, "payload": {"text": reply_text}}))
        except Exception as e:  # noqa: BLE001 — a bad handler run must not kill the socket
            log.exception("Handler failed for kind=%s", kind)
            await ws.send(json.dumps({"type": "error", "id": req_id, "message": str(e)}))
