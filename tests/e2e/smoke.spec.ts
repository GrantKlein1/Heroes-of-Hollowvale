import { test, expect } from '@playwright/test';

test.describe('Heroes of Hollowvale — E2E Smoke & Visual Regression', () => {
  test('boots, selects class, visits every scene with 0 console errors and 0 404s', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    // Capture unhandled page errors / exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(`[pageerror] ${err.message}`);
    });

    // Capture HTTP 404 network responses
    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
      }
    });

    // Stub media playback in headless environment where audio devices/codecs are absent
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // 1. Boot with deterministic seed and QA mode enabled
    await page.goto('/?seed=1&qa=1');

    // Wait for the game canvas and start button
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();

    // Settle render and capture Title Screen baseline
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot('01-title-screen.png');

    // 2. Open Class Selection
    await startButton.click();
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();

    // Settle render and capture Class Select modal baseline
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot('02-class-selection.png');

    // 3. Choose Knight class to enter the village
    const chooseButtons = page.getByRole('button', { name: 'Choose' });
    await chooseButtons.first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for window.__hv QA interface to be mounted and ready in village
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.scene === 'function' &&
        typeof (window as any).__hv?.goto === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // 4. Visit every scene and capture visual baseline
    const scenes: Array<{ id: string; screenshot: string }> = [
      { id: 'village', screenshot: 'scene-01-village.png' },
      { id: 'tavern', screenshot: 'scene-02-tavern.png' },
      { id: 'path', screenshot: 'scene-03-path.png' },
      { id: 'dungeon', screenshot: 'scene-04-dungeon.png' },
      { id: 'market', screenshot: 'scene-05-market.png' },
      { id: 'dungeonInterior', screenshot: 'scene-06-dungeon-interior.png' },
      { id: 'treasureRoom', screenshot: 'scene-07-treasure-room.png' },
      { id: 'wilderness', screenshot: 'scene-08-wilderness.png' },
    ];

    for (const { id, screenshot } of scenes) {
      if (id !== 'village') {
        await page.evaluate((sceneId) => {
          (window as any).__hv.goto(sceneId);
        }, id);

        await page.waitForFunction((sceneId) => {
          return (window as any).__hv?.scene() === sceneId;
        }, id);
      }

      // Allow background textures, solids, and animations to settle
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(screenshot);
    }

    // 5. Invariant assertions: 0 console errors, 0 unhandled page errors, 0 404 responses
    expect(consoleErrors, 'Expected zero console.error calls during session').toEqual([]);
    expect(pageErrors, 'Expected zero unhandled page errors during session').toEqual([]);
    expect(notFoundResponses, 'Expected zero 404 HTTP responses during session').toEqual([]);
  });

  test('verifies failure detection on injected console.error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/?seed=1&qa=1');
    await page.evaluate(() => console.error('Test Injected Console Error'));

    expect(consoleErrors).toContain('Test Injected Console Error');
  });

  test('verifies failure detection on injected 404 response', async ({ page }) => {
    const notFoundResponses: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404) notFoundResponses.push(res.url());
    });

    // Route an intentional missing asset to return 404
    await page.route('**/injected-missing-asset.png', (route) => {
      route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not Found' });
    });

    await page.goto('/?seed=1&qa=1');
    await page.evaluate(() => fetch('/injected-missing-asset.png').catch(() => {}));

    expect(notFoundResponses.some((url) => url.includes('injected-missing-asset.png'))).toBe(true);
  });
});
