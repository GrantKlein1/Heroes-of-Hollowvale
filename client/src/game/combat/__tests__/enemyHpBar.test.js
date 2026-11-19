import { describe, it, expect } from 'vitest'
import { ENEMY_HP_BAR_GAP, enemyHpBarTop } from '../enemyHpBar.js'
import { getEnemyDef } from '../enemyDefs.js'

const halfHeight = (enemy) => enemy.y - enemy.displayHeight / 2 - ENEMY_HP_BAR_GAP

describe('enemyHpBarTop', () => {
  it('keeps the half-height bar for foes with no visible-top offset', () => {
    const goblin = { y: 300, originY: 0.9375, displayHeight: 64, frameHeight: 64 }
    const wolf = { y: 300, originY: 0.9062, displayHeight: 128, frameHeight: 128 }
    const centered = { y: 200, originY: 0.5, displayHeight: 64 }
    expect(enemyHpBarTop(goblin)).toBe(halfHeight(goblin))
    expect(enemyHpBarTop(wolf)).toBe(halfHeight(wolf))
    expect(enemyHpBarTop(centered)).toBe(halfHeight(centered))
    expect(enemyHpBarTop({ y: 80, displayHeight: 40 })).toBe(80 - 20 - ENEMY_HP_BAR_GAP)
  })

  it('does not give existing enemies a visible-top offset', () => {
    for (const id of ['goblin', 'brute', 'archer', 'shadowfang_wolf']) {
      expect(getEnemyDef(id).hpBarVisibleTop).toBeUndefined()
    }
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
})
