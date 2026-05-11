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

        <!-- ELO range slider -->
        <div class="elo-range-section">
          <div class="elo-range-header">
            <span class="elo-range-title">👥 Opponent ELO Range</span>
            <span class="elo-range-value">{{ explorerRangeMin }} – {{ explorerRangeMax }}</span>
            <span v-if="!lichessToken" class="elo-range-hint-inline">
              — <em><a @click.prevent="handleBack" href="#">Connect Lichess in Settings</a> to load frequency data</em>
            </span>
          </div>
          <div class="dual-range-wrap" :style="dualRangeTrackStyle">
            <input
              class="range-input"
              type="range"
              :min="EXPLORER_RMIN" :max="EXPLORER_RMAX" :step="EXPLORER_RSTEP"
              v-model.number="explorerRangeMin"
              :style="{ zIndex: explorerRangeMin >= explorerRangeMax - EXPLORER_RSTEP ? 3 : 1 }"
              @input="onRangeMinInput"
            />
            <input
              class="range-input"
              type="range"
              :min="EXPLORER_RMIN" :max="EXPLORER_RMAX" :step="EXPLORER_RSTEP"
              v-model.number="explorerRangeMax"
              :style="{ zIndex: explorerRangeMax <= explorerRangeMin + EXPLORER_RSTEP ? 3 : 2 }"
              @input="onRangeMaxInput"
            />
          </div>
          <div class="elo-range-buckets">
            Lichess data buckets: <strong>{{ currentBucketsLabel }}</strong>
          </div>
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
            <div class="rep-card-top">
              <div class="rep-card-left">
                <span :class="['color-badge', rep.color === 'w' ? 'white' : 'black']">
                  {{ rep.color === 'w' ? '♔ White' : '♚ Black' }}
                </span>
                <span class="rep-name">{{ rep.name }}</span>
              </div>
              <div class="rep-card-actions">
                <button class="btn small" @click="openEditor(rep)">✏️ Edit</button>
                <button class="btn small primary" @click="openTraining(rep)">🎓 Train</button>
                <button v-if="getCardStats(rep).weakCount > 0" class="btn small weakness-btn" @click="openTrainingWeaknesses(rep)">🎯 Weaknesses</button>
                <button class="btn small danger" @click="confirmDelete(rep)">🗑️</button>
              </div>
            </div>
            <div class="rep-card-stats">
              <div class="rep-progress-wrap">
                <div class="rep-progress-bar">
                  <div class="rep-progress-fill" :style="{ width: getCardStats(rep).progress + '%' }"></div>
                </div>
                <span class="rep-progress-label">{{ getCardStats(rep).knownCount }}/{{ countNodes(rep.root) }} moves known</span>
              </div>
              <div class="rep-card-meta">
                <span v-if="getCardStats(rep).weakCount > 0" class="rep-weak-badge">⚡ {{ getCardStats(rep).weakCount }} weak</span>
                <span v-if="getCardStats(rep).lastPracticed" class="rep-last-practiced">{{ formatRelativeDate(getCardStats(rep).lastPracticed) }}</span>
                <button v-if="getRepLines(rep.root).length > 0" class="btn tiny lines-toggle" @click="toggleLines(rep.id)">
                  {{ expandedReps.has(rep.id) ? '▲' : '▼' }} {{ getRepLines(rep.root).length }} lines
                </button>
              </div>
            </div>
            <!-- Named lines (chapters) expandable -->
            <div v-if="expandedReps.has(rep.id) && getRepLines(rep.root).length" class="rep-lines">
              <div v-for="line in getRepLines(rep.root)" :key="line.nodeId" class="rep-line-row">
                <div class="rep-line-info">
                  <span class="rep-line-name">{{ line.name }}</span>
                  <div class="rep-line-progress-wrap">
                    <div class="rep-line-bar">
                      <div class="rep-line-fill"
                        :style="{ width: getLineStats(rep, line.node).total > 0 ? (getLineStats(rep, line.node).knownCount / getLineStats(rep, line.node).total * 100) + '%' : '0%' }">
                      </div>
                    </div>
                    <span class="rep-line-label">{{ getLineStats(rep, line.node).knownCount }}/{{ getLineStats(rep, line.node).total }}</span>
                    <span v-if="getLineStats(rep, line.node).weakCount > 0" class="rep-weak-badge small">⚡{{ getLineStats(rep, line.node).weakCount }}</span>
                  </div>
                </div>
                <div class="rep-line-actions">
                  <button class="btn tiny primary" @click="openTraining(rep, 'normal', line.node)">🎓</button>
                  <button v-if="getLineStats(rep, line.node).weakCount > 0" class="btn tiny weakness-btn" @click="openTrainingWeaknesses(rep, line.node)">🎯</button>
                </div>
              </div>
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
          <button class="btn small" @click="fetchEval" :disabled="evalLoading">{{ evalLoading ? '⏳ Eval…' : '📊 Eval' }}</button>
        </div>
        <div v-if="evalData" class="eval-panel">
          <div v-if="evalData.error" class="eval-error">{{ evalData.error }}</div>
          <template v-else>
            <div class="eval-header">☁️ Lichess cloud eval</div>
            <div v-for="(pv, i) in (evalData.pvs ?? [])" :key="i" class="eval-row">
              <span class="eval-score">{{ pv.cp !== undefined ? (pv.cp > 0 ? '+' : '') + (pv.cp / 100).toFixed(2) : (pv.mate > 0 ? '#' + pv.mate : '-#' + Math.abs(pv.mate)) }}</span>
              <span class="eval-moves">{{ (pv.moves ?? '').split(' ').slice(0, 5).join(' ') }}</span>
            </div>
          </template>
        </div>

        <!-- Explorer frequency panel -->
        <div v-if="lichessToken" class="explorer-panel">
          <div v-if="explorerLoading" class="explorer-loading">⏳ Loading move stats…</div>
          <div v-else-if="explorerError === 'auth'" class="explorer-error">🔑 Lichess token expired — reconnect in Settings.</div>
          <div v-else-if="explorerError" class="explorer-error">⚠️ Could not load move stats.</div>
          <template v-else-if="explorerData && explorerFreqMap.size">
            <div class="explorer-header">
              👥 Lichess games
              <span class="explorer-elo-badge">{{ currentEloLabel }}</span>
            </div>
            <div
              v-for="[san, f] in [...explorerFreqMap.entries()].sort((a,b) => b[1].total - a[1].total)"
              :key="san"
              class="explorer-move-row"
              @click="explorerPlayMove(san)"
            >
              <span class="explorer-san">{{ san }}</span>
              <div class="explorer-bar-wrap">
                <div class="explorer-bar" :style="{ width: f.pct + '%' }" />
              </div>
              <span class="explorer-pct">{{ f.pct }}%</span>
              <span class="explorer-total">{{ f.total.toLocaleString() }}</span>
            </div>
          </template>
          <div v-else-if="explorerData" class="explorer-empty">No games found for this position.</div>
        </div>
        <div v-else class="explorer-connect-hint">
          🔗 <em>Connect Lichess in Settings</em> to see move frequency by opponents.
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
          <div class="tree-toolbar">
            <button class="btn tiny" @click="copyPgn" :disabled="!currentRep?.root?.children?.length" title="Copy PGN to clipboard">📋 Copy PGN</button>
            <button class="btn tiny" @click="downloadPgn" :disabled="!currentRep?.root?.children?.length" title="Download as .pgn file">⬇ Download</button>
            <span v-if="copyMsg" class="copy-msg">{{ copyMsg }}</span>
          </div>
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

          <!-- Annotation + chapter name for selected node -->
          <div v-if="selectedNodeId && selectedNodeId !== currentRep?.root?.id" class="annotation-box">
            <div class="annotation-label">Annotation for <strong>{{ selectedNodeSan }}</strong></div>
            <textarea
              v-model="annotationDraft"
              class="annotation-input"
              placeholder="Add a note…"
              rows="3"
              @input="saveAnnotation"
            />
            <div class="chapter-name-row">
              <span class="annotation-label">📖 Chapter name</span>
              <div class="chapter-name-input-wrap">
                <input
                  v-model="chapterNameDraft"
                  class="text-input chapter-name-input"
                  placeholder="Name this line as a chapter…"
                  @input="saveChapterName"
                />
                <button
                  v-if="chapterNameDraft"
                  class="chapter-name-clear"
                  @click="chapterNameDraft = ''; saveChapterName()"
                  title="Remove chapter name"
                >✕</button>
              </div>
            </div>
          </div>

          <!-- Opponent line manager — shown at opponent junctions with 2+ children -->
          <div v-if="isOpponentJunction" class="opp-line-manager">
            <div class="opp-line-header">
              🎯 Training lines
              <span class="opp-line-count">{{ activeLineCount(editorCurrentNode.id, editorCurrentNode.children) }}</span>
            </div>
            <div
              v-for="child in editorCurrentNode.children"
              :key="child.id"
              class="opp-line-row"
              :class="{ inactive: !isChildActive(editorCurrentNode.id, child.id) }"
              @click="toggleOpponentLine(editorCurrentNode.id, child, editorCurrentNode.children)"
            >
              <span class="opp-line-toggle">{{ isChildActive(editorCurrentNode.id, child.id) ? '✅' : '⬜' }}</span>
              <span class="opp-line-san">{{ child.san }}</span>
              <template v-if="childFreq(child.san)">
                <div class="opp-line-bar-wrap">
                  <div class="opp-line-bar" :style="{ width: childFreq(child.san).pct + '%' }" />
                </div>
                <span class="opp-line-freq">1 in {{ Math.round(100 / Math.max(1, childFreq(child.san).pct)) }}</span>
              </template>
              <span v-else-if="lichessToken" class="opp-line-no-data">—</span>
            </div>
          </div>
        </div>

        <!-- PGN import tab -->
        <div v-if="editorTab === 'import'" class="import-tab">
          <p class="import-hint">Paste a PGN or drop a <code>.pgn</code> file below. Moves will be merged into the current repertoire.</p>
          <div
            class="pgn-drop-zone"
            :class="{ 'drop-active': pgndragOver }"
            @dragover.prevent="pgndragOver = true"
            @dragleave="pgndragOver = false"
            @drop.prevent="onPgnFileDrop"
          >
            <textarea v-model="importPgn" class="pgn-input" placeholder="[Event &quot;…&quot;]\n1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *" rows="8" />
            <div class="drop-overlay" v-if="pgndragOver">📂 Drop .pgn file here</div>
          </div>
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
          :arrows="trainerArrows"
          @square-click="onTrainerSquareClick"
          @drop="onTrainerDrop"
        />
        <div :class="['train-feedback', trainFeedback]" v-if="trainFeedback">
          {{ trainFeedback === 'correct' ? '✓ Correct!' : trainFeedback === 'wrong' ? '✗ Try again' : trainFeedback === 'allClear' ? '🏆 All weaknesses cleared!' : '🎉 Line complete!' }}
        </div>

        <!-- Variant picker overlay -->
        <div v-if="variantPickerChoices" class="variant-picker-overlay">
          <div class="variant-picker">
            <div class="variant-picker-title">🔀 Which line do you want to play?</div>
            <div class="variant-picker-subtitle">After opponent's move, the repertoire offers multiple responses. Pick your preferred line:</div>
            <button
              v-for="child in variantPickerChoices.children"
              :key="child.id"
              class="btn variant-btn"
              @click="pickVariant(child, true)"
            >
              <span class="variant-san">{{ child.san }}</span>
              <span class="variant-remember">📌 Set as preferred & train this</span>
            </button>
            <div class="variant-picker-divider"></div>
            <button class="btn variant-btn random-btn" @click="pickVariantAllLines">
              🎲 No preference — train all lines
            </button>
          </div>
        </div>
      </div>

      <!-- Info panel -->
      <div class="trainer-panel">
        <div class="panel-header">
          <button class="back-btn small" @click="subView = 'list'">← Repertoires</button>
        </div>

        <!-- Line/chapter name banner -->
        <div v-if="trainingLineNode?.chapterName" class="line-banner">
          📖 {{ trainingLineNode.chapterName }}
          <button class="btn tiny" style="margin-left:8px;" @click="trainingLineNode = null">All lines</button>
        </div>

        <!-- Weakness mode banner -->
        <div v-if="trainMode === 'weaknesses'" class="weakness-banner">
          🎯 Weakness mode
          <button class="btn small" style="font-size:0.72rem; padding:2px 7px; margin-left:8px;" @click="trainMode = 'normal'">Normal</button>
        </div>

        <!-- Lichess frequency mode banner -->
        <div v-if="lichessToken" class="freq-mode-row">
          <span class="freq-mode-label">👥 Opponents filtered by ELO range ({{ explorerRangeMin }}–{{ explorerRangeMax }})</span>
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
          <div class="stat" v-if="weakPositionCount > 0">
            <span class="stat-num weak-num">{{ weakPositionCount }}</span>
            <span class="stat-label">Weak</span>
          </div>
        </div>

        <div v-if="streak >= 3" class="streak-row">
          <span class="streak-fire">🔥</span>
          <span class="streak-count">{{ streak }} in a row!</span>
        </div>

        <div class="train-hint">
          <template v-if="currentRep?.color === 'w'">You play <strong>White</strong>. Make the next move.</template>
          <template v-else>You play <strong>Black</strong>. Respond to White's move.</template>
        </div>

        <div v-if="trainerCurrentAnnotation" class="train-annotation">
          💡 {{ trainerCurrentAnnotation }}
        </div>

        <button
          v-if="!showArrows && trainerCurrentNode?.children?.length && trainerChess.turn() === currentRep?.color"
          class="btn hint-btn"
          @click="hintRequested = true"
        >💡 Show hint</button>

        <button class="btn" @click="restartTraining">↺ Restart</button>

        <!-- Stored variation preferences -->
        <div v-if="preferredMoves.size > 0" class="pref-summary">
          <div class="pref-summary-label">📌 Saved variation preferences ({{ preferredMoves.size }})</div>
          <button class="btn tiny" @click="clearAllPreferences">✕ Clear all</button>
        </div>

        <button class="btn" style="color:var(--text-muted); font-size:0.78rem;" @click="resetProgress">🗑 Reset progress</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, triggerRef, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Chess } from 'chess.js'
import { useRepertoire, countNodes, findNode, getRepLines } from '../composables/useRepertoire.js'
import { parsePgnToTree, parsePgnGames, treeToPgn } from '../utils/pgnVariantParser.js'
import RepertoireTree from './RepertoireTree.vue'
import ChessBoard from './ChessBoard.vue'
import { lichessToken, lichessUser } from '../composables/useLichessAuth.js'
import {
  explorerData, explorerLoading, explorerError,
  explorerRangeMin, explorerRangeMax, EXPLORER_RMIN, EXPLORER_RMAX, EXPLORER_RSTEP,
  fetchExplorer, prefetchExplorer, getCachedExplorer, movesFreqMap, eloLabel,
  bucketsForRange,
} from '../composables/useLichessExplorer.js'

const emit = defineEmits(['back'])

const { repertoires, addRepertoire, deleteRepertoire, addMove, removeNode, setAnnotation, setChapterName, importTree, importTreeWithChapters, setPreferred } = useRepertoire()

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

function openTraining(rep, mode = 'normal', lineNode = null) {
  if (!rep.root.children.length) {
    alert('This repertoire is empty. Add some moves first.')
    return
  }
  currentRep.value = rep
  const saved = loadRepTrainStats(rep.id)
  knownNodeIds.value = saved.knownNodeIds
  wrongCounts.value = saved.wrongCounts
  preferredMoves.value = saved.preferredMoves
  activeOpponentLines.value = saved.activeOpponentLines
  trainMode.value = mode
  trainingLineNode.value = lineNode
  variantPickerChoices.value = null
  subView.value = 'train'
  restartTraining()
}

function openTrainingWeaknesses(rep, lineNode = null) {
  openTraining(rep, 'weaknesses', lineNode)
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
const chapterNameDraft = ref('')
const importPgn = ref('')
const importMsg = ref('')
const importMsgType = ref('ok')
const pgndragOver = ref(false)
const copyMsg = ref('')
let _copyMsgTimer = null

function getExportPgn() {
  return treeToPgn(currentRep.value.root, currentRep.value.name ?? '')
}

function copyPgn() {
  if (!currentRep.value?.root?.children?.length) return
  navigator.clipboard.writeText(getExportPgn()).then(() => {
    clearTimeout(_copyMsgTimer)
    copyMsg.value = '✓ Copied!'
    _copyMsgTimer = setTimeout(() => { copyMsg.value = '' }, 2000)
  }).catch(() => {
    copyMsg.value = '✗ Failed'
    _copyMsgTimer = setTimeout(() => { copyMsg.value = '' }, 2000)
  })
}

function downloadPgn() {
  if (!currentRep.value?.root?.children?.length) return
  const pgn = getExportPgn()
  const name = (currentRep.value.name ?? 'repertoire').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.pgn`
  a.click()
  URL.revokeObjectURL(url)
}

function onPgnFileDrop(event) {
  pgndragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!file.name.endsWith('.pgn') && file.type !== 'application/x-chess-pgn') {
    importMsg.value = '✗ Only .pgn files are supported.'
    importMsgType.value = 'err'
    setTimeout(() => { importMsg.value = '' }, 3000)
    return
  }
  const reader = new FileReader()
  reader.onload = e => { importPgn.value = e.target.result }
  reader.readAsText(file)
}

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
  chapterNameDraft.value = ''
  editorFlipped.value = currentRep.value?.color === 'b'
}

function editorGoRoot() {
  editorChess.value = new Chess()
  editorSelected.value = null
  editorPath.value = []
  selectedNodeId.value = currentRep.value?.root?.id ?? null
  annotationDraft.value = ''
  chapterNameDraft.value = ''
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
  chapterNameDraft.value = found ? (found[0].chapterName ?? '') : ''
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
          chapterNameDraft.value = node.chapterName ?? ''
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
  chapterNameDraft.value = node.chapterName ?? ''
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

function saveChapterName() {
  if (!currentRep.value || !selectedNodeId.value) return
  setChapterName(currentRep.value.id, selectedNodeId.value, chapterNameDraft.value)
}

function doImport() {
  if (!importPgn.value.trim() || !currentRep.value) return
  try {
    const games = parsePgnGames(importPgn.value)
    const hasChapters = games.some(g => g.chapterName)
    let added
    if (hasChapters) {
      added = importTreeWithChapters(currentRep.value.id, games)
    } else {
      added = games.reduce((sum, g) => sum + importTree(currentRep.value.id, g.root), 0)
    }
    importMsg.value = added > 0 ? `✓ Added ${added} new move${added !== 1 ? 's' : ''}${hasChapters ? ` across ${games.length} chapter${games.length !== 1 ? 's' : ''}` : ''}.` : 'No new moves found (already in repertoire).'
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
const hintRequested = ref(false)
const trainMode = ref('normal') // 'normal' | 'weaknesses'
const streak = ref(0)
const currentLineClean = ref(true) // false if any mistake was made in the current line

// ── Variant picker (opponent branching) ───────────────────────────────────────
// When opponent has multiple choices and no stored preference, show picker.
const variantPickerChoices = ref(null) // null | { fromNode, children, resolve }
const preferredMoves = ref(new Map()) // nodeId → childId (opponent's preferred line)

// ── Line-scoped training ──────────────────────────────────────────────────────
const trainingLineNode = ref(null) // node where the chapter/line starts

const trainingLineAllowedIds = computed(() => {
  if (!trainingLineNode.value || !currentRep.value) return null
  const ids = new Set()
  // Walk from root to lineNode, collecting path
  function findPath(node, target, path) {
    if (node.id === target.id) { path.forEach(n => ids.add(n.id)); ids.add(node.id); return true }
    for (const c of node.children ?? []) {
      if (findPath(c, target, [...path, node])) return true
    }
    return false
  }
  findPath(currentRep.value.root, trainingLineNode.value, [])
  // Add full subtree from lineNode
  function addSubtree(node) { ids.add(node.id); (node.children ?? []).forEach(addSubtree) }
  addSubtree(trainingLineNode.value)
  return ids
})

// ── Card expanded lines ───────────────────────────────────────────────────────
const expandedReps = ref(new Set())

function toggleLines(repId) {
  const s = new Set(expandedReps.value)
  s.has(repId) ? s.delete(repId) : s.add(repId)
  expandedReps.value = s
}

function getLineStats(rep, lineNode) {
  const td = allTrainData.value[rep.id] ?? {}
  const known = td.knownNodeIds ?? []
  const wrong = td.wrongCounts ?? {}
  let knownCount = 0, weakCount = 0, total = 0
  function walk(node) {
    if (node.children?.length) { total++; if (known.includes(node.id)) knownCount++ }
    const wrongC = wrong[node.id] ?? 0
    if (wrongC >= 2) weakCount++
    node.children?.forEach(walk)
  }
  walk(lineNode)
  return { knownCount, total, weakCount }
}

// ── Lichess cloud eval ────────────────────────────────────────────────────────
const evalData = ref(null)
const evalLoading = ref(false)

async function fetchEval() {
  if (!editorChess.value) return
  const fen = editorChess.value.fen()
  evalLoading.value = true
  evalData.value = null
  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3`
    const resp = await fetch(url)
    if (resp.ok) evalData.value = await resp.json()
    else evalData.value = { error: 'No evaluation found for this position.' }
  } catch {
    evalData.value = { error: 'Could not reach Lichess. Check your connection.' }
  }
  evalLoading.value = false
}

// ── Lichess opening explorer ──────────────────────────────────────────────────
const explorerFreqMap = computed(() => movesFreqMap(explorerData.value))
const currentEloLabel = computed(() => eloLabel())
const currentBucketsLabel = computed(() => {
  const b = bucketsForRange(explorerRangeMin.value, explorerRangeMax.value)
  return b.join(', ')
})

// Dual range slider helpers
function onRangeMinInput(e) {
  const v = parseInt(e.target.value)
  if (v >= explorerRangeMax.value) explorerRangeMin.value = explorerRangeMax.value - EXPLORER_RSTEP
  else explorerRangeMin.value = v
  onRangeChanged()
}
function onRangeMaxInput(e) {
  const v = parseInt(e.target.value)
  if (v <= explorerRangeMin.value) explorerRangeMax.value = explorerRangeMin.value + EXPLORER_RSTEP
  else explorerRangeMax.value = v
  onRangeChanged()
}
const dualRangeTrackStyle = computed(() => {
  const span = EXPLORER_RMAX - EXPLORER_RMIN
  const minPct = ((explorerRangeMin.value - EXPLORER_RMIN) / span * 100).toFixed(1)
  const maxPct = ((explorerRangeMax.value - EXPLORER_RMIN) / span * 100).toFixed(1)
  return { '--range-min-pct': `${minPct}%`, '--range-max-pct': `${maxPct}%` }
})

let _rangeDebounce = null
function onRangeChanged() {
  clearTimeout(_rangeDebounce)
  _rangeDebounce = setTimeout(() => {
    if (lichessToken.value && subView.value === 'edit') {
      fetchExplorer(editorChess.value.fen(), { debounce: false })
    }
  }, 400)
}

// Auto-fetch explorer whenever the editor position changes
watch(editorChess, () => {
  if (lichessToken.value) fetchExplorer(editorChess.value.fen())
}, { flush: 'post' })

// Refetch when user connects/disconnects
watch(lichessToken, (token) => {
  if (token) fetchExplorer(editorChess.value.fen(), { debounce: false })
  else explorerData.value = null
})

function explorerPlayMove(san) {
  if (!editorChess.value || !currentRep.value) return
  try {
    const move = editorChess.value.move(san)
    if (!move) return
    triggerRef(editorChess)
    const parentId = selectedNodeId.value ?? currentRep.value.root.id
    const node = addMove(currentRep.value.id, parentId, {
      san: move.san, from: move.from, to: move.to, promotion: move.promotion ?? null,
      fen: editorChess.value.fen(),
    })
    if (node) {
      editorPath.value.push(node.id)
      selectedNodeId.value = node.id
      annotationDraft.value = node.annotation
      chapterNameDraft.value = node.chapterName ?? ''
    }
    editorSelected.value = null
  } catch {}
}

// ── Opponent line manager ─────────────────────────────────────────────────────

// The node currently selected/visible in the editor
const editorCurrentNode = computed(() => {
  if (!currentRep.value) return null
  const id = selectedNodeId.value ?? currentRep.value.root.id
  const found = findNode(currentRep.value.root, id)
  return found ? found[0] : currentRep.value.root
})

// True when the current position is the opponent's turn and has multiple children
const isOpponentJunction = computed(() => {
  const node = editorCurrentNode.value
  if (!node?.children?.length) return false
  const turn = editorChess.value.turn()   // whose turn it is at this position
  const userColor = currentRep.value?.color  // 'w' or 'b'
  const opponentTurn = userColor === 'w' ? 'b' : 'w'
  return turn === opponentTurn && node.children.length > 1
})

// Returns a freq entry (or null) for a child SAN at the current position
function childFreq(san) {
  return explorerFreqMap.value.get(san) ?? null
}

// Is a given child currently active for training at this junction?
function isChildActive(parentNodeId, childId) {
  const set = activeOpponentLines.value.get(parentNodeId)
  if (!set) return true  // default: all active
  return set.has(childId)
}

// Toggle a child on/off at the current junction
function toggleOpponentLine(parentNodeId, child, allChildren) {
  const map = new Map(activeOpponentLines.value)
  let set = map.has(parentNodeId) ? new Set(map.get(parentNodeId)) : new Set(allChildren.map(c => c.id))
  if (set.has(child.id)) {
    // Only deactivate if at least one other child remains active
    if (set.size > 1) set.delete(child.id)
  } else {
    set.add(child.id)
  }
  // If all children are active, remove the entry entirely (keeps storage clean)
  if (set.size === allChildren.length) map.delete(parentNodeId)
  else map.set(parentNodeId, set)
  activeOpponentLines.value = map
  // Persist immediately (re-use existing save, but we need to load the rep stats first)
  if (currentRep.value) saveRepTrainStats(currentRep.value.id)
}

// Active count label for a junction
function activeLineCount(parentNodeId, allChildren) {
  const set = activeOpponentLines.value.get(parentNodeId)
  const count = set ? set.size : allChildren.length
  return `${count} / ${allChildren.length} lines active`
}

// ── All-rep training data for card display ────────────────────────────────────
const allTrainData = ref({})

function refreshAllTrainData() {
  try { allTrainData.value = JSON.parse(localStorage.getItem(TRAIN_KEY) ?? '{}') }
  catch { allTrainData.value = {} }
}

function getCardStats(rep) {
  const s = allTrainData.value[rep.id] ?? {}
  const knownCount = (s.knownNodeIds ?? []).length
  const wrongCounts = s.wrongCounts ?? {}
  const weakCount = Object.values(wrongCounts).filter(v => v > 0).length
  const total = countNodes(rep.root)
  const progress = total > 0 ? Math.min(100, Math.round(knownCount / total * 100)) : 0
  return { knownCount, progress, weakCount, lastPracticed: s.lastPracticed ?? null }
}

function formatRelativeDate(ts) {
  if (!ts) return null
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ── Persistent training stats (per repertoire) ────────────────────────────────
const TRAIN_KEY = 'firechess_train_stats'

function loadRepTrainStats(repId) {
  try {
    const all = JSON.parse(localStorage.getItem(TRAIN_KEY) ?? '{}')
    const s = all[repId] ?? {}
    // activeOpponentLines: { nodeId: childId[] } → Map<nodeId, Set<childId>>
    const aol = s.activeOpponentLines ?? {}
    return {
      knownNodeIds: new Set(s.knownNodeIds ?? []),
      wrongCounts: new Map(Object.entries(s.wrongCounts ?? {})),
      preferredMoves: new Map(Object.entries(s.preferredMoves ?? {})),
      activeOpponentLines: new Map(Object.entries(aol).map(([k, v]) => [k, new Set(v)])),
    }
  } catch { return { knownNodeIds: new Set(), wrongCounts: new Map(), preferredMoves: new Map(), activeOpponentLines: new Map() } }
}

function saveRepTrainStats(repId) {
  try {
    const all = JSON.parse(localStorage.getItem(TRAIN_KEY) ?? '{}')
    // Serialise activeOpponentLines: Map<nodeId, Set<childId>> → { nodeId: childId[] }
    const aolObj = {}
    for (const [k, v] of activeOpponentLines.value) aolObj[k] = [...v]
    all[repId] = {
      knownNodeIds: [...knownNodeIds.value],
      wrongCounts: Object.fromEntries(wrongCounts.value),
      preferredMoves: Object.fromEntries(preferredMoves.value),
      activeOpponentLines: aolObj,
      lastPracticed: Date.now(),
    }
    localStorage.setItem(TRAIN_KEY, JSON.stringify(all))
    refreshAllTrainData()
  } catch {}
}

const knownNodeIds       = ref(new Set())
const wrongCounts        = ref(new Map())
const activeOpponentLines = ref(new Map())  // Map<parentNodeId, Set<childId>>

const weakPositionCount = computed(() => {
  if (!currentRep.value) return 0
  let count = 0
  function walk(node) {
    if (wrongCounts.value.get(node.id) > 0) count++
    for (const c of node.children ?? []) walk(c)
  }
  walk(currentRep.value.root)
  return count
})

function markNodeKnown(nodeId) {
  if (knownNodeIds.value.has(nodeId)) return
  knownNodeIds.value = new Set([...knownNodeIds.value, nodeId])
  saveRepTrainStats(currentRep.value.id)
}

function recordWrong(nodeId) {
  const prev = wrongCounts.value.get(nodeId) ?? 0
  wrongCounts.value = new Map(wrongCounts.value).set(nodeId, prev + 1)
  saveRepTrainStats(currentRep.value.id)
}

function hasWeakInSubtree(node) {
  if ((wrongCounts.value.get(node.id) ?? 0) > 0) return true
  return node.children?.some(c => hasWeakInSubtree(c)) ?? false
}

function resetProgress() {
  if (!currentRep.value) return
  if (!confirm('Reset all progress for this repertoire? This clears known moves and wrong-move counts.')) return
  knownNodeIds.value = new Set()
  wrongCounts.value = new Map()
  preferredMoves.value = new Map()
  streak.value = 0
  saveRepTrainStats(currentRep.value.id)
}

function clearAllPreferences() {
  preferredMoves.value = new Map()
  saveRepTrainStats(currentRep.value.id)
}

// Show arrows when: position is new (not yet known) OR user requested hint
const isNewPosition = computed(() => {
  if (!trainerCurrentNode.value) return false
  if (trainerChess.value.turn() !== currentRep.value?.color) return false
  return !knownNodeIds.value.has(trainerCurrentNode.value.id)
})
const showArrows = computed(() => isNewPosition.value || hintRequested.value)
const trainerArrows = computed(() => {
  if (!showArrows.value) return []
  const node = trainerCurrentNode.value
  if (!node?.children?.length) return []
  if (trainerChess.value.turn() !== currentRep.value?.color) return []
  return node.children
    .filter(c => c.from && c.to)
    .map(c => ({ from: c.from, to: c.to }))
})

const trainerLegalDots = computed(() => {
  if (!trainerSelected.value || !trainerCurrentNode.value) return []
  const allMoves = trainerChess.value.moves({ square: trainerSelected.value, verbose: true })
  const allowedIds = trainingLineAllowedIds.value
  const preferredChildId = preferredMoves.value.get(trainerCurrentNode.value.id)
  // Only show dots for moves in the current repertoire (scoped to preferred if set)
  const validSans = new Set(
    (trainerCurrentNode.value.children ?? [])
      .filter(c => (!allowedIds || allowedIds.has(c.id)) && (!preferredChildId || c.id === preferredChildId))
      .map(c => c.san)
  )
  return allMoves.filter(m => validSans.has(m.san)).map(m => m.to)
})

function restartTraining() {
  trainerChess.value = new Chess()
  trainerSelected.value = null
  trainerCurrentNode.value = currentRep.value?.root ?? null
  trainFeedback.value = ''
  trainStats.value = { correct: 0, wrong: 0, lines: 0 }
  hintRequested.value = false
  streak.value = 0
  currentLineClean.value = true
  variantPickerChoices.value = null
  if (currentRep.value?.color === 'b') {
    nextTick(() => opponentMove())
  } else {
    // User plays first — check if multiple user responses exist at root
    nextTick(() => checkUserVariantPick(currentRep.value?.root))
  }
}

function weightedChoice(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function opponentMove() {
  const node = trainerCurrentNode.value
  if (!node?.children?.length) return
  let children = node.children
  // Restrict to line scope if training a specific line
  if (trainingLineAllowedIds.value) {
    const scoped = children.filter(c => trainingLineAllowedIds.value.has(c.id))
    if (scoped.length > 0) children = scoped
  }
  // Respect user-configured active opponent lines (from editor line manager)
  const activeSet = activeOpponentLines.value.get(node.id)
  if (activeSet?.size) {
    const scoped = children.filter(c => activeSet.has(c.id))
    if (scoped.length > 0) children = scoped
  }
  // In weakness mode, prefer paths that lead through weak positions
  if (trainMode.value === 'weaknesses') {
    const weakChildren = children.filter(c => hasWeakInSubtree(c))
    if (weakChildren.length > 0) children = weakChildren
  }
  // When connected to Lichess, additionally filter to moves found at the selected ELO range;
  // fall back to current pool if no cached data or no matches at this range.
  let weights
  if (lichessToken.value) {
    const fen = trainerChess.value.fen()
    const cached = getCachedExplorer(fen)
    if (cached?.moves?.length) {
      const freqMap = movesFreqMap(cached)
      // Only include moves that appear in the Lichess DB (freq > 0), otherwise fall back
      const inRange = children.filter(c => (freqMap.get(c.san)?.total ?? 0) > 0)
      const pool = inRange.length > 0 ? inRange : children
      children = pool
      weights = children.map(c => {
        const f = freqMap.get(c.san)
        const freqWeight = f ? Math.max(1, f.total) : 1
        const wrongBoost = 1 + (wrongCounts.value.get(c.id) ?? 0) * 3
        return freqWeight * wrongBoost
      })
    } else {
      prefetchExplorer(fen)
      weights = children.map(c => 1 + (wrongCounts.value.get(c.id) ?? 0) * 3)
    }
  } else {
    weights = children.map(c => 1 + (wrongCounts.value.get(c.id) ?? 0) * 3)
  }
  const child = weightedChoice(children, weights)
  try {
    trainerChess.value.move(child.san)
    triggerRef(trainerChess)
    trainerCurrentNode.value = child
    hintRequested.value = false
    // After opponent moves, check if the user now has multiple response options → show picker
    checkUserVariantPick(child)
  } catch (e) {
    console.error('opponentMove: invalid SAN', child.san, e)
  }
}

/**
 * After any position change where it's the user's turn, check if the repertoire
 * offers multiple responses. If so and no preference is stored, show the picker.
 */
function checkUserVariantPick(node) {
  if (!node) return
  const userColor = currentRep.value?.color
  // The NEXT move belongs to the user if node's FEN has user's color to move
  // We check the children — they represent the user's responses
  let children = node.children ?? []
  if (trainingLineAllowedIds.value) {
    const scoped = children.filter(c => trainingLineAllowedIds.value.has(c.id))
    if (scoped.length > 0) children = scoped
  }
  if (children.length <= 1) return // only one option, no choice needed
  // Check if a preference is already stored
  const preferred = preferredMoves.value.get(node.id)
  if (preferred && children.find(c => c.id === preferred)) return // preference valid, no picker
  // Multiple options, no valid preference → show picker
  variantPickerChoices.value = { fromNode: node, children }
}

function pickVariant(child, remember) {
  const fromNode = variantPickerChoices.value?.fromNode
  variantPickerChoices.value = null
  if (remember && fromNode) {
    preferredMoves.value = new Map(preferredMoves.value).set(fromNode.id, child.id)
    saveRepTrainStats(currentRep.value.id)
  }
  // Don't play the move — just set the preference; user still makes the move on the board
  // Trigger arrow update so hint shows the preferred move
  hintRequested.value = false
}

function pickVariantAllLines() {
  // User wants to train all lines without preference — clear stored pref for this node
  const fromNode = variantPickerChoices.value?.fromNode
  if (fromNode && preferredMoves.value.has(fromNode.id)) {
    const m = new Map(preferredMoves.value)
    m.delete(fromNode.id)
    preferredMoves.value = m
    saveRepTrainStats(currentRep.value.id)
  }
  variantPickerChoices.value = null
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

      const allowedIds = trainingLineAllowedIds.value
      const preferredChildId = preferredMoves.value.get(trainerCurrentNode.value.id)
      const match = trainerCurrentNode.value.children.find(c =>
        c.san === san &&
        (!allowedIds || allowedIds.has(c.id)) &&
        (!preferredChildId || c.id === preferredChildId)
      )
      if (match) {
        markNodeKnown(trainerCurrentNode.value.id)
        hintRequested.value = false
        trainStats.value.correct++
        trainerCurrentNode.value = match
        showFeedback('correct')

        if (!match.children.length) {
          // Leaf node — line complete
          trainStats.value.lines++
          if (currentLineClean.value) streak.value++
          else streak.value = 0
          currentLineClean.value = true // reset for next line
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
        recordWrong(trainerCurrentNode.value.id)
        trainStats.value.wrong++
        streak.value = 0
        currentLineClean.value = false
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
  // In weakness mode, check if all weaknesses are resolved
  if (trainMode.value === 'weaknesses' && !hasWeakInSubtree(currentRep.value.root)) {
    showFeedback('allClear')
    trainMode.value = 'normal'
    return
  }
  // Restart from root, let opponent go first if user plays black
  trainerChess.value = new Chess()
  trainerSelected.value = null
  trainerCurrentNode.value = currentRep.value.root
  hintRequested.value = false
  currentLineClean.value = true
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

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  refreshAllTrainData()
})
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

/* ── ELO range slider ── */
.elo-range-section {
  background: var(--bg-panel);
  border: 1px solid rgba(181,136,99,0.3);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.elo-range-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  flex-wrap: wrap;
}
.elo-range-title { font-weight: 600; }
.elo-range-value {
  background: rgba(181,136,99,0.2);
  border: 1px solid rgba(181,136,99,0.4);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.85rem;
  font-weight: 700;
}
.elo-range-hint-inline { font-size: 0.82rem; color: var(--text-secondary); }
.elo-range-hint-inline a { color: #b58863; cursor: pointer; }

/* Dual range slider */
.dual-range-wrap {
  position: relative;
  height: 28px;
}
.dual-range-wrap::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: var(--range-min-pct);
  right: calc(100% - var(--range-max-pct));
  height: 4px;
  border-radius: 2px;
  background: #b58863;
  pointer-events: none;
}
.range-input {
  position: absolute;
  width: 100%;
  top: 50%;
  transform: translateY(-50%);
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  height: 4px;
}
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #b58863;
  border: 2px solid #fff;
  cursor: pointer;
  pointer-events: all;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  transition: transform 0.1s;
}
.range-input::-webkit-slider-thumb:hover { transform: scale(1.15); }
.range-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #b58863;
  border: 2px solid #fff;
  cursor: pointer;
  pointer-events: all;
}
.range-input::-webkit-slider-runnable-track {
  height: 4px;
  background: rgba(255,255,255,0.12);
  border-radius: 2px;
}
.elo-range-buckets { font-size: 0.78rem; color: var(--text-secondary); }

/* Coverage badge on rep cards */
.coverage-badge {
  font-size: 0.78rem;
  background: rgba(99,181,130,0.18);
  border: 1px solid rgba(99,181,130,0.35);
  color: #7ecfa2;
  border-radius: 4px;
  padding: 2px 7px;
}
.coverage-badge.loading { opacity: 0.5; }
.coverage-total { opacity: 0.6; }

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
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.25);
}
.rep-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rep-card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.rep-name { font-weight: 700; font-size: 1rem; }
.rep-count { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; }
.rep-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.weakness-btn { color: #e74c3c; border-color: #e74c3c33; }
.weakness-btn:hover:not(:disabled) { background: #e74c3c22; }

/* ── Rep card stats row ── */
.rep-card-stats { display: flex; flex-direction: column; gap: 5px; }
.rep-progress-wrap { display: flex; align-items: center; gap: 8px; }
.rep-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-surface);
  border-radius: 3px;
  overflow: hidden;
}
.rep-progress-fill {
  height: 100%;
  background: #b58863;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.rep-progress-label { font-size: 0.74rem; color: var(--text-muted); white-space: nowrap; }
.rep-card-meta { display: flex; gap: 10px; align-items: center; }
.rep-weak-badge { font-size: 0.74rem; color: #e74c3c; font-weight: 600; }
.rep-last-practiced { font-size: 0.74rem; color: var(--text-muted); }

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
.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.copy-msg {
  font-size: 0.78rem;
  color: #7ecfa2;
  margin-left: 4px;
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

.chapter-name-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.chapter-name-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.chapter-name-input {
  flex: 1;
  padding-right: 28px;
}
.chapter-name-clear {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  line-height: 1;
}
.chapter-name-clear:hover { color: var(--text-primary); }

/* ── Opponent line manager ── */
.opp-line-manager {
  border-top: 1px solid var(--border);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.opp-line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 2px;
}
.opp-line-count {
  font-size: 0.75rem;
  opacity: 0.7;
  font-weight: 400;
}
.opp-line-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.12s, opacity 0.12s;
  font-size: 0.85rem;
}
.opp-line-row:hover { background: rgba(181,136,99,0.1); border-color: rgba(181,136,99,0.25); }
.opp-line-row.inactive { opacity: 0.45; }
.opp-line-toggle { font-size: 1rem; flex-shrink: 0; }
.opp-line-san { font-weight: 700; min-width: 44px; font-family: monospace; }
.opp-line-bar-wrap {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.opp-line-bar { height: 100%; background: #b58863; border-radius: 3px; }
.opp-line-freq { font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; min-width: 60px; text-align: right; }
.opp-line-no-data { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; }

/* ── Import tab ── */
.import-tab {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pgn-drop-zone {
  position: relative;
  border-radius: 6px;
  border: 2px dashed var(--border, #3a3a4a);
  transition: border-color 0.15s, background 0.15s;
}
.pgn-drop-zone.drop-active {
  border-color: var(--primary, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}
.pgn-drop-zone .pgn-input {
  border: none;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
}
.drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary, #6366f1);
  background: rgba(99, 102, 241, 0.12);
  border-radius: 4px;
  pointer-events: none;
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
  position: relative;
}
/* ── Variant picker overlay ───────────────────────────────────────────────── */
.variant-picker-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.55);
  border-radius: 12px;
  z-index: 20;
  padding: 12px;
}
.variant-picker {
  background: var(--bg-card, #1e1e2e);
  border: 1px solid var(--border, #3a3a4a);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.variant-picker-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary, #eee);
  margin-bottom: 2px;
  text-align: center;
}
.variant-picker-subtitle {
  font-size: 0.7rem;
  color: var(--text-muted, #888);
  text-align: center;
  margin-bottom: 4px;
  line-height: 1.4;
}
.variant-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 8px 12px;
  background: var(--bg-card2, rgba(255,255,255,0.06));
  border: 1px solid var(--border, #3a3a4a);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-align: left;
}
.variant-btn:hover { background: var(--primary-dim, rgba(99,102,241,0.18)); border-color: var(--primary, #6366f1); }
.variant-san { font-size: 1rem; font-weight: 700; color: var(--text-primary, #eee); font-family: monospace; }
.variant-remember { font-size: 0.65rem; color: var(--text-muted, #888); }
.random-btn .variant-san { font-family: inherit; font-size: 0.85rem; font-weight: 600; }
.variant-picker-divider { height: 1px; background: var(--border, #3a3a4a); margin: 2px 0; }
.random-btn { opacity: 0.75; }
/* ── Pref summary ─────────────────────────────────────────────────────────── */
.pref-summary { display: flex; align-items: center; justify-content: space-between; background: var(--bg-card2, rgba(255,255,255,0.04)); border: 1px solid var(--border, #3a3a4a); border-radius: 8px; padding: 6px 10px; gap: 8px; }
.pref-summary-label { font-size: 0.72rem; color: var(--text-muted, #aaa); }
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
.train-feedback.allClear { background: #2a1a4a; color: #c084fc; }

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
.stat-num.weak-num { color: #f87171; }
.stat-num.streak-num { color: #fb923c; }
.streak-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}
.streak-fire { font-size: 1.5rem; }
.streak-count { font-size: 1rem; font-weight: 700; color: #fb923c; }
.stat-label { font-size: 0.7rem; color: var(--text-muted); }
.train-hint { font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; }
.hint-btn { background: #3a2800; color: #fbbf24; border-color: #7a5a00; }

/* ── Weakness mode banner ── */
.weakness-banner {
  display: flex;
  align-items: center;
  background: #3a1010;
  color: #f87171;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.82rem;
  font-weight: 700;
}
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

/* ── Named lines expandable section ─────────────────────────────────────────── */
.lines-toggle { font-size: 0.7rem; padding: 1px 6px; }
.rep-lines { border-top: 1px solid var(--border, #3a3a4a); margin-top: 6px; padding-top: 6px; display: flex; flex-direction: column; gap: 6px; }
.rep-line-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px; background: var(--bg-card2, rgba(255,255,255,0.04)); }
.rep-line-info { flex: 1; min-width: 0; }
.rep-line-name { font-size: 0.78rem; font-weight: 600; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rep-line-progress-wrap { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.rep-line-bar { flex: 1; height: 5px; border-radius: 3px; background: var(--bar-bg, rgba(255,255,255,0.12)); overflow: hidden; }
.rep-line-fill { height: 100%; border-radius: 3px; background: var(--primary, #6366f1); transition: width 0.4s; }
.rep-line-label { font-size: 0.65rem; color: var(--text-muted, #888); white-space: nowrap; }
.rep-line-actions { display: flex; gap: 4px; flex-shrink: 0; }
.btn.tiny { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; }
.rep-weak-badge.small { font-size: 0.65rem; }

/* ── Line banner in trainer ───────────────────────────────────────────────────── */
.line-banner { background: #1a2a1a; color: #86efac; border: 1px solid #22c55e; border-radius: 8px; padding: 6px 12px; font-size: 0.78rem; margin: 6px 0; display: flex; align-items: center; flex-wrap: wrap; }

/* ── Lichess eval panel ───────────────────────────────────────────────────────── */
.eval-panel { background: var(--bg-card2, rgba(255,255,255,0.05)); border: 1px solid var(--border, #3a3a4a); border-radius: 8px; padding: 8px 12px; margin-top: 6px; font-size: 0.78rem; }
.eval-header { font-weight: 700; margin-bottom: 4px; color: var(--text-muted, #aaa); font-size: 0.72rem; }
.eval-row { display: flex; gap: 10px; margin: 2px 0; }
.eval-score { font-weight: 700; min-width: 44px; color: var(--primary, #6366f1); }
.eval-moves { color: var(--text, #ddd); font-family: monospace; font-size: 0.72rem; }
.eval-error { color: #f87171; font-size: 0.72rem; }

/* ── Lichess opening explorer panel ─────────────────────────────────────────── */
.explorer-panel {
  background: var(--bg-card2, rgba(255,255,255,0.05));
  border: 1px solid var(--border, #3a3a4a);
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 6px;
  font-size: 0.78rem;
  min-height: 32px;
}
.explorer-header {
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-muted, #aaa);
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  gap: 6px;
}
.explorer-elo-badge {
  background: #2d2d3f;
  border: 1px solid #555;
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 0.66rem;
  color: #b58863;
  font-weight: 600;
}
.explorer-move-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.1s;
}
.explorer-move-row:hover { background: var(--btn-hover, rgba(255,255,255,0.07)); }
.explorer-san {
  font-family: monospace;
  font-weight: 700;
  font-size: 0.8rem;
  min-width: 36px;
  color: var(--text-primary, #eee);
}
.explorer-bar-wrap {
  flex: 1;
  height: 7px;
  border-radius: 4px;
  background: rgba(255,255,255,0.1);
  overflow: hidden;
}
.explorer-bar {
  height: 100%;
  border-radius: 4px;
  background: #b58863;
  transition: width 0.3s;
}
.explorer-pct {
  min-width: 30px;
  text-align: right;
  font-size: 0.72rem;
  color: #b58863;
  font-weight: 700;
}
.explorer-total {
  min-width: 48px;
  text-align: right;
  font-size: 0.7rem;
  color: var(--text-muted, #888);
}
.explorer-loading, .explorer-error, .explorer-empty {
  font-size: 0.72rem;
  color: var(--text-muted, #aaa);
  padding: 2px 0;
}
.explorer-error { color: #f87171; }
.explorer-connect-hint {
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--text-muted, #888);
  padding: 6px 10px;
  border: 1px dashed var(--border, #3a3a4a);
  border-radius: 8px;
}

/* ── Freq-weighted training toggle ───────────────────────────────────────────── */
.freq-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  background: rgba(181,136,99,0.1);
  border: 1px solid rgba(181,136,99,0.25);
  border-radius: 8px;
  font-size: 0.78rem;
}
.freq-mode-label { color: #b58863; font-weight: 600; }
.toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--border-mid, #555);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
  cursor: pointer;
}
.toggle.on { background: #b58863; }
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.toggle.on .toggle-knob { transform: translateX(16px); }

@media (max-width: 800px) {
  .ot-body { flex-direction: column; align-items: center; }
  .editor-panel, .trainer-panel { width: 100%; max-width: 480px; }
  .editor-board-wrap :deep(.board),
  .trainer-board-wrap :deep(.board) { width: min(480px, 90vw); height: min(480px, 90vw); }
}
</style>
