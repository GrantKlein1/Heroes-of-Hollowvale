// Centralized client paths and asset mappings
// Update these strings to match your filenames/structure; the rest of the app will follow.

export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// Static assets served from client/public
export const IMAGES_BASE = '/images'
export const AUDIO_BASE = '/audio'

// Common background/title images
export const PATHS = {
  villageBg: encodeURI(`${IMAGES_BASE}/start village screen.png`),
  tavernBg: `${IMAGES_BASE}/tavern.png`,
  marketBg: `${IMAGES_BASE}/market.png`,
  walkingPath: `${IMAGES_BASE}/walkingPath.png`,
  dungeonEntrance: encodeURI(`${IMAGES_BASE}/dungeon entrance.png`),
  dungeonInterior: `${IMAGES_BASE}/dungeon.png`,
  hiddenTreasureRoom: `${IMAGES_BASE}/hiddenTreasureRoom.png`,
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
  // SFX (optional; safe if missing)
  fireballCastSfx: `${AUDIO_BASE}/fireballCast.mp3`,
  fireImpactSfx: `${AUDIO_BASE}/fireImpact.mp3`,
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

// Item icon paths (by item id)
export const ITEM_ICONS = {
  iron_sword: `${IMAGES_BASE}/knightSword.png`,
  wooden_shield: `${IMAGES_BASE}/knightShield.png`,
  chainmail_armor: `${IMAGES_BASE}/knightArmor.png`,
  healing_potion: `${IMAGES_BASE}/healPotion.png`,
  speed_potion: `${IMAGES_BASE}/speedPotion.png`,
  apple: `${IMAGES_BASE}/apple.png`,

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

// Animated sprite frames (intro screen sword)
// Ordered sequence for smooth animation
export const ANIMATED_SWORD_FRAMES = [
  `${IMAGES_BASE}/animatedSword/animatedSword1.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword2.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword3.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword4.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword5.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword6.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword7.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword8.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword9.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword10.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword11.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword12.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword13.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword14.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword15.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword16.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword17.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword18.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword19.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword20.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword21.png`,
  `${IMAGES_BASE}/animatedSword/animatedSword22.png`,
]
