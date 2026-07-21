/**
 * Streaming TTS playback via the Web Audio API.
 *
 * Prefers MediaSource chunked MP3 (low latency) routed through AudioContext.
 * Falls back to accumulating the ReadableStream then decodeAudioData — still
 * a single network request (no second blob round-trip when the stream is reused).
 */

let sharedCtx = null
let sharedGain = null
let currentStop = null

function getAudioGraph() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) {
    sharedCtx = new AC()
    sharedGain = sharedCtx.createGain()
    sharedGain.connect(sharedCtx.destination)
  }
  return { ctx: sharedCtx, gain: sharedGain }
}

export async function unlockTtsAudio() {
  const g = getAudioGraph()
  if (!g) return false
  if (g.ctx.state === 'suspended') {
    try { await g.ctx.resume() } catch { return false }
  }
  return g.ctx.state === 'running'
}

export function setTtsPlayerVolume(vol01) {
  const g = getAudioGraph()
  if (g) g.gain.gain.value = Math.max(0, Math.min(1, Number(vol01) || 0))
}

/** Stop any in-flight streamed utterance */
export function stopTtsPlayback() {
  if (typeof currentStop === 'function') {
    try { currentStop() } catch { /* ignore */ }
  }
  currentStop = null
}

function canUseMediaSource(mime = 'audio/mpeg') {
  return typeof window !== 'undefined'
    && typeof window.MediaSource !== 'undefined'
    && typeof window.MediaSource.isTypeSupported === 'function'
    && window.MediaSource.isTypeSupported(mime)
}

/**
 * Play a fetch ReadableStream of audio/mpeg through Web Audio.
 * @param {ReadableStream} readableStream
 * @param {{ mime?: string, volume?: number, signal?: AbortSignal }} opts
 */
export async function playStreamingAudio(readableStream, {
  mime = 'audio/mpeg',
  volume = 1.0,
  signal,
} = {}) {
  stopTtsPlayback()

  const graph = getAudioGraph()
  if (!graph) throw new Error('Web Audio API unavailable')
  if (graph.ctx.state === 'suspended') {
    try { await graph.ctx.resume() } catch { /* ignore */ }
  }
  graph.gain.gain.value = Math.max(0, Math.min(1, volume))

  if (canUseMediaSource(mime)) {
    try {
      return await playViaMediaSource(readableStream, { mime, graph, signal })
    } catch (err) {
      // Fall through to decode path; caller may have already consumed the stream.
      // If the stream was partially read, MediaSource path owns cleanup.
      if (signal?.aborted) throw err
      throw err
    }
  }

  return playViaDecode(readableStream, { mime, graph, signal })
}

async function playViaMediaSource(readableStream, { mime, graph, signal }) {
  const { ctx, gain } = graph

  return new Promise((resolve, reject) => {
    const mediaSource = new MediaSource()
    const objectUrl = URL.createObjectURL(mediaSource)
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = objectUrl

    // Route HTMLMediaElement into the shared Web Audio graph
    let elementSource = null
    try {
      elementSource = ctx.createMediaElementSource(audio)
      elementSource.connect(gain)
    } catch (e) {
      // createMediaElementSource can only be called once per element; ignore
    }

    let sourceBuffer = null
    let reader = null
    const queue = []
    let streamEnded = false
    let settled = false
    let aborted = false

    const cleanup = () => {
      try { reader?.cancel?.() } catch {}
      try { URL.revokeObjectURL(objectUrl) } catch {}
      try { audio.pause() } catch {}
      try { audio.removeAttribute('src'); audio.load() } catch {}
      try { elementSource?.disconnect() } catch {}
    }

    const finish = (err) => {
      if (settled) return
      settled = true
      if (currentStop === stop) currentStop = null
      cleanup()
      if (err) reject(err)
      else resolve()
    }

    const stop = () => {
      aborted = true
      finish(signal?.aborted ? new DOMException('Aborted', 'AbortError') : undefined)
    }
    currentStop = stop

    const onAbort = () => stop()
    signal?.addEventListener?.('abort', onAbort, { once: true })

    const feed = () => {
      if (aborted || !sourceBuffer || sourceBuffer.updating) return
      const chunk = queue.shift()
      if (chunk) {
        try {
          sourceBuffer.appendBuffer(chunk)
        } catch (e) {
          finish(e)
        }
      } else if (streamEnded && mediaSource.readyState === 'open') {
        try { mediaSource.endOfStream() } catch { /* ignore */ }
      }
    }

    mediaSource.addEventListener('sourceopen', async () => {
      try {
        sourceBuffer = mediaSource.addSourceBuffer(mime)
        sourceBuffer.addEventListener('updateend', feed)
        reader = readableStream.getReader()

        // Kick playback as soon as the element has data
        const playP = audio.play()
        if (playP?.catch) playP.catch(() => { /* gesture / autoplay */ })

        while (!aborted) {
          const { value, done } = await reader.read()
          if (done) {
            streamEnded = true
            feed()
            break
          }
          const chunk = value instanceof Uint8Array
            ? value
            : new Uint8Array(value?.buffer || value || [])
          // Copy — SourceBuffer may hold the ArrayBuffer
          queue.push(chunk.slice(0))
          feed()
        }
      } catch (e) {
        finish(e)
      }
    }, { once: true })

    audio.addEventListener('ended', () => finish(), { once: true })
    audio.addEventListener('error', () => finish(new Error('Audio element error')), { once: true })
  })
}

/**
 * Accumulate stream bytes, decode with Web Audio, play the buffer.
 * Single request — no second TTS fetch.
 */
async function playViaDecode(readableStream, { graph, signal }) {
  const { ctx, gain } = graph
  const reader = readableStream.getReader()
  const chunks = []
  let total = 0

  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }

  while (true) {
    checkAbort()
    const { value, done } = await reader.read()
    if (done) break
    const chunk = value instanceof Uint8Array
      ? value
      : new Uint8Array(value?.buffer || value || [])
    chunks.push(chunk)
    total += chunk.byteLength
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }

  checkAbort()
  const audioBuffer = await ctx.decodeAudioData(merged.buffer.slice(0))
  checkAbort()

  return new Promise((resolve, reject) => {
    const src = ctx.createBufferSource()
    src.buffer = audioBuffer
    src.connect(gain)

    let settled = false
    const finish = (err) => {
      if (settled) return
      settled = true
      if (currentStop === stop) currentStop = null
      try { src.stop() } catch {}
      try { src.disconnect() } catch {}
      if (err) reject(err)
      else resolve()
    }

    const stop = () => {
      finish(signal?.aborted ? new DOMException('Aborted', 'AbortError') : undefined)
    }
    currentStop = stop
    signal?.addEventListener?.('abort', stop, { once: true })

    src.onended = () => finish()
    try {
      src.start(0)
    } catch (e) {
      finish(e)
    }
  })
}

export default {
  playStreamingAudio,
  stopTtsPlayback,
  setTtsPlayerVolume,
  unlockTtsAudio,
}
