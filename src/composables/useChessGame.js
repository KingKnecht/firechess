import { ref, computed } from 'vue'
import { Chess } from 'chess.js'

export function useChessGame() {
  const chess = ref(new Chess())
  const fen = ref(chess.value.fen())
  const moveHistory = ref([])
  const selectedSquare = ref(null)
  const legalMoves = ref([])
  const status = ref('playing') // 'playing' | 'checkmate' | 'draw' | 'stalemate'
  const promotionPending = ref(null) // { from, to } when promotion needed

  const turn = computed(() => chess.value.turn()) // 'w' | 'b'
  const inCheck = computed(() => chess.value.inCheck())

  function updateStatus() {
    if (chess.value.isCheckmate()) {
      status.value = 'checkmate'
    } else if (chess.value.isStalemate()) {
      status.value = 'stalemate'
    } else if (chess.value.isDraw()) {
      status.value = 'draw'
    } else {
      status.value = 'playing'
    }
  }

  function selectSquare(square) {
    if (status.value !== 'playing') return false

    const piece = chess.value.get(square)

    // If a square is already selected
    if (selectedSquare.value) {
      // Try to move to the clicked square
      const moved = attemptMove(selectedSquare.value, square)
      if (moved) return true

      // If clicking own piece, re-select
      if (piece && piece.color === turn.value) {
        selectedSquare.value = square
        legalMoves.value = chess.value
          .moves({ square, verbose: true })
          .map((m) => m.to)
        return false
      }

      // Otherwise deselect
      selectedSquare.value = null
      legalMoves.value = []
      return false
    }

    // Select a piece of the current player
    if (piece && piece.color === turn.value) {
      selectedSquare.value = square
      legalMoves.value = chess.value
        .moves({ square, verbose: true })
        .map((m) => m.to)
    }

    return false
  }

  function attemptMove(from, to, promotion = 'q') {
    const moves = chess.value.moves({ square: from, verbose: true })
    const target = moves.find((m) => m.to === to)

    if (!target) {
      selectedSquare.value = null
      legalMoves.value = []
      return false
    }

    // Check if promotion is needed
    if (target.flags.includes('p') && !promotion) {
      promotionPending.value = { from, to }
      return false
    }

    const result = chess.value.move({ from, to, promotion })
    if (!result) return false

    fen.value = chess.value.fen()
    moveHistory.value.push(result)
    selectedSquare.value = null
    legalMoves.value = []
    promotionPending.value = null
    updateStatus()
    return true
  }

  function confirmPromotion(piece) {
    if (!promotionPending.value) return
    const { from, to } = promotionPending.value
    attemptMove(from, to, piece)
  }

  function undoMove() {
    if (moveHistory.value.length === 0) return
    chess.value.undo()
    moveHistory.value.pop()
    fen.value = chess.value.fen()
    selectedSquare.value = null
    legalMoves.value = []
    updateStatus()
  }

  function newGame() {
    chess.value = new Chess()
    fen.value = chess.value.fen()
    moveHistory.value = []
    selectedSquare.value = null
    legalMoves.value = []
    status.value = 'playing'
    promotionPending.value = null
  }

  function loadFen(newFen) {
    try {
      chess.value.load(newFen)
      fen.value = newFen
      moveHistory.value = []
      selectedSquare.value = null
      legalMoves.value = []
      updateStatus()
    } catch {
      // ignore invalid FEN
    }
  }

  function applyExternalMove(moveObj) {
    try {
      const result = chess.value.move(moveObj)
      if (result) {
        fen.value = chess.value.fen()
        moveHistory.value.push(result)
        updateStatus()
      }
    } catch {
      // ignore invalid move
    }
  }

  return {
    fen,
    turn,
    inCheck,
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
  }
}
