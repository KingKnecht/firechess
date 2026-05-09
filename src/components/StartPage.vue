<template>
  <div class="start-page">
    <header class="start-header">
      <h1>♛ FireChess</h1>
    </header>

    <main class="start-main">
      <!-- Play Online -->
      <section class="card">
        <div class="card-title">
          <span class="card-icon">🌐</span>
          <span>Play Online</span>
        </div>
        <div class="time-groups">
          <div v-for="group in timeGroups" :key="group.category" class="time-group">
            <div class="group-label">{{ group.category }}</div>
            <div class="time-buttons">
              <button
                v-for="fmt in group.formats"
                :key="fmt.label"
                class="time-btn"
                @click="$emit('select', { mode: 'online', timeControl: fmt })"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Play Local -->
      <section class="card">
        <div class="card-title">
          <span class="card-icon">🏠</span>
          <span>Play Local</span>
        </div>
        <div class="time-groups">
          <div v-for="group in timeGroups" :key="group.category" class="time-group">
            <div class="group-label">{{ group.category }}</div>
            <div class="time-buttons">
              <button
                v-for="fmt in group.formats"
                :key="fmt.label"
                class="time-btn"
                @click="$emit('select', { mode: 'local', timeControl: fmt })"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Play vs Bot -->
      <section class="card">
        <div class="card-title">
          <span class="card-icon">🤖</span>
          <span>Play vs Bot</span>
        </div>
        <div class="time-groups">
          <div v-for="group in timeGroups" :key="group.category" class="time-group">
            <div class="group-label">{{ group.category }}</div>
            <div class="time-buttons">
              <button
                v-for="fmt in group.formats"
                :key="fmt.label"
                class="time-btn"
                @click="$emit('select', { mode: 'bot', timeControl: fmt })"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Training -->
      <section class="card">
        <div class="card-title">
          <span class="card-icon">🎓</span>
          <span>Training</span>
        </div>
        <div class="training-options">
          <button
            v-for="opt in trainingOptions"
            :key="opt.value"
            class="training-btn"
            :class="{ 'coming-soon': opt.comingSoon }"
            :disabled="opt.comingSoon"
            @click="!opt.comingSoon && $emit('select', { mode: 'training', trainingMode: opt.value })"
          >
            <span class="training-icon">{{ opt.icon }}</span>
            <span class="training-label">{{ opt.label }}</span>
            <span v-if="opt.comingSoon" class="soon-badge">Soon</span>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
defineEmits(['select'])

const timeGroups = [
  {
    category: 'Bullet',
    formats: [
      { label: '1+0', minutes: 1, increment: 0 },
      { label: '2+1', minutes: 2, increment: 1 },
    ],
  },
  {
    category: 'Blitz',
    formats: [
      { label: '3+0', minutes: 3, increment: 0 },
      { label: '3+2', minutes: 3, increment: 2 },
      { label: '5+0', minutes: 5, increment: 0 },
      { label: '5+3', minutes: 5, increment: 3 },
    ],
  },
  {
    category: 'Rapid',
    formats: [
      { label: '10+0', minutes: 10, increment: 0 },
      { label: '15+10', minutes: 15, increment: 10 },
    ],
  },
  {
    category: 'Classical',
    formats: [
      { label: '30+0', minutes: 30, increment: 0 },
      { label: '30+20', minutes: 30, increment: 20 },
    ],
  },
]

const trainingOptions = [
  { value: 'board-editor',   label: 'Board Editor',   icon: '📋', comingSoon: false },
  { value: 'visualization',  label: 'Visualization',  icon: '🧠', comingSoon: false },
  { value: 'puzzles',        label: 'Puzzles',         icon: '🧩', comingSoon: true },
  { value: 'openings',       label: 'Openings',        icon: '📖', comingSoon: true },
  { value: 'analysis',       label: 'Analysis',        icon: '📊', comingSoon: true },
]
</script>

<style scoped>
.start-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #2c2c2c;
}

.start-header {
  background: #1a1a1a;
  color: #f0d9b5;
  padding: 20px 24px;
  text-align: center;
}
.start-header h1 {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  letter-spacing: 3px;
}

.start-main {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 24px;
  padding: 40px 24px;
}

/* ── Card ── */
.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  padding: 24px;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1a1a1a;
  border-bottom: 2px solid #f0d9b5;
  padding-bottom: 12px;
}
.card-icon { font-size: 1.3rem; }

/* ── Time groups ── */
.time-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.time-group { display: flex; flex-direction: column; gap: 6px; }

.group-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.time-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.time-btn {
  padding: 6px 12px;
  border: 2px solid #b58863;
  border-radius: 6px;
  background: #fff;
  color: #1a1a1a;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.time-btn:hover {
  background: #b58863;
  color: #fff;
}

/* ── Training options ── */
.training-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.training-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 2px solid #b58863;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 600;
  color: #1a1a1a;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.training-btn:hover:not(.coming-soon) {
  background: #b58863;
  color: #fff;
}
.training-btn.coming-soon {
  opacity: 0.5;
  cursor: not-allowed;
  border-color: #ccc;
}

.training-icon { font-size: 1.1rem; }
.training-label { flex: 1; }

.soon-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: #ddd;
  color: #666;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 640px) {
  .start-main { padding: 24px 12px; }
  .card { width: 100%; max-width: 360px; }
}
</style>
