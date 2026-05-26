<template>
  <ClientOnly>
    <div class="api-reference-wrap">
      <div class="api-reference-toolbar">
        <a class="api-reference-link"
           href="/openapi.json"
           target="_blank"
           rel="noopener">📄 Download openapi.json</a>
        <a class="api-reference-link"
           href="https://api.webrobot.eu/api"
           target="_blank"
           rel="noopener">🌐 Production base URL</a>
      </div>
      <rapi-doc
        spec-url="/openapi.json"
        theme="light"
        render-style="read"
        layout="column"
        primary-color="#667eea"
        nav-bg-color="#f8fafc"
        bg-color="#ffffff"
        text-color="#1f2937"
        nav-text-color="#1f2937"
        regular-font="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto"
        mono-font="ui-monospace,SFMono-Regular,Menlo,monospace"
        show-header="false"
        show-info="true"
        allow-authentication="true"
        allow-server-selection="true"
        allow-spec-url-load="false"
        allow-spec-file-load="false"
        allow-search="true"
        schema-style="table"
        schema-expand-level="2"
        default-schema-tab="schema"
        css-classes="api-reference-doc"
        style="height: calc(100vh - 80px); width: 100%;"
      ></rapi-doc>
    </div>
  </ClientOnly>
</template>

<script setup>
import { onMounted } from 'vue'

// rapi-doc is a Web Component loaded from CDN; load it once on mount.
// SSR-safe via <ClientOnly>.
onMounted(() => {
  if (typeof customElements !== 'undefined' && !customElements.get('rapi-doc')) {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://unpkg.com/rapidoc/dist/rapidoc-min.js'
    document.head.appendChild(s)
  }
})
</script>

<style scoped>
.api-reference-wrap {
  width: 100%;
  margin: 0;
  padding: 0;
}
.api-reference-toolbar {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.api-reference-link {
  color: #4f46e5;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
}
.api-reference-link:hover { text-decoration: underline; }
@media (max-width: 768px) {
  .api-reference-toolbar { padding: 8px 10px; font-size: 0.8rem; }
}
</style>
