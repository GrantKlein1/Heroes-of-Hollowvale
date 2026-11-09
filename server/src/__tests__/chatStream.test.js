import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore, getHistory } from '../memory.js';
import chatStreamRouter, { resetActiveTurns } from '../routes/chatStream.js';
import { resetTurns, getTurn } from '../tts/turnAudio.js';

beforeEach(() => {
  resetMemoryStore();
  resetActiveTurns();
  resetTurns();
});

test('POST /api/chat/stream returns 400 when npc or message is missing', async () => {
  const result = await new Promise((resolve) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body: { npc: 'bartender' }, // missing message
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
    chatStreamRouter.handle(req, res, () => {});
  });

  assert.equal(result.status, 400);
  assert.ok(result.payload.error.includes('required'));
});

test('POST /api/chat/stream returns 400 for unknown npc', async () => {
  const result = await new Promise((resolve) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body: { npc: 'goblin_king', message: 'hello' },
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
    chatStreamRouter.handle(req, res, () => {});
  });

  assert.equal(result.status, 400);
  assert.ok(result.payload.error.includes('Unknown npc'));
});

test('POST /api/chat/stream sends SSE headers and emits meta, delta, and done events', async () => {
  const sessionId = 'stream-test-session-1';
  const headers = {};
  const chunks = [];

  const completion = await new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body: {
        npc: 'bartender',
        message: 'Where is the dragon?',
        sessionId,
      },
      on() {},
    };

    const res = {
      headersSent: false,
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      flushHeaders() {
        this.headersSent = true;
      },
      write(chunk) {
        this.headersSent = true;
        chunks.push(chunk);
      },
      end() {
        resolve({ headers, chunks });
      },
    };

    chatStreamRouter.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });

  // Verify SSE headers
  assert.ok(completion.headers['content-type']?.includes('text/event-stream'));
  assert.ok(completion.headers['cache-control']?.includes('no-cache'));

  const rawOutput = completion.chunks.join('');

  // Verify meta event
  assert.ok(rawOutput.includes('event: meta\n'));
  const metaMatch = rawOutput.match(/event: meta\ndata: (\{.*\})\n\n/);
  assert.ok(metaMatch, 'Expected meta event JSON');
  const metaData = JSON.parse(metaMatch[1]);
  assert.equal(metaData.npc, 'bartender');
  assert.equal(metaData.sessionId, sessionId);
  assert.equal(typeof metaData.caps, 'object');

  // Verify delta events
  assert.ok(rawOutput.includes('event: delta\n'));
  const deltaMatches = [...rawOutput.matchAll(/event: delta\ndata: (\{.*?\})\n\n/g)];
  assert.ok(deltaMatches.length > 0, 'Expected one or more delta events');
  const deltaTexts = deltaMatches.map(m => JSON.parse(m[1]).text);
  const joinedDeltaText = deltaTexts.join('');

  // Verify done event
  assert.ok(rawOutput.includes('event: done\n'));
  const doneMatch = rawOutput.match(/event: done\ndata: (\{.*\})\n\n/);
  assert.ok(doneMatch, 'Expected done event JSON');
  const doneData = JSON.parse(doneMatch[1]);
  assert.equal(doneData.npc, 'bartender');
  assert.equal(doneData.sessionId, sessionId);
  assert.equal(doneData.reply, joinedDeltaText);

  // Verify memory persistence
  const history = getHistory(sessionId, 'bartender');
  assert.equal(history.length, 2);
  assert.equal(history[0].role, 'user');
  assert.equal(history[0].content, 'Where is the dragon?');
  assert.equal(history[1].role, 'assistant');
  assert.equal(history[1].content, doneData.reply);
});

test('chatCompletionStream throws descriptive error when GROQ_API_KEY is not set', async () => {
  const { chatCompletionStream } = await import('../groqClient.js');
  await assert.rejects(
    () => chatCompletionStream({ systemPrompt: 'test', messages: [] }),
    /Groq API key is not set/
  );
});

test('Headers test: X-Accel-Buffering: no present; headers flushed before the first token', async () => {
  const headers = {};
  let flushHeadersCalled = false;
  let firstWriteOccurred = false;
  let flushedBeforeFirstWrite = false;

  await new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body: { npc: 'bartender', message: 'Hello', sessionId: 'hdr-sess' },
      on() {},
    };
    const res = {
      headersSent: false,
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      flushHeaders() {
        flushHeadersCalled = true;
        this.headersSent = true;
        if (!firstWriteOccurred) {
          flushedBeforeFirstWrite = true;
        }
      },
      write() {
        firstWriteOccurred = true;
      },
      end() {
        resolve();
      },
    };
    chatStreamRouter.handle(req, res, (err) => { if (err) reject(err); });
  });

  assert.equal(headers['x-accel-buffering'], 'no');
  assert.equal(flushHeadersCalled, true);
  assert.equal(flushedBeforeFirstWrite, true);
});

test('Test: a second message aborts the first stream (aborted marker, TTS jobs cancelled, no late audio)', async () => {
  const sessionId = 'supersede-session-1';
  process.env.STUB_STREAM_DELAY_MS = '25'; // Ensure first stream stays in flight long enough

  const firstChunks = [];
  let firstEnded = false;
  let firstTurnId = null;

  const req1 = {
    method: 'POST',
    url: '/chat/stream',
    body: { npc: 'bartender', message: 'First long message to supersede', sessionId },
    on() {},
  };
  const res1 = {
    headersSent: false,
    setHeader() {},
    flushHeaders() {},
    write(chunk) {
      firstChunks.push(chunk);
      if (!firstTurnId && chunk.includes('event: meta')) {
        const match = chunk.match(/"turnId":"([^"]+)"/);
        if (match) firstTurnId = match[1];
      }
    },
    end() {
      firstEnded = true;
    },
  };

  // Launch first request
  chatStreamRouter.handle(req1, res1, () => {});

  // Wait briefly so first stream is in-flight
  await new Promise((resolve) => setTimeout(resolve, 30));

  const secondChunks = [];
  let secondEnded = false;
  let secondTurnId = null;

  const req2 = {
    method: 'POST',
    url: '/chat/stream',
    body: { npc: 'bartender', message: 'Second message replacing the first', sessionId },
    on() {},
  };
  const res2 = {
    headersSent: false,
    setHeader() {},
    flushHeaders() {},
    write(chunk) {
      secondChunks.push(chunk);
      if (!secondTurnId && chunk.includes('event: meta')) {
        const match = chunk.match(/"turnId":"([^"]+)"/);
        if (match) secondTurnId = match[1];
      }
    },
    end() {
      secondEnded = true;
    },
  };

  // Launch second request for same sessionId:npc
  await new Promise((resolve, reject) => {
    res2.end = () => {
      secondEnded = true;
      resolve();
    };
    chatStreamRouter.handle(req2, res2, (err) => { if (err) reject(err); });
  });

  delete process.env.STUB_STREAM_DELAY_MS;

  // Verify first stream was aborted
  assert.equal(firstEnded, true);
  const firstRaw = firstChunks.join('');
  assert.ok(firstRaw.includes('event: aborted\n'), 'First stream should have received event: aborted');
  assert.ok(firstRaw.includes('"superseded"'), 'Aborted event should mention superseded');

  // Verify first turn's audio was cancelled
  assert.ok(firstTurnId, 'First turn should have a turnId');
  const firstTurnObj = getTurn(firstTurnId);
  assert.ok(firstTurnObj?.aborted, 'First turn TTS should be aborted');

  // Verify second stream completed normally
  assert.equal(secondEnded, true);
  const secondRaw = secondChunks.join('');
  assert.ok(secondRaw.includes('event: done\n'), 'Second stream should complete with event: done');
});

test('Test: a forced upstream timeout yields an error SSE event and ends within timeout + 1s', async () => {
  const origTimeout = process.env.GROQ_TIMEOUT_MS;
  const origForce = process.env.FORCE_LLM_TIMEOUT;

  // Set timeout to 100ms and delay stub by 3000ms
  process.env.GROQ_TIMEOUT_MS = '100';
  process.env.FORCE_LLM_TIMEOUT = '3000';

  const chunks = [];
  let ended = false;
  const startTime = Date.now();
  let streamEndedTime = null;
  let llmStartTime = null;

  await new Promise((resolve, reject) => {
    const req = {
      method: 'POST',
      url: '/chat/stream',
      body: { npc: 'bartender', message: 'Will time out', sessionId: 'timeout-sess' },
      on() {},
    };
    const res = {
      headersSent: false,
      setHeader() {},
      flushHeaders() {},
      write(chunk) {
        chunks.push(chunk);
      },
      end() {
        ended = true;
        if (!streamEndedTime) streamEndedTime = Date.now();
      },
      _onLlmStart() {
        llmStartTime = Date.now();
      },
      _onComplete() {
        resolve();
      },
    };
    chatStreamRouter.handle(req, res, (err) => { if (err) reject(err); });
  });

  const durationMs = (streamEndedTime || Date.now()) - (llmStartTime || startTime);

  if (origTimeout !== undefined) process.env.GROQ_TIMEOUT_MS = origTimeout;
  else delete process.env.GROQ_TIMEOUT_MS;

  if (origForce !== undefined) process.env.FORCE_LLM_TIMEOUT = origForce;
  else delete process.env.FORCE_LLM_TIMEOUT;

  assert.equal(ended, true, 'Stream should have ended');
  // Must end within timeout (100ms) + 1s (1100ms)
  assert.ok(durationMs < 1100, `Expected stream to end within timeout + 1s, took ${durationMs}ms`);

  const rawOutput = chunks.join('');
  assert.ok(rawOutput.includes('event: error\n'), 'Output should contain event: error');
  assert.ok(rawOutput.includes('"TIMEOUT"'), 'Error event should have code TIMEOUT');
});

test('Test: metrics logged exactly once per turn (including completed, aborted, and timeout turns)', async () => {
  const loggedLines = [];
  const originalInfo = console.info;
  console.info = (...args) => {
    const line = args.join(' ');
    if (line.includes('[TurnMetrics]')) {
      loggedLines.push(line);
    }
    originalInfo.apply(console, args);
  };

  try {
    // 1. Normal turn
    await new Promise((resolve) => {
      const req = {
        method: 'POST',
        url: '/chat/stream',
        body: { npc: 'bartender', message: 'Hello there', sessionId: 'metrics-normal' },
        on() {},
      };
      const res = {
        setHeader() {},
        flushHeaders() {},
        write() {},
        end() {},
        _onComplete() { resolve(); },
      };
      chatStreamRouter.handle(req, res, () => {});
    });

    const normalMetricsCount = loggedLines.length;
    assert.equal(normalMetricsCount, 1, 'Should log exactly one metrics line for completed turn');
    const normalParsed = JSON.parse(loggedLines[0].replace('[TurnMetrics] ', ''));
    assert.equal(normalParsed.aborted, false);
    assert.equal(normalParsed.timeout, false);
    assert.equal(typeof normalParsed.ttfb, 'number');
    assert.equal(typeof normalParsed.total, 'number');

    // 2. Aborted turn
    process.env.STUB_STREAM_DELAY_MS = '25';
    let res1Done = false;
    const req1 = {
      method: 'POST',
      url: '/chat/stream',
      body: { npc: 'bartender', message: 'Message to abort', sessionId: 'metrics-abort' },
      on() {},
    };
    const res1 = {
      setHeader() {},
      flushHeaders() {},
      write() {},
      end() {},
      _onComplete() { res1Done = true; },
    };
    chatStreamRouter.handle(req1, res1, () => {});

    await new Promise((r) => setTimeout(r, 20));

    await new Promise((resolve) => {
      const req2 = {
        method: 'POST',
        url: '/chat/stream',
        body: { npc: 'bartender', message: 'Superseding message', sessionId: 'metrics-abort' },
        on() {},
      };
      const res2 = {
        setHeader() {},
        flushHeaders() {},
        write() {},
        end() {},
        _onComplete() { resolve(); },
      };
      chatStreamRouter.handle(req2, res2, () => {});
    });
    delete process.env.STUB_STREAM_DELAY_MS;

    // Wait if res1 has not yet settled
    if (!res1Done) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Both the aborted turn and the superseding turn should have logged exactly 1 line each
    assert.equal(loggedLines.length, 3, 'Total 3 metric lines so far (1 normal + 1 aborted + 1 superseding)');
    const abortParsed = JSON.parse(loggedLines[1].replace('[TurnMetrics] ', ''));
    assert.equal(abortParsed.aborted, true);
    assert.equal(abortParsed.timeout, false);

    // 3. Timeout turn
    process.env.GROQ_TIMEOUT_MS = '50';
    process.env.FORCE_LLM_TIMEOUT = '300';

    await new Promise((resolve) => {
      const req3 = {
        method: 'POST',
        url: '/chat/stream',
        body: { npc: 'bartender', message: 'Timeout msg', sessionId: 'metrics-timeout' },
        on() {},
      };
      const res3 = {
        setHeader() {},
        flushHeaders() {},
        write() {},
        end() {},
        _onComplete() { resolve(); },
      };
      chatStreamRouter.handle(req3, res3, () => {});
    });

    delete process.env.GROQ_TIMEOUT_MS;
    delete process.env.FORCE_LLM_TIMEOUT;

    assert.equal(loggedLines.length, 4, 'Total 4 metric lines (1 normal + 1 aborted + 1 superseding + 1 timeout)');
    const timeoutParsed = JSON.parse(loggedLines[3].replace('[TurnMetrics] ', ''));
    assert.equal(timeoutParsed.timeout, true);
  } finally {
    console.info = originalInfo;
  }
});

