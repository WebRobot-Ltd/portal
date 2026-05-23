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
            <span class="badge-soon">{{ byocBadge }}</span>
          </small>
        </span>
      </label>
    </fieldset>

    <div v-if="executionMode === 'byoc'" class="byoc-panel">
      <div class="byoc-disclaimer">
        <strong>🔐 About your Hetzner Cloud API token</strong>
        <ul>
          <li>
            <strong>What we allocate on your account</strong> — for each run we provision
            <strong>{{ vmCount }} × Hetzner <code>cpx42</code></strong>
            (8 vCPU AMD Epyc, 16 GB RAM, 240 GB SSD, Ubuntu 22.04)
            in <strong>nbg1</strong> (Nuremberg, EU). VMs join your run's k3s
            node group via Tailscale, then get torn down automatically when
            the job ends — even if the job fails or the browser tab closes.
          </li>
          <li>
            <strong>Estimated cost</strong> — Hetzner bills <code>cpx42</code>
            by the second at ~€0.045/h. A typical 5-minute demo run with
            {{ vmCount }} VM{{ vmCount === 1 ? '' : 's' }} costs
            <strong>~€{{ estCost }}</strong>. The cluster is in the EU
            (data sovereignty); no third-country processors in the demo
            execution path.
          </li>
          <li>
            <strong>Token usage</strong> — used <strong>only</strong> to
            provision and tear down these VMs on your account, never for
            any other operation. Transmitted over HTTPS only during the
            provisioning step of your run.
          </li>
          <li>
            <strong>Storage</strong> — saved in <strong>your browser's
            localStorage</strong> so you don't re-paste it every time.
            WebRobot servers <strong>do not persist</strong> the token; it
            lives in the Jersey JVM heap only for the duration of the
            provisioning call.
          </li>
          <li>
            You can clear it from this page any time. We recommend a
            <strong>scoped read/write token</strong> rather than your
            master one. Audit logs of provisioning calls show only the
            last 4 characters of the token (fingerprint).
          </li>
        </ul>
      </div>

      <label class="input-row">
        <span class="lbl">
          Hetzner Cloud API token
          <span class="required-mark" title="required">*</span>
          <span v-if="hetznerKey && hetznerKey === storedHetznerKey" class="saved-pill">
            saved · …{{ fingerprint }}
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
            :disabled="!hetznerKey || disabled"
            @click="clearKey"
            title="Remove from localStorage"
          >
            ✕
          </button>
        </div>
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
  // Two-way bound — parent owns the state, this component renders.
  executionMode: { type: String, default: 'shared' },  // 'shared' | 'byoc'
  hetznerKey:    { type: String, default: '' },
  // Disable interactions while a job is in flight.
  disabled:      { type: Boolean, default: false },
  // 'agentic' | 'etl' — used to namespace the localStorage key so
  // an ETL key isn't accidentally reused for the agentic flow if the
  // operator ever wants them distinct. In practice both share the
  // same underlying Hetzner credential most of the time, but we keep
  // them separate to make rotation explicit.
  context:       { type: String, default: 'agentic' },
})
const emit = defineEmits(['update:executionMode', 'update:hetznerKey'])

// ── Persisted state ──────────────────────────────────────────────────
const STORAGE_KEY = `webrobot.byoc.${props.context}.hetznerKey`
const visible = ref(false)
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

onMounted(loadFromStorage)

// Persist on changes (debounced via Vue's batching) — also saves
// when the parent assigns it programmatically.
watch(() => props.hetznerKey, (v) => {
  if (v !== storedHetznerKey.value) saveToStorage(v)
})

function onKeyInput(v) {
  emit('update:hetznerKey', v)
}
function clearKey() {
  emit('update:hetznerKey', '')
  saveToStorage('')
}

// ── Display helpers ──────────────────────────────────────────────────
const fingerprint = computed(() => {
  const k = props.hetznerKey || ''
  return k.length >= 4 ? k.slice(-4) : '••••'
})

// Per-context copy. Same disclaimer block, different subtitles.
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
  return 'Provisions ephemeral Ray worker VMs on your Hetzner account for this run, then tears them down.'
})
// Show a small "coming soon" badge whenever the backend provisioner
// hasn't landed for this context. Toggle to '' once Phase-4 ships.
const byocBadge = computed(() => 'Phase-4 — UI ready, provisioner lands next')

// VM allocation transparency. These numbers reflect what
// PreSparkExecutionProvisioner allocates today via the Ansible playbook
// in elastic-vm-ansible/infra/ansible/group_vars/all.yml:
//   hcloud_server_type: cpx42   (8 vCPU AMD, 16 GB RAM, 240 GB SSD)
//   hcloud_location: nbg1
//   hcloud_image: ubuntu-22.04
// VM count differs by workload — Spark needs a small worker pool to
// parallelise stages, Ray for the agentic demo needs one worker.
// Keep this in sync with the Java side when override params land.
const vmCount = computed(() => props.context === 'etl' ? 2 : 1)
// Hetzner cpx42 list price ~€0.045/hour, billed by the second.
// 5 min ≈ 1/12 hour. Round to 3 decimals so the disclaimer reads
// honestly without false precision.
const estCost = computed(() => {
  const HOURLY = 0.045
  const HOURS  = 5 / 60
  const total  = HOURLY * HOURS * vmCount.value
  return total.toFixed(3)
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
.radio-row input[type="radio"] {
  margin-top: 0.25rem;
}
.radio-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.radio-body strong {
  font-size: 0.95rem;
  font-weight: 600;
}
.radio-body small {
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  line-height: 1.45;
}
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
  padding: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
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
.byoc-disclaimer li {
  margin-bottom: 0.2rem;
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
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.required-mark {
  color: #b91c1c;
  font-weight: 700;
}
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

.key-row {
  display: flex;
  gap: 0.4rem;
  align-items: stretch;
}
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
.input-help {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}
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
.btn-icon:hover:not(:disabled) {
  background: var(--vp-c-bg, #fff);
}
.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Dark mode */
.dark .byoc-panel {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.35);
}
.dark .byoc-disclaimer {
  color: #fcd34d;
}
.dark .badge-soon {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}
.dark .saved-pill {
  background: rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}
.dark .input-text { background: rgba(255,255,255,0.04); }
.dark .btn-icon { background: rgba(255,255,255,0.04); }
</style>
