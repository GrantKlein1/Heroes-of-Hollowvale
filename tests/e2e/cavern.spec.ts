import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Package 3-2: Cavern of Embers Tiled Maps & Dragon Lair Encounter', () => {
  test.beforeEach(async ({ page }) => {
    // Stub audio in headless environment
    await page.addInitScript(() => {
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    });

    await page.route('/api/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
  });

  test('walks wilderness hub -> cavern mouth -> Molten Halls -> treasure room and back; halls -> lair with dragon encounter and death reset', async ({ page }) => {
    test.setTimeout(120000);
    const screenshotsDir = path.resolve('tests/e2e/__screenshots__');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }



    // 1. Boot with ?renderer=blend&maps=tiled&qa=1&seed=1
    await page.goto('/?renderer=blend&maps=tiled&qa=1&seed=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(400);
    await startButton.click();

    // Choose Knight class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    // Wait for village scene to be active
    await page.waitForFunction(() => {
      return (
        typeof (window as any).__hv?.scene === 'function' &&
        (window as any).__hv.scene() === 'village'
      );
    });

    // 2. Transition from Wilderness Hub to Cavern Mouth
    // In game flow, entering 'dungeon' resolves to cavern_mouth behind ?maps=tiled
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.enterScene('dungeon');
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeon', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('dungeon');

    // Verify Cavern Mouth metrics: 24x16 @ 32px -> 768x512
    const mouthMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(mouthMetrics.w).toBe(768);
    expect(mouthMetrics.h).toBe(512);

    const mouthValidation = await page.evaluate(() => {
      const scene = (window as any).__scene;
      const loader = scene?.tiledMapLoader;
      return {
        hasLoader: Boolean(loader),
        validLayers: loader?.validateLayers?.()?.valid,
        propSpritesCount: loader?.propSprites?.length || 0,
        groundLayerExists: Boolean(loader?.tilemapLayers?.get('ground')),
        wallsLayerExists: Boolean(loader?.tilemapLayers?.get('walls')),
        collisionLayerExists: Boolean(loader?.tilemapLayers?.get('collision')),
        overheadLayerExists: Boolean(loader?.tilemapLayers?.get('overhead')),
      };
    });

    expect(mouthValidation.hasLoader).toBe(true);
    expect(mouthValidation.validLayers).toBe(true);
    expect(mouthValidation.groundLayerExists).toBe(true);
    expect(mouthValidation.wallsLayerExists).toBe(true);
    expect(mouthValidation.collisionLayerExists).toBe(true);
    expect(mouthValidation.overheadLayerExists).toBe(true);
    expect(mouthValidation.propSpritesCount).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, 'cavern-mouth.png') });

    // 3. Move player in front of door_halls (center: 384, 224) and interact -> Molten Halls
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(384, 260);
      scene.player.body.reset(384, 260);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeonInterior', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('dungeonInterior');

    // Verify Molten Halls metrics: 28x16 @ 32px -> 896x512
    const hallsMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(hallsMetrics.w).toBe(896);
    expect(hallsMetrics.h).toBe(512);

    const hallsValidation = await page.evaluate(() => {
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

    expect(hallsValidation.hasLoader).toBe(true);
    expect(hallsValidation.validLayers).toBe(true);
    expect(hallsValidation.propSpritesCount).toBeGreaterThanOrEqual(10);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, 'cavern-halls.png') });

    // 4. Move player to door_treasure and interact -> Treasure Room
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(784, 170);
      scene.player.body.reset(784, 170);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'treasureRoom', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('treasureRoom');

    // Verify Treasure Room metrics: 20x12 @ 32px -> 640x384
    const treasureMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(treasureMetrics.w).toBe(640);
    expect(treasureMetrics.h).toBe(384);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, 'cavern-treasure.png') });

    // Exit back to Molten Halls via door_halls
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(320, 409);
      scene.player.body.reset(320, 409);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeonInterior', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('dungeonInterior');

    // 5. Move player across Molten Halls to door_lair and interact -> Dragon Lair
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.player.setPosition(832, 473);
      scene.player.body.reset(832, 473);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'cavernLair', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('cavernLair');

    // Verify Boss Lair metrics: 32x24 @ 32px -> 1024x768
    const lairMetrics = await page.evaluate(() => (window as any).__hv.world());
    expect(lairMetrics.w).toBe(1024);
    expect(lairMetrics.h).toBe(768);

    // 6. Verify Dragon spawned at dragon_spawn zone
    const dragonState = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(dragonState).not.toBeNull();
    expect(dragonState.phase).toBe(1);
    expect(dragonState.hp).toBe(1200);
    expect(dragonState.invulnerable).toBe(false);

    const dragonPos = await page.evaluate(() => {
      const d = (window as any).__scene._dragon;
      return { x: Math.round(d.x), y: Math.round(d.y) };
    });
    // dragon_spawn center: x=512, y=400
    expect(dragonPos.x).toBeCloseTo(512, -1);
    expect(dragonPos.y).toBeCloseTo(400, -1);

    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(screenshotsDir, 'cavern-lair.png') });

    // 7. Damage Dragon to trigger Phase 2 transition
    await page.evaluate(() => {
      (window as any).__hv.setDragonHp(0.5);
    });

    // Wait for the transition sequence (~1000ms TRANSITION_DURATION_MS) to complete
    await page.waitForFunction(() => (window as any).__hv?.dragonState()?.phase === 2, { timeout: 5000 });
    const p2State = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(p2State.phase).toBe(2);
    expect(p2State.hp).toBe(600);

    // 8. Player dies in the lair -> dragon resetEncounter() called and player respawned at entrance
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene._die('dragon');
    });

    // Wait for death animation & respawn flow
    await page.waitForFunction(() => !(window as any).__scene?.dead, { timeout: 10000 });

    // Assert dragon was reset to Phase 1 full HP (1200)
    const resetDragonState = await page.evaluate(() => (window as any).__hv.dragonState());
    expect(resetDragonState).not.toBeNull();
    expect(resetDragonState.phase).toBe(1);
    expect(resetDragonState.hp).toBe(1200);

    // Assert player respawned at lair entrance (spawn_default center at x=512, y=656)
    const respawnPos = await page.evaluate(() => {
      const p = (window as any).__scene.player;
      return { x: Math.round(p.x), y: Math.round(p.y), dead: (window as any).__scene.dead };
    });
    expect(respawnPos.dead).toBe(false);
    expect(respawnPos.x).toBeCloseTo(512, -1);
    expect(respawnPos.y).toBeCloseTo(656, -1);

    await page.screenshot({ path: path.join(screenshotsDir, 'cavern-lair-dragon-reset.png') });

    // 9. Exit lair back to Molten Halls via door_halls
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      // door_halls is at y: 672..736 (center: 704). sprite y = 704 + 89 = 793
      scene.player.setPosition(512, 793);
      scene.player.body.reset(512, 793);
      scene._tryInteract();
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeonInterior', { timeout: 10000 });
    expect(await page.evaluate(() => (window as any).__hv.scene())).toBe('dungeonInterior');
  });

  test('legacy/painted mode (without maps=tiled) preserves painted dungeon scenes', async ({ page }) => {
    // Boot without ?maps=tiled
    await page.goto('/?renderer=blend&seed=1&qa=1');

    const startButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startButton).toBeVisible();
    await page.waitForTimeout(400);
    await startButton.click();

    // Select class
    const classModalHeading = page.getByText('Choose Your Class');
    await expect(classModalHeading).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Choose' }).first().click();
    await expect(classModalHeading).toBeHidden();

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'village');

    // Enter dungeon
    await page.evaluate(() => {
      const scene = (window as any).__scene;
      scene.enterScene('dungeon');
    });

    await page.waitForFunction(() => (window as any).__hv?.scene() === 'dungeon', { timeout: 10000 });

    const isPainted = await page.evaluate(() => {
      const scene = (window as any).__scene;
      return {
        hasBg: Boolean(scene.bg),
        hasTiledLoader: Boolean(scene.tiledMapLoader),
      };
    });

    expect(isPainted.hasBg).toBe(true);
    expect(isPainted.hasTiledLoader).toBe(false);
  });
});
