/**
 * Web Audio SFX engine — preloads buffers and plays instant / overlapping SFX.
 * Stand-in for Phaser Sound Manager / Howler in this React+Canvas game.
 */

const DEFAULT_POOL = 4

class SfxEngine {
  constructor() {
    this._ctx = null
    this._master = null
    this._buffers = new Map()
    this._loading = new Map()
    this._volume = 0.7
    this._enabled = true
    this._unlocked = false
  }

  get context() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this._ctx = new AC()
      this._master = this._ctx.createGain()
      this._master.gain.value = this._volume
      this._master.connect(this._ctx.destination)
    }
    return this._ctx
  }

  async unlock() {
    const ctx = this.context
    if (!ctx) return false
    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch { /* ignore */ }
    }
    this._unlocked = ctx.state === 'running'
    return this._unlocked
  }

  setVolume(vol01) {
    this._volume = Math.max(0, Math.min(1, Number(vol01) || 0))
    if (this._master) this._master.gain.value = this._volume
  }

  setEnabled(on) {
    this._enabled = !!on
  }

  /**
   * Preload a map of { id: url }. Resolves when all succeed or fail (fail-soft).
   */
  async preload(manifest = {}) {
    const ctx = this.context
    if (!ctx) return { loaded: [], failed: Object.keys(manifest) }

    const entries = Object.entries(manifest).filter(([, url]) => !!url)
    const loaded = []
    const failed = []

    await Promise.all(entries.map(async ([id, url]) => {
      try {
        await this.load(id, url)
        loaded.push(id)
      } catch {
        failed.push(id)
      }
    }))

    return { loaded, failed }
  }

  async load(id, url) {
    if (this._buffers.has(id)) return this._buffers.get(id)
    if (this._loading.has(id)) return this._loading.get(id)

    const promise = (async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`SFX fetch failed: ${id} ${res.status}`)
      const arr = await res.arrayBuffer()
      const ctx = this.context
      if (!ctx) throw new Error('No AudioContext')
      const buffer = await ctx.decodeAudioData(arr.slice(0))
      this._buffers.set(id, buffer)
      this._loading.delete(id)
      return buffer
    })()

    this._loading.set(id, promise)
    return promise
  }

  /**
   * Play a preloaded (or lazily loaded) SFX by id.
   * @returns {AudioBufferSourceNode|null}
   */
  play(id, { volume = 1, playbackRate = 1, detune = 0 } = {}) {
    if (!this._enabled || !id) return null
    const ctx = this.context
    if (!ctx || !this._master) return null

    const buffer = this._buffers.get(id)
    if (!buffer) {
      // Fire-and-forget lazy load then play once ready (no await in hot path)
      const pending = this._loading.get(id)
      if (pending) {
        pending.then(() => this.play(id, { volume, playbackRate, detune })).catch(() => {})
      }
      return null
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = playbackRate
    if (typeof src.detune !== 'undefined') src.detune.value = detune

    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, volume))
    src.connect(gain)
    gain.connect(this._master)
    try {
      src.start(0)
    } catch {
      return null
    }
    src.onended = () => {
      try { src.disconnect() } catch {}
      try { gain.disconnect() } catch {}
    }
    return src
  }

  /** True if a buffer is ready for instant playback */
  has(id) {
    return this._buffers.has(id)
  }

  /** How many buffers are currently loaded (for diagnostics) */
  get loadedCount() {
    return this._buffers.size
  }
}

/** Singleton used by MainGameScene + React */
export const sfxEngine = new SfxEngine()

/** Stable SFX ids used across the game */
export const SFX = {
  FOOTSTEP: 'footstep',
  DOOR_OPEN: 'door_open',
  HIT: 'hit',
  SPELL_CAST: 'spell_cast',
  FIRE_IMPACT: 'fire_impact',
  MELEE_SWING: 'melee_swing',
}

export default sfxEngine
