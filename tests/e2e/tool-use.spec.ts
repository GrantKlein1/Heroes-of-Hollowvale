import { test, expect, type Page } from '@playwright/test'

async function boot(page: Page, classIndex: number) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    pageErrors.push(`[pageerror] ${err.message}`)
  })

  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })

  await page.goto('/?qa=1&seed=7')
  await page.getByRole('button', { name: 'Start Game' }).click()
  await expect(page.getByText('Choose Your Class')).toBeVisible()
  await page.getByRole('button', { name: 'Choose' }).nth(classIndex).click()
  await expect(page.getByText('Choose Your Class')).toBeHidden()

  await page.waitForFunction(() => {
    const w = window as any
    return typeof w.__hv?.scene === 'function' && w.__hv.scene() === 'village' && Boolean(w.__scene?.player)
  })

  await page.evaluate(() => {
    const w = window as any
    w.__toolUnlocks = []
    w.__toolMines = []
    w.__chatEventBus?.on('tool:unlock', (evt: any) => w.__toolUnlocks.push(evt))
    w.__chatEventBus?.on('tool:mine', (evt: any) => w.__toolMines.push(evt))
  })

  return { consoleErrors, pageErrors }
}

async function standOn(page: Page, sceneId: string, kind: 'lock' | 'mine') {
  await page.evaluate((id) => {
    ;(window as any).__hv.goto(id)
  }, sceneId)
  await page.waitForFunction((id) => (window as any).__hv.scene() === id, sceneId)
  await page.waitForFunction(() => Boolean((window as any).__scene?.tiledMapLoader?.propObjects))

  const placed = await page.evaluate((mode) => {
    const scene = (window as any).__scene
    const loader = scene.tiledMapLoader
    let x = 0
    let y = 0
    let name = ''
    if (mode === 'lock') {
      const zone = loader.getZones().getAll().find((entry: any) => entry.properties?.locked === true)
      if (!zone) return null
      x = zone.x + zone.width / 2
      y = zone.y + zone.height / 2
      name = zone.name
    } else {
      const prop = (loader.propObjects || []).find((entry: any) => {
        const props = entry.raw?.properties || []
        return props.some((row: any) => row.name === 'mineable' && row.value === true)
      })
      if (!prop) return null
      x = prop.x + prop.width / 2
      y = prop.y + prop.height - 20
      name = prop.name
    }
    scene.player.setPosition(x, y)
    scene.player.body?.reset?.(x, y)
    scene.player.body?.setVelocity?.(0, 0)
    return { x, y, name, scene: scene.sceneId }
  }, kind)

  expect(placed).toBeTruthy()
  return placed
}

test.describe('Package B10-2: lockpick and pickaxe tool use', () => {
  test('lockpick cancels with no effect, then opens the zone once', async ({ page }) => {
    const { consoleErrors, pageErrors } = await boot(page, 2)
    await standOn(page, 'cavern_treasure', 'lock')

    await page.evaluate(() => {
      ;(window as any).__session.classId = 'knight'
    })
    await page.waitForFunction(() => (window as any).__scene.player.classId === 'knight')
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(400)
    const knight = await page.evaluate(() => ({
      clip: (window as any).__scene.player.itemUseState?.clip || null,
      unlocks: (window as any).__toolUnlocks.length,
      anim: (window as any).__hv.anim(),
    }))
    expect(knight.clip).toBeNull()
    expect(knight.unlocks).toBe(0)
    expect(knight.anim).not.toMatch(/use_lockpick/)
    await page.keyboard.up('KeyE')

    await page.evaluate(() => {
      ;(window as any).__session.classId = 'thief'
    })
    await page.waitForFunction(() => (window as any).__scene.player.classId === 'thief')
    await standOn(page, 'cavern_treasure', 'lock')

    await page.keyboard.down('KeyE')
    await page.waitForFunction(() => (window as any).__scene.player.itemUseState?.clip === 'use_lockpick')
    const early = await page.evaluate(() => ({
      anim: (window as any).__hv.anim(),
      sprite: (window as any).__scene.player.itemSprite?.frame?.name || null,
      atlas: (window as any).__scene.player.itemSprite?.texture?.key || null,
      visible: (window as any).__scene.player.itemSprite?.visible === true,
    }))
    expect(early.anim).toMatch(/^thief_use_lockpick_/)
    expect(early.atlas).toBe('items_inhand_b10')
    expect(early.sprite).toMatch(/^lockpicks_/)
    expect(early.visible).toBe(true)
    await page.screenshot({ path: 'tests/e2e/__screenshots__/b102-lockpick.png' })
    await page.waitForTimeout(180)
    await page.keyboard.up('KeyE')
    await page.waitForFunction(() => !(window as any).__scene.player.itemUseState?.active)
    const cancelled = await page.evaluate(() => {
      const zone = (window as any).__scene.tiledMapLoader.getZones().getAll()
        .find((entry: any) => entry.name === 'chest_lock')
      return {
        unlocks: (window as any).__toolUnlocks.length,
        locked: zone?.properties?.locked === true,
        opened: zone?.opened === true,
      }
    })
    expect(cancelled.unlocks).toBe(0)
    expect(cancelled.locked).toBe(true)
    expect(cancelled.opened).toBe(false)

    await page.keyboard.down('KeyE')
    await page.waitForFunction(() => (window as any).__scene.player.itemUseState?.clip === 'use_lockpick')
    await page.keyboard.down('ArrowRight')
    await page.waitForFunction(() => !(window as any).__scene.player.itemUseState?.active)
    await page.keyboard.up('ArrowRight')
    await page.keyboard.up('KeyE')
    expect(await page.evaluate(() => (window as any).__toolUnlocks.length)).toBe(0)

    await standOn(page, 'cavern_treasure', 'lock')
    await page.keyboard.down('KeyE')
    await page.waitForFunction(() => (window as any).__scene.player.itemUseState?.clip === 'use_lockpick')
    const jumped = await page.evaluate(() => {
      try {
        ;(window as any).__hv.goto('village')
        return { ok: true, scene: (window as any).__hv.scene() }
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) }
      }
    })
    expect(jumped.ok).toBe(true)
    expect(jumped.scene).toBe('village')
    await page.keyboard.up('KeyE')
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => (window as any).__toolUnlocks.length)).toBe(0)
    expect(await page.evaluate(() => (window as any).__scene.player.itemUseState?.active === true)).toBe(false)

    await standOn(page, 'cavern_treasure', 'lock')
    await page.keyboard.down('KeyE')
    await page.waitForFunction(() => ((window as any).__toolUnlocks || []).length === 1, { timeout: 3000 })
    const opened = await page.evaluate(() => {
      const zone = (window as any).__scene.tiledMapLoader.getZones().getAll()
        .find((entry: any) => entry.name === 'chest_lock')
      const evt = (window as any).__toolUnlocks[0]
      return {
        count: (window as any).__toolUnlocks.length,
        name: evt?.name,
        elapsed: evt?.elapsed,
        locked: zone?.properties?.locked === true,
        opened: zone?.opened === true,
      }
    })
    expect(opened.count).toBe(1)
    expect(opened.name).toBe('chest_lock')
    expect(opened.locked).toBe(false)
    expect(opened.opened).toBe(true)
    expect(opened.elapsed).toBeGreaterThanOrEqual(833)
    expect(opened.elapsed).toBeLessThanOrEqual(833 + 34)
    await page.waitForFunction(() => !(window as any).__scene._toolUse)
    await page.keyboard.up('KeyE')
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (window as any).__toolUnlocks.length)).toBe(1)

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('pickaxe breaks a mineable rock once at the contact frame and does not hurt enemies', async ({ page }) => {
    const { consoleErrors, pageErrors } = await boot(page, 3)
    await standOn(page, 'cavern_mouth', 'mine')

    await page.evaluate(() => {
      ;(window as any).__session.classId = 'thief'
    })
    await page.waitForFunction(() => (window as any).__scene.player.classId === 'thief')
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(200)
    await page.keyboard.up('KeyE')
    expect(await page.evaluate(() => (window as any).__scene.player.itemUseState?.clip || null)).toBeNull()
    expect(await page.evaluate(() => (window as any).__toolMines.length)).toBe(0)

    await page.evaluate(() => {
      ;(window as any).__session.classId = 'dwarf'
    })
    await page.waitForFunction(() => (window as any).__scene.player.classId === 'dwarf')
    await standOn(page, 'cavern_mouth', 'mine')

    const before = await page.evaluate(() => {
      const scene = (window as any).__scene
      const enemy = scene.spawn('goblin', scene.player.x + 24, scene.player.y)
      enemy.ai = { update() {} }
      enemy.body?.setVelocity?.(0, 0)
      const rock = (scene.tiledMapLoader.propSprites || []).find((sprite: any) => {
        return Math.abs(sprite.x - 192) <= 1 && Math.abs(sprite.y - 640) <= 1
      })
      return {
        hp: enemy.hp,
        loot: Array.isArray(scene.lootPickups) ? scene.lootPickups.length : 0,
        rockActive: rock ? rock.active !== false : false,
      }
    })
    expect(before.rockActive).toBe(true)

    await page.keyboard.down('KeyE')
    await page.waitForFunction(() => (window as any).__scene.player.itemUseState?.clip === 'use_pickaxe')
    const swinging = await page.evaluate(() => ({
      anim: (window as any).__hv.anim(),
      sprite: (window as any).__scene.player.itemSprite?.frame?.name || null,
      atlas: (window as any).__scene.player.itemSprite?.texture?.key || null,
      visible: (window as any).__scene.player.itemSprite?.visible === true,
    }))
    expect(swinging.anim).toMatch(/^dwarf_use_pickaxe_/)
    expect(swinging.atlas).toBe('items_inhand_b10')
    expect(swinging.sprite).toMatch(/^dwarf_pickaxe_/)
    expect(swinging.visible).toBe(true)
    await page.screenshot({ path: 'tests/e2e/__screenshots__/b102-pickaxe.png' })

    await page.waitForFunction(() => ((window as any).__toolMines || []).length === 1, { timeout: 3000 })
    const mined = await page.evaluate(() => {
      const scene = (window as any).__scene
      const evt = (window as any).__toolMines[0]
      const enemy = (scene.enemies?.getChildren?.() || []).find((entry: any) => entry.enemyType === 'goblin' || entry.ai)
      const rock = (scene.tiledMapLoader.propSprites || []).find((sprite: any) => {
        return Math.abs(sprite.x - 192) <= 1 && Math.abs(sprite.y - 640) <= 1
      })
      const pickups = scene.lootPickups || []
      return {
        count: (window as any).__toolMines.length,
        name: evt?.name,
        elapsed: evt?.elapsed,
        lootId: evt?.lootId,
        hp: enemy?.hp ?? null,
        loot: pickups.length,
        pickupId: pickups[pickups.length - 1]?.lootId || null,
        rockActive: rock ? rock.active !== false && rock.scene != null : false,
      }
    })
    expect(mined.count).toBe(1)
    expect(mined.name).toBe('cavern_rock_large_a')
    expect(mined.elapsed).toBeGreaterThanOrEqual(333)
    expect(mined.elapsed).toBeLessThanOrEqual(333 + 34)
    expect(['ruby', 'sapphire', 'emerald']).toContain(mined.lootId)
    expect(mined.loot).toBe(before.loot + 1)
    expect(mined.pickupId).toBe(mined.lootId)
    expect(mined.hp).toBe(before.hp)
    expect(mined.rockActive).toBe(false)

    await page.waitForFunction(() => !(window as any).__scene._toolUse)
    await page.keyboard.up('KeyE')
    const lootAfter = await page.evaluate(() => ((window as any).__scene.lootPickups || []).length)
    await page.keyboard.down('KeyE')
    await page.waitForTimeout(800)
    await page.keyboard.up('KeyE')
    const after = await page.evaluate(() => ({
      mines: (window as any).__toolMines.length,
      loot: ((window as any).__scene.lootPickups || []).length,
      clip: (window as any).__scene.player.itemUseState?.clip || null,
    }))
    expect(after.mines).toBe(1)
    expect(after.loot).toBe(lootAfter)
    expect(after.clip).toBeNull()

    await page.keyboard.down('KeyE')
    await page.evaluate(() => {
      try {
        ;(window as any).__hv.goto('village')
      } catch (err) {
        ;(window as any).__toolGotoError = err instanceof Error ? err.message : String(err)
      }
    })
    await page.keyboard.up('KeyE')
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => (window as any).__toolGotoError || null)).toBeNull()

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
})
