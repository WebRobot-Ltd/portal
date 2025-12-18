# WebRobot VitePress Site

Enterprise showcase website for WebRobot built with [VitePress](https://vitepress.dev/).

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or pnpm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` to see your site.

### Build

Build the site for production:

```bash
npm run build
```

The built files will be in `.vitepress/dist`.

### Preview

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
webrobot-vitepress-site/
├── .vitepress/
│   └── config.js          # VitePress configuration
├── docs/                   # Documentation pages
│   ├── introduction.md
│   └── quick-start.md
├── api/                    # API reference pages
├── index.md                # Homepage
├── features.md             # Features page
├── use-cases.md            # Use cases page
├── about.md                # About page
└── package.json
```

## Customization

### Theme

Edit `.vitepress/config.js` to customize:
- Site title and description
- Navigation menu
- Sidebar structure
- Social links
- Footer

### Content

All content is written in Markdown. VitePress supports:
- Frontmatter for metadata
- Code highlighting
- Custom components
- Search functionality

## Deployment

### Vercel

```bash
npm install -g vercel
vercel
```

### Netlify

1. Connect your repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `.vitepress/dist`

### GitHub Pages

1. Set `base` in `.vitepress/config.js` to your repository name
2. Build the site: `npm run build`
3. Deploy the `.vitepress/dist` folder to GitHub Pages

## Learn More

- [VitePress Documentation](https://vitepress.dev/)
- [VitePress GitHub](https://github.com/vuejs/vitepress)

