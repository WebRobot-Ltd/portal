# Quick Start

Get started with WebRobot in minutes!

## Prerequisites

- Java 11 or higher
- Apache Spark 3.x
- Node.js 16+ (for CLI tools)
- API Key (get one from your organization admin)

## Installation

### Option 1: Using Docker

```bash
docker pull webrobot/webrobot:latest
docker run -p 8080:8080 webrobot/webrobot:latest
```

### Option 2: Using CLI

```bash
npm install -g @webrobot/cli
webrobot init
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

### Using CLI

```bash
webrobot run pipeline.yaml
```

### Using API

```bash
curl -X POST https://api.webrobot.eu/api/pipelines/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d @pipeline.yaml
```

## View Results

Results are stored in your project's storage. Access them via:

- **API**: `GET /api/jobs/{jobId}/results`
- **CLI**: `webrobot results {jobId}`
- **Dashboard**: Visit the WebRobot dashboard

## Next Steps

- [Pipeline Stages](/docs/pipeline-stages) - Explore available stages
- [Intelligent Stages](/docs/intelligent-stages) - Use AI-powered stages
- [API Reference](/api/authentication) - Learn about the API

