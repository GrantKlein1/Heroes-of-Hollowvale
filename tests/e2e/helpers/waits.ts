import { expect, test, type Page } from '@playwright/test'

/** Scene transitions and first boot can exceed the default 5–10s on the CI runner. */
export const SCENE_TIMEOUT = 30_000
/** Attack, cast, and tool clips can take longer than 3s of wall time on a slow runner. */
export const ANIM_TIMEOUT = 10_000

/** Triples the 60s config timeout to 180s. Do not also call setTimeout; that replaces this. */
export function markSlow() {
  test.slow()
}

export async function stubAudio(page: Page) {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  })
}

export async function waitForScene(page: Page, id: string, timeout = SCENE_TIMEOUT) {
  await page.waitForFunction(
    (sceneId) =>
      typeof (window as any).__hv?.scene === 'function' &&
      (window as any).__hv.scene() === sceneId,
    id,
    { timeout },
  )
}

/**
 * Wait until the Phaser loop has advanced `count` frames after `startFrame`.
 * Prefer this over "N frames must occur inside 1 wall-clock second", which
 * fails on a runner that is slow but not frozen.
 */
export async function waitForLoopFrames(
  page: Page,
  startFrame: number,
  count: number,
  timeout = 5000,
) {
  await page.waitForFunction(
    ({ start, needed }) => ((window as any).__scene?.game?.loop?.frame ?? 0) >= start + needed,
    { start: startFrame, needed: count },
    { timeout },
  )
}

/**
 * Block until the self-hosted Uncial Antiqua face is the one that will paint.
 * A timeout used to resolve this race as success, and the class-select shot
 * then compared a serif fallback (diff ~0.33) against the display-face baseline.
 */
export async function waitForDisplayFont(page: Page, timeout = 15_000): Promise<void> {
  try {
    await page.waitForFunction(() => {
      const fonts = document.fonts
      if (!fonts?.load || !fonts.check) return false
      void fonts.load('16px "Uncial Antiqua"')
      void fonts.load('24px "Uncial Antiqua"')
      void fonts.load('48px "Uncial Antiqua"')
      return fonts.check('24px "Uncial Antiqua"') && fonts.check('48px "Uncial Antiqua"')
    }, undefined, { timeout })
  } catch (err) {
    throw new Error('Uncial Antiqua did not become ready before the screenshot', { cause: err })
  }
}

/**
 * Hold the tiled scene still for a screenshot.
 * Water cycles every 160ms, exit outlines pulse on performance.now(), and a
 * swing's frame depends on wall-clock time since Space. Any one of those put
 * the 1080p Brackenford diff over the 0.05 cap on a slow runner.
 * `playerFrame` pins the player's current clip (0 for idle scenes, a mid
 * attack frame when the shot is meant to show a swing).
 */
export async function freezeSceneForScreenshot(page: Page, options: { playerFrame?: number } = {}) {
  const playerFrame = options.playerFrame ?? 0
  const started = await page.evaluate((pinnedFrame) => {
    const scene = (window as any).__scene
    if (!scene) return null

    const loader = scene.tiledMapLoader
    if (loader?.waterTimer) loader.waterTimer.paused = true
    if (typeof loader?.stepWaterAnimation === 'function' && loader.waterTiles?.length) {
      if (typeof loader.waterFrame !== 'number') loader.waterFrame = 0
      for (let i = 0; i < 4 && loader.waterFrame !== 0; i += 1) loader.stepWaterAnimation()
    }

    if (typeof scene._drawBeacons === 'function' && !scene.__hvBeacons) {
      const original = scene._drawBeacons.bind(scene)
      scene.__hvBeacons = original
      scene._drawBeacons = () => {
        const real = performance.now
        performance.now = () => (350 * Math.PI) / 2
        try {
          return original()
        } finally {
          performance.now = real
        }
      }
    }
    if (typeof scene._drawBeacons === 'function') scene._drawBeacons()

    const kids = scene.children?.list || []
    for (const obj of kids) {
      const anims = obj?.anims
      const frames = anims?.currentAnim?.frames
      if (!frames?.length) continue
      const isPlayer = obj === scene.player
      const index = isPlayer
        ? Math.min(Math.max(pinnedFrame, 0), frames.length - 1)
        : 0
      anims.pause?.()
      anims.setCurrentFrame?.(frames[index])
    }
    scene.tweens?.pauseAll?.()
    return scene.game?.loop?.frame ?? 0
  }, playerFrame)

  if (started === null) return
  // One loop tick after the pin, so the canvas shows water frame 0 and the held clip.
  await page.waitForFunction((start) => {
    const frame = (window as any).__scene?.game?.loop?.frame ?? 0
    return frame > start
  }, started, { timeout: 5000 })
}

/** Title-screen sword cycles on setInterval. Lock the first plate so the shot is stable. */
export async function freezeTitleSword(page: Page) {
  await page.evaluate(() => {
    const img = document.querySelector('img[alt="Animated Sword"]') as HTMLImageElement | null
    if (!img) return
    const next = img.src.replace(/animatedSword\d+\.png/, 'animatedSword1.png')
    const proto = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    if (proto?.set) proto.set.call(img, next)
    else img.src = next
    if (!proto?.get || !proto.set) return
    Object.defineProperty(img, 'src', {
      configurable: true,
      get() { return proto.get!.call(this) },
      set() { /* stay on the first sword plate */ },
    })
  })
}

export async function settleForScreenshot(page: Page, extraMs = 400) {
  await waitForDisplayFont(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  if (extraMs > 0) await page.waitForTimeout(extraMs)
}

/** Preview a class in the calling-screen dialog. Focus is reliable in headless; hover alone is not. */
export async function previewClass(page: Page, button: import('@playwright/test').Locator, heading: string) {
  await button.focus()
  await button.hover({ force: true })
  await expect(page.getByRole('dialog').locator('h3')).toHaveText(heading, { timeout: 15000 })
}
