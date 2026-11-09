import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_MAPS,
  registerMap,
  unregisterMap,
  resetRegistry,
  getAllMaps,
  getMapByKey,
  getMapBySceneId,
  getMapByFile,
  resolveMap,
} from '../mapRegistry.js'

describe('Data-driven Tiled Map Registry (mapRegistry.js)', () => {
  beforeEach(() => {
    resetRegistry()
  })

  it('initializes with the 3 canonical maps: brackenford, tavern, and market', () => {
    const maps = getAllMaps()
    expect(maps).toHaveLength(3)

    const brackenford = maps.find((m) => m.key === 'brackenford')
    expect(brackenford).toBeDefined()
    expect(brackenford.file).toBe('maps/brackenford.tmj')
    expect(brackenford.sceneIds).toContain('village')
    expect(brackenford.sceneIds).toContain('brackenford')
    expect(brackenford.assetGroups).toContain('village')

    const tavern = maps.find((m) => m.key === 'tavern')
    expect(tavern).toBeDefined()
    expect(tavern.file).toBe('maps/tavern.tmj')
    expect(tavern.sceneIds).toContain('tavern')

    const market = maps.find((m) => m.key === 'market')
    expect(market).toBeDefined()
    expect(market.file).toBe('maps/market.tmj')
    expect(market.sceneIds).toContain('market')
  })

  it('resolves maps by key, sceneId, and filename', () => {
    expect(resolveMap('brackenford')?.key).toBe('brackenford')
    expect(resolveMap('village')?.key).toBe('brackenford')
    expect(resolveMap('maps/brackenford.tmj')?.key).toBe('brackenford')
    expect(resolveMap('brackenford.tmj')?.key).toBe('brackenford')

    expect(resolveMap('tavern')?.key).toBe('tavern')
    expect(resolveMap('maps/tavern.tmj')?.key).toBe('tavern')
    expect(resolveMap('tavern.tmj')?.key).toBe('tavern')

    expect(resolveMap('market')?.key).toBe('market')
    expect(resolveMap('maps/market.tmj')?.key).toBe('market')
  })

  it('returns undefined for unregistered maps or external targets', () => {
    expect(resolveMap('wilderness')).toBeUndefined()
    expect(resolveMap('dungeonInterior')).toBeUndefined()
    expect(resolveMap('nonexistent_map')).toBeUndefined()
  })

  it('allows adding a new map with a single registry entry ("new map = one registry entry")', () => {
    registerMap({
      key: 'crypt',
      file: 'maps/crypt.tmj',
      sceneIds: ['crypt_interior'],
      assetGroups: ['dungeon'],
    })

    const registered = getMapByKey('crypt')
    expect(registered).toBeDefined()
    expect(registered.file).toBe('maps/crypt.tmj')
    expect(registered.sceneIds).toEqual(['crypt_interior'])
    expect(registered.assetGroups).toEqual(['dungeon'])

    // resolveMap routes both sceneId and file to the new map
    expect(resolveMap('crypt_interior')?.key).toBe('crypt')
    expect(resolveMap('maps/crypt.tmj')?.key).toBe('crypt')
    expect(resolveMap('crypt.tmj')?.key).toBe('crypt')

    // getAllMaps includes crypt
    expect(getAllMaps()).toHaveLength(4)
  })

  it('unregisters a map and resets to default cleanly', () => {
    registerMap({ key: 'custom', file: 'maps/custom.tmj' })
    expect(getAllMaps()).toHaveLength(4)

    unregisterMap('custom')
    expect(getAllMaps()).toHaveLength(3)
    expect(resolveMap('custom')).toBeUndefined()

    registerMap({ key: 'custom2', file: 'maps/custom2.tmj' })
    resetRegistry()
    expect(getAllMaps()).toHaveLength(3)
    expect(resolveMap('custom2')).toBeUndefined()
  })

  it('lookup helpers getMapByKey, getMapBySceneId, getMapByFile work accurately', () => {
    expect(getMapByKey('market')?.file).toBe('maps/market.tmj')
    expect(getMapBySceneId('village')?.key).toBe('brackenford')
    expect(getMapByFile('maps/tavern.tmj')?.key).toBe('tavern')
    expect(getMapByFile('tavern.tmj')?.key).toBe('tavern')
  })
})
