const express = require('express')
const axios = require('axios')

const router = express.Router()

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'N2lVS1w4EtoT3dr4eOWO' // Callum

/**
 * POST /api/tts
 * Proxies ElevenLabs streaming TTS and pipes audio/mpeg chunks straight to the client.
 * Uses chunked transfer (no Content-Length) so the browser can begin playback early.
 */
router.post('/tts', async (req, res, next) => {
  let upstream = null
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

    // ElevenLabs streaming endpoint — returns audio bytes as they are generated
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`

    const response = await axios.post(
      url,
      {
        text,
        model_id: modelId,
        output_format: outputFormat,
        voice_settings: voiceSettings || {
          stability: 0.3,
          similarity_boost: 0.90,
          style: 0.5,
          speed: 1.1,
        },
      },
      {
        responseType: 'stream',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        timeout: 60000,
        // Validate status so we can surface ElevenLabs error bodies
        validateStatus: (s) => s >= 200 && s < 300,
      }
    )

    upstream = response.data

    // Stream headers for incremental client playback (Web Audio / MediaSource)
    res.status(200)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store, no-cache')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // Do not set Content-Length — Node will use chunked transfer for the pipe
    res.flushHeaders?.()

    const onClientClose = () => {
      try {
        if (upstream && typeof upstream.destroy === 'function') upstream.destroy()
      } catch { /* ignore */ }
    }
    req.on('close', onClientClose)
    res.on('close', onClientClose)

    upstream.on('error', (e) => {
      if (!res.headersSent) return next(e)
      try { res.end() } catch { /* ignore */ }
    })

    upstream.pipe(res)
  } catch (err) {
    // If headers already sent while piping, just end the response
    if (res.headersSent) {
      try { res.end() } catch { /* ignore */ }
      return
    }

    const status = err?.response?.status || err.status || 500
    const detailBuf = err?.response?.data
    let detail = ''
    try {
      if (detailBuf && typeof detailBuf.pipe === 'function') {
        // Stream error body — drain briefly
        const chunks = []
        await new Promise((resolve) => {
          detailBuf.on('data', (c) => chunks.push(c))
          detailBuf.on('end', resolve)
          detailBuf.on('error', resolve)
          setTimeout(resolve, 500)
        })
        detail = Buffer.concat(chunks).toString('utf8')
      } else {
        detail = Buffer.isBuffer(detailBuf)
          ? detailBuf.toString('utf8')
          : String(detailBuf || '')
      }
    } catch { /* ignore */ }

    err.message = `TTS request failed (${status})${detail ? `: ${detail}` : ''}`
    err.status = status
    return next(err)
  }
})

module.exports = router
