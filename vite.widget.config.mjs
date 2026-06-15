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
