import { test, expect } from '@playwright/test';

test.describe('FD-1: blend renderer and Tiled maps are the default', () => {
  test('village loads Blendsmith art on the Tiled map with no renderer or maps params', async ({ page }) => {
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    // qa=1 is the only query param, so window.__hv exists. Renderer and maps stay at the defaults.
    await page.goto('/?qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.scene === 'function' &&
        typeof (window as any).__hv?.world === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    const state = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const player = scene?.player;
      const search = window.location.search;
      return {
        search,
        sceneId: (window as any).__hv.scene(),
        world: (window as any).__hv.world(),
        hasAssetRegistry: Boolean(scene?.assetRegistry),
        hasTiledLoader: Boolean(scene?.tiledMapLoader),
        groundLayer: Boolean(scene?.tiledMapLoader?.tilemapLayers?.get('ground')),
        playerClass: player?.classId || null,
        playerTexture: player?.texture?.key || null,
        hasStateMachine: Boolean(player?.stateMachine),
      };
    });

    expect(state.search).toBe('?qa=1');
    expect(state.sceneId).toBe('village');
    expect(state.world).toEqual({ w: 640, h: 384 });
    expect(state.hasAssetRegistry).toBe(true);
    expect(state.hasTiledLoader).toBe(true);
    expect(state.groundLayer).toBe(true);
    expect(state.playerClass).toBe('knight');
    expect(state.hasStateMachine).toBe(true);
    expect(state.playerTexture).not.toBe('__px');

    await page.waitForTimeout(600);
    await page.screenshot({
      path: 'tests/e2e/__screenshots__/fd-1-default-village.png',
      fullPage: false,
    });
  });
});
