# Agent Execution Patterns

The WebRobot platform has two distinct ways to **concretize** an agent — to turn a description into a real running process with allocated resources and produced output:

- **Spark** for batch data pipelines (the historical path)
- **Ray + agentic runtime** for LLM-driven multi-step flows (the new path)

These two executors compose in four practical patterns. Picking the right one for your use case is an architectural decision, not a technology constraint. This page describes each pattern, when to use it, and how to express it through the API.

## What "concretize" means here

A WebRobot `agent` row is, by itself, just a description. It only becomes a running thing when something provisions a job out of it:

| Field on `agents` | Provisioned by | Becomes |
| --- | --- | --- |
| `pipeline_yaml` | `SparkApplicationOperator` | Spark driver + N executor pods |
| `agentic_profile_id` → `agentic_profiles.spec` | `KubeRay operator` | `RayJob` + N actors in the cluster |

The two columns are independent. An agent can have one, the other, both, or neither. The four patterns below cover the meaningful combinations.

## The four patterns

### Pattern 1 — Spark only

The classical ETL agent. The pipeline YAML fully describes the transformation; no LLM at runtime.

```yaml
# agent row in the DB
pipeline_yaml: |
  fetch: { url: "https://books.toscrape.com/" }
  pipeline:
    - stage: wget
      args: ["${INPUT_URL}"]
    - stage: wgetExplore
      args: ["article.product_pod h3 a", 1, 10]
    - stage: extract
      args:
        - { selector: ".product_main h1", method: "text", as: "title" }
        - { selector: ".price_color",      method: "text", as: "price" }
  output:
    format: parquet
    path: "${OUTPUT_PARQUET_PATH}"
agentic_profile_id: null
```

**Execution**:

```bash
POST /webrobot/api/projects/{projectId}/jobs/{jobId}/execute
```

This is the existing Spark execution path. Use it when:

- the scraping logic is stable (selectors known)
- the workload is bulk / batch (1000s of pages per run)
- output is a dataset, not a decision

### Pattern 2 — Agentic only

The new path. The agentic profile describes a multi-crew DAG; the Ray runtime executes it and returns a structured result.

```yaml
# agent row in the DB
pipeline_yaml: null
agentic_profile_id: 17    # → references agentic_profiles row

# agentic_profiles[17].spec (excerpt)
profile: selector-grounding
crews:
  - id: grounder
    process: sequential
    agents:
      - id: selector_grounder
        role: "CSS Selector Grounder"
        tools: [browser, jersey]
    tasks:
      - id: ground
        description: "Visit seed_url, return verified selectors per field"
```

**Execution**:

```bash
POST /webrobot/api/agents/{agentId}/execute
{
  "inputs": {
    "goal": "Extract title and price from books.toscrape",
    "seed_url": "https://books.toscrape.com/",
    "fields": [...]
  }
}
```

The Ray actor DAG runs and returns a dict — typically a structured result the caller consumes directly. **No Spark involved.** Use it when:

- the work is decision-based (which selector? which intent?)
- output is a result or a recommendation, not a dataset
- the run is short (seconds to a few minutes)
- examples: selector grounding, intent classification, RAG-backed Q&A, browser actions

### Pattern 3 — Agentic drafts, Spark concretizes

A two-step flow where the agentic side produces a pipeline YAML as its output, and the user (or a downstream job) submits that YAML to Spark in a separate execution.

```yaml
# starting state — agent has only an agentic profile that emits Spark YAML
agent.pipeline_yaml: null
agent.agentic_profile_id: <profile id of "pipeline-generator">

# the profile's DAG ends with an assembler crew producing a pipeline:
crews:
  - id: assembler
    agents: [yaml_writer]
    tasks:
      - id: assemble
        expected_output: "valid pipeline YAML, no prose"
```

**Two executions, sequenced by the user**:

```bash
# step 1 — generate the YAML
POST /webrobot/api/agents/{agentId}/execute
{ "inputs": {"goal": "scrape arxiv cs.AI listings"} }
# → result.pipeline_yaml = "fetch: ...\npipeline: ..."

# step 2 — persist the generated YAML onto the agent
PUT /webrobot/api/agents/{agentId}
{ "pipeline_yaml": "<the YAML from step 1>" }

# step 3 — run as Spark
POST /webrobot/api/projects/{pid}/jobs/{jid}/execute
```

Use it when:

- you want LLM-assisted scaffolding for a Spark pipeline
- the generated YAML is the artifact, reusable across runs
- the Spark execution will happen many times (batch, scheduled) — the agentic cost is paid once at generation time, not per run

This is what the demo `POST /webrobot/api/demo/generate-pipeline` flow does today (see [Demo API](./demo-api)).

### Pattern 4 — Agentic orchestrates Spark from inside

The agentic flow itself decides when to invoke Spark, treating Spark as one of its tools. The orchestration is dynamic — Spark may run zero, one, or many times depending on the LLM's decisions inside the loop.

```yaml
# agent row
agent.pipeline_yaml: null
agent.agentic_profile_id: <X>

# profile spec — note jersey_tool_actor exposes Manifest + Job APIs
tools:
  - id: jersey
    backend_actor: jersey_tool_actor
    endpoints:
      apply_manifest: "POST /webrobot/api/manifest/apply"
      execute_job:    "POST /webrobot/api/projects/{pid}/jobs/{jid}/execute"
      job_status:     "GET  /webrobot/api/projects/{pid}/jobs/{jid}/executions/{eid}/status"

crews:
  - id: analyst
    agents:
      - id: investigator
        role: "Data investigator"
        tools: [rag, jersey]
        # this agent will decide WITHIN the loop whether to fire Spark
```

**Single execution, dynamic Spark involvement**:

```bash
POST /webrobot/api/agents/{agentId}/execute
{
  "inputs": {
    "goal": "Track sentiment for company X. If recent drop > 20%, do a full news scrape."
  }
}
```

What happens inside:

1. RayJob spawns, CrewActor takes the goal
2. `investigator` queries RAG → finds historical sentiment
3. LLM decides: "drop is 25%, scrape needed"
4. `investigator` calls `jersey_tool_actor.apply_manifest(<news-scrape pipeline>)`
5. `investigator` calls `jersey_tool_actor.execute_job(...)` → Spark runs
6. `investigator` polls `jersey_tool_actor.job_status(...)` until done
7. Result: combined sentiment + scraped news, returned as the agent's output

Use it when:

- the decision to invoke Spark is data-dependent (can only be made at runtime)
- one user goal may trigger zero, one, or many Spark runs
- the agentic flow's *job* is the orchestration, not the data work

## How `POST /agents/{id}/execute` dispatches

The unified entry point inspects what the agent has configured and routes accordingly:

```
POST /webrobot/api/agents/{id}/execute
  │
  ├─ agent.agentic_profile_id is set?
  │    └─ YES → build StartRequest, submit RayJob
  │            (the profile decides if/when Spark is touched internally)
  │
  └─ NO → return 400 "no executor configured"
          with a hint pointing to the Spark path
          (POST /projects/{pid}/jobs/{jid}/execute)
```

Pattern 1 stays on its existing project-job-scoped Spark endpoint. Patterns 2-4 all flow through `/agents/{id}/execute`. The current dispatcher folds Spark in only via the project/job path; folding it directly under `/agents/{id}/execute` (so the same URL serves all four patterns) is a planned cleanup but not in place yet.

## Choosing the pattern

| Question | Suggests |
| --- | --- |
| Selectors stable, batch scheduled? | Pattern 1 (Spark) |
| LLM has to decide, output is a result not a dataset? | Pattern 2 (agentic only) |
| LLM produces something to run many times later? | Pattern 3 (agentic drafts, Spark concretizes) |
| LLM decides on-the-fly whether to run heavy data work? | Pattern 4 (agentic orchestrates Spark) |

If you genuinely can't tell which fits, start with Pattern 2 — it's the cheapest to iterate and the result will tell you whether you need Spark for scale (move to 3) or dynamic invocation (move to 4).

## What about a `kind` field?

We considered adding `agent.kind` as an enum (`spark` / `agentic` / `agentic_drafts_spark` / `agentic_orchestrates`) to make the pattern explicit at the schema level. We chose **not** to today:

- The patterns are still settling. Pattern 5+ (an agent that generates a Python extension to graft onto an existing pipeline; an agent that ends in a long-running streaming Spark job; etc.) may emerge soon and we don't want to keep migrating an enum.
- The dispatcher only needs to look at *which fields are populated*. Distinguishing Pattern 3 vs 4 at the schema level adds no behaviour today — both are `agentic_profile_id` set, the difference is purely in the profile's spec contents.
- UIs can present the pattern by inspecting the profile spec for the presence of jersey-tool stages that invoke Spark, or for a final pipeline-YAML deliverable. No schema flag needed.

This is a "watch and decide later" stance. If in a quarter the patterns crystallize and 80% of agents fall into one of two, we add the enum then.
