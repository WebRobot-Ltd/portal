// Library build for the embeddable Pipeline Designer widget — a single UMD
// bundle (Vue runtime + DemoApp) exposing window.WebRobotDesigner.mount(el,opts),
// loaded by the Next.js dashboard (DesignerEmbed.tsx). Separate from the
// VitePress site build (which still serves /demo + /designer).
//   npm run build:widget  →  widget-dist/designer-widget.{js,css}
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  // The bundled Vue runtime references process.env.NODE_ENV for its dev/prod
  // feature flags; in a browser UMD bundle `process` is undefined → the module
  // throws at load ("process is not defined") and never assigns .mount. Replace
  // it at build time so the bundle is self-contained.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': '{}',
  },
  build: {
    outDir: 'widget-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, '.vitepress/widget/designer-widget.js'),
      name: 'WebRobotDesigner',
      formats: ['umd'],
      fileName: () => 'designer-widget.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: 'named',
        assetFileNames: 'designer-widget.[ext]',
      },
    },
  },
})
