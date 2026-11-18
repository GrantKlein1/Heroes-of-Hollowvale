import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
      this.active = true
      this.visible = true
      this.rotation = 0
    }
    setOrigin(x, y) {
      this.originX = x
      this.originY = y !== undefined ? y : x
      return this
    }
    setDepth(d) {
      this.depth = d
      return this
    }
    setRotation(r) {
      this.rotation = r
      return this
    }
    destroy() {
      this.active = false
      this.visible = false
    }
  }

  return {
    default: {
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import { Projectile } from '../Projectile.js'
import { session } from '../../session.js'

const BOOST_UNTIL = 6000
const DURING_BUFF = 1000

const FLAT_HITS = [
  {
    id: 'fireball',
    texture: 'fireball',
    frame: 'fireball_fly_0',
    damage: 10,
    impact: 'fire',
    buffed: 13,
    color: '#ff6161',
  },
  {
    id: 'lightning',
    texture: 'spell_fx_v2',
    frame: 'spell_fx_v2_lightning_0',
    damage: 15,
    impact: 'lightning',
    buffed: 19,
    color: '#ff6161',
  },
  {
    id: 'poison vial',
    texture: 'thief_fx',
    frame: 'thief_fx_poison_vial_0',
    damage: 8,
    impact: 'poison',
    buffed: 10,
    color: '#6abe30',
    extra: {
      isArc: true,
      arcHeight: 28,
      bakedSpin: true,
      lingerMs: 2000,
      lingerDps: 5,
    },
  },
]

function clearDamageBuff() {
  session.damageMult = 1
  session.damageBoostUntil = 0
}

function sceneWith(enemy) {
  return {
    unit: 1,
    projectiles: [],
    _solidRects: [],
    enemies: { getChildren: () => [enemy] },
    add: { existing: (obj) => obj },
    _float: vi.fn(),
    _enemyBox: (e) => ({ x: e.x - 16, y: e.y - 16, w: 32, h: 32 }),
  }
}

function strike(spec, now, hp = 40) {
  const enemy = { x: 150, y: 100, hp, hpMax: hp }
  const scene = sceneWith(enemy)
  const proj = new Projectile(scene, 100, 100, spec.texture, spec.frame, {
    dirX: 1,
    dirY: 0,
    speed: 100,
    maxDist: 400,
    owner: 'player',
    damage: spec.damage,
    impact: spec.impact,
    ...(spec.extra || {}),
  })
  proj.update(now, 0.4)
  return { enemy, scene, proj }
}

describe('ale damage boost on player projectile hits', () => {
  afterEach(() => {
    clearDamageBuff()
  })

  for (const spec of FLAT_HITS) {
    it(`${spec.id} deals its base ${spec.damage} when no ale buff is active`, () => {
      clearDamageBuff()
      const { enemy, scene } = strike(spec, DURING_BUFF)
      expect(enemy.hp).toBe(40 - spec.damage)
      expect(scene._float).toHaveBeenCalledWith(enemy.x, enemy.y - 6, `-${spec.damage}`, spec.color)
    })

    it(`${spec.id} deals ${spec.buffed} while the ale buff is active`, () => {
      session.damageMult = 1.25
      session.damageBoostUntil = BOOST_UNTIL
      const { enemy, scene } = strike(spec, DURING_BUFF)
      expect(enemy.hp).toBe(40 - spec.buffed)
      expect(scene._float).toHaveBeenCalledWith(enemy.x, enemy.y - 6, `-${spec.buffed}`, spec.color)
    })

    it(`${spec.id} deals its base ${spec.damage} when now equals damageBoostUntil`, () => {
      session.damageMult = 1.25
      session.damageBoostUntil = BOOST_UNTIL
      const { enemy, scene } = strike(spec, BOOST_UNTIL)
      expect(enemy.hp).toBe(40 - spec.damage)
      expect(scene._float).toHaveBeenCalledWith(enemy.x, enemy.y - 6, `-${spec.damage}`, spec.color)
    })
  }

  it('life leech drains 40% of current HP and ignores the 1.25 ale multiplier', () => {
    session.damageMult = 1.25
    session.damageBoostUntil = BOOST_UNTIL
    const { enemy, scene } = strike({
      texture: 'spell_fx_v2',
      frame: 'spell_fx_v2_leech_0',
      damage: 10,
      impact: 'lifeLeech',
      extra: { special: 'lifeLeech' },
    }, DURING_BUFF, 50)
    expect(enemy.hp).toBe(30)
    expect(scene._float).toHaveBeenCalledWith(enemy.x, enemy.y - 6, '-20', '#bb3cff')
  })

  it('a poison puddle tick stays at lingerDps while the ale buff is active', () => {
    session.damageMult = 1.25
    session.damageBoostUntil = BOOST_UNTIL
    const spec = FLAT_HITS[2]
    const { enemy, proj } = strike(spec, DURING_BUFF, 40)
    expect(enemy.hp).toBe(40 - spec.buffed)
    proj.update(DURING_BUFF + 200, 0.2)
    expect(enemy.hp).toBeCloseTo(40 - spec.buffed - 1)
  })

  it('an enemy projectile deals its raw damage while the ale buff is active', () => {
    session.damageMult = 1.25
    session.damageBoostUntil = BOOST_UNTIL
    const scene = {
      unit: 1,
      projectiles: [],
      _solidRects: [],
      enemies: { getChildren: () => [] },
      add: { existing: (obj) => obj },
      _float: vi.fn(),
      player: {
        x: 200,
        y: 100,
        takeDamage: vi.fn(),
      },
    }
    const proj = new Projectile(scene, 100, 100, 'goblin_archer', 'goblin_archer_arrow_right', {
      owner: 'enemy',
      dirX: 1,
      dirY: 0,
      speed: 300,
      maxDist: 400,
      damage: 10,
    })
    proj.update(DURING_BUFF, 0.35)
    expect(scene.player.takeDamage).toHaveBeenCalledWith(10, DURING_BUFF, expect.objectContaining({
      projectile: proj,
    }))
    expect(scene._float).toHaveBeenCalledWith(200, 94, '-10', '#ff4444')
  })
})
