import React, { useEffect, useRef, useState, useMemo } from 'react'
import { sendChat as apiSendChat, sendChatWithFallback } from './lib/api'
import { PATHS, CLASS_SPRITES, COMPOSITE_SPRITES, ANIMATED_SWORD_FRAMES } from './config/paths'
import { getItem, getItemDef, marketItems, marketPrice, isQuestItem } from './game/items/registry'
import { placeHeld, dropHeld, returnHeld, makeIsStackable, slotId, parseSlotId, sameSlot } from './lib/inventoryDrag'
import AnimatedSprite from './components/AnimatedSprite'
import PhaserGame from './components/PhaserGame'
import { eventBus, GameEvents } from './lib/eventBus'
import { speakNpcDialogue, cancelNpcSpeech } from './lib/dialogueAudio'
import {
  preloadSceneAudio,
  setSfxVolume,
} from './game/MainGameScene'
import { session } from './game/session'
import { CLASS_HP, CLASS_SPEED } from './game/combat/balance'
import { SCENE_HINTS } from './game/sceneCatalog'
import ControlsMenu, { ControlsHint } from './components/ControlsMenu'
import ClassSelect from './components/ClassSelect'
import FieldGuide from './components/FieldGuide'

// Simple top-down RPG prototype with two scenes: Village and Tavern

const ASSETS = {
  // Title background image (place in client/public/images)
  titleBg: PATHS.titleBg,
  // Title logo image (with spaces in filename)
  titleLogo: PATHS.titleLogo,
}

const LEAVE_PROMPT = `You are the gruff bartender of the Hollowvale Tavern. The traveler has asked many questions and you tire of them. Tell them to leave, in character.`

export default function Game() {
  const keysRef = useRef({})
  const musicRef = useRef(null)
  // Separate audio elements for ambient scene music (village/path/title), tavern ambience, and fight music
  const tavernMusicRef = useRef(null)
  const fightMusicRef = useRef(null)
  const vendorAudioRef = useRef(null)
  const sceneRef = useRef('village') // 'village' | 'tavern'
  const [ready, setReady] = useState(false)
  const [loadSlow, setLoadSlow] = useState(false)
  const [scene, setScene] = useState('village')
  // Title and options overlays
  const [titleOpen, setTitleOpen] = useState(true)
  const titleOpenRef = useRef(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsOpenRef = useRef(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const controlsOpenRef = useRef(false)
  const [fieldGuideOpen, setFieldGuideOpen] = useState(false)
  const fieldGuideOpenRef = useRef(false)
  // Market/shop overlay
  const [shopOpen, setShopOpen] = useState(false)
  const shopOpenRef = useRef(false)
  const [shopCategory, setShopCategory] = useState('Potions')
  // Class selection overlay (opens after Start Game)
  const [classSelectOpen, setClassSelectOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  // Live ref for selectedClass so key handlers see the latest value
  const selectedClassRef = useRef(null)

  // Chat overlay state (bartender)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([]) // {role:'user'|'assistant', content}
  const [chatLoading, setChatLoading] = useState(false)
  const [chatTurns, setChatTurns] = useState(0) // count user->assistant exchanges
  const [chatInput, setChatInput] = useState('')
  const chatScrollRef = useRef(null)
  const chatInputRef = useRef(null)
  const chatDialogRef = useRef(null)
  const chatReturnFocusRef = useRef(null)
  const [chatMode, setChatMode] = useState('topics') // 'topics' | 'free'
  // Live refs for overlay states so the game loop sees latest values
  const chatOpenRef = useRef(false)
  const classSelectOpenRef = useRef(false)
  const inventoryOpenRef = useRef(false)
  // Audio Options
  // Master music volume and per-track volumes (0-100), persisted
  const [masterVolume, setMasterVolume] = useState(() => {
    const v = Number(localStorage.getItem('masterVolume') ?? localStorage.getItem('volume') ?? 50)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50
  })
  const [musicVillageVol, setMusicVillageVol] = useState(() => {
    const v = Number(localStorage.getItem('musicVillageVol') ?? 100)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 100
  })
  const [musicTavernVol, setMusicTavernVol] = useState(() => {
    // Default lower for ambience by design
    const v = Number(localStorage.getItem('musicTavernVol') ?? 35)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 35
  })
  const [musicFightVol, setMusicFightVol] = useState(() => {
    const v = Number(localStorage.getItem('musicFightVol') ?? 85)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 85
  })
  // Toggle for bartender speech (TTS)
  const [ttsEnabled, setTtsEnabled] = useState(() => (localStorage.getItem('ttsEnabled') ?? 'true') !== 'false')
  // Separate volume for bartender voice (TTS)
  const [ttsVolume, setTtsVolume] = useState(() => {
    const sv = Number(localStorage.getItem('ttsVolume'))
    if (Number.isFinite(sv)) return Math.max(0, Math.min(100, sv))
    const base = Number(localStorage.getItem('masterVolume'))
    return Number.isFinite(base) ? Math.max(0, Math.min(100, base)) : 50
  })
  // SFX volume (footsteps, doors, combat) — independent of NPC voice
  const [sfxVolume, setSfxVolumeState] = useState(() => {
    const v = Number(localStorage.getItem('sfxVolume') ?? 70)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 70
  })
  const ttsEnabledRef = useRef(true)
  const ttsVolumeRef = useRef(50)
  // Global mute-all toggle for music (does not affect NPC voices)
  const [muteAllMusic, setMuteAllMusic] = useState(() => (localStorage.getItem('muteAllMusic') ?? 'false') === 'true')
  // Inventory
  const [inventoryOpen, setInventoryOpen] = useState(false)
  // inventory shape: { armor:{head,chest,legs,boots,offhand}, storage: Item[27], hotbar: Item[9] }
  const [inventory, setInventory] = useState({
    armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
    storage: Array(27).fill(null),
    hotbar: Array(9).fill(null),
  })
  // Live ref for inventory so key handlers see the latest value
  const inventoryRef = useRef({
    armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
    storage: Array(27).fill(null),
    hotbar: Array(9).fill(null),
  })
  // Inventory drag state
  const [invDrag, setInvDrag] = useState(null) // { item:{id,count}, from:{ section:'armor'|'storage'|'hotbar', key:string|number } | null }
  // Refs mirror inventory and the held stack so window-level pointerup reads current values (DRAG-1).
  const invDragRef = useRef(null)
  const invPressRef = useRef(null) // { x, y, from } while a pointer press started a pickup
  const isStackableItem = useMemo(() => makeIsStackable(getItem), [])
  const [invMouse, setInvMouse] = useState({ x: 0, y: 0 })
  // Hotbar HUD state
  const [activeHotbar, setActiveHotbar] = useState(0) // 0..8 like Minecraft
  const activeHotbarRef = useRef(0)
  // Options toggles for hotbar behaviors
  const [allowFSwap, setAllowFSwap] = useState(() => (localStorage.getItem('allowFSwap') ?? 'true') !== 'false')
  const allowFSwapRef = useRef(allowFSwap)
  // Mage spellbook and spell selection
  const [spellWheelOpen, setSpellWheelOpen] = useState(false)
  const spellWheelOpenRef = useRef(false)
  useEffect(() => { spellWheelOpenRef.current = spellWheelOpen }, [spellWheelOpen])
  const MAGE_SPELLS = [
    { id: 'lightning', name: 'Lightning Bolt' },
    { id: 'shield', name: 'Mana Shield' },
    { id: 'blink', name: 'Blink' },
    { id: 'leech', name: 'Life Leech' },
  ]
  const mageSelectedSpellRef = useRef('lightning')
  const setMageSpell = (id) => {
    const found = MAGE_SPELLS.find(s => s.id === id)
    mageSelectedSpellRef.current = id
    session.spellId = id
    showNotice(`Selected ${found ? found.name : id}`)
  }
  // Game over overlay and killer info
  const [gameOver, setGameOver] = useState(false)
  const [vitals, setVitals] = useState({ hp: CLASS_HP.knight, hpMax: CLASS_HP.knight, mana: 0, manaMax: 0 })
  const [activePrompt, setActivePrompt] = useState('')
  const [abilityNow, setAbilityNow] = useState(0)
  const gameOverRef = useRef(false)
  const killerRef = useRef(null)
  const setPlayerImageAsync = (src) => {
    session.spriteUrl = src || ''
  }
  // HUD tooltip and selection label
  const [hudTip, setHudTip] = useState({ show: false, text: '', x: 0, y: 0 })
  const [hotbarLabel, setHotbarLabel] = useState({ text: '', show: false })
  const hotbarLabelTimerRef = useRef(null)
  // Sprites for chooseClass and the composite fallback. The calling screen copy lives in classIntro.js.
  const CLASSES = {
    knight: { id: 'knight', name: 'Knight', sprite: CLASS_SPRITES.knight },
    mage: { id: 'mage', name: 'Mage', sprite: CLASS_SPRITES.mage },
    thief: { id: 'thief', name: 'Thief', sprite: CLASS_SPRITES.thief },
    dwarf: { id: 'dwarf', name: 'Dwarf', sprite: CLASS_SPRITES.dwarf },
  }

  // Item catalog, market rows and prices all come from the item registry
  // (game/items/registry.js). Icons live at /images/<id>.png unless the registry says otherwise.
  const makeItem = (id, count = 1) => ({ id, count })

  // Market catalog: every registry item with a market category, in registry order.
  const MARKET_ITEMS = marketItems()

  function seedInventoryForClass(id) {
    const base = {
      armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
      storage: Array(27).fill(null),
      hotbar: Array(9).fill(null),
    }
    if (id === 'knight') {
      base.armor.chest = makeItem('chainmail_armor')
      base.armor.offhand = makeItem('wooden_shield')
      base.hotbar[0] = makeItem('iron_sword')
      base.hotbar[1] = makeItem('healing_potion', 1)
    } else if (id === 'mage') {
      base.armor.chest = makeItem('cloth_robes')
      base.hotbar[0] = makeItem('apprentice_staff')
      base.storage[0] = makeItem('spellbook')
      base.hotbar[1] = makeItem('mana_potion', 2)
    } else if (id === 'thief') {
      base.armor.chest = makeItem('leather_armor')
      base.hotbar[0] = makeItem('twin_daggers')
      base.storage[0] = makeItem('lockpicks')
      base.hotbar[1] = makeItem('poison_vial', 1)
    } else if (id === 'dwarf') {
      base.armor.chest = makeItem('dwarf_armor')
      base.hotbar[0] = makeItem('battle_axe')
      base.hotbar[1] = makeItem('dwarf_pickaxe')
      base.hotbar[2] = makeItem('ale_flask', 1)
    }
    // Start everyone with 2 of each gem (ruby/sapphire/emerald) in the HOTBAR, from the far right (end)
    const placeGemRightHotbar = (gid) => {
      // Try to stack onto an existing same-gem stack from right to left
      for (let i = base.hotbar.length - 1; i >= 0; i--) {
        const it = base.hotbar[i]
        if (it && it.id === gid) { base.hotbar[i] = { id: gid, count: (it.count || 1) + 2 }; return }
      }
      // Otherwise place in the first empty slot scanning right-to-left
      for (let i = base.hotbar.length - 1; i >= 0; i--) {
        if (!base.hotbar[i]) { base.hotbar[i] = makeItem(gid, 2); return }
      }
      // Fallback: if hotbar full, drop into the last empty storage slot scanning right-to-left
      for (let i = base.storage.length - 1; i >= 0; i--) {
        if (!base.storage[i]) { base.storage[i] = makeItem(gid, 2); return }
      }
    }
    placeGemRightHotbar('ruby')
    placeGemRightHotbar('sapphire')
    placeGemRightHotbar('emerald')
    return base
  }

  async function chooseClass(id) {
    const def = CLASSES[id]
    if (!def) return
    const speed = CLASS_SPEED[id] || CLASS_SPEED.knight
    const hp = CLASS_HP[id] || CLASS_HP.knight
    session.classId = id
    session.baseSpeed = speed
    session.spriteUrl = def.sprite
    session.hp = hp
    session.hpMax = hp
    session.manaMax = id === 'mage' ? 100 : 0
    session.mana = session.manaMax
    setVitals({ hp, hpMax: hp, mana: session.mana, manaMax: session.manaMax })
    setSelectedClass(id)
    setClassSelectOpen(false)
    setInventory(seedInventoryForClass(id))
  }

  // Map item IDs to sprite item tags for composite filenames (e.g., knightWithSword)
  const ITEM_SPRITE_TAGS = {
    iron_sword: 'Sword',
    wooden_shield: 'Shield',
    healing_potion: 'HealPotion',
    apprentice_staff: 'Staff',
    spellbook: 'Spellbook',
    mana_potion: 'ManaPotion',
    twin_daggers: 'Daggers',
    lockpicks: 'Lockpick',
    poison_vial: 'PoisonVial',
    battle_axe: 'Axe',
    dwarf_pickaxe: 'Pickaxe',
    ale_flask: 'Ale',
  }

  function deriveItemTagFromName(name) {
    if (!name) return null
    // Use last word (strip non-letters), e.g., "Iron Sword" -> "Sword"
    const parts = String(name).trim().split(/\s+/)
    let last = parts[parts.length - 1] || ''
    last = (last.match(/[A-Za-z]+/g) || [''])[0]
    if (!last) return null
    return last.charAt(0).toUpperCase() + last.slice(1)
  }

  // Helper to apply current composite/base sprite
  // Uses current state (not refs) to avoid order races on first hotbar switch
  const applyCurrentSprite = () => {
    const cls = selectedClass
    if (!cls) return
    const baseSprite = CLASSES[cls]?.sprite
    const main = inventory.hotbar[activeHotbar]
    const offhand = inventory.armor.offhand

    const setPlayerImage = (src) => setPlayerImageAsync(src)

    const compositeMap = COMPOSITE_SPRITES[cls] || {}

    if (!main) {
      // No main-hand item: prefer explicit EmptyHands mapping, else class base sprite
      const empty = compositeMap['EmptyHands']
      if (empty) setPlayerImage(empty)
      else if (baseSprite) setPlayerImage(baseSprite)
      return
    }

  const itemTag = ITEM_SPRITE_TAGS[main.id] || deriveItemTagFromName(getItemDef(main.id)?.name)
    if (!itemTag) {
      if (baseSprite) setPlayerImage(baseSprite)
      return
    }

    // Knight special-case: sword in main + shield in offhand -> combined sprite
    if (cls === 'knight') {
      const mainIsSword = ITEM_SPRITE_TAGS[main.id] === 'Sword' || main.id === 'iron_sword'
      const offIsShield = offhand && (ITEM_SPRITE_TAGS[offhand.id] === 'Shield' || offhand.id === 'wooden_shield')
      if (mainIsSword && offIsShield && compositeMap['ShieldAndSword']) {
        setPlayerImage(compositeMap['ShieldAndSword'])
        return
      }
    }

    const composite = compositeMap[itemTag]
    if (composite) {
      setPlayerImage(composite)
    } else {
      // No explicit mapping — fall back to base class sprite
      if (baseSprite) setPlayerImage(baseSprite)
    }
  }

  // Apply sprite for a specific inventory snapshot (ignores attack-pose update guard)
  const applySpriteForSnapshot = (invSnap) => {
    const cls = selectedClassRef.current
    if (!cls) return
    const baseSprite = CLASSES[cls]?.sprite
    const main = invSnap?.hotbar?.[activeHotbarRef.current] || null
    const offhand = invSnap?.armor?.offhand || null

    const compositeMap = COMPOSITE_SPRITES[cls] || {}
    const setPlayerImage = (src) => setPlayerImageAsync(src)

    if (!main) {
      const empty = compositeMap['EmptyHands']
      if (empty) setPlayerImage(empty)
      else if (baseSprite) setPlayerImage(baseSprite)
      return
    }

    const itemTag = ITEM_SPRITE_TAGS[main.id] || deriveItemTagFromName(getItemDef(main.id)?.name)
    if (!itemTag) { if (baseSprite) setPlayerImage(baseSprite); return }

    // Knight combined case
    if (cls === 'knight') {
      const mainIsSword = ITEM_SPRITE_TAGS[main.id] === 'Sword' || main.id === 'iron_sword'
      const offIsShield = offhand && (ITEM_SPRITE_TAGS[offhand.id] === 'Shield' || offhand.id === 'wooden_shield')
      if (mainIsSword && offIsShield && compositeMap['ShieldAndSword']) {
        setPlayerImage(compositeMap['ShieldAndSword'])
        return
      }
    }

    const composite = compositeMap[itemTag]
    if (composite) setPlayerImage(composite)
    else if (baseSprite) setPlayerImage(baseSprite)
  }

  // Push the equipped item and composite sprite into the Phaser session.
  useEffect(() => {
    const it = inventory.hotbar[activeHotbar]
    session.equippedId = it ? it.id : null
    session.hotbarSlot = activeHotbar
    applyCurrentSprite()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, activeHotbar, inventory.hotbar[activeHotbar]?.id, inventory.armor.offhand?.id])

  // ----- Inventory helpers -----
  const getSlot = (inv, section, key) => {
    if (section === 'armor') return inv.armor[key]
    if (section === 'storage') return inv.storage[key]
    if (section === 'hotbar') return inv.hotbar[key]
    return null
  }
  const setSlot = (inv, section, key, value) => {
    const next = {
      armor: { ...inv.armor },
      storage: inv.storage.slice(),
      hotbar: inv.hotbar.slice(),
    }
    if (section === 'armor') next.armor[key] = value
    if (section === 'storage') next.storage[key] = value
    if (section === 'hotbar') next.hotbar[key] = value
    return next
  }
  const sameItem = (a, b) => !!a && !!b && a.id === b.id

  // ----- Loot/Chest helpers -----
  // Track which treasure chests are opened (same order as scenes.treasureRoom.treasureChests)
  const treasureOpenedRef = useRef(new Set())
  const [, setTreasureOpenedTick] = useState(0)
  const isChestOpened = (idx) => treasureOpenedRef.current.has(idx)
  const markChestOpened = (idx) => {
    if (treasureOpenedRef.current.has(idx)) return
    treasureOpenedRef.current.add(idx)
    setTreasureOpenedTick((t) => (t + 1) % 1000000)
  }

  // Game notices (short on-screen messages)
  const [notice, setNotice] = useState({ show: false, text: '' })
  const noticeTimerRef = useRef(null)
  const showNotice = (text, ms = 1800) => {
    setNotice({ show: true, text })
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice({ show: false, text: '' }), ms)
  }

  // Search/consume/add inventory helpers
  const findFirstItem = (inv, id) => {
    for (let i = 0; i < inv.storage.length; i++) {
      const it = inv.storage[i]; if (it && it.id === id) return { section: 'storage', key: i, item: it }
    }
    for (let i = 0; i < inv.hotbar.length; i++) {
      const it = inv.hotbar[i]; if (it && it.id === id) return { section: 'hotbar', key: i, item: it }
    }
    for (const key of Object.keys(inv.armor)) {
      const it = inv.armor[key]; if (it && it.id === id) return { section: 'armor', key, item: it }
    }
    return null
  }

  const consumeOneItem = (inv, id) => {
    const loc = findFirstItem(inv, id)
    if (!loc) return { next: inv, consumed: false }
    const cur = getSlot(inv, loc.section, loc.key)
    const cnt = (cur.count || 1) - 1
    const next = setSlot(inv, loc.section, loc.key, cnt > 0 ? { id: cur.id, count: cnt } : null)
    return { next, consumed: true }
  }

  const addItemAnywhere = (inv, id, count, { preferHotbar = false } = {}) => {
    if (!count || count <= 0) return { next: inv, remaining: 0 }
    let remaining = count
    let next = { armor: { ...inv.armor }, storage: inv.storage.slice(), hotbar: inv.hotbar.slice() }

    const sections = preferHotbar
      ? ['hotbar', 'storage']
      : ['storage', 'hotbar']

    // Merge into existing stacks
    for (const section of sections) {
      const target = section === 'storage' ? next.storage : next.hotbar
      for (let i = 0; i < target.length && remaining > 0; i++) {
        const it = target[i]
        if (it && it.id === id) {
          target[i] = { id, count: (it.count || 1) + 1 }
          remaining--
        }
      }
    }

    // Place into empty slots
    for (const section of sections) {
      const target = section === 'storage' ? next.storage : next.hotbar
      for (let i = 0; i < target.length && remaining > 0; i++) {
        if (!target[i]) {
          target[i] = { id, count: 1 }
          remaining--
        }
      }
    }

    return { next, remaining }
  }

  const grantLoot = (gemCounts = {}, items = []) => {
    const overflow = []
    setInventory((inv) => {
      let next = {
        armor: { ...inv.armor },
        storage: inv.storage.slice(),
        hotbar: inv.hotbar.slice(),
      }

      const placeUnits = (id, amount) => {
        const preferHotbar = !gemIds.includes(id)
        let remaining = Number(amount) || 0
        while (remaining > 0) {
          const res = addItemAnywhere(next, id, 1, { preferHotbar })
          next = res.next
          if (res.remaining > 0) {
            overflow.push({ id, count: remaining })
            break
          }
          remaining -= 1
        }
      }

      Object.entries(gemCounts || {}).forEach(([id, count]) => {
        if (count) placeUnits(id, count)
      })

      for (const item of items || []) {
        if (!item?.id) continue
        const pref = { preferHotbar: true }
        let remaining = Number(item.count || 1)
        while (remaining > 0) {
          const res = addItemAnywhere(next, item.id, 1, pref)
          next = res.next
          if (res.remaining > 0) {
            overflow.push({ id: item.id, count: remaining })
            break
          }
          remaining -= 1
        }
      }

      return next
    })
    return overflow
  }

  const addGemsToInventory = (counts) => {
    const overflow = grantLoot(counts, [])
    if (overflow.some(({ id }) => gemIds.includes(id))) {
      showNotice('Your packs are full. Some gems could not be taken.')
    }
  }

  const rollGemLoot = () => {
    const ri = (a,b)=> Math.floor(Math.random()*(b-a+1))+a
    let total = ri(2,9)
    if (Math.random() < 0.03) total = 10
    const kinds = ['ruby','sapphire','emerald']
    const counts = { ruby:0, sapphire:0, emerald:0 }
    for (let i=0;i<total;i++) counts[kinds[ri(0,2)]]++
    return counts
  }

  const openChest = (index, locked) => {
    if (locked) {
      const res = consumeOneItem(inventoryRef.current, 'lockpicks')
      if (!res.consumed) {
        showNotice('Locked. Requires lockpicks.')
        return false
      }
      setInventory(res.next)
      inventoryRef.current = res.next
    }
    const loot = rollGemLoot()
    if (locked) {
      loot.ruby += 8
      loot.sapphire += 8
      loot.emerald += 8
    }
    const potionRewards = locked
      ? [
          { id: 'healing_potion', count: 1 },
          { id: 'poison_vial', count: 1 },
          { id: 'speed_potion', count: 1 },
        ]
      : []
    const overflow = grantLoot(loot, potionRewards)
    const gemParts = []
    if (loot.ruby) gemParts.push(`${loot.ruby} Rub${loot.ruby > 1 ? 'ies' : 'y'}`)
    if (loot.sapphire) gemParts.push(`${loot.sapphire} Sapphire${loot.sapphire > 1 ? 's' : ''}`)
    if (loot.emerald) gemParts.push(`${loot.emerald} Emerald${loot.emerald > 1 ? 's' : ''}`)
    const overflowNames = overflow.map(({ id, count }) => `${count}x ${getItemDef(id).name}`)
    if (locked) {
      const potionNames = potionRewards.map((p) => getItemDef(p.id).name)
      const segments = []
      if (gemParts.length) segments.push(gemParts.join(', '))
      segments.push(`potions (${potionNames.join(', ')})`)
      let message = `You picked the lock! Loot: ${segments.join(' + ')}`
      if (overflowNames.length) message += `. No space for ${overflowNames.join(', ')}`
      showNotice(message)
    } else {
      let message = gemParts.length ? `You found ${gemParts.join(', ')}!` : 'The chest was empty...'
      if (overflowNames.length) message += ` No space for ${overflowNames.join(', ')}`
      showNotice(message)
    }
    void index
    return true
  }

  // ----- Market helpers: gem accounting and purchasing -----
  const gemIds = ['ruby','sapphire','emerald']
  const getGemTotals = (inv) => {
    const totals = { ruby: 0, sapphire: 0, emerald: 0 }
    const add = (it) => { if (!it) return; if (totals[it.id] !== undefined) totals[it.id] += (it.count || 1) }
    Object.values(inv.armor).forEach(add)
    inv.storage.forEach(add)
    inv.hotbar.forEach(add)
    return totals
  }
  const canAfford = (inv, cost) => {
    const t = getGemTotals(inv)
    return (t.ruby >= (cost.ruby||0)) && (t.sapphire >= (cost.sapphire||0)) && (t.emerald >= (cost.emerald||0))
  }
  const removeItemsById = (inv, id, count) => {
    if (!count || count <= 0) return inv
    let need = count
    let next = { armor: { ...inv.armor }, storage: inv.storage.slice(), hotbar: inv.hotbar.slice() }
    const takeFrom = (section, key) => {
      if (need <= 0) return
      const cur = getSlot(next, section, key)
      if (!cur || cur.id !== id) return
      const can = Math.min(need, cur.count || 1)
      const left = (cur.count || 1) - can
      next = setSlot(next, section, key, left > 0 ? { id, count: left } : null)
      need -= can
    }
    // Prefer storage then hotbar then armor, but order doesn't matter much
    for (let i=0;i<next.storage.length && need>0;i++) takeFrom('storage', i)
    for (let i=0;i<next.hotbar.length && need>0;i++) takeFrom('hotbar', i)
    for (const k of Object.keys(next.armor)) { if (need>0) takeFrom('armor', k) }
    return next
  }
  const spendGems = (inv, cost) => {
    let next = inv
    for (const gid of gemIds) {
      const n = cost[gid] || 0
      if (n > 0) next = removeItemsById(next, gid, n)
    }
    return next
  }
  const hasSpaceForItem = (inv, id) => {
    // merge into existing stack
    for (let i=0;i<inv.storage.length;i++){ const it=inv.storage[i]; if (it && it.id===id) return true }
    for (let i=0;i<inv.hotbar.length;i++){ const it=inv.hotbar[i]; if (it && it.id===id) return true }
    // or any empty slot
    if (inv.storage.some(it=>!it)) return true
    if (inv.hotbar.some(it=>!it)) return true
    return false
  }

  // Market purchase handler
  const tryBuy = (id) => {
    const price = marketPrice(id)
    markVendorActivity()
    setInventory((inv) => {
      if (!canAfford(inv, price)) { showNotice('Not enough gems.'); playVendor('NotEnoughMoney'); return inv }
      if (!hasSpaceForItem(inv, id)) { showNotice('No space in packs.'); return inv }
      const afterSpend = spendGems(inv, price)
      const res = addItemAnywhere(afterSpend, id, 1, { preferHotbar: true })
      if (res.remaining > 0) { showNotice('No space in packs.'); return inv }
      showNotice(`Bought ${getItemDef(id).name}.`)
      // Good choice line (if none currently playing)
      playVendor('GoodChoice')
      return res.next
    })
  }

  // Commit an inventory and held-stack change together and keep the refs current.
  const commitInventory = (nextInv, heldItem, from) => {
    inventoryRef.current = nextInv
    setInventory(nextInv)
    const nextHeld = heldItem ? { item: heldItem, from } : null
    invDragRef.current = nextHeld
    setInvDrag(nextHeld)
  }

  // Pointer down: pick up from a slot, or (already holding) place the held stack there.
  const handleSlotPointerDown = (e, section, key) => {
    if (e.button !== 0) return
    e.preventDefault()
    const inv = inventoryRef.current || inventory
    const held = invDragRef.current
    const ref = { section, key }
    if (held && held.item) {
      // Click-to-place: the displaced item (if any) stays on the cursor.
      invPressRef.current = null
      const res = placeHeld(inv, held.item, held.from, ref, { isStackable: isStackableItem, swapTo: 'hold' })
      commitInventory(res.inventory, res.held, held.from)
      return
    }
    const it = getSlot(inv, section, key)
    if (!it) return
    invPressRef.current = { x: e.clientX, y: e.clientY, from: ref }
    commitInventory(setSlot(inv, section, key, null), it, ref)
  }

  // Pointer up (window-level, so it fires even outside the panel): finish a drag.
  const finishInventoryDrag = (e, cancelled) => {
    const press = invPressRef.current
    if (!press) return
    invPressRef.current = null
    const held = invDragRef.current
    if (!held || !held.item) return
    const inv = inventoryRef.current
    if (!inv) return
    let target = null
    if (!cancelled) {
      const el = typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY) : null
      const slotEl = el && el.closest ? el.closest('[data-inv-slot]') : null
      target = slotEl ? parseSlotId(slotEl.getAttribute('data-inv-slot')) : null
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4
      // A plain click on the origin slot keeps the stack on the cursor for click-to-place.
      if (!moved && (!target || sameSlot(target, press.from))) return
    }
    const res = dropHeld(inv, held.item, held.from, target, { isStackable: isStackableItem })
    commitInventory(res.inventory, res.held, held.from)
  }

  const handleSlotContextMenu = (e, section, key) => {
    e.preventDefault()
    setInventory((inv) => {
      // If dragging: place one item into target if empty or same id
      if (invDrag && invDrag.item) {
        const target = getSlot(inv, section, key)
        const di = invDrag.item
        // place one
        if (!target) {
          const placed = setSlot(inv, section, key, { id: di.id, count: 1 })
          const remain = { id: di.id, count: (di.count || 1) - 1 }
          setInvDrag(remain.count > 0 ? { item: remain, from: invDrag.from } : null)
          return placed
        }
        if (sameItem(target, di)) {
          const placed = setSlot(inv, section, key, { id: di.id, count: (target.count || 0) + 1 })
          const remain = { id: di.id, count: (di.count || 1) - 1 }
          setInvDrag(remain.count > 0 ? { item: remain, from: invDrag.from } : null)
          return placed
        }
        return inv
      }
      // Not dragging: split half from this stack
      const target = getSlot(inv, section, key)
      if (!target || (target.count || 1) <= 1) return inv
      const take = Math.ceil((target.count || 2) / 2)
      const left = (target.count || 2) - take
      const next = setSlot(inv, section, key, left > 0 ? { id: target.id, count: left } : null)
      setInvDrag({ item: { id: target.id, count: take }, from: { section, key } })
      return next
    })
  }

  const handleInventoryMouseMove = (e) => {
    setInvMouse({ x: e.clientX, y: e.clientY })
  }

  // Totals of each item id across entire inventory (armor + storage + hotbar)
  const inventoryTotals = useMemo(() => {
    const totals = {}
    const add = (it) => { if (!it) return; totals[it.id] = (totals[it.id] || 0) + (it.count || 1) }
    // Armor
    Object.values(inventory.armor).forEach(add)
    // Storage and Hotbar
    inventory.storage.forEach(add)
    inventory.hotbar.forEach(add)
    return totals
  }, [inventory])

  // Place dragged stack back into inventory (used when closing)
  const returnDraggedToInventory = () => {
    const held = invDragRef.current
    if (!held?.item) return
    invPressRef.current = null
    const res = returnHeld(inventoryRef.current || inventory, held.item, held.from, { isStackable: isStackableItem })
    commitInventory(res.inventory, res.held, held.from)
  }

  const closeInventory = () => {
    returnDraggedToInventory()
    setInventoryOpen(false)
  }

  // Keep overlay refs in sync with state
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])
  useEffect(() => { classSelectOpenRef.current = classSelectOpen }, [classSelectOpen])
  useEffect(() => { inventoryOpenRef.current = inventoryOpen }, [inventoryOpen])
  useEffect(() => { activeHotbarRef.current = activeHotbar }, [activeHotbar])
  useEffect(() => { titleOpenRef.current = titleOpen }, [titleOpen])
  useEffect(() => { optionsOpenRef.current = optionsOpen }, [optionsOpen])
  useEffect(() => { controlsOpenRef.current = controlsOpen }, [controlsOpen])
  useEffect(() => { fieldGuideOpenRef.current = fieldGuideOpen }, [fieldGuideOpen])
  useEffect(() => {
    if (titleOpen || classSelectOpen) setControlsOpen(false)
  }, [titleOpen, classSelectOpen])
  useEffect(() => { shopOpenRef.current = shopOpen }, [shopOpen])
  useEffect(() => { localStorage.setItem('masterVolume', String(masterVolume)) }, [masterVolume])
  useEffect(() => { localStorage.setItem('musicVillageVol', String(musicVillageVol)) }, [musicVillageVol])
  useEffect(() => { localStorage.setItem('musicTavernVol', String(musicTavernVol)) }, [musicTavernVol])
  useEffect(() => { localStorage.setItem('musicFightVol', String(musicFightVol)) }, [musicFightVol])
  useEffect(() => { localStorage.setItem('ttsEnabled', String(ttsEnabled)) }, [ttsEnabled])
  useEffect(() => { localStorage.setItem('ttsVolume', String(ttsVolume)) }, [ttsVolume])
  useEffect(() => { localStorage.setItem('sfxVolume', String(sfxVolume)) }, [sfxVolume])
  useEffect(() => { localStorage.setItem('allowFSwap', String(allowFSwap)) }, [allowFSwap])
  useEffect(() => { localStorage.setItem('muteAllMusic', String(muteAllMusic)) }, [muteAllMusic])
  useEffect(() => { allowFSwapRef.current = allowFSwap }, [allowFSwap])
  useEffect(() => { ttsEnabledRef.current = ttsEnabled }, [ttsEnabled])
  useEffect(() => { ttsVolumeRef.current = ttsVolume }, [ttsVolume])
  useEffect(() => { setSfxVolume(Math.max(0, Math.min(1, sfxVolume / 100))) }, [sfxVolume])
  // Keep selectedClass/inventory refs in sync for non-reactive event handlers
  useEffect(() => { selectedClassRef.current = selectedClass }, [selectedClass])
  useEffect(() => { inventoryRef.current = inventory }, [inventory])
  useEffect(() => { invDragRef.current = invDrag }, [invDrag])

  // EventBus: NPC interact → open dialogue; npc:speak → stream ElevenLabs TTS via Web Audio
  useEffect(() => {
    const BARTENDER_GREETING =
      "Tharos: Hrm. Traveler. Dragon business or town history—what'll it be? If you're short on supplies, swing by the Market after this—head to the upper-left gate in the village and press E to browse wares."

    const onInteract = ({ npc, greeting } = {}) => {
      if (npc && npc !== 'bartender') return
      const line = greeting || BARTENDER_GREETING
      setChatOpen(true)
      setChatMessages([{ role: 'assistant', content: line }])
      setChatTurns(0)
      setChatInput('')
      setChatMode('topics')
      setChatTopic(null)
      // Kick off streamed greeting TTS when voice is enabled
      if (ttsEnabledRef.current) {
        const speakText = line.replace(/^Tharos:\s*/i, '')
        eventBus.emit(GameEvents.NPC_SPEAK, { npc: 'bartender', text: speakText })
      }
    }

    const onSpeak = ({ text, turnId } = {}) => {
      if ((!text && !turnId) || !ttsEnabledRef.current) return
      const vol = Math.max(0, Math.min(1, (ttsVolumeRef.current || 100) / 100))
      speakNpcDialogue(text, { volume: vol, enabled: true, turnId }).catch(() => {})
    }

    const onClose = () => {
      cancelNpcSpeech()
    }

    const offInteract = eventBus.on(GameEvents.NPC_INTERACT, onInteract)
    const offSpeak = eventBus.on(GameEvents.NPC_SPEAK, onSpeak)
    const offClose = eventBus.on(GameEvents.CHAT_CLOSE, onClose)
    return () => {
      offInteract()
      offSpeak()
      offClose()
      cancelNpcSpeech()
    }
  }, [])

  // Stop TTS when the chat overlay closes
  useEffect(() => {
    if (!chatOpen) {
      eventBus.emit(GameEvents.CHAT_CLOSE)
    }
  }, [chatOpen])

  // ----- Vendor voice lines (market) -----
  const VENDOR_AUDIO_BASE = '/audio/vendor'
  const VENDOR_LINES = {
    Greeting: ['Greeting1.mp3','Greeting2.mp3','Greeting3.mp3'],
    GoodChoice: ['GoodChoice1.mp3','GoodChoice2.mp3','GoodChoice3.mp3'],
    NotEnoughMoney: ['NotEnoughMoney1.mp3','NotEnoughMoney2.mp3','NotEnoughMoney3.mp3'],
    Farewell: ['Farewell1.mp3','Farewell2.mp3'],
    SpeedUp: ['SpeedUp1.mp3','SpeedUp2.mp3'],
  }
  // Remember last variant used per category to avoid repeats
  const vendorLastRef = useRef({}) // { [category: string]: string }
  const vendorChooseVariant = (category) => {
    const arr = VENDOR_LINES[category]
    if (!arr || arr.length === 0) return null
    const last = vendorLastRef.current[category]
    const candidates = arr.filter((f) => f !== last)
    const pool = candidates.length > 0 ? candidates : arr
    const choice = pool[Math.floor(Math.random() * pool.length)]
    vendorLastRef.current[category] = choice
    return choice
  }
  const isVendorPlaying = () => {
    const a = vendorAudioRef.current
    return !!(a && !a.paused && !a.ended)
  }
  const playVendor = (category) => {
    try {
      if (!VENDOR_LINES[category] || VENDOR_LINES[category].length === 0) return
      if (isVendorPlaying()) return // no overlap
      let a = vendorAudioRef.current
      if (!a) {
        a = new Audio()
        a.preload = 'auto'
        vendorAudioRef.current = a
      }
      a.volume = Math.max(0, Math.min(1, ttsVolume / 100))
      const file = vendorChooseVariant(category)
      if (!file) return
      a.src = `${VENDOR_AUDIO_BASE}/${file}`
      // Fire and forget; if blocked, skip silently
      const p = a.play()
      if (p && typeof p.then === 'function') p.catch(()=>{
        // If autoplay is blocked, retry on next pointerdown once
        const unlock = () => {
          a.play().finally(() => document.removeEventListener('pointerdown', unlock))
        }
        document.addEventListener('pointerdown', unlock, { once: true })
      })
    } catch {}
  }
  const closeShop = () => { try { playVendor('Farewell') } catch {}; setShopOpen(false) }
  // Keep vendor volume in sync with TTS volume slider
  useEffect(() => {
    const a = vendorAudioRef.current
    if (a) a.volume = Math.max(0, Math.min(1, ttsVolume / 100))
  }, [ttsVolume])

  // Music helpers
  // Existing main music (title + village + path)
  const ensureMusic = () => {
    if (!musicRef.current) {
      try {
        const a = new Audio(PATHS.introVillageMusic)
        a.loop = true
        a.preload = 'auto'
        a.volume = Math.max(0, Math.min(1, (masterVolume / 100) * (musicVillageVol / 100)))
        a.addEventListener('error', () => {
          console.warn('[Audio] Failed to load:', PATHS.introVillageMusic)
        }, { once: true })
        musicRef.current = a
      } catch (e) {
        // Some environments may not allow constructing Audio; fail gracefully
        musicRef.current = null
      }
    }
    return musicRef.current
  }

  // Tavern ambience (low volume loop)
  const ensureTavernMusic = () => {
    if (!tavernMusicRef.current) {
      try {
        const a = new Audio(PATHS.tavernBackgroundMusic)
        a.loop = true
        a.preload = 'auto'
        a.volume = 0 // will fade in
        a.addEventListener('error', () => {
          console.warn('[Audio] Failed to load tavernBackgroundMusic:', PATHS.tavernBackgroundMusic)
        }, { once: true })
        tavernMusicRef.current = a
      } catch (e) {
        tavernMusicRef.current = null
      }
    }
    return tavernMusicRef.current
  }

  // Dungeon interior fight music
  const ensureFightMusic = () => {
    if (!fightMusicRef.current) {
      try {
        const a = new Audio(PATHS.fightMusic1)
        a.loop = true
        a.preload = 'auto'
        a.volume = 0 // will fade in
        a.addEventListener('error', () => {
          console.warn('[Audio] Failed to load fightMusic1:', PATHS.fightMusic1)
        }, { once: true })
        fightMusicRef.current = a
      } catch (e) {
        fightMusicRef.current = null
      }
    }
    return fightMusicRef.current
  }

  // Compute effective volume for a track with master multiplier
  const trackLevel = (track) => {
    if (muteAllMusic) return 0
    const m = Math.max(0, Math.min(1, masterVolume / 100))
    let t = 1
    if (track === 'village') t = Math.max(0, Math.min(1, musicVillageVol / 100))
    else if (track === 'tavern') t = Math.max(0, Math.min(1, musicTavernVol / 100))
    else if (track === 'fight') t = Math.max(0, Math.min(1, musicFightVol / 100))
    return Math.max(0, Math.min(1, m * t))
  }

  // Generic fade utility
  const fadeAudio = (audio, targetVol, ms = 600) => {
    if (!audio) return
    const start = audio.volume
    const end = Math.max(0, Math.min(1, targetVol))
    const startTime = performance.now()
    const step = () => {
      const t = (performance.now() - startTime) / ms
      const frac = Math.max(0, Math.min(1, t))
      const v = start + (end - start) * frac
      audio.volume = v
      if (frac < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // Safely play with autoplay unlock fallback
  const playWithUnlock = (audio) => {
    if (!audio) return
    try {
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.catch(() => {
          const unlock = () => {
            audio.play().finally(() => document.removeEventListener('pointerdown', unlock))
          }
            document.addEventListener('pointerdown', unlock, { once: true })
        })
      }
    } catch {}
  }

  // Scene-based music controller
  useEffect(() => {
    const main = ensureMusic()
    if (main) main.volume = trackLevel('village')
    const tavern = ensureTavernMusic()
    const fight = ensureFightMusic()

    const inTavern = scene === 'tavern'
    const inFight = scene === 'dungeonInterior'
    const showTitle = titleOpen
    const inVillageOrPath = scene === 'village' || scene === 'path' || scene === 'wilderness'

    // Main music active on title, village, path (not inside tavern or fight scene)
    if (showTitle || inVillageOrPath) {
      if (main) {
        playWithUnlock(main)
        fadeAudio(main, trackLevel('village'), 700)
      }
    } else {
      if (main) fadeAudio(main, 0, 500)
      setTimeout(() => { try { main?.pause() } catch {} }, 520)
    }

    // Fight music only in dungeon interior
    if (inFight) {
      if (fight) {
        playWithUnlock(fight)
        fadeAudio(fight, trackLevel('fight'), 800)
      }
    } else {
      if (fight && !inFight) fadeAudio(fight, 0, 500)
      setTimeout(() => { if (fight && !inFight) { try { fight.pause() } catch {} } }, 520)
    }

    // Tavern ambience only inside tavern AND only when chat not open
    if (inTavern && !chatOpenRef.current) {
      if (tavern) {
        playWithUnlock(tavern)
        fadeAudio(tavern, trackLevel('tavern'), 600)
      }
    } else {
      if (tavern) fadeAudio(tavern, 0, 400)
      setTimeout(() => { if (tavern && tavern.volume === 0) { try { tavern.pause() } catch {} } }, 420)
    }
  }, [titleOpen, scene, masterVolume, musicVillageVol, musicTavernVol, musicFightVol, muteAllMusic])

  // Pause tavern ambience when bartender chat opens; resume on close if still in tavern
  useEffect(() => {
    const tavern = ensureTavernMusic()
    if (!tavern) return
    if (scene === 'tavern') {
      if (chatOpen) {
        fadeAudio(tavern, 0, 400)
        setTimeout(() => { if (tavern.volume === 0) { try { tavern.pause() } catch {} } }, 420)
      } else {
        playWithUnlock(tavern)
        // Use computed track level (master * per-track) instead of removed 'volume' state
        fadeAudio(tavern, trackLevel('tavern'), 600)
      }
    }
  }, [chatOpen, scene, masterVolume, musicTavernVol, muteAllMusic])

  // Play vendor greeting when entering the Market scene
  useEffect(() => {
      if (scene === 'market') {
      // Entering market is user initiated (E), so playback should be allowed
      playVendor('Greeting')
    }
  }, [scene])

  // Keep music volumes in sync with option sliders
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = trackLevel('village')
    if (tavernMusicRef.current) tavernMusicRef.current.volume = (scene === 'tavern' && !chatOpenRef.current) ? trackLevel('tavern') : tavernMusicRef.current.volume
    if (fightMusicRef.current) fightMusicRef.current.volume = (scene === 'dungeonInterior') ? trackLevel('fight') : fightMusicRef.current.volume
  }, [masterVolume, musicVillageVol, musicTavernVol, musicFightVol, scene, muteAllMusic])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (musicRef.current) {
        try { musicRef.current.pause() } catch {}
        musicRef.current.src = ''
        musicRef.current = null
      }
      if (tavernMusicRef.current) {
        try { tavernMusicRef.current.pause() } catch {}
        tavernMusicRef.current.src = ''
        tavernMusicRef.current = null
      }
      if (fightMusicRef.current) {
        try { fightMusicRef.current.pause() } catch {}
        fightMusicRef.current.src = ''
        fightMusicRef.current = null
      }
    }
  }, [])

  // Global mousemove for drag ghost and HUD tooltips
  useEffect(() => {
    const onMove = (e) => {
      setInvMouse({ x: e.clientX, y: e.clientY })
      if (hudTip.show) {
        setHudTip((t) => ({ ...t, x: e.clientX + 8, y: e.clientY + 8 }))
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [hudTip.show])

  // Drag drop completes on pointerup anywhere in the window (DRAG-1).
  useEffect(() => {
    const onUp = (e) => finishInventoryDrag(e, false)
    const onCancel = (e) => finishInventoryDrag(e, true)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    // finishInventoryDrag only reads refs and stable helpers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track inactivity in the shop to trigger SpeedUp vendor lines
  const lastVendorActivityRef = useRef(Date.now())
  const markVendorActivity = () => { lastVendorActivityRef.current = Date.now() }
  useEffect(() => {
    if (!shopOpen) return
    // Reset on open
    lastVendorActivityRef.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (now - lastVendorActivityRef.current > 25000) {
        // Try to play a SpeedUp line (skips if something is already playing)
        playVendor('SpeedUp')
        // Reset timer so it won't fire continuously
        lastVendorActivityRef.current = now
      }
    }, 1000)
    return () => clearInterval(id)
  }, [shopOpen])

  // Show fading label for current hotbar item when selection changes
  useEffect(() => {
    const it = inventory.hotbar[activeHotbar]
    const name = it ? getItemDef(it.id).name : 'Empty'
    setHotbarLabel({ text: name, show: true })
    if (hotbarLabelTimerRef.current) clearTimeout(hotbarLabelTimerRef.current)
    hotbarLabelTimerRef.current = setTimeout(() => setHotbarLabel((s) => ({ ...s, show: false })), 1500)
    return () => { if (hotbarLabelTimerRef.current) clearTimeout(hotbarLabelTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotbar, inventory.hotbar[activeHotbar]?.id])

  // Input
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)
      if (fieldGuideOpenRef.current) {
        if (e.key === 'Escape') setFieldGuideOpen(false)
        return
      }
      // Title, Options, or Controls swallow gameplay keys. Esc closes Options or Controls; H closes Controls.
      if (titleOpenRef.current || optionsOpenRef.current || controlsOpenRef.current) {
        if (e.key === 'Escape' && optionsOpenRef.current) {
          setOptionsOpen(false)
        }
        if (controlsOpenRef.current && (e.key === 'Escape' || e.key === 'h' || e.key === 'H')) {
          if (e.key !== 'Escape' && e.repeat) return
          e.preventDefault()
          setControlsOpen(false)
        }
        return
      }
      // If spell wheel is open, intercept 1..4 for spell selection
      if (spellWheelOpenRef.current) {
        const k = e.key
        if (k === '1' || k === '2' || k === '3' || k === '4') {
          e.preventDefault()
          const idx = Number(k) - 1
          const mapOrder = ['lightning', 'blink', 'leech', 'shield'] // Top, Right, Bottom, Left ordering mapping to 1..4
          setMageSpell(mapOrder[idx])
          return
        }
      }
      // Track keys for movement, but movement is paused when overlays are open anyway
      keysRef.current[e.key.toLowerCase()] = true
      // Do not preventDefault Arrow keys or Space. Phaser's keyboard manager
      // ignores a keydown once defaultPrevented is set, and it already captures
      // those keys so the page does not scroll. PhaserGame starts the game in a
      // microtask, which registers its listener after this one. preventDefault
      // here would swallow movement and attacks.
      // H toggles the controls menu during play. It stays closed on the title and class-select screens.
      if (!typing && !e.repeat && !classSelectOpenRef.current && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setControlsOpen((open) => !open)
      }
      // Toggle inventory with 'v' (blocked during thief vanish animation)
      if (!typing && (e.key === 'v' || e.key === 'V')) {
        if (session.classId === 'thief' && performance.now() < session.thiefVanishUntil) return
        e.preventDefault()
        if (inventoryOpenRef.current) returnDraggedToInventory()
        setInventoryOpen(v => !v)
      }
      //hotbar number keys 1..9
      if (!typing && !inventoryOpenRef.current && !chatOpenRef.current) {
        const key = e.key
        const codeName = e.code
        if (key >= '1' && key <= '9') {
          const idx = Number(key) - 1
          setActiveHotbar(idx)
        }
  // Swap selected hotbar item with offhand using F (like Minecraft)
        if ((key === 'f' || key === 'F') && allowFSwapRef.current) {
          setInventory(inv => {
            const next = {
              armor: { ...inv.armor },
              storage: inv.storage.slice(),
              hotbar: inv.hotbar.slice(),
            }
            const a = next.hotbar[activeHotbarRef.current] || null
            const b = next.armor.offhand || null
            next.hotbar[activeHotbarRef.current] = b
            next.armor.offhand = a
            return next
          })
        }
      }
      // Close chat with Escape
      if (e.key === 'Escape' && chatOpenRef.current) {
        // Don't close if the user is actively typing in the input
        if (!typing) {
          setChatOpen(false)
          setChatMessages([])
          setChatTurns(0)
          setChatInput('')
        }
      }
      // Close shop with Escape
      if (e.key === 'Escape' && shopOpenRef.current) {
        closeShop()
      }
      // Close inventory with Escape
      if (e.key === 'Escape' && inventoryOpenRef.current) {
        returnDraggedToInventory()
        setInventoryOpen(false)
      }
    }
    const onKeyUp = (e) => { keysRef.current[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    const onWheel = (e) => {
      // Scroll to cycle hotbar like Minecraft (when not typing and no overlays)
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)
  if (typing || titleOpenRef.current || optionsOpenRef.current || controlsOpenRef.current || fieldGuideOpenRef.current || inventoryOpenRef.current || chatOpenRef.current || shopOpenRef.current) return
      const delta = e.deltaY
      if (delta === 0) return
      e.preventDefault()
      setActiveHotbar((i) => {
        const dir = delta > 0 ? 1 : -1
        let n = (i + dir) % 9
        if (n < 0) n += 9
        return n
      })
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Sync scene label for React overlay
  useEffect(() => { sceneRef.current = scene }, [scene])

  useEffect(() => {
    session.blocked = titleOpen || optionsOpen || controlsOpen || fieldGuideOpen || classSelectOpen || chatOpen || inventoryOpen || shopOpen || gameOver
  }, [titleOpen, optionsOpen, controlsOpen, fieldGuideOpen, classSelectOpen, chatOpen, inventoryOpen, shopOpen, gameOver])

  useEffect(() => {
    if (selectedClass !== 'thief' && selectedClass !== 'mage') return undefined
    const id = setInterval(() => setAbilityNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [selectedClass])

  useEffect(() => {
    if (ready) return undefined
    const timer = window.setTimeout(() => setLoadSlow(true), 12000)
    return () => window.clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    const onReady = () => setReady(true)
    const onScene = ({ scene: next } = {}) => {
      if (next) setScene(next)
    }
    const onVitals = (v) => {
      if (!v) return
      setVitals({ hp: v.hp, hpMax: v.hpMax, mana: v.mana, manaMax: v.manaMax })
    }
    const onPrompt = ({ label } = {}) => setActivePrompt(label || '')
    const onNotice = ({ text } = {}) => { if (text) showNotice(text) }
    const onLoot = ({ gems, items } = {}) => {
      const overflow = grantLoot(gems || {}, items || [])
      const gemParts = []
      const g = gems || {}
      if (g.ruby) gemParts.push(`${g.ruby} ${g.ruby > 1 ? 'Rubies' : 'Ruby'}`)
      if (g.sapphire) gemParts.push(`${g.sapphire} Sapphire${g.sapphire > 1 ? 's' : ''}`)
      if (g.emerald) gemParts.push(`${g.emerald} Emerald${g.emerald > 1 ? 's' : ''}`)
      const itemNames = (items || []).map((it) => getItemDef(it.id).name)
      const segs = []
      if (gemParts.length) segs.push(gemParts.join(', '))
      if (itemNames.length) segs.push(itemNames.join(', '))
      if (segs.length) showNotice(`Loot: ${segs.join(' + ')}`)
      if (overflow?.length) showNotice('Some loot did not fit.')
    }
    const onConsumed = ({ id, slot, mode } = {}) => {
      if (!id) return
      // Quest items are never consumed.
      if (isQuestItem(id)) return
      setInventory((inv) => {
        if (mode === 'search') return consumeOneItem(inv, id).next
        const cur = inv.hotbar[slot]
        if (!cur || cur.id !== id) return inv
        const cnt = (cur.count || 1) - 1
        const next = { armor: { ...inv.armor }, storage: inv.storage.slice(), hotbar: inv.hotbar.slice() }
        next.hotbar[slot] = cnt > 0 ? { id, count: cnt } : null
        return next
      })
    }
    const onDied = ({ killer } = {}) => {
      killerRef.current = killer || 'Unknown'
      gameOverRef.current = true
      setGameOver(true)
    }
    const onRespawn = () => {
      gameOverRef.current = false
      setGameOver(false)
    }
    const onWheel = ({ open } = {}) => setSpellWheelOpen(!!open)
    const onAbility = () => setAbilityNow(performance.now())
    const onVendor = () => {
      setShopOpen(true)
      markVendorActivity()
      playVendor('Greeting')
    }
    if (session.ready) setReady(true)
    const offs = [
      eventBus.on(GameEvents.ASSETS_READY, onReady),
      eventBus.on(GameEvents.SCENE_CHANGE, onScene),
      eventBus.on(GameEvents.VITALS, onVitals),
      eventBus.on(GameEvents.PROMPT, onPrompt),
      eventBus.on(GameEvents.NOTICE, onNotice),
      eventBus.on(GameEvents.LOOT, onLoot),
      eventBus.on(GameEvents.ITEM_CONSUMED, onConsumed),
      eventBus.on(GameEvents.DIED, onDied),
      eventBus.on(GameEvents.RESPAWN, onRespawn),
      eventBus.on(GameEvents.SPELL_WHEEL, onWheel),
      eventBus.on(GameEvents.ABILITY, onAbility),
      eventBus.on(GameEvents.VENDOR, onVendor),
    ]
    return () => { for (const off of offs) off() }
  // showNotice / grantLoot / playVendor are stable enough for this bridge; they only call setState.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Spell wheel click handler: choose a spell based on click angle relative to the wheel center
  const handleSpellWheelClick = (e) => {
    try {
      const el = e.currentTarget
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const x = e.clientX - cx
      const y = e.clientY - cy
      let deg = (Math.atan2(y, x) * 180 / Math.PI)
      if (deg < 0) deg += 360
      // Right (0..45 and 315..360) -> Blink
      // Bottom (45..135) -> Life Leech
      // Left (135..225) -> Mana Shield
      // Top (225..315) -> Lightning Bolt
      let id = 'lightning'
      if (deg >= 315 || deg < 45) id = 'blink'
      else if (deg >= 45 && deg < 135) id = 'leech'
      else if (deg >= 135 && deg < 225) id = 'shield'
      else if (deg >= 225 && deg < 315) id = 'lightning'
      setMageSpell(id)
    } catch {}
  }

  // Topic-aware RAG hints for better retrieval on short follow-ups
  const TOPIC_RAG_HINTS = {
    dragon: 'Cavern of Embers, Veyrath, dragon raids, goblins, traps, hoard, Sword of Aeltharion',
    history: 'Hollowvale history, Empire of Drak’Tal, Dragonbind Chains, Veyrath, Pyrehold, Sword of Aeltharion'
  }

  const [chatTopic, setChatTopic] = useState(null)

  // Chat helpers
  // Optional ragHintOverride ensures RAG is used even before chatTopic state updates
  async function sendToBartender(text, ragHintOverride) {
    setChatLoading(true)
    try {
      const context = chatMessages.slice(-5) // keep short
      const ragHints = (typeof ragHintOverride === 'string' && ragHintOverride.trim())
        ? ragHintOverride
        : (chatTopic ? TOPIC_RAG_HINTS[chatTopic] : undefined)
      const payload = { npc: 'bartender', message: text, context, ragHints }

      let hasInsertedBubble = false
      let turnAudioStarted = false
      const res = await sendChatWithFallback({
        ...payload,
        onMeta: ({ turnId } = {}) => {
          if (ttsEnabledRef.current && turnId) {
            turnAudioStarted = true
            eventBus.emit(GameEvents.NPC_SPEAK, { npc: 'bartender', turnId })
          }
        },
        onDelta: (_chunk, accumulated) => {
          setChatMessages(msgs => {
            if (!hasInsertedBubble) {
              hasInsertedBubble = true
              return [...msgs, { role: 'assistant', content: accumulated }]
            }
            const last = msgs[msgs.length - 1]
            if (last && last.role === 'assistant') {
              return [...msgs.slice(0, -1), { ...last, content: accumulated }]
            }
            return [...msgs, { role: 'assistant', content: accumulated }]
          })
        },
      })

      const reply = res?.reply || ''
      setChatMessages(msgs => {
        if (!hasInsertedBubble) {
          return [...msgs, { role: 'assistant', content: reply }]
        }
        const last = msgs[msgs.length - 1]
        if (last && last.role === 'assistant') {
          return [...msgs.slice(0, -1), { ...last, content: reply }]
        }
        return [...msgs, { role: 'assistant', content: reply }]
      })

      // Stream bartender reply over EventBus → Web Audio TTS player if not already started via turnId
      if (ttsEnabled && reply && !turnAudioStarted) {
        eventBus.emit(GameEvents.NPC_SPEAK, { npc: 'bartender', text: reply })
      }
    } catch {
      setChatMessages(msgs => [...msgs, { role: 'assistant', content: 'The bartender could not answer.' }])
    } finally {
      setChatLoading(false)
    }
  }

  async function handleChoice(kind) {
    if (chatLoading) return
    let userText = ''
    if (kind === 'dragon') userText = 'Tell me about the Dragon Quest, and make sure to tell the player to go south of the tavern to explore.'
    else if (kind === 'history') userText = 'Tell me the history of Hollowvale.'
    else return

    // Append user message
    setChatMessages(msgs => [...msgs, { role: 'user', content: kind === 'dragon' ? 'Ask about the Dragon Quest' : 'Ask about the History of Hollowvale' }])
    // Lock topic to drive RAG hints for this thread
    setChatTopic(kind)

    // Compute hints now (state update is async) to ensure RAG is used on the first reply
    const initialHints = TOPIC_RAG_HINTS[kind]

    // Send the detailed prompt to guide the answer
    await sendToBartender(userText, initialHints)
    setChatTurns(n => n + 1)
  setChatMode('free')

    // Auto leave after 5 user turns: immediately trigger leave prompt once
    if (chatTurns + 1 >= 5) {
      await sendToBartender(LEAVE_PROMPT)
    }
  }

  // Auto-scroll chat to bottom on new messages or loading changes
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return
    // Scroll to bottom smoothly
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } catch {
      el.scrollTop = el.scrollHeight
    }
  }, [chatMessages, chatLoading, chatOpen])

  // Move focus into the bartender dialog when it opens, and return it on close.
  useEffect(() => {
    if (!chatOpen) return undefined
    const previous = document.activeElement
    if (previous instanceof HTMLElement && previous !== chatDialogRef.current) {
      chatReturnFocusRef.current = previous
    }
    chatDialogRef.current?.focus()
    return () => {
      const back = chatReturnFocusRef.current
      chatReturnFocusRef.current = null
      if (back && back.isConnected) back.focus()
    }
  }, [chatOpen])

  // Auto-focus the input once free-typing is enabled
  useEffect(() => {
    if (chatOpen && chatTurns >= 1) {
      chatInputRef.current?.focus()
    }
  }, [chatOpen, chatTurns])

  session.hooks.openChest = openChest

  return (
    <div className="min-h-screen w-full bg-black">
      <div className="relative h-screen w-full overflow-hidden">
        <PhaserGame />
        {!titleOpen && !classSelectOpen && (
          <ControlsHint
            sceneHint={SCENE_HINTS[scene] || ''}
            onOpen={() => setControlsOpen(true)}
          />
        )}
        {activePrompt && !titleOpen && !chatOpen && !shopOpen && (
          <div className="pointer-events-none absolute left-1/2 top-[14%] z-20 -translate-x-1/2 rounded-lg border-2 border-amber-300/95 bg-slate-950/90 px-4 py-2 text-lg font-bold text-amber-100">
            {activePrompt}
          </div>
        )}
        {/* Mage Spell Wheel (hold K while Spellbook selected) */}
        {spellWheelOpen && selectedClass === 'mage' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative z-10 w-[240px] h-[240px] select-none" onClick={handleSpellWheelClick}>
              {/* Wheel background with quarter segmentation */}
              <div
                className="absolute inset-0 rounded-full border border-amber-900/50 shadow-xl"
                style={{
                  background: 'conic-gradient(#1f2937 0deg 90deg, #111827 90deg 180deg, #1f2937 180deg 270deg, #111827 270deg 360deg)'
                }}
                aria-label="Spell selection wheel"
              />
              {/* Center dot */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 shadow" />
              {/* Top: Lightning Bolt */}
              <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center gap-1 text-amber-200" title="Lightning Bolt (1)">
                <img src={PATHS.lightningBoltIcon} alt="Lightning Bolt" className="w-8 h-8 rounded border border-amber-900/40 bg-stone-900/40 object-contain" onError={(e)=>{e.currentTarget.style.visibility='hidden'}} />
                <div className="text-xs">Lightning Bolt</div>
                <div className="text-xs text-stone-300">[1]</div>
              </div>
              {/* Right: Blink */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-amber-200" title="Blink (2)">
                <img src={PATHS.blinkIcon} alt="Blink" className="w-8 h-8 rounded border border-amber-900/40 bg-stone-900/40 object-contain" onError={(e)=>{e.currentTarget.style.visibility='hidden'}} />
                <div className="text-xs">Blink</div>
                <div className="text-xs text-stone-300">[2]</div>
              </div>
              {/* Bottom: Life Leech */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex flex-col items-center gap-1 text-amber-200" title="Life Leech (3)">
                <img src={PATHS.lifeLeechIcon} alt="Life Leech" className="w-8 h-8 rounded border border-amber-900/40 bg-stone-900/40 object-contain" onError={(e)=>{e.currentTarget.style.visibility='hidden'}} />
                <div className="text-xs">Life Leech</div>
                <div className="text-xs text-stone-300">[3]</div>
              </div>
              {/* Left: Mana Shield */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 text-amber-200" title="Mana Shield (4)">
                <img src={PATHS.manaShieldIcon} alt="Mana Shield" className="w-8 h-8 rounded border border-amber-900/40 bg-stone-900/40 object-contain" onError={(e)=>{e.currentTarget.style.visibility='hidden'}} />
                <div className="text-xs">Mana Shield</div>
                <div className="text-xs text-stone-300">[4]</div>
              </div>
            </div>
          </div>
        )}
        {/* Thief ability status (cooldown/active) */}
        <div className="absolute top-12 left-2 z-30 pointer-events-none select-none">
          {abilityNow >= 0 && (() => {
            if (selectedClass !== 'thief') return null
            const now = abilityNow || performance.now()
            const vanishRem = Math.max(0, session.thiefVanishUntil - now)
            const smokeRem = Math.max(0, session.thiefSmokeUntil - now)
            const cdRem = Math.max(0, session.thiefVanishCooldownUntil - now)
            // Status and progress
            let label = 'Invisibility: Ready'
            let pct = 0
            let color = '#86efac' // green-300
            if (smokeRem > 0 || vanishRem > 0) {
              const totalRem = smokeRem > 0 ? smokeRem : vanishRem
              label = `Invisibility: Active ${Math.ceil(totalRem/1000)}s`
              pct = 1
              color = '#fbbf24' // amber-400
            } else if (cdRem > 0) {
              label = `Invisibility: CD ${Math.ceil(cdRem/1000)}s`
              pct = Math.min(1, cdRem / 10000)
              color = '#f87171' // red-400
            }
            return (
              <div className="min-w-[160px] max-w-[200px]">
                <div className="px-2 py-1 rounded bg-stone-900/80 text-amber-200 border border-amber-900/40 text-xs">
                  {label}
                  <div className="mt-1 h-1.5 w-full bg-stone-700/80 rounded overflow-hidden">
                    <div className="h-full" style={{ width: `${Math.round(pct*100)}%`, backgroundColor: color }} />
                  </div>
                  <div className="mt-1 text-xs text-stone-300">Attack: Space • Invisibility: J</div>
                </div>
              </div>
            )
          })()}
        </div>
        {/* Mage Life Leech cooldown display */}
        <div className="absolute top-28 left-2 z-30 pointer-events-none select-none">
          {abilityNow >= 0 && (() => {
            if (selectedClass !== 'mage') return null
            if ((session.spellId || mageSelectedSpellRef.current) !== 'leech') return null
            const now = abilityNow || performance.now()
            const cdRem = Math.max(0, session.lifeLeechCooldownUntil - now)
            let label = 'Life Leech: Ready'
            let pct = 0
            let color = '#86efac'
            if (cdRem > 0) {
              label = `Life Leech: CD ${Math.ceil(cdRem/1000)}s`
              pct = Math.min(1, cdRem / 10000)
              color = '#f87171'
            }
            return (
              <div className="min-w-[160px] max-w-[200px]">
                <div className="px-2 py-1 rounded bg-stone-900/80 text-amber-200 border border-amber-900/40 text-xs">
                  {label}
                  <div className="mt-1 h-1.5 w-full bg-stone-700/80 rounded overflow-hidden">
                    <div className="h-full" style={{ width: `${Math.round(pct*100)}%`, backgroundColor: color }} />
                  </div>
                  <div className="mt-1 text-xs text-stone-300">Cast: Space (Spellbook)</div>
                </div>
              </div>
            )
          })()}
        </div>
        {chatOpen && (
          <div className="absolute inset-0 flex items-end md:items-center justify-center p-4 md:p-6 z-20">
            <div
              ref={chatDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bartender-dialog-title"
              tabIndex={-1}
              className="w-full max-w-2xl bg-stone-900/90 backdrop-blur rounded-xl border border-amber-900/40 shadow-lg shadow-black/50"
            >
              <div className="px-4 py-3 border-b border-amber-900/40 flex items-center justify-between">
                <div>
                  <h3 id="bartender-dialog-title" className="font-display text-2xl text-amber-200">Tharos the Bartender</h3>
                  <p className="text-stone-300/80 text-sm">Speak your business, traveler.</p>
                </div>
                <button
                  onClick={() => { setChatOpen(false); setChatMessages([]); setChatTurns(0); setChatInput(''); setChatMode('topics'); setChatTopic(null) }}
                  className="text-stone-300 hover:text-amber-300"
                  aria-label="Close"
                >✕</button>
              </div>
                <div ref={chatScrollRef} className="max-h-[45vh] overflow-y-auto px-4 py-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-stone-300/80 text-sm italic">Another traveler, eh? Choose your poison.</div>
                )}
                {chatMessages.map((m, idx) => (
                  <div key={idx} className={[ 'flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start' ].join(' ')}>
                    <div className={[ 'max-w-[85%] px-4 py-3 rounded-2xl shadow border', m.role === 'user' ? 'bg-amber-200 text-stone-900 border-amber-300' : 'bg-stone-800/80 text-stone-100 border-amber-900/40' ].join(' ')}>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-stone-300 text-sm">The bartender is thinking…</div>
                )}
              </div>
              <div className="p-3 border-t border-amber-900/40 space-y-2">
                {!chatLoading && chatMode === 'topics' && chatTurns < 5 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button onClick={() => handleChoice('dragon')} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold">Ask about the Dragon Quest</button>
                    <button onClick={() => handleChoice('history')} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold">Ask about Hollowvale History</button>
                    <button onClick={() => { setChatOpen(false); setChatMessages([]); setChatTurns(0); setChatInput(''); setChatMode('topics'); setChatTopic(null) }} className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200">Leave</button>
                  </div>
                )}

                {/* Free-text input enabled after first assistant reply, until 5 turns */}
                {chatMode === 'free' && chatTurns < 5 && (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (chatLoading) return
                      const text = chatInput.trim()
                      if (!text) return
                      setChatMessages(msgs => [...msgs, { role: 'user', content: text }])
                      setChatInput('')
                      await sendToBartender(text)
                      setChatTurns(n => n + 1)
                      if (chatTurns + 1 >= 5) {
                        await sendToBartender(LEAVE_PROMPT)
                      }
                    }}
                  >
                    <input
                      type="text"
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a quick follow-up…"
                      aria-label="Message to the bartender"
                      className="flex-1 px-3 py-2 rounded-lg bg-stone-800 text-stone-100 placeholder-stone-400 border border-amber-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                      disabled={chatLoading}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-900 font-semibold"
                    >Send</button>
                    <button
                      type="button"
                      onClick={() => setChatMode('topics')}
                      className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200"
                    >Topics</button>
                  </form>
                )}

                {chatTurns >= 5 && !chatLoading && (
                  <div className="flex justify-end">
                    <button onClick={() => { setChatOpen(false); setChatMessages([]); setChatTurns(0); setChatInput('') }} className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200">Close</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Centered animated fire GIF in dungeon interior */}
        {/* Removed centered fire GIF from dungeon interior as requested */}
        {inventoryOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4" onMouseMove={handleInventoryMouseMove}>
            <div className="w-full max-w-4xl bg-stone-900/95 backdrop-blur rounded-2xl border border-amber-900/40 shadow-xl shadow-black/50">
              <div className="px-5 py-4 border-b border-amber-900/40 flex items-center justify-between">
                <h3 className="font-display text-2xl text-amber-200">Inventory</h3>
              </div>
              <div className="p-5 space-y-5">
                {/* Armor section */}
                <div>
                  <div className="text-amber-300 mb-2 font-medium">Armor</div>
                  <div className="grid grid-cols-5 gap-3">
                    {['head','chest','legs','boots','offhand'].map((slot) => {
                      const it = inventory.armor[slot]
                      const total = it ? (inventoryTotals[it.id] || (it.count || 1)) : 0
                      return (
                        <div
                          key={slot}
                          className="relative select-none w-20 h-20 rounded-lg border border-amber-900/40 bg-stone-800/60 flex items-center justify-center"
                          data-inv-slot={slotId('armor', slot)}
                          onPointerDown={(e) => handleSlotPointerDown(e, 'armor', slot)}
                          onContextMenu={(e) => handleSlotContextMenu(e, 'armor', slot)}
                        >
                          {it ? (
                            <img
                              src={getItemDef(it.id).icon}
                              alt={getItemDef(it.id).name}
                              className="max-w-[70%] max-h-[70%]"
                              onError={(e)=>{ e.currentTarget.style.display='none' }}
                            />
                          ) : (
                            <span className="text-stone-500 text-xs">{slot}</span>
                          )}
                          {/* Removed confusing total-count badge that showed total duplicates across inventory */}
                          {it?.count > 1 && (
                            <span className="absolute bottom-1 right-1 text-xs px-1 rounded bg-stone-900/80 text-amber-200">{it.count}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Storage section */}
                <div>
                  <div className="text-amber-300 mb-2 font-medium">Storage</div>
                  <div className="grid grid-cols-9 gap-2">
                    {inventory.storage.map((it, idx) => (
                      <div
                        key={idx}
                        className="relative select-none w-16 h-16 rounded-md border border-amber-900/40 bg-stone-800/60 flex items-center justify-center"
                        data-inv-slot={slotId('storage', idx)}
                        onPointerDown={(e) => handleSlotPointerDown(e, 'storage', idx)}
                        onContextMenu={(e) => handleSlotContextMenu(e, 'storage', idx)}
                      >
                        {it ? (
                          <img
                            src={getItemDef(it.id).icon}
                            alt={getItemDef(it.id).name}
                            className="max-w-[70%] max-h-[70%]"
                            onError={(e)=>{ e.currentTarget.style.display='none' }}
                          />
                        ) : null}
                        {/* Removed confusing total-count badge that showed total duplicates across inventory */}
                        {it?.count > 1 && (
                          <span className="absolute bottom-1 right-1 text-xs px-1 rounded bg-stone-900/80 text-amber-200">{it.count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* In Use (Hotbar) */}
                <div>
                  <div className="text-amber-300 mb-2 font-medium">In Use</div>
                  <div className="grid grid-cols-9 gap-2">
                    {inventory.hotbar.map((it, idx) => (
                      <div
                        key={idx}
                        className="relative select-none w-16 h-16 rounded-md border border-amber-600/50 bg-stone-800/80 flex items-center justify-center"
                        data-inv-slot={slotId('hotbar', idx)}
                        onPointerDown={(e) => handleSlotPointerDown(e, 'hotbar', idx)}
                        onContextMenu={(e) => handleSlotContextMenu(e, 'hotbar', idx)}
                      >
                        {it ? (
                          <img
                            src={getItemDef(it.id).icon}
                            alt={getItemDef(it.id).name}
                            className="max-w-[70%] max-h-[70%]"
                            onError={(e)=>{ e.currentTarget.style.display='none' }}
                          />
                        ) : null}
                        {/* Removed confusing total-count badge that showed total duplicates across inventory */}
                        {it?.count > 1 && (
                          <span className="absolute bottom-1 right-1 text-xs px-1 rounded bg-stone-900/80 text-amber-200">{it.count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex justify-between items-center">
                <div className="text-stone-400 text-xs">Drag or click: move/swap/merge • Right-click: split stack or place one</div>
                <button onClick={closeInventory} className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200">Close</button>
              </div>
            </div>
          </div>
        )}
        {shopOpen && scene === 'market' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => closeShop()} />
            <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-amber-900/40 bg-stone-900/95 shadow-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-2xl text-amber-200">Market Stall</h3>
                  <p className="text-stone-300/80 text-sm">Browse wares by category and pay with gems.</p>
                </div>
                <button onClick={() => closeShop()} className="px-3 py-1.5 rounded-lg bg-stone-800/90 hover:bg-stone-700 text-amber-200 border border-amber-900/40">Close</button>
              </div>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="text-stone-300/80">Your gems:</span>
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">Ruby {inventoryTotals.ruby||0}</span>
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">Sapphire {inventoryTotals.sapphire||0}</span>
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">Emerald {inventoryTotals.emerald||0}</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {['Potions','Magic','Food','Weaponry','Armor','Tools'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setShopCategory(cat); markVendorActivity() }}
                    className={[
                      'px-3 py-1.5 rounded-lg border',
                      shopCategory === cat ? 'bg-amber-600 text-stone-900 border-amber-400' : 'bg-stone-800/70 text-amber-200 border-amber-900/40 hover:bg-stone-700'
                    ].join(' ')}
                  >{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {MARKET_ITEMS.filter(it => it.category === shopCategory).map((it) => {
                  const def = getItemDef(it.id)
                  const price = marketPrice(it.id)
                  const afford = canAfford(inventory, price)
                  const space = hasSpaceForItem(inventory, it.id)
                  return (
                    <div key={it.id} className="rounded-xl border border-amber-900/40 bg-stone-800/70 p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <img src={def.icon} alt={def.name} className="w-10 h-10 object-contain" onError={(e)=>{ e.currentTarget.style.display='none' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-amber-200 font-medium truncate">{def.name}</div>
                          <div className="text-xs text-stone-300/80 flex gap-2 mt-0.5">
                            {price.ruby>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">Ruby {price.ruby}</span>}
                            {price.sapphire>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">Sapphire {price.sapphire}</span>}
                            {price.emerald>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">Emerald {price.emerald}</span>}
                            {(price.ruby||0)+(price.sapphire||0)+(price.emerald||0)===0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">Free</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => tryBuy(it.id)}
                        disabled={!afford || !space}
                        className={[ 'mt-auto px-3 py-1.5 rounded-lg font-semibold', (!afford || !space) ? 'bg-stone-700 text-stone-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500 text-stone-900' ].join(' ')}
                      >{(!afford) ? 'Not enough gems' : (!space) ? 'No space' : 'Buy'}</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-200">
            {loadSlow
              ? 'Assets are still loading, so refresh the page to try again.'
              : 'Loading assets…'}
          </div>
        )}

  {/* Title Screen Overlay */}
        {titleOpen && (
          <div className="absolute inset-0 z-30">
            {/* Use an <img> with object-contain to show more of the background (zoomed out) */}
            <img src={ASSETS.titleBg} alt="Title Background" className="absolute inset-0 w-full h-full object-contain" />
            <div className="relative h-full w-full flex flex-col items-center justify-top gap-1 px-6">
              {/* Animated sword on left-middle */}
              <AnimatedSprite
                frames={ANIMATED_SWORD_FRAMES}
                fps={8}
                playing={titleOpen}
                alt="Animated Sword"
                className="absolute left-[62%] top-[46%] -translate-y-1/2 w-[420px] h-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
              />
              {/* Replace text with provided title image */}
              <img
                src={ASSETS.titleLogo}
                alt="Heroes of Hollowvale"
                className="w-[85%] max-w-[700px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] transform -translate-y-6 md:-translate-y-10"
              />
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setFieldGuideOpen(false)
                    setTitleOpen(false)
                    setClassSelectOpen(true)
                    // Unlock AudioContext + preload SFX on the user gesture
                    preloadSceneAudio().catch(() => {})
                  }}
                  className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold shadow-lg shadow-amber-900/30"
                >Start Game</button>
                <button
                  type="button"
                  onClick={() => setFieldGuideOpen(true)}
                  className="px-6 py-3 rounded-lg bg-stone-800/90 hover:bg-stone-700 text-amber-200 border border-amber-900/40 shadow"
                >Field Guide</button>
                <button
                  onClick={() => setOptionsOpen(true)}
                  className="px-6 py-3 rounded-lg bg-stone-800/90 hover:bg-stone-700 text-amber-200 border border-amber-900/40 shadow"
                >Options</button>
              </div>
            </div>
          </div>
        )}

        {/* Options Overlay */}
        {optionsOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOptionsOpen(false)} />
            <div className="relative z-10 w-[92%] max-w-xl rounded-xl border border-amber-900/40 bg-stone-900/95 p-6 shadow-xl">
              <h2 className="font-display text-3xl text-amber-200 mb-4">Options</h2>
              <div className="space-y-5">
                {/* Mute all music */}
                <label className="flex items-center gap-2 select-none">
                  <input type="checkbox" checked={muteAllMusic} onChange={(e)=>setMuteAllMusic(e.target.checked)} className="accent-amber-500" />
                  <span className="text-stone-200">Mute all music</span>
                </label>
                {/* Master music volume */}
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-stone-200">Master music volume</span>
                    <span className="text-stone-300/80 text-sm">{masterVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </label>
                {/* Per-song volumes */}
                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-stone-200">Village/Path music</span>
                      <span className="text-stone-300/80 text-sm">{musicVillageVol}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicVillageVol}
                      onChange={(e) => setMusicVillageVol(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </label>
                  <label className="block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-stone-200">Tavern ambience</span>
                      <span className="text-stone-300/80 text-sm">{musicTavernVol}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicTavernVol}
                      onChange={(e) => setMusicTavernVol(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </label>
                  <label className="block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-stone-200">Dungeon interior music</span>
                      <span className="text-stone-300/80 text-sm">{musicFightVol}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicFightVol}
                      onChange={(e) => setMusicFightVol(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </label>
                </div>
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-stone-200">NPC voice volume</span>
                    <span className="text-stone-300/80 text-sm">{ttsVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={ttsVolume}
                    onChange={(e) => setTtsVolume(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </label>
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-stone-200">SFX volume</span>
                    <span className="text-stone-300/80 text-sm">{sfxVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sfxVolume}
                    onChange={(e) => setSfxVolumeState(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center gap-2 select-none">
                    <input type="checkbox" checked={ttsEnabled} onChange={(e)=>setTtsEnabled(e.target.checked)} className="accent-amber-500" />
                    <span className="text-stone-200">Speak bartender replies (TTS)</span>
                  </label>
                  {/* Removed Q-drop option: Q is attack-only now */}
                  <label className="flex items-center gap-2 select-none">
                    <input type="checkbox" checked={allowFSwap} onChange={(e)=>setAllowFSwap(e.target.checked)} className="accent-amber-500" />
                    <span className="text-stone-200">Enable F to swap selected hotbar with offhand</span>
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setOptionsOpen(false)}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold shadow"
                >Back</button>
              </div>
            </div>
          </div>
        )}

        {controlsOpen && !titleOpen && !classSelectOpen && (
          <ControlsMenu classId={selectedClass} onClose={() => setControlsOpen(false)} />
        )}

        <FieldGuide open={fieldGuideOpen} onClose={() => setFieldGuideOpen(false)} />

        {/* Dungeon scene uses E-interact zone; no overlay button needed */}

        {/* Global Options button on all non-intro screens */}
        {!titleOpen && (
          <div className="absolute top-3 right-3 z-30 flex gap-2">
            <button
              type="button"
              onClick={() => setFieldGuideOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-stone-800/90 hover:bg-stone-700 text-amber-200 border border-amber-900/40 shadow"
              aria-label="Field Guide"
              title="Field Guide"
            >Field Guide</button>
            <button
              onClick={() => setOptionsOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-stone-800/90 hover:bg-stone-700 text-amber-200 border border-amber-900/40 shadow"
              aria-label="Options"
              title="Options"
            >Options</button>
          </div>
        )}

        {/* In-game Hotbar HUD (Minecraft-style) */}
        {!titleOpen && !classSelectOpen && !optionsOpen && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 select-none">
            {/* Health bar + (Mage) mana circle */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {/* Health bar */}
              <div className="relative h-3 rounded-full bg-stone-900/60 border border-amber-900/40 overflow-hidden" style={{ width: 340 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, (vitals.hp / vitals.hpMax) * 100 || 0))}%`,
                    backgroundColor: 'rgba(185, 28, 28, 0.9)' // darker red (~red-700) with slight opacity
                  }}
                />
                {/* subtle shine */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(0,0,0,0.05))' }} />
                {/* tick marks at 25/50/75 HP */}
                {(vitals.hpMax || 100) >= 25 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 25 / (vitals.hpMax || 100))) * 100}%`,
                      transform: 'translateX(-1px)',
                      zIndex: 2,
                    }}
                  />
                )}
                {(vitals.hpMax || 100) >= 50 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 50 / (vitals.hpMax || 100))) * 100}%`,
                      transform: 'translateX(-1px)',
                      zIndex: 2,
                    }}
                  />
                )}
                {(vitals.hpMax || 100) >= 75 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 75 / (vitals.hpMax || 100))) * 100}%`,
                      transform: 'translateX(-1px)',
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
              {/* Mage mana circle */}
              {selectedClass === 'mage' && (
                <div
                  className="relative w-7 h-7 rounded-full bg-stone-900/60 border border-amber-900/40"
                  title={`Mana: ${Math.floor(vitals.mana || 0)}/${vitals.manaMax || 0}`}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#1e3a8a ${(Math.max(0, Math.min(1, (vitals.mana || 0) / (vitals.manaMax || 1)))) * 360}deg, transparent 0deg)`,
                      filter: 'drop-shadow(0 0 2px rgba(30,58,138,0.7))',
                    }}
                  />
                  <div className="absolute inset-0.5 rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2), rgba(255,255,255,0) 60%)' }} />
                </div>
              )}
            </div>

            <div className="flex items-end gap-3">
              {/* Current item name label with fade */}
              <div className={[
                'absolute -top-6 left-1/2 -translate-x-1/2 text-sm px-2 py-0.5 rounded bg-stone-900/70 border border-amber-900/40 text-amber-200 transition-opacity duration-500',
                hotbarLabel.show ? 'opacity-100' : 'opacity-0'
              ].join(' ')}>
                {hotbarLabel.text}
              </div>
              {/* Offhand slot on the left */}
              <div
                className="relative w-14 h-14 rounded-md border border-amber-900/50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center"
                data-inv-slot={slotId('armor', 'offhand')}
                onPointerDown={(e)=>handleSlotPointerDown(e,'armor','offhand')}
                onContextMenu={(e)=>handleSlotContextMenu(e,'armor','offhand')}
                onMouseEnter={(e)=>{
                  const it = inventory.armor.offhand
                  setHudTip({ show: true, text: it ? getItemDef(it.id).name : 'Offhand', x: e.clientX + 8, y: e.clientY + 8 })
                }}
                onMouseMove={(e)=> setHudTip((t)=> t.show ? { ...t, x: e.clientX + 8, y: e.clientY + 8 } : t)}
                onMouseLeave={()=> setHudTip((t)=> ({...t, show:false}))}
              >
                {inventory.armor.offhand ? (
                  <img
                    src={getItemDef(inventory.armor.offhand.id).icon}
                    alt={getItemDef(inventory.armor.offhand.id).name}
                    className="max-w-[70%] max-h-[70%]"
                    onError={(e)=>{ e.currentTarget.style.display='none' }}
                  />
                ) : (
                  <span className="text-stone-500 text-xs">offhand</span>
                )}
                {inventory.armor.offhand?.count > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 text-xs px-1 rounded bg-stone-900/80 text-amber-200">
                    {inventory.armor.offhand.count}
                  </span>
                )}
              </div>
              {/* Hotbar 9 slots */}
              <div className="grid grid-cols-9 gap-1 p-2 rounded-xl bg-stone-900/40 border border-amber-900/40 shadow-lg shadow-black/40">
                {inventory.hotbar.map((it, idx) => (
                  <div
                    key={idx}
                    className={[
                      'relative w-14 h-14 rounded-md flex items-center justify-center border',
                      idx === activeHotbar ? 'border-amber-400 ring-2 ring-amber-400/60 bg-stone-800/80' : 'border-amber-900/40 bg-stone-800/50',
                    ].join(' ')}
                    data-inv-slot={slotId('hotbar', idx)}
                    onPointerDown={(e)=>handleSlotPointerDown(e,'hotbar',idx)}
                    onContextMenu={(e)=>handleSlotContextMenu(e,'hotbar',idx)}
                    onMouseEnter={(e)=>{
                      setHudTip({ show: true, text: it ? getItemDef(it.id).name : 'Empty', x: e.clientX + 8, y: e.clientY + 8 })
                    }}
                    onMouseMove={(e)=> setHudTip((t)=> t.show ? { ...t, x: e.clientX + 8, y: e.clientY + 8 } : t)}
                    onMouseLeave={()=> setHudTip((t)=> ({...t, show:false}))}
                  >
                    {it ? (
                      <img
                        src={getItemDef(it.id).icon}
                        alt={getItemDef(it.id).name}
                        className="max-w-[70%] max-h-[70%]"
                        onError={(e)=>{ e.currentTarget.style.display='none' }}
                      />
                    ) : null}
                    {/* number label like Minecraft */}
                    <span className="absolute top-0.5 left-1 text-xs text-stone-300">{idx+1}</span>
                    {it?.count > 1 && (
                      <span className="absolute bottom-0.5 right-0.5 text-[11px] px-1 rounded bg-stone-900/80 text-amber-200">{it.count}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Global drag ghost and HUD tooltip */}
        {invDrag?.item && (
          <div
            className="pointer-events-none fixed z-50"
            style={{ left: invMouse.x + 8, top: invMouse.y + 8 }}
          >
            <div className="relative w-10 h-10 rounded-md border border-amber-700 bg-stone-900/70 flex items-center justify-center">
              <img
                src={getItemDef(invDrag.item.id).icon}
                alt={getItemDef(invDrag.item.id).name}
                className="max-w-[70%] max-h-[70%]"
                onError={(e)=>{ e.currentTarget.style.display='none' }}
              />
              {invDrag.item.count > 1 && (
                <span className="absolute bottom-0.5 right-0.5 text-xs px-1 rounded bg-stone-900/90 text-amber-200">{invDrag.item.count}</span>
              )}
            </div>
          </div>
        )}
        {hudTip.show && (
          <div className="fixed z-40 px-2 py-1 text-xs rounded bg-stone-900/90 text-amber-100 border border-amber-900/40 pointer-events-none"
               style={{ left: hudTip.x, top: hudTip.y }}>
            {hudTip.text}
          </div>
        )}

        {/* Transient game notice for loot/locks */}
        {notice.show && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded bg-stone-900/80 border border-amber-900/50 text-amber-200 shadow">
            {notice.text}
          </div>
        )}

        {/* Death Screen Overlay */}
        {gameOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" />
            <div className="relative z-10 w-[90%] max-w-lg rounded-2xl border border-red-900/50 bg-stone-900/95 shadow-2xl p-6 flex flex-col items-center gap-4">
              <h2 className="text-3xl font-display text-red-400 drop-shadow">You Died</h2>
              <p className="text-stone-300 text-center">Slain by <span className="text-red-300 font-semibold">{killerRef.current}</span>.</p>
              <div className="w-full h-1 bg-stone-700 rounded overflow-hidden">
                <div className="h-full bg-red-600 animate-pulse" style={{ width: '100%' }} />
              </div>
              <button
                onClick={() => {
                  setGameOver(false)
                  gameOverRef.current = false
                  session.classId = null
                  session.spriteUrl = ''
                  session.equippedId = null
                  session.api?.resetRun()
                  setVitals({ hp: CLASS_HP.knight, hpMax: CLASS_HP.knight, mana: 0, manaMax: 0 })
                  setTitleOpen(true)
                  titleOpenRef.current = true
                  setClassSelectOpen(false)
                  classSelectOpenRef.current = false
                  setSelectedClass(null)
                  selectedClassRef.current = null
                  const emptyInv = {
                    armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
                    storage: Array(27).fill(null),
                    hotbar: Array(9).fill(null),
                  }
                  setInventory(emptyInv)
                  inventoryRef.current = emptyInv
                  setScene('village')
                  sceneRef.current = 'village'
                }}
                className="mt-2 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-stone-900 font-semibold shadow-lg shadow-red-900/30"
              >Return to Main Menu</button>
              <p className="text-xs text-stone-400">Your adventure can begin anew.</p>
            </div>
          </div>
        )}

        {classSelectOpen && (
          <ClassSelect
            onChoose={chooseClass}
            onBack={() => {
              setClassSelectOpen(false)
              setTitleOpen(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

