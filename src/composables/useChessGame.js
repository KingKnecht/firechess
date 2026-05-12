import { ref, shallowRef, triggerRef, computed } from 'vue'
import { Chess } from 'chess.js'
import { useSound } from './useSound.js'

export function useChessGame() {
  const { playSound } = useSound()
  const chess = shallowRef(new Chess())
  const fen = ref(chess.value.fen())
  const fenHistory = ref([chess.value.fen()])  // fenHistory[i] = position after move i (0 = start)
  const moveHistory = ref([])
  const selectedSquare = ref(null)
  const legalMoves = ref([])
  const status = ref('playing') // 'playing' | 'checkmate' | 'draw' | 'stalemate' | 'resigned'
  const promotionPending = ref(null)
  const resignedColor = ref(null)

  // null = at current (last) position; number = browsing index into fenHistory
  const viewIndex = ref(null)

  const turn = computed(() => chess.value.turn())
  const inCheck = computed(() => chess.value.inCheck())

  const viewFen = computed(() =>
    viewIndex.value === null ? fen.value : fenHistory.value[viewIndex.value]
  )
  // True when user is viewing a past position (not the live game state)
  const isViewingHistory = computed(() =>
    viewIndex.value !== null && viewIndex.value < fenHistory.value.length - 1
  )
  // Current browse position as a move number (0 = before any moves)
  const viewPos = computed(() =>
    viewIndex.value === null ? fenHistory.value.length - 1 : viewIndex.value
  )

  function goFirst() { viewIndex.value = 0 }
  function goLast()  { viewIndex.value = null }
  function goPrev()  {
    const cur = viewPos.value
    if (cur > 0) viewIndex.value = cur - 1
  }
  function goNext()  {
    const cur = viewPos.value
    if (cur < fenHistory.value.length - 1) {
      viewIndex.value = cur + 1 === fenHistory.value.length - 1 ? null : cur + 1
    }
  }
  function goTo(idx) {
    if (idx < 0 || idx >= fenHistory.value.length) return
    viewIndex.value = idx === fenHistory.value.length - 1 ? null : idx
  }

  function updateStatus() {
    // Don't overwrite manually set terminal states (resigned, draw by agreement)
    if (status.value === 'resigned') return
    if (status.value === 'timeout') return
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
    if (isViewingHistory.value) return false

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
      playSound('select')
    }

    return false
  }

  function attemptMove(from, to, promotion = 'q') {
    if (status.value !== 'playing') return false  // guard against moves after game over
    if (isViewingHistory.value) return false       // guard against moves while browsing
    const moves = chess.value.moves({ square: from, verbose: true })
    const target = moves.find((m) => m.to === to)

    if (!target) {
      selectedSquare.value = null
      legalMoves.value = []
      playSound('outOfBound')
      return false
    }

    // Check if promotion is needed
    if (target.flags.includes('p') && !promotion) {
      promotionPending.value = { from, to }
      return false
    }

    const result = chess.value.move({ from, to, promotion })
    if (!result) return false

    triggerRef(chess)
    fen.value = chess.value.fen()
    fenHistory.value.push(fen.value)
    moveHistory.value.push(result)
    selectedSquare.value = null
    legalMoves.value = []
    promotionPending.value = null
    updateStatus()
    playSound(result.captured ? 'capture' : 'move')
    return true
  }

  function confirmPromotion(piece) {
    if (!promotionPending.value) return
    const { from, to } = promotionPending.value
    attemptMove(from, to, piece)
  }

  function undoMove() {
    if (moveHistory.value.length === 0) return
    viewIndex.value = null  // snap back to current before undoing
    chess.value.undo()
    triggerRef(chess)
    moveHistory.value.pop()
    fenHistory.value.pop()
    fen.value = chess.value.fen()
    selectedSquare.value = null
    legalMoves.value = []
    updateStatus()
  }

  function resign(color) {
    resignedColor.value = color
    status.value = 'resigned'
    selectedSquare.value = null
    legalMoves.value = []
  }

  function lostOnTime(color) {
    resignedColor.value = color   // reuse same ref — stores whose flag fell
    status.value = 'timeout'
    selectedSquare.value = null
    legalMoves.value = []
  }

  function acceptDraw() {
    status.value = 'draw'
    selectedSquare.value = null
    legalMoves.value = []
  }

  function newGame() {
    chess.value = new Chess()
    fen.value = chess.value.fen()
    fenHistory.value = [chess.value.fen()]
    moveHistory.value = []
    selectedSquare.value = null
    legalMoves.value = []
    status.value = 'playing'
    promotionPending.value = null
    resignedColor.value = null
    viewIndex.value = null
  }

  function loadFen(newFen) {
    try {
      chess.value.load(newFen)
      triggerRef(chess)
      fen.value = newFen
      fenHistory.value = [newFen]
      moveHistory.value = []
      selectedSquare.value = null
      legalMoves.value = []
      updateStatus()
    } catch {
      // ignore invalid FEN
    }
  }

  function applyExternalMove(moveObj) {
    if (status.value !== 'playing') return  // ignore moves after game over
    try {
      const result = chess.value.move(moveObj)
      if (result) {
        triggerRef(chess)
        fen.value = chess.value.fen()
        fenHistory.value.push(fen.value)
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
  }
}
