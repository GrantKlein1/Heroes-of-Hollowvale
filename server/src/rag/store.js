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
      .sort((a, b) => b.score - a.score)
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
      .sort((a, b) => b.score - a.score)
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
async function retrieveLoreWithShadow(query, { candidateK = 10, topK = 3 } = {}) {
  const candidates = await retrieveCandidates(query, candidateK)
  const maxCos = candidates.length > 0 ? Number((candidates[0].cosScore ?? candidates[0].score ?? 0).toFixed(4)) : 0

  let shadowReranked = []
  let rerankTopScore = null
  let rerankScores = []

  if (candidates.length > 0) {
    try {
      shadowReranked = await rerank(query, candidates, topK)
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

export { retrieveCandidates, retrieveLoreForQuery, retrieveLoreWithShadow, loadLore }
