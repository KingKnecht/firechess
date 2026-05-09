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
        @click="onSquareClick(square)"
        @drop="onDrop"
        @promote="$emit('promote', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Chess } from 'chess.js'
import ChessSquare from './ChessSquare.vue'

const props = defineProps({
  fen: String,
  selectedSquare: String,
  legalMoves: Array,
  flipped: Boolean,
  activeTurn: String,           // 'w' | 'b' — which color is allowed to interact
  myColor: { type: String, default: null }, // null = local (both sides), 'w'/'b' = online
  promotionPending: Object,
})

const emit = defineEmits(['square-click', 'drop', 'promote'])

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
}
</style>
