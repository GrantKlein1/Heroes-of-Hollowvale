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

      // Settle and capture visual screenshot for the class
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot(`player-${classId}.png`);

      // 5. Test hurt animation
      await page.evaluate(() => {
        (window as any).__scene?._hurtPlayer?.(10);
      });
      await page.waitForFunction(
        (expectedPrefix) => ((window as any).__hv.anim() || '').startsWith(expectedPrefix),
        `${classId}_hurt_`,
        { timeout: 5000 }
      );
      const hurtKey = await page.evaluate(() => (window as any).__hv.anim());
      expect(hurtKey).toBe(`${classId}_hurt_up`);

      // 6. Zero error invariant assertions
      expect(consoleErrors, 'Expected zero console errors').toEqual([]);
      expect(pageErrors, 'Expected zero unhandled page errors').toEqual([]);
      expect(notFoundResponses, 'Expected zero 404 responses').toEqual([]);
    });
  }
});
