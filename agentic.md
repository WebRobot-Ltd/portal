---
layout: page
title: Agentic Studio
description: Browse, edit and execute agentic profiles (multi-crew CrewAI orchestrations) backed by the WebRobot Ray runtime
---

<div class="agentic-page-wrapper">

# 🤖 Agentic Studio

Browse, edit and execute **agentic profiles** — declarative multi-crew CrewAI
orchestrations that compose tool-using agents into DAGs. Each profile is a single
YAML that describes:

- **Tools** an agent can call (Jersey REST, Camoufox browser, MCP servers, RAG)
- **Crews** of agents working together (sequential / hierarchical / delegation)
- **Inter-crew orchestration** (the DAG that wires crew outputs into the next crew's inputs)
- **Runtime budgets** (per-crew CPU/RAM, timeouts, token caps)

Profiles execute on the WebRobot Ray cluster as `RayJob` CRDs. Each crew is a Ray
`@remote` actor; tools are long-lived Ray named actors. The runner serialises a
profile YAML into a DAG of actor invocations, streams progress, and posts back
to a Jersey completion webhook on terminal status.

::: tip For builders
The **`webrobot-etl-builder`** profile (ships out-of-the-box) is the canonical
example: it turns a natural-language scraping goal into a WebRobot ETL pipeline
manifest YAML, then validates it via the Jersey Manifest API. Clone it to start
from a working two-crew DAG.
:::

::: warning Browser grounding
The **`selector-grounding`** profile (the Camoufox + browser-use fork path,
verifies CSS selectors against the live DOM) is the business differentiator
for the agentic generator. It's currently being **collaudata end-to-end** —
expect the LLM-only `webrobot-etl-builder` to be the most stable path today.
:::

<AgenticStudio />

</div>

<style scoped>
.agentic-page-wrapper {
  margin: 1.5rem 0;
  padding: 0 2rem 3rem;
  max-width: 1400px;
  margin-left: auto;
  margin-right: auto;
}
.agentic-page-wrapper h1 {
  margin-top: 0;
  margin-bottom: 1rem;
}
.agentic-page-wrapper > p {
  margin-bottom: 1rem;
  line-height: 1.65;
}
</style>
