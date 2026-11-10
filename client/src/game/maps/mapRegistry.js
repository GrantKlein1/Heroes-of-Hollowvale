/**
 * Data-driven Tiled map registry.
 * Maps keys, files, scene IDs, and asset manifest groups for Tiled maps.
 */

export const DEFAULT_MAPS = Object.freeze([
  {
    key: 'brackenford',
    file: 'maps/brackenford.tmj',
    sceneIds: ['village', 'brackenford'],
    assetGroups: ['village'],
  },
  {
    key: 'tavern',
    file: 'maps/tavern.tmj',
    sceneIds: ['tavern'],
    assetGroups: ['village'],
  },
  {
    key: 'market',
    file: 'maps/market.tmj',
    sceneIds: ['market'],
    assetGroups: ['village'],
  },
])

let registry = DEFAULT_MAPS.map((m) => ({ ...m, sceneIds: [...m.sceneIds], assetGroups: [...m.assetGroups] }))

/**
 * Normalizes a file or key identifier for lookup.
 * @param {string} identifier
 * @returns {string}
 */
function normalizeIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return ''
  return identifier.trim().toLowerCase().replace(/^maps\//, '').replace(/\.tmj$/, '')
}

/**
 * Registers a new map entry or updates an existing one.
 * @param {{ key: string, file: string, sceneIds?: string[], assetGroups?: string[] }} entry
 * @returns {{ key: string, file: string, sceneIds: string[], assetGroups: string[] }}
 */
export function registerMap(entry) {
  if (!entry || !entry.key || !entry.file) {
    throw new Error('registerMap requires key and file')
  }
  const normalized = {
    key: String(entry.key),
    file: String(entry.file),
    sceneIds: Array.isArray(entry.sceneIds) ? [...entry.sceneIds] : [String(entry.key)],
    assetGroups: Array.isArray(entry.assetGroups) ? [...entry.assetGroups] : ['village'],
  }

  const existingIndex = registry.findIndex((m) => m.key === normalized.key)
  if (existingIndex >= 0) {
    registry[existingIndex] = normalized
  } else {
    registry.push(normalized)
  }
  return normalized
}

/**
 * Removes a map entry by key.
 * @param {string} key
 * @returns {boolean}
 */
export function unregisterMap(key) {
  const index = registry.findIndex((m) => m.key === key)
  if (index >= 0) {
    registry.splice(index, 1)
    return true
  }
  return false
}

/**
 * Resets map registry to default entries.
 */
export function resetRegistry() {
  registry = DEFAULT_MAPS.map((m) => ({ ...m, sceneIds: [...m.sceneIds], assetGroups: [...m.assetGroups] }))
}

/**
 * Returns all currently registered map entries.
 * @returns {Array<{ key: string, file: string, sceneIds: string[], assetGroups: string[] }>}
 */
export function getAllMaps() {
  return registry.map((m) => ({ ...m, sceneIds: [...m.sceneIds], assetGroups: [...m.assetGroups] }))
}

/**
 * Finds a map entry by its exact key.
 * @param {string} key
 * @returns {{ key: string, file: string, sceneIds: string[], assetGroups: string[] }|undefined}
 */
export function getMapByKey(key) {
  return registry.find((m) => m.key === key)
}

/**
 * Finds a map entry by associated scene ID.
 * @param {string} sceneId
 * @returns {{ key: string, file: string, sceneIds: string[], assetGroups: string[] }|undefined}
 */
export function getMapBySceneId(sceneId) {
  if (!sceneId) return undefined
  return registry.find((m) => m.sceneIds.includes(sceneId))
}

/**
 * Finds a map entry by file path (e.g. 'maps/tavern.tmj' or 'tavern.tmj').
 * @param {string} file
 * @returns {{ key: string, file: string, sceneIds: string[], assetGroups: string[] }|undefined}
 */
export function getMapByFile(file) {
  if (!file) return undefined
  const norm = normalizeIdentifier(file)
  return registry.find((m) => normalizeIdentifier(m.file) === norm || normalizeIdentifier(m.key) === norm)
}

/**
 * Resolves a map entry by key, sceneId, or file.
 * @param {string} identifier
 * @returns {{ key: string, file: string, sceneIds: string[], assetGroups: string[] }|undefined}
 */
export function resolveMap(identifier) {
  if (!identifier) return undefined
  // 1. Exact key match
  const byKey = registry.find((m) => m.key === identifier)
  if (byKey) return byKey

  // 2. Exact sceneId match
  const byScene = registry.find((m) => m.sceneIds.includes(identifier))
  if (byScene) return byScene

  // 3. File or normalized identifier match
  const norm = normalizeIdentifier(identifier)
  const byFile = registry.find((m) => {
    return (
      normalizeIdentifier(m.file) === norm ||
      normalizeIdentifier(m.key) === norm ||
      m.sceneIds.some((s) => s.toLowerCase() === norm)
    )
  })
  return byFile
}
