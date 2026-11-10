import crypto from 'node:crypto';
import axios from 'axios';
import { getElevenLabsApiKey, getElevenLabsVoiceId } from '../config/secrets.js';

const DEFAULT_TTL_MS = 30_000; // 30 seconds TTL
const DEFAULT_VOICE_ID = getElevenLabsVoiceId() || 'N2lVS1w4EtoT3dr4eOWO'; // Callum

export function getTtsTimeoutMs() {
  const envVal = process.env.ELEVENLABS_TIMEOUT_MS || process.env.TTS_TIMEOUT_MS;
  const parsed = parseInt(envVal, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

const turns = new Map();

/**
 * Synthesizes a single sentence to audio/mpeg using ElevenLabs streaming API.
 * Returns a readable stream of audio bytes.
 */
async function defaultTtsFetcher({
  text,
  voiceId = DEFAULT_VOICE_ID,
  modelId = 'eleven_flash_v2_5',
  voiceSettings,
  apiKey,
  signal,
  timeout = getTtsTimeoutMs(),
}) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const response = await axios.post(
    url,
    {
      text,
      model_id: modelId,
      output_format: 'mp3_44100_128',
      voice_settings: voiceSettings || {
        stability: 0.75,
        similarity_boost: 0.85,
        style: 0.25,
        speed: 0.85,
        use_speaker_boost: true,
      },
    },
    {
      responseType: 'stream',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      timeout,
      signal,
      validateStatus: (s) => s >= 200 && s < 300,
    }
  );
  return response.data;
}

/**
 * Creates and registers a new turn for audio streaming.
 */
export function createTurn({
  turnId,
  voiceId = DEFAULT_VOICE_ID,
  modelId = 'eleven_flash_v2_5',
  voiceSettings,
  ttlMs = DEFAULT_TTL_MS,
  ttsFetcher = defaultTtsFetcher,
} = {}) {
  const id =
    turnId ||
    (crypto.randomUUID
      ? `turn_${crypto.randomUUID()}`
      : `turn_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  const now = Date.now();
  const turn = {
    turnId: id,
    createdAt: now,
    expiresAt: now + ttlMs,
    ttlMs,
    voiceId,
    modelId,
    voiceSettings,
    ttsFetcher,
    sentences: [],
    sentenceQueue: Promise.resolve(), // ensures sentences are synthesized in order
    inFlightCount: 0,
    isFinished: false,
    aborted: false,
    abortReason: null,
    firstAudioTime: null,
    audioChunks: [],
    listeners: new Set(),
    doneListeners: new Set(),
    abortListeners: new Set(),
    activeJobAbortController: null,
    error: null,
  };

  turns.set(id, turn);
  return turn;
}

/**
 * Retrieves an active turn by ID. Returns null if expired or missing.
 */
export function getTurn(turnId) {
  if (!turnId) return null;
  const turn = turns.get(turnId);
  if (!turn) return null;

  if (Date.now() > turn.expiresAt) {
    turns.delete(turnId);
    return null;
  }
  return turn;
}

/**
 * Aborts an active turn, cancelling in-flight synthesis and notifying listeners.
 */
export function abortTurn(turnId, reason = 'aborted') {
  const turn = turns.get(turnId);
  if (!turn || turn.aborted) return false;

  turn.aborted = true;
  turn.abortReason = reason;

  // Cancel any running Axios synthesis request
  if (turn.activeJobAbortController) {
    try {
      turn.activeJobAbortController.abort(new Error(`Turn aborted: ${reason}`));
    } catch {
      /* ignore */
    }
    turn.activeJobAbortController = null;
  }

  // Notify abort listeners (e.g., SSE / WebSocket / pipe response)
  for (const listener of turn.abortListeners) {
    try {
      listener(reason);
    } catch {
      /* ignore */
    }
  }
  turn.abortListeners.clear();
  turn.listeners.clear();
  turn.doneListeners.clear();

  return true;
}

/**
 * Enqueues a sentence to be synthesized and broadcast to listeners.
 */
export function addSentence(turnId, sentence) {
  const turn = getTurn(turnId);
  if (!turn || turn.aborted) return false;
  const text = String(sentence || '').trim();
  if (!text) return false;

  turn.sentences.push(text);
  turn.inFlightCount++;

  // Queue synthesis so sentences are processed and emitted in sequential order
  turn.sentenceQueue = turn.sentenceQueue
    .then(async () => {
      if (turn.aborted) return;

      const apiKey = getElevenLabsApiKey();
      if (!apiKey) {
        const err = new Error(
          'ElevenLabs API key is not set (expected ELEVENLABS_API_KEY or elevenLabsKey)'
        );
        err.status = 501;
        turn.error = err;
        return;
      }

      const jobAbortController = new AbortController();
      turn.activeJobAbortController = jobAbortController;

      try {
        const audioStream = await turn.ttsFetcher({
          text,
          voiceId: turn.voiceId,
          modelId: turn.modelId,
          voiceSettings: turn.voiceSettings,
          apiKey,
          signal: jobAbortController.signal,
          timeout: getTtsTimeoutMs(),
        });

        if (turn.aborted) {
          if (audioStream && typeof audioStream.destroy === 'function') {
            audioStream.destroy();
          }
          return;
        }

        await new Promise((resolve, reject) => {
          const onData = (chunk) => {
            if (turn.aborted) {
              if (audioStream && typeof audioStream.destroy === 'function') {
                audioStream.destroy();
              }
              return resolve();
            }
            if (turn.firstAudioTime === null) {
              turn.firstAudioTime = Date.now() - turn.createdAt;
            }
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            turn.audioChunks.push(buf);
            for (const listener of turn.listeners) {
              try {
                listener(buf);
              } catch {
                /* ignore write error */
              }
            }
          };

          audioStream.on('data', onData);
          audioStream.once('end', resolve);
          audioStream.once('error', (err) => {
            if (turn.aborted || jobAbortController.signal.aborted) {
              return resolve();
            }
            reject(err);
          });
        });
      } catch (err) {
        if (!turn.aborted && !jobAbortController.signal.aborted) {
          console.warn(`[TurnAudio] TTS synthesis failed for turn "${turnId}":`, err?.message || err);
          turn.error = err;
        }
      } finally {
        if (turn.activeJobAbortController === jobAbortController) {
          turn.activeJobAbortController = null;
        }
      }
    })
    .finally(() => {
      turn.inFlightCount--;
      if (!turn.aborted && turn.isFinished && turn.inFlightCount === 0) {
        for (const done of turn.doneListeners) {
          try {
            done();
          } catch {
            /* ignore */
          }
        }
      }
    });

  return true;
}

/**
 * Marks that no more sentences will be added to this turn.
 */
export function finishTurn(turnId) {
  const turn = getTurn(turnId);
  if (!turn) return false;

  turn.isFinished = true;
  if (!turn.aborted && turn.inFlightCount === 0) {
    for (const done of turn.doneListeners) {
      try {
        done();
      } catch {
        /* ignore */
      }
    }
  }
  return true;
}

/**
 * Pipes audio chunks of a turn to an Express response stream.
 */
export function pipeTurnAudio(turnId, res, req) {
  const turn = getTurn(turnId);
  if (!turn) {
    return { status: 404, error: 'Turn not found or expired' };
  }

  if (turn.aborted) {
    return { status: 410, error: 'Turn was aborted' };
  }

  // If no API key is available, report 501 immediately
  const apiKey = getElevenLabsApiKey();
  if (!apiKey) {
    return {
      status: 501,
      error: 'ElevenLabs API key is not set (expected ELEVENLABS_API_KEY or elevenLabsKey)',
    };
  }

  res.status(200);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store, no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Write existing buffered chunks
  for (const chunk of turn.audioChunks) {
    try {
      res.write(chunk);
    } catch {
      /* ignore client write errors */
    }
  }

  // If already finished and no in-flight synthesis, close immediately
  if (turn.isFinished && turn.inFlightCount === 0) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
    return { status: 200, done: true };
  }

  // Register real-time chunk and done listeners
  const onChunk = (chunk) => {
    try {
      res.write(chunk);
    } catch {
      /* ignore */
    }
  };

  const onDone = () => {
    try {
      res.end();
    } catch {
      /* ignore */
    }
    cleanup();
  };

  const onAbort = () => {
    try {
      res.end();
    } catch {
      /* ignore */
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

  if (req && typeof req.on === 'function') {
    req.on('close', cleanup);
  }
  if (res && typeof res.on === 'function') {
    res.on('close', cleanup);
  }

  return { status: 200, streaming: true };
}

/**
 * Removes all expired turns from memory.
 */
export function clearExpiredTurns() {
  const now = Date.now();
  let count = 0;
  for (const [id, turn] of turns.entries()) {
    if (now > turn.expiresAt) {
      turns.delete(id);
      count++;
    }
  }
  return count;
}

/**
 * Resets the entire turns map (useful for test isolation).
 */
export function resetTurns() {
  turns.clear();
}

/**
 * Returns the current count of active turns in memory.
 */
export function getActiveTurnCount() {
  return turns.size;
}

// Background sweep for expired turns every 10 seconds
const sweepInterval = setInterval(() => {
  clearExpiredTurns();
}, 10_000);

if (sweepInterval && typeof sweepInterval.unref === 'function') {
  sweepInterval.unref();
}
