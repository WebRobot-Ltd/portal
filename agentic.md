---
layout: page
title: Agentic Studio
description: Launch curated agentic processes on the WebRobot Ray runtime (multi-crew CrewAI orchestrations, EU-sovereign)
---

<div class="agentic-page-wrapper">

# 🤖 Agentic Studio

Curated **agentic profiles** running on the WebRobot Ray cluster. Each profile is
a declarative multi-crew CrewAI orchestration: tool-using agents wired into a
DAG, executed as a `RayJob` on the EU-sovereign cluster.

::: tip What you can do here
Pick a profile, fill the inputs, hit Run. The page polls the live execution
and shows the structured outputs (and the token bill) when the run terminates.
:::

::: warning Browser-grounded profiles
The browser-grounding path (Camoufox + the browser-use fork that verifies CSS
selectors on the live DOM) is the business differentiator for the agentic
generator. It's currently being **collaudata end-to-end** &mdash; expect the
LLM-only profiles below to be the most stable choice for now.
:::

<AgenticDemo />

</div>

<style scoped>
.agentic-page-wrapper {
  margin: 1.5rem 0;
  padding: 0 2rem 3rem;
  max-width: 1100px;
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
