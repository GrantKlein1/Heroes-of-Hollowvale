/**
 * Control catalog for the pause menu and the top-left hint.
 * Keys match HollowvaleScene._drive and the React key handler in Game.jsx.
 * F2 and backtick toggle collision debug; they stay off the always-visible hint.
 */

/** @typedef {{ keys: string[], action: string }} ControlRow */
/** @typedef {{ id: string, title: string, quiet?: boolean, rows: ControlRow[] }} ControlSection */

/** Always-visible hint. Collision debug is not listed here. */
export const HUD_HINTS = [
  { key: 'WASD', label: 'Move' },
  { key: 'Space', label: 'Attack' },
  { key: 'E', label: 'Interact' },
]

/** Opens and closes the controls menu during play. */
export const CONTROLS_KEY = 'H'

/** @type {ControlSection} */
const MOVE_SECTION = {
  id: 'move',
  title: 'Move',
  rows: [
    { keys: ['WASD', 'Arrows'], action: 'Move. Facing follows the last move.' },
    {
      keys: ['E'],
      action: 'Talk, doors, and exits. Thief holds E with lockpicks. Dwarf presses E with the pickaxe.',
    },
  ],
}

/** @type {ControlSection} */
const FIGHT_SECTION = {
  id: 'fight',
  title: 'Fight',
  rows: [
    { keys: ['Space'], action: 'Attack or cast with the equipped weapon.' },
    { keys: ['Shift'], action: 'Dodge roll.' },
  ],
}

/** @type {ControlSection} */
const PACK_SECTION = {
  id: 'pack',
  title: 'Pack',
  rows: [
    { keys: ['V'], action: 'Inventory.' },
    { keys: ['Esc'], action: 'Close inventory, chat, shop, and this menu.' },
    { keys: ['1–9', 'Mouse wheel'], action: 'Choose a hotbar slot.' },
    {
      keys: ['K'],
      action: 'Hold to use the selected consumable. With the mage spellbook, hold K for the spell wheel, then 1–4 (Lightning, Blink, Life Leech, Mana Shield).',
    },
    {
      keys: ['F'],
      action: 'Swap the selected slot with the offhand, only when that option is on.',
    },
  ],
}

/** @type {Record<string, ControlSection>} */
const CLASS_SECTIONS = {
  knight: {
    id: 'knight',
    title: 'Knight',
    rows: [
      { keys: ['C'], action: 'Hold to block. Shift still dodges.' },
    ],
  },
  mage: {
    id: 'mage',
    title: 'Mage',
    rows: [
      { keys: ['C'], action: 'Also dodge.' },
    ],
  },
  thief: {
    id: 'thief',
    title: 'Thief',
    rows: [
      { keys: ['C'], action: 'Also dodge.' },
      { keys: ['J'], action: 'Vanish.' },
    ],
  },
  dwarf: {
    id: 'dwarf',
    title: 'Dwarf',
    rows: [
      { keys: ['C'], action: 'Also dodge.' },
    ],
  },
}

/** @type {ControlSection} */
const DEBUG_SECTION = {
  id: 'debug',
  title: 'Debug',
  quiet: true,
  rows: [
    { keys: ['F2', '`'], action: 'Collision debug.' },
  ],
}

/**
 * Move, Fight, and Pack, then the current class, then a quiet Debug row.
 * An unknown class omits the class block.
 *
 * @param {string | null | undefined} classId
 * @returns {ControlSection[]}
 */
export function menuSections(classId) {
  const sections = [MOVE_SECTION, FIGHT_SECTION, PACK_SECTION]
  const classSection = classId ? CLASS_SECTIONS[classId] : null
  if (classSection) sections.push(classSection)
  sections.push(DEBUG_SECTION)
  return sections
}
