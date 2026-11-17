#!/usr/bin/env node
/**
 * Offline-safe lore retrieval eval for package L-4.
 *
 * Prints recall@3 for cosine-only retrieval and, when the cross-encoder loads,
 * for reranked retrieval. recall@3 is the macro average of
 * |top 3 ids ∩ gold ids| / |gold ids|. hit@3 is the fraction of questions
 * with at least one gold id in the top 3 (equal to recall@3 when each
 * question has one gold chunk).
 *
 * Also prints mean maxCos for questions whose cosine top hit is a gold chunk
 * versus questions whose cosine top hit is not, and a suggested COS_GATE.
 * The gate is the highest threshold that still keeps at least 90% of the
 * correct top-hit scores, preferring the threshold that drops the most
 * wrong top hits. RAG_RERANK=on skips lore injection when maxCos is below
 * COS_GATE. The flag defaults to off; this script only recommends a value.
 *
 * Exit 0 when the cross-encoder loads and both recalls are printed.
 * Exit 2 when the cross-encoder cannot load: cosine numbers are still printed.
 * Exit 1 when the eval set or lore retrieval itself fails.
 *
 *   node server/eval/run.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { retrieveCandidates } from '../src/rag/store.js'
import { embedTexts } from '../src/rag/embeddings_local.js'
import { rerank, warmupReranker } from '../src/rag/rerank.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EVAL_PATH = path.join(__dirname, 'lore_eval.json')
const TOP_K = 3
const CANDIDATE_K = 10
const WARMUP_MS = 120_000

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round4(value) {
  return Number(Number(value).toFixed(4))
}

function formatMean(value) {
  return value == null ? 'n/a' : value.toFixed(4)
}

function recallAtK(runs, idsFor) {
  let macro = 0
  let hits = 0
  for (const run of runs) {
    const gold = new Set(run.relevant)
    const retrieved = idsFor(run).slice(0, TOP_K)
    let found = 0
    for (const id of retrieved) {
      if (gold.has(id)) found += 1
    }
    macro += gold.size ? found / gold.size : 0
    if (found > 0) hits += 1
  }
  return {
    macro: runs.length ? macro / runs.length : 0,
    hits,
    total: runs.length,
  }
}

function formatRecall(label, stats) {
  const pct = (stats.macro * 100).toFixed(1)
  const hitPct = stats.total ? ((stats.hits / stats.total) * 100).toFixed(1) : '0.0'
  return [
    `${label} recall@3: ${stats.macro.toFixed(4)} (${pct}%)`,
    `${label} hit@3: ${stats.hits}/${stats.total} (${hitPct}%)`,
  ].join('\n')
}

/**
 * Highest cosine threshold that keeps >= 90% of correct top-1 scores and
 * drops as many wrong top-1 scores as possible.
 */
function suggestCosGate(correct, wrong) {
  const meanCorrect = mean(correct)
  const meanWrong = mean(wrong)
  if (!correct.length) {
    return {
      gate: null,
      meanCorrect,
      meanWrong,
      note: 'No cosine top hit matched a gold chunk, so no COS_GATE is recommended.',
    }
  }

  const minKept = Math.ceil(correct.length * 0.9)
  const thresholds = [...new Set([...correct, ...wrong, 0])].sort((a, b) => a - b)
  let best = null
  for (const threshold of thresholds) {
    const kept = correct.filter((score) => score + 1e-12 >= threshold).length
    if (kept < minKept) continue
    const droppedWrong = wrong.filter((score) => score < threshold).length
    const rank = [droppedWrong, threshold, kept]
    if (!best || compareRank(rank, best.rank) > 0) {
      best = { gate: threshold, kept, droppedWrong, rank }
    }
  }

  let note
  if (!best) {
    const sorted = [...correct].sort((a, b) => a - b)
    const p10 = sorted[Math.max(0, Math.ceil(sorted.length * 0.1) - 1)]
    best = { gate: p10, kept: correct.filter((score) => score + 1e-12 >= p10).length, droppedWrong: 0 }
    note = 'No threshold kept 90% of correct top hits. Using the 10th percentile of those scores.'
  } else {
    note = `Keeps ${best.kept}/${correct.length} correct top hits`
    note += wrong.length
      ? ` and drops ${best.droppedWrong}/${wrong.length} wrong top hits.`
      : '. Every cosine top hit was a gold chunk.'
  }

  if (meanWrong != null && meanWrong >= meanCorrect - 0.01) {
    note += ' Correct top hits do not clearly outscore wrong ones, so this gate will not cleanly skip bad retrievals.'
  }
  if (wrong.length > 0 && !best.droppedWrong) {
    note += ' Dropped 0 wrong top hits. Leave COS_GATE unset unless a later run separates the scores.'
  }

  return {
    gate: round4(best.gate),
    meanCorrect,
    meanWrong,
    note,
  }
}

function compareRank(left, right) {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  }
  return 0
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function loadEvalItems() {
  const raw = fs.readFileSync(EVAL_PATH, 'utf8')
  const items = JSON.parse(raw)
  if (!Array.isArray(items) || items.length < 40 || items.length > 60) {
    throw new Error(`lore_eval.json must contain 40-60 items, found ${Array.isArray(items) ? items.length : 'non-array'}`)
  }
  return items.map((item, index) => {
    const question = String(item?.question || '').trim()
    const relevant = Array.isArray(item?.relevant) ? item.relevant.map((id) => String(id)) : []
    if (!question || relevant.length === 0) {
      throw new Error(`Eval item ${item?.id || index} needs a question and at least one chunk id`)
    }
    return { id: String(item.id || `q${index + 1}`), question, relevant }
  })
}

function printMisses(runs, idsFor, label) {
  const misses = runs.filter((run) => {
    const gold = new Set(run.relevant)
    return !idsFor(run).slice(0, TOP_K).some((id) => gold.has(id))
  })
  if (!misses.length) {
    console.log(`${label} misses: none`)
    return
  }
  console.log(`${label} misses: ${misses.length} (showing up to 8)`)
  for (const run of misses.slice(0, 8)) {
    const top = idsFor(run).slice(0, TOP_K).join(', ') || '(none)'
    console.log(`  ${run.id} gold=${run.relevant.join('|')} top3=${top} maxCos=${run.maxCos.toFixed(4)}`)
  }
}

async function main() {
  const items = loadEvalItems()
  const probe = await embedTexts(['Hollowvale ley-line'])
  const embedder = probe && Array.isArray(probe[0]) ? 'Xenova/all-MiniLM-L6-v2' : 'token-overlap fallback'
  console.log(`Eval questions: ${items.length}`)
  console.log(`Query embedder: ${embedder}`)

  const runs = []
  for (const item of items) {
    const candidates = await retrieveCandidates(item.question, CANDIDATE_K)
    const topIds = candidates.slice(0, TOP_K).map((candidate) => String(candidate.id))
    const maxCos = candidates.length
      ? Number(candidates[0].cosScore ?? candidates[0].score ?? 0)
      : 0
    const topId = candidates.length ? String(candidates[0].id) : null
    runs.push({
      ...item,
      candidates,
      topIds,
      maxCos,
      topCorrect: topId != null && item.relevant.includes(topId),
    })
  }

  const cosineRecall = recallAtK(runs, (run) => run.topIds)
  const correctScores = runs.filter((run) => run.topCorrect).map((run) => run.maxCos)
  const wrongScores = runs.filter((run) => !run.topCorrect).map((run) => run.maxCos)
  const suggestion = suggestCosGate(correctScores, wrongScores)

  console.log(formatRecall('cosine', cosineRecall))
  console.log(`mean maxCos correct top hit: ${formatMean(suggestion.meanCorrect)} (n=${correctScores.length})`)
  console.log(`mean maxCos wrong top hit: ${formatMean(suggestion.meanWrong)} (n=${wrongScores.length})`)
  console.log(`suggested COS_GATE: ${suggestion.gate == null ? 'none' : suggestion.gate.toFixed(4)}`)
  console.log(`COS_GATE note: ${suggestion.note}`)
  printMisses(runs, (run) => run.topIds, 'cosine')

  let modelReady = false
  let modelError = null
  try {
    modelReady = await withTimeout(warmupReranker(), WARMUP_MS, 'cross-encoder warmup')
    if (!modelReady) modelError = 'warmupReranker returned false'
  } catch (error) {
    modelReady = false
    modelError = error?.message || String(error)
  }

  if (!modelReady) {
    console.log('')
    console.log('Cross-encoder unavailable (Xenova/ms-marco-MiniLM-L-6-v2 did not load).')
    console.log(`Reason: ${modelError || 'unknown'}`)
    console.log('Rerank recall@3 was not computed. Cosine-only numbers are printed above.')
    console.log('Leave RAG_RERANK off until this eval is run where the model can load.')
    process.exit(2)
  }

  for (const run of runs) {
    const ranked = await rerank(run.question, run.candidates, TOP_K)
    run.rerankIds = ranked.map((candidate) => String(candidate.id))
  }
  const rerankRecall = recallAtK(runs, (run) => run.rerankIds || [])
  console.log(formatRecall('rerank', rerankRecall))
  printMisses(runs, (run) => run.rerankIds || [], 'rerank')

  if (rerankRecall.macro > cosineRecall.macro) {
    console.log('recommendation: rerank recall@3 beats cosine. Grant can consider RAG_RERANK=on with the suggested COS_GATE. The flag still defaults to off.')
  } else if (rerankRecall.macro < cosineRecall.macro) {
    console.log('recommendation: keep RAG_RERANK off. Rerank recall@3 does not beat cosine.')
  } else {
    console.log('recommendation: keep RAG_RERANK off. Rerank recall@3 ties cosine.')
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(`[lore-eval] ${error?.message || error}`)
  process.exit(1)
})
