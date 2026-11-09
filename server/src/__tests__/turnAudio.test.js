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
