/**
 * Lore-driven points of interest, loot, and encounter tables.
 * Scene code reads this; it does not hardcode placements.
 *
 * Wording of the notice, the inscription, and the exact contents of the
 * satchel, the ford cache, and the stone offerings are guesses. Distances
 * and directions are from newLore_expanded.txt.
 */

export const RESPAWN_LEAGUES = 2
export const RESPAWN_MS = 45000

export const SPAWNS = {
  start: { wx: 10, wy: 5 },
  flagon: { wx: 10, wy: 5 },
  market: { wx: 3, wy: 6 },
  stub: { wx: -3, wy: 47 },
}

export const STONE = { wx: 7, wy: 49 }
export const SOUTH_GATE = [{ wx: 9, wy: 10 }, { wx: 10, wy: 10 }]

export const FIXED_PROPS = [
  { kind: 'tree', variant: 0, wx: 6, wy: 16 },
  { kind: 'tree', variant: 1, wx: 5, wy: 18 },
  { kind: 'tree', variant: 2, wx: 4, wy: 30 },
  { kind: 'tree', variant: 3, wx: 3, wy: 36 },
  { kind: 'rock', variant: 0, wx: 14, wy: 20 },
  { kind: 'log', variant: 0, wx: 3, wy: 33 },
  { kind: 'fence', variant: 0, wx: 15, wy: 14 },
  { kind: 'fence', variant: 1, wx: 15, wy: 15 },
  { kind: 'fence', variant: 2, wx: 15, wy: 16 },
  { kind: 'fence', variant: 0, wx: 15, wy: 18 },
  { kind: 'milestone', variant: 0, wx: STONE.wx, wy: STONE.wy },
  { kind: 'rock', variant: 1, wx: 5, wy: 49 },
  { kind: 'rock', variant: 2, wx: 5, wy: 50 },
  { kind: 'rock', variant: 0, wx: 9, wy: 50 },
  { kind: 'rock', variant: 3, wx: 6, wy: 50 },
  { kind: 'cart', variant: 0, wx: 13, wy: 23 },
  { kind: 'campfire', variant: 0, wx: 14, wy: 26 },
  { kind: 'hay', variant: 0, wx: 16, wy: 19 },
  { kind: 'hay', variant: 1, wx: 16, wy: 34 },
  { kind: 'crate', variant: 0, wx: 2, wy: 7 },
  { kind: 'barrel', variant: 0, wx: 4, wy: 6 },
  { kind: 'well', variant: 0, wx: 16, wy: 6 },
  { kind: 'lamp', variant: 0, wx: 7, wy: 6 },
  { kind: 'lamp', variant: 1, wx: 12, wy: 6 },
  { kind: 'sign', variant: 0, wx: 8, wy: 9 },
  { kind: 'board', variant: 0, wx: 7, wy: 5 },
]

export const FIXED_LOOT = [
  {
    id: 'satchel-ember-road',
    wx: 12,
    wy: 28,
    marker: 'satchel',
    label: 'Press E to pick up the satchel',
    short: 'Satchel',
    items: [{ id: 'apple', count: 2 }],
    gems: null,
  },
  {
    id: 'ford-cache',
    wx: 13,
    wy: 8,
    marker: 'cache',
    label: "Press E to open the fisherman's cache",
    short: 'Cache',
    items: [{ id: 'healing_potion', count: 1 }],
    gems: null,
  },
  {
    id: 'forest-herb',
    wx: 3,
    wy: 16,
    marker: 'herb',
    label: 'Press E to pick emberleaf',
    short: 'Herbs',
    items: [{ id: 'healing_potion', count: 1 }],
    gems: null,
  },
  {
    id: 'hearth-offering',
    wx: 6,
    wy: 49,
    marker: 'offering',
    label: 'Press E to take an offering',
    short: 'Offering',
    items: [],
    gems: { ruby: 0, sapphire: 0, emerald: 1 },
  },
]

export const INTERACTABLES = [
  {
    id: 'flagon-door',
    wx: 9,
    wy: 4,
    w: 2,
    h: 1,
    kind: 'exit',
    action: 'travel',
    to: 'tavern',
    spawn: { nx: 0.5, ny: 0.85 },
    label: 'Press E to enter the Embered Flagon',
    short: 'Flagon',
  },
  {
    id: 'market-door',
    wx: 3,
    wy: 6,
    w: 1,
    h: 1,
    kind: 'exit',
    action: 'travel',
    to: 'market',
    spawn: { nx: 0.5, ny: 0.9 },
    label: 'Press E to enter the market',
    short: 'Market',
  },
  {
    id: 'notice-board',
    wx: 7,
    wy: 5,
    w: 1,
    h: 1,
    kind: 'talk',
    action: 'read',
    label: 'Press E to read the notice board',
    short: 'Notices',
    text: 'Notices, Storyteller\'s Square. South-gate contract: Captain Yselle Dorn pays for word of goblin scouts between here and Hearthmile Stone. Bramble Wick, at the forge by the river, will speak of a sword he will not name. Hest buys hides and sells kit. Sella keeps the ford-shrine and the healing draughts. Ask the Keeper what is under the Flagon only if your heart is steady. The Cavern is not south. The first four leagues are.',
  },
  {
    id: 'south-gate-sign',
    wx: 8,
    wy: 9,
    w: 1,
    h: 1,
    kind: 'talk',
    action: 'read',
    label: 'Press E to read the signpost',
    short: 'Signpost',
    text: 'Ember Road, south. Hearthmile Stone, four leagues. There the road bends west-northwest along the eaves to Ruinwatch, sixteen leagues, and north again to the Cavern of Embers. Twenty-eight leagues from this gate. Yselle Dorn keeps the palisade and this first leg.',
  },
  {
    id: 'smithy-sign',
    wx: 13,
    wy: 5,
    w: 1,
    h: 1,
    kind: 'talk',
    action: 'read',
    label: 'Press E to read the forge board',
    short: 'Forge',
    text: 'Bramble Wick, smith. Not a dwarf. He has listened to dwarves more than is good for a human, and he will not explain every blade he mends.',
  },
  {
    id: 'sella-shrine',
    wx: 12,
    wy: 8,
    w: 1,
    h: 1,
    kind: 'talk',
    action: 'read',
    label: 'Press E to look at the shrine-stone',
    short: 'Shrine',
    text: 'Sella\'s niche, by the ford. A Serenya stone, a coil of reed, and the smell of the healing draughts she sells through Hest. She is not a cultist. She will tell you if you are about to become one.',
  },
  {
    id: 'hearthmile-stone',
    wx: 8,
    wy: 49,
    w: 1,
    h: 1,
    kind: 'talk',
    action: 'read',
    label: 'Press E to read Hearthmile Stone',
    short: 'Hearthmile',
    text: 'HEARTHMILE. Four leagues north, Brackenford. West-northwest, the eaves road: Ruinwatch sixteen leagues, the Cavern of Embers beyond. Yselle Dorn\'s writ ends at this stone. Offerings left here are for the road, not for the dead. (The wording of the cutting is a guess. The distances are the Keeper\'s.)',
  },
  {
    id: 'ruinwatch-stub',
    wx: -4,
    wy: 47,
    w: 1,
    h: 1,
    kind: 'exit',
    action: 'travel',
    to: 'path',
    spawn: { nx: 0.5, ny: 0.12 },
    label: 'Press E to take the old trail toward the Cavern',
    short: 'Old trail',
  },
]

export const ENCOUNTER_TABLES = {
  forest: [
    { type: 'goblin', name: 'Goblin Scout', weight: 5 },
    { type: 'archer', name: 'Firefang Archer', weight: 3 },
    { type: 'brute', name: 'Firefang Brute', weight: 1 },
  ],
  road: [
    { type: 'goblin', name: 'Road Bandit', weight: 3 },
    { type: 'brute', name: 'Bandit Bruiser', weight: 2 },
  ],
  plains: [
    { type: 'goblin', name: 'Dike Bandit', weight: 3 },
    { type: 'brute', name: 'Dike Bruiser', weight: 1 },
  ],
}

export const ENCOUNTER_RULES = {
  maxPerLeague: 2,
  forestChance: 0.012,
  plainsChance: 0.008,
  minSpacing: 5,
}

/** Anchors so the corridor always has the encounters the lore puts here. */
export const SCRIPTED_ENCOUNTERS = [
  { id: 'bandit-road', wx: 12, wy: 26, type: 'goblin', name: 'Road Bandit', table: 'road' },
  { id: 'scout-eaves', wx: -8, wy: 18, type: 'goblin', name: 'Goblin Scout', table: 'forest' },
  { id: 'archer-eaves', wx: -10, wy: 36, type: 'archer', name: 'Firefang Archer', table: 'forest' },
  { id: 'dike-bruiser', wx: 16, wy: 24, type: 'brute', name: 'Dike Bruiser', table: 'plains' },
]

export const HERB_RULE = {
  chance: 0.035,
  maxPerLeague: 1,
  item: 'healing_potion',
}
