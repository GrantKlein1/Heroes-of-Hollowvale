import { WebSocketServer, WebSocket } from 'ws';
import { getElevenLabsApiKey, getElevenLabsVoiceId } from '../config/secrets.js';
import { getTurn, createTurn, addSentence, finishTurn } from './turnAudio.js';
import { splitSentences } from './sentenceSplitter.js';

const DEFAULT_VOICE_ID = getElevenLabsVoiceId() || 'N2lVS1w4EtoT3dr4eOWO'; // Callum
const WS_TTS_PATH = '/api/tts/ws';

/**
 * Checks whether WebSocket TTS (Option A) is active via TTS_MODE=ws.
 * @returns {boolean}
 */
export function isWsTtsEnabled() {
  return String(process.env.TTS_MODE || '').trim().toLowerCase() === 'ws';
}

/**
 * Extracts turnId from a URL pathname like /api/tts/turn/:turnId/ws or query params.
 */
function extractTurnId(url) {
  try {
    const parsed = new URL(url, 'http://localhost');
    const queryTurn = parsed.searchParams.get('turnId');
    if (queryTurn) return queryTurn;

    const match = parsed.pathname.match(/\/api\/tts\/turn\/([^/]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

/**
 * Subscribes a WebSocket client to an active turn's audio stream.
 */
export function subscribeClientToTurn(ws, turnId) {
  const turn = getTurn(turnId);
  if (!turn) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', status: 404, message: 'Turn not found or expired' }));
    }
    return null;
  }

  if (turn.aborted) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'aborted', turnId: turn.turnId }));
    }
    return null;
  }

  // Check for API key; return 501 error event if missing
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        status: 501,
        message: 'ElevenLabs API key is not set (expected ELEVENLABS_API_KEY or elevenLabsKey)',
      }));
    }
    return null;
  }

  // Emit turn metadata
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'meta',
      turnId: turn.turnId,
      voiceId: turn.voiceId,
      isFinished: turn.isFinished,
    }));
  }

  // Flush already buffered audio chunks as binary frames
  for (const chunk of turn.audioChunks) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk, { binary: true });
    }
  }

  // If already finished and no in-flight synthesis, emit done immediately
  if (turn.isFinished && turn.inFlightCount === 0) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'done', turnId: turn.turnId }));
    }
    return null;
  }

  // Register real-time chunk and done listeners
  const onChunk = (chunk) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(chunk, { binary: true });
      } catch {
        /* ignore send error on broken socket */
      }
    }
  };

  const onDone = () => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'done', turnId: turn.turnId }));
      } catch {
        /* ignore */
      }
    }
    cleanup();
  };

  const onAbort = (reason) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'aborted', turnId: turn.turnId, reason }));
      } catch {
        /* ignore */
      }
    }
    cleanup();
  };

  const cleanup = () => {
    turn.listeners.delete(onChunk);
    turn.doneListeners.delete(onDone);
    turn.abortListeners.delete(onAbort);
  };

  turn.listeners.add(onChunk);
  turn.doneListeners.add(onDone);
  turn.abortListeners.add(onAbort);

  ws.on('close', cleanup);
  ws.on('error', cleanup);

  return cleanup;
}

/**
 * Handles incoming WebSocket connection for TTS streaming.
 */
export function handleWsConnection(ws, req) {
  const reqUrl = req?.url || '/';
  const initialTurnId = extractTurnId(reqUrl);

  // If a turnId is in the connection URL, subscribe immediately
  if (initialTurnId) {
    subscribeClientToTurn(ws, initialTurnId);
  }

  // Handle client messages
  ws.on('message', async (data, isBinary) => {
    if (isBinary) return; // ignore incoming binary frames

    let message;
    try {
      message = JSON.parse(data.toString('utf8'));
    } catch {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', status: 400, message: 'Invalid JSON message' }));
      }
      return;
    }

    const { type } = message || {};

    if (type === 'ping') {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      return;
    }

    if (type === 'subscribe') {
      const { turnId } = message;
      if (!turnId) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', status: 400, message: 'Missing required field: turnId' }));
        }
        return;
      }
      subscribeClientToTurn(ws, turnId);
      return;
    }

    if (type === 'speak') {
      const apiKey = getElevenLabsApiKey();
      if (!apiKey) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            status: 501,
            message: 'ElevenLabs API key is not set (expected ELEVENLABS_API_KEY or elevenLabsKey)',
          }));
        }
        return;
      }

      const {
        text,
        voiceId = DEFAULT_VOICE_ID,
        modelId = 'eleven_flash_v2_5',
        voiceSettings,
      } = message;

      if (!text || typeof text !== 'string') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', status: 400, message: 'Missing required field: text' }));
        }
        return;
      }

      const turn = createTurn({ voiceId, modelId, voiceSettings });
      subscribeClientToTurn(ws, turn.turnId);

      const sentences = splitSentences(text);
      for (const s of sentences) {
        addSentence(turn.turnId, s);
      }
      finishTurn(turn.turnId);
      return;
    }

    // Unknown message type
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', status: 400, message: `Unknown message type: ${type}` }));
    }
  });
}

/**
 * Attaches WebSocket TTS server to an existing HTTP/S server.
 * Only attaches if TTS_MODE=ws (or options.forceEnable is true).
 *
 * @param {import('http').Server} httpServer
 * @param {object} [options]
 * @returns {WebSocketServer|null}
 */
export function attachWsTts(httpServer, options = {}) {
  const enabled = options.forceEnable ?? isWsTtsEnabled();
  if (!enabled) {
    return null;
  }

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const parsed = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const isPathMatch =
        parsed.pathname === WS_TTS_PATH ||
        parsed.pathname.startsWith('/api/tts/turn/');

      if (isPathMatch) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
  });

  wss.on('connection', (ws, req) => {
    handleWsConnection(ws, req);
  });

  return wss;
}

export default {
  isWsTtsEnabled,
  attachWsTts,
  handleWsConnection,
  subscribeClientToTurn,
};
