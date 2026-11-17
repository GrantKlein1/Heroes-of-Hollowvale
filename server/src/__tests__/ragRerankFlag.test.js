import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  LORE_TOKEN_CAP,
  buildLoreSystem,
  countLoreTokens,
  loreTurnLogLines,
  resolveCosGate,
  resolveRagRerankMode,
  retrieveCandidates,
  retrieveLoreForQuery,
  retrieveLoreForTurn,
  selectLoreTexts,
} from '../rag/store.js'
import { LORE_JSON_PATH } from '../config/paths.js'
import { resetMemoryStore } from '../memory.js'
import { resetActiveTurns } from '../routes/chatStream.js'
import { resetTurns } from '../tts/turnAudio.js'

const saved = {}

function rememberEnv(name) {
  saved[name] = process.env[name]
  delete process.env[name]
}

function restoreEnv(name) {
  if (saved[name] === undefined) delete process.env[name]
  else process.env[name] = saved[name]
}

beforeEach(() => {
  rememberEnv('RAG_RERANK')
  rememberEnv('COS_GATE')
  resetMemoryStore()
  resetActiveTurns()
  resetTurns()
})

afterEach(() => {
  restoreEnv('RAG_RERANK')
  restoreEnv('COS_GATE')
})

function reverseRerank() {
  const calls = []
  const impl = async (_query, candidates, topK) => {
    calls.push(candidates.length)
    const flipped = [...candidates].reverse().map((candidate, index) => ({
      ...candidate,
      text: candidate.text,
      rerankScore: candidates.length - index,
    }))
    const limit = typeof topK === 'number' && topK > 0 ? topK : flipped.length
    return flipped.slice(0, limit)
  }
  return { impl, calls }
}

describe('RAG_RERANK flag', { concurrency: false }, () => {
  test('unset, empty, and unknown RAG_RERANK resolve to off', () => {
    assert.equal(resolveRagRerankMode(undefined), 'off')
    assert.equal(resolveRagRerankMode(''), 'off')
    assert.equal(resolveRagRerankMode('nope'), 'off')
    assert.equal(resolveRagRerankMode('OFF'), 'off')
    assert.equal(resolveRagRerankMode('Shadow'), 'shadow')
    assert.equal(resolveRagRerankMode('ON'), 'on')
    assert.equal(resolveCosGate(undefined), null)
    assert.equal(resolveCosGate(''), null)
    assert.equal(resolveCosGate('not-a-number'), null)
    assert.equal(resolveCosGate('0.25'), 0.25)
  })

  test('unset RAG_RERANK matches cosine retrieval and does not call the reranker', async () => {
    const query = 'Who is Vaelra the Kindled?'
    const { impl, calls } = reverseRerank()
    const cosine = await retrieveLoreForQuery(query, 3)
    const turn = await retrieveLoreForTurn(query, { rerankImpl: impl })

    assert.equal(process.env.RAG_RERANK, undefined)
    assert.equal(turn.mode, 'off')
    assert.equal(calls.length, 0)
    assert.deepEqual(turn.loreChunks, cosine)
    assert.equal(turn.skippedByGate, false)
    assert.ok(turn.loreTokens <= LORE_TOKEN_CAP)
    const lines = loreTurnLogLines(turn).join('\n')
    assert.match(lines, /\[RAG Shadow\] maxCos: \d+\.\d{4}, rerankTopScore: none, rerankScores: \[\]/)
    assert.match(lines, /\[RAG\] mode=off /)
  })

  test('RAG_RERANK=off is the same cosine path as unset', async () => {
    const query = 'Where is the Cavern of Embers?'
    const { impl, calls } = reverseRerank()
    const unset = await retrieveLoreForTurn(query, { rerankImpl: impl })
    const off = await retrieveLoreForTurn(query, { mode: 'off', rerankImpl: impl, cosGate: 0.99 })

    assert.equal(calls.length, 0)
    assert.equal(off.mode, 'off')
    assert.equal(off.skippedByGate, false)
    assert.deepEqual(off.loreChunks, unset.loreChunks)
    assert.deepEqual(off.loreChunks, await retrieveLoreForQuery(query, 3))
  })

  test('RAG_RERANK=shadow logs rerank scores and still returns cosine chunks', async () => {
    const query = 'Sword of Aeltharion'
    const { impl, calls } = reverseRerank()
    const cosine = await retrieveLoreForQuery(query, 3)
    const turn = await retrieveLoreForTurn(query, { mode: 'shadow', rerankImpl: impl })

    assert.equal(calls.length, 1)
    assert.equal(turn.mode, 'shadow')
    assert.deepEqual(turn.loreChunks, cosine)
    assert.ok(Array.isArray(turn.shadowMetrics.rerankScores))
    assert.equal(turn.shadowMetrics.rerankScores.length, turn.loreChunks.length)
    const lines = loreTurnLogLines(turn).join('\n')
    assert.match(lines, /\[RAG Shadow\] maxCos: /)
    assert.match(lines, /rerankTopScore: /)
    assert.match(lines, /rerankScores: \[/)
    assert.doesNotMatch(lines, /rerankTopScore: none/)
    assert.match(lines, /\[RAG\] mode=shadow /)
  })

  test('RAG_RERANK=on uses reranker order and COS_GATE skips lore below maxCos', async () => {
    const query = 'dragons of the Sky Pyre'
    const { impl, calls } = reverseRerank()
    const cosine = await retrieveLoreForQuery(query, 3)
    const candidates = await retrieveCandidates(query, 10)
    assert.ok(candidates.length >= 2, 'expected at least two lore candidates')

    const on = await retrieveLoreForTurn(query, { mode: 'on', rerankImpl: impl, cosGate: null })
    assert.equal(on.mode, 'on')
    assert.equal(on.skippedByGate, false)
    assert.equal(calls.length, 1)
    assert.equal(on.loreChunks[0], candidates[candidates.length - 1].text)
    assert.notDeepEqual(on.loreChunks, cosine)
    assert.ok(on.loreTokens <= LORE_TOKEN_CAP)
    assert.match(loreTurnLogLines(on).join('\n'), /\[RAG\] mode=on maxCos: .+ COS_GATE: none skipped: no/)

    const skipped = await retrieveLoreForTurn(query, {
      mode: 'on',
      rerankImpl: impl,
      cosGate: on.maxCos + 0.0001,
    })
    assert.equal(skipped.skippedByGate, true)
    assert.deepEqual(skipped.loreChunks, [])
    assert.equal(skipped.loreTokens, 0)
    assert.equal(calls.length, 1, 'gate skip happens before the cross-encoder')
    assert.match(loreTurnLogLines(skipped).join('\n'), /skipped: yes/)
    assert.doesNotMatch(loreTurnLogLines(skipped).join('\n'), /\[RAG Lore\]/)

    const atGate = await retrieveLoreForTurn(query, {
      mode: 'on',
      rerankImpl: impl,
      cosGate: on.maxCos,
    })
    assert.equal(atGate.skippedByGate, false)
    assert.equal(calls.length, 2)

    process.env.RAG_RERANK = 'on'
    process.env.COS_GATE = 'nope'
    const invalidGate = await retrieveLoreForTurn(query, { rerankImpl: impl })
    assert.equal(invalidGate.mode, 'on')
    assert.equal(invalidGate.cosGate, null)
    assert.equal(invalidGate.skippedByGate, false)
  })

  test('unknown RAG_RERANK values stay on the cosine path', async () => {
    const { impl, calls } = reverseRerank()
    const turn = await retrieveLoreForTurn('Brackenford', { mode: 'sometimes', rerankImpl: impl })
    assert.equal(turn.mode, 'off')
    assert.equal(calls.length, 0)
    assert.deepEqual(turn.loreChunks, await retrieveLoreForQuery('Brackenford', 3))
  })
})

describe('lore token cap', { concurrency: false }, () => {
  test('the longest real chunks stay inside the 600 token cap without being trimmed', () => {
    const lore = JSON.parse(fs.readFileSync(LORE_JSON_PATH, 'utf8'))
    const longest = [...lore]
      .sort((a, b) => countLoreTokens(b.text) - countLoreTokens(a.text))
      .slice(0, 3)
      .map((chunk) => chunk.text)
    const selected = selectLoreTexts(longest)
    const content = buildLoreSystem(selected)
    assert.deepEqual(selected, longest)
    assert.ok(countLoreTokens(content) <= LORE_TOKEN_CAP)
    assert.ok(countLoreTokens(content) > 0)
  })

  test('an oversized passage is trimmed to the 600 token cap', () => {
    const huge = Array.from({ length: 4000 }, () => 'ember').join(' ')
    const selected = selectLoreTexts([huge, 'second chunk that must not appear'])
    const content = buildLoreSystem(selected)
    assert.equal(selected.length, 1)
    assert.ok(countLoreTokens(content) <= LORE_TOKEN_CAP)
    assert.ok(countLoreTokens(content) > LORE_TOKEN_CAP - 5)
    assert.equal(content.includes('second chunk'), false)
  })
})

function captureInfo(run) {
  const logs = []
  const original = console.info
  console.info = (...args) => {
    logs.push(args.join(' '))
  }
  return Promise.resolve()
    .then(run)
    .finally(() => {
      console.info = original
    })
    .then((result) => ({ result, logs }))
}

function postChat(router, body) {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/chat',
      body,
      headers: {},
    }
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        resolve({ status: this.statusCode, payload })
      },
    }
    router.handle(req, res, (err) => {
      if (err) reject(err)
    })
  })
}

function postStream(router, body) {
  const chunks = []
  return new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body,
      headers: {},
      on() {},
    }
    const res = {
      headersSent: false,
      writableEnded: false,
      setHeader() {},
      flushHeaders() {
        this.headersSent = true
      },
      write(chunk) {
        this.headersSent = true
        chunks.push(String(chunk))
      },
      end() {
        this.writableEnded = true
        resolve(chunks.join(''))
      },
      on() {},
    }
    router.handle(req, res, (err) => {
      if (err) reject(err)
    })
  })
}

describe('chat routes read RAG_RERANK', { concurrency: false }, () => {
  test('POST /api/chat unset and off keep the stub reply and do not score with the reranker', async () => {
    const { default: chatRouter } = await import('../routes/chat.js')
    const message = 'Where is the Cavern of Embers?'

    const unset = await captureInfo(() => postChat(chatRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-unset',
    }))
    assert.equal(unset.result.status, 200)
    assert.match(unset.result.payload.reply, /\[Stubbed reply from /)
    assert.match(unset.result.payload.reply, /Cavern of Embers/)
    const unsetLog = unset.logs.join('\n')
    assert.match(unsetLog, /\[RAG\] mode=off /)
    assert.match(unsetLog, /rerankTopScore: none/)
    assert.match(unsetLog, /\[RAG Lore\] mode=off tokens: (\d+)/)
    const unsetTokens = Number(unsetLog.match(/\[RAG Lore\] mode=off tokens: (\d+)/)[1])
    assert.ok(unsetTokens <= LORE_TOKEN_CAP)
    assert.ok(unsetTokens > 0)

    process.env.RAG_RERANK = 'off'
    const off = await captureInfo(() => postChat(chatRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-off',
    }))
    assert.equal(off.result.payload.reply, unset.result.payload.reply)
    assert.match(off.logs.join('\n'), /\[RAG\] mode=off /)
    assert.match(off.logs.join('\n'), /rerankTopScore: none/)
  })

  test('POST /api/chat shadow and on follow the flag', async () => {
    const { default: chatRouter } = await import('../routes/chat.js')
    const message = 'Who is Zhyranda the Gilded Maw?'

    process.env.RAG_RERANK = 'shadow'
    const shadow = await captureInfo(() => postChat(chatRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-shadow',
    }))
    assert.match(shadow.result.payload.reply, /\[Stubbed reply from /)
    const shadowLog = shadow.logs.join('\n')
    assert.match(shadowLog, /\[RAG\] mode=shadow /)
    assert.match(shadowLog, /\[RAG Shadow\] maxCos: /)
    assert.match(shadowLog, /rerankScores: \[/)
    assert.doesNotMatch(shadowLog, /rerankTopScore: none/)

    process.env.RAG_RERANK = 'on'
    process.env.COS_GATE = '2'
    const gated = await captureInfo(() => postChat(chatRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-on-gate',
    }))
    const gatedLog = gated.logs.join('\n')
    assert.match(gatedLog, /\[RAG\] mode=on /)
    assert.match(gatedLog, /COS_GATE: 2\.0000 skipped: yes/)
    assert.doesNotMatch(gatedLog, /\[RAG Lore\]/)
    assert.match(gated.result.payload.reply, /\[Stubbed reply from /)
  })

  test('POST /api/chat/stream uses the same flag', async () => {
    const { default: chatStreamRouter } = await import('../routes/chatStream.js')
    const message = 'Tell me about Brackenford.'

    const unset = await captureInfo(() => postStream(chatStreamRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-stream-off',
    }))
    assert.match(unset.result, /event: done/)
    assert.match(unset.logs.join('\n'), /\[RAG\] mode=off /)
    assert.match(unset.logs.join('\n'), /\[RAG Lore\] mode=off tokens: (\d+)/)
    const tokens = Number(unset.logs.join('\n').match(/\[RAG Lore\] mode=off tokens: (\d+)/)[1])
    assert.ok(tokens <= LORE_TOKEN_CAP)

    process.env.RAG_RERANK = 'on'
    process.env.COS_GATE = '2'
    const gated = await captureInfo(() => postStream(chatStreamRouter, {
      npc: 'bartender',
      message,
      sessionId: 'rag-flag-stream-on',
    }))
    assert.match(gated.result, /event: done/)
    assert.match(gated.logs.join('\n'), /mode=on /)
    assert.match(gated.logs.join('\n'), /skipped: yes/)
    assert.doesNotMatch(gated.logs.join('\n'), /\[RAG Lore\]/)
  })
})
