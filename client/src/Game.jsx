import React, { useEffect, useRef, useState, useMemo } from 'react'
import { sendChat as apiSendChat, fetchTTS as apiFetchTTS, streamTTS as apiStreamTTS } from './lib/api'
import { PATHS, CLASS_SPRITES, CLASS_ATTACK_SPRITES, ITEM_ICONS, DEFAULT_ITEM_ICON, COMPOSITE_SPRITES, ANIMATED_SWORD_FRAMES } from './config/paths'
import AnimatedSprite from './components/AnimatedSprite'

// Simple top-down RPG prototype with two scenes: Village and Tavern

const ASSETS = {
  villageBg: PATHS.villageBg,
  tavernBg: PATHS.tavernBg,
  marketBg: PATHS.marketBg,
  pathBg: PATHS.walkingPath,
  dungeonBg: PATHS.dungeonEntrance,
  dungeonInteriorBg: PATHS.dungeonInterior,
  treasureBg: PATHS.hiddenTreasureRoom,
  player: CLASS_SPRITES.knight,
  // Title background image (place in client/public/images)
  titleBg: PATHS.titleBg,
  // Title logo image (with spaces in filename)
  titleLogo: PATHS.titleLogo,
}

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
  const musicRef = useRef(null)
  const vendorAudioRef = useRef(null)
  const sceneRef = useRef('village') // 'village' | 'tavern'
  const [ready, setReady] = useState(false)
  const [scene, setScene] = useState('village')
  // Title and options overlays
  const [titleOpen, setTitleOpen] = useState(true)
  const titleOpenRef = useRef(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsOpenRef = useRef(false)
  // Market/shop overlay
  const [shopOpen, setShopOpen] = useState(false)
  const shopOpenRef = useRef(false)
  const [shopCategory, setShopCategory] = useState('Potions')
  // Class selection overlay (opens after Start Game)
  const [classSelectOpen, setClassSelectOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  // Live ref for selectedClass so key handlers see the latest value
  const selectedClassRef = useRef(null)
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
  // Options: simple volume slider persisted for future audio
  const [volume, setVolume] = useState(() => {
    const v = Number(localStorage.getItem('volume') ?? 15)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 15
  })
  // Toggle for bartender speech (TTS)
  const [ttsEnabled, setTtsEnabled] = useState(() => (localStorage.getItem('ttsEnabled') ?? 'true') !== 'false')
  // Separate volume for bartender voice (TTS)
  const [ttsVolume, setTtsVolume] = useState(() => {
    const sv = Number(localStorage.getItem('ttsVolume'))
    if (Number.isFinite(sv)) return Math.max(0, Math.min(100, sv))
    const base = Number(localStorage.getItem('volume'))
    return Number.isFinite(base) ? Math.max(0, Math.min(100, base)) : 50
  })
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
  const [invMouse, setInvMouse] = useState({ x: 0, y: 0 })
  // Hotbar HUD state
  const [activeHotbar, setActiveHotbar] = useState(0) // 0..8 like Minecraft
  const activeHotbarRef = useRef(0)
  // Options toggles for hotbar behaviors
  const [allowFSwap, setAllowFSwap] = useState(() => (localStorage.getItem('allowFSwap') ?? 'true') !== 'false')
  const allowFSwapRef = useRef(allowFSwap)
  // Attack animation state
  const attackUntilRef = useRef(0)
  const ATTACK_DURATION_MS = 1000 // duration to show attack pose; adjust as desired
  const attackActiveRef = useRef(false) // true while attack pose is displayed
  // Consumables (hold E to consume)
  const CONSUME_DURATION_MS = 1000
  const CONSUMABLE_IDS = new Set(['healing_potion','mana_potion','speed_potion'])
  const consumeActiveRef = useRef(false)
  const consumeStartRef = useRef(0)
  const consumeItemRef = useRef(null) // { id, slot }
  const consumeNeedsReleaseRef = useRef(false) // require E release before next start
  const speedBoostUntilRef = useRef(0)
  // Fireball system (mage): projectiles and lingering fires
  // Tweak these to adjust distance and speed
  const FIREBALL_SPEED = 420 // pixels per second
  const FIREBALL_TRAVEL_DISTANCE = 220 // pixels to travel before stopping (adjust here)
  const FIRE_LINGER_MS = 2000 // how long the small flame remains in place
  const projectilesRef = useRef([]) // { x,y,w,h, vx,vy, startX,startY, maxDist, img }
  const firesRef = useRef([]) // { x,y,w,h, until, img }
  const sfxCacheRef = useRef({})
  const playSfx = (src, vol = 0.6) => {
    if (!src) return
    try {
      let a = sfxCacheRef.current[src]
      if (!a) {
        a = new Audio(src)
        sfxCacheRef.current[src] = a
      }
      a.currentTime = 0
      a.volume = Math.max(0, Math.min(1, (ttsVolume / 100) * vol))
      a.play().catch(()=>{})
    } catch {}
  }
  // Force a lightweight refresh so DOM GIF overlays update position
  const [effectsTick, setEffectsTick] = useState(0)
  useEffect(() => {
    let rafId
    const tick = () => {
      setEffectsTick((t) => (t + 1) % 1000000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])
  const effectIdRef = useRef(1)
  // Ensure sprite image swaps don't race: only apply the latest requested sprite
  const spriteReqIdRef = useRef(0)
  const setPlayerImageAsync = (src) => {
    try {
      const reqId = ++spriteReqIdRef.current
      loadImage(src).then((img) => {
        if (spriteReqIdRef.current === reqId) {
          imagesRef.current.player = img
        }
      }).catch(()=>{})
    } catch {}
  }
  // HUD tooltip and selection label
  const [hudTip, setHudTip] = useState({ show: false, text: '', x: 0, y: 0 })
  const [hotbarLabel, setHotbarLabel] = useState({ text: '', show: false })
  const hotbarLabelTimerRef = useRef(null)
  // Store previous (non-attack) sprite image to immediately revert without waiting for load
  const prevSpriteImgRef = useRef(null)
  // Track last movement direction (for projectile aim)
  const lastDirRef = useRef({ x: 1, y: 0 })

  // Player state
  const playerRef = useRef({
    x: 0, y: 0, w: 48, h: 48, speed: 160,
    hpMax: 100, hp: 100,
    manaMax: 0, mana: 0,
  })
  // Remember where the player left the village (normalized image coords)
  const lastVillagePosRef = useRef({ nx: 0.5, ny: 0.90 })
  // Remember where the player was standing in the dungeon entrance when entering the treasure room
  const treasureReturnPosRef = useRef({ nx: 0.235, ny: 0.20 })

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
        nrect(0.788, 0.684, 0.195, 0.219),
        nrect(0.775, 0.169, 0.193, 0.141),
        nrect(0.004, 0.089, 0.222, 0.239),
        nrect(0.008, 0.006, 0.983, 0.198),
        nrect(0.309, 0.250, 0.377, 0.394),
        nrect(0.004, 0.819, 0.208, 0.158)
      ],
  // Door centered beneath the mug: moved further down based on feedback
  door: nrect(0.47, 0.60, 0.06, 0.06),
      // Travel zone at bottom-middle to enter the path scene
      toPath: nrect(0.45, 0.94, 0.10, 0.06),
      // Market entrance at upper-left, around 20% down from top
      toMarket: nrect(0.02, 0.30, 0.10, 0.06),
      onEnter: () => {
        sceneRef.current = 'tavern'
        setScene('tavern')
        // Spawn just inside tavern entrance (relative to tavern image frame)
        playerRef.current._spawn = { scene: 'tavern', nx: 0.5, ny: 0.85 }
      },
      onTravelSouth: () => {
        sceneRef.current = 'path'
        setScene('path')
        // Spawn at top-middle of the path scene
        playerRef.current._spawn = { scene: 'path', nx: 0.5, ny: 0.10 }
      },
      onEnterMarket: () => {
        sceneRef.current = 'market'
        setScene('market')
        // Spawn at bottom-middle of the market scene
        playerRef.current._spawn = { scene: 'market', nx: 0.5, ny: 0.90 }
      },
      // Spawn near bottom-center on initial load
      spawn: { nx: 0.5, ny: 0.90 },
  playerScale: 0.13, // slightly larger: sprite height as fraction of image height
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
  playerScale: 0.13,
    },
    path: {
      bgKey: 'pathBg',
      fitMode: 'contain',
      colliders: [
        // World borders
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        nrect(0.002, 0.001, 0.432, 0.203),
        nrect(0.714, 0.011, 0.278, 0.144),
        nrect(0.627, 0.158, 0.362, 0.065),
        nrect(0.735, 0.273, 0.265, 0.065),
        nrect(0.852, 0.401, 0.140, 0.220),
        nrect(0.612, 0.493, 0.388, 0.134),
        nrect(0.706, 0.645, 0.288, 0.095),
        nrect(0.746, 0.850, 0.237, 0.020),
        nrect(0.466, 0.774, 0.055, 0.031),
        nrect(0.008, 0.001, 0.371, 0.209),
        nrect(0.013, 0.227, 0.267, 0.110),
        nrect(0.008, 0.350, 0.303, 0.249),
        nrect(0.004, 0.658, 0.191, 0.335)
      ],
      // Exit back to village at TOP-center
      toVillage: nrect(0.45, 0.05, 0.10, 0.06),
      // Enter dungeon at BOTTOM-center
      toDungeon: nrect(0.54, 0.94, 0.12, 0.06),
      onReturn: () => {
        sceneRef.current = 'village'
        setScene('village')
        // Return to where the player left (bottom-middle area), using saved normalized coords
        const nx = Number.isFinite(lastVillagePosRef.current?.nx) ? lastVillagePosRef.current.nx : 0.5
        const nyRaw = Number.isFinite(lastVillagePosRef.current?.ny) ? lastVillagePosRef.current.ny : 0.90
        // Clamp inside the visible frame just a bit
        const ny = Math.max(0.02, Math.min(0.98, nyRaw))
        playerRef.current._spawn = { scene: 'village', nx, ny }
      },
      onEnterDungeon: () => {
        sceneRef.current = 'dungeon'
        setScene('dungeon')
        // Spawn bottom-left area of the dungeon entrance image
        playerRef.current._spawn = { scene: 'dungeon', nx: 0.12, ny: 0.88 }
      },
      // Default spawn when entering path directly
      spawn: { nx: 0.5, ny: 0.10 },
      playerScale: 0.13,
    },
    dungeon: {
      bgKey: 'dungeonBg',
      fitMode: 'contain',
      colliders: [
        // World borders
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        nrect(0.049, 0.613, 0.174, 0.075),
        nrect(0.144, 0.282, 0.081, 0.165),
        nrect(0.189, 0.147, 0.239, 0.085),
        nrect(0.278, 0.076, 0.712, 0.064),
        nrect(0.356, 0.000, 0.631, 0.062),
        nrect(0.684, 0.169, 0.284, 0.110),
        nrect(0.744, 0.463, 0.089, 0.062),
        nrect(0.873, 0.665, 0.064, 0.037),
        nrect(0.712, 0.614, 0.044, 0.020)
      ],
      // Exit back to path near bottom-left where player spawns
      toPath: nrect(0.04, 0.82, 0.20, 0.14),
      // Enter the dungeon interior at TOP-center
      toInterior: nrect(0.45, 0.16, 0.10, 0.06),
  // Secret entrance to the tavern near top-left around (0.235, 0.110)
  toTavern: nrect(0.20, 0.075, 0.07, 0.07),
      onExitToPath: () => {
        sceneRef.current = 'path'
        setScene('path')
        playerRef.current._spawn = { scene: 'path', nx: 0.65, ny: 0.92 }
      },
      onEnterInterior: () => {
        sceneRef.current = 'dungeonInterior'
        setScene('dungeonInterior')
        // Spawn just inside the dungeon interior near bottom-middle
        playerRef.current._spawn = { scene: 'dungeonInterior', nx: 0.5, ny: 0.90 }
      },
      onEnterTavern: () => {
        // Rewired: secret entrance now leads to hidden treasure room
        sceneRef.current = 'treasureRoom'
        setScene('treasureRoom')
        // Enter at top-middle inside the treasure room
        playerRef.current._spawn = { scene: 'treasureRoom', nx: 0.5, ny: 0.10 }
      },
      // Default spawn in bottom-left region
      spawn: { nx: 0.12, ny: 0.88 },
      playerScale: 0.13,
    }
  };

  // Add Dungeon Interior scene after base scenes definition
  Object.assign(scenes, {
    market: {
      bgKey: 'marketBg',
      fitMode: 'contain',
      colliders: [
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        nrect(0.008, 0.466, 0.980, 0.117)
      ],
      // Market owner interaction zone at screen center
      vendor: nrect(0.45, 0.52, 0.10, 0.10),
      // Exit back to village at bottom-middle
      toVillage: nrect(0.45, 0.95, 0.10, 0.06),
      onExitToVillage: () => {
        sceneRef.current = 'village'
        setScene('village')
        // Return to the village near the market entrance (upper-left area ~20% down)
        playerRef.current._spawn = { scene: 'village', nx: 0.11, ny: 0.40 }
      },
      // Default spawn in market is bottom-middle
      spawn: { nx: 0.5, ny: 0.90 },
      playerScale: 0.13,
    },
    dungeonInterior: {
      bgKey: 'dungeonInteriorBg',
      fitMode: 'contain',
      colliders: [
        // World borders only for now
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        nrect(0.915, 0.452, 0.087, 0.415),
        nrect(0.968, 0.226, 0.047, 0.188),
        nrect(0.686, 0.017, 0.220, 0.179),
        nrect(0.019, 0.017, 0.297, 0.169),
        nrect(0.275, 0.016, 0.051, 0.157),
        nrect(0.002, 0.175, 0.178, 0.096),
        nrect(0.008, 0.404, 0.076, 0.234),
        nrect(0.203, 0.716, 0.032, 0.021),
        nrect(0.006, 0.665, 0.087, 0.194)
      ],
      // Exit back to the entrance at BOTTOM-center
      toEntrance: nrect(0.45, 0.95, 0.10, 0.06),
      onExitToEntrance: () => {
        sceneRef.current = 'dungeon'
        setScene('dungeon')
        // Spawn near top-middle of the entrance image
        playerRef.current._spawn = { scene: 'dungeon', nx: 0.55, ny: 0.22 }
      },
      // Default spawn just inside at bottom-middle
      spawn: { nx: 0.5, ny: 0.90 },
      playerScale: 0.13,
    },
    treasureRoom: {
      bgKey: 'treasureBg',
      fitMode: 'contain',
      colliders: [
        nrect(0, -0.02, 1, 0.02),
        nrect(0, 1, 1, 0.02),
        nrect(-0.02, 0, 0.02, 1),
        nrect(1, 0, 0.02, 1),
        nrect(0.008, 0.329, 0.114, 0.041),
        nrect(0.114, 0.583, 0.089, 0.034),
        nrect(0.172, 0.782, 0.083, 0.064),
        nrect(0.674, 0.831, 0.053, 0.034),
        nrect(0.803, 0.624, 0.112, 0.059),
        nrect(0.790, 0.398, 0.176, 0.042),
        nrect(0.665, 0.006, 0.326, 0.168),
        nrect(0.008, 0.011, 0.305, 0.169),
        nrect(0.816, 0.185, 0.117, 0.028)

      ],
      // Hidden chests: 5 total; indices 1 and 3 are locked and require lockpick
      treasureChests: [
        { rect: nrect(0.053, 0.339, 0.102, 0.035), locked: false },
        { rect: nrect(0.126, 0.579, 0.106, 0.041), locked: false },
        { rect: nrect(0.811, 0.171, 0.102, 0.054), locked: false },
        { rect: nrect(0.776, 0.424, 0.140, 0.039), locked: false },
        { rect: nrect(0.801, 0.640, 0.110, 0.049), locked: false },
        { rect: nrect(0.650, 0.843, 0.124, 0.031), locked: true },
        { rect: nrect(0.140, 0.806, 0.150, 0.050), locked: true },
      ],
      // Exit zone placed at the top-middle, right where the player spawns
      toEntrance: nrect(0.45, 0.08, 0.10, 0.06),
      onExitToEntrance: () => {
        sceneRef.current = 'dungeon'
        setScene('dungeon')
        // Return the player to the exact spot they entered from (normalized coords saved earlier)
        const nx = Number.isFinite(treasureReturnPosRef.current?.nx) ? treasureReturnPosRef.current.nx : 0.235
        const ny = Number.isFinite(treasureReturnPosRef.current?.ny) ? treasureReturnPosRef.current.ny : 0.20
        playerRef.current._spawn = { scene: 'dungeon', nx, ny }
      },
      spawn: { nx: 0.5, ny: 0.10 },
      playerScale: 0.13,
    }
  });

  // Load images and set initial spawn
  useEffect(() => {
    let cancelled = false
    const safe = (src) => loadImage(src).catch(() => null)
    // First, load required scene backgrounds; if these fail, we still proceed but warn
    Promise.all([
      safe(ASSETS.villageBg),
      safe(ASSETS.tavernBg),
      safe(ASSETS.marketBg),
      safe(ASSETS.pathBg),
      safe(ASSETS.dungeonBg),
      safe(ASSETS.dungeonInteriorBg),
      safe(ASSETS.treasureBg),
    ]).then(([villageBg, tavernBg, marketBg, pathBg, dungeonBg, dungeonInteriorBg, treasureBg]) => {
      if (cancelled) return
      imagesRef.current = { villageBg, tavernBg, marketBg, pathBg, dungeonBg, dungeonInteriorBg, treasureBg, player: null }
      // Kick off optional asset loads without blocking readiness
      safe(PATHS.animatedFireBallGif).then((img) => { if (!cancelled && img) imagesRef.current.fireBallGif = img })
      safe(PATHS.animatedFireSmallGif).then((img) => { if (!cancelled && img) imagesRef.current.fireSmallGif = img })
      safe(PATHS.animatedThiefPotionGif).then((img) => { if (!cancelled && img) imagesRef.current.thiefPotionGif = img })
      safe(PATHS.poisonPotionGif).then((img) => { if (!cancelled && img) imagesRef.current.poisonPotionGif = img })
      setReady(true)
    }).catch(() => {
      // As a last resort, still mark ready to avoid hanging UI; missing images will be null and handled gracefully.
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  // Player classes
  const CLASSES = {
    knight: {
      id: 'knight',
      name: 'Knight',
      sprite: CLASS_SPRITES.knight,
      description: 'A disciplined warrior clad in steel, sworn to protect and endure. Knights excel in close combat and defense.',
      strengths: ['High defense', 'Strong melee damage', 'Reliable survivability'],
      weaknesses: ['Slow movement', 'Limited ranged options', 'Low magic resistance'],
      abilities: ['[Z] Shield Bash (stun briefly)', '[X] Defensive Stance (reduce damage)', '[C] Power Strike (heavy melee)'],
      items: ['Iron Sword', 'Wooden Shield', 'Chainmail Armor', '1x Healing Potion'],
    },
    mage: {
      id: 'mage',
      name: 'Mage',
      sprite: CLASS_SPRITES.mage,
      description: 'A master of arcane forces, fragile in body but devastating in spellcraft. Mages bend fire, frost, and lightning to their will.',
      strengths: ['High magic damage', 'Ranged attacks', 'Versatile elemental spells'],
      weaknesses: ['Low health', 'Weak physical defense', 'Relies on mana'],
      abilities: ['[Z] Firebolt (ranged fire)', '[X] Frost Nova (freeze nearby)', '[C] Arcane Shield (magic barrier)'],
      items: ['Apprentice Staff', 'Spellbook', 'Cloth Robes', '2x Mana Potions'],
    },
    thief: {
      id: 'thief',
      name: 'Thief',
      sprite: CLASS_SPRITES.thief,
      description: 'A cunning rogue who thrives in shadows, striking swiftly and vanishing just as fast. Agile and resourceful.',
      strengths: ['High speed', 'Critical strikes', 'Stealth abilities'],
      weaknesses: ['Low defense', 'Weaker against groups', 'Limited durability'],
      abilities: ['[Z] Backstab (bonus rear damage)', '[X] Smoke Bomb (brief invisibility)', '[C] Pick Lock (open locks)'],
      items: ['Twin Daggers', 'Leather Armor', 'Lockpicks', '1x Poison Vial'],
    },
    dwarf: {
      id: 'dwarf',
      name: 'Dwarf',
      sprite: CLASS_SPRITES.dwarf,
      description: 'A stout fighter from the mountain halls, tough as stone and skilled with heavy weapons. Dwarves endure where others fall.',
      strengths: ['High health', 'Strong melee (axes/hammers)', 'Poison resistance'],
      weaknesses: ['Shorter range', 'Slower speed', 'Limited magic use'],
      abilities: ['[Z] Cleave (wide swing)', '[X] Stone Skin (armor boost)', '[C] Battle Roar (ally buff)'],
      items: ['Battle Axe', 'Dwarf Armor', 'Dwarf Pickaxe (utility)', '1x Ale Flask (stamina)'],
    },
  }

  // Item catalog (id -> name + icon path). Icons are expected at /images/<id>.png
  const ITEMS = {
    iron_sword: { name: 'Iron Sword', icon: ITEM_ICONS.iron_sword },
    wooden_shield: { name: 'Wooden Shield', icon: ITEM_ICONS.wooden_shield },
    chainmail_armor: { name: 'Chainmail Armor', icon: ITEM_ICONS.chainmail_armor },
    healing_potion: { name: 'Healing Potion', icon: ITEM_ICONS.healing_potion },

    apprentice_staff: { name: 'Apprentice Staff', icon: ITEM_ICONS.apprentice_staff },
    spellbook: { name: 'Spellbook', icon: ITEM_ICONS.spellbook },
    cloth_robes: { name: 'Cloth Robes', icon: ITEM_ICONS.cloth_robes },
    mana_potion: { name: 'Mana Potion', icon: ITEM_ICONS.mana_potion },

    twin_daggers: { name: 'Twin Daggers', icon: ITEM_ICONS.twin_daggers },
    leather_armor: { name: 'Leather Armor', icon: ITEM_ICONS.leather_armor },
    lockpicks: { name: 'Lockpicks', icon: ITEM_ICONS.lockpicks },
    poison_vial: { name: 'Poison Vial', icon: ITEM_ICONS.poison_vial },

    battle_axe: { name: 'Battle Axe', icon: ITEM_ICONS.battle_axe },
    dwarf_armor: { name: 'Dwarf Armor', icon: ITEM_ICONS.dwarf_armor },
    dwarf_pickaxe: { name: 'Dwarf Pickaxe', icon: ITEM_ICONS.dwarf_pickaxe },
    ale_flask: { name: 'Ale Flask', icon: ITEM_ICONS.ale_flask },
    speed_potion: { name: 'Speed Potion', icon: ITEM_ICONS.speed_potion || DEFAULT_ITEM_ICON('speedPotion') },
    apple: { name: 'Apple', icon: ITEM_ICONS.apple || DEFAULT_ITEM_ICON('apple') },
    // Gem loot (fallback to default icon if specific icon not provided)
    ruby: { name: 'Ruby', icon: ITEM_ICONS.ruby || DEFAULT_ITEM_ICON('ruby') },
    sapphire: { name: 'Sapphire', icon: ITEM_ICONS.sapphire || DEFAULT_ITEM_ICON('sapphire') },
    emerald: { name: 'Emerald', icon: ITEM_ICONS.emerald || DEFAULT_ITEM_ICON('emerald') },
  }

  const makeItem = (id, count = 1) => ({ id, count })
  const getItemDef = (id) => ITEMS[id] || { name: id, icon: DEFAULT_ITEM_ICON(id) }

  // Market catalog and easy-to-edit pricing
  const MARKET_ITEMS = [
    // Potions
    { id: 'healing_potion', category: 'Potions' },
    { id: 'mana_potion', category: 'Potions' },
    { id: 'speed_potion', category: 'Potions' },
    // Magic
    { id: 'apprentice_staff', category: 'Magic' },
    { id: 'spellbook', category: 'Magic' },
    // Food
    { id: 'apple', category: 'Food' },
    { id: 'ale_flask', category: 'Food' },
    // Weaponry
    { id: 'iron_sword', category: 'Weaponry' },
    { id: 'twin_daggers', category: 'Weaponry' },
    { id: 'battle_axe', category: 'Weaponry' },
    // Armor
    { id: 'chainmail_armor', category: 'Armor' },
    { id: 'leather_armor', category: 'Armor' },
    { id: 'dwarf_armor', category: 'Armor' },
    { id: 'cloth_robes', category: 'Armor' },
    // Tools
    { id: 'lockpicks', category: 'Tools' },
    { id: 'dwarf_pickaxe', category: 'Tools' },
  ]
  const MARKET_PRICES = {
    // Potions
    healing_potion: { ruby: 1, sapphire: 0, emerald: 0 },
    mana_potion:    { ruby: 0, sapphire: 1, emerald: 0 },
    speed_potion:   { ruby: 0, sapphire: 0, emerald: 2 },
    // Magic
    apprentice_staff: { ruby: 5, sapphire: 2, emerald: 0 },
    spellbook:        { ruby: 1, sapphire: 3, emerald: 0 },
    // Food
    apple:     { ruby: 1, sapphire: 0, emerald: 0 },
    ale_flask: { ruby: 0, sapphire: 0, emerald: 2 },
    // Weaponry
    iron_sword:   { ruby: 4, sapphire: 0, emerald: 2 },
    twin_daggers: { ruby: 3, sapphire: 3, emerald: 0 },
    battle_axe:   { ruby: 0, sapphire: 4, emerald: 2 },
    // Armor
    chainmail_armor: { ruby: 4, sapphire: 0, emerald: 1 },
    leather_armor:   { ruby: 1, sapphire: 0, emerald: 2 },
    dwarf_armor:     { ruby: 5, sapphire: 1, emerald: 0 },
    cloth_robes:     { ruby: 1, sapphire: 2, emerald: 0 },
    // Tools
    lockpicks:     { ruby: 1, sapphire: 2, emerald: 1 },
    dwarf_pickaxe: { ruby: 2, sapphire: 0, emerald: 2 },
  }

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
    // Set base vitals
    playerRef.current.hpMax = 100
    playerRef.current.hp = playerRef.current.hpMax
    if (id === 'mage') {
      playerRef.current.manaMax = 100
      playerRef.current.mana = 100
    } else {
      playerRef.current.manaMax = 0
      playerRef.current.mana = 0
    }
    // Seed inventory for chosen class
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

  // Update player sprite when the selected hotbar item or offhand changes (unless attack pose is active)
  useEffect(() => {
    if (performance.now() < attackUntilRef.current) return
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
    const price = MARKET_PRICES[id] || { ruby: 0, sapphire: 0, emerald: 0 }
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
  useEffect(() => { activeHotbarRef.current = activeHotbar }, [activeHotbar])
  useEffect(() => { titleOpenRef.current = titleOpen }, [titleOpen])
  useEffect(() => { optionsOpenRef.current = optionsOpen }, [optionsOpen])
  useEffect(() => { shopOpenRef.current = shopOpen }, [shopOpen])
  useEffect(() => { localStorage.setItem('volume', String(volume)) }, [volume])
  useEffect(() => { localStorage.setItem('ttsEnabled', String(ttsEnabled)) }, [ttsEnabled])
  useEffect(() => { localStorage.setItem('ttsVolume', String(ttsVolume)) }, [ttsVolume])
  useEffect(() => { localStorage.setItem('allowFSwap', String(allowFSwap)) }, [allowFSwap])
  useEffect(() => { allowFSwapRef.current = allowFSwap }, [allowFSwap])
  // Keep selectedClass/inventory refs in sync for non-reactive event handlers
  useEffect(() => { selectedClassRef.current = selectedClass }, [selectedClass])
  useEffect(() => { inventoryRef.current = inventory }, [inventory])

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

  // Music: play only on Intro (titleOpen) and in Village; pause elsewhere
  // Create audio lazily and try to start on first user interaction if autoplay is blocked
  const ensureMusic = () => {
    if (!musicRef.current) {
      try {
        const a = new Audio(PATHS.introVillageMusic)
        a.loop = true
        a.preload = 'auto'
        a.volume = Math.max(0, Math.min(1, volume / 100))
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

  // React to scene/title and play/pause accordingly
  useEffect(() => {
    // Play music on title, village, and path; pause in tavern, market, and all cave scenes
    const shouldPlay = titleOpen || scene === 'village' || scene === 'path'
    const audio = ensureMusic()
    if (!audio) return
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    if (shouldPlay) {
      const tryPlay = () => {
        const p = audio.play()
        if (p && typeof p.then === 'function') {
          p.catch(() => {
            // Autoplay likely blocked; resume on first pointerdown
            const unlock = () => {
              audio.play().finally(() => {
                document.removeEventListener('pointerdown', unlock)
              })
            }
            document.addEventListener('pointerdown', unlock, { once: true })
          })
        }
      }
      tryPlay()
    } else {
      try { audio.pause() } catch {}
    }
  }, [titleOpen, scene])

  // Play vendor greeting when entering the Market scene
  useEffect(() => {
    if (scene === 'market') {
      // Entering market is user initiated (E), so playback should be allowed
      playVendor('Greeting')
    }
  }, [scene])

  // Keep music volume in sync with Options slider
  useEffect(() => {
    const a = musicRef.current
    if (a) a.volume = Math.max(0, Math.min(1, volume / 100))
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (musicRef.current) {
        try { musicRef.current.pause() } catch {}
        musicRef.current.src = ''
        musicRef.current = null
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
      // If Title or Options are open, limit keys (allow Esc to close Options)
      if (titleOpenRef.current || optionsOpenRef.current) {
        if (e.key === 'Escape' && optionsOpenRef.current) {
          setOptionsOpen(false)
        }
        return
      }
      // Track keys for movement, but movement is paused when overlays are open anyway
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
      //hotbar number keys 1..9
      if (!typing && !inventoryOpenRef.current && !chatOpenRef.current) {
        const code = e.key
        if (code >= '1' && code <= '9') {
          const idx = Number(code) - 1
          setActiveHotbar(idx)
        }
        // Q: Attack or throw consumables depending on class/item
        if (code === 'q' || code === 'Q') {
          // Avoid extending the attack by key-repeat or spamming
          if (e.repeat) return
          const now = performance.now()
          if (now < attackUntilRef.current) return
          const cls = selectedClassRef.current
          const curItem = inventoryRef.current?.hotbar?.[activeHotbarRef.current]
          const weaponByClass = {
            knight: 'iron_sword',
            mage: 'apprentice_staff',
            thief: 'twin_daggers',
            dwarf: 'battle_axe',
          }
          const attackSprite = cls ? CLASS_ATTACK_SPRITES[cls] : null
          const neededItem = cls ? weaponByClass[cls] : null
          const hasWeaponEquipped = !!(curItem && neededItem && curItem.id === neededItem)
          const canAttack = !!(cls && attackSprite && hasWeaponEquipped)

          // Thief: throw poison potion if holding it (no attack pose timer; immediate hand revert)
          if (cls === 'thief' && curItem && curItem.id === 'poison_vial') {
            // Aim and spawn potion projectile
            const p = playerRef.current
            const dir = { x: lastDirRef.current.x, y: lastDirRef.current.y }
            if (Math.abs(dir.x) < 0.001 && Math.abs(dir.y) < 0.001) { dir.x = 1; dir.y = 0 }
            const len = Math.hypot(dir.x, dir.y); if (len > 0) { dir.x /= len; dir.y /= len }
            const startX = p.x + p.w / 2 + dir.x * 12
            const startY = p.y + p.h / 2 + dir.y * 12
            const gif = imagesRef.current.thiefPotionGif
            projectilesRef.current.push({
              id: effectIdRef.current++,
              x: startX - 21,
              y: startY - 21,
              w: 42,
              h: 42,
              vx: dir.x * FIREBALL_SPEED,
              vy: dir.y * FIREBALL_SPEED,
              startX,
              startY,
              maxDist: FIREBALL_TRAVEL_DISTANCE,
              domSrc: PATHS.animatedThiefPotionGif,
              impactKey: 'poisonPotionGif',
              lingerMs: 2000,
            })
            // Consume one poison vial and immediately revert sprite to new inventory state
            setInventory((inv) => {
              const res = consumeOneItem(inv, 'poison_vial')
              requestAnimationFrame(() => applySpriteForSnapshot(res.next))
              return res.next
            })
            return
          }
          if (canAttack) {
            // If mage, ensure enough mana BEFORE triggering attack pose
            if (cls === 'mage' && neededItem === 'apprentice_staff') {
              if ((playerRef.current.mana || 0) < 20) {
                showNotice('Not enough mana.')
                return
              }
            }
            // Show attack pose and mark active; main loop will revert when time elapses
            attackUntilRef.current = now + ATTACK_DURATION_MS
            attackActiveRef.current = true
            // Cache current sprite for instant revert later
            prevSpriteImgRef.current = imagesRef.current.player
            setPlayerImageAsync(attackSprite)
            // Mage ranged projectile (fireball)
            if (cls === 'mage' && neededItem === 'apprentice_staff') {
              // Spend mana now that attack is confirmed
              playerRef.current.mana = Math.max(0, (playerRef.current.mana || 0) - 20)
              playSfx(PATHS.fireballCastSfx)
              const p = playerRef.current
              const dir = { x: lastDirRef.current.x, y: lastDirRef.current.y }
              // Default facing right if no movement yet
              if (Math.abs(dir.x) < 0.001 && Math.abs(dir.y) < 0.001) { dir.x = 1; dir.y = 0 }
              // Normalize
              const len = Math.hypot(dir.x, dir.y)
              if (len > 0) { dir.x /= len; dir.y /= len }
              const startX = p.x + p.w / 2 + dir.x * 12
              const startY = p.y + p.h / 2 + dir.y * 12
              // Spawn regardless of image preloading; DOM <img> will load via src
              projectilesRef.current.push({
                id: effectIdRef.current++,
                x: startX - 16,
                y: startY - 16,
                w: 32,
                h: 32,
                vx: dir.x * FIREBALL_SPEED,
                vy: dir.y * FIREBALL_SPEED,
                startX,
                startY,
                maxDist: FIREBALL_TRAVEL_DISTANCE,
                impactKey: 'fireSmallGif',
                domSrc: PATHS.animatedFireBallGif,
                lingerMs: FIRE_LINGER_MS,
              })
            }
          }
        }
        // Swap selected hotbar item with offhand using F (like Minecraft)
        if ((code === 'f' || code === 'F') && allowFSwapRef.current) {
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
      if (e.key === 'Escape' && chatOpen) {
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
  if (typing || titleOpenRef.current || optionsOpenRef.current || inventoryOpenRef.current || chatOpenRef.current || shopOpenRef.current) return
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

      // Revert attack pose when its duration has elapsed
      if (attackActiveRef.current && performance.now() >= attackUntilRef.current) {
        attackActiveRef.current = false
        // Immediately snap back to the cached pre-attack sprite (avoids async load lag)
        if (prevSpriteImgRef.current) {
          imagesRef.current.player = prevSpriteImgRef.current
          prevSpriteImgRef.current = null
        }
        // Then re-derive in case equipment changed
        applyCurrentSprite()
      }

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

      // Update player size relative to scene image height, preserving sprite aspect ratio
      if (sdef.playerScale && dh > 0) {
        const targetH = Math.max(24, Math.round(sdef.playerScale * dh))
        const pImgForAR = imagesRef.current.player
        const ar = (pImgForAR && pImgForAR.height) ? (pImgForAR.width / pImgForAR.height) : 1
        playerRef.current.h = targetH
        playerRef.current.w = Math.max(16, Math.round(targetH * ar))
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

      // Update (pause movement when any overlay is open)
  // Effective movement speed (speed potion boost if active)
  let speed = playerRef.current.speed
  if (performance.now() < speedBoostUntilRef.current) speed *= 1.5
      let vx = 0, vy = 0
  if (!chatOpenRef.current && !classSelectOpenRef.current && !inventoryOpenRef.current && !titleOpenRef.current && !optionsOpenRef.current && !shopOpenRef.current) {
        if (keysRef.current['w'] || keysRef.current['arrowup']) vy -= 1
        if (keysRef.current['s'] || keysRef.current['arrowdown']) vy += 1
        if (keysRef.current['a'] || keysRef.current['arrowleft']) vx -= 1
        if (keysRef.current['d'] || keysRef.current['arrowright']) vx += 1
        if (vx !== 0 || vy !== 0) {
          const len = Math.hypot(vx, vy)
          vx /= len; vy /= len
          // Update last direction for aiming
          lastDirRef.current = { x: vx, y: vy }
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

      // Mana regen for mage: 5 mana/sec
      if (selectedClassRef.current === 'mage' && (playerRef.current.manaMax || 0) > 0) {
        const regen = 5 * dt
        playerRef.current.mana = Math.min(playerRef.current.manaMax, (playerRef.current.mana || 0) + regen)
      }

      // Update projectiles (fireballs)
      if (projectilesRef.current.length) {
        const arr = projectilesRef.current
        const nowMs = performance.now()
        for (let i = arr.length - 1; i >= 0; i--) {
          const pr = arr[i]
          pr.x += pr.vx * dt
          pr.y += pr.vy * dt
          const dist = Math.hypot(pr.x + pr.w/2 - pr.startX, pr.y + pr.h/2 - pr.startY)
          // Collision with scene colliders (stop early)
          let hit = false
          for (const c of collidersPx) {
            if (intersects({ x: pr.x, y: pr.y, w: pr.w, h: pr.h }, c)) { hit = true; break }
          }
          if (dist >= pr.maxDist || hit) {
            // Spawn lingering effect and remove projectile
            const isPoison = pr.impactKey === 'poisonPotionGif'
            const src = isPoison ? PATHS.poisonPotionGif : PATHS.animatedFireSmallGif
            const centerX = pr.x + pr.w / 2
            const centerY = pr.y + pr.h / 2
            const scale = isPoison ? 1.0 : 1.75 // enlarge small fire by 25%
            const newW = Math.round(pr.w * scale)
            const newH = Math.round(pr.h * scale)
            const nx = centerX - newW / 2
            const ny = centerY - newH / 2
            firesRef.current.push({
              id: effectIdRef.current++,
              x: nx, y: ny, w: newW, h: newH,
              until: nowMs + (pr.lingerMs || FIRE_LINGER_MS),
              domSrc: src,
            })
            playSfx(PATHS.fireImpactSfx)
            arr.splice(i, 1)
          }
        }
      }

      // Expire fires
      if (firesRef.current.length) {
        const nowMs = performance.now()
        firesRef.current = firesRef.current.filter(f => nowMs < f.until)
      }

  // Clamp movement to the image frame so we never drift outside the visible area
  playerRef.current.x = Math.min(Math.max(playerRef.current.x, dx), dx + dw - playerRef.current.w)
  playerRef.current.y = Math.min(Math.max(playerRef.current.y, dy), dy + dh - playerRef.current.h)

      // Consumable handling (hold E to consume selected potion)
      const eDown = !!(keysRef.current['e'])
      const selected = inventoryRef.current?.hotbar?.[activeHotbarRef.current]
      const canConsumeNow = !!(selected && CONSUMABLE_IDS.has(selected.id)) && !chatOpenRef.current && !shopOpenRef.current && !titleOpenRef.current && !optionsOpenRef.current && !inventoryOpenRef.current
      const nowMs = performance.now()
      if (!eDown && consumeNeedsReleaseRef.current) {
        consumeNeedsReleaseRef.current = false
      }
      if (!consumeActiveRef.current) {
        if (eDown && !consumeNeedsReleaseRef.current && canConsumeNow) {
          consumeActiveRef.current = true
          consumeStartRef.current = nowMs
          consumeItemRef.current = { id: selected.id, slot: activeHotbarRef.current }
        }
      } else {
        const slot = consumeItemRef.current?.slot
        const id = consumeItemRef.current?.id
        const stillValid = canConsumeNow && slot === activeHotbarRef.current && (inventoryRef.current?.hotbar?.[slot]?.id === id)
        if (!eDown || !stillValid) {
          // Cancel if released or item/slot changed
          consumeActiveRef.current = false
          if (!eDown) consumeNeedsReleaseRef.current = false
        } else {
          const progress = (nowMs - consumeStartRef.current) / CONSUME_DURATION_MS
          if (progress >= 1) {
            // Complete: consume one from that hotbar slot
            const slotIdx = slot
            const itemId = id
            setInventory((inv) => {
              const cur = inv.hotbar[slotIdx]
              if (!cur || cur.id !== itemId) return inv
              const cnt = (cur.count || 1) - 1
              const next = { armor: { ...inv.armor }, storage: inv.storage.slice(), hotbar: inv.hotbar.slice() }
              next.hotbar[slotIdx] = cnt > 0 ? { id: itemId, count: cnt } : null
              return next
            })
            // Apply effects
            if (id === 'speed_potion') {
              speedBoostUntilRef.current = nowMs + 10000 // 10s boost
            } else if (id === 'mana_potion') {
              // Restore 75 mana (clamped to manaMax)
              const mm = playerRef.current.manaMax || 0
              if (mm > 0) {
                const cur = playerRef.current.mana || 0
                playerRef.current.mana = Math.min(mm, cur + 75)
              }
            } else if (id === 'healing_potion') {
              // Restore 50 health (clamped to hpMax)
              const hm = playerRef.current.hpMax || 0
              if (hm > 0) {
                const cur = playerRef.current.hp || 0
                playerRef.current.hp = Math.min(hm, cur + 50)
              }
            }
            // Reset consumption; require release before next start
            consumeActiveRef.current = false
            consumeNeedsReleaseRef.current = true
          }
        }
      }

      // Interact (E) — disabled only while actively consuming
      if (!chatOpenRef.current && !shopOpenRef.current && eDown && !interactLatch && !consumeActiveRef.current) {
        interactLatch = true
        // Village enter door
        if (sceneRef.current === 'village' && sdef.door) {
          const doorPx = mapRect(sdef.door)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, doorPx)) {
            sdef.onEnter?.()
          }
        }
        // Village south travel to path scene
        if (sceneRef.current === 'village' && sdef.toPath) {
          const zonePx = mapRect(sdef.toPath)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            // Save current village position in normalized coords so we can return here later
            const pxCenterX = playerRef.current.x + playerRef.current.w / 2
            const pxCenterY = playerRef.current.y + playerRef.current.h / 2
            const nx = Math.max(0, Math.min(1, (pxCenterX - dx) / dw))
            const ny = Math.max(0, Math.min(1, (pxCenterY - dy) / dh))
            lastVillagePosRef.current = { nx, ny }
            sdef.onTravelSouth?.()
          }
        }
        // Village enter market
        if (sceneRef.current === 'village' && sdef.toMarket) {
          const zonePx = mapRect(sdef.toMarket)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onEnterMarket?.()
          }
        }
        // Tavern exit
        if (sceneRef.current === 'tavern' && sdef.exit) {
          const exitPx = mapRect(sdef.exit)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, exitPx)) {
            sdef.onExit?.()
          }
        }
        // Path enter dungeon
        if (sceneRef.current === 'path' && sdef.toDungeon) {
          const dz = mapRect(sdef.toDungeon)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, dz)) {
            sdef.onEnterDungeon?.()
          }
        }
        // Path return to village
        if (sceneRef.current === 'path' && sdef.toVillage) {
          const zonePx = mapRect(sdef.toVillage)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onReturn?.()
          }
        }
        // Market exit to village (bottom-middle)
        if (sceneRef.current === 'market' && sdef.toVillage) {
          const zonePx = mapRect(sdef.toVillage)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onExitToVillage?.()
          }
        }
        // Dungeon exit back to path (near spawn)
        if (sceneRef.current === 'dungeon' && sdef.toPath) {
          const zonePx = mapRect(sdef.toPath)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onExitToPath?.()
          }
        }
        // Dungeon enter interior at top-center
        if (sceneRef.current === 'dungeon' && sdef.toInterior) {
          const zonePx = mapRect(sdef.toInterior)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onEnterInterior?.()
          }
        }
        // Dungeon secret entrance to tavern (now hidden treasure room) at top-left
        if (sceneRef.current === 'dungeon' && sdef.toTavern) {
          const zonePx = mapRect(sdef.toTavern)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            // Save the exact dungeon position (normalized) to return to after leaving the treasure room
            const pxCenterX = playerRef.current.x + playerRef.current.w / 2
            const pxCenterY = playerRef.current.y + playerRef.current.h / 2
            const nx = Math.max(0, Math.min(1, (pxCenterX - dx) / dw))
            const ny = Math.max(0, Math.min(1, (pxCenterY - dy) / dh))
            treasureReturnPosRef.current = { nx, ny }
            sdef.onEnterTavern?.()
          }
        }
        // Dungeon interior exit back to entrance (bottom-center)
        if (sceneRef.current === 'dungeonInterior' && sdef.toEntrance) {
          const zonePx = mapRect(sdef.toEntrance)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onExitToEntrance?.()
          }
        }
        // Treasure room exit back to dungeon entrance
        if (sceneRef.current === 'treasureRoom' && sdef.toEntrance) {
          const zonePx = mapRect(sdef.toEntrance)
          if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, zonePx)) {
            sdef.onExitToEntrance?.()
          }
        }
        // Treasure room chests (open with E)
        if (sceneRef.current === 'treasureRoom' && Array.isArray(sdef.treasureChests)) {
          for (let i = 0; i < sdef.treasureChests.length; i++) {
            if (isChestOpened(i)) continue
            const chest = sdef.treasureChests[i]
            const cpx = mapRect(chest.rect)
            const playerBox = { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }
            if (intersects(playerBox, cpx)) {
              if (chest.locked) {
                const invSnapshot = inventoryRef.current
                const res = consumeOneItem(invSnapshot, 'lockpicks')
                if (!res.consumed) {
                  showNotice('Locked. Requires lockpicks.')
                  break
                }
                setInventory(res.next)
              }

              const loot = rollGemLoot()
              const gemParts = []

              if (chest.locked) {
                // Locked chests grant extra gems and rare potions
                loot.ruby += 8
                loot.sapphire += 8
                loot.emerald += 8
              }

              if (loot.ruby) gemParts.push(`${loot.ruby} Rub${loot.ruby>1?'ies':'y'}`)
              if (loot.sapphire) gemParts.push(`${loot.sapphire} Sapphire${loot.sapphire>1?'s':''}`)
              if (loot.emerald) gemParts.push(`${loot.emerald} Emerald${loot.emerald>1?'s':''}`)

              const potionRewards = chest.locked ? [
                { id: 'healing_potion', count: 1 },
                { id: 'poison_vial', count: 1 },
                { id: 'speed_potion', count: 1 },
              ] : []

              const overflow = grantLoot(loot, potionRewards)
              const overflowNames = overflow.map(({ id, count }) => `${count}x ${getItemDef(id).name}`)

              if (chest.locked) {
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

              markChestOpened(i)
              break
            }
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
        // Market vendor interact -> open shop overlay
        if (sceneRef.current === 'market' && sdef.vendor) {
          const vz = mapRect(sdef.vendor)
          const playerBox = { x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }
          if (intersects(playerBox, vz)) {
            setShopOpen(true)
            markVendorActivity()
            playVendor('Greeting')
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

      // Note: animated effects (projectiles/fires) are rendered as DOM <img> overlays for proper GIF animation.

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

      // Draw consumption progress (small circular bar above player)
      if (consumeActiveRef.current) {
        const cx = playerRef.current.x + playerRef.current.w / 2
        const cy = playerRef.current.y - 16
        const r = 10
        const t = (performance.now() - consumeStartRef.current) / CONSUME_DURATION_MS
        const frac = Math.max(0, Math.min(1, t))
        ctx.save()
        ctx.lineWidth = 3
        // background circle
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        // progress arc
        ctx.strokeStyle = 'rgba(251,191,36,0.9)' // amber-400
        ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + frac * Math.PI * 2); ctx.stroke()
        ctx.restore()
      }

      // UI hints (only after class is selected and start screen closed)
      if (!titleOpenRef.current && !classSelectOpenRef.current) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(8, 8, 380, 56)
        ctx.fillStyle = '#fff'
        ctx.font = '14px sans-serif'
        ctx.fillText('WASD: Move    E: Interact    V: Inventory', 16, 28)
        let hudLine = ''
        if (sceneRef.current === 'village') {
          hudLine = 'Find the tavern door or travel south; press E when prompted'
        } else if (sceneRef.current === 'tavern') {
          hudLine = 'Explore the tavern. Press E near bottom to exit'
        } else if (sceneRef.current === 'path') {
          hudLine = 'Walk the path. Press E near top to return or near bottom to enter dungeon'
        } else if (sceneRef.current === 'dungeon') {
          hudLine = 'Dungeon entrance. Press E near bottom-left to return to path'
        } else if (sceneRef.current === 'dungeonInterior') {
          hudLine = 'Dungeon interior. Press E near bottom to exit to entrance'
        } else if (sceneRef.current === 'treasureRoom') {
          hudLine = 'Hidden treasure room. Press E near top to exit'
        }
        ctx.fillText(hudLine, 16, 50)
      }

      // Door/exit/travel prompts for current scene
      const prompts = []
      if (sceneRef.current === 'village') {
        if (sdef.door) prompts.push({ rect: sdef.door, label: 'Press E to enter' })
        if (sdef.toPath) prompts.push({ rect: sdef.toPath, label: 'Press E to travel' })
        if (sdef.toMarket) prompts.push({ rect: sdef.toMarket, label: 'Press E to enter market' })
      } else if (sceneRef.current === 'tavern') {
        if (sdef.exit) prompts.push({ rect: sdef.exit, label: 'Press E to exit' })
      } else if (sceneRef.current === 'market') {
        if (sdef.toVillage) prompts.push({ rect: sdef.toVillage, label: 'Press E to exit' })
        if (sdef.vendor) prompts.push({ rect: sdef.vendor, label: 'Press E to talk to vendor' })
      } else if (sceneRef.current === 'path') {
        if (sdef.toVillage) prompts.push({ rect: sdef.toVillage, label: 'Press E to return' })
        if (sdef.toDungeon) prompts.push({ rect: sdef.toDungeon, label: 'Press E to enter dungeon' })
      } else if (sceneRef.current === 'dungeon') {
        if (sdef.toPath) prompts.push({ rect: sdef.toPath, label: 'Press E to return' })
        if (sdef.toInterior) prompts.push({ rect: sdef.toInterior, label: 'Press E to enter dungeon' })
        if (sdef.toTavern) prompts.push({ rect: sdef.toTavern, label: 'Press E to enter hidden room' })
      } else if (sceneRef.current === 'dungeonInterior') {
        if (sdef.toEntrance) prompts.push({ rect: sdef.toEntrance, label: 'Press E to exit' })
      } else if (sceneRef.current === 'treasureRoom') {
        if (sdef.toEntrance) prompts.push({ rect: sdef.toEntrance, label: 'Press E to exit' })
        if (Array.isArray(sdef.treasureChests)) {
          sdef.treasureChests.forEach((ch, i) => {
            if (isChestOpened(i)) return
            prompts.push({ rect: ch.rect, label: ch.locked ? 'Press E to pick lock' : 'Press E to open chest' })
          })
        }
      }
      for (const p of prompts) {
        const pr = mapRect(p.rect)
        if (intersects({ x: playerRef.current.x, y: playerRef.current.y, w: playerRef.current.w, h: playerRef.current.h }, pr)) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'
          const tw = ctx.measureText(p.label).width + 16
          ctx.fillRect(pr.x, pr.y - 24, Math.max(140, tw), 20)
          ctx.fillStyle = '#ffeb99'
          ctx.font = '12px sans-serif'
          ctx.fillText(p.label, pr.x + 8, pr.y - 10)
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

  // Clear lingering projectile/fire effects when changing scenes
  useEffect(() => {
    projectilesRef.current = []
    firesRef.current = []
  }, [scene])

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

  // Topic-aware RAG hints for better retrieval on short follow-ups
  const TOPIC_RAG_HINTS = {
    dragon: 'Ashfang Cavern, Blackspire Mountains, dragon raids, goblins, traps, hoard, Sword of Aeltharion',
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
      const res = await apiSendChat(payload)
      const reply = res?.reply || ''
      setChatMessages(msgs => [...msgs, { role: 'assistant', content: reply }])
      // Speak bartender reply (text-to-speech)
      if (ttsEnabled && reply) {
        // Prefer streaming playback via MediaSource; fall back to blob if unavailable
        const mime = 'audio/mpeg'
        const canStream = typeof window !== 'undefined' && window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' && window.MediaSource.isTypeSupported(mime)
        if (canStream) {
          try {
            const bodyStream = await apiStreamTTS({ text: reply })
            await playStreamingAudio(bodyStream, { mime, volume: Math.max(0, Math.min(1, (ttsVolume || 100) / 100)) })
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') console.warn('[TTS] Streaming failed, falling back to blob:', e?.message || e)
            // Fallback to blob-based playback
            try {
              const audioBlob = await apiFetchTTS({ text: reply })
              const url = URL.createObjectURL(audioBlob)
              const audio = new Audio(url)
              audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
              audio.volume = Math.max(0, Math.min(1, (ttsVolume || 100) / 100))
              await audio.play().catch(() => {/* autoplay may block */})
            } catch (e2) {
              if (process.env.NODE_ENV !== 'production') console.warn('[TTS] Fallback playback failed:', e2?.message || e2)
            }
          }
        } else {
          // No MSE support: fallback
          try {
            const audioBlob = await apiFetchTTS({ text: reply })
            const url = URL.createObjectURL(audioBlob)
            const audio = new Audio(url)
            audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
            audio.volume = Math.max(0, Math.min(1, (ttsVolume || 100) / 100))
            await audio.play().catch(() => {/* autoplay may block */})
          } catch (e) {
            if (process.env.NODE_ENV !== 'production') console.warn('[TTS] Failed to play audio:', e?.message || e)
          }
        }
      }
    } catch (err) {
      setChatMessages(msgs => [...msgs, { role: 'assistant', content: `Bartender (annoyed): ${err.message}` }])
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
        {/* Animated effects layer (GIFs rendered as DOM images so they animate) */}
  <div className="pointer-events-none absolute inset-0 z-10">
          {/* Projectiles */}
          {effectsTick >= 0 && projectilesRef.current.map((pr) => (
            <img
              key={pr.id}
              src={pr.domSrc}
              alt="effect"
              className="absolute select-none"
              style={{ left: pr.x, top: pr.y, width: pr.w, height: pr.h, imageRendering: 'pixelated' }}
            />
          ))}
          {/* Lingering fires/poison */}
          {effectsTick >= 0 && firesRef.current.map((f) => (
            <img
              key={f.id}
              src={f.domSrc}
              alt="effect"
              className="absolute select-none"
              style={{ left: f.x, top: f.y, width: f.w, height: f.h, imageRendering: 'pixelated' }}
            />
          ))}
        </div>
        {chatOpen && (
          <div className="absolute inset-0 flex items-end md:items-center justify-center p-4 md:p-6 z-20">
            <div className="w-full max-w-2xl bg-stone-900/90 backdrop-blur rounded-xl border border-amber-900/40 shadow-lg shadow-black/50">
              <div className="px-4 py-3 border-b border-amber-900/40 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl text-amber-200">Tharos the Bartender</h3>
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
        {/* Centered animated fire GIF in dungeon interior */}
        {scene === 'dungeonInterior' && (
          <img
            src={PATHS.animatedFireSmallGif}
            alt="Animated Fire"
            className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 96, height: 96, imageRendering: 'pixelated' }}
          />
        )}
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
                <div className="text-stone-400 text-xs">Left-click: drag/swap/merge • Right-click: split stack or place one</div>
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
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">R {inventoryTotals.ruby||0}</span>
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">S {inventoryTotals.sapphire||0}</span>
                <span className="px-2 py-0.5 rounded bg-stone-800/80 border border-amber-900/40 text-amber-200">E {inventoryTotals.emerald||0}</span>
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
                  const price = MARKET_PRICES[it.id] || { ruby:0,sapphire:0,emerald:0 }
                  const afford = canAfford(inventory, price)
                  const space = hasSpaceForItem(inventory, it.id)
                  return (
                    <div key={it.id} className="rounded-xl border border-amber-900/40 bg-stone-800/70 p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <img src={def.icon} alt={def.name} className="w-10 h-10 object-contain" onError={(e)=>{ e.currentTarget.style.display='none' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-amber-200 font-medium truncate">{def.name}</div>
                          <div className="text-xs text-stone-300/80 flex gap-2 mt-0.5">
                            {price.ruby>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">R {price.ruby}</span>}
                            {price.sapphire>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">S {price.sapphire}</span>}
                            {price.emerald>0 && <span className="px-1 rounded bg-stone-900/60 border border-amber-900/40">E {price.emerald}</span>}
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
            Loading assets…
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
                fps={12}
                playing={titleOpen}
                alt="Animated Sword"
                className="absolute left-[70%] top-1/2 -translate-y-0 w-[300px] h-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
              />
              {/* Replace text with provided title image */}
              <img
                src={ASSETS.titleLogo}
                alt="Heroes of Hollowvale"
                className="w-[85%] max-w-[700px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] transform -translate-y-6 md:-translate-y-10"
              />
              <div className="flex gap-4">
                <button
                  onClick={() => { setTitleOpen(false); setClassSelectOpen(true) }}
                  className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold shadow-lg shadow-amber-900/30"
                >Start Game</button>
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
                <label className="block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-stone-200">Music volume</span>
                    <span className="text-stone-300/80 text-sm">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </label>
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

        {/* Dungeon scene uses E-interact zone; no overlay button needed */}

        {/* Global Options button on all non-intro screens */}
        {!titleOpen && (
          <div className="absolute top-3 right-3 z-30">
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
                    width: `${Math.max(0, Math.min(100, (playerRef.current.hp / playerRef.current.hpMax) * 100 || 0))}%`,
                    backgroundColor: 'rgba(185, 28, 28, 0.9)' // darker red (~red-700) with slight opacity
                  }}
                />
                {/* subtle shine */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(0,0,0,0.05))' }} />
                {/* tick marks at 25/50/75 HP */}
                {(playerRef.current.hpMax || 100) >= 25 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 25 / (playerRef.current.hpMax || 100))) * 100}%`,
                      transform: 'translateX(-1px)',
                      zIndex: 2,
                    }}
                  />
                )}
                {(playerRef.current.hpMax || 100) >= 50 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 50 / (playerRef.current.hpMax || 100))) * 100}%`,
                      transform: 'translateX(-1px)',
                      zIndex: 2,
                    }}
                  />
                )}
                {(playerRef.current.hpMax || 100) >= 75 && (
                  <div
                    className="absolute bg-stone-200/70"
                    style={{
                      width: 2,
                      height: 10,
                      top: 1,
                      left: `${Math.max(0, Math.min(1, 75 / (playerRef.current.hpMax || 100))) * 100}%`,
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
                  title={`Mana: ${Math.floor(playerRef.current.mana || 0)}/${playerRef.current.manaMax || 0}`}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#1e3a8a ${(Math.max(0, Math.min(1, (playerRef.current.mana || 0) / (playerRef.current.manaMax || 1)))) * 360}deg, transparent 0deg)`,
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
                onMouseDown={(e)=>handleSlotMouseDown(e,'armor','offhand')}
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
                  <span className="text-stone-500 text-[10px]">offhand</span>
                )}
                {inventory.armor.offhand?.count > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 text-[10px] px-1 rounded bg-stone-900/80 text-amber-200">
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
                    onMouseDown={(e)=>handleSlotMouseDown(e,'hotbar',idx)}
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
                    <span className="absolute top-0.5 left-1 text-[10px] text-stone-400">{idx+1}</span>
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
                <span className="absolute bottom-0.5 right-0.5 text-[10px] px-1 rounded bg-stone-900/90 text-amber-200">{invDrag.item.count}</span>
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

// Stream an MP3 over a ReadableStream into MediaSource for immediate playback
async function playStreamingAudio(readableStream, { mime = 'audio/mpeg', volume = 1.0 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const mediaSource = new MediaSource()
      const url = URL.createObjectURL(mediaSource)
      const audio = new Audio(url)
      audio.volume = Math.max(0, Math.min(1, volume))

      let sourceBuffer = null
      let reader = null
      const queue = []
      let streamEnded = false

      const onError = (e) => {
        try { URL.revokeObjectURL(url) } catch {}
        reject(e instanceof Error ? e : new Error(String(e)))
      }

      mediaSource.addEventListener('sourceopen', async () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mime)
          reader = readableStream.getReader()

          const feed = () => {
            if (!sourceBuffer || sourceBuffer.updating) return
            const chunk = queue.shift()
            if (chunk) {
              try { sourceBuffer.appendBuffer(chunk) } catch (e) { onError(e) }
            } else if (streamEnded) {
              try { mediaSource.endOfStream() } catch {}
            }
          }

          sourceBuffer.addEventListener('updateend', feed)

          // Start pulling chunks
          ;(async function pump() {
            try {
              while (true) {
                const { value, done } = await reader.read()
                if (done) {
                  streamEnded = true
                  feed()
                  break
                }
                const chunk = value && value.buffer ? new Uint8Array(value.buffer) : new Uint8Array(value || [])
                queue.push(chunk)
                feed()
              }
            } catch (e) {
              onError(e)
            }
          })()
        } catch (e) {
          onError(e)
        }
      }, { once: true })

      audio.addEventListener('ended', () => {
        try { URL.revokeObjectURL(url) } catch {}
        resolve()
      }, { once: true })
      audio.addEventListener('error', (e) => onError(new Error('Audio element error')), { once: true })

      // Try to begin playback; browser may wait for buffer
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.catch(() => { /* autoplay might be blocked; user gesture will start it */ })
      }
    } catch (e) {
      reject(e)
    }
  })
}

