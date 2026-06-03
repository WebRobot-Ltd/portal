<script setup>
// WebRobot AI Data Engineer — chat (Agent SDK runtime + live WebRobot MCP).
// Talks to the standalone chat_server (SSE /chat). Experimental / WIP.
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'

// Chat-server base URL. Override at build via VITE_AGENT_CHAT_API, else default.
const CHAT_API = (import.meta?.env?.VITE_AGENT_CHAT_API) || 'https://agent.webrobot.eu'
// Gate token (Bearer) — the chat server requires a bearer (beta abuse gate; the
// reply consumes Anthropic tokens). For this public beta it's a shared static
// token, overridable at build via VITE_AGENT_CHAT_GATE. Not real auth — the
// per-session rate limit + idle reaper are the actual guardrails.
const GATE = (import.meta?.env?.VITE_AGENT_CHAT_GATE) || 'webrobot-portal-beta-gate-0001'

const sessionId = 'web-' + Math.random().toString(36).slice(2, 10)
const input = ref('')
// Optional BYOC: the user's own Claude subscription OAuth token (claude
// setup-token). Kept only in sessionStorage (this tab) + sent per turn; the
// server holds it in memory for the session. Empty → server's shared token.
const token = ref(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('wr_oauth') || '') : '')
const showToken = ref(false)
function saveToken() {
  try { token.value ? sessionStorage.setItem('wr_oauth', token.value) : sessionStorage.removeItem('wr_oauth') } catch (_) {}
}
const busy = ref(false)
const log = ref([])          // {role:'user'|'ai', text}
const logEl = ref(null)

function scroll() { nextTick(() => { if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight }) }

async function send() {
  const msg = input.value.trim()
  if (!msg || busy.value) return
  input.value = ''
  log.value.push({ role: 'user', text: msg })
  const ai = { role: 'ai', text: '' }
  log.value.push(ai)
  busy.value = true
  scroll()
  try {
    const r = await fetch(`${CHAT_API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GATE}` },
      body: JSON.stringify({ sessionId, message: msg, oauthToken: token.value || undefined }),
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
        } else if (frame.startsWith('event: error')) {
          const raw = frame.split('data: ')[1] || '"error"'
          let m; try { m = JSON.parse(raw) } catch (_) { m = raw }
          ai.text += `\n⚠️ ${m}`
        }
      }
    }
  } catch (e) {
    ai.text += `\n⚠️ ${e?.message || 'network error — chat server unreachable'}`
  } finally {
    busy.value = false; scroll()
  }
}

// Signal the chat server to tear down the session's Ray actor when the user
// leaves (tab close / navigation / component unmount). Best-effort, keepalive
// so it still fires during unload. The idle reaper is the server-side backstop.
function endSession() {
  try {
    fetch(`${CHAT_API}/chat/end`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {})
  } catch (_) {}
}
onMounted(() => { window.addEventListener('beforeunload', endSession) })
onBeforeUnmount(() => { window.removeEventListener('beforeunload', endSession); endSession() })
</script>

<template>
  <div class="agent-chat">
    <div class="wip">
      🚧 <strong>Agentic chat — work in progress.</strong>
      Experiment on the Claude Agent SDK runtime connected to the WebRobot MCP.
      Results are experimental and <strong>not guaranteed</strong>.
    </div>

    <div class="head">
      🤖 <strong>WebRobot — AI Data Engineer</strong>
      <span class="muted">Agent SDK + live MCP</span>
      <button class="byoc-toggle" @click="showToken = !showToken">
        {{ token ? '🔑 your token' : '🔑 use your plan' }}
      </button>
    </div>

    <div v-if="showToken" class="byoc">
      <input type="password" v-model="token" @input="saveToken"
             placeholder="Your Claude OAuth token (claude setup-token) — optional, BYOC" />
      <span class="muted small">Kept only in this browser tab + your chat session; runs on your own plan. Leave empty to use the shared demo token.</span>
    </div>

    <div ref="logEl" class="log">
      <div v-if="!log.length" class="muted empty">
        Ask something, e.g. “List the WebRobot ETL stages and summarize 5 of them”,
        or “Draft a pipeline to scrape titles and prices from an e-commerce site”.
      </div>
      <div v-for="(m, i) in log" :key="i" :class="['msg', m.role]">
        <span class="who">{{ m.role === 'user' ? 'You' : 'AI' }}</span>
        <span class="text">{{ m.text || (busy && i === log.length - 1 ? '…' : '') }}</span>
      </div>
    </div>

    <div class="row">
      <input v-model="input" :disabled="busy" autofocus
             placeholder="Type a message…" @keydown.enter="send" />
      <button :disabled="busy || !input.trim()" @click="send">
        {{ busy ? '…' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.agent-chat { max-width: 820px; margin: 0 auto; font: 14px/1.5 system-ui, sans-serif; }
.wip { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; border-radius: 8px;
       padding: 10px 12px; margin-bottom: 12px; font-size: 13px; }
.head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.muted { color: #6b7280; font-weight: 400; }
.byoc-toggle { margin-left: auto; border: 1px solid #d4d7e2; background: #f8fafc; border-radius: 999px;
               padding: 3px 10px; font-size: 12px; cursor: pointer; color: #4f46e5; }
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
</style>
