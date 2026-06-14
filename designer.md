---
layout: page
navbar: false
sidebar: false
aside: false
footer: false
pageClass: designer-embed-page
title: Pipeline Designer
description: WebRobot pipeline designer (embeddable, chrome-less)
---

<ClientOnly>
  <DemoApp />
</ClientOnly>

<style>
/* Chrome-less, full-bleed designer surface — meant to be embedded in the
   authenticated dashboard iframe (and usable standalone at /designer). The
   frontmatter already disables navbar/sidebar/aside/footer; here we also drop
   the VitePress page padding/max-width so the designer fills the frame. */
.designer-embed-page .VPPage,
.designer-embed-page .VPContent {
  padding: 0 !important;
  margin: 0 !important;
  max-width: none !important;
}
.designer-embed-page .vp-doc {
  padding: 0 !important;
}
.designer-embed-page .demo-app {
  margin: 0 auto;
  padding: 1rem;
  max-width: 1200px;
}
</style>
