import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * QA-1 full shipped path. Default flags only (`?qa=1&seed=1`, no renderer or
 * maps params). Product code is not touched; a real defect is recorded with
 * test.fixme on that step instead of being patched here.
 *
 * The wilderness hub has no walk back to Brackenford (north leaves to the
 * Cavern of Embers), so the return from the first wilderness screen uses
 * enterScene. Later long crossings use enterScene the same way. Door entry
 * itself is a real E press.
 */

const SHOTS = path.resolve('tests/e2e/__screenshots__')

// Anything matching is ignored at the final cleanliness assert.
// Empty on purpose: a 404 or console error on the shipped path is a defect
// unless a later run proves it is environmental noise (browser/dev-server),
// in which case the reason is written on the pattern.
const ALLOWED_CONSOLE_ERRORS: RegExp[] = []
const ALLOWED_404S: RegExp[] = []

const SEED = 1
// Goblin loot is three independent rolls (0.35 / 0.15 / 0.15), so many seeds
// drop nothing. 51 still drops a gem if a few random() calls land between this
// reseed and the death-clip roll (seed 1's emerald does not).
const LOOT_SEED = 51

function kept(lines: string[], patterns: RegExp[]) {
  return lines.filter((line) => !patterns.some((pattern) => pattern.test(line)))
}

async function waitScene(page: Page, id: string) {
  await page.waitForFunction((sceneId) => (window as any).__hv?.scene() === sceneId, id, { timeout: 15000 })
}

async function placeFeet(page: Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => {
    const scene = (window as any).__scene
    scene.player.setPosition(x, y)
    scene.player.body.reset(x, y)
    scene.player.setVelocity(0, 0)
  }, { x, y })
}

async function holdUntil(page: Page, key: string, ready: () => boolean, timeout = 8000) {
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(ready, null, { timeout })
  } finally {
    await page.keyboard.up(key)
  }
}

async function pressE(page: Page) {
  await page.keyboard.press('e', { delay: 50 })
}

// One press can land between Phaser updates and miss JustDown. Press again
// while the prompt is still showing.
async function pressEUntilScene(page: Page, id: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const there = await page.evaluate((sceneId) => (window as any).__hv?.scene() === sceneId, id)
    if (there) return
    await pressE(page)
    try {
      await page.waitForFunction((sceneId) => (window as any).__hv?.scene() === sceneId, id, { timeout: 2000 })
      return
    } catch {
      // try the key again
    }
  }
  await waitScene(page, id)
}

async function enterScene(page: Page, id: string) {
  await page.evaluate((sceneId) => {
    ;(window as any).__scene.enterScene(sceneId)
  }, id)
  await waitScene(page, id)
}

async function sampleFps(page: Page, label: string) {
  await page.waitForFunction(() => (window as any).__hv.fps() > 1, null, { timeout: 5000 })
  const samples = await page.evaluate(async () => {
    const read = () => {
      const n = (window as any).__hv.fps()
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    }
    const values: number[] = []
    const start = performance.now()
    while (performance.now() - start < 2000) {
      values.push(read())
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return values
  })
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length
  const min = Math.min(...samples)
  console.log(`[QA-1] ${label} fps avg ${avg.toFixed(1)} min ${min.toFixed(1)} over ${samples.length} samples / 2s`)
  // Generous floor. The shipped target is 60; 30 only catches a stalled loop.
  expect(avg, `${label} average fps`).toBeGreaterThanOrEqual(30)
  return avg
}

async function assertOutsideAndMobile(page: Page, direction: 'ArrowRight' | 'ArrowDown') {
  await page.waitForFunction(() => {
    const scene = (window as any).__scene
    const player = scene?.player
    const body = player?.body
    return Boolean(body && body.width > 0 && body.y > player.y - 10)
  }, null, { timeout: 3000 })

  const landing = await page.evaluate(() => {
    const scene = (window as any).__scene
    const body = scene.player.body
    return {
      x: scene.player.x,
      y: scene.player.y,
      overlap: scene.tiledMapLoader.checkCollision({
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
      }),
    }
  })
  console.log(`[QA-1] exit landing (${landing.x.toFixed(1)}, ${landing.y.toFixed(1)}) overlap=${landing.overlap}`)
  // (96, 160) is the market door centre, inside the cottage collider. MX-1 moved the return east of that door.
  expect(Math.hypot(landing.x - 96, landing.y - 160), 'landed on the blocked market door').toBeGreaterThan(16)
  expect(landing.overlap, 'exit landing overlaps a collider').toBe(false)

  await page.keyboard.down(direction)
  try {
    await page.waitForFunction((start) => {
      const player = (window as any).__scene.player
      return Math.hypot(player.x - start.x, player.y - start.y) >= 32
    }, { x: landing.x, y: landing.y }, { timeout: 2500 })
  } finally {
    await page.keyboard.up(direction)
  }
}

test.describe('QA-1 full shipped path', () => {
  test('title through lair, then one goblin and a potion', async ({ page }) => {
    test.setTimeout(180000)
    fs.mkdirSync(SHOTS, { recursive: true })

    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const notFound: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(err.message))
    page.on('response', (res) => {
      if (res.status() === 404) notFound.push(res.url())
    })

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve()
    })
    // NPC step only checks the prompt. This keeps a stray /api fetch from failing the 404 gate.
    await page.route('/api/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await test.step('title, knight, Brackenford blend map', async () => {
      await page.goto(`/?qa=1&seed=${SEED}`)
      await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible()
      await page.getByRole('button', { name: 'Start Game' }).click()
      await expect(page.getByText('Choose Your Class')).toBeVisible()
      await page.getByRole('button', { name: 'Choose' }).first().click()
      await expect(page.getByText('Choose Your Class')).toBeHidden()
      await waitScene(page, 'village')

      const village = await page.evaluate(() => {
        const scene = (window as any).__scene
        const params = new URLSearchParams(location.search)
        return {
          scene: (window as any).__hv.scene(),
          world: (window as any).__hv.world(),
          renderer: params.get('renderer'),
          maps: params.get('maps'),
          seed: params.get('seed'),
          tiled: Boolean(scene.tiledMapLoader),
          layersValid: scene.tiledMapLoader?.validateLayers?.()?.valid === true,
          playerKind: scene.player?.constructor?.name || '',
          anim: (window as any).__hv.anim(),
        }
      })
      expect(village.scene).toBe('village')
      expect(village.renderer).toBeNull()
      expect(village.maps).toBeNull()
      expect(village.seed).toBe(String(SEED))
      expect(village.world).toEqual({ w: 640, h: 384 })
      expect(village.tiled).toBe(true)
      expect(village.layersValid).toBe(true)
      expect(village.playerKind).toBe('Player')
      expect(village.anim).toMatch(/^knight_/)
      await page.screenshot({ path: path.join(SHOTS, 'qa1-village.png') })
      await sampleFps(page, 'village')
    })

    await test.step('market door, exit outside the cottage', async () => {
      // Bridge north end, then walk west into door_market. The last steps are the interaction.
      await placeFeet(page, 192, 220)
      await holdUntil(page, 'ArrowLeft', () => {
        const label = (window as any).__scene?._activeLabel || ''
        return label.includes('Market')
      })
      await pressEUntilScene(page, 'market')
      const market = await page.evaluate(() => (window as any).__hv.world())
      expect(market).toEqual({ w: 640, h: 384 })

      // Market spawn sits on exit_village, so E is the exit itself.
      await page.waitForFunction(() => {
        const label = (window as any).__scene?._activeLabel || ''
        return label.includes('Brackenford')
      })
      await pressEUntilScene(page, 'village')
      await page.screenshot({ path: path.join(SHOTS, 'qa1-market-exit.png') })
      await assertOutsideAndMobile(page, 'ArrowRight')
    })

    await test.step('The Flagon, Tharos prompt, exit', async () => {
      await placeFeet(page, 288, 200)
      await holdUntil(page, 'ArrowUp', () => {
        const label = (window as any).__scene?._activeLabel || ''
        return label.includes('The Flagon')
      })
      await pressEUntilScene(page, 'tavern')
      const tavern = await page.evaluate(() => (window as any).__hv.world())
      expect(tavern).toEqual({ w: 640, h: 384 })

      const prompt = await page.evaluate(() => {
        const scene = (window as any).__scene
        const zone = (scene.prompts || []).find((p: { label?: string }) => (p.label || '').includes('Tharos'))
        if (!zone) return ''
        const x = zone.x + zone.w / 2
        const y = zone.y + zone.h / 2
        scene.player.setPosition(x, y)
        scene.player.body.reset(x, y)
        scene.player.setVelocity(0, 0)
        return zone.label
      })
      expect(prompt).toContain('Tharos')
      await expect(page.getByText(prompt)).toBeVisible()

      await placeFeet(page, 320, 304)
      await page.waitForFunction(() => {
        const label = (window as any).__scene?._activeLabel || ''
        return label.includes('Brackenford')
      })
      await pressEUntilScene(page, 'village')
      await assertOutsideAndMobile(page, 'ArrowDown')
    })

    await test.step('south exit, wilderness, back, cavern mouth door', async () => {
      await placeFeet(page, 320, 280)
      await holdUntil(page, 'ArrowDown', () => {
        const label = (window as any).__scene?._activeLabel || ''
        return label.toLowerCase().includes('wilderness')
      })
      await pressEUntilScene(page, 'wilderness')
      const wild = await page.evaluate(() => {
        const scene = (window as any).__scene
        return {
          node: scene.wildNodeId,
          world: (window as any).__hv.world(),
        }
      })
      expect(wild.node).toBe('wild_0_0')
      expect(wild.world).toEqual({ w: 768, h: 1152 })

      await enterScene(page, 'village')
      expect(await page.evaluate(() => (window as any).__hv.world())).toEqual({ w: 640, h: 384 })

      await enterScene(page, 'wilderness')
      await page.evaluate(() => {
        const scene = (window as any).__scene
        const band = scene.wildLayout.exitBands.north
        const mid = ((band.start + band.end) / 2) * scene.worldW
        const body = scene.player.body
        body.reset(mid, body.height / 2)
        scene.player.setVelocity(0, 0)
        scene.wildLatchUntil = 0
      })
      await waitScene(page, 'dungeon')
      const mouth = await page.evaluate(() => (window as any).__hv.world())
      expect(mouth).toEqual({ w: 768, h: 928 })
      await sampleFps(page, 'cavern mouth')

      // Walk from the grass into the mouth. Collision stops the feet on the lip;
      // the interact rect is the door, so finish standing inside it and press E.
      await placeFeet(page, 384, 816)
      await page.keyboard.down('ArrowUp')
      try {
        await page.waitForFunction(() => (window as any).__scene.player.y <= 660, null, { timeout: 8000 })
      } finally {
        await page.keyboard.up('ArrowUp')
      }
      await page.evaluate(() => {
        const scene = (window as any).__scene
        scene.player.setVelocity(0, 0)
        const zone = (scene.prompts || []).find((p: { label?: string }) => (p.label || '').includes('Molten Halls'))
        if (!zone) return
        const body = scene.player.body
        const overlaps = body.x < zone.x + zone.w && body.x + body.width > zone.x
          && body.y < zone.y + zone.h && body.y + body.height > zone.y
        if (overlaps) return
        const x = zone.x + zone.w / 2
        const y = zone.y + zone.h / 2
        scene.player.setPosition(x, y)
        body.reset(x, y)
        scene.player.setVelocity(0, 0)
      })
      await page.waitForFunction(() => ((window as any).__scene._activeLabel || '').includes('Molten Halls'), null, { timeout: 3000 })
      await page.screenshot({ path: path.join(SHOTS, 'qa1-cavern-mouth.png') })
      await pressEUntilScene(page, 'dungeonInterior')
      expect(await page.evaluate(() => (window as any).__hv.world())).toEqual({ w: 896, h: 512 })
    })

    await test.step('treasure room and boss lair entrance', async () => {
      await enterScene(page, 'treasureRoom')
      expect(await page.evaluate(() => (window as any).__hv.world())).toEqual({ w: 640, h: 384 })
      await enterScene(page, 'cavernLair')
      const lair = await page.evaluate(() => {
        const scene = (window as any).__scene
        return {
          world: (window as any).__hv.world(),
          y: scene.player.y,
          dragon: Boolean((window as any).__hv.dragonState()),
        }
      })
      expect(lair.world).toEqual({ w: 1024, h: 768 })
      // spawn_default is the south entrance (dragon stands near y 400).
      expect(lair.y).toBeGreaterThan(580)
      expect(lair.dragon).toBe(true)
      await enterScene(page, 'village')
    })

    await test.step('goblin basic attack drops a pickup; K drinks a potion', async () => {
      // Chase treats speed 0 as 70 (`speed || 70`), so a dummy has to stop its AI.
      // Sword reach is the offset attack-combat-regression already lands: feet + (35, -15).
      await page.evaluate(() => {
        const scene = (window as any).__scene
        for (const key of Object.values(scene.keys || {})) {
          if (key && typeof key === 'object' && 'isDown' in key) (key as { isDown: boolean }).isDown = false
        }
        const player = scene.player
        player.setPosition(200, 200)
        player.body.reset(200, 200)
        player.setVelocity(0, 0)
        player.setFacing('right')
        const enemy = scene.spawn('goblin', 235, 185)
        enemy.attackCooldownUntil = performance.now() + 120000
        if (enemy.ai) {
          enemy.ai.hasSpawned = true
          enemy.ai.hasAlerted = true
          enemy.ai.nextPatrolChangeAt = 1e15
          enemy.ai.update = () => enemy.body?.setVelocity?.(0, 0)
        }
        enemy.body?.setVelocity?.(0, 0)
      })

      let hp = 15
      for (let swing = 0; swing < 4 && hp > 0; swing++) {
        hp = await page.evaluate(() => {
          const scene = (window as any).__scene
          const player = scene.player
          const enemy = (scene.enemies?.getChildren?.() || []).find((e: { enemyType?: string, hp: number }) => e.enemyType === 'goblin' && e.hp > 0)
          if (!enemy) return 0
          player.setFacing('right')
          player.setVelocity(0, 0)
          enemy.setPosition(player.x + 35, player.y - 15)
          enemy.body?.reset?.(player.x + 35, player.y - 15)
          enemy.body?.setVelocity?.(0, 0)
          return enemy.hp
        })
        if (hp <= 0) break
        if (hp <= 3) await page.evaluate((seed) => (window as any).__hv.seed(seed), LOOT_SEED)
        await page.keyboard.press('Space', { delay: 60 })
        try {
          await page.waitForFunction((before) => {
            const scene = (window as any).__scene
            const enemy = (scene.enemies?.getChildren?.() || []).find((e: { enemyType?: string }) => e.enemyType === 'goblin')
            const left = enemy && enemy.hp > 0 ? enemy.hp : 0
            return left < before
          }, hp, { timeout: 2500 })
        } catch (err) {
          const diag = await page.evaluate(() => {
            const scene = (window as any).__scene
            const enemy = (scene.enemies?.getChildren?.() || []).find((e: { enemyType?: string }) => e.enemyType === 'goblin')
            return {
              anim: (window as any).__hv.anim(),
              facing: scene.player.facing,
              state: scene.player.state,
              player: { x: scene.player.x, y: scene.player.y },
              enemy: enemy && { x: enemy.x, y: enemy.y, hp: enemy.hp, active: enemy.active },
            }
          })
          console.log('[QA-1] swing miss', JSON.stringify(diag))
          throw err
        }
        hp = await page.evaluate(() => {
          const enemy = ((window as any).__scene.enemies?.getChildren?.() || []).find((e: { enemyType?: string }) => e.enemyType === 'goblin')
          return enemy && enemy.hp > 0 ? enemy.hp : 0
        })
        if (hp > 0) {
          await page.waitForFunction(() => {
            const anim = (window as any).__hv.anim() || ''
            return anim.startsWith('knight_idle_') || anim.startsWith('knight_walk_')
          }, null, { timeout: 3000 }).catch(() => {})
        }
      }
      expect(hp, 'basic attack should kill the goblin').toBe(0)

      await page.evaluate(() => {
        const scene = (window as any).__scene
        scene.hp = 30
        scene._publishVitals(true)
        scene.player.setVelocity(0, 0)
      })
      await page.keyboard.press('2')
      await page.waitForFunction(() => (window as any).__session?.equippedId === 'healing_potion', null, { timeout: 3000 })
      const before = await page.evaluate(() => (window as any).__hv.combat().hp)
      expect(before).toBe(30)
      await page.keyboard.down('KeyK')
      try {
        await page.waitForFunction(() => (window as any).__hv.combat().hp >= 100, null, { timeout: 3000 })
      } finally {
        await page.keyboard.up('KeyK')
      }
      await expect(page.locator('img[alt="Healing Potion"]')).toHaveCount(0)
    })

    await test.step('no page errors, console errors, or 404s', async () => {
      const consoleLeft = kept(consoleErrors, ALLOWED_CONSOLE_ERRORS)
      const missingLeft = kept(notFound, ALLOWED_404S)
      expect(pageErrors, 'pageerror').toEqual([])
      expect(consoleLeft, 'console errors').toEqual([])
      expect(missingLeft, '404 responses').toEqual([])
    })

    await test.step('killed goblin leaves a pickup', async () => {
      const dropped = await page.waitForFunction(() => {
        const pickups = (window as any).__scene.lootPickups || []
        return pickups.some((sprite: { lootPickup?: boolean, lootCollected?: boolean }) => sprite?.lootPickup && !sprite.lootCollected)
      }, null, { timeout: 3000 }).then(() => true).catch(() => false)
      if (dropped) return
      const diag = await page.evaluate(() => {
        const scene = (window as any).__scene
        const enemies = (scene.enemies?.getChildren?.() || []).map((e: {
          enemyType?: string
          hp: number
          active: boolean
          state?: string
          lastAnimKey?: string
          _deathCompleted?: boolean
        }) => ({
          type: e.enemyType,
          hp: e.hp,
          active: e.active,
          state: e.state,
          anim: e.lastAnimKey,
          done: Boolean(e._deathCompleted),
        }))
        return { seed: (window as any).__hv.seed(), enemies }
      })
      console.log('[QA-1] BUG killed goblin stays at 0 HP (active=false, death clip never completes, no pickup)', JSON.stringify(diag))
      // die() sets active=false before playAnim('death'). Phaser only advances
      // animations on active objects, so the clip never finishes and loot never spawns.
      test.fixme(true, 'Killed goblin stays at 0 HP; death clip never completes, so no pickup spawns')
    })
  })
})
