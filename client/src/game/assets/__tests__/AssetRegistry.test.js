import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AssetRegistry } from '../AssetRegistry.js'
import defaultManifest from '../../../../public/assets/manifest.json'

function createMockScene(loadedTextureKeys = []) {
  const queuedAtlases = []
  const loadedTextureMap = new Map()

  for (const k of loadedTextureKeys) {
    loadedTextureMap.set(k, {
      key: k,
      customData: {},
      getFrameNames: () => [],
      get: () => null,
    })
  }

  const createdAnims = new Map()

  return {
    load: {
      atlas: vi.fn((key, image, json) => {
        queuedAtlases.push({ key, image, json })
      }),
      isLoading: vi.fn(() => false),
      start: vi.fn(),
      list: { size: 0 },
    },
    textures: {
      exists: vi.fn((key) => loadedTextureMap.has(key)),
      get: vi.fn((key) => loadedTextureMap.get(key) || null),
      getTextureKeys: vi.fn(() => Array.from(loadedTextureMap.keys())),
      remove: vi.fn((key) => loadedTextureMap.delete(key)),
      _addTexture: (key, textureObj) => loadedTextureMap.set(key, textureObj),
      _map: loadedTextureMap,
    },
    anims: {
      create: vi.fn((config) => {
        createdAnims.set(config.key, config)
        return config
      }),
      exists: vi.fn((key) => createdAnims.has(key)),
      remove: vi.fn((key) => createdAnims.delete(key)),
      _created: createdAnims,
    },
    queuedAtlases,
  }
}

describe('AssetRegistry — Manifest Group Loading', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('loads the "boot" group by queuing fx_common, critters, and all knight sheets', () => {
    const loadedKeys = registry.loadGroup('boot')

    expect(registry.isGroupLoaded('boot')).toBe(true)
    expect(loadedKeys).toContain('fx_common')
    expect(loadedKeys).toContain('critters')
    expect(loadedKeys).toContain('knight')
    expect(loadedKeys).toContain('knight_attack')
    expect(loadedKeys).toContain('knight_attack2')
    expect(loadedKeys).toContain('knight_block')
    expect(loadedKeys).toContain('knight_charged')
    expect(loadedKeys).toContain('knight_death')
    expect(loadedKeys).toContain('knight_dodge')
    expect(loadedKeys).toContain('knight_run')

    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'knight',
      'assets/characters/knight/knight.png',
      'assets/characters/knight/knight.json'
    )
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'critters',
      'assets/ambient/critters/critters.png',
      'assets/ambient/critters/critters.json'
    )
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'fx_common',
      'assets/fx/fx_common/fx_common.png',
      'assets/fx/fx_common/fx_common.json'
    )
  })

  it('does not re-queue sheets that already exist in textures cache', () => {
    mockScene.textures._addTexture('knight', { key: 'knight' })

    registry.loadGroup('boot')

    const knightQueued = mockScene.queuedAtlases.some((item) => item.key === 'knight')
    expect(knightQueued).toBe(false)

    // Other sheets that do not exist should still be queued
    const attackQueued = mockScene.queuedAtlases.some((item) => item.key === 'knight_attack')
    expect(attackQueued).toBe(true)
  })

  it('loads single-sheet assets like red_dragon_p1_a in boss_p1', () => {
    const loadedKeys = registry.loadGroup('boss_p1')

    expect(loadedKeys).toEqual(['red_dragon_p1_a', 'red_dragon_p1_b'])
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'red_dragon_p1_a',
      'assets/boss/red_dragon/red_dragon_p1_a.png',
      'assets/boss/red_dragon/red_dragon_p1_a.json'
    )
  })

  it('warns gracefully when an unknown group is requested', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = registry.loadGroup('nonexistent_group')
    expect(res).toEqual([])
    expect(registry.isGroupLoaded('nonexistent_group')).toBe(false)
    warnSpy.mockRestore()
  })
})

describe('AssetRegistry — Animation Creation from Meta', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('creates directional animations from atlas metadata with fps and loop', () => {
    registry.loadGroup('boot')

    // Simulate texture cache populated with knight atlas meta
    mockScene.textures._addTexture('knight', {
      key: 'knight',
      customData: {
        meta: {
          anims: {
            walk: {
              frames: 8,
              directions: ['down', 'left', 'right', 'up'],
              frameNames: 'knight_walk_<dir>_<i>',
              fps: 10,
              loop: true,
            },
            hurt: {
              frames: 5,
              directions: ['down', 'left', 'right', 'up'],
              frameNames: 'knight_hurt_<dir>_<i>',
              fps: 12,
              loop: false,
            },
          },
        },
      },
    })

    const created = registry.createAnims('boot')

    expect(created).toContain('knight_walk_down')
    expect(created).toContain('knight_walk_left')
    expect(created).toContain('knight_walk_right')
    expect(created).toContain('knight_walk_up')
    expect(created).toContain('knight_hurt_down')

    expect(mockScene.anims.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'knight_walk_down',
        frameRate: 10,
        repeat: -1, // loop: true -> -1
      })
    )

    expect(mockScene.anims.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'knight_hurt_down',
        frameRate: 12,
        repeat: 0, // loop: false -> 0
      })
    )
  })

  it('creates animations with per-frame durations for archer', () => {
    registry.loadGroup('wilderness')

    const archerDurations = [120, 100, 100, 120, 250, 70, 100, 120]
    mockScene.textures._addTexture('goblin_archer', {
      key: 'goblin_archer',
      customData: {
        meta: {
          anims: {
            attack: {
              frames: 8,
              directions: ['down', 'left', 'right', 'up'],
              frameNames: 'goblin_archer_attack_<dir>_<i>',
              fps: 9,
              frameDurationsMs: archerDurations,
              loop: false,
            },
          },
        },
      },
    })

    const created = registry.createAnims('wilderness')

    expect(created).toContain('goblin_archer_attack_right')
    const attackCall = mockScene.anims.create.mock.calls.find(
      (c) => c[0].key === 'goblin_archer_attack_right'
    )
    expect(attackCall).toBeDefined()
    expect(attackCall[0].frames).toHaveLength(8)
    expect(attackCall[0].frames[4].duration).toBe(250)
    expect(attackCall[0].frames[5].duration).toBe(70)
  })

  it('creates non-directional animations for fx_common', () => {
    registry.loadGroup('boot')

    mockScene.textures._addTexture('fx_common', {
      key: 'fx_common',
      customData: {
        meta: {
          anims: {
            hit_spark: {
              frames: 4,
              fps: 20,
              loop: false,
              frameNames: 'fx_hit_spark_<i>',
            },
          },
        },
      },
    })

    const created = registry.createAnims('boot')
    expect(created).toContain('fx_common_hit_spark')
    expect(mockScene.anims.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'fx_common_hit_spark',
        frameRate: 20,
        repeat: 0,
      })
    )
  })
})

describe('AssetRegistry — Origin and Sheet Anchors', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('reads distinct anchors dynamically from sheet metadata', () => {
    registry.loadGroup('boot')

    // knight sheet anchor
    const knightAnchor = registry.getAnchor('knight')
    expect(knightAnchor.x).toBeCloseTo(0.5)
    expect(knightAnchor.y).toBeCloseTo(0.9271)

    // knight death has distinct anchor (0.8558)
    const deathAnchor = registry.getAnchor('knight_death')
    expect(deathAnchor.x).toBeCloseTo(0.5)
    expect(deathAnchor.y).toBeCloseTo(0.8558)

    // critters anchor (0.875)
    const crittersAnchor = registry.getAnchor('critters')
    expect(crittersAnchor.x).toBeCloseTo(0.5)
    expect(crittersAnchor.y).toBeCloseTo(0.875)

    // fx_common anchor (0.5)
    const fxAnchor = registry.getAnchor('fx_common')
    expect(fxAnchor.x).toBe(0.5)
    expect(fxAnchor.y).toBe(0.5)
  })

  it('reads dragon anchor (0.7812) for red dragon phase sheets', () => {
    registry.loadGroup('boss_p1')
    const dragonAnchor = registry.getAnchor('red_dragon_p1_a')
    expect(dragonAnchor.x).toBeCloseTo(0.5)
    expect(dragonAnchor.y).toBeCloseTo(0.7812)
  })

  it('sets sprite origin dynamically via setOriginFromAnchor', () => {
    registry.loadGroup('boot')

    const mockSprite = {
      setOrigin: vi.fn(),
    }

    const applied = registry.setOriginFromAnchor(mockSprite, 'knight')
    expect(applied.x).toBeCloseTo(0.5)
    expect(applied.y).toBeCloseTo(0.9271)
    expect(mockSprite.setOrigin).toHaveBeenCalledWith(applied.x, applied.y)

    const appliedDeath = registry.setOriginFromAnchor(mockSprite, 'knight_death')
    expect(appliedDeath.y).toBeCloseTo(0.8558)
    expect(mockSprite.setOrigin).toHaveBeenCalledWith(appliedDeath.x, appliedDeath.y)
  })
})

describe('AssetRegistry — Unload Group and Reference Counting', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('unloads a group, removing textures and animations', () => {
    registry.loadGroup('boss_p1')

    mockScene.textures._addTexture('red_dragon_p1_a', {
      key: 'red_dragon_p1_a',
      customData: {
        meta: {
          anims: {
            hover: { frames: 6, fps: 10, loop: true, frameNames: 'red_dragon_hover_<dir>_<i>' },
          },
        },
      },
    })
    registry.createAnims('boss_p1')

    expect(registry.isGroupLoaded('boss_p1')).toBe(true)

    const unloaded = registry.unloadGroup('boss_p1')
    expect(unloaded).toBe(true)
    expect(registry.isGroupLoaded('boss_p1')).toBe(false)

    // Textures removed
    expect(mockScene.textures.remove).toHaveBeenCalledWith('red_dragon_p1_a')
    expect(mockScene.textures.remove).toHaveBeenCalledWith('red_dragon_p1_b')

    // Animations removed
    expect(mockScene.anims.remove).toHaveBeenCalled()
  })

  it('preserves shared sheets across multiple groups until all groups unload', () => {
    registry.loadGroup('boot')
    registry.loadGroup('village')

    // Both groups share 'knight'
    registry.unloadGroup('boot')

    // 'knight' should NOT be removed yet because 'village' is still loaded
    expect(mockScene.textures.remove).not.toHaveBeenCalledWith('knight')

    // Unloading village now evicts knight
    registry.unloadGroup('village')
    expect(mockScene.textures.remove).toHaveBeenCalledWith('knight')
  })
})

describe('AssetRegistry — Dragon Boss Phase Lazy-Loading and Eviction', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('loads dragon phase 1, phase 2 (+p2_land), and phase 3 groups', () => {
    const p1Sheets = registry.loadDragonPhase(1)
    expect(p1Sheets).toEqual(['red_dragon_p1_a', 'red_dragon_p1_b'])

    const p2Sheets = registry.loadDragonPhase(2)
    expect(p2Sheets).toEqual(['red_dragon_p2_a', 'red_dragon_p2_b', 'red_dragon_p2_land'])

    const p3Sheets = registry.loadDragonPhase(3)
    expect(p3Sheets).toEqual(['red_dragon_p3_a', 'red_dragon_p3_b'])
  })

  it('evicts previous phase textures and loads new phase via transitionDragonPhase', () => {
    // 1. Load phase 1
    registry.loadDragonPhase(1)
    expect(registry.isGroupLoaded('boss_p1')).toBe(true)

    // 2. Transition to phase 2: evicts phase 1
    const result = registry.transitionDragonPhase(2, 1)

    expect(registry.isGroupLoaded('boss_p1')).toBe(false)
    expect(registry.isGroupLoaded('boss_p2')).toBe(true)
    expect(result.loadedSheets).toEqual(['red_dragon_p2_a', 'red_dragon_p2_b', 'red_dragon_p2_land'])
    expect(result.transitionDurationMs).toBeLessThan(100)

    expect(mockScene.textures.remove).toHaveBeenCalledWith('red_dragon_p1_a')
    expect(mockScene.textures.remove).toHaveBeenCalledWith('red_dragon_p1_b')
  })

  it('creates Phaser animations from meta.animations with explicit frame arrays', () => {
    registry.loadDragonPhase(1)

    mockScene.textures._addTexture('red_dragon_p1_a', {
      key: 'red_dragon_p1_a',
      customData: {
        meta: {
          animations: {
            idle_left: {
              frames: ['red_dragon_idle_left_0', 'red_dragon_idle_left_1'],
              frameRate: 8,
              repeat: -1,
            },
            claw_right: {
              frames: ['red_dragon_claw_right_0', 'red_dragon_claw_right_1', 'red_dragon_claw_right_2'],
              frameRate: 12,
              repeat: 0,
            },
          },
        },
      },
    })

    const createdKeys = registry.createAnims('boss_p1')

    expect(createdKeys).toContain('red_dragon_idle_left')
    expect(createdKeys).toContain('red_dragon_claw_right')

    expect(mockScene.anims.create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'red_dragon_idle_left',
        frameRate: 8,
        repeat: -1,
        frames: [
          { key: 'red_dragon_p1_a', frame: 'red_dragon_idle_left_0' },
          { key: 'red_dragon_p1_a', frame: 'red_dragon_idle_left_1' },
        ],
      })
    )
  })

  it('rejects loading legacy v1 dragon_fx', () => {
    const v1Manifest = {
      groups: { bad_boss: ['legacy_dragon_fx'] },
      assets: {
        legacy_dragon_fx: {
          id: 'legacy_dragon_fx',
          sheets: {
            dragon_fx: {
              key: 'dragon_fx',
              image: 'assets/boss/red_dragon/dragon_fx.png',
              json: 'assets/boss/red_dragon/dragon_fx.json',
            },
          },
        },
      },
    }
    const badRegistry = new AssetRegistry(mockScene, v1Manifest)
    expect(() => {
      badRegistry.loadGroup('bad_boss')
    }).toThrow(/Legacy v1 dragon_fx is deprecated/i)
  })
})

describe('AssetRegistry — AS-3 Groups Loading (Interiors, Cavern, Loot, Boss FX Extra)', () => {
  let mockScene
  let registry

  beforeEach(() => {
    mockScene = createMockScene()
    registry = new AssetRegistry(mockScene, defaultManifest)
  })

  it('loads interiors group (interior_props, npc_bartender, npc_vendor)', () => {
    const loadedKeys = registry.loadGroup('interiors')
    expect(registry.isGroupLoaded('interiors')).toBe(true)
    expect(loadedKeys).toContain('interior_props')
    expect(loadedKeys).toContain('npc_bartender')
    expect(loadedKeys).toContain('npc_vendor')

    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'interior_props',
      'assets/env/interior_props/interior_props.png',
      'assets/env/interior_props/interior_props.json'
    )
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'npc_bartender',
      'assets/npcs/npc_bartender/npc_bartender.png',
      'assets/npcs/npc_bartender/npc_bartender.json'
    )
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'npc_vendor',
      'assets/npcs/npc_vendor/npc_vendor.png',
      'assets/npcs/npc_vendor/npc_vendor.json'
    )
  })

  it('loads cavern group (dungeon_props, dungeon_brazier, treasure_chest)', () => {
    const loadedKeys = registry.loadGroup('cavern')
    expect(registry.isGroupLoaded('cavern')).toBe(true)
    expect(loadedKeys).toContain('dungeon_props')
    expect(loadedKeys).toContain('dungeon_brazier')
    expect(loadedKeys).toContain('treasure_chest')
  })

  it('loads loot group (loot_pickups)', () => {
    const loadedKeys = registry.loadGroup('loot')
    expect(registry.isGroupLoaded('loot')).toBe(true)
    expect(loadedKeys).toContain('loot_pickups')
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'loot_pickups',
      'assets/loot/loot_pickups/loot_pickups.png',
      'assets/loot/loot_pickups/loot_pickups.json'
    )
  })

  it('loads boss_fx_extra group (dragon_fx_extra)', () => {
    const loadedKeys = registry.loadGroup('boss_fx_extra')
    expect(registry.isGroupLoaded('boss_fx_extra')).toBe(true)
    expect(loadedKeys).toContain('dragon_fx_extra')
    expect(mockScene.load.atlas).toHaveBeenCalledWith(
      'dragon_fx_extra',
      'assets/boss/red_dragon/fx_extra/dragon_fx_extra.png',
      'assets/boss/red_dragon/fx_extra/dragon_fx_extra.json'
    )
  })

  it('resolves dynamic anchors for AS-3 assets from manifest', () => {
    registry.loadGroup('interiors')
    registry.loadGroup('cavern')
    registry.loadGroup('loot')
    registry.loadGroup('boss_fx_extra')

    expect(registry.getAnchor('interior_props')).toEqual({ x: 0.5, y: 1.0 })
    expect(registry.getAnchor('npc_bartender')).toEqual({ x: 0.5, y: 0.9271 })
    expect(registry.getAnchor('npc_vendor')).toEqual({ x: 0.5, y: 0.9271 })
    expect(registry.getAnchor('loot_pickups')).toEqual({ x: 0.5, y: 0.875 })
    expect(registry.getAnchor('dragon_fx_extra')).toEqual({ x: 0.5, y: 0.5 })
  })
})
