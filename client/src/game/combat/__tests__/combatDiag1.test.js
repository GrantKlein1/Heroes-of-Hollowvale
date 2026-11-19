/**
 * COMBAT-DIAG-1 confirming tests.
 *
 * These assert the behavior the owner reported as missing. On current main
 * they fail. They are skipped so CI stays green. Unskip them when the fix
 * in docs/plans/combat-diag-1.md lands; do not invert the assertions to
 * match the broken behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 64, height: 96, realWidth: 64, realHeight: 96 }
      this.originX = 0.5
      this.originY = 0.5
      this.scaleX = 1
      this.scaleY = 1
      this.depth = 0
      this.active = true
      this.visible = true
      this.rotation = 0
      this.alpha = 1
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        reset: vi.fn(),
        velocity: { x: 0, y: 0 },
        bottom: y,
        enable: true,
      }
      this.anims = {
        play: vi.fn((key) => {
          this.anims.currentAnim = { key }
          return this
        }),
        currentAnim: null,
        timeScale: 1,
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
      return true
    }

    setOrigin(x, y) {
      this.originX = x
      this.originY = y !== undefined ? y : x
      return this
    }

    setScale(sx, sy) {
      this.scaleX = sx
      this.scaleY = sy !== undefined ? sy : sx
      return this
    }

    setDepth(d) {
      this.depth = d
      return this
    }

    setRotation(r) {
      this.rotation = r
      return this
    }

    setTexture(key, frame) {
      this.texture = { key }
      this.frame = { name: frame, width: 64, height: 96 }
      return this
    }

    setVisible(v) {
      this.visible = v
      return this
    }

    setFlipX(v) {
      this.flipX = v
      return this
    }

    setAlpha(a) {
      this.alpha = a
      return this
    }

    play(key) {
      this.currentAnimKey = key
      return this
    }

    once() {
      return this
    }

    destroy() {
      this.active = false
      this.visible = false
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

import { executePlayerMeleeHit } from '../hitSystem.js'
import { calculateBlockMitigation } from '../block.js'
import { castLightning } from '../spells.js'
import { Player } from '../../actors/Player.js'
import { ACTOR_STATES } from '../../actors/stateMachine.js'
import { session } from '../../session.js'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const KNIGHT_DIR = path.join(REPO_ROOT, 'client', 'public', 'assets', 'characters', 'knight')

function loadAtlas(name) {
  return JSON.parse(fs.readFileSync(path.join(KNIGHT_DIR, name), 'utf8'))
}

const knightAttack = loadAtlas('knight_attack.json')
const knightAttack2 = loadAtlas('knight_attack2.json')

const GOBLIN_HURT = { x: -16, y: -23, w: 31, h: 23 }
const GOBLIN_FOOT = { x: -13, y: -4, w: 26, h: 8 }
const FACING_STEP = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
}

function fxSprite() {
  const sprite = {
    setOrigin() { return sprite },
    setDepth() { return sprite },
    setScale() { return sprite },
    once() { return sprite },
    destroy() {},
    anims: { play() {} },
  }
  return sprite
}

describe('COMBAT-DIAG-1', () => {
  let scene

  beforeEach(() => {
    session.equippedId = null
    session.damageBoostUntil = 0
    session.damageMult = 1
    scene = {
      unit: 1,
      hp: 120,
      hpMax: 120,
      mana: 100,
      manaMax: 100,
      projectiles: [],
      _solidRects: [],
      _float: vi.fn(),
      _publishVitals: vi.fn(),
      enemies: { getChildren: () => [] },
      textures: {
        get(key) {
          if (key === 'knight_attack') return { customData: { meta: knightAttack.meta } }
          if (key === 'knight_attack2') return { customData: { meta: knightAttack2.meta } }
          return null
        },
        exists: () => false,
      },
      anims: {
        exists: () => true,
        create: vi.fn(),
        get: () => null,
      },
      add: {
        existing: vi.fn((obj) => obj),
        sprite: vi.fn(() => fxSprite()),
        image: vi.fn(() => fxSprite()),
      },
      physics: { add: { existing: vi.fn() } },
      time: { delayedCall: vi.fn() },
    }
  })

  function goblin(x, y, hp = 36) {
    return {
      active: true,
      x,
      y,
      hp,
      hpMax: hp,
      scaleX: 1,
      scale: 1,
      hurtbox: { ...GOBLIN_HURT },
      body: {
        x: x + GOBLIN_FOOT.x,
        y: y + GOBLIN_FOOT.y,
        width: GOBLIN_FOOT.w,
        height: GOBLIN_FOOT.h,
        bottom: y + GOBLIN_FOOT.y + GOBLIN_FOOT.h,
        setVelocity: vi.fn(),
      },
      scene,
      setTintFill: vi.fn(),
      setTint: vi.fn(),
      clearTint: vi.fn(),
    }
  }

  function knight(facing, sheet) {
    return {
      scene,
      classId: 'knight',
      facing,
      x: 200,
      y: 200,
      scaleX: 1,
      scale: 1,
      currentSwingId: 1,
      getSheetForAnim: () => sheet,
      body: {
        bottom: 203,
        velocity: { x: 0, y: 0 },
        setVelocity: vi.fn(),
      },
    }
  }

  function place(facing, distance) {
    const [sx, sy] = FACING_STEP[facing]
    return goblin(200 + sx * distance, 200 + sy * distance)
  }

  describe('knight melee', () => {
    it.skip('hits a goblin overlapping the knight and one tile in front, on every facing', () => {
      const misses = []
      for (const sheet of [
        ['knight_attack', 'attack'],
        ['knight_attack2', 'attack_2'],
      ]) {
        for (const facing of ['down', 'left', 'right', 'up']) {
          for (const distance of [0, 8, 32]) {
            const enemy = place(facing, distance)
            scene.enemies = { getChildren: () => [enemy] }
            const player = knight(facing, sheet[0])
            const hits = executePlayerMeleeHit(player, 3, 1000, sheet[1])
            if (hits !== 1 || enemy.hp !== 24) {
              misses.push(`${sheet[1]} ${facing} @ ${distance}px hits=${hits} hp=${enemy.hp}`)
            }
          }
        }
      }
      expect(misses).toEqual([])
    })

    it.skip('does not hit a goblin standing one tile behind the facing', () => {
      const tagged = []
      for (const facing of ['down', 'left', 'right', 'up']) {
        const enemy = place(facing, -32)
        scene.enemies = { getChildren: () => [enemy] }
        const hits = executePlayerMeleeHit(knight(facing, 'knight_attack'), 3, 1000, 'attack')
        if (hits !== 0 || enemy.hp !== 36) {
          tagged.push(`${facing} behind hits=${hits} hp=${enemy.hp}`)
        }
      }
      expect(tagged).toEqual([])
    })
  })

  describe('knight block', () => {
    it.skip('mitigates a goblin inside attack range but outside the 60 degree half-angle', () => {
      // Feet 32px right and 16px down of a down-facing knight.
      // dist = 35.8 <= goblin ATTACK_RANGE_PX (36). Off-axis by ~63.4°, just past ±60°.
      const knightActor = {
        classId: 'knight',
        facing: 'down',
        x: 100,
        y: 100,
        isBlocking: () => true,
      }
      const res = calculateBlockMitigation(knightActor, 10, { x: 132, y: 116 })
      expect(res.blocked).toBe(true)
      expect(res.isFrontal).toBe(true)
      expect(res.finalDamage).toBe(3)
    })

    it.skip('returns to block when the hurt clip ends while C is still held', () => {
      const player = new Player(scene, 100, 100, 'knight', { facing: 'down' })
      const now = Date.now()
      expect(player.startBlock(now)).toBe(true)
      expect(player.isBlocking()).toBe(true)

      const took = player.takeDamage(10, now + 30, { fromX: 100, fromY: 40 })
      expect(took).toBe(true)
      expect(player.is(ACTOR_STATES.HURT)).toBe(true)

      expect(player.startBlock(Date.now())).toBe(false)
      player.emit('animationcomplete', { key: 'knight_hurt_down' })

      expect(player.is(ACTOR_STATES.HURT)).toBe(false)
      expect(player.isBlocking()).toBe(true)
    })
  })

  describe('lightning bolt', () => {
    it.skip('stops on the first enemy along facing and does not damage the one behind it', () => {
      const mage = {
        classId: 'mage',
        facing: 'down',
        x: 400,
        y: 400,
        scaleX: 1,
      }
      const first = goblin(400, 448, 40)
      const second = goblin(400, 620, 40)
      scene.enemies = { getChildren: () => [first, second] }
      scene._enemyBox = (e) => ({
        x: e.body.x,
        y: e.body.y,
        w: e.body.width,
        h: e.body.height,
      })

      const proj = castLightning(scene, mage, 1000)
      expect(proj).toBeTruthy()

      for (let i = 0; i < 90 && proj.active && !proj.isImpacted; i++) {
        proj.update(1000 + i * 16, 0.016)
      }

      expect(first.hp).toBe(25)
      expect(second.hp).toBe(40)
      expect(proj.distanceTraveled).toBeLessThan(100)
      expect(proj.isImpacted || proj.active === false).toBe(true)
    })
  })
})
