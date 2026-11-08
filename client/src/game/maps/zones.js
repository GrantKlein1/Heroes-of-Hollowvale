/**
 * Tiled zones layer parser and query utilities.
 * Handles exits, spawns, doors, interaction triggers, and encounter areas.
 */

/**
 * Normalizes Tiled properties (array or object) into a key-value dictionary.
 *
 * @param {Array<{ name: string, value: any }> | Record<string, any>} [rawProperties]
 * @returns {Record<string, any>}
 */
export function parseProperties(rawProperties) {
  if (!rawProperties) return {}
  if (Array.isArray(rawProperties)) {
    const dict = {}
    for (const prop of rawProperties) {
      if (prop && typeof prop.name === 'string') {
        dict[prop.name] = prop.value
      }
    }
    return dict
  }
  if (typeof rawProperties === 'object') {
    return { ...rawProperties }
  }
  return {}
}

/**
 * Parsed zone object representation.
 * @typedef {Object} ParsedZone
 * @property {number} id
 * @property {string} name
 * @property {string} type
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {{ x: number, y: number, width: number, height: number }} bounds
 * @property {Record<string, any>} properties
 * @property {boolean} isPoint
 * @property {boolean} isExit
 * @property {boolean} isSpawn
 * @property {boolean} isDoor
 * @property {boolean} isNpc
 */

/**
 * Parses a single raw Tiled object into a normalized zone definition.
 *
 * @param {object} obj - Raw Tiled object
 * @returns {ParsedZone}
 */
export function parseZoneObject(obj) {
  if (!obj) {
    return {
      id: 0,
      name: '',
      type: 'unknown',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      properties: {},
      isPoint: false,
      isExit: false,
      isSpawn: false,
      isDoor: false,
      isNpc: false,
    }
  }

  const id = Number(obj.id) || 0
  const name = String(obj.name || '')
  // Tiled 1.9+ renamed type to class; support both
  const type = String(obj.type || obj.class || '').toLowerCase()
  const x = Number(obj.x) || 0
  const y = Number(obj.y) || 0
  const width = Number(obj.width) || 0
  const height = Number(obj.height) || 0
  const isPoint = Boolean(obj.point) || (width === 0 && height === 0)
  const properties = parseProperties(obj.properties)

  const kind = String(properties.kind || '').toLowerCase()
  const isExit =
    type === 'exit' ||
    kind === 'exit' ||
    name.toLowerCase().startsWith('exit') ||
    Boolean(properties.targetMap || properties.toMap)

  const isSpawn =
    type === 'spawn' ||
    kind === 'spawn' ||
    name.toLowerCase().startsWith('spawn') ||
    Boolean(properties.spawnId)

  const isDoor =
    type === 'door' ||
    kind === 'door' ||
    name.toLowerCase().startsWith('door')

  const isNpc =
    type === 'npc' ||
    kind === 'npc' ||
    Boolean(properties.npcId)

  return {
    id,
    name,
    type: type || (isExit ? 'exit' : isSpawn ? 'spawn' : isDoor ? 'door' : isNpc ? 'npc' : 'trigger'),
    x,
    y,
    width,
    height,
    bounds: { x, y, width, height },
    properties,
    isPoint,
    isExit,
    isSpawn,
    isDoor,
    isNpc,
  }
}

/**
 * Tests if a 2D point is inside a zone's bounding box.
 *
 * @param {ParsedZone} zone
 * @param {number} px
 * @param {number} py
 * @returns {boolean}
 */
export function zoneContainsPoint(zone, px, py) {
  if (!zone) return false
  if (zone.isPoint) {
    // Within 8px radius of a point zone
    const dx = px - zone.x
    const dy = py - zone.y
    return (dx * dx + dy * dy) <= 64
  }
  return (
    px >= zone.x &&
    px <= zone.x + zone.width &&
    py >= zone.y &&
    py <= zone.y + zone.height
  )
}

/**
 * Tests if a rectangle intersects a zone's bounding box.
 *
 * @param {ParsedZone} zone
 * @param {{ x: number, y: number, width?: number, height?: number, w?: number, h?: number }} rect
 * @returns {boolean}
 */
export function zoneIntersectsRect(zone, rect) {
  if (!zone || !rect) return false
  const rw = rect.width ?? rect.w ?? 0
  const rh = rect.height ?? rect.h ?? 0
  const rx = rect.x
  const ry = rect.y

  if (zone.isPoint) {
    return (
      zone.x >= rx &&
      zone.x <= rx + rw &&
      zone.y >= ry &&
      zone.y <= ry + rh
    )
  }

  return !(
    rx + rw < zone.x ||
    rx > zone.x + zone.width ||
    ry + rh < zone.y ||
    ry > zone.y + zone.height
  )
}

/**
 * Zones container offering fast queries.
 */
export class ZonesRegistry {
  /**
   * @param {ParsedZone[]} zones
   */
  constructor(zones = []) {
    this.all = zones
    this._byName = new Map()
    this._byType = new Map()

    for (const z of zones) {
      if (z.name) this._byName.set(z.name, z)
      const list = this._byType.get(z.type) || []
      list.push(z)
      this._byType.set(z.type, list)
    }
  }

  /**
   * Return all parsed zones.
   * @returns {ParsedZone[]}
   */
  getAll() {
    return this.all
  }

  /**
   * Look up zone by exact name.
   * @param {string} name
   * @returns {ParsedZone|undefined}
   */
  getByName(name) {
    return this._byName.get(name)
  }

  /**
   * Get all zones matching given type.
   * @param {string} type
   * @returns {ParsedZone[]}
   */
  getByType(type) {
    return this._byType.get(type?.toLowerCase()) || []
  }

  /**
   * Return all exit zones.
   * @returns {ParsedZone[]}
   */
  getExits() {
    return this.all.filter((z) => z.isExit)
  }

  /**
   * Return all spawn zones.
   * @returns {ParsedZone[]}
   */
  getSpawns() {
    return this.all.filter((z) => z.isSpawn)
  }

  /**
   * Find spawn by name, or default spawn.
   * @param {string} [name]
   * @returns {ParsedZone|undefined}
   */
  getSpawn(name) {
    if (name) {
      const match = this.getByName(name)
      if (match && match.isSpawn) return match
    }
    const spawns = this.getSpawns()
    return spawns.find((s) => s.name === 'default' || s.name === 'spawn_default') || spawns[0]
  }

  /**
   * Find first zone containing point.
   * @param {number} x
   * @param {number} y
   * @returns {ParsedZone|undefined}
   */
  findZoneAt(x, y) {
    return this.all.find((z) => zoneContainsPoint(z, x, y))
  }

  /**
   * Find all zones containing point.
   * @param {number} x
   * @param {number} y
   * @returns {ParsedZone[]}
   */
  findAllZonesAt(x, y) {
    return this.all.filter((z) => zoneContainsPoint(z, x, y))
  }

  /**
   * Find all zones intersecting rectangle.
   * @param {{ x: number, y: number, width?: number, height?: number, w?: number, h?: number }} rect
   * @returns {ParsedZone[]}
   */
  findIntersecting(rect) {
    return this.all.filter((z) => zoneIntersectsRect(z, rect))
  }
}

/**
 * Parses a Tiled object layer into a ZonesRegistry.
 *
 * @param {object} zonesLayer - Tiled object layer named 'zones'
 * @returns {ZonesRegistry}
 */
export function parseZonesLayer(zonesLayer) {
  if (!zonesLayer) return new ZonesRegistry([])
  const objects = Array.isArray(zonesLayer.objects) ? zonesLayer.objects : []
  const parsed = objects.map(parseZoneObject)
  return new ZonesRegistry(parsed)
}
