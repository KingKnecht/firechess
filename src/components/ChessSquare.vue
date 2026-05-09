<template>
  <div
    class="square"
    :class="[
      squareColor,
      { selected, 'legal-target': isLegal, 'in-check': isInCheck },
      isDraggingOver ? 'drag-over' : '',
    ]"
    @click="$emit('click', square)"
    @dragover.prevent="isDraggingOver = true"
    @dragleave="isDraggingOver = false"
    @drop.prevent="onDrop"
  >
    <img
      v-if="piece"
      class="piece"
      :class="{ draggable: canDrag }"
      :src="pieceImg"
      :alt="piece.color + piece.type"
      draggable="true"
      @dragstart="onDragStart"
      @dragend="isDraggingOver = false"
    />
    <span v-if="isLegal && !piece" class="legal-dot" />
    <span v-if="showCoords && isBottomRank" class="coord file">{{ file }}</span>
    <span v-if="showCoords && isAFile" class="coord rank">{{ rank }}</span>

    <!-- Promotion selector overlay -->
    <div v-if="showPromotion" class="promotion-overlay">
      <img
        v-for="p in promotionPieces"
        :key="p.value"
        class="promotion-piece"
        :src="promotionImg(p.value)"
        :alt="p.value"
        @click.stop="$emit('promote', p.value)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  square: String,    // e.g. 'e4'
  piece: Object,     // { type, color } or null
  selected: Boolean,
  isLegal: Boolean,
  isInCheck: Boolean,
  flipped: Boolean,
  showPromotion: Boolean,
  canDrag: Boolean,
  showCoords: { type: Boolean, default: true },
})

const emit = defineEmits(['click', 'drop', 'promote'])

const isDraggingOver = ref(false)

const PIECE_MAP = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' }

function pieceUrl(color, type) {
  return `/pieces/cburnett/${color}${PIECE_MAP[type]}.svg`
}

const PROMOTION_PIECES = ['q', 'r', 'b', 'n']

const promotionPieces = computed(() =>
  PROMOTION_PIECES.map(value => ({ value }))
)

function promotionImg(value) {
  return pieceUrl(props.piece?.color ?? 'w', value)
}

const pieceImg = computed(() => {
  if (!props.piece) return ''
  return pieceUrl(props.piece.color, props.piece.type)
})

const file = computed(() => props.square?.[0])
const rank = computed(() => props.square?.[1])

const fileIndex = computed(() => props.square?.charCodeAt(0) - 97) // a=0..h=7
const rankIndex = computed(() => parseInt(props.square?.[1]) - 1)    // 1=0..8=7

const squareColor = computed(() => {
  const light = (fileIndex.value + rankIndex.value) % 2 === 1
  return light ? 'light' : 'dark'
})

const isBottomRank = computed(() =>
  props.flipped ? rankIndex.value === 7 : rankIndex.value === 0,
)
const isAFile = computed(() =>
  props.flipped ? fileIndex.value === 7 : fileIndex.value === 0,
)

function onDragStart(e) {
  if (!props.canDrag) { e.preventDefault(); return }
  e.dataTransfer.setData('text/plain', props.square)
  e.dataTransfer.effectAllowed = 'move'
}

function onDrop(e) {
  isDraggingOver.value = false
  const from = e.dataTransfer.getData('text/plain')
  if (from && from !== props.square) {
    emit('drop', { from, to: props.square })
  }
}
</script>

<style scoped>
.square {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
}

.light { background: #f0d9b5; }
.dark  { background: #b58863; }

.selected        { background: #f6f669cc !important; }
.legal-target    { background: #cdd16e99 !important; }
.drag-over       { background: #f6f669aa !important; }
.in-check        { background: #e74c3c !important; }

.piece {
  width: 88%;
  height: 88%;
  object-fit: contain;
  transition: transform 0.1s;
  z-index: 1;
  pointer-events: none;
}
.piece.draggable { pointer-events: all; cursor: grab; }
.piece.draggable:active { cursor: grabbing; transform: scale(1.15); }

.legal-dot {
  width: 28%;
  height: 28%;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

.coord {
  position: absolute;
  font-size: clamp(9px, 1.2vw, 13px);
  font-weight: 600;
  opacity: 0.75;
  pointer-events: none;
}
.coord.file { bottom: 2px; right: 4px; }
.coord.rank { top: 2px;   left: 3px;  }

.light .coord { color: #b58863; }
.dark  .coord { color: #f0d9b5; }

.promotion-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 2px solid #555;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.promotion-piece {
  width: 100%;
  aspect-ratio: 1;
  object-fit: contain;
  padding: 4px;
  cursor: pointer;
  box-sizing: border-box;
}
.promotion-piece:hover { background: #eee; }
</style>
