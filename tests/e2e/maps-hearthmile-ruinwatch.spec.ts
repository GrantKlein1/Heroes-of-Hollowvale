import { test, expect, type Page } from '@playwright/test'
import { waitForScene } from './helpers/waits'

/**
 * MAPS-WIRE-1. Wilderness south path → Hearthmile → Ruinwatch → back.
 * Teleports through the existing scene hooks. No screenshots.
 */

async function boot(page: Page) {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })
  await page.route('/api/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })
  await page.goto('/?renderer=blend&maps=tiled&qa=1&seed=1')
  const startButton = page.getByRole('button', { name: 'Start Game' })
  await expect(startButton).toBeVisible()
  await startButton.click()
  const classModalHeading = page.getByText('Choose Your Class')
  await expect(classModalHeading).toBeVisible()
  await page.getByRole('button', { name: 'Choose' }).first().click()
  await expect(classModalHeading).toBeHidden()
  await waitForScene(page, 'village')
}

async function crossExit(page: Page, sceneId: string) {
  const moved = await page.evaluate((target) => {
    const scene = (window as any).__scene
    const zone = (scene.prompts || []).find((p: { to?: string; action?: string; targetSpawn?: string }) =>
      target === 'wilderness'
        ? p.action === 'wilderness' && p.targetSpawn === 'spawn_south'
        : p.to === target
    )
    if (!zone) {
      return {
        ok: false,
        prompts: (scene.prompts || []).map((p: { to?: string; action?: string; targetSpawn?: string; label?: string }) => ({
          to: p.to,
          action: p.action,
          targetSpawn: p.targetSpawn,
          label: p.label,
        })),
      }
    }
    const body = scene.player.body
    body.x = zone.x + (zone.w - body.width) / 2
    body.y = zone.y + Math.max(0, (zone.h - body.height) / 2)
    scene.player.setVelocity(0, 0)
    scene._tryInteract()
    return { ok: true, scene: scene.sceneId }
  }, sceneId)
  expect(moved.ok, JSON.stringify(moved)).toBe(true)
  await waitForScene(page, sceneId)
}

test('wilderness south path reaches Hearthmile and Ruinwatch and returns', async ({ page }) => {
  test.setTimeout(90_000)
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await boot(page)

  await page.evaluate(() => {
    const scene = (window as any).__scene
    scene.wildNodeId = 'wild_0_0'
    scene.enterScene('wilderness')
  })
  await waitForScene(page, 'wilderness')

  const gate = await page.evaluate(() => {
    const scene = (window as any).__scene
    const south = (scene.prompts || []).find((p: { short?: string }) => p.short === 'Hearthmile')
    return { node: scene.wildNodeId, labeled: Boolean(south) }
  })
  expect(gate.node).toBe('wild_0_0')
  expect(gate.labeled).toBe(true)

  await page.evaluate(() => {
    const scene = (window as any).__scene
    const band = scene.wildLayout.exitBands.south
    const mid = ((band.start + band.end) / 2) * scene.worldW
    const body = scene.player.body
    body.reset(mid, scene.worldH - body.height / 2)
    scene.player.setVelocity(0, 0)
    scene.wildLatchUntil = 0
  })
  await waitForScene(page, 'hearthmile')

  const arrived = await page.evaluate(() => {
    const scene = (window as any).__scene
    const north = (scene.prompts || []).find((p: { action?: string; targetSpawn?: string }) =>
      p.action === 'wilderness' && p.targetSpawn === 'spawn_south'
    )
    const body = scene.player.body
    const onExit = north
      ? body.x < north.x + north.w && body.x + body.width > north.x && body.y < north.y + north.h && body.y + body.height > north.y
      : true
    return {
      world: (window as any).__hv.world(),
      x: scene.player.x,
      y: scene.player.y,
      onExit,
    }
  })
  expect(arrived.world).toEqual({ w: 640, h: 384 })
  expect(arrived.onExit).toBe(false)
  expect(arrived.y).toBeGreaterThan(32)

  await crossExit(page, 'ruinwatch')
  const ruin = await page.evaluate(() => (window as any).__hv.world())
  expect(ruin).toEqual({ w: 640, h: 384 })

  await crossExit(page, 'hearthmile')
  await crossExit(page, 'wilderness')

  const back = await page.evaluate(() => {
    const scene = (window as any).__scene
    scene.wildLatchUntil = 0
    return {
      node: scene.wildNodeId,
      ny: scene.player.y / scene.worldH,
    }
  })
  expect(back.node).toBe('wild_0_0')
  expect(back.ny).toBeGreaterThan(0.7)
  expect(back.ny).toBeLessThan(0.95)

  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))
  }))
  expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('wilderness')

  expect(consoleErrors, 'console errors').toEqual([])
  expect(pageErrors, 'page errors').toEqual([])
})
