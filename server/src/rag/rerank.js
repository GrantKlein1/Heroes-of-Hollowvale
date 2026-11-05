// Local cross-encoder reranking via Transformers.js (offline; no external API calls)
// Uses Xenova/ms-marco-MiniLM-L-6-v2 for sequence classification scoring of query-passage pairs.

let modelPromise = null;

async function getCrossEncoder() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@xenova/transformers');
      const modelName = 'Xenova/ms-marco-MiniLM-L-6-v2';
      const tokenizer = await AutoTokenizer.from_pretrained(modelName);
      const model = await AutoModelForSequenceClassification.from_pretrained(modelName, { quantized: true });
      return { tokenizer, model };
    })();
  }
  return modelPromise;
}

/**
 * Pre-warm the cross-encoder model into memory
 * @returns {Promise<boolean>}
 */
export async function warmupReranker() {
  try {
    await getCrossEncoder();
    return true;
  } catch (err) {
    console.warn('[RAG Rerank] Failed to warmup cross-encoder:', err?.message || err);
    return false;
  }
}

/**
 * Extract text from a candidate representation
 * @param {string|object} candidate
 * @returns {string}
 */
function extractCandidateText(candidate) {
  if (typeof candidate === 'string') return candidate;
  if (!candidate || typeof candidate !== 'object') return String(candidate ?? '');
  if (typeof candidate.text === 'string') return candidate.text;
  if (typeof candidate.chunk?.text === 'string') return candidate.chunk.text;
  return String(candidate.content || candidate.passage || '');
}

/**
 * Rerank an array of candidate chunks or strings for a given query
 * @param {string} query - The query to score candidates against
 * @param {Array<string|object>} candidates - Array of candidate texts or candidate objects
 * @param {number} [topK] - Max number of reranked candidates to return
 * @returns {Promise<Array<object>>} Scored and sorted candidates (descending by rerankScore)
 */
export async function rerank(query, candidates = [], topK) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const queryStr = typeof query === 'string' ? query.trim() : String(query || '').trim();
  if (!queryStr) {
    return candidates.map(c => {
      if (typeof c === 'string') {
        const item = { text: c, score: 0, rerankScore: 0 };
        item.toString = () => c;
        item.valueOf = () => c;
        return item;
      }
      return { ...c, rerankScore: 0 };
    });
  }

  try {
    const { tokenizer, model } = await getCrossEncoder();
    const texts = candidates.map(extractCandidateText);
    const queries = texts.map(() => queryStr);

    const inputs = await tokenizer(queries, {
      text_pair: texts,
      padding: true,
      truncation: true,
    });

    const output = await model(inputs);
    const logits = output?.logits?.data;

    const scored = candidates.map((cand, idx) => {
      const rawScore = logits && Number.isFinite(logits[idx]) ? Number(logits[idx]) : 0;
      if (typeof cand === 'string') {
        const item = {
          text: cand,
          score: rawScore,
          rerankScore: rawScore,
        };
        item.toString = () => cand;
        item.valueOf = () => cand;
        return item;
      }

      return {
        ...cand,
        text: extractCandidateText(cand),
        cosScore: cand.cosScore ?? cand.score,
        rerankScore: rawScore,
        score: rawScore,
      };
    });

    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    const limit = typeof topK === 'number' && topK > 0 ? topK : scored.length;
    return scored.slice(0, limit);
  } catch (err) {
    console.warn('[RAG Rerank] Scoring error, falling back to original order:', err?.message || err);
    const fallback = candidates.map((c) => {
      if (typeof c === 'string') {
        const item = { text: c, score: 0, rerankScore: 0 };
        item.toString = () => c;
        item.valueOf = () => c;
        return item;
      }
      return { ...c, rerankScore: 0 };
    });
    const limit = typeof topK === 'number' && topK > 0 ? topK : fallback.length;
    return fallback.slice(0, limit);
  }
}
