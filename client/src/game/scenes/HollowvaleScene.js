import Phaser from 'phaser'
import { PATHS, CLASS_SPRITES, CLASS_ATTACK_SPRITES, COMPOSITE_SPRITES, ENEMY_SPRITES } from '../../config/paths.js'
import { TERRAIN_ASSETS, getAsset } from '../../config/terrainAssets.js'
import { eventBus, GameEvents } from '../../lib/eventBus.js'
import {
  onDoorOpen,
  onPlayerMove,
  onMeleeSwing,
  onMeleeHit,
  onSpellCast,
  onSpellImpact,
  onPlayerHurt,
  emitNpcInteract,
} from '../MainGameScene.js'
import {
  HUB_RETURN_SPAWN,
  spawnAtEdge,
  spawnFromHub,
  loadWildernessScreen,
  resolveEdgeTransition,
  detectCrossedEdge,
  wildernessExitPrompts,
  collidersWithExitGaps,
  WILDERNESS_ENTRANCE_ID,
} from '../terrain/wildernessBridge.js'
import { PAINTED_SCENES } from '../sceneCatalog.js'
import { session } from '../session.js'
import { ScreenCamera } from '../screenCamera.js'
import { DomFxLayer } from '../fxLayer.js'
import { OverworldController, OVERWORLD_DEPTH_BIAS, isSpawnName } from '../world/OverworldController.js'
import {
  PAINTED_WORLD_W,
  PAINTED_WORLD_H,
  WILDERNESS_CELL,
  WILDERNESS_COLS,
  WILDERNESS_ROWS,
  WILDERNESS_WORLD_W,
  WILDERNESS_WORLD_H,
  scaleFromReference,
} from '../worldMetrics.js'

const CLASS_SPEED = { knight: 160, dwarf: 160, mage: 180, thief: 200 }
const ATTACK_MS = { mage: 650, thief: 300, knight: 450, dwarf: 600 }
const MELEE_DMG = { thief: 8, knight: 12, dwarf: 15 }
const WEAPON = {
  knight: 'iron_sword',
  mage: 'apprentice_staff',
  thief: 'twin_daggers',
  dwarf: 'battle_axe',
}
const CONSUMABLE = new Set(['healing_potion', 'mana_potion', 'speed_potion'])
const FIREBALL_SPEED = 420
const FIREBALL_DIST = 220
const FIRE_LINGER_MS = 2000
const BARTENDER_GREETING =
  "Tharos: Hrm. Traveler. Dragon business or town history—what'll it be? The market is on the west side of the square, toward the trees. The south gate puts you on the Ember Road."

const KIND_COLOR = {
  talk: 0x60a5fa,
  loot: 0xfbbf24,
  exit: 0x10b981,
}

function intersects(a, b) {
  return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h)
}

function removeAt(arr, i) {
  const last = arr.length - 1
  const item = arr[i]
  if (i !== last) arr[i] = arr[last]
  arr.pop()
  return item
}

function enemyLabel(type) {
  if (type === 'goblin') return 'Goblin'
  if (type === 'brute') return 'Goblin Brute'
  if (type === 'archer') return 'Goblin Archer'
  return type || 'Unknown'
}

function placeholderColor(id) {
  if (id === 'bush') return 0x2f5c2c
  if (id === 'tree') return 0x3a2b1e
  return 0x76746e
}

export default class HollowvaleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HollowvaleScene' })
    this.sceneId = 'village'
    this.worldW = PAINTED_WORLD_W
    this.worldH = PAINTED_WORLD_H
    this.unit = this.worldH / 900
    this.saved = {
      village: { nx: 0.5, ny: 0.9 },
      treasureReturn: { nx: 0.235, ny: 0.2 },
    }
    this.openedChests = new Set()
    this.prompts = []
    this.beaconLabels = []
    this.projectiles = []
    this.fires = []
    this.floats = []
    this.floatPool = []
    this._solidRects = []
    this._box = { x: 0, y: 0, w: 0, h: 0 }
    this._norm = { x: 0, y: 0, w: 0, h: 0 }
    this.facingX = 1
    this.facingY = 0
    this.wave = 1
    this.enemiesSpawned = false
    this.nextWaveAt = 0
    this.wildNodeId = WILDERNESS_ENTRANCE_ID
    this.wildLayout = null
    this.wildLatchUntil = 0
    this.hp = 100
    this.hpMax = 100
    this.mana = 0
    this.manaMax = 0
    this.dead = false
    this.debugOn = false
    this._appliedClass = undefined
    this._spriteUrl = ''
    this._attackUntil = 0
    this._attacking = false
    this._activeLabel = null
    this._pubHp = -1
    this._pubMana = -1
    this._wheelOpen = false
    this._consuming = false
    this._consumeNeedsRelease = false
    this._consumeStart = 0
    this._consumeId = ''
    this._consumeSlot = 0
    this._id = 1
    this._skipRest = false
  }

  preload() {
    const urls = new Set()
    const add = (url) => {
      if (url) urls.add(url)
    }
    for (const def of Object.values(PAINTED_SCENES)) add(def.bg)
    for (const url of Object.values(CLASS_SPRITES)) add(url)
    for (const url of Object.values(CLASS_ATTACK_SPRITES)) add(url)
    for (const url of Object.values(ENEMY_SPRITES)) add(url)
    for (const map of Object.values(COMPOSITE_SPRITES)) {
      for (const url of Object.values(map)) add(url)
    }
    add(PATHS.goblinArrow)
    for (const url of urls) this.load.image(url, url)

    for (const asset of TERRAIN_ASSETS) {
      if (asset.src) this.load.image(asset.id, asset.src)
    }
    this.load.image('hollowvale', '/maps/hollowvale.png')
    this.load.image('bandit', '/maps/bandit.png')
    this.load.tilemapTiledJSON('brackenford', '/maps/brackenford.json')
    this.load.tilemapTiledJSON('hearthmile', '/maps/hearthmile.json')
    this.load.tilemapTiledJSON('ruinwatch', '/maps/ruinwatch.json')
  }

  create() {
    const params = new URLSearchParams(window.location.search)
    this.debugOn = params.get('debug') === '1'

    if (!this.textures.exists('__px')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffcc00, 1)
      g.fillRect(0, 0, 8, 8)
      g.generateTexture('__px', 8, 8)
      g.destroy()
    }

    this.physics.world.setFPS(60)
    this.cameras.main.setBackgroundColor('#000000')
    this.cameras.main.roundPixels = true

    this.solids = this.physics.add.staticGroup()
    this.enemies = this.physics.add.group()
    this.beaconGfx = this.add.graphics().setDepth(20000)
    this.debugGfx = this.add.graphics().setDepth(25000)
    this.consumeGfx = this.add.graphics().setDepth(26000)
    this.hpGfx = this.add.graphics().setDepth(18000)

    this.player = this.physics.add.sprite(PAINTED_WORLD_W / 2, PAINTED_WORLD_H * 0.9, '__px')
    this.player.setOrigin(0.5, 0.5)
    this.player.setCollideWorldBounds(true)
    this.player.setVisible(false)
    this.player.body.setAllowGravity(false)

    this.physics.add.collider(this.player, this.solids)
    this.physics.add.collider(this.enemies, this.solids)

    this.screenCamera = new ScreenCamera(this)
    this.screenCamera.follow(this.player)

    const parent = this.game.canvas.parentElement || document.body
    this.fx = new DomFxLayer(parent)

    this.keys = this.input.keyboard.addKeys({
      W: 'W', A: 'A', S: 'S', D: 'D',
      E: 'E', K: 'K', J: 'J',
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      space: 'SPACE',
      F2: 'F2',
    })
    this.backtick = this.input.keyboard.addKey(192)

    this.input.keyboard.on('keydown', (event) => {
      if (session.blocked) return
      const el = document.activeElement
      const tag = el && el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable)) return
      const k = event.key
      if (k === ' ' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
        event.preventDefault()
      }
    })

    session.api = {
      heal: (amount) => this._heal(amount),
      addMana: (amount) => this._addMana(amount),
      resetRun: () => this._resetRun(),
    }

    if (import.meta.env.DEV) {
      window.__hv = {
        scene: () => this.sceneId,
        player: () => this._playerSnapshot(),
        world: () => ({ w: this.worldW, h: this.worldH }),
        zoom: () => this.cameras.main.zoom,
        view: () => {
          const v = this.cameras.main.worldView
          return { x: v.x, y: v.y, width: v.width, height: v.height }
        },
        canvas: () => ({ w: this.scale.width, h: this.scale.height }),
        debug: (on) => {
          this.debugOn = !!on
          this._redrawStaticDebug()
        },
        solids: () => this._solidRects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
        prompts: () => this.prompts.map((p) => ({
          x: p.x, y: p.y, w: p.w, h: p.h, action: p.action, label: p.label, to: p.to || null,
        })),
        goto: (id, nx, ny) => this.enterScene(id, { nx, ny }),
        league: () => (this.overworld ? { x: this.overworld.lx, y: this.overworld.ly } : null),
        teleport: (wx, wy) => this.overworld?.teleport(wx, wy),
        tile: () => {
          const b = this.player?.body
          if (!b) return null
          return { wx: Math.floor(b.center.x / 16), wy: Math.floor(b.center.y / 16), x: b.center.x, y: b.center.y }
        },
      }
    }

    this.overworld = new OverworldController(this)
    this.enterScene('overworld', 'start')
    session.ready = true
    this.time.delayedCall(0, () => {
      eventBus.emit(GameEvents.ASSETS_READY)
      eventBus.emit(GameEvents.SCENE_CHANGE, { scene: this.sceneId })
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._shutdown, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this._shutdown, this)
  }

  _shutdown() {
    session.api = null
    session.ready = false
    if (window.__hv) delete window.__hv
    this.fx?.destroy()
    this.screenCamera?.destroy()
  }

  _playerSnapshot() {
    const b = this.player?.body
    if (!b) return null
    return {
      x: b.x,
      y: b.y,
      w: b.width,
      h: b.height,
      cx: b.center.x,
      cy: b.center.y,
      scene: this.sceneId,
    }
  }

  update(_time, delta) {
    if (!this.player?.body) return
    const dt = Math.min(0.033, delta / 1000)
    const now = performance.now()
    this._syncSession(now)
    this.overworld?.tick(now)
    this._drive(now, dt)
    if (this._skipRest) {
      this._skipRest = false
      this._present(now)
      return
    }
    this._combat(now, dt)
    this._present(now)
  }

  _syncSession(now) {
    if (session.classId !== this._appliedClass) {
      this._appliedClass = session.classId
      this._applyClass(session.classId)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.F2) || Phaser.Input.Keyboard.JustDown(this.backtick)) {
      this.debugOn = !this.debugOn
      this._redrawStaticDebug()
    }
    if (!this._attacking && !this._stealthVisual() && session.spriteUrl !== this._spriteUrl) {
      this._applySprite(session.spriteUrl)
    }
    if (this._attacking && now >= this._attackUntil) {
      this._attacking = false
      this._applySprite(session.spriteUrl)
    }
    if (now >= session.thiefVanishUntil && this._vanishArmed && session.classId === 'thief') {
      this._vanishArmed = false
      session.thiefSmokeUntil = now + 15000
    }
  }

  _applyClass(id) {
    if (!id) {
      this.player.setVisible(false)
      return
    }
    this.dead = false
    this.hpMax = 100
    this.hp = 100
    this.manaMax = id === 'mage' ? 100 : 0
    this.mana = this.manaMax
    session.baseSpeed = CLASS_SPEED[id] || 160
    this._publishVitals(true)
    this.player.setVisible(true)
    this._applySprite(session.spriteUrl || CLASS_SPRITES[id])
  }

  _applySprite(url) {
    this._spriteUrl = url || ''
    if (!url || !this.textures.exists(url)) return
    const targetH = this._playerPixelH
      ? this._playerPixelH
      : Math.max(24, Math.round((this._playerScale || 0.13) * this.worldH))
    this.player.setTexture(url)
    const src = this.player.texture.getSourceImage()
    const ar = src && src.height ? src.width / src.height : 1
    const targetW = Math.max(12, Math.round(targetH * ar))
    this.player.setDisplaySize(targetW, targetH)
    if (this._playerPixelH) {
      const sx = this.player.scaleX || 1
      const sy = this.player.scaleY || 1
      this.player.body.setSize(10 / sx, 8 / sy, true)
      this.player.body.reset(this.player.x, this.player.y)
    } else {
      this.player.body.setSize(this.player.width, this.player.height, true)
    }
  }

  _stealthVisual() {
    const now = performance.now()
    return session.classId === 'thief' && (now < session.thiefVanishUntil || now < session.thiefSmokeUntil)
  }

  _drive(now, dt) {
    const body = this.player.body
    const blocked = session.blocked || this.dead
    const vanishing = session.classId === 'thief' && now < session.thiefVanishUntil
    let vx = 0
    let vy = 0
    if (!blocked && !vanishing) {
      if (this.keys.left.isDown || this.keys.A.isDown) vx -= 1
      if (this.keys.right.isDown || this.keys.D.isDown) vx += 1
      if (this.keys.up.isDown || this.keys.W.isDown) vy -= 1
      if (this.keys.down.isDown || this.keys.S.isDown) vy += 1
      if (vx !== 0 || vy !== 0) {
        const len = Math.hypot(vx, vy)
        vx /= len
        vy /= len
        this.facingX = vx
        this.facingY = vy
      }
    }
    let speed = (session.baseSpeed || 160) * this.unit
    if (this.sceneId === 'overworld' && this.overworld?.active) speed = this.overworld.speed()
    else if (now < session.speedBoostUntil) speed *= 1.5
    this.player.setVelocity(vx * speed, vy * speed)
    onPlayerMove({ moving: vx !== 0 || vy !== 0, now })

    if (this.sceneId === 'overworld' && this.overworld?.active && !blocked) {
      this.overworld.checkEdge()
      if (this._skipRest) return
    }

    if (this.sceneId === 'wilderness' && !blocked && now >= this.wildLatchUntil) {
      this._checkWildEdge()
      if (this._skipRest) return
    }

    if (!blocked && !vanishing && !this._consuming && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this._tryInteract()
      if (this._skipRest) return
    }

    if (!blocked && !vanishing && Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      this._tryAttack(now)
    }

    if (!blocked) this._tryVanish(now)
    this._updateConsume(now, blocked)
    void dt
    void body
  }

  _checkWildEdge() {
    const layout = this.wildLayout
    if (!layout) return
    const b = this._readPlayerBox()
    this._norm.x = b.x / this.worldW
    this._norm.y = b.y / this.worldH
    this._norm.w = b.w / this.worldW
    this._norm.h = b.h / this.worldH
    const edge = detectCrossedEdge(this._norm, layout)
    if (!edge) return
    const result = resolveEdgeTransition(this.wildNodeId, edge)
    if (result?.type === 'hub') {
      onDoorOpen()
      this.enterScene('dungeon', { nx: HUB_RETURN_SPAWN.nx, ny: HUB_RETURN_SPAWN.ny })
    } else if (result?.type === 'neighbor') {
      const next = loadWildernessScreen(result.nodeId)
      this.wildNodeId = result.nodeId
      this.wildLayout = next
      this._clearTransient()
      this._mountWilderness(next, spawnAtEdge(result.appearAt, next))
      this._skipRest = true
    }
  }

  _tryInteract() {
    const box = this._readPlayerBox()
    const zones = this.prompts
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]
      if (!zone.action || zone.action === 'none') continue
      if (!intersects(box, zone)) continue
      this._activate(zone)
      return
    }
  }

  _activate(zone) {
    if (zone.action === 'travel') {
      if (zone.save) this._saveNormalized(zone.save)
      onDoorOpen()
      this.enterScene(zone.to, this._resolveSpawn(zone.spawn))
      return
    }
    if (zone.action === 'wilderness') {
      onDoorOpen()
      this.wildNodeId = WILDERNESS_ENTRANCE_ID
      this.enterScene('wilderness', null)
      return
    }
    if (zone.action === 'bartender') {
      emitNpcInteract({ npc: 'bartender', greeting: BARTENDER_GREETING })
      return
    }
    if (zone.action === 'vendor') {
      eventBus.emit(GameEvents.VENDOR)
      return
    }
    if (zone.action === 'loot') {
      this.overworld?.takeLoot(zone)
      return
    }
    if (zone.action === 'read') {
      if (zone.text) eventBus.emit(GameEvents.NOTICE, { text: zone.text, ms: 6500 })
      return
    }
    if (zone.action === 'chest') {
      if (this.openedChests.has(zone.chestIndex)) return
      const opened = session.hooks.openChest?.(zone.chestIndex, zone.locked) === true
      if (!opened) return
      this.openedChests.add(zone.chestIndex)
      this._buildPrompts()
    }
  }

  _saveNormalized(key) {
    const b = this._readPlayerBox()
    const nx = (b.x + b.w / 2) / this.worldW
    const ny = (b.y + b.h / 2) / this.worldH
    this.saved[key] = {
      nx: Math.max(0, Math.min(1, nx)),
      ny: Math.max(0, Math.min(1, ny)),
    }
  }

  _resolveSpawn(spawn) {
    if (isSpawnName(spawn)) return spawn
    if (spawn && typeof spawn === 'object') return spawn
    if (spawn === 'village') {
      const s = this.saved.village || { nx: 0.5, ny: 0.9 }
      return { nx: s.nx, ny: Math.max(0.02, Math.min(0.98, s.ny)) }
    }
    if (spawn === 'treasureReturn') return this.saved.treasureReturn || { nx: 0.235, ny: 0.2 }
    return { nx: 0.5, ny: 0.5 }
  }

  _tryAttack(now) {
    if (now < this._attackUntil) return
    const cls = session.classId
    if (!cls) return
    const item = session.equippedId
    if (cls === 'thief' && item === 'poison_vial') {
      this._launchProjectile(now, {
        speed: FIREBALL_SPEED,
        dist: FIREBALL_DIST,
        size: 42,
        src: PATHS.animatedThiefPotionGif,
        impact: 'poison',
        lingerMs: 2000,
        owner: 'player',
      })
      eventBus.emit(GameEvents.ITEM_CONSUMED, { id: 'poison_vial', mode: 'search' })
      return
    }
    if (cls === 'mage' && item === 'spellbook' && session.spellId === 'leech') {
      if (now < session.lifeLeechCooldownUntil) return
      this._launchProjectile(now, {
        speed: FIREBALL_SPEED,
        dist: FIREBALL_DIST,
        size: 42,
        src: PATHS.lifeLeechSpellGif,
        impact: 'lifeLeech',
        owner: 'player',
        special: 'lifeLeech',
      })
      session.lifeLeechCooldownUntil = now + 10000
      this._notice('Cast Life Leech')
      return
    }
    const needed = WEAPON[cls]
    if (!needed || item !== needed) return
    if (cls === 'mage' && (this.mana || 0) < 15) {
      this._notice('Not enough mana.')
      return
    }
    const attackUrl = CLASS_ATTACK_SPRITES[cls]
    this._attackUntil = now + (ATTACK_MS[cls] || 1000)
    this._attacking = true
    if (attackUrl) this._applySprite(attackUrl)
    if (cls === 'mage') {
      this.mana = Math.max(0, (this.mana || 0) - 15)
      this._publishVitals(false)
      onSpellCast()
      this._launchProjectile(now, {
        speed: FIREBALL_SPEED,
        dist: FIREBALL_DIST,
        size: 32,
        src: PATHS.animatedFireBallGif,
        impact: 'fire',
        lingerMs: FIRE_LINGER_MS,
        owner: 'player',
      })
      return
    }
    onMeleeSwing()
    const dmg = MELEE_DMG[cls] || 0
    if (dmg <= 0) return
    this._fillAttackBox()
    let hit = false
    const kids = this.enemies.getChildren()
    for (let i = 0; i < kids.length; i++) {
      const e = kids[i]
      if (e.hp <= 0) continue
      if (!intersects(this._atk, this._enemyBox(e))) continue
      e.hp = Math.max(0, e.hp - dmg)
      e.flashUntil = now + 120
      this._float(e.x, e.y - 6, `-${dmg}`, '#ff6161')
      hit = true
    }
    if (hit) onMeleeHit()
  }

  _fillAttackBox() {
    const b = this._readPlayerBox()
    const dirX = this.facingX
    const dirY = this.facingY
    const atk = this._atk
    if (Math.abs(dirX) >= Math.abs(dirY)) {
      atk.w = Math.max(14, Math.round(b.w * 0.85))
      atk.h = Math.max(12, Math.round(b.h * 0.55))
      atk.x = dirX > 0 ? b.x + b.w : b.x - atk.w
      atk.y = b.y + (b.h - atk.h) / 2
    } else {
      atk.w = Math.max(12, Math.round(b.w * 0.55))
      atk.h = Math.max(14, Math.round(b.h * 0.85))
      atk.x = b.x + (b.w - atk.w) / 2
      atk.y = dirY > 0 ? b.y + b.h : b.y - atk.h
    }
  }

  _launchProjectile(now, spec) {
    const b = this._readPlayerBox()
    let dx = this.facingX
    let dy = this.facingY
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      dx = 1
      dy = 0
    }
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const size = spec.size * this.unit
    const startX = b.x + b.w / 2 + dx * 12 * this.unit
    const startY = b.y + b.h / 2 + dy * 12 * this.unit
    const speed = spec.speed * this.unit
    const pr = {
      x: startX - size / 2,
      y: startY - size / 2,
      w: size,
      h: size,
      vx: dx * speed,
      vy: dy * speed,
      startX,
      startY,
      maxDist: spec.dist * this.unit,
      owner: spec.owner || 'player',
      impact: spec.impact || '',
      special: spec.special || '',
      lingerMs: spec.lingerMs || FIRE_LINGER_MS,
      sprite: null,
      dom: null,
      born: now,
    }
    if (spec.arrow) {
      const key = this.textures.exists(PATHS.goblinArrow) ? PATHS.goblinArrow : '__px'
      const spr = this.add.image(startX, startY, key).setDepth(15000)
      spr.setDisplaySize(size * 1.6, size * 0.45)
      spr.rotation = Math.atan2(dy, dx)
      pr.sprite = spr
    } else if (spec.src) {
      pr.dom = this.fx.spawn(spec.src, pr.x, pr.y, pr.w, pr.h)
    }
    this.projectiles.push(pr)
  }

  _tryVanish(now) {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.J)) return
    if (session.classId !== 'thief') return
    if (now < session.thiefVanishUntil || now < session.thiefSmokeUntil) return
    if (now < session.thiefVanishCooldownUntil) return
    session.thiefVanishUntil = now + 1000
    session.thiefVanishCooldownUntil = now + 10000
    this._vanishArmed = true
  }

  _updateConsume(now, blocked) {
    const kDown = this.keys.K.isDown
    const equipped = session.equippedId
    const isBook = session.classId === 'mage' && equipped === 'spellbook'
    const canWheel = isBook && !blocked
    if (canWheel && kDown && !this._wheelOpen) {
      this._wheelOpen = true
      this._consuming = false
      eventBus.emit(GameEvents.SPELL_WHEEL, { open: true })
    } else if (this._wheelOpen && (!kDown || !canWheel)) {
      this._wheelOpen = false
      eventBus.emit(GameEvents.SPELL_WHEEL, { open: false })
    }
    if (!kDown && this._consumeNeedsRelease) this._consumeNeedsRelease = false
    const canConsume = !blocked && !isBook && equipped && CONSUMABLE.has(equipped)
    if (!this._consuming) {
      if (kDown && !this._consumeNeedsRelease && canConsume) {
        this._consuming = true
        this._consumeStart = now
        this._consumeId = equipped
        this._consumeSlot = session.hotbarSlot
      }
      return
    }
    const still = kDown && canConsume && session.equippedId === this._consumeId && session.hotbarSlot === this._consumeSlot
    if (!still) {
      this._consuming = false
      return
    }
    if (now - this._consumeStart < 1000) return
    eventBus.emit(GameEvents.ITEM_CONSUMED, { id: this._consumeId, slot: this._consumeSlot, mode: 'slot' })
    if (this._consumeId === 'speed_potion') session.speedBoostUntil = now + 10000
    else if (this._consumeId === 'mana_potion') this._addMana(75)
    else if (this._consumeId === 'healing_potion') this._heal(70)
    this._consuming = false
    this._consumeNeedsRelease = true
  }

  _combat(now, dt) {
    if (!this.dead) this._updateEnemies(now, dt)
    this._updateProjectiles(now, dt)
    this._updateFires(now, dt)
    this._updateFloats(now, dt)
    if (session.classId === 'mage' && this.manaMax > 0 && !this.dead) {
      this.mana = Math.min(this.manaMax, this.mana + 5 * dt)
    }
    if (this.sceneId === 'dungeonInterior' && this.nextWaveAt && now >= this.nextWaveAt && this.enemies.countActive() === 0) {
      this.wave += 1
      this.enemiesSpawned = false
      this.nextWaveAt = 0
    }
    if (this.sceneId === 'dungeonInterior' && !this.enemiesSpawned && (this.nextWaveAt === 0 || now >= this.nextWaveAt)) {
      this._spawnWave()
    }
    this._publishVitals(false)
  }

  _spawnWave() {
    const wave = this.wave
    const spawns = [
      ['goblin', 0.47, 0.28],
      ['goblin', 0.53, 0.31],
      ['brute', 0.5, 0.22],
      ['archer', 0.56, 0.26],
    ]
    for (let i = 1; i < wave; i++) {
      spawns.push(['goblin', 0.45 + Math.random() * 0.12, 0.2 + Math.random() * 0.14])
    }
    if (wave > 1 && wave % 2 === 0) spawns.push(['archer', 0.44 + Math.random() * 0.18, 0.2 + Math.random() * 0.14])
    if (wave > 1 && wave % 3 === 0) spawns.push(['brute', 0.44 + Math.random() * 0.12, 0.18 + Math.random() * 0.1])
    for (let i = 0; i < spawns.length; i++) {
      this._spawnEnemy(spawns[i][0], spawns[i][1], spawns[i][2], wave)
    }
    this.enemiesSpawned = true
    this.nextWaveAt = 0
  }

  _spawnEnemy(type, nx, ny, wave) {
    const key = ENEMY_SPRITES[type]
    const texKey = key && this.textures.exists(key) ? key : '__px'
    const targetH = Math.max(20, Math.round(0.11 * this.worldH))
    const src = this.textures.get(texKey).getSourceImage()
    const ar = src && src.height ? src.width / src.height : 1
    const w = Math.max(14, Math.round(targetH * ar))
    const h = targetH
    const spr = this.enemies.create(nx * this.worldW, ny * this.worldH, texKey)
    spr.setOrigin(0.5, 0.5)
    spr.setDisplaySize(w, h)
    spr.body.setSize(spr.width, spr.height, true)
    spr.body.setAllowGravity(false)
    spr.setCollideWorldBounds(true)
    spr.setPushable(false)
    let hpMax = type === 'brute' ? 25 : type === 'archer' ? 10 : 15
    hpMax = Math.round(hpMax * (1 + 0.12 * Math.max(0, wave - 1)))
    let speed = type === 'brute' ? 55 : type === 'archer' ? 80 : 70
    speed = speed * (1 + 0.05 * Math.max(0, wave - 1)) * this.unit
    spr.enemyType = type
    spr.hp = hpMax
    spr.hpMax = hpMax
    spr.speed = speed
    spr.dirX = 0
    spr.dirY = 0
    spr.changeAt = 0
    spr.fireAt = 0
    spr.flashUntil = 0
    spr._deathProcessed = false
    spr.setDepth(ny * this.worldH)
  }

  _spawnEnemyAt(type, x, y, name, id) {
    const human = name && /bandit|bruiser/i.test(name)
    const key = human ? 'bandit' : ENEMY_SPRITES[type]
    const texKey = key && this.textures.exists(key) ? key : '__px'
    const targetH = name && /bruiser/i.test(name) ? 26 : 20
    const src = this.textures.get(texKey).getSourceImage()
    const ar = src && src.height ? src.width / src.height : 1
    const w = Math.max(12, Math.round(targetH * ar))
    const spr = this.enemies.create(x, y, texKey)
    spr.setOrigin(0.5, 0.5)
    spr.setDisplaySize(w, targetH)
    const sx = spr.scaleX || 1
    const sy = spr.scaleY || 1
    spr.body.setSize(10 / sx, 10 / sy, true)
    spr.body.setAllowGravity(false)
    spr.setCollideWorldBounds(true)
    spr.setPushable(false)
    const hpMax = type === 'brute' ? 25 : type === 'archer' ? 10 : 15
    const pace = type === 'brute' ? 12 : type === 'archer' ? 14 : 16
    spr.enemyType = type
    spr.displayName = name || enemyLabel(type)
    spr.encounterId = id || ''
    spr.hp = hpMax
    spr.hpMax = hpMax
    spr.speed = pace
    spr.dirX = 0
    spr.dirY = 0
    spr.changeAt = 0
    spr.fireAt = 0
    spr.flashUntil = 0
    spr._deathProcessed = false
    spr.setDepth(y + OVERWORLD_DEPTH_BIAS)
  }

  _enemyBox(e) {
    const b = e.body
    this._ebox = this._ebox || { x: 0, y: 0, w: 0, h: 0 }
    this._ebox.x = b.x
    this._ebox.y = b.y
    this._ebox.w = b.width
    this._ebox.h = b.height
    return this._ebox
  }

  _updateEnemies(now, dt) {
    const kids = this.enemies.getChildren()
    const px = this.player.x
    const py = this.player.y
    const inset = 4 * this.unit
    const playerBox = this._readPlayerBox()
    const hurtBox = this._hurt || (this._hurt = { x: 0, y: 0, w: 0, h: 0 })
    hurtBox.x = playerBox.x + inset
    hurtBox.y = playerBox.y + inset
    hurtBox.w = Math.max(1, playerBox.w - inset * 2)
    hurtBox.h = Math.max(1, playerBox.h - inset * 2)
    const invincible = session.classId === 'thief' && now < session.thiefSmokeUntil
    for (let i = 0; i < kids.length; i++) {
      const e = kids[i]
      if (e.hp <= 0) continue
      if (now >= e.changeAt) {
        let tx = px - e.x
        let ty = py - e.y
        const len = Math.hypot(tx, ty) || 1
        tx /= len
        ty /= len
        const jx = (Math.random() * 2 - 1) * 0.8
        const jy = (Math.random() * 2 - 1) * 0.8
        const mix = Math.min(0.75, 0.45 + 0.05 * Math.max(0, this.wave - 1))
        let dx = tx * mix + jx * (1 - mix)
        let dy = ty * mix + jy * (1 - mix)
        const nlen = Math.hypot(dx, dy) || 1
        e.dirX = dx / nlen
        e.dirY = dy / nlen
        e.changeAt = now + 500 + Math.random() * 900
      }
      const archerFar = this.sceneId === 'overworld' && Math.hypot(px - e.x, py - e.y) > 48
      if (e.enemyType === 'archer' && now >= e.fireAt && !archerFar) {
        let ax = px - e.x
        let ay = py - e.y
        const al = Math.hypot(ax, ay) || 1
        ax /= al
        ay /= al
        const prevX = this.facingX
        const prevY = this.facingY
        this.facingX = ax
        this.facingY = ay
        const saved = this._readPlayerBox()
        void saved
        this._launchFrom(e.x, e.y, ax, ay, {
          speed: 300,
          dist: 400,
          size: 12,
          arrow: true,
          owner: 'enemy',
          impact: 'arrow',
        })
        this.facingX = prevX
        this.facingY = prevY
        e.fireAt = now + 1800 + Math.random() * 1200
      }
      e.setVelocity(e.dirX * e.speed, e.dirY * e.speed)
      if (intersects(this._enemyBox(e), hurtBox)) {
        if (now >= (this._iframeUntil || 0)) {
          const base = e.enemyType === 'brute' ? 12 : e.enemyType === 'archer' ? 6 : 8
          const dmg = Math.round(base * (1 + 0.05 * Math.max(0, this.wave - 1)))
          if (!invincible) {
            this.hp = Math.max(0, this.hp - dmg)
            onPlayerHurt()
          }
          this._iframeUntil = now + 900
          this._flashUntil = now + 200
          this._float(this.player.x, this.player.y - this.player.displayHeight / 2, `-${dmg}`, '#ff9f43')
          if (this.hp <= 0) this._die(e.displayName || e.enemyType)
        }
      }
      if (now < e.flashUntil) e.setAlpha(0.6)
      else e.setAlpha(1)
      e.setDepth(e.body.bottom + (this.sceneId === 'overworld' ? OVERWORLD_DEPTH_BIAS : 0))
    }
    for (let i = kids.length - 1; i >= 0; i--) {
      const e = kids[i]
      if (e.hp > 0 || e._deathProcessed) continue
      e._deathProcessed = true
      this.overworld?.noteDeath(e)
      this._dropLoot(e)
      this._float(e.x, e.y, '✕', '#ff4444')
      if (e.hpText) e.hpText.destroy()
      e.destroy()
    }
    if (this.sceneId === 'dungeonInterior' && this.enemiesSpawned && this.enemies.countActive() === 0 && this.nextWaveAt === 0) {
      this.nextWaveAt = now + 2500
    }
    void dt
  }

  _launchFrom(x, y, dx, dy, spec) {
    const prevX = this.facingX
    const prevY = this.facingY
    this.facingX = dx
    this.facingY = dy
    const size = spec.size * this.unit
    const speed = spec.speed * this.unit
    const startX = x + dx * 8 * this.unit
    const startY = y + dy * 8 * this.unit
    const pr = {
      x: startX - size / 2,
      y: startY - size / 2,
      w: size,
      h: size,
      vx: dx * speed,
      vy: dy * speed,
      startX,
      startY,
      maxDist: spec.dist * this.unit,
      owner: 'enemy',
      impact: 'arrow',
      special: '',
      lingerMs: 0,
      sprite: null,
      dom: null,
    }
    const key = this.textures.exists(PATHS.goblinArrow) ? PATHS.goblinArrow : '__px'
    const spr = this.add.image(startX, startY, key).setDepth(15000)
    spr.setDisplaySize(size * 2.2, size * 0.7)
    spr.rotation = Math.atan2(dy, dx)
    pr.sprite = spr
    this.projectiles.push(pr)
    this.facingX = prevX
    this.facingY = prevY
  }

  _dropLoot(e) {
    const gems = { ruby: 0, sapphire: 0, emerald: 0 }
    const items = []
    const type = e.enemyType
    if (type === 'goblin') {
      if (Math.random() < 0.35) gems.ruby += 1
      if (Math.random() < 0.15) gems.emerald += 1
      if (Math.random() < 0.15) items.push({ id: 'speed_potion', count: 1 })
    } else if (type === 'brute') {
      gems.ruby += Math.random() < 0.6 ? 1 : 0
      gems.sapphire += Math.random() < 0.5 ? 1 : 0
      if (Math.random() < 0.25) items.push({ id: 'healing_potion', count: 1 })
    } else if (type === 'archer') {
      if (Math.random() < 0.3) gems.sapphire += 1
      if (Math.random() < 0.25) items.push({ id: 'mana_potion', count: 1 })
    }
    const had = gems.ruby || gems.sapphire || gems.emerald || items.length
    if (had) eventBus.emit(GameEvents.LOOT, { gems, items })
  }

  _updateProjectiles(now, dt) {
    const solids = this._solidRects
    const inset = 4 * this.unit
    const pb = this._readPlayerBox()
    const hurt = this._hurt || (this._hurt = { x: 0, y: 0, w: 0, h: 0 })
    hurt.x = pb.x + inset
    hurt.y = pb.y + inset
    hurt.w = Math.max(1, pb.w - inset * 2)
    hurt.h = Math.max(1, pb.h - inset * 2)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]
      pr.x += pr.vx * dt
      pr.y += pr.vy * dt
      if (pr.dom) {
        pr.dom.x = pr.x
        pr.dom.y = pr.y
      }
      if (pr.sprite) {
        pr.sprite.setPosition(pr.x + pr.w / 2, pr.y + pr.h / 2)
      }
      const dist = Math.hypot(pr.x + pr.w / 2 - pr.startX, pr.y + pr.h / 2 - pr.startY)
      let hitEnemy = false
      if (pr.owner !== 'enemy') {
        const kids = this.enemies.getChildren()
        for (let k = 0; k < kids.length; k++) {
          const e = kids[k]
          if (e.hp <= 0) continue
          const dx = pr.x + pr.w / 2 - e.x
          const dy = pr.y + pr.h / 2 - e.y
          if (dx * dx + dy * dy > (300 * this.unit) * (300 * this.unit)) continue
          if (!intersects(pr, this._enemyBox(e))) continue
          if (pr.special === 'lifeLeech') {
            const dmg = Math.max(1, Math.floor(e.hp * 0.4))
            e.hp = Math.max(0, e.hp - dmg)
            e.flashUntil = now + 180
            this._float(e.x, e.y - 6, `-${dmg}`, '#bb3cff')
            const before = this.hp
            this.hp = Math.min(this.hpMax, this.hp + dmg)
            const healed = this.hp - before
            if (healed > 0) this._float(this.player.x, this.player.y - 12, `+${healed}`, '#7cfc7c')
          } else {
            const dmg = pr.impact === 'poison' ? 8 : 10
            e.hp = Math.max(0, e.hp - dmg)
            e.flashUntil = now + 180
            this._float(e.x, e.y - 6, `-${dmg}`, '#ff6161')
          }
          hitEnemy = true
          break
        }
      } else if (intersects(pr, hurt) && !this.dead) {
        if (now >= (this._iframeUntil || 0)) {
          const invincible = session.classId === 'thief' && now < session.thiefSmokeUntil
          if (!invincible) {
            this.hp = Math.max(0, this.hp - 7)
            onPlayerHurt()
          }
          this._iframeUntil = now + 900
          this._flashUntil = now + 250
          this._float(this.player.x, this.player.y - 10, '-7', '#ff9f43')
          if (this.hp <= 0) this._die('Goblin Archer')
        }
        this._killProjectile(i, false)
        continue
      }
      let hitWall = false
      for (let s = 0; s < solids.length; s++) {
        if (intersects(pr, solids[s])) {
          hitWall = true
          break
        }
      }
      if (hitEnemy || hitWall || dist >= pr.maxDist) {
        if (pr.owner === 'enemy' || pr.special === 'lifeLeech') this._killProjectile(i, false)
        else this._killProjectile(i, true)
      }
    }
  }

  _killProjectile(i, linger) {
    const pr = removeAt(this.projectiles, i)
    if (linger) {
      const isPoison = pr.impact === 'poison'
      const src = isPoison ? PATHS.poisonPotionGif : PATHS.animatedFireSmallGif
      const scale = isPoison ? 1 : 1.75
      const w = Math.round(pr.w * scale)
      const h = Math.round(pr.h * scale)
      const x = pr.x + pr.w / 2 - w / 2
      const y = pr.y + pr.h / 2 - h / 2
      const dom = this.fx.spawn(src, x, y, w, h)
      this.fires.push({
        x, y, w, h, dom,
        until: performance.now() + (pr.lingerMs || FIRE_LINGER_MS),
        dps: isPoison ? 5 : 2,
        poison: isPoison,
      })
      onSpellImpact()
    }
    if (pr.sprite) pr.sprite.destroy()
    if (pr.dom) this.fx.release(pr.dom)
  }

  _updateFires(now, dt) {
    const kids = this.enemies.getChildren()
    for (let i = 0; i < this.fires.length; i++) {
      const f = this.fires[i]
      for (let k = 0; k < kids.length; k++) {
        const e = kids[k]
        if (e.hp <= 0) continue
        const dx = f.x + f.w / 2 - e.x
        const dy = f.y + f.h / 2 - e.y
        if (dx * dx + dy * dy > (280 * this.unit) * (280 * this.unit)) continue
        if (intersects(f, this._enemyBox(e))) e.hp = Math.max(0, e.hp - f.dps * dt)
      }
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      if (now < this.fires[i].until) continue
      this.fx.release(this.fires[i].dom)
      removeAt(this.fires, i)
    }
  }

  _updateFloats(now, dt) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const t = this.floats[i]
      if (now >= t.until) {
        t.setVisible(false)
        this.floatPool.push(t)
        removeAt(this.floats, i)
        continue
      }
      t.y -= 20 * this.unit * dt
      const life = (t.until - now) / 700
      t.setAlpha(life)
    }
  }

  _float(x, y, text, color) {
    let t = this.floatPool.pop()
    if (!t) {
      t = this.add.text(0, 0, '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
      }).setOrigin(0.5, 1).setDepth(30000)
    }
    t.setText(text)
    t.setColor(color)
    t.setPosition(x, y)
    t.setAlpha(1)
    t.setVisible(true)
    t.until = performance.now() + 700
    this.floats.push(t)
  }

  _die(type) {
    if (this.dead) return
    this.dead = true
    this.player.setVelocity(0, 0)
    this._publishVitals(true)
    eventBus.emit(GameEvents.DIED, { killer: enemyLabel(type) })
  }

  _heal(amount) {
    if (!(this.hpMax > 0)) return
    this.hp = Math.min(this.hpMax, this.hp + amount)
    this._publishVitals(true)
  }

  _addMana(amount) {
    if (!(this.manaMax > 0)) return
    this.mana = Math.min(this.manaMax, (this.mana || 0) + amount)
    this._publishVitals(true)
  }

  _notice(text) {
    eventBus.emit(GameEvents.NOTICE, { text })
  }

  _publishVitals(force) {
    session.hp = this.hp
    session.hpMax = this.hpMax
    session.mana = this.mana
    session.manaMax = this.manaMax
    const hp = Math.ceil(this.hp)
    const mana = Math.floor(this.mana)
    if (!force && hp === this._pubHp && mana === this._pubMana && this.hpMax === this._pubHpMax) return
    this._pubHp = hp
    this._pubMana = mana
    this._pubHpMax = this.hpMax
    eventBus.emit(GameEvents.VITALS, { hp: this.hp, hpMax: this.hpMax, mana: this.mana, manaMax: this.manaMax })
  }

  _resetRun() {
    this.dead = false
    this.openedChests.clear()
    this.wave = 1
    this.enemiesSpawned = false
    this.nextWaveAt = 0
    this._attacking = false
    this._attackUntil = 0
    this._iframeUntil = 0
    this._clearTransient()
    this.hp = this.hpMax || 100
    this.mana = 0
    this.manaMax = 0
    this._publishVitals(true)
    this.overworld?.reset()
    this.enterScene('overworld', 'start')
    this.player.setVisible(false)
    this._appliedClass = null
  }

  enterScene(id, spawn, slideMs = 0) {
    this.sceneId = id
    this._clearTransient()
    if (id !== 'dungeonInterior') {
      this._clearEnemies()
      this.wave = 1
      this.enemiesSpawned = false
      this.nextWaveAt = 0
    } else {
      this._clearEnemies()
      this.wave = 1
      this.enemiesSpawned = false
      this.nextWaveAt = 0
    }
    if (id === 'overworld') this.overworld.show(spawn, slideMs)
    else {
      this.overworld?.hide()
      if (id === 'wilderness') this._showWilderness(spawn, slideMs)
      else this._showPainted(id, spawn, slideMs)
    }
    this._skipRest = true
    this._activeLabel = null
    eventBus.emit(GameEvents.PROMPT, { label: '' })
    eventBus.emit(GameEvents.SCENE_CHANGE, { scene: id })
  }

  _showPainted(id, spawn, slideMs) {
    const def = PAINTED_SCENES[id] || PAINTED_SCENES.village
    this._playerPixelH = 0
    this._clearVisuals()
    const key = def.bg && this.textures.exists(def.bg) ? def.bg : null
    let worldW = PAINTED_WORLD_W
    let worldH = PAINTED_WORLD_H
    if (key) {
      const src = this.textures.get(key).getSourceImage()
      if (src?.width && src?.height) {
        worldW = src.width
        worldH = src.height
      }
      this.bg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0)
      this.bg.setDisplaySize(worldW, worldH)
    }
    this._setPlayfield(0, 0, worldW, worldH, slideMs)
    this._buildSolids(def.colliders)
    this._sizePlayer(def.playerScale || 0.13)
    const sp = spawn || def.spawn
    this._placePlayer(sp.nx, sp.ny)
    this._buildPrompts()
    this.player.setDepth(10)
  }

  _showWilderness(spawn, slideMs) {
    const nodeId = this.wildNodeId || WILDERNESS_ENTRANCE_ID
    const layout = loadWildernessScreen(nodeId)
    this.wildNodeId = nodeId
    this.wildLayout = layout
    const sp = spawn || spawnFromHub(layout)
    this._mountWilderness(layout, sp, slideMs)
    this.wildLatchUntil = performance.now() + 600
  }

  _mountWilderness(layout, spawn, slideMs = 0) {
    this._clearVisuals()
    this._setPlayfield(0, 0, WILDERNESS_WORLD_W, WILDERNESS_WORLD_H, slideMs)
    this._drawWilderness(layout)
    this._buildSolids(collidersWithExitGaps(layout))
    this._sizePlayer(0.11)
    this._placePlayer(spawn.nx, spawn.ny)
    this._buildPrompts()
    this.wildLatchUntil = performance.now() + 600
  }

  _drawWilderness(layout) {
    const worldW = WILDERNESS_WORLD_W
    const worldH = WILDERNESS_WORLD_H
    const tw = WILDERNESS_CELL
    const th = WILDERNESS_CELL
    const cells = layout?.tiles?.cells || []
    const cols = layout?.tiles?.cols || WILDERNESS_COLS
    this.props = this.props || []
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (!cell) continue
      const col = i % cols
      const row = (i - col) / cols
      const asset = getAsset(cell.assetId)
      const key = asset?.src && this.textures.exists(cell.assetId) ? cell.assetId : null
      if (key) {
        const img = this.add.image(col * tw + tw / 2, row * th + th / 2, key)
        img.setDisplaySize(tw, th)
        if (cell.rotation) img.setAngle(cell.rotation)
        img.setDepth(0)
        this.props.push(img)
      } else {
        const fill = cell.kind === 'path' ? 0x8c6e46 : 0x4a6b2f
        const rect = this.add.rectangle(col * tw + tw / 2, row * th + th / 2, tw, th, fill, 1)
        rect.setDepth(0)
        this.props.push(rect)
      }
    }
    const objects = layout?.objects || []
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i]
      const asset = getAsset(o.assetId)
      const scale = Number(o.scale) || 1
      const nw = asset ? (asset.w / 1024) * scale : 0.06
      const nh = asset ? (asset.h / 1536) * scale : 0.08
      const pw = nw * worldW
      const ph = nh * worldH
      const px = o.nx * worldW
      const py = o.ny * worldH
      const originY = asset?.anchor === 'center' ? 0.5 : 1
      if (asset?.src && this.textures.exists(o.assetId)) {
        const img = this.add.image(px, py, o.assetId)
        img.setOrigin(0.5, originY)
        img.setDisplaySize(pw, ph)
        img.setDepth(py)
        this.props.push(img)
      } else {
        const rect = this.add.rectangle(px, py, pw, ph, placeholderColor(o.assetId), 0.95)
        rect.setOrigin(0.5, originY)
        rect.setStrokeStyle(1, 0x000000, 0.45)
        rect.setDepth(py)
        this.props.push(rect)
      }
    }
  }

  _setPlayfield(x, y, w, h, slideMs) {
    this.worldW = w
    this.worldH = h
    this.unit = h / 900
    this.physics.world.setBounds(x, y, w, h)
    this.screenCamera.setScreenBounds({ x, y, width: w, height: h }, { slideMs })
  }

  _sizePlayer(scale) {
    this._playerScale = scale
    const url = this.player.texture?.key
    if (url && url !== '__px' && url !== '__MISSING') this._applySprite(this._spriteUrl || url)
    else {
      const targetH = Math.max(24, Math.round(scale * this.worldH))
      this.player.setDisplaySize(Math.round(targetH * 0.67), targetH)
      this.player.body.setSize(this.player.width, this.player.height, true)
    }
  }

  _placePlayer(nx, ny) {
    const w = this.player.displayWidth
    const h = this.player.displayHeight
    const x = Math.min(Math.max(nx * this.worldW, w / 2), this.worldW - w / 2)
    const y = Math.min(Math.max(ny * this.worldH, h / 2), this.worldH - h / 2)
    this.player.setPosition(x, y)
    this.player.body.reset(x, y)
  }

  _buildSolids(rects) {
    this.solids.clear(true, true)
    this._solidRects.length = 0
    if (!rects) {
      this._redrawStaticDebug()
      return
    }
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      const x = r.x * this.worldW
      const y = r.y * this.worldH
      const w = r.w * this.worldW
      const h = r.h * this.worldH
      if (!(w > 1) || !(h > 1)) continue
      const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
      rect.setVisible(false)
      this.physics.add.existing(rect, true)
      rect.body.updateFromGameObject()
      this.solids.add(rect)
      const hit = { x, y, w, h }
      this._solidRects.push(hit)
    }
    this._redrawStaticDebug()
  }

  _buildPrompts() {
    for (let i = 0; i < this.beaconLabels.length; i++) this.beaconLabels[i].destroy()
    this.beaconLabels.length = 0
    this.prompts = []
    if (this.sceneId === 'wilderness') {
      const list = wildernessExitPrompts(this.wildLayout, this.wildNodeId)
      for (let i = 0; i < list.length; i++) {
        const p = list[i]
        this._pushPrompt(p.rect, p.label, p.short, p.kind || 'exit', 'none')
      }
      return
    }
    const def = PAINTED_SCENES[this.sceneId]
    if (!def) return
    const zones = def.zones || []
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i]
      const prompt = this._pushPrompt(z.rect, z.label, z.short, z.kind, z.action)
      prompt.to = z.to
      prompt.spawn = z.spawn
      prompt.save = z.save
    }
    if (def.bartender) {
      const b = def.bartender
      const bw = b.w * this.unit
      const bh = b.h * this.unit
      const pad = b.pad * this.unit
      const cx = b.nx * this.worldW
      const cy = b.ny * this.worldH
      const rect = {
        x: (cx - bw / 2 - pad) / this.worldW,
        y: (cy - bh / 2 - pad) / this.worldH,
        w: (bw + pad * 2) / this.worldW,
        h: (bh + pad * 2) / this.worldH,
      }
      this._pushPrompt(rect, 'Press E to talk', 'Bartender', 'talk', 'bartender')
    }
    if (def.chests) {
      for (let i = 0; i < def.chests.length; i++) {
        if (this.openedChests.has(i)) continue
        const c = def.chests[i]
        const prompt = this._pushPrompt(
          c.rect,
          c.locked ? 'Press E to pick the lock' : 'Press E to open the chest',
          c.locked ? 'Locked' : 'Chest',
          'loot',
          'chest',
        )
        prompt.chestIndex = i
        prompt.locked = c.locked
      }
    }
  }

  _pushPrompt(rect, label, short, kind, action) {
    const prompt = {
      x: rect.x * this.worldW,
      y: rect.y * this.worldH,
      w: rect.w * this.worldW,
      h: rect.h * this.worldH,
      label,
      short,
      kind: kind || 'exit',
      action,
    }
    this.prompts.push(prompt)
    const color = KIND_COLOR[prompt.kind] || KIND_COLOR.exit
    const text = this.add.text(prompt.x + prompt.w / 2, prompt.y - 6, short, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#e8f5ee',
      backgroundColor: '#0f172acc',
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(21000)
    text.setColor(color === KIND_COLOR.talk ? '#dbeafe' : '#e8f5ee')
    this.beaconLabels.push(text)
    return prompt
  }

  _pushPixelPrompt(rect, label, short, kind, action) {
    const prompt = {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      label,
      short,
      kind: kind || 'exit',
      action,
    }
    this.prompts.push(prompt)
    const color = KIND_COLOR[prompt.kind] || KIND_COLOR.exit
    const text = this.add.text(prompt.x + prompt.w / 2, prompt.y - 2, short, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#e8f5ee',
      backgroundColor: '#0f172acc',
      padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setDepth(21000)
    text.setColor(color === KIND_COLOR.talk ? '#dbeafe' : '#e8f5ee')
    this.beaconLabels.push(text)
    return prompt
  }

  _present(now) {
    const vanishing = session.classId === 'thief' && now < session.thiefVanishUntil
    const smoke = session.classId === 'thief' && now < session.thiefSmokeUntil
    const showSprite = !vanishing && (!smoke || this._attacking)
    if (session.classId) this.player.setVisible(showSprite)
    if (now < (this._flashUntil || 0)) this.player.setAlpha(0.5)
    else this.player.setAlpha(1)
    if (this.sceneId === 'wilderness') this.player.setDepth(this.player.body.bottom)
    else if (this.sceneId === 'overworld') {
      this.player.setDepth(this.player.body.bottom + OVERWORLD_DEPTH_BIAS)
      if (!this._footShadow) {
        this._footShadow = this.add.ellipse(0, 0, 12, 4, 0x000000, 0.35).setDepth(1)
      }
      this._footShadow.setVisible(this.player.visible)
      this._footShadow.setPosition(this.player.x, this.player.body.bottom - 1)
      this._footShadow.setDepth(this.player.body.bottom + OVERWORLD_DEPTH_BIAS - 1)
    } else if (this._footShadow) {
      this._footShadow.setVisible(false)
    }
    this._drawEnemyHp()

    this._syncStealth(now, vanishing, smoke)
    this.fx.sync(this.cameras.main)
    this._drawBeacons()
    this._drawConsume(now)
    if (this.debugOn) this._drawDebugPlayer()
    else if (this._debugPlayerDirty) {
      this.debugGfx.clear()
      this._redrawStaticDebug()
      this._debugPlayerDirty = false
    }
  }

  _syncStealth(now, vanishing, smoke) {
    const src = vanishing ? PATHS.thiefDisappearGif : smoke && !this._attacking ? PATHS.thiefSmokeGif : null
    if (!src) {
      if (this._stealthNode) {
        this.fx.release(this._stealthNode)
        this._stealthNode = null
      }
      return
    }
    const b = this._readPlayerBox()
    if (!this._stealthNode || this._stealthSrc !== src) {
      if (this._stealthNode) this.fx.release(this._stealthNode)
      this._stealthNode = this.fx.spawn(src, b.x, b.y, b.w, b.h)
      this._stealthSrc = src
    }
    this._stealthNode.x = b.x
    this._stealthNode.y = b.y
    this._stealthNode.w = b.w
    this._stealthNode.h = b.h
    void now
  }

  _drawBeacons() {
    const g = this.beaconGfx
    g.clear()
    const box = this._readPlayerBox()
    let label = ''
    const pulse = 0.35 + 0.35 * Math.sin(performance.now() / 350)
    for (let i = 0; i < this.prompts.length; i++) {
      const p = this.prompts[i]
      const on = intersects(box, p)
      if (on) label = p.label
      const color = KIND_COLOR[p.kind] || KIND_COLOR.exit
      g.lineStyle(on ? 3 : 2, color, on ? 0.95 : pulse)
      g.strokeRect(p.x, p.y, p.w, p.h)
      const text = this.beaconLabels[i]
      if (text) {
        text.setPosition(p.x + p.w / 2, p.y - 4)
        const show = this.sceneId !== 'overworld' || on
        text.setVisible(show)
        text.setAlpha(on ? 1 : 0.85)
      }
    }
    if (label !== this._activeLabel) {
      this._activeLabel = label
      eventBus.emit(GameEvents.PROMPT, { label })
    }
  }

  _drawEnemyHp() {
    const g = this.hpGfx
    g.clear()
    const kids = this.enemies.getChildren()
    for (let i = 0; i < kids.length; i++) {
      const e = kids[i]
      if (!(e.hp > 0)) {
        if (e.hpText) e.hpText.setVisible(false)
        continue
      }
      const w = Math.max(20, e.displayWidth)
      const x = e.x - w / 2
      const y = e.y - e.displayHeight / 2 - 8
      g.fillStyle(0x000000, 0.6)
      g.fillRect(x, y, w, 4)
      g.fillStyle(0xdc2626, 0.9)
      g.fillRect(x, y, w * Math.max(0, Math.min(1, e.hp / e.hpMax)), 4)
      if (!e.hpText) {
        e.hpText = this.add.text(0, 0, '', {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#ffd7a1',
        }).setOrigin(0.5, 1).setDepth(19000)
      }
      e.hpText.setVisible(true)
      e.hpText.setPosition(e.x, y - 1)
      const label = String(Math.ceil(e.hp))
      if (e.hpText.text !== label) e.hpText.setText(label)
    }
  }

  _drawConsume(now) {
    const g = this.consumeGfx
    g.clear()
    if (!this._consuming) return
    const frac = Math.max(0, Math.min(1, (now - this._consumeStart) / 1000))
    const x = this.player.x
    const y = this.player.y - this.player.displayHeight / 2 - 16 * this.unit
    const r = 10 * this.unit
    g.lineStyle(3, 0x000000, 0.6)
    g.strokeCircle(x, y, r)
    g.lineStyle(3, 0xfbbf24, 0.95)
    g.beginPath()
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false)
    g.strokePath()
  }

  _redrawStaticDebug() {
    const g = this.debugGfx
    g.clear()
    if (!this.debugOn) return
    g.lineStyle(2, 0x39ff6a, 0.9)
    const rects = this._solidRects
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      g.strokeRect(r.x, r.y, r.w, r.h)
    }
    this._debugPlayerDirty = true
  }

  _drawDebugPlayer() {
    this._debugPlayerDirty = true
    this._redrawStaticDebug()
    const b = this._readPlayerBox()
    this.debugGfx.lineStyle(2, 0xffffff, 0.9)
    this.debugGfx.strokeRect(b.x, b.y, b.w, b.h)
  }

  _readPlayerBox() {
    const b = this.player.body
    const box = this._box
    box.x = b.x
    box.y = b.y
    box.w = b.width
    box.h = b.height
    return box
  }

  _clearVisuals() {
    if (this.bg) {
      this.bg.destroy()
      this.bg = null
    }
    if (this.props) {
      for (let i = 0; i < this.props.length; i++) this.props[i].destroy()
      this.props.length = 0
    } else {
      this.props = []
    }
    this.solids.clear(true, true)
    this._solidRects.length = 0
  }

  _clearEnemies() {
    const kids = this.enemies.getChildren()
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].hpText) kids[i].hpText.destroy()
    }
    this.enemies.clear(true, true)
  }

  _clearTransient() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) this._killProjectile(i, false)
    for (let i = this.fires.length - 1; i >= 0; i--) {
      this.fx.release(this.fires[i].dom)
      this.fires.pop()
    }
    if (this._stealthNode) {
      this.fx.release(this._stealthNode)
      this._stealthNode = null
      this._stealthSrc = ''
    }
  }

  _clearCombatTransient() {
    this._clearTransient()
  }
}
