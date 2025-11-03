import { API_BASE } from '../config/paths'

export async function sendChat({ npc, message, context, ragHints }) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc, message, context, ragHints })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchTTS({ text, voiceId, modelId, outputFormat } = {}) {
  const res = await fetch(`${API_BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, modelId, outputFormat })
  })
  if (!res.ok) {
    const textErr = await res.text().catch(() => '')
    throw new Error(`TTS error: ${res.status} ${textErr}`)
  }
  // Return audio blob (mp3)
  const blob = await res.blob()
  return blob
}
