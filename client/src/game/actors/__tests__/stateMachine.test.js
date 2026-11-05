import { describe, it, expect, vi } from 'vitest'
import {
  StateMachine,
  ACTOR_STATES,
  STATE_PRIORITY,
  getStatePriority,
  normalizeState,
  DEFAULT_BUFFER_WINDOW_MS,
} from '../stateMachine.js'

describe('Actor Priority State Machine & Input Buffer (stateMachine.js)', () => {
  describe('Priority hierarchy structure', () => {
    it('strictly satisfies priority order DEAD > TRANSITION > HURT > DODGE > ATTACK > BLOCK > WALK > IDLE', () => {
      const order = [
        ACTOR_STATES.IDLE,
        ACTOR_STATES.WALK,
        ACTOR_STATES.BLOCK,
        ACTOR_STATES.ATTACK,
        ACTOR_STATES.DODGE,
        ACTOR_STATES.HURT,
        ACTOR_STATES.TRANSITION,
        ACTOR_STATES.DEAD,
      ]

      for (let i = 0; i < order.length - 1; i++) {
        const lower = order[i]
        const higher = order[i + 1]
        expect(getStatePriority(higher)).toBeGreaterThan(getStatePriority(lower))
      }

      expect(STATE_PRIORITY.IDLE).toBe(0)
      expect(STATE_PRIORITY.WALK).toBe(1)
      expect(STATE_PRIORITY.BLOCK).toBe(2)
      expect(STATE_PRIORITY.ATTACK).toBe(3)
      expect(STATE_PRIORITY.DODGE).toBe(4)
      expect(STATE_PRIORITY.HURT).toBe(5)
      expect(STATE_PRIORITY.TRANSITION).toBe(6)
      expect(STATE_PRIORITY.DEAD).toBe(7)
    })

    it('normalizes state names case-insensitively', () => {
      expect(normalizeState('idle')).toBe('IDLE')
      expect(normalizeState('Attack')).toBe('ATTACK')
      expect(normalizeState('DODGE')).toBe('DODGE')
      expect(normalizeState(' dead ')).toBe('DEAD')
    })
  })

  describe('Acceptance Criterion 2: higher priority state interrupts lower, not vice versa', () => {
    it('allows higher priority states to interrupt lower priority states', () => {
      const sm = new StateMachine('IDLE')
      expect(sm.state).toBe('IDLE')

      // WALK (1) interrupts IDLE (0)
      expect(sm.transition('WALK')).toBe(true)
      expect(sm.state).toBe('WALK')

      // BLOCK (2) interrupts WALK (1)
      expect(sm.transition('BLOCK')).toBe(true)
      expect(sm.state).toBe('BLOCK')

      // ATTACK (3) interrupts BLOCK (2)
      expect(sm.transition('ATTACK')).toBe(true)
      expect(sm.state).toBe('ATTACK')

      // DODGE (4) interrupts ATTACK (3)
      expect(sm.transition('DODGE')).toBe(true)
      expect(sm.state).toBe('DODGE')

      // HURT (5) interrupts DODGE (4)
      expect(sm.transition('HURT')).toBe(true)
      expect(sm.state).toBe('HURT')

      // TRANSITION (6) interrupts HURT (5)
      expect(sm.transition('TRANSITION')).toBe(true)
      expect(sm.state).toBe('TRANSITION')

      // DEAD (7) interrupts TRANSITION (6)
      expect(sm.transition('DEAD')).toBe(true)
      expect(sm.state).toBe('DEAD')
    })

    it('rejects lower priority states from interrupting higher priority states', () => {
      const sm = new StateMachine('ATTACK')
      expect(sm.state).toBe('ATTACK')

      // WALK (1) cannot interrupt ATTACK (3)
      expect(sm.transition('WALK')).toBe(false)
      expect(sm.state).toBe('ATTACK')

      // BLOCK (2) cannot interrupt ATTACK (3)
      expect(sm.transition('BLOCK')).toBe(false)
      expect(sm.state).toBe('ATTACK')

      // IDLE (0) cannot interrupt ATTACK (3)
      expect(sm.transition('IDLE')).toBe(false)
      expect(sm.state).toBe('ATTACK')

      // Switch to DODGE (4)
      expect(sm.transition('DODGE')).toBe(true)
      expect(sm.state).toBe('DODGE')

      // ATTACK (3) cannot interrupt DODGE (4)
      expect(sm.transition('ATTACK')).toBe(false)
      expect(sm.state).toBe('DODGE')

      // Switch to DEAD (7)
      expect(sm.transition('DEAD')).toBe(true)
      expect(sm.state).toBe('DEAD')

      // Nothing can interrupt DEAD (7)
      expect(sm.transition('TRANSITION')).toBe(false)
      expect(sm.transition('HURT')).toBe(false)
      expect(sm.transition('DODGE')).toBe(false)
      expect(sm.transition('ATTACK')).toBe(false)
      expect(sm.transition('WALK')).toBe(false)
      expect(sm.transition('IDLE')).toBe(false)
      expect(sm.state).toBe('DEAD')
    })

    it('rejects equal priority states from interrupting via priority check', () => {
      const sm = new StateMachine('ATTACK')
      expect(sm.canInterrupt('ATTACK')).toBe(false)
      expect(sm.transition('ATTACK')).toBe(false)
      expect(sm.state).toBe('ATTACK')
    })

    it('canInterrupt returns true only when target priority is strictly greater', () => {
      const sm = new StateMachine('ATTACK') // Priority 3
      expect(sm.canInterrupt('IDLE')).toBe(false)
      expect(sm.canInterrupt('WALK')).toBe(false)
      expect(sm.canInterrupt('BLOCK')).toBe(false)
      expect(sm.canInterrupt('ATTACK')).toBe(false)
      expect(sm.canInterrupt('DODGE')).toBe(true)
      expect(sm.canInterrupt('HURT')).toBe(true)
      expect(sm.canInterrupt('TRANSITION')).toBe(true)
      expect(sm.canInterrupt('DEAD')).toBe(true)
    })

    it('supports forced transitions when options.force is set', () => {
      const sm = new StateMachine('DEAD')
      expect(sm.state).toBe('DEAD')

      // Normal transition rejected
      expect(sm.transition('IDLE')).toBe(false)
      expect(sm.state).toBe('DEAD')

      // Forced transition (e.g. Respawn)
      expect(sm.transition('IDLE', { force: true })).toBe(true)
      expect(sm.state).toBe('IDLE')
    })
  })

  describe('Acceptance Criterion 3: input pressed 150 ms early fires, 151 ms doesn\'t', () => {
    it('fires an input pressed 150 ms before action end upon completion', () => {
      // Scenario: Current attack runs from t=0 to t=500 ms (duration 500 ms)
      const sm = new StateMachine('ATTACK', {
        duration: 500,
        startTime: 0,
        bufferWindowMs: 150,
      })
      expect(sm.state).toBe('ATTACK')

      // Input pressed 150 ms early: at t = 350 ms (500 - 350 = 150 ms early)
      const requestResult = sm.requestState('ATTACK', { time: 350 })
      expect(requestResult.success).toBe(false) // Cannot interrupt active attack
      expect(requestResult.buffered).toBe(true) // Successfully buffered

      // At t = 499 ms, attack is still active
      sm.update(499)
      expect(sm.state).toBe('ATTACK')

      // At t = 500 ms, attack finishes -> buffered input at t=350 is evaluated (age = 150 ms <= 150 ms)
      sm.update(500)
      // 150 ms early FIRES!
      expect(sm.state).toBe('ATTACK')
    })

    it('does NOT fire an input pressed 151 ms before action end (expires, reverts to default)', () => {
      // Scenario: Current attack runs from t=0 to t=500 ms (duration 500 ms)
      const sm = new StateMachine('ATTACK', {
        duration: 500,
        startTime: 0,
        bufferWindowMs: 150,
      })
      expect(sm.state).toBe('ATTACK')

      // Input pressed 151 ms early: at t = 349 ms (500 - 349 = 151 ms early)
      const requestResult = sm.requestState('ATTACK', { time: 349 })
      expect(requestResult.success).toBe(false)
      expect(requestResult.buffered).toBe(true)

      // At t = 500 ms, attack finishes -> buffered input at t=349 is evaluated (age = 151 ms > 150 ms)
      sm.update(500)
      // 151 ms early DOES NOT FIRE! Reverts to default state (IDLE)
      expect(sm.state).toBe('IDLE')
    })

    it('evaluates consumeBuffer directly at exact 150 ms boundary', () => {
      const sm = new StateMachine('DODGE', { bufferWindowMs: 150 })

      // Pressed at t = 200 ms
      sm.bufferInput('ATTACK', 200)

      // Consumed at t = 350 ms (age = 150 ms)
      const fired = sm.consumeBuffer(350)
      expect(fired).not.toBeNull()
      expect(fired.state).toBe('ATTACK')

      // Pressed at t = 200 ms
      sm.bufferInput('ATTACK', 200)

      // Consumed at t = 351 ms (age = 151 ms)
      const expired = sm.consumeBuffer(351)
      expect(expired).toBeNull()
    })

    it('overwrites previous buffered input with newer input within the window', () => {
      const sm = new StateMachine('ATTACK', { duration: 500, startTime: 0 })

      // Player presses BLOCK at 300 ms, then changes mind and presses DODGE at 400 ms
      sm.bufferInput('BLOCK', 300)
      sm.bufferInput('DODGE', 400)

      // At 500 ms, DODGE should fire
      sm.update(500)
      expect(sm.state).toBe('DODGE')
    })

    it('clears buffer after consuming', () => {
      const sm = new StateMachine('IDLE')
      sm.bufferInput('ATTACK', 100)

      const consumed = sm.consumeBuffer(200)
      expect(consumed).not.toBeNull()

      // Subsequent consume returns null
      expect(sm.consumeBuffer(200)).toBeNull()
      expect(sm.getBufferedInput(200)).toBeNull()
    })
  })

  describe('Listeners and state hooks', () => {
    it('invokes listeners on state change', () => {
      const sm = new StateMachine('IDLE')
      const listener = vi.fn()
      const unsubscribe = sm.onEnter(listener)

      sm.transition('WALK')
      expect(listener).toHaveBeenCalledWith('WALK', 'IDLE', expect.any(Object))

      unsubscribe()
      sm.transition('ATTACK')
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })
})

