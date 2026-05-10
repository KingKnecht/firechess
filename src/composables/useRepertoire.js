import { ref, watch } from 'vue'

const STORAGE_KEY = 'firechess_repertoires'

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function save(arr) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)) } catch {}
}

/** Count total nodes in a tree (excluding root) */
export function countNodes(node) {
  if (!node?.children?.length) return 0
  return node.children.reduce((acc, c) => acc + 1 + countNodes(c), 0)
}

/** Find a node by id in the tree, returns [node, parent] */
export function findNode(root, id, parent = null) {
  if (root.id === id) return [root, parent]
  for (const child of root.children ?? []) {
    const found = findNode(child, id, root)
    if (found) return found
  }
  return null
}

/** Create a fresh root node for a new repertoire */
export function makeRoot(fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
  return { id: uuid(), san: '', from: '', to: '', promotion: null, fen, annotation: '', children: [] }
}

/**
 * Merge a parsed tree (from PGN) into an existing tree node.
 * Returns count of newly added nodes.
 */
function mergeTree(existing, incoming) {
  let added = 0
  for (const inChild of incoming.children ?? []) {
    const match = existing.children.find(c => c.san === inChild.san)
    if (match) {
      // Merge deeper
      if (inChild.annotation && !match.annotation) match.annotation = inChild.annotation
      added += mergeTree(match, inChild)
    } else {
      existing.children.push(inChild)
      added += 1 + countNodes(inChild)
    }
  }
  return added
}

// ── Reactive store ────────────────────────────────────────────────────────────

const repertoires = ref(load())

watch(repertoires, (val) => save(val), { deep: true })

export function useRepertoire() {
  function addRepertoire(name, color) {
    const rep = {
      id: uuid(),
      name,
      color, // 'w' | 'b'
      root: makeRoot(),
      createdAt: Date.now(),
    }
    repertoires.value.push(rep)
    return rep
  }

  function deleteRepertoire(id) {
    repertoires.value = repertoires.value.filter(r => r.id !== id)
  }

  function updateRepertoire(id, partial) {
    const rep = repertoires.value.find(r => r.id === id)
    if (rep) Object.assign(rep, partial)
  }

  /**
   * Add a move as a child of parentId inside repertoire repId.
   * If an identical SAN child already exists, just returns that child.
   * Returns the (new or existing) child node.
   */
  function addMove(repId, parentId, { san, from, to, promotion, fen }) {
    const rep = repertoires.value.find(r => r.id === repId)
    if (!rep) return null
    const found = findNode(rep.root, parentId)
    if (!found) return null
    const [parent] = found
    const existing = parent.children.find(c => c.san === san)
    if (existing) return existing
    const node = { id: uuid(), san, from, to, promotion: promotion ?? null, fen, annotation: '', children: [] }
    parent.children.push(node)
    return node
  }

  /**
   * Remove a node (and its whole subtree) from the repertoire.
   */
  function removeNode(repId, nodeId) {
    const rep = repertoires.value.find(r => r.id === repId)
    if (!rep) return
    const found = findNode(rep.root, nodeId)
    if (!found) return
    const [, parent] = found
    if (!parent) return // don't allow removing root
    parent.children = parent.children.filter(c => c.id !== nodeId)
  }

  /**
   * Update annotation on a node.
   */
  function setAnnotation(repId, nodeId, text) {
    const rep = repertoires.value.find(r => r.id === repId)
    if (!rep) return
    const found = findNode(rep.root, nodeId)
    if (found) found[0].annotation = text
  }

  /**
   * Merge a parsed tree into the repertoire root.
   * Returns count of newly added nodes.
   */
  function importTree(repId, parsedRoot) {
    const rep = repertoires.value.find(r => r.id === repId)
    if (!rep) return 0
    return mergeTree(rep.root, parsedRoot)
  }

  return {
    repertoires,
    addRepertoire,
    deleteRepertoire,
    updateRepertoire,
    addMove,
    removeNode,
    setAnnotation,
    importTree,
  }
}
