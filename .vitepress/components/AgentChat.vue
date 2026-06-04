<script setup>
// WebRobot AI Data Engineer — chat (Agent SDK runtime + live WebRobot MCP).
// Talks to the standalone chat_server (SSE /chat). Experimental / WIP.
import { ref, nextTick, onMounted } from 'vue'

// Chat-server base URL. Override at build via VITE_AGENT_CHAT_API, else default.
const CHAT_API = (import.meta?.env?.VITE_AGENT_CHAT_API) || 'https://agent.webrobot.eu'
// Gate token (Bearer) — the chat server requires a bearer (beta abuse gate; the
// reply consumes Anthropic tokens). For this public beta it's a shared static
// token, overridable at build via VITE_AGENT_CHAT_GATE. Not real auth — the
// per-session rate limit + idle reaper are the actual guardrails.
const GATE = (import.meta?.env?.VITE_AGENT_CHAT_GATE) || 'webrobot-portal-beta-gate-0001'

// Session + history persist in localStorage so a reload keeps the conversation.
// We never auto-clear it — only the explicit "Clear" button starts fresh.
const SID_KEY = 'wr_chat_sid', LOG_KEY = 'wr_chat_log'
const newSid = () => 'web-' + Math.random().toString(36).slice(2, 10)
function loadSid() {
  try {
    let s = localStorage.getItem(SID_KEY)
    if (!s) { s = newSid(); localStorage.setItem(SID_KEY, s) }
    return s
  } catch (_) { return newSid() }
}
const sessionId = ref(loadSid())
const input = ref('')
// Persona/profile (data-engineer + founders). Loaded from the server; persisted.
// Switching persona starts a fresh session (the agent binds the persona per session).
const profiles = ref([])
const profile = ref(typeof localStorage !== 'undefined' ? (localStorage.getItem('wr_profile') || '') : '')
// Optional BYOC: the user's own Claude subscription OAuth token (claude
// setup-token). Kept only in sessionStorage (this tab) + sent per turn; the
// server holds it in memory for the session. Empty → server's shared token.
const token = ref(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('wr_oauth') || '') : '')
const showToken = ref(false)
function saveToken() {
  try { token.value ? sessionStorage.setItem('wr_oauth', token.value) : sessionStorage.removeItem('wr_oauth') } catch (_) {}
}
// Optional BYOC: the user's own Hetzner API token, to run jobs on their own
// ephemeral VMs. Kept ONLY in sessionStorage + sent as a separate body field
// (never typed into the message → never in the saved transcript). The agent
// uses it only for a BYOC run after you confirm; it's never echoed/logged.
const hetzner = ref(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('wr_hetzner') || '') : '')
function saveHetzner() {
  try { hetzner.value ? sessionStorage.setItem('wr_hetzner', hetzner.value) : sessionStorage.removeItem('wr_hetzner') } catch (_) {}
}
const busy = ref(false)
const log = ref([])          // {role:'user'|'ai', text}
const logEl = ref(null)

function scroll() { nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight }) }
function persist() { try { localStorage.setItem(LOG_KEY, JSON.stringify(log.value)) } catch (_) {} }

// Token usage (Claude-Code style): last turn + cumulative session totals.
const usage = ref(null)
const totIn = ref(0), totOut = ref(0), totCost = ref(0)
function applyUsage(u) {
  usage.value = u
  totIn.value  += (u.input  || 0) + (u.cache_read || 0) + (u.cache_write || 0)
  totOut.value += (u.output || 0)
  totCost.value += (u.cost_usd || 0)
}

let abortCtrl = null
function stop() { if (abortCtrl) abortCtrl.abort() }

async function send() {
  const msg = input.value.trim()
  if (!msg) return
  if (busy.value && abortCtrl) abortCtrl.abort()   // sending while busy → stop the current turn first
  input.value = ''
  log.value.push({ role: 'user', text: msg })
  const ai = { role: 'ai', text: '' }
  log.value.push(ai)
  const ctrl = new AbortController(); abortCtrl = ctrl
  busy.value = true
  scroll()
  try {
    const r = await fetch(`${CHAT_API}/chat`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATE}` },
      body: JSON.stringify({ sessionId: sessionId.value, message: msg,
                             profile: profile.value || undefined,
                             oauthToken: token.value || undefined,
                             hetznerToken: hetzner.value || undefined }),
    })
    if (!r.ok || !r.body) { ai.text = `⚠️ chat server error (${r.status})`; return }
    const reader = r.body.getReader(), dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let p
      while ((p = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, p); buf = buf.slice(p + 2)
        if (frame.startsWith('data: ')) {
          // Backend JSON-encodes each chunk so newlines don't break framing.
          const raw = frame.slice(6)
          let piece; try { piece = JSON.parse(raw) } catch (_) { piece = raw }
          ai.text += piece; scroll()
        } else if (frame.startsWith('event: usage')) {
          const raw = frame.split('data: ')[1] || '{}'
          try { applyUsage(JSON.parse(raw)) } catch (_) {}
        } else if (frame.startsWith('event: error')) {
          const raw = frame.split('data: ')[1] || '"error"'
          let m; try { m = JSON.parse(raw) } catch (_) { m = raw }
          ai.text += `\n⚠️ ${m}`
        }
      }
    }
  } catch (e) {
    if (e?.name !== 'AbortError')   // abort = user stopped/redirected → not an error
      ai.text += `\n⚠️ ${e?.message || 'network error — chat server unreachable'}`
  } finally {
    if (abortCtrl === ctrl) { busy.value = false; abortCtrl = null }  // only the latest turn clears busy
    scroll(); persist()
  }
}

// Tell the chat server to tear down the session's agent. Called ONLY from the
// explicit Clear — NOT on tab-close/unmount, so a reload keeps the conversation
// alive (the server's idle reaper is the eventual backstop).
function endSession(sid) {
  try {
    fetch(`${CHAT_API}/chat/end`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    }).catch(() => {})
  } catch (_) {}
}

// Explicit reset: end the current backend session, wipe the saved history, and
// start a fresh session. The only thing that clears the chat.
function clearChat() {
  if (busy.value) return
  endSession(sessionId.value)
  log.value = []
  usage.value = null; totIn.value = 0; totOut.value = 0; totCost.value = 0
  sessionId.value = newSid()
  try {
    localStorage.setItem(SID_KEY, sessionId.value)
    localStorage.removeItem(LOG_KEY)
  } catch (_) {}
  input.value = ''
}

// Switching persona = fresh session (the backend binds the persona on the first
// message of a session). Persist the choice + clear the chat.
function onProfileChange() {
  try { localStorage.setItem('wr_profile', profile.value) } catch (_) {}
  clearChat()
}

// Restore the saved conversation + load the selectable personas.
onMounted(async () => {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    if (raw) { log.value = JSON.parse(raw) || []; scroll() }
  } catch (_) {}
  try {
    const r = await fetch(`${CHAT_API}/profiles`)
    if (r.ok) {
      const d = await r.json()
      profiles.value = d.profiles || []
      if (!profile.value) profile.value = d.default || (profiles.value[0]?.id || '')
    }
  } catch (_) {}
})
</script>

<template>
  <div class="agent-chat">
    <div class="wip">
      🚧 <strong>Agentic chat — work in progress.</strong>
      Experiment on the Claude Agent SDK runtime connected to the WebRobot MCP.
      Results are experimental and <strong>not guaranteed</strong>.
    </div>

    <div class="head">
      🤖 <strong>WebRobot</strong>
      <select v-if="profiles.length" v-model="profile" @change="onProfileChange"
              :disabled="busy" class="profile-sel" title="Choose who you talk to">
        <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
      <span v-if="busy" class="working">● working…</span>
      <button class="byoc-toggle" @click="showToken = !showToken">
        {{ token ? '🔑 your token' : '🔑 use your plan' }}
      </button>
      <button class="clear-btn" :disabled="busy || !log.length" @click="clearChat"
              title="Clear the conversation and start a new session">
        🗑 Clear
      </button>
    </div>

    <div v-if="showToken" class="byoc">
      <input type="password" v-model="token" @input="saveToken"
             placeholder="Your Claude OAuth token (claude setup-token) — optional, BYOC" />
      <span class="muted small">Kept only in this browser tab + your chat session; runs on your own plan. Leave empty to use the shared demo token.</span>
      <input type="password" v-model="hetzner" @input="saveHetzner"
             placeholder="Your Hetzner API token — optional, to run jobs on your own VMs (BYOC)" />
      <span class="muted small">Only used to launch ephemeral Ray/Spark jobs on your Hetzner account after you confirm. Kept in this tab only, never shown in the chat, never logged.</span>
    </div>

    <div ref="logEl" class="log">
      <div v-if="!log.length" class="muted empty">
        Ask something, e.g. “List the WebRobot ETL stages and summarize 5 of them”,
        or “Draft a pipeline to scrape titles and prices from an e-commerce site”.
      </div>
      <div v-for="(m, i) in log" :key="i" :class="['msg', m.role]">
        <span class="who">{{ m.role === 'user' ? 'You' : 'AI' }}</span>
        <span v-if="m.text" class="text">{{ m.text }}</span>
        <span v-else-if="busy && i === log.length - 1" class="typing" title="The AI is working…">
          <i></i><i></i><i></i>
        </span>
      </div>
    </div>

    <div class="row">
      <input v-model="input" autofocus
             placeholder="Type a message… (Enter sends; sending while busy stops the current reply)"
             @keydown.enter="send" />
      <button v-if="busy" class="stop-btn" @click="stop" title="Stop the current reply">⏹ Stop</button>
      <button :disabled="!input.trim()" @click="send">Send</button>
    </div>

    <div v-if="usage || totOut" class="usage">
      <span v-if="usage">last turn: {{ (usage.input||0)+(usage.cache_read||0)+(usage.cache_write||0) }} in → {{ usage.output||0 }} out</span>
      <span class="muted"> · session: {{ totIn + totOut }} tokens<span v-if="totCost"> · ≈${{ totCost.toFixed(4) }} est.</span></span>
      <span class="muted"> · on Claude subscription (no per-token charge)</span>
    </div>
  </div>
</template>

<style scoped>
.agent-chat { max-width: 820px; margin: 0 auto; padding: 0 16px; box-sizing: border-box;
              font: 14px/1.5 system-ui, sans-serif; }
.agent-chat *, .agent-chat *::before, .agent-chat *::after { box-sizing: border-box; }
.wip { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; border-radius: 8px;
       padding: 10px 12px; margin-bottom: 12px; font-size: 13px; }
.head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.muted { color: #6b7280; font-weight: 400; }
.profile-sel { border: 1px solid #d4d7e2; background: #fff; border-radius: 8px; padding: 3px 8px;
               font: inherit; font-size: 12.5px; color: #4f46e5; cursor: pointer; max-width: 230px; }
.byoc-toggle { margin-left: auto; border: 1px solid #d4d7e2; background: #f8fafc; border-radius: 999px;
               padding: 3px 10px; font-size: 12px; cursor: pointer; color: #4f46e5; }
.clear-btn { border: 1px solid #e7d4d4; background: #fdf6f6; border-radius: 999px;
             padding: 3px 10px; font-size: 12px; cursor: pointer; color: #b91c1c; }
.clear-btn:disabled { opacity: .5; cursor: not-allowed; }
.byoc { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.byoc input { width: 100%; padding: 8px 10px; border: 1px solid #d4d7e2; border-radius: 8px; font: inherit; }
.small { font-size: 11.5px; }
.log { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; height: 56vh;
       overflow-y: auto; background: #fff; }
.empty { padding: 8px 0; }
.msg { margin: 8px 0; white-space: pre-wrap; }
.msg .who { display: inline-block; font-weight: 700; margin-right: 6px; }
.msg.user .who { color: #4f46e5; }
.msg.ai .who { color: #111827; }
.row { display: flex; gap: 8px; margin-top: 10px; }
.row input { flex: 1; padding: 10px 12px; border: 1px solid #d4d7e2; border-radius: 8px; font: inherit; }
.row button { padding: 10px 18px; border: 0; border-radius: 8px; cursor: pointer;
              background: linear-gradient(135deg,#5b54ec,#7c4fb5); color: #fff; font-weight: 600; }
.row button:disabled { opacity: .55; cursor: not-allowed; }
.stop-btn { background: #fdf6f6 !important; color: #b91c1c !important; border: 1px solid #e7d4d4 !important; }
.working { color: #5b54ec; font-weight: 600; font-size: 12.5px; animation: wr-pulse 1.2s ease-in-out infinite; }
@keyframes wr-pulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
.typing { display: inline-flex; gap: 4px; align-items: center; padding: 4px 0; }
.typing i { width: 7px; height: 7px; border-radius: 50%; background: #9aa0b4; display: inline-block;
            animation: wr-bounce 1.2s infinite ease-in-out both; }
.typing i:nth-child(1) { animation-delay: -0.24s } .typing i:nth-child(2) { animation-delay: -0.12s }
@keyframes wr-bounce { 0%,80%,100% { transform: scale(.6); opacity: .5 } 40% { transform: scale(1); opacity: 1 } }
.usage { margin-top: 6px; font-size: 11.5px; color: #6b7280; text-align: right; }

/* ── Mobile ─────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .agent-chat { padding: 0 12px; }
  .head { gap: 6px; }
  .head strong { font-size: 14px; }
  .byoc-toggle, .clear-btn { padding: 4px 10px; }          /* easier tap targets */
  .log { height: 58vh; padding: 11px; }
  .msg { margin: 10px 0; }
  .row { flex-wrap: wrap; }
  .row input { flex: 1 1 100%; padding: 12px; font-size: 16px; }  /* 16px avoids iOS zoom */
  .row button { flex: 1 1 auto; padding: 11px 16px; }
  .usage { text-align: left; }
}
</style>
