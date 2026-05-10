<template>
  <div class="ot-page">
    <header class="ot-header">
      <button class="back-btn" @click="handleBack">← Home</button>
      <h1>♛ Opening Trainer</h1>
      <div class="header-spacer" />
    </header>

    <!-- ── LIST VIEW ─────────────────────────────────────────── -->
    <div v-if="subView === 'list'" class="ot-body">
      <div class="list-wrap">
        <div class="list-toolbar">
          <h2 class="list-title">My Repertoires</h2>
          <button class="btn primary" @click="showCreateForm = true">+ New Repertoire</button>
        </div>

        <!-- Create form -->
        <div v-if="showCreateForm" class="create-form">
          <input v-model="newName" class="text-input" placeholder="Repertoire name…" @keyup.enter="createRepertoire" />
          <div class="color-pick">
            <button :class="['color-btn', { active: newColor === 'w' }]" @click="newColor = 'w'">♔ White</button>
            <button :class="['color-btn', { active: newColor === 'b' }]" @click="newColor = 'b'">♚ Black</button>
          </div>
          <div class="form-actions">
            <button class="btn primary" :disabled="!newName.trim()" @click="createRepertoire">Create</button>
            <button class="btn" @click="showCreateForm = false; newName = ''">Cancel</button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!repertoires.length" class="empty-state">
          <div class="empty-icon">📖</div>
          <p>No repertoires yet. Create one to get started.</p>
        </div>

        <!-- Cards -->
        <div class="rep-list">
          <div v-for="rep in repertoires" :key="rep.id" class="rep-card">
            <div class="rep-card-left">
              <span :class="['color-badge', rep.color === 'w' ? 'white' : 'black']">
                {{ rep.color === 'w' ? '♔ White' : '♚ Black' }}
              </span>
              <span class="rep-name">{{ rep.name }}</span>
              <span class="rep-count">{{ countNodes(rep.root) }} moves</span>
            </div>
            <div class="rep-card-actions">
              <button class="btn small" @click="openEditor(rep)">✏️ Edit</button>
              <button class="btn small primary" @click="openTraining(rep)">🎓 Train</button>
              <button class="btn small danger" @click="confirmDelete(rep)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── EDITOR VIEW ────────────────────────────────────────── -->
    <div v-else-if="subView === 'edit'" class="ot-body editor-body">
      <!-- Board area -->
      <div class="editor-board-wrap">
        <ChessBoard
          :fen="editorChess.fen()"
          :selectedSquare="editorSelected"
          :legalMoves="editorLegalDots"
          :flipped="editorFlipped"
          :activeTurn="editorChess.turn()"
          :showMoveFlash="false"
          @square-click="onEditorSquareClick"
          @drop="onEditorDrop"
        />
        <div class="board-controls">
          <button class="btn small" @click="editorGoRoot">⏮ Start</button>
          <button class="btn small" @click="editorGoBack" :disabled="!editorPath.length">← Back</button>
          <span class="board-turn-label">{{ editorTurnLabel }}</span>
          <button class="btn small" @click="editorFlipped = !editorFlipped">⇅ Flip</button>
        </div>
      </div>

      <!-- Side panel -->
      <div class="editor-panel">
        <div class="panel-header">
          <button class="back-btn small" @click="subView = 'list'">← Repertoires</button>
          <span class="panel-rep-name">{{ currentRep?.name }}</span>
          <span :class="['color-badge', currentRep?.color === 'w' ? 'white' : 'black']">
            {{ currentRep?.color === 'w' ? '♔' : '♚' }}
          </span>
        </div>

        <!-- Tabs -->
        <div class="panel-tabs">
          <button :class="['tab-btn', { active: editorTab === 'tree' }]" @click="editorTab = 'tree'">🌳 Tree</button>
          <button :class="['tab-btn', { active: editorTab === 'import' }]" @click="editorTab = 'import'">📥 Import PGN</button>
        </div>

        <!-- Tree tab -->
        <div v-if="editorTab === 'tree'" class="tree-tab">
          <div v-if="!currentRep?.root?.children?.length" class="tree-empty">
            Make moves on the board to build your repertoire.
          </div>
          <div v-else class="tree-scroll">
            <RepertoireTree
              :node="currentRep.root"
              :selected-id="selectedNodeId"
              :indent="0"
              :is-variation="false"
              @select="onTreeSelect"
              @delete="onTreeDelete"
            />
          </div>

          <!-- Annotation -->
          <div v-if="selectedNodeId && selectedNodeId !== currentRep?.root?.id" class="annotation-box">
            <div class="annotation-label">Annotation for <strong>{{ selectedNodeSan }}</strong></div>
            <textarea
              v-model="annotationDraft"
              class="annotation-input"
              placeholder="Add a note…"
              rows="3"
              @input="saveAnnotation"
            />
          </div>
        </div>

        <!-- PGN import tab -->
        <div v-if="editorTab === 'import'" class="import-tab">
          <p class="import-hint">Paste a PGN (with variants and comments). Moves will be merged into the current repertoire.</p>
          <textarea v-model="importPgn" class="pgn-input" placeholder="[Event &quot;…&quot;]\n1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *" rows="8" />
          <button class="btn primary" :disabled="!importPgn.trim()" @click="doImport">Import</button>
          <div v-if="importMsg" :class="['import-msg', importMsgType]">{{ importMsg }}</div>
        </div>
      </div>
    </div>

    <!-- ── TRAINING VIEW ──────────────────────────────────────── -->
    <div v-else-if="subView === 'train'" class="ot-body trainer-body">
      <!-- Board -->
      <div class="trainer-board-wrap">
        <ChessBoard
          :fen="trainerChess.fen()"
          :selectedSquare="trainerSelected"
          :legalMoves="trainerLegalDots"
          :flipped="trainerFlipped"
          :activeTurn="trainerChess.turn()"
          :myColor="currentRep?.color"
          :showMoveFlash="false"
          @square-click="onTrainerSquareClick"
          @drop="onTrainerDrop"
        />
        <div :class="['train-feedback', trainFeedback]" v-if="trainFeedback">
          {{ trainFeedback === 'correct' ? '✓ Correct!' : trainFeedback === 'wrong' ? '✗ Try again' : '🎉 Line complete!' }}
        </div>
      </div>

      <!-- Info panel -->
      <div class="trainer-panel">
        <div class="panel-header">
          <button class="back-btn small" @click="subView = 'list'">← Repertoires</button>
        </div>
        <div class="trainer-rep-info">
          <span class="rep-name">{{ currentRep?.name }}</span>
          <span :class="['color-badge', currentRep?.color === 'w' ? 'white' : 'black']">
            {{ currentRep?.color === 'w' ? '♔ White' : '♚ Black' }}
          </span>
        </div>

        <div class="train-stats">
          <div class="stat">
            <span class="stat-num">{{ trainStats.correct }}</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ trainStats.wrong }}</span>
            <span class="stat-label">Wrong</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ trainStats.lines }}</span>
            <span class="stat-label">Lines</span>
          </div>
        </div>

        <div class="train-hint">
          <template v-if="currentRep?.color === 'w'">You play <strong>White</strong>. Make the next move.</template>
          <template v-else>You play <strong>Black</strong>. Respond to White's move.</template>
        </div>

        <div v-if="trainerCurrentAnnotation" class="train-annotation">
          💡 {{ trainerCurrentAnnotation }}
        </div>

        <button class="btn" @click="restartTraining">↺ Restart</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, triggerRef, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Chess } from 'chess.js'
import { useRepertoire, countNodes, findNode } from '../composables/useRepertoire.js'
import { parsePgnToTree } from '../utils/pgnVariantParser.js'
import RepertoireTree from './RepertoireTree.vue'
import ChessBoard from './ChessBoard.vue'

const emit = defineEmits(['back'])

const { repertoires, addRepertoire, deleteRepertoire, addMove, removeNode, setAnnotation, importTree } = useRepertoire()

// ── Shared state ────────────────────────────────────────────────────────────
const subView = ref('list')
const currentRep = ref(null)

function handleBack() {
  if (subView.value === 'list') emit('back')
  else subView.value = 'list'
}

// ── List view ────────────────────────────────────────────────────────────────
const showCreateForm = ref(false)
const newName = ref('')
const newColor = ref('w')

function createRepertoire() {
  if (!newName.value.trim()) return
  addRepertoire(newName.value.trim(), newColor.value)
  newName.value = ''
  showCreateForm.value = false
}

function confirmDelete(rep) {
  if (confirm(`Delete repertoire "${rep.name}"? This cannot be undone.`)) {
    deleteRepertoire(rep.id)
  }
}

function openEditor(rep) {
  currentRep.value = rep
  subView.value = 'edit'
  editorReset()
}

function openTraining(rep) {
  if (!rep.root.children.length) {
    alert('This repertoire is empty. Add some moves first.')
    return
  }
  currentRep.value = rep
  subView.value = 'train'
  restartTraining()
}

// ── Editor view ───────────────────────────────────────────────────────────────
const editorTab = ref('tree')
const editorFlipped = ref(false)
const editorChess = shallowRef(new Chess())
const editorSelected = ref(null)
const editorPath = ref([]) // array of node ids visited
const selectedNodeId = ref(null)
watch(selectedNodeId, (id) => {
  if (!id) return
  nextTick(() => {
    document.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
})
const annotationDraft = ref('')
const importPgn = ref('')
const importMsg = ref('')
const importMsgType = ref('ok')

const editorLegalDots = computed(() => {
  if (!editorSelected.value) return []
  return editorChess.value.moves({ square: editorSelected.value, verbose: true }).map(m => m.to)
})

const editorTurnLabel = computed(() => {
  const t = editorChess.value.turn()
  return t === 'w' ? '⬜ White to move' : '⬛ Black to move'
})

const selectedNodeSan = computed(() => {
  if (!selectedNodeId.value || !currentRep.value) return ''
  const found = findNode(currentRep.value.root, selectedNodeId.value)
  return found ? found[0].san : ''
})

const trainerCurrentAnnotation = computed(() => {
  if (!trainerCurrentNode.value?.annotation) return ''
  return trainerCurrentNode.value.annotation
})

function editorReset() {
  editorChess.value = new Chess()
  editorSelected.value = null
  editorPath.value = []
  selectedNodeId.value = currentRep.value?.root?.id ?? null
  annotationDraft.value = ''
  editorFlipped.value = currentRep.value?.color === 'b'
}

function editorGoRoot() {
  editorChess.value = new Chess()
  editorSelected.value = null
  editorPath.value = []
  selectedNodeId.value = currentRep.value?.root?.id ?? null
  annotationDraft.value = ''
}

function editorGoBack() {
  if (!editorPath.value.length) return
  editorChess.value.undo()
  triggerRef(editorChess)
  editorPath.value.pop()
  const parentId = editorPath.value.length
    ? editorPath.value[editorPath.value.length - 1]
    : currentRep.value.root.id
  selectedNodeId.value = parentId
  const found = findNode(currentRep.value.root, parentId)
  annotationDraft.value = found ? found[0].annotation : ''
  editorSelected.value = null
}

function onEditorSquareClick(sq) {
  if (!currentRep.value) return

  if (editorSelected.value) {
    // Try the move
    const moves = editorChess.value.moves({ square: editorSelected.value, verbose: true })
    const target = moves.find(m => m.to === sq)
    if (target) {
      const move = editorChess.value.move({ from: editorSelected.value, to: sq, promotion: 'q' })
      if (move) {
        triggerRef(editorChess)
        const parentId = selectedNodeId.value ?? currentRep.value.root.id
        const node = addMove(currentRep.value.id, parentId, {
          san: move.san,
          from: move.from,
          to: move.to,
          promotion: move.promotion ?? null,
          fen: editorChess.value.fen(),
        })
        if (node) {
          editorPath.value.push(node.id)
          selectedNodeId.value = node.id
          annotationDraft.value = node.annotation
        }
        editorSelected.value = null
        return
      }
    }
    // Deselect / reselect
    if (editorChess.value.get(sq)) {
      editorSelected.value = sq
    } else {
      editorSelected.value = null
    }
    return
  }

  if (editorChess.value.get(sq)) {
    editorSelected.value = sq
  }
}

function onEditorDrop({ from, to }) {
  editorSelected.value = from
  onEditorSquareClick(to)
}

function onTreeSelect(node) {
  if (!currentRep.value) return
  // Rebuild chess state by replaying moves from root to this node
  const path = []
  function findPath(current, targetId, trail) {
    if (current.id === targetId) { path.push(...trail, current); return true }
    for (const c of current.children ?? []) {
      if (findPath(c, targetId, [...trail, current])) return true
    }
    return false
  }
  findPath(currentRep.value.root, node.id, [])

  const chess = new Chess()
  const ids = []
  for (const n of path) {
    if (n.san) { chess.move(n.san); ids.push(n.id) }
  }
  editorChess.value = chess
  editorPath.value = ids
  selectedNodeId.value = node.id
  annotationDraft.value = node.annotation ?? ''
  editorSelected.value = null
}

function onTreeDelete(nodeId) {
  if (!currentRep.value) return
  if (!confirm('Remove this move and all its continuations?')) return
  removeNode(currentRep.value.id, nodeId)
  // If we deleted the current node, go back to root
  if (editorPath.value.includes(nodeId)) editorGoRoot()
}

function saveAnnotation() {
  if (!currentRep.value || !selectedNodeId.value) return
  setAnnotation(currentRep.value.id, selectedNodeId.value, annotationDraft.value)
}

function doImport() {
  if (!importPgn.value.trim() || !currentRep.value) return
  try {
    const parsed = parsePgnToTree(importPgn.value)
    const added = importTree(currentRep.value.id, parsed)
    importMsg.value = added > 0 ? `✓ Added ${added} new move${added !== 1 ? 's' : ''}.` : 'No new moves found (already in repertoire).'
    importMsgType.value = added > 0 ? 'ok' : 'warn'
    if (added > 0) editorTab.value = 'tree'
    importPgn.value = ''
  } catch (e) {
    importMsg.value = '✗ Failed to parse PGN. Check format.'
    importMsgType.value = 'err'
  }
  setTimeout(() => { importMsg.value = '' }, 4000)
}

// ── Training view ─────────────────────────────────────────────────────────────
const trainerFlipped = computed(() => currentRep.value?.color === 'b')
const trainerChess = shallowRef(new Chess())
const trainerSelected = ref(null)
const trainerCurrentNode = ref(null)
const trainFeedback = ref('')
const trainStats = ref({ correct: 0, wrong: 0, lines: 0 })

const trainerLegalDots = computed(() => {
  if (!trainerSelected.value) return []
  return trainerChess.value.moves({ square: trainerSelected.value, verbose: true }).map(m => m.to)
})

function restartTraining() {
  trainerChess.value = new Chess()
  trainerSelected.value = null
  trainerCurrentNode.value = currentRep.value?.root ?? null
  trainFeedback.value = ''
  trainStats.value = { correct: 0, wrong: 0, lines: 0 }
  if (currentRep.value?.color === 'b') {
    nextTick(() => opponentMove())
  }
}

function opponentMove() {
  const node = trainerCurrentNode.value
  if (!node?.children?.length) return
  const child = node.children[Math.floor(Math.random() * node.children.length)]
  try {
    trainerChess.value.move(child.san)
    triggerRef(trainerChess)
    trainerCurrentNode.value = child
  } catch (e) {
    console.error('opponentMove: invalid SAN', child.san, e)
  }
}

function onTrainerSquareClick(sq) {
  if (!trainerCurrentNode.value || !currentRep.value) return

  // Ignore clicks if it's not user's turn
  const userColor = currentRep.value.color
  if (trainerChess.value.turn() !== userColor) return

  if (trainerSelected.value) {
    const moves = trainerChess.value.moves({ square: trainerSelected.value, verbose: true })
    const target = moves.find(m => m.to === sq)
    if (target) {
      let san = null
      try {
        san = trainerChess.value.move({ from: trainerSelected.value, to: sq, promotion: 'q' })?.san
        triggerRef(trainerChess)
      } catch (e) {
        trainerSelected.value = null
        return
      }
      trainerSelected.value = null
      if (!san) return

      const match = trainerCurrentNode.value.children.find(c => c.san === san)
      if (match) {
        trainStats.value.correct++
        trainerCurrentNode.value = match
        showFeedback('correct')

        if (!match.children.length) {
          // Leaf node — line complete
          trainStats.value.lines++
          setTimeout(() => {
            showFeedback('done')
            setTimeout(() => { trainFeedback.value = ''; nextLineOrRestart() }, 1500)
          }, 500)
        } else {
          // Opponent responds
          setTimeout(() => {
            trainFeedback.value = ''
            if (trainerChess.value.turn() !== userColor) opponentMove()
          }, 600)
        }
      } else {
        // Wrong move — revert
        trainStats.value.wrong++
        trainerChess.value.undo()
        triggerRef(trainerChess)
        showFeedback('wrong')
        setTimeout(() => { trainFeedback.value = '' }, 900)
      }
      return
    }
    if (trainerChess.value.get(sq)) { trainerSelected.value = sq; return }
    trainerSelected.value = null
    return
  }

  if (trainerChess.value.get(sq)) trainerSelected.value = sq
}

function onTrainerDrop({ from, to }) {
  if (!trainerCurrentNode.value || !currentRep.value) return
  if (trainerChess.value.turn() !== currentRep.value.color) return
  trainerSelected.value = from
  onTrainerSquareClick(to)
}

function showFeedback(type) { trainFeedback.value = type }

function nextLineOrRestart() {
  // Restart from root, let opponent go first if user plays black
  trainerChess.value = new Chess()
  trainerSelected.value = null
  trainerCurrentNode.value = currentRep.value.root
  if (currentRep.value.color === 'b') opponentMove()
}

watch(subView, (v) => {
  if (v === 'edit' && currentRep.value) editorReset()
})

// ── Keyboard navigation (editor view) ─────────────────────────────────────────
function onKeydown(e) {
  if (subView.value !== 'edit' || !currentRep.value) return
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    editorGoBack()

  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    const cur = selectedNodeId.value
      ? findNode(currentRep.value.root, selectedNodeId.value)?.[0]
      : currentRep.value.root
    if (cur?.children?.length) onTreeSelect(cur.children[0])

  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    if (!selectedNodeId.value) return
    const found = findNode(currentRep.value.root, selectedNodeId.value)
    if (!found) return
    const [cur, parent] = found
    if (e.key === 'ArrowDown') {
      // Try next sibling first
      if (parent) {
        const siblings = parent.children
        const idx = siblings.findIndex(c => c.id === selectedNodeId.value)
        if (idx + 1 < siblings.length) { onTreeSelect(siblings[idx + 1]); return }
      }
      // No next sibling: jump to first variation (children[1]) so ↓ differs from → (main line = children[0])
      if (cur.children?.length > 1) onTreeSelect(cur.children[1])
    } else {
      // ArrowUp: previous sibling only
      if (!parent) return
      const siblings = parent.children
      const idx = siblings.findIndex(c => c.id === selectedNodeId.value)
      if (idx - 1 >= 0) onTreeSelect(siblings[idx - 1])
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* ── Page shell ── */
.ot-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
  color: var(--text-primary);
}

.ot-header {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-header);
  color: var(--text-on-dark);
  padding: 12px 20px;
}
.ot-header h1 { margin: 0; font-size: 1.2rem; flex: 1; text-align: center; }
.header-spacer { width: 80px; }

.ot-body {
  flex: 1;
  display: flex;
  align-items: flex-start;
  padding: 24px;
  gap: 24px;
  overflow: auto;
}

/* ── Back button ── */
.back-btn {
  background: none;
  border: 1px solid rgba(240,217,181,0.4);
  border-radius: 6px;
  color: var(--text-on-dark);
  padding: 5px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.back-btn:hover { background: var(--btn-hover); }
.back-btn.small { font-size: 0.78rem; padding: 3px 8px; }

/* ── Generic buttons ── */
.btn {
  padding: 7px 14px;
  border: none;
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn:hover:not(:disabled) { background: var(--border-mid); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: #b58863; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #9a7252; }
.btn.danger  { background: #c0392b; color: #fff; }
.btn.danger:hover:not(:disabled) { background: #a33030; }
.btn.small   { padding: 4px 10px; font-size: 0.78rem; }

/* ── Color badge ── */
.color-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.color-badge.white { background: #f0e8d8; color: #333; }
.color-badge.black { background: #333; color: #f0d9b5; }

/* ── List view ── */
.list-wrap {
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.list-title { margin: 0; font-size: 1.3rem; font-weight: 700; }

.create-form {
  background: var(--bg-panel);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.text-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.95rem;
}
.text-input:focus { outline: none; border-color: #b58863; }
.color-pick { display: flex; gap: 8px; }
.color-btn {
  flex: 1;
  padding: 7px;
  border: 2px solid var(--border);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.color-btn.active { border-color: #b58863; background: var(--bg-active); }
.form-actions { display: flex; gap: 8px; }

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}
.empty-icon { font-size: 3rem; margin-bottom: 12px; }

.rep-list { display: flex; flex-direction: column; gap: 10px; }
.rep-card {
  background: var(--bg-panel);
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}
.rep-card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.rep-name { font-weight: 700; font-size: 1rem; }
.rep-count { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; }
.rep-card-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* ── Editor layout ── */
.editor-body { justify-content: center; }
.editor-board-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

/* ── Board sizing in trainer context ── */
.editor-board-wrap :deep(.board),
.trainer-board-wrap :deep(.board) {
  width: min(480px, calc(100vw - 360px));
  height: min(480px, calc(100vw - 360px));
}

.board-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  justify-content: center;
}
.board-turn-label {
  font-size: 0.82rem;
  color: var(--text-muted);
  flex: 1;
  text-align: center;
}

/* ── Editor panel ── */
.editor-panel {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  width: 300px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  align-self: flex-start;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}
.panel-rep-name { flex: 1; font-weight: 700; font-size: 0.92rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  flex: 1;
  padding: 9px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.tab-btn.active { color: var(--text-primary); border-bottom-color: #b58863; }
.tab-btn:hover:not(.active) { background: var(--btn-hover); }

/* ── Tree tab ── */
.tree-tab {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 200px;
}
.tree-empty {
  padding: 20px 14px;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}
.tree-scroll {
  flex: 1;
  overflow-y: auto;
  max-height: 340px;
  padding: 8px 0;
}
.tree-node-wrap { display: flex; flex-direction: column; }
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 14px;
  cursor: pointer;
  font-size: 0.85rem;
  border-radius: 4px;
  margin: 1px 6px;
  transition: background 0.1s;
}
.tree-node:hover { background: var(--btn-hover); }
.tree-node.selected { background: var(--bg-active); font-weight: 700; }
.tree-move { flex: 1; font-family: monospace; }
.tree-ann-icon { font-size: 0.7rem; opacity: 0.7; }
.tree-del {
  display: none;
  background: none;
  border: none;
  color: #c0392b;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 2px;
  line-height: 1;
}
.tree-node:hover .tree-del { display: inline; }

.annotation-box {
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.annotation-label { font-size: 0.75rem; color: var(--text-muted); }
.annotation-input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.82rem;
  resize: vertical;
}
.annotation-input:focus { outline: none; border-color: #b58863; }

/* ── Import tab ── */
.import-tab {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.import-hint { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin: 0; }
.pgn-input {
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 0.8rem;
  resize: vertical;
}
.pgn-input:focus { outline: none; border-color: #b58863; }
.import-msg { font-size: 0.82rem; padding: 6px 8px; border-radius: 6px; }
.import-msg.ok   { background: #1a4a2a; color: #4ade80; }
.import-msg.warn { background: #3a2800; color: #fbbf24; }
.import-msg.err  { background: #3a1010; color: #f87171; }

/* ── Trainer layout ── */
.trainer-body { justify-content: center; }
.trainer-board-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.train-feedback {
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  text-align: center;
  animation: fadeIn 0.15s ease;
}
.train-feedback.correct { background: #1a4a2a; color: #4ade80; }
.train-feedback.wrong   { background: #3a1010; color: #f87171; }
.train-feedback.done    { background: #1a3a4a; color: #60c9f8; }

.trainer-panel {
  background: var(--bg-panel);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  padding: 20px;
  width: 220px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-self: flex-start;
}
.trainer-rep-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.train-stats {
  display: flex;
  gap: 12px;
}
.stat { display: flex; flex-direction: column; align-items: center; flex: 1; }
.stat-num { font-size: 1.5rem; font-weight: 700; color: #b58863; }
.stat-label { font-size: 0.7rem; color: var(--text-muted); }
.train-hint { font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; }
.train-annotation {
  font-size: 0.82rem;
  color: var(--text-primary);
  background: var(--bg-active);
  border-left: 3px solid #b58863;
  padding: 8px 10px;
  border-radius: 4px;
  line-height: 1.45;
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

@media (max-width: 800px) {
  .ot-body { flex-direction: column; align-items: center; }
  .editor-panel, .trainer-panel { width: 100%; max-width: 480px; }
  .editor-board-wrap :deep(.board),
  .trainer-board-wrap :deep(.board) { width: min(480px, 90vw); height: min(480px, 90vw); }
}
</style>
