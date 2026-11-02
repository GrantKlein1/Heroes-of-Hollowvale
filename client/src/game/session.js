/**
 * Mutable bridge between the React overlays and the Phaser scene.
 * The scene reads this every frame; React writes it when UI state changes.
 * Hot-path fields are plain properties so the game loop does not allocate.
 */

export const session = {
  /** True while a React overlay should freeze gameplay. */
  blocked: true,
  classId: null,
  baseSpeed: 160,
  spriteUrl: '',
  equippedId: null,
  hotbarSlot: 0,
  spellId: 'lightning',
  hp: 100,
  hpMax: 100,
  mana: 0,
  manaMax: 0,
  speedBoostUntil: 0,
  thiefVanishUntil: 0,
  thiefSmokeUntil: 0,
  thiefVanishCooldownUntil: 0,
  lifeLeechCooldownUntil: 0,
  /** Installed by HollowvaleScene once create() finishes. */
  api: null,
  hooks: {
    /** @type {null | ((index: number, locked: boolean) => boolean)} */
    openChest: null,
  },
}
