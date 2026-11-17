import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Package 3-3. Emberwood and Ashen screens, the cavern-mouth link, and a FPS sample.
 * Node ids come from worldGraph.biomeFor (do not edit that module):
 * wild_2_0 is emberwood_forest, wild_0_0 (the hub entrance) is ashen_wastes.
 */

async function boot(page: import('@playwright/test').Page) {
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
  await page.waitForFunction(() => (window as any).__hv?.scene() === 'village')
}

async function enterWild(page: import('@playwright/test').Page, nodeId: string) {
  await page.evaluate((id) => {
    const scene = (window as any).__scene
    scene.wildNodeId = id
    scene.enterScene('wilderness')
  }, nodeId)
  await page.waitForFunction(() => (window as any).__hv?.scene() === 'wilderness')
  await page.waitForTimeout(400)
}

test.describe('Package 3-3 wilderness tiles', () => {
  test('Emberwood and Ashen screens, cavern link, and fps', async ({ page }) => {
    test.setTimeout(180000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await boot(page)

    await enterWild(page, 'wild_2_0')
    const ember = await page.evaluate(() => {
      const scene = (window as any).__scene
      const layout = scene.wildLayout
      const cols = layout.tiles.cols
      const rows = layout.tiles.rows
      let spot = null
      for (let i = 0; i < layout.tiles.cells.length; i++) {
        const cell = layout.tiles.cells[i]
        if (cell.tileset !== 'forest_floor' || cell.kind === 'path') continue
        const col = i % cols
        const row = (i - col) / cols
        if (col > 6 && col < cols - 6 && row > 8 && row < rows - 8) {
          spot = { nx: (col + 0.5) / cols, ny: (row + 0.5) / rows }
          break
        }
      }
      if (spot) scene._placePlayer(spot.nx, spot.ny)
      const tilesets = new Set(layout.tiles.cells.map((cell: { tileset: string }) => cell.tileset))
      const props = layout.objects.map((obj: { assetId: string }) => obj.assetId)
      return {
        node: scene.wildNodeId,
        tilesets: [...tilesets],
        props,
        spriteCount: (scene.props || []).filter((obj: { texture?: { key?: string } }) => obj?.texture?.key === 'wild_props_4b').length,
      }
    })
    expect(ember.node).toBe('wild_2_0')
    expect(ember.tilesets).toContain('forest_floor')
    expect(ember.tilesets).toContain('dirt_road')
    for (const id of ['fern', 'flowers', 'mushroom_cluster', 'stump_mossy', 'log_fallen']) {
      expect(ember.props).toContain(id)
    }
    expect(ember.spriteCount).toBeGreaterThan(0)
    await page.waitForTimeout(500)
    const canvas = page.locator('canvas')
    await expect(canvas).toHaveScreenshot('wilderness-emberwood.png')

    await enterWild(page, 'wild_0_0')
    const ashen = await page.evaluate(() => {
      const scene = (window as any).__scene
      const layout = scene.wildLayout
      const tree = (layout.objects || []).find((obj: { assetId: string }) => obj.assetId === 'tree_dead_base')
      if (tree) scene._placePlayer(tree.nx, Math.min(0.92, tree.ny + 0.08))
      const tilesets = new Set(layout.tiles.cells.map((cell: { tileset: string }) => cell.tileset))
      const ids = layout.objects.map((obj: { assetId: string }) => obj.assetId)
      return {
        tilesets: [...tilesets],
        hasCanopy: ids.includes('tree_dead_canopy'),
        hasBase: ids.includes('tree_dead_base'),
        hasDrift: ids.some((id: string) => id.startsWith('ash_drift_')),
        hasVent: ids.includes('ember_vent_burn_down_0'),
        playingVent: (scene.props || []).some((obj: { anims?: { isPlaying?: boolean } }) => obj?.anims?.isPlaying),
      }
    })
    expect(ashen.tilesets).toContain('ash_ground')
    expect(ashen.tilesets).toContain('ash_fill')
    expect(ashen.tilesets).toContain('grass')
    expect(ashen.hasBase).toBe(true)
    expect(ashen.hasCanopy).toBe(true)
    expect(ashen.hasDrift).toBe(true)
    expect(ashen.hasVent).toBe(true)
    await page.waitForTimeout(600)
    await expect(canvas).toHaveScreenshot('wilderness-ashen-edge.png')

    await page.waitForTimeout(800)
    const fps = await page.evaluate(() => {
      const sample = (window as any).__hv?.fps?.()
      return typeof sample === 'number' ? sample : 0
    })
    const fpsPath = path.resolve('/opt/cursor/artifacts/wilderness-fps.txt')
    fs.mkdirSync(path.dirname(fpsPath), { recursive: true })
    fs.writeFileSync(fpsPath, `wilderness fps (this VM, not Iris Xe): ${fps}\n`)
    expect(fps).toBeGreaterThan(0)

    // Cross the north exit the way walking does: body in the open mouth, latch clear.
    await page.evaluate(() => {
      const scene = (window as any).__scene
      scene.wildNodeId = 'wild_0_0'
      scene.enterScene('wilderness')
    })
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'wilderness')
    await page.evaluate(() => {
      const scene = (window as any).__scene
      const band = scene.wildLayout.exitBands.north
      const mid = ((band.start + band.end) / 2) * scene.worldW
      const body = scene.player.body
      body.reset(mid, body.height / 2)
      scene.player.setVelocity(0, 0)
      scene.wildLatchUntil = 0
    })
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeon', { timeout: 8000 })
    const dungeon = await page.evaluate(() => (window as any).__hv.world())
    expect(dungeon.w).toBe(768)
    expect(dungeon.h).toBe(512)

    const back = await page.evaluate(() => {
      const scene = (window as any).__scene
      const zone = (scene.prompts || []).find((p: { action?: string }) => p.action === 'wilderness')
      if (!zone) return { ok: false, scene: scene.sceneId }
      const body = scene.player.body
      // The knight body sits above the feet. Park the body inside the exit, which
      // is what walking into the bottom of the cavern mouth does.
      body.x = zone.x + (zone.w - body.width) / 2
      body.y = zone.y + 8
      scene.player.setVelocity(0, 0)
      scene._tryInteract()
      return { ok: true, scene: scene.sceneId }
    })
    expect(back.ok, JSON.stringify(back)).toBe(true)
    expect(back.scene).toBe('wilderness')

    expect(consoleErrors, 'wilderness session console errors').toEqual([])
    expect(pageErrors, 'wilderness session page errors').toEqual([])
  })
})
