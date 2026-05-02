# AI-Assisted Development

WebroBot ships a first-class AI integration layer: an MCP (Model Context Protocol) server and a set of Claude Code skills designed for building pipelines, developing plugins, and administering the platform without leaving your editor.

---

## Claude Code MCP Plugin

The `webrobot-claude-plugin` installs as a Claude Code plugin and exposes a set of domain skills that are aware of WebroBot's architecture, stage catalog, API schema, and multi-tenancy patterns.

### Installing the Plugin

Follow the plugin installation instructions in your WebroBot admin panel under **Settings → AI Integration**. The plugin registers the MCP server endpoint and injects the skill definitions into your Claude Code environment.

### Available Skills

Invoke a skill by typing its name in Claude Code. Each skill loads a domain-specific instruction set and has access to the MCP tools listed below.

#### `/webrobot-admin`

General administration: projects, jobs, executions, agents, datasets, cloud credentials, and LLM providers.

**Use it to:**
- Create and manage ETL projects and jobs
- Trigger and monitor pipeline executions
- Register cloud credentials (AWS, GCP, Azure)
- Configure LLM provider API keys (OpenAI, Groq, Anthropic, etc.)
- Browse datasets and execution logs

**Example prompts:**
```
/webrobot-admin list my active jobs for org 123
/webrobot-admin execute job "price-discovery" and follow the logs
/webrobot-admin show me the last 10 executions for project "catalog-etl"
```

---

#### `/webrobot-pipeline`

Build and inspect pipeline YAML. The skill knows all native stages, connector stages, `iextract`, and Python Extensions.

**Use it to:**
- Generate complete pipeline YAML from a description
- Debug a failing pipeline by inspecting its stage structure
- Suggest the right stage for a given data source
- Review and improve an existing pipeline

**Example prompts:**
```
/webrobot-pipeline build a pipeline that loads products from PostgreSQL, visits each product_url, extracts the price and title, and saves to CSV
/webrobot-pipeline what args does load_db accept?
/webrobot-pipeline review this pipeline YAML and suggest improvements
```

---

#### `/webrobot-plugin-dev`

Build ETL Scala plugins and REST API Jersey plugins. The skill knows the full SDK trait hierarchy, the ORM layer, Flyway migration patterns, and multi-tenancy requirements.

**Use it to:**
- Scaffold a new plugin project from scratch
- Implement a custom `WTransformStage`, `WSourceStage`, or `WAggregateStage`
- Write Flyway migration SQL with the correct naming convention
- Review a plugin implementation for multi-tenancy correctness
- Debug JDBC and ResultSet lifecycle issues

**Example prompts:**
```
/webrobot-plugin-dev create a WTransformStage that calls an external enrichment API and adds the result as new fields
/webrobot-plugin-dev write the Flyway migration to add a confidence_score column to my plugin's results table
/webrobot-plugin-dev review this sink stage for multi-tenancy issues
```

---

#### `/webrobot-python-extension`

Create and register Python Extension functions. The skill knows all three registration modes and common field-type gotchas.

**Use it to:**
- Generate a Python function for a described transformation
- Register the function via the API
- Build a complete pipeline YAML that uses the registered function
- Debug why a function is dropping rows

**Example prompts:**
```
/webrobot-python-extension write a function that extracts a price from a raw string like "€12,99" and register it for org 123
/webrobot-python-extension create a URL normalizer that strips tracking parameters
/webrobot-python-extension why is my function dropping rows with missing prices?
```

---

## Cursor IDE Support

The MCP server exposes WebroBot admin tools directly in Cursor's AI assistant. Configure the server endpoint in your project's `.cursorrules` file or in Cursor's MCP settings panel.

Once configured, you can use natural language in the Cursor chat to create jobs, execute pipelines, and inspect results — all without switching to a browser or terminal.

**`.cursorrules` example:**

```
WebroBot MCP server: https://webrobot.example.com/mcp
Always scope DB queries by org_id from ctx.config("webrobot.org.id") in ETL stages.
Always use OrganizationContextHelper.getOrganizationId(req) in REST endpoints.
Never hardcode org IDs.
```

---

## MCP Tools Reference

These tools are available to all skills and directly in Cursor when the MCP server is configured.

| Tool                  | Description                                                    |
|-----------------------|----------------------------------------------------------------|
| `auth_me`             | Verify current auth token and return user/org context          |
| `list_projects`       | List ETL projects for the current organization                 |
| `get_project`         | Get a single project by ID                                     |
| `create_project`      | Create a new ETL project                                       |
| `delete_project`      | Delete a project                                               |
| `list_jobs`           | List jobs within a project                                     |
| `get_job`             | Get a single job with its pipeline YAML                        |
| `create_job`          | Create a new job with a pipeline YAML definition               |
| `delete_job`          | Delete a job                                                   |
| `execute_job`         | Trigger a job execution                                        |
| `stop_job`            | Stop a running execution                                       |
| `list_executions`     | List recent executions for a job or project                    |
| `get_execution_logs`  | Stream or fetch logs for a specific execution                  |
| `list_categories`     | List project categories                                        |
| `list_agents`         | List AI agents configured in the platform                      |
| `get_agent`           | Get a single agent definition                                  |
| `create_agent`        | Create a new AI agent                                          |
| `get_agent_code`      | Get the code/prompt of an agent                                |
| `list_datasets`       | List output datasets for a project                             |
| `delete_dataset`      | Delete a dataset                                               |
| `list_cloud_credentials` | List registered cloud credentials (AWS, GCP, etc.)        |
| `list_llm_providers`  | List configured LLM provider API keys                          |
| `llm_infer`           | Call an LLM provider directly (for agent logic and testing)    |

---

## Typical AI-Assisted Workflow

The following workflow describes how the skills compose in practice.

### Step 1 — Scaffold a pipeline with `/webrobot-pipeline`

Describe what you want to build. The skill generates a complete pipeline YAML using the right stages for your data source and target.

```
/webrobot-pipeline I have a CSV of products with EAN and product_url columns. 
I want to visit each URL, extract the price and stock status, and save the results 
to a CSV. Build me the pipeline YAML.
```

### Step 2 — Execute and monitor with `/webrobot-admin`

Once the YAML looks right, use the admin skill to create a job and run it.

```
/webrobot-admin create a job in project "price-monitoring" with the YAML I just built, 
name it "daily-price-scrape", then execute it and follow the logs
```

### Step 3 — Add a custom stage with `/webrobot-plugin-dev`

If the native stages don't cover a requirement (e.g. you need a UPSERT into a custom table with business logic), scaffold a plugin stage.

```
/webrobot-plugin-dev I need a WSinkStage that takes the extracted price and EAN, 
looks up the product in the products table, and inserts a record into price_history 
only if the price has changed from the last recorded value. Write the full stage class.
```

### Step 4 — Quick transforms with `/webrobot-python-extension`

For lightweight field transformations that don't justify a Scala plugin, use the Python Extension skill to generate and register a function.

```
/webrobot-python-extension the price field arrives as "€12.99 incl. VAT". 
Write a Python function that extracts just the numeric value, registers it 
for org 123, and gives me the pipeline YAML to use it.
```

---

## Tips for Effective AI-Assisted Pipeline Development

**Be specific about field names.** The AI skills produce better output when you name your fields explicitly: "the CSV has columns: ean, product_url, brand" vs "I have a CSV".

**Iterate in small steps.** Build one stage at a time. Verify each stage works before adding the next. Use `get_execution_logs` to inspect intermediate output.

**Let the AI handle boilerplate.** The ServiceLoader registration files, Flyway naming conventions, and multi-tenancy patterns are all things the plugin dev skill handles automatically — you describe the business logic.

**Use Python Extensions for speed, plugins for reliability.** Python Extensions are fast to create and iterate on. Once a transform is stable and needs to handle large volumes, consider porting it to a `WTransformStage` Scala plugin for better performance and type safety.
