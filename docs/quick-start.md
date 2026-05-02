# Quick Start

Get started with WebRobot in minutes!

## Prerequisites

- Java 17+ (for the CLI)
- API Key (get one from your organization admin)

## Installation

### Install the CLI

```bash
# Download CLI jar
curl -L https://github.com/WebRobot-Ltd/webrobot-cli/releases/latest/download/webrobot-cli.jar \
  -o ~/.local/share/webrobot-cli/webrobot-cli.jar

# Create launcher
cat > ~/.local/bin/webrobot << 'EOF'
#!/usr/bin/env bash
java -jar "$HOME/.local/share/webrobot-cli/webrobot-cli.jar" "$@" 2> >(grep -v "^SLF4J:" >&2)
EOF
chmod +x ~/.local/bin/webrobot
```

Create `config.cfg` in your working directory:

```ini
api_endpoint=https://api.webrobot.eu
apikey=your-api-key
```

## Your First Pipeline

Create a simple pipeline that extracts data from a website:

```yaml
# pipeline.yaml
name: my-first-pipeline
stages:
  - type: visit
    url: https://example.com
  - type: extract
    selector: .content
    attribute: text
  - type: store
    format: json
```

## Execute the Pipeline

```bash
# Apply manifest (create/update project, agent, dataset, job) then run
webrobot pipeline run -f pipeline.yaml --follow
```

Or step by step:

```bash
webrobot project add -n "my-project"
webrobot category add -n "my-agents"
webrobot agent add -c <categoryId> -n "first-pipeline" -f pipeline.yaml
webrobot dataset add -n "trigger-input"
webrobot job add -p <projectId> -n "run" -a <agentId> -i <datasetId>
webrobot job execute -p <projectId> -j <jobId> --follow
```

## Next Steps

- [CLI Reference](/docs/cli) - Full command reference
- [Pipeline Stages](/docs/pipeline-stages) - Explore available stages
- [API Reference](/api/authentication) - REST API documentation

