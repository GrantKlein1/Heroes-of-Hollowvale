/**
 * Actor State Machine with strict priority interruption hierarchy and 150 ms input buffer.
 *
 * Priority order:
 *   DEAD > TRANSITION > HURT > DODGE > ATTACK > BLOCK > WALK > IDLE
 *
 * Rules:
 * - A higher priority state interrupts a lower priority state immediately.
 * - A lower or equal priority state cannot interrupt an active state.
 * - If an action is requested while busy (lower/equal priority), it is buffered in a 150 ms window.
 * - When the active state finishes, if the buffered input was pressed <= 150 ms ago, it fires.
 *   If it was pressed > 150 ms ago (e.g. 151 ms), it expires and does not fire.
 */

export const ACTOR_STATES = Object.freeze({
  IDLE: 'IDLE',
  WALK: 'WALK',
  BLOCK: 'BLOCK',
  ATTACK: 'ATTACK',
  DODGE: 'DODGE',
  HURT: 'HURT',
  TRANSITION: 'TRANSITION',
  DEAD: 'DEAD',
})

export const STATE_PRIORITY = Object.freeze({
  IDLE: 0,
  WALK: 1,
  BLOCK: 2,
  ATTACK: 3,
  DODGE: 4,
  HURT: 5,
  TRANSITION: 6,
  DEAD: 7,
})

export const DEFAULT_BUFFER_WINDOW_MS = 150

/**
 * Normalizes state name to uppercase canonical format.
 *
 * @param {string} state
 * @returns {string}
 */
export function normalizeState(state) {
  if (typeof state !== 'string') return ACTOR_STATES.IDLE
  const upper = state.trim().toUpperCase()
  return STATE_PRIORITY[upper] !== undefined ? upper : upper
}

/**
 * Returns numeric priority for a state (-1 if unknown).
 *
 * @param {string} state
 * @returns {number}
 */
export function getStatePriority(state) {
  const norm = normalizeState(state)
  return STATE_PRIORITY[norm] ?? -1
}

export class StateMachine {
  /**
   * @param {string} [initialState=ACTOR_STATES.IDLE]
   * @param {object} [options]
   * @param {number} [options.bufferWindowMs=150] - Buffer window in milliseconds
   * @param {string} [options.defaultState=ACTOR_STATES.IDLE] - Fallback state when action finishes without buffer
   * @param {number} [options.duration] - Duration of initial state in ms
   * @param {number} [options.startTime=0] - Initial start time
   */
  constructor(initialState = ACTOR_STATES.IDLE, options = {}) {
    this.bufferWindowMs = typeof options.bufferWindowMs === 'number'
      ? options.bufferWindowMs
      : DEFAULT_BUFFER_WINDOW_MS

    this.defaultState = normalizeState(options.defaultState || ACTOR_STATES.IDLE)
    this.state = normalizeState(initialState)

    this.stateStartTime = options.startTime ?? 0
    this.stateDuration = typeof options.duration === 'number' ? options.duration : null
    this.stateEndTime = this.stateDuration != null ? this.stateStartTime + this.stateDuration : null

    this.bufferedInput = null
    this.listeners = new Set()
  }

  /**
   * Checks whether targetState has strictly higher priority than fromState.
   *
   * @param {string} targetState
   * @param {string} [fromState=this.state]
   * @returns {boolean}
   */
  canInterrupt(targetState, fromState = this.state) {
    const fromPrio = getStatePriority(fromState)
    const targetPrio = getStatePriority(targetState)
    return targetPrio > fromPrio
  }

  /**
   * Attempts to transition to targetState.
   *
   * If targetState has higher priority, interrupts immediately.
   * If targetState has lower/equal priority, rejects transition and buffers input (unless options.buffer === false).
   * If options.force === true, transitions regardless of priority.
   *
   * @param {string} targetState
   * @param {object} [options]
   * @param {number} [options.time] - Timestamp of request (ms)
   * @param {number} [options.duration] - Duration of new state (ms)
   * @param {boolean} [options.force=false] - Bypass priority check
   * @param {boolean} [options.buffer=true] - Buffer input if interrupted check fails
   * @returns {boolean} - True if transition was executed immediately
   */
  transition(targetState, options = {}) {
    const res = this.requestState(targetState, options)
    return res.success
  }

  /**
   * Requests a state transition with detailed result metadata.
   *
   * @param {string} targetState
   * @param {object} [options]
   * @returns {{ success: boolean, interrupted: boolean, buffered: boolean, forced?: boolean }}
   */
  requestState(targetState, options = {}) {
    const normalizedTarget = normalizeState(targetState)
    const time = options.time ?? options.timestamp ?? Date.now()

    // 1. Force override
    if (options.force === true) {
      this._enterState(normalizedTarget, { ...options, time })
      return { success: true, interrupted: true, buffered: false, forced: true }
    }

    // 2. Higher priority interrupts lower
    if (this.canInterrupt(normalizedTarget, this.state)) {
      this._enterState(normalizedTarget, { ...options, time })
      return { success: true, interrupted: true, buffered: false }
    }

    // 3. Lower or equal priority cannot interrupt. Buffer if enabled.
    if (options.buffer !== false) {
      this.bufferInput(normalizedTarget, time, options)
      return { success: false, interrupted: false, buffered: true }
    }

    return { success: false, interrupted: false, buffered: false }
  }

  /**
   * Directly sets the current state (convenience / initialization).
   *
   * @param {string} newState
   * @param {object} [options]
   * @returns {string}
   */
  setState(newState, options = {}) {
    return this._enterState(normalizeState(newState), options)
  }

  /**
   * Stores an action in the input buffer.
   *
   * @param {string} inputState
   * @param {number} [time=Date.now()]
   * @param {object} [options={}]
   */
  bufferInput(inputState, time = Date.now(), options = {}) {
    this.bufferedInput = {
      state: normalizeState(inputState),
      time,
      options,
    }
  }

  /**
   * Clears the current buffered input.
   */
  clearBuffer() {
    this.bufferedInput = null
  }

  /**
   * Inspects the current buffered input without consuming it.
   * Returns null if no input is buffered or if it has expired past the buffer window.
   *
   * @param {number} [currentTime=Date.now()]
   * @returns {{ state: string, time: number, options: object } | null}
   */
  getBufferedInput(currentTime = Date.now()) {
    if (!this.bufferedInput) return null
    const age = currentTime - this.bufferedInput.time
    if (age < 0 || age > this.bufferWindowMs) {
      return null
    }
    return this.bufferedInput
  }

  /**
   * Consumes and clears the buffered input if within the valid buffer window.
   * Rule: age <= bufferWindowMs fires; age > bufferWindowMs does not.
   *
   * @param {number} [currentTime=Date.now()]
   * @returns {{ state: string, time: number, options: object } | null}
   */
  consumeBuffer(currentTime = Date.now()) {
    if (!this.bufferedInput) return null

    const age = currentTime - this.bufferedInput.time
    const buffered = this.bufferedInput
    this.bufferedInput = null

    // Valid if 0 <= age <= bufferWindowMs (e.g. 150 ms early fires, 151 ms does not)
    if (age >= 0 && age <= this.bufferWindowMs) {
      return buffered
    }

    return null
  }

  /**
   * Finishes the current active state.
   * If a valid buffered input exists within the buffer window, transitions to it.
   * Otherwise transitions to defaultState (IDLE).
   *
   * @param {number} [currentTime=Date.now()]
   * @returns {string} - The resulting active state
   */
  finishCurrentState(currentTime = Date.now()) {
    const buffered = this.consumeBuffer(currentTime)
    if (buffered) {
      this._enterState(buffered.state, { ...buffered.options, time: currentTime })
      return this.state
    }

    this._enterState(this.defaultState, { time: currentTime })
    return this.state
  }

  /**
   * Updates state timer. If state duration has elapsed, finishes the current state.
   *
   * @param {number} [currentTime=Date.now()]
   * @param {number} [delta=0]
   * @returns {string} - Active state
   */
  update(currentTime = Date.now(), delta = 0) {
    if (this.stateEndTime !== null && currentTime >= this.stateEndTime) {
      return this.finishCurrentState(currentTime)
    }
    return this.state
  }

  /**
   * Subscribes a listener callback to state changes.
   *
   * @param {(nextState: string, prevState: string, options: object) => void} listener
   * @returns {() => void} - Unsubscribe function
   */
  onEnter(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Checks if current state equals given state (case-insensitive).
   *
   * @param {string} state
   * @returns {boolean}
   */
  is(state) {
    return this.state === normalizeState(state)
  }

  /**
   * Numeric priority of active state.
   *
   * @returns {number}
   */
  get priority() {
    return getStatePriority(this.state)
  }

  /** @private */
  _enterState(newState, options = {}) {
    const previousState = this.state
    this.state = newState
    this.stateStartTime = options.time ?? options.startTime ?? Date.now()
    this.stateDuration = typeof options.duration === 'number' ? options.duration : null
    this.stateEndTime = this.stateDuration != null ? this.stateStartTime + this.stateDuration : null

    for (const listener of this.listeners) {
      try {
        listener(this.state, previousState, options)
      } catch (err) {
        console.error('[StateMachine] Listener error:', err)
      }
    }

    return this.state
  }
}

