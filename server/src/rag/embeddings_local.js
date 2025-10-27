// Local embeddings via Transformers.js (offline; no external API calls)
// Uses Xenova's port of MiniLM-L6-v2, compatible in dimension (384) with sentence-transformers.

let embedderPromise = null

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers')
      // Quantized model for faster download/startup. Cached after first run.
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
    })()
  }
  return embedderPromise
}

/**
 * Embed one or more texts locally using Transformers.js
 * Returns an array of vectors (one per input string) or null on failure.
 * @param {string[]|string} texts
 * @returns {Promise<number[][]|null>}
 */
async function embedTexts(texts = []) {
  const inputs = Array.isArray(texts) ? texts : [texts]
  if (!inputs.length) return null
  try {
    const fe = await getEmbedder()
    // Mean pooling, no normalization (to stay comparable with existing lore vectors)
    const out = await fe(inputs, { pooling: 'mean', normalize: false })

    // Tensor form
    if (out && out.data && out.dims) {
      const data = out.data
      const dims = out.dims
      if (dims.length === 1) return [Array.from(data)]
      if (dims.length === 2) {
        const [b, d] = dims
        const res = []
        for (let i = 0; i < b; i++) res.push(Array.from(data.slice(i * d, (i + 1) * d)))
        return res
      }
    }
    // Array form
    if (Array.isArray(out) && out.length) {
      if (typeof out[0] === 'number') return [out]
      if (Array.isArray(out[0]) && typeof out[0][0] === 'number') return out
    }
    return null
  } catch (e) {
    console.warn('[RAG] Local embeddings failed:', e?.message || e)
    return null
  }
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] || 0, y = b[i] || 0
    dot += x * y; na += x * x; nb += y * y
  }
  if (!na || !nb) return -1
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

module.exports = { embedTexts, cosine }