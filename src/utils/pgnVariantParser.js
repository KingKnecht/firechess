import { Chess } from 'chess.js'
import { makeRoot } from '../composables/useRepertoire.js'

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)$/

/**
 * Tokenize a PGN string into an array of tokens:
 *   { type: 'move', value: 'e4' }
 *   { type: 'comment', value: 'This is good' }
 *   { type: 'nag', value: '$1' }
 *   { type: 'open' }   — ( variation start
 *   { type: 'close' }  — )
 *   { type: 'result', value: '1-0' }
 *   { type: 'num', value: '1' }  — move number (discarded by parser)
 */
function tokenize(pgn) {
  const tokens = []
  let i = 0
  while (i < pgn.length) {
    const ch = pgn[i]
    // Whitespace
    if (/\s/.test(ch)) { i++; continue }
    // Comment
    if (ch === '{') {
      const end = pgn.indexOf('}', i + 1)
      tokens.push({ type: 'comment', value: pgn.slice(i + 1, end === -1 ? pgn.length : end).trim() })
      i = end === -1 ? pgn.length : end + 1
      continue
    }
    // Variation open/close
    if (ch === '(') { tokens.push({ type: 'open' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'close' }); i++; continue }
    // NAG
    if (ch === '$') {
      let j = i + 1
      while (j < pgn.length && /\d/.test(pgn[j])) j++
      tokens.push({ type: 'nag', value: pgn.slice(i, j) })
      i = j
      continue
    }
    // Inline annotation symbols (!?, ?!, !!, ??, !, ?)
    if ('!?'.includes(ch)) {
      let j = i
      while (j < pgn.length && '!?'.includes(pgn[j])) j++
      tokens.push({ type: 'nag', value: pgn.slice(i, j) })
      i = j
      continue
    }
    // Header tags — skip entire line
    if (ch === '[') {
      const end = pgn.indexOf(']', i)
      i = end === -1 ? pgn.length : end + 1
      continue
    }
    // Read a word token
    let j = i
    while (j < pgn.length && !/[\s(){}[\]$!?]/.test(pgn[j])) j++
    const word = pgn.slice(i, j)
    i = j
    if (!word) { i++; continue }
    if (RESULT_RE.test(word)) {
      tokens.push({ type: 'result', value: word })
    } else if (/^\d+\.+$/.test(word) || /^\d+$/.test(word)) {
      tokens.push({ type: 'num', value: word })
    } else {
      tokens.push({ type: 'move', value: word })
    }
  }
  return tokens
}

// ── Recursive variation parser ────────────────────────────────────────────────

/**
 * Parse tokens starting at index `pos` into children of `parentNode`.
 * `chess` is a Chess instance positioned at the parent's FEN.
 * Returns { children, pos } where pos is the index after the consumed tokens.
 */
function parseVariation(tokens, pos, chess) {
  const children = []
  let lastNode = null // the node most recently added at this depth

  while (pos < tokens.length) {
    const tok = tokens[pos]

    if (tok.type === 'result') { pos++; break }

    if (tok.type === 'close') { break } // caller will consume ')'

    if (tok.type === 'num' || tok.type === 'nag') { pos++; continue }

    if (tok.type === 'comment') {
      if (lastNode) lastNode.annotation = (lastNode.annotation ? lastNode.annotation + ' ' : '') + tok.value
      pos++; continue
    }

    if (tok.type === 'open') {
      // Variation: replay from the node *before* lastNode
      pos++ // consume '('
      if (lastNode && lastNode._parentFen) {
        const varChess = new Chess()
        varChess.load(lastNode._parentFen)
        const { children: varChildren, pos: newPos } = parseVariation(tokens, pos, varChess)
        // These become siblings of lastNode — attach to lastNode's parent
        if (lastNode._siblings) lastNode._siblings.push(...varChildren)
        pos = newPos
      } else {
        // Skip the variation if we can't anchor it
        let depth = 1
        while (pos < tokens.length && depth > 0) {
          if (tokens[pos].type === 'open') depth++
          else if (tokens[pos].type === 'close') depth--
          pos++
        }
      }
      if (pos < tokens.length && tokens[pos].type === 'close') pos++ // consume ')'
      continue
    }

    if (tok.type === 'move') {
      const san = tok.value
      pos++
      let move
      try { move = chess.move(san) } catch { continue }
      if (!move) continue

      const node = {
        id: uuid(),
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? null,
        fen: chess.fen(),
        annotation: '',
        children: [],
        _parentFen: chess.fen(), // temp — used to anchor variations; removed at end
        _siblings: children,     // temp — reference to sibling array for variations
      }
      // Undo the move so we can re-root variations, then re-apply
      // Actually: chess is already advanced, store parent fen before move
      // We need the FEN *before* this move for variations.
      // Let's undo + re-advance with proper tracking:
      chess.undo()
      const parentFen = chess.fen()
      chess.move(san) // re-apply
      node._parentFen = parentFen

      if (lastNode) {
        // Chain: lastNode.children gets this next move
        lastNode.children.push(node)
        node._siblings = lastNode.children
      } else {
        children.push(node)
        node._siblings = children
      }
      lastNode = node
      continue
    }

    pos++
  }

  return { children, pos }
}

/** Strip internal temp properties from tree */
function cleanTree(node) {
  delete node._parentFen
  delete node._siblings
  node.children.forEach(cleanTree)
}

// ── Header extraction ─────────────────────────────────────────────────────────

function extractHeaders(rawGameText) {
  const headers = {}
  const re = /\[(\w+)\s+"([^"]*)"\]/g
  let m
  while ((m = re.exec(rawGameText)) !== null) headers[m[1]] = m[2]
  return headers
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a multi-game PGN and return structured game metadata + trees.
 * Each item: { chapterName, studyName, opening, eco, root }
 * Falls back gracefully for single-game PGNs without headers.
 */
export function parsePgnGames(pgnText) {
  // Split raw text into per-game segments on [Event ...] tag boundaries
  const gameTexts = pgnText.split(/(?=\[Event\s+")/).filter(s => s.trim())

  const result = []
  for (const gameText of gameTexts) {
    const trees = parsePgnToTrees(gameText)
    if (!trees.length) continue
    const h = extractHeaders(gameText)
    result.push({
      chapterName: h.ChapterName || h.Event || '',
      studyName:   h.StudyName  || '',
      opening:     h.Opening    || '',
      eco:         h.ECO        || '',
      root:        trees[0],
    })
  }
  // Fallback: no [Event] tags — treat whole text as one unnamed game
  if (!result.length) {
    const trees = parsePgnToTrees(pgnText)
    if (trees.length) result.push({ chapterName: '', studyName: '', opening: '', eco: '', root: trees[0] })
  }
  return result
}

/**
 * Parse a PGN string (single or multi-game) and return an array of root nodes.
 * Each root has the standard repertoire TreeNode shape with children populated.
 */
export function parsePgnToTrees(pgnText, fromFen = null) {
  const startFen = fromFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  // Split into individual games on result tokens
  const games = []
  const tokens = tokenize(pgnText)
  let start = 0
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'result') {
      games.push(tokens.slice(start, i + 1))
      start = i + 1
    }
  }
  if (start < tokens.length) games.push(tokens.slice(start))

  return games
    .filter(g => g.some(t => t.type === 'move'))
    .map(gameToks => {
      const chess = new Chess()
      if (fromFen) chess.load(fromFen)
      const root = makeRoot(startFen)
      const { children } = parseVariation(gameToks, 0, chess)
      root.children = children
      cleanTree(root)
      return root
    })
}

/**
 * Parse a single PGN and return one root node (first game only).
 */
export function parsePgnToTree(pgnText, fromFen = null) {
  const trees = parsePgnToTrees(pgnText, fromFen)
  return trees[0] ?? makeRoot(fromFen ?? undefined)
}

/**
 * Serialize a repertoire tree back to a PGN string with variations.
 * The root node has no san (it's the starting position).
 * Annotations are written as { comment } blocks.
 */
export function treeToPgn(root, repName = '') {
  const headers = [
    `[Event "${repName}"]`,
    '[Site "FireChess"]',
    `[Date "${new Date().toISOString().slice(0, 10)}"]`,
    '[White "?"]',
    '[Black "?"]',
    '[Result "*"]',
  ].join('\n')

  // chess.js instance to track move numbers
  const chess = new Chess(root.fen ?? undefined)
  const startFen = root.fen

  function moveNumber(fen) {
    // fullmove number from FEN field 6, and side to move from field 2
    const parts = fen.split(' ')
    const num = parseInt(parts[5])
    const side = parts[1]
    return { num, side }
  }

  function serializeChildren(children, parentFen, firstMove) {
    if (!children?.length) return ''
    const [main, ...variants] = children
    let out = ''

    // Main line move
    const { num, side } = moveNumber(parentFen)
    if (firstMove || side === 'w') out += `${num}${side === 'w' ? '.' : '...'} `
    out += main.san
    if (main.annotation) out += ` { ${main.annotation.replace(/[{}]/g, '')} } `

    // Variations (siblings)
    for (const v of variants) {
      const { num: vn, side: vs } = moveNumber(parentFen)
      let vout = `( ${vn}${vs === 'w' ? '.' : '...'} ${v.san}`
      if (v.annotation) vout += ` { ${v.annotation.replace(/[{}]/g, '')} } `
      vout += serializeChildren(v.children, v.fen, false)
      vout += ') '
      out += ' ' + vout
    }

    // Continue main line
    out += serializeChildren(main.children, main.fen, false)
    return out
  }

  const moves = serializeChildren(root.children, startFen, true).trim()
  return `${headers}\n\n${moves} *`
}
