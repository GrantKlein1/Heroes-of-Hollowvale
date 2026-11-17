import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveMap, resetRegistry } from '../mapRegistry.js'
import { resolvePropAtlasKeys } from '../MapLoader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../../..')

describe('Interior Props & Manifest Validation (Package 3-1b)', () => {
  beforeEach(() => {
    resetRegistry()
  })

  it('verifies resolveMap propAtlases for tavern and market', () => {
    const tavern = resolveMap('tavern')
    const market = resolveMap('market')

    expect(tavern).toBeDefined()
    expect(tavern.propAtlases).toEqual(['interior_props'])

    expect(market).toBeDefined()
    expect(market.propAtlases).toEqual(['interior_props'])
  })

  it('verifies resolvePropAtlasKeys returns interior_props when passed propAtlases from resolveMap', () => {
    for (const key of ['tavern', 'market']) {
      const mapEntry = resolveMap(key)
      const parsedMapProps = {}
      const resolved = resolvePropAtlasKeys({ propAtlasKeys: mapEntry.propAtlases }, parsedMapProps)
      expect(resolved).toEqual(['interior_props'])
    }
  })

  it('verifies every prop object in tavern.tmj and market.tmj exists in interior_props.json', () => {
    const tavernPath = path.join(repoRoot, 'client/public/maps/tavern.tmj')
    const marketPath = path.join(repoRoot, 'client/public/maps/market.tmj')
    const atlasPath = path.join(repoRoot, 'client/public/assets/env/interior_props/interior_props.json')

    const tavern = JSON.parse(fs.readFileSync(tavernPath, 'utf8'))
    const market = JSON.parse(fs.readFileSync(marketPath, 'utf8'))
    const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))

    const atlasFrames = new Set(Object.keys(atlas.frames))

    const tavernPropsLayer = tavern.layers.find((l) => l.name === 'props')
    expect(tavernPropsLayer).toBeDefined()
    const tavernProps = tavernPropsLayer.objects
    expect(tavernProps).toHaveLength(30)
    for (const prop of tavernProps) {
      expect(atlasFrames.has(prop.name)).toBe(true)
    }

    const marketPropsLayer = market.layers.find((l) => l.name === 'props')
    expect(marketPropsLayer).toBeDefined()
    const marketProps = marketPropsLayer.objects
    expect(marketProps).toHaveLength(10)
    for (const prop of marketProps) {
      expect(atlasFrames.has(prop.name)).toBe(true)
    }
  })

  it('verifies the interiors manifest group contains interior_props, npc_bartender, and npc_vendor', () => {
    const manifestPath = path.join(repoRoot, 'client/public/assets/manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    expect(manifest.groups).toBeDefined()
    expect(manifest.groups.interiors).toBeDefined()
    expect(manifest.groups.interiors).toEqual(
      expect.arrayContaining(['interior_props', 'npc_bartender', 'npc_vendor'])
    )
    expect(manifest.groups.interiors).toHaveLength(3)
  })
})
