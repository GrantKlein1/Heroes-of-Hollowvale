/**
 * AssetRegistry — Manifest group loader, animation creator, and anchor resolver.
 *
 * Coordinates texture atlas loading, animation building from atlas metadata,
 * dynamic origin setting per sheet anchor, and memory eviction / unloading.
 */

import defaultManifest from '../../../public/assets/manifest.json'
import { buildAnimKey, buildFrameConfigs } from './animKeys.js'

export { defaultManifest }

/**
 * Groups that must travel with another group so world drops and the phase-3
 * meteor telegraph are resident. Scene code keeps calling the parent group;
 * AssetRegistry pulls the dependency.
 *
 * Combat areas (village, wilderness, cavern) can drop loot.
 * Phase 3 is the only phase that telegraphs meteors.
 */
export const GROUP_DEPENDENCIES = Object.freeze({
  village: Object.freeze(['loot']),
  wilderness: Object.freeze(['loot']),
  cavern: Object.freeze(['loot']),
  boss_p3: Object.freeze(['boss_fx_extra']),
})

/**
 * Groups whose clips are built when the atlas finishes loading.
 * Dragon phase sheets are not in this set: their meta lists frames that live
 * on a sibling page, and creating those clips makes play() throw.
 */
const ANIM_ON_COMPLETE_GROUPS = new Set(['loot', 'boss_fx_extra'])

export class AssetRegistry {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {object} [manifest] - Optional manifest object (defaults to client/public/assets/manifest.json)
   */
  constructor(scene, manifest = defaultManifest) {
    if (!scene) {
      throw new Error('AssetRegistry requires a valid Phaser Scene instance')
    }
    this.scene = scene
    this.manifest = manifest || { groups: {}, assets: {} }
    this.loadedGroups = new Set()
    this.loadedSheets = new Map() // sheetKey -> sheetDef
    this.createdAnims = new Map() // groupOrAssetKey -> Set<animKey>
    this.sheetToGroups = new Map() // sheetKey -> Set<groupName>
    this.explicitGroups = new Set()
    this.dependencyOwners = new Map() // dep group -> Set<parent group>
    this._sheetWatchers = new Set()
  }

  /**
   * Resolves the sheets belonging to an asset definition in the manifest.
   *
   * @param {string} assetId - Asset identifier in manifest.assets
   * @returns {Array<{ key: string, image: string, json: string, anchor: { x: number, y: number }, assetId: string, kind: string }>}
   */
  getSheetsForAsset(assetId) {
    const assetDef = this.manifest.assets?.[assetId]
    if (!assetDef) return []

    const kind = assetDef.kind || 'unknown'
    const fallbackAnchor = assetDef.anchor || { x: 0.5, y: 0.5 }
    const sheets = []

    if (assetDef.sheets && typeof assetDef.sheets === 'object') {
      for (const [sheetKey, sheetObj] of Object.entries(assetDef.sheets)) {
        sheets.push({
          key: sheetObj.key || sheetKey,
          image: sheetObj.image,
          json: sheetObj.json,
          anchor: sheetObj.anchor || fallbackAnchor,
          assetId,
          kind,
          ...(sheetObj.animAliases ? { animAliases: sheetObj.animAliases } : {}),
        })
      }
    } else if (assetDef.image && assetDef.json) {
      sheets.push({
        key: assetDef.id || assetId,
        image: assetDef.image,
        json: assetDef.json,
        anchor: fallbackAnchor,
        assetId,
        kind,
      })
    }

    return sheets
  }

  /**
   * Loads all asset sheets for a specified manifest group into Phaser.
   * Typically called inside a Scene's `preload()`.
   *
   * @param {string} groupName - Group key (e.g. 'boot', 'village', 'wilderness', 'boss_p1')
   * @returns {Array<string>} - Array of loaded sheet keys
   */
  loadGroup(groupName, options = {}) {
    const groupAssets = this.manifest.groups?.[groupName]
    if (!Array.isArray(groupAssets)) {
      console.warn(`[AssetRegistry] Group "${groupName}" not found in manifest`)
      return []
    }

    const asDependency = options?.asDependency === true
    if (!asDependency) {
      this.explicitGroups.add(groupName)
    }

    const queuedKeys = []

    for (const assetId of groupAssets) {
      const sheets = this.getSheetsForAsset(assetId)
      for (const sheet of sheets) {
        // Guard: legacy v1 dragon_fx is strictly forbidden; only dragon_fx_v2 is permitted
        if (
          sheet.key === 'dragon_fx' ||
          sheet.image?.endsWith('dragon_fx.png') ||
          sheet.json?.endsWith('dragon_fx.json')
        ) {
          throw new Error('[AssetRegistry] Legacy v1 dragon_fx is deprecated. Only dragon_fx_v2 is permitted.')
        }

        // Record sheet definition
        this.loadedSheets.set(sheet.key, sheet)

        // Track group reference for safe unloading
        if (!this.sheetToGroups.has(sheet.key)) {
          this.sheetToGroups.set(sheet.key, new Set())
        }
        this.sheetToGroups.get(sheet.key).add(groupName)

        // Queue texture atlas if not already in Phaser's texture cache
        const exists = typeof this.scene?.textures?.exists === 'function' && this.scene.textures.exists(sheet.key)
        if (!exists && this.scene?.load?.atlas) {
          this.scene.load.atlas(sheet.key, sheet.image, sheet.json)
          if (ANIM_ON_COMPLETE_GROUPS.has(groupName)) {
            this._watchSheetForAnims(groupName, sheet.key)
          }
        }
        queuedKeys.push(sheet.key)
      }
    }

    this.loadedGroups.add(groupName)

    const deps = GROUP_DEPENDENCIES[groupName] || []
    for (const dep of deps) {
      if (!this.dependencyOwners.has(dep)) {
        this.dependencyOwners.set(dep, new Set())
      }
      this.dependencyOwners.get(dep).add(groupName)
      if (!this.loadedGroups.has(dep)) {
        queuedKeys.push(...this.loadGroup(dep, { asDependency: true }))
      }
    }

    // If loader is idle after scene preload, start it dynamically
    if (
      typeof this.scene?.load?.isLoading === 'function' &&
      !this.scene.load.isLoading() &&
      this.scene?.load?.list?.size > 0 &&
      typeof this.scene?.load?.start === 'function'
    ) {
      this.scene.load.start()
    }

    return queuedKeys
  }

  /**
   * Creates Phaser animations for all sheets in a group or specific asset.
   * Reads animation definitions, fps, loop, and per-frame durations from atlas meta.
   *
   * @param {string} groupOrAssetId - Group name or asset ID
   * @returns {Array<string>} - Array of created animation keys
   */
  createAnims(groupOrAssetId) {
    let assetIds = []
    if (Array.isArray(this.manifest.groups?.[groupOrAssetId])) {
      assetIds = this.manifest.groups[groupOrAssetId]
    } else if (this.manifest.assets?.[groupOrAssetId]) {
      assetIds = [groupOrAssetId]
    } else {
      // Fallback: check if it's a direct sheet key
      const sheet = this.loadedSheets.get(groupOrAssetId)
      if (sheet) assetIds = [sheet.assetId]
    }

    const createdKeys = []

    for (const assetId of assetIds) {
      const sheets = this.getSheetsForAsset(assetId)
      for (const sheet of sheets) {
        const texture = typeof this.scene?.textures?.get === 'function' ? this.scene.textures.get(sheet.key) : null
        if (!texture) continue

        // Access embedded atlas metadata from Phaser texture customData
        const meta = texture.customData?.meta
        if (!meta) continue

        // Check meta.animations (dragon sheets format) or meta.anims (character/enemy standard)
        const animsDict = (meta.animations && typeof meta.animations === 'object')
          ? meta.animations
          : (meta.anims && typeof meta.anims === 'object' ? meta.anims : null)

        if (!animsDict) continue

        for (const [metaAnimName, animDef] of Object.entries(animsDict)) {
          if (!animDef || typeof animDef !== 'object') continue
          // A sheet can republish a clip under another name (manifest `animAliases`),
          // so two sheets that both ship `hold_idle` do not collide on one anim key.
          const animName = sheet.animAliases?.[metaAnimName] || metaAnimName

          const fps = typeof animDef.fps === 'number' && animDef.fps > 0
            ? animDef.fps
            : (typeof animDef.frameRate === 'number' && animDef.frameRate > 0 ? animDef.frameRate : 10)

          const repeat = typeof animDef.repeat === 'number'
            ? animDef.repeat
            : (animDef.loop === true ? -1 : 0)

          // Case A: animDef.frames is an explicit array of frame names (e.g. dragon sheets)
          if (Array.isArray(animDef.frames) && animDef.frames.length > 0) {
            let animKey
            if (sheet.key.startsWith('red_dragon') || assetId.startsWith('red_dragon')) {
              animKey = animName.startsWith('red_dragon_') ? animName : `red_dragon_${animName}`
            } else {
              animKey = animName.startsWith(`${assetId}_`) ? animName : `${assetId}_${animName}`
            }

            if (typeof this.scene?.anims?.exists === 'function' && this.scene.anims.exists(animKey)) {
              continue
            }

            const frameConfigs = animDef.frames
              .filter((frameName) => this._textureHasFrame(texture, frameName))
              .map((frameName) => ({
                key: sheet.key,
                frame: frameName,
              }))

            if (frameConfigs.length > 0 && typeof this.scene?.anims?.create === 'function') {
              this.scene.anims.create({
                key: animKey,
                frames: frameConfigs,
                frameRate: fps,
                repeat,
              })
              createdKeys.push(animKey)

              if (!this.createdAnims.has(groupOrAssetId)) {
                this.createdAnims.set(groupOrAssetId, new Set())
              }
              this.createdAnims.get(groupOrAssetId).add(animKey)
            }
            continue
          }

          // Case B: standard template frameNames with directions (e.g. knight, goblin)
          const directions = Array.isArray(animDef.directions) && animDef.directions.length > 0
            ? animDef.directions
            : ['']

          for (const dir of directions) {
            const animKey = buildAnimKey(assetId, animName, dir)

            // Prevent duplicate creation
            if (typeof this.scene?.anims?.exists === 'function' && this.scene.anims.exists(animKey)) {
              continue
            }

            const frameConfigs = buildFrameConfigs({
              atlasKey: sheet.key,
              frameNames: animDef.frameNames,
              frameCount: animDef.frames,
              dir,
              frameDurationsMs: animDef.frameDurationsMs,
            }).filter((frame) => this._textureHasFrame(texture, frame?.frame))

            if (frameConfigs.length > 0 && typeof this.scene?.anims?.create === 'function') {
              this.scene.anims.create({
                key: animKey,
                frames: frameConfigs,
                frameRate: fps,
                repeat,
              })
              createdKeys.push(animKey)

              // Record under group or asset key
              if (!this.createdAnims.has(groupOrAssetId)) {
                this.createdAnims.set(groupOrAssetId, new Set())
              }
              this.createdAnims.get(groupOrAssetId).add(animKey)
            }
          }
        }
      }
    }

    const deps = GROUP_DEPENDENCIES[groupOrAssetId] || []
    for (const dep of deps) {
      createdKeys.push(...this.createAnims(dep))
    }

    return createdKeys
  }

  /**
   * When a queued atlas finishes, build its animations. Listens for the
   * atlas multifile (`atlasjson`) so the texture meta is already parsed.
   * Scene preload still calls createAnims in create(); this covers groups
   * loaded mid-encounter (phase 3 meteor marker).
   *
   * @param {string} groupName
   * @param {string} sheetKey
   */
  _watchSheetForAnims(groupName, sheetKey) {
    const loader = this.scene?.load
    if (typeof loader?.on !== 'function') return
    const token = `${groupName}:${sheetKey}`
    if (this._sheetWatchers.has(token)) return
    this._sheetWatchers.add(token)

    const handler = (key, type) => {
      if (key !== sheetKey) return
      if (type && type !== 'atlasjson') return
      try {
        this.createAnims(groupName)
      } catch (err) {
        console.warn(`[AssetRegistry] createAnims failed for "${groupName}"`, err)
      }
      if (typeof loader.off === 'function') {
        loader.off('filecomplete', handler)
      }
      this._sheetWatchers.delete(token)
    }
    loader.on('filecomplete', handler)
  }

  /**
   * True when the frame can be played. Textures without a `has` check
   * (unit-test doubles) keep every authored frame.
   *
   * @param {object} texture
   * @param {string} frameName
   * @returns {boolean}
   */
  _textureHasFrame(texture, frameName) {
    if (!frameName) return false
    if (typeof texture?.has !== 'function') return true
    return texture.has(frameName)
  }

  /**
   * Dynamically resolves the origin anchor `{ x, y }` for a sheet.
   * Priority:
   * 1. Manifest sheet anchor
   * 2. Texture meta.origin / meta.anchor
   * 3. Frame pivot
   * 4. Center fallback (0.5, 0.5)
   *
   * @param {string} sheetKey - Atlas sheet key (e.g. 'knight', 'dwarf_attack')
   * @returns {{ x: number, y: number }}
   */
  getAnchor(sheetKey) {
    // 1. Check loaded sheet definition
    const sheet = this.loadedSheets.get(sheetKey)
    if (sheet?.anchor && typeof sheet.anchor.x === 'number' && typeof sheet.anchor.y === 'number') {
      return { x: sheet.anchor.x, y: sheet.anchor.y }
    }

    // 2. Check direct asset definition in manifest
    const assetDef = this.manifest.assets?.[sheetKey]
    if (assetDef?.anchor && typeof assetDef.anchor.x === 'number' && typeof assetDef.anchor.y === 'number') {
      return { x: assetDef.anchor.x, y: assetDef.anchor.y }
    }

    // 3. Check loaded Phaser texture customData / meta
    if (typeof this.scene?.textures?.get === 'function') {
      const texture = this.scene.textures.get(sheetKey)
      const meta = texture?.customData?.meta
      if (meta?.origin && typeof meta.origin.x === 'number' && typeof meta.origin.y === 'number') {
        return { x: Number(meta.origin.x), y: Number(meta.origin.y) }
      }
      if (meta?.anchor && typeof meta.anchor.x === 'number' && typeof meta.anchor.y === 'number') {
        return { x: Number(meta.anchor.x), y: Number(meta.anchor.y) }
      }

      // Check first frame pivot
      if (typeof texture?.getFrameNames === 'function') {
        const names = texture.getFrameNames()
        if (names.length > 0) {
          const frame = texture.get(names[0])
          const pivot = frame?.customData?.pivot
          if (pivot && typeof pivot.x === 'number' && typeof pivot.y === 'number') {
            return { x: Number(pivot.x), y: Number(pivot.y) }
          }
        }
      }
    }

    // Default center origin
    return { x: 0.5, y: 0.5 }
  }

  /**
   * Sets the origin of a sprite or game object using the resolved sheet anchor.
   *
   * @param {import('phaser').GameObjects.Sprite} sprite - Target Phaser sprite
   * @param {string} sheetKey - Sheet key
   * @returns {{ x: number, y: number }} - Applied anchor
   */
  setOriginFromAnchor(sprite, sheetKey) {
    const anchor = this.getAnchor(sheetKey)
    if (sprite && typeof sprite.setOrigin === 'function') {
      sprite.setOrigin(anchor.x, anchor.y)
    }
    return anchor
  }

  /**
   * Unloads all assets and removes animations for a group.
   * Sheets shared with other still-active groups are preserved via reference counting.
   *
   * @param {string} groupName - Group key to unload
   * @returns {boolean} - True if group was unloaded
   */
  unloadGroup(groupName) {
    if (!this.loadedGroups.has(groupName)) {
      return false
    }

    // 1. Remove animations registered for this group
    const animKeys = this.createdAnims.get(groupName)
    if (animKeys && typeof this.scene?.anims?.remove === 'function') {
      for (const animKey of animKeys) {
        this.scene.anims.remove(animKey)
      }
      this.createdAnims.delete(groupName)
    }

    // 2. Decrement sheet reference counts and evict unreferenced textures
    const groupAssets = this.manifest.groups?.[groupName] || []
    for (const assetId of groupAssets) {
      const sheets = this.getSheetsForAsset(assetId)
      for (const sheet of sheets) {
        const groups = this.sheetToGroups.get(sheet.key)
        if (groups) {
          groups.delete(groupName)
          if (groups.size === 0) {
            // Evict texture from Phaser texture cache to free memory
            if (typeof this.scene?.textures?.remove === 'function') {
              this.scene.textures.remove(sheet.key)
            }
            this.sheetToGroups.delete(sheet.key)
            this.loadedSheets.delete(sheet.key)
          }
        }
      }
    }

    this.loadedGroups.delete(groupName)

    for (const [dep, owners] of this.dependencyOwners) {
      if (!owners.has(groupName)) continue
      owners.delete(groupName)
      if (owners.size === 0 && !this.explicitGroups.has(dep)) {
        this.unloadGroup(dep)
      }
    }

    return true
  }

  /**
   * Checks whether a group is currently marked as loaded.
   *
   * @param {string} groupName
   * @returns {boolean}
   */
  isGroupLoaded(groupName) {
    return this.loadedGroups.has(groupName)
  }

  /**
   * Helper to resolve the manifest group name for a given dragon boss phase.
   *
   * @param {number|string} phase - Phase number (1, 2, 3)
   * @returns {string} - Group name ('boss_p1', 'boss_p2', 'boss_p3')
   */
  getDragonPhaseGroup(phase) {
    const p = String(phase).replace(/^p/, '')
    return `boss_p${p}`
  }

  /**
   * Loads the dragon phase manifest group and creates its animations.
   *
   * @param {number|string} phase - 1, 2, or 3
   * @returns {Array<string>} - Array of loaded sheet keys
   */
  loadDragonPhase(phase) {
    const groupName = this.getDragonPhaseGroup(phase)
    const sheets = this.loadGroup(groupName)
    this.createAnims(groupName)
    return sheets
  }

  /**
   * Unloads a dragon phase group, evicting its textures and animations.
   *
   * @param {number|string} phase - 1, 2, or 3
   * @returns {boolean}
   */
  unloadDragonPhase(phase) {
    const groupName = this.getDragonPhaseGroup(phase)
    return this.unloadGroup(groupName)
  }

  /**
   * Transitions from one dragon phase to another: unloads the previous phase
   * and loads the next phase, recording the transition time in milliseconds.
   *
   * @param {number|string} nextPhase - Target phase (1, 2, 3)
   * @param {number|string} [prevPhase] - Optional previous phase to evict
   * @returns {{ loadedSheets: Array<string>, transitionDurationMs: number }}
   */
  transitionDragonPhase(nextPhase, prevPhase = null) {
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()

    if (prevPhase !== null && prevPhase !== undefined) {
      this.unloadDragonPhase(prevPhase)
    }

    const loadedSheets = this.loadDragonPhase(nextPhase)

    const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const transitionDurationMs = endTime - startTime

    return {
      loadedSheets,
      transitionDurationMs,
    }
  }

  /**
   * Returns list of currently loaded dragon texture page keys in textures cache.
   *
   * @returns {Array<string>}
   */
  getActiveDragonPages() {
    const dragonSheets = []
    for (const [key] of this.loadedSheets) {
      if (key.startsWith('red_dragon_p')) {
        dragonSheets.push(key)
      }
    }
    return dragonSheets
  }
}
