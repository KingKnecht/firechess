<template>
  <div class="lobby">
    <div v-if="!roomId">
      <button class="btn primary" :disabled="loading" @click="handleCreate">
        {{ loading ? 'Creating…' : 'Create Room' }}
      </button>
      <div class="divider">or</div>
      <div class="join-row">
        <input
          v-model="joinInput"
          placeholder="Room ID"
          maxlength="6"
          @keyup.enter="handleJoin"
        />
        <button class="btn" :disabled="loading || !joinInput" @click="handleJoin">
          Join
        </button>
      </div>
    </div>

    <div v-else class="room-info">
      <div class="room-id-label">Room ID</div>
      <div class="room-id">{{ roomId }}</div>
      <button class="btn small" @click="copyLink">
        {{ copied ? '✓ Copied!' : '📋 Copy link' }}
      </button>
      <div class="color-badge">
        You play as <strong>{{ myColor === 'w' ? 'White ♔' : 'Black ♚' }}</strong>
      </div>
      <div class="waiting" v-if="!opponentConnected">⏳ Waiting for opponent…</div>
      <div class="connected" v-else>✅ Opponent connected</div>
      <button class="btn danger" @click="$emit('leave')">Leave Room</button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  roomId: String,
  myColor: String,
  opponentConnected: Boolean,
  loading: Boolean,
  error: String,
})

const emit = defineEmits(['create', 'join', 'leave'])

const joinInput = ref('')
const copied = ref(false)

function handleCreate() { emit('create') }
function handleJoin() {
  if (joinInput.value.trim()) emit('join', joinInput.value.trim().toUpperCase())
}

async function copyLink() {
  const url = `${location.origin}${location.pathname}?room=${props.roomId}`
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // fallback: show the id
  }
}
</script>

<style scoped>
.lobby { display: flex; flex-direction: column; gap: 8px; }

.btn {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: #ddd;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.btn:hover:not(:disabled) { background: #bbb; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary  { background: #b58863; color: #fff; }
.btn.primary:hover { background: #9a7252; }
.btn.small    { padding: 5px; font-size: 0.8rem; }
.btn.danger   { background: #e74c3c; color: #fff; }
.btn.danger:hover { background: #c0392b; }

.divider { text-align: center; color: #aaa; font-size: 0.8rem; }

.join-row { display: flex; gap: 6px; }
.join-row input {
  flex: 1;
  padding: 7px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: monospace;
}

.room-info { display: flex; flex-direction: column; gap: 6px; }

.room-id-label { font-size: 0.75rem; color: #888; }
.room-id {
  font-size: 1.6rem;
  font-family: monospace;
  font-weight: 700;
  letter-spacing: 4px;
  color: #4a3728;
}

.color-badge { font-size: 0.85rem; }

.waiting  { color: #e67e22; font-size: 0.82rem; }
.connected { color: #27ae60; font-size: 0.82rem; }

.error { color: #e74c3c; font-size: 0.8rem; }
</style>
