const express = require('express')
const http = require('http')
const https = require('https')
const axios = require('axios')

const router = express.Router()

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'N2lVS1w4EtoT3dr4eOWO' // Callum
const MAX_TTS_TEXT_LENGTH = Number(process.env.MAX_TTS_TEXT_LENGTH || 2000)

const elevenlabsHttp = axios.create({
  timeout: 30000,
  responseType: 'stream',
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
})

// POST /api/tts -> returns MP3 audio for given text using ElevenLabs
router.post('/tts', async (req, res, next) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      const err = new Error('ELEVENLABS_API_KEY is not set on the server')
      err.status = 501
      throw err
    }

    const {
      text,
      voiceId = DEFAULT_VOICE_ID,
      modelId = 'eleven_flash_v2_5',
      outputFormat = 'mp3_44100_128',
      voiceSettings,
    } = req.body || {}

    if (!text || typeof text !== 'string') {
      const err = new Error('Missing required field: text')
      err.status = 400
      throw err
    }
    if (text.length > MAX_TTS_TEXT_LENGTH) {
      const err = new Error(`Text too long for TTS (max ${MAX_TTS_TEXT_LENGTH} characters)`)
      err.status = 400
      throw err
    }

    // Stream endpoint returns audio bytes directly
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`

    // Stream response directly without buffering to enable incremental playback in the client
    const response = await elevenlabsHttp.post(
      url,
      {
        text,
        model_id: modelId,
        output_format: outputFormat,
        voice_settings: voiceSettings || { stability: 0.3, similarity_boost: 0.90, style: 0.5, speed: 1.1 },
      },
      {
        responseType: 'stream',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
      }
    )

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    // Do not set Content-Length to allow chunked transfer encoding
    const upstream = response.data
    const cleanup = () => {
      try {
        if (upstream && !upstream.destroyed) upstream.destroy()
      } catch {}
    }
    req.on('close', cleanup)
    res.on('close', cleanup)
    upstream.on('error', (e) => next(e))
    upstream.pipe(res)
    return
  } catch (err) {
    const status = err?.response?.status || err.status || 500
    const detailBuf = err?.response?.data
    let detail = ''
    try { detail = Buffer.isBuffer(detailBuf) ? detailBuf.toString('utf8') : String(detailBuf || '') } catch {}
    err.message = `TTS request failed (${status})${detail ? `: ${detail}` : ''}`
    err.status = status
    return next(err)
  }
})

module.exports = router
