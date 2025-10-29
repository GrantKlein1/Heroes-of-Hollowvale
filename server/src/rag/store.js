const fs = require('fs')
// Use local embeddings implementation to avoid external API issues
const { embedTexts, cosine } = require('./embeddings_local')
const { LORE_JSON_PATH } = require('../config/paths')

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
 * Retrieve up to topK lore texts most similar to the query
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<string[]>}
 */
async function retrieveLoreForQuery(query, topK = 3) {
  if (!LORE.length) return []
  const embeds = await embedTexts([query])
  if (embeds && Array.isArray(embeds[0])) {
    const q = embeds[0]
    const scored = LORE
      .map((c) => ({ chunk: c, score: cosine(q, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK))
      .filter(x => Number.isFinite(x.score) && x.score > 0)
    return scored.map(x => x.chunk.text)
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
      return { chunk: c, score }
    })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, topK))
      .filter(x => Number.isFinite(x.score) && x.score > 0)
    if (scored.length) {
      console.info('[RAG] HF embeddings unavailable; using token-overlap fallback')
      return scored.map(x => x.chunk.text)
    }
  } catch (e) {
    console.warn('[RAG] token-overlap fallback failed:', e.message)
  }
  return []
}

module.exports = { retrieveLoreForQuery, loadLore }
