import { test, expect } from '@playwright/test';

const CLASSES = [
  { id: 'knight', name: 'Knight', index: 0 },
  { id: 'mage', name: 'Mage', index: 1 },
  { id: 'thief', name: 'Thief', index: 2 },
  { id: 'dwarf', name: 'Dwarf', index: 3 },
];

test.describe('Heroes of Hollowvale — Player Actor (Package 1-3)', () => {
  for (const { id: classId, name: className, index: classIndex } of CLASSES) {
    test(`${className}: 4-directional walk, idle, and hurt animations under ?renderer=blend`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const notFoundResponses: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
        }
      });

      page.on('pageerror', (err) => {
        pageErrors.push(`[pageerror] ${err.message}`);
      });

      page.on('response', (res) => {
        if (res.status() === 404) {
          notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
        }
      });

      // Stub audio playback in headless environment
      await page.addInitScript(() => {
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      });

      // 1. Boot with blend renderer and QA mode
      await page.goto('/?renderer=blend&seed=1&qa=1');

      const canvas = page.locator('canvas');
      await expect(canvas).toBeVisible();

      const startButton = page.getByRole('button', { name: 'Start Game' });
      await expect(startButton).toBeVisible();
      await startButton.click();

      // 2. Select class in modal
      const classModalHeading = page.getByText('Choose Your Class');
      await expect(classModalHeading).toBeVisible();

      await page.getByRole('button', { name: 'Choose' }).nth(classIndex).click();
      await expect(classModalHeading).toBeHidden();

      // 3. Wait for scene and __hv API to be ready
      await page.waitForFunction(() => {
        return (
          typeof (window as any).__hv?.anim === 'function' &&
          typeof (window as any).__hv?.scene === 'function' &&
          (window as any).__hv.scene() === 'village'
        );
      });

      // Assert initial idle state
      await page.waitForFunction(
        (expected) => (window as any).__hv.anim() === expected,
        `${classId}_idle_down`
      );
      expect(await page.evaluate(() => (window as any).__hv.anim())).toBe(`${classId}_idle_down`);

      // Package 1-3b: Verify calibrated native 1x actor scale under blend renderer
      const playerScale = await page.evaluate(() => {
        const p = (window as any).__scene?.player;
        return { scaleX: p?.scaleX, scaleY: p?.scaleY };
      });
      expect(playerScale.scaleX).toBe(1);
      expect(playerScale.scaleY).toBe(1);

      // Freeze frame 0 of idle animation to ensure a 100% deterministic visual baseline screenshot
      await page.evaluate(() => {
        const p = (window as any).__scene?.player;
        if (p?.anims?.currentAnim) {
          p.anims.pause();
          p.anims.setCurrentFrame(p.anims.currentAnim.frames[0]);
        }
      });
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`player-${classId}.png`);

      // Resume animation for movement and combat tests
      await page.evaluate(() => {
        const p = (window as any).__scene?.player;
        if (p?.anims?.isPaused) {
          p.anims.resume();
        }
      });

      // 4. Test directional walk animations (Down, Left, Right, Up)
      const directions = [
        { key: 'ArrowDown', anim: `${classId}_walk_down`, idle: `${classId}_idle_down` },
        { key: 'ArrowLeft', anim: `${classId}_walk_left`, idle: `${classId}_idle_left` },
        { key: 'ArrowRight', anim: `${classId}_walk_right`, idle: `${classId}_idle_right` },
        { key: 'ArrowUp', anim: `${classId}_walk_up`, idle: `${classId}_idle_up` },
      ];

      for (const { key, anim, idle } of directions) {
        await page.keyboard.down(key);
        await page.waitForFunction(
          (expected) => (window as any).__hv.anim() === expected,
          anim,
          { timeout: 5000 }
        );
        expect(await page.evaluate(() => (window as any).__hv.anim())).toBe(anim);

        await page.keyboard.up(key);
        await page.waitForFunction(
          (expected) => (window as any).__hv.anim() === expected,
          idle,
          { timeout: 5000 }
        );
        expect(await page.evaluate(() => (window as any).__hv.anim())).toBe(idle);
      }

      // 5. Test hurt animation
      await page.evaluate(() => {
        (window as any).__scene?._hurtPlayer?.(10);
      });
      await page.waitForFunction(
        (expectedPrefix) => ((window as any).__hv.anim() || '').startsWith(expectedPrefix),
        `${classId}_hurt_`,
        { timeout: 5000 }
      );
      // Verify player cleanly completes hurt and transitions back to idle_up
      await page.waitForFunction(
        (expectedIdle) => (window as any).__hv.anim() === expectedIdle,
        `${classId}_idle_up`,
        { timeout: 5000 }
      );

      // 6. Zero error invariant assertions
      expect(consoleErrors, 'Expected zero console errors').toEqual([]);
      expect(pageErrors, 'Expected zero unhandled page errors').toEqual([]);
      expect(notFoundResponses, 'Expected zero 404 responses').toEqual([]);
    });
  }

  test('Package 1-3b: Calibrated 1920x1080 viewport and alignment verification', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.goto('/?renderer=blend&seed=1&qa=1');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    await page.getByRole('button', { name: 'Choose' }).nth(0).click();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.anim === 'function' &&
        (window as any).__hv.anim() === 'knight_idle_down'
      );
    });

    // Verify calibrated scale and camera metrics
    const metrics = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const p = scene?.player;
      const cam = scene?.cameras?.main;
      return {
        scaleX: p?.scaleX,
        scaleY: p?.scaleY,
        width: p?.displayWidth,
        height: p?.displayHeight,
        bodyWidth: p?.body?.width,
        bodyHeight: p?.body?.height,
        zoom: cam?.zoom,
        worldViewWidth: cam?.worldView?.width,
        worldViewHeight: cam?.worldView?.height,
      };
    });

    expect(metrics.scaleX).toBe(1);
    expect(metrics.scaleY).toBe(1);
    expect(metrics.width).toBe(64);
    expect(metrics.height).toBe(96);
    // Footprint body matches atlas metadata (23x7)
    expect(metrics.bodyWidth).toBe(23);
    expect(metrics.bodyHeight).toBe(7);
    // Camera zoom covers painted backdrop
    expect(metrics.zoom).toBe(2);

    // Freeze frame 0 and capture 1080p baseline screenshot
    await page.evaluate(() => {
      const p = (window as any).__scene?.player;
      if (p?.anims?.currentAnim) {
        p.anims.pause();
        p.anims.setCurrentFrame(p.anims.currentAnim.frames[0]);
      }
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('player-knight-1080p.png', { timeout: 30000 });
  });
});
