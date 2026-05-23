<template>
  <div class="byoc-selector">

    <fieldset class="exec-mode" :disabled="disabled">
      <legend class="lbl">Execution mode</legend>
      <label class="radio-row">
        <input
          type="radio"
          :checked="executionMode === 'shared'"
          @change="$emit('update:executionMode', 'shared')"
          :disabled="disabled"
        />
        <span class="radio-body">
          <strong>Shared cluster</strong>
          <small>{{ sharedSubtitle }}</small>
        </span>
      </label>
      <label class="radio-row">
        <input
          type="radio"
          :checked="executionMode === 'byoc'"
          @change="$emit('update:executionMode', 'byoc')"
          :disabled="disabled"
        />
        <span class="radio-body">
          <strong>My own Hetzner VMs (BYOC)</strong>
          <small>
            {{ byocSubtitle }}
            <span v-if="byocBadge" class="badge-soon">{{ byocBadge }}</span>
          </small>
        </span>
      </label>
    </fieldset>

    <div v-if="executionMode === 'byoc'" class="byoc-panel">

      <!-- Step A — resource preset -->
      <div class="preset-section">
        <div class="preset-header">
          <span class="lbl">Resource preset</span>
          <small class="hint">Sized for what your run will do — pick the smallest one that fits.</small>
        </div>
        <div class="preset-options">
          <label
            v-for="p in availablePresets"
            :key="p.id"
            class="preset-option"
            :class="{ active: vmPreset === p.id, recommended: p.id === recommendedPreset }"
          >
            <input
              type="radio"
              :checked="vmPreset === p.id"
              @change="onPresetChange(p.id)"
              :disabled="disabled"
            />
            <span class="preset-body">
              <span class="preset-title">
                <strong>{{ p.label }}</strong>
                <span v-if="p.id === recommendedPreset" class="badge-rec">Recommended for this profile</span>
              </span>
              <small class="preset-desc">{{ p.description }}</small>
              <span class="preset-spec">
                <code>{{ p.vmCount }} × cpx42</code> · brain={{ p.brain }} · executor={{ p.executor }} · ~€{{ p.cost }} for 5 min
              </span>
            </span>
          </label>

          <!-- Custom -->
          <label class="preset-option" :class="{ active: vmPreset === 'custom' }">
            <input
              type="radio"
              :checked="vmPreset === 'custom'"
              @change="onPresetChange('custom')"
              :disabled="disabled"
            />
            <span class="preset-body">
              <span class="preset-title"><strong>Custom</strong></span>
              <small class="preset-desc">Power user — pick any total VM count. 1 VM is always brain, remaining are executor.</small>
              <span class="preset-spec custom-row">
                <input
                  type="number"
                  v-model.number="customCount"
                  min="1"
                  max="10"
                  :disabled="vmPreset !== 'custom' || disabled"
                  class="custom-input"
                />
                <code>× cpx42</code>
                · brain={{ customSplit.brain }} · executor={{ customSplit.executor }}
                · ~€{{ customCost }} for 5 min
              </span>
            </span>
          </label>
        </div>
      </div>

      <!-- Step B — disclaimer (uses chosen preset values) -->
      <div class="byoc-disclaimer">
        <strong>🔐 About your Hetzner Cloud API token</strong>
        <ul>
          <li>
            <strong>What we allocate on your account</strong> — for this run we provision
            <strong>{{ effectiveVmCount }} × Hetzner <code>cpx42</code></strong>
            (8 vCPU AMD Epyc, 16 GB RAM, 240 GB SSD, Ubuntu 22.04)
            in <strong>nbg1</strong> (Nuremberg, EU).
            VMs join your run's k3s node group via Tailscale.
            <template v-if="effectiveSplit.brain > 0 && effectiveSplit.executor > 0">
              Each is tagged <code>webrobot.eu/role=brain</code> or <code>webrobot.eu/role=executor</code>
              (currently <strong>{{ effectiveSplit.brain }} brain + {{ effectiveSplit.executor }} executor</strong>)
              so Ray/Camoufox land on the brain VMs and Spark executors land on the executor VMs.
            </template>
            <template v-else-if="effectiveSplit.brain > 0">
              All {{ effectiveSplit.brain }} VM{{ effectiveSplit.brain === 1 ? ' is' : 's are' }} tagged
              <code>webrobot.eu/role=brain</code> — your agentic Ray/Camoufox workload runs there.
            </template>
            <template v-else>
              All {{ effectiveSplit.executor }} VMs are tagged
              <code>webrobot.eu/role=executor</code> — Spark executor pods land on them.
            </template>
            All torn down automatically when the job ends, even on failure or browser close.
          </li>
          <li>
            <strong>Estimated cost</strong> — Hetzner bills <code>cpx42</code>
            by the second at ~€0.045/h. This run costs
            <strong>~€{{ effectiveCost }}</strong> for a 5-minute execution
            ({{ effectiveVmCount }} VM{{ effectiveVmCount === 1 ? '' : 's' }}).
            EU data sovereignty — no third-country processors in the path.
          </li>
          <li>
            <strong>Token usage</strong> — used <strong>only</strong> to
            provision the VMs at the start of your run and to tear them
            down at the end. Never re-used for anything else, never
            shared between runs. Transmitted over HTTPS.
          </li>
          <li>
            <strong>Storage</strong> — saved in <strong>your browser's
            localStorage</strong> so you don't re-paste it every time
            (clear button on the right of the field).
            On our side, the token lives only in a per-execution
            <strong>Kubernetes Secret</strong>
            (<code>hetzner-byoc-&lt;executionId&gt;</code>, RBAC-scoped to
            the provisioning Service Account) and is <strong>deleted at
            the end of your run</strong>. The token never lands in
            Postgres or any log — only the Secret's <em>name</em> is
            recorded in our audit table so we know which Secret to
            destroy alongside the VMs. A safety-net cron sweeps any
            stale Secrets after 30 min if the completion webhook missed.
          </li>
          <li>
            You can clear it from this page any time. We recommend a
            <strong>scoped read/write token</strong> rather than your
            master one. Audit logs of provisioning calls show only the
            last 4 characters of the token (fingerprint).
          </li>
        </ul>
      </div>

      <!-- Step C — Hetzner token -->
      <label class="input-row">
        <span class="lbl">
          Hetzner Cloud API token
          <span class="required-mark" title="required">*</span>
          <span v-if="hetznerKey && hetznerKey === storedHetznerKey" class="saved-pill">
            saved · …{{ fingerprint }}
          </span>
          <span
            v-if="validateStatus"
            class="validate-pill"
            :class="'validate-' + validateStatus"
          >
            <template v-if="validateStatus === 'checking'">checking…</template>
            <template v-else-if="validateStatus === 'valid'">
              ✓ valid<span v-if="validateServerCount != null"> · {{ validateServerCount }} server{{ validateServerCount === 1 ? '' : 's' }}</span>
            </template>
            <template v-else-if="validateStatus === 'invalid'">✗ invalid</template>
            <template v-else>✗ error</template>
          </span>
        </span>
        <div class="key-row">
          <input
            :value="hetznerKey"
            @input="onKeyInput($event.target.value)"
            :type="visible ? 'text' : 'password'"
            class="input-text key-input"
            placeholder="hcloud_..."
            autocomplete="off"
            spellcheck="false"
            :disabled="disabled"
          />
          <button
            type="button"
            class="btn-icon"
            @click="visible = !visible"
            :title="visible ? 'Hide' : 'Show'"
            :disabled="disabled"
          >
            {{ visible ? '🙈' : '👁' }}
          </button>
          <button
            type="button"
            class="btn-icon"
            :disabled="!hetznerKey || disabled || validateStatus === 'checking'"
            @click="validateToken"
            title="Quick check against Hetzner API"
          >
            <span v-if="validateStatus === 'checking'" class="mini-spinner"></span>
            <span v-else>✓</span>
          </button>
          <button
            type="button"
            class="btn-icon"
            :disabled="!hetznerKey || disabled"
            @click="clearKey"
            title="Remove from localStorage"
          >
            ✕
          </button>
        </div>
        <small v-if="validateMessage" class="validate-message" :class="'validate-' + validateStatus">
          {{ validateMessage }}
        </small>
        <small class="input-help">
          Get one at <a href="https://console.hetzner.cloud" target="_blank" rel="noopener noreferrer">console.hetzner.cloud</a>
          → your project → Security → API Tokens → Generate.
        </small>
      </label>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  executionMode:      { type: String, default: 'shared' },                       // 'shared' | 'byoc'
  hetznerKey:         { type: String, default: '' },
  vmPreset:           { type: String, default: 'minimal' },                      // 'minimal' | 'browser' | 'etl' | 'combined' | 'custom'
  // Recommended preset for the currently-selected profile (or null).
  // Used to highlight the right radio with a "Recommended" badge.
  recommendedPreset:  { type: String, default: null },
  disabled:           { type: Boolean, default: false },
  context:            { type: String, default: 'agentic' },                      // 'agentic' | 'etl'
})
const emit = defineEmits([
  'update:executionMode',
  'update:hetznerKey',
  'update:vmPreset',
  // Convenience for parents that want to forward to the backend without
  // re-deriving the values themselves. Fired whenever the effective
  // (preset → vmCount/vmRoles) outputs change.
  'update:vmCount',
  'update:vmRoles',
])

// ── Persisted Hetzner token (same as before) ─────────────────────────
const STORAGE_KEY = `webrobot.byoc.${props.context}.hetznerKey`
const visible = ref(false)

// Token validation state — driven by the "✓" button next to the token
// field. The endpoint is /webrobot/api/demo/byoc/validate-hetzner-token
// (under /demo/ so unauth, same posture as the run endpoint that also
// accepts an unauth BYOC token). Returns {valid, message, serverCount?}
// — we surface the boolean as a pill next to the label and the
// message as small text underneath. Resets when the token changes.
const validateStatus      = ref('')   // '' | 'checking' | 'valid' | 'invalid' | 'error'
const validateMessage     = ref('')
const validateServerCount = ref(null)
const VALIDATE_ENDPOINT   = 'https://api.webrobot.eu/api/webrobot/api/demo/byoc/validate-hetzner-token'

async function validateToken() {
  if (!props.hetznerKey || props.hetznerKey.trim() === '') return
  validateStatus.value = 'checking'
  validateMessage.value = ''
  validateServerCount.value = null
  try {
    const res = await fetch(VALIDATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hetznerApiKey: props.hetznerKey }),
    })
    if (!res.ok) {
      validateStatus.value = 'error'
      validateMessage.value = 'Validation endpoint unavailable (HTTP ' + res.status + ').'
      return
    }
    const data = await res.json()
    if (data && data.valid === true) {
      validateStatus.value = 'valid'
      validateMessage.value = data.message || 'Token is valid.'
      if (typeof data.serverCount === 'number') validateServerCount.value = data.serverCount
    } else {
      validateStatus.value = 'invalid'
      validateMessage.value = (data && data.message) || 'Token is invalid.'
    }
  } catch (e) {
    validateStatus.value = 'error'
    validateMessage.value = 'Validation request failed: ' + (e && e.message ? e.message : String(e))
  }
}
const storedHetznerKey = ref('')

function loadFromStorage() {
  try {
    const v = localStorage.getItem(STORAGE_KEY) || ''
    storedHetznerKey.value = v
    if (v && !props.hetznerKey) emit('update:hetznerKey', v)
  } catch (_) { /* localStorage unavailable */ }
}
function saveToStorage(v) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, v)
    else   localStorage.removeItem(STORAGE_KEY)
    storedHetznerKey.value = v
  } catch (_) { /* ignore */ }
}

onMounted(() => {
  loadFromStorage()
  // If parent didn't seed vmPreset, pick the recommendedPreset or fall
  // back to the per-context default. We do this on mount, not at
  // construction, so the parent has a chance to v-model in first.
  if (!props.vmPreset || props.vmPreset === 'minimal') {
    const fallback = props.recommendedPreset || defaultPresetForContext.value
    if (fallback !== props.vmPreset) emit('update:vmPreset', fallback)
  }
})

watch(() => props.hetznerKey, (v) => {
  if (v !== storedHetznerKey.value) saveToStorage(v)
})

// When the parent updates recommendedPreset (because the user picked a
// different profile), follow it — unless the user has already
// customised away from the suggested default.
let userTouchedPreset = false
watch(() => props.recommendedPreset, (newRec) => {
  if (newRec && !userTouchedPreset && newRec !== props.vmPreset) {
    emit('update:vmPreset', newRec)
  }
})

function onPresetChange(p) {
  userTouchedPreset = true
  emit('update:vmPreset', p)
}
function onKeyInput(v) {
  emit('update:hetznerKey', v)
  // Reset validation when the token changes — what's valid for an
  // old token may not be for a new one.
  validateStatus.value = ''
  validateMessage.value = ''
  validateServerCount.value = null
}
function clearKey() {
  emit('update:hetznerKey', '')
  saveToStorage('')
}

// ── Preset catalog ───────────────────────────────────────────────────
// Each preset maps to (vmCount, brainCount, executorCount). brainCount
// is always min(1, vmCount) when the workload uses Ray/Camoufox;
// executorCount is the rest. The Java side (PreSparkProvisionRequest)
// recomputes vmRoles from the same rules, so the frontend and backend
// must agree on the breakdown — keep the table in sync if you add a
// new preset.
// Preset visibility per context — keep the list tight to what makes
// sense on each page so the user doesn't have to mentally dismiss
// irrelevant options. The /demo page runs Spark directly (no
// agentic Ray to orchestrate), so the Combined preset is hidden
// there. The /agentic page gets the full menu because an agentic
// profile may or may not involve browser/Spark depending on its
// crew composition.
const PRESETS = [
  {
    id: 'minimal',
    label: 'Minimal — agentic only',
    description: 'LLM-only profiles like webrobot-etl-builder or smoke-hello. No browser, no Spark sub-job.',
    vmCount: 1, brain: 1, executor: 0,
    contexts: ['agentic'],
  },
  {
    id: 'browser',
    label: 'With browser',
    description: 'Profiles using browser_tool_actor (Camoufox + browser-use). Ray + Camoufox share the brain VMs.',
    vmCount: 2, brain: 2, executor: 0,
    contexts: ['agentic'],
  },
  {
    id: 'etl',
    label: 'ETL pipeline',
    description: 'Spark-only pipeline run, as on the /demo page today. All VMs are executors.',
    vmCount: 2, brain: 0, executor: 2,
    contexts: ['etl'],
  },
  {
    id: 'combined',
    label: 'Combined — agentic spawns Spark',
    description: 'Pattern 4: the agentic profile generates a manifest then executes it as a Spark sub-job. 1 brain VM (Ray + Camoufox) + 3 executor VMs (Spark).',
    vmCount: 4, brain: 1, executor: 3,
    contexts: ['agentic'],   // not on ETL — that page can't spawn agentic from below
  },
]

const availablePresets = computed(() =>
  PRESETS.filter(p => p.contexts.includes(props.context))
)

// Hourly price per cpx42 (rounded for display)
const CPX42_HOURLY = 0.045
const RUN_HOURS = 5 / 60  // assume ~5 min reference

function costForCount(n) {
  return (n * CPX42_HOURLY * RUN_HOURS).toFixed(3)
}
// Attach .cost to each preset for the template.
for (const p of PRESETS) p.cost = costForCount(p.vmCount)

// ── Custom preset ────────────────────────────────────────────────────
const customCount = ref(3)
const customSplit = computed(() => {
  const n = Math.max(1, Math.min(10, Number(customCount.value) || 1))
  // Convention: always 1 brain if the context wants one. For 'etl'
  // context the brain is 0 — user implicitly running pure Spark.
  const wantsBrain = props.context === 'agentic'
  const brain = wantsBrain ? 1 : 0
  const executor = Math.max(0, n - brain)
  return { vmCount: n, brain, executor }
})
const customCost = computed(() => costForCount(customSplit.value.vmCount))

// ── Effective values (chosen preset or custom) ───────────────────────
const effectivePresetEntry = computed(() => {
  if (props.vmPreset === 'custom') return null
  return PRESETS.find(p => p.id === props.vmPreset) || PRESETS[0]
})
const effectiveVmCount = computed(() =>
  props.vmPreset === 'custom' ? customSplit.value.vmCount : (effectivePresetEntry.value?.vmCount ?? 1)
)
const effectiveSplit = computed(() => {
  if (props.vmPreset === 'custom') return customSplit.value
  const p = effectivePresetEntry.value || PRESETS[0]
  return { vmCount: p.vmCount, brain: p.brain, executor: p.executor }
})
const effectiveCost = computed(() => costForCount(effectiveVmCount.value))

// Emit derived values whenever they change. Parent treats these as
// read-only "what would be sent to the backend".
watch([effectiveVmCount, effectiveSplit], () => {
  emit('update:vmCount', effectiveVmCount.value)
  emit('update:vmRoles', buildVmRoles(effectiveSplit.value))
}, { immediate: true })

// vmRoles array: [brain, brain, executor, executor, ...]
// Order matters — Ansible iterates this when labeling nodes post-join.
// We always put brain entries first so VM #0 is the brain when there
// is one. Keep in lockstep with the Java side.
function buildVmRoles(split) {
  const roles = []
  for (let i = 0; i < split.brain; i++) roles.push('brain')
  for (let i = 0; i < split.executor; i++) roles.push('executor')
  return roles
}

// ── Display copy ─────────────────────────────────────────────────────
const sharedSubtitle = computed(() => {
  if (props.context === 'etl') {
    return 'Run on the WebRobot demo Spark cluster (EU, Hetzner). Free, no credentials needed.'
  }
  return 'Run on the WebRobot demo Ray cluster (EU, Hetzner). Free, no credentials needed.'
})
const byocSubtitle = computed(() => {
  if (props.context === 'etl') {
    return 'Provisions ephemeral Spark worker VMs on your Hetzner account for this run, then tears them down.'
  }
  return 'Provisions ephemeral Ray/Camoufox/Spark VMs on your Hetzner account for this run (split by workload class), then tears them down.'
})
// Backend provisioner lifecycle: wired end-to-end for both contexts.
//   agentic: core-library 8d5a727 + webrobot-etl-api 82434355 / 38a614ca / 0c1944b0
//   etl:     webrobot-etl-api 139c7699 (DemoPlugin/DemoService/ProjectServiceImpl
//            BYOC branch reusing the existing elastic-VM provisioner)
// No badge in either context.
const byocBadge = computed(() => '')

const defaultPresetForContext = computed(() =>
  props.context === 'etl' ? 'etl' : 'minimal'
)

const fingerprint = computed(() => {
  const k = props.hetznerKey || ''
  return k.length >= 4 ? k.slice(-4) : '••••'
})
</script>

<style scoped>
.byoc-selector {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 0.5rem;
}

.exec-mode {
  border: 1px solid var(--vp-c-border, #d0d7de);
  border-radius: 6px;
  padding: 0.5rem 0.9rem 0.7rem;
  margin: 0;
}
.exec-mode legend {
  padding: 0 0.4rem;
  font-size: 0.74rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}
.radio-row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.45rem 0;
  cursor: pointer;
}
.radio-row input[type="radio"] { margin-top: 0.25rem; }
.radio-body { display: flex; flex-direction: column; gap: 0.15rem; }
.radio-body strong { font-size: 0.95rem; font-weight: 600; }
.radio-body small { font-size: 0.82rem; color: var(--vp-c-text-2); line-height: 1.45; }
.badge-soon {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  padding: 0.05rem 0.4rem;
  margin-left: 0.4rem;
  border-radius: 8px;
  font-weight: 600;
  vertical-align: middle;
}

.byoc-panel {
  border: 1px solid #fde68a;
  background: rgba(254, 243, 199, 0.35);
  border-radius: 6px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

/* Preset section */
.preset-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.preset-header { display: flex; align-items: baseline; gap: 0.8rem; flex-wrap: wrap; }
.preset-header .hint { color: var(--vp-c-text-2); font-size: 0.8rem; }
.preset-options {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.preset-option {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--vp-c-border, #d0d7de);
  border-radius: 4px;
  background: var(--vp-c-bg, #fff);
  cursor: pointer;
  transition: border-color 80ms, background 80ms;
}
.preset-option:hover { border-color: var(--vp-c-brand-1, #0969da); }
.preset-option.active {
  border-color: var(--vp-c-brand-1, #0969da);
  background: rgba(9, 105, 218, 0.06);
}
.preset-option.recommended {
  /* Soft highlight on the radio recommended by the chosen profile */
  border-color: #10b981;
}
.preset-option.active.recommended {
  background: rgba(16, 185, 129, 0.08);
}
.preset-option input[type="radio"] { margin-top: 0.3rem; }
.preset-body { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
.preset-title { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.preset-title strong { font-size: 0.93rem; font-weight: 600; }
.preset-desc { font-size: 0.82rem; color: var(--vp-c-text-2); line-height: 1.45; }
.preset-spec {
  font-size: 0.82rem;
  color: var(--vp-c-text-1);
  margin-top: 0.15rem;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.preset-spec code {
  background: rgba(0,0,0,0.05);
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
  font-size: 0.8rem;
}
.badge-rec {
  background: #d1fae5;
  color: #065f46;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.05rem 0.45rem;
  border-radius: 8px;
}
.custom-row { gap: 0.4rem; }
.custom-input {
  width: 60px;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 3px;
  background: var(--vp-c-bg, #fff);
  font-size: 0.82rem;
}

.byoc-disclaimer {
  font-size: 0.85rem;
  line-height: 1.55;
  color: #78350f;
}
.byoc-disclaimer ul {
  margin: 0.4rem 0 0;
  padding-left: 1.2rem;
}
.byoc-disclaimer li { margin-bottom: 0.2rem; }

.input-row { display: flex; flex-direction: column; gap: 0.25rem; }
.lbl {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.required-mark { color: #b91c1c; font-weight: 700; }
.saved-pill {
  text-transform: none;
  background: #d1fae5;
  color: #065f46;
  font-size: 0.7rem;
  letter-spacing: 0;
  padding: 0.05rem 0.4rem;
  border-radius: 8px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono, monospace);
}

.key-row { display: flex; gap: 0.4rem; align-items: stretch; }
.validate-pill {
  text-transform: none;
  font-size: 0.7rem;
  letter-spacing: 0;
  padding: 0.05rem 0.4rem;
  border-radius: 8px;
  font-weight: 600;
  font-family: var(--vp-font-family-mono, monospace);
  margin-left: 0.3rem;
}
.validate-pill.validate-checking { background: #dbeafe; color: #1e40af; }
.validate-pill.validate-valid    { background: #d1fae5; color: #065f46; }
.validate-pill.validate-invalid  { background: #fee2e2; color: #991b1b; }
.validate-pill.validate-error    { background: #fef3c7; color: #92400e; }
.validate-message {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.78rem;
}
.validate-message.validate-valid   { color: #065f46; }
.validate-message.validate-invalid { color: #991b1b; }
.validate-message.validate-error   { color: #92400e; }
.mini-spinner {
  display: inline-block;
  width: 0.7rem; height: 0.7rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.input-text {
  flex: 1;
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 0.9rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg, #fff);
  color: inherit;
}
.input-text:focus {
  outline: 2px solid var(--vp-c-brand-1, #0969da);
  outline-offset: -2px;
}
.input-help { font-size: 0.78rem; color: var(--vp-c-text-2); }
.btn-icon {
  background: var(--vp-c-bg-soft, #f6f8fa);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  padding: 0 0.7rem;
  cursor: pointer;
  font-size: 1rem;
  color: inherit;
  line-height: 1;
}
.btn-icon:hover:not(:disabled) { background: var(--vp-c-bg, #fff); }
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

/* Dark mode */
.dark .byoc-panel {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.35);
}
.dark .byoc-disclaimer { color: #fcd34d; }
.dark .badge-soon { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
.dark .saved-pill { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.dark .validate-pill.validate-checking { background: rgba(56, 139, 253, 0.2); color: #79c0ff; }
.dark .validate-pill.validate-valid    { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.dark .validate-pill.validate-invalid  { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
.dark .validate-pill.validate-error    { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
.dark .validate-message.validate-valid   { color: #6ee7b7; }
.dark .validate-message.validate-invalid { color: #fca5a5; }
.dark .validate-message.validate-error   { color: #fcd34d; }
.dark .badge-rec { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
.dark .input-text { background: rgba(255,255,255,0.04); }
.dark .btn-icon { background: rgba(255,255,255,0.04); }
.dark .preset-option {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.12);
}
.dark .preset-option.active {
  background: rgba(56, 139, 253, 0.15);
  border-color: #58a6ff;
}
.dark .preset-option.active.recommended {
  background: rgba(16, 185, 129, 0.15);
  border-color: #6ee7b7;
}
.dark .preset-spec code { background: rgba(255,255,255,0.06); }
.dark .custom-input { background: rgba(255,255,255,0.04); }
</style>
