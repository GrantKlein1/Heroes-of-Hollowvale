import React, { useEffect, useRef, useState } from 'react'
import { sendChat as apiSendChat } from './lib/api'

// Simple top-down RPG prototype with two scenes: Village and Tavern

const ASSETS = {
  villageBg: encodeURI('/images/start village screen.png'),
  tavernBg: '/images/tavern.png',
  player: '/images/knight.png',
}

// Pre-specified prompts (sent as user messages; server enforces bartender persona)
const DRAGON_PROMPT = `You are the gruff bartender of the Hollowvale Tavern, a weary but sharp-tongued innkeeper. Always stay in character.

The Red Dragon has taken roost in Ashfang Cavern in the Blackspire Mountains, raiding nearby villages, burning crops, and hoarding treasure. The cavern is filled with goblins, traps, and lesser beasts.
Reward for slaying the dragon:
- The dragon's hoard of gold and jewels
- The Blade of Hollowvale, a legendary weapon beneath the hoard
- Eternal gratitude and free drinks from the tavern and townsfolk

When I ask about the Dragon Quest, respond with detailed, helpful information: directions to Ashfang Cavern, hazards, warnings, tips, and lore—always in medieval tavern barkeep tone. If I go off-topic, be snarky and tell me to stick to the quest or leave.`

const HISTORY_PROMPT = `You are the gruff bartender of the Hollowvale Tavern, a weary but sharp-tongued innkeeper. Always stay in character.

Town History: Hollowvale was founded by miners in the Blackspire Mountains seeking silver and iron. Mines collapsed; caverns became homes to monsters. Hollowvale survived as a trading hub between mountain passes, with the tavern as its heart. Legends say a knightly order once protected the town; their fortress now lies in ruins on the outskirts. Townsfolk are hardy and suspicious of outsiders but loyal to those who prove themselves.

When I ask about the History of Hollowvale, respond with immersive lore: origins, the collapse, trading hub, the old order and ruins, and what the people are like—always in medieval tavern barkeep tone. If I go off-topic, be snarky and tell me to stick to the town or leave.`

const LEAVE_PROMPT = `You are the gruff bartender of the Hollowvale Tavern. The traveler has asked many questions and you tire of them. Tell them to leave, in character.`

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Normalized rect helpers (x,y,w,h in 0..1 of canvas size)
function nrect(x, y, w, h) { return { x, y, w, h } }
function toPixels(rect, width, height) {
  return {
    x: rect.x * width,
    y: rect.y * height,
    w: rect.w * width,
    h: rect.h * height,
  }
}

function intersects(a, b) {
  return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h)
}

export default function Game() {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const keysRef = useRef({})
  const imagesRef = useRef({})
  const sceneRef = useRef('village') // 'village' | 'tavern'
  const [ready, setReady] = useState(false)
  const [scene, setScene] = useState('village')
  // Class selection overlay
  const [classSelectOpen, setClassSelectOpen] = useState(true)
  const [selectedClass, setSelectedClass] = useState(null)
  // Debug picker state
  const frameRef = useRef({ dx: 0, dy: 0, dw: 1, dh: 1 })
  const mouseRef = useRef({ nx: 0, ny: 0 })
  const pickStartRef = useRef(null)
  const [debugOn, setDebugOn] = useState(false)

  // Chat overlay state (bartender)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([]) // {role:'user'|'assistant', content}
  const [chatLoading, setChatLoading] = useState(false)
  const [chatTurns, setChatTurns] = useState(0) // count user->assistant exchanges
  const [chatInput, setChatInput] = useState('')
  const chatScrollRef = useRef(null)
  const chatInputRef = useRef(null)
  const [chatMode, setChatMode] = useState('topics') // 'topics' | 'free'
  // Live refs for overlay states so the game loop sees latest values
  const chatOpenRef = useRef(false)
  const classSelectOpenRef = useRef(true)
  const inventoryOpenRef = useRef(false)
  // Inventory
  const [inventoryOpen, setInventoryOpen] = useState(false)
  // inventory shape: { armor:{head,chest,legs,boots,offhand}, storage: Item[27], hotbar: Item[9] }
  const [inventory, setInventory] = useState({
    armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
    storage: Array(27).fill(null),
    hotbar: Array(9).fill(null),
  })
  // Inventory drag state
  const [invDrag, setInvDrag] = useState(null) // { item:{id,count}, from:{ section:'armor'|'storage'|'hotbar', key:string|number } | null }
  const [invMouse, setInvMouse] = useState({ x: 0, y: 0 })

  // Player state
  const playerRef = useRef({ x: 0, y: 0, w: 48, h: 48, speed: 160 })

  // Scene definitions with simple colliders and interact zones (normalized)
  const scenes = {
    village: {
      bgKey: 'villageBg',
      fitMode: 'contain', // show entire image
      // Colliders use coordinates normalized to the image frame (0..1 in that image's drawn rect)
      // Create a gap for the tavern door by splitting the building into left/right blocks
      colliders: [
        // World border padding (keeps player within image area)
        nrect(0, -0.02, 1, 0.02), // top wall
        nrect(0, 1, 1, 0.02), // bottom wall
        nrect(-0.02, 0, 0.02, 1), // left wall
        nrect(1, 0, 0.02, 1), // right wall
        // Tavern building blocks (approx top-center), leaving a door gap in the very middle
        // Adjusted to match the visual mug/door area centered on the image
        nrect(0.43, 0.05, 0.09, 0.24), // left block
        nrect(0.52, 0.05, 0.09, 0.24), // right block
      ],
  // Door centered beneath the mug: moved further down based on feedback
  door: nrect(0.47, 0.60, 0.06, 0.06),
      onEnter: () => {
        sceneRef.current = 'tavern'
        setScene('tavern')
        // Spawn just inside tavern entrance (relative to tavern image frame)
        playerRef.current._spawn = { scene: 'tavern', nx: 0.5, ny: 0.85 }
      },
      spawn: { nx: 0.5, ny: 0.5 }, // center plaza
      playerScale: 0.09, // sprite height as fraction of image height
    },
    tavern: {
  bgKey: 'tavernBg',
  fitMode: 'contain', // show entire interior so spawn is always visible
      colliders: [
        // World borders
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        // Bar counter across the room
        nrect(0.15, 0.35, 0.70, 0.06),
      ],
      bartender: { nx: 0.5, ny: 0.45, w: 64, h: 64 },
      // Optional: exit back to village if pressing E near bottom center
      exit: nrect(0.45, 0.95, 0.10, 0.06),
      onExit: () => {
        sceneRef.current = 'village'
        setScene('village')
        playerRef.current._spawn = { scene: 'village', nx: 0.5, ny: 0.72 }
      },
  spawn: { nx: 0.5, ny: 0.82 },
  playerScale: 0.11,
    }
  }

  // Load images and set initial spawn
  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadImage(ASSETS.villageBg),
      loadImage(ASSETS.tavernBg),
    ]).then(([villageBg, tavernBg]) => {
      if (cancelled) return
      imagesRef.current = { villageBg, tavernBg, player: null }
      setReady(true)
    }).catch(() => {/* ignore for prototype */})
    return () => { cancelled = true }
  }, [])

  // Player classes
  const CLASSES = {
    knight: {
      id: 'knight',
      name: 'Knight',
      sprite: '/images/knight.png',
      description: 'A disciplined warrior clad in steel, sworn to protect and endure. Knights excel in close combat and defense.',
      strengths: ['High defense', 'Strong melee damage', 'Reliable survivability'],
      weaknesses: ['Slow movement', 'Limited ranged options', 'Low magic resistance'],
      abilities: ['Shield Bash (stun briefly)', 'Defensive Stance (reduce damage)', 'Power Strike (heavy melee)'],
      items: ['Iron Sword', 'Wooden Shield', 'Chainmail Armor', '1x Healing Potion'],
    },
    mage: {
      id: 'mage',
      name: 'Mage',
      sprite: encodeURI('/images/mage 2.png'),
      description: 'A master of arcane forces, fragile in body but devastating in spellcraft. Mages bend fire, frost, and lightning to their will.',
      strengths: ['High magic damage', 'Ranged attacks', 'Versatile elemental spells'],
      weaknesses: ['Low health', 'Weak physical defense', 'Relies on mana'],
      abilities: ['Firebolt (ranged fire)', 'Frost Nova (freeze nearby)', 'Arcane Shield (magic barrier)'],
      items: ['Apprentice Staff', 'Spellbook', 'Cloth Robes', '2x Mana Potions'],
    },
    thief: {
      id: 'thief',
      name: 'Thief',
      sprite: '/images/thief.png',
      description: 'A cunning rogue who thrives in shadows, striking swiftly and vanishing just as fast. Agile and resourceful.',
      strengths: ['High speed', 'Critical strikes', 'Stealth abilities'],
      weaknesses: ['Low defense', 'Weaker against groups', 'Limited durability'],
      abilities: ['Backstab (bonus rear damage)', 'Smoke Bomb (brief invisibility)', 'Pick Lock (open locks)'],
      items: ['Twin Daggers', 'Leather Armor', 'Lockpicks', '1x Poison Vial'],
    },
    dwarf: {
      id: 'dwarf',
      name: 'Dwarf',
      sprite: '/images/dwarf.png',
      description: 'A stout fighter from the mountain halls, tough as stone and skilled with heavy weapons. Dwarves endure where others fall.',
      strengths: ['High health', 'Strong melee (axes/hammers)', 'Poison resistance'],
      weaknesses: ['Shorter range', 'Slower speed', 'Limited magic use'],
      abilities: ['Cleave (wide swing)', 'Stone Skin (armor boost)', 'Battle Roar (ally buff)'],
      items: ['Battle Axe', 'Dwarf Armor', 'Dwarf Pickaxe (utility)', '1x Ale Flask (stamina)'],
    },
  }

  // Item catalog (id -> name + icon path). Icons are expected at /images/<id>.png
  const ITEMS = {
    iron_sword: { name: 'Iron Sword', icon: '/images/iron_sword.png' },
    wooden_shield: { name: 'Wooden Shield', icon: '/images/wooden_shield.png' },
    chainmail_armor: { name: 'Chainmail Armor', icon: '/images/chainmail_armor.png' },
    healing_potion: { name: 'Healing Potion', icon: '/images/healing_potion.png' },

    apprentice_staff: { name: 'Apprentice Staff', icon: '/images/apprentice_staff.png' },
    spellbook: { name: 'Spellbook', icon: '/images/spellbook.png' },
    cloth_robes: { name: 'Cloth Robes', icon: '/images/cloth_robes.png' },
    mana_potion: { name: 'Mana Potion', icon: '/images/mana_potion.png' },

    twin_daggers: { name: 'Twin Daggers', icon: '/images/twin_daggers.png' },
    leather_armor: { name: 'Leather Armor', icon: '/images/leather_armor.png' },
    lockpicks: { name: 'Lockpicks', icon: '/images/lockpicks.png' },
    poison_vial: { name: 'Poison Vial', icon: '/images/poison_vial.png' },

    battle_axe: { name: 'Battle Axe', icon: '/images/battle_axe.png' },
    dwarfArmor: { name: 'Dwarf Armor', icon: '/images/dwarfArmor.png' },
    dwarfPickaxe: { name: 'Dwarf Pickaxe', icon: '/images/dwarfPickaxe.png' },
    ale_flask: { name: 'Ale Flask', icon: '/images/ale_flask.png' },
  }

  const makeItem = (id, count = 1) => ({ id, count })
  const getItemDef = (id) => ITEMS[id] || { name: id, icon: `/images/${id}.png` }

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
      base.hotbar[8] = makeItem('healing_potion', 1)
    } else if (id === 'mage') {
      base.armor.chest = makeItem('cloth_robes')
      base.hotbar[0] = makeItem('apprentice_staff')
      base.storage[0] = makeItem('spellbook')
      base.hotbar[7] = makeItem('mana_potion', 2)
    } else if (id === 'thief') {
      base.armor.chest = makeItem('leather_armor')
      base.hotbar[0] = makeItem('twin_daggers')
      base.storage[0] = makeItem('lockpicks')
      base.hotbar[7] = makeItem('poison_vial', 1)
    } else if (id === 'dwarf') {
      base.armor.chest = makeItem('dwarfArmor')
      base.hotbar[0] = makeItem('battle_axe')
      base.storage[0] = makeItem('dwarfPickaxe')
      base.hotbar[7] = makeItem('ale_flask', 1)
    }
    return base
  }

  async function chooseClass(id) {
    const def = CLASSES[id]
    if (!def) return
    try {
      const img = await loadImage(def.sprite)
      imagesRef.current.player = img
      setSelectedClass(id)
      setClassSelectOpen(false)
    } catch (e) {
      // fallback: keep rectangle if sprite missing
      setSelectedClass(id)
      setClassSelectOpen(false)
    }
    // Adjust movement speed per class (mage/thief slightly faster)
    if (id === 'mage') playerRef.current.speed = 180
    else if (id === 'thief') playerRef.current.speed = 200
    else playerRef.current.speed = 160
    // Seed inventory for chosen class
    setInventory(seedInventoryForClass(id))
  }

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

  const handleSlotMouseDown = (e, section, key) => {
    // Left button only
    if (e.button !== 0) return
    e.preventDefault()
    setInventory((inv) => {
      // If dragging, attempt to place the whole stack
      if (invDrag && invDrag.item) {
        const target = getSlot(inv, section, key)
        // Swap if different item present
        if (target && !sameItem(target, invDrag.item)) {
          const placed = setSlot(inv, section, key, invDrag.item)
          // New drag becomes the previous target
          setInvDrag({ item: target, from: invDrag.from })
          return placed
        }
        // Merge if same id
        if (sameItem(target, invDrag.item)) {
          const merged = setSlot(inv, section, key, { id: target.id, count: (target.count || 0) + (invDrag.item.count || 0) })
          setInvDrag(null)
          return merged
        }
        // Place into empty
        if (!target) {
          const placed = setSlot(inv, section, key, invDrag.item)
          setInvDrag(null)
          return placed
        }
        return inv
      }

      // Not dragging: pick up from this slot if any
      const it = getSlot(inv, section, key)
      if (!it) return inv
      const next = setSlot(inv, section, key, null)
      setInvDrag({ item: it, from: { section, key } })
      return next
    })
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

  // Place dragged stack back into inventory (used when closing)
  const returnDraggedToInventory = () => {
    if (!invDrag?.item) return
    setInventory((inv) => {
      // Try original slot first if empty
      if (invDrag.from) {
        const cur = getSlot(inv, invDrag.from.section, invDrag.from.key)
        if (!cur) {
          const next = setSlot(inv, invDrag.from.section, invDrag.from.key, invDrag.item)
          setInvDrag(null)
          return next
        }
      }
      // Find first empty in storage, then hotbar, then any armor slot
      for (let i = 0; i < inv.storage.length; i++) {
        if (!inv.storage[i]) {
          const next = setSlot(inv, 'storage', i, invDrag.item)
          setInvDrag(null)
          return next
        }
      }
      for (let i = 0; i < inv.hotbar.length; i++) {
        if (!inv.hotbar[i]) {
          const next = setSlot(inv, 'hotbar', i, invDrag.item)
          setInvDrag(null)
          return next
        }
      }
      const armorSlots = ['head','chest','legs','boots','offhand']
      for (const s of armorSlots) {
        if (!inv.armor[s]) {
          const next = setSlot(inv, 'armor', s, invDrag.item)
          setInvDrag(null)
          return next
        }
      }
      // If nowhere to place, keep dragging (should be rare)
      return inv
    })
  }

  const closeInventory = () => {
    returnDraggedToInventory()
    setInventoryOpen(false)
  }

  // Keep overlay refs in sync with state
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])
  useEffect(() => { classSelectOpenRef.current = classSelectOpen }, [classSelectOpen])
  useEffect(() => { inventoryOpenRef.current = inventoryOpen }, [inventoryOpen])

  // Input
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)
      // Track keys for movement, but movement is paused when chatOpen anyway
      keysRef.current[e.key.toLowerCase()] = true
      // prevent page scroll for arrow keys/space only when not typing into an input/textarea
      if (!typing && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault()
      }
      // Toggle debug collider picker with F2 or backtick
      if (e.key === 'F2' || e.key === 'f2' || e.key === '`') {
        setDebugOn((v) => !v)
      }
      // Toggle inventory with 'v'
      if (!typing && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        if (inventoryOpenRef.current) returnDraggedToInventory()
        setInventoryOpen(v => !v)
      }
      // Close chat with Escape
      if (e.key === 'Escape' && chatOpen) {
        // Don't close if the user is actively typing in the input
        if (!typing) {
          setChatOpen(false)
          setChatMessages([])
          setChatTurns(0)
          setChatInput('')
        }
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
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Resize canvas to fit window
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(canvas.clientWidth * dpr)
      canvas.height = Math.floor(canvas.clientHeight * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const obs = new ResizeObserver(resize)
    obs.observe(canvas)
    return () => obs.disconnect()
  }, [])

  // Main loop
  useEffect(() => {
    if (!ready) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let last = performance.now()
    let interactLatch = false

    // mark initial spawn to be resolved after background layout is known
    if (!playerRef.current._spawn) {
      const s = scenes[sceneRef.current]
      playerRef.current._spawn = { scene: sceneRef.current, nx: s.spawn.nx, ny: s.spawn.ny }
    }

    const step = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      // Layout background based on scene fit mode and compute image frame
      const cw = canvas.clientWidth, ch = canvas.clientHeight
      const sdef = scenes[sceneRef.current]
      const bgImg = imagesRef.current[sdef.bgKey]
      let dx = 0, dy = 0, dw = cw, dh = ch
      if (bgImg) {
        const scaleContain = Math.min(cw / bgImg.width, ch / bgImg.height)
        const scaleCover = Math.max(cw / bgImg.width, ch / bgImg.height)
        const scale = sdef.fitMode === 'contain' ? scaleContain : scaleCover
        dw = bgImg.width * scale
        dh = bgImg.height * scale
        dx = (cw - dw) / 2
        dy = (ch - dh) / 2
      }
      // expose frame for mouse mapping
      frameRef.current = { dx, dy, dw, dh }

      // Helper to map normalized image-space rect to screen pixels
      const mapRect = (r) => ({ x: dx + r.x * dw, y: dy + r.y * dh, w: r.w * dw, h: r.h * dh })

      // Update player size relative to scene image height
      if (sdef.playerScale && dh > 0) {
        const ph = Math.max(24, Math.round(sdef.playerScale * dh))
        playerRef.current.h = ph
        playerRef.current.w = ph
      }

      // Handle delayed spawn after transitions
      if (playerRef.current._spawn) {
        const sp = playerRef.current._spawn
        if (sp.scene === sceneRef.current) {
          playerRef.current.x = dx + sp.nx * dw - playerRef.current.w / 2
          playerRef.current.y = dy + sp.ny * dh - playerRef.current.h / 2
          // Clamp to visible image frame to ensure the knight is on-screen
          playerRef.current.x = Math.min(Math.max(playerRef.current.x, dx), dx + dw - playerRef.current.w)
          playerRef.current.y = Math.min(Math.max(playerRef.current.y, dy), dy + dh - playerRef.current.h)
          delete playerRef.current._spawn
        }
      }

      // Update (pause movement when chat/class/inventory overlays are open)
      const speed = playerRef.current.speed
      let vx = 0, vy = 0
      if (!chatOpenRef.current && !classSelectOpenRef.current && !inventoryOpenRef.current) {
        if (keysRef.current['w'] || keysRef.current['arrowup']) vy -= 1
        if (keysRef.current['s'] || keysRef.current['arrowdown']) vy += 1
        if (keysRef.current['a'] || keysRef.current['arrowleft']) vx -= 1
        if (keysRef.current['d'] || keysRef.current['arrowright']) vx += 1
        if (vx !== 0 || vy !== 0) {
          const len = Math.hypot(vx, vy)
          vx /= len; vy /= len
        }
      }

      // Move with simple AABB collisions
      const next = { ...playerRef.current }
      next.x += vx * speed * dt
      // X axis collisions (map colliders to image frame)
      const collidersPx = sdef.colliders.map(mapRect)
      for (const c of collidersPx) {
        if (intersects({ x: next.x, y: playerRef.current.y, w: next.w, h: next.h }, c)) {
          // Resolve by moving back along x
          if (vx > 0) next.x = c.x - next.w
          else if (vx < 0) next.x = c.x + c.w
        }
      }
      // Y axis
      next.y += vy * speed * dt
      for (const c of collidersPx) {
        if (intersects({ x: next.x, y: next.y, w: next.w, h: next.h }, c)) {
          if (vy > 0) next.y = c.y - next.h
          else if (vy < 0) next.y = c.y + c.h
        }
      }
      playerRef.current.x = next.x
      playerRef.current.y = next.y

  // Clamp movement to the image frame so we never drift outside the visible area
  playerRef.current.x = Math.min(Math.max(playerRef.current.x, dx), dx + dw - playerRef.current.w)
  playerRef.current.y = Math.min(Math.max(playerRef.current.y, dy), dy + dh - playerRef.current.h)

      // Interact (E)
      const eDown = !!(keysRef.current['e'])
      if (!chatOpenRef.current && eDown && !interactLatch) {
        interactLatch = true
        // Village enter door
        if (sceneRef.current === 'village' && sdef.door) {
          const doorPx = mapRect(sdef.door)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, doorPx)) {
            sdef.onEnter?.()
          }
        }
        // Tavern exit
        if (sceneRef.current === 'tavern' && sdef.exit) {
          const exitPx = mapRect(sdef.exit)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, exitPx)) {
            sdef.onExit?.()
          }
        }
        // Tavern bartender interact -> open chat if near
        if (sceneRef.current === 'tavern' && scenes.tavern.bartender) {
          const b = scenes.tavern.bartender
          const bx = dx + b.nx * dw - b.w / 2
          const by = dy + b.ny * dh - b.h / 2
          const interactZone = { x: bx - 12, y: by - 12, w: b.w + 24, h: b.h + 24 }
          const playerBox = { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }
          if (intersects(playerBox, interactZone)) {
            setChatOpen(true)
            setChatMessages([{ role: 'assistant', content: "Tharos: Hrm. Traveler. Dragon business or town history—what'll it be?" }])
            setChatTurns(0)
            setChatInput('')
            setChatMode('topics')
          }
        }
      } else if (!eDown) {
        interactLatch = false
      }

      // Render
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)

      // Draw background (cover)
      if (bgImg) {
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(bgImg, dx, dy, dw, dh)
      } else {
        ctx.fillStyle = '#2b2b2b'
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      }

      // Note: no separate bartender sprite is drawn; the bartender is part of the background image.

      // Draw player
      const pImg = imagesRef.current.player
      if (pImg) {
        ctx.drawImage(pImg, playerRef.current.x, playerRef.current.y, playerRef.current.w, playerRef.current.h)
        // subtle outline for visibility
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1
        ctx.strokeRect(playerRef.current.x, playerRef.current.y, playerRef.current.w, playerRef.current.h)
      } else {
        ctx.fillStyle = '#ffcc00'
        ctx.fillRect(playerRef.current.x, playerRef.current.y, playerRef.current.w, playerRef.current.h)
      }

      // UI hints
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(8, 8, 380, 56)
      ctx.fillStyle = '#fff'
      ctx.font = '14px sans-serif'
  ctx.fillText('WASD: Move    E: Interact    V: Inventory', 16, 28)
      ctx.fillText(sceneRef.current === 'village' ? 'Find the tavern door (top-center) and press E' : 'Explore the tavern. Press E near bottom to exit', 16, 50)

      // Debug prompt near door/exit
      const promptRect = sceneRef.current === 'village' ? sdef.door : sdef.exit
      if (promptRect) {
        const pr = mapRect(promptRect)
        if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, pr)) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          const label = sceneRef.current === 'village' ? 'Press E to enter' : 'Press E to exit'
          const tw = ctx.measureText(label).width + 16
          ctx.fillRect(pr.x, pr.y - 24, Math.max(140, tw), 20)
          ctx.fillStyle = '#ffeb99'
          ctx.font = '12px sans-serif'
          ctx.fillText(label, pr.x + 8, pr.y - 10)
        }
      }

      // Bartender interact hint (tavern): show when close enough to talk
      if (!chatOpen && sceneRef.current === 'tavern' && scenes.tavern.bartender) {
        const b = scenes.tavern.bartender
        const bx = dx + b.nx * dw - b.w / 2
        const by = dy + b.ny * dh - b.h / 2
        const interactZone = { x: bx - 12, y: by - 12, w: b.w + 24, h: b.h + 24 }
        const playerBox = { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }
        if (intersects(playerBox, interactZone)) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          const label = 'Press E to talk'
          const tw = ctx.measureText(label).width + 16
          ctx.fillRect(interactZone.x, interactZone.y - 24, Math.max(140, tw), 20)
          ctx.fillStyle = '#ffeb99'
          ctx.font = '12px sans-serif'
          ctx.fillText(label, interactZone.x + 8, interactZone.y - 10)
        }
      }

      // Debug overlay: mouse crosshair and selection rectangle
      if (debugOn) {
        const { nx, ny } = mouseRef.current
        // Only draw if mouse is within image frame
        if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
          const mx = frameRef.current.dx + nx * frameRef.current.dw
          const my = frameRef.current.dy + ny * frameRef.current.dh
          // crosshair
          ctx.strokeStyle = 'rgba(0,255,0,0.8)'
          ctx.beginPath()
          ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my)
          ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my + 10)
          ctx.stroke()
          // coords label
          const label = `nx=${nx.toFixed(3)} ny=${ny.toFixed(3)}  [F2] picker`
          ctx.font = '12px monospace'
          const tw2 = ctx.measureText(label).width + 12
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          ctx.fillRect(mx + 10, my - 16, Math.max(180, tw2), 16)
          ctx.fillStyle = '#9eff9e'
          ctx.fillText(label, mx + 16, my - 4)
        }

        // drag-rectangle preview (two-click define)
        const a = pickStartRef.current
        if (a) {
          const x = Math.max(0, Math.min(1, Math.min(a.nx, nx)))
          const y = Math.max(0, Math.min(1, Math.min(a.ny, ny)))
          const w = Math.max(0, Math.min(1, Math.abs(a.nx - nx)))
          const h = Math.max(0, Math.min(1, Math.abs(a.ny - ny)))
          const rx = frameRef.current.dx + x * frameRef.current.dw
          const ry = frameRef.current.dy + y * frameRef.current.dh
          const rw = w * frameRef.current.dw
          const rh = h * frameRef.current.dh
          ctx.setLineDash([6, 4])
          ctx.strokeStyle = 'rgba(0,255,0,0.9)'
          ctx.strokeRect(rx, ry, rw, rh)
          ctx.setLineDash([])
          const info = `nrect(${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)})`
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          const tw3 = ctx.measureText(info).width + 12
          ctx.fillRect(rx, ry - 16, Math.max(180, tw3), 16)
          ctx.fillStyle = '#9eff9e'
          ctx.fillText(info, rx + 6, ry - 4)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [ready])

  // Sync scene label for React overlay
  useEffect(() => { sceneRef.current = scene }, [scene])

  // Debug mouse handlers
  const handleMouseMove = (e) => {
    if (!debugOn) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const { dx, dy, dw, dh } = frameRef.current
    const nx = (mx - dx) / dw
    const ny = (my - dy) / dh
    mouseRef.current = { nx, ny }
  }

  const handleClick = async () => {
    if (!debugOn) return
    const p = mouseRef.current
    if (!pickStartRef.current) {
      pickStartRef.current = { ...p }
    } else {
      const a = pickStartRef.current
      const x = Math.min(a.nx, p.nx)
      const y = Math.min(a.ny, p.ny)
      const w = Math.abs(a.nx - p.nx)
      const h = Math.abs(a.ny - p.ny)
      const snippet = `nrect(${x.toFixed(3)}, ${y.toFixed(3)}, ${w.toFixed(3)}, ${h.toFixed(3)})`
      try { await navigator.clipboard.writeText(snippet) } catch {}
      console.log('[Picker] rect copied to clipboard:', snippet)
      pickStartRef.current = null
    }
  }

  // Chat helpers
  async function sendToBartender(text) {
    setChatLoading(true)
    try {
      const context = chatMessages.slice(-5) // keep short
      const payload = { npc: 'bartender', message: text, context }
      const res = await apiSendChat(payload)
      const reply = res?.reply || ''
      setChatMessages(msgs => [...msgs, { role: 'assistant', content: reply }])
    } catch (err) {
      setChatMessages(msgs => [...msgs, { role: 'assistant', content: `Bartender (annoyed): ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  async function handleChoice(kind) {
    if (chatLoading) return
    let userText = ''
    if (kind === 'dragon') userText = DRAGON_PROMPT
    else if (kind === 'history') userText = HISTORY_PROMPT
    else return

    // Append user message
    setChatMessages(msgs => [...msgs, { role: 'user', content: kind === 'dragon' ? 'Ask about the Dragon Quest' : 'Ask about the History of Hollowvale' }])
    // Send the detailed prompt to guide the answer
    await sendToBartender(userText)
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

  // Auto-focus the input once free-typing is enabled
  useEffect(() => {
    if (chatOpen && chatTurns >= 1) {
      chatInputRef.current?.focus()
    }
  }, [chatOpen, chatTurns])

  return (
    <div className="min-h-screen w-full bg-black">
      <div className="relative w-full h-screen">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
        {chatOpen && (
          <div className="absolute inset-0 flex items-end md:items-center justify-center p-4 md:p-6 z-20">
            <div className="w-full max-w-2xl bg-stone-900/90 backdrop-blur rounded-xl border border-amber-900/40 shadow-lg shadow-black/50">
              <div className="px-4 py-3 border-b border-amber-900/40 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl text-amber-200">Tharos the Bartender</h3>
                  <p className="text-stone-300/80 text-sm">Speak your business, traveler.</p>
                </div>
                <button
                  onClick={() => { setChatOpen(false); setChatMessages([]); setChatTurns(0); setChatInput(''); setChatMode('topics') }}
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
                    <button onClick={() => { setChatOpen(false); setChatMessages([]); setChatTurns(0); setChatInput(''); setChatMode('topics') }} className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200">Leave</button>
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
                      className="flex-1 px-3 py-2 rounded-lg bg-stone-800 text-stone-100 placeholder-stone-400 border border-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-600"
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
        {inventoryOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4" onMouseMove={handleInventoryMouseMove}>
            <div className="w-full max-w-4xl bg-stone-900/95 backdrop-blur rounded-2xl border border-amber-900/40 shadow-xl shadow-black/50">
              <div className="px-5 py-4 border-b border-amber-900/40 flex items-center justify-between">
                <h3 className="font-display text-2xl text-amber-200">Inventory</h3>
                <button onClick={closeInventory} className="text-stone-300 hover:text-amber-300" aria-label="Close">✕</button>
              </div>
              <div className="p-5 space-y-5">
                {/* Armor section */}
                <div>
                  <div className="text-amber-300 mb-2 font-medium">Armor</div>
                  <div className="grid grid-cols-5 gap-3">
                    {['head','chest','legs','boots','offhand'].map((slot) => {
                      const it = inventory.armor[slot]
                      return (
                        <div
                          key={slot}
                          className="relative select-none w-20 h-20 rounded-lg border border-amber-900/40 bg-stone-800/60 flex items-center justify-center"
                          onMouseDown={(e) => handleSlotMouseDown(e, 'armor', slot)}
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
                        onMouseDown={(e) => handleSlotMouseDown(e, 'storage', idx)}
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
                        onMouseDown={(e) => handleSlotMouseDown(e, 'hotbar', idx)}
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
                        {it?.count > 1 && (
                          <span className="absolute bottom-1 right-1 text-xs px-1 rounded bg-stone-900/80 text-amber-200">{it.count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex justify-between items-center">
                <div className="text-stone-400 text-xs">Left-click: drag/swap/merge • Right-click: split stack or place one</div>
                <button onClick={closeInventory} className="px-3 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-amber-200">Close</button>
              </div>
            </div>
            {invDrag?.item && (
              <div
                className="pointer-events-none fixed z-30"
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
                    <span className="absolute bottom-0.5 right-0.5 text-[10px] px-1 rounded bg-stone-900/90 text-amber-200">{invDrag.item.count}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-200">
            Loading assets…
          </div>
        )}

        {classSelectOpen && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-stone-900/95 backdrop-blur border border-amber-900/40 rounded-2xl p-5 shadow-xl shadow-black/50">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-3xl text-amber-200">Choose Your Class</h2>
                  <p className="text-stone-300/80">Select a class to begin your adventure.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(CLASSES).map(c => (
                  <div key={c.id} className="rounded-xl border border-amber-900/40 bg-stone-800/70 p-4 flex gap-4">
                    <img src={c.sprite} alt={c.name} className="w-24 h-24 object-contain rounded-lg border border-stone-700 bg-stone-900/60" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-amber-200">{c.name}</h3>
                        <button onClick={() => chooseClass(c.id)} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold">Choose</button>
                      </div>
                      <p className="text-sm text-stone-200 mt-1">{c.description}</p>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-amber-300 font-medium">Strengths</div>
                          <ul className="list-disc list-inside text-stone-200/90">
                            {c.strengths.map((s,i)=>(<li key={i}>{s}</li>))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-amber-300 font-medium">Weaknesses</div>
                          <ul className="list-disc list-inside text-stone-200/90">
                            {c.weaknesses.map((w,i)=>(<li key={i}>{w}</li>))}
                          </ul>
                        </div>
                        <div>
                          <div className="text-amber-300 font-medium">Abilities</div>
                          <ul className="list-disc list-inside text-stone-200/90">
                            {c.abilities.map((a,i)=>(<li key={i}>{a}</li>))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-amber-300 font-medium">Starting Items</div>
                        <div className="text-stone-200/90">{c.items.join(', ')}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
