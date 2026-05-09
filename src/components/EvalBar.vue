<template>
  <div class="eval-bar-wrapper">
    <!-- Vertical bar -->
    <div class="eval-bar" :title="tooltip">
      <div class="black-side" :style="{ height: blackPercent + '%' }" />
      <div class="white-side" :style="{ height: whitePercent + '%' }" />
    </div>

    <!-- Score label -->
    <div class="eval-label" :class="{ mate: isMate }">
      <span v-if="evaluating" class="spinner">⋯</span>
      <span v-else-if="score">{{ score }}</span>
      <span v-else class="na">—</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: String,    // '+0.4', '-1.2', '#3', '#-2', null
  depth: Number,
  source: String,   // 'lichess' | 'stockfish'
  evaluating: Boolean,
})

const isMate = computed(() => props.score?.startsWith('#'))

// Convert score to a 0–100 White percentage for the bar
const whitePercent = computed(() => {
  if (!props.score || props.evaluating) return 50

  if (isMate.value) {
    const n = parseInt(props.score.replace('#', ''))
    return n > 0 ? 95 : 5
  }

  const cp = parseFloat(props.score) * 100
  // Sigmoid-like mapping: ±500cp ≈ 90% advantage
  const pct = 50 + 50 * (2 / (1 + Math.exp(-cp / 250)) - 1)
  return Math.min(95, Math.max(5, pct))
})

const blackPercent = computed(() => 100 - whitePercent.value)

const tooltip = computed(() => {
  if (!props.score) return 'Evaluating…'
  const src = props.source === 'lichess' ? `Lichess cloud (depth ${props.depth})` : `Stockfish depth ${props.depth}`
  return `${props.score} — ${src}`
})
</script>

<style scoped>
.eval-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 36px;
  align-self: stretch;
}

.eval-bar {
  flex: 1;
  width: 24px;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid #4a3728;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  cursor: default;
}

.black-side {
  background: #333;
  transition: height 0.4s ease;
}

.white-side {
  background: #f0d9b5;
  transition: height 0.4s ease;
}

.eval-label {
  font-size: 0.78rem;
  font-weight: 700;
  font-family: monospace;
  color: #f0d9b5;
  min-height: 18px;
  text-align: center;
}

.eval-label.mate { color: #e74c3c; }

.spinner {
  animation: pulse 1s infinite;
  color: #aaa;
}

.na { color: #666; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
</style>
