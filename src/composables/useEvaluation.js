import { ref, onUnmounted } from 'vue'

const LICHESS_EVAL_URL = 'https://lichess.org/api/cloud-eval'
const STOCKFISH_DEPTH = 18

/**
 * Formats a centipawn score to a human-readable string.
 * Positive = White advantage, negative = Black advantage.
 */
function formatScore(score, turn) {
  // Lichess returns score from the side to move; normalise to White
  const cp = turn === 'b' ? -score : score
  if (Math.abs(cp) > 9000) {
    const mate = Math.sign(cp) * Math.ceil((10000 - Math.abs(cp)) / 2)
    return mate > 0 ? `#${mate}` : `#${mate}`
  }
  const pawns = (cp / 100).toFixed(1)
  return cp > 0 ? `+${pawns}` : `${pawns}`
}

export function useEvaluation() {
  const evalScore = ref(null)   // string like '+0.4', '#3', null
  const evalDepth = ref(null)   // number
  const evalSource = ref(null)  // 'lichess' | 'stockfish'
  const evaluating = ref(false)

  let worker = null
  let currentFen = null
  let sfReady = false
  let pendingFen = null

  // ── Stockfish Worker ────────────────────────────────────────────────────────
  function initWorker() {
    if (worker) return
    try {
      worker = new Worker('/stockfish.js')
      worker.onmessage = onWorkerMessage
      worker.onerror = (e) => console.warn('Stockfish worker error:', e)
      worker.postMessage('uci')
    } catch (e) {
      console.warn('Stockfish worker failed to start:', e)
      worker = null
    }
  }

  function onWorkerMessage(e) {
    const line = e.data
    if (line === 'uciok') {
      worker.postMessage('isready')
      return
    }
    if (line === 'readyok') {
      sfReady = true
      if (pendingFen) {
        runStockfish(pendingFen)
        pendingFen = null
      }
      return
    }

    // Parse info lines for score
    if (line.startsWith('info') && line.includes('score cp') && line.includes(`depth ${STOCKFISH_DEPTH}`)) {
      const cpMatch = line.match(/score cp (-?\d+)/)
      const mateMatch = line.match(/score mate (-?\d+)/)
      const turn = currentFen?.split(' ')[1] // 'w' or 'b'

      if (mateMatch) {
        const mate = parseInt(mateMatch[1])
        // mate from side to move, normalise to White perspective
        const normalised = turn === 'b' ? -mate : mate
        evalScore.value = normalised > 0 ? `#${normalised}` : `#${normalised}`
        evalDepth.value = STOCKFISH_DEPTH
        evalSource.value = 'stockfish'
        evaluating.value = false
      } else if (cpMatch) {
        const cp = parseInt(cpMatch[1])
        evalScore.value = formatScore(cp, turn)
        evalDepth.value = STOCKFISH_DEPTH
        evalSource.value = 'stockfish'
        evaluating.value = false
      }
    }

    if (line.startsWith('bestmove')) {
      evaluating.value = false
    }
  }

  function runStockfish(fen) {
    if (!worker) return
    if (!sfReady) {
      pendingFen = fen
      return
    }
    worker.postMessage('stop')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go depth ${STOCKFISH_DEPTH}`)
  }

  // ── Lichess Cloud Eval ──────────────────────────────────────────────────────
  async function tryLichessEval(fen) {
    try {
      const url = `${LICHESS_EVAL_URL}?fen=${encodeURIComponent(fen)}&multiPv=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) return false

      const data = await res.json()
      const pv = data?.pvs?.[0]
      if (!pv) return false

      const turn = fen.split(' ')[1]
      if (pv.mate != null) {
        const normalised = turn === 'b' ? -pv.mate : pv.mate
        evalScore.value = normalised > 0 ? `#${normalised}` : `#${normalised}`
      } else if (pv.cp != null) {
        evalScore.value = formatScore(pv.cp, turn)
      } else {
        return false
      }

      evalDepth.value = data.depth
      evalSource.value = 'lichess'
      evaluating.value = false
      return true
    } catch {
      return false
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  async function evaluate(fen) {
    if (!fen) return
    currentFen = fen
    evaluating.value = true
    evalScore.value = null
    evalDepth.value = null
    evalSource.value = null

    // 1. Try Lichess cloud eval first (consistent, server-side)
    const ok = await tryLichessEval(fen)
    if (ok && currentFen === fen) return

    // 2. Fall back to local Stockfish WASM
    if (currentFen !== fen) return // a newer eval was requested
    initWorker()
    runStockfish(fen)
  }

  function stop() {
    if (worker && sfReady) worker.postMessage('stop')
    evaluating.value = false
  }

  onUnmounted(() => {
    if (worker) {
      worker.postMessage('quit')
      worker.terminate()
      worker = null
    }
  })

  return { evalScore, evalDepth, evalSource, evaluating, evaluate, stop }
}
