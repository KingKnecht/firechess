import { ref, computed } from 'vue'

export function useChessClock() {
  const whiteMs  = ref(0)
  const blackMs  = ref(0)
  const increment = ref(0)
  const running  = ref(false)
  const activeSide = ref('w') // whose clock is ticking
  let   _interval = null
  let   _lastTick = null // wall-clock timestamp of the previous tick

  function _tick() {
    if (!running.value) return
    const now = Date.now()
    const elapsed = _lastTick !== null ? now - _lastTick : 100
    _lastTick = now
    if (activeSide.value === 'w') {
      whiteMs.value = Math.max(0, whiteMs.value - elapsed)
      if (whiteMs.value === 0) { running.value = false; clearInterval(_interval) }
    } else {
      blackMs.value = Math.max(0, blackMs.value - elapsed)
      if (blackMs.value === 0) { running.value = false; clearInterval(_interval) }
    }
  }

  function init(minutes, inc = 0) {
    stop()
    const ms = minutes * 60 * 1000
    whiteMs.value  = ms
    blackMs.value  = ms
    increment.value = inc * 1000
    activeSide.value = 'w'
    running.value  = false
  }

  function start(side) {
    activeSide.value = side
    if (!running.value) {
      running.value = true
      _lastTick = Date.now()
      _interval = setInterval(_tick, 100)
    }
  }

  // Called after a move is made by `side` — add increment then switch to opponent
  function afterMove(side) {
    if (!running.value && whiteMs.value === 0 && blackMs.value === 0) return
    if (side === 'w') whiteMs.value += increment.value
    else              blackMs.value += increment.value
    const next = side === 'w' ? 'b' : 'w'
    activeSide.value = next
    if (!running.value) {
      running.value = true
      _lastTick = Date.now()
      _interval = setInterval(_tick, 100)
    }
  }

  function stop() {
    running.value = false
    clearInterval(_interval)
    _interval = null
    _lastTick = null
  }

  function formatMs(ms) {
    const total = Math.ceil(ms / 1000)
    const h   = Math.floor(total / 3600)
    const m   = Math.floor((total % 3600) / 60)
    const s   = total % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${m}:${String(s).padStart(2,'0')}`
  }

  const whiteTime = computed(() => formatMs(whiteMs.value))
  const blackTime = computed(() => formatMs(blackMs.value))
  const whiteLow  = computed(() => whiteMs.value < 30_000)
  const blackLow  = computed(() => blackMs.value < 30_000)
  const flagged   = computed(() => {
    if (whiteMs.value === 0) return 'w'
    if (blackMs.value === 0) return 'b'
    return null
  })

  // Re-anchor the clock from authoritative server values (online mode)
  function syncFromServer(wMs, bMs, side) {
    if (_interval) clearInterval(_interval)
    _interval = null
    whiteMs.value = wMs
    blackMs.value = bMs
    activeSide.value = side
    if (wMs > 0 && bMs > 0) {
      running.value = true
      _lastTick = Date.now()
      _interval = setInterval(_tick, 100)
    } else {
      running.value = false
      _lastTick = null
    }
  }

  // Returns current remaining times accounting for un-ticked elapsed time
  function getAccurateSnapshot() {
    const now = Date.now()
    const extra = running.value && _lastTick !== null ? now - _lastTick : 0
    const wMs = activeSide.value === 'w' ? Math.max(0, whiteMs.value - extra) : whiteMs.value
    const bMs = activeSide.value === 'b' ? Math.max(0, blackMs.value - extra) : blackMs.value
    return { whiteMs: wMs, blackMs: bMs, activeSide: activeSide.value }
  }

  return { whiteTime, blackTime, whiteLow, blackLow, flagged, activeSide, running, increment, init, start, afterMove, stop, syncFromServer, getAccurateSnapshot }
}
