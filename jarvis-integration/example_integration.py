"""Sketch of how to wire relay_client.py + mcp_client.py into jarvis.py.

This file is NOT meant to be run as-is — jarvis.py's actual reasoning
entrypoint isn't in this repo (it lives in your local `files` folder /
C:\\Jarvis), so the two calls marked below are placeholders. Copy the
pattern into jarvis.py itself, swapping in your real function names.
"""

from __future__ import annotations

import logging

import mcp_client
from relay_client import RelayClient

log = logging.getLogger("jarvis_relay_integration")

# --- Replace with jarvis.py's real entrypoint ---------------------------
# The function that already turns a transcribed voice command into a
# Claude reply (wake-word -> Whisper -> this function -> TTS). Reuse it
# verbatim for "chat" so the phone gets the exact same Jarvis, not a
# second, differently-grounded copy of it.
#
#   from jarvis import think_and_reply
# --------------------------------------------------------------------------


def _tracker_summary() -> str:
    """Pulls today's numbers straight from the tracker MCP server so the
    daily-plan/efficiency prompts are grounded even if jarvis.py's own
    tool-use loop doesn't already have that server registered as a tool.
    Requires mcp_servers.json to have a "ronan-tracker" entry."""
    try:
        totals = mcp_client.call_tool("ronan-tracker", "get_totals")
        return f"Today's tracker totals: {totals}"
    except Exception as e:  # noqa: BLE001 — grounding is best-effort
        log.warning("Couldn't reach tracker MCP server: %s", e)
        return "(tracker data unavailable right now)"


def handle_relay_request(kind: str, payload: dict) -> str:
    if kind == "chat":
        text = payload.get("text", "")
        return think_and_reply(text)  # noqa: F821 — see placeholder note above

    if kind == "daily_plan":
        prompt = (
            "Give me a short, prioritized list of what I should do next today. "
            f"{_tracker_summary()}\n"
            "Use what you know about my routines and standards to prioritize, "
            "not just a recap of the numbers."
        )
        return think_and_reply(prompt)  # noqa: F821

    if kind == "efficiency":
        on_laptop = bool(payload.get("onLaptop"))
        if on_laptop:
            prompt = (
                "I'm at my laptop right now. "
                f"{_tracker_summary()}\n"
                "Give concrete, specific suggestions for the most efficient use of "
                "the next block of time — reference the actual numbers, not generic advice."
            )
        else:
            prompt = (
                "I'm away from my laptop right now. "
                f"{_tracker_summary()}\n"
                "Tell me what to prioritize the next time I sit down, so I don't "
                "waste the first few minutes deciding."
            )
        return think_and_reply(prompt)  # noqa: F821

    return f"Unrecognized request kind: {kind}"


def start_relay(relay_ws_url: str, laptop_token: str) -> RelayClient:
    client = RelayClient(relay_ws_url, laptop_token, handle_relay_request)
    client.start()
    return client


# In jarvis.py's main(), after existing setup:
#
#   from relay_client import RelayClient
#   from example_integration import handle_relay_request  # or inline it
#   relay = RelayClient(cfg["relay"]["ws_url"], cfg["relay"]["laptop_token"], handle_relay_request)
#   relay.start()
#   ...
#   relay.push("Reminder: your 3pm call is in 10 minutes.")  # optional proactive nudge
