import { API_BASE } from '../config/paths'
import { eventBus } from './eventBus'

if (typeof window !== 'undefined') {
  window.__chatEventBus = eventBus
}

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

/**
 * Stream Groq chat completion over SSE from /api/chat/stream.
 *
 * Calls callbacks as events arrive:
 * - onMeta({ npc, sessionId, caps })
 * - onDelta(chunkText, accumulatedText)
 *
 * Returns { reply, npc, sessionId, meta } on completion.
 */
export async function sendChatStream({
  npc,
  message,
  context,
  ragHints,
  sessionId,
  onMeta,
  onDelta,
  signal,
} = {}) {
  const effectiveSessionId = sessionId || getSessionId()
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc, message, context, ragHints, sessionId: effectiveSessionId }),
    signal,
  })

  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`Chat stream error: ${res.status} ${textErr}`)
  }

  if (!res.body) {
    throw new Error('Streaming not supported: no response body stream')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let meta = null
  let accumulated = ''
  let donePayload = null

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      let currentEvent = 'message'
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          currentEvent = 'message'
          continue
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.slice(6).trim()
          continue
        }
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim()
          let parsed = null
          try {
            parsed = JSON.parse(dataStr)
          } catch {
            continue
          }

          if (currentEvent === 'meta') {
            meta = parsed
            if (typeof onMeta === 'function') onMeta(parsed)
          } else if (currentEvent === 'delta') {
            const deltaText = parsed.text || ''
            accumulated += deltaText
            if (typeof onDelta === 'function') onDelta(deltaText, accumulated)
          } else if (currentEvent === 'done') {
            donePayload = parsed
          } else if (currentEvent === 'error') {
            throw new Error(parsed.error || 'Server stream error')
          }
        }
      }
    }
  } finally {
    reader.releaseLock?.()
  }

  const finalReply = donePayload?.reply ?? accumulated
  return {
    reply: finalReply,
    npc: donePayload?.npc || npc,
    sessionId: donePayload?.sessionId || effectiveSessionId,
    meta,
  }
}

/**
 * Sends a chat message with streaming, automatically falling back to
 * standard sendChat (/api/chat) if the stream encounters any error.
 */
export async function sendChatWithFallback({
  npc,
  message,
  context,
  ragHints,
  sessionId,
  onMeta,
  onDelta,
  signal,
} = {}) {
  try {
    return await sendChatStream({
      npc,
      message,
      context,
      ragHints,
      sessionId,
      onMeta,
      onDelta,
      signal,
    })
  } catch (streamErr) {
    console.warn('[ChatStream] streaming failed, falling back to /api/chat:', streamErr?.message || streamErr)
    const result = await sendChat({ npc, message, context, ragHints, sessionId })
    if (typeof onDelta === 'function' && result?.reply) {
      onDelta(result.reply, result.reply)
    }
    return result
  }
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
