import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isQaEnabled,
  createHvApi,
  mountHvApi,
  teardownHvApi,
} from '../hvApi.js'
import { getSeed, setSeed } from '../../rng.js'

describe('Hollowvale QA and Debug API (hvApi.js)', () => {
  let mockScene
  const originalWindow = globalThis.window

  beforeEach(() => {
    globalThis.window = {
      location: { search: '' },
    }

    // Default mock scene
    mockScene = {
      sceneId: 'village',
      worldW: 1920,
      worldH: 1080,
      wave: 2,
      hp: 85,
      hpMax: 100,
      mana: 40,
      manaMax: 100,
      dead: false,
      debugOn: false,
      _attacking: false,
      _attackUntil: 0,
      _consuming: false,
      enemiesSpawned: true,
      facingX: 1,
      facingY: 0,
      _missingAssets: ['missing_sword.png'],
      player: {
        x: 960,
        y: 540,
        body: {
          x: 950,
          y: 530,
          width: 20,
          height: 20,
          center: { x: 960, y: 540 },
          velocity: { x: 0, y: 0 },
        },
        anims: {
          currentAnim: null,
          getName: () => '',
        },
      },
      game: {
        loop: {
          actualFps: 60.05,
        },
      },
      textures: {
        getTextureKeys: () => ['__px', 'knight', 'goblin'],
        list: { __px: {}, knight: {}, goblin: {} },
      },
      physics: {
        world: {
          timeScale: 1,
          bodies: {
            entries: [
              { enable: true },
              { enable: true },
              { enable: false },
            ],
            size: 3,
          },
        },
      },
      time: {
        timeScale: 1,
      },
      cameras: {
        main: {
          zoom: 1.5,
          worldView: { x: 100, y: 100, width: 800, height: 600 },
        },
      },
      scale: {
        width: 1280,
        height: 720,
      },
      enemies: {
        countActive: () => 2,
        getChildren: () => [
          { enemyType: 'goblin', x: 200, y: 300, hp: 15, hpMax: 15, active: true },
          { enemyType: 'archer', x: 400, y: 500, hp: 10, hpMax: 10, active: true },
          { enemyType: 'goblin', x: 600, y: 700, hp: 0, hpMax: 15, active: false },
        ],
      },
      projectiles: [{ x: 10, y: 10 }],
      fires: [],
      _solidRects: [{ x: 0, y: 0, w: 100, h: 20 }],
      prompts: [{ x: 50, y: 50, w: 32, h: 32, action: 'talk', label: 'Bartender', to: null }],
      enterScene: vi.fn(),
      _redrawStaticDebug: vi.fn(),
      _playerSnapshot: () => ({ x: 950, y: 530, w: 20, h: 20, cx: 960, cy: 540, scene: 'village' }),
      spawn: vi.fn((type, x, y) => ({ type, x, y, active: true })),
    }
  })

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow
    } else {
      delete globalThis.window
    }
  })

  describe('isQaEnabled gating', () => {
    it('returns true when running in DEV mode regardless of search query', () => {
      expect(isQaEnabled('', true)).toBe(true)
      expect(isQaEnabled('?foo=bar', true)).toBe(true)
      expect(isQaEnabled('?qa=0', true)).toBe(true)
    })

    it('returns true in production when search query includes qa=1', () => {
      expect(isQaEnabled('?qa=1', false)).toBe(true)
      expect(isQaEnabled('qa=1', false)).toBe(true)
      expect(isQaEnabled('?mode=test&qa=1&debug=true', false)).toBe(true)
    })

    it('returns false in production when qa=1 is absent or different', () => {
      expect(isQaEnabled('', false)).toBe(false)
      expect(isQaEnabled('?qa=0', false)).toBe(false)
      expect(isQaEnabled('?qa=true', false)).toBe(false)
      expect(isQaEnabled('?other=1', false)).toBe(false)
    })
  })

  describe('mountHvApi & teardownHvApi', () => {
    it('leaves window.__hv undefined in production without ?qa=1 (Acceptance criterion 3)', () => {
      const api = mountHvApi(mockScene, { isDev: false, search: '' })
      expect(api).toBeUndefined()
      expect(window.__hv).toBeUndefined()
    })

    it('mounts window.__hv in production when ?qa=1 is present (Acceptance criterion 2)', () => {
      const api = mountHvApi(mockScene, { isDev: false, search: '?qa=1' })
      expect(api).toBeDefined()
      expect(window.__hv).toBeDefined()
      expect(typeof window.__hv.fps()).toBe('number')
      expect(window.__hv.fps()).toBeCloseTo(60.05)
    })

    it('mounts window.__hv when in DEV mode without URL search query', () => {
      const api = mountHvApi(mockScene, { isDev: true, search: '' })
      expect(api).toBeDefined()
      expect(window.__hv).toBeDefined()
    })

    it('removes window.__hv on teardown', () => {
      mountHvApi(mockScene, { isDev: true })
      expect(window.__hv).toBeDefined()
      teardownHvApi()
      expect(window.__hv).toBeUndefined()
    })
  })

  describe('createHvApi method behavior', () => {
    let api

    beforeEach(() => {
      api = createHvApi(mockScene)
    })

    describe('fps()', () => {
      it('returns actual FPS number from scene.game.loop.actualFps', () => {
        expect(api.fps()).toBeCloseTo(60.05)
      })

      it('returns 0 when game or loop is undefined or not a number', () => {
        mockScene.game = null
        expect(api.fps()).toBe(0)
      })
    })

    describe('anim()', () => {
      it('returns Phaser anim key if playing on player', () => {
        mockScene.player.anims.currentAnim = { key: 'knight_run_down' }
        expect(api.anim()).toBe('knight_run_down')
      })

      it('returns anim name from getName() if present', () => {
        mockScene.player.anims.currentAnim = null
        mockScene.player.anims.getName = () => 'dwarf_attack_right'
        expect(api.anim()).toBe('dwarf_attack_right')
      })

      it('returns "death" when scene.dead is true', () => {
        mockScene.dead = true
        expect(api.anim()).toBe('death')
      })

      it('returns "attack" when scene._attacking is true', () => {
        mockScene._attacking = true
        expect(api.anim()).toBe('attack')
      })

      it('returns "consume" when scene._consuming is true', () => {
        mockScene._consuming = true
        expect(api.anim()).toBe('consume')
      })

      it('returns "walk" when player body has non-zero velocity', () => {
        mockScene.player.body.velocity = { x: 50, y: 0 }
        expect(api.anim()).toBe('walk')
      })

      it('returns "idle" when stationary and not in another state', () => {
        expect(api.anim()).toBe('idle')
      })
    })

    describe('facing()', () => {
      it('returns "right" for positive X dominant facing', () => {
        mockScene.facingX = 1
        mockScene.facingY = 0
        expect(api.facing()).toBe('right')
      })

      it('returns "left" for negative X dominant facing', () => {
        mockScene.facingX = -1
        mockScene.facingY = 0
        expect(api.facing()).toBe('left')
      })

      it('returns "down" for positive Y dominant facing', () => {
        mockScene.facingX = 0
        mockScene.facingY = 1
        expect(api.facing()).toBe('down')
      })

      it('returns "up" for negative Y dominant facing', () => {
        mockScene.facingX = 0
        mockScene.facingY = -1
        expect(api.facing()).toBe('up')
      })

      it('returns explicit scene._facing if set', () => {
        mockScene._facing = 'up'
        expect(api.facing()).toBe('up')
      })
    })

    describe('textures()', () => {
      it('returns list of texture keys from scene.textures.getTextureKeys()', () => {
        expect(api.textures()).toEqual(['__px', 'knight', 'goblin'])
      })

      it('falls back to Object.keys(scene.textures.list) if getTextureKeys is missing', () => {
        delete mockScene.textures.getTextureKeys
        expect(api.textures()).toEqual(['__px', 'knight', 'goblin'])
      })

      it('returns empty array if textures manager is undefined', () => {
        mockScene.textures = null
        expect(api.textures()).toEqual([])
      })
    })

    describe('missingAssets()', () => {
      it('returns array of missing asset keys tracked by scene', () => {
        expect(api.missingAssets()).toEqual(['missing_sword.png'])
      })

      it('returns empty array if no missing assets recorded', () => {
        mockScene._missingAssets = []
        expect(api.missingAssets()).toEqual([])
      })
    })

    describe('seed(n)', () => {
      it('returns the active seed without arguments', () => {
        setSeed(777)
        expect(api.seed()).toBe(777)
      })

      it('sets seed and returns new seed when argument provided', () => {
        const res = api.seed(4242)
        expect(res).toBe(4242)
        expect(getSeed()).toBe(4242)
      })
    })

    describe('bodies()', () => {
      it('returns count of active (enabled) physics bodies', () => {
        // 2 enabled bodies out of 3 total in mockScene
        expect(api.bodies()).toBe(2)
      })

      it('handles world.bodies.size fallback if entries array not present', () => {
        mockScene.physics.world.bodies = { size: 5 }
        expect(api.bodies()).toBe(5)
      })

      it('returns 0 if physics world is missing', () => {
        mockScene.physics = null
        expect(api.bodies()).toBe(0)
      })
    })

    describe('spawn(type, x, y)', () => {
      it('calls scene.spawn(type, x, y) and returns spawned entity', () => {
        const entity = api.spawn('brute', 500, 600)
        expect(mockScene.spawn).toHaveBeenCalledWith('brute', 500, 600)
        expect(entity).toEqual({ type: 'brute', x: 500, y: 600, active: true })
      })

      it('calls scene._spawnEnemy with normalized coordinates if scene.spawn is not defined', () => {
        delete mockScene.spawn
        mockScene._spawnEnemy = vi.fn((type, nx, ny, wave) => ({ type, nx, ny, wave }))
        
        const entity = api.spawn('archer', 960, 540)
        expect(mockScene._spawnEnemy).toHaveBeenCalledWith('archer', 0.5, 0.5, 2)
        expect(entity).toEqual({ type: 'archer', nx: 0.5, ny: 0.5, wave: 2 })
      })
    })

    describe('combat()', () => {
      it('returns debug combat state snapshot', () => {
        const info = api.combat()
        expect(info).toEqual({
          hp: 85,
          hpMax: 100,
          mana: 40,
          manaMax: 100,
          dead: false,
          attacking: false,
          attackUntil: 0,
          consuming: false,
          wave: 2,
          enemiesSpawned: true,
          enemyCount: 2,
          enemies: [
            { type: 'goblin', x: 200, y: 300, hp: 15, hpMax: 15 },
            { type: 'archer', x: 400, y: 500, hp: 10, hpMax: 10 },
          ],
          projectilesCount: 1,
          firesCount: 0,
        })
      })

      it('safely handles missing sub-properties', () => {
        mockScene.enemies = null
        mockScene.projectiles = null
        mockScene.fires = null
        const info = api.combat()
        expect(info.enemyCount).toBe(0)
        expect(info.enemies).toEqual([])
        expect(info.projectilesCount).toBe(0)
        expect(info.firesCount).toBe(0)
      })
    })

    describe('timeScale(n)', () => {
      it('returns current time scale when called without arguments', () => {
        expect(api.timeScale()).toBe(1)
      })

      it('sets scene time and physics world timeScale when given a number', () => {
        const res = api.timeScale(0.5)
        expect(res).toBe(0.5)
        expect(mockScene.time.timeScale).toBe(0.5)
        expect(mockScene.physics.world.timeScale).toBe(0.5)
      })
    })

    describe('legacy API passthroughs', () => {
      it('provides scene, world, zoom, view, canvas, debug, solids, prompts, goto', () => {
        expect(api.scene()).toBe('village')
        expect(api.world()).toEqual({ w: 1920, h: 1080 })
        expect(api.zoom()).toBe(1.5)
        expect(api.view()).toEqual({ x: 100, y: 100, width: 800, height: 600 })
        expect(api.canvas()).toEqual({ w: 1280, h: 720 })
        expect(api.player()).toEqual({ x: 950, y: 530, w: 20, h: 20, cx: 960, cy: 540, scene: 'village' })
        expect(api.solids()).toEqual([{ x: 0, y: 0, w: 100, h: 20 }])
        expect(api.prompts()).toEqual([{ x: 50, y: 50, w: 32, h: 32, action: 'talk', label: 'Bartender', to: null }])

        api.debug(true)
        expect(mockScene.debugOn).toBe(true)
        expect(mockScene._redrawStaticDebug).toHaveBeenCalled()

        api.goto('dungeon', 0.2, 0.3)
        expect(mockScene.enterScene).toHaveBeenCalledWith('dungeon', { nx: 0.2, ny: 0.3 })
      })
    })
  })
})
