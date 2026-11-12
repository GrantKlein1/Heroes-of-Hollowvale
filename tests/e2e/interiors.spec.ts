import { test, expect } from '@playwright/test';

test.describe('Package 3-1: Interior Maps (Tavern & Market) Integration (?maps=tiled)', () => {
  test('Tavern interior loads behind ?renderer=blend&maps=tiled, Tharos is reachable, and exit returns to Brackenford', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log('PAGE ERROR STACK:', err.stack);
      pageErrors.push(`[pageerror] ${err.message}`);
    });

    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
      }
    });

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.route('/api/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    // 1. Boot with ?renderer=blend&maps=tiled
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Choose Knight
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for village scene
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');

    // 2. Move player in front of tavern door (x: 288, y: 155)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(288, 155);
      scene.player.body.reset(288, 155);
    });

    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      if ((window as any).__hv?.scene() === 'village') {
        (window as any).__scene._tryInteract();
      }
    });

    // Wait for tavern scene to load
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'tavern', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('tavern');

    // 3. Verify Tavern 640x384 Tiled map metrics and loader
    const tavernMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(tavernMetrics.w).toBe(640);
    expect(tavernMetrics.h).toBe(384);

    const tavernValidation = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const loader = scene?.tiledMapLoader;
      return {
        hasLoader: Boolean(loader),
        validLayers: loader?.validateLayers?.()?.valid,
        propSpritesCount: loader?.propSprites?.length || 0,
        groundLayerExists: Boolean(loader?.tilemapLayers?.get('ground')),
        wallsLayerExists: Boolean(loader?.tilemapLayers?.get('walls')),
        collisionLayerExists: Boolean(loader?.tilemapLayers?.get('collision')),
      };
    });

    expect(tavernValidation.hasLoader).toBe(true);
    expect(tavernValidation.validLayers).toBe(true);
    expect(tavernValidation.groundLayerExists).toBe(true);
    expect(tavernValidation.wallsLayerExists).toBe(true);
    expect(tavernValidation.collisionLayerExists).toBe(true);
    expect(tavernValidation.propSpritesCount).toBeGreaterThanOrEqual(1);

    // 4. Approach Tharos and verify dialogue trigger
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(340, 175);
      scene.player.body.reset(340, 175);
      scene._tryInteract();
    });

    const tharosHeading = page.locator('text=Tharos the Bartender');
    await expect(tharosHeading.first()).toBeVisible({ timeout: 5000 });

    // Settle and capture visual screenshot of Tavern interior
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tests/e2e/__screenshots__/scene-tavern-interior.png' });

    // Close chat overlay
    const leaveButton = page.getByRole('button', { name: 'Leave' });
    if (await leaveButton.isVisible()) {
      await leaveButton.click();
    } else {
      const closeBtn = page.getByLabel('Close');
      if (await closeBtn.isVisible()) await closeBtn.click();
    }
    await page.waitForTimeout(300);

    // 5. Walk to exit door at bottom (x: 304, y: 320) and exit back to village
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      scene.player.body.reset(304, 320);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundResponses).toEqual([]);
  });

  test('Market interior loads behind ?renderer=blend&maps=tiled, Hest Mallow is reachable, and exit returns to Brackenford', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const notFoundResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      console.log('PAGE ERROR STACK:', err.stack);
      pageErrors.push(`[pageerror] ${err.message}`);
    });

    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundResponses.push(`[404] ${res.status()} ${res.url()}`);
      }
    });

    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.route('/api/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    // 1. Boot with ?renderer=blend&maps=tiled
    await page.goto('/?renderer=blend&maps=tiled&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // Choose Knight
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for village scene
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');

    // 2. Move player in front of market door (x: 96, y: 180)
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(96, 180);
      scene.player.body.reset(96, 180);
      scene._tryInteract();
    });

    // Wait for market scene to load
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'market', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('market');

    // 3. Verify Market 640x384 Tiled map metrics and loader
    const marketMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(marketMetrics.w).toBe(640);
    expect(marketMetrics.h).toBe(384);

    const marketValidation = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const loader = scene?.tiledMapLoader;
      return {
        hasLoader: Boolean(loader),
        validLayers: loader?.validateLayers?.()?.valid,
        propSpritesCount: loader?.propSprites?.length || 0,
        groundLayerExists: Boolean(loader?.tilemapLayers?.get('ground')),
        wallsLayerExists: Boolean(loader?.tilemapLayers?.get('walls')),
        collisionLayerExists: Boolean(loader?.tilemapLayers?.get('collision')),
      };
    });

    expect(marketValidation.hasLoader).toBe(true);
    expect(marketValidation.validLayers).toBe(true);
    expect(marketValidation.groundLayerExists).toBe(true);
    expect(marketValidation.wallsLayerExists).toBe(true);
    expect(marketValidation.collisionLayerExists).toBe(true);
    expect(marketValidation.propSpritesCount).toBeGreaterThanOrEqual(1);

    // 4. Approach Hest Mallow and verify vendor interaction
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(216, 190);
      scene.player.body.reset(216, 190);
      scene._tryInteract();
    });

    const marketHeading = page.locator('text=Market Stall');
    await expect(marketHeading.first()).toBeVisible({ timeout: 5000 });

    // Settle and capture visual screenshot of Market interior
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tests/e2e/__screenshots__/scene-market-interior.png' });

    // Close shop modal
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);

    // 5. Walk to exit door at bottom (x: 304, y: 320) and exit back to village
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      scene.player.body.reset(304, 320);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundResponses).toEqual([]);
  });
});
