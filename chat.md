---
layout: page
title: AI Data Engineer (beta)
description: Experimental agentic chat — Claude Agent SDK runtime wired to the WebRobot MCP
---

<div class="demo-page-wrapper">

# 🤖 AI Data Engineer — Chat <Badge type="warning" text="beta / in development" />

Experimental chat with a "data engineer" agent on the **Claude Agent SDK**
runtime, connected live to the **WebRobot MCP**. It can browse the stage
catalog and draft & validate ETL pipelines. This is a **work in progress**:
results are experimental and not guaranteed.

For **auto-setting up scraping** the agent drives a real browser through our
**Camoufox MCP endpoint** (a Camoufox / Playwright Firefox session it can
navigate, observe and extract from). A **fork of `browser-use`** for fully
autonomous, goal-driven browsing is coming next.

<AgentChat />

</div>
