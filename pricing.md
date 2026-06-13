---
layout: page
title: Plans
description: WebRobot plans — managed Lite and Bring-Your-Own-Cloud (BYOC)
aside: false
editLink: false
---

<!--
  VALIDATION PAGE — intentionally NOT in the site nav (config.js untouched).
  Reachable by direct URL (/pricing) for the BYOC market test.
  CTAs point to Stripe PAYMENT LINKS (no-code, no Price IDs in code) — replace the
  two href="#" placeholders below with the real Stripe Payment Link URLs.
-->

<div class="plans-wrapper">

# Scraping &amp; ETL that runs on <span class="accent">your</span> cloud

<p class="plans-sub">Describe what you want in plain language — WebRobot builds the pipeline and runs it on <b>Ray</b> inside <b>your own cloud</b> (Bring Your Own Cloud), from day one. You stay in control of data, IPs and cost.</p>

<div class="valueprop">
  ✨ <b>A fully‑managed multi‑agent agentic runtime — running in <span class="accent">your own</span> cloud.</b>
  <span>We provision &amp; manage the <b>Ray cluster</b>, the <b>multi‑agent agentic process</b> and the
  <b>stealth browsers</b> (Camoufox) for you — but everything runs inside your account. Managed
  convenience <b>+</b> BYOC control (your data, your IPs, your cost).</span>
</div>

<div class="beta-banner">
  <div class="beta-head">🚀 <b>Beta launch</b> — <b>unlimited for your first 2 months</b></div>
  <div class="beta-sub">No VM cap, no volume limits during the beta. After 2 months, continue on Starter or Pro.</div>
  <div class="beta-perk">⭐ <b>First 50 beta contributors</b> get <b>up to 20% off</b> their subscription, for giving feedback.</div>
  <a class="beta-cta" href="#"><!-- TODO: Stripe Payment Link / signup (Beta) -->Join the Beta</a>
</div>

<!-- ───────────────── BYOC explainer ───────────────── -->
<div class="byoc-box">
  <div class="byoc-title">🔐 What is BYOC (Bring Your Own Cloud)?</div>
  <p>With BYOC the WebRobot platform <b>orchestrates</b> the scraping, but the actual browsers and
  workers run on <b>your own cloud account</b> (Hetzner). You connect your cloud token once; we
  provision, scale and tear down the machines for you — automatically, per job.</p>
  <div class="byoc-points">
    <div><b>Your data, your infra</b><span>Pages are fetched and processed inside your cloud — data never has to sit on ours.</span></div>
    <div><b>Pay compute at cost</b><span>Cloud machines are billed directly by your provider (cheap Hetzner rates). We charge only the platform fee.</span></div>
    <div><b>Elastic &amp; ephemeral</b><span>Dedicated browser VMs spin up for a run and <b>auto‑tear‑down</b> when it finishes — you pay only for the minutes you use.</span></div>
    <div><b>Dedicated stealth browsers</b><span>Per‑tenant Camoufox (stealth Firefox) VMs — your own IPs/geo, no shared‑pool noisy neighbours.</span></div>
  </div>
</div>

<!-- ───────────────── Plan cards ───────────────── -->
<div class="plans-grid">

  <div class="plan-card">
    <div class="ribbon alt">BYOC</div>
    <div class="plan-name">Starter · Bring Your Own Cloud</div>
    <div class="plan-price"><span class="cur">€</span>19<span class="per">/mo</span></div>
    <div class="plan-tag">Your own AI agent — in your cloud</div>
    <ul class="plan-feats">
      <li>✅ <b>Personalized AI agent</b> — a <b>multi‑agent agentic process</b> (managed Ray job), built &amp; customized from the in‑site explorer</li>
      <li>✅ <b>Telegram bot</b> — chat with your agent &amp; trigger jobs from Telegram</li>
      <li>✅ Streaming chat + agent <b>memory</b></li>
      <li>✅ <b>Managed Ray cluster</b> provisioned in <b>your own cloud</b> (Hetzner)</li>
      <li>✅ <b>Scrapy runtime</b> — lightweight scraping engine</li>
      <li>✅ Managed stealth browser (Camoufox), dedicated · your IPs/geo</li>
      <li>✅ Elastic ephemeral VMs — <b>up to 3</b> in parallel, auto‑tear‑down</li>
      <li class="muted">— Scrapy engine only (no Spark)</li>
    </ul>
    <div class="plan-for">Best for: a custom conversational agent + Telegram bot, light scraping.</div>
    <a class="plan-cta" href="#"><!-- TODO: Stripe Payment Link (Starter BYOC €19) -->Start Starter</a>
  </div>

  <div class="plan-card featured">
    <div class="ribbon">BYOC</div>
    <div class="plan-name">Pro · Bring Your Own Cloud</div>
    <div class="plan-price"><span class="cur">€</span>299<span class="per">/mo</span></div>
    <div class="plan-tag">Distributed power — Spark + scale, in your cloud</div>
    <ul class="plan-feats">
      <li>✅ Everything in Starter</li>
      <li>✅ <b>Spark cluster</b> — distributed ETL &amp; analytics (heavy / multi‑source jobs)</li>
      <li>✅ Both engines: <b>Scrapy + Spark</b></li>
      <li>✅ Elastic ephemeral VMs — <b>up to 50</b> in parallel</li>
      <li>✅ Higher concurrency &amp; volume</li>
      <li>✅ Managed stealth browser (Camoufox), dedicated</li>
      <li>✅ Priority support</li>
    </ul>
    <div class="plan-for">Best for: production &amp; data teams — distributed scraping + analytics at scale.</div>
    <a class="plan-cta primary" href="#"><!-- TODO: Stripe Payment Link (Pro BYOC €299) -->Start Pro</a>
  </div>

</div>

<!-- ───────────────── How BYOC works ───────────────── -->
<div class="how">
  <div class="how-title">How BYOC works</div>
  <div class="how-steps">
    <div><span class="n">1</span><b>Connect your cloud</b><span>Paste your Hetzner API token once. Your machines, your account.</span></div>
    <div><span class="n">2</span><b>Run a pipeline</b><span>WebRobot provisions dedicated browser VMs in your cloud and runs the job.</span></div>
    <div><span class="n">3</span><b>Auto‑scale &amp; tear down</b><span>VMs scale to the job and are destroyed at the end — you only pay for runtime.</span></div>
  </div>
</div>

<div class="notice">⚠️ <b>Important notice</b> — WebRobot is in <b>beta</b>: plans, limits and prices are provisional and
we reserve the right to update the subscription plans. Current line‑up (2 plans) is what's available for now.</div>

<p class="plans-foot">Prices excl. VAT, cancel anytime. <b>BYOC billing model (both plans):</b> the subscription covers
the WebRobot platform &amp; orchestration; the underlying cloud machines (Ray cluster + browser VMs)
are billed <b>directly by your provider</b> (Hetzner) to your own account — typically a few cents per
machine‑hour, and only while a job runs (ephemeral, auto‑tear‑down).</p>

</div>

<style scoped>
.plans-wrapper { max-width: 1000px; margin: 2.5rem auto; padding: 0 1.5rem; box-sizing: border-box; }
.plans-wrapper h1 { text-align: center; margin: 0 0 .6rem; font-size: 2.2rem; line-height: 1.2; }
.accent { color: var(--vp-c-brand-1); }
.plans-sub { text-align: center; color: var(--vp-c-text-2); margin: 0 auto 1.6rem; max-width: 720px; }

.valueprop { border-radius: 14px; padding: 1.2rem 1.5rem; margin: 0 0 1.4rem; text-align: center; background: linear-gradient(135deg, var(--vp-c-brand-soft), var(--vp-c-bg-soft)); border: 1px solid var(--vp-c-brand-1); }
.valueprop b { font-size: 1.05rem; }
.valueprop span { display: block; margin-top: .5rem; color: var(--vp-c-text-2); font-size: .92rem; }

.beta-banner { border: 1px solid var(--vp-c-brand-1); background: var(--vp-c-brand-soft); border-radius: 14px; padding: 1.1rem 1.4rem; margin: 0 0 2rem; text-align: center; }
.beta-head { font-size: 1.15rem; }
.beta-sub { color: var(--vp-c-text-2); font-size: .9rem; margin-top: .3rem; }
.beta-perk { margin-top: .5rem; font-size: .92rem; }
.beta-cta { display: inline-block; margin-top: .9rem; padding: .6rem 1.4rem; border-radius: 10px; background: var(--vp-c-brand-1); color: #fff; font-weight: 700; text-decoration: none; }
.beta-cta:hover { background: var(--vp-c-brand-2); }
.ribbon.alt { background: var(--vp-c-text-3); }
.notice { margin: 2rem 0 0; padding: .9rem 1.2rem; border-radius: 10px; border: 1px solid var(--vp-c-warning-1, #d97706); background: var(--vp-c-warning-soft, rgba(217,119,6,.08)); font-size: .88rem; text-align: center; }

.byoc-box { border: 1px solid var(--vp-c-divider); border-radius: 14px; background: var(--vp-c-bg-soft); padding: 1.6rem 1.6rem 1.2rem; margin-bottom: 2rem; }
.byoc-title { font-weight: 700; font-size: 1.1rem; margin-bottom: .5rem; }
.byoc-box p { color: var(--vp-c-text-2); margin: 0 0 1rem; }
.byoc-points { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 720px) { .byoc-points { grid-template-columns: 1fr; } }
.byoc-points > div { background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: .8rem 1rem; }
.byoc-points b { display: block; margin-bottom: .2rem; }
.byoc-points span { color: var(--vp-c-text-2); font-size: .88rem; }

.plans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: stretch; }
@media (max-width: 720px) { .plans-grid { grid-template-columns: 1fr; } }
.plan-card { position: relative; border: 1px solid var(--vp-c-divider); border-radius: 14px; padding: 1.8rem 1.6rem; background: var(--vp-c-bg-soft); display: flex; flex-direction: column; }
.plan-card.featured { border-color: var(--vp-c-brand-1); box-shadow: 0 6px 30px rgba(0,0,0,.08); }
.ribbon { position: absolute; top: -12px; right: 18px; background: var(--vp-c-brand-1); color: #fff; font-size: .72rem; font-weight: 700; letter-spacing: .04em; padding: .25rem .6rem; border-radius: 999px; }
.plan-name { font-weight: 700; font-size: 1.15rem; margin-bottom: .4rem; }
.plan-price { font-size: 2.6rem; font-weight: 800; line-height: 1; }
.plan-price .cur { font-size: 1.3rem; vertical-align: super; margin-right: 2px; }
.plan-price .per { font-size: 1rem; font-weight: 500; color: var(--vp-c-text-2); }
.plan-tag { color: var(--vp-c-text-2); margin: .5rem 0 1.1rem; font-size: .92rem; }
.plan-feats { list-style: none; padding: 0; margin: 0 0 1rem; flex: 1; }
.plan-feats li { padding: .35rem 0; border-bottom: 1px dashed var(--vp-c-divider); font-size: .95rem; }
.plan-feats li.muted { color: var(--vp-c-text-3); border-bottom: none; }
.plan-for { color: var(--vp-c-text-3); font-size: .85rem; margin-bottom: 1.1rem; }
.plan-cta { display: block; text-align: center; padding: .8rem 1rem; border-radius: 10px; font-weight: 700; text-decoration: none; border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1); transition: all .15s ease; }
.plan-cta:hover { background: var(--vp-c-brand-soft); }
.plan-cta.primary { background: var(--vp-c-brand-1); color: #fff; }
.plan-cta.primary:hover { background: var(--vp-c-brand-2); }

.how { margin: 2.4rem 0 0; }
.how-title { text-align: center; font-weight: 700; font-size: 1.15rem; margin-bottom: 1.2rem; }
.how-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
@media (max-width: 720px) { .how-steps { grid-template-columns: 1fr; } }
.how-steps > div { border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 1rem 1.1rem; background: var(--vp-c-bg-soft); }
.how-steps .n { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--vp-c-brand-1); color: #fff; font-weight: 700; margin-bottom: .5rem; }
.how-steps b { display: block; margin-bottom: .2rem; }
.how-steps span:not(.n) { color: var(--vp-c-text-2); font-size: .88rem; }

.plans-foot { text-align: center; color: var(--vp-c-text-3); font-size: .82rem; margin-top: 2rem; line-height: 1.6; }
</style>
