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

<style>
/* Constrain + margin the whole chat page (layout: page is otherwise full-bleed). */
.demo-page-wrapper { max-width: 860px; margin: 0 auto; padding: 24px 18px 40px; box-sizing: border-box; }
/* AgentChat supplies its own width/padding standalone — let the wrapper own it here. */
.demo-page-wrapper .agent-chat { max-width: none; padding: 0; }
@media (max-width: 640px) { .demo-page-wrapper { padding: 16px 12px 28px; } }
</style>
