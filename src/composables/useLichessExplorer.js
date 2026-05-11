import { ref, watch } from 'vue'
import { lichessToken, lichessUser } from './useLichessAuth.js'

const EXPLORER_URL = 'https://explorer.lichess.ovh/lichess'

// All rating buckets supported by the Lichess opening explorer
const ALL_BUCKETS = [1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500]

// Buckets for "best response" data shown when it's the user's turn
export const MASTER_BUCKETS = [2000, 2200, 2500]

// Slider constants (exported so the component can bind them)
export const EXPLORER_RMIN  = 800
export const EXPLORER_RMAX  = 2800
export const EXPLORER_RSTEP = 100

const RANGE_KEY = 'lichess_explorer_range'

// ── Persisted ELO range ───────────────────────────────────────────────────────
function loadRange() {
  try { return JSON.parse(localStorage.getItem(RANGE_KEY) ?? 'null') } catch { return null }
}
function saveRange(min, max) {
  try { localStorage.setItem(RANGE_KEY, JSON.stringify({ min, max })) } catch {}
}

const _stored = loadRange()
export const explorerRangeMin = ref(_stored?.min ?? 1400)
export const explorerRangeMax = ref(_stored?.max ?? 2000)

watch([explorerRangeMin, explorerRangeMax], ([min, max]) => saveRange(min, max))

// Called (via watch below) when the Lichess user first loads with a rating.
// Sets the default range to ±250 of their ELO — only if no custom range was stored yet.
function initRangeFromUser(rating) {
  if (!rating || loadRange()) return
  explorerRangeMin.value = Math.max(EXPLORER_RMIN, rating - 250)
  explorerRangeMax.value = Math.min(EXPLORER_RMAX, rating + 250)
}

watch(lichessUser, (user) => {
  if (user?.rating) initRangeFromUser(user.rating)
}, { immediate: true })

// ── Bucket selection ──────────────────────────────────────────────────────────
export function bucketsForRange(min, max) {
  const selected = ALL_BUCKETS.filter(b => b >= min && b <= max)
  return selected.length > 0 ? selected : ALL_BUCKETS
}

// ── Cache: cacheKey → API response ───────────────────────────────────────────
const _cache = new Map()

function cacheKey(fen, buckets) {
  return fen + '|' + buckets.join(',')
}

// Low-level fetch — returns data, 'auth', or null
async function _fetchRaw(fen, buckets) {
  try {
    const params = new URLSearchParams({ fen, topGames: 0, recentGames: 0 })
    buckets.forEach(b => params.append('ratings[]', b))
    ;['rapid', 'blitz', 'classical', 'bullet'].forEach(s => params.append('speeds[]', s))
    const resp = await fetch(`${EXPLORER_URL}?${params}`, {
      headers: { Authorization: `Bearer ${lichessToken.value}` },
    })
    if (resp.status === 401) return 'auth'
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

// ── Current-position reactive state ──────────────────────────────────────────
export const explorerData      = ref(null)
export const explorerLoading   = ref(false)
export const explorerError     = ref(null)   // null | 'auth' | 'network'
export const explorerIsMasters = ref(false)  // true when showing master-level data

let _debounceTimer = null

export function fetchExplorer(fen, { debounce = true, buckets = null } = {}) {
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => _doFetch(fen, buckets), debounce ? 450 : 0)
}

async function _doFetch(fen, bucketsOverride) {
  if (!lichessToken.value) {
    explorerData.value = null
    explorerError.value = null
    explorerIsMasters.value = false
    return
  }
  const buckets = bucketsOverride ?? bucketsForRange(explorerRangeMin.value, explorerRangeMax.value)
  const key = cacheKey(fen, buckets)
  explorerIsMasters.value = !!bucketsOverride

  if (_cache.has(key)) {
    explorerData.value = _cache.get(key)
    explorerError.value = null
    return
  }

  explorerLoading.value = true
  explorerError.value = null
  try {
    const data = await _fetchRaw(fen, buckets)
    if (data === 'auth') { explorerError.value = 'auth'; explorerData.value = null; return }
    if (!data)           { explorerError.value = 'network'; explorerData.value = null; return }
    _cache.set(key, data)
    explorerData.value = data
  } finally {
    explorerLoading.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function movesFreqMap(data) {
  if (!data?.moves?.length) return new Map()
  const posTotal = data.moves.reduce((s, m) => s + m.white + m.draws + m.black, 0)
  if (!posTotal) return new Map()
  return new Map(data.moves.map(m => {
    const total = m.white + m.draws + m.black
    return [m.san, { total, pct: Math.round(total / posTotal * 100) }]
  }))
}

export function getCachedExplorer(fen) {
  const buckets = bucketsForRange(explorerRangeMin.value, explorerRangeMax.value)
  return _cache.get(cacheKey(fen, buckets)) ?? null
}

export function eloLabel() {
  const buckets = bucketsForRange(explorerRangeMin.value, explorerRangeMax.value)
  if (buckets.length >= ALL_BUCKETS.length) return 'all ratings'
  return `${buckets[0]}–${buckets[buckets.length - 1]}`
}

export function clearExplorerCache() {
  _cache.clear()
  explorerData.value = null
  explorerError.value = null
  explorerIsMasters.value = false
}

// Prefetch single position (used by trainer to warm cache for next opponent move)
export async function prefetchExplorer(fen) {
  if (!lichessToken.value) return
  const buckets = bucketsForRange(explorerRangeMin.value, explorerRangeMax.value)
  const key = cacheKey(fen, buckets)
  if (_cache.has(key)) return
  const data = await _fetchRaw(fen, buckets)
  if (data && data !== 'auth') _cache.set(key, data)
}
