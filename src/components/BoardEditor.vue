<template>
  <div class="editor-page">
    <header class="editor-header">
      <button class="back-btn" @click="$emit('back')">← Home</button>
      <h1>♛ Board Editor</h1>
      <div class="header-spacer" />
    </header>

    <div class="editor-body">
      <!-- Board -->
      <div
        class="editor-board"
        @dragover.prevent
        @drop.prevent="onDropOnBoard($event)"
      >
        <div
          v-for="sq in squares"
          :key="sq"
          class="editor-sq"
          :class="squareClasses(sq)"
          @click="onSquareClick(sq)"
          @contextmenu.prevent="removePiece(sq)"
          @dragover.prevent="dragOverSq = sq"
          @dragleave="dragOverSq = null"
          @drop.prevent="onDropOnSquare(sq, $event)"
        >
          <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
          <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
          <img
            v-if="board[sq]"
            class="piece"
            :src="pieceUrl(board[sq].color, board[sq].type)"
            :alt="board[sq].color + board[sq].type"
            draggable="true"
            @dragstart="onDragFromBoard(sq, $event)"
            @dragend="dragOverSq = null"
          />
        </div>
      </div>

      <!-- Side panel -->
      <div
        class="editor-panel"
        @dragover.prevent
        @drop.prevent="onDropOnPalette($event)"
      >
        <!-- Action buttons -->
        <div class="panel-actions">
          <button class="panel-btn" @click="loadStart">Start Position</button>
          <button class="panel-btn danger" @click="clearBoard">Clear Board</button>
        </div>

        <!-- White pieces -->
        <div class="palette-group">
          <div class="palette-label">White</div>
          <div class="palette-row">
              <img
              v-for="p in paletteWhite"
              :key="p.key"
              class="palette-piece"
              :class="{ active: activeTool === p.key }"
              :src="pieceUrl(p.color, p.type)"
              :alt="p.key"
              draggable="true"
              @click="selectTool(p.key)"
              @dragstart="onDragFromPalette(p, $event)"
            />
          </div>
        </div>

        <!-- Black pieces -->
        <div class="palette-group">
          <div class="palette-label">Black</div>
          <div class="palette-row">
              <img
              v-for="p in paletteBlack"
              :key="p.key"
              class="palette-piece"
              :class="{ active: activeTool === p.key }"
              :src="pieceUrl(p.color, p.type)"
              :alt="p.key"
              draggable="true"
              @click="selectTool(p.key)"
              @dragstart="onDragFromPalette(p, $event)"
            />
          </div>
        </div>

        <!-- Eraser -->
        <div class="palette-group">
          <div
            class="palette-piece eraser"
            :class="{ active: activeTool === 'eraser' }"
            title="Eraser — click to toggle, then click a square to remove its piece. Right-click any piece to remove it."
            @click="selectTool('eraser')"
          >🗑️ Eraser</div>
        </div>

        <!-- Hint -->
        <p class="hint">
          Click a piece above, then click the board to place it.<br>
          Right-click a piece to remove it.<br>
          Drag pieces to move or drag to this panel to remove.
        </p>

        <!-- FEN -->
        <div class="fen-group">
          <div class="palette-label">FEN</div>
          <input
            class="fen-input"
            :value="currentFen"
            readonly
            @click="$event.target.select()"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

defineEmits(['back'])

const PIECE_MAP = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' }
function pieceUrl(color, type) {
  return `/pieces/cburnett/${color}${PIECE_MAP[type]}.svg`
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const paletteWhite = [
  { key: 'wk', color: 'w', type: 'k' },
  { key: 'wq', color: 'w', type: 'q' },
  { key: 'wr', color: 'w', type: 'r' },
  { key: 'wb', color: 'w', type: 'b' },
  { key: 'wn', color: 'w', type: 'n' },
  { key: 'wp', color: 'w', type: 'p' },
]

const paletteBlack = [
  { key: 'bk', color: 'b', type: 'k' },
  { key: 'bq', color: 'b', type: 'q' },
  { key: 'br', color: 'b', type: 'r' },
  { key: 'bb', color: 'b', type: 'b' },
  { key: 'bn', color: 'b', type: 'n', symbol: '♞' },
  { key: 'bp', color: 'b', type: 'p' },
]

const allPieces = [...paletteWhite, ...paletteBlack]

// board[square] = { type, color } | undefined
const board = reactive({})
const activeTool = ref(null)   // 'wq', 'bp', 'eraser', or null
const dragOverSq = ref(null)

// Squares in display order: a8 → h1
const squares = (() => {
  const out = []
  for (let rank = 8; rank >= 1; rank--)
    for (let fi = 0; fi < 8; fi++)
      out.push(String.fromCharCode(97 + fi) + rank)
  return out
})()

// ── FEN helpers ──────────────────────────────────────────────────────────────

function parseFen(fen) {
  const result = {}
  const [pos] = fen.split(' ')
  pos.split('/').forEach((row, ri) => {
    let fi = 0
    for (const ch of row) {
      if (/\d/.test(ch)) { fi += parseInt(ch) }
      else {
        result[String.fromCharCode(97 + fi) + (8 - ri)] = {
          type: ch.toLowerCase(),
          color: ch === ch.toUpperCase() ? 'w' : 'b',
        }
        fi++
      }
    }
  })
  return result
}

function buildFen(b) {
  const rows = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (let fi = 0; fi < 8; fi++) {
      const piece = b[String.fromCharCode(97 + fi) + rank]
      if (piece) {
        if (empty) { row += empty; empty = 0 }
        row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type
      } else {
        empty++
      }
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/') + ' w KQkq - 0 1'
}

const currentFen = computed(() => buildFen(board))

// ── Board mutations ──────────────────────────────────────────────────────────

function setBoard(parsed) {
  for (const sq of Object.keys(board)) delete board[sq]
  for (const [sq, p] of Object.entries(parsed)) board[sq] = p
}

function loadStart() { setBoard(parseFen(START_FEN)) }
function clearBoard() { for (const sq of Object.keys(board)) delete board[sq] }
function removePiece(sq) { delete board[sq] }

// ── Tool selection ───────────────────────────────────────────────────────────

function selectTool(key) {
  activeTool.value = activeTool.value === key ? null : key
}

// ── Click on board square ────────────────────────────────────────────────────

function onSquareClick(sq) {
  if (!activeTool.value) return
  if (activeTool.value === 'eraser') { delete board[sq]; return }
  const piece = allPieces.find(p => p.key === activeTool.value)
  if (!piece) return
  // Toggle: clicking same piece type on a square removes it
  if (board[sq]?.type === piece.type && board[sq]?.color === piece.color) {
    delete board[sq]
  } else {
    board[sq] = { type: piece.type, color: piece.color }
  }
}

// ── Drag from board ──────────────────────────────────────────────────────────

function onDragFromBoard(sq, e) {
  e.dataTransfer.setData('text/plain', `board:${sq}`)
  e.dataTransfer.effectAllowed = 'move'
}

// ── Drag from palette ────────────────────────────────────────────────────────

function onDragFromPalette(piece, e) {
  e.dataTransfer.setData('text/plain', `palette:${piece.color}:${piece.type}`)
  e.dataTransfer.effectAllowed = 'copy'
}

// ── Drop on a specific board square ─────────────────────────────────────────

function onDropOnSquare(sq, e) {
  dragOverSq.value = null
  const data = e.dataTransfer.getData('text/plain')
  if (!data) return
  if (data.startsWith('palette:')) {
    const [, color, type] = data.split(':')
    board[sq] = { color, type }
  } else if (data.startsWith('board:')) {
    const from = data.slice(6)
    if (from !== sq) {
      board[sq] = board[from]
      delete board[from]
    }
  }
}

// ── Drop on palette area (board → palette = remove piece) ───────────────────

function onDropOnPalette(e) {
  const data = e.dataTransfer.getData('text/plain')
  if (data?.startsWith('board:')) delete board[data.slice(6)]
}

// ── Catch-all drop on board wrapper (shouldn't normally fire) ────────────────
function onDropOnBoard() { /* squares handle their own drops */ }

// ── Helpers ──────────────────────────────────────────────────────────────────



function squareClasses(sq) {
  const fi = sq.charCodeAt(0) - 97
  const ri = parseInt(sq[1]) - 1
  return [
    (fi + ri) % 2 === 1 ? 'light' : 'dark',
    dragOverSq.value === sq ? 'drag-over' : '',
    activeTool.value && activeTool.value !== 'eraser' ? 'place-cursor' : '',
    activeTool.value === 'eraser' ? 'erase-cursor' : '',
  ]
}

function isBottomRank(sq) { return sq[1] === '1' }
function isAFile(sq) { return sq[0] === 'a' }

// Init with start position
loadStart()
</script>

<style scoped>
.editor-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page-alt);
}

/* ── Header ── */
.editor-header {
  background: var(--bg-header);
  color: var(--text-on-dark);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.editor-header h1 {
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  letter-spacing: 2px;
  flex: 1;
  text-align: center;
}
.back-btn {
  background: none;
  border: 1px solid #f0d9b5;
  color: #f0d9b5;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.back-btn:hover { background: var(--btn-hover); }
.header-spacer { width: 90px; }

/* ── Body ── */
.editor-body {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 20px;
  padding: 28px 20px;
}

/* ── Board ── */
.editor-board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: min(75vw, 75vh, 540px);
  height: min(75vw, 75vh, 540px);
  border: 3px solid #4a3728;
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.45);
  overflow: hidden;
  flex-shrink: 0;
}

.editor-sq {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  user-select: none;
}
.editor-sq.light { background: #f0d9b5; }
.editor-sq.dark  { background: #b58863; }
.editor-sq.drag-over { background: #f6f669aa !important; }
.editor-sq.place-cursor { cursor: crosshair; }
.editor-sq.erase-cursor { cursor: cell; }

.piece {
  width: 88%;
  height: 88%;
  object-fit: contain;
  cursor: grab;
  z-index: 1;
  pointer-events: all;
}
.piece:active { cursor: grabbing; }
.piece:active { cursor: grabbing; transform: scale(1.15); }

.coord {
  position: absolute;
  font-size: clamp(9px, 1.2vw, 12px);
  font-weight: 600;
  opacity: 0.7;
  pointer-events: none;
}
.coord.file { bottom: 2px; right: 3px; }
.coord.rank { top: 2px; left: 3px; }
.light .coord { color: #b58863; }
.dark  .coord { color: #f0d9b5; }

/* ── Side panel ── */
.editor-panel {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  padding: 20px;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-self: flex-start;
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-btn {
  padding: 9px 10px;
  border: none;
  border-radius: 7px;
  background: #b58863;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.panel-btn:hover { background: #9a7252; }
.panel-btn.danger { background: #c0392b; }
.panel-btn.danger:hover { background: #a93226; }

.palette-group { display: flex; flex-direction: column; gap: 6px; }

.palette-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.palette-piece {
  width: 44px;
  height: 44px;
  object-fit: contain;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.1s, background 0.1s;
}
.palette-piece:hover { background: #f0d9b5; }
.palette-piece.active {
  border-color: #b58863;
  background: #f0d9b5;
}

.eraser {
  font-size: 0.9rem;
  padding: 6px 10px;
  border: 2px solid #ccc;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #555;
}
.eraser.active { border-color: #c0392b; background: #fdecea; color: #c0392b; }

.hint {
  font-size: 0.72rem;
  color: #999;
  line-height: 1.55;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

.fen-group { display: flex; flex-direction: column; gap: 4px; }

.fen-input {
  width: 100%;
  font-size: 0.72rem;
  font-family: monospace;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 5px;
  background: #fafafa;
  cursor: text;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 680px) {
  .editor-panel { width: 100%; max-width: 540px; }
  .palette-row { gap: 8px; }
  .palette-piece { font-size: 2rem; }
}
</style>
