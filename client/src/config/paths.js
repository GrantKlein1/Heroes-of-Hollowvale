// Centralized client paths and asset mappings
// Update these strings to match your filenames/structure; the rest of the app will follow.

export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// Static assets served from client/public
export const IMAGES_BASE = '/images'

// Common background/title images
export const PATHS = {
  villageBg: encodeURI(`${IMAGES_BASE}/start village screen.png`),
  tavernBg: `${IMAGES_BASE}/tavern.png`,
  titleBg: `${IMAGES_BASE}/red dragon boss fight room.png`,
  titleLogo: encodeURI(`${IMAGES_BASE}/title screen wider no background.png`),
}

// Class base sprites
export const CLASS_SPRITES = {
  knight: `${IMAGES_BASE}/knight.png`,
  mage: encodeURI(`${IMAGES_BASE}/mage 2.png`),
  thief: `${IMAGES_BASE}/thief.png`,
  dwarf: `${IMAGES_BASE}/dwarf.png`,
}

// Item icon paths (by item id)
export const ITEM_ICONS = {
  iron_sword: `${IMAGES_BASE}/knightSword.png`,
  wooden_shield: `${IMAGES_BASE}/knightShield.png`,
  chainmail_armor: `${IMAGES_BASE}/knightArmor.png`,
  healing_potion: `${IMAGES_BASE}/healPotion.png`,

  apprentice_staff: `${IMAGES_BASE}/mageStaff.png`,
  spellbook: `${IMAGES_BASE}/mageSpellBook.png`,
  cloth_robes: `${IMAGES_BASE}/mageRobes.png`,
  mana_potion: `${IMAGES_BASE}/manaPotion.png`,

  twin_daggers: `${IMAGES_BASE}/thiefDaggers.png`,
  leather_armor: `${IMAGES_BASE}/thiefCloak.png`,
  lockpicks: `${IMAGES_BASE}/thiefLockpick.png`,
  poison_vial: `${IMAGES_BASE}/thiefPoison.png`,

  battle_axe: `${IMAGES_BASE}/dwarfAxe.png`,
  dwarf_armor: `${IMAGES_BASE}/dwarfArmor.png`,
  dwarf_pickaxe: `${IMAGES_BASE}/dwarfPickaxe.png`,
  ale_flask: `${IMAGES_BASE}/dwarfAle.png`,
}

// Default path for unknown item icons
export const DEFAULT_ITEM_ICON = (id) => `${IMAGES_BASE}/${id}.png`

// Explicit composite sprites per class and item tag
// Edit these filenames directly to match your assets.
export const COMPOSITE_SPRITES = {
  knight: {
    Sword: `${IMAGES_BASE}/knight.png`,
    Shield: `${IMAGES_BASE}/knightWithShield.png`,
    HealPotion: `${IMAGES_BASE}/knightWithHealPotion.png`,
    ShieldAndSword: `${IMAGES_BASE}/knightWithShieldAndSword.png`,
    EmptyHands: `${IMAGES_BASE}/knightEmptyHands.png`
  },
  mage: {
    Staff: `${IMAGES_BASE}/mage 2.png`,
    Spellbook: `${IMAGES_BASE}/mageWithBook.png`,
    ManaPotion: `${IMAGES_BASE}/mageWithManaPotion.png`,
    EmptyHands: `${IMAGES_BASE}/mageEmptyHands.png`
  },
  thief: {
    Daggers: `${IMAGES_BASE}/thief.png`,
    Lockpick: `${IMAGES_BASE}/thiefWithLockpicks.png`,
    PoisonVial: `${IMAGES_BASE}/thiefWithPoison.png`,
    EmptyHands: `${IMAGES_BASE}/thiefEmptyHands.png`
  },
  dwarf: {
    Axe: `${IMAGES_BASE}/dwarf.png`,
    Pickaxe: `${IMAGES_BASE}/dwarfWithPickaxe.png`,
    Ale: `${IMAGES_BASE}/dwarfWithAle.png`,
    EmptyHands: `${IMAGES_BASE}/dwarfEmptyHands.png`
  },
}
