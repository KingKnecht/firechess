<template>
  <div class="controls">
    <!-- Mode label -->
    <div class="mode-label">
      <span v-if="modelValue === 'stockfish'">🤖 vs Bot</span>
      <span v-else-if="modelValue === 'online'">🌐 Online</span>
      <span v-else>🏠 Local</span>
      <button class="home-link" @click="$emit('home')">← Home</button>
    </div>

    <!-- Clocks -->
    <div v-if="whiteTime !== null" class="clocks">
      <div class="clock" :class="{ active: clockRunning && clockActive === 'b', low: blackLow }">
        <span class="clock-label">♚ Black</span>
        <span class="clock-time">{{ blackTime }}</span>
      </div>
      <div class="clock" :class="{ active: clockRunning && clockActive === 'w', low: whiteLow }">
        <span class="clock-label">♔ White</span>
        <span class="clock-time">{{ whiteTime }}</span>
      </div>
    </div>

    <!-- Status banner -->
    <div class="status" :class="statusClass">{{ statusText }}</div>

    <!-- Turn indicator -->
    <div v-if="status === 'playing'" class="turn-indicator">
      <span class="dot" :class="turn === 'w' ? 'white' : 'black'" />
      <span v-if="modelValue === 'stockfish' && botThinking" class="bot-thinking">
        🤖 Bot thinking…
      </span>
      <span v-else>{{ turn === 'w' ? 'White' : 'Black' }} to move</span>
    </div>

    <!-- Player color info for bot game -->
    <div v-if="modelValue === 'stockfish' && playerColor" class="color-info">
      You play as <strong>{{ playerColor === 'w' ? '♔ White' : '♚ Black' }}</strong>
    </div>

    <!-- Online room info -->
    <div v-if="modelValue === 'online'" class="online-panel">
      <slot name="online" />
    </div>

    <!-- Action buttons -->
    <div class="actions">
      <button class="btn primary" @click="$emit('new-game')">New Game</button>
      <button class="btn" :disabled="undoDisabled" @click="$emit('undo')">
        ↩ Undo
      </button>
    </div>

    <!-- Resign / Draw buttons -->
    <div v-if="status === 'playing' && moveHistory.length > 0" class="game-actions">
      <!-- Resign -->
      <template v-if="!confirmingResign && !confirmingDraw">
        <button
          class="btn-action resign"
          :disabled="botThinking"
          @click="confirmingResign = true"
        >🏳 Resign</button>
        <button
          v-if="modelValue === 'local'"
          class="btn-action draw"
          @click="confirmingDraw = true"
        >🤝 Offer Draw</button>
      </template>

      <!-- Resign confirmation -->
      <div v-if="confirmingResign" class="confirm-strip">
        <span>Really resign?</span>
        <button class="confirm-yes" @click="doResign">Yes</button>
        <button class="confirm-no" @click="confirmingResign = false">No</button>
      </div>

      <!-- Draw confirmation -->
      <div v-if="confirmingDraw" class="confirm-strip">
        <span>Both agree to a draw?</span>
        <button class="confirm-yes" @click="doDraw">Accept</button>
        <button class="confirm-no" @click="confirmingDraw = false">Cancel</button>
      </div>
    </div>

    <!-- Move history -->
    <div class="history" ref="historyEl">
      <div class="history-header">
        <span class="history-title">Move History</span>
        <button v-if="moveHistory.length > 0" class="copy-pgn" @click="copyPgn" :title="copyTooltip">
          {{ copyTooltip }}
        </button>
      </div>
      <div v-if="moveHistory.length === 0" class="no-moves">No moves yet</div>
      <div class="move-list">
        <template v-for="(pair, i) in movePairs" :key="i">
          <span class="move-num" :class="{ 'view-num': isAtPair(i, null) }">{{ i + 1 }}.</span>
          <span
            class="move"
            :class="{ check: isCheck(pair[0]), mate: isMate(pair[0]), 'view-move': isAtPair(i, 0) }"
            @click="$emit('go-to', i * 2 + 1)"
          >{{ pair[0] }}</span>
          <span
            v-if="pair[1]"
            class="move"
            :class="{ check: isCheck(pair[1]), mate: isMate(pair[1]), 'view-move': isAtPair(i, 1) }"
            @click="$emit('go-to', i * 2 + 2)"
          >{{ pair[1] }}</span>
        </template>
      </div>

      <!-- Nav bar -->
      <div v-if="moveHistory.length > 0" class="nav-bar">
        <button class="nav-btn" :disabled="viewPos === 0" @click="$emit('go-first')" title="Start">⏮</button>
        <button class="nav-btn" :disabled="viewPos === 0" @click="$emit('go-prev')" title="Previous">◀</button>
        <span class="nav-pos">{{ viewPos === 0 ? 'Start' : `Move ${viewPos} / ${moveHistory.length}` }}</span>
        <button class="nav-btn" :disabled="!isViewingHistory" @click="$emit('go-next')" title="Next">▶</button>
        <button class="nav-btn" :disabled="!isViewingHistory" @click="$emit('go-last')" title="Current">⏭</button>
      </div>

      <div v-if="isViewingHistory" class="browsing-hint">👁 Browsing — go to current to play</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: String,
  turn: String,
  status: String,
  resignedColor: { type: String, default: null },
  moveHistory: Array,
  myColor: { type: String, default: null },
  playerColor: { type: String, default: null },
  botThinking: { type: Boolean, default: false },
  allowUndo: { type: Boolean, default: true },
  viewPos: { type: Number, default: 0 },
  isViewingHistory: { type: Boolean, default: false },
  // Clock
  whiteTime: { type: String, default: null },
  blackTime: { type: String, default: null },
  whiteLow:  { type: Boolean, default: false },
  blackLow:  { type: Boolean, default: false },
  clockActive: { type: String, default: 'w' },
  clockRunning: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:modelValue', 'new-game', 'undo', 'home',
  'resign', 'offer-draw',
  'go-first', 'go-prev', 'go-next', 'go-last', 'go-to',
])

const historyEl = ref(null)
const confirmingResign = ref(false)
const confirmingDraw   = ref(false)

// Reset confirm states when game ends
watch(() => props.status, () => {
  confirmingResign.value = false
  confirmingDraw.value = false
})

function doResign() {
  confirmingResign.value = false
  // In local mode emit current turn; in other modes emit player's color
  const color = props.modelValue === 'local' ? props.turn : props.playerColor
  emit('resign', color)
}

function doDraw() {
  confirmingDraw.value = false
  emit('offer-draw')
}

const undoDisabled = computed(() => {
  if (props.moveHistory.length === 0) return true
  if (props.modelValue === 'online') return true
  if (!props.allowUndo) return true
  // For bot games: only allow undo on player's turn, and need at least 2 moves
  if (props.modelValue === 'stockfish') {
    if (props.turn !== props.playerColor) return true
    if (props.moveHistory.length < 2) return true
  }
  return false
})


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
  if (props.status === 'resigned') {
    const winner = props.resignedColor === 'w' ? 'Black' : 'White'
    const loser  = props.resignedColor === 'w' ? 'White' : 'Black'
    return `${loser} resigned — ${winner} wins`
  }
  if (props.status === 'timeout') {
    const loser  = props.resignedColor === 'w' ? 'White' : 'Black'
    const winner = props.resignedColor === 'w' ? 'Black' : 'White'
    return `${loser} lost on time — ${winner} wins ⏱`
  }
  if (props.status === 'stalemate') return 'Stalemate — Draw'
  if (props.status === 'draw') return 'Draw 🤝'
  return ''
})

const statusClass = computed(() => {
  if (['checkmate', 'resigned', 'timeout'].includes(props.status)) return 'game-over'
  if (['stalemate', 'draw'].includes(props.status)) return 'game-draw'
  return ''
})

watch(
  () => props.moveHistory.length,
  async () => {
    await nextTick()
    if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight
  },
)

function isCheck(san) { return san && san.endsWith('+') }
function isMate(san)  { return san && san.endsWith('#') }

// Returns true if this cell in the move list is the currently viewed move
// pairIdx = row index, side = 0 (white) or 1 (black)
function isAtPair(pairIdx, side) {
  const moveNum = pairIdx * 2 + 1 + (side ?? 0)
  return props.viewPos === moveNum
}

const copyTooltip = ref('Copy PGN')

function copyPgn() {
  // Build PGN string: "1. e4 e5 2. Nf3 Nc6 ..."
  const lines = movePairs.value.map((pair, i) =>
    pair[1] ? `${i + 1}. ${pair[0]} ${pair[1]}` : `${i + 1}. ${pair[0]}`
  )
  const pgn = lines.join(' ')
  navigator.clipboard.writeText(pgn).then(() => {
    copyTooltip.value = 'Copied!'
    setTimeout(() => { copyTooltip.value = 'Copy PGN' }, 1500)
  })
}
</script>

<style scoped>
.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 220px;
  min-width: 180px;
}

.clocks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.clock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bg-surface);
  border: 2px solid transparent;
  transition: border-color 0.2s, background 0.2s;
}
.clock.active {
  border-color: #b58863;
  background: var(--bg-active);
}
.clock.low .clock-time { color: #c0392b; animation: pulse 0.6s infinite; }
.clock-label { font-size: 0.78rem; color: var(--text-muted); }
.clock-time  { font-family: monospace; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); }

.mode-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 700;
  color: #555;
}
.home-link {
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--text-muted);
}
.home-link:hover { background: var(--btn-hover); }

.color-info {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.status {
  min-height: 24px;
  text-align: center;
  font-weight: 700;
  font-size: 0.95rem;
}
.status.game-over { color: #c0392b; }
.status.game-draw { color: #27ae60; }

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

.game-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-action {
  flex: 1;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}
.btn-action.resign  { background: #f8d7da; color: #721c24; }
.btn-action.resign:hover:not(:disabled) { background: #f1aeb5; }
.btn-action.resign:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-action.draw    { background: #d1ecf1; color: #0c5460; }
.btn-action.draw:hover  { background: #b8daff; }

.confirm-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff8e1;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.8rem;
}
.confirm-strip span { flex: 1; font-weight: 600; }
.confirm-yes, .confirm-no {
  padding: 3px 10px;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.confirm-yes { background: #c0392b; color: #fff; }
.confirm-yes:hover { background: #a93226; }
.confirm-no  { background: #ddd; color: #333; }
.confirm-no:hover  { background: #bbb; }

.btn {
  flex: 1;
  padding: 8px 6px;
  border: none;
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background 0.15s;
}
.btn:hover:not(:disabled)   { background: var(--border-mid); }
.btn:disabled               { opacity: 0.4; cursor: not-allowed; }
.btn.primary                { background: #b58863; color: #fff; }
.btn.primary:hover          { background: #9a7252; }

.history {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  overflow-y: auto;
  max-height: 300px;
  background: var(--bg-surface);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.history-title { font-weight: 700; font-size: 0.85rem; color: var(--text-muted); }
.copy-pgn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.7rem;
  padding: 1px 6px;
  cursor: pointer;
  color: var(--text-muted);
}
.copy-pgn:hover { background: var(--btn-hover); }

.no-moves { color: #aaa; font-size: 0.82rem; }

.move-list {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.9;
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
  align-content: flex-start;
}
.move-num { color: #999; }
.move     { color: var(--text-primary); cursor: pointer; padding: 0 2px; border-radius: 3px; }
.move:hover { background: var(--bg-active); }
.move.check { color: #d97706; font-weight: 700; }
.move.mate  { color: #c0392b; font-weight: 700; }
.move.view-move { background: #b58863; color: #fff !important; border-radius: 3px; }

.nav-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}
.nav-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #555;
  line-height: 1;
}
.nav-btn:hover:not(:disabled) { background: #e8e8e8; }
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.nav-pos { flex: 1; text-align: center; font-size: 0.75rem; color: #666; }

.browsing-hint {
  margin-top: 4px;
  font-size: 0.72rem;
  color: #b58863;
  text-align: center;
}

.bot-thinking { font-style: italic; color: #b58863; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
</style>
