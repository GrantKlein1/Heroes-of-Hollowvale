import { test, expect } from '@playwright/test';
import { waitForScene } from './helpers/waits';

test.describe('Package BF-1: Brackenford Market Approach (Unblocked Bridge Walk)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
  });

  test('Knight walks unimpeded from bridge into market without rolling, and spawns reported after exit', async ({ page }) => {
    test.setTimeout(120_000);
    // 1. Boot on default path /?qa=1 (no renderer or maps params)
    await page.goto('/?qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Select Knight (index 0)
    const chooseModal = page.getByText('Choose Your Class');
    await expect(chooseModal).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(chooseModal).toBeHidden();

    // Wait for village scene
    await waitForScene(page, 'village');

    // 2. Place Knight on bridge north end, feet at (192, 220)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(192, 220);
      if (scene.player.body) {
        scene.player.body.reset(192, 220);
      }
    });

    // 3. Hold walk-left key (ArrowLeft) for up to 3 s without pressing C or Space
    await page.keyboard.down('ArrowLeft');

    // Wait until prompt appears: "Press E to enter the Market" (or player reaches door_market)
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const player = scene?.player;
      if (!player) return false;
      const door = scene?.doorMarket || scene?.zones?.find?.((z: any) => z.name === 'door_market');
      const inZone = player.x <= 130 && player.x >= 64 && player.y >= 180 && player.y <= 230;
      const promptActive = scene?.prompts?.some?.((p: any) => p.text?.includes?.('enter the Market'));
      return inZone || promptActive;
    }, null, { timeout: 8000 });

    await page.keyboard.up('ArrowLeft');

    // Press E to enter the market
    await page.keyboard.press('KeyE');
    await waitForScene(page, 'market');
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('market');

    // 4. Exit market to village to test repeat walk from spawn_south (288, 288)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      if (scene.player.body) {
        scene.player.body.reset(304, 320);
      }
      scene._tryInteract();
    });

    await waitForScene(page, 'village');

    // Place Knight at spawn_south (288, 288)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(288, 288);
      if (scene.player.body) {
        scene.player.body.reset(288, 288);
      }
    });

    // Walk north over the bridge:
    // First walk left towards bridge column (x ~192)
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => (window as any).__scene?.player?.x <= 195, null, { timeout: 8000 });
    await page.keyboard.up('ArrowLeft');

    // Walk north over the bridge
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => (window as any).__scene?.player?.y <= 220, null, { timeout: 8000 });
    await page.keyboard.up('ArrowUp');

    // Walk west towards market door
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const player = scene?.player;
      return player?.x <= 128 && player?.y <= 224;
    }, null, { timeout: 8000 });
    await page.keyboard.up('ArrowLeft');

    // Press E to enter the market
    await page.keyboard.press('KeyE');
    await waitForScene(page, 'market');
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('market');

    // 5. Exit market and report landing position and walkability
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      if (scene.player.body) {
        scene.player.body.reset(304, 320);
      }
      scene._tryInteract();
    });

    await waitForScene(page, 'village');
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village');

    const exitReport = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const p = scene.player;
      const landingX = p.x;
      const landingY = p.y;
      const loader = scene.tiledMapLoader;

      // Check if player position is inside cottage_base footprint (x: 22-138, y: 122-192)
      const insideCottage = landingX >= 22 && landingX <= 138 && landingY >= 122 && landingY <= 192;

      // Try sweeping in all 4 directions by 16px to test walkability
      const collider = { x: landingX - 11.5, y: landingY - 7, width: 23, height: 7 };
      const sweepSouth = loader ? loader.sweep(collider, 0, 16) : null;
      const sweepNorth = loader ? loader.sweep(collider, 0, -16) : null;
      const sweepEast = loader ? loader.sweep(collider, 16, 0) : null;
      const sweepWest = loader ? loader.sweep(collider, -16, 0) : null;

      return {
        landingX,
        landingY,
        insideCottage,
        canWalkSouth: sweepSouth ? !sweepSouth.blocked : null,
        canWalkNorth: sweepNorth ? !sweepNorth.blocked : null,
        canWalkEast: sweepEast ? !sweepEast.blocked : null,
        canWalkWest: sweepWest ? !sweepWest.blocked : null,
      };
    });

    console.log('[BF-1 Post-Exit Spawn Report]', JSON.stringify(exitReport, null, 2));

    expect(Math.hypot(exitReport.landingX - 96, exitReport.landingY - 160)).toBeGreaterThan(16);
    expect(exitReport.landingX).toBeCloseTo(144, 0);
    expect(exitReport.landingY).toBeCloseTo(208, 0);

    await page.waitForFunction(() => {
      const scene = (window as any).__scene;
      const player = scene?.player;
      const body = player?.body;
      return Boolean(body && body.y > player.y - 10);
    }, null, { timeout: 5000 });

    const marketExitOverlap = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const body = scene.player.body;
      return scene.tiledMapLoader.checkCollision({
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
      });
    });
    expect(marketExitOverlap).toBe(false);

    await page.screenshot({ path: 'tests/e2e/__screenshots__/mx1-market-exit.png' });

    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      (startX) => (window as any).__scene.player.x >= startX + 32,
      exitReport.landingX,
      { timeout: 4000 }
    );
    await page.keyboard.up('ArrowRight');

    // Save screenshot of market approach in village
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(160, 216);
      if (scene.player.body) scene.player.body.reset(160, 216);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/e2e/__screenshots__/bf1-market-approach.png' });
  });
});
