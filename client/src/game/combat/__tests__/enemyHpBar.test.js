import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import {
  ENEMY_HP_BAR_GAP,
  enemyHpBarTop,
  enemyHpTextBottom,
  resolveVisibleTopPx,
  trimmedTopPxFromFrame,
} from '../enemyHpBar.js'
import { getEnemyDef } from '../enemyDefs.js'
import { frameAnim, measureSheetVisibleTop } from '../measureVisibleTop.js'
import { readFileSync } from 'node:fs'

const assets = fileURLToPath(new URL('../../../../public/assets/', import.meta.url))

const halfHeight = (enemy) => enemy.y - enemy.displayHeight / 2 - ENEMY_HP_BAR_GAP

const LIVING = [
  { id: 'goblin', rel: 'enemies/goblin/goblin', prefix: 'goblin', row: 6 },
  { id: 'brute', rel: 'enemies/goblin_brute/goblin_brute', prefix: 'goblin_brute', row: 15 },
  { id: 'archer', rel: 'enemies/goblin_archer/goblin_archer', prefix: 'goblin_archer', row: 3 },
  { id: 'shadowfang_wolf', rel: 'enemies/shadowfang_wolf/shadowfang_wolf', prefix: 'shadowfang_wolf', row: 48 },
  { id: 'ashen_cultist', rel: 'enemies/ashen_cultist/ashen_cultist', prefix: 'ashen_cultist', row: 20 },
  { id: 'ashen_revenant', rel: 'enemies/ashen_revenant/ashen_revenant', prefix: 'ashen_revenant', row: 10 },
]

describe('enemyHpBarTop', () => {
  it('puts the bar 8px above the measured opaque row of every living foe', () => {
    for (const spec of LIVING) {
      const measured = measureSheetVisibleTop(`${assets}${spec.rel}.png`, `${assets}${spec.rel}.json`, spec.prefix)
      expect(measured.minRow, spec.id).toBe(spec.row)
      expect(measured.trimmed, spec.id).toBe(false)
      expect(getEnemyDef(spec.id).hpBarVisibleTop, spec.id).toBe(measured.minRow)

      const height = measured.frameHeight
      const enemy = {
        y: 400,
        originY: measured.originY,
        displayHeight: height,
        frameHeight: height,
        visibleTopPx: measured.minRow,
      }
      const frameTop = enemy.y - enemy.originY * height
      const head = frameTop + measured.minRow
      const bar = enemyHpBarTop(enemy)
      expect(bar, spec.id).toBeCloseTo(head - ENEMY_HP_BAR_GAP, 5)
      expect(bar + 4, spec.id).toBeLessThan(head)
      // The old half-height bar crossed the face. This one sits above it.
      expect(bar, spec.id).toBeLessThan(halfHeight(enemy))
    }
  })

  it('ignores the archer arrow frames packed into the body sheet', () => {
    const measured = measureSheetVisibleTop(
      `${assets}enemies/goblin_archer/goblin_archer.png`,
      `${assets}enemies/goblin_archer/goblin_archer.json`,
      'goblin_archer',
    )
    expect(measured.frames).toBe(88)
    expect(measured.frameHeight).toBe(64)
    expect(frameAnim('goblin_archer_arrow_right_0', 'goblin_archer')).toBe('arrow')
  })

  it('clears the head when a def has no measured row', () => {
    const feet = { y: 300, originY: 0.9375, displayHeight: 64, frameHeight: 64 }
    const frameTop = feet.y - feet.originY * feet.displayHeight
    expect(resolveVisibleTopPx(feet)).toBe(0)
    expect(enemyHpBarTop(feet)).toBeCloseTo(frameTop - ENEMY_HP_BAR_GAP, 5)
    expect(enemyHpBarTop(feet)).toBeLessThan(halfHeight(feet))

    const centered = { y: 200, originY: 0.5, displayHeight: 64 }
    expect(enemyHpBarTop(centered)).toBe(halfHeight(centered))
    expect(enemyHpBarTop({ y: 80, displayHeight: 40 })).toBe(80 - 20 - ENEMY_HP_BAR_GAP)
    expect(enemyHpBarTop({ y: 10 })).toBe(10 - ENEMY_HP_BAR_GAP)
  })

  it('uses a trimmed frame\'s own opaque row when the def has no measurement', () => {
    const frame = {
      customData: { trimmed: true, spriteSourceSize: { x: 133, y: 104, w: 373, h: 296 } },
    }
    expect(trimmedTopPxFromFrame(frame)).toBe(104)
    expect(trimmedTopPxFromFrame({ customData: { trimmed: false, spriteSourceSize: { y: 0 } } })).toBeUndefined()

    const dragon = {
      y: 500,
      originY: 0.7812,
      displayHeight: 512,
      frameHeight: 512,
      trimmedTopPx: 104,
    }
    const frameTop = dragon.y - dragon.originY * dragon.displayHeight
    const wing = frameTop + 104
    const bar = enemyHpBarTop(dragon)
    expect(bar).toBeCloseTo(wing - ENEMY_HP_BAR_GAP, 5)
    expect(bar + 4).toBeLessThan(wing)
    expect(bar).toBeLessThan(halfHeight(dragon))
  })

  it('keeps a stored row when a frame also carries trim data', () => {
    const enemy = {
      y: 400,
      originY: 0.9375,
      displayHeight: 64,
      frameHeight: 64,
      visibleTopPx: 6,
      trimmedTopPx: 0,
    }
    const frameTop = enemy.y - enemy.originY * enemy.displayHeight
    expect(enemyHpBarTop(enemy)).toBeCloseTo(frameTop + 6 - ENEMY_HP_BAR_GAP, 5)
  })

  it('places the cultist bar just above the hood, not on it and not in the empty frame margin', () => {
    expect(getEnemyDef('ashen_cultist').hpBarVisibleTop).toBe(20)
    const enemy = {
      y: 345.6,
      originY: 0.9271,
      displayHeight: 96,
      frameHeight: 96,
      visibleTopPx: 20,
    }
    const frameTop = enemy.y - enemy.originY * enemy.displayHeight
    const bar = enemyHpBarTop(enemy)
    const hood = frameTop + 20

    expect(bar).toBeCloseTo(hood - ENEMY_HP_BAR_GAP, 5)
    expect(bar).toBeGreaterThan(frameTop)
    expect(bar + 4).toBeLessThan(hood)
    expect(bar).toBeLessThan(halfHeight(enemy))
  })

  it('places the revenant bar just above the flame crown', () => {
    expect(getEnemyDef('ashen_revenant').hpBarVisibleTop).toBe(10)
    const enemy = {
      y: 200,
      originY: 0.9271,
      displayHeight: 96,
      frameHeight: 96,
      visibleTopPx: 10,
    }
    const frameTop = enemy.y - enemy.originY * enemy.displayHeight
    const bar = enemyHpBarTop(enemy)
    const crown = frameTop + 10

    expect(bar).toBeCloseTo(crown - ENEMY_HP_BAR_GAP, 5)
    expect(bar).toBeGreaterThan(frameTop)
    expect(bar + 4).toBeLessThan(crown)
  })

  it('scales the visible-top row with the sprite', () => {
    const enemy = {
      y: 400,
      originY: 0.9271,
      displayHeight: 192,
      frameHeight: 96,
      visibleTopPx: 20,
    }
    const frameTop = enemy.y - enemy.originY * enemy.displayHeight
    expect(enemyHpBarTop(enemy)).toBeCloseTo(frameTop + 40 - ENEMY_HP_BAR_GAP, 5)
  })

  it('dragon trim tops are the first opaque row of every living frame', () => {
    const sheets = ['p1_a', 'p1_b', 'p2_a', 'p2_b', 'p2_land', 'p3_a', 'p3_b']
    let checked = 0
    for (const sheet of sheets) {
      const rel = `${assets}boss/red_dragon/red_dragon_${sheet}`
      const atlas = JSON.parse(readFileSync(`${rel}.json`, 'utf8'))
      const measured = measureSheetVisibleTop(`${rel}.png`, `${rel}.json`, 'red_dragon', {
        anims: new Set(Object.keys(atlas.frames).map((name) => frameAnim(name, 'red_dragon')).filter((anim) => anim !== 'death')),
      })
      expect(measured.trimmed).toBe(true)
      expect(measured.trimMismatches, sheet).toBe(0)
      expect(measured.minRow).not.toBeNull()
      for (const [name, frame] of Object.entries(atlas.frames)) {
        if (frameAnim(name, 'red_dragon') === 'death') continue
        checked += 1
        expect(frame.spriteSourceSize.y, name).toBeGreaterThanOrEqual(measured.minRow)
      }
      const winner = atlas.frames[measured.winner.frame]
      expect(winner.spriteSourceSize.y, measured.winner.frame).toBe(measured.minRow)
    }
    expect(checked).toBeGreaterThan(700)
  })
})

describe('enemyHpTextBottom', () => {
  it('sits the number on top of the bar when the camera has room', () => {
    expect(enemyHpTextBottom(100, 12)).toBe(99)
    expect(enemyHpTextBottom(100, 12, 0)).toBe(99)
  })

  it('drops the number to stay on screen without crossing the sprite', () => {
    // Bar is 2px below the view top. A 12px label would clip, and it can
    // drop through the 8px gap but not onto the pixels under the bar.
    expect(enemyHpTextBottom(10, 12, 8)).toBe(10 + ENEMY_HP_BAR_GAP - 1)
    // Plenty of room above the bar: do not move it.
    expect(enemyHpTextBottom(40, 12, 0)).toBe(39)
    // A short clip slides the baseline down, still above the bar.
    expect(enemyHpTextBottom(20, 12, 10)).toBe(22)
  })
})
