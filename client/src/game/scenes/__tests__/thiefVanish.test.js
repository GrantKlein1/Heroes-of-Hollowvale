import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { keyboard } = vi.hoisted(() => ({
  keyboard: {
    JustDown: (key) => Boolean(key && key.__justDown),
  },
}))

vi.mock('phaser', () => {
  class Scene {
    constructor() {}
  }

  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 64, height: 96, realWidth: 64, realHeight: 96 }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
      this.visible = true
      this.alpha = 1
      this.body = {
        x: 10,
        y: 20,
        width: 24,
        height: 16,
        bottom: y,
        velocity: { x: 0, y: 0 },
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        reset: vi.fn(),
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

    setTexture(key, frame) {
      this.texture = { key }
      this.frame = { ...this.frame, name: frame }
      return this
    }

    setVisible(v) {
      this.visible = v
      return this
    }

    setAlpha(a) {
      this.alpha = a
      return this
    }
  }

  return {
    default: {
      Scene,
      Animations: { Events: { ANIMATION_COMPLETE: 'animationcomplete' } },
      Input: { Keyboard: keyboard },
      Physics: { Arcade: { Sprite: MockSprite } },
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import HollowvaleScene from '../HollowvaleScene.js'
import { Player } from '../../actors/Player.js'
import { session } from '../../session.js'
import { eventBus, GameEvents } from '../../../lib/eventBus.js'

const SESSION_KEYS = [
  'blocked',
  'classId',
  'spriteUrl',
  'equippedId',
  'thiefVanishUntil',
  'thiefSmokeUntil',
  'thiefVanishCooldownUntil',
]

function blankGfx() {
  return {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    lineStyle: vi.fn(),
    strokeRect: vi.fn(),
  }
}

function playerScene() {
  return {
    add: { existing: vi.fn((obj) => obj) },
    physics: { add: { existing: vi.fn((obj) => obj) } },
    anims: {
      exists: vi.fn(() => true),
      get: vi.fn((key) => ({ key, frames: [{}] })),
    },
    textures: {
      exists: vi.fn(() => true),
      get: vi.fn((key) => {
        if (key !== 'thief') return null
        return {
          key,
          customData: {
            meta: {
              origin: { x: 0.5, y: 0.9271 },
              footprint: { x: -12, y: -4, w: 24, h: 7, shape: 'ellipse' },
            },
          },
          getFrameNames: () => ['thief_idle_down'],
          get: () => ({ customData: { pivot: { x: 0.5, y: 0.9271 } } }),
        }
      }),
    },
  }
}

describe('Thief vanish presentation', () => {
  let saved

  beforeEach(() => {
    saved = {}
    for (const key of SESSION_KEYS) saved[key] = session[key]
    session.blocked = false
    session.classId = 'thief'
    session.spriteUrl = ''
    session.equippedId = 'twin_daggers'
    session.thiefVanishUntil = 0
    session.thiefSmokeUntil = 0
    session.thiefVanishCooldownUntil = 0
  })

  afterEach(() => {
    for (const key of SESSION_KEYS) session[key] = saved[key]
    eventBus.clear()
  })

  it('shows the vanish clip at t0+200ms and calls reappear once at t0+1000ms', () => {
    const t0 = 10000
    const player = new Player(playerScene(), 100, 200, 'thief')
    const reappear = vi.spyOn(player, 'reappear')
    const ability = vi.fn()
    eventBus.on(GameEvents.ABILITY, ability)

    const scene = new HollowvaleScene()
    scene.player = player
    scene._appliedClass = 'thief'
    scene._spriteUrl = ''
    scene.sceneId = 'village'
    scene._attacking = false
    scene._flashUntil = 0
    scene.debugOn = false
    scene._debugPlayerDirty = false
    scene.tiledMapLoader = null
    scene._consuming = false
    scene._vanishArmed = false
    scene._box = { x: 0, y: 0, w: 0, h: 0 }
    scene.prompts = []
    scene.beaconLabels = []
    scene._activeLabel = ''
    scene.enemies = { getChildren: () => [] }
    scene.hpGfx = blankGfx()
    scene.beaconGfx = blankGfx()
    scene.consumeGfx = blankGfx()
    scene.fx = {
      spawn: vi.fn(() => ({ x: 0, y: 0, w: 0, h: 0 })),
      release: vi.fn(),
      sync: vi.fn(),
    }
    scene.cameras = { main: {} }
    scene.keys = {
      F2: {},
      backtick: {},
      J: { __justDown: true },
    }

    scene._tryVanish(t0)
    scene.keys.J.__justDown = false

    expect(ability).toHaveBeenCalledTimes(1)
    expect(ability).toHaveBeenCalledWith({ id: 'vanish' })
    expect(player.anims.currentAnim.key).toBe('thief_vanish_down')
    expect(session.thiefVanishUntil).toBe(t0 + 1000)

    scene._syncSession(t0 + 200)
    scene._present(t0 + 200)

    expect(player.visible).toBe(true)
    expect(player.anims.currentAnim.key).toBe('thief_vanish_down')
    expect(reappear).not.toHaveBeenCalled()
    expect(player.vanishState.active).toBe(true)

    scene._syncSession(t0 + 1000)
    expect(reappear).toHaveBeenCalledTimes(1)
    expect(reappear).toHaveBeenCalledWith(t0 + 1000)
    expect(player.vanishState.active).toBe(false)

    scene._syncSession(t0 + 1016)
    scene._present(t0 + 1016)
    expect(reappear).toHaveBeenCalledTimes(1)
    expect(session.thiefSmokeUntil).toBe(t0 + 1000 + 15000)
    expect(player.visible).toBe(false)

    scene._attacking = true
    scene._present(t0 + 1100)
    expect(player.visible).toBe(true)
  })
})
