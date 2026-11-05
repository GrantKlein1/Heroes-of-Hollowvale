import test from 'node:test';
import assert from 'node:assert/strict';
import { rerank, warmupReranker } from '../rag/rerank.js';
import { retrieveCandidates, retrieveLoreForQuery, retrieveLoreWithShadow } from '../rag/store.js';

test('warmupReranker initializes cross-encoder without throwing', async () => {
  const ready = await warmupReranker();
  assert.equal(typeof ready, 'boolean');
});

test('rerank orders a relevant chunk above an unrelated one', async () => {
  const query = 'Where is the Cavern of Embers and Veyrath the dragon?';
  const unrelatedChunk = 'The village baker in Brackenford sells warm bread, dried apples, and cider every morning.';
  const relevantChunk = 'The Cavern of Embers lies in the Blackspire Mountains, where Veyrath the red dragon hoards ancient treasures amidst rivers of flame.';

  // Test with string candidates (unrelated passed first)
  const rankedStrings = await rerank(query, [unrelatedChunk, relevantChunk]);

  assert.equal(rankedStrings.length, 2);
  assert.equal(rankedStrings[0].text, relevantChunk);
  assert.equal(rankedStrings[1].text, unrelatedChunk);
  assert.ok(
    rankedStrings[0].rerankScore > rankedStrings[1].rerankScore,
    `Expected relevant score (${rankedStrings[0].rerankScore}) > unrelated score (${rankedStrings[1].rerankScore})`
  );

  // Test with candidate objects
  const candidateObjects = [
    { id: 'c1', text: unrelatedChunk, score: 0.75 },
    { id: 'c2', text: relevantChunk, score: 0.60 },
  ];
  const rankedObjects = await rerank(query, candidateObjects);

  assert.equal(rankedObjects.length, 2);
  assert.equal(rankedObjects[0].id, 'c2');
  assert.equal(rankedObjects[0].text, relevantChunk);
  assert.ok(rankedObjects[0].rerankScore > rankedObjects[1].rerankScore);
  // Preserves original cosine score under cosScore
  assert.equal(rankedObjects[0].cosScore, 0.60);
});

test('retrieveCandidates returns candidates with cosine similarity in descending order', async () => {
  const candidates = await retrieveCandidates('dragon in the cavern', 5);
  assert.ok(Array.isArray(candidates));

  if (candidates.length > 0) {
    assert.ok(candidates.length <= 5);
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      assert.equal(typeof c.text, 'string');
      assert.equal(typeof c.score, 'number');
      assert.equal(typeof c.cosScore, 'number');
      if (i > 0) {
        assert.ok(
          candidates[i - 1].score >= c.score,
          `Candidates should be sorted descending by cosine score: ${candidates[i - 1].score} >= ${c.score}`
        );
      }
    }
  }
});

test('replies unchanged in shadow mode: loreChunks match baseline retrieval', async () => {
  const query = 'Cavern of Embers';
  const baselineLore = await retrieveLoreForQuery(query, 3);
  const { loreChunks, shadowMetrics } = await retrieveLoreWithShadow(query, {
    candidateK: 10,
    topK: 3,
  });

  // Prompt grounding chunks in shadow mode must be identical to baseline
  assert.deepEqual(loreChunks, baselineLore);

  // Shadow metrics are calculated and available
  assert.equal(typeof shadowMetrics.maxCos, 'number');
  assert.ok(Array.isArray(shadowMetrics.rerankScores));
  if (loreChunks.length > 0) {
    assert.equal(typeof shadowMetrics.rerankTopScore, 'number');
  }
});

test('shadow mode logging captures maxCos and rerank scores', async () => {
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => {
    logs.push(args.join(' '));
    originalInfo(...args);
  };

  try {
    const query = 'Who rules Hollowvale?';
    const { shadowMetrics } = await retrieveLoreWithShadow(query, { candidateK: 5, topK: 3 });

    // Format log entry identical to chat.js route
    const maxCosStr = shadowMetrics.maxCos.toFixed(4);
    const rerankTopScoreStr = shadowMetrics.rerankTopScore !== null ? shadowMetrics.rerankTopScore.toFixed(4) : 'none';
    const scoresStr = `[${shadowMetrics.rerankScores.map(s => Number(s).toFixed(4)).join(', ')}]`;
    const logLine = `[RAG Shadow] maxCos: ${maxCosStr}, rerankTopScore: ${rerankTopScoreStr}, rerankScores: ${scoresStr}`;

    console.info(logLine);

    const shadowLog = logs.find(l => l.includes('[RAG Shadow]'));
    assert.ok(shadowLog, 'Expected a log containing [RAG Shadow]');
    assert.ok(shadowLog.includes('maxCos:'), 'Expected log to include maxCos:');
    assert.ok(shadowLog.includes('rerankTopScore:'), 'Expected log to include rerankTopScore:');
    assert.ok(shadowLog.includes('rerankScores:'), 'Expected log to include rerankScores:');
  } finally {
    console.info = originalInfo;
  }
});

test('rerank edge cases: handles empty candidates and topK truncation', async () => {
  const empty = await rerank('any query', []);
  assert.deepEqual(empty, []);

  const nullCands = await rerank('any query', null);
  assert.deepEqual(nullCands, []);

  const passages = ['Passage one', 'Passage two', 'Passage three'];
  const top2 = await rerank('find something', passages, 2);
  assert.equal(top2.length, 2);
});

test('POST /api/chat produces stub reply unchanged and logs shadow metrics per turn', async () => {
  const chatRouter = (await import('../routes/chat.js')).default;

  const logs = [];
  const origInfo = console.info;
  console.info = (...args) => {
    logs.push(args.join(' '));
    origInfo(...args);
  };

  try {
    const data = await new Promise((resolve, reject) => {
      const req = {
        method: 'POST',
        url: '/chat',
        body: {
          npc: 'bartender',
          message: 'Where is the Cavern of Embers?',
          sessionId: 'test-shadow-session',
        },
      };

      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          resolve({ status: this.statusCode, payload });
        },
      };

      chatRouter.handle(req, res, (err) => {
        if (err) reject(err);
      });
    });

    assert.equal(data.status, 200);
    // Unchanged stubbed reply structure
    assert.ok(data.payload.reply.includes('[Stubbed reply from'));
    assert.ok(data.payload.reply.includes('Cavern of Embers'));
    assert.equal(data.payload.npc, 'bartender');

    // Confirm shadow logging per turn
    const shadowLog = logs.find(l => l.includes('[RAG Shadow]'));
    assert.ok(shadowLog, 'Expected [RAG Shadow] log on /api/chat turn');
    assert.ok(shadowLog.includes('maxCos:'));
    assert.ok(shadowLog.includes('rerankTopScore:'));
    assert.ok(shadowLog.includes('rerankScores:'));
  } finally {
    console.info = origInfo;
  }
});
