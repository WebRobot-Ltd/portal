# Introduction

Welcome to WebRobot! This guide will help you understand what WebRobot is and how it can transform your data infrastructure.

## What is WebRobot?

**WebRobot** is a **Spark-native, API-first data infrastructure** for building **agentic ETL pipelines** and **data products**.

### Key Concepts

- **ETL Pipelines**: Extract, Transform, and Load data from various sources
- **Agentic**: AI-powered intelligence that adapts and learns
- **Spark-Native**: Built on Apache Spark for distributed processing
- **API-First**: Everything is accessible via REST API

## Core Components

### 1. Pipeline Engine

The core engine that executes ETL pipelines. Pipelines are defined in YAML and executed on Apache Spark.

### 2. Intelligent Stages

AI-powered stages that can:
- Adapt to website changes
- Extract data intelligently
- Generate pipelines from natural language

### 3. API Layer

RESTful API for:
- Managing projects and pipelines
- Executing jobs
- Monitoring and logging

### 4. Extensibility Layer

- **Plugins**: Custom plugins for technical partners
- **Python Extensions**: Dynamic row transforms
- **Attribute Resolvers**: Custom extraction methods
- **Custom Actions**: Extended browser interactions

## Architecture

```
┌─────────────────────────────────────────┐
│         WebRobot Platform               │
├─────────────────────────────────────────┤
│  API Layer (Jersey/Flask)               │
│  ├── Projects Management                │
│  ├── Pipeline Execution                 │
│  └── Job Monitoring                     │
├─────────────────────────────────────────┤
│  Agentic Layer (CrewAI)                  │
│  ├── Natural Language Processing        │
│  ├── Pipeline Generation                │
│  └── Intelligent Stages                 │
├─────────────────────────────────────────┤
│  ETL Engine (Spark)                      │
│  ├── Pipeline Execution                 │
│  ├── Data Processing                     │
│  └── Result Storage                      │
└─────────────────────────────────────────┘
```

## Use Cases

WebRobot is ideal for:

- **Web Scraping**: Intelligent extraction from websites
- **Data Integration**: Combining data from multiple sources
- **Real-time Processing**: Streaming data processing
- **LLM Training**: Dataset generation for AI/ML models
- **Business Intelligence**: Data aggregation and analysis

## Next Steps

- [Quick Start Guide](/docs/quick-start) - Get up and running in minutes
- [Pipeline Stages](/docs/pipeline-stages) - Learn about available stages
- [API Reference](/api/authentication) - Explore the API

