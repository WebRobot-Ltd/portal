# Features

WebRobot provides a comprehensive set of features for building and managing agentic ETL pipelines.

<div class="features-intro">
  <p>Discover the powerful capabilities that make WebRobot the leading platform for agentic ETL pipelines.</p>
</div>

## Core Features

<div class="features-grid">

<div class="feature-card">
<h3>🚀 Spark-Native Processing</h3>
<ul>
<li><strong>Distributed Computing</strong>: Leverage Apache Spark's distributed processing capabilities</li>
<li><strong>Scalability</strong>: Handle data from gigabytes to petabytes</li>
<li><strong>Performance</strong>: Optimized for speed and efficiency</li>
<li><strong>Resource Management</strong>: Intelligent resource allocation and optimization</li>
</ul>
</div>

<div class="feature-card">
<h3>🤖 AI-Powered Intelligence</h3>
<ul>
<li><strong>Intelligent Stages</strong>: LLM-powered stages that adapt to changing web structures</li>
<li><strong>Natural Language Processing</strong>: Convert natural language descriptions to executable pipelines</li>
<li><strong>Auto-Programming</strong>: Python extensions for dynamic stage generation</li>
<li><strong>Context-Aware Extraction</strong>: Intelligent data extraction with minimal configuration</li>
</ul>
</div>

<div class="feature-card">
<h3>🔌 API-First Architecture</h3>
<ul>
<li><strong>RESTful API</strong>: Complete programmatic control via REST API</li>
<li><strong>SDK Support</strong>: Official SDKs for multiple programming languages</li>
<li><strong>Webhooks</strong>: Real-time notifications for job status and events</li>
<li><strong>Integration Ready</strong>: Easy integration with existing tools and workflows</li>
</ul>
</div>

<div class="feature-card">
<h3>🧩 Maximum Extensibility</h3>
<ul>
<li><strong>Custom Plugins</strong>: Build and deploy custom plugins for technical partners</li>
<li><strong>Python Extensions</strong>: Dynamic row transforms without compilation</li>
<li><strong>Attribute Resolvers</strong>: Custom extraction methods for flexible data extraction</li>
<li><strong>Custom Actions</strong>: Extend browser interactions with custom action factories</li>
</ul>
</div>

<div class="feature-card">
<h3>🌐 Multi-Source Integration</h3>
<ul>
<li><strong>Web Sources</strong>: Intelligent web scraping with browser automation</li>
<li><strong>Databases</strong>: Connect to PostgreSQL, MySQL, MongoDB, and more</li>
<li><strong>APIs</strong>: REST and GraphQL API integration</li>
<li><strong>Streaming</strong>: Real-time data ingestion from Kafka, MQTT, and more</li>
</ul>
</div>

<div class="feature-card">
<h3>📊 Enterprise Features</h3>
<ul>
<li><strong>Monitoring</strong>: Comprehensive logging and monitoring capabilities</li>
<li><strong>Security</strong>: Enterprise-grade authentication and authorization</li>
<li><strong>Multi-tenancy</strong>: Support for multiple organizations and projects</li>
<li><strong>Audit Trail</strong>: Complete audit logging for compliance</li>
</ul>
</div>

</div>

## Advanced Features

### Agentic Capabilities

- **Pipeline Generation**: AI agents that generate pipelines from natural language
- **Auto-Setup**: Automated configuration and setup of interactive actions
- **Context Learning**: Agents learn from documentation and examples
- **Error Recovery**: Intelligent error handling and recovery

### Vertical Solutions

- **LLM Fine-tuning**: Datasets for training and fine-tuning LLMs
- **Price Comparison**: Real-time price monitoring and comparison
- **Sports Betting**: Surebet detection and arbitrage opportunities
- **Real Estate**: Property clustering and market analysis

### Developer Experience

- **CLI Tools**: Command-line interface for pipeline management
- **IDE Integration**: Support for popular IDEs and editors
- **Testing**: Built-in testing and validation tools
- **Documentation**: Comprehensive documentation and examples

### AI-Assisted Development

- **Claude Code Plugin**: MCP server + skill set for AI-assisted pipeline building and administration. Claude Code is our recommended environment for vibe coding, particularly for the development of technical partner plugins.
- **Cursor IDE Support**: Native MCP tool integration — list jobs, run pipelines, inspect logs from your editor
- **Skills**: `/webrobot-admin`, `/webrobot-pipeline`, `/webrobot-plugin-dev`, `/webrobot-python-extension`
- **AI Agent Workflow**: Generate Python Extensions at runtime, register via API, reference in YAML — no compilation

### Partner Plugin System

- **Plugin Marketplace**: Technical partners can upload custom ETL and API plugins
- **Plugin SDK**: Scala traits (`WSourceStage`, `WTransformStage`, `WSinkStage`, `WFilterStage`, `WAggregateStage`) + Java REST API plugin interface
- **CI/CD Integration**: Jenkins pipeline with automatic JAR upload to MinIO and DB registration
- **Plugin Manifest**: Declarative `manifest.json` with stage schema, Flyway migrations, and org scoping

---

## Ray Platform *(coming soon)*

WebroBot is extending its backend with a Ray-based distributed computing layer, complementing the existing Spark engine with capabilities tailored for AI workloads and real-time event-driven architectures.

### Training & Fine-tuning

Ray Train and Ray Data will power distributed model training and LLM fine-tuning pipelines, integrated with the same project/job model used for ETL workloads.

### Inference & Agentic Execution

Ray Serve will host inference endpoints for custom models. Ray's actor model will support distributed agentic workflows — long-running agents that coordinate across multiple nodes, consume events, and drive pipeline executions autonomously.

### Distributed Trading Engine

The Ray layer will serve as the backbone for real-time trading and arbitrage use cases, enabling low-latency event processing and coordination across geographically distributed workers.

### Sports Betting — Real-Time Odds Pipeline

The surebet detection vertical will use Ray to monitor live odds from multiple bookmakers in real time. Detected events feed a Kafka queue, which in turn drives a Spark Structured Streaming job for continuous arbitrage calculation and alerting.

```
Bookmaker APIs → Ray workers (real-time odds collection)
                       ↓
                  Kafka topic
                       ↓
           Spark Structured Streaming
                       ↓
          Surebet detection & alerts
```

## What's Next?

Check out our [documentation](/docs/introduction) to see all features and improvements.

