// WebRobot Pipeline Designer — standalone mountable widget.
//
// Builds (vite.widget.config.mjs) to a single UMD bundle exposing
// `window.WebRobotDesigner.mount(el, opts)`. It mounts the SAME Vue DemoApp the
// portal serves at /demo and /designer, but as a library injected INTO the
// Next.js dashboard (same-origin, no iframe). The host (DesignerEmbed.tsx) sets
// `window.__WR_DESIGNER__ = { apiBase, token, productMode, onSave }` BEFORE
// loading this script, so DemoApp reads the org API base + org JWT at eval time
// and hands generated pipelines back via onSave. See
// project_embedded_designer_demo_scoped_todo.

import { createApp } from 'vue'
import DemoApp from '../components/DemoApp.vue'
import ByocModeSelector from '../components/ByocModeSelector.vue'

let _app = null

export function mount(el, opts = {}) {
  // Allow opts to (re)populate the injected config at mount time too — but the
  // host should also set window.__WR_DESIGNER__ before this script loads so the
  // module-eval consts (API_BASE_URL) pick it up.
  if (typeof window !== 'undefined') {
    window.__WR_DESIGNER__ = Object.assign({ productMode: true }, window.__WR_DESIGNER__ || {}, opts || {})
  }
  const target = typeof el === 'string' ? document.querySelector(el) : el
  if (!target) throw new Error('WebRobotDesigner.mount: target element not found')
  if (_app) { try { _app.unmount() } catch (_) {} }
  _app = createApp(DemoApp)
  _app.component('ByocModeSelector', ByocModeSelector)
  _app.mount(target)
  return _app
}

export function unmount() {
  try { _app && _app.unmount() } catch (_) {}
  _app = null
}

export default { mount, unmount }
