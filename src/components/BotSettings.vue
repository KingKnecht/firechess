<template>
  <div class="bot-settings-page">
    <header class="settings-header">
      <button class="back-btn" @click="$emit('back')">← Home</button>
      <h1>🤖 Play vs Bot</h1>
      <div class="header-spacer" />
    </header>

    <div class="settings-body">
      <div class="settings-card">

        <!-- Color -->
        <div class="setting-section">
          <div class="setting-label">Play as</div>
          <div class="color-row">
            <button
              v-for="opt in colorOptions"
              :key="opt.value"
              class="color-btn"
              :class="{ active: selectedColor === opt.value }"
              @click="selectedColor = opt.value"
            >
              <span class="color-icon">{{ opt.icon }}</span>
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <!-- Difficulty -->
        <div class="setting-section">
          <div class="setting-label">
            Difficulty — <strong>{{ difficultyLabel }}</strong>
            <span class="skill-num">(Skill {{ skillLevel }})</span>
          </div>
          <div class="diff-row">
            <button
              v-for="d in difficultyOptions"
              :key="d.skill"
              class="diff-btn"
              :class="{ active: skillLevel === d.skill }"
              @click="skillLevel = d.skill"
            >{{ d.label }}</button>
          </div>
        </div>

        <!-- Optional FEN -->
        <div class="setting-section">
          <div class="setting-label">Start from position <span class="optional">(optional)</span></div>
          <input
            v-model="startFen"
            class="fen-input"
            placeholder="Paste FEN here…"
            spellcheck="false"
          />
          <span v-if="fenError" class="badge error">{{ fenError }}</span>
        </div>

        <!-- Allow undo -->
        <div class="setting-section">
          <label class="toggle-row">
            <div class="setting-label" style="text-transform:uppercase;letter-spacing:1px;font-size:0.78rem;">Allow undo</div>
            <div class="toggle-wrap">
              <input type="checkbox" v-model="allowUndo" class="toggle-input" id="allow-undo" />
              <label class="toggle-track" for="allow-undo">
                <span class="toggle-thumb" />
              </label>
            </div>
          </label>
          <div class="toggle-hint">{{ allowUndo ? 'You can take back your last move during the game.' : 'No takebacks — commit to your moves.' }}</div>
        </div>

        <button class="start-btn" @click="startGame">▶ Start Game</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Chess } from 'chess.js'

const emit = defineEmits(['back', 'start'])

const selectedColor = ref('random')
const skillLevel    = ref(10)
const startFen      = ref('')
const fenError      = ref('')
const allowUndo     = ref(true)

const colorOptions = [
  { value: 'w',      label: 'White', icon: '♔' },
  { value: 'b',      label: 'Black', icon: '♚' },
  { value: 'random', label: 'Random', icon: '🎲' },
]

const difficultyOptions = [
  { label: 'Beginner', skill: 0  },
  { label: 'Easy',     skill: 4  },
  { label: 'Medium',   skill: 8  },
  { label: 'Hard',     skill: 12 },
  { label: 'Expert',   skill: 16 },
  { label: 'Master',   skill: 20 },
]

const difficultyLabel = computed(() =>
  difficultyOptions.reduce((best, d) =>
    Math.abs(d.skill - skillLevel.value) <= Math.abs(best.skill - skillLevel.value) ? d : best
  ).label
)

function startGame() {
  fenError.value = ''
  let fen = startFen.value.trim() || null

  if (fen) {
    try { new Chess().load(fen) }
    catch { fenError.value = 'Invalid FEN'; return }
  }

  const playerColor = selectedColor.value === 'random'
    ? (Math.random() < 0.5 ? 'w' : 'b')
    : selectedColor.value

  emit('start', { playerColor, skillLevel: skillLevel.value, fen, allowUndo: allowUndo.value })
}
</script>

<style scoped>
.bot-settings-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #2c2c2c;
  color: #f0d9b5;
}

.settings-header {
  background: #1a1a1a;
  color: #f0d9b5;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.settings-header h1 { flex: 1; text-align: center; font-size: clamp(1.3rem, 3vw, 1.8rem); letter-spacing: 2px; }
.header-spacer { width: 80px; }

.back-btn {
  background: none;
  border: 1px solid #f0d9b5;
  color: #f0d9b5;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}
.back-btn:hover { background: rgba(240,217,181,0.15); }

.settings-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

.settings-card {
  background: #1e1e1e;
  border-radius: 14px;
  padding: 32px;
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: 28px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.setting-section { display: flex; flex-direction: column; gap: 10px; }

.setting-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #b58863;
}
.skill-num { font-size: 0.72rem; opacity: 0.6; font-weight: 400; text-transform: none; }
.optional  { font-size: 0.72rem; opacity: 0.55; font-weight: 400; text-transform: none; }

/* Color */
.color-row { display: flex; gap: 10px; }
.color-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid #444;
  border-radius: 10px;
  background: #2a2a2a;
  color: #f0d9b5;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}
.color-icon { font-size: 1.6rem; }
.color-btn.active { border-color: #b58863; background: #3a2e20; }
.color-btn:not(.active):hover { border-color: #666; }

/* Difficulty */
.diff-row { display: flex; gap: 6px; flex-wrap: wrap; }
.diff-btn {
  flex: 1;
  min-width: 70px;
  padding: 8px 4px;
  border: 2px solid #444;
  border-radius: 8px;
  background: #2a2a2a;
  color: #f0d9b5;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.diff-btn.active { border-color: #b58863; background: #3a2e20; }
.diff-btn:not(.active):hover { border-color: #666; }

/* FEN */
.fen-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 7px;
  border: 1px solid #444;
  background: #111;
  color: #f0d9b5;
  font-family: monospace;
  font-size: 0.85rem;
}
.fen-input:focus { outline: none; border-color: #b58863; }

.badge.error { color: #e74c3c; font-size: 0.8rem; }

/* Toggle */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.toggle-wrap { display: flex; align-items: center; }
.toggle-input { display: none; }
.toggle-track {
  width: 44px; height: 24px;
  background: #444;
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}
.toggle-input:checked + .toggle-track { background: #b58863; }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-input:checked + .toggle-track .toggle-thumb { transform: translateX(20px); }
.toggle-hint { font-size: 0.75rem; opacity: 0.6; color: #f0d9b5; }

/* Start button */
.start-btn {
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #b58863;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.start-btn:hover { background: #9a7252; }
</style>
