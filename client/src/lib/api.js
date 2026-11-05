import { API_BASE } from '../config/paths'

export function getSessionId() {
  try {
    let id = localStorage.getItem('sessionId')
    if (!id) {
      id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `session_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      localStorage.setItem('sessionId', id)
    }
    return id
  } catch {
    return 'session_fallback'
  }
}

export async function sendChat({ npc, message, context, ragHints, sessionId }) {
  const effectiveSessionId = sessionId || getSessionId()
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc, message, context, ragHints, sessionId: effectiveSessionId })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchTTS({ text, voiceId, modelId, outputFormat, signal } = {}) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, modelId, outputFormat }),
    signal,
  })
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS error: ${res.status} ${textErr}`)
  }
  // Return audio blob (mp3) — legacy full-download path
  const blob = await res.blob()
  return blob
}

/**
 * Stream TTS audio chunks from the ElevenLabs proxy.
 * Returns the Response body ReadableStream (audio/mpeg) for Web Audio playback.
 */
export async function streamTTS({ text, voiceId, modelId, outputFormat, signal } = {}) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, modelId, outputFormat }),
    signal,
  })
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS error: ${res.status} ${textErr}`)
  }
  if (!res.body) throw new Error('Streaming not supported: no response body stream')
  return res.body
}
