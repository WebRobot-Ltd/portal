# CLI Reference

The WebroBot CLI (`webrobot`) is a Java-based command-line tool for managing all platform resources and running pipelines.

## Installation

Download the latest release JAR and create a launcher script:

```bash
# Download CLI jar
curl -L https://github.com/WebRobot-Ltd/webrobot-cli/releases/latest/download/webrobot-cli.jar \
  -o ~/.local/share/webrobot-cli/webrobot-cli.jar

# Create launcher (requires Java 17+)
cat > ~/.local/bin/webrobot << 'EOF'
#!/usr/bin/env bash
java -jar "$HOME/.local/share/webrobot-cli/webrobot-cli.jar" "$@" 2> >(grep -v "^SLF4J:" >&2)
EOF
chmod +x ~/.local/bin/webrobot
```

## Configuration

Create `config.cfg` in your working directory:

```ini
api_endpoint=https://api.webrobot.eu
apikey=your-api-key
```

| Key | Description |
|-----|-------------|
| `api_endpoint` | Base URL (default: `https://api.webrobot.eu`) |
| `jwt` / `bearer` / `token` | JWT auth — sends `Authorization: Bearer <value>` |
| `apikey` / `apiKey` | API key auth — sends `X-API-Key` header |

**Help:** `webrobot --help` · `webrobot <group> --help`

---

## `project`

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `list` | List all projects | — |
| `add` | Create project | `-n` name, `-d` description |
| `get` | Get project by ID | `-i` projectId |
| `update` | Update project | `-i` id, `-n` name, `-d` description |
| `delete` | Delete project | `-i` projectId |
| `schedule-get` | Get project schedule | `-i` projectId |
| `schedule-set` | Set cron schedule | `-i` projectId, `-j` jobId, `-c` cron expr, `-e` enabled |

```bash
webrobot project list
webrobot project add -n "My Project" -d "Price monitoring"
webrobot project schedule-set -i 42 -j 7 -c "0 */6 * * *" -e true
```

---

## `category`

Categories are containers for agents (not the same as projects).

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `list` | List all categories | — |
| `get` | Get by ID | `-i` categoryId |
| `getbyname` | Get by name | `-n` name |
| `add` | Create category | `-n` name, `-d` description |
| `update` | Update category | `-i` id, `-n` name |
| `delete` | Delete category | `-i` id |

---

## `agent`

Agents hold pipeline YAML definitions. They belong to a category (use `-c`).

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `list` | List agents in category | `-c` categoryId |
| `get` | Get agent | `-c` categoryId, `-i` agentId |
| `getfromname` | Get by name | `-c` categoryId, `-n` name |
| `add` | Create agent | `-c` categoryId, `-n` name, `-d` desc, `-f` pipelineYamlFile |
| `update` | Update agent | `-c` categoryId, `-i` agentId, `-f` pipelineYamlFile |
| `delete` | Delete agent | `-i` agentId |

```bash
webrobot agent add -c 3 -n "price-monitor" -d "Monitoring pipeline" -f ./pipeline.yaml
webrobot agent update -c 3 -i 12 -f ./pipeline.yaml
```

---

## `job`

Jobs link a project, an agent, and an input dataset.

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `list` | List jobs in project | `-p` projectId |
| `add` | Create job | `-p` projectId, `-n` name, `-a` agentId, `-i` inputDatasetId |
| `update` | Update job | `-p` projectId, `-j` jobId, `-n` name; optional: `-a`, `-i`, `--enabled` |
| `delete` | Delete job | `-p` projectId, `-j` jobId |
| `execute` | Run job | `-p` projectId, `-j` jobId; optional: `--follow` / `-F` |
| `stop` | Stop running job | `-p` projectId, `-j` jobId |
| `logs` | Get execution logs | `-p` projectId, `-j` jobId; optional: `--tail`, `--pod-name` |

```bash
# Run and wait for completion
webrobot job execute -p 5 -j 12 --follow

# Stream logs
webrobot job logs -p 5 -j 12 --tail 200
```

**`--follow` / `-F`:** polls execution status every 5s, shows progress dots, exits with green ✓ on `COMPLETED` or red ✗ on failure.

---

## `pipeline`

High-level commands for working with pipeline YAML manifests.

### `pipeline run`

Apply a pipeline manifest and execute the job in one step:

```bash
webrobot pipeline run -f pipeline.yaml          # interactive confirm
webrobot pipeline run -f pipeline.yaml -y       # skip confirm
webrobot pipeline run -f pipeline.yaml --follow # run + wait
```

### `pipeline apply`

Create/update project, agent, dataset, and job from a pipeline YAML (idempotent):

```bash
webrobot pipeline apply -f pipeline.yaml
```

Prints hints for `webrobot job execute` and `webrobot pipeline run` after success.

### `pipeline show`

Show the current state of a pipeline, with ✓/? markers per stage (checked against stage catalog):

```bash
webrobot pipeline show -f pipeline.yaml
```

### `pipeline stages`

```bash
webrobot pipeline stages list              # list all available stages (remote + local cache)
webrobot pipeline stages describe visit    # full detail of a stage: args, defaults, description
webrobot pipeline stages refresh           # invalidate cache, force-fetch from API
```

### `pipeline stages actions`

```bash
webrobot pipeline stages actions list              # list browser automation actions
webrobot pipeline stages actions describe click    # detail + examples for an action
```

Available actions: `click`, `type`, `scroll`, `wait`, `select`, `hover`, `navigate`, `submit`, `eval`, `none`

---

## `dataset`

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `list` | List datasets | optional: `-t` type, `--indexed`, `-f` format |
| `get` | Get dataset | `-d` datasetId |
| `add` | Create dataset | `-n` name, `-d` description |
| `delete` | Delete dataset | `-d` datasetId |

---

## `package`

Import/export projects as ZIP archives.

| Subcommand | Description | Key options |
|-----------|-------------|-------------|
| `exportproject` | Export one project | `-f` output folder, `-p` projectId |
| `exportall` | Export all projects | `-f` output folder |
| `importproject` | Import project | `-z` zip file, `-p` projectId |
| `importall` | Import all | `-z` zip file |

```bash
webrobot package exportproject -p 5 -f ./backups/
webrobot package importproject -p 5 -z ./backups/project-5.zip
```

---

## Typical Workflow

```bash
# 1. Create a project
webrobot project add -n "price-comparison" -d "Competitor price monitoring"

# 2. Create a category and agent
webrobot category add -n "price-agents"
webrobot agent add -c <categoryId> -n "monitor" -f ./monitoring-pipeline.yaml

# 3. Create a dataset (trigger input)
webrobot dataset add -n "trigger-input"

# 4. Create a job linking them
webrobot job add -p <projectId> -n "monitor-run" -a <agentId> -i <datasetId>

# 5. Run the job and follow execution
webrobot job execute -p <projectId> -j <jobId> --follow

# Or: do steps 1-5 in one command from a YAML manifest
webrobot pipeline run -f pipeline.yaml --follow
```
