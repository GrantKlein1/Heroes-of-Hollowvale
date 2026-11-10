import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Phaser Sprite & Scene structures for node test environment
vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 640, height: 512 }
      this.originX = 0.5
      this.originY = 0.7812
      this.depth = 0
      this.scaleX = 1.0
      this.scaleY = 1.0
      this.alpha = 1.0
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        reset: vi.fn(),
        velocity: { x: 0, y: 0 },
        bottom: y,
      }
      this.anims = {
        play: vi.fn((key) => {
          this.anims.currentAnim = { key }
          return this
        }),
        currentAnim: null,
      }
    }
    setOrigin(x, y) { this.originX = x; this.originY = y !== undefined ? y : x; return this }
    setScale(s) { this.scaleX = s; this.scaleY = s; return this }
    setDepth(d) { this.depth = d; return this }
    setAlpha(a) { this.alpha = a; return this }
    setTexture(k, f) { this.texture = { key: k }; this.frame = { name: f }; return this }
    destroy() { this.destroyed = true }
  }

  return {
    default: {
      Physics: { Arcade: { Sprite: MockSprite } },
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import { Dragon } from '../../actors/Dragon.js'
import {
  DragonAI,
  DRAGON_AI_STATES,
  DRAGON_PHASE_ATTACKS,
  TRANSITION_DURATION_MS,
  TAKEOFF_DURATION_MS,
} from '../dragon.js'
import {
  DRAGON_BASE_HP,
  DRAGON_PHASE_THRESHOLDS,
  DRAGON_LANDING_DURATION_MS,
  DRAGON_METEOR_MARKER_DELAY_MS,
  METEOR_MARKER_KEY,
} from '../../combat/balance.js'
import { setSeed } from '../../rng.js'

function createMockDragonScene() {
  const loadedTextureMap = new Map([
    ['red_dragon_p1_a', { key: 'red_dragon_p1_a', customData: { meta: {} } }],
    ['red_dragon_p2_a', { key: 'red_dragon_p2_a', customData: { meta: {} } }],
    ['red_dragon_p2_land', { key: 'red_dragon_p2_land', customData: { meta: {} } }],
    ['red_dragon_p3_a', { key: 'red_dragon_p3_a', customData: { meta: {} } }],
  ])

  const scene = {
    add: {
      existing: vi.fn((obj) => obj),
      sprite: vi.fn((x, y, tex, frame) => {
        const sprite = {
          x,
          y,
          texture: { key: tex },
          frame: { name: frame },
          alpha: 1,
          scale: 1,
          destroyed: false,
          setAlpha: vi.fn(function(a) { this.alpha = a; return this }),
          setScale: vi.fn(function(s) { this.scale = s; return this }),
          destroy: vi.fn(function() { this.destroyed = true }),
          anims: { play: vi.fn() },
        }
        return sprite
      }),
    },
    physics: {
      add: {
        existing: vi.fn((obj) => obj),
      },
    },
    textures: {
      exists: vi.fn((key) => loadedTextureMap.has(key)),
      get: vi.fn((key) => loadedTextureMap.get(key) || null),
      getTextureKeys: vi.fn(() => Array.from(loadedTextureMap.keys())),
      remove: vi.fn((key) => loadedTextureMap.delete(key)),
    },
    assetRegistry: {
      transitionDragonPhase: vi.fn((to, from) => ({ transitionDurationMs: 5 })),
      loadDragonPhase: vi.fn(),
      unloadDragonPhase: vi.fn(),
      getActiveDragonPages: vi.fn(() => ['red_dragon_p1_a']),
    },
    player: { x: 350, y: 300 },
    time: { delayedCall: vi.fn((ms, cb) => cb()) },
  }
  return scene
}

describe('DragonAI Controller — Package 3b-2', () => {
  let mockScene
  let dragon
  let ai

  beforeEach(() => {
    setSeed(12345)
    mockScene = createMockDragonScene()
    dragon = new Dragon(mockScene, 300, 250, 'red_dragon_p1_a', '', { phase: 1 })
    ai = dragon.ai
  })

  describe('Phase State Machine Transitions', () => {
    it('initializes in Phase 1 IDLE state with full HP and grounded', () => {
      expect(ai.phase).toBe(1)
      expect(ai.state).toBe(DRAGON_AI_STATES.IDLE)
      expect(ai.invulnerable).toBe(false)
      expect(ai.airborne).toBe(false)
      expect(ai.landed).toBe(true)
      expect(dragon.hp).toBe(DRAGON_BASE_HP)
    })

    it('transitions from P1 to P2 when HP drops below 66% threshold', () => {
      const now = 1000
      const thresholdHp = DRAGON_BASE_HP * DRAGON_PHASE_THRESHOLDS.p1ToP2 // 1200 * 0.66 = 792
      
      // Damage down to threshold
      dragon.setHp(thresholdHp, true, now)

      expect(ai.state).toBe(DRAGON_AI_STATES.TRANSITION)
      expect(ai.invulnerable).toBe(true)
      expect(dragon.invulnerable).toBe(true)
      expect(ai.pendingNextPhase).toBe(2)

      // Completes transition after TRANSITION_DURATION_MS
      ai.update(now + TRANSITION_DURATION_MS)

      expect(ai.phase).toBe(2)
      expect(dragon.phase).toBe(2)
      expect(ai.state).toBe(DRAGON_AI_STATES.IDLE)
      expect(ai.invulnerable).toBe(false)
      expect(dragon.invulnerable).toBe(false)
      expect(ai.airborne).toBe(true)
      expect(ai.landed).toBe(false)
      expect(dragon.airborne).toBe(true)
      expect(dragon.elevation).toBe(52)
    })

    it('transitions from P2 to P3 when HP drops below 33% threshold', () => {
      const now = 5000
      // Advance to P2
      dragon.setHp(700, true, now)
      ai.update(now + TRANSITION_DURATION_MS)
      expect(ai.phase).toBe(2)

      // Damage down to P3 threshold: 1200 * 0.33 = 396
      const p3TriggerTime = now + TRANSITION_DURATION_MS + 500
      dragon.setHp(396, true, p3TriggerTime)

      expect(ai.state).toBe(DRAGON_AI_STATES.TRANSITION)
      expect(ai.invulnerable).toBe(true)
      expect(dragon.invulnerable).toBe(true)
      expect(ai.pendingNextPhase).toBe(3)

      ai.update(p3TriggerTime + TRANSITION_DURATION_MS)

      expect(ai.phase).toBe(3)
      expect(dragon.phase).toBe(3)
      expect(ai.state).toBe(DRAGON_AI_STATES.IDLE)
      expect(ai.invulnerable).toBe(false)
      expect(dragon.invulnerable).toBe(false)
      expect(ai.airborne).toBe(false)
      expect(ai.landed).toBe(true)
      expect(dragon.elevation).toBe(0)
    })

    it('triggers death sequence when HP reaches 0', () => {
      dragon.setHp(0, true)

      expect(ai.state).toBe(DRAGON_AI_STATES.DEAD)
      expect(ai.invulnerable).toBe(true)
      expect(dragon.invulnerable).toBe(true)
      expect(dragon.anims.play).toHaveBeenCalledWith('red_dragon_death_down', true)
    })
  })

  describe('Invulnerability Window During Transitions', () => {
    it('ignores all incoming damage during phase transition and logs warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Trigger transition to P2
      dragon.setHp(700, true)
      expect(ai.state).toBe(DRAGON_AI_STATES.TRANSITION)
      expect(dragon.invulnerable).toBe(true)

      const hpBefore = dragon.hp

      // Attempt to deal melee damage during transition
      const dealt = dragon.takeDamage(100, 'melee')
      expect(dealt).toBe(0)
      expect(dragon.hp).toBe(hpBefore)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Damage ignored: invulnerable'))

      // Attempt to set HP directly via property
      dragon.hp = 200
      expect(dragon.hp).toBe(hpBefore)

      warnSpy.mockRestore()
    })
  })

  describe('Phase 2 Airborne and Post-Volley Landing Window', () => {
    it('ignores melee damage while airborne in Phase 2', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Put dragon in Phase 2
      dragon.setPhase(2)
      ai.phase = 2
      ai.airborne = true
      ai.landed = false
      dragon.airborne = true

      const hpBefore = dragon.hp
      const dealt = dragon.takeDamage(50, 'melee')

      expect(dealt).toBe(0)
      expect(dragon.hp).toBe(hpBefore)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Melee damage ignored: dragon is airborne'))

      warnSpy.mockRestore()
    })

    it('lands after volley attack and becomes vulnerable to melee', () => {
      // Put dragon in Phase 2
      dragon.setPhase(2)
      ai.phase = 2
      ai.airborne = true
      ai.landed = false
      ai.state = DRAGON_AI_STATES.IDLE

      const now = 2000
      // Trigger volley attack
      ai.triggerAttack('volley', now)
      expect(ai.state).toBe(DRAGON_AI_STATES.ATTACK)
      expect(ai.activeAttack).toBe('volley')

      // Complete volley
      ai.completeAttack(now + 900)

      // Must be LANDED
      expect(ai.state).toBe(DRAGON_AI_STATES.LANDED)
      expect(ai.airborne).toBe(false)
      expect(ai.landed).toBe(true)
      expect(dragon.airborne).toBe(false)
      expect(dragon.elevation).toBe(0)
      expect(dragon.texture.key).toBe('red_dragon_p2_land')

      // Now vulnerable to melee!
      const dealt = dragon.takeDamage(50, 'melee')
      expect(dealt).toBe(50)
      expect(dragon.hp).toBe(DRAGON_BASE_HP - 50)
    })

    it('stays landed for DRAGON_LANDING_DURATION_MS then takes off', () => {
      dragon.setPhase(2)
      ai.phase = 2
      ai.airborne = true
      ai.state = DRAGON_AI_STATES.IDLE

      const attackTime = 3000
      const landTime = attackTime + 100
      ai.triggerAttack('volley', attackTime)
      ai.completeAttack(landTime)
      expect(ai.state).toBe(DRAGON_AI_STATES.LANDED)

      // Still landed during duration
      ai.update(landTime + DRAGON_LANDING_DURATION_MS - 50)
      expect(ai.state).toBe(DRAGON_AI_STATES.LANDED)

      // Duration expires -> takeoff triggered
      ai.update(landTime + DRAGON_LANDING_DURATION_MS + 1)
      expect(ai.state).toBe(DRAGON_AI_STATES.TAKEOFF)

      // Complete takeoff
      ai.update(landTime + DRAGON_LANDING_DURATION_MS + TAKEOFF_DURATION_MS + 10)
      expect(ai.state).toBe(DRAGON_AI_STATES.IDLE)
      expect(ai.airborne).toBe(true)
      expect(ai.landed).toBe(false)
      expect(dragon.airborne).toBe(true)
      expect(dragon.elevation).toBe(52)
    })
  })

  describe('Phase 3 Meteors Ground Marker Delay', () => {
    it('spawns ground markers with 700 ms impact delay and METEOR_MARKER_KEY', () => {
      dragon.setPhase(3)
      ai.phase = 3
      ai.airborne = false
      ai.state = DRAGON_AI_STATES.IDLE

      const spawnTime = 10000
      ai.triggerAttack('meteor', spawnTime)

      expect(ai.activeAttack).toBe('meteor')
      expect(ai.activeMarkers.length).toBeGreaterThan(0)
      expect(ai.activeMarkers[0].impactTime - ai.activeMarkers[0].spawnTime).toBe(DRAGON_METEOR_MARKER_DELAY_MS)
      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'dragon_fx_v2',
        METEOR_MARKER_KEY
      )

      // Before impact time, markers still active
      ai.update(spawnTime + 500)
      expect(ai.activeMarkers.length).toBeGreaterThan(0)

      // At impact time, marker cleaned up and impact FX created
      ai.update(spawnTime + DRAGON_METEOR_MARKER_DELAY_MS + 10)
      expect(ai.activeMarkers.length).toBe(0)
    })
  })

  describe('resetEncounter()', () => {
    it('resets boss encounter to full HP, Phase 1, clears timers and markers', () => {
      // Advance dragon into damaged Phase 3
      dragon.setPhase(3)
      ai.phase = 3
      dragon.setHp(100, true)
      ai.activeMarkers.push({
        x: 100,
        y: 100,
        sprite: { destroy: vi.fn() },
      })

      // Call encounter reset
      dragon.resetEncounter()

      expect(dragon.phase).toBe(1)
      expect(ai.phase).toBe(1)
      expect(ai.state).toBe(DRAGON_AI_STATES.IDLE)
      expect(dragon.hp).toBe(DRAGON_BASE_HP)
      expect(dragon.invulnerable).toBe(false)
      expect(dragon.airborne).toBe(false)
      expect(dragon.elevation).toBe(0)
      expect(ai.activeMarkers.length).toBe(0)
    })
  })
})
