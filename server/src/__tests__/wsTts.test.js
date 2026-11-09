import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';

import {
  isWsTtsEnabled,
  attachWsTts,
  subscribeClientToTurn,
} from '../tts/wsTts.js';
import {
  createTurn,
  addSentence,
  finishTurn,
  resetTurns,
  getTurn,
} from '../tts/turnAudio.js';
import ttsRouter from '../routes/tts.js';

beforeEach(() => {
  resetTurns();
});

test('TTS_MODE unset: Option B unchanged and ws attachment disabled (Acceptance Criterion 1)', async () => {
  const originalMode = process.env.TTS_MODE;
  delete process.env.TTS_MODE;

  try {
    assert.equal(isWsTtsEnabled(), false, 'isWsTtsEnabled should be false when TTS_MODE is unset');

    const app = express();
    app.use('/api', ttsRouter);
    const server = http.createServer(app);

    const wss = attachWsTts(server);
    assert.equal(wss, null, 'attachWsTts returns null when TTS_MODE is not ws');

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    // Option B HTTP endpoint continues to function unchanged
    const turn = createTurn({ turnId: 'opt-b-turn' });
    const res = await fetch(`http://127.0.0.1:${port}/api/tts/turn/opt-b-turn`);
    // 501 without key or 200 with key; verifies HTTP handler works as in L-6
    assert.ok(res.status === 501 || res.status === 200);

    server.close();
  } finally {
    if (originalMode !== undefined) {
      process.env.TTS_MODE = originalMode;
    } else {
      delete process.env.TTS_MODE;
    }
  }
});

test('TTS_MODE=ws: attaches WebSocket server, handshakes, and responds to ping', async () => {
  process.env.TTS_MODE = 'ws';
  const app = express();
  const server = http.createServer(app);
  const wss = attachWsTts(server);
  assert.ok(wss, 'attachWsTts returns WebSocketServer when TTS_MODE=ws');

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/tts/ws`);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Send ping and await pong
    const pongPromise = new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString('utf8'));
        if (msg.type === 'pong') resolve(msg);
      });
    });

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await pongPromise;
    assert.equal(pong.type, 'pong');
    assert.ok(pong.timestamp > 0);

    ws.close();
  } finally {
    wss.close();
    server.close();
    delete process.env.TTS_MODE;
  }
});

test('TTS_MODE=ws: streams audio chunks and done event for active turn (Acceptance Criterion 2)', async () => {
  process.env.TTS_MODE = 'ws';
  process.env.ELEVENLABS_API_KEY = 'test-key-mock';

  const mockFetcher = async ({ text }) => {
    const emitter = new EventEmitter();
    setTimeout(() => {
      emitter.emit('data', Buffer.from(`[ws_audio_chunk:${text}]`));
      emitter.emit('end');
    }, 15);
    return emitter;
  };

  const app = express();
  const server = http.createServer(app);
  const wss = attachWsTts(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const turn = createTurn({
      turnId: 'turn-ws-stream-1',
      ttsFetcher: mockFetcher,
    });
    const turnId = turn.turnId;

    // Connect via WS with turnId in query parameter
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/tts/ws?turnId=${turnId}`);

    const receivedChunks = [];
    const receivedMessages = [];

    const donePromise = new Promise((resolve) => {
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          receivedChunks.push(data.toString('utf8'));
        } else {
          const msg = JSON.parse(data.toString('utf8'));
          receivedMessages.push(msg);
          if (msg.type === 'done') {
            resolve();
          }
        }
      });
    });

    // Add first sentence while client is connected
    addSentence(turnId, 'Welcome to the tavern.');

    // Wait a brief moment, then add second sentence and finish turn
    await new Promise((r) => setTimeout(r, 40));
    addSentence(turnId, 'Warm yourself by the fire.');
    finishTurn(turnId);

    await donePromise;

    // Verify metadata was received
    const metaMsg = receivedMessages.find((m) => m.type === 'meta');
    assert.ok(metaMsg);
    assert.equal(metaMsg.turnId, turnId);

    // Verify audio chunks were received as binary frames
    const fullAudio = receivedChunks.join('');
    assert.ok(fullAudio.includes('[ws_audio_chunk:Welcome to the tavern.]'));
    assert.ok(fullAudio.includes('[ws_audio_chunk:Warm yourself by the fire.]'));

    // Verify done message
    const doneMsg = receivedMessages.find((m) => m.type === 'done');
    assert.ok(doneMsg);
    assert.equal(doneMsg.turnId, turnId);

    ws.close();
  } finally {
    wss.close();
    server.close();
    delete process.env.TTS_MODE;
    delete process.env.ELEVENLABS_API_KEY;
  }
});

test('TTS_MODE=ws: returns 501 error when ELEVENLABS_API_KEY is unset', async () => {
  process.env.TTS_MODE = 'ws';
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.elevenLabsKey;

  const app = express();
  const server = http.createServer(app);
  const wss = attachWsTts(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    createTurn({ turnId: 'turn-no-key' });

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/tts/ws?turnId=turn-no-key`);

    const errorMsgPromise = new Promise((resolve) => {
      ws.on('message', (data, isBinary) => {
        if (!isBinary) {
          const msg = JSON.parse(data.toString('utf8'));
          if (msg.type === 'error') resolve(msg);
        }
      });
    });

    const errorMsg = await errorMsgPromise;
    assert.equal(errorMsg.type, 'error');
    assert.equal(errorMsg.status, 501);
    assert.ok(errorMsg.message.includes('ElevenLabs API key is not set'));

    ws.close();
  } finally {
    wss.close();
    server.close();
    delete process.env.TTS_MODE;
  }
});

test('Zero Key Leakage: API key is NEVER sent to client in WebSocket frames (Acceptance Criterion 3)', async () => {
  const SECRET_KEY = 'sk-super-secret-key-never-leak-9876543210';
  process.env.TTS_MODE = 'ws';
  process.env.ELEVENLABS_API_KEY = SECRET_KEY;

  const mockFetcher = async ({ text }) => {
    const emitter = new EventEmitter();
    setTimeout(() => {
      emitter.emit('data', Buffer.from(`[audio_for:${text}]`));
      emitter.emit('end');
    }, 10);
    return emitter;
  };

  const app = express();
  const server = http.createServer(app);
  const wss = attachWsTts(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const turn = createTurn({
      turnId: 'privacy-check-turn',
      ttsFetcher: mockFetcher,
    });
    addSentence(turn.turnId, 'Checking key privacy.');
    finishTurn(turn.turnId);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/tts/ws`);
    await new Promise((resolve) => ws.on('open', resolve));

    const allFramesReceived = [];
    ws.on('message', (data, isBinary) => {
      allFramesReceived.push(data.toString('utf8'));
    });

    // 1. Send ping
    ws.send(JSON.stringify({ type: 'ping' }));

    // 2. Subscribe to turn
    ws.send(JSON.stringify({ type: 'subscribe', turnId: turn.turnId }));

    // 3. Trigger error condition
    ws.send(JSON.stringify({ type: 'unknown_command' }));

    // Wait for all messages to arrive
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.ok(allFramesReceived.length > 0, 'Should have received WebSocket messages');

    // Strict verification: Ensure the secret key string is not found in ANY frame
    for (const frame of allFramesReceived) {
      assert.equal(
        frame.includes(SECRET_KEY),
        false,
        `Security violation: Secret key leaked to client in message frame: ${frame}`
      );
    }

    ws.close();
  } finally {
    wss.close();
    server.close();
    delete process.env.TTS_MODE;
    delete process.env.ELEVENLABS_API_KEY;
  }
});

test('Client disconnect cleans up turn listeners without memory leaks', async () => {
  process.env.TTS_MODE = 'ws';
  process.env.ELEVENLABS_API_KEY = 'test-key-mock';

  const app = express();
  const server = http.createServer(app);
  const wss = attachWsTts(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const turn = createTurn({ turnId: 'turn-disconnect-test' });
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/tts/ws?turnId=turn-disconnect-test`);

    await new Promise((resolve) => ws.on('open', resolve));
    // Wait for subscription listeners to attach
    await new Promise((resolve) => setTimeout(resolve, 30));

    const turnObj = getTurn('turn-disconnect-test');
    assert.equal(turnObj.listeners.size, 1);
    assert.equal(turnObj.doneListeners.size, 1);

    // Client abruptly closes connection
    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Listeners must be cleaned up
    assert.equal(turnObj.listeners.size, 0);
    assert.equal(turnObj.doneListeners.size, 0);
  } finally {
    wss.close();
    server.close();
    delete process.env.TTS_MODE;
    delete process.env.ELEVENLABS_API_KEY;
  }
});
