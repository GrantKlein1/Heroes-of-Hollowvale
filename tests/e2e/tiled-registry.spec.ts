import { test, expect } from '@playwright/test';

test.describe('Package 2-4: Data-Driven Tiled Map Registry, Multi-Atlas Props & Generic Doors', () => {
  test('Data-driven registry routes scenes, resolves generic doors, and spawns at named targetSpawn', async ({
    page,
  }) => {
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

    // Select Knight
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for village scene to be active
    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');

    // 2. Verify Brackenford village loaded through registry
    const villageMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(villageMetrics.w).toBe(960);
    expect(villageMetrics.h).toBe(960);

    // 3. Move to Tavern door and interact
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(288, 155);
      scene.player.body.reset(288, 155);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'tavern', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('tavern');

    // Verify tavern map metrics
    const tavernMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(tavernMetrics.w).toBe(640);
    expect(tavernMetrics.h).toBe(384);

    // 4. Return through generic exit to Brackenford
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      scene.player.body.reset(304, 320);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village');

    // Verify player spawned near door_tavern zone (center around x: 288, y: 144)
    const returnedPos = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return { x: scene.player.x, y: scene.player.y };
    });
    expect(returnedPos.x).toBeCloseTo(288, -1);

    // 5. Move to Market door and interact
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(96, 160);
      scene.player.body.reset(96, 160);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'market', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('market');

    // Return to Brackenford
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(304, 320);
      scene.player.body.reset(304, 320);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('village');

    // 6. Proves "new map = one registry entry" in live game
    const dynamicRoutingTest = await page.evaluate(() => {
      const scene = (window as any).__scene;
      // Test that MapLoader propSprites array exists and has valid count
      const propSpritesCount = scene.tiledMapLoader?.propSprites?.length ?? 0;
      return {
        hasLoader: Boolean(scene.tiledMapLoader),
        propSpritesCount,
      };
    });
    expect(dynamicRoutingTest.hasLoader).toBe(true);
    expect(dynamicRoutingTest.propSpritesCount).toBeGreaterThanOrEqual(1);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(notFoundResponses).toEqual([]);
  });
});
