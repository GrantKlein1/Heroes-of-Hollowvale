import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import thiefLockpickAtlas from '../../../../public/assets/characters/thief/thief_use_lockpick.json'
import dwarfPickaxeAtlas from '../../../../public/assets/characters/dwarf/dwarf_use_pickaxe.json'
import {
  MINE_GEMS,
  TOOLS,
  canUseTool,
  expandedRect,
  findToolTarget,
  isLockedTarget,
  isMineableTarget,
  locateMineVisual,
  PICKAXE_FRAME_EVENT,
  pickaxeContactIndex,
  readLockpickTiming,
  readPickaxeFrame,
  readPickaxeTiming,
  rectsOverlap,
  rollMineLoot,
  stepLockpick,
  stepPickaxe,
  toolShouldCancel,
  watchPickaxeContact,
} from '../toolUse.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

describe('tool use timings from sheet meta (B10-2)', () => {
  const lock = thiefLockpickAtlas.meta.anims.use_lockpick
  const pick = dwarfPickaxeAtlas.meta.anims.use_pickaxe

  it('reads the lockpick start-loop-end lengths and opens at the end of the loop', () => {
    const timing = readLockpickTiming(lock)
    expect(timing.startMs).toBe(lock.durationMsStart)
    expect(timing.loopMs).toBe(lock.durationMsLoop)
    expect(timing.endMs).toBe(lock.durationMsEnd)
    expect(timing.unlockMs).toBe(lock.durationMsStart + lock.durationMsLoop)
    expect(timing.totalMs).toBe(lock.durationMsStart + lock.durationMsLoop + lock.durationMsEnd)
    expect(timing.startFrames).toBe(4)
    expect(timing.loopFrames).toBe(6)
    expect(timing.endFrames).toBe(4)
    expect(timing.unlockMs).toBe(833)
    expect(timing.totalMs).toBe(1166)
  })

  it('reads pickaxe contact as the frames before effectFrame', () => {
    const timing = readPickaxeTiming(pick)
    const expected = pick.durations.slice(0, pick.effectFrame).reduce((sum, n) => sum + n, 0)
    expect(pick.effectFrame).toBe(4)
    expect(pick.contactFrame).toBe(4)
    expect(pick.fps).toBe(12)
    expect(timing.effectMs).toBe(expected)
    expect(timing.effectMs).toBe(333)
    expect(timing.totalMs).toBe(pick.durations.reduce((sum, n) => sum + n, 0))
    expect(timing.effectFrame).toBe(4)
  })

  it('returns null when the sheet meta has no phase or contact data', () => {
    expect(readLockpickTiming(null)).toBeNull()
    expect(readLockpickTiming({ fps: 12 })).toBeNull()
    expect(readPickaxeTiming({ fps: 12, frames: 8 })).toBeNull()
  })

  it('derives lockpick phase lengths from frames and fps when durations are absent', () => {
    const timing = readLockpickTiming({
      fps: 12,
      startFrames: 4,
      loopFrames: 6,
      endFrames: 4,
    })
    expect(timing.startMs).toBeCloseTo(4 * (1000 / 12))
    expect(timing.unlockMs).toBeCloseTo(10 * (1000 / 12))
    expect(timing.totalMs).toBeCloseTo(14 * (1000 / 12))
  })
})

describe('tool use steps (B10-2)', () => {
  const lockTiming = readLockpickTiming(thiefLockpickAtlas.meta.anims.use_lockpick)
  const pickTiming = readPickaxeTiming(dwarfPickaxeAtlas.meta.anims.use_pickaxe)

  it('allows only the thief to lockpick and only the dwarf to mine', () => {
    expect(canUseTool('thief', 'lockpick')).toBe(true)
    expect(canUseTool('dwarf', 'pickaxe')).toBe(true)
    expect(canUseTool('knight', 'lockpick')).toBe(false)
    expect(canUseTool('mage', 'pickaxe')).toBe(false)
    expect(canUseTool('thief', 'pickaxe')).toBe(false)
    expect(canUseTool('dwarf', 'lockpick')).toBe(false)
    expect(TOOLS.lockpick.itemId).toBe('lockpicks')
    expect(TOOLS.pickaxe.itemId).toBe('dwarf_pickaxe')
  })

  it('cancels a lockpick before the loop ends and unlocks once at the end of the loop', () => {
    const early = stepLockpick({
      elapsed: 200,
      timing: lockTiming,
      holding: false,
      inRange: true,
      interrupted: false,
      unlocked: false,
    })
    expect(early).toEqual({ action: 'cancel', unlock: false, unlocked: false })

    const moved = stepLockpick({
      elapsed: lockTiming.unlockMs - 1,
      timing: lockTiming,
      holding: true,
      inRange: true,
      interrupted: true,
      unlocked: false,
    })
    expect(moved.action).toBe('cancel')
    expect(moved.unlock).toBe(false)

    const opening = stepLockpick({
      elapsed: lockTiming.unlockMs,
      timing: lockTiming,
      holding: true,
      inRange: true,
      interrupted: false,
      unlocked: false,
    })
    expect(opening.unlock).toBe(true)
    expect(opening.unlocked).toBe(true)
    expect(opening.action).toBe('continue')

    const again = stepLockpick({
      elapsed: lockTiming.unlockMs + 50,
      timing: lockTiming,
      holding: true,
      inRange: true,
      interrupted: false,
      unlocked: true,
    })
    expect(again.unlock).toBe(false)
    expect(again.action).toBe('continue')

    const done = stepLockpick({
      elapsed: lockTiming.totalMs,
      timing: lockTiming,
      holding: true,
      inRange: true,
      interrupted: false,
      unlocked: true,
    })
    expect(done.action).toBe('complete')
    expect(done.unlock).toBe(false)
  })

  it('fires the pickaxe effect once at the contact time and cancels earlier swings', () => {
    const early = stepPickaxe({
      elapsed: pickTiming.effectMs - 1,
      timing: pickTiming,
      interrupted: true,
      effectFired: false,
    })
    expect(early).toEqual({ action: 'cancel', effect: false })

    const contact = stepPickaxe({
      elapsed: pickTiming.effectMs,
      timing: pickTiming,
      interrupted: false,
      effectFired: false,
    })
    expect(contact.effect).toBe(true)
    expect(contact.action).toBe('continue')

    const second = stepPickaxe({
      elapsed: pickTiming.effectMs + 16,
      timing: pickTiming,
      interrupted: false,
      effectFired: true,
    })
    expect(second.effect).toBe(false)

    const landed = stepPickaxe({
      elapsed: pickTiming.totalMs,
      timing: pickTiming,
      interrupted: false,
      effectFired: true,
    })
    expect(landed).toEqual({ action: 'complete', effect: false })
  })

  it('treats hurt, dodge, and movement after the start as interrupts', () => {
    expect(toolShouldCancel({ hurt: true, elapsed: 10 })).toBe(true)
    expect(toolShouldCancel({ dodge: true, elapsed: 10 })).toBe(true)
    expect(toolShouldCancel({ moving: true, elapsed: 16 })).toBe(true)
    expect(toolShouldCancel({ moving: true, elapsed: 0 })).toBe(false)
    expect(toolShouldCancel({ elapsed: 100 })).toBe(false)
  })

  it('rolls exactly one gem from the mine table', () => {
    const rolls = [0, 0.34, 0.67, 0.99].map((n) => rollMineLoot(() => n))
    expect(rolls.map((row) => row.id)).toEqual(['ruby', 'sapphire', 'emerald', 'emerald'])
    for (const row of rolls) {
      const count = row.gems.ruby + row.gems.sapphire + row.gems.emerald
      expect(count).toBe(1)
      expect(row.items).toEqual([])
      expect(MINE_GEMS).toContain(row.id)
    }
    const again = rollMineLoot(() => 0)
    expect(again).toEqual(rolls[0])
  })
})

function frameEmitter() {
  const listeners = new Map()
  return {
    on(event, fn) {
      const list = listeners.get(event) || []
      list.push(fn)
      listeners.set(event, list)
    },
    off(event, fn) {
      const list = (listeners.get(event) || []).filter((item) => item !== fn)
      listeners.set(event, list)
    },
    emit(event, ...args) {
      for (const fn of [...(listeners.get(event) || [])]) fn(...args)
    },
  }
}

function pickaxeUpdate(animKey, frameName) {
  return [
    { key: animKey },
    { textureFrame: frameName, frame: { name: frameName } },
    null,
    frameName,
  ]
}

describe('pickaxe contact follows the animation frame (PICKAXE-FRAME-1)', () => {
  const timing = readPickaxeTiming(dwarfPickaxeAtlas.meta.anims.use_pickaxe)

  it('fires the effect once when the frame event reaches the contact frame', () => {
    const contacts = []
    const sprite = frameEmitter()
    let cancelled = false
    const unbind = watchPickaxeContact(sprite, {
      classId: 'dwarf',
      effectFrame: timing.effectFrame,
      isCancelled: () => cancelled,
      onContact: (index) => contacts.push(index),
    })

    sprite.emit(PICKAXE_FRAME_EVENT, ...pickaxeUpdate('dwarf_use_pickaxe_down', 'dwarf_use_pickaxe_down_3'))
    expect(contacts).toEqual([])
    expect(pickaxeContactIndex(
      { key: 'dwarf_idle_down' },
      { textureFrame: 'dwarf_idle_down_0' },
      'dwarf_idle_down_0',
      'dwarf',
      timing.effectFrame,
    )).toBe(-1)

    const behind = stepPickaxe({
      elapsed: timing.effectMs + 400,
      timing,
      interrupted: false,
      effectFired: false,
      onClip: true,
      frameIndex: 3,
      animPlayable: true,
    })
    expect(behind).toEqual({ action: 'continue', effect: false })

    sprite.emit(PICKAXE_FRAME_EVENT, ...pickaxeUpdate('dwarf_use_pickaxe_down', 'dwarf_use_pickaxe_down_4'))
    sprite.emit(PICKAXE_FRAME_EVENT, ...pickaxeUpdate('dwarf_use_pickaxe_down', 'dwarf_use_pickaxe_down_5'))
    expect(contacts).toEqual([4])

    const player = { classId: 'dwarf', anims: { currentFrame: { frame: { name: 'dwarf_use_pickaxe_down_4' } } } }
    expect(readPickaxeFrame(player).onClip).toBe(true)
    expect(readPickaxeFrame(player).frameIndex).toBe(4)

    const hit = stepPickaxe({
      elapsed: timing.effectMs - 40,
      timing,
      interrupted: false,
      effectFired: false,
      onClip: true,
      frameIndex: contacts[0],
      animPlayable: true,
    })
    expect(hit).toEqual({ action: 'continue', effect: true })

    const again = stepPickaxe({
      elapsed: timing.totalMs,
      timing,
      interrupted: false,
      effectFired: true,
      onClip: true,
      frameIndex: 6,
      animPlayable: true,
    })
    expect(again).toEqual({ action: 'complete', effect: false })
    unbind()
  })

  it('uses the timer only when the use_pickaxe clip cannot play', () => {
    const waiting = stepPickaxe({
      elapsed: timing.effectMs - 1,
      timing,
      interrupted: false,
      effectFired: false,
      onClip: false,
      frameIndex: -1,
      animPlayable: false,
    })
    expect(waiting).toEqual({ action: 'continue', effect: false })

    const due = stepPickaxe({
      elapsed: timing.effectMs,
      timing,
      interrupted: false,
      effectFired: false,
      onClip: false,
      frameIndex: -1,
      animPlayable: false,
    })
    expect(due.effect).toBe(true)
    expect(due.action).toBe('continue')

    const stalled = stepPickaxe({
      elapsed: timing.totalMs,
      timing,
      interrupted: false,
      effectFired: false,
      onClip: true,
      frameIndex: 2,
      animPlayable: true,
    })
    expect(stalled).toEqual({ action: 'continue', effect: false })
  })

  it('does not fire after the swing is cancelled', () => {
    const contacts = []
    const sprite = frameEmitter()
    let cancelled = false
    const unbind = watchPickaxeContact(sprite, {
      classId: 'dwarf',
      effectFrame: timing.effectFrame,
      isCancelled: () => cancelled,
      onContact: (index) => contacts.push(index),
    })

    const blocked = stepPickaxe({
      elapsed: timing.totalMs,
      timing,
      interrupted: true,
      effectFired: false,
      onClip: true,
      frameIndex: timing.effectFrame,
      animPlayable: true,
    })
    expect(blocked).toEqual({ action: 'cancel', effect: false })

    cancelled = true
    sprite.emit(PICKAXE_FRAME_EVENT, ...pickaxeUpdate('dwarf_use_pickaxe_down', 'dwarf_use_pickaxe_down_4'))
    expect(contacts).toEqual([])

    unbind()
    cancelled = false
    sprite.emit(PICKAXE_FRAME_EVENT, ...pickaxeUpdate('dwarf_use_pickaxe_left', 'dwarf_use_pickaxe_left_7'))
    expect(contacts).toEqual([])
  })
})

describe('tool targets (B10-2)', () => {
  const box = { x: 140, y: 140, w: 20, h: 16 }
  const zone = {
    id: 9,
    name: 'chest_lock',
    x: 120,
    y: 132,
    width: 80,
    height: 40,
    properties: { locked: true },
  }
  const rock = {
    id: 3,
    name: 'cavern_rock_large_a',
    x: 160,
    y: 592,
    width: 64,
    height: 48,
    raw: { properties: [{ name: 'mineable', type: 'bool', value: true }] },
  }

  it('finds a locked zone and a mineable prop the hero is standing on', () => {
    expect(isLockedTarget(zone)).toBe(true)
    expect(isMineableTarget(rock)).toBe(true)
    expect(findToolTarget('lockpick', [zone], [], box)).toBe(zone)
    expect(findToolTarget('pickaxe', [], [rock], { x: 180, y: 600, w: 20, h: 16 })).toBe(rock)
    zone.opened = true
    expect(isLockedTarget(zone)).toBe(false)
    expect(findToolTarget('lockpick', [zone], [], box)).toBeNull()
    rock.mined = true
    expect(isMineableTarget(rock)).toBe(false)
  })

  it('matches the prop sprite and footprint body at the prop feet', () => {
    const sprite = { x: 192, y: 640 }
    const body = { id: 'body' }
    const loader = {
      propSprites: [sprite],
      propFootprints: [{ id: 3 }],
      propGroup: { getChildren: () => [body] },
    }
    expect(locateMineVisual(loader, rock)).toEqual({ x: 192, y: 640, sprite, body })
    expect(rectsOverlap(box, expandedRect({ x: 120, y: 132, w: 80, h: 40 }))).toBe(true)
  })

  it('ships one locked chest zone and one mineable cavern rock', () => {
    const treasure = JSON.parse(fs.readFileSync(path.join(repoRoot, 'client/public/maps/cavern_treasure.tmj'), 'utf8'))
    const mouth = JSON.parse(fs.readFileSync(path.join(repoRoot, 'client/public/maps/cavern_mouth.tmj'), 'utf8'))
    const zones = treasure.layers.find((layer) => layer.name === 'zones').objects
    const lock = zones.find((obj) => obj.properties?.some((prop) => prop.name === 'locked' && prop.value === true))
    expect(lock?.name).toBe('chest_lock')
    expect(lock.type).toBe('trigger')
    const props = mouth.layers.find((layer) => layer.name === 'props').objects
    const mined = props.filter((obj) => obj.properties?.some((prop) => prop.name === 'mineable' && prop.value === true))
    expect(mined.map((obj) => obj.name)).toEqual(['cavern_rock_large_a'])
  })
})
