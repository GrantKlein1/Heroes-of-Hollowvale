import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryStore, getHistory } from '../memory.js';
import chatStreamRouter from '../routes/chatStream.js';

beforeEach(() => {
  resetMemoryStore();
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

