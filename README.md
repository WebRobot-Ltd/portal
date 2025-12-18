# WebRobot Portal

> **Spark-native, API-first data infrastructure for agentic ETL pipelines and data products**

A comprehensive showcase portal demonstrating WebRobot's capabilities as a universal data infrastructure layer powering vertical applications.

## 🎯 Overview

This portal serves as both a **technical documentation hub** and a **live demonstration platform** for WebRobot's ETL framework. It showcases how WebRobot acts as a horizontal, universal layer that enables rapid development of vertical applications across multiple industries.

## 🏗️ Architecture

WebRobot Portal is built with:

- **[VitePress](https://vitepress.dev/)** - Static site generator for fast, modern documentation
- **Vue 3** - Component-based UI framework
- **Docker** - Containerized deployment
- **Jenkins** - CI/CD pipeline automation
- **Kubernetes** - Orchestrated deployment

## 📚 Portal Sections

### Technical Documentation

- **Getting Started** - Quick start guides and installation instructions
- **Pipeline Stages** - Comprehensive documentation of available ETL stages
- **Intelligent Stages** - LLM-powered adaptive web scraping and extraction
- **Python Extensions** - Custom row transforms and data manipulation
- **Plugins & Extensibility** - How to extend WebRobot with custom plugins
- **API Reference** - Complete REST API documentation
- **Vertical Solutions** - Industry-specific use cases and examples

### Live Demonstrations

The portal includes interactive demo sections that showcase WebRobot's capabilities:

#### 🌐 Public Demo (Wow Demo)

A **public-facing demonstration** designed for social media sharing (LinkedIn, Twitter, etc.) that allows visitors to:

- **Execute Example Pipelines** - Run publicly available ETL pipelines from documentation
  - Preview limited to 5-10 records for performance
  - No authentication required
  - Real-time execution against production backends
  
- **Generate Pipelines from Natural Language** - AI-powered pipeline generation
  - Describe extraction requirements in plain English
  - Multiple LLM provider support (OpenAI, Anthropic, Together AI, Google)
  - Generated YAML pipelines ready for execution
  - **Note**: Generated pipelines are not automatically executed

This demo serves as a **"wow factor"** showcase, demonstrating WebRobot's ease of use and powerful capabilities to potential clients and partners.

#### 🔐 Private Demo (Client-Specific)

**Authenticated access** to client-specific demonstrations that showcase:

- **EAN Image Sourcing Plugin** - Product image extraction from e-commerce sites
  - CSV upload with EAN codes
  - Multi-country support (Denmark, Belgium, France, Germany, Italy, Spain, Netherlands)
  - Real-time pipeline execution
  - SQL query interface for results
  
- **Future Client Demos** - Extensible architecture for additional client-specific demonstrations
  - Each client can have customized demo interfaces
  - Access controlled via API key authentication
  - Demo content dynamically loaded based on authenticated user

### Key Features

- **Production Integration** - All demos connect to **live production backends**
- **Real-time Execution** - Actual pipeline runs against real data sources
- **Extensible Architecture** - Easy to add new demos for new clients
- **Client Customization** - Each client sees only their relevant demos
- **API-First Design** - All functionality exposed via REST APIs

## 🚀 Technology Showcase

This portal demonstrates WebRobot's core value proposition:

### Universal Data Infrastructure Layer

WebRobot serves as a **horizontal, universal platform** that:

- **Abstracts Complexity** - Handles distributed data processing, web scraping, and ETL orchestration
- **Enables Rapid Development** - Vertical applications can be built quickly on top of WebRobot
- **Provides Production-Ready Infrastructure** - Scalable, reliable, and performant out of the box
- **Supports Multiple Use Cases** - From e-commerce price comparison to sports betting arbitrage to real estate analysis

### Vertical Application Enablement

The demos showcase how WebRobot powers vertical applications:

- **EAN Image Sourcing** - E-commerce product data extraction
- **Price Comparison** - Multi-site price monitoring
- **Sports Betting** - Arbitrage opportunity detection
- **Real Estate** - Property listing aggregation and analysis
- **Portfolio Management** - Financial data analysis and prediction
- **LLM Fine-tuning** - Dataset preparation for AI model training

Each vertical application leverages the same underlying WebRobot infrastructure, demonstrating the platform's versatility and power.

## 🛠️ Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The site will be available at `http://localhost:5173`

### Project Structure

```
webrobot-vitepress-site/
├── .vitepress/           # VitePress configuration
│   ├── components/       # Vue components
│   │   ├── DemoApp.vue   # Main demo application
│   │   ├── ContactPage.vue
│   │   └── ContactForm.vue
│   ├── theme/            # Custom theme
│   └── config.js         # Site configuration
├── public/               # Static assets
├── api/                  # API documentation
├── docs/                 # Technical documentation
├── demo.md               # Demo page
├── features.md           # Features showcase
├── contact.md            # Contact page
└── Dockerfile            # Container configuration
```

## 🐳 Deployment

### Docker

```bash
# Build image
docker build -t webrobot-portal .

# Run container
docker run -p 8080:80 webrobot-portal
```

### Kubernetes

The portal includes a `Jenkinsfile` for automated CI/CD deployment to Kubernetes. See [README.DEPLOY.md](./README.DEPLOY.md) for detailed deployment instructions.

## 🔌 Backend Integration

The portal integrates with WebRobot's production backends:

- **Jersey API** - Main REST API (`/api/webrobot/api/...`)
- **Demo Plugin** - Public demo endpoints (`/api/webrobot/api/demo/...`)
- **EAN Plugin** - EAN Image Sourcing endpoints (`/api/webrobot/api/ean-image-sourcing/...`)
- **CrewAI Backend** - AI agentic layer for pipeline generation

All API calls are made to production endpoints, ensuring real-world demonstrations.

## 📝 Adding New Demos

To add a new client-specific demo:

1. **Add demo configuration** to `DemoApp.vue`:
   ```javascript
   {
     id: 'new-demo-id',
     name: 'New Demo Name',
     icon: '🎯',
     description: 'Demo description',
     features: ['Feature 1', 'Feature 2'],
     status: 'available',
     plugin: 'plugin-name'
   }
   ```

2. **Implement demo interface** in the `private-demo-interface` section

3. **Add API integration** to connect with backend endpoints

4. **Update authentication** to include demo in user's accessible demos list

## 🤝 Contributing

This portal is part of the WebRobot ecosystem. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

Copyright © 2025 WebRobot. All rights reserved.

## 🔗 Links

- **Documentation**: [docs.webrobot.eu](https://docs.webrobot.eu)
- **API**: [api.webrobot.eu](https://api.webrobot.eu)
- **Main Website**: [www.webrobot.eu](https://www.webrobot.eu)

## 📧 Contact

- **Email**: contact@webrobot.eu
- **Support**: support@webrobot.eu
- **Partnerships**: partners@webrobot.eu

---

**Built with ❤️ by the WebRobot team**
