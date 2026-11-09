import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import express from 'express';
import ttsRouter from '../routes/tts.js';
import { createTurn, addSentence, finishTurn, resetTurns } from '../tts/turnAudio.js';
import { SentenceSplitter } from '../tts/sentenceSplitter.js';

test('GET /api/tts/turn/:turnId returns 501 when ELEVENLABS_API_KEY is unset (Acceptance Criterion 3)', async () => {
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.elevenLabsKey;

  const app = express();
  app.use('/api', ttsRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    createTurn({ turnId: 'turn-no-key-test' });

    const res = await fetch(`http://127.0.0.1:${port}/api/tts/turn/turn-no-key-test`);
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.ok(body.error.includes('ElevenLabs API key is not set'));
  } finally {
    server.close();
    resetTurns();
  }
});

test('GET /api/tts/turn/:turnId returns 404 for unknown or expired turnId', async () => {
  process.env.ELEVENLABS_API_KEY = 'mock-test-key';
  const app = express();
  app.use('/api', ttsRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/tts/turn/unknown-turn-123`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('Turn not found'));
  } finally {
    server.close();
    delete process.env.ELEVENLABS_API_KEY;
  }
});

test('Audio starts before full reply finishes (Acceptance Criterion 2)', async () => {
  process.env.ELEVENLABS_API_KEY = 'mock-test-key';

  const mockFetcher = async ({ text }) => {
    const emitter = new EventEmitter();
    setTimeout(() => {
      emitter.emit('data', Buffer.from(`[mp3_data_for:${text}]`));
      emitter.emit('end');
    }, 20);
    return emitter;
  };

  const app = express();
  app.use('/api', ttsRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const turn = createTurn({
      turnId: 'turn-early-audio',
      ttsFetcher: mockFetcher,
    });
    const turnId = turn.turnId;

    const splitter = new SentenceSplitter({
      onSentence: (s) => addSentence(turnId, s),
    });

    let fullReplyFinished = false;
    let audioReceivedBeforeFullReply = false;

    // Connect to GET /api/tts/turn/:turnId
    const responsePromise = fetch(`http://127.0.0.1:${port}/api/tts/turn/${turnId}`);

    // Simulate LLM streaming sentence 1 immediately
    splitter.feed('Hello traveler. ');

    // Read audio stream from client side
    const readerPromise = (async () => {
      const res = await responsePromise;
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'audio/mpeg');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedAudio = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulatedAudio += decoder.decode(value);

        if (accumulatedAudio.includes('[mp3_data_for:Hello traveler.]')) {
          if (!fullReplyFinished) {
            audioReceivedBeforeFullReply = true;
          }
        }
      }
      return accumulatedAudio;
    })();

    // Simulate LLM delay before sentence 2 finishes
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(audioReceivedBeforeFullReply, true, 'Audio chunk for sentence 1 arrived before reply finished');

    // Simulate LLM streaming sentence 2 and completing
    splitter.feed('The cavern is full of danger.');
    const flushed = splitter.flush();
    if (flushed) addSentence(turnId, flushed);
    finishTurn(turnId);
    fullReplyFinished = true;

    const finalAudio = await readerPromise;
    assert.ok(finalAudio.includes('[mp3_data_for:Hello traveler.]'));
    assert.ok(finalAudio.includes('[mp3_data_for:The cavern is full of danger.]'));
    assert.equal(audioReceivedBeforeFullReply, true);
  } finally {
    server.close();
    delete process.env.ELEVENLABS_API_KEY;
    resetTurns();
  }
});
