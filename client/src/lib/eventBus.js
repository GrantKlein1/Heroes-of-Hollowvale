/**
 * Lightweight pub/sub bus bridging the canvas game loop and React UI.
 * Used for NPC interactions, dialogue TTS, and optional SFX cues.
 */
class EventBus {
  constructor() {
    this._listeners = new Map()
  }

  on(event, handler) {
    if (!event || typeof handler !== 'function') return () => {}
    let set = this._listeners.get(event)
    if (!set) {
      set = new Set()
      this._listeners.set(event, set)
    }
    set.add(handler)
    return () => this.off(event, handler)
  }

  once(event, handler) {
    const wrap = (payload) => {
      this.off(event, wrap)
      handler(payload)
    }
    return this.on(event, wrap)
  }

  off(event, handler) {
    const set = this._listeners.get(event)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) this._listeners.delete(event)
  }

  emit(event, payload) {
    const set = this._listeners.get(event)
    if (!set || set.size === 0) return
    // Copy so handlers can safely unsubscribe during emit
    for (const handler of [...set]) {
      try {
        handler(payload)
      } catch (err) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
          console.warn(`[EventBus] handler error for "${event}":`, err)
        }
      }
    }
  }

  clear(event) {
    if (event) this._listeners.delete(event)
    else this._listeners.clear()
  }
}

export const eventBus = new EventBus()

/** Well-known event names */
export const GameEvents = {
  NPC_INTERACT: 'npc:interact',
  NPC_DIALOGUE: 'npc:dialogue',
  NPC_SPEAK: 'npc:speak',
  CHAT_CLOSE: 'chat:close',
  SFX_PLAY: 'sfx:play',
  SCENE_CHANGE: 'scene:change',
}

export default eventBus
