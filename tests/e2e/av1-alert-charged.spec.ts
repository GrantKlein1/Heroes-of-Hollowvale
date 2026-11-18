import { test, expect } from '@playwright/test'

/**
 * AV-1: goblin alert frame and dwarf charged-release frame 3, with a clear cell border.
 */

test('goblin alert and dwarf charged frame 3 show without cell-edge clipping', async ({ page }) => {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })
  await page.route('/api/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  })

  await page.goto('/?renderer=blend&maps=tiled&qa=1&seed=1')
  await page.getByRole('button', { name: 'Start Game' }).click()
  await expect(page.getByText('Choose Your Class')).toBeVisible()
  await page.getByRole('button', { name: 'Choose Dwarf' }).click()
  await page.waitForFunction(() => (window as any).__hv?.scene() === 'village')

  const posed = await page.evaluate(() => {
    const scene = (window as any).__scene
    const player = scene.player
    player.body?.setVelocity?.(0, 0)
    player.update = () => {}
    player.anims?.stop?.()
    player.setTexture('dwarf_charged', 'dwarf_charged_release_down_3')
    player.setPosition(player.x + 40, player.y - 96)
    player.setDepth?.(8000)

    const enemy = scene.spawn('goblin', player.x - 72, player.y)
    enemy.ai = null
    enemy.update = () => {}
    enemy.body?.setVelocity?.(0, 0)
    enemy.anims?.stop?.()
    enemy.setTexture('goblin_alert', 'goblin_alert_down_1')
    enemy.setDepth?.(8000)

    return {
      alertAnim: scene.anims.exists('goblin_alert_down'),
      playerFrame: player.frame?.name,
      enemyFrame: enemy.frame?.name,
      playerSheet: player.texture?.key,
      enemySheet: enemy.texture?.key,
    }
  })

  expect(posed.alertAnim).toBe(true)
  expect(posed.playerSheet).toBe('dwarf_charged')
  expect(posed.playerFrame).toBe('dwarf_charged_release_down_3')
  expect(posed.enemySheet).toBe('goblin_alert')
  expect(posed.enemyFrame).toBe('goblin_alert_down_1')

  const edges = await page.evaluate(async () => {
    async function borderHits(src: string, cellW: number, cellH: number) {
      const img = new Image()
      img.src = src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.drawImage(img, 0, 0)
      let hits = 0
      for (let y = 0; y < img.height; y += cellH) {
        for (let x = 0; x < img.width; x += cellW) {
          const strips = [
            ctx.getImageData(x, y, cellW, 1).data,
            ctx.getImageData(x, y + cellH - 1, cellW, 1).data,
            ctx.getImageData(x, y, 1, cellH).data,
            ctx.getImageData(x + cellW - 1, y, 1, cellH).data,
          ]
          for (const strip of strips) {
            for (let i = 3; i < strip.length; i += 4) {
              if (strip[i] !== 0) hits += 1
            }
          }
        }
      }
      return { hits, w: img.width, h: img.height }
    }

    const alert = await borderHits('/assets/enemies/goblin/goblin_alert.png', 64, 64)
    const charged = await borderHits('/assets/characters/dwarf/dwarf_charged.png', 72, 80)
    return { alert, charged }
  })

  expect(edges.alert).toEqual({ hits: 0, w: 256, h: 256 })
  expect(edges.charged).toEqual({ hits: 0, w: 864, h: 320 })

  await page.screenshot({ path: 'tests/e2e/__screenshots__/av1-goblin-alert-dwarf-charged.png' })
})
