import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { ANIM_TIMEOUT, previewClass, waitForScene } from './helpers/waits'

const OUT = path.resolve('docs/playtest/thief')

type Sample = {
  anim: string
  scene: string | undefined
  classId: string | undefined
  equippedId: string | null | undefined
  hotbarSlot: number | undefined
  facing: string | undefined
  visible: boolean | undefined
  alpha: number | undefined
  x: number | undefined
  y: number | undefined
  body: { x: number; y: number; w: number; h: number; cx: number; cy: number; scene: string } | null
  vanishActive: boolean | undefined
  vanishInvisible: boolean | undefined
  vanishUntil: number
  smokeUntil: number
  vanishCdUntil: number
  now: number
  attacking: boolean
  attackType: string | null | undefined
  projectiles: number
  hp: number
  seed: number | string | null
  hud: string
}

async function sample(page: import('@playwright/test').Page): Promise<Sample> {
  return page.evaluate(() => {
    const w = window as any
    const p = w.__scene?.player
    const s = w.__session
    const now = performance.now()
    const hud = document.body.innerText.match(/Invisibility:[^\n]*/)?.[0] || ''
    return {
      anim: w.__hv?.anim?.() || '',
      scene: w.__hv?.scene?.(),
      classId: s?.classId,
      equippedId: s?.equippedId,
      hotbarSlot: s?.hotbarSlot,
      facing: p?.facing,
      visible: p?.visible,
      alpha: p?.alpha,
      x: p?.x,
      y: p?.y,
      body: w.__hv?.player?.() || null,
      vanishActive: p?.vanishState?.active,
      vanishInvisible: p?.vanishState?.invisible,
      vanishUntil: s?.thiefVanishUntil || 0,
      smokeUntil: s?.thiefSmokeUntil || 0,
      vanishCdUntil: s?.thiefVanishCooldownUntil || 0,
      now,
      attacking: Boolean(w.__scene?._attacking),
      attackType: p?.currentAttackType,
      projectiles: w.__hv?.combat?.()?.projectilesCount ?? 0,
      hp: w.__hv?.combat?.()?.hp ?? 0,
      seed: typeof w.__hv?.seed === 'function' ? w.__hv.seed() : null,
      hud,
    }
  })
}

test('PT-T thief moves, vanishes on J, and swings daggers on Space', async ({ page }) => {
  test.setTimeout(120_000)
  fs.mkdirSync(OUT, { recursive: true })

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const notFound: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err.message)
  })
  page.on('response', (res) => {
    if (res.status() === 404) notFound.push(res.url())
  })

  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })

  await page.goto('/?qa=1&seed=1')
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible()
  await page.screenshot({ path: path.join(OUT, '01-title.png') })

  await page.getByRole('button', { name: 'Start Game' }).click()
  const classModal = page.getByText('Choose Your Class')
  await expect(classModal).toBeVisible()

  const choose = page.getByRole('button', { name: 'Choose' })
  await expect(choose).toHaveCount(4)
  // Third Choose button is the thief; hovering it previews the thief in the detail panel.
  await expect(choose.nth(2)).toHaveText('Choose Thief')
  await previewClass(page, choose.nth(2), 'Thief')
  const thiefCardText = await page.getByRole('dialog').innerText()
  expect(thiefCardText).toContain('Thief')
  await page.screenshot({ path: path.join(OUT, '02-class-select.png') })

  await choose.nth(2).click()
  await expect(classModal).toBeHidden()

  await waitForScene(page, 'village')
  await page.waitForFunction(() => {
    const w = window as any
    return (
      typeof w.__hv?.anim === 'function' &&
      w.__session?.classId === 'thief' &&
      w.__session?.equippedId === 'twin_daggers'
    )
  }, null, { timeout: ANIM_TIMEOUT })
  await page.waitForFunction(() => (window as any).__hv.anim() === 'thief_idle_down', null, { timeout: ANIM_TIMEOUT })

  const idle = await sample(page)
  const hotbarAlts = await page.locator('img[alt]').evaluateAll((imgs) =>
    imgs.map((img) => (img as HTMLImageElement).alt).filter((alt) => alt && alt !== 'Thief')
  )
  await page.screenshot({ path: path.join(OUT, '03-idle.png') })

  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => (window as any).__hv.anim() === 'thief_walk_up', null, { timeout: ANIM_TIMEOUT })
  await page.waitForTimeout(400)
  const moving = await sample(page)
  await page.screenshot({ path: path.join(OUT, '04-move.png') })
  await page.keyboard.up('ArrowUp')
  await page.waitForFunction(() => (window as any).__hv.anim() === 'thief_idle_up', null, { timeout: ANIM_TIMEOUT })

  await page.keyboard.press('j', { delay: 60 })
  await page.waitForFunction(() => {
    const w = window as any
    const anim = w.__hv?.anim?.() || ''
    const p = w.__scene?.player
    return /^thief_vanish_/.test(anim) && p?.visible === true
  }, null, { timeout: ANIM_TIMEOUT })
  const vanished = await sample(page)
  await page.screenshot({ path: path.join(OUT, '05-vanish.png') })

  await page.waitForFunction(() => {
    const w = window as any
    const now = performance.now()
    const s = w.__session
    return now >= (s?.thiefVanishUntil || 0) && now < (s?.thiefSmokeUntil || 0)
  }, null, { timeout: ANIM_TIMEOUT })
  const smoke = await sample(page)
  await page.screenshot({ path: path.join(OUT, '06-smoke.png') })

  await page.keyboard.press('Space', { delay: 60 })
  await page.waitForFunction(() => {
    const anim = (window as any).__hv?.anim?.() || ''
    return anim.includes('attack')
  }, null, { timeout: ANIM_TIMEOUT })
  const swing = await sample(page)
  await page.screenshot({ path: path.join(OUT, '07-dagger.png') })

  await page.waitForTimeout(500)
  const after = await sample(page)
  await page.screenshot({ path: path.join(OUT, '08-after-swing.png') })

  const notes = {
    route: '/?qa=1&seed=1',
    thiefCardText,
    hotbarAlts,
    idle,
    moving,
    vanished,
    smoke,
    swing,
    after,
    movedNorth: (moving.y ?? 0) < (idle.y ?? 0),
    vialEquipped: idle.equippedId === 'poison_vial',
    consoleErrors,
    pageErrors,
    notFound,
  }
  fs.writeFileSync(path.join(OUT, 'observations.json'), `${JSON.stringify(notes, null, 2)}\n`)

  expect(idle.classId).toBe('thief')
  expect(idle.scene).toBe('village')
  expect(idle.seed).toBe(1)
  expect(idle.equippedId).toBe('twin_daggers')
  expect(hotbarAlts).toContain('Poison Vial')
  expect(notes.movedNorth).toBe(true)
  expect(moving.anim).toBe('thief_walk_up')
  expect(vanished.vanishActive).toBe(true)
  expect(vanished.visible).toBe(true)
  expect(vanished.anim).toMatch(/^thief_vanish_/)
  expect(vanished.hud).toMatch(/Invisibility: Active/)
  expect(swing.anim).toMatch(/^thief_attack_/)
  expect(swing.projectiles).toBe(0)
  expect(swing.equippedId).toBe('twin_daggers')
  expect(pageErrors, 'unhandled page errors').toEqual([])
})
