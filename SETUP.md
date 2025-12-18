# Setup Instructions

## ✅ What's Been Created

A complete VitePress site has been set up in `webrobot-vitepress-site/` with:

- **Homepage** (`index.md`) - Hero section with features
- **Features Page** (`features.md`) - Detailed feature list
- **Documentation** (`docs/`) - Getting started guides
- **API Reference** (`api/`) - API documentation
- **Use Cases** (`use-cases.md`) - Real-world examples
- **About** (`about.md`) - Company information

## 🚀 Getting Started

### 1. Start Development Server

```bash
cd webrobot-vitepress-site
npm run dev
```

Visit `http://localhost:5173` to see your site.

### 2. Build for Production

```bash
npm run build
```

The built files will be in `.vitepress/dist/`.

### 3. Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
webrobot-vitepress-site/
├── .vitepress/
│   └── config.js          # Site configuration
├── docs/                   # Documentation
│   ├── introduction.md
│   └── quick-start.md
├── api/                    # API reference
│   └── authentication.md
├── public/                 # Static assets
│   └── logo.svg
├── index.md                # Homepage
├── features.md
├── use-cases.md
├── about.md
└── package.json
```

## 🎨 Customization

### Update Site Info

Edit `.vitepress/config.js`:

```javascript
export default defineConfig({
  title: 'WebRobot',  // Change site title
  description: '...', // Change description
  // ...
})
```

### Add Pages

1. Create a new `.md` file in the appropriate directory
2. Add it to the navigation in `.vitepress/config.js`

### Customize Theme

VitePress uses a default theme that can be customized. See [VitePress Theme Config](https://vitepress.dev/reference/default-theme-config).

## 📝 Next Steps

1. **Add Content**: Expand documentation pages with more details
2. **Customize Design**: Update colors, fonts, and layout
3. **Add Logo**: Replace `public/logo.svg` with your actual logo
4. **Integrate Docs**: Link to existing `webrobot-etl-api-doc` content
5. **Deploy**: Set up deployment to Vercel, Netlify, or GitHub Pages

## 🔗 Useful Links

- [VitePress Documentation](https://vitepress.dev/)
- [VitePress Theme Reference](https://vitepress.dev/reference/default-theme-config)
- [Markdown Guide](https://vitepress.dev/guide/markdown)

## 🐛 Troubleshooting

### Port Already in Use

If port 5173 is already in use:

```bash
npm run dev -- --port 3000
```

### Build Errors

Clear cache and rebuild:

```bash
rm -rf .vitepress/cache .vitepress/dist
npm run build
```

