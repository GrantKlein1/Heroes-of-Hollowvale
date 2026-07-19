import { API_BASE } from '../config/paths'

const DEFAULT_TIMEOUT_MS = 30000

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timerId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timerId)
  }
}

function postJson(path, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {})
    },
    timeoutMs
  )
}

export async function sendChat({ npc, message, context, ragHints }) {
  const res = await postJson('/chat', { npc, message, context, ragHints })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchTTS({ text, voiceId, modelId, outputFormat } = {}) {
  const res = await postJson('/tts', { text, voiceId, modelId, outputFormat }, 45000)
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS error: ${res.status} ${textErr}`)
  }
  // Return audio blob (mp3)
  const blob = await res.blob()
  return blob
}

// Stream TTS audio (chunked) and return the ReadableStream of audio bytes
export async function streamTTS({ text, voiceId, modelId, outputFormat } = {}) {
  const res = await postJson('/tts', { text, voiceId, modelId, outputFormat }, 45000)
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS error: ${res.status} ${textErr}`)
  }
  if (!res.body) throw new Error('Streaming not supported: no response body stream')
  return res.body
}
