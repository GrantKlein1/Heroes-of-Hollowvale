/**
 * Tiled .tmj MapLoader (32px standard grid).
 *
 * Implements:
 * - 7 canonical layers: ground, ground_detail, walls, props, collision, zones, overhead
 * - Collision handling via setCollisionByProperty and prop footprint bodies
 * - Feet-anchored Y-sorting via depth.js
 * - Zones extraction and registry via zones.js
 * - Sweep collision prevention for player / entity colliders
 * - Flag check for `?maps=tiled`
 */

import {
  MAP_LAYERS,
  LAYER_DEPTHS,
  getLayerDepth,
  calculateDepth,
  resolveFeetY,
  applyDepth,
  sortByFeet,
} from './depth.js'
import { parseZonesLayer, ZonesRegistry } from './zones.js'

/**
 * Checks if Tiled maps are enabled via URL search param `?maps=tiled`.
 *
 * @param {string} [search] - Optional query string; defaults to window.location.search
 * @returns {boolean}
 */
export function isTiledMapsEnabled(search) {
  let searchStr = search
  if (searchStr === undefined && typeof window !== 'undefined' && window.location) {
    searchStr = window.location.search
  }
  if (typeof searchStr === 'string' && searchStr.length > 0) {
    const clean = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
    const params = new URLSearchParams(clean)
    const val = params.get('maps')
    return val === 'tiled' || val === '1' || val === 'true'
  }
  return false
}

/**
 * Parses embedded footprint JSON from prop object properties or attributes.
 *
 * @param {object} propObj - Raw Tiled prop object
 * @returns {{ x: number, y: number, width: number, height: number, shape: string }}
 */
export function parsePropFootprint(propObj) {
  const px = Number(propObj.x) || 0
  const py = Number(propObj.y) || 0
  const pw = Number(propObj.width) || 32
  const ph = Number(propObj.height) || 32

  // Default fallback footprint: bottom 25% of prop bounding box
  let fp = {
    x: 0,
    y: Math.round(ph * 0.75),
    w: pw,
    h: Math.max(8, Math.round(ph * 0.25)),
    shape: 'rect',
  }

  // Look for custom footprint property
  const props = propObj.properties
  let rawFootprint = null
  if (Array.isArray(props)) {
    const match = props.find((p) => p && p.name === 'footprint')
    if (match) rawFootprint = match.value
  } else if (props && typeof props.footprint !== 'undefined') {
    rawFootprint = props.footprint
  }

  if (typeof rawFootprint === 'string') {
    try {
      rawFootprint = JSON.parse(rawFootprint)
    } catch {
      rawFootprint = null
    }
  }

  if (rawFootprint && typeof rawFootprint === 'object') {
    const shape = String(rawFootprint.shape || 'rect').toLowerCase()
    if (shape === 'none') {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        shape: 'none',
      }
    }

    // Relative to prop feet or prop origin
    const rawW = rawFootprint.w ?? rawFootprint.width
    const rawH = rawFootprint.h ?? rawFootprint.height
    const w = Number.isFinite(Number(rawW)) ? Number(rawW) : fp.w
    const h = Number.isFinite(Number(rawH)) ? Number(rawH) : fp.h
    const relX = Number(rawFootprint.x) || 0
    const relY = Number(rawFootprint.y) || 0

    // If offset is centered around feet (negative x, e.g. -16)
    const centerX = px + pw / 2
    const feetY = py + ph

    let worldX = px + relX
    let worldY = py + relY

    if (relX < 0) {
      worldX = centerX + relX
    }
    if (relY <= 0) {
      worldY = feetY + relY
    }

    return {
      x: worldX,
      y: worldY,
      width: w,
      height: h,
      shape,
    }
  }

  return {
    x: px + fp.x,
    y: py + fp.y,
    width: fp.w,
    height: fp.h,
    shape: 'rect',
  }
}

/**
 * Tiled MapLoader for 32px maps.
 */
export class MapLoader {
  /**
   * @param {object} mapData - Parsed Tiled .tmj JSON object
   * @param {object} [options]
   * @param {import('phaser').Scene} [options.scene] - Optional Phaser Scene instance
   * @param {boolean} [options.debug=false] - Debug visualization flag
   */
  constructor(mapData, options = {}) {
    if (!mapData || typeof mapData !== 'object') {
      throw new Error('MapLoader requires valid Tiled map data')
    }

    this.data = mapData
    this.scene = options.scene || null
    this.debug = Boolean(options.debug)

    // Grid metrics
    this.tileWidth = Number(mapData.tilewidth) || 32
    this.tileHeight = Number(mapData.tileheight) || 32
    this.width = Number(mapData.width) || 0
    this.height = Number(mapData.height) || 0
    this.worldWidth = this.width * this.tileWidth
    this.worldHeight = this.height * this.tileHeight

    // Layer collections
    this.layers = new Map()
    this.tilemapLayers = new Map() // Phaser TilemapLayers if scene provided
    this.phaserTilemap = null

    // Collision metadata
    this.collidingGids = new Set()
    this.collisionGrid = [] // 2D boolean array [y][x]
    this.propFootprints = [] // Array of { id, name, bounds, shape, feetY }
    this.propObjects = [] // Array of parsed props

    // Zones
    this.zones = new ZonesRegistry([])

    this._initTilesets()
    this._initLayers()
    this._initCollision()
    this._initProps()
    this._initZones()
  }

  /**
   * Builds GID lookup and records tile properties (e.g. collides: true).
   * @private
   */
  _initTilesets() {
    this.tilesets = Array.isArray(this.data.tilesets) ? this.data.tilesets : []
    this.gidProperties = new Map()

    for (const ts of this.tilesets) {
      const firstgid = Number(ts.firstgid) || 1
      if (Array.isArray(ts.tiles)) {
        for (const t of ts.tiles) {
          const gid = firstgid + Number(t.id)
          const props = {}
          if (Array.isArray(t.properties)) {
            for (const p of t.properties) {
              if (p && p.name) props[p.name] = p.value
            }
          } else if (t.properties && typeof t.properties === 'object') {
            Object.assign(props, t.properties)
          }
          this.gidProperties.set(gid, props)
          if (props.collides === true) {
            this.collidingGids.add(gid)
          }
        }
      }
    }
  }

  /**
   * Indexes all layers by name.
   * @private
   */
  _initLayers() {
    const rawLayers = Array.isArray(this.data.layers) ? this.data.layers : []
    for (const layer of rawLayers) {
      if (layer && layer.name) {
        this.layers.set(layer.name, layer)
      }
    }
  }

  /**
   * Initializes 2D collision lookup grid from the 'collision' layer
   * and any tile layers with 'collides: true' tiles.
   * @private
   */
  _initCollision() {
    this.collisionGrid = Array.from({ length: this.height }, () =>
      new Array(this.width).fill(false)
    )

    // 1. Process dedicated 'collision' layer (all non-zero tiles collide by default)
    const collisionLayer = this.layers.get('collision')
    if (collisionLayer && Array.isArray(collisionLayer.data)) {
      const data = collisionLayer.data
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const gid = data[r * this.width + c]
          if (gid && gid > 0) {
            this.collisionGrid[r][c] = true
          }
        }
      }
    }

    // 2. Process tiles with collides === true across walls and other tilelayers
    const wallsLayer = this.layers.get('walls')
    if (wallsLayer && Array.isArray(wallsLayer.data)) {
      const data = wallsLayer.data
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const gid = data[r * this.width + c]
          if (gid && this.collidingGids.has(gid)) {
            this.collisionGrid[r][c] = true
          }
        }
      }
    }
  }

  /**
   * Parses prop objects, calculates their footprints and feet depths.
   * @private
   */
  _initProps() {
    const propsLayer = this.layers.get('props')
    if (!propsLayer) return

    const rawObjects = Array.isArray(propsLayer.objects) ? propsLayer.objects : []
    for (const raw of rawObjects) {
      const fp = parsePropFootprint(raw)
      const feetY = resolveFeetY(raw)
      const depth = calculateDepth(feetY)
      const tall = Boolean(raw.properties?.find?.((p) => p.name === 'tall')?.value)
      const layer = raw.properties?.find?.((p) => p.name === 'layer')?.value || 'props'
      const isOverhead = layer === 'overhead'

      const propEntry = {
        id: raw.id,
        name: raw.name || 'prop',
        type: raw.type || 'prop',
        x: raw.x || 0,
        y: raw.y || 0,
        width: raw.width || 32,
        height: raw.height || 32,
        feetY,
        depth: isOverhead ? LAYER_DEPTHS.overhead : depth,
        footprint: fp,
        tall,
        layer,
        raw,
      }

      this.propObjects.push(propEntry)

      // Only add to solid footprints if it has a non-empty collision shape and is not overhead
      if (fp.shape !== 'none' && fp.width > 0 && fp.height > 0 && layer !== 'overhead') {
        this.propFootprints.push({
          id: raw.id,
          name: raw.name || 'prop',
          bounds: { x: fp.x, y: fp.y, width: fp.width, height: fp.height },
          shape: fp.shape,
          feetY,
        })
      }
    }
  }

  /**
   * Parses the zones layer into a ZonesRegistry.
   * @private
   */
  _initZones() {
    const zonesLayer = this.layers.get('zones')
    this.zones = parseZonesLayer(zonesLayer)
  }

  /**
   * Returns a layer by name.
   * @param {string} name
   * @returns {object|undefined}
   */
  getLayer(name) {
    return this.layers.get(name)
  }

  /**
   * Returns a map of all indexed layers.
   * @returns {Map<string, object>}
   */
  getLayers() {
    return this.layers
  }

  /**
   * Checks whether a layer exists.
   * @param {string} name
   * @returns {boolean}
   */
  hasLayer(name) {
    return this.layers.has(name)
  }

  /**
   * Validates that all canonical layers are present.
   * @returns {{ valid: boolean, missing: string[] }}
   */
  validateLayers() {
    const missing = MAP_LAYERS.filter((name) => !this.layers.has(name))
    return {
      valid: missing.length === 0,
      missing,
    }
  }

  /**
   * Returns parsed zones registry.
   * @returns {ZonesRegistry}
   */
  getZones() {
    return this.zones
  }

  /**
   * Returns zone by name.
   * @param {string} name
   * @returns {import('./zones.js').ParsedZone|undefined}
   */
  getZone(name) {
    return this.zones.getByName(name)
  }

  /**
   * Returns all exit zones.
   * @returns {import('./zones.js').ParsedZone[]}
   */
  getExits() {
    return this.zones.getExits()
  }

  /**
   * Returns all spawn zones.
   * @returns {import('./zones.js').ParsedZone[]}
   */
  getSpawns() {
    return this.zones.getSpawns()
  }

  /**
   * Sets collision by tile property across a tilemap layer.
   * Mirrors Phaser TilemapLayer.setCollisionByProperty({ collides: true }).
   *
   * @param {Record<string, any>} [propertyFilter={ collides: true }]
   * @param {string} [layerName='collision']
   */
  setCollisionByProperty(propertyFilter = { collides: true }, layerName = 'collision') {
    // If running in a Phaser scene with a TilemapLayer:
    const tilemapLayer = this.tilemapLayers.get(layerName)
    if (tilemapLayer && typeof tilemapLayer.setCollisionByProperty === 'function') {
      tilemapLayer.setCollisionByProperty(propertyFilter)
    }

    // Update internal collision grid
    const layer = this.layers.get(layerName)
    if (layer && Array.isArray(layer.data)) {
      const data = layer.data
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          const gid = data[r * this.width + c]
          if (!gid) continue
          const props = this.gidProperties.get(gid)
          if (props) {
            let matches = true
            for (const [k, v] of Object.entries(propertyFilter)) {
              if (props[k] !== v) {
                matches = false
                break
              }
            }
            if (matches) {
              this.collisionGrid[r][c] = true
            }
          }
        }
      }
    }
  }

  /**
   * Tests whether a grid tile is a collision obstacle.
   *
   * @param {number} col
   * @param {number} row
   * @returns {boolean}
   */
  isTileColliding(col, row) {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return true // Out of map bounds is colliding
    }
    return Boolean(this.collisionGrid[row]?.[col])
  }

  /**
   * Tests whether a world coordinate (px, py) is blocked by a collision tile
   * or a prop footprint body.
   *
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isBlockedPoint(x, y) {
    if (x < 0 || x >= this.worldWidth || y < 0 || y >= this.worldHeight) {
      return true
    }
    const col = Math.floor(x / this.tileWidth)
    const row = Math.floor(y / this.tileHeight)
    if (this.isTileColliding(col, row)) {
      return true
    }
    for (const prop of this.propFootprints) {
      const b = prop.bounds
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return true
      }
    }
    return false
  }

  /**
   * Tests whether an AABB intersects any collision tile or prop footprint.
   *
   * @param {{ x: number, y: number, width?: number, height?: number, w?: number, h?: number }} rect
   * @returns {boolean}
   */
  checkCollision(rect) {
    const rx = rect.x
    const ry = rect.y
    const rw = rect.width ?? rect.w ?? 0
    const rh = rect.height ?? rect.h ?? 0

    // Out of map bounds
    if (rx < 0 || ry < 0 || rx + rw > this.worldWidth || ry + rh > this.worldHeight) {
      return true
    }

    // Check intersecting tile cells
    const minCol = Math.floor(rx / this.tileWidth)
    const maxCol = Math.floor((rx + rw - 0.001) / this.tileWidth)
    const minRow = Math.floor(ry / this.tileHeight)
    const maxRow = Math.floor((ry + rh - 0.001) / this.tileHeight)

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (this.isTileColliding(c, r)) {
          return true
        }
      }
    }

    // Check prop footprint bodies
    for (const prop of this.propFootprints) {
      const b = prop.bounds
      if (!(rx + rw <= b.x || rx >= b.x + b.width || ry + rh <= b.y || ry >= b.y + b.height)) {
        return true
      }
    }

    return false
  }

  /**
   * Continuous collision sweep for moving a rectangular collider.
   * Prevents player/collider from entering collision tiles or prop footprint bodies.
   *
   * @param {{ x: number, y: number, width: number, height: number }} collider - Initial AABB
   * @param {number} deltaX - Desired movement in X
   * @param {number} deltaY - Desired movement in Y
   * @returns {{
   *   x: number,
   *   y: number,
   *   collided: boolean,
   *   collidedX: boolean,
   *   collidedY: boolean,
   *   blocked: boolean
   * }} Resulting safe position and collision flags
   */
  sweep(collider, deltaX, deltaY) {
    let currentX = collider.x
    let currentY = collider.y
    const width = collider.width
    const height = collider.height

    let collidedX = false
    let collidedY = false

    // Step axis-by-axis with fine sub-stepping (maximum 4px per step) to avoid tunnelling
    const stepSize = 4

    // 1. Sweep X axis
    if (deltaX !== 0) {
      const signX = Math.sign(deltaX)
      let remainingX = Math.abs(deltaX)

      while (remainingX > 0) {
        const step = Math.min(stepSize, remainingX)
        const nextX = currentX + signX * step
        if (this.checkCollision({ x: nextX, y: currentY, width, height })) {
          // Collision detected: advance as close as possible with 1px precision
          collidedX = true
          let safeX = currentX
          for (let p = 1; p < step; p++) {
            const probeX = currentX + signX * p
            if (this.checkCollision({ x: probeX, y: currentY, width, height })) {
              break
            }
            safeX = probeX
          }
          currentX = safeX
          break
        }
        currentX = nextX
        remainingX -= step
      }
    }

    // 2. Sweep Y axis
    if (deltaY !== 0) {
      const signY = Math.sign(deltaY)
      let remainingY = Math.abs(deltaY)

      while (remainingY > 0) {
        const step = Math.min(stepSize, remainingY)
        const nextY = currentY + signY * step
        if (this.checkCollision({ x: currentX, y: nextY, width, height })) {
          // Collision detected: advance as close as possible with 1px precision
          collidedY = true
          let safeY = currentY
          for (let p = 1; p < step; p++) {
            const probeY = currentY + signY * p
            if (this.checkCollision({ x: currentX, y: probeY, width, height })) {
              break
            }
            safeY = probeY
          }
          currentY = safeY
          break
        }
        currentY = nextY
        remainingY -= step
      }
    }

    const collided = collidedX || collidedY
    return {
      x: currentX,
      y: currentY,
      collided,
      collidedX,
      collidedY,
      blocked: collided,
    }
  }

  /**
   * Y-sorts an array or Phaser group of display objects by their feet Y coordinates.
   *
   * @param {Array<object>} objects
   * @returns {Array<object>}
   */
  ySort(objects) {
    if (!Array.isArray(objects)) return []
    for (const obj of objects) {
      const feetY = resolveFeetY(obj)
      applyDepth(obj, feetY)
    }
    return sortByFeet(objects)
  }

  /**
   * Phaser Scene Integration: Builds Phaser TilemapLayers, prop sprites, and physics colliders.
   * Called when running inside an active Phaser scene.
   *
   * @param {import('phaser').Scene} scene
   * @param {object|string} [options={}] - Config object or default tilesetName string for backward compatibility
   * @returns {object} { tilemap, layers, propGroup, propSprites, destroy }
   */
  mount(scene, options = {}) {
    if (!scene || !scene.make || !scene.make.tilemap) {
      return null
    }

    const defaultTilesetName = typeof options === 'string' ? options : (options?.tilesetName || 'placeholder_tiles')
    const defaultTextureKey = typeof options === 'string' ? options : (options?.tilesetTextureKey || defaultTilesetName)
    const mapKey = typeof options === 'object' && options?.key ? options.key : 'brackenford'

    let map = null
    if (scene.cache?.tilemap?.has?.(mapKey)) {
      map = scene.make.tilemap({ key: mapKey })
    } else if (scene.make?.tilemap) {
      if (scene.cache?.tilemap?.add && Phaser?.Tilemaps?.Formats?.TILED_JSON) {
        scene.cache.tilemap.add(mapKey, {
          format: Phaser.Tilemaps.Formats.TILED_JSON,
          data: this.data,
        })
        map = scene.make.tilemap({ key: mapKey })
      } else {
        map = scene.make.tilemap({ data: this.data })
      }
    }

    if (!map) return null
    this.phaserTilemap = map

    // Register all tilesets
    const tilesetImages = []
    if (this.tilesets.length > 0) {
      for (const ts of this.tilesets) {
        const tsName = ts.name
        const texKey = scene.textures?.exists?.(tsName) ? tsName : (options?.tilesetTextureKey || tsName)
        const added = map.addTilesetImage(tsName, texKey)
        if (added) tilesetImages.push(added)
      }
    } else {
      const fallback = map.addTilesetImage(defaultTilesetName, defaultTextureKey)
      if (fallback) tilesetImages.push(fallback)
    }

    // Create tile layers with assigned depths
    for (const layerName of ['ground', 'ground_detail', 'walls', 'collision', 'overhead']) {
      if (this.hasLayer(layerName)) {
        const phaserLayer = map.createLayer(layerName, tilesetImages, 0, 0)
        if (phaserLayer) {
          const depth = getLayerDepth(layerName)
          phaserLayer.setDepth(depth)

          if (layerName === 'collision') {
            phaserLayer.setCollisionByProperty({ collides: true })
            phaserLayer.setVisible(this.debug)
          }

          this.tilemapLayers.set(layerName, phaserLayer)
        }
      }
    }

    // Instantiate prop visual sprites
    const propSprites = []
    const propAtlasKey = (typeof options === 'object' && options?.propAtlasKey) || 'village_props'
    const hasPropAtlas = Boolean(scene.textures?.exists?.(propAtlasKey))

    for (const prop of this.propObjects) {
      const frameName = prop.name
      const px = prop.x + prop.width / 2
      const py = prop.y + prop.height

      if (hasPropAtlas && scene.textures.get(propAtlasKey)?.has?.(frameName)) {
        const sprite = scene.add.image(px, py, propAtlasKey, frameName)
        sprite.setOrigin(0.5, 1.0)
        sprite.setDepth(prop.depth)
        propSprites.push(sprite)
      }
    }
    this.propSprites = propSprites

    // Create static bodies for prop footprints if physics is present
    let propGroup = null
    if (scene.physics && scene.physics.add && scene.physics.add.staticGroup) {
      propGroup = scene.physics.add.staticGroup()
      for (const fp of this.propFootprints) {
        const b = fp.bounds
        const zone = scene.add.zone(b.x + b.width / 2, b.y + b.height / 2, b.width, b.height)
        scene.physics.add.existing(zone, true)
        propGroup.add(zone)
      }
    }
    this.propGroup = propGroup

    // Setup water animation loop if water tiles exist
    this._initWaterAnimation(scene)

    return {
      tilemap: map,
      layers: this.tilemapLayers,
      propGroup,
      propSprites,
      destroy: () => this.destroy(),
    }
  }

  /**
   * Initializes water tile animation loop.
   * Cycles 4 frames (every 160ms) for animated water tiles.
   *
   * @param {import('phaser').Scene} scene
   * @private
   */
  _initWaterAnimation(scene) {
    const groundLayer = this.tilemapLayers.get('ground')
    if (!groundLayer) return

    this.waterTiles = []
    const waterTileset = this.tilesets.find((ts) => ts.name === 'water')
    if (!waterTileset) return

    const firstgid = Number(waterTileset.firstgid) || 41
    const groundData = this.layers.get('ground')?.data || []

    for (let r = 0; r < this.height; r++) {
      for (let c = 0; c < this.width; c++) {
        const gid = groundData[r * this.width + c]
        // Animated water tiles in water.tsj are tiles 1..15 -> GID firstgid + 1 .. firstgid + 15
        if (gid >= firstgid + 1 && gid <= firstgid + 15) {
          const baseTileId = gid - firstgid
          this.waterTiles.push({ col: c, row: r, baseTileId })
        }
      }
    }

    if (this.waterTiles.length === 0) return

    this.waterFrame = 0
    this.waterTimer = null

    if (scene.time && typeof scene.time.addEvent === 'function') {
      this.waterTimer = scene.time.addEvent({
        delay: 160,
        loop: true,
        callback: () => this.stepWaterAnimation(),
      })
    }
  }

  /**
   * Advances water animation by one frame.
   * Each frame advances the tile ID by 16 (4 frames total).
   */
  stepWaterAnimation() {
    const groundLayer = this.tilemapLayers.get('ground')
    if (!groundLayer || !this.waterTiles || this.waterTiles.length === 0) return

    this.waterFrame = (this.waterFrame + 1) % 4
    const waterTileset = this.tilesets.find((ts) => ts.name === 'water')
    const firstgid = Number(waterTileset?.firstgid) || 41
    const frameOffset = this.waterFrame * 16

    for (const t of this.waterTiles) {
      const nextGid = firstgid + t.baseTileId + frameOffset
      if (typeof groundLayer.putTileAt === 'function') {
        groundLayer.putTileAt(nextGid, t.col, t.row)
      }
    }
  }

  /**
   * Cleans up timer events, prop sprites, and tilemap layers.
   */
  destroy() {
    if (this.waterTimer) {
      if (typeof this.waterTimer.remove === 'function') {
        this.waterTimer.remove()
      } else if (typeof this.waterTimer.destroy === 'function') {
        this.waterTimer.destroy()
      }
      this.waterTimer = null
    }
    if (Array.isArray(this.propSprites)) {
      for (const sprite of this.propSprites) {
        if (sprite && typeof sprite.destroy === 'function') {
          sprite.destroy()
        }
      }
      this.propSprites = []
    }
    if (this.propGroup) {
      if (typeof this.propGroup.clear === 'function') {
        this.propGroup.clear(true, true)
      }
      this.propGroup = null
    }
    if (this.phaserTilemap) {
      if (typeof this.phaserTilemap.destroy === 'function') {
        this.phaserTilemap.destroy()
      }
      this.phaserTilemap = null
    }
    this.tilemapLayers.clear()
  }
}
