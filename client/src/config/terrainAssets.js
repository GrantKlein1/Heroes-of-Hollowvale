/**
 * Terrain asset manifest — Phase 0 stub.
 *
 * Track A owns the real body of this file and the PNGs under
 * client/public/images/terrain/. Until then, re-export the fixture manifest
 * so Tracks B/C/D can develop in isolation.
 *
 * @typedef {{
 *   id: string,
 *   src: string,
 *   w: number,
 *   h: number,
 *   category: 'ground'|'object',
 *   collide: boolean,
 *   footprint: { x: number, y: number, w: number, h: number },
 *   anchor: 'bottom'|'center',
 *   biomes: string[],
 *   weight: number
 * }} TerrainAsset
 */

import { FIXTURE_MANIFEST } from '../game/terrain/__fixtures__/fixtureManifest.js'

/** @type {TerrainAsset[]} */
export const TERRAIN_ASSETS = FIXTURE_MANIFEST

const byId = new Map(TERRAIN_ASSETS.map((a) => [a.id, a]))

/** @param {string} id @returns {TerrainAsset|undefined} */
export function getAsset(id) {
  return byId.get(id)
}

/** @param {string} biome @returns {TerrainAsset[]} */
export function assetsForBiome(biome) {
  return TERRAIN_ASSETS.filter((a) => a.biomes.includes(biome))
}
