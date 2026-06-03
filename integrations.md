---
layout: doc
title: Integrations — Claude Code plugin, skills, MCP, OpenCrawl
description: Drop WebRobot into your agent — Claude Code plugin & skills, the MCP endpoint, Cursor, and OpenCrawl (coming soon).
---

# 🧩 Integrations

Bring the WebRobot ETL platform into your agent / IDE. Same backend, different
front doors.

## Claude Code — plugin & skills

The **WebRobot plugin** ships **10 skills** (invokable as `/` slash commands) plus
an on-demand **MCP server**. Install it in Claude Code:

```
/plugin marketplace add https://github.com/WebRobot-Ltd/webrobot-claude-plugin
/plugin install webrobot
```

Claude Code picks up the skills under `/` and starts the MCP server on demand
(via the `mcpServers.webrobot` entry in `plugin.json`). The server is a single
Python process — `mcp-server/server.py` — with one dependency (`mcp>=1.0.0`):

```bash
pip install -r mcp-server/requirements.txt   # only if python3/mcp aren't present
```

**Skills**
`webrobot-overview` · `webrobot-pipeline` · `webrobot-cli` · `webrobot-admin`
· `webrobot-plugin-dev` · `webrobot-frontend-plugin-dev` · `webrobot-python-extension`
· `webrobot-sdk-python` · `webrobot-sdk-java` · `webrobot-sdk-nodejs`

**Credentials** — the plugin reads, in order: env (`WEBROBOT_API_KEY` / `WEBROBOT_JWT`),
then `~/.claude/plugins/webrobot/config.json`. Default base URL: `https://api.webrobot.eu`.

**Repo:** [github.com/WebRobot-Ltd/webrobot-claude-plugin](https://github.com/WebRobot-Ltd/webrobot-claude-plugin)
(`.claude-plugin/plugin.json` + `skills/` + `mcp-server/`).

## MCP — any MCP client

The same tools are exposed over the **Model Context Protocol** at
`https://mcp.webrobot.eu/mcp` (33 tools). Works with Claude Code, Claude Desktop,
**Cursor**, the Claude Agent SDK, and any MCP-compatible client. See the
[**MCP Endpoint**](/mcp) page for connect snippets.

## Cursor

Add WebRobot as an MCP server in Cursor's `mcp.json`:
```json
{ "mcpServers": { "webrobot": { "type": "http", "url": "https://mcp.webrobot.eu/mcp" } } }
```

## OpenCrawl <Badge type="warning" text="coming soon" />

A WebRobot skill for **OpenCrawl** is in preparation and will be published on
the OpenCrawl marketplace. It will expose the same pipeline-build / catalog /
execution capabilities as the Claude Code skills. Stay tuned.

---

::: tip Hosted chat
Prefer not to install anything? Try the hosted [AI Data Engineer chat](/chat) —
already wired to the WebRobot MCP.
:::
