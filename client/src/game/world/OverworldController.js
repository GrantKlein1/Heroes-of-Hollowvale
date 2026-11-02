/**
 * One continuous league map. Screens are camera windows; walking off an edge
 * slides the camera 250ms onto the next window. Stamped leagues are loaded
 * with Phaser's tilemap loader. Everything else is putTileAt from the seed.
 */

import { eventBus, GameEvents } from '../../lib/eventBus.js'
import { session } from '../session.js'
import { SHEET_COLS, TILE_COUNT, speedFactor } from './tileCatalog.js'
import { BUILDINGS } from './buildings.js'
import { SPRITES } from './spriteManifest.js'
import {
  LEAGUE_H,
  LEAGUE_W,
  MAX_WX,
  MAX_WY,
  MIN_WX,
  MIN_WY,
  ROAD_PX_PER_SEC,
  SCREEN_H,
  SCREEN_W,
  SLIDE_MS,
  STRIDE_X,
  STRIDE_Y,
  TILE,
  WORLD_SEED,
  forEachLeague,
  inLeague,
  leagueInBounds,
  leagueOrigin,
  tileCenter,
} from './metrics.js'
import { getWorld } from './league.js'
import { RESPAWN_LEAGUES, RESPAWN_MS, SPAWNS } from './content.js'
import { STAMP_LEAGUES } from './stamps.js'

const DEPTH_BIAS = 10000

const SPAWN_NAMES = new Set(['start', 'flagon', 'market', 'stub'])

export function isSpawnName(spawn) {
  return typeof spawn === 'string' && SPAWN_NAMES.has(spawn)
}

export class OverworldController {
  constructor(scene) {
    this.scene = scene
    this.world = null
    this.lx = 0
    this.ly = 0
    this.layers = []
    this.maps = []
    this.sprites = []
    this.taken = new Set()
    this.dead = new Map()
    this.latchUntil = 0
    this.active = false
    this.built = false
  }

  reset() {
    this.taken.clear()
    this.dead.clear()
  }

  show(spawn, slideMs = 0) {
    this.active = true
    this.scene.sceneId = 'overworld'
    this._teardown()
    this._build()
    const spot = this._resolveSpawn(spawn)
    this.scene._heroMode = true
    this.scene._playerPixelH = 0
    this.scene._pixelHIsVisible = false
    this.scene.unit = 0.5
    this.scene.worldW = SCREEN_W
    this.scene.worldH = SCREEN_H
    this.scene._applySprite(this.scene._spriteUrl)
    this._place(spot.wx, spot.wy)
    const home = this._leagueContaining(spot.wx, spot.wy)
    this._enter(home.lx, home.ly, slideMs)
  }

  hide() {
    this.active = false
    this._teardown()
    this.scene._heroMode = false
    this.scene._playerPixelH = 0
    this.scene._pixelHIsVisible = false
  }

  speed() {
    const body = this.scene.player.body
    const wx = Math.floor(body.center.x / TILE)
    const wy = Math.floor(body.center.y / TILE)
    const kind = this.world.kindAt(wx, wy)
    const mult = (session.baseSpeed || 160) / 160
    let px = ROAD_PX_PER_SEC * mult * speedFactor(kind)
    if (performance.now() < session.speedBoostUntil) px *= 1.5
    return px
  }

  checkEdge() {
    if (!this.active || !this.built) return
    if (performance.now() < this.latchUntil) return
    const center = this.scene.player.body.center
    const bounds = leagueOrigin(this.lx, this.ly)
    let nx = this.lx
    let ny = this.ly
    if (center.x < bounds.x) nx -= 1
    else if (center.x >= bounds.x + bounds.width) nx += 1
    if (center.y < bounds.y) ny -= 1
    else if (center.y >= bounds.y + bounds.height) ny += 1
    if (nx === this.lx && ny === this.ly) return
    if (!leagueInBounds(nx, ny)) {
      this._nudgeInside(bounds)
      return
    }
    this._enter(nx, ny, SLIDE_MS)
  }

  noteDeath(sprite) {
    if (!sprite?.encounterId) return
    this.dead.set(sprite.encounterId, {
      lx: this.lx,
      ly: this.ly,
      at: performance.now(),
      seenFar: false,
    })
  }

  _resolveSpawn(spawn) {
    if (isSpawnName(spawn)) return SPAWNS[spawn]
    if (spawn && Number.isFinite(spawn.wx)) return spawn
    return SPAWNS.start
  }

  _leagueContaining(wx, wy) {
    let found = { lx: 0, ly: 0 }
    forEachLeague((lx, ly) => {
      if (inLeague(lx, ly, wx, wy)) found = { lx, ly }
    })
    return found
  }

  _place(wx, wy) {
    const c = tileCenter(wx, wy)
    this.scene.player.setPosition(c.x, c.y)
    this.scene.player.body.reset(c.x, c.y)
  }

  _nudgeInside(bounds) {
    const body = this.scene.player.body
    const x = Math.min(Math.max(body.center.x, bounds.x + 8), bounds.x + bounds.width - 8)
    const y = Math.min(Math.max(body.center.y, bounds.y + 8), bounds.y + bounds.height - 8)
    this.scene.player.setPosition(x, y)
    this.scene.player.body.reset(x, y)
    this.scene.player.setVelocity(0, 0)
  }

  _enter(lx, ly, slideMs) {
    this.lx = lx
    this.ly = ly
    this.latchUntil = performance.now() + (slideMs > 0 ? slideMs + 80 : 0)
    this.scene.physics.world.setBounds(
      MIN_WX * TILE,
      MIN_WY * TILE,
      (MAX_WX - MIN_WX + 1) * TILE,
      (MAX_WY - MIN_WY + 1) * TILE,
    )
    this.scene.player.setCollideWorldBounds(true)
    this.scene.screenCamera.setScreenBounds(leagueOrigin(lx, ly), { slideMs })
    this._markFar()
    this._spawnEncounters()
    this._buildPrompts()
    this.scene._redrawStaticDebug()
  }

  _markFar() {
    for (const rec of this.dead.values()) {
      const dist = Math.abs(this.lx - rec.lx) + Math.abs(this.ly - rec.ly)
      if (dist >= RESPAWN_LEAGUES) rec.seenFar = true
    }
  }

  _build() {
    const scene = this.scene
    this.world = getWorld(WORLD_SEED)
    this._sliceSheet()
    const stampAt = new Set()
    for (let i = 0; i < STAMP_LEAGUES.length; i++) {
      const stamp = STAMP_LEAGUES[i]
      for (let ty = 0; ty < LEAGUE_H; ty++) {
        for (let tx = 0; tx < LEAGUE_W; tx++) {
          stampAt.add(`${stamp.lx * STRIDE_X + tx},${stamp.ly * STRIDE_Y + ty}`)
        }
      }
      const origin = leagueOrigin(stamp.lx, stamp.ly)
      const map = scene.make.tilemap({ key: stamp.key })
      const tiles = map.addTilesetImage('hollowvale', 'hollowvale-live', TILE, TILE, 0, 0)
      const layer = map.createLayer('ground', tiles, origin.x, origin.y)
      layer.setDepth(0)
      this.maps.push(map)
      this.layers.push(layer)
    }

    const cols = MAX_WX - MIN_WX + 1
    const rows = MAX_WY - MIN_WY + 1
    const blank = scene.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: cols, height: rows })
    const tiles = blank.addTilesetImage('hollowvale', 'hollowvale-live', TILE, TILE, 0, 0, 0)
    const layer = blank.createBlankLayer('ground', tiles, MIN_WX * TILE, MIN_WY * TILE, cols, rows)
    layer.setDepth(0)
    for (let wy = MIN_WY; wy <= MAX_WY; wy++) {
      for (let wx = MIN_WX; wx <= MAX_WX; wx++) {
        if (stampAt.has(`${wx},${wy}`)) continue
        blank.putTileAt(this.world.tileAt(wx, wy), wx - MIN_WX, wy - MIN_WY, false)
      }
    }
    this.maps.push(blank)
    this.layers.push(layer)

    forEachLeague((lx, ly) => {
      const view = this.world.league(lx, ly)
      for (let i = 0; i < view.props.length; i++) this._addProp(view.props[i], view)
    })
    for (let i = 0; i < BUILDINGS.length; i++) this._addBuilding(BUILDINGS[i])
    this._addBridges()

    this._buildSolids()
    this.built = true
  }

  teleport(wx, wy) {
    if (!this.active) return
    this._place(wx, wy)
    const home = this._leagueContaining(wx, wy)
    this._enter(home.lx, home.ly, 0)
  }

  tick() {
    // Water is a static autotile from the pack. Nothing to animate.
  }

  _sliceSheet() {
    this._ensureLiveSheet()
    const tex = this.scene.textures.get('hollowvale-live')
    if (!tex || tex.customData?.sliced) return
    for (let i = 0; i < TILE_COUNT; i++) {
      const col = i % SHEET_COLS
      const row = (i / SHEET_COLS) | 0
      tex.add(String(i), 0, col * TILE, row * TILE, TILE, TILE)
    }
    tex.customData.sliced = true
  }

  _ensureLiveSheet() {
    if (this.scene.textures.exists('hollowvale-live')) {
      this._live = this.scene.textures.get('hollowvale-live')
      return
    }
    const src = this.scene.textures.get('hollowvale').getSourceImage()
    const canvas = this.scene.textures.createCanvas('hollowvale-live', src.width, src.height)
    const ctx = canvas.getContext()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(src, 0, 0)
    canvas.refresh()
    this._live = canvas
  }

  _addProp(prop, view) {
    if (prop.kind === 'satchel' || prop.kind === 'herb' || prop.kind === 'cache' || prop.kind === 'offering') {
      const loot = view.loot.find((item) => item.wx === prop.wx && item.wy === prop.wy)
      if (loot && this.taken.has(loot.id)) return
    }
    const spec = SPRITES[prop.kind]
    if (!spec) return
    const x = prop.wx * TILE + TILE / 2
    const y = prop.wy * TILE + TILE
    const sprite = this.scene.add.image(x, y, `zv-${prop.kind}`)
    sprite.setOrigin(0.5, 1)
    sprite.setDepth(y + DEPTH_BIAS)
    if (spec.blocks) {
      const shadow = this.scene.add.ellipse(x, y - 1, Math.min(spec.w, 18), 4, 0x000000, 0.28)
      shadow.setDepth(y + DEPTH_BIAS - 1)
      this.sprites.push(shadow)
    }
    sprite.propKind = prop.kind
    sprite.wx = prop.wx
    sprite.wy = prop.wy
    this.sprites.push(sprite)
  }

  _addBuilding(spec) {
    const art = SPRITES[spec.sprite]
    if (!art) return
    const x = (spec.wx + spec.tiles / 2) * TILE
    const y = (spec.wy + 1) * TILE
    const sprite = this.scene.add.image(x, y, `zv-${spec.sprite}`)
    sprite.setOrigin(0.5, 1)
    sprite.setDepth(y + DEPTH_BIAS)
    this.sprites.push(sprite)
  }

  _addBridges() {
    const seen = new Set()
    const minX = MIN_WX
    const maxX = MAX_WX
    const minY = MIN_WY
    const maxY = MAX_WY
    for (let wy = minY; wy <= maxY; wy++) {
      for (let wx = minX; wx <= maxX; wx++) {
        const kind = this.world.kindAt(wx, wy)
        if (kind !== 'ford' && kind !== 'bridge') continue
        const key = `${wx},${wy}`
        if (seen.has(key)) continue
        let x0 = wx
        while (x0 > minX && this.world.kindAt(x0 - 1, wy) === kind) x0 -= 1
        let x1 = wx
        while (x1 < maxX && this.world.kindAt(x1 + 1, wy) === kind) x1 += 1
        for (let x = x0; x <= x1; x++) seen.add(`${x},${wy}`)
        const span = x1 - x0 + 1
        const name = span >= 4 ? 'bridge4' : span === 3 ? 'bridge3' : span === 2 ? 'bridge2' : 'bridge1'
        const art = SPRITES[name]
        const cx = ((x0 + x1 + 1) / 2) * TILE
        const y = (wy + 1) * TILE + 8
        const sprite = this.scene.add.image(cx, y, `zv-${name}`)
        sprite.setOrigin(0.5, 1)
        sprite.setDepth(1)
        sprite.bridge = true
        this.sprites.push(sprite)
        void art
      }
    }
  }

  _buildSolids() {
    const scene = this.scene
    scene.solids.clear(true, true)
    scene._solidRects.length = 0
    const rects = this.world.colliders
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      const rect = scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0)
      rect.setVisible(false)
      scene.physics.add.existing(rect, true)
      rect.body.updateFromGameObject()
      scene.solids.add(rect)
      scene._solidRects.push({ x: r.x, y: r.y, w: r.w, h: r.h })
    }
  }

  _spawnEncounters() {
    const scene = this.scene
    scene._clearEnemies()
    const view = this.world.league(this.lx, this.ly)
    const now = performance.now()
    for (let i = 0; i < view.encounters.length; i++) {
      const enc = view.encounters[i]
      const rec = this.dead.get(enc.id)
      if (rec) {
        if (!(rec.seenFar && now - rec.at >= RESPAWN_MS)) continue
        this.dead.delete(enc.id)
      }
      const c = tileCenter(enc.wx, enc.wy)
      scene._spawnEnemyAt(enc.type, c.x, c.y, enc.name, enc.id)
    }
  }

  _buildPrompts() {
    const scene = this.scene
    for (let i = 0; i < scene.beaconLabels.length; i++) scene.beaconLabels[i].destroy()
    scene.beaconLabels.length = 0
    scene.prompts = []
    const view = this.world.league(this.lx, this.ly)
    for (let i = 0; i < view.interactables.length; i++) {
      const it = view.interactables[i]
      const prompt = scene._pushPixelPrompt(
        { x: it.wx * TILE, y: it.wy * TILE, w: (it.w || 1) * TILE, h: (it.h || 1) * TILE },
        it.label,
        it.short,
        it.kind,
        it.action,
      )
      prompt.to = it.to
      prompt.spawn = it.spawn
      prompt.text = it.text
      prompt.id = it.id
    }
    for (let i = 0; i < view.loot.length; i++) {
      const loot = view.loot[i]
      if (this.taken.has(loot.id)) continue
      const prompt = scene._pushPixelPrompt(
        { x: loot.wx * TILE, y: loot.wy * TILE, w: TILE, h: TILE },
        loot.label,
        loot.short,
        'loot',
        'loot',
      )
      prompt.lootId = loot.id
      prompt.items = loot.items
      prompt.gems = loot.gems
      prompt.wx = loot.wx
      prompt.wy = loot.wy
    }
    scene._activeLabel = null
    eventBus.emit(GameEvents.PROMPT, { label: '' })
  }

  takeLoot(zone) {
    if (!zone?.lootId || this.taken.has(zone.lootId)) return
    this.taken.add(zone.lootId)
    const gems = zone.gems || { ruby: 0, sapphire: 0, emerald: 0 }
    eventBus.emit(GameEvents.LOOT, { gems, items: zone.items || [] })
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const spr = this.sprites[i]
      if (spr.wx === zone.wx && spr.wy === zone.wy) {
        spr.destroy()
        this.sprites.splice(i, 1)
      }
    }
    this._buildPrompts()
  }

  _teardown() {
    for (let i = 0; i < this.sprites.length; i++) this.sprites[i].destroy()
    this.sprites.length = 0
    for (let i = 0; i < this.maps.length; i++) this.maps[i].destroy()
    this.maps.length = 0
    this.layers.length = 0
    this.built = false
  }
}

export const OVERWORLD_DEPTH_BIAS = DEPTH_BIAS
