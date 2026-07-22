import Phaser from 'phaser'
import { EventBus, GameEvents } from '../EventBus'
import { PATHS, CLASS_SPRITES } from '../../config/paths'

const PLAYER_SPEED = 180
const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 1080
const FOOTSTEP_INTERVAL_MS = 280
const NPC_INTERACT_RANGE = 120

/** Phaser sound keys ↔ asset paths (preloaded in Sound Manager) */
const SFX_ASSETS = {
  footstep: PATHS.sfxFootstep,
  door_open: PATHS.sfxDoorOpen,
  hit: PATHS.sfxHit,
  spell_cast: PATHS.sfxSpellCast || PATHS.fireballCastSfx,
  fire_impact: PATHS.sfxFireImpact || PATHS.fireImpactSfx,
  melee_swing: PATHS.sfxMeleeSwing,
}

const BARTENDER_GREETING =
  "Hrm. Traveler. Dragon business or town history—what'll it be? If you're short on supplies, swing by the Market after this."

/**
 * Top-down overworld scene: Arcade Physics movement, camera follow,
 * Phaser Sound Manager SFX, and EventBus bridge to React dialogue / TTS.
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
    this._onEndDialogue = null
    this._dialogueOpen = false
    this._lastFootstepAt = 0
    this._sfxVolume = 0.7
  }

  preload() {
    // Vite serves files from client/public at the site root
    this.load.image('village', PATHS.villageBg)
    this.load.image('player', CLASS_SPRITES.knight)

    // Preload SFX into Phaser Sound Manager
    for (const [key, url] of Object.entries(SFX_ASSETS)) {
      if (url) this.load.audio(key, url)
    }
  }

  create() {
    const bg = this.add.image(0, 0, 'village').setOrigin(0, 0)
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

    // Bartender stand-in (tinted sprite) for AI dialogue + TTS demos
    this.npc = this.physics.add.staticImage(WORLD_WIDTH * 0.62, WORLD_HEIGHT * 0.5, 'player')
    this.npc.setTint(0x88aaff)
    this.npc.setScale(0.35)
    this.npc.refreshBody()
    this.npc.setData('npcId', 'bartender')
    this.npc.setData('speaker', 'Tharos')
    this.npc.setData('greeting', BARTENDER_GREETING)

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

    // Unlock audio on first pointer/key gesture (browser autoplay policy)
    this.input.once('pointerdown', () => this._unlockAudio())
    this.input.keyboard?.once('keydown', () => this._unlockAudio())

    // React → Phaser: pause movement while dialogue is open
    this._onStartDialogue = () => {
      this._dialogueOpen = true
      if (this.player?.body) this.player.setVelocity(0, 0)
    }
    this._onEndDialogue = () => {
      this._dialogueOpen = false
    }
    EventBus.on(GameEvents.START_DIALOGUE, this._onStartDialogue)
    EventBus.on(GameEvents.END_DIALOGUE, this._onEndDialogue)
    EventBus.on(GameEvents.SFX_PLAY, this._onBusSfx, this)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._cleanupEventBus, this)
    this.events.once(Phaser.Scenes.Events.DESTROY, this._cleanupEventBus, this)

    EventBus.emit(GameEvents.SCENE_READY, this)
    EventBus.emit(GameEvents.PLAYER_HEALTH, this.playerHealth)
    EventBus.emit(GameEvents.PLAYER_MAX_HEALTH, this.maxHealth)
  }

  _unlockAudio() {
    try {
      if (this.sound && this.sound.context?.state === 'suspended') {
        this.sound.context.resume()
      }
      // Warm footstep so first play is lag-free
      if (this.cache.audio.exists('footstep')) {
        this.sound.add('footstep')
      }
    } catch { /* ignore */ }
  }

  /** Play a preloaded SFX key via Phaser Sound Manager */
  playSfx(key, { volume = 1, rate = 1 } = {}) {
    if (!key || !this.sound || !this.cache.audio.exists(key)) return null
    try {
      return this.sound.play(key, {
        volume: Math.max(0, Math.min(1, this._sfxVolume * volume)),
        rate,
      })
    } catch {
      return null
    }
  }

  _onBusSfx({ id, volume = 1, rate = 1 } = {}) {
    this.playSfx(id, { volume, rate })
  }

  _cleanupEventBus() {
    if (this._onStartDialogue) {
      EventBus.off(GameEvents.START_DIALOGUE, this._onStartDialogue)
      this._onStartDialogue = null
    }
    if (this._onEndDialogue) {
      EventBus.off(GameEvents.END_DIALOGUE, this._onEndDialogue)
      this._onEndDialogue = null
    }
    EventBus.off(GameEvents.SFX_PLAY, this._onBusSfx, this)
  }

  update(_time, delta) {
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

    // Throttled footsteps while moving
    const moving = vx !== 0 || vy !== 0
    if (moving) {
      this._lastFootstepAt += delta
      if (this._lastFootstepAt >= FOOTSTEP_INTERVAL_MS) {
        this._lastFootstepAt = 0
        const rate = 0.92 + Math.random() * 0.16
        this.playSfx('footstep', { volume: 0.45, rate })
      }
    } else {
      this._lastFootstepAt = FOOTSTEP_INTERVAL_MS
    }

    // Proximity interact → open React dialogue + stream TTS
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.npc) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.npc.x,
        this.npc.y,
      )
      if (dist < NPC_INTERACT_RANGE) {
        this._openNpcDialogue(this.npc)
      }
    }
  }

  _openNpcDialogue(npcSprite) {
    const npcId = npcSprite.getData('npcId') || 'bartender'
    const speaker = npcSprite.getData('speaker') || 'Someone'
    const greeting = npcSprite.getData('greeting') || '...'

    this.playSfx('door_open', { volume: 0.55 })

    const payload = {
      speaker,
      npc: npcId,
      ai: true,
      lines: [greeting],
      text: greeting,
    }

    // Bridge: scene action → React dialogue + TTS stream
    EventBus.emit(GameEvents.NPC_INTERACT, payload)
    EventBus.emit(GameEvents.START_DIALOGUE, payload)
    EventBus.emit(GameEvents.NPC_SPEAK, { npc: npcId, text: greeting, speaker })
  }

  /** Called from React (via EventBus or scene ref) to adjust health. */
  setPlayerHealth(health) {
    const prev = this.playerHealth
    this.playerHealth = Phaser.Math.Clamp(health, 0, this.maxHealth)
    EventBus.emit(GameEvents.PLAYER_HEALTH, this.playerHealth)
    if (this.playerHealth < prev) {
      this.playSfx('hit', { volume: 0.5, rate: 0.85 })
    }
  }

  setSfxVolume(vol01) {
    this._sfxVolume = Math.max(0, Math.min(1, Number(vol01) || 0))
  }
}
