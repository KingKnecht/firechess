import { ref, watch } from 'vue'

const STORAGE_KEY = 'firechess_settings'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}
function save(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)) } catch {}
}

const stored = load()

export const showAllSquareNames = ref(stored.showAllSquareNames ?? false)
export const showMoveFlash      = ref(stored.showMoveFlash      ?? true)
export const moveFlashContent   = ref(stored.moveFlashContent   ?? 'square') // 'square' | 'pgn'

watch([showAllSquareNames, showMoveFlash, moveFlashContent], () => {
  save({
    showAllSquareNames: showAllSquareNames.value,
    showMoveFlash:      showMoveFlash.value,
    moveFlashContent:   moveFlashContent.value,
  })
})
