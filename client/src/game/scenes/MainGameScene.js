import Phaser from 'phaser'
import { EventBus } from '../EventBus'
import { PATHS, CLASS_SPRITES } from '../../config/paths'
import { TERRAIN_ASSETS } from '../../config/terrainAssets.js'
import {
  WILDERNESS_ENTRANCE_ID,
  getNeighbors,
  oppositeEdge,
} from '../terrain/worldGraph.js'
import { getLayout, preloadNeighbors, evictBeyond } from '../terrain/screenCache.js'
import { drawWilderness, wildernessCollidersPx } from '../terrain/render.js'

const PLAYER_SPEED = 180
const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 1080
const FRAME = { dx: 0, dy: 0, dw: WORLD_WIDTH, dh: WORLD_HEIGHT }

/** Fraction of frame near an edge that triggers a screen transition. */
const EXIT_MARGIN = 0.035
/** Hub portal: walk south of this ny to enter wilderness. */
const HUB_EXIT_NY = 0.92
/** Spawn inset from the arrival edge (normalized). */
const SPAWN_INSET = 0.06

/**
 * Top-down overworld scene: Arcade Physics movement, camera follow,
 * hub ↔ wilderness transitions, and EventBus bridge to React HUD.
 */
export default class MainGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainGameScene' })
    this.player = null
    this.cursors = null
    this.wasd = null
    this.interactKey = null
    this.npc = null
    this.hubBg = null
    this.hubExitMarker = null
    this.playerHealth = 100
    this.maxHealth = 100
    this._onStartDialogue = null
    this._dialogueOpen = false

    /** @type {'hub'|'wilderness'} */
    this.mode = 'hub'
    this.wildernessNodeId = null
    this.wildernessLayer = null
    this.wildernessHud = null
    this.wildernessColliders = null
    this._transitionLock = false
  }

  preload() {
    this.load.image('village', PATHS.villageBg)
    this.load.image('player', CLASS_SPRITES.knight)
    // Only preload ground tiles that exist on disk (prop art still pending)
    for (const asset of TERRAIN_ASSETS) {
      if (asset.category !== 'ground') continue
      this.load.image(asset.id, asset.src)
    }
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    // Always start in the town hub (familiar village + townsfolk)
    this.mode = 'hub'
    this.wildernessNodeId = null

    this.hubBg = this.add.image(0, 0, 'village').setOrigin(0, 0)
    const scaleX = WORLD_WIDTH / this.hubBg.width
    const scaleY = WORLD_HEIGHT / this.hubBg.height
    this.hubBg.setScale(Math.max(scaleX, scaleY))

    this.player = this.physics.add.sprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.55, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setScale(0.35)
    this.player.body.setSize(this.player.width * 0.5, this.player.height * 0.4)
    this.player.body.setOffset(this.player.width * 0.25, this.player.height * 0.5)
    this.player.setDepth(20)

    this.npc = this.physics.add.staticImage(WORLD_WIDTH * 0.62, WORLD_HEIGHT * 0.5, 'player')
    this.npc.setTint(0x88aaff)
    this.npc.setScale(0.35)
    this.npc.refreshBody()
    this.npc.setDepth(15)

    // Visible hub → wilderness exit along the south edge
    this.hubExitMarker = this.add.container(0, 0).setDepth(5)
    this.hubExitMarker.add([
      this.add.rectangle(
        WORLD_WIDTH * 0.5,
        WORLD_HEIGHT * 0.96,
        WORLD_WIDTH * 0.28,
        18,
        0xffdc50,
        0.85,
      ),
      this.add
        .text(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.96, 'Wilderness →', {
          fontFamily: 'serif',
          fontSize: '16px',
          color: '#1c1917',
        })
        .setOrigin(0.5),
    ])

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12)
    this.cameras.main.setZoom(1)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)

    this._onStartDialogue = () => {
      this._dialogueOpen = true
      if (this.player?.body) this.player.setVelocity(0, 0)
    }
    this._onEndDialogue = () => {
      this._dialogueOpen = false
    }
    EventBus.on('start-dialogue', this._onStartDialogue)
    EventBus.on('end-dialogue', this._onEndDialogue)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._cleanupEventBus, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this._cleanupEventBus, this)

    EventBus.emit('scene-ready', this)
    EventBus.emit('player-health-changed', this.playerHealth)
    EventBus.emit('player-max-health-changed', this.maxHealth)
  }

  /** Build CanvasImageSource map from preloaded Phaser textures. */
  _terrainImagesById() {
    /** @type {Record<string, CanvasImageSource>} */
    const images = {}
    for (const asset of TERRAIN_ASSETS) {
      if (!this.textures.exists(asset.id)) continue
      const src = this.textures.get(asset.id).getSourceImage()
      if (src) images[asset.id] = /** @type {CanvasImageSource} */ (src)
    }
    return images
  }

  _cleanupEventBus() {
    if (this._onStartDialogue) {
      EventBus.off('start-dialogue', this._onStartDialogue)
      this._onStartDialogue = null
    }
    if (this._onEndDialogue) {
      EventBus.off('end-dialogue', this._onEndDialogue)
      this._onEndDialogue = null
    }
  }

  update() {
    if (!this.player?.body) return

    if (this._dialogueOpen) {
      this.player.setVelocity(0, 0)
      return
    }

    let vx = 0
    let vy = 0

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx -= 1
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx += 1
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy -= 1
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy += 1

    if (vx !== 0 && vy !== 0) {
      const inv = Math.SQRT1_2
      vx *= inv
      vy *= inv
    }

    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED)

    if (vx < 0) this.player.setFlipX(true)
    else if (vx > 0) this.player.setFlipX(false)

    if (this.mode === 'hub') {
      this._updateHub()
    } else if (this.mode === 'wilderness') {
      this._updateWilderness()
    }
  }

  _updateHub() {
    if (this._transitionLock) return

    // South-edge portal → wilderness entrance
    if (this.player.y / WORLD_HEIGHT >= HUB_EXIT_NY) {
      this.enterWilderness(WILDERNESS_ENTRANCE_ID, 'north')
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.npc) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.npc.x,
        this.npc.y,
      )
      if (dist < 120) {
        EventBus.emit('start-dialogue', {
          speaker: 'Village Guide',
          lines: [
            'Welcome to Hollowvale, traveler.',
            'Walk south past the golden gate to enter the wilderness.',
            'Use WASD or arrow keys to move. Press E near townsfolk to talk.',
          ],
        })
      }
    }
  }

  _updateWilderness() {
    if (this._transitionLock || !this.wildernessNodeId) return

    const nx = this.player.x / WORLD_WIDTH
    const ny = this.player.y / WORLD_HEIGHT
    const neighbors = getNeighbors(this.wildernessNodeId)
    const layout = getLayout(this.wildernessNodeId)

    // Entrance node north edge returns to the hub (wired exit, not a graph neighbor)
    if (
      this.wildernessNodeId === WILDERNESS_ENTRANCE_ID &&
      ny <= EXIT_MARGIN
    ) {
      this.enterHub()
      return
    }

    /** @type {Array<'north'|'south'|'east'|'west'>} */
    const edges = ['north', 'south', 'east', 'west']
    for (const edge of edges) {
      if (!layout.exits?.[edge] || !neighbors[edge]) continue
      if (!this._nearEdge(nx, ny, edge)) continue
      this.enterWilderness(neighbors[edge], oppositeEdge(edge))
      return
    }
  }

  /**
   * @param {number} nx
   * @param {number} ny
   * @param {'north'|'south'|'east'|'west'} edge
   */
  _nearEdge(nx, ny, edge) {
    const inCorridor = nx >= 0.35 && nx <= 0.65
    const inVCorridor = ny >= 0.35 && ny <= 0.65
    switch (edge) {
      case 'north':
        return ny <= EXIT_MARGIN && inCorridor
      case 'south':
        return ny >= 1 - EXIT_MARGIN && inCorridor
      case 'west':
        return nx <= EXIT_MARGIN && inVCorridor
      case 'east':
        return nx >= 1 - EXIT_MARGIN && inVCorridor
      default:
        return false
    }
  }

  /**
   * @param {string} nodeId
   * @param {'north'|'south'|'east'|'west'} spawnEdge  edge to spawn along (arrival side)
   */
  enterWilderness(nodeId, spawnEdge = 'south') {
    if (this._transitionLock) return
    this._transitionLock = true

    this.mode = 'wilderness'
    this.wildernessNodeId = nodeId

    if (this.hubBg) this.hubBg.setVisible(false)
    if (this.npc) {
      this.npc.setVisible(false)
      this.npc.body.enable = false
    }
    if (this.hubExitMarker) this.hubExitMarker.setVisible(false)

    const layout = getLayout(nodeId)
    this._rebuildWildernessVisuals(layout)
    this._rebuildWildernessColliders(layout)
    this._spawnOnEdge(spawnEdge)

    preloadNeighbors(nodeId)
    evictBeyond(nodeId, 2)

    // Brief lock so we don't immediately re-trigger the opposite exit
    this.time.delayedCall(400, () => {
      this._transitionLock = false
    })
  }

  enterHub() {
    if (this._transitionLock) return
    this._transitionLock = true

    this.mode = 'hub'
    this.wildernessNodeId = null
    this._clearWilderness()

    if (this.hubBg) this.hubBg.setVisible(true)
    if (this.npc) {
      this.npc.setVisible(true)
      this.npc.body.enable = true
    }
    if (this.hubExitMarker) this.hubExitMarker.setVisible(true)

    // Spawn just north of the hub exit so we don't immediately re-enter wilderness
    this.player.setPosition(WORLD_WIDTH * 0.5, WORLD_HEIGHT * (HUB_EXIT_NY - 0.08))
    this.player.setVelocity(0, 0)

    this.time.delayedCall(400, () => {
      this._transitionLock = false
    })
  }

  /** @param {import('../terrain/generate.js').TerrainLayout} layout */
  _rebuildWildernessVisuals(layout) {
    this._clearWildernessVisuals()

    const canvas = document.createElement('canvas')
    canvas.width = WORLD_WIDTH
    canvas.height = WORLD_HEIGHT
    const ctx = canvas.getContext('2d')
    drawWilderness(ctx, layout, this._terrainImagesById(), FRAME)

    const key = 'wilderness-screen'
    if (this.textures.exists(key)) {
      this.textures.remove(key)
    }
    this.textures.addCanvas(key, canvas)

    this.wildernessLayer = this.add.container(0, 0).setDepth(1)
    this.wildernessLayer.add(this.add.image(0, 0, key).setOrigin(0, 0))

    // Screen-space HUD for manual testing (not world-scrolled)
    this.wildernessHud = this.add.container(0, 0).setDepth(50).setScrollFactor(0)
    this.wildernessHud.add(
      this.add
        .text(16, 12, `Wilderness: ${this.wildernessNodeId} (${layout.biome})`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#f5f5f4',
          backgroundColor: '#00000088',
          padding: { x: 6, y: 4 },
        }),
    )

    if (this.wildernessNodeId === WILDERNESS_ENTRANCE_ID) {
      this.wildernessLayer.add(
        this.add
          .text(WORLD_WIDTH * 0.5, 28, '↑ Village', {
            fontFamily: 'serif',
            fontSize: '16px',
            color: '#1c1917',
            backgroundColor: '#ffdc50',
            padding: { x: 8, y: 4 },
          })
          .setOrigin(0.5, 0),
      )
    }
  }

  /** @param {import('../terrain/generate.js').TerrainLayout} layout */
  _rebuildWildernessColliders(layout) {
    if (this.wildernessColliders) {
      this.wildernessColliders.clear(true, true)
      this.wildernessColliders = null
    }

    this.wildernessColliders = this.physics.add.staticGroup()
    const rects = wildernessCollidersPx(layout, FRAME).filter((r) =>
      this._isPlayableCollider(r, layout),
    )

    for (const r of rects) {
      const wall = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0)
      this.physics.add.existing(wall, true)
      this.wildernessColliders.add(wall)
    }
    this.physics.add.collider(this.player, this.wildernessColliders)
  }

  /**
   * Drop thin full-span border walls at open exits so the player can transition.
   * Object / carved colliders stay intact.
   * @param {{ x:number, y:number, w:number, h:number }} r  pixel rect
   * @param {import('../terrain/generate.js').TerrainLayout} layout
   */
  _isPlayableCollider(r, layout) {
    const nx = (r.x - FRAME.dx) / FRAME.dw
    const ny = (r.y - FRAME.dy) / FRAME.dh
    const nw = r.w / FRAME.dw
    const nh = r.h / FRAME.dh

    const isThinBorder =
      (nh <= 0.03 && nw >= 0.9) || (nw <= 0.03 && nh >= 0.9) || nx < -0.001 || ny < -0.001 || nx + nw > 1.001 || ny + nh > 1.001

    if (!isThinBorder) return true

    // Keep closed-edge borders; open exits need a gap (drop the wall entirely for stub)
    if (ny + nh <= 0.02 || ny < 0) return !layout.exits?.north
    if (ny >= 0.98) return !layout.exits?.south
    if (nx + nw <= 0.02 || nx < 0) return !layout.exits?.west
    if (nx >= 0.98) return !layout.exits?.east
    return true
  }

  /**
   * @param {'north'|'south'|'east'|'west'} edge
   */
  _spawnOnEdge(edge) {
    let x = WORLD_WIDTH * 0.5
    let y = WORLD_HEIGHT * 0.5
    switch (edge) {
      case 'north':
        y = WORLD_HEIGHT * SPAWN_INSET
        break
      case 'south':
        y = WORLD_HEIGHT * (1 - SPAWN_INSET)
        break
      case 'west':
        x = WORLD_WIDTH * SPAWN_INSET
        break
      case 'east':
        x = WORLD_WIDTH * (1 - SPAWN_INSET)
        break
      default:
        break
    }
    this.player.setPosition(x, y)
    this.player.setVelocity(0, 0)
  }

  _clearWildernessVisuals() {
    if (this.wildernessLayer) {
      this.wildernessLayer.destroy(true)
      this.wildernessLayer = null
    }
    if (this.wildernessHud) {
      this.wildernessHud.destroy(true)
      this.wildernessHud = null
    }
    if (this.textures.exists('wilderness-screen')) {
      this.textures.remove('wilderness-screen')
    }
  }

  _clearWilderness() {
    this._clearWildernessVisuals()
    if (this.wildernessColliders) {
      this.wildernessColliders.clear(true, true)
      this.wildernessColliders = null
    }
  }

  /** Called from React (via EventBus or scene ref) to adjust health. */
  setPlayerHealth(health) {
    this.playerHealth = Phaser.Math.Clamp(health, 0, this.maxHealth)
    EventBus.emit('player-health-changed', this.playerHealth)
  }
}
