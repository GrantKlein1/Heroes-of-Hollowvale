/**
 * Resolve API credentials, accepting both local .env names and
 * Cursor Cloud secret names (camelCase) from the environment panel.
 */
function firstDefined(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export function getElevenLabsApiKey() {
  return firstDefined(
    process.env.ELEVENLABS_API_KEY,
    process.env.elevenLabsKey,
    process.env.ELEVEN_LABS_API_KEY,
    process.env.XI_API_KEY,
  )
}

export function getElevenLabsVoiceId() {
  return firstDefined(
    process.env.ELEVENLABS_VOICE_ID,
    process.env.elevenLabsVoiceId,
  )
}

export function getGroqApiKey() {
  return firstDefined(
    process.env.GROQ_API_KEY,
    process.env.groqCloudKey,
    process.env.GROQ_CLOUD_KEY,
  )
}
