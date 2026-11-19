import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAllMaps, resetRegistry } from '../mapRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAPS_DIR = path.resolve(__dirname, '../../../../public/maps')

/**
 * Maps that exist in client/public/maps but are deliberately NOT in mapRegistry.js.
 * Keep this list in sync with docs/maps/unregistered-maps.md. Registering one of
 * these means removing it here (and adding it to DEFAULT_MAPS), so none can be
 * orphaned silently.
 */
const KNOWN_UNREGISTERED = Object.freeze({
  'wilderness.tmj':
    'Reference output of tools/maps/generate_tmj.mjs. The live wilderness is procedural (terrain/*), and HollowvaleScene.enterScene skips the registry for id "wilderness".',
})

function tmjFiles() {
  return fs.readdirSync(MAPS_DIR).filter((f) => f.endsWith('.tmj')).sort()
}

function readMap(file) {
  return JSON.parse(fs.readFileSync(path.join(MAPS_DIR, file), 'utf8'))
}

function exitTargets(map) {
  const zones = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'zones')
  return (zones?.objects ?? [])
    .filter((o) => o.properties?.some((p) => p.name === 'kind' && p.value === 'exit'))
    .map((o) => o.properties.find((p) => p.name === 'targetMap')?.value)
    .filter(Boolean)
}

describe('Known unregistered Tiled maps (MAPS-1)', () => {
  beforeEach(() => resetRegistry())

  it('every .tmj in client/public/maps is either registered or listed as known-unregistered', () => {
    const registered = new Set(getAllMaps().map((m) => path.basename(m.file)))
    const orphans = tmjFiles().filter((f) => !registered.has(f) && !(f in KNOWN_UNREGISTERED))
    expect(orphans).toEqual([])
  })

  it('the known-unregistered list is exactly the maps missing from the registry', () => {
    const registered = new Set(getAllMaps().map((m) => path.basename(m.file)))
    const actual = tmjFiles().filter((f) => !registered.has(f))
    expect(actual).toEqual(Object.keys(KNOWN_UNREGISTERED).sort())
  })

  it('every registered map file exists on disk', () => {
    const files = new Set(tmjFiles())
    for (const m of getAllMaps()) {
      expect(files.has(path.basename(m.file)), m.file).toBe(true)
    }
  })

  it('hearthmile and ruinwatch link to each other and the procedural wilderness, and no other registered map does', () => {
    expect(exitTargets(readMap('hearthmile.tmj')).sort()).toEqual(['ruinwatch.tmj', 'wilderness.tmj'])
    expect(exitTargets(readMap('ruinwatch.tmj'))).toEqual(['hearthmile.tmj'])
    for (const m of getAllMaps()) {
      if (m.key === 'hearthmile' || m.key === 'ruinwatch') continue
      const targets = exitTargets(readMap(path.basename(m.file)))
      expect(targets, m.file).not.toContain('hearthmile.tmj')
      expect(targets, m.file).not.toContain('ruinwatch.tmj')
    }
  })
})
