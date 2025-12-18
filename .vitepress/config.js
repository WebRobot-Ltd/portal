import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WebRobot',
  description: 'Spark-native, API-first data infrastructure for agentic ETL pipelines and data products',
  
  // Ignore dead links (some links point to external documentation)
  ignoreDeadLinks: true,
  
  // Theme configuration
  themeConfig: {
    // Logo
    logo: '/logo.svg',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Demo', link: '/demo' },
      { text: 'Documentation', link: '/docs' },
      { text: 'API Reference', link: '/api' },
      { text: 'Use Cases', link: '/use-cases' },
      { text: 'Contact', link: '/contact' },
      { text: 'About', link: '/about' }
    ],
    
    // Sidebar
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/docs/introduction' },
            { text: 'Quick Start', link: '/docs/quick-start' },
            { text: 'Installation', link: '/docs/installation' }
          ]
        },
        {
          text: 'Guides',
          items: [
            { text: 'Pipeline Stages', link: '/docs/pipeline-stages' },
            { text: 'Intelligent Stages', link: '/docs/intelligent-stages' },
            { text: 'Python Extensions', link: '/docs/python-extensions' },
            { text: 'Plugins & Extensibility', link: '/docs/plugins' }
          ]
        },
        {
          text: 'Vertical Solutions',
          items: [
            { text: 'LLM Fine-tuning', link: '/docs/vertical-llm-finetuning' },
            { text: 'Price Comparison', link: '/docs/vertical-price-comparison' },
            { text: 'Sports Betting', link: '/docs/vertical-sports-betting' },
            { text: 'Real Estate', link: '/docs/vertical-real-estate' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Overview',
          items: [
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Projects', link: '/api/projects' },
            { text: 'Pipelines', link: '/api/pipelines' },
            { text: 'Jobs', link: '/api/jobs' }
          ]
        }
      ]
    },
    
    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/webrobot' }
    ],
    
    // Footer
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 WebRobot'
    },
    
    // Search
    search: {
      provider: 'local'
    }
  },
  
  // Markdown configuration
  markdown: {
    lineNumbers: true,
    config: (md) => {
      // Ensure HTML blocks (<div>, <style scoped>, Vue components) render properly in .md pages
      md.set({ html: true })
    }
  }
})

