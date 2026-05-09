<template>
  <div class="viz-page">
    <header class="viz-header">
      <button class="back-btn" @click="handleBack">← Home</button>
      <h1>♛ Visualization Training</h1>
      <div class="header-spacer" />
    </header>

    <div class="viz-body">

      <!-- ══════════════ SETUP ══════════════ -->
      <template v-if="phase === 'setup'">
        <div class="setup-grid">

          <!-- Board preview + navigator -->
          <div class="preview-area">
            <div class="viz-board small">
              <div
                v-for="sq in squares"
                :key="sq"
                class="viz-sq"
                :class="[squareColor(sq), visibleSet.has(sq) ? 'in-zone' : 'out-zone']"
              >
                <!-- pieces hidden before training starts -->
                <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
                <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
              </div>
            </div>

            <p v-if="positions.length" class="zone-count">
              <span v-if="noMatchFound" class="badge warn">⚠ No position matches filter — adjust min/max</span>
              <template v-else>
                Position selected: <span class="move-label-inline">{{ moveLabels[moveIndex] }}</span>
                — <strong>{{ piecesInZoneCount }}</strong> piece(s) in zone
                <span class="badge ok">✓ ready</span>
              </template>
            </p>
          </div>

          <!-- Settings panel -->
          <div class="setup-panel">

            <div class="panel-section">
              <div class="section-title">Zone</div>
              <div class="zone-grid">
                <button
                  v-for="z in zoneOptions"
                  :key="z.id"
                  class="zone-btn"
                  :class="{ active: selectedZone === z.id }"
                  @click="selectedZone = z.id"
                >{{ z.label }}</button>
              </div>
            </div>

            <div class="panel-section">
              <div class="section-title">Show time: <strong>{{ showTime }}s</strong></div>
              <input type="range" min="2" max="30" step="1" v-model.number="showTime" class="slider" />
            </div>

            <div class="panel-section">
              <div class="section-title">Piece pool after hiding</div>
              <div class="radio-group">
                <label><input type="radio" value="visible" v-model="piecePool" /> Only pieces from zone</label>
                <label><input type="radio" value="full" v-model="piecePool" /> Full set (unlimited)</label>
              </div>
            </div>

            <div class="panel-section">
              <div class="section-title">Recall mode</div>
              <div class="radio-group">
                <label><input type="radio" value="recall" v-model="recallMode" /> 🧩 Place all pieces (standard)</label>
                <label><input type="radio" value="guided" v-model="recallMode" /> 🎯 Guided — identify one piece at a time</label>
              </div>
            </div>

            <div class="panel-section">
              <div class="section-title">Piece count filter (for "Find match")</div>
              <div class="range-row">
                <label>Min <input type="number" min="1" max="32" v-model.number="minPieces" class="num-input" /></label>
                <label>Max <input type="number" min="1" max="32" v-model.number="maxPieces" class="num-input" /></label>

              </div>
            </div>

            <div class="panel-section">
              <div class="section-title">PGN <span class="optional-label">(optional — random game used if empty)</span></div>
              <textarea
                v-model="pgnText"
                class="pgn-input"
                placeholder="Paste PGN here, or leave empty to use a random master game…"
                rows="4"
                spellcheck="false"
              />
              <div class="pgn-actions">
                <button class="panel-btn" :disabled="!pgnText.trim()" @click="loadPgn">Load PGN</button>
                <button class="panel-btn" @click="loadRandomGame">↺ Random game</button>
                <span v-if="pgnError" class="badge error">{{ pgnError }}</span>
                <span v-else-if="positions.length" class="badge ok">{{ currentGameLabel }} · {{ positions.length - 1 }} moves</span>
              </div>
            </div>

            <button
              class="start-btn"
              :disabled="piecesInZoneCount === 0 || noMatchFound"
              @click="startOrLoad"
            >▶ Start Training</button>
          </div>
        </div>
      </template>

      <!-- ══════════════ STUDY ══════════════ -->
      <template v-else-if="phase === 'study'">
        <div class="game-layout">
          <div class="viz-board large">
            <div
              v-for="sq in squares"
              :key="sq"
              class="viz-sq"
              :class="[squareColor(sq), visibleSet.has(sq) ? 'in-zone' : 'out-zone']"
            >
              <img v-if="targetBoard[sq] && visibleSet.has(sq)" class="piece" :src="pieceUrl(targetBoard[sq].color, targetBoard[sq].type)" />
              <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
              <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
            </div>
          </div>

          <div class="side-panel">
            <div class="phase-title">Memorize!</div>
            <div class="countdown-wrap">
              <svg viewBox="0 0 64 64" class="ring-svg">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#eee" stroke-width="6"/>
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="#b58863" stroke-width="6"
                  stroke-dasharray="175.9"
                  :stroke-dashoffset="175.9 * (1 - countdown / showTime)"
                  stroke-linecap="round"
                  transform="rotate(-90 32 32)"
                  style="transition: stroke-dashoffset 0.9s linear"
                />
              </svg>
              <span class="countdown-num">{{ countdown }}</span>
            </div>
            <p class="phase-hint">Study the highlighted zone.<br>Pieces will hide when the timer ends.</p>
            <button class="panel-btn" @click="startRecall">Skip →</button>
          </div>
        </div>
      </template>

      <!-- ══════════════ RECALL ══════════════ -->
      <template v-else-if="phase === 'recall'">
        <div class="game-layout">
          <div
            class="viz-board large"
            @dragover.prevent
            @drop.prevent
          >
            <div
              v-for="sq in squares"
              :key="sq"
              class="viz-sq"
              :class="[squareColor(sq), visibleSet.has(sq) ? 'in-zone recall-target' : 'out-zone', dragOver === sq ? 'drag-over' : '', selectedBoardSq === sq ? 'sq-selected' : '']"
              @click="onClickSquare(sq)"
              @dragover.prevent="onDragOverSquare(sq)"
              @dragleave="dragOver = null"
              @drop.prevent="onDropSquare(sq, $event)"
              @contextmenu.prevent="onRightClickSquare(sq)"
            >
              <img
                v-if="userBoard[sq]"
                class="piece draggable"
                :src="pieceUrl(userBoard[sq].color, userBoard[sq].type)"
                draggable="true"
                @dragstart="onDragFromBoard(sq, $event)"
                @dragend="dragOver = null"
              />
              <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
              <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
            </div>
          </div>

          <div class="side-panel" @dragover.prevent @drop.prevent="onDropPalette($event)" @click="onClickTray">
            <div class="phase-title">Recall!</div>
            <p class="phase-hint">
              <strong>Tap</strong> a piece below, then tap a square.<br>
              Tap a placed piece to move it.<br>
              Right-click / long-press to remove.
            </p>

            <div class="palette-section">
              <div class="palette-label">White</div>
              <div class="palette-row">
                <div
                  v-for="p in paletteWhite"
                  :key="p.key"
                  class="palette-piece"
                  :class="{ exhausted: p.available === 0, 'palette-selected': selectedPalettePiece?.color === p.color && selectedPalettePiece?.type === p.type }"
                  :draggable="p.available !== 0"
                  @dragstart="onDragFromPalette(p, $event)"
                  @click.stop="onClickPalette(p)"
                >
                  <img class="palette-img" :src="pieceUrl(p.color, p.type)" />
                  <span v-if="piecePool === 'visible'" class="count-badge">{{ p.available }}</span>
                </div>
              </div>
              <div class="palette-label">Black</div>
              <div class="palette-row">
                <div
                  v-for="p in paletteBlack"
                  :key="p.key"
                  class="palette-piece"
                  :class="{ exhausted: p.available === 0, 'palette-selected': selectedPalettePiece?.color === p.color && selectedPalettePiece?.type === p.type }"
                  :draggable="p.available !== 0"
                  @dragstart="onDragFromPalette(p, $event)"
                  @click.stop="onClickPalette(p)"
                >
                  <img class="palette-img" :src="pieceUrl(p.color, p.type)" />
                  <span v-if="piecePool === 'visible'" class="count-badge">{{ p.available }}</span>
                </div>
              </div>
            </div>

            <button class="start-btn" @click.stop="checkResult">✓ Check Answer</button>
          </div>
        </div>
      </template>

      <!-- ══════════════ GUIDED ══════════════ -->
      <template v-else-if="phase === 'guided'">
        <div class="game-layout">
          <!-- Board: shows zone, highlights current target square -->
          <div class="viz-board large">
            <div
              v-for="sq in squares"
              :key="sq"
              class="viz-sq"
              :class="[
                squareColor(sq),
                visibleSet.has(sq) ? 'in-zone' : 'out-zone',
                sq === guidedCurrentSq ? (guidedFlash ? `guided-flash-${guidedFlash}` : 'guided-target') : '',
              ]"
            >
              <!-- Show already-identified pieces dimmed -->
              <img
                v-if="guidedResults.find(r => r.sq === sq)"
                class="piece"
                :class="guidedResults.find(r => r.sq === sq)?.correct ? 'guided-done-ok' : 'guided-done-wrong'"
                :src="pieceUrl(targetBoard[sq].color, targetBoard[sq].type)"
              />
              <!-- Question mark on the active square -->
              <span v-else-if="sq === guidedCurrentSq" class="guided-qmark">?</span>
              <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
              <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
            </div>
          </div>

          <div class="side-panel">
            <div class="phase-title">🎯 Guided Recall</div>
            <p class="phase-hint">
              What piece is on <strong>{{ guidedCurrentSq }}</strong>?<br>
              <span class="guided-progress">{{ guidedIdx + 1 }} / {{ guidedSquares.length }}</span>
            </p>

            <!-- Flash feedback -->
            <div v-if="guidedFlash" class="guided-feedback" :class="guidedFlash">
              {{ guidedFlash === 'correct' ? '✓ Correct!' : '✗ Wrong' }}
            </div>

            <!-- Piece picker — respects piecePool setting -->
            <div class="guided-palette">
              <template v-if="piecePool === 'full'">
                <div class="palette-label">White</div>
                <div class="palette-row">
                  <div v-for="p in guidedPalette.filter(p => p.color === 'w')" :key="p.key"
                    class="palette-piece" @click="onGuidedPick(p)">
                    <img class="palette-img" :src="pieceUrl(p.color, p.type)" />
                  </div>
                </div>
                <div class="palette-label">Black</div>
                <div class="palette-row">
                  <div v-for="p in guidedPalette.filter(p => p.color === 'b')" :key="p.key"
                    class="palette-piece" @click="onGuidedPick(p)">
                    <img class="palette-img" :src="pieceUrl(p.color, p.type)" />
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="palette-label">Pieces in zone</div>
                <div class="palette-row">
                  <div v-for="p in guidedPalette" :key="p.key"
                    class="palette-piece" @click="onGuidedPick(p)">
                    <img class="palette-img" :src="pieceUrl(p.color, p.type)" />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- ══════════════ RESULT ══════════════ -->
      <template v-else-if="phase === 'result'">
        <div class="game-layout">
          <div class="viz-board large">
            <div
              v-for="sq in squares"
              :key="sq"
              class="viz-sq"
              :class="[squareColor(sq), visibleSet.has(sq) ? 'in-zone' : 'out-zone', resultClass(sq)]"
            >
              <img v-if="visibleSet.has(sq) && (recallMode === 'guided' ? targetBoard[sq] : (showSolution ? targetBoard[sq] : userBoard[sq]))" class="piece"
                :src="pieceUrl(
                  (recallMode === 'guided' ? targetBoard[sq] : (showSolution ? targetBoard[sq] : userBoard[sq])).color,
                  (recallMode === 'guided' ? targetBoard[sq] : (showSolution ? targetBoard[sq] : userBoard[sq])).type
                )"
              />
              <span v-if="isBottomRank(sq)" class="coord file">{{ sq[0] }}</span>
              <span v-if="isAFile(sq)" class="coord rank">{{ sq[1] }}</span>
            </div>
          </div>

          <div class="side-panel">
            <div class="phase-title">Result</div>
            <div class="score-box">
              <span class="score-num">{{ score.correct }}/{{ score.total }}</span>
              <span class="score-label">pieces correct</span>
            </div>

            <div class="result-legend">
              <div><span class="legend-dot correct" /> Correct</div>
              <div><span class="legend-dot wrong" /> Wrong piece</div>
              <div><span class="legend-dot missing" /> Missing</div>
              <div><span class="legend-dot extra" /> Extra</div>
            </div>

            <div class="result-actions">
              <button v-if="recallMode !== 'guided'" class="panel-btn" @click="showSolution = !showSolution">
                {{ showSolution ? 'Show my answer' : 'Show solution' }}
              </button>
              <button class="panel-btn" @click="startStudy">↺ Try again</button>
              <button class="start-btn" @click="nextPosition">↻ New position</button>
              <button class="panel-btn danger" @click="phase = 'setup'">✕ End training</button>
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { Chess } from 'chess.js'

const emit = defineEmits(['back'])

// ── Constants ────────────────────────────────────────────────────────────────

const PIECE_MAP = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' }
function pieceUrl(color, type) {
  return `/pieces/cburnett/${color}${PIECE_MAP[type]}.svg`
}

const ALL_TYPES = ['k', 'q', 'r', 'b', 'n', 'p']

const zoneOptions = [
  { id: '2x2',   label: '2×2' },
  { id: '3x3',   label: '3×3' },
  { id: '4x4',   label: '4×4' },
  { id: 'left',  label: 'Left half' },
  { id: 'right', label: 'Right half' },
  { id: 'diag1', label: '↙+↗ 4×4' },
  { id: 'diag2', label: '↖+↘ 4×4' },
  { id: 'full',  label: 'Full board' },
]

// Squares in display order a8→h1
const squares = (() => {
  const out = []
  for (let r = 8; r >= 1; r--)
    for (let fi = 0; fi < 8; fi++)
      out.push(String.fromCharCode(97 + fi) + r)
  return out
})()

// ── Settings ─────────────────────────────────────────────────────────────────

const selectedZone = ref('4x4')
const showTime     = ref(5)
const piecePool    = ref('visible')
const minPieces    = ref(2)
const maxPieces    = ref(8)

// ── PGN state ─────────────────────────────────────────────────────────────────

const pgnText      = ref('')
const pgnError     = ref('')
const noMatchFound = ref(false)
const positions    = ref([])
const moveLabels   = ref([])
const moveIndex    = ref(0)
const currentGameLabel = ref('')
const availableGames   = ref([])

onMounted(async () => {
  try {
    const res = await fetch('/pgn/index.json')
    availableGames.value = await res.json()
  } catch { /* no index, manual PGN only */ }
})

// ── Training state ────────────────────────────────────────────────────────────

const phase       = ref('setup')  // 'setup' | 'study' | 'recall' | 'guided' | 'result'
const targetBoard = ref({})       // {square → {type,color}} — visible zone of chosen position
const userBoard   = reactive({})  // user's placements
const countdown   = ref(0)
const dragOver    = ref(null)
const selectedPalettePiece = ref(null) // { color, type } — for click-to-place
const selectedBoardSq = ref(null)      // square string — for click-to-move on board
const showSolution = ref(false)
const recallMode  = ref('recall') // 'recall' | 'guided'
let timer = null

// ── Guided mode state ─────────────────────────────────────────────────────────
const guidedSquares   = ref([])   // ordered list of squares-with-pieces to identify
const guidedIdx       = ref(0)    // which square we're currently on
const guidedResults   = ref([])   // { sq, expected, given, correct } per square
const guidedFlash     = ref(null) // 'correct' | 'wrong' — for brief feedback

// ── Zone computation ──────────────────────────────────────────────────────────

// For slideable zones, zoneAnchor shifts the window: { fi: fileIndex, ri: rankIndex (0-based) }
const zoneAnchor = ref({ fi: 0, ri: 0 })

const SLIDEABLE_ZONES = new Set(['2x2', '3x3', '4x4'])

function zoneSize(id) {
  if (id === '2x2') return 2
  if (id === '3x3') return 3
  if (id === '4x4') return 4
  return null
}

function computeZone(id, anchor = null) {
  const set = new Set()
  const f = (fi, r) => { if (fi >= 0 && fi < 8 && r >= 1 && r <= 8) set.add(String.fromCharCode(97 + fi) + r) }
  const sz = zoneSize(id)
  if (sz && anchor) {
    for (let i = 0; i < sz; i++) for (let r = 0; r < sz; r++) f(anchor.fi + i, anchor.ri + r + 1)
    return set
  }
  switch (id) {
    case '2x2':  for (let i=0;i<2;i++) for (let r=1;r<=2;r++) f(i,r); break
    case '3x3':  for (let i=0;i<3;i++) for (let r=1;r<=3;r++) f(i,r); break
    case '4x4':  for (let i=0;i<4;i++) for (let r=1;r<=4;r++) f(i,r); break
    case 'left': for (let i=0;i<4;i++) for (let r=1;r<=8;r++) f(i,r); break
    case 'right':for (let i=4;i<8;i++) for (let r=1;r<=8;r++) f(i,r); break
    case 'diag1':
      for (let i=0;i<4;i++) for (let r=1;r<=4;r++) f(i,r)
      for (let i=4;i<8;i++) for (let r=5;r<=8;r++) f(i,r); break
    case 'diag2':
      for (let i=0;i<4;i++) for (let r=5;r<=8;r++) f(i,r)
      for (let i=4;i<8;i++) for (let r=1;r<=4;r++) f(i,r); break
    case 'full':
      for (let i=0;i<8;i++) for (let r=1;r<=8;r++) f(i,r); break
  }
  return set
}

// All valid anchor positions for a slideable zone
function allAnchors(id) {
  const sz = zoneSize(id)
  if (!sz) return [null]
  const anchors = []
  for (let fi = 0; fi <= 8 - sz; fi++)
    for (let ri = 0; ri <= 8 - sz; ri++)
      anchors.push({ fi, ri })
  return anchors
}

const visibleSet = computed(() =>
  SLIDEABLE_ZONES.has(selectedZone.value)
    ? computeZone(selectedZone.value, zoneAnchor.value)
    : computeZone(selectedZone.value)
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function squareColor(sq) {
  const fi = sq.charCodeAt(0) - 97
  const ri = parseInt(sq[1]) - 1
  return (fi + ri) % 2 === 1 ? 'light' : 'dark'
}

function isBottomRank(sq) { return sq[1] === '1' }
function isAFile(sq) { return sq[0] === 'a' }

function fenToBoard(fen) {
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

// ── Setup computeds ───────────────────────────────────────────────────────────

const previewBoard = computed(() =>
  positions.value.length ? fenToBoard(positions.value[moveIndex.value]) : {}
)

const piecesInZoneCount = computed(() => {
  const b = previewBoard.value
  let count = 0
  for (const sq of visibleSet.value) if (b[sq]) count++
  return count
})

// ── PGN loading ───────────────────────────────────────────────────────────────

function parsePgn(text, label = '') {
  pgnError.value = ''
  positions.value = []
  moveLabels.value = []
  moveIndex.value = 0
  try {
    const chess = new Chess()
    chess.loadPgn(text)
    const history = chess.history({ verbose: true })
    const temp = new Chess()
    const fens = [temp.fen()]
    const labels = ['Start']
    for (let i = 0; i < history.length; i++) {
      const move = temp.move(history[i])
      fens.push(temp.fen())
      labels.push(i % 2 === 0 ? `${Math.floor(i/2)+1}. ${move.san}` : `${Math.floor(i/2)+1}… ${move.san}`)
    }
    positions.value = fens
    moveLabels.value = labels
    currentGameLabel.value = label
    autoSelectPosition()
  } catch {
    pgnError.value = 'Invalid PGN'
  }
}

function loadPgn() {
  parsePgn(pgnText.value, 'custom')
}

async function loadRandomGame() {
  if (!availableGames.value.length) { pgnError.value = 'No games in /pgn/'; return }
  const file = availableGames.value[Math.floor(Math.random() * availableGames.value.length)]
  try {
    const res = await fetch(`/pgn/${file}`)
    const text = await res.text()
    pgnText.value = ''
    parsePgn(text, file.replace('.pgn', ''))
  } catch {
    pgnError.value = 'Failed to load game'
  }
}

async function startOrLoad() {
  if (!positions.value.length) await loadRandomGame()
  if (positions.value.length) startStudy()
}


function autoSelectPosition() {
  const len = positions.value.length
  const anchors = allAnchors(selectedZone.value)
  // Start from a random position to avoid always landing on the same spot
  const start = Math.floor(Math.random() * len)
  for (let offset = 0; offset < len; offset++) {
    const idx = (start + offset) % len
    if (idx === 0) continue // skip initial position (empty board)
    const b = fenToBoard(positions.value[idx])
    // Shuffle anchors so we don't always pick the same zone corner
    const shuffled = [...anchors].sort(() => Math.random() - 0.5)
    for (const anchor of shuffled) {
      const zs = computeZone(selectedZone.value, anchor)
      let count = 0
      for (const sq of zs) if (b[sq]) count++
      if (count >= minPieces.value && count <= maxPieces.value) {
        moveIndex.value = idx
        if (anchor) zoneAnchor.value = anchor
        noMatchFound.value = false
        return
      }
    }
  }
  moveIndex.value = len - 1
  noMatchFound.value = true
}

function prevMove() { if (moveIndex.value > 0) moveIndex.value-- }
function nextMove() { if (moveIndex.value < positions.value.length - 1) moveIndex.value++ }

// Re-select position when filter or zone changes (only in setup phase)
watch([minPieces, maxPieces, selectedZone], () => {
  if (positions.value.length && phase.value === 'setup') {
    zoneAnchor.value = { fi: 0, ri: 0 }
    autoSelectPosition()
  }
})

function findNextMatch() {
  const len = positions.value.length
  const anchors = allAnchors(selectedZone.value)
  // Random start offset so "next position" isn't always sequential
  const start = Math.floor(Math.random() * len)
  for (let offset = 0; offset < len; offset++) {
    const idx = (start + offset) % len
    if (idx === 0) continue
    if (idx === moveIndex.value) continue // don't repeat the same position
    const b = fenToBoard(positions.value[idx])
    const shuffled = [...anchors].sort(() => Math.random() - 0.5)
    for (const anchor of shuffled) {
      const zs = computeZone(selectedZone.value, anchor)
      let count = 0
      for (const sq of zs) if (b[sq]) count++
      if (count >= minPieces.value && count <= maxPieces.value) {
        moveIndex.value = idx
        if (anchor) zoneAnchor.value = anchor
        noMatchFound.value = false
        return
      }
    }
  }
  noMatchFound.value = true
}

// ── Training flow ─────────────────────────────────────────────────────────────

function startStudy() {
  const fullBoard = fenToBoard(positions.value[moveIndex.value])
  const tb = {}
  for (const sq of visibleSet.value) if (fullBoard[sq]) tb[sq] = fullBoard[sq]
  targetBoard.value = tb

  phase.value = 'study'
  countdown.value = showTime.value
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) { clearInterval(timer); startRecall() }
  }, 1000)
}

function startRecall() {
  clearInterval(timer)
  for (const sq of Object.keys(userBoard)) delete userBoard[sq]
  showSolution.value = false
  selectedPalettePiece.value = null
  selectedBoardSq.value = null
  if (recallMode.value === 'guided') {
    startGuided()
  } else {
    phase.value = 'recall'
  }
}

// ── Guided mode ───────────────────────────────────────────────────────────────

function startGuided() {
  // Collect squares-with-pieces in the zone, shuffle them
  const occupied = [...visibleSet.value].filter(sq => targetBoard.value[sq])
  guidedSquares.value = occupied.sort(() => Math.random() - 0.5)
  guidedIdx.value = 0
  guidedResults.value = []
  guidedFlash.value = null
  phase.value = 'guided'
}

const guidedCurrentSq = computed(() => guidedSquares.value[guidedIdx.value] ?? null)

// Full palette for guided mode — respects piecePool setting
const guidedPalette = computed(() => {
  if (piecePool.value === 'full') {
    const types = ['k', 'q', 'r', 'b', 'n', 'p']
    return ['w', 'b'].flatMap(color => types.map(type => ({ key: color + type, color, type })))
  }
  // 'visible': only piece types actually present in the target zone
  const seen = new Set()
  const pieces = []
  for (const p of Object.values(targetBoard.value)) {
    const key = p.color + p.type
    if (!seen.has(key)) { seen.add(key); pieces.push({ key, color: p.color, type: p.type }) }
  }
  // Sort: white first, then by piece value order
  const order = ['k','q','r','b','n','p']
  pieces.sort((a, b) => {
    if (a.color !== b.color) return a.color === 'w' ? -1 : 1
    return order.indexOf(a.type) - order.indexOf(b.type)
  })
  return pieces
})

function onGuidedPick(piece) {
  if (guidedFlash.value) return // ignore during flash
  const sq = guidedCurrentSq.value
  if (!sq) return
  const expected = targetBoard.value[sq]
  const correct = expected.color === piece.color && expected.type === piece.type
  guidedResults.value.push({ sq, expected, given: piece, correct })
  guidedFlash.value = correct ? 'correct' : 'wrong'
  setTimeout(() => {
    guidedFlash.value = null
    if (guidedIdx.value < guidedSquares.value.length - 1) {
      guidedIdx.value++
    } else {
      phase.value = 'result' // all done
    }
  }, 700)
}

function checkResult() {
  phase.value = 'result'
}

function handleBack() {
  clearInterval(timer)
  emit('back')
}

async function nextPosition() {
  if (!positions.value.length || availableGames.value.length > 0) {
    // pick a fresh random game each time
    await loadRandomGame()
    if (positions.value.length) startStudy()
  } else {
    findNextMatch()
    startStudy()
  }
}

// ── Score & result ────────────────────────────────────────────────────────────

const score = computed(() => {
  if (recallMode.value === 'guided') {
    const correct = guidedResults.value.filter(r => r.correct).length
    return { correct, total: guidedResults.value.length }
  }
  let correct = 0, total = 0
  for (const sq of visibleSet.value) {
    const t = targetBoard.value[sq]
    if (!t) continue
    total++
    const u = userBoard[sq]
    if (u && u.type === t.type && u.color === t.color) correct++
  }
  return { correct, total }
})

function resultClass(sq) {
  if (!visibleSet.value.has(sq)) return ''
  const t = targetBoard.value[sq]
  if (recallMode.value === 'guided') {
    const r = guidedResults.value.find(x => x.sq === sq)
    if (!r) return ''
    return r.correct ? 'result-correct' : 'result-wrong'
  }
  const u = userBoard[sq]
  if (!t && !u) return ''
  if (t && u && t.type === u.type && t.color === u.color) return 'result-correct'
  if (t && u) return 'result-wrong'
  if (t && !u) return 'result-missing'
  if (!t && u) return 'result-extra'
  return ''
}

// ── Palette ───────────────────────────────────────────────────────────────────

function buildPalette(color) {
  if (piecePool.value === 'full') {
    return ALL_TYPES.map(type => ({
      key: color + type,
      color, type,
      available: Infinity,
    }))
  }
  // Count pieces of this color in target zone
  const counts = {}
  for (const p of Object.values(targetBoard.value)) {
    if (p.color === color) counts[p.type] = (counts[p.type] || 0) + 1
  }
  return Object.entries(counts).map(([type, total]) => {
    const placed = Object.values(userBoard).filter(p => p.color === color && p.type === type).length
    return {
      key: color + type,
      color, type,
      available: Math.max(0, total - placed),
    }
  })
}

const paletteWhite = computed(() => buildPalette('w'))
const paletteBlack = computed(() => buildPalette('b'))

// ── Drag & drop ───────────────────────────────────────────────────────────────

function onDragFromPalette(piece, e) {
  if (piece.available === 0) { e.preventDefault(); return }
  e.dataTransfer.setData('text/plain', `palette:${piece.color}:${piece.type}`)
}

function onDragFromBoard(sq, e) {
  e.dataTransfer.setData('text/plain', `board:${sq}`)
}

function onDragOverSquare(sq) { if (visibleSet.value.has(sq)) dragOver.value = sq }
function onRightClickSquare(sq) { if (visibleSet.value.has(sq)) removePiece(sq) }

function onDropSquare(sq, e) {
  dragOver.value = null
  if (!visibleSet.value.has(sq)) return
  const data = e.dataTransfer.getData('text/plain')
  if (!data) return
  if (data.startsWith('palette:')) {
    const [, color, type] = data.split(':')
    userBoard[sq] = { color, type }
  } else if (data.startsWith('board:')) {
    const from = data.slice(6)
    if (from !== sq) {
      userBoard[sq] = userBoard[from]
      delete userBoard[from]
    }
  }
}

function onDropPalette(e) {
  const data = e.dataTransfer.getData('text/plain')
  if (data?.startsWith('board:')) delete userBoard[data.slice(6)]
}

function removePiece(sq) { delete userBoard[sq] }

// ── Click-to-place (mobile / accessibility) ───────────────────────────────────

function onClickPalette(piece) {
  if (piece.available === 0) return
  selectedBoardSq.value = null
  if (selectedPalettePiece.value?.color === piece.color && selectedPalettePiece.value?.type === piece.type) {
    selectedPalettePiece.value = null // deselect on second click
  } else {
    selectedPalettePiece.value = { color: piece.color, type: piece.type }
  }
}

function onClickSquare(sq) {
  if (!visibleSet.value.has(sq)) return

  // A palette piece is selected → place it
  if (selectedPalettePiece.value) {
    userBoard[sq] = { ...selectedPalettePiece.value }
    selectedPalettePiece.value = null
    return
  }

  // A board square is selected → move or deselect
  if (selectedBoardSq.value) {
    if (selectedBoardSq.value === sq) {
      selectedBoardSq.value = null // tap same square = deselect
    } else {
      userBoard[sq] = userBoard[selectedBoardSq.value]
      delete userBoard[selectedBoardSq.value]
      selectedBoardSq.value = null
    }
    return
  }

  // Select piece already on board
  if (userBoard[sq]) {
    selectedBoardSq.value = sq
  }
}

function onClickTray() {
  // Tapping the side panel returns a selected board piece to the tray
  if (selectedBoardSq.value) {
    delete userBoard[selectedBoardSq.value]
    selectedBoardSq.value = null
  }
  selectedPalettePiece.value = null
}
</script>

<style scoped>
/* ── Page shell ── */
.viz-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #2c2c2c;
}

.viz-header {
  background: #1a1a1a;
  color: #f0d9b5;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.viz-header h1 {
  font-size: clamp(1.1rem, 3vw, 1.7rem);
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
.back-btn:hover { background: rgba(240,217,181,0.15); }
.header-spacer { width: 90px; }

.viz-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
}

/* ── Setup grid ── */
.setup-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: center;
  width: 100%;
  max-width: 960px;
}

/* ── Board ── */
.viz-board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  border: 3px solid #4a3728;
  border-radius: 4px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  overflow: hidden;
  flex-shrink: 0;
}
.viz-board.small {
  width: min(55vw, 55vh, 360px);
  height: min(55vw, 55vh, 360px);
}
.viz-board.large {
  width: min(70vw, 70vh, 520px);
  height: min(70vw, 70vh, 520px);
}

.viz-sq {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
.viz-sq.light { background: #f0d9b5; }
.viz-sq.dark  { background: #b58863; }

/* Out-of-zone: darken */
.viz-sq.out-zone { filter: brightness(0.55) saturate(0.4); }

/* Recall drop targets */
.viz-sq.in-zone.recall-target { cursor: pointer; }
.viz-sq.drag-over { background: #f6f669aa !important; filter: none; }
.viz-sq.sq-selected { background: #f6f669cc !important; }

/* Result colors — override square color */
.viz-sq.result-correct { background: #27ae60 !important; filter: none; }
.viz-sq.result-wrong   { background: #e67e22 !important; filter: none; }
.viz-sq.result-missing { background: #c0392b !important; filter: none; }
.viz-sq.result-extra   { background: #f1c40f !important; filter: none; }

/* Guided mode */
.viz-sq.guided-target  { background: #f6f669cc !important; filter: none; }
.viz-sq.guided-flash-correct { background: #27ae60 !important; filter: none; }
.viz-sq.guided-flash-wrong   { background: #e74c3c !important; filter: none; }
.guided-qmark {
  font-size: 2rem;
  font-weight: 900;
  color: #555;
  pointer-events: none;
  z-index: 2;
}
.piece.guided-done-ok    { opacity: 0.6; }
.piece.guided-done-wrong { opacity: 0.25; }

.guided-palette { margin-top: 8px; }
.guided-progress { font-size: 0.8rem; color: #888; }
.guided-feedback {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  padding: 6px 0;
  border-radius: 6px;
  margin: 4px 0;
}
.guided-feedback.correct { color: #27ae60; }
.guided-feedback.wrong   { color: #c0392b; }

.piece {
  width: 88%;
  height: 88%;
  object-fit: contain;
  z-index: 1;
  pointer-events: none;
}
.piece.draggable { pointer-events: all; cursor: grab; }
.piece.draggable:active { cursor: grabbing; }
.piece.draggable:active { cursor: grabbing; transform: scale(1.12); }

.coord {
  position: absolute;
  font-size: clamp(8px, 1.1vw, 11px);
  font-weight: 600;
  opacity: 0.7;
  pointer-events: none;
}
.coord.file { bottom: 2px; right: 3px; }
.coord.rank { top: 2px; left: 3px; }
.light .coord { color: #b58863; }
.dark  .coord { color: #f0d9b5; }
.out-zone .coord { opacity: 0; }

/* ── Navigator ── */
.preview-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.nav-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
}
.nav-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 7px;
  cursor: pointer;
  font-size: 1rem;
}
.nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.nav-btn:not(:disabled):hover { background: #f0d9b5; }
.move-label-inline {
  font-size: 0.82rem;
  font-family: monospace;
  color: #90caf9;
  font-weight: 600;
}
.move-label {
  font-size: 0.82rem;
  font-family: monospace;
  min-width: 80px;
  text-align: center;
}

.zone-count {
  color: #eee;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Badges ── */
.badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}
.badge.ok    { background: #27ae60; color: #fff; }
.badge.warn  { background: #e67e22; color: #fff; }
.badge.error { background: #c0392b; color: #fff; }

/* ── Setup panel ── */
.setup-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  padding: 20px;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-section { display: flex; flex-direction: column; gap: 8px; }

.optional-label {
  font-size: 0.7rem;
  font-weight: 400;
  text-transform: none;
  opacity: 0.6;
}
.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #888;
}

.zone-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.zone-btn {
  padding: 5px 10px;
  border: 2px solid #b58863;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.12s;
}
.zone-btn.active { background: #b58863; color: #fff; }
.zone-btn:not(.active):hover { background: #f0d9b5; }

.slider {
  width: 100%;
  accent-color: #b58863;
}

.radio-group { display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem; }
.radio-group label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  flex-wrap: wrap;
}
.num-input {
  width: 52px;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 4px 6px;
  font-size: 0.88rem;
}
.scan-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: #b58863;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pgn-input {
  width: 100%;
  font-size: 0.78rem;
  font-family: monospace;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  resize: vertical;
}
.pgn-actions { display: flex; align-items: center; gap: 10px; }

.panel-btn.danger {
  background: #7b2020;
}
.panel-btn.danger:hover {
  background: #a33030;
}
.panel-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 7px;
  background: #b58863;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.panel-btn:hover { background: #9a7252; }

.start-btn {
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: #2ecc71;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.start-btn:hover:not(:disabled) { background: #27ae60; }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Game layout (study / recall / result) ── */
.game-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  max-width: 900px;
}

/* ── Side panel ── */
.side-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  padding: 20px;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-self: flex-start;
}

.phase-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1a1a1a;
  border-bottom: 2px solid #f0d9b5;
  padding-bottom: 10px;
}
.phase-hint { font-size: 0.78rem; color: #666; line-height: 1.55; }

/* ── Countdown ring ── */
.countdown-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  align-self: center;
}
.ring-svg { width: 80px; height: 80px; }
.countdown-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
  font-weight: 700;
  color: #b58863;
}

/* ── Palette ── */
.palette-section { display: flex; flex-direction: column; gap: 8px; }
.palette-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}
.palette-row { display: flex; flex-wrap: wrap; gap: 4px; }
.palette-piece {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 3px;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: grab;
  position: relative;
  transition: background 0.1s, border-color 0.1s;
}
.palette-piece:hover:not(.exhausted) { background: #f0d9b5; border-color: #b58863; }
.palette-piece.palette-selected { background: #f6f669; border-color: #cca700; box-shadow: 0 0 0 2px #cca700; }
.palette-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.palette-piece.exhausted { opacity: 0.25; cursor: not-allowed; }
.count-badge {
  position: absolute;
  top: 0; right: 0;
  font-size: 0.6rem;
  font-weight: 700;
  background: #b58863;
  color: #fff;
  border-radius: 8px;
  padding: 0 3px;
  line-height: 1.4;
}

/* ── Score & result ── */
.score-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f8f8f8;
  border-radius: 8px;
  padding: 14px;
}
.score-num { font-size: 1.8rem; font-weight: 700; color: #b58863; }
.score-label { font-size: 0.75rem; color: #888; }

.result-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.8rem;
  color: #444;
}
.legend-dot {
  display: inline-block;
  width: 12px; height: 12px;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
}
.legend-dot.correct { background: #27ae60; }
.legend-dot.wrong   { background: #e67e22; }
.legend-dot.missing { background: #c0392b; }
.legend-dot.extra   { background: #f1c40f; }

.result-actions { display: flex; flex-direction: column; gap: 8px; }

@media (max-width: 680px) {
  .setup-panel, .side-panel { width: 100%; max-width: 520px; }
  .viz-board.small { width: 90vw; height: 90vw; }
  .viz-board.large { width: 92vw; height: 92vw; }
}
</style>
