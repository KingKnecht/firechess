<template>
  <div class="settings-page">
    <header class="settings-header">
      <button class="back-btn" @click="$emit('back')">← Back</button>
      <h1>⚙️ Settings</h1>
      <div class="header-spacer" />
    </header>

    <main class="settings-main">

      <!-- Board section -->
      <section class="settings-section">
        <div class="section-title">Board</div>

        <label class="settings-row">
          <div class="row-text">
            <span class="row-label">Show field names on every square</span>
            <span class="row-desc">Displays coordinates like "e4" centered in each square</span>
          </div>
          <div class="toggle" :class="{ on: showAllSquareNames }" @click="showAllSquareNames = !showAllSquareNames">
            <div class="toggle-knob" />
          </div>
        </label>

        <label class="settings-row">
          <div class="row-text">
            <span class="row-label">Flash label on move</span>
            <span class="row-desc">Shows an animated label in the board center when a piece moves</span>
          </div>
          <div class="toggle" :class="{ on: showMoveFlash }" @click="showMoveFlash = !showMoveFlash">
            <div class="toggle-knob" />
          </div>
        </label>

        <label class="settings-row" :class="{ disabled: !showMoveFlash }">
          <div class="row-text">
            <span class="row-label">Flash label content</span>
            <span class="row-desc">What to show in the flash — destination square (e.g. "e4") or full PGN notation (e.g. "Nf3", "O-O")</span>
          </div>
          <div class="segmented" :class="{ faded: !showMoveFlash }">
            <button :class="{ active: moveFlashContent === 'square' }" @click="moveFlashContent = 'square'">Square</button>
            <button :class="{ active: moveFlashContent === 'pgn' }" @click="moveFlashContent = 'pgn'">PGN</button>
          </div>
        </label>
      </section>

    </main>
  </div>
</template>

<script setup>
import { showAllSquareNames, showMoveFlash, moveFlashContent } from '../composables/useSettings.js'
defineEmits(['back'])
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.settings-header {
  background: var(--bg-header);
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #333;
}
.settings-header h1 {
  font-size: 1.4rem;
  letter-spacing: 1px;
  flex: 1;
  text-align: center;
}
.header-spacer { width: 90px; }

.back-btn {
  background: none;
  border: 1px solid #f0d9b5;
  color: #f0d9b5;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}
.back-btn:hover { background: var(--btn-hover); }

.settings-main {
  max-width: 600px;
  margin: 0 auto;
  padding: 32px 24px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #b58863;
  margin-bottom: 10px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.settings-row:last-child { border-bottom: none; }

.row-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}
.row-label {
  font-size: 0.95rem;
  font-weight: 600;
}
.row-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Toggle switch */
.toggle {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--border-mid);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  cursor: pointer;
}
.toggle.on { background: #b58863; }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.toggle.on .toggle-knob { transform: translateX(20px); }

.settings-row.disabled { opacity: 0.45; pointer-events: none; }

/* Segmented control */
.segmented {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-mid);
  flex-shrink: 0;
}
.segmented button {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.segmented button + button { border-left: 1px solid var(--border-mid); }
.segmented button.active { background: #b58863; color: #fff; }
.segmented button:not(.active):hover { background: var(--seg-hover-bg); color: var(--seg-hover-text); }
.segmented.faded { opacity: 0.4; pointer-events: none; }
</style>
