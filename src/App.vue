<template>
  <div class="app">
    <!-- Start / home screen -->
    <StartPage v-if="view === 'home'" @select="handleStartSelect" />

    <!-- Board editor -->
    <BoardEditor v-else-if="view === 'editor'" @back="goHome" />

    <!-- Visualization trainer -->
    <VisualizationTrainer v-else-if="view === 'visualization'" @back="goHome" />

    <!-- Game screen -->
    <template v-else>
      <header class="app-header">
        <button class="back-btn" @click="goHome">← Home</button>
        <h1>♛ FireChess</h1>
        <div class="header-spacer" />
      </header>

      <main class="app-main">
        <EvalBar
          :score="evalScore"
          :depth="evalDepth"
          :source="evalSource"
          :evaluating="evaluating"
        />

        <ChessBoard
          :fen="fen"
          :selected-square="selectedSquare"
          :legal-moves="legalMoves"
          :flipped="boardFlipped"
          :active-turn="turn"
          :my-color="mode === 'online' ? onlineMyColor : null"
          :promotion-pending="promotionPending"
          @square-click="onSquareClick"
          @drop="onDrop"
          @promote="confirmPromotion"
        />

        <GameControls
          v-model="mode"
          :turn="turn"
          :status="status"
          :move-history="moveHistory"
          :my-color="mode === 'online' ? onlineMyColor : null"
          @new-game="handleNewGame"
          @undo="undoMove"
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
import { useChessGame } from './composables/useChessGame.js'
import { useOnlineGame } from './composables/useOnlineGame.js'
import { useEvaluation } from './composables/useEvaluation.js'
import { useBotGame } from './composables/useBotGame.js'

const {
  fen,
  turn,
  moveHistory,
  selectedSquare,
  legalMoves,
  status,
  promotionPending,
  selectSquare,
  attemptMove,
  confirmPromotion,
  undoMove,
  newGame,
  loadFen,
  applyExternalMove,
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
  leaveRoom,
} = useOnlineGame()

const { evalScore, evalDepth, evalSource, evaluating, evaluate, stop } = useEvaluation()
const { botThinking, requestMove } = useBotGame()

const mode = ref('local')
const view = ref('home')

// Bot plays as Black; player is White
const BOT_COLOR = 'b'

function handleStartSelect({ mode: selectedMode, timeControl, trainingMode }) {
  if (selectedMode === 'training') {
    if (trainingMode === 'board-editor') { view.value = 'editor'; return }
    if (trainingMode === 'visualization') { view.value = 'visualization'; return }
    mode.value = 'local'
  } else if (selectedMode === 'bot') {
    mode.value = 'stockfish'
  } else {
    mode.value = selectedMode
  }
  newGame()
  view.value = 'game'
}

function goHome() {
  if (mode.value === 'online' && onlineRoomId.value) leaveRoom()
  view.value = 'home'
}

const boardFlipped = computed(() =>
  mode.value === 'online' && onlineMyColor.value === 'b'
)

// Re-evaluate whenever FEN changes (i.e. after every move)
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
  if (turn.value !== BOT_COLOR) return

  const uciMove = await requestMove(newFen)
  if (!uciMove) return
  // UCI format: "e2e4" or "e7e8q" (promotion)
  const from = uciMove.slice(0, 2)
  const to = uciMove.slice(2, 4)
  const promotion = uciMove.length === 5 ? uciMove[4] : undefined
  applyExternalMove({ from, to, promotion })
})

function onSquareClick(square) {
  if (mode.value === 'online' && turn.value !== onlineMyColor.value) return
  if (mode.value === 'stockfish' && turn.value === BOT_COLOR) return
  const moved = selectSquare(square)
  if (moved && mode.value === 'online') {
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    pushMove(onlineRoomId.value, fen.value, lastMove)
  }
}

function onDrop({ from, to }) {
  if (mode.value === 'online' && turn.value !== onlineMyColor.value) return
  if (mode.value === 'stockfish' && turn.value === BOT_COLOR) return
  const moved = attemptMove(from, to)
  if (moved && mode.value === 'online') {
    const lastMove = moveHistory.value[moveHistory.value.length - 1]
    pushMove(onlineRoomId.value, fen.value, lastMove)
  }
}

function handleNewGame() {
  newGame()
}

async function handleCreateRoom() {
  newGame()
  const id = await createRoom()
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
  leaveRoom()
  newGame()
}

let lastSyncedFen = null

function startOnlineSync(id) {
  lastSyncedFen = fen.value
  subscribeToRoom(id, (data) => {
    if (data.fen && data.fen !== lastSyncedFen) {
      lastSyncedFen = data.fen
      if (data.lastMove) {
        applyExternalMove(data.lastMove)
      } else {
        loadFen(data.fen)
      }
    }
  })
}

onMounted(() => {
  const params = new URLSearchParams(location.search)
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
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #2c2c2c;
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

.header-spacer { width: 90px; }

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
  background: #fff;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  align-self: flex-start;
}

@media (max-width: 700px) {
  .app-main { flex-direction: column; align-items: center; }
}
</style>
