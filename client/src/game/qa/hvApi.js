/**
 * Hollowvale QA and Debug Automation API (window.__hv).
 *
 * Exposes runtime introspection and control for testing, automated gameplay assertions,
 * and developer tooling. Gated strictly to development builds or sessions with `?qa=1`.
 */

import { getSeed, setSeed } from '../rng.js'
import { respawnPlayer, handlePlayerDeath } from '../combat/death.js'
import { Dragon, DRAGON_PHASE_SHEETS } from '../actors/Dragon.js'

/**
 * Determines whether QA mode / window.__hv should be activated.
 *
 * Activated when:
 * 1. Running in a development build (`import.meta.env.DEV`), OR
 * 2. URL search params specify `qa=1` (e.g. `?qa=1`).
 *
 * @param {string} [search] - Optional URL search string
 * @param {boolean} [isDev] - Optional dev-mode flag override
 * @returns {boolean}
 */
export function isQaEnabled(search, isDev = Boolean(import.meta.env?.DEV)) {
  if (isDev) return true
  const query = search !== undefined ? search : (typeof window !== 'undefined' ? window.location?.search : '')
  if (typeof query === 'string' && query.length > 0) {
    const clean = query.startsWith('?') ? query.slice(1) : query
    const params = new URLSearchParams(clean)
    return params.get('qa') === '1'
  }
  return false
}

/**
 * Creates the window.__hv QA interface bound to the active Hollowvale scene.
 *
 * @param {import('../scenes/HollowvaleScene.js').default} scene
 * @returns {Record<string, Function>}
 */
export function createHvApi(scene) {
  return {
    // --- QA & Testing API (Package T-4) ---

    /**
     * Returns the current player animation key or state string.
     * Checks playing Phaser animation, then falls back to semantic state:
     * 'death', 'attack', 'consume', 'walk', 'idle'.
     */
    anim: () => {
      if (scene?.player?.anims?.currentAnim?.key) {
        return scene.player.anims.currentAnim.key
      }
      if (typeof scene?.player?.anims?.getName === 'function' && scene.player.anims.getName()) {
        return scene.player.anims.getName()
      }
      if (scene?.dead) return 'death'
      if (scene?._attacking) return 'attack'
      if (scene?._consuming) return 'consume'
      const b = scene?.player?.body
      if (b && (Math.abs(b.velocity?.x || 0) > 0.1 || Math.abs(b.velocity?.y || 0) > 0.1)) {
        return 'walk'
      }
      if (scene?._animState) return scene._animState
      return 'idle'
    },

    /**
     * Returns the player's facing direction: 'down', 'left', 'right', or 'up'.
     */
    facing: () => {
      if (scene?._facing) return scene._facing
      const fx = scene?.facingX ?? 1
      const fy = scene?.facingY ?? 0
      if (Math.abs(fx) >= Math.abs(fy)) {
        return fx >= 0 ? 'right' : 'left'
      }
      return fy >= 0 ? 'down' : 'up'
    },

    /**
     * Returns list of loaded texture keys from Phaser texture manager.
     */
    textures: () => {
      if (typeof scene?.textures?.getTextureKeys === 'function') {
        return scene.textures.getTextureKeys()
      }
      if (scene?.textures?.list) {
        return Object.keys(scene.textures.list)
      }
      return []
    },

    /**
     * Returns array of missing/failed asset keys tracked during loading.
     */
    missingAssets: () => {
      if (Array.isArray(scene?._missingAssets)) {
        return [...scene._missingAssets]
      }
      return []
    },

    /**
     * Returns current actual game loop FPS number (scene.game.loop.actualFps).
     */
    fps: () => {
      const actual = scene?.game?.loop?.actualFps
      if (typeof actual === 'number' && Number.isFinite(actual)) {
        return actual
      }
      return 0
    },

    /**
     * Returns active PRNG seed or sets/re-seeds the generator.
     */
    seed: (n) => {
      if (n !== undefined) {
        setSeed(n)
        return n
      }
      return getSeed()
    },

    /**
     * Returns count of active physics bodies in the scene.
     */
    bodies: () => {
      const world = scene?.physics?.world
      if (!world?.bodies) return 0
      if (Array.isArray(world.bodies.entries)) {
        return world.bodies.entries.filter((b) => b && b.enable !== false).length
      }
      if (typeof world.bodies.size === 'number') {
        return world.bodies.size
      }
      if (Array.isArray(world.bodies)) {
        return world.bodies.filter((b) => b && b.enable !== false).length
      }
      return 0
    },

    /**
     * Triggers player dodge roll if available.
     */
    dodge: (now) => {
      if (typeof scene?.player?.dodge === 'function') {
        return scene.player.dodge(now)
      }
      return false
    },

    /**
     * Begins shield blocking for Knight.
     */
    block: (now) => {
      if (typeof scene?.player?.startBlock === 'function') {
        if (!scene.player.blockState) {
          scene.player.blockState = { qaHolding: true }
        } else {
          scene.player.blockState.qaHolding = true
        }
        return scene.player.startBlock(now)
      }
      return false
    },

    /**
     * Releases shield block.
     */
    unblock: () => {
      if (typeof scene?.player?.stopBlock === 'function') {
        if (scene.player.blockState) {
          scene.player.blockState.qaHolding = false
        }
        scene.player.stopBlock()
        return true
      }
      return false
    },

    /**
     * Returns the player state machine state (e.g. 'IDLE', 'ATTACK', 'DODGE', 'BLOCK', 'HURT', 'DEAD').
     */
    playerState: () => {
      return scene?.player?.state || null
    },

    /**
     * Respawns player at area entrance with full HP & mana.
     */
    respawn: () => {
      return respawnPlayer(scene)
    },

    /**
     * Triggers player death sequence.
     */
    killPlayer: (killer = 'goblin', options = {}) => {
      return handlePlayerDeath(scene, killer, options)
    },

    /**
     * Spawns Red Dragon boss actor for testing.
     *
     * @param {object} [options]
     * @param {number} [options.x=300]
     * @param {number} [options.y=250]
     * @param {number} [options.phase=1]
     * @returns {Dragon|null}
     */
    spawnDragon: (options = {}) => {
      const x = options.x ?? 300
      const y = options.y ?? 250
      const phase = Number(options.phase) || 1

      if (scene?.assetRegistry && typeof scene.assetRegistry.loadDragonPhase === 'function') {
        scene.assetRegistry.loadDragonPhase(phase)
      }

      const initialSheet = DRAGON_PHASE_SHEETS[phase] || 'red_dragon_p1_a'
      const dragon = new Dragon(scene, x, y, initialSheet, '', { phase, ...options })

      if (scene?.enemies && typeof scene.enemies.add === 'function') {
        scene.enemies.add(dragon)
      }

      scene._dragon = dragon
      return dragon
    },

    /**
     * Sets dragon HP to a specific percentage of max HP.
     *
     * @param {number} pct - Percentage (0.0 to 1.0)
     * @returns {number|null}
     */
    setDragonHp: (pct) => {
      const dragon = scene?._dragon
      if (!dragon) return null
      const targetHp = Math.round((dragon.hpMax || 1200) * pct)
      return dragon.setHp(targetHp, true)
    },

    /**
     * Returns the current dragon encounter state.
     *
     * @returns {{ phase: number, invulnerable: boolean, airborne: boolean, landed: boolean, hp: number, hpMax: number, state: string|null }|null}
     */
    dragonState: () => {
      const dragon = scene?._dragon
      if (!dragon) return null
      return {
        phase: dragon.phase,
        invulnerable: Boolean(dragon.invulnerable),
        airborne: Boolean(dragon.airborne),
        landed: Boolean(dragon.isLanding || !dragon.airborne),
        hp: dragon.hp,
        hpMax: dragon.hpMax,
        state: dragon.ai?.state || null,
      }
    },

    /**
     * Resets dragon boss encounter to Phase 1 full HP.
     *
     * @returns {boolean}
     */
    resetDragon: () => {
      const dragon = scene?._dragon
      if (!dragon) return false
      dragon.resetEncounter()
      return true
    },

    /**
     * Spawns an ambient critter.
     */
    spawnCritter: (type = 'squirrel_red', x, y) => {
      return scene?.spawnCritter?.(type, x, y) || null
    },

    /**
     * Returns list of active ambient critters.
     */
    critters: () => {
      return (scene?.critters || []).map((c) => ({
        type: c.critterType,
        state: c.state,
        facing: c.facing,
        x: c.x,
        y: c.y,
        lastAnim: c.lastAnimKey,
      }))
    },

    /**
     * Debug entity spawner helper.
     */
    spawn: (type = 'goblin', x, y) => {
      if (typeof scene?.spawn === 'function') {
        return scene.spawn(type, x, y)
      }
      if (typeof scene?._spawnEnemy === 'function') {
        let nx = 0.5
        let ny = 0.5
        if (x !== undefined && y !== undefined) {
          nx = x > 1 ? x / (scene.worldW || 1) : x
          ny = y > 1 ? y / (scene.worldH || 1) : y
        } else if (scene?.player) {
          nx = scene.player.x / (scene.worldW || 1)
          ny = scene.player.y / (scene.worldH || 1)
        }
        return scene._spawnEnemy(type, nx, ny, scene.wave || 1)
      }
      return null
    },

    /**
     * Returns debug combat state info.
     */
    combat: () => {
      const enemies = scene?.enemies
      const enemyList = enemies && typeof enemies.getChildren === 'function'
        ? enemies.getChildren().filter((e) => e && e.active && e.hp > 0).map((e) => ({
            type: e.enemyType || 'unknown',
            x: e.x,
            y: e.y,
            hp: e.hp,
            hpMax: e.hpMax,
          }))
        : []
      return {
        hp: scene?.hp ?? 0,
        hpMax: scene?.hpMax ?? 0,
        mana: scene?.mana ?? 0,
        manaMax: scene?.manaMax ?? 0,
        dead: Boolean(scene?.dead),
        attacking: Boolean(scene?._attacking),
        attackUntil: scene?._attackUntil || 0,
        consuming: Boolean(scene?._consuming),
        wave: scene?.wave || 1,
        enemiesSpawned: Boolean(scene?.enemiesSpawned),
        enemyCount: enemies && typeof enemies.countActive === 'function' ? enemies.countActive() : enemyList.length,
        enemies: enemyList,
        projectilesCount: Array.isArray(scene?.projectiles) ? scene.projectiles.length : 0,
        firesCount: Array.isArray(scene?.fires) ? scene.fires.length : 0,
      }
    },

    /**
     * Adjusts physics and scene clock time scale.
     */
    timeScale: (n) => {
      if (typeof n === 'number' && Number.isFinite(n)) {
        if (scene?.time) {
          scene.time.timeScale = n
        }
        if (scene?.physics?.world) {
          scene.physics.world.timeScale = n
        }
      }
      return scene?.time?.timeScale ?? scene?.physics?.world?.timeScale ?? 1
    },

    // --- Legacy __hv inspection & navigation methods ---
    scene: () => scene?.sceneId,
    player: () => (typeof scene?._playerSnapshot === 'function' ? scene._playerSnapshot() : null),
    world: () => ({ w: scene?.worldW, h: scene?.worldH }),
    zoom: () => scene?.cameras?.main?.zoom,
    view: () => {
      const v = scene?.cameras?.main?.worldView
      return v ? { x: v.x, y: v.y, width: v.width, height: v.height } : null
    },
    canvas: () => ({ w: scene?.scale?.width, h: scene?.scale?.height }),
    debug: (on) => {
      if (scene) {
        scene.debugOn = Boolean(on)
        scene._redrawStaticDebug?.()
      }
    },
    solids: () => (scene?._solidRects || []).map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    prompts: () => (scene?.prompts || []).map((p) => ({
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      action: p.action,
      label: p.label,
      to: p.to || null,
    })),
    goto: (id, nx, ny) => scene?.enterScene?.(id, { nx, ny }),
  }
}

/**
 * Mounts the QA API to window.__hv if QA is enabled.
 * If QA is disabled, ensures window.__hv is cleaned up / remains undefined.
 *
 * @param {import('../scenes/HollowvaleScene.js').default} scene
 * @param {object} [options]
 * @param {string} [options.search]
 * @param {boolean} [options.isDev]
 * @returns {Record<string, Function>|undefined}
 */
export function mountHvApi(scene, options = {}) {
  const isDev = options.isDev !== undefined ? options.isDev : Boolean(import.meta.env?.DEV)
  const search = options.search !== undefined
    ? options.search
    : (typeof window !== 'undefined' ? window.location?.search : '')

  if (typeof window === 'undefined') return undefined

  if (isQaEnabled(search, isDev)) {
    const api = createHvApi(scene)
    window.__hv = api
    return api
  }

  if (window.__hv) {
    delete window.__hv
  }
  return undefined
}

/**
 * Removes window.__hv if present on teardown.
 */
export function teardownHvApi() {
  if (typeof window !== 'undefined' && window.__hv) {
    delete window.__hv
  }
}
