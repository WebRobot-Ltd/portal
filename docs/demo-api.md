# Demo API & Developer Sandbox

The WebRobot platform ships a **public, no-auth demo plugin** designed as a real **developer sandbox**: build, run and inspect ETL pipelines on production infrastructure without registering an organization, paying, or installing anything beyond a single CLI or SDK.

The interactive UI at [/demo](/demo) is just one client of these endpoints — the same surface drives our CLI, all four official SDKs, and any tool you wire up against the OpenAPI spec. Treat `/webrobot/api/demo/*` as a stable contract you can prototype against and ship integration tests against.

### When this sandbox is the right tool

- **Try-before-you-buy.** Run a bundled pipeline end-to-end in 30 seconds to see what the output really looks like.
- **Pipeline prototyping.** Generate a pipeline from a natural-language prompt, iterate, then promote the same YAML to your own org without changing a single stage.
- **SDK integration.** Wire any of the four SDKs against the public endpoint and exercise `executeDemo` / `getExecutionStatus` / `getExecutionOutput` in your own CI before you have credentials.
- **Demo-driven onboarding.** Point a teammate at `webrobot demo execute …` and skip the API-key dance.

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
