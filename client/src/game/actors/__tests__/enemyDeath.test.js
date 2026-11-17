import { describe, it, expect, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 64, height: 64, realWidth: 64, realHeight: 64 }
      this.originX = 0.5
      this.originY = 0.5
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        setAllowGravity: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setPushable: vi.fn(),
        velocity: { x: 40, y: 10 },
        enable: true,
        checkCollision: { none: false },
        bottom: y,
      }
      this.anims = {
        play: vi.fn((key) => {
          this.anims.currentAnim = { key }
          return this
        }),
        currentAnim: null,
      }
      this._eventListeners = new Map()
    }

    on(event, fn) {
      if (!this._eventListeners.has(event)) this._eventListeners.set(event, [])
      this._eventListeners.get(event).push(fn)
      return this
    }

    emit(event, ...args) {
      const listeners = this._eventListeners.get(event) || []
      for (const fn of listeners) fn(...args)
    }

    setOrigin(x, y) {
      this.originX = x
      this.originY = y !== undefined ? y : x
      return this
    }

    setDepth(d) {
      this.depth = d
      return this
    }

    setTexture(key) {
      this.texture = { key }
      return this
    }

    destroy() {
      this.body = undefined
      this.scene = undefined
      this.active = false
    }
  }

  return {
    default: {
      Animations: { Events: { ANIMATION_COMPLETE: 'animationcomplete' } },
      Physics: { Arcade: { Sprite: MockSprite } },
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import { Enemy } from '../Enemy.js'
import { ACTOR_STATES } from '../stateMachine.js'
import { AttackTokenManager } from '../../ai/tokens.js'
import { createRng, setSeed } from '../../rng.js'
import { generateSeededLoot } from '../../combat/death.js'

function seedForDrop(enemyType) {
  for (let seed = 1; seed < 400; seed += 1) {
    const loot = generateSeededLoot(enemyType, createRng(seed))
    const dropped = loot.gems.ruby || loot.gems.sapphire || loot.gems.emerald || loot.items.length > 0
    if (dropped) return seed
  }
  throw new Error(`no drop seed for ${enemyType}`)
}

function createScene({ deathClip = { frames: [{}, {}, {}, {}], duration: 800, frameRate: 10 }, deathExists = true, metaFrames = 0, metaFps = 10 } = {}) {
  const timers = []
  const scene = {
    timers,
    attackTokenManager: new AttackTokenManager(2),
    player: {
      x: 200,
      y: 200,
      hp: 100,
      body: { bottom: 200, x: 184, y: 177, width: 32, height: 23 },
      hurtbox: { x: -14, y: -37, w: 28, h: 37 },
      takeDamage: vi.fn(() => true),
      is: vi.fn(() => false),
    },
    textures: {
      get: vi.fn(() => ({
        customData: {
          meta: {
            origin: { x: 0.5, y: 0.9375 },
            footprint: { x: -13, y: -4, w: 26, h: 8, shape: 'ellipse' },
            hurtbox: { x: -16, y: -23, w: 31, h: 23 },
            anims: metaFrames > 0
              ? { death: { fps: metaFps, frames: metaFrames, loop: false } }
              : {},
          },
        },
      })),
      exists: vi.fn(() => true),
    },
    anims: {
      exists: vi.fn((key) => (String(key).includes('death') ? deathExists : true)),
      get: vi.fn((key) => (String(key).includes('death') ? deathClip : { frames: [{}], duration: 100, frameRate: 8 })),
    },
    time: {
      delayedCall: vi.fn(function (ms, fn) {
        if (!this || typeof this.delayedCall !== 'function') {
          throw new TypeError("Cannot read properties of undefined (reading 'addEvent')")
        }
        const timer = { ms, fn, remove: vi.fn() }
        timers.push(timer)
        return timer
      }),
    },
    add: {
      sprite: vi.fn((x, y, atlas, frame) => ({
        x,
        y,
        atlas,
        frame,
        anims: { play: vi.fn() },
        setOrigin() { return this },
        setDepth() { return this },
      })),
    },
    enemies: {
      remove: vi.fn(),
    },
  }
  return scene
}

function finishClip(enemy) {
  enemy.emit('animationcomplete', { key: enemy.lastAnimKey })
}

describe('Enemy death clip — BUG-2', () => {
  it.each(['goblin', 'archer', 'brute'])('%s stays active and harmless during the death clip, then drops loot', (enemyType) => {
    const scene = createScene()
    const enemy = new Enemy(scene, 200, 200, enemyType)
    enemy.ai = { update: vi.fn() }
    scene.attackTokenManager.acquire(enemy)
    enemy.x = scene.player.x
    enemy.y = scene.player.y

    enemy.die()

    expect(enemy.active).toBe(true)
    expect(enemy.hp).toBe(0)
    expect(enemy.is(ACTOR_STATES.DEAD)).toBe(true)
    expect(enemy.body.enable).toBe(false)
    expect(enemy.body.checkCollision.none).toBe(true)
    expect(enemy.active && enemy.hp > 0).toBe(false)
    expect(scene.attackTokenManager.has(enemy)).toBe(false)
    expect(enemy.lastAnimKey).toContain('death')
    expect(scene.lootPickups || []).toHaveLength(0)
    expect(scene.timers).toHaveLength(1)
    expect(scene.timers[0].ms).toBe(950)

    expect(enemy.executeAttackHit(1000)).toBe(false)
    expect(scene.player.takeDamage).not.toHaveBeenCalled()
    expect(enemy.takeDamage(5, 1100)).toBe(false)
    expect(enemy.hp).toBe(0)

    enemy.update(1200, 16)
    expect(enemy.ai.update).not.toHaveBeenCalled()
    expect(enemy.body.enable).toBe(false)

    setSeed(seedForDrop(enemyType))
    finishClip(enemy)

    expect(enemy._deathCompleted).toBe(true)
    expect(enemy.active).toBe(false)
    expect(scene.lootPickups.length).toBeGreaterThan(0)
    expect(scene.lootPickups.every((sprite) => sprite.lootPickup && sprite.lootId)).toBe(true)
    expect(scene.timers[0].remove).toHaveBeenCalledWith(false)

    const drops = scene.lootPickups.length
    scene.timers[0].fn()
    enemy.die()
    expect(scene.lootPickups).toHaveLength(drops)
  })

  it('completes immediately when the death clip has 0 frames', () => {
    const scene = createScene({ deathClip: { frames: [], duration: 0 }, deathExists: true })
    const enemy = new Enemy(scene, 40, 40, 'goblin')
    setSeed(seedForDrop('goblin'))

    enemy.die()

    expect(scene.timers).toHaveLength(0)
    expect(enemy._deathCompleted).toBe(true)
    expect(enemy.active).toBe(false)
    expect(enemy.body.enable).toBe(false)
    expect(enemy.executeAttackHit(1000)).toBe(false)
    expect(scene.player.takeDamage).not.toHaveBeenCalled()
    expect(scene.lootPickups.length).toBeGreaterThan(0)
  })

  it('waits about the clip length when the death clip is missing, then drops loot', () => {
    const scene = createScene({ deathExists: false, deathClip: null, metaFrames: 8, metaFps: 10 })
    const enemy = new Enemy(scene, 40, 40, 'goblin')

    enemy.die()

    expect(enemy._deathCompleted).toBeFalsy()
    expect(enemy.active).toBe(true)
    expect(enemy.body.enable).toBe(false)
    expect(enemy.executeAttackHit(1000)).toBe(false)
    expect(scene.player.takeDamage).not.toHaveBeenCalled()
    expect(scene.lootPickups || []).toHaveLength(0)
    expect(scene.timers).toHaveLength(1)
    expect(scene.timers[0].ms).toBe(800)
    expect(enemy.lastAnimKey || '').not.toContain('death')

    setSeed(seedForDrop('goblin'))
    scene.timers[0].fn()

    expect(enemy._deathCompleted).toBe(true)
    expect(enemy.active).toBe(false)
    expect(scene.lootPickups.length).toBeGreaterThan(0)
  })

  it('completeDeath after destroy and body removal does not throw or drop loot', () => {
    const scene = createScene()
    const enemy = new Enemy(scene, 40, 40, 'goblin')
    enemy.disableBody = vi.fn(() => {
      if (!enemy.body) {
        throw new TypeError("Cannot read properties of undefined (reading 'stop')")
      }
    })

    enemy.die()

    expect(scene.timers).toHaveLength(1)
    const timer = scene.timers[0]
    const disableCallsWhileAlive = enemy.disableBody.mock.calls.length
    expect(disableCallsWhileAlive).toBeGreaterThan(0)

    enemy.destroy()

    expect(enemy._destroyed).toBe(true)
    expect(enemy.scene).toBeUndefined()
    expect(enemy.body).toBeUndefined()
    expect(timer.remove).toHaveBeenCalledWith(false)
    expect(enemy.completeDeath()).toBe(false)
    expect(() => timer.fn()).not.toThrow()
    expect(() => enemy.disableCombatBody()).not.toThrow()
    expect(enemy.disableBody).toHaveBeenCalledTimes(disableCallsWhileAlive)
    expect(scene.lootPickups || []).toHaveLength(0)
  })
})
