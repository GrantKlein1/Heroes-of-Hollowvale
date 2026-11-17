import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const DWARF = path.join(REPO_ROOT, 'client', 'public', 'assets', 'characters', 'dwarf')

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(DWARF, name), 'utf8'))
}

const ATTACK2_F3 = {
  down: { x: -33, y: -69, w: 48, h: 48 },
  left: { x: -45, y: -70, w: 51, h: 44 },
}
const ATTACK2_TIP3 = {
  down: { x: -8.9, y: -61.0 },
  left: { x: -5.0, y: -63.9 },
}
const CHARGED_F3 = {
  down: { x: -45, y: -75, w: 72, h: 83 },
  left: { x: -89, y: -58, w: 100, h: 66 },
}
const CHARGED_F4 = {
  down: { x: -45, y: -79, w: 72, h: 87 },
  left: { x: -86, y: -58, w: 98, h: 66 },
}
const CHARGED_TIP3 = {
  down: { x: -8.9, y: -6.4 },
  left: { x: -24.8, y: -13.4 },
}
const CHARGED_TIP4 = {
  down: { x: -8.9, y: -4.5 },
  left: { x: -21.8, y: -10.9 },
}

describe('Dwarf attack v2 edge contact', () => {
  it('packs attack2 cells at 70×80 and charged cells at 72×80', () => {
    const attack2 = load('dwarf_attack2.json')
    const charged = load('dwarf_charged.json')

    expect(attack2.meta.size).toEqual({ w: 490, h: 320 })
    expect(attack2.meta.cell).toEqual({ w: 70, h: 80 })
    expect(attack2.meta.origin).toEqual({ x: 0.5, y: 0.9125 })
    expect(attack2.meta.pivotRowPx).toBe(73)

    expect(charged.meta.size).toEqual({ w: 864, h: 320 })
    expect(charged.meta.cell).toEqual({ w: 72, h: 80 })
    expect(charged.meta.origin).toEqual({ x: 0.5, y: 0.9125 })
    expect(charged.meta.pivotRowPx).toBe(73)

    for (const frame of Object.values(attack2.frames)) {
      expect(frame.frame.w).toBe(70)
      expect(frame.frame.h).toBe(80)
      expect(frame.frame.x % 70).toBe(0)
    }
    for (const frame of Object.values(charged.frames)) {
      expect(frame.frame.w).toBe(72)
      expect(frame.frame.h).toBe(80)
      expect(frame.frame.x % 72).toBe(0)
    }
  })

  it('matches META_CHANGES hitboxes and tips for down and left', () => {
    const attack2 = load('dwarf_attack2.json').meta.anims.attack_2
    const charged = load('dwarf_charged.json').meta.anims.charged_release

    expect(attack2.hitbox['3'].down).toEqual(ATTACK2_F3.down)
    expect(attack2.hitbox['3'].left).toEqual(ATTACK2_F3.left)
    expect(attack2.weaponTipOffsetFromFeet['3'].down).toEqual(ATTACK2_TIP3.down)
    expect(attack2.weaponTipOffsetFromFeet['3'].left).toEqual(ATTACK2_TIP3.left)

    expect(charged.hitbox['3'].down).toEqual(CHARGED_F3.down)
    expect(charged.hitbox['3'].left).toEqual(CHARGED_F3.left)
    expect(charged.hitbox['4'].down).toEqual(CHARGED_F4.down)
    expect(charged.hitbox['4'].left).toEqual(CHARGED_F4.left)
    expect(charged.weaponTipOffsetFromFeet['3'].down).toEqual(CHARGED_TIP3.down)
    expect(charged.weaponTipOffsetFromFeet['3'].left).toEqual(CHARGED_TIP3.left)
    expect(charged.weaponTipOffsetFromFeet['4'].down).toEqual(CHARGED_TIP4.down)
    expect(charged.weaponTipOffsetFromFeet['4'].left).toEqual(CHARGED_TIP4.left)

    const sidecar = load('hitbox.json')
    const attack = load('dwarf_attack.json').meta.anims.attack
    expect(sidecar.hitbox['3'].down).toEqual(attack.hitbox['3'].down)
    expect(sidecar.hitbox['3'].left).toEqual(attack.hitbox['3'].left)
    expect(sidecar.weaponTipOffsetFromFeet['3'].down).toEqual(attack.weaponTipOffsetFromFeet['3'].down)
    expect(sidecar.weaponTipOffsetFromFeet['3'].left).toEqual(attack.weaponTipOffsetFromFeet['3'].left)
    expect(attack.hitbox['3'].down).toEqual({ x: -36, y: -45, w: 48, h: 53 })
    expect(attack.hitbox['3'].left).toEqual({ x: -82, y: -38, w: 80, h: 44 })
  })
})
