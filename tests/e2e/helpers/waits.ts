import { expect, type Page } from '@playwright/test'

/** Scene transitions and first boot can exceed the default 5–10s on the CI runner. */
export const SCENE_TIMEOUT = 20_000
/** Attack, cast, and tool clips can take longer than 3s of wall time on a slow runner. */
export const ANIM_TIMEOUT = 10_000

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
 * Load the display face used by class-select and other UI headings.
 * Screenshot diffs of ~0.3 on the runner were the fallback serif, not a layout bug.
 */
export async function waitForDisplayFont(page: Page, timeout = 5000): Promise<boolean> {
  return page.evaluate(async (ms) => {
    const fonts = (document as any).fonts
    if (!fonts) return false
    try {
      await fonts.ready
      await Promise.race([
        fonts.load('24px "Uncial Antiqua"'),
        new Promise((resolve) => setTimeout(resolve, ms)),
      ])
    } catch {
      return false
    }
    return Boolean(fonts.check?.('24px "Uncial Antiqua"') || fonts.check?.('16px "Uncial Antiqua"'))
  }, timeout)
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
