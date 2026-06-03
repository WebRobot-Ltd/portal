---
layout: doc
title: MCP Endpoint
description: The official WebRobot Model Context Protocol (MCP) server — connect any MCP client to WebRobot's ETL tools.
---

# 🔌 WebRobot MCP Endpoint

WebRobot exposes an official **Model Context Protocol (MCP)** server, so any
MCP-compatible client or agent (Claude Code, the Claude Agent SDK, Cursor,
Claude Desktop, …) can drive the WebRobot ETL platform with tools.

| | |
|---|---|
| **Endpoint** | `https://mcp.webrobot.eu/mcp` |
| **Transport** | Streamable HTTP |
| **Server** | `WebRobot Demo` |
| **Scope** | `demo` (wraps the public Demo API at `api.webrobot.eu`) |
| **Tools** | 33 |

> The MCP server mirrors the WebRobot Demo REST API as MCP tools — browse the
> stage catalog, generate/validate/execute ETL pipelines, run the inference
> wizard, and manage executions, all from your agent.

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

## Tools

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
The MCP endpoint runs in the `demo` scope. Tools and surface are evolving;
behavior is not guaranteed for production use yet.
:::
