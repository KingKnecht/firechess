// Module-level singletons so Audio objects are shared across all composable calls
const _sounds = {}

function _get(name, path) {
  if (!_sounds[name]) {
    const audio = new Audio(path)
    audio.preload = 'auto'
    _sounds[name] = audio
  }
  return _sounds[name]
}

export function useSound() {
  function playSound(name) {
    const paths = {
      move:       '/sound/Move.mp3',
      capture:    '/sound/Capture.mp3',
      select:     '/sound/Select.mp3',
      outOfBound: '/sound/OutOfBound.mp3',
      error:      '/sound/Error.mp3',
      notify:     '/sound/GenericNotify.mp3',
      lowTime:    '/sound/LowTime.mp3',
    }
    const path = paths[name]
    if (!path) return
    const audio = _get(name, path)
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  return { playSound }
}
