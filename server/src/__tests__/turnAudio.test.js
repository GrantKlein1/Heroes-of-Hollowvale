import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  createTurn,
  getTurn,
  addSentence,
  finishTurn,
  pipeTurnAudio,
  clearExpiredTurns,
  resetTurns,
  getActiveTurnCount,
  abortTurn,
  getTtsTimeoutMs,
} from '../tts/turnAudio.js';

beforeEach(() => {
  resetTurns();
});

test('turnAudio: creates and retrieves turn within TTL', () => {
  const turn = createTurn({ turnId: 'turn-test-1', ttlMs: 30000 });
  assert.equal(turn.turnId, 'turn-test-1');
  assert.equal(turn.ttlMs, 30000);

  const retrieved = getTurn('turn-test-1');
  assert.ok(retrieved);
  assert.equal(retrieved.turnId, 'turn-test-1');
});

test('turnAudio: turn expires after TTL (30s contract)', async () => {
  // Use a short TTL for testing
  createTurn({ turnId: 'turn-expiring', ttlMs: 50 });
  assert.ok(getTurn('turn-expiring'));

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(getTurn('turn-expiring'), null);
});

test('turnAudio: clearExpiredTurns cleans up expired entries', async () => {
  createTurn({ turnId: 'turn-short', ttlMs: 30 });
  createTurn({ turnId: 'turn-long', ttlMs: 10000 });
  assert.equal(getActiveTurnCount(), 2);

  await new Promise((resolve) => setTimeout(resolve, 40));
  const cleared = clearExpiredTurns();
  assert.equal(cleared, 1);
  assert.equal(getActiveTurnCount(), 1);
  assert.ok(getTurn('turn-long'));
});

test('turnAudio: pipes buffered and streaming audio chunks to response stream', async () => {
  // Mock TTS fetcher that returns an EventEmitter audio stream
  const mockFetcher = async ({ text }) => {
    const emitter = new EventEmitter();
    setTimeout(() => {
      emitter.emit('data', Buffer.from(`[audio:${text}]`));
      emitter.emit('end');
    }, 10);
    return emitter;
  };

  process.env.ELEVENLABS_API_KEY = 'mock-key-for-test';

  const turn = createTurn({
    turnId: 'turn-stream-test',
    ttsFetcher: mockFetcher,
  });

  addSentence('turn-stream-test', 'First sentence.');

  // Mock response object
  const written = [];
  let ended = false;
  const mockRes = {
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    write(chunk) { written.push(chunk.toString('utf8')); },
    end() { ended = true; },
  };

  const pipeResult = pipeTurnAudio('turn-stream-test', mockRes);
  assert.equal(pipeResult.status, 200);

  // Add second sentence while stream is attached
  addSentence('turn-stream-test', 'Second sentence.');
  finishTurn('turn-stream-test');

  // Wait for processing
  await turn.sentenceQueue;
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(ended, 'Response stream should be ended when turn completes');
  assert.deepEqual(written, ['[audio:First sentence.]', '[audio:Second sentence.]']);

  delete process.env.ELEVENLABS_API_KEY;
});

test('turnAudio: pipeTurnAudio returns 501 when ELEVENLABS_API_KEY is unset', () => {
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.elevenLabsKey;

  createTurn({ turnId: 'turn-no-key' });
  const mockRes = {
    status(code) { this.statusCode = code; return this; },
    setHeader() {},
    write() {},
    end() {},
  };

  const result = pipeTurnAudio('turn-no-key', mockRes);
  assert.equal(result.status, 501);
  assert.ok(result.error.includes('ElevenLabs API key is not set'));
});

test('turnAudio: pipeTurnAudio returns 404 for unknown turn', () => {
  process.env.ELEVENLABS_API_KEY = 'mock-key';
  const mockRes = {};
  const result = pipeTurnAudio('nonexistent-turn', mockRes);
  assert.equal(result.status, 404);
  delete process.env.ELEVENLABS_API_KEY;
});

test('turnAudio: abortTurn cancels synthesis, rejects new sentences, and ends pipe stream', async () => {
  process.env.ELEVENLABS_API_KEY = 'mock-key';

  let abortedInFetcher = false;
  const mockFetcher = async ({ text, signal }) => {
    const emitter = new EventEmitter();
    if (signal) {
      signal.addEventListener('abort', () => {
        abortedInFetcher = true;
      });
    }
    setTimeout(() => {
      emitter.emit('data', Buffer.from(`[audio:${text}]`));
      emitter.emit('end');
    }, 50);
    return emitter;
  };

  const turn = createTurn({
    turnId: 'turn-abort-test',
    ttsFetcher: mockFetcher,
  });

  const written = [];
  let ended = false;
  const mockRes = {
    status(code) { this.statusCode = code; return this; },
    setHeader() {},
    write(chunk) { written.push(chunk.toString('utf8')); },
    end() { ended = true; },
  };

  pipeTurnAudio('turn-abort-test', mockRes);
  addSentence('turn-abort-test', 'Will be aborted.');

  // Let synthesis start
  await new Promise((r) => setTimeout(r, 10));

  const didAbort = abortTurn('turn-abort-test', 'superseded');
  assert.equal(didAbort, true);
  assert.equal(turn.aborted, true);
  assert.equal(turn.abortReason, 'superseded');

  // Pipe response should end on abort
  assert.equal(ended, true);

  // New sentence should be rejected
  const added = addSentence('turn-abort-test', 'Should not be added');
  assert.equal(added, false);

  // Subsequent pipe call should return 410
  const pipe2 = pipeTurnAudio('turn-abort-test', mockRes);
  assert.equal(pipe2.status, 410);

  delete process.env.ELEVENLABS_API_KEY;
});

test('turnAudio: getTtsTimeoutMs returns env override or sane default 15000', () => {
  const origTimeout = process.env.ELEVENLABS_TIMEOUT_MS;
  const origTts = process.env.TTS_TIMEOUT_MS;

  delete process.env.ELEVENLABS_TIMEOUT_MS;
  delete process.env.TTS_TIMEOUT_MS;
  assert.equal(getTtsTimeoutMs(), 15000);

  process.env.TTS_TIMEOUT_MS = '7500';
  assert.equal(getTtsTimeoutMs(), 7500);

  process.env.ELEVENLABS_TIMEOUT_MS = '3000';
  assert.equal(getTtsTimeoutMs(), 3000);

  if (origTimeout !== undefined) process.env.ELEVENLABS_TIMEOUT_MS = origTimeout;
  else delete process.env.ELEVENLABS_TIMEOUT_MS;

  if (origTts !== undefined) process.env.TTS_TIMEOUT_MS = origTts;
  else delete process.env.TTS_TIMEOUT_MS;
});
