/**
 * AssetRegistry — Manifest group loader, animation creator, and anchor resolver.
 *
 * Coordinates texture atlas loading, animation building from atlas metadata,
 * dynamic origin setting per sheet anchor, and memory eviction / unloading.
 */

import defaultManifest from '../../../public/assets/manifest.json'
import { buildAnimKey, buildFrameConfigs } from './animKeys.js'

export { defaultManifest }

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
  loadGroup(groupName) {
    const groupAssets = this.manifest.groups?.[groupName]
    if (!Array.isArray(groupAssets)) {
      console.warn(`[AssetRegistry] Group "${groupName}" not found in manifest`)
      return []
    }

    const queuedKeys = []

    for (const assetId of groupAssets) {
      const sheets = this.getSheetsForAsset(assetId)
      for (const sheet of sheets) {
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
        }
        queuedKeys.push(sheet.key)
      }
    }

    this.loadedGroups.add(groupName)

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
        if (!meta || !meta.anims || typeof meta.anims !== 'object') continue

        for (const [animName, animDef] of Object.entries(meta.anims)) {
          if (!animDef || typeof animDef !== 'object') continue

          const directions = Array.isArray(animDef.directions) && animDef.directions.length > 0
            ? animDef.directions
            : ['']

          const fps = typeof animDef.fps === 'number' && animDef.fps > 0 ? animDef.fps : 10
          const repeat = typeof animDef.repeat === 'number'
            ? animDef.repeat
            : (animDef.loop === true ? -1 : 0)

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
            })

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

    return createdKeys
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
}
