"""Generic remote-MCP tool caller for jarvis.py.

This is the "connect to any MCP" piece: a small config-driven client so
Jarvis can call tools on any remote MCP server over Streamable HTTP —
starting with the tracker's own mcp-server (../mcp-server), but not limited
to it. Add more entries to mcp_servers.json and Jarvis can reach for them
the same way.

Kept synchronous (wraps asyncio.run) since jarvis.py's existing tool-call
loop is presumably synchronous — call these the same way as any other
whitelisted tool function.
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

CONFIG_PATH = Path(__file__).with_name("mcp_servers.json")


@dataclass
class McpServerConfig:
    name: str
    url: str
    token: str


def load_servers() -> dict[str, McpServerConfig]:
    """Reads mcp_servers.json (see mcp_servers.example.json for the shape).
    Missing file -> no servers configured, callers should handle that."""
    if not CONFIG_PATH.exists():
        return {}
    raw = json.loads(CONFIG_PATH.read_text())
    servers = {}
    for entry in raw.get("servers", []):
        servers[entry["name"]] = McpServerConfig(entry["name"], entry["url"], entry["token"])
    return servers


async def _call_tool_async(cfg: McpServerConfig, tool_name: str, arguments: Optional[dict] = None) -> Any:
    headers = {"Authorization": f"Bearer {cfg.token}"}
    async with streamablehttp_client(cfg.url, headers=headers) as (read, write, _get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments or {})
            texts = [block.text for block in result.content if getattr(block, "type", None) == "text"]
            return "\n".join(texts) if texts else result


async def _list_tools_async(cfg: McpServerConfig) -> list[str]:
    headers = {"Authorization": f"Bearer {cfg.token}"}
    async with streamablehttp_client(cfg.url, headers=headers) as (read, write, _get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            return [t.name for t in tools.tools]


def call_tool(server_name: str, tool_name: str, arguments: Optional[dict] = None) -> Any:
    """e.g. call_tool("ronan-tracker", "get_totals", {"date": "2026-08-08"})"""
    servers = load_servers()
    if server_name not in servers:
        raise KeyError(f"No MCP server named {server_name!r} in {CONFIG_PATH.name}")
    return asyncio.run(_call_tool_async(servers[server_name], tool_name, arguments))


def list_tools(server_name: str) -> list[str]:
    servers = load_servers()
    if server_name not in servers:
        raise KeyError(f"No MCP server named {server_name!r} in {CONFIG_PATH.name}")
    return asyncio.run(_list_tools_async(servers[server_name]))
