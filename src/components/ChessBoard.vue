<template>
  <div class="board-wrapper">
    <div class="board" :class="{ flipped }">
      <ChessSquare
        v-for="square in squares"
        :key="square"
        :square="square"
        :piece="getPiece(square)"
        :selected="selectedSquare === square"
        :isLegal="legalMoves.includes(square)"
        :isInCheck="isKingInCheck(square)"
        :flipped="flipped"
        :showPromotion="promotionPending?.from === square"
        :canDrag="canInteract(square)"
        :showAllSquareNames="showAllSquareNames"
        @click="onSquareClick(square)"
        @drop="onDrop"
        @promote="$emit('promote', $event)"
      />
      <!-- Move flash overlay -->
      <transition name="flash-fade">
        <div v-if="flashLabel" :key="flashKey" class="move-flash">{{ flashLabel }}</div>
      </transition>
      <!-- Arrow overlay -->
      <svg v-if="arrowPolygons.length" class="arrow-overlay" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg">
        <polygon
          v-for="(a, i) in arrowPolygons"
          :key="i"
          :points="a.points"
          :fill="a.color"
          fill-opacity="0.82"
        />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Chess } from 'chess.js'
import ChessSquare from './ChessSquare.vue'

const props = defineProps({
  fen: String,
  selectedSquare: String,
  legalMoves: Array,
  flipped: Boolean,
  activeTurn: String,
  myColor: { type: String, default: null },
  promotionPending: Object,
  showAllSquareNames: { type: Boolean, default: false },
  showMoveFlash:      { type: Boolean, default: true },
  lastMoveTo:         { type: String,  default: null },
  arrows:             { type: Array,   default: () => [] },
})

const emit = defineEmits(['square-click', 'drop', 'promote'])

// ── Move flash ────────────────────────────────────────────────────────────────
const flashLabel = ref(null)
const flashKey   = ref(0)
let flashTimer = null

watch(() => props.lastMoveTo, (sq) => {
  if (!props.showMoveFlash || !sq) return
  clearTimeout(flashTimer)
  flashLabel.value = sq
  flashKey.value++
  flashTimer = setTimeout(() => { flashLabel.value = null }, 900)
})

// All squares in display order (a8→h1 default, flipped = a1→h8)
const squares = computed(() => {
  const files = ['a','b','c','d','e','f','g','h']
  const ranks = [8,7,6,5,4,3,2,1]
  const result = []
  const r = props.flipped ? [...ranks].reverse() : ranks
  const f = props.flipped ? [...files].reverse() : files
  for (const rank of r) {
    for (const file of f) {
      result.push(file + rank)
    }
  }
  return result
})

const chessInstance = computed(() => {
  try {
    const c = new Chess()
    c.load(props.fen)
    return c
  } catch {
    return new Chess()
  }
})

function getPiece(square) {
  return chessInstance.value.get(square) || null
}

function isKingInCheck(square) {
  const piece = getPiece(square)
  if (!piece || piece.type !== 'k') return false
  return piece.color === chessInstance.value.turn() && chessInstance.value.inCheck()
}

function canInteract(square) {
  const piece = getPiece(square)
  if (!piece) return false
  // Online mode: only own color
  if (props.myColor && piece.color !== props.myColor) return false
  // Must be current turn
  return piece.color === props.activeTurn
}

function onSquareClick(square) {
  if (props.myColor && props.myColor !== props.activeTurn) return
  emit('square-click', square)
}

function onDrop({ from, to }) {
  const piece = getPiece(from)
  if (!piece) return
  if (props.myColor && piece.color !== props.myColor) return
  emit('drop', { from, to })
}

// ── Arrow rendering ───────────────────────────────────────────────────────────
const FILES = 'abcdefgh'

function sqCenter(sq) {
  const fi = FILES.indexOf(sq[0])
  const ri = parseInt(sq[1]) - 1
  return props.flipped
    ? { x: 7 - fi + 0.5, y: ri + 0.5 }
    : { x: fi + 0.5, y: 7 - ri + 0.5 }
}

function buildArrowPolygon(fromSq, toSq, color = '#f6b100') {
  const p1 = sqCenter(fromSq)
  const p2 = sqCenter(toSq)
  const dx = p2.x - p1.x, dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.01) return null
  const ux = dx / len, uy = dy / len
  const px = -uy, py = ux
  const bw = 0.1, hw = 0.24, headLen = 0.36, tail = 0.24
  const s = { x: p1.x + ux * tail,      y: p1.y + uy * tail }
  const e = { x: p2.x - ux * headLen,   y: p2.y - uy * headLen }
  const t = { x: p2.x - ux * 0.06,      y: p2.y - uy * 0.06 }
  const pts = [
    { x: s.x + px * bw,  y: s.y + py * bw },
    { x: e.x + px * bw,  y: e.y + py * bw },
    { x: e.x + px * hw,  y: e.y + py * hw },
    t,
    { x: e.x - px * hw,  y: e.y - py * hw },
    { x: e.x - px * bw,  y: e.y - py * bw },
    { x: s.x - px * bw,  y: s.y - py * bw },
  ]
  return { points: pts.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' '), color }
}

const arrowPolygons = computed(() =>
  props.arrows
    .map(a => buildArrowPolygon(a.from, a.to, a.color ?? '#f6b100'))
    .filter(Boolean)
)
</script>

<style scoped>
.board-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: min(80vw, 80vh, 560px);
  height: min(80vw, 80vh, 560px);
  border: 3px solid #4a3728;
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  position: relative;
}

/* ── Move flash overlay ── */
.move-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  font-size: clamp(3rem, 10vw, 6rem);
  font-weight: 900;
  letter-spacing: 0.05em;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 0 32px rgba(0,0,0,0.4);
  pointer-events: none;
  z-index: 20;
  animation: moveFlash 0.9s ease-out forwards;
  white-space: nowrap;
}

@keyframes moveFlash {
  0%   { transform: translate(-50%, -50%) scale(2.2); opacity: 1; }
  20%  { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
}

/* Vue transition used so element is removed from DOM after animation */
.flash-fade-leave-active { transition: opacity 0s; }
.flash-fade-leave-to     { opacity: 0; }

.arrow-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}
</style>
