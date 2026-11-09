/**
 * React helper: speak NPC dialogue via streaming ElevenLabs TTS (Web Audio).
 * Used by Game.jsx when EventBus fires npc:speak / after chat replies.
 */

import { API_BASE } from '../config/paths'
import { streamTTS } from './api'
import { playStreamingAudio, stopTtsPlayback, setTtsPlayerVolume, unlockTtsAudio } from './ttsPlayer'

let activeAbort = null

/**
 * Fetch streaming audio body for an active turn (Option B per-sentence streaming).
 * Returns ReadableStream or null if ElevenLabs is not configured (HTTP 501).
 */
export async function streamTurnTTS({ turnId, signal } = {}) {
  if (!turnId) return null
  const res = await fetch(`${API_BASE}/tts/turn/${turnId}`, { signal })
  if (res.status === 501) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.info('[TTS] ElevenLabs API key not configured (501); voice playback skipped.')
    }
    return null
  }
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS turn error: ${res.status} ${textErr}`)
  }
  if (!res.body) {
    throw new Error('Streaming not supported: no response body stream')
  }
  return res.body
}

/**
 * Play streaming audio for a given turn ID (Option B).
 */
export async function speakTurnAudio(turnId, {
  volume = 1,
  enabled = true,
  signal: externalSignal,
} = {}) {
  if (!enabled || !turnId) return

  // Cancel prior request + playback
  try { activeAbort?.abort() } catch { /* ignore */ }
  stopTtsPlayback()
  activeAbort = new AbortController()
  const { signal } = activeAbort

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => {
      try { activeAbort?.abort() } catch { /* ignore */ }
    })
  }

  await unlockTtsAudio()
  setTtsPlayerVolume(volume)

  try {
    const bodyStream = await streamTurnTTS({ turnId, signal })
    if (!bodyStream) return // 501 or empty stream handled gracefully

    await playStreamingAudio(bodyStream, {
      mime: 'audio/mpeg',
      volume,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError' || signal.aborted) return
    // Handle 501 gracefully if surfaced in error
    if (err?.status === 501 || String(err?.message || '').includes('501')) {
      return
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn('[TTS] turn audio playback failed:', err?.message || err)
    }
    throw err
  }
}

/**
 * Stream and play a line of NPC dialogue.
 * Supports both turnId (Option B per-sentence streaming) and raw text.
 * Aborts any previous utterance so overlapping replies don't stack.
 */
export async function speakNpcDialogue(text, {
  voiceId,
  volume = 1,
  enabled = true,
  turnId,
} = {}) {
  if (!enabled) return

  if (turnId) {
    return speakTurnAudio(turnId, { volume, enabled })
  }

  if (!text || typeof text !== 'string') return

  // Cancel prior request + playback
  try { activeAbort?.abort() } catch { /* ignore */ }
  stopTtsPlayback()
  activeAbort = new AbortController()
  const { signal } = activeAbort

  await unlockTtsAudio()
  setTtsPlayerVolume(volume)

  try {
    const bodyStream = await streamTTS({ text, voiceId, signal })
    await playStreamingAudio(bodyStream, {
      mime: 'audio/mpeg',
      volume,
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError' || signal.aborted) return
    // Without ELEVENLABS_API_KEY the game still works (501 handled)
    if (err?.status === 501 || String(err?.message || '').includes('501')) {
      return
    }
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn('[TTS] stream playback failed:', err?.message || err)
    }
    throw err
  }
}

export function cancelNpcSpeech() {
  try { activeAbort?.abort() } catch { /* ignore */ }
  activeAbort = null
  stopTtsPlayback()
}

export default { speakNpcDialogue, speakTurnAudio, cancelNpcSpeech, streamTurnTTS }
