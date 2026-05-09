import { ref, onUnmounted } from 'vue'

export function useBotGame() {
  const botSkill = ref(10)   // 0–20 (Stockfish Skill Level)
  const botThinking = ref(false)

  let worker = null
  let sfReady = false
  let pendingRequest = null  // { fen, resolve }

  function initWorker() {
    if (worker) return
    worker = new Worker('/stockfish.js')
    worker.onerror = (e) => console.warn('Bot worker error:', e)
    worker.onmessage = onMessage
    worker.postMessage('uci')
  }

  function onMessage(e) {
    const line = e.data

    if (line === 'uciok') {
      worker.postMessage('isready')
      return
    }

    if (line === 'readyok') {
      sfReady = true
      applySkill()
      if (pendingRequest) {
        runSearch(pendingRequest.fen, pendingRequest.resolve)
        pendingRequest = null
      }
      return
    }

    if (line.startsWith('bestmove') && pendingRequest === null) {
      // already consumed by runSearch's internal handler
    }
  }

  function applySkill() {
    if (!worker || !sfReady) return
    worker.postMessage(`setoption name Skill Level value ${botSkill.value}`)
  }

  function runSearch(fen, resolve) {
    // movetime scales with skill: 100ms (lvl 0) → 2000ms (lvl 20)
    const movetime = 100 + botSkill.value * 95

    const handler = (e) => {
      const line = e.data
      if (line.startsWith('bestmove')) {
        worker.removeEventListener('message', handler)
        botThinking.value = false
        const parts = line.split(' ')
        const uciMove = parts[1]
        resolve(uciMove && uciMove !== '(none)' ? uciMove : null)
      }
    }

    worker.addEventListener('message', handler)
    worker.postMessage('stop')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage(`go movetime ${movetime}`)
  }

  /**
   * Ask Stockfish for the best move in the given position.
   * Returns a Promise<string|null> with a UCI move like "e2e4" or null.
   */
  function requestMove(fen) {
    if (!worker) initWorker()
    botThinking.value = true

    return new Promise((resolve) => {
      if (!sfReady) {
        pendingRequest = { fen, resolve }
      } else {
        applySkill()
        runSearch(fen, resolve)
      }
    })
  }

  function setSkill(level) {
    botSkill.value = Math.max(0, Math.min(20, level))
    applySkill()
  }

  onUnmounted(() => {
    if (worker) {
      worker.postMessage('quit')
      worker.terminate()
      worker = null
    }
  })

  return { botSkill, botThinking, requestMove, setSkill }
}
