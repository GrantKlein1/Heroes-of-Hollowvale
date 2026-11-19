import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  registerItem,
  unregisterItem,
  getItem,
  getItemDef,
  listItems,
  marketItems,
  marketPrice,
  marketPrices,
  itemIcons,
  isConsumable,
  consumableEffect,
  consumableEffects,
  isQuestItem,
  isSellable,
  lootPickupIds,
  lootAtlasFor,
  holdClipsFor,
  inhandFor,
  inhandScaleFor,
  BOW_HAND_SCALE,
  ARROW_VISUAL_SCALE,
  itemUsableBy,
  isRangedWeapon,
  useLayersFor,
  holdGlowFor,
} from '../registry.js'
import { ITEM_ICONS } from '../../../config/paths.js'
import { CONSUMABLE_EFFECTS, applyConsumableEffects, isWieldedWeapon, meleeDamageFor, MELEE_DMG } from '../../combat/balance.js'
import {
  LOOT_PICKUP_IDS,
  lootHasSprite,
  lootIdleAnimKey,
  seededLootIds,
  generateSeededLoot,
} from '../../combat/death.js'
import { ENEMY_DEFS } from '../../combat/enemyDefs.js'
import { getHeldItemId, holdClipFor, useClipFor, useGlowClipFor, getItemAnchor, inhandAtlasKey, inhandOriginFor } from '../../actors/itemHold.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(HERE, '../../../../public')
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets/manifest.json'), 'utf8'))
const readAtlas = (rel) => JSON.parse(fs.readFileSync(path.join(PUBLIC, rel), 'utf8'))

const P = (ruby, sapphire, emerald) => ({ ruby, sapphire, emerald })

/**
 * What Game.jsx ITEMS / MARKET_PRICES, paths.js ITEM_ICONS and balance.js
 * CONSUMABLE_EFFECTS said before the registry. Every existing id must keep it.
 */
const EXISTING = {
  iron_sword: { name: 'Iron Sword', icon: '/images/knightSword.png', price: P(4, 0, 2), category: 'Weaponry' },
  wooden_shield: { name: 'Wooden Shield', icon: '/images/knightShield.png', price: null },
  chainmail_armor: { name: 'Chainmail Armor', icon: '/images/knightArmor.png', price: P(4, 0, 1), category: 'Armor' },
  healing_potion: {
    name: 'Healing Potion', icon: '/images/healPotion.png', price: P(1, 0, 0), category: 'Potions',
    effect: { heal: 70, mana: 0, speedMs: 0, clip: 'use_drink' },
  },
  apprentice_staff: { name: 'Apprentice Staff', icon: '/images/mageStaff.png', price: P(5, 2, 0), category: 'Magic' },
  spellbook: { name: 'Spellbook', icon: '/images/mageSpellBook.png', price: P(1, 3, 0), category: 'Magic' },
  cloth_robes: { name: 'Cloth Robes', icon: '/images/mageRobes.png', price: P(1, 2, 0), category: 'Armor' },
  mana_potion: {
    name: 'Mana Potion', icon: '/images/manaPotion.png', price: P(0, 1, 0), category: 'Potions',
    effect: { heal: 0, mana: 75, speedMs: 0, clip: 'use_drink' },
  },
  twin_daggers: { name: 'Twin Daggers', icon: '/images/thiefDaggers.png', price: P(3, 3, 0), category: 'Weaponry' },
  leather_armor: { name: 'Leather Armor', icon: '/images/thiefCloak.png', price: P(1, 0, 2), category: 'Armor' },
  lockpicks: { name: 'Lockpicks', icon: '/images/thiefLockpick.png', price: P(1, 2, 1), category: 'Tools' },
  poison_vial: { name: 'Poison Vial', icon: '/images/thiefPoison.png', price: null },
  battle_axe: { name: 'Battle Axe', icon: '/images/dwarfAxe.png', price: P(0, 4, 2), category: 'Weaponry' },
  dwarf_armor: { name: 'Dwarf Armor', icon: '/images/dwarfArmor.png', price: P(5, 1, 0), category: 'Armor' },
  dwarf_pickaxe: { name: 'Dwarf Pickaxe', icon: '/images/dwarfPickaxe.png', price: P(2, 0, 2), category: 'Tools' },
  ale_flask: {
    name: 'Ale Flask', icon: '/images/dwarfAle.png', price: P(0, 0, 2), category: 'Food',
    effect: { heal: 10, mana: 0, damageMult: 1.25, durationMs: 5000, clip: 'use_drink' },
  },
  speed_potion: {
    name: 'Speed Potion', icon: '/images/speedPotion.png', price: P(0, 0, 2), category: 'Potions',
    effect: { heal: 0, mana: 0, speedMs: 10000, clip: 'use_drink' },
  },
  apple: {
    name: 'Apple', icon: '/images/apple.png', price: P(1, 0, 0), category: 'Food',
    effect: { heal: 25, mana: 0, speedMs: 0, clip: 'use_eat' },
  },
  ruby: { name: 'Ruby', icon: '/images/ruby.png', price: null },
  sapphire: { name: 'Sapphire', icon: '/images/sapphire.png', price: null },
  emerald: { name: 'Emerald', icon: '/images/emerald.png', price: null },
}

/** Old MARKET_ITEMS array, in its old order. */
const OLD_MARKET = [
  ['healing_potion', 'Potions'], ['mana_potion', 'Potions'], ['speed_potion', 'Potions'],
  ['apprentice_staff', 'Magic'], ['spellbook', 'Magic'],
  ['apple', 'Food'], ['ale_flask', 'Food'],
  ['iron_sword', 'Weaponry'], ['twin_daggers', 'Weaponry'], ['battle_axe', 'Weaponry'],
  ['chainmail_armor', 'Armor'], ['leather_armor', 'Armor'], ['dwarf_armor', 'Armor'], ['cloth_robes', 'Armor'],
  ['lockpicks', 'Tools'], ['dwarf_pickaxe', 'Tools'],
]

const NEW_IDS = ['nightfang_dagger', 'stonehollow_hammer', 'healing_charm', 'seranyas_tear', 'ember_chalice']
const HEROES = ['knight', 'mage', 'thief', 'dwarf']

describe('item registry (ITEM-NEW-1)', () => {
  describe('existing items keep their name, icon, price and effect', () => {
    it.each(Object.entries(EXISTING))('%s', (id, want) => {
      const item = getItem(id)
      expect(item, id).toBeDefined()
      expect(item.name).toBe(want.name)
      expect(item.icon).toBe(want.icon)
      expect(getItemDef(id)).toMatchObject({ name: want.name, icon: want.icon })
      if (want.price) {
        expect(marketPrice(id)).toEqual(want.price)
        expect(item.market).toBe(want.category)
      } else {
        expect(item.market).toBeNull()
        expect(marketPrice(id)).toEqual(P(0, 0, 0))
      }
      if (want.effect) {
        expect(consumableEffect(id)).toEqual(want.effect)
        expect(CONSUMABLE_EFFECTS[id]).toEqual(want.effect)
      } else {
        expect(consumableEffect(id)).toBeNull()
        expect(CONSUMABLE_EFFECTS[id]).toBeUndefined()
      }
    })

    it('lists the market in the old order', () => {
      const old = marketItems().filter((row) => !NEW_IDS.includes(row.id))
      expect(old.map((row) => [row.id, row.category])).toEqual(OLD_MARKET)
    })

    it('feeds ITEM_ICONS and LOOT_PICKUP_IDS from the registry', () => {
      for (const [id, want] of Object.entries(EXISTING)) expect(ITEM_ICONS[id]).toBe(want.icon)
      expect(ITEM_ICONS).toMatchObject(itemIcons())
      expect(LOOT_PICKUP_IDS.slice(0, 6)).toEqual(['ruby', 'sapphire', 'emerald', 'healing_potion', 'mana_potion', 'speed_potion'])
    })

    it('keeps the in-hand atlas and origin of the Batch 9 and 10 items', () => {
      for (const id of ['poison_vial', 'lockpicks', 'dwarf_pickaxe']) expect(inhandAtlasKey(id)).toBe('items_inhand_b10')
      for (const id of ['healing_potion', 'apple', 'ale_flask', 'unknown']) expect(inhandAtlasKey(id)).toBe('items_inhand')
      expect(inhandOriginFor('healing_potion')).toEqual([12 / 24, 15.61 / 24])
      expect(inhandOriginFor('dwarf_pickaxe')).toEqual([12 / 24, 15.61 / 24])
    })

    it('unknown ids fall back to /images/<id>.png', () => {
      expect(getItemDef('mystery')).toEqual({ name: 'mystery', icon: '/images/mystery.png' })
      expect(marketPrice('mystery')).toEqual(P(0, 0, 0))
    })
  })

  describe('a fake item added only in the registry', () => {
    const FAKE = 'zz_fake_tonic'
    afterEach(() => unregisterItem(FAKE))

    it('shows up in the market, the inventory catalog and the consume path', () => {
      registerItem({
        id: FAKE,
        name: 'Fake Tonic',
        icon: '/images/fakeTonic.png',
        kind: 'consumable',
        effect: { heal: 33, mana: 5, speedMs: 0 },
        use: { clip: 'use_drink' },
        market: 'Potions',
        price: P(2, 0, 1),
        hold: { idle: 'hold_idle', run: 'hold_run' },
        loot: { pickupAtlas: 'loot_pickups', random: true },
      })

      // market
      expect(marketItems()).toContainEqual({ id: FAKE, category: 'Potions' })
      expect(marketPrice(FAKE)).toEqual(P(2, 0, 1))
      expect(marketPrices()[FAKE]).toEqual(P(2, 0, 1))
      // inventory catalog (what Game.jsx getItemDef feeds the slots with)
      expect(getItemDef(FAKE)).toMatchObject({ name: 'Fake Tonic', icon: '/images/fakeTonic.png' })
      expect(itemIcons()[FAKE]).toBe('/images/fakeTonic.png')
      // consume path: scene gate, hold, use clip and the effect itself
      expect(isConsumable(FAKE)).toBe(true)
      expect(consumableEffects()[FAKE]).toEqual({ heal: 33, mana: 5, speedMs: 0, clip: 'use_drink' })
      expect(useClipFor(FAKE)).toBe('use_drink')
      expect(getHeldItemId({ equippedId: FAKE, classId: 'knight' })).toBe(FAKE)
      const applied = applyConsumableEffects(consumableEffect(FAKE), { hp: 10, hpMax: 100, mana: 0, manaMax: 50 }, 0)
      expect(applied.hp).toBe(43)
      expect(applied.mana).toBe(5)
      // world pickup
      expect(lootHasSprite(FAKE)).toBe(true)
      expect(lootPickupIds()).toContain(FAKE)

      unregisterItem(FAKE)
      expect(marketItems().some((row) => row.id === FAKE)).toBe(false)
      expect(isConsumable(FAKE)).toBe(false)
    })

    it('rejects a quest item with a use clip or market row', () => {
      expect(() => registerItem({ id: FAKE, name: 'x', kind: 'quest', use: { clip: 'use_drink' } })).toThrow()
      expect(() => registerItem({ id: FAKE, name: 'x', kind: 'consumable', market: 'Potions' })).toThrow()
      expect(() => registerItem({ id: FAKE, name: 'x', kind: 'bogus' })).toThrow()
    })
  })

  describe('Batch 11 items: effect and price rows (placeholders, tunable)', () => {
    it('nightfang_dagger is a thief weapon in the market', () => {
      const item = getItem('nightfang_dagger')
      expect(item).toMatchObject({ name: 'Nightfang Dagger', kind: 'weapon', classes: ['thief'], market: 'Weaponry' })
      expect(item.price).toEqual(P(4, 3, 1))
      expect(item.weapon).toEqual({ damage: 9 })
      expect(item.icon).toBe('/images/nightfang_dagger.png')
    })

    it('stonehollow_hammer is a dwarf weapon in the market', () => {
      const item = getItem('stonehollow_hammer')
      expect(item).toMatchObject({ name: 'Stonehollow Hammer', kind: 'weapon', classes: ['dwarf'], market: 'Weaponry' })
      expect(item.price).toEqual(P(2, 4, 2))
      expect(item.weapon).toEqual({ damage: 26 })
    })

    it('healing_charm heals 45 with the use_charm clip and its glow, for every hero', () => {
      const item = getItem('healing_charm')
      expect(item).toMatchObject({ name: 'Healing Charm', kind: 'consumable', classes: null, market: 'Magic' })
      expect(item.price).toEqual(P(1, 1, 0))
      expect(consumableEffect('healing_charm')).toEqual({ heal: 45, mana: 0, speedMs: 0, clip: 'use_charm' })
      expect(useClipFor('healing_charm')).toBe('use_charm')
      expect(useGlowClipFor('healing_charm')).toBe('use_charm_glow')
      expect(item.use.effectFrame).toBe(10)
      for (const hero of HEROES) expect(getHeldItemId({ equippedId: 'healing_charm', classId: hero })).toBe('healing_charm')
      const applied = applyConsumableEffects(consumableEffect('healing_charm'), { hp: 20, hpMax: 100, mana: 0, manaMax: 0 }, 0)
      expect(applied.hp).toBe(65)
    })

    it.each(['seranyas_tear', 'ember_chalice'])('%s is a quest item: no use, no sale, no consume, no market', (id) => {
      const item = getItem(id)
      expect(item.kind).toBe('quest')
      expect(isQuestItem(id)).toBe(true)
      expect(item.use).toBeNull()
      expect(item.effect).toBeNull()
      expect(item.hold).toBeNull()
      expect(item.market).toBeNull()
      expect(item.price).toBeNull()
      expect(isSellable(id)).toBe(false)
      expect(isConsumable(id)).toBe(false)
      expect(useClipFor(id)).toBeNull()
      expect(CONSUMABLE_EFFECTS[id]).toBeUndefined()
      expect(marketItems().some((row) => row.id === id)).toBe(false)
      expect(getHeldItemId({ equippedId: id, classId: 'knight' })).toBeNull()
      expect(lootAtlasFor(id)).toBe('loot_pickups_b11')
    })

    it('sells the dagger, hammer and charm, and nothing else of the five', () => {
      const ids = marketItems().map((row) => row.id)
      for (const id of ['nightfang_dagger', 'stonehollow_hammer', 'healing_charm']) expect(ids).toContain(id)
      for (const id of ['seranyas_tear', 'ember_chalice']) expect(ids).not.toContain(id)
    })

    it('keeps quest items out of random loot: no enemy table lists them and a roll cannot grant them', () => {
      const rolled = seededLootIds()
      expect(rolled).not.toContain('seranyas_tear')
      expect(rolled).not.toContain('ember_chalice')
      // Even if a table listed one, the roll must not grant it.
      ENEMY_DEFS.goblin.loot.items.push({ id: 'seranyas_tear', chance: 1, count: 1 })
      try {
        const loot = generateSeededLoot('goblin', () => 0)
        expect(loot.items.map((i) => i.id)).not.toContain('seranyas_tear')
        expect(loot.items.map((i) => i.id)).toContain('healing_charm')
      } finally {
        ENEMY_DEFS.goblin.loot.items.pop()
      }
    })

    it('puts the dagger, hammer and charm in existing enemy loot tables', () => {
      const rolled = seededLootIds()
      for (const id of ['nightfang_dagger', 'stonehollow_hammer', 'healing_charm']) expect(rolled).toContain(id)
    })
  })

  describe('weapons', () => {
    it('lets the thief swing the nightfang dagger and the dwarf the hammer, and nobody else', () => {
      expect(isWieldedWeapon('thief', 'twin_daggers')).toBe(true)
      expect(isWieldedWeapon('thief', 'nightfang_dagger')).toBe(true)
      expect(isWieldedWeapon('knight', 'nightfang_dagger')).toBe(false)
      expect(isWieldedWeapon('dwarf', 'stonehollow_hammer')).toBe(true)
      expect(isWieldedWeapon('thief', 'stonehollow_hammer')).toBe(false)
      expect(isWieldedWeapon('knight', 'healing_charm')).toBe(false)
      expect(isWieldedWeapon('thief', null)).toBe(false)
    })

    it('class weapons keep their class damage; the new weapons bring their own', () => {
      expect(meleeDamageFor('thief', 'twin_daggers')).toBe(MELEE_DMG.thief)
      expect(meleeDamageFor('thief', null)).toBe(MELEE_DMG.thief)
      expect(meleeDamageFor('thief', 'nightfang_dagger')).toBe(9)
      expect(meleeDamageFor('dwarf', 'stonehollow_hammer')).toBe(26)
      expect(meleeDamageFor('knight', 'nightfang_dagger')).toBe(MELEE_DMG.knight)
    })

    it('holds the dagger for the thief only and the hammer for the dwarf only', () => {
      expect(getHeldItemId({ equippedId: 'nightfang_dagger', classId: 'thief' })).toBe('nightfang_dagger')
      expect(getHeldItemId({ equippedId: 'nightfang_dagger', classId: 'knight' })).toBeNull()
      expect(getHeldItemId({ equippedId: 'stonehollow_hammer', classId: 'dwarf' })).toBe('stonehollow_hammer')
      expect(getHeldItemId({ equippedId: 'stonehollow_hammer', classId: 'thief' })).toBeNull()
      // existing weapons still draw no in-hand sprite
      expect(getHeldItemId({ equippedId: 'twin_daggers', classId: 'thief' })).toBeNull()
    })
  })

  describe('hold and use clip names resolve to shipped sheets, anims and anchors', () => {
    const sheetFor = (hero, clip) => manifest.assets[hero].sheets[`${hero}_${clip}`]

    const heldBy = (id) => HEROES.filter((hero) => getHeldItemId({ equippedId: id, classId: hero }) === id)

    it.each(NEW_IDS.filter((id) => getItem(id).hold))('%s hold clips exist for every hero that holds it', (id) => {
      const heroes = heldBy(id)
      expect(heroes.length).toBeGreaterThan(0)
      for (const hero of heroes) {
        for (const moving of [false, true]) {
          const clip = holdClipFor(moving, id, hero)
          const sheet = sheetFor(hero, clip)
          expect(sheet, `${hero}_${clip} sheet in manifest`).toBeDefined()
          expect(fs.existsSync(path.join(PUBLIC, sheet.image)), sheet.image).toBe(true)
          const atlas = readAtlas(sheet.json)
          // the anim the sheet publishes, after any alias, is `<clip>`
          const metaAnim = sheet.animAliases ? Object.entries(sheet.animAliases).find(([, v]) => v === clip)?.[0] : clip
          expect(atlas.meta.anims[metaAnim], `${sheet.json} meta.anims.${metaAnim}`).toBeDefined()
          // anchors resolve for every facing's first frame
          for (const dir of ['down', 'left', 'right', 'up']) {
            const stem = clip.replace(/^charm_/, '')
            const anchor = getItemAnchor(hero, clip, `${hero}_${stem}_${dir}_0`)
            expect(anchor, `${hero} ${clip} ${dir} anchor`).not.toBeNull()
            expect(typeof anchor.x).toBe('number')
          }
        }
      }
    })

    it('the dwarf charm uses the potion-grip hold sheets; the hammer uses the tool-grip dwarf_hold sheets', () => {
      expect(holdClipFor(false, 'healing_charm', 'dwarf')).toBe('charm_hold_idle')
      expect(holdClipFor(true, 'healing_charm', 'dwarf')).toBe('charm_hold_run')
      expect(holdClipFor(false, 'healing_charm', 'knight')).toBe('hold_idle')
      expect(holdClipFor(true, 'stonehollow_hammer', 'dwarf')).toBe('hold_run')
      expect(holdClipsFor('stonehollow_hammer', 'dwarf')).toEqual({ idle: 'hold_idle', run: 'hold_run' })
    })

    it.each(HEROES)('%s use_charm and use_charm_glow resolve: sheet, 16 frames @ 16 fps, effect frame 10, anchors', (hero) => {
      const clip = useClipFor('healing_charm')
      const body = sheetFor(hero, clip)
      const glow = sheetFor(hero, useGlowClipFor('healing_charm'))
      expect(body).toBeDefined()
      expect(glow).toBeDefined()
      const bodyAtlas = readAtlas(body.json)
      const anim = bodyAtlas.meta.anims.use_charm
      expect(anim.frames).toBe(16)
      expect(anim.fps).toBe(16)
      expect(anim.effectFrame).toBe(getItem('healing_charm').use.effectFrame)
      expect(anim.loop).toBe(false)
      expect(anim.directions).toEqual(['down', 'left', 'right', 'up'])
      // the glow is frame-for-frame the same frame names as the body
      const glowAtlas = readAtlas(glow.json)
      expect(Object.keys(glowAtlas.frames).sort()).toEqual(Object.keys(bodyAtlas.frames).sort())
      for (const dir of ['down', 'left', 'right', 'up']) {
        const anchor = getItemAnchor(hero, 'use_charm', `${hero}_use_charm_${dir}_10`)
        expect(anchor, `${hero} use_charm ${dir} f10 anchor`).not.toBeNull()
      }
    })

    it('the in-hand atlas has a frame per facing for each held item with the registry pivot', () => {
      const atlas = readAtlas(manifest.assets.items_inhand_b11.json)
      for (const id of ['nightfang_dagger', 'stonehollow_hammer', 'healing_charm']) {
        expect(inhandAtlasKey(id)).toBe('items_inhand_b11')
        for (const dir of ['down', 'left', 'right', 'up']) {
          const frame = atlas.frames[`${id}_${dir}`]
          expect(frame, `${id}_${dir}`).toBeDefined()
          const [ox, oy] = inhandFor(id).origin
          expect(frame.pivot.x).toBeCloseTo(ox, 3)
          expect(frame.pivot.y).toBeCloseTo(oy, 3)
        }
      }
      // hammer cell is 32x32, dagger and charm 24x24
      expect(atlas.frames.stonehollow_hammer_down.frame).toMatchObject({ w: 32, h: 32 })
      expect(atlas.frames.nightfang_dagger_down.frame).toMatchObject({ w: 24, h: 24 })
    })

    it('every Batch 11 item has a loot pickup clip; quest pickups glow at 4 fps, the rest play at 8 fps', () => {
      const atlas = readAtlas(manifest.assets.loot_pickups_b11.json)
      for (const id of NEW_IDS) {
        expect(lootHasSprite(id)).toBe(true)
        expect(LOOT_PICKUP_IDS).toContain(id)
        const anim = atlas.meta.anims[`loot_${id}_idle`]
        expect(anim, id).toBeDefined()
        expect(anim.fps).toBe(isQuestItem(id) ? 4 : 8)
        expect(manifest.assets.loot_pickups_b11.anims[`loot_${id}_idle`].fps).toBe(isQuestItem(id) ? 4 : 8)
        expect(lootIdleAnimKey(id)).toBe(`loot_pickups_b11_loot_${id}_idle_down`)
        expect(atlas.frames[`loot_${id}_idle_down_0`]).toBeDefined()
      }
      // main atlas pickups keep their key
      expect(lootIdleAnimKey('ruby')).toBe('loot_pickups_loot_ruby_idle_down')
      expect(manifest.assets.loot_pickups.anims.loot_ruby_idle.fps).toBe(8)
    })

    it('every item icon on disk exists', () => {
      for (const id of NEW_IDS) expect(fs.existsSync(path.join(PUBLIC, getItem(id).icon)), id).toBe(true)
    })
  })

  describe('lightning_bow (BOW-1, Batch 12)', () => {
    const HEROES = ['thief', 'knight', 'mage', 'dwarf']
    const DIRS = ['down', 'left', 'right', 'up']
    const DURATIONS = [83, 83, 84, 83, 83, 84, 83, 83, 84, 83]

    it('is a found weapon any class can hold: not sold, with icon, in-hand sprite, pickup and projectile', () => {
      const bow = getItem('lightning_bow')
      expect(bow).toMatchObject({
        id: 'lightning_bow', name: 'Lightning Bow', kind: 'weapon', icon: '/images/lightning_bow.png',
        classes: null, market: null, price: null, effect: null,
      })
      expect(bow.weapon).toEqual({ damage: 14, ranged: true })
      expect(bow.projectile).toMatchObject({ speed: 520, maxDist: 360, size: 24, visualScale: ARROW_VISUAL_SCALE })
      expect(ARROW_VISUAL_SCALE).toBeCloseTo(0.42, 5)
      expect(BOW_HAND_SCALE).toBeCloseTo(1.45, 5)
      expect(inhandScaleFor('lightning_bow')).toBe(BOW_HAND_SCALE)
      expect(inhandScaleFor('healing_potion')).toBe(1)
      expect(isRangedWeapon('lightning_bow')).toBe(true)
      expect(isRangedWeapon('iron_sword')).toBe(false)
      expect(marketItems().map((m) => m.id)).not.toContain('lightning_bow')
      for (const hero of HEROES) expect(itemUsableBy('lightning_bow', hero)).toBe(true)
      expect(ITEM_ICONS.lightning_bow).toBe('/images/lightning_bow.png')
      expect(fs.existsSync(path.join(PUBLIC, bow.icon))).toBe(true)
    })

    it('is not a melee weapon: the class swing and damage are untouched', () => {
      for (const hero of HEROES) {
        expect(isWieldedWeapon(hero, 'lightning_bow')).toBe(false)
        expect(meleeDamageFor(hero, 'lightning_bow')).toBe(MELEE_DMG[hero])
      }
    })

    it('holds with the hero hold clips (the dwarf potion grip) and a resting glow, and draws with use_bow', () => {
      expect(holdClipsFor('lightning_bow', 'knight')).toEqual({ idle: 'hold_idle', run: 'hold_run' })
      expect(holdClipsFor('lightning_bow', 'dwarf')).toEqual({ idle: 'charm_hold_idle', run: 'charm_hold_run' })
      expect(holdGlowFor('lightning_bow')).toBe('bow_hold_idle_glow')
      expect(useLayersFor('lightning_bow')).toEqual({ weapon: 'use_bow_weapon', glow: 'use_bow_glow' })
      expect(getItem('lightning_bow').use).toMatchObject({ clip: 'use_bow', effectFrame: 6, durations: DURATIONS })
      expect(useClipFor('lightning_bow')).toBeNull() // not a consumable
      for (const hero of HEROES) {
        expect(getHeldItemId({ classId: hero, equippedId: 'lightning_bow' })).toBe('lightning_bow')
      }
      expect(inhandAtlasKey('lightning_bow')).toBe('items_inhand_b12')
      expect(inhandOriginFor('lightning_bow')).toEqual([0.5, 0.5])
      expect(inhandFor('lightning_bow').scale).toBe(BOW_HAND_SCALE)
    })

    it.each(HEROES)('%s use_bow sheets: 10 frames at 12 fps, release on frame 6, weapon and glow on the same grid', (hero) => {
      const sheets = manifest.assets[hero].sheets
      for (const suffix of ['use_bow', 'use_bow_weapon', 'use_bow_glow', 'bow_hold_idle_glow']) {
        expect(sheets[`${hero}_${suffix}`], `${hero}_${suffix}`).toBeDefined()
      }
      const body = readAtlas(sheets[`${hero}_use_bow`].json)
      const weapon = readAtlas(sheets[`${hero}_use_bow_weapon`].json)
      const glow = readAtlas(sheets[`${hero}_use_bow_glow`].json)
      const clip = body.meta.anims.use_bow
      expect(clip).toMatchObject({ frames: 10, fps: 12, effectFrame: 6, durations: DURATIONS, next: 'hold_idle' })
      expect(DURATIONS.slice(0, 6).reduce((a, b) => a + b, 0)).toBe(500)
      expect(Object.keys(weapon.frames)).toEqual(Object.keys(body.frames))
      expect(Object.keys(glow.frames)).toEqual(Object.keys(body.frames))
      const cell = hero === 'dwarf' ? { w: 64, h: 80 } : { w: 64, h: 96 }
      for (const dir of DIRS) {
        for (let i = 0; i < 10; i++) {
          const name = `${hero}_use_bow_${dir}_${i}`
          expect(body.frames[name], name).toBeDefined()
          expect(body.frames[name].frame).toMatchObject(cell)
        }
        expect(readAtlas(sheets[`${hero}_bow_hold_idle_glow`].json).frames[`${hero}_bow_hold_idle_glow_${dir}_0`]).toBeDefined()
        // the arrow leaves at that frame's arrow tip
        const anchor = getItemAnchor(hero, 'use_bow', `${hero}_use_bow_${dir}_6`)
        expect(anchor.arrowTip, `${hero} ${dir}`).toHaveLength(2)
        expect(anchor.layer).toBe('front')
      }
    })

    it('has a 6-frame 8 fps shimmer pickup, the in-hand sheet and the arrow and impact clips', () => {
      expect(lootHasSprite('lightning_bow')).toBe(true)
      expect(LOOT_PICKUP_IDS).toContain('lightning_bow')
      expect(lootAtlasFor('lightning_bow')).toBe('loot_pickups_b12')
      expect(lootIdleAnimKey('lightning_bow')).toBe('loot_pickups_b12_loot_lightning_bow_idle_down')
      const loot = readAtlas(manifest.assets.loot_pickups_b12.json)
      expect(loot.meta.anims.loot_lightning_bow_idle).toMatchObject({ frames: 6, fps: 8, loop: true })
      expect(manifest.assets.loot_pickups_b12.anims.loot_lightning_bow_idle.fps).toBe(8)
      for (let i = 0; i < 6; i++) expect(loot.frames[`loot_lightning_bow_idle_down_${i}`]).toBeDefined()
      expect(manifest.groups.loot).toContain('loot_pickups_b12')

      const inhand = readAtlas(manifest.assets.items_inhand_b12.json)
      for (const dir of DIRS) {
        expect(inhand.frames[`lightning_bow_${dir}`].frame).toMatchObject({ w: 48, h: 48 })
        expect(inhand.frames[`lightning_bow_${dir}`].pivot).toEqual({ x: 0.5, y: 0.5 })
      }
      expect(manifest.groups.wilderness).toContain('items_inhand_b12')
      expect(manifest.groups.boss).toContain('items_inhand_b12')

      const arrow = readAtlas(manifest.assets.lightning_arrow_b12.json)
      const impact = readAtlas(manifest.assets.lightning_arrow_impact_b12.json)
      expect(Object.keys(arrow.frames)).toHaveLength(4)
      expect(arrow.frames.lightning_arrow_b12_0.frame).toMatchObject({ w: 96, h: 32 })
      expect(Object.keys(impact.frames)).toHaveLength(7)
      expect(impact.frames.lightning_arrow_impact_b12_0.frame).toMatchObject({ w: 64, h: 64 })
      expect(manifest.groups.bow_b12).toEqual(['lightning_arrow_b12', 'lightning_arrow_impact_b12'])
    })

    it('can be found: a rare goblin archer drop (the locked cavern chest also holds one)', () => {
      const archer = ENEMY_DEFS.archer.loot.items.find((row) => row.id === 'lightning_bow')
      expect(archer).toMatchObject({ chance: 0.05, count: 1 })
      expect(seededLootIds()).toContain('lightning_bow')
    })
  })

  it('lists every id once', () => {
    const ids = listItems().map((it) => it.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of Object.keys(EXISTING)) expect(ids).toContain(id)
    for (const id of NEW_IDS) expect(ids).toContain(id)
  })
})
