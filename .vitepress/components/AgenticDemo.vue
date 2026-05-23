<template>
  <div class="agentic-demo">

    <!-- Banner: same posture as DemoApp — Ray runtime is live but
         the browser-grounding profile is still being collaudata. -->
    <div class="status-banner">
      🟢 The agentic Ray runtime is <strong>in production</strong> (since 2026-05-22).
      Pick a curated profile below to launch a real run on the EU cluster.
      No editing yet — these profiles are managed by the WebRobot team.
    </div>

    <!-- Step 1 — Pick a profile -->
    <section class="demo-section">
      <h2>1️⃣ Pick a profile</h2>
      <p>Each profile is a self-contained agentic process. Pick one, fill the inputs, and click <strong>Run</strong>.</p>

      <div v-if="loadingDemos" class="loading-row">
        <span class="spinner"></span> Loading demo profiles…
      </div>

      <div v-else-if="demosError" class="error-box">
        <strong>Couldn't load demo profiles:</strong> {{ demosError }}
        <button class="btn btn-secondary btn-sm" @click="loadDemos">Retry</button>
      </div>

      <div v-else-if="demos.length === 0" class="empty-state">
        No demo profiles configured yet. Check back later.
      </div>

      <div v-else class="profile-cards">
        <button
          v-for="d in demos"
          :key="d.name"
          class="profile-card"
          :class="{ active: selectedDemo?.name === d.name }"
          @click="onSelectDemo(d)"
        >
          <div class="card-title">{{ d.displayName || d.name }}</div>
          <div class="card-tagline">{{ d.tagline || d.description || '' }}</div>
          <div class="card-meta">
            <span v-if="d.expectedDurationSec" class="meta-pill">⏱ ~{{ d.expectedDurationSec }}s</span>
            <span v-if="d.expectedTokens" class="meta-pill">🧠 ~{{ formatTokens(d.expectedTokens) }} tok</span>
            <span class="meta-pill version">v{{ d.version }}</span>
          </div>
        </button>
      </div>
    </section>

    <!-- Step 2 — Configure + run -->
    <section v-if="selectedDemo" class="demo-section">
      <h2>2️⃣ Configure inputs</h2>
      <p v-if="selectedDemo.description" class="profile-desc">{{ selectedDemo.description }}</p>

      <form class="inputs-form" @submit.prevent="onRun">

        <!-- Inputs (schema-driven) -->
        <div
          v-for="spec in (selectedDemo.inputs || [])"
          :key="spec.name"
          class="input-row"
        >
          <label :for="`input-${spec.name}`">
            <span class="lbl">{{ spec.name }}</span>
            <span v-if="spec.required" class="required-mark" title="required">*</span>
          </label>
          <textarea
            v-if="spec.type === 'string' && (spec.placeholder?.length > 60 || spec.name === 'goal')"
            :id="`input-${spec.name}`"
            v-model="inputs[spec.name]"
            class="input-text"
            rows="3"
            :placeholder="spec.placeholder"
          ></textarea>
          <input
            v-else
            :id="`input-${spec.name}`"
            v-model="inputs[spec.name]"
            type="text"
            class="input-text"
            :placeholder="spec.placeholder"
          />
          <small v-if="spec.help" class="input-help">{{ spec.help }}</small>
        </div>

        <!-- Execution mode + BYOC key + VM preset (reusable component).
             The component owns localStorage for the Hetzner token and the
             preset→vmCount/vmRoles derivation; the parent only forwards
             the derived values to the backend POST. -->
        <ByocModeSelector
          v-model:executionMode="executionMode"
          v-model:hetznerKey="hetznerKey"
          v-model:vmPreset="vmPreset"
          @update:vmCount="vmCount = $event"
          @update:vmRoles="vmRoles = $event"
          :recommendedPreset="selectedDemo?.recommendedPreset || null"
          :disabled="running"
          context="agentic"
        />

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="running || !canRun"
          >
            <span v-if="running" class="spinner"></span>
            ▶ {{ running ? 'Launching…' : 'Run' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="resetForm" :disabled="running">
            Reset
          </button>
          <span v-if="runError" class="error-line">{{ runError }}</span>
        </div>
      </form>
    </section>

    <!-- Step 3 — Execution view -->
    <section v-if="execution" class="demo-section">
      <h2>3️⃣ Execution</h2>

      <div class="exec-header">
        <div>
          <span class="lbl">ID</span>
          <code>{{ execution.executionId }}</code>
        </div>
        <div>
          <span class="lbl">Status</span>
          <span class="status-pill" :class="'pill-' + (execution.status || 'PENDING').toLowerCase()">
            {{ execution.status }}
          </span>
          <small v-if="progressPhase" class="progress-phase">{{ progressPhase }}</small>
        </div>
        <div v-if="execution.llmProvider">
          <span class="lbl">LLM</span>
          <span>{{ execution.llmProvider }}</span>
        </div>
        <div>
          <span class="lbl">Started</span>
          <span>{{ formatTime(execution.startedAt) }}</span>
        </div>
        <div v-if="execution.completedAt">
          <span class="lbl">Completed</span>
          <span>{{ formatTime(execution.completedAt) }}</span>
        </div>
        <div v-if="totalTokens != null">
          <span class="lbl">Tokens</span>
          <span>{{ totalTokens.toLocaleString() }}</span>
        </div>
      </div>

      <!-- Live progress while RUNNING/PENDING -->
      <div v-if="!isTerminal" class="progress-row">
        <span class="spinner"></span>
        <span>Run is {{ execution.status }} — polling every 4 seconds…</span>
      </div>

      <!-- Error surface -->
      <div v-if="execution.errorMessage" class="error-box">
        <strong>Error:</strong> {{ execution.errorMessage }}
      </div>

      <!-- Terminal: show the result -->
      <template v-if="isTerminal && execution.result">
        <h3 class="result-title">Outputs</h3>
        <div v-for="(nodeOutput, nodeId) in resultNodes" :key="nodeId" class="result-node">
          <h4>Node: <code>{{ nodeId }}</code></h4>
          <div v-for="(value, field) in nodeOutput" :key="field" class="result-field">
            <div class="field-name">{{ field }}</div>
            <pre class="field-value">{{ formatValue(value) }}</pre>
          </div>
        </div>
      </template>

      <details v-if="isTerminal" class="raw-json">
        <summary>Raw execution payload</summary>
        <pre>{{ JSON.stringify(execution, null, 2) }}</pre>
      </details>

      <div class="exec-actions" v-if="isTerminal">
        <button class="btn btn-primary" @click="runAgain">Run again</button>
        <button class="btn btn-secondary" @click="pickDifferent">Pick a different profile</button>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// ── Config ────────────────────────────────────────────────────────────
// Demo endpoints are unauthenticated by design (the Jersey
// UnifiedAuthFilter allowlists /webrobot/api/demo/*).
const API_BASE = 'https://api.webrobot.eu/api'

// ── HTTP helper ───────────────────────────────────────────────────────
async function api(method, path, body) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const txt = await res.text()
  let data = null
  try { data = txt ? JSON.parse(txt) : null } catch (_) { data = { _raw: txt } }
  if (!res.ok) {
    const msg = (data && (data.exception || data.message)) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

// ── Demos list ────────────────────────────────────────────────────────
const demos          = ref([])
const loadingDemos   = ref(false)
const demosError     = ref('')
const selectedDemo   = ref(null)
const inputs         = ref({})

// ── BYOC ──────────────────────────────────────────────────────────────
// Two-way bound to <ByocModeSelector>. The component owns localStorage
// persistence for hetznerKey and the preset→vmCount derivation; we
// keep refs here so the backend POST body has the same shape the
// future BYOC provisioner expects.
const executionMode  = ref('shared')                    // 'shared' | 'byoc'
const hetznerKey     = ref('')
const vmPreset       = ref('minimal')                   // 'minimal' | 'browser' | 'etl' | 'combined' | 'custom'
const vmCount        = ref(1)                           // derived from preset
const vmRoles        = ref(['brain'])                   // derived from preset

async function loadDemos() {
  loadingDemos.value = true
  demosError.value = ''
  try {
    const data = await api('GET', '/webrobot/api/demo/agentic/list')
    demos.value = data.demos || []
  } catch (e) {
    demosError.value = e.message
  } finally {
    loadingDemos.value = false
  }
}

function onSelectDemo(d) {
  selectedDemo.value = d
  // Seed inputs with the placeholder defaults so the form looks alive.
  const seed = {}
  for (const spec of (d.inputs || [])) {
    seed[spec.name] = spec.placeholder || ''
  }
  inputs.value = seed
  execution.value = null
  runError.value = ''
  stopPolling()
}

function resetForm() {
  if (!selectedDemo.value) return
  onSelectDemo(selectedDemo.value)
}

const canRun = computed(() => {
  if (!selectedDemo.value) return false
  for (const spec of (selectedDemo.value.inputs || [])) {
    if (spec.required && !inputs.value[spec.name]) return false
  }
  if (executionMode.value === 'byoc' && !hetznerKey.value) return false
  return true
})

// ── Run ───────────────────────────────────────────────────────────────
const running   = ref(false)
const runError  = ref('')
const execution = ref(null)
let pollTimer = null

// Tracks whether the active run was launched in BYOC mode. The phase
// derivation below uses this to pick the right timeline (BYOC takes
// 2-5 min for VM provisioning + image pull; shared cluster is <30s).
// Set by onRun() at submit time; reset when the user picks a different
// profile or clicks Run again.
const activeRunIsByoc = ref(false)

// localStorage key for re-attaching to a non-terminal run after a
// browser reload. We persist a small {executionId, mode, profileName,
// startedAt} blob on submit, and on mount we rehydrate by fetching
// the row server-side. If the run is still PENDING/RUNNING we resume
// polling; if terminal we show the outcome view; if not found we
// clear stale storage.
const ACTIVE_EXEC_STORAGE_KEY = 'webrobot.agentic.activeExecution'

function persistActiveExecution(exec, mode) {
  if (!exec || !exec.executionId) return
  try {
    localStorage.setItem(ACTIVE_EXEC_STORAGE_KEY, JSON.stringify({
      executionId:  exec.executionId,
      mode:         mode,
      profileName:  exec.profileName || (selectedDemo.value && selectedDemo.value.name) || null,
      startedAt:    exec.startedAt || new Date().toISOString(),
    }))
  } catch (_) { /* localStorage may be disabled / full */ }
}

function clearActiveExecution() {
  try { localStorage.removeItem(ACTIVE_EXEC_STORAGE_KEY) } catch (_) { /* ignore */ }
}

async function restoreActiveExecution() {
  let saved
  try { saved = JSON.parse(localStorage.getItem(ACTIVE_EXEC_STORAGE_KEY) || 'null') }
  catch (_) { return }
  if (!saved || !saved.executionId) return
  // Fetch the current state from the server before deciding to
  // restore — the run may have completed or vanished while the
  // browser was closed.
  try {
    const fresh = await api('GET',
            `/webrobot/api/demo/agentic/executions/${encodeURIComponent(saved.executionId)}`)
    if (!fresh || !fresh.executionId) {
      clearActiveExecution()
      return
    }
    // Match the SPA back to the profile that started it (so the
    // detail view's labels match), best-effort.
    if (saved.profileName && Array.isArray(demos.value)) {
      const match = demos.value.find(d => d.name === saved.profileName)
      if (match) selectedDemo.value = match
    }
    execution.value = fresh
    activeRunIsByoc.value = saved.mode === 'byoc'
    // Resume polling if still in flight.
    if (!isTerminal.value) startPolling()
  } catch (e) {
    // Network glitch or 404 — drop the entry so the user isn't
    // staring at stale info next time. The detail can always be
    // re-attached via the executions list.
    clearActiveExecution()
  }
}

// Cheap wall-clock tick so the phase recomputes every 5s even when
// the row from the server hasn't changed. Without this the
// progressPhase would only update on poll refresh (4s) which is fine
// but causes the phase to lag the actual stage by up to a poll cycle.
const wallTick = ref(Date.now())
let wallTimer = null

// Human-friendly progress phase for the PENDING state. Status is
// canonical (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED) but PENDING
// hides a 2-5 min sequence of [provision VM → join k3s → label →
// pull image → start Ray]. The user staring at "PENDING" doesn't
// know if anything is happening — this caption tells them.
//
// Timeline empirically observed on cpx42 in nbg1:
//    0-15s   secret + ConfigMap (instant for shared cluster)
//   15-90s   Hetzner API create + cloud-init + SSH ready
//   90-180s  Tailscale + k3s install + LUKS setup + join cluster
//  180-240s  apply node labels + KubeRay schedules pods
//  240-300s  pull agentic-runtime image (~1 GB)
//  300s+     image pulled, Ray cluster starting → RUNNING soon
//
// For shared cluster the whole PENDING window is <30s so the
// "Setting up cluster" line is all the user sees before RUNNING.
const progressPhase = computed(() => {
  // Status comes from the polled row — keep dependency to trigger
  // recompute on poll refresh too.
  const status = execution.value?.status
  if (!status || status !== 'PENDING') return null
  if (!execution.value?.startedAt) return null

  // Re-read tick so Vue recomputes every wallTimer fire.
  void wallTick.value

  const started = new Date(execution.value.startedAt).getTime()
  if (Number.isNaN(started)) return null
  const elapsedSec = (Date.now() - started) / 1000

  if (!activeRunIsByoc.value) {
    // Shared cluster: very short PENDING window.
    if (elapsedSec < 5)  return 'Setting up cluster…'
    if (elapsedSec < 30) return 'Submitting Ray job…'
    return 'Starting Ray cluster…'
  }
  // BYOC: long PENDING window with provisioning stages.
  if (elapsedSec <  15) return 'Setting up per-execution Secret + ConfigMap…'
  if (elapsedSec <  90) return 'Provisioning ephemeral VM on your Hetzner account…'
  if (elapsedSec < 180) return 'Joining VM to k3s cluster + applying workload labels…'
  if (elapsedSec < 240) return 'Pulling agentic-runtime image on the new VM…'
  if (elapsedSec < 300) return 'Starting Ray cluster + crew actors…'
  return 'Still working — BYOC runs typically complete within 5 min, please wait…'
})

async function onRun() {
  if (!selectedDemo.value || !canRun.value) return
  running.value = true
  runError.value = ''
  // Capture BYOC flag for the phase derivation below — independent
  // of executionMode (which may change in the UI mid-run).
  activeRunIsByoc.value = executionMode.value === 'byoc'
  try {
    const body = {
      inputs:        { ...inputs.value },
      executionMode: executionMode.value,
    }
    if (executionMode.value === 'byoc') {
      // Sent only when the user explicitly opts into BYOC. Never logged
      // or echoed — the Jersey side consumes it within the provisioning
      // call and never persists it to the DB.
      body.cloudCredentials = { hetznerApiKey: hetznerKey.value }
      body.vmPreset = vmPreset.value
      body.vmCount  = vmCount.value
      body.vmRoles  = vmRoles.value
    }
    const resp = await api('POST', `/webrobot/api/demo/agentic/run/${encodeURIComponent(selectedDemo.value.name)}`, body)
    // /start returns the standard agentic response shape
    execution.value = {
      executionId: resp.executionId,
      status:      resp.status || 'PENDING',
      llmProvider: resp.llmProvider,
      startedAt:   resp.createdAt || new Date().toISOString(),
    }
    // Persist for browser reload — user can come back to a non-terminal
    // run without losing context.
    persistActiveExecution(execution.value, executionMode.value)
    startPolling()
  } catch (e) {
    runError.value = e.message
  } finally {
    running.value = false
  }
}

async function refreshExecution() {
  if (!execution.value) return
  try {
    const fresh = await api('GET', `/webrobot/api/demo/agentic/executions/${encodeURIComponent(execution.value.executionId)}`)
    execution.value = { ...execution.value, ...fresh }
  } catch (e) {
    // Soft fail — keep last known state
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await refreshExecution()
    if (isTerminal.value) stopPolling()
  }, 4000)
  // Faster phase recompute (every 5s) so the progressPhase caption
  // ticks even on poll-refresh misses.
  wallTimer = setInterval(() => { wallTick.value = Date.now() }, 5000)
  // First refresh shortly after submit so the user sees status flip from
  // SUBMITTED → PENDING/RUNNING within ~1s.
  setTimeout(refreshExecution, 1500)
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (wallTimer) { clearInterval(wallTimer); wallTimer = null }
}

const isTerminal = computed(() => {
  const s = execution.value?.status
  return s === 'COMPLETED' || s === 'FAILED' || s === 'CANCELLED'
})

function runAgain() {
  execution.value = null
  stopPolling()
  clearActiveExecution()
}
function pickDifferent() {
  execution.value = null
  selectedDemo.value = null
  inputs.value = {}
  stopPolling()
  clearActiveExecution()
}

// ── Output formatting ─────────────────────────────────────────────────
const resultNodes = computed(() => {
  const r = execution.value?.result
  if (!r) return {}
  // The runner posts result like:
  //   { session_id, node_outputs: { build: {plan, yaml_pipeline}, validate: {...} }, tokens_total }
  if (r.node_outputs && typeof r.node_outputs === 'object') return r.node_outputs
  // Backward compat: any other shape, treat as a single-node dict.
  return { result: r }
})

const totalTokens = computed(() => {
  const t = execution.value?.tokens
  if (!t || typeof t !== 'object') return null
  return t.total_tokens ?? null
})

function formatValue(v) {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) }
  catch (_) { return String(v) }
}
function formatTime(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleString() }
  catch (_) { return String(ts) }
}
function formatTokens(n) {
  if (n >= 1000) return `${(n/1000).toFixed(1)}k`
  return String(n)
}

// ── Lifecycle ─────────────────────────────────────────────────────────
onMounted(async () => {
  // Load profiles first so restoreActiveExecution can match
  // saved.profileName against a demo card for the detail view.
  await loadDemos()
  await restoreActiveExecution()
})
onUnmounted(stopPolling)
</script>

<style scoped>
.agentic-demo {
  font-family: var(--vp-font-family-base, system-ui);
  color: var(--vp-c-text-1, #1f2328);
}

.status-banner {
  background: linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%);
  border-left: 4px solid #10b981;
  color: #064e3b;
  padding: 0.9rem 1.1rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.92rem;
  line-height: 1.55;
}

.demo-section {
  margin-bottom: 2rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--vp-c-border, #d0d7de);
  border-radius: 8px;
  background: var(--vp-c-bg, #fff);
}
.demo-section h2 {
  margin-top: 0;
  font-size: 1.15rem;
  font-weight: 600;
  border-bottom: 1px solid var(--vp-c-border);
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
}
.demo-section > p {
  margin-bottom: 1rem;
  color: var(--vp-c-text-2);
  font-size: 0.92rem;
}

/* Profile cards */
.profile-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.85rem;
}
.profile-card {
  background: var(--vp-c-bg-soft, #f6f8fa);
  border: 1px solid var(--vp-c-border, #d0d7de);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: border-color 80ms, background 80ms, transform 80ms;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.profile-card:hover {
  border-color: var(--vp-c-brand-1, #0969da);
  transform: translateY(-1px);
}
.profile-card.active {
  border-color: var(--vp-c-brand-1, #0969da);
  background: rgba(9, 105, 218, 0.08);
}
.card-title {
  font-weight: 600;
  font-size: 1rem;
}
.card-tagline {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}
.card-meta {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}
.meta-pill {
  background: rgba(0, 0, 0, 0.05);
  font-size: 0.72rem;
  padding: 0.05rem 0.45rem;
  border-radius: 8px;
  color: var(--vp-c-text-2);
}
.meta-pill.version {
  font-family: var(--vp-font-family-mono, monospace);
}

/* Inputs form */
.profile-desc {
  font-style: italic;
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
}
.inputs-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.input-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.lbl {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
  font-weight: 600;
}
.required-mark {
  color: #b91c1c;
  margin-left: 0.2rem;
  font-weight: 700;
}
.input-text {
  font-family: var(--vp-font-family-base);
  font-size: 0.92rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft, #f6f8fa);
  color: inherit;
  resize: vertical;
}
.input-text:focus {
  outline: 2px solid var(--vp-c-brand-1, #0969da);
  outline-offset: -2px;
}
.input-help {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}
.form-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.4rem;
}

/* Execution */
.exec-header {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.7rem;
  margin-bottom: 0.85rem;
  padding: 0.85rem 1rem;
  background: var(--vp-c-bg-soft, #f6f8fa);
  border-radius: 6px;
  font-size: 0.9rem;
}
.exec-header > div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.exec-header code {
  font-size: 0.84rem;
  background: rgba(0,0,0,0.05);
  padding: 0 0.35rem;
  border-radius: 2px;
}
.status-pill {
  display: inline-block;
  font-size: 0.74rem;
  padding: 0.05rem 0.5rem;
  border-radius: 9px;
  font-weight: 600;
  text-transform: uppercase;
  width: fit-content;
}
.pill-completed { background: #d1fae5; color: #065f46; }
.pill-failed    { background: #fee2e2; color: #991b1b; }
.pill-cancelled { background: #fef3c7; color: #92400e; }
.pill-running, .pill-submitted { background: #dbeafe; color: #1e40af; }
.pill-pending   { background: #e5e7eb; color: #374151; }

/* Caption shown under the status pill during PENDING — gives the
 * user a sense of what stage the run is in. Computed from elapsed
 * time + BYOC flag; see progressPhase in <script>. */
.progress-phase {
  display: block;
  margin-top: 0.3rem;
  font-size: 0.78rem;
  font-style: italic;
  color: var(--vp-c-text-2);
  line-height: 1.4;
  max-width: 28rem;
}
.dark .progress-phase { color: #9ca3af; }

.progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  padding: 0.5rem 0;
}

.result-title {
  margin: 1rem 0 0.5rem;
  font-size: 1rem;
}
.result-node {
  border-left: 3px solid #10b981;
  padding-left: 0.85rem;
  margin-bottom: 1rem;
}
.result-node h4 {
  margin: 0 0 0.4rem;
  font-size: 0.92rem;
}
.result-field {
  margin-bottom: 0.6rem;
}
.field-name {
  font-size: 0.78rem;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  letter-spacing: 0.04em;
  margin-bottom: 0.15rem;
  font-weight: 600;
}
.field-value {
  background: var(--vp-c-bg-soft, #f6f8fa);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  line-height: 1.5;
  max-height: 380px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--vp-font-family-mono, monospace);
}

.raw-json {
  margin-top: 1rem;
  font-size: 0.85rem;
}
.raw-json summary {
  cursor: pointer;
  color: var(--vp-c-text-2);
  user-select: none;
}
.raw-json pre {
  margin-top: 0.5rem;
  background: var(--vp-c-bg-soft, #f6f8fa);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  padding: 0.6rem;
  font-size: 0.78rem;
  max-height: 320px;
  overflow: auto;
}

.exec-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* Shared */
.error-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 0.65rem 0.85rem;
  border-radius: 4px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.error-line {
  color: #b91c1c;
  font-size: 0.88rem;
}
.loading-row, .empty-state {
  padding: 1rem;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  font-size: 0.92rem;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 80ms, opacity 80ms;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 0.3rem 0.65rem; font-size: 0.82rem; }
.btn-primary { background: #0969da; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #0860c4; }
.btn-secondary { background: #f6f8fa; color: #24292f; border-color: #d0d7de; }
.btn-secondary:hover:not(:disabled) { background: #eaeef2; }

.spinner {
  display: inline-block;
  width: 0.85rem; height: 0.85rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Dark mode */
.dark .status-banner {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%);
  color: #6ee7b7;
  border-left-color: #10b981;
}
.dark .demo-section {
  background: rgba(255, 255, 255, 0.02);
}
.dark .profile-card.active {
  background: rgba(56, 139, 253, 0.15);
}
.dark .exec-header,
.dark .field-value,
.dark .raw-json pre,
.dark .input-text {
  background: rgba(255, 255, 255, 0.04);
}
.dark .meta-pill { background: rgba(255, 255, 255, 0.08); }
.dark .btn-secondary { background: rgba(255,255,255,0.06); color: #c9d1d9; border-color: rgba(255,255,255,0.12); }
.dark .error-box {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.3);
  color: #fca5a5;
}
.dark .pill-completed { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.dark .pill-failed    { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
.dark .pill-running, .dark .pill-submitted { background: rgba(56, 139, 253, 0.2); color: #79c0ff; }
.dark .pill-pending   { background: rgba(255,255,255,0.1); color: #c9d1d9; }
.dark .pill-cancelled { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
</style>
