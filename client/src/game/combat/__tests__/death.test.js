import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  LOOT_TABLES,
  generateSeededLoot,
  onEnemyDeathComplete,
  resolveAreaEntrance,
  respawnPlayer,
  handlePlayerDeath,
  enemyLabel,
  presentLootDrop,
  seededLootIdsWithoutSprites,
  lootIdleAnimKey,
  lootCollectAnimKey,
  LOOT_PICKUP_ATLAS,
} from '../death.js'
import { createRng } from '../../terrain/rng.js'
import { setSeed, getSeed } from '../../rng.js'
import { eventBus, GameEvents } from '../../../lib/eventBus.js'
import { ACTOR_STATES } from '../../actors/stateMachine.js'

describe('Combat Death & Respawn — Package 1b-4', () => {
  beforeEach(() => {
    eventBus.clear()
    setSeed(12345)
  })

  describe('Seeded Loot Generation (Acceptance Criterion 3)', () => {
    it('produces identical loot when using the same seed across multiple runs', () => {
      const seed = 99999

      // Run A
      const rngA = createRng(seed)
      const goblinLootA = Array.from({ length: 10 }, () => generateSeededLoot('goblin', rngA))
      const bruteLootA = Array.from({ length: 10 }, () => generateSeededLoot('brute', rngA))
      const archerLootA = Array.from({ length: 10 }, () => generateSeededLoot('archer', rngA))

      // Run B
      const rngB = createRng(seed)
      const goblinLootB = Array.from({ length: 10 }, () => generateSeededLoot('goblin', rngB))
      const bruteLootB = Array.from({ length: 10 }, () => generateSeededLoot('brute', rngB))
      const archerLootB = Array.from({ length: 10 }, () => generateSeededLoot('archer', rngB))

      expect(goblinLootA).toEqual(goblinLootB)
      expect(bruteLootA).toEqual(bruteLootB)
      expect(archerLootA).toEqual(archerLootB)
    })

    it('defaults to global seeded PRNG from rng.js if no explicit RNG passed', () => {
      setSeed(4242)
      const loot1 = generateSeededLoot('goblin')

      setSeed(4242)
      const loot2 = generateSeededLoot('goblin')

      expect(loot1).toEqual(loot2)
    })

    it('returns empty loot for unknown enemy archetypes', () => {
      const loot = generateSeededLoot('unknown_boss')
      expect(loot).toEqual({
        gems: { ruby: 0, sapphire: 0, emerald: 0 },
        items: [],
      })
    })

    it('properly formats enemy display labels', () => {
      expect(enemyLabel('goblin')).toBe('Goblin')
      expect(enemyLabel('brute')).toBe('Goblin Brute')
      expect(enemyLabel('archer')).toBe('Goblin Archer')
      expect(enemyLabel('dragon')).toBe('dragon')
    })
  })

  describe('Enemy Death Completion (Acceptance Criterion 2)', () => {
    it('generates seeded loot, emits GameEvents.LOOT, and destroys enemy sprite upon death anim completion', () => {
      const lootEvents = []
      eventBus.on(GameEvents.LOOT, (payload) => lootEvents.push(payload))

      const mockDestroy = vi.fn()
      const mockHpTextDestroy = vi.fn()
      const mockFloat = vi.fn()

      const mockEnemy = {
        enemyType: 'brute',
        x: 150,
        y: 200,
        hpText: { destroy: mockHpTextDestroy },
        destroy: mockDestroy,
        scene: {
          _float: mockFloat,
        },
      }

      // Force RNG returning low roll so brute drops loot (ruby + sapphire + potion)
      const lowRng = { next: () => 0.05 }
      const processed = onEnemyDeathComplete(mockEnemy, { rng: lowRng })

      expect(processed).toBe(true)
      expect(lootEvents.length).toBe(1)
      expect(lootEvents[0].gems.ruby).toBe(1)
      expect(lootEvents[0].gems.sapphire).toBe(1)
      expect(lootEvents[0].items).toEqual([{ id: 'healing_potion', count: 1 }])

      expect(mockFloat).toHaveBeenCalledWith(150, 200, '✕', '#ff4444')
      expect(mockHpTextDestroy).toHaveBeenCalled()
      expect(mockDestroy).toHaveBeenCalled()

      // Subsequent call does nothing (idempotent)
      const secondCall = onEnemyDeathComplete(mockEnemy)
      expect(secondCall).toBe(false)
      expect(mockDestroy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Player Respawn at Area Entrance (Acceptance Criterion 1)', () => {
    it('resolves entrance coordinates from scene _areaEntrance', () => {
      const mockScene = {
        worldW: 1000,
        worldH: 600,
        _areaEntrance: { x: 500, y: 550 },
      }
      const entrance = resolveAreaEntrance(mockScene)
      expect(entrance).toEqual({ x: 500, y: 550 })
    })

    it('resolves entrance coordinates from normalized coordinates', () => {
      const mockScene = {
        worldW: 1000,
        worldH: 600,
        _areaEntrance: { nx: 0.5, ny: 0.9 },
      }
      const entrance = resolveAreaEntrance(mockScene)
      expect(entrance).toEqual({ x: 500, y: 540 })
    })

    it('uses the generic entrance when no spawn or tiled spawns are recorded', () => {
      const entrance = resolveAreaEntrance({
        worldW: 1000,
        worldH: 600,
        sceneId: 'village',
      })
      expect(entrance).toEqual({ x: 500, y: 510 })
    })

    it('respawns player with full HP/mana and resets dead flag', () => {
      const respawnEvents = []
      const noticeEvents = []
      eventBus.on(GameEvents.RESPAWN, (p) => respawnEvents.push(p))
      eventBus.on(GameEvents.NOTICE, (p) => noticeEvents.push(p))

      const mockPlayerSetPosition = vi.fn()
      const mockPlayerBodyReset = vi.fn()
      const mockPlayerRespawn = vi.fn()
      const mockPublishVitals = vi.fn()

      const mockScene = {
        worldW: 960,
        worldH: 540,
        sceneId: 'village',
        _areaEntrance: { x: 480, y: 450 },
        hp: 0,
        hpMax: 120,
        mana: 0,
        manaMax: 80,
        dead: true,
        _publishVitals: mockPublishVitals,
        player: {
          setPosition: mockPlayerSetPosition,
          body: {
            enable: false,
            reset: mockPlayerBodyReset,
            setVelocity: vi.fn(),
          },
          respawn: mockPlayerRespawn,
        },
      }

      const result = respawnPlayer(mockScene)

      expect(result).toEqual({ x: 480, y: 450, hp: 120, mana: 80 })
      expect(mockScene.dead).toBe(false)
      expect(mockScene.hp).toBe(120)
      expect(mockScene.mana).toBe(80)
      expect(mockPlayerSetPosition).toHaveBeenCalledWith(480, 450)
      expect(mockPlayerBodyReset).toHaveBeenCalledWith(480, 450)
      expect(mockPlayerRespawn).toHaveBeenCalled()
      expect(mockPublishVitals).toHaveBeenCalledWith(true)

      expect(respawnEvents.length).toBe(1)
      expect(respawnEvents[0].hp).toBe(120)
      expect(noticeEvents[0].text).toBe('Respawned at area entrance')
    })

    it('coordinates full player death sequence: die() -> DIED event -> respawnPlayer', () => {
      const diedEvents = []
      const respawnEvents = []
      eventBus.on(GameEvents.DIED, (p) => diedEvents.push(p))
      eventBus.on(GameEvents.RESPAWN, (p) => respawnEvents.push(p))

      const mockPlayerDie = vi.fn()
      const mockPlayerRespawn = vi.fn()
      const mockPlayerSetPosition = vi.fn()

      const mockScene = {
        worldW: 960,
        worldH: 540,
        sceneId: 'village',
        _areaEntrance: { x: 480, y: 450 },
        hp: 10,
        hpMax: 100,
        mana: 50,
        manaMax: 100,
        dead: false,
        _publishVitals: vi.fn(),
        player: {
          die: mockPlayerDie,
          respawn: mockPlayerRespawn,
          setPosition: mockPlayerSetPosition,
          body: {
            enable: true,
            reset: vi.fn(),
            setVelocity: vi.fn(),
          },
        },
      }

      handlePlayerDeath(mockScene, 'goblin', { immediate: true })

      expect(mockPlayerDie).toHaveBeenCalled()
      expect(diedEvents.length).toBe(1)
      expect(diedEvents[0].killer).toBe('Goblin')

      expect(mockScene.dead).toBe(false)
      expect(mockScene.hp).toBe(100)
      expect(mockScene.mana).toBe(100)
      expect(mockPlayerRespawn).toHaveBeenCalled()
      expect(respawnEvents.length).toBe(1)
    })
  })

  describe('Batch 7 loot pickups (LM-1)', () => {
    it('maps every seeded table id onto a loot_pickups clip', () => {
      expect(seededLootIdsWithoutSprites()).toEqual([])
    })

    it('spawns an idling pickup and grants only when the player walks over it', () => {
      const lootEvents = []
      eventBus.on(GameEvents.LOOT, (payload) => lootEvents.push(payload))

      const listeners = []
      let completed = null
      const scene = {
        dead: false,
        player: { x: 0, y: 0 },
        lootPickups: null,
        anims: {
          exists: (key) => key.startsWith('loot_pickups_'),
        },
        events: {
          on: (_ev, fn) => listeners.push(fn),
          off: (_ev, fn) => {
            const idx = listeners.indexOf(fn)
            if (idx >= 0) listeners.splice(idx, 1)
          },
        },
        add: {
          sprite: vi.fn((x, y, tex, frame) => {
            const sprite = {
              x,
              y,
              texture: { key: tex },
              frame: { name: frame },
              originX: 0,
              originY: 0,
              depth: 0,
              destroyed: false,
              setOrigin(ox, oy) { this.originX = ox; this.originY = oy; return this },
              setDepth(d) { this.depth = d; return this },
              anims: {
                currentAnim: null,
                play(key) { this.currentAnim = { key }; return this },
              },
              once(_ev, fn) { completed = fn },
              destroy() { this.destroyed = true },
            }
            return sprite
          }),
        },
      }

      const result = presentLootDrop(scene, 100, 200, { ruby: 1, sapphire: 0, emerald: 0 }, [
        { id: 'healing_potion', count: 1 },
      ])

      expect(lootEvents).toEqual([])
      expect(result.pickups).toHaveLength(2)
      expect(result.legacyIds).toEqual([])
      expect(scene.add.sprite).toHaveBeenCalledWith(82, 200, LOOT_PICKUP_ATLAS, 'loot_ruby_idle_down_0')
      expect(scene.add.sprite).toHaveBeenCalledWith(118, 200, LOOT_PICKUP_ATLAS, 'loot_healing_potion_idle_down_0')

      const ruby = result.pickups[0]
      const potion = result.pickups[1]
      expect(ruby.lootId).toBe('ruby')
      expect(ruby.originX).toBe(0.5)
      expect(ruby.originY).toBe(0.875)
      expect(ruby.anims.currentAnim.key).toBe(lootIdleAnimKey('ruby'))
      expect(potion.anims.currentAnim.key).toBe(lootIdleAnimKey('healing_potion'))

      scene.player.x = 10
      scene.player.y = 10
      listeners.forEach((fn) => fn())
      expect(lootEvents).toEqual([])
      expect(ruby.lootCollected).toBe(false)

      scene.player.x = ruby.x
      scene.player.y = ruby.y
      listeners.forEach((fn) => fn())

      expect(ruby.lootCollected).toBe(true)
      expect(ruby.originX).toBe(0.5)
      expect(ruby.originY).toBe(0.5)
      expect(ruby.anims.currentAnim.key).toBe(lootCollectAnimKey())
      expect(lootEvents).toEqual([
        { gems: { ruby: 1, sapphire: 0, emerald: 0 }, items: [] },
      ])

      completed()
      expect(ruby.destroyed).toBe(true)
      expect(listeners).toHaveLength(1)
    })

    it('grants ids with no sprite immediately and leaves them off the atlas', () => {
      const lootEvents = []
      eventBus.on(GameEvents.LOOT, (payload) => lootEvents.push(payload))

      const scene = {
        player: { x: 0, y: 0 },
        anims: { exists: () => true },
        events: { on: vi.fn(), off: vi.fn() },
        add: { sprite: vi.fn() },
      }

      const result = presentLootDrop(scene, 0, 0, { ruby: 0, sapphire: 0, emerald: 0 }, [
        { id: 'lockpicks', count: 1 },
      ])

      expect(result.pickups).toEqual([])
      expect(result.legacyIds).toEqual(['lockpicks'])
      expect(scene.add.sprite).not.toHaveBeenCalled()
      expect(lootEvents).toEqual([
        { gems: { ruby: 0, sapphire: 0, emerald: 0 }, items: [{ id: 'lockpicks', count: 1 }] },
      ])
    })

    it('reads idle and collect origins from atlas meta when the texture is loaded', () => {
      const scene = {
        player: { x: 500, y: 500 },
        anims: { exists: () => true },
        events: { on: vi.fn(), off: vi.fn() },
        textures: {
          get: () => ({
            customData: {
              meta: {
                origin: { x: 0.5, y: 0.875 },
                anims: {
                  loot_emerald_idle: { origin: { x: 0.5, y: 0.875 } },
                  loot_collect: { origin: { x: 0.5, y: 0.5 } },
                },
              },
            },
          }),
        },
        add: {
          sprite: vi.fn((x, y) => ({
            x,
            y,
            originX: 0,
            originY: 0,
            setOrigin(ox, oy) { this.originX = ox; this.originY = oy; return this },
            setDepth() { return this },
            anims: { play() {}, currentAnim: null },
            once() {},
            destroy() {},
          })),
        },
      }

      const result = presentLootDrop(scene, 40, 40, { ruby: 0, sapphire: 0, emerald: 1 }, [])
      expect(result.pickups[0].originX).toBe(0.5)
      expect(result.pickups[0].originY).toBe(0.875)
      expect(result.pickups[0].lootId).toBe('emerald')
    })
  })
})
