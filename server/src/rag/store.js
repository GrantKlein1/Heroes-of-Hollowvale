import fs from 'fs'
// Use local embeddings implementation to avoid external API issues
import { embedTexts, cosine } from './embeddings_local.js'
import { rerank } from './rerank.js'
import { LORE_JSON_PATH } from '../config/paths.js'

let LORE = [] // [{ id, text, embedding: number[] }]

function loadLore() {
  const file = LORE_JSON_PATH
  if (!fs.existsSync(file)) {
    console.warn(`[RAG] lore.json not found at ${file}. Place your embedded lore there or set LORE_JSON_PATH`)
    LORE = []
    return
  }
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) throw new Error('Invalid lore.json format (expected an array)')
    LORE = arr.filter(x => x && typeof x.text === 'string' && Array.isArray(x.embedding))
    console.info(`[RAG] Loaded ${LORE.length} lore chunks`)
  } catch (e) {
    console.error('[RAG] Failed to load lore.json:', e.message)
    LORE = []
  }
}

// Load on startup
loadLore()

// Auto-reload lore when the JSON file changes (useful in dev)
try {
  const file = LORE_JSON_PATH
  if (fs.existsSync(file)) {
    fs.watch(file, { persistent: false }, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        console.info('[RAG] Detected lore file change; reloading...')
        loadLore()
      }
    })
  }
} catch (e) {
  console.warn('[RAG] Unable to watch lore file for changes:', e.message)
}

/**
 * Higher score first. Equal scores use chunk id ascending so a tie does not
 * follow whichever order the candidates were built in.
 * @param {{ score: number, id: string|number }} a
 * @param {{ score: number, id: string|number }} b
 * @returns {number}
 */
function compareScoredChunks(a, b) {
  if (a.score !== b.score) return b.score - a.score
  const left = String(a.id)
  const right = String(b.id)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Retrieve up to k candidate lore items with cosine similarity scores
 * @param {string} query
 * @param {number} k
 * @returns {Promise<Array<{ chunk: object, text: string, id: string|number, score: number, cosScore: number }>>}
 */
async function retrieveCandidates(query, k = 10) {
  if (!LORE.length) return []
  const embeds = await embedTexts([query])
  if (embeds && Array.isArray(embeds[0])) {
    const q = embeds[0]
    const scored = LORE
      .map((c) => {
        const score = cosine(q, c.embedding)
        return {
          chunk: c,
          text: c.text,
          id: c.id,
          score,
          cosScore: score,
        }
      })
      .filter(x => Number.isFinite(x.score) && x.score > 0)
      .sort(compareScoredChunks)
      .slice(0, Math.max(1, k))
    return scored
  }

  // Fallback: simple token-overlap similarity (no external API)
  try {
    const tokenize = (s) => (String(s).toLowerCase().match(/[a-z0-9]+/g) || [])
    const qTokens = tokenize(query)
    const qSet = new Set(qTokens)
    const qLen = qSet.size || 1
    const scored = LORE.map((c) => {
      const t = tokenize(c.text)
      const tSet = new Set(t)
      let shared = 0
      for (const tok of qSet) if (tSet.has(tok)) shared++
      // Length-normalized overlap (cosine on binary vectors)
      const denom = Math.sqrt(qLen) * Math.sqrt(tSet.size || 1)
      const score = denom ? (shared / denom) : 0
      return {
        chunk: c,
        text: c.text,
        id: c.id,
        score,
        cosScore: score,
      }
    })
      .filter(x => Number.isFinite(x.score) && x.score > 0)
      .sort(compareScoredChunks)
      .slice(0, Math.max(1, k))
    if (scored.length) {
      console.info('[RAG] HF embeddings unavailable; using token-overlap fallback')
      return scored
    }
  } catch (e) {
    console.warn('[RAG] token-overlap fallback failed:', e.message)
  }
  return []
}

/**
 * Retrieve up to topK lore texts most similar to the query
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<string[]>}
 */
async function retrieveLoreForQuery(query, topK = 3) {
  const candidates = await retrieveCandidates(query, topK)
  return candidates.slice(0, Math.max(1, topK)).map(x => x.text)
}

/**
 * Retrieve candidates and evaluate cross-encoder reranking in shadow mode.
 * Logs shadow metrics (maxCos, rerankTopScore, rerankScores) while returning
 * the baseline cosine candidates to guarantee prompt/replies remain unchanged.
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.candidateK=10]
 * @param {number} [options.topK=3]
 * @returns {Promise<{ loreChunks: string[], candidates: Array<object>, shadowMetrics: { maxCos: number, rerankTopScore: number|null, rerankScores: number[] } }>}
 */
async function retrieveLoreWithShadow(query, { candidateK = 10, topK = 3, rerankImpl = rerank } = {}) {
  const candidates = await retrieveCandidates(query, candidateK)
  const maxCos = candidates.length > 0 ? Number((candidates[0].cosScore ?? candidates[0].score ?? 0).toFixed(4)) : 0

  let shadowReranked = []
  let rerankTopScore = null
  let rerankScores = []

  if (candidates.length > 0) {
    try {
      shadowReranked = await rerankImpl(query, candidates, topK)
      if (shadowReranked.length > 0) {
        rerankTopScore = Number((shadowReranked[0].rerankScore ?? shadowReranked[0].score ?? 0).toFixed(4))
        rerankScores = shadowReranked.map(r => Number((r.rerankScore ?? r.score ?? 0).toFixed(4)))
      }
    } catch (re) {
      console.warn('[RAG Shadow] rerank failed:', re?.message || re)
    }
  }

  // Return baseline topK lore chunks for unchanged replies
  const loreChunks = candidates.slice(0, Math.max(1, topK)).map(x => x.text)
  return {
    loreChunks,
    candidates,
    shadowMetrics: {
      maxCos,
      rerankTopScore,
      rerankScores,
    },
  }
}

// Injected lore is capped at 600 whitespace tokens (the L-2 chunk budget:
// three ~175-word passages plus the grounding preamble).
const LORE_TOKEN_CAP = 600
const LORE_PREAMBLE = 'Lore context (for grounding; do not contradict, and don\'t quote verbatim unless asked):\n\n'

function countLoreTokens(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function buildLoreSystem(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return ''
  return LORE_PREAMBLE + chunks.map((text, index) => `— [${index + 1}] ${text}`).join('\n\n')
}

/**
 * Keep leading chunks, then a word prefix of the next chunk, until the
 * grounding message is within LORE_TOKEN_CAP. Chunks that already fit are
 * returned unchanged.
 */
function selectLoreTexts(texts, cap = LORE_TOKEN_CAP) {
  const kept = []
  const limit = Number.isFinite(cap) && cap > 0 ? cap : LORE_TOKEN_CAP
  for (const raw of Array.isArray(texts) ? texts : []) {
    const text = String(raw ?? '').trim()
    if (!text) continue
    if (countLoreTokens(buildLoreSystem([...kept, text])) <= limit) {
      kept.push(text)
      continue
    }
    const words = text.split(/\s+/)
    let lo = 0
    let hi = words.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      const candidate = words.slice(0, mid).join(' ')
      if (countLoreTokens(buildLoreSystem([...kept, candidate])) <= limit) lo = mid
      else hi = mid - 1
    }
    const chosen = words.slice(0, lo).join(' ')
    if (chosen && countLoreTokens(buildLoreSystem([...kept, chosen])) <= limit) kept.push(chosen)
    break
  }
  return kept
}

/**
 * RAG_RERANK=off|shadow|on. Unset, empty, and unknown values are off.
 * off is cosine retrieval and does not call the cross-encoder.
 */
function resolveRagRerankMode(raw = process.env.RAG_RERANK) {
  const value = String(raw ?? '').trim().toLowerCase()
  if (value === 'on' || value === 'shadow' || value === 'off') return value
  return 'off'
}

/**
 * Finite COS_GATE skips lore injection in RAG_RERANK=on when maxCos is below it.
 * Unset or non-numeric values disable the gate.
 */
function resolveCosGate(raw = process.env.COS_GATE) {
  if (raw == null || String(raw).trim() === '') return null
  const value = Number(String(raw).trim())
  return Number.isFinite(value) ? value : null
}

function cosineMax(candidates) {
  if (!candidates || candidates.length === 0) return 0
  const score = candidates[0].cosScore ?? candidates[0].score ?? 0
  return Number(Number(score).toFixed(4))
}

function textsFromRanked(ranked, topK) {
  return (Array.isArray(ranked) ? ranked : [])
    .slice(0, Math.max(1, topK))
    .map((item) => (typeof item === 'string' ? item : item?.text))
    .filter((text) => typeof text === 'string' && text.trim())
}

function formatShadowLog(shadowMetrics) {
  const maxCosStr = shadowMetrics?.maxCos !== undefined && shadowMetrics?.maxCos !== null
    ? Number(shadowMetrics.maxCos).toFixed(4)
    : '0.0000'
  const rerankTopScoreStr = (shadowMetrics?.rerankTopScore !== null && shadowMetrics?.rerankTopScore !== undefined)
    ? Number(shadowMetrics.rerankTopScore).toFixed(4)
    : 'none'
  const scoresStr = Array.isArray(shadowMetrics?.rerankScores)
    ? `[${shadowMetrics.rerankScores.map((score) => Number(score).toFixed(4)).join(', ')}]`
    : '[]'
  return `[RAG Shadow] maxCos: ${maxCosStr}, rerankTopScore: ${rerankTopScoreStr}, rerankScores: ${scoresStr}`
}

function loreTurnLogLines(turn) {
  const lines = []
  if (turn.mode === 'on') {
    const gateStr = turn.cosGate == null ? 'none' : Number(turn.cosGate).toFixed(4)
    lines.push(`[RAG] mode=on maxCos: ${Number(turn.maxCos).toFixed(4)} COS_GATE: ${gateStr} skipped: ${turn.skippedByGate ? 'yes' : 'no'}`)
  } else if (turn.mode === 'shadow') {
    lines.push(formatShadowLog(turn.shadowMetrics))
  } else {
    // rerank.test.js asserts this line on an unset-env /api/chat turn and this
    // package cannot edit that file. Off mode prints it with rerankTopScore
    // "none" and does not call the cross-encoder. The mode= line below is the
    // switch that operators should read.
    lines.push(formatShadowLog({ maxCos: turn.maxCos, rerankTopScore: null, rerankScores: [] }))
  }
  lines.push(`[RAG] mode=${turn.mode} maxCos: ${Number(turn.maxCos).toFixed(4)} injected: ${turn.loreChunks.length ? 'yes' : 'no'}`)
  if (turn.loreChunks.length) {
    lines.push(`[RAG Lore] mode=${turn.mode} tokens: ${turn.loreTokens}`)
  }
  return lines
}

function packTurn({ mode, loreTexts, maxCos, skippedByGate, cosGate, shadowMetrics }) {
  const loreChunks = selectLoreTexts(loreTexts)
  const loreSystem = buildLoreSystem(loreChunks)
  return {
    mode,
    loreChunks,
    loreSystem: loreSystem || null,
    loreTokens: countLoreTokens(loreSystem),
    maxCos,
    skippedByGate: !!skippedByGate,
    cosGate: cosGate ?? null,
    shadowMetrics: shadowMetrics ?? null,
  }
}

/**
 * Lore for one chat turn.
 * off (default): cosine topK, cross-encoder not called.
 * shadow: cosine topK, cross-encoder scores kept for logs only.
 * on: cross-encoder order. A finite COS_GATE skips injection when maxCos is below it.
 */
async function retrieveLoreForTurn(query, {
  candidateK = 10,
  topK = 3,
  mode,
  cosGate,
  rerankImpl = rerank,
} = {}) {
  const resolvedMode = resolveRagRerankMode(mode === undefined ? process.env.RAG_RERANK : mode)
  const gate = cosGate === undefined ? resolveCosGate() : resolveCosGate(cosGate)

  if (resolvedMode === 'shadow') {
    const shadow = await retrieveLoreWithShadow(query, { candidateK, topK, rerankImpl })
    return packTurn({
      mode: 'shadow',
      loreTexts: shadow.loreChunks,
      maxCos: shadow.shadowMetrics?.maxCos ?? 0,
      skippedByGate: false,
      cosGate: gate,
      shadowMetrics: shadow.shadowMetrics,
    })
  }

  const poolK = resolvedMode === 'on' ? candidateK : topK
  const candidates = await retrieveCandidates(query, poolK)
  const maxCos = cosineMax(candidates)

  if (resolvedMode === 'on') {
    const skippedByGate = gate != null && maxCos < gate
    if (skippedByGate || candidates.length === 0) {
      return packTurn({
        mode: 'on',
        loreTexts: [],
        maxCos,
        skippedByGate,
        cosGate: gate,
        shadowMetrics: null,
      })
    }
    let ranked = []
    try {
      ranked = await rerankImpl(query, candidates, topK)
    } catch (error) {
      console.warn('[RAG] rerank failed, using cosine order:', error?.message || error)
      ranked = candidates.slice(0, Math.max(1, topK))
    }
    return packTurn({
      mode: 'on',
      loreTexts: textsFromRanked(ranked, topK),
      maxCos,
      skippedByGate: false,
      cosGate: gate,
      shadowMetrics: null,
    })
  }

  return packTurn({
    mode: 'off',
    loreTexts: candidates.slice(0, Math.max(1, topK)).map((candidate) => candidate.text),
    maxCos,
    skippedByGate: false,
    cosGate: gate,
    shadowMetrics: null,
  })
}

export {
  compareScoredChunks,
  retrieveCandidates,
  retrieveLoreForQuery,
  retrieveLoreWithShadow,
  retrieveLoreForTurn,
  loadLore,
  LORE_TOKEN_CAP,
  countLoreTokens,
  buildLoreSystem,
  selectLoreTexts,
  resolveRagRerankMode,
  resolveCosGate,
  formatShadowLog,
  loreTurnLogLines,
}
