// Centralized client paths and asset mappings
// Update these strings to match your filenames/structure; the rest of the app will follow.

import { itemIcons } from '../game/items/registry.js'

export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// Static assets served from client/public
export const IMAGES_BASE = '/images'
export const AUDIO_BASE = '/audio'

// Common images. Painted scene backdrops moved to art-source/legacy-public in package 3-4.
export const PATHS = {
  animatedFireSmallGif: `${IMAGES_BASE}/animatedFireSmall/animatedFireSmall.gif`,
  animatedFireBallGif: `${IMAGES_BASE}/animatedFireBall/animatedFireBall.gif`,
  animatedThiefPotionGif: `${IMAGES_BASE}/animatedThiefPotion/animatedThiefPotion.gif`,
  poisonPotionGif: `${IMAGES_BASE}/poisonPotion.gif`,
  // Life Leech spell projectile (animated gif)
  lifeLeechSpellGif: `${IMAGES_BASE}/mageSpellBookSpells/lifeLeechSpell.gif`,
  titleBg: `${IMAGES_BASE}/red dragon boss fight room.png`,
  titleLogo: encodeURI(`${IMAGES_BASE}/title screen wider no background.png`),
  // Background music used on the intro screen and in the village
  // Place a file named "intro_village.mp3" under client/public/audio or update this path
  introVillageMusic: `${AUDIO_BASE}/introAndVillageMusic.mp3`,
  // New background tracks (place these files under client/public/audio)
  // Tavern ambience (plays quietly while inside the tavern, pauses during bartender chat)
  tavernBackgroundMusic: `${AUDIO_BASE}/backgroundMusic1.mp3`,
  // Fight/tense music for the cavern interior scene
  fightMusic1: `${AUDIO_BASE}/fightMusic1.mp3`,
  // SFX (optional; safe if missing) — preloaded by sfxEngine / MainGameScene
  fireballCastSfx: `${AUDIO_BASE}/fireballCast.mp3`,
  fireImpactSfx: `${AUDIO_BASE}/fireImpact.mp3`,
  sfxFootstep: `${AUDIO_BASE}/sfx/footstep.mp3`,
  sfxDoorOpen: `${AUDIO_BASE}/sfx/door_open.mp3`,
  sfxHit: `${AUDIO_BASE}/sfx/hit.mp3`,
  sfxSpellCast: `${AUDIO_BASE}/sfx/spell_cast.mp3`,
  sfxFireImpact: `${AUDIO_BASE}/sfx/fire_impact.mp3`,
  sfxMeleeSwing: `${AUDIO_BASE}/sfx/melee_swing.mp3`,
  goblinArrow: `${IMAGES_BASE}/goblinArrow.png`,
  thiefDisappearGif: `${IMAGES_BASE}/thiefDisappear.gif`,
  thiefSmokeGif: `${IMAGES_BASE}/animatedSmoke/animatedSmoke.gif`,
  // Mage spellbook spell icons
  lightningBoltIcon: `${IMAGES_BASE}/mageSpellBookSpellIcons/lightningBoltIcon.png`,
  manaShieldIcon: `${IMAGES_BASE}/mageSpellBookSpellIcons/manaShieldIcon.png`,
  blinkIcon: `${IMAGES_BASE}/mageSpellBookSpellIcons/blinkIcon.png`,
  lifeLeechIcon: `${IMAGES_BASE}/mageSpellBookSpellIcons/lifeLeechIcon.png`,
}

// Class base sprites
export const CLASS_SPRITES = {
  knight: `${IMAGES_BASE}/knight.png`,
  mage: encodeURI(`${IMAGES_BASE}/mage 2.png`),
  thief: `${IMAGES_BASE}/thief.png`,
  dwarf: `${IMAGES_BASE}/dwarf.png`,
}

// Class attack sprites (single-frame attack pose)
export const CLASS_ATTACK_SPRITES = {
  knight: `${IMAGES_BASE}/knightAttack.png`,
  mage: `${IMAGES_BASE}/mageAttack.png`,
  thief: `${IMAGES_BASE}/thiefAttack.png`,
  dwarf: `${IMAGES_BASE}/dwarfAttack.png`,
}

// Enemy sprites
export const ENEMY_SPRITES = {
  goblin: `${IMAGES_BASE}/goblin.png`,
  brute: encodeURI(`${IMAGES_BASE}/goblin brute.png`),
  archer: encodeURI(`${IMAGES_BASE}/goblin archer.png`),
}

// Item icon paths (by item id). Read from the item registry (game/items/registry.js).
export const ITEM_ICONS = itemIcons()

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

// Animated sprite frames (intro screen sword)
// Ordered sequence for smooth animation
export const ANIMATED_SWORD_FRAMES = Array.from({ length: 22 }, (_, i) =>
  `${IMAGES_BASE}/animatedSword/animatedSword${i + 1}.png?v=5`
)
