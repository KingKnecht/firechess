<template>
  <div class="controls">
    <!-- Mode selector -->
    <div class="mode-bar">
      <button
        v-for="m in modes"
        :key="m.value"
        :class="['mode-btn', { active: modelValue === m.value, disabled: m.disabled }]"
        :disabled="m.disabled"
        :title="m.disabled ? m.tooltip : ''"
        @click="!m.disabled && $emit('update:modelValue', m.value)"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- Status banner -->
    <div class="status" :class="statusClass">{{ statusText }}</div>

    <!-- Turn indicator -->
    <div v-if="status === 'playing'" class="turn-indicator">
      <span class="dot" :class="turn === 'w' ? 'white' : 'black'" />
      <span v-if="modelValue === 'stockfish' && turn === 'b'" class="bot-thinking">
        🤖 Bot thinking…
      </span>
      <span v-else>{{ turn === 'w' ? 'White' : 'Black' }} to move</span>
    </div>

    <!-- Online room info -->
    <div v-if="modelValue === 'online'" class="online-panel">
      <slot name="online" />
    </div>

    <!-- Action buttons -->
    <div class="actions">
      <button class="btn primary" @click="$emit('new-game')">New Game</button>
      <button class="btn" :disabled="moveHistory.length === 0 || modelValue === 'online'" @click="$emit('undo')">
        ↩ Undo
      </button>
    </div>

    <!-- Move history -->
    <div class="history" ref="historyEl">
      <div class="history-title">Move History</div>
      <div v-if="moveHistory.length === 0" class="no-moves">No moves yet</div>
      <ol class="move-list">
        <template v-for="(pair, i) in movePairs" :key="i">
          <li>
            <span class="move-num">{{ i + 1 }}.</span>
            <span class="move">{{ pair[0] }}</span>
            <span v-if="pair[1]" class="move">{{ pair[1] }}</span>
          </li>
        </template>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: String,  // current mode
  turn: String,
  status: String,
  moveHistory: Array,
  myColor: { type: String, default: null },
})

defineEmits(['update:modelValue', 'new-game', 'undo'])

const historyEl = ref(null)

const modes = [
  { value: 'local', label: '🏠 Local' },
  { value: 'online', label: '🌐 Online' },
  { value: 'stockfish', label: '🤖 vs Bot' },
]

const movePairs = computed(() => {
  const pairs = []
  for (let i = 0; i < props.moveHistory.length; i += 2) {
    pairs.push([props.moveHistory[i]?.san, props.moveHistory[i + 1]?.san])
  }
  return pairs
})

const statusText = computed(() => {
  if (props.status === 'checkmate') {
    const winner = props.turn === 'w' ? 'Black' : 'White'
    return `Checkmate! ${winner} wins 🏆`
  }
  if (props.status === 'stalemate') return 'Stalemate — Draw'
  if (props.status === 'draw') return 'Draw'
  return ''
})

const statusClass = computed(() => {
  if (['checkmate', 'stalemate', 'draw'].includes(props.status)) return 'game-over'
  return ''
})

watch(
  () => props.moveHistory.length,
  async () => {
    await nextTick()
    if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight
  },
)
</script>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 220px;
  min-width: 180px;
}

.mode-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.mode-btn {
  flex: 1;
  padding: 6px 8px;
  border: 2px solid #b58863;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.mode-btn.active  { background: #b58863; color: #fff; }
.mode-btn.disabled { opacity: 0.45; cursor: not-allowed; }
.mode-btn:not(.disabled):not(.active):hover { background: #f0d9b5; }

.status {
  min-height: 24px;
  text-align: center;
  font-weight: 700;
  font-size: 0.95rem;
}
.status.game-over { color: #c0392b; }

.turn-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid #555;
  display: inline-block;
}
.dot.white { background: #fff; }
.dot.black { background: #222; }

.online-panel { display: flex; flex-direction: column; gap: 8px; }

.actions { display: flex; gap: 8px; }

.btn {
  flex: 1;
  padding: 8px 6px;
  border: none;
  border-radius: 6px;
  background: #ddd;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.15s;
}
.btn:hover:not(:disabled)   { background: #bbb; }
.btn:disabled               { opacity: 0.4; cursor: not-allowed; }
.btn.primary                { background: #b58863; color: #fff; }
.btn.primary:hover          { background: #9a7252; }

.history {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
  overflow-y: auto;
  max-height: 300px;
  background: #fafafa;
}

.history-title { font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #555; }
.no-moves { color: #aaa; font-size: 0.82rem; }

.move-list {
  padding-left: 18px;
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.8;
}
.bot-thinking { font-style: italic; color: #b58863; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
.move-num     { color: #888; min-width: 22px; }
.move         { min-width: 46px; font-family: monospace; }
</style>
