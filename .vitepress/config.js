import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'WebRobot',
  description: 'Spark-native, API-first data infrastructure for agentic ETL pipelines and data products',
  
  // Ignore dead links (some links point to external documentation)
  ignoreDeadLinks: true,
  
  // Theme configuration
  themeConfig: {
    // Logo
    logo: '/logo.jpeg',
    
    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Features', link: '/features' },
      { text: 'Docs', link: '/docs/introduction' },
      { text: 'Demo', link: '/demo' },
      { text: 'Use Cases', link: '/use-cases' },
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
            { text: 'CLI Reference', link: '/docs/cli' }
          ]
        },
        {
          text: 'Building Pipelines',
          items: [
            { text: 'Pipeline Stages', link: '/docs/pipeline-stages' },
            { text: 'Python Extensions', link: '/docs/python-extensions' }
          ]
        },
        {
          text: 'Plugin Development',
          items: [
            { text: 'Plugins & SDK', link: '/docs/plugins' }
          ]
        },
        {
          text: 'AI Tools',
          items: [
            { text: 'Claude Code & Cursor', link: '/docs/ai-tools' }
          ]
        },
        {
          text: 'Vertical Solutions',
          items: [
            { text: 'Price Comparison', link: '/docs/vertical-price-comparison' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Authentication', link: '/api/authentication' }
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

