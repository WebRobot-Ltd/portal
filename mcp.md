---
layout: doc
title: MCP Endpoint
description: The official WebRobot Model Context Protocol (MCP) server — connect any MCP client to WebRobot's ETL tools.
---

# 🔌 WebRobot MCP Endpoint

WebRobot exposes an official **Model Context Protocol (MCP)** server, so any
MCP-compatible client or agent (Claude Code, the Claude Agent SDK, Cursor,
Claude Desktop, …) can drive the WebRobot ETL platform with tools.

There are **two endpoints** — pick by what you need:

| | 🟢 Demo (public) | 🔐 Full (authenticated) |
|---|---|---|
| **Endpoint** | `https://mcp.webrobot.eu/mcp` | `https://mcp-full.webrobot.eu/mcp` |
| **Transport** | Streamable HTTP | Streamable HTTP |
| **Auth** | none — public | **your own** WebRobot API key or platform OAuth token |
| **Scope** | `demo` — only `/webrobot/api/demo/*` | `full` — the **entire** WebRobot REST API (240+ operations) |
| **Surface** | stage catalog, generate/validate/execute demo pipelines, designer wizard | everything: datasets, projects, agents, jobs, manifests, RAG, billing, plugins, cloud credentials, … |
| **Data** | shared demo sandbox | **your org's** real data, isolated by RBAC |
| **Best for** | trying WebRobot, public demos, no signup | production agents, your own pipelines & data |

> **How the Full endpoint stays safe.** It is a **pure proxy**: it holds **no
> API key of its own**. Each request forwards *your* credential
> (`Authorization: Bearer <token>` or `X-API-Key`) to the WebRobot REST API,
> which performs all authentication and **per-organization RBAC** — exactly as
> if you called the API directly. The MCP never sees more than your key allows.

> The Demo server mirrors the public Demo REST API as MCP tools — browse the
> stage catalog, generate/validate/execute ETL pipelines, run the inference
> wizard, and manage executions, all from your agent, with no signup.

## Connect

### Claude Code (CLI)
```bash
claude mcp add --transport http webrobot https://mcp.webrobot.eu/mcp
```

### Claude Desktop / Cursor / `.mcp.json`
```json
{
  "mcpServers": {
    "webrobot": { "type": "http", "url": "https://mcp.webrobot.eu/mcp" }
  }
}
```

### Claude Agent SDK (Python)
```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    mcp_servers={"webrobot": {"type": "http", "url": "https://mcp.webrobot.eu/mcp"}},
    allowed_tools=["mcp__webrobot"],   # allow every WebRobot tool
)
```

## Connect — Full (authenticated)

Use `https://mcp-full.webrobot.eu/mcp` and send **your own** credential as a
header. The MCP forwards it to the REST API per request (it stores nothing).

### `.mcp.json` (Claude Code / Cursor / Desktop)
```json
{
  "mcpServers": {
    "webrobot-full": {
      "type": "http",
      "url": "https://mcp-full.webrobot.eu/mcp",
      "headers": { "X-API-Key": "<key_id>:<secret>" }
    }
  }
}
```

### Claude Code (CLI)
```bash
claude mcp add --transport http webrobot-full https://mcp-full.webrobot.eu/mcp \
  --header "X-API-Key: <key_id>:<secret>"
```

### Claude Agent SDK (Python)
```python
options = ClaudeAgentOptions(
    mcp_servers={"webrobot-full": {
        "type": "http",
        "url": "https://mcp-full.webrobot.eu/mcp",
        "headers": {"X-API-Key": "<key_id>:<secret>"},   # or "Authorization": "Bearer <jwt>"
    }},
    allowed_tools=["mcp__webrobot-full"],
)
```

> Get your API key from the WebRobot portal (Settings → API Keys). Platform
> OAuth tokens work too — send them as `Authorization: Bearer <token>`. Your
> key's role/organization scopes determine exactly which tools succeed.

## Tools

The list below is the **Demo** surface. The **Full** endpoint auto-exposes the
entire WebRobot REST API as tools (datasets, projects, agents, jobs, `manifestApply`
/ `manifestValidate`, RAG query/ingest, cloud credentials, billing, plugins, …) —
gated by your key's scopes.

**Catalog & pipelines**
`getCatalogStages` · `suggestStages` · `generatePipeline` · `saveGeneratedPipeline`
· `generatePythonTransform` · `validatePythonTransform` · `securityCheckPythonTransform`
· `uploadDataset` · `listDemos` · `reloadPipelines` · `getPluginInfo`

**Execution**
`executeDemo` · `getExecutionStatus` · `getExecutionLogs` · `getExecutionOutput`
· `cancelExecution`

**Designer wizard (selectors / inference)**
`wizardInferSelector` · `wizardInferFields` · `wizardInferSegment` · `wizardInferActions`
· `wizardSuggestFieldNames` · `wizardValidate` · `wizardProxy` · `cmfOpen` · `cmfStep` · `cmfClose`

**Agentic / BYOC**
`runDemo` · `listDemos_1` · `executionDetail` · `validateHetznerToken` · `cleanupStaleByocSecrets`

**Demo app serving**
`serveDemoApp` · `serveStaticFile`

## Try it

Once connected, ask your agent:

> *“Using the webrobot tools, list the available ETL stages and summarize five of them.”*

Or use the hosted [AI Data Engineer chat](/chat) — it is already wired to this MCP endpoint.

::: warning Beta
Both MCP endpoints are evolving — tools and surface may change, and behavior is
not yet guaranteed for production use. The **Demo** endpoint (`demo` scope) is
public and sandboxed; the **Full** endpoint (`full` scope) acts on your real
data under your own credential, so treat its write tools (datasets, jobs,
manifests, billing, plugins) with care.
:::
