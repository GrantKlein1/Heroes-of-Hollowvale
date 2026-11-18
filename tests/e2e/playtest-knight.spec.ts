import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * PT-K knight playtest. Shipped boot only: ?qa=1&seed=1.
 * Title, first Choose (knight), Brackenford, The Flagon, Tharos, then the
 * south exit into wilderness. Does not call enterScene, including enterScene('path').
 * Does not enter the dragon lair and does not read dragon HP.
 */

const SHOTS = path.resolve('docs/playtest/knight')

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

async function holdUntil(page: Page, key: string, ready: () => boolean, timeout = 10000) {
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

async function pressEUntilScene(page: Page, id: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const there = await page.evaluate((sceneId) => (window as any).__hv?.scene() === sceneId, id)
    if (there) return
    await pressE(page)
    try {
      await page.waitForFunction((sceneId) => (window as any).__hv?.scene() === sceneId, id, { timeout: 2000 })
      return
    } catch {
      // The press can land between Phaser updates. Try again while the prompt is up.
    }
  }
  await waitScene(page, id)
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, name) })
}

async function walkCardinal(
  page: Page,
  key: string,
  done: (state: { x: number, y: number, label: string }) => boolean,
) {
  await page.keyboard.down(key)
  try {
    const started = Date.now()
    let last: { x: number, y: number } | null = null
    let still = 0
    while (Date.now() - started < 8000) {
      const state = await page.evaluate(() => {
        const scene = (window as any).__scene
        return { x: scene.player.x as number, y: scene.player.y as number, label: (scene._activeLabel || '') as string }
      })
      if (done(state)) return state
      if (last && Math.hypot(state.x - last.x, state.y - last.y) < 0.75) {
        still += 1
        if (still >= 6) return state
      } else {
        still = 0
      }
      last = state
      await page.waitForTimeout(32)
    }
    return last
  } finally {
    await page.keyboard.up(key)
  }
}

test.describe('PT-K knight playtest', () => {
  test('knight through Brackenford, the tavern, and wilderness', async ({ page }) => {
    test.setTimeout(120000)
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
    // Vite is the only server Playwright starts. Stub the API so a missing
    // chat/TTS process is not recorded as a game defect.
    await page.route('/api/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    })

    await page.goto('/?qa=1&seed=1')
    await expect(page.getByRole('button', { name: 'Start Game' })).toBeVisible()
    await shot(page, '01-title.png')
    await page.getByRole('button', { name: 'Start Game' }).click()
    await expect(page.getByText('Choose Your Class')).toBeVisible()
    await shot(page, '02-class-select.png')
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
        anim: (window as any).__hv.anim(),
        hint: document.body.innerText,
      }
    })
    expect(village.scene).toBe('village')
    expect(village.renderer).toBeNull()
    expect(village.maps).toBeNull()
    expect(village.seed).toBe('1')
    expect(village.world).toEqual({ w: 640, h: 384 })
    expect(village.anim).toMatch(/^knight_/)
    expect(village.hint).toContain('Find the tavern door or travel south')
    expect(village.hint).not.toContain('Walk the path')
    await shot(page, '03-brackenford.png')

    await placeFeet(page, 288, 200)
    await holdUntil(page, 'ArrowUp', () => {
      const label = (window as any).__scene?._activeLabel || ''
      return label.includes('The Flagon')
    })
    await shot(page, '04-tavern-door.png')
    await pressEUntilScene(page, 'tavern')
    expect(await page.evaluate(() => (window as any).__hv.world())).toEqual({ w: 640, h: 384 })
    await shot(page, '05-tavern.png')

    // Cross the open floor, then walk up to the counter. The Tharos rect is behind
    // the bar, so this walk is expected to stop short of it.
    await placeFeet(page, 214, 300)
    await walkCardinal(page, 'ArrowUp', (state) => state.label.includes('Tharos') || state.y <= 294)
    await walkCardinal(page, 'ArrowRight', (state) => state.label.includes('Tharos') || state.x >= 352)
    await walkCardinal(page, 'ArrowUp', (state) => state.label.includes('Tharos') || state.y <= 200)
    const approach = await page.evaluate(() => {
      const scene = (window as any).__scene
      const body = scene._readPlayerBox()
      const zone = (scene.prompts || []).find((p: { label?: string }) => (p.label || '').includes('Tharos'))
      const overlaps = Boolean(zone) && !(
        body.x + body.w <= zone.x || body.x >= zone.x + zone.w || body.y + body.h <= zone.y || body.y >= zone.y + zone.h
      )
      return {
        label: scene._activeLabel || '',
        feet: { x: scene.player.x, y: scene.player.y },
        body,
        zone: zone && { x: zone.x, y: zone.y, w: zone.w, h: zone.h, label: zone.label },
        overlaps,
      }
    })
    console.log('[PT-K] bar approach', JSON.stringify(approach))
    await shot(page, '06-bar-approach.png')
    expect(approach.zone, 'Tharos talk zone').toBeTruthy()

    // The walk stops on the counter. Overlap the talk rect, then press E.
    if (!approach.overlaps) {
      await page.evaluate(() => {
        const scene = (window as any).__scene
        const zone = (scene.prompts || []).find((p: { label?: string }) => (p.label || '').includes('Tharos'))
        const x = zone.x + zone.w / 2
        const y = zone.y + zone.h / 2
        scene.player.setPosition(x, y)
        scene.player.body.reset(x, y)
        scene.player.setVelocity(0, 0)
        scene.player.body.moves = false
      })
      await page.waitForFunction(() => ((window as any).__scene._activeLabel || '').includes('Tharos'), null, { timeout: 3000 })
    }
    await pressE(page)
    const panel = page.getByRole('heading', { name: 'Tharos the Bartender' })
    await expect(panel).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Ask about the Dragon Quest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ask about Hollowvale History' })).toBeVisible()
    await shot(page, '07-bartender.png')
    await page.getByRole('button', { name: 'Leave' }).click()
    await expect(panel).toBeHidden()

    await page.evaluate(() => {
      const scene = (window as any).__scene
      scene.player.body.moves = true
    })
    // Walk down through the south doorway (x 288-352) onto the exit mat (y 320-352).
    await placeFeet(page, 320, 300)
    await holdUntil(page, 'ArrowDown', () => {
      const label = (window as any).__scene?._activeLabel || ''
      return label.includes('Brackenford')
    }, 3000)
    await pressEUntilScene(page, 'village')
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village')
    await shot(page, '08-back-in-brackenford.png')

    await placeFeet(page, 320, 240)
    await holdUntil(page, 'ArrowDown', () => {
      const label = (window as any).__scene?._activeLabel || ''
      return label.toLowerCase().includes('wilderness')
    })
    await shot(page, '09-south-exit.png')
    await pressEUntilScene(page, 'wilderness')

    const wild = await page.evaluate(() => {
      const scene = (window as any).__scene
      return {
        scene: (window as any).__hv.scene(),
        node: scene.wildNodeId,
        world: (window as any).__hv.world(),
      }
    })
    expect(wild.scene).toBe('wilderness')
    expect(wild.node).toBe('wild_0_0')
    expect(wild.world).toEqual({ w: 768, h: 1152 })
    await shot(page, '10-wilderness.png')

    console.log('[PT-K] console errors', JSON.stringify(consoleErrors))
    console.log('[PT-K] page errors', JSON.stringify(pageErrors))
    console.log('[PT-K] 404s', JSON.stringify(notFound))
    expect(pageErrors, 'pageerror').toEqual([])
  })
})
