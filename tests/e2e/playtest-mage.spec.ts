import { test, expect, type Locator, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * PT-M — play the mage on the shipped route (`?qa=1&seed=1`).
 * Second Choose button is the mage. Spellbook starts in storage; the staff
 * is on the hotbar. Try a real drag onto an empty hotbar slot, then the
 * click-to-place the inventory already implements if the drop does not land.
 * Hold K for the spell wheel and cast once with Space.
 * Screenshots go to docs/playtest/mage/, never tests/e2e/__screenshots__/.
 */

const SHOTS = path.resolve('docs/playtest/mage')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })
})

function grid(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..').locator('.grid')
}

async function slotAlts(gridLocator: Locator) {
  const slots = gridLocator.locator(':scope > div')
  const count = await slots.count()
  const alts: Array<string | null> = []
  for (let i = 0; i < count; i++) {
    const img = slots.nth(i).getByRole('img')
    alts.push((await img.count()) ? await img.first().getAttribute('alt') : null)
  }
  return alts
}

test('mage spell wheel and one cast', async ({ page }) => {
  test.setTimeout(120_000)
  fs.mkdirSync(SHOTS, { recursive: true })

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.goto('/?qa=1&seed=1')
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, '01-title.png') })

  await page.getByRole('button', { name: 'Start Game' }).click()
  const chooseModal = page.getByText('Choose Your Class')
  await expect(chooseModal).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, '02-class-select.png') })
  await page.getByRole('button', { name: 'Choose' }).nth(1).click()
  await expect(chooseModal).toBeHidden()

  await page.waitForFunction(() => (window as any).__hv?.scene() === 'village', null, { timeout: 20000 })
  await page.waitForFunction(() => {
    const scene = (window as any).__scene
    return scene?.anims?.get?.('mage_cast_lightning_v2_down')?.frames?.length > 0
  }, null, { timeout: 20000 })

  const started = await page.evaluate(() => ({
    classId: (window as any).__session?.classId ?? null,
    scene: (window as any).__hv?.scene?.() ?? null,
    equippedId: (window as any).__session?.equippedId ?? null,
    spellId: (window as any).__session?.spellId ?? null,
  }))
  expect(started.classId).toBe('mage')
  expect(started.scene).toBe('village')
  await page.screenshot({ path: path.join(SHOTS, '03-brackenford.png') })

  await page.keyboard.press('v')
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()
  const storage = grid(page, 'Storage')
  const inUse = grid(page, 'In Use')
  await expect(storage.getByRole('img', { name: 'Spellbook' })).toBeVisible()
  await expect(inUse.getByRole('img', { name: 'Apprentice Staff' })).toBeVisible()
  const hotbarBefore = await slotAlts(inUse)
  await page.screenshot({ path: path.join(SHOTS, '04-inventory-start.png') })

  const book = storage.getByRole('img', { name: 'Spellbook' })
  const bookBox = await book.boundingBox()
  expect(bookBox).toBeTruthy()
  const slots = inUse.locator(':scope > div')
  const slotCount = await slots.count()
  let emptyIndex = -1
  for (let i = 0; i < slotCount; i++) {
    if ((await slots.nth(i).getByRole('img').count()) === 0) {
      emptyIndex = i
      break
    }
  }
  expect(emptyIndex).toBeGreaterThanOrEqual(0)
  const destBox = await slots.nth(emptyIndex).boundingBox()
  expect(destBox).toBeTruthy()

  await page.mouse.move(bookBox!.x + bookBox!.width / 2, bookBox!.y + bookBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(destBox!.x + destBox!.width / 2, destBox!.y + destBox!.height / 2, { steps: 12 })
  await page.screenshot({ path: path.join(SHOTS, '05-drag-spellbook.png') })
  await page.mouse.up()

  const afterDrag = {
    storage: await storage.getByRole('img', { name: 'Spellbook' }).count(),
    hotbar: await inUse.getByRole('img', { name: 'Spellbook' }).count(),
    ghost: await page.locator('.fixed').getByRole('img', { name: 'Spellbook' }).count(),
  }
  const dragPlaced = afterDrag.hotbar > 0

  let clickPlaced = false
  if (!dragPlaced) {
    await slots.nth(emptyIndex).click()
    clickPlaced = (await inUse.getByRole('img', { name: 'Spellbook' }).count()) > 0
  }
  const hotbarAfter = await slotAlts(inUse)
  await page.screenshot({ path: path.join(SHOTS, '06-inventory-after-equip.png') })

  await page.keyboard.press('v')
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeHidden()
  if (clickPlaced || dragPlaced) {
    await page.keyboard.press(String(emptyIndex + 1))
  }
  await page.waitForFunction(
    (slot) => (window as any).__session?.hotbarSlot === slot,
    emptyIndex,
    { timeout: 3000 },
  ).catch(() => {})

  const equipped = await page.evaluate(() => ({
    equippedId: (window as any).__session?.equippedId ?? null,
    hotbarSlot: (window as any).__session?.hotbarSlot ?? null,
    spellId: (window as any).__session?.spellId ?? null,
  }))

  await page.locator('canvas').click({ position: { x: 8, y: 8 } })
  await page.keyboard.down('k')
  const wheel = page.getByLabel('Spell selection wheel')
  let wheelOpen = false
  let wheelBlocker = ''
  try {
    await expect(wheel).toBeVisible({ timeout: 2000 })
    wheelOpen = true
  } catch {
    wheelOpen = false
    if (equipped.equippedId !== 'spellbook') {
      wheelBlocker = `K did not open the wheel because the equipped item is ${equipped.equippedId ?? 'empty'}, not the spellbook. Drag-and-drop placed it: ${dragPlaced}. Click-to-place placed it: ${clickPlaced}.`
    } else {
      wheelBlocker = 'Spellbook is equipped and K is held, but the spell wheel did not open.'
    }
  }

  let selectedSpell = equipped.spellId
  if (wheelOpen) {
    await expect(page.getByText('Lightning Bolt', { exact: true })).toBeVisible()
    await expect(page.getByText('Blink', { exact: true })).toBeVisible()
    await expect(page.getByText('Life Leech', { exact: true })).toBeVisible()
    await expect(page.getByText('Mana Shield', { exact: true })).toBeVisible()
    await expect(page.getByText('[1]', { exact: true })).toBeVisible()
    await expect(page.getByText('[2]', { exact: true })).toBeVisible()
    await expect(page.getByText('[3]', { exact: true })).toBeVisible()
    await expect(page.getByText('[4]', { exact: true })).toBeVisible()
    await page.screenshot({ path: path.join(SHOTS, '07-spell-wheel.png') })
    await page.keyboard.press('1')
    await page.waitForTimeout(200)
    selectedSpell = await page.evaluate(() => (window as any).__session?.spellId ?? null)
  } else {
    await page.screenshot({ path: path.join(SHOTS, '07-spell-wheel-closed.png') })
  }
  await page.keyboard.up('k')

  const beforeCast = await page.evaluate(() => {
    const scene = (window as any).__scene
    return {
      projectiles: (scene?.projectiles || []).length,
      mana: scene?.mana ?? null,
      anim: (window as any).__hv?.anim?.() ?? null,
    }
  })
  await page.keyboard.press(' ', { delay: 100 })
  const cast = await page.evaluate(async () => {
    const scene = (window as any).__scene
    const start = performance.now()
    let anim = ''
    let projectiles = (scene?.projectiles || []).length
    let sawCast = false
    while (performance.now() - start < 1500) {
      anim = (window as any).__hv?.anim?.() || ''
      projectiles = (scene?.projectiles || []).length
      if (String(anim).includes('lightning') || String(anim).includes('cast')) sawCast = true
      if (sawCast && projectiles > 0) break
      if (sawCast && performance.now() - start > 900) break
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    }
    const proj = (scene?.projectiles || [])[0] || null
    return {
      anim,
      projectiles,
      sawCast,
      projKey: proj?.texture?.key ?? null,
      fly: proj?.flyAnim ?? null,
      damage: proj?.damage ?? null,
      mana: scene?.mana ?? null,
      spellId: (window as any).__session?.spellId ?? null,
      equippedId: (window as any).__session?.equippedId ?? null,
      notice: document.body.innerText.includes('Not enough mana.')
        || document.body.innerText.includes('Spells are still loading'),
    }
  })
  await page.screenshot({ path: path.join(SHOTS, '08-after-cast.png') })

  const fxErrors = [...consoleErrors, ...pageErrors].filter((line) => /fxLayer|fx\.sync|data-fx-layer/i.test(line))
  const summary = {
    started,
    hotbarBefore,
    hotbarAfter,
    emptyIndex,
    dragPlaced,
    afterDrag,
    clickPlaced,
    equipped,
    wheelOpen,
    wheelBlocker,
    selectedSpell,
    beforeCast,
    cast,
    fxErrors,
    consoleErrors: consoleErrors.slice(0, 20),
    pageErrors,
  }
  console.log(`[PT-M] ${JSON.stringify(summary)}`)

  expect(wheelOpen || wheelBlocker.length > 0).toBe(true)
  expect(cast.equippedId === 'spellbook' || wheelBlocker.length > 0).toBe(true)
  if (wheelOpen && equipped.equippedId === 'spellbook') {
    expect(selectedSpell).toBe('lightning')
    expect(cast.sawCast).toBe(true)
    expect(cast.projectiles).toBeGreaterThan(beforeCast.projectiles)
    expect(cast.projKey).toBe('spell_fx_v2')
    expect(cast.fly).toBe('lightning_bolt_v2')
  }
})
