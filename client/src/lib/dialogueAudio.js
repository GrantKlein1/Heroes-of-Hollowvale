/**
 * React helper: speak NPC dialogue via streaming ElevenLabs TTS (Web Audio).
 * Used by DialogueModal when Phaser EventBus fires npc:speak / chat replies.
 */

import { streamTTS } from './api'
import { playStreamingAudio, stopTtsPlayback, setTtsPlayerVolume, unlockTtsAudio } from './ttsPlayer'

let activeAbort = null

/**
 * Stream and play a line of NPC dialogue.
 * Aborts any previous utterance so overlapping replies don't stack.
 */
export async function speakNpcDialogue(text, {
  voiceId,
  volume = 1,
  enabled = true,
} = {}) {
  if (!enabled || !text || typeof text !== 'string') return

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

export default { speakNpcDialogue, cancelNpcSpeech }
