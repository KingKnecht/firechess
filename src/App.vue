<template>
  <div class="app">
    <!-- Start / home screen -->
    <StartPage v-if="view === 'home'" @select="handleStartSelect" @settings="openSettings" />

    <!-- Settings page -->
    <SettingsPage v-else-if="view === 'settings'" @back="view = prevView" />

    <!-- Board editor -->
    <BoardEditor v-else-if="view === 'editor'" @back="goHome" />

    <!-- Visualization trainer -->
    <VisualizationTrainer v-else-if="view === 'visualization'" @back="goHome" />

    <!-- Opening trainer -->
    <OpeningTrainer v-else-if="view === 'openings'" @back="goHome" />

    <!-- Bot settings screen -->
    <BotSettings v-else-if="view === 'bot-settings'" @back="goHome" @start="handleBotStart" />

    <!-- Game screen -->
    <template v-else>
      <header class="app-header">
        <button class="back-btn" @click="goHome">← Home</button>
        <h1>♛ FireChess</h1>
        <button class="settings-btn" @click="openSettings" title="Settings">⚙️</button>
      </header>

      <main class="app-main">
        <div class="board-area">
          <EvalBar
            :score="evalScore"
            :depth="evalDepth"
            :source="evalSource"
            :evaluating="evaluating"
          />

          <ChessBoard
          :fen="viewFen"
          :selected-square="isViewingHistory ? null : selectedSquare"
          :legal-moves="isViewingHistory ? [] : legalMoves"
          :flipped="boardFlipped"
          :active-turn="turn"
          :my-color="mode === 'online' ? onlineMyColor : null"
          :promotion-pending="promotionPending"
          :show-all-square-names="showAllSquareNames"
          :show-move-flash="showMoveFlash"
          :last-move-to="lastMoveTo"
          @square-click="onSquareClick"
          @drop="onDrop"
          @promote="confirmPromotion"
        />
        </div>

        <GameControls
          v-model="mode"
          :turn="turn"
          :status="status"
          :resigned-color="resignedColor"
          :move-history="moveHistory"
          :my-color="mode === 'online' ? onlineMyColor : null"
          :player-color="mode === 'stockfish' ? playerColor : null"
          :bot-thinking="botThinking"
          :allow-undo="mode === 'stockfish' ? allowUndo : true"
          :view-pos="viewPos"
          :is-viewing-history="isViewingHistory"
          :white-time="timeControl ? whiteTime : null"
          :black-time="timeControl ? blackTime : null"
          :white-low="whiteLow"
          :black-low="blackLow"
          :clock-active="clockActiveSide"
          :clock-running="clockRunning"
          @new-game="handleNewGame"
          @undo="handleUndo"
          @home="goHome"
          @resign="handleResign"
          @offer-draw="handleOfferDraw"
          @go-first="goFirst"
          @go-prev="goPrev"
          @go-next="goNext"
          @go-last="goLast"
          @go-to="goTo"
        >
          <template #online>
            <OnlineLobby
              :room-id="onlineRoomId"
              :my-color="onlineMyColor"
              :opponent-connected="opponentConnected"
              :loading="onlineLoading"
              :error="onlineError"
              @create="handleCreateRoom"
              @join="handleJoinRoom"
              @leave="handleLeaveRoom"
            />
          </template>
        </GameControls>
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import ChessBoard from './components/ChessBoard.vue'
import GameControls from './components/GameControls.vue'
import OnlineLobby from './components/OnlineLobby.vue'
import EvalBar from './components/EvalBar.vue'
import StartPage from './components/StartPage.vue'
import BoardEditor from './components/BoardEditor.vue'
import VisualizationTrainer from './components/VisualizationTrainer.vue'
import OpeningTrainer from './components/OpeningTrainer.vue'
import BotSettings from './components/BotSettings.vue'
import SettingsPage from './components/SettingsPage.vue'
import { useChessGame } from './composables/useChessGame.js'
import { useOnlineGame } from './composables/useOnlineGame.js'
import { useEvaluation } from './composables/useEvaluation.js'
import { useBotGame } from './composables/useBotGame.js'
import { useChessClock } from './composables/useChessClock.js'
import { useSound } from './composables/useSound.js'
import { showAllSquareNames, showMoveFlash, moveFlashContent } from './composables/useSettings.js'
import { handleLichessCallback } from './composables/useLichessAuth.js'

const {
  fen,
  turn,
  moveHistory,
  selectedSquare,
  legalMoves,
  status,
  resignedColor,
  promotionPending,
  viewFen,
  viewPos,
  isViewingHistory,
  selectSquare,
  attemptMove,
  confirmPromotion,
  undoMove,
  newGame,
  loadFen,
  applyExternalMove,
  resign,
  lostOnTime,
  acceptDraw,
  goFirst,
  goPrev,
  goNext,
  goLast,
  goTo,
} = useChessGame()

const {
  roomId: onlineRoomId,
  myColor: onlineMyColor,
  opponentConnected,
  error: onlineError,
  loading: onlineLoading,
  createRoom,
  joinRoom,
  subscribeToRoom,
  pushMove,
  pushResign,
  pushDraw,
  leaveRoom,
} = useOnlineGame()

const { evalScore, evalDepth, evalSource, evaluating, evaluate, stop } = useEvaluation()
const { botThinking, requestMove, setSkill } = useBotGame()
const {
  whiteTime, blackTime, whiteLow, blackLow, flagged: clockFlagged,
  activeSide: clockActiveSide, running: clockRunning, increment: clockIncrement,
  init: clockInit, afterMove: clockAfterMove, stop: clockStop,
  syncFromServer: clockSyncFromServer, getAccurateSnapshot: clockGetAccurateSnapshot,
} = useChessClock()
const { playSound } = useSound()

// ─────────────────────────────────────────────────────────────────────────────
const mode = ref('local')
const view = ref('home')
const prevView = ref('home')
const timeControl = ref(null)

function openSettings() {
  prevView.value = view.value
  view.value = 'settings'
}

// Track last move destination for board flash animation
const lastMoveTo = ref(null)
watch(() => moveHistory.value.length, () => {
  const hist = moveHistory.value
  if (!hist.length) { lastMoveTo.value = null; return }
  const last = hist[hist.length - 1]
  lastMoveTo.value = moveFlashContent.value === 'pgn' ? (last?.san ?? null) : (last?.to ?? null)
})

// Colors: playerColor = color player chose; BOT_COLOR = opposite
const playerColor = ref('w')
const botColor    = computed(() => playerColor.value === 'w' ? 'b' : 'w')
const allowUndo   = ref(true)

function handleStartSelect({ mode: selectedMode, timeControl: tc, trainingMode }) {
  if (selectedMode === 'training') {
    if (trainingMode === 'board-editor') { view.value = 'editor'; return }
    if (trainingMode === 'visualization') { view.value = 'visualization'; return }
    if (trainingMode === 'openings') { view.value = 'openings'; return }
    mode.value = 'local'
  } else if (selectedMode === 'bot') {
    timeControl.value = tc ?? null
    view.value = 'bot-settings'
    return
  } else {
    mode.value = selectedMode
  }
  timeControl.value = tc ?? null
  newGame()
  if (tc) clockInit(tc.minutes, tc.increment)
  else    clockStop()
  view.value = 'game'
}

function handleBotStart({ playerColor: pColor, skillLevel, fen: startFen, allowUndo: canUndo }) {
  playerColor.value = pColor
  allowUndo.value = canUndo
  mode.value = 'stockfish'
  setSkill(skillLevel)
  newGame()
  if (startFen) loadFen(startFen)
  const tc = timeControl.value
  if (tc) clockInit(tc.minutes, tc.increment)
  else    clockStop()
  view.value = 'game'
}

function goHome() {
  if (status.value === 'playing' && moveHistory.value.length > 0) {
    const inOnline = mode.value === 'online'
    const msg = inOnline
      ? 'Leaving will forfeit the game and count as a loss. Are you sure?'
      : 'Leave the current game? Your progress will be lost.'
    if (!window.confirm(msg)) return
  }
  if (mode.value === 'online' && onlineRoomId.value) {
    if (status.value === 'playing') pushResign(onlineRoomId.value, onlineMyColor.value)
    leaveRoom()
  }
  view.value = 'home'
}

function handleResign(color) {
  resign(color)
  if (mode.value === 'online' && onlineRoomId.value) {
    pushResign(onlineRoomId.value, color)
  }
}

function handleOfferDraw() {
  acceptDraw()
  // Online draw would need two-way signaling; local only for now
}

const boardFlipped = computed(() => {
  if (mode.value === 'online') return onlineMyColor.value === 'b'
  if (mode.value === 'stockfish') return playerColor.value === 'b'
  return false
})

// Clock: start ticking after first move; add increment and switch side after each move
// In online mode the clock is driven by Firestore snapshots, not this watcher.
watch(moveHistory, (hist) => {
  if (!timeControl.value || mode.value === 'online') return
  if (hist.length === 0) return
  const lastMove = hist[hist.length - 1]
  const side = lastMove.color // 'w' or 'b'
  clockAfterMove(side)
}, { deep: true })

// Stop clock when game ends
watch(status, (s) => {
  if (s !== 'playing') clockStop()
})

// Auto-resign on flag (time out)
watch(clockFlagged, (side) => {
  if (side && status.value === 'playing') lostOnTime(side)
})

// Play low-time warning once when a clock first drops below threshold
watch(whiteLow, (isLow) => { if (isLow) playSound('lowTime') })
watch(blackLow, (isLow) => { if (isLow) playSound('lowTime') })


watch(fen, (newFen) => {
  if (status.value === 'playing') {
    evaluate(newFen)
  } else {
    stop()
  }
}, { immediate: true })

// Bot move trigger: fires when it's the bot's turn in stockfish mode
watch([fen, mode], async ([newFen, newMode]) => {
  if (newMode !== 'stockfish') return
  if (status.value !== 'playing') return
  if (turn.value !== botColor.value) return

  const uciMove = await requestMove(newFen)
  if (!uciMove) return
  if (status.value !== 'playing') return  // guard: player may have resigned while bot was thinking
  // UCI format: "e2e4" or "e7e8q" (promotion)
  const from = uciMove.slice(0, 2)
  const to = uciMove.slice(2, 4)
  const promotion = uciMove.length === 5 ? uciMove[4] : undefined
  applyExternalMove({ from, to, promotion })
})

function onSquareClick(square) {
  if (mode.value === 'online' && turn.value !== onlineMyColor.value) return
  if (mode.value === 'stockfish' && turn.value !== playerColor.value) return
  const moved = selectSquare(square)
  if (moved && mode.value === 'online') {
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    const clockData = buildOnlineClockData(lastMove.color)
    clockAfterMove(lastMove.color)
    pushMove(onlineRoomId.value, fen.value, lastMove, clockData)
  }
}

function onDrop({ from, to }) {
  if (mode.value === 'online' && turn.value !== onlineMyColor.value) return
  if (mode.value === 'stockfish' && turn.value !== playerColor.value) return
  const moved = attemptMove(from, to)
  if (moved && mode.value === 'online') {
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    const clockData = buildOnlineClockData(lastMove.color)
    clockAfterMove(lastMove.color)
    pushMove(onlineRoomId.value, fen.value, lastMove, clockData)
  }
}

function buildOnlineClockData(movingColor) {
  if (!timeControl.value) return null
  const snap = clockGetAccurateSnapshot()
  const inc = clockIncrement.value
  const nextSide = movingColor === 'w' ? 'b' : 'w'
  return {
    whiteMs: movingColor === 'w' ? snap.whiteMs + inc : snap.whiteMs,
    blackMs: movingColor === 'b' ? snap.blackMs + inc : snap.blackMs,
    activeSide: nextSide,
  }
}

function handleNewGame() {
  newGame()
}

function handleUndo() {
  if (mode.value === 'stockfish') {
    // Undo bot move + player move to return to player's last turn
    undoMove() // undo bot's last move
    undoMove() // undo player's last move
  } else {
    undoMove()
  }
}

async function handleCreateRoom() {
  newGame()
  const id = await createRoom(timeControl.value)
  if (id) startOnlineSync(id)
}

async function handleJoinRoom(id) {
  const ok = await joinRoom(id)
  if (ok) {
    newGame()
    startOnlineSync(id)
  }
}

function handleLeaveRoom() {
  if (status.value === 'playing' && onlineRoomId.value && onlineMyColor.value) {
    pushResign(onlineRoomId.value, onlineMyColor.value)
  }
  leaveRoom()
  newGame()
}

let lastSyncedFen = null

function startOnlineSync(id) {
  lastSyncedFen = fen.value
  subscribeToRoom(id, (data) => {
    // Sync time control from creator (authoritative)
    if (data.timeControl && !timeControl.value) {
      timeControl.value = data.timeControl
      clockInit(data.timeControl.minutes, data.timeControl.increment)
    }

    if (data.fen && data.fen !== lastSyncedFen) {
      lastSyncedFen = data.fen
      if (data.lastMove) {
        applyExternalMove(data.lastMove)
      } else {
        loadFen(data.fen)
      }
    }

    // Sync clock from server: re-anchor using serverTimestamp so tab-switching can't freeze the clock
    if (data.clockLastMoveAt && data.clockActiveSide) {
      const serverMoveMs = data.clockLastMoveAt.toMillis()
      const elapsedSinceMove = Math.max(0, Date.now() - serverMoveMs)
      let wMs = data.clockWhiteMs ?? 0
      let bMs = data.clockBlackMs ?? 0
      if (data.clockActiveSide === 'w') wMs = Math.max(0, wMs - elapsedSinceMove)
      else bMs = Math.max(0, bMs - elapsedSinceMove)
      clockSyncFromServer(wMs, bMs, data.clockActiveSide)
    }

    // Handle resign/draw signals from opponent
    if (data.status === 'resigned' && data.resignedColor && status.value === 'playing') {
      resign(data.resignedColor)
    }
    if (data.status === 'draw' && status.value === 'playing') {
      acceptDraw()
    }
  })
}

onMounted(async () => {
  const params = new URLSearchParams(location.search)

  // Handle Lichess OAuth callback
  const code = params.get('code')
  if (code) {
    await handleLichessCallback(code)
    // Clean up URL so code isn't visible / re-processed
    const clean = window.location.pathname
    window.history.replaceState({}, '', clean)
  }

  const roomParam = params.get('room')
  if (roomParam) {
    mode.value = 'online'
    view.value = 'game'
    handleJoinRoom(roomParam)
  }
})

watch(mode, (newMode, oldMode) => {
  if (oldMode === 'online' && newMode !== 'online' && onlineRoomId.value) {
    leaveRoom()
  }
  newGame()
})
</script>

<style>
/* ── Theme variables ─────────────────────────────────────────────────────── */
:root {
  color-scheme: dark light;
  --bg-page:      #1a1a1a;
  --bg-page-alt:  #2c2c2c;
  --bg-header:    #111;
  --bg-panel:     #1e1e1e;
  --bg-surface:   #2a2a2a;
  --bg-input:     #111;
  --bg-active:    #3a2e20;
  --text-primary: #f0d9b5;
  --text-on-dark: #f0d9b5;
  --text-muted:   #888;
  --text-dim:     #666;
  --border:       #333;
  --border-mid:   #444;
  --btn-hover:    rgba(240,217,181,0.15);
  --seg-hover-bg: #333;
  --seg-hover-text: #f0d9b5;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg-page:      #f5f0e8;
    --bg-page-alt:  #ede8dc;
    --bg-header:    #111;
    --bg-panel:     #e8e2d8;
    --bg-surface:   #ddd8cc;
    --bg-input:     #f0ebe0;
    --bg-active:    #f5e8d5;
    --text-primary: #1a1a1a;
    --text-on-dark: #f0d9b5;
    --text-muted:   #666;
    --text-dim:     #999;
    --border:       #d0c8bc;
    --border-mid:   #c0b8ae;
    --btn-hover:    rgba(0,0,0,0.08);
    --seg-hover-bg: #ddd8cc;
    --seg-hover-text: #1a1a1a;
  }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg-page-alt);
  color: #222;
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: #1a1a1a;
  color: #f0d9b5;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.app-header h1 {
  font-size: clamp(1.4rem, 3vw, 2rem);
  letter-spacing: 2px;
  text-align: center;
  flex: 1;
}

.back-btn {
  background: none;
  border: 1px solid #f0d9b5;
  color: #f0d9b5;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.back-btn:hover { background: rgba(240,217,181,0.15); }

.settings-btn {
  background: none;
  border: 1px solid transparent;
  color: #f0d9b5;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  line-height: 1;
  min-width: 90px;
  text-align: right;
}
.settings-btn:hover { background: rgba(240,217,181,0.15); border-color: #f0d9b5; }

.board-area {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.app-main {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: 16px;
  padding: 24px;
}

.app-main > :last-child {
  background: var(--bg-panel);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  align-self: flex-start;
}

@media (max-width: 700px) {
  .app-main { flex-direction: column; align-items: center; }
}
</style>
