import Phaser from 'phaser'
import { EventBus } from '../EventBus'
import { PATHS, CLASS_SPRITES } from '../../config/paths'

const PLAYER_SPEED = 180
const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 1080

/**
 * Top-down overworld scene: Arcade Physics movement, camera follow,
 * and EventBus bridge to React HUD / dialogue overlays.
 */
export default class MainGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainGameScene' })
    this.player = null
    this.cursors = null
    this.wasd = null
    this.interactKey = null
    this.npc = null
    this.playerHealth = 100
    this.maxHealth = 100
    this._onStartDialogue = null
    this._dialogueOpen = false
  }

  preload() {
    // Vite serves files from client/public at the site root
    this.load.image('village', PATHS.villageBg)
    this.load.image('player', CLASS_SPRITES.knight)
  }

  create() {
    const bg = this.add.image(0, 0, 'village').setOrigin(0, 0)
    // Scale background to world size while preserving aspect if needed
    const scaleX = WORLD_WIDTH / bg.width
    const scaleY = WORLD_HEIGHT / bg.height
    const scale = Math.max(scaleX, scaleY)
    bg.setScale(scale)

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

    this.player = this.physics.add.sprite(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.55, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setScale(0.35)
    this.player.body.setSize(this.player.width * 0.5, this.player.height * 0.4)
    this.player.body.setOffset(this.player.width * 0.25, this.player.height * 0.5)

    // Simple static NPC stand-in (tinted player sprite) for dialogue demos
    this.npc = this.physics.add.staticImage(WORLD_WIDTH * 0.62, WORLD_HEIGHT * 0.5, 'player')
    this.npc.setTint(0x88aaff)
    this.npc.setScale(0.35)
    this.npc.refreshBody()

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

    // React → Phaser: pause movement while dialogue is open
    this._onStartDialogue = () => {
      this._dialogueOpen = true
      if (this.player?.body) {
        this.player.setVelocity(0, 0)
      }
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
      // Normalize diagonal movement
      const inv = Math.SQRT1_2
      vx *= inv
      vy *= inv
    }

    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED)

    if (vx < 0) this.player.setFlipX(true)
    else if (vx > 0) this.player.setFlipX(false)

    // Proximity interact → open React dialogue overlay
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
            'Use WASD or arrow keys to move. Press E near townsfolk to talk.',
          ],
        })
      }
    }
  }

  /** Called from React (via EventBus or scene ref) to adjust health. */
  setPlayerHealth(health) {
    this.playerHealth = Phaser.Math.Clamp(health, 0, this.maxHealth)
    EventBus.emit('player-health-changed', this.playerHealth)
  }
}
